# Diversity System Setup & Debugging Guide

## 🐛 Current Issues: Database Tables Don't Exist

The diversity system is now properly integrated in the code, but the **database tables don't exist yet**. You may see one or both of these errors:

### Error 1: Element Storage Failure

```
❌ Database storage failed: Database insert failed: undefined
```

### Error 2: Diversity Score Storage Failure

```
📈 Diversity score calculated: 1.000 (3/3 novel)
❌ Failed to store diversity score: [object Object]
⚠️ Diversity score storage failed
```

**Both errors indicate missing database tables.** The migration creates 3 tables that all need to exist.

## ✅ Solution: Run the Missing Table Migration

### Your Situation

You got this error when trying to run the full migration:

```
ERROR: 42710: policy "story_elements_insert_own_data" for table "story_elements" already exists
```

This means **part of the migration was already run** (the `story_elements` table exists), but the `story_diversity_scores` table is missing.

### Quick Fix: Run the Targeted Script

**Instead of the full migration**, run this targeted script that creates ONLY the missing table:

**File to run**: [sql/fix_missing_diversity_score_table.sql](sql/fix_missing_diversity_score_table.sql)

1. Open **Supabase Dashboard** → **SQL Editor**
2. Copy the entire contents of `sql/fix_missing_diversity_score_table.sql`
3. Paste and run
4. You should see: `✅ story_diversity_scores table created successfully!`

### Step 1: Verify Tables Don't Exist (Optional)

If you want to check first, run this in your Supabase SQL Editor:

```sql
-- Copy and paste from sql/check_diversity_tables.sql
SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'story_elements'
) AS story_elements_exists;
```

If it returns `false`, the tables need to be created.

### Step 2: Run the Migration

In your Supabase SQL Editor, run the complete migration:

**File:** [sql/create_story_diversity_tables.sql](sql/create_story_diversity_tables.sql)

This migration creates:

1. ✅ `story_elements` - Stores extracted characters, settings, objects, plot patterns
2. ✅ `user_sessions` - Tracks 24-hour diversity windows per user
3. ✅ `story_diversity_scores` - Records diversity metrics for each story
4. ✅ All necessary indexes for performance
5. ✅ Row Level Security (RLS) policies for data protection
6. ✅ Helper functions for cleanup and management

### Step 3: Verify Migration Success

Run the diagnostic script:

```bash
# In Supabase SQL Editor
# Copy and paste from sql/check_diversity_tables.sql
```

You should see:

- `story_elements_exists: true`
- `user_sessions_exists: true`
- `story_diversity_scores_exists: true`

### Step 4: Test Story Generation

1. Start a new game in the app
2. Check the console/Reactotron for:
   ```
   ✅ Successfully stored 3 elements
   📊 Diversity score stored: 0.750
   ```

## 🔍 Improved Error Logging

I've enhanced the error handling to show the **full Supabase error details**:

```typescript
console.error('❌ Supabase insert error details:', {
  message: insertError.message,
  details: insertError.details,
  hint: insertError.hint,
  code: insertError.code,
  fullError: insertError,
});
```

Now when you run the app again, you'll see the **actual error message** which will help debug any remaining issues.

## 📊 Database Schema Overview

### story_elements Table

```sql
- id: UUID (primary key)
- story_id: UUID → game_sessions.id
- session_id: UUID → user_sessions.id
- element_type: 'character' | 'setting' | 'object' | 'plot_pattern'
- element_text: TEXT (normalized: lowercase, singular)
- embedding_vector: JSONB (1536-dimensional vector)
- created_at: TIMESTAMP
```

### user_sessions Table

```sql
- id: UUID (primary key)
- session_token: TEXT (unique, 'div_sess_...')
- user_id: UUID (nullable for anonymous)
- expires_at: TIMESTAMP (24 hours from creation)
- metadata: JSONB (optional extra data)
- created_at: TIMESTAMP
```

### story_diversity_scores Table

```sql
- id: UUID (primary key)
- story_id: UUID → game_sessions.id (unique)
- diversity_score: NUMERIC(5,4) (0.0000 to 1.0000)
- novel_element_count: INTEGER
- metadata: JSONB (breakdown by type, ratios)
- created_at: TIMESTAMP
```

## 🔐 Security: Row Level Security (RLS)

All tables have RLS policies that ensure:

- Users can only access their own data
- Ownership is verified through `auth.uid() = user_id`
- CASCADE deletes prevent orphaned records

## 🎯 Expected Behavior After Migration

### First Story

```
📦 Diversity guidance: (empty - no history)
✅ Story generated
🔍 Elements extracted: {characters: 2, settings: 1, objects: 1, plot_patterns: 2}
🧮 Embeddings generated: 6 vectors
💾 Successfully stored 6 elements
📊 Diversity score: 1.000 (all novel)
```

### Second Story

```
📦 Diversity guidance retrieved
   Recently used: dragon (1x), forest (1x)
   Suggested: urban settings, human characters, technological objects
✅ Story generated (different from first)
🔍 Elements extracted: {characters: 1, settings: 1, objects: 0, plot_patterns: 1}
💾 Successfully stored 3 elements
📊 Diversity score: 0.750 (some repetition)
```

### Third+ Stories

```
📦 Diversity guidance: increasingly comprehensive
   Recently used: dragon (2x), forest (2x), magic wand (2x)
   Suggested: concrete settings, non-fantasy themes
✅ Story generated (increasingly diverse)
📊 Diversity score: 0.850+ (high diversity)
```

## 🛠️ Troubleshooting

### Error: "relation 'story_elements' does not exist"

**Solution:** Run the migration in Supabase SQL Editor

### Error: "null value in column 'story_id' violates not-null constraint"

**Solution:** Ensure `sessionId` and `storyId` are passed from HomeScreen (already fixed in this PR)

### Error: "insert or update on table 'story_elements' violates foreign key constraint"

**Solution:** The `story_id` must reference an existing `game_sessions.id`

### Elements extracted but diversity score not calculated

**Check:** Logs should show "ℹ️ Skipping diversity score (no elements stored)" if storage failed

### Cache not invalidating

**Check:** Logs should show cache invalidation after successful storage

## 📝 Files Modified in This Fix

1. **Error Handling Improvement**

   - [src/services/postGenerationStorageService.ts](src/services/postGenerationStorageService.ts:208-220)
   - Now logs full Supabase error details for debugging

2. **Diagnostic Scripts**

   - [sql/check_diversity_tables.sql](sql/check_diversity_tables.sql) (NEW)
   - Quick check for table existence and structure

3. **Migration File** (already existed, needs to be run)
   - [sql/create_story_diversity_tables.sql](sql/create_story_diversity_tables.sql)
   - Complete database schema for diversity system

## 🎯 Next Steps

1. ✅ Run the migration in Supabase
2. ✅ Verify tables exist with diagnostic script
3. ✅ Test story generation - should now store elements
4. ✅ Play 3-5 games - verify diversity improves
5. ✅ Check database - should have data in `story_elements` table

## 📚 Additional Resources

- **Ralph PRD**: [.agent/Ralph/prd.json](.agent/Ralph/prd.json)
- **Database Schema Docs**: [.agent/System/database_schema.md](.agent/System/database_schema.md)
- **Development SOPs**: [.agent/SOP/development_procedures.md](.agent/SOP/development_procedures.md)

---

**After running the migration, your diversity system will be fully operational!** 🚀
