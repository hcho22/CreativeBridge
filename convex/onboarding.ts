/**
 * Convex Onboarding Functions for CreativeBridge
 *
 * Mutations and queries for tracking user onboarding progress and milestones.
 * Replaces Supabase RPC functions for onboarding management.
 *
 * ## Onboarding Items (5 total, 20% each):
 * - create_account: Auto-completed on profile creation
 * - first_story: First story completion
 * - first_image: First image generation
 * - first_voice: First voice input usage
 * - first_streak: First 2-day streak achievement
 *
 * ## XP Rewards:
 * - first_story: 50 XP
 * - first_image: 25 XP
 * - first_voice: 25 XP
 * - first_streak: 50 XP
 * - Total possible: 150 XP
 *
 * @see Appendix: Function Migration Reference in PRD
 * @implements US-013: Create Onboarding Functions
 */

import { query, mutation } from './_generated/server';
import { v } from 'convex/values';
import { requireAuth, getClerkUserId } from './auth';

// ============================================================================
// Constants
// ============================================================================

/**
 * XP rewards for each onboarding milestone.
 * Matches the values in src/services/onboardingService.ts
 */
export const ONBOARDING_XP_REWARDS = {
  first_story: 50,
  first_image: 25,
  first_voice: 25,
  first_streak: 50,
} as const;

/**
 * Valid onboarding progress item keys.
 * These match the keys in the onboardingProgress object in userProfiles.
 */
const VALID_ONBOARDING_ITEMS = [
  'create_account',
  'first_story',
  'first_image',
  'first_voice',
  'first_streak',
] as const;

type OnboardingItemKey = (typeof VALID_ONBOARDING_ITEMS)[number];

/**
 * Milestone types that award XP.
 * create_account is not included as it's auto-completed without XP reward.
 */
const MILESTONE_TYPES = [
  'first_story',
  'first_image',
  'first_voice',
  'first_streak',
] as const;

type MilestoneType = (typeof MILESTONE_TYPES)[number];

/**
 * Mapping from milestone type to timestamp field in userProfiles.
 */
const MILESTONE_TIMESTAMP_FIELDS: Record<MilestoneType, string> = {
  first_story: 'firstStoryCompletedAt',
  first_image: 'firstImageGeneratedAt',
  first_voice: 'firstVoiceInputAt',
  first_streak: 'firstStreakAchievedAt',
};

/**
 * Celebration configuration for each milestone.
 * Used by the frontend to display celebration modals.
 */
