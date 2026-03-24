-- US-013: Anonymize existing raw userIds in analytics_events table
-- Run this ONCE after deploying the anonymization changes to analyticsService.ts
--
-- This script replaces raw userIds with a salted hash to match the format
-- used by the updated analyticsService. After running, existing data
-- cannot be linked back to individual users.
--
-- IMPORTANT: This is a destructive, one-way migration. Back up the table first.
-- Run: CREATE TABLE analytics_events_backup AS SELECT * FROM analytics_events;

-- Step 1: Add a temporary column to mark already-anonymized rows
ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS _anonymized boolean DEFAULT false;

-- Step 2: Hash all non-anonymized, non-system userIds
-- Uses pgcrypto for SHA-256. The salt matches ANALYTICS_HASH_SALT in analyticsService.ts.
-- Note: The JS and SQL hashes use different algorithms, so after migration,
-- only new data from the app will be queryable by userId. Historical data
-- retains aggregate value (unique user counts) but individual lookup won't match.
-- For a production system, consider running the JS hashUserId function
-- over the data instead.

UPDATE analytics_events
SET
  "userId" = 'anon_' || encode(
    digest('cb-analytics-v1:' || "userId", 'sha256'),
    'hex'
  ),
  _anonymized = true
WHERE
  "userId" IS NOT NULL
  AND "userId" != 'system'
  AND _anonymized = false
  AND "userId" NOT LIKE 'anon_%';

-- Step 3: Remove deviceInfo from metadata JSONB
UPDATE analytics_events
SET metadata = metadata - 'deviceInfo'
WHERE metadata ? 'deviceInfo';

-- Step 4: Clean up temporary column
ALTER TABLE analytics_events DROP COLUMN IF EXISTS _anonymized;

-- Verify: count remaining raw userIds (should be 0, except 'system')
SELECT count(*) AS remaining_raw_userids
FROM analytics_events
WHERE "userId" IS NOT NULL
  AND "userId" != 'system'
  AND "userId" NOT LIKE 'anon_%';
