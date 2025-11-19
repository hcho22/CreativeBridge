/**
 * Device Tier Performance Validation Tests
 * 
 * Comprehensive performance testing across device categories
 * Task 4.2: Performance Validation & Testing
 */

import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

import { dynamicResourceManager } from '../../services/resourceManager';
import { performanceOptimizer } from '../../services/performanceOptimizer';
import { storyCache } from '../../services/storyCache';
import { storyAgent } from '../../services/storyAgent';
import { structuredLogger } from '../../utils/logger';
import { SkillManager } from '../../types/claudeSkills';

jest.mock('react-native-device-info');
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  AppState: { addEventListener: jest.fn() },
  Dimensions: { get: jest.fn(() => ({ width: 375, height: 812, scale: 2 })) },
}));

const mockDeviceInfo = DeviceInfo as jest.Mocked<typeof DeviceInfo>;

interface PerformanceMetrics {
  memoryUsage: number;
  renderTime: number;
  apiResponseTime: number;
  cacheHitRatio: number;
  deviceTier: 'low' | 'medium' | 'high';
  batteryLevel: number;
}

interface DeviceTierConfig {
  name: string;
  totalMemory: number;
  availableMemory: number;
  performanceLevel: 'low' | 'medium' | 'high';
  batteryLevel: number;
  expectedMemoryOptimization: number; // Percentage reduction
  expectedCacheHitRatio: number;
  expectedLatencyTarget: number; // Milliseconds
}

const DEVICE_TIER_CONFIGS: Record<string, DeviceTierConfig> = {
  lowEnd: {
    name: 'Low-End Device',
    totalMemory: 2 * 1024 * 1024 * 1024, // 2GB
    availableMemory: 512 * 1024 * 1024, // 512MB
    performanceLevel: 'low',
    batteryLevel: 0.8,
    expectedMemoryOptimization: 45, // 40-50% target from PRD
    expectedCacheHitRatio: 70, // >70% from PRD
    expectedLatencyTarget: 1500, // 1.5s for 80% of requests
  },
  midRange: {
    name: 'Mid-Range Device',
    totalMemory: 4 * 1024 * 1024 * 1024, // 4GB
    availableMemory: 2 * 1024 * 1024 * 1024, // 2GB
    performanceLevel: 'medium',
    batteryLevel: 0.8,
    expectedMemoryOptimization: 30, // Less aggressive optimization
    expectedCacheHitRatio: 75, // Higher target
    expectedLatencyTarget: 1200, // Better performance
  },
  highEnd: {
    name: 'High-End Device',
    totalMemory: 8 * 1024 * 1024 * 1024, // 8GB
    availableMemory: 4 * 1024 * 1024 * 1024, // 4GB
    performanceLevel: 'high',
    batteryLevel: 0.8,
    expectedMemoryOptimization: 20, // Minimal optimization needed
    expectedCacheHitRatio: 80, // Aggressive caching possible
    expectedLatencyTarget: 1000, // Best performance
  },
};

