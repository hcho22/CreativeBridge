/**
 * Convex Image Generation Event Functions for CreativeBridge
 *
 * Mutations and queries for tracking image generation attempts and analytics.
 * Replaces Supabase RPC functions for image generation event management.
 *
 * ## Key Features:
 * - Atomic XP deduction on event creation
 * - Automatic XP refund on specific failure types
 * - Comprehensive analytics with success rates and response times
 * - Full audit trail for debugging and monitoring
 *
 * ## Event Lifecycle:
 * 1. Create event (status: 'pending', XP deducted)
 * 2. Update event on completion (status: 'success'/'failed'/'timeout')
 * 3. Refund XP if status is 'failed' or 'timeout' (status becomes 'refunded')
 *
 * @see Appendix: Function Migration Reference in PRD
 * @implements US-012: Create Image Generation Event Functions
 */

import { query, mutation } from './_generated/server';
import { v } from 'convex/values';
import { requireAuth, getClerkUserId, requireAdmin } from './auth';
import {
  generationStatusValidator,
  errorTypeValidator,
  serviceUsedValidator,
} from './schema';

/**
 * Default XP cost for image generation.
 * Matches the constant in the legacy imageGeneration.ts service.
 */
const IMAGE_GENERATION_COST = 1000;

// TEMPORARY: Disable XP deduction during beta. Users still need >= 1000 XP (threshold check stays).
// TODO: Set to true before production release.
const XP_DEDUCTION_ENABLED = false;

/**
 * Error types that qualify for XP refunds.
 * Content safety, API failures, and timeouts all warrant refunds
 * since the user didn't receive a usable image.
 */
const REFUNDABLE_ERROR_TYPES = ['api_failure', 'content_safety', 'timeout'];

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Create a new image generation event (pending status).
 * Atomically deducts XP cost from user profile.
 *
 * This mutation implements the "deduct upfront, refund on failure" pattern:
 * - XP is deducted immediately to prevent race conditions
 * - If generation fails, XP is refunded via updateImageGenerationEvent
 *
 * Replaces: create_image_generation_event RPC
 *
 * @param clerkUserId - Clerk authentication ID
 * @param sessionId - Optional game session reference
 * @param xpCost - XP to deduct (default: 1000)
 * @param serviceUsed - Which AI service will process this request
 * @param storyGradeLevel - Grade level for analytics (K-2, 3-5, 6-8, 9-12)
 * @param storyWordCount - Word count at generation time
 * @param promptUsed - The exact prompt sent to AI service
 * @param metadata - Additional tracking data
 * @returns Event ID for subsequent updates
 * @throws Error if user has insufficient XP
 */
export const createImageGenerationEvent = mutation({
  args: {
    clerkUserId: v.string(),
    sessionId: v.optional(v.id('gameSessions')),
    xpCost: v.optional(v.number()),
    serviceUsed: serviceUsedValidator,
    storyGradeLevel: v.optional(v.string()),
    storyWordCount: v.optional(v.number()),
    promptUsed: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Verify authentication
    await requireAuth(ctx);

    const xpCost = args.xpCost ?? IMAGE_GENERATION_COST;

    // Find user profile
    const userProfile = await ctx.db
      .query('userProfiles')
      .withIndex('by_clerk_user_id', q => q.eq('clerkUserId', args.clerkUserId))
      .first();

    if (!userProfile) {
      throw new Error('User profile not found');
    }

    // Check XP balance before deduction
    if (userProfile.totalXp < xpCost) {
      throw new Error(
        `Insufficient XP. Need ${xpCost} XP, have ${userProfile.totalXp} XP`,
      );
    }

    // Deduct XP atomically (bypassed during beta)
    if (XP_DEDUCTION_ENABLED) {
      await ctx.db.patch(userProfile._id, {
        totalXp: userProfile.totalXp - xpCost,
      });
    }

    // Create event with pending status
    const eventId = await ctx.db.insert('imageGenerationEvents', {
      userId: userProfile._id,
      clerkUserId: args.clerkUserId,
      sessionId: args.sessionId,
      xpCost: Math.round(xpCost),
      generationStatus: 'pending',
      serviceUsed: args.serviceUsed,
      storyGradeLevel: args.storyGradeLevel,
      storyWordCount: args.storyWordCount
        ? Math.round(args.storyWordCount)
        : undefined,
      promptUsed: args.promptUsed,
      metadata: args.metadata ?? {},
    });

    return { eventId, xpDeducted: xpCost };
  },
});

