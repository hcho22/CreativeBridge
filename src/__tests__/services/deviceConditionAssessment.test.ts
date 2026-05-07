/**
 * Device Condition Assessment Tests
 *
 * Specialized tests for real-time device performance assessment
 * Task 4.1.2: Real-time device performance assessment
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import DeviceInfo from 'react-native-device-info';

import DynamicResourceManager from '../../services/resourceManager';

jest.mock('react-native-device-info');
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  AppState: { addEventListener: jest.fn() },
}));

jest.mock('@react-native-community/netinfo', () => ({
  default: {
    fetch: jest.fn(),
  },
}));

const mockDeviceInfo = DeviceInfo as jest.Mocked<typeof DeviceInfo>;

describe('Device Condition Assessment', () => {
  let resourceManager: DynamicResourceManager;

  beforeEach(() => {
    jest.clearAllMocks();
    resourceManager = new DynamicResourceManager();

    // Setup default mocks
    mockDeviceInfo.getBatteryLevel.mockResolvedValue(0.8);
    mockDeviceInfo.getBatteryState.mockResolvedValue('unplugged');
    mockDeviceInfo.getPowerState.mockResolvedValue({});
    mockDeviceInfo.getAvailableMemory.mockResolvedValue(2 * 1024 * 1024 * 1024);
    mockDeviceInfo.getTotalMemory.mockResolvedValue(4 * 1024 * 1024 * 1024);
    mockDeviceInfo.getUsedMemory.mockResolvedValue(2 * 1024 * 1024 * 1024);
    mockDeviceInfo.getFreeDiskStorage.mockResolvedValue(
      10 * 1024 * 1024 * 1024,
    );
  });

  afterEach(() => {
    resourceManager.destroy();
  });

  describe('Memory Pressure Assessment', () => {
    it('should detect low memory pressure', async () => {
      mockDeviceInfo.getTotalMemory.mockResolvedValue(8 * 1024 * 1024 * 1024); // 8GB
      mockDeviceInfo.getUsedMemory.mockResolvedValue(2 * 1024 * 1024 * 1024); // 2GB used (25%)

      const conditions = await resourceManager.assessDeviceConditions();
      expect(conditions.memoryPressure).toBe('low');
    });

    it('should detect medium memory pressure', async () => {
      mockDeviceInfo.getTotalMemory.mockResolvedValue(4 * 1024 * 1024 * 1024); // 4GB
      mockDeviceInfo.getUsedMemory.mockResolvedValue(3 * 1024 * 1024 * 1024); // 3GB used (75%)

      const conditions = await resourceManager.assessDeviceConditions();
      expect(conditions.memoryPressure).toBe('medium');
    });

    it('should detect high memory pressure', async () => {
      mockDeviceInfo.getTotalMemory.mockResolvedValue(4 * 1024 * 1024 * 1024); // 4GB
      mockDeviceInfo.getUsedMemory.mockResolvedValue(3.6 * 1024 * 1024 * 1024); // 3.6GB used (90%)

      const conditions = await resourceManager.assessDeviceConditions();
      expect(conditions.memoryPressure).toBe('high');
    });

    it('should handle memory info errors gracefully', async () => {
      mockDeviceInfo.getTotalMemory.mockRejectedValue(
        new Error('Memory unavailable'),
      );
      mockDeviceInfo.getUsedMemory.mockRejectedValue(
        new Error('Memory unavailable'),
      );

      const conditions = await resourceManager.assessDeviceConditions();
      expect(conditions.memoryPressure).toBe('medium'); // Safe default
    });
  });

  describe('Battery State Assessment', () => {
    it('should detect charging state', async () => {
      mockDeviceInfo.getBatteryLevel.mockResolvedValue(0.5);
      mockDeviceInfo.getBatteryState.mockResolvedValue('charging');

      const conditions = await resourceManager.assessDeviceConditions();
      expect(conditions.batteryState).toBe('charging');
    });

    it('should detect unplugged state with good battery', async () => {
      mockDeviceInfo.getBatteryLevel.mockResolvedValue(0.8);
      mockDeviceInfo.getBatteryState.mockResolvedValue('unplugged');

      const conditions = await resourceManager.assessDeviceConditions();
      expect(conditions.batteryState).toBe('unplugged');
    });

    it('should detect low battery state', async () => {
      mockDeviceInfo.getBatteryLevel.mockResolvedValue(0.15);
      mockDeviceInfo.getBatteryState.mockResolvedValue('unplugged');

      const conditions = await resourceManager.assessDeviceConditions();
      expect(conditions.batteryState).toBe('low');
    });

    it('should detect critical battery state', async () => {
      mockDeviceInfo.getBatteryLevel.mockResolvedValue(0.05);
      mockDeviceInfo.getBatteryState.mockResolvedValue('unplugged');

      const conditions = await resourceManager.assessDeviceConditions();
      expect(conditions.batteryState).toBe('critical');
    });

    it('should prioritize charging state over low battery level', async () => {
      mockDeviceInfo.getBatteryLevel.mockResolvedValue(0.05); // Critical level
      mockDeviceInfo.getBatteryState.mockResolvedValue('charging'); // But charging

      const conditions = await resourceManager.assessDeviceConditions();
      expect(conditions.batteryState).toBe('charging');
    });
  });

  describe('Thermal State Assessment', () => {
    beforeEach(() => {
      // Mock performance optimizer for thermal state calculation
      jest.doMock('../../services/performanceOptimizer', () => ({
        performanceOptimizer: {
          getMetrics: jest.fn(() => ({
            renderTime: 12,
            memoryUsage: 0,
            batteryLevel: 0.8,
            networkType: 'wifi',
            devicePerformance: 'medium',
            apiResponseTime: 1000,
          })),
          getPerformanceLevel: jest.fn(() => 'medium'),
        },
      }));
    });

    it('should assess thermal state based on CPU usage', async () => {
      // Mock high render times to simulate high CPU usage
      const {
        performanceOptimizer,
      } = require('../../services/performanceOptimizer');
      performanceOptimizer.getMetrics.mockReturnValue({
        renderTime: 80, // High render time indicates high CPU
        memoryUsage: 0,
        batteryLevel: 0.8,
        networkType: 'wifi',
        devicePerformance: 'medium',
        apiResponseTime: 1000,
      });

      const conditions = await resourceManager.assessDeviceConditions();
      expect(conditions.thermalState).toBe('serious');
    });

    it('should handle missing performance metrics gracefully', async () => {
      const {
        performanceOptimizer,
      } = require('../../services/performanceOptimizer');
      performanceOptimizer.getMetrics.mockImplementation(() => {
        throw new Error('Performance metrics unavailable');
      });

      const conditions = await resourceManager.assessDeviceConditions();
      expect(conditions.thermalState).toBe('nominal'); // Safe default
    });
  });

  describe('Network Condition Assessment', () => {
    beforeEach(() => {
      const mockNetInfo = require('@react-native-community/netinfo');
      mockNetInfo.default.fetch.mockResolvedValue({
        isConnected: true,
        type: 'wifi',
        details: { cellularGeneration: '4g' },
      });
    });

    it('should detect excellent network conditions (WiFi)', async () => {
      const mockNetInfo = require('@react-native-community/netinfo');
      mockNetInfo.default.fetch.mockResolvedValue({
        isConnected: true,
        type: 'wifi',
      });

      const conditions = await resourceManager.assessDeviceConditions();
      expect(conditions.networkCondition).toBe('excellent');
    });

    it('should detect good network conditions (4G)', async () => {
      const mockNetInfo = require('@react-native-community/netinfo');
      mockNetInfo.default.fetch.mockResolvedValue({
        isConnected: true,
        type: 'cellular',
        details: { cellularGeneration: '4g' },
      });

      const conditions = await resourceManager.assessDeviceConditions();
      expect(conditions.networkCondition).toBe('good');
    });

    it('should detect poor network conditions (3G)', async () => {
      const mockNetInfo = require('@react-native-community/netinfo');
      mockNetInfo.default.fetch.mockResolvedValue({
        isConnected: true,
        type: 'cellular',
        details: { cellularGeneration: '3g' },
      });

      const conditions = await resourceManager.assessDeviceConditions();
      expect(conditions.networkCondition).toBe('poor');
    });

    it('should detect offline state', async () => {
      const mockNetInfo = require('@react-native-community/netinfo');
      mockNetInfo.default.fetch.mockResolvedValue({
        isConnected: false,
        type: 'none',
      });

      const conditions = await resourceManager.assessDeviceConditions();
      expect(conditions.networkCondition).toBe('offline');
    });

    it('should handle network info errors gracefully', async () => {
      const mockNetInfo = require('@react-native-community/netinfo');
      mockNetInfo.default.fetch.mockRejectedValue(
        new Error('Network info unavailable'),
      );

      const conditions = await resourceManager.assessDeviceConditions();
      expect(conditions.networkCondition).toBe('good'); // Safe default
    });
  });

  describe('Background App Estimation', () => {
    it('should estimate background apps based on memory usage', async () => {
      // High memory usage suggests more background apps
      mockDeviceInfo.getTotalMemory.mockResolvedValue(4 * 1024 * 1024 * 1024);
      mockDeviceInfo.getUsedMemory.mockResolvedValue(3.5 * 1024 * 1024 * 1024); // 87.5%

      const conditions = await resourceManager.assessDeviceConditions();
      expect(conditions.backgroundAppCount).toBeGreaterThan(5);
    });

    it('should estimate fewer background apps for low memory usage', async () => {
      mockDeviceInfo.getTotalMemory.mockResolvedValue(4 * 1024 * 1024 * 1024);
      mockDeviceInfo.getUsedMemory.mockResolvedValue(1 * 1024 * 1024 * 1024); // 25%

      const conditions = await resourceManager.assessDeviceConditions();
      expect(conditions.backgroundAppCount).toBeLessThan(5);
    });

    it('should handle memory errors in background app estimation', async () => {
      mockDeviceInfo.getTotalMemory.mockRejectedValue(
        new Error('Memory unavailable'),
      );
      mockDeviceInfo.getUsedMemory.mockRejectedValue(
        new Error('Memory unavailable'),
      );

      const conditions = await resourceManager.assessDeviceConditions();
      expect(conditions.backgroundAppCount).toBe(0); // Safe default
    });
  });

  describe('Performance History Tracking', () => {
    it('should update performance history when conditions are assessed', async () => {
      // Assess conditions multiple times
      await resourceManager.assessDeviceConditions();
      await resourceManager.assessDeviceConditions();
      await resourceManager.assessDeviceConditions();

      const history = resourceManager.getPerformanceHistory();

      expect(history.memory.length).toBeGreaterThan(0);
      expect(history.performance.length).toBeGreaterThan(0);
      expect(history.memory.every(val => val >= 0 && val <= 1)).toBe(true);
      expect(history.performance.every(val => val >= 0 && val <= 1)).toBe(true);
    });

    it('should limit history size', async () => {
      // Simulate many condition assessments
      for (let i = 0; i < 150; i++) {
        await resourceManager.assessDeviceConditions();
      }

      const history = resourceManager.getPerformanceHistory();
      expect(history.memory.length).toBeLessThanOrEqual(100);
      expect(history.performance.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Condition Change Detection', () => {
    it('should detect significant memory pressure changes', async () => {
      // First assessment - low memory pressure
      mockDeviceInfo.getUsedMemory.mockResolvedValue(1 * 1024 * 1024 * 1024);
      const conditions1 = await resourceManager.assessDeviceConditions();

      // Second assessment - high memory pressure
      mockDeviceInfo.getUsedMemory.mockResolvedValue(3.6 * 1024 * 1024 * 1024);
      const conditions2 = await resourceManager.assessDeviceConditions();

      // Should detect change from low to high
      expect(conditions1.memoryPressure).toBe('low');
      expect(conditions2.memoryPressure).toBe('high');
    });

    it('should detect battery state changes', async () => {
      // First assessment - good battery
      mockDeviceInfo.getBatteryLevel.mockResolvedValue(0.8);
      mockDeviceInfo.getBatteryState.mockResolvedValue('unplugged');
      const conditions1 = await resourceManager.assessDeviceConditions();

      // Second assessment - low battery
      mockDeviceInfo.getBatteryLevel.mockResolvedValue(0.1);
      const conditions2 = await resourceManager.assessDeviceConditions();

      expect(conditions1.batteryState).toBe('unplugged');
      expect(conditions2.batteryState).toBe('critical');
    });

    it('should detect CPU usage changes', async () => {
      const {
        performanceOptimizer,
      } = require('../../services/performanceOptimizer');

      // First assessment - low CPU
      performanceOptimizer.getMetrics.mockReturnValue({
        renderTime: 10, // Low render time
        memoryUsage: 0,
        batteryLevel: 0.8,
        networkType: 'wifi',
        devicePerformance: 'medium',
        apiResponseTime: 1000,
      });
      const conditions1 = await resourceManager.assessDeviceConditions();

      // Second assessment - high CPU
      performanceOptimizer.getMetrics.mockReturnValue({
        renderTime: 60, // High render time
        memoryUsage: 0,
        batteryLevel: 0.8,
        networkType: 'wifi',
        devicePerformance: 'medium',
        apiResponseTime: 1000,
      });
      const conditions2 = await resourceManager.assessDeviceConditions();

      expect(
        Math.abs(conditions1.cpuUsage - conditions2.cpuUsage),
      ).toBeGreaterThan(0.2);
    });
  });

  describe('Error Recovery and Fallbacks', () => {
    it('should provide safe defaults when all device info fails', async () => {
      // Mock all device info calls to fail
      mockDeviceInfo.getBatteryLevel.mockRejectedValue(
        new Error('Battery unavailable'),
      );
      mockDeviceInfo.getBatteryState.mockRejectedValue(
        new Error('Battery state unavailable'),
      );
      mockDeviceInfo.getTotalMemory.mockRejectedValue(
        new Error('Memory unavailable'),
      );
      mockDeviceInfo.getUsedMemory.mockRejectedValue(
        new Error('Memory unavailable'),
      );
      mockDeviceInfo.getAvailableMemory.mockRejectedValue(
        new Error('Memory unavailable'),
      );
      mockDeviceInfo.getFreeDiskStorage.mockRejectedValue(
        new Error('Storage unavailable'),
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

    it('should handle partial device info failures gracefully', async () => {
      // Only battery info fails
      mockDeviceInfo.getBatteryLevel.mockRejectedValue(
        new Error('Battery unavailable'),
      );
      mockDeviceInfo.getBatteryState.mockRejectedValue(
        new Error('Battery state unavailable'),
      );

      const conditions = await resourceManager.assessDeviceConditions();

      // Should have safe battery defaults but other values should be assessed
      expect(conditions.batteryState).toBe('unplugged');
      expect(conditions.memoryPressure).toMatch(/^(low|medium|high)$/);
      expect(conditions.networkCondition).toMatch(
        /^(excellent|good|poor|offline)$/,
      );
    });
  });
});
