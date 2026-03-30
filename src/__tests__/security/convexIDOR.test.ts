/**
 * IDOR Validation Tests for Convex Queries
 *
 * Verifies that all Convex queries that previously accepted clerkUserId
 * as a client argument now derive it from ctx.auth.getUserIdentity().
 *
 * @implements US-002: S-2.1, S-2.2, S-2.3
 */

import * as fs from 'fs';
import * as path from 'path';

const CONVEX_DIR = path.resolve(__dirname, '../../../convex');

function readConvexFile(filename: string): string {
  return fs.readFileSync(path.join(CONVEX_DIR, filename), 'utf-8');
}

describe('Convex IDOR Validation (US-002 S-2.1)', () => {
  describe('gameSessions.ts', () => {
    let source: string;

    beforeAll(() => {
      source = readConvexFile('gameSessions.ts');
    });

    test('getActiveSession does not accept clerkUserId as an arg', () => {
      // Extract the getActiveSession function block
      const match = source.match(
        /export const getActiveSession = query\(\{[\s\S]*?args:\s*\{([^}]*)\}/,
      );
      expect(match).not.toBeNull();
      expect(match![1]).not.toContain('clerkUserId');
    });

    test('getActiveSession derives user from auth context', () => {
      const fnBlock = extractFunctionBlock(source, 'getActiveSession');
      expect(fnBlock).toContain('getClerkUserId(ctx)');
    });

    test('getSession verifies session ownership', () => {
      const fnBlock = extractFunctionBlock(source, 'getSession');
      expect(fnBlock).toContain('getClerkUserId(ctx)');
      expect(fnBlock).toMatch(
        /clerkUserId\s*!==\s*clerkUserId|session\.clerkUserId\s*!==\s*clerkUserId/,
      );
    });

    test('getUserSessions does not accept clerkUserId as an arg', () => {
      const match = source.match(
        /export const getUserSessions = query\(\{[\s\S]*?args:\s*\{([^}]*)\}/,
      );
      expect(match).not.toBeNull();
      expect(match![1]).not.toContain('clerkUserId');
    });

    test('searchUserStories does not accept clerkUserId as an arg', () => {
      const match = source.match(
        /export const searchUserStories = query\(\{[\s\S]*?args:\s*\{([^}]*)\}/,
      );
      expect(match).not.toBeNull();
      expect(match![1]).not.toContain('clerkUserId');
    });

    test('getUserStoriesWithImages does not accept clerkUserId as an arg', () => {
      const match = source.match(
        /export const getUserStoriesWithImages = query\(\{[\s\S]*?args:\s*\{([^}]*)\}/,
      );
      expect(match).not.toBeNull();
      expect(match![1]).not.toContain('clerkUserId');
    });

    test('getImportableStories does not accept clerkUserId as an arg', () => {
      const match = source.match(
        /export const getImportableStories = query\(\{[\s\S]*?args:\s*\{([^}]*)\}/,
      );
      expect(match).not.toBeNull();
      expect(match![1]).not.toContain('clerkUserId');
    });

    test('getStoryLibrary does not accept clerkUserId as an arg', () => {
      const match = source.match(
        /export const getStoryLibrary = query\(\{[\s\S]*?args:\s*\{([^}]*)\}/,
      );
      expect(match).not.toBeNull();
      expect(match![1]).not.toContain('clerkUserId');
    });
  });

  describe('imageGeneration.ts', () => {
    let source: string;

    beforeAll(() => {
      source = readConvexFile('imageGeneration.ts');
    });

    test('getUserImageGenerationEvents does not accept clerkUserId as an arg', () => {
      const match = source.match(
        /export const getUserImageGenerationEvents = query\(\{[\s\S]*?args:\s*\{([^}]*)\}/,
      );
      expect(match).not.toBeNull();
      expect(match![1]).not.toContain('clerkUserId');
    });

    test('getImageGenerationEvent verifies ownership', () => {
      const fnBlock = extractFunctionBlock(source, 'getImageGenerationEvent');
      expect(fnBlock).toContain('getClerkUserId(ctx)');
      expect(fnBlock).toMatch(/Not authorized/);
    });
  });

  describe('userProfiles.ts', () => {
    test('getProfileByClerkId does not accept clerkUserId as an arg', () => {
      const source = readConvexFile('userProfiles.ts');
      const match = source.match(
        /export const getProfileByClerkId = query\(\{[\s\S]*?args:\s*\{([^}]*)\}/,
      );
      expect(match).not.toBeNull();
      expect(match![1]).not.toContain('clerkUserId');
    });
  });
});

/**
 * Extract a function block from source code by its export name.
 */
function extractFunctionBlock(source: string, fnName: string): string {
  const pattern = new RegExp(
    `export const ${fnName} = (?:query|mutation|action)\\(\\{[\\s\\S]*?^\\}\\);`,
    'm',
  );
  const match = source.match(pattern);
  return match ? match[0] : '';
}
