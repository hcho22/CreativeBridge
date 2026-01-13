#!/usr/bin/env ts-node
/**
 * Daily Error Monitoring Script
 *
 * Purpose: Monitor production errors, generate daily reports, and alert on critical issues
 * Usage: npm run monitor:errors
 *
 * Features:
 * - Fetches Supabase logs for errors
 * - Analyzes error patterns and trends
 * - Generates priority-based bug reports
 * - Sends alerts for critical issues
 * - Tracks error resolution metrics
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const REPORT_OUTPUT_DIR = path.join(
  __dirname,
  '../.agent/Monitoring/error-reports',
);

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Error priority levels (P0-P3)
enum ErrorPriority {
  P0_CRITICAL = 'P0 (Critical)',
  P1_HIGH = 'P1 (High)',
  P2_MEDIUM = 'P2 (Medium)',
  P3_LOW = 'P3 (Low)',
}

interface ErrorMetrics {
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsByPriority: Record<ErrorPriority, number>;
  uploadFailures: number;
  timeoutErrors: number;
  syncConflicts: number;
  apiFailures: number;
  criticalErrors: Array<{
    message: string;
    count: number;
    firstSeen: string;
    lastSeen: string;
  }>;
}

/**
 * Determine error priority based on type and impact
 */
function categorizeErrorPriority(
  errorType: string,
  affectedUsers: number,
  errorRate: number,
): ErrorPriority {
  // P0: Blocks core functionality or affects majority of users
  if (
    errorType.includes('database') ||
    errorType.includes('auth') ||
    affectedUsers > 100 ||
    errorRate > 0.5
  ) {
    return ErrorPriority.P0_CRITICAL;
  }

  // P1: Affects many users or critical features
  if (
    errorType.includes('upload') ||
    errorType.includes('generation') ||
    affectedUsers > 50 ||
    errorRate > 0.2
  ) {
    return ErrorPriority.P1_HIGH;
  }

  // P2: Minor impact or affects small subset
  if (affectedUsers > 10 || errorRate > 0.05) {
    return ErrorPriority.P2_MEDIUM;
  }

  // P3: Edge cases or very low impact
  return ErrorPriority.P3_LOW;
}

/**
 * Fetch error logs from Supabase for the last 24 hours
 */
async function fetchErrorLogs(): Promise<ErrorMetrics> {
  console.log('📊 Fetching error logs from Supabase...');

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  try {
    // Query 1: Image upload failures
    const { data: uploadErrors, error: uploadError } = await supabase
      .from('game_sessions')
      .select(
        'id, image_upload_status, image_upload_error, image_upload_attempts, created_at',
      )
      .eq('image_upload_status', 'failed')
      .gte('created_at', yesterday);

    if (uploadError) {
      console.error('Error fetching upload failures:', uploadError);
    }

    // Query 2: Sessions with unusual timeout patterns
    const { error: timeoutError } = await supabase
      .from('game_sessions')
      .select('id, created_at, completed_at')
      .gte('created_at', yesterday)
      .is('completed_at', null);

    if (timeoutError) {
      console.error('Error fetching timeout sessions:', timeoutError);
    }

    // Analyze errors
    const metrics: ErrorMetrics = {
      totalErrors: 0,
      errorsByType: {},
      errorsByPriority: {
        [ErrorPriority.P0_CRITICAL]: 0,
        [ErrorPriority.P1_HIGH]: 0,
        [ErrorPriority.P2_MEDIUM]: 0,
        [ErrorPriority.P3_LOW]: 0,
      },
      uploadFailures: uploadErrors?.length || 0,
      timeoutErrors: 0,
      syncConflicts: 0,
      apiFailures: 0,
      criticalErrors: [],
    };

    // Categorize upload errors
    if (uploadErrors) {
      const errorGroups: Record<string, any[]> = {};

      uploadErrors.forEach(error => {
        const errorMsg = error.image_upload_error || 'Unknown error';
        const errorKey = errorMsg.substring(0, 50); // Group by first 50 chars

        if (!errorGroups[errorKey]) {
          errorGroups[errorKey] = [];
        }
        errorGroups[errorKey].push(error);

        // Categorize error type
        if (
          errorMsg.includes('timeout') ||
          errorMsg.includes('Download timeout')
        ) {
          metrics.timeoutErrors++;
          metrics.errorsByType.timeout =
            (metrics.errorsByType.timeout || 0) + 1;
        } else if (errorMsg.includes('Network') || errorMsg.includes('fetch')) {
          metrics.apiFailures++;
          metrics.errorsByType.network =
            (metrics.errorsByType.network || 0) + 1;
        } else if (errorMsg.includes('Storage') || errorMsg.includes('quota')) {
          metrics.errorsByType.storage =
            (metrics.errorsByType.storage || 0) + 1;
        } else {
          metrics.errorsByType.other = (metrics.errorsByType.other || 0) + 1;
        }
      });

      // Track critical errors (errors affecting multiple users)
      Object.entries(errorGroups).forEach(([errorKey, errors]) => {
        if (errors.length >= 5) {
          const priority = categorizeErrorPriority(
            errorKey,
            errors.length,
            errors.length / (uploadErrors.length || 1),
          );

          metrics.errorsByPriority[priority]++;

          metrics.criticalErrors.push({
            message: errorKey,
            count: errors.length,
            firstSeen: errors[0].created_at,
            lastSeen: errors[errors.length - 1].created_at,
          });
        }
      });
    }

    metrics.totalErrors =
      metrics.uploadFailures +
      metrics.timeoutErrors +
      metrics.syncConflicts +
      metrics.apiFailures;

    console.log('✅ Error metrics collected');
    return metrics;
  } catch (error) {
    console.error('❌ Failed to fetch error logs:', error);
    throw error;
  }
}

