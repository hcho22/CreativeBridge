/**
 * Convex Storage Functions for CreativeBridge
 *
 * Mutations and queries for managing file storage (story images).
 * Replaces Supabase Storage bucket operations.
 *
 * @see https://docs.convex.dev/file-storage
 * @implements US-014: Create Convex Storage Functions
 */

import { query, mutation, action } from './_generated/server';
import { v } from 'convex/values';

/**
 * Generate a presigned upload URL for client-side uploads.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async ctx => {
    // Implementation in US-014
    // return await ctx.storage.generateUploadUrl();
    throw new Error('Not implemented - see US-014');
  },
});

/**
 * Store a reference to an uploaded image in a game session.
 */
export const storeImageReference = mutation({
  args: {
    sessionId: v.id('gameSessions'),
    storageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    // Implementation in US-014
    // Updates the gameSessions record with storageId
    throw new Error('Not implemented - see US-014');
  },
});

/**
 * Get a URL for a stored image by its storage ID.
 */
export const getImageUrl = query({
  args: {
    storageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    // Implementation in US-014
    // return await ctx.storage.getUrl(args.storageId);
    throw new Error('Not implemented - see US-014');
  },
});

/**
 * Server-side action to fetch an image from external URL and store in Convex.
 * Used for migrating images from Supabase Storage.
 */
export const uploadFromUrl = action({
  args: {
    sourceUrl: v.string(),
    sessionId: v.id('gameSessions'),
  },
  handler: async (ctx, args) => {
    // Implementation in US-014
    // 1. Fetch image from sourceUrl
    // 2. Upload to Convex storage
    // 3. Update session with storageId
    throw new Error('Not implemented - see US-014');
  },
});
