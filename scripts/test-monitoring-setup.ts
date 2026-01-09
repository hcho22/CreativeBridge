#!/usr/bin/env ts-node

/**
 * Monitoring Setup Test Script
 * Task 7.3: Monitoring Setup
 *
 * Validates that all monitoring components are configured correctly:
 * - SQL analytics queries
 * - Alert rules configuration
 * - Dashboard configuration
 * - Monitoring service integration
 * - Supabase connectivity
 *
 * Usage:
 *   npx ts-node scripts/test-monitoring-setup.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: string;
}

const results: TestResult[] = [];

/**
 * Log test result
 */
function logTest(result: TestResult) {
  const icon = result.passed ? '✓' : '✗';
  const color = result.passed ? colors.green : colors.red;

  console.log(
    `${color}${icon}${colors.reset} ${result.name}: ${result.message}`,
  );
  if (result.details) {
    console.log(`  ${colors.cyan}→${colors.reset} ${result.details}`);
  }

  results.push(result);
}

/**
 * Test 1: Verify SQL Analytics Queries File
 */
function testAnalyticsQueries(): TestResult {
  const filePath = path.join(
    __dirname,
    '../sql/analytics_queries.sql',
  );

  if (!fs.existsSync(filePath)) {
    return {
      name: 'Analytics Queries File',
      passed: false,
      message: 'File not found',
      details: `Expected: ${filePath}`,
    };
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  // Verify essential queries are present
  const requiredQueries = [
    'Story Completion Rate',
    'Upload Success Rate',
    'Upload Retry Analysis',
    'Common Upload Error Patterns',
    'Storage Growth Tracking',
    'XP Refund Analysis',
    'Data Integrity Validation',
  ];

  const missingQueries = requiredQueries.filter(
    query => !content.includes(query),
  );

  if (missingQueries.length > 0) {
    return {
      name: 'Analytics Queries File',
      passed: false,
      message: 'Missing required queries',
      details: `Missing: ${missingQueries.join(', ')}`,
    };
  }

  // Count total queries
  const queryCount = (content.match(/-- Query \d+:/g) || []).length;

  return {
    name: 'Analytics Queries File',
    passed: true,
    message: 'All required queries present',
    details: `Total queries: ${queryCount}`,
  };
}

/**
 * Test 2: Verify Alert Rules Configuration
 */
function testAlertRules(): TestResult {
  const filePath = path.join(
    __dirname,
    '../config/monitoring/alert-rules.yml',
  );

  if (!fs.existsSync(filePath)) {
    return {
      name: 'Alert Rules Configuration',
      passed: false,
      message: 'File not found',
      details: `Expected: ${filePath}`,
    };
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  // Verify critical alerts are defined
  const requiredAlerts = [
    'storage_quota_90_percent',
    'upload_failure_rate_critical',
    'completion_rate_crashed',
    'xp_refund_spike_critical',
    'data_integrity_violations',
  ];

  const missingAlerts = requiredAlerts.filter(
    alert => !content.includes(alert),
  );

  if (missingAlerts.length > 0) {
    return {
      name: 'Alert Rules Configuration',
      passed: false,
      message: 'Missing critical alerts',
      details: `Missing: ${missingAlerts.join(', ')}`,
    };
  }

  // Count total alerts
  const criticalAlerts = (content.match(/- name: \w+/g) || []).length;

  return {
    name: 'Alert Rules Configuration',
    passed: true,
    message: 'All critical alerts configured',
    details: `Total alert rules: ${criticalAlerts}`,
  };
}

/**
 * Test 3: Verify Dashboard Configuration
 */
function testDashboardConfig(): TestResult {
  const filePath = path.join(
    __dirname,
    '../config/monitoring/dashboard-config.json',
  );

  if (!fs.existsSync(filePath)) {
    return {
      name: 'Dashboard Configuration',
      passed: false,
      message: 'File not found',
      details: `Expected: ${filePath}`,
    };
  }

  try {
    const config = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    if (!config.dashboards || !Array.isArray(config.dashboards)) {
      return {
        name: 'Dashboard Configuration',
        passed: false,
        message: 'Invalid configuration structure',
        details: 'Missing or invalid dashboards array',
      };
    }

    // Verify required dashboards
    const requiredDashboards = [
      'story-completion-overview',
      'storage-capacity-planning',
      'operational-health',
    ];

    const dashboardIds = config.dashboards.map((d: any) => d.id);
    const missingDashboards = requiredDashboards.filter(
      id => !dashboardIds.includes(id),
    );

    if (missingDashboards.length > 0) {
      return {
        name: 'Dashboard Configuration',
        passed: false,
        message: 'Missing required dashboards',
        details: `Missing: ${missingDashboards.join(', ')}`,
      };
    }

    return {
      name: 'Dashboard Configuration',
      passed: true,
      message: 'All dashboards configured',
      details: `Total dashboards: ${config.dashboards.length}`,
    };
  } catch (error: any) {
    return {
      name: 'Dashboard Configuration',
      passed: false,
      message: 'Invalid JSON',
      details: error.message,
    };
  }
}

/**
 * Test 4: Verify Monitoring Service
 */
function testMonitoringService(): TestResult {
  const filePath = path.join(
    __dirname,
    '../src/services/monitoringService.ts',
  );

  if (!fs.existsSync(filePath)) {
    return {
      name: 'Monitoring Service',
      passed: false,
      message: 'File not found',
      details: `Expected: ${filePath}`,
    };
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  // Verify essential methods are present
  const requiredMethods = [
    'getPerformanceMetrics',
    'checkSystemHealth',
    'evaluateThresholds',
    'generateMonitoringReport',
    'getRolloutAnalytics',
  ];

  const missingMethods = requiredMethods.filter(
    method => !content.includes(method),
  );

  if (missingMethods.length > 0) {
    return {
      name: 'Monitoring Service',
      passed: false,
      message: 'Missing required methods',
      details: `Missing: ${missingMethods.join(', ')}`,
    };
  }

  return {
    name: 'Monitoring Service',
    passed: true,
    message: 'All methods implemented',
    details: 'Service ready for production',
  };
}

/**
 * Test 5: Verify Deployment Monitoring Script
 */
function testDeploymentMonitor(): TestResult {
  const filePath = path.join(
    __dirname,
    '../scripts/monitor-deployment.ts',
  );

  if (!fs.existsSync(filePath)) {
    return {
      name: 'Deployment Monitor Script',
      passed: false,
      message: 'File not found',
      details: `Expected: ${filePath}`,
    };
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  // Verify essential sections are present
  const requiredSections = [
    'IMAGE UPLOAD METRICS',
    'STORY COMPLETION METRICS',
    'ERROR MONITORING',
    'STORAGE MONITORING',
  ];

  const missingSections = requiredSections.filter(
    section => !content.includes(section),
  );

  if (missingSections.length > 0) {
    return {
      name: 'Deployment Monitor Script',
      passed: false,
      message: 'Missing dashboard sections',
      details: `Missing: ${missingSections.join(', ')}`,
    };
  }

  return {
    name: 'Deployment Monitor Script',
    passed: true,
    message: 'All dashboard sections implemented',
    details: 'Real-time monitoring ready',
  };
}

/**
 * Test 6: Verify Supabase Connectivity
 */
async function testSupabaseConnectivity(): Promise<TestResult> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return {
      name: 'Supabase Connectivity',
      passed: false,
      message: 'Missing environment variables',
      details: 'Set SUPABASE_URL and SUPABASE_ANON_KEY',
    };
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Test database query
    const { data, error } = await supabase
      .from('game_sessions')
      .select('id')
      .limit(1);

    if (error) {
      return {
        name: 'Supabase Connectivity',
        passed: false,
        message: 'Database query failed',
        details: error.message,
      };
    }

    return {
      name: 'Supabase Connectivity',
      passed: true,
      message: 'Database connection successful',
      details: 'Can query game_sessions table',
    };
  } catch (error: any) {
    return {
      name: 'Supabase Connectivity',
      passed: false,
      message: 'Connection error',
      details: error.message,
    };
  }
}

/**
 * Test 7: Verify game_sessions Schema
 */
async function testDatabaseSchema(): Promise<TestResult> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return {
      name: 'Database Schema',
      passed: false,
      message: 'Cannot test - missing credentials',
      details: 'Supabase environment variables not set',
    };
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check for required columns
    const { data, error } = await supabase
      .from('game_sessions')
      .select(
        'id, current_round, supabase_image_url, image_upload_status, image_upload_attempts, image_upload_error',
      )
      .limit(1);

    if (error) {
      return {
        name: 'Database Schema',
        passed: false,
        message: 'Schema validation failed',
        details: error.message,
      };
    }

    // Verify columns exist (even if no data)
    const requiredColumns = [
      'current_round',
      'supabase_image_url',
      'image_upload_status',
      'image_upload_attempts',
      'image_upload_error',
    ];

    return {
      name: 'Database Schema',
      passed: true,
      message: 'All required columns present',
      details: `Verified: ${requiredColumns.join(', ')}`,
    };
  } catch (error: any) {
    return {
      name: 'Database Schema',
      passed: false,
      message: 'Schema check error',
      details: error.message,
    };
  }
}

