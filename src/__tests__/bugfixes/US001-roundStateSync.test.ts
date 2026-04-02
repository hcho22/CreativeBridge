/**
 * US-001: Sync Frontend Round State from Session Manager
 *
 * Validates that the frontend currentRound React state derives from
 * storySessionManager's session.current_round (source of truth),
 * not from an independent currentRound + 1 calculation.
 *
 * Bug: HomeScreen.tsx maintained an independent round counter that could
 * drift from the session manager, causing premature game completion.
 *
 * Fix: After each addContribution() call, setCurrentRound uses
 * updatedSession.current_round instead of computing currentRound + 1.
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

// Mock ChallengeService for completion calculations
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

/**
 * Helper to create a mock Convex game session document.
 */
function mockConvexSession(overrides: Record<string, any> = {}) {
  return {
    _id: 'session-us001',
    _creationTime: Date.now(),
    userId: 'user_test_us001',
    clerkUserId: 'user_test_us001',
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

describe('[US-001] Frontend currentRound syncs with session.current_round', () => {
  const homeScreenPath = path.resolve(
    __dirname,
    '../../screens/HomeScreen.tsx',
  );
  let homeScreenSource: string;

  beforeAll(() => {
    homeScreenSource = fs.readFileSync(homeScreenPath, 'utf-8');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (isConvexReady as jest.Mock).mockReturnValue(true);
    (getConvexClient as jest.Mock).mockReturnValue(mockConvexClient);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({}));
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    storySessionManager.clearCache();
  });

  // ---------- Source Code Verification ----------

  it('should use updatedSession.current_round for setCurrentRound, not currentRound + 1', () => {
    // The fix: setCurrentRound derives from session state
    expect(homeScreenSource).toContain(
      'setCurrentRound(updatedSession.current_round)',
    );

    // The bug pattern must not exist: independent round calculation
    const bugPattern = /const\s+nextRound\s*=\s*currentRound\s*\+\s*1/;
    expect(homeScreenSource).not.toMatch(bugPattern);
  });

  it('should not have independent round increment in handleContinueStory', () => {
    // Find the handleContinueStory function definition (line ~1655)
    const fnDefPattern = /const handleContinueStory\s*=\s*async/;
    const match = homeScreenSource.match(fnDefPattern);
    expect(match).not.toBeNull();

    // Extract a generous region covering the full function body (~300 lines)
    const fnStart = homeScreenSource.indexOf(match![0]);
    const regionAfter = homeScreenSource.substring(fnStart, fnStart + 15000);

    // Should NOT contain the independent increment pattern
    expect(regionAfter).not.toContain('currentRound + 1');

    // Should contain the session-derived pattern
    expect(regionAfter).toContain('updatedSession.current_round');
  });

  // ---------- Session Manager Round Sync ----------

  it('session.current_round increments only after AI contributions', async () => {
    // Set up: create session via mock
    mockConvexClient.mutation.mockResolvedValueOnce('session-us001');
    const convexDoc = mockConvexSession({ currentRound: 1 });
    mockConvexClient.query.mockResolvedValueOnce(convexDoc);

    const session = await storySessionManager.createSession(
      'user_test_us001',
      'K-2',
    );
    expect(session).not.toBeNull();
    expect(session!.current_round).toBe(1);

    // User contribution should NOT change current_round
    mockConvexClient.mutation.mockResolvedValue(undefined); // updateSession
    const afterUser = await storySessionManager.addContribution(
      session!.id,
      'user',
      'The hero found a map.',
      session!,
    );
    expect(afterUser).not.toBeNull();
    expect(afterUser!.current_round).toBe(1); // unchanged

    // AI contribution SHOULD increment current_round
    const afterAI = await storySessionManager.addContribution(
      afterUser!.id,
      'ai',
      'The map led to a hidden cave.',
      afterUser!,
    );
    expect(afterAI).not.toBeNull();
    expect(afterAI!.current_round).toBe(2); // incremented
  });

  it('setCurrentRound would receive updatedSession.current_round after each round', async () => {
    // Simulate a full 5-round game, verifying the value that setCurrentRound
    // would receive from updatedSession.current_round at each step
    mockConvexClient.mutation.mockResolvedValueOnce('session-us001');
    const convexDoc = mockConvexSession({ currentRound: 1 });
    mockConvexClient.query.mockResolvedValueOnce(convexDoc);
    mockConvexClient.mutation.mockResolvedValue(undefined);

    const session = await storySessionManager.createSession(
      'user_test_us001',
      'K-2',
    );
    let currentSession = session!;

    for (let round = 1; round <= 5; round++) {
      // User contribution
      const afterUser = await storySessionManager.addContribution(
        currentSession.id,
        'user',
        `User input round ${round}`,
        currentSession,
      );
      // current_round should stay at previous value (not increment for user)
      expect(afterUser!.current_round).toBe(round);

      // AI contribution
      const afterAI = await storySessionManager.addContribution(
        afterUser!.id,
        'ai',
        `AI response round ${round}`,
        afterUser!,
      );

      // This is the value that setCurrentRound receives in the fix
      const expectedRound = Math.min(round + 1, 5);
      expect(afterAI!.current_round).toBe(expectedRound);

      currentSession = afterAI!;
    }

    // After all 5 rounds, game should be complete
    expect(currentSession.isCompleted).toBe(true);
    expect(currentSession.current_round).toBe(5);
  });
});
