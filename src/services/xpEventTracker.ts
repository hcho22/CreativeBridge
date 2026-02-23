/**
 * XP Event Tracker Service
 * Comprehensive tracking for all XP-related events in image generation
 *
 * ## Convex Migration (US-020)
 * This service now uses Convex as PRIMARY data store with Supabase as SECONDARY
 * for dual-write during the migration period.
 *
 * Pattern: Convex PRIMARY, Supabase SECONDARY (non-blocking)
 * - All writes go to Convex first (source of truth)
 * - Dual-writes to Supabase for safety during transition
 * - Reads from Convex with Supabase fallback
 *
 * @see prd-supabase-to-convex-migration.md (US-020)
 */

import { supabase } from './supabase';
import { GenerationStatus, ErrorType, ServiceUsed } from '../types/database';

// Convex imports for database migration (US-020)
import { getConvexClient, api, isConvexReady } from './convex';
import type { Id } from '../../convex/_generated/dataModel';

// ============================================================================
// DUAL-WRITE CONFIGURATION (US-031: DISABLED)
// ============================================================================
// Migration complete: Convex is now the ONLY data store
// Dual-write has been disabled per US-031
const ENABLE_DUAL_WRITE = false;

/**
 * Detect if a user ID is a Clerk user ID (OAuth users) vs Supabase UUID (email/password users).
 * Clerk user IDs start with "user_".
 */
const isClerkUserId = (userId: string): boolean => userId.startsWith('user_');

export interface XPEventData {
  userId: string;
  sessionId?: string;
  xpAmount: number;
  eventType: 'deduction' | 'refund' | 'validation_check' | 'balance_inquiry';
  imageGenerationEventId?: string;
  reason: string;
  metadata?: Record<string, any>;
}

export interface ImageGenerationXPEvent {
  userId: string;
  sessionId?: string;
  xpCost: number;
  storyGradeLevel?: string;
  storyWordCount?: number;
  storyCompleted?: boolean; // NEW: Track whether story was completed before image generation
  metadata?: Record<string, any>;
}

export interface XPEventResult {
  success: boolean;
  eventId?: string;
  error?: string;
}

class XPEventTracker {
  private static instance: XPEventTracker;

  public static getInstance(): XPEventTracker {
    if (!XPEventTracker.instance) {
      XPEventTracker.instance = new XPEventTracker();
    }
    return XPEventTracker.instance;
  }

  /**
   * Create an image generation event for XP tracking
   *
   * Convex Migration (US-020):
   * - PRIMARY: Creates event in Convex (atomically deducts XP)
   * - SECONDARY: Dual-writes to Supabase for safety during transition
   * - Only uses Convex for Clerk/OAuth users (user IDs starting with "user_")
   */
  async createImageGenerationEvent(
    eventData: ImageGenerationXPEvent,
  ): Promise<XPEventResult> {
    try {
      console.log('📊 Creating image generation event for XP tracking:', {
        userId: eventData.userId,
        xpCost: eventData.xpCost,
        sessionId: eventData.sessionId,
      });

      let eventId: string | undefined;
      let convexSucceeded = false;

      // PRIMARY: Create event in Convex (US-020) - only for OAuth/Clerk users
      if (isConvexReady() && isClerkUserId(eventData.userId)) {
        const convexClient = getConvexClient();
        if (convexClient) {
          try {
            console.log(
              '📝 Creating image generation event in Convex (PRIMARY)',
            );
            const result = await convexClient.mutation(
              api.imageGeneration.createImageGenerationEvent,
              {
                clerkUserId: eventData.userId,
                sessionId: eventData.sessionId as
                  | Id<'gameSessions'>
                  | undefined,
                xpCost: eventData.xpCost,
                serviceUsed: 'replicate', // Default service
                storyGradeLevel: eventData.storyGradeLevel,
                storyWordCount: eventData.storyWordCount,
                metadata: {
                  ...eventData.metadata,
                  storyCompleted: eventData.storyCompleted,
                },
              },
            );
            eventId = result.eventId;
            convexSucceeded = true;
            console.log('✅ Convex image generation event created:', {
              eventId,
              xpDeducted: result.xpDeducted,
            });
          } catch (convexError) {
            console.error(
              '❌ Convex createImageGenerationEvent failed:',
              convexError,
            );
            // Fall through to Supabase
          }
        }
      }

      // Fallback to Supabase when Convex fails
      if (!convexSucceeded) {
        console.log('📝 Fallback: Creating event in Supabase');

        const { data: supabaseEventId, error } = await supabase.rpc(
          'create_image_generation_event',
          {
            p_user_id: eventData.userId,
            p_session_id: eventData.sessionId || '',
            p_xp_cost: eventData.xpCost,
            p_story_grade_level: eventData.storyGradeLevel,
            p_story_word_count: eventData.storyWordCount,
            p_metadata: eventData.metadata || {},
          },
        );

        if (error) {
          if (!convexSucceeded) {
            // Both failed
            console.error(
              '❌ Both Convex and Supabase failed to create event:',
              error,
            );
            return { success: false, error: error.message };
          }
        } else {
          console.log('✅ Supabase event created:', { supabaseEventId });
          eventId = supabaseEventId;
        }
      }

      console.log('✅ Image generation event created:', { eventId });
      return { success: true, eventId };
    } catch (error) {
      console.error('💥 Exception creating image generation event:', error);
      return {
        success: false,
        error: 'Failed to create image generation event',
      };
    }
  }

