# Quick Start Guide - Production Migration Task 7.1

**⚡ For experienced operators who have completed the pre-deployment checklist**

## Before You Begin

**CRITICAL**: Have you completed ALL items in the pre-deployment checklist?

See [PRODUCTION_MIGRATION_GUIDE.md](./PRODUCTION_MIGRATION_GUIDE.md) for the full checklist.

## Quick Migration Steps

### Step 1: Test in Dry-Run Mode (RECOMMENDED)

```bash
# Test the migration process without making changes
./scripts/run-production-migration.sh \
  --project-ref your-production-project-ref \
  --dry-run
```

Expected output: All checks pass, no errors

### Step 2: Execute Production Migration

```bash
# Run the actual migration
./scripts/run-production-migration.sh \
  --project-ref your-production-project-ref
```

The script will:
1. ✅ Check prerequisites
2. ✅ Create backup
3. ✅ Run health checks
4. ✅ Apply migration
5. ✅ Verify results

**Total time: ~2-5 minutes**

### Step 3: Monitor for 1 Hour

```bash
# Watch error logs
supabase logs --project-ref your-production-project-ref --level error --follow
```

Look for:
- ❌ Any SQL errors related to new columns
- ❌ Application errors
- ❌ Increased error rates

If errors spike: Review [Rollback Procedure](#rollback-if-needed)

## Verification Checklist

Run these queries to verify success:

```sql
-- 1. All 5 columns exist?
SELECT column_name FROM information_schema.columns
WHERE table_name = 'game_sessions'
  AND column_name IN ('current_round', 'supabase_image_url', 'image_upload_status', 'image_upload_attempts', 'image_upload_error');
-- Expected: 5 rows

-- 2. All 3 indexes created?
SELECT indexname FROM pg_indexes
WHERE tablename = 'game_sessions'
  AND indexname LIKE 'idx_game_sessions_%';
-- Expected: 3+ rows (including new indexes)

-- 3. Data integrity OK?
SELECT
  COUNT(*) as total,
  COUNT(CASE WHEN sentences_completed >= 10 AND completed_at IS NULL THEN 1 END) as error_should_be_complete,
  COUNT(CASE WHEN current_round > 5 OR current_round < 1 THEN 1 END) as error_invalid_round
FROM game_sessions;
-- Expected: Both error counts = 0
```

**If ANY verification fails**: See rollback procedure below

## Rollback (If Needed)

**Only if critical issues occur**

```bash
# Execute rollback script
supabase db execute \
  -f sql/rollback_story_completion_and_image_persistence.sql \
  --project-ref your-production-project-ref

# Verify rollback succeeded
supabase db execute --project-ref your-production-project-ref <<SQL
SELECT column_name FROM information_schema.columns
WHERE table_name = 'game_sessions'
  AND column_name IN ('current_round', 'supabase_image_url', 'image_upload_status');
SQL
# Expected: 0 rows (columns removed)
```

If rollback fails, restore from backup:
```bash
# Use backup created by migration script
supabase db reset --project-ref your-production-project-ref
supabase db restore backups/backup_prod_story_completion_*.sql --project-ref your-production-project-ref
```

## Files Created by Migration

The migration script creates:
- `backups/backup_prod_story_completion_YYYYMMDD_HHMMSS.sql` - Database backup
- `backups/verification_results_YYYYMMDD_HHMMSS.txt` - Verification output

**Keep these files for at least 30 days**

## Success Criteria

Migration is successful when:
- ✅ All 5 columns added
- ✅ All 3 indexes created
- ✅ No data integrity errors
- ✅ Query performance < 50ms
- ✅ Application logs show no errors
- ✅ Smoke tests pass

## Next Steps After Success

1. ✅ Monitor metrics for 24 hours
2. ✅ Update deployment log
3. ✅ Notify team of success
4. ✅ Mark Task 7.1 complete in task tracker
5. ✅ Plan for Task 7.2 (Code Deployment)

## Support

**Issues during migration?**
- Review detailed guide: [PRODUCTION_MIGRATION_GUIDE.md](./PRODUCTION_MIGRATION_GUIDE.md)
- Check emergency contacts in guide
- Document all issues for post-mortem

## Command Reference

```bash
# Dry run (safe, no changes)
./scripts/run-production-migration.sh --project-ref <ref> --dry-run

# Full migration
./scripts/run-production-migration.sh --project-ref <ref>

# Skip backup (NOT RECOMMENDED)
./scripts/run-production-migration.sh --project-ref <ref> --skip-backup

# View help
./scripts/run-production-migration.sh --help

# Manual migration (if script fails)
supabase db execute -f sql/add_story_completion_and_image_persistence.sql --project-ref <ref>
supabase db execute -f sql/verify_migration.sql --project-ref <ref>

# Manual rollback
supabase db execute -f sql/rollback_story_completion_and_image_persistence.sql --project-ref <ref>
```

---

**Migration Prepared**: 2026-01-08
**Task Reference**: TASKS-story-completion-and-image-persistence.md - Phase 7, Task 7.1
**Estimated Duration**: 2-5 minutes (plus 1 hour monitoring)
**Risk Level**: LOW (additive changes only)
