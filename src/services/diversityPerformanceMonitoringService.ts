/**
 * Diversity Performance Monitoring Service
 *
 * Tracks and logs performance metrics for the story diversity system,
 * enabling monitoring of timing, cache efficiency, and diversity scores.
 *
 * Part of the Story Diversity Tracking System (US-014)
 */

/**
 * Performance timing for a specific operation
 */
export interface PerformanceTiming {
  operation: string;
  durationMs: number;
  sessionId?: string;
  storyId?: string;
  metadata?: Record<string, any>;
}

/**
 * Diversity metrics for a completed story
 */
export interface DiversityMetrics {
  sessionId: string;
  storyId: string;
  diversityScore: number;
  novelElementCount: number;
  totalElementCount: number;
  avoidedElementsCount: number;
  timestamp: Date;
}

/**
 * Cache performance metrics
 */
export interface CacheMetrics {
  sessionId: string;
  operation: string;
  cacheHit: boolean;
  timestamp: Date;
}

/**
 * Aggregated performance statistics
 */
export interface PerformanceStats {
  totalOperations: number;
  averageDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  slowOperations: number; // Count of operations exceeding threshold
  operations: {
    [operationName: string]: {
      count: number;
      avgDurationMs: number;
      maxDurationMs: number;
    };
  };
}

/**
 * Cache statistics
 */
export interface CacheStats {
  totalQueries: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number; // Percentage (0-100)
}

/**
 * Diversity Performance Monitoring Service
 *
 * Provides comprehensive monitoring and logging for the diversity tracking system.
 * Tracks timing, cache efficiency, and diversity scores for analytics and debugging.
 */
class DiversityPerformanceMonitoringService {
  // In-memory storage for performance metrics (last 1000 entries)
  private timings: PerformanceTiming[] = [];
  private diversityMetrics: DiversityMetrics[] = [];
  private cacheMetrics: CacheMetrics[] = [];

  // Thresholds for performance warnings
  private static readonly LATENCY_WARNING_MS = 200; // Target: diversity guidance < 200ms
  private static readonly EXTRACTION_WARNING_MS = 5000; // Element extraction should be < 5s
  private static readonly EMBEDDING_WARNING_MS = 3000; // Embedding generation should be < 3s
  private static readonly SIMILARITY_WARNING_MS = 100; // Similarity checks should be < 100ms
  private static readonly MAX_STORED_ENTRIES = 1000; // Limit memory usage

  /**
   * Log timing for an operation with optional metadata
   */
  logTiming(options: {
    operation: string;
    durationMs: number;
    sessionId?: string;
    storyId?: string;
    metadata?: Record<string, any>;
  }): void {
    const timing: PerformanceTiming = {
      operation: options.operation,
      durationMs: options.durationMs,
      sessionId: options.sessionId,
      storyId: options.storyId,
      metadata: options.metadata,
    };

    // Store in memory
    this.timings.push(timing);
    this.enforceStorageLimit(this.timings);

    // Log to console with context
    const context = this.buildContext(options.sessionId, options.storyId);
    const warningThreshold = this.getWarningThreshold(options.operation);

    if (warningThreshold && options.durationMs > warningThreshold) {
      console.warn(
        `⚠️  SLOW OPERATION - ${
          options.operation
        }: ${options.durationMs.toFixed(
          2,
        )}ms (threshold: ${warningThreshold}ms)${context}`,
        options.metadata || '',
      );
    } else {
      console.log(
        `⏱️  ${options.operation}: ${options.durationMs.toFixed(
          2,
        )}ms${context}`,
        options.metadata || '',
      );
    }
  }

