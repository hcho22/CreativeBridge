/**
 * Convex Auth Configuration for CreativeBridge
 *
 * Configures Clerk as the authentication provider for Convex.
 * This enables native Clerk-Convex integration without manual JWT syncing.
 *
 * ## How it works:
 * 1. User authenticates via Clerk (Google/Apple OAuth)
 * 2. Clerk issues a JWT with the user's identity
 * 3. Convex validates the JWT using Clerk's JWKS endpoint
 * 4. Convex functions can access `ctx.auth.getUserIdentity()` to get the user
 *
 * ## Environment Variable Setup (Required):
 * In the Convex Dashboard → Settings → Environment Variables, add:
 *
 *   CLERK_JWT_ISSUER_DOMAIN = https://[your-clerk-instance].clerk.accounts.dev
 *
 * To find your domain:
 * 1. Go to Clerk Dashboard → Configure → JWT Templates
 * 2. Create a "convex" template (if not exists)
 * 3. Copy the "Issuer" URL (e.g., https://verb-noun-00.clerk.accounts.dev)
 *
 * @see https://docs.convex.dev/auth/clerk
 * @implements US-007: Configure Clerk with Convex
 */

import { AuthConfig } from 'convex/server';

/**
 * Auth configuration for Clerk provider.
 *
 * The `domain` is the Clerk Frontend API URL (Issuer URL from JWT templates).
 * The `applicationID` must be "convex" - this is a fixed value required by Convex.
 */
export default {
  providers: [
    {
      // Clerk Frontend API URL (JWT Issuer)
      // Set CLERK_JWT_ISSUER_DOMAIN in Convex Dashboard environment variables
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,

      // This must be exactly "convex" - Convex requires this specific value
      applicationID: 'convex',
    },
  ],
} satisfies AuthConfig;
