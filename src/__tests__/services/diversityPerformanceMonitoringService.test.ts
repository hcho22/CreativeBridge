/**
 * Tests for Diversity Performance Monitoring Service
 *
 * Part of the Story Diversity Tracking System (US-014)
 */

import { diversityPerformanceMonitoringService } from '../../services/diversityPerformanceMonitoringService';

describe('DiversityPerformanceMonitoringService', () => {
  beforeEach(() => {
    // Clear metrics before each test
    diversityPerformanceMonitoringService.clearMetrics();
    jest.clearAllMocks();
  });

  describe('logTiming', () => {
    it('should log timing for an operation', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      diversityPerformanceMonitoringService.logTiming({
        operation: 'test_operation',
        durationMs: 100,
        sessionId: 'session-123',
        storyId: 'story-456',
      });

      expect(consoleSpy).toHaveBeenCalled();
      const logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).toContain('test_operation');
      expect(logCall).toContain('100');

      consoleSpy.mockRestore();
    });

    it('should warn on slow operations exceeding thresholds', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Diversity guidance should warn if > 200ms
      diversityPerformanceMonitoringService.logTiming({
        operation: 'diversity_guidance',
        durationMs: 300,
        sessionId: 'session-123',
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('SLOW OPERATION'),
        expect.anything(),
      );

      consoleWarnSpy.mockRestore();
    });

    it('should include session_id and story_id in context', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      diversityPerformanceMonitoringService.logTiming({
        operation: 'test_operation',
        durationMs: 50,
        sessionId: 'session-abc123',
        storyId: 'story-xyz789',
      });

      const logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).toContain('Session: session-abc1');
      expect(logCall).toContain('Story: story-xyz78');

      consoleSpy.mockRestore();
    });

    it('should include metadata in logs', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      diversityPerformanceMonitoringService.logTiming({
        operation: 'test_operation',
        durationMs: 75,
        metadata: { elementCount: 5, storyLength: 1000 },
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ elementCount: 5, storyLength: 1000 }),
      );

      consoleSpy.mockRestore();
    });
  });

  describe('logDiversityMetrics', () => {
    it('should log diversity metrics for a completed story', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      diversityPerformanceMonitoringService.logDiversityMetrics({
        sessionId: 'session-123',
        storyId: 'story-456',
        diversityScore: 0.75,
        novelElementCount: 6,
        totalElementCount: 8,
        avoidedElementsCount: 3,
        timestamp: new Date(),
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('DIVERSITY METRICS'),
        expect.stringContaining('0.750'),
        expect.stringContaining('6/8'),
        expect.stringContaining('3'),
      );

      consoleSpy.mockRestore();
    });

    it('should warn on low diversity scores', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      diversityPerformanceMonitoringService.logDiversityMetrics({
        sessionId: 'session-123',
        storyId: 'story-456',
        diversityScore: 0.35, // Below 0.4 threshold
        novelElementCount: 2,
        totalElementCount: 10,
        avoidedElementsCount: 5,
        timestamp: new Date(),
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('LOW DIVERSITY DETECTED'),
        expect.stringContaining('0.350'),
      );

      consoleWarnSpy.mockRestore();
    });

    it('should not warn on moderate/high diversity scores', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      diversityPerformanceMonitoringService.logDiversityMetrics({
        sessionId: 'session-123',
        storyId: 'story-456',
        diversityScore: 0.65,
        novelElementCount: 6,
        totalElementCount: 8,
        avoidedElementsCount: 2,
        timestamp: new Date(),
      });

      expect(consoleWarnSpy).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });
  });

  describe('logCacheMetrics', () => {
    it('should log cache hit', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      diversityPerformanceMonitoringService.logCacheMetrics({
        sessionId: 'session-123',
        operation: 'getRecentElements',
        cacheHit: true,
      });

      expect(consoleSpy).toHaveBeenCalled();
      const logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).toContain('CACHE');
      expect(logCall).toContain('HIT');

      consoleSpy.mockRestore();
    });

    it('should log cache miss', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      diversityPerformanceMonitoringService.logCacheMetrics({
        sessionId: 'session-123',
        operation: 'getRecentElements',
        cacheHit: false,
      });

      expect(consoleSpy).toHaveBeenCalled();
      const logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).toContain('CACHE');
      expect(logCall).toContain('MISS');

      consoleSpy.mockRestore();
    });
  });

  describe('measureAsync', () => {
    it('should measure async operation timing', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await diversityPerformanceMonitoringService.measureAsync({
        operation: 'async_test',
        sessionId: 'session-123',
        fn: async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return 'test_result';
        },
      });

      expect(result).toBe('test_result');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('async_test'),
        expect.anything(),
      );

      consoleSpy.mockRestore();
    });

    it('should log error timing and rethrow errors', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await expect(
        diversityPerformanceMonitoringService.measureAsync({
          operation: 'failing_operation',
          fn: async () => {
            throw new Error('Test error');
          },
        }),
      ).rejects.toThrow('Test error');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('failing_operation (ERROR)'),
        expect.anything(),
      );

      consoleSpy.mockRestore();
    });

    it('should include error details in metadata', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await expect(
        diversityPerformanceMonitoringService.measureAsync({
          operation: 'error_test',
          fn: async () => {
            throw new Error('Specific error message');
          },
        }),
      ).rejects.toThrow();

      const logCall = consoleSpy.mock.calls[0];
      expect(logCall[1]).toMatchObject({
        error: 'Specific error message',
      });

      consoleSpy.mockRestore();
    });
  });

  describe('measure', () => {
    it('should measure synchronous operation timing', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = diversityPerformanceMonitoringService.measure({
        operation: 'sync_test',
        sessionId: 'session-123',
        fn: () => {
          return 42;
        },
      });

      expect(result).toBe(42);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('sync_test'),
        expect.anything(),
      );

      consoleSpy.mockRestore();
    });

    it('should log error timing and rethrow errors', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      expect(() =>
        diversityPerformanceMonitoringService.measure({
          operation: 'sync_failing',
          fn: () => {
            throw new Error('Sync error');
          },
        }),
      ).toThrow('Sync error');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('sync_failing (ERROR)'),
        expect.anything(),
      );

      consoleSpy.mockRestore();
    });
  });

  describe('getPerformanceStats', () => {
    it('should return empty stats when no operations logged', () => {
      const stats = diversityPerformanceMonitoringService.getPerformanceStats();

      expect(stats).toEqual({
        totalOperations: 0,
        averageDurationMs: 0,
        minDurationMs: 0,
        maxDurationMs: 0,
        slowOperations: 0,
        operations: {},
      });
    });

    it('should calculate aggregate statistics correctly', () => {
      // Log multiple operations
      diversityPerformanceMonitoringService.logTiming({
        operation: 'op_a',
        durationMs: 100,
      });
      diversityPerformanceMonitoringService.logTiming({
        operation: 'op_b',
        durationMs: 200,
      });
      diversityPerformanceMonitoringService.logTiming({
        operation: 'op_a',
        durationMs: 150,
      });

      const stats = diversityPerformanceMonitoringService.getPerformanceStats();

      expect(stats.totalOperations).toBe(3);
      expect(stats.averageDurationMs).toBeCloseTo(150, 1);
      expect(stats.minDurationMs).toBe(100);
      expect(stats.maxDurationMs).toBe(200);
      expect(stats.operations.op_a).toEqual({
        count: 2,
        avgDurationMs: 125,
        maxDurationMs: 150,
      });
      expect(stats.operations.op_b).toEqual({
        count: 1,
        avgDurationMs: 200,
        maxDurationMs: 200,
      });
    });

    it('should count slow operations correctly', () => {
      // Log slow diversity_guidance operation (threshold: 200ms)
      diversityPerformanceMonitoringService.logTiming({
        operation: 'diversity_guidance',
        durationMs: 300, // Slow
      });
      diversityPerformanceMonitoringService.logTiming({
        operation: 'diversity_guidance',
        durationMs: 100, // Fast
      });

      const stats = diversityPerformanceMonitoringService.getPerformanceStats();

      expect(stats.slowOperations).toBe(1);
    });

    it('should filter by operation name', () => {
      diversityPerformanceMonitoringService.logTiming({
        operation: 'element_extraction',
        durationMs: 1000,
      });
      diversityPerformanceMonitoringService.logTiming({
        operation: 'embedding_generation',
        durationMs: 500,
      });

      const stats = diversityPerformanceMonitoringService.getPerformanceStats({
        operationFilter: 'element',
      });

      expect(stats.totalOperations).toBe(1);
      expect(stats.operations.element_extraction).toBeDefined();
      expect(stats.operations.embedding_generation).toBeUndefined();
    });
  });

  describe('getCacheStats', () => {
    it('should return empty stats when no cache queries logged', () => {
      const stats = diversityPerformanceMonitoringService.getCacheStats();

      expect(stats).toEqual({
        totalQueries: 0,
        cacheHits: 0,
        cacheMisses: 0,
        hitRate: 0,
      });
    });

    it('should calculate cache hit rate correctly', () => {
      // Log cache hits and misses
      diversityPerformanceMonitoringService.logCacheMetrics({
        sessionId: 'session-1',
        operation: 'getRecentElements',
        cacheHit: true,
      });
      diversityPerformanceMonitoringService.logCacheMetrics({
        sessionId: 'session-2',
        operation: 'getRecentElements',
        cacheHit: false,
      });
      diversityPerformanceMonitoringService.logCacheMetrics({
        sessionId: 'session-1',
        operation: 'getRecentElements',
        cacheHit: true,
      });
      diversityPerformanceMonitoringService.logCacheMetrics({
        sessionId: 'session-3',
        operation: 'getRecentElements',
        cacheHit: true,
      });

      const stats = diversityPerformanceMonitoringService.getCacheStats();

      expect(stats.totalQueries).toBe(4);
      expect(stats.cacheHits).toBe(3);
      expect(stats.cacheMisses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(75, 1); // 75% hit rate
    });

    it('should filter cache stats by operation', () => {
      diversityPerformanceMonitoringService.logCacheMetrics({
        sessionId: 'session-1',
        operation: 'getRecentElements',
        cacheHit: true,
      });
      diversityPerformanceMonitoringService.logCacheMetrics({
        sessionId: 'session-2',
        operation: 'other_operation',
        cacheHit: false,
      });

      const stats = diversityPerformanceMonitoringService.getCacheStats({
        operationFilter: 'getRecent',
      });

      expect(stats.totalQueries).toBe(1);
      expect(stats.cacheHits).toBe(1);
    });
  });

  describe('getSessionDiversityMetrics', () => {
    it('should return metrics for specific session', () => {
      const timestamp = new Date();

      diversityPerformanceMonitoringService.logDiversityMetrics({
        sessionId: 'session-1',
        storyId: 'story-1',
        diversityScore: 0.8,
        novelElementCount: 7,
        totalElementCount: 10,
        avoidedElementsCount: 2,
        timestamp,
      });
      diversityPerformanceMonitoringService.logDiversityMetrics({
        sessionId: 'session-2',
        storyId: 'story-2',
        diversityScore: 0.6,
        novelElementCount: 5,
        totalElementCount: 10,
        avoidedElementsCount: 1,
        timestamp,
      });

      const metrics =
        diversityPerformanceMonitoringService.getSessionDiversityMetrics(
          'session-1',
        );

      expect(metrics).toHaveLength(1);
      expect(metrics[0].sessionId).toBe('session-1');
      expect(metrics[0].diversityScore).toBe(0.8);
    });

    it('should return empty array for session with no metrics', () => {
      const metrics =
        diversityPerformanceMonitoringService.getSessionDiversityMetrics(
          'nonexistent-session',
        );

      expect(metrics).toEqual([]);
    });
  });

  describe('getAverageDiversityScore', () => {
    it('should return 0 when no metrics logged', () => {
      const avgScore =
        diversityPerformanceMonitoringService.getAverageDiversityScore();

      expect(avgScore).toBe(0);
    });

    it('should calculate average diversity score across all stories', () => {
      const timestamp = new Date();

      diversityPerformanceMonitoringService.logDiversityMetrics({
        sessionId: 'session-1',
        storyId: 'story-1',
        diversityScore: 0.8,
        novelElementCount: 7,
        totalElementCount: 10,
        avoidedElementsCount: 2,
        timestamp,
      });
      diversityPerformanceMonitoringService.logDiversityMetrics({
        sessionId: 'session-1',
        storyId: 'story-2',
        diversityScore: 0.6,
        novelElementCount: 5,
        totalElementCount: 10,
        avoidedElementsCount: 1,
        timestamp,
      });
      diversityPerformanceMonitoringService.logDiversityMetrics({
        sessionId: 'session-2',
        storyId: 'story-3',
        diversityScore: 0.7,
        novelElementCount: 6,
        totalElementCount: 10,
        avoidedElementsCount: 1,
        timestamp,
      });

      const avgScore =
        diversityPerformanceMonitoringService.getAverageDiversityScore();

      expect(avgScore).toBeCloseTo(0.7, 2); // (0.8 + 0.6 + 0.7) / 3 = 0.7
    });
  });

  describe('clearMetrics', () => {
    it('should clear all stored metrics', () => {
      // Log various metrics
      diversityPerformanceMonitoringService.logTiming({
        operation: 'test',
        durationMs: 100,
      });
      diversityPerformanceMonitoringService.logDiversityMetrics({
        sessionId: 'session-1',
        storyId: 'story-1',
        diversityScore: 0.8,
        novelElementCount: 7,
        totalElementCount: 10,
        avoidedElementsCount: 2,
        timestamp: new Date(),
      });
      diversityPerformanceMonitoringService.logCacheMetrics({
        sessionId: 'session-1',
        operation: 'test',
        cacheHit: true,
      });

      // Clear metrics
      diversityPerformanceMonitoringService.clearMetrics();

      // Verify all metrics cleared
      expect(
        diversityPerformanceMonitoringService.getPerformanceStats()
          .totalOperations,
      ).toBe(0);
      expect(
        diversityPerformanceMonitoringService.getCacheStats().totalQueries,
      ).toBe(0);
      expect(
        diversityPerformanceMonitoringService.getAverageDiversityScore(),
      ).toBe(0);
    });
  });

  describe('Storage limit enforcement', () => {
    it('should limit stored entries to prevent memory issues', () => {
      // Log 1100 timing entries (exceeds 1000 limit)
      for (let i = 0; i < 1100; i++) {
        diversityPerformanceMonitoringService.logTiming({
          operation: `operation_${i}`,
          durationMs: i,
        });
      }

      const stats = diversityPerformanceMonitoringService.getPerformanceStats();

      // Should have exactly 1000 entries (oldest 100 evicted)
      expect(stats.totalOperations).toBe(1000);
    });
  });

  describe('Warning thresholds', () => {
    it('should warn for slow diversity_guidance (> 200ms)', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      diversityPerformanceMonitoringService.logTiming({
        operation: 'diversity_guidance',
        durationMs: 250,
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('SLOW OPERATION'),
        expect.anything(),
      );

      consoleWarnSpy.mockRestore();
    });

    it('should warn for slow element_extraction (> 5000ms)', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      diversityPerformanceMonitoringService.logTiming({
        operation: 'element_extraction',
        durationMs: 6000,
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('SLOW OPERATION'),
        expect.anything(),
      );

      consoleWarnSpy.mockRestore();
    });

    it('should warn for slow embedding_generation (> 3000ms)', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      diversityPerformanceMonitoringService.logTiming({
        operation: 'embedding_generation',
        durationMs: 3500,
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('SLOW OPERATION'),
        expect.anything(),
      );

      consoleWarnSpy.mockRestore();
    });

    it('should warn for slow similarity operations (> 100ms)', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      diversityPerformanceMonitoringService.logTiming({
        operation: 'findSimilarElements',
        durationMs: 150,
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('SLOW OPERATION'),
        expect.anything(),
      );

      consoleWarnSpy.mockRestore();
    });
  });
});
