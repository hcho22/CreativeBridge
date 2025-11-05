# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Development Workflow

```bash
# Start Metro bundler (always run first)
npm start

# Run on specific platforms
npm run ios           # iOS simulator/device
npm run android       # Android emulator/device

# Reset Metro cache when having issues
npm start -- --reset-cache
```

### Code Quality & Testing

```bash
# Linting and formatting (pre-commit hooks automatically run these)
npm run lint          # Run ESLint
npm run lint:fix      # Auto-fix ESLint issues
npm run format        # Format with Prettier
npm test              # Run Jest tests

# Pre-commit hooks are configured via Husky and lint-staged
# They automatically run on git commit to ensure code quality

# Image Generation Feature Testing
npm test -- --testPathPattern=imageGeneration  # Test image generation components
npm test -- --testPathPattern=xpSystem         # Test XP system integration
npm run test:image-generation                   # Run all image generation tests
```

### Image Generation Feature Deployment

```bash
# Staging deployment
npm run deploy:staging                          # Deploy to staging with 25% rollout
npm run deploy:image-generation -- --stage=staging --percentage=50  # Custom staging deployment

# Production deployment
npm run deploy:production                       # Deploy to production with 25% rollout
npm run deploy:image-generation -- --stage=production --percentage=75  # Custom production deployment

# Monitoring and management
npm run monitor:image-generation                # Monitor rollout progress and health
npm run validate:database                       # Validate database migrations
npm run rollback:image-generation -- --deployment-id=<id>  # Rollback deployment
```

### Asset Generation

```bash
# Generate app icons for all platforms
npm run setup-icons         # Install sharp + generate all icons
npm run generate-icons      # iOS icons only
npm run generate-android-icons  # Android icons only
```

### Production Builds

```bash
# Platform-specific builds
npm run build:ios           # iOS production build
npm run build:android       # Android production build
npm run build:all           # Both platforms

# Build variants (Android)
npm run build:android:debug    # Debug build
npm run build:android:apk      # APK build
npm run build:android:bundle   # AAB bundle
```

## Architecture Overview

### Core Structure

- **React Native 0.81.1 + TypeScript**: Strict mode enabled
- **React Navigation v7**: Bottom tab navigation with stack screens
- **Supabase Backend**: Authentication, PostgreSQL database, realtime features
- **Context-based State**: AuthContext for user/profile management

### Key Architectural Decisions

**Authentication Flow**: App.tsx → AuthProvider → MainApp component that conditionally renders AuthScreen or AppNavigator based on session state.

**Navigation**: Bottom tabs (Home/Settings/Profile) with React Navigation v7. Each tab has its own screen component with proper TypeScript typing.

**Data Flow**: Supabase client → AuthContext → Screen components. User profiles are fetched/created automatically on login with sophisticated matching logic for existing Story_Quest users.

**Development Tools**:

- Husky pre-commit hooks enforce linting/formatting
- Reactotron integration for debugging (src/services/reactotron.ts)
- lint-staged for selective file processing

### Database Schema (Supabase)

```sql
-- Core user profiles table
user_profiles (
  id UUID PRIMARY KEY,           -- matches Supabase auth.users.id
  username TEXT UNIQUE,          -- display username
  display_name TEXT,             -- formatted display name
  total_xp INTEGER,              -- gamification XP points
  current_streak INTEGER,        -- daily usage streak
  longest_streak INTEGER,        -- best streak record
  total_games_played INTEGER,    -- session count
  total_words_written INTEGER,   -- writing progress metric
  best_score INTEGER,            -- high score
  preferred_grade_level TEXT,    -- K-2, 3-5, 6-8, 9-12
  speech_enabled BOOLEAN         -- accessibility preference
)
```

### File Organization

