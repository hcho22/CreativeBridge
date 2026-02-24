# Convex Backend for CreativeBridge

This directory contains the Convex backend functions for CreativeBridge. Convex serves as the **primary data layer** for OAuth users (authenticated via Clerk).

## Overview

### Why Convex?

- **Native Clerk Integration**: JWT verification without manual syncing
- **Real-time by Default**: Queries automatically update when data changes
- **TypeScript-First**: Generated types for all functions and schemas
- **Serverless**: No infrastructure to manage

### User Data Strategy

| User Type                     | Data Store              | Auth Method                |
| ----------------------------- | ----------------------- | -------------------------- |
| OAuth (Clerk IDs: `user_xxx`) | **Convex** (primary)    | Clerk OAuth (Google/Apple) |
| Legacy (UUIDs)                | **Supabase** (fallback) | Supabase email/password    |

## Directory Structure

```
convex/
├── _generated/           # Auto-generated TypeScript (DO NOT EDIT)
├── schema.ts             # Database schema definitions
├── auth.ts               # Authentication helpers
├── auth.config.ts        # Clerk provider configuration
├── userProfiles.ts       # User profile management
├── gameSessions.ts       # Game session management
├── imageGeneration.ts    # Image generation tracking
├── onboarding.ts         # Onboarding progress
├── storage.ts            # File storage functions
├── migration.ts          # Data migration utilities
└── README.md             # This file
```

## Schema (`schema.ts`)

### Tables

#### `userProfiles`

User accounts with stats, streaks, and preferences.

| Field                 | Type                                | Description                          |
| --------------------- | ----------------------------------- | ------------------------------------ |
| `clerkUserId`         | `string`                            | Clerk user ID (indexed)              |
| `username`            | `string`                            | Unique username                      |
| `displayName`         | `string`                            | Display name                         |
| `totalXp`             | `number`                            | XP balance (indexed for leaderboard) |
| `currentStreak`       | `number`                            | Current daily streak                 |
| `longestStreak`       | `number`                            | Best streak achieved                 |
| `preferredGradeLevel` | `'K-2' \| '3-5' \| '6-8' \| '9-12'` | Content level                        |
| `onboardingProgress`  | `object`                            | Onboarding item completion           |
| `onboardingCompleted` | `boolean`                           | All onboarding done                  |

#### `gameSessions`

Story writing sessions with content and metadata.

| Field               | Type                 | Description                |
| ------------------- | -------------------- | -------------------------- |
| `userId`            | `Id<'userProfiles'>` | Convex user ID             |
| `clerkUserId`       | `string`             | Clerk ID for quick lookups |
| `storyContent`      | `string`             | Full story text            |
| `gradeLevel`        | `string`             | K-2, 3-5, 6-8, 9-12        |
| `currentRound`      | `number`             | 1-5, story completion      |
| `xpEarned`          | `number`             | XP from this session       |
| `generatedImageUrl` | `string?`            | Image URL                  |
| `storageId`         | `Id<'_storage'>?`    | Convex storage reference   |

#### `imageGenerationEvents`

Tracking for image generation attempts.

| Field              | Type                                                            | Description                  |
| ------------------ | --------------------------------------------------------------- | ---------------------------- |
| `userId`           | `Id<'userProfiles'>`                                            | User reference               |
| `sessionId`        | `Id<'gameSessions'>?`                                           | Session reference            |
| `xpCost`           | `number`                                                        | XP deducted (1000)           |
| `generationStatus` | `'pending' \| 'success' \| 'failed' \| 'refunded' \| 'timeout'` | Status                       |
| `serviceUsed`      | `string`                                                        | AI service (replicate, etc.) |
| `apiResponseTime`  | `number?`                                                       | Response time in ms          |

## Functions Reference

### User Profiles (`userProfiles.ts`)

#### Mutations

