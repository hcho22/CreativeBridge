/**
 * Diversity Score Calculation Service
 *
 * Quantitatively measures story diversity by comparing new elements against
 * recent history. Combines novelty detection with semantic distance analysis.
 *
 * Part of the Story Diversity Tracking System (US-011)
 */

import { similarityDetectionService } from './similarityDetectionService';
import type { RecentElements } from './recentElementsService';
import type { ExtractedElements } from './storyElementExtractionService';

/**
 * Element for diversity scoring
 */
export interface ElementForScoring {
  elementText: string;
  elementType: 'character' | 'setting' | 'object' | 'plot_pattern';
  elementEmbedding: number[];
}

/**
 * Diversity score calculation result
 */
export interface DiversityScore {
  score: number; // Overall diversity score (0.0 - 1.0)
  novelElementCount: number; // Number of novel elements
  totalElementCount: number; // Total number of elements analyzed
  noveltyRatio: number; // novel_elements / total_elements
  avgSemanticDistance: number; // Average semantic distance factor
  elementBreakdown: {
    characters: ElementTypeScore;
    settings: ElementTypeScore;
    objects: ElementTypeScore;
    plot_patterns: ElementTypeScore;
  };
}

/**
 * Diversity score for a specific element type
 */
export interface ElementTypeScore {
  novel: number; // Number of novel elements
  total: number; // Total elements of this type
  avgDistance: number; // Average semantic distance
}

/**
 * Options for diversity score calculation
 */
export interface CalculateDiversityScoreOptions {
  newElements: ElementForScoring[];
  recentElements: RecentElements;
  similarityThreshold?: number; // Threshold for novel element detection (default: 0.75)
}

/**
 * Diversity Score Service
 *
 * Calculates quantitative diversity scores for story elements.
 *
 * Formula: diversity_score = (novel_elements / total_elements) * avg_semantic_distance_factor
 *
 * Where:
 * - novel_elements: Elements with no similar match (similarity < threshold) in recent history
 * - total_elements: All elements in the new story
 * - avg_semantic_distance_factor: Average of (1 - max_similarity_score) for each element
 *
 * Score interpretation:
 * - 1.0: Completely novel (all elements are unique)
 * - 0.7-0.9: High diversity (mostly fresh elements)
 * - 0.4-0.6: Moderate diversity (mix of novel and repeated)
 * - 0.0-0.3: Low diversity (mostly repeated elements)
 */
class DiversityScoreService {
  private static readonly DEFAULT_SIMILARITY_THRESHOLD = 0.75;

