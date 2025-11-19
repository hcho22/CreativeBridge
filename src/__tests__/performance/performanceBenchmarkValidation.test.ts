/**
 * Performance Benchmark Validation
 * 
 * Validates performance improvements against established benchmarks and baselines
 * Task 4.2.6: Implement performance benchmark validation
 */

import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { deviceTierTestFramework } from './deviceTierTestFramework';
import { performanceTuner } from '../../services/performanceTuner';
import { dynamicResourceManager } from '../../services/resourceManager';
import { performanceOptimizer } from '../../services/performanceOptimizer';
import { structuredLogger } from '../../utils/logger';

interface BenchmarkTarget {
  metric: string;
  baseline: number;
  target: number;
  unit: string;
  direction: 'higher_better' | 'lower_better';
  tolerance: number; // Percentage tolerance for validation
}

interface BenchmarkResult {
  metric: string;
  baseline: number;
  current: number;
  target: number;
  improvement: number; // Percentage improvement
  achieved: boolean;
  confidence: number; // Statistical confidence level
}

interface DeviceTierBenchmark {
  tier: 'low' | 'medium' | 'high';
  targets: BenchmarkTarget[];
  results: BenchmarkResult[];
  overallScore: number; // 0-100 composite score
  passed: boolean;
}

const PERFORMANCE_BENCHMARKS: Record<string, BenchmarkTarget[]> = {
  low: [
    {
      metric: 'memoryOptimization',
      baseline: 0,
      target: 45,
      unit: 'percentage',
      direction: 'higher_better',
      tolerance: 10,
    },
    {
      metric: 'cacheHitRatio',
      baseline: 50,
      target: 70,
      unit: 'percentage',
      direction: 'higher_better',
      tolerance: 5,
    },
    {
      metric: 'latency80thPercentile',
      baseline: 2000,
      target: 1500,
      unit: 'milliseconds',
      direction: 'lower_better',
      tolerance: 10,
    },
    {
      metric: 'memoryUsage',
      baseline: 80 * 1024 * 1024,
      target: 50 * 1024 * 1024,
      unit: 'bytes',
      direction: 'lower_better',
      tolerance: 15,
    },
    {
      metric: 'batteryImpact',
      baseline: 8,
      target: 5,
      unit: 'percentage',
      direction: 'lower_better',
      tolerance: 20,
    },
  ],
  medium: [
    {
      metric: 'memoryOptimization',
      baseline: 0,
      target: 30,
      unit: 'percentage',
      direction: 'higher_better',
      tolerance: 10,
    },
    {
      metric: 'cacheHitRatio',
      baseline: 60,
      target: 75,
      unit: 'percentage',
      direction: 'higher_better',
      tolerance: 5,
    },
    {
      metric: 'latency80thPercentile',
      baseline: 1800,
      target: 1200,
      unit: 'milliseconds',
      direction: 'lower_better',
      tolerance: 10,
    },
    {
      metric: 'memoryUsage',
      baseline: 150 * 1024 * 1024,
      target: 100 * 1024 * 1024,
      unit: 'bytes',
      direction: 'lower_better',
      tolerance: 15,
    },
    {
      metric: 'batteryImpact',
      baseline: 8,
      target: 5,
      unit: 'percentage',
      direction: 'lower_better',
      tolerance: 20,
    },
  ],
  high: [
    {
      metric: 'memoryOptimization',
      baseline: 0,
      target: 20,
      unit: 'percentage',
      direction: 'higher_better',
      tolerance: 15,
    },
    {
      metric: 'cacheHitRatio',
      baseline: 70,
      target: 80,
      unit: 'percentage',
      direction: 'higher_better',
      tolerance: 5,
    },
    {
      metric: 'latency80thPercentile',
      baseline: 1500,
      target: 1000,
      unit: 'milliseconds',
      direction: 'lower_better',
      tolerance: 10,
    },
    {
      metric: 'memoryUsage',
      baseline: 250 * 1024 * 1024,
      target: 200 * 1024 * 1024,
      unit: 'bytes',
      direction: 'lower_better',
      tolerance: 15,
    },
    {
      metric: 'batteryImpact',
      baseline: 6,
      target: 5,
      unit: 'percentage',
      direction: 'lower_better',
      tolerance: 20,
    },
  ],
};

