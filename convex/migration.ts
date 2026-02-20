/**
 * Convex Data Migration Script for CreativeBridge
 *
 * One-time migration script to copy all data from Supabase to Convex.
 * Handles the 6+ database tables with proper ID mapping and data transformation.
 *
 * ## Migration Strategy:
 * 1. User Profiles: Migrated first (source of truth for user IDs)
 * 2. Game Sessions: Migrated with userId → Convex ID mapping
 * 3. Image Generation Events: Migrated with userId and sessionId mapping
 * 4. Supporting Tables: Story elements, diversity scores, download history
 *
 * ## Key Challenges Addressed:
 * - UUID → Convex ID mapping (stored in migration state)
 * - snake_case → camelCase field transformation
 * - Foreign key resolution (user_id → userId reference)
 * - Pagination for large datasets (1000 records per batch)
 *
 * ## Usage:
 * Run migrations in order via Convex dashboard or CLI:
 * 1. npx convex run migration:migrateUserProfiles
 * 2. npx convex run migration:migrateGameSessions
 * 3. npx convex run migration:migrateImageGenerationEvents
 * 4. npx convex run migration:migrateStoryElements
 * 5. npx convex run migration:migrateStoryDiversityScores
 * 6. npx convex run migration:migrateStoryDownloadHistory
 *
 * @implements US-022: Create Data Migration Script
 */

import {
  action,
  mutation,
  query,
  internalMutation,
  internalQuery,
} from './_generated/server';
import { v } from 'convex/values';
import { Id } from './_generated/dataModel';

// ============================================================================
// Types
// ============================================================================

/**
 * Supabase user profile record (snake_case).
 */
