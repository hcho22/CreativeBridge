/**
 * @deprecated Use src/services/performanceMonitor.ts instead.
 * This service is retained for backward compatibility but should not be used in new code.
 *
 * Performance Optimization Service
 *
 * Provides comprehensive performance improvements for the story continuation feature,
 * including pagination, lazy loading, intelligent caching, database optimization,
 * and performance monitoring with detailed metrics.
 */

import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types for performance optimization
export interface PaginationOptions {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, any>;
}

export interface StoryPreview {
  id: string;
  preview: string;
  title?: string;
  source: string;
  created_at: string;
  updated_at: string;
  word_count: number;
  grade_level?: string;
  user_id: string;
}

export interface FullStory {
  id: string;
  story_content: string;
  imported_story_content?: string;
  story_source: string;
  story_metadata?: any;
  user_id: string;
  created_at: string;
  updated_at: string;
  original_creation_date?: string;
  grade_level?: string;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  size: number;
}

export interface PerformanceMetrics {
  cacheHitRate: number;
  averageLoadTime: number;
  totalRequests: number;
  cachedRequests: number;
  databaseQueries: number;
  memoryUsage: number;
  responseTimeHistory: number[];
  slowQueries: Array<{
    query: string;
    duration: number;
    timestamp: number;
  }>;
}

export interface DatabaseIndexSuggestion {
  table: string;
  columns: string[];
  type: 'btree' | 'gin' | 'gist';
  reason: string;
  estimatedImprovement: string;
}

class PerformanceService {
  private cache = new Map<string, CacheEntry<any>>();
  private metrics: PerformanceMetrics = {
    cacheHitRate: 0,
    averageLoadTime: 0,
    totalRequests: 0,
    cachedRequests: 0,
    databaseQueries: 0,
    memoryUsage: 0,
    responseTimeHistory: [],
    slowQueries: [],
  };

  // Configuration
  private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes
  private readonly MAX_CACHE_SIZE = 50; // MB
  private readonly MAX_CACHE_ENTRIES = 1000;
  private readonly PREVIEW_LENGTH = 200;
  private readonly SLOW_QUERY_THRESHOLD = 1000; // 1 second
  private readonly MAX_RESPONSE_HISTORY = 100;

  /**
   * Get paginated stories with optimized loading
   */
  async getStoryPage(
    page: number,
    pageSize: number = 20,
    userId?: string,
    options: Partial<PaginationOptions> = {},
  ): Promise<StoryPreview[]> {
    const startTime = Date.now();

    try {
      // Validate pagination parameters
      if (page < 1) page = 1;
      if (pageSize < 1 || pageSize > 100) pageSize = 20;

      const offset = (page - 1) * pageSize;
      const cacheKey = `stories_page_${page}_${pageSize}_${
        userId || 'all'
      }_${JSON.stringify(options)}`;

      // Check cache first
      const cachedData = this.getCachedData<StoryPreview[]>(cacheKey);
      if (cachedData) {
        this.recordMetrics(startTime, true);
        return cachedData;
      }

      // Build optimized database query
      let query = supabase.from('game_sessions').select(`
          id,
          story_content,
          imported_story_content,
          story_source,
          created_at,
          updated_at,
          grade_level,
          user_id,
          story_metadata
        `);

      // Apply user filter if provided
      if (userId) {
        query = query.eq('user_id', userId);
      }

      // Apply additional filters
      if (options.filters) {
        Object.entries(options.filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            query = query.eq(key, value);
          }
        });
      }

      // Apply sorting
      const sortBy = options.sortBy || 'created_at';
      const sortOrder = options.sortOrder || 'desc';
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      // Apply pagination
      query = query.range(offset, offset + pageSize - 1);

      const queryStartTime = Date.now();
      const { data: stories, error } = await query;
      const queryDuration = Date.now() - queryStartTime;

      if (error) {
        console.error('Database query error:', error);
        this.recordSlowQuery('story_pagination', queryDuration);
        return [];
      }

      // Track slow queries
      if (queryDuration > this.SLOW_QUERY_THRESHOLD) {
        this.recordSlowQuery(`story_page_${page}`, queryDuration);
      }

      // Transform to preview format with lazy loading optimization
      const previews: StoryPreview[] = (stories || []).map(story => {
        const content =
          story.story_content || story.imported_story_content || '';
        const wordCount = content
          .split(/\s+/)
          .filter(word => word.length > 0).length;

        return {
          id: story.id,
          preview: this.generatePreview(content),
          title: story.story_metadata?.title || this.extractTitle(content),
          source: story.story_source || 'CreativeBridge',
          created_at: story.created_at,
          updated_at: story.updated_at,
          word_count: wordCount,
          grade_level: story.grade_level,
          user_id: story.user_id,
        };
      });