/**
 * Update an image generation event with completion status.
 * Handles XP refunds for failed/timeout generations.
 *
 * The refund logic follows these rules:
 * - 'success': No refund, image was delivered
 * - 'failed' with error_type in REFUNDABLE_ERROR_TYPES: Refund XP
 * - 'timeout': Refund XP (both services timed out)
 * - 'refunded': Already refunded, no action needed
 *
 * Replaces: update_image_generation_event RPC
 *
 * @param eventId - ID of the event to update
 * @param generationStatus - New status
 * @param imageUrl - Generated image URL (if successful)
 * @param errorType - Error category (if failed)
 * @param apiResponseTime - Response time in milliseconds
 * @param promptUsed - The prompt that was used (if not set at creation)
 * @param metadata - Additional tracking data to merge
 */
export const updateImageGenerationEvent = mutation({
  args: {
    eventId: v.id('imageGenerationEvents'),
    generationStatus: generationStatusValidator,
    imageUrl: v.optional(v.string()),
    errorType: v.optional(errorTypeValidator),
    apiResponseTime: v.optional(v.number()),
    promptUsed: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Verify authentication
    const clerkUserId = await getClerkUserId(ctx);

    // Get the event
    const event = await ctx.db.get(args.eventId);
    if (!event) {
      throw new Error('Image generation event not found');
    }

    // Verify ownership
    if (event.clerkUserId !== clerkUserId) {
      throw new Error('Not authorized to update this event');
    }

    // Check if already in terminal state
    if (event.generationStatus === 'refunded') {
      throw new Error('Event already refunded, cannot update');
    }

    // Determine if refund is needed
    let shouldRefund = false;
    let finalStatus = args.generationStatus;

    if (
      args.generationStatus === 'failed' ||
      args.generationStatus === 'timeout'
    ) {
      // Check if error type qualifies for refund
      const errorType = args.errorType;
      if (errorType && REFUNDABLE_ERROR_TYPES.includes(errorType)) {
        shouldRefund = true;
        finalStatus = 'refunded';
      } else if (args.generationStatus === 'timeout') {
        // Timeouts always get refunds
        shouldRefund = true;
        finalStatus = 'refunded';
      }
    }

    // Process refund if needed (bypassed during beta since nothing was deducted)
    if (shouldRefund && XP_DEDUCTION_ENABLED) {
      const userProfile = await ctx.db.get(event.userId);
      if (userProfile) {
        await ctx.db.patch(userProfile._id, {
          totalXp: userProfile.totalXp + event.xpCost,
        });
      }
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      generationStatus: finalStatus,
      completedAt: new Date().toISOString(),
    };

    if (args.imageUrl !== undefined) {
      updateData.imageUrl = args.imageUrl;
    }

    if (args.errorType !== undefined) {
      updateData.errorType = args.errorType;
    }

    if (args.apiResponseTime !== undefined) {
      // Validate response time is reasonable (0-300000ms = 5 minutes max)
      const responseTime = Math.min(
        Math.max(0, Math.round(args.apiResponseTime)),
        300000,
      );
      updateData.apiResponseTime = responseTime;
    }

    if (args.promptUsed !== undefined) {
      updateData.promptUsed = args.promptUsed;
    }

    if (args.metadata !== undefined) {
      // Merge metadata with existing
      updateData.metadata = {
        ...((event.metadata as Record<string, unknown>) || {}),
        ...args.metadata,
      };
    }

    // Update the event
    await ctx.db.patch(args.eventId, updateData);

    return {
      eventId: args.eventId,
      finalStatus,
      refunded: shouldRefund,
      refundAmount: shouldRefund ? event.xpCost : 0,
    };
  },
});

/**
 * Manually refund XP for a failed image generation event.
 * Use this for edge cases where automatic refund didn't trigger.
 *
 * Only works on events in 'failed' or 'timeout' status that haven't
 * already been refunded.
 *
 * @param eventId - ID of the event to refund
 * @returns Refund details
 */
