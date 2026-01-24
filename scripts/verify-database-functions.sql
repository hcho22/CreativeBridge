-- ============================================================================
-- Database Function Verification Script
-- ============================================================================
-- Purpose: Verify that all required database functions exist for statistics updates
-- Run this in Supabase SQL Editor to check if functions were deployed
--
-- Expected Result: Should show 5 functions if migration was successful
-- ============================================================================

-- Check if all required functions exist
SELECT
  proname as function_name,
  pg_get_function_arguments(oid) as arguments,
  pg_get_function_result(oid) as return_type,
  prosecdef as is_security_definer
FROM pg_proc
WHERE proname IN (
  'add_user_xp',
  'complete_game_session',
  'increment_games_played',
  'update_best_score',
  'increment_stories_completed'
)
ORDER BY proname;

-- If you see 0 rows, the migration was NOT run
-- If you see 5 rows, the functions exist ✅

-- ============================================================================
-- Quick Test: Verify function permissions
-- ============================================================================

SELECT
  proname,
  proacl as permissions
FROM pg_proc
WHERE proname = 'complete_game_session';

-- ============================================================================
-- Manual Test: Try calling the function with test data
-- ============================================================================
-- IMPORTANT: Replace 'YOUR_USER_ID_HERE' with your actual user UUID from user_profiles table
-- Uncomment the line below to test (after replacing the UUID)

-- SELECT complete_game_session(
--   'YOUR_USER_ID_HERE'::uuid,  -- user_uuid
--   100,                          -- xp_earned
--   50,                           -- words_written
--   200                           -- final_score
-- );

-- After running, check your user_profiles to see if stats updated:
-- SELECT total_xp, total_games_played, total_words_written, best_score
-- FROM user_profiles
-- WHERE id = 'YOUR_USER_ID_HERE';
