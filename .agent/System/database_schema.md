# CreativeBridge - Database Schema Documentation

## Overview

CreativeBridge uses **Supabase** (PostgreSQL) as its primary backend database, providing real-time capabilities, Row Level Security (RLS), and comprehensive user management. The schema is designed to support educational storytelling with AI integration, user gamification, and comprehensive analytics.

## Core Tables

### 1. user_profiles

**Purpose**: Comprehensive user management with gamification and preferences

```sql
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Gamification
    total_xp INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_activity_date DATE,

    -- Statistics
    best_score INTEGER DEFAULT 0,
    total_games_played INTEGER DEFAULT 0,
    total_stories_completed INTEGER DEFAULT 0,
    total_words_written INTEGER DEFAULT 0,

    -- User Preferences
    preferred_grade_level grade_level_enum DEFAULT 'K-2',
    speech_enabled BOOLEAN DEFAULT true,

    -- Profile (Optional)
    avatar_url TEXT,
    bio TEXT,

    -- Onboarding Progress (US-007)
    onboarding_completed BOOLEAN DEFAULT false,
    onboarding_progress JSONB DEFAULT '{"create_account": true, "first_story": false, "first_image": false, "first_voice": false, "first_streak": false}',
    first_story_completed_at TIMESTAMP WITH TIME ZONE,
    first_image_generated_at TIMESTAMP WITH TIME ZONE,
    first_voice_input_at TIMESTAMP WITH TIME ZONE,
    first_streak_achieved_at TIMESTAMP WITH TIME ZONE
);
```

**Key Features**:

- Links to Supabase Auth system
- Comprehensive XP and achievement tracking
- Grade-level preferences for content appropriateness
- Activity streak management
- User customization options
- Onboarding progress tracking with milestone timestamps

### 2. game_sessions

**Purpose**: Story sessions with comprehensive metadata and AI integration

```sql
CREATE TABLE game_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,

    -- Game Metadata
    grade_level grade_level_enum NOT NULL,
    final_score INTEGER DEFAULT 0,
    words_written INTEGER DEFAULT 0,
    sentences_completed INTEGER DEFAULT 0,
    challenges_completed INTEGER DEFAULT 0,
    xp_earned INTEGER DEFAULT 0,

    -- Story Content
    story_content TEXT,

    -- Story Import/Continuation Support
    imported_story_content TEXT,
    story_source story_source_enum DEFAULT 'New',
    original_creation_date TIMESTAMP WITH TIME ZONE,
    story_metadata JSONB DEFAULT '{}',

    -- AI Image Generation
    generated_image_url TEXT,
    image_generation_timestamp TIMESTAMP WITH TIME ZONE,
    image_generation_cost INTEGER DEFAULT 1000
);
```

**Key Features**:

- Multi-source story support (New, CreativeBridge, Story_Quest, File)
- Comprehensive game statistics tracking
- AI image generation integration with cost tracking
- Flexible metadata storage with JSONB
- Progress tracking and completion analytics

### 3. image_generation_events

**Purpose**: Detailed tracking of AI image generation requests and analytics

```sql
CREATE TABLE image_generation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id) NOT NULL,
    session_id UUID REFERENCES game_sessions(id),

    -- Request Details
    prompt_text TEXT NOT NULL,
    grade_level grade_level_enum NOT NULL,
    service_used TEXT NOT NULL, -- 'replicate_primary', 'replicate_backup', etc.

    -- Result Tracking
    status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed', 'timeout')),
    image_url TEXT,
    error_message TEXT,

    -- Performance Metrics
    request_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completion_timestamp TIMESTAMP WITH TIME ZONE,
    response_time_ms INTEGER,

    -- Cost and XP Management
    xp_cost INTEGER DEFAULT 1000,
    xp_refunded BOOLEAN DEFAULT false,
    refund_reason TEXT,

    -- Technical Details
    request_id TEXT,
    service_response JSONB DEFAULT '{}',
    retry_count INTEGER DEFAULT 0
);
```

**Key Features**:

- Complete audit trail for image generation
- Multi-service tracking with fallback support
- Performance monitoring and analytics
- XP cost tracking with refund mechanisms
- Error tracking and retry logic

## Story Diversity Tables

### 4. story_elements

**Purpose**: Store extracted story elements with embeddings for diversity tracking

