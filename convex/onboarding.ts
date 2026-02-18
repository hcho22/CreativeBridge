/**
 * Convex Onboarding Functions for CreativeBridge
 *
 * Mutations and queries for tracking user onboarding progress and milestones.
 * Replaces Supabase RPC functions for onboarding management.
 *
 * @see Appendix: Function Migration Reference in PRD
 * @implements US-013: Create Onboarding Functions
 */

import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

/**
 * Update a specific onboarding progress item.
 * Marks an onboarding step as complete.
 *
 * Replaces: update_onboarding_progress_item RPC
 */
export const updateOnboardingProgressItem = mutation({
  args: {
    clerkUserId: v.string(),
    itemKey: v.string(),
    completed: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Implementation in US-013
    // Updates the onboardingProgress object in userProfiles
    throw new Error('Not implemented - see US-013');
  },
});

/**
 * Record an onboarding milestone achievement.
 * Awards XP for completing milestones.
 *
 * Replaces: record_onboarding_milestone RPC
 */
export const recordOnboardingMilestone = mutation({
  args: {
    clerkUserId: v.string(),
    milestoneType: v.string(), // 'first_story' | 'first_image' | 'first_voice' | 'first_streak'
  },
  handler: async (ctx, args) => {
    // Implementation in US-013
    // 1. Check if milestone already achieved
    // 2. Record milestone timestamp
    // 3. Award XP bonus
    // 4. Update onboarding completion status
    throw new Error('Not implemented - see US-013');
  },
});

/**
 * Get the full onboarding status for a user.
 *
 * Replaces: get_onboarding_status RPC
 */
export const getOnboardingStatus = query({
  args: {
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    // Implementation in US-013
    // Returns:
    // - onboardingCompleted: boolean
    // - onboardingProgress: object with all item states
    // - completionPercentage: number (0-100)
    // - milestones: { firstStoryCompletedAt, firstImageGeneratedAt, etc. }
    throw new Error('Not implemented - see US-013');
  },
});
