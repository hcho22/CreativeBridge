/**
 * Admin RBAC Validation Tests
 *
 * Verifies that admin-only analytics queries in imageGeneration.ts
 * require admin role via requireAdmin() helper.
 *
 * @implements US-002: S-2.4
 */

import * as fs from 'fs';
import * as path from 'path';

const CONVEX_DIR = path.resolve(__dirname, '../../../convex');

function readConvexFile(filename: string): string {
  return fs.readFileSync(path.join(CONVEX_DIR, filename), 'utf-8');
}

describe('Admin RBAC Validation (US-002 S-2.4)', () => {
  let imageGenSource: string;
  let authSource: string;

  beforeAll(() => {
    imageGenSource = readConvexFile('imageGeneration.ts');
    authSource = readConvexFile('auth.ts');
  });

  test('getImageGenerationAnalytics calls requireAdmin', () => {
    const fnBlock = extractFunctionBlock(
      imageGenSource,
      'getImageGenerationAnalytics',
    );
    expect(fnBlock).toContain('requireAdmin(ctx)');
  });

  test('getDailyImageGenerationStats calls requireAdmin', () => {
    const fnBlock = extractFunctionBlock(
      imageGenSource,
      'getDailyImageGenerationStats',
    );
    expect(fnBlock).toContain('requireAdmin(ctx)');
  });

  test('getRecentImageGenerationEvents calls requireAdmin', () => {
    const fnBlock = extractFunctionBlock(
      imageGenSource,
      'getRecentImageGenerationEvents',
    );
    expect(fnBlock).toContain('requireAdmin(ctx)');
  });

  test('requireAdmin helper checks role field on user profile', () => {
    // Verify the requireAdmin function exists and checks role
    expect(authSource).toContain('export async function requireAdmin');
    expect(authSource).toMatch(/profile\.role\s*!==\s*'admin'/);
    expect(authSource).toMatch(/Admin access required/);
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
