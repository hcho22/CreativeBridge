-- Fix for Missing story_diversity_scores Table
-- Run this if you get "policy already exists" error when running the full migration
-- This creates ONLY the missing story_diversity_scores table

-- Create story_diversity_scores table if it doesn't exist
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

-- Create index for efficient story score lookups
CREATE INDEX IF NOT EXISTS idx_story_diversity_scores_story_id
ON public.story_diversity_scores(story_id);

-- Create index for score analytics queries
CREATE INDEX IF NOT EXISTS idx_story_diversity_scores_created_at
ON public.story_diversity_scores(created_at DESC);

-- Create partial index for low diversity monitoring
CREATE INDEX IF NOT EXISTS idx_story_diversity_scores_low_diversity
ON public.story_diversity_scores(diversity_score)
WHERE diversity_score < 0.4;

-- Row Level Security (RLS) Policies
ALTER TABLE public.story_diversity_scores ENABLE ROW LEVEL SECURITY;

-- Policy: Users can select diversity scores for their own stories
DROP POLICY IF EXISTS story_diversity_scores_select_own_data ON public.story_diversity_scores;
CREATE POLICY story_diversity_scores_select_own_data ON public.story_diversity_scores
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.game_sessions
            WHERE game_sessions.id = story_diversity_scores.story_id
            AND game_sessions.user_id = auth.uid()
        )
    );

-- Policy: System can insert diversity scores for any story (via service role)
DROP POLICY IF EXISTS story_diversity_scores_insert_service ON public.story_diversity_scores;
CREATE POLICY story_diversity_scores_insert_service ON public.story_diversity_scores
    FOR INSERT
    WITH CHECK (true); -- Service role has full access

-- Grant permissions
GRANT SELECT, INSERT ON public.story_diversity_scores TO authenticated;
GRANT ALL ON public.story_diversity_scores TO service_role;

-- Verification query
SELECT
    'story_diversity_scores table created successfully!' as status,
    COUNT(*) as existing_scores
FROM public.story_diversity_scores;
