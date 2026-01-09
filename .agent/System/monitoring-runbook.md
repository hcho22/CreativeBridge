# Monitoring Runbook: Story Completion & Image Persistence
**Feature:** Story Completion Tracking & Image Persistence
**Version:** 1.0
**Last Updated:** 2026-01-08
**Owner:** Engineering Team

---

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [System Overview](#system-overview)
3. [Common Issues & Solutions](#common-issues--solutions)
4. [Alert Response Procedures](#alert-response-procedures)
5. [Diagnostic Queries](#diagnostic-queries)
6. [Recovery Procedures](#recovery-procedures)
7. [Escalation Guidelines](#escalation-guidelines)
8. [Post-Incident Actions](#post-incident-actions)

---

## Quick Reference

### Critical Contacts

| Role | Contact | When to Escalate |
|------|---------|------------------|
| On-Call Engineer | Slack: `@oncall` | All critical alerts |
| Engineering Lead | Slack: `@eng-lead` | Incidents > 30min unresolved |
| Product Manager | Slack: `@product` | User-facing degradation |
| Database Admin | Slack: `@dba` | Database performance issues |

### Key Dashboards

- **Primary Dashboard**: [Story Completion Overview](https://grafana.creativebridge.app/d/story-completion)
- **Storage Dashboard**: [Storage & Capacity](https://grafana.creativebridge.app/d/storage-capacity)
- **Operational Health**: [Ops Dashboard](https://grafana.creativebridge.app/d/ops-health)
- **Supabase Console**: [Production Project](https://app.supabase.com/project/your-project-ref)

### Quick Commands

```bash
# View monitoring dashboard
npm run deploy:monitor

# Run analytics queries
psql $DATABASE_URL -f sql/analytics_queries.sql

# Check recent errors
supabase logs --level error --project-ref <prod-ref>

# Retry stuck uploads
curl -X POST https://api.creativebridge.app/admin/retry-stuck-uploads \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## System Overview

### Architecture

```
User → App → Image Generation Service → Replicate API
                     ↓
              Supabase Storage ← Image Storage Service
                     ↓
              PostgreSQL (game_sessions table)
```

### Key Components

1. **Story Session Manager** (`src/services/storySessionManager.ts`)
   - Tracks `current_round` (1-5)
   - Auto-completes stories at round 5
   - Handles offline caching

2. **Image Storage Service** (`src/services/imageStorageService.ts`)
   - Uploads to Supabase Storage
   - Retry logic (3 attempts, exponential backoff)
   - 10MB file size limit

3. **Monitoring Service** (`src/services/monitoringService.ts`)
   - Real-time metrics tracking
   - Alert threshold evaluation
   - Performance analytics

### Data Flow

1. User completes round 5 → `completed_at` timestamp set
2. User requests image → XP deducted → Replicate API called
3. Replicate URL saved → `generated_image_url` populated
4. Background upload to Supabase → `image_upload_status` = 'pending'
5. Upload completes → `supabase_image_url` populated, status = 'uploaded'

---

## Common Issues & Solutions

### Issue 1: High Upload Failure Rate (>15%)

**Symptoms:**
- Alert: `upload_failure_rate_critical` triggered
- Dashboard shows success rate < 85%
- Users report "Image backup failed" messages

**Diagnosis:**
```sql
-- Check error patterns
SELECT
  image_upload_error,
  COUNT(*) as count,
  ROUND(AVG(image_upload_attempts), 2) as avg_attempts
FROM game_sessions
WHERE image_upload_status = 'failed'
  AND created_at >= NOW() - INTERVAL '1 hour'
GROUP BY image_upload_error
ORDER BY count DESC;
```

**Common Causes & Solutions:**

| Cause | Indicators | Solution |
|-------|-----------|----------|
| Supabase API outage | All uploads failing, error: "503 Service Unavailable" | Check [Supabase Status](https://status.supabase.com), wait for resolution |
| Storage quota exceeded | Error: "Storage limit reached" | Increase quota via Supabase dashboard |
| Network timeouts | Error: "Request timeout after 10000ms" | Increase timeout in `imageStorageService.ts`, check network |
| RLS policy issue | Error: "Permission denied" | Verify RLS policies in Supabase SQL Editor |
| Large image files | Error: "File size exceeds 10MB" | Check Replicate output sizes, adjust limit if needed |

**Immediate Actions:**
1. Check Supabase Status page
2. Run diagnostic query above
3. If quota issue: Increase storage quota
4. If RLS issue: Review policies in `sql/create_story_images_bucket.sql`
5. If persistent: Enable Replicate-only fallback mode

**Prevention:**
- Set up storage quota alert at 80%
- Monitor average image file sizes
- Regular RLS policy audits

---

### Issue 2: Stories Not Auto-Completing at Round 5

**Symptoms:**
- Alert: `completion_rate_crashed` triggered
- Sessions with `current_round` = 5 but no `completed_at`
- Users report stuck at round 5

**Diagnosis:**
```sql
-- Find stuck sessions
SELECT
  id,
  user_id,
  current_round,
  sentences_completed,
  completed_at,
  created_at
FROM game_sessions
WHERE current_round >= 5
  AND completed_at IS NULL
  AND created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 20;
```

**Common Causes & Solutions:**

1. **Bug in round increment logic**
   - Check: `storySessionManager.addContribution()` method
   - Verify: `session.current_round` increments after AI response
   - Fix: Deploy hotfix if logic broken

2. **Race condition in state updates**
   - Check: AsyncStorage vs Database sync
   - Verify: No conflicting updates to `current_round`
   - Fix: Add transaction locking

3. **Migration data issue**
   - Check: Old sessions created before migration
   - Verify: `current_round` defaulted to 1
   - Fix: Backfill script to complete old sessions

**Immediate Actions:**
```sql
-- Manually complete stuck sessions (if confirmed completed)
UPDATE game_sessions
SET
  completed_at = NOW(),
  updated_at = NOW()
WHERE current_round >= 5
  AND completed_at IS NULL
  AND sentences_completed >= 10
  AND created_at >= NOW() - INTERVAL '24 hours';
```

**Prevention:**
- Add integration test for auto-completion
- Monitor `current_round` distribution daily
- Data integrity checks in CI/CD

---

### Issue 3: Stuck Pending Uploads (>30 minutes)

**Symptoms:**
- Alert: `stuck_pending_uploads` triggered
- Images visible to users but status = 'pending'
- Background upload not completing

**Diagnosis:**
```sql
-- Find stuck uploads
SELECT
  id,
  user_id,
  generated_image_url,
  image_upload_status,
  image_upload_attempts,
  image_upload_error,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - created_at))/60 as minutes_stuck
FROM game_sessions
WHERE image_upload_status = 'pending'
  AND generated_image_url IS NOT NULL
  AND created_at < NOW() - INTERVAL '30 minutes'
ORDER BY created_at
LIMIT 50;
```

**Common Causes & Solutions:**

1. **Background worker crashed**
   - Check: Application logs for exceptions
   - Verify: No hung processes
   - Fix: Restart application or trigger manual retry

2. **Replicate URL expired**
   - Check: Try downloading `generated_image_url`
   - Verify: Replicate URLs valid for 60 minutes
   - Fix: Mark as failed, user keeps Replicate URL

3. **Network interruption**
   - Check: Network latency metrics
   - Verify: Retry logic executed all 3 attempts
   - Fix: Trigger manual retry

**Immediate Actions:**
```bash
# Manually retry stuck uploads via admin API
curl -X POST https://api.creativebridge.app/admin/retry-stuck-uploads \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "min_stuck_minutes": 30,
    "max_retries": 50
  }'
```

Or via SQL:
```sql
-- Mark very old pending uploads as failed (>2 hours)
UPDATE game_sessions
SET
  image_upload_status = 'failed',
  image_upload_error = 'Upload timeout - exceeded 2 hour limit',
  updated_at = NOW()
WHERE image_upload_status = 'pending'
  AND created_at < NOW() - INTERVAL '2 hours';
```

**Prevention:**
- Monitor stuck uploads every 15 minutes
- Set up automatic retry job for stuck uploads
- Add timeout for background uploads

---

### Issue 4: XP Refund Spike (>20%)

**Symptoms:**
- Alert: `xp_refund_spike_critical` triggered
- Many failed image generations
- Users complaining about wasted XP

**Diagnosis:**
```sql
-- Check refund patterns
SELECT
  DATE(created_at) as date,
  COUNT(*) as total_generations,
  COUNT(CASE WHEN generation_status = 'failed' THEN 1 END) as failures,
  COUNT(CASE WHEN generation_status = 'refunded' THEN 1 END) as refunds,
  ROUND(COUNT(CASE WHEN generation_status = 'refunded' THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100, 2) as refund_rate
FROM image_generation_events
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

**Common Causes & Solutions:**

1. **Replicate API outage**
   - Check: [Replicate Status](https://status.replicate.com)
   - Verify: Error messages contain "Replicate" or "503"
   - Fix: Wait for Replicate recovery, refunds are automatic

2. **Replicate quota exceeded**
   - Check: Replicate dashboard for quota usage
   - Verify: Error: "Rate limit exceeded"
   - Fix: Increase Replicate quota or add rate limiting

3. **Invalid prompt generation**
   - Check: Review prompt generation logic
   - Verify: Error: "Invalid prompt" or "Content policy"
   - Fix: Update prompt sanitization

**Immediate Actions:**
1. Check Replicate Status page
2. Verify Replicate API key and quota
3. If quota issue: Increase limit or pause feature
4. If outage: Communicate to users, wait for recovery

**Prevention:**
- Monitor Replicate API uptime
- Set up Replicate quota alerts
- Test prompt generation edge cases

---

### Issue 5: Data Integrity Violations

**Symptoms:**
- Alert: `data_integrity_violations` triggered
- Inconsistent data in `game_sessions`
- Analytics showing impossible states

**Diagnosis:**
```sql
-- Run full data integrity check
SELECT * FROM (
  SELECT
    'Completed but current_round < 5' as issue,
    COUNT(*) as count
  FROM game_sessions
  WHERE completed_at IS NOT NULL
    AND current_round < 5
    AND created_at >= NOW() - INTERVAL '24 hours'

  UNION ALL

  SELECT
    'current_round > 5 (exceeds MAX_ROUNDS)',
    COUNT(*)
  FROM game_sessions
  WHERE current_round > 5
    AND created_at >= NOW() - INTERVAL '24 hours'

  UNION ALL

  SELECT
    'Image uploaded but no Replicate URL',
    COUNT(*)
  FROM game_sessions
  WHERE supabase_image_url IS NOT NULL
    AND generated_image_url IS NULL
    AND created_at >= NOW() - INTERVAL '24 hours'
) violations
WHERE count > 0;
```

**Common Causes & Solutions:**

1. **Race condition in state updates**
   - Fix: Add database constraints
   - Review: Concurrent update logic

2. **Migration data inconsistency**
   - Fix: Run data migration repair script
   - Review: Migration SQL for bugs

3. **Manual data modification**
   - Fix: Audit database access logs
   - Review: Who has write access

**Immediate Actions:**
```sql
-- Fix: Cap current_round at 5
UPDATE game_sessions
SET current_round = 5, updated_at = NOW()
WHERE current_round > 5;

-- Fix: Remove orphaned upload URLs
UPDATE game_sessions
SET supabase_image_url = NULL, updated_at = NOW()
WHERE supabase_image_url IS NOT NULL
  AND generated_image_url IS NULL;

-- Fix: Complete sessions that should be complete
UPDATE game_sessions
SET completed_at = created_at + INTERVAL '30 minutes', updated_at = NOW()
WHERE current_round >= 5
  AND sentences_completed >= 10
  AND completed_at IS NULL
  AND created_at >= NOW() - INTERVAL '7 days';
```

**Prevention:**
- Add database CHECK constraints
- Run data integrity tests in CI
- Weekly data quality reviews

---

## Alert Response Procedures

### Critical Alerts (P0) - Response Time: 5 minutes

**General Response Flow:**
1. **Acknowledge** alert within 5 minutes
2. **Assess** severity via dashboards
3. **Diagnose** root cause using queries
4. **Mitigate** immediate impact
5. **Resolve** underlying issue
6. **Document** in incident log

### Alert-Specific Procedures

#### `storage_quota_90_percent` (CRITICAL)

```
1. Check current usage:
   - Supabase Dashboard → Storage → story-images bucket

2. Immediate action:
   - If >95%: Increase quota immediately
   - If 90-95%: Plan quota increase within 24h

3. Investigation:
   - Run Query 10 (Storage Growth Tracking)
   - Calculate daily growth rate
   - Estimate days to 100%

4. Long-term:
   - Implement image compression
   - Set up automatic scaling
   - Archive old images

5. Communication:
   - Notify team in #engineering
   - Update capacity planning doc
```

#### `upload_failure_rate_critical` (CRITICAL)

```
1. Check Supabase status:
   - https://status.supabase.com

2. Run diagnostic query:
   SELECT image_upload_error, COUNT(*) as count
   FROM game_sessions
   WHERE image_upload_status = 'failed'
     AND created_at >= NOW() - INTERVAL '1 hour'
   GROUP BY image_upload_error
   ORDER BY count DESC
   LIMIT 5;

3. Common fixes:
   - If RLS error: Fix RLS policies
   - If timeout: Increase timeout setting
   - If quota: Increase storage quota

4. If unresolvable:
   - Enable Replicate-only fallback
   - Notify users of degraded functionality

5. Communication:
   - Post in #alerts-critical
   - Update status page if user-facing
```

#### `completion_rate_crashed` (CRITICAL)

```
1. Check for widespread issue:
   - Review error logs for exceptions
   - Check deployment history

2. Run diagnostic query:
   SELECT current_round, COUNT(*) as stuck
   FROM game_sessions
   WHERE completed_at IS NULL
     AND current_round >= 5
     AND created_at >= NOW() - INTERVAL '2 hours'
   GROUP BY current_round;

3. Quick fix options:
   - If recent deployment: Rollback
   - If isolated: Manual completion script
   - If code bug: Deploy hotfix

4. Communication:
   - Notify product team
   - Assess user impact
```

### Warning Alerts (P2) - Response Time: 30 minutes

- Review during business hours
- Monitor for escalation to critical
- Create ticket for investigation
- No immediate user communication needed

### Info Alerts (P3/P4) - Response Time: Best effort

- Review during weekly metrics review
- Track trends over time
- No immediate action required

---

## Diagnostic Queries

### Health Check (Run First)

```sql
-- Last Hour Summary
SELECT
  'Total Sessions' as metric,
  COUNT(*) as value
FROM game_sessions
WHERE created_at >= NOW() - INTERVAL '1 hour'

UNION ALL

SELECT
  'Completed',
  COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END)
FROM game_sessions
WHERE created_at >= NOW() - INTERVAL '1 hour'

UNION ALL

SELECT
  'Images Generated',
  COUNT(CASE WHEN generated_image_url IS NOT NULL THEN 1 END)
FROM game_sessions
WHERE created_at >= NOW() - INTERVAL '1 hour'

UNION ALL

SELECT
  'Uploads Successful',
  COUNT(CASE WHEN image_upload_status = 'uploaded' THEN 1 END)
FROM game_sessions
WHERE created_at >= NOW() - INTERVAL '1 hour'

UNION ALL

SELECT
  'Upload Failures',
  COUNT(CASE WHEN image_upload_status = 'failed' THEN 1 END)
FROM game_sessions
WHERE created_at >= NOW() - INTERVAL '1 hour';
```

### Detailed Error Analysis

```sql
-- Top 5 Errors with Context
SELECT
  image_upload_error,
  COUNT(*) as occurrences,
  ROUND(AVG(image_upload_attempts), 2) as avg_attempts,
  MIN(created_at) as first_seen,
  MAX(created_at) as last_seen,
  array_agg(DISTINCT grade_level) as affected_grades
FROM game_sessions
WHERE image_upload_status = 'failed'
  AND image_upload_error IS NOT NULL
  AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY image_upload_error
ORDER BY occurrences DESC
LIMIT 5;
```

### User Impact Assessment

```sql
-- Affected Users Count
SELECT
  COUNT(DISTINCT user_id) as affected_users,
  COUNT(*) as affected_sessions,
  ROUND(AVG(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END) * 100, 1) as completion_rate,
  ROUND(AVG(CASE WHEN image_upload_status = 'failed' THEN 1 ELSE 0 END) * 100, 1) as failure_rate
FROM game_sessions
WHERE created_at >= NOW() - INTERVAL '24 hours';
```

---

## Recovery Procedures

### Rollback Procedure

**When to Rollback:**
- Critical bug affecting >50% of users
- Data corruption detected
- Security vulnerability discovered
- System stability compromised

**Rollback Steps:**

```bash
# 1. Notify team
slack-cli post -c #engineering "🚨 ROLLBACK IN PROGRESS - Story Completion Feature"

# 2. Revert code deployment
git revert <commit-hash>
git push origin main

# 3. Rollback database migration (if needed)
psql $DATABASE_URL -f sql/rollback_story_completion_and_image_persistence.sql

# 4. Verify rollback
npm run test:smoke-tests

# 5. Monitor
npm run deploy:monitor

# 6. Document
# Create incident report with:
# - What triggered rollback
# - What was rolled back
# - Current system state
# - Next steps
```

### Manual Recovery Scripts

#### Retry All Failed Uploads

```sql
-- Set failed uploads back to pending for retry
UPDATE game_sessions
SET
  image_upload_status = 'pending',
  image_upload_attempts = 0,
  image_upload_error = NULL,
  updated_at = NOW()
WHERE image_upload_status = 'failed'
  AND generated_image_url IS NOT NULL
  AND created_at >= NOW() - INTERVAL '24 hours'
RETURNING id, user_id, generated_image_url;
```

#### Complete Stuck Sessions

```sql
-- Manually complete sessions stuck at round 5
UPDATE game_sessions
SET
  completed_at = NOW(),
  updated_at = NOW()
WHERE current_round >= 5
  AND completed_at IS NULL
  AND sentences_completed >= 10
  AND created_at >= NOW() - INTERVAL '7 days'
RETURNING id, user_id, current_round, sentences_completed;
```

---

## Escalation Guidelines

### When to Escalate

| Situation | Escalate To | Timeframe |
|-----------|------------|-----------|
| Cannot resolve P0 within 15min | Engineering Lead | Immediately |
| Database performance degradation | Database Admin | Within 10min |
| User-facing outage >30min | Product Manager | Within 30min |
| Security concern | Security Team | Immediately |
| Third-party API outage | CTO | Within 1 hour |

### Escalation Template

```
Subject: [P0] Story Completion - [Brief Description]

SEVERITY: Critical / High / Medium
STARTED: [Timestamp]
IMPACT: [Number of users / % of traffic]
STATUS: Investigating / Mitigating / Resolved

DESCRIPTION:
[What is happening]

ROOT CAUSE:
[Known or suspected cause]

ACTIONS TAKEN:
- [Action 1]
- [Action 2]

NEXT STEPS:
- [Next action]
- [ETA]

DASHBOARDS:
[Link to relevant dashboards]
```

---

## Post-Incident Actions

### Incident Report Template

```markdown
# Incident Report: [Title]

**Date:** [YYYY-MM-DD]
**Duration:** [Start - End]
**Severity:** [P0/P1/P2]
**Status:** Resolved

## Summary
[One paragraph describing what happened]

## Impact
- **Users Affected:** [Number or percentage]
- **Services Affected:** [List]
- **Duration:** [Minutes/Hours]

## Timeline
- HH:MM - Alert triggered
- HH:MM - Engineer acknowledged
- HH:MM - Root cause identified
- HH:MM - Mitigation applied
- HH:MM - Incident resolved

## Root Cause
[Detailed explanation of what caused the incident]

## Resolution
[What was done to fix it]

## Action Items
- [ ] [Preventive measure 1] - Owner: [Name] - Due: [Date]
- [ ] [Preventive measure 2] - Owner: [Name] - Due: [Date]

## Lessons Learned
[What we learned and how to prevent this in the future]
```

### Follow-Up Checklist

- [ ] Incident report completed within 48 hours
- [ ] Root cause analysis documented
- [ ] Prevention action items created with owners
- [ ] Monitoring and alerts updated if needed
- [ ] Runbook updated with new learnings
- [ ] Team debrief scheduled within 1 week
- [ ] Stakeholders notified of resolution

---

## Additional Resources

### Documentation Links
- [Feature PRD](../Tasks/story-completion-and-image-persistence-PRD.md)
- [Implementation Tasks](../Tasks/TASKS-story-completion-and-image-persistence.md)
- [Database Schema](./database_schema.md)
- [API Documentation](./api_documentation.md)

### External Resources
- [Supabase Storage Docs](https://supabase.com/docs/guides/storage)
- [Replicate API Docs](https://replicate.com/docs)
- [PostgreSQL Monitoring](https://www.postgresql.org/docs/current/monitoring.html)

### Team Channels
- `#engineering` - General engineering discussion
- `#alerts-critical` - Critical alerts only
- `#alerts-warnings` - Warning level alerts
- `#analytics` - Metrics and trends
- `#incidents` - Active incident coordination

---

**Document Maintenance:**
- Review and update quarterly
- Update after each major incident
- Keep contact information current
- Archive outdated procedures

**Last Reviewed:** 2026-01-08
**Next Review Due:** 2026-04-08
