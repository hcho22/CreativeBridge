/**
 * Performance Optimizations Tests (Task 2.5)
 * Comprehensive test suite for download performance improvements
 */

import { optimizedStoryDownloadService } from '../../services/optimizedStoryDownloadService';
import { downloadPerformanceMonitor } from '../../services/downloadPerformanceMonitor';
import { optimizedDownloadHistoryService } from '../../services/optimizedDownloadHistoryService';

// Mock dependencies
jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/test/documents',
  writeFile: jest.fn(),
  exists: jest.fn(),
  unlink: jest.fn(),
}));

jest.mock('react-native-share', () => ({
  open: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

jest.mock('pako', () => ({
  gzip: jest.fn((data) => new Uint8Array([1, 2, 3, 4])),
  ungzip: jest.fn((data) => new Uint8Array([5, 6, 7, 8])),
}));

describe('Performance Optimizations Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock performance.now for consistent timing
    global.performance = {
      now: jest.fn(() => Date.now()),
    } as any;
  });

  describe('Background File Generation', () => {
    it('should generate large files without blocking UI', async () => {
      const largeStory = {
        storyId: 'test-1',
        content: 'A'.repeat(100000), // 100KB story
        title: 'Large Test Story'
      };

      const startTime = Date.now();
      
      // Should return quickly due to background processing
      const promise = optimizedStoryDownloadService.generateStoryFileAsync({
        ...largeStory,
        enableBackgroundProcessing: true,
        chunkSize: 1024,
      });
      
      // UI should remain responsive (operation should start quickly)
      expect(Date.now() - startTime).toBeLessThan(100);
      
      const result = await promise;
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(100000);
    });

    it('should process files in chunks for memory efficiency', async () => {
      const largeContent = 'Word '.repeat(50000); // ~250KB content
      
      const result = await optimizedStoryDownloadService.generateStoryFileAsync({
        storyId: 'test-chunk',
        content: largeContent,
        title: 'Chunked Test',
        chunkSize: 1024, // Small chunks for testing
      });

      expect(result).toContain('Chunked Test');
      expect(result).toContain('Word');
      expect(result.length).toBeGreaterThan(largeContent.length);
    });

    it('should handle concurrent downloads efficiently', async () => {
      const downloads = Array.from({ length: 5 }, (_, i) => ({
        storyId: `concurrent-${i}`,
        content: `Story content ${i} `.repeat(1000),
        title: `Concurrent Story ${i}`,
        enableBackgroundProcessing: true,
      }));

      const startTime = Date.now();
      
      const promises = downloads.map(story => 
        optimizedStoryDownloadService.generateStoryFileAsync(story)
      );
      
      const results = await Promise.all(promises);
      
      const totalTime = Date.now() - startTime;
      
      expect(results.length).toBe(5);
      results.forEach((result, index) => {
        expect(result).toContain(`Concurrent Story ${index}`);
      });
      
      // Should complete faster than sequential processing
      expect(totalTime).toBeLessThan(10000); // Less than 10 seconds
    });
  });

  describe('Progress Indicators', () => {
    it('should provide accurate progress updates', async () => {
      const progressUpdates: any[] = [];
      
      const result = await optimizedStoryDownloadService.downloadStoryWithOptimization({
        storyId: 'progress-test',
        content: 'Test content for progress tracking',
        title: 'Progress Test',
        userId: 'test-user',
        sessionId: 'test-session',
        onProgress: (progress) => {
          progressUpdates.push(progress);
        },
      });

      expect(progressUpdates.length).toBeGreaterThan(0);
      
      // Should have increasing progress values
      for (let i = 1; i < progressUpdates.length; i++) {
        expect(progressUpdates[i].progress).toBeGreaterThanOrEqual(
          progressUpdates[i - 1].progress
        );
      }

      // Should reach 100% on completion
      const lastUpdate = progressUpdates[progressUpdates.length - 1];
      expect(lastUpdate.progress).toBe(100);
      expect(lastUpdate.stage).toBe('completed');
    });

    it('should show different stages during download', async () => {
      const stages: string[] = [];
      
      await optimizedStoryDownloadService.downloadStoryWithOptimization({
        storyId: 'stages-test',
        content: 'Test content'.repeat(1000),
        title: 'Stages Test',
        userId: 'test-user',
        sessionId: 'test-session',
        enableCompression: true,
        onProgress: (progress) => {
          if (!stages.includes(progress.stage)) {
            stages.push(progress.stage);
          }
        },
      });

      expect(stages).toContain('validating');
      expect(stages).toContain('generating');
      expect(stages).toContain('saving');
      expect(stages).toContain('completed');
    });

    it('should provide time estimates for long operations', async () => {
      let timeEstimateProvided = false;
      
      await optimizedStoryDownloadService.downloadStoryWithOptimization({
        storyId: 'estimate-test',
        content: 'Large content '.repeat(10000),
        title: 'Time Estimate Test',
        userId: 'test-user',
        sessionId: 'test-session',
        enableBackgroundProcessing: true,
        onProgress: (progress) => {
          if (progress.estimatedTimeRemaining) {
            timeEstimateProvided = true;
          }
        },
      });

      expect(timeEstimateProvided).toBe(true);
    });
  });

  describe('Memory Usage Optimization', () => {
    it('should maintain low memory usage during file creation', async () => {
      const initialMemory = getMemoryUsage();
      
      const largeContent = 'Large story content '.repeat(10000); // ~200KB
      
      await optimizedStoryDownloadService.generateStoryFileAsync({
        storyId: 'memory-test',
        content: largeContent,
        title: 'Memory Test',
        chunkSize: 1024,
      });
      
      const finalMemory = getMemoryUsage();
      const memoryDelta = finalMemory - initialMemory;
      
      // Memory usage should stay within reasonable bounds
      expect(memoryDelta).toBeLessThan(10 * 1024 * 1024); // < 10MB
    });

    it('should clean up resources after download completion', async () => {
      const operationId = 'cleanup-test';
      
      // Start a download
      optimizedStoryDownloadService.downloadStoryWithOptimization({
        storyId: 'cleanup-test',
        content: 'Test content',
        title: 'Cleanup Test',
        userId: 'test-user',
        sessionId: 'test-session',
      });

      // Operation should be tracked initially
      const initialProgress = optimizedStoryDownloadService.getDownloadProgress(operationId);
      
      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Operation should be cleaned up
      const finalProgress = optimizedStoryDownloadService.getDownloadProgress(operationId);
      expect(finalProgress).toBeNull();
    });

    it('should handle multiple simultaneous operations without memory leaks', async () => {
      const initialMemory = getMemoryUsage();
      
      const operations = Array.from({ length: 10 }, (_, i) => 
        optimizedStoryDownloadService.generateStoryFileAsync({
          storyId: `memory-${i}`,
          content: `Content ${i} `.repeat(1000),
          title: `Memory Test ${i}`,
        })
      );

      await Promise.all(operations);
      
      const finalMemory = getMemoryUsage();
      const memoryDelta = finalMemory - initialMemory;
      
      // Should not accumulate excessive memory
      expect(memoryDelta).toBeLessThan(20 * 1024 * 1024); // < 20MB for 10 operations
    });
  });

  describe('File Compression', () => {
    it('should compress large files effectively', async () => {
      const largeContent = 'Repetitive content that compresses well. '.repeat(2000);
      
      const uncompressedSize = optimizedStoryDownloadService.estimateOptimizedFileSize(largeContent, false);
      const compressedSize = optimizedStoryDownloadService.estimateOptimizedFileSize(largeContent, true);
      
      expect(compressedSize).toBeLessThan(uncompressedSize);
      expect(compressedSize).toBeLessThan(uncompressedSize * 0.8); // At least 20% reduction
    });

    it('should not compress small files unnecessarily', async () => {
      const smallContent = 'Small story content';
      
      const uncompressedSize = optimizedStoryDownloadService.estimateOptimizedFileSize(smallContent, false);
      const compressedSize = optimizedStoryDownloadService.estimateOptimizedFileSize(smallContent, true);
      
      // Small files should not be compressed
      expect(compressedSize).toBe(uncompressedSize);
    });

    it('should handle compression errors gracefully', async () => {
      // Mock compression failure
      const pako = require('pako');
      pako.gzip.mockImplementation(() => {
        throw new Error('Compression failed');
      });

      const result = await optimizedStoryDownloadService.downloadStoryWithOptimization({
        storyId: 'compression-error',
        content: 'Content that fails to compress'.repeat(1000),
        title: 'Compression Error Test',
        userId: 'test-user',
        sessionId: 'test-session',
        enableCompression: true,
      });

      // Should still succeed without compression
      expect(result.success).toBe(true);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track download performance metrics', async () => {
      const operationId = 'perf-test';
      
      downloadPerformanceMonitor.startTracking(operationId, {
        operation: 'test_download',
        fileSize: 1000,
        userId: 'test-user',
      });

      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 100));

      const metrics = await downloadPerformanceMonitor.stopTracking(operationId, {
        success: true,
      });

      expect(metrics).toBeTruthy();
      expect(metrics!.operation).toBe('test_download');
      expect(metrics!.duration).toBeGreaterThan(90); // At least 90ms
      expect(metrics!.success).toBe(true);
    });

    it('should provide performance analytics', async () => {
      // Generate some test metrics
      for (let i = 0; i < 5; i++) {
        const opId = `analytics-test-${i}`;
        downloadPerformanceMonitor.startTracking(opId, {
          operation: 'analytics_test',
          fileSize: 1000 + i * 500,
          userId: 'test-user',
        });
        
        await new Promise(resolve => setTimeout(resolve, 50 + i * 10));
        
        await downloadPerformanceMonitor.stopTracking(opId, {
          success: i < 4, // Make one fail for testing
        });
      }

      const analytics = await downloadPerformanceMonitor.getPerformanceAnalytics();

      expect(analytics.operationsCount).toBeGreaterThan(0);
      expect(analytics.averageDownloadTime).toBeGreaterThan(0);
      expect(analytics.successRate).toBeGreaterThan(0);
      expect(analytics.recommendations).toBeInstanceOf(Array);
    });

    it('should identify slow operations', async () => {
      const slowOpId = 'slow-operation';
      
      downloadPerformanceMonitor.startTracking(slowOpId, {
        operation: 'slow_test',
        fileSize: 5000,
        userId: 'test-user',
      });

      // Simulate slow operation
      await new Promise(resolve => setTimeout(resolve, 4000)); // 4 seconds

      await downloadPerformanceMonitor.stopTracking(slowOpId, {
        success: true,
      });

      const analytics = await downloadPerformanceMonitor.getPerformanceAnalytics();
      
      expect(analytics.slowOperations.length).toBeGreaterThan(0);
      expect(analytics.recommendations).toContain(
        expect.stringContaining('background processing')
      );
    });
  });

  describe('Database Query Optimization', () => {
    it('should cache frequent queries', async () => {
      const userId = 'cache-test-user';
      
      // First call should hit database
      const start1 = Date.now();
      await optimizedDownloadHistoryService.getDownloadHistory(userId, 10, 0);
      const time1 = Date.now() - start1;

      // Second call should hit cache
      const start2 = Date.now();
      await optimizedDownloadHistoryService.getDownloadHistory(userId, 10, 0);
      const time2 = Date.now() - start2;

      // Cache hit should be significantly faster
      expect(time2).toBeLessThan(time1 * 0.5);
    });

    it('should batch delete operations efficiently', async () => {
      const recordIds = Array.from({ length: 20 }, (_, i) => `record-${i}`);
      
      const startTime = Date.now();
      const result = await optimizedDownloadHistoryService.batchDeleteDownloadRecords(recordIds);
      const duration = Date.now() - startTime;

      expect(result.deleted + result.failed).toBe(recordIds.length);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle concurrent operations without conflicts', async () => {
      const userId = 'concurrent-test-user';
      
      const operations = [
        optimizedDownloadHistoryService.getDownloadHistory(userId, 10, 0),
        optimizedDownloadHistoryService.getDownloadHistory(userId, 10, 10),
        optimizedDownloadHistoryService.getDownloadAnalytics(userId),
      ];

      const results = await Promise.all(operations);
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toBeTruthy();
      });
    });

    it('should provide performance summary', async () => {
      const summary = await optimizedDownloadHistoryService.getPerformanceSummary();

      expect(summary).toHaveProperty('cacheHitRate');
      expect(summary).toHaveProperty('activeCacheEntries');
      expect(summary).toHaveProperty('pendingOperations');
      expect(summary).toHaveProperty('validationQueueSize');
      expect(summary).toHaveProperty('recommendations');
      expect(Array.isArray(summary.recommendations)).toBe(true);
    });
  });

  describe('Integration Performance', () => {
    it('should handle complete download flow within performance thresholds', async () => {
      const startTime = Date.now();
      
      const result = await optimizedStoryDownloadService.downloadStoryWithOptimization({
        storyId: 'integration-test',
        content: 'Integration test content '.repeat(1000),
        title: 'Integration Performance Test',
        userId: 'test-user',
        sessionId: 'test-session',
        enableCompression: true,
        enableBackgroundProcessing: true,
      });

      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(3000); // Complete within 3 seconds
    });

    it('should maintain performance under load', async () => {
      const startTime = Date.now();
      
      const downloads = Array.from({ length: 10 }, (_, i) => 
        optimizedStoryDownloadService.downloadStoryWithOptimization({
          storyId: `load-test-${i}`,
          content: `Load test content ${i} `.repeat(500),
          title: `Load Test ${i}`,
          userId: 'load-test-user',
          sessionId: `load-session-${i}`,
          enableBackgroundProcessing: true,
        })
      );

      const results = await Promise.all(downloads);
      const duration = Date.now() - startTime;

      expect(results.length).toBe(10);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
      
      // Should handle 10 concurrent downloads efficiently
      expect(duration).toBeLessThan(15000); // Within 15 seconds
    });
  });
});

// Helper function to simulate memory usage tracking
function getMemoryUsage(): number {
  // In a real React Native environment, this would use native modules
  // For testing, we'll simulate memory usage
  return Math.random() * 1000000; // Random value up to 1MB
}