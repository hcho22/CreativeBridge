-- Simplified Bucket Creation Script
-- This script ONLY creates the bucket - policies must be added via Dashboard UI
-- Reason: RLS policies on storage.objects require elevated permissions

-- Create the storage bucket with all settings
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
  10485760, -- 10MB
  ARRAY['image/png', 'image/jpeg', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Verify bucket was created
SELECT
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at
FROM storage.buckets
WHERE id = 'story-images';

-- Expected output:
-- id: story-images
-- name: story-images
-- public: f (false)
-- file_size_limit: 10485760
-- allowed_mime_types: {image/png,image/jpeg,image/webp}

-- ============================================================================
-- NEXT STEP: Add RLS Policies via Supabase Dashboard
-- ============================================================================
-- Go to: Dashboard → Storage → story-images → Policies → New Policy
--
-- Create 4 policies with these expressions:
--
-- 1. INSERT: (bucket_id = 'story-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)
-- 2. SELECT: (bucket_id = 'story-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)
-- 3. UPDATE: (bucket_id = 'story-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)
-- 4. DELETE: (bucket_id = 'story-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)
--
-- See: sql/create_story_images_bucket_dashboard.md for detailed instructions
-- ============================================================================
