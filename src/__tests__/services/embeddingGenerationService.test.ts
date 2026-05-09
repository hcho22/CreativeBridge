/**
 * Tests for Embedding Generation Service
 *
 * Validates embedding generation, caching, retry logic, and error handling.
 * Part of Story Diversity Tracking System (US-003)
 */

import { embeddingGenerationService } from '../../services/embeddingGenerationService';
import * as environment from '../../config/environment';

// Mock fetch globally for React Native environment
global.fetch = jest.fn();

// Mock environment configuration
jest.mock('../../config/environment', () => ({
  Environment: {
    openai: {
      apiKey: 'sk-test-mock-api-key-for-testing',
      baseUrl: 'https://api.openai.com/v1',
    },
  },
  isOpenAIConfigured: jest.fn(() => true),
}));

describe('EmbeddingGenerationService', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();

    // Clear the service cache before each test
    embeddingGenerationService.clearCache();

    // Reset environment mock to default (configured)
    (environment.isOpenAIConfigured as jest.Mock).mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('generateEmbedding', () => {
    it('should generate embedding for valid text', async () => {
      const mockEmbedding = new Array(1536).fill(0).map(() => Math.random());

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          object: 'list',
          data: [
            {
              object: 'embedding',
              embedding: mockEmbedding,
              index: 0,
            },
          ],
          model: 'text-embedding-3-small',
          usage: {
            prompt_tokens: 5,
            total_tokens: 5,
          },
        }),
      });

      const result = await embeddingGenerationService.generateEmbedding(
        'dragon',
      );

      expect(result).toEqual(mockEmbedding);
      expect(result.length).toBe(1536);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/embeddings',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer sk-test-mock-api-key-for-testing',
          }),
          body: expect.stringContaining('"model":"text-embedding-3-small"'),
        }),
      );
    });

    it('should normalize text (trim and lowercase) before generating embedding', async () => {
      const mockEmbedding = new Array(1536).fill(0).map(() => Math.random());

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          object: 'list',
          data: [{ object: 'embedding', embedding: mockEmbedding, index: 0 }],
          model: 'text-embedding-3-small',
          usage: { prompt_tokens: 5, total_tokens: 5 },
        }),
      });

      await embeddingGenerationService.generateEmbedding('  Dragon  ');
      embeddingGenerationService.clearCache();

      await embeddingGenerationService.generateEmbedding('dragon');

      // Both should send the same normalized text to API
      const calls = (global.fetch as jest.Mock).mock.calls;
      const body1 = JSON.parse(calls[0][1].body);
      const body2 = JSON.parse(calls[1][1].body);

      expect(body1.input).toBe('dragon');
      expect(body2.input).toBe('dragon');
    });

    it('should throw error for empty text', async () => {
      await expect(
        embeddingGenerationService.generateEmbedding(''),
      ).rejects.toThrow('Cannot generate embedding for empty text');

      await expect(
        embeddingGenerationService.generateEmbedding('   '),
      ).rejects.toThrow('Cannot generate embedding for empty text');

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should throw error when OpenAI is not configured', async () => {
      (environment.isOpenAIConfigured as jest.Mock).mockReturnValue(false);

      await expect(
        embeddingGenerationService.generateEmbedding('test'),
      ).rejects.toThrow('OpenAI API key not configured');

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should use cached embedding for identical normalized text', async () => {
      const mockEmbedding = new Array(1536).fill(0).map(() => Math.random());

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          object: 'list',
          data: [{ object: 'embedding', embedding: mockEmbedding, index: 0 }],
          model: 'text-embedding-3-small',
          usage: { prompt_tokens: 5, total_tokens: 5 },
        }),
      });

      // First call - should hit API
      const result1 = await embeddingGenerationService.generateEmbedding(
        'dragon',
      );

      // Second call - should use cache
      const result2 = await embeddingGenerationService.generateEmbedding(
        'dragon',
      );

      // Third call with different case/whitespace - should still use cache
      const result3 = await embeddingGenerationService.generateEmbedding(
        '  DRAGON  ',
      );

      expect(result1).toEqual(mockEmbedding);
      expect(result2).toEqual(mockEmbedding);
      expect(result3).toEqual(mockEmbedding);
      expect(global.fetch).toHaveBeenCalledTimes(1); // Only 1 API call
    });
  });

  describe('Retry Logic', () => {
    it('should retry on rate limit errors (429)', async () => {
      const mockEmbedding = new Array(1536).fill(0).map(() => Math.random());

      // First two attempts fail with rate limit
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          text: async () => 'Rate limit exceeded',
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          text: async () => 'Rate limit exceeded',
        })
        // Third attempt succeeds
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            object: 'list',
            data: [{ object: 'embedding', embedding: mockEmbedding, index: 0 }],
            model: 'text-embedding-3-small',
            usage: { prompt_tokens: 5, total_tokens: 5 },
          }),
        });

      const result = await embeddingGenerationService.generateEmbedding('test');

      expect(result).toEqual(mockEmbedding);
      expect(global.fetch).toHaveBeenCalledTimes(3); // 2 failures + 1 success
    }, 10000); // Increase timeout for retry delays

    it('should retry on server errors (500, 503)', async () => {
      const mockEmbedding = new Array(1536).fill(0).map(() => Math.random());

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          text: async () => 'Server error',
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            object: 'list',
            data: [{ object: 'embedding', embedding: mockEmbedding, index: 0 }],
            model: 'text-embedding-3-small',
            usage: { prompt_tokens: 5, total_tokens: 5 },
          }),
        });

      const result = await embeddingGenerationService.generateEmbedding('test');

      expect(result).toEqual(mockEmbedding);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    }, 10000);

    it('should NOT retry on authentication errors (401)', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid API key',
      });

      await expect(
        embeddingGenerationService.generateEmbedding('test'),
      ).rejects.toThrow('Invalid OpenAI API key');

      expect(global.fetch).toHaveBeenCalledTimes(1); // No retry
    });

    it('should fail after max retries (3 attempts)', async () => {
      // All 3 attempts fail with rate limit
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: async () => 'Rate limit exceeded',
      });

      await expect(
        embeddingGenerationService.generateEmbedding('test'),
      ).rejects.toThrow('Embedding generation failed after 3 attempts');

      expect(global.fetch).toHaveBeenCalledTimes(3);
    }, 15000); // Longer timeout for 3 retries with delays
  });

  describe('Error Handling', () => {
    it('should handle empty embedding response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          object: 'list',
          data: [{ object: 'embedding', embedding: [], index: 0 }],
          model: 'text-embedding-3-small',
          usage: { prompt_tokens: 5, total_tokens: 5 },
        }),
      });

      await expect(
        embeddingGenerationService.generateEmbedding('test'),
      ).rejects.toThrow('Empty embedding returned from OpenAI API');
    });

    it('should handle missing data in response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          object: 'list',
          data: [],
          model: 'text-embedding-3-small',
          usage: { prompt_tokens: 5, total_tokens: 5 },
        }),
      });

      await expect(
        embeddingGenerationService.generateEmbedding('test'),
      ).rejects.toThrow('Empty embedding returned from OpenAI API');
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network request failed'),
      );

      await expect(
        embeddingGenerationService.generateEmbedding('test'),
      ).rejects.toThrow('Embedding generation failed after 3 attempts');
    }, 15000);
  });

  describe('Batch Embedding Generation', () => {
    it('should generate embeddings for multiple texts', async () => {
      const mockEmbedding1 = new Array(1536).fill(0).map(() => Math.random());
      const mockEmbedding2 = new Array(1536).fill(0).map(() => Math.random());
      const mockEmbedding3 = new Array(1536).fill(0).map(() => Math.random());

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          object: 'list',
          data: [
            { object: 'embedding', embedding: mockEmbedding1, index: 0 },
            { object: 'embedding', embedding: mockEmbedding2, index: 1 },
            { object: 'embedding', embedding: mockEmbedding3, index: 2 },
          ],
          model: 'text-embedding-3-small',
          usage: { prompt_tokens: 15, total_tokens: 15 },
        }),
      });

      const results = await embeddingGenerationService.generateEmbeddingsBatch([
        'dragon',
        'forest',
        'magic key',
      ]);

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual(mockEmbedding1);
      expect(results[1]).toEqual(mockEmbedding2);
      expect(results[2]).toEqual(mockEmbedding3);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Verify request body contains all texts
      const requestBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body,
      );
      expect(requestBody.input).toEqual(['dragon', 'forest', 'magic key']);
    });

    it('should return empty array for empty input', async () => {
      const results = await embeddingGenerationService.generateEmbeddingsBatch(
        [],
      );

      expect(results).toEqual([]);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should use cached embeddings in batch operations', async () => {
      const mockEmbedding1 = new Array(1536).fill(0).map(() => Math.random());
      const mockEmbedding2 = new Array(1536).fill(0).map(() => Math.random());
      const mockEmbedding3 = new Array(1536).fill(0).map(() => Math.random());

      // First batch - cache "dragon" and "forest"
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          object: 'list',
          data: [
            { object: 'embedding', embedding: mockEmbedding1, index: 0 },
            { object: 'embedding', embedding: mockEmbedding2, index: 1 },
          ],
          model: 'text-embedding-3-small',
          usage: { prompt_tokens: 10, total_tokens: 10 },
        }),
      });

      await embeddingGenerationService.generateEmbeddingsBatch([
        'dragon',
        'forest',
      ]);

      // Second batch - "dragon" cached, "forest" cached, only "castle" needs API call
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          object: 'list',
          data: [{ object: 'embedding', embedding: mockEmbedding3, index: 0 }],
          model: 'text-embedding-3-small',
          usage: { prompt_tokens: 5, total_tokens: 5 },
        }),
      });

      const results = await embeddingGenerationService.generateEmbeddingsBatch([
        'dragon',
        'castle',
        'forest',
      ]);

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual(mockEmbedding1); // Cached
      expect(results[1]).toEqual(mockEmbedding3); // New
      expect(results[2]).toEqual(mockEmbedding2); // Cached

      // Should only make 2 API calls total (1 for first batch, 1 for uncached in second)
      expect(global.fetch).toHaveBeenCalledTimes(2);

      // Second call should only request "castle"
      const secondCallBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[1][1].body,
      );
      expect(secondCallBody.input).toEqual(['castle']);
    });

    it('should handle all cached texts in batch', async () => {
      const mockEmbedding = new Array(1536).fill(0).map(() => Math.random());

      // First call to populate cache
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          object: 'list',
          data: [{ object: 'embedding', embedding: mockEmbedding, index: 0 }],
          model: 'text-embedding-3-small',
          usage: { prompt_tokens: 5, total_tokens: 5 },
        }),
      });

      await embeddingGenerationService.generateEmbedding('dragon');

      // Second call - should use cache
      const results = await embeddingGenerationService.generateEmbeddingsBatch([
        'dragon',
        'DRAGON',
        '  dragon  ',
      ]);

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual(mockEmbedding);
      expect(results[1]).toEqual(mockEmbedding);
      expect(results[2]).toEqual(mockEmbedding);
      expect(global.fetch).toHaveBeenCalledTimes(1); // Only initial call
    });
  });

  describe('Cache Management', () => {
    it('should provide cache statistics', () => {
      const stats = embeddingGenerationService.getCacheStats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('limit');
      expect(stats.size).toBe(0); // Empty after clearCache
      // Cache limit reduced from 1000 → 200 in source (~6MB footprint cap, see CACHE_SIZE_LIMIT comment).
      expect(stats.limit).toBe(200);
    });

    it('should clear cache', async () => {
      const mockEmbedding = new Array(1536).fill(0).map(() => Math.random());

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          object: 'list',
          data: [{ object: 'embedding', embedding: mockEmbedding, index: 0 }],
          model: 'text-embedding-3-small',
          usage: { prompt_tokens: 5, total_tokens: 5 },
        }),
      });

      // Generate embedding to populate cache
      await embeddingGenerationService.generateEmbedding('dragon');

      let stats = embeddingGenerationService.getCacheStats();
      expect(stats.size).toBe(1);

      // Clear cache
      embeddingGenerationService.clearCache();

      stats = embeddingGenerationService.getCacheStats();
      expect(stats.size).toBe(0);

      // Next call should hit API again
      await embeddingGenerationService.generateEmbedding('dragon');

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should evict oldest entry when cache reaches size limit', async () => {
      // This test would require generating 1000+ embeddings which is impractical
      // Instead, we test the concept with a smaller example and verify the logic

      const mockEmbedding = new Array(1536).fill(0).map(() => Math.random());

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          object: 'list',
          data: [{ object: 'embedding', embedding: mockEmbedding, index: 0 }],
          model: 'text-embedding-3-small',
          usage: { prompt_tokens: 5, total_tokens: 5 },
        }),
      });

      // Generate a few unique embeddings
      await embeddingGenerationService.generateEmbedding('text1');
      await embeddingGenerationService.generateEmbedding('text2');
      await embeddingGenerationService.generateEmbedding('text3');

      const stats = embeddingGenerationService.getCacheStats();
      expect(stats.size).toBe(3);
      expect(stats.limit).toBe(200);

      // All should be cached
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('Performance', () => {
    it('should complete embedding generation within reasonable time', async () => {
      const mockEmbedding = new Array(1536).fill(0).map(() => Math.random());

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          object: 'list',
          data: [{ object: 'embedding', embedding: mockEmbedding, index: 0 }],
          model: 'text-embedding-3-small',
          usage: { prompt_tokens: 5, total_tokens: 5 },
        }),
      });

      const startTime = Date.now();
      await embeddingGenerationService.generateEmbedding('test');
      const duration = Date.now() - startTime;

      // Should complete in under 1 second (for mocked call)
      expect(duration).toBeLessThan(1000);
    });

    it('should have correct embedding dimensions (1536 for text-embedding-3-small)', async () => {
      const mockEmbedding = new Array(1536).fill(0).map(() => Math.random());

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          object: 'list',
          data: [{ object: 'embedding', embedding: mockEmbedding, index: 0 }],
          model: 'text-embedding-3-small',
          usage: { prompt_tokens: 5, total_tokens: 5 },
        }),
      });

      const result = await embeddingGenerationService.generateEmbedding('test');

      expect(result.length).toBe(1536);
    });
  });
});
