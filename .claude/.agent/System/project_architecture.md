# CreativeBridge - Project Architecture Documentation

## Project Overview

CreativeBridge is a sophisticated educational writing application that combines AI-powered story generation with comprehensive user management and gamification. Built with React Native, it provides cross-platform mobile experience for collaborative AI storytelling across multiple grade levels.

### Core Mission

Enable educational, age-appropriate collaborative storytelling between users and AI, fostering creativity while maintaining safety and educational value.

## Technical Architecture

### Technology Stack

#### Frontend (React Native)

- **React Native 0.81.1** with **React 19.1.0**
- **TypeScript 5.8.3** for comprehensive type safety
- **Metro 0.81.1** for bundling and development

#### Navigation & UI Framework

- `@react-navigation/native` v7 (tab + stack navigation)
- `react-native-vector-icons` for iconography
- `react-native-reanimated` v3 for smooth animations
- `react-native-gesture-handler` for touch interactions
- `react-native-linear-gradient` for enhanced UI

#### Backend & Database

**Primary (OAuth Users):**

- **Convex** - Real-time TypeScript backend with native Clerk integration
- Automatic real-time updates for queries
- Type-safe mutations and queries with generated TypeScript
- Convex Storage for image persistence

**Fallback (Legacy Email/Password Users):**

- **Supabase** (PostgreSQL) - Fallback for users without Clerk IDs
- Row Level Security (RLS) for data isolation
- Existing database functions maintained for backward compatibility

#### AI Services Integration

- **OpenAI API** (v6.0.0) - Story generation with GPT-4 Turbo
- **Replicate API** (v1.2.0) - Image generation with Stable Diffusion 3.5
- **Claude Skills SDK** (v1.2.0) - Enhanced AI capabilities and optimization
- Custom React Native-compatible clients with fallback systems
- Advanced agent architecture with multiple AI personality modes

#### State Management

- React Context API for global state
- `@react-native-async-storage/async-storage` for persistence
- Custom authentication and session management

### Project Structure

```
src/
├── components/           # Reusable UI components
│   ├── analytics/       # Analytics dashboard components
│   ├── common/          # Shared components (modals, displays, etc.)
│   ├── story/           # Story-specific components
│   └── test/            # Testing utility components
├── screens/             # Screen components for navigation
│   ├── AuthScreen.tsx   # Authentication flow
│   ├── HomeScreen.tsx   # Main app dashboard
│   ├── ProfileScreen.tsx # User profile management
│   └── StoryQuestImportScreen.tsx # Story import workflows
├── services/            # Business logic layer (30+ specialized services)
│   ├── authentication/ # Auth and session management
│   ├── story/          # Story generation and management
│   ├── image/          # Image generation services
│   ├── analytics/      # User behavior tracking
│   └── database/       # Supabase integration layer
├── types/              # TypeScript definitions
│   ├── database.ts     # Database schema types
│   ├── story.ts        # Story-related types
│   └── navigation.ts   # Navigation types
├── context/            # React Context providers
├── navigation/         # App navigation configuration
├── utils/              # Utility functions and helpers
└── config/             # Environment and app configuration
```

## Core System Components

### 1. Authentication & User Management

**Location**: `src/context/AuthContext.tsx`, `src/services/convex.ts`, `convex/auth.ts`

**Primary (OAuth Users - Clerk IDs):**

- Clerk OAuth authentication (Google/Apple)
- Convex native JWT verification via `ConvexProviderWithClerk`
- User profiles stored in Convex `userProfiles` table
- Automatic profile creation on first OAuth sign-in

**Fallback (Legacy Email/Password Users - UUIDs):**

- Supabase email/password authentication
- Email confirmation workflow
- User profiles stored in Supabase `user_profiles` table
- Automatic session management with token refresh
- Deep link handling for email confirmations

**Auth Helper Functions** (`convex/auth.ts`):

- `getCurrentUser(ctx)` - Returns user identity or null
- `requireAuth(ctx)` - Throws if not authenticated
- `getClerkUserId(ctx)` - Extracts Clerk user ID from identity

### 2. Story Generation Engine

**Location**: `src/services/storyGenerationService.ts`

- **Grade-Level Adaptation**: K-2, 3-5, 6-8, 9-12 content levels
- **AI Integration**: OpenAI GPT-4 Turbo for story continuation
- **Content Safety**: Age-appropriate filtering and validation
- **Turn-Based System**: Alternating user/AI story building
- **Context Awareness**: Maintains story coherence and character consistency

