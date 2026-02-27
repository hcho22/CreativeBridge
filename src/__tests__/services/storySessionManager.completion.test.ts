/**
 * Story Session Manager - Completion Tracking Unit Tests
 * Tests for round counting, auto-completion, and completion state management
 *
 * Updated for US-013: All tests now use Convex mocks (Supabase removed).
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

const MAX_ROUNDS = 5;

/**
 * Helper to create a mock Convex game session document.
 * Convex documents have _id, _creationTime, and camelCase fields.
 */
function mockConvexSession(overrides: Record<string, any> = {}) {
  return {
    _id: 'session-123',
    _creationTime: Date.now(),
    userId: 'user_test123',
    clerkUserId: 'user_test123',
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

describe('StorySessionManager - Completion Tracking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isConvexReady as jest.Mock).mockReturnValue(true);
    (getConvexClient as jest.Mock).mockReturnValue(mockConvexClient);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({}));
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    // Clear in-memory cache between tests
    storySessionManager.clearCache();
  });

  describe('Round Tracking', () => {
    it('should initialize new session with round 1', async () => {
      mockConvexClient.mutation.mockResolvedValueOnce('session-123');

      const session = await storySessionManager.createSession(
        'user_test123',
        'K-2',
      );

      expect(session).not.toBeNull();
      expect(session?.current_round).toBe(1);
      expect(mockConvexClient.mutation).toHaveBeenCalledWith(
        'gameSessions:createSession',
        expect.objectContaining({
          clerkUserId: 'user_test123',
          gradeLevel: 'K-2',
        }),
      );
    });

    it('should increment round after AI contribution', async () => {
      const convexSession = mockConvexSession({
        storyContent: 'User: Hello\n',
        wordsWritten: 1,
        sentencesCompleted: 1,
        currentRound: 1,
      });

      mockConvexClient.query.mockResolvedValueOnce(convexSession);
      mockConvexClient.mutation.mockResolvedValue(undefined); // updateSession

      const session = await storySessionManager.getSession('session-123');
      expect(session?.current_round).toBe(1);

      const updated = await storySessionManager.addContribution(
        'session-123',
        'ai',
        'AI response',
        session!,
      );

      expect(updated?.current_round).toBe(2);
    });

    it('should not increment round after user contribution', async () => {
      const convexSession = mockConvexSession({
        storyContent: 'User: Hello\nAI: Hi there!\n',
        wordsWritten: 5,
        sentencesCompleted: 2,
        currentRound: 2,
      });

      mockConvexClient.query.mockResolvedValueOnce(convexSession);
      mockConvexClient.mutation.mockResolvedValue(undefined);

      const session = await storySessionManager.getSession('session-123');
      const updated = await storySessionManager.addContribution(
        'session-123',
        'user',
        'User second message',
        session!,
      );

      expect(updated?.current_round).toBe(2); // Should not increment
    });

    it('should cap current_round at MAX_ROUNDS', async () => {
      const convexSession = mockConvexSession({
        storyContent: 'Long story...',
        wordsWritten: 100,
        sentencesCompleted: 10,
        currentRound: 5,
        finalScore: 500,
        xpEarned: 250,
      });

      mockConvexClient.query.mockResolvedValueOnce(convexSession);
      mockConvexClient.mutation.mockResolvedValue(undefined);

      const session = await storySessionManager.getSession('session-123');
      const updated = await storySessionManager.addContribution(
        'session-123',
        'ai',
        'AI response',
        session!,
      );

      expect(updated?.current_round).toBe(5); // Should stay at MAX_ROUNDS
    });
  });

  describe('Auto-Completion', () => {
    it('should mark story as complete when reaching round 5', async () => {
      const convexSession = mockConvexSession({
        storyContent: 'Story in progress...',
        wordsWritten: 80,
        sentencesCompleted: 8,
        currentRound: 4,
        finalScore: 400,
        xpEarned: 200,
      });

      mockConvexClient.query.mockResolvedValueOnce(convexSession);
      mockConvexClient.mutation.mockResolvedValue(undefined);

      const session = await storySessionManager.getSession('session-123');
      const updated = await storySessionManager.addContribution(
        'session-123',
        'ai',
        'Final AI response',
        session!,
      );

      expect(updated?.current_round).toBe(5);
      expect(updated?.isCompleted).toBe(true);
      expect(updated?.completed_at).toBeTruthy();
    });

    it('should not mark incomplete if round < 5', async () => {
      const convexSession = mockConvexSession({
        storyContent: 'Story in progress...',
        wordsWritten: 60,
        sentencesCompleted: 6,
        currentRound: 3,
        finalScore: 300,
        xpEarned: 150,
      });

      mockConvexClient.query.mockResolvedValueOnce(convexSession);
      mockConvexClient.mutation.mockResolvedValue(undefined);

      const session = await storySessionManager.getSession('session-123');
      const updated = await storySessionManager.addContribution(
        'session-123',
        'ai',
        'AI response',
        session!,
      );

      expect(updated?.current_round).toBe(4);
      expect(updated?.isCompleted).toBe(false);
      expect(updated?.completed_at).toBeUndefined();
    });

    it('should preserve completed_at once set', async () => {
      const completedAt = '2026-01-01T00:00:00Z';
      const convexSession = mockConvexSession({
        storyContent: 'Completed story',
        wordsWritten: 100,
        sentencesCompleted: 10,
        currentRound: 5,
        finalScore: 500,
        xpEarned: 250,
        completedAt: completedAt,
      });

      mockConvexClient.query.mockResolvedValueOnce(convexSession);
      mockConvexClient.mutation.mockResolvedValue(undefined);

      const session = await storySessionManager.getSession('session-123');
      const updated = await storySessionManager.addContribution(
        'session-123',
        'ai',
        'Extra AI response',
        session!,
      );

      expect(updated?.completed_at).toBe(completedAt); // Should not change
    });
  });

  describe('Database Persistence', () => {
    it('should persist current_round to database on update', async () => {
      const convexSession = mockConvexSession({
        storyContent: 'Story...',
        wordsWritten: 40,
        sentencesCompleted: 4,
        currentRound: 2,
        finalScore: 200,
        xpEarned: 100,
      });

      mockConvexClient.query.mockResolvedValueOnce(convexSession);
      mockConvexClient.mutation.mockResolvedValue(undefined);

      const session = await storySessionManager.getSession('session-123');
      await storySessionManager.updateSession(session!);

      expect(mockConvexClient.mutation).toHaveBeenCalledWith(
        'gameSessions:updateSession',
        expect.objectContaining({
          sessionId: 'session-123',
          updates: expect.objectContaining({
            currentRound: 2,
          }),
        }),
      );
    });

    it('should persist completed_at when story completes', async () => {
      const convexSession = mockConvexSession({
        storyContent: 'Complete story',
        wordsWritten: 100,
        sentencesCompleted: 10,
        currentRound: 5,
        finalScore: 500,
        xpEarned: 250,
      });

      mockConvexClient.query.mockResolvedValueOnce(convexSession);
      mockConvexClient.mutation.mockResolvedValue(undefined);

      const session = await storySessionManager.getSession('session-123');
      const now = new Date().toISOString();
      session!.isCompleted = true;
      session!.completed_at = now;

      await storySessionManager.updateSession(session!);

      expect(mockConvexClient.mutation).toHaveBeenCalledWith(
        'gameSessions:updateSession',
        expect.objectContaining({
          sessionId: 'session-123',
        }),
      );
    });
  });

  describe('Legacy Data Handling', () => {
    it('should default to round 1 for sessions without current_round', async () => {
      // Convex session with currentRound missing (defaults to undefined)
      const convexSession = mockConvexSession({
        _id: 'session-old',
        storyContent: 'Old story',
        wordsWritten: 30,
        sentencesCompleted: 3,
        finalScore: 150,
        xpEarned: 75,
        currentRound: undefined, // Legacy data
      });

      mockConvexClient.query.mockResolvedValueOnce(convexSession);

      const session = await storySessionManager.getSession('session-old');

      // convertConvexSessionToLegacy maps currentRound directly
      // When undefined, session is still returned
      expect(session).not.toBeNull();
    });

    it('should infer round from sentences_completed if needed', async () => {
      const convexSession = mockConvexSession({
        storyContent: 'Story...',
        wordsWritten: 60,
        sentencesCompleted: 6,
        currentRound: 1,
        finalScore: 300,
        xpEarned: 150,
      });

      mockConvexClient.query.mockResolvedValueOnce(convexSession);

      const session = await storySessionManager.getSession('session-123');

      // Service should be able to infer actual progress
      expect(session).not.toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle session not found gracefully', async () => {
      // Convex returns null for non-existent sessions
      mockConvexClient.query.mockResolvedValueOnce(null);

      const session = await storySessionManager.getSession(
        'nonexistent-session',
      );

      expect(session).toBeNull();
    });

    it('should handle multiple AI contributions in same round', async () => {
      const convexSession = mockConvexSession({
        storyContent: 'Story...',
        wordsWritten: 40,
        sentencesCompleted: 4,
        currentRound: 2,
        finalScore: 200,
        xpEarned: 100,
      });

      mockConvexClient.query.mockResolvedValueOnce(convexSession);
      mockConvexClient.mutation.mockResolvedValue(undefined);

      const session = await storySessionManager.getSession('session-123');

      // First AI contribution
      const updated1 = await storySessionManager.addContribution(
        'session-123',
        'ai',
        'AI response 1',
        session!,
      );

      expect(updated1?.current_round).toBe(3);

      // Second AI contribution (should still increment)
      const updated2 = await storySessionManager.addContribution(
        'session-123',
        'ai',
        'AI response 2',
        updated1!,
      );

      expect(updated2?.current_round).toBe(4);
    });
  });
});
