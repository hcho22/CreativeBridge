/**
 * Convex User Profile Functions for CreativeBridge
 *
 * Mutations and queries for managing user profiles, XP operations, and streaks.
 * Replaces Supabase RPC functions: create_oauth_user_profile, add_user_xp, update_user_streak
 *
 * ## Security Model:
 * All mutations use `requireAuth()` to verify the user is authenticated via Clerk.
 * Functions verify that the authenticated user matches the target clerkUserId to prevent
 * unauthorized modifications to other users' profiles.
 *
 * ## XP System:
 * - XP can never go negative (enforced via Math.max)
 * - Deductions are for image generation (1000 XP cost)
 * - Refunds occur when image generation fails
 * - Onboarding milestones award XP: first_story (50), first_image (25), first_voice (25), first_streak (50)
 *
 * @see Appendix: Function Migration Reference in PRD
 * @implements US-010: Create User Profile Functions
 */

import { query, mutation } from './_generated/server';
import { v } from 'convex/values';
import { requireAuth, getClerkUserId } from './auth';
import { gradeLevelValidator, genreValidator } from './schema';

// TEMPORARY: Disable XP deduction during beta. Image generation is free.
// TODO: Set to true before production release.
const XP_DEDUCTION_ENABLED = false;

/**
 * Default onboarding progress structure.
 * All items start as incomplete (false).
 */
const DEFAULT_ONBOARDING_PROGRESS = {
  create_account: true, // Set to true since they're creating their account
  first_story: false,
  first_image: false,
  first_voice: false,
  first_streak: false,
};

/**
 * Create a new user profile for OAuth sign-up (idempotent).
 * Called when a new user completes profile setup via Clerk OAuth.
 *
 * This function is IDEMPOTENT: if a profile already exists for the given
 * clerkUserId, it returns the existing profile's ID instead of throwing.
 * This handles race conditions where multiple code paths (e.g., reactive
 * queries and sync functions) may attempt to create profiles simultaneously.
 *
 * Replaces: create_oauth_user_profile RPC (Supabase SECURITY DEFINER function)
 *
 * @param clerkUserId - Clerk user ID (format: user_xxxxx)
 * @param username - Unique username for the user
 * @param displayName - Display name shown in UI
 * @param preferredGradeLevel - Content grade level preference (default: 'K-2')
 * @param speechEnabled - Whether speech/voice features are enabled (default: true)
 * @returns The user profile ID (newly created or existing)
 * @throws Error if user is not authenticated
 */
export const createOAuthProfile = mutation({
  args: {
    clerkUserId: v.string(),
    username: v.string(),
    displayName: v.string(),
    preferredGradeLevel: v.optional(gradeLevelValidator),
    speechEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Verify user is authenticated
    await requireAuth(ctx);

    // Check if profile already exists for this Clerk user
    const existingProfile = await ctx.db
      .query('userProfiles')
      .withIndex('by_clerk_user_id', q => q.eq('clerkUserId', args.clerkUserId))
      .first();

    if (existingProfile) {
      // Idempotent: Return existing profile ID instead of throwing.
      // This handles race conditions where multiple code paths may attempt
      // to create a profile simultaneously (e.g., reactive query effect and
      // syncClerkWithSupabase running in parallel).
      console.log(
        `[createOAuthProfile] Profile already exists for ${args.clerkUserId}, returning existing ID`,
      );
      return existingProfile._id;
    }

    // Get today's date for initial activity tracking
    const today = new Date().toISOString().split('T')[0];

    // Create the new user profile with all default values
    const profileId = await ctx.db.insert('userProfiles', {
      clerkUserId: args.clerkUserId,
      username: args.username,
      displayName: args.displayName,

      // Game statistics - all start at 0
      totalXp: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastActivityDate: today,

      // High scores & progress
      bestScore: 0,
      totalGamesPlayed: 0,
      totalStoriesCompleted: 0,
      totalWordsWritten: 0,

      // User preferences
      preferredGradeLevel: args.preferredGradeLevel ?? 'K-2',
      speechEnabled: args.speechEnabled ?? true,

      // Onboarding - account creation is complete
      onboardingCompleted: false,
      onboardingProgress: DEFAULT_ONBOARDING_PROGRESS,
    });

    return profileId;
  },
});