interface SupabaseUserProfile {
  id: string;
  clerk_user_id: string;
  username: string;
  display_name: string;
  total_xp: number;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string;
  best_score: number;
  total_games_played: number;
  total_stories_completed: number;
  total_words_written: number;
  preferred_grade_level: 'K-2' | '3-5' | '6-8' | '9-12';
  speech_enabled: boolean;
  avatar_url?: string;
  bio?: string;
  onboarding_completed: boolean;
  onboarding_progress: {
    create_account: boolean;
    first_story: boolean;
    first_image: boolean;
    first_voice: boolean;
    first_streak: boolean;
  };
  first_story_completed_at?: string;
  first_image_generated_at?: string;
  first_voice_input_at?: string;
  first_streak_achieved_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Supabase game session record (snake_case).
 */
interface SupabaseGameSession {
  id: string;
  user_id: string;
  created_at: string;
  completed_at?: string;
  grade_level: 'K-2' | '3-5' | '6-8' | '9-12';
  final_score: number;
  words_written: number;
  sentences_completed: number;
  challenges_completed: number;
  xp_earned: number;
  story_content?: string;
  imported_story_content?: string;
  story_source: 'New' | 'CreativeBridge' | 'Story_Quest' | 'File';
  original_creation_date?: string;
  story_metadata?: Record<string, unknown>;
  generated_image_url?: string;
  image_generation_timestamp?: string;
  image_generation_cost?: number;
  current_round: number;
  supabase_image_url?: string;
  image_upload_status?: 'pending' | 'uploaded' | 'failed';
  image_upload_attempts?: number;
  image_upload_error?: string;
}

/**
 * Supabase image generation event record (snake_case).
 */
interface SupabaseImageGenerationEvent {
  id: string;
  user_id: string;
  session_id?: string;
  xp_cost: number;
  generation_status: 'pending' | 'success' | 'failed' | 'refunded' | 'timeout';
  error_type?:
    | 'api_failure'
    | 'content_safety'
    | 'insufficient_xp'
    | 'timeout'
    | 'rate_limit';
  service_used:
    | 'stability-ai/stable-diffusion-3.5-large'
    | 'google/nano-banana'
    | 'replicate'
    | 'backup_service';
  api_response_time?: number;
  image_url?: string;
  story_grade_level?: string;
  story_word_count?: number;
  prompt_used?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  completed_at?: string;
}

/**
 * Supabase story element record (snake_case).
 */
interface SupabaseStoryElement {
  id: string;
  story_id: string;
  session_id: string;
  element_type: 'character' | 'setting' | 'object' | 'plot_pattern';
  element_text: string;
  embedding_vector?: number[];
  created_at: string;
}

/**
 * Supabase story diversity score record (snake_case).
 */
interface SupabaseStoryDiversityScore {
  id: string;
  story_id: string;
  diversity_score: number;
  novel_element_count: number;
  metadata?: Record<string, unknown>;
  created_at: string;
}

/**
 * Supabase story download history record (snake_case).
 */
interface SupabaseStoryDownloadHistory {
  id: string;
  user_id: string;
  clerk_user_id: string;
  story_session_id?: string;
  file_name: string;
  file_path: string;
  story_title?: string;
  story_word_count?: number;
  story_character_count?: number;
  story_grade_level?: string;
  story_source?: 'New' | 'CreativeBridge' | 'Story_Quest' | 'File';
  download_method: 'share' | 'save_to_files' | 'export' | 'clipboard';
  app_version?: string;
  completed_at?: string;
  retry_count: number;
  file_exists: boolean;
  metadata?: Record<string, unknown>;
  created_at: string;
}

// Note: SupabaseFeatureFlag interface is defined inline in migrateFeatureFlags action
// to avoid unused variable warnings when the migration hasn't been run yet.

/**
 * Migration result tracking.
 */
interface MigrationResult {
  success: boolean;
  tableName: string;
  totalRecords: number;
  migratedRecords: number;
  skippedRecords: number;
  errorCount: number;
  errors: string[];
  duration: number;
}

// Note: ID mappings are handled via clerkUserId lookups in userProfiles table
// and session matching via clerkUserId + creation time composite keys

// ============================================================================
// Configuration
// ============================================================================

/**
 * Pagination batch size for large datasets.
 * Keeps each migration operation under Convex's limits.
 */
const BATCH_SIZE = 500;

/**
 * Maximum errors before aborting migration.
 */
const MAX_ERRORS = 50;

// ============================================================================
// Internal Mutations - Database Operations
// ============================================================================

/**
 * Store a user ID mapping for foreign key resolution.
 * Uses a separate table to track Supabase UUID → Convex ID mappings.
 */
export const storeUserIdMapping = internalMutation({
  args: {
    supabaseId: v.string(),
    convexId: v.id('userProfiles'),
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if mapping already exists
    const existing = await ctx.db
      .query('userProfiles')
      .withIndex('by_clerk_user_id', q => q.eq('clerkUserId', args.clerkUserId))
      .first();

    if (existing) {
      return { success: true, action: 'skipped', existing: true };
    }

    return { success: true, action: 'mapped', convexId: args.convexId };
  },
});

/**
 * Insert a migrated user profile.
 */
export const insertMigratedUserProfile = internalMutation({
  args: {
    clerkUserId: v.string(),
    username: v.string(),
    displayName: v.string(),
    totalXp: v.number(),
    currentStreak: v.number(),
    longestStreak: v.number(),
    lastActivityDate: v.string(),
    bestScore: v.number(),
    totalGamesPlayed: v.number(),
    totalStoriesCompleted: v.number(),
    totalWordsWritten: v.number(),
    preferredGradeLevel: v.union(
      v.literal('K-2'),
      v.literal('3-5'),
      v.literal('6-8'),
      v.literal('9-12'),
    ),
    speechEnabled: v.boolean(),
    avatarUrl: v.optional(v.string()),
    bio: v.optional(v.string()),
    onboardingCompleted: v.boolean(),
    onboardingProgress: v.object({
      create_account: v.boolean(),
      first_story: v.boolean(),
      first_image: v.boolean(),
      first_voice: v.boolean(),
      first_streak: v.boolean(),
    }),
    firstStoryCompletedAt: v.optional(v.string()),
    firstImageGeneratedAt: v.optional(v.string()),
    firstVoiceInputAt: v.optional(v.string()),
    firstStreakAchievedAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if profile already exists
    const existing = await ctx.db
      .query('userProfiles')
      .withIndex('by_clerk_user_id', q => q.eq('clerkUserId', args.clerkUserId))
      .first();

    if (existing) {
      return { success: true, action: 'skipped', id: existing._id };
    }

    const id = await ctx.db.insert('userProfiles', args);
    return { success: true, action: 'inserted', id };
  },
});

/**
 * Insert a migrated game session.
 */
export const insertMigratedGameSession = internalMutation({
  args: {
    userId: v.id('userProfiles'),
    clerkUserId: v.string(),
    completedAt: v.optional(v.string()),
    gradeLevel: v.union(
      v.literal('K-2'),
      v.literal('3-5'),
      v.literal('6-8'),
      v.literal('9-12'),
    ),
    finalScore: v.number(),
    wordsWritten: v.number(),
    sentencesCompleted: v.number(),
    challengesCompleted: v.number(),
    xpEarned: v.number(),
    storyContent: v.optional(v.string()),
    importedStoryContent: v.optional(v.string()),
    storySource: v.union(
      v.literal('New'),
      v.literal('CreativeBridge'),
      v.literal('Story_Quest'),
      v.literal('File'),
    ),
    originalCreationDate: v.optional(v.string()),
    storyMetadata: v.any(),
    generatedImageUrl: v.optional(v.string()),
    imageGenerationTimestamp: v.optional(v.string()),
    imageGenerationCost: v.optional(v.number()),
    currentRound: v.number(),
    imageUploadStatus: v.optional(
      v.union(v.literal('pending'), v.literal('uploaded'), v.literal('failed')),
    ),
    imageUploadAttempts: v.optional(v.number()),
    imageUploadError: v.optional(v.string()),
    supabaseSessionId: v.string(), // For ID mapping reference
  },
  handler: async (ctx, args) => {
    const { supabaseSessionId, ...sessionData } = args;

    const id = await ctx.db.insert('gameSessions', sessionData);
    return { success: true, id, supabaseId: supabaseSessionId };
  },
});

/**
 * Insert a migrated image generation event.
 */
export const insertMigratedImageGenerationEvent = internalMutation({
  args: {
    userId: v.id('userProfiles'),
    clerkUserId: v.string(),
    sessionId: v.optional(v.id('gameSessions')),
    xpCost: v.number(),
    generationStatus: v.union(
      v.literal('pending'),
      v.literal('success'),
      v.literal('failed'),
      v.literal('refunded'),
      v.literal('timeout'),
    ),
    errorType: v.optional(
      v.union(
        v.literal('api_failure'),
        v.literal('content_safety'),
        v.literal('insufficient_xp'),
        v.literal('timeout'),
        v.literal('rate_limit'),
      ),
    ),
    serviceUsed: v.union(
      v.literal('stability-ai/stable-diffusion-3.5-large'),
      v.literal('google/nano-banana'),
      v.literal('replicate'),
      v.literal('backup_service'),
    ),
    apiResponseTime: v.optional(v.number()),
    imageUrl: v.optional(v.string()),
    storyGradeLevel: v.optional(v.string()),
    storyWordCount: v.optional(v.number()),
    promptUsed: v.optional(v.string()),
    metadata: v.any(),
    completedAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert('imageGenerationEvents', args);
    return { success: true, id };
  },
});

/**
 * Insert a migrated story element.
 */
export const insertMigratedStoryElement = internalMutation({
  args: {
    storyId: v.id('gameSessions'),
    sessionId: v.string(),
    elementType: v.union(
      v.literal('character'),
      v.literal('setting'),
      v.literal('object'),
      v.literal('plot_pattern'),
    ),
    elementText: v.string(),
    embeddingVector: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert('storyElements', args);
    return { success: true, id };
  },
});

/**
 * Insert a migrated story diversity score.
 */
export const insertMigratedStoryDiversityScore = internalMutation({
  args: {
    storyId: v.id('gameSessions'),
    diversityScore: v.number(),
    novelElementCount: v.number(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert('storyDiversityScores', args);
    return { success: true, id };
  },
});

/**
 * Insert a migrated story download history record.
 */
export const insertMigratedStoryDownloadHistory = internalMutation({
  args: {
    userId: v.id('userProfiles'),
    clerkUserId: v.string(),
    storySessionId: v.optional(v.id('gameSessions')),
    fileName: v.string(),
    filePath: v.string(),
    storyTitle: v.optional(v.string()),
    storyWordCount: v.optional(v.number()),
    storyCharacterCount: v.optional(v.number()),
    storyGradeLevel: v.optional(v.string()),
    storySource: v.optional(
      v.union(
        v.literal('New'),
        v.literal('CreativeBridge'),
        v.literal('Story_Quest'),
        v.literal('File'),
      ),
    ),
    downloadMethod: v.union(
      v.literal('share'),
      v.literal('save_to_files'),
      v.literal('export'),
      v.literal('clipboard'),
    ),
    appVersion: v.optional(v.string()),
    completedAt: v.optional(v.string()),
    retryCount: v.number(),
    fileExists: v.boolean(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert('storyDownloadHistory', args);
    return { success: true, id };
  },
});

/**
 * Insert a migrated feature flag.
 */
export const insertMigratedFeatureFlag = internalMutation({
  args: {
    featureName: v.string(),
    enabled: v.boolean(),
    config: v.any(),
    description: v.optional(v.string()),
    updatedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if feature flag already exists
    const existing = await ctx.db
      .query('featureFlags')
      .withIndex('by_name', q => q.eq('featureName', args.featureName))
      .first();

    if (existing) {
      return { success: true, action: 'skipped', id: existing._id };
    }

    const id = await ctx.db.insert('featureFlags', args);
    return { success: true, action: 'inserted', id };
  },
});

// ============================================================================
// Internal Queries - ID Mapping Lookups
// ============================================================================

/**
 * Get Convex user ID by Clerk user ID.
 */
export const getUserIdByClerkId = internalQuery({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_clerk_user_id', q => q.eq('clerkUserId', args.clerkUserId))
      .first();

    return profile?._id ?? null;
  },
});

/**
 * Get all user ID mappings (Clerk ID → Convex ID).
 */
export const getAllUserIdMappings = internalQuery({
  args: {},
  handler: async ctx => {
    const profiles = await ctx.db.query('userProfiles').collect();
    const mappings: Record<string, Id<'userProfiles'>> = {};

    for (const profile of profiles) {
      mappings[profile.clerkUserId] = profile._id;
    }

    return mappings;
  },
});

/**
 * Get all session ID mappings (Supabase UUID → Convex ID).
 * Uses clerkUserId + creation time as a composite key for lookups.
 */
export const getSessionIdMapping = internalQuery({
  args: {
    clerkUserId: v.string(),
    creationTime: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query('gameSessions')
      .withIndex('by_clerk_user', q => q.eq('clerkUserId', args.clerkUserId))
      .collect();

    // Return all sessions for this user (caller will match by other fields)
    return sessions.map(s => ({
      convexId: s._id,
      creationTime: s._creationTime,
      completedAt: s.completedAt,
    }));
  },
});

/**
 * Get all game sessions for building session ID mapping.
 * Returns minimal data needed for matching Supabase sessions.
 */
export const getAllGameSessionsForMapping = internalQuery({
  args: {},
  handler: async ctx => {
    const sessions = await ctx.db.query('gameSessions').collect();
    return sessions.map(s => ({
      convexId: s._id,
      clerkUserId: s.clerkUserId,
      creationTime: s._creationTime,
      completedAt: s.completedAt,
      wordsWritten: s.wordsWritten,
      gradeLevel: s.gradeLevel,
      storyContent: s.storyContent?.substring(0, 100), // First 100 chars for matching
    }));
  },
});

// ============================================================================
// Migration Actions
// ============================================================================

/**
 * Main entry point for user profile migration.
 *
 * This action:
 * 1. Fetches user profiles from Supabase in paginated batches
 * 2. Transforms snake_case → camelCase
 * 3. Inserts into Convex userProfiles table
 * 4. Tracks ID mappings for subsequent migrations
 *
 * @param supabaseUrl - Supabase project URL
 * @param supabaseKey - Supabase service role key (for bypassing RLS)
 * @param dryRun - If true, validate without inserting
 * @param offset - Starting offset for pagination
 * @param limit - Max records per batch
 */
export const migrateUserProfiles = action({
  args: {
    supabaseUrl: v.string(),
    supabaseKey: v.string(),
    dryRun: v.optional(v.boolean()),
    offset: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<MigrationResult> => {
    const startTime = Date.now();
    const limit = args.limit ?? BATCH_SIZE;
    const offset = args.offset ?? 0;
    const dryRun = args.dryRun ?? false;

    const result: MigrationResult = {
      success: true,
      tableName: 'user_profiles',
      totalRecords: 0,
      migratedRecords: 0,
      skippedRecords: 0,
      errorCount: 0,
      errors: [],
      duration: 0,
    };

    try {
      // Fetch from Supabase
      console.log(
        `[Migration] Fetching user_profiles from Supabase (offset: ${offset}, limit: ${limit})`,
      );

      const response = await fetch(
        `${args.supabaseUrl}/rest/v1/user_profiles?select=*&order=created_at.asc&offset=${offset}&limit=${limit}`,
        {
          headers: {
            apikey: args.supabaseKey,
            Authorization: `Bearer ${args.supabaseKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        throw new Error(
          `Supabase fetch failed: ${response.status} ${response.statusText}`,
        );
      }

      const profiles = (await response.json()) as SupabaseUserProfile[];
      result.totalRecords = profiles.length;

      console.log(`[Migration] Retrieved ${profiles.length} user profiles`);

      // Process each profile
      for (const profile of profiles) {
        try {
          // Skip if no Clerk user ID (legacy auth users)
          if (!profile.clerk_user_id) {
            result.skippedRecords++;
            console.log(
              `[Migration] Skipping profile ${profile.id}: No Clerk user ID`,
            );
            continue;
          }

          if (dryRun) {
            console.log(
              `[DryRun] Would migrate profile: ${profile.clerk_user_id}`,
            );
            result.migratedRecords++;
            continue;
          }

          // Transform and insert
          const insertResult = await ctx.runMutation(
            'migration:insertMigratedUserProfile' as any,
            {
              clerkUserId: profile.clerk_user_id,
              username: profile.username || `user_${profile.id.slice(0, 8)}`,
              displayName: profile.display_name || profile.username || 'User',
              totalXp: profile.total_xp ?? 0,
              currentStreak: profile.current_streak ?? 0,
              longestStreak: profile.longest_streak ?? 0,
              lastActivityDate:
                profile.last_activity_date ||
                new Date().toISOString().split('T')[0],
              bestScore: profile.best_score ?? 0,
              totalGamesPlayed: profile.total_games_played ?? 0,
              totalStoriesCompleted: profile.total_stories_completed ?? 0,
              totalWordsWritten: profile.total_words_written ?? 0,
              preferredGradeLevel: profile.preferred_grade_level || 'K-2',
              speechEnabled: profile.speech_enabled ?? true,
              avatarUrl: profile.avatar_url || undefined,
              bio: profile.bio || undefined,
              onboardingCompleted: profile.onboarding_completed ?? false,
              onboardingProgress: profile.onboarding_progress ?? {
                create_account: true,
                first_story: false,
                first_image: false,
                first_voice: false,
                first_streak: false,
              },
              firstStoryCompletedAt:
                profile.first_story_completed_at || undefined,
              firstImageGeneratedAt:
                profile.first_image_generated_at || undefined,
              firstVoiceInputAt: profile.first_voice_input_at || undefined,
              firstStreakAchievedAt:
                profile.first_streak_achieved_at || undefined,
            },
          );

          if ((insertResult as { action?: string }).action === 'skipped') {
            result.skippedRecords++;
            console.log(
              `[Migration] Profile already exists: ${profile.clerk_user_id}`,
            );
          } else {
            result.migratedRecords++;
            console.log(
              `[Migration] Migrated profile: ${profile.clerk_user_id}`,
            );
          }
        } catch (error) {
          result.errorCount++;
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          result.errors.push(`Profile ${profile.id}: ${errorMsg}`);

          if (result.errorCount >= MAX_ERRORS) {
            result.success = false;
            result.errors.push('Max errors reached, aborting migration');
            break;
          }
        }
      }
    } catch (error) {
      result.success = false;
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Fatal error: ${errorMsg}`);
    }

    result.duration = Date.now() - startTime;

    console.log(`[Migration] User profiles migration completed:`, {
      success: result.success,
      migrated: result.migratedRecords,
      skipped: result.skippedRecords,
      errors: result.errorCount,
      duration: `${result.duration}ms`,
    });

    return result;
  },
});

/**
 * Migrate game sessions from Supabase to Convex.
 *
 * Requires: User profiles migration must be complete (for ID mapping).
 */
export const migrateGameSessions = action({
  args: {
    supabaseUrl: v.string(),
    supabaseKey: v.string(),
    dryRun: v.optional(v.boolean()),
    offset: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<MigrationResult> => {
    const startTime = Date.now();
    const limit = args.limit ?? BATCH_SIZE;
    const offset = args.offset ?? 0;
    const dryRun = args.dryRun ?? false;

    const result: MigrationResult = {
      success: true,
      tableName: 'game_sessions',
      totalRecords: 0,
      migratedRecords: 0,
      skippedRecords: 0,
      errorCount: 0,
      errors: [],
      duration: 0,
    };

    try {
      // Get user ID mappings first
      console.log('[Migration] Loading user ID mappings...');

      const userMappings = (await ctx.runQuery(
        'migration:getAllUserIdMappings' as any,
        {},
      )) as Record<string, Id<'userProfiles'>>;

      console.log(
        `[Migration] Loaded ${Object.keys(userMappings).length} user mappings`,
      );

      // Fetch sessions from Supabase
      console.log(
        `[Migration] Fetching game_sessions from Supabase (offset: ${offset}, limit: ${limit})`,
      );

      const response = await fetch(
        `${args.supabaseUrl}/rest/v1/game_sessions?select=*,user_profiles!inner(clerk_user_id)&order=created_at.asc&offset=${offset}&limit=${limit}`,
        {
          headers: {
            apikey: args.supabaseKey,
            Authorization: `Bearer ${args.supabaseKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        throw new Error(
          `Supabase fetch failed: ${response.status} ${response.statusText}`,
        );
      }

      interface SessionWithUser extends SupabaseGameSession {
        user_profiles: { clerk_user_id: string };
      }

      const sessions = (await response.json()) as SessionWithUser[];
      result.totalRecords = sessions.length;

      console.log(`[Migration] Retrieved ${sessions.length} game sessions`);

      // Process each session
      for (const session of sessions) {
        try {
          const clerkUserId = session.user_profiles?.clerk_user_id;

          if (!clerkUserId) {
            result.skippedRecords++;
            console.log(
              `[Migration] Skipping session ${session.id}: No Clerk user ID`,
            );
            continue;
          }

          const userId = userMappings[clerkUserId];

          if (!userId) {
            result.skippedRecords++;
            console.log(
              `[Migration] Skipping session ${session.id}: User not found in Convex`,
            );
            continue;
          }

          if (dryRun) {
            console.log(`[DryRun] Would migrate session: ${session.id}`);
            result.migratedRecords++;
            continue;
          }

          // Transform and insert
          await ctx.runMutation('migration:insertMigratedGameSession' as any, {
            userId,
            clerkUserId,
            completedAt: session.completed_at || undefined,
            gradeLevel: session.grade_level || 'K-2',
            finalScore: session.final_score ?? 0,
            wordsWritten: session.words_written ?? 0,
            sentencesCompleted: session.sentences_completed ?? 0,
            challengesCompleted: session.challenges_completed ?? 0,
            xpEarned: session.xp_earned ?? 0,
            storyContent: session.story_content || undefined,
            importedStoryContent: session.imported_story_content || undefined,
            storySource: session.story_source || 'New',
            originalCreationDate: session.original_creation_date || undefined,
            storyMetadata: session.story_metadata ?? {},
            generatedImageUrl: session.generated_image_url || undefined,
            imageGenerationTimestamp:
              session.image_generation_timestamp || undefined,
            imageGenerationCost: session.image_generation_cost || undefined,
            currentRound: session.current_round ?? 1,
            imageUploadStatus: session.image_upload_status || undefined,
            imageUploadAttempts: session.image_upload_attempts || undefined,
            imageUploadError: session.image_upload_error || undefined,
            supabaseSessionId: session.id,
          });

          result.migratedRecords++;
          console.log(`[Migration] Migrated session: ${session.id}`);
        } catch (error) {
          result.errorCount++;
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          result.errors.push(`Session ${session.id}: ${errorMsg}`);

          if (result.errorCount >= MAX_ERRORS) {
            result.success = false;
            result.errors.push('Max errors reached, aborting migration');
            break;
          }
        }
      }
    } catch (error) {
      result.success = false;
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Fatal error: ${errorMsg}`);
    }

    result.duration = Date.now() - startTime;

    console.log(`[Migration] Game sessions migration completed:`, {
      success: result.success,
      migrated: result.migratedRecords,
      skipped: result.skippedRecords,
      errors: result.errorCount,
      duration: `${result.duration}ms`,
    });

    return result;
  },
});

/**
 * Migrate image generation events from Supabase to Convex.
 *
 * Requires: User profiles and game sessions migrations must be complete.
 *
 * Note: The image_generation_events table has no FK relationship to user_profiles,
 * so we fetch user profiles separately and build a user_id → clerk_user_id mapping.
 */
export const migrateImageGenerationEvents = action({
  args: {
    supabaseUrl: v.string(),
    supabaseKey: v.string(),
    dryRun: v.optional(v.boolean()),
    offset: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<MigrationResult> => {
    const startTime = Date.now();
    const limit = args.limit ?? BATCH_SIZE;
    const offset = args.offset ?? 0;
    const dryRun = args.dryRun ?? false;

    const result: MigrationResult = {
      success: true,
      tableName: 'image_generation_events',
      totalRecords: 0,
      migratedRecords: 0,
      skippedRecords: 0,
      errorCount: 0,
      errors: [],
      duration: 0,
    };

    try {
      // Get Convex user ID mappings (clerkUserId → Convex ID)
      console.log('[Migration] Loading Convex user ID mappings...');

      const convexUserMappings = (await ctx.runQuery(
        'migration:getAllUserIdMappings' as any,
        {},
      )) as Record<string, Id<'userProfiles'>>;

      console.log(
        `[Migration] Loaded ${
          Object.keys(convexUserMappings).length
        } Convex user mappings`,
      );

      // Fetch Supabase user profiles to build user_id → clerk_user_id mapping
      console.log('[Migration] Fetching Supabase user profiles for mapping...');

      const userProfilesResponse = await fetch(
        `${args.supabaseUrl}/rest/v1/user_profiles?select=id,clerk_user_id`,
        {
          headers: {
            apikey: args.supabaseKey,
            Authorization: `Bearer ${args.supabaseKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!userProfilesResponse.ok) {
        throw new Error(
          `Supabase user_profiles fetch failed: ${userProfilesResponse.status} ${userProfilesResponse.statusText}`,
        );
      }

      interface SupabaseUserIdMapping {
        id: string;
        clerk_user_id: string | null;
      }

      const supabaseUsers =
        (await userProfilesResponse.json()) as SupabaseUserIdMapping[];
      const supabaseUserIdToClerkId: Record<string, string> = {};

      for (const user of supabaseUsers) {
        if (user.clerk_user_id) {
          supabaseUserIdToClerkId[user.id] = user.clerk_user_id;
        }
      }

      console.log(
        `[Migration] Built mapping for ${
          Object.keys(supabaseUserIdToClerkId).length
        } Supabase users with Clerk IDs`,
      );

      // Fetch events from Supabase (without join - no FK relationship exists)
      console.log(
        `[Migration] Fetching image_generation_events (offset: ${offset}, limit: ${limit})`,
      );

      const response = await fetch(
        `${args.supabaseUrl}/rest/v1/image_generation_events?select=*&order=created_at.asc&offset=${offset}&limit=${limit}`,
        {
          headers: {
            apikey: args.supabaseKey,
            Authorization: `Bearer ${args.supabaseKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        throw new Error(
          `Supabase fetch failed: ${response.status} ${response.statusText}`,
        );
      }

      const events = (await response.json()) as SupabaseImageGenerationEvent[];
      result.totalRecords = events.length;

      console.log(
        `[Migration] Retrieved ${events.length} image generation events`,
      );

      // Process each event
      for (const event of events) {
        try {
          // Look up clerk_user_id from Supabase user_id
          const clerkUserId = supabaseUserIdToClerkId[event.user_id];

          if (!clerkUserId) {
            result.skippedRecords++;
            console.log(
              `[Migration] Skipping event ${event.id}: User ${event.user_id} has no Clerk ID`,
            );
            continue;
          }

          // Look up Convex user ID from clerk_user_id
          const userId = convexUserMappings[clerkUserId];

          if (!userId) {
            result.skippedRecords++;
            console.log(
              `[Migration] Skipping event ${event.id}: Clerk user ${clerkUserId} not found in Convex`,
            );
            continue;
          }

          if (dryRun) {
            console.log(`[DryRun] Would migrate event: ${event.id}`);
            result.migratedRecords++;
            continue;
          }

          // For session_id, we'd need a session mapping
          // For now, we skip the session reference (it can be linked later)
          await ctx.runMutation(
            'migration:insertMigratedImageGenerationEvent' as any,
            {
              userId,
              clerkUserId,
              sessionId: undefined, // Session mapping would require additional query
              xpCost: event.xp_cost ?? 1000,
              generationStatus: event.generation_status || 'pending',
              errorType: event.error_type || undefined,
              serviceUsed: event.service_used || 'replicate',
              apiResponseTime: event.api_response_time || undefined,
              imageUrl: event.image_url || undefined,
              storyGradeLevel: event.story_grade_level || undefined,
              storyWordCount: event.story_word_count || undefined,
              promptUsed: event.prompt_used || undefined,
              metadata: event.metadata ?? {},
              completedAt: event.completed_at || undefined,
            },
          );

          result.migratedRecords++;
          console.log(`[Migration] Migrated event: ${event.id}`);
        } catch (error) {
          result.errorCount++;
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          result.errors.push(`Event ${event.id}: ${errorMsg}`);

          if (result.errorCount >= MAX_ERRORS) {
            result.success = false;
            break;
          }
        }
      }
    } catch (error) {
      result.success = false;
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Fatal error: ${errorMsg}`);
    }

    result.duration = Date.now() - startTime;

    console.log(`[Migration] Image generation events migration completed:`, {
      success: result.success,
      total: result.totalRecords,
      migrated: result.migratedRecords,
      skipped: result.skippedRecords,
      errors: result.errorCount,
      duration: `${result.duration}ms`,
    });

    return result;
  },
});

/**
 * Migrate story elements (story diversity tracking data).
 *
 * Requires: Game sessions migration must be complete (for story_id mapping).
 *
 * This migration:
 * 1. Fetches story_elements from Supabase with their associated game_session data
 * 2. Maps Supabase story_id (game_sessions.id UUID) to Convex gameSessions._id
 * 3. Inserts elements with proper Convex references
 */
export const migrateStoryElements = action({
  args: {
    supabaseUrl: v.string(),
    supabaseKey: v.string(),
    dryRun: v.optional(v.boolean()),
    offset: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<MigrationResult> => {
    const startTime = Date.now();
    const limit = args.limit ?? BATCH_SIZE;
    const offset = args.offset ?? 0;
    const dryRun = args.dryRun ?? false;

    const result: MigrationResult = {
      success: true,
      tableName: 'story_elements',
      totalRecords: 0,
      migratedRecords: 0,
      skippedRecords: 0,
      errorCount: 0,
      errors: [],
      duration: 0,
    };

    try {
      // Get Convex game sessions for building mapping
      console.log('[Migration] Loading Convex game sessions for mapping...');

      const convexSessions = (await ctx.runQuery(
        'migration:getAllGameSessionsForMapping' as any,
        {},
      )) as Array<{
        convexId: Id<'gameSessions'>;
        clerkUserId: string;
        creationTime: number;
        completedAt?: string;
        wordsWritten: number;
        gradeLevel: string;
        storyContent?: string;
      }>;

      console.log(
        `[Migration] Loaded ${convexSessions.length} Convex sessions for mapping`,
      );

      // Fetch story_elements with their associated game_sessions to get clerk_user_id
      console.log(
        `[Migration] Fetching story_elements (offset: ${offset}, limit: ${limit})`,
      );

      const response = await fetch(
        `${args.supabaseUrl}/rest/v1/story_elements?select=*,game_sessions!inner(id,user_profiles!inner(clerk_user_id))&order=created_at.asc&offset=${offset}&limit=${limit}`,
        {
          headers: {
            apikey: args.supabaseKey,
            Authorization: `Bearer ${args.supabaseKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        // Check if table doesn't exist (empty response is also valid)
        const responseText = await response.text();
        if (
          response.status === 404 ||
          responseText.includes('does not exist')
        ) {
          console.log(
            '[Migration] story_elements table does not exist, skipping',
          );
          result.errors.push('Table does not exist in Supabase');
          return result;
        }
        throw new Error(
          `Supabase fetch failed: ${response.status} ${response.statusText} - ${responseText}`,
        );
      }

      interface ElementWithSession extends SupabaseStoryElement {
        game_sessions: {
          id: string;
          user_profiles: { clerk_user_id: string };
        };
      }

      const elements = (await response.json()) as ElementWithSession[];
      result.totalRecords = elements.length;

      if (elements.length === 0) {
        console.log('[Migration] No story elements found in Supabase');
        return result;
      }

      console.log(`[Migration] Retrieved ${elements.length} story elements`);

      // Build Supabase session UUID → Convex ID mapping using clerk_user_id
      // We match sessions by: clerkUserId + approximate creation time
      const sessionMapping: Record<string, Id<'gameSessions'>> = {};

      // Group Convex sessions by clerkUserId for efficient lookup
      const sessionsByClerk: Record<string, typeof convexSessions> = {};
      for (const session of convexSessions) {
        if (!sessionsByClerk[session.clerkUserId]) {
          sessionsByClerk[session.clerkUserId] = [];
        }
        sessionsByClerk[session.clerkUserId].push(session);
      }

      // Process each element
      for (const element of elements) {
        try {
          const clerkUserId =
            element.game_sessions?.user_profiles?.clerk_user_id;
          const supabaseStoryId = element.story_id;

          if (!clerkUserId) {
            result.skippedRecords++;
            console.log(
              `[Migration] Skipping element ${element.id}: No Clerk user ID on associated session`,
            );
            continue;
          }

          // Find matching Convex session
          let convexSessionId = sessionMapping[supabaseStoryId];

          if (!convexSessionId) {
            // Try to find matching session by clerk user
            const userSessions = sessionsByClerk[clerkUserId] || [];

            if (userSessions.length === 0) {
              result.skippedRecords++;
              console.log(
                `[Migration] Skipping element ${element.id}: No Convex sessions for user ${clerkUserId}`,
              );
              continue;
            }

            // If only one session, use it; otherwise match by creation time proximity
            if (userSessions.length === 1) {
              convexSessionId = userSessions[0].convexId;
            } else {
              // Match by element creation time (elements are tied to sessions)
              const elementCreatedAt = new Date(element.created_at).getTime();

              // Find session with closest creation time before the element
              const matchingSession = userSessions
                .filter(s => s.creationTime <= elementCreatedAt)
                .sort((a, b) => b.creationTime - a.creationTime)[0];

              convexSessionId =
                matchingSession?.convexId || userSessions[0].convexId;
            }

            sessionMapping[supabaseStoryId] = convexSessionId;
          }

          if (dryRun) {
            console.log(
              `[DryRun] Would migrate element: ${element.id} → session ${convexSessionId}`,
            );
            result.migratedRecords++;
            continue;
          }

          // Insert the element
          await ctx.runMutation('migration:insertMigratedStoryElement' as any, {
            storyId: convexSessionId,
            sessionId: element.session_id, // Original user session UUID (for diversity scoping)
            elementType: element.element_type,
            elementText: element.element_text,
            embeddingVector: element.embedding_vector || undefined,
          });

          result.migratedRecords++;
          console.log(`[Migration] Migrated element: ${element.id}`);
        } catch (error) {
          result.errorCount++;
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          result.errors.push(`Element ${element.id}: ${errorMsg}`);

          if (result.errorCount >= MAX_ERRORS) {
            result.success = false;
            result.errors.push('Max errors reached, aborting migration');
            break;
          }
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Warning: ${errorMsg}`);
    }

    result.duration = Date.now() - startTime;

    console.log(`[Migration] Story elements migration completed:`, {
      success: result.success,
      total: result.totalRecords,
      migrated: result.migratedRecords,
      skipped: result.skippedRecords,
      errors: result.errorCount,
      duration: `${result.duration}ms`,
    });

    return result;
  },
});

/**
 * Migrate story diversity scores.
 *
 * Requires: Game sessions migration must be complete (for story_id mapping).
 *
 * This migration:
 * 1. Fetches story_diversity_scores from Supabase with their associated game_session data
 * 2. Maps Supabase story_id (game_sessions.id UUID) to Convex gameSessions._id
 * 3. Inserts scores with proper Convex references
 */
export const migrateStoryDiversityScores = action({
  args: {
    supabaseUrl: v.string(),
    supabaseKey: v.string(),
    dryRun: v.optional(v.boolean()),
    offset: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<MigrationResult> => {
    const startTime = Date.now();
    const limit = args.limit ?? BATCH_SIZE;
    const offset = args.offset ?? 0;
    const dryRun = args.dryRun ?? false;

    const result: MigrationResult = {
      success: true,
      tableName: 'story_diversity_scores',
      totalRecords: 0,
      migratedRecords: 0,
      skippedRecords: 0,
      errorCount: 0,
      errors: [],
      duration: 0,
    };

    try {
      // Get Convex game sessions for building mapping
      console.log('[Migration] Loading Convex game sessions for mapping...');

      const convexSessions = (await ctx.runQuery(
        'migration:getAllGameSessionsForMapping' as any,
        {},
      )) as Array<{
        convexId: Id<'gameSessions'>;
        clerkUserId: string;
        creationTime: number;
        completedAt?: string;
        wordsWritten: number;
        gradeLevel: string;
        storyContent?: string;
      }>;

      console.log(
        `[Migration] Loaded ${convexSessions.length} Convex sessions for mapping`,
      );

      // Fetch story_diversity_scores with their associated game_sessions to get clerk_user_id
      console.log(
        `[Migration] Fetching story_diversity_scores (offset: ${offset}, limit: ${limit})`,
      );

      const response = await fetch(
        `${args.supabaseUrl}/rest/v1/story_diversity_scores?select=*,game_sessions!inner(id,user_profiles!inner(clerk_user_id))&order=created_at.asc&offset=${offset}&limit=${limit}`,
        {
          headers: {
            apikey: args.supabaseKey,
            Authorization: `Bearer ${args.supabaseKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        const responseText = await response.text();
        if (
          response.status === 404 ||
          responseText.includes('does not exist')
        ) {
          console.log(
            '[Migration] story_diversity_scores table does not exist, skipping',
          );
          result.errors.push('Table does not exist in Supabase');
          return result;
        }
        throw new Error(
          `Supabase fetch failed: ${response.status} ${response.statusText} - ${responseText}`,
        );
      }

      interface ScoreWithSession extends SupabaseStoryDiversityScore {
        game_sessions: {
          id: string;
          user_profiles: { clerk_user_id: string };
        };
      }

      const scores = (await response.json()) as ScoreWithSession[];
      result.totalRecords = scores.length;

      if (scores.length === 0) {
        console.log('[Migration] No diversity scores found in Supabase');
        return result;
      }

      console.log(`[Migration] Retrieved ${scores.length} diversity scores`);

      // Build Supabase session UUID → Convex ID mapping
      const sessionMapping: Record<string, Id<'gameSessions'>> = {};

      // Group Convex sessions by clerkUserId for efficient lookup
      const sessionsByClerk: Record<string, typeof convexSessions> = {};
      for (const session of convexSessions) {
        if (!sessionsByClerk[session.clerkUserId]) {
          sessionsByClerk[session.clerkUserId] = [];
        }
        sessionsByClerk[session.clerkUserId].push(session);
      }

      // Process each score
      for (const score of scores) {
        try {
          const clerkUserId = score.game_sessions?.user_profiles?.clerk_user_id;
          const supabaseStoryId = score.story_id;

          if (!clerkUserId) {
            result.skippedRecords++;
            console.log(
              `[Migration] Skipping score ${score.id}: No Clerk user ID on associated session`,
            );
            continue;
          }

          // Find matching Convex session
          let convexSessionId = sessionMapping[supabaseStoryId];

          if (!convexSessionId) {
            const userSessions = sessionsByClerk[clerkUserId] || [];

            if (userSessions.length === 0) {
              result.skippedRecords++;
              console.log(
                `[Migration] Skipping score ${score.id}: No Convex sessions for user ${clerkUserId}`,
              );
              continue;
            }

            // Match by creation time proximity
            if (userSessions.length === 1) {
              convexSessionId = userSessions[0].convexId;
            } else {
              const scoreCreatedAt = new Date(score.created_at).getTime();
              const matchingSession = userSessions
                .filter(s => s.creationTime <= scoreCreatedAt)
                .sort((a, b) => b.creationTime - a.creationTime)[0];
              convexSessionId =
                matchingSession?.convexId || userSessions[0].convexId;
            }

            sessionMapping[supabaseStoryId] = convexSessionId;
          }

          if (dryRun) {
            console.log(
              `[DryRun] Would migrate score: ${score.id} → session ${convexSessionId}`,
            );
            result.migratedRecords++;
            continue;
          }

          // Insert the diversity score
          await ctx.runMutation(
            'migration:insertMigratedStoryDiversityScore' as any,
            {
              storyId: convexSessionId,
              diversityScore: Number(score.diversity_score),
              novelElementCount: score.novel_element_count,
              metadata: score.metadata || undefined,
            },
          );

          result.migratedRecords++;
          console.log(`[Migration] Migrated score: ${score.id}`);
        } catch (error) {
          result.errorCount++;
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          result.errors.push(`Score ${score.id}: ${errorMsg}`);

          if (result.errorCount >= MAX_ERRORS) {
            result.success = false;
            result.errors.push('Max errors reached, aborting migration');
            break;
          }
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Warning: ${errorMsg}`);
    }

    result.duration = Date.now() - startTime;

    console.log(`[Migration] Diversity scores migration completed:`, {
      success: result.success,
      total: result.totalRecords,
      migrated: result.migratedRecords,
      skipped: result.skippedRecords,
      errors: result.errorCount,
      duration: `${result.duration}ms`,
    });

    return result;
  },
});

/**
 * Migrate story download history.
 */
export const migrateStoryDownloadHistory = action({
  args: {
    supabaseUrl: v.string(),
    supabaseKey: v.string(),
    dryRun: v.optional(v.boolean()),
    offset: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<MigrationResult> => {
    const startTime = Date.now();
    const limit = args.limit ?? BATCH_SIZE;
    const offset = args.offset ?? 0;
    const dryRun = args.dryRun ?? false;

    const result: MigrationResult = {
      success: true,
      tableName: 'story_download_history',
      totalRecords: 0,
      migratedRecords: 0,
      skippedRecords: 0,
      errorCount: 0,
      errors: [],
      duration: 0,
    };

    try {
      // Get user ID mappings

      const userMappings = (await ctx.runQuery(
        'migration:getAllUserIdMappings' as any,
        {},
      )) as Record<string, Id<'userProfiles'>>;

      console.log(
        `[Migration] Fetching story_download_history (offset: ${offset}, limit: ${limit})`,
      );

      const response = await fetch(
        `${args.supabaseUrl}/rest/v1/story_download_history?select=*&order=created_at.asc&offset=${offset}&limit=${limit}`,
        {
          headers: {
            apikey: args.supabaseKey,
            Authorization: `Bearer ${args.supabaseKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        if (response.status === 404) {
          console.log(
            '[Migration] story_download_history table does not exist, skipping',
          );
          result.errors.push('Table does not exist in Supabase');
          return result;
        }
        throw new Error(
          `Supabase fetch failed: ${response.status} ${response.statusText}`,
        );
      }

      const history = (await response.json()) as SupabaseStoryDownloadHistory[];
      result.totalRecords = history.length;

      console.log(
        `[Migration] Retrieved ${history.length} download history records`,
      );

      for (const record of history) {
        try {
          const userId = userMappings[record.clerk_user_id];

          if (!userId) {
            result.skippedRecords++;
            continue;
          }

          if (dryRun) {
            result.migratedRecords++;
            continue;
          }

          await ctx.runMutation(
            'migration:insertMigratedStoryDownloadHistory' as any,
            {
              userId,
              clerkUserId: record.clerk_user_id,
              storySessionId: undefined, // Would need session mapping
              fileName: record.file_name,
              filePath: record.file_path,
              storyTitle: record.story_title || undefined,
              storyWordCount: record.story_word_count || undefined,
              storyCharacterCount: record.story_character_count || undefined,
              storyGradeLevel: record.story_grade_level || undefined,
              storySource: record.story_source || undefined,
              downloadMethod: record.download_method || 'share',
              appVersion: record.app_version || undefined,
              completedAt: record.completed_at || undefined,
              retryCount: record.retry_count ?? 0,
              fileExists: record.file_exists ?? false,
              metadata: record.metadata ?? {},
            },
          );

          result.migratedRecords++;
        } catch (error) {
          result.errorCount++;
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          result.errors.push(`Download record ${record.id}: ${errorMsg}`);

          if (result.errorCount >= MAX_ERRORS) {
            result.success = false;
            break;
          }
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Warning: ${errorMsg}`);
    }

    result.duration = Date.now() - startTime;

    console.log(`[Migration] Download history migration completed:`, {
      success: result.success,
      migrated: result.migratedRecords,
      skipped: result.skippedRecords,
      errors: result.errorCount,
      duration: `${result.duration}ms`,
    });

    return result;
  },
});

/**
 * Migrate feature flags from Supabase to Convex.
 *
 * Feature flags are application configuration records, not user data.
 * Migration is straightforward - no user ID mapping needed.
 */
export const migrateFeatureFlags = action({
  args: {
    supabaseUrl: v.string(),
    supabaseKey: v.string(),
    dryRun: v.optional(v.boolean()),
    offset: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<MigrationResult> => {
    const startTime = Date.now();
    const limit = args.limit ?? BATCH_SIZE;
    const offset = args.offset ?? 0;
    const dryRun = args.dryRun ?? false;

    const result: MigrationResult = {
      success: true,
      tableName: 'feature_flags',
      totalRecords: 0,
      migratedRecords: 0,
      skippedRecords: 0,
      errorCount: 0,
      errors: [],
      duration: 0,
    };

    try {
      console.log(
        `[Migration] Fetching feature_flags (offset: ${offset}, limit: ${limit})`,
      );

      const response = await fetch(
        `${args.supabaseUrl}/rest/v1/feature_flags?select=*&order=created_at.asc&offset=${offset}&limit=${limit}`,
        {
          headers: {
            apikey: args.supabaseKey,
            Authorization: `Bearer ${args.supabaseKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        const responseText = await response.text();
        if (
          response.status === 404 ||
          responseText.includes('does not exist')
        ) {
          console.log(
            '[Migration] feature_flags table does not exist, skipping',
          );
          result.errors.push('Table does not exist in Supabase');
          return result;
        }
        throw new Error(
          `Supabase fetch failed: ${response.status} ${response.statusText} - ${responseText}`,
        );
      }

      interface SupabaseFeatureFlagRecord {
        id: string;
        feature_name: string;
        config: Record<string, unknown>;
        enabled: boolean;
        created_at: string;
        updated_at: string;
        updated_by?: string;
        description?: string;
      }

      const flags = (await response.json()) as SupabaseFeatureFlagRecord[];
      result.totalRecords = flags.length;

      if (flags.length === 0) {
        console.log('[Migration] No feature flags found in Supabase');
        return result;
      }

      console.log(`[Migration] Retrieved ${flags.length} feature flags`);

      for (const flag of flags) {
        try {
          if (dryRun) {
            console.log(`[DryRun] Would migrate flag: ${flag.feature_name}`);
            result.migratedRecords++;
            continue;
          }

          const insertResult = await ctx.runMutation(
            'migration:insertMigratedFeatureFlag' as any,
            {
              featureName: flag.feature_name,
              enabled: flag.enabled,
              config: flag.config || {},
              description: flag.description || undefined,
              updatedBy: flag.updated_by || undefined,
            },
          );

          if ((insertResult as { action?: string }).action === 'skipped') {
            result.skippedRecords++;
            console.log(
              `[Migration] Feature flag already exists: ${flag.feature_name}`,
            );
          } else {
            result.migratedRecords++;
            console.log(`[Migration] Migrated flag: ${flag.feature_name}`);
          }
        } catch (error) {
          result.errorCount++;
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          result.errors.push(`Flag ${flag.feature_name}: ${errorMsg}`);

          if (result.errorCount >= MAX_ERRORS) {
            result.success = false;
            result.errors.push('Max errors reached, aborting migration');
            break;
          }
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Warning: ${errorMsg}`);
    }

    result.duration = Date.now() - startTime;

    console.log(`[Migration] Feature flags migration completed:`, {
      success: result.success,
      total: result.totalRecords,
      migrated: result.migratedRecords,
      skipped: result.skippedRecords,
      errors: result.errorCount,
      duration: `${result.duration}ms`,
    });

    return result;
  },
});

// ============================================================================
// Image Storage Migration
// ============================================================================

/**
 * Result tracking for image migration.
 */
interface ImageMigrationResult {
  success: boolean;
  totalImages: number;
  migratedImages: number;
  skippedImages: number;
  failedImages: number;
  errors: string[];
  duration: number;
}

/**
 * Internal query to get game sessions that have images needing migration.
 *
 * A session needs image migration if:
 * 1. It has a generatedImageUrl (external URL)
 * 2. It does NOT have a storageId (Convex storage reference)
 * 3. The URL is a Supabase storage URL
 *
 * @internal
 */
export const getSessionsNeedingImageMigration = internalQuery({
  args: {
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    const offset = args.offset ?? 0;

    // Get all sessions with images
    const allSessions = await ctx.db.query('gameSessions').collect();

    // Filter to sessions that need migration
    const sessionsNeedingMigration = allSessions.filter(session => {
      // Must have an image URL
      if (!session.generatedImageUrl) return false;

      // Must NOT already have a Convex storage ID
      if (session.storageId) return false;

      // Check if it's a Supabase URL (or any external URL we want to migrate)
      const url = session.generatedImageUrl;
      const isSupabaseUrl = url.includes('supabase.co/storage');
      const isReplicateUrl = url.includes('replicate.delivery');

      // Migrate both Supabase and Replicate URLs
      return isSupabaseUrl || isReplicateUrl;
    });

    // Apply pagination
    const paginatedSessions = sessionsNeedingMigration.slice(
      offset,
      offset + limit,
    );

    return {
      sessions: paginatedSessions.map(s => ({
        sessionId: s._id,
        clerkUserId: s.clerkUserId,
        imageUrl: s.generatedImageUrl,
        createdAt: s._creationTime,
      })),
      totalCount: sessionsNeedingMigration.length,
      hasMore: offset + limit < sessionsNeedingMigration.length,
    };
  },
});

/**
 * Internal mutation to update a session after image migration.
 * Used by the migration action since actions can't directly access ctx.db.
 *
 * @internal
 */
export const updateSessionImageAfterMigration = internalMutation({
  args: {
    sessionId: v.id('gameSessions'),
    storageId: v.id('_storage'),
    newImageUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error(`Session ${args.sessionId} not found`);
    }

    await ctx.db.patch(args.sessionId, {
      storageId: args.storageId,
      imageUploadStatus: 'uploaded',
      imageUploadAttempts: 1,
      imageUploadError: undefined,
      // Update URL to point to Convex storage
      generatedImageUrl: args.newImageUrl,
      imageGenerationTimestamp: new Date().toISOString(),
    });

    return { success: true };
  },
});

/**
 * Internal mutation to mark an image migration as failed.
 *
 * @internal
 */
export const markImageMigrationFailed = internalMutation({
  args: {
    sessionId: v.id('gameSessions'),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      return { success: false };
    }

    await ctx.db.patch(args.sessionId, {
      imageUploadStatus: 'failed',
      imageUploadAttempts: (session.imageUploadAttempts ?? 0) + 1,
      imageUploadError: args.error,
    });

    return { success: true };
  },
});

/**
 * Migrate images from Supabase Storage to Convex Storage.
 *
 * This action:
 * 1. Finds game sessions with external image URLs (Supabase/Replicate)
 * 2. Downloads each image from the external URL
 * 3. Uploads to Convex Storage
 * 4. Updates the session with the new storageId
 *
 * The migration is idempotent - sessions that already have storageId are skipped.
 *
 * @param batchSize - Number of images to process per batch (default: 10)
 * @param dryRun - If true, only report what would be migrated
 * @param offset - Starting offset for pagination (for resuming)
 *
 * @example
 * ```bash
 * # Run migration
 * npx convex run migration:migrateStorageImages --args '{"batchSize": 10}'
 *
 * # Dry run first
 * npx convex run migration:migrateStorageImages --args '{"dryRun": true}'
 *
 * # Resume from offset
 * npx convex run migration:migrateStorageImages --args '{"offset": 20}'
 * ```
 */
export const migrateStorageImages = action({
  args: {
    batchSize: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<ImageMigrationResult> => {
    const startTime = Date.now();
    const batchSize = args.batchSize ?? 10;
    const dryRun = args.dryRun ?? false;
    const offset = args.offset ?? 0;

    const result: ImageMigrationResult = {
      success: true,
      totalImages: 0,
      migratedImages: 0,
      skippedImages: 0,
      failedImages: 0,
      errors: [],
      duration: 0,
    };

    let hasMoreImages = false;

    try {
      console.log(`[ImageMigration] Starting image migration...`);
      console.log(`  Batch size: ${batchSize}`);
      console.log(`  Dry run: ${dryRun}`);
      console.log(`  Offset: ${offset}`);

      // Get sessions that need image migration
      const sessionsData = await ctx.runQuery(
        'migration:getSessionsNeedingImageMigration' as any,
        { limit: batchSize, offset },
      );

      const sessions = sessionsData.sessions as Array<{
        sessionId: Id<'gameSessions'>;
        clerkUserId: string;
        imageUrl: string;
        createdAt: number;
      }>;

      result.totalImages = sessionsData.totalCount;
      hasMoreImages = sessionsData.hasMore;

      console.log(
        `[ImageMigration] Found ${result.totalImages} images needing migration`,
      );
      console.log(
        `[ImageMigration] Processing batch of ${sessions.length} images`,
      );

      if (sessions.length === 0) {
        console.log('[ImageMigration] No images to migrate in this batch');
        result.duration = Date.now() - startTime;
        return result;
      }

      // Process each session
      for (const session of sessions) {
        try {
          console.log(
            `\n[ImageMigration] Processing session ${session.sessionId}`,
          );
          console.log(`  Source URL: ${session.imageUrl.substring(0, 80)}...`);

          if (dryRun) {
            console.log(`  [DryRun] Would migrate this image`);
            result.migratedImages++;
            continue;
          }

          // Step 1: Download the image
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

          let imageData: ArrayBuffer;
          let contentType: string;

          try {
            const fetchOptions: RequestInit = {
              headers: {
                Accept: 'image/png,image/jpeg,image/webp,image/*',
              },
            };
            (fetchOptions as Record<string, unknown>).signal =
              controller.signal;

            const response = await fetch(session.imageUrl, fetchOptions);

            if (!response.ok) {
              // Skip 404 errors (image no longer exists)
              if (response.status === 404) {
                console.log(`  ⚠️ Image not found (404), skipping`);
                result.skippedImages++;
                continue;
              }
              throw new Error(
                `HTTP ${response.status}: ${response.statusText}`,
              );
            }

            contentType = response.headers.get('content-type') || 'image/png';
            imageData = await response.arrayBuffer();

            if (!imageData || imageData.byteLength === 0) {
              console.log(`  ⚠️ Empty image data, skipping`);
              result.skippedImages++;
              continue;
            }

            // Check size limit (10MB)
            if (imageData.byteLength > 10 * 1024 * 1024) {
              console.log(
                `  ⚠️ Image too large (${(
                  imageData.byteLength /
                  1024 /
                  1024
                ).toFixed(2)}MB), skipping`,
              );
              result.skippedImages++;
              continue;
            }

            console.log(
              `  ✓ Downloaded (${(imageData.byteLength / 1024).toFixed(2)} KB)`,
            );
          } catch (error: unknown) {
            if (error instanceof Error && error.name === 'AbortError') {
              throw new Error('Download timeout after 30s');
            }
            throw error;
          } finally {
            clearTimeout(timeoutId);
          }

          // Step 2: Upload to Convex storage
          const storageId = await ctx.storage.store(
            new Blob([imageData], { type: contentType }),
          );
          console.log(`  ✓ Uploaded to Convex: ${storageId}`);

          // Step 3: Get the new URL
          const newImageUrl = await ctx.storage.getUrl(storageId);
          if (!newImageUrl) {
            throw new Error('Failed to get URL for uploaded image');
          }

          // Step 4: Update the session
          await ctx.runMutation(
            'migration:updateSessionImageAfterMigration' as any,
            {
              sessionId: session.sessionId,
              storageId,
              newImageUrl,
            },
          );

          console.log(`  ✅ Migration complete`);
          result.migratedImages++;
        } catch (error) {
          result.failedImages++;
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          const errorRecord = `Session ${session.sessionId}: ${errorMsg}`;
          result.errors.push(errorRecord);
          console.log(`  ❌ Error: ${errorMsg}`);

          // Record the failure in the database
          try {
            await ctx.runMutation('migration:markImageMigrationFailed' as any, {
              sessionId: session.sessionId,
              error: errorMsg,
            });
          } catch {
            // Ignore errors in error recording
          }

          // Stop if too many errors
          if (result.failedImages >= MAX_ERRORS) {
            result.success = false;
            result.errors.push('Max errors reached, aborting migration');
            break;
          }
        }
      }
    } catch (error) {
      result.success = false;
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Fatal error: ${errorMsg}`);
    }

    result.duration = Date.now() - startTime;

    console.log(`\n[ImageMigration] Migration batch completed:`);
    console.log(`  Success: ${result.success}`);
    console.log(`  Total images: ${result.totalImages}`);
    console.log(`  Migrated: ${result.migratedImages}`);
    console.log(`  Skipped: ${result.skippedImages}`);
    console.log(`  Failed: ${result.failedImages}`);
    console.log(`  Duration: ${result.duration}ms`);

    if (hasMoreImages) {
      console.log(
        `\n[ImageMigration] More images remaining. Run with offset=${
          offset + batchSize
        } to continue.`,
      );
    }

    return result;
  },
});

/**
 * Get the current status of image migration.
 *
 * Returns counts of:
 * - Sessions with images that need migration (external URLs without storageId)
 * - Sessions with successfully migrated images (have storageId)
 * - Sessions with failed migrations
 */
export const getImageMigrationStatus = query({
  args: {},
  handler: async ctx => {
    const allSessions = await ctx.db.query('gameSessions').collect();

    // Count different states
    let needsMigration = 0;
    let migrated = 0;
    let failed = 0;
    let noImage = 0;

    const supabaseUrls: string[] = [];
    const replicateUrls: string[] = [];

    for (const session of allSessions) {
      if (!session.generatedImageUrl) {
        noImage++;
        continue;
      }

      if (session.storageId) {
        // Already migrated to Convex storage
        migrated++;
      } else if (session.imageUploadStatus === 'failed') {
        // Migration was attempted but failed
        failed++;
      } else {
        // Needs migration
        needsMigration++;

        // Track URL types
        const url = session.generatedImageUrl;
        if (url.includes('supabase.co/storage')) {
          supabaseUrls.push(url);
        } else if (url.includes('replicate.delivery')) {
          replicateUrls.push(url);
        }
      }
    }

    return {
      totalSessions: allSessions.length,
      sessionsWithImages: migrated + failed + needsMigration,
      sessionsWithoutImages: noImage,
      imageStats: {
        needsMigration,
        migrated,
        failed,
      },
      urlTypes: {
        supabase: supabaseUrls.length,
        replicate: replicateUrls.length,
        other: needsMigration - supabaseUrls.length - replicateUrls.length,
      },
      migrationComplete: needsMigration === 0 && failed === 0,
      timestamp: new Date().toISOString(),
    };
  },
});

/**
 * List all Supabase Storage images from the bucket.
 *
 * This action fetches the list of files from Supabase Storage
 * to provide visibility into what images exist in the bucket.
 *
 * @param supabaseUrl - Supabase project URL
 * @param supabaseKey - Supabase service role key
 * @param bucketName - Storage bucket name (default: 'story-images')
 */
export const listSupabaseStorageImages = action({
  args: {
    supabaseUrl: v.string(),
    supabaseKey: v.string(),
    bucketName: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const bucketName = args.bucketName ?? 'story-images';

    console.log(
      `[ImageMigration] Listing files in Supabase bucket: ${bucketName}`,
    );

    try {
      // List files in the bucket root
      const response = await fetch(
        `${args.supabaseUrl}/storage/v1/object/list/${bucketName}`,
        {
          method: 'POST',
          headers: {
            apikey: args.supabaseKey,
            Authorization: `Bearer ${args.supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prefix: '',
            limit: 1000,
            offset: 0,
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Supabase Storage API error: ${response.status} - ${errorText}`,
        );
      }

      interface StorageObject {
        name: string;
        id: string;
        created_at: string;
        updated_at: string;
        metadata: Record<string, unknown>;
      }

      const files = (await response.json()) as StorageObject[];

      console.log(
        `[ImageMigration] Found ${files.length} files/folders in bucket`,
      );

      // For user folders, we need to list recursively
      const allImages: Array<{
        path: string;
        name: string;
        createdAt: string;
        publicUrl: string;
      }> = [];

      for (const item of files) {
        // If it's a folder (user ID), list its contents
        if (!item.name.includes('.')) {
          const folderResponse = await fetch(
            `${args.supabaseUrl}/storage/v1/object/list/${bucketName}`,
            {
              method: 'POST',
              headers: {
                apikey: args.supabaseKey,
                Authorization: `Bearer ${args.supabaseKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                prefix: item.name + '/',
                limit: 1000,
                offset: 0,
              }),
            },
          );

          if (folderResponse.ok) {
            const folderFiles =
              (await folderResponse.json()) as StorageObject[];
            for (const file of folderFiles) {
              if (file.name.includes('.')) {
                allImages.push({
                  path: `${item.name}/${file.name}`,
                  name: file.name,
                  createdAt: file.created_at,
                  publicUrl: `${args.supabaseUrl}/storage/v1/object/public/${bucketName}/${item.name}/${file.name}`,
                });
              }
            }
          }
        } else {
          // Direct file in bucket root
          allImages.push({
            path: item.name,
            name: item.name,
            createdAt: item.created_at,
            publicUrl: `${args.supabaseUrl}/storage/v1/object/public/${bucketName}/${item.name}`,
          });
        }
      }

      console.log(`[ImageMigration] Total images found: ${allImages.length}`);

      return {
        success: true,
        bucketName,
        totalImages: allImages.length,
        images: allImages,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log(`[ImageMigration] Error listing images: ${errorMsg}`);
      return {
        success: false,
        error: errorMsg,
        bucketName,
        totalImages: 0,
        images: [],
      };
    }
  },
});

// ============================================================================
// Migration Status and Utilities
// ============================================================================

/**
 * Get current migration status by counting records in each table.
 */
export const getMigrationStatus = query({
  args: {},
  handler: async ctx => {
    const userProfiles = await ctx.db.query('userProfiles').collect();
    const gameSessions = await ctx.db.query('gameSessions').collect();
    const imageGenerationEvents = await ctx.db
      .query('imageGenerationEvents')
      .collect();
    const storyElements = await ctx.db.query('storyElements').collect();
    const storyDiversityScores = await ctx.db
      .query('storyDiversityScores')
      .collect();
    const storyDownloadHistory = await ctx.db
      .query('storyDownloadHistory')
      .collect();
    const featureFlags = await ctx.db.query('featureFlags').collect();

    return {
      convexRecordCounts: {
        userProfiles: userProfiles.length,
        gameSessions: gameSessions.length,
        imageGenerationEvents: imageGenerationEvents.length,
        storyElements: storyElements.length,
        storyDiversityScores: storyDiversityScores.length,
        storyDownloadHistory: storyDownloadHistory.length,
        featureFlags: featureFlags.length,
      },
      timestamp: new Date().toISOString(),
    };
  },
});

/**
 * Verify data integrity after migration by spot-checking records.
 */
export const verifyMigrationIntegrity = query({
  args: {
    sampleSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const sampleSize = args.sampleSize ?? 5;

    // Sample user profiles
    const userProfiles = await ctx.db.query('userProfiles').take(sampleSize);

    // Sample game sessions
    const gameSessions = await ctx.db.query('gameSessions').take(sampleSize);

    // Sample image generation events
    const imageEvents = await ctx.db
      .query('imageGenerationEvents')
      .take(sampleSize);

    // Check referential integrity
    const integrityIssues: string[] = [];

    for (const session of gameSessions) {
      const user = await ctx.db.get(session.userId);
      if (!user) {
        integrityIssues.push(
          `Session ${session._id} references missing user ${session.userId}`,
        );
      }
    }

    for (const event of imageEvents) {
      const user = await ctx.db.get(event.userId);
      if (!user) {
        integrityIssues.push(
          `Event ${event._id} references missing user ${event.userId}`,
        );
      }

      if (event.sessionId) {
        const session = await ctx.db.get(event.sessionId);
        if (!session) {
          integrityIssues.push(
            `Event ${event._id} references missing session ${event.sessionId}`,
          );
        }
      }
    }

    return {
      sampledRecords: {
        userProfiles: userProfiles.length,
        gameSessions: gameSessions.length,
        imageGenerationEvents: imageEvents.length,
      },
      integrityIssues,
      isHealthy: integrityIssues.length === 0,
      timestamp: new Date().toISOString(),
    };
  },
});

/**
 * Clear all migrated data (USE WITH CAUTION - for testing only).
 *
 * This mutation deletes ALL records from the specified table.
 * Only use this during development/testing.
 */
export const clearMigratedTable = mutation({
  args: {
    tableName: v.union(
      v.literal('userProfiles'),
      v.literal('gameSessions'),
      v.literal('imageGenerationEvents'),
      v.literal('storyElements'),
      v.literal('storyDiversityScores'),
      v.literal('storyDownloadHistory'),
      v.literal('featureFlags'),
    ),
    confirmDeletion: v.boolean(),
  },
  handler: async (ctx, args) => {
    if (!args.confirmDeletion) {
      throw new Error('Must confirm deletion by setting confirmDeletion: true');
    }

    let deletedCount = 0;

    switch (args.tableName) {
      case 'userProfiles': {
        const records = await ctx.db.query('userProfiles').collect();
        for (const record of records) {
          await ctx.db.delete(record._id);
          deletedCount++;
        }
        break;
      }
      case 'gameSessions': {
        const records = await ctx.db.query('gameSessions').collect();
        for (const record of records) {
          await ctx.db.delete(record._id);
          deletedCount++;
        }
        break;
      }
      case 'imageGenerationEvents': {
        const records = await ctx.db.query('imageGenerationEvents').collect();
        for (const record of records) {
          await ctx.db.delete(record._id);
          deletedCount++;
        }
        break;
      }
      case 'storyElements': {
        const records = await ctx.db.query('storyElements').collect();
        for (const record of records) {
          await ctx.db.delete(record._id);
          deletedCount++;
        }
        break;
      }
      case 'storyDiversityScores': {
        const records = await ctx.db.query('storyDiversityScores').collect();
        for (const record of records) {
          await ctx.db.delete(record._id);
          deletedCount++;
        }
        break;
      }
      case 'storyDownloadHistory': {
        const records = await ctx.db.query('storyDownloadHistory').collect();
        for (const record of records) {
          await ctx.db.delete(record._id);
          deletedCount++;
        }
        break;
      }
      case 'featureFlags': {
        const records = await ctx.db.query('featureFlags').collect();
        for (const record of records) {
          await ctx.db.delete(record._id);
          deletedCount++;
        }
        break;
      }
    }

    return {
      success: true,
      tableName: args.tableName,
      deletedCount,
      timestamp: new Date().toISOString(),
    };
  },
});
