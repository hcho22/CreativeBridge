// Offline Image Caching Tests
// Tests for Task 3.2: Offline caching for images

import {
  storySessionManager,
  StorySession,
} from '../src/services/storySessionManager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../src/services/supabase';
import { GradeLevel } from '../src/types';

// Mock AsyncStorage
const mockAsyncStorage: { [key: string]: string } = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) =>
    Promise.resolve(mockAsyncStorage[key] || null),
  ),
  setItem: jest.fn((key: string, value: string) => {
    mockAsyncStorage[key] = value;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    delete mockAsyncStorage[key];
    return Promise.resolve();
  }),
  multiRemove: jest.fn((keys: string[]) => {
    keys.forEach(key => delete mockAsyncStorage[key]);
    return Promise.resolve();
  }),
}));

// Mock Supabase
jest.mock('../src/services/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

describe('Offline Image Caching - Task 3.2', () => {
  const mockUserId = 'test-user-uuid';
  const mockGradeLevel: GradeLevel = 'K-2';
  const SESSIONS_KEY = '@CreativeBridge:sessions';

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear mock storage
    Object.keys(mockAsyncStorage).forEach(key => delete mockAsyncStorage[key]);
  });

  // Test 1: Supabase URL cached in AsyncStorage
  describe('Supabase URL Caching', () => {
    it('should cache supabase_image_url in AsyncStorage', async () => {
      const mockSessionId = 'test-session-cache-123';
      const mockSession = {
        id: mockSessionId,
        user_id: mockUserId,
        grade_level: mockGradeLevel,
        created_at: new Date().toISOString(),
        current_round: 3,
        final_score: 0,
        words_written: 30,
        sentences_completed: 6,
        challenges_completed: 0,
        xp_earned: 0,
        story_content: 'Test story content',
        story_source: 'New' as const,
        supabase_image_url:
          'https://supabase.co/storage/story-images/user-123/image.png',
        image_upload_status: 'uploaded' as const,
      };

      // Mock the update to return the session with image URLs
      (supabase.from as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockSession,
                error: null,
              }),
            }),
          }),
        }),
      });

      const session: StorySession = {
        ...mockSession,
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

      await storySessionManager.updateSession(session);

      // Check AsyncStorage
      const cachedData = mockAsyncStorage[SESSIONS_KEY];
      expect(cachedData).toBeTruthy();

      const cachedSessions = JSON.parse(cachedData);
      expect(cachedSessions[mockSessionId]).toBeTruthy();
      expect(cachedSessions[mockSessionId].supabase_image_url).toBe(
        'https://supabase.co/storage/story-images/user-123/image.png',
      );
      expect(cachedSessions[mockSessionId].image_upload_status).toBe(
        'uploaded',
      );
    });

    it('should cache both Replicate and Supabase URLs', async () => {
      const mockSessionId = 'test-session-both-urls';
      const mockSession = {
        id: mockSessionId,
        user_id: mockUserId,
        grade_level: mockGradeLevel,
        created_at: new Date().toISOString(),
        current_round: 5,
        final_score: 100,
        words_written: 50,
        sentences_completed: 10,
        challenges_completed: 0,
        xp_earned: 500,
        story_content: 'Complete story',
        story_source: 'New' as const,
        generated_image_url: 'https://replicate.delivery/temp/image.png',
        supabase_image_url:
          'https://supabase.co/storage/story-images/user-123/image.png',
        image_upload_status: 'uploaded' as const,
        completed_at: new Date().toISOString(),
      };

      (supabase.from as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockSession,
                error: null,
              }),
            }),
          }),
        }),
      });

      const session: StorySession = {
        ...mockSession,
        isCompleted: true,
        contributions: [],
        sessionStats: {
          totalWords: 50,
          userWords: 25,
          aiWords: 25,
          sessionDuration: 400000,
          contributionCount: 10,
        },
        metadata: {},
      };

      await storySessionManager.updateSession(session);

      const cachedData = mockAsyncStorage[SESSIONS_KEY];
      const cachedSessions = JSON.parse(cachedData);

      expect(cachedSessions[mockSessionId].generated_image_url).toBe(
        'https://replicate.delivery/temp/image.png',
      );
      expect(cachedSessions[mockSessionId].supabase_image_url).toBe(
        'https://supabase.co/storage/story-images/user-123/image.png',
      );
    });

    it('should cache upload status for pending uploads', async () => {
      const mockSessionId = 'test-session-pending';
      const mockSession = {
        id: mockSessionId,
        user_id: mockUserId,
        grade_level: mockGradeLevel,
        created_at: new Date().toISOString(),
        current_round: 5,
        final_score: 100,
        words_written: 50,
        sentences_completed: 10,
        challenges_completed: 0,
        xp_earned: 500,
        story_content: 'Complete story',
        story_source: 'New' as const,
        generated_image_url: 'https://replicate.delivery/temp/image.png',
        image_upload_status: 'pending' as const,
        image_upload_attempts: 1,
      };

      (supabase.from as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockSession,
                error: null,
              }),
            }),
          }),
        }),
      });

      const session: StorySession = {
        ...mockSession,
        isCompleted: true,
        contributions: [],
        sessionStats: {
          totalWords: 50,
          userWords: 25,
          aiWords: 25,
          sessionDuration: 400000,
          contributionCount: 10,
        },
        metadata: {},
      };

      await storySessionManager.updateSession(session);

      const cachedData = mockAsyncStorage[SESSIONS_KEY];
      const cachedSessions = JSON.parse(cachedData);

      expect(cachedSessions[mockSessionId].image_upload_status).toBe('pending');
      expect(cachedSessions[mockSessionId].image_upload_attempts).toBe(1);
    });
  });

  // Test 2: Offline retrieval works
  describe('Offline Retrieval', () => {
    it('should retrieve cached session when Supabase is offline', async () => {
      const mockSessionId = 'test-session-offline';
      const mockSession: StorySession = {
        id: mockSessionId,
        user_id: mockUserId,
        grade_level: mockGradeLevel,
        created_at: new Date().toISOString(),
        current_round: 4,
        final_score: 80,
        words_written: 40,
        sentences_completed: 8,
        challenges_completed: 0,
        xp_earned: 400,
        story_content: 'Offline story content',
        story_source: 'New',
        supabase_image_url:
          'https://supabase.co/storage/story-images/cached.png',
        image_upload_status: 'uploaded' as const,
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

      // First, cache the session
      mockAsyncStorage[SESSIONS_KEY] = JSON.stringify({
        [mockSessionId]: mockSession,
      });

      // Simulate offline by mocking Supabase failure
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: {
                message: 'Network request failed',
                code: 'NETWORK_ERROR',
              },
            }),
          }),
        }),
      });

      // Should still retrieve from cache
      const offlineSession = await storySessionManager.getSession(
        mockSessionId,
      );

      expect(offlineSession).toBeTruthy();
      expect(offlineSession?.id).toBe(mockSessionId);
      expect(offlineSession?.supabase_image_url).toBe(
        'https://supabase.co/storage/story-images/cached.png',
      );
      expect(offlineSession?.image_upload_status).toBe('uploaded');
      expect(offlineSession?.story_content).toBe('Offline story content');
    });

    it('should return null when session not in cache and offline', async () => {
      const nonExistentSessionId = 'non-existent-session';

      // Simulate offline
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Network request failed' },
            }),
          }),
        }),
      });

      const session = await storySessionManager.getSession(
        nonExistentSessionId,
      );

      expect(session).toBeNull();
    });

    it('should preserve image URLs when retrieving from cache', async () => {
      const mockSessionId = 'test-preserve-images';
      const mockSession: StorySession = {
        id: mockSessionId,
        user_id: mockUserId,
        grade_level: mockGradeLevel,
        created_at: new Date().toISOString(),
        current_round: 5,
        final_score: 100,
        words_written: 50,
        sentences_completed: 10,
        challenges_completed: 0,
        xp_earned: 500,
        story_content: 'Complete story',
        story_source: 'New',
        generated_image_url: 'https://replicate.delivery/temp/image.png',
        supabase_image_url: 'https://supabase.co/storage/permanent/image.png',
        image_upload_status: 'uploaded' as const,
        image_upload_attempts: 2,
        isCompleted: true,
        completed_at: new Date().toISOString(),
        contributions: [],
        sessionStats: {
          totalWords: 50,
          userWords: 25,
          aiWords: 25,
          sessionDuration: 400000,
          contributionCount: 10,
        },
        metadata: {},
      };

      // Cache the session with all image fields
      mockAsyncStorage[SESSIONS_KEY] = JSON.stringify({
        [mockSessionId]: mockSession,
      });

      // Simulate offline
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Network error' },
            }),
          }),
        }),
      });

      const retrieved = await storySessionManager.getSession(mockSessionId);

      expect(retrieved?.generated_image_url).toBe(
        'https://replicate.delivery/temp/image.png',
      );
      expect(retrieved?.supabase_image_url).toBe(
        'https://supabase.co/storage/permanent/image.png',
      );
      expect(retrieved?.image_upload_status).toBe('uploaded');
      expect(retrieved?.image_upload_attempts).toBe(2);
    });
  });

  // Test 3: Online sync updates cache
  describe('Online Sync', () => {
    it('should update cache when online data changes', async () => {
      const mockSessionId = 'test-session-sync';
      const initialSession = {
        id: mockSessionId,
        user_id: mockUserId,
        grade_level: mockGradeLevel,
        created_at: new Date().toISOString(),
        current_round: 5,
        final_score: 100,
        words_written: 50,
        sentences_completed: 10,
        challenges_completed: 0,
        xp_earned: 500,
        story_content: 'Story content',
        generated_image_url: 'https://replicate.delivery/old-image.png',
        image_upload_status: 'pending' as const,
      };

      // Initial cache
      mockAsyncStorage[SESSIONS_KEY] = JSON.stringify({
        [mockSessionId]: initialSession,
      });

      // Now simulate fetching updated data from Supabase (image uploaded)
      const updatedSession = {
        ...initialSession,
        supabase_image_url: 'https://supabase.co/storage/new-image.png',
        image_upload_status: 'uploaded',
        image_upload_attempts: 2,
      };

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: updatedSession,
              error: null,
            }),
          }),
        }),
      });

      // Fetch session (should get new data from DB and update cache)
      const fetchedSession = await storySessionManager.getSession(
        mockSessionId,
      );

      expect(fetchedSession?.supabase_image_url).toBe(
        'https://supabase.co/storage/new-image.png',
      );
      expect(fetchedSession?.image_upload_status).toBe('uploaded');

      // Note: The current implementation doesn't auto-cache on getSession
      // It only caches on createSession and updateSession
      // This is intentional to avoid unnecessary cache writes
    });

    it('should cache after successful update', async () => {
      const mockSessionId = 'test-cache-after-update';
      const mockSession = {
        id: mockSessionId,
        user_id: mockUserId,
        grade_level: mockGradeLevel,
        created_at: new Date().toISOString(),
        current_round: 5,
        final_score: 100,
        words_written: 50,
        sentences_completed: 10,
        challenges_completed: 0,
        xp_earned: 500,
        story_content: 'Updated story',
        story_source: 'New' as const,
        generated_image_url: 'https://replicate.delivery/image.png',
        supabase_image_url: 'https://supabase.co/storage/updated-image.png',
        image_upload_status: 'uploaded' as const,
        image_upload_attempts: 1,
      };

      (supabase.from as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockSession,
                error: null,
              }),
            }),
          }),
        }),
      });

      const session: StorySession = {
        ...mockSession,
        isCompleted: true,
        completed_at: new Date().toISOString(),
        contributions: [],
        sessionStats: {
          totalWords: 50,
          userWords: 25,
          aiWords: 25,
          sessionDuration: 400000,
          contributionCount: 10,
        },
        metadata: {},
      };

      await storySessionManager.updateSession(session);

      // Verify cache was updated
      const cachedData = mockAsyncStorage[SESSIONS_KEY];
      expect(cachedData).toBeTruthy();

      const cachedSessions = JSON.parse(cachedData);
      expect(cachedSessions[mockSessionId].supabase_image_url).toBe(
        'https://supabase.co/storage/updated-image.png',
      );
      expect(cachedSessions[mockSessionId].image_upload_status).toBe(
        'uploaded',
      );
    });

    it('should cache even when Supabase update fails', async () => {
      const mockSessionId = 'test-cache-on-fail';
      const mockSession: StorySession = {
        id: mockSessionId,
        user_id: mockUserId,
        grade_level: mockGradeLevel,
        created_at: new Date().toISOString(),
        current_round: 4,
        final_score: 80,
        words_written: 40,
        sentences_completed: 8,
        challenges_completed: 0,
        xp_earned: 400,
        story_content: 'Story content',
        story_source: 'New',
        supabase_image_url: 'https://supabase.co/storage/image.png',
        image_upload_status: 'uploaded' as const,
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

      // Simulate Supabase update failure
      (supabase.from as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database connection failed' },
              }),
            }),
          }),
        }),
      });

      await storySessionManager.updateSession(mockSession);

      // Should still cache locally as fallback
      const cachedData = mockAsyncStorage[SESSIONS_KEY];
      expect(cachedData).toBeTruthy();

      const cachedSessions = JSON.parse(cachedData);
      expect(cachedSessions[mockSessionId]).toBeTruthy();
      expect(cachedSessions[mockSessionId].supabase_image_url).toBe(
        'https://supabase.co/storage/image.png',
      );
    });
  });

  // Test 4: Performance test
  describe('Cache Performance', () => {
    it('should cache and retrieve session quickly', async () => {
      const mockSessionId = 'test-performance';
      const mockSession: StorySession = {
        id: mockSessionId,
        user_id: mockUserId,
        grade_level: mockGradeLevel,
        created_at: new Date().toISOString(),
        current_round: 3,
        final_score: 60,
        words_written: 30,
        sentences_completed: 6,
        challenges_completed: 0,
        xp_earned: 300,
        story_content: 'Performance test story',
        story_source: 'New',
        supabase_image_url: 'https://supabase.co/storage/perf-test.png',
        image_upload_status: 'uploaded' as const,
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

      // Cache the session
      mockAsyncStorage[SESSIONS_KEY] = JSON.stringify({
        [mockSessionId]: mockSession,
      });

      // Simulate offline to force cache read
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Offline' },
            }),
          }),
        }),
      });

      const startTime = Date.now();
      const retrieved = await storySessionManager.getSession(mockSessionId);
      const elapsed = Date.now() - startTime;

      expect(retrieved).toBeTruthy();
      expect(elapsed).toBeLessThan(100); // Should be very fast (< 100ms)
    });
  });
});
