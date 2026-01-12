-- Migration: Remove foreign key constraint on user_profiles.id to support OAuth users
-- Purpose: Allow OAuth users (who authenticate via Clerk) to create profiles without
--          requiring a matching entry in auth.users table
-- Date: 2024-12-19

-- Background:
-- The user_profiles.id column currently has a foreign key constraint to auth.users.id
-- This prevents OAuth users from creating profiles because they don't have entries
-- in the auth.users table (they authenticate via Clerk, not Supabase auth)

-- Step 1: Drop the existing foreign key constraint
ALTER TABLE user_profiles 
DROP CONSTRAINT IF EXISTS user_profiles_id_fkey;

-- Step 2: Add a comment explaining the change
COMMENT ON COLUMN user_profiles.id IS 
'Primary key. For email/password users, this matches auth.users.id. For OAuth users (Clerk), this is a generated UUID. Use clerk_user_id for OAuth user identification.';

-- Note: We keep the id column as the primary key, but it no longer requires
-- a matching entry in auth.users. OAuth users are identified by clerk_user_id instead.

-- The RLS policies already handle both cases:
-- - auth.uid() = id (for Supabase auth users)
-- - clerk_user_id = get_clerk_user_id_from_jwt() (for OAuth users)
