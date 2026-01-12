# Create Story Images Bucket - Dashboard Method

**⚠️ RECOMMENDED APPROACH**: Use the Supabase Dashboard to avoid permission issues.

## Step-by-Step Instructions

### Step 1: Create the Bucket

1. Open **Supabase Dashboard** → **Storage**
2. Click **"New bucket"**
3. Configure:
   - **Name**: `story-images`
   - **Public bucket**: ❌ **Unchecked** (keep it private)
   - **File size limit**: `10485760` (10 MB)
   - **Allowed MIME types**: `image/png,image/jpeg,image/webp`
4. Click **"Create bucket"**

### Step 2: Create RLS Policies

1. In the Storage page, find the `story-images` bucket
2. Click the **three dots (...)** → **"Policies"**
3. Click **"New Policy"**

#### Policy 1: Upload (INSERT)

```
Policy Name: Users can upload their own images
Policy Command: INSERT
Target Roles: authenticated

WITH CHECK expression:
(bucket_id = 'story-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)
```

Click **"Review"** → **"Save policy"**

#### Policy 2: Read (SELECT)

```
Policy Name: Users can read their own images
Policy Command: SELECT
Target Roles: authenticated

USING expression:
(bucket_id = 'story-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)
```

Click **"Review"** → **"Save policy"**

#### Policy 3: Update (UPDATE)

```
Policy Name: Users can update their own images
Policy Command: UPDATE
Target Roles: authenticated

USING expression:
(bucket_id = 'story-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)
```

Click **"Review"** → **"Save policy"**

#### Policy 4: Delete (DELETE)

```
Policy Name: Users can delete their own images
Policy Command: DELETE
Target Roles: authenticated

USING expression:
(bucket_id = 'story-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)
```

Click **"Review"** → **"Save policy"**

### Step 3: Verify Setup

Run this SQL query in the **SQL Editor** to verify:

```sql
-- Check bucket exists
SELECT id, name, public, file_size_limit
FROM storage.buckets
WHERE id = 'story-images';

-- Check policies exist
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
  AND policyname LIKE '%own images%'
ORDER BY cmd;
```

**Expected Results:**
- Bucket: `story-images` (public: false)
- 4 policies: DELETE, INSERT, SELECT, UPDATE

---

## Alternative: SQL Method (for Service Role)

If you have service_role access or are using the Supabase CLI with proper credentials, you can try this SQL approach:

```sql
-- Create bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'story-images',
  'story-images',
  false,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;
```

Then use the **Dashboard UI** to create the 4 RLS policies as described above.

---

## Troubleshooting

### Error: "must be owner of table objects"

**Cause**: SQL Editor runs with limited permissions and cannot modify system table policies.

**Solution**: Use the Dashboard UI method above instead.

### Error: Policy already exists

**Cause**: Policies were created in a previous attempt.

**Solution**: Delete the existing policies in Dashboard → Storage → Policies, then recreate them.

### Bucket creation fails

**Cause**: Bucket already exists from previous attempt.

**Solution**: Either:
1. Use the existing bucket and just add policies
2. Delete the bucket in Dashboard → Storage (warning: deletes all files)
3. Update the SQL to use `ON CONFLICT DO NOTHING` (already included)

---

## Verification Checklist

After setup, verify:

- [ ] Bucket `story-images` exists
- [ ] Bucket is **private** (public = false)
- [ ] File size limit is 10 MB
- [ ] Allowed MIME types: png, jpeg, webp
- [ ] 4 RLS policies exist (INSERT, SELECT, UPDATE, DELETE)
- [ ] All policies check `bucket_id = 'story-images'`
- [ ] All policies verify user folder ownership

Run the verification SQL above to confirm all items.
