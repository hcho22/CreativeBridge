/**
 * Onboarding Service (US-019)
 *
 * A centralized service to manage all onboarding state and logic.
 * Consolidates functionality from:
 * - onboardingMilestoneTracker (AsyncStorage tracking)
 * - Database RPC functions (onboarding progress)
 * - AuthContext XP awarding
 *
 * Responsibilities:
 * - Fetching onboarding progress from database
 * - Updating checklist item completion
 * - Awarding XP for completed items
 * - Checking if specific celebrations should trigger
 * - Marking onboarding as complete
 * - Syncing AsyncStorage state to database
 *
 * Convex is the sole data store for all users.
 * Supabase dual-write and fallback paths removed per US-012 (Phase 4 cleanup).
 */

import { onboardingMilestoneTracker } from './onboardingMilestoneTracker';
import type { OnboardingProgress, OnboardingStatus } from '../types/database';

import { getConvexClient, api, isConvexReady } from './convex';

// Re-export types from tracker for backward compatibility
export type {
  OnboardingMilestones,
  FeatureTooltipsShown,
} from './onboardingMilestoneTracker';

// XP reward amounts for onboarding milestones (US-010)
export const ONBOARDING_XP_REWARDS = {
  first_story: 50,
  first_image: 25,
  first_voice: 25,
  first_streak: 50,
} as const;

export type OnboardingMilestoneType = keyof typeof ONBOARDING_XP_REWARDS;

// Celebration configuration
export interface CelebrationConfig {
  title: string;
  message: string;
  emoji: string;
  xpMessage?: string;
}

export const CELEBRATION_CONFIGS: Record<
  OnboardingMilestoneType,
  CelebrationConfig
> = {
  first_story: {
    title: '🎉 You wrote your first story!',
    message:
      'Amazing work! You just created your first AI-collaborative story.',
    emoji: '🎉',
    xpMessage: '+50 XP earned!',
  },
  first_image: {
    title: '🎨 Your story came to life!',
    message: 'AI created an illustration matching your grade level art style!',
    emoji: '🎨',
    xpMessage: '+25 XP earned!',
  },
  first_voice: {
    title: '🎤 Voice activated!',
    message: 'You discovered voice input! Speak your stories into existence.',
    emoji: '🎤',
    xpMessage: '+25 XP earned!',
  },
  first_streak: {
    title: "🔥 You're on fire!",
    message: '2-day streak achieved! Keep the momentum going.',
    emoji: '🔥',
    xpMessage: '+50 Bonus XP for your streak!',
  },
};

// Result types
export interface OnboardingServiceResult {
  success: boolean;
  error?: string;
}

export interface MilestoneResult extends OnboardingServiceResult {
  isFirstTime: boolean;
  shouldShowCelebration: boolean;
  xpAwarded?: number;
  celebrationConfig?: CelebrationConfig;
}

export interface OnboardingProgressResult extends OnboardingServiceResult {
  progress?: {
    accountCreated: boolean;
    storiesCompleted: boolean;
    imagesGenerated: boolean;
    voiceInputUsed: boolean;
    streakAchieved: boolean;
    totalCompleted: number;
    totalMilestones: number;
    completionPercentage: number;
    isComplete: boolean;
  };
}

export interface DatabaseSyncResult extends OnboardingServiceResult {
  synced: boolean;
  milestonesSynced?: string[];
}

class OnboardingService {
  private static instance: OnboardingService;
  private cachedOnboardingStatus: OnboardingStatus | null = null;
  private statusCacheExpiry: number = 0;
  private readonly CACHE_TTL_MS = 60000; // 1 minute cache

  public static getInstance(): OnboardingService {
    if (!OnboardingService.instance) {
      OnboardingService.instance = new OnboardingService();
    }
    return OnboardingService.instance;
  }

  // ============================================================================
  // Database Integration
  // ============================================================================

