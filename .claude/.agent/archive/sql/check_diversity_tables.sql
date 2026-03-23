-- Quick diagnostic script to check if diversity tables exist
-- Run this in your Supabase SQL editor to verify the setup

-- Check if story_elements table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'story_elements'
) AS story_elements_exists;

-- Check if user_sessions table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'user_sessions'
) AS user_sessions_exists;

-- Check if story_diversity_scores table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'story_diversity_scores'
) AS story_diversity_scores_exists;

-- If all three exist, check the structure of story_elements
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'story_elements'
ORDER BY ordinal_position;

-- Check for any existing data
SELECT COUNT(*) as total_elements FROM public.story_elements;

-- Check indexes
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename = 'story_elements';