  /**
   * Log diversity metrics for a completed story
   */
  logDiversityMetrics(metrics: DiversityMetrics): void {
    // Store in memory
    this.diversityMetrics.push(metrics);
    this.enforceStorageLimit(this.diversityMetrics);

    // Log to console
    const context = this.buildContext(metrics.sessionId, metrics.storyId);
    console.log(
      `📊 DIVERSITY METRICS${context}`,
      `\n  Score: ${metrics.diversityScore.toFixed(3)}`,
      `\n  Novel Elements: ${metrics.novelElementCount}/${metrics.totalElementCount}`,
      `\n  Avoided Elements: ${metrics.avoidedElementsCount}`,
    );

    // Log warning if diversity is low
    if (metrics.diversityScore < 0.4) {
      console.warn(
        `⚠️  LOW DIVERSITY DETECTED${context}`,
        `Score: ${metrics.diversityScore.toFixed(3)} (threshold: 0.4)`,
      );
    }
  }

  /**
   * Log cache hit/miss for recent elements queries
   */
  logCacheMetrics(options: {
    sessionId: string;
    operation: string;
    cacheHit: boolean;
  }): void {
    const metric: CacheMetrics = {
      sessionId: options.sessionId,
      operation: options.operation,
      cacheHit: options.cacheHit,
      timestamp: new Date(),
    };

    // Store in memory
    this.cacheMetrics.push(metric);
    this.enforceStorageLimit(this.cacheMetrics);

    // Log to console
    const hitMiss = options.cacheHit ? '✅ HIT' : '❌ MISS';
    const context = this.buildContext(options.sessionId);
    console.log(`💾 CACHE ${hitMiss} - ${options.operation}${context}`);
  }

