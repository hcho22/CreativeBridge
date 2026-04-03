/**
 * Onboarding Milestone Tracker Service (US-004, US-005, US-006)
 *
 * Tracks first-time achievements for onboarding celebrations:
 * - First story completed
 * - First image generated
 * - First streak achieved
 * - First voice input used
 *
 * Uses AsyncStorage for now until database schema is updated (US-007).
 * Can be migrated to database storage later for cross-device sync.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys for milestone tracking
const STORAGE_PREFIX = '@CreativeBridge:onboarding:';
const MILESTONES_KEY = `${STORAGE_PREFIX}milestones`;
const CHECKLIST_DISMISSED_KEY = `${STORAGE_PREFIX}checklistDismissed`;
const FIRST_STORY_GUIDANCE_KEY = `${STORAGE_PREFIX}firstStoryGuidanceShown`;
const FEATURE_TOOLTIPS_KEY = `${STORAGE_PREFIX}featureTooltipsShown`;

export interface OnboardingMilestones {
  firstStoryCompletedAt?: string; // ISO timestamp
  firstImageGeneratedAt?: string;
  firstStreakAchievedAt?: string;
  firstVoiceInputAt?: string;
  // Track which celebrations have been shown (one-time only)
  celebrationsShown: {
    firstStory: boolean;
    firstImage: boolean;
    firstStreak: boolean;
  };
}

/**
 * Feature tooltips tracking for onboarding (US-013, US-014, US-015)
 * Each tooltip should only be shown once per user.
 */
export interface FeatureTooltipsShown {
  voiceInput: boolean; // US-013
  imageGeneration: boolean; // US-014
  xpChallenges: boolean; // US-015
}

const DEFAULT_MILESTONES: OnboardingMilestones = {
  celebrationsShown: {
    firstStory: false,
    firstImage: false,
    firstStreak: false,
  },
};

const DEFAULT_FEATURE_TOOLTIPS: FeatureTooltipsShown = {
  voiceInput: false,
  imageGeneration: false,
  xpChallenges: false,
};

class OnboardingMilestoneTracker {
  private static instance: OnboardingMilestoneTracker;
  private cachedMilestones: OnboardingMilestones | null = null;
  private cachedFeatureTooltips: FeatureTooltipsShown | null = null;

  public static getInstance(): OnboardingMilestoneTracker {
    if (!OnboardingMilestoneTracker.instance) {
      OnboardingMilestoneTracker.instance = new OnboardingMilestoneTracker();
    }
    return OnboardingMilestoneTracker.instance;
  }

  /**
   * Get current milestones from storage
   */
  async getMilestones(): Promise<OnboardingMilestones> {
    try {
      // Return cached milestones if available
      if (this.cachedMilestones) {
        return this.cachedMilestones;
      }

      const data = await AsyncStorage.getItem(MILESTONES_KEY);
      if (data) {
        this.cachedMilestones = JSON.parse(data);
        return this.cachedMilestones!;
      }

      // Initialize with defaults
      this.cachedMilestones = { ...DEFAULT_MILESTONES };
      return this.cachedMilestones;
    } catch (error) {
      console.error('❌ Error getting onboarding milestones:', error);
      return { ...DEFAULT_MILESTONES };
    }
  }

  /**
   * Save milestones to storage
   */
  private async saveMilestones(
    milestones: OnboardingMilestones,
  ): Promise<void> {
    try {
      this.cachedMilestones = milestones;
      await AsyncStorage.setItem(MILESTONES_KEY, JSON.stringify(milestones));
    } catch (error) {
      console.error('❌ Error saving onboarding milestones:', error);
    }
  }

  /**
   * Check if this is the user's first story completion
   * Returns true if celebration should be shown
   */
  async checkFirstStoryCompletion(): Promise<boolean> {
    const milestones = await this.getMilestones();

    // If already completed a story before, don't show celebration
    if (milestones.firstStoryCompletedAt) {
      return false;
    }

    return true;
  }

