-- Migration Script: Create image_generation_events table for analytics tracking
-- This script creates a dedicated table for tracking image generation events and analytics

-- Create the image_generation_events table
CREATE TABLE IF NOT EXISTS public.image_generation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.game_sessions(id) ON DELETE SET NULL,
  
  -- Image generation specific fields
  xp_cost INTEGER NOT NULL DEFAULT 1000,
  generation_status TEXT NOT NULL CHECK (generation_status IN ('pending', 'success', 'failed', 'refunded', 'timeout')),
  error_type TEXT, -- 'api_failure', 'content_safety', 'insufficient_xp', 'timeout', 'rate_limit'
  
  -- API and service tracking
  service_used TEXT DEFAULT 'replicate', -- 'replicate', 'backup_service'
  api_response_time INTEGER, -- Response time in milliseconds
  image_url TEXT, -- URL of the generated image (if successful)
  
  -- Story and content metadata
  story_grade_level TEXT,
  story_word_count INTEGER,
  prompt_used TEXT, -- The AI prompt that was generated
  
  -- Analytics metadata
  metadata JSONB DEFAULT '{}', -- Additional flexible metadata
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE, -- When the generation completed (success or failure)
  
  -- Indexes for performance
  CONSTRAINT check_xp_cost_positive CHECK (xp_cost > 0),
  CONSTRAINT check_response_time_reasonable CHECK (api_response_time IS NULL OR (api_response_time >= 0 AND api_response_time <= 300000))
);

-- Add comments for documentation
COMMENT ON TABLE public.image_generation_events IS 'Tracks all image generation attempts for analytics and monitoring';
COMMENT ON COLUMN public.image_generation_events.user_id IS 'User who initiated the image generation';
COMMENT ON COLUMN public.image_generation_events.session_id IS 'Game session (story) for which image was generated';
COMMENT ON COLUMN public.image_generation_events.xp_cost IS 'XP cost deducted for this generation attempt';
COMMENT ON COLUMN public.image_generation_events.generation_status IS 'Status of the generation: pending, success, failed, refunded, timeout';
COMMENT ON COLUMN public.image_generation_events.error_type IS 'Type of error if generation failed';
COMMENT ON COLUMN public.image_generation_events.service_used IS 'Which AI service was used (replicate, backup_service)';
COMMENT ON COLUMN public.image_generation_events.api_response_time IS 'API response time in milliseconds';
COMMENT ON COLUMN public.image_generation_events.image_url IS 'URL of generated image if successful';
COMMENT ON COLUMN public.image_generation_events.story_grade_level IS 'Grade level of the story for analytics';
COMMENT ON COLUMN public.image_generation_events.story_word_count IS 'Word count of the story for analytics';
COMMENT ON COLUMN public.image_generation_events.prompt_used IS 'AI prompt that was sent to the generation service';
COMMENT ON COLUMN public.image_generation_events.metadata IS 'Additional flexible metadata (user agent, device info, etc.)';
COMMENT ON COLUMN public.image_generation_events.completed_at IS 'When the generation attempt was completed';

-- Create indexes for optimal query performance
CREATE INDEX IF NOT EXISTS idx_image_generation_events_user_id ON public.image_generation_events(user_id);
CREATE INDEX IF NOT EXISTS idx_image_generation_events_session_id ON public.image_generation_events(session_id);
CREATE INDEX IF NOT EXISTS idx_image_generation_events_status ON public.image_generation_events(generation_status);
CREATE INDEX IF NOT EXISTS idx_image_generation_events_created_at ON public.image_generation_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_image_generation_events_service_used ON public.image_generation_events(service_used);
CREATE INDEX IF NOT EXISTS idx_image_generation_events_error_type ON public.image_generation_events(error_type);
CREATE INDEX IF NOT EXISTS idx_image_generation_events_grade_level ON public.image_generation_events(story_grade_level);

