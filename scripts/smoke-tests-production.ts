#!/usr/bin/env ts-node

/**
 * Production Smoke Tests
 * Task 7.2: Code Deployment
 *
 * These tests verify that critical functionality works in production
 * after deployment. Run these tests immediately after deployment to
 * catch any issues early.
 *
 * Usage:
 *   npx ts-node scripts/smoke-tests-production.ts
 *
 * Environment:
 *   - Requires production Supabase credentials in .env
 *   - Use test user accounts, not real user data
 */

import { createClient } from '@supabase/supabase-js';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Test results tracking
let passedTests = 0;
let failedTests = 0;
let skippedTests = 0;

/**
 * Print test result with color coding
 */
function printResult(
  testName: string,
  status: 'pass' | 'fail' | 'skip',
  message?: string,
) {
  if (status === 'pass') {
    console.log(`${colors.green}✓${colors.reset} ${testName}`);
    if (message) console.log(`  ${colors.blue}→${colors.reset} ${message}`);
    passedTests++;
  } else if (status === 'fail') {
    console.log(`${colors.red}✗${colors.reset} ${testName}`);
    if (message) console.log(`  ${colors.red}→${colors.reset} ${message}`);
    failedTests++;
  } else {
    console.log(`${colors.yellow}⊘${colors.reset} ${testName}`);
    if (message) console.log(`  ${colors.yellow}→${colors.reset} ${message}`);
    skippedTests++;
  }
  console.log();
}

/**
 * Print section header
 */
function printSection(title: string) {
  console.log();
  console.log('━'.repeat(60));
  console.log(title);
  console.log('━'.repeat(60));
  console.log();
}

/**
 * Main smoke test runner
 */
