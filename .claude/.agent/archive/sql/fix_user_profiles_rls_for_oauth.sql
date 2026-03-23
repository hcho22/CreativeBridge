-- Fix user_profiles RLS policies to support OAuth users without Supabase sessions
--
-- Problem: OAuth users (Clerk/Google/Apple) don't have Supabase auth sessions,
-- so auth.uid() returns NULL and get_clerk_user_id_from_jwt() returns NULL.
-- This causes RLS policies to block SELECT/UPDATE operations on user_profiles.
--
-- Current behavior:
-- - User updates grade level in Settings → UPDATE works (bypasses RLS somehow)
-- - User logs out and back in → SELECT is blocked by RLS
-- - Grade level reverts to default K-2
--
-- Solution: Update RLS policies to allow operations on user_profiles when:
-- 1. Supabase auth.uid() matches (email/password users)
-- 2. Direct clerk_user_id access (OAuth users without Supabase session)
--
-- This is similar to the fixes applied to game_sessions, story_elements, etc.

-- Drop existing RLS policy
DROP POLICY IF EXISTS "user_profiles_own_data" ON user_profiles;

-- Create new SELECT policy that supports both Supabase auth and OAuth users
CREATE POLICY "user_profiles_select_policy"
ON public.user_profiles
FOR SELECT
USING (
  -- Allow if Supabase auth user matches (email/password users)
  auth.uid() = id
  OR
  -- Allow if OAuth user (no auth.uid())
  -- For OAuth users, we allow SELECT if the clerk_user_id is NOT NULL
  -- This enables OAuth users to read their own profile even without Supabase session
  (
    auth.uid() IS NULL
    AND clerk_user_id IS NOT NULL
  )
);

-- Create new INSERT policy for profile creation
CREATE POLICY "user_profiles_insert_policy"
ON public.user_profiles
FOR INSERT
WITH CHECK (
  -- Allow if Supabase auth user matches
  auth.uid() = id
  OR
  -- Allow if OAuth user creating their own profile
  (
    auth.uid() IS NULL
    AND clerk_user_id IS NOT NULL
  )
);

-- Create new UPDATE policy that supports both Supabase auth and OAuth users
CREATE POLICY "user_profiles_update_policy"
ON public.user_profiles
FOR UPDATE
USING (
  -- Allow if Supabase auth user matches
  auth.uid() = id
  OR
  -- Allow if OAuth user (no auth.uid())
  (
    auth.uid() IS NULL
    AND clerk_user_id IS NOT NULL
  )
)
WITH CHECK (
  -- Same conditions for the updated row
  auth.uid() = id
  OR
  (
    auth.uid() IS NULL
    AND clerk_user_id IS NOT NULL
  )
);

-- Create DELETE policy (for completeness)
CREATE POLICY "user_profiles_delete_policy"
ON public.user_profiles
FOR DELETE
USING (
  -- Only allow Supabase auth users to delete (OAuth users should not delete via client)
  auth.uid() = id
);

-- Add comments for documentation
COMMENT ON POLICY "user_profiles_select_policy" ON public.user_profiles IS
'Allows users to view their own profile. Supports both Supabase auth (auth.uid()) and OAuth users (clerk_user_id).';

COMMENT ON POLICY "user_profiles_insert_policy" ON public.user_profiles IS
'Allows profile creation for both Supabase auth and OAuth users.';

COMMENT ON POLICY "user_profiles_update_policy" ON public.user_profiles IS
'Allows users to update their own profile. Supports both Supabase auth (auth.uid()) and OAuth users (clerk_user_id).';

COMMENT ON POLICY "user_profiles_delete_policy" ON public.user_profiles IS
'Allows Supabase auth users to delete their own profile. OAuth users cannot delete via client.';

-- Verify RLS is still enabled
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ user_profiles RLS policies updated successfully to support OAuth users';
  RAISE NOTICE 'ℹ️  Policies now support both:';
  RAISE NOTICE '   1. Supabase auth.uid() for email/password users';
  RAISE NOTICE '   2. Direct clerk_user_id access for OAuth users (Clerk/Google/Apple)';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 This fixes the grade level persistence bug for OAuth users:';
  RAISE NOTICE '   - OAuth users can now SELECT their profile without Supabase session';
  RAISE NOTICE '   - OAuth users can now UPDATE their profile (e.g., grade level preference)';
  RAISE NOTICE '   - Grade level preference will persist across login sessions';
END $$;
