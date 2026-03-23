-- ============================================================================
-- ANALYTICS QUERIES FOR STORY COMPLETION & IMAGE PERSISTENCE
-- Task 7.3: Monitoring Setup
-- ============================================================================
--
-- This file contains production-ready SQL queries for monitoring and analytics
-- of the Story Completion and Image Persistence feature.
--
-- Usage:
--   psql $DATABASE_URL -f sql/analytics_queries.sql
--   OR execute individual queries in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- STORY COMPLETION METRICS
-- ============================================================================

-- Query 1: Story Completion Rate (Daily)
-- Purpose: Track daily completion rates to identify trends
-- Target: >70% completion rate
SELECT
  DATE(created_at) as date,
  COUNT(*) as total_stories,
  COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END) as completed,
  ROUND(COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100, 2) as completion_rate_percent
FROM game_sessions
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Query 2: Completion Rate by Grade Level
-- Purpose: Identify which age groups complete stories more frequently
SELECT
  grade_level,
  COUNT(*) as total_stories,
  COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END) as completed,
  ROUND(COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100, 2) as completion_rate_percent,
  ROUND(AVG(CASE WHEN completed_at IS NOT NULL
    THEN EXTRACT(EPOCH FROM (completed_at::timestamp - created_at::timestamp)) / 60
    END), 1) as avg_completion_time_minutes
FROM game_sessions
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY grade_level
ORDER BY completion_rate_percent DESC;

-- Query 3: Round Distribution Analysis
-- Purpose: Understand at which rounds users drop off
SELECT
  current_round,
  COUNT(*) as session_count,
  ROUND(COUNT(*)::numeric / (SELECT COUNT(*) FROM game_sessions WHERE created_at >= NOW() - INTERVAL '7 days') * 100, 2) as percentage,
  COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END) as completed_at_this_round,
  COUNT(CASE WHEN generated_image_url IS NOT NULL THEN 1 END) as with_image
FROM game_sessions
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY current_round
ORDER BY current_round;

-- ============================================================================
-- IMAGE GENERATION & UPLOAD METRICS
-- ============================================================================

-- Query 4: Image Upload Success Rate
-- Purpose: Monitor Supabase Storage upload reliability
-- Target: >95% success rate
SELECT
  COUNT(*) as total_generations,
  COUNT(CASE WHEN image_upload_status = 'uploaded' THEN 1 END) as supabase_uploaded,
  COUNT(CASE WHEN image_upload_status = 'failed' THEN 1 END) as supabase_failed,
  COUNT(CASE WHEN image_upload_status = 'pending' THEN 1 END) as supabase_pending,
  COUNT(CASE WHEN image_upload_status IS NULL AND generated_image_url IS NOT NULL THEN 1 END) as no_status,
  ROUND(COUNT(CASE WHEN image_upload_status = 'uploaded' THEN 1 END)::numeric /
    NULLIF(COUNT(CASE WHEN generated_image_url IS NOT NULL THEN 1 END), 0) * 100, 2) as upload_success_rate_percent
FROM game_sessions
WHERE created_at >= NOW() - INTERVAL '7 days';

-- Query 5: Upload Performance Over Time
-- Purpose: Track upload success rates daily to detect degradation
SELECT
  DATE(created_at) as date,
  COUNT(CASE WHEN generated_image_url IS NOT NULL THEN 1 END) as total_with_images,
  COUNT(CASE WHEN image_upload_status = 'uploaded' THEN 1 END) as uploaded,
  COUNT(CASE WHEN image_upload_status = 'failed' THEN 1 END) as failed,
  ROUND(COUNT(CASE WHEN image_upload_status = 'uploaded' THEN 1 END)::numeric /
    NULLIF(COUNT(CASE WHEN generated_image_url IS NOT NULL THEN 1 END), 0) * 100, 2) as success_rate_percent,
  ROUND(AVG(CASE WHEN image_upload_status IS NOT NULL THEN image_upload_attempts END), 2) as avg_attempts