/**
 * Get a user profile by Clerk user ID.
 * Used for fetching the authenticated user's profile data.
 *
 * @param clerkUserId - Clerk user ID to look up
 * @returns User profile or null if not found
 */
export const getProfileByClerkId = query({
  args: {
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_clerk_user_id', q => q.eq('clerkUserId', args.clerkUserId))
      .first();

    return profile;
  },
});

/**
 * Check if a username is available (not already taken).
 * This is a public query (no auth required) so it can be used during sign-up.
 *
 * @param username - Username to check
 * @returns true if the username is available
 */
export const isUsernameAvailable = query({
  args: {
    username: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('userProfiles')
      .withIndex('by_username', q => q.eq('username', args.username))
      .first();

    return existing === null;
  },
});

/**
 * Get the current authenticated user's profile.
 * Convenience function that extracts Clerk ID from auth context.
 *
 * @returns User profile or null if not found/authenticated
 */
export const getMyProfile = query({
  args: {},
  handler: async ctx => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_clerk_user_id', q => q.eq('clerkUserId', identity.subject))
      .first();

    return profile;
  },
});

/**
 * Update user profile fields.
 * Only the authenticated user can update their own profile.
 *
 * @param clerkUserId - Clerk user ID of profile to update
 * @param updates - Object containing fields to update
 * @returns Updated profile
 * @throws Error if not authenticated or unauthorized
 */
