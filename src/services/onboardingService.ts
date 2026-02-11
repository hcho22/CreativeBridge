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
 */

import { supabase } from './supabase';
import { onboardingMilestoneTracker } from './onboardingMilestoneTracker';
import type { OnboardingProgress, OnboardingStatus } from '../types/database';

// Re-export types from tracker for backward compatibility
export type {
  OnboardingMilestones,
  FeatureTooltipsShown,
} from './onboardingMilestoneTracker';

/**
 * Helper to call RPC functions with proper typing
 * Supabase RPC type inference can be strict, so we use explicit casting via unknown
 */
async function callRpc<T>(
  functionName: string,
  params: Record<string, unknown>,
): Promise<{ data: T | null; error: { message: string } | null }> {
  // Cast via unknown for RPC functions with parameters not fully typed in Database interface
  const rpcFn = supabase.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: T | null; error: { message: string } | null }>;
  return await rpcFn(functionName, params);
}

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
   * Falls back to AsyncStorage if database call fails
   */
  async getOnboardingStatus(userId: string): Promise<OnboardingStatus | null> {
    try {
      // Check cache first
      if (this.cachedOnboardingStatus && Date.now() < this.statusCacheExpiry) {
        return this.cachedOnboardingStatus;
      }

      const { data, error } = await callRpc<OnboardingStatus[]>(
        'get_onboarding_status',
        {
          p_user_id: userId,
        },
      );

      if (error) {
        console.error(
          '❌ Error fetching onboarding status from database:',
          error,
        );
        // Fall back to AsyncStorage-based progress
        return this.buildStatusFromAsyncStorage();
      }

      if (data && data.length > 0) {
        this.cachedOnboardingStatus = data[0];
        this.statusCacheExpiry = Date.now() + this.CACHE_TTL_MS;
        return this.cachedOnboardingStatus;
      }

      return null;
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
      const { data, error } = await callRpc<boolean>(
        'update_onboarding_progress_item',
        {
          p_user_id: userId,
          p_item_key: itemKey,
          p_completed: completed,
        },
      );

      if (error) {
        console.error(`❌ Error updating checklist item ${itemKey}:`, error);
        return { success: false, error: error.message };
      }

      // Invalidate cache
      this.invalidateCache();

      console.log(`✅ Checklist item '${itemKey}' updated to ${completed}`);
      return { success: data === true };
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
      const xpReward = awardXp ? ONBOARDING_XP_REWARDS[milestoneType] : 0;

      const { data, error } = await callRpc<boolean>(
        'record_onboarding_milestone',
        {
          p_user_id: userId,
          p_milestone_type: milestoneType,
          p_xp_reward: xpReward,
        },
      );

      if (error) {
        console.error(`❌ Error recording milestone ${milestoneType}:`, error);
        return { success: false, error: error.message };
      }

      // Invalidate cache
      this.invalidateCache();

      console.log(
        `🏆 Milestone '${milestoneType}' recorded with ${xpReward} XP`,
      );
      return { success: data === true };
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
   * Combines database and AsyncStorage data
   */
  async getOnboardingProgress(
    userId?: string,
  ): Promise<OnboardingProgressResult> {
    try {
      // Try database first if user ID provided
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
   */
  async markOnboardingComplete(
    userId: string,
  ): Promise<OnboardingServiceResult> {
    try {
      // Cast via unknown for update with onboarding fields not fully typed
      const updateFn = supabase.from('user_profiles').update as unknown as (
        values: Record<string, unknown>,
      ) => {
        eq: (
          col: string,
          val: string,
        ) => Promise<{ error: { message: string } | null }>;
      };
      const { error } = await updateFn({ onboarding_completed: true }).eq(
        'id',
        userId,
      );

      if (error) {
        console.error('❌ Error marking onboarding complete:', error);
        return { success: false, error: error.message };
      }

      // Invalidate cache
      this.invalidateCache();

      console.log('✅ Onboarding marked as complete');
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

      // Sync each milestone if it exists in AsyncStorage
      if (milestones.firstStoryCompletedAt) {
        const result = await this.recordMilestone(userId, 'first_story', false);
        if (result.success) synced.push('first_story');
      }

      if (milestones.firstImageGeneratedAt) {
        const result = await this.recordMilestone(userId, 'first_image', false);
        if (result.success) synced.push('first_image');
      }

      if (milestones.firstVoiceInputAt) {
        const result = await this.recordMilestone(userId, 'first_voice', false);
        if (result.success) synced.push('first_voice');
      }

      if (milestones.firstStreakAchievedAt) {
        const result = await this.recordMilestone(
          userId,
          'first_streak',
          false,
        );
        if (result.success) synced.push('first_streak');
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
        // Cast via unknown for update with onboarding fields including null values
        const updateFn = supabase.from('user_profiles').update as unknown as (
          values: Record<string, unknown>,
        ) => {
          eq: (
            col: string,
            val: string,
          ) => Promise<{ error: { message: string } | null }>;
        };
        const { error } = await updateFn({
          onboarding_completed: false,
          onboarding_progress: {
            create_account: true,
            first_story: false,
            first_image: false,
            first_voice: false,
            first_streak: false,
          },
          first_story_completed_at: null,
          first_image_generated_at: null,
          first_voice_input_at: null,
          first_streak_achieved_at: null,
        }).eq('id', userId);

        if (error) {
          console.error('❌ Error resetting onboarding in database:', error);
          return { success: false, error: error.message };
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
