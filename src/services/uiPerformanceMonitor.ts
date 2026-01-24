/**
 * UI Performance Monitor
 *
 * Real-time interface performance monitoring and optimization service
 * Task 7.2: Dynamic UI Optimization - Subtask 1
 */

import { structuredLogger } from '../utils/logger';
import { behaviorAnalytics } from './behaviorAnalytics';
import { GradeLevel } from '../types/database';

export interface UIPerformanceMetric {
  id: string;
  component: string;
  screen: string;
  metricType:
    | 'render_time'
    | 'interaction_delay'
    | 'scroll_performance'
    | 'touch_response'
    | 'navigation_time'
    | 'memory_usage';
  value: number;
  timestamp: number;
  sessionId: string;
  deviceInfo: {
    platform: 'ios' | 'android';
    deviceModel: string;
    osVersion: string;
    appVersion: string;
    memoryAvailable: number;
    batteryLevel?: number;
  };
  context: {
    gradeLevel: GradeLevel;
    userEngagementLevel: number;
    previousMetrics: number[];
  };
}

export interface PerformanceBaseline {
  component: string;
  screen: string;
  expectedRenderTime: number;
  maxInteractionDelay: number;
  optimalScrollFPS: number;
  targetTouchResponse: number;
  memoryThreshold: number;
  establishedAt: number;
  sampleSize: number;
  confidence: number;
}

export interface OptimizationTrigger {
  id: string;
  triggerType:
    | 'performance_degradation'
    | 'engagement_drop'
    | 'accessibility_issue'
    | 'memory_pressure'
    | 'user_struggle';
  severity: 'low' | 'medium' | 'high' | 'critical';
  component: string;
  screen: string;
  detectedAt: number;
  metrics: UIPerformanceMetric[];
  suggestedOptimizations: OptimizationRecommendation[];
  confidence: number;
}

export interface OptimizationRecommendation {
  type:
    | 'reduce_animations'
    | 'simplify_layout'
    | 'lazy_loading'
    | 'cache_optimization'
    | 'component_memoization'
    | 'interaction_assistance'
    | 'font_scaling'
    | 'contrast_enhancement';
  priority: number; // 1-5, where 5 is highest priority
  expectedImpact: number; // 0-1, expected performance improvement
  implementation: string;
  targetMetric: string;
  rollbackData?: any;
}

interface UIPerformanceConfig {
  monitoringEnabled: boolean;
  samplingRate: number; // 0-1, percentage of interactions to monitor
  baselineUpdateInterval: number; // milliseconds
  optimizationThresholds: {
    renderTimeThreshold: number; // milliseconds
    interactionDelayThreshold: number; // milliseconds
    scrollFPSThreshold: number;
    touchResponseThreshold: number; // milliseconds
    memoryUsageThreshold: number; // MB
  };
  autoOptimizationEnabled: boolean;
  gradeLevelThresholds: Record<
    GradeLevel,
    {
      maxComplexity: number;
      preferredAnimationSpeed: number;
      touchTargetSize: number;
    }
  >;
}

const DEFAULT_CONFIG: UIPerformanceConfig = {
  monitoringEnabled: true,
  samplingRate: 0.1, // Monitor 10% of interactions
  baselineUpdateInterval: 60000, // 1 minute
  optimizationThresholds: {
    renderTimeThreshold: 16.67, // 60 FPS target
    interactionDelayThreshold: 100, // 100ms max delay
    scrollFPSThreshold: 45, // Minimum acceptable scroll FPS
    touchResponseThreshold: 50, // 50ms max touch response
    memoryUsageThreshold: 100, // 100MB threshold
  },
  autoOptimizationEnabled: true,
  gradeLevelThresholds: {
    'K-2': {
      maxComplexity: 0.3,
      preferredAnimationSpeed: 0.8,
      touchTargetSize: 48,
    },
    '3-5': {
      maxComplexity: 0.5,
      preferredAnimationSpeed: 1.0,
      touchTargetSize: 44,
    },
    '6-8': {
      maxComplexity: 0.7,
      preferredAnimationSpeed: 1.2,
      touchTargetSize: 44,
    },
    '9-12': {
      maxComplexity: 0.9,
      preferredAnimationSpeed: 1.4,
      touchTargetSize: 40,
    },
  },
};

class UIPerformanceMonitorService {
  private config: UIPerformanceConfig;
  private metrics: UIPerformanceMetric[] = [];
  private baselines: Map<string, PerformanceBaseline> = new Map();
  private triggers: OptimizationTrigger[] = [];
  private sessionId: string | null = null;
  private monitoringTimer: NodeJS.Timeout | null = null;
  private isInitialized = false;

