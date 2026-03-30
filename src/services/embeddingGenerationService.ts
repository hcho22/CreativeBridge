/**
 * Embedding Generation Service
 *
 * Generates semantic embeddings for story elements using OpenAI's text-embedding-3-small model.
 * Embeddings enable semantic similarity comparison to detect story element repetition.
 *
 * Part of the Story Diversity Tracking System (US-003)
 */

import { Environment, isOpenAIConfigured } from '../config/environment';

/**
 * OpenAI Embedding API Response
 */
export interface EmbeddingResponse {
  object: 'list';
  data: Array<{
    object: 'embedding';
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

/**
 * Embedding Generation Service
 *
 * Features:
 * - Uses OpenAI text-embedding-3-small for cost-effective, high-quality embeddings (1536 dimensions)
 * - In-memory caching to avoid redundant API calls for identical text
 * - Exponential backoff retry logic for transient failures
 * - Graceful error handling with detailed logging
 */
class EmbeddingGenerationService {
  private static readonly EMBEDDING_MODEL = 'text-embedding-3-small';
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY_MS = 1000;
  private static readonly CACHE_SIZE_LIMIT = 200; // Reduced from 1000 to limit ~6MB footprint

  /**
   * In-memory cache: text -> embedding vector
   * Avoids redundant API calls for identical text strings
   */
  private embeddingCache: Map<string, number[]> = new Map();

  /**
   * Generate embedding vector for a text string
   *
   * Uses OpenAI's text-embedding-3-small model to create a 1536-dimensional
   * embedding vector that captures semantic meaning of the text.
   *
   * Features:
   * - Checks cache first to avoid redundant API calls
   * - Normalizes input text (trim, lowercase) for better cache hits
   * - Retry logic with exponential backoff for transient failures
   * - Returns consistent-length vectors (1536 dimensions)
   *
   * @param text - Text to generate embedding for (will be normalized)
   * @returns Embedding vector as array of 1536 numbers
   * @throws Error if OpenAI not configured or all retries fail
   */
  public async generateEmbedding(text: string): Promise<number[]> {
    // Validate OpenAI configuration
    if (!isOpenAIConfigured()) {
      throw new Error(
        'OpenAI API key not configured. Please set your API key in environment configuration.',
      );
    }

    // Normalize text for better cache hits
    // Lowercase and trim ensures "Dragon" and "dragon  " use same cached embedding
    const normalizedText = text.trim().toLowerCase();

    if (!normalizedText) {
      throw new Error('Cannot generate embedding for empty text');
    }

    // Check cache first
    const cachedEmbedding = this.embeddingCache.get(normalizedText);
    if (cachedEmbedding) {
      if (__DEV__)
        console.log('Embedding cache hit:', {
          text: normalizedText.substring(0, 50),
          cacheSize: this.embeddingCache.size,
        });
      return cachedEmbedding;
    }

    // Generate new embedding with retry logic
    const embedding = await this.generateEmbeddingWithRetry(normalizedText);

    // Cache the result (with size limit check)
    this.cacheEmbedding(normalizedText, embedding);

    return embedding;
  }

  /**
   * Generate embedding with exponential backoff retry logic
   *
   * Handles transient failures like rate limits, timeouts, and server errors.
   * Does NOT retry on authentication errors (fail fast).
   *
   * @param text - Normalized text to generate embedding for
   * @returns Embedding vector
   * @throws Error if all retries fail
   */
  private async generateEmbeddingWithRetry(text: string): Promise<number[]> {
    for (
      let attempt = 0;
      attempt < EmbeddingGenerationService.MAX_RETRIES;
      attempt++
    ) {
      try {
        if (__DEV__)
          console.log(
            `Generating embedding (attempt ${attempt + 1}/${
              EmbeddingGenerationService.MAX_RETRIES
            }):`,
            {
              text: text.substring(0, 50),
              model: EmbeddingGenerationService.EMBEDDING_MODEL,
            },
          );

        const embedding = await this.callEmbeddingAPI(text);

        if (__DEV__)
          console.log('Embedding generated successfully:', {
            dimensions: embedding.length,
            firstFewValues: embedding.slice(0, 3).map(v => v.toFixed(4)),
          });

        return embedding;
      } catch (error: any) {
        const isLastAttempt =
          attempt === EmbeddingGenerationService.MAX_RETRIES - 1;
        const isAuthError =
          error.message?.includes('Invalid OpenAI API key') ||
          error.message?.includes('401');
        const isDataValidationError = error.isDataValidationError === true;
        const isRateLimitError =
          error.message?.includes('rate limit') ||
          error.message?.includes('429');
        const isServerError =
          error.message?.includes('server error') ||
          error.message?.includes('500') ||
          error.message?.includes('503');
        const isTimeoutError =
          error.message?.includes('timeout') ||
          error.message?.includes('ETIMEDOUT');

        if (__DEV__)
          console.error(`Embedding generation attempt ${attempt + 1} failed:`, {
            error: error.message,
            isAuthError,
            isDataValidationError,
            isRateLimitError,
            isServerError,
            isTimeoutError,
          });

        // Don't retry on authentication errors or data validation errors - fail immediately
        if (isAuthError || isDataValidationError) {
          throw error;
        }

        // If last attempt, throw the error
        if (isLastAttempt) {
          throw new Error(
            `Embedding generation failed after ${EmbeddingGenerationService.MAX_RETRIES} attempts: ${error.message}`,
          );
        }

        // Exponential backoff: 1s, 2s, 4s
        const delay =
          EmbeddingGenerationService.RETRY_DELAY_MS * Math.pow(2, attempt);
        if (__DEV__) console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // Should never reach here, but TypeScript needs this
    throw new Error('Embedding generation failed: max retries exceeded');
  }

  /**
   * Call OpenAI Embedding API
   *
   * Makes direct fetch call to OpenAI API (React Native compatible).
   * Uses text-embedding-3-small model for cost-effective embeddings.
   *
   * @param text - Text to embed
   * @returns Embedding vector (1536 dimensions)
   * @throws Error on API failure
   * @throws DataValidationError on empty/invalid response data (non-retryable)
   */
  private async callEmbeddingAPI(text: string): Promise<number[]> {
    const url = `${Environment.openai.baseUrl}/embeddings`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Environment.openai.apiKey}`,
      },
      body: JSON.stringify({
        model: EmbeddingGenerationService.EMBEDDING_MODEL,
        input: text,
        encoding_format: 'float', // Standard floating-point format
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      if (__DEV__)
        console.error('OpenAI Embedding API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        });

      if (response.status === 401) {
        throw new Error(
          'Invalid OpenAI API key. Please check your configuration.',
        );
      } else if (response.status === 429) {
        throw new Error(
          'OpenAI API rate limit exceeded. Please try again later.',
        );
      } else if (response.status >= 500) {
        throw new Error('OpenAI API server error. Please try again later.');
      } else {
        throw new Error(
          `OpenAI API error: ${response.status} ${response.statusText}`,
        );
      }
    }

    const data: EmbeddingResponse = await response.json();

    const embedding = data.data[0]?.embedding;
    if (!embedding || embedding.length === 0) {
      // Use special marker for data validation errors (non-retryable)
      const error = new Error('Empty embedding returned from OpenAI API');
      (error as any).isDataValidationError = true;
      throw error;
    }

    return embedding;
  }

  /**
   * Cache embedding with size limit enforcement
   *
   * Uses LRU-style eviction: if cache is full, remove oldest entry (first in Map).
   * Map iteration order is insertion order in JavaScript.
   *
   * @param text - Normalized text key
   * @param embedding - Embedding vector to cache
   */
  private cacheEmbedding(text: string, embedding: number[]): void {
    // If cache is at limit, remove oldest entry (first key in Map)
    if (
      this.embeddingCache.size >= EmbeddingGenerationService.CACHE_SIZE_LIMIT
    ) {
      const firstKey = this.embeddingCache.keys().next().value;
      if (firstKey) {
        this.embeddingCache.delete(firstKey);
        if (__DEV__)
          console.log('Embedding cache eviction (size limit reached):', {
            evictedKey: firstKey.substring(0, 50),
            newSize: this.embeddingCache.size,
          });
      }
    }

    this.embeddingCache.set(text, embedding);
    if (__DEV__)
      console.log('Embedding cached:', {
        text: text.substring(0, 50),
        cacheSize: this.embeddingCache.size,
      });
  }

  /**
   * Generate embeddings for multiple texts in batch
   *
   * OpenAI API supports batching up to 2048 inputs per request.
   * This is more efficient than individual requests for bulk operations.
   *
   * @param texts - Array of texts to generate embeddings for
   * @returns Array of embedding vectors in same order as input texts
   * @throws Error if OpenAI not configured or request fails
   */
  public async generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    // Validate input: OpenAI API will reject empty strings
    const emptyIndices = texts
      .map((t, idx) => (t && t.trim().length > 0 ? -1 : idx))
      .filter(idx => idx !== -1);

    if (emptyIndices.length > 0) {
      throw new Error(
        `Cannot generate embeddings for empty texts at indices: ${emptyIndices.join(
          ', ',
        )}. ` +
          `Found ${emptyIndices.length} empty string(s) out of ${texts.length} total inputs.`,
      );
    }

    // Normalize all texts
    const normalizedTexts = texts.map(t => t.trim().toLowerCase());

    // Check which texts are already cached
    const results: number[][] = new Array(normalizedTexts.length);
    const uncachedIndices: number[] = [];
    const uncachedTexts: string[] = [];

    normalizedTexts.forEach((text, index) => {
      const cached = this.embeddingCache.get(text);
      if (cached) {
        results[index] = cached;
      } else {
        uncachedIndices.push(index);
        uncachedTexts.push(text);
      }
    });

    // If everything is cached, return immediately
    if (uncachedTexts.length === 0) {
      if (__DEV__)
        console.log('All embeddings found in cache:', {
          count: texts.length,
          cacheSize: this.embeddingCache.size,
        });
      return results;
    }

    if (__DEV__)
      console.log('Batch embedding generation:', {
        totalTexts: texts.length,
        cachedCount: texts.length - uncachedTexts.length,
        uncachedCount: uncachedTexts.length,
      });

    // Generate embeddings for uncached texts with retry
    const newEmbeddings = await this.generateEmbeddingsBatchWithRetry(
      uncachedTexts,
    );

    // Fill in results and cache new embeddings
    uncachedIndices.forEach((originalIndex, newIndex) => {
      const embedding = newEmbeddings[newIndex];
      results[originalIndex] = embedding;
      this.cacheEmbedding(uncachedTexts[newIndex], embedding);
    });

    return results;
  }

  /**
   * Generate batch embeddings with retry logic
   *
   * @param texts - Normalized texts to generate embeddings for
   * @returns Array of embedding vectors
   * @throws Error if all retries fail
   */
  private async generateEmbeddingsBatchWithRetry(
    texts: string[],
  ): Promise<number[][]> {
    for (
      let attempt = 0;
      attempt < EmbeddingGenerationService.MAX_RETRIES;
      attempt++
    ) {
      try {
        const url = `${Environment.openai.baseUrl}/embeddings`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${Environment.openai.apiKey}`,
          },
          body: JSON.stringify({
            model: EmbeddingGenerationService.EMBEDDING_MODEL,
            input: texts,
            encoding_format: 'float',
          }),
        });

        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(
            `OpenAI API error: ${response.status} ${response.statusText} - ${errorData}`,
          );
        }

