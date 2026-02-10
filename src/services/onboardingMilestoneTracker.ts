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

const DEFAULT_MILESTONES: OnboardingMilestones = {
  celebrationsShown: {
    firstStory: false,
    firstImage: false,
    firstStreak: false,
  },
};

class OnboardingMilestoneTracker {
  private static instance: OnboardingMilestoneTracker;
  private cachedMilestones: OnboardingMilestones | null = null;

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
   * Mark first story as completed and check if celebration should show
   * Returns true if this is the first story and celebration should display
   */
  async markFirstStoryCompleted(): Promise<{
    isFirstStory: boolean;
    shouldShowCelebration: boolean;
  }> {
    const milestones = await this.getMilestones();

    // Check if this is actually the first story
    const isFirstStory = !milestones.firstStoryCompletedAt;

    if (isFirstStory) {
      // Mark as completed with timestamp
      milestones.firstStoryCompletedAt = new Date().toISOString();
      await this.saveMilestones(milestones);

      console.log('🎉 First story completed! Milestone tracked.');
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
   * Mark first image as generated
   */
  async markFirstImageGenerated(): Promise<{
    isFirstImage: boolean;
    shouldShowCelebration: boolean;
  }> {
    const milestones = await this.getMilestones();
    const isFirstImage = !milestones.firstImageGeneratedAt;

    if (isFirstImage) {
      milestones.firstImageGeneratedAt = new Date().toISOString();
      await this.saveMilestones(milestones);
      console.log('🎨 First image generated! Milestone tracked.');
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
   * Mark first streak as achieved
   */
  async markFirstStreakAchieved(): Promise<{
    isFirstStreak: boolean;
    shouldShowCelebration: boolean;
  }> {
    const milestones = await this.getMilestones();
    const isFirstStreak = !milestones.firstStreakAchievedAt;

    if (isFirstStreak) {
      milestones.firstStreakAchievedAt = new Date().toISOString();
      await this.saveMilestones(milestones);
      console.log('🔥 First streak achieved! Milestone tracked.');
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
   * Mark first voice input as used
   */
  async markFirstVoiceInputUsed(): Promise<boolean> {
    const milestones = await this.getMilestones();
    const isFirst = !milestones.firstVoiceInputAt;

    if (isFirst) {
      milestones.firstVoiceInputAt = new Date().toISOString();
      await this.saveMilestones(milestones);
      console.log('🎤 First voice input used! Milestone tracked.');
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
   * Clear all milestones (for testing or account reset)
   */
  async clearMilestones(): Promise<void> {
    this.cachedMilestones = null;
    await AsyncStorage.removeItem(MILESTONES_KEY);
    await AsyncStorage.removeItem(CHECKLIST_DISMISSED_KEY);
    console.log('🧹 Onboarding milestones cleared.');
  }

  /**
   * Clear cache (for logout or memory pressure)
   */
  clearCache(): void {
    this.cachedMilestones = null;
  }
}

// Export singleton instance
export const onboardingMilestoneTracker =
  OnboardingMilestoneTracker.getInstance();

export default OnboardingMilestoneTracker;
