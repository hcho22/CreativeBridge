-- ============================================================================
-- Quick Database Function Check
-- ============================================================================
-- Copy and paste this into Supabase SQL Editor to check if functions exist
-- ============================================================================

-- Check if all required functions exist
SELECT
  '🔍 Checking for required database functions...' as status;

SELECT
  proname as function_name,
  pg_get_function_arguments(oid) as arguments,
  CASE
    WHEN proname = 'complete_game_session' THEN '⭐ CRITICAL - Called on story completion'
    WHEN proname = 'add_user_xp' THEN '💰 Important - Used for XP economy'
    WHEN proname = 'update_user_streak' THEN '🔥 Important - Used for streak tracking'
    ELSE '📝 Helper function'
  END as importance
FROM pg_proc
WHERE proname IN (
  'add_user_xp',
  'complete_game_session',
  'increment_games_played',
  'update_best_score',
  'increment_stories_completed',
  'update_user_streak'  -- This should already exist
)
ORDER BY proname;

-- ============================================================================
-- Interpretation Guide:
-- ============================================================================
-- Expected rows: 5-6 functions
--
-- If you see 0-1 rows:
--   ❌ MIGRATION NOT RUN
--   👉 You need to run: sql/create_add_user_xp_function.sql
--
-- If you see 5-6 rows:
--   ✅ FUNCTIONS EXIST
--   👉 The database is properly configured
--
-- If you see 'update_user_streak' but not the others:
--   ⚠️  OLD SETUP - Missing new functions
--   👉 You need to run the migration
-- ============================================================================