### 3. Image Generation System

**Location**: `src/services/imageGeneration.ts`

- **Primary Service**: Replicate API with Stable Diffusion 3.5 Large
- **Backup Service**: Google Nano Banana for fallback
- **XP Economy**: 1000 XP cost per image generation
- **Performance Optimization**: Configurable timeouts and concurrent limits
- **Error Handling**: Comprehensive retry logic with user feedback

#### Art Style Enforcement System

**Critical Feature**: Grade-appropriate art style consistency across all image generation

**System Architecture:**

- **Single Source of Truth**: `ART_STYLE_MAPPING` constant defines art styles for each grade level (K-2, 3-5, 6-8, 9-12)
- **Tiered Prompt Generation**: Three-tier system with comprehensive art style enforcement at each level
- **Validation Layer**: Post-generation validation ensures all prompts contain required style keywords
- **Fallback Safety Net**: Automatic regeneration using fallback methods when validation fails

**Art Style Properties Enforced:**

1. **baseStyle**: Foundation style (e.g., "watercolor children's book illustration" for K-2)
2. **colorPalette**: Age-appropriate color schemes (bright colors for K-2, sophisticated palettes for 9-12)
3. **visualComplexity**: Detail level matching cognitive development stage
4. **artisticTechnique**: Rendering style (watercolor painting with age-appropriate techniques)
5. **emotionalTone**: Mood appropriate for age group (whimsical for K-2, thoughtful for 9-12)
6. **layoutStyle**: Composition guidance (child-friendly framing vs. dynamic composition)
7. **characterStyle**: Character rendering approach (simple shapes vs. detailed features)
8. **backgroundStyle**: Setting detail level (simple vs. complex environments)

**Prompt Generation Tier System:**

**Tier 1 - Story-Specific Prompts** (`generateStorySpecificPrompt`)

- Primary path using direct visual element extraction from story content
- Combines story-specific details (characters, objects, setting) with full art style definition
- All 8 art style properties systematically integrated into prompt
- Validation: Must contain specific character and pass art style keyword validation
- Usage: ~70% of prompts when story content contains clear visual elements

**Tier 2 - Advanced NER Analysis** (`generateAdvancedPrompt`)

- Advanced named entity recognition and narrative sequence analysis
- Full art style enforcement with sophisticated content extraction
- Validation: Must pass art style keyword validation
- Usage: ~20% of prompts when Tier 1 lacks sufficient visual elements

**Tier 3 - Enhanced Grade-Appropriate Fallback** (`generateEnhancedGradeAppropriatePrompt`)

- Basic story analysis with guaranteed art style enforcement (reference implementation)
- Used as fallback when Tier 1/2 validation fails
- Always passes validation by design
- Usage: ~10% of prompts, primarily as safety fallback

**Validation System** (`validatePromptStyleKeywords`):

- Validates presence of critical art style keywords from `ART_STYLE_MAPPING`
- Requirements: baseStyle (required) + 60% coverage of other properties
- Tracks matched/missing keywords for monitoring and improvement
- Triggers fallback regeneration on validation failure
- Telemetry tracking for continuous quality assessment

**Grade-Level Art Styles:**

- **K-2**: Watercolor children's book illustration with bright colors, simple shapes, whimsical tone
- **3-5**: Watercolor children's book illustration with vibrant colors, moderate detail, adventurous tone
- **6-8**: Watercolor illustration with sophisticated colors, high detail, heroic tone
- **9-12**: Sophisticated watercolor art with mature palette, complex composition, thoughtful tone

**Quality Assurance:**

- Comprehensive logging at each tier for monitoring and debugging
- Art style verification metrics tracked per generation
- Validation failure tracking with automatic telemetry
- Test coverage across all grade levels and prompt generation paths

### 4. Story Import & Management

**Location**: `src/services/storyImportService.ts`, `src/services/storyManagementService.ts`

- **Multi-Source Import**: Text files, Story_Quest platform, database stories
- **Metadata Extraction**: Automatic story analysis and categorization
- **Search & Filter**: Advanced story library management
- **Export Capabilities**: Story download and sharing functionality

### 5. XP & Gamification System

**Location**: `src/services/xpEventTracker.ts`, `src/services/analyticsService.ts`