  /**
   * Fetch onboarding progress from database
   * Falls back to AsyncStorage if Convex is unavailable
   */
  async getOnboardingStatus(userId: string): Promise<OnboardingStatus | null> {
    try {
      // Check cache first
      if (this.cachedOnboardingStatus && Date.now() < this.statusCacheExpiry) {
        return this.cachedOnboardingStatus;
      }

      if (!isConvexReady()) {
        console.warn('⚠️ Convex not ready, falling back to AsyncStorage');
        return this.buildStatusFromAsyncStorage();
      }

      const convexClient = getConvexClient();
      if (!convexClient) {
        console.warn(
          '⚠️ Convex client unavailable, falling back to AsyncStorage',
        );
        return this.buildStatusFromAsyncStorage();
      }

      try {
        const convexStatus = await convexClient.query(
          api.onboarding.getOnboardingStatus,
          { clerkUserId: userId },
        );

        if (convexStatus) {
          const status: OnboardingStatus = {
            onboarding_completed: convexStatus.onboardingCompleted,
            onboarding_progress: convexStatus.onboardingProgress,
            first_story_completed_at:
              convexStatus.milestones.firstStoryCompletedAt,
            first_image_generated_at:
              convexStatus.milestones.firstImageGeneratedAt,
            first_voice_input_at: convexStatus.milestones.firstVoiceInputAt,
            first_streak_achieved_at:
              convexStatus.milestones.firstStreakAchievedAt,
            completion_percentage: convexStatus.completionPercentage,
          };

          this.cachedOnboardingStatus = status;
          this.statusCacheExpiry = Date.now() + this.CACHE_TTL_MS;
          return status;
        }

        return null;
      } catch (convexError) {
        console.error(
          '⚠️ Convex onboarding status fetch failed, falling back to AsyncStorage:',
          convexError,
        );
        return this.buildStatusFromAsyncStorage();
      }
    } catch (error) {
      console.error('❌ Error in getOnboardingStatus:', error);
      return this.buildStatusFromAsyncStorage();
    }
  }

  /**
   * Build OnboardingStatus from AsyncStorage (fallback)
   */
  private async buildStatusFromAsyncStorage(): Promise<OnboardingStatus> {
    const milestones = await onboardingMilestoneTracker.getMilestones();
    const progress = await onboardingMilestoneTracker.getMilestoneProgress();

    return {
      onboarding_completed: progress.totalCompleted >= progress.totalMilestones,
      onboarding_progress: {
        create_account: true, // Always complete if user exists
        first_story: progress.storiesCompleted,
        first_image: progress.imagesGenerated,
        first_voice: progress.voiceInputUsed,
        first_streak: progress.streakAchieved,
      },
      first_story_completed_at: milestones.firstStoryCompletedAt || null,
      first_image_generated_at: milestones.firstImageGeneratedAt || null,
      first_voice_input_at: milestones.firstVoiceInputAt || null,
      first_streak_achieved_at: milestones.firstStreakAchievedAt || null,
      // Calculate completion percentage: account (20%) + 4 milestones (20% each) = 100%
      completion_percentage: Math.round(
        ((1 + progress.totalCompleted) / 5) * 100,
      ),
    };
  }

  /**
   * Update a specific checklist item completion status in database
   */
  async updateChecklistItem(
    userId: string,
    itemKey: keyof OnboardingProgress,
    completed: boolean = true,
  ): Promise<OnboardingServiceResult> {
    try {
      if (!isConvexReady()) {
        return { success: false, error: 'Convex not ready' };
      }

      const convexClient = getConvexClient();
      if (!convexClient) {
        return { success: false, error: 'Convex client unavailable' };
      }

      try {
        await convexClient.mutation(
          api.onboarding.updateOnboardingProgressItem,
          {
            clerkUserId: userId,
            itemKey: itemKey,
            completed: completed,
          },
        );
        console.log(
          `✅ Checklist item '${itemKey}' updated in Convex to ${completed}`,
        );
      } catch (convexError) {
        console.error(
          `❌ Convex checklist update failed for '${itemKey}':`,
          convexError,
        );
        return {
          success: false,
          error:
            convexError instanceof Error
              ? convexError.message
              : 'Convex update failed',
        };
      }

      // Invalidate cache
      this.invalidateCache();

      return { success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Error in updateChecklistItem:`, error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Record a milestone achievement in database with optional XP reward
   */
  async recordMilestone(
    userId: string,
    milestoneType: OnboardingMilestoneType,
    awardXp: boolean = true,
  ): Promise<OnboardingServiceResult> {
    try {
      if (!isConvexReady()) {
        return { success: false, error: 'Convex not ready' };
      }

      const convexClient = getConvexClient();
      if (!convexClient) {
        return { success: false, error: 'Convex client unavailable' };
      }

      try {
        const result = await convexClient.mutation(
          api.onboarding.recordOnboardingMilestone,
          {
            clerkUserId: userId,
            milestoneType: milestoneType,
            awardXp: awardXp,
          },
        );

        if (result.alreadyAchieved) {
          console.log(`ℹ️ Milestone '${milestoneType}' was already achieved`);
        } else {
          console.log(
            `🏆 Milestone '${milestoneType}' recorded with ${result.xpAwarded} XP`,
          );
        }
      } catch (convexError) {
        console.error(
          `❌ Convex milestone recording failed for '${milestoneType}':`,
          convexError,
        );
        return {
          success: false,
          error:
            convexError instanceof Error
              ? convexError.message
              : 'Convex milestone recording failed',
        };
      }

      // Invalidate cache
      this.invalidateCache();

      return { success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Error in recordMilestone:`, error);
      return { success: false, error: errorMessage };
    }
  }

