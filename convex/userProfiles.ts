/**
 * Convex User Profile Functions for CreativeBridge
 *
 * Mutations and queries for managing user profiles.
 * Replaces Supabase RPC functions: create_oauth_user_profile, add_user_xp, update_user_streak
 *
 * @see Appendix: Function Migration Reference in PRD
 * @implements US-010: Create User Profile Functions
 */

import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

/**
 * Create a new user profile for OAuth sign-up.
 * Called when a new user signs in via Clerk OAuth.
 *
 * Replaces: create_oauth_user_profile RPC
 */
export const createOAuthProfile = mutation({
  args: {
    clerkUserId: v.string(),
    username: v.string(),
    displayName: v.string(),
  },
  handler: async (ctx, args) => {
    // Implementation in US-010
    throw new Error('Not implemented - see US-010');
  },
});

/**
 * Get a user profile by Clerk user ID.
 */
export const getProfileByClerkId = query({
  args: {
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    // Implementation in US-010
    throw new Error('Not implemented - see US-010');
  },
});

/**
 * Update user profile fields.
 */
export const updateProfile = mutation({
  args: {
    clerkUserId: v.string(),
    updates: v.any(),
  },
  handler: async (ctx, args) => {
    // Implementation in US-010
    throw new Error('Not implemented - see US-010');
  },
});

/**
 * Add XP to a user's profile.
 * Optionally tracks words written.
 *
 * Replaces: add_user_xp RPC
 */
export const addUserXp = mutation({
  args: {
    clerkUserId: v.string(),
    xpToAdd: v.number(),
    wordsAdded: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Implementation in US-010
    throw new Error('Not implemented - see US-010');
  },
});

/**
 * Deduct XP from a user's profile.
 * Used for image generation costs.
 */
export const deductUserXp = mutation({
  args: {
    clerkUserId: v.string(),
    xpToDeduct: v.number(),
  },
  handler: async (ctx, args) => {
    // Implementation in US-010
    throw new Error('Not implemented - see US-010');
  },
});

/**
 * Refund XP to a user's profile.
 * Used when image generation fails.
 */
export const refundUserXp = mutation({
  args: {
    clerkUserId: v.string(),
    xpToRefund: v.number(),
  },
  handler: async (ctx, args) => {
    // Implementation in US-010
    throw new Error('Not implemented - see US-010');
  },
});

/**
 * Update user's daily streak.
 *
 * Replaces: update_user_streak RPC
 */
export const updateStreak = mutation({
  args: {
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    // Implementation in US-010
    throw new Error('Not implemented - see US-010');
  },
});