-- Create compound indexes for common analytics queries
CREATE INDEX IF NOT EXISTS idx_image_generation_events_user_status ON public.image_generation_events(user_id, generation_status);
CREATE INDEX IF NOT EXISTS idx_image_generation_events_status_created ON public.image_generation_events(generation_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_image_generation_events_service_status ON public.image_generation_events(service_used, generation_status);

-- Create GIN index for metadata JSONB queries
CREATE INDEX IF NOT EXISTS idx_image_generation_events_metadata ON public.image_generation_events USING GIN(metadata);

-- Enable Row Level Security
ALTER TABLE public.image_generation_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for image generation events
CREATE POLICY "Users can insert their own image generation events" 
ON public.image_generation_events FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own image generation events" 
ON public.image_generation_events FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own image generation events" 
ON public.image_generation_events FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Admin policy for analytics and monitoring (can be added later when admin roles are implemented)
-- CREATE POLICY "Admin can view all image generation events" 
-- ON public.image_generation_events FOR SELECT 
-- USING (
--   EXISTS (
--     SELECT 1 FROM public.user_profiles 
--     WHERE id = auth.uid() 
--     AND (admin_role_column->>'role')::text = 'admin'
--   )
-- );

-- Function to create an image generation event
CREATE OR REPLACE FUNCTION create_image_generation_event(
    p_user_id UUID,
    p_session_id UUID,
    p_xp_cost INTEGER DEFAULT 1000,
    p_story_grade_level TEXT DEFAULT NULL,
    p_story_word_count INTEGER DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    event_id UUID;
BEGIN
    -- Insert the event record
    INSERT INTO public.image_generation_events (
        user_id,
        session_id,
        xp_cost,
        generation_status,
        story_grade_level,
        story_word_count,
        metadata
    ) VALUES (
        p_user_id,
        p_session_id,
        p_xp_cost,
        'pending',
        p_story_grade_level,
        p_story_word_count,
        p_metadata
    ) RETURNING id INTO event_id;
    
    RETURN event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update image generation event status
CREATE OR REPLACE FUNCTION update_image_generation_event(
    p_event_id UUID,
    p_status TEXT,
    p_image_url TEXT DEFAULT NULL,
    p_error_type TEXT DEFAULT NULL,
    p_service_used TEXT DEFAULT 'replicate',
    p_api_response_time INTEGER DEFAULT NULL,
    p_prompt_used TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Validate status
    IF p_status NOT IN ('pending', 'success', 'failed', 'refunded', 'timeout') THEN
        RAISE EXCEPTION 'Invalid status: %. Must be one of: pending, success, failed, refunded, timeout', p_status;
    END IF;
    
    -- Update the event
    UPDATE public.image_generation_events 
    SET 
        generation_status = p_status,
        image_url = p_image_url,
        error_type = p_error_type,
        service_used = p_service_used,
        api_response_time = p_api_response_time,
        prompt_used = p_prompt_used,
        completed_at = CASE WHEN p_status != 'pending' THEN NOW() ELSE completed_at END
    WHERE id = p_event_id
      AND user_id = auth.uid(); -- Ensure user can only update their own events
    
    -- Return whether any row was updated
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get image generation analytics
CREATE OR REPLACE FUNCTION get_image_generation_analytics(
    p_user_id UUID DEFAULT NULL,
    p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE(
    total_attempts BIGINT,
    successful_generations BIGINT,
    failed_generations BIGINT,
    refunded_generations BIGINT,
    avg_response_time NUMERIC,
    most_common_error_type TEXT,
    total_xp_spent BIGINT,
    replicate_usage BIGINT,
    backup_service_usage BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_attempts,
        COUNT(*) FILTER (WHERE generation_status = 'success') as successful_generations,
        COUNT(*) FILTER (WHERE generation_status = 'failed') as failed_generations,
        COUNT(*) FILTER (WHERE generation_status = 'refunded') as refunded_generations,
        AVG(api_response_time) as avg_response_time,
        (
            SELECT error_type 
            FROM public.image_generation_events 
            WHERE error_type IS NOT NULL
              AND (p_user_id IS NULL OR user_id = p_user_id)
              AND (p_start_date IS NULL OR created_at >= p_start_date)
              AND (p_end_date IS NULL OR created_at <= p_end_date)
            GROUP BY error_type 
            ORDER BY COUNT(*) DESC 
            LIMIT 1
        ) as most_common_error_type,
        SUM(xp_cost) FILTER (WHERE generation_status != 'refunded') as total_xp_spent,
        COUNT(*) FILTER (WHERE service_used = 'replicate') as replicate_usage,
        COUNT(*) FILTER (WHERE service_used != 'replicate') as backup_service_usage
    FROM public.image_generation_events
    WHERE (p_user_id IS NULL OR user_id = p_user_id)
      AND (p_start_date IS NULL OR created_at >= p_start_date)
      AND (p_end_date IS NULL OR created_at <= p_end_date);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get image generation events for a user
CREATE OR REPLACE FUNCTION get_user_image_generation_events(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
    event_id UUID,
    session_id UUID,
    xp_cost INTEGER,
    generation_status TEXT,
    error_type TEXT,
    service_used TEXT,
    api_response_time INTEGER,
    image_url TEXT,
    story_grade_level TEXT,
    story_word_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ige.id,
        ige.session_id,
        ige.xp_cost,
        ige.generation_status,
        ige.error_type,
        ige.service_used,
        ige.api_response_time,
        ige.image_url,
        ige.story_grade_level,
        ige.story_word_count,
        ige.created_at,
        ige.completed_at
    FROM public.image_generation_events ige
    WHERE ige.user_id = p_user_id
    ORDER BY ige.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON public.image_generation_events TO authenticated;
GRANT EXECUTE ON FUNCTION create_image_generation_event(UUID, UUID, INTEGER, TEXT, INTEGER, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION update_image_generation_event(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_image_generation_analytics(UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_image_generation_events(UUID, INTEGER, INTEGER) TO authenticated;