| Function                    | Description                                    | Auth       |
| --------------------------- | ---------------------------------------------- | ---------- |
| `createOAuthProfile`        | Create profile for new OAuth user (idempotent) | Required   |
| `updateProfile`             | Update profile fields                          | Owner only |
| `addUserXp`                 | Add XP and optionally words                    | Required   |
| `deductUserXp`              | Deduct XP (image generation)                   | Owner only |
| `refundUserXp`              | Refund XP on failure                           | Required   |
| `updateStreak`              | Update daily streak                            | Required   |
| `incrementGamesPlayed`      | Track games started                            | Required   |
| `incrementStoriesCompleted` | Track completions                              | Required   |
| `completeGameSession`       | Atomic stat update                             | Required   |

#### Queries

| Function              | Description                |
| --------------------- | -------------------------- |
| `getProfileByClerkId` | Fetch profile by Clerk ID  |
| `getMyProfile`        | Get current user's profile |
| `getLeaderboard`      | Top users by XP            |
| `validateXpBalance`   | Check XP sufficiency       |

### Game Sessions (`gameSessions.ts`)

#### Mutations

| Function                         | Description                  | Auth       |
| -------------------------------- | ---------------------------- | ---------- |
| `createSession`                  | Start new story session      | Required   |
| `createStoryContinuationSession` | Continue from imported story | Required   |
| `updateSession`                  | Update session fields        | Owner only |
| `completeSession`                | Mark story complete          | Owner only |
| `updateStoryGeneratedImage`      | Set generated image URL      | Owner only |
| `updateImageUploadStatus`        | Track upload status          | Owner only |
| `validateStoryImport`            | Pre-flight import validation | Required   |

#### Queries

| Function                   | Description               |
| -------------------------- | ------------------------- |
| `getActiveSession`         | User's incomplete session |
| `getSession`               | Session by ID             |
| `getUserSessions`          | Paginated session history |
| `searchUserStories`        | Search by content         |
| `getUserStoriesWithImages` | Stories with images       |
| `getImportableStories`     | Stories for continuation  |
| `getStoryLibrary`          | Filtered/sorted listing   |

### Image Generation (`imageGeneration.ts`)

#### Mutations

| Function                     | Description                | Auth       |
| ---------------------------- | -------------------------- | ---------- |
| `createImageGenerationEvent` | Start tracking, deduct XP  | Required   |
| `updateImageGenerationEvent` | Update status, auto-refund | Owner only |
| `refundImageGenerationEvent` | Manual refund              | Owner only |

#### Queries

| Function                          | Description         |
| --------------------------------- | ------------------- |
| `getUserImageGenerationEvents`    | Event history       |
| `getImageGenerationEvent`         | Single event        |
| `getSessionImageGenerationEvents` | Events for session  |
| `getImageGenerationAnalytics`     | Aggregated stats    |
| `getDailyImageGenerationStats`    | Daily trends        |
| `checkXpForImageGeneration`       | Pre-flight XP check |
| `getRecentImageGenerationEvents`  | Admin monitoring    |

### Onboarding (`onboarding.ts`)

#### Mutations

| Function                       | Description                | Auth     |
| ------------------------------ | -------------------------- | -------- |
| `updateOnboardingProgressItem` | Mark item complete         | Required |
| `recordOnboardingMilestone`    | Record milestone, award XP | Required |
| `recordMultipleMilestones`     | Batch milestone recording  | Required |
| `resetOnboardingProgress`      | Reset for testing          | Required |

#### Queries

| Function                 | Description            |
| ------------------------ | ---------------------- |
| `getOnboardingStatus`    | Full onboarding state  |
| `getMyOnboardingStatus`  | Current user's status  |
| `checkMilestoneAchieved` | Single milestone check |
| `getOnboardingAnalytics` | Aggregated stats       |

### Storage (`storage.ts`)

#### Mutations

