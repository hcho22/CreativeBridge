# Troubleshooting: Storage Bucket Setup

## Error: "must be owner of table objects"

### Problem
```
ERROR: 42501: must be owner of table objects
```

This occurs when trying to create RLS policies on `storage.objects` without sufficient permissions.

### Why This Happens
The Supabase SQL Editor runs with limited permissions for security. Creating policies on system tables (like `storage.objects`) requires elevated privileges that the SQL Editor may not have.

### Solutions (Choose One)

---

#### ✅ Solution 1: Dashboard UI Method (RECOMMENDED)

**Step 1: Create the bucket with SQL**
```sql
-- Run in SQL Editor
INSERT INTO storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
VALUES (
  'story-images',
  'story-images',
  false,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;
```

**Step 2: Create policies via Dashboard**

1. Go to **Storage** → `story-images` → **Policies**
2. Click **"New Policy"** → **"Create a custom policy"**
3. Create 4 policies (see details below)

**Policy 1: INSERT**
- Name: `Users can upload their own images`
- Policy command: `INSERT`
- Target roles: `authenticated`
- WITH CHECK expression:
  ```sql
  (bucket_id = 'story-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)
  ```

**Policy 2: SELECT**
- Name: `Users can read their own images`
- Policy command: `SELECT`
- Target roles: `authenticated`
- USING expression:
  ```sql
  (bucket_id = 'story-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)
  ```

**Policy 3: UPDATE**
- Name: `Users can update their own images`
- Policy command: `UPDATE`
- Target roles: `authenticated`
- USING expression:
  ```sql
  (bucket_id = 'story-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)
  ```

**Policy 4: DELETE**
- Name: `Users can delete their own images`
- Policy command: `DELETE`
- Target roles: `authenticated`
- USING expression:
  ```sql
  (bucket_id = 'story-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)
  ```

---

#### ✅ Solution 2: Use the Simple SQL Script

Run the simplified script that only creates the bucket:

```bash
# Use this file instead:
sql/create_story_images_bucket_simple.sql
```

Then follow the Dashboard instructions above to add policies.

---

#### ✅ Solution 3: Local Development with Supabase CLI

If you're developing locally with Supabase CLI:

```bash
# Run migration with proper permissions
supabase db reset

# Or execute directly
supabase db execute -f sql/create_story_images_bucket.sql
```

The CLI runs with elevated permissions and should work.

---

## Verification After Setup

After creating the bucket and policies (using any method above), run this verification:

```sql
-- Check bucket
SELECT id, name, public, file_size_limit
FROM storage.buckets
WHERE id = 'story-images';

-- Check policies (should return 4 rows)
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
  AND policyname LIKE '%own images%'
ORDER BY cmd;
```

**Expected Results:**
```
Bucket Found: ✅
- id: story-images
- public: false
- file_size_limit: 10485760

Policies Found: ✅ (4 total)
- Users can delete their own images (DELETE)
- Users can upload their own images (INSERT)
- Users can read their own images (SELECT)
- Users can update their own images (UPDATE)
```

---

## Other Common Errors

### Error: Bucket already exists

```
ERROR: duplicate key value violates unique constraint "buckets_pkey"
```

**Solution:** The bucket already exists! Just add the policies via Dashboard UI.

OR update your SQL to use `ON CONFLICT`:
```sql
INSERT INTO storage.buckets (...)
VALUES (...)
ON CONFLICT (id) DO NOTHING;  -- ← This prevents the error
```

---

### Error: Policy already exists

```
ERROR: policy "Users can upload their own images" for table "objects" already exists
```

**Solution:** The policy exists! Either:

1. **Skip it** - Your bucket is already configured
2. **Delete and recreate** - Use Dashboard → Storage → Policies → Delete existing policies
3. **Use `CREATE POLICY IF NOT EXISTS`** - Already in the updated script

---

### Error: Permission denied when testing upload

```
Error: new row violates row-level security policy for table "objects"
```

