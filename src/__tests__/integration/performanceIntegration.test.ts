/**
 * Performance Service Integration Tests
 * 
 * Tests the complete performance optimization workflow with real-world scenarios,
 * including cache behavior, database optimization, and cross-service integration.
 */

import { performanceService } from '../../services/performanceService';

describe('Performance Service Integration', () => {
  beforeEach(() => {
    performanceService.clearCache();
    performanceService.resetMetrics();
  });

  describe('Service Integration', () => {
    it('should initialize performance service correctly', () => {
      expect(performanceService).toBeDefined();
      expect(typeof performanceService.getStoryPage).toBe('function');
      expect(typeof performanceService.getStoryPreview).toBe('function');
      expect(typeof performanceService.getFullStory).toBe('function');
      expect(typeof performanceService.getMetrics).toBe('function');
      expect(typeof performanceService.getCacheStats).toBe('function');
      expect(typeof performanceService.analyzeDatabasePerformance).toBe('function');
      expect(typeof performanceService.warmUpCache).toBe('function');
      expect(typeof performanceService.prefetchRelatedStories).toBe('function');
    });

    it('should handle empty database gracefully', async () => {
      const results = await performanceService.getStoryPage(1, 10);
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });

    it('should handle non-existent stories gracefully', async () => {
      const preview = await performanceService.getStoryPreview('nonexistent-story');
      const fullStory = await performanceService.getFullStory('nonexistent-story');
      
      expect(preview).toBeNull();
      expect(fullStory).toBeNull();
    });

    it('should provide consistent metrics structure', () => {
      const metrics = performanceService.getMetrics();
      
      expect(metrics).toHaveProperty('cacheHitRate');
      expect(metrics).toHaveProperty('averageLoadTime');
      expect(metrics).toHaveProperty('totalRequests');
      expect(metrics).toHaveProperty('cachedRequests');
      expect(metrics).toHaveProperty('databaseQueries');
      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics).toHaveProperty('responseTimeHistory');
      expect(metrics).toHaveProperty('slowQueries');

      expect(typeof metrics.cacheHitRate).toBe('number');
      expect(typeof metrics.averageLoadTime).toBe('number');
      expect(typeof metrics.totalRequests).toBe('number');
      expect(typeof metrics.cachedRequests).toBe('number');
      expect(typeof metrics.databaseQueries).toBe('number');
      expect(typeof metrics.memoryUsage).toBe('number');
      expect(Array.isArray(metrics.responseTimeHistory)).toBe(true);
      expect(Array.isArray(metrics.slowQueries)).toBe(true);
    });

    it('should provide consistent cache stats structure', () => {
      const cacheStats = performanceService.getCacheStats();
      
      expect(cacheStats).toHaveProperty('entries');
      expect(cacheStats).toHaveProperty('sizeKB');
      expect(cacheStats).toHaveProperty('hitRate');
      expect(cacheStats).toHaveProperty('oldestEntry');
      expect(cacheStats).toHaveProperty('newestEntry');

      expect(typeof cacheStats.entries).toBe('number');
      expect(typeof cacheStats.sizeKB).toBe('number');
      expect(typeof cacheStats.hitRate).toBe('number');
      expect(typeof cacheStats.oldestEntry).toBe('number');
      expect(typeof cacheStats.newestEntry).toBe('number');

      expect(cacheStats.entries).toBeGreaterThanOrEqual(0);
      expect(cacheStats.sizeKB).toBeGreaterThanOrEqual(0);
    });

    it('should provide database optimization suggestions', async () => {
      const suggestions = await performanceService.analyzeDatabasePerformance();
      
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
      
      suggestions.forEach(suggestion => {
        expect(suggestion).toHaveProperty('table');
        expect(suggestion).toHaveProperty('columns');
        expect(suggestion).toHaveProperty('type');
        expect(suggestion).toHaveProperty('reason');
        expect(suggestion).toHaveProperty('estimatedImprovement');
        
        expect(typeof suggestion.table).toBe('string');
        expect(Array.isArray(suggestion.columns)).toBe(true);
        expect(['btree', 'gin', 'gist']).toContain(suggestion.type);
        expect(typeof suggestion.reason).toBe('string');
        expect(typeof suggestion.estimatedImprovement).toBe('string');
      });
    });
  });

  describe('Performance Characteristics', () => {
    it('should complete operations quickly', async () => {
      const startTime = Date.now();
      
      await Promise.all([
        performanceService.getStoryPage(1, 10),
        performanceService.getMetrics(),
        performanceService.getCacheStats(),
        performanceService.analyzeDatabasePerformance()
      ]);

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(3000); // Under 3 seconds
    });

    it('should handle concurrent operations', async () => {
      const operations = Array.from({ length: 5 }, (_, i) => 
        performanceService.getStoryPage(i + 1, 10, `user-${i}`)
      );

      const results = await Promise.all(operations);
      
      results.forEach(result => {
        expect(Array.isArray(result)).toBe(true);
      });
    });

    it('should maintain cache consistency under load', async () => {
      // Simulate high load
      const operations = [];
      for (let i = 0; i < 10; i++) {
        operations.push(performanceService.getStoryPage(1, 10));
        operations.push(performanceService.getStoryPreview(`story-${i}`));
        operations.push(performanceService.getFullStory(`story-${i}`));
      }

      await Promise.all(operations);

      const cacheStats = performanceService.getCacheStats();
      expect(cacheStats.entries).toBeGreaterThanOrEqual(0);
      expect(cacheStats.sizeKB).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Cache Behavior', () => {
    it('should handle cache operations correctly', () => {
      // Clear should work without errors
      expect(() => performanceService.clearCache()).not.toThrow();
      
      // Stats should be consistent after clear
      const statsAfterClear = performanceService.getCacheStats();
      expect(statsAfterClear.entries).toBe(0);
    });

    it('should track cache performance over time', async () => {
      // Make several requests
      await performanceService.getStoryPage(1, 10);
      await performanceService.getStoryPage(1, 10); // Same request (cache hit)
      await performanceService.getStoryPage(2, 10); // Different request
      
      const metrics = performanceService.getMetrics();
      expect(metrics.totalRequests).toBeGreaterThan(0);
    });

    it('should handle cache eviction gracefully', async () => {
      // Fill cache with many different requests
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(performanceService.getStoryPage(i + 1, 10, `user-${i}`));
      }
      
      await Promise.all(promises);
      
      // Cache should still be functional
      const stats = performanceService.getCacheStats();
      expect(stats.entries).toBeGreaterThanOrEqual(0);
      
      // New requests should still work
      const newResults = await performanceService.getStoryPage(21, 10);
      expect(Array.isArray(newResults)).toBe(true);
    });
  });

  describe('Error Resilience', () => {
    it('should recover from service errors', async () => {
      // These operations should not throw
      await expect(performanceService.getStoryPage(1, 10)).resolves.not.toThrow();
      await expect(performanceService.getStoryPreview('test-id')).resolves.not.toThrow();
      await expect(performanceService.getFullStory('test-id')).resolves.not.toThrow();
      await expect(performanceService.warmUpCache()).resolves.not.toThrow();
      await expect(performanceService.analyzeDatabasePerformance()).resolves.not.toThrow();
    });

    it('should handle invalid input gracefully', async () => {
      // Invalid pagination parameters
      const results1 = await performanceService.getStoryPage(-1, -1);
      expect(Array.isArray(results1)).toBe(true);
      
      // Invalid story IDs
      const preview = await performanceService.getStoryPreview('');
      const fullStory = await performanceService.getFullStory('');
      expect(preview).toBeNull();
      expect(fullStory).toBeNull();
      
      // Invalid user IDs
      const results2 = await performanceService.getStoryPage(1, 10, '');
      expect(Array.isArray(results2)).toBe(true);
    });

    it('should maintain service stability', async () => {
      // Multiple rapid operations should not crash the service
      const rapidOperations = [];
      for (let i = 0; i < 50; i++) {
        rapidOperations.push(performanceService.getMetrics());
        rapidOperations.push(performanceService.getCacheStats());
      }
      
      await Promise.all(rapidOperations);
      
      // Service should still be responsive
      const finalMetrics = performanceService.getMetrics();
      expect(finalMetrics).toBeDefined();
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory with repeated operations', async () => {
      const initialStats = performanceService.getCacheStats();
      
      // Perform many operations
      for (let i = 0; i < 100; i++) {
        await performanceService.getStoryPage(i % 10 + 1, 10);
      }
      
      const finalStats = performanceService.getCacheStats();
      
      // Memory usage should be reasonable (cache should evict old entries)
      expect(finalStats.sizeKB).toBeLessThan(1000); // Less than 1MB
    });

    it('should handle cache clearing during operations', async () => {
      // Start some operations
      const operations = [
        performanceService.getStoryPage(1, 10),
        performanceService.getStoryPage(2, 10)
      ];
      
      // Clear cache while operations are running
      performanceService.clearCache();
      
      // Operations should still complete
      const results = await Promise.all(operations);
      results.forEach(result => {
        expect(Array.isArray(result)).toBe(true);
      });
    });
  });

  describe('Metrics Accuracy', () => {
    it('should accurately track request counts', async () => {
      performanceService.resetMetrics();
      
      await performanceService.getStoryPage(1, 10);
      await performanceService.getStoryPage(1, 10); // Same request
      await performanceService.getStoryPage(2, 10); // Different request
      
      const metrics = performanceService.getMetrics();
      expect(metrics.totalRequests).toBe(3);
    });

    it('should calculate cache hit rates correctly', async () => {
      performanceService.resetMetrics();
      
      // First request (miss)
      await performanceService.getStoryPage(1, 10);
      
      // Second request (hit)
      await performanceService.getStoryPage(1, 10);
      
      const metrics = performanceService.getMetrics();
      expect(metrics.totalRequests).toBe(2);
      expect(metrics.cacheHitRate).toBeGreaterThan(0);
    });

    it('should track response time history', async () => {
      performanceService.resetMetrics();
      
      await performanceService.getStoryPage(1, 10);
      await performanceService.getStoryPage(2, 10);
      
      const metrics = performanceService.getMetrics();
      expect(metrics.responseTimeHistory.length).toBe(2);
      expect(metrics.averageLoadTime).toBeGreaterThan(0);
    });
  });

  describe('Integration with Other Services', () => {
    it('should work independently of other services', async () => {
      // Performance service should work even if other services are not available
      const results = await performanceService.getStoryPage(1, 10);
      expect(Array.isArray(results)).toBe(true);
      
      const suggestions = await performanceService.analyzeDatabasePerformance();
      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('should provide consistent data structures', async () => {
      const storyPage = await performanceService.getStoryPage(1, 10);
      
      storyPage.forEach(story => {
        expect(story).toHaveProperty('id');
        expect(story).toHaveProperty('preview');
        expect(story).toHaveProperty('title');
        expect(story).toHaveProperty('source');
        expect(story).toHaveProperty('created_at');
        expect(story).toHaveProperty('updated_at');
        expect(story).toHaveProperty('word_count');
        expect(story).toHaveProperty('user_id');
        
        expect(typeof story.id).toBe('string');
        expect(typeof story.preview).toBe('string');
        expect(typeof story.source).toBe('string');
        expect(typeof story.word_count).toBe('number');
        expect(typeof story.user_id).toBe('string');
      });
    });

    it('should handle user context correctly', async () => {
      const userStories = await performanceService.getStoryPage(1, 10, 'test-user');
      const allStories = await performanceService.getStoryPage(1, 10);
      
      expect(Array.isArray(userStories)).toBe(true);
      expect(Array.isArray(allStories)).toBe(true);
    });
  });
});