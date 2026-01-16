-- Migration Script: Create Story Diversity Tracking System
-- This script creates tables for tracking story elements, sessions, and diversity scores
-- to reduce repetition and increase creative variety in AI-generated stories.
-- Created: 2026-01-13
-- Feature: Story Agent Diversity Improvement (US-001)

-- ===================================================================
-- Table 1: story_elements
-- Purpose: Store extracted story elements (characters, settings, objects, plot patterns)
-- with their embeddings for semantic similarity matching
-- ===================================================================

CREATE TABLE IF NOT EXISTS public.story_elements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
    session_id UUID NOT NULL, -- References user_sessions table (created below)

    -- Element classification
    element_type TEXT NOT NULL CHECK (element_type IN ('character', 'setting', 'object', 'plot_pattern')),
    element_text TEXT NOT NULL, -- Normalized element text (lowercase, singular)

    -- Semantic embedding for similarity matching
    -- Using JSONB to store embedding vectors (array of floats)
    -- PostgreSQL vector extension could be used in future for better performance
    embedding_vector JSONB, -- Array of numbers representing text embedding

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CONSTRAINT check_element_text_not_empty CHECK (LENGTH(TRIM(element_text)) > 0),
    CONSTRAINT check_element_text_length CHECK (LENGTH(element_text) <= 500)
);

-- Comments for documentation
COMMENT ON TABLE public.story_elements IS 'Stores extracted story elements with embeddings for diversity tracking';
COMMENT ON COLUMN public.story_elements.story_id IS 'Game session (story) from which element was extracted';
COMMENT ON COLUMN public.story_elements.session_id IS 'User session ID for scoping diversity tracking';
COMMENT ON COLUMN public.story_elements.element_type IS 'Type of element: character, setting, object, or plot_pattern';
COMMENT ON COLUMN public.story_elements.element_text IS 'Normalized element text (lowercase, singular form)';
COMMENT ON COLUMN public.story_elements.embedding_vector IS 'Semantic embedding vector stored as JSONB array';
COMMENT ON COLUMN public.story_elements.created_at IS 'When the element was extracted and stored';

-- Indexes for optimal query performance
CREATE INDEX IF NOT EXISTS idx_story_elements_session_id_created_at
    ON public.story_elements(session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_story_elements_story_id
    ON public.story_elements(story_id);

CREATE INDEX IF NOT EXISTS idx_story_elements_element_type
    ON public.story_elements(element_type);

CREATE INDEX IF NOT EXISTS idx_story_elements_created_at
    ON public.story_elements(created_at DESC);

-- GIN index for JSONB embedding queries (if needed for filtering)
CREATE INDEX IF NOT EXISTS idx_story_elements_embedding
    ON public.story_elements USING GIN(embedding_vector);

-- Compound index for common queries (session + type + recent)
CREATE INDEX IF NOT EXISTS idx_story_elements_session_type_created
    ON public.story_elements(session_id, element_type, created_at DESC);


-- ===================================================================
-- Table 2: user_sessions
-- Purpose: Track user sessions for scoping story diversity (24-hour windows)
-- ===================================================================

CREATE TABLE IF NOT EXISTS public.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_token TEXT UNIQUE NOT NULL, -- Unique session identifier (from cookie/auth)
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Optional: link to authenticated user

    -- Session lifecycle
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL, -- 24 hours from creation

    -- Session metadata
    metadata JSONB DEFAULT '{}', -- Flexible storage for session info

    -- Constraints
    CONSTRAINT check_expires_after_created CHECK (expires_at > created_at)
);

-- Comments for documentation
COMMENT ON TABLE public.user_sessions IS 'Tracks user sessions for scoping diversity tracking (24-hour windows)';
COMMENT ON COLUMN public.user_sessions.session_token IS 'Unique session identifier from cookie or auth token';
COMMENT ON COLUMN public.user_sessions.user_id IS 'Optional reference to authenticated user';
COMMENT ON COLUMN public.user_sessions.created_at IS 'When the session was created';
COMMENT ON COLUMN public.user_sessions.expires_at IS 'When the session expires (24 hours from creation)';
COMMENT ON COLUMN public.user_sessions.metadata IS 'Additional session metadata (user agent, device info, etc.)';

-- Indexes for session management
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_token
    ON public.user_sessions(session_token);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id
    ON public.user_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at
    ON public.user_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_user_sessions_created_at
    ON public.user_sessions(created_at DESC);


-- ===================================================================
-- Table 3: story_diversity_scores
-- Purpose: Store calculated diversity scores for each story
-- ===================================================================

CREATE TABLE IF NOT EXISTS public.story_diversity_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,

    -- Diversity metrics
    diversity_score NUMERIC(5, 3) NOT NULL CHECK (diversity_score >= 0 AND diversity_score <= 1.0),
    novel_element_count INTEGER NOT NULL DEFAULT 0,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Additional analytics
    metadata JSONB DEFAULT '{}', -- Total elements, repeated elements, etc.

    -- Constraints
    CONSTRAINT check_novel_count_non_negative CHECK (novel_element_count >= 0),
    CONSTRAINT unique_story_diversity_score UNIQUE(story_id) -- One score per story
);

