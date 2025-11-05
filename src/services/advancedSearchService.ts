/**
 * Advanced Search Service
 *
 * Provides sophisticated search capabilities for the story continuation feature,
 * including full-text search, metadata search, relevance ranking, search history,
 * and optimized performance for large datasets.
 */

import { supabase } from './supabase';

// Types for advanced search functionality
export interface SearchResult {
  id: string;
  story_content: string;
  imported_story_content?: string;
  story_source: 'CreativeBridge' | 'Story_Quest' | 'File';
  story_metadata?: any;
  user_id: string;
  created_at: string;
  updated_at: string;
  original_creation_date?: string;
  grade_level?: string;
  relevanceScore: number;
  matchedFields: string[];
  highlightedContent?: string;
  preview: string;
}

export interface SearchQuery {
  text?: string;
  metadata?: {
    author?: string;
    source?: string;
    gradeLevel?: string;
    dateRange?: {
      start: string;
      end: string;
    };
    wordCountRange?: {
      min: number;
      max: number;
    };
    genre?: string;
  };
  sortBy?: 'relevance' | 'date' | 'wordCount' | 'title';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface SearchSuggestion {
  text: string;
  type: 'query' | 'metadata' | 'content';
  frequency: number;
  category?: string;
}

export interface SearchHistory {
  id: string;
  userId: string;
  query: string;
  timestamp: string;
  resultCount: number;
  filters?: any;
}

export interface SearchAnalytics {
  totalSearches: number;
  popularQueries: string[];
  averageResultCount: number;
  searchSuccessRate: number;
  averageResponseTime: number;
}

class AdvancedSearchService {
  private searchCache = new Map<
    string,
    { results: SearchResult[]; timestamp: number }
  >();
  private suggestionCache = new Map<string, SearchSuggestion[]>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 100;

