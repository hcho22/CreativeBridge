/**
 * Convex Game Session Functions for CreativeBridge
 *
 * Mutations and queries for managing story game sessions.
 * Replaces Supabase RPC functions for session management and story queries.
 *
 * ## Key Patterns:
 * - Dual lookup: userId (Convex ID) + clerkUserId (Clerk auth ID)
 * - Story completion triggers at currentRound >= 5
 * - Authorization via requireAuth() - users can only access their own sessions
 *
 * @see Appendix: Function Migration Reference in PRD
 * @implements US-011: Create Game Session Functions
 */

import { query, mutation } from './_generated/server';
import { v } from 'convex/values';
import { requireAuth, getClerkUserId } from './auth';
import { gradeLevelValidator, storySourceValidator } from './schema';

/**
 * Minimum content length for importable stories (characters).
 * Stories must have substantial content to be worth continuing.
 */
const MIN_IMPORTABLE_CONTENT_LENGTH = 50;

/**
 * Maximum content length for story imports (characters).
 * Prevents excessively large imports that could impact performance.
 */
const MAX_STORY_CONTENT_LENGTH = 100000;

/**
 * Default image generation cost in XP.
 */
const DEFAULT_IMAGE_GENERATION_COST = 1000;

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Create a new game session.
 *
 * Called when a user starts a new story. Initializes all tracking fields
 * and links the session to the user's profile.
 *
 * @param clerkUserId - Clerk authentication user ID
 * @param gradeLevel - Content difficulty level (K-2, 3-5, 6-8, 9-12)
 * @returns The new session's Convex ID
 *
 * @example
 * ```typescript
 * const sessionId = await ctx.runMutation(api.gameSessions.createSession, {
 *   clerkUserId: "user_abc123",
 *   gradeLevel: "3-5",
 * });
 * ```
 */
export const createSession = mutation({
  args: {
    clerkUserId: v.string(),
    gradeLevel: gradeLevelValidator,
    storyMetadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Verify authentication
    await requireAuth(ctx);

    // Look up the user's profile to get the Convex userId
    const userProfile = await ctx.db
      .query('userProfiles')
      .withIndex('by_clerk_user_id', q => q.eq('clerkUserId', args.clerkUserId))
      .first();

    if (!userProfile) {
      throw new Error(
        'User profile not found. Please complete account setup first.',
      );
    }

    // US-002: Block session creation for under-13 users without granted consent
    if (
      userProfile.ageGroup === 'under_13' &&
      userProfile.consentStatus !== 'granted'
    ) {
      throw new Error(
        'Parental consent is required before you can create stories. Please ask a parent to check their email.',
      );
    }

    // Create the new session with initialized tracking fields
    const sessionId = await ctx.db.insert('gameSessions', {
      userId: userProfile._id,
      clerkUserId: args.clerkUserId,
      gradeLevel: args.gradeLevel,
      storySource: 'New',
      currentRound: 1,
      finalScore: 0,
      wordsWritten: 0,
      sentencesCompleted: 0,
      challengesCompleted: 0,
      xpEarned: 0,
      storyContent: '',
      storyMetadata: args.storyMetadata ?? {},
    });

    return sessionId;
  },
});

/**
 * Create a session from an imported/continued story.
 *
 * Replaces: create_story_continuation_session RPC
 *
 * Used when a user wants to continue writing from an existing story,
 * whether from a previous session, external file, or other source.
 *
 * @param clerkUserId - Clerk authentication user ID
 * @param gradeLevel - Content difficulty level
 * @param storySource - Where the story originated (CreativeBridge, Story_Quest, File)
 * @param importedContent - The original story content to continue from
 * @param originalCreationDate - When the original story was created (ISO 8601)
 * @param storyMetadata - Additional metadata about the story
 * @returns The new session's Convex ID
 *
 * @throws Error if imported content is too short (<10 chars) or too long (>100KB)
 * @throws Error if storySource is 'New' (use createSession instead)
 */
