-- Fix story_elements RLS policies to support OAuth users
--
-- Problem: OAuth users (Clerk/Google) don't have Supabase auth sessions,
-- so auth.uid() returns NULL and RLS policies reject story_elements inserts.
--
-- Error: "new row violates row-level security policy for table 'story_elements'"
--
-- Solution: Update RLS policies to support both:
-- 1. Supabase auth.uid() for email/password users
-- 2. Direct user_id matching via game_sessions for OAuth users
--
-- This migration updates story_elements RLS policies to work with both authentication methods.

-- Drop existing RLS policies for story_elements
DROP POLICY IF EXISTS "story_elements_insert_own_data" ON public.story_elements;
DROP POLICY IF EXISTS "story_elements_select_own_data" ON public.story_elements;

-- Create new INSERT policy that supports both Supabase auth and OAuth users
--
-- Policy Logic:
-- 1. If auth.uid() is NOT NULL (Supabase email/password user):
--    - Check if the game_session belongs to auth.uid()
-- 2. If auth.uid() IS NULL (OAuth user via Clerk):
--    - Check if the game_session's user_id exists in user_profiles
--    - This allows OAuth users to insert elements even without Supabase auth session
CREATE POLICY "story_elements_insert_policy"
ON public.story_elements
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

-- Create new SELECT policy that supports both Supabase auth and OAuth users
CREATE POLICY "story_elements_select_policy"
ON public.story_elements
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
COMMENT ON POLICY "story_elements_insert_policy" ON public.story_elements IS
'Allows users to insert story elements for their own stories. Supports both Supabase auth (auth.uid()) and OAuth users (user_id in user_profiles).';

COMMENT ON POLICY "story_elements_select_policy" ON public.story_elements IS
'Allows users to view story elements from their own stories. Supports both Supabase auth (auth.uid()) and OAuth users (user_id in user_profiles).';

-- Verify RLS is still enabled
ALTER TABLE public.story_elements ENABLE ROW LEVEL SECURITY;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ story_elements RLS policies updated successfully to support OAuth users';
  RAISE NOTICE 'ℹ️  Policies now support both:';
  RAISE NOTICE '   1. Supabase auth.uid() for email/password users';
  RAISE NOTICE '   2. Direct user_id matching for OAuth users (Clerk/Google/Apple)';
END $$;
