// Offline Image Caching Tests
// Tests for Task 3.2: Offline caching for images
//
// Updated for US-013: All tests now use Convex mocks (Supabase removed).

import {
  storySessionManager,
  StorySession,
} from '../src/services/storySessionManager';
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

describe('Offline Image Caching - Task 3.2', () => {
  const mockUserId = 'user_test123';
  const mockGradeLevel: GradeLevel = 'K-2';
  const SESSIONS_KEY = '@CreativeBridge:sessions';

  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(mockAsyncStorage).forEach(key => delete mockAsyncStorage[key]);
    (isConvexReady as jest.Mock).mockReturnValue(true);
    (getConvexClient as jest.Mock).mockReturnValue(mockConvexClient);
    mockConvexClient.mutation.mockResolvedValue(undefined);
    storySessionManager.clearCache();
  });

  describe('Supabase URL Caching', () => {
    it('should cache supabase_image_url in AsyncStorage', async () => {
      const mockSessionId = 'test-session-cache-123';

      const session: StorySession = {
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
        story_source: 'New',
        supabase_image_url:
          'https://supabase.co/storage/story-images/user-123/image.png',
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

      await storySessionManager.updateSession(session);

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

      const session: StorySession = {
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
        supabase_image_url:
          'https://supabase.co/storage/story-images/user-123/image.png',
        image_upload_status: 'uploaded' as const,
        completed_at: new Date().toISOString(),
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

      const session: StorySession = {
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
        image_upload_status: 'pending' as const,
        image_upload_attempts: 1,
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

  describe('Offline Retrieval', () => {
    it('should retrieve cached session when Convex is offline', async () => {
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

      // Cache the session
      mockAsyncStorage[SESSIONS_KEY] = JSON.stringify({
        [mockSessionId]: mockSession,
      });

      // Simulate offline - Convex query fails
      mockConvexClient.query.mockRejectedValueOnce(
        new Error('Network request failed'),
      );

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
      mockConvexClient.query.mockRejectedValueOnce(
        new Error('Network request failed'),
      );

      const session = await storySessionManager.getSession(
        'non-existent-session',
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

      mockAsyncStorage[SESSIONS_KEY] = JSON.stringify({
        [mockSessionId]: mockSession,
      });

      // Simulate offline
      mockConvexClient.query.mockRejectedValueOnce(new Error('Network error'));

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

  describe('Online Sync', () => {
    it('should update cache when online data changes', async () => {
      const mockSessionId = 'test-session-sync';

      // Return updated session from Convex
      const convexSession = mockConvexSession({
        _id: mockSessionId,
        storyContent: 'Story content',
        wordsWritten: 50,
        sentencesCompleted: 10,
        currentRound: 5,
        finalScore: 100,
        xpEarned: 500,
        generatedImageUrl: 'https://replicate.delivery/old-image.png',
      });

      mockConvexClient.query.mockResolvedValueOnce(convexSession);

      const fetchedSession = await storySessionManager.getSession(
        mockSessionId,
      );

      expect(fetchedSession).toBeTruthy();
      expect(fetchedSession?.current_round).toBe(5);
    });

    it('should cache after successful update', async () => {
      const mockSessionId = 'test-cache-after-update';

      const session: StorySession = {
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
        story_source: 'New',
        generated_image_url: 'https://replicate.delivery/image.png',
        supabase_image_url: 'https://supabase.co/storage/updated-image.png',
        image_upload_status: 'uploaded' as const,
        image_upload_attempts: 1,
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

    it('should cache even when Convex update fails', async () => {
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

      // Simulate Convex update failure
      mockConvexClient.mutation.mockRejectedValueOnce(
        new Error('Database connection failed'),
      );

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

      mockAsyncStorage[SESSIONS_KEY] = JSON.stringify({
        [mockSessionId]: mockSession,
      });

      // Simulate offline to force cache read
      mockConvexClient.query.mockRejectedValueOnce(new Error('Offline'));

      const startTime = Date.now();
      const retrieved = await storySessionManager.getSession(mockSessionId);
      const elapsed = Date.now() - startTime;

      expect(retrieved).toBeTruthy();
      expect(elapsed).toBeLessThan(100);
    });
  });
});
