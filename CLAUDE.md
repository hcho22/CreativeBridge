# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Documentation

Before starting any task, read `.claude/.agent/README.md` for context. All important documentation lives in `.claude/.agent/`:

- **Tasks/**: PRDs and implementation plans for features
- **System/**: Architecture, database schema, integration points
- **SOP/**: Procedures for migrations, deployments, testing

Always update `.claude/.agent/` docs after implementing features.

## Environment Setup

- Copy `.env.example` to `.env` and fill in API keys (Convex, Supabase, OpenAI, Replicate)
- `.npmrc` has `legacy-peer-deps=true` — required for dependency installation
- Convex dev deployment: run `npx convex dev` alongside Metro

## Common Commands

### Development

```bash
npm start                    # Start Expo/Metro bundler
npm run ios                  # Run on iOS simulator
npm run android              # Run on Android emulator
npm run start:dev            # Start with dev client
npx convex dev               # Start Convex dev server (run alongside Metro)
```

### Testing

```bash
npm test                     # Run all tests
npm test -- --watch          # Watch mode
npm test -- --testPathPattern=services/imageGeneration  # Single test file
npm run test:coverage        # Generate coverage report
npm run test:unit            # Unit tests only
npm run test:integration     # Integration tests only
npm run test:image-generation # Image generation tests
npm run test:claude-skills   # Claude Skills tests
```

### Building

```bash
npm run prebuild             # Generate native projects (after dependency changes)
npm run prebuild:clean       # Clean rebuild of native projects
cd ios && pod install        # Install iOS dependencies (after prebuild)
npm run eas:build:ios        # EAS Build for iOS
npm run eas:build:android    # EAS Build for Android
npm run eas:submit:testflight # Submit to TestFlight
```

### E2E Testing (Detox)

```bash
npx detox build -c ios.sim.debug    # Build for iOS simulator
npx detox test -c ios.sim.debug     # Run E2E tests on iOS simulator
npx detox build -c android.emu.debug # Build for Android emulator
npx detox test -c android.emu.debug  # Run E2E tests on Android emulator
```

### Code Quality

```bash
npm run lint                 # Run ESLint
npm run lint:fix             # Auto-fix lint issues
npm run format               # Format with Prettier
```

**Pre-commit hooks**: Husky + lint-staged runs Prettier and ESLint on staged files automatically.

**ESLint note**: All TypeScript/ESLint rules are configured as warnings (not errors) to allow autonomous agent workflows. `npm run lint` will report issues but won't fail the build.

## Architecture Overview

### Tech Stack

- **Frontend**: React Native 0.81.5 + Expo 54 + TypeScript 5.8
- **Backend (Primary)**: Convex (real-time database, native Clerk auth, storage)
- **Backend (Fallback)**: Supabase (PostgreSQL with RLS for legacy users)
- **AI**: OpenAI GPT-4 (stories) + Replicate Stable Diffusion 3.5 (images) + Claude Skills SDK
- **Auth**: Clerk (OAuth) → Convex JWT verification
- **Navigation**: React Navigation v7 (tabs + stack)

### Path Aliases

The project uses path aliases defined in `tsconfig.json`:

- `@/*` → `src/*`
- `@/components/*`, `@/services/*`, `@/types/*`, etc.

### Core Services (`src/services/`)

**Story Engine**:

- `storyGenerationService.ts` - AI-powered story continuation with GPT-4
- `storyAgent.ts`, `enhancedStoryAgent.ts` - Multi-personality AI agents
- `storyImportService.ts`, `storyManagementService.ts` - Story CRUD operations

**Image Generation**:

- `imageGeneration.ts` - Replicate API with grade-appropriate art style enforcement
- Art styles defined in `ART_STYLE_MAPPING` (K-2 watercolor, 3-5 digital, 6-8 realistic, 9-12 sophisticated)
- 3-tier prompt generation: story-specific → advanced NER → grade-appropriate fallback

**AI Enhancement**:

- `claudeSkillsManager.ts` - Claude Skills SDK integration for quality assessment

**Core Infrastructure**:

- `convex.ts` - Convex client initialization (PRIMARY for OAuth users)
- `supabase.ts` - Supabase client (FALLBACK for legacy users)
- `xpEventTracker.ts` - Gamification (XP costs 1000 for image generation)
- `analyticsService.ts` - User behavior tracking

### Convex Functions (`convex/`)

- `userProfiles.ts` - User profile mutations/queries (XP, streaks, stats)
- `gameSessions.ts` - Story session management, search, library
- `imageGeneration.ts` - Image generation event tracking and analytics
- `onboarding.ts` - Onboarding milestones and progress
- `storage.ts` - Image upload/storage functions
- `auth.ts` - Authentication helpers (`requireAuth`, `getClerkUserId`)

### Authentication Flow

**OAuth Users (Clerk IDs):**

- Clerk handles OAuth (Google/Apple) → issues JWT
- Convex verifies Clerk JWT via `ConvexProviderWithClerk`
- User profiles stored in Convex `userProfiles` table

**Legacy Users (Supabase UUIDs):**

- Supabase email/password authentication
- `AuthContext.tsx` manages session state
- Email confirmation via deep links

### Database

**Convex (PRIMARY - OAuth users):**

- Schema defined in `convex/schema.ts`
- TypeScript types auto-generated in `convex/_generated/`
- Key tables: `userProfiles`, `gameSessions`, `imageGenerationEvents`

**Supabase (FALLBACK - legacy users):**

- SQL migrations archived in `.agent/archive/sql/`
- TypeScript types in `src/types/database.ts`
- Row Level Security (RLS) policies for data isolation

### Grade Level System

Content adapts to four levels (K-2, 3-5, 6-8, 9-12):

- Story vocabulary and complexity
- Art style (watercolor → realistic → sophisticated)
- Prompt difficulty

## Testing Infrastructure

- Jest with `react-native` preset, coverage threshold at **70%** (branches, functions, lines, statements)
- Test setup files: `src/__tests__/setup.ts` and `src/__tests__/setupAfterEnv.ts` — contain comprehensive mocks for Clerk, Supabase, AsyncStorage, React Navigation, and RN modules
- Test flag: Set `DISABLE_XP_COSTS_FOR_TESTING=true` in `.env` to bypass XP cost checks in tests

## Key Patterns

### Service Pattern

```typescript
// Services use class pattern with singleton export
export class ServiceName {
  public async method(params: Type): Promise<ReturnType> {
    // Implementation
  }
}
export const serviceName = new ServiceName();
```

### Error Handling

- Services throw descriptive errors with context
- Components handle errors and show user-friendly messages
- All API calls include timeout and retry logic

### Feature Flags

- Managed via Convex `featureFlags` table (OAuth users)
- Fallback to Supabase `feature_management` tables (legacy users)

### Convex Development

```bash
npx convex dev                    # Start Convex dev server
npx convex deploy                 # Deploy to production
npx convex run migration:migrateUserProfiles  # Run migration
```

## CI/CD

- **PR Code Review**: GitHub Actions runs automated Claude code review on PRs (`.github/workflows/claude-code-review.yml`)
- **Interactive Claude**: Mention `@claude` in PR comments or issues for on-demand assistance (`.github/workflows/claude.yml`)
- **EAS Build**: Version source is `remote` (EAS-managed). Production builds auto-increment. Three profiles: development, preview, production.

## Deployment & Monitoring Scripts

Key scripts in `scripts/`:

- `pre-deployment-check.sh` - Run before deploying
- `deploy-production.js` - Production deployment
- `submit-testflight.sh` - TestFlight submission
- `smoke-tests-production.ts` - Post-deploy smoke tests
- `monitor-deployment.ts`, `monitor-errors-daily.ts` - Production monitoring

## TestFlight Deployment

See `.agent/SOP/testflight-deployment-procedure.md` for detailed steps:

1. Bump version in `app.json` and `package.json`
2. Run `npm run eas:build:ios` with production profile
3. Submit via `npm run eas:submit:testflight`

## Important Files

- `App.tsx` - Entry point with ConvexProviderWithClerk
- `src/navigation/AppNavigator.tsx` - Navigation structure
- `src/context/AuthContext.tsx` - Auth state management
- `convex/schema.ts` - Convex database schema (PRIMARY)
- `convex/README.md` - Convex functions documentation
- `src/types/database.ts` - Supabase schema types (FALLBACK)
- `src/services/convex.ts` - Convex client initialization
- `app.json` - Expo configuration
