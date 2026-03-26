/**
 * Session Completion Guard Tests (US-004 R-4.4)
 *
 * Tests that updateSession cannot bypass completeSession:
 * - updateSession rejects xpEarned field
 * - updateSession rejects finalScore field
 * - updateSession rejects completedAt field
 * - completeSession properly guards already-completed sessions
 *
 * Note: These are code-structure tests that verify the Convex schema/validator
 * definitions match our security requirements.
 */

import * as fs from 'fs';
import * as path from 'path';

describe('Session Completion Guard Tests (R-4.4)', () => {
  const convexDir = path.join(__dirname, '..', '..', '..', 'convex');
  let gameSessionsCode: string;

  beforeAll(() => {
    gameSessionsCode = fs.readFileSync(
      path.join(convexDir, 'gameSessions.ts'),
      'utf-8',
    );
  });

  test('updateSession validator does not include xpEarned field', () => {
    // Extract the updateSession mutation's validator fields (non-comment lines only)
    const updateSessionMatch = gameSessionsCode.match(
      /export const updateSession = mutation\(\{[\s\S]*?updates: v\.object\(\{([\s\S]*?)\}\)/,
    );
    expect(updateSessionMatch).toBeTruthy();

    // Filter to only non-comment validator lines
    const validatorLines = updateSessionMatch![1]
      .split('\n')
      .filter(line => !line.trim().startsWith('//'));
    const validatorCode = validatorLines.join('\n');

    // xpEarned should NOT be in the validator (active field declarations)
    expect(validatorCode).not.toMatch(/xpEarned:\s*v\./);
  });

  test('updateSession validator does not include finalScore field', () => {
    const updateSessionMatch = gameSessionsCode.match(
      /export const updateSession = mutation\(\{[\s\S]*?updates: v\.object\(\{([\s\S]*?)\}\)/,
    );
    expect(updateSessionMatch).toBeTruthy();

    const validatorLines = updateSessionMatch![1]
      .split('\n')
      .filter(line => !line.trim().startsWith('//'));
    const validatorCode = validatorLines.join('\n');

    // finalScore should NOT be in the validator (active field declarations)
    expect(validatorCode).not.toMatch(/finalScore:\s*v\./);
  });

  test('updateSession rejects updates to completed sessions', () => {
    // Find the updateSession handler
    const handlerMatch = gameSessionsCode.match(
      /export const updateSession[\s\S]*?handler:[\s\S]*?(?=export const|$)/,
    );
    expect(handlerMatch).toBeTruthy();

    const handlerCode = handlerMatch![0];

    // Should check for completedAt guard
    expect(handlerCode).toContain('completedAt');
    expect(handlerCode).toMatch(/Cannot update a completed session/);
  });

  test('completeSession guards against double completion', () => {
    // Find the completeSession handler
    const handlerMatch = gameSessionsCode.match(
      /export const completeSession[\s\S]*?handler:[\s\S]*?(?=export const|$)/,
    );
    expect(handlerMatch).toBeTruthy();

    const handlerCode = handlerMatch![0];

    // Should check session.completedAt to prevent double completion
    expect(handlerCode).toContain('session.completedAt');
    expect(handlerCode).toMatch(/already completed/i);
  });

  test('schema includes lastCompletedSessionId on userProfiles', () => {
    const schemaCode = fs.readFileSync(
      path.join(convexDir, 'schema.ts'),
      'utf-8',
    );

    // Should include lastCompletedSessionId field
    expect(schemaCode).toContain('lastCompletedSessionId');
    expect(schemaCode).toMatch(
      /lastCompletedSessionId:\s*v\.optional\(v\.string\(\)\)/,
    );
  });

  test('schema includes by_clerk_user index on imageGenerationEvents', () => {
    const schemaCode = fs.readFileSync(
      path.join(convexDir, 'schema.ts'),
      'utf-8',
    );

    // Find imageGenerationEvents table definition
    const tableMatch = schemaCode.match(
      /imageGenerationEvents:[\s\S]*?(?=\n\s{2}\w|$)/,
    );
    expect(tableMatch).toBeTruthy();

    // Should include by_clerk_user index
    expect(tableMatch![0]).toContain("'by_clerk_user'");
    expect(tableMatch![0]).toContain("'clerkUserId'");
  });
});