        const data: EmbeddingResponse = await response.json();

        // Extract embeddings in correct order
        const embeddings = data.data
          .sort((a, b) => a.index - b.index)
          .map(item => item.embedding);

        if (__DEV__)
          console.log('Batch embeddings generated:', {
            count: embeddings.length,
            tokensUsed: data.usage.total_tokens,
          });

        return embeddings;
      } catch (error: any) {
        const isLastAttempt =
          attempt === EmbeddingGenerationService.MAX_RETRIES - 1;
        const isAuthError = error.message?.includes('401');

        if (isAuthError) {
          throw new Error(
            'Invalid OpenAI API key. Please check your configuration.',
          );
        }

        if (isLastAttempt) {
          throw new Error(
            `Batch embedding generation failed after ${EmbeddingGenerationService.MAX_RETRIES} attempts: ${error.message}`,
          );
        }

        const delay =
          EmbeddingGenerationService.RETRY_DELAY_MS * Math.pow(2, attempt);
        if (__DEV__) console.log(`Retrying batch in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('Batch embedding generation failed: max retries exceeded');
  }

  /**
   * Clear the embedding cache
   *
   * Useful for testing or memory management.
   * Cache is automatically managed with LRU eviction, so manual clearing is rarely needed.
   */
  public clearCache(): void {
    const previousSize = this.embeddingCache.size;
    this.embeddingCache.clear();
    if (__DEV__)
      console.log('Embedding cache cleared:', {
        previousSize,
        newSize: 0,
      });
  }

  /**
   * Get cache statistics
   *
   * Useful for monitoring cache effectiveness and memory usage.
   *
   * @returns Cache size and limit
   */
  public getCacheStats(): { size: number; limit: number; hitRate?: number } {
    return {
      size: this.embeddingCache.size,
      limit: EmbeddingGenerationService.CACHE_SIZE_LIMIT,
    };
  }
}

// Export singleton instance
export const embeddingGenerationService = new EmbeddingGenerationService();
