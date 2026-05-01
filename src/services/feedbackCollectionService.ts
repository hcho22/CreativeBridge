/**
 * User Feedback and Bug Report Collection Service
 * Comprehensive system for collecting user feedback on image generation feature
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { auditLogger, EventType, EventCategory, Severity } from './auditLogger';
import AsyncStorage from '@react-native-async-storage/async-storage';

// The project's Supabase Database generic resolves to `never` for table rows
// (see AuthContext.tsx note: "Supabase client lacks typed schema in this
// project"). Until the schema typing is regenerated, cast to an untyped client
// at the boundary so chained operations type-check correctly. Behavior is
// unchanged at runtime — this only affects compile-time inference. The
// user_feedback row/status type aliases live in src/types/database.ts.
const sb = supabase as unknown as SupabaseClient;

export interface UserFeedback {
  id?: string;
  userId: string;
  sessionId?: string;
  feedbackType:
    | 'bug_report'
    | 'feature_request'
    | 'rating'
    | 'general'
    | 'image_quality';
  category:
    | 'image_generation'
    | 'ui_ux'
    | 'performance'
    | 'xp_system'
    | 'general';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  rating?: number; // 1-5 scale
  title: string;
  description: string;
  stepsToReproduce?: string;
  expectedBehavior?: string;
  actualBehavior?: string;
  imageGenerationEventId?: string;
  deviceInfo?: Record<string, any>;
  metadata?: Record<string, any>;
  status: 'new' | 'acknowledged' | 'in_progress' | 'resolved' | 'closed';
  createdAt: string;
  updatedAt?: string;
}

export interface BugReport extends UserFeedback {
  feedbackType: 'bug_report';
  stackTrace?: string;
  errorCode?: string;
  reproducible: boolean;
  frequency: 'always' | 'often' | 'sometimes' | 'rarely';
}

export interface FeatureRequest extends UserFeedback {
  feedbackType: 'feature_request';
  priority: 'low' | 'medium' | 'high';
  useCase: string;
  businessValue?: string;
}

export interface ImageQualityFeedback extends UserFeedback {
  feedbackType: 'image_quality';
  imageUrl?: string;
  qualityAspects: {
    accuracy: number; // 1-5
    artStyle: number; // 1-5
    clarity: number; // 1-5
    relevance: number; // 1-5
  };
  improvements: string[];
}

export interface FeedbackAnalytics {
  totalFeedback: number;
  averageRating: number;
  feedbackByType: Record<string, number>;
  feedbackByCategory: Record<string, number>;
  severityBreakdown: Record<string, number>;
  recentTrends: {
    last7Days: number;
    last30Days: number;
    growthRate: number;
  };
  topIssues: Array<{
    description: string;
    count: number;
    category: string;
    avgSeverity: string;
  }>;
  userSatisfactionScore: number;
}

class FeedbackCollectionService {
  private static instance: FeedbackCollectionService;
  private pendingFeedback: UserFeedback[] = [];
  private readonly MAX_PENDING = 50;

  public static getInstance(): FeedbackCollectionService {
    if (!FeedbackCollectionService.instance) {
      FeedbackCollectionService.instance = new FeedbackCollectionService();
    }
    return FeedbackCollectionService.instance;
  }

  constructor() {
    this.initializeService();
  }

  /**
   * Initialize feedback collection service
   */
  private async initializeService(): Promise<void> {
    try {
      await this.loadPendingFeedback();
      this.setupAutoSubmission();
      console.log('📝 Feedback collection service initialized');
    } catch (error) {
      console.error('Failed to initialize feedback service:', error);
    }
  }

  /**
   * Submit general user feedback
   */
  async submitFeedback(
    feedback: Omit<UserFeedback, 'id' | 'createdAt' | 'status'>,
  ): Promise<{
    success: boolean;
    feedbackId?: string;
    error?: string;
  }> {
    try {
      const enrichedFeedback: UserFeedback = {
        ...feedback,
        id: this.generateFeedbackId(),
        createdAt: new Date().toISOString(),
        status: 'new',
        deviceInfo: await this.getDeviceInfo(),
        metadata: {
          ...feedback.metadata,
          submissionMethod: 'app',
          appVersion: '1.0.0', // Would get from app config
        },
      };

      console.log('📨 Submitting user feedback:', {
        type: feedback.feedbackType,
        category: feedback.category,
        title: feedback.title,
      });

      // Try to submit immediately
      const { data, error } = await sb
        .from('user_feedback')
        .insert(enrichedFeedback)
        .select()
        .single();

      if (error) {
        // Add to pending queue if submission fails
        await this.addToPendingQueue(enrichedFeedback);
        console.warn('Feedback queued for later submission:', error.message);

        return {
          success: false,
          error: 'Feedback queued for submission when connection is available',
        };
      }

      // Log successful submission
      auditLogger.logEvent({
        eventType: EventType.USER_FEEDBACK_SUBMITTED,
        eventCategory: EventCategory.USER_INTERACTION,
        severity: Severity.INFO,
        description: `User feedback submitted: ${feedback.feedbackType}/${feedback.category}`,
        metadata: {
          feedbackId: data.id,
          type: feedback.feedbackType,
          category: feedback.category,
          rating: feedback.rating,
        },
        context: {
          timestamp: new Date(),
          action: 'feedback_submission',
          resource: 'feedback_system',
          userId: feedback.userId,
        },
      });

      console.log('✅ Feedback submitted successfully:', data.id);
      return { success: true, feedbackId: data.id };
    } catch (error: any) {
      console.error('Failed to submit feedback:', error);
      return {
        success: false,
        error: 'Failed to submit feedback. Please try again.',
      };
    }
  }

  /**
   * Submit bug report with detailed information
   */
  async submitBugReport(
    bugReport: Omit<BugReport, 'id' | 'createdAt' | 'status' | 'feedbackType'>,
  ): Promise<{
    success: boolean;
    bugReportId?: string;
    error?: string;
  }> {
    const enrichedBugReport: Omit<BugReport, 'id' | 'createdAt' | 'status'> = {
      ...bugReport,
      feedbackType: 'bug_report',
      severity: bugReport.severity || 'medium',
      stackTrace: await this.captureStackTrace(),
    };

    const result = await this.submitFeedback(enrichedBugReport);

    // If it's a critical bug, trigger immediate notification
    if (bugReport.severity === 'critical') {
      await this.triggerCriticalBugAlert(result.feedbackId || 'unknown');
    }

    return {
      success: result.success,
      bugReportId: result.feedbackId,
      error: result.error,
    };
  }

  /**
   * Submit image quality feedback
   */
  async submitImageQualityFeedback(
    feedback: Omit<
      ImageQualityFeedback,
      'id' | 'createdAt' | 'status' | 'feedbackType'
    >,
  ): Promise<{
    success: boolean;
    feedbackId?: string;
    error?: string;
  }> {
    const enrichedFeedback: Omit<
      ImageQualityFeedback,
      'id' | 'createdAt' | 'status'
    > = {
      ...feedback,
      feedbackType: 'image_quality',
      category: 'image_generation',
      rating: this.calculateOverallImageRating(feedback.qualityAspects),
    };

    return await this.submitFeedback(enrichedFeedback);
  }

  /**
   * Submit feature request
   */
  async submitFeatureRequest(
    request: Omit<
      FeatureRequest,
      'id' | 'createdAt' | 'status' | 'feedbackType'
    >,
  ): Promise<{
    success: boolean;
    requestId?: string;
    error?: string;
  }> {
    const enrichedRequest: Omit<FeatureRequest, 'id' | 'createdAt' | 'status'> =
      {
        ...request,
        feedbackType: 'feature_request',
        priority: request.priority || 'medium',
      };

    return await this.submitFeedback(enrichedRequest);
  }

  /**
   * Quick rating submission for image generation
   */
  async submitQuickRating(
    userId: string,
    imageGenerationEventId: string,
    rating: number,
    quickFeedback?: string,
  ): Promise<{
    success: boolean;
    feedbackId?: string;
    error?: string;
  }> {
    const feedback: Omit<UserFeedback, 'id' | 'createdAt' | 'status'> = {
      userId,
      feedbackType: 'rating',
      category: 'image_generation',
      title: `Quick Rating: ${rating}/5`,
      description:
        quickFeedback || `User rated image generation ${rating} out of 5 stars`,
      rating,
      imageGenerationEventId,
    };

    return await this.submitFeedback(feedback);
  }

  /**
   * Get feedback analytics for monitoring
   */
  async getFeedbackAnalytics(days: number = 30): Promise<FeedbackAnalytics> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const { data: feedback, error } = await sb
        .from('user_feedback')
        .select('*')
        .gte('created_at', startDate.toISOString());

      if (error) {
        console.warn('Failed to fetch feedback analytics:', error);
        return this.getDefaultAnalytics();
      }

      const feedbackList = feedback || [];
      const totalFeedback = feedbackList.length;

      // Calculate average rating
      const ratedFeedback = feedbackList.filter(f => f.rating && f.rating > 0);
      const averageRating =
        ratedFeedback.length > 0
          ? ratedFeedback.reduce((sum, f) => sum + f.rating, 0) /
            ratedFeedback.length
          : 0;

      // Breakdown by type and category
      const feedbackByType = this.groupBy(feedbackList, 'feedback_type');
      const feedbackByCategory = this.groupBy(feedbackList, 'category');
      const severityBreakdown = this.groupBy(
        feedbackList.filter(f => f.severity),
        'severity',
      );

      // Calculate trends
      const last7Days = feedbackList.filter(
        f =>
          new Date(f.created_at) >=
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      ).length;
      const last30Days = totalFeedback;
      const previousPeriod = await this.getPreviousPeriodCount(days);
      const growthRate =
        previousPeriod > 0
          ? ((totalFeedback - previousPeriod) / previousPeriod) * 100
          : 0;

      // Identify top issues
      const topIssues = this.identifyTopIssues(feedbackList);

      // Calculate user satisfaction score (based on ratings and bug reports)
      const userSatisfactionScore =
        this.calculateSatisfactionScore(feedbackList);

      const analytics: FeedbackAnalytics = {
        totalFeedback,
        averageRating,
        feedbackByType,
        feedbackByCategory,
        severityBreakdown,
        recentTrends: {
          last7Days,
          last30Days,
          growthRate,
        },
        topIssues,
        userSatisfactionScore,
      };

      console.log('📊 Feedback Analytics:', {
        totalFeedback,
        averageRating: averageRating.toFixed(1),
        satisfactionScore: userSatisfactionScore.toFixed(1),
        last7Days,
      });

      return analytics;
    } catch (error) {
      console.error('Failed to get feedback analytics:', error);
      return this.getDefaultAnalytics();
    }
  }

  /**
   * Get recent feedback for review
   */
  async getRecentFeedback(limit: number = 20): Promise<UserFeedback[]> {
    try {
      const { data: feedback, error } = await sb
        .from('user_feedback')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.warn('Failed to fetch recent feedback:', error);
        return [];
      }

      return feedback || [];
    } catch (error) {
      console.error('Failed to get recent feedback:', error);
      return [];
    }
  }

  /**
   * Update feedback status (for admin/developer use)
   */
  async updateFeedbackStatus(
    feedbackId: string,
    status: UserFeedback['status'],
    adminNotes?: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await sb
        .from('user_feedback')
        .update({
          status,
          updated_at: new Date().toISOString(),
          admin_notes: adminNotes,
        })
        .eq('id', feedbackId);

      if (error) {
        return { success: false, error: error.message };
      }

      console.log(`✅ Feedback ${feedbackId} status updated to: ${status}`);
      return { success: true };
    } catch (error: any) {
      console.error('Failed to update feedback status:', error);
      return { success: false, error: 'Failed to update feedback status' };
    }
  }

  // Private helper methods

  private async addToPendingQueue(feedback: UserFeedback): Promise<void> {
    this.pendingFeedback.push(feedback);

    // Keep only the most recent feedback if queue is full
    if (this.pendingFeedback.length > this.MAX_PENDING) {
      this.pendingFeedback = this.pendingFeedback.slice(-this.MAX_PENDING);
    }

    await this.savePendingFeedback();
  }

  private async loadPendingFeedback(): Promise<void> {
    try {
      const pendingJson = await AsyncStorage.getItem('feedback_pending');
      if (pendingJson) {
        this.pendingFeedback = JSON.parse(pendingJson);
      }
    } catch (error) {
      console.error('Failed to load pending feedback:', error);
      this.pendingFeedback = [];
    }
  }

  private async savePendingFeedback(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        'feedback_pending',
        JSON.stringify(this.pendingFeedback),
      );
    } catch (error) {
      console.error('Failed to save pending feedback:', error);
    }
  }

  private setupAutoSubmission(): void {
    // Attempt to submit pending feedback every 2 minutes
    setInterval(async () => {
      await this.submitPendingFeedback();
    }, 120000);
  }

  private async submitPendingFeedback(): Promise<void> {
    if (this.pendingFeedback.length === 0) return;

    const toSubmit = [...this.pendingFeedback];
    this.pendingFeedback = [];

    for (const feedback of toSubmit) {
      try {
        const { error } = await sb.from('user_feedback').insert(feedback);

        if (error) {
          // Re-add to pending if still failing
          this.pendingFeedback.push(feedback);
        } else {
          console.log('✅ Pending feedback submitted:', feedback.id);
        }
      } catch (error) {
        this.pendingFeedback.push(feedback);
      }
    }

    await this.savePendingFeedback();
  }

  private async getDeviceInfo(): Promise<Record<string, any>> {
    // Would integrate with react-native-device-info
    return {
      platform: 'mobile',
      timestamp: new Date().toISOString(),
      userAgent: 'CreativeBridge/1.0.0',
    };
  }

  private async captureStackTrace(): Promise<string | undefined> {
    try {
      // In a real implementation, this would capture the current stack trace
      const stack = new Error().stack;
      return stack?.split('\n').slice(0, 10).join('\n');
    } catch {
      return undefined;
    }
  }

  private calculateOverallImageRating(
    aspects: ImageQualityFeedback['qualityAspects'],
  ): number {
    const { accuracy, artStyle, clarity, relevance } = aspects;
    return Math.round((accuracy + artStyle + clarity + relevance) / 4);
  }

  private async triggerCriticalBugAlert(bugReportId: string): Promise<void> {
    console.log('🚨 CRITICAL BUG REPORTED:', bugReportId);

    // In production, this would:
    // - Send immediate notifications to development team
    // - Create high-priority tickets
    // - Trigger automated monitoring alerts

    auditLogger.logEvent({
      eventType: EventType.CRITICAL_ERROR,
      eventCategory: EventCategory.SYSTEM,
      severity: Severity.ERROR,
      description: 'Critical bug report submitted by user',
      metadata: { bugReportId },
      context: {
        timestamp: new Date(),
        action: 'critical_bug_alert',
        resource: 'feedback_system',
      },
    });
  }

  private groupBy(items: any[], key: string): Record<string, number> {
    const groups: Record<string, number> = {};
    items.forEach(item => {
      const value = item[key] || 'unknown';
      groups[value] = (groups[value] || 0) + 1;
    });
    return groups;
  }

  private identifyTopIssues(feedback: any[]): Array<{
    description: string;
    count: number;
    category: string;
    avgSeverity: string;
  }> {
    // Simple implementation - would be more sophisticated in production
    const issueGroups = new Map<string, any[]>();

    feedback.forEach(f => {
      const key = f.title || f.description?.substring(0, 50) || 'Unknown issue';
      if (!issueGroups.has(key)) {
        issueGroups.set(key, []);
      }
      issueGroups.get(key)!.push(f);
    });

    return Array.from(issueGroups.entries())
      .map(([description, issues]) => ({
        description,
        count: issues.length,
        category: issues[0]?.category || 'unknown',
        avgSeverity: this.calculateAverageSeverity(issues),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  private calculateAverageSeverity(issues: any[]): string {
    const severityMap: Record<'low' | 'medium' | 'high' | 'critical', number> =
      { low: 1, medium: 2, high: 3, critical: 4 };
    const severities = issues
      .filter(
        (i): i is { severity: 'low' | 'medium' | 'high' | 'critical' } =>
          i?.severity === 'low' ||
          i?.severity === 'medium' ||
          i?.severity === 'high' ||
          i?.severity === 'critical',
      )
      .map(i => severityMap[i.severity] || 2);

    if (severities.length === 0) return 'medium';

    const avg = severities.reduce((sum, s) => sum + s, 0) / severities.length;
    if (avg >= 3.5) return 'critical';
    if (avg >= 2.5) return 'high';
    if (avg >= 1.5) return 'medium';
    return 'low';
  }

  private calculateSatisfactionScore(feedback: any[]): number {
    // Simplified satisfaction score calculation
    const ratings = feedback.filter(f => f.rating && f.rating > 0);
    const bugs = feedback.filter(f => f.feedback_type === 'bug_report');

    if (ratings.length === 0 && bugs.length === 0) return 75; // Default neutral score

    let score = 75; // Start with neutral

    // Factor in ratings (positive influence)
    if (ratings.length > 0) {
      const avgRating =
        ratings.reduce((sum, f) => sum + f.rating, 0) / ratings.length;
      score += (avgRating - 3) * 10; // Scale 1-5 rating to impact score
    }

    // Factor in bug reports (negative influence)
    const criticalBugs = bugs.filter(b => b.severity === 'critical').length;
    const highBugs = bugs.filter(b => b.severity === 'high').length;

    score -= criticalBugs * 15; // Critical bugs heavily impact satisfaction
    score -= highBugs * 8; // High severity bugs moderately impact
    score -= (bugs.length - criticalBugs - highBugs) * 3; // Other bugs minor impact

    return Math.max(0, Math.min(100, score));
  }

  private async getPreviousPeriodCount(days: number): Promise<number> {
    try {
      const endDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const startDate = new Date(
        endDate.getTime() - days * 24 * 60 * 60 * 1000,
      );

      const { count, error } = await sb
        .from('user_feedback')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startDate.toISOString())
        .lt('created_at', endDate.toISOString());

      return error ? 0 : count || 0;
    } catch {
      return 0;
    }
  }

  private getDefaultAnalytics(): FeedbackAnalytics {
    return {
      totalFeedback: 0,
      averageRating: 0,
      feedbackByType: {},
      feedbackByCategory: {},
      severityBreakdown: {},
      recentTrends: {
        last7Days: 0,
        last30Days: 0,
        growthRate: 0,
      },
      topIssues: [],
      userSatisfactionScore: 75,
    };
  }

  private generateFeedbackId(): string {
    return `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const feedbackCollectionService =
  FeedbackCollectionService.getInstance();
export default feedbackCollectionService;
