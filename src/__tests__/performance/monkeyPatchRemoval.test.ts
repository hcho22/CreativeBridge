/**
 * Monkey-Patch Removal Validation Tests
 *
 * Validates that global.requestAnimationFrame and global.fetch are NOT
 * monkey-patched by importing performance services. (Finding P-3.1)
 */

import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';

// Capture the original globals BEFORE any imports
const originalRAF = global.requestAnimationFrame;
const originalFetch = global.fetch;

describe('Monkey-Patch Removal (P-3.1)', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('should not wrap global.requestAnimationFrame after importing performanceOptimizer', () => {
    // Store reference before import
    const rafBefore = global.requestAnimationFrame;

    // Dynamic import to trigger module initialization
    require('../../services/performanceOptimizer');

    // Verify global was not replaced
    expect(global.requestAnimationFrame).toBe(rafBefore);
  });

  it('should not wrap global.fetch after importing performanceOptimizer', () => {
    const fetchBefore = global.fetch;

    require('../../services/performanceOptimizer');

    expect(global.fetch).toBe(fetchBefore);
  });

  it('should provide explicit measureRenderTime() method instead of wrapping RAF', () => {
    const {
      performanceOptimizer,
    } = require('../../services/performanceOptimizer');

    expect(typeof performanceOptimizer.measureRenderTime).toBe('function');

    // Should accept a render time value without side effects on globals
    performanceOptimizer.measureRenderTime(8);
    const metrics = performanceOptimizer.getMetrics();
    expect(metrics.renderTime).toBe(8);
  });

  it('should provide explicit recordApiResponseTime() method instead of wrapping fetch', () => {
    const {
      performanceOptimizer,
    } = require('../../services/performanceOptimizer');

    expect(typeof performanceOptimizer.recordApiResponseTime).toBe('function');

    performanceOptimizer.recordApiResponseTime(150);
    const metrics = performanceOptimizer.getMetrics();
    expect(metrics.apiResponseTime).toBe(150);
  });

  it('should add less than 1ms overhead when recording metrics explicitly', () => {
    const {
      performanceOptimizer,
    } = require('../../services/performanceOptimizer');

    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      performanceOptimizer.measureRenderTime(16);
      performanceOptimizer.recordApiResponseTime(100);
    }
    const elapsed = performance.now() - start;

    // 1000 iterations of both calls should complete in < 1000ms (< 1ms per iteration)
    expect(elapsed / 1000).toBeLessThan(1);
  });
});