/**
 * Test 8: Verify Monitoring Runbook
 */
function testMonitoringRunbook(): TestResult {
  const filePath = path.join(
    __dirname,
    '../.agent/System/monitoring-runbook.md',
  );

  if (!fs.existsSync(filePath)) {
    return {
      name: 'Monitoring Runbook',
      passed: false,
      message: 'File not found',
      details: `Expected: ${filePath}`,
    };
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  // Verify essential sections
  const requiredSections = [
    'Quick Reference',
    'Common Issues & Solutions',
    'Alert Response Procedures',
    'Diagnostic Queries',
    'Recovery Procedures',
    'Escalation Guidelines',
  ];

  const missingSections = requiredSections.filter(
    section => !content.includes(section),
  );

  if (missingSections.length > 0) {
    return {
      name: 'Monitoring Runbook',
      passed: false,
      message: 'Missing required sections',
      details: `Missing: ${missingSections.join(', ')}`,
    };
  }

  // Count documented issues
  const issueCount = (content.match(/### Issue \d+:/g) || []).length;

  return {
    name: 'Monitoring Runbook',
    passed: true,
    message: 'All sections documented',
    details: `Documented issues: ${issueCount}`,
  };
}

/**
 * Test 9: Verify Package.json Scripts
 */
function testPackageJsonScripts(): TestResult {
  const filePath = path.join(__dirname, '../package.json');

  if (!fs.existsSync(filePath)) {
    return {
      name: 'Package.json Scripts',
      passed: false,
      message: 'File not found',
    };
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    const requiredScripts = [
      'deploy:monitor',
      'deploy:smoke-tests',
      'deploy:pre-check',
    ];

    const missingScripts = requiredScripts.filter(
      script => !packageJson.scripts[script],
    );

    if (missingScripts.length > 0) {
      return {
        name: 'Package.json Scripts',
        passed: false,
        message: 'Missing monitoring scripts',
        details: `Missing: ${missingScripts.join(', ')}`,
      };
    }

    return {
      name: 'Package.json Scripts',
      passed: true,
      message: 'All monitoring scripts configured',
      details: 'Ready to run via npm',
    };
  } catch (error: any) {
    return {
      name: 'Package.json Scripts',
      passed: false,
      message: 'Invalid JSON',
      details: error.message,
    };
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║       MONITORING SETUP VALIDATION                           ║');
  console.log('║       Task 7.3: Monitoring Setup Testing                    ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log();

  console.log(`${colors.cyan}Running validation tests...${colors.reset}`);
  console.log();

  // Run synchronous tests
  logTest(testAnalyticsQueries());
  logTest(testAlertRules());
  logTest(testDashboardConfig());
  logTest(testMonitoringService());
  logTest(testDeploymentMonitor());
  logTest(testMonitoringRunbook());
  logTest(testPackageJsonScripts());

  // Run async tests
  console.log();
  console.log(`${colors.cyan}Running connectivity tests...${colors.reset}`);
  console.log();

  logTest(await testSupabaseConnectivity());
  logTest(await testDatabaseSchema());

  // Summary
  console.log();
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`${colors.bright}TEST SUMMARY${colors.reset}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log();

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log(`Total Tests:  ${total}`);
  console.log(
    `${colors.green}Passed:       ${passed}${colors.reset}`,
  );
  if (failed > 0) {
    console.log(`${colors.red}Failed:       ${failed}${colors.reset}`);
  }
  console.log();

  if (failed === 0) {
    console.log(`${colors.green}${colors.bright}✓ ALL TESTS PASSED${colors.reset}`);
    console.log();
    console.log('Monitoring setup is complete and ready for production!');
    console.log();
    console.log(`${colors.cyan}Next Steps:${colors.reset}`);
    console.log('1. Review alert thresholds in config/monitoring/alert-rules.yml');
    console.log('2. Test alert delivery with simulation mode');
    console.log('3. Set up notification channels (Slack, PagerDuty, Email)');
    console.log('4. Run: npm run deploy:monitor (to start real-time monitoring)');
    console.log('5. Bookmark dashboards in Grafana/Supabase');
    console.log();

    process.exit(0);
  } else {
    console.log(`${colors.red}${colors.bright}✗ SOME TESTS FAILED${colors.reset}`);
    console.log();
    console.log('Please fix the following issues:');
    console.log();

    results
      .filter(r => !r.passed)
      .forEach(result => {
        console.log(`${colors.red}•${colors.reset} ${result.name}`);
        console.log(`  Error: ${result.message}`);
        if (result.details) {
          console.log(`  Details: ${result.details}`);
        }
        console.log();
      });

    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});
