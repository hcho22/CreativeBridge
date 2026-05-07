/**
 * US-003: Validate Session Manager Round Increment Logic
 *
 * Validates that storySessionManager.addContribution() correctly:
 * - Increments rounds only after AI responses
 * - Caps rounds at MAX_ROUNDS (5)
 * - Marks completion only when both players finish round 5
 * - Ignores 'loaded' contributions for round counting
 *
 * No changes to session manager are needed — this story validates existing behavior.
 */

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

/**
 * Helper to create a mock Convex game session document.
 * Convex documents have _id, _creationTime, and camelCase fields.
 */
function mockConvexSession(overrides: Record<string, any> = {}) {
  return {
    _id: 'session-us003',
    _creationTime: Date.now(),
    userId: 'user_test003',
    clerkUserId: 'user_test003',
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

describe('US-003: Session Manager Round Increment Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isConvexReady as jest.Mock).mockReturnValue(true);
    (getConvexClient as jest.Mock).mockReturnValue(mockConvexClient);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({}));
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    storySessionManager.clearCache();
  });

  // Test 1: Round increments only after AI contribution
  it('should increment round only after AI contribution, not user contribution', async () => {
    const convexSession = mockConvexSession({ currentRound: 1 });
    mockConvexClient.query.mockResolvedValueOnce(convexSession);
    mockConvexClient.mutation.mockResolvedValue(undefined);

    // Fetch and add user contribution
    const session = await storySessionManager.getSession('session-us003');
    expect(session).not.toBeNull();
    expect(session!.current_round).toBe(1);

    const afterUser = await storySessionManager.addContribution(
      'session-us003',
      'user',
      'Once upon a time there was a brave knight.',
      session!,
    );

    // User contribution must NOT change current_round
    expect(afterUser?.current_round).toBe(1);

    // Now add AI contribution
    const afterAI = await storySessionManager.addContribution(
      'session-us003',
      'ai',
      'The knight ventured into the dark forest.',
      afterUser!,
    );

    // AI contribution should increment current_round to 2
    expect(afterAI?.current_round).toBe(2);
  });

  // Test 2: Round caps at MAX_ROUNDS
  it('should cap current_round at MAX_ROUNDS and never exceed 5', async () => {
    // Start at round 4, a complete pair brings it to 5
    const convexSession = mockConvexSession({
      currentRound: 4,
      storyContent: 'Story in progress...',
      wordsWritten: 80,
      sentencesCompleted: 8,
    });
    mockConvexClient.query.mockResolvedValueOnce(convexSession);
    mockConvexClient.mutation.mockResolvedValue(undefined);

    const session = await storySessionManager.getSession('session-us003');

    // Add a complete pair → round 4→5
    let updated = await storySessionManager.addContribution(
      'session-us003',
      'user',
      'User input.',
      session!,
    );
    updated = await storySessionManager.addContribution(
      'session-us003',
      'ai',
      'The story concludes here.',
      updated!,
    );
    expect(updated?.current_round).toBe(5);

    // Another pair should cap at 5 (triggers completion but round stays at 5)
    updated = await storySessionManager.addContribution(
      'session-us003',
      'user',
      'Extra user input.',
      updated!,
    );
    updated = await storySessionManager.addContribution(
      'session-us003',
      'ai',
      'This should not push past round 5.',
      updated!,
    );
    expect(updated?.current_round).toBe(5); // Capped, not 6
  });

  // Test 3: isCompleted set when a pair completes at MAX_ROUNDS
  it('should set isCompleted and completed_at when a pair exceeds MAX_ROUNDS', async () => {
    // Session at round 5 — one complete pair away from completion.
    const convexSession = mockConvexSession({
      currentRound: 5,
      storyContent: 'Almost done...',
      wordsWritten: 90,
      sentencesCompleted: 9,
    });
    mockConvexClient.query.mockResolvedValueOnce(convexSession);
    mockConvexClient.mutation.mockResolvedValue(undefined);

    const session = await storySessionManager.getSession('session-us003');

    // Add user contribution (first half of pair)
    const afterUser = await storySessionManager.addContribution(
      'session-us003',
      'user',
      'The hero won.',
      session!,
    );
    expect(afterUser?.isCompleted).toBe(false);

    // Add AI contribution (completes the pair → round 5→6, capped to 5, completion triggers)
    const completed = await storySessionManager.addContribution(
      'session-us003',
      'ai',
      'And they lived happily ever after.',
      afterUser!,
    );

    expect(completed?.current_round).toBe(5); // Capped at MAX_ROUNDS
    expect(completed?.isCompleted).toBe(true);
    expect(completed?.completed_at).toBeTruthy();
    expect(new Date(completed!.completed_at!).getTime()).not.toBeNaN();
  });

  // Test 4: isCompleted NOT set before MAX_ROUNDS
  it('should NOT set isCompleted when round is below MAX_ROUNDS', async () => {
    const convexSession = mockConvexSession({
      currentRound: 3,
      storyContent: 'Mid-story...',
      wordsWritten: 60,
      sentencesCompleted: 6,
    });
    mockConvexClient.query.mockResolvedValueOnce(convexSession);
    mockConvexClient.mutation.mockResolvedValue(undefined);

    const session = await storySessionManager.getSession('session-us003');

    // Add a complete pair → round 3→4
    const afterUser = await storySessionManager.addContribution(
      'session-us003',
      'user',
      'The hero pressed on.',
      session!,
    );
    const updated = await storySessionManager.addContribution(
      'session-us003',
      'ai',
      'The adventure continued through the mountains.',
      afterUser!,
    );

    expect(updated?.current_round).toBe(4);
    expect(updated?.isCompleted).toBe(false);
    expect(updated?.completed_at).toBeUndefined();
  });

  // Test 5: Full 5-round game simulation
  it('should correctly track rounds through a full 5-round game with 10 contributions', async () => {
    const convexSession = mockConvexSession({ currentRound: 1 });
    mockConvexClient.query.mockResolvedValueOnce(convexSession);
    mockConvexClient.mutation.mockResolvedValue(undefined);

    let session = await storySessionManager.getSession('session-us003');
    expect(session).not.toBeNull();

    const roundAfterEachAI: number[] = [];
    const completedAfterEachAI: boolean[] = [];

    // Simulate 5 rounds: user → AI for each
    for (let round = 1; round <= 5; round++) {
      // User contribution
      session = await storySessionManager.addContribution(
        'session-us003',
        'user',
        `User contribution for round ${round}.`,
        session!,
      );
      // User contribution must not change round
      expect(session?.current_round).toBe(round);

      // AI contribution
      session = await storySessionManager.addContribution(
        'session-us003',
        'ai',
        `AI continuation for round ${round}.`,
        session!,
      );

      roundAfterEachAI.push(session!.current_round);
      completedAfterEachAI.push(session!.isCompleted);
    }

    // Rounds should increment after each AI response: 2, 3, 4, 5, 5
    // (round 5→6 is capped to 5 when completion triggers)
    expect(roundAfterEachAI).toEqual([2, 3, 4, 5, 5]);

    // Completion triggers when round exceeds MAX_ROUNDS (>5), not when it equals it.
    // AI #5 pushes round 5→6 (>5), triggering completion and capping to 5.
    expect(completedAfterEachAI).toEqual([false, false, false, false, true]);

    // Total contributions: 5 user + 5 AI = 10
    const activeContributions = session!.contributions.filter(
      (c: { type: string }) => c.type !== 'loaded',
    );
    expect(activeContributions).toHaveLength(10);
  });

  // Test 6: Loaded contributions do not affect round count
  it('should not change current_round when adding loaded contributions', async () => {
    const convexSession = mockConvexSession({
      currentRound: 2,
      storyContent: 'Existing story...',
      wordsWritten: 30,
      sentencesCompleted: 3,
    });
    mockConvexClient.query.mockResolvedValueOnce(convexSession);
    mockConvexClient.mutation.mockResolvedValue(undefined);

    const session = await storySessionManager.getSession('session-us003');
    expect(session!.current_round).toBe(2);

    // Add a 'loaded' contribution (pre-existing story text loaded into session)
    const afterLoaded = await storySessionManager.addContribution(
      'session-us003',
      'loaded' as any, // 'loaded' is not 'user' or 'ai'
      'Previously written story content that was loaded.',
      session!,
    );

    // current_round must remain unchanged — only 'ai' increments it
    expect(afterLoaded?.current_round).toBe(2);
    expect(afterLoaded?.isCompleted).toBe(false);
  });
});
