/**
 * Convex Data Retention Functions for CreativeBridge (US-015)
 *
 * Implements automated data retention policies to comply with COPPA and
 * privacy policy commitments. Expired records are cleaned up daily via cron.
 *
 * ## Retention Periods (configurable via environment variables):
 * - Story sessions: 1 year after last access (DATA_RETENTION_STORY_SESSIONS_DAYS)
 * - Analytics / image generation events: 90 days (DATA_RETENTION_ANALYTICS_DAYS)
 * - Migration events: 30 days (DATA_RETENTION_MIGRATION_DAYS)
 * - Consent records: 3 years after account deletion (COPPA requirement, not auto-deleted here)
 * - Deleted account data: purged immediately (handled by deleteAllUserDataInternal)
 *
 * ## Batch Processing:
 * Each cleanup function processes up to BATCH_SIZE records per invocation
 * to stay within Convex mutation time limits.
 *
 * @implements US-015: Data Retention Policy and Automated Cleanup
 */

import { internalMutation } from './_generated/server';

/** Maximum records to process per mutation invocation */
const BATCH_SIZE = 100;

/** Milliseconds per day */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ============================================================================
// Default retention periods (in days)
// ============================================================================

const DEFAULT_STORY_SESSIONS_RETENTION_DAYS = 365; // 1 year
const DEFAULT_ANALYTICS_RETENTION_DAYS = 90;
const DEFAULT_MIGRATION_RETENTION_DAYS = 30;

/**
 * Parse a retention period from an environment variable, falling back to a default.
 */
function getRetentionDays(
  envVar: string | undefined,
  defaultDays: number,
): number {
  if (!envVar) return defaultDays;
  const parsed = parseInt(envVar, 10);
  return isNaN(parsed) || parsed <= 0 ? defaultDays : parsed;
}

// ============================================================================
// CLEANUP: Story Sessions (1 year after last access)
// ============================================================================

/**
 * Delete story sessions older than the retention period.
 * "Last access" is determined by `completedAt` if set, otherwise `_creationTime`.
 * Also cascades to storyElements, storyDiversityScores, and storyDownloadHistory.
 */
export const cleanupExpiredStorySessions = internalMutation({
  args: {},
  handler: async ctx => {
    const retentionDays = getRetentionDays(
      process.env.DATA_RETENTION_STORY_SESSIONS_DAYS,
      DEFAULT_STORY_SESSIONS_RETENTION_DAYS,
    );
    const cutoff = Date.now() - retentionDays * MS_PER_DAY;

    // Paginated query: fetch oldest sessions first and stop early (R-4.6)
    // Sessions ordered by _creationTime ascending — oldest first
    const candidates = await ctx.db
      .query('gameSessions')
      .order('asc')
      .take(BATCH_SIZE * 10); // Fetch a bounded set, not the full table
    const expired = candidates.filter(s => {
      const lastAccess = s.completedAt
        ? new Date(s.completedAt).getTime()
        : s._creationTime;
      return lastAccess < cutoff;
    });

    const batch = expired.slice(0, BATCH_SIZE);
    let deletedSessions = 0;
    let deletedRelated = 0;

    for (const session of batch) {
      // Delete stored image from Convex Storage
      if (session.storageId) {
        try {
          await ctx.storage.delete(session.storageId);
        } catch {
          // Storage file may already be deleted
        }
      }

      // Cascade: delete storyElements for this session
      const elements = await ctx.db
        .query('storyElements')
        .withIndex('by_story', q => q.eq('storyId', session._id))
        .collect();
      for (const el of elements) {
        await ctx.db.delete(el._id);
        deletedRelated++;
      }

      // Cascade: delete storyDiversityScores for this session
      const scores = await ctx.db
        .query('storyDiversityScores')
        .withIndex('by_story', q => q.eq('storyId', session._id))
        .collect();
      for (const score of scores) {
        await ctx.db.delete(score._id);
        deletedRelated++;
      }

      // Cascade: delete storyDownloadHistory for this session
      const downloads = await ctx.db
        .query('storyDownloadHistory')
        .withIndex('by_session', q => q.eq('storySessionId', session._id))
        .collect();
      for (const dl of downloads) {
        await ctx.db.delete(dl._id);
        deletedRelated++;
      }

      await ctx.db.delete(session._id);
      deletedSessions++;
    }

    return {
      deletedSessions,
      deletedRelated,
      totalExpired: expired.length,
      hasMore: expired.length > BATCH_SIZE,
    };
  },
});