export const createStoryContinuationSession = mutation({
  args: {
    clerkUserId: v.string(),
    gradeLevel: gradeLevelValidator,
    storySource: storySourceValidator,
    importedContent: v.string(),
    originalCreationDate: v.optional(v.string()),
    storyMetadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    // Validate story source - 'New' should use createSession
    if (args.storySource === 'New') {
      throw new Error(
        "Cannot use 'New' source for story continuation. Use createSession instead.",
      );
    }

    // Validate imported content length
    if (!args.importedContent || args.importedContent.length < 10) {
      throw new Error('Imported story content must be at least 10 characters.');
    }

    if (args.importedContent.length > MAX_STORY_CONTENT_LENGTH) {
      throw new Error(
        `Story content exceeds maximum length of ${MAX_STORY_CONTENT_LENGTH} characters.`,
      );
    }

    // Validate original creation date is not in the future
    if (args.originalCreationDate) {
      const originalDate = new Date(args.originalCreationDate);
      if (originalDate > new Date()) {
        throw new Error('Original creation date cannot be in the future.');
      }
    }

    // Look up user profile
    const userProfile = await ctx.db
      .query('userProfiles')
      .withIndex('by_clerk_user_id', q => q.eq('clerkUserId', args.clerkUserId))
      .first();

    if (!userProfile) {
      throw new Error(
        'User profile not found. Please complete account setup first.',
      );
    }

    // US-002: Block session creation for under-13 users without granted consent
    if (
      userProfile.ageGroup === 'under_13' &&
      userProfile.consentStatus !== 'granted'
    ) {
      throw new Error(
        'Parental consent is required before you can create stories.',
      );
    }

    // Create the continuation session
    const sessionId = await ctx.db.insert('gameSessions', {
      userId: userProfile._id,
      clerkUserId: args.clerkUserId,
      gradeLevel: args.gradeLevel,
      storySource: args.storySource,
      importedStoryContent: args.importedContent,
      originalCreationDate: args.originalCreationDate,
      storyMetadata: args.storyMetadata ?? {},
      currentRound: 1,
      finalScore: 0,
      wordsWritten: 0, // Track only new contributions, not imported content
      sentencesCompleted: 0,
      challengesCompleted: 0,
      xpEarned: 0,
      storyContent: args.importedContent, // Start with imported content
    });

    return sessionId;
  },
});

/**
 * Reset a session's state for re-continuation.
 *
 * Called when a user continues a previously completed story. Clears completion,
 * image, and scoring fields while preserving story content and metadata.
 * This allows the user to play a fresh continuation round.
 *
 * @param sessionId - The Convex ID of the session to reset
 */
export const resetSessionForContinuation = mutation({
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
      throw new Error('Not authorized to reset this session.');
    }

    await ctx.db.patch(args.sessionId, {
      // Reset progress
      currentRound: 1,
      wordsWritten: 0,
      xpEarned: 0,
      finalScore: 0,
      // Clear completion
      completedAt: undefined,
      // Clear image fields
      generatedImageUrl: undefined,
      imageGenerationTimestamp: undefined,
      imageGenerationCost: undefined,
      storageId: undefined,
      imageUploadStatus: undefined,
      imageUploadAttempts: undefined,
      imageUploadError: undefined,
    });
  },
});

/**
 * Update an existing game session.
 *
 * General-purpose update for session fields during gameplay.
 * Authorization check ensures users can only update their own sessions.
 *
 * @param sessionId - The Convex ID of the session to update
 * @param updates - Object containing fields to update
 * @returns The updated session
 */
export const updateSession = mutation({
  args: {
    sessionId: v.id('gameSessions'),
    updates: v.object({
      storyContent: v.optional(v.string()),
      wordsWritten: v.optional(v.number()),
      sentencesCompleted: v.optional(v.number()),
      challengesCompleted: v.optional(v.number()),
      currentRound: v.optional(v.number()),
      storyMetadata: v.optional(v.any()),
      // xpEarned and finalScore removed (R-4.4) — only completeSession may set these
    }),
  },
  handler: async (ctx, args) => {
    const authClerkId = await getClerkUserId(ctx);

    // Fetch the session and verify ownership
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error('Session not found.');
    }

    if (session.clerkUserId !== authClerkId) {
      throw new Error('Not authorized to update this session.');
    }

    // Guard: reject updates to completed sessions (R-4.4)
    if (session.completedAt) {
      throw new Error(
        'Cannot update a completed session. Use completeSession for completion.',
      );
    }

    // Round numeric values to integers before storage
    // Note: xpEarned and finalScore are stripped — only completeSession may set these (R-4.4)
    const updates: Record<string, unknown> = {};
    if (args.updates.storyContent !== undefined) {
      updates.storyContent = args.updates.storyContent;
    }
    if (args.updates.wordsWritten !== undefined) {
      updates.wordsWritten = Math.round(args.updates.wordsWritten);
    }
    if (args.updates.sentencesCompleted !== undefined) {
      updates.sentencesCompleted = Math.round(args.updates.sentencesCompleted);
    }
    if (args.updates.challengesCompleted !== undefined) {
      updates.challengesCompleted = Math.round(
        args.updates.challengesCompleted,
      );
    }
    if (args.updates.currentRound !== undefined) {
      updates.currentRound = Math.min(Math.round(args.updates.currentRound), 5);
    }
    if (args.updates.storyMetadata !== undefined) {
      updates.storyMetadata = args.updates.storyMetadata;
    }

    await ctx.db.patch(args.sessionId, updates);

    return await ctx.db.get(args.sessionId);
  },
});

