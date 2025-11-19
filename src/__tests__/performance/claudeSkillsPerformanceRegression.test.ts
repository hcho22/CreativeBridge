/**
 * Claude Skills Performance Regression Tests
 * 
 * Performance regression testing for Task 2.2
 * Detects performance degradation in skill execution
 */

import { createMockSkillManager } from '../mocks/claudeSkillsMock';
import { SkillManager } from '../../types/claudeSkills';
import { SkillTestUtils, MOCK_EXECUTION_TIMES } from '../mocks/claudeSkillsMock';
import { claudeSkillsMonitor } from '../../services/claudeSkillsMonitor';

interface PerformanceBaseline {
  skillType: string;
  averageTime: number;
  p50: number;
  p95: number;
  p99: number;
  sampleSize: number;
}

interface PerformanceRegression {
  skillType: string;
  currentAverage: number;
  baselineAverage: number;
  regressionPercentage: number;
  significant: boolean;
}

class PerformanceRegressionDetector {
  private baselines: Map<string, PerformanceBaseline> = new Map();
  private readonly REGRESSION_THRESHOLD = 0.2; // 20% slowdown

  /**
   * Establish performance baseline
   */
  async establishBaseline(
    skillManager: SkillManager,
    skillType: string,
    iterations: number = 50
  ): Promise<PerformanceBaseline> {
    const executionTimes: number[] = [];
    const input = SkillTestUtils.createTestInput[skillType as keyof typeof SkillTestUtils.createTestInput]();

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      await skillManager.executeSkill(`${skillType}_mock`, input);
      executionTimes.push(performance.now() - startTime);
    }

    executionTimes.sort((a, b) => a - b);

    const average = executionTimes.reduce((sum, t) => sum + t, 0) / executionTimes.length;
    const p50 = executionTimes[Math.floor(executionTimes.length * 0.5)];
    const p95 = executionTimes[Math.floor(executionTimes.length * 0.95)];
    const p99 = executionTimes[Math.floor(executionTimes.length * 0.99)];

    const baseline: PerformanceBaseline = {
      skillType,
      averageTime: average,
      p50,
      p95,
      p99,
      sampleSize: iterations,
    };

    this.baselines.set(skillType, baseline);
    return baseline;
  }

  /**
   * Check for performance regression
   */
  async checkRegression(
    skillManager: SkillManager,
    skillType: string,
    iterations: number = 20
  ): Promise<PerformanceRegression | null> {
    const baseline = this.baselines.get(skillType);
    if (!baseline) {
      throw new Error(`No baseline established for ${skillType}`);
    }

    const executionTimes: number[] = [];
    const input = SkillTestUtils.createTestInput[skillType as keyof typeof SkillTestUtils.createTestInput]();

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      await skillManager.executeSkill(`${skillType}_mock`, input);
      executionTimes.push(performance.now() - startTime);
    }

    const currentAverage =
      executionTimes.reduce((sum, t) => sum + t, 0) / executionTimes.length;
    const regressionPercentage =
      ((currentAverage - baseline.averageTime) / baseline.averageTime) * 100;
    const significant = regressionPercentage > this.REGRESSION_THRESHOLD * 100;

    return {
      skillType,
      currentAverage,
      baselineAverage: baseline.averageTime,
      regressionPercentage,
      significant,
    };
  }

  /**
   * Get baseline for skill type
   */
  getBaseline(skillType: string): PerformanceBaseline | undefined {
    return this.baselines.get(skillType);
  }
}

