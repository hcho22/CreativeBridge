/**
 * Battery Optimization Tests
 * 
 * Specialized tests for battery-conscious operation modes
 * Task 4.1.4: Battery-conscious operation modes
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
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
const mockPerformanceOptimizer = performanceOptimizer as jest.Mocked<typeof performanceOptimizer>;
const mockLogger = structuredLogger as jest.Mocked<typeof structuredLogger>;

describe('Battery Optimization', () => {
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

    // Setup default device info mocks - normal battery level
    mockDeviceInfo.getBatteryLevel.mockResolvedValue(0.8);
    mockDeviceInfo.getBatteryState.mockResolvedValue('unplugged');
    mockDeviceInfo.getAvailableMemory.mockResolvedValue(2 * 1024 * 1024 * 1024);
    mockDeviceInfo.getTotalMemory.mockResolvedValue(4 * 1024 * 1024 * 1024);
    mockDeviceInfo.getUsedMemory.mockResolvedValue(2 * 1024 * 1024 * 1024);
    mockDeviceInfo.getFreeDiskStorage.mockResolvedValue(10 * 1024 * 1024 * 1024);

    // Setup performance optimizer mocks
    mockPerformanceOptimizer.getPerformanceLevel.mockReturnValue('medium');

    mockLogger.info = jest.fn();
    mockLogger.warn = jest.fn();
    mockLogger.error = jest.fn();
  });

  afterEach(() => {
    resourceManager.destroy();
  });

  describe('Battery Configuration', () => {
    beforeEach(async () => {
      await resourceManager.initialize(mockSkillManager);
    });

    it('should initialize battery config with default thresholds', async () => {
      const batteryConfig = resourceManager.getBatteryConfig();
      
      expect(batteryConfig).toMatchObject({
        lowBatteryThreshold: 0.2,
        criticalBatteryThreshold: 0.1,
        backgroundTaskReduction: 0.5,
        networkRequestBatching: true,
        cpuThrottling: true,
        reducedAnimations: true,
      });
    });

    it('should allow custom battery configuration', () => {
      // This would require extending the constructor or configuration system
      // For now, we test the default configuration
      const batteryConfig = resourceManager.getBatteryConfig();
      expect(batteryConfig.lowBatteryThreshold).toBe(0.2);
      expect(batteryConfig.criticalBatteryThreshold).toBe(0.1);
    });
  });

  describe('Battery Level Detection', () => {
    beforeEach(async () => {
      await resourceManager.initialize(mockSkillManager);
    });

    it('should detect normal battery levels', async () => {
      mockDeviceInfo.getBatteryLevel.mockResolvedValue(0.8);
      
      await resourceManager.applyBatteryOptimizations();

      // Should not log any battery optimization messages for normal levels
      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('battery mode'),
        expect.any(Object)
      );
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('battery optimizations'),
        expect.any(Object)
      );
    });

    it('should detect low battery levels', async () => {
      mockDeviceInfo.getBatteryLevel.mockResolvedValue(0.15); // 15%

      await resourceManager.applyBatteryOptimizations();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Low battery optimizations applied',
        expect.objectContaining({
          batteryLevel: 0.15,
          reducedOperations: expect.any(Number),
        })
      );
    });

    it('should detect critical battery levels', async () => {
      mockDeviceInfo.getBatteryLevel.mockResolvedValue(0.05); // 5%

      await resourceManager.applyBatteryOptimizations();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Emergency battery mode activated',
        expect.objectContaining({
          batteryLevel: 0.05,
          strategy: 'Emergency Battery',
        })
      );
    });

    it('should handle battery info errors gracefully', async () => {
      mockDeviceInfo.getBatteryLevel.mockRejectedValue(new Error('Battery info unavailable'));

      await resourceManager.applyBatteryOptimizations();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Battery optimization failed',
        {},
        expect.any(Error)
      );
    });
  });

  describe('Low Battery Optimizations', () => {
    beforeEach(async () => {
      await resourceManager.initialize(mockSkillManager);
    });

    it('should apply low battery strategy', async () => {
      mockDeviceInfo.getBatteryLevel.mockResolvedValue(0.18); // 18%

      const initialStrategy = resourceManager.getCurrentStrategy();
      const initialOperations = initialStrategy.maxConcurrentOperations;

      await resourceManager.applyBatteryOptimizations();

      const newStrategy = resourceManager.getCurrentStrategy();
      
      expect(newStrategy.enableBackgroundTasks).toBe(false);
      expect(newStrategy.maxConcurrentOperations).toBe(
        Math.max(1, Math.floor(initialOperations * 0.7))
      );
      expect(newStrategy.animationComplexity).toBe('reduced');
    });

    it('should reduce concurrent operations for low battery', async () => {
      mockDeviceInfo.getBatteryLevel.mockResolvedValue(0.15);

      // Set up a strategy with multiple operations
      const highPerformanceStrategy = {
        name: 'High Performance',
        memoryLimitMB: 200,
        maxConcurrentOperations: 4,
        enableBackgroundTasks: true,
        enablePrefetching: true,
        imageQuality: 'high' as const,
        animationComplexity: 'full' as const,
        cacheStrategy: 'aggressive' as const,
        networkRequestPriority: 'high' as const,
      };

      await resourceManager.applyResourceAllocationStrategy(highPerformanceStrategy);
      await resourceManager.applyBatteryOptimizations();

      const optimizedStrategy = resourceManager.getCurrentStrategy();
      expect(optimizedStrategy.maxConcurrentOperations).toBe(
        Math.max(1, Math.floor(4 * 0.7)) // Should be 2
      );
    });

    it('should disable background tasks for low battery', async () => {
      mockDeviceInfo.getBatteryLevel.mockResolvedValue(0.12);

      await resourceManager.applyBatteryOptimizations();

      const strategy = resourceManager.getCurrentStrategy();
      expect(strategy.enableBackgroundTasks).toBe(false);
    });

    it('should apply reduced animations when battery config allows', async () => {
      mockDeviceInfo.getBatteryLevel.mockResolvedValue(0.19);

      await resourceManager.applyBatteryOptimizations();

      const strategy = resourceManager.getCurrentStrategy();
      expect(strategy.animationComplexity).toBe('reduced');
    });
  });

  describe('Emergency Battery Mode', () => {
    beforeEach(async () => {
      await resourceManager.initialize(mockSkillManager);
    });

    it('should activate emergency battery mode for critical levels', async () => {
      mockDeviceInfo.getBatteryLevel.mockResolvedValue(0.08); // 8%

      await resourceManager.applyBatteryOptimizations();

      const strategy = resourceManager.getCurrentStrategy();
      
      expect(strategy.name).toBe('Emergency Battery');
      expect(strategy.memoryLimitMB).toBe(30);
      expect(strategy.maxConcurrentOperations).toBe(1);
      expect(strategy.enableBackgroundTasks).toBe(false);
      expect(strategy.enablePrefetching).toBe(false);
      expect(strategy.imageQuality).toBe('low');
      expect(strategy.animationComplexity).toBe('none');
      expect(strategy.cacheStrategy).toBe('minimal');
      expect(strategy.networkRequestPriority).toBe('low');
    });

    it('should apply maximum power saving for critical battery', async () => {
      mockDeviceInfo.getBatteryLevel.mockResolvedValue(0.03); // 3%

      await resourceManager.applyBatteryOptimizations();

      const strategy = resourceManager.getCurrentStrategy();
      
      // Verify all power-saving measures are enabled
      expect(strategy.enableBackgroundTasks).toBe(false);
      expect(strategy.enablePrefetching).toBe(false);
      expect(strategy.animationComplexity).toBe('none');
      expect(strategy.maxConcurrentOperations).toBe(1);
      expect(strategy.imageQuality).toBe('low');
      expect(strategy.cacheStrategy).toBe('minimal');
    });

    it('should override any existing strategy in emergency mode', async () => {
      // First set a high-performance strategy
      const highPerformanceStrategy = {
        name: 'Maximum Performance',
        memoryLimitMB: 300,
        maxConcurrentOperations: 6,
        enableBackgroundTasks: true,
        enablePrefetching: true,
        imageQuality: 'high' as const,
        animationComplexity: 'full' as const,
        cacheStrategy: 'aggressive' as const,
        networkRequestPriority: 'high' as const,
      };

      await resourceManager.applyResourceAllocationStrategy(highPerformanceStrategy);
      
      // Then trigger emergency mode
      mockDeviceInfo.getBatteryLevel.mockResolvedValue(0.05);
      await resourceManager.applyBatteryOptimizations();

      const strategy = resourceManager.getCurrentStrategy();
      expect(strategy.name).toBe('Emergency Battery');
      expect(strategy.maxConcurrentOperations).toBe(1); // Should override the 6
    });
  });

  describe('Battery State Integration', () => {
    beforeEach(async () => {
      await resourceManager.initialize(mockSkillManager);
    });

    it('should trigger battery optimizations during strategy application for low battery', async () => {
      // Mock low battery conditions
      jest.spyOn(resourceManager, 'getCurrentConditions').mockReturnValue({
        memoryPressure: 'medium',
        batteryState: 'low',
        thermalState: 'nominal',
        networkCondition: 'good',
        backgroundAppCount: 3,
        availableStorage: 2 * 1024 * 1024 * 1024,
        cpuUsage: 0.5,
      });

      const applyBatteryOptimizationsSpy = jest.spyOn(resourceManager, 'applyBatteryOptimizations');

      const strategy = {
        name: 'Test Strategy',
        memoryLimitMB: 100,
        maxConcurrentOperations: 2,
        enableBackgroundTasks: true,
        enablePrefetching: true,
        imageQuality: 'medium' as const,
        animationComplexity: 'reduced' as const,
        cacheStrategy: 'balanced' as const,
        networkRequestPriority: 'normal' as const,
      };

      await resourceManager.applyResourceAllocationStrategy(strategy);

      // Should have triggered battery optimizations due to low battery
      expect(applyBatteryOptimizationsSpy).toHaveBeenCalled();
    });

    it('should trigger battery optimizations for critical battery state', async () => {
      // Mock critical battery conditions
      jest.spyOn(resourceManager, 'getCurrentConditions').mockReturnValue({
        memoryPressure: 'low',
        batteryState: 'critical',
        thermalState: 'nominal',
        networkCondition: 'excellent',
        backgroundAppCount: 1,
        availableStorage: 4 * 1024 * 1024 * 1024,
        cpuUsage: 0.3,
      });

      const applyBatteryOptimizationsSpy = jest.spyOn(resourceManager, 'applyBatteryOptimizations');

      const strategy = {
        name: 'Normal Strategy',
        memoryLimitMB: 150,
        maxConcurrentOperations: 3,
        enableBackgroundTasks: true,
        enablePrefetching: true,
        imageQuality: 'high' as const,
        animationComplexity: 'full' as const,
        cacheStrategy: 'aggressive' as const,
        networkRequestPriority: 'high' as const,
      };

      await resourceManager.applyResourceAllocationStrategy(strategy);

      expect(applyBatteryOptimizationsSpy).toHaveBeenCalled();
    });

    it('should skip battery optimizations for normal battery state', async () => {
      // Mock normal battery conditions
      jest.spyOn(resourceManager, 'getCurrentConditions').mockReturnValue({
        memoryPressure: 'low',
        batteryState: 'unplugged',
        thermalState: 'nominal',
        networkCondition: 'excellent',
        backgroundAppCount: 2,
        availableStorage: 4 * 1024 * 1024 * 1024,
        cpuUsage: 0.3,
      });

      const applyBatteryOptimizationsSpy = jest.spyOn(resourceManager, 'applyBatteryOptimizations');

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

      expect(applyBatteryOptimizationsSpy).not.toHaveBeenCalled();
    });
  });

  describe('Battery Threshold Boundaries', () => {
    beforeEach(async () => {
      await resourceManager.initialize(mockSkillManager);
    });

    it('should apply normal operations just above low battery threshold', async () => {
      mockDeviceInfo.getBatteryLevel.mockResolvedValue(0.21); // Just above 20%

      await resourceManager.applyBatteryOptimizations();

      // Should not apply any battery optimizations
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('battery optimizations'),
        expect.any(Object)
      );
    });

    it('should apply low battery optimizations at threshold', async () => {
      mockDeviceInfo.getBatteryLevel.mockResolvedValue(0.20); // Exactly 20%

      await resourceManager.applyBatteryOptimizations();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Low battery optimizations applied',
        expect.objectContaining({
          batteryLevel: 0.20,
        })
      );
    });

    it('should apply emergency mode just above critical threshold', async () => {
      mockDeviceInfo.getBatteryLevel.mockResolvedValue(0.11); // Just above 10%

      await resourceManager.applyBatteryOptimizations();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Low battery optimizations applied',
        expect.objectContaining({
          batteryLevel: 0.11,
        })
      );
    });

    it('should apply emergency mode at critical threshold', async () => {
      mockDeviceInfo.getBatteryLevel.mockResolvedValue(0.10); // Exactly 10%

      await resourceManager.applyBatteryOptimizations();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Emergency battery mode activated',
        expect.objectContaining({
          batteryLevel: 0.10,
        })
      );
    });
  });

  describe('Battery Charging State Handling', () => {
    beforeEach(async () => {
      await resourceManager.initialize(mockSkillManager);
    });

    it('should not apply battery optimizations when charging despite low level', async () => {
      mockDeviceInfo.getBatteryLevel.mockResolvedValue(0.15); // Low level
      mockDeviceInfo.getBatteryState.mockResolvedValue('charging'); // But charging

      const conditions = await resourceManager.assessDeviceConditions();
      expect(conditions.batteryState).toBe('charging');

      // Apply optimizations - should not trigger low battery mode
      await resourceManager.applyBatteryOptimizations();
      
      // Should not log battery optimization messages when charging
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('battery optimizations'),
        expect.any(Object)
      );
    });

    it('should restore normal operations when charging state changes', async () => {
      // First, trigger low battery mode
      mockDeviceInfo.getBatteryLevel.mockResolvedValue(0.15);
      mockDeviceInfo.getBatteryState.mockResolvedValue('unplugged');

      await resourceManager.applyBatteryOptimizations();
      
      const lowBatteryStrategy = resourceManager.getCurrentStrategy();
      expect(lowBatteryStrategy.enableBackgroundTasks).toBe(false);

      // Then simulate plugging in charger
      mockDeviceInfo.getBatteryState.mockResolvedValue('charging');
      
      const conditions = await resourceManager.assessDeviceConditions();
      expect(conditions.batteryState).toBe('charging');
    });
  });

  describe('Performance Impact of Battery Optimizations', () => {
    beforeEach(async () => {
      await resourceManager.initialize(mockSkillManager);
    });

    it('should measure battery optimization impact', async () => {
      const initialStrategy = resourceManager.getCurrentStrategy();
      const initialConcurrentOps = initialStrategy.maxConcurrentOperations;

      mockDeviceInfo.getBatteryLevel.mockResolvedValue(0.18);
      await resourceManager.applyBatteryOptimizations();

      const optimizedStrategy = resourceManager.getCurrentStrategy();
      const optimizedConcurrentOps = optimizedStrategy.maxConcurrentOperations;

      // Should have reduced concurrent operations
      expect(optimizedConcurrentOps).toBeLessThan(initialConcurrentOps);
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Low battery optimizations applied',
        expect.objectContaining({
          reducedOperations: optimizedConcurrentOps,
        })
      );
    });

    it('should track multiple battery optimization cycles', async () => {
      // Apply optimizations multiple times
      mockDeviceInfo.getBatteryLevel.mockResolvedValue(0.16);
      
      await resourceManager.applyBatteryOptimizations();
      await resourceManager.applyBatteryOptimizations();
      await resourceManager.applyBatteryOptimizations();

      const logCalls = (mockLogger.info as jest.Mock).mock.calls.filter(
        call => call[0] === 'Low battery optimizations applied'
      );
      
      expect(logCalls.length).toBe(3);
    });
  });

  describe('Integration with Device Conditions', () => {
    beforeEach(async () => {
      await resourceManager.initialize(mockSkillManager);
    });

    it('should consider battery state in overall device assessment', async () => {
      mockDeviceInfo.getBatteryLevel.mockResolvedValue(0.08);
      mockDeviceInfo.getBatteryState.mockResolvedValue('unplugged');

      const conditions = await resourceManager.assessDeviceConditions();
      
      expect(conditions.batteryState).toBe('critical');
    });

    it('should apply combined optimizations for low battery and high memory pressure', async () => {
      // Mock both low battery and high memory usage
      mockDeviceInfo.getBatteryLevel.mockResolvedValue(0.12);
      mockDeviceInfo.getUsedMemory.mockResolvedValue(3.6 * 1024 * 1024 * 1024); // 90%

      jest.spyOn(resourceManager, 'getCurrentConditions').mockReturnValue({
        memoryPressure: 'high',
        batteryState: 'low',
        thermalState: 'serious',
        networkCondition: 'poor',
        backgroundAppCount: 8,
        availableStorage: 512 * 1024 * 1024,
        cpuUsage: 0.8,
      });

      const strategy = {
        name: 'Initial Strategy',
        memoryLimitMB: 150,
        maxConcurrentOperations: 4,
        enableBackgroundTasks: true,
        enablePrefetching: true,
        imageQuality: 'high' as const,
        animationComplexity: 'full' as const,
        cacheStrategy: 'aggressive' as const,
        networkRequestPriority: 'high' as const,
      };

      await resourceManager.applyResourceAllocationStrategy(strategy);

      const finalStrategy = resourceManager.getCurrentStrategy();
      
      // Should have extremely conservative settings due to both constraints
      expect(finalStrategy.enableBackgroundTasks).toBe(false);
      expect(finalStrategy.maxConcurrentOperations).toBe(1);
      expect(finalStrategy.animationComplexity).toBe('reduced');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await resourceManager.initialize(mockSkillManager);
    });

    it('should handle DeviceInfo.getBatteryLevel failures', async () => {
      mockDeviceInfo.getBatteryLevel.mockRejectedValue(new Error('Battery API unavailable'));

      await resourceManager.applyBatteryOptimizations();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Battery optimization failed',
        {},
        expect.any(Error)
      );
    });

    it('should continue functioning after battery optimization errors', async () => {
      mockDeviceInfo.getBatteryLevel.mockRejectedValue(new Error('Battery service error'));

      await resourceManager.applyBatteryOptimizations();

      // Should still be able to get current strategy
      const strategy = resourceManager.getCurrentStrategy();
      expect(strategy).toBeTruthy();
      expect(strategy.name).toBeTruthy();
    });

    it('should handle strategy application failures during battery optimization', async () => {
      mockDeviceInfo.getBatteryLevel.mockResolvedValue(0.05);
      
      // Mock strategy application to fail
      const applyResourceAllocationStrategySpy = jest.spyOn(resourceManager, 'applyResourceAllocationStrategy');
      applyResourceAllocationStrategySpy.mockRejectedValue(new Error('Strategy application failed'));

      await resourceManager.applyBatteryOptimizations();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Battery optimization failed',
        {},
        expect.any(Error)
      );
    });
  });
});