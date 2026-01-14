/**
 * Tests for Cosine Similarity Service
 *
 * Validates cosine similarity calculation for semantic vector comparison
 * Part of the Story Diversity Tracking System (US-004)
 */

import {
  calculateCosineSimilarity,
  findMostSimilarVector,
  batchCalculateSimilarity,
  areSimilar,
} from '../../services/cosineSimilarityService';

describe('CosineSimilarityService', () => {
  describe('calculateCosineSimilarity', () => {
    describe('identical vectors', () => {
      it('should return 1.0 for identical vectors', () => {
        const vectorA = [0.5, 0.5, 0.5];
        const vectorB = [0.5, 0.5, 0.5];
        const similarity = calculateCosineSimilarity(vectorA, vectorB);
        expect(similarity).toBeCloseTo(1.0, 10);
      });

      it('should return 1.0 for identical high-dimensional vectors', () => {
        // Simulate OpenAI text-embedding-3-small (1536 dimensions)
        const vectorA = new Array(1536).fill(0.5);
        const vectorB = new Array(1536).fill(0.5);
        const similarity = calculateCosineSimilarity(vectorA, vectorB);
        expect(similarity).toBeCloseTo(1.0, 10);
      });

      it('should return 1.0 for identical sparse vectors', () => {
        const vectorA = [1, 0, 0, 0, 0];
        const vectorB = [1, 0, 0, 0, 0];
        const similarity = calculateCosineSimilarity(vectorA, vectorB);
        expect(similarity).toBeCloseTo(1.0, 10);
      });
    });

    describe('orthogonal vectors', () => {
      it('should return 0.0 for orthogonal vectors', () => {
        const vectorA = [1, 0, 0];
        const vectorB = [0, 1, 0];
        const similarity = calculateCosineSimilarity(vectorA, vectorB);
        expect(similarity).toBeCloseTo(0.0, 10);
      });

      it('should return 0.0 for orthogonal high-dimensional vectors', () => {
        const vectorA = new Array(100).fill(0);
        vectorA[0] = 1;
        const vectorB = new Array(100).fill(0);
        vectorB[50] = 1;
        const similarity = calculateCosineSimilarity(vectorA, vectorB);
        expect(similarity).toBeCloseTo(0.0, 10);
      });
    });

    describe('opposite vectors', () => {
      it('should return -1.0 for opposite vectors', () => {
        const vectorA = [1, 0, 0];
        const vectorB = [-1, 0, 0];
        const similarity = calculateCosineSimilarity(vectorA, vectorB);
        expect(similarity).toBeCloseTo(-1.0, 10);
      });

      it('should return -1.0 for opposite multi-dimensional vectors', () => {
        const vectorA = [0.5, 0.5, 0.5];
        const vectorB = [-0.5, -0.5, -0.5];
        const similarity = calculateCosineSimilarity(vectorA, vectorB);
        expect(similarity).toBeCloseTo(-1.0, 10);
      });
    });

    describe('similar but not identical vectors', () => {
      it('should return high similarity for very similar vectors', () => {
        const vectorA = [0.5, 0.5, 0.5];
        const vectorB = [0.51, 0.51, 0.51];
        const similarity = calculateCosineSimilarity(vectorA, vectorB);
        expect(similarity).toBeGreaterThan(0.99);
        expect(similarity).toBeLessThanOrEqual(1.0);
      });

      it('should return moderate similarity for somewhat similar vectors', () => {
        const vectorA = [1, 1, 0];
        const vectorB = [1, 0, 1];
        const similarity = calculateCosineSimilarity(vectorA, vectorB);
        expect(similarity).toBeCloseTo(0.5, 10);
      });

      it('should handle vectors with different magnitudes correctly', () => {
        // Cosine similarity is magnitude-invariant (direction only)
        const vectorA = [1, 1, 1];
        const vectorB = [2, 2, 2]; // Same direction, different magnitude
        const similarity = calculateCosineSimilarity(vectorA, vectorB);
        expect(similarity).toBeCloseTo(1.0, 10);
      });
    });

    describe('realistic embedding scenarios', () => {
      it('should detect semantic similarity between related words', () => {
        // Simulating embeddings for "dragon" and "drake" (similar concepts)
        const dragonEmbedding = [0.8, 0.2, 0.1, 0.3, 0.5];
        const drakeEmbedding = [0.75, 0.25, 0.15, 0.35, 0.48];
        const similarity = calculateCosineSimilarity(
          dragonEmbedding,
          drakeEmbedding,
        );
        expect(similarity).toBeGreaterThan(0.95); // Very similar
      });

      it('should detect low similarity between unrelated words', () => {
        // Simulating embeddings for "dragon" and "table" (unrelated concepts)
        const dragonEmbedding = [0.8, 0.2, 0.1, 0.3, 0.5];
        const tableEmbedding = [0.1, 0.8, 0.6, 0.1, 0.2];
        const similarity = calculateCosineSimilarity(
          dragonEmbedding,
          tableEmbedding,
        );
        expect(similarity).toBeLessThan(0.7); // Low similarity
      });

      it('should handle typical OpenAI embedding dimensions (1536)', () => {
        // Create realistic-looking embeddings with random values
        const vectorA = Array.from({ length: 1536 }, () => Math.random());
        const vectorB = Array.from({ length: 1536 }, () => Math.random());
        const similarity = calculateCosineSimilarity(vectorA, vectorB);
        // Random vectors should produce a valid similarity score
        // Note: Random vectors can have any similarity by chance, so we only validate the range
        expect(similarity).toBeGreaterThanOrEqual(-1);
        expect(similarity).toBeLessThanOrEqual(1);
      });
    });

    describe('edge cases', () => {
      it('should throw error for empty vectors', () => {
        const vectorA: number[] = [];
        const vectorB = [1, 2, 3];
        expect(() => calculateCosineSimilarity(vectorA, vectorB)).toThrow(
          'Cannot calculate cosine similarity: one or both vectors are empty',
        );
      });

      it('should throw error for different length vectors', () => {
        const vectorA = [1, 2, 3];
        const vectorB = [1, 2];
        expect(() => calculateCosineSimilarity(vectorA, vectorB)).toThrow(
          'Cannot calculate cosine similarity: vectors have different lengths (3 vs 2)',
        );
      });

      it('should return 0.0 for zero vectors', () => {
        // Zero vector has no direction, so similarity is undefined
        // We return 0.0 as a sensible default
        const vectorA = [0, 0, 0];
        const vectorB = [1, 1, 1];
        const similarity = calculateCosineSimilarity(vectorA, vectorB);
        expect(similarity).toBe(0.0);
      });

      it('should return 0.0 when both vectors are zero', () => {
        const vectorA = [0, 0, 0];
        const vectorB = [0, 0, 0];
        const similarity = calculateCosineSimilarity(vectorA, vectorB);
        expect(similarity).toBe(0.0);
      });

      it('should handle very small values without underflow', () => {
        const vectorA = [1e-10, 1e-10, 1e-10];
        const vectorB = [1e-10, 1e-10, 1e-10];
        const similarity = calculateCosineSimilarity(vectorA, vectorB);
        expect(similarity).toBeCloseTo(1.0, 5); // Should still be 1.0
      });

      it('should handle very large values without overflow', () => {
        const vectorA = [1e100, 1e100, 1e100];
        const vectorB = [1e100, 1e100, 1e100];
        const similarity = calculateCosineSimilarity(vectorA, vectorB);
        expect(similarity).toBeCloseTo(1.0, 5);
      });

      it('should clamp results to [-1, 1] range despite floating-point errors', () => {
        // Edge case that might produce values slightly outside [-1, 1] due to floating-point precision
        const vectorA = [0.1, 0.2, 0.3, 0.4, 0.5];
        const vectorB = [0.1, 0.2, 0.3, 0.4, 0.5];
        const similarity = calculateCosineSimilarity(vectorA, vectorB);
        expect(similarity).toBeGreaterThanOrEqual(-1);
        expect(similarity).toBeLessThanOrEqual(1);
      });

      it('should handle single-element vectors', () => {
        const vectorA = [5];
        const vectorB = [5];
        const similarity = calculateCosineSimilarity(vectorA, vectorB);
        expect(similarity).toBeCloseTo(1.0, 10);
      });

      it('should handle negative values correctly', () => {
        const vectorA = [-1, -2, -3];
        const vectorB = [-1, -2, -3];
        const similarity = calculateCosineSimilarity(vectorA, vectorB);
        expect(similarity).toBeCloseTo(1.0, 10);
      });

      it('should handle mixed positive and negative values', () => {
        const vectorA = [1, -1, 1];
        const vectorB = [1, -1, 1];
        const similarity = calculateCosineSimilarity(vectorA, vectorB);
        expect(similarity).toBeCloseTo(1.0, 10);
      });
    });

    describe('mathematical properties', () => {
      it('should be commutative: sim(A, B) = sim(B, A)', () => {
        const vectorA = [1, 2, 3, 4, 5];
        const vectorB = [5, 4, 3, 2, 1];
        const simAB = calculateCosineSimilarity(vectorA, vectorB);
        const simBA = calculateCosineSimilarity(vectorB, vectorA);
        expect(simAB).toBeCloseTo(simBA, 10);
      });

      it('should be scale-invariant: sim(A, B) = sim(cA, B)', () => {
        const vectorA = [1, 2, 3];
        const vectorB = [4, 5, 6];
        const scale = 10;
        const scaledVectorA = vectorA.map(v => v * scale);
        const simAB = calculateCosineSimilarity(vectorA, vectorB);
        const simScaledAB = calculateCosineSimilarity(scaledVectorA, vectorB);
        expect(simAB).toBeCloseTo(simScaledAB, 10);
      });
    });
  });

  describe('findMostSimilarVector', () => {
    it('should find the most similar vector from candidates', () => {
      const query = [0.5, 0.5, 0.5];
      const candidates = [
        [0.2, 0.8, 0.1], // Less similar
        [0.3, 0.3, 0.3], // Similar
        [0.5, 0.5, 0.5], // Identical (index 2)
      ];
      const result = findMostSimilarVector(query, candidates);
      expect(result).not.toBeNull();
      expect(result?.index).toBe(2);
      expect(result?.similarity).toBeCloseTo(1.0, 10);
    });

    it('should return null for empty candidate list', () => {
      const query = [0.5, 0.5, 0.5];
      const candidates: number[][] = [];
      const result = findMostSimilarVector(query, candidates);
      expect(result).toBeNull();
    });

    it('should skip invalid candidates and find valid one', () => {
      const query = [0.5, 0.5, 0.5];
      const candidates = [
        [0.1, 0.2], // Invalid: different length
        [0.5, 0.5, 0.5], // Valid and identical (index 1)
        [0, 0, 0], // Valid but zero vector
      ];
      const result = findMostSimilarVector(query, candidates);
      expect(result).not.toBeNull();
      expect(result?.index).toBe(1);
      expect(result?.similarity).toBeCloseTo(1.0, 10);
    });

    it('should return null if all candidates are invalid', () => {
      const query = [0.5, 0.5, 0.5];
      const candidates = [
        [0.1, 0.2], // Invalid: different length
        [0.1], // Invalid: different length
      ];
      const result = findMostSimilarVector(query, candidates);
      expect(result).toBeNull();
    });
  });

  describe('batchCalculateSimilarity', () => {
    it('should calculate similarities for multiple candidates', () => {
      const query = [0.5, 0.5, 0.5];
      const candidates = [
        [0.5, 0.5, 0.5], // Identical
        [0, 0.5, 0.5], // Less similar
        [0.5, 0, 0], // Even less similar
      ];
      const similarities = batchCalculateSimilarity(query, candidates);
      expect(similarities).toHaveLength(3);
      expect(similarities[0]).toBeCloseTo(1.0, 5); // Identical
      expect(similarities[0]).toBeGreaterThan(similarities[1]);
      expect(similarities[1]).toBeGreaterThan(similarities[2]);
    });

    it('should handle empty candidate list', () => {
      const query = [0.5, 0.5, 0.5];
      const candidates: number[][] = [];
      const similarities = batchCalculateSimilarity(query, candidates);
      expect(similarities).toEqual([]);
    });

    it('should return 0.0 for invalid candidates', () => {
      const query = [0.5, 0.5, 0.5];
      const candidates = [
        [0.5, 0.5, 0.5], // Valid
        [0.1, 0.2], // Invalid: different length
        [0.5, 0.5, 0.5], // Valid
      ];
      const similarities = batchCalculateSimilarity(query, candidates);
      expect(similarities).toHaveLength(3);
      expect(similarities[0]).toBeCloseTo(1.0, 5);
      expect(similarities[1]).toBe(0.0); // Invalid candidate
      expect(similarities[2]).toBeCloseTo(1.0, 5);
    });

    it('should preserve order of candidates', () => {
      const query = [1, 0, 0];
      const candidates = [
        [0, 1, 0], // Orthogonal (index 0)
        [1, 0, 0], // Identical (index 1)
        [0, 0, 1], // Orthogonal (index 2)
      ];
      const similarities = batchCalculateSimilarity(query, candidates);
      expect(similarities[0]).toBeCloseTo(0.0, 10);
      expect(similarities[1]).toBeCloseTo(1.0, 10);
      expect(similarities[2]).toBeCloseTo(0.0, 10);
    });

    it('should handle large batches efficiently', () => {
      const query = new Array(100).fill(0.5);
      const candidates = Array.from({ length: 1000 }, () =>
        new Array(100).fill(0.5),
      );
      const startTime = Date.now();
      const similarities = batchCalculateSimilarity(query, candidates);
      const duration = Date.now() - startTime;
      expect(similarities).toHaveLength(1000);
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });
  });

  describe('areSimilar', () => {
    it('should return true when similarity exceeds threshold', () => {
      const vectorA = [0.5, 0.5, 0.5];
      const vectorB = [0.51, 0.51, 0.51];
      const similar = areSimilar(vectorA, vectorB, 0.9);
      expect(similar).toBe(true);
    });

    it('should return false when similarity is below threshold', () => {
      const vectorA = [1, 0, 0];
      const vectorB = [0, 1, 0]; // Orthogonal
      const similar = areSimilar(vectorA, vectorB, 0.5);
      expect(similar).toBe(false);
    });

    it('should use default threshold of 0.75', () => {
      const vectorA = [0.8, 0.2, 0.1];
      const vectorB = [0.75, 0.25, 0.15];
      const similar = areSimilar(vectorA, vectorB);
      // Calculate expected similarity
      const similarity = calculateCosineSimilarity(vectorA, vectorB);
      expect(similar).toBe(similarity >= 0.75);
    });

    it('should return true for identical vectors with any threshold', () => {
      const vectorA = [0.5, 0.5, 0.5];
      const vectorB = [0.5, 0.5, 0.5];
      expect(areSimilar(vectorA, vectorB, 0.99)).toBe(true);
      expect(areSimilar(vectorA, vectorB, 1.0)).toBe(true);
    });

    it('should return false for invalid vectors', () => {
      const vectorA = [0.5, 0.5, 0.5];
      const vectorB = [0.5, 0.5]; // Different length
      const similar = areSimilar(vectorA, vectorB, 0.75);
      expect(similar).toBe(false);
    });

    it('should handle edge case threshold values', () => {
      const vectorA = [1, 0, 0];
      const vectorB = [1, 0, 0];
      expect(areSimilar(vectorA, vectorB, 0.0)).toBe(true); // Threshold 0
      expect(areSimilar(vectorA, vectorB, 1.0)).toBe(true); // Threshold 1
    });
  });
});
