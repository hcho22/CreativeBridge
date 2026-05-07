/**
 * US-006: Regression Test — Original Bug Cannot Recur
 *
 * Reproduces the original bug where the game ended prematurely because
 * HomeScreen.tsx checked `currentRound >= MAX_ROUNDS` (React state)
 * instead of `updatedSession.isCompleted` (session manager state).
 *
 * The root cause: React component state `currentRound` could drift from
 * the session manager's `current_round`, causing the game to end when the
 * first player entered round 6, or allowing a 6th contribution.
 *
 * These tests ensure the fix holds: the game ends only when the session
 * manager confirms both players have completed round 5.
 */

import * as fs from 'fs';
import * as path from 'path';
import { storySessionManager } from '../../services/storySessionManager';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock Convex client
const mockConvexClient = {
  mutation: jest.fn(),
  query: jest.fn(),
};

jest.mock('../../services/convex', () => ({
  getConvexClient: jest.fn(() => mockConvexClient),
  isConvexReady: jest.fn(() => true),
  api: {
    gameSessions: {
      createSession: 'gameSessions:createSession',
      getSession: 'gameSessions:getSession',
      getUserSessions: 'gameSessions:getUserSessions',
      updateSession: 'gameSessions:updateSession',
      updateStoryGeneratedImage: 'gameSessions:updateStoryGeneratedImage',
      updateImageUploadStatus: 'gameSessions:updateImageUploadStatus',
    },
    userProfiles: {
      completeGameSession: 'userProfiles:completeGameSession',
    },
  },
}));

const { isConvexReady, getConvexClient } = require('../../services/convex');

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock ChallengeService for completion reward calculations
jest.mock('../../services/challengeService', () => ({
  ChallengeService: {
    getInstance: jest.fn(() => ({
      calculateXPRewards: jest.fn(() => ({
        baseXP: 100,
        challengeXP: 50,
        completionXP: 100,
        timeBonus: 25,
      })),
      getTotalXP: jest.fn(() => 275),
    })),
  },
}));

jest.mock('../../services/supabase');

const MAX_ROUNDS = 5;

/**
 * Helper to create a mock Convex game session document.
 */
function mockConvexSession(overrides: Record<string, any> = {}) {
  return {
    _id: 'session-us006',
    _creationTime: Date.now(),
    userId: 'user_test006',
    clerkUserId: 'user_test006',
    gradeLevel: 'K-2',
    storyContent: '',
    wordsWritten: 0,
    sentencesCompleted: 0,
    challengesCompleted: 0,
    currentRound: 1,
    xpEarned: 0,
    finalScore: 0,
    completedAt: undefined,
    storySource: 'New',
    storyMetadata: {},
    generatedImageUrl: undefined,
    imageGenerationTimestamp: undefined,
    imageGenerationCost: undefined,
    imageUploadStatus: undefined,
    imageUploadAttempts: undefined,
    imageUploadError: undefined,
    ...overrides,
  };
}

