/**
 * Dynamic Resource Manager Tests
 *
 * Comprehensive test suite for Task 4.1: Dynamic Resource Management
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
import { AppState } from 'react-native';

import DynamicResourceManager from '../../services/resourceManager';
import { performanceOptimizer } from '../../services/performanceOptimizer';
import {
  SkillManager,
  ResourceOptimizationResult,
  SkillResult,
} from '../../types/claudeSkills';
import { structuredLogger } from '../../utils/logger';

// Mock dependencies
jest.mock('react-native-device-info');
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  AppState: {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
}));

jest.mock('../../services/performanceOptimizer');
jest.mock('../../utils/logger');
jest.mock('@react-native-community/netinfo', () => ({
  default: {
    fetch: jest.fn(() =>
      Promise.resolve({
        isConnected: true,
        type: 'wifi',
        details: {
          cellularGeneration: '4g',
        },
      }),
    ),
  },
}));

const mockDeviceInfo = DeviceInfo as jest.Mocked<typeof DeviceInfo>;
const mockPerformanceOptimizer = performanceOptimizer as jest.Mocked<
  typeof performanceOptimizer
>;
const mockLogger = structuredLogger as jest.Mocked<typeof structuredLogger>;

describe('DynamicResourceManager', () => {
  let resourceManager: DynamicResourceManager;
  let mockSkillManager: jest.Mocked<SkillManager>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create new instance for each test
    resourceManager = new DynamicResourceManager();

    // Mock SkillManager
    mockSkillManager = {
      initialize: jest.fn(),
      registerSkill: jest.fn(),
      executeSkill: jest.fn(),
      getSkillStatus: jest.fn(),
      shutdown: jest.fn(),
      isInitialized: jest.fn(() => true),
    };

    // Setup default device info mocks
    mockDeviceInfo.getBatteryLevel.mockResolvedValue(0.8);
    mockDeviceInfo.getBatteryState.mockResolvedValue('unplugged');
    mockDeviceInfo.getPowerState.mockResolvedValue({});
    mockDeviceInfo.getAvailableMemory.mockResolvedValue(2 * 1024 * 1024 * 1024);
    mockDeviceInfo.getTotalMemory.mockResolvedValue(4 * 1024 * 1024 * 1024);
    mockDeviceInfo.getUsedMemory.mockResolvedValue(2 * 1024 * 1024 * 1024);
    mockDeviceInfo.getFreeDiskStorage.mockResolvedValue(
      10 * 1024 * 1024 * 1024,
    );

    // Setup performance optimizer mocks
    mockPerformanceOptimizer.getPerformanceLevel.mockReturnValue('medium');
    mockPerformanceOptimizer.getMetrics.mockReturnValue({
      memoryUsage: 100 * 1024 * 1024,
      batteryLevel: 0.8,
      networkType: 'wifi',
      devicePerformance: 'medium',
      renderTime: 12,
      apiResponseTime: 1000,
    });
    mockPerformanceOptimizer.getOptimizationSettings.mockReturnValue({
      enableImageCaching: true,
      maxConcurrentRequests: 2,
      prefetchEnabled: true,
      animationsEnabled: true,
      backgroundProcessing: true,
      compressionLevel: 0.7,
    });

    // Setup logger mocks
    mockLogger.info = jest.fn();
    mockLogger.error = jest.fn();
    mockLogger.warn = jest.fn();
    mockLogger.debug = jest.fn();
  });

  afterEach(() => {
    resourceManager.destroy();
  });

  describe('Initialization', () => {
    it('should initialize successfully with valid SkillManager', async () => {
      await resourceManager.initialize(mockSkillManager);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Dynamic Resource Manager initialized',
        expect.objectContaining({
          initialStrategy: 'Balanced',
          deviceConditions: expect.any(Object),
        }),
      );
    });

    it('should handle initialization failure gracefully', async () => {
      mockDeviceInfo.getBatteryLevel.mockRejectedValue(
        new Error('Device info failure'),
      );

      await expect(
        resourceManager.initialize(mockSkillManager),
      ).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to initialize Dynamic Resource Manager',
        {},
        expect.any(Error),
      );
    });

    it('should not re-initialize if already initialized', async () => {
      await resourceManager.initialize(mockSkillManager);
      jest.clearAllMocks();

      await resourceManager.initialize(mockSkillManager);

      expect(mockLogger.info).not.toHaveBeenCalledWith(
        'Dynamic Resource Manager initialized',
        expect.any(Object),
      );
    });
  });

  describe('Device Condition Assessment', () => {
    beforeEach(async () => {
      await resourceManager.initialize(mockSkillManager);
    });

    it('should assess device conditions correctly', async () => {
      const conditions = await resourceManager.assessDeviceConditions();

      expect(conditions).toMatchObject({
        memoryPressure: 'medium',
        batteryState: 'unplugged',
        thermalState: 'nominal',
        networkCondition: 'excellent',
        backgroundAppCount: expect.any(Number),
        availableStorage: expect.any(Number),
        cpuUsage: expect.any(Number),
      });
    });

    it('should calculate memory pressure levels correctly', async () => {
      // Test high memory pressure
      mockDeviceInfo.getUsedMemory.mockResolvedValue(3.5 * 1024 * 1024 * 1024); // 87.5% of 4GB

      const conditions = await resourceManager.assessDeviceConditions();
      expect(conditions.memoryPressure).toBe('high');
    });

    it('should determine battery state correctly', async () => {
      // Test low battery
      mockDeviceInfo.getBatteryLevel.mockResolvedValue(0.15);

      const conditions = await resourceManager.assessDeviceConditions();
      expect(conditions.batteryState).toBe('low');

      // Test critical battery
      mockDeviceInfo.getBatteryLevel.mockResolvedValue(0.05);
      const criticalConditions = await resourceManager.assessDeviceConditions();
      expect(criticalConditions.batteryState).toBe('critical');
    });

    it('should handle device info errors gracefully', async () => {
      mockDeviceInfo.getBatteryLevel.mockRejectedValue(
        new Error('Battery info unavailable'),
      );
      mockDeviceInfo.getTotalMemory.mockRejectedValue(
        new Error('Memory info unavailable'),
      );

      const conditions = await resourceManager.assessDeviceConditions();

      // Should return safe defaults
      expect(conditions).toMatchObject({
        memoryPressure: 'medium',
        batteryState: 'unplugged',
        thermalState: 'nominal',
        networkCondition: 'good',
        backgroundAppCount: 0,
        availableStorage: 1024 * 1024 * 1024,
        cpuUsage: 0.5,
      });
    });
  });

  describe('Claude Skills Integration', () => {
    beforeEach(async () => {
      await resourceManager.initialize(mockSkillManager);
    });

    it('should request Claude optimization successfully', async () => {
      const mockOptimizationResult: ResourceOptimizationResult = {
        recommendations: [
          {
            type: 'memory',
            action: 'reduce_cache',
            priority: 'high',
            estimatedImpact: 0.8,
          },
        ],
        optimizations: [
          {
            parameter: 'memory_limit',
            currentValue: 100,
            recommendedValue: 80,
            reason: 'High memory pressure detected',
          },
        ],
        estimatedImpact: {
          memorySavings: 20 * 1024 * 1024,
          batterySavings: 0.1,
          performanceImprovement: 0.15,
        },
      };

      const mockSkillResult: SkillResult<ResourceOptimizationResult> = {
        success: true,
        data: mockOptimizationResult,
        executionTimeMs: 150,
        skillType: 'ResourceOptimizationSkill',
        confidence: 0.9,
      };

      mockSkillManager.executeSkill.mockResolvedValue(mockSkillResult);

      const result = await resourceManager.requestClaudeOptimization();

      expect(result).toBe(mockOptimizationResult);
      expect(mockSkillManager.executeSkill).toHaveBeenCalledWith(
        'ResourceOptimizationSkill',
        expect.objectContaining({
          deviceInfo: expect.any(Object),
          currentUsage: expect.any(Object),
        }),
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Claude optimization applied',
        expect.objectContaining({
          recommendations: 1,
          optimizations: 1,
        }),
      );
    });

    it('should handle Claude optimization failures gracefully', async () => {
      mockSkillManager.executeSkill.mockRejectedValue(
        new Error('Claude API error'),
      );

      const result = await resourceManager.requestClaudeOptimization();

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Claude optimization request failed',
        {},
        expect.any(Error),
      );
    });

    it('should respect optimization cooldown', async () => {
      const mockResult: SkillResult<ResourceOptimizationResult> = {
        success: true,
        data: {
          recommendations: [],
          optimizations: [],
          estimatedImpact: {
            memorySavings: 0,
            batterySavings: 0,
            performanceImprovement: 0,
          },
        },
        executionTimeMs: 100,
        skillType: 'ResourceOptimizationSkill',
      };

      mockSkillManager.executeSkill.mockResolvedValue(mockResult);

      // First call should work
      await resourceManager.requestClaudeOptimization();
      expect(mockSkillManager.executeSkill).toHaveBeenCalledTimes(1);

      // Second immediate call should be blocked by cooldown
      const result = await resourceManager.requestClaudeOptimization();
      expect(result).toBeNull();
      expect(mockSkillManager.executeSkill).toHaveBeenCalledTimes(1);
    });
  });

  describe('Resource Allocation Strategies', () => {
    beforeEach(async () => {
      await resourceManager.initialize(mockSkillManager);
    });

    it('should apply resource allocation strategy correctly', async () => {
      const strategy = {
        name: 'Test Strategy',
        memoryLimitMB: 150,
        maxConcurrentOperations: 3,
        enableBackgroundTasks: true,
        enablePrefetching: false,
        imageQuality: 'medium' as const,
        animationComplexity: 'reduced' as const,
        cacheStrategy: 'balanced' as const,
        networkRequestPriority: 'normal' as const,
      };

      await resourceManager.applyResourceAllocationStrategy(strategy);

      const currentStrategy = resourceManager.getCurrentStrategy();
      expect(currentStrategy).toMatchObject(strategy);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Resource allocation strategy applied',
        expect.objectContaining({
          strategy: 'Test Strategy',
          memoryLimit: 150,
          maxOperations: 3,
          backgroundTasks: true,
        }),
      );
    });

    it('should trigger memory management for high memory pressure', async () => {
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

      const strategy = {
        name: 'High Memory Strategy',
        memoryLimitMB: 50,
        maxConcurrentOperations: 1,
        enableBackgroundTasks: false,
        enablePrefetching: false,
        imageQuality: 'low' as const,
        animationComplexity: 'none' as const,
        cacheStrategy: 'minimal' as const,
        networkRequestPriority: 'low' as const,
      };

      await resourceManager.applyResourceAllocationStrategy(strategy);

      // Should have triggered memory management
      expect(mockPerformanceOptimizer.resetOptimizations).toHaveBeenCalled();
    });
  });

  describe('Adaptive Memory Management', () => {
    beforeEach(async () => {
      await resourceManager.initialize(mockSkillManager);
    });

    it('should perform aggressive cleanup for critical memory pressure', async () => {
      // Mock getCurrentMemoryUsage to return high value
      const getCurrentMemoryUsageSpy = jest.spyOn(
        resourceManager as any,
        'getCurrentMemoryUsage',
      );
      getCurrentMemoryUsageSpy.mockResolvedValue(200 * 1024 * 1024); // 200MB

      await resourceManager.performAdaptiveMemoryManagement();

      expect(mockPerformanceOptimizer.resetOptimizations).toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Aggressive memory cleanup performed',
        expect.objectContaining({
          memoryUsage: 200 * 1024 * 1024,
          pressureRatio: expect.any(Number),
        }),
      );
    });

    it('should perform moderate cleanup for warning level memory pressure', async () => {
      const getCurrentMemoryUsageSpy = jest.spyOn(
        resourceManager as any,
        'getCurrentMemoryUsage',
      );
      getCurrentMemoryUsageSpy.mockResolvedValue(90 * 1024 * 1024); // 90MB

      await resourceManager.performAdaptiveMemoryManagement();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Moderate memory cleanup performed',
        expect.objectContaining({
          memoryUsage: 90 * 1024 * 1024,
          pressureRatio: expect.any(Number),
        }),
      );
    });

    it('should handle memory management errors gracefully', async () => {
      const getCurrentMemoryUsageSpy = jest.spyOn(
        resourceManager as any,
        'getCurrentMemoryUsage',
      );
      getCurrentMemoryUsageSpy.mockRejectedValue(
        new Error('Memory info unavailable'),
      );

      await resourceManager.performAdaptiveMemoryManagement();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Adaptive memory management failed',
        {},
        expect.any(Error),
      );
    });
  });

  describe('Battery Optimization', () => {
    beforeEach(async () => {
      await resourceManager.initialize(mockSkillManager);
    });

    it('should apply emergency battery mode for critical battery', async () => {
      mockDeviceInfo.getBatteryLevel.mockResolvedValue(0.05); // 5% battery

      await resourceManager.applyBatteryOptimizations();

      const currentStrategy = resourceManager.getCurrentStrategy();
      expect(currentStrategy.name).toBe('Emergency Battery');
      expect(currentStrategy.enableBackgroundTasks).toBe(false);
      expect(currentStrategy.enablePrefetching).toBe(false);
      expect(currentStrategy.maxConcurrentOperations).toBe(1);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Emergency battery mode activated',
        expect.objectContaining({
          batteryLevel: 0.05,
          strategy: 'Emergency Battery',
        }),
      );
    });

    it('should apply low battery optimizations', async () => {
      mockDeviceInfo.getBatteryLevel.mockResolvedValue(0.15); // 15% battery

      await resourceManager.applyBatteryOptimizations();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Low battery optimizations applied',
        expect.objectContaining({
          batteryLevel: 0.15,
          reducedOperations: expect.any(Number),
        }),
      );
    });

    it('should handle battery optimization errors gracefully', async () => {
      mockDeviceInfo.getBatteryLevel.mockRejectedValue(
        new Error('Battery info unavailable'),
      );

      await resourceManager.applyBatteryOptimizations();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Battery optimization failed',
        {},
        expect.any(Error),
      );
    });
  });

  describe('App State Handling', () => {
    beforeEach(async () => {
      await resourceManager.initialize(mockSkillManager);
    });

    it('should handle app going to background', async () => {
      const addEventListenerSpy =
        AppState.addEventListener as jest.MockedFunction<
          typeof AppState.addEventListener
        >;

      // Get the callback that was registered
      const calls = addEventListenerSpy.mock.calls;
      const changeCallback = calls.find(call => call[0] === 'change')?.[1];

      if (changeCallback) {
        // Simulate app going to background
        await changeCallback('background');

        const currentStrategy = resourceManager.getCurrentStrategy();
        expect(currentStrategy.enableBackgroundTasks).toBe(false);
        expect(currentStrategy.enablePrefetching).toBe(false);
        expect(currentStrategy.maxConcurrentOperations).toBe(1);
      }
    });

    it('should handle app becoming active', async () => {
      const addEventListenerSpy =
        AppState.addEventListener as jest.MockedFunction<
          typeof AppState.addEventListener
        >;

      const calls = addEventListenerSpy.mock.calls;
      const changeCallback = calls.find(call => call[0] === 'change')?.[1];

      if (changeCallback) {
        // First go to background
        await changeCallback('background');

        // Then become active
        await changeCallback('active');

        // Should restore based on device tier (medium in our mock)
        const currentStrategy = resourceManager.getCurrentStrategy();
        expect(currentStrategy.name).toBe('Balanced');
      }
    });
  });

  describe('Public API', () => {
    beforeEach(async () => {
      await resourceManager.initialize(mockSkillManager);
    });

    it('should return current strategy', () => {
      const strategy = resourceManager.getCurrentStrategy();
      expect(strategy).toMatchObject({
        name: 'Balanced',
        memoryLimitMB: 100,
        maxConcurrentOperations: 2,
        enableBackgroundTasks: true,
        enablePrefetching: true,
      });
    });

    it('should return current conditions', () => {
      const conditions = resourceManager.getCurrentConditions();
      expect(conditions).toMatchObject({
        memoryPressure: expect.any(String),
        batteryState: expect.any(String),
        thermalState: expect.any(String),
        networkCondition: expect.any(String),
      });
    });

    it('should return configuration objects', () => {
      const memoryConfig = resourceManager.getMemoryConfig();
      expect(memoryConfig).toHaveProperty('baseMemoryLimit');
      expect(memoryConfig).toHaveProperty('warningThreshold');
      expect(memoryConfig).toHaveProperty('criticalThreshold');

      const batteryConfig = resourceManager.getBatteryConfig();
      expect(batteryConfig).toHaveProperty('lowBatteryThreshold');
      expect(batteryConfig).toHaveProperty('criticalBatteryThreshold');
    });

    it('should force optimization on demand', async () => {
      mockSkillManager.executeSkill.mockResolvedValue({
        success: true,
        data: {
          recommendations: [],
          optimizations: [],
          estimatedImpact: {
            memorySavings: 0,
            batterySavings: 0,
            performanceImprovement: 0,
          },
        },
        executionTimeMs: 100,
        skillType: 'ResourceOptimizationSkill',
      });

      const result = await resourceManager.forceOptimization();
      expect(result).toBeTruthy();
      expect(mockSkillManager.executeSkill).toHaveBeenCalled();
    });

    it('should return performance history', () => {
      const history = resourceManager.getPerformanceHistory();
      expect(history).toHaveProperty('memory');
      expect(history).toHaveProperty('battery');
      expect(history).toHaveProperty('performance');
      expect(Array.isArray(history.memory)).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle null skill manager', async () => {
      const result = await resourceManager.requestClaudeOptimization();
      expect(result).toBeNull();
    });

    it('should handle destroyed state', () => {
      resourceManager.destroy();

      resourceManager.getCurrentConditions();
      resourceManager.getCurrentStrategy();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Dynamic Resource Manager destroyed',
      );
    });
  });
});