  /**
   * Mark first story as completed and check if celebration should show.
   * @param serverIsFirstStory - If provided, uses the server's authoritative flag
   *   instead of local AsyncStorage. This prevents false celebrations when
   *   AsyncStorage was cleared but the user has completed stories before.
   */
  async markFirstStoryCompleted(serverIsFirstStory?: boolean): Promise<{
    isFirstStory: boolean;
    shouldShowCelebration: boolean;
  }> {
    const milestones = await this.getMilestones();

    // Use server truth when available; fall back to local check
    const isFirstStory =
      serverIsFirstStory !== undefined
        ? serverIsFirstStory
        : !milestones.firstStoryCompletedAt;

    if (isFirstStory) {
      // Mark as completed with timestamp
      milestones.firstStoryCompletedAt = new Date().toISOString();
      await this.saveMilestones(milestones);

      console.log('🎉 First story completed! Milestone tracked.');
    } else if (!milestones.firstStoryCompletedAt) {
      // Server says not first story, but local is missing the timestamp — fix it
      milestones.firstStoryCompletedAt = new Date().toISOString();
      milestones.celebrationsShown.firstStory = true;
      await this.saveMilestones(milestones);
      console.log(
        '🔄 Synced first story milestone from server (not first story)',
      );
    }

    // Check if celebration should be shown
    // (only if first story AND celebration hasn't been shown yet)
    const shouldShowCelebration =
      isFirstStory && !milestones.celebrationsShown.firstStory;

    return { isFirstStory, shouldShowCelebration };
  }

  /**
   * Mark the first story celebration as shown (prevent repeat)
   */
  async markFirstStoryCelebrationShown(): Promise<void> {
    const milestones = await this.getMilestones();
    milestones.celebrationsShown.firstStory = true;
    await this.saveMilestones(milestones);

    console.log('✅ First story celebration marked as shown.');
  }

  /**
   * Check if first image celebration should show
   */
  async checkFirstImageGeneration(): Promise<boolean> {
    const milestones = await this.getMilestones();
    return !milestones.firstImageGeneratedAt;
  }

  /**
   * Mark first image as generated.
   * @param serverIsFirstImage - If provided, uses the server's authoritative flag
   *   instead of local AsyncStorage.
   */
  async markFirstImageGenerated(serverIsFirstImage?: boolean): Promise<{
    isFirstImage: boolean;
    shouldShowCelebration: boolean;
  }> {
    const milestones = await this.getMilestones();
    const isFirstImage =
      serverIsFirstImage !== undefined
        ? serverIsFirstImage
        : !milestones.firstImageGeneratedAt;

    if (isFirstImage) {
      milestones.firstImageGeneratedAt = new Date().toISOString();
      await this.saveMilestones(milestones);
      console.log('🎨 First image generated! Milestone tracked.');
    } else if (!milestones.firstImageGeneratedAt) {
      milestones.firstImageGeneratedAt = new Date().toISOString();
      milestones.celebrationsShown.firstImage = true;
      await this.saveMilestones(milestones);
      console.log(
        '🔄 Synced first image milestone from server (not first image)',
      );
    }

    const shouldShowCelebration =
      isFirstImage && !milestones.celebrationsShown.firstImage;

    return { isFirstImage, shouldShowCelebration };
  }

  /**
   * Mark the first image celebration as shown
   */
  async markFirstImageCelebrationShown(): Promise<void> {
    const milestones = await this.getMilestones();
    milestones.celebrationsShown.firstImage = true;
    await this.saveMilestones(milestones);
  }

  /**
   * Check if first streak celebration should show
   */
  async checkFirstStreakAchievement(): Promise<boolean> {
    const milestones = await this.getMilestones();
    return !milestones.firstStreakAchievedAt;
  }