FROM game_sessions
WHERE created_at >= NOW() - INTERVAL '14 days'
  AND generated_image_url IS NOT NULL
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Query 6: Upload Retry Analysis
-- Purpose: Understand retry patterns and identify persistent failures
-- Alert: If avg_attempts > 2.0, investigate network/API issues
SELECT
  image_upload_attempts,
  COUNT(*) as session_count,
  COUNT(CASE WHEN image_upload_status = 'uploaded' THEN 1 END) as eventually_succeeded,
  COUNT(CASE WHEN image_upload_status = 'failed' THEN 1 END) as permanently_failed,
  ROUND(COUNT(CASE WHEN image_upload_status = 'uploaded' THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100, 2) as recovery_rate_percent
FROM game_sessions
WHERE image_upload_attempts > 0
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY image_upload_attempts
ORDER BY image_upload_attempts;

-- Query 7: Common Upload Error Patterns
-- Purpose: Identify most frequent failure reasons for troubleshooting
SELECT
  image_upload_error,
  COUNT(*) as error_count,
  ROUND(COUNT(*)::numeric / (SELECT COUNT(*) FROM game_sessions WHERE image_upload_status = 'failed' AND created_at >= NOW() - INTERVAL '7 days') * 100, 2) as percentage_of_failures,
  AVG(image_upload_attempts) as avg_attempts_before_failure
FROM game_sessions
WHERE image_upload_status = 'failed'
  AND image_upload_error IS NOT NULL
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY image_upload_error
ORDER BY error_count DESC
LIMIT 10;

-- ============================================================================
-- USER ENGAGEMENT METRICS
-- ============================================================================

-- Query 8: Image Generation Adoption Rate
-- Purpose: Track how many completed stories generate images
-- Target: >45% generation rate after completion
SELECT
  DATE(created_at) as date,
  COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END) as completed_stories,
  COUNT(CASE WHEN completed_at IS NOT NULL AND generated_image_url IS NOT NULL THEN 1 END) as with_generated_images,
  ROUND(COUNT(CASE WHEN completed_at IS NOT NULL AND generated_image_url IS NOT NULL THEN 1 END)::numeric /
    NULLIF(COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END), 0) * 100, 2) as generation_adoption_rate_percent
FROM game_sessions
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Query 9: User Story Completion Funnel
-- Purpose: Understand conversion rates through the story completion funnel
WITH funnel_data AS (
  SELECT
    COUNT(*) as started_stories,
    COUNT(CASE WHEN current_round >= 2 THEN 1 END) as reached_round_2,
    COUNT(CASE WHEN current_round >= 3 THEN 1 END) as reached_round_3,
    COUNT(CASE WHEN current_round >= 4 THEN 1 END) as reached_round_4,
    COUNT(CASE WHEN current_round >= 5 THEN 1 END) as reached_round_5,
    COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END) as completed,
    COUNT(CASE WHEN generated_image_url IS NOT NULL THEN 1 END) as generated_image
  FROM game_sessions
  WHERE created_at >= NOW() - INTERVAL '7 days'
)
SELECT
  'Started' as stage,
  started_stories as count,
  100.0 as conversion_rate_percent
FROM funnel_data
UNION ALL
SELECT
  'Round 2' as stage,
  reached_round_2 as count,
  ROUND(reached_round_2::numeric / NULLIF(started_stories, 0) * 100, 2) as conversion_rate_percent
FROM funnel_data
UNION ALL
SELECT
  'Round 3' as stage,
  reached_round_3 as count,
  ROUND(reached_round_3::numeric / NULLIF(started_stories, 0) * 100, 2) as conversion_rate_percent
FROM funnel_data
UNION ALL
SELECT
  'Round 4' as stage,
  reached_round_4 as count,
  ROUND(reached_round_4::numeric / NULLIF(started_stories, 0) * 100, 2) as conversion_rate_percent
FROM funnel_data
UNION ALL
SELECT
  'Round 5' as stage,
  reached_round_5 as count,
  ROUND(reached_round_5::numeric / NULLIF(started_stories, 0) * 100, 2) as conversion_rate_percent
FROM funnel_data
UNION ALL
SELECT
  'Completed' as stage,
  completed as count,
  ROUND(completed::numeric / NULLIF(started_stories, 0) * 100, 2) as conversion_rate_percent
FROM funnel_data
UNION ALL
SELECT
  'Generated Image' as stage,
  generated_image as count,
  ROUND(generated_image::numeric / NULLIF(completed, 0) * 100, 2) as conversion_rate_percent
FROM funnel_data;

-- ============================================================================
-- PERFORMANCE METRICS
-- ============================================================================

