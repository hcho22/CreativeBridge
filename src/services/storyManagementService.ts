// Story Management Service
// Handles CRUD operations, search, filtering, and management of user stories

import { supabase } from './supabase';
import type {
  GameSession,
  GameSessionInsert,
  GameSessionUpdate,
  ImportableStory,
  SearchableStory,
  StorySource,
  StoryMetadata,
  StoryImportData,
  GradeLevel,
} from '../types/database';

export interface SaveStoryRequest {
  content: string;
  source: StorySource;
  userId: string;
  gradeLevel: GradeLevel;
  importedContent?: string;
  originalDate?: string;
  metadata?: StoryMetadata;
  title?: string;
}

export interface SaveStoryResult {
  success: boolean;
  story?: GameSession;
  sessionId?: string;
  error?: string;
}

export interface UpdateStoryRequest {
  sessionId: string;
  updates: {
    content?: string;
    imported_story_content?: string;
    story_metadata?: StoryMetadata;
    final_score?: number;
    words_written?: number;
    completed_at?: string;
  };
  userId: string;
}

export interface UpdateStoryResult {
  success: boolean;
  story?: GameSession;
  error?: string;
}

export interface DeleteStoryResult {
  success: boolean;
  error?: string;
}

export interface StoryLibraryOptions {
  userId: string;
  limit?: number;
  offset?: number;
  source?: StorySource;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'created_at' | 'completed_at' | 'final_score' | 'words_written';
  sortOrder?: 'asc' | 'desc';
}

export interface StoryLibraryResult {
  success: boolean;
  stories?: GameSession[];
  total?: number;
  hasMore?: boolean;
  error?: string;
}

export interface SearchOptions {
  userId: string;
  searchTerm: string;
  source?: StorySource;
  limit?: number;
  includeIncomplete?: boolean;
}

export interface SearchResult {
  success: boolean;
  stories?: SearchableStory[];
  total?: number;
  error?: string;
}

