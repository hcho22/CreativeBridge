-- Fix game_sessions RLS policies to support OAuth users
--
-- Problem: OAuth users (Clerk) don't have Supabase auth sessions,
-- so auth.uid() returns NULL and RLS policies reject their requests.
--
-- Solution: Update RLS policies to support both:
-- 1. Supabase auth.uid() for email/password users
-- 2. Direct user_id matching for OAuth users (profiles exist in user_profiles)
--
-- This migration updates game_sessions RLS policies to work with both authentication methods.

-- Drop existing RLS policies for game_sessions
DROP POLICY IF EXISTS "game_sessions_own_data" ON public.game_sessions;
DROP POLICY IF EXISTS "Users can select their own game sessions" ON public.game_sessions;
DROP POLICY IF EXISTS "Users can insert their own game sessions" ON public.game_sessions;
DROP POLICY IF EXISTS "Users can update their own game sessions" ON public.game_sessions;
DROP POLICY IF EXISTS "Users can delete their own game sessions" ON public.game_sessions;

-- Create new RLS policies that support both Supabase auth and OAuth users
--
-- Policy Logic:
-- 1. If auth.uid() is NOT NULL (Supabase email/password user):
--    - Check if auth.uid() matches user_id
-- 2. If auth.uid() IS NULL (OAuth user via Clerk):
--    - Check if user_id exists in user_profiles table
--    - This allows OAuth users to access their data even without Supabase auth session

-- SELECT policy: Users can view their own game sessions
CREATE POLICY "game_sessions_select_policy"
ON public.game_sessions
FOR SELECT
USING (
  -- Allow if Supabase auth user matches
  auth.uid() = user_id
  OR
  -- Allow if OAuth user (no auth.uid()) and user_id exists in profiles
  (
    auth.uid() IS NULL
    AND user_id IN (SELECT id FROM public.user_profiles)
  )
);

-- INSERT policy: Users can create their own game sessions
CREATE POLICY "game_sessions_insert_policy"
ON public.game_sessions
FOR INSERT
WITH CHECK (
  -- Allow if Supabase auth user matches
  auth.uid() = user_id
  OR
  -- Allow if OAuth user (no auth.uid()) and user_id exists in profiles
  (
    auth.uid() IS NULL
    AND user_id IN (SELECT id FROM public.user_profiles)
  )
);

-- UPDATE policy: Users can update their own game sessions
CREATE POLICY "game_sessions_update_policy"
ON public.game_sessions
FOR UPDATE
USING (
  -- Allow if Supabase auth user matches
  auth.uid() = user_id
  OR
  -- Allow if OAuth user (no auth.uid()) and user_id exists in profiles
  (
    auth.uid() IS NULL
    AND user_id IN (SELECT id FROM public.user_profiles)
  )
)
WITH CHECK (
  -- Ensure user_id doesn't change to someone else's ID
  auth.uid() = user_id
  OR
  (
    auth.uid() IS NULL
    AND user_id IN (SELECT id FROM public.user_profiles)
  )
);

-- DELETE policy: Users can delete their own game sessions
CREATE POLICY "game_sessions_delete_policy"
ON public.game_sessions
FOR DELETE
USING (
  -- Allow if Supabase auth user matches
  auth.uid() = user_id
  OR
  -- Allow if OAuth user (no auth.uid()) and user_id exists in profiles
  (
    auth.uid() IS NULL
    AND user_id IN (SELECT id FROM public.user_profiles)
  )
);

-- Add comments for documentation
COMMENT ON POLICY "game_sessions_select_policy" ON public.game_sessions IS
'Allows users to view their own game sessions. Supports both Supabase auth (auth.uid()) and OAuth users (user_id in user_profiles).';

COMMENT ON POLICY "game_sessions_insert_policy" ON public.game_sessions IS
'Allows users to create game sessions. Supports both Supabase auth (auth.uid()) and OAuth users (user_id in user_profiles).';

COMMENT ON POLICY "game_sessions_update_policy" ON public.game_sessions IS
'Allows users to update their own game sessions. Supports both Supabase auth (auth.uid()) and OAuth users (user_id in user_profiles).';

COMMENT ON POLICY "game_sessions_delete_policy" ON public.game_sessions IS
'Allows users to delete their own game sessions. Supports both Supabase auth (auth.uid()) and OAuth users (user_id in user_profiles).';

-- Verify RLS is still enabled
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ game_sessions RLS policies updated successfully to support OAuth users';
  RAISE NOTICE 'ℹ️  Policies now support both:';
  RAISE NOTICE '   1. Supabase auth.uid() for email/password users';
  RAISE NOTICE '   2. Direct user_id matching for OAuth users (Clerk)';
END $$;