/**
 * Mark a session as complete with final stats.
 *
 * Called when a story reaches 5 rounds (AI responses). Records final
 * statistics and sets the completion timestamp.
 *
 * Note: This does NOT update user profile stats - that's handled separately
 * by userProfiles.completeGameSession for atomic updates.
 *
 * @param sessionId - The Convex ID of the session to complete
 * @param finalScore - The calculated final score
 * @param wordsWritten - Total words written by user
 * @param sentencesCompleted - Total sentences/contributions
 * @param challengesCompleted - Number of challenges completed
 * @param xpEarned - XP earned from this session
 * @param storyContent - Final story text
 */
export const completeSession = mutation({
  args: {
    sessionId: v.id('gameSessions'),
    finalScore: v.number(),
    wordsWritten: v.number(),
    sentencesCompleted: v.number(),
    challengesCompleted: v.number(),
    xpEarned: v.number(),
    storyContent: v.string(),
  },
  handler: async (ctx, args) => {
    const authClerkId = await getClerkUserId(ctx);

    // Fetch and verify session ownership
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error('Session not found.');
    }

    if (session.clerkUserId !== authClerkId) {
      throw new Error('Not authorized to complete this session.');
    }

    // Check if already completed
    if (session.completedAt) {
      throw new Error('Session is already completed.');
    }

    // Update session with final stats
    await ctx.db.patch(args.sessionId, {
      completedAt: new Date().toISOString(),
      finalScore: Math.round(args.finalScore),
      wordsWritten: Math.round(args.wordsWritten),
      sentencesCompleted: Math.round(args.sentencesCompleted),
      challengesCompleted: Math.round(args.challengesCompleted),
      xpEarned: Math.round(args.xpEarned),
      storyContent: args.storyContent,
      currentRound: 5, // Ensure marked as complete
    });

    return await ctx.db.get(args.sessionId);
  },
});

/**
 * Update a story's generated image URL.
 *
 * Replaces: update_story_generated_image RPC
 *
 * Called after successful image generation to store the image URL
 * and optional Convex storage reference.
 *
 * @param sessionId - The Convex ID of the session
 * @param imageUrl - The generated image URL (from Replicate or storage)
 * @param storageId - Optional Convex storage ID for persisted images
 * @param generationCost - XP cost of generation (default 1000)
 * @returns true on success
 */
export const updateStoryGeneratedImage = mutation({
  args: {
    sessionId: v.id('gameSessions'),
    imageUrl: v.string(),
    storageId: v.optional(v.id('_storage')),
    generationCost: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const authClerkId = await getClerkUserId(ctx);

    // Fetch and verify session ownership
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error('Session not found.');
    }

    if (session.clerkUserId !== authClerkId) {
      throw new Error('Not authorized to update this session.');
    }

    // Update image fields
    await ctx.db.patch(args.sessionId, {
      generatedImageUrl: args.imageUrl,
      imageGenerationTimestamp: new Date().toISOString(),
      imageGenerationCost: args.generationCost ?? DEFAULT_IMAGE_GENERATION_COST,
      ...(args.storageId && {
        storageId: args.storageId,
        imageUploadStatus: 'uploaded' as const,
      }),
    });

    return true;
  },
});

