-- Database Migration Validation Script
-- Run this script in your Supabase SQL editor to verify migrations are working correctly
-- This validates both Task 2.1 (game_sessions updates) and Task 2.2 (image_generation_events table)

-- =============================================================================
-- Task 2.1 Validation: Check game_sessions table has new image generation columns
-- =============================================================================

-- Check if new columns exist in game_sessions table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'game_sessions'
  AND column_name IN ('generated_image_url', 'image_generation_timestamp', 'image_generation_cost')
ORDER BY column_name;

-- Expected results:
-- generated_image_url | text | YES | NULL
-- image_generation_cost | integer | YES | 1000
-- image_generation_timestamp | timestamp with time zone | YES | NULL

-- Check if image generation functions exist
SELECT 
    routine_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'update_story_generated_image',
    'get_user_stories_with_images',
    'get_image_generation_stats'
  )
ORDER BY routine_name;

-- Expected results: 3 functions should be listed

-- Check if indexes were created for game_sessions image fields
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename = 'game_sessions'
  AND indexname LIKE '%image%'
ORDER BY indexname;

-- Expected results: 2 indexes for image generation fields

-- =============================================================================
-- Task 2.2 Validation: Check image_generation_events table exists and is properly configured
-- =============================================================================

-- Check if image_generation_events table exists
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'image_generation_events';

-- Expected result: 1 row showing the table exists

-- Check all columns in image_generation_events table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'image_generation_events'
ORDER BY ordinal_position;

-- Expected results: 15 columns with proper types and constraints

-- Check constraints on image_generation_events table
SELECT 
    constraint_name,
    constraint_type,
    check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.check_constraints cc 
    ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public' 
  AND tc.table_name = 'image_generation_events'
ORDER BY constraint_type, constraint_name;

-- Expected results: PRIMARY KEY, CHECK constraints, and FOREIGN KEY constraints

-- Check if image generation event functions exist
SELECT 
    routine_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'create_image_generation_event',
    'update_image_generation_event',
    'get_image_generation_analytics',
    'get_user_image_generation_events'
  )
ORDER BY routine_name;

-- Expected results: 4 functions should be listed

-- Check indexes on image_generation_events table
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename = 'image_generation_events'
ORDER BY indexname;

-- Expected results: 11 indexes for optimal query performance

-- Check RLS (Row Level Security) policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'image_generation_events'
ORDER BY policyname;

-- Expected results: 3 RLS policies for user data protection

-- =============================================================================
-- Task 2.3 Validation: Test actual database operations
-- =============================================================================

-- Test 1: Insert a game session with image generation data
-- Note: Replace 'your-user-id' with an actual user ID from your auth.users table
INSERT INTO public.game_sessions (
    user_id,
    grade_level,
    final_score,
    words_written,
    sentences_completed,
    challenges_completed,
    xp_earned,
    story_source,
    story_metadata,
    story_content,
    completed_at,
    generated_image_url,
    image_generation_timestamp,
    image_generation_cost
) VALUES (
    auth.uid(), -- This will use the current authenticated user
    'K-2',
    150,
    75,
    8,
    3,
    200,
    'New',
    '{"test": true}',
    'Once upon a time, there was a brave little mouse who discovered a magical cheese factory...',
    NOW(),
    'https://example.com/test-story-image.jpg',
    NOW(),
    1000
) RETURNING id, generated_image_url, image_generation_cost;

-- Test 2: Test the update_story_generated_image function
-- Note: Replace the session_id with the ID returned from Test 1
SELECT update_story_generated_image(
    'session-id-from-test-1'::UUID,
    'https://example.com/updated-story-image.jpg',
    1000
);

-- Test 3: Test creating an image generation event
SELECT create_image_generation_event(
    auth.uid(),
    'session-id-from-test-1'::UUID,
    1000,
    'K-2',
    75,
    '{"device": "test", "source": "validation_script"}'::JSONB
) as event_id;