```sql
CREATE TABLE story_elements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    session_id UUID NOT NULL,

    -- Element classification
    element_type TEXT NOT NULL CHECK (element_type IN ('character', 'setting', 'object', 'plot_pattern')),
    element_text TEXT NOT NULL,

    -- Semantic embedding for similarity matching
    embedding_vector JSONB,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Key Features**:

- Tracks characters, settings, objects, and plot patterns from generated stories
- Stores semantic embeddings (JSONB) for similarity detection
- Scoped to user sessions for diversity tracking (24-hour windows)
- Enables detection of repetitive story elements
- Supports semantic similarity matching via cosine similarity

### 5. user_sessions

**Purpose**: Track user sessions for scoping story diversity (24-hour windows)

```sql
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_token TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    metadata JSONB DEFAULT '{}'
);
```

**Key Features**:

- 24-hour session windows for diversity tracking
- Links to authenticated users (optional)
- Automatic expiration management
- Flexible metadata storage for session context

### 6. story_diversity_scores

**Purpose**: Store calculated diversity scores for analytics and monitoring

```sql
CREATE TABLE story_diversity_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,

    diversity_score NUMERIC(5, 3) NOT NULL CHECK (diversity_score >= 0 AND diversity_score <= 1.0),
    novel_element_count INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);
```

**Key Features**:

- Quantitative diversity measurement (0.0 - 1.0 scale)
- Tracks novel element count per story
- Low diversity alerts (< 0.4 threshold)
- One score per story (unique constraint)
- Supports analytics and monitoring

## Feature Management Tables

### 7. feature_flags

**Purpose**: Remote configuration and gradual rollout control

```sql
CREATE TABLE feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_name TEXT UNIQUE NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by TEXT,
    description TEXT
);
```

**Configuration Example**:

```json
{
  "rolloutPercentage": 25,
  "requiresWhitelist": true,
  "maxDailyGenerations": 5,
  "allowedGradeLevels": ["K-2", "3-5", "6-8", "9-12"],
  "xpCost": 1000,
  "enabledServices": ["replicate_primary", "replicate_backup"]
}
```

### 8. beta_users

**Purpose**: Beta testing user management for gradual feature rollout

```sql
CREATE TABLE beta_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    feature_name TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    added_by TEXT,
    removed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,

    UNIQUE(user_id, feature_name)
);
```

### 9. feature_access_logs

**Purpose**: Analytics and monitoring of feature flag evaluations

```sql
CREATE TABLE feature_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    feature_name TEXT NOT NULL,
    access_granted BOOLEAN NOT NULL,
    access_reason TEXT,
    user_context JSONB DEFAULT '{}',
    rollout_percentage INTEGER,
    conditions_met BOOLEAN,
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Enums and Types

### Grade Level Enum

```sql
CREATE TYPE grade_level_enum AS ENUM ('K-2', '3-5', '6-8', '9-12');
```

**Purpose**: Ensures consistent grade level categorization across the system.

### Story Source Enum

```sql
CREATE TYPE story_source_enum AS ENUM ('New', 'CreativeBridge', 'Story_Quest', 'File');
```

**Purpose**: Tracks the origin of stories for analytics and import workflows.

## Database Functions

### User Management Functions

#### 1. update_user_streak()

```sql
CREATE OR REPLACE FUNCTION update_user_streak(p_user_id UUID)
RETURNS BOOLEAN
```

**Purpose**: Automatically manages daily writing streaks based on activity.

#### 2. add_xp_to_user()

```sql
CREATE OR REPLACE FUNCTION add_xp_to_user(
    p_user_id UUID,
    p_xp_amount INTEGER,
    p_reason TEXT
)
RETURNS BOOLEAN
```

**Purpose**: Safely adds XP to users with validation and logging.

### Story Management Functions

#### 3. update_story_generated_image()

```sql
CREATE OR REPLACE FUNCTION update_story_generated_image(
    p_session_id UUID,
    p_image_url TEXT,
    p_generation_cost INTEGER DEFAULT 1000
)
RETURNS BOOLEAN
```

**Purpose**: Updates game sessions with generated image information.

#### 4. get_user_stories_with_images()

```sql
CREATE OR REPLACE FUNCTION get_user_stories_with_images(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(...)
```

**Purpose**: Retrieves user's completed stories with generated images.

### Story Diversity Functions

#### 5. get_or_create_session()

```sql
CREATE OR REPLACE FUNCTION get_or_create_session(
    p_session_token TEXT,
    p_user_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
```

**Purpose**: Retrieves existing valid session or creates new one with 24-hour expiration.

#### 6. cleanup_expired_sessions()

```sql
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER
```

**Purpose**: Removes expired sessions (should be run periodically via cron/scheduler).

### Feature Management Functions

#### 7. add_beta_user()

