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
 * Cached recent elements with timestamp
 */
interface CachedRecentElements {
  data: RecentElements;
  timestamp: Date;
}

/**
 * Recent Elements Retrieval Service
 *
 * Queries the story_elements table to retrieve elements from recent stories
 * within a user's session. Elements are grouped by type and include frequency
 * counts to identify commonly repeated elements.
 *
 * Features LRU caching with 24-hour TTL to avoid redundant database queries.
 */
class RecentElementsService {
  private static readonly DEFAULT_STORY_LIMIT = 10;
  private static readonly CACHE_SIZE_LIMIT = 1000; // Max sessions to cache
  private static readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours (matches session duration)

  /**
   * In-memory cache: sessionId -> recent elements with timestamp
   * TTL matches session expiration (24 hours)
   */
  private recentElementsCache: Map<string, CachedRecentElements> = new Map();

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

    // Check cache first
    const cached = this.getCachedElements(sessionId);
    if (cached) {
      console.log('✅ Recent elements cache hit:', {
        sessionId: sessionId.substring(0, 12),
        cacheSize: this.recentElementsCache.size,
        totalElements: this.getTotalElementCount(cached),
      });
      return cached;
    }

    console.log('❌ Recent elements cache miss, querying database:', {
      sessionId: sessionId.substring(0, 12),
    });

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

      // If no elements found, cache and return empty structure
      if (!elements || elements.length === 0) {
        const emptyResult = this.createEmptyRecentElements();
        this.cacheElements(sessionId, emptyResult);
        return emptyResult;
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
      const recentElements = this.groupElementsByType(recentStoriesElements);

      // Cache the result
      this.cacheElements(sessionId, recentElements);

      return recentElements;
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

  /**
   * Get cached recent elements if available and not expired
   *
   * Checks cache for session and validates TTL (24 hours)
   *
   * @param sessionId - Session to retrieve from cache
   * @returns Cached recent elements if fresh, null otherwise
   */
  private getCachedElements(sessionId: string): RecentElements | null {
    const cached = this.recentElementsCache.get(sessionId);

    if (!cached) {
      return null;
    }

    // Check if cache entry has expired (TTL: 24 hours)
    const now = new Date();
    const ageMs = now.getTime() - cached.timestamp.getTime();

    if (ageMs > RecentElementsService.CACHE_TTL_MS) {
      // Cache entry expired, remove it
      this.recentElementsCache.delete(sessionId);
      console.log('🗑️  Recent elements cache expired:', {
        sessionId: sessionId.substring(0, 12),
        ageHours: (ageMs / (1000 * 60 * 60)).toFixed(2),
      });
      return null;
    }

    return cached.data;
  }

  /**
   * Cache recent elements with LRU eviction
   *
   * Uses TTL (24 hours) matching session duration.
   * If cache is full, removes oldest entry.
   *
   * @param sessionId - Session ID to cache for
   * @param elements - Recent elements to cache
   */
  private cacheElements(sessionId: string, elements: RecentElements): void {
    // If cache is at limit, remove oldest entry (first key in Map)
    if (
      this.recentElementsCache.size >= RecentElementsService.CACHE_SIZE_LIMIT
    ) {
      const firstKey = this.recentElementsCache.keys().next().value;
      if (firstKey) {
        this.recentElementsCache.delete(firstKey);
        console.log(
          '🗑️  Recent elements cache eviction (size limit reached):',
          {
            evictedSessionId: firstKey.substring(0, 12),
            newSize: this.recentElementsCache.size,
          },
        );
      }
    }

    this.recentElementsCache.set(sessionId, {
      data: elements,
      timestamp: new Date(),
    });

    console.log('💾 Recent elements cached:', {
      sessionId: sessionId.substring(0, 12),
      cacheSize: this.recentElementsCache.size,
      totalElements: this.getTotalElementCount(elements),
    });
  }

  /**
   * Invalidate cached recent elements for a session
   *
   * Called after new story elements are stored to ensure
   * fresh data on next retrieval.
   *
   * @param sessionId - Session to invalidate cache for
   */
  public invalidateCache(sessionId: string): void {
    const existed = this.recentElementsCache.delete(sessionId);

    if (existed) {
      console.log('🗑️  Recent elements cache invalidated:', {
        sessionId: sessionId.substring(0, 12),
        cacheSize: this.recentElementsCache.size,
      });
    }
  }

  /**
   * Clear entire cache
   *
   * Useful for testing or memory management.
   * Cache is automatically managed with LRU eviction and TTL, so manual clearing is rarely needed.
   */
  public clearCache(): void {
    const previousSize = this.recentElementsCache.size;
    this.recentElementsCache.clear();
    console.log('🗑️  Recent elements cache cleared:', {
      previousSize,
      newSize: 0,
    });
  }

  /**
   * Get cache statistics
   *
   * Useful for monitoring cache effectiveness and memory usage.
   *
   * @returns Cache size, limit, and hit/miss counts
   */
  public getCacheStats(): {
    size: number;
    limit: number;
    ttlHours: number;
  } {
    return {
      size: this.recentElementsCache.size,
      limit: RecentElementsService.CACHE_SIZE_LIMIT,
      ttlHours: RecentElementsService.CACHE_TTL_MS / (1000 * 60 * 60),
    };
  }
}

// Export singleton instance
export const recentElementsService = new RecentElementsService();

// Export for testing
export { RecentElementsService };