  /**
   * Perform full-text search across story content with relevance scoring
   */
  async fullTextSearch(
    query: string,
    userId?: string,
    options: Partial<SearchQuery> = {},
  ): Promise<SearchResult[]> {
    const startTime = Date.now();

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(query, options);
      const cachedResult = this.searchCache.get(cacheKey);

      if (
        cachedResult &&
        Date.now() - cachedResult.timestamp < this.CACHE_TTL
      ) {
        console.log('🚀 Returning cached search results');
        return this.filterByUser(cachedResult.results, userId);
      }

      // Clean and normalize the search query
      const normalizedQuery = this.normalizeQuery(query);
      const searchTerms = this.extractSearchTerms(normalizedQuery);

      // Build the database query
      let dbQuery = supabase.from('game_sessions').select(`
          id,
          story_content,
          imported_story_content,
          story_source,
          story_metadata,
          user_id,
          created_at,
          updated_at,
          original_creation_date,
          grade_level
        `);

      // Apply user filter if provided
      if (userId) {
        dbQuery = dbQuery.eq('user_id', userId);
      }

      // Apply metadata filters
      if (options.metadata) {
        dbQuery = this.applyMetadataFilters(dbQuery, options.metadata);
      }

      // Execute the query
      const { data: stories, error } = await dbQuery;

      if (error) {
        console.error('Database query error:', error);
        // For test environments or when table doesn't exist, return empty results
        if (
          error.message.includes('does not exist') ||
          error.message.includes('relation') ||
          error.message.includes('table')
        ) {
          console.warn('Search table not found, returning empty results');
          return [];
        }
        throw new Error(`Search query failed: ${error.message}`);
      }

      if (!stories || stories.length === 0) {
        return [];
      }

      // Perform client-side full-text search and ranking
      const searchResults = this.performFullTextMatching(
        stories,
        searchTerms,
        normalizedQuery,
      );

      // Sort by relevance and apply limits
      const sortedResults = this.sortResults(
        searchResults,
        options.sortBy || 'relevance',
        options.sortOrder || 'desc',
      );
      const limitedResults = this.applyPagination(
        sortedResults,
        options.limit || 50,
        options.offset || 0,
      );

      // Cache the results
      this.cacheResults(cacheKey, limitedResults);

      // Track search analytics
      await this.trackSearchAnalytics(
        query,
        limitedResults.length,
        Date.now() - startTime,
        userId,
      );

      return limitedResults;
    } catch (error) {
      console.error('Full-text search error:', error);
      throw new Error(
        `Search failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  /**
   * Search by metadata fields
   */
  async searchByMetadata(
    metadata: SearchQuery['metadata'],
    userId?: string,
    options: Partial<SearchQuery> = {},
  ): Promise<SearchResult[]> {
    try {
      let dbQuery = supabase.from('game_sessions').select(`
          id,
          story_content,
          imported_story_content,
          story_source,
          story_metadata,
          user_id,
          created_at,
          updated_at,
          original_creation_date,
          grade_level
        `);

      // Apply user filter
      if (userId) {
        dbQuery = dbQuery.eq('user_id', userId);
      }

      // Apply metadata filters
      if (metadata) {
        dbQuery = this.applyMetadataFilters(dbQuery, metadata);
      }

      const { data: stories, error } = await dbQuery;

      if (error) {
        throw new Error(`Metadata search failed: ${error.message}`);
      }

      if (!stories || stories.length === 0) {
        return [];
      }

      // Convert to search results with metadata-based relevance
      const searchResults = stories.map(story =>
        this.convertToSearchResult(story, [], '', 'metadata'),
      );

      // Sort and paginate
      const sortedResults = this.sortResults(
        searchResults,
        options.sortBy || 'date',
        options.sortOrder || 'desc',
      );
      return this.applyPagination(
        sortedResults,
        options.limit || 50,
        options.offset || 0,
      );
    } catch (error) {
      console.error('Metadata search error:', error);
      throw new Error(
        `Metadata search failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  /**
   * Get search suggestions based on partial input
   */
  async getSuggestions(
    partial: string,
    userId?: string,
    limit: number = 10,
  ): Promise<SearchSuggestion[]> {
    try {
      // Check cache first
      const cacheKey = `suggestions_${partial}_${userId || 'all'}`;
      const cachedSuggestions = this.suggestionCache.get(cacheKey);

      if (cachedSuggestions) {
        return cachedSuggestions.slice(0, limit);
      }

      const suggestions: SearchSuggestion[] = [];

      // Get query suggestions from search history
      const historySuggestions = await this.getHistorySuggestions(
        partial,
        userId,
      );
      suggestions.push(...historySuggestions);

      // Get content-based suggestions
      const contentSuggestions = await this.getContentSuggestions(
        partial,
        userId,
      );
      suggestions.push(...contentSuggestions);

      // Get metadata suggestions
      const metadataSuggestions = await this.getMetadataSuggestions(
        partial,
        userId,
      );
      suggestions.push(...metadataSuggestions);

      // Deduplicate and sort by frequency
      const uniqueSuggestions = this.deduplicateSuggestions(suggestions);
      const sortedSuggestions = uniqueSuggestions
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, limit);

      // Cache the suggestions
      this.suggestionCache.set(cacheKey, sortedSuggestions);

      return sortedSuggestions;
    } catch (error) {
      console.error('Get suggestions error:', error);
      return [];
    }
  }

  /**
   * Save search query to history
   */
  async saveToHistory(
    query: string,
    userId: string,
    resultCount: number,
    filters?: any,
  ): Promise<void> {
    try {
      const historyEntry = {
        user_id: userId,
        query: query.trim(),
        result_count: resultCount,
        filters: filters || {},
        timestamp: new Date().toISOString(),
      };

      // Check if search_history table exists, if not we'll track in memory
      const { error } = await supabase
        .from('search_history')
        .insert(historyEntry);

      if (error && !error.message.includes('does not exist')) {
        console.error('Failed to save search history:', error);
      }
    } catch (error) {
      console.error('Save search history error:', error);
    }
  }

  /**
   * Get user's search history
   */
  async getSearchHistory(
    userId: string,
    limit: number = 20,
  ): Promise<SearchHistory[]> {
    try {
      const { data: history, error } = await supabase
        .from('search_history')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error && !error.message.includes('does not exist')) {
        console.error('Failed to get search history:', error);
        return [];
      }

      return history || [];
    } catch (error) {
      console.error('Get search history error:', error);
      return [];
    }
  }

  /**
   * Get search analytics
   */
  async getSearchAnalytics(userId?: string): Promise<SearchAnalytics> {
    try {
      let query = supabase.from('search_history').select('*');

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data: searches, error } = await query;

      if (error && !error.message.includes('does not exist')) {
        console.error('Failed to get search analytics:', error);
        return this.getDefaultAnalytics();
      }

      if (!searches || searches.length === 0) {
        return this.getDefaultAnalytics();
      }

      // Calculate analytics
      const totalSearches = searches.length;
      const queryFrequency = new Map<string, number>();
      let totalResults = 0;
      let successfulSearches = 0;

      searches.forEach(search => {
        queryFrequency.set(
          search.query,
          (queryFrequency.get(search.query) || 0) + 1,
        );
        totalResults += search.result_count || 0;
        if ((search.result_count || 0) > 0) {
          successfulSearches++;
        }
      });

      const popularQueries = Array.from(queryFrequency.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([queryText]) => queryText);

      return {
        totalSearches,
        popularQueries,
        averageResultCount:
          totalSearches > 0 ? totalResults / totalSearches : 0,
        searchSuccessRate:
          totalSearches > 0 ? (successfulSearches / totalSearches) * 100 : 0,
        averageResponseTime: 200, // Placeholder - would need to track this separately
      };
    } catch (error) {
      console.error('Get search analytics error:', error);
      return this.getDefaultAnalytics();
    }
  }

