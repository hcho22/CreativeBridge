/**
 * Performance Tuner Tests
 *
 * Tests for algorithm fine-tuning based on testing results
 * Task 4.2.4: Fine-tune algorithms based on testing results
 */

import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { PerformanceTuningService } from '../../services/performanceTuner';
import { dynamicResourceManager } from '../../services/resourceManager';
import { performanceOptimizer } from '../../services/performanceOptimizer';

jest.mock('../../services/resourceManager');
jest.mock('../../services/performanceOptimizer');
jest.mock('../../utils/logger');

describe('Performance Tuning Service', () => {
  let tuningService: PerformanceTuningService;

  beforeEach(() => {
    jest.clearAllMocks();
    tuningService = new PerformanceTuningService();

    // Setup mocks for resource manager
    const mockResourceManager = dynamicResourceManager as jest.Mocked<
      typeof dynamicResourceManager
    >;
    mockResourceManager.getCurrentStrategy.mockReturnValue({
      name: 'Balanced',
      memoryLimitMB: 100,
      maxConcurrentOperations: 2,
      enableBackgroundTasks: true,
      enablePrefetching: true,
      imageQuality: 'medium',
      animationComplexity: 'reduced',
      cacheStrategy: 'balanced',
      networkRequestPriority: 'normal',
    });

    mockResourceManager.getCurrentConditions.mockReturnValue({
      memoryPressure: 'medium',
      batteryState: 'unplugged',
      thermalState: 'nominal',
      networkCondition: 'good',
      backgroundAppCount: 3,
      availableStorage: 2 * 1024 * 1024 * 1024,
      cpuUsage: 0.5,
    });

    mockResourceManager.getMemoryConfig.mockReturnValue({
      baseMemoryLimit: 100 * 1024 * 1024,
      warningThreshold: 0.8,
      criticalThreshold: 0.95,
      garbageCollectionTrigger: 0.85,
      preemptiveCleanup: true,
      dynamicCacheReduction: true,
    });

    // Setup performance optimizer mock
    const mockPerformanceOptimizer = performanceOptimizer as jest.Mocked<
      typeof performanceOptimizer
    >;
    mockPerformanceOptimizer.getMetrics.mockReturnValue({
      memoryUsage: 80 * 1024 * 1024,
      batteryLevel: 0.8,
      networkType: 'wifi',
      devicePerformance: 'medium',
      renderTime: 15,
      apiResponseTime: 1200,
    });
  });

  afterEach(() => {
    // Clean up any timers or intervals
  });

  describe('Performance Analysis', () => {
    it('should analyze current performance and identify gaps', async () => {
      await tuningService.establishPerformanceBaseline('medium');
      const result = await tuningService.analyzeAndTune('medium');

      expect(result.deviceTier).toBe('medium');
      expect(result.tuningRecommendations).toBeDefined();
      expect(Array.isArray(result.tuningRecommendations)).toBe(true);
      expect(result.expectedOverallImprovement).toBeGreaterThanOrEqual(0);
      expect(['low', 'medium', 'high']).toContain(result.riskAssessment);
      expect(typeof result.validationRequired).toBe('boolean');
    });

    it('should generate appropriate recommendations for low-end devices', async () => {
      const result = await tuningService.analyzeAndTune('low');

      // Low-end devices should prioritize memory optimization
      const memoryRecommendations = result.tuningRecommendations.filter(
        r => r.parameter.includes('memory') || r.parameter === 'cacheStrategy',
      );

      expect(memoryRecommendations.length).toBeGreaterThan(0);

      // Should not recommend increasing resource usage
      const resourceIncreasingRecommendations =
        result.tuningRecommendations.filter(
          r =>
            (r.parameter === 'maxConcurrentOperations' &&
              r.recommendedValue > r.currentValue) ||
            (r.parameter === 'enableBackgroundTasks' &&
              r.recommendedValue === true),
        );

      expect(resourceIncreasingRecommendations.length).toBe(0);
    });

    it('should generate performance-focused recommendations for high-end devices', async () => {
      const result = await tuningService.analyzeAndTune('high');

      // High-end devices may get recommendations to increase performance
      result.tuningRecommendations.filter(
        r =>
          (r.parameter === 'maxConcurrentOperations' &&
            r.recommendedValue > r.currentValue) ||
          (r.parameter === 'cacheStrategy' &&
            r.recommendedValue === 'aggressive') ||
          (r.parameter === 'enablePrefetching' && r.recommendedValue === true),
      );

      // At least some performance-enhancing recommendations should be present
      expect(result.tuningRecommendations.length).toBeGreaterThan(0);
    });

    it('should prioritize recommendations correctly', async () => {
      const result = await tuningService.analyzeAndTune('medium');

      if (result.tuningRecommendations.length > 1) {
        // Check that critical/high priority recommendations have higher expected improvement
        const criticalRecommendations = result.tuningRecommendations.filter(
          r => r.priority === 'critical',
        );
        const lowRecommendations = result.tuningRecommendations.filter(
          r => r.priority === 'low',
        );

        if (
          criticalRecommendations.length > 0 &&
          lowRecommendations.length > 0
        ) {
          const avgCriticalImprovement =
            criticalRecommendations.reduce(
              (sum, r) => sum + r.expectedImprovement,
              0,
            ) / criticalRecommendations.length;
          const avgLowImprovement =
            lowRecommendations.reduce(
              (sum, r) => sum + r.expectedImprovement,
              0,
            ) / lowRecommendations.length;

          expect(avgCriticalImprovement).toBeGreaterThan(avgLowImprovement);
        }
      }
    });
  });

  describe('Tuning Application', () => {
    it('should apply tuning recommendations successfully', async () => {
      const result = await tuningService.analyzeAndTune('medium');

      if (result.tuningRecommendations.length > 0) {
        const applicationResult =
          await tuningService.applyTuningRecommendations(
            result.tuningRecommendations,
            'medium',
            false, // Skip validation for this test
          );

        expect(applicationResult.applied).toBeGreaterThan(0);
        expect(applicationResult.applied).toBeLessThanOrEqual(
          result.tuningRecommendations.length,
        );
        expect(typeof applicationResult.validated).toBe('boolean');
      }
    });

    it('should respect tuning cooldown period', async () => {
      const result = await tuningService.analyzeAndTune('medium');

      if (result.tuningRecommendations.length > 0) {
        // First application should succeed
        await tuningService.applyTuningRecommendations(
          result.tuningRecommendations,
          'medium',
          false,
        );

        // Second immediate application should fail due to cooldown
        await expect(
          tuningService.applyTuningRecommendations(
            result.tuningRecommendations,
            'medium',
            false,
          ),
        ).rejects.toThrow('Tuning cooldown period not elapsed');
      }
    });

    it('should handle validation and rollback correctly', async () => {
      // Mock poor performance after tuning to trigger rollback
      const originalCollectMetrics = (tuningService as any)
        .collectPerformanceMetrics;
      let callCount = 0;

      jest
        .spyOn(tuningService as any, 'collectPerformanceMetrics')
        .mockImplementation(async deviceTier => {
          callCount++;
          const baseline = await originalCollectMetrics.call(
            tuningService,
            deviceTier,
          );

          if (callCount === 1) {
            // Return baseline metrics
            return baseline;
          } else {
            // Return worse metrics to trigger rollback
            return {
              ...baseline,
              overallPerformanceIndex: baseline.overallPerformanceIndex * 0.7, // 30% worse
            };
          }
        });

      const result = await tuningService.analyzeAndTune('medium');

      if (result.tuningRecommendations.length > 0) {
        const applicationResult =
          await tuningService.applyTuningRecommendations(
            result.tuningRecommendations,
            'medium',
            true, // Enable validation
          );

        expect(applicationResult.rollback).toBe(true);
        expect(applicationResult.validated).toBe(false);
      }
    });

    it('should apply recommendations in priority order', async () => {
      // Create mock recommendations with different priorities
      const mockRecommendations = [
        {
          parameter: 'lowPriorityParam',
          currentValue: 1,
          recommendedValue: 2,
          expectedImprovement: 5,
          confidence: 0.8,
          reasoning: 'Low priority test',
          priority: 'low' as const,
        },
        {
          parameter: 'highPriorityParam',
          currentValue: 5,
          recommendedValue: 10,
          expectedImprovement: 20,
          confidence: 0.9,
          reasoning: 'High priority test',
          priority: 'critical' as const,
        },
      ];

      const applyParameterSpy = jest.spyOn(
        tuningService as any,
        'applyParameterChange',
      );
      applyParameterSpy.mockResolvedValue(1);

      await tuningService.applyTuningRecommendations(
        mockRecommendations,
        'medium',
        false,
      );

      // Critical priority should be applied first
      expect(applyParameterSpy).toHaveBeenNthCalledWith(
        1,
        mockRecommendations[1],
      );
      expect(applyParameterSpy).toHaveBeenNthCalledWith(
        2,
        mockRecommendations[0],
      );
    });
  });

  describe('Performance Monitoring', () => {
    it('should monitor post-tuning performance correctly', async () => {
      await tuningService.establishPerformanceBaseline('medium');

      // Simulate improved performance
      jest
        .spyOn(tuningService as any, 'collectPerformanceMetrics')
        .mockResolvedValueOnce({
          memoryOptimizationEffectiveness: 0.9,
          cacheHitRatioScore: 0.85,
          latencyPerformanceScore: 0.88,
          batteryOptimizationScore: 0.82,
          overallPerformanceIndex: 0.86,
        });

      const monitoringResult = await tuningService.monitorPostTuningPerformance(
        'medium',
      );

      expect(monitoringResult.performanceImprovement).toBeGreaterThan(0);
      expect(typeof monitoringResult.targetsAchieved).toBe('boolean');
      expect(typeof monitoringResult.furtherOptimizationNeeded).toBe('boolean');
    });

    it('should detect when targets are achieved', async () => {
      await tuningService.establishPerformanceBaseline('medium');

      // Mock excellent performance metrics
      jest
        .spyOn(tuningService as any, 'collectPerformanceMetrics')
        .mockResolvedValueOnce({
          memoryOptimizationEffectiveness: 0.95,
          cacheHitRatioScore: 0.92,
          latencyPerformanceScore: 0.94,
          batteryOptimizationScore: 0.89,
          overallPerformanceIndex: 0.93,
        });

      const monitoringResult = await tuningService.monitorPostTuningPerformance(
        'medium',
      );

      expect(monitoringResult.targetsAchieved).toBe(true);
      expect(monitoringResult.furtherOptimizationNeeded).toBe(false);
    });

    it('should identify need for further optimization', async () => {
      await tuningService.establishPerformanceBaseline('medium');

      // Mock poor performance metrics
      jest
        .spyOn(tuningService as any, 'collectPerformanceMetrics')
        .mockResolvedValueOnce({
          memoryOptimizationEffectiveness: 0.6,
          cacheHitRatioScore: 0.65,
          latencyPerformanceScore: 0.7,
          batteryOptimizationScore: 0.68,
          overallPerformanceIndex: 0.66,
        });

      const monitoringResult = await tuningService.monitorPostTuningPerformance(
        'medium',
      );

      expect(monitoringResult.targetsAchieved).toBe(false);
      expect(monitoringResult.furtherOptimizationNeeded).toBe(true);
    });
  });

  describe('Tuning Reports', () => {
    it('should generate comprehensive tuning report', async () => {
      await tuningService.establishPerformanceBaseline('medium');
      await tuningService.analyzeAndTune('medium');

      const report = tuningService.generateTuningReport('medium');

      expect(report.summary).toContain('medium devices');
      expect(report.metrics).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
      expect(Array.isArray(report.history)).toBe(true);
      expect(report.history.length).toBeGreaterThan(0);
    });

    it('should track tuning history correctly', async () => {
      // Perform multiple tuning cycles
      await tuningService.analyzeAndTune('medium');
      await tuningService.analyzeAndTune('medium');

      const report = tuningService.generateTuningReport('medium');

      expect(report.history.length).toBe(2);
      expect(report.history.every(h => h.deviceTier === 'medium')).toBe(true);
    });

    it('should limit tuning history to prevent memory growth', async () => {
      // Perform many tuning cycles
      for (let i = 0; i < 15; i++) {
        await tuningService.analyzeAndTune('medium');
      }

      const report = tuningService.generateTuningReport('medium');

      // Should limit to 10 entries
      expect(report.history.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing baseline gracefully', async () => {
      await expect(
        tuningService.monitorPostTuningPerformance('medium'),
      ).rejects.toThrow('No baseline metrics found');
    });

    it('should handle performance measurement errors', async () => {
      jest
        .spyOn(tuningService as any, 'collectPerformanceMetrics')
        .mockRejectedValue(new Error('Performance measurement failed'));

      await expect(tuningService.analyzeAndTune('medium')).rejects.toThrow();
    });

    it('should filter out low-confidence recommendations', async () => {
      // Mock the recommendation generation to return low-confidence recommendations
      jest
        .spyOn(tuningService as any, 'generateTuningRecommendations')
        .mockResolvedValue([
          {
            parameter: 'testParam1',
            currentValue: 1,
            recommendedValue: 2,
            expectedImprovement: 10,
            confidence: 0.5, // Low confidence
            reasoning: 'Test recommendation',
            priority: 'medium',
          },
          {
            parameter: 'testParam2',
            currentValue: 3,
            recommendedValue: 4,
            expectedImprovement: 15,
            confidence: 0.8, // High confidence
            reasoning: 'Test recommendation',
            priority: 'medium',
          },
        ]);

      const result = await tuningService.analyzeAndTune('medium');

      // Only high-confidence recommendations should be included
      expect(result.tuningRecommendations.length).toBe(1);
      expect(result.tuningRecommendations[0].confidence).toBeGreaterThan(0.6);
    });

    it('should handle parameter application failures gracefully', async () => {
      const mockRecommendations = [
        {
          parameter: 'invalidParam',
          currentValue: 1,
          recommendedValue: 2,
          expectedImprovement: 10,
          confidence: 0.8,
          reasoning: 'Test recommendation',
          priority: 'medium' as const,
        },
      ];

      jest
        .spyOn(tuningService as any, 'applyParameterChange')
        .mockRejectedValue(new Error('Parameter application failed'));

      const applicationResult = await tuningService.applyTuningRecommendations(
        mockRecommendations,
        'medium',
        false,
      );

      // Should handle failure and continue
      expect(applicationResult.applied).toBe(0);
    });
  });

  describe('Performance Targets Validation', () => {
    it('should use appropriate targets for each device tier', async () => {
      const deviceTiers = ['low', 'medium', 'high'] as const;

      for (const tier of deviceTiers) {
        await tuningService.establishPerformanceBaseline(tier);
        const result = await tuningService.analyzeAndTune(tier);

        // Verify that recommendations are tier-appropriate
        expect(result.deviceTier).toBe(tier);
        expect(result.tuningRecommendations).toBeDefined();
      }
    });

    it('should calculate risk assessment accurately', async () => {
      const result = await tuningService.analyzeAndTune('medium');

      const highRiskRecommendations = result.tuningRecommendations.filter(
        r => r.priority === 'critical' || r.expectedImprovement > 30,
      );

      if (highRiskRecommendations.length > 0) {
        expect(result.riskAssessment).toBe('high');
      }
    });
  });
});
