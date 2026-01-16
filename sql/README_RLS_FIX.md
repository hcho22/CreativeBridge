# RLS Policy Fix for Diversity Score UPSERT Operations

## Problem

The diversity score storage was failing with this error:

```
new row violates row-level security policy (USING expression) for table "story_diversity_scores"
```

## Root Cause

The `story_diversity_scores` table has Row-Level Security (RLS) enabled, but only had **INSERT** and **SELECT** policies defined. When using Supabase's `.upsert()` method:

1. First, it tries to INSERT the row
2. If there's a conflict on the `unique_story_diversity_score` constraint, it switches to UPDATE
3. **UPDATE requires a separate RLS policy**, which was missing

Without an UPDATE policy, PostgreSQL denies the update operation by default, causing the upsert to fail.

## Solution

The migration file `fix_diversity_score_rls_for_upsert.sql` adds the missing UPDATE policy:

```sql
CREATE POLICY story_diversity_scores_update_own_data
ON public.story_diversity_scores
FOR UPDATE
USING (...)  -- Can see the row (must own the story)
WITH CHECK (...);  -- Can update the row (must own the story)
```

## How to Apply the Fix

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the contents of `fix_diversity_score_rls_for_upsert.sql`
5. Click **Run** to execute the migration
6. Check the output to confirm all 3 policies are created

### Option 2: Supabase CLI

If you have the Supabase CLI installed:

```bash
# Make sure you're linked to your project
supabase link --project-ref your-project-ref

# Run the migration
supabase db push --file sql/fix_diversity_score_rls_for_upsert.sql
```

### Option 3: psql Command Line

If you have direct database access:

```bash
# Get your database connection string from Supabase dashboard
# Settings > Database > Connection String (Direct Connection)

psql "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres" \
  -f sql/fix_diversity_score_rls_for_upsert.sql
```

## Verification

After running the migration, you should see:

```
NOTICE: RLS policies for story_diversity_scores configured successfully
```

And the output should show 3 policies:

- `story_diversity_scores_insert_own_data`
- `story_diversity_scores_select_own_data`
- `story_diversity_scores_update_own_data`

## Testing

After applying the fix, test the diversity score storage:

1. Generate a new story in the app
2. Check the logs for: `💾 Diversity score stored successfully`
3. Generate another story in the same session
4. The second story should also succeed (this tests the UPDATE path of upsert)

## Related Files

- **Migration**: `sql/fix_diversity_score_rls_for_upsert.sql`
- **Original Schema**: `sql/create_story_diversity_tables.sql`
- **Service Code**: `src/services/diversityScoreStorageService.ts`

## Technical Details

### RLS Policy Behavior

| Operation | Policy Required        | Clauses Checked        |
| --------- | ---------------------- | ---------------------- |
| INSERT    | `FOR INSERT`           | `WITH CHECK`           |
| UPDATE    | `FOR UPDATE`           | `USING` + `WITH CHECK` |
| UPSERT    | Both INSERT and UPDATE | All clauses            |

### Why UPSERT Needs Both Policies

```typescript
// When this code runs...
await supabase
  .from('story_diversity_scores')
  .upsert(record, { onConflict: 'story_id' });

// PostgreSQL executes (simplified):
BEGIN;
  INSERT INTO story_diversity_scores VALUES (...);
  -- If conflict on story_id:
  UPDATE story_diversity_scores SET ... WHERE story_id = '...';
COMMIT;
```

Each path (INSERT vs UPDATE) requires its own RLS policy.

## Migration Safety

This migration is **safe to run multiple times** because:

- Uses `DROP POLICY IF EXISTS` before creating policies
- Only affects RLS policies, not data
- Grants are idempotent (can be run multiple times)
- Includes verification checks

## Rollback (if needed)

If you need to rollback this migration:

```sql
-- Remove the UPDATE policy
DROP POLICY IF EXISTS story_diversity_scores_update_own_data ON public.story_diversity_scores;

-- This will disable upsert operations (they'll fail on updates)
-- But INSERT operations will still work
```

Note: Rollback is not recommended as it will break the diversity score storage feature.
