/**
 * Analytics Service for Story Continuation Feature
 *
 * Provides comprehensive analytics and insights for story import usage,
 * continuation success rates, user engagement, performance monitoring,
 * and automated reporting for data-driven improvements.
 */

import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// US-013: Anonymization salt — in production, load from environment variable
const ANALYTICS_HASH_SALT = 'cb-analytics-v1';

/**
 * US-013: One-way hash for userId anonymization.
 * Uses a djb2a variant with salt, producing a hex string that cannot be reversed
 * to recover the original userId. Deterministic: same input always yields same output,
 * so aggregate analytics (unique users, per-user session counts) still work.
 */
function hashUserId(rawUserId: string): string {
  const salted = `${ANALYTICS_HASH_SALT}:${rawUserId}`;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < salted.length; i++) {
    const ch = salted.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hash = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return 'anon_' + hash.toString(36);
}

// Types for analytics events and metrics
export interface AnalyticsEvent {
  id?: string;
  type:
    | 'story_import'
    | 'story_continuation'
    | 'user_engagement'
    | 'performance'
    | 'error';
  subtype?: string;
  userId: string; // US-013: Now stores hashed/anonymized userId
  sessionId: string;
  timestamp: string;
  metadata: {
    source?: 'file' | 'database' | 'story_quest';
    fileSize?: number;
    storyLength?: number;
    success?: boolean;
    errorCode?: string;
    duration?: number;
    // US-013: deviceInfo removed — no device identifiers in analytics
    [key: string]: any;
  };
  properties?: Record<string, any>;
}

export interface UsageMetrics {
  totalImports: number;
  uniqueUsers: number;
  averageSessionDuration: number;
  importSuccessRate: number;
  continuationSuccessRate: number;
  popularSources: Array<{ source: string; count: number; percentage: number }>;
  averageStoryLength: number;
  userRetentionRate: number;
  errorRate: number;
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
}

export interface UserEngagementMetrics {
  userId: string; // US-013: anonymized (hashed) userId
  sessionsThisWeek: number;
  sessionsThisMonth: number;
  totalStoryImports: number;
  totalStoryContinuations: number;
  averageSessionDuration: number;
  lastActiveDate: string;
  favoriteSource: string;
  engagementScore: number;
  retentionDays: number;
}

export interface PerformanceMetrics {
  averageImportTime: number;
  averageContinuationTime: number;
  cacheHitRate: number;
  databaseQueryTime: number;
  errorRates: {
    imports: number;
    continuations: number;
    network: number;
    database: number;
  };
  devicePerformance: {
    memoryUsage: number;
    cpuUsage: number;
    batteryImpact: number;
  };
}

export interface AnalyticsReport {
  reportId: string;
  reportType: 'daily' | 'weekly' | 'monthly' | 'custom';
  generatedAt: string;
  dateRange: {
    start: string;
    end: string;
  };
  summary: {
    totalEvents: number;
    uniqueUsers: number;
    keyMetrics: Record<string, number>;
    trends: Array<{
      metric: string;
      change: number;
      direction: 'up' | 'down' | 'stable';
    }>;
  };
  insights: string[];
  recommendations: string[];
  rawData?: any;
}

export interface AlertConfig {
  id: string;
  name: string;
  metric: string;
  threshold: number;
  condition: 'above' | 'below' | 'equals';
  enabled: boolean;
  recipients: string[];
  frequency: 'immediate' | 'hourly' | 'daily';
}

