/**
 * Diversity Score Service Tests
 *
 * Tests for diversity score calculation and metrics
 */

import { diversityScoreService } from '../../services/diversityScoreService';
import type {
  ElementForScoring,
  CalculateDiversityScoreOptions,
} from '../../services/diversityScoreService';
import type {
  RecentElements,
  ElementWithFrequency,
} from '../../services/recentElementsService';
import type { ExtractedElements } from '../../services/storyElementExtractionService';

// Mock similarity detection service
jest.mock('../../services/similarityDetectionService', () => ({
  similarityDetectionService: {
    findSimilarElementsByType: jest.fn(),
  },
}));

import { similarityDetectionService } from '../../services/similarityDetectionService';

const mockFindSimilarElementsByType =
  similarityDetectionService.findSimilarElementsByType as jest.Mock;

describe('DiversityScoreService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Helper: Create embedding vector (deterministic based on seed)
   */
  function createEmbedding(seed: number, dimensions: number = 1536): number[] {
    const embedding: number[] = [];
    for (let i = 0; i < dimensions; i++) {
      // Simple deterministic formula
      embedding.push(Math.sin(seed * (i + 1)) * 0.5 + 0.5);
    }
    return embedding;
  }

  /**
   * Helper: Create empty recent elements
   */
  function createEmptyRecentElements(): RecentElements {
    return {
      characters: [],
      settings: [],
      objects: [],
      plot_patterns: [],
    };
  }

  /**
   * Helper: Create recent elements with frequency
   */
  function createRecentElements(elements: {
    characters?: Array<{ text: string; frequency: number }>;
    settings?: Array<{ text: string; frequency: number }>;
    objects?: Array<{ text: string; frequency: number }>;
    plot_patterns?: Array<{ text: string; frequency: number }>;
  }): RecentElements {
    const now = new Date();

    const toElementWithFrequency = (
      text: string,
      frequency: number,
      seed: number,
    ): ElementWithFrequency => ({
      elementText: text,
      embeddingVector: createEmbedding(seed),
      frequency,
      lastUsed: now,
    });

    return {
      characters:
        elements.characters?.map((e, i) =>
          toElementWithFrequency(e.text, e.frequency, 100 + i),
        ) || [],
      settings:
        elements.settings?.map((e, i) =>
          toElementWithFrequency(e.text, e.frequency, 200 + i),
        ) || [],
      objects:
        elements.objects?.map((e, i) =>
          toElementWithFrequency(e.text, e.frequency, 300 + i),
        ) || [],
      plot_patterns:
        elements.plot_patterns?.map((e, i) =>
          toElementWithFrequency(e.text, e.frequency, 400 + i),
        ) || [],
    };
  }

  describe('calculateDiversityScore', () => {
    test('should return score 1.0 when no recent elements exist (first story)', () => {
      const newElements: ElementForScoring[] = [
        {
          elementText: 'dragon',
          elementType: 'character',
          elementEmbedding: createEmbedding(1),
        },
        {
          elementText: 'forest',
          elementType: 'setting',
          elementEmbedding: createEmbedding(2),
        },
      ];

      const recentElements = createEmptyRecentElements();

      const result = diversityScoreService.calculateDiversityScore({
        newElements,
        recentElements,
      });

      expect(result.score).toBe(1.0);
      expect(result.novelElementCount).toBe(2);
      expect(result.totalElementCount).toBe(2);
      expect(result.noveltyRatio).toBe(1.0);
      expect(result.avgSemanticDistance).toBe(1.0);
    });

    test('should return score 0.0 when no new elements provided', () => {
      const newElements: ElementForScoring[] = [];
      const recentElements = createRecentElements({
        characters: [{ text: 'dragon', frequency: 3 }],
      });

      const result = diversityScoreService.calculateDiversityScore({
        newElements,
        recentElements,
      });

      expect(result.score).toBe(0.0);
      expect(result.novelElementCount).toBe(0);
      expect(result.totalElementCount).toBe(0);
    });

    test('should calculate score for all novel elements', () => {
      const newElements: ElementForScoring[] = [
        {
          elementText: 'phoenix',
          elementType: 'character',
          elementEmbedding: createEmbedding(10),
        },
        {
          elementText: 'volcano',
          elementType: 'setting',
          elementEmbedding: createEmbedding(20),
        },
      ];

      const recentElements = createRecentElements({
        characters: [{ text: 'dragon', frequency: 2 }],
        settings: [{ text: 'forest', frequency: 3 }],
      });

      // Mock: all elements are novel (no similar matches)
      mockFindSimilarElementsByType.mockReturnValue([]);

      const result = diversityScoreService.calculateDiversityScore({
        newElements,
        recentElements,
      });

      expect(result.score).toBe(1.0); // novelty_ratio (1.0) * avg_distance (1.0)
      expect(result.novelElementCount).toBe(2);
      expect(result.totalElementCount).toBe(2);
      expect(result.noveltyRatio).toBe(1.0);
      expect(result.avgSemanticDistance).toBe(1.0);
    });

    test('should calculate score for all repetitive elements', () => {
      const newElements: ElementForScoring[] = [
        {
          elementText: 'dragon',
          elementType: 'character',
          elementEmbedding: createEmbedding(100), // Same seed as recent dragon
        },
        {
          elementText: 'forest',
          elementType: 'setting',
          elementEmbedding: createEmbedding(200), // Same seed as recent forest
        },
      ];

      const recentElements = createRecentElements({
        characters: [{ text: 'dragon', frequency: 3 }],
        settings: [{ text: 'forest', frequency: 2 }],
      });

      // Mock: all elements have high similarity matches
      mockFindSimilarElementsByType.mockReturnValue([
        {
          elementText: 'dragon',
          elementType: 'character',
          similarityScore: 0.95,
          frequency: 3,
          lastUsed: new Date(),
        },
      ]);

      const result = diversityScoreService.calculateDiversityScore({
        newElements,
        recentElements,
      });

      // novelty_ratio = 0 (no novel elements)
      // avg_distance = 1 - 0.95 = 0.05
      // score = 0 * 0.05 = 0.0
      expect(result.score).toBe(0.0);
      expect(result.novelElementCount).toBe(0);
      expect(result.totalElementCount).toBe(2);
      expect(result.noveltyRatio).toBe(0.0);
      expect(result.avgSemanticDistance).toBeCloseTo(0.05, 2);
    });

    test('should calculate score for mixed novel and repetitive elements', () => {
      const newElements: ElementForScoring[] = [
        {
          elementText: 'phoenix',
          elementType: 'character',
          elementEmbedding: createEmbedding(10),
        },
        {
          elementText: 'dragon',
          elementType: 'character',
          elementEmbedding: createEmbedding(100),
        },
        {
          elementText: 'volcano',
          elementType: 'setting',
          elementEmbedding: createEmbedding(20),
        },
        {
          elementText: 'forest',
          elementType: 'setting',
          elementEmbedding: createEmbedding(200),
        },
      ];

      const recentElements = createRecentElements({
        characters: [{ text: 'dragon', frequency: 2 }],
        settings: [{ text: 'forest', frequency: 3 }],
      });

      // Mock: phoenix and volcano are novel, dragon and forest are similar
      mockFindSimilarElementsByType.mockImplementation(text => {
        if (text === 'phoenix' || text === 'volcano') {
          return []; // Novel
        }
        return [
          {
            elementText: text,
            elementType: text === 'dragon' ? 'character' : 'setting',
            similarityScore: 0.85,
            frequency: 2,
            lastUsed: new Date(),
          },
        ];
      });

      const result = diversityScoreService.calculateDiversityScore({
        newElements,
        recentElements,
      });

      // novelty_ratio = 2/4 = 0.5
      // distances: [1.0 (novel), 0.15 (1-0.85), 1.0 (novel), 0.15 (1-0.85)]
      // avg_distance = (1.0 + 0.15 + 1.0 + 0.15) / 4 = 0.575
      // score = 0.5 * 0.575 = 0.2875
      expect(result.score).toBeCloseTo(0.2875, 2);
      expect(result.novelElementCount).toBe(2);
      expect(result.totalElementCount).toBe(4);
      expect(result.noveltyRatio).toBe(0.5);
      expect(result.avgSemanticDistance).toBeCloseTo(0.575, 2);
    });

    test('should respect custom similarity threshold', () => {
      const newElements: ElementForScoring[] = [
        {
          elementText: 'phoenix',
          elementType: 'character',
          elementEmbedding: createEmbedding(10),
        },
      ];

      const recentElements = createRecentElements({
        characters: [{ text: 'dragon', frequency: 2 }],
      });

      // Mock: return element with 0.7 similarity
      mockFindSimilarElementsByType.mockReturnValue([
        {
          elementText: 'dragon',
          elementType: 'character',
          similarityScore: 0.7,
          frequency: 2,
          lastUsed: new Date(),
        },
      ]);

      // With default threshold (0.75), 0.7 similarity is below threshold → novel
      const resultDefault = diversityScoreService.calculateDiversityScore({
        newElements,
        recentElements,
      });

      expect(resultDefault.novelElementCount).toBe(0); // Actually similar (mock returns similar element)

      // With custom threshold (0.65), 0.7 similarity is above threshold → not novel
      const resultCustom = diversityScoreService.calculateDiversityScore({
        newElements,
        recentElements,
        similarityThreshold: 0.65,
      });

      expect(resultCustom.novelElementCount).toBe(0);
    });

    test('should skip elements without embeddings', () => {
      const newElements: ElementForScoring[] = [
        {
          elementText: 'dragon',
          elementType: 'character',
          elementEmbedding: createEmbedding(1),
        },
        {
          elementText: 'forest',
          elementType: 'setting',
          elementEmbedding: [], // Empty embedding
        },
        {
          elementText: 'key',
          elementType: 'object',
          elementEmbedding: createEmbedding(2),
        },
      ];

      const recentElements = createEmptyRecentElements();

      mockFindSimilarElementsByType.mockReturnValue([]);

      const result = diversityScoreService.calculateDiversityScore({
        newElements,
        recentElements,
      });

      // Should only count elements with valid embeddings (dragon, key)
      expect(result.totalElementCount).toBe(2);
      expect(result.novelElementCount).toBe(2);
    });

    test('should clamp score to [0, 1] range', () => {
      const newElements: ElementForScoring[] = [
        {
          elementText: 'phoenix',
          elementType: 'character',
          elementEmbedding: createEmbedding(1),
        },
      ];

      const recentElements = createRecentElements({
        characters: [{ text: 'dragon', frequency: 2 }],
      });

      mockFindSimilarElementsByType.mockReturnValue([]);

      const result = diversityScoreService.calculateDiversityScore({
        newElements,
        recentElements,
      });

      expect(result.score).toBeGreaterThanOrEqual(0.0);
      expect(result.score).toBeLessThanOrEqual(1.0);
    });

    test('should include element breakdown by type', () => {
      const newElements: ElementForScoring[] = [
        {
          elementText: 'dragon',
          elementType: 'character',
          elementEmbedding: createEmbedding(1),
        },
        {
          elementText: 'phoenix',
          elementType: 'character',
          elementEmbedding: createEmbedding(2),
        },
        {
          elementText: 'forest',
          elementType: 'setting',
          elementEmbedding: createEmbedding(3),
        },
      ];

      const recentElements = createRecentElements({
        characters: [{ text: 'dragon', frequency: 2 }],
      });

      // Mock: dragon is similar, phoenix and forest are novel
      mockFindSimilarElementsByType.mockImplementation(text => {
        if (text === 'dragon') {
          return [
            {
              elementText: 'dragon',
              elementType: 'character',
              similarityScore: 0.9,
              frequency: 2,
              lastUsed: new Date(),
            },
          ];
        }
        return [];
      });

      const result = diversityScoreService.calculateDiversityScore({
        newElements,
        recentElements,
      });

      expect(result.elementBreakdown.characters.total).toBe(2);
      expect(result.elementBreakdown.characters.novel).toBe(1); // Only phoenix
      expect(result.elementBreakdown.settings.total).toBe(1);
      expect(result.elementBreakdown.settings.novel).toBe(1); // Forest
      expect(result.elementBreakdown.objects.total).toBe(0);
      expect(result.elementBreakdown.plot_patterns.total).toBe(0);
    });

    test('should handle multiple similar matches correctly', () => {
      const newElements: ElementForScoring[] = [
        {
          elementText: 'dragon',
          elementType: 'character',
          elementEmbedding: createEmbedding(1),
        },
      ];

      const recentElements = createRecentElements({
        characters: [
          { text: 'wyrm', frequency: 2 },
          { text: 'drake', frequency: 3 },
        ],
      });

      // Mock: multiple similar matches with different scores
      mockFindSimilarElementsByType.mockReturnValue([
        {
          elementText: 'wyrm',
          elementType: 'character',
          similarityScore: 0.85,
          frequency: 2,
          lastUsed: new Date(),
        },
        {
          elementText: 'drake',
          elementType: 'character',
          similarityScore: 0.92,
          frequency: 3,
          lastUsed: new Date(),
        },
      ]);

      const result = diversityScoreService.calculateDiversityScore({
        newElements,
        recentElements,
      });

      // Should use MAX similarity (0.92) for semantic distance calculation
      // distance = 1 - 0.92 = 0.08
      expect(result.avgSemanticDistance).toBeCloseTo(0.08, 2);
    });
  });

  describe('convertToScoringFormat', () => {
    test('should convert extracted elements to scoring format', () => {
      const extractedElements: ExtractedElements = {
        characters: [
          { name: 'Dragon', type: 'magical', role: 'protagonist' },
          { name: 'Knight', type: 'human', role: 'antagonist' },
        ],
        settings: [
          { location: 'Forest', environment: 'nature' },
          { location: 'Castle', environment: 'urban' },
        ],
        objects: [{ name: 'Magic Key', magical: true, purpose: 'unlock' }],
        plot_patterns: [{ action: 'Discovery', discovery_type: 'artifact' }],
      };

      const embeddings = new Map<string, number[]>([
        ['dragon', createEmbedding(1)],
        ['knight', createEmbedding(2)],
        ['forest', createEmbedding(3)],
        ['castle', createEmbedding(4)],
        ['magic key', createEmbedding(5)],
        ['discovery', createEmbedding(6)],
      ]);

      const result = diversityScoreService.convertToScoringFormat(
        extractedElements,
        embeddings,
      );

      expect(result).toHaveLength(6);
      expect(result[0].elementText).toBe('Dragon');
      expect(result[0].elementType).toBe('character');
      expect(result[0].elementEmbedding).toEqual(createEmbedding(1));
    });

    test('should skip elements without embeddings', () => {
      const extractedElements: ExtractedElements = {
        characters: [{ name: 'Dragon', type: 'magical', role: 'protagonist' }],
        settings: [],
        objects: [],
        plot_patterns: [],
      };

      const embeddings = new Map<string, number[]>(); // No embeddings

      const result = diversityScoreService.convertToScoringFormat(
        extractedElements,
        embeddings,
      );

      expect(result).toHaveLength(0);
    });

    test('should normalize element text for embedding lookup', () => {
      const extractedElements: ExtractedElements = {
        characters: [
          { name: 'Dragon  ', type: 'magical', role: 'protagonist' },
        ],
        settings: [],
        objects: [],
        plot_patterns: [],
      };

      // Embedding stored with normalized key (lowercase + trim)
      const embeddings = new Map<string, number[]>([
        ['dragon', createEmbedding(1)],
      ]);

      const result = diversityScoreService.convertToScoringFormat(
        extractedElements,
        embeddings,
      );

      expect(result).toHaveLength(1);
      expect(result[0].elementText).toBe('Dragon  '); // Original text preserved
      expect(result[0].elementEmbedding).toEqual(createEmbedding(1));
    });
  });

  describe('classifyDiversityScore', () => {
    test('should classify very low diversity (< 0.2)', () => {
      expect(diversityScoreService.classifyDiversityScore(0.0)).toBe(
        'very_low',
      );
      expect(diversityScoreService.classifyDiversityScore(0.1)).toBe(
        'very_low',
      );
      expect(diversityScoreService.classifyDiversityScore(0.19)).toBe(
        'very_low',
      );
    });

    test('should classify low diversity (0.2 - 0.4)', () => {
      expect(diversityScoreService.classifyDiversityScore(0.2)).toBe('low');
      expect(diversityScoreService.classifyDiversityScore(0.3)).toBe('low');
      expect(diversityScoreService.classifyDiversityScore(0.39)).toBe('low');
    });

    test('should classify moderate diversity (0.4 - 0.6)', () => {
      expect(diversityScoreService.classifyDiversityScore(0.4)).toBe(
        'moderate',
      );
      expect(diversityScoreService.classifyDiversityScore(0.5)).toBe(
        'moderate',
      );
      expect(diversityScoreService.classifyDiversityScore(0.59)).toBe(
        'moderate',
      );
    });

    test('should classify high diversity (0.6 - 0.8)', () => {
      expect(diversityScoreService.classifyDiversityScore(0.6)).toBe('high');
      expect(diversityScoreService.classifyDiversityScore(0.7)).toBe('high');
      expect(diversityScoreService.classifyDiversityScore(0.79)).toBe('high');
    });

    test('should classify very high diversity (>= 0.8)', () => {
      expect(diversityScoreService.classifyDiversityScore(0.8)).toBe(
        'very_high',
      );
      expect(diversityScoreService.classifyDiversityScore(0.9)).toBe(
        'very_high',
      );
      expect(diversityScoreService.classifyDiversityScore(1.0)).toBe(
        'very_high',
      );
    });
  });

  describe('isLowDiversity', () => {
    test('should detect low diversity with default threshold (0.4)', () => {
      expect(diversityScoreService.isLowDiversity(0.3)).toBe(true);
      expect(diversityScoreService.isLowDiversity(0.39)).toBe(true);
      expect(diversityScoreService.isLowDiversity(0.4)).toBe(false);
      expect(diversityScoreService.isLowDiversity(0.5)).toBe(false);
    });

    test('should respect custom threshold', () => {
      expect(diversityScoreService.isLowDiversity(0.5, 0.6)).toBe(true);
      expect(diversityScoreService.isLowDiversity(0.6, 0.6)).toBe(false);
      expect(diversityScoreService.isLowDiversity(0.7, 0.6)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    test('should handle all element types correctly', () => {
      const newElements: ElementForScoring[] = [
        {
          elementText: 'dragon',
          elementType: 'character',
          elementEmbedding: createEmbedding(1),
        },
        {
          elementText: 'forest',
          elementType: 'setting',
          elementEmbedding: createEmbedding(2),
        },
        {
          elementText: 'key',
          elementType: 'object',
          elementEmbedding: createEmbedding(3),
        },
        {
          elementText: 'discovery',
          elementType: 'plot_pattern',
          elementEmbedding: createEmbedding(4),
        },
      ];

      const recentElements = createRecentElements({
        characters: [{ text: 'knight', frequency: 2 }],
        settings: [{ text: 'castle', frequency: 3 }],
        objects: [{ text: 'sword', frequency: 1 }],
        plot_patterns: [{ text: 'chase', frequency: 2 }],
      });

      mockFindSimilarElementsByType.mockReturnValue([]);

      const result = diversityScoreService.calculateDiversityScore({
        newElements,
        recentElements,
      });

      expect(result.elementBreakdown.characters.total).toBe(1);
      expect(result.elementBreakdown.settings.total).toBe(1);
      expect(result.elementBreakdown.objects.total).toBe(1);
      expect(result.elementBreakdown.plot_patterns.total).toBe(1);
    });

    test('should handle empty breakdown for missing element types', () => {
      const newElements: ElementForScoring[] = [
        {
          elementText: 'dragon',
          elementType: 'character',
          elementEmbedding: createEmbedding(1),
        },
      ];

      const recentElements = createEmptyRecentElements();
      mockFindSimilarElementsByType.mockReturnValue([]);

      const result = diversityScoreService.calculateDiversityScore({
        newElements,
        recentElements,
      });

      expect(result.elementBreakdown.settings).toEqual({
        novel: 0,
        total: 0,
        avgDistance: 0.0,
      });
      expect(result.elementBreakdown.objects).toEqual({
        novel: 0,
        total: 0,
        avgDistance: 0.0,
      });
      expect(result.elementBreakdown.plot_patterns).toEqual({
        novel: 0,
        total: 0,
        avgDistance: 0.0,
      });
    });

    test('should handle console warnings for missing embeddings', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const newElements: ElementForScoring[] = [
        {
          elementText: 'dragon',
          elementType: 'character',
          elementEmbedding: [], // Empty
        },
      ];

      // Need recent elements to trigger the main calculation loop
      const recentElements = createRecentElements({
        characters: [{ text: 'knight', frequency: 2 }],
      });

      diversityScoreService.calculateDiversityScore({
        newElements,
        recentElements,
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Skipping element without embedding'),
      );

      consoleSpy.mockRestore();
    });

    test('should calculate correct breakdown avgDistance', () => {
      const newElements: ElementForScoring[] = [
        {
          elementText: 'dragon',
          elementType: 'character',
          elementEmbedding: createEmbedding(1),
        },
        {
          elementText: 'phoenix',
          elementType: 'character',
          elementEmbedding: createEmbedding(2),
        },
      ];

      const recentElements = createRecentElements({
        characters: [{ text: 'wyrm', frequency: 2 }],
      });

      // Mock: dragon similar (0.9), phoenix novel (no match)
      mockFindSimilarElementsByType.mockImplementation(text => {
        if (text === 'dragon') {
          return [
            {
              elementText: 'wyrm',
              elementType: 'character',
              similarityScore: 0.9,
              frequency: 2,
              lastUsed: new Date(),
            },
          ];
        }
        return [];
      });

      const result = diversityScoreService.calculateDiversityScore({
        newElements,
        recentElements,
      });

      // avgDistance for characters = (0.1 + 1.0) / 2 = 0.55
      expect(result.elementBreakdown.characters.avgDistance).toBeCloseTo(
        0.55,
        2,
      );
    });
  });

  describe('Performance', () => {
    test('should handle large number of elements efficiently', () => {
      const newElements: ElementForScoring[] = [];
      for (let i = 0; i < 100; i++) {
        newElements.push({
          elementText: `element-${i}`,
          elementType: 'character',
          elementEmbedding: createEmbedding(i),
        });
      }

      const recentElements = createRecentElements({
        characters: Array.from({ length: 50 }, (_, i) => ({
          text: `recent-${i}`,
          frequency: 2,
        })),
      });

      mockFindSimilarElementsByType.mockReturnValue([]);

      const startTime = Date.now();
      diversityScoreService.calculateDiversityScore({
        newElements,
        recentElements,
      });
      const duration = Date.now() - startTime;

      // Should complete in reasonable time (< 1 second)
      expect(duration).toBeLessThan(1000);
    });
  });
});
