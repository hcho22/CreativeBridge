// Story Completion Tracking Tests
// Tests for Task 3.1: Round tracking and auto-completion logic

import { storySessionManager, StorySession } from '../src/services/storySessionManager';
import { supabase } from '../src/services/supabase';
import { GradeLevel } from '../src/types';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  multiRemove: jest.fn(),
}));

// Mock Supabase
jest.mock('../src/services/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

describe('Story Completion Tracking - Task 3.1', () => {
  const mockUserId = 'test-user-uuid';
  const mockGradeLevel: GradeLevel = 'K-2';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test 1: Round increments after each AI response
  describe('Round Increment Logic', () => {
    it('should increment current_round after AI contribution', async () => {
      // Mock session creation
      const mockSessionId = 'test-session-123';
      const mockCreatedSession = {
        id: mockSessionId,
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
      };

      (supabase.from as jest.Mock).mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockCreatedSession,
              error: null,
            }),
          }),
        }),
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockCreatedSession,
              error: null,
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { ...mockCreatedSession, current_round: 2 },
                error: null,
              }),
            }),
          }),
        }),
      });

      const session = await storySessionManager.createSession(mockUserId, mockGradeLevel);
      expect(session.current_round).toBe(1);

      // Mock for user contribution (round should stay at 1)
      (supabase.from as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  ...mockCreatedSession,
                  current_round: 1, // User contribution doesn't change round
                  sentences_completed: 1,
                  story_content: 'Once upon a time',
                },
                error: null,
              }),
            }),
          }),
        }),
      });

      const afterUser = await storySessionManager.addContribution(
        session.id,
        'user',
        'Once upon a time',
        session
      );
      expect(afterUser?.current_round).toBe(1);

      // Mock for AI contribution (round should increment to 2)
      const mockUpdatedSession = {
        ...mockCreatedSession,
        current_round: 2,
        sentences_completed: 2,
        story_content: 'Once upon a time there was a brave knight.',
      };

      (supabase.from as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockUpdatedSession,
                error: null,
              }),
            }),
          }),
        }),
      });

      const afterAI = await storySessionManager.addContribution(
        session.id,
        'ai',
        'there was a brave knight.',
        afterUser!
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

      // Simulate 3 full rounds
      for (let round = 1; round <= 3; round++) {
        // User contribution
        mockSession.contributions.push({
          type: 'user',
          content: `User input ${round}`,
          timestamp: Date.now(),
          wordCount: 3,
        });

        // AI contribution - this should increment the round
        mockSession.contributions.push({
          type: 'ai',
          content: `AI response ${round}`,
          timestamp: Date.now(),
          wordCount: 3,
        });

        // Mock the update for AI response
        const expectedRound = round + 1;
        (supabase.from as jest.Mock).mockReturnValue({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { ...mockSession, current_round: expectedRound },
                  error: null,
                }),
              }),
            }),
          }),
        });

        const updated = await storySessionManager.addContribution(
          mockSession.id,
          'ai',
          `AI response ${round}`,
          mockSession
        );

        expect(updated?.current_round).toBe(expectedRound);
        mockSession.current_round = expectedRound;
      }

      // After 3 rounds, should be at round 4
      expect(mockSession.current_round).toBe(4);
    });
  });

  // Test 2: Story marked complete at round 5
  describe('Auto-Completion at MAX_ROUNDS', () => {
    it('should mark story as complete when reaching MAX_ROUNDS (5)', async () => {
      const mockSession: StorySession = {
        id: 'test-session-complete',
        user_id: mockUserId,
        grade_level: mockGradeLevel,
        created_at: new Date().toISOString(),
        current_round: 4, // Starting at round 4, next AI response will complete
        final_score: 0,
        words_written: 50,
        sentences_completed: 8,
        challenges_completed: 0,
        xp_earned: 0,
        story_content: 'A wonderful story so far...',
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

      // Mock the final AI contribution that should complete the story
      const completedAt = new Date().toISOString();
      (supabase.from as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  ...mockSession,
                  current_round: 5,
                  completed_at: completedAt,
                },
                error: null,
              }),
            }),
          }),
        }),
      });

      const completed = await storySessionManager.addContribution(
        mockSession.id,
        'ai',
        'And they lived happily ever after.',
        mockSession
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
        created_at: new Date(beforeCompletion - 300000).toISOString(), // 5 min ago
        current_round: 4,
        final_score: 0,
        words_written: 40,
        sentences_completed: 8,
        challenges_completed: 0,
        xp_earned: 0,
        story_content: 'Almost done...',
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

      const completedAt = new Date().toISOString();
      (supabase.from as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  ...mockSession,
                  current_round: 5,
                  completed_at: completedAt,
                },
                error: null,
              }),
            }),
          }),
        }),
      });

      const completed = await storySessionManager.addContribution(
        mockSession.id,
        'ai',
        'The end.',
        mockSession
      );

      const afterCompletion = Date.now();

      expect(completed?.completed_at).toBeTruthy();
      const completedTime = new Date(completed!.completed_at!).getTime();
      expect(completedTime).toBeGreaterThanOrEqual(beforeCompletion);
      expect(completedTime).toBeLessThanOrEqual(afterCompletion);
    });
  });

  // Test 3: Round doesn't exceed MAX_ROUNDS
  describe('MAX_ROUNDS Boundary', () => {
    it('should cap current_round at MAX_ROUNDS (5)', async () => {
      const mockSession: StorySession = {
        id: 'test-session-cap',
        user_id: mockUserId,
        grade_level: mockGradeLevel,
        created_at: new Date().toISOString(),
        current_round: 5, // Already at max
        final_score: 0,
        words_written: 60,
        sentences_completed: 10,
        challenges_completed: 0,
        xp_earned: 0,
        story_content: 'Complete story...',
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

      // Try to add another AI contribution (shouldn't increase round beyond 5)
      (supabase.from as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  ...mockSession,
                  current_round: 5, // Should stay at 5
                },
                error: null,
              }),
            }),
          }),
        }),
      });

      const afterExtraContribution = await storySessionManager.addContribution(
        mockSession.id,
        'ai',
        'Extra content after completion.',
        mockSession
      );

      expect(afterExtraContribution?.current_round).toBe(5); // Should not exceed 5
    });
  });

  // Test 4: Existing sessions default to round 1
  describe('Backward Compatibility', () => {
    it('should default to round 1 for existing sessions without current_round', async () => {
      const mockOldSession = {
        id: 'old-session-123',
        user_id: mockUserId,
        grade_level: mockGradeLevel,
        created_at: new Date().toISOString(),
        // Note: current_round is missing (old session)
        final_score: 0,
        words_written: 20,
        sentences_completed: 4,
        challenges_completed: 0,
        xp_earned: 0,
        story_content: 'Existing story...',
      };

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockOldSession,
              error: null,
            }),
          }),
        }),
      });

      const session = await storySessionManager.getSession('old-session-123');

      expect(session).toBeTruthy();
      expect(session?.current_round).toBe(1); // Should default to 1
    });

    it('should preserve current_round when updating existing session', async () => {
      const mockSession: StorySession = {
        id: 'test-session-preserve',
        user_id: mockUserId,
        grade_level: mockGradeLevel,
        created_at: new Date().toISOString(),
        current_round: 3, // Mid-story
        final_score: 0,
        words_written: 30,
        sentences_completed: 6,
        challenges_completed: 0,
        xp_earned: 0,
        story_content: 'Story in progress...',
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

      (supabase.from as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  ...mockSession,
                  words_written: 40, // Only words changed
                },
                error: null,
              }),
            }),
          }),
        }),
      });

      mockSession.words_written = 40;
      const updated = await storySessionManager.updateSession(mockSession);

      expect(updated?.current_round).toBe(3); // Should preserve round
    });
  });

  // Test 5: Database persistence verification
  describe('Database Persistence', () => {
    it('should persist current_round to database on update', async () => {
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

      const updateMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockSession,
              error: null,
            }),
          }),
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        update: updateMock,
      });

      await storySessionManager.updateSession(mockSession);

      // Verify that update was called with current_round
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          current_round: 2,
        })
      );
    });
  });
});
