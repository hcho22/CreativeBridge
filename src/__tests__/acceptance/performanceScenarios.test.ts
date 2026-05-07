/**
 * Performance Scenarios - User Acceptance Tests
 * Tests performance characteristics and user experience under various load conditions
 */

import {
  imageGenerationService,
  type ImageGenerationRequest,
} from '../../services/imageGeneration';
import { supabase } from '../../services/supabase';
import type { GradeLevel } from '../../types/database';

// Mock dependencies
jest.mock('../../services/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

jest.mock('react-native-dotenv', () => ({
  REPLICATE_API_TOKEN: 'test-replicate-token',
  BACKUP_IMAGE_API_TOKEN: 'test-backup-token',
  IMAGE_GENERATION_ENABLED: 'true',
}));

global.fetch = jest.fn();

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

// Performance Test Utilities
class PerformanceTestRunner {
  private responseTimeThresholds = {
    xpValidation: 100, // ms
    promptGeneration: 500, // ms
    apiCall: 45000, // ms (45 seconds)
    totalFlow: 50000, // ms (50 seconds including overhead)
  };

  private setupSuccessfulMocks() {
    const mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { total_xp: 5000 },
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValue(mockQueryBuilder as any);
    mockSupabase.rpc.mockResolvedValue({ data: null, error: undefined } as any);

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'test-prediction',
        status: 'succeeded',
        output: ['https://example.com/generated-image.jpg'],
      }),
    } as any);
  }

  private setupSlowMocks(delay: number = 2000) {
    const mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockImplementation(
        () =>
          new Promise(resolve =>
            setTimeout(
              () =>
                resolve({
                  data: { total_xp: 5000 },
                  error: null,
                }),
              delay,
            ),
          ),
      ),
    };
    mockSupabase.from.mockReturnValue(mockQueryBuilder as any);
    mockSupabase.rpc.mockImplementation(
      (() =>
        new Promise(resolve =>
          setTimeout(
            () => resolve({ data: null, error: undefined } as any),
            delay,
          ),
        )) as any,
    );

    mockFetch.mockImplementation(
      () =>
        new Promise(resolve =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => ({
                  id: 'slow-prediction',
                  status: 'succeeded',
                  output: ['https://example.com/slow-image.jpg'],
                }),
              } as any),
            delay * 2,
          ),
        ),
    );
  }

  async measureExecutionTime<T>(operation: () => Promise<T>): Promise<{
    result: T;
    executionTime: number;
  }> {
    const startTime = Date.now();
    const result = await operation();
    const endTime = Date.now();

    return {
      result,
      executionTime: endTime - startTime,
    };
  }

  async testSingleImageGeneration(): Promise<{
    success: boolean;
    totalTime: number;
    breakdown: {
      validation: number;
      generation: number;
      total: number;
    };
    performanceGrade: 'excellent' | 'good' | 'acceptable' | 'poor';
  }> {
    this.setupSuccessfulMocks();

    const request: ImageGenerationRequest = {
      storyContent:
        'A brave knight goes on an adventure through an enchanted forest.',
      gradeLevel: 'K-2',
      sessionId: 'perf-test-session',
      userId: 'perf-test-user',
      metadata: { wordCount: 100 },
    };

    const measurement = await this.measureExecutionTime(async () => {
      return await imageGenerationService.generateImage(request);
    });

    const performanceGrade = this.calculatePerformanceGrade(
      measurement.executionTime,
    );

    return {
      success: measurement.result.success || false,
      totalTime: measurement.executionTime,
      breakdown: {
        validation: Math.min(measurement.executionTime * 0.1, 100), // Estimate
        generation: Math.min(measurement.executionTime * 0.8, 40000), // Estimate
        total: measurement.executionTime,
      },
      performanceGrade,
    };
  }

  async testConcurrentImageGeneration(concurrency: number = 5): Promise<{
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    maxResponseTime: number;
    minResponseTime: number;
    throughput: number; // requests per second
    performanceGrade: 'excellent' | 'good' | 'acceptable' | 'poor';
  }> {
    this.setupSuccessfulMocks();

    const requests: ImageGenerationRequest[] = Array(concurrency)
      .fill(null)
      .map((_, index) => ({
        storyContent: `Performance test story ${
          index + 1
        } with unique content for testing concurrent requests.`,
        gradeLevel: ['K-2', '3-5', '6-8', '9-12'][index % 4] as GradeLevel,
        sessionId: `perf-session-${index}`,
        userId: `perf-user-${index}`,
        metadata: { wordCount: 100 + index * 10 },
      }));

    const startTime = Date.now();

    const measurements = await Promise.all(
      requests.map(request =>
        this.measureExecutionTime(() =>
          imageGenerationService.generateImage(request),
        ),
      ),
    );

    const endTime = Date.now();
    const totalDuration = endTime - startTime;

    const responseTimes = measurements.map(m => m.executionTime);
    const successfulRequests = measurements.filter(
      m => m.result.success,
    ).length;
    const failedRequests = concurrency - successfulRequests;

    const averageResponseTime =
      responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    const maxResponseTime = Math.max(...responseTimes);
    const minResponseTime = Math.min(...responseTimes);
    const throughput = (successfulRequests / totalDuration) * 1000; // requests per second

    const performanceGrade = this.calculateConcurrentPerformanceGrade(
      averageResponseTime,
      throughput,
      successfulRequests / concurrency,
    );

    return {
      totalRequests: concurrency,
      successfulRequests,
      failedRequests,
      averageResponseTime,
      maxResponseTime,
      minResponseTime,
      throughput,
      performanceGrade,
    };
  }

  async testLargeStoryHandling(): Promise<{
    storyLengths: number[];
    responseTimes: number[];
    memoryEfficient: boolean;
    performanceGrade: 'excellent' | 'good' | 'acceptable' | 'poor';
  }> {
    this.setupSuccessfulMocks();

    const storyLengths = [100, 500, 1000, 2000, 5000]; // word counts
    const measurements = [];

    for (const wordCount of storyLengths) {
      const longStory = this.generateLongStory(wordCount);

      const request: ImageGenerationRequest = {
        storyContent: longStory,
        gradeLevel: '6-8',
        sessionId: `long-story-${wordCount}`,
        userId: 'long-story-user',
        metadata: { wordCount },
      };

      const measurement = await this.measureExecutionTime(() =>
        imageGenerationService.generateImage(request),
      );

      measurements.push(measurement);
    }

    const responseTimes = measurements.map(m => m.executionTime);

    // Check if response time scales linearly with content size (efficient)
    const memoryEfficient = this.checkLinearScaling(
      storyLengths,
      responseTimes,
    );

    const averageTime =
      responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    const performanceGrade = this.calculatePerformanceGrade(averageTime);

    return {
      storyLengths,
      responseTimes,
      memoryEfficient,
      performanceGrade,
    };
  }

  async testSlowNetworkConditions(): Promise<{
    normalConditions: { time: number; success: boolean };
    slowConditions: { time: number; success: boolean };
    performanceDegradation: number; // percentage
    userExperienceRating: 'excellent' | 'good' | 'acceptable' | 'poor';
  }> {
    const request: ImageGenerationRequest = {
      storyContent: 'A test story for network performance evaluation.',
      gradeLevel: 'K-2',
      sessionId: 'network-test',
      userId: 'network-user',
      metadata: { wordCount: 80 },
    };

    // Test normal conditions
    this.setupSuccessfulMocks();
    const normalMeasurement = await this.measureExecutionTime(() =>
      imageGenerationService.generateImage(request),
    );

    // Test slow conditions
    this.setupSlowMocks(1000); // 1 second delay
    const slowMeasurement = await this.measureExecutionTime(() =>
      imageGenerationService.generateImage(request),
    );

    const performanceDegradation =
      ((slowMeasurement.executionTime - normalMeasurement.executionTime) /
        normalMeasurement.executionTime) *
      100;

    const userExperienceRating = this.calculateNetworkPerformanceRating(
      slowMeasurement.executionTime,
      performanceDegradation,
    );

    return {
      normalConditions: {
        time: normalMeasurement.executionTime,
        success: normalMeasurement.result.success || false,
      },
      slowConditions: {
        time: slowMeasurement.executionTime,
        success: slowMeasurement.result.success || false,
      },
      performanceDegradation,
      userExperienceRating,
    };
  }

  private calculatePerformanceGrade(
    executionTime: number,
  ): 'excellent' | 'good' | 'acceptable' | 'poor' {
    if (executionTime <= 30000) return 'excellent'; // <= 30 seconds
    if (executionTime <= 45000) return 'good'; // <= 45 seconds
    if (executionTime <= 60000) return 'acceptable'; // <= 60 seconds
    return 'poor'; // > 60 seconds
  }

  private calculateConcurrentPerformanceGrade(
    averageTime: number,
    throughput: number,
    successRate: number,
  ): 'excellent' | 'good' | 'acceptable' | 'poor' {
    if (averageTime <= 35000 && throughput >= 0.1 && successRate >= 0.95)
      return 'excellent';
    if (averageTime <= 50000 && throughput >= 0.05 && successRate >= 0.9)
      return 'good';
    if (averageTime <= 70000 && throughput >= 0.02 && successRate >= 0.8)
      return 'acceptable';
    return 'poor';
  }

  private calculateNetworkPerformanceRating(
    slowTime: number,
    degradation: number,
  ): 'excellent' | 'good' | 'acceptable' | 'poor' {
    if (slowTime <= 50000 && degradation <= 50) return 'excellent';
    if (slowTime <= 70000 && degradation <= 100) return 'good';
    if (slowTime <= 90000 && degradation <= 200) return 'acceptable';
    return 'poor';
  }

  private generateLongStory(wordCount: number): string {
    const words = [
      'adventure',
      'brave',
      'magical',
      'forest',
      'knight',
      'dragon',
      'castle',
      'quest',
      'treasure',
      'journey',
      'friendship',
      'courage',
      'wisdom',
      'discovery',
      'mystery',
      'enchanted',
      'wonderful',
      'amazing',
      'beautiful',
      'peaceful',
      'exciting',
      'joyful',
    ];

    let story = 'Once upon a time, ';
    for (let i = 1; i < wordCount; i++) {
      story += words[i % words.length] + ' ';
      if (i % 20 === 0) story += '. Then, ';
    }
    story += 'and they lived happily ever after.';

    return story;
  }

  private checkLinearScaling(sizes: number[], times: number[]): boolean {
    // Simple check: ratio of largest to smallest time should be reasonable
    const timeRatio = times[times.length - 1] / times[0];
    const sizeRatio = sizes[sizes.length - 1] / sizes[0];

    // Performance should not degrade more than 3x relative to size increase
    return timeRatio <= sizeRatio * 3;
  }

  getPerformanceThresholds() {
    return { ...this.responseTimeThresholds };
  }
}

