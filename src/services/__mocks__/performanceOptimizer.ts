// Manual mock for performanceOptimizer (jest.mock('../../services/performanceOptimizer')
// auto-loads this when no factory is supplied). The real service runs a sampling loop
// against native APIs; for tests we just need stable, valid return values so consumers
// like `resourceManager.ts` that read `getPerformanceLevel()` at module-init can resolve
// `DEVICE_TIER_STRATEGIES[level]` to a real strategy object.
const noop = () => {};
const off = () => noop;

export const performanceOptimizer = {
  measureRenderTime: jest.fn(),
  recordApiResponseTime: jest.fn(),
  queueRenderOperation: jest.fn(),
  registerBackgroundTask: jest.fn(),
  getOptimizedImageProps: jest.fn(() => ({})),
  getOptimizedTextProps: jest.fn(() => ({})),
  addMemoryWarningListener: jest.fn(off),
  getPerformanceLevel: jest.fn(() => 'medium' as const),
  getOptimizationSettings: jest.fn(() => ({})),
  getMetrics: jest.fn(() => ({})),
  isBatteryOptimized: jest.fn(() => false),
  shouldPrefetch: jest.fn(() => true),
  getMaxConcurrentRequests: jest.fn(() => 4),
  shouldUseAnimations: jest.fn(() => true),
  forceBatteryOptimization: jest.fn(),
  enableResourceManagerIntegration: jest.fn(),
  updateSettings: jest.fn(),
  isResourceManagerIntegrated: jest.fn(() => false),
  getCurrentMemoryEstimate: jest.fn(() => 0),
  triggerMemoryCleanup: jest.fn(),
  resetOptimizations: jest.fn(),
  destroy: jest.fn(),
};

export default class PerformanceOptimizerService {
  measureRenderTime = performanceOptimizer.measureRenderTime;
  getPerformanceLevel = performanceOptimizer.getPerformanceLevel;
  destroy = performanceOptimizer.destroy;
}
