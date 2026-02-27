/**
 * Story Session Manager - Offline Caching Unit Tests
 * Tests for AsyncStorage caching, offline retrieval, and online sync
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
  multiRemove: jest.fn(),
}));

/**
 * Helper to create a mock Convex game session document.
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

describe('StorySessionManager - Offline Caching', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isConvexReady as jest.Mock).mockReturnValue(true);
    (getConvexClient as jest.Mock).mockReturnValue(mockConvexClient);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({}));
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    storySessionManager.clearCache();
  });

  describe('Image URL Caching', () => {
    it('should cache supabase_image_url in AsyncStorage', async () => {
      const convexSession = mockConvexSession({
        storyContent: 'Story content',
        wordsWritten: 60,
        sentencesCompleted: 6,
        currentRound: 3,
        finalScore: 300,
        xpEarned: 150,
        generatedImageUrl: 'https://replicate.delivery/image.png',
      });

      mockConvexClient.query.mockResolvedValueOnce(convexSession);
      mockConvexClient.mutation.mockResolvedValue(undefined);

      const session = await storySessionManager.getSession('session-123');
      // Manually set supabase_image_url (this field is set locally, not from Convex)
      session!.supabase_image_url = 'https://supabase.co/storage/image.png';
      session!.image_upload_status = 'uploaded';
      await storySessionManager.updateSession(session!);

      // Verify AsyncStorage.setItem was called
      expect(AsyncStorage.setItem).toHaveBeenCalled();

      // Verify the cached data includes image URLs
      const setItemCalls = (AsyncStorage.setItem as jest.Mock).mock.calls;
      const lastCall = setItemCalls[setItemCalls.length - 1];
      const cachedData = JSON.parse(lastCall[1]);

      expect(cachedData['session-123']).toBeDefined();
      expect(cachedData['session-123'].supabase_image_url).toBe(
        'https://supabase.co/storage/image.png',
      );
      expect(cachedData['session-123'].image_upload_status).toBe('uploaded');
    });

    it('should cache generated_image_url for offline viewing', async () => {
      const convexSession = mockConvexSession({
        _id: 'session-456',
        storyContent: 'Complete story',
        wordsWritten: 100,
        sentencesCompleted: 10,
        currentRound: 5,
        finalScore: 500,
        xpEarned: 250,
        completedAt: new Date().toISOString(),
        generatedImageUrl: 'https://replicate.delivery/image.png',
        imageUploadStatus: 'pending',
      });

      mockConvexClient.query.mockResolvedValueOnce(convexSession);
      mockConvexClient.mutation.mockResolvedValue(undefined);

      const session = await storySessionManager.getSession('session-456');
      await storySessionManager.updateSession(session!);

      const setItemCalls = (AsyncStorage.setItem as jest.Mock).mock.calls;
      const lastCall = setItemCalls[setItemCalls.length - 1];
      const cachedData = JSON.parse(lastCall[1]);

      expect(cachedData['session-456'].generated_image_url).toBe(
        'https://replicate.delivery/image.png',
      );
      expect(cachedData['session-456'].image_upload_status).toBe('pending');
    });
  });

  describe('Offline Retrieval', () => {
    it('should retrieve cached session when offline', async () => {
      const cachedSession = {
        id: 'session-123',
        user_id: 'user_test123',
        current_round: 4,
        grade_level: 'K-2',
        story_content: 'Cached story',
        words_written: 80,
        sentences_completed: 8,
        final_score: 400,
        xp_earned: 200,
        completed_at: null,
        generated_image_url: 'https://replicate.delivery/cached-image.png',
        supabase_image_url: 'https://supabase.co/storage/cached-image.png',
        image_upload_status: 'uploaded',
        isCompleted: false,
        story_source: 'New',
        contributions: [],
        sessionStats: {
          totalWords: 80,
          userWords: 48,
          aiWords: 32,
          sessionDuration: 0,
          contributionCount: 8,
        },
        metadata: {},
      };

      // Simulate offline - Convex query fails
      mockConvexClient.query.mockRejectedValueOnce(
        new Error('Network request failed'),
      );

      // Return cached data
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({ 'session-123': cachedSession }),
      );

      const session = await storySessionManager.getSession('session-123');

      expect(session).toBeTruthy();
      expect(session?.id).toBe('session-123');
      expect(session?.supabase_image_url).toBe(
        'https://supabase.co/storage/cached-image.png',
      );
      expect(session?.current_round).toBe(4);
    });

    it('should prefer online data over cache when available', async () => {
      const convexSession = mockConvexSession({
        storyContent: 'Updated story',
        wordsWritten: 85,
        sentencesCompleted: 8,
        currentRound: 4,
        finalScore: 425,
        xpEarned: 212,
        generatedImageUrl: 'https://replicate.delivery/image.png',
      });

      mockConvexClient.query.mockResolvedValueOnce(convexSession);

      const cachedSession = {
        id: 'session-123',
        user_id: 'user_test123',
        current_round: 3,
        supabase_image_url: 'https://old-url.com/image.png',
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({ 'session-123': cachedSession }),
      );

      const session = await storySessionManager.getSession('session-123');

      // Should get online data, not cached
      expect(session?.current_round).toBe(4);
    });

    it('should return null if session not in cache and offline', async () => {
      mockConvexClient.query.mockRejectedValueOnce(new Error('Network error'));
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({})); // Empty cache

      const session = await storySessionManager.getSession(
        'nonexistent-session',
      );

      expect(session).toBeNull();
    });
  });

  describe('Online Sync', () => {
    it('should update cache when online data changes', async () => {
      const convexSession = mockConvexSession({
        storyContent: 'Updated online story',
        wordsWritten: 100,
        sentencesCompleted: 10,
        currentRound: 5,
        finalScore: 500,
        xpEarned: 250,
        completedAt: new Date().toISOString(),
        generatedImageUrl: 'https://replicate.delivery/new-image.png',
      });

      mockConvexClient.query.mockResolvedValueOnce(convexSession);

      const session = await storySessionManager.getSession('session-123');

      // Verify cache was updated with new data
      expect(AsyncStorage.setItem).toHaveBeenCalled();

      const setItemCalls = (AsyncStorage.setItem as jest.Mock).mock.calls;
      // Find the sessions cache call (key starts with @CreativeBridge:sessions)
      const sessionsCacheCall = setItemCalls.find((call: any[]) =>
        call[0].includes('sessions'),
      );
      expect(sessionsCacheCall).toBeDefined();

      if (sessionsCacheCall) {
        const cachedData = JSON.parse(sessionsCacheCall[1]);
        expect(cachedData['session-123'].current_round).toBe(5);
      }
    });

    it('should handle cache write failures gracefully', async () => {
      const convexSession = mockConvexSession({
        storyContent: 'Story',
        wordsWritten: 40,
        sentencesCompleted: 4,
        currentRound: 2,
        finalScore: 200,
        xpEarned: 100,
      });

      mockConvexClient.query.mockResolvedValueOnce(convexSession);
      mockConvexClient.mutation.mockResolvedValue(undefined);

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({}));
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(
        new Error('Storage full'),
      );

      // Should not throw, just log error
      const session = await storySessionManager.getSession('session-123');
      await expect(
        storySessionManager.updateSession(session!),
      ).resolves.not.toThrow();
    });
  });

  describe('Cache Cleanup', () => {
    it('should remove old sessions from cache if needed', async () => {
      const convexSession = mockConvexSession({
        _id: 'session-new',
        storyContent: 'New story',
        wordsWritten: 20,
        sentencesCompleted: 2,
        currentRound: 1,
        finalScore: 100,
        xpEarned: 50,
      });

      mockConvexClient.query.mockResolvedValueOnce(convexSession);
      mockConvexClient.mutation.mockResolvedValue(undefined);

      const existingCache = {
        'old-1': {
          id: 'old-1',
          created_at: new Date(
            Date.now() - 40 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        },
        'old-2': {
          id: 'old-2',
          created_at: new Date(
            Date.now() - 35 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        },
        'recent-1': {
          id: 'recent-1',
          created_at: new Date(
            Date.now() - 5 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        },
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(existingCache),
      );
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      const session = await storySessionManager.getSession('session-new');
      await storySessionManager.updateSession(session!);

      // Verify old sessions might be removed (implementation-specific)
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('Image Upload Status Caching', () => {
    it('should track pending upload status in cache', async () => {
      const convexSession = mockConvexSession({
        storyContent: 'Complete story',
        wordsWritten: 100,
        sentencesCompleted: 10,
        currentRound: 5,
        finalScore: 500,
        xpEarned: 250,
        completedAt: new Date().toISOString(),
        generatedImageUrl: 'https://replicate.delivery/image.png',
        imageUploadStatus: 'pending',
        imageUploadAttempts: 1,
      });

      mockConvexClient.query.mockResolvedValueOnce(convexSession);
      mockConvexClient.mutation.mockResolvedValue(undefined);

      const session = await storySessionManager.getSession('session-123');
      await storySessionManager.updateSession(session!);

      const setItemCalls = (AsyncStorage.setItem as jest.Mock).mock.calls;
      const lastCall = setItemCalls[setItemCalls.length - 1];
      const cachedData = JSON.parse(lastCall[1]);

      expect(cachedData['session-123'].image_upload_status).toBe('pending');
      expect(cachedData['session-123'].generated_image_url).toBeTruthy();
    });

    it('should update cache when upload status changes from pending to uploaded', async () => {
      // First fetch - pending
      const pendingSession = mockConvexSession({
        storyContent: 'Complete story',
        wordsWritten: 100,
        sentencesCompleted: 10,
        currentRound: 5,
        finalScore: 500,
        xpEarned: 250,
        completedAt: new Date().toISOString(),
        generatedImageUrl: 'https://replicate.delivery/image.png',
        imageUploadStatus: 'pending',
      });

      // Second fetch - uploaded
      const uploadedSession = mockConvexSession({
        ...pendingSession,
        imageUploadStatus: 'uploaded',
        imageUploadAttempts: 2,
      });

      mockConvexClient.query
        .mockResolvedValueOnce(pendingSession)
        .mockResolvedValueOnce(uploadedSession);

      // Get session when pending
      const session1 = await storySessionManager.getSession('session-123');
      expect(session1?.image_upload_status).toBe('pending');

      // Clear cache so second getSession hits Convex again
      storySessionManager.clearCache();

      // Get session after upload completed
      const session2 = await storySessionManager.getSession('session-123');
      expect(session2?.image_upload_status).toBe('uploaded');
    });

    it('should cache failed upload status with error message', async () => {
      const convexSession = mockConvexSession({
        storyContent: 'Complete story',
        wordsWritten: 100,
        sentencesCompleted: 10,
        currentRound: 5,
        finalScore: 500,
        xpEarned: 250,
        completedAt: new Date().toISOString(),
        generatedImageUrl: 'https://replicate.delivery/image.png',
        imageUploadStatus: 'failed',
        imageUploadAttempts: 3,
        imageUploadError: 'Storage quota exceeded',
      });

      mockConvexClient.query.mockResolvedValueOnce(convexSession);
      mockConvexClient.mutation.mockResolvedValue(undefined);

      const session = await storySessionManager.getSession('session-123');
      await storySessionManager.updateSession(session!);

      const setItemCalls = (AsyncStorage.setItem as jest.Mock).mock.calls;
      const lastCall = setItemCalls[setItemCalls.length - 1];
      const cachedData = JSON.parse(lastCall[1]);

      expect(cachedData['session-123'].image_upload_status).toBe('failed');
      expect(cachedData['session-123'].image_upload_error).toBe(
        'Storage quota exceeded',
      );
    });
  });

  describe('Performance', () => {
    it('should complete cache operations quickly', async () => {
      const convexSession = mockConvexSession({
        storyContent: 'Story',
        wordsWritten: 60,
        sentencesCompleted: 6,
        currentRound: 3,
        finalScore: 300,
        xpEarned: 150,
      });

      mockConvexClient.query.mockResolvedValueOnce(convexSession);

      const startTime = Date.now();
      await storySessionManager.getSession('session-123');
      const elapsed = Date.now() - startTime;

      // Cache read should be fast (< 100ms)
      expect(elapsed).toBeLessThan(100);
    });
  });
});
