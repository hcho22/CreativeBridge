/**
 * Admin Analytics for CreativeBridge Migration Dashboard
 *
 * Provides queries and actions to track migration progress from
 * Supabase email/password authentication to Clerk/Convex.
 *
 * ## Usage:
 *
 * ### Convex-only stats (no Supabase credentials needed):
 * ```bash
 * npx convex run adminAnalytics:getConvexMigrationOverview
 * ```
 *
 * ### Full migration stats (requires Supabase service role key):
 * ```bash
 * npx convex run adminAnalytics:getMigrationStats \
 *   '{"supabaseUrl": "https://xxx.supabase.co", "supabaseKey": "service-role-key"}'
 * ```
 *
 * ### List users pending migration:
 * ```bash
 * npx convex run adminAnalytics:getPendingMigrationUsers \
 *   '{"supabaseUrl": "https://xxx.supabase.co", "supabaseKey": "service-role-key"}'
 * ```
 *
 * @implements US-017: Create Migration Progress Dashboard
 */

import { query, action, internalQuery } from './_generated/server';
import { v } from 'convex/values';

// ============================================================================
// Types
// ============================================================================

/**
 * Supabase user profile subset for migration tracking.
 */
interface SupabaseMigrationUser {
  id: string;
  clerk_user_id: string | null;
  username: string;
  display_name: string;
  total_xp: number;
  current_streak: number;
  total_games_played: number;
  total_stories_completed: number;
  last_activity_date: string;
  created_at: string;
  updated_at: string;
}

/**
 * Convex user profile data returned by _getConvexUserProfiles internal query.
 */
interface ConvexMigrationProfile {
  clerkUserId: string;
  username: string;
  displayName: string;
  totalXp: number;
  lastActivityDate: string;
  creationTime: number;
}

/**
 * Standard headers for Supabase REST API requests.
 */