-- Test 4: Test updating an image generation event
-- Note: Replace event-id with the ID returned from Test 3
SELECT update_image_generation_event(
    'event-id-from-test-3'::UUID,
    'success',
    'https://example.com/final-generated-image.jpg',
    NULL,
    'replicate',
    2500,
    'A colorful watercolor illustration of a brave little mouse in a magical cheese factory'
);

-- Test 5: Query stories with generated images
SELECT * FROM get_user_stories_with_images(
    auth.uid(),
    10,
    0
);

-- Test 6: Query user's image generation events
SELECT * FROM get_user_image_generation_events(
    auth.uid(),
    10,
    0
);

-- Test 7: Get image generation analytics
SELECT * FROM get_image_generation_analytics(
    auth.uid(),
    NOW() - INTERVAL '30 days',
    NOW()
);

-- =============================================================================
-- Validation Summary Query
-- =============================================================================

-- This query provides a summary of the migration validation
SELECT 
    'game_sessions image columns' as component,
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_schema = 'public' AND table_name = 'game_sessions' 
     AND column_name IN ('generated_image_url', 'image_generation_timestamp', 'image_generation_cost')) as expected_count,
    3 as actual_count,
    CASE WHEN (SELECT COUNT(*) FROM information_schema.columns 
               WHERE table_schema = 'public' AND table_name = 'game_sessions' 
               AND column_name IN ('generated_image_url', 'image_generation_timestamp', 'image_generation_cost')) = 3 
         THEN '✅ PASS' ELSE '❌ FAIL' END as status

UNION ALL

SELECT 
    'image_generation_events table',
    (SELECT COUNT(*) FROM information_schema.tables 
     WHERE table_schema = 'public' AND table_name = 'image_generation_events'),
    1,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables 
                      WHERE table_schema = 'public' AND table_name = 'image_generation_events') 
         THEN '✅ PASS' ELSE '❌ FAIL' END

UNION ALL

SELECT 
    'image_generation_events columns',
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_schema = 'public' AND table_name = 'image_generation_events'),
    15,
    CASE WHEN (SELECT COUNT(*) FROM information_schema.columns 
               WHERE table_schema = 'public' AND table_name = 'image_generation_events') = 15 
         THEN '✅ PASS' ELSE '❌ FAIL' END

UNION ALL

SELECT 
    'database functions',
    (SELECT COUNT(*) FROM information_schema.routines 
     WHERE routine_schema = 'public' 
     AND routine_name IN ('update_story_generated_image', 'get_user_stories_with_images', 'get_image_generation_stats', 
                          'create_image_generation_event', 'update_image_generation_event', 'get_image_generation_analytics', 
                          'get_user_image_generation_events')),
    7,
    CASE WHEN (SELECT COUNT(*) FROM information_schema.routines 
               WHERE routine_schema = 'public' 
               AND routine_name IN ('update_story_generated_image', 'get_user_stories_with_images', 'get_image_generation_stats', 
                                   'create_image_generation_event', 'update_image_generation_event', 'get_image_generation_analytics', 
                                   'get_user_image_generation_events')) = 7 
         THEN '✅ PASS' ELSE '❌ FAIL' END

UNION ALL

SELECT 
    'RLS policies',
    (SELECT COUNT(*) FROM pg_policies 
     WHERE schemaname = 'public' AND tablename = 'image_generation_events'),
    3,
    CASE WHEN (SELECT COUNT(*) FROM pg_policies 
               WHERE schemaname = 'public' AND tablename = 'image_generation_events') = 3 
         THEN '✅ PASS' ELSE '❌ FAIL' END;

-- =============================================================================
-- Cleanup (Optional)
-- =============================================================================

-- Uncomment these lines if you want to clean up test data
-- DELETE FROM public.image_generation_events WHERE metadata->>'source' = 'validation_script';
-- DELETE FROM public.game_sessions WHERE story_content LIKE '%magical cheese factory%' AND story_metadata->>'test' = 'true';