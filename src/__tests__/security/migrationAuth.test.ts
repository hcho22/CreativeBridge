/**
 * Migration Auth Validation Tests
 *
 * Verifies that migrateUserGameSessions verifies the caller's
 * clerkUserId matches args.clerkUserId.
 *
 * @implements US-002: S-2.9
 */

import * as fs from 'fs';
import * as path from 'path';

const CONVEX_DIR = path.resolve(__dirname, '../../../convex');

function readConvexFile(filename: string): string {
  return fs.readFileSync(path.join(CONVEX_DIR, filename), 'utf-8');
}

describe('Migration Auth Validation (US-002 S-2.9)', () => {
  test('migrateUserGameSessions verifies caller matches target user', () => {
    const source = readConvexFile('migration.ts');
    const fnBlock = extractFunctionBlock(source, 'migrateUserGameSessions');

    // Should derive caller's clerkUserId from auth
    expect(fnBlock).toContain('getClerkUserId(ctx)');

    // Should compare caller with args.clerkUserId
    expect(fnBlock).toMatch(/callerClerkUserId\s*!==\s*args\.clerkUserId/);

    // Should throw if mismatch
    expect(fnBlock).toMatch(
      /Not authorized to migrate sessions for another user/,
    );
  });
});

function extractFunctionBlock(source: string, fnName: string): string {
  const pattern = new RegExp(
    `export const ${fnName} = (?:query|mutation|action)\\(\\{[\\s\\S]*?^\\}\\);`,
    'm',
  );
  const match = source.match(pattern);
  return match ? match[0] : '';
}
