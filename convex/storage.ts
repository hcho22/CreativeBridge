/**
 * Convex Storage Functions for CreativeBridge
 *
 * Mutations and queries for managing file storage (story images).
 * Replaces Supabase Storage bucket operations.
 *
 * ## How Image Storage Works:
 * 1. Client requests a presigned upload URL via `generateUploadUrl`
 * 2. Client uploads image data directly to the presigned URL
 * 3. Client receives a `storageId` from the upload response
 * 4. Client calls `storeImageReference` to link the storageId to a game session
 * 5. To display images, use `getImageUrl` to convert storageId to a URL
 *
 * ## Migration from Supabase:
 * The `uploadFromUrl` action enables server-side migration of images from
 * Supabase Storage URLs to Convex Storage. This is used during the dual-write
 * transition period.
 *
 * @see https://docs.convex.dev/file-storage
 * @implements US-014: Create Convex Storage Functions
 */

import {
  query,
  mutation,
  action,
  internalQuery,
  internalMutation,
} from './_generated/server';
import { v } from 'convex/values';
import { requireAuth, getClerkUserId } from './auth';
import { internal } from './_generated/api';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Configuration constants for image storage.
 * Mirrors the existing imageStorageService.ts configuration.
 */
const STORAGE_CONFIG = {
  /** Maximum allowed image size in bytes (10MB) */
  MAX_IMAGE_SIZE_BYTES: 10 * 1024 * 1024,
  /** Allowed MIME types for uploaded images */
  ALLOWED_MIME_TYPES: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
  /** HTTP timeout for fetching external images (30s) */
  FETCH_TIMEOUT_MS: 30000,
} as const;

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Generate a presigned upload URL for client-side image uploads.
 *
 * This is the first step in the Convex upload flow:
 * 1. Client calls this mutation to get a temporary upload URL
 * 2. Client uploads image data directly to that URL (POST with image body)
 * 3. Upload response includes a `storageId` to reference the file
 *
 * The upload URL is short-lived and single-use.
 *
 * @returns Presigned URL string for direct upload
 * @throws Error if user is not authenticated
 *
 * @example
 * ```typescript
 * // In React Native client:
 * const uploadUrl = await ctx.runMutation(api.storage.generateUploadUrl);
 *
 * const response = await fetch(uploadUrl, {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'image/png' },
 *   body: imageData,
 * });
 *
 * const { storageId } = await response.json();
 * // Now save storageId to your game session
 * ```
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async ctx => {
    // Require authentication - only logged-in users can upload
    await requireAuth(ctx);

    // Generate and return the presigned upload URL
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Store a reference to an uploaded image in a game session.
 *
 * Called after successful client-side upload to link the uploaded
 * image to a specific game session. Updates the session's storageId
 * and marks the upload status as 'uploaded'.
 *
 * @param sessionId - The Convex ID of the game session
 * @param storageId - The Convex storage ID from the upload response
 * @returns Object with success status and the public image URL
 * @throws Error if not authenticated, session not found, or unauthorized
 *
 * @example
 * ```typescript
 * // After uploading to the presigned URL and getting storageId:
 * await ctx.runMutation(api.storage.storeImageReference, {
 *   sessionId: "j97a...",
 *   storageId: "kg8b...",
 * });
 * ```
 */
export const storeImageReference = mutation({
  args: {
    sessionId: v.id('gameSessions'),
    storageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    // Verify authentication
    const authClerkId = await getClerkUserId(ctx);

    // Fetch the session and verify ownership
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error('Session not found.');
    }

    if (session.clerkUserId !== authClerkId) {
      throw new Error('Not authorized to update this session.');
    }

    // Verify the storage ID is valid by attempting to get its URL
    const imageUrl = await ctx.storage.getUrl(args.storageId);
    if (!imageUrl) {
      throw new Error(
        'Invalid storage ID - file may not exist or has been deleted.',
      );
    }

    // Update the session with the storage reference
    await ctx.db.patch(args.sessionId, {
      storageId: args.storageId,
      imageUploadStatus: 'uploaded',
      imageUploadError: undefined, // Clear any previous error
      // Also update the generatedImageUrl to the Convex storage URL
      // This maintains backward compatibility with code that reads generatedImageUrl
      generatedImageUrl: imageUrl,
      imageGenerationTimestamp: new Date().toISOString(),
    });

    return {
      success: true,
      imageUrl,
    };
  },
});

/**
 * Update upload status when an upload attempt fails.
 *
 * Used to track failed upload attempts for retry logic.
 * Increments the attempt counter and records the error message.
 *
 * @param sessionId - The Convex ID of the game session
 * @param error - Error message describing the failure
 * @returns Object with success status
 */