// ============================================================================
// CLEANUP: Image Generation Events (90 days)
// ============================================================================

/**
 * Delete image generation events older than the retention period.
 * Uses `_creationTime` as the reference timestamp.
 */
export const cleanupExpiredImageGenerationEvents = internalMutation({
  args: {},
  handler: async ctx => {
    const retentionDays = getRetentionDays(
      process.env.DATA_RETENTION_ANALYTICS_DAYS,
      DEFAULT_ANALYTICS_RETENTION_DAYS,
    );
    const cutoff = Date.now() - retentionDays * MS_PER_DAY;

    // Paginated query: oldest first, bounded fetch (R-4.6)
    const candidates = await ctx.db
      .query('imageGenerationEvents')
      .order('asc')
      .take(BATCH_SIZE * 10);
    const expired = candidates.filter(e => e._creationTime < cutoff);

    const batch = expired.slice(0, BATCH_SIZE);
    for (const event of batch) {
      await ctx.db.delete(event._id);
    }

    return {
      deleted: batch.length,
      totalExpired: expired.length,
      hasMore: expired.length > BATCH_SIZE,
    };
  },
});

// ============================================================================
// CLEANUP: Migration Events (30 days) + email scrubbing
// ============================================================================

/**
 * Delete migration events older than the retention period.
 * Also scrubs email addresses from migration events older than
 * half the retention period (as an intermediate step before full deletion).
 */
export const cleanupExpiredMigrationEvents = internalMutation({
  args: {},
  handler: async ctx => {
    const retentionDays = getRetentionDays(
      process.env.DATA_RETENTION_MIGRATION_DAYS,
      DEFAULT_MIGRATION_RETENTION_DAYS,
    );
    const deletionCutoff = Date.now() - retentionDays * MS_PER_DAY;

    // Paginated query: oldest first, bounded fetch (R-4.6)
    const candidates = await ctx.db
      .query('migrationEvents')
      .order('asc')
      .take(BATCH_SIZE * 10);

    // Delete events past retention period
    const expiredForDeletion = candidates.filter(
      e => e._creationTime < deletionCutoff,
    );
    const deleteBatch = expiredForDeletion.slice(0, BATCH_SIZE);
    for (const event of deleteBatch) {
      await ctx.db.delete(event._id);
    }

    // Scrub emails from remaining events that still have them
    const remainingWithEmail = candidates.filter(
      e => e._creationTime >= deletionCutoff && e.email,
    );
    let scrubbed = 0;
    for (const event of remainingWithEmail.slice(0, BATCH_SIZE)) {
      await ctx.db.patch(event._id, { email: undefined });
      scrubbed++;
    }

    return {
      deleted: deleteBatch.length,
      emailsScrubbed: scrubbed,
      totalExpired: expiredForDeletion.length,
      hasMore: expiredForDeletion.length > BATCH_SIZE,
    };
  },
});

// ============================================================================
// ORCHESTRATOR: Run all retention cleanups
// ============================================================================

/**
 * Master cleanup function that runs all retention policies.
 * Called by the daily cron job. Returns a summary of all cleanup actions.
 */
