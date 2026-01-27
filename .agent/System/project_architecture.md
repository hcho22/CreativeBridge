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

- **Supabase** (PostgreSQL) - Primary backend service
- Real-time subscriptions and Row Level Security (RLS)
- Custom database functions for business logic
- Comprehensive audit logging and analytics

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

**Location**: `src/context/AuthContext.tsx`, `src/services/supabase.ts`

- Supabase-powered email/password authentication
- Email confirmation workflow
- Automatic session management with token refresh
- Deep link handling for email confirmations
- Remember Me functionality with secure storage

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
4. **artisticTechnique**: Rendering style (watercolor, digital painting, realistic art)
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
- **3-5**: Detailed digital illustration with vibrant colors, moderate detail, adventurous tone
- **6-8**: Realistic digital art with sophisticated colors, high detail, heroic tone
- **9-12**: Sophisticated digital painting with mature palette, complex composition, thoughtful tone

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

**Location**: `src/services/supabase.ts`, `src/types/database.ts`

- **Real-time Sync**: Live data updates across devices
- **Row Level Security**: User data isolation and privacy
- **Custom Functions**: Server-side business logic
- **Migration System**: Structured database evolution

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

## Integration Points

### External Services

1. **Supabase Backend**

   - Authentication service
   - PostgreSQL database with real-time features
   - File storage capabilities
   - Edge functions for server-side logic

2. **OpenAI Integration**

   - GPT-4 Turbo for story generation
   - Custom React Native-compatible client
   - Rate limiting and error handling
   - Content moderation and safety checks

3. **Replicate AI Platform**

   - Stable Diffusion 3.5 Large for image generation
   - Webhook support for async processing
   - Cost tracking and usage analytics
   - Fallback service integration

4. **Claude Skills SDK**
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

**Last Updated**: November 2024  
**Version**: 1.0  
**Maintainer**: Development Team
