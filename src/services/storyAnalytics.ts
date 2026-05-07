// Story Analytics Service
// Comprehensive analytics for story generation metrics and user behavior

import AsyncStorage from '@react-native-async-storage/async-storage';
import { GradeLevel } from '../types';

export interface StoryGenerationEvent {
  eventType:
    | 'story_started'
    | 'story_continued'
    | 'story_completed'
    | 'story_abandoned';
  timestamp: number;
  sessionId: string;
  userId: string;
  gradeLevel: GradeLevel;
  metadata: {
    genre?: string;
    theme?: string;
    wordCount?: number;
    sessionDuration?: number;
    qualityScore?: number;
    userSatisfaction?: number;
    aiResponseTime?: number;
    fallbackUsed?: boolean;
    errorOccurred?: boolean;
    errorType?: string;
  };
}

export interface UserBehaviorEvent {
  eventType:
    | 'input_started'
    | 'input_paused'
    | 'input_resumed'
    | 'voice_used'
    | 'tts_used';
  timestamp: number;
  sessionId: string;
  userId: string;
  metadata: {
    inputLength?: number;
    pauseDuration?: number;
    voiceAccuracy?: number;
    featureUsed?: string;
  };
}

export interface PerformanceEvent {
  eventType:
    | 'api_call'
    | 'cache_hit'
    | 'cache_miss'
    | 'render_time'
    | 'memory_warning';
  timestamp: number;
  metadata: {
    duration?: number;
    endpoint?: string;
    cacheKey?: string;
    memoryUsage?: number;
    errorDetails?: string;
  };
}

export interface AnalyticsMetrics {
  storyGeneration: {
    totalStories: number;
    completedStories: number;
    averageWordCount: number;
    averageSessionDuration: number;
    averageQualityScore: number;
    completionRate: number;
    errorRate: number;
    fallbackUsageRate: number;
  };
  userEngagement: {
    dailyActiveUsers: number;
    averageSessionTime: number;
    voiceUsageRate: number;
    ttsUsageRate: number;
    retentionRate: number;
  };
  performance: {
    averageApiResponseTime: number;
    cacheHitRate: number;
    averageRenderTime: number;
    errorFrequency: number;
  };
  gradeLevelBreakdown: Record<
    GradeLevel,
    {
      usage: number;
      satisfaction: number;
      completionRate: number;
    }
  >;
}

class StoryAnalyticsService {
  private readonly EVENTS_KEY = '@CreativeBridge:analytics_events';
  private readonly METRICS_KEY = '@CreativeBridge:analytics_metrics';
  private readonly USER_METRICS_KEY = '@CreativeBridge:user_metrics';

  private eventQueue: Array<
    StoryGenerationEvent | UserBehaviorEvent | PerformanceEvent
  > = [];
  private metrics: AnalyticsMetrics;
  private flushTimer: NodeJS.Timeout | null = null;
  private userSession: {
    sessionId: string;
    userId: string;
    startTime: number;
    events: number;
  } | null = null;

  constructor() {
    this.metrics = this.getDefaultMetrics();
    this.initializeAnalytics();
  }

  // Initialize analytics system
  private async initializeAnalytics(): Promise<void> {
    try {
      // Load existing metrics
      const storedMetrics = await AsyncStorage.getItem(this.METRICS_KEY);
      if (storedMetrics) {
        this.metrics = { ...this.metrics, ...JSON.parse(storedMetrics) };
      }

      // Start periodic flush
      this.startPeriodicFlush();

      // Set up session tracking
      this.setupSessionTracking();
    } catch (error) {
      console.error('Failed to initialize analytics:', error);
    }
  }

  // Track story generation events
  public trackStoryEvent(
    eventType: StoryGenerationEvent['eventType'],
    sessionId: string,
    userId: string,
    gradeLevel: GradeLevel,
    metadata: StoryGenerationEvent['metadata'] = {},
  ): void {
    const event: StoryGenerationEvent = {
      eventType,
      timestamp: Date.now(),
      sessionId,
      userId,
      gradeLevel,
      metadata,
    };

    this.eventQueue.push(event);
    this.updateStoryMetrics(event);
    this.incrementUserSessionEvents();
  }

  // Track user behavior events
  public trackUserBehavior(
    eventType: UserBehaviorEvent['eventType'],
    sessionId: string,
    userId: string,
    metadata: UserBehaviorEvent['metadata'] = {},
  ): void {
    const event: UserBehaviorEvent = {
      eventType,
      timestamp: Date.now(),
      sessionId,
      userId,
      metadata,
    };

    this.eventQueue.push(event);
    this.updateUserBehaviorMetrics(event);
    this.incrementUserSessionEvents();
  }