-- Query 10: Storage Growth Tracking
-- Purpose: Monitor Supabase Storage usage for capacity planning
-- Alert: If growth rate > 10GB/week, review storage quotas
SELECT
  DATE(created_at) as date,
  COUNT(CASE WHEN supabase_image_url IS NOT NULL THEN 1 END) as images_stored,
  -- Estimate: Average image size ~2MB
  ROUND(COUNT(CASE WHEN supabase_image_url IS NOT NULL THEN 1 END)::numeric * 2.0, 2) as estimated_storage_mb,
  SUM(COUNT(CASE WHEN supabase_image_url IS NOT NULL THEN 1 END)) OVER (ORDER BY DATE(created_at)) as cumulative_images
FROM game_sessions
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Query 11: Peak Usage Hours
-- Purpose: Identify high-traffic periods for capacity planning
SELECT
  EXTRACT(HOUR FROM created_at) as hour_of_day,
  COUNT(*) as story_starts,
  COUNT(CASE WHEN generated_image_url IS NOT NULL THEN 1 END) as image_generations,
  ROUND(AVG(CASE WHEN image_upload_status = 'uploaded' THEN 1 WHEN image_upload_status = 'failed' THEN 0 END) * 100, 2) as upload_success_rate_percent
FROM game_sessions
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY EXTRACT(HOUR FROM created_at)
ORDER BY hour_of_day;

-- ============================================================================
-- XP ECONOMY METRICS
-- ============================================================================

-- Query 12: XP Refund Analysis
-- Purpose: Monitor XP refund rates to detect API reliability issues
-- Alert: If refund_rate > 5%, investigate image generation service
WITH xp_events AS (
  SELECT
    DATE(created_at) as date,
    COUNT(*) as total_generations,
    COUNT(CASE WHEN generation_status = 'success' THEN 1 END) as successful,
    COUNT(CASE WHEN generation_status = 'failed' THEN 1 END) as failed,
    COUNT(CASE WHEN generation_status = 'refunded' THEN 1 END) as refunded,
    SUM(xp_cost) as total_xp_spent,
    SUM(CASE WHEN generation_status = 'refunded' THEN xp_cost ELSE 0 END) as total_xp_refunded
  FROM image_generation_events
  WHERE created_at >= NOW() - INTERVAL '14 days'
  GROUP BY DATE(created_at)
)
SELECT
  date,
  total_generations,
  successful,
  failed,
  refunded,
  ROUND(refunded::numeric / NULLIF(total_generations, 0) * 100, 2) as refund_rate_percent,
  total_xp_spent,
  total_xp_refunded,
  ROUND(total_xp_refunded::numeric / NULLIF(total_xp_spent, 0) * 100, 2) as xp_refund_rate_percent
FROM xp_events
ORDER BY date DESC;

-- ============================================================================
-- DATA QUALITY CHECKS
-- ============================================================================

-- Query 13: Data Integrity Validation
-- Purpose: Detect data inconsistencies that may indicate bugs
-- Alert: Any rows returned indicate data integrity issues
SELECT
  'Completed but current_round < 5' as issue_type,
  COUNT(*) as affected_sessions,
  array_agg(id ORDER BY created_at DESC LIMIT 5) as sample_session_ids
FROM game_sessions
WHERE completed_at IS NOT NULL
  AND current_round < 5
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY issue_type
HAVING COUNT(*) > 0

UNION ALL

SELECT
  'current_round > 5 (exceeds MAX_ROUNDS)' as issue_type,
  COUNT(*) as affected_sessions,
  array_agg(id ORDER BY created_at DESC LIMIT 5) as sample_session_ids
FROM game_sessions
WHERE current_round > 5
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY issue_type
HAVING COUNT(*) > 0

UNION ALL

SELECT
  'Image uploaded but no Replicate URL' as issue_type,
  COUNT(*) as affected_sessions,
  array_agg(id ORDER BY created_at DESC LIMIT 5) as sample_session_ids
FROM game_sessions
WHERE supabase_image_url IS NOT NULL
  AND generated_image_url IS NULL
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY issue_type
HAVING COUNT(*) > 0

UNION ALL

SELECT
  'Upload status without image URL' as issue_type,
  COUNT(*) as affected_sessions,
  array_agg(id ORDER BY created_at DESC LIMIT 5) as sample_session_ids