- **Experience Points**: Earned through activities and story completion
- **Streak Tracking**: Daily writing streak maintenance
- **Achievement System**: Progress tracking and milestone rewards
- **Leaderboards**: XP and streak-based community rankings

### 6. Database Integration Layer

**Primary - Convex** (`src/services/convex.ts`, `convex/schema.ts`):

- **Real-time Queries**: Automatic UI updates when data changes
- **Type-safe Mutations**: Generated TypeScript for all functions
- **Auth Integration**: Native Clerk JWT verification
- **Tables**: `userProfiles`, `gameSessions`, `imageGenerationEvents`, `storyElements`, `storyDiversityScores`, `featureFlags`, `storyDownloadHistory`

**Fallback - Supabase** (`src/services/supabase.ts`, `src/types/database.ts`):

- **Row Level Security**: User data isolation for legacy users
- **Custom Functions**: Server-side business logic (RPC)
- **Migration System**: SQL files in `.agent/archive/sql/`

### 7. Claude Skills AI Enhancement System

**Location**: `src/services/claudeSkillsManager.ts`, `src/types/claudeSkills.ts`

- **Content Prediction**: Advanced story direction and content suggestions
- **Resource Optimization**: Dynamic performance tuning based on device capabilities
- **Quality Assessment**: Claude-powered content evaluation and adaptive thresholds
- **Behavior Analysis**: User interaction pattern recognition for personalization
- **Error Recovery**: Context-aware fallback and recovery strategies
- **Performance Monitoring**: Real-time execution tracking and optimization

### 8. Advanced Story Agent Architecture

**Location**: `src/services/storyAgent.ts`, `src/services/enhancedStoryAgent.ts`

- **Multi-Personality AI**: Creative writer, story partner, and educational guide modes
- **Adaptive Quality Assessment**: Claude Skills integration for dynamic content evaluation
- **Grade-Level Specialization**: Sophisticated content generation for K-2 through 9-12
- **Consistency Management**: Advanced story coherence and character continuity
- **Enhanced Fallback Systems**: Multi-layered content generation with themed templates
- **Educational Focus**: Curriculum-aligned content with positive theme integration

### 9. Onboarding System

**Location**: `src/services/onboardingService.ts`, `src/services/onboardingMilestoneTracker.ts`

The onboarding system provides a comprehensive new user experience with guided feature discovery, celebratory moments, and XP rewards to drive activation and engagement.

#### Architecture Overview

**Two-Layer Service Architecture**:

1. **OnboardingService** (`onboardingService.ts`) - Centralized singleton service:

   - Database integration via Supabase RPC functions
   - 1-minute cache TTL for onboarding status
   - XP reward processing and tracking
   - Celebration configuration management
   - Cross-device state sync via database

2. **OnboardingMilestoneTracker** (`onboardingMilestoneTracker.ts`) - Local tracking layer:
   - AsyncStorage-based milestone persistence
   - Feature tooltip visibility tracking
   - Checklist dismissal state
   - First story guidance modal state
   - Fast local reads with database fallback

#### Onboarding Milestones & XP Rewards

| Milestone                      | XP Reward  | Celebration                 |
| ------------------------------ | ---------- | --------------------------- |
| First Story Completed          | +50 XP     | 🎉 Modal with confetti      |
| First Image Generated          | +25 XP     | 🎨 Modal with animation     |
| First Voice Input Used         | +25 XP     | Silent (XP only)            |
| First Streak Achieved (2 days) | +50 XP     | 🔥 Modal with encouragement |
| **Total Onboarding XP**        | **150 XP** |                             |

#### Onboarding Components

**Location**: `src/components/onboarding/`, `src/components/common/`

| Component                  | Purpose                                              | Location      |
| -------------------------- | ---------------------------------------------------- | ------------- |
| `CelebrationModal`         | Celebratory overlay with animations for achievements | `common/`     |
| `FeatureTooltip`           | Contextual tooltips for feature discovery            | `common/`     |
| `OnboardingChecklist`      | Progress tracker with 5 items and XP rewards         | `onboarding/` |
| `OnboardingChecklistModal` | Settings-accessible modal wrapper for checklist      | `onboarding/` |
| `FirstStoryGuidanceModal`  | Explains collaborative AI storytelling for new users | `onboarding/` |
| `EnhancedEmptyState`       | Engaging HomeScreen empty state for new users        | `onboarding/` |

