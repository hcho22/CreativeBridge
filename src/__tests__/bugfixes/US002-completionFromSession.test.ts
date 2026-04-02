/**
 * US-002: Check Completion from Session State, Not React State
 *
 * Validates that the game completion check uses updatedSession.isCompleted
 * (set by the session manager) rather than comparing React state
 * currentRound >= MAX_ROUNDS.
 *
 * Bug: HomeScreen.tsx checked `if (currentRound >= MAX_ROUNDS)` which could
 * trigger prematurely because React state drifts from session state.
 *
 * Fix: Changed to `if (updatedSession.isCompleted)` so the game ends only
 * when the session manager has confirmed both players completed round 5.
 */

import * as fs from 'fs';
import * as path from 'path';
import { storySessionManager } from '../../services/storySessionManager';
import type { StorySession } from '../../services/storySessionManager';
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
    _id: 'session-us002',
    _creationTime: Date.now(),
    userId: 'user_test002',
    clerkUserId: 'user_test002',
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

describe('US-002: Completion Check Uses Session State, Not React State', () => {
  // ---------- Source Code Verification ----------

  describe('Source code verification', () => {
    const homeScreenPath = path.resolve(
      __dirname,
      '../../screens/HomeScreen.tsx',
    );
    let homeScreenSource: string;

    beforeAll(() => {
      homeScreenSource = fs.readFileSync(homeScreenPath, 'utf-8');
    });

    it('should use updatedSession.isCompleted for the completion check', () => {
      // The fix: completion check uses session manager state
      expect(homeScreenSource).toContain('updatedSession.isCompleted');
    });

    it('should NOT use currentRound >= MAX_ROUNDS as a completion trigger', () => {
      // The bug pattern: checking React state for completion
      const bugPattern = /if\s*\(\s*currentRound\s*>=\s*MAX_ROUNDS\s*\)/;
      expect(homeScreenSource).not.toMatch(bugPattern);
    });

    it('should have the completion check in the correct code region after addContribution', () => {
      // Verify the pattern exists in the context of handling AI response
      const completionCheckIndex = homeScreenSource.indexOf(
        'updatedSession.isCompleted',
      );
      expect(completionCheckIndex).toBeGreaterThan(-1);

      // Should be near the "Check if game should end" comment
      const regionBefore = homeScreenSource.substring(
        Math.max(0, completionCheckIndex - 200),
        completionCheckIndex,
      );
      expect(regionBefore).toContain('Check if game should end');
    });
  });

  // ---------- Session Manager Behavior Verification ----------

  describe('Session manager isCompleted behavior', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      (isConvexReady as jest.Mock).mockReturnValue(true);
      (getConvexClient as jest.Mock).mockReturnValue(mockConvexClient);
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({}));
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
      storySessionManager.clearCache();
    });

    it('should NOT set isCompleted when user submits 5th input before AI responds', async () => {
      // Session at round 4, user about to submit 5th contribution
      const convexSession = mockConvexSession({
        currentRound: 4,
        storyContent: 'Story so far...',
        wordsWritten: 80,
        sentencesCompleted: 8,
      });
      mockConvexClient.query.mockResolvedValueOnce(convexSession);
      mockConvexClient.mutation.mockResolvedValue(undefined);

      const session = await storySessionManager.getSession('session-us002');
      expect(session).not.toBeNull();

      // User submits 5th contribution
      const afterUser5 = await storySessionManager.addContribution(
        'session-us002',
        'user',
        'The hero reached the final challenge.',
        session!,
      );

      // isCompleted must still be false — AI hasn't responded yet
      expect(afterUser5?.isCompleted).toBe(false);
      expect(afterUser5?.current_round).toBe(4); // User contributions don't increment round
    });

    it('should set isCompleted when a pair completes the 5th round', async () => {
      // Session at round 5 — one complete pair away from completion.
      // A round = one pair of contributions. The round advances when the pair completes.
      const convexSession = mockConvexSession({
        currentRound: 5,
        storyContent: 'Story almost done...',
        wordsWritten: 90,
        sentencesCompleted: 9,
      });
      mockConvexClient.query.mockResolvedValueOnce(convexSession);
      mockConvexClient.mutation.mockResolvedValue(undefined);

      const session = await storySessionManager.getSession('session-us002');
      expect(session).not.toBeNull();

      // User contributes — first half of pair, game NOT complete yet
      const afterUser = await storySessionManager.addContribution(
        'session-us002',
        'user',
        'The hero saved the day.',
        session!,
      );
      expect(afterUser?.isCompleted).toBe(false);

      // AI completes the pair → round 5→6, capped to 5, triggers completion
      const afterAI5 = await storySessionManager.addContribution(
        'session-us002',
        'ai',
        'And they all lived happily ever after. The end.',
        afterUser!,
      );

      // NOW isCompleted should be true
      expect(afterAI5?.isCompleted).toBe(true);
      expect(afterAI5?.current_round).toBe(5);
      expect(afterAI5?.completed_at).toBeDefined();
    });

    it('should NOT set isCompleted before MAX_ROUNDS even after a complete pair', async () => {
      // Session at round 2 — nowhere near completion
      const convexSession = mockConvexSession({
        currentRound: 2,
        storyContent: 'Early story...',
        wordsWritten: 30,
        sentencesCompleted: 4,
      });
      mockConvexClient.query.mockResolvedValueOnce(convexSession);
      mockConvexClient.mutation.mockResolvedValue(undefined);

      const session = await storySessionManager.getSession('session-us002');

      // Add a complete pair (user + AI)
      const afterUser = await storySessionManager.addContribution(
        'session-us002',
        'user',
        'The hero climbed the mountain.',
        session!,
      );
      const afterAI = await storySessionManager.addContribution(
        'session-us002',
        'ai',
        'The adventure continued into the mountains.',
        afterUser!,
      );

      expect(afterAI?.isCompleted).toBe(false);
      expect(afterAI?.current_round).toBe(3);
    });
  });
});