  /**
   * Measure and log timing for an async operation
   */
  async measureAsync<T>(options: {
    operation: string;
    sessionId?: string;
    storyId?: string;
    metadata?: Record<string, any>;
    fn: () => Promise<T>;
  }): Promise<T> {
    const startTime = performance.now();

    try {
      const result = await options.fn();
      const durationMs = performance.now() - startTime;

      this.logTiming({
        operation: options.operation,
        durationMs,
        sessionId: options.sessionId,
        storyId: options.storyId,
        metadata: options.metadata,
      });

      return result;
    } catch (error) {
      const durationMs = performance.now() - startTime;

      this.logTiming({
        operation: `${options.operation} (ERROR)`,
        durationMs,
        sessionId: options.sessionId,
        storyId: options.storyId,
        metadata: {
          ...options.metadata,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      throw error;
    }
  }

  /**
   * Measure and log timing for a synchronous operation
   */
  measure<T>(options: {
    operation: string;
    sessionId?: string;
    storyId?: string;
    metadata?: Record<string, any>;
    fn: () => T;
  }): T {
    const startTime = performance.now();

    try {
      const result = options.fn();
      const durationMs = performance.now() - startTime;

      this.logTiming({
        operation: options.operation,
        durationMs,
        sessionId: options.sessionId,
        storyId: options.storyId,
        metadata: options.metadata,
      });

      return result;
    } catch (error) {
      const durationMs = performance.now() - startTime;

      this.logTiming({
        operation: `${options.operation} (ERROR)`,
        durationMs,
        sessionId: options.sessionId,
        storyId: options.storyId,
        metadata: {
          ...options.metadata,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      throw error;
    }
  }

  /**
   * Get aggregated performance statistics
   */
  getPerformanceStats(options?: {
    operationFilter?: string;
  }): PerformanceStats {
    const filteredTimings = options?.operationFilter
      ? this.timings.filter(t => t.operation.includes(options.operationFilter!))
      : this.timings;

    if (filteredTimings.length === 0) {
      return {
        totalOperations: 0,
        averageDurationMs: 0,
        minDurationMs: 0,
        maxDurationMs: 0,
        slowOperations: 0,
        operations: {},
      };
    }

    const durations = filteredTimings.map(t => t.durationMs);
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);

    // Group by operation type
    const operationGroups: Record<
      string,
      { count: number; totalDuration: number; maxDuration: number }
    > = {};

    filteredTimings.forEach(timing => {
      if (!operationGroups[timing.operation]) {
        operationGroups[timing.operation] = {
          count: 0,
          totalDuration: 0,
          maxDuration: 0,
        };
      }

      const group = operationGroups[timing.operation];
      group.count++;
      group.totalDuration += timing.durationMs;
      group.maxDuration = Math.max(group.maxDuration, timing.durationMs);
    });

    // Count slow operations
    const slowOperations = filteredTimings.filter(t => {
      const threshold = this.getWarningThreshold(t.operation);
      return threshold && t.durationMs > threshold;
    }).length;

    return {
      totalOperations: filteredTimings.length,
      averageDurationMs: totalDuration / filteredTimings.length,
      minDurationMs: Math.min(...durations),
      maxDurationMs: Math.max(...durations),
      slowOperations,
      operations: Object.entries(operationGroups).reduce(
        (acc, [operation, stats]) => {
          acc[operation] = {
            count: stats.count,
            avgDurationMs: stats.totalDuration / stats.count,
            maxDurationMs: stats.maxDuration,
          };
          return acc;
        },
        {} as Record<
          string,
          { count: number; avgDurationMs: number; maxDurationMs: number }
        >,
      ),
    };
  }

  /**
   * Get cache hit/miss statistics
   */
  getCacheStats(options?: { operationFilter?: string }): CacheStats {
    const filteredMetrics = options?.operationFilter
      ? this.cacheMetrics.filter(m =>
          m.operation.includes(options.operationFilter!),
        )
      : this.cacheMetrics;

    const totalQueries = filteredMetrics.length;
    const cacheHits = filteredMetrics.filter(m => m.cacheHit).length;
    const cacheMisses = totalQueries - cacheHits;
    const hitRate = totalQueries > 0 ? (cacheHits / totalQueries) * 100 : 0;

    return {
      totalQueries,
      cacheHits,
      cacheMisses,
      hitRate,
    };
  }

  /**
   * Get diversity metrics for a specific session
   */
  getSessionDiversityMetrics(sessionId: string): DiversityMetrics[] {
    return this.diversityMetrics.filter(m => m.sessionId === sessionId);
  }

  /**
   * Get average diversity score across all tracked stories
   */
  getAverageDiversityScore(): number {
    if (this.diversityMetrics.length === 0) {
      return 0;
    }

    const totalScore = this.diversityMetrics.reduce(
      (sum, m) => sum + m.diversityScore,
      0,
    );
    return totalScore / this.diversityMetrics.length;
  }

  /**
   * Clear all stored metrics (useful for testing)
   */
  clearMetrics(): void {
    this.timings = [];
    this.diversityMetrics = [];
    this.cacheMetrics = [];
  }

  /**
   * Get warning threshold for a specific operation
   */
  private getWarningThreshold(operation: string): number | null {
    if (
      operation.includes('diversity_guidance') ||
      operation.includes('getDiversityGuidance')
    ) {
      return DiversityPerformanceMonitoringService.LATENCY_WARNING_MS;
    }
    if (
      operation.includes('element_extraction') ||
      operation.includes('extractStoryElements')
    ) {
      return DiversityPerformanceMonitoringService.EXTRACTION_WARNING_MS;
    }
    if (
      operation.includes('embedding_generation') ||
      operation.includes('generateEmbedding')
    ) {
      return DiversityPerformanceMonitoringService.EMBEDDING_WARNING_MS;
    }
    if (
      operation.includes('similarity') ||
      operation.includes('findSimilarElements')
    ) {
      return DiversityPerformanceMonitoringService.SIMILARITY_WARNING_MS;
    }
    return null;
  }

  /**
   * Build context string for logging
   */
  private buildContext(sessionId?: string, storyId?: string): string {
    const parts: string[] = [];

    if (sessionId) {
      parts.push(`Session: ${sessionId.substring(0, 12)}...`);
    }

    if (storyId) {
      parts.push(`Story: ${storyId.substring(0, 12)}...`);
    }

    return parts.length > 0 ? ` [${parts.join(', ')}]` : '';
  }

  /**
   * Enforce storage limit to prevent memory issues
   */
  private enforceStorageLimit<T>(array: T[]): void {
    while (
      array.length > DiversityPerformanceMonitoringService.MAX_STORED_ENTRIES
    ) {
      array.shift(); // Remove oldest entry
    }
  }
}

// Export singleton instance
export const diversityPerformanceMonitoringService =
  new DiversityPerformanceMonitoringService();