export const runDailyRetentionCleanup = internalMutation({
  args: {},
  handler: async ctx => {
    // We can't call other mutations from a mutation in Convex,
    // so we inline the logic here for the orchestrated run.
    // The individual mutations above are kept for manual/targeted runs.

    const now = Date.now();
    const summary: Record<string, number> = {};

    // --- Story Sessions (1 year) ---
    const storyRetentionDays = getRetentionDays(
      process.env.DATA_RETENTION_STORY_SESSIONS_DAYS,
      DEFAULT_STORY_SESSIONS_RETENTION_DAYS,
    );
    const storyCutoff = now - storyRetentionDays * MS_PER_DAY;

    const sessionCandidates = await ctx.db
      .query('gameSessions')
      .order('asc')
      .take(BATCH_SIZE * 10);
    const expiredSessions = sessionCandidates.filter(s => {
      const lastAccess = s.completedAt
        ? new Date(s.completedAt).getTime()
        : s._creationTime;
      return lastAccess < storyCutoff;
    });

    let sessionBatchCount = 0;
    for (const session of expiredSessions.slice(0, BATCH_SIZE)) {
      if (session.storageId) {
        try {
          await ctx.storage.delete(session.storageId);
        } catch {
          // Already deleted
        }
      }

      // Cascade: storyElements
      const elements = await ctx.db
        .query('storyElements')
        .withIndex('by_story', q => q.eq('storyId', session._id))
        .collect();
      for (const el of elements) {
        await ctx.db.delete(el._id);
      }

      // Cascade: storyDiversityScores
      const scores = await ctx.db
        .query('storyDiversityScores')
        .withIndex('by_story', q => q.eq('storyId', session._id))
        .collect();
      for (const score of scores) {
        await ctx.db.delete(score._id);
      }

      // Cascade: storyDownloadHistory
      const downloads = await ctx.db
        .query('storyDownloadHistory')
        .withIndex('by_session', q => q.eq('storySessionId', session._id))
        .collect();
      for (const dl of downloads) {
        await ctx.db.delete(dl._id);
      }

      await ctx.db.delete(session._id);
      sessionBatchCount++;
    }
    summary.expiredStorySessions = sessionBatchCount;

    // --- Image Generation Events (90 days) ---
    const analyticsRetentionDays = getRetentionDays(
      process.env.DATA_RETENTION_ANALYTICS_DAYS,
      DEFAULT_ANALYTICS_RETENTION_DAYS,
    );
    const analyticsCutoff = now - analyticsRetentionDays * MS_PER_DAY;

    const allImageEvents = await ctx.db
      .query('imageGenerationEvents')
      .order('asc')
      .take(BATCH_SIZE * 10);
    const expiredImageEvents = allImageEvents.filter(
      e => e._creationTime < analyticsCutoff,
    );
    let imageEventCount = 0;
    for (const event of expiredImageEvents.slice(0, BATCH_SIZE)) {
      await ctx.db.delete(event._id);
      imageEventCount++;
    }
    summary.expiredImageGenerationEvents = imageEventCount;

    // --- Migration Events (30 days) + email scrubbing ---
    const migrationRetentionDays = getRetentionDays(
      process.env.DATA_RETENTION_MIGRATION_DAYS,
      DEFAULT_MIGRATION_RETENTION_DAYS,
    );
    const migrationCutoff = now - migrationRetentionDays * MS_PER_DAY;

    const allMigrationEvents = await ctx.db
      .query('migrationEvents')
      .order('asc')
      .take(BATCH_SIZE * 10);

    // Delete expired
    const expiredMigration = allMigrationEvents.filter(
      e => e._creationTime < migrationCutoff,
    );
    let migrationDeleteCount = 0;
    for (const event of expiredMigration.slice(0, BATCH_SIZE)) {
      await ctx.db.delete(event._id);
      migrationDeleteCount++;
    }
    summary.expiredMigrationEvents = migrationDeleteCount;

    // Scrub emails from remaining
    const withEmail = allMigrationEvents.filter(
      e => e._creationTime >= migrationCutoff && e.email,
    );
    let emailScrubCount = 0;
    for (const event of withEmail.slice(0, BATCH_SIZE)) {
      await ctx.db.patch(event._id, { email: undefined });
      emailScrubCount++;
    }
    summary.migrationEmailsScrubbed = emailScrubCount;

    return summary;
  },
});