describe('US-006: Regression — Game Ends Only After Both Players Complete Round 5', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isConvexReady as jest.Mock).mockReturnValue(true);
    (getConvexClient as jest.Mock).mockReturnValue(mockConvexClient);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({}));
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    storySessionManager.clearCache();
  });

  // ─── Test 1: BUG REPRO — game does NOT end when user is first to reach 5 inputs ───

  it('BUG REPRO — game does NOT end when user is first to reach 5 inputs', async () => {
    // Round progression: starts at 1, increments after each AI response.
    // Completion triggers when current_round exceeds MAX_ROUNDS (>5), then caps to 5.
    // This ensures the user gets exactly 5 inputs before the game ends.
    //
    // The original bug: HomeScreen checked React state `currentRound >= MAX_ROUNDS`
    // which could desync from the session. The fix uses `updatedSession.isCompleted`.

    const convexSession = mockConvexSession({ currentRound: 1 });
    mockConvexClient.query.mockResolvedValueOnce(convexSession);
    mockConvexClient.mutation.mockResolvedValue(undefined);

    let session = await storySessionManager.getSession('session-us006');
    expect(session).not.toBeNull();

    // Simulate 5 complete rounds: user submits → AI responds
    // Game completes when AI's 5th response pushes current_round past MAX_ROUNDS
    for (let round = 1; round <= 5; round++) {
      // User submits their contribution
      session = await storySessionManager.addContribution(
        'session-us006',
        'user',
        `User story part for round ${round}.`,
        session!,
      );

      // After user's input (before AI responds), game must NOT be complete.
      expect(session?.isCompleted).toBe(false);

      if (round < 5) {
        // AI responds, completing rounds 1-4 (pushes to rounds 2, 3, 4, 5)
        session = await storySessionManager.addContribution(
          'session-us006',
          'ai',
          `AI continuation for round ${round}.`,
          session!,
        );
        // Still not complete — current_round hasn't exceeded MAX_ROUNDS
        expect(session?.isCompleted).toBe(false);
      }
    }

    // After user's 5th input but before AI's 5th response:
    // isCompleted MUST be false — the AI hasn't pushed past round 5 yet
    expect(session?.isCompleted).toBe(false);
    expect(session?.current_round).toBe(5);

    // AI's 5th response pushes current_round from 5 to 6 (>5) → game complete, capped to 5
    session = await storySessionManager.addContribution(
      'session-us006',
      'ai',
      'And the adventure came to a triumphant end.',
      session!,
    );

    expect(session?.isCompleted).toBe(true);
    expect(session?.current_round).toBe(5);
    expect(session?.completed_at).toBeTruthy();
  });

  // ─── Test 2: BUG REPRO — game does NOT end based on stale React currentRound state ───

  it('BUG REPRO — game does NOT end based on stale React currentRound state', () => {
    // This test verifies the code fix at the source level:
    // The old bug was `if (currentRound >= MAX_ROUNDS)` — using React state.
    // The fix changed it to `if (updatedSession.isCompleted)` — using session state.

    const homeScreenPath = path.resolve(
      __dirname,
      '../../screens/HomeScreen.tsx',
    );
    const homeScreenSource = fs.readFileSync(homeScreenPath, 'utf-8');

    // The FIX pattern must exist: completion check uses session manager state
    expect(homeScreenSource).toContain('updatedSession.isCompleted');

    // The BUG pattern must NOT exist: completion check should not use React state
    const bugPattern = /if\s*\(\s*currentRound\s*>=\s*MAX_ROUNDS\s*\)/;
    expect(homeScreenSource).not.toMatch(bugPattern);

    // The round sync pattern must exist: React state is derived from session
    // (US-001 fix: setCurrentRound(updatedSession.current_round))
    expect(homeScreenSource).toContain(
      'setCurrentRound(updatedSession.current_round)',
    );

    // Verify that the stale independent round calculation is gone
    // Old bug: `const nextRound = currentRound + 1; setCurrentRound(nextRound)`
    const staleCalcPattern =
      /const\s+nextRound\s*=\s*currentRound\s*\+\s*1[\s\S]*?setCurrentRound\s*\(\s*nextRound\s*\)/;
    expect(homeScreenSource).not.toMatch(staleCalcPattern);
  });

  // ─── Test 3: User-starts-first mode — same completion behavior ───

  it('user-starts-first mode — game completes correctly when current_round exceeds MAX_ROUNDS', async () => {
    // In user-starts-first mode, the user contributes before the AI each round.
    // The completion behavior is identical: game ends only after an AI response
    // pushes current_round past MAX_ROUNDS (>5). User contributions never trigger completion.
    //
    // Round progression (starting at 1):
    //   After AI #1: round=2, After AI #2: round=3, ..., After AI #5: round=6→cap 5 → complete

    const convexSession = mockConvexSession({ currentRound: 1 });
    mockConvexClient.query.mockResolvedValueOnce(convexSession);
    mockConvexClient.mutation.mockResolvedValue(undefined);

    let session = await storySessionManager.getSession('session-us006');

    const completedFlags: boolean[] = [];

    // 5 user+AI pairs (user first each time)
    for (let round = 1; round <= 5; round++) {
      session = await storySessionManager.addContribution(
        'session-us006',
        'user',
        `User starts round ${round} with their input.`,
        session!,
      );
      // User contribution NEVER triggers completion
      completedFlags.push(session!.isCompleted);

      session = await storySessionManager.addContribution(
        'session-us006',
        'ai',
        `AI completes round ${round} with a continuation.`,
        session!,
      );
      completedFlags.push(session!.isCompleted);
    }

    // 10 flags total: 5 user + 5 AI
    // Completion triggers when round exceeds MAX_ROUNDS (>5).
    // AI #5 pushes round 5→6 (>5), triggers completion and caps to 5.
    expect(completedFlags).toEqual([
      false, // user round 1
      false, // ai round 1 → current_round = 2
      false, // user round 2
      false, // ai round 2 → current_round = 3
      false, // user round 3
      false, // ai round 3 → current_round = 4
      false, // user round 4
      false, // ai round 4 → current_round = 5 (5 > 5 is false, NOT complete yet)
      false, // user round 5
      true, // ai round 5 → current_round = 6, capped to 5 — GAME COMPLETE
    ]);

    // Verify final state
    expect(session?.current_round).toBe(5);
    expect(session?.isCompleted).toBe(true);
    expect(session?.completed_at).toBeTruthy();
  });

  // ─── Test 4: AI failure at round 5 does not complete the game ───

  it('AI failure at round 5 does not complete the game — retry succeeds', async () => {
    // Simulate: 4 complete rounds, then user submits 5th input
    const convexSession = mockConvexSession({
      currentRound: 5,
      storyContent: 'Story through 4 rounds...',
      wordsWritten: 80,
      sentencesCompleted: 8,
    });
    mockConvexClient.query.mockResolvedValueOnce(convexSession);
    mockConvexClient.mutation.mockResolvedValue(undefined);

    let session = await storySessionManager.getSession('session-us006');

    // User submits 5th contribution
    session = await storySessionManager.addContribution(
      'session-us006',
      'user',
      'The hero faced the final dragon.',
      session!,
    );

    // At this point, current_round is still 5 (user contributions don't increment)
    expect(session?.current_round).toBe(5);
    expect(session?.isCompleted).toBe(false);

    // AI generation FAILS — in real app, handleContinueStory catches the error
    // and the AI contribution is never added. The session state is unchanged.
    // (We simulate this by simply not calling addContribution for AI)

    // Verify the game is NOT complete after the failure
    expect(session?.isCompleted).toBe(false);
    expect(session?.current_round).toBe(5);

    // User retries → AI generation succeeds this time
    session = await storySessionManager.addContribution(
      'session-us006',
      'ai',
      'The dragon bowed and the kingdom was saved. The end.',
      session!,
    );

    // NOW the game should be complete
    expect(session?.isCompleted).toBe(true);
    expect(session?.current_round).toBe(5);
    expect(session?.completed_at).toBeTruthy();
  });

  // ─── Test 5: Round counter UI displays correctly through all 5 rounds ───

  describe('round counter UI integrity', () => {
    it('round counter uses currentRound/MAX_ROUNDS pattern and never shows Round 6/5', () => {
      const homeScreenPath = path.resolve(
        __dirname,
        '../../screens/HomeScreen.tsx',
      );
      const homeScreenSource = fs.readFileSync(homeScreenPath, 'utf-8');

      // Verify the round counter display pattern exists
      expect(homeScreenSource).toContain('Round {currentRound}/{MAX_ROUNDS}');

      // Verify MAX_ROUNDS is defined as 5
      const maxRoundsPattern = /const\s+MAX_ROUNDS\s*=\s*5/;
      expect(homeScreenSource).toMatch(maxRoundsPattern);

      // Verify currentRound is synced from session (US-001 fix),
      // which means it can never exceed 5 since session manager caps at MAX_ROUNDS
      expect(homeScreenSource).toContain(
        'setCurrentRound(updatedSession.current_round)',
      );
    });

    it('session manager guarantees current_round never exceeds 5 (preventing Round 6/5)', async () => {
      // This is the safety net: even if something goes wrong in the UI,
      // the session manager uses Math.min to cap at MAX_ROUNDS

      const convexSession = mockConvexSession({ currentRound: 5 });
      mockConvexClient.query.mockResolvedValueOnce(convexSession);
      mockConvexClient.mutation.mockResolvedValue(undefined);

      let session = await storySessionManager.getSession('session-us006');

      // Try to push past round 5 with multiple AI contributions
      for (let i = 0; i < 3; i++) {
        session = await storySessionManager.addContribution(
          'session-us006',
          'ai',
          `Extra AI contribution ${i + 1}.`,
          session!,
        );
        // current_round must NEVER exceed 5
        expect(session?.current_round).toBe(5);
        expect(session?.current_round).toBeLessThanOrEqual(MAX_ROUNDS);
      }

      // Simulate what the UI would display
      const displayedRound = `Round ${session!.current_round}/${MAX_ROUNDS}`;
      expect(displayedRound).toBe('Round 5/5');
      expect(displayedRound).not.toBe('Round 6/5');
    });

    it('round progresses correctly through all 5 rounds for display', async () => {
      const convexSession = mockConvexSession({ currentRound: 1 });
      mockConvexClient.query.mockResolvedValueOnce(convexSession);
      mockConvexClient.mutation.mockResolvedValue(undefined);

      let session = await storySessionManager.getSession('session-us006');
      const displayedRounds: string[] = [];

      // Track what "Round X/5" would show after each AI response
      for (let round = 1; round <= 5; round++) {
        // Before AI response, display shows current round
        displayedRounds.push(`Round ${session!.current_round}/${MAX_ROUNDS}`);

        session = await storySessionManager.addContribution(
          'session-us006',
          'user',
          `User round ${round}.`,
          session!,
        );

        session = await storySessionManager.addContribution(
          'session-us006',
          'ai',
          `AI round ${round}.`,
          session!,
        );
      }

      // Rounds displayed before each AI response: 1, 2, 3, 4, 5
      expect(displayedRounds).toEqual([
        'Round 1/5',
        'Round 2/5',
        'Round 3/5',
        'Round 4/5',
        'Round 5/5',
      ]);

      // No round exceeds MAX_ROUNDS
      displayedRounds.forEach(display => {
        const roundNum = parseInt(display.split(' ')[1].split('/')[0], 10);
        expect(roundNum).toBeLessThanOrEqual(MAX_ROUNDS);
        expect(roundNum).toBeGreaterThanOrEqual(1);
      });
    });
  });
});