#### Feature Discovery Tooltips

The system includes three contextual tooltips that appear once per user on first encounter:

1. **Voice Input Tooltip** (US-013): "Tap to speak your story instead of typing"
2. **Image Generation Tooltip** (US-014): "AI creates illustrations matching your grade level!"
3. **XP/Challenges Tooltip** (US-015): "Complete challenges for bonus XP and level up!"

#### Key Service Methods

```typescript
// Processing milestones with XP and celebrations
await onboardingService.processFirstStoryCompletion(userId);
await onboardingService.processFirstImageGeneration(userId);
await onboardingService.processFirstVoiceInput(userId);
await onboardingService.processFirstStreakAchievement(userId);

// Progress tracking
const progress = await onboardingService.getOnboardingProgress(userId);
const isComplete = await onboardingService.isOnboardingComplete(userId);

// Tooltip management
const shouldShow = await onboardingService.shouldShowTooltip('voiceInput');
await onboardingService.markTooltipShown('imageGeneration');

// Database sync
await onboardingService.syncToDatabase(userId);
```

#### Database Integration

The onboarding system uses three database functions (see `database_schema.md`):

- `update_onboarding_progress_item()` - Update individual checklist items
- `record_onboarding_milestone()` - Record achievements with timestamps and XP
- `get_onboarding_status()` - Retrieve complete onboarding status with completion percentage

#### State Flow

```
User Action → MilestoneTracker (AsyncStorage) → OnboardingService → Database RPC
                       ↓                                ↓
              Local Cache Update              Supabase user_profiles
                       ↓                                ↓
              UI Component Update ← ← ← ← ← Cache Invalidation
```

### 10. Convex Backend System

**Location**: `convex/`, `src/services/convex.ts`

The Convex backend provides the primary data layer for OAuth users, offering real-time capabilities and native Clerk integration.

#### Convex Tables (Schema: `convex/schema.ts`)

| Table                   | Purpose                   | Key Fields                                                      |
| ----------------------- | ------------------------- | --------------------------------------------------------------- |
| `userProfiles`          | User accounts and stats   | `clerkUserId`, `totalXp`, `currentStreak`, `onboardingProgress` |
| `gameSessions`          | Story writing sessions    | `userId`, `clerkUserId`, `storyContent`, `storageId`            |
| `imageGenerationEvents` | Image generation tracking | `userId`, `xpCost`, `generationStatus`, `serviceUsed`           |
| `storyElements`         | Story diversity tracking  | `storyId`, `elementType`, `embeddingVector`                     |
| `storyDiversityScores`  | Diversity analytics       | `storyId`, `diversityScore`, `novelElementCount`                |
| `featureFlags`          | Feature configuration     | `featureName`, `enabled`, `config`                              |
| `storyDownloadHistory`  | Download tracking         | `userId`, `downloadMethod`, `storyMetadata`                     |

#### Convex Functions

**User Profiles** (`convex/userProfiles.ts`):

- `createOAuthProfile` - Create profile for new OAuth users
- `getProfileByClerkId` - Fetch profile by Clerk ID
- `addUserXp` / `deductUserXp` / `refundUserXp` - XP operations
- `updateStreak` - Daily streak management
- `getLeaderboard` - XP leaderboard

**Game Sessions** (`convex/gameSessions.ts`):

- `createSession` / `createStoryContinuationSession` - Session creation
- `updateSession` / `completeSession` - Session management
- `searchUserStories` - Full-text story search
- `getStoryLibrary` - Filtered/sorted story listing

**Image Generation** (`convex/imageGeneration.ts`):

- `createImageGenerationEvent` - Start tracking with XP deduction
- `updateImageGenerationEvent` - Status updates with auto-refund
- `getImageGenerationAnalytics` - Aggregated statistics

**Onboarding** (`convex/onboarding.ts`):

- `recordOnboardingMilestone` - Record milestone with XP reward
- `getOnboardingStatus` - Full onboarding state

**Storage** (`convex/storage.ts`):

- `generateUploadUrl` - Presigned URL for client uploads
- `uploadFromUrl` - Server-side image migration
- `getSessionImageUrl` - Image URL retrieval

#### Data Flow: OAuth User

```
User Action → React Component → Convex Mutation → Convex DB
                    ↓                    ↓
            Real-time Query ← ← ← Automatic Update
```

#### Data Flow: Legacy Email/Password User

