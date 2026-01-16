/**
 * Tests for Similarity Detection Service
 *
 * Tests semantic similarity detection between new story elements and recent history
 */

import {
  similarityDetectionService,
  SimilarityDetectionService,
  type ElementToCheck,
} from '../../services/similarityDetectionService';
import type { RecentElements } from '../../services/recentElementsService';

describe('SimilarityDetectionService', () => {
  let service: SimilarityDetectionService;

  beforeEach(() => {
    service = new SimilarityDetectionService();
    // Clear any console warnings to avoid noise in test output
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Helper: Create mock embedding (simplified for testing)
  const createEmbedding = (seed: number): number[] => {
    const embedding: number[] = [];
    for (let i = 0; i < 1536; i++) {
      // Deterministic but varied values based on seed
      embedding.push(Math.sin(seed + i * 0.1));
    }
    return embedding;
  };

  // Helper: Create similar embedding (slight variation)
  const createSimilarEmbedding = (baseEmbedding: number[]): number[] => {
    return baseEmbedding.map(val => val + (Math.random() - 0.5) * 0.05);
  };

  // Helper: Create orthogonal embedding (low similarity)
  const createOrthogonalEmbedding = (dimensions: number): number[] => {
    const embedding: number[] = [];
    for (let i = 0; i < dimensions; i++) {
      embedding.push(Math.random() * 2 - 1);
    }
    return embedding;
  };

  // Helper: Create mock recent elements
  const createMockRecentElements = (): RecentElements => {
    const dragonEmbedding = createEmbedding(1);
    const forestEmbedding = createEmbedding(2);
    const keyEmbedding = createEmbedding(3);
    const questEmbedding = createEmbedding(4);

    return {
      characters: [
        {
          elementText: 'dragon',
          embeddingVector: dragonEmbedding,
          frequency: 3,
          lastUsed: new Date('2024-01-01T10:00:00Z'),
        },
        {
          elementText: 'wizard',
          embeddingVector: createEmbedding(5),
          frequency: 2,
          lastUsed: new Date('2024-01-01T09:00:00Z'),
        },
      ],
      settings: [
        {
          elementText: 'forest',
          embeddingVector: forestEmbedding,
          frequency: 4,
          lastUsed: new Date('2024-01-01T11:00:00Z'),
        },
      ],
      objects: [
        {
          elementText: 'magic key',
          embeddingVector: keyEmbedding,
          frequency: 1,
          lastUsed: new Date('2024-01-01T08:00:00Z'),
        },
      ],
      plot_patterns: [
        {
          elementText: 'hero quest',
          embeddingVector: questEmbedding,
          frequency: 2,
          lastUsed: new Date('2024-01-01T07:00:00Z'),
        },
      ],
    };
  };

  describe('findSimilarElements', () => {
    it('should find elements above similarity threshold', () => {
      const recentElements = createMockRecentElements();
      const dragonEmbedding = recentElements.characters[0].embeddingVector!;

      // Create a very similar embedding to "dragon"
      const wyrm = createSimilarEmbedding(dragonEmbedding);

      const similar = service.findSimilarElements({
        elementText: 'wyrm',
        elementEmbedding: wyrm,
        recentElements,
        threshold: 0.75,
      });

      // Should find "dragon" as similar (wyrm is a type of dragon)
      expect(similar.length).toBeGreaterThan(0);
      expect(similar[0].elementText).toBe('dragon');
      expect(similar[0].similarityScore).toBeGreaterThanOrEqual(0.75);
    });

    it('should return empty array when no similar elements found', () => {
      const recentElements = createMockRecentElements();

      // Completely different embedding
      const spaceshipEmbedding = createOrthogonalEmbedding(1536);

      const similar = service.findSimilarElements({
        elementText: 'spaceship',
        elementEmbedding: spaceshipEmbedding,
        recentElements,
        threshold: 0.75,
      });

      // No fantasy elements should be similar to spaceship
      expect(similar.length).toBe(0);
    });

    it('should sort results by similarity score descending', () => {
      const recentElements = createMockRecentElements();

      // Create an embedding that's somewhat similar to multiple elements
      const dragonEmbedding = recentElements.characters[0].embeddingVector!;
      const testEmbedding = createSimilarEmbedding(dragonEmbedding);

      const similar = service.findSimilarElements({
        elementText: 'wyvern',
        elementEmbedding: testEmbedding,
        recentElements,
        threshold: 0.5, // Lower threshold to potentially get multiple matches
      });

      // Verify sorting: each element should have similarity >= next element
      for (let i = 0; i < similar.length - 1; i++) {
        expect(similar[i].similarityScore).toBeGreaterThanOrEqual(
          similar[i + 1].similarityScore,
        );
      }
    });

    it('should respect custom threshold parameter', () => {
      const recentElements = createMockRecentElements();
      const dragonEmbedding = recentElements.characters[0].embeddingVector!;
      const similarEmbedding = createSimilarEmbedding(dragonEmbedding);

      // Low threshold (0.5) - should find matches
      const similarLowThreshold = service.findSimilarElements({
        elementText: 'serpent',
        elementEmbedding: similarEmbedding,
        recentElements,
        threshold: 0.5,
      });

      // Very high threshold (0.99) - should find fewer or no matches
      const similarHighThreshold = service.findSimilarElements({
        elementText: 'serpent',
        elementEmbedding: similarEmbedding,
        recentElements,
        threshold: 0.99,
      });

      expect(similarLowThreshold.length).toBeGreaterThanOrEqual(
        similarHighThreshold.length,
      );
    });

    it('should skip elements without embeddings', () => {
      const recentElements: RecentElements = {
        characters: [
          {
            elementText: 'dragon',
            embeddingVector: null, // No embedding
            frequency: 1,
            lastUsed: new Date(),
          },
        ],
        settings: [],
        objects: [],
        plot_patterns: [],
      };

      const similar = service.findSimilarElements({
        elementText: 'wyrm',
        elementEmbedding: createEmbedding(1),
        recentElements,
        threshold: 0.75,
      });

      // Should return empty since dragon has no embedding
      expect(similar.length).toBe(0);
    });

    it('should handle empty embedding gracefully', () => {
      const recentElements = createMockRecentElements();

      const similar = service.findSimilarElements({
        elementText: 'test',
        elementEmbedding: [], // Empty embedding
        recentElements,
        threshold: 0.75,
      });

      // Should return empty and log warning
      expect(similar.length).toBe(0);
      expect(console.warn).toHaveBeenCalledWith(
        'Cannot find similar elements: embedding is empty',
      );
    });

    it('should handle null recent elements gracefully', () => {
      const similar = service.findSimilarElements({
        elementText: 'test',
        elementEmbedding: createEmbedding(1),
        recentElements: null as any,
        threshold: 0.75,
      });

      expect(similar.length).toBe(0);
      expect(console.warn).toHaveBeenCalledWith(
        'Cannot find similar elements: recent elements is null/undefined',
      );
    });

    it('should skip exact text matches', () => {
      const dragonEmbedding = createEmbedding(1);
      const recentElements: RecentElements = {
        characters: [
          {
            elementText: 'dragon',
            embeddingVector: dragonEmbedding,
            frequency: 1,
            lastUsed: new Date(),
          },
        ],
        settings: [],
        objects: [],
        plot_patterns: [],
      };

      // Use same embedding and same text (exact match)
      const similar = service.findSimilarElements({
        elementText: 'dragon', // Exact same text
        elementEmbedding: dragonEmbedding,
        recentElements,
        threshold: 0.75,
      });

      // Should skip exact matches
      expect(similar.length).toBe(0);
    });

    it('should include frequency and lastUsed metadata', () => {
      const recentElements = createMockRecentElements();
      const dragonEmbedding = recentElements.characters[0].embeddingVector!;
      const similarEmbedding = createSimilarEmbedding(dragonEmbedding);

      const similar = service.findSimilarElements({
        elementText: 'wyrm',
        elementEmbedding: similarEmbedding,
        recentElements,
        threshold: 0.75,
      });

      if (similar.length > 0) {
        expect(similar[0].frequency).toBe(3);
        expect(similar[0].lastUsed).toEqual(new Date('2024-01-01T10:00:00Z'));
      }
    });
  });

  describe('findSimilarElementsByType', () => {
    it('should only compare against elements of the same type', () => {
      const recentElements = createMockRecentElements();
      const dragonEmbedding = recentElements.characters[0].embeddingVector!;
      const similarEmbedding = createSimilarEmbedding(dragonEmbedding);

      // Search only in characters
      const similar = service.findSimilarElementsByType(
        'wyrm',
        similarEmbedding,
        'character',
        recentElements,
        0.75,
      );

      // All results should be characters
      similar.forEach(s => {
        expect(s.elementType).toBe('character');
      });
    });

    it('should find similar characters', () => {
      const recentElements = createMockRecentElements();
      const dragonEmbedding = recentElements.characters[0].embeddingVector!;
      const similarEmbedding = createSimilarEmbedding(dragonEmbedding);

      const similar = service.findSimilarElementsByType(
        'wyrm',
        similarEmbedding,
        'character',
        recentElements,
        0.75,
      );

      expect(similar.length).toBeGreaterThan(0);
      expect(similar[0].elementText).toBe('dragon');
    });

    it('should find similar settings', () => {
      const recentElements = createMockRecentElements();
      const forestEmbedding = recentElements.settings[0].embeddingVector!;
      const similarEmbedding = createSimilarEmbedding(forestEmbedding);

      const similar = service.findSimilarElementsByType(
        'woods',
        similarEmbedding,
        'setting',
        recentElements,
        0.75,
      );

      expect(similar.length).toBeGreaterThan(0);
      expect(similar[0].elementText).toBe('forest');
    });

    it('should find similar objects', () => {
      const recentElements = createMockRecentElements();
      const keyEmbedding = recentElements.objects[0].embeddingVector!;
      const similarEmbedding = createSimilarEmbedding(keyEmbedding);

      const similar = service.findSimilarElementsByType(
        'enchanted key',
        similarEmbedding,
        'object',
        recentElements,
        0.75,
      );

      expect(similar.length).toBeGreaterThan(0);
      expect(similar[0].elementText).toBe('magic key');
    });

    it('should find similar plot patterns', () => {
      const recentElements = createMockRecentElements();
      const questEmbedding = recentElements.plot_patterns[0].embeddingVector!;
      const similarEmbedding = createSimilarEmbedding(questEmbedding);

      const similar = service.findSimilarElementsByType(
        'journey',
        similarEmbedding,
        'plot_pattern',
        recentElements,
        0.75,
      );

      expect(similar.length).toBeGreaterThan(0);
      expect(similar[0].elementText).toBe('hero quest');
    });

    it('should handle unknown element type gracefully', () => {
      const recentElements = createMockRecentElements();

      const similar = service.findSimilarElementsByType(
        'test',
        createEmbedding(1),
        'unknown_type' as any,
        recentElements,
        0.75,
      );

      expect(similar.length).toBe(0);
      expect(console.warn).toHaveBeenCalledWith(
        'Unknown element type: unknown_type',
      );
    });

    it('should handle empty embedding', () => {
      const recentElements = createMockRecentElements();

      const similar = service.findSimilarElementsByType(
        'test',
        [],
        'character',
        recentElements,
        0.75,
      );

      expect(similar.length).toBe(0);
    });
  });

  describe('batchFindSimilarElements', () => {
    it('should process multiple elements at once', () => {
      const recentElements = createMockRecentElements();
      const dragonEmbedding = recentElements.characters[0].embeddingVector!;
      const forestEmbedding = recentElements.settings[0].embeddingVector!;

      const elementsToCheck: ElementToCheck[] = [
        {
          elementText: 'wyrm',
          elementType: 'character',
          elementEmbedding: createSimilarEmbedding(dragonEmbedding),
        },
        {
          elementText: 'woods',
          elementType: 'setting',
          elementEmbedding: createSimilarEmbedding(forestEmbedding),
        },
      ];

      const results = service.batchFindSimilarElements(
        elementsToCheck,
        recentElements,
        0.75,
      );

      expect(results.size).toBe(2);
      expect(results.has('wyrm')).toBe(true);
      expect(results.has('woods')).toBe(true);
    });

    it('should return map with element text as keys', () => {
      const recentElements = createMockRecentElements();
      const dragonEmbedding = recentElements.characters[0].embeddingVector!;

      const elementsToCheck: ElementToCheck[] = [
        {
          elementText: 'wyrm',
          elementType: 'character',
          elementEmbedding: createSimilarEmbedding(dragonEmbedding),
        },
      ];

      const results = service.batchFindSimilarElements(
        elementsToCheck,
        recentElements,
        0.75,
      );

      const wyrmResults = results.get('wyrm');
      expect(wyrmResults).toBeDefined();
      expect(Array.isArray(wyrmResults)).toBe(true);
    });

    it('should handle empty input array', () => {
      const recentElements = createMockRecentElements();

      const results = service.batchFindSimilarElements(
        [],
        recentElements,
        0.75,
      );

      expect(results.size).toBe(0);
    });
  });

  describe('isNovelElement', () => {
    it('should return true for novel elements', () => {
      const recentElements = createMockRecentElements();
      const spaceshipEmbedding = createOrthogonalEmbedding(1536);

      const isNovel = service.isNovelElement(
        'spaceship',
        spaceshipEmbedding,
        'object',
        recentElements,
        0.75,
      );

      expect(isNovel).toBe(true);
    });

    it('should return false for similar elements', () => {
      const recentElements = createMockRecentElements();
      const dragonEmbedding = recentElements.characters[0].embeddingVector!;
      const similarEmbedding = createSimilarEmbedding(dragonEmbedding);

      const isNovel = service.isNovelElement(
        'wyrm',
        similarEmbedding,
        'character',
        recentElements,
        0.75,
      );

      expect(isNovel).toBe(false);
    });

    it('should respect threshold parameter', () => {
      // Create two different embeddings for comparison
      const baseEmbedding = createEmbedding(100);
      const differentEmbedding = createEmbedding(200);

      // Add the base embedding to recent elements
      const testRecent: RecentElements = {
        characters: [
          {
            elementText: 'test character',
            embeddingVector: baseEmbedding,
            frequency: 1,
            lastUsed: new Date(),
          },
        ],
        settings: [],
        objects: [],
        plot_patterns: [],
      };

      // With impossible threshold (1.0 requires exact match), nothing matches unless identical
      const novelHighThreshold = service.isNovelElement(
        'different character',
        differentEmbedding,
        'character',
        testRecent,
        1.0,
      );

      // Very high threshold should make element novel (harder to match)
      expect(novelHighThreshold).toBe(true);

      // Very low threshold might find matches (easier to match)
      // This behavior is validated in other tests
    });
  });

  describe('getSimilarityStatistics', () => {
    it('should calculate correct statistics', () => {
      const recentElements = createMockRecentElements();
      const dragonEmbedding = recentElements.characters[0].embeddingVector!;

      const elementsToCheck: ElementToCheck[] = [
        {
          elementText: 'wyrm',
          elementType: 'character',
          elementEmbedding: createSimilarEmbedding(dragonEmbedding), // Similar
        },
        {
          elementText: 'spaceship',
          elementType: 'object',
          elementEmbedding: createOrthogonalEmbedding(1536), // Novel
        },
        {
          elementText: 'alien',
          elementType: 'character',
          elementEmbedding: createOrthogonalEmbedding(1536), // Novel
        },
      ];

      const stats = service.getSimilarityStatistics(
        elementsToCheck,
        recentElements,
        0.75,
      );

      expect(stats.total).toBe(3);
      expect(stats.novel).toBeGreaterThan(0);
      expect(stats.repetitive).toBeGreaterThan(0);
      expect(stats.noveltyPercentage).toBeGreaterThan(0);
      expect(stats.noveltyPercentage).toBeLessThanOrEqual(100);
      expect(stats.novel + stats.repetitive).toBe(stats.total);
    });

    it('should handle empty input', () => {
      const recentElements = createMockRecentElements();

      const stats = service.getSimilarityStatistics([], recentElements, 0.75);

      expect(stats.total).toBe(0);
      expect(stats.novel).toBe(0);
      expect(stats.repetitive).toBe(0);
      expect(stats.noveltyPercentage).toBe(0);
    });

    it('should calculate 100% novelty for all novel elements', () => {
      const recentElements = createMockRecentElements();

      const elementsToCheck: ElementToCheck[] = [
        {
          elementText: 'spaceship',
          elementType: 'object',
          elementEmbedding: createOrthogonalEmbedding(1536),
        },
        {
          elementText: 'alien',
          elementType: 'character',
          elementEmbedding: createOrthogonalEmbedding(1536),
        },
      ];

      const stats = service.getSimilarityStatistics(
        elementsToCheck,
        recentElements,
        0.75,
      );

      expect(stats.novel).toBe(2);
      expect(stats.repetitive).toBe(0);
      expect(stats.noveltyPercentage).toBe(100);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle dimension mismatch errors gracefully', () => {
      const recentElements: RecentElements = {
        characters: [
          {
            elementText: 'dragon',
            embeddingVector: [0.1, 0.2, 0.3], // 3 dimensions
            frequency: 1,
            lastUsed: new Date(),
          },
        ],
        settings: [],
        objects: [],
        plot_patterns: [],
      };

      const wrongDimensionEmbedding = createEmbedding(1); // 1536 dimensions

      // Should handle gracefully and skip mismatched vectors
      const similar = service.findSimilarElements({
        elementText: 'wyrm',
        elementEmbedding: wrongDimensionEmbedding,
        recentElements,
        threshold: 0.75,
      });

      expect(similar.length).toBe(0);
    });

    it('should handle all empty recent element lists', () => {
      const emptyRecent: RecentElements = {
        characters: [],
        settings: [],
        objects: [],
        plot_patterns: [],
      };

      const similar = service.findSimilarElements({
        elementText: 'dragon',
        elementEmbedding: createEmbedding(1),
        recentElements: emptyRecent,
        threshold: 0.75,
      });

      expect(similar.length).toBe(0);
    });
  });

  describe('singleton instance', () => {
    it('should export singleton instance', () => {
      expect(similarityDetectionService).toBeDefined();
      expect(similarityDetectionService).toBeInstanceOf(
        SimilarityDetectionService,
      );
    });
  });
});
