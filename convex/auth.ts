/**
 * Convex Auth Helper Functions for CreativeBridge
 *
 * Provides authentication utilities for Convex functions.
 * These helpers extract user identity from Clerk tokens and enforce auth requirements.
 *
 * ## How Authentication Works:
 * 1. User authenticates via Clerk (Google/Apple OAuth)
 * 2. Clerk issues a JWT with claims including `sub` (Clerk user ID)
 * 3. Convex validates the JWT using Clerk's JWKS endpoint
 * 4. These helpers provide convenient access to the authenticated user
 *
 * ## Usage in Convex Functions:
 *
 * ```typescript
 * // For mutations that require authentication
 * import { mutation } from "./_generated/server";
 * import { requireAuth } from "./auth";
 *
 * export const myMutation = mutation({
 *   args: { ... },
 *   handler: async (ctx, args) => {
 *     const identity = await requireAuth(ctx);
 *     const clerkUserId = identity.subject;
 *     // ... your logic
 *   },
 * });
 *
 * // For queries that may have optional auth
 * import { query } from "./_generated/server";
 * import { getCurrentUser } from "./auth";
 *
 * export const myQuery = query({
 *   args: { ... },
 *   handler: async (ctx, args) => {
 *     const identity = await getCurrentUser(ctx);
 *     if (!identity) {
 *       return null; // or public data
 *     }
 *     // ... authenticated logic
 *   },
 * });
 * ```
 *
 * @see https://docs.convex.dev/auth/functions-auth
 * @implements US-008: Create Auth Helper Functions
 */

import { QueryCtx, MutationCtx, ActionCtx } from './_generated/server';
import { action } from './_generated/server';
import { v } from 'convex/values';
import { UserIdentity } from 'convex/server';

/**
 * Union type for all Convex context types that support authentication.
 * Queries, mutations, and actions all have access to ctx.auth.
 */
type AuthContext = QueryCtx | MutationCtx | ActionCtx;

/**
 * Get the current authenticated user's identity.
 * Returns null if no user is authenticated.
 *
 * Use this for queries/mutations where authentication is optional,
 * such as viewing public content while optionally showing user-specific data.
 *
 * @param ctx - Convex query, mutation, or action context
 * @returns User identity or null if not authenticated
 *
 * @example
 * ```typescript
 * const identity = await getCurrentUser(ctx);
 * if (identity) {
 *   // Show personalized content
 *   return { user: identity.name, ...publicData };
 * }
 * return publicData;
 * ```
 */
export async function getCurrentUser(
  ctx: AuthContext,
): Promise<UserIdentity | null> {
  return await ctx.auth.getUserIdentity();
}

/**
 * Require authentication for a Convex function.
 * Throws an error if no user is authenticated.
 *
 * Use this for mutations/queries that should only be accessible
 * to authenticated users. The thrown error will be caught by
 * Convex and returned to the client as an error response.
 *
 * @param ctx - Convex query, mutation, or action context
 * @returns User identity (guaranteed non-null)
 * @throws Error with message "Not authenticated" if no valid token
 *
 * @example
 * ```typescript
 * export const createPost = mutation({
 *   args: { content: v.string() },
 *   handler: async (ctx, args) => {
 *     const identity = await requireAuth(ctx);
 *     // identity is guaranteed to be non-null here
 *     return ctx.db.insert("posts", {
 *       authorId: identity.subject,
 *       content: args.content,
 *     });
 *   },
 * });
 * ```
 */
export async function requireAuth(ctx: AuthContext): Promise<UserIdentity> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error('Not authenticated');
  }
  return identity;
}

/**
 * Extract the Clerk user ID from the authenticated identity.
 *
 * Clerk's user ID is stored in the JWT's `sub` (subject) claim.
 * This is the same ID you'll find in Clerk's dashboard and
 * matches the format used in userProfiles.clerkUserId.
 *
 * @param ctx - Convex query, mutation, or action context
 * @returns Clerk user ID string (e.g., "user_2abc123...")
 * @throws Error with message "Not authenticated" if no valid token
 *
 * @example
 * ```typescript
 * export const getMyProfile = query({
 *   args: {},
 *   handler: async (ctx) => {
 *     const clerkUserId = await getClerkUserId(ctx);
 *     return ctx.db
 *       .query("userProfiles")
 *       .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
 *       .first();
 *   },
 * });
 * ```
 */
export async function getClerkUserId(ctx: AuthContext): Promise<string> {
  const identity = await requireAuth(ctx);
  // The Clerk user ID is in the `subject` claim of the JWT
  // This is the `sub` claim, which for Clerk is the user's unique ID
  return identity.subject;
}

/**
 * Get user profile information from the authenticated identity.
 *
 * Returns a subset of profile information that Clerk provides in the JWT.
 * This data comes directly from the token, not from our database.
 *
 * @param ctx - Convex query, mutation, or action context
 * @returns Object with profile data from the JWT, or null if not authenticated
 *
 * @example
 * ```typescript
 * const profile = await getUserProfile(ctx);
 * if (profile) {
 *   console.log(`Welcome, ${profile.name}!`);
 * }
 * ```
 */
export async function getUserProfile(ctx: AuthContext): Promise<{
  clerkUserId: string;
  email: string | undefined;
  name: string | undefined;
  pictureUrl: string | undefined;
} | null> {
  const identity = await getCurrentUser(ctx);
  if (!identity) {
    return null;
  }

  return {
    clerkUserId: identity.subject,
    email: identity.email,
    name: identity.name,
    pictureUrl: identity.pictureUrl,
  };
}

/**
 * Create a Clerk sign-in token for a user.
 *
 * This is used when Clerk returns `needs_second_factor` with `email_code`
 * during email/password sign-in, despite no MFA being configured.
 * The sign-in token allows bypassing the unnecessary email verification step.
 *
 * Security: This action should only be called AFTER the password has been
 * verified by Clerk's first factor. The token is single-use and short-lived.
 *
 * @param email - The email address of the user to create a token for
 * @returns The sign-in token string, or null if the user is not found
 */
export const createSignInToken = action({
  args: {
    email: v.string(),
  },
  handler: async (_ctx, args) => {
    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    if (!clerkSecretKey) {
      throw new Error('CLERK_SECRET_KEY is not configured');
    }

    // Step 1: Look up the user by email to get their Clerk user ID
    const usersResponse = await fetch(
      `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(
        args.email,
      )}`,
      {
        headers: {
          Authorization: `Bearer ${clerkSecretKey}`,
        },
      },
    );

    if (!usersResponse.ok) {
      throw new Error(`Failed to look up user: ${usersResponse.status}`);
    }

    const users = await usersResponse.json();
    if (!users || users.length === 0) {
      return null;
    }

    const userId = users[0].id;

    // Step 2: Create a sign-in token for the user
    const tokenResponse = await fetch(
      'https://api.clerk.com/v1/sign_in_tokens',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${clerkSecretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          expires_in_seconds: 60,
        }),
      },
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(
        `Failed to create sign-in token: ${tokenResponse.status} ${errorText}`,
      );
    }

    const tokenData = await tokenResponse.json();
    return tokenData.token as string;
  },
});
