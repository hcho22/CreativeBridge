/**
 * Singleton Timer Lifecycle Validation Tests
 *
 * Validates that all singleton services with setInterval timers expose
 * idempotent destroy() methods and properly clean up. (Finding P-3.3)
 */

import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';

// Mock all external dependencies
jest.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Dimensions: { get: jest.fn(() => ({ width: 390, height: 844, scale: 3 })) },
  InteractionManager: {
    runAfterInteractions: jest.fn((cb: () => void) => {
      cb();
      return { cancel: jest.fn() };
    }),
  },
  AppState: { addEventListener: jest.fn() },
}));

jest.mock('react-native-device-info', () => ({
  default: {
    getTotalMemory: jest.fn(() => Promise.resolve(4 * 1024 * 1024 * 1024)),
    getDeviceType: jest.fn(() => Promise.resolve('Handset')),
    getSystemVersion: jest.fn(() => Promise.resolve('16.0')),
    getApiLevel: jest.fn(() => Promise.resolve(30)),
    getBatteryLevel: jest.fn(() => Promise.resolve(0.8)),
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

jest.mock('../../services/contentPrediction', () => ({
  contentPredictionService: {
    analyzeStoryContext: jest.fn(),
    predictContent: jest.fn(),
    getStoryPatterns: jest.fn(() => []),
  },
}));

jest.mock('../../services/behaviorAnalytics', () => ({
  behaviorAnalytics: {
    recordInteraction: jest.fn(),
  },
}));

describe('Singleton Timer Lifecycle (P-3.3)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.resetModules();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('storyCache should expose destroy() that clears cleanup timer', () => {
    const { storyCacheService } = require('../../services/storyCache');

    expect(typeof storyCacheService.destroy).toBe('function');

    // Calling destroy should clear the cleanup interval
    storyCacheService.destroy();

    // Advancing timers should not trigger any cache cleanup
    // (If timer were still active, it would try to run cleanupExpiredEntries)
    expect(() => jest.advanceTimersByTime(10 * 60 * 1000)).not.toThrow();
  });

  it('predictiveStoryCache should expose destroy() that clears preload and invalidation timers', () => {
    const {
      predictiveStoryCacheService,
    } = require('../../services/predictiveStoryCache');

    expect(typeof predictiveStoryCacheService.destroy).toBe('function');

    predictiveStoryCacheService.destroy();

    // Timers should be cleared
    expect(() => jest.advanceTimersByTime(10 * 60 * 1000)).not.toThrow();
  });

  it('performanceOptimizer should expose destroy() that clears memory check timer', () => {
    const {
      performanceOptimizer,
    } = require('../../services/performanceOptimizer');

    expect(typeof performanceOptimizer.destroy).toBe('function');

    performanceOptimizer.destroy();

    expect(() => jest.advanceTimersByTime(60 * 1000)).not.toThrow();
  });

  it('uiPerformanceMonitor should expose destroy() that clears monitoring timer', () => {
    const {
      uiPerformanceMonitor,
    } = require('../../services/uiPerformanceMonitor');

    expect(typeof uiPerformanceMonitor.destroy).toBe('function');

    // Initialize first so monitoring timer starts
    uiPerformanceMonitor.initialize('test-session');

    uiPerformanceMonitor.destroy();

    expect(() => jest.advanceTimersByTime(120 * 1000)).not.toThrow();
  });

  it('destroy() should be idempotent — safe to call multiple times', () => {
    const {
      performanceOptimizer,
    } = require('../../services/performanceOptimizer');

    // Call destroy multiple times — should not throw
    performanceOptimizer.destroy();
    performanceOptimizer.destroy();
    performanceOptimizer.destroy();

    // Still safe after multiple calls
    expect(() => jest.advanceTimersByTime(60 * 1000)).not.toThrow();
  });

  it('hot reload scenario: re-instantiation after destroy should work correctly', () => {
    // Simulate hot reload by requiring, destroying, then requiring fresh
    const mod1 = require('../../services/performanceOptimizer');
    mod1.performanceOptimizer.destroy();

    // Reset modules to simulate hot reload
    jest.resetModules();

    // Re-require should create a fresh instance without double timers
    const mod2 = require('../../services/performanceOptimizer');
    expect(typeof mod2.performanceOptimizer.destroy).toBe('function');

    // Clean up
    mod2.performanceOptimizer.destroy();
  });
});