export const refundImageGenerationEvent = mutation({
  args: {
    eventId: v.id('imageGenerationEvents'),
  },
  handler: async (ctx, args) => {
    // Verify authentication
    const clerkUserId = await getClerkUserId(ctx);

    // Get the event
    const event = await ctx.db.get(args.eventId);
    if (!event) {
      throw new Error('Image generation event not found');
    }

    // Verify ownership
    if (event.clerkUserId !== clerkUserId) {
      throw new Error('Not authorized to refund this event');
    }

    // Check status - only failed/timeout events can be refunded
    if (event.generationStatus === 'success') {
      throw new Error('Cannot refund successful generation');
    }

    if (event.generationStatus === 'refunded') {
      throw new Error('Event already refunded');
    }

    if (event.generationStatus === 'pending') {
      throw new Error('Cannot refund pending event - wait for completion');
    }

    // Process refund (bypassed during beta since nothing was deducted)
    const userProfile = await ctx.db.get(event.userId);
    if (!userProfile) {
      throw new Error('User profile not found');
    }

    if (XP_DEDUCTION_ENABLED) {
      await ctx.db.patch(userProfile._id, {
        totalXp: userProfile.totalXp + event.xpCost,
      });
    }

    // Update event status
    await ctx.db.patch(args.eventId, {
      generationStatus: 'refunded',
      metadata: {
        ...((event.metadata as Record<string, unknown>) || {}),
        manualRefund: true,
        refundedAt: new Date().toISOString(),
      },
    });

    return {
      eventId: args.eventId,
      refundAmount: event.xpCost,
      newBalance: userProfile.totalXp + event.xpCost,
    };
  },
});

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get user's image generation event history.
 * Returns events sorted by creation time (newest first).
 *
 * Replaces: get_user_image_generation_events RPC
 *
 * @param clerkUserId - Clerk authentication ID
 * @param limit - Maximum events to return (default: 50)
 * @param offset - Number of events to skip for pagination
 * @param statusFilter - Optional filter by status
 * @returns Array of image generation events
 */
export const getUserImageGenerationEvents = query({
  args: {
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
    statusFilter: v.optional(generationStatusValidator),
  },
  handler: async (ctx, args) => {
    const clerkUserId = await getClerkUserId(ctx);
    const limit = Math.min(args.limit ?? 50, 100);
    const offset = args.offset ?? 0;

    // Get events for user using correct index (R-4.5)
    let events = await ctx.db
      .query('imageGenerationEvents')
      .withIndex('by_clerk_user', q => q.eq('clerkUserId', clerkUserId))
      .order('desc')
      .collect();

    // Apply status filter if provided
    if (args.statusFilter) {
      events = events.filter(e => e.generationStatus === args.statusFilter);
    }

    // Apply pagination
    const paginatedEvents = events.slice(offset, offset + limit);

    // Format response with computed fields
    return paginatedEvents.map(event => ({
      id: event._id,
      createdAt: new Date(event._creationTime).toISOString(),
      completedAt: event.completedAt,
      sessionId: event.sessionId,
      xpCost: event.xpCost,
      generationStatus: event.generationStatus,
      errorType: event.errorType,
      serviceUsed: event.serviceUsed,
      apiResponseTime: event.apiResponseTime,
      imageUrl: event.imageUrl,
      storyGradeLevel: event.storyGradeLevel,
      storyWordCount: event.storyWordCount,
      promptUsed: event.promptUsed,
    }));
  },
});

/**
 * Get a single image generation event by ID.
 *
 * @param eventId - ID of the event
 * @returns Event details or null
 */
export const getImageGenerationEvent = query({
  args: {
    eventId: v.id('imageGenerationEvents'),
  },
  handler: async (ctx, args) => {
    const clerkUserId = await getClerkUserId(ctx);
    const event = await ctx.db.get(args.eventId);
    if (!event) {
      return null;
    }
    if (event.clerkUserId !== clerkUserId) {
      throw new Error('Not authorized to access this event.');
    }

    return {
      id: event._id,
      createdAt: new Date(event._creationTime).toISOString(),
      completedAt: event.completedAt,
      sessionId: event.sessionId,
      xpCost: event.xpCost,
      generationStatus: event.generationStatus,
      errorType: event.errorType,
      serviceUsed: event.serviceUsed,
      apiResponseTime: event.apiResponseTime,
      imageUrl: event.imageUrl,
      storyGradeLevel: event.storyGradeLevel,
      storyWordCount: event.storyWordCount,
      promptUsed: event.promptUsed,
      metadata: event.metadata,
    };
  },
});

/**
 * Get events for a specific game session.
 * Useful for tracking all image generation attempts within a story.
 *
 * @param sessionId - Game session ID
 * @returns Array of events for that session
 */
export const getSessionImageGenerationEvents = query({
  args: {
    sessionId: v.id('gameSessions'),
  },
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query('imageGenerationEvents')
      .withIndex('by_session', q => q.eq('sessionId', args.sessionId))
      .order('desc')
      .collect();

    return events.map(event => ({
      id: event._id,
      createdAt: new Date(event._creationTime).toISOString(),
      completedAt: event.completedAt,
      xpCost: event.xpCost,
      generationStatus: event.generationStatus,
      errorType: event.errorType,
      serviceUsed: event.serviceUsed,
      apiResponseTime: event.apiResponseTime,
      imageUrl: event.imageUrl,
    }));
  },
});

