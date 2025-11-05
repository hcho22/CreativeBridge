/**
 * StorySessionManager Image Storage Test Suite
 * Tests for Tasks 6.3: Image storage linking to specific stories
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

// Mock Supabase
jest.mock('../../services/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => ({
            data: {
              id: 'test-session-123',
              user_id: 'user-123',
              created_at: '2024-01-01T00:00:00Z',
              grade_level: 'K-2',
              final_score: 0,
              words_written: 0,
              sentences_completed: 0,
              challenges_completed: 0,
              xp_earned: 0,
              story_content: '',
            },
            error: null,
          })),
        })),
      })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => ({
            data: {
              id: 'test-session-123',
              user_id: 'user-123',
              created_at: '2024-01-01T00:00:00Z',
              grade_level: 'K-2',
              final_score: 0,
              words_written: 0,
              sentences_completed: 0,
              challenges_completed: 0,
              xp_earned: 0,
              story_content: 'Test story content',
              generated_image_url: null,
              image_generation_timestamp: null,
              image_generation_cost: null,
            },
            error: null,
          })),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => ({
              data: {
                id: 'test-session-123',
                user_id: 'user-123',
                created_at: '2024-01-01T00:00:00Z',
                grade_level: 'K-2',
                final_score: 0,
                words_written: 50,
                sentences_completed: 0,
                challenges_completed: 0,
                xp_earned: 0,
                story_content: 'Test story content',
                generated_image_url: 'https://example.com/image.jpg',
                image_generation_timestamp: '2024-01-01T01:00:00Z',
                image_generation_cost: 1000,
              },
              error: null,
            })),
          })),
        })),
      })),
    })),
  },
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('StorySessionManager Image Storage - Task 6.3', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue(undefined);
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

      const result = await storySessionManager.getSessionWithImage(
        'test-session-123',
      );

      expect(result.hasLocalImage).toBe(true);
      expect(result.localImagePath).toBe('/local/path/image.jpg');
    });

    test('should return proper structure for non-existent session', async () => {
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

      // Get final session state
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
      expect(result?.image_generation_timestamp).toBeGreaterThanOrEqual(
        beforeUpdate,
      );
      expect(result?.image_generation_timestamp).toBeLessThanOrEqual(
        afterUpdate,
      );
    });
  });
});