export const CELEBRATION_CONFIGS = {
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
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate onboarding completion percentage.
 * Each of the 5 items contributes 20% to the total.
 *
 * @param progress - The onboarding progress object
 * @returns Percentage from 0-100
 */
function calculateCompletionPercentage(progress: {
  create_account: boolean;
  first_story: boolean;
  first_image: boolean;
  first_voice: boolean;
  first_streak: boolean;
}): number {
  let completed = 0;
  if (progress.create_account) completed += 20;
  if (progress.first_story) completed += 20;
  if (progress.first_image) completed += 20;
  if (progress.first_voice) completed += 20;
  if (progress.first_streak) completed += 20;
  return completed;
}

/**
 * Check if all onboarding items are completed.
 *
 * @param progress - The onboarding progress object
 * @returns true if all items are complete
 */
function isOnboardingComplete(progress: {
  create_account: boolean;
  first_story: boolean;
  first_image: boolean;
  first_voice: boolean;
  first_streak: boolean;
}): boolean {
  return (
    progress.create_account &&
    progress.first_story &&
    progress.first_image &&
    progress.first_voice &&
    progress.first_streak
  );
}

/**
 * Validate that an item key is a valid onboarding item.
 */
function isValidOnboardingItem(key: string): key is OnboardingItemKey {
  return VALID_ONBOARDING_ITEMS.includes(key as OnboardingItemKey);
}

/**
 * Validate that a milestone type is valid.
 */
function isValidMilestoneType(type: string): type is MilestoneType {
  return MILESTONE_TYPES.includes(type as MilestoneType);
}

// ============================================================================
// Mutations
// ============================================================================

/**
 * Update a specific onboarding progress item.
 * Marks an onboarding step as complete or incomplete.
 *
 * This mutation:
 * 1. Validates the item key is one of the 5 valid keys
 * 2. Updates the specific item in the onboardingProgress object
 * 3. Recalculates onboardingCompleted based on all items
 *
 * Replaces: update_onboarding_progress_item RPC
 *
 * @param clerkUserId - Clerk user ID
 * @param itemKey - One of: 'create_account', 'first_story', 'first_image', 'first_voice', 'first_streak'
 * @param completed - Whether the item is completed
 * @returns Updated onboarding state
 */
export const updateOnboardingProgressItem = mutation({
  args: {
    clerkUserId: v.string(),
    itemKey: v.string(),
    completed: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Require authentication
    await requireAuth(ctx);

    // Validate item key
    if (!isValidOnboardingItem(args.itemKey)) {
      throw new Error(
        `Invalid onboarding item key: ${
          args.itemKey
        }. Valid keys are: ${VALID_ONBOARDING_ITEMS.join(', ')}`,
      );
    }

    // Find user profile
    const userProfile = await ctx.db
      .query('userProfiles')
      .withIndex('by_clerk_user_id', q => q.eq('clerkUserId', args.clerkUserId))
      .first();

    if (!userProfile) {
      throw new Error(
        `User profile not found for Clerk ID: ${args.clerkUserId}`,
      );
    }

    // Update the specific item in onboardingProgress
    const updatedProgress = {
      ...userProfile.onboardingProgress,
      [args.itemKey]: args.completed,
    };

    // Check if all items are now complete
    const allComplete = isOnboardingComplete(updatedProgress);

    // Update the user profile
    await ctx.db.patch(userProfile._id, {
      onboardingProgress: updatedProgress,
      onboardingCompleted: allComplete,
    });

    // Calculate completion percentage
    const completionPercentage = calculateCompletionPercentage(updatedProgress);

    return {
      success: true,
      itemKey: args.itemKey,
      completed: args.completed,
      onboardingProgress: updatedProgress,
      onboardingCompleted: allComplete,
      completionPercentage,
    };
  },
});

/**
 * Record an onboarding milestone achievement.
 * Awards XP for completing milestones and records the timestamp.
 *
 * This mutation is idempotent:
 * - If the milestone was already achieved, returns { alreadyAchieved: true, xpAwarded: 0 }
 * - If this is the first time, awards XP and records timestamp
 *
 * Replaces: record_onboarding_milestone RPC
 *
 * @param clerkUserId - Clerk user ID
 * @param milestoneType - One of: 'first_story', 'first_image', 'first_voice', 'first_streak'
 * @param awardXp - Whether to award XP (default: true). Set to false if XP was awarded elsewhere.
 * @returns Milestone recording result with XP info
 */
export const recordOnboardingMilestone = mutation({
  args: {
    clerkUserId: v.string(),
    milestoneType: v.string(),
    awardXp: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Require authentication
    await requireAuth(ctx);

    const shouldAwardXp = args.awardXp !== false; // Default to true

    // Validate milestone type
    if (!isValidMilestoneType(args.milestoneType)) {
      throw new Error(
        `Invalid milestone type: ${
          args.milestoneType
        }. Valid types are: ${MILESTONE_TYPES.join(', ')}`,
      );
    }

    const milestoneType = args.milestoneType as MilestoneType;

    // Find user profile
    const userProfile = await ctx.db
      .query('userProfiles')
      .withIndex('by_clerk_user_id', q => q.eq('clerkUserId', args.clerkUserId))
      .first();

    if (!userProfile) {
      throw new Error(
        `User profile not found for Clerk ID: ${args.clerkUserId}`,
      );
    }

    // Check if milestone was already achieved
    const timestampField = MILESTONE_TIMESTAMP_FIELDS[milestoneType];
    const existingTimestamp =
      userProfile[timestampField as keyof typeof userProfile];

    if (existingTimestamp) {
      // Milestone already achieved - return early (idempotent)
      return {
        success: true,
        alreadyAchieved: true,
        milestoneType,
        xpAwarded: 0,
        timestamp: existingTimestamp,
        message: `Milestone '${milestoneType}' was already achieved`,
      };
    }

    // Record the milestone
    const timestamp = new Date().toISOString();
    const xpReward = shouldAwardXp ? ONBOARDING_XP_REWARDS[milestoneType] : 0;

    // Update onboarding progress
    const updatedProgress = {
      ...userProfile.onboardingProgress,
      [milestoneType]: true,
    };

    // Check if all items are now complete
    const allComplete = isOnboardingComplete(updatedProgress);

    // Build the update object dynamically based on milestone type
    const updateFields: Record<string, unknown> = {
      onboardingProgress: updatedProgress,
      onboardingCompleted: allComplete,
    };

    // Add the timestamp field
    updateFields[timestampField] = timestamp;

    // Award XP if requested
    if (shouldAwardXp && xpReward > 0) {
      updateFields.totalXp = userProfile.totalXp + xpReward;
    }

    // Update the user profile
    await ctx.db.patch(userProfile._id, updateFields);

    // Calculate completion percentage
    const completionPercentage = calculateCompletionPercentage(updatedProgress);

    // Get celebration config for this milestone
    const celebrationConfig = CELEBRATION_CONFIGS[milestoneType];

    return {
      success: true,
      alreadyAchieved: false,
      milestoneType,
      xpAwarded: xpReward,
      timestamp,
      newTotalXp: userProfile.totalXp + xpReward,
      onboardingProgress: updatedProgress,
      onboardingCompleted: allComplete,
      completionPercentage,
      celebrationConfig,
    };
  },
});

/**
 * Batch record multiple milestones at once.
 * Useful when catching up on milestones that may have been missed.
 *
 * @param clerkUserId - Clerk user ID
 * @param milestones - Array of milestone types to record
 * @param awardXp - Whether to award XP for new milestones
 * @returns Results for each milestone
 */
export const recordMultipleMilestones = mutation({
  args: {
    clerkUserId: v.string(),
    milestones: v.array(v.string()),
    awardXp: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Require authentication
    await requireAuth(ctx);

    const shouldAwardXp = args.awardXp !== false;

    // Find user profile
    const userProfile = await ctx.db
      .query('userProfiles')
      .withIndex('by_clerk_user_id', q => q.eq('clerkUserId', args.clerkUserId))
      .first();

    if (!userProfile) {
      throw new Error(
        `User profile not found for Clerk ID: ${args.clerkUserId}`,
      );
    }

    const results: Array<{
      milestoneType: string;
      success: boolean;
      alreadyAchieved: boolean;
      xpAwarded: number;
      error?: string;
    }> = [];

    let totalXpAwarded = 0;
    const timestamp = new Date().toISOString();
    const updatedProgress = { ...userProfile.onboardingProgress };
    const updateFields: Record<string, unknown> = {};

    for (const milestone of args.milestones) {
      // Validate milestone type
      if (!isValidMilestoneType(milestone)) {
        results.push({
          milestoneType: milestone,
          success: false,
          alreadyAchieved: false,
          xpAwarded: 0,
          error: `Invalid milestone type: ${milestone}`,
        });
        continue;
      }

      const milestoneType = milestone as MilestoneType;
      const timestampField = MILESTONE_TIMESTAMP_FIELDS[milestoneType];
      const existingTimestamp =
        userProfile[timestampField as keyof typeof userProfile];

      if (existingTimestamp) {
        // Already achieved
        results.push({
          milestoneType,
          success: true,
          alreadyAchieved: true,
          xpAwarded: 0,
        });
      } else {
        // New milestone
        const xpReward = shouldAwardXp
          ? ONBOARDING_XP_REWARDS[milestoneType]
          : 0;
        totalXpAwarded += xpReward;

        updatedProgress[milestoneType] = true;
        updateFields[timestampField] = timestamp;

        results.push({
          milestoneType,
          success: true,
          alreadyAchieved: false,
          xpAwarded: xpReward,
        });
      }
    }

    // Apply all updates at once if there were any new milestones
    if (Object.keys(updateFields).length > 0) {
      updateFields.onboardingProgress = updatedProgress;
      updateFields.onboardingCompleted = isOnboardingComplete(updatedProgress);

      if (totalXpAwarded > 0) {
        updateFields.totalXp = userProfile.totalXp + totalXpAwarded;
      }

      await ctx.db.patch(userProfile._id, updateFields);
    }

    return {
      success: true,
      results,
      totalXpAwarded,
      newTotalXp: userProfile.totalXp + totalXpAwarded,
      onboardingCompleted: isOnboardingComplete(updatedProgress),
      completionPercentage: calculateCompletionPercentage(updatedProgress),
    };
  },
});

/**
 * Reset onboarding progress for a user.
 * Useful for testing or if a user wants to restart onboarding.
 *
 * Note: This does NOT refund XP that was already awarded.
 *
 * @param clerkUserId - Clerk user ID
 * @param keepAccountCreated - Whether to keep create_account as true (default: true)
 * @returns Reset confirmation
 */
export const resetOnboardingProgress = mutation({
  args: {
    clerkUserId: v.string(),
    keepAccountCreated: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Require authentication
    await requireAuth(ctx);

    const keepAccountCreated = args.keepAccountCreated !== false;

    // Find user profile
    const userProfile = await ctx.db
      .query('userProfiles')
      .withIndex('by_clerk_user_id', q => q.eq('clerkUserId', args.clerkUserId))
      .first();

    if (!userProfile) {
      throw new Error(
        `User profile not found for Clerk ID: ${args.clerkUserId}`,
      );
    }

    // Reset progress
    const resetProgress = {
      create_account: keepAccountCreated,
      first_story: false,
      first_image: false,
      first_voice: false,
      first_streak: false,
    };

    // Clear milestone timestamps
    await ctx.db.patch(userProfile._id, {
      onboardingProgress: resetProgress,
      onboardingCompleted: false,
      firstStoryCompletedAt: undefined,
      firstImageGeneratedAt: undefined,
      firstVoiceInputAt: undefined,
      firstStreakAchievedAt: undefined,
    });

    return {
      success: true,
      message: 'Onboarding progress reset successfully',
      onboardingProgress: resetProgress,
      completionPercentage: keepAccountCreated ? 20 : 0,
    };
  },
});

// ============================================================================
// Queries
// ============================================================================

/**
 * Get the full onboarding status for a user.
 *
 * Returns:
 * - onboardingCompleted: Whether all items are done
 * - onboardingProgress: Object with all item states
 * - completionPercentage: 0-100 percentage
 * - milestones: Timestamp of each milestone achievement
 * - nextMilestone: Suggested next milestone to complete (if any)
 *
 * Replaces: get_onboarding_status RPC
 *
 * @param clerkUserId - Clerk user ID
 * @returns Full onboarding state
 */
export const getOnboardingStatus = query({
  args: {
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    // Find user profile
    const userProfile = await ctx.db
      .query('userProfiles')
      .withIndex('by_clerk_user_id', q => q.eq('clerkUserId', args.clerkUserId))
      .first();

    if (!userProfile) {
      return null;
    }

    const progress = userProfile.onboardingProgress;
    const completionPercentage = calculateCompletionPercentage(progress);

    // Determine next milestone to suggest
    let nextMilestone: MilestoneType | null = null;
    if (!progress.first_story) {
      nextMilestone = 'first_story';
    } else if (!progress.first_image) {
      nextMilestone = 'first_image';
    } else if (!progress.first_voice) {
      nextMilestone = 'first_voice';
    } else if (!progress.first_streak) {
      nextMilestone = 'first_streak';
    }

    return {
      onboardingCompleted: userProfile.onboardingCompleted,
      onboardingProgress: progress,
      completionPercentage,
      milestones: {
        firstStoryCompletedAt: userProfile.firstStoryCompletedAt ?? null,
        firstImageGeneratedAt: userProfile.firstImageGeneratedAt ?? null,
        firstVoiceInputAt: userProfile.firstVoiceInputAt ?? null,
        firstStreakAchievedAt: userProfile.firstStreakAchievedAt ?? null,
      },
      nextMilestone,
      nextMilestoneXpReward: nextMilestone
        ? ONBOARDING_XP_REWARDS[nextMilestone]
        : null,
      totalPossibleXp: 150,
      xpEarnedFromOnboarding: calculateXpEarned(progress),
    };
  },
});

/**
 * Get my onboarding status (authenticated user).
 * Convenience function that uses the auth context to get the current user's status.
 *
 * @returns Full onboarding state for the authenticated user
 */
export const getMyOnboardingStatus = query({
  args: {},
  handler: async ctx => {
    // Get current user's Clerk ID
    const clerkUserId = await getClerkUserId(ctx);

    // Find user profile
    const userProfile = await ctx.db
      .query('userProfiles')
      .withIndex('by_clerk_user_id', q => q.eq('clerkUserId', clerkUserId))
      .first();

    if (!userProfile) {
      return null;
    }

    const progress = userProfile.onboardingProgress;
    const completionPercentage = calculateCompletionPercentage(progress);

    // Determine next milestone to suggest
    let nextMilestone: MilestoneType | null = null;
    if (!progress.first_story) {
      nextMilestone = 'first_story';
    } else if (!progress.first_image) {
      nextMilestone = 'first_image';
    } else if (!progress.first_voice) {
      nextMilestone = 'first_voice';
    } else if (!progress.first_streak) {
      nextMilestone = 'first_streak';
    }

    return {
      onboardingCompleted: userProfile.onboardingCompleted,
      onboardingProgress: progress,
      completionPercentage,
      milestones: {
        firstStoryCompletedAt: userProfile.firstStoryCompletedAt ?? null,
        firstImageGeneratedAt: userProfile.firstImageGeneratedAt ?? null,
        firstVoiceInputAt: userProfile.firstVoiceInputAt ?? null,
        firstStreakAchievedAt: userProfile.firstStreakAchievedAt ?? null,
      },
      nextMilestone,
      nextMilestoneXpReward: nextMilestone
        ? ONBOARDING_XP_REWARDS[nextMilestone]
        : null,
      totalPossibleXp: 150,
      xpEarnedFromOnboarding: calculateXpEarned(progress),
    };
  },
});

/**
 * Check if a specific milestone has been achieved.
 *
 * @param clerkUserId - Clerk user ID
 * @param milestoneType - The milestone to check
 * @returns Whether the milestone is achieved and when
 */
export const checkMilestoneAchieved = query({
  args: {
    clerkUserId: v.string(),
    milestoneType: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate milestone type
    if (!isValidMilestoneType(args.milestoneType)) {
      throw new Error(
        `Invalid milestone type: ${
          args.milestoneType
        }. Valid types are: ${MILESTONE_TYPES.join(', ')}`,
      );
    }

    const milestoneType = args.milestoneType as MilestoneType;

    // Find user profile
    const userProfile = await ctx.db
      .query('userProfiles')
      .withIndex('by_clerk_user_id', q => q.eq('clerkUserId', args.clerkUserId))
      .first();

    if (!userProfile) {
      return {
        exists: false,
        achieved: false,
        timestamp: null,
      };
    }

    const timestampField = MILESTONE_TIMESTAMP_FIELDS[milestoneType];
    const timestamp = userProfile[timestampField as keyof typeof userProfile];

    return {
      exists: true,
      achieved: !!timestamp,
      timestamp: timestamp ?? null,
      xpReward: ONBOARDING_XP_REWARDS[milestoneType],
    };
  },
});

/**
 * Get onboarding analytics (admin/debugging).
 * Returns aggregated statistics about onboarding completion across all users.
 *
 * @returns Onboarding analytics
 */
export const getOnboardingAnalytics = query({
  args: {},
  handler: async ctx => {
    // Fetch all user profiles
    const profiles = await ctx.db.query('userProfiles').collect();

    let totalUsers = 0;
    let completedOnboarding = 0;
    let totalXpAwarded = 0;

    const milestoneCompletions = {
      create_account: 0,
      first_story: 0,
      first_image: 0,
      first_voice: 0,
      first_streak: 0,
    };

    const completionPercentages: number[] = [];

    for (const profile of profiles) {
      totalUsers++;

      if (profile.onboardingCompleted) {
        completedOnboarding++;
      }

      const progress = profile.onboardingProgress;
      if (progress.create_account) milestoneCompletions.create_account++;
      if (progress.first_story) {
        milestoneCompletions.first_story++;
        totalXpAwarded += ONBOARDING_XP_REWARDS.first_story;
      }
      if (progress.first_image) {
        milestoneCompletions.first_image++;
        totalXpAwarded += ONBOARDING_XP_REWARDS.first_image;
      }
      if (progress.first_voice) {
        milestoneCompletions.first_voice++;
        totalXpAwarded += ONBOARDING_XP_REWARDS.first_voice;
      }
      if (progress.first_streak) {
        milestoneCompletions.first_streak++;
        totalXpAwarded += ONBOARDING_XP_REWARDS.first_streak;
      }

      completionPercentages.push(calculateCompletionPercentage(progress));
    }

    // Calculate average completion percentage
    const avgCompletionPercentage =
      totalUsers > 0
        ? Math.round(
            completionPercentages.reduce((a, b) => a + b, 0) / totalUsers,
          )
        : 0;

    // Calculate completion rates for each milestone
    const milestoneRates = {
      create_account:
        totalUsers > 0
          ? Math.round((milestoneCompletions.create_account / totalUsers) * 100)
          : 0,
      first_story:
        totalUsers > 0
          ? Math.round((milestoneCompletions.first_story / totalUsers) * 100)
          : 0,
      first_image:
        totalUsers > 0
          ? Math.round((milestoneCompletions.first_image / totalUsers) * 100)
          : 0,
      first_voice:
        totalUsers > 0
          ? Math.round((milestoneCompletions.first_voice / totalUsers) * 100)
          : 0,
      first_streak:
        totalUsers > 0
          ? Math.round((milestoneCompletions.first_streak / totalUsers) * 100)
          : 0,
    };

    return {
      totalUsers,
      completedOnboarding,
      completionRate:
        totalUsers > 0
          ? Math.round((completedOnboarding / totalUsers) * 100)
          : 0,
      avgCompletionPercentage,
      totalXpAwarded,
      milestoneCompletions,
      milestoneRates,
    };
  },
});

// ============================================================================
// Helper for XP calculation
// ============================================================================

/**
 * Calculate total XP earned from onboarding milestones.
 */
function calculateXpEarned(progress: {
  create_account: boolean;
  first_story: boolean;
  first_image: boolean;
  first_voice: boolean;
  first_streak: boolean;
}): number {
  let xp = 0;
  if (progress.first_story) xp += ONBOARDING_XP_REWARDS.first_story;
  if (progress.first_image) xp += ONBOARDING_XP_REWARDS.first_image;
  if (progress.first_voice) xp += ONBOARDING_XP_REWARDS.first_voice;
  if (progress.first_streak) xp += ONBOARDING_XP_REWARDS.first_streak;
  return xp;
}