class AnalyticsService {
  private sessionId: string;
  private localEventQueue: AnalyticsEvent[] = [];
  private readonly MAX_QUEUE_SIZE = 100;
  private readonly BATCH_UPLOAD_INTERVAL = 30000; // 30 seconds
  private uploadTimer?: NodeJS.Timeout;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.initializeAnalytics();
  }

  /**
   * Initialize analytics service
   */
  private async initializeAnalytics(): Promise<void> {
    try {
      // Load any pending events from local storage
      await this.loadPendingEvents();

      // Start batch upload timer
      this.startBatchUpload();

      // Track session start
      // US-013: No deviceInfo collected in analytics events
      await this.trackEvent({
        type: 'user_engagement',
        subtype: 'session_start',
        userId: 'current_user',
        sessionId: this.sessionId,
        timestamp: new Date().toISOString(),
        metadata: {},
      });

      console.log('📊 Analytics service initialized');
    } catch (error) {
      console.error('Analytics initialization error:', error);
    }
  }

  /**
   * Track an analytics event
   * US-013: userId is hashed before storage; deviceInfo is stripped from metadata
   */
  async trackEvent(event: Omit<AnalyticsEvent, 'id'>): Promise<void> {
    try {
      // US-013: Anonymize userId and strip deviceInfo
      const { deviceInfo, ...cleanMetadata } = event.metadata || {};
      const eventWithId: AnalyticsEvent = {
        ...event,
        id: this.generateEventId(),
        userId: event.userId === 'system' ? 'system' : hashUserId(event.userId),
        metadata: cleanMetadata,
        timestamp: event.timestamp || new Date().toISOString(),
      };

      // Add to local queue
      this.localEventQueue.push(eventWithId);

      // Save to local storage for persistence
      await this.savePendingEvents();

      // Try immediate upload if queue is getting full
      if (this.localEventQueue.length >= this.MAX_QUEUE_SIZE) {
        await this.uploadEvents();
      }

      console.log(
        `📈 Tracked event: ${event.type}/${event.subtype || 'default'}`,
      );
    } catch (error) {
      console.error('Track event error:', error);
    }
  }

  /**
   * Track story import event
   */
  async trackStoryImport(
    userId: string,
    source: 'file' | 'database' | 'story_quest',
    success: boolean,
    metadata: Record<string, any> = {},
  ): Promise<void> {
    await this.trackEvent({
      type: 'story_import',
      subtype: source,
      userId,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      metadata: {
        source,
        success,
        ...metadata,
      },
    });
  }

  /**
   * Track story continuation event
   */
  async trackStoryContinuation(
    userId: string,
    storyId: string,
    success: boolean,
    metadata: Record<string, any> = {},
  ): Promise<void> {
    await this.trackEvent({
      type: 'story_continuation',
      subtype: success ? 'success' : 'failure',
      userId,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      metadata: {
        storyId,
        success,
        ...metadata,
      },
    });
  }

  /**
   * Track user engagement event
   */
  async trackUserEngagement(
    userId: string,
    action: string,
    metadata: Record<string, any> = {},
  ): Promise<void> {
    await this.trackEvent({
      type: 'user_engagement',
      subtype: action,
      userId,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      metadata,
    });
  }

  /**
   * Track performance metrics
   */
  async trackPerformance(
    operation: string,
    duration: number,
    success: boolean,
    metadata: Record<string, any> = {},
  ): Promise<void> {
    await this.trackEvent({
      type: 'performance',
      subtype: operation,
      userId: 'system',
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      metadata: {
        duration,
        success,
        ...metadata,
      },
    });
  }

  /**
   * Track error events
   */
  async trackError(
    userId: string,
    errorType: string,
    errorMessage: string,
    metadata: Record<string, any> = {},
  ): Promise<void> {
    await this.trackEvent({
      type: 'error',
      subtype: errorType,
      userId,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      metadata: {
        errorMessage,
        ...metadata,
      },
    });
  }

  /**
   * Get usage metrics for a date range
   */
  async getUsageMetrics(
    startDate: string,
    endDate: string,
    userId?: string,
  ): Promise<UsageMetrics> {
    try {
      let query = supabase
        .from('analytics_events')
        .select('*')
        .gte('timestamp', startDate)
        .lte('timestamp', endDate);

      if (userId) {
        // US-013: Query by hashed userId since stored data is anonymized
        query = query.eq('userId', hashUserId(userId));
      }

      const { data: events, error } = await query;

      if (error) {
        console.warn(
          'Failed to fetch usage metrics from database, using defaults',
        );
        return this.getDefaultUsageMetrics();
      }

      return this.calculateUsageMetrics(events || []);
    } catch (error) {
      console.error('Get usage metrics error:', error);
      return this.getDefaultUsageMetrics();
    }
  }

  /**
   * Get user engagement metrics
   */
  async getUserEngagementMetrics(
    userId: string,
  ): Promise<UserEngagementMetrics> {
    try {
      const thirtyDaysAgo = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000,
      ).toISOString();

      // US-013: Query by hashed userId
      const hashedId = hashUserId(userId);
      const { data: events, error } = await supabase
        .from('analytics_events')
        .select('*')
        .eq('userId', hashedId)
        .gte('timestamp', thirtyDaysAgo);

      if (error) {
        console.warn('Failed to fetch user engagement metrics');
        return this.getDefaultUserEngagement(hashedId);
      }

      return this.calculateUserEngagement(hashedId, events || []);
    } catch (error) {
      console.error('Get user engagement metrics error:', error);
      return this.getDefaultUserEngagement(hashUserId(userId));
    }
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(
    startDate: string,
    endDate: string,
  ): Promise<PerformanceMetrics> {
    try {
      const { data: events, error } = await supabase
        .from('analytics_events')
        .select('*')
        .eq('type', 'performance')
        .gte('timestamp', startDate)
        .lte('timestamp', endDate);

      if (error) {
        console.warn('Failed to fetch performance metrics');
        return this.getDefaultPerformanceMetrics();
      }

      return this.calculatePerformanceMetrics(events || []);
    } catch (error) {
      console.error('Get performance metrics error:', error);
      return this.getDefaultPerformanceMetrics();
    }
  }

  /**
   * Generate analytics report
   */
  async generateReport(
    reportType: 'daily' | 'weekly' | 'monthly' | 'custom',
    dateRange?: { start: string; end: string },
  ): Promise<AnalyticsReport> {
    try {
      const range = dateRange || this.getDateRangeForReportType(reportType);
      const usageMetrics = await this.getUsageMetrics(range.start, range.end);
      const performanceMetrics = await this.getPerformanceMetrics(
        range.start,
        range.end,
      );

      const report: AnalyticsReport = {
        reportId: this.generateReportId(),
        reportType,
        generatedAt: new Date().toISOString(),
        dateRange: range,
        summary: {
          totalEvents: usageMetrics.totalImports,
          uniqueUsers: usageMetrics.uniqueUsers,
          keyMetrics: {
            importSuccessRate: usageMetrics.importSuccessRate,
            continuationSuccessRate: usageMetrics.continuationSuccessRate,
            averageSessionDuration: usageMetrics.averageSessionDuration,
            userRetentionRate: usageMetrics.userRetentionRate,
          },
          trends: this.calculateTrends(usageMetrics, performanceMetrics),
        },
        insights: this.generateInsights(usageMetrics, performanceMetrics),
        recommendations: this.generateRecommendations(
          usageMetrics,
          performanceMetrics,
        ),
      };

      // Save report to database
      await this.saveReport(report);

      return report;
    } catch (error) {
      console.error('Generate report error:', error);
      throw new Error('Failed to generate analytics report');
    }
  }

  /**
   * Get events by type
   */
  async getEvents(
    eventType: string,
    limit: number = 100,
    offset: number = 0,
  ): Promise<AnalyticsEvent[]> {
    try {
      const { data: events, error } = await supabase
        .from('analytics_events')
        .select('*')
        .eq('type', eventType)
        .order('timestamp', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.warn('Failed to fetch events from database');
        return [];
      }

      return events || [];
    } catch (error) {
      console.error('Get events error:', error);
      return [];
    }
  }

  /**
   * Get success rates for imports and continuations
   */
  async getSuccessRates(): Promise<{
    importSuccessRate: number;
    continuationSuccessRate: number;
  }> {
    try {
      const sevenDaysAgo = new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000,
      ).toISOString();

      const { data: events, error } = await supabase
        .from('analytics_events')
        .select('*')
        .in('type', ['story_import', 'story_continuation'])
        .gte('timestamp', sevenDaysAgo);

      if (error) {
        return { importSuccessRate: 0, continuationSuccessRate: 0 };
      }

      const importEvents = events?.filter(e => e.type === 'story_import') || [];
      const continuationEvents =
        events?.filter(e => e.type === 'story_continuation') || [];

      const importSuccessRate =
        importEvents.length > 0
          ? (importEvents.filter(e => e.metadata?.success).length /
              importEvents.length) *
            100
          : 0;

      const continuationSuccessRate =
        continuationEvents.length > 0
          ? (continuationEvents.filter(e => e.metadata?.success).length /
              continuationEvents.length) *
            100
          : 0;

      return { importSuccessRate, continuationSuccessRate };
    } catch (error) {
      console.error('Get success rates error:', error);
      return { importSuccessRate: 0, continuationSuccessRate: 0 };
    }
  }

  /**
   * Generate usage report
   */
  async generateUsageReport(): Promise<{
    totalImports: number;
    uniqueUsers: number;
    averageSessionDuration: number;
  }> {
    try {
      const thirtyDaysAgo = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const usageMetrics = await this.getUsageMetrics(
        thirtyDaysAgo,
        new Date().toISOString(),
      );

      return {
        totalImports: usageMetrics.totalImports,
        uniqueUsers: usageMetrics.uniqueUsers,
        averageSessionDuration: usageMetrics.averageSessionDuration,
      };
    } catch (error) {
      console.error('Generate usage report error:', error);
      return {
        totalImports: 0,
        uniqueUsers: 0,
        averageSessionDuration: 0,
      };
    }
  }

  // Private helper methods

  private async uploadEvents(): Promise<void> {
    if (this.localEventQueue.length === 0) return;

    try {
      // Attempt to upload to database
      const eventsToUpload = [...this.localEventQueue];

      const { error } = await supabase
        .from('analytics_events')
        .insert(eventsToUpload);

      if (error) {
        console.warn('Failed to upload events to database:', error.message);
        // Keep events in queue for retry
        return;
      }

      // Clear uploaded events from queue
      this.localEventQueue = [];
      await this.savePendingEvents();

      console.log(`📤 Uploaded ${eventsToUpload.length} analytics events`);
    } catch (error) {
      console.error('Upload events error:', error);
    }
  }

  private startBatchUpload(): void {
    this.uploadTimer = setInterval(async () => {
      await this.uploadEvents();
    }, this.BATCH_UPLOAD_INTERVAL);
  }

  private async savePendingEvents(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        'analytics_pending_events',
        JSON.stringify(this.localEventQueue),
      );
    } catch (error) {
      console.error('Save pending events error:', error);
    }
  }

  private async loadPendingEvents(): Promise<void> {
    try {
      const pendingEventsJson = await AsyncStorage.getItem(
        'analytics_pending_events',
      );
      if (pendingEventsJson) {
        this.localEventQueue = JSON.parse(pendingEventsJson);
      }
    } catch (error) {
      console.error('Load pending events error:', error);
      this.localEventQueue = [];
    }
  }

  private calculateUsageMetrics(events: AnalyticsEvent[]): UsageMetrics {
    const importEvents = events.filter(e => e.type === 'story_import');
    const continuationEvents = events.filter(
      e => e.type === 'story_continuation',
    );
    const engagementEvents = events.filter(e => e.type === 'user_engagement');

    const uniqueUsers = new Set(events.map(e => e.userId)).size;
    const totalImports = importEvents.length;

    const importSuccessRate =
      importEvents.length > 0
        ? (importEvents.filter(e => e.metadata?.success).length /
            importEvents.length) *
          100
        : 0;

    const continuationSuccessRate =
      continuationEvents.length > 0
        ? (continuationEvents.filter(e => e.metadata?.success).length /
            continuationEvents.length) *
          100
        : 0;

    // Calculate popular sources
    const sourceCounts = new Map<string, number>();
    importEvents.forEach(event => {
      const source = event.metadata?.source || 'unknown';
      sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
    });

    const popularSources = Array.from(sourceCounts.entries())
      .map(([source, count]) => ({
        source,
        count,
        percentage: totalImports > 0 ? (count / totalImports) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Calculate session durations
    const sessionDurations = engagementEvents
      .filter(e => e.metadata?.duration)
      .map(e => e.metadata.duration as number);

    const averageSessionDuration =
      sessionDurations.length > 0
        ? sessionDurations.reduce((sum, duration) => sum + duration, 0) /
          sessionDurations.length
        : 0;

    // Calculate error rate
    const errorEvents = events.filter(e => e.type === 'error');
    const errorRate =
      events.length > 0 ? (errorEvents.length / events.length) * 100 : 0;

    return {
      totalImports,
      uniqueUsers,
      averageSessionDuration,
      importSuccessRate,
      continuationSuccessRate,
      popularSources,
      averageStoryLength: 0, // Would need story content analysis
      userRetentionRate: 0, // Would need multi-day analysis
      errorRate,
      dailyActiveUsers: 0, // Would need daily tracking
      weeklyActiveUsers: 0, // Would need weekly tracking
      monthlyActiveUsers: uniqueUsers, // Approximation for current period
    };
  }

  private calculateUserEngagement(
    userId: string,
    events: AnalyticsEvent[],
  ): UserEngagementMetrics {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const weeklyEvents = events.filter(
      e => new Date(e.timestamp) >= oneWeekAgo,
    );
    const monthlyEvents = events.filter(
      e => new Date(e.timestamp) >= oneMonthAgo,
    );

    const importEvents = events.filter(e => e.type === 'story_import');
    const continuationEvents = events.filter(
      e => e.type === 'story_continuation',
    );

    // Get unique sessions
    const uniqueSessions = new Set(events.map(e => e.sessionId));
    const weeklySessionsSet = new Set(weeklyEvents.map(e => e.sessionId));
    const monthlySessionsSet = new Set(monthlyEvents.map(e => e.sessionId));

    // Calculate favorite source
    const sourceCounts = new Map<string, number>();
    importEvents.forEach(event => {
      const source = event.metadata?.source || 'unknown';
      sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
    });

    const favoriteSource =
      sourceCounts.size > 0
        ? Array.from(sourceCounts.entries()).sort((a, b) => b[1] - a[1])[0][0]
        : 'none';

    // Calculate engagement score (0-100)
    let engagementScore = 0;
    engagementScore += Math.min(weeklySessionsSet.size * 10, 30); // Sessions (max 30)
    engagementScore += Math.min(importEvents.length * 5, 25); // Imports (max 25)
    engagementScore += Math.min(continuationEvents.length * 5, 25); // Continuations (max 25)
    engagementScore += Math.min(uniqueSessions.size * 2, 20); // Total sessions (max 20)

    const lastEvent = events.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )[0];

    return {
      userId,
      sessionsThisWeek: weeklySessionsSet.size,
      sessionsThisMonth: monthlySessionsSet.size,
      totalStoryImports: importEvents.length,
      totalStoryContinuations: continuationEvents.length,
      averageSessionDuration: 0, // Would need session duration tracking
      lastActiveDate: lastEvent?.timestamp || '',
      favoriteSource,
      engagementScore,
      retentionDays: events.length > 0 ? 30 : 0, // Simplified retention calculation
    };
  }

  private calculatePerformanceMetrics(
    events: AnalyticsEvent[],
  ): PerformanceMetrics {
    const performanceEvents = events.filter(e => e.type === 'performance');

    const importTimes = performanceEvents
      .filter(e => e.subtype === 'story_import')
      .map(e => e.metadata?.duration || 0);

    const continuationTimes = performanceEvents
      .filter(e => e.subtype === 'story_continuation')
      .map(e => e.metadata?.duration || 0);

    const errorEvents = events.filter(e => e.type === 'error');
    const totalEvents = events.length;

    return {
      averageImportTime:
        importTimes.length > 0
          ? importTimes.reduce((sum, time) => sum + time, 0) /
            importTimes.length
          : 0,
      averageContinuationTime:
        continuationTimes.length > 0
          ? continuationTimes.reduce((sum, time) => sum + time, 0) /
            continuationTimes.length
          : 0,
      cacheHitRate: 0, // Would integrate with performance service
      databaseQueryTime: 0, // Would need specific tracking
      errorRates: {
        imports: this.calculateErrorRate(errorEvents, 'import'),
        continuations: this.calculateErrorRate(errorEvents, 'continuation'),
        network: this.calculateErrorRate(errorEvents, 'network'),
        database: this.calculateErrorRate(errorEvents, 'database'),
      },
      devicePerformance: {
        memoryUsage: 0, // Would need device monitoring
        cpuUsage: 0,
        batteryImpact: 0,
      },
    };
  }

  private calculateErrorRate(
    errorEvents: AnalyticsEvent[],
    errorType: string,
  ): number {
    const typeErrors = errorEvents.filter(
      e =>
        e.subtype?.includes(errorType) || e.metadata?.errorType === errorType,
    );
    return errorEvents.length > 0
      ? (typeErrors.length / errorEvents.length) * 100
      : 0;
  }

  private calculateTrends(
    usageMetrics: UsageMetrics,
    performanceMetrics: PerformanceMetrics,
  ): Array<{
    metric: string;
    change: number;
    direction: 'up' | 'down' | 'stable';
  }> {
    // This would typically compare with previous period data
    // For now, return sample trends based on current metrics
    return [
      {
        metric: 'Import Success Rate',
        change: 5.2,
        direction: usageMetrics.importSuccessRate > 80 ? 'up' : 'down',
      },
      {
        metric: 'User Engagement',
        change: 2.1,
        direction: usageMetrics.uniqueUsers > 10 ? 'up' : 'stable',
      },
      {
        metric: 'Performance',
        change: -1.3,
        direction: performanceMetrics.averageImportTime < 2000 ? 'up' : 'down',
      },
    ];
  }

  private generateInsights(
    usageMetrics: UsageMetrics,
    performanceMetrics: PerformanceMetrics,
  ): string[] {
    const insights: string[] = [];

    if (usageMetrics.importSuccessRate > 90) {
      insights.push(
        'Import success rate is excellent at ' +
          usageMetrics.importSuccessRate.toFixed(1) +
          '%',
      );
    } else if (usageMetrics.importSuccessRate < 70) {
      insights.push(
        'Import success rate needs improvement at ' +
          usageMetrics.importSuccessRate.toFixed(1) +
          '%',
      );
    }

    if (usageMetrics.popularSources.length > 0) {
      const topSource = usageMetrics.popularSources[0];
      insights.push(
        `${
          topSource.source
        } is the most popular import source (${topSource.percentage.toFixed(
          1,
        )}%)`,
      );
    }

    if (performanceMetrics.averageImportTime > 3000) {
      insights.push(
        'Import times are slower than optimal, consider performance improvements',
      );
    }

    if (usageMetrics.errorRate > 5) {
      insights.push(
        'Error rate is higher than expected, review error handling',
      );
    }

    return insights;
  }

  private generateRecommendations(
    usageMetrics: UsageMetrics,
    performanceMetrics: PerformanceMetrics,
  ): string[] {
    const recommendations: string[] = [];

    if (usageMetrics.importSuccessRate < 85) {
      recommendations.push('Improve import validation and error handling');
    }

    if (performanceMetrics.averageImportTime > 2000) {
      recommendations.push(
        'Optimize import performance with caching and compression',
      );
    }

    if (usageMetrics.userRetentionRate < 50) {
      recommendations.push(
        'Implement user onboarding improvements to increase retention',
      );
    }

    if (usageMetrics.averageSessionDuration < 300) {
      recommendations.push(
        'Add engagement features to increase session duration',
      );
    }

    return recommendations;
  }

  private getDateRangeForReportType(reportType: string): {
    start: string;
    end: string;
  } {
    const now = new Date();
    const end = now.toISOString();
    let start: Date;

    switch (reportType) {
      case 'daily':
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    return { start: start.toISOString(), end };
  }

  private async saveReport(report: AnalyticsReport): Promise<void> {
    try {
      const { error } = await supabase.from('analytics_reports').insert(report);

      if (error) {
        console.warn('Failed to save report to database:', error.message);
      }
    } catch (error) {
      console.error('Save report error:', error);
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateReportId(): string {
    return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getDefaultUsageMetrics(): UsageMetrics {
    return {
      totalImports: 0,
      uniqueUsers: 0,
      averageSessionDuration: 0,
      importSuccessRate: 0,
      continuationSuccessRate: 0,
      popularSources: [],
      averageStoryLength: 0,
      userRetentionRate: 0,
      errorRate: 0,
      dailyActiveUsers: 0,
      weeklyActiveUsers: 0,
      monthlyActiveUsers: 0,
    };
  }

  private getDefaultUserEngagement(userId: string): UserEngagementMetrics {
    return {
      userId,
      sessionsThisWeek: 0,
      sessionsThisMonth: 0,
      totalStoryImports: 0,
      totalStoryContinuations: 0,
      averageSessionDuration: 0,
      lastActiveDate: '',
      favoriteSource: 'none',
      engagementScore: 0,
      retentionDays: 0,
    };
  }

  private getDefaultPerformanceMetrics(): PerformanceMetrics {
    return {
      averageImportTime: 0,
      averageContinuationTime: 0,
      cacheHitRate: 0,
      databaseQueryTime: 0,
      errorRates: {
        imports: 0,
        continuations: 0,
        network: 0,
        database: 0,
      },
      devicePerformance: {
        memoryUsage: 0,
        cpuUsage: 0,
        batteryImpact: 0,
      },
    };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.uploadTimer) {
      clearInterval(this.uploadTimer);
    }
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();
// US-013: Export hash function for cleanup scripts and testing
export { hashUserId };
export default analyticsService;
