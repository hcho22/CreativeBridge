-- Migration Script: Add Story Continuation Fields to game_sessions table
-- This script extends the existing game_sessions table to support imported stories

-- Add new columns for story continuation feature
ALTER TABLE public.game_sessions 
ADD COLUMN IF NOT EXISTS imported_story_content TEXT,
ADD COLUMN IF NOT EXISTS story_source VARCHAR(20) DEFAULT 'New',
ADD COLUMN IF NOT EXISTS original_creation_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS story_metadata JSONB DEFAULT '{}';

-- Add constraint for story_source values (drop first if exists, then create)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE constraint_name = 'valid_story_source' 
        AND table_name = 'game_sessions'
    ) THEN
        ALTER TABLE public.game_sessions 
        ADD CONSTRAINT valid_story_source 
        CHECK (story_source IN ('New', 'CreativeBridge', 'Story_Quest', 'File'));
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN public.game_sessions.imported_story_content IS 'Original content of imported story for continuation';
COMMENT ON COLUMN public.game_sessions.story_source IS 'Source of the story: New, CreativeBridge, Story_Quest, or File';
COMMENT ON COLUMN public.game_sessions.original_creation_date IS 'When the original story was first created (for imported stories)';
COMMENT ON COLUMN public.game_sessions.story_metadata IS 'Additional metadata about the story (word count, author, etc.)';

-- Create indexes for better performance on new fields
CREATE INDEX IF NOT EXISTS idx_game_sessions_story_source ON public.game_sessions(story_source);
CREATE INDEX IF NOT EXISTS idx_game_sessions_original_creation_date ON public.game_sessions(original_creation_date DESC);
CREATE INDEX IF NOT EXISTS idx_game_sessions_story_metadata ON public.game_sessions USING GIN(story_metadata);

-- Create a function to validate story import data
CREATE OR REPLACE FUNCTION validate_story_import(
    p_story_source VARCHAR(20),
    p_imported_content TEXT,
    p_original_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Validate that imported stories have content
    IF p_story_source != 'New' AND (p_imported_content IS NULL OR LENGTH(TRIM(p_imported_content)) < 10) THEN
        RAISE EXCEPTION 'Imported stories must have content with at least 10 characters';
    END IF;
    
    -- Validate that original creation date is not in the future
    IF p_original_date IS NOT NULL AND p_original_date > NOW() THEN
        RAISE EXCEPTION 'Original creation date cannot be in the future';
    END IF;
    
    -- Validate content length (max 100KB for performance)
    IF p_imported_content IS NOT NULL AND LENGTH(p_imported_content) > 100000 THEN
        RAISE EXCEPTION 'Imported story content cannot exceed 100,000 characters';
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to validate data before insert/update
CREATE OR REPLACE FUNCTION validate_game_session_story_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Only validate if story continuation fields are being set
    IF NEW.story_source IS NOT NULL AND NEW.story_source != 'New' THEN
        PERFORM validate_story_import(
            NEW.story_source,
            NEW.imported_story_content,
            NEW.original_creation_date
        );
    END IF;
    
    -- Set default original_creation_date if not provided for imported stories
    IF NEW.story_source != 'New' AND NEW.original_creation_date IS NULL THEN
        NEW.original_creation_date = NEW.created_at;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the validation trigger
DROP TRIGGER IF EXISTS validate_story_data_trigger ON public.game_sessions;
CREATE TRIGGER validate_story_data_trigger
    BEFORE INSERT OR UPDATE ON public.game_sessions
    FOR EACH ROW
    EXECUTE FUNCTION validate_game_session_story_data();

-- Function to create a story continuation session from imported content
CREATE OR REPLACE FUNCTION create_story_continuation_session(
    p_user_id UUID,
    p_grade_level VARCHAR(10),
    p_story_source VARCHAR(20),
    p_imported_content TEXT,
    p_original_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    session_id UUID;
    word_count INTEGER;
BEGIN
    -- Validate input
    PERFORM validate_story_import(p_story_source, p_imported_content, p_original_date);
    
    -- Calculate word count from imported content
    word_count := COALESCE(array_length(string_to_array(trim(p_imported_content), ' '), 1), 0);
    
    -- Create the session
    INSERT INTO public.game_sessions (
        user_id,
        grade_level,
        story_source,
        imported_story_content,
        original_creation_date,
        story_metadata,
        words_written
    ) VALUES (
        p_user_id,
        p_grade_level,
        p_story_source,
        p_imported_content,
        COALESCE(p_original_date, NOW()),
        p_metadata || jsonb_build_object('imported_word_count', word_count),
        word_count
    ) RETURNING id INTO session_id;
    
    RETURN session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's importable stories (completed sessions)
CREATE OR REPLACE FUNCTION get_user_importable_stories(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
    session_id UUID,
    created_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    story_content TEXT,
    final_score INTEGER,
    words_written INTEGER,
    story_source VARCHAR(20),
    story_metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gs.id,
        gs.created_at,
        gs.completed_at,
        gs.story_content,
        gs.final_score,
        gs.words_written,
        COALESCE(gs.story_source, 'New')::VARCHAR(20),
        COALESCE(gs.story_metadata, '{}'::JSONB)
    FROM public.game_sessions gs
    WHERE gs.user_id = p_user_id
      AND gs.completed_at IS NOT NULL
      AND gs.story_content IS NOT NULL
      AND LENGTH(TRIM(gs.story_content)) >= 50
    ORDER BY gs.completed_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to search user stories by content
CREATE OR REPLACE FUNCTION search_user_stories(
    p_user_id UUID,
    p_search_term TEXT,
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE(
    session_id UUID,
    created_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    story_content TEXT,
    story_excerpt TEXT,
    words_written INTEGER,
    story_source VARCHAR(20),
    relevance_score REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gs.id,
        gs.created_at,
        gs.completed_at,
        gs.story_content,
        LEFT(gs.story_content, 150) || CASE WHEN LENGTH(gs.story_content) > 150 THEN '...' ELSE '' END,
        gs.words_written,
        COALESCE(gs.story_source, 'New')::VARCHAR(20),
        ts_rank(to_tsvector('english', gs.story_content), plainto_tsquery('english', p_search_term))
    FROM public.game_sessions gs
    WHERE gs.user_id = p_user_id
      AND gs.completed_at IS NOT NULL
      AND gs.story_content IS NOT NULL
      AND to_tsvector('english', gs.story_content) @@ plainto_tsquery('english', p_search_term)
    ORDER BY ts_rank(to_tsvector('english', gs.story_content), plainto_tsquery('english', p_search_term)) DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS policies to handle new fields (existing policies should still work)
-- The current policies already cover the new fields since they operate on the whole table

-- Create view for story analytics
CREATE OR REPLACE VIEW public.story_source_analytics AS
SELECT 
    story_source,
    COUNT(*) as total_stories,
    AVG(final_score) as avg_score,
    AVG(words_written) as avg_words,
    MIN(created_at) as first_story,
    MAX(created_at) as latest_story
FROM public.game_sessions
WHERE completed_at IS NOT NULL
GROUP BY story_source;

-- Grant necessary permissions
GRANT SELECT ON public.story_source_analytics TO authenticated;
GRANT EXECUTE ON FUNCTION create_story_continuation_session(UUID, VARCHAR, VARCHAR, TEXT, TIMESTAMP WITH TIME ZONE, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_importable_stories(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION search_user_stories(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_story_import(VARCHAR, TEXT, TIMESTAMP WITH TIME ZONE) TO authenticated;