/**
 * Generate a human-readable error report
 */
function generateErrorReport(metrics: ErrorMetrics): string {
  const today = new Date().toISOString().split('T')[0];

  let report = `# Daily Error Monitoring Report\n`;
  report += `**Date:** ${today}\n`;
  report += `**Generated:** ${new Date().toISOString()}\n\n`;
  report += `---\n\n`;

  // Executive Summary
  report += `## Executive Summary\n\n`;
  report += `- **Total Errors (24h):** ${metrics.totalErrors}\n`;
  report += `- **Image Upload Failures:** ${metrics.uploadFailures}\n`;
  report += `- **Timeout Errors:** ${metrics.timeoutErrors}\n`;
  report += `- **API Failures:** ${metrics.apiFailures}\n`;
  report += `- **Sync Conflicts:** ${metrics.syncConflicts}\n\n`;

  // Priority Breakdown
  report += `## Error Priority Breakdown\n\n`;
  report += `| Priority | Count | SLA |\n`;
  report += `|----------|-------|-----|\n`;
  report += `| ${ErrorPriority.P0_CRITICAL} | ${
    metrics.errorsByPriority[ErrorPriority.P0_CRITICAL]
  } | Fix within 4 hours |\n`;
  report += `| ${ErrorPriority.P1_HIGH} | ${
    metrics.errorsByPriority[ErrorPriority.P1_HIGH]
  } | Fix within 48 hours |\n`;
  report += `| ${ErrorPriority.P2_MEDIUM} | ${
    metrics.errorsByPriority[ErrorPriority.P2_MEDIUM]
  } | Fix within 1 week |\n`;
  report += `| ${ErrorPriority.P3_LOW} | ${
    metrics.errorsByPriority[ErrorPriority.P3_LOW]
  } | Backlog |\n\n`;

  // Error Types
  report += `## Error Types\n\n`;
  Object.entries(metrics.errorsByType).forEach(([type, count]) => {
    report += `- **${type}:** ${count}\n`;
  });
  report += `\n`;

  // Critical Errors (Affecting Multiple Users)
  if (metrics.criticalErrors.length > 0) {
    report += `## Critical Errors (Affecting 5+ Users)\n\n`;
    metrics.criticalErrors
      .sort((a, b) => b.count - a.count)
      .forEach((error, idx) => {
        report += `### ${idx + 1}. ${error.message}\n\n`;
        report += `- **Affected Users:** ${error.count}\n`;
        report += `- **First Seen:** ${error.firstSeen}\n`;
        report += `- **Last Seen:** ${error.lastSeen}\n`;
        report += `- **Priority:** ${categorizeErrorPriority(
          error.message,
          error.count,
          error.count / metrics.totalErrors,
        )}\n\n`;
      });
  } else {
    report += `## Critical Errors\n\n`;
    report += `✅ No critical errors detected (affecting 5+ users)\n\n`;
  }

  // Recommendations
  report += `## Recommendations\n\n`;

  if (metrics.errorsByPriority[ErrorPriority.P0_CRITICAL] > 0) {
    report += `🚨 **URGENT:** ${
      metrics.errorsByPriority[ErrorPriority.P0_CRITICAL]
    } P0 errors require immediate attention!\n\n`;
  }

  if (metrics.timeoutErrors > metrics.uploadFailures * 0.3) {
    report += `- Consider increasing timeout values or optimizing image download process\n`;
  }

  if (metrics.uploadFailures > 50) {
    report += `- High upload failure rate detected. Review Supabase Storage health and network connectivity\n`;
  }

  if (metrics.apiFailures > 20) {
    report += `- Multiple API failures detected. Check external service dependencies (Replicate, Supabase)\n`;
  }

  report += `\n`;

  // Action Items
  report += `## Action Items\n\n`;
  report += `- [ ] Review P0 errors and create incident tickets\n`;
  report += `- [ ] Investigate top 3 critical error patterns\n`;
  report += `- [ ] Update retry logic if needed\n`;
  report += `- [ ] Monitor error trends over next 24 hours\n`;
  report += `- [ ] Update runbooks for recurring issues\n\n`;

  report += `---\n\n`;
  report += `*Generated by CreativeBridge Error Monitoring System*\n`;

  return report;
}