  /**
   * Update image generation event status
   *
   * Convex Migration (US-020):
   * - PRIMARY: Updates event in Convex (handles XP refunds automatically)
   * - SECONDARY: Dual-writes to Supabase for safety during transition
   * - Detects Convex vs Supabase event IDs by format
   */
  async updateImageGenerationEvent(
    eventId: string,
    status: GenerationStatus,
    options?: {
      imageUrl?: string;
      errorType?: ErrorType;
      serviceUsed?: ServiceUsed;
      apiResponseTime?: number;
      promptUsed?: string;
    },
  ): Promise<XPEventResult> {
    try {
      console.log('📊 Updating image generation event:', {
        eventId,
        status,
        ...options,
      });

      let convexSucceeded = false;

      // Detect if this is a Convex ID (alphanumeric) vs Supabase UUID
      // Supabase UUIDs have dashes, Convex IDs are alphanumeric
      const isConvexEventId = !eventId.includes('-');

      // PRIMARY: Update in Convex (US-020) - only for Convex event IDs
      if (isConvexReady() && isConvexEventId) {
        const convexClient = getConvexClient();
        if (convexClient) {
          try {
            console.log('📝 Updating event in Convex (PRIMARY)');
            const result = await convexClient.mutation(
              api.imageGeneration.updateImageGenerationEvent,
              {
                eventId: eventId as Id<'imageGenerationEvents'>,
                generationStatus: status,
                imageUrl: options?.imageUrl,
                errorType: options?.errorType,
                apiResponseTime: options?.apiResponseTime,
                promptUsed: options?.promptUsed,
              },
            );
            convexSucceeded = true;
            console.log('✅ Convex event updated:', {
              eventId,
              finalStatus: result.finalStatus,
              refunded: result.refunded,
              refundAmount: result.refundAmount,
            });
          } catch (convexError) {
            console.error(
              '❌ Convex updateImageGenerationEvent failed:',
              convexError,
            );
            // Fall through to Supabase
          }
        }
      }

      // Fallback to Supabase for Supabase event IDs or when Convex fails
      if (!convexSucceeded || !isConvexEventId) {
        const logPrefix = !isConvexEventId
          ? '📝 Primary (UUID):'
          : '📝 Fallback:';
        console.log(`${logPrefix} Updating event in Supabase`);

        const { error } = await supabase.rpc('update_image_generation_event', {
          p_event_id: eventId,
          p_status: status,
          p_image_url: options?.imageUrl,
          p_error_type: options?.errorType,
          p_service_used: options?.serviceUsed,
          p_api_response_time: options?.apiResponseTime,
          p_prompt_used: options?.promptUsed,
        });

        if (error) {
          if (!convexSucceeded) {
            // Both failed
            console.error('❌ Both Convex and Supabase failed:', error);
            return { success: false, error: error.message };
          }
        } else {
          console.log('✅ Supabase event updated');
        }
      }

      console.log('✅ Image generation event updated:', { eventId, status });
      return { success: true, eventId };
    } catch (error) {
      console.error('💥 Exception updating image generation event:', error);
      return {
        success: false,
        error: 'Failed to update image generation event',
      };
    }
  }

