-- Migration: Add Onboarding Progress Fields to user_profiles table
-- Purpose: Track onboarding progress, checklist completion, and first-time milestones
-- PRD Reference: US-007 from prd-onboarding-enhancement.md
-- Date: February 2025

-- ============================================================================
-- PART 1: Add new columns to user_profiles table
-- ============================================================================

-- Add onboarding_completed flag (has user completed all onboarding steps?)
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- Add onboarding_progress JSONB for flexible checklist state tracking
-- Structure: { "create_account": true, "first_story": false, "first_image": false, "first_voice": false, "first_streak": false }
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS onboarding_progress JSONB DEFAULT '{
  "create_account": true,
  "first_story": false,
  "first_image": false,
  "first_voice": false,
  "first_streak": false
}'::jsonb;

-- Add timestamp fields for tracking first-time milestone achievements
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS first_story_completed_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS first_image_generated_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS first_voice_input_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS first_streak_achieved_at TIMESTAMP WITH TIME ZONE;

-- ============================================================================
-- PART 2: Add indexes for performance
-- ============================================================================

-- Index for querying users who haven't completed onboarding (for analytics/re-engagement)
CREATE INDEX IF NOT EXISTS idx_user_profiles_onboarding_completed
ON user_profiles (onboarding_completed)
WHERE onboarding_completed = false;

-- Index for milestone timestamp queries (analytics)
CREATE INDEX IF NOT EXISTS idx_user_profiles_first_story_completed_at
ON user_profiles (first_story_completed_at DESC)
WHERE first_story_completed_at IS NOT NULL;

-- ============================================================================
-- PART 3: Add column documentation
-- ============================================================================

COMMENT ON COLUMN user_profiles.onboarding_completed IS
'Whether user has completed all onboarding checklist items. Defaults to false for new users.';

COMMENT ON COLUMN user_profiles.onboarding_progress IS
'JSONB tracking individual onboarding checklist item completion. Keys: create_account, first_story, first_image, first_voice, first_streak.';

COMMENT ON COLUMN user_profiles.first_story_completed_at IS
'Timestamp when user completed their first story ever. Used for celebration trigger and XP award tracking.';

COMMENT ON COLUMN user_profiles.first_image_generated_at IS
'Timestamp when user generated their first AI illustration. Used for celebration trigger and XP award tracking.';

COMMENT ON COLUMN user_profiles.first_voice_input_at IS
'Timestamp when user first used voice input feature. Used for onboarding checklist and XP award tracking.';

COMMENT ON COLUMN user_profiles.first_streak_achieved_at IS
'Timestamp when user first achieved a 2-day streak. Used for celebration trigger and XP award tracking.';

-- ============================================================================
-- PART 4: Helper functions for onboarding management
-- ============================================================================

-- Function to update a specific onboarding progress item
CREATE OR REPLACE FUNCTION update_onboarding_progress_item(
    p_user_id UUID,
    p_item_key TEXT,
    p_completed BOOLEAN DEFAULT true
)
RETURNS BOOLEAN AS $$
DECLARE
    v_valid_keys TEXT[] := ARRAY['create_account', 'first_story', 'first_image', 'first_voice', 'first_streak'];
    v_progress JSONB;
    v_all_completed BOOLEAN;
BEGIN
    -- Validate item key
    IF NOT (p_item_key = ANY(v_valid_keys)) THEN
        RAISE EXCEPTION 'Invalid onboarding item key: %. Valid keys are: %', p_item_key, v_valid_keys;
    END IF;

    -- Update the specific progress item
    UPDATE user_profiles
    SET
        onboarding_progress = jsonb_set(
            COALESCE(onboarding_progress, '{}'::jsonb),
            ARRAY[p_item_key],
            to_jsonb(p_completed)
        ),
        updated_at = NOW()
    WHERE id = p_user_id
    RETURNING onboarding_progress INTO v_progress;

    -- Check if all items are now completed
    IF v_progress IS NOT NULL THEN
        v_all_completed := (
            COALESCE((v_progress->>'create_account')::boolean, false) AND
            COALESCE((v_progress->>'first_story')::boolean, false) AND
            COALESCE((v_progress->>'first_image')::boolean, false) AND
            COALESCE((v_progress->>'first_voice')::boolean, false) AND
            COALESCE((v_progress->>'first_streak')::boolean, false)
        );

        -- Auto-mark onboarding as completed if all items done
        IF v_all_completed THEN
            UPDATE user_profiles
            SET onboarding_completed = true, updated_at = NOW()
            WHERE id = p_user_id;
        END IF;
    END IF;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record first-time milestone with timestamp and XP award
CREATE OR REPLACE FUNCTION record_onboarding_milestone(
    p_user_id UUID,
    p_milestone_type TEXT,
    p_xp_reward INTEGER DEFAULT 0
)
RETURNS BOOLEAN AS $$
DECLARE
    v_timestamp_column TEXT;
    v_progress_key TEXT;
    v_already_achieved BOOLEAN := false;