  /**
   * Mark first streak as achieved.
   * @param serverIsFirstStreak - If provided, uses the server's authoritative flag
   *   instead of local AsyncStorage.
   */
  async markFirstStreakAchieved(serverIsFirstStreak?: boolean): Promise<{
    isFirstStreak: boolean;
    shouldShowCelebration: boolean;
  }> {
    const milestones = await this.getMilestones();
    const isFirstStreak =
      serverIsFirstStreak !== undefined
        ? serverIsFirstStreak
        : !milestones.firstStreakAchievedAt;

    if (isFirstStreak) {
      milestones.firstStreakAchievedAt = new Date().toISOString();
      await this.saveMilestones(milestones);
      console.log('🔥 First streak achieved! Milestone tracked.');
    } else if (!milestones.firstStreakAchievedAt) {
      milestones.firstStreakAchievedAt = new Date().toISOString();
      milestones.celebrationsShown.firstStreak = true;
      await this.saveMilestones(milestones);
      console.log(
        '🔄 Synced first streak milestone from server (not first streak)',
      );
    }

    const shouldShowCelebration =
      isFirstStreak && !milestones.celebrationsShown.firstStreak;

    return { isFirstStreak, shouldShowCelebration };
  }

  /**
   * Mark the first streak celebration as shown
   */
  async markFirstStreakCelebrationShown(): Promise<void> {
    const milestones = await this.getMilestones();
    milestones.celebrationsShown.firstStreak = true;
    await this.saveMilestones(milestones);
  }

  /**
   * Mark first voice input as used.
   * @param serverIsFirstVoice - If provided, uses the server's authoritative flag
   *   instead of local AsyncStorage.
   */
  async markFirstVoiceInputUsed(
    serverIsFirstVoice?: boolean,
  ): Promise<boolean> {
    const milestones = await this.getMilestones();
    const isFirst =
      serverIsFirstVoice !== undefined
        ? serverIsFirstVoice
        : !milestones.firstVoiceInputAt;

    if (isFirst) {
      milestones.firstVoiceInputAt = new Date().toISOString();
      await this.saveMilestones(milestones);
      console.log('🎤 First voice input used! Milestone tracked.');
    } else if (!milestones.firstVoiceInputAt) {
      milestones.firstVoiceInputAt = new Date().toISOString();
      await this.saveMilestones(milestones);
      console.log(
        '🔄 Synced first voice milestone from server (not first voice)',
      );
    }

    return isFirst;
  }

  /**
   * Get summary of milestone progress for onboarding checklist
   */
  async getMilestoneProgress(): Promise<{
    storiesCompleted: boolean;
    imagesGenerated: boolean;
    streakAchieved: boolean;
    voiceInputUsed: boolean;
    totalCompleted: number;
    totalMilestones: number;
  }> {
    const milestones = await this.getMilestones();

    const storiesCompleted = !!milestones.firstStoryCompletedAt;
    const imagesGenerated = !!milestones.firstImageGeneratedAt;
    const streakAchieved = !!milestones.firstStreakAchievedAt;
    const voiceInputUsed = !!milestones.firstVoiceInputAt;

    const totalCompleted = [
      storiesCompleted,
      imagesGenerated,
      streakAchieved,
      voiceInputUsed,
    ].filter(Boolean).length;

    return {
      storiesCompleted,
      imagesGenerated,
      streakAchieved,
      voiceInputUsed,
      totalCompleted,
      totalMilestones: 4,
    };
  }

  /**
   * Check if the onboarding checklist has been dismissed (US-009)
   */
  async isChecklistDismissed(): Promise<boolean> {
    try {
      const dismissed = await AsyncStorage.getItem(CHECKLIST_DISMISSED_KEY);
      return dismissed === 'true';
    } catch (error) {
      console.error('❌ Error checking checklist dismissed state:', error);
      return false;
    }
  }

  /**
   * Mark the onboarding checklist as dismissed (US-009)
   * User can re-access from Settings/Profile screen
   */
  async dismissChecklist(): Promise<void> {
    try {
      await AsyncStorage.setItem(CHECKLIST_DISMISSED_KEY, 'true');
      console.log('📋 Onboarding checklist dismissed.');
    } catch (error) {
      console.error('❌ Error dismissing checklist:', error);
    }
  }

