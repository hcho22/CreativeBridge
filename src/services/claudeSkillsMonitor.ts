/**
 * Claude Skills Performance Monitoring Service
 *
 * Extends existing analytics system to monitor Claude Skills performance impact.
 * Tracks all skill executions, response times, memory usage, and provides
 * real-time monitoring with alerting for SLA breaches.
 */

import { analyticsService } from './analyticsService';
import {
  SkillType,
  SkillResult,
  SkillError,
  PerformanceMetrics as SkillPerformanceMetrics,
} from '../types/claudeSkills';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Performance metrics for Claude Skills
export interface ClaudeSkillsPerformanceMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  timeoutRate: number;
  memoryUsage: number;
  peakMemoryUsage: number;
  skillMetrics: Record<SkillType, SkillTypeMetrics>;
  lastUpdated: Date;
}

export interface SkillTypeMetrics {
  skillType: SkillType;
  executionCount: number;
  successCount: number;
  failureCount: number;
  averageResponseTime: number;
  errorRate: number;
  lastExecuted?: Date;
}

export interface SkillExecutionEvent {
  id: string;
  skillType: SkillType;
  skillId: string;
  userId?: string;
  sessionId: string;
  timestamp: string;
  executionTimeMs: number;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  memoryUsageBefore?: number;
  memoryUsageAfter?: number;
  memoryDelta?: number;
  confidence?: number;
  metadata?: Record<string, any>;
}

export interface AlertThreshold {
  metric:
    | 'response_time'
    | 'error_rate'
    | 'timeout_rate'
    | 'memory_usage'
    | 'success_rate';
  threshold: number;
  operator: 'greater_than' | 'less_than' | 'equals';
  severity: 'warning' | 'critical';
  description: string;
}

export interface PerformanceAlert {
  id: string;
  type: 'performance' | 'error_rate' | 'timeout' | 'memory' | 'success_rate';
  severity: 'warning' | 'critical';
  message: string;
  metric: string;
  value: number;
  threshold: number;
  timestamp: Date;
  resolved: boolean;
  skillType?: SkillType;
}

export interface RealTimeMetrics {
  currentResponseTime: number;
  currentErrorRate: number;
  activeExecutions: number;
  memoryUsage: number;
  systemHealth: 'healthy' | 'degraded' | 'critical';
  recentAlerts: PerformanceAlert[];
}

class ClaudeSkillsMonitor {
  private static readonly STORAGE_KEY = 'claude_skills_metrics';
  private static readonly EVENTS_STORAGE_KEY = 'claude_skills_events';
  private static readonly ALERTS_STORAGE_KEY = 'claude_skills_alerts';
  private static readonly CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  private metrics: ClaudeSkillsPerformanceMetrics;
  private executionEvents: SkillExecutionEvent[] = [];
  private activeAlerts: PerformanceAlert[] = [];
  private metricsCache: Map<
    string,
    { metrics: ClaudeSkillsPerformanceMetrics; timestamp: number }
  > = new Map();
  private activeExecutions: Map<
    string,
    { startTime: number; memoryBefore: number; skillType: SkillType }
  > = new Map();

  // Default alert thresholds
  private alertThresholds: AlertThreshold[] = [
    {
      metric: 'response_time',
      threshold: 2000, // 2 seconds
      operator: 'greater_than',
      severity: 'warning',
      description: 'Skill response time exceeds 2 seconds',
    },
    {
      metric: 'response_time',
      threshold: 5000, // 5 seconds
      operator: 'greater_than',
      severity: 'critical',
      description: 'Skill response time critically high (>5s)',
    },
    {
      metric: 'error_rate',
      threshold: 10, // 10%
      operator: 'greater_than',
      severity: 'warning',
      description: 'Error rate exceeds 10%',
    },
    {
      metric: 'error_rate',
      threshold: 25, // 25%
      operator: 'greater_than',
      severity: 'critical',
      description: 'Error rate critically high (>25%)',
    },
    {
      metric: 'success_rate',
      threshold: 90, // 90%
      operator: 'less_than',
      severity: 'warning',
      description: 'Success rate below 90%',
    },
    {
      metric: 'success_rate',
      threshold: 80, // 80%
      operator: 'less_than',
      severity: 'critical',
      description: 'Success rate critically low (<80%)',
    },
    {
      metric: 'memory_usage',
      threshold: 100 * 1024 * 1024, // 100MB
      operator: 'greater_than',
      severity: 'warning',
      description: 'Memory usage exceeds 100MB',
    },
    {
      metric: 'timeout_rate',
      threshold: 5, // 5%
      operator: 'greater_than',
      severity: 'warning',
      description: 'Timeout rate exceeds 5%',
    },
  ];