  /**
   * Calculate diversity score for new story elements
   *
   * Compares new elements against recent history to determine how novel
   * and diverse the story is.
   *
   * @param options - Calculation options
   * @returns Diversity score with detailed breakdown
   *
   * @example
   * const score = calculateDiversityScore({
   *   newElements: extractedElements,
   *   recentElements: await getRecentElements({ sessionId })
   * });
   *
   * if (score.score < 0.4) {
   *   console.warn('Low diversity detected:', score);
   * }
   */
  calculateDiversityScore(
    options: CalculateDiversityScoreOptions,
  ): DiversityScore {
    const {
      newElements,
      recentElements,
      similarityThreshold = DiversityScoreService.DEFAULT_SIMILARITY_THRESHOLD,
    } = options;

    // Handle edge case: no new elements
    if (newElements.length === 0) {
      return {
        score: 0.0,
        novelElementCount: 0,
        totalElementCount: 0,
        noveltyRatio: 0.0,
        avgSemanticDistance: 0.0,
        elementBreakdown: {
          characters: { novel: 0, total: 0, avgDistance: 0.0 },
          settings: { novel: 0, total: 0, avgDistance: 0.0 },
          objects: { novel: 0, total: 0, avgDistance: 0.0 },
          plot_patterns: { novel: 0, total: 0, avgDistance: 0.0 },
        },
      };
    }

    // Handle edge case: no recent elements (first story in session)
    // All elements are novel, perfect diversity
    const hasRecentElements =
      recentElements.characters.length > 0 ||
      recentElements.settings.length > 0 ||
      recentElements.objects.length > 0 ||
      recentElements.plot_patterns.length > 0;

    if (!hasRecentElements) {
      // Count only elements with valid embeddings
      const validElementCount = newElements.filter(
        e => e.elementEmbedding && e.elementEmbedding.length > 0,
      ).length;

      const breakdown = this.calculateElementBreakdown(
        newElements,
        recentElements,
        similarityThreshold,
      );

      return {
        score: 1.0,
        novelElementCount: validElementCount,
        totalElementCount: validElementCount,
        noveltyRatio: 1.0,
        avgSemanticDistance: 1.0,
        elementBreakdown: breakdown,
      };
    }

    // Calculate novelty and semantic distance for each element
    let novelCount = 0;
    const semanticDistances: number[] = [];

    for (const element of newElements) {
      // Skip elements without embeddings
      if (!element.elementEmbedding || element.elementEmbedding.length === 0) {
        console.warn(
          `Skipping element without embedding: "${element.elementText}"`,
        );
        continue;
      }

      // Find similar elements in recent history
      const similarElements =
        similarityDetectionService.findSimilarElementsByType(
          element.elementText,
          element.elementEmbedding,
          element.elementType,
          recentElements,
          similarityThreshold,
        );

      // Check if element is novel (no similar matches)
      const isNovel = similarElements.length === 0;
      if (isNovel) {
        novelCount++;
      }

      // Calculate semantic distance factor
      // If novel, distance = 1.0 (maximum distance)
      // If similar, distance = 1 - max_similarity_score
      const maxSimilarity = isNovel
        ? 0.0
        : Math.max(...similarElements.map(s => s.similarityScore));
      const semanticDistance = 1.0 - maxSimilarity;

      semanticDistances.push(semanticDistance);
    }

    // Calculate metrics
    const totalElements = semanticDistances.length; // Only count elements with embeddings
    const noveltyRatio = totalElements > 0 ? novelCount / totalElements : 0.0;
    const avgSemanticDistance =
      totalElements > 0
        ? semanticDistances.reduce((sum, d) => sum + d, 0) / totalElements
        : 0.0;

    // Calculate final diversity score
    const score = noveltyRatio * avgSemanticDistance;

    // Calculate element type breakdown
    const elementBreakdown = this.calculateElementBreakdown(
      newElements,
      recentElements,
      similarityThreshold,
    );

    return {
      score: Math.max(0.0, Math.min(1.0, score)), // Clamp to [0, 1]
      novelElementCount: novelCount,
      totalElementCount: totalElements,
      noveltyRatio,
      avgSemanticDistance,
      elementBreakdown,
    };
  }

  /**
   * Calculate diversity breakdown by element type
   *
   * Provides per-category diversity metrics for detailed analysis
   *
   * @param newElements - New elements to analyze
   * @param recentElements - Recent elements from session
   * @param similarityThreshold - Threshold for novelty detection
   * @returns Breakdown by element type
   */
  private calculateElementBreakdown(
    newElements: ElementForScoring[],
    recentElements: RecentElements,
    similarityThreshold: number,
  ): {
    characters: ElementTypeScore;
    settings: ElementTypeScore;
    objects: ElementTypeScore;
    plot_patterns: ElementTypeScore;
  } {
    const types: Array<'character' | 'setting' | 'object' | 'plot_pattern'> = [
      'character',
      'setting',
      'object',
      'plot_pattern',
    ];

    const breakdown: any = {};

    for (const type of types) {
      const elementsOfType = newElements.filter(
        e =>
          e.elementType === type &&
          e.elementEmbedding &&
          e.elementEmbedding.length > 0,
      );

      if (elementsOfType.length === 0) {
        breakdown[`${type}s`] = { novel: 0, total: 0, avgDistance: 0.0 };
        continue;
      }

      let novelCount = 0;
      const distances: number[] = [];

      for (const element of elementsOfType) {
        // Only find similar elements if there are recent elements to compare against
        const hasRecentElementsOfType =
          recentElements.characters.length > 0 ||
          recentElements.settings.length > 0 ||
          recentElements.objects.length > 0 ||
          recentElements.plot_patterns.length > 0;

        let isNovel = true;
        let maxSimilarity = 0.0;

        if (hasRecentElementsOfType) {
          const similarElements =
            similarityDetectionService.findSimilarElementsByType(
              element.elementText,
              element.elementEmbedding,
              element.elementType,
              recentElements,
              similarityThreshold,
            );

          isNovel = similarElements.length === 0;
          maxSimilarity = isNovel
            ? 0.0
            : Math.max(...similarElements.map(s => s.similarityScore));
        }

        if (isNovel) {
          novelCount++;
        }

        const distance = 1.0 - maxSimilarity;
        distances.push(distance);
      }

      const avgDistance =
        distances.length > 0
          ? distances.reduce((sum, d) => sum + d, 0) / distances.length
          : 0.0;

      breakdown[`${type}s`] = {
        novel: novelCount,
        total: elementsOfType.length,
        avgDistance,
      };
    }

    return breakdown;
  }