  // Track performance events
  public trackPerformance(
    eventType: PerformanceEvent['eventType'],
    metadata: PerformanceEvent['metadata'] = {},
  ): void {
    const event: PerformanceEvent = {
      eventType,
      timestamp: Date.now(),
      metadata,
    };

    this.eventQueue.push(event);
    this.updatePerformanceMetrics(event);
  }

  // Update story generation metrics
  private updateStoryMetrics(event: StoryGenerationEvent): void {
    const { eventType, gradeLevel, metadata } = event;

    switch (eventType) {
      case 'story_started':
        this.metrics.storyGeneration.totalStories++;
        this.metrics.gradeLevelBreakdown[gradeLevel].usage++;
        break;

      case 'story_completed':
        this.metrics.storyGeneration.completedStories++;

        if (metadata.wordCount) {
          this.updateAverage(
            'averageWordCount',
            metadata.wordCount,
            this.metrics.storyGeneration.totalStories,
          );
        }

        if (metadata.sessionDuration) {
          this.updateAverage(
            'averageSessionDuration',
            metadata.sessionDuration,
            this.metrics.storyGeneration.totalStories,
          );
        }

        if (metadata.qualityScore) {
          this.updateAverage(
            'averageQualityScore',
            metadata.qualityScore,
            this.metrics.storyGeneration.totalStories,
          );
          this.updateGradeLevelSatisfaction(gradeLevel, metadata.qualityScore);
        }

        this.updateGradeLevelCompletion(gradeLevel);
        break;

      case 'story_abandoned':
        // Track abandonment for completion rate calculation
        break;
    }

    if (metadata.fallbackUsed) {
      this.updateRate('fallbackUsageRate');
    }

    if (metadata.errorOccurred) {
      this.updateRate('errorRate');
    }

    // Recalculate completion rate
    this.metrics.storyGeneration.completionRate =
      this.metrics.storyGeneration.totalStories > 0
        ? this.metrics.storyGeneration.completedStories /
          this.metrics.storyGeneration.totalStories
        : 0;
  }

  // Update user behavior metrics
  private updateUserBehaviorMetrics(event: UserBehaviorEvent): void {
    const { eventType } = event;

    switch (eventType) {
      case 'voice_used':
        this.updateRate('voiceUsageRate');
        break;

      case 'tts_used':
        this.updateRate('ttsUsageRate');
        break;

      case 'input_started':
      case 'input_resumed':
        // Track engagement patterns
        break;
    }
  }

  // Update performance metrics
  private updatePerformanceMetrics(event: PerformanceEvent): void {
    const { eventType, metadata } = event;

    switch (eventType) {
      case 'api_call':
        if (metadata.duration) {
          this.updateAverage(
            'averageApiResponseTime',
            metadata.duration,
            this.getApiCallCount(),
          );
        }
        break;

      case 'cache_hit':
        this.updateCacheHitRate(true);
        break;

      case 'cache_miss':
        this.updateCacheHitRate(false);
        break;

      case 'render_time':
        if (metadata.duration) {
          this.updateAverage(
            'averageRenderTime',
            metadata.duration,
            this.getRenderCount(),
          );
        }
        break;

      case 'memory_warning':
        this.metrics.performance.errorFrequency++;
        break;
    }
  }

  // Update grade level satisfaction
  private updateGradeLevelSatisfaction(
    gradeLevel: GradeLevel,
    satisfaction: number,
  ): void {
    const current = this.metrics.gradeLevelBreakdown[gradeLevel].satisfaction;
    const usage = this.metrics.gradeLevelBreakdown[gradeLevel].usage;

    this.metrics.gradeLevelBreakdown[gradeLevel].satisfaction =
      (current * (usage - 1) + satisfaction) / usage;
  }

  // Update grade level completion rate
  private updateGradeLevelCompletion(gradeLevel: GradeLevel): void {
    this.metrics.gradeLevelBreakdown[gradeLevel].completionRate++;
  }

  // Update cache hit rate
  private updateCacheHitRate(isHit: boolean): void {
    // This is a simplified calculation - in practice you'd track total cache requests
    const currentRate = this.metrics.performance.cacheHitRate;
    const adjustment = isHit ? 0.01 : -0.01;
    this.metrics.performance.cacheHitRate = Math.max(
      0,
      Math.min(1, currentRate + adjustment),
    );
  }

  // Helper method to update averages
  private updateAverage(
    metricPath: string,
    newValue: number,
    count: number,
  ): void {
    const pathParts = metricPath.split('.');
    let target = this.metrics as any;

    for (let i = 0; i < pathParts.length - 1; i++) {
      target = target[pathParts[i]];
    }

    const lastPart = pathParts[pathParts.length - 1];
    const currentAverage = target[lastPart];

    target[lastPart] = (currentAverage * (count - 1) + newValue) / count;
  }

