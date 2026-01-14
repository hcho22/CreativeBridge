/**
 * Similarity Detection Service
 *
 * Detects when new story elements are semantically similar to recently used elements.
 * Enables diversity tracking by identifying repeated story patterns.
 *
 * Part of the Story Diversity Tracking System (US-007)
 */

import { calculateCosineSimilarity } from './cosineSimilarityService';
import type {
  RecentElements,
  ElementWithFrequency,
} from './recentElementsService';

/**
 * Similar element found in recent history
 */
export interface SimilarElement {
  elementText: string;
  elementType: 'character' | 'setting' | 'object' | 'plot_pattern';
  similarityScore: number;
  frequency: number;
  lastUsed: Date;
}

/**
 * Options for similarity detection
 */
export interface FindSimilarElementsOptions {
  elementText: string;
  elementEmbedding: number[];
  recentElements: RecentElements;
  threshold?: number; // Similarity threshold (default: 0.75)
  includeAllTypes?: boolean; // Search across all types or just matching type (default: false)
}

/**
 * Element to check for similarity
 */
export interface ElementToCheck {
  elementText: string;
  elementType: 'character' | 'setting' | 'object' | 'plot_pattern';
  elementEmbedding: number[];
}

/**
 * Similarity Detection Service
 *
 * Compares new story elements against recent history using semantic embeddings
 * and cosine similarity to detect repetition and support diversity guidance.
 */
class SimilarityDetectionService {
  private static readonly DEFAULT_THRESHOLD = 0.75;

  /**
   * Find similar elements in recent history
   *
   * Compares a new element's embedding against all recent elements of the same type
   * (or all types if includeAllTypes=true) and returns those above the similarity threshold.
   *
   * @param options - Element to check and recent history
   * @returns Array of similar elements sorted by similarity score (descending)
   *
   * @example
   * const similar = await findSimilarElements({
   *   elementText: 'dragon',
   *   elementEmbedding: [0.1, 0.2, ...],
   *   recentElements: recent,
   *   threshold: 0.75
   * });
   * console.log(`Found ${similar.length} similar elements`);
   * similar.forEach(s => {
   *   console.log(`"${s.elementText}" similarity: ${s.similarityScore.toFixed(2)}`);
   * });
   */
  findSimilarElements(options: FindSimilarElementsOptions): SimilarElement[] {
    const {
      elementText,
      elementEmbedding,
      recentElements,
      threshold = SimilarityDetectionService.DEFAULT_THRESHOLD,
      includeAllTypes = false,
    } = options;

    // Validate inputs
    if (!elementEmbedding || elementEmbedding.length === 0) {
      console.warn('Cannot find similar elements: embedding is empty');
      return [];
    }

    if (!recentElements) {
      console.warn(
        'Cannot find similar elements: recent elements is null/undefined',
      );
      return [];
    }

    // Collect all candidate elements to compare
    const candidates: Array<{
      element: ElementWithFrequency;
      type: 'character' | 'setting' | 'object' | 'plot_pattern';
    }> = [];

    // Add all elements from all types (or specific type based on includeAllTypes flag)
    if (includeAllTypes) {
      candidates.push(
        ...recentElements.characters.map(el => ({
          element: el,
          type: 'character' as const,
        })),
        ...recentElements.settings.map(el => ({
          element: el,
          type: 'setting' as const,
        })),
        ...recentElements.objects.map(el => ({
          element: el,
          type: 'object' as const,
        })),
        ...recentElements.plot_patterns.map(el => ({
          element: el,
          type: 'plot_pattern' as const,
        })),
      );
    } else {
      // Default behavior: search all types since we don't know the element type yet
      // In practice, the caller should filter by type or set includeAllTypes=true
      candidates.push(
        ...recentElements.characters.map(el => ({
          element: el,
          type: 'character' as const,
        })),
        ...recentElements.settings.map(el => ({
          element: el,
          type: 'setting' as const,
        })),
        ...recentElements.objects.map(el => ({
          element: el,
          type: 'object' as const,
        })),
        ...recentElements.plot_patterns.map(el => ({
          element: el,
          type: 'plot_pattern' as const,
        })),
      );
    }

    // Compare new element against each candidate
    const similarElements: SimilarElement[] = [];

    for (const { element, type } of candidates) {
      // Skip elements without embeddings
      if (!element.embeddingVector || element.embeddingVector.length === 0) {
        continue;
      }

      // Skip exact text matches (different from semantic similarity)
      // Exact matches will have similarity 1.0, but we should skip them
      // to avoid flagging the same element in different stories
      const normalizedNew = elementText.toLowerCase().trim();
      const normalizedCandidate = element.elementText.toLowerCase().trim();
      if (normalizedNew === normalizedCandidate) {
        continue;
      }

      try {
        // Calculate semantic similarity using cosine similarity
        const similarity = calculateCosineSimilarity(
          elementEmbedding,
          element.embeddingVector,
        );

        // Check if similarity exceeds threshold
        if (similarity >= threshold) {
          similarElements.push({
            elementText: element.elementText,
            elementType: type,
            similarityScore: similarity,
            frequency: element.frequency,
            lastUsed: element.lastUsed,
          });
        }
      } catch (error) {
        console.warn(
          `Error calculating similarity for "${element.elementText}":`,
          error,
        );
        // Skip this element and continue with others
        continue;
      }
    }

    // Sort by similarity score descending (most similar first)
    return similarElements.sort(
      (a, b) => b.similarityScore - a.similarityScore,
    );
  }

