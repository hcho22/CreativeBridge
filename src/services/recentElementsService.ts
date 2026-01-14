/**
 * Recent Elements Retrieval Service
 *
 * Retrieves recent story elements from a user session to detect repetition
 * and support diversity tracking.
 *
 * Part of the Story Diversity Tracking System (US-006)
 */

import { supabase } from './supabase';

/**
 * Story element with embedding for semantic comparison
 */
export interface StoredElement {
  id: string;
  storyId: string;
  sessionId: string;
  elementType: 'character' | 'setting' | 'object' | 'plot_pattern';
  elementText: string;
  embeddingVector: number[] | null;
  createdAt: Date;
}

/**
 * Recent elements grouped by type with frequency counts
 */
export interface RecentElements {
  characters: ElementWithFrequency[];
  settings: ElementWithFrequency[];
  objects: ElementWithFrequency[];
  plot_patterns: ElementWithFrequency[];
}

/**
 * Element with its frequency count within the window
 */
export interface ElementWithFrequency {
  elementText: string;
  embeddingVector: number[] | null;
  frequency: number;
  lastUsed: Date;
}

/**
 * Options for retrieving recent elements
 */
export interface GetRecentElementsOptions {
  sessionId: string;
  limit?: number; // Number of stories to look back (default: 10)
}

/**
 * Recent Elements Retrieval Service
 *
 * Queries the story_elements table to retrieve elements from recent stories
 * within a user's session. Elements are grouped by type and include frequency
 * counts to identify commonly repeated elements.
 */
class RecentElementsService {
  private static readonly DEFAULT_STORY_LIMIT = 10;

