-- Migration: Add Story Completion Tracking and Image Persistence
-- Date: 2026-01-06
-- Description: Adds columns for tracking story completion rounds and Supabase image storage

-- ============================================================================
-- PART 1: Add New Columns
-- ============================================================================

-- Add story completion tracking column
ALTER TABLE game_sessions
  ADD COLUMN IF NOT EXISTS current_round INTEGER NOT NULL DEFAULT 1
  CHECK (current_round >= 1 AND current_round <= 5);

-- Add Supabase image storage columns
ALTER TABLE game_sessions
  ADD COLUMN IF NOT EXISTS supabase_image_url TEXT,
  ADD COLUMN IF NOT EXISTS image_upload_status TEXT
  CHECK (image_upload_status IN ('pending', 'uploaded', 'failed')),
  ADD COLUMN IF NOT EXISTS image_upload_attempts INTEGER NOT NULL DEFAULT 0
  CHECK (image_upload_attempts >= 0),
  ADD COLUMN IF NOT EXISTS image_upload_error TEXT;

-- ============================================================================
-- PART 2: Create Indexes for Performance
-- ============================================================================

-- Index for querying completed stories
CREATE INDEX IF NOT EXISTS idx_game_sessions_completed_at
  ON game_sessions(completed_at)
  WHERE completed_at IS NOT NULL;

-- Index for querying failed uploads (for retry operations)
CREATE INDEX IF NOT EXISTS idx_game_sessions_upload_status
  ON game_sessions(image_upload_status)
  WHERE image_upload_status IS NOT NULL;

-- Composite index for user's completed stories with images
CREATE INDEX IF NOT EXISTS idx_game_sessions_user_completed_images
  ON game_sessions(user_id, completed_at, generated_image_url)
  WHERE completed_at IS NOT NULL AND generated_image_url IS NOT NULL;

-- ============================================================================
-- PART 3: Data Migration for Existing Records
-- ============================================================================

-- Auto-complete stories that have reached MAX_ROUNDS (5 contributions)
-- Use sentences_completed as proxy for rounds (each round = 1 user + 1 AI contribution)
-- Cap at 5 to respect CHECK constraint (current_round must be 1-5)
UPDATE game_sessions
SET
  completed_at = COALESCE(
    completed_at,
    -- Estimate completion time as 30 minutes after creation
    created_at + INTERVAL '30 minutes'
  ),
  current_round = LEAST(GREATEST(CEIL(sentences_completed::DECIMAL / 2), 1), 5)
WHERE
  sentences_completed >= 10  -- 10 sentences = 5 rounds (5 user + 5 AI)
  AND completed_at IS NULL;

-- Set current_round for incomplete stories
-- Each round = 1 user contribution + 1 AI contribution
-- Use LEAST to cap at 5, GREATEST to ensure minimum of 1
UPDATE game_sessions
SET current_round = LEAST(GREATEST(CEIL(sentences_completed::DECIMAL / 2), 1), 5)
WHERE sentences_completed < 10 AND current_round = 1;

-- ============================================================================
-- PART 4: Add Comments for Documentation
-- ============================================================================

COMMENT ON COLUMN game_sessions.current_round IS
  'Current round of the story (1-5). Increments after each AI response. Story completes at round 5.';

COMMENT ON COLUMN game_sessions.supabase_image_url IS
  'Permanent image URL in Supabase Storage. Fallback to generated_image_url if null.';

COMMENT ON COLUMN game_sessions.image_upload_status IS
  'Upload status: pending (uploading), uploaded (success), failed (retry available)';

COMMENT ON COLUMN game_sessions.image_upload_attempts IS
  'Number of upload attempts to Supabase Storage (max 3 per user request)';

COMMENT ON COLUMN game_sessions.image_upload_error IS
  'Last error message from failed Supabase upload (for debugging)';

-- ============================================================================
-- PART 5: Verify Migration
-- ============================================================================

-- This query should return 5 rows with the new columns
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

-- This query should show index creation status
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'game_sessions'
  AND indexname LIKE 'idx_game_sessions_%'
ORDER BY indexname;

-- ============================================================================
-- PART 6: RLS Policies (Row Level Security)
-- ============================================================================

-- Note: Existing RLS policies on game_sessions table should automatically
-- apply to new columns. Verify that users can only access their own data:

-- Test RLS (should only return current user's sessions)
-- SELECT current_round, supabase_image_url, image_upload_status
-- FROM game_sessions
-- WHERE user_id = auth.uid();
