-- Create Supabase Storage Bucket for Story Images
-- This is the complete setup script including bucket and RLS policies
--
-- IMPORTANT: This script must be run with proper permissions
-- If you get "must be owner of table objects" error:
--   Option 1: Use sql/create_story_images_bucket_simple.sql + Dashboard UI
--   Option 2: See sql/create_story_images_bucket_dashboard.md for manual setup
--
-- For Supabase Cloud: Run this in SQL Editor (it should have sufficient permissions)
-- For local dev: Run with supabase CLI

BEGIN;

-- Step 1: Create the storage bucket
INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'story-images',
  'story-images',
  false,
  10485760, -- 10MB limit
  ARRAY['image/png', 'image/jpeg', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Step 2: Create RLS policies for the story-images bucket
-- These policies ensure users can only access their own images

-- Policy 1: Users can upload to their own folder
-- Format: {user_id}/session_{session_id}/image_{timestamp}.png
CREATE POLICY IF NOT EXISTS "Users can upload their own images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'story-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 2: Users can read their own images
CREATE POLICY IF NOT EXISTS "Users can read their own images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'story-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 3: Users can update their own images
CREATE POLICY IF NOT EXISTS "Users can update their own images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'story-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 4: Users can delete their own images
CREATE POLICY IF NOT EXISTS "Users can delete their own images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'story-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

COMMIT;

-- Verification queries
\echo '\n=== Bucket Verification ===\n'

SELECT
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at
FROM storage.buckets
WHERE id = 'story-images';

\echo '\n=== RLS Policies Verification ===\n'

SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
  AND policyname LIKE '%own images%'
ORDER BY cmd;

\echo '\n=== Expected Results ===\n'
\echo 'Bucket: story-images (public: false, file_size_limit: 10485760)'
\echo 'Policies: 4 total (DELETE, INSERT, SELECT, UPDATE)'
\echo 'All policies should check: bucket_id = story-images AND user owns folder'