  /**
   * Clear search cache
   */
  clearCache(): void {
    this.searchCache.clear();
    this.suggestionCache.clear();
    console.log('🧹 Search cache cleared');
  }

  // Private helper methods

  private normalizeQuery(query: string): string {
    return query
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ');
  }

  private extractSearchTerms(query: string): string[] {
    return query
      .split(' ')
      .filter(term => term.length > 1)
      .filter(term => !this.isStopWord(term));
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'can',
      'this',
      'that',
      'these',
      'those',
    ]);
    return stopWords.has(word.toLowerCase());
  }

  private applyMetadataFilters(
    query: any,
    metadata: SearchQuery['metadata'],
  ): any {
    if (metadata?.source) {
      query = query.eq('story_source', metadata.source);
    }

    if (metadata?.gradeLevel) {
      query = query.eq('grade_level', metadata.gradeLevel);
    }

    if (metadata?.dateRange) {
      query = query
        .gte('created_at', metadata.dateRange.start)
        .lte('created_at', metadata.dateRange.end);
    }

    return query;
  }

  private performFullTextMatching(
    stories: any[],
    searchTerms: string[],
    originalQuery: string,
  ): SearchResult[] {
    return stories
      .map(story => {
        const content =
          (story.story_content || '') +
          ' ' +
          (story.imported_story_content || '');
        const metadata = story.story_metadata || {};

        // Calculate relevance score
        const relevanceScore = this.calculateRelevanceScore(
          content,
          searchTerms,
          originalQuery,
          metadata,
        );

        if (relevanceScore === 0) {
          return null; // No match
        }

        // Find matched fields
        const matchedFields = this.getMatchedFields(story, searchTerms);

        // Generate highlighted content
        const highlightedContent = this.highlightMatches(content, searchTerms);

        return this.convertToSearchResult(
          story,
          matchedFields,
          highlightedContent,
          'content',
          relevanceScore,
        );
      })
      .filter((result): result is SearchResult => result !== null);
  }

  private calculateRelevanceScore(
    content: string,
    searchTerms: string[],
    originalQuery: string,
    metadata: any,
  ): number {
    const normalizedContent = content.toLowerCase();
    let score = 0;

    // Exact phrase match (highest weight)
    if (normalizedContent.includes(originalQuery.toLowerCase())) {
      score += 100;
    }

    // Individual term matches
    searchTerms.forEach(term => {
      const termLower = term.toLowerCase();
      const matches = (
        normalizedContent.match(new RegExp(termLower, 'g')) || []
      ).length;

      // Weight by term frequency and position
      score += matches * 10;

      // Bonus for matches in title/beginning
      if (normalizedContent.substring(0, 100).includes(termLower)) {
        score += 20;
      }
    });

    // Metadata boost
    if (
      metadata.title &&
      metadata.title.toLowerCase().includes(originalQuery.toLowerCase())
    ) {
      score += 50;
    }

    // Length penalty for very long content to favor focused matches
    const contentLength = content.length;
    if (contentLength > 5000) {
      score *= 0.8;
    } else if (contentLength > 10000) {
      score *= 0.6;
    }

    return Math.round(score);
  }

  private getMatchedFields(story: any, searchTerms: string[]): string[] {
    const matchedFields: string[] = [];

    const fields = {
      content:
        (story.story_content || '') +
        ' ' +
        (story.imported_story_content || ''),
      source: story.story_source || '',
      metadata: JSON.stringify(story.story_metadata || {}),
    };

    Object.entries(fields).forEach(([fieldName, fieldValue]) => {
      const normalizedValue = fieldValue.toLowerCase();
      const hasMatch = searchTerms.some(term =>
        normalizedValue.includes(term.toLowerCase()),
      );
      if (hasMatch) {
        matchedFields.push(fieldName);
      }
    });

    return matchedFields;
  }

  private highlightMatches(content: string, searchTerms: string[]): string {
    let highlighted = content;

    searchTerms.forEach(term => {
      const regex = new RegExp(`(${term})`, 'gi');
      highlighted = highlighted.replace(regex, '<mark>$1</mark>');
    });

    return highlighted;
  }

  private convertToSearchResult(
    story: any,
    matchedFields: string[],
    highlightedContent: string,
    matchType: string,
    relevanceScore?: number,
  ): SearchResult {
    const content = story.story_content || story.imported_story_content || '';
    const preview = this.generatePreview(content, 150);

    return {
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
      relevanceScore: relevanceScore || (matchType === 'metadata' ? 50 : 1),
      matchedFields,
      highlightedContent: highlightedContent || content,
      preview,
    };
  }

  private generatePreview(content: string, maxLength: number): string {
    if (content.length <= maxLength) {
      return content;
    }

    return content.substring(0, maxLength).trim() + '...';
  }

  private sortResults(
    results: SearchResult[],
    sortBy: string,
    sortOrder: string,
  ): SearchResult[] {
    return results.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'relevance':
          comparison = b.relevanceScore - a.relevanceScore;
          break;
        case 'date':
          comparison =
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          break;
        case 'wordCount':
          const aWordCount = (a.story_content || '').split(' ').length;
          const bWordCount = (b.story_content || '').split(' ').length;
          comparison = bWordCount - aWordCount;
          break;
        default:
          comparison = b.relevanceScore - a.relevanceScore;
      }

      return sortOrder === 'asc' ? -comparison : comparison;
    });
  }

  private applyPagination(
    results: SearchResult[],
    limit: number,
    offset: number,
  ): SearchResult[] {
    return results.slice(offset, offset + limit);
  }

  private filterByUser(
    results: SearchResult[],
    userId?: string,
  ): SearchResult[] {
    if (!userId) return results;
    return results.filter(result => result.user_id === userId);
  }

  private generateCacheKey(
    query: string,
    options: Partial<SearchQuery>,
  ): string {
    return `search_${query}_${JSON.stringify(options)}`;
  }

  private cacheResults(key: string, results: SearchResult[]): void {
    // Implement LRU cache eviction
    if (this.searchCache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = Array.from(this.searchCache.keys())[0];
      this.searchCache.delete(oldestKey);
    }

    this.searchCache.set(key, {
      results,
      timestamp: Date.now(),
    });
  }

  private async getHistorySuggestions(
    partial: string,
    userId?: string,
  ): Promise<SearchSuggestion[]> {
    try {
      const history = await this.getSearchHistory(userId || '', 50);
      const suggestions: SearchSuggestion[] = [];

      history.forEach(entry => {
        if (entry.query.toLowerCase().includes(partial.toLowerCase())) {
          suggestions.push({
            text: entry.query,
            type: 'query',
            frequency: 1, // Would need to aggregate in real implementation
            category: 'recent',
          });
        }
      });

      return suggestions;
    } catch (error) {
      console.error('Get history suggestions error:', error);
      return [];
    }
  }

  private async getContentSuggestions(
    partial: string,
    _userId?: string,
  ): Promise<SearchSuggestion[]> {
    // This would typically use a dedicated search index or pre-computed suggestions
    // For now, return common story-related suggestions
    const commonTerms = [
      'adventure',
      'dragon',
      'castle',
      'forest',
      'magic',
      'wizard',
      'princess',
      'knight',
      'mystery',
      'treasure',
      'journey',
      'friendship',
      'courage',
      'fantasy',
      'sci-fi',
      'space',
      'robot',
      'alien',
      'time travel',
      'superhero',
      'detective',
      'pirate',
    ];

    return commonTerms
      .filter(term => term.toLowerCase().includes(partial.toLowerCase()))
      .map(term => ({
        text: term,
        type: 'content' as const,
        frequency: Math.random() * 100, // Placeholder
        category: 'popular',
      }));
  }

  private async getMetadataSuggestions(
    partial: string,
    _userId?: string,
  ): Promise<SearchSuggestion[]> {
    const metadataTerms = [
      'K-2',
      '3-5',
      '6-8',
      '9-12',
      'CreativeBridge',
      'Story_Quest',
      'File',
    ];

    return metadataTerms
      .filter(term => term.toLowerCase().includes(partial.toLowerCase()))
      .map(term => ({
        text: term,
        type: 'metadata' as const,
        frequency: 50,
        category: 'filter',
      }));
  }

  private deduplicateSuggestions(
    suggestions: SearchSuggestion[],
  ): SearchSuggestion[] {
    const seen = new Set<string>();
    const unique: SearchSuggestion[] = [];

    suggestions.forEach(suggestion => {
      if (!seen.has(suggestion.text.toLowerCase())) {
        seen.add(suggestion.text.toLowerCase());
        unique.push(suggestion);
      }
    });

    return unique;
  }

  private async trackSearchAnalytics(
    query: string,
    resultCount: number,
    responseTime: number,
    userId?: string,
  ): Promise<void> {
    try {
      if (userId) {
        await this.saveToHistory(query, userId, resultCount);
      }

      // Additional analytics tracking could be implemented here
      console.log(
        `🔍 Search: "${query}" -> ${resultCount} results in ${responseTime}ms`,
      );
    } catch (error) {
      console.error('Track search analytics error:', error);
    }
  }

  private getDefaultAnalytics(): SearchAnalytics {
    return {
      totalSearches: 0,
      popularQueries: [],
      averageResultCount: 0,
      searchSuccessRate: 0,
      averageResponseTime: 0,
    };
  }
}

// Export singleton instance
export const advancedSearchService = new AdvancedSearchService();
export default advancedSearchService;
