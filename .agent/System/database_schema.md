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
    bio TEXT
);
```

**Key Features**:
- Links to Supabase Auth system
- Comprehensive XP and achievement tracking
- Grade-level preferences for content appropriateness
- Activity streak management
- User customization options

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

## Feature Management Tables

### 4. feature_flags
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

### 5. beta_users
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

### 6. feature_access_logs
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

### Feature Management Functions

#### 5. add_beta_user()
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

#### 6. update_rollout_percentage()
```sql
CREATE OR REPLACE FUNCTION update_rollout_percentage(
    p_feature_name TEXT,
    p_new_percentage INTEGER,
    p_updated_by TEXT DEFAULT 'admin'
)
RETURNS BOOLEAN
```
**Purpose**: Updates feature rollout percentages with logging.

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

-- Game session queries
CREATE INDEX idx_game_sessions_user_completed ON game_sessions (user_id, completed_at DESC);
CREATE INDEX idx_game_sessions_image_generation ON game_sessions (image_generation_timestamp DESC);

-- Image generation analytics
CREATE INDEX idx_image_generation_events_timestamp ON image_generation_events (request_timestamp DESC);
CREATE INDEX idx_image_generation_events_status ON image_generation_events (status, completion_timestamp);

-- Feature flag lookups
CREATE INDEX idx_feature_flags_name ON feature_flags (feature_name);
CREATE INDEX idx_beta_users_user_feature ON beta_users (user_id, feature_name);
```

## Migration Strategy

### Database Migration Files
Located in `/sql/` directory:

1. **minimal_feature_setup.sql** - Feature management infrastructure
2. **add_image_generation_fields.sql** - Image generation support
3. **add_story_continuation_fields.sql** - Story import/continuation support
4. **create_image_generation_events_table.sql** - Comprehensive image tracking
5. **fix_streak_function_ambiguity.sql** - User streak calculation fixes

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

**Last Updated**: November 2024  
**Version**: 1.0  
**Schema Version**: 1.2.0  
**Maintainer**: Development Team