```
src/
├── context/AuthContext.tsx     # Global auth/user state management
├── services/
│   ├── supabase.ts            # Supabase client + TypeScript types
│   ├── imageGeneration.ts     # AI image generation service
│   ├── secureApiKeyManager.ts # Secure API key management
│   ├── xpEventTracker.ts      # XP system event tracking
│   └── reactotron.ts          # Debug tooling configuration
├── navigation/
│   ├── AppNavigator.tsx       # Bottom tab navigation setup
│   └── index.ts               # Navigation exports
├── screens/                   # Tab screen components
│   ├── HomeScreen.tsx         # Main story creation interface
│   ├── SettingsScreen.tsx     # Game/user preferences
│   ├── ProfileScreen.tsx      # User stats and achievements
│   └── AuthScreen.tsx         # Login/signup flow
├── hooks/
│   └── useReactotron.ts       # Debug logging utilities
└── components/common/
    ├── VoiceInput.tsx         # Voice accessibility component
    ├── ImageGeneration.tsx    # Story image generation component
    └── StoryImageDisplay.tsx  # Generated image display component
```

## Development Guidelines

### Environment Setup

- Node.js 20+ required (specified in package.json engines)
- React Native development environment (Xcode for iOS, Android Studio for Android)
- Supabase credentials in src/services/supabase.ts (configured for development)
- **Image Generation APIs**: Configure .env file with Replicate.com and backup service tokens

### Code Standards

- **TypeScript strict mode**: All files must have proper typing
- **React Navigation v7 patterns**: Use typed navigation params (TabParamList)
- **Supabase patterns**: Follow UserProfile interface, use RLS policies
- **Authentication flow**: AuthContext manages all auth state, screens consume via useAuth()

### Debugging

- **Reactotron integration**: Import useReactotron hook for component debugging
- **Console augmentation**: All console.log/warn/error automatically pipe to Reactotron in development
- **Debug logging**: AuthContext has emoji-based logging for auth events (🔐 login, ✅ success, ❌ errors)

### Story_Quest Integration Notes

- This app adapts the Story_Quest web prototype for mobile
- User profile structure matches Story_Quest database schema
- AuthContext includes logic to migrate existing Story_Quest users by email/username matching
- Grade level system (K-2 through 9-12) follows Story_Quest content difficulty patterns

### Common Issues

- **Metro cache**: Always try `npm start -- --reset-cache` for build issues
- **iOS pods**: If iOS build fails, clean and reinstall: `cd ios && rm -rf Pods Podfile.lock && pod install`
- **Android builds**: Clean gradle cache: `cd android && ./gradlew clean`
- **Supabase auth**: Check network connectivity and Supabase project status if auth fails
- **Image Generation**: If image generation fails, check API keys in .env and feature flag status

## Story Image Generation Feature

### Overview

The Story Image Generation feature allows users to create AI-powered illustrations for their completed stories using XP points (1000 XP per image). The feature integrates with the existing XP system and provides grade-appropriate art styles.

### API Configuration

Required environment variables in `.env`:

```bash
# Primary image generation service (Replicate.com)
REPLICATE_API_TOKEN=your_replicate_token_here

# Backup service (also uses Replicate)
BACKUP_IMAGE_API_TOKEN=your_backup_token_here

# Feature flag for gradual rollout
IMAGE_GENERATION_ENABLED=false

# Performance settings
IMAGE_GENERATION_TIMEOUT_PRIMARY=45000
IMAGE_GENERATION_TIMEOUT_BACKUP=30000
IMAGE_GENERATION_MAX_CONCURRENT=5
IMAGE_GENERATION_XP_COST=1000
```

### Key Components

- **ImageGeneration.tsx**: Main UI component for image generation
- **StoryImageDisplay.tsx**: Component for displaying generated images
- **imageGeneration.ts**: Core service handling API calls and content extraction
- **secureApiKeyManager.ts**: Secure API key management with logging
- **xpEventTracker.ts**: XP system integration for cost tracking

### Grade-Level Art Styles

- **K-2**: Watercolor children's book style, bright colors, simple shapes
- **3-5**: Detailed children's illustrations, vibrant colors, moderate complexity
- **6-8**: Realistic digital art, dramatic lighting, complex compositions
- **9-12**: Sophisticated digital art, mature palettes, professional quality

### Security Features

- API keys are masked in logs and never exposed
- Rate limiting and access tracking
- Secure environment variable management
- Content filtering and prompt sanitization

### Performance Optimizations

- Optimized timeouts (45s primary, 30s backup)
- Reduced concurrent requests (max 5)
- Mobile-optimized polling intervals
- Memory and battery usage optimization