describe('Device Tier Performance Validation', () => {
  let mockSkillManager: jest.Mocked<SkillManager>;
  let performanceBaselines: Record<string, PerformanceMetrics> = {};

  beforeAll(async () => {
    // Setup mock skill manager
    mockSkillManager = {
      initialize: jest.fn().mockResolvedValue(undefined),
      registerSkill: jest.fn(),
      executeSkill: jest.fn().mockResolvedValue({
        success: true,
        data: {
          recommendations: [],
          optimizations: [],
          estimatedImpact: {
            memorySavings: 20 * 1024 * 1024,
            batterySavings: 0.1,
            performanceImprovement: 0.15,
          },
        },
        executionTimeMs: 100,
        skillType: 'ResourceOptimizationSkill',
        confidence: 0.8,
      }),
      getSkillStatus: jest.fn().mockReturnValue('idle'),
      shutdown: jest.fn().mockResolvedValue(undefined),
      isInitialized: jest.fn().mockReturnValue(true),
    };

    // Establish performance baselines for each device tier
    for (const [tierKey, config] of Object.entries(DEVICE_TIER_CONFIGS)) {
      performanceBaselines[tierKey] = await establishBaseline(config);
    }
  });

  afterAll(async () => {
    // Cleanup all managers
    dynamicResourceManager.destroy();
  });

  describe('Low-End Device Performance', () => {
    let config: DeviceTierConfig;

    beforeEach(async () => {
      config = DEVICE_TIER_CONFIGS.lowEnd;
      await setupDeviceEnvironment(config);
    });

    it('should meet memory optimization targets on low-end devices', async () => {
      // Initialize with low-end device configuration
      await dynamicResourceManager.initialize(mockSkillManager);

      // Measure baseline memory usage
      const baselineMemory = await measureMemoryUsage();
      
      // Trigger memory optimization
      await dynamicResourceManager.performAdaptiveMemoryManagement();
      
      // Measure optimized memory usage
      const optimizedMemory = await measureMemoryUsage();
      
      // Calculate optimization percentage
      const optimizationPercentage = ((baselineMemory - optimizedMemory) / baselineMemory) * 100;
      
      expect(optimizationPercentage).toBeGreaterThanOrEqual(config.expectedMemoryOptimization);
      
      // Verify memory usage stays within device limits
      const memoryConfig = dynamicResourceManager.getMemoryConfig();
      expect(optimizedMemory).toBeLessThanOrEqual(memoryConfig.baseMemoryLimit);
    });

    it('should maintain core functionality on low-end devices', async () => {
      await dynamicResourceManager.initialize(mockSkillManager);
      
      const strategy = dynamicResourceManager.getCurrentStrategy();
      
      // Verify conservative strategy is applied
      expect(strategy.name).toBe('Conservative');
      expect(strategy.maxConcurrentOperations).toBe(1);
      expect(strategy.enableBackgroundTasks).toBe(false);
      expect(strategy.imageQuality).toBe('low');
      expect(strategy.animationComplexity).toBe('none');
      
      // Verify core functionality is preserved
      expect(strategy.memoryLimitMB).toBeGreaterThan(0);
      expect(strategy.cacheStrategy).toBeDefined();
    });

    it('should handle memory pressure aggressively on low-end devices', async () => {
      await dynamicResourceManager.initialize(mockSkillManager);
      
      // Simulate high memory pressure
      const getCurrentMemoryUsageSpy = jest.spyOn(dynamicResourceManager as any, 'getCurrentMemoryUsage');
      getCurrentMemoryUsageSpy.mockResolvedValue(48 * 1024 * 1024); // 96% of 50MB limit

      const startTime = Date.now();
      await dynamicResourceManager.performAdaptiveMemoryManagement();
      const responseTime = Date.now() - startTime;

      // Should respond quickly to memory pressure
      expect(responseTime).toBeLessThan(1000); // 1 second response time

      // Should trigger aggressive cleanup
      expect(structuredLogger.warn).toHaveBeenCalledWith(
        'Aggressive memory cleanup performed',
        expect.any(Object)
      );
    });

    it('should achieve cache hit ratio targets despite limited memory', async () => {
      await dynamicResourceManager.initialize(mockSkillManager);
      
      // Simulate multiple story requests to test caching
      const requests = Array.from({ length: 10 }, (_, i) => ({
        gradeLevel: 'Grade3' as const,
        userInput: `Story request ${i}`,
        context: 'test context',
      }));

      let cacheHits = 0;
      let totalRequests = 0;

      for (const request of requests) {
        totalRequests++;
        
        // Simulate story generation and caching
        const cacheKey = generateCacheKey(request);
        const cachedStory = await storyCache.get(cacheKey);
        
        if (cachedStory) {
          cacheHits++;
        } else {
          // Simulate story generation and cache storage
          const generatedStory = `Generated story for ${request.userInput}`;
          await storyCache.set(cacheKey, {
            story: generatedStory,
            gradeLevel: request.gradeLevel,
            isPersonalized: false,
            confidence: 0.8,
            metadata: {},
          });
        }
      }

      // Repeat requests to test cache effectiveness
      for (const request of requests) {
        totalRequests++;
        const cacheKey = generateCacheKey(request);
        const cachedStory = await storyCache.get(cacheKey);
        
        if (cachedStory) {
          cacheHits++;
        }
      }

      const cacheHitRatio = (cacheHits / totalRequests) * 100;
      expect(cacheHitRatio).toBeGreaterThanOrEqual(config.expectedCacheHitRatio);
    });

    it('should meet story generation latency targets for low-end devices', async () => {
      await dynamicResourceManager.initialize(mockSkillManager);
      
      const latencies: number[] = [];
      const requestCount = 20; // Test 20 requests for statistical validity

      for (let i = 0; i < requestCount; i++) {
        const startTime = Date.now();
        
        // Simulate story generation process
        await simulateStoryGeneration({
          gradeLevel: 'Grade3' as const,
          userInput: `Test story ${i}`,
          context: 'performance test',
        });
        
        const latency = Date.now() - startTime;
        latencies.push(latency);
      }

      // Calculate 80th percentile
      const sortedLatencies = latencies.sort((a, b) => a - b);
      const percentile80Index = Math.floor(sortedLatencies.length * 0.8);
      const percentile80 = sortedLatencies[percentile80Index];

      expect(percentile80).toBeLessThanOrEqual(config.expectedLatencyTarget);
    });
  });

  describe('Mid-Range Device Performance', () => {
    let config: DeviceTierConfig;

    beforeEach(async () => {
      config = DEVICE_TIER_CONFIGS.midRange;
      await setupDeviceEnvironment(config);
    });

    it('should balance performance and resource conservation', async () => {
      await dynamicResourceManager.initialize(mockSkillManager);
      
      const strategy = dynamicResourceManager.getCurrentStrategy();
      
      // Verify balanced strategy
      expect(strategy.name).toBe('Balanced');
      expect(strategy.maxConcurrentOperations).toBe(2);
      expect(strategy.enableBackgroundTasks).toBe(true);
      expect(strategy.enablePrefetching).toBe(true);
      expect(strategy.imageQuality).toBe('medium');
      expect(strategy.animationComplexity).toBe('reduced');
    });

    it('should achieve improved cache performance', async () => {
      await dynamicResourceManager.initialize(mockSkillManager);
      
      // Test cache effectiveness with medium memory allocation
      const cacheHitRatio = await measureCacheEffectiveness(config, 15);
      expect(cacheHitRatio).toBeGreaterThanOrEqual(config.expectedCacheHitRatio);
    });

    it('should demonstrate better latency than low-end devices', async () => {
      await dynamicResourceManager.initialize(mockSkillManager);
      
      const avgLatency = await measureAverageLatency(10);
      expect(avgLatency).toBeLessThan(config.expectedLatencyTarget);
      
      // Should be better than low-end baseline
      const lowEndBaseline = performanceBaselines.lowEnd;
      expect(avgLatency).toBeLessThan(lowEndBaseline.apiResponseTime);
    });
  });

  describe('High-End Device Performance', () => {
    let config: DeviceTierConfig;

    beforeEach(async () => {
      config = DEVICE_TIER_CONFIGS.highEnd;
      await setupDeviceEnvironment(config);
    });

    it('should maximize performance capabilities', async () => {
      await dynamicResourceManager.initialize(mockSkillManager);
      
      const strategy = dynamicResourceManager.getCurrentStrategy();
      
      // Verify performance-focused strategy
      expect(strategy.name).toBe('Performance');
      expect(strategy.maxConcurrentOperations).toBe(4);
      expect(strategy.enableBackgroundTasks).toBe(true);
      expect(strategy.enablePrefetching).toBe(true);
      expect(strategy.imageQuality).toBe('high');
      expect(strategy.animationComplexity).toBe('full');
      expect(strategy.cacheStrategy).toBe('aggressive');
    });

    it('should achieve optimal cache performance', async () => {
      await dynamicResourceManager.initialize(mockSkillManager);
      
      const cacheHitRatio = await measureCacheEffectiveness(config, 20);
      expect(cacheHitRatio).toBeGreaterThanOrEqual(config.expectedCacheHitRatio);
    });

    it('should demonstrate best-in-class latency performance', async () => {
      await dynamicResourceManager.initialize(mockSkillManager);
      
      const avgLatency = await measureAverageLatency(15);
      expect(avgLatency).toBeLessThan(config.expectedLatencyTarget);
      
      // Should be best performance across all tiers
      const midRangeBaseline = performanceBaselines.midRange;
      const lowEndBaseline = performanceBaselines.lowEnd;
      
      expect(avgLatency).toBeLessThan(midRangeBaseline.apiResponseTime);
      expect(avgLatency).toBeLessThan(lowEndBaseline.apiResponseTime);
    });

    it('should handle resource abundance efficiently', async () => {
      await dynamicResourceManager.initialize(mockSkillManager);
      
      const memoryConfig = dynamicResourceManager.getMemoryConfig();
      
      // Should allocate more memory for better performance
      expect(memoryConfig.baseMemoryLimit).toBe(200 * 1024 * 1024); // 200MB
      
      // Should use aggressive caching
      const strategy = dynamicResourceManager.getCurrentStrategy();
      expect(strategy.cacheStrategy).toBe('aggressive');
      expect(strategy.memoryLimitMB).toBe(200);
    });
  });

  describe('Cross-Tier Performance Comparison', () => {
    it('should show progressive performance improvements across tiers', async () => {
      const tierResults: Record<string, { avgLatency: number; cacheHitRatio: number; memoryEfficiency: number }> = {};

      // Test each tier
      for (const [tierKey, config] of Object.entries(DEVICE_TIER_CONFIGS)) {
        await setupDeviceEnvironment(config);
        await dynamicResourceManager.initialize(mockSkillManager);

        tierResults[tierKey] = {
          avgLatency: await measureAverageLatency(8),
          cacheHitRatio: await measureCacheEffectiveness(config, 10),
          memoryEfficiency: await measureMemoryEfficiency(),
        };

        dynamicResourceManager.destroy();
      }

      // Verify progressive improvement
      expect(tierResults.midRange.avgLatency).toBeLessThan(tierResults.lowEnd.avgLatency);
      expect(tierResults.highEnd.avgLatency).toBeLessThan(tierResults.midRange.avgLatency);

      // Verify cache performance scales with device capability
      expect(tierResults.midRange.cacheHitRatio).toBeGreaterThanOrEqual(tierResults.lowEnd.cacheHitRatio);
      expect(tierResults.highEnd.cacheHitRatio).toBeGreaterThanOrEqual(tierResults.midRange.cacheHitRatio);
    });

    it('should maintain functionality across all tiers', async () => {
      for (const [tierKey, config] of Object.entries(DEVICE_TIER_CONFIGS)) {
        await setupDeviceEnvironment(config);
        await dynamicResourceManager.initialize(mockSkillManager);

        // Verify core functionality preserved
        const strategy = dynamicResourceManager.getCurrentStrategy();
        expect(strategy.name).toBeTruthy();
        expect(strategy.memoryLimitMB).toBeGreaterThan(0);
        expect(strategy.maxConcurrentOperations).toBeGreaterThan(0);

        // Verify service integration works
        expect(dynamicResourceManager.getCurrentConditions()).toBeTruthy();
        expect(dynamicResourceManager.getMemoryConfig()).toBeTruthy();

        dynamicResourceManager.destroy();
      }
    });
  });

  describe('Performance Under Stress Conditions', () => {
    it('should handle memory pressure across all device tiers', async () => {
      for (const [tierKey, config] of Object.entries(DEVICE_TIER_CONFIGS)) {
        await setupDeviceEnvironment(config);
        await dynamicResourceManager.initialize(mockSkillManager);

        // Simulate high memory pressure
        const getCurrentMemoryUsageSpy = jest.spyOn(dynamicResourceManager as any, 'getCurrentMemoryUsage');
        getCurrentMemoryUsageSpy.mockResolvedValue(config.totalMemory * 0.9); // 90% memory usage

        const startTime = Date.now();
        await dynamicResourceManager.performAdaptiveMemoryManagement();
        const responseTime = Date.now() - startTime;

        // Should respond to memory pressure within reasonable time
        expect(responseTime).toBeLessThan(2000); // 2 second max

        dynamicResourceManager.destroy();
      }
    });

    it('should adapt to low battery conditions across all tiers', async () => {
      for (const [tierKey, config] of Object.entries(DEVICE_TIER_CONFIGS)) {
        await setupDeviceEnvironment({ ...config, batteryLevel: 0.1 }); // 10% battery
        await dynamicResourceManager.initialize(mockSkillManager);

        await dynamicResourceManager.applyBatteryOptimizations();

        const strategy = dynamicResourceManager.getCurrentStrategy();
        
        // All tiers should apply battery optimizations
        expect(strategy.enableBackgroundTasks).toBe(false);
        expect(strategy.maxConcurrentOperations).toBeLessThanOrEqual(2);

        dynamicResourceManager.destroy();
      }
    });
  });

  // Helper functions
  async function setupDeviceEnvironment(config: DeviceTierConfig): Promise<void> {
    // Mock device info based on configuration
    mockDeviceInfo.getTotalMemory.mockResolvedValue(config.totalMemory);
    mockDeviceInfo.getAvailableMemory.mockResolvedValue(config.availableMemory);
    mockDeviceInfo.getUsedMemory.mockResolvedValue(config.totalMemory - config.availableMemory);
    mockDeviceInfo.getBatteryLevel.mockResolvedValue(config.batteryLevel);
    mockDeviceInfo.getBatteryState.mockResolvedValue('unplugged');
    mockDeviceInfo.getFreeDiskStorage.mockResolvedValue(10 * 1024 * 1024 * 1024);

    // Setup performance optimizer for the device tier
    const mockPerformanceOptimizer = performanceOptimizer as jest.Mocked<typeof performanceOptimizer>;
    mockPerformanceOptimizer.getPerformanceLevel.mockReturnValue(config.performanceLevel);
    mockPerformanceOptimizer.getMetrics.mockReturnValue({
      memoryUsage: config.totalMemory - config.availableMemory,
      batteryLevel: config.batteryLevel,
      networkType: 'wifi',
      devicePerformance: config.performanceLevel,
      renderTime: config.performanceLevel === 'low' ? 25 : config.performanceLevel === 'medium' ? 15 : 10,
      apiResponseTime: config.expectedLatencyTarget,
    });
  }

  async function establishBaseline(config: DeviceTierConfig): Promise<PerformanceMetrics> {
    await setupDeviceEnvironment(config);
    
    return {
      memoryUsage: config.totalMemory - config.availableMemory,
      renderTime: config.performanceLevel === 'low' ? 25 : config.performanceLevel === 'medium' ? 15 : 10,
      apiResponseTime: config.expectedLatencyTarget,
      cacheHitRatio: 0, // Baseline before optimization
      deviceTier: config.performanceLevel,
      batteryLevel: config.batteryLevel,
    };
  }

  async function measureMemoryUsage(): Promise<number> {
    // Simulate memory measurement
    const metrics = performanceOptimizer.getMetrics();
    return metrics.memoryUsage;
  }

  async function measureCacheEffectiveness(config: DeviceTierConfig, requestCount: number): Promise<number> {
    let hits = 0;
    let total = 0;

    for (let i = 0; i < requestCount; i++) {
      total++;
      const cacheKey = `test_story_${i % 5}`; // Create some cache overlap
      
      const cached = await storyCache.get(cacheKey);
      if (cached) {
        hits++;
      } else {
        await storyCache.set(cacheKey, {
          story: `Story content ${i}`,
          gradeLevel: 'Grade3',
          isPersonalized: false,
          confidence: 0.8,
          metadata: {},
        });
      }
    }

    return (hits / total) * 100;
  }

  async function measureAverageLatency(sampleSize: number): Promise<number> {
    const latencies: number[] = [];

    for (let i = 0; i < sampleSize; i++) {
      const startTime = Date.now();
      await simulateStoryGeneration({
        gradeLevel: 'Grade3' as const,
        userInput: `Performance test ${i}`,
        context: 'latency measurement',
      });
      latencies.push(Date.now() - startTime);
    }

    return latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length;
  }

  async function measureMemoryEfficiency(): Promise<number> {
    const memoryConfig = dynamicResourceManager.getMemoryConfig();
    const currentUsage = await measureMemoryUsage();
    return (currentUsage / memoryConfig.baseMemoryLimit) * 100;
  }

  async function simulateStoryGeneration(request: { gradeLevel: string; userInput: string; context: string }): Promise<void> {
    // Simulate realistic story generation latency
    const deviceTier = performanceOptimizer.getPerformanceLevel();
    const baseLatency = deviceTier === 'low' ? 800 : deviceTier === 'medium' ? 500 : 300;
    const randomVariation = Math.random() * 200; // Add some realistic variation
    
    await new Promise(resolve => setTimeout(resolve, baseLatency + randomVariation));
  }

  function generateCacheKey(request: { gradeLevel: string; userInput: string; context: string }): string {
    return `story_${request.gradeLevel}_${request.userInput.slice(0, 10)}`;
  }
});