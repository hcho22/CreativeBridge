/**
 * Convex Schema Definition for CreativeBridge
 *
 * This file defines the database schema for the Convex backend.
 * Migrated from Supabase PostgreSQL with RLS.
 *
 * @see https://docs.convex.dev/database/schemas
 * @see prd-supabase-to-convex-migration.md
 */
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

/**
 * Grade levels supported by the application.
 * Used for content adaptation and art style selection.
 */
export const gradeLevelValidator = v.union(
  v.literal('K-2'),
  v.literal('3-5'),
  v.literal('6-8'),
  v.literal('9-12'),
);

/**
 * Story genre preferences for AI-generated content.
 * Used to customize story tone and style based on user preference.
 * Horror is auto-softened for younger grade levels at the prompt level.
 */
export const genreValidator = v.union(
  v.literal('Mystery'),
  v.literal('Fantasy'),
  v.literal('Comedy'),
  v.literal('Horror'),
  v.literal('Fiction'),
  v.literal('Fairy Tale'),
);

/**
 * Onboarding progress tracking object.
 * Tracks completion of key user milestones.
 */
export const onboardingProgressValidator = v.object({
  create_account: v.boolean(),
  first_story: v.boolean(),
  first_image: v.boolean(),
  first_voice: v.boolean(),
  first_streak: v.boolean(),
});

/**
 * Story source types.
 * Tracks where a story originated from.
 */
export const storySourceValidator = v.union(
  v.literal('New'),
  v.literal('CreativeBridge'),
  v.literal('Story_Quest'),
  v.literal('File'),
);

/**
 * Image upload status tracking.
 * Used for retry logic on failed uploads.
 */
export const imageUploadStatusValidator = v.union(
  v.literal('pending'),
  v.literal('uploaded'),
  v.literal('failed'),
);

/**
 * Image generation status tracking.
 * Tracks the lifecycle of an image generation attempt.
 */
export const generationStatusValidator = v.union(
  v.literal('pending'),
  v.literal('success'),
  v.literal('failed'),
  v.literal('refunded'),
  v.literal('timeout'),
);

/**
 * Error types for failed image generations.
 * Used for debugging and analytics.
 */
export const errorTypeValidator = v.union(
  v.literal('api_failure'),
  v.literal('content_safety'),
  v.literal('insufficient_xp'),
  v.literal('timeout'),
  v.literal('rate_limit'),
);

/**
 * AI services used for image generation.
 * Tracks which service processed the request.
 */
export const serviceUsedValidator = v.union(
  v.literal('stability-ai/stable-diffusion-3.5-large'),
  v.literal('google/nano-banana'),
  v.literal('replicate'),
  v.literal('backup_service'),
);

/**
 * Story element types for diversity tracking.
 * Used for semantic similarity matching and repetition avoidance.
 */
export const elementTypeValidator = v.union(
  v.literal('character'),
  v.literal('setting'),
  v.literal('object'),
  v.literal('plot_pattern'),
);

/**
 * Feature flag rollout status.
 * Tracks the state of gradual feature rollouts.
 */
export const rolloutStatusValidator = v.union(
  v.literal('active'),
  v.literal('paused'),
  v.literal('completed'),
  v.literal('rolled_back'),
);

/**
 * Download method types.
 * Tracks how users download their stories.
 */
export const downloadMethodValidator = v.union(
  v.literal('share'),
  v.literal('save_to_files'),
  v.literal('export'),
  v.literal('clipboard'),
);

/**
 * Age group classification for COPPA compliance.
 * Determines whether verifiable parental consent is required.
 */
export const ageGroupValidator = v.union(
  v.literal('under_13'),
  v.literal('13_to_17'),
  v.literal('18_plus'),
);

/**
 * Consent status for COPPA compliance.
 * Tracks the parental consent lifecycle for under-13 users.
 */
export const consentStatusValidator = v.union(
  v.literal('not_required'),
  v.literal('pending'),
  v.literal('granted'),
  v.literal('withdrawn'),
  v.literal('renewal_required'),
);

/**
 * Consent type categories.
 * Tracks what kind of consent was granted.
 */
export const consentTypeValidator = v.union(
  v.literal('terms'),
  v.literal('privacy'),
  v.literal('data_collection'),
  v.literal('vpc'),
);

/**
 * Migration event types.
 * Tracks the lifecycle of a Supabase → Clerk user migration.
 */
export const migrationEventTypeValidator = v.union(
  v.literal('migration_started'),
  v.literal('migration_completed'),
  v.literal('migration_failed'),
);

