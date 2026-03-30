/**
 * Performance Tuner Measurements Validation Tests
 *
 * Validates that Math.random() is no longer used for performance measurements
 * and that real APIs provide deterministic, meaningful data. (Finding P-3.2)
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { PerformanceTuningService } from '../../services/performanceTuner';

// Mock external dependencies
jest.mock('../../services/resourceManager', () => ({
  dynamicResourceManager: {
    getCurrentConditions: jest.fn(() => ({
      memoryPressure: 'low',
      batteryState: 'charging',
      thermalState: 'nominal',
      networkCondition: 'good',
      backgroundAppCount: 2,
      availableStorage: 1000,
      cpuUsage: 30,
    })),
    getCurrentStrategy: jest.fn(() => ({
      name: 'balanced',
      memoryLimitMB: 100,
      maxConcurrentOperations: 3,
      enableBackgroundTasks: true,
      enablePrefetching: true,
      imageQuality: 'medium',
      animationComplexity: 'full',
      cacheStrategy: 'balanced',
      networkRequestPriority: 'normal',
    })),
    getMemoryConfig: jest.fn(() => ({
      baseMemoryLimit: 100,
      warningThreshold: 70,
      criticalThreshold: 90,
      garbageCollectionTrigger: 80,
      preemptiveCleanup: true,
      dynamicCacheReduction: true,
    })),
    applyResourceAllocationStrategy: jest.fn(),
  },
}));

jest.mock('../../services/performanceOptimizer', () => ({
  performanceOptimizer: {
    getMetrics: jest.fn(() => ({
      memoryUsage: 50000,
      networkType: 'wifi',
      devicePerformance: 'medium',
      renderTime: 12,
      apiResponseTime: 200,
    })),
    isBatteryOptimized: jest.fn(() => false),
    getOptimizationSettings: jest.fn(() => ({
      enableImageCaching: true,
      maxConcurrentRequests: 3,
      prefetchEnabled: true,
      animationsEnabled: true,
      backgroundProcessing: true,
      compressionLevel: 0.8,
    })),
  },
}));

jest.mock('../../services/storyCache', () => ({
  storyCache: {
    getStats: jest.fn(() => ({
      hitRate: 0.75,
      missRate: 0.25,
      totalRequests: 100,
      totalHits: 75,
      totalMisses: 25,
      cacheSize: 50,
      memoryUsage: 20000,
    })),
  },
}));

jest.mock('../../utils/logger', () => ({
  structuredLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Performance Tuner Measurements (P-3.2)', () => {
  let tuner: PerformanceTuningService;

  beforeEach(() => {
    tuner = new PerformanceTuningService();
  });

  it('should not use Math.random() in measurement functions', () => {
    // Read the source file and verify Math.random is not present in measurement methods
    const fs = require('fs');
    const path = require('path');
    const sourceCode = fs.readFileSync(
      path.resolve(__dirname, '../../services/performanceTuner.ts'),
      'utf8',
    );

    // Extract the measurement method bodies
    const measureMethods = [
      'measureMemoryOptimization',
      'measureCachePerformance',
      'measureLatencyPerformance',
      'measureBatteryOptimization',
    ];

    for (const method of measureMethods) {
      // Find the method implementation
      const methodRegex = new RegExp(
        `private async ${method}[^{]*\\{([\\s\\S]*?)\\n  \\}`,
        'm',
      );
      const match = sourceCode.match(methodRegex);
      if (match) {
        expect(match[1]).not.toContain('Math.random()');
      }
    }
  });

  it('should produce deterministic results from real data sources', async () => {
    // Run analyzeAndTune twice with the same mock data — results should be identical
    const result1 = await tuner.analyzeAndTune('medium');
    const result2 = await tuner.analyzeAndTune('medium');

    expect(result1.deviceTier).toBe(result2.deviceTier);
    expect(result1.expectedOverallImprovement).toBe(
      result2.expectedOverallImprovement,
    );
    expect(result1.riskAssessment).toBe(result2.riskAssessment);
    expect(result1.tuningRecommendations.length).toBe(
      result2.tuningRecommendations.length,
    );
  });

  it('should use real cache stats instead of random hit ratios', async () => {
    const result = await tuner.analyzeAndTune('medium');

    // The result should be based on the mocked 75% hit ratio (75/100 requests)
    // which means cacheHitRatioScore = min(1, 75/80) = 0.9375
    // This is above the 0.8 target, so no cache gap should trigger a recommendation
    const cacheRecommendation = result.tuningRecommendations.find(
      r =>
        r.parameter === 'cacheStrategy' ||
        r.parameter === 'cacheEvictionThreshold',
    );
    // With 75% hit ratio and 80% target, gap = max(0, 0.8 - 0.9375) = 0 — no recommendation
    expect(cacheRecommendation).toBeUndefined();
  });

  it('should not contain Date.now() % 100000 in any performance service', () => {
    const fs = require('fs');
    const path = require('path');
    const servicesDir = path.resolve(__dirname, '../../services');
    const files = fs.readdirSync(servicesDir);

    for (const file of files) {
      if (!file.endsWith('.ts')) continue;
      const content = fs.readFileSync(path.join(servicesDir, file), 'utf8');
      expect(content).not.toContain('Date.now() % 100000');
    }
  });
});
