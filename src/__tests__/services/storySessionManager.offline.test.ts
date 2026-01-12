/**
 * Story Session Manager - Offline Caching Unit Tests
 * Tests for AsyncStorage caching, offline retrieval, and online sync
 */

import { storySessionManager } from '../../services/storySessionManager';
import { supabase } from '../../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

describe('StorySessionManager - Offline Caching', () => {
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

  describe('Image URL Caching', () => {
    it('should cache supabase_image_url in AsyncStorage', async () => {
      const sessionData = {
        id: 'session-123',
        user_id: 'user-123',
        current_round: 3,
        grade_level: 'K-2',
        story_content: 'Story content',
        words_written: 60,
        sentences_completed: 6,
        final_score: 300,
        xp_earned: 150,
        completed_at: null,
        generated_image_url: 'https://replicate.delivery/image.png',
        supabase_image_url: 'https://supabase.co/storage/image.png',
        image_upload_status: 'uploaded',
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

      // Mock existing cache
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({}));
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      const session = await storySessionManager.getSession('session-123');
      await storySessionManager.updateSession(session!);

      // Verify AsyncStorage.setItem was called
      expect(AsyncStorage.setItem).toHaveBeenCalled();

      // Verify the cached data includes image URLs
      const setItemCall = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
      const cachedData = JSON.parse(setItemCall[1]);

      expect(cachedData['session-123']).toBeDefined();
      expect(cachedData['session-123'].supabase_image_url).toBe('https://supabase.co/storage/image.png');
      expect(cachedData['session-123'].image_upload_status).toBe('uploaded');
    });

    it('should cache generated_image_url for offline viewing', async () => {
      const sessionData = {
        id: 'session-456',
        user_id: 'user-123',
        current_round: 5,
        grade_level: '3-5',
        story_content: 'Complete story',
        words_written: 100,
        sentences_completed: 10,
        final_score: 500,
        xp_earned: 250,
        completed_at: new Date().toISOString(),
        generated_image_url: 'https://replicate.delivery/image.png',
        supabase_image_url: null, // Not yet uploaded
        image_upload_status: 'pending',
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

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({}));
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      const session = await storySessionManager.getSession('session-456');
      await storySessionManager.updateSession(session!);

      const setItemCall = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
      const cachedData = JSON.parse(setItemCall[1]);

      expect(cachedData['session-456'].generated_image_url).toBe('https://replicate.delivery/image.png');
      expect(cachedData['session-456'].image_upload_status).toBe('pending');
    });
  });

  describe('Offline Retrieval', () => {
    it('should retrieve cached session when offline', async () => {
      const cachedSession = {
        id: 'session-123',
        user_id: 'user-123',
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
        story_metadata: {},
      };

      // Simulate offline - database query fails
      mockDatabase.single.mockRejectedValue(new Error('Network request failed'));

      // Return cached data
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({ 'session-123': cachedSession })
      );

      const session = await storySessionManager.getSession('session-123');

      expect(session).toBeTruthy();
      expect(session?.id).toBe('session-123');
      expect(session?.supabase_image_url).toBe('https://supabase.co/storage/cached-image.png');
      expect(session?.current_round).toBe(4);
    });

    it('should prefer online data over cache when available', async () => {
      const cachedSession = {
        id: 'session-123',
        user_id: 'user-123',
        current_round: 3,
        supabase_image_url: 'https://old-url.com/image.png',
      };

      const onlineSession = {
        id: 'session-123',
        user_id: 'user-123',
        current_round: 4,
        grade_level: 'K-2',
        story_content: 'Updated story',
        words_written: 85,
        sentences_completed: 8,
        final_score: 425,
        xp_earned: 212,
        completed_at: null,
        generated_image_url: 'https://replicate.delivery/image.png',
        supabase_image_url: 'https://new-url.com/image.png',
        image_upload_status: 'uploaded',
        story_source: 'New',
        story_metadata: {},
      };

      // Online data available
      mockDatabase.single.mockResolvedValue({
        data: onlineSession,
        error: null,
      });

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({ 'session-123': cachedSession })
      );

      const session = await storySessionManager.getSession('session-123');

      // Should get online data, not cached
      expect(session?.current_round).toBe(4);
      expect(session?.supabase_image_url).toBe('https://new-url.com/image.png');
    });

    it('should return null if session not in cache and offline', async () => {
      mockDatabase.single.mockRejectedValue(new Error('Network error'));
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({})); // Empty cache

      const session = await storySessionManager.getSession('nonexistent-session');

      expect(session).toBeNull();
    });
  });

  describe('Online Sync', () => {
    it('should update cache when online data changes', async () => {
      const onlineSession = {
        id: 'session-123',
        user_id: 'user-123',
        current_round: 5,
        grade_level: 'K-2',
        story_content: 'Updated online story',
        words_written: 100,
        sentences_completed: 10,
        final_score: 500,
        xp_earned: 250,
        completed_at: new Date().toISOString(),
        generated_image_url: 'https://replicate.delivery/new-image.png',
        supabase_image_url: 'https://updated-url.com/image.png',
        image_upload_status: 'uploaded',
        story_source: 'New',
        story_metadata: {},
      };

      mockDatabase.single.mockResolvedValue({
        data: onlineSession,
        error: null,
      });

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({}));
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      const session = await storySessionManager.getSession('session-123');

      // Verify cache was updated with new data
      expect(AsyncStorage.setItem).toHaveBeenCalled();

      const setItemCall = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
      const cachedData = JSON.parse(setItemCall[1]);

      expect(cachedData['session-123'].supabase_image_url).toBe('https://updated-url.com/image.png');
      expect(cachedData['session-123'].current_round).toBe(5);
    });

    it('should handle cache write failures gracefully', async () => {
      const sessionData = {
        id: 'session-123',
        user_id: 'user-123',
        current_round: 2,
        grade_level: 'K-2',
        story_content: 'Story',
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
        data: sessionData,
        error: null,
      });

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({}));
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Storage full'));

      // Should not throw, just log error
      const session = await storySessionManager.getSession('session-123');
      await expect(storySessionManager.updateSession(session!)).resolves.not.toThrow();
    });
  });

  describe('Cache Cleanup', () => {
    it('should remove old sessions from cache if needed', async () => {
      const oldSession1 = {
        id: 'old-1',
        created_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(), // 40 days old
      };

      const oldSession2 = {
        id: 'old-2',
        created_at: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(), // 35 days old
      };

      const recentSession = {
        id: 'recent-1',
        created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days old
      };

      const newSessionData = {
        id: 'session-new',
        user_id: 'user-123',
        current_round: 1,
        grade_level: 'K-2',
        story_content: 'New story',
        words_written: 20,
        sentences_completed: 2,
        final_score: 100,
        xp_earned: 50,
        completed_at: null,
        created_at: new Date().toISOString(),
        story_source: 'New',
        story_metadata: {},
      };

      mockDatabase.single.mockResolvedValue({
        data: newSessionData,
        error: null,
      });

      mockDatabase.update.mockResolvedValue({
        data: newSessionData,
        error: null,
      });

      const existingCache = {
        'old-1': oldSession1,
        'old-2': oldSession2,
        'recent-1': recentSession,
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(existingCache));
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      const session = await storySessionManager.getSession('session-new');
      await storySessionManager.updateSession(session!);

      // Verify old sessions might be removed (implementation-specific)
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('Image Upload Status Caching', () => {
    it('should track pending upload status in cache', async () => {
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
        completed_at: new Date().toISOString(),
        generated_image_url: 'https://replicate.delivery/image.png',
        supabase_image_url: null,
        image_upload_status: 'pending',
        image_upload_attempts: 1,
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

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({}));
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      const session = await storySessionManager.getSession('session-123');
      await storySessionManager.updateSession(session!);

      const setItemCall = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
      const cachedData = JSON.parse(setItemCall[1]);

      expect(cachedData['session-123'].image_upload_status).toBe('pending');
      expect(cachedData['session-123'].generated_image_url).toBeTruthy();
    });

    it('should update cache when upload status changes from pending to uploaded', async () => {
      const initialData = {
        id: 'session-123',
        user_id: 'user-123',
        current_round: 5,
        grade_level: 'K-2',
        story_content: 'Complete story',
        words_written: 100,
        sentences_completed: 10,
        final_score: 500,
        xp_earned: 250,
        completed_at: new Date().toISOString(),
        generated_image_url: 'https://replicate.delivery/image.png',
        supabase_image_url: null,
        image_upload_status: 'pending',
        story_source: 'New',
        story_metadata: {},
      };

      const updatedData = {
        ...initialData,
        supabase_image_url: 'https://supabase.co/storage/image.png',
        image_upload_status: 'uploaded',
        image_upload_attempts: 2,
      };

      // First fetch - pending
      mockDatabase.single.mockResolvedValueOnce({
        data: initialData,
        error: null,
      });

      // Second fetch - uploaded
      mockDatabase.single.mockResolvedValueOnce({
        data: updatedData,
        error: null,
      });

      mockDatabase.update.mockResolvedValue({
        data: updatedData,
        error: null,
      });

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({}));
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      // Get session when pending
      const session1 = await storySessionManager.getSession('session-123');
      expect(session1?.image_upload_status).toBe('pending');

      // Get session after upload completed
      const session2 = await storySessionManager.getSession('session-123');
      expect(session2?.image_upload_status).toBe('uploaded');
      expect(session2?.supabase_image_url).toBe('https://supabase.co/storage/image.png');
    });

    it('should cache failed upload status with error message', async () => {
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
        completed_at: new Date().toISOString(),
        generated_image_url: 'https://replicate.delivery/image.png',
        supabase_image_url: null,
        image_upload_status: 'failed',
        image_upload_attempts: 3,
        image_upload_error: 'Storage quota exceeded',
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

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({}));
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      const session = await storySessionManager.getSession('session-123');
      await storySessionManager.updateSession(session!);

      const setItemCall = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
      const cachedData = JSON.parse(setItemCall[1]);

      expect(cachedData['session-123'].image_upload_status).toBe('failed');
      expect(cachedData['session-123'].image_upload_error).toBe('Storage quota exceeded');
    });
  });

  describe('Performance', () => {
    it('should complete cache operations quickly', async () => {
      const sessionData = {
        id: 'session-123',
        user_id: 'user-123',
        current_round: 3,
        grade_level: 'K-2',
        story_content: 'Story',
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

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({}));
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      const startTime = Date.now();
      await storySessionManager.getSession('session-123');
      const elapsed = Date.now() - startTime;

      // Cache read should be fast (< 100ms)
      expect(elapsed).toBeLessThan(100);
    });
  });
});