BEGIN
    -- Map milestone type to column and progress key
    CASE p_milestone_type
        WHEN 'first_story' THEN
            v_timestamp_column := 'first_story_completed_at';
            v_progress_key := 'first_story';
        WHEN 'first_image' THEN
            v_timestamp_column := 'first_image_generated_at';
            v_progress_key := 'first_image';
        WHEN 'first_voice' THEN
            v_timestamp_column := 'first_voice_input_at';
            v_progress_key := 'first_voice';
        WHEN 'first_streak' THEN
            v_timestamp_column := 'first_streak_achieved_at';
            v_progress_key := 'first_streak';
        ELSE
            RAISE EXCEPTION 'Invalid milestone type: %. Valid types: first_story, first_image, first_voice, first_streak', p_milestone_type;
    END CASE;

    -- Check if milestone already achieved (idempotent)
    EXECUTE format(
        'SELECT %I IS NOT NULL FROM user_profiles WHERE id = $1',
        v_timestamp_column
    ) INTO v_already_achieved USING p_user_id;

    -- If already achieved, return false (no XP awarded)
    IF v_already_achieved THEN
        RETURN false;
    END IF;

    -- Record the milestone timestamp
    EXECUTE format(
        'UPDATE user_profiles SET %I = NOW(), updated_at = NOW() WHERE id = $1',
        v_timestamp_column
    ) USING p_user_id;

    -- Update onboarding progress
    PERFORM update_onboarding_progress_item(p_user_id, v_progress_key, true);

    -- Award XP if specified
    IF p_xp_reward > 0 THEN
        UPDATE user_profiles
        SET total_xp = total_xp + p_xp_reward, updated_at = NOW()
        WHERE id = p_user_id;
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get onboarding status for a user
CREATE OR REPLACE FUNCTION get_onboarding_status(p_user_id UUID)
RETURNS TABLE(
    onboarding_completed BOOLEAN,
    onboarding_progress JSONB,
    first_story_completed_at TIMESTAMP WITH TIME ZONE,
    first_image_generated_at TIMESTAMP WITH TIME ZONE,
    first_voice_input_at TIMESTAMP WITH TIME ZONE,
    first_streak_achieved_at TIMESTAMP WITH TIME ZONE,
    completion_percentage INTEGER
) AS $$
DECLARE
    v_progress JSONB;
    v_completed_count INTEGER := 0;
BEGIN
    RETURN QUERY
    SELECT
        up.onboarding_completed,
        up.onboarding_progress,
        up.first_story_completed_at,
        up.first_image_generated_at,
        up.first_voice_input_at,
        up.first_streak_achieved_at,
        (
            (CASE WHEN COALESCE((up.onboarding_progress->>'create_account')::boolean, false) THEN 20 ELSE 0 END) +
            (CASE WHEN COALESCE((up.onboarding_progress->>'first_story')::boolean, false) THEN 20 ELSE 0 END) +
            (CASE WHEN COALESCE((up.onboarding_progress->>'first_image')::boolean, false) THEN 20 ELSE 0 END) +
            (CASE WHEN COALESCE((up.onboarding_progress->>'first_voice')::boolean, false) THEN 20 ELSE 0 END) +
            (CASE WHEN COALESCE((up.onboarding_progress->>'first_streak')::boolean, false) THEN 20 ELSE 0 END)
        )::INTEGER as completion_percentage
    FROM user_profiles up
    WHERE up.id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PART 5: Grant permissions to authenticated users
-- ============================================================================

GRANT EXECUTE ON FUNCTION update_onboarding_progress_item(UUID, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION record_onboarding_milestone(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_onboarding_status(UUID) TO authenticated;

-- ============================================================================
-- PART 6: Verification queries
-- ============================================================================

-- Verify columns were added
DO $$
BEGIN
    -- Check onboarding_completed column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_profiles' AND column_name = 'onboarding_completed'
    ) THEN
        RAISE EXCEPTION 'Column onboarding_completed was not created successfully';
    END IF;

    -- Check onboarding_progress column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_profiles' AND column_name = 'onboarding_progress'
    ) THEN
        RAISE EXCEPTION 'Column onboarding_progress was not created successfully';
    END IF;

    -- Check first_story_completed_at column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_profiles' AND column_name = 'first_story_completed_at'
    ) THEN
        RAISE EXCEPTION 'Column first_story_completed_at was not created successfully';
    END IF;

    -- Check first_image_generated_at column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_profiles' AND column_name = 'first_image_generated_at'
    ) THEN
        RAISE EXCEPTION 'Column first_image_generated_at was not created successfully';
    END IF;

    -- Check first_voice_input_at column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_profiles' AND column_name = 'first_voice_input_at'
    ) THEN
        RAISE EXCEPTION 'Column first_voice_input_at was not created successfully';
    END IF;

    -- Check first_streak_achieved_at column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_profiles' AND column_name = 'first_streak_achieved_at'
    ) THEN
        RAISE EXCEPTION 'Column first_streak_achieved_at was not created successfully';
    END IF;

    RAISE NOTICE 'All onboarding progress columns created successfully!';
END;
$$;

-- ============================================================================
-- PART 7: Rollback procedure (commented out - run if needed)
-- ============================================================================

/*
-- ROLLBACK: Remove onboarding progress fields
-- WARNING: This will delete all onboarding progress data!

DROP FUNCTION IF EXISTS get_onboarding_status(UUID);
DROP FUNCTION IF EXISTS record_onboarding_milestone(UUID, TEXT, INTEGER);
DROP FUNCTION IF EXISTS update_onboarding_progress_item(UUID, TEXT, BOOLEAN);

DROP INDEX IF EXISTS idx_user_profiles_first_story_completed_at;
DROP INDEX IF EXISTS idx_user_profiles_onboarding_completed;

ALTER TABLE user_profiles DROP COLUMN IF EXISTS first_streak_achieved_at;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS first_voice_input_at;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS first_image_generated_at;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS first_story_completed_at;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS onboarding_progress;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS onboarding_completed;
*/
