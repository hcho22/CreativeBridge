#!/usr/bin/env ts-node

/**
 * Deployment Monitoring Script
 * Task 7.2: Code Deployment
 *
 * Real-time monitoring of key metrics during deployment rollout.
 * Run this continuously during the gradual rollout phases.
 *
 * Usage:
 *   npx ts-node scripts/monitor-deployment.ts [--interval 300]
 *
 * Options:
 *   --interval: Refresh interval in seconds (default: 300 = 5 minutes)
 */

import { createClient } from '@supabase/supabase-js';

// Parse command line arguments
const args = process.argv.slice(2);
const intervalIndex = args.indexOf('--interval');
const REFRESH_INTERVAL =
  intervalIndex !== -1 && args[intervalIndex + 1]
    ? parseInt(args[intervalIndex + 1], 10) * 1000
    : 300000; // 5 minutes default

// Color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m',
};

/**
 * Clear console and move cursor to top
 */
function clearScreen() {
  console.clear();
  process.stdout.write('\x1Bc');
}

/**
 * Format percentage with color coding
 */
function formatPercentage(value: number, good: number, bad: number): string {
  const formatted = value.toFixed(1) + '%';
  if (value >= good) {
    return `${colors.green}${formatted}${colors.reset}`;
  } else if (value >= bad) {
    return `${colors.yellow}${formatted}${colors.reset}`;
  } else {
    return `${colors.red}${formatted}${colors.reset}`;
  }
}

/**
 * Format number with color coding
 */
function formatNumber(value: number, good: number, bad: number): string {
  if (value <= good) {
    return `${colors.green}${value}${colors.reset}`;
  } else if (value <= bad) {
    return `${colors.yellow}${value}${colors.reset}`;
  } else {
    return `${colors.red}${value}${colors.reset}`;
  }
}

/**
 * Display dashboard
 */