export interface FilterOptions {
  userId: string;
  source?: StorySource;
  dateFrom?: string;
  dateTo?: string;
  minWords?: number;
  maxWords?: number;
  minScore?: number;
  maxScore?: number;
  gradeLevel?: GradeLevel;
  completedOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface ConflictResolutionStrategy {
  strategy: 'latest_wins' | 'merge_content' | 'user_choice' | 'create_copy';
  mergeFunction?: (original: string, updated: string) => string;
}

export interface RetryOptions {
  maxRetries: number;
  delay: number;
  exponentialBackoff: boolean;
}

export class StoryManagementService {
  // Debounce utility for search
  private static searchDebounceTimers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Save a new story or imported story to the database
   */
  static async saveStory(request: SaveStoryRequest): Promise<SaveStoryResult> {
    try {
      // Validate required fields
      if (!request.userId || !request.content || !request.gradeLevel) {
        return {
          success: false,
          error: 'Missing required fields: userId, content, or gradeLevel',
        };
      }

      // Calculate word count for the story content
      const wordCount = this.countWords(request.content);

      // Prepare the story data for insert
      const storyData: GameSessionInsert = {
        user_id: request.userId,
        grade_level: request.gradeLevel,
        story_content: request.content,
        words_written: wordCount,
        story_source: request.source || 'New',
        story_metadata: request.metadata || {},
        imported_story_content: request.importedContent,
        original_creation_date: request.originalDate,
        // Initialize game statistics
        final_score: 0,
        sentences_completed: 0,
        challenges_completed: 0,
        xp_earned: 0,
      };

      // Use the database function for creating story continuation sessions if it's an imported story
      if (request.source !== 'New' && request.importedContent) {
        const { data: sessionId, error } = await supabase.rpc(
          'create_story_continuation_session',
          {
            p_user_id: request.userId,
            p_grade_level: request.gradeLevel,
            p_story_source: request.source,
            p_imported_content: request.importedContent,
            p_original_date: request.originalDate,
            p_metadata: request.metadata || {},
          },
        );

        if (error) {
          console.error('Error creating story continuation session:', error);
          return {
            success: false,
            error: 'Failed to save imported story to database',
          };
        }

        // Fetch the created session
        const { data: createdStory, error: fetchError } = await supabase
          .from('game_sessions')
          .select('*')
          .eq('id', sessionId)
          .single();

        if (fetchError) {
          console.error('Error fetching created story:', fetchError);
          return {
            success: false,
            error: 'Story saved but failed to retrieve details',
          };
        }

        return {
          success: true,
          story: createdStory,
          sessionId: sessionId,
        };
      }

      // For regular new stories, use standard insert
      const { data: createdStory, error } = await supabase
        .from('game_sessions')
        .insert(storyData)
        .select()
        .single();

      if (error) {
        console.error('Error saving story:', error);
        return {
          success: false,
          error: 'Failed to save story to database',
        };
      }

      return {
        success: true,
        story: createdStory,
        sessionId: createdStory.id,
      };
    } catch (error) {
      console.error('Error in saveStory:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Update an existing story with conflict resolution
   */
  static async updateStory(
    request: UpdateStoryRequest,
    conflictStrategy: ConflictResolutionStrategy = { strategy: 'latest_wins' },
  ): Promise<UpdateStoryResult> {
    try {
      // First, fetch the current story to check for conflicts
      const { data: currentStory, error: fetchError } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('id', request.sessionId)
        .eq('user_id', request.userId)
        .single();

      if (fetchError) {
        console.error('Error fetching story for update:', fetchError);
        return {
          success: false,
          error: 'Story not found or access denied',
        };
      }

      // Handle conflict resolution if content is being updated
      let finalUpdates = { ...request.updates };

      if (
        request.updates.content &&
        conflictStrategy.strategy === 'merge_content' &&
        conflictStrategy.mergeFunction
      ) {
        finalUpdates.content = conflictStrategy.mergeFunction(
          currentStory.story_content || '',
          request.updates.content,
        );
      }

      // Recalculate word count if content is updated
      if (finalUpdates.content) {
        finalUpdates.words_written = this.countWords(finalUpdates.content);
      }

      // Update the story
      const { data: updatedStory, error: updateError } = await supabase
        .from('game_sessions')
        .update(finalUpdates)
        .eq('id', request.sessionId)
        .eq('user_id', request.userId)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating story:', updateError);
        return {
          success: false,
          error: 'Failed to update story in database',
        };
      }

      return {
        success: true,
        story: updatedStory,
      };
    } catch (error) {
      console.error('Error in updateStory:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Delete a story
   */
  static async deleteStory(
    sessionId: string,
    userId: string,
  ): Promise<DeleteStoryResult> {
    try {
      const { error } = await supabase
        .from('game_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error deleting story:', error);
        return {
          success: false,
          error: 'Failed to delete story from database',
        };
      }

      return {
        success: true,
      };
    } catch (error) {
      console.error('Error in deleteStory:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Get user's story library with filtering and pagination
   */
  static async getStoryLibrary(
    options: StoryLibraryOptions,
  ): Promise<StoryLibraryResult> {
    try {
      let query = supabase
        .from('game_sessions')
        .select('*', { count: 'exact' })
        .eq('user_id', options.userId);

      // Apply filters
      if (options.source) {
        query = query.eq('story_source', options.source);
      }

      if (options.dateFrom) {
        query = query.gte('created_at', options.dateFrom);
      }

      if (options.dateTo) {
        query = query.lte('created_at', options.dateTo);
      }

      // Apply sorting
      const sortBy = options.sortBy || 'created_at';
      const sortOrder = options.sortOrder || 'desc';
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      // Apply pagination
      const limit = options.limit || 50;
      const offset = options.offset || 0;
      query = query.range(offset, offset + limit - 1);

      const { data: stories, error, count } = await query;

      if (error) {
        console.error('Error fetching story library:', error);
        return {
          success: false,
          error: 'Failed to fetch stories from database',
        };
      }

      const hasMore = count ? offset + limit < count : false;

      return {
        success: true,
        stories: stories || [],
        total: count || 0,
        hasMore,
      };
    } catch (error) {
      console.error('Error in getStoryLibrary:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Search stories with debouncing
   */
  static async searchStories(
    options: SearchOptions,
    debounceMs: number = 300,
  ): Promise<Promise<SearchResult>> {
    const searchKey = `${options.userId}-${options.searchTerm}`;

    // Clear existing debounce timer
    const existingTimer = this.searchDebounceTimers.get(searchKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Return a promise that resolves after debounce delay
    return new Promise(resolve => {
      const timer = setTimeout(async () => {
        this.searchDebounceTimers.delete(searchKey);
        const result = await this.performSearch(options);
        resolve(result);
      }, debounceMs);

      this.searchDebounceTimers.set(searchKey, timer);
    });
  }

  /**
   * Perform the actual search operation
   */
  private static async performSearch(
    options: SearchOptions,
  ): Promise<SearchResult> {
    try {
      if (!options.searchTerm.trim()) {
        return {
          success: true,
          stories: [],
          total: 0,
        };
      }

      // Use the database search function
      const { data: searchResults, error } = await supabase.rpc(
        'search_user_stories',
        {
          p_user_id: options.userId,
          p_search_term: options.searchTerm.trim(),
          p_limit: options.limit || 20,
        },
      );

      if (error) {
        console.error('Error searching stories:', error);
        return {
          success: false,
          error: 'Failed to search stories',
        };
      }

      // Apply additional filters if specified
      let filteredResults = searchResults || [];

      if (options.source) {
        filteredResults = filteredResults.filter(
          story => story.story_source === options.source,
        );
      }

      if (!options.includeIncomplete) {
        filteredResults = filteredResults.filter(story => story.completed_at);
      }

      return {
        success: true,
        stories: filteredResults,
        total: filteredResults.length,
      };
    } catch (error) {
      console.error('Error in performSearch:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Filter stories by various criteria
   */
  static async filterStories(
    options: FilterOptions,
  ): Promise<StoryLibraryResult> {
    try {
      let query = supabase
        .from('game_sessions')
        .select('*', { count: 'exact' })
        .eq('user_id', options.userId);

      // Apply filters
      if (options.source) {
        query = query.eq('story_source', options.source);
      }

      if (options.dateFrom) {
        query = query.gte('created_at', options.dateFrom);
      }

      if (options.dateTo) {
        query = query.lte('created_at', options.dateTo);
      }

      if (options.minWords) {
        query = query.gte('words_written', options.minWords);
      }

      if (options.maxWords) {
        query = query.lte('words_written', options.maxWords);
      }

      if (options.minScore) {
        query = query.gte('final_score', options.minScore);
      }

      if (options.maxScore) {
        query = query.lte('final_score', options.maxScore);
      }

      if (options.gradeLevel) {
        query = query.eq('grade_level', options.gradeLevel);
      }

      if (options.completedOnly) {
        query = query.not('completed_at', 'is', null);
      }

      // Apply pagination
      const limit = options.limit || 50;
      const offset = options.offset || 0;
      query = query.range(offset, offset + limit - 1);

      // Order by creation date (most recent first)
      query = query.order('created_at', { ascending: false });

      const { data: stories, error, count } = await query;

      if (error) {
        console.error('Error filtering stories:', error);
        return {
          success: false,
          error: 'Failed to filter stories',
        };
      }

      const hasMore = count ? offset + limit < count : false;

      return {
        success: true,
        stories: stories || [],
        total: count || 0,
        hasMore,
      };
    } catch (error) {
      console.error('Error in filterStories:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Edit story content directly
   */
  static async editStoryContent(
    sessionId: string,
    userId: string,
    newContent: string,
    metadata?: Partial<StoryMetadata>,
  ): Promise<UpdateStoryResult> {
    const wordCount = this.countWords(newContent);

    const updateRequest: UpdateStoryRequest = {
      sessionId,
      userId,
      updates: {
        content: newContent,
        words_written: wordCount,
        story_metadata: metadata,
      },
    };

    return this.updateStory(updateRequest);
  }

  /**
   * Get story by ID
   */
  static async getStoryById(
    sessionId: string,
    userId: string,
  ): Promise<UpdateStoryResult> {
    try {
      const { data: story, error } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error fetching story:', error);
        return {
          success: false,
          error: 'Story not found or access denied',
        };
      }

      return {
        success: true,
        story,
      };
    } catch (error) {
      console.error('Error in getStoryById:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Retry operation with exponential backoff
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {
      maxRetries: 3,
      delay: 1000,
      exponentialBackoff: true,
    },
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        if (attempt === options.maxRetries) {
          break;
        }

        // Calculate delay with exponential backoff if enabled
        const delay = options.exponentialBackoff
          ? options.delay * Math.pow(2, attempt - 1)
          : options.delay;

        await this.sleep(delay);
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Merge content for conflict resolution
   */
  static mergeStoryContent(original: string, updated: string): string {
    // Simple merge strategy: append new content to original with separator
    if (!original.trim()) return updated;
    if (!updated.trim()) return original;

    return `${original}\n\n--- Continued ---\n\n${updated}`;
  }

  /**
   * Get user statistics
   */
  static async getUserStoryStats(userId: string): Promise<{
    success: boolean;
    stats?: {
      totalStories: number;
      completedStories: number;
      totalWords: number;
      averageScore: number;
      favoriteSource: StorySource;
      lastActivity: string;
    };
    error?: string;
  }> {
    try {
      const { data: stories, error } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        return {
          success: false,
          error: 'Failed to fetch user stories',
        };
      }

      const totalStories = stories?.length || 0;
      const completedStories = stories?.filter(s => s.completed_at).length || 0;
      const totalWords =
        stories?.reduce((sum, s) => sum + (s.words_written || 0), 0) || 0;
      const averageScore =
        totalStories > 0
          ? stories.reduce((sum, s) => sum + (s.final_score || 0), 0) /
            totalStories
          : 0;

      // Find most used source
      const sourceCounts =
        stories?.reduce((acc, s) => {
          acc[s.story_source] = (acc[s.story_source] || 0) + 1;
          return acc;
        }, {} as Record<StorySource, number>) || {};

      const favoriteSource =
        (Object.entries(sourceCounts).sort(
          ([, a], [, b]) => b - a,
        )[0]?.[0] as StorySource) || 'New';

      const lastActivity =
        stories?.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )[0]?.created_at || new Date().toISOString();

      return {
        success: true,
        stats: {
          totalStories,
          completedStories,
          totalWords,
          averageScore,
          favoriteSource,
          lastActivity,
        },
      };
    } catch (error) {
      console.error('Error in getUserStoryStats:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // Utility methods

  /**
   * Count words in text content
   */
  private static countWords(content: string): number {
    if (!content || content.trim().length === 0) {
      return 0;
    }

    return content
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0).length;
  }

  /**
   * Sleep utility for retry delays
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear all search debounce timers
   */
  static clearSearchTimers(): void {
    this.searchDebounceTimers.forEach(timer => clearTimeout(timer));
    this.searchDebounceTimers.clear();
  }
}

export default StoryManagementService;
