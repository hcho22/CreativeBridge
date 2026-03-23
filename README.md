# CreativeBridge: Interactive Story Writing App

A mobile story-writing application where users create engaging narratives with AI assistance while building their creative writing skills across different grade levels. Built with React Native, Expo, and a multi-AI backend.

## Features

### Core Functionality

- **Grade-level Story Creation** - Choose from K-2, 3-5, 6-8, or 9-12 difficulty levels
- **AI-Assisted Writing** - Collaborative 5-round storytelling powered by GPT-4o-mini
- **AI Image Generation** - Story-specific illustrations via Stable Diffusion 3.5 with grade-appropriate art styles
- **Image Display Modal** - Dismissable modal overlay with adaptive glass background for viewing illustrations in full screen
- **Voice Input Support** - Native speech recognition for input + ElevenLabs TTS for read-aloud
- **Story Library Management** - Import, search, and continue stories from your personal library
- **Story Continuation** - Resume stories with collapsible "Previously Written" section preserving full context
- **Advanced Search** - Story search with similarity detection and cosine-similarity scoring
- **Story Download & Theming** - Download stories with theme-based formatting, animations, and localized UI
- **Challenge System** - Writing challenges to encourage diverse storytelling across genres and themes
- **Cross-platform Support** - Native iOS and Android applications via Expo

### User Profile System

- **User Authentication** - Dual authentication system
  - **OAuth Sign-In (Primary)** - Sign in with Google or Apple via Clerk
  - **Email/Password (Legacy)** - Traditional authentication via Supabase
  - **Account Linking** - Automatic linking of accounts with the same email
- **Profile Completion** - Guided profile setup with progress tracking
- **XP & Streak Tracking** - Gamified writing experience with XP economy
- **Onboarding System** - Guided onboarding with milestone rewards (150 XP)
- **Statistics Dashboard** - Games played, words written, best scores
- **Grade Level Preferences** - Personalized content difficulty

### Story Features

- **Story Import** - Load stories from database, upload text files, or import from Story Quest
- **Collaborative Writing** - 5-round turn-based storytelling with AI
- **Grade-appropriate Content** - Vocabulary, complexity, and art style adapt to grade level
- **AI Image Generation** - Generate story illustrations (costs 1000 XP)
- **Story Quality Assessment** - Claude Skills SDK integration for content quality scoring
- **Story Element Extraction** - Automatic character, setting, and plot pattern detection
- **Diversity Tracking** - Story diversity scoring to encourage creative variety
- **Story Download & Export** - Download stories with theme-based formatting

### Art Style System

Image generation adapts art style by grade level:

- **K-2**: Watercolor illustrations
- **3-5**: Digital art style
- **6-8**: Realistic art style
- **9-12**: Sophisticated art style

## Tech Stack

- **Frontend**: React Native 0.81.5 + Expo 54 + TypeScript 5.8
- **Backend (Primary)**: Convex (real-time database, native Clerk auth, file storage)
- **Backend (Fallback)**: Supabase (PostgreSQL with RLS for legacy users)
- **AI - Stories**: OpenAI GPT-4o-mini (configurable via environment variable)
- **AI - Images**: Replicate Stable Diffusion 3.5 Large
- **AI - Quality**: Claude Skills SDK for content assessment
- **Authentication**: Clerk (OAuth) → Convex JWT verification
- **Voice**: Native speech recognition (input) + ElevenLabs TTS (read-aloud)
- **Navigation**: React Navigation v7 (tabs + stack)
- **State Management**: React Context API
- **Monitoring**: Custom service health checks, error logging, anomaly detection
- **Testing**: Jest + Detox (E2E)
- **Build**: EAS Build for iOS/Android

## Prerequisites

- Node.js 20 or higher
- React Native development environment setup
- iOS development: Xcode, CocoaPods
- Android development: Android Studio, Java JDK
- Convex account (primary backend)
- Clerk account (OAuth authentication)
- OpenAI API key (story generation)
- Replicate API key (image generation)
- Google Cloud Console account (for Google OAuth)
- Apple Developer account (for Apple Sign In)
- ElevenLabs API key (for voice features)
- Supabase account (optional, for legacy user support)

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/hcho22/CreativeBridge.git
cd CreativeBridge
```

### 2. Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Generate native projects
npm run prebuild

# iOS: Install CocoaPods dependencies
cd ios && pod install && cd ..
```

