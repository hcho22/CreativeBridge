/**
 * Debug Script: Session Completion Issue
 *
 * This script helps debug why user statistics aren't updating after game completion.
 *
 * To use:
 * 1. Copy a session ID from your app logs
 * 2. Run this query in Supabase SQL Editor (replace SESSION_ID)
 * 3. Check the output to understand the session state
 */

const debugQueries = `
-- ============================================================================
-- STEP 1: Check if the database functions exist
-- ============================================================================
SELECT 'STEP 1: Checking if database functions exist...' as step;

SELECT
  proname as function_name,
  pg_get_function_arguments(oid) as arguments
FROM pg_proc
WHERE proname IN (
  'add_user_xp',
  'complete_game_session',
  'increment_games_played',
  'update_best_score',
  'increment_stories_completed'
)
ORDER BY proname;

-- Expected: 5 rows
-- If 0 rows: YOU NEED TO RUN THE MIGRATION FIRST!

-- ============================================================================
-- STEP 2: Check recent game sessions for completion
-- ============================================================================
SELECT 'STEP 2: Checking recent game sessions...' as step;

SELECT
  id,
  user_id,
  created_at,
  completed_at,
  current_round,
  words_written,
  xp_earned,
  final_score,
  sentences_completed,
  CASE
    WHEN completed_at IS NULL THEN '❌ NOT COMPLETED'
    WHEN xp_earned = 0 THEN '⚠️  COMPLETED BUT NO XP'
    ELSE '✅ COMPLETED WITH XP'
  END as status
FROM game_sessions
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 10;

-- Look for sessions with completed_at set but xp_earned = 0
-- This indicates the statistics update didn't run

-- ============================================================================
-- STEP 3: Check user profile statistics
-- ============================================================================
SELECT 'STEP 3: Checking user profile statistics...' as step;

SELECT
  up.username,
  up.total_xp,
  up.total_games_played,
  up.total_words_written,
  up.total_stories_completed,
  up.best_score,
  up.last_activity_date,
  up.updated_at,
  COUNT(gs.id) as actual_completed_games
FROM user_profiles up
LEFT JOIN game_sessions gs ON gs.user_id = up.id AND gs.completed_at IS NOT NULL
WHERE up.id IN (
  SELECT DISTINCT user_id
  FROM game_sessions
  WHERE created_at > NOW() - INTERVAL '24 hours'
)
GROUP BY up.id, up.username
ORDER BY up.updated_at DESC;

-- Compare actual_completed_games with total_games_played
-- If they don't match, statistics aren't updating

-- ============================================================================
-- STEP 4: Check a specific session (REPLACE SESSION_ID)
-- ============================================================================
SELECT 'STEP 4: Checking specific session...' as step;

-- UNCOMMENT AND REPLACE 'YOUR_SESSION_ID' with actual session ID
/*
SELECT
  id as session_id,
  user_id,
  created_at,
  completed_at,
  current_round,
  words_written,
  sentences_completed,
  xp_earned,
  final_score,
  CASE
    WHEN current_round < 5 THEN '🔄 IN PROGRESS (Round ' || current_round || '/5)'
    WHEN current_round >= 5 AND completed_at IS NULL THEN '⚠️  REACHED ROUND 5 BUT NOT MARKED COMPLETE!'
    WHEN current_round >= 5 AND completed_at IS NOT NULL AND xp_earned = 0 THEN '❌ COMPLETED BUT STATS NOT UPDATED'
    WHEN current_round >= 5 AND completed_at IS NOT NULL AND xp_earned > 0 THEN '✅ FULLY COMPLETED'
    ELSE '❓ UNKNOWN STATE'
  END as session_status
FROM game_sessions
WHERE id = 'YOUR_SESSION_ID';
*/

-- ============================================================================
-- STEP 5: Test the function manually
-- ============================================================================
SELECT 'STEP 5: Manual function test...' as step;

-- Find a user who has completed games
-- UNCOMMENT AND REPLACE 'YOUR_USER_ID' with actual user ID
/*
SELECT complete_game_session(
  'YOUR_USER_ID'::uuid,
  100,  -- xp_earned
  50,   -- words_written
  200   -- final_score
);

-- Then check if their stats updated:
SELECT total_xp, total_games_played, total_words_written, best_score
FROM user_profiles
WHERE id = 'YOUR_USER_ID';
*/

-- ============================================================================
-- STEP 6: Check for database errors or logs
-- ============================================================================
SELECT 'STEP 6: Checking for recent database notices/errors...' as step;

-- This might not work depending on your Supabase permissions
-- SELECT * FROM pg_stat_activity WHERE state = 'active';

SELECT 'Debug queries complete. Review results above.' as result;
`;

console.log(debugQueries);

module.exports = { debugQueries };
