// Story Management Service
// Handles CRUD operations, search, filtering, and management of user stories
//
// US-019: Migrated to Convex with dual-write support
// Convex is PRIMARY, Supabase is SECONDARY (for safety during transition)
// Set ENABLE_DUAL_WRITE to false after migration is verified stable

import { supabase } from './supabase';
import type {
  GameSession,
  GameSessionInsert,
  SearchableStory,
  StorySource,
  StoryMetadata,
  GradeLevel,
  ImageUploadStatus,
} from '../types/database';

// Convex imports for database migration (US-019)
import { getConvexClient, api, isConvexReady } from './convex';
import type { Doc, Id } from '../../convex/_generated/dataModel';

// ============================================================================
// DUAL-WRITE CONFIGURATION (US-031: DISABLED)
// ============================================================================
// Migration complete: Convex is now the ONLY data store
// Dual-write has been disabled per US-031
const ENABLE_DUAL_WRITE = false;

/**
 * Convert Convex game session to legacy GameSession format.
 * Maps camelCase Convex fields to snake_case legacy format.
 */
const convertConvexSessionToLegacy = (
  convexSession: Doc<'gameSessions'>,
): GameSession => ({
  id: convexSession._id as unknown as string,
  user_id: convexSession.userId as unknown as string,
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
   * US-019: Convex PRIMARY, Supabase SECONDARY (dual-write)
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

      let sessionId: string;
      let createdStory: GameSession | undefined;

      // PRIMARY: Use Convex for creating sessions (US-019)
      if (isConvexReady()) {
        const convexClient = getConvexClient();
        if (convexClient) {
          try {
            // Use the database function for creating story continuation sessions if it's an imported story
            if (request.source !== 'New' && request.importedContent) {
              console.log(
                '📝 Creating story continuation session in Convex (PRIMARY)',
              );
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
              console.log('✅ Convex continuation session created:', sessionId);

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
              console.log('📝 Creating new session in Convex (PRIMARY)');
              const convexSessionId = await convexClient.mutation(
                api.gameSessions.createSession,
                {
                  clerkUserId: request.userId,
                  gradeLevel: request.gradeLevel,
                  storyMetadata: request.metadata || {},
                },
              );

              sessionId = convexSessionId as unknown as string;
              console.log('✅ Convex session created:', sessionId);

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

            return {
              success: true,
              story: createdStory,
              sessionId: sessionId,
            };
          } catch (convexError) {
            console.error(
              '❌ Convex save failed, falling back to Supabase:',
              convexError,
            );
            // Fall through to Supabase fallback
          }
        }
      }

      // FALLBACK: Use Supabase if Convex fails or is not ready
      console.log('📝 Saving story to Supabase (FALLBACK)');

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
        current_round: 1,
        // Initialize game statistics
        final_score: 0,
        sentences_completed: 0,
        challenges_completed: 0,
        xp_earned: 0,
      };

      // Use the database function for creating story continuation sessions if it's an imported story
      if (request.source !== 'New' && request.importedContent) {
        const { data: supabaseSessionId, error } = await (supabase.rpc as any)(
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
        const { data: fetchedStory, error: fetchError } = await (
          supabase.from('game_sessions') as any
        )
          .select('*')
          .eq('id', supabaseSessionId)
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
          story: fetchedStory as GameSession,
          sessionId: supabaseSessionId,
        };
      }

      // For regular new stories, use standard insert
      const { data: insertedStory, error } = await (
        supabase.from('game_sessions') as any
      )
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
        story: insertedStory as GameSession,
        sessionId: (insertedStory as GameSession).id,
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
   * US-019: Convex PRIMARY, Supabase SECONDARY (dual-write)
   */
  static async updateStory(
    request: UpdateStoryRequest,
    conflictStrategy: ConflictResolutionStrategy = { strategy: 'latest_wins' },
  ): Promise<UpdateStoryResult> {
    try {
      // Handle conflict resolution if content is being updated
      let finalUpdates = { ...request.updates };

      // PRIMARY: Try Convex first (US-019)
      if (isConvexReady()) {
        const convexClient = getConvexClient();
        if (convexClient) {
          try {
            console.log('📝 Updating story in Convex (PRIMARY)');

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
              finalUpdates.words_written = this.countWords(
                finalUpdates.content,
              );
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

            console.log('✅ Convex story update successful');

            if (updatedSession) {
              return {
                success: true,
                story: convertConvexSessionToLegacy(updatedSession),
              };
            }
          } catch (convexError) {
            console.error(
              '❌ Convex update failed, falling back to Supabase:',
              convexError,
            );
            // Fall through to Supabase fallback
          }
        }
      }

      // FALLBACK: Use Supabase if Convex fails or is not ready
      console.log('📝 Updating story in Supabase (FALLBACK)');

      // First, fetch the current story to check for conflicts
      const { data: currentStory, error: fetchError } = await (
        supabase.from('game_sessions') as any
      )
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
      const { data: updatedStory, error: updateError } = await (
        supabase.from('game_sessions') as any
      )
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
        story: updatedStory as GameSession,
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
   * US-019: Convex PRIMARY, Supabase FALLBACK
   */
  static async getStoryLibrary(
    options: StoryLibraryOptions,
  ): Promise<StoryLibraryResult> {
    try {
      // PRIMARY: Try Convex first (US-019)
      if (isConvexReady()) {
        const convexClient = getConvexClient();
        if (convexClient) {
          try {
            console.log('📖 Fetching story library from Convex (PRIMARY)');

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
                clerkUserId: options.userId,
                filters: {
                  storySource: options.source,
                  dateFrom: options.dateFrom,
                  dateTo: options.dateTo,
                },
                sortBy: (sortByMap[options.sortBy || 'created_at'] ||
                  'createdAt') as
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
              console.log(
                `✅ Found ${result.stories.length} stories in Convex`,
              );

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
          } catch (convexError) {
            console.warn(
              '⚠️ Convex query failed, falling back to Supabase:',
              convexError,
            );
            // Fall through to Supabase fallback
          }
        }
      }

      // FALLBACK: Use Supabase if Convex fails or is not ready
      console.log('📖 Fetching story library from Supabase (FALLBACK)');

      let query = (supabase.from('game_sessions') as any)
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
        stories: (stories as GameSession[]) || [],
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
   * US-019: Convex PRIMARY, Supabase FALLBACK
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

      // PRIMARY: Try Convex first (US-019)
      if (isConvexReady()) {
        const convexClient = getConvexClient();
        if (convexClient) {
          try {
            console.log('🔍 Searching stories in Convex (PRIMARY)');

            const results = await convexClient.query(
              api.gameSessions.searchUserStories,
              {
                clerkUserId: options.userId,
                searchQuery: options.searchTerm.trim(),
                limit: options.limit || 20,
              },
            );

            if (results) {
              console.log(`✅ Found ${results.length} matching stories`);

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
                filteredResults = filteredResults.filter(
                  story => story.completed_at,
                );
              }

              return {
                success: true,
                stories: filteredResults,
                total: filteredResults.length,
              };
            }
          } catch (convexError) {
            console.warn(
              '⚠️ Convex search failed, falling back to Supabase:',
              convexError,
            );
            // Fall through to Supabase fallback
          }
        }
      }

      // FALLBACK: Use Supabase if Convex fails or is not ready
      console.log('🔍 Searching stories in Supabase (FALLBACK)');

      // Use the database search function
      const { data: searchResults, error } = await (supabase.rpc as any)(
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
      let filteredResults: SearchableStory[] = searchResults || [];

      if (options.source) {
        filteredResults = filteredResults.filter(
          (story: SearchableStory) => story.story_source === options.source,
        );
      }

      if (!options.includeIncomplete) {
        filteredResults = filteredResults.filter(
          (story: SearchableStory) => story.completed_at,
        );
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
   * US-019: Convex PRIMARY, Supabase FALLBACK
   */
  static async filterStories(
    options: FilterOptions,
  ): Promise<StoryLibraryResult> {
    try {
      // PRIMARY: Try Convex first (US-019)
      if (isConvexReady()) {
        const convexClient = getConvexClient();
        if (convexClient) {
          try {
            console.log('🔍 Filtering stories in Convex (PRIMARY)');

            const result = await convexClient.query(
              api.gameSessions.getStoryLibrary,
              {
                clerkUserId: options.userId,
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
              console.log(
                `✅ Found ${result.stories.length} filtered stories in Convex`,
              );

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
          } catch (convexError) {
            console.warn(
              '⚠️ Convex filter failed, falling back to Supabase:',
              convexError,
            );
            // Fall through to Supabase fallback
          }
        }
      }

      // FALLBACK: Use Supabase if Convex fails or is not ready
      console.log('🔍 Filtering stories in Supabase (FALLBACK)');

      let query = (supabase.from('game_sessions') as any)
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
        stories: (stories as GameSession[]) || [],
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
   * US-019: Convex PRIMARY, Supabase FALLBACK
   */
  static async getStoryById(
    sessionId: string,
    userId: string,
  ): Promise<UpdateStoryResult> {
    try {
      // PRIMARY: Try Convex first (US-019)
      if (isConvexReady()) {
        const convexClient = getConvexClient();
        if (convexClient) {
          try {
            console.log('📖 Fetching story from Convex (PRIMARY)');

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

              console.log('✅ Story found in Convex');
              return {
                success: true,
                story: convertConvexSessionToLegacy(convexSession),
              };
            }
          } catch (convexError) {
            console.warn(
              '⚠️ Convex query failed, falling back to Supabase:',
              convexError,
            );
            // Fall through to Supabase fallback
          }
        }
      }

      // FALLBACK: Use Supabase if Convex fails or is not ready
      console.log('📖 Fetching story from Supabase (FALLBACK)');

      const { data: story, error } = await (
        supabase.from('game_sessions') as any
      )
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
        story: story as GameSession,
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
   * US-019: Convex PRIMARY, Supabase FALLBACK
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
      // PRIMARY: Try Convex first (US-019)
      if (isConvexReady()) {
        const convexClient = getConvexClient();
        if (convexClient) {
          try {
            console.log('📊 Fetching user stats from Convex (PRIMARY)');

            // Get all user sessions to calculate stats
            const result = await convexClient.query(
              api.gameSessions.getStoryLibrary,
              {
                clerkUserId: userId,
                limit: 1000, // Get all sessions for stats
                offset: 0,
              },
            );

            if (result && result.stories) {
              const stories = result.stories;
              const totalStories = stories.length;
              const completedStories = stories.filter(
                s => s.completedAt,
              ).length;
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
                  ? new Date(
                      Math.max(...stories.map(s => s.createdAt)),
                    ).toISOString()
                  : new Date().toISOString();

              console.log('✅ User stats calculated from Convex');
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
          } catch (convexError) {
            console.warn(
              '⚠️ Convex stats failed, falling back to Supabase:',
              convexError,
            );
            // Fall through to Supabase fallback
          }
        }
      }

      // FALLBACK: Use Supabase if Convex fails or is not ready
      console.log('📊 Fetching user stats from Supabase (FALLBACK)');

      const { data: stories, error } = await (
        supabase.from('game_sessions') as any
      )
        .select('*')
        .eq('user_id', userId);

      if (error) {
        return {
          success: false,
          error: 'Failed to fetch user stories',
        };
      }

      const typedStories = stories as GameSession[];
      const totalStories = typedStories?.length || 0;
      const completedStories =
        typedStories?.filter(s => s.completed_at).length || 0;
      const totalWords =
        typedStories?.reduce((sum, s) => sum + (s.words_written || 0), 0) || 0;
      const averageScore =
        totalStories > 0
          ? typedStories.reduce((sum, s) => sum + (s.final_score || 0), 0) /
            totalStories
          : 0;

      // Find most used source
      const sourceCounts =
        typedStories?.reduce((acc, s) => {
          acc[s.story_source] = (acc[s.story_source] || 0) + 1;
          return acc;
        }, {} as Record<StorySource, number>) || {};

      const favoriteSource =
        (Object.entries(sourceCounts).sort(
          ([, a], [, b]) => b - a,
        )[0]?.[0] as StorySource) || 'New';

      const lastActivity =
        typedStories?.sort(
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
