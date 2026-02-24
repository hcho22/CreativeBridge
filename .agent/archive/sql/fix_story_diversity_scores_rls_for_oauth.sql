-- Fix story_diversity_scores RLS policies to support OAuth users
--
-- Problem: OAuth users (Clerk/Google) don't have Supabase auth sessions,
-- so auth.uid() returns NULL and RLS policies may reject diversity score inserts.
--
-- Solution: Update RLS policies to support both:
-- 1. Supabase auth.uid() for email/password users
-- 2. Direct user_id matching via game_sessions for OAuth users
--
-- This migration updates story_diversity_scores RLS policies to work with both authentication methods.

-- Drop existing RLS policies for story_diversity_scores
DROP POLICY IF EXISTS "story_diversity_scores_insert_own_data" ON public.story_diversity_scores;
DROP POLICY IF EXISTS "story_diversity_scores_select_own_data" ON public.story_diversity_scores;
DROP POLICY IF EXISTS "story_diversity_scores_upsert_own_data" ON public.story_diversity_scores;
DROP POLICY IF EXISTS "story_diversity_scores_update_own_data" ON public.story_diversity_scores;

-- Create new INSERT policy that supports both Supabase auth and OAuth users
CREATE POLICY "story_diversity_scores_insert_policy"
ON public.story_diversity_scores
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.game_sessions
    WHERE id = story_id
    AND (
      -- Allow if Supabase auth user matches
      user_id = auth.uid()
      OR
      -- Allow if OAuth user (no auth.uid()) and user_id exists in profiles
      (
        auth.uid() IS NULL
        AND user_id IN (SELECT id FROM public.user_profiles)
      )
    )
  )
);

-- Create new UPDATE policy that supports both Supabase auth and OAuth users
CREATE POLICY "story_diversity_scores_update_policy"
ON public.story_diversity_scores
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.game_sessions
    WHERE id = story_id
    AND (
      -- Allow if Supabase auth user matches
      user_id = auth.uid()
      OR
      -- Allow if OAuth user (no auth.uid()) and user_id exists in profiles
      (
        auth.uid() IS NULL
        AND user_id IN (SELECT id FROM public.user_profiles)
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.game_sessions
    WHERE id = story_id
    AND (
      -- Allow if Supabase auth user matches
      user_id = auth.uid()
      OR
      -- Allow if OAuth user (no auth.uid()) and user_id exists in profiles
      (
        auth.uid() IS NULL
        AND user_id IN (SELECT id FROM public.user_profiles)
      )
    )
  )
);

-- Create new SELECT policy that supports both Supabase auth and OAuth users
CREATE POLICY "story_diversity_scores_select_policy"
ON public.story_diversity_scores
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.game_sessions
    WHERE id = story_id
    AND (
      -- Allow if Supabase auth user matches
      user_id = auth.uid()
      OR
      -- Allow if OAuth user (no auth.uid()) and user_id exists in profiles
      (
        auth.uid() IS NULL
        AND user_id IN (SELECT id FROM public.user_profiles)
      )
    )
  )
);

-- Add comments for documentation
COMMENT ON POLICY "story_diversity_scores_insert_policy" ON public.story_diversity_scores IS
'Allows users to insert diversity scores for their own stories. Supports both Supabase auth (auth.uid()) and OAuth users (user_id in user_profiles).';

COMMENT ON POLICY "story_diversity_scores_update_policy" ON public.story_diversity_scores IS
'Allows users to update diversity scores for their own stories. Supports both Supabase auth (auth.uid()) and OAuth users (user_id in user_profiles).';

COMMENT ON POLICY "story_diversity_scores_select_policy" ON public.story_diversity_scores IS
'Allows users to view diversity scores from their own stories. Supports both Supabase auth (auth.uid()) and OAuth users (user_id in user_profiles).';

-- Verify RLS is still enabled
ALTER TABLE public.story_diversity_scores ENABLE ROW LEVEL SECURITY;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ story_diversity_scores RLS policies updated successfully to support OAuth users';
  RAISE NOTICE 'ℹ️  Policies now support both:';
  RAISE NOTICE '   1. Supabase auth.uid() for email/password users';
  RAISE NOTICE '   2. Direct user_id matching for OAuth users (Clerk/Google/Apple)';
END $$;