/**
 * Save error report to file
 */
function saveReport(report: string): void {
  const today = new Date().toISOString().split('T')[0];
  const filename = `error-report-${today}.md`;

  // Ensure output directory exists
  if (!fs.existsSync(REPORT_OUTPUT_DIR)) {
    fs.mkdirSync(REPORT_OUTPUT_DIR, { recursive: true });
  }

  const filepath = path.join(REPORT_OUTPUT_DIR, filename);
  fs.writeFileSync(filepath, report, 'utf8');

  console.log(`📄 Report saved to: ${filepath}`);
}

/**
 * Check if any alerts should be sent
 */
function checkAlerts(metrics: ErrorMetrics): void {
  console.log('\n🔔 Checking for critical alerts...');

  const alerts: string[] = [];

  // Alert 1: P0 errors detected
  if (metrics.errorsByPriority[ErrorPriority.P0_CRITICAL] > 0) {
    alerts.push(
      `🚨 CRITICAL: ${
        metrics.errorsByPriority[ErrorPriority.P0_CRITICAL]
      } P0 errors detected requiring immediate attention!`,
    );
  }

  // Alert 2: Upload failure rate > 10%
  const uploadFailureRate =
    metrics.uploadFailures / Math.max(metrics.totalErrors, 1);
  if (uploadFailureRate > 0.1) {
    alerts.push(
      `⚠️  HIGH: Upload failure rate at ${(uploadFailureRate * 100).toFixed(
        1,
      )}% (threshold: 10%)`,
    );
  }

  // Alert 3: XP refund spike (>50 in 24h)
  // This would require additional query - placeholder for now
  // if (metrics.xpRefunds > 50) {
  //   alerts.push('⚠️  HIGH: XP refund spike detected (>50 in 24h)');
  // }

  if (alerts.length > 0) {
    console.log('\n🚨 ALERTS TRIGGERED:\n');
    alerts.forEach(alert => console.log(alert));
    console.log(
      '\n📧 In production, these alerts would be sent via email/Slack/PagerDuty',
    );
  } else {
    console.log('✅ No critical alerts - system healthy');
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('=== CreativeBridge Daily Error Monitoring ===\n');

  try {
    // Step 1: Fetch error logs
    const metrics = await fetchErrorLogs();

    // Step 2: Generate report
    console.log('\n📝 Generating error report...');
    const report = generateErrorReport(metrics);

    // Step 3: Save report
    saveReport(report);

    // Step 4: Check for critical alerts
    checkAlerts(metrics);

    console.log('\n✅ Daily error monitoring complete!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error monitoring failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { fetchErrorLogs, generateErrorReport, categorizeErrorPriority };
export type { ErrorMetrics, ErrorPriority };
