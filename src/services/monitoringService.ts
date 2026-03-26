/**
 * Monitoring and Alerting Service for Story Image Generation
 * Tracks success rates, performance metrics, and system health
 *
 * MIGRATION NOTE: Supabase queries replaced with in-memory metrics tracking.
 * Feed data via ingestEvents() from Convex query results (useQuery hooks in components).
 * Convex queries: getImageGenerationAnalytics, getDailyImageGenerationStats
 */

import { auditLogger, EventType, EventCategory, Severity } from './auditLogger';

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

export interface ImageGenerationEvent {
  id: string;
  userId: string;
  generationStatus: 'pending' | 'success' | 'failed';
  errorType?: string;
  apiResponseTimeMs?: number;
  xpCost?: number;
  createdAt: string;
}

class MonitoringService {
  private thresholds: MetricThreshold[] = [];
  private activeAlerts: Alert[] = [];
  private metricsCache: Map<
    string,
    { metrics: PerformanceMetrics; timestamp: number }
  > = new Map();
  private readonly cacheTimeout = 5 * 60 * 1000; // 5 minutes
  private ingestedEvents: ImageGenerationEvent[] = [];

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
        threshold: 80,
        operator: 'less_than',
        severity: 'critical',
        description:
          'Image generation success rate is below acceptable threshold',
      },
      {
        metric: 'success_rate',
        threshold: 90,
        operator: 'less_than',
        severity: 'warning',
        description: 'Image generation success rate is degraded',
      },
      {
        metric: 'average_response_time',
        threshold: 60000,
        operator: 'greater_than',
        severity: 'warning',
        description: 'Image generation response time is too slow',
      },
      {
        metric: 'average_response_time',
        threshold: 90000,
        operator: 'greater_than',
        severity: 'critical',
        description: 'Image generation response time is critically slow',
      },
      {
        metric: 'error_rate',
        threshold: 15,
        operator: 'greater_than',
        severity: 'warning',
        description: 'High error rate detected in image generation',
      },
      {
        metric: 'error_rate',
        threshold: 25,
        operator: 'greater_than',
        severity: 'critical',
        description: 'Critical error rate detected in image generation',
      },
      {
        metric: 'timeout_rate',
        threshold: 10,
        operator: 'greater_than',
        severity: 'warning',
        description: 'High timeout rate detected',
      },
      {
        metric: 'average_rating',
        threshold: 3.0,
        operator: 'less_than',
        severity: 'warning',
        description: 'User satisfaction ratings are below acceptable level',
      },
    ];
  }

  /**
   * Ingest events from Convex query results.
   * Call this from React components that useQuery(api.imageGeneration.getImageGenerationAnalytics).
   */
  ingestEvents(events: ImageGenerationEvent[]): void {
    this.ingestedEvents = events;
    this.metricsCache.clear();
  }

  /**
   * Get current performance metrics for image generation
   */
  async getPerformanceMetrics(hours: number = 24): Promise<PerformanceMetrics> {
    const cacheKey = `metrics_${hours}h`;
    const cached = this.metricsCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.metrics;
    }

    try {
      const startTime = Date.now() - hours * 60 * 60 * 1000;
      const events = this.ingestedEvents.filter(
        e => new Date(e.createdAt).getTime() >= startTime,
      );

      let metrics: PerformanceMetrics;

      if (events.length === 0) {
        console.log(
          '📊 No image generation events found, using fallback metrics',
        );
        metrics = {
          successRate: 0,
          averageResponseTime: 0,
          totalRequests: 0,
          errorRate: 0,
          timeoutRate: 0,
          uniqueUsers: 0,
          averageRating: undefined,
        };
      } else {
        const totalRequests = events.length;
        const successfulEvents = events.filter(
          e => e.generationStatus === 'success',
        );
        const failedEvents = events.filter(
          e => e.generationStatus === 'failed',
        );
        const timeoutEvents = events.filter(e => e.errorType === 'timeout');

        const uniqueUsers = new Set(events.map(e => e.userId)).size;
        const successRate =
          totalRequests > 0
            ? (successfulEvents.length / totalRequests) * 100
            : 0;
        const errorRate =
          totalRequests > 0 ? (failedEvents.length / totalRequests) * 100 : 0;
        const timeoutRate =
          totalRequests > 0 ? (timeoutEvents.length / totalRequests) * 100 : 0;

        const responseTimes = events
          .filter(e => e.apiResponseTimeMs && e.apiResponseTimeMs > 0)
          .map(e => e.apiResponseTimeMs!);
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
          averageRating: undefined,
        };

        console.log('📊 Real-time metrics calculated:', {
          totalRequests,
          successRate: successRate.toFixed(2) + '%',
          averageResponseTime: (averageResponseTime / 1000).toFixed(1) + 's',
          uniqueUsers,
        });
      }

      this.metricsCache.set(cacheKey, { metrics, timestamp: Date.now() });

      return metrics;
    } catch (error: any) {
      console.error('Error fetching performance metrics:', error);

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

      const status = this.determineSystemStatus(alerts);

      const health: SystemHealth = {
        status,
        metrics,
        alerts,
        lastChecked: new Date(),
      };

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
          metricValue = metrics.averageRating || 5.0;
          break;
        default:
          continue;
      }

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

    this.updateActiveAlerts(newAlerts);

    return this.activeAlerts;
  }

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

  private getAlertType(metric: string): Alert['type'] {
    if (metric.includes('success_rate')) return 'success_rate';
    if (metric.includes('error_rate')) return 'error_rate';
    if (metric.includes('timeout')) return 'timeout';
    if (metric.includes('response_time')) return 'performance';
    if (metric.includes('rating')) return 'user_experience';
    return 'performance';
  }

  private updateActiveAlerts(newAlerts: Alert[]): void {
    const currentAlertKeys = new Set(
      newAlerts.map(a => `${a.metric}_${a.severity}`),
    );

    this.activeAlerts = this.activeAlerts.filter(alert => {
      const alertKey = `${alert.metric}_${alert.severity}`;
      if (!currentAlertKeys.has(alertKey)) {
        alert.resolved = true;
        return false;
      }
      return true;
    });

    for (const newAlert of newAlerts) {
      const exists = this.activeAlerts.some(
        a => a.metric === newAlert.metric && a.severity === newAlert.severity,
      );

      if (!exists) {
        this.activeAlerts.push(newAlert);
      }
    }
  }

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
   * Get rollout analytics from ingested events
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

      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const dayEvents = this.ingestedEvents.filter(e => {
          const eventDate = new Date(e.createdAt);
          return eventDate >= startOfDay && eventDate <= endOfDay;
        });

        const totalRequests = dayEvents.length;
        const successfulEvents = dayEvents.filter(
          e => e.generationStatus === 'success',
        );
        const uniqueUsers = new Set(dayEvents.map(e => e.userId)).size;
        const successRate =
          totalRequests > 0
            ? (successfulEvents.length / totalRequests) * 100
            : 0;

        dailyMetrics.push({
          date: dateStr,
          successRate,
          totalRequests,
          uniqueUsers,
          averageRating: undefined,
        });
      }

      const overallTrend = this.calculateTrend(dailyMetrics);
      const recommendation = this.generateRolloutRecommendation(
        dailyMetrics,
        overallTrend,
      );

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

    if (health.status === 'critical') {
      recommendations.push('CRITICAL: Immediate investigation required');
      actionItems.push('Investigate and resolve critical alerts');
      actionItems.push('Consider rolling back if issues persist');
    } else if (health.status === 'degraded') {
      recommendations.push('WARNING: System is degraded but operational');
      actionItems.push('Monitor closely and address warning alerts');
      actionItems.push('Delay rollout increases until issues are resolved');
    } else {
      recommendations.push('HEALTHY: System is operating normally');
      actionItems.push('Continue monitoring');
      if (health.metrics.successRate > 95) {
        actionItems.push('Consider increasing rollout percentage');
      }
    }

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
      return 'Excellent performance! Consider increasing rollout to next percentage tier.';
    }

    if (latestDay.successRate >= 80 && trend !== 'degrading') {
      return 'Good performance. Continue current rollout and monitor closely.';
    }

    if (latestDay.successRate < 70 || trend === 'degrading') {
      return 'Performance concerns detected. Hold rollout and investigate issues.';
    }

    return 'Stable performance. Continue monitoring and maintain current rollout level.';
  }

  clearResolvedAlerts(): number {
    const beforeCount = this.activeAlerts.length;
    this.activeAlerts = this.activeAlerts.filter(alert => !alert.resolved);
    return beforeCount - this.activeAlerts.length;
  }

  getActiveAlerts(): Alert[] {
    return this.activeAlerts.filter(alert => !alert.resolved);
  }
}

// Export singleton instance
export const monitoringService = new MonitoringService();

export default monitoringService;