  /**
   * Convert extracted elements to scoring format
   *
   * Helper to convert from storyElementExtractionService format to
   * ElementForScoring format needed for diversity calculation.
   *
   * @param extractedElements - Elements from extraction service
   * @param embeddings - Corresponding embeddings (same order)
   * @returns Elements ready for scoring
   *
   * @example
   * const elements = await extractStoryElements(storyText);
   * const embeddings = await generateEmbeddingsBatch([...]);
   * const scoringElements = convertToScoringFormat(elements, embeddings);
   */
  convertToScoringFormat(
    extractedElements: ExtractedElements,
    embeddings: Map<string, number[]>,
  ): ElementForScoring[] {
    const result: ElementForScoring[] = [];

    // Convert characters
    for (const character of extractedElements.characters) {
      const embedding = embeddings.get(character.name.toLowerCase().trim());
      if (embedding) {
        result.push({
          elementText: character.name,
          elementType: 'character',
          elementEmbedding: embedding,
        });
      }
    }

    // Convert settings
    for (const setting of extractedElements.settings) {
      const embedding = embeddings.get(setting.location.toLowerCase().trim());
      if (embedding) {
        result.push({
          elementText: setting.location,
          elementType: 'setting',
          elementEmbedding: embedding,
        });
      }
    }

    // Convert objects
    for (const object of extractedElements.objects) {
      const embedding = embeddings.get(object.name.toLowerCase().trim());
      if (embedding) {
        result.push({
          elementText: object.name,
          elementType: 'object',
          elementEmbedding: embedding,
        });
      }
    }

    // Convert plot patterns
    for (const pattern of extractedElements.plot_patterns) {
      const embedding = embeddings.get(pattern.action.toLowerCase().trim());
      if (embedding) {
        result.push({
          elementText: pattern.action,
          elementType: 'plot_pattern',
          elementEmbedding: embedding,
        });
      }
    }

    return result;
  }

  /**
   * Classify diversity score into human-readable category
   *
   * @param score - Diversity score (0.0 - 1.0)
   * @returns Category label
   */
  classifyDiversityScore(
    score: number,
  ): 'very_low' | 'low' | 'moderate' | 'high' | 'very_high' {
    if (score < 0.2) return 'very_low';
    if (score < 0.4) return 'low';
    if (score < 0.6) return 'moderate';
    if (score < 0.8) return 'high';
    return 'very_high';
  }

  /**
   * Check if diversity score is below warning threshold
   *
   * @param score - Diversity score
   * @param threshold - Warning threshold (default: 0.4)
   * @returns true if score is below threshold
   */
  isLowDiversity(score: number, threshold: number = 0.4): boolean {
    return score < threshold;
  }
}

// Export singleton instance
export const diversityScoreService = new DiversityScoreService();

// Export types
export type { ExtractedElements } from './storyElementExtractionService';
