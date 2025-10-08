/**
 * Jest tests for Advanced Search Service
 * 
 * Tests for Task 18: Advanced Search Implementation
 * - Full-text search across story content
 * - Metadata search functionality
 * - Search result ranking and relevance
 * - Search history and suggestions
 * - Performance optimization for large datasets
 */

import { advancedSearchService, SearchQuery, SearchResult, SearchSuggestion } from '../../services/advancedSearchService';

// Mock the Supabase client
jest.mock('../../services/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(() => Promise.resolve({
                data: mockSearchHistory,
                error: null
              }))
            }))
          })),
          gte: jest.fn(() => ({
            lte: jest.fn(() => Promise.resolve({
              data: mockStories,
              error: null
            }))
          })),
          order: jest.fn(() => ({
            limit: jest.fn(() => Promise.resolve({
              data: mockSearchHistory,
              error: null
            }))
          })),
          limit: jest.fn(() => Promise.resolve({
            data: mockSearchHistory,
            error: null
          }))
        })),
        gte: jest.fn(() => ({
          lte: jest.fn(() => Promise.resolve({
            data: mockStories,
            error: null
          }))
        })),
        order: jest.fn(() => ({
          limit: jest.fn(() => Promise.resolve({
            data: mockSearchHistory,
            error: null
          }))
        })),
        limit: jest.fn(() => Promise.resolve({
          data: mockSearchHistory,
          error: null
        }))
      })),
      insert: jest.fn(() => Promise.resolve({
        data: { id: 'new-history-id' },
        error: null
      }))
    }))
  }
}));

// Mock data
const mockStories = [
  {
    id: 'story-1',
    story_content: 'Once upon a time, there was a brave dragon who lived in a magical castle. The dragon loved to help people and protect the kingdom from danger.',
    story_source: 'CreativeBridge',
    story_metadata: { title: 'The Brave Dragon', genre: 'fantasy', wordCount: 25 },
    user_id: 'user-1',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    grade_level: 'K-2'
  },
  {
    id: 'story-2',
    story_content: 'Detective Sarah investigated the mysterious case of the missing treasure. She followed clues through the dark alley and discovered an ancient secret.',
    story_source: 'File',
    story_metadata: { title: 'Mystery of the Missing Treasure', genre: 'mystery', wordCount: 22 },
    user_id: 'user-1',
    created_at: '2024-01-14T15:30:00Z',
    updated_at: '2024-01-14T15:30:00Z',
    grade_level: '3-5'
  },
  {
    id: 'story-3',
    story_content: 'In the year 2150, Captain Nova explored the distant planet Zephyr. The alien landscape was filled with crystalline formations and floating islands.',
    story_source: 'Story_Quest',
    story_metadata: { title: 'Captain Nova\'s Adventure', genre: 'sci-fi', wordCount: 20 },
    user_id: 'user-2',
    created_at: '2024-01-13T09:45:00Z',
    updated_at: '2024-01-13T09:45:00Z',
    grade_level: '6-8'
  },
  {
    id: 'story-4',
    story_content: 'The wizard\'s apprentice learned to cast powerful spells. Magic flowed through the ancient tower as she practiced her enchantments.',
    story_source: 'CreativeBridge',
    story_metadata: { title: 'The Wizard\'s Apprentice', genre: 'fantasy', wordCount: 18 },
    user_id: 'user-1',
    created_at: '2024-01-12T14:20:00Z',
    updated_at: '2024-01-12T14:20:00Z',
    grade_level: 'K-2'
  },
  {
    id: 'story-5',
    story_content: 'Adventure awaited the young knight as he embarked on a quest to find the legendary sword. The journey would test his courage and determination.',
    story_source: 'File',
    story_metadata: { title: 'Quest for the Legendary Sword', genre: 'adventure', wordCount: 24 },
    user_id: 'user-2',
    created_at: '2024-01-11T11:15:00Z',
    updated_at: '2024-01-11T11:15:00Z',
    grade_level: '3-5'
  }
];

const mockSearchHistory = [
  {
    id: 'hist-1',
    user_id: 'user-1',
    query: 'dragon adventure',
    result_count: 3,
    timestamp: '2024-01-15T10:05:00Z',
    filters: {}
  },
  {
    id: 'hist-2',
    user_id: 'user-1',
    query: 'mystery treasure',
    result_count: 2,
    timestamp: '2024-01-14T16:00:00Z',
    filters: { source: 'File' }
  },
  {
    id: 'hist-3',
    user_id: 'user-2',
    query: 'sci-fi space',
    result_count: 1,
    timestamp: '2024-01-13T10:00:00Z',
    filters: {}
  }
];

