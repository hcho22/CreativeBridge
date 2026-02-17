# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Documentation

Before starting any task, read `.agent/README.md` for context. All important documentation lives in `.agent/`:

- **Tasks/**: PRDs and implementation plans for features
- **System/**: Architecture, database schema, integration points
- **SOP/**: Procedures for migrations, deployments, testing

Always update `.agent/` docs after implementing features.

## Common Commands

### Development

```bash
npm start                    # Start Expo/Metro bundler
npm run ios                  # Run on iOS simulator
npm run android              # Run on Android emulator
npm run start:dev            # Start with dev client
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

### Code Quality

```bash
npm run lint                 # Run ESLint
npm run lint:fix             # Auto-fix lint issues
npm run format               # Format with Prettier
```

## Architecture Overview

### Tech Stack

- **Frontend**: React Native 0.81.5 + Expo 54 + TypeScript 5.8
- **Backend**: Supabase (PostgreSQL with RLS, real-time, edge functions)
- **AI**: OpenAI GPT-4 (stories) + Replicate Stable Diffusion 3.5 (images) + Claude Skills SDK
- **Auth**: Clerk (OAuth) + Supabase JWT verification
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

- `supabase.ts` - Database client and auth
- `xpEventTracker.ts` - Gamification (XP costs 1000 for image generation)
- `analyticsService.ts` - User behavior tracking

### Authentication Flow

- Clerk handles OAuth (Google/Apple) → issues JWT
- Supabase verifies Clerk JWT for database access
- `AuthContext.tsx` manages session state
- Email confirmation via deep links

### Database

- Migrations stored in `sql/` directory
- TypeScript types in `src/types/database.ts`
- Row Level Security (RLS) policies enforce user data isolation
- Key tables: `user_profiles`, `game_sessions`, `story_diversity_scores`

### Grade Level System

Content adapts to four levels (K-2, 3-5, 6-8, 9-12):

- Story vocabulary and complexity
- Art style (watercolor → realistic → sophisticated)
- Prompt difficulty

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

- Managed via Supabase `feature_management` tables
- Check `minimal_feature_setup.sql` for current flags

## TestFlight Deployment

See `.agent/SOP/testflight-deployment-procedure.md` for detailed steps:

1. Bump version in `app.json` and `package.json`
2. Run `npm run eas:build:ios` with production profile
3. Submit via `npm run eas:submit:testflight`

## Important Files

- `App.tsx` - Entry point
- `src/navigation/AppNavigator.tsx` - Navigation structure
- `src/context/AuthContext.tsx` - Auth state management
- `src/types/database.ts` - Supabase schema types
- `app.json` - Expo configuration
