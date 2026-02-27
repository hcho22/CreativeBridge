/**
 * StorySessionManager Image Storage Test Suite
 * Tests for Tasks 6.3: Image storage linking to specific stories
 *
 * Updated for US-013: All tests now use Convex mocks (Supabase removed).
 */

import { storySessionManager } from '../../services/storySessionManager';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  multiRemove: jest.fn(),
}));

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

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

/**
 * Helper to create a mock Convex game session document.
 */
function mockConvexSession(overrides: Record<string, any> = {}) {
  return {
    _id: 'test-session-123',
    _creationTime: new Date('2024-01-01T00:00:00Z').getTime(),
    userId: 'user_test123',
    clerkUserId: 'user_test123',
    gradeLevel: 'K-2',
    storyContent: 'Test story content',
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

describe('StorySessionManager Image Storage - Task 6.3', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isConvexReady as jest.Mock).mockReturnValue(true);
    (getConvexClient as jest.Mock).mockReturnValue(mockConvexClient);
    mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify({}));
    mockAsyncStorage.setItem.mockResolvedValue(undefined);
    mockConvexClient.mutation.mockResolvedValue(undefined);
    // Return a valid session for getSession queries
    mockConvexClient.query.mockResolvedValue(mockConvexSession());
    storySessionManager.clearCache();
  });

  describe('updateSessionWithImage', () => {
    test('should update session with generated image URL and cost', async () => {
      const imageUrl = 'https://example.com/generated-image.jpg';
      const cost = 1000;

      const result = await storySessionManager.updateSessionWithImage(
        'test-session-123',
        imageUrl,
        cost,
      );

      expect(result).toBeDefined();
      expect(result?.generated_image_url).toBe(imageUrl);
      expect(result?.image_generation_cost).toBe(cost);
      expect(result?.image_generation_timestamp).toBeDefined();
    });

    test('should update session with image URL and local path', async () => {
      const imageUrl = 'https://example.com/generated-image.jpg';
      const localPath = '/local/path/to/image.jpg';
      const cost = 1000;

      const result = await storySessionManager.updateSessionWithImage(
        'test-session-123',
        imageUrl,
        cost,
        localPath,
      );

      expect(result).toBeDefined();
      expect(result?.generated_image_url).toBe(imageUrl);
      expect(result?.local_image_path).toBe(localPath);
      expect(result?.image_generation_cost).toBe(cost);
    });

    test('should return null for non-existent session', async () => {
      // Return null for non-existent session
      mockConvexClient.query.mockResolvedValueOnce(null);

      const result = await storySessionManager.updateSessionWithImage(
        'non-existent-session',
        'https://example.com/image.jpg',
        1000,
      );

      expect(result).toBeNull();
    });
  });

  describe('updateSessionWithLocalImage', () => {
    test('should update session with local image path', async () => {
      const localPath = '/downloaded/images/story_image.jpg';

      const result = await storySessionManager.updateSessionWithLocalImage(
        'test-session-123',
        localPath,
      );

      expect(result).toBeDefined();
      expect(result?.local_image_path).toBe(localPath);
    });

    test('should return null for non-existent session', async () => {
      mockConvexClient.query.mockResolvedValueOnce(null);

      const result = await storySessionManager.updateSessionWithLocalImage(
        'non-existent-session',
        '/path/to/image.jpg',
      );

      expect(result).toBeNull();
    });
  });

  describe('getSessionWithImage', () => {
    test('should return session data with image information', async () => {
      const result = await storySessionManager.getSessionWithImage(
        'test-session-123',
      );

      expect(result).toBeDefined();
      expect(result.session).toBeDefined();
      expect(result.hasGeneratedImage).toBe(false); // No image URL in mock
      expect(result.hasLocalImage).toBe(false); // No local path in mock
    });

    test('should detect generated image when URL exists', async () => {
      // First update session with image
      await storySessionManager.updateSessionWithImage(
        'test-session-123',
        'https://example.com/image.jpg',
        1000,
      );

      // Return session with image data for subsequent query
      mockConvexClient.query.mockResolvedValueOnce(
        mockConvexSession({
          generatedImageUrl: 'https://example.com/image.jpg',
          imageGenerationCost: 1000,
        }),
      );

      const result = await storySessionManager.getSessionWithImage(
        'test-session-123',
      );

      expect(result.hasGeneratedImage).toBe(true);
      expect(result.imageUrl).toBe('https://example.com/image.jpg');
    });

    test('should detect local image when path exists', async () => {
      // First update session with local image
      await storySessionManager.updateSessionWithLocalImage(
        'test-session-123',
        '/local/path/image.jpg',
      );

      // The local path is stored in local cache, which getSessionWithImage reads from
      // The in-memory cache should have the updated session
      const result = await storySessionManager.getSessionWithImage(
        'test-session-123',
      );

      expect(result.hasLocalImage).toBe(true);
      expect(result.localImagePath).toBe('/local/path/image.jpg');
    });

    test('should return proper structure for non-existent session', async () => {
      mockConvexClient.query.mockResolvedValueOnce(null);

      const result = await storySessionManager.getSessionWithImage(
        'non-existent',
      );

      expect(result).toEqual({
        session: null,
        hasGeneratedImage: false,
        hasLocalImage: false,
      });
    });
  });

  describe('Image data persistence', () => {
    test('should persist image data across session updates', async () => {
      // Update with image
      const imageUrl = 'https://example.com/test-image.jpg';
      await storySessionManager.updateSessionWithImage(
        'test-session-123',
        imageUrl,
        1000,
      );

      // Update with local path
      const localPath = '/local/downloads/image.jpg';
      await storySessionManager.updateSessionWithLocalImage(
        'test-session-123',
        localPath,
      );

      // Get final session state - should have both from in-memory cache
      const result = await storySessionManager.getSessionWithImage(
        'test-session-123',
      );

      expect(result.hasGeneratedImage).toBe(true);
      expect(result.hasLocalImage).toBe(true);
      expect(result.imageUrl).toBe(imageUrl);
      expect(result.localImagePath).toBe(localPath);
    });

    test('should maintain image data when adding story contributions', async () => {
      // First add image data
      await storySessionManager.updateSessionWithImage(
        'test-session-123',
        'https://example.com/image.jpg',
        1000,
      );

      // Then add a story contribution (this should not affect image data)
      // Clear cache to force re-fetch, then return session with image
      storySessionManager.clearCache();
      mockConvexClient.query.mockResolvedValueOnce(
        mockConvexSession({
          generatedImageUrl: 'https://example.com/image.jpg',
          imageGenerationCost: 1000,
          storyContent: 'Test story content',
        }),
      );

      await storySessionManager.addContribution(
        'test-session-123',
        'user',
        'This is a test contribution.',
      );

      // Verify image data is still there
      const result = await storySessionManager.getSessionWithImage(
        'test-session-123',
      );
      expect(result.hasGeneratedImage).toBe(true);
      expect(result.imageUrl).toBe('https://example.com/image.jpg');
    });
  });

  describe('Image cost tracking', () => {
    test('should track image generation cost', async () => {
      const customCost = 1500;

      const result = await storySessionManager.updateSessionWithImage(
        'test-session-123',
        'https://example.com/image.jpg',
        customCost,
      );

      expect(result?.image_generation_cost).toBe(customCost);
    });

    test('should use default cost when not specified', async () => {
      const result = await storySessionManager.updateSessionWithImage(
        'test-session-123',
        'https://example.com/image.jpg',
      );

      expect(result?.image_generation_cost).toBe(1000); // Default cost
    });
  });

  describe('Timestamp tracking', () => {
    test('should set image generation timestamp', async () => {
      const beforeUpdate = new Date().toISOString();

      const result = await storySessionManager.updateSessionWithImage(
        'test-session-123',
        'https://example.com/image.jpg',
        1000,
      );

      const afterUpdate = new Date().toISOString();

      expect(result?.image_generation_timestamp).toBeDefined();
      expect(result?.image_generation_timestamp! >= beforeUpdate).toBeTruthy();
      expect(result?.image_generation_timestamp! <= afterUpdate).toBeTruthy();
    });
  });
});
