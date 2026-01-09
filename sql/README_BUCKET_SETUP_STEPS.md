# Quick Start: Story Images Bucket Setup

## The Problem You're Experiencing

The verification script shows `rls_policies: ❌ FAIL (expected 4 policies)` because the RLS policies were not created successfully due to permission restrictions in the Supabase SQL Editor.

## ✅ SOLUTION: Use Supabase Dashboard UI

The SQL Editor cannot create RLS policies on system tables, but the Dashboard UI can. Follow these steps:

---

## Step 1: Create the Bucket (SQL Editor)

**Open Supabase Dashboard → SQL Editor** and run:

```sql
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
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp']::text[];
```

✅ This should succeed without errors.

---

## Step 2: Create RLS Policies (Dashboard UI)

### Navigate to Storage Policies

1. **Supabase Dashboard** → **Storage**
2. Find the `story-images` bucket in the list
3. Click the **three dots (⋮)** next to `story-images`
4. Select **"Policies"**
5. Click **"New Policy"**

### Create Policy 1: INSERT (Upload)

1. Click **"Create a policy"** or **"For full customization"**
2. Fill in:
   - **Policy name**: `Users can upload their own images`
   - **Policy command**: `INSERT` (select from dropdown)
   - **Target roles**: `authenticated` (select from dropdown)
   - **WITH CHECK expression**:
     ```sql
     (bucket_id = 'story-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)
     ```
3. Click **"Review"** → **"Save policy"**

### Create Policy 2: SELECT (Read)

1. Click **"New Policy"** again
2. Fill in:
   - **Policy name**: `Users can read their own images`
   - **Policy command**: `SELECT`
   - **Target roles**: `authenticated`
   - **USING expression**:
     ```sql
     (bucket_id = 'story-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)
     ```
3. Click **"Review"** → **"Save policy"**

### Create Policy 3: UPDATE (Modify)

1. Click **"New Policy"** again
2. Fill in:
   - **Policy name**: `Users can update their own images`
   - **Policy command**: `UPDATE`
   - **Target roles**: `authenticated`
   - **USING expression**:
     ```sql
     (bucket_id = 'story-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)
     ```
3. Click **"Review"** → **"Save policy"**

### Create Policy 4: DELETE (Remove)

1. Click **"New Policy"** again
2. Fill in:
   - **Policy name**: `Users can delete their own images`
   - **Policy command**: `DELETE`
   - **Target roles**: `authenticated`
   - **USING expression**:
     ```sql
     (bucket_id = 'story-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)
     ```
3. Click **"Review"** → **"Save policy"**

---

## Step 3: Verify Setup

Run the verification script again in **SQL Editor**:

```sql
-- Copy and paste from: sql/verify_storage_bucket.sql
-- OR run this quick check:

SELECT
  'story-images Storage Bucket Verification' as report_title,
  CASE
    WHEN (SELECT COUNT(*) FROM storage.buckets WHERE id = 'story-images') = 1
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as bucket_exists,
  CASE
    WHEN (SELECT public FROM storage.buckets WHERE id = 'story-images') = false
    THEN '✅ PASS (private)'
    ELSE '❌ FAIL (should be private)'
  END as bucket_privacy,
  CASE
    WHEN (SELECT COUNT(*) FROM pg_policies
          WHERE tablename = 'objects'
          AND schemaname = 'storage'
          AND policyname LIKE '%own images%') = 4
    THEN '✅ PASS (4 policies)'
    ELSE '❌ FAIL (expected 4 policies)'
  END as rls_policies,
  CASE
    WHEN (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'objects') = true
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as rls_enabled;
```

### Expected Result:

```
report_title                              | bucket_exists | bucket_privacy    | rls_policies        | rls_enabled
------------------------------------------+--------------+-------------------+--------------------+-------------
story-images Storage Bucket Verification | ✅ PASS      | ✅ PASS (private) | ✅ PASS (4 policies) | ✅ PASS
```

---

## Visual Guide (Screenshots Reference)

### Finding the Policies Option
```
Storage
└── [Buckets List]
    └── story-images
        └── ⋮ (three dots)
            └── Policies  ← Click here
```

### Policy Creation Form
```
┌─────────────────────────────────────┐
│ Policy name: [text input]          │
│ Policy command: [SELECT ▼]         │
│ Target roles: [authenticated ▼]    │
│                                     │
│ USING expression:                   │
│ ┌─────────────────────────────────┐ │
│ │ (bucket_id = 'story-images'...  │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [Review]  [Cancel]                  │
└─────────────────────────────────────┘
```

---

## Troubleshooting

### Issue: Can't find Policies option

**Solution:** Make sure you're clicking on the three dots next to the bucket name in the Storage section, not elsewhere.

### Issue: Policy creation fails

**Error:** "Permission denied" or similar

**Solution:** Make sure you're logged in as the project owner or have the necessary permissions.

### Issue: Wrong policy expression syntax

**Common mistakes:**
- ❌ Missing quotes: `bucket_id = story-images`
- ✅ Correct: `bucket_id = 'story-images'::text`
- ❌ Wrong function: `foldername(name)[1]`
- ✅ Correct: `(storage.foldername(name))[1]`

Just copy-paste the exact expressions provided above.

### Issue: Verification still shows 0 policies

**Debug:**
```sql
-- Check if policies exist with any name
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
ORDER BY policyname;
```

If this returns policies with different names, you may have created them with different names. Either:
1. Delete them and recreate with exact names
2. Update the verification script to match your policy names

---

## Why This Approach?

**SQL Editor Limitations:**
- Runs with restricted database role
- Cannot modify system tables (like `storage.objects`)
- Cannot create RLS policies on system schemas

**Dashboard UI Advantages:**
- Uses service role credentials
- Has full permissions
- Handles policy creation correctly
- Provides visual feedback

---

## Next Steps

After all 4 policies are created and verified:

1. ✅ Mark Task 1.3 as complete
2. ▶️ Proceed to Task 1.4: Update TypeScript Types
3. ▶️ Continue with Phase 2: Image Storage Service

---

## Quick Reference: Policy Expressions

All 4 policies use the SAME expression (just different commands):

```sql
(bucket_id = 'story-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)
```

**What this does:**
- `bucket_id = 'story-images'::text` → Only affects the story-images bucket
- `storage.foldername(name)` → Extracts folder path from file name
- `[1]` → Gets the first folder (user ID)
- `auth.uid()::text` → Current authenticated user's ID
- Combined: User can only access files in `{their_user_id}/...` paths

---

## Still Stuck?

Check the detailed troubleshooting guide:
- [`sql/TROUBLESHOOTING_BUCKET_SETUP.md`](./TROUBLESHOOTING_BUCKET_SETUP.md)

Or the full dashboard instructions:
- [`sql/create_story_images_bucket_dashboard.md`](./create_story_images_bucket_dashboard.md)