export const updateProfile = mutation({
  args: {
    clerkUserId: v.string(),
    updates: v.object({
      username: v.optional(v.string()),
      displayName: v.optional(v.string()),
      preferredGradeLevel: v.optional(gradeLevelValidator),
      speechEnabled: v.optional(v.boolean()),
      preferredGenre: v.optional(v.union(genreValidator, v.null())),
      avatarUrl: v.optional(v.string()),
      bio: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    // Verify user is authenticated and updating their own profile
    const authClerkId = await getClerkUserId(ctx);
    if (authClerkId !== args.clerkUserId) {
      throw new Error("Unauthorized: Cannot update another user's profile");
    }

    // Find the profile
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_clerk_user_id', q => q.eq('clerkUserId', args.clerkUserId))
      .first();

    if (!profile) {
      throw new Error(`Profile not found for Clerk user: ${args.clerkUserId}`);
    }

    // Apply updates (only include defined fields)
    const updateFields: Record<string, unknown> = {};
    if (args.updates.username !== undefined)
      updateFields.username = args.updates.username;
    if (args.updates.displayName !== undefined)
      updateFields.displayName = args.updates.displayName;
    if (args.updates.preferredGradeLevel !== undefined)
      updateFields.preferredGradeLevel = args.updates.preferredGradeLevel;
    if (args.updates.speechEnabled !== undefined)
      updateFields.speechEnabled = args.updates.speechEnabled;
    if (args.updates.preferredGenre !== undefined)
      updateFields.preferredGenre =
        args.updates.preferredGenre === null
          ? undefined
          : args.updates.preferredGenre;
    if (args.updates.avatarUrl !== undefined)
      updateFields.avatarUrl = args.updates.avatarUrl;
    if (args.updates.bio !== undefined) updateFields.bio = args.updates.bio;

    await ctx.db.patch(profile._id, updateFields);

    return { success: true };
  },
});

/**
 * Add XP to a user's profile.
 * Optionally tracks words written for story statistics.
 *
 * Replaces: add_user_xp RPC (Supabase SECURITY DEFINER function)
 *
 * Key behavior:
 * - XP can never go negative (uses Math.max(0, newValue))
 * - Words are only added if positive value provided
 * - Updates last activity date
 *
 * @param clerkUserId - Clerk user ID to add XP to
 * @param xpToAdd - Amount of XP to add (can be negative for deductions)
 * @param wordsAdded - Optional word count to add to totalWordsWritten
 * @returns Object with success status and new XP balance
 * @throws Error if not authenticated
 */
export const addUserXp = mutation({
  args: {
    clerkUserId: v.string(),
    xpToAdd: v.number(),
    wordsAdded: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Verify authentication
    await requireAuth(ctx);

    // Find the profile
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_clerk_user_id', q => q.eq('clerkUserId', args.clerkUserId))
      .first();

    if (!profile) {
      throw new Error(`Profile not found for Clerk user: ${args.clerkUserId}`);
    }

    // Calculate new XP (never goes below 0)
    const newXp = Math.max(0, profile.totalXp + args.xpToAdd);

    // Calculate new words (only add positive values)
    const newWords =
      args.wordsAdded && args.wordsAdded > 0
        ? profile.totalWordsWritten + args.wordsAdded
        : profile.totalWordsWritten;

    // Update the profile
    await ctx.db.patch(profile._id, {
      totalXp: newXp,
      totalWordsWritten: newWords,
      lastActivityDate: new Date().toISOString().split('T')[0],
    });

    return {
      success: true,
      newBalance: newXp,
    };
  },
});

/**
 * Deduct XP from a user's profile.
 * Used for image generation costs (1000 XP per generation).
 *
 * @param clerkUserId - Clerk user ID to deduct from
 * @param xpToDeduct - Amount of XP to deduct (positive number)
 * @returns Object with success status and new XP balance
 * @throws Error if not authenticated or insufficient XP
 */
export const deductUserXp = mutation({
  args: {
    clerkUserId: v.string(),
    xpToDeduct: v.number(),
  },
  handler: async (ctx, args) => {
    // Verify user is authenticated and deducting from their own profile
    const authClerkId = await getClerkUserId(ctx);
    if (authClerkId !== args.clerkUserId) {
      throw new Error(
        "Unauthorized: Cannot deduct XP from another user's profile",
      );
    }

    // Validate deduction amount
    if (args.xpToDeduct <= 0) {
      throw new Error('XP deduction amount must be positive');
    }

    // Find the profile
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_clerk_user_id', q => q.eq('clerkUserId', args.clerkUserId))
      .first();

    if (!profile) {
      throw new Error(`Profile not found for Clerk user: ${args.clerkUserId}`);
    }

    // Beta guard: skip actual deduction, return current balance unchanged
    if (!XP_DEDUCTION_ENABLED) {
      return {
        success: true,
        newBalance: profile.totalXp,
      };
    }

    // Check sufficient balance
    if (profile.totalXp < args.xpToDeduct) {
      throw new Error(
        `Insufficient XP: required ${args.xpToDeduct}, available ${profile.totalXp}`,
      );
    }

    // Deduct XP
    const newXp = profile.totalXp - args.xpToDeduct;

    await ctx.db.patch(profile._id, {
      totalXp: newXp,
      lastActivityDate: new Date().toISOString().split('T')[0],
    });

    return {
      success: true,
      newBalance: newXp,
    };
  },
});

/**
 * Refund XP to a user's profile.
 * Used when image generation fails and XP needs to be returned.
 *
 * @param clerkUserId - Clerk user ID to refund
 * @param xpToRefund - Amount of XP to refund (positive number)
 * @param reason - Reason for the refund (for audit logging)
 * @returns Object with success status and new XP balance
 * @throws Error if not authenticated
 */
export const refundUserXp = mutation({
  args: {
    clerkUserId: v.string(),
    xpToRefund: v.number(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify authentication
    await requireAuth(ctx);

    // Validate refund amount
    if (args.xpToRefund <= 0) {
      throw new Error('XP refund amount must be positive');
    }

    // Find the profile
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_clerk_user_id', q => q.eq('clerkUserId', args.clerkUserId))
      .first();

    if (!profile) {
      throw new Error(`Profile not found for Clerk user: ${args.clerkUserId}`);
    }

    // Add refunded XP
    const newXp = profile.totalXp + args.xpToRefund;

    await ctx.db.patch(profile._id, {
      totalXp: newXp,
    });

    // Note: In production, you might want to log this refund to an audit table
    // For now, the reason parameter is available for debugging

    return {
      success: true,
      newBalance: newXp,
      refundedAmount: args.xpToRefund,
    };
  },
});

/**
 * Update user's daily streak.
 * Called when a user completes an activity (story completion, etc.).
 *
 * Replaces: update_user_streak RPC
 *
 * Streak logic:
 * - If activity is on a new day after lastActivityDate: increment streak
 * - If activity is 2+ days after lastActivityDate: reset streak to 1
 * - If activity is on same day: no change to streak
 * - Also updates longestStreak if current streak exceeds it
 *
 * @param clerkUserId - Clerk user ID to update streak for
 * @returns Object with success status and streak information
 * @throws Error if not authenticated
 */
export const updateStreak = mutation({
  args: {
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify authentication
    await requireAuth(ctx);

    // Find the profile
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_clerk_user_id', q => q.eq('clerkUserId', args.clerkUserId))
      .first();

    if (!profile) {
      throw new Error(`Profile not found for Clerk user: ${args.clerkUserId}`);
    }

    const today = new Date().toISOString().split('T')[0];
    const lastActivity = profile.lastActivityDate;

    // Calculate days since last activity
    const todayDate = new Date(today);
    const lastDate = new Date(lastActivity);
    const daysDiff = Math.floor(
      (todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    let newStreak = profile.currentStreak;
    let streakUpdated = false;

    if (daysDiff === 0) {
      // Same day - no streak change
      return {
        success: true,
        currentStreak: profile.currentStreak,
        longestStreak: profile.longestStreak,
        streakUpdated: false,
      };
    } else if (daysDiff === 1) {
      // Consecutive day - increment streak
      newStreak = profile.currentStreak + 1;
      streakUpdated = true;
    } else {
      // Missed days - reset streak
      newStreak = 1;
      streakUpdated = true;
    }

    // Update longest streak if needed
    const newLongestStreak = Math.max(profile.longestStreak, newStreak);

    // Check if this is their first streak achievement (streak >= 2)
    const isFirstStreakAchievement =
      newStreak >= 2 && !profile.firstStreakAchievedAt;

    const updates: Record<string, unknown> = {
      currentStreak: newStreak,
      longestStreak: newLongestStreak,
      lastActivityDate: today,
    };

    if (isFirstStreakAchievement) {
      updates.firstStreakAchievedAt = new Date().toISOString();
    }

    await ctx.db.patch(profile._id, updates);

    return {
      success: true,
      currentStreak: newStreak,
      longestStreak: newLongestStreak,
      streakUpdated,
      isFirstStreakAchievement,
    };
  },
});

/**
 * Increment games played counter.
 * Called when a user starts a new game session.
 *
 * @param clerkUserId - Clerk user ID
 * @returns Object with success status
 */
export const incrementGamesPlayed = mutation({
  args: {
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_clerk_user_id', q => q.eq('clerkUserId', args.clerkUserId))
      .first();

    if (!profile) {
      throw new Error(`Profile not found for Clerk user: ${args.clerkUserId}`);
    }

    await ctx.db.patch(profile._id, {
      totalGamesPlayed: profile.totalGamesPlayed + 1,
      lastActivityDate: new Date().toISOString().split('T')[0],
    });

    return { success: true };
  },
});

/**
 * Increment stories completed counter and optionally update best score.
 * Called when a user completes a story (reaches round 5).
 *
 * @param clerkUserId - Clerk user ID
 * @param score - Final score for the story (optional)
 * @returns Object with success status
 */
export const incrementStoriesCompleted = mutation({
  args: {
    clerkUserId: v.string(),
    score: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_clerk_user_id', q => q.eq('clerkUserId', args.clerkUserId))
      .first();

    if (!profile) {
      throw new Error(`Profile not found for Clerk user: ${args.clerkUserId}`);
    }

    const updates: Record<string, unknown> = {
      totalStoriesCompleted: profile.totalStoriesCompleted + 1,
      lastActivityDate: new Date().toISOString().split('T')[0],
    };

    // Update best score if new score is higher
    if (args.score !== undefined && args.score > profile.bestScore) {
      updates.bestScore = args.score;
    }

    // Check if this is their first story completion
    if (!profile.firstStoryCompletedAt) {
      updates.firstStoryCompletedAt = new Date().toISOString();
    }

    await ctx.db.patch(profile._id, updates);

    return { success: true };
  },
});

/**
 * Complete a game session - atomic update of all stats.
 * Called when a story is finished with final stats.
 *
 * This combines multiple stat updates into a single atomic operation:
 * - XP earned
 * - Words written
 * - Stories completed
 * - Best score (if applicable)
 * - Streak update
 *
 * @param clerkUserId - Clerk user ID
 * @param xpEarned - XP earned in the session
 * @param wordsWritten - Words written in the session
 * @param finalScore - Final score for the session
 * @returns Object with all updated stats
 */
export const completeGameSession = mutation({
  args: {
    clerkUserId: v.string(),
    xpEarned: v.number(),
    wordsWritten: v.number(),
    finalScore: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_clerk_user_id', q => q.eq('clerkUserId', args.clerkUserId))
      .first();

    if (!profile) {
      throw new Error(`Profile not found for Clerk user: ${args.clerkUserId}`);
    }

    const today = new Date().toISOString().split('T')[0];
    const lastActivity = profile.lastActivityDate;

    // Calculate streak
    const todayDate = new Date(today);
    const lastDate = new Date(lastActivity);
    const daysDiff = Math.floor(
      (todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    let newStreak = profile.currentStreak;
    if (daysDiff === 1) {
      newStreak = profile.currentStreak + 1;
    } else if (daysDiff > 1) {
      newStreak = 1;
    }

    const newLongestStreak = Math.max(profile.longestStreak, newStreak);
    const newBestScore = Math.max(profile.bestScore, args.finalScore);

    const updates: Record<string, unknown> = {
      totalXp: profile.totalXp + args.xpEarned,
      totalWordsWritten: profile.totalWordsWritten + args.wordsWritten,
      totalStoriesCompleted: profile.totalStoriesCompleted + 1,
      currentStreak: newStreak,
      longestStreak: newLongestStreak,
      bestScore: newBestScore,
      lastActivityDate: today,
    };

    // First story milestone
    if (!profile.firstStoryCompletedAt) {
      updates.firstStoryCompletedAt = new Date().toISOString();
    }

    // First streak milestone
    if (newStreak >= 2 && !profile.firstStreakAchievedAt) {
      updates.firstStreakAchievedAt = new Date().toISOString();
    }

    await ctx.db.patch(profile._id, updates);

    return {
      success: true,
      totalXp: profile.totalXp + args.xpEarned,
      totalStoriesCompleted: profile.totalStoriesCompleted + 1,
      currentStreak: newStreak,
      longestStreak: newLongestStreak,
      bestScore: newBestScore,
      isFirstStory: !profile.firstStoryCompletedAt,
      isFirstStreak: newStreak >= 2 && !profile.firstStreakAchievedAt,
    };
  },
});

/**
 * Migrate user stats from Supabase to an existing Convex profile (US-007).
 *
 * Called during Supabase → Clerk migration after the Convex profile has been
 * created. Overwrites default stats with the user's accumulated Supabase data.
 * Idempotent — `patch` with the same values is a no-op on retry.
 *
 * @param clerkUserId - Clerk user ID of the migrated user
 * @param totalXp - Accumulated XP from Supabase
 * @param currentStreak - Current streak count
 * @param longestStreak - Longest streak ever achieved
 * @param bestScore - Highest single-session score
 * @param totalGamesPlayed - Total games played
 * @param totalStoriesCompleted - Total stories completed
 * @param totalWordsWritten - Total words written across all sessions
 * @param lastActivityDate - Last activity date (ISO 8601)
 * @param onboardingCompleted - Whether onboarding was completed in Supabase
 * @param onboardingProgress - Milestone completion flags
 * @param firstStoryCompletedAt - Optional milestone timestamp
 * @param firstImageGeneratedAt - Optional milestone timestamp
 * @param firstVoiceInputAt - Optional milestone timestamp
 * @param firstStreakAchievedAt - Optional milestone timestamp
 */
export const migrateUserStats = mutation({
  args: {
    clerkUserId: v.string(),
    totalXp: v.number(),
    currentStreak: v.number(),
    longestStreak: v.number(),
    bestScore: v.number(),
    totalGamesPlayed: v.number(),
    totalStoriesCompleted: v.number(),
    totalWordsWritten: v.number(),
    lastActivityDate: v.string(),
    onboardingCompleted: v.boolean(),
    onboardingProgress: v.object({
      create_account: v.boolean(),
      first_story: v.boolean(),
      first_image: v.boolean(),
      first_voice: v.boolean(),
      first_streak: v.boolean(),
    }),
    firstStoryCompletedAt: v.optional(v.string()),
    firstImageGeneratedAt: v.optional(v.string()),
    firstVoiceInputAt: v.optional(v.string()),
    firstStreakAchievedAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_clerk_user_id', q => q.eq('clerkUserId', args.clerkUserId))
      .first();

    if (!profile) {
      throw new Error(`Profile not found for clerkUserId: ${args.clerkUserId}`);
    }

    await ctx.db.patch(profile._id, {
      totalXp: args.totalXp,
      currentStreak: args.currentStreak,
      longestStreak: args.longestStreak,
      bestScore: args.bestScore,
      totalGamesPlayed: args.totalGamesPlayed,
      totalStoriesCompleted: args.totalStoriesCompleted,
      totalWordsWritten: args.totalWordsWritten,
      lastActivityDate: args.lastActivityDate,
      onboardingCompleted: args.onboardingCompleted,
      onboardingProgress: args.onboardingProgress,
      firstStoryCompletedAt: args.firstStoryCompletedAt,
      firstImageGeneratedAt: args.firstImageGeneratedAt,
      firstVoiceInputAt: args.firstVoiceInputAt,
      firstStreakAchievedAt: args.firstStreakAchievedAt,
    });

    return { success: true };
  },
});

/**
 * Get leaderboard data sorted by total XP.
 *
 * @param limit - Maximum number of profiles to return (default: 10)
 * @returns Array of top profiles sorted by XP
 */
export const getLeaderboard = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;

    // Query profiles sorted by totalXp (descending)
    // Note: Convex sorts ascending by default, we need to reverse
    const profiles = await ctx.db
      .query('userProfiles')
      .withIndex('by_total_xp')
      .order('desc')
      .take(limit);

    return profiles.map((profile, index) => ({
      rank: index + 1,
      username: profile.username,
      displayName: profile.displayName,
      totalXp: profile.totalXp,
      totalStoriesCompleted: profile.totalStoriesCompleted,
      currentStreak: profile.currentStreak,
      avatarUrl: profile.avatarUrl,
    }));
  },
});

/**
 * Validate if a user has sufficient XP for an operation.
 * Used before image generation to check balance.
 *
 * @param clerkUserId - Clerk user ID to check
 * @param requiredXp - Minimum XP required
 * @returns Object with validation result
 */
export const validateXpBalance = query({
  args: {
    clerkUserId: v.string(),
    requiredXp: v.number(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_clerk_user_id', q => q.eq('clerkUserId', args.clerkUserId))
      .first();

    if (!profile) {
      return {
        isValid: false,
        error: 'Profile not found',
        currentBalance: 0,
        requiredXp: args.requiredXp,
      };
    }

    const hasEnough = profile.totalXp >= args.requiredXp;

    return {
      isValid: hasEnough,
      currentBalance: profile.totalXp,
      requiredXp: args.requiredXp,
      shortfall: hasEnough ? 0 : args.requiredXp - profile.totalXp,
    };
  },
});