  // ============================================================================
  // Milestone Tracking (delegates to onboardingMilestoneTracker)
  // ============================================================================

  /**
   * Process first story completion
   * Marks milestone, checks celebration eligibility, returns XP info
   */
  async processFirstStoryCompletion(userId?: string): Promise<MilestoneResult> {
    try {
      const result = await onboardingMilestoneTracker.markFirstStoryCompleted();

      // If database user ID provided, also record in database
      if (userId && result.isFirstStory) {
        await this.recordMilestone(userId, 'first_story');
      }

      return {
        success: true,
        isFirstTime: result.isFirstStory,
        shouldShowCelebration: result.shouldShowCelebration,
        xpAwarded: result.shouldShowCelebration
          ? ONBOARDING_XP_REWARDS.first_story
          : 0,
        celebrationConfig: result.shouldShowCelebration
          ? CELEBRATION_CONFIGS.first_story
          : undefined,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Error processing first story completion:', error);
      return {
        success: false,
        error: errorMessage,
        isFirstTime: false,
        shouldShowCelebration: false,
      };
    }
  }

  /**
   * Process first image generation
   */
  async processFirstImageGeneration(userId?: string): Promise<MilestoneResult> {
    try {
      const result = await onboardingMilestoneTracker.markFirstImageGenerated();

      if (userId && result.isFirstImage) {
        await this.recordMilestone(userId, 'first_image');
      }

      return {
        success: true,
        isFirstTime: result.isFirstImage,
        shouldShowCelebration: result.shouldShowCelebration,
        xpAwarded: result.shouldShowCelebration
          ? ONBOARDING_XP_REWARDS.first_image
          : 0,
        celebrationConfig: result.shouldShowCelebration
          ? CELEBRATION_CONFIGS.first_image
          : undefined,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Error processing first image generation:', error);
      return {
        success: false,
        error: errorMessage,
        isFirstTime: false,
        shouldShowCelebration: false,
      };
    }
  }

  /**
   * Process first voice input usage
   */
  async processFirstVoiceInput(userId?: string): Promise<MilestoneResult> {
    try {
      const isFirst =
        await onboardingMilestoneTracker.markFirstVoiceInputUsed();

      if (userId && isFirst) {
        await this.recordMilestone(userId, 'first_voice');
      }

      return {
        success: true,
        isFirstTime: isFirst,
        shouldShowCelebration: false, // Voice input doesn't show modal, just awards XP
        xpAwarded: isFirst ? ONBOARDING_XP_REWARDS.first_voice : 0,
        celebrationConfig: isFirst
          ? CELEBRATION_CONFIGS.first_voice
          : undefined,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Error processing first voice input:', error);
      return {
        success: false,
        error: errorMessage,
        isFirstTime: false,
        shouldShowCelebration: false,
      };
    }
  }

  /**
   * Process first streak achievement
   */
  async processFirstStreakAchievement(
    userId?: string,
  ): Promise<MilestoneResult> {
    try {
      const result = await onboardingMilestoneTracker.markFirstStreakAchieved();

      if (userId && result.isFirstStreak) {
        await this.recordMilestone(userId, 'first_streak');
      }

      return {
        success: true,
        isFirstTime: result.isFirstStreak,
        shouldShowCelebration: result.shouldShowCelebration,
        xpAwarded: result.shouldShowCelebration
          ? ONBOARDING_XP_REWARDS.first_streak
          : 0,
        celebrationConfig: result.shouldShowCelebration
          ? CELEBRATION_CONFIGS.first_streak
          : undefined,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Error processing first streak achievement:', error);
      return {
        success: false,
        error: errorMessage,
        isFirstTime: false,
        shouldShowCelebration: false,
      };
    }
  }

  /**
   * Mark a celebration as shown (prevents re-showing)
   */
  async markCelebrationShown(
    milestoneType: OnboardingMilestoneType,
  ): Promise<void> {
    switch (milestoneType) {
      case 'first_story':
        await onboardingMilestoneTracker.markFirstStoryCelebrationShown();
        break;
      case 'first_image':
        await onboardingMilestoneTracker.markFirstImageCelebrationShown();
        break;
      case 'first_streak':
        await onboardingMilestoneTracker.markFirstStreakCelebrationShown();
        break;
      // first_voice doesn't have a celebration modal
    }
  }

  // ============================================================================
  // Onboarding Progress
  // ============================================================================

  /**
   * Get comprehensive onboarding progress
   * Combines Convex database and AsyncStorage data
   */
  async getOnboardingProgress(
    userId?: string,
  ): Promise<OnboardingProgressResult> {
    try {
      // Try database first if user ID provided
      // Note: getOnboardingStatus already handles Convex PRIMARY (US-021)
      if (userId) {
        const dbStatus = await this.getOnboardingStatus(userId);
        if (dbStatus) {
          const totalCompleted = [
            dbStatus.onboarding_progress.first_story,
            dbStatus.onboarding_progress.first_image,
            dbStatus.onboarding_progress.first_voice,
            dbStatus.onboarding_progress.first_streak,
          ].filter(Boolean).length;

          return {
            success: true,
            progress: {
              accountCreated: dbStatus.onboarding_progress.create_account,
              storiesCompleted: dbStatus.onboarding_progress.first_story,
              imagesGenerated: dbStatus.onboarding_progress.first_image,
              voiceInputUsed: dbStatus.onboarding_progress.first_voice,
              streakAchieved: dbStatus.onboarding_progress.first_streak,
              totalCompleted,
              totalMilestones: 4,
              completionPercentage: dbStatus.completion_percentage,
              isComplete: dbStatus.onboarding_completed,
            },
          };
        }
      }

      // Fall back to AsyncStorage
      const localProgress =
        await onboardingMilestoneTracker.getMilestoneProgress();

      return {
        success: true,
        progress: {
          accountCreated: true,
          storiesCompleted: localProgress.storiesCompleted,
          imagesGenerated: localProgress.imagesGenerated,
          voiceInputUsed: localProgress.voiceInputUsed,
          streakAchieved: localProgress.streakAchieved,
          totalCompleted: localProgress.totalCompleted,
          totalMilestones: localProgress.totalMilestones,
          completionPercentage: Math.round(
            ((1 + localProgress.totalCompleted) / 5) * 100,
          ),
          isComplete:
            localProgress.totalCompleted >= localProgress.totalMilestones,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Error getting onboarding progress:', error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Check if onboarding is complete
   */
  async isOnboardingComplete(userId?: string): Promise<boolean> {
    try {
      if (userId) {
        const dbStatus = await this.getOnboardingStatus(userId);
        if (dbStatus) {
          return dbStatus.onboarding_completed;
        }
      }

      return await onboardingMilestoneTracker.isOnboardingComplete();
    } catch (error) {
      console.error('❌ Error checking onboarding completion:', error);
      return false;
    }
  }

  /**
   * Mark onboarding as complete in database
   *
   * Uses recordMultipleMilestones to set all items as complete,
   * which automatically updates onboardingCompleted via the isOnboardingComplete helper.
   */
  async markOnboardingComplete(
    userId: string,
  ): Promise<OnboardingServiceResult> {
    try {
      if (!isConvexReady()) {
        return { success: false, error: 'Convex not ready' };
      }

      const convexClient = getConvexClient();
      if (!convexClient) {
        return { success: false, error: 'Convex client unavailable' };
      }

      try {
        const milestones = [
          'first_story',
          'first_image',
          'first_voice',
          'first_streak',
        ];

        await convexClient.mutation(api.onboarding.recordMultipleMilestones, {
          clerkUserId: userId,
          milestones: milestones,
          awardXp: false, // Don't award XP when force-completing
        });

        console.log('✅ Onboarding marked as complete in Convex');
      } catch (convexError) {
        console.error('❌ Convex markOnboardingComplete failed:', convexError);
        return {
          success: false,
          error:
            convexError instanceof Error
              ? convexError.message
              : 'Convex update failed',
        };
      }

      // Invalidate cache
      this.invalidateCache();

      return { success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Error in markOnboardingComplete:', error);
      return { success: false, error: errorMessage };
    }
  }

  // ============================================================================
  // Checklist Management
  // ============================================================================

  /**
   * Check if checklist has been dismissed
   */
  async isChecklistDismissed(): Promise<boolean> {
    return onboardingMilestoneTracker.isChecklistDismissed();
  }

  /**
   * Dismiss the checklist
   */
  async dismissChecklist(): Promise<void> {
    await onboardingMilestoneTracker.dismissChecklist();
  }

  /**
   * Reset checklist dismissed state (show it again)
   */
  async resetChecklistDismissed(): Promise<void> {
    await onboardingMilestoneTracker.resetChecklistDismissed();
  }

  // ============================================================================
  // Feature Tooltips
  // ============================================================================

  /**
   * Check if a feature tooltip should be shown
   */
  async shouldShowTooltip(
    tooltipType: 'voiceInput' | 'imageGeneration' | 'xpChallenges',
  ): Promise<boolean> {
    switch (tooltipType) {
      case 'voiceInput':
        return onboardingMilestoneTracker.shouldShowVoiceInputTooltip();
      case 'imageGeneration':
        return onboardingMilestoneTracker.shouldShowImageGenerationTooltip();
      case 'xpChallenges':
        return onboardingMilestoneTracker.shouldShowXpChallengesTooltip();
      default:
        return false;
    }
  }

  /**
   * Mark a tooltip as shown
   */
  async markTooltipShown(
    tooltipType: 'voiceInput' | 'imageGeneration' | 'xpChallenges',
  ): Promise<void> {
    switch (tooltipType) {
      case 'voiceInput':
        await onboardingMilestoneTracker.markVoiceInputTooltipShown();
        break;
      case 'imageGeneration':
        await onboardingMilestoneTracker.markImageGenerationTooltipShown();
        break;
      case 'xpChallenges':
        await onboardingMilestoneTracker.markXpChallengesTooltipShown();
        break;
    }
  }

  // ============================================================================
  // First Story Guidance
  // ============================================================================

  /**
   * Check if first story guidance modal should be shown
   */
  async shouldShowFirstStoryGuidance(): Promise<boolean> {
    return onboardingMilestoneTracker.shouldShowFirstStoryGuidance();
  }

  /**
   * Mark first story guidance as shown
   */
  async markFirstStoryGuidanceShown(): Promise<void> {
    await onboardingMilestoneTracker.markFirstStoryGuidanceShown();
  }

  // ============================================================================
  // Database Sync
  // ============================================================================

  /**
   * Sync AsyncStorage milestones to database
   * Call this when user first logs in or to ensure consistency
   */
  async syncToDatabase(userId: string): Promise<DatabaseSyncResult> {
    try {
      const milestones = await onboardingMilestoneTracker.getMilestones();
      const synced: string[] = [];

      // Collect milestones that need syncing
      const milestonesToSync: OnboardingMilestoneType[] = [];

      if (milestones.firstStoryCompletedAt) {
        milestonesToSync.push('first_story');
      }
      if (milestones.firstImageGeneratedAt) {
        milestonesToSync.push('first_image');
      }
      if (milestones.firstVoiceInputAt) {
        milestonesToSync.push('first_voice');
      }
      if (milestones.firstStreakAchievedAt) {
        milestonesToSync.push('first_streak');
      }

      if (milestonesToSync.length === 0) {
        return { success: true, synced: false, milestonesSynced: [] };
      }

      // Use batch sync for efficiency
      if (isConvexReady()) {
        const convexClient = getConvexClient();
        if (convexClient) {
          try {
            console.log(
              `📝 Batch syncing ${milestonesToSync.length} milestones to Convex`,
            );
            const result = await convexClient.mutation(
              api.onboarding.recordMultipleMilestones,
              {
                clerkUserId: userId,
                milestones: milestonesToSync,
                awardXp: false, // Don't award XP during sync (may have been awarded earlier)
              },
            );

            for (const milestoneResult of result.results) {
              if (milestoneResult.success) {
                synced.push(milestoneResult.milestoneType);
              }
            }

            console.log(
              `✅ Batch synced ${synced.length} milestones to Convex`,
            );

            return {
              success: true,
              synced: synced.length > 0,
              milestonesSynced: synced,
            };
          } catch (convexError) {
            console.error('❌ Convex batch sync failed:', convexError);
            // Fall through to individual sync via recordMilestone
          }
        }
      }

      // Fallback: Sync each milestone individually
      for (const milestone of milestonesToSync) {
        const result = await this.recordMilestone(userId, milestone, false);
        if (result.success) synced.push(milestone);
      }

      console.log(`🔄 Synced ${synced.length} milestones to database:`, synced);
      return {
        success: true,
        synced: synced.length > 0,
        milestonesSynced: synced,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Error syncing to database:', error);
      return { success: false, error: errorMessage, synced: false };
    }
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  /**
   * Invalidate cached onboarding status
   */
  invalidateCache(): void {
    this.cachedOnboardingStatus = null;
    this.statusCacheExpiry = 0;
  }

  /**
   * Clear all caches (call on logout)
   */
  clearAllCaches(): void {
    this.invalidateCache();
    onboardingMilestoneTracker.clearCache();
  }

  /**
   * Reset all onboarding data (for testing or account reset)
   */
  async resetOnboarding(userId?: string): Promise<OnboardingServiceResult> {
    try {
      // Clear AsyncStorage
      await onboardingMilestoneTracker.clearMilestones();

      // Clear database if user ID provided
      if (userId) {
        if (!isConvexReady()) {
          return { success: false, error: 'Convex not ready' };
        }

        const convexClient = getConvexClient();
        if (!convexClient) {
          return { success: false, error: 'Convex client unavailable' };
        }

        try {
          await convexClient.mutation(api.onboarding.resetOnboardingProgress, {
            clerkUserId: userId,
            keepAccountCreated: true,
          });
          console.log('✅ Onboarding reset in Convex');
        } catch (convexError) {
          console.error('❌ Convex onboarding reset failed:', convexError);
          return {
            success: false,
            error:
              convexError instanceof Error
                ? convexError.message
                : 'Convex reset failed',
          };
        }
      }

      // Clear caches
      this.clearAllCaches();

      console.log('🧹 Onboarding reset complete');
      return { success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Error resetting onboarding:', error);
      return { success: false, error: errorMessage };
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get XP reward amount for a milestone type
   */
  getXpReward(milestoneType: OnboardingMilestoneType): number {
    return ONBOARDING_XP_REWARDS[milestoneType];
  }

  /**
   * Get celebration configuration for a milestone type
   */
  getCelebrationConfig(
    milestoneType: OnboardingMilestoneType,
  ): CelebrationConfig {
    return CELEBRATION_CONFIGS[milestoneType];
  }

  /**
   * Get total possible onboarding XP
   */
  getTotalOnboardingXp(): number {
    return Object.values(ONBOARDING_XP_REWARDS).reduce(
      (sum, xp) => sum + xp,
      0,
    );
  }

  /**
   * Calculate XP earned from completed milestones
   */
  calculateEarnedXp(progress: OnboardingProgressResult['progress']): number {
    if (!progress) return 0;

    let total = 0;
    if (progress.storiesCompleted) total += ONBOARDING_XP_REWARDS.first_story;
    if (progress.imagesGenerated) total += ONBOARDING_XP_REWARDS.first_image;
    if (progress.voiceInputUsed) total += ONBOARDING_XP_REWARDS.first_voice;
    if (progress.streakAchieved) total += ONBOARDING_XP_REWARDS.first_streak;
    return total;
  }
}

// Export singleton instance
export const onboardingService = OnboardingService.getInstance();

export default OnboardingService;
