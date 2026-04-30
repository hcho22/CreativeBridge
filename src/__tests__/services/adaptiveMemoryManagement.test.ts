/**
 * Adaptive Memory Management Tests
 *
 * Specialized tests for adaptive memory management strategies
 * Task 4.1.3: Adaptive memory management strategies
 */

import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';
import DeviceInfo from 'react-native-device-info';

import DynamicResourceManager from '../../services/resourceManager';
import { performanceOptimizer } from '../../services/performanceOptimizer';
import { structuredLogger } from '../../utils/logger';
import { SkillManager } from '../../types/claudeSkills';

jest.mock('react-native-device-info');
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  AppState: { addEventListener: jest.fn() },
}));
jest.mock('../../services/performanceOptimizer');
jest.mock('../../utils/logger');

const mockDeviceInfo = DeviceInfo as jest.Mocked<typeof DeviceInfo>;
const mockPerformanceOptimizer = performanceOptimizer as jest.Mocked<
  typeof performanceOptimizer
>;
const mockLogger = structuredLogger as jest.Mocked<typeof structuredLogger>;

// Mock global garbage collection
global.gc = jest.fn();

describe('Adaptive Memory Management', () => {
  let resourceManager: DynamicResourceManager;
  let mockSkillManager: jest.Mocked<SkillManager>;

  beforeEach(() => {
    jest.clearAllMocks();

    resourceManager = new DynamicResourceManager();

    mockSkillManager = {
      initialize: jest.fn().mockResolvedValue(undefined),
      registerSkill: jest.fn(),
      executeSkill: jest.fn(),
      getSkillStatus: jest.fn().mockReturnValue('idle'),
      shutdown: jest.fn().mockResolvedValue(undefined),
      isInitialized: jest.fn().mockReturnValue(true),
    };

    // Setup default device info mocks
    mockDeviceInfo.getBatteryLevel.mockResolvedValue(0.8);
    mockDeviceInfo.getBatteryState.mockResolvedValue('unplugged');
    mockDeviceInfo.getAvailableMemory.mockResolvedValue(2 * 1024 * 1024 * 1024);
    mockDeviceInfo.getTotalMemory.mockResolvedValue(4 * 1024 * 1024 * 1024);
    mockDeviceInfo.getUsedMemory.mockResolvedValue(2 * 1024 * 1024 * 1024);
    mockDeviceInfo.getFreeDiskStorage.mockResolvedValue(
      10 * 1024 * 1024 * 1024,
    );

    // Setup performance optimizer mocks
    mockPerformanceOptimizer.getPerformanceLevel.mockReturnValue('medium');
    mockPerformanceOptimizer.resetOptimizations = jest.fn();
    mockPerformanceOptimizer.getMetrics.mockReturnValue({
      memoryUsage: 100 * 1024 * 1024,
      batteryLevel: 0.8,
      networkType: 'wifi',
      devicePerformance: 'medium',
      renderTime: 15,
      apiResponseTime: 1000,
    });

    mockLogger.info = jest.fn();
    mockLogger.warn = jest.fn();
    mockLogger.error = jest.fn();
  });

  afterEach(() => {
    resourceManager.destroy();
  });

  describe('Memory Configuration', () => {
    beforeEach(async () => {
      await resourceManager.initialize(mockSkillManager);
    });

    it('should initialize memory config based on device tier', async () => {
      const memoryConfig = resourceManager.getMemoryConfig();

      expect(memoryConfig).toMatchObject({
        baseMemoryLimit: 100 * 1024 * 1024, // 100MB for medium tier
        warningThreshold: 0.8,
        criticalThreshold: 0.95,
        garbageCollectionTrigger: 0.85,
        preemptiveCleanup: true,
        dynamicCacheReduction: true,
      });
    });

    it('should adjust memory config for low-tier devices', async () => {
      mockPerformanceOptimizer.getPerformanceLevel.mockReturnValue('low');

      const lowTierManager = new DynamicResourceManager();
      await lowTierManager.initialize(mockSkillManager);

      const memoryConfig = lowTierManager.getMemoryConfig();
      expect(memoryConfig.baseMemoryLimit).toBe(50 * 1024 * 1024); // 50MB for low tier

      lowTierManager.destroy();
    });

    it('should adjust memory config for high-tier devices', async () => {
      mockPerformanceOptimizer.getPerformanceLevel.mockReturnValue('high');

      const highTierManager = new DynamicResourceManager();
      await highTierManager.initialize(mockSkillManager);

      const memoryConfig = highTierManager.getMemoryConfig();
      expect(memoryConfig.baseMemoryLimit).toBe(200 * 1024 * 1024); // 200MB for high tier

      highTierManager.destroy();
    });
  });

  describe('Memory Pressure Detection', () => {
    beforeEach(async () => {
      await resourceManager.initialize(mockSkillManager);
    });

    it('should detect normal memory conditions', async () => {
      // Mock normal memory usage (50MB out of 100MB limit)
      const getCurrentMemoryUsageSpy = jest.spyOn(
        resourceManager as any,
        'getCurrentMemoryUsage',
      );
      getCurrentMemoryUsageSpy.mockResolvedValue(50 * 1024 * 1024);

      await resourceManager.performAdaptiveMemoryManagement();

      // Should not trigger any cleanup
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('cleanup performed'),
        expect.any(Object),
      );
    });

    it('should detect warning-level memory pressure', async () => {
      const getCurrentMemoryUsageSpy = jest.spyOn(
        resourceManager as any,
        'getCurrentMemoryUsage',
      );
      getCurrentMemoryUsageSpy.mockResolvedValue(85 * 1024 * 1024); // 85MB out of 100MB (85%)

      await resourceManager.performAdaptiveMemoryManagement();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Moderate memory cleanup performed',
        expect.objectContaining({
          memoryUsage: 85 * 1024 * 1024,
          pressureRatio: 0.85,
        }),
      );
    });

    it('should detect critical memory pressure', async () => {
      const getCurrentMemoryUsageSpy = jest.spyOn(
        resourceManager as any,
        'getCurrentMemoryUsage',
      );
      getCurrentMemoryUsageSpy.mockResolvedValue(98 * 1024 * 1024); // 98MB out of 100MB (98%)

      await resourceManager.performAdaptiveMemoryManagement();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Aggressive memory cleanup performed',
        expect.objectContaining({
          memoryUsage: 98 * 1024 * 1024,
          memoryLimit: 100 * 1024 * 1024,
          pressureRatio: 0.98,
        }),
      );
    });

    it('should trigger preemptive cleanup when enabled', async () => {
      const getCurrentMemoryUsageSpy = jest.spyOn(
        resourceManager as any,
        'getCurrentMemoryUsage',
      );
      getCurrentMemoryUsageSpy.mockResolvedValue(75 * 1024 * 1024); // 75MB out of 100MB (75%)

      await resourceManager.performAdaptiveMemoryManagement();

      // Should trigger preemptive cleanup at 70% threshold
      // Note: This is an internal method, so we verify by checking if any cleanup occurred
      expect(mockPerformanceOptimizer.resetOptimizations).toHaveBeenCalled();
    });
  });

  describe('Memory Cleanup Strategies', () => {
    beforeEach(async () => {
      await resourceManager.initialize(mockSkillManager);
    });

    it('should perform aggressive cleanup for critical memory pressure', async () => {
      const getCurrentMemoryUsageSpy = jest.spyOn(
        resourceManager as any,
        'getCurrentMemoryUsage',
      );
      getCurrentMemoryUsageSpy.mockResolvedValue(96 * 1024 * 1024); // Critical level

      await resourceManager.performAdaptiveMemoryManagement();

      // Should call global garbage collection if available
      expect(global.gc).toHaveBeenCalled();

      // Should reset performance optimizer caches
      expect(mockPerformanceOptimizer.resetOptimizations).toHaveBeenCalled();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Aggressive memory cleanup performed',
        expect.any(Object),
      );
    });

    it('should perform moderate cleanup for warning level', async () => {
      const getCurrentMemoryUsageSpy = jest.spyOn(
        resourceManager as any,
        'getCurrentMemoryUsage',
      );
      getCurrentMemoryUsageSpy.mockResolvedValue(82 * 1024 * 1024); // Warning level

      await resourceManager.performAdaptiveMemoryManagement();

      // Should reset performance optimizer (moderate cleanup)
      expect(mockPerformanceOptimizer.resetOptimizations).toHaveBeenCalled();

      // Should not call aggressive garbage collection
      expect(global.gc).not.toHaveBeenCalled();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Moderate memory cleanup performed',
        expect.any(Object),
      );
    });

    it('should handle missing garbage collection gracefully', async () => {
      // Remove global gc function
      delete (global as any).gc;

      const getCurrentMemoryUsageSpy = jest.spyOn(
        resourceManager as any,
        'getCurrentMemoryUsage',
      );
      getCurrentMemoryUsageSpy.mockResolvedValue(96 * 1024 * 1024);

      await resourceManager.performAdaptiveMemoryManagement();

      // Should still perform other cleanup actions
      expect(mockPerformanceOptimizer.resetOptimizations).toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Aggressive memory cleanup performed',
        expect.any(Object),
      );
    });
  });

  describe('Dynamic Memory Limit Adjustment', () => {
    beforeEach(async () => {
      await resourceManager.initialize(mockSkillManager);
    });

    it('should adjust memory limit when applying new strategy', async () => {
      const strategy = {
        name: 'Low Memory Strategy',
        memoryLimitMB: 50, // Reduced from default 100MB
        maxConcurrentOperations: 1,
        enableBackgroundTasks: false,
        enablePrefetching: false,
        imageQuality: 'low' as const,
        animationComplexity: 'none' as const,
        cacheStrategy: 'minimal' as const,
        networkRequestPriority: 'low' as const,
      };

      await resourceManager.applyResourceAllocationStrategy(strategy);

      const memoryConfig = resourceManager.getMemoryConfig();
      expect(memoryConfig.baseMemoryLimit).toBe(50 * 1024 * 1024);
    });

    it('should trigger memory cleanup after reducing memory limit', async () => {
      // Set high memory usage
      const getCurrentMemoryUsageSpy = jest.spyOn(
        resourceManager as any,
        'getCurrentMemoryUsage',
      );
      getCurrentMemoryUsageSpy.mockResolvedValue(90 * 1024 * 1024);

      // Mock high memory pressure conditions
      jest.spyOn(resourceManager, 'getCurrentConditions').mockReturnValue({
        memoryPressure: 'high',
        batteryState: 'unplugged',
        thermalState: 'nominal',
        networkCondition: 'good',
        backgroundAppCount: 5,
        availableStorage: 1024 * 1024 * 1024,
        cpuUsage: 0.6,
      });

      const lowMemoryStrategy = {
        name: 'Emergency Low Memory',
        memoryLimitMB: 30,
        maxConcurrentOperations: 1,
        enableBackgroundTasks: false,
        enablePrefetching: false,
        imageQuality: 'low' as const,
        animationComplexity: 'none' as const,
        cacheStrategy: 'minimal' as const,
        networkRequestPriority: 'low' as const,
      };

      await resourceManager.applyResourceAllocationStrategy(lowMemoryStrategy);

      // Should have triggered memory cleanup
      expect(mockPerformanceOptimizer.resetOptimizations).toHaveBeenCalled();
    });
  });

  describe('Memory Usage Tracking', () => {
    beforeEach(async () => {
      await resourceManager.initialize(mockSkillManager);
    });

    it('should estimate memory usage from device info', async () => {
      mockDeviceInfo.getUsedMemory.mockResolvedValue(150 * 1024 * 1024);

      const getCurrentMemoryUsageSpy = jest.spyOn(
        resourceManager as any,
        'getCurrentMemoryUsage',
      );
      const usage = await getCurrentMemoryUsageSpy.mockImplementation.call(
        resourceManager,
      );

      expect(usage).toBe(150 * 1024 * 1024);
    });

    it('should use fallback when device memory info is unavailable', async () => {
      mockDeviceInfo.getUsedMemory.mockRejectedValue(
        new Error('Memory info unavailable'),
      );

      const getCurrentMemoryUsageSpy = jest.spyOn(
        resourceManager as any,
        'getCurrentMemoryUsage',
      );
      const usage = await getCurrentMemoryUsageSpy.mockImplementation.call(
        resourceManager,
      );

      expect(usage).toBe(50 * 1024 * 1024); // Default fallback
    });

    it('should track memory usage history', async () => {
      // Trigger multiple condition assessments to build history
      for (let i = 0; i < 5; i++) {
        await resourceManager.assessDeviceConditions();
      }

      const history = resourceManager.getPerformanceHistory();
      expect(history.memory.length).toBeGreaterThan(0);
      expect(history.memory.every(val => val >= 0 && val <= 1)).toBe(true);
    });

    it('should limit memory history size', async () => {
      // Simulate many assessments
      for (let i = 0; i < 150; i++) {
        await resourceManager.assessDeviceConditions();
      }

      const history = resourceManager.getPerformanceHistory();
      expect(history.memory.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Error Handling and Recovery', () => {
    beforeEach(async () => {
      await resourceManager.initialize(mockSkillManager);
    });

    it('should handle memory management errors gracefully', async () => {
      const getCurrentMemoryUsageSpy = jest.spyOn(
        resourceManager as any,
        'getCurrentMemoryUsage',
      );
      getCurrentMemoryUsageSpy.mockRejectedValue(
        new Error('Memory access error'),
      );

      await resourceManager.performAdaptiveMemoryManagement();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Adaptive memory management failed',
        {},
        expect.any(Error),
      );

      // Should not crash and should continue functioning
      const strategy = resourceManager.getCurrentStrategy();
      expect(strategy).toBeTruthy();
    });

    it('should handle cleanup method failures', async () => {
      mockPerformanceOptimizer.resetOptimizations.mockImplementation(() => {
        throw new Error('Cleanup failed');
      });

      const getCurrentMemoryUsageSpy = jest.spyOn(
        resourceManager as any,
        'getCurrentMemoryUsage',
      );
      getCurrentMemoryUsageSpy.mockResolvedValue(96 * 1024 * 1024);

      // Should not throw despite cleanup failure
      await expect(
        resourceManager.performAdaptiveMemoryManagement(),
      ).resolves.not.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Adaptive memory management failed',
        {},
        expect.any(Error),
      );
    });
  });

  describe('Integration with Resource Strategies', () => {
    beforeEach(async () => {
      await resourceManager.initialize(mockSkillManager);
    });

    it('should automatically trigger memory management during strategy application', async () => {
      // Mock high memory conditions
      jest.spyOn(resourceManager, 'getCurrentConditions').mockReturnValue({
        memoryPressure: 'high',
        batteryState: 'unplugged',
        thermalState: 'nominal',
        networkCondition: 'good',
        backgroundAppCount: 8,
        availableStorage: 512 * 1024 * 1024,
        cpuUsage: 0.7,
      });

      const performAdaptiveMemoryManagementSpy = jest.spyOn(
        resourceManager,
        'performAdaptiveMemoryManagement',
      );

      const strategy = {
        name: 'Test Strategy',
        memoryLimitMB: 80,
        maxConcurrentOperations: 2,
        enableBackgroundTasks: true,
        enablePrefetching: true,
        imageQuality: 'medium' as const,
        animationComplexity: 'reduced' as const,
        cacheStrategy: 'balanced' as const,
        networkRequestPriority: 'normal' as const,
      };

      await resourceManager.applyResourceAllocationStrategy(strategy);

      // Should have triggered memory management due to high memory pressure
      expect(performAdaptiveMemoryManagementSpy).toHaveBeenCalled();
    });

    it('should skip memory management when memory pressure is normal', async () => {
      // Mock normal memory conditions
      jest.spyOn(resourceManager, 'getCurrentConditions').mockReturnValue({
        memoryPressure: 'low',
        batteryState: 'unplugged',
        thermalState: 'nominal',
        networkCondition: 'excellent',
        backgroundAppCount: 2,
        availableStorage: 4 * 1024 * 1024 * 1024,
        cpuUsage: 0.3,
      });

      const performAdaptiveMemoryManagementSpy = jest.spyOn(
        resourceManager,
        'performAdaptiveMemoryManagement',
      );

      const strategy = {
        name: 'Normal Strategy',
        memoryLimitMB: 120,
        maxConcurrentOperations: 3,
        enableBackgroundTasks: true,
        enablePrefetching: true,
        imageQuality: 'high' as const,
        animationComplexity: 'full' as const,
        cacheStrategy: 'aggressive' as const,
        networkRequestPriority: 'high' as const,
      };

      await resourceManager.applyResourceAllocationStrategy(strategy);

      // Should not have triggered memory management since pressure is low
      expect(performAdaptiveMemoryManagementSpy).not.toHaveBeenCalled();
    });
  });

  describe('Performance Impact Measurement', () => {
    beforeEach(async () => {
      await resourceManager.initialize(mockSkillManager);
    });

    it('should track memory cleanup effectiveness', async () => {
      let memoryUsage = 95 * 1024 * 1024; // Start high

      const getCurrentMemoryUsageSpy = jest.spyOn(
        resourceManager as any,
        'getCurrentMemoryUsage',
      );
      getCurrentMemoryUsageSpy.mockImplementation(async () => {
        const usage = memoryUsage;
        memoryUsage = Math.max(40 * 1024 * 1024, memoryUsage * 0.8); // Simulate cleanup reducing memory
        return usage;
      });

      await resourceManager.performAdaptiveMemoryManagement();

      // Should have performed aggressive cleanup
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Aggressive memory cleanup performed',
        expect.objectContaining({
          memoryUsage: 95 * 1024 * 1024,
          pressureRatio: 0.95,
        }),
      );
    });

    it('should measure memory management frequency', async () => {
      const getCurrentMemoryUsageSpy = jest.spyOn(
        resourceManager as any,
        'getCurrentMemoryUsage',
      );
      getCurrentMemoryUsageSpy.mockResolvedValue(90 * 1024 * 1024);

      // Trigger multiple memory management cycles
      await resourceManager.performAdaptiveMemoryManagement();
      await resourceManager.performAdaptiveMemoryManagement();
      await resourceManager.performAdaptiveMemoryManagement();

      // Should have logged multiple cleanup events
      const warningCalls = (mockLogger.warn as jest.Mock).mock.calls.filter(
        call => call[0] === 'Aggressive memory cleanup performed',
      );
      expect(warningCalls.length).toBe(3);
    });
  });
});
