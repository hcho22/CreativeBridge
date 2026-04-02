// Story Completion Tracking Tests
// Tests for Task 3.1: Round tracking and auto-completion logic
//
// Updated for US-013: All tests now use Convex mocks (Supabase removed).

import {
  storySessionManager,
  StorySession,
} from '../src/services/storySessionManager';
import { GradeLevel } from '../src/types';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(JSON.stringify({}))),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
}));

// Mock Convex client
const mockConvexClient = {
  mutation: jest.fn(),
  query: jest.fn(),
};

jest.mock('../src/services/convex', () => ({
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

const { isConvexReady, getConvexClient } = require('../src/services/convex');

// Mock ChallengeService for completion calculations
jest.mock('../src/services/challengeService', () => ({
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

function mockConvexSession(overrides: Record<string, any> = {}) {
  return {
    _id: 'test-session-123',
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

describe('Story Completion Tracking - Task 3.1', () => {
  const mockUserId = 'user_test123';
  const mockGradeLevel: GradeLevel = 'K-2';

  beforeEach(() => {
    jest.clearAllMocks();
    (isConvexReady as jest.Mock).mockReturnValue(true);
    (getConvexClient as jest.Mock).mockReturnValue(mockConvexClient);
    mockConvexClient.mutation.mockResolvedValue(undefined);
    storySessionManager.clearCache();
  });

  describe('Round Increment Logic', () => {
    it('should increment current_round after AI contribution', async () => {
      // Create session
      mockConvexClient.mutation.mockResolvedValueOnce('test-session-123');

      const session = await storySessionManager.createSession(
        mockUserId,
        mockGradeLevel,
      );
      expect(session.current_round).toBe(1);

      // User contribution - round stays at 1
      const afterUser = await storySessionManager.addContribution(
        session.id,
        'user',
        'Once upon a time',
        session,
      );
      expect(afterUser?.current_round).toBe(1);

      // AI contribution - round increments to 2
      const afterAI = await storySessionManager.addContribution(
        session.id,
        'ai',
        'there was a brave knight.',
        afterUser!,
      );

      expect(afterAI?.current_round).toBe(2);
    });

    it('should increment through multiple rounds correctly', async () => {
      const mockSession: StorySession = {
        id: 'test-session-456',
        user_id: mockUserId,
        grade_level: mockGradeLevel,
        created_at: new Date().toISOString(),
        current_round: 1,
        final_score: 0,
        words_written: 0,
        sentences_completed: 0,
        challenges_completed: 0,
        xp_earned: 0,
        story_content: '',
        story_source: 'New',
        isCompleted: false,
        contributions: [],
        sessionStats: {
          totalWords: 0,
          userWords: 0,
          aiWords: 0,
          sessionDuration: 0,
          contributionCount: 0,
        },
        metadata: {},
      };

      // Simulate 3 full rounds of user+AI pairs
      let currentSession = mockSession;
      for (let round = 1; round <= 3; round++) {
        // User opens the round
        currentSession = (await storySessionManager.addContribution(
          currentSession.id,
          'user',
          `User input ${round}`,
          currentSession,
        ))!;
        // AI closes the round (pair complete → round advances)
        currentSession = (await storySessionManager.addContribution(
          currentSession.id,
          'ai',
          `AI response ${round}`,
          currentSession,
        ))!;

        expect(currentSession.current_round).toBe(round + 1);
      }

      // After 3 complete pairs, should be at round 4
      expect(currentSession.current_round).toBe(4);
    });
  });

  describe('Auto-Completion at MAX_ROUNDS', () => {
    it('should mark story as complete when a pair exceeds MAX_ROUNDS (5)', async () => {
      const mockSession: StorySession = {
        id: 'test-session-complete',
        user_id: mockUserId,
        grade_level: mockGradeLevel,
        created_at: new Date().toISOString(),
        current_round: 5,
        final_score: 0,
        words_written: 50,
        sentences_completed: 8,
        challenges_completed: 0,
        xp_earned: 0,
        story_content: 'A wonderful story so far...',
        story_source: 'New',
        isCompleted: false,
        contributions: [],
        sessionStats: {
          totalWords: 50,
          userWords: 25,
          aiWords: 25,
          sessionDuration: 60000,
          contributionCount: 8,
        },
        metadata: {},
      };

      // Add a complete pair to trigger completion
      const afterUser = await storySessionManager.addContribution(
        mockSession.id,
        'user',
        'The hero won.',
        mockSession,
      );
      const completed = await storySessionManager.addContribution(
        afterUser!.id,
        'ai',
        'And they lived happily ever after.',
        afterUser!,
      );

      expect(completed?.current_round).toBe(5);
      expect(completed?.isCompleted).toBe(true);
      expect(completed?.completed_at).toBeTruthy();
    });

    it('should have completed_at timestamp when story completes', async () => {
      const beforeCompletion = Date.now();

      const mockSession: StorySession = {
        id: 'test-session-timestamp',
        user_id: mockUserId,
        grade_level: mockGradeLevel,
        created_at: new Date(beforeCompletion - 300000).toISOString(),
        current_round: 5,
        final_score: 0,
        words_written: 40,
        sentences_completed: 8,
        challenges_completed: 0,
        xp_earned: 0,
        story_content: 'Almost done...',
        story_source: 'New',
        isCompleted: false,
        contributions: [],
        sessionStats: {
          totalWords: 40,
          userWords: 20,
          aiWords: 20,
          sessionDuration: 300000,
          contributionCount: 8,
        },
        metadata: {},
      };

      const afterUser = await storySessionManager.addContribution(
        mockSession.id,
        'user',
        'Final input.',
        mockSession,
      );
      const completed = await storySessionManager.addContribution(
        afterUser!.id,
        'ai',
        'The end.',
        afterUser!,
      );

      const afterCompletion = Date.now();

      expect(completed?.completed_at).toBeTruthy();
      const completedTime = new Date(completed!.completed_at!).getTime();
      expect(completedTime).toBeGreaterThanOrEqual(beforeCompletion);
      expect(completedTime).toBeLessThanOrEqual(afterCompletion);
    });
  });

  describe('MAX_ROUNDS Boundary', () => {
    it('should cap current_round at MAX_ROUNDS (5)', async () => {
      const mockSession: StorySession = {
        id: 'test-session-cap',
        user_id: mockUserId,
        grade_level: mockGradeLevel,
        created_at: new Date().toISOString(),
        current_round: 5,
        final_score: 0,
        words_written: 60,
        sentences_completed: 10,
        challenges_completed: 0,
        xp_earned: 0,
        story_content: 'Complete story...',
        story_source: 'New',
        isCompleted: true,
        completed_at: new Date().toISOString(),
        contributions: [],
        sessionStats: {
          totalWords: 60,
          userWords: 30,
          aiWords: 30,
          sessionDuration: 400000,
          contributionCount: 10,
        },
        metadata: {},
      };

      const afterExtraContribution = await storySessionManager.addContribution(
        mockSession.id,
        'ai',
        'Extra content after completion.',
        mockSession,
      );

      expect(afterExtraContribution?.current_round).toBe(5);
    });
  });

  describe('Backward Compatibility', () => {
    it('should handle sessions loaded from Convex correctly', async () => {
      const convexSession = mockConvexSession({
        _id: 'old-session-123',
        storyContent: 'Existing story...',
        wordsWritten: 20,
        sentencesCompleted: 4,
        currentRound: 1,
      });

      mockConvexClient.query.mockResolvedValueOnce(convexSession);

      const session = await storySessionManager.getSession('old-session-123');

      expect(session).toBeTruthy();
      expect(session?.current_round).toBe(1);
    });

    it('should preserve current_round when updating existing session', async () => {
      const mockSession: StorySession = {
        id: 'test-session-preserve',
        user_id: mockUserId,
        grade_level: mockGradeLevel,
        created_at: new Date().toISOString(),
        current_round: 3,
        final_score: 0,
        words_written: 30,
        sentences_completed: 6,
        challenges_completed: 0,
        xp_earned: 0,
        story_content: 'Story in progress...',
        story_source: 'New',
        isCompleted: false,
        contributions: [],
        sessionStats: {
          totalWords: 30,
          userWords: 15,
          aiWords: 15,
          sessionDuration: 200000,
          contributionCount: 6,
        },
        metadata: {},
      };

      mockSession.words_written = 40;
      const updated = await storySessionManager.updateSession(mockSession);

      expect(updated?.current_round).toBe(3); // Should preserve round
    });
  });

  describe('Database Persistence', () => {
    it('should persist current_round to Convex on update', async () => {
      const mockSession: StorySession = {
        id: 'test-session-persist',
        user_id: mockUserId,
        grade_level: mockGradeLevel,
        created_at: new Date().toISOString(),
        current_round: 2,
        final_score: 0,
        words_written: 25,
        sentences_completed: 4,
        challenges_completed: 0,
        xp_earned: 0,
        story_content: 'Story content...',
        story_source: 'New',
        isCompleted: false,
        contributions: [],
        sessionStats: {
          totalWords: 25,
          userWords: 12,
          aiWords: 13,
          sessionDuration: 150000,
          contributionCount: 4,
        },
        metadata: {},
      };

      await storySessionManager.updateSession(mockSession);

      expect(mockConvexClient.mutation).toHaveBeenCalledWith(
        'gameSessions:updateSession',
        expect.objectContaining({
          sessionId: 'test-session-persist',
          updates: expect.objectContaining({
            currentRound: 2,
          }),
        }),
      );
    });
  });
});