/**
 * Update image upload status for retry tracking.
 *
 * Used by the image storage service to track upload attempts
 * and record failures for retry logic.
 *
 * @param sessionId - The Convex ID of the session
 * @param status - Upload status (pending, uploaded, failed)
 * @param error - Optional error message on failure
 */
export const updateImageUploadStatus = mutation({
  args: {
    sessionId: v.id('gameSessions'),
    status: v.union(
      v.literal('pending'),
      v.literal('uploaded'),
      v.literal('failed'),
    ),
    storageId: v.optional(v.id('_storage')),
    error: v.optional(v.string()),
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
      imageUploadStatus: args.status,
      imageUploadAttempts: currentAttempts + 1,
      ...(args.storageId && { storageId: args.storageId }),
      ...(args.error && { imageUploadError: args.error }),
    });

    return true;
  },
});

/**
 * Validate story content for import.
 *
 * Replaces: validate_story_import RPC
 *
 * Pre-flight validation before creating a continuation session.
 * Returns validation result with specific error messages.
 *
 * @param storySource - Where the story originated
 * @param importedContent - The content to validate
 * @param originalDate - Optional original creation date
 * @returns Validation result object
 */
export const validateStoryImport = mutation({
  args: {
    storySource: storySourceValidator,
    importedContent: v.string(),
    originalDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const errors: string[] = [];

    // Check content length
    if (!args.importedContent || args.importedContent.length < 10) {
      errors.push('Story content must be at least 10 characters.');
    }

    if (
      args.importedContent &&
      args.importedContent.length > MAX_STORY_CONTENT_LENGTH
    ) {
      errors.push(
        `Story content exceeds maximum length of ${MAX_STORY_CONTENT_LENGTH} characters.`,
      );
    }

    // Check source validity
    if (args.storySource === 'New') {
      errors.push("Cannot use 'New' source for imported stories.");
    }

    // Check date validity
    if (args.originalDate) {
      const date = new Date(args.originalDate);
      if (isNaN(date.getTime())) {
        errors.push('Invalid original creation date format.');
      } else if (date > new Date()) {
        errors.push('Original creation date cannot be in the future.');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      wordCount: args.importedContent ? countWords(args.importedContent) : 0,
      characterCount: args.importedContent?.length ?? 0,
    };
  },
});

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get user's active (incomplete) session.
 *
 * Returns the most recent session that hasn't been completed yet.
 * Used to resume in-progress stories.
 *
 * @param clerkUserId - Clerk authentication user ID
 * @returns The active session or null if none exists
 */
export const getActiveSession = query({
  args: {},
  handler: async ctx => {
    const clerkUserId = await getClerkUserId(ctx);

    // Find sessions without completedAt, ordered by creation time (most recent first)
    const sessions = await ctx.db
      .query('gameSessions')
      .withIndex('by_clerk_user', q => q.eq('clerkUserId', clerkUserId))
      .order('desc')
      .collect();

    // Find the first incomplete session
    const activeSession = sessions.find(s => !s.completedAt);

    return activeSession ?? null;
  },
});

/**
 * Get a specific session by ID.
 *
 * @param sessionId - The Convex ID of the session
 * @returns The session or null if not found
 */
export const getSession = query({
  args: {
    sessionId: v.id('gameSessions'),
  },
  handler: async (ctx, args) => {
    const clerkUserId = await getClerkUserId(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      return null;
    }
    if (session.clerkUserId !== clerkUserId) {
      throw new Error('Not authorized to access this session.');
    }
    return session;
  },
});

/**
 * Delete a game session.
 *
 * Replaces: Supabase DELETE from game_sessions
 *
 * Authorization check ensures users can only delete their own sessions.
 *
 * @param sessionId - The Convex ID of the session to delete
 * @returns Success indicator
 */
export const deleteSession = mutation({
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
      throw new Error('Not authorized to delete this session.');
    }

    await ctx.db.delete(args.sessionId);

    return { success: true };
  },
});

/**
 * Get user's session history with pagination.
 *
 * Returns completed and in-progress sessions ordered by creation time.
 * Supports cursor-based pagination for efficient loading.
 *
 * @param clerkUserId - Clerk authentication user ID
 * @param limit - Maximum number of sessions to return (default 20)
 * @param cursor - Pagination cursor from previous query
 * @returns Paginated list of sessions with continuation cursor
 */