```sql
CREATE OR REPLACE FUNCTION add_beta_user(
    p_user_id UUID,
    p_feature_name TEXT,
    p_added_by TEXT DEFAULT 'admin',
    p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
```

**Purpose**: Adds users to beta testing programs for feature rollouts.

#### 8. update_rollout_percentage()

```sql
CREATE OR REPLACE FUNCTION update_rollout_percentage(
    p_feature_name TEXT,
    p_new_percentage INTEGER,
    p_updated_by TEXT DEFAULT 'admin'
)
RETURNS BOOLEAN
```

**Purpose**: Updates feature rollout percentages with logging.

### Onboarding Functions (US-007)

#### 9. update_onboarding_progress_item()

```sql
CREATE OR REPLACE FUNCTION update_onboarding_progress_item(
    p_user_id UUID,
    p_item_key TEXT,
    p_completed BOOLEAN DEFAULT true
)
RETURNS BOOLEAN
```

**Purpose**: Updates a specific onboarding checklist item. Valid keys: `create_account`, `first_story`, `first_image`, `first_voice`, `first_streak`. Auto-marks `onboarding_completed` when all items are done.

#### 10. record_onboarding_milestone()

```sql
CREATE OR REPLACE FUNCTION record_onboarding_milestone(
    p_user_id UUID,
    p_milestone_type TEXT,
    p_xp_reward INTEGER DEFAULT 0
)
RETURNS BOOLEAN
```

**Purpose**: Records first-time milestone achievement with timestamp and optional XP award. Valid types: `first_story`, `first_image`, `first_voice`, `first_streak`. Idempotent - returns false if milestone already achieved.

#### 11. get_onboarding_status()

```sql
CREATE OR REPLACE FUNCTION get_onboarding_status(p_user_id UUID)
RETURNS TABLE(
    onboarding_completed BOOLEAN,
    onboarding_progress JSONB,
    first_story_completed_at TIMESTAMP WITH TIME ZONE,
    first_image_generated_at TIMESTAMP WITH TIME ZONE,
    first_voice_input_at TIMESTAMP WITH TIME ZONE,
    first_streak_achieved_at TIMESTAMP WITH TIME ZONE,
    completion_percentage INTEGER
)
```

**Purpose**: Returns complete onboarding status for a user, including progress percentage (0-100).

## Views and Analytics

### 1. leaderboard_xp

```sql
CREATE VIEW leaderboard_xp AS
SELECT
    username,
    display_name,
    total_xp,
    total_games_played,
    created_at,
    ROW_NUMBER() OVER (ORDER BY total_xp DESC, created_at ASC) as rank
FROM user_profiles
WHERE total_xp > 0
ORDER BY total_xp DESC, created_at ASC;
```

### 2. leaderboard_streak

```sql
CREATE VIEW leaderboard_streak AS
SELECT
    username,
    display_name,
    longest_streak,
    current_streak,
    created_at,
    ROW_NUMBER() OVER (ORDER BY longest_streak DESC, current_streak DESC, created_at ASC) as rank
FROM user_profiles
WHERE longest_streak > 0
ORDER BY longest_streak DESC, current_streak DESC, created_at ASC;
```

### 3. image_generation_analytics

```sql
CREATE VIEW image_generation_analytics AS
SELECT
    DATE_TRUNC('day', image_generation_timestamp) as generation_date,
    COUNT(*) as images_generated,
    AVG(image_generation_cost) as avg_cost,
    COUNT(DISTINCT user_id) as unique_users
FROM game_sessions
WHERE generated_image_url IS NOT NULL
  AND image_generation_timestamp IS NOT NULL
GROUP BY DATE_TRUNC('day', image_generation_timestamp)
ORDER BY generation_date DESC;
```

## Row Level Security (RLS) Policies

### User Data Protection

All tables implement comprehensive RLS policies:

```sql
-- Users can only access their own profile data
CREATE POLICY "user_profiles_own_data" ON user_profiles
    FOR ALL USING (auth.uid() = id);

-- Users can only access their own game sessions
CREATE POLICY "game_sessions_own_data" ON game_sessions
    FOR ALL USING (auth.uid() = user_id);

-- Users can only access their own image generation events
CREATE POLICY "image_generation_events_own_data" ON image_generation_events
    FOR ALL USING (auth.uid() = user_id);
```

### Story Diversity Security

```sql
-- Users can only access elements from their own stories
CREATE POLICY "story_elements_select_own_data" ON story_elements
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM game_sessions
            WHERE id = story_id AND user_id = auth.uid()
        )
    );

-- Users can manage their own sessions
CREATE POLICY "user_sessions_select_own_data" ON user_sessions
    FOR SELECT USING (user_id IS NULL OR user_id = auth.uid());

-- Users can only access diversity scores for their own stories
CREATE POLICY "story_diversity_scores_select_own_data" ON story_diversity_scores
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM game_sessions
            WHERE id = story_id AND user_id = auth.uid()
        )
    );
```

