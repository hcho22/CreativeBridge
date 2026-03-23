-- ============================================================================
-- Migration Verification Queries
-- Purpose: Verify that add_story_completion_and_image_persistence.sql was successful
-- Run these queries after applying the migration to ensure data integrity
-- ============================================================================

-- ============================================================================
-- Test 1: Verify new columns exist with correct data types
-- ============================================================================
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'game_sessions'
  AND column_name IN (
    'current_round',
    'supabase_image_url',
    'image_upload_status',
    'image_upload_attempts',
    'image_upload_error'
  )
ORDER BY column_name;

-- Expected: 5 rows returned
-- current_round: integer, NO, 1
-- image_upload_attempts: integer, NO, 0
-- image_upload_error: text, YES, NULL
-- image_upload_status: text, YES, NULL
-- supabase_image_url: text, YES, NULL

-- ============================================================================
-- Test 2: Verify indexes were created
-- ============================================================================
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'game_sessions'
  AND indexname IN (
    'idx_game_sessions_completed_at',
    'idx_game_sessions_upload_status',
    'idx_game_sessions_user_completed_images'
  )
ORDER BY indexname;

-- Expected: 3 rows returned with index definitions

-- ============================================================================
-- Test 3: Check data integrity after migration
-- ============================================================================
SELECT
  COUNT(*) as total_sessions,
  COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END) as completed_sessions,
  COUNT(CASE WHEN current_round >= 5 THEN 1 END) as round_5_sessions,
  COUNT(CASE WHEN sentences_completed >= 10 AND completed_at IS NULL THEN 1 END) as should_be_completed_error,
  COUNT(CASE WHEN current_round > 5 THEN 1 END) as round_exceeds_max_error,
  COUNT(CASE WHEN current_round < 1 THEN 1 END) as round_below_min_error
FROM game_sessions;

-- Expected:
-- - total_sessions: your actual count
-- - should_be_completed_error: 0 (all stories with 10+ sentences should be marked complete)
-- - round_exceeds_max_error: 0 (no stories should have current_round > 5)
-- - round_below_min_error: 0 (no stories should have current_round < 1)

-- ============================================================================
-- Test 4: Verify data migration worked correctly
-- ============================================================================
-- Check that completed stories have appropriate current_round values
SELECT
  id,
  sentences_completed,
  current_round,
  completed_at,
  CASE
    WHEN sentences_completed >= 10 AND completed_at IS NULL THEN 'ERROR: Should be completed'
    WHEN current_round > 5 THEN 'ERROR: Round > MAX_ROUNDS'
    WHEN current_round < 1 THEN 'ERROR: Round < 1'
    WHEN sentences_completed >= 10 AND current_round < 5 THEN 'WARNING: High sentences but low round'
    ELSE 'OK'
  END as validation_status
FROM game_sessions
WHERE
  (sentences_completed >= 10 AND completed_at IS NULL)  -- Should be completed
  OR current_round > 5  -- Round exceeds max
  OR current_round < 1  -- Round below min
  OR (sentences_completed >= 10 AND current_round < 5)  -- Warning case
LIMIT 20;

-- Expected: 0 rows (no validation errors)

-- ============================================================================
-- Test 5: Check constraint enforcement
-- ============================================================================
-- This should fail (testing that constraints work)
-- DO NOT RUN IN PRODUCTION - THIS IS A TEST
/*
INSERT INTO game_sessions (
  user_id,
  grade_level,
  current_round,
  image_upload_status,
  final_score,
  words_written,
  sentences_completed,
  challenges_completed,
  xp_earned,
  story_source,
  story_metadata
) VALUES (
  'test-user-id',
  'K-2',
  10, -- Should fail: exceeds max of 5
  'invalid_status', -- Should fail: not in allowed values
  0,
  0,
  0,
  0,
  0,
  'New',
  '{}'::jsonb
);
*/

-- Expected: Error with message about constraint violation
-- If this succeeds, the constraints are NOT working correctly!

