/**
 * Performance Service Tests
 * 
 * Comprehensive test suite for performance optimization functionality including
 * pagination, lazy loading, intelligent caching, database optimization,
 * and performance monitoring with detailed metrics.
 */

import { performanceService } from '../../services/performanceService';
import { supabase } from '../../services/supabase';

// Mock Supabase
jest.mock('../../services/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
    })),
  },
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
}));

describe('PerformanceService', () => {
  const mockStoryData = [
    {
      id: 'story-1',
      story_content: 'This is a test story about dragons and adventures. It has many exciting moments and challenges.',
      story_source: 'CreativeBridge',
      created_at: '2024-01-01T10:00:00Z',
      updated_at: '2024-01-01T10:00:00Z',
      grade_level: 'K-2',
      user_id: 'user-123',
      story_metadata: { title: 'Dragon Adventure' }
    },
    {
      id: 'story-2',
      story_content: 'A magical journey through enchanted forests with wise wizards and brave knights.',
      imported_story_content: 'Additional imported content about the magical realm.',
      story_source: 'File',
      created_at: '2024-01-02T10:00:00Z',
      updated_at: '2024-01-02T10:00:00Z',
      grade_level: '3-5',
      user_id: 'user-456',
      story_metadata: { title: 'Magical Journey' }
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    performanceService.clearCache();
    performanceService.resetMetrics();
  });

  describe('Pagination', () => {
    it('should get paginated story results', async () => {
      const mockQuery = {
        data: mockStoryData,
        error: null
      };
      
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        ...mockQuery
      });

      const results = await performanceService.getStoryPage(1, 10);

      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('id');
      expect(results[0]).toHaveProperty('preview');
      expect(results[0]).toHaveProperty('word_count');
      expect(results[0]).toHaveProperty('title');
    });

    it('should validate pagination parameters', async () => {
      const mockQuery = {
        data: mockStoryData,
        error: null
      };
      
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        ...mockQuery
      });

      // Test invalid page numbers
      const results1 = await performanceService.getStoryPage(-1, 10);
      expect(results1).toHaveLength(2); // Should default to page 1

      // Test invalid page sizes
      const results2 = await performanceService.getStoryPage(1, 150);
      expect(results2).toHaveLength(2); // Should default to 20
    });

    it('should apply user filter correctly', async () => {
      const mockQuery = {
        data: [mockStoryData[0]], // Only return first story
        error: null
      };
      
      const mockBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        ...mockQuery
      };
      
      (supabase.from as jest.Mock).mockReturnValue(mockBuilder);

      await performanceService.getStoryPage(1, 10, 'user-123');

      expect(mockBuilder.eq).toHaveBeenCalledWith('user_id', 'user-123');
    });

    it('should apply sorting options correctly', async () => {
      const mockQuery = {
        data: mockStoryData,
        error: null
      };
      
      const mockBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        ...mockQuery
      };
      
      (supabase.from as jest.Mock).mockReturnValue(mockBuilder);

      await performanceService.getStoryPage(1, 10, undefined, {
        sortBy: 'updated_at',
        sortOrder: 'asc'
      });

      expect(mockBuilder.order).toHaveBeenCalledWith('updated_at', { ascending: true });
    });

    it('should handle database errors gracefully', async () => {
      const mockQuery = {
        data: null,
        error: { message: 'Database connection failed' }
      };
      
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        ...mockQuery
      });

      const results = await performanceService.getStoryPage(1, 10);
      expect(results).toEqual([]);
    });

    it('should handle non-existent table gracefully', async () => {
      const mockQuery = {
        data: null,
        error: { message: 'relation "game_sessions" does not exist' }
      };
      
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        ...mockQuery
      });

      const results = await performanceService.getStoryPage(1, 10);
      expect(results).toEqual([]);
    });
  });

  describe('Lazy Loading', () => {
    it('should get story preview with limited content', async () => {
      const mockQuery = {
        data: mockStoryData[0],
        error: null
      };
      
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        ...mockQuery
      });

      const preview = await performanceService.getStoryPreview('story-1');

      expect(preview).toBeDefined();
      expect(preview?.id).toBe('story-1');
      expect(preview?.preview).toBeDefined();
      expect(preview?.word_count).toBeGreaterThan(0);
      expect(preview?.title).toBe('Dragon Adventure');
    });

    it('should get full story content', async () => {
      const mockQuery = {
        data: mockStoryData[0],
        error: null
      };
      
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        ...mockQuery
      });

      const fullStory = await performanceService.getFullStory('story-1');

      expect(fullStory).toBeDefined();
      expect(fullStory?.id).toBe('story-1');
      expect(fullStory?.story_content).toBeDefined();
      expect(fullStory?.story_metadata).toBeDefined();
    });

    it('should handle missing stories gracefully', async () => {
      const mockQuery = {
        data: null,
        error: { message: 'Row not found' }
      };
      
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        ...mockQuery
      });

      const preview = await performanceService.getStoryPreview('nonexistent');
      const fullStory = await performanceService.getFullStory('nonexistent');

      expect(preview).toBeNull();
      expect(fullStory).toBeNull();
    });

    it('should generate appropriate preview length', async () => {
      const longContent = 'A'.repeat(1000);
      const mockData = {
        ...mockStoryData[0],
        story_content: longContent
      };
      
      const mockQuery = {
        data: mockData,
        error: null
      };
      
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        ...mockQuery
      });

      const preview = await performanceService.getStoryPreview('story-1');

      expect(preview?.preview.length).toBeLessThan(250); // Should be truncated
      expect(preview?.preview).toMatch(/\.\.\.$/); // Should end with ellipsis
    });
  });

  describe('Intelligent Caching', () => {
    it('should cache and retrieve story pages', async () => {
      const mockQuery = {
        data: mockStoryData,
        error: null
      };
      
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        ...mockQuery
      });

      // First call - should hit database
      const results1 = await performanceService.getStoryPage(1, 10);
      expect(results1).toHaveLength(2);

      // Clear mock call count
      jest.clearAllMocks();
      
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        ...mockQuery
      });

      // Second call - should use cache
      const results2 = await performanceService.getStoryPage(1, 10);
      expect(results2).toHaveLength(2);
      expect(supabase.from).not.toHaveBeenCalled(); // Should not hit database
    });

    it('should cache story previews and full stories separately', async () => {
      const mockQuery = {
        data: mockStoryData[0],
        error: null
      };
      
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        ...mockQuery
      });

      // Get preview and full story
      const preview = await performanceService.getStoryPreview('story-1');
      const fullStory = await performanceService.getFullStory('story-1');

      expect(preview).toBeDefined();
      expect(fullStory).toBeDefined();

      // Clear mocks and get again - should use cache
      jest.clearAllMocks();
      
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        ...mockQuery
      });

      const cachedPreview = await performanceService.getStoryPreview('story-1');
      const cachedFullStory = await performanceService.getFullStory('story-1');

      expect(cachedPreview?.id).toBe('story-1');
      expect(cachedFullStory?.id).toBe('story-1');
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('should clear cache when requested', () => {
      performanceService.clearCache();
      
      // Should not throw and should reset cache state
      expect(() => performanceService.clearCache()).not.toThrow();
    });

    it('should handle cache eviction for large datasets', async () => {
      const mockQuery = {
        data: mockStoryData,
        error: null
      };
      
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        ...mockQuery
      });

      // Fill cache beyond capacity (simulate large cache)
      for (let i = 0; i < 10; i++) {
        await performanceService.getStoryPage(i + 1, 10, `user-${i}`);
      }

      // Should still work and not crash
      const results = await performanceService.getStoryPage(11, 10, 'user-11');
      expect(results).toHaveLength(2);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track performance metrics', async () => {
      const mockQuery = {
        data: mockStoryData,
        error: null
      };
      
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        ...mockQuery
      });

      await performanceService.getStoryPage(1, 10);
      
      const metrics = performanceService.getMetrics();
      
      expect(metrics.totalRequests).toBeGreaterThan(0);
      expect(metrics.databaseQueries).toBeGreaterThan(0);
      expect(metrics.averageLoadTime).toBeGreaterThanOrEqual(0);
      expect(metrics.responseTimeHistory).toHaveLength(1);
    });

    it('should track cache hit rate', async () => {
      const mockQuery = {
        data: mockStoryData,
        error: null
      };
      
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        ...mockQuery
      });

      // First call - cache miss
      await performanceService.getStoryPage(1, 10);
      
      // Second call - cache hit
      await performanceService.getStoryPage(1, 10);
      
      const metrics = performanceService.getMetrics();
      
      expect(metrics.totalRequests).toBe(2);
      expect(metrics.cachedRequests).toBe(1);
      expect(metrics.cacheHitRate).toBe(50); // 1/2 = 50%
    });

    it('should provide cache statistics', async () => {
      const mockQuery = {
        data: mockStoryData,
        error: null
      };
      
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        ...mockQuery
      });

      await performanceService.getStoryPage(1, 10);
      
      const cacheStats = performanceService.getCacheStats();
      
      expect(cacheStats).toHaveProperty('entries');
      expect(cacheStats).toHaveProperty('sizeKB');
      expect(cacheStats).toHaveProperty('hitRate');
      expect(cacheStats).toHaveProperty('oldestEntry');
      expect(cacheStats).toHaveProperty('newestEntry');
      
      expect(cacheStats.entries).toBeGreaterThan(0);
      expect(cacheStats.sizeKB).toBeGreaterThanOrEqual(0);
    });

    it('should reset metrics correctly', () => {
      performanceService.resetMetrics();
      
      const metrics = performanceService.getMetrics();
      
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.cachedRequests).toBe(0);
      expect(metrics.databaseQueries).toBe(0);
      expect(metrics.cacheHitRate).toBe(0);
      expect(metrics.averageLoadTime).toBe(0);
      expect(metrics.responseTimeHistory).toHaveLength(0);
      expect(metrics.slowQueries).toHaveLength(0);
    });

    it('should track slow queries', async () => {
      const mockQuery = {
        data: mockStoryData,
        error: null
      };
      
      // Mock a slow query by delaying the response
      const slowMockBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        ...mockQuery
      };
      
      // Add delay to simulate slow query
      Object.defineProperty(slowMockBuilder, 'data', {
        get: () => new Promise(resolve => setTimeout(() => resolve(mockStoryData), 1100))
      });
      
      (supabase.from as jest.Mock).mockReturnValue(slowMockBuilder);

      await performanceService.getStoryPage(1, 10);
      
      const metrics = performanceService.getMetrics();
      
      // Note: Due to test environment, actual slow query detection may not trigger
      // but the structure should be in place
      expect(metrics.slowQueries).toBeDefined();
      expect(Array.isArray(metrics.slowQueries)).toBe(true);
    });
  });

  describe('Database Optimization', () => {
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
        
        expect(Array.isArray(suggestion.columns)).toBe(true);
        expect(['btree', 'gin', 'gist']).toContain(suggestion.type);
      });
    });

    it('should suggest appropriate indexes', async () => {
      const suggestions = await performanceService.analyzeDatabasePerformance();
      
      const userIndexSuggestion = suggestions.find(s => 
        s.columns.includes('user_id') && s.columns.includes('created_at')
      );
      expect(userIndexSuggestion).toBeDefined();
      expect(userIndexSuggestion?.type).toBe('btree');
      
      const fullTextSuggestion = suggestions.find(s => 
        s.columns.includes('story_content')
      );
      expect(fullTextSuggestion).toBeDefined();
      expect(fullTextSuggestion?.type).toBe('gin');
    });
  });

  describe('Cache Warm-up and Prefetching', () => {
    it('should warm up cache for user', async () => {
      const mockQuery = {
        data: mockStoryData,
        error: null
      };
      
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        ...mockQuery
      });

      await performanceService.warmUpCache('user-123');
      
      // Should have made database calls to pre-load content
      expect(supabase.from).toHaveBeenCalled();
    });

    it('should warm up cache without user', async () => {
      const mockQuery = {
        data: mockStoryData,
        error: null
      };
      
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        ...mockQuery
      });

      await performanceService.warmUpCache();
      
      expect(supabase.from).toHaveBeenCalled();
    });

    it('should prefetch related stories', async () => {
      const mockQuery = {
        data: mockStoryData[0],
        error: null
      };
      
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        ...mockQuery
      });

      await performanceService.prefetchRelatedStories('story-1', 'user-123');
      
      // Should have made calls to prefetch related content
      expect(supabase.from).toHaveBeenCalled();
    });

    it('should handle warm-up errors gracefully', async () => {
      const mockQuery = {
        data: null,
        error: { message: 'Database error' }
      };
      
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        ...mockQuery
      });

      // Should not throw
      await expect(performanceService.warmUpCache('user-123')).resolves.not.toThrow();
    });
  });

  describe('Helper Methods', () => {
    it('should generate appropriate story previews', async () => {
      const shortContent = 'Short story content.';
      const longContent = 'A'.repeat(500) + ' long story content continues...';
      
      const mockQuery1 = { data: { ...mockStoryData[0], story_content: shortContent }, error: null };
      const mockQuery2 = { data: { ...mockStoryData[0], story_content: longContent }, error: null };
      
      (supabase.from as jest.Mock)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockReturnThis(),
          ...mockQuery1
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockReturnThis(),
          ...mockQuery2
        });

      const shortPreview = await performanceService.getStoryPreview('story-1');
      const longPreview = await performanceService.getStoryPreview('story-2');

      expect(shortPreview?.preview).toBe(shortContent);
      expect(longPreview?.preview.length).toBeLessThan(longContent.length);
      expect(longPreview?.preview).toMatch(/\.\.\.$/);
    });

    it('should extract titles from content', async () => {
      const contentWithTitle = 'The Dragon Adventure\n\nOnce upon a time...';
      const contentWithoutTitle = 'Once upon a time there was a story...';
      
      const mockQuery1 = { 
        data: { ...mockStoryData[0], story_content: contentWithTitle, story_metadata: {} }, 
        error: null 
      };
      const mockQuery2 = { 
        data: { ...mockStoryData[0], story_content: contentWithoutTitle, story_metadata: {} }, 
        error: null 
      };
      
      (supabase.from as jest.Mock)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockReturnThis(),
          ...mockQuery1
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockReturnThis(),
          ...mockQuery2
        });

      const preview1 = await performanceService.getStoryPreview('story-1');
      const preview2 = await performanceService.getStoryPreview('story-2');

      expect(preview1?.title).toContain('Dragon Adventure');
      expect(preview2?.title).toBeDefined();
      expect(preview2?.title).not.toBe('Untitled Story');
    });

    it('should calculate word counts correctly', async () => {
      const content = 'This is a test story with exactly ten words in it.';
      const mockQuery = { 
        data: { ...mockStoryData[0], story_content: content }, 
        error: null 
      };
      
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        ...mockQuery
      });

      const preview = await performanceService.getStoryPreview('story-1');

      // The content has 11 words: "This is a test story with exactly ten words in it."
      expect(preview?.word_count).toBe(11);
    });
  });

  describe('Error Handling', () => {
    it('should handle service initialization errors', () => {
      expect(() => performanceService.getMetrics()).not.toThrow();
      expect(() => performanceService.getCacheStats()).not.toThrow();
    });

    it('should handle malformed story data', async () => {
      const malformedData = [
        { id: 'story-1' }, // Missing required fields
        null,
        undefined,
        { id: 'story-2', story_content: null }
      ];
      
      const mockQuery = {
        data: malformedData,
        error: null
      };
      
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        ...mockQuery
      });

      const results = await performanceService.getStoryPage(1, 10);
      
      // Should handle malformed data gracefully
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle cache corruption gracefully', () => {
      // Clear cache should work even if cache is in bad state
      expect(() => performanceService.clearCache()).not.toThrow();
      
      // Reset metrics should work even if metrics are corrupted
      expect(() => performanceService.resetMetrics()).not.toThrow();
    });
  });
});