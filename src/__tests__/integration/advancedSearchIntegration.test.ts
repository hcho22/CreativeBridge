/**
 * Integration tests for Advanced Search functionality
 *
 * Tests the complete advanced search workflow with real-world scenarios
 */

import { advancedSearchService } from '../../services/advancedSearchService';

describe('Advanced Search Integration', () => {
  beforeEach(() => {
    advancedSearchService.clearCache();
  });

  describe('Search Workflow', () => {
    it('should handle search service initialization', () => {
      expect(advancedSearchService).toBeDefined();
      expect(typeof advancedSearchService.fullTextSearch).toBe('function');
      expect(typeof advancedSearchService.searchByMetadata).toBe('function');
      expect(typeof advancedSearchService.getSuggestions).toBe('function');
    });

    it('should handle empty search gracefully', async () => {
      const results = await advancedSearchService.fullTextSearch('');
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });

    it('should handle search with non-existent content', async () => {
      const results = await advancedSearchService.fullTextSearch(
        'nonexistent_content_xyz',
      );
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });

    it('should provide search suggestions', async () => {
      const suggestions = await advancedSearchService.getSuggestions('adv');
      expect(Array.isArray(suggestions)).toBe(true);
      // Should contain 'adventure' from common terms
      const adventureSuggestion = suggestions.find(s =>
        s.text.includes('adventure'),
      );
      expect(adventureSuggestion).toBeDefined();
    });

    it('should handle metadata search', async () => {
      const results = await advancedSearchService.searchByMetadata({
        source: 'CreativeBridge',
      });
      expect(Array.isArray(results)).toBe(true);
    });

    it('should get search analytics', async () => {
      const analytics = await advancedSearchService.getSearchAnalytics();
      expect(analytics).toHaveProperty('totalSearches');
      expect(analytics).toHaveProperty('popularQueries');
      expect(analytics).toHaveProperty('averageResultCount');
      expect(analytics).toHaveProperty('searchSuccessRate');
      expect(analytics).toHaveProperty('averageResponseTime');
    });

    it('should handle search history operations', async () => {
      const history = await advancedSearchService.getSearchHistory('test-user');
      expect(Array.isArray(history)).toBe(true);

      // Save to history should not throw
      await expect(
        advancedSearchService.saveToHistory('test query', 'test-user', 5),
      ).resolves.not.toThrow();
    });
  });

  describe('Performance Characteristics', () => {
    it('should complete search operations quickly', async () => {
      const startTime = Date.now();

      await Promise.all([
        advancedSearchService.fullTextSearch('test'),
        advancedSearchService.getSuggestions('te'),
        advancedSearchService.getSearchAnalytics(),
      ]);

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(2000); // Under 2 seconds
    });

    it('should handle cache operations', () => {
      expect(() => advancedSearchService.clearCache()).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      // These should not throw but return empty/default results
      const results = await advancedSearchService.fullTextSearch('test');
      expect(Array.isArray(results)).toBe(true);

      const suggestions = await advancedSearchService.getSuggestions('test');
      expect(Array.isArray(suggestions)).toBe(true);

      const analytics = await advancedSearchService.getSearchAnalytics();
      expect(typeof analytics).toBe('object');
    });

    it('should handle invalid input gracefully', async () => {
      // Test with various invalid inputs
      const invalidInputs = [null, undefined, '', '   ', '@#$%^&*()'];

      for (const input of invalidInputs) {
        const results = await advancedSearchService.fullTextSearch(
          input as any,
        );
        expect(Array.isArray(results)).toBe(true);
      }
    });
  });

  describe('Search Features', () => {
    it('should support different search types', async () => {
      // Full-text search
      const textResults = await advancedSearchService.fullTextSearch(
        'adventure',
      );
      expect(Array.isArray(textResults)).toBe(true);

      // Metadata search
      const metadataResults = await advancedSearchService.searchByMetadata({
        source: 'File',
      });
      expect(Array.isArray(metadataResults)).toBe(true);

      // Suggestions
      const suggestions = await advancedSearchService.getSuggestions('adv');
      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('should support search options', async () => {
      const searchOptions = {
        sortBy: 'date' as const,
        sortOrder: 'desc' as const,
        limit: 10,
        offset: 0,
      };

      const results = await advancedSearchService.fullTextSearch(
        'test',
        undefined,
        searchOptions,
      );

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeLessThanOrEqual(10);
    });

    it('should handle user-specific searches', async () => {
      const userId = 'test-user-123';

      const results = await advancedSearchService.fullTextSearch(
        'adventure',
        userId,
      );

      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('Data Consistency', () => {
    it('should maintain consistent result structure', async () => {
      const results = await advancedSearchService.fullTextSearch('test');

      results.forEach(result => {
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('relevanceScore');
        expect(result).toHaveProperty('matchedFields');
        expect(result).toHaveProperty('preview');
        expect(Array.isArray(result.matchedFields)).toBe(true);
        expect(typeof result.relevanceScore).toBe('number');
      });
    });

    it('should maintain consistent suggestion structure', async () => {
      const suggestions = await advancedSearchService.getSuggestions('test');

      suggestions.forEach(suggestion => {
        expect(suggestion).toHaveProperty('text');
        expect(suggestion).toHaveProperty('type');
        expect(suggestion).toHaveProperty('frequency');
        expect(['query', 'metadata', 'content']).toContain(suggestion.type);
        expect(typeof suggestion.frequency).toBe('number');
      });
    });

    it('should maintain consistent analytics structure', async () => {
      const analytics = await advancedSearchService.getSearchAnalytics();

      expect(typeof analytics.totalSearches).toBe('number');
      expect(Array.isArray(analytics.popularQueries)).toBe(true);
      expect(typeof analytics.averageResultCount).toBe('number');
      expect(typeof analytics.searchSuccessRate).toBe('number');
      expect(typeof analytics.averageResponseTime).toBe('number');

      expect(analytics.searchSuccessRate).toBeGreaterThanOrEqual(0);
      expect(analytics.searchSuccessRate).toBeLessThanOrEqual(100);
    });
  });
});