export const getUserSessions = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const clerkUserId = await getClerkUserId(ctx);
    const limit = args.limit ?? 20;

    // Query with index for efficiency
    let query = ctx.db
      .query('gameSessions')
      .withIndex('by_clerk_user', q => q.eq('clerkUserId', clerkUserId))
      .order('desc');

    // Apply cursor-based pagination
    // Note: In Convex, we use .paginate() for cursor-based pagination
    // For simplicity, we'll use offset-based here with the cursor as session ID
    const sessions = await query.collect();

    let startIndex = 0;
    if (args.cursor) {
      const cursorIndex = sessions.findIndex(s => s._id === args.cursor);
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1;
      }
    }

    const pageData = sessions.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < sessions.length;
    const nextCursor = hasMore ? pageData[pageData.length - 1]?._id : undefined;

    return {
      sessions: pageData,
      nextCursor,
      hasMore,
      totalCount: sessions.length,
    };
  },
});

/**
 * Search user's stories by content.
 *
 * Replaces: search_user_stories RPC
 *
 * Note: Convex doesn't have PostgreSQL's full-text search with tsvector.
 * This implementation uses case-insensitive substring matching.
 * For production use, consider integrating a search service like Algolia.
 *
 * @param clerkUserId - Clerk authentication user ID
 * @param searchQuery - Text to search for in story content
 * @param limit - Maximum results to return (default 20)
 * @returns Matching stories with excerpts and relevance info
 */
export const searchUserStories = query({
  args: {
    searchQuery: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const clerkUserId = await getClerkUserId(ctx);

    if (!args.searchQuery || args.searchQuery.trim().length === 0) {
      return [];
    }

    const limit = args.limit ?? 20;
    const searchTermLower = args.searchQuery.toLowerCase().trim();
    const searchWords = searchTermLower.split(/\s+/).filter(w => w.length > 0);

    // Fetch all user's completed sessions
    const sessions = await ctx.db
      .query('gameSessions')
      .withIndex('by_clerk_user', q => q.eq('clerkUserId', clerkUserId))
      .collect();

    // Filter and score by search relevance
    const results = sessions
      .filter(s => s.completedAt && s.storyContent) // Only completed stories with content
      .map(session => {
        const contentLower = (session.storyContent ?? '').toLowerCase();

        // Calculate relevance score based on word matches
        let matchCount = 0;
        let exactMatchBonus = 0;

        for (const word of searchWords) {
          const wordMatches = (
            contentLower.match(new RegExp(escapeRegex(word), 'g')) || []
          ).length;
          matchCount += wordMatches;
        }

        // Exact phrase match bonus
        if (contentLower.includes(searchTermLower)) {
          exactMatchBonus = 10;
        }

        const relevanceScore = matchCount + exactMatchBonus;

        // Generate excerpt around first match
        const matchIndex = contentLower.indexOf(
          searchWords[0] || searchTermLower,
        );
        let excerpt = '';
        if (matchIndex !== -1) {
          const start = Math.max(0, matchIndex - 50);
          const end = Math.min(
            (session.storyContent ?? '').length,
            matchIndex + 150,
          );
          excerpt =
            (start > 0 ? '...' : '') +
            (session.storyContent ?? '').substring(start, end) +
            (end < (session.storyContent ?? '').length ? '...' : '');
        } else {
          // Fallback: first 150 chars
          excerpt = (session.storyContent ?? '').substring(0, 150) + '...';
        }

        return {
          sessionId: session._id,
          createdAt: session._creationTime,
          completedAt: session.completedAt,
          storyContent: session.storyContent,
          storyExcerpt: excerpt,
          wordsWritten: session.wordsWritten,
          storySource: session.storySource,
          relevanceScore,
          gradeLevel: session.gradeLevel,
        };
      })
      .filter(r => r.relevanceScore > 0) // Only include matches
      .sort((a, b) => b.relevanceScore - a.relevanceScore) // Sort by relevance
      .slice(0, limit);

    return results;
  },
});

/**
 * Get user's stories that have generated images.
 *
 * Replaces: get_user_stories_with_images RPC
 *
 * Returns stories ordered by image generation timestamp (most recent first).
 * Used for the image gallery/portfolio view.
 *
 * @param clerkUserId - Clerk authentication user ID
 * @param limit - Maximum results to return (default 20)
 * @param offset - Number of results to skip (for pagination)
 * @returns Stories with generated images
 */