async function displayDashboard() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Missing SUPABASE_URL or SUPABASE_ANON_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  clearScreen();

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║         DEPLOYMENT MONITORING DASHBOARD                     ║');
  console.log('║         Task 7.2: Story Completion & Image Persistence       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log();
  console.log(`${colors.dim}Last updated: ${new Date().toLocaleString()}${colors.reset}`);
  console.log(`${colors.dim}Refresh interval: ${REFRESH_INTERVAL / 1000}s${colors.reset}`);
  console.log();

  // ============================================================
  // SECTION 1: Upload Success Metrics (Last Hour)
  // ============================================================

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`${colors.bright}IMAGE UPLOAD METRICS (Last 1 Hour)${colors.reset}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log();

  try {
    const { data, error } = await supabase
      .from('game_sessions')
      .select('image_upload_status, image_upload_attempts, image_upload_error')
      .not('generated_image_url', 'is', null)
      .gte('created_at', new Date(Date.now() - 3600000).toISOString());

    if (error) {
      console.log(`${colors.red}Error fetching upload metrics: ${error.message}${colors.reset}`);
    } else if (!data || data.length === 0) {
      console.log(`${colors.yellow}No image generations in the last hour${colors.reset}`);
    } else {
      const total = data.length;
      const uploaded = data.filter((s) => s.image_upload_status === 'uploaded').length;
      const failed = data.filter((s) => s.image_upload_status === 'failed').length;
      const pending = data.filter((s) => s.image_upload_status === 'pending').length;
      const successRate = total > 0 ? (uploaded / total) * 100 : 0;

      const avgAttempts =
        data.reduce((sum, s) => sum + (s.image_upload_attempts || 0), 0) / total;

      console.log(`Total Uploads:     ${total}`);
      console.log(
        `Success Rate:      ${formatPercentage(successRate, 95, 80)} (Target: >95%)`
      );
      console.log(`  ✓ Uploaded:      ${colors.green}${uploaded}${colors.reset}`);
      console.log(`  ⚠ Failed:        ${failed > 0 ? colors.red : colors.green}${failed}${colors.reset}`);
      console.log(`  ⏳ Pending:       ${colors.yellow}${pending}${colors.reset}`);
      console.log(`Avg Attempts:      ${avgAttempts.toFixed(2)}`);

      // Show top errors if any failures
      if (failed > 0) {
        const errors = data
          .filter((s) => s.image_upload_error)
          .reduce((acc: Record<string, number>, s) => {
            const err = s.image_upload_error || 'Unknown';
            acc[err] = (acc[err] || 0) + 1;
            return acc;
          }, {});

        console.log();
        console.log(`${colors.red}Top Errors:${colors.reset}`);
        Object.entries(errors)
          .sort(([, a], [, b]) => (b as number) - (a as number))
          .slice(0, 3)
          .forEach(([err, count]) => {
            console.log(`  ${colors.red}•${colors.reset} ${err}: ${count}`);
          });
      }
    }
  } catch (error: any) {
    console.log(`${colors.red}Exception: ${error.message}${colors.reset}`);
  }

  console.log();

  // ============================================================
  // SECTION 2: Story Completion Metrics
  // ============================================================

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`${colors.bright}STORY COMPLETION METRICS (Last 1 Hour)${colors.reset}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log();

  try {
    const { data, error } = await supabase
      .from('game_sessions')
      .select('id, current_round, completed_at')
      .gte('created_at', new Date(Date.now() - 3600000).toISOString());

    if (error) {
      console.log(`${colors.red}Error fetching completion metrics: ${error.message}${colors.reset}`);
    } else if (!data || data.length === 0) {
      console.log(`${colors.yellow}No stories created in the last hour${colors.reset}`);
    } else {
      const total = data.length;
      const completed = data.filter((s) => s.completed_at !== null).length;
      const completionRate = total > 0 ? (completed / total) * 100 : 0;

      // Round distribution
      const roundDist = [0, 0, 0, 0, 0, 0]; // 0-5 rounds
      data.forEach((s) => {
        const round = s.current_round || 1;
        roundDist[Math.min(round, 5)]++;
      });

      console.log(`Total Stories:     ${total}`);
      console.log(
        `Completion Rate:   ${formatPercentage(completionRate, 70, 50)} (Target: >70%)`
      );
      console.log(`  ✓ Completed:     ${colors.green}${completed}${colors.reset}`);
      console.log(`  ⏳ In Progress:   ${colors.yellow}${total - completed}${colors.reset}`);
      console.log();
      console.log('Round Distribution:');
      for (let i = 1; i <= 5; i++) {
        const count = roundDist[i];
        const bar = '█'.repeat(Math.floor((count / total) * 30));
        console.log(`  Round ${i}: ${bar} ${count}`);
      }
    }
  } catch (error: any) {
    console.log(`${colors.red}Exception: ${error.message}${colors.reset}`);
  }

  console.log();

  // ============================================================
  // SECTION 3: Error Rate
  // ============================================================

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`${colors.bright}ERROR MONITORING${colors.reset}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log();

  try {
    const { data, error } = await supabase
      .from('game_sessions')
      .select('image_upload_status')
      .gte('created_at', new Date(Date.now() - 3600000).toISOString());

    if (error) {
      console.log(`${colors.red}Error fetching error rate: ${error.message}${colors.reset}`);
    } else {
      const total = data?.length || 0;
      const errors = data?.filter((s) => s.image_upload_status === 'failed').length || 0;
      const errorRate = total > 0 ? (errors / total) * 100 : 0;

      console.log(
        `Error Rate:        ${formatPercentage(errorRate, 5, 10)} (Target: <5%)`
      );
      console.log(`Total Operations:  ${total}`);
      console.log(`Failed Operations: ${formatNumber(errors, 5, 10)}`);

      // Alert if threshold exceeded
      if (errorRate > 10) {
        console.log();
        console.log(`${colors.bgRed}                                                           ${colors.reset}`);
        console.log(`${colors.bgRed}  ⚠️  CRITICAL: Error rate > 10% - CONSIDER ROLLBACK     ${colors.reset}`);
        console.log(`${colors.bgRed}                                                           ${colors.reset}`);
      } else if (errorRate > 5) {
        console.log();
        console.log(`${colors.bgYellow}                                                           ${colors.reset}`);
        console.log(`${colors.bgYellow}  ⚠️  WARNING: Error rate > 5% - INVESTIGATE IMMEDIATELY ${colors.reset}`);
        console.log(`${colors.bgYellow}                                                           ${colors.reset}`);
      }
    }
  } catch (error: any) {
    console.log(`${colors.red}Exception: ${error.message}${colors.reset}`);
  }

  console.log();

  // ============================================================
  // SECTION 4: Storage Usage
  // ============================================================

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`${colors.bright}STORAGE MONITORING${colors.reset}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log();

  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();

    if (error) {
      console.log(`${colors.red}Error fetching storage info: ${error.message}${colors.reset}`);
    } else {
      const storyBucket = buckets?.find((b) => b.id === 'story-images');
      if (storyBucket) {
        console.log(`Bucket Name:       story-images`);
        console.log(`Status:            ${colors.green}Active${colors.reset}`);
        console.log(`Type:              ${storyBucket.public ? 'Public' : 'Private'}`);
        console.log();
        console.log(`${colors.dim}Note: Check Supabase dashboard for detailed storage metrics${colors.reset}`);
      } else {
        console.log(`${colors.red}story-images bucket not found${colors.reset}`);
      }
    }
  } catch (error: any) {
    console.log(`${colors.red}Exception: ${error.message}${colors.reset}`);
  }

  console.log();

  // ============================================================
  // SECTION 5: Recommendations
  // ============================================================

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`${colors.bright}RECOMMENDATIONS${colors.reset}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log();

  console.log(`${colors.green}✓${colors.reset} Continue monitoring every ${REFRESH_INTERVAL / 60000} minutes`);
  console.log(`${colors.green}✓${colors.reset} Check Sentry dashboard for runtime errors`);
  console.log(`${colors.green}✓${colors.reset} Review user feedback in app stores`);
  console.log(`${colors.green}✓${colors.reset} Monitor Supabase logs for anomalies`);
  console.log();
  console.log(`${colors.dim}Press Ctrl+C to stop monitoring${colors.reset}`);
  console.log();
}

/**
 * Main monitoring loop
 */
async function monitorDeployment() {
  console.log('Starting deployment monitoring...');
  console.log(`Refresh interval: ${REFRESH_INTERVAL / 1000} seconds`);
  console.log();

  // Display dashboard immediately
  await displayDashboard();

  // Set up interval for updates
  setInterval(async () => {
    try {
      await displayDashboard();
    } catch (error: any) {
      console.error('Error updating dashboard:', error.message);
    }
  }, REFRESH_INTERVAL);
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log();
  console.log();
  console.log('Monitoring stopped by user');
  process.exit(0);
});

// Start monitoring
monitorDeployment().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