/**
 * Migration step identifiers.
 * Tracks which phase/step of the migration pipeline triggered the event.
 */
export const migrationStepValidator = v.union(
  v.literal('supabase_auth'),
  v.literal('profile_fetch'),
  v.literal('clerk_account'),
  v.literal('email_verification'),
  v.literal('profile'),
  v.literal('stats'),
  v.literal('sessions'),
  v.literal('supabase_signout'),
  v.literal('full_migration'),
);

export default defineSchema({
  /**
   * User Profiles Table (US-003)
   *
   * Stores user account data, game statistics, preferences, and onboarding progress.
   * Replaces Supabase user_profiles table.
   *
   * @index by_clerk_user_id - Primary lookup by Clerk authentication ID
   * @index by_total_xp - Leaderboard queries sorted by XP
   */
  userProfiles: defineTable({
    // Authentication - Clerk OAuth user ID (format: user_xxxxx)
    clerkUserId: v.string(),

    // Profile Information
    username: v.string(),
    displayName: v.string(),

    // Game Statistics
    totalXp: v.number(),
    currentStreak: v.number(),
    longestStreak: v.number(),
    lastActivityDate: v.string(), // ISO 8601 date string

    // High Scores & Progress
    bestScore: v.number(),
    totalGamesPlayed: v.number(),
    totalStoriesCompleted: v.number(),
    totalWordsWritten: v.number(),

    // User Preferences
    preferredGradeLevel: gradeLevelValidator,
    speechEnabled: v.boolean(),
    preferredGenre: v.optional(genreValidator),

    // COPPA Compliance (US-001, US-002)
    ageGroup: v.optional(ageGroupValidator),
    consentStatus: v.optional(consentStatusValidator),

    // Optional Profile Data
    avatarUrl: v.optional(v.string()),
    bio: v.optional(v.string()),

    // Onboarding Progress (US-007 implementation)
    onboardingCompleted: v.boolean(),
    onboardingProgress: onboardingProgressValidator,

    // Onboarding Milestone Timestamps (ISO 8601)
    firstStoryCompletedAt: v.optional(v.string()),
    firstImageGeneratedAt: v.optional(v.string()),
    firstVoiceInputAt: v.optional(v.string()),
    firstStreakAchievedAt: v.optional(v.string()),
  })
    .index('by_clerk_user_id', ['clerkUserId'])
    .index('by_username', ['username'])
    .index('by_total_xp', ['totalXp']),

  /**
   * Game Sessions Table (US-004)
   *
   * Stores story writing sessions with game progress, content, and image generation data.
   * Replaces Supabase game_sessions table.
   *
   * @index by_user - Lookup sessions by userProfiles ID (for joins)
   * @index by_clerk_user - Lookup sessions by Clerk ID (for authenticated queries)
   */
  gameSessions: defineTable({
    // User References (dual lookup pattern)
    userId: v.id('userProfiles'), // Convex ID reference for joins
    clerkUserId: v.string(), // Clerk ID for quick authenticated lookups

    // Session Timestamps
    completedAt: v.optional(v.string()), // ISO 8601, null if in progress

    // Game Configuration
    gradeLevel: gradeLevelValidator,

    // Game Progress & Scoring
    finalScore: v.number(),
    wordsWritten: v.number(),
    sentencesCompleted: v.number(),
    challengesCompleted: v.number(),
    xpEarned: v.number(),

    // Story Content
    storyContent: v.optional(v.string()),

    // Story Continuation Fields
    importedStoryContent: v.optional(v.string()),
    storySource: storySourceValidator,
    originalCreationDate: v.optional(v.string()), // ISO 8601
    storyMetadata: v.any(), // Flexible JSONB-equivalent for metadata

    // Image Generation Fields (Replicate/external)
    generatedImageUrl: v.optional(v.string()),
    imageGenerationTimestamp: v.optional(v.string()), // ISO 8601
    imageGenerationCost: v.optional(v.number()),

    // Story Completion Tracking
    currentRound: v.number(), // 1-5, story completes at round 5

    // Convex Storage Fields (replaces Supabase Storage)
    storageId: v.optional(v.id('_storage')), // Reference to uploaded image in Convex Storage
    imageUploadStatus: v.optional(imageUploadStatusValidator),
    imageUploadAttempts: v.optional(v.number()), // Max 3 retries
    imageUploadError: v.optional(v.string()), // Last error for debugging
  })
    .index('by_user', ['userId'])
    .index('by_clerk_user', ['clerkUserId']),

  /**
   * Image Generation Events Table (US-005)
   *
   * Tracks image generation attempts, including XP costs, status, errors, and timing.
   * Used for analytics, debugging, and XP refund logic.
   * Replaces Supabase image_generation_events table.
   *
   * @index by_user - Lookup events by userProfiles ID (for user history)
   * @index by_session - Lookup events by game session (for session context)
   */
  imageGenerationEvents: defineTable({
    // User References (dual lookup pattern)
    userId: v.id('userProfiles'), // Convex ID reference for joins
    clerkUserId: v.string(), // Clerk ID for quick authenticated lookups

    // Session Reference (optional - some generations may be standalone)
    sessionId: v.optional(v.id('gameSessions')),

    // XP Economics
    xpCost: v.number(), // XP deducted for this generation attempt

    // Generation Status & Outcome
    generationStatus: generationStatusValidator,
    errorType: v.optional(errorTypeValidator),

    // Service Information
    serviceUsed: serviceUsedValidator,
    apiResponseTime: v.optional(v.number()), // Response time in milliseconds

    // Result Data
    imageUrl: v.optional(v.string()), // Generated image URL (if successful)

    // Story Context (for analytics and prompt debugging)
    storyGradeLevel: v.optional(v.string()), // Grade level of the story
    storyWordCount: v.optional(v.number()), // Word count at generation time
    promptUsed: v.optional(v.string()), // Full prompt sent to AI service

    // Flexible Metadata (JSONB equivalent)
    metadata: v.any(), // Additional tracking data, error details, etc.

    // Completion Timestamp
    completedAt: v.optional(v.string()), // ISO 8601, null if still pending
  })
    .index('by_user', ['userId'])
    .index('by_session', ['sessionId']),

  /**
   * Story Elements Table (US-006)
   *
   * Stores extracted story elements (characters, settings, objects, plot patterns)
   * with embedding vectors for semantic similarity matching.
   * Used for diversity tracking to avoid repetitive story elements.
   * Replaces Supabase story_elements table.
   *
   * @index by_session - Lookup elements by user session
   * @index by_story - Lookup elements by game session (story)
   * @index by_type - Filter by element type for analytics
   */
  storyElements: defineTable({
    // Story Reference (the game session this element came from)
    storyId: v.id('gameSessions'),

    // User Session Reference (for diversity scoping)
    // This is a simple session ID string (from cookie/auth token)
    sessionId: v.string(),

    // Element Classification
    elementType: elementTypeValidator, // 'character' | 'setting' | 'object' | 'plot_pattern'
    elementText: v.string(), // Normalized element text (lowercase, singular form)

    // Semantic Embedding (JSONB equivalent - array of floats)
    // Used for cosine similarity matching (1536 dimensions for OpenAI embeddings)
    embeddingVector: v.optional(v.any()), // Array of numbers representing text embedding
  })
    .index('by_session', ['sessionId'])
    .index('by_story', ['storyId'])
    .index('by_type', ['elementType']),

  /**
   * Story Diversity Scores Table (US-006)
   *
   * Stores calculated diversity scores for each story.
   * One score per story - used for analytics and monitoring repetition.
   * Replaces Supabase story_diversity_scores table.
   *
   * @index by_story - Unique lookup by game session (one score per story)
   * @index by_score - Analytics queries for low diversity alerts
   */
  storyDiversityScores: defineTable({
    // Story Reference (one-to-one with gameSessions)
    storyId: v.id('gameSessions'),

    // Diversity Metrics
    diversityScore: v.number(), // 0.0 (repetitive) to 1.0 (novel)
    novelElementCount: v.number(), // Number of novel elements (no similar match in history)

    // Analytics Metadata (JSONB equivalent)
    // Stores: total_elements, repeated_elements, per-type breakdowns
    metadata: v.optional(v.any()),
  })
    .index('by_story', ['storyId'])
    .index('by_score', ['diversityScore']),

  /**
   * Feature Flags Table (US-006)
   *
   * Remote configuration for feature flags with rollout control.
   * Used for gradual feature launches and A/B testing.
   * Replaces Supabase feature_flags table.
   *
   * @index by_name - Unique lookup by feature name
   * @index by_enabled - Filter for active features
   */
  featureFlags: defineTable({
    // Feature Identification
    featureName: v.string(), // Unique feature identifier (e.g., 'image_generation')

    // Configuration
    enabled: v.boolean(), // Master on/off switch
    config: v.any(), // JSONB config: rolloutPercentage, requiresWhitelist, etc.

    // Metadata
    description: v.optional(v.string()),
    updatedBy: v.optional(v.string()), // Who last modified this flag
  })
    .index('by_name', ['featureName'])
    .index('by_enabled', ['enabled']),

  /**
   * Story Download History Table (US-006)
   *
   * Tracks when users download their stories for analytics.
   * Used for understanding user engagement and export patterns.
   * Replaces Supabase story_download_history table.
   *
   * @index by_user - Lookup downloads by user
   * @index by_session - Lookup downloads by story session
   */
  storyDownloadHistory: defineTable({
    // User Reference (dual lookup pattern)
    userId: v.id('userProfiles'),
    clerkUserId: v.string(),

    // Story Reference (optional - may download without active session)
    storySessionId: v.optional(v.id('gameSessions')),

    // File Information
    fileName: v.string(),
    filePath: v.string(),

    // Story Metadata (captured at download time)
    storyTitle: v.optional(v.string()),
    storyWordCount: v.optional(v.number()),
    storyCharacterCount: v.optional(v.number()),
    storyGradeLevel: v.optional(v.string()),
    storySource: v.optional(storySourceValidator),

    // Download Details
    downloadMethod: downloadMethodValidator,
    appVersion: v.optional(v.string()),

    // Completion Tracking
    completedAt: v.optional(v.string()), // ISO 8601, null if in progress
    retryCount: v.number(), // Number of retry attempts
    fileExists: v.boolean(), // Validation that file was created

    // Flexible Metadata (JSONB equivalent)
    metadata: v.optional(v.any()),
  })
    .index('by_user', ['userId'])
    .index('by_clerk_user', ['clerkUserId'])
    .index('by_session', ['storySessionId']),

  /**
   * Migration Events Table (US-018)
   *
   * Tracks Supabase → Clerk migration lifecycle events for funnel analytics.
   * Events are logged at each step so admins can identify where users
   * drop off and diagnose migration failures.
   *
   * @index by_event_type - Filter events by type for dashboard stats
   * @index by_clerk_user - Lookup migration history for a specific user
   */
  migrationEvents: defineTable({
    // Event Classification
    eventType: migrationEventTypeValidator,
    step: migrationStepValidator,

    // User References (both optional — user may not yet have a Clerk account)
    clerkUserId: v.optional(v.string()),
    supabaseUserId: v.optional(v.string()),
    email: v.optional(v.string()),

    // Error Information (populated only for migration_failed events)
    error: v.optional(v.string()),

    // Timing
    timestamp: v.string(), // ISO 8601

    // Flexible Metadata (session count, batch info, etc.)
    metadata: v.optional(v.any()),
  })
    .index('by_event_type', ['eventType'])
    .index('by_clerk_user', ['clerkUserId']),

  /**
   * Consent Records Table (US-002, US-016)
   *
   * Stores verifiable parental consent (VPC) records for COPPA compliance.
   * Records are retained for 3 years after account deletion per COPPA requirements.
   *
   * @index by_child - Lookup consent records by child user ID
   * @index by_parent - Lookup consent records by parent email
   * @index by_token - Lookup by consent verification token
   */
  consentRecords: defineTable({
    // Child-parent relationship
    childUserId: v.string(), // Clerk user ID of the child
    parentEmail: v.string(),

    // Consent details
    consentType: consentTypeValidator,
    consentVersion: v.string(), // Privacy policy version (e.g., "1.0.0")
    consentTimestamp: v.optional(v.number()), // When consent was granted (epoch ms)
    verificationMethod: v.string(), // e.g., "email_plus"

    // Token for email verification flow (VPC only — not used for terms/privacy consent)
    consentToken: v.optional(v.string()), // Unique token sent in consent email
    consentTokenExpiresAt: v.optional(v.number()), // Token expiry timestamp (epoch ms)

    // Lifecycle
    status: v.union(
      v.literal('pending'),
      v.literal('granted'),
      v.literal('expired'),
      v.literal('withdrawn'),
      v.literal('renewal_required'),
    ),
    withdrawnAt: v.optional(v.number()),

    // Annual consent renewal tracking (US-022)
    renewalReminderSentAt: v.optional(v.number()), // When the 11-month reminder was sent (epoch ms)

    // Deletion tracking — consent records retained 3 years post-deletion (COPPA)
    accountDeletedAt: v.optional(v.number()), // When the child's account was deleted (epoch ms)
  })
    .index('by_child', ['childUserId'])
    .index('by_parent', ['parentEmail'])
    .index('by_token', ['consentToken']),
});
