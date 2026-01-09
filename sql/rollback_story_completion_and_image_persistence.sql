-- Rollback Migration: Remove Story Completion Tracking and Image Persistence
-- Date: 2026-01-06
-- Description: Safely removes columns added for story completion and image persistence
-- WARNING: This will permanently delete data in the new columns

-- ============================================================================
-- PART 1: Drop Indexes
-- ============================================================================

DROP INDEX IF EXISTS idx_game_sessions_user_completed_images;
DROP INDEX IF EXISTS idx_game_sessions_upload_status;
DROP INDEX IF EXISTS idx_game_sessions_completed_at;

-- ============================================================================
-- PART 2: Drop Columns
-- ============================================================================

-- Remove image persistence columns
ALTER TABLE game_sessions
  DROP COLUMN IF EXISTS image_upload_error,
  DROP COLUMN IF EXISTS image_upload_attempts,
  DROP COLUMN IF EXISTS image_upload_status,
  DROP COLUMN IF EXISTS supabase_image_url;

-- Remove story completion tracking column
ALTER TABLE game_sessions
  DROP COLUMN IF EXISTS current_round;

-- ============================================================================
-- PART 3: Verify Rollback
-- ============================================================================

-- This query should return 0 rows (columns removed)
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'game_sessions'
  AND column_name IN (
    'current_round',
    'supabase_image_url',
    'image_upload_status',
    'image_upload_attempts',
    'image_upload_error'
  );

-- This query should not show the dropped indexes
SELECT indexname
FROM pg_indexes
WHERE tablename = 'game_sessions'
  AND indexname IN (
    'idx_game_sessions_completed_at',
    'idx_game_sessions_upload_status',
    'idx_game_sessions_user_completed_images'
  );