function supabaseHeaders(apiKey: string): Record<string, string> {
  return {
    apikey: apiKey,
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

// ============================================================================
// Internal Queries (used by actions for cross-referencing)
// ============================================================================

/**
 * Get all Convex user profiles for migration cross-referencing.
 * Internal-only — not callable from the client.
 */
export const _getConvexUserProfiles = internalQuery({
  args: {},
  handler: async ctx => {
    const profiles = await ctx.db.query('userProfiles').collect();
    return profiles.map(p => ({
      clerkUserId: p.clerkUserId,
      username: p.username,
      displayName: p.displayName,
      totalXp: p.totalXp,
      lastActivityDate: p.lastActivityDate,
      creationTime: p._creationTime,
    }));
  },
});

// ============================================================================
// Public Queries (Convex-only, no Supabase access needed)
// ============================================================================

/**
 * Get Convex-side migration overview stats.
 *
 * Returns user counts, activity breakdown, and session stats from Convex only.
 * No Supabase credentials needed — useful for quick dashboard checks.
 */
export const getConvexMigrationOverview = query({
  args: {},
  handler: async ctx => {
    const profiles = await ctx.db.query('userProfiles').collect();
    const sessions = await ctx.db.query('gameSessions').collect();

    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let activeLastWeek = 0;
    let activeLastMonth = 0;
    let totalXp = 0;
    let onboardingCompleted = 0;

    for (const p of profiles) {
      totalXp += p.totalXp || 0;
      if (p.onboardingCompleted) onboardingCompleted++;

      if (p.lastActivityDate) {
        const lastActive = new Date(p.lastActivityDate);
        if (lastActive >= sevenDaysAgo) activeLastWeek++;
        if (lastActive >= thirtyDaysAgo) activeLastMonth++;
      }
    }

    const completedSessions = sessions.filter(s => s.completedAt).length;

    return {
      users: {
        total: profiles.length,
        activeLastWeek,
        activeLastMonth,
        inactive: profiles.length - activeLastMonth,
        onboardingCompleted,
      },
      sessions: {
        total: sessions.length,
        completed: completedSessions,
        inProgress: sessions.length - completedSessions,
      },
      totalXpDistributed: totalXp,
    };
  },
});

// ============================================================================
// Actions (cross-reference Supabase + Convex for migration tracking)
// ============================================================================

/**
 * Get comprehensive migration statistics.
 *
 * Cross-references Supabase user_profiles with Convex userProfiles to determine:
 * - How many Supabase email/password users exist
 * - How many have successfully migrated to Clerk/Convex
 * - How many are still pending migration
 * - Whether the 95% threshold for cutover has been reached
 *
 * @param supabaseUrl - Supabase project URL (e.g., "https://xxx.supabase.co")
 * @param supabaseKey - Supabase service role key (bypasses RLS)
 */
export const getMigrationStats = action({
  args: {
    supabaseUrl: v.string(),
    supabaseKey: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Fetch all Supabase user profiles
    const supabaseResponse = await fetch(
      `${args.supabaseUrl}/rest/v1/user_profiles?select=id,clerk_user_id,username,display_name,total_xp,total_games_played,last_activity_date,created_at&order=created_at.asc`,
      { headers: supabaseHeaders(args.supabaseKey) },
    );

    if (!supabaseResponse.ok) {
      throw new Error(
        `Supabase fetch failed: ${supabaseResponse.status} ${supabaseResponse.statusText}`,
      );
    }

    const supabaseUsers =
      (await supabaseResponse.json()) as SupabaseMigrationUser[];

    // 2. Categorize Supabase users
    const oauthUsers = supabaseUsers.filter(
      u => u.clerk_user_id !== null && u.clerk_user_id.startsWith('user_'),
    );
    const emailPasswordUsers = supabaseUsers.filter(
      u => u.clerk_user_id === null,
    );

    // 3. Fetch Convex user profiles for cross-referencing
    const convexProfiles = (await ctx.runQuery(
      'adminAnalytics:_getConvexUserProfiles' as any,
      {},
    )) as ConvexMigrationProfile[];

    // 4. Build username lookup set from Convex (lowercase for case-insensitive match)
    const convexUsernames = new Set(
      convexProfiles.map((p: ConvexMigrationProfile) =>
        p.username.toLowerCase(),
      ),
    );

    // 5. Determine which email/password users have migrated
    //    After migration, a new Convex profile is created with the same username.
    //    The Supabase profile's clerk_user_id stays NULL (not updated).
    const migratedEmailUsers = emailPasswordUsers.filter(u =>
      convexUsernames.has(u.username?.toLowerCase()),
    );
    const pendingEmailUsers = emailPasswordUsers.filter(
      u => !convexUsernames.has(u.username?.toLowerCase()),
    );

    // 6. Calculate migration percentage
    const migrationPercentage =
      emailPasswordUsers.length > 0
        ? (migratedEmailUsers.length / emailPasswordUsers.length) * 100
        : 100;

    const readyForCutover = migrationPercentage >= 95;

    // 7. Aggregate pending user stats for prioritization
    const pendingTotalXp = pendingEmailUsers.reduce(
      (sum, u) => sum + (u.total_xp || 0),
      0,
    );
    const pendingTotalGames = pendingEmailUsers.reduce(
      (sum, u) => sum + (u.total_games_played || 0),
      0,
    );

    return {
      supabase: {
        totalUsers: supabaseUsers.length,
        oauthUsers: oauthUsers.length,
        emailPasswordUsers: emailPasswordUsers.length,
      },
      convex: {
        totalUsers: convexProfiles.length,
      },
      migration: {
        migrated: migratedEmailUsers.length,
        pending: pendingEmailUsers.length,
        percentage: Math.round(migrationPercentage * 10) / 10,
        readyForCutover,
      },
      pendingUserStats: {
        totalXpAtRisk: pendingTotalXp,
        totalGamesAtRisk: pendingTotalGames,
        averageXpPerUser:
          pendingEmailUsers.length > 0
            ? Math.round(pendingTotalXp / pendingEmailUsers.length)
            : 0,
      },
    };
  },
});

/**
 * Get list of users who have not yet migrated from Supabase to Clerk.
 *
 * Returns email/password users from Supabase whose usernames do not exist
 * in Convex, indicating they haven't completed the migration flow.
 *
 * Results are sorted by total_xp descending (highest-value users first)
 * to help prioritize migration outreach.
 *
 * @param supabaseUrl - Supabase project URL
 * @param supabaseKey - Supabase service role key (bypasses RLS)
 * @param limit - Max number of users to return (default: 50)
 * @param offset - Pagination offset (default: 0)
 */
export const getPendingMigrationUsers = action({
  args: {
    supabaseUrl: v.string(),
    supabaseKey: v.string(),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const offset = args.offset ?? 0;

    // 1. Fetch email/password-only users from Supabase (clerk_user_id IS NULL)
    const supabaseResponse = await fetch(
      `${args.supabaseUrl}/rest/v1/user_profiles?select=id,username,display_name,total_xp,current_streak,total_games_played,total_stories_completed,last_activity_date,created_at,updated_at&clerk_user_id=is.null&order=total_xp.desc`,
      { headers: supabaseHeaders(args.supabaseKey) },
    );

    if (!supabaseResponse.ok) {
      throw new Error(
        `Supabase fetch failed: ${supabaseResponse.status} ${supabaseResponse.statusText}`,
      );
    }

    const emailPasswordUsers =
      (await supabaseResponse.json()) as SupabaseMigrationUser[];

    // 2. Fetch Convex usernames for cross-referencing
    const convexProfiles = (await ctx.runQuery(
      'adminAnalytics:_getConvexUserProfiles' as any,
      {},
    )) as ConvexMigrationProfile[];
    const convexUsernames = new Set(
      convexProfiles.map((p: ConvexMigrationProfile) =>
        p.username.toLowerCase(),
      ),
    );

    // 3. Filter to only truly pending users (not in Convex)
    const pendingUsers = emailPasswordUsers.filter(
      u => !convexUsernames.has(u.username?.toLowerCase()),
    );

    // 4. Apply pagination
    const paginatedUsers = pendingUsers.slice(offset, offset + limit);

    return {
      users: paginatedUsers.map(u => ({
        supabaseId: u.id,
        username: u.username,
        displayName: u.display_name,
        totalXp: u.total_xp || 0,
        currentStreak: u.current_streak || 0,
        totalGamesPlayed: u.total_games_played || 0,
        totalStoriesCompleted: u.total_stories_completed || 0,
        lastActivityDate: u.last_activity_date,
        createdAt: u.created_at,
        updatedAt: u.updated_at,
      })),
      pagination: {
        total: pendingUsers.length,
        offset,
        limit,
        hasMore: offset + limit < pendingUsers.length,
      },
    };
  },
});