-- ============================================================================
-- Test 6: Sample data inspection (manual review)
-- ============================================================================
-- Inspect 10 random completed stories
SELECT
  id,
  created_at,
  completed_at,
  sentences_completed,
  current_round,
  generated_image_url IS NOT NULL as has_replicate_image,
  supabase_image_url IS NOT NULL as has_supabase_image,
  image_upload_status
FROM game_sessions
WHERE completed_at IS NOT NULL
ORDER BY RANDOM()
LIMIT 10;

-- Manual check:
-- - completed stories should have current_round = 5 (or close to it)
-- - completed_at should be set
-- - sentences_completed should be >= 10 for most completed stories

-- ============================================================================
-- Test 7: Inspect in-progress stories
-- ============================================================================
-- Check 10 random incomplete stories
SELECT
  id,
  created_at,
  sentences_completed,
  current_round,
  completed_at
FROM game_sessions
WHERE completed_at IS NULL
ORDER BY RANDOM()
LIMIT 10;

-- Manual check:
-- - current_round should correlate with sentences_completed (roughly half)
-- - completed_at should be NULL
-- - current_round should be between 1 and 4

-- ============================================================================
-- Test 8: Verify RLS policies still work
-- ============================================================================
-- Test that existing RLS policies apply to new columns
-- This query should only return the current user's sessions
-- Run this as an authenticated user (not admin)
/*
SELECT
  current_round,
  supabase_image_url,
  image_upload_status
FROM game_sessions
WHERE user_id = auth.uid()
LIMIT 5;
*/

-- Expected: Only returns current user's data
-- If you can see other users' data, RLS is broken!

-- ============================================================================
-- Test 9: Performance check on new indexes
-- ============================================================================
-- Check that queries using new indexes are efficient
EXPLAIN ANALYZE
SELECT *
FROM game_sessions
WHERE completed_at IS NOT NULL
  AND generated_image_url IS NOT NULL
ORDER BY completed_at DESC
LIMIT 10;

-- Expected: Query plan should show "Index Scan" using idx_game_sessions_user_completed_images
-- Execution time should be < 50ms even with large datasets

-- ============================================================================
-- Test 10: Summary Statistics
-- ============================================================================
SELECT
  'Total Sessions' as metric,
  COUNT(*) as value
FROM game_sessions

UNION ALL

SELECT
  'Completed Sessions',
  COUNT(*)
FROM game_sessions
WHERE completed_at IS NOT NULL

UNION ALL

SELECT
  'Sessions at Round 5',
  COUNT(*)
FROM game_sessions
WHERE current_round = 5

UNION ALL

SELECT
  'Sessions with Replicate Images',
  COUNT(*)
FROM game_sessions
WHERE generated_image_url IS NOT NULL

UNION ALL

SELECT
  'Sessions with Supabase Images',
  COUNT(*)
FROM game_sessions
WHERE supabase_image_url IS NOT NULL

UNION ALL

SELECT
  'Upload Status: Pending',
  COUNT(*)
FROM game_sessions
WHERE image_upload_status = 'pending'

UNION ALL

SELECT
  'Upload Status: Uploaded',
  COUNT(*)
FROM game_sessions
WHERE image_upload_status = 'uploaded'

UNION ALL

SELECT
  'Upload Status: Failed',
  COUNT(*)
FROM game_sessions
WHERE image_upload_status = 'failed';

-- Review these numbers to ensure they make sense for your data

-- ============================================================================
-- VERIFICATION COMPLETE
-- ============================================================================
-- If all tests pass:
-- ✅ Migration successful - columns added, indexes created, data migrated
-- ✅ Constraints working - invalid data rejected
-- ✅ RLS policies intact - users can only see their own data
-- ✅ Performance good - indexes being used effectively
--
-- If any test fails:
-- ❌ Review the error and determine if rollback is needed
-- ❌ Check rollback_story_completion_and_image_persistence.sql
-- ❌ Contact team before proceeding
-- ============================================================================
