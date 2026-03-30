// Story Management Service
// Handles CRUD operations, search, filtering, and management of user stories
//
// Uses Convex exclusively as the data store for all users.
// Supabase dual-write and fallback paths removed per US-014 (Phase 4 cleanup).

import type {
  GameSession,
  SearchableStory,
  StorySource,
  StoryMetadata,
  GradeLevel,
  ImageUploadStatus,
} from '../types/database';

import AsyncStorage from '@react-native-async-storage/async-storage';

// Convex imports
import { getConvexClient, api, isConvexReady } from './convex';
import type { Doc, Id } from '../../convex/_generated/dataModel';

/** Prefix for write-ahead log entries in AsyncStorage */
const WAL_PREFIX = 'wal_save_';

/**
 * Convert Convex game session to legacy GameSession format.
 * Maps camelCase Convex fields to snake_case legacy format.
 */
const convertConvexSessionToLegacy = (
  convexSession: Doc<'gameSessions'>,
): GameSession => ({
  id: convexSession._id as unknown as string,
  user_id: convexSession.clerkUserId, // Clerk ID for profile lookups
  created_at: new Date(convexSession._creationTime).toISOString(),
  completed_at: convexSession.completedAt || undefined,
  grade_level: convexSession.gradeLevel as GradeLevel,
  final_score: convexSession.finalScore,
  words_written: convexSession.wordsWritten,
  sentences_completed: convexSession.sentencesCompleted,
  challenges_completed: convexSession.challengesCompleted,
  xp_earned: convexSession.xpEarned,
  story_content: convexSession.storyContent || undefined,
  imported_story_content: convexSession.importedStoryContent || undefined,
  story_source: convexSession.storySource as StorySource,
  original_creation_date: convexSession.originalCreationDate || undefined,
  story_metadata: convexSession.storyMetadata || {},
  generated_image_url: convexSession.generatedImageUrl || undefined,
  image_generation_timestamp:
    convexSession.imageGenerationTimestamp || undefined,
  image_generation_cost: convexSession.imageGenerationCost || undefined,
  current_round: convexSession.currentRound,
  supabase_image_url: undefined, // Convex uses storageId instead
  image_upload_status:
    (convexSession.imageUploadStatus as ImageUploadStatus) || undefined,
  image_upload_attempts: convexSession.imageUploadAttempts || undefined,
  image_upload_error: convexSession.imageUploadError || undefined,
});

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
  // Use ReturnType<typeof setTimeout> to be compatible with both Node.js and React Native
  private static searchDebounceTimers: Map<
    string,
    ReturnType<typeof setTimeout>
  > = new Map();

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

      // Write-ahead log: persist to AsyncStorage before Convex mutation (R-4.3)
      const walKey = `${WAL_PREFIX}${request.userId}_${Date.now()}`;
      await AsyncStorage.setItem(walKey, JSON.stringify(request));

      if (!isConvexReady()) {
        // WAL entry preserved for later replay
        return {
          success: false,
          error: 'Database not available',
          savedLocally: true,
        } as SaveStoryResult & { savedLocally: boolean };
      }

      const convexClient = getConvexClient();
      if (!convexClient) {
        return {
          success: false,
          error: 'Database client unavailable',
          savedLocally: true,
        } as SaveStoryResult & { savedLocally: boolean };
      }

      // Calculate word count for the story content
      const wordCount = this.countWords(request.content);

      let sessionId: string;
      let createdStory: GameSession | undefined;

      try {
        // Use the database function for creating story continuation sessions if it's an imported story
        if (request.source !== 'New' && request.importedContent) {
          const convexSessionId = await convexClient.mutation(
            api.gameSessions.createStoryContinuationSession,
            {
              clerkUserId: request.userId,
              gradeLevel: request.gradeLevel,
              storySource: request.source,
              importedContent: request.importedContent,
              originalCreationDate: request.originalDate,
              storyMetadata: request.metadata || {},
            },
          );

          sessionId = convexSessionId as unknown as string;

          // Fetch the created session
          const convexSession = await convexClient.query(
            api.gameSessions.getSession,
            { sessionId: convexSessionId },
          );

          if (convexSession) {
            createdStory = convertConvexSessionToLegacy(convexSession);
          }
        } else {
          // For regular new stories, use createSession
          const convexSessionId = await convexClient.mutation(
            api.gameSessions.createSession,
            {
              clerkUserId: request.userId,
              gradeLevel: request.gradeLevel,
              storyMetadata: request.metadata || {},
            },
          );

          sessionId = convexSessionId as unknown as string;

          // Update with story content
          const updatedSession = await convexClient.mutation(
            api.gameSessions.updateSession,
            {
              sessionId: convexSessionId,
              updates: {
                storyContent: request.content,
                wordsWritten: wordCount,
              },
            },
          );

          if (updatedSession) {
            createdStory = convertConvexSessionToLegacy(updatedSession);
          }
        }

        // Convex mutation succeeded — remove WAL entry
        await AsyncStorage.removeItem(walKey);

        return {
          success: true,
          story: createdStory,
          sessionId: sessionId,
        };
      } catch (convexError) {
        // Convex mutation failed — WAL entry preserved for replay
        console.error('Convex save failed, WAL entry preserved:', convexError);
        return {
          success: false,
          error:
            convexError instanceof Error ? convexError.message : 'Save failed',
          savedLocally: true,
        } as SaveStoryResult & { savedLocally: boolean };
      }
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
      if (!isConvexReady()) {
        return { success: false, error: 'Database not available' };
      }

      const convexClient = getConvexClient();
      if (!convexClient) {
        return { success: false, error: 'Database client unavailable' };
      }

      // Handle conflict resolution if content is being updated
      let finalUpdates = { ...request.updates };

      // For merge conflict strategy, we need to fetch current content first
      if (
        request.updates.content &&
        conflictStrategy.strategy === 'merge_content' &&
        conflictStrategy.mergeFunction
      ) {
        const currentSession = await convexClient.query(
          api.gameSessions.getSession,
          { sessionId: request.sessionId as Id<'gameSessions'> },
        );

        if (currentSession) {
          finalUpdates.content = conflictStrategy.mergeFunction(
            currentSession.storyContent || '',
            request.updates.content,
          );
        }
      }

      // Recalculate word count if content is updated
      if (finalUpdates.content) {
        finalUpdates.words_written = this.countWords(finalUpdates.content);
      }

      // Prepare Convex update payload
      const convexUpdates: Record<string, unknown> = {};
      if (finalUpdates.content !== undefined) {
        convexUpdates.storyContent = finalUpdates.content;
      }
      if (finalUpdates.words_written !== undefined) {
        convexUpdates.wordsWritten = finalUpdates.words_written;
      }
      if (finalUpdates.final_score !== undefined) {
        convexUpdates.finalScore = finalUpdates.final_score;
      }
      if (finalUpdates.story_metadata !== undefined) {
        convexUpdates.storyMetadata = finalUpdates.story_metadata;
      }

      const updatedSession = await convexClient.mutation(
        api.gameSessions.updateSession,
        {
          sessionId: request.sessionId as Id<'gameSessions'>,
          updates: convexUpdates as any,
        },
      );

      if (updatedSession) {
        return {
          success: true,
          story: convertConvexSessionToLegacy(updatedSession),
        };
      }

      return {
        success: false,
        error: 'Story not found or access denied',
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
      if (!isConvexReady()) {
        return { success: false, error: 'Database not available' };
      }

      const convexClient = getConvexClient();
      if (!convexClient) {
        return { success: false, error: 'Database client unavailable' };
      }

      await convexClient.mutation(api.gameSessions.deleteSession, {
        sessionId: sessionId as Id<'gameSessions'>,
      });

      return { success: true };
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
      if (!isConvexReady()) {
        return { success: false, error: 'Database not available' };
      }

      const convexClient = getConvexClient();
      if (!convexClient) {
        return { success: false, error: 'Database client unavailable' };
      }

      // Map sort field names from snake_case to camelCase
      const sortByMap: Record<string, string> = {
        created_at: 'createdAt',
        completed_at: 'completedAt',
        final_score: 'finalScore',
        words_written: 'wordsWritten',
      };

      const result = await convexClient.query(
        api.gameSessions.getStoryLibrary,
        {
          filters: {
            storySource: options.source,
            dateFrom: options.dateFrom,
            dateTo: options.dateTo,
          },
          sortBy: (sortByMap[options.sortBy || 'created_at'] || 'createdAt') as
            | 'createdAt'
            | 'completedAt'
            | 'finalScore'
            | 'wordsWritten',
          sortOrder: options.sortOrder || 'desc',
          limit: options.limit || 50,
          offset: options.offset || 0,
        },
      );

      if (result) {
        // Convert Convex stories to legacy format
        const stories: GameSession[] = result.stories.map(s => ({
          id: s.sessionId as unknown as string,
          user_id: options.userId,
          created_at: new Date(s.createdAt).toISOString(),
          completed_at: s.completedAt || undefined,
          grade_level: s.gradeLevel as GradeLevel,
          final_score: s.finalScore,
          words_written: s.wordsWritten,
          sentences_completed: 0, // Not returned by getStoryLibrary
          challenges_completed: 0,
          xp_earned: s.xpEarned,
          story_content: s.storyContent || undefined,
          story_source: s.storySource as StorySource,
          story_metadata: {},
          generated_image_url: s.generatedImageUrl || undefined,
          current_round: s.currentRound,
        }));

        return {
          success: true,
          stories,
          total: result.totalCount,
          hasMore: result.hasMore,
        };
      }

      return {
        success: false,
        error: 'No results returned from database',
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

      if (!isConvexReady()) {
        return { success: false, error: 'Database not available' };
      }

      const convexClient = getConvexClient();
      if (!convexClient) {
        return { success: false, error: 'Database client unavailable' };
      }

      const results = await convexClient.query(
        api.gameSessions.searchUserStories,
        {
          searchQuery: options.searchTerm.trim(),
          limit: options.limit || 20,
        },
      );

      if (results) {
        // Convert to SearchableStory format and apply additional filters
        let filteredResults: SearchableStory[] = results.map(r => ({
          session_id: r.sessionId as unknown as string,
          created_at: new Date(r.createdAt).toISOString(),
          completed_at: r.completedAt || '',
          story_content: r.storyContent || '',
          story_excerpt: r.storyExcerpt,
          words_written: r.wordsWritten,
          story_source: r.storySource as StorySource,
          relevance_score: r.relevanceScore,
        }));

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
      }

      return {
        success: true,
        stories: [],
        total: 0,
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
      if (!isConvexReady()) {
        return { success: false, error: 'Database not available' };
      }

      const convexClient = getConvexClient();
      if (!convexClient) {
        return { success: false, error: 'Database client unavailable' };
      }

      const result = await convexClient.query(
        api.gameSessions.getStoryLibrary,
        {
          filters: {
            storySource: options.source,
            gradeLevel: options.gradeLevel,
            completedOnly: options.completedOnly,
            dateFrom: options.dateFrom,
            dateTo: options.dateTo,
            minWords: options.minWords,
            maxWords: options.maxWords,
          },
          sortBy: 'createdAt',
          sortOrder: 'desc',
          limit: options.limit || 50,
          offset: options.offset || 0,
        },
      );

      if (result) {
        // Apply score filters (not supported in Convex getStoryLibrary)
        let filteredStories = result.stories;
        if (options.minScore !== undefined) {
          filteredStories = filteredStories.filter(
            s => s.finalScore >= (options.minScore || 0),
          );
        }
        if (options.maxScore !== undefined) {
          filteredStories = filteredStories.filter(
            s => s.finalScore <= (options.maxScore || Infinity),
          );
        }

        // Convert to legacy format
        const stories: GameSession[] = filteredStories.map(s => ({
          id: s.sessionId as unknown as string,
          user_id: options.userId,
          created_at: new Date(s.createdAt).toISOString(),
          completed_at: s.completedAt || undefined,
          grade_level: s.gradeLevel as GradeLevel,
          final_score: s.finalScore,
          words_written: s.wordsWritten,
          sentences_completed: 0,
          challenges_completed: 0,
          xp_earned: s.xpEarned,
          story_content: s.storyContent || undefined,
          story_source: s.storySource as StorySource,
          story_metadata: {},
          generated_image_url: s.generatedImageUrl || undefined,
          current_round: s.currentRound,
        }));

        return {
          success: true,
          stories,
          total: result.totalCount,
          hasMore: result.hasMore,
        };
      }

      return {
        success: false,
        error: 'No results returned from database',
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
      if (!isConvexReady()) {
        return { success: false, error: 'Database not available' };
      }

      const convexClient = getConvexClient();
      if (!convexClient) {
        return { success: false, error: 'Database client unavailable' };
      }

      const convexSession = await convexClient.query(
        api.gameSessions.getSession,
        { sessionId: sessionId as Id<'gameSessions'> },
      );

      if (convexSession) {
        // Verify user ownership
        if (convexSession.clerkUserId !== userId) {
          return {
            success: false,
            error: 'Story not found or access denied',
          };
        }

        return {
          success: true,
          story: convertConvexSessionToLegacy(convexSession),
        };
      }

      return {
        success: false,
        error: 'Story not found or access denied',
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
      if (!isConvexReady()) {
        return { success: false, error: 'Database not available' };
      }

      const convexClient = getConvexClient();
      if (!convexClient) {
        return { success: false, error: 'Database client unavailable' };
      }

      // Get all user sessions to calculate stats
      const result = await convexClient.query(
        api.gameSessions.getStoryLibrary,
        {
          limit: 1000, // Get all sessions for stats
          offset: 0,
        },
      );

      if (result && result.stories) {
        const stories = result.stories;
        const totalStories = stories.length;
        const completedStories = stories.filter(s => s.completedAt).length;
        const totalWords = stories.reduce(
          (sum, s) => sum + (s.wordsWritten || 0),
          0,
        );
        const averageScore =
          totalStories > 0
            ? stories.reduce((sum, s) => sum + (s.finalScore || 0), 0) /
              totalStories
            : 0;

        // Find most used source
        const sourceCounts = stories.reduce((acc, s) => {
          const source = s.storySource as StorySource;
          acc[source] = (acc[source] || 0) + 1;
          return acc;
        }, {} as Record<StorySource, number>);

        const favoriteSource =
          (Object.entries(sourceCounts).sort(
            ([, a], [, b]) => b - a,
          )[0]?.[0] as StorySource) || 'New';

        const lastActivity =
          stories.length > 0
            ? new Date(Math.max(...stories.map(s => s.createdAt))).toISOString()
            : new Date().toISOString();

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
      }

      return {
        success: false,
        error: 'Failed to fetch user stories',
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

  /**
   * Replay pending writes from the write-ahead log (R-4.3).
   * Call on app foreground or network connectivity change.
   * Retries each WAL entry once; entries that fail again are kept for the next replay.
   */
  static async replayPendingWrites(): Promise<{
    replayed: number;
    failed: number;
  }> {
    let replayed = 0;
    let failed = 0;

    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const walKeys = allKeys.filter(k => k.startsWith(WAL_PREFIX));

      if (walKeys.length === 0) return { replayed, failed };

      if (!isConvexReady()) return { replayed, failed: walKeys.length };

      for (const key of walKeys) {
        try {
          const raw = await AsyncStorage.getItem(key);
          if (!raw) {
            await AsyncStorage.removeItem(key);
            continue;
          }

          const request: SaveStoryRequest = JSON.parse(raw);
          const result = await this.saveStory(request);

          if (result.success) {
            // saveStory already removes the WAL entry it creates,
            // but the original WAL key may differ — remove it too
            await AsyncStorage.removeItem(key);
            replayed++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
      }
    } catch (error) {
      console.error('Error replaying WAL entries:', error);
    }

    return { replayed, failed };
  }
}

export default StoryManagementService;