describe('AdvancedSearchService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    advancedSearchService.clearCache();
    
    // Mock successful database responses
    const { supabase } = require('../../services/supabase');
    supabase.from.mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(() => Promise.resolve({
                data: mockSearchHistory,
                error: null
              }))
            }))
          })),
          gte: jest.fn(() => ({
            lte: jest.fn(() => Promise.resolve({
              data: mockStories,
              error: null
            }))
          })),
          order: jest.fn(() => ({
            limit: jest.fn(() => Promise.resolve({
              data: mockSearchHistory,
              error: null
            }))
          })),
          limit: jest.fn(() => Promise.resolve({
            data: mockSearchHistory,
            error: null
          }))
        })),
        gte: jest.fn(() => ({
          lte: jest.fn(() => Promise.resolve({
            data: mockStories,
            error: null
          }))
        })),
        order: jest.fn(() => ({
          limit: jest.fn(() => Promise.resolve({
            data: mockSearchHistory,
            error: null
          }))
        })),
        limit: jest.fn(() => Promise.resolve({
          data: mockSearchHistory,
          error: null
        }))
      })),
      insert: jest.fn(() => Promise.resolve({
        data: { id: 'new-history-id' },
        error: null
      }))
    });
  });

  describe('Full-Text Search', () => {
    it('should perform full-text search successfully', async () => {
      const { supabase } = require('../../services/supabase');
      supabase.from().select().eq = jest.fn(() => Promise.resolve({
        data: mockStories,
        error: null
      }));

      const query = 'dragon adventure castle';
      const results = await advancedSearchService.fullTextSearch(query);
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      
      // Verify relevance scores
      results.forEach(result => {
        expect(result.relevanceScore).toBeGreaterThan(0);
        expect(typeof result.relevanceScore).toBe('number');
      });

      // Verify structure
      const firstResult = results[0];
      expect(firstResult).toHaveProperty('id');
      expect(firstResult).toHaveProperty('story_content');
      expect(firstResult).toHaveProperty('relevanceScore');
      expect(firstResult).toHaveProperty('matchedFields');
      expect(firstResult).toHaveProperty('preview');
    });

    it('should rank search results by relevance correctly', async () => {
      const { supabase } = require('../../services/supabase');
      supabase.from().select().eq = jest.fn(() => Promise.resolve({
        data: mockStories,
        error: null
      }));

      const query = 'fantasy story';
      const results = await advancedSearchService.fullTextSearch(query);
      
      // Results should be sorted by relevance (descending)
      for (let i = 1; i < results.length; i++) {
        expect(results[i].relevanceScore).toBeLessThanOrEqual(results[i-1].relevanceScore);
      }
    });

    it('should handle empty search results', async () => {
      const { supabase } = require('../../services/supabase');
      supabase.from().select().eq = jest.fn(() => Promise.resolve({
        data: [],
        error: null
      }));

      const query = 'nonexistent content';
      const results = await advancedSearchService.fullTextSearch(query);
      
      expect(results).toEqual([]);
    });

    it('should filter by user when userId provided', async () => {
      const { supabase } = require('../../services/supabase');
      const mockEq = jest.fn(() => Promise.resolve({
        data: mockStories.filter(s => s.user_id === 'user-1'),
        error: null
      }));
      supabase.from().select().eq = mockEq;

      const query = 'dragon';
      const results = await advancedSearchService.fullTextSearch(query, 'user-1');
      
      // Should filter by user
      expect(mockEq).toHaveBeenCalledWith('user_id', 'user-1');
      
      // All results should be for the specified user
      results.forEach(result => {
        expect(result.user_id).toBe('user-1');
      });
    });

    it('should handle database errors gracefully', async () => {
      const { supabase } = require('../../services/supabase');
      supabase.from().select().eq = jest.fn(() => Promise.resolve({
        data: null,
        error: { message: 'Database connection failed' }
      }));

      const query = 'test query';
      
      await expect(advancedSearchService.fullTextSearch(query))
        .rejects.toThrow('Search failed');
    });

    it('should apply pagination correctly', async () => {
      const { supabase } = require('../../services/supabase');
      supabase.from().select().eq = jest.fn(() => Promise.resolve({
        data: mockStories,
        error: null
      }));

      const query = 'story';
      const options: Partial<SearchQuery> = {
        limit: 2,
        offset: 1
      };
      
      const results = await advancedSearchService.fullTextSearch(query, undefined, options);
      
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should cache search results', async () => {
      const { supabase } = require('../../services/supabase');
      const mockSelect = jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({
          data: mockStories,
          error: null
        }))
      }));
      supabase.from.mockReturnValue({ select: mockSelect });

      const query = 'dragon';
      
      // First search
      await advancedSearchService.fullTextSearch(query);
      expect(mockSelect).toHaveBeenCalledTimes(1);
      
      // Second search (should use cache)
      await advancedSearchService.fullTextSearch(query);
      expect(mockSelect).toHaveBeenCalledTimes(1); // Should not increase
    });

    it('should highlight matches in content', async () => {
      const { supabase } = require('../../services/supabase');
      supabase.from().select().eq = jest.fn(() => Promise.resolve({
        data: mockStories,
        error: null
      }));

      const query = 'dragon';
      const results = await advancedSearchService.fullTextSearch(query);
      
      const dragonResult = results.find(r => r.story_content.includes('dragon'));
      if (dragonResult) {
        expect(dragonResult.highlightedContent).toContain('<mark>dragon</mark>');
      }
    });
  });

  describe('Metadata Search', () => {
    it('should search by metadata successfully', async () => {
      const { supabase } = require('../../services/supabase');
      const mockEq = jest.fn(() => Promise.resolve({
        data: mockStories.filter(s => s.story_metadata?.genre === 'fantasy'),
        error: null
      }));
      supabase.from().select().eq = mockEq;

      const metadata = { author: 'John Doe', genre: 'fantasy' };
      const results = await advancedSearchService.searchByMetadata(metadata);
      
      expect(Array.isArray(results)).toBe(true);
      results.forEach(result => {
        expect(result.story_metadata?.genre).toBe('fantasy');
      });
    });

    it('should filter by source correctly', async () => {
      const { supabase } = require('../../services/supabase');
      const mockEq = jest.fn(() => Promise.resolve({
        data: mockStories.filter(s => s.story_source === 'CreativeBridge'),
        error: null
      }));
      supabase.from().select().eq = mockEq;

      const metadata = { source: 'CreativeBridge' };
      const results = await advancedSearchService.searchByMetadata(metadata, 'user-1');
      
      expect(mockEq).toHaveBeenCalledWith('story_source', 'CreativeBridge');
    });

    it('should filter by grade level', async () => {
      const { supabase } = require('../../services/supabase');
      const mockEq = jest.fn(() => Promise.resolve({
        data: mockStories.filter(s => s.grade_level === 'K-2'),
        error: null
      }));
      supabase.from().select().eq = mockEq;

      const metadata = { gradeLevel: 'K-2' };
      const results = await advancedSearchService.searchByMetadata(metadata);
      
      expect(mockEq).toHaveBeenCalledWith('grade_level', 'K-2');
    });

    it('should filter by date range', async () => {
      const { supabase } = require('../../services/supabase');
      const mockGte = jest.fn(() => ({
        lte: jest.fn(() => Promise.resolve({
          data: mockStories,
          error: null
        }))
      }));
      supabase.from().select().gte = mockGte;

      const metadata = {
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31'
        }
      };
      
      const results = await advancedSearchService.searchByMetadata(metadata);
      
      expect(mockGte).toHaveBeenCalledWith('created_at', '2024-01-01');
    });

    it('should handle metadata search errors', async () => {
      const { supabase } = require('../../services/supabase');
      supabase.from().select().eq = jest.fn(() => Promise.resolve({
        data: null,
        error: { message: 'Metadata search failed' }
      }));

      const metadata = { source: 'CreativeBridge' };
      
      await expect(advancedSearchService.searchByMetadata(metadata))
        .rejects.toThrow('Metadata search failed');
    });
  });

  describe('Search Suggestions', () => {
    it('should provide search suggestions', async () => {
      const partial = 'adven';
      const suggestions = await advancedSearchService.getSuggestions(partial);
      
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
      
      // Should contain 'adventure'
      const adventureSuggestion = suggestions.find(s => s.text.includes('adventure'));
      expect(adventureSuggestion).toBeDefined();
      
      // Verify suggestion structure
      suggestions.forEach(suggestion => {
        expect(suggestion).toHaveProperty('text');
        expect(suggestion).toHaveProperty('type');
        expect(suggestion).toHaveProperty('frequency');
        expect(['query', 'metadata', 'content']).toContain(suggestion.type);
      });
    });

    it('should limit suggestions correctly', async () => {
      const partial = 'st';
      const limit = 5;
      const suggestions = await advancedSearchService.getSuggestions(partial, undefined, limit);
      
      expect(suggestions.length).toBeLessThanOrEqual(limit);
    });

    it('should sort suggestions by frequency', async () => {
      const partial = 'a';
      const suggestions = await advancedSearchService.getSuggestions(partial);
      
      // Suggestions should be sorted by frequency (descending)
      for (let i = 1; i < suggestions.length; i++) {
        expect(suggestions[i].frequency).toBeLessThanOrEqual(suggestions[i-1].frequency);
      }
    });

    it('should include different types of suggestions', async () => {
      const partial = 'K';
      const suggestions = await advancedSearchService.getSuggestions(partial);
      
      const types = new Set(suggestions.map(s => s.type));
      expect(types.size).toBeGreaterThan(1); // Should have multiple types
    });

    it('should handle empty partial input', async () => {
      const suggestions = await advancedSearchService.getSuggestions('');
      
      expect(Array.isArray(suggestions)).toBe(true);
      // Should return some default or popular suggestions
    });

    it('should cache suggestions', async () => {
      const partial = 'dragon';
      
      // First call
      const suggestions1 = await advancedSearchService.getSuggestions(partial);
      
      // Second call (should use cache)
      const suggestions2 = await advancedSearchService.getSuggestions(partial);
      
      expect(suggestions1).toEqual(suggestions2);
    });
  });

  describe('Search History', () => {
    it('should save search to history', async () => {
      const { supabase } = require('../../services/supabase');
      const mockInsert = jest.fn(() => Promise.resolve({
        data: { id: 'new-history-id' },
        error: null
      }));
      supabase.from().insert = mockInsert;

      await advancedSearchService.saveToHistory('dragon adventure', 'user-1', 3);
      
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          query: 'dragon adventure',
          result_count: 3
        })
      );
    });

    it('should get search history', async () => {
      const history = await advancedSearchService.getSearchHistory('user-1');
      
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(0);
      
      // Verify history structure
      history.forEach(entry => {
        expect(entry).toHaveProperty('query');
        expect(entry).toHaveProperty('user_id');
        expect(entry).toHaveProperty('result_count');
        expect(entry).toHaveProperty('timestamp');
      });
    });

    it('should limit search history results', async () => {
      const limit = 10;
      const history = await advancedSearchService.getSearchHistory('user-1', limit);
      
      expect(history.length).toBeLessThanOrEqual(limit);
    });

    it('should handle search history errors gracefully', async () => {
      const { supabase } = require('../../services/supabase');
      supabase.from().select().eq().order().limit = jest.fn(() => Promise.resolve({
        data: null,
        error: { message: 'Table does not exist' }
      }));

      const history = await advancedSearchService.getSearchHistory('user-1');
      
      expect(history).toEqual([]);
    });
  });

  describe('Search Analytics', () => {
    it('should get search analytics', async () => {
      const analytics = await advancedSearchService.getSearchAnalytics();
      
      expect(analytics).toHaveProperty('totalSearches');
      expect(analytics).toHaveProperty('popularQueries');
      expect(analytics).toHaveProperty('averageResultCount');
      expect(analytics).toHaveProperty('searchSuccessRate');
      expect(analytics).toHaveProperty('averageResponseTime');
      
      expect(typeof analytics.totalSearches).toBe('number');
      expect(Array.isArray(analytics.popularQueries)).toBe(true);
      expect(typeof analytics.averageResultCount).toBe('number');
      expect(typeof analytics.searchSuccessRate).toBe('number');
      expect(typeof analytics.averageResponseTime).toBe('number');
    });

    it('should calculate analytics correctly', async () => {
      const analytics = await advancedSearchService.getSearchAnalytics('user-1');
      
      expect(analytics.totalSearches).toBeGreaterThanOrEqual(0);
      expect(analytics.searchSuccessRate).toBeGreaterThanOrEqual(0);
      expect(analytics.searchSuccessRate).toBeLessThanOrEqual(100);
    });

    it('should filter analytics by user', async () => {
      const userAnalytics = await advancedSearchService.getSearchAnalytics('user-1');
      const globalAnalytics = await advancedSearchService.getSearchAnalytics();
      
      // User analytics should be subset of global
      expect(userAnalytics.totalSearches).toBeLessThanOrEqual(globalAnalytics.totalSearches);
    });

    it('should handle analytics errors gracefully', async () => {
      const { supabase } = require('../../services/supabase');
      supabase.from().select = jest.fn(() => Promise.resolve({
        data: null,
        error: { message: 'Analytics table error' }
      }));

      const analytics = await advancedSearchService.getSearchAnalytics();
      
      // Should return default analytics
      expect(analytics.totalSearches).toBe(0);
      expect(analytics.popularQueries).toEqual([]);
    });
  });

  describe('Performance and Optimization', () => {
    it('should handle large datasets efficiently', async () => {
      // Create a large dataset
      const largeDataset = Array(1000).fill(null).map((_, index) => ({
        ...mockStories[0],
        id: `story-${index}`,
        story_content: `Story ${index} with adventure and dragon content for testing search performance`
      }));

      const { supabase } = require('../../services/supabase');
      supabase.from().select().eq = jest.fn(() => Promise.resolve({
        data: largeDataset,
        error: null
      }));

      const startTime = Date.now();
      const results = await advancedSearchService.fullTextSearch('adventure dragon');
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in under 5 seconds
      expect(results.length).toBeGreaterThan(0);
    });

    it('should clear cache when requested', () => {
      advancedSearchService.clearCache();
      
      // Cache should be cleared (no direct way to test, but method should not throw)
      expect(() => advancedSearchService.clearCache()).not.toThrow();
    });

    it('should handle concurrent searches', async () => {
      const { supabase } = require('../../services/supabase');
      supabase.from().select().eq = jest.fn(() => Promise.resolve({
        data: mockStories,
        error: null
      }));

      const searches = [
        advancedSearchService.fullTextSearch('dragon'),
        advancedSearchService.fullTextSearch('adventure'),
        advancedSearchService.fullTextSearch('wizard')
      ];

      const results = await Promise.all(searches);
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(Array.isArray(result)).toBe(true);
      });
    });

    it('should optimize stop word filtering', async () => {
      const { supabase } = require('../../services/supabase');
      supabase.from().select().eq = jest.fn(() => Promise.resolve({
        data: mockStories,
        error: null
      }));

      // Query with many stop words
      const queryWithStopWords = 'the brave dragon and the wizard in a castle';
      const results = await advancedSearchService.fullTextSearch(queryWithStopWords);
      
      // Should still find relevant results despite stop words
      expect(results.length).toBeGreaterThan(0);
      const dragonResult = results.find(r => r.story_content.includes('dragon'));
      expect(dragonResult).toBeDefined();
    });

    it('should handle memory management for cache', async () => {
      const { supabase } = require('../../services/supabase');
      supabase.from().select().eq = jest.fn(() => Promise.resolve({
        data: mockStories,
        error: null
      }));

      // Perform many searches to test cache management
      const searches = [];
      for (let i = 0; i < 150; i++) { // More than MAX_CACHE_SIZE
        searches.push(advancedSearchService.fullTextSearch(`query ${i}`));
      }

      await Promise.all(searches);
      
      // Should not throw memory errors
      expect(true).toBe(true); // If we reach here, memory management worked
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty query strings', async () => {
      const { supabase } = require('../../services/supabase');
      supabase.from().select().eq = jest.fn(() => Promise.resolve({
        data: mockStories,
        error: null
      }));

      const results = await advancedSearchService.fullTextSearch('');
      
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle special characters in queries', async () => {
      const { supabase } = require('../../services/supabase');
      supabase.from().select().eq = jest.fn(() => Promise.resolve({
        data: mockStories,
        error: null
      }));

      const specialQuery = 'dragon@#$%^&*()!';
      const results = await advancedSearchService.fullTextSearch(specialQuery);
      
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle null/undefined in story content', async () => {
      const storiesWithNulls = [
        { ...mockStories[0], story_content: null },
        { ...mockStories[1], story_content: undefined },
        { ...mockStories[2], story_content: '' }
      ];

      const { supabase } = require('../../services/supabase');
      supabase.from().select().eq = jest.fn(() => Promise.resolve({
        data: storiesWithNulls,
        error: null
      }));

      const results = await advancedSearchService.fullTextSearch('dragon');
      
      expect(Array.isArray(results)).toBe(true);
      // Should handle null/undefined content gracefully
    });

    it('should handle malformed metadata', async () => {
      const storiesWithBadMetadata = [
        { ...mockStories[0], story_metadata: null },
        { ...mockStories[1], story_metadata: 'invalid json' },
        { ...mockStories[2], story_metadata: { malformed: undefined } }
      ];

      const { supabase } = require('../../services/supabase');
      supabase.from().select().eq = jest.fn(() => Promise.resolve({
        data: storiesWithBadMetadata,
        error: null
      }));

      const results = await advancedSearchService.fullTextSearch('dragon');
      
      expect(Array.isArray(results)).toBe(true);
      // Should handle malformed metadata gracefully
    });

    it('should handle network timeouts', async () => {
      const { supabase } = require('../../services/supabase');
      supabase.from().select().eq = jest.fn(() => 
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
      );

      await expect(advancedSearchService.fullTextSearch('dragon'))
        .rejects.toThrow('Search failed');
    });
  });
});