export const getUserStoriesWithImages = query({
  args: {
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const clerkUserId = await getClerkUserId(ctx);
    const limit = args.limit ?? 20;
    const offset = args.offset ?? 0;

    // Fetch user's sessions
    const sessions = await ctx.db
      .query('gameSessions')
      .withIndex('by_clerk_user', q => q.eq('clerkUserId', clerkUserId))
      .collect();

    // Filter for sessions with images and sort by generation timestamp
    const storiesWithImages = sessions
      .filter(s => s.generatedImageUrl)
      .sort((a, b) => {
        const aTime = a.imageGenerationTimestamp
          ? new Date(a.imageGenerationTimestamp).getTime()
          : 0;
        const bTime = b.imageGenerationTimestamp
          ? new Date(b.imageGenerationTimestamp).getTime()
          : 0;
        return bTime - aTime; // Most recent first
      })
      .slice(offset, offset + limit);

    return {
      stories: storiesWithImages.map(s => ({
        sessionId: s._id,
        createdAt: s._creationTime,
        completedAt: s.completedAt,
        storyContent: s.storyContent,
        storyExcerpt: (s.storyContent ?? '').substring(0, 150) + '...',
        wordsWritten: s.wordsWritten,
        gradeLevel: s.gradeLevel,
        generatedImageUrl: s.generatedImageUrl,
        imageGenerationTimestamp: s.imageGenerationTimestamp,
        imageGenerationCost: s.imageGenerationCost,
        storageId: s.storageId,
      })),
      totalCount: sessions.filter(s => s.generatedImageUrl).length,
      hasMore:
        offset + limit < sessions.filter(s => s.generatedImageUrl).length,
    };
  },
});

/**
 * Get stories available for continuation/import.
 *
 * Replaces: get_user_importable_stories RPC
 *
 * Returns completed stories with substantial content that can be
 * continued in a new session.
 *
 * @param clerkUserId - Clerk authentication user ID
 * @param limit - Maximum results to return (default 50)
 * @param offset - Number of results to skip (for pagination)
 * @returns Importable stories with metadata
 */
export const getImportableStories = query({
  args: {
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const clerkUserId = await getClerkUserId(ctx);
    const limit = args.limit ?? 50;
    const offset = args.offset ?? 0;

    // Fetch user's sessions
    const sessions = await ctx.db
      .query('gameSessions')
      .withIndex('by_clerk_user', q => q.eq('clerkUserId', clerkUserId))
      .order('desc')
      .collect();

    // Filter for importable stories:
    // - Must be completed
    // - Must have substantial content (>= MIN_IMPORTABLE_CONTENT_LENGTH chars)
    const importableStories = sessions
      .filter(
        s =>
          s.completedAt &&
          s.storyContent &&
          s.storyContent.length >= MIN_IMPORTABLE_CONTENT_LENGTH,
      )
      .slice(offset, offset + limit);

    return {
      stories: importableStories.map(s => ({
        sessionId: s._id,
        createdAt: s._creationTime,
        completedAt: s.completedAt,
        storyContent: s.storyContent,
        storyExcerpt: (s.storyContent ?? '').substring(0, 200) + '...',
        wordsWritten: s.wordsWritten,
        gradeLevel: s.gradeLevel,
        storySource: s.storySource,
        finalScore: s.finalScore,
        generatedImageUrl: s.generatedImageUrl,
      })),
      totalCount: sessions.filter(
        s =>
          s.completedAt &&
          s.storyContent &&
          s.storyContent.length >= MIN_IMPORTABLE_CONTENT_LENGTH,
      ).length,
      hasMore:
        offset + limit <
        sessions.filter(
          s =>
            s.completedAt &&
            s.storyContent &&
            s.storyContent.length >= MIN_IMPORTABLE_CONTENT_LENGTH,
        ).length,
    };
  },
});

/**
 * Get user's story library with filtering and sorting.
 *
 * Comprehensive query for the story library UI with support for
 * multiple filter criteria and sort options.
 *
 * @param clerkUserId - Clerk authentication user ID
 * @param filters - Optional filter criteria
 * @param sortBy - Field to sort by (default: createdAt)
 * @param sortOrder - Sort direction (default: desc)
 * @param limit - Maximum results to return (default 20)
 * @param offset - Number of results to skip
 * @returns Filtered and sorted stories with pagination info
 */
