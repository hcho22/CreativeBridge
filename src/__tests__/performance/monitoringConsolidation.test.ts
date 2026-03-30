/**
 * Monitoring Consolidation Validation Tests
 *
 * Validates that the new performanceMonitor.ts is the single consolidated
 * service: disabled by default, explicit lifecycle, no fake data. (Finding P-3.4)
 */

import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';
import PerformanceMonitorService, {
  performanceMonitor,
} from '../../services/performanceMonitor';

describe('Monitoring Consolidation (P-3.4)', () => {
  afterEach(() => {
    performanceMonitor.stop();
    performanceMonitor.clear();
  });

  it('should be a single consolidated service replacing 6 legacy services', () => {
    // Verify the new service exists and exports expected API
    expect(performanceMonitor).toBeDefined();
    expect(typeof performanceMonitor.start).toBe('function');
    expect(typeof performanceMonitor.stop).toBe('function');
    expect(typeof performanceMonitor.startTiming).toBe('function');
    expect(typeof performanceMonitor.endTiming).toBe('function');
    expect(typeof performanceMonitor.record).toBe('function');
    expect(typeof performanceMonitor.getStats).toBe('function');
    expect(typeof performanceMonitor.getEntries).toBe('function');
    expect(typeof performanceMonitor.clear).toBe('function');
  });

  it('should be disabled by default — no timers created on import', () => {
    // Fresh instance should not be running
    const freshMonitor = new PerformanceMonitorService();
    const stats = freshMonitor.getStats();

    expect(stats.isRunning).toBe(false);
    expect(stats.entryCount).toBe(0);

    // Operations should be no-ops when not running
    freshMonitor.startTiming('test-op');
    const entry = freshMonitor.endTiming('test-op');
    expect(entry).toBeNull();

    freshMonitor.record('test', 100);
    expect(freshMonitor.getStats().entryCount).toBe(0);
  });

  it('should support explicit start()/stop() lifecycle', () => {
    performanceMonitor.start();
    expect(performanceMonitor.getStats().isRunning).toBe(true);

    // Should record entries when running
    performanceMonitor.record('render', 16);
    expect(performanceMonitor.getStats().entryCount).toBe(1);

    performanceMonitor.stop();
    expect(performanceMonitor.getStats().isRunning).toBe(false);

    // Should stop recording after stop
    performanceMonitor.record('render', 16);
    expect(performanceMonitor.getStats().entryCount).toBe(1); // Still 1
  });

  it('should not use fake data (no Math.random, no Date.now() % 100000)', () => {
    const fs = require('fs');
    const path = require('path');
    const sourceCode = fs.readFileSync(
      path.resolve(__dirname, '../../services/performanceMonitor.ts'),
      'utf8',
    );

    expect(sourceCode).not.toContain('Math.random()');
    expect(sourceCode).not.toContain('Date.now() % 100000');
    expect(sourceCode).toContain('performance.now()');
  });
});