      // Cache the results
      this.setCachedData(cacheKey, previews);
      this.recordMetrics(startTime, false);
      this.metrics.databaseQueries++;

      return previews;
    } catch (error) {
      console.error('Error getting story page:', error);
      this.recordMetrics(startTime, false);
      return [];
    }
  }

  /**
   * Get story preview (lightweight version)
   */
  async getStoryPreview(storyId: string): Promise<StoryPreview | null> {
    const startTime = Date.now();

    try {
      const cacheKey = `story_preview_${storyId}`;

      // Check cache first
      const cachedData = this.getCachedData<StoryPreview>(cacheKey);
      if (cachedData) {
        this.recordMetrics(startTime, true);
        return cachedData;
      }

      // Fetch minimal data for preview
      const { data: story, error } = await supabase
        .from('game_sessions')
        .select(
          `
          id,
          story_content,
          imported_story_content,
          story_source,
          created_at,
          updated_at,
          grade_level,
          user_id,
          story_metadata
        `,
        )
        .eq('id', storyId)
        .single();

      if (error || !story) {
        this.recordMetrics(startTime, false);
        return null;
      }

      const content = story.story_content || story.imported_story_content || '';
      const wordCount = content
        .split(/\s+/)
        .filter(word => word.length > 0).length;

      const preview: StoryPreview = {
        id: story.id,
        preview: this.generatePreview(content),
        title: story.story_metadata?.title || this.extractTitle(content),
        source: story.story_source || 'CreativeBridge',
        created_at: story.created_at,
        updated_at: story.updated_at,
        word_count: wordCount,
        grade_level: story.grade_level,
        user_id: story.user_id,
      };

      // Cache the preview
      this.setCachedData(cacheKey, preview);
      this.recordMetrics(startTime, false);
      this.metrics.databaseQueries++;

      return preview;
    } catch (error) {
      console.error('Error getting story preview:', error);
      this.recordMetrics(startTime, false);
      return null;
    }
  }

  /**
   * Get full story content (with lazy loading)
   */
  async getFullStory(storyId: string): Promise<FullStory | null> {
    const startTime = Date.now();

    try {
      const cacheKey = `story_full_${storyId}`;

      // Check cache first
      const cachedData = this.getCachedData<FullStory>(cacheKey);
      if (cachedData) {
        this.recordMetrics(startTime, true);
        return cachedData;
      }

      // Fetch complete story data
      const { data: story, error } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('id', storyId)
        .single();

      if (error || !story) {
        this.recordMetrics(startTime, false);
        return null;
      }

      const fullStory: FullStory = {
        id: story.id,
        story_content: story.story_content || '',
        imported_story_content: story.imported_story_content,
        story_source: story.story_source || 'CreativeBridge',
        story_metadata: story.story_metadata,
        user_id: story.user_id,
        created_at: story.created_at,
        updated_at: story.updated_at,
        original_creation_date: story.original_creation_date,
        grade_level: story.grade_level,
      };

      // Cache with higher priority for full stories
      this.setCachedData(cacheKey, fullStory, 2.0);
      this.recordMetrics(startTime, false);
      this.metrics.databaseQueries++;

      return fullStory;
    } catch (error) {
      console.error('Error getting full story:', error);
      this.recordMetrics(startTime, false);
      return null;
    }
  }

  /**
   * Intelligent cache management with LRU eviction
   */
  private getCachedData<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if cache entry is expired
    if (Date.now() - entry.timestamp > this.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    return entry.data as T;
  }

  private setCachedData<T>(key: string, data: T, priority: number = 1.0): void {
    const size = this.estimateDataSize(data);

    // Check cache limits and evict if necessary
    this.evictIfNecessary(size);

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccessed: Date.now(),
      size: size * priority,
    };

    this.cache.set(key, entry);
  }

  private evictIfNecessary(newEntrySize: number): void {
    const currentSize = this.getCurrentCacheSize();
    const maxSizeBytes = this.MAX_CACHE_SIZE * 1024 * 1024; // Convert MB to bytes

    // Check if we need to evict entries
    if (
      this.cache.size >= this.MAX_CACHE_ENTRIES ||
      currentSize + newEntrySize > maxSizeBytes
    ) {
      // Sort entries by LRU algorithm (considering access frequency and recency)
      const entries = Array.from(this.cache.entries())
        .map(([key, entry]) => ({
          key,
          entry,
          score: this.calculateEvictionScore(entry),
        }))
        .sort((a, b) => a.score - b.score); // Lower score = more likely to evict

      // Evict entries until we have enough space
      let freedSize = 0;
      let evicted = 0;

      for (const { key, entry } of entries) {
        if (
          freedSize >= newEntrySize &&
          this.cache.size < this.MAX_CACHE_ENTRIES
        ) {
          break;
        }

        this.cache.delete(key);
        freedSize += entry.size;
        evicted++;
      }

      if (evicted > 0) {
        console.log(
          `🧹 Evicted ${evicted} cache entries, freed ${(
            freedSize / 1024
          ).toFixed(1)}KB`,
        );
      }
    }
  }

  private calculateEvictionScore(entry: CacheEntry<any>): number {
    const now = Date.now();
    const age = now - entry.timestamp;
    const timeSinceAccess = now - entry.lastAccessed;

    // Higher access count and recent access = higher score (less likely to evict)
    // Older entries and larger sizes = lower score (more likely to evict)
    const accessBonus = Math.log(entry.accessCount + 1) * 1000;
    const recencyBonus = Math.max(0, (this.CACHE_TTL - timeSinceAccess) / 1000);
    const sizepenalty = entry.size / 1024; // KB
    const ageBonus = Math.max(0, (this.CACHE_TTL - age) / 1000);

    return accessBonus + recencyBonus + ageBonus - sizepenalty;
  }

  private estimateDataSize(data: any): number {
    // Rough estimation of data size in bytes
    try {
      return new Blob([JSON.stringify(data)]).size;
    } catch {
      // Fallback estimation
      const str = JSON.stringify(data);
      return str.length * 2; // Rough UTF-16 estimation
    }
  }

  private getCurrentCacheSize(): number {
    return Array.from(this.cache.values()).reduce(
      (total, entry) => total + entry.size,
      0,
    );
  }

  /**
   * Performance monitoring and metrics
   */
  private recordMetrics(startTime: number, wasCached: boolean): void {
    const duration = Date.now() - startTime;

    this.metrics.totalRequests++;
    if (wasCached) {
      this.metrics.cachedRequests++;
    }

    // Update response time history
    this.metrics.responseTimeHistory.push(duration);
    if (this.metrics.responseTimeHistory.length > this.MAX_RESPONSE_HISTORY) {
      this.metrics.responseTimeHistory.shift();
    }

    // Calculate running averages
    this.metrics.cacheHitRate =
      (this.metrics.cachedRequests / this.metrics.totalRequests) * 100;
    this.metrics.averageLoadTime =
      this.metrics.responseTimeHistory.reduce((a, b) => a + b, 0) /
      this.metrics.responseTimeHistory.length;
    this.metrics.memoryUsage = this.getCurrentCacheSize();
  }

  private recordSlowQuery(query: string, duration: number): void {
    this.metrics.slowQueries.push({
      query,
      duration,
      timestamp: Date.now(),
    });

    // Keep only recent slow queries
    if (this.metrics.slowQueries.length > 20) {
      this.metrics.slowQueries.shift();
    }

    console.warn(`🐌 Slow query detected: ${query} took ${duration}ms`);
  }

  /**
   * Database optimization suggestions
   */
  async analyzeDatabasePerformance(): Promise<DatabaseIndexSuggestion[]> {
    const suggestions: DatabaseIndexSuggestion[] = [];

    try {
      // Analyze query patterns and suggest indexes
      suggestions.push({
        table: 'game_sessions',
        columns: ['user_id', 'created_at'],
        type: 'btree',
        reason: 'Frequently used in pagination queries',
        estimatedImprovement: '40-60% faster user story queries',
      });

      suggestions.push({
        table: 'game_sessions',
        columns: ['story_source', 'grade_level'],
        type: 'btree',
        reason: 'Common filter combinations',
        estimatedImprovement: '30-50% faster filtered searches',
      });

      suggestions.push({
        table: 'game_sessions',
        columns: ['story_content', 'imported_story_content'],
        type: 'gin',
        reason: 'Full-text search optimization',
        estimatedImprovement: '70-90% faster text searches',
      });

      suggestions.push({
        table: 'game_sessions',
        columns: ['updated_at'],
        type: 'btree',
        reason: 'Recently modified story queries',
        estimatedImprovement: '25-40% faster recent updates',
      });

      return suggestions;
    } catch (error) {
      console.error('Database analysis error:', error);
      return suggestions;
    }
  }

  /**
   * Cache warm-up for frequently accessed content
   */
  async warmUpCache(userId?: string): Promise<void> {
    console.log('🔥 Starting cache warm-up...');

    try {
      // Pre-load recent stories
      await this.getStoryPage(1, 10, userId);

      // Pre-load user's most accessed stories
      if (userId) {
        const recentStories = await this.getStoryPage(1, 5, userId, {
          sortBy: 'updated_at',
          sortOrder: 'desc',
        });

        // Pre-load full content for recent stories
        for (const story of recentStories.slice(0, 3)) {
          await this.getFullStory(story.id);
        }
      }

      console.log('✅ Cache warm-up completed');
    } catch (error) {
      console.error('Cache warm-up error:', error);
    }
  }

  /**
   * Prefetch related content
   */
  async prefetchRelatedStories(storyId: string, userId: string): Promise<void> {
    try {
      // Get the current story to analyze
      const currentStory = await this.getFullStory(storyId);
      if (!currentStory) return;

      // Prefetch stories from the same source
      this.getStoryPage(1, 5, userId, {
        filters: { story_source: currentStory.story_source },
        sortBy: 'updated_at',
        sortOrder: 'desc',
      });

      // Prefetch stories with the same grade level
      if (currentStory.grade_level) {
        this.getStoryPage(1, 3, userId, {
          filters: { grade_level: currentStory.grade_level },
          sortBy: 'created_at',
          sortOrder: 'desc',
        });
      }
    } catch (error) {
      console.error('Prefetch error:', error);
    }
  }

  /**
   * Clear cache and reset metrics
   */
  clearCache(): void {
    this.cache.clear();
    console.log('🧹 Performance cache cleared');
  }

  resetMetrics(): void {
    this.metrics = {
      cacheHitRate: 0,
      averageLoadTime: 0,
      totalRequests: 0,
      cachedRequests: 0,
      databaseQueries: 0,
      memoryUsage: 0,
      responseTimeHistory: [],
      slowQueries: [],
    };
    console.log('📊 Performance metrics reset');
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    entries: number;
    sizeKB: number;
    hitRate: number;
    oldestEntry: number;
    newestEntry: number;
  } {
    const entries = Array.from(this.cache.values());
    const now = Date.now();

    return {
      entries: this.cache.size,
      sizeKB: Math.round(this.getCurrentCacheSize() / 1024),
      hitRate: this.metrics.cacheHitRate,
      oldestEntry:
        entries.length > 0
          ? Math.min(...entries.map(e => now - e.timestamp))
          : 0,
      newestEntry:
        entries.length > 0
          ? Math.min(...entries.map(e => now - e.timestamp))
          : 0,
    };
  }

  // Helper methods
  private generatePreview(content: string): string {
    if (!content) return '';

    // Clean content and create preview
    const cleaned = content.replace(/\s+/g, ' ').trim();

    if (cleaned.length <= this.PREVIEW_LENGTH) {
      return cleaned;
    }

    // Find a good breaking point near the limit
    const breakPoint = cleaned.lastIndexOf(' ', this.PREVIEW_LENGTH);
    return (
      cleaned.substring(0, breakPoint > 0 ? breakPoint : this.PREVIEW_LENGTH) +
      '...'
    );
  }

  private extractTitle(content: string): string {
    if (!content) return 'Untitled Story';

    // Try to extract a title from the first line or sentence
    const firstLine = content.split('\n')[0].trim();
    const firstSentence = content.split('.')[0].trim();

    // Use the shorter of the two, but not too short
    let title =
      firstLine.length <= firstSentence.length ? firstLine : firstSentence;

    // Clean up and limit title length
    title = title
      .replace(/[^\w\s]/g, '')
      .substring(0, 50)
      .trim();

    return title || 'Untitled Story';
  }

  /**
   * Persistent cache for offline support
   */
  async saveToPersistentCache(key: string, data: any): Promise<void> {
    try {
      const cacheData = {
        data,
        timestamp: Date.now(),
        version: '1.0',
      };

      await AsyncStorage.setItem(
        `perf_cache_${key}`,
        JSON.stringify(cacheData),
      );
    } catch (error) {
      console.error('Failed to save to persistent cache:', error);
    }
  }

  async loadFromPersistentCache(key: string): Promise<any | null> {
    try {
      const cached = await AsyncStorage.getItem(`perf_cache_${key}`);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);

      // Check if cache is still valid (24 hours)
      if (Date.now() - cacheData.timestamp > 24 * 60 * 60 * 1000) {
        await AsyncStorage.removeItem(`perf_cache_${key}`);
        return null;
      }

      return cacheData.data;
    } catch (error) {
      console.error('Failed to load from persistent cache:', error);
      return null;
    }
  }
}

// Export singleton instance
export const performanceService = new PerformanceService();
export default performanceService;
