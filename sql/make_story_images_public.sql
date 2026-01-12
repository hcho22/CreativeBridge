-- Make story-images bucket public for user access
-- Run this migration to fix image access issues
--
-- Context: Images are successfully uploading to Supabase Storage,
-- but users can't view them because the bucket is private.
-- AI-generated story illustrations are not sensitive data,
-- so making them public is safe and provides the best UX.
--
-- INSTRUCTIONS:
-- 1. Open Supabase Dashboard
-- 2. Go to SQL Editor
-- 3. Paste this script and run it
-- 4. Verify the bucket is now public in Storage settings

BEGIN;

-- Step 1: Update the bucket to be public
UPDATE storage.buckets
SET public = true
WHERE id = 'story-images';

-- Step 2: Add a public read policy for all authenticated and anonymous users
-- This allows anyone with the URL to view images
-- (Upload/Update/Delete still restricted to image owners via existing policies)

-- Drop the policy if it exists, then create it (workaround for IF NOT EXISTS)
DROP POLICY IF EXISTS "Public read access for story images" ON storage.objects;

CREATE POLICY "Public read access for story images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'story-images');

COMMIT;

-- Verification queries (these will show results in Supabase Dashboard)

-- Query 1: Check bucket configuration
SELECT
  '=== Bucket Configuration ===' AS info,
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at
FROM storage.buckets
WHERE id = 'story-images';

-- Query 2: Check RLS policies
SELECT
  '=== RLS Policies ===' AS info,
  policyname,
  cmd,
  roles::text
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
  AND (policyname LIKE '%story%' OR policyname LIKE '%own images%')
ORDER BY cmd, policyname;

-- Expected results:
-- Bucket 'public' column should be: true
-- Should see "Public read access for story images" policy for SELECT
-- Upload/Update/Delete policies should still be owner-restricted