| Function              | Description               | Auth       |
| --------------------- | ------------------------- | ---------- |
| `generateUploadUrl`   | Get presigned upload URL  | Required   |
| `storeImageReference` | Link storageId to session | Owner only |
| `recordUploadFailure` | Track failed attempts     | Owner only |
| `deleteImage`         | Remove from storage       | Owner only |

#### Queries

| Function             | Description          |
| -------------------- | -------------------- |
| `getImageUrl`        | URL from storageId   |
| `getSessionImageUrl` | Image URL by session |
| `checkStorageHealth` | Diagnostics          |

#### Actions

| Function        | Description                 |
| --------------- | --------------------------- |
| `uploadFromUrl` | Server-side image migration |

## Authentication

### Auth Helpers (`auth.ts`)

```typescript
import { requireAuth, getClerkUserId, getCurrentUser } from './auth';

// Require auth (throws if not authenticated)
export const myMutation = mutation({
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const clerkUserId = identity.subject;
    // ...
  },
});

// Optional auth
export const myQuery = query({
  handler: async (ctx, args) => {
    const identity = await getCurrentUser(ctx);
    if (!identity) return null;
    // ...
  },
});

// Get Clerk ID directly
export const anotherMutation = mutation({
  handler: async (ctx, args) => {
    const clerkUserId = await getClerkUserId(ctx);
    // ...
  },
});
```

### Environment Variables

Set in **Convex Dashboard** → Settings → Environment Variables:

| Variable                  | Description            | Example                                   |
| ------------------------- | ---------------------- | ----------------------------------------- |
| `CLERK_JWT_ISSUER_DOMAIN` | Clerk Frontend API URL | `https://verb-noun-00.clerk.accounts.dev` |

## XP System

### Constants

- **Image Generation Cost**: 1000 XP
- **Refundable Error Types**: `api_failure`, `content_safety`, `timeout`

### Onboarding XP Rewards

| Milestone      | XP      |
| -------------- | ------- |
| `first_story`  | 50      |
| `first_image`  | 25      |
| `first_voice`  | 25      |
| `first_streak` | 50      |
| **Total**      | **150** |

## Development

### Commands

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

# Run a function manually
npx convex run userProfiles:getLeaderboard

# Run migration
npx convex run migration:migrateUserProfiles
```

### Testing

Unit tests in `src/__tests__/convex/`:

- `userProfiles.test.ts` - 36 tests
- `gameSessions.test.ts` - 63 tests
- `imageGeneration.test.ts` - 43 tests
- `onboarding.test.ts` - 27 tests
- `storage.test.ts` - 14 tests

Integration tests in `src/__tests__/integration/`:

- `convexFlows.integration.test.ts` - 34 tests

## Migration from Supabase

See [prd-supabase-to-convex-migration.md](../.agent/Tasks/prd-supabase-to-convex-migration.md) for full migration details.

### Function Mapping

| Supabase RPC                        | Convex Function                               |
| ----------------------------------- | --------------------------------------------- |
| `create_oauth_user_profile`         | `userProfiles.createOAuthProfile`             |
| `add_user_xp`                       | `userProfiles.addUserXp`                      |
| `update_user_streak`                | `userProfiles.updateStreak`                   |
| `create_story_continuation_session` | `gameSessions.createStoryContinuationSession` |
| `search_user_stories`               | `gameSessions.searchUserStories`              |
| `create_image_generation_event`     | `imageGeneration.createImageGenerationEvent`  |
| `update_image_generation_event`     | `imageGeneration.updateImageGenerationEvent`  |
| `get_onboarding_status`             | `onboarding.getOnboardingStatus`              |

## Related Documentation

- [Convex Docs](https://docs.convex.dev)
- [Convex + Clerk](https://docs.convex.dev/auth/clerk)
- [Migration PRD](../.agent/Tasks/prd-supabase-to-convex-migration.md)
- [Project Architecture](../.agent/System/project_architecture.md)
