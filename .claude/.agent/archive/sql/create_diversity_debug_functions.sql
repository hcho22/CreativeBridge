-- Migration: Diversity Debug API Functions
-- Created: 2026-01-14
-- Author: Ralph Agent
-- Description: Supabase RPC functions for diversity system debugging

-- Migration Up
BEGIN;

-- ============================================================================
-- Function: get_recent_elements_for_debugging
-- Description: Retrieve recent story elements for a session with metadata
-- Access: Authenticated users can only access their own sessions
-- ============================================================================

CREATE OR REPLACE FUNCTION get_recent_elements_for_debugging(
    p_session_id text,
    p_limit integer DEFAULT 10
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_session_user_id uuid;
    v_session_created_at timestamptz;
    v_total_stories integer;
    v_date_range json;
    v_elements json;
    v_result json;
BEGIN
    -- Get current authenticated user
    v_user_id := auth.uid();

    -- Validate user is authenticated
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required'
            USING HINT = 'User must be logged in to access this endpoint';
    END IF;

    -- Get session info and validate ownership
    SELECT user_id, created_at
    INTO v_session_user_id, v_session_created_at
    FROM user_sessions
    WHERE id = p_session_id
    AND expires_at > NOW();

    -- Check if session exists
    IF v_session_user_id IS NULL THEN
        RAISE EXCEPTION 'Session not found or expired'
            USING HINT = 'Provide a valid, non-expired session_id';
    END IF;

    -- Check if user owns this session (or is admin)
    -- Note: For now, users can only access their own sessions
    IF v_session_user_id != v_user_id THEN
        RAISE EXCEPTION 'Access denied'
            USING HINT = 'You can only access your own sessions';
    END IF;

    -- Count total unique stories in session
    SELECT COUNT(DISTINCT story_id)
    INTO v_total_stories
    FROM story_elements
    WHERE session_id = p_session_id;

    -- Get date range for elements
    SELECT json_build_object(
        'earliest', MIN(created_at),
        'latest', MAX(created_at)
    )
    INTO v_date_range
    FROM story_elements
    WHERE session_id = p_session_id;

    -- Get elements grouped by type with frequency counts
    WITH recent_stories AS (
        -- Get the most recent N stories for this session
        SELECT DISTINCT story_id
        FROM story_elements
        WHERE session_id = p_session_id
        ORDER BY story_id DESC
        LIMIT p_limit
    ),
    elements_with_frequency AS (
        SELECT
            se.element_type,
            se.element_text,
            se.embedding_vector,
            COUNT(*) as frequency,
            MAX(se.created_at) as last_used,
            array_agg(DISTINCT se.story_id ORDER BY se.story_id DESC) as story_ids
        FROM story_elements se
        INNER JOIN recent_stories rs ON se.story_id = rs.story_id
        WHERE se.session_id = p_session_id
        GROUP BY se.element_type, se.element_text, se.embedding_vector
    ),
    grouped_elements AS (
        SELECT
            element_type,
            json_agg(
                json_build_object(
                    'text', element_text,
                    'frequency', frequency,
                    'lastUsed', last_used,
                    'embedding', embedding_vector,
                    'storyIds', story_ids
                ) ORDER BY frequency DESC, last_used DESC
            ) as elements
        FROM elements_with_frequency
        GROUP BY element_type
    )
    SELECT json_object_agg(element_type, elements)
    INTO v_elements
    FROM grouped_elements;

    -- Build final result with metadata
    v_result := json_build_object(
        'sessionInfo', json_build_object(
            'sessionId', p_session_id,
            'userId', v_session_user_id,
            'createdAt', v_session_created_at,
            'totalStories', v_total_stories,
            'storiesInWindow', p_limit
        ),
        'dateRange', COALESCE(v_date_range, json_build_object('earliest', NULL, 'latest', NULL)),
        'elementsByType', COALESCE(v_elements, json_build_object(
            'character', '[]'::json,
            'setting', '[]'::json,
            'object', '[]'::json,
            'plot_pattern', '[]'::json
        )),
        'totalElements', (
            SELECT COUNT(*)
            FROM story_elements
            WHERE session_id = p_session_id
        )
    );

    RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_recent_elements_for_debugging(text, integer) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION get_recent_elements_for_debugging IS
'Debugging function to retrieve recent story elements for a session. Returns elements grouped by type with frequency counts, embeddings, and session metadata. Users can only access their own sessions.';

-- ============================================================================
-- Function: get_diversity_score_debug
-- Description: Retrieve diversity score and breakdown for a story
-- Access: Authenticated users can only access their own story scores
-- ============================================================================

CREATE OR REPLACE FUNCTION get_diversity_score_debug(
    p_story_id text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_story_user_id uuid;
    v_score_record record;
    v_result json;
BEGIN
    -- Get current authenticated user
    v_user_id := auth.uid();

    -- Validate user is authenticated
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required'
            USING HINT = 'User must be logged in to access this endpoint';
    END IF;

    -- Get story owner from game_sessions
    SELECT user_id
    INTO v_story_user_id
    FROM game_sessions
    WHERE id = p_story_id;

    -- Check if story exists
    IF v_story_user_id IS NULL THEN
        RAISE EXCEPTION 'Story not found'
            USING HINT = 'Provide a valid story_id';
    END IF;

    -- Check if user owns this story
    IF v_story_user_id != v_user_id THEN
        RAISE EXCEPTION 'Access denied'
            USING HINT = 'You can only access your own stories';
    END IF;

    -- Get diversity score record
    SELECT
        diversity_score,
        novel_element_count,
        metadata,
        created_at
    INTO v_score_record
    FROM story_diversity_scores
    WHERE story_id = p_story_id;

    -- Check if score exists
    IF v_score_record IS NULL THEN
        RAISE EXCEPTION 'Diversity score not found for this story'
            USING HINT = 'Score may not have been calculated yet';
    END IF;

    -- Build result
    v_result := json_build_object(
        'storyId', p_story_id,
        'diversityScore', v_score_record.diversity_score,
        'novelElementCount', v_score_record.novel_element_count,
        'calculatedAt', v_score_record.created_at,
        'breakdown', v_score_record.metadata
    );

    RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_diversity_score_debug(text) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION get_diversity_score_debug IS
'Debugging function to retrieve diversity score and detailed breakdown for a story. Users can only access scores for their own stories.';

COMMIT;

-- ============================================================================
-- Rollback Procedure
-- ============================================================================
-- To rollback this migration, run:
-- BEGIN;
-- DROP FUNCTION IF EXISTS get_recent_elements_for_debugging(text, integer);
-- DROP FUNCTION IF EXISTS get_diversity_score_debug(text);
-- COMMIT;