  /**
   * Find similar elements for a specific element type
   *
   * More efficient than findSimilarElements when you know the element type,
   * as it only compares against recent elements of the same type.
   *
   * @param elementText - The element text to check
   * @param elementEmbedding - The embedding vector for the element
   * @param elementType - The type of element (character, setting, etc.)
   * @param recentElements - Recent elements from session
   * @param threshold - Similarity threshold (default: 0.75)
   * @returns Array of similar elements sorted by similarity score
   *
   * @example
   * const similar = findSimilarElementsByType(
   *   'dragon',
   *   embedding,
   *   'character',
   *   recentElements,
   *   0.75
   * );
   */
  findSimilarElementsByType(
    elementText: string,
    elementEmbedding: number[],
    elementType: 'character' | 'setting' | 'object' | 'plot_pattern',
    recentElements: RecentElements,
    threshold: number = SimilarityDetectionService.DEFAULT_THRESHOLD,
  ): SimilarElement[] {
    // Validate inputs
    if (!elementEmbedding || elementEmbedding.length === 0) {
      console.warn('Cannot find similar elements: embedding is empty');
      return [];
    }

    // Get candidates for the specific element type
    let candidates: ElementWithFrequency[] = [];
    switch (elementType) {
      case 'character':
        candidates = recentElements.characters;
        break;
      case 'setting':
        candidates = recentElements.settings;
        break;
      case 'object':
        candidates = recentElements.objects;
        break;
      case 'plot_pattern':
        candidates = recentElements.plot_patterns;
        break;
      default:
        console.warn(`Unknown element type: ${elementType}`);
        return [];
    }

    // Compare against candidates
    const similarElements: SimilarElement[] = [];
    const normalizedNew = elementText.toLowerCase().trim();

    for (const candidate of candidates) {
      // Skip elements without embeddings
      if (
        !candidate.embeddingVector ||
        candidate.embeddingVector.length === 0
      ) {
        continue;
      }

      // Skip exact text matches
      const normalizedCandidate = candidate.elementText.toLowerCase().trim();
      if (normalizedNew === normalizedCandidate) {
        continue;
      }

      try {
        const similarity = calculateCosineSimilarity(
          elementEmbedding,
          candidate.embeddingVector,
        );

        if (similarity >= threshold) {
          similarElements.push({
            elementText: candidate.elementText,
            elementType: elementType,
            similarityScore: similarity,
            frequency: candidate.frequency,
            lastUsed: candidate.lastUsed,
          });
        }
      } catch (error) {
        console.warn(
          `Error calculating similarity for "${candidate.elementText}":`,
          error,
        );
        continue;
      }
    }

    // Sort by similarity score descending
    return similarElements.sort(
      (a, b) => b.similarityScore - a.similarityScore,
    );
  }