**Causes:**
1. User is not authenticated
2. File path doesn't start with user's ID
3. RLS policies not created correctly

**Debug Steps:**

```sql
-- 1. Check if user is authenticated
SELECT auth.uid();
-- Should return a UUID, not NULL

-- 2. Check policies exist
SELECT COUNT(*)
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
  AND policyname LIKE '%own images%';
-- Should return 4

-- 3. Check policy expressions
SELECT policyname, qual, with_check
FROM pg_policies
WHERE tablename = 'objects'
  AND policyname LIKE '%own images%';
-- Should contain: bucket_id = 'story-images' AND auth.uid()
```

---

### Error: File too large

```
Error: File size exceeds the limit of 10485760 bytes
```

**Solution:** This is expected! The file size limit is working correctly.

To upload larger files:
1. Update bucket configuration in Dashboard → Storage → Edit bucket
2. Or compress the image before uploading

---

## Testing the Setup

### Quick Test (TypeScript)

```typescript
import { supabase } from './services/supabase';

async function testBucketSetup() {
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  console.log('User ID:', user?.id);

  // Create test image (1x1 transparent PNG)
  const testBlob = new Blob([
    Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
  ], { type: 'image/png' });

  // Test upload to own folder (should succeed)
  const { data: upload1, error: error1 } = await supabase.storage
    .from('story-images')
    .upload(`${user?.id}/test/image.png`, testBlob);

  console.log('Upload to own folder:', upload1 ? '✅ SUCCESS' : '❌ FAILED', error1?.message);

  // Test upload to different folder (should fail)
  const { data: upload2, error: error2 } = await supabase.storage
    .from('story-images')
    .upload(`different-user-id/test/image.png`, testBlob);

  console.log('Upload to other folder:', error2 ? '✅ BLOCKED (correct!)' : '❌ ALLOWED (security issue!)', error2?.message);

  // Cleanup
  if (upload1) {
    await supabase.storage
      .from('story-images')
      .remove([`${user?.id}/test/image.png`]);
  }
}

testBucketSetup();
```

**Expected Output:**
```
User ID: abc123...
Upload to own folder: ✅ SUCCESS
Upload to other folder: ✅ BLOCKED (correct!) new row violates row-level security policy
```

---

## Still Having Issues?

### 1. Check Supabase Logs
Go to Dashboard → Logs → Postgres Logs

Look for:
- Permission denied errors
- Policy violation errors
- Storage errors

### 2. Verify Authentication
```sql
-- Check if auth.uid() returns your user ID
SELECT auth.uid();
```

If it returns `NULL`, you're not authenticated properly.

### 3. Check Storage Extension
```sql
-- Verify storage extension is enabled
SELECT * FROM pg_extension WHERE extname = 'storage';
```

Should return 1 row. If not, contact Supabase support.

### 4. Manual Policy Check
```sql
-- View the exact policy definition
SELECT
  policyname,
  pg_get_expr(qual, 'storage.objects'::regclass) as using_expression,
  pg_get_expr(with_check, 'storage.objects'::regclass) as with_check_expression
FROM pg_policy
WHERE polname LIKE '%own images%';
```

Compare the expressions with the expected policy definitions.

---

## Clean Slate - Start Over

If all else fails, delete everything and start fresh:

```sql
-- WARNING: This deletes ALL files in the bucket!

-- 1. Delete all policies
DROP POLICY IF EXISTS "Users can upload their own images" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own images" ON storage.objects;

-- 2. Delete the bucket (and all files in it)
DELETE FROM storage.buckets WHERE id = 'story-images';

-- 3. Start over with Dashboard UI method (recommended)
```

Then follow **Solution 1** above.

---

## Need More Help?

1. Review: [`sql/create_story_images_bucket_dashboard.md`](./create_story_images_bucket_dashboard.md)
2. Check: Supabase Storage documentation: https://supabase.com/docs/guides/storage
3. Ask: Supabase Discord community
