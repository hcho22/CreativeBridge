/**
 * M-02: Analytics Data Retention Policy Tests
 *
 * Audit finding: Analytics data should have defined retention periods
 * with automated cleanup to limit how long children's usage data is stored.
 *
 * Verifies convex/dataRetention.ts defines 90-day analytics cleanup,
 * convex/crons.ts registers the daily job, and batch processing is bounded.
 *
 * @implements M-02
 */

import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '../../../../');

function readSourceFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(PROJECT_ROOT, relativePath), 'utf-8');
}

describe('M-02: Analytics Data Retention', () => {
  let dataRetentionSource: string;
  let cronsSource: string;

  beforeAll(() => {
    dataRetentionSource = readSourceFile('convex/dataRetention.ts');
    cronsSource = readSourceFile('convex/crons.ts');
  });

  test('[M-02] dataRetention.ts defines 90-day analytics cleanup period', () => {
    // Must define a 90-day default for analytics retention
    expect(dataRetentionSource).toMatch(
      /DEFAULT_ANALYTICS_RETENTION_DAYS\s*=\s*90/,
    );
    // Must have an image generation events cleanup function
    expect(dataRetentionSource).toContain(
      'cleanupExpiredImageGenerationEvents',
    );
  });

  test('[M-02] crons.ts registers daily data retention cleanup job', () => {
    // The cron must reference the data retention cleanup
    expect(cronsSource).toContain('dataRetention.runDailyRetentionCleanup');
    // It must be a daily job
    expect(cronsSource).toMatch(/crons\.daily\s*\(\s*['"]data retention/);
  });

  test('[M-02] dataRetention.ts uses BATCH_SIZE to bound processing', () => {
    // Must define a BATCH_SIZE constant to stay within Convex mutation time limits
    expect(dataRetentionSource).toMatch(/const BATCH_SIZE\s*=\s*\d+/);
    // Must use BATCH_SIZE in the slice/take operations
    expect(dataRetentionSource).toMatch(/\.slice\(0,\s*BATCH_SIZE\)/);
  });
});