  /**
   * Track XP deduction for image generation
   */
  async trackXPDeduction(eventData: XPEventData): Promise<void> {
    try {
      console.log('💸 Tracking XP deduction:', {
        userId: eventData.userId,
        xpAmount: eventData.xpAmount,
        reason: eventData.reason,
        imageGenerationEventId: eventData.imageGenerationEventId,
      });

      // For now, we'll log to console and could extend to save to a separate XP events table
      // This provides audit trail for all XP operations
      const xpEvent = {
        timestamp: new Date().toISOString(),
        type: 'XP_DEDUCTION',
        userId: eventData.userId,
        sessionId: eventData.sessionId,
        xpAmount: eventData.xpAmount,
        reason: eventData.reason,
        imageGenerationEventId: eventData.imageGenerationEventId,
        metadata: {
          ...eventData.metadata,
          operation: 'deduct',
          eventType: eventData.eventType,
        },
      };

      // Log for audit purposes
      console.log('📝 XP Event Audit Log:', xpEvent);

      // TODO: In a production system, you might want to save this to a dedicated audit table
      // For now, the image_generation_events table serves as our tracking mechanism
    } catch (error) {
      console.error('💥 Error tracking XP deduction:', error);
    }
  }

  /**
   * Track XP refund for failed image generation
   *
   * Convex Migration (US-020):
   * - If the event ID is a Convex ID, uses the Convex refund mutation
   * - The Convex updateImageGenerationEvent automatically handles refunds
   */
  async trackXPRefund(eventData: XPEventData): Promise<void> {
    try {
      console.log('💰 Tracking XP refund:', {
        userId: eventData.userId,
        xpAmount: eventData.xpAmount,
        reason: eventData.reason,
        imageGenerationEventId: eventData.imageGenerationEventId,
      });

      const xpEvent = {
        timestamp: new Date().toISOString(),
        type: 'XP_REFUND',
        userId: eventData.userId,
        sessionId: eventData.sessionId,
        xpAmount: eventData.xpAmount,
        reason: eventData.reason,
        imageGenerationEventId: eventData.imageGenerationEventId,
        metadata: {
          ...eventData.metadata,
          operation: 'refund',
          eventType: eventData.eventType,
        },
      };

      console.log('📝 XP Refund Audit Log:', xpEvent);

      // Update the image generation event status to 'refunded' if eventId provided
      if (eventData.imageGenerationEventId) {
        // Detect if this is a Convex ID (alphanumeric) vs Supabase UUID
        const isConvexEventId = !eventData.imageGenerationEventId.includes('-');

        // For Convex events, we can use the dedicated refund mutation for edge cases
        // However, updateImageGenerationEvent already handles refunds automatically
        // when status is 'failed' or 'timeout' with a refundable error type
        if (isConvexReady() && isConvexEventId) {
          const convexClient = getConvexClient();
          if (convexClient) {
            try {
              console.log('💰 Processing refund via Convex');
              // Use the manual refund mutation for edge cases
              const result = await convexClient.mutation(
                api.imageGeneration.refundImageGenerationEvent,
                {
                  eventId:
                    eventData.imageGenerationEventId as Id<'imageGenerationEvents'>,
                },
              );
              console.log('✅ Convex refund processed:', {
                refundAmount: result.refundAmount,
                newBalance: result.newBalance,
              });
              // Still call updateImageGenerationEvent for Supabase dual-write
            } catch (convexError: any) {
              // If already refunded, that's fine - just log and continue
              if (convexError?.message?.includes('already refunded')) {
                console.log('ℹ️ Event already refunded in Convex');
              } else {
                console.warn('⚠️ Convex refund failed:', convexError);
              }
            }
          }
        }

        // Also update via the standard method (handles Supabase dual-write)
        await this.updateImageGenerationEvent(
          eventData.imageGenerationEventId,
          'refunded',
          { errorType: this.getErrorTypeFromReason(eventData.reason) },
        );
      }
    } catch (error) {
      console.error('💥 Error tracking XP refund:', error);
    }
  }

