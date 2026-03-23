-- Fix RLS Policies for story_diversity_scores to Support UPSERT Operations
-- Issue: upsert() requires both INSERT and UPDATE policies, but only INSERT was defined
-- Error: "new row violates row-level security policy (USING expression)"
--
-- This migration adds the missing UPDATE policy to allow upsert operations.

-- Drop existing policies to ensure clean state
DROP POLICY IF EXISTS story_diversity_scores_insert_own_data ON public.story_diversity_scores;
DROP POLICY IF EXISTS story_diversity_scores_select_own_data ON public.story_diversity_scores;
DROP POLICY IF EXISTS story_diversity_scores_update_own_data ON public.story_diversity_scores;

-- Policy 1: Users can INSERT diversity scores for their own stories
CREATE POLICY story_diversity_scores_insert_own_data
ON public.story_diversity_scores
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.game_sessions
        WHERE game_sessions.id = story_diversity_scores.story_id
        AND game_sessions.user_id = auth.uid()
    )
);

-- Policy 2: Users can SELECT diversity scores for their own stories
CREATE POLICY story_diversity_scores_select_own_data
ON public.story_diversity_scores
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.game_sessions
        WHERE game_sessions.id = story_diversity_scores.story_id
        AND game_sessions.user_id = auth.uid()
    )
);

-- Policy 3: Users can UPDATE diversity scores for their own stories (NEW - required for upsert)
CREATE POLICY story_diversity_scores_update_own_data
ON public.story_diversity_scores
FOR UPDATE
USING (
    -- Can see the row (must own the story)
    EXISTS (
        SELECT 1 FROM public.game_sessions
        WHERE game_sessions.id = story_diversity_scores.story_id
        AND game_sessions.user_id = auth.uid()
    )
)
WITH CHECK (
    -- Can update the row (must own the story)
    EXISTS (
        SELECT 1 FROM public.game_sessions
        WHERE game_sessions.id = story_diversity_scores.story_id
        AND game_sessions.user_id = auth.uid()
    )
);

-- Ensure permissions are granted
GRANT SELECT, INSERT, UPDATE ON public.story_diversity_scores TO authenticated;
GRANT ALL ON public.story_diversity_scores TO service_role;

-- Verification: Check that all policies are created
DO $$
BEGIN
    ASSERT (
        SELECT COUNT(*)
        FROM pg_policies
        WHERE tablename = 'story_diversity_scores'
        AND policyname IN (
            'story_diversity_scores_insert_own_data',
            'story_diversity_scores_select_own_data',
            'story_diversity_scores_update_own_data'
        )
    ) = 3, 'Expected 3 RLS policies on story_diversity_scores table';

    RAISE NOTICE 'RLS policies for story_diversity_scores configured successfully';
END $$;

-- Verification query: Show all policies
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual IS NOT NULL as has_using_clause,
    with_check IS NOT NULL as has_with_check_clause
FROM pg_policies
WHERE tablename = 'story_diversity_scores'
ORDER BY policyname;
