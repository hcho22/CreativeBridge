-- Diagnostic Script: Check Current Bucket Status
-- Run this to see exactly what's configured and what's missing

-- ============================================================================
-- BUCKET STATUS
-- ============================================================================
SELECT '📦 BUCKET STATUS' as section;

SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'story-images')
    THEN '✅ Bucket EXISTS'
    ELSE '❌ Bucket NOT FOUND - Run Step 1 in README_BUCKET_SETUP_STEPS.md'
  END as bucket_status;

-- Show bucket details if it exists
SELECT
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at
FROM storage.buckets
WHERE id = 'story-images';

-- ============================================================================
-- RLS POLICIES STATUS
-- ============================================================================
SELECT '🔐 RLS POLICIES STATUS' as section;

SELECT
  CASE
    WHEN (SELECT COUNT(*) FROM pg_policies
          WHERE tablename = 'objects'
          AND schemaname = 'storage'
          AND policyname LIKE '%own images%') = 0
    THEN '❌ NO POLICIES FOUND - Create policies via Dashboard UI (see README_BUCKET_SETUP_STEPS.md)'
    WHEN (SELECT COUNT(*) FROM pg_policies
          WHERE tablename = 'objects'
          AND schemaname = 'storage'
          AND policyname LIKE '%own images%') < 4
    THEN '⚠️ INCOMPLETE - Only ' ||
         (SELECT COUNT(*) FROM pg_policies
          WHERE tablename = 'objects'
          AND schemaname = 'storage'
          AND policyname LIKE '%own images%')::text ||
         ' of 4 policies found'
    ELSE '✅ ALL 4 POLICIES FOUND'
  END as policy_status;

-- List current policies
SELECT
  policyname,
  cmd as operation,
  roles
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
  AND policyname LIKE '%own images%'
ORDER BY cmd;

-- ============================================================================
-- MISSING POLICIES CHECK
-- ============================================================================
SELECT '🔍 MISSING POLICIES CHECK' as section;

WITH expected_policies AS (
  SELECT 'Users can upload their own images' as policy_name, 'INSERT' as cmd
  UNION ALL
  SELECT 'Users can read their own images', 'SELECT'
  UNION ALL
  SELECT 'Users can update their own images', 'UPDATE'
  UNION ALL
  SELECT 'Users can delete their own images', 'DELETE'
),
existing_policies AS (
  SELECT policyname, cmd
  FROM pg_policies
  WHERE tablename = 'objects'
    AND schemaname = 'storage'
    AND policyname LIKE '%own images%'
)
SELECT
  e.policy_name,
  e.cmd as operation,
  CASE
    WHEN x.policyname IS NOT NULL THEN '✅ EXISTS'
    ELSE '❌ MISSING - Create via Dashboard UI'
  END as status
FROM expected_policies e
LEFT JOIN existing_policies x
  ON e.policy_name = x.policyname AND e.cmd = x.cmd
ORDER BY e.cmd;

-- ============================================================================
-- RLS ENABLED CHECK
-- ============================================================================
SELECT '🛡️ RLS ENABLED CHECK' as section;

SELECT
  schemaname,
  tablename,
  CASE
    WHEN rowsecurity = true THEN '✅ RLS ENABLED'
    ELSE '❌ RLS DISABLED - Contact Supabase support'
  END as rls_status
FROM pg_tables
WHERE schemaname = 'storage'
  AND tablename = 'objects';

-- ============================================================================
-- OVERALL SUMMARY
-- ============================================================================
SELECT '📊 OVERALL SUMMARY' as section;

SELECT
  '🎯 Setup Progress' as metric,
  CASE
    WHEN NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'story-images')
    THEN '0% - Bucket not created'
    WHEN (SELECT COUNT(*) FROM pg_policies
          WHERE tablename = 'objects'
          AND schemaname = 'storage'
          AND policyname LIKE '%own images%') = 0
    THEN '25% - Bucket created, no policies'
    WHEN (SELECT COUNT(*) FROM pg_policies
          WHERE tablename = 'objects'
          AND schemaname = 'storage'
          AND policyname LIKE '%own images%') < 4
    THEN (25 + (SELECT COUNT(*) FROM pg_policies
                WHERE tablename = 'objects'
                AND schemaname = 'storage'
                AND policyname LIKE '%own images%') * 18.75)::text || '% - Partial policies'
    ELSE '100% - ✅ COMPLETE'
  END as status;

-- ============================================================================
-- NEXT STEPS
-- ============================================================================
SELECT '📝 NEXT STEPS' as section;

SELECT
  CASE
    WHEN NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'story-images')
    THEN '1️⃣ Create bucket: Run sql/create_story_images_bucket_simple.sql'
    WHEN (SELECT COUNT(*) FROM pg_policies
          WHERE tablename = 'objects'
          AND schemaname = 'storage'
          AND policyname LIKE '%own images%') = 0
    THEN '2️⃣ Create policies: Follow sql/README_BUCKET_SETUP_STEPS.md Step 2'
    WHEN (SELECT COUNT(*) FROM pg_policies
          WHERE tablename = 'objects'
          AND schemaname = 'storage'
          AND policyname LIKE '%own images%') < 4
    THEN '2️⃣ Complete policies: You have ' ||
         (SELECT COUNT(*) FROM pg_policies
          WHERE tablename = 'objects'
          AND schemaname = 'storage'
          AND policyname LIKE '%own images%')::text ||
         ' of 4. Check MISSING POLICIES above and create them via Dashboard.'
    ELSE '3️⃣ All done! Proceed to Task 1.4: Update TypeScript Types'
  END as next_step;
