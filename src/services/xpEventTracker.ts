/**
 * XP Event Tracker Service
 * Comprehensive tracking for all XP-related events in image generation
 *
 * Uses Convex exclusively as the data store for all users.
 * Supabase dual-write and fallback paths removed per US-011 (Phase 4 cleanup).
 *
 * @see prd-clerk-email-password-migration.md (US-011)
 */

import { GenerationStatus, ErrorType, ServiceUsed } from '../types/database';

// Convex imports
import { getConvexClient, api, isConvexReady } from './convex';
import type { Id } from '../../convex/_generated/dataModel';

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
  storyCompleted?: boolean;
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
   * Create an image generation event for XP tracking.
   * Creates the event in Convex, which atomically deducts XP.
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

      if (!isConvexReady()) {
        console.error('❌ Convex is not ready');
        return { success: false, error: 'Database not available' };
      }

      const convexClient = getConvexClient();
      if (!convexClient) {
        console.error('❌ Convex client unavailable');
        return { success: false, error: 'Database client unavailable' };
      }

      console.log('📝 Creating image generation event in Convex');
      const result = await convexClient.mutation(
        api.imageGeneration.createImageGenerationEvent,
        {
          clerkUserId: eventData.userId,
          sessionId: eventData.sessionId as Id<'gameSessions'> | undefined,
          xpCost: eventData.xpCost,
          serviceUsed: 'replicate',
          storyGradeLevel: eventData.storyGradeLevel,
          storyWordCount: eventData.storyWordCount,
          metadata: {
            ...eventData.metadata,
            storyCompleted: eventData.storyCompleted,
          },
        },
      );

      console.log('✅ Image generation event created:', {
        eventId: result.eventId,
        xpDeducted: result.xpDeducted,
      });
      return { success: true, eventId: result.eventId };
    } catch (error) {
      console.error('💥 Exception creating image generation event:', error);
      return {
        success: false,
        error: 'Failed to create image generation event',
      };
    }
  }

  /**
   * Update image generation event status.
   * Updates the event in Convex, which handles XP refunds automatically.
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

      if (!isConvexReady()) {
        console.error('❌ Convex is not ready');
        return { success: false, error: 'Database not available' };
      }

      const convexClient = getConvexClient();
      if (!convexClient) {
        console.error('❌ Convex client unavailable');
        return { success: false, error: 'Database client unavailable' };
      }

      console.log('📝 Updating event in Convex');
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

      console.log('✅ Convex event updated:', {
        eventId,
        finalStatus: result.finalStatus,
        refunded: result.refunded,
        refundAmount: result.refundAmount,
      });
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

      console.log('📝 XP Event Audit Log:', xpEvent);
    } catch (error) {
      console.error('💥 Error tracking XP deduction:', error);
    }
  }

  /**
   * Track XP refund for failed image generation.
   * Uses the Convex refund mutation, then updates the event status.
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

      if (eventData.imageGenerationEventId) {
        if (isConvexReady()) {
          const convexClient = getConvexClient();
          if (convexClient) {
            try {
              console.log('💰 Processing refund via Convex');
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
            } catch (convexError: any) {
              if (convexError?.message?.includes('already refunded')) {
                console.log('ℹ️ Event already refunded in Convex');
              } else {
                console.warn('⚠️ Convex refund failed:', convexError);
              }
            }
          }
        }

        // Update the event status to 'refunded'
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
   * Track XP balance validation checks.
   * Uses Convex's checkXpForImageGeneration query for accurate XP info.
   */
  async trackXPValidation(
    userId: string,
    requiredXP: number,
    currentXP: number,
    validationResult: boolean,
    context: string = 'image_generation',
  ): Promise<void> {
    try {
      let actualCurrentXP = currentXP;
      let actualShortfall = validationResult ? 0 : requiredXP - currentXP;

      if (isConvexReady()) {
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
   * Get XP analytics for image generation from Convex.
   */
  async getXPAnalytics(
    userId?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<any> {
    try {
      console.log('📈 Fetching XP analytics:', { startDate, endDate });

      if (!isConvexReady()) {
        console.error('❌ Convex is not ready');
        return null;
      }

      const convexClient = getConvexClient();
      if (!convexClient) {
        console.error('❌ Convex client unavailable');
        return null;
      }

      console.log('📖 Fetching analytics from Convex');
      const analytics = await convexClient.query(
        api.imageGeneration.getImageGenerationAnalytics,
        {
          clerkUserId: userId,
          startDate: startDate,
          endDate: endDate,
        },
      );

      console.log('✅ XP Analytics retrieved:', analytics);
      return analytics;
    } catch (error) {
      console.error('💥 Exception fetching XP analytics:', error);
      return null;
    }
  }

  /**
   * Get user-specific image generation events from Convex.
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

      if (!isConvexReady()) {
        console.error('❌ Convex is not ready');
        return [];
      }

      const convexClient = getConvexClient();
      if (!convexClient) {
        console.error('❌ Convex client unavailable');
        return [];
      }

      console.log('📖 Fetching events from Convex');
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

      return [];
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
