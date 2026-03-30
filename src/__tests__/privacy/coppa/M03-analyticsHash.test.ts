/**
 * M-03: Analytics Hash — Pseudonymous Identifier Tests
 *
 * Audit finding: The analytics service uses a deterministic hash (djb2a variant)
 * to anonymize user IDs. While this prevents direct identification, a deterministic
 * hash with a known salt is a persistent pseudonymous identifier that could be
 * re-identified with effort. Documents the risk level.
 *
 * @implements M-03
 */

import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '../../../../');

function readSourceFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(PROJECT_ROOT, relativePath), 'utf-8');
}

describe('M-03: Analytics Hash Pseudonymous Identifier', () => {
  let analyticsSource: string;

  beforeAll(() => {
    analyticsSource = readSourceFile('src/services/analyticsService.ts');
  });

  test('[M-03] hashUserId function uses a salt', () => {
    // Must define a salt constant
    expect(analyticsSource).toMatch(/ANALYTICS_HASH_SALT\s*=/);
    // The hash function must incorporate the salt
    expect(analyticsSource).toMatch(
      /`\$\{.*SALT.*\}.*\$\{.*\}`|SALT.*:.*rawUserId|salted/,
    );
  });

  test('[M-03] hashUserId output is prefixed (not raw userId)', () => {
    // Hash output should use a prefix like 'anon_' to distinguish from real IDs
    expect(analyticsSource).toMatch(/['"]anon_['"]\s*\+/);
    // The function must NOT return the raw userId
    expect(analyticsSource).toMatch(/function\s+hashUserId/);
    // Must return the transformed value, not the input
    expect(analyticsSource).toMatch(/return\s+['"]anon_/);
  });

  test('[M-03] hashUserId does not leak original userId in output', () => {
    // Extract just the hashUserId function to avoid matching other functions
    const hashFnMatch = analyticsSource.match(/function hashUserId[\s\S]*?^}/m);
    expect(hashFnMatch).not.toBeNull();
    const hashFn = hashFnMatch![0];
    // The return statement should not include rawUserId directly
    expect(hashFn).not.toMatch(/return\s+rawUserId/);
    // The return should use the hash/anon prefix, not the raw input
    expect(hashFn).toMatch(/return\s+['"]anon_/);
  });

  test('[M-03] Analytics documents that deterministic hash is a pseudonymous identifier', () => {
    // The code should document (via comment) that this is deterministic
    // and therefore a persistent pseudonymous identifier (COPPA consideration)
    expect(analyticsSource).toMatch(
      /[Dd]eterministic|[Pp]seudonymous|[Aa]nonymiz/,
    );
  });
});