  // Helper method to update rates
  private updateRate(ratePath: string): void {
    // Simplified rate calculation - increment by small amount
    const pathParts = ratePath.split('.');
    let target = this.metrics as any;

    for (let i = 0; i < pathParts.length - 1; i++) {
      target = target[pathParts[i]];
    }

    const lastPart = pathParts[pathParts.length - 1];
    target[lastPart] = Math.min(1, target[lastPart] + 0.01);
  }

  // Get API call count (simplified)
  private getApiCallCount(): number {
    return Math.max(
      1,
      this.eventQueue.filter(
        e => (e as PerformanceEvent).eventType === 'api_call',
      ).length,
    );
  }

  // Get render count (simplified)
  private getRenderCount(): number {
    return Math.max(
      1,
      this.eventQueue.filter(
        e => (e as PerformanceEvent).eventType === 'render_time',
      ).length,
    );
  }

  // Start user session tracking
  public startSession(userId: string): string {
    const sessionId = `session_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    this.userSession = {
      sessionId,
      userId,
      startTime: Date.now(),
      events: 0,
    };

    this.trackUserBehavior('input_started', sessionId, userId);
    return sessionId;
  }

  // End user session
  public endSession(): void {
    if (!this.userSession) return;

    const sessionDuration = Date.now() - this.userSession.startTime;

    // Update average session time
    this.updateAverage(
      'averageSessionTime',
      sessionDuration,
      this.getDailyActiveUsers(),
    );

    this.userSession = null;
  }

  // Increment session events
  private incrementUserSessionEvents(): void {
    if (this.userSession) {
      this.userSession.events++;
    }
  }

  // Get daily active users (simplified)
  private getDailyActiveUsers(): number {
    const today = new Date().toDateString();
    const todayEvents = this.eventQueue.filter(
      event => new Date(event.timestamp).toDateString() === today,
    );

    const uniqueUsers = new Set(
      todayEvents
        .filter(event => 'userId' in event)
        .map(
          event => (event as StoryGenerationEvent | UserBehaviorEvent).userId,
        ),
    );

    return Math.max(1, uniqueUsers.size);
  }

  // Set up session tracking
  private setupSessionTracking(): void {
    // Track app foreground/background events if available
    // This would integrate with AppState in a real implementation
  }

  // Start periodic flush of events
  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flushEvents();
    }, 60000); // Flush every minute
  }

  // Flush events to storage
  private async flushEvents(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    try {
      // Store events
      const existingEvents = await AsyncStorage.getItem(this.EVENTS_KEY);
      const events = existingEvents ? JSON.parse(existingEvents) : [];

      events.push(...this.eventQueue);

      // Keep only recent events (last 1000)
      const recentEvents = events.slice(-1000);

      await Promise.all([
        AsyncStorage.setItem(this.EVENTS_KEY, JSON.stringify(recentEvents)),
        AsyncStorage.setItem(this.METRICS_KEY, JSON.stringify(this.metrics)),
      ]);

      // Clear the queue
      this.eventQueue = [];
    } catch (error) {
      console.error('Failed to flush analytics events:', error);
    }
  }

  // Generate analytics report
  public async generateReport(
    timeRange: 'day' | 'week' | 'month' = 'week',
  ): Promise<{
    metrics: AnalyticsMetrics;
    insights: string[];
    recommendations: string[];
  }> {
    const cutoffTime = this.getCutoffTime(timeRange);
    const recentEvents = this.eventQueue.filter(
      event => event.timestamp > cutoffTime,
    );

    const insights = this.generateInsights(recentEvents);
    const recommendations = this.generateRecommendations();

    return {
      metrics: this.metrics,
      insights,
      recommendations,
    };
  }

  // Get cutoff time for time range
  private getCutoffTime(timeRange: 'day' | 'week' | 'month'): number {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    switch (timeRange) {
      case 'day':
        return now - day;
      case 'week':
        return now - 7 * day;
      case 'month':
        return now - 30 * day;
    }
  }

  // Generate insights from events
  private generateInsights(
    events: Array<StoryGenerationEvent | UserBehaviorEvent | PerformanceEvent>,
  ): string[] {
    const insights: string[] = [];

    // Story completion insights
    const storyEvents = events.filter(
      e => 'gradeLevel' in e,
    ) as StoryGenerationEvent[];
    const completedStories = storyEvents.filter(
      e => e.eventType === 'story_completed',
    ).length;
    const totalStories = storyEvents.filter(
      e => e.eventType === 'story_started',
    ).length;

    if (totalStories > 0) {
      const completionRate = completedStories / totalStories;
      if (completionRate > 0.8) {
        insights.push(
          'High story completion rate indicates strong user engagement',
        );
      } else if (completionRate < 0.3) {
        insights.push(
          'Low completion rate suggests users may need more guidance or simpler stories',
        );
      }
    }

    // Performance insights
    const performanceEvents = events.filter(
      e => !('userId' in e),
    ) as PerformanceEvent[];
    const apiCalls = performanceEvents.filter(e => e.eventType === 'api_call');

    if (apiCalls.length > 0) {
      const avgResponseTime =
        apiCalls.reduce((sum, e) => sum + (e.metadata.duration || 0), 0) /
        apiCalls.length;
      if (avgResponseTime > 3000) {
        insights.push(
          'API response times are slower than optimal, affecting user experience',
        );
      }
    }

    // Usage pattern insights
    const userEvents = events.filter(e => 'userId' in e) as (
      | StoryGenerationEvent
      | UserBehaviorEvent
    )[];
    const voiceUsage = userEvents.filter(
      e => e.eventType === 'voice_used',
    ).length;
    const totalUserEvents = userEvents.length;

    if (totalUserEvents > 0 && voiceUsage / totalUserEvents > 0.3) {
      insights.push(
        'High voice feature usage indicates strong accessibility adoption',
      );
    }

    return insights;
  }

  // Generate recommendations
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    // Performance recommendations
    if (this.metrics.performance.cacheHitRate < 0.6) {
      recommendations.push(
        'Improve caching strategy to reduce API calls and improve performance',
      );
    }

    if (this.metrics.performance.averageApiResponseTime > 2000) {
      recommendations.push(
        'Optimize API endpoints or implement request batching to improve response times',
      );
    }

    // User experience recommendations
    if (this.metrics.storyGeneration.completionRate < 0.5) {
      recommendations.push(
        'Consider adding progress indicators or breaking stories into shorter segments',
      );
    }

    if (this.metrics.userEngagement.voiceUsageRate < 0.1) {
      recommendations.push(
        'Promote voice features through onboarding or tutorials',
      );
    }

    // Grade level recommendations
    const gradeLevels = Object.entries(this.metrics.gradeLevelBreakdown);
    const lowSatisfactionLevels = gradeLevels.filter(
      ([_, data]) => data.satisfaction < 0.6,
    );

    if (lowSatisfactionLevels.length > 0) {
      recommendations.push(
        `Improve content quality for grade levels: ${lowSatisfactionLevels
          .map(([level]) => level)
          .join(', ')}`,
      );
    }

    return recommendations;
  }

  // Get default metrics structure
  private getDefaultMetrics(): AnalyticsMetrics {
    return {
      storyGeneration: {
        totalStories: 0,
        completedStories: 0,
        averageWordCount: 0,
        averageSessionDuration: 0,
        averageQualityScore: 0,
        completionRate: 0,
        errorRate: 0,
        fallbackUsageRate: 0,
      },
      userEngagement: {
        dailyActiveUsers: 0,
        averageSessionTime: 0,
        voiceUsageRate: 0,
        ttsUsageRate: 0,
        retentionRate: 0,
      },
      performance: {
        averageApiResponseTime: 0,
        cacheHitRate: 0.5,
        averageRenderTime: 0,
        errorFrequency: 0,
      },
      gradeLevelBreakdown: {
        'K-2': { usage: 0, satisfaction: 0, completionRate: 0 },
        '3-5': { usage: 0, satisfaction: 0, completionRate: 0 },
        '6-8': { usage: 0, satisfaction: 0, completionRate: 0 },
        '9-12': { usage: 0, satisfaction: 0, completionRate: 0 },
      },
    };
  }

  // Public API methods
  public getMetrics(): AnalyticsMetrics {
    return { ...this.metrics };
  }

  public async exportData(): Promise<string> {
    const allEvents = await AsyncStorage.getItem(this.EVENTS_KEY);
    return allEvents || '[]';
  }

  public async clearData(): Promise<void> {
    this.eventQueue = [];
    this.metrics = this.getDefaultMetrics();

    await Promise.all([
      AsyncStorage.removeItem(this.EVENTS_KEY),
      AsyncStorage.removeItem(this.METRICS_KEY),
      AsyncStorage.removeItem(this.USER_METRICS_KEY),
    ]);
  }

  // Cleanup
  public destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Flush remaining events
    this.flushEvents();
  }
}

export const storyAnalytics = new StoryAnalyticsService();
export default StoryAnalyticsService;