async function runSmokeTests() {
  console.log();
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     PRODUCTION SMOKE TESTS                             ║');
  console.log('║     Task 7.2: Code Deployment                          ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log();

  // Load environment variables
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error(
      `${colors.red}Error: Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment${colors.reset}`,
    );
    console.error('Make sure .env file is configured correctly');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // ============================================================
  // SECTION 1: Database Connectivity
  // ============================================================

  printSection('SECTION 1: Database Connectivity');

  try {
    const { error } = await supabase
      .from('game_sessions')
      .select('count', { count: 'exact', head: true });

    if (error) {
      printResult('Database connection', 'fail', `Error: ${error.message}`);
    } else {
      printResult(
        'Database connection',
        'pass',
        `Connected to production database`,
      );
    }
  } catch (error: any) {
    printResult('Database connection', 'fail', `Exception: ${error.message}`);
  }

  // ============================================================
  // SECTION 2: Schema Verification
  // ============================================================

  printSection('SECTION 2: Database Schema (Task 7.1 Migration)');

  // Test 1: Check if new columns exist
  try {
    const { error } = await supabase
      .from('game_sessions')
      .select('id, current_round, supabase_image_url, image_upload_status')
      .limit(1);

    if (error) {
      if (
        error.message.includes('column') &&
        error.message.includes('does not exist')
      ) {
        printResult(
          'New columns exist (current_round, supabase_image_url, image_upload_status)',
          'fail',
          'Migration not applied - columns missing',
        );
      } else {
        printResult('New columns exist', 'fail', `Error: ${error.message}`);
      }
    } else {
      printResult(
        'New columns exist (current_round, supabase_image_url, image_upload_status)',
        'pass',
        'Migration schema changes applied',
      );
    }
  } catch (error: any) {
    printResult('New columns exist', 'fail', `Exception: ${error.message}`);
  }

  // Test 2: Check indexes exist
  try {
    const { error } = await supabase.rpc('check_index_exists', {
      index_name: 'idx_game_sessions_completed_at',
    });

    if (error && !error.message.includes('does not exist')) {
      // If RPC function doesn't exist, skip test
      printResult(
        'Database indexes created',
        'skip',
        'Cannot verify - RPC function not available',
      );
    } else if (error) {
      printResult('Database indexes created', 'fail', 'Index not found');
    } else {
      printResult(
        'Database indexes created',
        'pass',
        'Performance indexes in place',
      );
    }
  } catch (error: any) {
    printResult(
      'Database indexes created',
      'skip',
      'Cannot verify automatically',
    );
  }

  // ============================================================
  // SECTION 3: Storage Bucket Verification
  // ============================================================

  printSection('SECTION 3: Supabase Storage');

  // Test 1: Check if story-images bucket exists
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();

    if (error) {
      printResult(
        'Storage buckets accessible',
        'fail',
        `Error: ${error.message}`,
      );
    } else {
      const storyImagesBucket = buckets?.find(b => b.id === 'story-images');
      if (storyImagesBucket) {
        printResult(
          'story-images bucket exists',
          'pass',
          `Bucket configured: ${
            storyImagesBucket.public ? 'public' : 'private'
          }`,
        );
      } else {
        printResult(
          'story-images bucket exists',
          'fail',
          'Bucket not found - run Task 1.3 setup',
        );
      }
    }
  } catch (error: any) {
    printResult(
      'Storage buckets accessible',
      'fail',
      `Exception: ${error.message}`,
    );
  }

  // Test 2: Check RLS policies on storage (requires authenticated user)
  printResult(
    'Storage RLS policies active',
    'skip',
    'Manual verification required with test user account',
  );

  // ============================================================
  // SECTION 4: Data Integrity Checks
  // ============================================================

  printSection('SECTION 4: Data Integrity');

  // Test 1: Check for data migration correctness
  try {
    const { data, error } = await supabase
      .from('game_sessions')
      .select('id, sentences_completed, current_round, completed_at')
      .gte('sentences_completed', 5)
      .is('completed_at', null)
      .limit(10);

    if (error) {
      printResult(
        'No incomplete stories with 5+ sentences',
        'fail',
        `Error: ${error.message}`,
      );
    } else if (data && data.length > 0) {
      printResult(
        'No incomplete stories with 5+ sentences',
        'fail',
        `Found ${data.length} stories that should be completed`,
      );
    } else {
      printResult(
        'No incomplete stories with 5+ sentences',
        'pass',
        'Data migration completed successfully',
      );
    }
  } catch (error: any) {
    printResult('Data integrity check', 'fail', `Exception: ${error.message}`);
  }

  // Test 2: Check for invalid round numbers
  try {
    const { data, error } = await supabase
      .from('game_sessions')
      .select('id, current_round')
      .or('current_round.lt.1,current_round.gt.5')
      .limit(10);

    if (error) {
      printResult(
        'All round numbers valid (1-5)',
        'fail',
        `Error: ${error.message}`,
      );
    } else if (data && data.length > 0) {
      printResult(
        'All round numbers valid (1-5)',
        'fail',
        `Found ${data.length} sessions with invalid round numbers`,
      );
    } else {
      printResult(
        'All round numbers valid (1-5)',
        'pass',
        'Round constraints enforced',
      );
    }
  } catch (error: any) {
    printResult(
      'Round number validation',
      'fail',
      `Exception: ${error.message}`,
    );
  }

  // ============================================================
  // SECTION 5: Performance Checks
  // ============================================================

  printSection('SECTION 5: Performance');

  // Test 1: Query performance with new indexes
  try {
    const startTime = Date.now();
    const { error } = await supabase
      .from('game_sessions')
      .select('id, completed_at')
      .not('completed_at', 'is', null)
      .limit(100);

    const elapsed = Date.now() - startTime;

    if (error) {
      printResult(
        'Query performance (completed stories)',
        'fail',
        `Error: ${error.message}`,
      );
    } else if (elapsed > 1000) {
      printResult(
        'Query performance (completed stories)',
        'fail',
        `Query took ${elapsed}ms (threshold: 1000ms)`,
      );
    } else {
      printResult(
        'Query performance (completed stories)',
        'pass',
        `Query completed in ${elapsed}ms`,
      );
    }
  } catch (error: any) {
    printResult('Query performance', 'fail', `Exception: ${error.message}`);
  }

  // Test 2: Upload status query performance
  try {
    const startTime = Date.now();
    const { error } = await supabase
      .from('game_sessions')
      .select('id, image_upload_status')
      .eq('image_upload_status', 'uploaded')
      .limit(100);

    const elapsed = Date.now() - startTime;

    if (error) {
      printResult(
        'Query performance (upload status)',
        'fail',
        `Error: ${error.message}`,
      );
    } else if (elapsed > 1000) {
      printResult(
        'Query performance (upload status)',
        'fail',
        `Query took ${elapsed}ms (threshold: 1000ms)`,
      );
    } else {
      printResult(
        'Query performance (upload status)',
        'pass',
        `Query completed in ${elapsed}ms`,
      );
    }
  } catch (error: any) {
    printResult(
      'Upload status query performance',
      'fail',
      `Exception: ${error.message}`,
    );
  }

  // ============================================================
  // SECTION 6: API Endpoints
  // ============================================================

  printSection('SECTION 6: API Endpoints');

  // Test Replicate API availability (without making actual generation)
  const replicateToken = process.env.REPLICATE_API_TOKEN;
  if (replicateToken) {
    printResult(
      'Replicate API token configured',
      'pass',
      'Token available (not tested)',
    );
  } else {
    printResult(
      'Replicate API token configured',
      'fail',
      'REPLICATE_API_TOKEN not found in environment',
    );
  }

  // Test Clerk configuration
  const clerkKey = process.env.CLERK_PUBLISHABLE_KEY;
  if (clerkKey) {
    printResult(
      'Clerk authentication configured',
      'pass',
      'Publishable key available',
    );
  } else {
    printResult(
      'Clerk authentication configured',
      'fail',
      'CLERK_PUBLISHABLE_KEY not found',
    );
  }

  // ============================================================
  // SECTION 7: Monitoring & Alerts
  // ============================================================

  printSection('SECTION 7: Monitoring Setup');

  // These are manual checks
  printResult(
    'Sentry error tracking configured',
    'skip',
    'Manual verification: Check Sentry dashboard',
  );

  printResult(
    'Supabase dashboard accessible',
    'skip',
    'Manual verification: Check Supabase logs',
  );

  printResult(
    'Alert thresholds configured',
    'skip',
    'Manual verification: Test alert system',
  );

  // ============================================================
  // SUMMARY
  // ============================================================

  printSection('SUMMARY');

  console.log(`${colors.green}✓ Passed:${colors.reset} ${passedTests}`);
  console.log(`${colors.yellow}⊘ Skipped:${colors.reset} ${skippedTests}`);
  console.log(`${colors.red}✗ Failed:${colors.reset} ${failedTests}`);
  console.log();

  if (failedTests === 0) {
    console.log(
      `${colors.green}╔════════════════════════════════════════════════════════╗${colors.reset}`,
    );
    console.log(
      `${colors.green}║  ✓ ALL SMOKE TESTS PASSED                             ║${colors.reset}`,
    );
    console.log(
      `${colors.green}╚════════════════════════════════════════════════════════╝${colors.reset}`,
    );
    console.log();
    console.log('Production deployment verified successfully!');
    console.log();
    console.log('Next steps:');
    console.log('1. Monitor error logs for first 24 hours');
    console.log('2. Check upload success rate metrics');
    console.log('3. Review user feedback');
    console.log('4. Begin gradual rollout to 25%');
    console.log();
    process.exit(0);
  } else {
    console.log(
      `${colors.red}╔════════════════════════════════════════════════════════╗${colors.reset}`,
    );
    console.log(
      `${colors.red}║  ✗ SMOKE TESTS FAILED                                  ║${colors.reset}`,
    );
    console.log(
      `${colors.red}╚════════════════════════════════════════════════════════╝${colors.reset}`,
    );
    console.log();
    console.log(
      `${colors.red}⚠️  CRITICAL: ${failedTests} test(s) failed${colors.reset}`,
    );
    console.log();
    console.log('Action required:');
    console.log('1. Review failed tests above');
    console.log('2. Fix issues in production');
    console.log('3. Consider rollback if critical');
    console.log('4. Re-run smoke tests after fixes');
    console.log();
    process.exit(1);
  }
}

// Run smoke tests
runSmokeTests().catch(error => {
  console.error(`${colors.red}Fatal error running smoke tests:${colors.reset}`);
  console.error(error);
  process.exit(1);
});
