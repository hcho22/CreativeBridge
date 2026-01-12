-- Migration: Add Clerk User ID to user_profiles table
-- Purpose: Support Clerk OAuth authentication by storing Clerk user ID
-- Date: 2024

-- Add clerk_user_id column to user_profiles table
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS clerk_user_id TEXT;

-- Create index for faster lookups by Clerk user ID
CREATE INDEX IF NOT EXISTS idx_user_profiles_clerk_user_id 
ON user_profiles(clerk_user_id);

-- Add unique constraint to ensure one Clerk user ID maps to one profile
-- Note: This allows NULL values (for non-OAuth users)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_clerk_user_id_unique 
ON user_profiles(clerk_user_id) 
WHERE clerk_user_id IS NOT NULL;

-- Add comment to column
COMMENT ON COLUMN user_profiles.clerk_user_id IS 
'Clerk user ID for OAuth authentication. Format: user_xxxxx. NULL for email/password users.';

-- Update RLS policies to support Clerk user ID
-- This policy allows users to access their profile using Clerk user ID from JWT
-- The JWT will contain the Clerk user ID in a custom claim

-- Drop existing policy if it exists (we'll recreate it with Clerk support)
DROP POLICY IF EXISTS "user_profiles_own_data" ON user_profiles;

-- Create new policy that supports both Supabase auth.uid() and Clerk user ID
-- Note: Clerk user ID will be passed via JWT custom claim
-- For now, we'll use a function to extract it from JWT
CREATE POLICY "user_profiles_own_data" ON user_profiles
FOR ALL
USING (
  -- Allow access if user matches Supabase auth.uid() (existing email/password users)
  auth.uid() = id
  OR
  -- Allow access if Clerk user ID matches (OAuth users)
  -- This will be set via JWT custom claim in Supabase session
  -- We'll need to create a function to extract Clerk user ID from JWT
  clerk_user_id = current_setting('request.jwt.claims', true)::json->>'clerk_user_id'
  OR
  -- Fallback: check if clerk_user_id matches the JWT sub claim
  clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
);

-- Create helper function to get Clerk user ID from JWT claims
-- This function extracts the Clerk user ID from the JWT token
CREATE OR REPLACE FUNCTION get_clerk_user_id_from_jwt()
RETURNS TEXT AS $$
BEGIN
  -- Try to get Clerk user ID from JWT claims
  -- Clerk JWT will have 'sub' claim containing user ID (format: user_xxxxx)
  RETURN current_setting('request.jwt.claims', true)::json->>'sub';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_clerk_user_id_from_jwt() TO authenticated;

-- Update the RLS policy to use the helper function
DROP POLICY IF EXISTS "user_profiles_own_data" ON user_profiles;

CREATE POLICY "user_profiles_own_data" ON user_profiles
FOR ALL
USING (
  -- Supabase auth users (email/password)
  auth.uid() = id
  OR
  -- Clerk OAuth users (check if clerk_user_id matches JWT sub claim)
  clerk_user_id = get_clerk_user_id_from_jwt()
);

-- Add comment explaining the policy
COMMENT ON POLICY "user_profiles_own_data" ON user_profiles IS 
'Users can access their own profile data. Supports both Supabase auth.uid() and Clerk OAuth user ID.';

