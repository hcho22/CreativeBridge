-- ============================================================================
-- Supabase Data Retention Cleanup Script (US-015)
--
-- Enforces retention periods for legacy Supabase data:
-- - Analytics events: 90 days
-- - Migration events: 30 days (email scrubbed before deletion)
--
-- USAGE:
--   Run manually via Supabase SQL editor, or schedule as a pg_cron job:
--
--   SELECT cron.schedule(
--     'daily-data-retention',
--     '0 3 * * *',  -- 3:00 AM UTC daily
--     $$SELECT cleanup_expired_data()$$
--   );
--
-- PREREQUISITE: pg_cron extension must be enabled in Supabase dashboard.
-- ============================================================================

-- Wrap in a function for easy scheduling
CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  analytics_deleted integer := 0;
  migration_deleted integer := 0;
  migration_emails_scrubbed integer := 0;
  analytics_retention_days integer := 90;
  migration_retention_days integer := 30;
BEGIN
  -- -----------------------------------------------------------------------
  -- 1. Delete analytics events older than 90 days
  -- -----------------------------------------------------------------------
  DELETE FROM analytics_events
  WHERE created_at < NOW() - (analytics_retention_days || ' days')::interval;
  GET DIAGNOSTICS analytics_deleted = ROW_COUNT;

  -- -----------------------------------------------------------------------
  -- 2. Scrub emails from migration events (all remaining, before deletion)
  -- -----------------------------------------------------------------------
  UPDATE migration_events
  SET email = NULL
  WHERE email IS NOT NULL
    AND created_at < NOW() - (migration_retention_days || ' days')::interval;
  GET DIAGNOSTICS migration_emails_scrubbed = ROW_COUNT;

  -- -----------------------------------------------------------------------
  -- 3. Delete migration events older than 30 days
  -- -----------------------------------------------------------------------
  DELETE FROM migration_events
  WHERE created_at < NOW() - (migration_retention_days || ' days')::interval;
  GET DIAGNOSTICS migration_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'analytics_deleted', analytics_deleted,
    'migration_deleted', migration_deleted,
    'migration_emails_scrubbed', migration_emails_scrubbed,
    'run_at', NOW()
  );
END;
$$;

-- Run immediately (optional — comment out if only scheduling)
-- SELECT cleanup_expired_data();