  constructor() {
    this.metrics = this.getDefaultMetrics();
    this.initializeMonitoring();
  }

  /**
   * Initialize monitoring system
   */
  private async initializeMonitoring(): Promise<void> {
    try {
      // Load persisted metrics
      await this.loadPersistedMetrics();

      // Load persisted events
      await this.loadPersistedEvents();

      // Load persisted alerts
      await this.loadPersistedAlerts();

      // Start periodic metrics upload
      this.startPeriodicUpload();

      console.log('📊 Claude Skills Monitor initialized');
    } catch (error) {
      console.error('Failed to initialize Claude Skills Monitor:', error);
    }
  }

  /**
   * Track skill execution start
   */
  trackExecutionStart(
    executionId: string,
    skillType: SkillType,
    skillId: string,
    userId?: string,
    sessionId?: string,
  ): void {
    const memoryBefore = this.getCurrentMemoryUsage();
    const startTime = Date.now();

    this.activeExecutions.set(executionId, {
      startTime,
      memoryBefore,
      skillType,
    });

    console.log(
      `📊 Tracking skill execution start: ${skillType} (${executionId})`,
    );
  }

  /**
   * Track skill execution completion
   */
  async trackExecutionComplete(
    executionId: string,
    result: SkillResult<any>,
    skillId: string,
    userId?: string,
    sessionId?: string,
  ): Promise<void> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      console.warn(`No active execution found for ${executionId}`);
      return;
    }

    const executionTime = Date.now() - execution.startTime;
    const memoryAfter = this.getCurrentMemoryUsage();
    const memoryDelta = memoryAfter - execution.memoryBefore;

    const event: SkillExecutionEvent = {
      id: `skill_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      skillType: execution.skillType,
      skillId,
      userId,
      sessionId: sessionId || this.generateSessionId(),
      timestamp: new Date().toISOString(),
      executionTimeMs: executionTime,
      success: result.success,
      errorCode: result.error?.code,
      errorMessage: result.error?.message,
      memoryUsageBefore: execution.memoryBefore,
      memoryUsageAfter: memoryAfter,
      memoryDelta,
      confidence: result.confidence,
      metadata: result.metadata,
    };

    // Add to local events queue
    this.executionEvents.push(event);

    // Update metrics
    this.updateMetrics(event);

    // Check for alerts
    await this.checkAlerts();

    // Remove from active executions
    this.activeExecutions.delete(executionId);

    // Track in analytics service
    await analyticsService.trackPerformance(
      `claude_skill_${execution.skillType}`,
      executionTime,
      result.success,
      {
        skillType: execution.skillType,
        skillId,
        errorCode: result.error?.code,
        memoryDelta,
        confidence: result.confidence,
      },
    );

    // Persist event
    await this.persistEvent(event);

    console.log(
      `📊 Skill execution tracked: ${
        execution.skillType
      } - ${executionTime}ms - ${result.success ? 'SUCCESS' : 'FAILED'}`,
    );
  }

  /**
   * Update performance metrics from event
   */
  private updateMetrics(event: SkillExecutionEvent): void {
    const { skillType, executionTimeMs, success, memoryDelta } = event;

    // Update global metrics
    this.metrics.totalExecutions++;
    if (success) {
      this.metrics.successfulExecutions++;
    } else {
      this.metrics.failedExecutions++;
    }

    // Update average response time
    this.metrics.averageResponseTime =
      (this.metrics.averageResponseTime * (this.metrics.totalExecutions - 1) +
        executionTimeMs) /
      this.metrics.totalExecutions;

    // Update percentiles (simplified - would use proper percentile calculation in production)
    this.updatePercentiles(executionTimeMs);

    // Update error rate
    this.metrics.errorRate =
      (this.metrics.failedExecutions / this.metrics.totalExecutions) * 100;

    // Update memory metrics
    if (memoryDelta) {
      this.metrics.memoryUsage =
        (this.metrics.memoryUsage * (this.metrics.totalExecutions - 1) +
          Math.abs(memoryDelta)) /
        this.metrics.totalExecutions;

      if (Math.abs(memoryDelta) > this.metrics.peakMemoryUsage) {
        this.metrics.peakMemoryUsage = Math.abs(memoryDelta);
      }
    }

    // Update skill-specific metrics
    if (!this.metrics.skillMetrics[skillType]) {
      this.metrics.skillMetrics[skillType] = {
        skillType,
        executionCount: 0,
        successCount: 0,
        failureCount: 0,
        averageResponseTime: 0,
        errorRate: 0,
      };
    }

    const skillMetric = this.metrics.skillMetrics[skillType];
    skillMetric.executionCount++;
    if (success) {
      skillMetric.successCount++;
    } else {
      skillMetric.failureCount++;
    }

    skillMetric.averageResponseTime =
      (skillMetric.averageResponseTime * (skillMetric.executionCount - 1) +
        executionTimeMs) /
      skillMetric.executionCount;

    skillMetric.errorRate =
      (skillMetric.failureCount / skillMetric.executionCount) * 100;

    skillMetric.lastExecuted = new Date();

    this.metrics.lastUpdated = new Date();
  }

  /**
   * Update percentile metrics (simplified implementation)
   */
  private updatePercentiles(responseTime: number): void {
    // In production, this would maintain a sorted list or use a proper percentile algorithm
    // For now, we'll use a simplified approach
    const responseTimes = this.executionEvents
      .slice(-100) // Last 100 events
      .map(e => e.executionTimeMs)
      .sort((a, b) => a - b);

    if (responseTimes.length > 0) {
      this.metrics.p50ResponseTime =
        responseTimes[Math.floor(responseTimes.length * 0.5)] || 0;
      this.metrics.p95ResponseTime =
        responseTimes[Math.floor(responseTimes.length * 0.95)] || 0;
      this.metrics.p99ResponseTime =
        responseTimes[Math.floor(responseTimes.length * 0.99)] || 0;
    }
  }

  /**
   * Get current performance metrics
   */
  async getPerformanceMetrics(
    hours: number = 24,
    skillType?: SkillType,
  ): Promise<ClaudeSkillsPerformanceMetrics> {
    const cacheKey = `metrics_${hours}h_${skillType || 'all'}`;
    const cached = this.metricsCache.get(cacheKey);

    if (
      cached &&
      Date.now() - cached.timestamp < ClaudeSkillsMonitor.CACHE_TIMEOUT
    ) {
      return cached.metrics;
    }

    try {
      // Use in-memory metrics (Claude Skills infrastructure is mocked)
      const calculatedMetrics = this.calculateMetricsFromLocalEvents(
        hours,
        skillType,
      );

      // Cache the results
      this.metricsCache.set(cacheKey, {
        metrics: calculatedMetrics,
        timestamp: Date.now(),
      });

      return calculatedMetrics;
    } catch (error) {
      console.error('Error fetching performance metrics:', error);
      return this.metrics;
    }
  }

  /**
   * Calculate metrics from analytics events
   */
  private calculateMetricsFromEvents(
    events: any[],
    skillType?: SkillType,
  ): ClaudeSkillsPerformanceMetrics {
    const skillEvents = events.filter(
      e =>
        e.metadata?.skillType &&
        (!skillType || e.metadata.skillType === skillType),
    );

    const totalExecutions = skillEvents.length;
    const successfulExecutions = skillEvents.filter(
      e => e.metadata?.success,
    ).length;
    const failedExecutions = totalExecutions - successfulExecutions;

    const responseTimes = skillEvents
      .filter(e => e.metadata?.duration)
      .map(e => e.metadata.duration);

    const averageResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((sum, time) => sum + time, 0) /
          responseTimes.length
        : 0;

    const sortedTimes = [...responseTimes].sort((a, b) => a - b);
    const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)] || 0;
    const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)] || 0;
    const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)] || 0;

    const errorRate =
      totalExecutions > 0 ? (failedExecutions / totalExecutions) * 100 : 0;

    // Calculate skill-specific metrics
    const skillMetrics: Record<SkillType, SkillTypeMetrics> = {} as any;
    const skillGroups = new Map<SkillType, any[]>();

    skillEvents.forEach(event => {
      const type = event.metadata?.skillType as SkillType;
      if (type) {
        if (!skillGroups.has(type)) {
          skillGroups.set(type, []);
        }
        skillGroups.get(type)!.push(event);
      }
    });

    skillGroups.forEach((groupEvents, type) => {
      const groupTotal = groupEvents.length;
      const groupSuccess = groupEvents.filter(e => e.metadata?.success).length;
      const groupFailures = groupTotal - groupSuccess;
      const groupResponseTimes = groupEvents
        .filter(e => e.metadata?.duration)
        .map(e => e.metadata.duration);
      const groupAvgTime =
        groupResponseTimes.length > 0
          ? groupResponseTimes.reduce((sum, time) => sum + time, 0) /
            groupResponseTimes.length
          : 0;

      skillMetrics[type] = {
        skillType: type,
        executionCount: groupTotal,
        successCount: groupSuccess,
        failureCount: groupFailures,
        averageResponseTime: groupAvgTime,
        errorRate: groupTotal > 0 ? (groupFailures / groupTotal) * 100 : 0,
        lastExecuted:
          groupEvents.length > 0
            ? new Date(groupEvents[0].timestamp)
            : undefined,
      };
    });

    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      averageResponseTime,
      p50ResponseTime: p50,
      p95ResponseTime: p95,
      p99ResponseTime: p99,
      errorRate,
      timeoutRate: 0, // Would need to track timeouts separately
      memoryUsage: 0, // Would need to aggregate from events
      peakMemoryUsage: 0,
      skillMetrics,
      lastUpdated: new Date(),
    };
  }

  /**
   * Get real-time metrics
   */
  getRealTimeMetrics(): RealTimeMetrics {
    const recentEvents = this.executionEvents.slice(-50); // Last 50 events
    const recentResponseTimes = recentEvents
      .filter(e => e.success)
      .map(e => e.executionTimeMs);

    const currentResponseTime =
      recentResponseTimes.length > 0
        ? recentResponseTimes.reduce((sum, time) => sum + time, 0) /
          recentResponseTimes.length
        : 0;

    const recentErrors = recentEvents.filter(e => !e.success).length;
    const currentErrorRate =
      recentEvents.length > 0 ? (recentErrors / recentEvents.length) * 100 : 0;

    const activeAlerts = this.activeAlerts.filter(a => !a.resolved);
    const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical');

    let systemHealth: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (criticalAlerts.length > 0) {
      systemHealth = 'critical';
    } else if (activeAlerts.length > 0) {
      systemHealth = 'degraded';
    }

    return {
      currentResponseTime,
      currentErrorRate,
      activeExecutions: this.activeExecutions.size,
      memoryUsage: this.metrics.memoryUsage,
      systemHealth,
      recentAlerts: activeAlerts.slice(-10), // Last 10 alerts
    };
  }

  /**
   * Check for performance alerts
   */
  private async checkAlerts(): Promise<void> {
    const metrics = this.metrics;
    const newAlerts: PerformanceAlert[] = [];

    for (const threshold of this.alertThresholds) {
      let metricValue: number;
      let skillType: SkillType | undefined;

      switch (threshold.metric) {
        case 'response_time':
          metricValue = metrics.averageResponseTime;
          break;
        case 'error_rate':
          metricValue = metrics.errorRate;
          break;
        case 'success_rate':
          metricValue =
            metrics.totalExecutions > 0
              ? (metrics.successfulExecutions / metrics.totalExecutions) * 100
              : 100;
          break;
        case 'memory_usage':
          metricValue = metrics.memoryUsage;
          break;
        case 'timeout_rate':
          metricValue = metrics.timeoutRate;
          break;
        default:
          continue;
      }

      const thresholdBreached = this.evaluateThreshold(metricValue, threshold);

      if (thresholdBreached) {
        const alertId = `alert_${threshold.metric}_${
          threshold.severity
        }_${Date.now()}`;

        // Check if alert already exists
        const existingAlert = this.activeAlerts.find(
          a =>
            a.metric === threshold.metric &&
            a.severity === threshold.severity &&
            !a.resolved,
        );

        if (!existingAlert) {
          const alert: PerformanceAlert = {
            id: alertId,
            type: this.getAlertType(threshold.metric),
            severity: threshold.severity,
            message: `${threshold.description} (Current: ${metricValue.toFixed(
              2,
            )})`,
            metric: threshold.metric,
            value: metricValue,
            threshold: threshold.threshold,
            timestamp: new Date(),
            resolved: false,
            skillType,
          };

          newAlerts.push(alert);
          this.activeAlerts.push(alert);

          // Log alert
          await analyticsService.trackError(
            'system',
            'claude_skills_performance_alert',
            alert.message,
            {
              alertId: alert.id,
              metric: threshold.metric,
              value: metricValue,
              threshold: threshold.threshold,
              severity: threshold.severity,
            },
          );

          console.warn(`⚠️ Performance Alert: ${alert.message}`);
        }
      }
    }

    // Persist alerts
    if (newAlerts.length > 0) {
      await this.persistAlerts();
    }
  }

  /**
   * Evaluate threshold condition
   */
  private evaluateThreshold(value: number, threshold: AlertThreshold): boolean {
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
   * Get alert type from metric
   */
  private getAlertType(metric: string): PerformanceAlert['type'] {
    if (metric.includes('response_time')) return 'performance';
    if (metric.includes('error_rate')) return 'error_rate';
    if (metric.includes('timeout')) return 'timeout';
    if (metric.includes('memory')) return 'memory';
    if (metric.includes('success_rate')) return 'success_rate';
    return 'performance';
  }

  /**
   * Get current memory usage (React Native compatible)
   */
  private getCurrentMemoryUsage(): number {
    try {
      // Use performance.memory if available
      if (typeof performance !== 'undefined' && (performance as any).memory) {
        return (performance as any).memory.usedJSHeapSize || 0;
      }

      // Estimate based on active executions and events
      let estimated = 0;
      estimated += this.activeExecutions.size * 5000; // ~5KB per active execution
      estimated += this.executionEvents.length * 2000; // ~2KB per event

      return estimated;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): PerformanceAlert[] {
    return this.activeAlerts.filter(a => !a.resolved);
  }

  /**
   * Resolve alert
   */
  async resolveAlert(alertId: string): Promise<void> {
    const alert = this.activeAlerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      await this.persistAlerts();
    }
  }

  /**
   * Clear resolved alerts
   */
  async clearResolvedAlerts(): Promise<number> {
    const beforeCount = this.activeAlerts.length;
    this.activeAlerts = this.activeAlerts.filter(a => !a.resolved);
    const removed = beforeCount - this.activeAlerts.length;

    if (removed > 0) {
      await this.persistAlerts();
    }

    return removed;
  }

  /**
   * Start periodic upload of metrics to Supabase
   */
  private startPeriodicUpload(): void {
    setInterval(async () => {
      await this.uploadMetricsToDatabase();
    }, 60000); // Upload every minute
  }

  /**
   * Trim and persist metrics locally.
   * Supabase upload removed — Claude Skills infrastructure is mocked.
   * TODO: Route to Convex analytics table when Skills are production-ready.
   */
  private async uploadMetricsToDatabase(): Promise<void> {
    if (this.executionEvents.length === 0) return;

    try {
      // Keep last 100 events for local metrics
      this.executionEvents = this.executionEvents.slice(-100);
      await this.persistEvents();
    } catch (error) {
      console.error('Error persisting local metrics:', error);
    }
  }

  /**
   * Calculate metrics from local in-memory events
   */
  private calculateMetricsFromLocalEvents(
    hours: number,
    skillType?: SkillType,
  ): ClaudeSkillsPerformanceMetrics {
    const startTime = Date.now() - hours * 60 * 60 * 1000;

    let events = this.executionEvents.filter(
      e => new Date(e.timestamp).getTime() >= startTime,
    );

    if (skillType) {
      events = events.filter(e => e.skillType === skillType);
    }

    if (events.length === 0) {
      return this.metrics;
    }

    const totalExecutions = events.length;
    const successfulExecutions = events.filter(e => e.success).length;
    const failedExecutions = totalExecutions - successfulExecutions;
    const errorRate =
      totalExecutions > 0 ? (failedExecutions / totalExecutions) * 100 : 0;

    const responseTimes = events
      .map(e => e.executionTimeMs)
      .filter(t => t > 0)
      .sort((a, b) => a - b);

    const averageResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length
        : 0;

    return {
      ...this.metrics,
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      errorRate,
      averageResponseTime,
      p50ResponseTime:
        responseTimes[Math.floor(responseTimes.length * 0.5)] || 0,
      p95ResponseTime:
        responseTimes[Math.floor(responseTimes.length * 0.95)] || 0,
      p99ResponseTime:
        responseTimes[Math.floor(responseTimes.length * 0.99)] || 0,
    };
  }

  /**
   * Persist event to local storage
   */
  private async persistEvent(event: SkillExecutionEvent): Promise<void> {
    try {
      this.executionEvents.push(event);

      // Keep only last 1000 events in memory
      if (this.executionEvents.length > 1000) {
        this.executionEvents = this.executionEvents.slice(-1000);
      }

      await this.persistEvents();
    } catch (error) {
      console.error('Failed to persist event:', error);
    }
  }

  /**
   * Persist events to AsyncStorage
   */
  private async persistEvents(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        ClaudeSkillsMonitor.EVENTS_STORAGE_KEY,
        JSON.stringify(this.executionEvents.slice(-500)), // Keep last 500 in storage
      );
    } catch (error) {
      console.error('Failed to persist events:', error);
    }
  }

  /**
   * Load persisted events
   */
  private async loadPersistedEvents(): Promise<void> {
    try {
      const eventsJson = await AsyncStorage.getItem(
        ClaudeSkillsMonitor.EVENTS_STORAGE_KEY,
      );
      if (eventsJson) {
        this.executionEvents = JSON.parse(eventsJson);
      }
    } catch (error) {
      console.error('Failed to load persisted events:', error);
    }
  }

  /**
   * Persist metrics to AsyncStorage
   */
  private async persistMetrics(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        ClaudeSkillsMonitor.STORAGE_KEY,
        JSON.stringify(this.metrics),
      );
    } catch (error) {
      console.error('Failed to persist metrics:', error);
    }
  }

  /**
   * Load persisted metrics
   */
  private async loadPersistedMetrics(): Promise<void> {
    try {
      const metricsJson = await AsyncStorage.getItem(
        ClaudeSkillsMonitor.STORAGE_KEY,
      );
      if (metricsJson) {
        const loaded = JSON.parse(metricsJson);
        this.metrics = { ...this.getDefaultMetrics(), ...loaded };
      }
    } catch (error) {
      console.error('Failed to load persisted metrics:', error);
    }
  }

  /**
   * Persist alerts to AsyncStorage
   */
  private async persistAlerts(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        ClaudeSkillsMonitor.ALERTS_STORAGE_KEY,
        JSON.stringify(this.activeAlerts),
      );
    } catch (error) {
      console.error('Failed to persist alerts:', error);
    }
  }

  /**
   * Load persisted alerts
   */
  private async loadPersistedAlerts(): Promise<void> {
    try {
      const alertsJson = await AsyncStorage.getItem(
        ClaudeSkillsMonitor.ALERTS_STORAGE_KEY,
      );
      if (alertsJson) {
        this.activeAlerts = JSON.parse(alertsJson);
      }
    } catch (error) {
      console.error('Failed to load persisted alerts:', error);
    }
  }

  /**
   * Get default metrics structure
   */
  private getDefaultMetrics(): ClaudeSkillsPerformanceMetrics {
    return {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageResponseTime: 0,
      p50ResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      errorRate: 0,
      timeoutRate: 0,
      memoryUsage: 0,
      peakMemoryUsage: 0,
      skillMetrics: {} as Record<SkillType, SkillTypeMetrics>,
      lastUpdated: new Date(),
    };
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current metrics (for testing)
   */
  getCurrentMetrics(): ClaudeSkillsPerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics (for testing)
   */
  async resetMetrics(): Promise<void> {
    this.metrics = this.getDefaultMetrics();
    this.executionEvents = [];
    this.activeAlerts = [];
    this.activeExecutions.clear();
    this.metricsCache.clear();

    await Promise.all([
      AsyncStorage.removeItem(ClaudeSkillsMonitor.STORAGE_KEY),
      AsyncStorage.removeItem(ClaudeSkillsMonitor.EVENTS_STORAGE_KEY),
      AsyncStorage.removeItem(ClaudeSkillsMonitor.ALERTS_STORAGE_KEY),
    ]);
  }
}

// Export singleton instance
export const claudeSkillsMonitor = new ClaudeSkillsMonitor();
export default claudeSkillsMonitor;
