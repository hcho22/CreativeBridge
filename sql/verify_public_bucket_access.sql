-- Verify story-images bucket is properly configured for public access
-- Run this after applying make_story_images_public.sql migration

\echo '\n╔════════════════════════════════════════════════════════════╗'
\echo '║  Supabase Storage Bucket Verification                     ║'
\echo '║  Bucket: story-images                                      ║'
\echo '╚════════════════════════════════════════════════════════════╝\n'

-- Check 1: Bucket Configuration
\echo '\n=== 1. Bucket Configuration ===\n'
SELECT
  id,
  name,
  public AS "Is Public?",
  file_size_limit AS "Size Limit (bytes)",
  allowed_mime_types AS "Allowed Types",
  created_at AS "Created At"
FROM storage.buckets
WHERE id = 'story-images';

\echo '\n✓ Expected: public = true, file_size_limit = 10485760 (10MB)\n'

-- Check 2: RLS Policies Summary
\echo '\n=== 2. RLS Policies Summary ===\n'
SELECT
  cmd AS "Operation",
  policyname AS "Policy Name",
  CASE
    WHEN roles::text LIKE '%public%' THEN 'Public'
    WHEN roles::text LIKE '%authenticated%' THEN 'Authenticated Only'
    ELSE roles::text
  END AS "Who Can Access"
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
  AND (policyname LIKE '%story%' OR policyname LIKE '%own images%')
ORDER BY cmd, policyname;

\echo '\n✓ Expected Policies:'
\echo '  - SELECT: "Public read access for story images" (Public)'
\echo '  - SELECT: "Users can read their own images" (Authenticated Only)'
\echo '  - INSERT: "Users can upload their own images" (Authenticated Only)'
\echo '  - UPDATE: "Users can update their own images" (Authenticated Only)'
\echo '  - DELETE: "Users can delete their own images" (Authenticated Only)\n'

-- Check 3: Sample Images (if any exist)
\echo '\n=== 3. Sample Images in Bucket ===\n'
SELECT
  name AS "File Path",
  created_at AS "Uploaded At",
  metadata->>'size' AS "Size (bytes)",
  metadata->>'mimetype' AS "MIME Type"
FROM storage.objects
WHERE bucket_id = 'story-images'
ORDER BY created_at DESC
LIMIT 5;

\echo '\n(Showing up to 5 most recent images)\n'

-- Check 4: Security Configuration
\echo '\n=== 4. Security Summary ===\n'
\echo '✓ Read Access: Anyone with the URL (public)'
\echo '✓ Upload Access: Only authenticated users to their own folder'
\echo '✓ Update Access: Only file owners'
\echo '✓ Delete Access: Only file owners'
\echo '\nThis configuration allows:'
\echo '  - Users to upload images to their own folder (user_id/session_id.png)'
\echo '  - Anyone to view images via public URLs (for sharing stories)'
\echo '  - Only owners to modify or delete their images'
\echo '\n'

\echo '\n╔════════════════════════════════════════════════════════════╗'
\echo '║  Verification Complete                                      ║'
\echo '╚════════════════════════════════════════════════════════════╝\n'

\echo '\n🔍 Troubleshooting:'
\echo '   If "Is Public?" shows false:'
\echo '     → Run sql/make_story_images_public.sql first'
\echo '\n   If no "Public read access" policy appears:'
\echo '     → The migration did not complete successfully'
\echo '     → Re-run sql/make_story_images_public.sql'
\echo '\n   If images still not accessible:'
\echo '     → Check browser console for CORS errors'
\echo '     → Verify image URLs are from correct Supabase project'
\echo '\n'