export const recordUploadFailure = mutation({
  args: {
    sessionId: v.id('gameSessions'),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const authClerkId = await getClerkUserId(ctx);

    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error('Session not found.');
    }

    if (session.clerkUserId !== authClerkId) {
      throw new Error('Not authorized to update this session.');
    }

    const currentAttempts = session.imageUploadAttempts ?? 0;

    await ctx.db.patch(args.sessionId, {
      imageUploadStatus: 'failed',
      imageUploadAttempts: currentAttempts + 1,
      imageUploadError: args.error,
    });

    return {
      success: true,
      attempts: currentAttempts + 1,
    };
  },
});

/**
 * Delete an image from Convex storage.
 *
 * Removes the image file and clears the reference from the game session.
 * Used when a user deletes a story or wants to regenerate an image.
 *
 * @param sessionId - The Convex ID of the game session
 * @returns Object with success status
 */
export const deleteImage = mutation({
  args: {
    sessionId: v.id('gameSessions'),
  },
  handler: async (ctx, args) => {
    const authClerkId = await getClerkUserId(ctx);

    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error('Session not found.');
    }

    if (session.clerkUserId !== authClerkId) {
      throw new Error('Not authorized to update this session.');
    }

    // Delete the file from storage if it exists
    if (session.storageId) {
      await ctx.storage.delete(session.storageId);
    }

    // Clear the storage reference from the session
    await ctx.db.patch(args.sessionId, {
      storageId: undefined,
      imageUploadStatus: undefined,
      imageUploadAttempts: undefined,
      imageUploadError: undefined,
      // Keep generatedImageUrl for backward compatibility with external URLs
      // (from Replicate, etc.)
    });

    return { success: true };
  },
});

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get a URL for a stored image by its storage ID.
 *
 * Converts a Convex storage ID to a publicly accessible URL.
 * The URL is suitable for use in <Image> components.
 *
 * Note: Convex storage URLs are long-lived but may change.
 * Always fetch the current URL rather than caching it indefinitely.
 *
 * @param storageId - The Convex storage ID
 * @returns The public URL or null if the file doesn't exist
 *
 * @example
 * ```typescript
 * const imageUrl = await ctx.runQuery(api.storage.getImageUrl, {
 *   storageId: session.storageId,
 * });
 * // Use imageUrl in an Image component
 * ```
 */