-- Comments for documentation
COMMENT ON TABLE public.story_diversity_scores IS 'Stores calculated diversity scores for analytics and monitoring';
COMMENT ON COLUMN public.story_diversity_scores.story_id IS 'Game session (story) being scored';
COMMENT ON COLUMN public.story_diversity_scores.diversity_score IS 'Diversity score between 0.0 (repetitive) and 1.0 (novel)';
COMMENT ON COLUMN public.story_diversity_scores.novel_element_count IS 'Number of novel elements (no similar match in recent history)';
COMMENT ON COLUMN public.story_diversity_scores.created_at IS 'When the diversity score was calculated';
COMMENT ON COLUMN public.story_diversity_scores.metadata IS 'Additional metrics: total_elements, repeated_elements, etc.';

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_story_diversity_scores_story_id
    ON public.story_diversity_scores(story_id);

CREATE INDEX IF NOT EXISTS idx_story_diversity_scores_diversity_score
    ON public.story_diversity_scores(diversity_score);

CREATE INDEX IF NOT EXISTS idx_story_diversity_scores_created_at
    ON public.story_diversity_scores(created_at DESC);

-- Compound index for low diversity alerts
CREATE INDEX IF NOT EXISTS idx_story_diversity_scores_low_scores
    ON public.story_diversity_scores(diversity_score, created_at DESC)
    WHERE diversity_score < 0.4;

-- GIN index for metadata queries
CREATE INDEX IF NOT EXISTS idx_story_diversity_scores_metadata
    ON public.story_diversity_scores USING GIN(metadata);


-- ===================================================================
-- Row Level Security (RLS) Policies
-- ===================================================================

-- Enable RLS on all tables
ALTER TABLE public.story_elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_diversity_scores ENABLE ROW LEVEL SECURITY;

-- story_elements policies: Users can only access elements from their own stories
CREATE POLICY "story_elements_insert_own_data"
ON public.story_elements FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.game_sessions
        WHERE id = story_id
        AND user_id = auth.uid()
    )
);

CREATE POLICY "story_elements_select_own_data"
ON public.story_elements FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.game_sessions
        WHERE id = story_id
        AND user_id = auth.uid()
    )
);

-- user_sessions policies: Users can manage their own sessions
CREATE POLICY "user_sessions_insert_own_data"
ON public.user_sessions FOR INSERT
WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "user_sessions_select_own_data"
ON public.user_sessions FOR SELECT
USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "user_sessions_update_own_data"
ON public.user_sessions FOR UPDATE
USING (user_id IS NULL OR user_id = auth.uid())
WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- story_diversity_scores policies: Users can only access scores for their own stories
CREATE POLICY "story_diversity_scores_insert_own_data"
ON public.story_diversity_scores FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.game_sessions
        WHERE id = story_id
        AND user_id = auth.uid()
    )
);

CREATE POLICY "story_diversity_scores_select_own_data"
ON public.story_diversity_scores FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.game_sessions
        WHERE id = story_id
        AND user_id = auth.uid()
    )
);


-- ===================================================================
-- Helper Functions
-- ===================================================================

-- Function to create or retrieve a user session
CREATE OR REPLACE FUNCTION get_or_create_session(
    p_session_token TEXT,
    p_user_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    v_session_id UUID;
    v_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Check for existing valid session
    SELECT id, expires_at INTO v_session_id, v_expires_at
    FROM public.user_sessions
    WHERE session_token = p_session_token
    AND expires_at > NOW();

    -- If valid session exists, return it
    IF v_session_id IS NOT NULL THEN
        RETURN v_session_id;
    END IF;

    -- Create new session with 24-hour expiration
    INSERT INTO public.user_sessions (
        session_token,
        user_id,
        expires_at,
        metadata
    ) VALUES (
        p_session_token,
        p_user_id,
        NOW() + INTERVAL '24 hours',
        p_metadata
    ) RETURNING id INTO v_session_id;

    RETURN v_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_or_create_session IS 'Retrieves existing valid session or creates new one with 24-hour expiration';


-- Function to clean up expired sessions (should be run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete expired sessions and their associated elements
    DELETE FROM public.user_sessions
    WHERE expires_at < NOW();

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_expired_sessions IS 'Removes expired sessions (run periodically via cron/scheduler)';


-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT ON public.story_elements TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_sessions TO authenticated;
GRANT SELECT, INSERT ON public.story_diversity_scores TO authenticated;

GRANT EXECUTE ON FUNCTION get_or_create_session(TEXT, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_sessions() TO authenticated;


-- ===================================================================
-- Validation and Testing
-- ===================================================================

-- Basic validation: Check that tables exist
DO $$
BEGIN
    ASSERT (SELECT COUNT(*) FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'story_elements') = 1,
        'story_elements table was not created';

    ASSERT (SELECT COUNT(*) FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'user_sessions') = 1,
        'user_sessions table was not created';

    ASSERT (SELECT COUNT(*) FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'story_diversity_scores') = 1,
        'story_diversity_scores table was not created';

    RAISE NOTICE 'Story diversity tables created successfully';
END $$;


-- ===================================================================
-- Rollback Procedure (commented for reference)
-- ===================================================================

/*
-- To rollback this migration, execute the following:

BEGIN;

-- Drop tables (cascade will remove dependent objects)
DROP TABLE IF EXISTS public.story_diversity_scores CASCADE;
DROP TABLE IF EXISTS public.story_elements CASCADE;
DROP TABLE IF EXISTS public.user_sessions CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS get_or_create_session(TEXT, UUID, JSONB);
DROP FUNCTION IF EXISTS cleanup_expired_sessions();

COMMIT;
*/
