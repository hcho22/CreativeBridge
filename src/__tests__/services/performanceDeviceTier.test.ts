/**
 * Performance and Device Tier Tests
 *
 * Tests for device performance tier detection and tier-specific optimizations
 * Task 4.1: Dynamic Resource Management - Device Tier Integration
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
import { SkillManager } from '../../types/claudeSkills';

jest.mock('react-native-device-info');
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  AppState: { addEventListener: jest.fn() },
  Dimensions: {
    get: jest.fn(() => ({ width: 375, height: 812, scale: 2 })),
  },
}));
jest.mock('../../services/performanceOptimizer');

const mockDeviceInfo = DeviceInfo as jest.Mocked<typeof DeviceInfo>;
const mockPerformanceOptimizer = performanceOptimizer as jest.Mocked<
  typeof performanceOptimizer
>;

describe('Performance and Device Tier Integration', () => {
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

    // Default to medium performance level
    mockPerformanceOptimizer.getPerformanceLevel.mockReturnValue('medium');
    mockPerformanceOptimizer.getMetrics.mockReturnValue({
      memoryUsage: 100 * 1024 * 1024,
      batteryLevel: 0.8,
      networkType: 'wifi',
      devicePerformance: 'medium',
      renderTime: 15,
      apiResponseTime: 1000,
    });
  });

  afterEach(() => {
    resourceManager.destroy();
  });

  describe('Low-Tier Device Strategy', () => {
    beforeEach(() => {
      mockPerformanceOptimizer.getPerformanceLevel.mockReturnValue('low');
    });

    it('should initialize with conservative strategy for low-tier devices', async () => {
      await resourceManager.initialize(mockSkillManager);

      const strategy = resourceManager.getCurrentStrategy();

      expect(strategy.name).toBe('Conservative');
      expect(strategy.memoryLimitMB).toBe(50);
      expect(strategy.maxConcurrentOperations).toBe(1);
      expect(strategy.enableBackgroundTasks).toBe(false);
      expect(strategy.enablePrefetching).toBe(false);
      expect(strategy.imageQuality).toBe('low');
      expect(strategy.animationComplexity).toBe('none');
      expect(strategy.cacheStrategy).toBe('minimal');
      expect(strategy.networkRequestPriority).toBe('low');
    });

    it('should maintain conservative memory limits for low-tier devices', async () => {
      await resourceManager.initialize(mockSkillManager);

      const memoryConfig = resourceManager.getMemoryConfig();
      expect(memoryConfig.baseMemoryLimit).toBe(50 * 1024 * 1024); // 50MB
    });

    it('should apply low-tier optimizations for challenging device conditions', async () => {
      // Mock challenging conditions for low-tier device
      jest.spyOn(resourceManager, 'getCurrentConditions').mockReturnValue({
        memoryPressure: 'high',
        batteryState: 'low',
        thermalState: 'serious',
        networkCondition: 'poor',
        backgroundAppCount: 8,
        availableStorage: 256 * 1024 * 1024, // 256MB
        cpuUsage: 0.9,
      });

      await resourceManager.initialize(mockSkillManager);

      const strategy = resourceManager.getCurrentStrategy();

      // Should use the most conservative settings
      expect(strategy.maxConcurrentOperations).toBe(1);
      expect(strategy.enableBackgroundTasks).toBe(false);
      expect(strategy.animationComplexity).toBe('none');
      expect(strategy.imageQuality).toBe('low');
    });

    it('should handle memory pressure more aggressively on low-tier devices', async () => {
      await resourceManager.initialize(mockSkillManager);

      // Mock high memory pressure relative to low memory limit
      const getCurrentMemoryUsageSpy = jest.spyOn(
        resourceManager as any,
        'getCurrentMemoryUsage',
      );
      getCurrentMemoryUsageSpy.mockResolvedValue(48 * 1024 * 1024); // 96% of 50MB limit

      await resourceManager.performAdaptiveMemoryManagement();

      // Should trigger aggressive cleanup at lower absolute memory usage
      const { structuredLogger } = require('../../utils/logger');
      expect(structuredLogger.warn).toHaveBeenCalledWith(
        'Aggressive memory cleanup performed',
        expect.objectContaining({
          memoryUsage: 48 * 1024 * 1024,
          pressureRatio: 0.96,
        }),
      );
    });
  });

  describe('Medium-Tier Device Strategy', () => {
    beforeEach(() => {
      mockPerformanceOptimizer.getPerformanceLevel.mockReturnValue('medium');
    });

    it('should initialize with balanced strategy for medium-tier devices', async () => {
      await resourceManager.initialize(mockSkillManager);

      const strategy = resourceManager.getCurrentStrategy();

      expect(strategy.name).toBe('Balanced');
      expect(strategy.memoryLimitMB).toBe(100);
      expect(strategy.maxConcurrentOperations).toBe(2);
      expect(strategy.enableBackgroundTasks).toBe(true);
      expect(strategy.enablePrefetching).toBe(true);
      expect(strategy.imageQuality).toBe('medium');
      expect(strategy.animationComplexity).toBe('reduced');
      expect(strategy.cacheStrategy).toBe('balanced');
      expect(strategy.networkRequestPriority).toBe('normal');
    });

    it('should balance performance and conservation for medium-tier devices', async () => {
      await resourceManager.initialize(mockSkillManager);

      const memoryConfig = resourceManager.getMemoryConfig();
      expect(memoryConfig.baseMemoryLimit).toBe(100 * 1024 * 1024); // 100MB

      const strategy = resourceManager.getCurrentStrategy();
      expect(strategy.maxConcurrentOperations).toBe(2); // Not too conservative, not too aggressive
    });

    it('should adapt appropriately to changing conditions on medium-tier devices', async () => {
      await resourceManager.initialize(mockSkillManager);

      // Test adaptation to low battery
      mockDeviceInfo.getBatteryLevel.mockResolvedValue(0.15);
      await resourceManager.applyBatteryOptimizations();

      const optimizedStrategy = resourceManager.getCurrentStrategy();
      expect(optimizedStrategy.enableBackgroundTasks).toBe(false);
      expect(optimizedStrategy.maxConcurrentOperations).toBe(1); // Reduced from 2
    });
  });

  describe('High-Tier Device Strategy', () => {
    beforeEach(() => {
      mockPerformanceOptimizer.getPerformanceLevel.mockReturnValue('high');
    });

    it('should initialize with performance strategy for high-tier devices', async () => {
      await resourceManager.initialize(mockSkillManager);

      const strategy = resourceManager.getCurrentStrategy();

      expect(strategy.name).toBe('Performance');
      expect(strategy.memoryLimitMB).toBe(200);
      expect(strategy.maxConcurrentOperations).toBe(4);
      expect(strategy.enableBackgroundTasks).toBe(true);
      expect(strategy.enablePrefetching).toBe(true);
      expect(strategy.imageQuality).toBe('high');
      expect(strategy.animationComplexity).toBe('full');
      expect(strategy.cacheStrategy).toBe('aggressive');
      expect(strategy.networkRequestPriority).toBe('high');
    });

    it('should allow higher memory usage for high-tier devices', async () => {
      await resourceManager.initialize(mockSkillManager);

      const memoryConfig = resourceManager.getMemoryConfig();
      expect(memoryConfig.baseMemoryLimit).toBe(200 * 1024 * 1024); // 200MB
    });

    it('should maintain performance even under some pressure on high-tier devices', async () => {
      await resourceManager.initialize(mockSkillManager);

      // Mock moderate memory pressure
      const getCurrentMemoryUsageSpy = jest.spyOn(
        resourceManager as any,
        'getCurrentMemoryUsage',
      );
      getCurrentMemoryUsageSpy.mockResolvedValue(170 * 1024 * 1024); // 85% of 200MB limit

      await resourceManager.performAdaptiveMemoryManagement();

      // Should only trigger moderate cleanup, not aggressive
      const { structuredLogger } = require('../../utils/logger');
      expect(structuredLogger.info).toHaveBeenCalledWith(
        'Moderate memory cleanup performed',
        expect.objectContaining({
          memoryUsage: 170 * 1024 * 1024,
          pressureRatio: 0.85,
        }),
      );
    });

    it('should gracefully degrade under extreme pressure on high-tier devices', async () => {
      await resourceManager.initialize(mockSkillManager);

      // Mock extreme conditions
      jest.spyOn(resourceManager, 'getCurrentConditions').mockReturnValue({
        memoryPressure: 'high',
        batteryState: 'critical',
        thermalState: 'critical',
        networkCondition: 'poor',
        backgroundAppCount: 15,
        availableStorage: 100 * 1024 * 1024, // Very low
        cpuUsage: 0.95,
      });

      // Apply emergency battery mode
      mockDeviceInfo.getBatteryLevel.mockResolvedValue(0.05);
      await resourceManager.applyBatteryOptimizations();

      const strategy = resourceManager.getCurrentStrategy();

      // Even high-tier devices should go into emergency mode
      expect(strategy.name).toBe('Emergency Battery');
      expect(strategy.maxConcurrentOperations).toBe(1);
      expect(strategy.enableBackgroundTasks).toBe(false);
    });
  });

  describe('Device Tier Detection Integration', () => {
    it('should use performance optimizer tier detection', async () => {
      mockPerformanceOptimizer.getPerformanceLevel.mockReturnValue('low');
      const lowTierManager = new DynamicResourceManager();
      await lowTierManager.initialize(mockSkillManager);

      expect(lowTierManager.getCurrentStrategy().name).toBe('Conservative');
      lowTierManager.destroy();

      mockPerformanceOptimizer.getPerformanceLevel.mockReturnValue('high');
      const highTierManager = new DynamicResourceManager();
      await highTierManager.initialize(mockSkillManager);

      expect(highTierManager.getCurrentStrategy().name).toBe('Performance');
      highTierManager.destroy();
    });

    it('should adapt strategies when device tier information changes', async () => {
      // Start with medium tier
      mockPerformanceOptimizer.getPerformanceLevel.mockReturnValue('medium');
      await resourceManager.initialize(mockSkillManager);

      expect(resourceManager.getCurrentStrategy().name).toBe('Balanced');

      // Simulate device degradation (thermal throttling, etc.)
      mockPerformanceOptimizer.getPerformanceLevel.mockReturnValue('low');

      // Apply a new strategy which should use current tier
      await resourceManager.applyResourceAllocationStrategy({
        name: 'Adaptive',
        memoryLimitMB: 75,
        maxConcurrentOperations: 2,
        enableBackgroundTasks: true,
        enablePrefetching: false,
        imageQuality: 'medium' as const,
        animationComplexity: 'reduced' as const,
        cacheStrategy: 'balanced' as const,
        networkRequestPriority: 'normal' as const,
      });

      // Strategy should be applied even on degraded tier
      expect(resourceManager.getCurrentStrategy().name).toBe('Adaptive');
    });
  });

  describe('Cross-Tier Comparison', () => {
    it('should have progressive resource allocation across tiers', async () => {
      const tiers: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];
      const strategies: any[] = [];

      for (const tier of tiers) {
        mockPerformanceOptimizer.getPerformanceLevel.mockReturnValue(tier);
        const manager = new DynamicResourceManager();
        await manager.initialize(mockSkillManager);

        strategies.push(manager.getCurrentStrategy());
        manager.destroy();
      }

      const [lowStrategy, mediumStrategy, highStrategy] = strategies;

      // Memory limits should increase across tiers
      expect(lowStrategy.memoryLimitMB).toBeLessThan(
        mediumStrategy.memoryLimitMB,
      );
      expect(mediumStrategy.memoryLimitMB).toBeLessThan(
        highStrategy.memoryLimitMB,
      );

      // Concurrent operations should increase across tiers
      expect(lowStrategy.maxConcurrentOperations).toBeLessThan(
        mediumStrategy.maxConcurrentOperations,
      );
      expect(mediumStrategy.maxConcurrentOperations).toBeLessThan(
        highStrategy.maxConcurrentOperations,
      );

      // Image quality should improve across tiers
      expect(lowStrategy.imageQuality).toBe('low');
      expect(mediumStrategy.imageQuality).toBe('medium');
      expect(highStrategy.imageQuality).toBe('high');

      // Animation complexity should improve across tiers
      expect(lowStrategy.animationComplexity).toBe('none');
      expect(mediumStrategy.animationComplexity).toBe('reduced');
      expect(highStrategy.animationComplexity).toBe('full');
    });

    it('should have appropriate cache strategies across tiers', async () => {
      const tiers: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];
      const cacheStrategies: string[] = [];

      for (const tier of tiers) {
        mockPerformanceOptimizer.getPerformanceLevel.mockReturnValue(tier);
        const manager = new DynamicResourceManager();
        await manager.initialize(mockSkillManager);

        cacheStrategies.push(manager.getCurrentStrategy().cacheStrategy);
        manager.destroy();
      }

      expect(cacheStrategies).toEqual(['minimal', 'balanced', 'aggressive']);
    });

    it('should have tier-appropriate feature enablement', async () => {
      mockPerformanceOptimizer.getPerformanceLevel.mockReturnValue('low');
      const lowTierManager = new DynamicResourceManager();
      await lowTierManager.initialize(mockSkillManager);
      const lowStrategy = lowTierManager.getCurrentStrategy();

      mockPerformanceOptimizer.getPerformanceLevel.mockReturnValue('high');
      const highTierManager = new DynamicResourceManager();
      await highTierManager.initialize(mockSkillManager);
      const highStrategy = highTierManager.getCurrentStrategy();

      // Low tier should disable expensive features
      expect(lowStrategy.enableBackgroundTasks).toBe(false);
      expect(lowStrategy.enablePrefetching).toBe(false);

      // High tier should enable all features
      expect(highStrategy.enableBackgroundTasks).toBe(true);
      expect(highStrategy.enablePrefetching).toBe(true);

      lowTierManager.destroy();
      highTierManager.destroy();
    });
  });

  describe('Performance Metrics Integration', () => {
    beforeEach(async () => {
      await resourceManager.initialize(mockSkillManager);
    });

    it('should use performance metrics for optimization decisions', async () => {
      // Mock poor render performance
      mockPerformanceOptimizer.getMetrics.mockReturnValue({
        memoryUsage: 80 * 1024 * 1024,
        batteryLevel: 0.8,
        networkType: 'wifi',
        devicePerformance: 'medium',
        renderTime: 45, // Poor render time
        apiResponseTime: 1000,
      });

      const conditions = await resourceManager.assessDeviceConditions();

      // Should detect serious thermal state due to poor render performance
      expect(conditions.thermalState).toBe('serious');
      expect(conditions.cpuUsage).toBeGreaterThan(0.7);
    });

    it('should adapt to performance degradation during runtime', async () => {
      // Start with good performance
      mockPerformanceOptimizer.getMetrics.mockReturnValue({
        memoryUsage: 60 * 1024 * 1024,
        batteryLevel: 0.8,
        networkType: 'wifi',
        devicePerformance: 'medium',
        renderTime: 12, // Good render time
        apiResponseTime: 800,
      });

      let conditions = await resourceManager.assessDeviceConditions();
      expect(conditions.thermalState).toBe('nominal');

      // Simulate performance degradation
      mockPerformanceOptimizer.getMetrics.mockReturnValue({
        memoryUsage: 60 * 1024 * 1024,
        batteryLevel: 0.8,
        networkType: 'wifi',
        devicePerformance: 'medium',
        renderTime: 60, // Degraded render time
        apiResponseTime: 800,
      });

      conditions = await resourceManager.assessDeviceConditions();
      expect(conditions.thermalState).toBe('serious');
    });
  });

  describe('Device Tier Edge Cases', () => {
    it('should handle unknown device tier gracefully', async () => {
      // Mock an unknown tier
      mockPerformanceOptimizer.getPerformanceLevel.mockReturnValue(
        'unknown' as any,
      );

      await resourceManager.initialize(mockSkillManager);

      // Should fall back to medium tier strategy
      const strategy = resourceManager.getCurrentStrategy();
      expect(strategy).toBeTruthy();
      expect(strategy.maxConcurrentOperations).toBeGreaterThan(0);
    });

    it('should handle device tier detection errors', async () => {
      mockPerformanceOptimizer.getPerformanceLevel.mockImplementation(() => {
        throw new Error('Performance detection failed');
      });

      // Should not crash during initialization
      await expect(
        resourceManager.initialize(mockSkillManager),
      ).resolves.not.toThrow();

      const strategy = resourceManager.getCurrentStrategy();
      expect(strategy).toBeTruthy();
    });

    it('should handle dynamic tier changes during app lifecycle', async () => {
      // Start with high tier
      mockPerformanceOptimizer.getPerformanceLevel.mockReturnValue('high');
      await resourceManager.initialize(mockSkillManager);

      const initialStrategy = resourceManager.getCurrentStrategy();
      expect(initialStrategy.name).toBe('Performance');

      // Simulate thermal throttling causing tier downgrade
      mockPerformanceOptimizer.getPerformanceLevel.mockReturnValue('low');

      // Trigger app state change to background and back to active
      const { AppState } = require('react-native');
      const addEventListenerSpy =
        AppState.addEventListener as jest.MockedFunction<
          typeof AppState.addEventListener
        >;
      const changeCallback = addEventListenerSpy.mock.calls.find(
        call => call[0] === 'change',
      )?.[1];

      if (changeCallback) {
        await changeCallback('background');
        await changeCallback('active');
      }

      // Should restore based on current (downgraded) tier
      const restoredStrategy = resourceManager.getCurrentStrategy();
      expect(restoredStrategy.name).toBe('Conservative'); // Should match low tier
    });
  });
});