  /**
   * Track XP balance validation checks
   *
   * Convex Migration (US-020):
   * - For Clerk users, can use Convex's checkXpForImageGeneration query
   * - Falls back to local logging for email/password users
   */
  async trackXPValidation(
    userId: string,
    requiredXP: number,
    currentXP: number,
    validationResult: boolean,
    context: string = 'image_generation',
  ): Promise<void> {
    try {
      // For Clerk users with Convex, we can get more accurate XP info
      let actualCurrentXP = currentXP;
      let actualShortfall = validationResult ? 0 : requiredXP - currentXP;

      if (isConvexReady() && isClerkUserId(userId)) {
        const convexClient = getConvexClient();
        if (convexClient) {
          try {
            const xpCheck = await convexClient.query(
              api.imageGeneration.checkXpForImageGeneration,
              {
                clerkUserId: userId,
                requiredXp: requiredXP,
              },
            );
            actualCurrentXP = xpCheck.currentBalance;
            actualShortfall = xpCheck.shortfall;
          } catch (convexError) {
            console.warn('⚠️ Convex XP check failed:', convexError);
          }
        }
      }

      const validationEvent = {
        timestamp: new Date().toISOString(),
        type: 'XP_VALIDATION',
        userId,
        requiredXP,
        currentXP: actualCurrentXP,
        validationResult,
        context,
        shortfall: actualShortfall,
      };

      console.log('🔍 XP Validation Event:', validationEvent);
    } catch (error) {
      console.error('💥 Error tracking XP validation:', error);
    }
  }

