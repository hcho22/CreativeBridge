/**
 * Convex Cron Jobs for CreativeBridge
 *
 * Scheduled tasks that run automatically on a recurring basis.
 *
 * ## Jobs:
 * - Daily data retention cleanup (US-015): Deletes expired story sessions,
 *   image generation events, and migration events per retention policy.
 * - Daily expired consent cleanup (US-002): Deletes pending accounts where
 *   parental consent was not granted within 48 hours.
 */

import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

/**
 * Data retention cleanup — runs daily at 3:00 AM UTC.
 * Enforces retention periods defined in the privacy policy:
 * - Story sessions: 1 year after last access
 * - Image generation events: 90 days
 * - Migration events: 30 days (with email scrubbing)
 *
 * @see convex/dataRetention.ts
 * @implements US-015
 */
crons.daily(
  'data retention cleanup',
  { hourUTC: 3, minuteUTC: 0 },
  internal.dataRetention.runDailyRetentionCleanup,
);

/**
 * Expired consent cleanup — runs daily at 4:00 AM UTC.
 * Deletes pending accounts where parental consent was not granted
 * within 48 hours of the consent email being sent.
 *
 * @see convex/consent.ts
 * @implements US-002
 */
crons.daily(
  'expired consent cleanup',
  { hourUTC: 4, minuteUTC: 0 },
  internal.consent.cleanupExpiredPendingConsent,
);

/**
 * Old consent record cleanup — runs weekly on Sundays at 5:00 AM UTC.
 * Deletes consent records where the associated account was deleted 3+ years ago.
 * COPPA requires retaining consent records for 3 years after account deletion.
 *
 * @see convex/consent.ts
 * @implements US-016
 */
crons.weekly(
  'old consent record cleanup',
  { dayOfWeek: 'sunday', hourUTC: 5, minuteUTC: 0 },
  internal.consent.cleanupOldConsentRecords,
);

/**
 * Annual consent renewal check — runs daily at 6:00 AM UTC.
 * Scans granted VPC consent records for:
 * - 11-month mark: flags for renewal reminder email
 * - 12-month mark: enforces renewal_required state on child account
 * - Age-out: skips renewal if child has turned 13
 *
 * @see convex/consent.ts
 * @implements US-022
 */
crons.daily(
  'consent renewal check',
  { hourUTC: 6, minuteUTC: 0 },
  internal.consent.checkConsentRenewals,
);

export default crons;