export const getStoryLibrary = query({
  args: {
    filters: v.optional(
      v.object({
        storySource: v.optional(storySourceValidator),
        gradeLevel: v.optional(gradeLevelValidator),
        completedOnly: v.optional(v.boolean()),
        hasImage: v.optional(v.boolean()),
        dateFrom: v.optional(v.string()),
        dateTo: v.optional(v.string()),
        minWords: v.optional(v.number()),
        maxWords: v.optional(v.number()),
      }),
    ),
    sortBy: v.optional(
      v.union(
        v.literal('createdAt'),
        v.literal('completedAt'),
        v.literal('finalScore'),
        v.literal('wordsWritten'),
      ),
    ),
    sortOrder: v.optional(v.union(v.literal('asc'), v.literal('desc'))),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const clerkUserId = await getClerkUserId(ctx);
    const limit = args.limit ?? 20;
    const offset = args.offset ?? 0;
    const sortOrder = args.sortOrder ?? 'desc';

    // Fetch all user sessions
    let sessions = await ctx.db
      .query('gameSessions')
      .withIndex('by_clerk_user', q => q.eq('clerkUserId', clerkUserId))
      .collect();

    // Apply filters
    if (args.filters) {
      const f = args.filters;

      if (f.storySource) {
        sessions = sessions.filter(s => s.storySource === f.storySource);
      }

      if (f.gradeLevel) {
        sessions = sessions.filter(s => s.gradeLevel === f.gradeLevel);
      }

      if (f.completedOnly) {
        sessions = sessions.filter(s => s.completedAt);
      }

      if (f.hasImage) {
        sessions = sessions.filter(s => s.generatedImageUrl);
      }

      if (f.dateFrom) {
        const fromDate = new Date(f.dateFrom).getTime();
        sessions = sessions.filter(s => s._creationTime >= fromDate);
      }

      if (f.dateTo) {
        const toDate = new Date(f.dateTo).getTime();
        sessions = sessions.filter(s => s._creationTime <= toDate);
      }

      if (f.minWords !== undefined) {
        sessions = sessions.filter(s => s.wordsWritten >= (f.minWords ?? 0));
      }

      if (f.maxWords !== undefined) {
        sessions = sessions.filter(
          s => s.wordsWritten <= (f.maxWords ?? Infinity),
        );
      }
    }

    // Sort
    const sortBy = args.sortBy ?? 'createdAt';
    sessions.sort((a, b) => {
      let aVal: number;
      let bVal: number;

      switch (sortBy) {
        case 'completedAt':
          aVal = a.completedAt ? new Date(a.completedAt).getTime() : 0;
          bVal = b.completedAt ? new Date(b.completedAt).getTime() : 0;
          break;
        case 'finalScore':
          aVal = a.finalScore;
          bVal = b.finalScore;
          break;
        case 'wordsWritten':
          aVal = a.wordsWritten;
          bVal = b.wordsWritten;
          break;
        case 'createdAt':
        default:
          aVal = a._creationTime;
          bVal = b._creationTime;
      }

      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    const totalCount = sessions.length;
    const paginatedSessions = sessions.slice(offset, offset + limit);

    return {
      stories: paginatedSessions.map(s => ({
        sessionId: s._id,
        createdAt: s._creationTime,
        completedAt: s.completedAt,
        storyContent: s.storyContent,
        storyExcerpt: s.storyContent
          ? s.storyContent.substring(0, 150) +
            (s.storyContent.length > 150 ? '...' : '')
          : '',
        wordsWritten: s.wordsWritten,
        gradeLevel: s.gradeLevel,
        storySource: s.storySource,
        finalScore: s.finalScore,
        xpEarned: s.xpEarned,
        generatedImageUrl: s.generatedImageUrl,
        currentRound: s.currentRound,
      })),
      totalCount,
      hasMore: offset + limit < totalCount,
    };
  },
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Count words in a text string.
 * Matches the TypeScript implementation in storySessionManager.
 */
function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0).length;
}

/**
 * Escape special regex characters in a string.
 * Used for safe substring search.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