  /**
   * Get XP analytics for image generation
   *
   * Convex Migration (US-020):
   * - PRIMARY: Fetches analytics from Convex
   * - FALLBACK: Falls back to Supabase if Convex unavailable
   */
  async getXPAnalytics(
    userId?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<any> {
    try {
      console.log('📈 Fetching XP analytics:', { userId, startDate, endDate });

      // PRIMARY: Try Convex first (US-020) - only for Clerk users or all-user analytics
      if (isConvexReady() && (!userId || isClerkUserId(userId))) {
        const convexClient = getConvexClient();
        if (convexClient) {
          try {
            console.log('📖 Fetching analytics from Convex (PRIMARY)');
            const analytics = await convexClient.query(
              api.imageGeneration.getImageGenerationAnalytics,
              {
                clerkUserId: userId,
                startDate: startDate,
                endDate: endDate,
              },
            );

            if (analytics) {
              console.log('✅ Convex analytics retrieved:', analytics);
              return analytics;
            }
          } catch (convexError) {
            console.warn(
              '⚠️ Convex analytics query failed, falling back to Supabase:',
              convexError,
            );
          }
        }
      }

      // FALLBACK: Try Supabase
      console.log('📖 Fetching analytics from Supabase (FALLBACK)');
      const { data: analytics, error } = await supabase.rpc(
        'get_image_generation_analytics',
        {
          p_user_id: userId,
          p_start_date: startDate,
          p_end_date: endDate,
        },
      );

      if (error) {
        console.error('❌ Failed to fetch XP analytics:', error);
        return null;
      }

      console.log('✅ XP Analytics retrieved:', analytics);
      return analytics;
    } catch (error) {
      console.error('💥 Exception fetching XP analytics:', error);
      return null;
    }
  }

  /**
   * Get user-specific image generation events
   *
   * Convex Migration (US-020):
   * - PRIMARY: Fetches events from Convex for Clerk users
   * - FALLBACK: Falls back to Supabase for email/password users or if Convex unavailable
   */
  async getUserImageGenerationEvents(
    userId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<any[]> {
    try {
      console.log('📋 Fetching user image generation events:', {
        userId,
        limit,
        offset,
      });

      // PRIMARY: Try Convex first (US-020) - only for Clerk users
      if (isConvexReady() && isClerkUserId(userId)) {
        const convexClient = getConvexClient();
        if (convexClient) {
          try {
            console.log('📖 Fetching events from Convex (PRIMARY)');
            const events = await convexClient.query(
              api.imageGeneration.getUserImageGenerationEvents,
              {
                clerkUserId: userId,
                limit: limit,
                offset: offset,
              },
            );

            if (events) {
              console.log('✅ Convex events retrieved:', {
                count: events.length,
              });
              // Convert Convex response format to legacy format for compatibility
              return events.map(event => ({
                id: event.id,
                created_at: event.createdAt,
                completed_at: event.completedAt,
                session_id: event.sessionId,
                xp_cost: event.xpCost,
                generation_status: event.generationStatus,
                error_type: event.errorType,
                service_used: event.serviceUsed,
                api_response_time: event.apiResponseTime,
                image_url: event.imageUrl,
                story_grade_level: event.storyGradeLevel,
                story_word_count: event.storyWordCount,
                prompt_used: event.promptUsed,
              }));
            }
          } catch (convexError) {
            console.warn(
              '⚠️ Convex events query failed, falling back to Supabase:',
              convexError,
            );
          }
        }
      }

      // FALLBACK: Try Supabase
      console.log('📖 Fetching events from Supabase (FALLBACK)');
      const { data: events, error } = await supabase.rpc(
        'get_user_image_generation_events',
        {
          p_user_id: userId,
          p_limit: limit,
          p_offset: offset,
        },
      );

      if (error) {
        console.error('❌ Failed to fetch user events:', error);
        return [];
      }

      console.log('✅ User events retrieved:', { count: events?.length || 0 });
      return events || [];
    } catch (error) {
      console.error('💥 Exception fetching user events:', error);
      return [];
    }
  }

  /**
   * Calculate XP cost for image generation based on context
   */
  calculateXPCost(
    gradeLevel?: string,
    storyWordCount?: number,
    userPremiumStatus?: boolean,
  ): number {
    // Base cost is always 1000 XP for now
    let baseCost = 1000;

    // Future: Could implement variable pricing based on:
    // - Grade level (K-2 might be cheaper)
    // - Story complexity (word count)
    // - Premium user discounts
    // - Promotional events

    console.log('💵 XP Cost Calculation:', {
      baseCost,
      gradeLevel,
      storyWordCount,
      userPremiumStatus,
    });

    return baseCost;
  }

  /**
   * Generate XP usage report for analytics
   */
  generateXPUsageReport(events: any[]): {
    totalXPSpent: number;
    totalGenerations: number;
    successfulGenerations: number;
    failedGenerations: number;
    refundedXP: number;
    averageCostPerGeneration: number;
    successRate: number;
  } {
    const report = {
      totalXPSpent: 0,
      totalGenerations: events.length,
      successfulGenerations: 0,
      failedGenerations: 0,
      refundedXP: 0,
      averageCostPerGeneration: 0,
      successRate: 0,
    };

    events.forEach(event => {
      report.totalXPSpent += event.xp_cost || 0;

      if (event.generation_status === 'success') {
        report.successfulGenerations++;
      } else if (event.generation_status === 'failed') {
        report.failedGenerations++;
      } else if (event.generation_status === 'refunded') {
        report.refundedXP += event.xp_cost || 0;
      }
    });

    report.averageCostPerGeneration =
      report.totalGenerations > 0
        ? report.totalXPSpent / report.totalGenerations
        : 0;

    report.successRate =
      report.totalGenerations > 0
        ? report.successfulGenerations / report.totalGenerations
        : 0;

    console.log('📊 XP Usage Report Generated:', report);
    return report;
  }

  /**
   * Helper method to extract error type from refund reason
   */
  private getErrorTypeFromReason(reason: string): ErrorType {
    const lowerReason = reason.toLowerCase();

    if (lowerReason.includes('timeout')) return 'timeout';
    if (lowerReason.includes('safety') || lowerReason.includes('content'))
      return 'content_safety';
    if (lowerReason.includes('rate limit')) return 'rate_limit';
    if (lowerReason.includes('api') || lowerReason.includes('service'))
      return 'api_failure';

    return 'api_failure'; // Default fallback
  }

  /**
   * Validate XP event data before processing
   */
  private validateEventData(eventData: XPEventData): boolean {
    if (!eventData.userId || eventData.userId.trim().length === 0) {
      console.error('❌ Invalid XP event data: Missing userId');
      return false;
    }

    if (eventData.xpAmount <= 0) {
      console.error('❌ Invalid XP event data: Invalid XP amount');
      return false;
    }

    if (!eventData.reason || eventData.reason.trim().length === 0) {
      console.error('❌ Invalid XP event data: Missing reason');
      return false;
    }

    return true;
  }
}

// Export singleton instance
export const xpEventTracker = XPEventTracker.getInstance();
export default XPEventTracker;
