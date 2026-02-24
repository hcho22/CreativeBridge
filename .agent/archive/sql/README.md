# Database Migration Instructions

This directory contains SQL migration scripts for the CreativeBridge database.

## Current Migration: Story Completion and Image Persistence

**Migration File**: `add_story_completion_and_image_persistence.sql`
**Rollback File**: `rollback_story_completion_and_image_persistence.sql`
**Date**: 2026-01-06

### What This Migration Does

1. **Story Completion Tracking**

   - Adds `current_round` column to track story progress (1-5 rounds)
   - Automatically sets `completed_at` when story reaches round 5
   - Migrates existing stories with 5+ contributions to completed status

2. **Image Persistence (Supabase Storage)**

   - Adds `supabase_image_url` for permanent image backup
   - Adds `image_upload_status` to track upload state (pending/uploaded/failed)
   - Adds `image_upload_attempts` to track retry count
   - Adds `image_upload_error` for debugging failed uploads

3. **Performance Optimizations**
   - Creates indexes on frequently queried columns
   - Uses partial indexes to reduce index size
   - Adds column comments for documentation

## How to Apply Migration

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `add_story_completion_and_image_persistence.sql`
4. Paste into the SQL Editor
5. Click **Run** to execute the migration
6. Verify migration success by running the verification queries at the end

### Option 2: Supabase CLI

```bash
# Connect to your Supabase project
supabase db push

# Or run the migration directly
psql $DATABASE_URL < sql/add_story_completion_and_image_persistence.sql
```

### Option 3: Node.js Script

```javascript
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY, // Use service role key for migrations
);

const migrationSQL = fs.readFileSync(
  './sql/add_story_completion_and_image_persistence.sql',
  'utf8',
);

// Execute migration
await supabase.rpc('exec_sql', { sql: migrationSQL });
```

## Verification

After applying the migration, verify it worked:

```sql
-- Check that new columns exist
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'game_sessions'
  AND column_name IN (
    'current_round',
    'supabase_image_url',
    'image_upload_status',
    'image_upload_attempts',
    'image_upload_error'
  )
ORDER BY column_name;

-- Expected: 5 rows returned

-- Check indexes were created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'game_sessions'
  AND indexname LIKE 'idx_game_sessions_%'
ORDER BY indexname;

-- Expected: 3 new indexes
```

## Rollback

If you need to rollback the migration:

```sql
-- Run the rollback script
\i sql/rollback_story_completion_and_image_persistence.sql

-- Or copy/paste contents into Supabase SQL Editor
```

⚠️ **WARNING**: Rollback will **permanently delete** data in the new columns (current_round, supabase_image_url, etc.)

## Post-Migration Steps

After successfully applying the migration:

1. ✅ Restart the React Native app to pick up schema changes
2. ✅ Test story completion flow (write 5 rounds, verify completed_at is set)
3. ✅ Test image generation (verify Supabase upload happens in background)
4. ✅ Test offline mode (verify cached Supabase URLs work)
5. ✅ Test retry upload button (trigger failure, click retry)

## Troubleshooting

### Migration fails with "column already exists"

The migration uses `IF NOT EXISTS` clauses, so it's safe to run multiple times. If you see this error, the migration was already partially applied. Check which columns exist and manually run only the missing parts.

### Permission denied errors

Make sure you're using a database user with sufficient privileges:

- CREATE privilege on tables
- ALTER privilege on game_sessions table
- INDEX creation privilege

### RLS (Row Level Security) issues

The migration preserves existing RLS policies. Verify users can still only access their own data:

```sql
-- Test as regular user (not admin)
SELECT current_round, supabase_image_url, image_upload_status
FROM game_sessions
WHERE user_id = auth.uid();
```

## Support

If you encounter issues:

1. Check the verification queries above
2. Review error messages in Supabase logs
3. Consult the PRD at `.agent/Tasks/story-completion-and-image-persistence-PRD.md`
4. Check the implementation task list at `.agent/Tasks/TASKS-story-completion-and-image-persistence.md`
