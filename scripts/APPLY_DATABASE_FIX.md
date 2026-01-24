# 🔧 Fix: User Statistics Not Updating

## 🎯 Root Cause Identified

Your app is **failing to update user statistics** because the required database functions **do not exist in your Supabase database**.

The SQL migration file was created (`sql/create_add_user_xp_function.sql`) but **was never executed** on your database.

## ✅ The Fix (5 Minutes)

Follow these steps to fix the issue:

### Step 1: Apply the Database Migration

1. **Open your Supabase Dashboard**

   - Go to https://supabase.com
   - Select your CreativeBridge project

2. **Navigate to SQL Editor**

   - Click "SQL Editor" in the left sidebar
   - Click "New query" button

3. **Copy and Execute the Migration**

   - Open the file: `sql/create_add_user_xp_function.sql`
   - Copy the **entire contents** of the file
   - Paste into the Supabase SQL Editor
   - Click **"Run"** (or press Cmd/Ctrl + Enter)

4. **Verify Success**
   - You should see: `add_user_xp and related functions created successfully`
   - If you see any errors, **stop** and report them

### Step 2: Verify Functions Were Created

Run this query in the SQL Editor to confirm:

\`\`\`sql
SELECT
proname as function_name,
pg_get_function_arguments(oid) as arguments
FROM pg_proc
WHERE proname IN (
'add_user_xp',
'complete_game_session',
'increment_games_played',
'update_best_score',
'increment_stories_completed'
)
ORDER BY proname;
\`\`\`

**Expected Result:** Should show 5 functions.

**If you see 0 rows:** The migration failed. Check for errors above.

### Step 3: Test the Fix

1. **Open your CreativeBridge app**

2. **Start a new story:**

   - Go to Home screen
   - Tap "Start New Story"
   - Select any grade level

3. **Complete the story:**

   - Make 5 user contributions (write something each round)
   - Wait for AI to respond each time
   - After the 5th AI response, the story should auto-complete

4. **Check your statistics:**
   - Navigate to Profile screen
   - Your statistics should now update:
     - ✅ Total XP should increase
     - ✅ Games Played should increment
     - ✅ Words Written should show your word count
     - ✅ Total Stories Completed should increment

### Step 4: Check the Console Logs

After completing a story, you should see these logs:

\`\`\`
🎉 Story reached MAX_ROUNDS - marking as complete
💰 Calculated rewards: {...}
📊 Updating user statistics for completed story: {...}
✅ User statistics updated successfully
\`\`\`

**If you don't see these logs**, the story didn't complete properly. Check:

- Did you reach round 5 (5 AI responses)?
- Are there any error messages in the console?

## 🔍 Debugging Issues

### Issue: "Function does not exist" Error

**Cause:** The migration didn't run successfully.

**Fix:**

1. Check for SQL syntax errors in the output
2. Ensure you have the correct permissions
3. Try running the migration again

### Issue: Statistics Still Not Updating

**Cause:** The code might not be reaching the completion logic.

**Fix:**

1. Check console logs for the `🎉 Story reached MAX_ROUNDS` message
2. If missing, check that `current_round` is incrementing properly
3. Run the debug queries in `scripts/debug-session-completion.js`

### Issue: Negative XP or Invalid Statistics

**Cause:** The database function uses `GREATEST()` to prevent negative values.

**Fix:** This should be automatic. If you see negative XP:

1. Check the `user_profiles` table directly
2. Manually reset: `UPDATE user_profiles SET total_xp = 0 WHERE total_xp < 0;`

## 📊 Optional: Backfill Existing Data

If you want to update statistics for stories that were completed before this fix:

\`\`\`sql
-- Backfill statistics for all completed games
DO $$
DECLARE
user_record RECORD;
completed_count INTEGER;
total_words INTEGER;
max_score INTEGER;
total_xp_calc INTEGER;
BEGIN
FOR user_record IN
SELECT DISTINCT user_id FROM game_sessions WHERE completed_at IS NOT NULL
LOOP
-- Calculate totals from game_sessions
SELECT
COUNT(\*),
COALESCE(SUM(words_written), 0),
COALESCE(MAX(final_score), 0),
COALESCE(SUM(xp_earned), 0)
INTO completed_count, total_words, max_score, total_xp_calc
FROM game_sessions
WHERE user_id = user_record.user_id AND completed_at IS NOT NULL;

    -- Update user profile with calculated values
    UPDATE user_profiles
    SET
      total_games_played = GREATEST(total_games_played, completed_count),
      total_stories_completed = GREATEST(total_stories_completed, completed_count),
      total_words_written = GREATEST(total_words_written, total_words),
      best_score = GREATEST(best_score, max_score),
      total_xp = GREATEST(total_xp, total_xp_calc),
      updated_at = NOW()
    WHERE id = user_record.user_id;

    RAISE NOTICE 'Backfilled user %: % games, % XP', user_record.user_id, completed_count, total_xp_calc;

END LOOP;
END $$;
\`\`\`

## 🎉 Success Criteria

After applying this fix, you should see:

- [x] 5 database functions created
- [x] Console logs showing "✅ User statistics updated successfully"
- [x] Profile screen displaying accurate statistics:
  - Total XP increasing after each completed story
  - Games Played incrementing
  - Words Written accumulating
  - Best Score updating when you beat your high score
  - Streaks tracking correctly

## 📝 What Changed

This fix adds 5 critical database functions that were missing:

1. **`complete_game_session`** - Main function called when story completes

   - Increments games_played
   - Increments stories_completed
   - Adds XP earned
   - Adds words written
   - Updates best_score (if higher)
   - Updates streak

2. **`add_user_xp`** - Handles XP additions/deductions (for image generation)

3. **`increment_games_played`** - Standalone games counter

4. **`update_best_score`** - Updates high score

5. **`increment_stories_completed`** - Standalone completion counter

All functions use `SECURITY DEFINER` for proper permissions while maintaining Row Level Security.

## 🚨 Important Notes

- **The code was already correct** - it was calling these functions
- **The database was missing the functions** - they were never created
- **This is a database-only fix** - no code changes needed
- **It's safe to run** - all functions use idempotent operations

## ❓ Questions?

If you encounter any issues:

1. Check the Supabase SQL Editor for error messages
2. Run the verification query to confirm functions exist
3. Check console logs for the completion flow messages
4. Review `scripts/debug-session-completion.js` for diagnostic queries

---

**Fix Created:** 2026-01-23
**Estimated Time:** 5 minutes
**Risk Level:** Low (database function creation only)