  /**
   * Get recent story elements for a session
   *
   * Retrieves elements from the last N stories in the session, groups them
   * by type (character, setting, object, plot_pattern), and calculates
   * frequency counts.
   *
   * @param options - Session ID and optional limit
   * @returns Promise<RecentElements> - Elements grouped by type with frequencies
   *
   * @example
   * const recent = await getRecentElements({
   *   sessionId: 'uuid-here',
   *   limit: 10
   * });
   * console.log(`Found ${recent.characters.length} unique characters`);
   * console.log(`"dragon" appeared ${recent.characters[0].frequency} times`);
   */
  async getRecentElements(
    options: GetRecentElementsOptions,
  ): Promise<RecentElements> {
    const { sessionId, limit = RecentElementsService.DEFAULT_STORY_LIMIT } =
      options;

    try {
      // Query story_elements table for recent elements in this session
      // Ordered by created_at DESC to get most recent first
      // Using index: idx_story_elements_session_id_created_at
      const { data: elements, error } = await supabase
        .from('story_elements')
        .select(
          'id, story_id, session_id, element_type, element_text, embedding_vector, created_at',
        )
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error retrieving recent elements:', error);
        throw new Error(`Failed to retrieve recent elements: ${error.message}`);
      }

      // If no elements found, return empty structure
      if (!elements || elements.length === 0) {
        return this.createEmptyRecentElements();
      }

      // Convert database rows to StoredElement interface
      const storedElements: StoredElement[] = elements.map(el => ({
        id: el.id,
        storyId: el.story_id,
        sessionId: el.session_id,
        elementType: el.element_type as
          | 'character'
          | 'setting'
          | 'object'
          | 'plot_pattern',
        elementText: el.element_text,
        embeddingVector: el.embedding_vector
          ? this.parseEmbedding(el.embedding_vector)
          : null,
        createdAt: new Date(el.created_at),
      }));

      // Get unique story IDs and limit to most recent N stories
      const uniqueStoryIds = this.getUniqueStoryIds(storedElements, limit);

      // Filter elements to only those from the most recent N stories
      const recentStoriesElements = storedElements.filter(el =>
        uniqueStoryIds.includes(el.storyId),
      );

      // Group elements by type and calculate frequencies
      return this.groupElementsByType(recentStoriesElements);
    } catch (error) {
      console.error('Error in getRecentElements:', error);
      throw error;
    }
  }

  /**
   * Parse embedding vector from database JSONB format
   *
   * Handles both array format and potential JSONB object format
   */
  private parseEmbedding(embeddingData: unknown): number[] | null {
    try {
      // If already an array, return it
      if (Array.isArray(embeddingData)) {
        return embeddingData;
      }

      // If it's a JSONB object, it might be stringified
      if (typeof embeddingData === 'string') {
        return JSON.parse(embeddingData);
      }

      console.warn('Unexpected embedding format:', typeof embeddingData);
      return null;
    } catch (error) {
      console.error('Error parsing embedding vector:', error);
      return null;
    }
  }

  /**
   * Get unique story IDs from elements, limited to most recent N stories
   *
   * Elements are already ordered by created_at DESC from database query,
   * so we can extract unique story IDs in order to get the most recent stories.
   */
  private getUniqueStoryIds(
    elements: StoredElement[],
    limit: number,
  ): string[] {
    const storyIds = new Set<string>();

    for (const element of elements) {
      storyIds.add(element.storyId);

      // Stop once we have enough stories
      if (storyIds.size >= limit) {
        break;
      }
    }

    return Array.from(storyIds);
  }

  /**
   * Group elements by type and calculate frequency counts
   *
   * For each element type, creates a map of element_text -> frequency
   * to identify commonly repeated elements.
   */
  private groupElementsByType(elements: StoredElement[]): RecentElements {
    const grouped: RecentElements = {
      characters: [],
      settings: [],
      objects: [],
      plot_patterns: [],
    };

    // Create maps to track frequency and latest usage for each unique element text
    const characterMap = new Map<
      string,
      { embedding: number[] | null; count: number; lastUsed: Date }
    >();
    const settingMap = new Map<
      string,
      { embedding: number[] | null; count: number; lastUsed: Date }
    >();
    const objectMap = new Map<
      string,
      { embedding: number[] | null; count: number; lastUsed: Date }
    >();
    const plotPatternMap = new Map<
      string,
      { embedding: number[] | null; count: number; lastUsed: Date }
    >();

    // Process each element
    for (const element of elements) {
      const map = this.getMapForElementType(element.elementType, {
        characterMap,
        settingMap,
        objectMap,
        plotPatternMap,
      });

      if (!map) continue;

      // Normalize element text for frequency counting (lowercase, trim)
      const normalizedText = element.elementText.toLowerCase().trim();

      if (map.has(normalizedText)) {
        const existing = map.get(normalizedText)!;
        existing.count++;

        // Update lastUsed to the most recent occurrence
        if (element.createdAt > existing.lastUsed) {
          existing.lastUsed = element.createdAt;
          // Update embedding to the most recent one
          if (element.embeddingVector) {
            existing.embedding = element.embeddingVector;
          }
        }
      } else {
        map.set(normalizedText, {
          embedding: element.embeddingVector,
          count: 1,
          lastUsed: element.createdAt,
        });
      }
    }

    // Convert maps to arrays
    grouped.characters = this.mapToElementArray(characterMap);
    grouped.settings = this.mapToElementArray(settingMap);
    grouped.objects = this.mapToElementArray(objectMap);
    grouped.plot_patterns = this.mapToElementArray(plotPatternMap);

    return grouped;
  }

  /**
   * Get the appropriate map for an element type
   */
  private getMapForElementType(
    elementType: string,
    maps: {
      characterMap: Map<
        string,
        { embedding: number[] | null; count: number; lastUsed: Date }
      >;
      settingMap: Map<
        string,
        { embedding: number[] | null; count: number; lastUsed: Date }
      >;
      objectMap: Map<
        string,
        { embedding: number[] | null; count: number; lastUsed: Date }
      >;
      plotPatternMap: Map<
        string,
        { embedding: number[] | null; count: number; lastUsed: Date }
      >;
    },
  ): Map<
    string,
    { embedding: number[] | null; count: number; lastUsed: Date }
  > | null {
    switch (elementType) {
      case 'character':
        return maps.characterMap;
      case 'setting':
        return maps.settingMap;
      case 'object':
        return maps.objectMap;
      case 'plot_pattern':
        return maps.plotPatternMap;
      default:
        console.warn(`Unknown element type: ${elementType}`);
        return null;
    }
  }

  /**
   * Convert a frequency map to an array of ElementWithFrequency
   * Sorted by frequency (descending) then by lastUsed (descending)
   */
  private mapToElementArray(
    map: Map<
      string,
      { embedding: number[] | null; count: number; lastUsed: Date }
    >,
  ): ElementWithFrequency[] {
    const array: ElementWithFrequency[] = [];

    for (const [text, data] of map.entries()) {
      array.push({
        elementText: text,
        embeddingVector: data.embedding,
        frequency: data.count,
        lastUsed: data.lastUsed,
      });
    }

    // Sort by frequency (most frequent first), then by most recently used
    return array.sort((a, b) => {
      if (b.frequency !== a.frequency) {
        return b.frequency - a.frequency;
      }
      return b.lastUsed.getTime() - a.lastUsed.getTime();
    });
  }

  /**
   * Create an empty RecentElements structure
   */
  private createEmptyRecentElements(): RecentElements {
    return {
      characters: [],
      settings: [],
      objects: [],
      plot_patterns: [],
    };
  }

  /**
   * Get total element count across all types
   *
   * Useful for analytics and diversity calculations
   */
  getTotalElementCount(recent: RecentElements): number {
    return (
      recent.characters.length +
      recent.settings.length +
      recent.objects.length +
      recent.plot_patterns.length
    );
  }

  /**
   * Get most frequently used elements across all types
   *
   * Returns the top N most repeated elements regardless of type
   */
  getMostFrequentElements(
    recent: RecentElements,
    topN: number = 5,
  ): Array<{ type: string; element: ElementWithFrequency }> {
    const allElements: Array<{ type: string; element: ElementWithFrequency }> =
      [
        ...recent.characters.map(el => ({ type: 'character', element: el })),
        ...recent.settings.map(el => ({ type: 'setting', element: el })),
        ...recent.objects.map(el => ({ type: 'object', element: el })),
        ...recent.plot_patterns.map(el => ({
          type: 'plot_pattern',
          element: el,
        })),
      ];

    return allElements
      .sort((a, b) => b.element.frequency - a.element.frequency)
      .slice(0, topN);
  }
}

// Export singleton instance
export const recentElementsService = new RecentElementsService();

// Export for testing
export { RecentElementsService };
