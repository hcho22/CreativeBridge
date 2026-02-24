-- Migration: Create add_user_xp function for XP and statistics management
-- Date: 2026-01-22
-- Description: Creates the missing add_user_xp database function that is referenced throughout the codebase

-- ============================================================================
-- PART 1: Create add_user_xp function
-- ============================================================================

CREATE OR REPLACE FUNCTION add_user_xp(
    user_uuid UUID,
    xp_to_add INTEGER,
    words_added INTEGER DEFAULT 0
)
RETURNS VOID AS $$
BEGIN
    -- Update user profile with XP and words
    -- This function handles both positive (earning) and negative (spending) XP
    UPDATE public.user_profiles
    SET
        total_xp = GREATEST(total_xp + xp_to_add, 0),  -- Prevent negative XP
        total_words_written = total_words_written + GREATEST(words_added, 0),  -- Only add positive words
        updated_at = NOW()
    WHERE id = user_uuid;

    -- Log the transaction for debugging (optional)
    RAISE NOTICE 'XP Updated: User %, XP change: %, Words added: %', user_uuid, xp_to_add, words_added;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PART 2: Create function to increment games played
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_games_played(user_uuid UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.user_profiles
    SET
        total_games_played = total_games_played + 1,
        updated_at = NOW()
    WHERE id = user_uuid;

    RAISE NOTICE 'Games played incremented for user: %', user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PART 3: Create function to update best score
-- ============================================================================

CREATE OR REPLACE FUNCTION update_best_score(
    user_uuid UUID,
    new_score INTEGER
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.user_profiles
    SET
        best_score = GREATEST(best_score, new_score),
        updated_at = NOW()
    WHERE id = user_uuid;

    RAISE NOTICE 'Best score updated for user % to %', user_uuid, new_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PART 4: Create function to increment stories completed
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_stories_completed(user_uuid UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.user_profiles
    SET
        total_stories_completed = total_stories_completed + 1,
        updated_at = NOW()
    WHERE id = user_uuid;

    RAISE NOTICE 'Stories completed incremented for user: %', user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PART 5: Create comprehensive game completion function
-- ============================================================================

-- This function should be called when a game/story is completed
-- It updates all relevant statistics in one transaction
CREATE OR REPLACE FUNCTION complete_game_session(
    user_uuid UUID,
    xp_earned INTEGER,
    words_written INTEGER,
    final_score INTEGER
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.user_profiles
    SET
        total_xp = total_xp + GREATEST(xp_earned, 0),
        total_words_written = total_words_written + GREATEST(words_written, 0),
        total_games_played = total_games_played + 1,
        total_stories_completed = total_stories_completed + 1,
        best_score = GREATEST(best_score, final_score),
        updated_at = NOW()
    WHERE id = user_uuid;

    -- Also update the streak
    PERFORM update_user_streak(user_uuid);

    RAISE NOTICE 'Game completed for user %: XP +%, Words +%, Score %',
                 user_uuid, xp_earned, words_written, final_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PART 6: Grant execute permissions
-- ============================================================================

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION add_user_xp(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_games_played(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_best_score(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_stories_completed(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_game_session(UUID, INTEGER, INTEGER, INTEGER) TO authenticated;

-- ============================================================================
-- PART 7: Verification
-- ============================================================================

SELECT 'add_user_xp and related functions created successfully' as status;

-- Test queries (comment out in production)
-- SELECT proname, proargtypes FROM pg_proc WHERE proname LIKE '%user_xp%' OR proname LIKE '%game%';