describe('Performance Benchmark Validation', () => {
  let benchmarkResults: Record<string, DeviceTierBenchmark> = {};

  beforeAll(async () => {
    structuredLogger.info('Starting performance benchmark validation');
    
    // Initialize systems
    jest.setTimeout(300000); // 5 minutes for comprehensive testing
  });

  afterAll(() => {
    structuredLogger.info('Performance benchmark validation complete', {
      results: benchmarkResults,
    });
  });

  describe('Device Tier Benchmark Validation', () => {
    it('should validate low-end device performance benchmarks', async () => {
      const tierBenchmark = await validateTierBenchmarks('low');
      benchmarkResults.low = tierBenchmark;

      expect(tierBenchmark.passed).toBe(true);
      expect(tierBenchmark.overallScore).toBeGreaterThan(70); // Minimum 70% overall score

      // Verify critical benchmarks
      const memoryOptimization = tierBenchmark.results.find(r => r.metric === 'memoryOptimization');
      expect(memoryOptimization?.achieved).toBe(true);
      expect(memoryOptimization?.improvement).toBeGreaterThanOrEqual(40); // 40-50% target

      const cacheHitRatio = tierBenchmark.results.find(r => r.metric === 'cacheHitRatio');
      expect(cacheHitRatio?.achieved).toBe(true);
      expect(cacheHitRatio?.current).toBeGreaterThanOrEqual(70);

      const latency = tierBenchmark.results.find(r => r.metric === 'latency80thPercentile');
      expect(latency?.achieved).toBe(true);
      expect(latency?.current).toBeLessThanOrEqual(1500);
    });

    it('should validate medium-tier device performance benchmarks', async () => {
      const tierBenchmark = await validateTierBenchmarks('medium');
      benchmarkResults.medium = tierBenchmark;

      expect(tierBenchmark.passed).toBe(true);
      expect(tierBenchmark.overallScore).toBeGreaterThan(75); // Higher target for medium tier

      // Verify balanced performance
      const results = tierBenchmark.results;
      const achievedBenchmarks = results.filter(r => r.achieved).length;
      const totalBenchmarks = results.length;
      
      expect(achievedBenchmarks / totalBenchmarks).toBeGreaterThanOrEqual(0.8); // 80% success rate
    });

    it('should validate high-end device performance benchmarks', async () => {
      const tierBenchmark = await validateTierBenchmarks('high');
      benchmarkResults.high = tierBenchmark;

      expect(tierBenchmark.passed).toBe(true);
      expect(tierBenchmark.overallScore).toBeGreaterThan(80); // Highest target for high-end

      // High-end devices should achieve all or nearly all benchmarks
      const results = tierBenchmark.results;
      const achievedBenchmarks = results.filter(r => r.achieved).length;
      const totalBenchmarks = results.length;
      
      expect(achievedBenchmarks / totalBenchmarks).toBeGreaterThanOrEqual(0.9); // 90% success rate
    });
  });

  describe('Cross-Tier Performance Consistency', () => {
    it('should demonstrate progressive performance improvements across tiers', async () => {
      // Ensure all tier benchmarks are complete
      if (!benchmarkResults.low) benchmarkResults.low = await validateTierBenchmarks('low');
      if (!benchmarkResults.medium) benchmarkResults.medium = await validateTierBenchmarks('medium');
      if (!benchmarkResults.high) benchmarkResults.high = await validateTierBenchmarks('high');

      // Overall scores should improve across tiers
      expect(benchmarkResults.medium.overallScore).toBeGreaterThan(benchmarkResults.low.overallScore);
      expect(benchmarkResults.high.overallScore).toBeGreaterThan(benchmarkResults.medium.overallScore);

      // Cache hit ratios should improve
      const lowCache = benchmarkResults.low.results.find(r => r.metric === 'cacheHitRatio')?.current || 0;
      const mediumCache = benchmarkResults.medium.results.find(r => r.metric === 'cacheHitRatio')?.current || 0;
      const highCache = benchmarkResults.high.results.find(r => r.metric === 'cacheHitRatio')?.current || 0;

      expect(mediumCache).toBeGreaterThan(lowCache);
      expect(highCache).toBeGreaterThan(mediumCache);

      // Latencies should improve
      const lowLatency = benchmarkResults.low.results.find(r => r.metric === 'latency80thPercentile')?.current || Infinity;
      const mediumLatency = benchmarkResults.medium.results.find(r => r.metric === 'latency80thPercentile')?.current || Infinity;
      const highLatency = benchmarkResults.high.results.find(r => r.metric === 'latency80thPercentile')?.current || Infinity;

      expect(mediumLatency).toBeLessThan(lowLatency);
      expect(highLatency).toBeLessThan(mediumLatency);
    });

    it('should validate memory optimization effectiveness scaling', async () => {
      const tiers = ['low', 'medium', 'high'] as const;
      const optimizationResults: Record<string, number> = {};

      for (const tier of tiers) {
        const tierBenchmark = benchmarkResults[tier] || await validateTierBenchmarks(tier);
        const memoryResult = tierBenchmark.results.find(r => r.metric === 'memoryOptimization');
        optimizationResults[tier] = memoryResult?.improvement || 0;
      }

      // Low-end devices should show the highest optimization (most aggressive)
      expect(optimizationResults.low).toBeGreaterThan(optimizationResults.medium);
      expect(optimizationResults.medium).toBeGreaterThan(optimizationResults.high);

      // But all should meet their respective targets
      expect(optimizationResults.low).toBeGreaterThanOrEqual(40);
      expect(optimizationResults.medium).toBeGreaterThanOrEqual(25);
      expect(optimizationResults.high).toBeGreaterThanOrEqual(15);
    });
  });

  describe('Performance Regression Detection', () => {
    it('should detect performance regressions across scenarios', async () => {
      const regressionResults = await deviceTierTestFramework.runRegressionTests();

      expect(regressionResults.passed).toBe(true);
      expect(regressionResults.regressions.length).toBe(0);

      if (!regressionResults.passed) {
        console.warn('Performance regressions detected:', regressionResults.regressions);
        
        // Log details of any regressions
        regressionResults.regressions.forEach(regression => {
          structuredLogger.warn('Performance regression detected', {
            device: regression.device,
            scenario: regression.scenario,
            metric: regression.metric,
            degradation: `${regression.degradation.toFixed(2)}%`,
          });
        });
      }
    });

    it('should validate performance stability over time', async () => {
      const stabilityResults: number[] = [];
      const iterations = 5;

      // Run multiple benchmark iterations to test stability
      for (let i = 0; i < iterations; i++) {
        const tierResults = await validateTierBenchmarks('medium');
        const overallScore = tierResults.overallScore;
        stabilityResults.push(overallScore);
        
        // Brief pause between iterations
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Calculate coefficient of variation
      const mean = stabilityResults.reduce((sum, score) => sum + score, 0) / stabilityResults.length;
      const variance = stabilityResults.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / stabilityResults.length;
      const standardDeviation = Math.sqrt(variance);
      const coefficientOfVariation = standardDeviation / mean;

      // Coefficient of variation should be low (< 10% for stable performance)
      expect(coefficientOfVariation).toBeLessThan(0.1);
      expect(mean).toBeGreaterThan(70); // Consistent high performance
    });

    it('should validate benchmark confidence intervals', async () => {
      const tierBenchmark = await validateTierBenchmarks('medium');
      
      // All benchmark results should have high confidence
      tierBenchmark.results.forEach(result => {
        expect(result.confidence).toBeGreaterThan(0.8); // 80% confidence minimum
      });

      // Critical metrics should have very high confidence
      const criticalMetrics = ['memoryOptimization', 'cacheHitRatio', 'latency80thPercentile'];
      criticalMetrics.forEach(metricName => {
        const result = tierBenchmark.results.find(r => r.metric === metricName);
        expect(result?.confidence).toBeGreaterThan(0.9); // 90% confidence for critical metrics
      });
    });
  });

  describe('Performance Optimization Impact', () => {
    it('should validate optimization impact vs. baseline', async () => {
      const tiers = ['low', 'medium', 'high'] as const;

      for (const tier of tiers) {
        const tierBenchmark = await validateTierBenchmarks(tier);
        
        tierBenchmark.results.forEach(result => {
          const expectedImprovement = calculateExpectedImprovement(
            result.baseline,
            result.target,
            result.metric
          );
          
          // Should achieve at least 70% of expected improvement
          const improvementRatio = Math.abs(result.improvement) / expectedImprovement;
          expect(improvementRatio).toBeGreaterThan(0.7);
        });
      }
    });

    it('should validate optimization does not harm other metrics', async () => {
      const tierBenchmark = await validateTierBenchmarks('medium');
      
      // Ensure no metric shows significant degradation
      tierBenchmark.results.forEach(result => {
        if (result.metric !== 'memoryOptimization') { // Baseline is 0 for this metric
          // No more than 10% degradation from baseline should be allowed
          if (result.baseline > 0) {
            const degradationRatio = (result.baseline - result.current) / result.baseline;
            expect(degradationRatio).toBeLessThan(0.1);
          }
        }
      });
    });
  });

  describe('Edge Case Performance Validation', () => {
    it('should validate performance under extreme memory pressure', async () => {
      // Test specifically for high memory pressure scenarios
      const extremeResults = await deviceTierTestFramework.runTierSpecificTests('low');
      const stressResults = extremeResults.filter(r => r.scenario.name === 'Stress Test');
      
      // Even under stress, core functionality should work
      stressResults.forEach(result => {
        expect(result.metrics.errorRate).toBeLessThan(0.1); // Max 10% error rate under stress
        expect(result.metrics.stabilityScore).toBeGreaterThan(0.6); // Minimum stability
      });
    });

    it('should validate performance under low battery conditions', async () => {
      const lowBatteryResults = await deviceTierTestFramework.runTierSpecificTests('medium');
      const batteryResults = lowBatteryResults.filter(r => r.scenario.name === 'Low Battery');
      
      batteryResults.forEach(result => {
        // Battery optimizations should be active
        expect(result.metrics.batteryImpact).toBeLessThan(3); // Very low impact during low battery
        expect(result.targetsAchieved.battery).toBe(true);
      });
    });

    it('should validate performance with poor network conditions', async () => {
      const networkResults = await deviceTierTestFramework.runTierSpecificTests('high');
      const poorNetworkResults = networkResults.filter(r => r.scenario.name === 'Network Constraints');
      
      poorNetworkResults.forEach(result => {
        // Network adaptations should maintain reasonable performance
        expect(result.metrics.latency80thPercentile).toBeLessThan(2000); // Max 2s even with poor network
        expect(result.metrics.cacheHitRatio).toBeGreaterThan(60); // Cache should help with poor network
      });
    });
  });

  // Helper functions

  async function validateTierBenchmarks(tier: 'low' | 'medium' | 'high'): Promise<DeviceTierBenchmark> {
    const targets = PERFORMANCE_BENCHMARKS[tier];
    const results: BenchmarkResult[] = [];

    // Run tier-specific performance tests
    const testResults = await deviceTierTestFramework.runTierSpecificTests(tier);
    
    // Calculate aggregate metrics from test results
    const aggregateMetrics = calculateAggregateMetrics(testResults);

    // Validate each benchmark target
    for (const target of targets) {
      const currentValue = aggregateMetrics[target.metric] || 0;
      const result = evaluateBenchmark(target, currentValue);
      results.push(result);
    }

    // Calculate overall score
    const overallScore = calculateOverallScore(results);
    const passed = results.filter(r => r.achieved).length / results.length >= 0.7; // 70% pass rate

    return {
      tier,
      targets,
      results,
      overallScore,
      passed,
    };
  }

  function calculateAggregateMetrics(testResults: any[]): Record<string, number> {
    if (testResults.length === 0) return {};

    const aggregates: Record<string, number[]> = {};
    
    // Collect all metric values
    testResults.forEach(result => {
      Object.entries(result.metrics).forEach(([metric, value]) => {
        if (typeof value === 'number') {
          if (!aggregates[metric]) aggregates[metric] = [];
          aggregates[metric].push(value);
        }
      });
    });

    // Calculate representative values (median for robustness)
    const metrics: Record<string, number> = {};
    Object.entries(aggregates).forEach(([metric, values]) => {
      values.sort((a, b) => a - b);
      const median = values[Math.floor(values.length / 2)];
      metrics[metric] = median;
    });

    return metrics;
  }

  function evaluateBenchmark(target: BenchmarkTarget, currentValue: number): BenchmarkResult {
    let improvement: number;
    let achieved: boolean;

    if (target.direction === 'higher_better') {
      improvement = ((currentValue - target.baseline) / Math.abs(target.target - target.baseline)) * 100;
      achieved = currentValue >= target.target * (1 - target.tolerance / 100);
    } else {
      improvement = ((target.baseline - currentValue) / Math.abs(target.baseline - target.target)) * 100;
      achieved = currentValue <= target.target * (1 + target.tolerance / 100);
    }

    // Calculate confidence based on how close we are to target
    const distanceFromTarget = Math.abs(currentValue - target.target) / Math.abs(target.target);
    const confidence = Math.max(0.5, 1 - distanceFromTarget);

    return {
      metric: target.metric,
      baseline: target.baseline,
      current: currentValue,
      target: target.target,
      improvement,
      achieved,
      confidence,
    };
  }

  function calculateOverallScore(results: BenchmarkResult[]): number {
    const weights = {
      memoryOptimization: 0.25,
      cacheHitRatio: 0.2,
      latency80thPercentile: 0.25,
      memoryUsage: 0.15,
      batteryImpact: 0.15,
    };

    let totalScore = 0;
    let totalWeight = 0;

    results.forEach(result => {
      const weight = weights[result.metric as keyof typeof weights] || 0.1;
      const score = result.achieved ? 100 : Math.max(0, 50 + result.improvement);
      
      totalScore += score * weight;
      totalWeight += weight;
    });

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  function calculateExpectedImprovement(baseline: number, target: number, metric: string): number {
    if (metric === 'memoryOptimization') {
      return target; // Target is the improvement percentage
    }
    
    return Math.abs((target - baseline) / baseline) * 100;
  }
});