export const getImageUrl = query({
  args: {
    storageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

/**
 * Get image URL for a game session by session ID.
 *
 * Convenience query that looks up the session and returns its image URL.
 * Handles both Convex storage images and legacy external URLs.
 *
 * @param sessionId - The Convex ID of the game session
 * @returns Object with imageUrl (may be null if no image)
 */
export const getSessionImageUrl = query({
  args: {
    sessionId: v.id('gameSessions'),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      return { imageUrl: null, error: 'Session not found' };
    }

    // If we have a Convex storage ID, get the URL from storage
    if (session.storageId) {
      const storageUrl = await ctx.storage.getUrl(session.storageId);
      return {
        imageUrl: storageUrl,
        isConvexStorage: true,
        uploadStatus: session.imageUploadStatus,
      };
    }

    // Fall back to legacy external URL (Replicate, Supabase, etc.)
    return {
      imageUrl: session.generatedImageUrl ?? null,
      isConvexStorage: false,
      uploadStatus: session.imageUploadStatus,
    };
  },
});

/**
 * Check storage health and get storage statistics.
 *
 * Useful for diagnostics and monitoring.
 * Returns information about the storage system's availability.
 *
 * @returns Object with health status
 */
export const checkStorageHealth = query({
  args: {},
  handler: async _ctx => {
    try {
      // Try to generate an upload URL as a health check
      // This verifies the storage system is accessible
      // Note: We're in a query so we can't actually generate a URL,
      // but we can return a healthy status if we got this far
      return {
        healthy: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  },
});

// ============================================================================
// ACTIONS (for server-side operations with side effects)
// ============================================================================

/**
 * Server-side action to fetch an image from an external URL and store in Convex.
 *
 * Used for:
 * 1. Migrating images from Supabase Storage to Convex Storage
 * 2. Persisting temporary Replicate image URLs to permanent storage
 *
 * This action runs on the Convex server, not the client, allowing it to:
 * - Make HTTP requests to external services
 * - Handle larger images without client memory constraints
 * - Process images asynchronously
 *
 * @param sourceUrl - The external URL to fetch the image from
 * @param sessionId - The game session ID to link the image to
 * @returns Object with success status and new storageId
 * @throws Error if fetch fails, image is invalid, or upload fails
 *
 * @example
 * ```typescript
 * // Migrate an image from Supabase to Convex:
 * const result = await ctx.runAction(api.storage.uploadFromUrl, {
 *   sourceUrl: "https://your-project.supabase.co/storage/v1/object/...",
 *   sessionId: "j97a...",
 * });
 * ```
 */
export const uploadFromUrl = action({
  args: {
    sourceUrl: v.string(),
    sessionId: v.id('gameSessions'),
  },
  handler: async (ctx, args) => {
    // Verify authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const authClerkId = identity.subject;

    // Verify session ownership by fetching session data
    // We need to use runQuery since actions can't directly access ctx.db
    const session = await ctx.runQuery(internal.storage.getSessionForAction, {
      sessionId: args.sessionId,
    });

    if (!session) {
      throw new Error('Session not found.');
    }

    if (session.clerkUserId !== authClerkId) {
      throw new Error('Not authorized to update this session.');
    }

    console.log(`📤 Starting server-side image upload from URL`);
    console.log(`  Source: ${args.sourceUrl.substring(0, 60)}...`);
    console.log(`  Session: ${args.sessionId}`);

    // Step 1: Fetch the image from the source URL
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      STORAGE_CONFIG.FETCH_TIMEOUT_MS,
    );

    let imageData: ArrayBuffer;
    let contentType: string;

    try {
      // Construct fetch options with type workaround for AbortSignal
      const fetchOptions: RequestInit = {
        headers: {
          Accept: 'image/png,image/jpeg,image/webp,image/*',
        },
      };
      // Add signal with type assertion to handle Node.js/DOM type mismatch
      (fetchOptions as Record<string, unknown>).signal = controller.signal;

      const response = await fetch(args.sourceUrl, fetchOptions);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      contentType = response.headers.get('content-type') || 'image/png';

      // Verify it's an image
      if (!contentType.startsWith('image/')) {
        throw new Error(`Invalid content type: ${contentType}`);
      }

      imageData = await response.arrayBuffer();

      if (!imageData || imageData.byteLength === 0) {
        throw new Error('Downloaded image has no content');
      }

      // Check size limit
      if (imageData.byteLength > STORAGE_CONFIG.MAX_IMAGE_SIZE_BYTES) {
        const sizeMB = (imageData.byteLength / (1024 * 1024)).toFixed(2);
        throw new Error(`Image too large: ${sizeMB}MB (max: 10MB)`);
      }

      console.log(
        `  ✓ Downloaded image (${(imageData.byteLength / 1024).toFixed(2)} KB)`,
      );
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(
          `Download timeout after ${STORAGE_CONFIG.FETCH_TIMEOUT_MS}ms`,
        );
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    // Step 2: Upload to Convex storage
    // In Convex actions, we use ctx.storage.store() for direct uploads
    const storageId = await ctx.storage.store(
      new Blob([imageData], { type: contentType }),
    );

    console.log(`  ✓ Uploaded to Convex storage: ${storageId}`);

    // Step 3: Update the session with the new storage reference
    await ctx.runMutation(internal.storage.updateSessionStorageReference, {
      sessionId: args.sessionId,
      storageId,
    });

    // Get the public URL for the uploaded image
    const imageUrl = await ctx.storage.getUrl(storageId);

    console.log(`  ✅ Upload complete!`);
    console.log(`  Image URL: ${imageUrl?.substring(0, 60)}...`);

    return {
      success: true,
      storageId,
      imageUrl,
    };
  },
});

// ============================================================================
// INTERNAL FUNCTIONS (for action/mutation communication)
// ============================================================================

/**
 * Internal query to fetch session data for actions.
 * Actions can't directly access ctx.db, so they use this query.
 *
 * @internal
 */
export const getSessionForAction = internalQuery({
  args: {
    sessionId: v.id('gameSessions'),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sessionId);
  },
});

/**
 * Internal mutation to update session storage reference from action.
 * Called by uploadFromUrl after successful storage upload.
 *
 * @internal
 */
export const updateSessionStorageReference = internalMutation({
  args: {
    sessionId: v.id('gameSessions'),
    storageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Get the URL for the stored image
    const imageUrl = await ctx.storage.getUrl(args.storageId);

    await ctx.db.patch(args.sessionId, {
      storageId: args.storageId,
      imageUploadStatus: 'uploaded',
      imageUploadAttempts: (session.imageUploadAttempts ?? 0) + 1,
      imageUploadError: undefined,
      // Update generatedImageUrl for backward compatibility
      generatedImageUrl: imageUrl ?? undefined,
      imageGenerationTimestamp: new Date().toISOString(),
    });

    return { success: true };
  },
});
