# Convex Backend for CreativeBridge

This directory contains the Convex backend functions and schema for CreativeBridge.

## Overview

CreativeBridge is migrating from Supabase PostgreSQL to Convex. This backend provides:

- User profile management with XP and streak tracking
- Game session storage for story writing
- Image generation event tracking
- Story diversity scoring
- Feature flags for gradual rollouts

See [prd-supabase-to-convex-migration.md](../.agent/Tasks/prd-supabase-to-convex-migration.md) for migration details.

## Environment Variables

Set these in the **Convex Dashboard** → Settings → Environment Variables:

| Variable                  | Description                         | Example                                   |
| ------------------------- | ----------------------------------- | ----------------------------------------- |
| `CLERK_JWT_ISSUER_DOMAIN` | Clerk Frontend API URL (JWT Issuer) | `https://verb-noun-00.clerk.accounts.dev` |

### Finding Your Clerk JWT Issuer Domain

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Select your application
3. Navigate to Configure → JWT Templates
4. Create a template named "convex" if it doesn't exist
5. Copy the **Issuer** URL (looks like `https://[instance-name].clerk.accounts.dev`)

## Directory Structure

```
convex/
├── _generated/          # Auto-generated types (gitignored)
├── auth.config.ts       # Clerk authentication configuration
├── auth.ts              # Auth helper functions (US-008)
├── schema.ts            # Database schema definition
├── userProfiles.ts      # User profile mutations/queries
├── gameSessions.ts      # Game session functions
├── imageGeneration.ts   # Image generation event tracking
├── onboarding.ts        # Onboarding progress functions
└── storage.ts           # File storage functions
```

## Database Schema

See [schema.ts](./schema.ts) for the complete schema. Key tables:

- **userProfiles**: User accounts, XP, streaks, onboarding progress
- **gameSessions**: Story writing sessions with content and images
- **imageGenerationEvents**: Image generation attempts and costs
- **storyElements**: Extracted story elements for diversity tracking
- **storyDiversityScores**: Per-story diversity metrics
- **featureFlags**: Remote feature configuration
- **storyDownloadHistory**: Download analytics

## Development Commands

```bash
# Start development server (syncs schema and functions)
npx convex dev

# Generate TypeScript types without deploying
npx convex codegen

# Deploy to production
npx convex deploy

# View logs
npx convex logs

# Open dashboard
npx convex dashboard
```

## Authentication

Authentication uses Clerk with native Convex integration:

1. User signs in via Clerk (Google/Apple OAuth)
2. Clerk issues a JWT with user identity
3. Convex validates JWT via Clerk's JWKS endpoint
4. Functions access user via `ctx.auth.getUserIdentity()`

See [auth.config.ts](./auth.config.ts) for configuration details.

## Function Patterns

### Authenticated Mutation

```typescript
import { mutation } from "./_generated/server";
import { requireAuth } from "./auth";

export const myMutation = mutation({
  args: { ... },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const clerkUserId = identity.subject;
    // ... your logic
  },
});
```

### Authenticated Query

```typescript
import { query } from "./_generated/server";
import { getCurrentUser } from "./auth";

export const myQuery = query({
  args: { ... },
  handler: async (ctx, args) => {
    const identity = await getCurrentUser(ctx);
    if (!identity) {
      return null; // or throw
    }
    // ... your logic
  },
});
```

## Related Documentation

- [Convex Docs](https://docs.convex.dev)
- [Convex + Clerk](https://docs.convex.dev/auth/clerk)
- [Migration PRD](../.agent/Tasks/prd-supabase-to-convex-migration.md)