/**
 * Get aggregated image generation analytics.
 * Calculates success rates, average response times, XP metrics, and error breakdowns.
 *
 * Replaces: get_image_generation_analytics RPC
 *
 * @param clerkUserId - Optional filter by user (null = all users, admin only)
 * @param startDate - Optional start of date range (ISO 8601)
 * @param endDate - Optional end of date range (ISO 8601)
 * @returns Aggregated analytics object
 */
export const getImageGenerationAnalytics = query({
  args: {
    clerkUserId: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    // Use indexed query when filtering by user; fall back to date-range filter (R-4.6)
    let events;
    if (args.clerkUserId) {
      events = await ctx.db
        .query('imageGenerationEvents')
        .withIndex('by_clerk_user', q => q.eq('clerkUserId', args.clerkUserId!))
        .collect();
    } else {
      // No user filter — use _creationTime ordering to bound the scan
      events = await ctx.db
        .query('imageGenerationEvents')
        .order('desc')
        .take(10000); // Safety cap to prevent unbounded full-table scan
    }

    // Filter by date range
    if (args.startDate) {
      const startTime = new Date(args.startDate).getTime();
      events = events.filter(e => e._creationTime >= startTime);
    }

    if (args.endDate) {
      const endTime = new Date(args.endDate).getTime();
      events = events.filter(e => e._creationTime <= endTime);
    }

    // Calculate aggregations
    const totalAttempts = events.length;

    if (totalAttempts === 0) {
      return {
        totalAttempts: 0,
        successfulGenerations: 0,
        failedGenerations: 0,
        refundedGenerations: 0,
        pendingGenerations: 0,
        successRate: 0,
        avgResponseTime: 0,
        totalXpSpent: 0,
        totalXpRefunded: 0,
        netXpSpent: 0,
        errorBreakdown: {},
        serviceBreakdown: {},
        gradeLevelBreakdown: {},
      };
    }

    // Status counts
    const successfulGenerations = events.filter(
      e => e.generationStatus === 'success',
    ).length;
    const failedGenerations = events.filter(
      e => e.generationStatus === 'failed',
    ).length;
    const refundedGenerations = events.filter(
      e => e.generationStatus === 'refunded',
    ).length;
    const pendingGenerations = events.filter(
      e => e.generationStatus === 'pending',
    ).length;
    const timeoutGenerations = events.filter(
      e => e.generationStatus === 'timeout',
    ).length;

    // Success rate (exclude pending from denominator)
    const completedEvents = totalAttempts - pendingGenerations;
    const successRate =
      completedEvents > 0 ? (successfulGenerations / completedEvents) * 100 : 0;

    // Average response time (only for completed events with response time)
    const eventsWithResponseTime = events.filter(
      e => e.apiResponseTime !== undefined && e.apiResponseTime !== null,
    );
    const avgResponseTime =
      eventsWithResponseTime.length > 0
        ? eventsWithResponseTime.reduce(
            (sum, e) => sum + (e.apiResponseTime ?? 0),
            0,
          ) / eventsWithResponseTime.length
        : 0;

    // XP calculations
    const totalXpSpent = events.reduce((sum, e) => sum + e.xpCost, 0);
    const totalXpRefunded = events
      .filter(e => e.generationStatus === 'refunded')
      .reduce((sum, e) => sum + e.xpCost, 0);
    const netXpSpent = totalXpSpent - totalXpRefunded;

    // Error breakdown
    const errorBreakdown: Record<string, number> = {};
    events
      .filter(e => e.errorType)
      .forEach(e => {
        const errorType = e.errorType as string;
        errorBreakdown[errorType] = (errorBreakdown[errorType] || 0) + 1;
      });

    // Service breakdown
    const serviceBreakdown: Record<string, { total: number; success: number }> =
      {};
    events.forEach(e => {
      const service = e.serviceUsed;
      if (!serviceBreakdown[service]) {
        serviceBreakdown[service] = { total: 0, success: 0 };
      }
      serviceBreakdown[service].total++;
      if (e.generationStatus === 'success') {
        serviceBreakdown[service].success++;
      }
    });

    // Grade level breakdown
    const gradeLevelBreakdown: Record<string, number> = {};
    events
      .filter(e => e.storyGradeLevel)
      .forEach(e => {
        const gradeLevel = e.storyGradeLevel as string;
        gradeLevelBreakdown[gradeLevel] =
          (gradeLevelBreakdown[gradeLevel] || 0) + 1;
      });

    // Find most common error
    const mostCommonErrorType =
      Object.entries(errorBreakdown).sort(([, a], [, b]) => b - a)[0]?.[0] ??
      null;

    return {
      totalAttempts,
      successfulGenerations,
      failedGenerations,
      refundedGenerations,
      pendingGenerations,
      timeoutGenerations,
      successRate: Math.round(successRate * 100) / 100, // Round to 2 decimal places
      avgResponseTime: Math.round(avgResponseTime), // Round to whole milliseconds
      totalXpSpent,
      totalXpRefunded,
      netXpSpent,
      mostCommonErrorType,
      errorBreakdown,
      serviceBreakdown,
      gradeLevelBreakdown,
    };
  },
});

