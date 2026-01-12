# Fix: Users Cannot Access Uploaded Images

## Problem Summary

Images are successfully uploading to Supabase Storage, but users cannot view them because:

1. ✅ **Upload works**: Images are stored at `{user_id}/{session_id}.png`
2. ✅ **Public URLs are generated**: `getPublicUrl()` returns valid URLs
3. ❌ **Access fails**: Bucket is private, so public URLs don't work without auth

## Root Cause

The `story-images` bucket was configured as **private** (`public: false`) with RLS policies that require authentication. However, the app uses `getPublicUrl()` which generates unauthenticated URLs.

**Mismatch:**
- Bucket requires authentication ❌
- Public URLs have no auth headers ❌
- Result: 403 Forbidden errors

## Solution: Make Bucket Public

Since AI-generated story illustrations are **not sensitive data**, making the bucket public is:
- ✅ **Safe**: No personal/private information in AI art
- ✅ **Simple**: Works with existing `getPublicUrl()` code
- ✅ **Fast**: No signed URL generation overhead
- ✅ **Shareable**: Users can easily share story images

Security still maintained:
- ✅ Upload restricted to authenticated users
- ✅ Users can only upload to their own folder
- ✅ Only owners can update/delete their images

## How to Fix (3 Steps)

### Step 1: Run the Migration

1. Open your Supabase Dashboard
2. Navigate to: **SQL Editor**
3. Copy and paste the contents of: **`sql/make_story_images_public.sql`**
4. Click **Run** (or press `Ctrl+Enter`)

Expected output:
```
Bucket public should be: true
Should see "Public read access for story images" policy for SELECT
```

### Step 2: Verify the Fix

1. In Supabase Dashboard, go to: **Storage** → **story-images**
2. Check bucket settings: **Public bucket** should be `ON` (toggle should be green)
3. Optionally, run verification script:
   ```bash
   # In Supabase SQL Editor
   -- Paste contents of sql/verify_public_bucket_access.sql
   ```

### Step 3: Test Image Access

1. Generate a new story image in the app
2. Wait for upload to complete (you'll see ✅ "Permanently saved" badge)
3. The image should display immediately
4. Try viewing previous stories with uploaded images - they should now work!

## What Changed

### Before Migration
```sql
-- Bucket configuration
public: false  ❌

-- RLS Policies
- SELECT: Only owner can read (authenticated required)
- INSERT: Only owner can upload (authenticated required)
- UPDATE: Only owner can update (authenticated required)
- DELETE: Only owner can delete (authenticated required)
```

### After Migration
```sql
-- Bucket configuration
public: true  ✅

-- RLS Policies
- SELECT: Public read access (anyone with URL) ✅
- SELECT: Owner can read (authenticated, redundant but harmless)
- INSERT: Only owner can upload (authenticated required) ✅
- UPDATE: Only owner can update (authenticated required) ✅
- DELETE: Only owner can delete (authenticated required) ✅
```

## Security Considerations

**Q: Is it safe to make the bucket public?**
A: Yes, for these reasons:
1. Images are AI-generated illustrations (not user photos/documents)
2. No personal information embedded in images
3. URLs are non-guessable (UUID-based session IDs)
4. Upload/modify/delete still restricted to owners
5. Similar to how services like Imgur, Pinterest, etc. work

**Q: Can anyone upload images to my bucket?**
A: No. Upload is still restricted to authenticated users via RLS policy:
```sql
CREATE POLICY "Users can upload their own images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'story-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

**Q: Can anyone delete my images?**
A: No. Delete is restricted to the file owner via RLS policy.

## Rollback (if needed)

If you need to revert to private bucket:

```sql
-- Make bucket private again
UPDATE storage.buckets
SET public = false
WHERE id = 'story-images';

-- Remove public read policy
DROP POLICY IF EXISTS "Public read access for story images"
ON storage.objects;
```

**Note:** If you rollback, images will stop working unless you implement signed URLs in the code.

## Alternative: Signed URLs (Not Recommended for This Use Case)

If you absolutely need private storage, you'd need to:

1. Keep bucket private
2. Modify `imageStorageService.ts` to use `createSignedUrl()` instead of `getPublicUrl()`
3. Handle URL expiration (signed URLs expire after 1 hour by default)
4. Regenerate URLs when they expire

This adds significant complexity for minimal security benefit in this context.

## Files Modified

- ✅ Created: `sql/make_story_images_public.sql` - Migration script
- ✅ Created: `sql/verify_public_bucket_access.sql` - Verification script
- ✅ Created: `sql/FIX_IMAGE_ACCESS.md` - This guide

## Next Steps After Migration

1. Test generating a new story with image
2. Verify upload completes and image displays
3. Check that previous stories now show their images
4. Test sharing functionality (should work now that images are public)

## Troubleshooting

### Images Still Not Loading After Migration

1. **Check bucket is public:**
   - Go to Supabase Dashboard → Storage → story-images
   - Verify "Public bucket" toggle is ON

2. **Check RLS policies:**
   ```sql
   SELECT policyname, cmd, roles
   FROM pg_policies
   WHERE tablename = 'objects'
     AND schemaname = 'storage'
     AND bucket_id = 'story-images';
   ```
   Should show "Public read access" policy

3. **Clear app cache:**
   - Close and restart the app
   - Try generating a fresh image

4. **Check browser console (if web):**
   - Look for 403 errors
   - Check CORS errors
   - Verify Supabase project URL matches

5. **Verify image URL format:**
   Should look like:
   ```
   https://[project-ref].supabase.co/storage/v1/object/public/story-images/[user-id]/[session-id].png
   ```

### Upload Still Failing

If uploads are failing (not the access issue):
- Check `imageStorageService.ts` error logs
- Verify bucket exists and has correct permissions
- Check file size limits (10MB max)
- Verify MIME types (PNG, JPEG, WebP only)

## Questions?

If images still aren't accessible after following these steps:
1. Run the verification script: `sql/verify_public_bucket_access.sql`
2. Check the Supabase Dashboard Storage settings
3. Review the error logs in the app console
4. Verify you're using the correct Supabase project
