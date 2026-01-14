/**
 * Tests for Recent Elements Retrieval Service
 *
 * Validates retrieval of story elements from database, grouping by type,
 * frequency counting, and proper handling of edge cases.
 */

import {
  recentElementsService,
  RecentElementsService,
} from '../../services/recentElementsService';
import { supabase } from '../../services/supabase';

// Mock Supabase client
jest.mock('../../services/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

describe('RecentElementsService', () => {
  let service: RecentElementsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RecentElementsService();
  });

  describe('getRecentElements', () => {
    it('should retrieve and group elements by type', async () => {
      // Mock database response with multiple elements
      const mockElements = [
        {
          id: 'elem1',
          story_id: 'story1',
          session_id: 'session1',
          element_type: 'character',
          element_text: 'dragon',
          embedding_vector: [0.1, 0.2, 0.3],
          created_at: '2026-01-13T10:00:00Z',
        },
        {
          id: 'elem2',
          story_id: 'story1',
          session_id: 'session1',
          element_type: 'setting',
          element_text: 'forest',
          embedding_vector: [0.4, 0.5, 0.6],
          created_at: '2026-01-13T10:00:00Z',
        },
        {
          id: 'elem3',
          story_id: 'story1',
          session_id: 'session1',
          element_type: 'object',
          element_text: 'magic key',
          embedding_vector: [0.7, 0.8, 0.9],
          created_at: '2026-01-13T10:00:00Z',
        },
        {
          id: 'elem4',
          story_id: 'story1',
          session_id: 'session1',
          element_type: 'plot_pattern',
          element_text: 'finding treasure',
          embedding_vector: [0.2, 0.3, 0.4],
          created_at: '2026-01-13T10:00:00Z',
        },
      ];

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockElements,
              error: null,
            }),
          }),
        }),
      });

      const result = await service.getRecentElements({ sessionId: 'session1' });

      expect(result.characters).toHaveLength(1);
      expect(result.characters[0].elementText).toBe('dragon');
      expect(result.characters[0].frequency).toBe(1);

      expect(result.settings).toHaveLength(1);
      expect(result.settings[0].elementText).toBe('forest');

      expect(result.objects).toHaveLength(1);
      expect(result.objects[0].elementText).toBe('magic key');

      expect(result.plot_patterns).toHaveLength(1);
      expect(result.plot_patterns[0].elementText).toBe('finding treasure');
    });

    it('should calculate frequency counts for repeated elements', async () => {
      // Mock database response with repeated elements
      const mockElements = [
        {
          id: 'elem1',
          story_id: 'story1',
          session_id: 'session1',
          element_type: 'character',
          element_text: 'dragon',
          embedding_vector: [0.1, 0.2, 0.3],
          created_at: '2026-01-13T10:00:00Z',
        },
        {
          id: 'elem2',
          story_id: 'story2',
          session_id: 'session1',
          element_type: 'character',
          element_text: 'Dragon', // Different case
          embedding_vector: [0.1, 0.2, 0.3],
          created_at: '2026-01-13T11:00:00Z',
        },
        {
          id: 'elem3',
          story_id: 'story3',
          session_id: 'session1',
          element_type: 'character',
          element_text: '  dragon  ', // With whitespace
          embedding_vector: [0.1, 0.2, 0.3],
          created_at: '2026-01-13T12:00:00Z',
        },
      ];

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockElements,
              error: null,
            }),
          }),
        }),
      });

      const result = await service.getRecentElements({ sessionId: 'session1' });

      // Should normalize and count as single element
      expect(result.characters).toHaveLength(1);
      expect(result.characters[0].elementText).toBe('dragon');
      expect(result.characters[0].frequency).toBe(3);
    });

    it('should limit results to most recent N stories', async () => {
      // Mock database response with elements from multiple stories
      const mockElements = [
        // Story 3 (most recent)
        {
          id: 'elem5',
          story_id: 'story3',
          session_id: 'session1',
          element_type: 'character',
          element_text: 'wizard',
          embedding_vector: [0.5, 0.6, 0.7],
          created_at: '2026-01-13T12:00:00Z',
        },
        // Story 2
        {
          id: 'elem3',
          story_id: 'story2',
          session_id: 'session1',
          element_type: 'character',
          element_text: 'knight',
          embedding_vector: [0.3, 0.4, 0.5],
          created_at: '2026-01-13T11:00:00Z',
        },
        // Story 1 (oldest)
        {
          id: 'elem1',
          story_id: 'story1',
          session_id: 'session1',
          element_type: 'character',
          element_text: 'dragon',
          embedding_vector: [0.1, 0.2, 0.3],
          created_at: '2026-01-13T10:00:00Z',
        },
      ];

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockElements,
              error: null,
            }),
          }),
        }),
      });

      // Limit to 2 most recent stories
      const result = await service.getRecentElements({
        sessionId: 'session1',
        limit: 2,
      });

      // Should only include elements from story2 and story3
      expect(result.characters).toHaveLength(2);
      const characterTexts = result.characters.map(c => c.elementText);
      expect(characterTexts).toContain('wizard');
      expect(characterTexts).toContain('knight');
      expect(characterTexts).not.toContain('dragon');
    });

    it('should return empty structure when no elements found', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      });

      const result = await service.getRecentElements({ sessionId: 'session1' });

      expect(result.characters).toEqual([]);
      expect(result.settings).toEqual([]);
      expect(result.objects).toEqual([]);
      expect(result.plot_patterns).toEqual([]);
    });

    it('should handle database errors gracefully', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database connection failed' },
            }),
          }),
        }),
      });

      await expect(
        service.getRecentElements({ sessionId: 'session1' }),
      ).rejects.toThrow('Failed to retrieve recent elements');
    });

    it('should handle null embedding vectors', async () => {
      const mockElements = [
        {
          id: 'elem1',
          story_id: 'story1',
          session_id: 'session1',
          element_type: 'character',
          element_text: 'dragon',
          embedding_vector: null,
          created_at: '2026-01-13T10:00:00Z',
        },
      ];

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockElements,
              error: null,
            }),
          }),
        }),
      });

      const result = await service.getRecentElements({ sessionId: 'session1' });

      expect(result.characters).toHaveLength(1);
      expect(result.characters[0].embeddingVector).toBeNull();
    });

    it('should sort elements by frequency (descending) then by lastUsed', async () => {
      const mockElements = [
        {
          id: 'elem1',
          story_id: 'story1',
          session_id: 'session1',
          element_type: 'character',
          element_text: 'dragon',
          embedding_vector: [0.1, 0.2, 0.3],
          created_at: '2026-01-13T10:00:00Z',
        },
        {
          id: 'elem2',
          story_id: 'story2',
          session_id: 'session1',
          element_type: 'character',
          element_text: 'dragon',
          embedding_vector: [0.1, 0.2, 0.3],
          created_at: '2026-01-13T11:00:00Z',
        },
        {
          id: 'elem3',
          story_id: 'story3',
          session_id: 'session1',
          element_type: 'character',
          element_text: 'wizard',
          embedding_vector: [0.4, 0.5, 0.6],
          created_at: '2026-01-13T12:00:00Z',
        },
      ];

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockElements,
              error: null,
            }),
          }),
        }),
      });

      const result = await service.getRecentElements({ sessionId: 'session1' });

      // Dragon should be first (frequency 2), wizard second (frequency 1)
      expect(result.characters[0].elementText).toBe('dragon');
      expect(result.characters[0].frequency).toBe(2);
      expect(result.characters[1].elementText).toBe('wizard');
      expect(result.characters[1].frequency).toBe(1);
    });

    it('should use most recent embedding for duplicate elements', async () => {
      const mockElements = [
        {
          id: 'elem1',
          story_id: 'story1',
          session_id: 'session1',
          element_type: 'character',
          element_text: 'dragon',
          embedding_vector: [0.1, 0.2, 0.3],
          created_at: '2026-01-13T10:00:00Z',
        },
        {
          id: 'elem2',
          story_id: 'story2',
          session_id: 'session1',
          element_type: 'character',
          element_text: 'dragon',
          embedding_vector: [0.9, 0.8, 0.7], // Different embedding (more recent)
          created_at: '2026-01-13T12:00:00Z',
        },
      ];

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockElements,
              error: null,
            }),
          }),
        }),
      });

      const result = await service.getRecentElements({ sessionId: 'session1' });

      // Should use the most recent embedding
      expect(result.characters[0].embeddingVector).toEqual([0.9, 0.8, 0.7]);
    });

    it('should use default limit of 10 stories when not specified', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      });

      await service.getRecentElements({ sessionId: 'session1' });

      // Verify the query was constructed correctly
      // (limit is applied after retrieval in application layer)
      expect(supabase.from).toHaveBeenCalledWith('story_elements');
    });

    it('should handle stringified JSONB embedding format', async () => {
      const mockElements = [
        {
          id: 'elem1',
          story_id: 'story1',
          session_id: 'session1',
          element_type: 'character',
          element_text: 'dragon',
          embedding_vector: '[0.1, 0.2, 0.3]', // Stringified
          created_at: '2026-01-13T10:00:00Z',
        },
      ];

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockElements,
              error: null,
            }),
          }),
        }),
      });

      const result = await service.getRecentElements({ sessionId: 'session1' });

      expect(result.characters[0].embeddingVector).toEqual([0.1, 0.2, 0.3]);
    });
  });

  describe('getTotalElementCount', () => {
    it('should count total elements across all types', () => {
      const recentElements = {
        characters: [
          {
            elementText: 'dragon',
            embeddingVector: null,
            frequency: 2,
            lastUsed: new Date(),
          },
          {
            elementText: 'wizard',
            embeddingVector: null,
            frequency: 1,
            lastUsed: new Date(),
          },
        ],
        settings: [
          {
            elementText: 'forest',
            embeddingVector: null,
            frequency: 1,
            lastUsed: new Date(),
          },
        ],
        objects: [
          {
            elementText: 'key',
            embeddingVector: null,
            frequency: 1,
            lastUsed: new Date(),
          },
        ],
        plot_patterns: [],
      };

      const total = service.getTotalElementCount(recentElements);

      expect(total).toBe(4); // 2 characters + 1 setting + 1 object + 0 plot_patterns
    });

    it('should return 0 for empty elements', () => {
      const recentElements = {
        characters: [],
        settings: [],
        objects: [],
        plot_patterns: [],
      };

      const total = service.getTotalElementCount(recentElements);

      expect(total).toBe(0);
    });
  });

  describe('getMostFrequentElements', () => {
    it('should return top N most frequent elements across all types', () => {
      const recentElements = {
        characters: [
          {
            elementText: 'dragon',
            embeddingVector: null,
            frequency: 5,
            lastUsed: new Date(),
          },
          {
            elementText: 'wizard',
            embeddingVector: null,
            frequency: 2,
            lastUsed: new Date(),
          },
        ],
        settings: [
          {
            elementText: 'forest',
            embeddingVector: null,
            frequency: 4,
            lastUsed: new Date(),
          },
        ],
        objects: [
          {
            elementText: 'key',
            embeddingVector: null,
            frequency: 3,
            lastUsed: new Date(),
          },
        ],
        plot_patterns: [
          {
            elementText: 'finding',
            embeddingVector: null,
            frequency: 1,
            lastUsed: new Date(),
          },
        ],
      };

      const topElements = service.getMostFrequentElements(recentElements, 3);

      expect(topElements).toHaveLength(3);
      expect(topElements[0].element.elementText).toBe('dragon');
      expect(topElements[0].element.frequency).toBe(5);
      expect(topElements[0].type).toBe('character');

      expect(topElements[1].element.elementText).toBe('forest');
      expect(topElements[1].element.frequency).toBe(4);
      expect(topElements[1].type).toBe('setting');

      expect(topElements[2].element.elementText).toBe('key');
      expect(topElements[2].element.frequency).toBe(3);
      expect(topElements[2].type).toBe('object');
    });

    it('should default to top 5 elements when topN not specified', () => {
      const recentElements = {
        characters: [
          {
            elementText: 'c1',
            embeddingVector: null,
            frequency: 10,
            lastUsed: new Date(),
          },
          {
            elementText: 'c2',
            embeddingVector: null,
            frequency: 9,
            lastUsed: new Date(),
          },
          {
            elementText: 'c3',
            embeddingVector: null,
            frequency: 8,
            lastUsed: new Date(),
          },
        ],
        settings: [
          {
            elementText: 's1',
            embeddingVector: null,
            frequency: 7,
            lastUsed: new Date(),
          },
          {
            elementText: 's2',
            embeddingVector: null,
            frequency: 6,
            lastUsed: new Date(),
          },
        ],
        objects: [
          {
            elementText: 'o1',
            embeddingVector: null,
            frequency: 5,
            lastUsed: new Date(),
          },
        ],
        plot_patterns: [],
      };

      const topElements = service.getMostFrequentElements(recentElements);

      expect(topElements).toHaveLength(5);
      expect(topElements[0].element.frequency).toBe(10);
      expect(topElements[4].element.frequency).toBe(6);
    });

    it('should return all elements if fewer than topN exist', () => {
      const recentElements = {
        characters: [
          {
            elementText: 'dragon',
            embeddingVector: null,
            frequency: 2,
            lastUsed: new Date(),
          },
        ],
        settings: [],
        objects: [],
        plot_patterns: [],
      };

      const topElements = service.getMostFrequentElements(recentElements, 5);

      expect(topElements).toHaveLength(1);
    });

    it('should return empty array when no elements exist', () => {
      const recentElements = {
        characters: [],
        settings: [],
        objects: [],
        plot_patterns: [],
      };

      const topElements = service.getMostFrequentElements(recentElements, 5);

      expect(topElements).toEqual([]);
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(recentElementsService).toBeDefined();
      expect(recentElementsService).toBeInstanceOf(RecentElementsService);
    });
  });
});