/**
 * Get daily image generation statistics.
 * Useful for monitoring trends over time.
 *
 * @param clerkUserId - Optional filter by user
 * @param days - Number of days to include (default: 14)
 * @returns Array of daily statistics
 */
export const getDailyImageGenerationStats = query({
  args: {
    clerkUserId: v.optional(v.string()),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const days = Math.min(args.days ?? 14, 90); // Max 90 days
    const startTime = Date.now() - days * 24 * 60 * 60 * 1000;

    // Get events using indexed query where possible (R-4.6)
    let events;
    if (args.clerkUserId) {
      // Use by_clerk_user index, then filter by date client-side
      events = (
        await ctx.db
          .query('imageGenerationEvents')
          .withIndex('by_clerk_user', q =>
            q.eq('clerkUserId', args.clerkUserId!),
          )
          .collect()
      ).filter(e => e._creationTime >= startTime);
    } else {
      events = await ctx.db
        .query('imageGenerationEvents')
        .filter(q => q.gte(q.field('_creationTime'), startTime))
        .collect();
    }

    // Group by date
    const dailyStats: Record<
      string,
      {
        date: string;
        total: number;
        successful: number;
        failed: number;
        refunded: number;
        xpSpent: number;
        xpRefunded: number;
      }
    > = {};

    events.forEach(event => {
      const date = new Date(event._creationTime).toISOString().split('T')[0];

      if (!dailyStats[date]) {
        dailyStats[date] = {
          date,
          total: 0,
          successful: 0,
          failed: 0,
          refunded: 0,
          xpSpent: 0,
          xpRefunded: 0,
        };
      }

      dailyStats[date].total++;
      dailyStats[date].xpSpent += event.xpCost;

      if (event.generationStatus === 'success') {
        dailyStats[date].successful++;
      } else if (event.generationStatus === 'failed') {
        dailyStats[date].failed++;
      } else if (event.generationStatus === 'refunded') {
        dailyStats[date].refunded++;
        dailyStats[date].xpRefunded += event.xpCost;
      }
    });

    // Sort by date and return
    return Object.values(dailyStats).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  },
});

/**
 * Check if user has sufficient XP for image generation.
 * Pre-flight validation before attempting generation.
 *
 * @param clerkUserId - Clerk authentication ID
 * @param requiredXp - XP needed (default: 1000)
 * @returns Object with hasEnough flag and current balance
 */
export const checkXpForImageGeneration = query({
  args: {
    clerkUserId: v.string(),
    requiredXp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const requiredXp = args.requiredXp ?? IMAGE_GENERATION_COST;

    const userProfile = await ctx.db
      .query('userProfiles')
      .withIndex('by_clerk_user_id', q => q.eq('clerkUserId', args.clerkUserId))
      .first();

    if (!userProfile) {
      return {
        hasEnough: false,
        currentBalance: 0,
        requiredXp,
        shortfall: requiredXp,
      };
    }

    const hasEnough = userProfile.totalXp >= requiredXp;
    const shortfall = hasEnough ? 0 : requiredXp - userProfile.totalXp;

    return {
      hasEnough,
      currentBalance: userProfile.totalXp,
      requiredXp,
      shortfall,
    };
  },
});

/**
 * Get recent image generation events across all users.
 * Admin-level query for monitoring system health.
 *
 * @param limit - Maximum events to return (default: 100)
 * @returns Array of recent events
 */
export const getRecentImageGenerationEvents = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = Math.min(args.limit ?? 100, 500);

    const events = await ctx.db
      .query('imageGenerationEvents')
      .order('desc')
      .take(limit);

    return events.map(event => ({
      id: event._id,
      createdAt: new Date(event._creationTime).toISOString(),
      completedAt: event.completedAt,
      clerkUserId: event.clerkUserId,
      generationStatus: event.generationStatus,
      errorType: event.errorType,
      serviceUsed: event.serviceUsed,
      apiResponseTime: event.apiResponseTime,
      xpCost: event.xpCost,
    }));
  },
});