### 3. Environment Setup

Create a `.env` file in the project root (see `.env.example` for reference):

```bash
# Clerk Configuration
CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxx
CLERK_JWKS_URL=https://your-instance.clerk.accounts.dev/.well-known/jwks.json

# Convex (Primary Backend)
CONVEX_URL=https://your-project.convex.cloud

# OpenAI
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4o-mini

# Supabase (Legacy Fallback)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key

# ElevenLabs (Voice AI)
ELEVENLABS_API_KEY=your-elevenlabs-api-key
```

#### OAuth Setup (Google & Apple)

CreativeBridge supports OAuth authentication via Clerk. See the [Clerk OAuth Setup Guide](docs/developer/clerk-oauth-setup-guide.md) for detailed instructions.

**Quick Setup:**

1. **Clerk Configuration**:

   - Create a Clerk account at [clerk.com](https://clerk.com)
   - Configure Google and Apple OAuth providers
   - Obtain Clerk publishable key and JWKS URL

2. **Convex Integration**: Convex verifies Clerk JWTs natively via `ConvexProviderWithClerk`

For complete OAuth setup instructions, see:

- [Clerk OAuth Setup Guide](docs/developer/clerk-oauth-setup-guide.md)
- [Deep Linking Setup](docs/developer/clerk-deep-linking-setup.md)
- [OAuth Dependencies](docs/developer/oauth-dependencies.md)

### 4. Running the Application

#### iOS

```bash
# Start Metro
npm start

# Run iOS (in another terminal)
npm run ios
```

#### Android

```bash
# Start Metro
npm start

# Run Android (in another terminal)
npm run android
```

#### Convex Backend

```bash
# Start Convex dev server (run alongside Metro)
npx convex dev
```

## Project Structure

```
CreativeBridge/
├── App.tsx                          # Entry point with ConvexProviderWithClerk
├── src/
│   ├── components/
│   │   ├── auth/                    # AppleSignInButton, GoogleSignInButton
│   │   ├── common/                  # Shared UI (21 components)
│   │   │   ├── ImageDisplayModal    # Dismissable image overlay with glass background
│   │   │   ├── AdaptiveGlassBackground  # Blur/gradient backdrop for modals
│   │   │   ├── CelebrationModal     # Achievement celebration overlays
│   │   │   ├── ImageGeneration      # AI image generation controls
│   │   │   ├── VoiceInput           # Voice-to-text input component
│   │   │   ├── ErrorBoundary        # React error boundary wrapper
│   │   │   ├── ErrorRecoveryModal   # User-facing error recovery UI
│   │   │   ├── FullScreenImageModal # Full-screen image viewer
│   │   │   ├── DownloadProgressIndicator  # Story download progress UI
│   │   │   └── ...                  # OptimizedImage, StoryQualityIndicator, etc.
│   │   ├── story/                   # Story-specific components
│   │   │   ├── AdvancedSearchModal  # Search with similarity detection
│   │   │   ├── StoryPreviewEdit     # Story preview and editing
│   │   │   └── StorySelectionModal  # Story library browser modal
│   │   ├── onboarding/              # Onboarding checklist & guidance
│   │   ├── analytics/               # Analytics dashboard components
│   │   └── test/                    # ClaudeSkillsDemo, DependencyVerification
│   ├── config/
│   │   └── environment.ts           # Environment variable configuration
│   ├── constants/                    # Theme and app constants
│   ├── context/
│   │   └── AuthContext.tsx           # Auth state management (Clerk + Supabase)
│   ├── hooks/                        # Custom React hooks (6 hooks)
│   │   ├── useABTesting             # A/B test variant selection
│   │   ├── useClaudeSkillsDashboard # Claude Skills monitoring dashboard
│   │   ├── useGlassAvailability     # Glass effect platform detection
│   │   ├── useReactotron            # Reactotron dev tools integration
│   │   ├── useSafeClerkAuth         # Safe Clerk auth with fallbacks
│   │   └── useTheme                 # Theme context consumer
│   ├── interfaces/
│   │   └── StoryServiceInterfaces.ts  # Story service type contracts
│   ├── navigation/
│   │   └── AppNavigator.tsx          # Tab + stack navigation structure
│   ├── screens/                      # 10 screens
│   │   ├── AuthScreen.tsx            # Login/signup
│   │   ├── HomeScreen.tsx            # Main story creation interface
│   │   ├── StorySetupScreen.tsx      # Story configuration
│   │   ├── StorySelectionScreen.tsx  # Story library browser
│   │   ├── ImportOptionsScreen.tsx   # Story import method picker
│   │   ├── StoryQuestImportScreen.tsx # Import from Story Quest
│   │   ├── StoryPreviewEditScreen.tsx # Preview & edit before play
│   │   ├── ProfileScreen.tsx         # User profile & stats
│   │   ├── ProfileCompletionScreen.tsx # Guided profile setup
│   │   └── SettingsScreen.tsx        # App settings
│   ├── services/                     # Business logic layer (108 services)
│   │   ├── openaiClient.ts           # OpenAI API client
│   │   ├── storyGenerationService.ts # Story continuation engine
│   │   ├── imageGeneration.ts        # Replicate image generation
│   │   ├── claudeSkillsManager.ts    # Claude Skills integration
│   │   ├── convex.ts                 # Convex client initialization
│   │   ├── supabase.ts               # Supabase fallback client
│   │   └── xpEventTracker.ts         # XP economy tracking
│   ├── types/                        # TypeScript type definitions
│   └── utils/                        # Utility functions
├── convex/                           # Convex backend functions
│   ├── schema.ts                     # Database schema (PRIMARY)
│   ├── auth.config.ts                # Clerk JWT auth configuration
│   ├── auth.ts                       # Authentication helpers
│   ├── userProfiles.ts               # User profile mutations/queries
│   ├── gameSessions.ts               # Story session management
│   ├── imageGeneration.ts            # Image generation event tracking
│   ├── onboarding.ts                 # Onboarding milestones
│   ├── storage.ts                    # Image upload/storage
│   ├── adminAnalytics.ts             # Admin analytics queries
│   └── migration.ts                  # Data migration functions
├── .agent/                           # Documentation, PRDs, and SOPs
├── ios/                              # iOS native code
├── android/                          # Android native code
├── scripts/                          # Build, deploy, and monitoring scripts
└── assets/                           # App icons and assets
```

## Services Architecture

The 108 services in `src/services/` are organized into functional categories:

### Story Engine (12 services)

Story generation, AI agents, session management, caching, import, and analytics:
`storyGenerationService`, `storyAgent`, `enhancedStoryAgent`, `storySessionManager`, `storyManagementService`, `storyImportService`, `storyQuestService`, `storyCache`, `predictiveStoryCache`, `storyAnalytics`, `storyAwareFallbackGenerator`, `storyElementExtractionService`

### Image Generation (3 services)

Replicate API integration, post-generation storage, and image optimization:
`imageGeneration`, `imageStorageService`, `postGenerationStorageService`

### Story Download (7 services)

Download engine with theming, animations, localization, and performance monitoring:
`storyDownloadService`, `optimizedStoryDownloadService`, `downloadThemeService`, `downloadAnimations`, `downloadLocalization`, `downloadPerformanceMonitor`, `downloadKeyboardNavigation`

### AI Quality & Skills (7 services)

Claude Skills SDK integration, reliability, credential management, and content assessment:
`claudeSkillsManager`, `claudeSkillsConfigManager`, `claudeSkillsCredentialRotation`, `claudeSkillsMonitor`, `skillErrorAggregation`, `skillErrorRecovery`, `contentQuality`

### Voice & Accessibility (4 services)

Text-to-speech with isolation layers and native speech recognition:
`textToSpeech`, `textToSpeechIsolated`, `textToSpeechSafe`, `nativeSpeechRecognizer`

### Diversity & Educational (9 services)

Diversity scoring, guidance, session tracking, and educational optimization:
`diversityScoreService`, `diversityGuidanceService`, `diversitySessionService`, `diversityDebugService`, `diversityPerformanceMonitoringService`, `diversityScoreStorageService`, `educationalOptimizer`, `readingComprehensionOptimizer`, `challengeService`

### Auth & Security (7 services)

OAuth, JWT verification, session management, and security hardening:
`oauthService`, `clerkJWTVerification`, `sessionManager`, `twoFactorAuth`, `secureApiKeyManager`, `securityAuditor`, `auditLogger`

### Error Handling & Resilience (9 services)

Error management, graceful degradation, fallback strategies, and recovery:
`errorHandler`, `errorLogger`, `enhancedErrorHandling`, `seamlessErrorMasking`, `contextualFallback`, `automaticFallbackManager`, `predictiveFailurePrevention`, `serviceRestoration`, `progressiveEnhancement`

### Base Architecture (3 services)

Core patterns for service orchestration and fallback strategy:
`interfaceAdapter`, `enhancedPromptGenerator`, `enhancedContentAnalysis`

### Monitoring & Analytics (10 services)

User analytics, system monitoring, performance tracking, and anomaly detection:
`analyticsService`, `behaviorAnalytics`, `adoptionAnalyticsService`, `monitoringService`, `serviceHealth`, `anomalyDetector`, `performanceService`, `performanceOptimizer`, `uiPerformanceMonitor`, `costTrackingService`

### Infrastructure & Utilities (~37 services)

Networking, configuration, A/B testing, device info, and platform services:
`api`, `convex`, `supabase`, `openaiClient`, `environment`, `networkAdapter`, `networkMonitor`, `rateLimiter`, `resourceManager`, `deviceInfo`, `abTesting`, `featureFlags`, `rolloutAutomation`, `userPreferences`, `xpEventTracker`, `onboardingMilestoneTracker`, `onboardingService`, `syncService`, `hapticFeedbackService`, `navigationOptimizer`, `dynamicUICoordinator`, `systemWideOptimizer`, `performanceTuner`, `reactotron`, `advancedSearchService`, `similarityDetectionService`, `cosineSimilarityService`, `embeddingGenerationService`, `statisticalAnalysisService`, `recentElementsService`, `contentPrediction`, `engagementOptimizer`, `feedbackCollectionService`, `iterationPlanningService`, `prdSuccessCriteriaValidator`, `accessibilityService`, `downloadHistoryDatabase`

## Development Commands

```bash
# Development
npm start                    # Start Expo/Metro bundler
npm run ios                  # Run on iOS simulator
npm run android              # Run on Android emulator
npm run start:dev            # Start with dev client
npx convex dev               # Start Convex dev server

# Testing
npm test                     # Run all tests
npm run test:coverage        # Generate coverage report
npm run test:unit            # Unit tests only
npm run test:integration     # Integration tests only
npm run test:image-generation # Image generation tests
npm run test:claude-skills   # Claude Skills tests

# Building
npm run prebuild             # Generate native projects
npm run prebuild:clean       # Clean rebuild of native projects
npm run eas:build:ios        # EAS Build for iOS
npm run eas:build:android    # EAS Build for Android
npm run eas:submit:testflight # Submit to TestFlight

# Code Quality
npm run lint                 # Run ESLint
npm run lint:fix             # Auto-fix lint issues
npm run format               # Format with Prettier

# Convex
npx convex dev               # Start Convex dev server
npx convex deploy            # Deploy to production
```

### Scripts

Key scripts in `scripts/` for deployment and monitoring:

```bash
# Deployment
node scripts/deploy-production.js       # Production deployment
bash scripts/pre-deployment-check.sh    # Pre-deploy validation
bash scripts/build-ios.sh               # iOS build
bash scripts/submit-testflight.sh       # TestFlight submission

# Monitoring
npx ts-node scripts/monitor-deployment.ts      # Deployment monitoring
npx ts-node scripts/smoke-tests-production.ts   # Production smoke tests
npx ts-node scripts/monitor-errors-daily.ts      # Daily error monitoring
```

## Key Features Deep Dive

### Grade Level System

Content adapts across four levels:

| Level | Vocabulary                              | Art Style     | Complexity            |
| ----- | --------------------------------------- | ------------- | --------------------- |
| K-2   | Simple, basic sentence structure        | Watercolor    | Basic prompts         |
| 3-5   | Intermediate, creative prompts          | Digital art   | Moderate challenges   |
| 6-8   | Advanced, character development         | Realistic     | Complex storytelling  |
| 9-12  | Complex narratives, literary techniques | Sophisticated | Full creative freedom |

Horror content is automatically softened for younger grade levels.

### Story Continuation & Loaded Stories

When a user resumes a story from their library, the system preserves full context:

- Stories are loaded with a `StoryContribution` entry marked with `source: 'loaded'`
- The HomeScreen renders a collapsible "Previously Written" section showing prior content
- AI receives the full story context to maintain narrative coherence across sessions
- The continuation flow supports all story sources: database imports, text file uploads, and Story Quest imports

### Image Display System

Generated illustrations are presented through a layered modal system:

- **ImageDisplayModal** — dismissable overlay triggered after image generation completes
- **AdaptiveGlassBackground** — platform-aware blur/gradient backdrop (uses `BlurView` on iOS, gradient fallback on Android)
- **FullScreenImageModal** — tap-to-expand full-screen image viewer
- Adaptive `CompletionOptions` adjust layout based on whether an image is displayed

### Authentication Architecture

**OAuth Users (Primary - Clerk → Convex):**

1. User initiates Google/Apple OAuth via Clerk
2. Clerk handles OAuth flow and issues JWT
3. Deep link callback (`creativebridge://auth/callback`)
4. Convex verifies Clerk JWT via `ConvexProviderWithClerk`
5. User profile created/updated in Convex

**Legacy Users (Fallback - Supabase):**

- Email/password authentication via Supabase
- Automatic account linking for matching email addresses

### Database Architecture

**Convex (Primary)** — Real-time, TypeScript-first database:

- `userProfiles` — User data, XP, streaks, preferences
- `gameSessions` — Story sessions with game progress
- `imageGenerationEvents` — Image generation tracking and analytics
- `storyElements` — Extracted story elements for diversity tracking
- `featureFlags` — Remote feature flag configuration

**Supabase (Fallback)** — PostgreSQL with Row Level Security for legacy users

### XP Economy

- Story completion awards XP based on performance
- Image generation costs 1000 XP
- Onboarding milestones reward 150 XP total
- XP tracked via streaks and leaderboard

## Privacy & Security

- **Data Encryption**: All data encrypted in transit and at rest
- **JWT Authentication**: Clerk-issued JWTs verified by Convex
- **Row Level Security**: Supabase RLS policies for legacy data isolation
- **Privacy Compliance**: COPPA and privacy regulation compliant
- **Secure API Keys**: Managed via environment variables

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Development Guidelines

- Follow TypeScript strict mode
- Use React Native best practices
- Maintain accessibility standards
- Write comprehensive tests
- Document features in `.agent/` directory
- Use path aliases (`@/services/*`, `@/components/*`, etc.)

## Troubleshooting

### Common Issues

**Metro bundler issues:**

```bash
# Clear Metro cache
npm start -- --reset-cache
```

**iOS build issues:**

```bash
# Clean and reinstall pods
cd ios && rm -rf Pods Podfile.lock && pod install && cd ..
```

**Android build issues:**

```bash
# Clean gradle cache
cd android && ./gradlew clean && cd ..
```

**Convex issues:**

```bash
# Reset Convex dev server
npx convex dev --once
```

### Getting Help

- Check the [React Native Troubleshooting Guide](https://reactnative.dev/docs/troubleshooting)
- Review [Convex Documentation](https://docs.convex.dev)
- Review [Supabase Documentation](https://supabase.com/docs)
- Create an issue in this repository

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **React Native & Expo** - Mobile development framework
- **Convex** - Real-time backend platform
- **Supabase** - PostgreSQL backend-as-a-service
- **OpenAI** - AI-powered story collaboration
- **Replicate** - AI image generation infrastructure
- **Anthropic** - Claude Skills SDK for content quality assessment
- **Clerk** - Authentication and user management
- **ElevenLabs** - Voice AI integration
- **Story_Quest** - Original inspiration and reference implementation

## Support

For support, email support@creativebridge.app or create an issue in this repository.

---

**Built with love for creative writers of all ages**
