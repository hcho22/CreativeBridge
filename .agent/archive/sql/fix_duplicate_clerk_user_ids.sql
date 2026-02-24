-- Fix duplicate clerk_user_id entries in user_profiles table
-- This script identifies and consolidates duplicate profiles

-- Step 1: Find duplicate clerk_user_ids
-- Run this first to see if you have duplicates:
SELECT
    clerk_user_id,
    COUNT(*) as duplicate_count,
    array_agg(id) as profile_ids,
    array_agg(username) as usernames,
    array_agg(created_at) as created_dates
FROM user_profiles
WHERE clerk_user_id IS NOT NULL
GROUP BY clerk_user_id
HAVING COUNT(*) > 1;

-- Step 2: For each duplicate, keep the oldest profile and delete the rest
-- This consolidates data and removes duplicates
DO $$
DECLARE
    duplicate_record RECORD;
    keep_profile_id UUID;
    delete_profile_ids UUID[];
BEGIN
    -- Loop through each clerk_user_id that has duplicates
    FOR duplicate_record IN
        SELECT
            clerk_user_id,
            array_agg(id ORDER BY created_at ASC) as profile_ids
        FROM user_profiles
        WHERE clerk_user_id IS NOT NULL
        GROUP BY clerk_user_id
        HAVING COUNT(*) > 1
    LOOP
        -- Keep the oldest profile (first in the sorted array)
        keep_profile_id := duplicate_record.profile_ids[1];

        -- Mark the rest for deletion
        delete_profile_ids := duplicate_record.profile_ids[2:];

        RAISE NOTICE 'Clerk User ID: %, Keeping profile: %, Deleting profiles: %',
            duplicate_record.clerk_user_id, keep_profile_id, delete_profile_ids;

        -- Merge data from newer profiles into the kept profile (if needed)
        -- This ensures we don't lose any important data
        UPDATE user_profiles
        SET
            username = COALESCE(
                (SELECT username FROM user_profiles WHERE id = ANY(delete_profile_ids) AND username IS NOT NULL LIMIT 1),
                username
            ),
            display_name = COALESCE(
                (SELECT display_name FROM user_profiles WHERE id = ANY(delete_profile_ids) AND display_name IS NOT NULL LIMIT 1),
                display_name
            ),
            preferred_grade_level = COALESCE(
                (SELECT preferred_grade_level FROM user_profiles WHERE id = ANY(delete_profile_ids) AND preferred_grade_level IS NOT NULL LIMIT 1),
                preferred_grade_level
            ),
            avatar_url = COALESCE(
                (SELECT avatar_url FROM user_profiles WHERE id = ANY(delete_profile_ids) AND avatar_url IS NOT NULL LIMIT 1),
                avatar_url
            ),
            bio = COALESCE(
                (SELECT bio FROM user_profiles WHERE id = ANY(delete_profile_ids) AND bio IS NOT NULL LIMIT 1),
                bio
            )
        WHERE id = keep_profile_id;

        -- Update story_progress records to point to the kept profile
        UPDATE story_progress
        SET user_profile_id = keep_profile_id
        WHERE user_profile_id = ANY(delete_profile_ids);

        -- Update any other tables that reference user_profiles
        -- Add more UPDATE statements here if you have other foreign key references

        -- Delete the duplicate profiles
        DELETE FROM user_profiles
        WHERE id = ANY(delete_profile_ids);

        RAISE NOTICE 'Consolidated profiles for clerk_user_id: %', duplicate_record.clerk_user_id;
    END LOOP;
END $$;

-- Step 3: Verify no duplicates remain
SELECT
    clerk_user_id,
    COUNT(*) as count
FROM user_profiles
WHERE clerk_user_id IS NOT NULL
GROUP BY clerk_user_id
HAVING COUNT(*) > 1;

-- Should return no rows if successful