  /**
   * Reset checklist dismissed state (for re-showing from Settings/Profile)
   */
  async resetChecklistDismissed(): Promise<void> {
    try {
      await AsyncStorage.removeItem(CHECKLIST_DISMISSED_KEY);
      console.log('📋 Onboarding checklist dismissed state reset.');
    } catch (error) {
      console.error('❌ Error resetting checklist dismissed state:', error);
    }
  }

  /**
   * Check if onboarding is fully completed (all milestones done)
   */
  async isOnboardingComplete(): Promise<boolean> {
    const progress = await this.getMilestoneProgress();
    // Account creation + 4 milestones = 5 total
    // Account is always done, so check if all 4 trackable milestones are complete
    return progress.totalCompleted >= progress.totalMilestones;
  }

  /**
   * Check if first story guidance modal has been shown (US-012)
   * Returns true if guidance should NOT be shown (already shown or dismissed)
   */
  async hasFirstStoryGuidanceBeenShown(): Promise<boolean> {
    try {
      const shown = await AsyncStorage.getItem(FIRST_STORY_GUIDANCE_KEY);
      return shown === 'true';
    } catch (error) {
      console.error('❌ Error checking first story guidance state:', error);
      return false;
    }
  }

  /**
   * Check if first story guidance should be shown (US-012)
   * Returns true if user has never seen the guidance modal
   */
  async shouldShowFirstStoryGuidance(): Promise<boolean> {
    const hasBeenShown = await this.hasFirstStoryGuidanceBeenShown();
    return !hasBeenShown;
  }

  /**
   * Mark the first story guidance as shown (US-012)
   * Call this after user sees or dismisses the guidance modal
   */
  async markFirstStoryGuidanceShown(): Promise<void> {
    try {
      await AsyncStorage.setItem(FIRST_STORY_GUIDANCE_KEY, 'true');
      console.log('📚 First story guidance marked as shown.');
    } catch (error) {
      console.error('❌ Error marking first story guidance as shown:', error);
    }
  }

  /**
   * Hydrate local milestones from server data.
   * Called on checklist mount to sync local state with the Convex source of truth.
   * ADDITIVE ONLY: adds milestones the server has that local storage is missing.
   * Never removes local milestones — the server may lag behind local state
   * (e.g., Convex mutation not yet propagated). Cross-user data leakage is
   * prevented by clearing singleton caches on logout (AuthContext).
   */
  async hydrateFromServerProgress(serverProgress: {
    storiesCompleted: boolean;
    imagesGenerated: boolean;
    voiceInputUsed: boolean;
    streakAchieved: boolean;
  }): Promise<boolean> {
    try {
      const milestones = await this.getMilestones();
      let updated = false;

      // Sync first_story: only add from server, never remove local
      if (
        serverProgress.storiesCompleted &&
        !milestones.firstStoryCompletedAt
      ) {
        milestones.firstStoryCompletedAt = new Date().toISOString();
        milestones.celebrationsShown.firstStory = true; // Don't re-show celebration
        updated = true;
      }

      // Sync first_image
      if (serverProgress.imagesGenerated && !milestones.firstImageGeneratedAt) {
        milestones.firstImageGeneratedAt = new Date().toISOString();
        milestones.celebrationsShown.firstImage = true;
        updated = true;
      }

      // Sync first_voice
      if (serverProgress.voiceInputUsed && !milestones.firstVoiceInputAt) {
        milestones.firstVoiceInputAt = new Date().toISOString();
        updated = true;
      }

      // Sync first_streak
      if (serverProgress.streakAchieved && !milestones.firstStreakAchievedAt) {
        milestones.firstStreakAchievedAt = new Date().toISOString();
        milestones.celebrationsShown.firstStreak = true;
        updated = true;
      }

      if (updated) {
        await this.saveMilestones(milestones);
        console.log('🔄 Synced local milestones with server data');
      }

      return updated;
    } catch (error) {
      console.error('❌ Error hydrating milestones from server:', error);
      return false;
    }
  }

