/**
 * XP Event Tracker Service
 * Comprehensive tracking for all XP-related events in image generation
 */

import { supabase } from './supabase';
import { GenerationStatus, ErrorType, ServiceUsed } from '../types/database';

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

      const { data: eventId, error } = await supabase.rpc(
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
        console.error('❌ Failed to create image generation event:', error);
        return { success: false, error: error.message };
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
        console.error('❌ Failed to update image generation event:', error);
        return { success: false, error: error.message };
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
   */
  async trackXPValidation(
    userId: string,
    requiredXP: number,
    currentXP: number,
    validationResult: boolean,
    context: string = 'image_generation',
  ): Promise<void> {
    try {
      const validationEvent = {
        timestamp: new Date().toISOString(),
        type: 'XP_VALIDATION',
        userId,
        requiredXP,
        currentXP,
        validationResult,
        context,
        shortfall: validationResult ? 0 : requiredXP - currentXP,
      };

      console.log('🔍 XP Validation Event:', validationEvent);
    } catch (error) {
      console.error('💥 Error tracking XP validation:', error);
    }
  }

  /**
   * Get XP analytics for image generation
   */
  async getXPAnalytics(
    userId?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<any> {
    try {
      console.log('📈 Fetching XP analytics:', { userId, startDate, endDate });

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
