-- Migration Script: Add Story Image Generation Fields to game_sessions table
-- This script extends the existing game_sessions table to support AI-generated story images

-- Add new columns for image generation feature
ALTER TABLE public.game_sessions 
ADD COLUMN IF NOT EXISTS generated_image_url TEXT,
ADD COLUMN IF NOT EXISTS image_generation_timestamp TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS image_generation_cost INTEGER DEFAULT 1000;

-- Add comments for documentation
COMMENT ON COLUMN public.game_sessions.generated_image_url IS 'URL to the AI-generated image for this story (if generated)';
COMMENT ON COLUMN public.game_sessions.image_generation_timestamp IS 'When the image was generated for this story';
COMMENT ON COLUMN public.game_sessions.image_generation_cost IS 'XP cost for image generation (default 1000)';

-- Create indexes for better performance on new fields
CREATE INDEX IF NOT EXISTS idx_game_sessions_generated_image_url ON public.game_sessions(generated_image_url);
CREATE INDEX IF NOT EXISTS idx_game_sessions_image_generation_timestamp ON public.game_sessions(image_generation_timestamp DESC);

-- Add constraint to ensure image_generation_cost is positive
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE constraint_name = 'check_image_generation_cost_positive' 
        AND table_name = 'game_sessions'
    ) THEN
        ALTER TABLE public.game_sessions 
        ADD CONSTRAINT check_image_generation_cost_positive 
        CHECK (image_generation_cost > 0);
    END IF;
END $$;

-- Add constraint to ensure timestamp is set when image URL is provided
-- Note: Using a function-based approach to allow for conditional validation
CREATE OR REPLACE FUNCTION validate_image_generation_data()
RETURNS TRIGGER AS $$
BEGIN
    -- If image URL is provided, timestamp should also be set
    IF NEW.generated_image_url IS NOT NULL AND NEW.image_generation_timestamp IS NULL THEN
        NEW.image_generation_timestamp = NOW();
    END IF;
    
    -- If timestamp is set but no URL, this might indicate a failed generation
    -- We'll allow this case for tracking purposes
    
    -- Ensure cost is reasonable (between 100 and 10000 XP)
    IF NEW.image_generation_cost IS NOT NULL AND (NEW.image_generation_cost < 100 OR NEW.image_generation_cost > 10000) THEN
        RAISE EXCEPTION 'Image generation cost must be between 100 and 10000 XP, got %', NEW.image_generation_cost;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the validation trigger for image generation data
DROP TRIGGER IF EXISTS validate_image_generation_trigger ON public.game_sessions;
CREATE TRIGGER validate_image_generation_trigger
    BEFORE INSERT OR UPDATE ON public.game_sessions
    FOR EACH ROW
    EXECUTE FUNCTION validate_image_generation_data();

-- Function to update story with generated image
CREATE OR REPLACE FUNCTION update_story_generated_image(
    p_session_id UUID,
    p_image_url TEXT,
    p_generation_cost INTEGER DEFAULT 1000
)
RETURNS BOOLEAN AS $$
DECLARE
    session_exists BOOLEAN;
BEGIN
    -- Check if the session exists and belongs to an authenticated user
    SELECT EXISTS(
        SELECT 1 FROM public.game_sessions 
        WHERE id = p_session_id 
        AND user_id = auth.uid()
    ) INTO session_exists;
    
    IF NOT session_exists THEN
        RAISE EXCEPTION 'Session not found or access denied';
    END IF;
    
    -- Update the session with image information
    UPDATE public.game_sessions 
    SET 
        generated_image_url = p_image_url,
        image_generation_timestamp = NOW(),
        image_generation_cost = p_generation_cost
    WHERE id = p_session_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get stories with generated images for a user
CREATE OR REPLACE FUNCTION get_user_stories_with_images(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
    session_id UUID,
    created_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    story_content TEXT,
    generated_image_url TEXT,
    image_generation_timestamp TIMESTAMP WITH TIME ZONE,
    image_generation_cost INTEGER,
    final_score INTEGER,
    words_written INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gs.id,
        gs.created_at,
        gs.completed_at,
        gs.story_content,
        gs.generated_image_url,
        gs.image_generation_timestamp,
        gs.image_generation_cost,
        gs.final_score,
        gs.words_written
    FROM public.game_sessions gs
    WHERE gs.user_id = p_user_id
      AND gs.completed_at IS NOT NULL
      AND gs.generated_image_url IS NOT NULL
    ORDER BY gs.image_generation_timestamp DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get image generation statistics for analytics
CREATE OR REPLACE FUNCTION get_image_generation_stats()
RETURNS TABLE(
    total_images_generated BIGINT,
    avg_generation_cost NUMERIC,
    images_generated_today BIGINT,
    images_generated_this_week BIGINT,
    images_generated_this_month BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) FILTER (WHERE generated_image_url IS NOT NULL),
        AVG(image_generation_cost) FILTER (WHERE generated_image_url IS NOT NULL),
        COUNT(*) FILTER (WHERE generated_image_url IS NOT NULL AND image_generation_timestamp >= CURRENT_DATE),
        COUNT(*) FILTER (WHERE generated_image_url IS NOT NULL AND image_generation_timestamp >= DATE_TRUNC('week', CURRENT_DATE)),
        COUNT(*) FILTER (WHERE generated_image_url IS NOT NULL AND image_generation_timestamp >= DATE_TRUNC('month', CURRENT_DATE))
    FROM public.game_sessions;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a view for image generation analytics
CREATE OR REPLACE VIEW public.image_generation_analytics AS
SELECT 
    DATE_TRUNC('day', image_generation_timestamp) as generation_date,
    COUNT(*) as images_generated,
    AVG(image_generation_cost) as avg_cost,
    COUNT(DISTINCT user_id) as unique_users
FROM public.game_sessions
WHERE generated_image_url IS NOT NULL
  AND image_generation_timestamp IS NOT NULL
GROUP BY DATE_TRUNC('day', image_generation_timestamp)
ORDER BY generation_date DESC;

-- Grant necessary permissions
GRANT SELECT ON public.image_generation_analytics TO authenticated;
GRANT EXECUTE ON FUNCTION update_story_generated_image(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_stories_with_images(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_image_generation_stats() TO authenticated;

-- Update existing RLS policies (they should already cover the new columns)
-- No additional RLS policies needed since the existing policies on game_sessions
-- already restrict access to user's own records