  /**
   * Clear all milestones (for testing or account reset)
   */
  async clearMilestones(): Promise<void> {
    this.cachedMilestones = null;
    this.cachedFeatureTooltips = null;
    await AsyncStorage.removeItem(MILESTONES_KEY);
    await AsyncStorage.removeItem(CHECKLIST_DISMISSED_KEY);
    await AsyncStorage.removeItem(FIRST_STORY_GUIDANCE_KEY);
    await AsyncStorage.removeItem(FEATURE_TOOLTIPS_KEY);
    console.log('🧹 Onboarding milestones cleared.');
  }

  /**
   * Clear cache (for logout or memory pressure)
   */
  clearCache(): void {
    this.cachedMilestones = null;
    this.cachedFeatureTooltips = null;
  }

  // ============================================================================
  // Feature Tooltip Tracking (US-013, US-014, US-015)
  // ============================================================================

  /**
   * Get current feature tooltips state from storage
   */
  async getFeatureTooltips(): Promise<FeatureTooltipsShown> {
    try {
      if (this.cachedFeatureTooltips) {
        return this.cachedFeatureTooltips;
      }

      const data = await AsyncStorage.getItem(FEATURE_TOOLTIPS_KEY);
      if (data) {
        this.cachedFeatureTooltips = JSON.parse(data);
        return this.cachedFeatureTooltips!;
      }

      this.cachedFeatureTooltips = { ...DEFAULT_FEATURE_TOOLTIPS };
      return this.cachedFeatureTooltips;
    } catch (error) {
      console.error('❌ Error getting feature tooltips state:', error);
      return { ...DEFAULT_FEATURE_TOOLTIPS };
    }
  }

  /**
   * Save feature tooltips state to storage
   */
  private async saveFeatureTooltips(
    tooltips: FeatureTooltipsShown,
  ): Promise<void> {
    try {
      this.cachedFeatureTooltips = tooltips;
      await AsyncStorage.setItem(
        FEATURE_TOOLTIPS_KEY,
        JSON.stringify(tooltips),
      );
    } catch (error) {
      console.error('❌ Error saving feature tooltips state:', error);
    }
  }

  /**
   * Check if voice input tooltip should be shown (US-013)
   * Returns true if tooltip has NOT been shown yet
   */
  async shouldShowVoiceInputTooltip(): Promise<boolean> {
    const tooltips = await this.getFeatureTooltips();
    return !tooltips.voiceInput;
  }

  /**
   * Mark voice input tooltip as shown (US-013)
   */
  async markVoiceInputTooltipShown(): Promise<void> {
    const tooltips = await this.getFeatureTooltips();
    tooltips.voiceInput = true;
    await this.saveFeatureTooltips(tooltips);
    console.log('💡 Voice input tooltip marked as shown.');
  }

  /**
   * Check if image generation tooltip should be shown (US-014)
   * Returns true if tooltip has NOT been shown yet
   */
  async shouldShowImageGenerationTooltip(): Promise<boolean> {
    const tooltips = await this.getFeatureTooltips();
    return !tooltips.imageGeneration;
  }

  /**
   * Mark image generation tooltip as shown (US-014)
   */
  async markImageGenerationTooltipShown(): Promise<void> {
    const tooltips = await this.getFeatureTooltips();
    tooltips.imageGeneration = true;
    await this.saveFeatureTooltips(tooltips);
    console.log('💡 Image generation tooltip marked as shown.');
  }

  /**
   * Check if XP/Challenges tooltip should be shown (US-015)
   * Returns true if tooltip has NOT been shown yet
   */
  async shouldShowXpChallengesTooltip(): Promise<boolean> {
    const tooltips = await this.getFeatureTooltips();
    return !tooltips.xpChallenges;
  }

  /**
   * Mark XP/Challenges tooltip as shown (US-015)
   */
  async markXpChallengesTooltipShown(): Promise<void> {
    const tooltips = await this.getFeatureTooltips();
    tooltips.xpChallenges = true;
    await this.saveFeatureTooltips(tooltips);
    console.log('💡 XP/Challenges tooltip marked as shown.');
  }
}

// Export singleton instance
export const onboardingMilestoneTracker =
  OnboardingMilestoneTracker.getInstance();

export default OnboardingMilestoneTracker;