FROM game_sessions
WHERE image_upload_status IS NOT NULL
  AND generated_image_url IS NULL
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY issue_type
HAVING COUNT(*) > 0;

-- Query 14: Orphaned Data Detection
-- Purpose: Find data that may need cleanup
SELECT
  'Sessions older than 90 days with pending uploads' as issue_type,
  COUNT(*) as count
FROM game_sessions
WHERE image_upload_status = 'pending'
  AND created_at < NOW() - INTERVAL '90 days'

UNION ALL

SELECT
  'Very old incomplete sessions (>30 days)' as issue_type,
  COUNT(*) as count
FROM game_sessions
WHERE completed_at IS NULL
  AND current_round < 5
  AND created_at < NOW() - INTERVAL '30 days';

-- ============================================================================
-- REAL-TIME MONITORING QUERIES
-- ============================================================================

-- Query 15: Last Hour Summary (For Dashboards)
-- Purpose: Quick health check for monitoring dashboards
-- Refresh: Every 5 minutes
SELECT
  'Last Hour' as time_period,
  COUNT(*) as total_sessions,
  COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END) as completed,
  COUNT(CASE WHEN generated_image_url IS NOT NULL THEN 1 END) as with_images,
  COUNT(CASE WHEN image_upload_status = 'uploaded' THEN 1 END) as uploaded_to_supabase,
  COUNT(CASE WHEN image_upload_status = 'failed' THEN 1 END) as failed_uploads,
  COUNT(CASE WHEN image_upload_status = 'pending' THEN 1 END) as pending_uploads,
  ROUND(AVG(CASE WHEN image_upload_attempts > 0 THEN image_upload_attempts END), 2) as avg_upload_attempts,
  ROUND(COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as completion_rate_percent,
  ROUND(COUNT(CASE WHEN image_upload_status = 'uploaded' THEN 1 END)::numeric /
    NULLIF(COUNT(CASE WHEN generated_image_url IS NOT NULL THEN 1 END), 0) * 100, 1) as upload_success_rate_percent
FROM game_sessions
WHERE created_at >= NOW() - INTERVAL '1 hour';

-- Query 16: Active Issues Summary
-- Purpose: Quick view of current problems requiring attention
SELECT
  'Upload Failures (Last Hour)' as metric,
  COUNT(*) as count,
  'Investigate if > 5' as action
FROM game_sessions
WHERE image_upload_status = 'failed'
  AND created_at >= NOW() - INTERVAL '1 hour'

UNION ALL

SELECT
  'Stuck Pending Uploads (>30 min)' as metric,
  COUNT(*) as count,
  'Retry or mark as failed' as action
FROM game_sessions
WHERE image_upload_status = 'pending'
  AND generated_image_url IS NOT NULL
  AND created_at < NOW() - INTERVAL '30 minutes'

UNION ALL

SELECT
  'Data Integrity Issues (Last 24h)' as metric,
  COUNT(*) as count,
  'Review and fix data inconsistencies' as action
FROM game_sessions
WHERE created_at >= NOW() - INTERVAL '24 hours'
  AND (
    (completed_at IS NOT NULL AND current_round < 5) OR
    (current_round > 5) OR
    (supabase_image_url IS NOT NULL AND generated_image_url IS NULL)
  );

-- ============================================================================
-- USAGE INSTRUCTIONS
-- ============================================================================
--
-- Run all queries: psql $DATABASE_URL -f sql/analytics_queries.sql
-- Run specific query: Copy-paste individual query into Supabase SQL Editor
--
-- RECOMMENDED MONITORING SCHEDULE:
-- - Query 15 (Last Hour Summary): Every 5 minutes (automated)
-- - Query 16 (Active Issues): Every 15 minutes (automated alerts)
-- - Query 1-9 (KPIs): Daily review
-- - Query 10-14 (Diagnostics): Weekly review
-- - Query 13-14 (Data Quality): Weekly cleanup
--
-- ALERT THRESHOLDS:
-- - Story Completion Rate: <70% (Warning), <50% (Critical)
-- - Upload Success Rate: <95% (Warning), <85% (Critical)
-- - XP Refund Rate: >5% (Warning), >10% (Critical)
-- - Data Integrity Issues: >0 (Warning)
--
-- ============================================================================
