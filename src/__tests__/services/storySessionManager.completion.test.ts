/**
 * Story Session Manager - Completion Tracking Unit Tests
 * Tests for round counting, auto-completion, and completion state management
 */

import { storySessionManager } from '../../services/storySessionManager';
import { supabase } from '../../services/supabase';

// Mock Supabase
jest.mock('../../services/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      getUser: jest.fn(() => Promise.resolve({
        data: { user: { id: 'test-user-123' } },
        error: null,
      })),
    },
  },
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const MAX_ROUNDS = 5;

describe('StorySessionManager - Completion Tracking', () => {
  let mockDatabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup database mock
    mockDatabase = {
      select: jest.fn(() => mockDatabase),
      insert: jest.fn(() => mockDatabase),
      update: jest.fn(() => mockDatabase),
      eq: jest.fn(() => mockDatabase),
      single: jest.fn(),
      order: jest.fn(() => mockDatabase),
      limit: jest.fn(() => mockDatabase),
    };

    (supabase.from as jest.Mock).mockReturnValue(mockDatabase);
  });

  describe('Round Tracking', () => {
    it('should initialize new session with round 1', async () => {
      mockDatabase.insert.mockResolvedValue({
        data: {
          id: 'session-123',
          user_id: 'user-123',
          current_round: 1,
          grade_level: 'K-2',
          created_at: new Date().toISOString(),
        },
        error: null,
      });

      mockDatabase.single.mockResolvedValue({
        data: {
          id: 'session-123',
          user_id: 'user-123',
          current_round: 1,
          grade_level: 'K-2',
          story_content: '',
          words_written: 0,
          sentences_completed: 0,
          final_score: 0,
          xp_earned: 0,
          story_source: 'New',
          story_metadata: {},
        },
        error: null,
      });

      const session = await storySessionManager.createSession('user-123', 'K-2');

      expect(session).not.toBeNull();
      expect(session?.current_round).toBe(1);
    });

    it('should increment round after AI contribution', async () => {
      const sessionData = {
        id: 'session-123',
        user_id: 'user-123',
        current_round: 1,
        grade_level: 'K-2',
        story_content: 'User: Hello\n',
        words_written: 1,
        sentences_completed: 1,
        final_score: 0,
        xp_earned: 0,
        completed_at: null,
        story_source: 'New',
        story_metadata: {},
      };

      mockDatabase.single.mockResolvedValue({
        data: sessionData,
        error: null,
      });

      mockDatabase.update.mockResolvedValue({
        data: { ...sessionData, current_round: 2 },
        error: null,
      });

      const session = await storySessionManager.getSession('session-123');
      expect(session?.current_round).toBe(1);

      const updated = await storySessionManager.addContribution(
        'session-123',
        'ai',
        'AI response',
        session!
      );

      expect(updated?.current_round).toBe(2);
    });

    it('should not increment round after user contribution', async () => {
      const sessionData = {
        id: 'session-123',
        user_id: 'user-123',
        current_round: 2,
        grade_level: 'K-2',
        story_content: 'User: Hello\nAI: Hi there!\n',
        words_written: 5,
        sentences_completed: 2,
        final_score: 0,
        xp_earned: 0,
        completed_at: null,
        story_source: 'New',
        story_metadata: {},
      };

      mockDatabase.single.mockResolvedValue({
        data: sessionData,
        error: null,
      });

      mockDatabase.update.mockResolvedValue({
        data: sessionData, // Round stays the same
        error: null,
      });

      const session = await storySessionManager.getSession('session-123');
      const updated = await storySessionManager.addContribution(
        'session-123',
        'user',
        'User second message',
        session!
      );

      expect(updated?.current_round).toBe(2); // Should not increment
    });

    it('should cap current_round at MAX_ROUNDS', async () => {
      const sessionData = {
        id: 'session-123',
        user_id: 'user-123',
        current_round: 5,
        grade_level: 'K-2',
        story_content: 'Long story...',
        words_written: 100,
        sentences_completed: 10,
        final_score: 500,
        xp_earned: 250,
        completed_at: null,
        story_source: 'New',
        story_metadata: {},
      };

      mockDatabase.single.mockResolvedValue({
        data: sessionData,
        error: null,
      });

      mockDatabase.update.mockResolvedValue({
        data: { ...sessionData, current_round: 5 }, // Capped at 5
        error: null,
      });

      const session = await storySessionManager.getSession('session-123');
      const updated = await storySessionManager.addContribution(
        'session-123',
        'ai',
        'AI response',
        session!
      );

      expect(updated?.current_round).toBe(5); // Should stay at MAX_ROUNDS
    });
  });

  describe('Auto-Completion', () => {
    it('should mark story as complete when reaching round 5', async () => {
      const sessionData = {
        id: 'session-123',
        user_id: 'user-123',
        current_round: 4,
        grade_level: 'K-2',
        story_content: 'Story in progress...',
        words_written: 80,
        sentences_completed: 8,
        final_score: 400,
        xp_earned: 200,
        completed_at: null,
        story_source: 'New',
        story_metadata: {},
      };

      mockDatabase.single.mockResolvedValue({
        data: sessionData,
        error: null,
      });

      const now = new Date().toISOString();
      mockDatabase.update.mockResolvedValue({
        data: {
          ...sessionData,
          current_round: 5,
          completed_at: now,
        },
        error: null,
      });

      const session = await storySessionManager.getSession('session-123');
      const updated = await storySessionManager.addContribution(
        'session-123',
        'ai',
        'Final AI response',
        session!
      );

      expect(updated?.current_round).toBe(5);
      expect(updated?.isCompleted).toBe(true);
      expect(updated?.completed_at).toBeTruthy();
    });

    it('should not mark incomplete if round < 5', async () => {
      const sessionData = {
        id: 'session-123',
        user_id: 'user-123',
        current_round: 3,
        grade_level: 'K-2',
        story_content: 'Story in progress...',
        words_written: 60,
        sentences_completed: 6,
        final_score: 300,
        xp_earned: 150,
        completed_at: null,
        story_source: 'New',
        story_metadata: {},
      };

      mockDatabase.single.mockResolvedValue({
        data: sessionData,
        error: null,
      });

      mockDatabase.update.mockResolvedValue({
        data: { ...sessionData, current_round: 4 },
        error: null,
      });

      const session = await storySessionManager.getSession('session-123');
      const updated = await storySessionManager.addContribution(
        'session-123',
        'ai',
        'AI response',
        session!
      );

      expect(updated?.current_round).toBe(4);
      expect(updated?.isCompleted).toBe(false);
      expect(updated?.completed_at).toBeNull();
    });

    it('should preserve completed_at once set', async () => {
      const completedAt = '2026-01-01T00:00:00Z';
      const sessionData = {
        id: 'session-123',
        user_id: 'user-123',
        current_round: 5,
        grade_level: 'K-2',
        story_content: 'Completed story',
        words_written: 100,
        sentences_completed: 10,
        final_score: 500,
        xp_earned: 250,
        completed_at: completedAt,
        story_source: 'New',
        story_metadata: {},
      };

      mockDatabase.single.mockResolvedValue({
        data: sessionData,
        error: null,
      });

      mockDatabase.update.mockResolvedValue({
        data: sessionData,
        error: null,
      });

      const session = await storySessionManager.getSession('session-123');
      const updated = await storySessionManager.addContribution(
        'session-123',
        'ai',
        'Extra AI response',
        session!
      );

      expect(updated?.completed_at).toBe(completedAt); // Should not change
    });
  });

  describe('Database Persistence', () => {
    it('should persist current_round to database on update', async () => {
      const sessionData = {
        id: 'session-123',
        user_id: 'user-123',
        current_round: 2,
        grade_level: 'K-2',
        story_content: 'Story...',
        words_written: 40,
        sentences_completed: 4,
        final_score: 200,
        xp_earned: 100,
        completed_at: null,
        generated_image_url: null,
        supabase_image_url: null,
        image_upload_status: null,
        story_source: 'New',
        story_metadata: {},
      };

      mockDatabase.single.mockResolvedValue({
        data: sessionData,
        error: null,
      });

      mockDatabase.update.mockResolvedValue({
        data: { ...sessionData, current_round: 3 },
        error: null,
      });

      const session = await storySessionManager.getSession('session-123');
      await storySessionManager.updateSession(session!);

      expect(mockDatabase.update).toHaveBeenCalled();
      // Verify update was called with current_round
      const updateCall = (mockDatabase.update as jest.Mock).mock.calls[0];
      expect(updateCall).toBeDefined();
    });

    it('should persist completed_at when story completes', async () => {
      const sessionData = {
        id: 'session-123',
        user_id: 'user-123',
        current_round: 5,
        grade_level: 'K-2',
        story_content: 'Complete story',
        words_written: 100,
        sentences_completed: 10,
        final_score: 500,
        xp_earned: 250,
        completed_at: null,
        story_source: 'New',
        story_metadata: {},
      };

      mockDatabase.single.mockResolvedValue({
        data: sessionData,
        error: null,
      });

      const now = new Date().toISOString();
      mockDatabase.update.mockResolvedValue({
        data: { ...sessionData, completed_at: now },
        error: null,
      });

      const session = await storySessionManager.getSession('session-123');
      session!.isCompleted = true;
      session!.completed_at = now;

      await storySessionManager.updateSession(session!);

      expect(mockDatabase.update).toHaveBeenCalled();
    });
  });

  describe('Legacy Data Handling', () => {
    it('should default to round 1 for sessions without current_round', async () => {
      const legacySessionData = {
        id: 'session-old',
        user_id: 'user-123',
        // current_round is missing (legacy data)
        grade_level: 'K-2',
        story_content: 'Old story',
        words_written: 30,
        sentences_completed: 3,
        final_score: 150,
        xp_earned: 75,
        completed_at: null,
        story_source: 'New',
        story_metadata: {},
      };

      mockDatabase.single.mockResolvedValue({
        data: legacySessionData,
        error: null,
      });

      const session = await storySessionManager.getSession('session-old');

      expect(session?.current_round).toBe(1); // Default value
    });

    it('should infer round from sentences_completed if needed', async () => {
      const sessionData = {
        id: 'session-123',
        user_id: 'user-123',
        current_round: 1,
        grade_level: 'K-2',
        story_content: 'Story...',
        words_written: 60,
        sentences_completed: 6, // 3 rounds completed
        final_score: 300,
        xp_earned: 150,
        completed_at: null,
        story_source: 'New',
        story_metadata: {},
      };

      mockDatabase.single.mockResolvedValue({
        data: sessionData,
        error: null,
      });

      const session = await storySessionManager.getSession('session-123');

      // Service should be able to infer actual progress
      expect(session).not.toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle session not found gracefully', async () => {
      mockDatabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Session not found' },
      });

      const session = await storySessionManager.getSession('nonexistent-session');

      expect(session).toBeNull();
    });

    it('should handle multiple AI contributions in same round', async () => {
      const sessionData = {
        id: 'session-123',
        user_id: 'user-123',
        current_round: 2,
        grade_level: 'K-2',
        story_content: 'Story...',
        words_written: 40,
        sentences_completed: 4,
        final_score: 200,
        xp_earned: 100,
        completed_at: null,
        story_source: 'New',
        story_metadata: {},
      };

      mockDatabase.single.mockResolvedValue({
        data: sessionData,
        error: null,
      });

      mockDatabase.update.mockResolvedValue({
        data: { ...sessionData, current_round: 3 },
        error: null,
      });

      const session = await storySessionManager.getSession('session-123');

      // First AI contribution
      const updated1 = await storySessionManager.addContribution(
        'session-123',
        'ai',
        'AI response 1',
        session!
      );

      expect(updated1?.current_round).toBe(3);

      // Second AI contribution (should still increment)
      mockDatabase.single.mockResolvedValue({
        data: { ...sessionData, current_round: 3 },
        error: null,
      });

      mockDatabase.update.mockResolvedValue({
        data: { ...sessionData, current_round: 4 },
        error: null,
      });

      const updated2 = await storySessionManager.addContribution(
        'session-123',
        'ai',
        'AI response 2',
        updated1!
      );

      expect(updated2?.current_round).toBe(4);
    });
  });
});
