/**
 * @deprecated Use src/services/performanceMonitor.ts instead.
 * This service is retained for backward compatibility but should not be used in new code.
 *
 * Performance Tuning Service
 *
 * Fine-tuning algorithms based on testing results and real-world performance data
 * Task 4.2.4: Fine-tune algorithms based on testing results
 */

import { structuredLogger } from '../utils/logger';
import {
  dynamicResourceManager,
  ResourceAllocationStrategy,
} from './resourceManager';
import { performanceOptimizer } from './performanceOptimizer';
import { storyCache } from './storyCache';

export interface PerformanceTuningMetrics {
  memoryOptimizationEffectiveness: number; // 0-1 scale
  cacheHitRatioScore: number; // 0-1 scale
  latencyPerformanceScore: number; // 0-1 scale
  batteryOptimizationScore: number; // 0-1 scale
  overallPerformanceIndex: number; // Weighted composite score
}

export interface TuningRecommendation {
  parameter: string;
  currentValue: any;
  recommendedValue: any;
  expectedImprovement: number; // Percentage
  confidence: number; // 0-1 scale
  reasoning: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface PerformanceTuningResult {
  deviceTier: 'low' | 'medium' | 'high';
  tuningRecommendations: TuningRecommendation[];
  expectedOverallImprovement: number;
  riskAssessment: 'low' | 'medium' | 'high';
  validationRequired: boolean;
}

interface PerformanceTarget {
  memoryOptimizationTarget: number; // Percentage reduction
  cacheHitRatioTarget: number; // Percentage
  latency80thPercentileTarget: number; // Milliseconds
  batteryImpactTarget: number; // Percentage additional consumption
}

const PERFORMANCE_TARGETS: Record<string, PerformanceTarget> = {
  low: {
    memoryOptimizationTarget: 45,
    cacheHitRatioTarget: 70,
    latency80thPercentileTarget: 1500,
    batteryImpactTarget: 5,
  },
  medium: {
    memoryOptimizationTarget: 30,
    cacheHitRatioTarget: 75,
    latency80thPercentileTarget: 1200,
    batteryImpactTarget: 5,
  },
  high: {
    memoryOptimizationTarget: 20,
    cacheHitRatioTarget: 80,
    latency80thPercentileTarget: 1000,
    batteryImpactTarget: 5,
  },
};

export class PerformanceTuningService {
  private tuningHistory: Map<string, PerformanceTuningResult[]> = new Map();
  private performanceBaseline: Map<string, PerformanceTuningMetrics> =
    new Map();
  private lastTuningTime = 0;
  private tuningCooldown = 300000; // 5 minutes between tunings

