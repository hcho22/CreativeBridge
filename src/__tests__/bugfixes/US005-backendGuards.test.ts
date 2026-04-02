/**
 * US-005: Backend Guard — Reject Updates to Completed Sessions
 *
 * Validates that the Convex backend has existing safety guards:
 * - updateSession rejects mutations on completed sessions
 * - currentRound is capped at 5
 * - completeSession always sets currentRound to 5
 *
 * No changes needed — this story validates existing backend behavior
 * via source code verification.
 */

import * as fs from 'fs';
import * as path from 'path';

describe('US-005: Backend Guards for Completed Sessions', () => {
  const gameSessionsPath = path.resolve(
    __dirname,
    '../../../convex/gameSessions.ts',
  );
  let gameSessionsSource: string;

  beforeAll(() => {
    gameSessionsSource = fs.readFileSync(gameSessionsPath, 'utf-8');
  });

  // Test 1: updateSession rejects updates to completed sessions
  it('should reject updates to completed sessions with completedAt check', () => {
    // Verify the completedAt guard exists
    expect(gameSessionsSource).toContain('if (session.completedAt)');

    // Verify the error message
    expect(gameSessionsSource).toContain('Cannot update a completed session');

    // Verify the guard is in updateSession (not just anywhere)
    const updateSessionStart = gameSessionsSource.indexOf(
      'export const updateSession',
    );
    expect(updateSessionStart).toBeGreaterThan(-1);

    // The guard should appear after updateSession definition but before completeSession
    const completeSessionStart = gameSessionsSource.indexOf(
      'export const completeSession',
    );
    expect(completeSessionStart).toBeGreaterThan(-1);

    const updateSessionBody = gameSessionsSource.substring(
      updateSessionStart,
      completeSessionStart,
    );
    expect(updateSessionBody).toContain('if (session.completedAt)');
    expect(updateSessionBody).toContain('Cannot update a completed session');
  });

  // Test 2: updateSession caps currentRound at 5
  it('should cap currentRound at 5 in updateSession', () => {
    // Verify the Math.min cap pattern
    expect(gameSessionsSource).toContain(
      'Math.min(Math.round(args.updates.currentRound), 5)',
    );

    // Verify it's within updateSession
    const updateSessionStart = gameSessionsSource.indexOf(
      'export const updateSession',
    );
    const completeSessionStart = gameSessionsSource.indexOf(
      'export const completeSession',
    );
    const updateSessionBody = gameSessionsSource.substring(
      updateSessionStart,
      completeSessionStart,
    );
    expect(updateSessionBody).toContain(
      'Math.min(Math.round(args.updates.currentRound), 5)',
    );
  });

  // Test 3: completeSession sets currentRound to 5
  it('should set currentRound to 5 in completeSession', () => {
    const completeSessionStart = gameSessionsSource.indexOf(
      'export const completeSession',
    );
    expect(completeSessionStart).toBeGreaterThan(-1);

    // Get the completeSession body (up to the next export or end of file)
    const afterComplete = gameSessionsSource.substring(completeSessionStart);
    const nextExportIndex = afterComplete.indexOf(
      '\nexport const ',
      1, // skip the first match (completeSession itself)
    );
    const completeSessionBody =
      nextExportIndex > -1
        ? afterComplete.substring(0, nextExportIndex)
        : afterComplete;

    // Verify currentRound: 5 is set
    expect(completeSessionBody).toContain('currentRound: 5');

    // Verify completedAt is set
    expect(completeSessionBody).toContain('completedAt:');

    // Verify it also rejects already-completed sessions
    expect(completeSessionBody).toContain('Session is already completed');
  });

  // Test 4: Ownership verification exists in both mutations
  it('should verify session ownership in both updateSession and completeSession', () => {
    // updateSession ownership check
    const updateSessionStart = gameSessionsSource.indexOf(
      'export const updateSession',
    );
    const completeSessionStart = gameSessionsSource.indexOf(
      'export const completeSession',
    );
    const updateSessionBody = gameSessionsSource.substring(
      updateSessionStart,
      completeSessionStart,
    );
    expect(updateSessionBody).toContain(
      'Not authorized to update this session',
    );

    // completeSession ownership check
    const afterComplete = gameSessionsSource.substring(completeSessionStart);
    expect(afterComplete).toContain('Not authorized to complete this session');
  });
});
