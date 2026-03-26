/**
 * createSignInToken Authorization Validation Tests
 *
 * Verifies that createSignInToken validates callers appropriately:
 * - Authenticated callers: email must match identity
 * - Unauthenticated callers (mid-sign-in): signInAttemptId required
 *
 * @implements US-002: S-2.5
 */

import * as fs from 'fs';
import * as path from 'path';

const CONVEX_DIR = path.resolve(__dirname, '../../../convex');

function readConvexFile(filename: string): string {
  return fs.readFileSync(path.join(CONVEX_DIR, filename), 'utf-8');
}

describe('createSignInToken Authorization (US-002 S-2.5)', () => {
  let authSource: string;
  let fnBlock: string;

  beforeAll(() => {
    authSource = readConvexFile('auth.ts');
    fnBlock = extractFunctionBlock(authSource, 'createSignInToken');
  });

  test('createSignInToken checks for authenticated user', () => {
    expect(fnBlock).toContain('getUserIdentity()');
  });

  test('createSignInToken validates email match when authenticated', () => {
    // Should compare identity email with args.email
    expect(fnBlock).toMatch(/identity\.email/);
    expect(fnBlock).toMatch(/args\.email/);
    expect(fnBlock).toMatch(/toLowerCase/);
  });

  test('createSignInToken rejects mismatched email', () => {
    expect(fnBlock).toMatch(/Not authorized to create sign-in token/);
  });

  test('createSignInToken requires signInAttemptId when unauthenticated', () => {
    expect(fnBlock).toMatch(/signInAttemptId/);
    expect(fnBlock).toMatch(
      /Sign-in attempt ID is required when calling without authentication/,
    );
  });

  test('createSignInToken accepts signInAttemptId as optional arg', () => {
    expect(fnBlock).toMatch(/signInAttemptId:\s*v\.optional\(v\.string\(\)\)/);
  });

  test('createSignInToken uses ctx instead of _ctx', () => {
    // The handler should use ctx (not _ctx) since it accesses auth
    expect(fnBlock).toMatch(/handler:\s*async\s*\(ctx,/);
    expect(fnBlock).not.toMatch(/handler:\s*async\s*\(_ctx,/);
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
