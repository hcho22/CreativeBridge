# Supabase Storage Bucket Setup Guide

## Overview

This guide documents the setup process for the `story-images` Supabase Storage bucket, which is used to store permanent backups of AI-generated story images.

## Bucket Configuration

### Bucket Details

- **Bucket ID**: `story-images`
- **Bucket Name**: `story-images`
- **Public Access**: `false` (private bucket)
- **File Size Limit**: 10 MB (recommended)
- **Allowed MIME Types**: `image/png`, `image/jpeg`, `image/webp`

### File Path Structure

All images are stored using the following path structure:

```
{user_id}/session_{session_id}/image_{timestamp}.png
```

**Example:**
```
a1b2c3d4-e5f6-7890-abcd-ef1234567890/session_xyz123/image_1704672000000.png
```

This structure ensures:
- ✅ User isolation (each user has their own folder)
- ✅ Session organization (images grouped by story session)
- ✅ Unique filenames (timestamp prevents collisions)
- ✅ Easy cleanup (delete all images for a user or session)

## Setup Instructions

### Option 1: Using SQL Script (Recommended)

1. **Navigate to Supabase Dashboard** → SQL Editor

2. **Run the setup script:**
   ```bash
   # Load and execute the bucket creation script
   cat sql/create_story_images_bucket.sql
   ```

3. **Verify the setup:**
   ```bash
   # Run verification queries
   cat sql/verify_storage_bucket.sql
   ```

4. **Expected verification results:**
   - ✅ Bucket exists with `public = false`
   - ✅ 4 RLS policies created (INSERT, SELECT, UPDATE, DELETE)
   - ✅ RLS enabled on `storage.objects` table
   - ✅ All policies filter by `bucket_id = 'story-images'`
   - ✅ All policies verify user ownership via `auth.uid()`

### Option 2: Using Supabase Dashboard

1. **Navigate to Storage** section in Supabase Dashboard

2. **Create new bucket:**
   - Click "New bucket"
   - Name: `story-images`
   - Public: `false` (unchecked)
   - File size limit: `10485760` (10 MB)
   - Allowed MIME types: `image/png,image/jpeg,image/webp`

3. **Apply the SQL script for RLS policies:**
   - Go to SQL Editor
   - Paste contents of `sql/create_story_images_bucket.sql`
   - Execute (skip the bucket creation part if already created)

## Row Level Security (RLS) Policies

### Policy 1: Upload Permission

**Name:** "Users can upload their own images"

**Operation:** `INSERT`

**Rule:**
```sql
bucket_id = 'story-images' AND
(storage.foldername(name))[1] = auth.uid()::text
```

**Description:** Users can only upload files to folders that match their user ID.

---

### Policy 2: Read Permission

**Name:** "Users can read their own images"

**Operation:** `SELECT`

**Rule:**
```sql
bucket_id = 'story-images' AND
(storage.foldername(name))[1] = auth.uid()::text
```

**Description:** Users can only download/read files from their own folders.

---

### Policy 3: Update Permission

**Name:** "Users can update their own images"

**Operation:** `UPDATE`

**Rule:**
```sql
bucket_id = 'story-images' AND
(storage.foldername(name))[1] = auth.uid()::text
```

**Description:** Users can only update (replace) files in their own folders.

---

### Policy 4: Delete Permission

**Name:** "Users can delete their own images"

**Operation:** `DELETE`

**Rule:**
```sql
bucket_id = 'story-images' AND
(storage.foldername(name))[1] = auth.uid()::text
```

**Description:** Users can only delete files from their own folders.

## Testing

### Automated Tests

Run the automated test suite to verify RLS policies:

```bash
npm test -- __tests__/storage/storageRLS.test.ts
```