  // Performance tracking state
  private renderStartTimes: Map<string, number> = new Map();
  private interactionStartTimes: Map<string, number> = new Map();
  private memoryUsageHistory: number[] = [];

  constructor(config: Partial<UIPerformanceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the performance monitoring service
   */
  async initialize(sessionId: string): Promise<void> {
    try {
      this.sessionId = sessionId;

      // Load existing baselines
      await this.loadBaselines();

      // Start monitoring if enabled
      if (this.config.monitoringEnabled) {
        this.startMonitoring();
      }

      this.isInitialized = true;

      structuredLogger.info('UI Performance Monitor initialized', {
        sessionId,
        monitoringEnabled: this.config.monitoringEnabled,
        samplingRate: this.config.samplingRate,
        baselineCount: this.baselines.size,
      });
    } catch (error) {
      structuredLogger.error(
        'Failed to initialize UI Performance Monitor',
        {},
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Record render performance for a component
   */
  recordRenderPerformance(
    component: string,
    screen: string,
    renderTime: number,
    context: Partial<UIPerformanceMetric['context']> = {},
  ): void {
    if (!this.isInitialized || !this.shouldSample()) return;

    const metric: UIPerformanceMetric = {
      id: this.generateMetricId(),
      component,
      screen,
      metricType: 'render_time',
      value: renderTime,
      timestamp: Date.now(),
      sessionId: this.sessionId!,
      deviceInfo: this.getDeviceInfo(),
      context: {
        gradeLevel: context.gradeLevel || 'Grade3',
        userEngagementLevel: context.userEngagementLevel || 0.5,
        previousMetrics: context.previousMetrics || [],
      },
    };

    this.metrics.push(metric);
    this.analyzePerformance(metric);
    this.updateBaseline(component, screen, renderTime, 'render_time');
  }

  /**
   * Record interaction delay performance
   */
  recordInteractionDelay(
    component: string,
    screen: string,
    delay: number,
    interactionType: string,
    context: Partial<UIPerformanceMetric['context']> = {},
  ): void {
    if (!this.isInitialized || !this.shouldSample()) return;

    const metric: UIPerformanceMetric = {
      id: this.generateMetricId(),
      component,
      screen,
      metricType: 'interaction_delay',
      value: delay,
      timestamp: Date.now(),
      sessionId: this.sessionId!,
      deviceInfo: this.getDeviceInfo(),
      context: {
        gradeLevel: context.gradeLevel || 'Grade3',
        userEngagementLevel: context.userEngagementLevel || 0.5,
        previousMetrics: context.previousMetrics || [],
      },
    };

    this.metrics.push(metric);
    this.analyzePerformance(metric);

    // Record interaction with behavior analytics
    if (behaviorAnalytics) {
      behaviorAnalytics.recordInteraction({
        component,
        action: `interaction_delay_${interactionType}`,
        context: { delay, screen },
        duration: delay,
      });
    }
  }

  /**
   * Record scroll performance
   */
  recordScrollPerformance(
    component: string,
    screen: string,
    fps: number,
    scrollDistance: number,
    context: Partial<UIPerformanceMetric['context']> = {},
  ): void {
    if (!this.isInitialized || !this.shouldSample()) return;

    const metric: UIPerformanceMetric = {
      id: this.generateMetricId(),
      component,
      screen,
      metricType: 'scroll_performance',
      value: fps,
      timestamp: Date.now(),
      sessionId: this.sessionId!,
      deviceInfo: this.getDeviceInfo(),
      context: {
        gradeLevel: context.gradeLevel || 'Grade3',
        userEngagementLevel: context.userEngagementLevel || 0.5,
        previousMetrics: [...(context.previousMetrics || []), scrollDistance],
      },
    };

    this.metrics.push(metric);
    this.analyzePerformance(metric);
  }

  /**
   * Record navigation timing
   */
  recordNavigationTime(
    fromScreen: string,
    toScreen: string,
    navigationTime: number,
    context: Partial<UIPerformanceMetric['context']> = {},
  ): void {
    if (!this.isInitialized || !this.shouldSample()) return;

    const metric: UIPerformanceMetric = {
      id: this.generateMetricId(),
      component: `navigation_${fromScreen}_to_${toScreen}`,
      screen: toScreen,
      metricType: 'navigation_time',
      value: navigationTime,
      timestamp: Date.now(),
      sessionId: this.sessionId!,
      deviceInfo: this.getDeviceInfo(),
      context: {
        gradeLevel: context.gradeLevel || 'Grade3',
        userEngagementLevel: context.userEngagementLevel || 0.5,
        previousMetrics: context.previousMetrics || [],
      },
    };

    this.metrics.push(metric);
    this.analyzePerformance(metric);
    this.updateBaseline(
      metric.component,
      toScreen,
      navigationTime,
      'navigation_time',
    );
  }

  /**
   * Get performance insights for a component or screen
   */
  getPerformanceInsights(
    component?: string,
    screen?: string,
  ): {
    metrics: UIPerformanceMetric[];
    baseline: PerformanceBaseline | null;
    recentTriggers: OptimizationTrigger[];
    recommendations: OptimizationRecommendation[];
  } {
    let filteredMetrics = this.metrics;

    if (component) {
      filteredMetrics = filteredMetrics.filter(m => m.component === component);
    }

    if (screen) {
      filteredMetrics = filteredMetrics.filter(m => m.screen === screen);
    }

    const baselineKey = this.getBaselineKey(component || '', screen || '');
    const baseline = this.baselines.get(baselineKey) || null;

    const recentTriggers = this.triggers
      .filter(t => {
        if (component && t.component !== component) return false;
        if (screen && t.screen !== screen) return false;
        return Date.now() - t.detectedAt < 300000; // Last 5 minutes
      })
      .sort((a, b) => b.detectedAt - a.detectedAt)
      .slice(0, 5);

    const recommendations = this.generateRecommendations(
      filteredMetrics,
      baseline,
    );

    return {
      metrics: filteredMetrics.slice(-100), // Last 100 metrics
      baseline,
      recentTriggers,
      recommendations,
    };
  }

  /**
   * Get optimization triggers for analysis
   */
  getOptimizationTriggers(
    severity?: OptimizationTrigger['severity'],
  ): OptimizationTrigger[] {
    let triggers = this.triggers;

    if (severity) {
      triggers = triggers.filter(t => t.severity === severity);
    }

    return triggers.sort((a, b) => b.detectedAt - a.detectedAt).slice(0, 20); // Most recent 20 triggers
  }

  /**
   * Get current performance summary
   */
  getPerformanceSummary(): {
    overallHealth: 'excellent' | 'good' | 'fair' | 'poor';
    criticalIssues: number;
    averageRenderTime: number;
    averageInteractionDelay: number;
    memoryUsage: number;
    optimizationsApplied: number;
  } {
    const recentMetrics = this.metrics.filter(
      m => Date.now() - m.timestamp < 300000, // Last 5 minutes
    );

    const renderMetrics = recentMetrics.filter(
      m => m.metricType === 'render_time',
    );
    const interactionMetrics = recentMetrics.filter(
      m => m.metricType === 'interaction_delay',
    );
    const memoryMetrics = recentMetrics.filter(
      m => m.metricType === 'memory_usage',
    );

    const averageRenderTime =
      renderMetrics.length > 0
        ? renderMetrics.reduce((sum, m) => sum + m.value, 0) /
          renderMetrics.length
        : 0;

    const averageInteractionDelay =
      interactionMetrics.length > 0
        ? interactionMetrics.reduce((sum, m) => sum + m.value, 0) /
          interactionMetrics.length
        : 0;

    const currentMemoryUsage =
      memoryMetrics.length > 0
        ? memoryMetrics[memoryMetrics.length - 1].value
        : 0;

    const criticalTriggers = this.triggers.filter(
      t => t.severity === 'critical' && Date.now() - t.detectedAt < 300000,
    ).length;

    const optimizationsApplied = this.triggers.filter(
      t =>
        Date.now() - t.detectedAt < 3600000 && // Last hour
        t.suggestedOptimizations.length > 0,
    ).length;

    // Determine overall health
    let overallHealth: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent';

    if (
      criticalTriggers > 0 ||
      averageRenderTime > 50 ||
      averageInteractionDelay > 200
    ) {
      overallHealth = 'poor';
    } else if (
      averageRenderTime > 30 ||
      averageInteractionDelay > 150 ||
      currentMemoryUsage > 150
    ) {
      overallHealth = 'fair';
    } else if (averageRenderTime > 20 || averageInteractionDelay > 100) {
      overallHealth = 'good';
    }

    return {
      overallHealth,
      criticalIssues: criticalTriggers,
      averageRenderTime,
      averageInteractionDelay,
      memoryUsage: currentMemoryUsage,
      optimizationsApplied,
    };
  }

  /**
   * Helper methods
   */
  private shouldSample(): boolean {
    return Math.random() < this.config.samplingRate;
  }

  private generateMetricId(): string {
    return `metric_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  private getDeviceInfo(): UIPerformanceMetric['deviceInfo'] {
    // In a real implementation, this would get actual device info
    return {
      platform: 'ios', // or 'android' based on Platform.OS
      deviceModel: 'unknown',
      osVersion: 'unknown',
      appVersion: '1.0.0',
      memoryAvailable: 1024, // MB
      batteryLevel: 0.8,
    };
  }

  private getBaselineKey(component: string, screen: string): string {
    return `${screen}:${component}`;
  }

  private async loadBaselines(): Promise<void> {
    try {
      // In a real implementation, this would load from storage
      structuredLogger.debug('Performance baselines loaded', {
        count: this.baselines.size,
      });
    } catch (error) {
      structuredLogger.error(
        'Failed to load performance baselines',
        {},
        error as Error,
      );
    }
  }

  private startMonitoring(): void {
    this.monitoringTimer = setInterval(() => {
      this.performPeriodicAnalysis();
    }, this.config.baselineUpdateInterval);
  }

  private performPeriodicAnalysis(): void {
    try {
      // Update baselines
      this.updateAllBaselines();

      // Clean up old metrics (keep last 1000)
      if (this.metrics.length > 1000) {
        this.metrics = this.metrics.slice(-1000);
      }

      // Clean up old triggers (keep last 100)
      if (this.triggers.length > 100) {
        this.triggers = this.triggers.slice(-100);
      }

      structuredLogger.debug('Periodic performance analysis completed', {
        metricsCount: this.metrics.length,
        triggersCount: this.triggers.length,
        baselinesCount: this.baselines.size,
      });
    } catch (error) {
      structuredLogger.error(
        'Periodic performance analysis failed',
        {},
        error as Error,
      );
    }
  }

  private analyzePerformance(metric: UIPerformanceMetric): void {
    const baseline = this.baselines.get(
      this.getBaselineKey(metric.component, metric.screen),
    );

    if (!baseline) return; // No baseline yet

    // Check for performance degradation
    const isRenderTimePoor =
      metric.metricType === 'render_time' &&
      metric.value > baseline.expectedRenderTime * 1.5;

    const isInteractionSlow =
      metric.metricType === 'interaction_delay' &&
      metric.value > baseline.maxInteractionDelay * 1.5;

    const isScrollPoor =
      metric.metricType === 'scroll_performance' &&
      metric.value < baseline.optimalScrollFPS * 0.8;

    if (isRenderTimePoor || isInteractionSlow || isScrollPoor) {
      this.createOptimizationTrigger(
        metric,
        baseline,
        'performance_degradation',
      );
    }
  }

  private createOptimizationTrigger(
    metric: UIPerformanceMetric,
    baseline: PerformanceBaseline,
    triggerType: OptimizationTrigger['triggerType'],
  ): void {
    const severity = this.determineSeverity(metric, baseline);
    const recommendations = this.generateRecommendationsForMetric(
      metric,
      baseline,
    );

    const trigger: OptimizationTrigger = {
      id: `trigger_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      triggerType,
      severity,
      component: metric.component,
      screen: metric.screen,
      detectedAt: Date.now(),
      metrics: [metric],
      suggestedOptimizations: recommendations,
      confidence: this.calculateTriggerConfidence(metric, baseline),
    };

    this.triggers.push(trigger);

    structuredLogger.info('Performance optimization trigger created', {
      triggerType,
      severity,
      component: metric.component,
      screen: metric.screen,
      metricValue: metric.value,
      recommendationsCount: recommendations.length,
    });
  }

  private determineSeverity(
    metric: UIPerformanceMetric,
    baseline: PerformanceBaseline,
  ): OptimizationTrigger['severity'] {
    const degradationRatio =
      metric.value /
      (baseline.expectedRenderTime ||
        baseline.maxInteractionDelay ||
        baseline.optimalScrollFPS ||
        1);

    if (degradationRatio > 3) return 'critical';
    if (degradationRatio > 2) return 'high';
    if (degradationRatio > 1.5) return 'medium';
    return 'low';
  }

  private generateRecommendationsForMetric(
    metric: UIPerformanceMetric,
    baseline: PerformanceBaseline,
  ): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    switch (metric.metricType) {
      case 'render_time':
        if (metric.value > baseline.expectedRenderTime * 2) {
          recommendations.push({
            type: 'component_memoization',
            priority: 5,
            expectedImpact: 0.4,
            implementation: 'Add React.memo to prevent unnecessary re-renders',
            targetMetric: 'render_time',
          });
        }
        break;

      case 'interaction_delay':
        if (metric.value > baseline.maxInteractionDelay * 1.5) {
          recommendations.push({
            type: 'reduce_animations',
            priority: 4,
            expectedImpact: 0.3,
            implementation: 'Reduce animation complexity or duration',
            targetMetric: 'interaction_delay',
          });
        }
        break;

      case 'scroll_performance':
        if (metric.value < baseline.optimalScrollFPS * 0.8) {
          recommendations.push({
            type: 'lazy_loading',
            priority: 4,
            expectedImpact: 0.5,
            implementation: 'Implement lazy loading for list items',
            targetMetric: 'scroll_performance',
          });
        }
        break;
    }

    return recommendations;
  }

  private calculateTriggerConfidence(
    metric: UIPerformanceMetric,
    baseline: PerformanceBaseline,
  ): number {
    // Confidence based on baseline sample size and metric deviation
    const sampleSizeConfidence = Math.min(baseline.sampleSize / 100, 1);
    const deviationConfidence = Math.min(
      Math.abs(metric.value - baseline.expectedRenderTime) /
        baseline.expectedRenderTime,
      1,
    );

    return (sampleSizeConfidence + deviationConfidence) / 2;
  }

  private updateBaseline(
    component: string,
    screen: string,
    value: number,
    metricType: string,
  ): void {
    const key = this.getBaselineKey(component, screen);
    const existing = this.baselines.get(key);

    if (existing) {
      // Update existing baseline with exponential moving average
      const alpha = 0.1; // Learning rate

      switch (metricType) {
        case 'render_time':
          existing.expectedRenderTime =
            existing.expectedRenderTime * (1 - alpha) + value * alpha;
          break;
        case 'interaction_delay':
          existing.maxInteractionDelay =
            existing.maxInteractionDelay * (1 - alpha) + value * alpha;
          break;
        case 'navigation_time':
          existing.expectedRenderTime =
            existing.expectedRenderTime * (1 - alpha) + value * alpha;
          break;
      }

      existing.sampleSize++;
      existing.confidence = Math.min(existing.confidence + 0.01, 1);
    } else {
      // Create new baseline
      const newBaseline: PerformanceBaseline = {
        component,
        screen,
        expectedRenderTime: metricType === 'render_time' ? value : 16.67,
        maxInteractionDelay: metricType === 'interaction_delay' ? value : 100,
        optimalScrollFPS: metricType === 'scroll_performance' ? value : 60,
        targetTouchResponse: 50,
        memoryThreshold: 100,
        establishedAt: Date.now(),
        sampleSize: 1,
        confidence: 0.1,
      };

      this.baselines.set(key, newBaseline);
    }
  }

  private updateAllBaselines(): void {
    // Update all baselines based on recent metrics
    const recentMetrics = this.metrics.filter(
      m => Date.now() - m.timestamp < this.config.baselineUpdateInterval,
    );

    recentMetrics.forEach(metric => {
      this.updateBaseline(
        metric.component,
        metric.screen,
        metric.value,
        metric.metricType,
      );
    });
  }

  private generateRecommendations(
    metrics: UIPerformanceMetric[],
    baseline: PerformanceBaseline | null,
  ): OptimizationRecommendation[] {
    if (!baseline || metrics.length === 0) return [];

    const recommendations: OptimizationRecommendation[] = [];

    // Analyze recent performance trends
    const renderMetrics = metrics.filter(m => m.metricType === 'render_time');
    const interactionMetrics = metrics.filter(
      m => m.metricType === 'interaction_delay',
    );

    if (renderMetrics.length > 0) {
      const avgRenderTime =
        renderMetrics.reduce((sum, m) => sum + m.value, 0) /
        renderMetrics.length;

      if (avgRenderTime > baseline.expectedRenderTime * 1.3) {
        recommendations.push({
          type: 'component_memoization',
          priority: 4,
          expectedImpact: 0.3,
          implementation: 'Optimize component rendering with memoization',
          targetMetric: 'render_time',
        });
      }
    }

    if (interactionMetrics.length > 0) {
      const avgInteractionDelay =
        interactionMetrics.reduce((sum, m) => sum + m.value, 0) /
        interactionMetrics.length;

      if (avgInteractionDelay > baseline.maxInteractionDelay * 1.2) {
        recommendations.push({
          type: 'interaction_assistance',
          priority: 3,
          expectedImpact: 0.4,
          implementation: 'Add visual feedback for user interactions',
          targetMetric: 'interaction_delay',
        });
      }
    }

    return recommendations.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }

    structuredLogger.info('UI Performance Monitor shutdown completed', {
      metricsRecorded: this.metrics.length,
      triggersGenerated: this.triggers.length,
      baselinesEstablished: this.baselines.size,
    });
  }
}

export const uiPerformanceMonitor = new UIPerformanceMonitorService();
export { UIPerformanceMonitorService };