  /**
   * Analyze current performance and generate tuning recommendations
   */
  async analyzeAndTune(
    deviceTier: 'low' | 'medium' | 'high',
  ): Promise<PerformanceTuningResult> {
    try {
      structuredLogger.info('Starting performance analysis and tuning', {
        deviceTier,
      });

      // Collect current performance metrics
      const currentMetrics = await this.collectPerformanceMetrics(deviceTier);

      // Compare against baseline and targets
      const performanceGaps = this.identifyPerformanceGaps(
        currentMetrics,
        deviceTier,
      );

      // Generate tuning recommendations
      const tuningRecommendations = await this.generateTuningRecommendations(
        performanceGaps,
        currentMetrics,
        deviceTier,
      );

      // Assess risk and overall improvement potential
      const riskAssessment = this.assessTuningRisk(tuningRecommendations);
      const expectedImprovement = this.calculateExpectedImprovement(
        tuningRecommendations,
      );

      const result: PerformanceTuningResult = {
        deviceTier,
        tuningRecommendations,
        expectedOverallImprovement: expectedImprovement,
        riskAssessment,
        validationRequired:
          riskAssessment !== 'low' || expectedImprovement > 25,
      };

      // Store tuning history
      this.storeTuningHistory(deviceTier, result);

      structuredLogger.info('Performance tuning analysis complete', {
        deviceTier,
        recommendationCount: tuningRecommendations.length,
        expectedImprovement,
        riskAssessment,
      });

      return result;
    } catch (error) {
      structuredLogger.error(
        'Performance tuning analysis failed',
        { deviceTier },
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Apply tuning recommendations with validation
   */
  async applyTuningRecommendations(
    recommendations: TuningRecommendation[],
    deviceTier: 'low' | 'medium' | 'high',
    validateChanges: boolean = true,
  ): Promise<{ applied: number; validated: boolean; rollback?: boolean }> {
    const now = Date.now();
    if (now - this.lastTuningTime < this.tuningCooldown) {
      throw new Error('Tuning cooldown period not elapsed');
    }

    try {
      structuredLogger.info('Applying performance tuning recommendations', {
        recommendationCount: recommendations.length,
        deviceTier,
        validateChanges,
      });

      let appliedCount = 0;
      const appliedChanges: Array<{
        parameter: string;
        oldValue: any;
        newValue: any;
      }> = [];

      // Take baseline measurements before changes
      const baselineMetrics = validateChanges
        ? await this.collectPerformanceMetrics(deviceTier)
        : null;

      // Apply recommendations in order of priority
      const sortedRecommendations = recommendations.sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });

      for (const recommendation of sortedRecommendations) {
        try {
          const oldValue = await this.applyParameterChange(recommendation);
          appliedChanges.push({
            parameter: recommendation.parameter,
            oldValue,
            newValue: recommendation.recommendedValue,
          });
          appliedCount++;

          structuredLogger.debug('Applied tuning recommendation', {
            parameter: recommendation.parameter,
            oldValue,
            newValue: recommendation.recommendedValue,
            expectedImprovement: recommendation.expectedImprovement,
          });
        } catch (error) {
          structuredLogger.warn('Failed to apply tuning recommendation', {
            parameter: recommendation.parameter,
            error: (error as Error).message,
          });
        }
      }

      this.lastTuningTime = now;

      // Validate changes if requested
      let validationPassed = true;
      let shouldRollback = false;

      if (validateChanges && baselineMetrics) {
        const postTuningMetrics = await this.collectPerformanceMetrics(
          deviceTier,
        );
        validationPassed = await this.validateTuningChanges(
          baselineMetrics,
          postTuningMetrics,
          deviceTier,
        );

        if (!validationPassed) {
          shouldRollback = await this.shouldRollbackChanges(
            baselineMetrics,
            postTuningMetrics,
          );

          if (shouldRollback) {
            await this.rollbackChanges(appliedChanges);
            structuredLogger.warn(
              'Performance tuning rolled back due to validation failure',
            );
          }
        }
      }

      structuredLogger.info('Performance tuning application complete', {
        appliedCount,
        validationPassed,
        shouldRollback,
      });

      return {
        applied: appliedCount,
        validated: validationPassed,
        rollback: shouldRollback,
      };
    } catch (error) {
      structuredLogger.error(
        'Performance tuning application failed',
        { deviceTier },
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Establish performance baseline for comparison
   */
  async establishPerformanceBaseline(
    deviceTier: 'low' | 'medium' | 'high',
  ): Promise<void> {
    try {
      const baselineMetrics = await this.collectPerformanceMetrics(deviceTier);
      this.performanceBaseline.set(deviceTier, baselineMetrics);

      structuredLogger.info('Performance baseline established', {
        deviceTier,
        metrics: baselineMetrics,
      });
    } catch (error) {
      structuredLogger.error(
        'Failed to establish performance baseline',
        { deviceTier },
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Monitor performance after tuning and suggest further improvements
   */
  async monitorPostTuningPerformance(
    deviceTier: 'low' | 'medium' | 'high',
  ): Promise<{
    performanceImprovement: number;
    targetsAchieved: boolean;
    furtherOptimizationNeeded: boolean;
  }> {
    try {
      const currentMetrics = await this.collectPerformanceMetrics(deviceTier);
      const baseline = this.performanceBaseline.get(deviceTier);

      if (!baseline) {
        throw new Error('No baseline metrics found for comparison');
      }

      const improvementPercentage = this.calculateImprovementPercentage(
        baseline,
        currentMetrics,
      );
      const targetsAchieved = this.checkTargetsAchieved(
        currentMetrics,
        deviceTier,
      );
      const furtherOptimizationNeeded =
        !targetsAchieved || improvementPercentage < 15;

      structuredLogger.info('Post-tuning performance monitoring', {
        deviceTier,
        improvementPercentage,
        targetsAchieved,
        furtherOptimizationNeeded,
      });

      return {
        performanceImprovement: improvementPercentage,
        targetsAchieved,
        furtherOptimizationNeeded,
      };
    } catch (error) {
      structuredLogger.error(
        'Post-tuning monitoring failed',
        { deviceTier },
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Generate performance tuning report
   */
  generateTuningReport(deviceTier: 'low' | 'medium' | 'high'): {
    summary: string;
    metrics: PerformanceTuningMetrics | null;
    recommendations: TuningRecommendation[];
    history: PerformanceTuningResult[];
  } {
    const baseline = this.performanceBaseline.get(deviceTier);
    const history = this.tuningHistory.get(deviceTier) || [];
    const latestResult = history[history.length - 1];

    return {
      summary: this.generateTuningSummary(deviceTier, baseline, latestResult),
      metrics: baseline || null,
      recommendations: latestResult?.tuningRecommendations || [],
      history,
    };
  }

  // Private helper methods

  private async collectPerformanceMetrics(
    deviceTier: 'low' | 'medium' | 'high',
  ): Promise<PerformanceTuningMetrics> {
    try {
      // Simulate memory optimization measurement
      const memoryOptimizationEffectiveness =
        await this.measureMemoryOptimization(deviceTier);

      // Simulate cache performance measurement
      const cacheHitRatioScore = await this.measureCachePerformance();

      // Simulate latency measurement
      const latencyPerformanceScore = await this.measureLatencyPerformance(
        deviceTier,
      );

      // Simulate battery optimization measurement
      const batteryOptimizationScore = await this.measureBatteryOptimization();

      // Calculate weighted composite score
      const weights = { memory: 0.3, cache: 0.25, latency: 0.3, battery: 0.15 };
      const overallPerformanceIndex =
        memoryOptimizationEffectiveness * weights.memory +
        cacheHitRatioScore * weights.cache +
        latencyPerformanceScore * weights.latency +
        batteryOptimizationScore * weights.battery;

      return {
        memoryOptimizationEffectiveness,
        cacheHitRatioScore,
        latencyPerformanceScore,
        batteryOptimizationScore,
        overallPerformanceIndex,
      };
    } catch (error) {
      structuredLogger.error(
        'Failed to collect performance metrics',
        { deviceTier },
        error as Error,
      );
      throw error;
    }
  }

  private identifyPerformanceGaps(
    metrics: PerformanceTuningMetrics,
    _deviceTier: 'low' | 'medium' | 'high',
  ): Record<string, number> {
    return {
      memoryGap: Math.max(0, 0.8 - metrics.memoryOptimizationEffectiveness), // Target 80% effectiveness
      cacheGap: Math.max(0, 0.8 - metrics.cacheHitRatioScore),
      latencyGap: Math.max(0, 0.8 - metrics.latencyPerformanceScore),
      batteryGap: Math.max(0, 0.8 - metrics.batteryOptimizationScore),
    };
  }

  private async generateTuningRecommendations(
    performanceGaps: Record<string, number>,
    currentMetrics: PerformanceTuningMetrics,
    deviceTier: 'low' | 'medium' | 'high',
  ): Promise<TuningRecommendation[]> {
    const recommendations: TuningRecommendation[] = [];
    const currentStrategy = dynamicResourceManager.getCurrentStrategy();

    // Memory optimization recommendations
    if (performanceGaps.memoryGap > 0.1) {
      recommendations.push(
        await this.generateMemoryTuningRecommendation(
          performanceGaps.memoryGap,
          currentStrategy,
          deviceTier,
        ),
      );
    }

    // Cache optimization recommendations
    if (performanceGaps.cacheGap > 0.1) {
      recommendations.push(
        await this.generateCacheTuningRecommendation(
          performanceGaps.cacheGap,
          currentStrategy,
          deviceTier,
        ),
      );
    }

    // Latency optimization recommendations
    if (performanceGaps.latencyGap > 0.1) {
      recommendations.push(
        await this.generateLatencyTuningRecommendation(
          performanceGaps.latencyGap,
          currentStrategy,
          deviceTier,
        ),
      );
    }

    // Battery optimization recommendations
    if (performanceGaps.batteryGap > 0.1) {
      recommendations.push(
        await this.generateBatteryTuningRecommendation(
          performanceGaps.batteryGap,
          currentStrategy,
          deviceTier,
        ),
      );
    }

    return recommendations.filter(rec => rec.confidence > 0.6); // Only high-confidence recommendations
  }

  private async generateMemoryTuningRecommendation(
    gap: number,
    strategy: ResourceAllocationStrategy,
    _deviceTier: 'low' | 'medium' | 'high',
  ): Promise<TuningRecommendation> {
    const currentMemoryLimit = strategy.memoryLimitMB;
    const gapSeverity = gap > 0.3 ? 'high' : gap > 0.15 ? 'medium' : 'low';

    let recommendedValue: number;
    let expectedImprovement: number;
    let priority: 'low' | 'medium' | 'high' | 'critical';

    if (gapSeverity === 'high') {
      recommendedValue = Math.max(30, currentMemoryLimit * 0.8); // 20% reduction
      expectedImprovement = 25;
      priority = 'high';
    } else if (gapSeverity === 'medium') {
      recommendedValue = Math.max(40, currentMemoryLimit * 0.9); // 10% reduction
      expectedImprovement = 15;
      priority = 'medium';
    } else {
      recommendedValue = Math.max(45, currentMemoryLimit * 0.95); // 5% reduction
      expectedImprovement = 8;
      priority = 'low';
    }

    return {
      parameter: 'memoryLimitMB',
      currentValue: currentMemoryLimit,
      recommendedValue,
      expectedImprovement,
      confidence: 0.85,
      reasoning: `Memory optimization gap of ${(gap * 100).toFixed(
        1,
      )}% detected. Reducing memory limit can improve cleanup effectiveness.`,
      priority,
    };
  }

  private async generateCacheTuningRecommendation(
    gap: number,
    strategy: ResourceAllocationStrategy,
    deviceTier: 'low' | 'medium' | 'high',
  ): Promise<TuningRecommendation> {
    const currentStrategy = strategy.cacheStrategy;
    const strategies = ['minimal', 'balanced', 'aggressive'];
    const currentIndex = strategies.indexOf(currentStrategy);

    let recommendedValue: string;
    let expectedImprovement: number;
    let priority: 'low' | 'medium' | 'high' | 'critical';

    if (gap > 0.25 && currentIndex < 2) {
      recommendedValue = strategies[currentIndex + 1];
      expectedImprovement = 20;
      priority = 'medium';
    } else if (gap > 0.15 && deviceTier !== 'low') {
      recommendedValue = 'balanced';
      expectedImprovement = 12;
      priority = 'low';
    } else {
      // Tune cache parameters instead
      return {
        parameter: 'cacheEvictionThreshold',
        currentValue: 0.8,
        recommendedValue: 0.75,
        expectedImprovement: 8,
        confidence: 0.7,
        reasoning:
          'Cache performance can be improved by adjusting eviction threshold.',
        priority: 'low',
      };
    }

    return {
      parameter: 'cacheStrategy',
      currentValue: currentStrategy,
      recommendedValue,
      expectedImprovement,
      confidence: 0.8,
      reasoning: `Cache hit ratio gap of ${(gap * 100).toFixed(
        1,
      )}% can be improved with more aggressive caching.`,
      priority,
    };
  }

  private async generateLatencyTuningRecommendation(
    gap: number,
    strategy: ResourceAllocationStrategy,
    deviceTier: 'low' | 'medium' | 'high',
  ): Promise<TuningRecommendation> {
    const currentConcurrent = strategy.maxConcurrentOperations;

    if (gap > 0.2 && currentConcurrent < 4 && deviceTier !== 'low') {
      return {
        parameter: 'maxConcurrentOperations',
        currentValue: currentConcurrent,
        recommendedValue: Math.min(4, currentConcurrent + 1),
        expectedImprovement: 18,
        confidence: 0.75,
        reasoning: `Latency gap of ${(gap * 100).toFixed(
          1,
        )}% can be improved by increasing concurrent operations.`,
        priority: 'medium',
      };
    }

    return {
      parameter: 'enablePrefetching',
      currentValue: strategy.enablePrefetching,
      recommendedValue: true,
      expectedImprovement: 12,
      confidence: 0.7,
      reasoning: 'Enabling prefetching can reduce story generation latency.',
      priority: 'low',
    };
  }

  private async generateBatteryTuningRecommendation(
    gap: number,
    strategy: ResourceAllocationStrategy,
    _deviceTier: 'low' | 'medium' | 'high',
  ): Promise<TuningRecommendation> {
    if (gap > 0.15 && strategy.enableBackgroundTasks) {
      return {
        parameter: 'enableBackgroundTasks',
        currentValue: true,
        recommendedValue: false,
        expectedImprovement: 15,
        confidence: 0.8,
        reasoning: `Battery optimization gap of ${(gap * 100).toFixed(
          1,
        )}% can be improved by reducing background activity.`,
        priority: 'medium',
      };
    }

    return {
      parameter: 'animationComplexity',
      currentValue: strategy.animationComplexity,
      recommendedValue:
        strategy.animationComplexity === 'full' ? 'reduced' : 'none',
      expectedImprovement: 8,
      confidence: 0.65,
      reasoning:
        'Reducing animation complexity can improve battery performance.',
      priority: 'low',
    };
  }

  private async applyParameterChange(
    recommendation: TuningRecommendation,
  ): Promise<any> {
    const currentStrategy = dynamicResourceManager.getCurrentStrategy();
    const oldValue = (currentStrategy as any)[recommendation.parameter];

    // Create new strategy with the recommended change
    const newStrategy = {
      ...currentStrategy,
      [recommendation.parameter]: recommendation.recommendedValue,
    };

    // Apply the new strategy
    await dynamicResourceManager.applyResourceAllocationStrategy(newStrategy);

    return oldValue;
  }

  private async rollbackChanges(
    appliedChanges: Array<{ parameter: string; oldValue: any; newValue: any }>,
  ): Promise<void> {
    const currentStrategy = dynamicResourceManager.getCurrentStrategy();

    // Restore original values
    const restoredStrategy = { ...currentStrategy };
    for (const change of appliedChanges) {
      (restoredStrategy as any)[change.parameter] = change.oldValue;
    }

    await dynamicResourceManager.applyResourceAllocationStrategy(
      restoredStrategy,
    );
  }

  // Performance measurement helpers

  private async measureMemoryOptimization(
    deviceTier: 'low' | 'medium' | 'high',
  ): Promise<number> {
    const target = PERFORMANCE_TARGETS[deviceTier].memoryOptimizationTarget;
    const memoryConfig = dynamicResourceManager.getMemoryConfig();
    // Use real memory config data: ratio of warning threshold to base limit
    // indicates how aggressively memory is being managed
    const effectiveness = memoryConfig
      ? ((memoryConfig.baseMemoryLimit - memoryConfig.warningThreshold) /
          memoryConfig.baseMemoryLimit) *
        100
      : 0;
    return Math.min(1, effectiveness / target);
  }

  private async measureCachePerformance(): Promise<number> {
    // Use real cache stats from the story cache service
    const cacheStats = storyCache.getStats();
    const hitRatio =
      cacheStats.totalRequests > 0
        ? (cacheStats.totalHits / cacheStats.totalRequests) * 100
        : 0;
    return Math.min(1, hitRatio / 80); // Target 80%
  }

  private async measureLatencyPerformance(
    deviceTier: 'low' | 'medium' | 'high',
  ): Promise<number> {
    const target = PERFORMANCE_TARGETS[deviceTier].latency80thPercentileTarget;
    // Use real API response time from performance optimizer metrics
    const perfMetrics = performanceOptimizer.getMetrics();
    const currentLatency =
      perfMetrics.apiResponseTime > 0 ? perfMetrics.apiResponseTime : target; // No data yet = assume on-target
    return Math.min(1, target / Math.max(currentLatency, 1));
  }

  private async measureBatteryOptimization(): Promise<number> {
    // Use real battery optimization state from performance optimizer
    const isBatteryOptimized = performanceOptimizer.isBatteryOptimized();
    const settings = performanceOptimizer.getOptimizationSettings();
    // Score based on actual optimization state:
    // Battery-optimized + background disabled = best score
    let score = 0.5; // baseline
    if (isBatteryOptimized) score += 0.3;
    if (!settings.backgroundProcessing) score += 0.1;
    if (!settings.prefetchEnabled) score += 0.1;
    return Math.min(1, score);
  }

  private assessTuningRisk(
    recommendations: TuningRecommendation[],
  ): 'low' | 'medium' | 'high' {
    const highRiskChanges = recommendations.filter(
      r => r.priority === 'critical' || r.expectedImprovement > 30,
    ).length;

    const mediumRiskChanges = recommendations.filter(
      r => r.priority === 'high' || r.expectedImprovement > 15,
    ).length;

    if (highRiskChanges > 0) return 'high';
    if (mediumRiskChanges > 2) return 'medium';
    return 'low';
  }

  private calculateExpectedImprovement(
    recommendations: TuningRecommendation[],
  ): number {
    return (
      recommendations.reduce(
        (total, rec) => total + rec.expectedImprovement * rec.confidence,
        0,
      ) / recommendations.length
    );
  }

  private storeTuningHistory(
    deviceTier: string,
    result: PerformanceTuningResult,
  ): void {
    if (!this.tuningHistory.has(deviceTier)) {
      this.tuningHistory.set(deviceTier, []);
    }
    const history = this.tuningHistory.get(deviceTier)!;
    history.push(result);

    // Keep only last 10 entries
    if (history.length > 10) {
      history.splice(0, history.length - 10);
    }
  }

  private async validateTuningChanges(
    baseline: PerformanceTuningMetrics,
    current: PerformanceTuningMetrics,
    _deviceTier: 'low' | 'medium' | 'high',
  ): Promise<boolean> {
    const improvementThreshold = 0.05; // 5% minimum improvement

    const overallImprovement =
      current.overallPerformanceIndex - baseline.overallPerformanceIndex;

    if (overallImprovement < improvementThreshold) {
      structuredLogger.warn(
        'Performance tuning did not meet improvement threshold',
        {
          baseline: baseline.overallPerformanceIndex,
          current: current.overallPerformanceIndex,
          improvement: overallImprovement,
        },
      );
      return false;
    }

    return true;
  }

  private async shouldRollbackChanges(
    baseline: PerformanceTuningMetrics,
    current: PerformanceTuningMetrics,
  ): Promise<boolean> {
    const regressionThreshold = -0.1; // 10% regression triggers rollback

    const overallChange =
      current.overallPerformanceIndex - baseline.overallPerformanceIndex;

    return overallChange < regressionThreshold;
  }

  private checkTargetsAchieved(
    metrics: PerformanceTuningMetrics,
    _deviceTier: 'low' | 'medium' | 'high',
  ): boolean {
    const targetThreshold = 0.8; // 80% of target performance

    return (
      metrics.memoryOptimizationEffectiveness >= targetThreshold &&
      metrics.cacheHitRatioScore >= targetThreshold &&
      metrics.latencyPerformanceScore >= targetThreshold &&
      metrics.batteryOptimizationScore >= targetThreshold
    );
  }

  private calculateImprovementPercentage(
    baseline: PerformanceTuningMetrics,
    current: PerformanceTuningMetrics,
  ): number {
    const improvement =
      current.overallPerformanceIndex - baseline.overallPerformanceIndex;
    return (improvement / baseline.overallPerformanceIndex) * 100;
  }

  private generateTuningSummary(
    deviceTier: string,
    baseline: PerformanceTuningMetrics | undefined,
    latestResult: PerformanceTuningResult | undefined,
  ): string {
    if (!baseline || !latestResult) {
      return `Performance tuning for ${deviceTier} devices: No data available`;
    }

    const recommendationCount = latestResult.tuningRecommendations.length;
    const improvement = latestResult.expectedOverallImprovement;

    return `Performance tuning for ${deviceTier} devices: ${recommendationCount} recommendations generated with ${improvement.toFixed(
      1,
    )}% expected improvement. Risk assessment: ${latestResult.riskAssessment}.`;
  }
}

export const performanceTuner = new PerformanceTuningService();
