/**
 * Image Generation Flow Integration Tests
 * Tests the complete image generation flow from user interaction to database updates
 */

import { imageGenerationService } from '../../services/imageGeneration';
import { supabase } from '../../services/supabase';
import { xpEventTracker } from '../../services/xpEventTracker';
import { storySessionManager } from '../../services/storySessionManager';
import type { ImageGenerationRequest, GradeLevel } from '../../types/database';

// Mock external dependencies
jest.mock('../../services/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

// Mock environment variables
jest.mock('react-native-dotenv', () => ({
  REPLICATE_API_TOKEN: 'test-replicate-token',
  BACKUP_IMAGE_API_TOKEN: 'test-backup-token',
  IMAGE_GENERATION_ENABLED: 'true',
}));

// Mock fetch for API calls
global.fetch = jest.fn();

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

// Mock modules that have actual implementations
jest.mock('../../services/xpEventTracker', () => ({
  xpEventTracker: {
    createImageGenerationEvent: jest.fn(),
    updateImageGenerationEvent: jest.fn(),
  },
}));

jest.mock('../../services/storySessionManager', () => ({
  storySessionManager: {
    updateSessionWithImage: jest.fn(),
  },
}));

const mockXpEventTracker = xpEventTracker as jest.Mocked<typeof xpEventTracker>;
const mockStorySessionManager = storySessionManager as jest.Mocked<
  typeof storySessionManager
>;

describe('Image Generation Flow - Integration Tests', () => {
  const testUserId = 'test-user-123';
  const testSessionId = 'test-session-456';
  const testEventId = 'test-event-789';

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default successful database responses
    const mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { total_xp: 2500 },
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValue(mockQueryBuilder as any);
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

    // Setup successful event tracking
    mockXpEventTracker.createImageGenerationEvent.mockResolvedValue({
      success: true,
      eventId: testEventId,
    });
    mockXpEventTracker.updateImageGenerationEvent.mockResolvedValue();

    // Setup successful session updates
    mockStorySessionManager.updateSessionWithImage.mockResolvedValue({
      id: testSessionId,
      generatedImageUrl: 'https://example.com/image.jpg',
      imageCost: 1000,
    });
  });

  describe('Complete Successful Flow', () => {
    test('should complete entire image generation workflow', async () => {
      // Mock successful Replicate API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'replicate-prediction-123',
          status: 'succeeded',
          output: ['https://replicate.example.com/generated-image.jpg'],
        }),
      } as any);

      const mockRequest: ImageGenerationRequest = {
        storyContent:
          'Once upon a time, there was a brave knight who discovered a magical forest filled with friendly creatures and embarked on an exciting adventure.',
        gradeLevel: 'K-2',
        sessionId: testSessionId,
        userId: testUserId,
        metadata: {
          wordCount: 150,
          storyTheme: 'adventure',
        },
      };

      const result = await imageGenerationService.generateImage(mockRequest);

      // Verify successful result
      expect(result.success).toBe(true);
      expect(result.imageUrl).toBe('https://example.com/generated-image.jpg');
      expect(result.serviceUsed).toBe('replicate');
      expect(result.responseTimeMs).toBeGreaterThan(0);

      // Verify XP balance was checked
      expect(mockSupabase.from).toHaveBeenCalledWith('user_profiles');

      // Verify XP was deducted
      expect(mockSupabase.rpc).toHaveBeenCalledWith('add_user_xp', {
        user_uuid: testUserId,
        xp_to_add: -1000,
      });

      // Verify event tracking was updated
      expect(
        mockXpEventTracker.createImageGenerationEvent,
      ).toHaveBeenCalledWith({
        userId: testUserId,
        sessionId: testSessionId,
        xpCost: 1000,
        storyGradeLevel: 'K-2',
        storyWordCount: 150,
        metadata: expect.objectContaining({
          storyTheme: 'adventure',
        }),
      });

      expect(
        mockXpEventTracker.updateImageGenerationEvent,
      ).toHaveBeenCalledWith(
        testEventId,
        'success',
        expect.objectContaining({
          imageUrl: 'https://example.com/generated-image.jpg',
          serviceUsed: 'replicate',
        }),
      );

      // Verify session was updated
      expect(
        mockStorySessionManager.updateSessionWithImage,
      ).toHaveBeenCalledWith(
        testSessionId,
        'https://example.com/generated-image.jpg',
        1000,
      );
    });

    test('should handle different grade levels in complete flow', async () => {
      const gradeLevels: GradeLevel[] = ['K-2', '3-5', '6-8', '9-12'];

      for (const gradeLevel of gradeLevels) {
        jest.clearAllMocks();

        // Reset mocks for each grade level
        const mockQueryBuilder = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { total_xp: 2500 },
            error: null,
          }),
        };
        mockSupabase.from.mockReturnValue(mockQueryBuilder as any);
        mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

        mockXpEventTracker.createImageGenerationEvent.mockResolvedValue({
          success: true,
          eventId: `${testEventId}-${gradeLevel}`,
        });

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'replicate-prediction-123',
            status: 'succeeded',
            output: [`https://replicate.example.com/image-${gradeLevel}.jpg`],
          }),
        } as any);

        const request: ImageGenerationRequest = {
          storyContent: `A ${gradeLevel} appropriate story with characters and adventure.`,
          gradeLevel,
          sessionId: `${testSessionId}-${gradeLevel}`,
          userId: testUserId,
          metadata: { wordCount: 100 },
        };

        const result = await imageGenerationService.generateImage(request);

        expect(result.success).toBe(true);
        expect(
          mockXpEventTracker.createImageGenerationEvent,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            storyGradeLevel: gradeLevel,
          }),
        );
      }
    });

    test('should maintain data consistency across all systems', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'replicate-prediction-consistency',
          status: 'succeeded',
          output: ['https://replicate.example.com/consistency-test.jpg'],
        }),
      } as any);

      const request: ImageGenerationRequest = {
        storyContent:
          'A consistency test story for data integrity verification.',
        gradeLevel: '3-5',
        sessionId: testSessionId,
        userId: testUserId,
        metadata: { wordCount: 75, testType: 'consistency' },
      };

      const result = await imageGenerationService.generateImage(request);

      // Verify all systems received consistent data
      const expectedImageUrl = 'https://example.com/generated-image.jpg';
      const expectedCost = 1000;

      expect(result.success).toBe(true);

      // Check that XP tracking received correct data
      expect(
        mockXpEventTracker.createImageGenerationEvent,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: testUserId,
          sessionId: testSessionId,
          xpCost: expectedCost,
          metadata: expect.objectContaining({
            testType: 'consistency',
          }),
        }),
      );

      // Check that session manager received correct data
      expect(
        mockStorySessionManager.updateSessionWithImage,
      ).toHaveBeenCalledWith(testSessionId, expectedImageUrl, expectedCost);

      // Check that event tracking was updated with correct success data
      expect(
        mockXpEventTracker.updateImageGenerationEvent,
      ).toHaveBeenCalledWith(
        testEventId,
        'success',
        expect.objectContaining({
          imageUrl: expectedImageUrl,
          serviceUsed: 'replicate',
          apiResponseTime: expect.any(Number),
        }),
      );
    });
  });

  describe('Backup Service Failover Flow', () => {
    test('should successfully failover to backup service', async () => {
      // Mock Replicate API failure
      mockFetch
        .mockRejectedValueOnce(new Error('Replicate service unavailable'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              {
                url: 'https://dalle.openai.com/backup-generated-image.jpg',
              },
            ],
          }),
        } as any);

      const request: ImageGenerationRequest = {
        storyContent: 'A failover test story that should use backup service.',
        gradeLevel: 'K-2',
        sessionId: testSessionId,
        userId: testUserId,
        metadata: { wordCount: 80, testType: 'failover' },
      };

      const result = await imageGenerationService.generateImage(request);

      expect(result.success).toBe(true);
      expect(result.serviceUsed).toBe('backup_service');
      expect(result.imageUrl).toBe(
        'https://dalle.openai.com/backup-generated-image.jpg',
      );

      // Verify failover was tracked
      expect(
        mockXpEventTracker.updateImageGenerationEvent,
      ).toHaveBeenCalledWith(
        testEventId,
        'success',
        expect.objectContaining({
          serviceUsed: 'backup_service',
          imageUrl: 'https://dalle.openai.com/backup-generated-image.jpg',
        }),
      );

      // Verify no XP refund occurred (since generation succeeded)
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(1); // Only the deduction, no refund
    });

    test('should handle complete service failure with XP refund', async () => {
      // Mock both services failing
      mockFetch
        .mockRejectedValueOnce(new Error('Replicate service unavailable'))
        .mockRejectedValueOnce(new Error('Backup service also unavailable'));

      const request: ImageGenerationRequest = {
        storyContent:
          'A test story that will experience complete service failure.',
        gradeLevel: '6-8',
        sessionId: testSessionId,
        userId: testUserId,
        metadata: { wordCount: 90, testType: 'complete_failure' },
      };

      const result = await imageGenerationService.generateImage(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Both primary and backup');
      expect(result.errorType).toBe('api_failure');

      // Verify XP was refunded
      expect(mockSupabase.rpc).toHaveBeenCalledWith('add_user_xp', {
        user_uuid: testUserId,
        xp_to_add: 1000, // Refund amount
      });

      // Verify failure was tracked
      expect(
        mockXpEventTracker.updateImageGenerationEvent,
      ).toHaveBeenCalledWith(
        testEventId,
        'failed',
        expect.objectContaining({
          errorType: 'api_failure',
          serviceUsed: 'replicate',
        }),
      );

      // Verify session was not updated with image
      expect(
        mockStorySessionManager.updateSessionWithImage,
      ).not.toHaveBeenCalled();
    });

    test('should handle partial service degradation gracefully', async () => {
      // Mock Replicate timeout, then successful backup
      mockFetch
        .mockImplementationOnce(
          () =>
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Request timeout')), 100),
            ),
        )
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              {
                url: 'https://dalle.openai.com/degraded-service-image.jpg',
              },
            ],
          }),
        } as any);

      const request: ImageGenerationRequest = {
        storyContent: 'A story to test service degradation handling.',
        gradeLevel: '9-12',
        sessionId: testSessionId,
        userId: testUserId,
        metadata: { wordCount: 120, testType: 'degradation' },
      };

      const result = await imageGenerationService.generateImage(request);

      expect(result.success).toBe(true);
      expect(result.serviceUsed).toBe('backup_service');
      expect(result.responseTimeMs).toBeGreaterThan(100); // Should account for timeout + backup call

      // Verify the degraded service scenario was handled properly
      expect(
        mockXpEventTracker.updateImageGenerationEvent,
      ).toHaveBeenCalledWith(
        testEventId,
        'success',
        expect.objectContaining({
          serviceUsed: 'backup_service',
          apiResponseTime: expect.any(Number),
        }),
      );
    });
  });

  describe('Database Operations Integration', () => {
    test('should handle XP balance check failures gracefully', async () => {
      // Mock XP balance check failure
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'User not found' },
        }),
      };
      mockSupabase.from.mockReturnValue(mockQueryBuilder as any);

      const request: ImageGenerationRequest = {
        storyContent: 'A story for testing XP balance failures.',
        gradeLevel: 'K-2',
        sessionId: testSessionId,
        userId: 'non-existent-user',
        metadata: { wordCount: 60 },
      };

      const result = await imageGenerationService.generateImage(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to check XP balance');

      // Verify no XP deduction attempted
      expect(mockSupabase.rpc).not.toHaveBeenCalledWith(
        'add_user_xp',
        expect.any(Object),
      );

      // Verify no image generation attempted
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('should handle XP deduction failures', async () => {
      // Mock successful balance check but failed deduction
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Insufficient XP' },
      });

      const request: ImageGenerationRequest = {
        storyContent: 'A story for testing XP deduction failures.',
        gradeLevel: '3-5',
        sessionId: testSessionId,
        userId: testUserId,
        metadata: { wordCount: 65 },
      };

      const result = await imageGenerationService.generateImage(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('XP deduction failed');

      // Verify no image generation attempted
      expect(mockFetch).not.toHaveBeenCalled();

      // Verify event was still created and updated with failure
      expect(mockXpEventTracker.createImageGenerationEvent).toHaveBeenCalled();
      expect(
        mockXpEventTracker.updateImageGenerationEvent,
      ).toHaveBeenCalledWith(testEventId, 'failed', expect.any(Object));
    });

    test('should handle event tracking failures without breaking flow', async () => {
      // Mock event tracking failure
      mockXpEventTracker.createImageGenerationEvent.mockRejectedValue(
        new Error('Event tracking service unavailable'),
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'replicate-prediction-robust',
          status: 'succeeded',
          output: ['https://replicate.example.com/robust-image.jpg'],
        }),
      } as any);

      const request: ImageGenerationRequest = {
        storyContent:
          'A story to test robustness against event tracking failures.',
        gradeLevel: '6-8',
        sessionId: testSessionId,
        userId: testUserId,
        metadata: { wordCount: 85 },
      };

      const result = await imageGenerationService.generateImage(request);

      // Should still succeed despite event tracking failure
      expect(result.success).toBe(true);
      expect(result.imageUrl).toBe('https://example.com/generated-image.jpg');

      // Verify other systems still worked
      expect(mockSupabase.rpc).toHaveBeenCalledWith('add_user_xp', {
        user_uuid: testUserId,
        xp_to_add: -1000,
      });

      expect(mockStorySessionManager.updateSessionWithImage).toHaveBeenCalled();
    });

    test('should maintain transaction integrity during failures', async () => {
      // Mock session update failure after successful image generation
      mockStorySessionManager.updateSessionWithImage.mockRejectedValue(
        new Error('Session update failed'),
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'replicate-prediction-transaction',
          status: 'succeeded',
          output: ['https://replicate.example.com/transaction-test.jpg'],
        }),
      } as any);

      const request: ImageGenerationRequest = {
        storyContent: 'A story to test transaction integrity.',
        gradeLevel: '9-12',
        sessionId: testSessionId,
        userId: testUserId,
        metadata: { wordCount: 95 },
      };

      const result = await imageGenerationService.generateImage(request);

      // Should still report success since image was generated
      expect(result.success).toBe(true);
      expect(result.imageUrl).toBe('https://example.com/generated-image.jpg');

      // Verify XP was deducted (not refunded due to successful generation)
      expect(mockSupabase.rpc).toHaveBeenCalledWith('add_user_xp', {
        user_uuid: testUserId,
        xp_to_add: -1000,
      });

      // Verify event tracking still recorded success
      expect(
        mockXpEventTracker.updateImageGenerationEvent,
      ).toHaveBeenCalledWith(testEventId, 'success', expect.any(Object));
    });
  });

  describe('Error Recovery and Resilience', () => {
    test('should handle network connectivity issues', async () => {
      // Mock network error
      mockFetch.mockRejectedValue(new Error('Network request failed'));

      const request: ImageGenerationRequest = {
        storyContent: 'A story to test network error handling.',
        gradeLevel: 'K-2',
        sessionId: testSessionId,
        userId: testUserId,
        metadata: { wordCount: 70 },
      };

      const result = await imageGenerationService.generateImage(request);

      expect(result.success).toBe(false);
      expect(result.errorType).toBe('api_failure');

      // Verify XP was refunded
      expect(mockSupabase.rpc).toHaveBeenCalledWith('add_user_xp', {
        user_uuid: testUserId,
        xp_to_add: 1000,
      });

      // Verify error was properly tracked
      expect(
        mockXpEventTracker.updateImageGenerationEvent,
      ).toHaveBeenCalledWith(
        testEventId,
        'failed',
        expect.objectContaining({
          errorType: 'api_failure',
        }),
      );
    });

    test('should handle concurrent request limits', async () => {
      // This test would require more complex setup to test the actual rate limiting
      // For now, test that the service handles rate limit responses correctly

      mockFetch.mockRejectedValue(new Error('Rate limit exceeded'));

      const request: ImageGenerationRequest = {
        storyContent: 'A story to test rate limiting.',
        gradeLevel: '3-5',
        sessionId: testSessionId,
        userId: testUserId,
        metadata: { wordCount: 55 },
      };

      const result = await imageGenerationService.generateImage(request);

      expect(result.success).toBe(false);
      expect(result.errorType).toBe('api_failure'); // Rate limit errors are classified as API failures

      // Verify proper error handling and XP refund
      expect(mockSupabase.rpc).toHaveBeenCalledWith('add_user_xp', {
        user_uuid: testUserId,
        xp_to_add: 1000,
      });
    });

    test('should handle malformed API responses gracefully', async () => {
      // Mock malformed response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          // Missing required fields
          id: 'malformed-response',
          status: 'succeeded',
          // output is missing
        }),
      } as any);

      const request: ImageGenerationRequest = {
        storyContent: 'A story to test malformed response handling.',
        gradeLevel: '6-8',
        sessionId: testSessionId,
        userId: testUserId,
        metadata: { wordCount: 88 },
      };

      const result = await imageGenerationService.generateImage(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No output generated');

      // Verify XP refund for malformed response
      expect(mockSupabase.rpc).toHaveBeenCalledWith('add_user_xp', {
        user_uuid: testUserId,
        xp_to_add: 1000,
      });
    });
  });
});