  /**
   * Batch find similar elements for multiple new elements
   *
   * Efficiently processes multiple elements at once, useful when analyzing
   * an entire newly generated story for repetition.
   *
   * @param elements - Array of elements to check
   * @param recentElements - Recent elements from session
   * @param threshold - Similarity threshold (default: 0.75)
   * @returns Map of element text to similar elements array
   *
   * @example
   * const elementsToCheck = [
   *   { elementText: 'dragon', elementType: 'character', elementEmbedding: [...] },
   *   { elementText: 'forest', elementType: 'setting', elementEmbedding: [...] }
   * ];
   * const results = batchFindSimilarElements(elementsToCheck, recentElements);
   * results.forEach((similar, elementText) => {
   *   console.log(`${elementText}: ${similar.length} similar elements`);
   * });
   */
  batchFindSimilarElements(
    elements: ElementToCheck[],
    recentElements: RecentElements,
    threshold: number = SimilarityDetectionService.DEFAULT_THRESHOLD,
  ): Map<string, SimilarElement[]> {
    const results = new Map<string, SimilarElement[]>();

    for (const element of elements) {
      const similar = this.findSimilarElementsByType(
        element.elementText,
        element.elementEmbedding,
        element.elementType,
        recentElements,
        threshold,
      );

      results.set(element.elementText, similar);
    }

    return results;
  }

  /**
   * Check if an element is novel (no similar matches)
   *
   * Convenience method to determine if an element is sufficiently different
   * from recent history.
   *
   * @param elementText - Element text to check
   * @param elementEmbedding - Element embedding
   * @param elementType - Element type
   * @param recentElements - Recent elements from session
   * @param threshold - Similarity threshold (default: 0.75)
   * @returns true if element has no similar matches, false otherwise
   *
   * @example
   * const isNew = isNovelElement('phoenix', embedding, 'character', recentElements);
   * console.log(isNew ? 'Novel element!' : 'Similar to recent elements');
   */
  isNovelElement(
    elementText: string,
    elementEmbedding: number[],
    elementType: 'character' | 'setting' | 'object' | 'plot_pattern',
    recentElements: RecentElements,
    threshold: number = SimilarityDetectionService.DEFAULT_THRESHOLD,
  ): boolean {
    const similar = this.findSimilarElementsByType(
      elementText,
      elementEmbedding,
      elementType,
      recentElements,
      threshold,
    );

    return similar.length === 0;
  }

  /**
   * Get statistics about similarity detection results
   *
   * Provides analytics about how many elements are repetitive vs novel
   *
   * @param elements - Array of elements to check
   * @param recentElements - Recent elements from session
   * @param threshold - Similarity threshold (default: 0.75)
   * @returns Statistics object with counts and percentages
   */
  getSimilarityStatistics(
    elements: ElementToCheck[],
    recentElements: RecentElements,
    threshold: number = SimilarityDetectionService.DEFAULT_THRESHOLD,
  ): {
    total: number;
    novel: number;
    repetitive: number;
    noveltyPercentage: number;
  } {
    let novelCount = 0;

    for (const element of elements) {
      const isNovel = this.isNovelElement(
        element.elementText,
        element.elementEmbedding,
        element.elementType,
        recentElements,
        threshold,
      );

      if (isNovel) {
        novelCount++;
      }
    }

    const total = elements.length;
    const repetitive = total - novelCount;
    const noveltyPercentage = total > 0 ? (novelCount / total) * 100 : 0;

    return {
      total,
      novel: novelCount,
      repetitive,
      noveltyPercentage,
    };
  }
}

// Export singleton instance
export const similarityDetectionService = new SimilarityDetectionService();

// Export for testing
export { SimilarityDetectionService };