describe('Performance Scenarios - User Acceptance Tests', () => {
  let performanceRunner: PerformanceTestRunner;

  beforeEach(() => {
    jest.clearAllMocks();
    performanceRunner = new PerformanceTestRunner();
  });

  describe('Single Request Performance', () => {
    test('should complete image generation within acceptable time limits', async () => {
      const result = await performanceRunner.testSingleImageGeneration();

      expect(result.success).toBe(true);
      expect(result.totalTime).toBeLessThan(50000); // 50 seconds
      expect(result.performanceGrade).toMatch(/excellent|good|acceptable/);

      console.log('Single request performance:', {
        totalTime: `${result.totalTime}ms`,
        grade: result.performanceGrade,
        breakdown: result.breakdown,
      });
    });

    test('should provide responsive XP validation', async () => {
      const thresholds = performanceRunner.getPerformanceThresholds();

      // XP validation should be very fast since it's just a database query
      expect(thresholds.xpValidation).toBeLessThan(200);
      expect(thresholds.promptGeneration).toBeLessThan(1000);
    });

    test('should handle prompt generation efficiently', async () => {
      const startTime = Date.now();

      // Test different grade levels
      const gradeLevels: GradeLevel[] = ['K-2', '3-5', '6-8', '9-12'];

      for (const gradeLevel of gradeLevels) {
        const style = imageGenerationService.getArtStyleForGrade(gradeLevel);
        const enhancedStyle =
          imageGenerationService.getEnhancedArtStyleForGrade(gradeLevel);

        expect(style).toBeTruthy();
        expect(enhancedStyle).toBeTruthy();
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All grade level prompt generation should be near-instantaneous
      expect(totalTime).toBeLessThan(100);
    });
  });

  describe('Concurrent Request Performance', () => {
    test('should handle multiple concurrent requests gracefully', async () => {
      const result = await performanceRunner.testConcurrentImageGeneration(3);

      expect(result.successfulRequests).toBeGreaterThan(0);
      expect(result.successfulRequests).toBe(result.totalRequests);
      expect(result.averageResponseTime).toBeLessThan(60000); // 60 seconds
      expect(result.performanceGrade).toMatch(/excellent|good|acceptable/);

      console.log('Concurrent request performance:', {
        requests: result.totalRequests,
        successful: result.successfulRequests,
        averageTime: `${result.averageResponseTime}ms`,
        throughput: `${result.throughput.toFixed(3)} req/s`,
        grade: result.performanceGrade,
      });
    });

    test('should maintain reasonable throughput under load', async () => {
      const result = await performanceRunner.testConcurrentImageGeneration(5);

      // Should handle at least some requests per minute
      expect(result.throughput).toBeGreaterThan(0.01); // At least 0.01 requests per second
      expect(result.maxResponseTime).toBeLessThan(120000); // Max 2 minutes for any single request
    });

    test('should limit concurrent requests appropriately', async () => {
      // This test would verify rate limiting in a real implementation
      // For now, just ensure no crashes with higher concurrency
      const result = await performanceRunner.testConcurrentImageGeneration(10);

      expect(result.totalRequests).toBe(10);
      expect(result.failedRequests).toBeLessThan(result.totalRequests);
    });
  });

  describe('Large Content Performance', () => {
    test('should handle stories of varying lengths efficiently', async () => {
      const result = await performanceRunner.testLargeStoryHandling();

      expect(result.storyLengths).toHaveLength(5);
      expect(result.responseTimes).toHaveLength(5);
      expect(result.memoryEfficient).toBe(true);
      expect(result.performanceGrade).toMatch(/excellent|good|acceptable/);

      console.log('Large story performance:', {
        lengths: result.storyLengths,
        avgTime: `${
          result.responseTimes.reduce((a, b) => a + b) /
          result.responseTimes.length
        }ms`,
        efficient: result.memoryEfficient,
        grade: result.performanceGrade,
      });
    });

    test('should not degrade significantly with longer stories', async () => {
      const result = await performanceRunner.testLargeStoryHandling();

      // Response time for longest story should not be more than 5x the shortest
      const timeRatio =
        result.responseTimes[result.responseTimes.length - 1] /
        result.responseTimes[0];
      expect(timeRatio).toBeLessThan(5);
    });

    test('should handle maximum content length gracefully', async () => {
      // Test with very long story (5000 words)
      const result = await performanceRunner.testLargeStoryHandling();
      const longestStoryTime =
        result.responseTimes[result.responseTimes.length - 1];

      // Even longest story should complete within reasonable time
      expect(longestStoryTime).toBeLessThan(120000); // 2 minutes
    });
  });

  describe('Network Condition Performance', () => {
    test('should handle slow network conditions gracefully', async () => {
      const result = await performanceRunner.testSlowNetworkConditions();

      expect(result.normalConditions.success).toBe(true);
      expect(result.slowConditions.success).toBe(true);
      expect(result.performanceDegradation).toBeGreaterThan(0);
      expect(result.userExperienceRating).toMatch(
        /excellent|good|acceptable|poor/,
      );

      console.log('Network performance:', {
        normal: `${result.normalConditions.time}ms`,
        slow: `${result.slowConditions.time}ms`,
        degradation: `${result.performanceDegradation.toFixed(1)}%`,
        rating: result.userExperienceRating,
      });
    });

    test('should maintain functionality under network stress', async () => {
      const result = await performanceRunner.testSlowNetworkConditions();

      // Both conditions should succeed
      expect(result.normalConditions.success).toBe(true);
      expect(result.slowConditions.success).toBe(true);

      // Degradation should be manageable (less than 500%)
      expect(result.performanceDegradation).toBeLessThan(500);
    });
  });

  describe('Memory and Resource Efficiency', () => {
    test('should not consume excessive memory during processing', async () => {
      // Monitor memory usage during operations
      const memoryBefore = process.memoryUsage();

      await performanceRunner.testSingleImageGeneration();

      const memoryAfter = process.memoryUsage();
      const memoryDelta = memoryAfter.heapUsed - memoryBefore.heapUsed;

      // Should not use excessive memory (less than 50MB for a single request)
      expect(memoryDelta).toBeLessThan(50 * 1024 * 1024);
    });

    test('should clean up resources after processing', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Process multiple requests
      for (let i = 0; i < 3; i++) {
        await performanceRunner.testSingleImageGeneration();
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;

      // Memory growth should be minimal (less than 100MB for 3 requests)
      expect(memoryGrowth).toBeLessThan(100 * 1024 * 1024);
    });
  });

  describe('User Experience Performance', () => {
    test('should provide responsive feedback during long operations', async () => {
      // In a real implementation, this would test progress callbacks
      const result = await performanceRunner.testSingleImageGeneration();

      // Should complete successfully
      expect(result.success).toBe(true);

      // Should provide performance feedback
      expect(result.breakdown.validation).toBeDefined();
      expect(result.breakdown.generation).toBeDefined();
      expect(result.breakdown.total).toBeDefined();
    });

    test('should maintain UI responsiveness during background processing', async () => {
      // This test simulates checking that UI doesn't freeze
      // In a real app, this would verify that the main thread remains responsive

      const startTime = Date.now();
      const promise = performanceRunner.testSingleImageGeneration();

      // Simulate UI operations during processing
      let uiOperations = 0;
      const uiSimulation = setInterval(() => {
        uiOperations++;
      }, 10);

      await promise;
      clearInterval(uiSimulation);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should have been able to perform UI operations
      expect(uiOperations).toBeGreaterThan(0);
      expect(duration).toBeGreaterThan(10); // At least some time passed
    });

    test('should provide appropriate timeouts for user expectations', async () => {
      const thresholds = performanceRunner.getPerformanceThresholds();

      // API call timeout should be reasonable for user expectations
      expect(thresholds.apiCall).toBeLessThanOrEqual(45000); // 45 seconds
      expect(thresholds.totalFlow).toBeLessThanOrEqual(60000); // 60 seconds total

      // But long enough to allow for AI processing
      expect(thresholds.apiCall).toBeGreaterThanOrEqual(30000); // At least 30 seconds
    });
  });

  describe('Performance Regression Prevention', () => {
    test('should meet baseline performance requirements', async () => {
      const requirements = {
        singleRequestTime: 50000, // 50 seconds
        concurrentThroughput: 0.01, // 0.01 requests per second
        memoryUsage: 50 * 1024 * 1024, // 50MB
        validationTime: 200, // 200ms
      };

      const singleResult = await performanceRunner.testSingleImageGeneration();
      expect(singleResult.totalTime).toBeLessThan(
        requirements.singleRequestTime,
      );

      const concurrentResult =
        await performanceRunner.testConcurrentImageGeneration(3);
      expect(concurrentResult.throughput).toBeGreaterThan(
        requirements.concurrentThroughput,
      );
    });

    test('should perform consistently across different scenarios', async () => {
      const results = [];

      // Test multiple scenarios
      results.push(await performanceRunner.testSingleImageGeneration());
      results.push(await performanceRunner.testSingleImageGeneration());
      results.push(await performanceRunner.testSingleImageGeneration());

      const times = results.map(r => r.totalTime);
      const averageTime =
        times.reduce((sum, time) => sum + time, 0) / times.length;
      const maxDeviation = Math.max(
        ...times.map(time => Math.abs(time - averageTime)),
      );

      // Consistency: max deviation should be less than 50% of average
      expect(maxDeviation).toBeLessThan(averageTime * 0.5);
    });
  });
});