```
User Action → React Component → Supabase RPC → PostgreSQL
                    ↓                    ↓
              Manual Refresh ← ← ← Response
```

## Integration Points

### External Services

1. **Convex Backend** (PRIMARY for OAuth users)

   - Real-time database with automatic subscriptions
   - Native Clerk JWT authentication
   - Convex Storage for image persistence
   - TypeScript-first API with generated types

2. **Supabase Backend** (FALLBACK for legacy users)

   - PostgreSQL database with RLS
   - Email/password authentication
   - Feature flags and configuration
   - Maintained for backward compatibility

3. **Clerk Authentication**

   - OAuth providers (Google/Apple)
   - JWT issuance for Convex verification
   - User identity management
   - `ConvexProviderWithClerk` integration

4. **OpenAI Integration**

   - GPT-4 Turbo for story generation
   - Custom React Native-compatible client
   - Rate limiting and error handling
   - Content moderation and safety checks

5. **Replicate AI Platform**

   - Stable Diffusion 3.5 Large for image generation
   - Webhook support for async processing
   - Cost tracking and usage analytics
   - Fallback service integration

6. **Claude Skills SDK**
   - Advanced AI capabilities for content optimization
   - Performance monitoring and adaptive thresholds
   - Quality assessment and behavior analysis
   - Cross-platform React Native integration
   - Real-time execution tracking and metrics

### Device Integrations

- **File System Access**: Document picker and file operations
- **Voice Features**: Speech-to-text input and text-to-speech output
- **Device Information**: Platform detection and capability checking
- **Permissions Management**: Runtime permission handling

## Data Flow Architecture

### Story Creation Flow

1. **User Input** → Validation & Grade-level Filtering
2. **AI Processing** → OpenAI API with context management
3. **Content Verification** → Safety checks and age-appropriateness
4. **Database Storage** → Supabase with real-time sync
5. **UI Update** → Real-time story display with animations

### Image Generation Flow

1. **User Request** → XP validation and cost deduction
2. **Content Analysis** → Story context extraction for prompts
3. **AI Processing** → Replicate API with fallback handling
4. **Result Processing** → Image optimization and storage
5. **XP Transaction** → Success/failure XP management

### Authentication Flow

1. **User Credentials** → Supabase authentication
2. **Email Verification** → Confirmation workflow
3. **Session Creation** → Token management and storage
4. **Profile Setup** → User preferences and initial data
5. **Deep Link Handling** → Email confirmation redirects

## Security Architecture

### Data Protection

- **Row Level Security (RLS)**: Database-level user isolation
- **Input Validation**: Comprehensive sanitization at all entry points
- **API Key Management**: Secure storage and rotation capabilities
- **Content Filtering**: Age-appropriate content enforcement

### Privacy Measures

- **User Data Isolation**: Personal data access restricted by user ID
- **Audit Logging**: Comprehensive activity tracking
- **Secure Storage**: Encrypted local storage for sensitive data
- **Permission Management**: Granular device permission handling

## Performance Considerations

### Optimization Strategies

- **Request Limiting**: Configurable concurrent request limits
- **Caching System**: Local storage for frequently accessed data
- **Lazy Loading**: Component and data loading optimization
- **Error Boundaries**: Graceful failure handling

### Monitoring & Analytics

- **Performance Tracking**: Response times and error rates
- **User Analytics**: Behavior patterns and feature usage
- **Cost Tracking**: AI service usage and optimization
- **Error Reporting**: Comprehensive error logging and analysis

## Development Environment

### Build Configuration

- **Metro Configuration**: Custom bundler settings for React Native
- **TypeScript Config**: Strict type checking with comprehensive coverage
- **ESLint & Prettier**: Code quality and formatting enforcement
- **Jest Testing**: Unit, integration, and acceptance test suites

### Deployment Pipeline

- **iOS Build**: Xcode project with CocoaPods dependencies
- **Android Build**: Gradle build system with native dependencies
- **Code Quality**: Pre-commit hooks with linting and testing
- **Environment Management**: Separate development, staging, and production configs

## Related Documentation

- [Database Schema](./database_schema.md) - Detailed database structure and relationships
- [API Integration Guide](./api_integration.md) - External service integration patterns
- [Development SOPs](./SOPs/) - Best practices for common development tasks

---

**Last Updated**: February 2026
**Version**: 1.1
**Maintainer**: Development Team
