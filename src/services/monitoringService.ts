/**
 * Monitoring and Alerting Service for Story Image Generation
 * Tracks success rates, performance metrics, and system health
 */

import { supabase } from './supabase';
import { auditLogger, EventType, EventCategory, Severity } from './auditLogger';
import { xpEventTracker } from './xpEventTracker';

export interface MetricThreshold {
  metric: string;
  threshold: number;
  operator: 'greater_than' | 'less_than' | 'equals';
  severity: 'warning' | 'critical';
  description: string;
}

export interface PerformanceMetrics {
  successRate: number;
  averageResponseTime: number;
  totalRequests: number;
  errorRate: number;
  timeoutRate: number;
  uniqueUsers: number;
  averageRating?: number;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical';
  metrics: PerformanceMetrics;
  alerts: Alert[];
  lastChecked: Date;
}

export interface Alert {
  id: string;
  type:
    | 'performance'
    | 'error_rate'
    | 'success_rate'
    | 'timeout'
    | 'user_experience';
  severity: 'warning' | 'critical';
  message: string;
  metric: string;
  value: number;
  threshold: number;
  timestamp: Date;
  resolved: boolean;
}

class MonitoringService {
  private thresholds: MetricThreshold[] = [];
  private activeAlerts: Alert[] = [];
  private metricsCache: Map<
    string,
    { metrics: PerformanceMetrics; timestamp: number }
  > = new Map();
  private readonly cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.initializeThresholds();
  }

  /**
   * Initialize monitoring thresholds for image generation
   */
  private initializeThresholds(): void {
    this.thresholds = [
      {
        metric: 'success_rate',
        threshold: 80, // Below 80% success rate
        operator: 'less_than',
        severity: 'critical',
        description:
          'Image generation success rate is below acceptable threshold',
      },
      {
        metric: 'success_rate',
        threshold: 90, // Below 90% success rate
        operator: 'less_than',
        severity: 'warning',
        description: 'Image generation success rate is degraded',
      },
      {
        metric: 'average_response_time',
        threshold: 60000, // Above 60 seconds
        operator: 'greater_than',
        severity: 'warning',
        description: 'Image generation response time is too slow',
      },
      {
        metric: 'average_response_time',
        threshold: 90000, // Above 90 seconds
        operator: 'greater_than',
        severity: 'critical',
        description: 'Image generation response time is critically slow',
      },
      {
        metric: 'error_rate',
        threshold: 15, // Above 15% error rate
        operator: 'greater_than',
        severity: 'warning',
        description: 'High error rate detected in image generation',
      },
      {
        metric: 'error_rate',
        threshold: 25, // Above 25% error rate
        operator: 'greater_than',
        severity: 'critical',
        description: 'Critical error rate detected in image generation',
      },
      {
        metric: 'timeout_rate',
        threshold: 10, // Above 10% timeout rate
        operator: 'greater_than',
        severity: 'warning',
        description: 'High timeout rate detected',
      },
      {
        metric: 'average_rating',
        threshold: 3.0, // Below 3.0 average rating
        operator: 'less_than',
        severity: 'warning',
        description: 'User satisfaction ratings are below acceptable level',
      },
    ];
  }

  /**
   * Get current performance metrics for image generation with real data integration
   */
  async getPerformanceMetrics(hours: number = 24): Promise<PerformanceMetrics> {
    const cacheKey = `metrics_${hours}h`;
    const cached = this.metricsCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.metrics;
    }

    try {
      // Calculate start time for the period
      const startTime = new Date(
        Date.now() - hours * 60 * 60 * 1000,
      ).toISOString();
      const endTime = new Date().toISOString();

      // Query image generation events from database
      const { data: events, error: eventsError } = await supabase
        .from('image_generation_events')
        .select('*')
        .gte('created_at', startTime)
        .lte('created_at', endTime);

      let metrics: PerformanceMetrics;

      if (eventsError || !events || events.length === 0) {
        // Use fallback metrics if no data available
        console.log(
          '📊 No image generation events found, using fallback metrics',
        );
        metrics = {
          successRate: 0, // No data available yet
          averageResponseTime: 0,
          totalRequests: 0,
          errorRate: 0,
          timeoutRate: 0,
          uniqueUsers: 0,
          averageRating: undefined,
        };
      } else {
        // Calculate real metrics from database events
        const totalRequests = events.length;
        const successfulEvents = events.filter(
          e => e.generation_status === 'success',
        );
        const failedEvents = events.filter(
          e => e.generation_status === 'failed',
        );
        const timeoutEvents = events.filter(e => e.error_type === 'timeout');

        const uniqueUsers = new Set(events.map(e => e.user_id)).size;
        const successRate =
          totalRequests > 0
            ? (successfulEvents.length / totalRequests) * 100
            : 0;
        const errorRate =
          totalRequests > 0 ? (failedEvents.length / totalRequests) * 100 : 0;
        const timeoutRate =
          totalRequests > 0 ? (timeoutEvents.length / totalRequests) * 100 : 0;

        // Calculate average response time from successful events
        const responseTimes = events
          .filter(e => e.api_response_time_ms && e.api_response_time_ms > 0)
          .map(e => e.api_response_time_ms);
        const averageResponseTime =
          responseTimes.length > 0
            ? responseTimes.reduce((sum, time) => sum + time, 0) /
              responseTimes.length
            : 0;

        metrics = {
          successRate,
          averageResponseTime,
          totalRequests,
          errorRate,
          timeoutRate,
          uniqueUsers,
          averageRating: undefined, // Would need user feedback data
        };

        console.log('📊 Real-time metrics calculated:', {
          totalRequests,
          successRate: successRate.toFixed(2) + '%',
          averageResponseTime: (averageResponseTime / 1000).toFixed(1) + 's',
          uniqueUsers,
        });
      }

      // Cache the results
      this.metricsCache.set(cacheKey, { metrics, timestamp: Date.now() });

      return metrics;
    } catch (error: any) {
      console.error('Error fetching performance metrics:', error);

      // Return safe default metrics on error
      return {
        successRate: 0,
        averageResponseTime: 0,
        totalRequests: 0,
        errorRate: 0,
        timeoutRate: 0,
        uniqueUsers: 0,
      };
    }
  }

  /**
   * Check system health and generate alerts
   */
  async checkSystemHealth(): Promise<SystemHealth> {
    try {
      const metrics = await this.getPerformanceMetrics();
      const alerts = await this.evaluateThresholds(metrics);

      // Determine overall system status
      const status = this.determineSystemStatus(alerts);

      const health: SystemHealth = {
        status,
        metrics,
        alerts,
        lastChecked: new Date(),
      };

      // Log system health check
      auditLogger.logEvent({
        eventType: EventType.SYSTEM_HEALTH_CHECK,
        eventCategory: EventCategory.SYSTEM,
        severity:
          status === 'healthy'
            ? Severity.INFO
            : status === 'degraded'
            ? Severity.WARNING
            : Severity.ERROR,
        description: `System health check completed - Status: ${status}`,
        metadata: {
          metrics,
          alertCount: alerts.length,
          criticalAlerts: alerts.filter(a => a.severity === 'critical').length,
        },
        context: {
          timestamp: new Date(),
          action: 'health_check',
          resource: 'image_generation_system',
        },
      });

      return health;
    } catch (error: any) {
      console.error('Health check failed:', error);

      return {
        status: 'critical',
        metrics: {
          successRate: 0,
          averageResponseTime: 0,
          totalRequests: 0,
          errorRate: 100,
          timeoutRate: 0,
          uniqueUsers: 0,
        },
        alerts: [
          {
            id: `health_check_error_${Date.now()}`,
            type: 'performance',
            severity: 'critical',
            message: 'Health check system failure',
            metric: 'system_availability',
            value: 0,
            threshold: 100,
            timestamp: new Date(),
            resolved: false,
          },
        ],
        lastChecked: new Date(),
      };
    }
  }

  /**
   * Evaluate metrics against thresholds and generate alerts
   */
  private async evaluateThresholds(
    metrics: PerformanceMetrics,
  ): Promise<Alert[]> {
    const newAlerts: Alert[] = [];

    for (const threshold of this.thresholds) {
      let metricValue: number;

      // Get the metric value
      switch (threshold.metric) {
        case 'success_rate':
          metricValue = metrics.successRate;
          break;
        case 'average_response_time':
          metricValue = metrics.averageResponseTime;
          break;
        case 'error_rate':
          metricValue = metrics.errorRate;
          break;
        case 'timeout_rate':
          metricValue = metrics.timeoutRate;
          break;
        case 'average_rating':
          metricValue = metrics.averageRating || 5.0; // Default to good rating if no data
          break;
        default:
          continue;
      }

      // Check if threshold is breached
      const thresholdBreached = this.evaluateThreshold(metricValue, threshold);

      if (thresholdBreached) {
        const alertId = `${threshold.metric}_${
          threshold.severity
        }_${Date.now()}`;

        const alert: Alert = {
          id: alertId,
          type: this.getAlertType(threshold.metric),
          severity: threshold.severity,
          message: `${threshold.description} (${metricValue.toFixed(
            2,
          )} ${threshold.operator.replace('_', ' ')} ${threshold.threshold})`,
          metric: threshold.metric,
          value: metricValue,
          threshold: threshold.threshold,
          timestamp: new Date(),
          resolved: false,
        };

        newAlerts.push(alert);

        // Log the alert
        auditLogger.logEvent({
          eventType: EventType.ALERT_TRIGGERED,
          eventCategory: EventCategory.SYSTEM,
          severity:
            threshold.severity === 'critical'
              ? Severity.ERROR
              : Severity.WARNING,
          description: alert.message,
          metadata: {
            alertId: alert.id,
            metric: threshold.metric,
            value: metricValue,
            threshold: threshold.threshold,
            operator: threshold.operator,
          },
          context: {
            timestamp: new Date(),
            action: 'alert_generation',
            resource: 'monitoring_system',
          },
        });
      }
    }

    // Update active alerts
    this.updateActiveAlerts(newAlerts);

    return this.activeAlerts;
  }

  /**
   * Evaluate a single threshold
   */
  private evaluateThreshold(
    value: number,
    threshold: MetricThreshold,
  ): boolean {
    switch (threshold.operator) {
      case 'greater_than':
        return value > threshold.threshold;
      case 'less_than':
        return value < threshold.threshold;
      case 'equals':
        return value === threshold.threshold;
      default:
        return false;
    }
  }

  /**
   * Get alert type based on metric
   */
  private getAlertType(metric: string): Alert['type'] {
    if (metric.includes('success_rate')) return 'success_rate';
    if (metric.includes('error_rate')) return 'error_rate';
    if (metric.includes('timeout')) return 'timeout';
    if (metric.includes('response_time')) return 'performance';
    if (metric.includes('rating')) return 'user_experience';
    return 'performance';
  }

  /**
   * Update active alerts list
   */
  private updateActiveAlerts(newAlerts: Alert[]): void {
    // Remove resolved alerts (alerts that are no longer triggered)
    const currentAlertKeys = new Set(
      newAlerts.map(a => `${a.metric}_${a.severity}`),
    );

    this.activeAlerts = this.activeAlerts.filter(alert => {
      const alertKey = `${alert.metric}_${alert.severity}`;
      if (!currentAlertKeys.has(alertKey)) {
        // Mark as resolved
        alert.resolved = true;
        return false;
      }
      return true;
    });

    // Add new alerts
    for (const newAlert of newAlerts) {
      const exists = this.activeAlerts.some(
        a => a.metric === newAlert.metric && a.severity === newAlert.severity,
      );

      if (!exists) {
        this.activeAlerts.push(newAlert);
      }
    }
  }

  /**
   * Determine overall system status based on alerts
   */
  private determineSystemStatus(alerts: Alert[]): SystemHealth['status'] {
    const criticalAlerts = alerts.filter(
      a => a.severity === 'critical' && !a.resolved,
    );
    const warningAlerts = alerts.filter(
      a => a.severity === 'warning' && !a.resolved,
    );

    if (criticalAlerts.length > 0) {
      return 'critical';
    } else if (warningAlerts.length > 0) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }

  /**
   * Get rollout analytics with real first-week success metrics
   */
  async getRolloutAnalytics(days: number = 7): Promise<{
    dailyMetrics: Array<{
      date: string;
      successRate: number;
      totalRequests: number;
      uniqueUsers: number;
      averageRating?: number;
    }>;
    overallTrend: 'improving' | 'stable' | 'degrading';
    recommendation: string;
  }> {
    try {
      const dailyMetrics: Array<{
        date: string;
        successRate: number;
        totalRequests: number;
        uniqueUsers: number;
        averageRating?: number;
      }> = [];

      // Get data for each day in the range
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        // Query events for this specific day
        const { data: dayEvents, error } = await supabase
          .from('image_generation_events')
          .select('*')
          .gte('created_at', startOfDay.toISOString())
          .lte('created_at', endOfDay.toISOString());

        if (error) {
          console.warn(`Failed to fetch data for ${dateStr}:`, error);
          dailyMetrics.push({
            date: dateStr,
            successRate: 0,
            totalRequests: 0,
            uniqueUsers: 0,
            averageRating: undefined,
          });
          continue;
        }

        const events = dayEvents || [];
        const totalRequests = events.length;
        const successfulEvents = events.filter(
          e => e.generation_status === 'success',
        );
        const uniqueUsers = new Set(events.map(e => e.user_id)).size;
        const successRate =
          totalRequests > 0
            ? (successfulEvents.length / totalRequests) * 100
            : 0;

        dailyMetrics.push({
          date: dateStr,
          successRate,
          totalRequests,
          uniqueUsers,
          averageRating: undefined, // Would integrate with user feedback
        });
      }

      // Calculate trend analysis
      const overallTrend = this.calculateTrend(dailyMetrics);
      const recommendation = this.generateRolloutRecommendation(
        dailyMetrics,
        overallTrend,
      );

      console.log('📈 Rollout Analytics:', {
        period: `${days} days`,
        totalDays: dailyMetrics.length,
        trend: overallTrend,
        latestMetrics: dailyMetrics[dailyMetrics.length - 1],
      });

      return {
        dailyMetrics,
        overallTrend,
        recommendation,
      };
    } catch (error: any) {
      console.error('Failed to get rollout analytics:', error);
      return {
        dailyMetrics: [],
        overallTrend: 'stable',
        recommendation:
          'Unable to retrieve analytics data. Monitor manually and retry.',
      };
    }
  }

  /**
   * Generate monitoring report
   */
  async generateMonitoringReport(): Promise<{
    summary: string;
    health: SystemHealth;
    recommendations: string[];
    actionItems: string[];
  }> {
    const health = await this.checkSystemHealth();
    const analytics = await this.getRolloutAnalytics();

    const recommendations: string[] = [];
    const actionItems: string[] = [];

    // Generate recommendations based on health status
    if (health.status === 'critical') {
      recommendations.push('🚨 CRITICAL: Immediate investigation required');
      actionItems.push('Investigate and resolve critical alerts');
      actionItems.push('Consider rolling back if issues persist');
    } else if (health.status === 'degraded') {
      recommendations.push('⚠️ WARNING: System is degraded but operational');
      actionItems.push('Monitor closely and address warning alerts');
      actionItems.push('Delay rollout increases until issues are resolved');
    } else {
      recommendations.push('✅ HEALTHY: System is operating normally');
      actionItems.push('Continue monitoring');
      if (health.metrics.successRate > 95) {
        actionItems.push('Consider increasing rollout percentage');
      }
    }

    // Add trend-based recommendations
    recommendations.push(analytics.recommendation);

    const summary = `
System Status: ${health.status.toUpperCase()}
Success Rate: ${health.metrics.successRate.toFixed(1)}%
Average Response Time: ${(health.metrics.averageResponseTime / 1000).toFixed(
      1,
    )}s
Total Requests (24h): ${health.metrics.totalRequests}
Active Alerts: ${health.alerts.filter(a => !a.resolved).length}
Trend: ${analytics.overallTrend}
    `.trim();

    return {
      summary,
      health,
      recommendations,
      actionItems,
    };
  }

  /**
   * Get first week success metrics with detailed breakdown
   */
  async getFirstWeekSuccessMetrics(): Promise<{
    weekOverview: {
      totalGenerations: number;
      successRate: number;
      uniqueUsers: number;
      totalXPSpent: number;
      averageResponseTime: number;
    };
    dailyBreakdown: Array<{
      day: number;
      date: string;
      generations: number;
      successRate: number;
      users: number;
      avgResponseTime: number;
    }>;
    keyInsights: string[];
    actionItems: string[];
  }> {
    try {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const now = new Date();

      // Get all events from the past week
      const { data: weekEvents, error } = await supabase
        .from('image_generation_events')
        .select('*')
        .gte('created_at', weekAgo.toISOString())
        .lte('created_at', now.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Database query failed: ${error.message}`);
      }

      const events = weekEvents || [];

      // Calculate week overview
      const totalGenerations = events.length;
      const successfulGenerations = events.filter(
        e => e.generation_status === 'success',
      ).length;
      const successRate =
        totalGenerations > 0
          ? (successfulGenerations / totalGenerations) * 100
          : 0;
      const uniqueUsers = new Set(events.map(e => e.user_id)).size;
      const totalXPSpent = events.reduce((sum, e) => sum + (e.xp_cost || 0), 0);

      const responseTimes = events
        .filter(e => e.api_response_time_ms && e.api_response_time_ms > 0)
        .map(e => e.api_response_time_ms);
      const averageResponseTime =
        responseTimes.length > 0
          ? responseTimes.reduce((sum, time) => sum + time, 0) /
            responseTimes.length
          : 0;

      // Calculate daily breakdown
      const dailyBreakdown = [];
      for (let i = 6; i >= 0; i--) {
        const day = new Date(now);
        day.setDate(now.getDate() - i);
        const dayStart = new Date(day);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(day);
        dayEnd.setHours(23, 59, 59, 999);

        const dayEvents = events.filter(e => {
          const eventDate = new Date(e.created_at);
          return eventDate >= dayStart && eventDate <= dayEnd;
        });

        const dayGenerations = dayEvents.length;
        const daySuccessful = dayEvents.filter(
          e => e.generation_status === 'success',
        ).length;
        const daySuccessRate =
          dayGenerations > 0 ? (daySuccessful / dayGenerations) * 100 : 0;
        const dayUsers = new Set(dayEvents.map(e => e.user_id)).size;

        const dayResponseTimes = dayEvents
          .filter(e => e.api_response_time_ms && e.api_response_time_ms > 0)
          .map(e => e.api_response_time_ms);
        const avgResponseTime =
          dayResponseTimes.length > 0
            ? dayResponseTimes.reduce((sum, time) => sum + time, 0) /
              dayResponseTimes.length
            : 0;

        dailyBreakdown.push({
          day: 7 - i,
          date: day.toISOString().split('T')[0],
          generations: dayGenerations,
          successRate: daySuccessRate,
          users: dayUsers,
          avgResponseTime,
        });
      }

      // Generate insights and action items
      const keyInsights = this.generateFirstWeekInsights({
        totalGenerations,
        successRate,
        uniqueUsers,
        averageResponseTime,
        dailyBreakdown,
      });

      const actionItems = this.generateFirstWeekActionItems({
        totalGenerations,
        successRate,
        uniqueUsers,
        averageResponseTime,
        events,
      });

      const metrics = {
        weekOverview: {
          totalGenerations,
          successRate,
          uniqueUsers,
          totalXPSpent,
          averageResponseTime,
        },
        dailyBreakdown,
        keyInsights,
        actionItems,
      };

      console.log('📊 First Week Success Metrics:', {
        totalGenerations,
        successRate: successRate.toFixed(1) + '%',
        uniqueUsers,
        avgResponseTime: (averageResponseTime / 1000).toFixed(1) + 's',
      });

      return metrics;
    } catch (error: any) {
      console.error('Failed to get first week metrics:', error);
      return {
        weekOverview: {
          totalGenerations: 0,
          successRate: 0,
          uniqueUsers: 0,
          totalXPSpent: 0,
          averageResponseTime: 0,
        },
        dailyBreakdown: [],
        keyInsights: ['Unable to retrieve first week metrics'],
        actionItems: ['Check database connectivity and retry analytics'],
      };
    }
  }

  /**
   * Calculate trend from daily metrics
   */
  private calculateTrend(
    dailyMetrics: Array<{ successRate: number; totalRequests: number }>,
  ): 'improving' | 'stable' | 'degrading' {
    if (dailyMetrics.length < 3) return 'stable';

    const recentMetrics = dailyMetrics.slice(-3);
    const validMetrics = recentMetrics.filter(m => m.totalRequests > 0);

    if (validMetrics.length < 2) return 'stable';

    const firstRate = validMetrics[0].successRate;
    const lastRate = validMetrics[validMetrics.length - 1].successRate;
    const difference = lastRate - firstRate;

    if (difference > 5) return 'improving';
    if (difference < -5) return 'degrading';
    return 'stable';
  }

  /**
   * Generate rollout recommendation based on metrics
   */
  private generateRolloutRecommendation(
    dailyMetrics: any[],
    trend: string,
  ): string {
    const latestDay = dailyMetrics[dailyMetrics.length - 1];
    const totalRequests = dailyMetrics.reduce(
      (sum, day) => sum + day.totalRequests,
      0,
    );

    if (totalRequests === 0) {
      return 'No usage data available yet. Continue monitoring for first week baseline.';
    }

    if (latestDay.successRate >= 90 && trend === 'improving') {
      return '✅ Excellent performance! Consider increasing rollout to next percentage tier.';
    }

    if (latestDay.successRate >= 80 && trend !== 'degrading') {
      return '📈 Good performance. Continue current rollout and monitor closely.';
    }

    if (latestDay.successRate < 70 || trend === 'degrading') {
      return '⚠️ Performance concerns detected. Hold rollout and investigate issues.';
    }

    return '📊 Stable performance. Continue monitoring and maintain current rollout level.';
  }

  /**
   * Generate insights for first week performance
   */
  private generateFirstWeekInsights(metrics: any): string[] {
    const insights = [];

    if (metrics.totalGenerations === 0) {
      insights.push('No image generation attempts recorded in first week');
      insights.push(
        'Consider user education or feature promotion to increase adoption',
      );
    } else {
      if (metrics.successRate >= 95) {
        insights.push(
          `Excellent success rate of ${metrics.successRate.toFixed(
            1,
          )}% indicates stable service`,
        );
      } else if (metrics.successRate >= 85) {
        insights.push(
          `Good success rate of ${metrics.successRate.toFixed(
            1,
          )}% with room for improvement`,
        );
      } else {
        insights.push(
          `Success rate of ${metrics.successRate.toFixed(
            1,
          )}% requires immediate attention`,
        );
      }

      if (metrics.uniqueUsers > 0) {
        const generationsPerUser =
          metrics.totalGenerations / metrics.uniqueUsers;
        insights.push(
          `${generationsPerUser.toFixed(
            1,
          )} average generations per user shows ${
            generationsPerUser > 2 ? 'high' : 'moderate'
          } engagement`,
        );
      }

      if (metrics.averageResponseTime > 60000) {
        insights.push(
          `Response time of ${(metrics.averageResponseTime / 1000).toFixed(
            1,
          )}s exceeds target, affecting user experience`,
        );
      } else if (metrics.averageResponseTime > 0) {
        insights.push(
          `Response time of ${(metrics.averageResponseTime / 1000).toFixed(
            1,
          )}s is within acceptable range`,
        );
      }
    }

    return insights;
  }

  /**
   * Generate action items for first week performance
   */
  private generateFirstWeekActionItems(metrics: any): string[] {
    const actionItems = [];

    if (metrics.totalGenerations === 0) {
      actionItems.push(
        'Verify feature flag is enabled and users can access image generation',
      );
      actionItems.push('Check user onboarding flow and XP requirements');
      actionItems.push('Review feature discoverability in UI');
    } else {
      if (metrics.successRate < 90) {
        actionItems.push('Investigate common failure patterns and error types');
        actionItems.push('Review API timeout settings and failover mechanisms');
      }

      if (metrics.averageResponseTime > 45000) {
        actionItems.push(
          'Optimize API performance and consider timeout adjustments',
        );
      }

      if (metrics.uniqueUsers < 10) {
        actionItems.push(
          'Increase user awareness through in-app messaging or tutorials',
        );
      }

      const errorEvents =
        metrics.events?.filter((e: any) => e.generation_status === 'failed') ||
        [];
      if (errorEvents.length > 0) {
        actionItems.push(
          `Review ${errorEvents.length} failed generation events for improvement opportunities`,
        );
      }
    }

    actionItems.push('Continue daily monitoring and prepare week 2 analysis');
    return actionItems;
  }

  /**
   * Clear resolved alerts
   */
  clearResolvedAlerts(): number {
    const beforeCount = this.activeAlerts.length;
    this.activeAlerts = this.activeAlerts.filter(alert => !alert.resolved);
    return beforeCount - this.activeAlerts.length;
  }

  /**
   * Get current active alerts
   */
  getActiveAlerts(): Alert[] {
    return this.activeAlerts.filter(alert => !alert.resolved);
  }
}

// Export singleton instance
export const monitoringService = new MonitoringService();

export default monitoringService;