### Feature Flag Security

```sql
-- Feature flags are readable by all authenticated users
CREATE POLICY "feature_flags_read_policy" ON feature_flags
    FOR SELECT USING (true);

-- Beta users can see their own status
CREATE POLICY "beta_users_read_own" ON beta_users
    FOR SELECT USING (auth.uid() = user_id);
```

## Indexes for Performance

### Primary Performance Indexes

```sql
-- User activity tracking
CREATE INDEX idx_user_profiles_last_activity ON user_profiles (last_activity_date DESC);
CREATE INDEX idx_user_profiles_total_xp ON user_profiles (total_xp DESC);

-- Onboarding progress tracking (US-007)
CREATE INDEX idx_user_profiles_onboarding_completed ON user_profiles (onboarding_completed) WHERE onboarding_completed = false;
CREATE INDEX idx_user_profiles_first_story_completed_at ON user_profiles (first_story_completed_at DESC) WHERE first_story_completed_at IS NOT NULL;

-- Game session queries
CREATE INDEX idx_game_sessions_user_completed ON game_sessions (user_id, completed_at DESC);
CREATE INDEX idx_game_sessions_image_generation ON game_sessions (image_generation_timestamp DESC);

-- Image generation analytics
CREATE INDEX idx_image_generation_events_timestamp ON image_generation_events (request_timestamp DESC);
CREATE INDEX idx_image_generation_events_status ON image_generation_events (status, completion_timestamp);

-- Feature flag lookups
CREATE INDEX idx_feature_flags_name ON feature_flags (feature_name);
CREATE INDEX idx_beta_users_user_feature ON beta_users (user_id, feature_name);

-- Story diversity element lookups
CREATE INDEX idx_story_elements_session_id_created_at ON story_elements (session_id, created_at DESC);
CREATE INDEX idx_story_elements_story_id ON story_elements (story_id);
CREATE INDEX idx_story_elements_session_type_created ON story_elements (session_id, element_type, created_at DESC);

-- User session management
CREATE INDEX idx_user_sessions_session_token ON user_sessions (session_token);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions (expires_at);

-- Diversity score analytics
CREATE INDEX idx_story_diversity_scores_story_id ON story_diversity_scores (story_id);
CREATE INDEX idx_story_diversity_scores_diversity_score ON story_diversity_scores (diversity_score);
CREATE INDEX idx_story_diversity_scores_low_scores ON story_diversity_scores (diversity_score, created_at DESC) WHERE diversity_score < 0.4;
```

## Migration Strategy

### Database Migration Files

Located in `/sql/` directory:

1. **minimal_feature_setup.sql** - Feature management infrastructure
2. **add_image_generation_fields.sql** - Image generation support
3. **add_story_continuation_fields.sql** - Story import/continuation support
4. **create_image_generation_events_table.sql** - Comprehensive image tracking
5. **fix_streak_function_ambiguity.sql** - User streak calculation fixes
6. **create_story_diversity_tables.sql** - Story diversity tracking system (US-001)
7. **add_onboarding_progress_fields.sql** - Onboarding progress tracking (US-007)

### Migration Best Practices

- All migrations include rollback procedures
- Comprehensive validation and constraint checking
- Performance impact assessment for large tables
- RLS policy updates with proper testing

## Database Performance Considerations

### Query Optimization

- Strategic indexing on frequently queried columns
- Efficient JSONB queries for metadata searches
- Pagination support for large datasets
- View optimization for analytics queries

### Monitoring and Analytics

- Comprehensive tracking of all user interactions
- Performance metrics for AI service integration
- Feature usage analytics for rollout decisions
- Error tracking and debugging support

## Security Features

### Data Protection

- Row Level Security on all user data
- Encrypted storage for sensitive information
- Comprehensive audit logging
- Input validation at database level

### Access Control

- Role-based permissions for different user types
- Function-level security with SECURITY DEFINER
- API key management and rotation support
- Rate limiting at database level

## Related Documentation

- [Project Architecture](./project_architecture.md) - Overall system design and integration points
- [API Integration Guide](./api_integration.md) - External service integration patterns
- [Development SOPs](./SOPs/) - Database migration and maintenance procedures

---

**Last Updated**: February 2025
**Version**: 1.1
**Schema Version**: 1.3.0
**Maintainer**: Development Team
