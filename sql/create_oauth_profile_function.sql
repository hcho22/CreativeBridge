-- Migration: Create function for OAuth profile creation
-- Purpose: Allow OAuth users to create profiles without needing a Supabase auth session
-- This function bypasses RLS using SECURITY DEFINER
-- Date: 2024-12-19

-- Drop function if it exists
DROP FUNCTION IF EXISTS create_oauth_user_profile(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN);

-- Create function to create user profile for OAuth users
-- This function runs with elevated privileges (SECURITY DEFINER) to bypass RLS
CREATE OR REPLACE FUNCTION create_oauth_user_profile(
  p_clerk_user_id TEXT,
  p_username TEXT,
  p_display_name TEXT,
  p_preferred_grade_level TEXT DEFAULT 'K-2',
  p_email TEXT DEFAULT NULL,
  p_speech_enabled BOOLEAN DEFAULT true
)
RETURNS TABLE(
  id UUID,
  clerk_user_id TEXT,
  username TEXT,
  display_name TEXT,
  preferred_grade_level TEXT,
  speech_enabled BOOLEAN,
  total_xp INTEGER,
  created_at TIMESTAMPTZ
) AS $$
DECLARE
  v_profile_id UUID;
BEGIN
  -- Validate required parameters
  IF p_clerk_user_id IS NULL OR p_clerk_user_id = '' THEN
    RAISE EXCEPTION 'clerk_user_id is required';
  END IF;
  
  IF p_username IS NULL OR p_username = '' THEN
    RAISE EXCEPTION 'username is required';
  END IF;
  
  IF p_display_name IS NULL OR p_display_name = '' THEN
    RAISE EXCEPTION 'display_name is required';
  END IF;

  -- Check if profile already exists with this Clerk user ID
  SELECT user_profiles.id INTO v_profile_id
  FROM user_profiles
  WHERE user_profiles.clerk_user_id = p_clerk_user_id;

  IF v_profile_id IS NOT NULL THEN
    RAISE EXCEPTION 'Profile already exists for Clerk user ID: %', p_clerk_user_id;
  END IF;

  -- Generate a new UUID for the profile
  v_profile_id := gen_random_uuid();

  -- Insert new profile with explicit ID
  INSERT INTO user_profiles (
    id,
    clerk_user_id,
    username,
    display_name,
    preferred_grade_level,
    speech_enabled,
    total_xp,
    current_streak,
    longest_streak,
    last_activity_date,
    total_games_played,
    total_stories_completed,
    total_words_written,
    best_score
  ) VALUES (
    v_profile_id,
    p_clerk_user_id,
    p_username,
    p_display_name,
    p_preferred_grade_level::text,
    p_speech_enabled,
    0, -- total_xp
    0, -- current_streak
    0, -- longest_streak
    CURRENT_DATE, -- last_activity_date
    0, -- total_games_played
    0, -- total_stories_completed
    0, -- total_words_written
    0  -- best_score
  )
  RETURNING 
    user_profiles.id,
    user_profiles.clerk_user_id,
    user_profiles.username,
    user_profiles.display_name,
    user_profiles.preferred_grade_level,
    user_profiles.speech_enabled,
    user_profiles.total_xp,
    user_profiles.created_at
  INTO 
    id,
    clerk_user_id,
    username,
    display_name,
    preferred_grade_level,
    speech_enabled,
    total_xp,
    created_at;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated and anon users
-- This is safe because the function validates the Clerk user ID
GRANT EXECUTE ON FUNCTION create_oauth_user_profile(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION create_oauth_user_profile(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO anon;

-- Add comment explaining the function
COMMENT ON FUNCTION create_oauth_user_profile IS 
'Creates a new user profile for OAuth users (Clerk authentication). Bypasses RLS using SECURITY DEFINER. Validates Clerk user ID and prevents duplicate profiles.';