**Test Coverage:**
- ✅ Upload permissions (own folder ✓, other user's folder ✗)
- ✅ Read permissions (own images ✓, other user's images ✗)
- ✅ Update permissions (own images ✓, other user's images ✗)
- ✅ Delete permissions (own images ✓, other user's images ✗)
- ✅ Bucket privacy verification
- ✅ File size limit enforcement
- ✅ File path structure validation

### Manual Testing

1. **Test upload to own folder:**
   ```typescript
   const { data, error } = await supabase.storage
     .from('story-images')
     .upload(`${userId}/session_test/image.png`, imageBlob);

   // Should succeed ✅
   ```

2. **Test upload to another user's folder:**
   ```typescript
   const { data, error } = await supabase.storage
     .from('story-images')
     .upload(`other-user-id/session_test/image.png`, imageBlob);

   // Should fail with permission error ❌
   ```

3. **Test read access:**
   ```typescript
   // Own image
   const { data, error } = await supabase.storage
     .from('story-images')
     .download(`${userId}/session_test/image.png`);

   // Should succeed ✅

   // Other user's image
   const { data, error } = await supabase.storage
     .from('story-images')
     .download(`other-user-id/session_test/image.png`);

   // Should fail with permission error ❌
   ```

## Troubleshooting

### Issue: "Permission denied" when uploading to own folder

**Possible causes:**
1. User is not authenticated (check `auth.uid()` is not null)
2. File path doesn't start with user's ID
3. RLS policies not applied correctly

**Solution:**
```sql
-- Verify user is authenticated
SELECT auth.uid();

-- Check if policies exist
SELECT * FROM pg_policies WHERE tablename = 'objects';

-- Re-apply policies if needed
-- Run: sql/create_story_images_bucket.sql
```

### Issue: "Bucket not found" error

**Solution:**
```sql
-- Verify bucket exists
SELECT * FROM storage.buckets WHERE id = 'story-images';

-- Create bucket if missing
INSERT INTO storage.buckets (id, name, public)
VALUES ('story-images', 'story-images', false);
```

### Issue: File size limit not enforced

**Solution:**
1. Go to Supabase Dashboard → Storage → story-images
2. Edit bucket settings
3. Set file size limit: `10485760` (10 MB)
4. Save changes

### Issue: Users can access other users' images

**Critical security issue!** This means RLS policies are not working.

**Solution:**
```sql
-- 1. Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 2. Re-apply all policies
-- Run: sql/create_story_images_bucket.sql

-- 3. Verify policies
-- Run: sql/verify_storage_bucket.sql
```

## Rollback

If you need to remove the bucket and start over:

```sql
-- WARNING: This will delete all images in the bucket!

-- Drop all RLS policies
DROP POLICY IF EXISTS "Users can upload their own images" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own images" ON storage.objects;

-- Delete the bucket
DELETE FROM storage.buckets WHERE id = 'story-images';
```

## Monitoring

### Storage Usage

Monitor storage usage to avoid hitting quota limits:

```sql
-- Check total storage used
SELECT
  bucket_id,
  COUNT(*) as file_count,
  SUM(metadata->>'size')::bigint as total_bytes,
  ROUND(SUM(metadata->>'size')::bigint / 1024.0 / 1024.0, 2) as total_mb
FROM storage.objects
WHERE bucket_id = 'story-images'
GROUP BY bucket_id;
```

### Upload Statistics

Track upload success rates:

```sql
-- Image upload statistics
SELECT
  COUNT(*) as total_sessions_with_images,
  COUNT(CASE WHEN image_upload_status = 'uploaded' THEN 1 END) as uploaded,
  COUNT(CASE WHEN image_upload_status = 'failed' THEN 1 END) as failed,
  COUNT(CASE WHEN image_upload_status = 'pending' THEN 1 END) as pending,
  ROUND(
    COUNT(CASE WHEN image_upload_status = 'uploaded' THEN 1 END)::numeric /
    NULLIF(COUNT(*), 0) * 100,
    2
  ) as success_rate_percent
FROM game_sessions
WHERE generated_image_url IS NOT NULL;
```

### Set Up Alerts

Configure alerts for:
- 🚨 Storage quota > 80% full
- 🚨 Upload failure rate > 10%
- 🚨 Unusual delete activity
- ⚠️ Large number of orphaned files

## Best Practices

### 1. Always Use User ID in Path
```typescript
// ✅ Correct
const path = `${userId}/session_${sessionId}/image_${timestamp}.png`;

// ❌ Wrong - will be rejected by RLS
const path = `shared/image_${timestamp}.png`;
```

### 2. Handle Upload Errors Gracefully
```typescript
const { data, error } = await supabase.storage
  .from('story-images')
  .upload(path, blob);

if (error) {
  console.error('Upload failed:', error.message);
  // Keep Replicate URL as fallback
  // Don't block user experience
}
```

### 3. Implement Retry Logic
```typescript
// Use exponential backoff for transient failures
let attempts = 0;
const maxAttempts = 3;
const delays = [1000, 2000, 4000]; // 1s, 2s, 4s

while (attempts < maxAttempts) {
  const { error } = await uploadToSupabase();
  if (!error) break;

  await new Promise(resolve => setTimeout(resolve, delays[attempts]));
  attempts++;
}
```

### 4. Clean Up Orphaned Files
```typescript
// Periodically delete images for deleted sessions
async function cleanupOrphanedImages(userId: string) {
  // Get all sessions for user
  const { data: sessions } = await supabase
    .from('game_sessions')
    .select('id')
    .eq('user_id', userId);

  const sessionIds = new Set(sessions?.map(s => s.id) || []);

  // List all files
  const { data: files } = await supabase.storage
    .from('story-images')
    .list(userId);

  // Find orphaned files
  const orphaned = files?.filter(f => {
    const sessionId = f.name.match(/session_([^/]+)/)?.[1];
    return sessionId && !sessionIds.has(sessionId);
  }) || [];

  // Delete orphaned files
  if (orphaned.length > 0) {
    const paths = orphaned.map(f => `${userId}/${f.name}`);
    await supabase.storage.from('story-images').remove(paths);
  }
}
```

## Related Documentation

- [Supabase Storage Documentation](https://supabase.com/docs/guides/storage)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Image Storage Service Implementation](../src/services/imageStorageService.ts)
- [Story Image Persistence PRD](../.agent/Tasks/story-completion-and-image-persistence-PRD.md)

## Change Log

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-01-07 | 1.0 | Initial bucket setup with RLS policies | AI Assistant |

## Support

For issues or questions:
1. Check [Troubleshooting](#troubleshooting) section above
2. Review test failures in `__tests__/storage/storageRLS.test.ts`
3. Verify bucket configuration in Supabase Dashboard
4. Check Supabase logs for detailed error messages