describe('Claude Skills Performance Regression Tests', () => {
  let skillManager: SkillManager;
  let detector: PerformanceRegressionDetector;

  beforeAll(async () => {
    skillManager = createMockSkillManager();
    await skillManager.initialize({
      apiKey: 'test_key',
      environment: 'development',
      enabledSkills: [
        'ContentPredictionSkill',
        'QualityAssessmentSkill',
        'ResourceOptimizationSkill',
      ],
      performanceMode: 'balanced',
    });
    detector = new PerformanceRegressionDetector();
  });

  beforeEach(async () => {
    await claudeSkillsMonitor.resetMetrics();
  });

  describe('Baseline Establishment', () => {
    test('Baseline performance established and documented', async () => {
      const skillType = 'ContentPredictionSkill';
      const baseline = await detector.establishBaseline(skillManager, skillType, 30);

      expect(baseline).toBeDefined();
      expect(baseline.skillType).toBe(skillType);
      expect(baseline.averageTime).toBeGreaterThan(0);
      expect(baseline.p50).toBeGreaterThan(0);
      expect(baseline.p95).toBeGreaterThanOrEqual(baseline.p50);
      expect(baseline.p99).toBeGreaterThanOrEqual(baseline.p95);
      expect(baseline.sampleSize).toBe(30);
    });

    test('Baseline consistent across multiple establishments', async () => {
      const skillType = 'ContentPredictionSkill';
      
      const baseline1 = await detector.establishBaseline(skillManager, skillType, 20);
      const baseline2 = await detector.establishBaseline(skillManager, skillType, 20);

      // Baselines should be similar (within 20%)
      const difference = Math.abs(baseline1.averageTime - baseline2.averageTime);
      const maxDifference = baseline1.averageTime * 0.2;
      expect(difference).toBeLessThan(maxDifference);
    });
  });

  describe('Regression Detection', () => {
    test('Performance regression tests trigger on 20% slowdown', async () => {
      const skillType = 'ContentPredictionSkill';
      
      // Establish baseline
      await detector.establishBaseline(skillManager, skillType, 30);

      // Create slow manager to simulate regression
      const slowManager = createMockSkillManager();
      await slowManager.initialize({
        apiKey: 'test_key',
        environment: 'development',
        enabledSkills: [skillType],
        performanceMode: 'balanced',
      });

      // Simulate slowdown by adding delay
      const originalExecute = slowManager.executeSkill.bind(slowManager);
      (slowManager as any).executeSkill = async function(skillId: string, input: any) {
        await new Promise(resolve => setTimeout(resolve, 50)); // Add 50ms delay
        return originalExecute(skillId, input);
      };

      const regression = await detector.checkRegression(slowManager, skillType, 20);

      expect(regression).toBeDefined();
      expect(regression?.regressionPercentage).toBeGreaterThan(20);
      expect(regression?.significant).toBe(true);
    });

    test('Regression detection sensitivity calibrated', async () => {
      const skillType = 'ContentPredictionSkill';
      await detector.establishBaseline(skillManager, skillType, 30);

      // Test with normal performance (should not trigger)
      const normalRegression = await detector.checkRegression(skillManager, skillType, 20);
      
      expect(normalRegression).toBeDefined();
      expect(normalRegression?.significant).toBe(false);
      expect(normalRegression?.regressionPercentage).toBeLessThan(20);
    });

    test('False positive rate acceptable', async () => {
      const skillType = 'ContentPredictionSkill';
      await detector.establishBaseline(skillManager, skillType, 30);

      let falsePositives = 0;
      const testRuns = 10;

      for (let i = 0; i < testRuns; i++) {
        const regression = await detector.checkRegression(skillManager, skillType, 15);
        if (regression?.significant) {
          falsePositives++;
        }
      }

      const falsePositiveRate = falsePositives / testRuns;
      // Should have low false positive rate (< 10%)
      expect(falsePositiveRate).toBeLessThan(0.1);
    });
  });

  describe('Performance Metrics', () => {
    test('Performance metrics tracked correctly', async () => {
      const skillType = 'ContentPredictionSkill';
      const input = SkillTestUtils.createTestInput.ContentPredictionSkill();

      const executionId = 'perf_test_exec';
      claudeSkillsMonitor.trackExecutionStart(
        executionId,
        skillType,
        'test_skill'
      );

      const result = await skillManager.executeSkill(
        `${skillType}_mock`,
        input
      );

      await claudeSkillsMonitor.trackExecutionComplete(
        executionId,
        result,
        'test_skill'
      );

      const metrics = claudeSkillsMonitor.getCurrentMetrics();
      expect(metrics.totalExecutions).toBeGreaterThan(0);
      expect(metrics.averageResponseTime).toBeGreaterThan(0);
    });

    test('Performance consistent across skill types', async () => {
      const skillTypes = [
        'ContentPredictionSkill',
        'QualityAssessmentSkill',
        'ResourceOptimizationSkill',
      ];

      for (const skillType of skillTypes) {
        const baseline = await detector.establishBaseline(
          skillManager,
          skillType,
          20
        );

        // Each skill should have reasonable performance
        expect(baseline.averageTime).toBeLessThan(1000); // < 1 second
        expect(baseline.p95).toBeLessThan(baseline.averageTime * 2); // p95 not too far from average
      }
    });
  });
});

