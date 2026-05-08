/**
 * XP Event Tracker Test Suite
 * Tests for XP tracking and analytics for image generation events
 *
 * Updated for US-011: All tests now use Convex mocks (Supabase removed).
 */

import { xpEventTracker } from '../../services/xpEventTracker';
import { redactId } from '../../utils/piiRedaction';

// Mock Convex client
const mockConvexClient = {
  mutation: jest.fn(),
  query: jest.fn(),
};

jest.mock('../../services/convex', () => ({
  getConvexClient: jest.fn(() => mockConvexClient),
  isConvexReady: jest.fn(() => true),
  api: {
    imageGeneration: {
      createImageGenerationEvent: 'imageGeneration:createImageGenerationEvent',
      updateImageGenerationEvent: 'imageGeneration:updateImageGenerationEvent',
      refundImageGenerationEvent: 'imageGeneration:refundImageGenerationEvent',
      checkXpForImageGeneration: 'imageGeneration:checkXpForImageGeneration',
      getImageGenerationAnalytics:
        'imageGeneration:getImageGenerationAnalytics',
      getUserImageGenerationEvents:
        'imageGeneration:getUserImageGenerationEvents',
    },
  },
}));

const { isConvexReady, getConvexClient } = require('../../services/convex');

describe('XP Event Tracker Service', () => {
  const mockUserId = 'user_test123';
  const mockSessionId = 'session456abc';

  beforeEach(() => {
    jest.clearAllMocks();
    (isConvexReady as jest.Mock).mockReturnValue(true);
    (getConvexClient as jest.Mock).mockReturnValue(mockConvexClient);
  });

  describe('Image Generation Event Creation', () => {
    test('should create image generation event via Convex', async () => {
      const mockEventId = 'evt789abc';
      mockConvexClient.mutation.mockResolvedValueOnce({
        eventId: mockEventId,
        xpDeducted: 1000,
      });

      const eventData = {
        userId: mockUserId,
        sessionId: mockSessionId,
        xpCost: 1000,
        storyGradeLevel: 'K-2',
        storyWordCount: 150,
        metadata: { test: true },
      };

      const result = await xpEventTracker.createImageGenerationEvent(eventData);

      expect(result.success).toBe(true);
      expect(result.eventId).toBe(mockEventId);
      expect(mockConvexClient.mutation).toHaveBeenCalledWith(
        'imageGeneration:createImageGenerationEvent',
        {
          clerkUserId: mockUserId,
          sessionId: mockSessionId,
          xpCost: 1000,
          serviceUsed: 'replicate',
          storyGradeLevel: 'K-2',
          storyWordCount: 150,
          metadata: { test: true, storyCompleted: undefined },
        },
      );
    });

    test('should return error when Convex is not ready', async () => {
      (isConvexReady as jest.Mock).mockReturnValue(false);

      const eventData = {
        userId: mockUserId,
        sessionId: mockSessionId,
        xpCost: 1000,
      };

      const result = await xpEventTracker.createImageGenerationEvent(eventData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database not available');
    });

    test('should return error when Convex client is unavailable', async () => {
      (getConvexClient as jest.Mock).mockReturnValue(null);

      const eventData = {
        userId: mockUserId,
        sessionId: mockSessionId,
        xpCost: 1000,
      };

      const result = await xpEventTracker.createImageGenerationEvent(eventData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database client unavailable');
    });

    test('should handle Convex mutation exceptions', async () => {
      mockConvexClient.mutation.mockRejectedValueOnce(
        new Error('Convex mutation failed'),
      );

      const eventData = {
        userId: mockUserId,
        sessionId: mockSessionId,
        xpCost: 1000,
      };

      const result = await xpEventTracker.createImageGenerationEvent(eventData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to create image generation event');
    });
  });

  describe('Image Generation Event Updates', () => {
    test('should update event status via Convex', async () => {
      const eventId = 'evt789abc';
      mockConvexClient.mutation.mockResolvedValueOnce({
        finalStatus: 'success',
        refunded: false,
        refundAmount: 0,
      });

      const result = await xpEventTracker.updateImageGenerationEvent(
        eventId,
        'success',
        {
          imageUrl: 'https://example.com/image.jpg',
          serviceUsed: 'replicate',
          apiResponseTime: 45000,
          promptUsed: 'A beautiful story illustration',
        },
      );

      expect(result.success).toBe(true);
      expect(result.eventId).toBe(eventId);
      expect(mockConvexClient.mutation).toHaveBeenCalledWith(
        'imageGeneration:updateImageGenerationEvent',
        {
          eventId,
          generationStatus: 'success',
          imageUrl: 'https://example.com/image.jpg',
          errorType: undefined,
          apiResponseTime: 45000,
          promptUsed: 'A beautiful story illustration',
        },
      );
    });

    test('should update event with failure status and error type', async () => {
      const eventId = 'evt789abc';
      mockConvexClient.mutation.mockResolvedValueOnce({
        finalStatus: 'failed',
        refunded: false,
        refundAmount: 0,
      });

      const result = await xpEventTracker.updateImageGenerationEvent(
        eventId,
        'failed',
        {
          errorType: 'api_failure',
          serviceUsed: 'backup_service',
          apiResponseTime: 65000,
        },
      );

      expect(result.success).toBe(true);
      expect(mockConvexClient.mutation).toHaveBeenCalledWith(
        'imageGeneration:updateImageGenerationEvent',
        {
          eventId,
          generationStatus: 'failed',
          imageUrl: undefined,
          errorType: 'api_failure',
          apiResponseTime: 65000,
          promptUsed: undefined,
        },
      );
    });

    test('should return error when Convex is not ready', async () => {
      (isConvexReady as jest.Mock).mockReturnValue(false);

      const result = await xpEventTracker.updateImageGenerationEvent(
        'evt789abc',
        'success',
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database not available');
    });

    test('should handle Convex mutation exceptions during update', async () => {
      mockConvexClient.mutation.mockRejectedValueOnce(
        new Error('Update failed'),
      );

      const result = await xpEventTracker.updateImageGenerationEvent(
        'evt789abc',
        'success',
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to update image generation event');
    });
  });

  describe('XP Event Tracking', () => {
    test('should track XP deduction with proper logging', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const eventData = {
        userId: mockUserId,
        sessionId: mockSessionId,
        xpAmount: 1000,
        eventType: 'deduction' as const,
        reason: 'Image generation attempt',
        imageGenerationEventId: 'evt123abc',
        metadata: { test: true },
      };

      await xpEventTracker.trackXPDeduction(eventData);

      expect(consoleSpy).toHaveBeenCalledWith(
        '💸 Tracking XP deduction:',
        expect.objectContaining({
          uid: redactId(mockUserId),
          xpAmount: 1000,
          reason: 'Image generation attempt',
          imageGenerationEventId: 'evt123abc',
        }),
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '📝 XP Event Audit Log:',
        expect.objectContaining({
          type: 'XP_DEDUCTION',
          userId: mockUserId,
          xpAmount: 1000,
          reason: 'Image generation attempt',
        }),
      );

      consoleSpy.mockRestore();
    });

    test('should track XP refund and update event status via Convex', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Mock the refund mutation
      mockConvexClient.mutation
        .mockResolvedValueOnce({
          refundAmount: 1000,
          newBalance: 2000,
        })
        // Mock the updateImageGenerationEvent call from within trackXPRefund
        .mockResolvedValueOnce({
          finalStatus: 'refunded',
          refunded: true,
          refundAmount: 1000,
        });

      const eventData = {
        userId: mockUserId,
        sessionId: mockSessionId,
        xpAmount: 1000,
        eventType: 'refund' as const,
        reason: 'API timeout failure',
        imageGenerationEventId: 'evt123abc',
      };

      await xpEventTracker.trackXPRefund(eventData);

      expect(consoleSpy).toHaveBeenCalledWith(
        '💰 Tracking XP refund:',
        expect.objectContaining({
          uid: redactId(mockUserId),
          xpAmount: 1000,
          reason: 'API timeout failure',
        }),
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '📝 XP Refund Audit Log:',
        expect.objectContaining({
          type: 'XP_REFUND',
          userId: mockUserId,
          xpAmount: 1000,
        }),
      );

      // Should call refund mutation
      expect(mockConvexClient.mutation).toHaveBeenCalledWith(
        'imageGeneration:refundImageGenerationEvent',
        { eventId: 'evt123abc' },
      );

      // Should also call update mutation for status change
      expect(mockConvexClient.mutation).toHaveBeenCalledWith(
        'imageGeneration:updateImageGenerationEvent',
        expect.objectContaining({
          eventId: 'evt123abc',
          generationStatus: 'refunded',
          errorType: 'timeout',
        }),
      );

      consoleSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    test('should handle already-refunded events gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Mock refund mutation to throw "already refunded"
      mockConvexClient.mutation
        .mockRejectedValueOnce(new Error('Event already refunded'))
        // Mock the updateImageGenerationEvent call
        .mockResolvedValueOnce({
          finalStatus: 'refunded',
          refunded: true,
          refundAmount: 0,
        });

      const eventData = {
        userId: mockUserId,
        xpAmount: 1000,
        eventType: 'refund' as const,
        reason: 'API timeout failure',
        imageGenerationEventId: 'evt123abc',
      };

      await xpEventTracker.trackXPRefund(eventData);

      // Should log the "already refunded" message
      expect(consoleSpy).toHaveBeenCalledWith(
        'ℹ️ Event already refunded in Convex',
      );

      consoleSpy.mockRestore();
    });

    test('should track XP validation events with Convex XP check', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      mockConvexClient.query.mockResolvedValueOnce({
        currentBalance: 1500,
        shortfall: 0,
      });

      await xpEventTracker.trackXPValidation(
        mockUserId,
        1000,
        1500,
        true,
        'image_generation',
      );

      expect(mockConvexClient.query).toHaveBeenCalledWith(
        'imageGeneration:checkXpForImageGeneration',
        {
          clerkUserId: mockUserId,
          requiredXp: 1000,
        },
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '🔍 XP Validation Event:',
        expect.objectContaining({
          type: 'XP_VALIDATION',
          userId: mockUserId,
          requiredXP: 1000,
          currentXP: 1500,
          validationResult: true,
          context: 'image_generation',
          shortfall: 0,
        }),
      );

      consoleSpy.mockRestore();
    });

    test('should track validation failure with shortfall from Convex', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      mockConvexClient.query.mockResolvedValueOnce({
        currentBalance: 750,
        shortfall: 250,
      });

      await xpEventTracker.trackXPValidation(
        mockUserId,
        1000,
        750,
        false,
        'image_generation',
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '🔍 XP Validation Event:',
        expect.objectContaining({
          validationResult: false,
          currentXP: 750,
          shortfall: 250,
        }),
      );

      consoleSpy.mockRestore();
    });

    test('should fall back to provided XP values when Convex query fails', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      mockConvexClient.query.mockRejectedValueOnce(
        new Error('Convex query failed'),
      );

      await xpEventTracker.trackXPValidation(
        mockUserId,
        1000,
        750,
        false,
        'image_generation',
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '🔍 XP Validation Event:',
        expect.objectContaining({
          currentXP: 750,
          shortfall: 250,
        }),
      );

      consoleSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('Analytics and Reporting', () => {
    test('should fetch XP analytics from Convex', async () => {
      const mockAnalytics = {
        totalAttempts: 10,
        successfulGenerations: 8,
        failedGenerations: 2,
        totalXpSpent: 8000,
        avgResponseTime: 42.5,
      };

      mockConvexClient.query.mockResolvedValueOnce(mockAnalytics);

      const result = await xpEventTracker.getXPAnalytics(
        mockUserId,
        '2024-01-01',
        '2024-01-31',
      );

      expect(result).toEqual(mockAnalytics);
      expect(mockConvexClient.query).toHaveBeenCalledWith(
        'imageGeneration:getImageGenerationAnalytics',
        {
          clerkUserId: mockUserId,
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
      );
    });

    test('should return null when Convex is not ready for analytics', async () => {
      (isConvexReady as jest.Mock).mockReturnValue(false);

      const result = await xpEventTracker.getXPAnalytics(mockUserId);

      expect(result).toBeNull();
    });

    test('should handle Convex analytics query exceptions', async () => {
      mockConvexClient.query.mockRejectedValueOnce(
        new Error('Analytics query failed'),
      );

      const result = await xpEventTracker.getXPAnalytics(mockUserId);

      expect(result).toBeNull();
    });

    test('should fetch user events from Convex', async () => {
      const mockEvents = [
        {
          id: 'evt1abc',
          createdAt: '2024-01-01T10:00:00Z',
          completedAt: '2024-01-01T10:01:00Z',
          sessionId: 'session1',
          xpCost: 1000,
          generationStatus: 'success',
          errorType: null,
          serviceUsed: 'replicate',
          apiResponseTime: 45000,
          imageUrl: 'https://example.com/img1.jpg',
          storyGradeLevel: 'K-2',
          storyWordCount: 150,
          promptUsed: 'A colorful scene',
        },
        {
          id: 'evt2abc',
          createdAt: '2024-01-02T11:00:00Z',
          completedAt: null,
          sessionId: 'session2',
          xpCost: 1000,
          generationStatus: 'failed',
          errorType: 'api_failure',
          serviceUsed: 'replicate',
          apiResponseTime: 65000,
          imageUrl: null,
          storyGradeLevel: '3-5',
          storyWordCount: 200,
          promptUsed: 'An adventure scene',
        },
      ];

      mockConvexClient.query.mockResolvedValueOnce(mockEvents);

      const result = await xpEventTracker.getUserImageGenerationEvents(
        mockUserId,
        10,
        0,
      );

      // Should convert Convex camelCase to legacy snake_case format
      expect(result).toEqual([
        expect.objectContaining({
          id: 'evt1abc',
          created_at: '2024-01-01T10:00:00Z',
          xp_cost: 1000,
          generation_status: 'success',
        }),
        expect.objectContaining({
          id: 'evt2abc',
          created_at: '2024-01-02T11:00:00Z',
          xp_cost: 1000,
          generation_status: 'failed',
        }),
      ]);

      expect(mockConvexClient.query).toHaveBeenCalledWith(
        'imageGeneration:getUserImageGenerationEvents',
        {
          limit: 10,
          offset: 0,
        },
      );
    });

    test('should return empty array when Convex is not ready for events', async () => {
      (isConvexReady as jest.Mock).mockReturnValue(false);

      const result = await xpEventTracker.getUserImageGenerationEvents(
        mockUserId,
      );

      expect(result).toEqual([]);
    });

    test('should handle Convex events query exceptions', async () => {
      mockConvexClient.query.mockRejectedValueOnce(
        new Error('Events query failed'),
      );

      const result = await xpEventTracker.getUserImageGenerationEvents(
        mockUserId,
      );

      expect(result).toEqual([]);
    });

    test('should generate XP usage report correctly', () => {
      const mockEvents = [
        { xp_cost: 1000, generation_status: 'success' },
        { xp_cost: 1000, generation_status: 'success' },
        { xp_cost: 1000, generation_status: 'failed' },
        { xp_cost: 1000, generation_status: 'refunded' },
      ];

      const report = xpEventTracker.generateXPUsageReport(mockEvents);

      expect(report).toEqual({
        totalXPSpent: 4000,
        totalGenerations: 4,
        successfulGenerations: 2,
        failedGenerations: 1,
        refundedXP: 1000,
        averageCostPerGeneration: 1000,
        successRate: 0.5,
      });
    });

    test('should handle empty events array in report generation', () => {
      const report = xpEventTracker.generateXPUsageReport([]);

      expect(report).toEqual({
        totalXPSpent: 0,
        totalGenerations: 0,
        successfulGenerations: 0,
        failedGenerations: 0,
        refundedXP: 0,
        averageCostPerGeneration: 0,
        successRate: 0,
      });
    });
  });

  describe('XP Cost Calculation', () => {
    test('should calculate base XP cost correctly', () => {
      const cost = xpEventTracker.calculateXPCost();
      expect(cost).toBe(1000);
    });

    test('should calculate XP cost with context parameters', () => {
      const cost = xpEventTracker.calculateXPCost('K-2', 150, false);
      expect(cost).toBe(1000);
    });

    test('should log calculation parameters', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      xpEventTracker.calculateXPCost('3-5', 200, true);

      expect(consoleSpy).toHaveBeenCalledWith('💵 XP Cost Calculation:', {
        baseCost: 1000,
        gradeLevel: '3-5',
        storyWordCount: 200,
        userPremiumStatus: true,
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Error Type Detection', () => {
    test('should detect timeout error type from reason', async () => {
      // Mock both mutations: refund + updateImageGenerationEvent
      mockConvexClient.mutation
        .mockResolvedValueOnce({ refundAmount: 1000, newBalance: 2000 })
        .mockResolvedValueOnce({
          finalStatus: 'refunded',
          refunded: true,
          refundAmount: 1000,
        });

      const eventData = {
        userId: mockUserId,
        xpAmount: 1000,
        eventType: 'refund' as const,
        reason: 'API timeout after 60 seconds',
        imageGenerationEventId: 'evt123abc',
      };

      await xpEventTracker.trackXPRefund(eventData);

      // The update mutation should receive 'timeout' as error type
      expect(mockConvexClient.mutation).toHaveBeenCalledWith(
        'imageGeneration:updateImageGenerationEvent',
        expect.objectContaining({
          errorType: 'timeout',
        }),
      );
    });

    test('should detect content safety error type from reason', async () => {
      mockConvexClient.mutation
        .mockResolvedValueOnce({ refundAmount: 1000, newBalance: 2000 })
        .mockResolvedValueOnce({
          finalStatus: 'refunded',
          refunded: true,
          refundAmount: 1000,
        });

      const eventData = {
        userId: mockUserId,
        xpAmount: 1000,
        eventType: 'refund' as const,
        reason: 'Content safety filter violation',
        imageGenerationEventId: 'evt123abc',
      };

      await xpEventTracker.trackXPRefund(eventData);

      expect(mockConvexClient.mutation).toHaveBeenCalledWith(
        'imageGeneration:updateImageGenerationEvent',
        expect.objectContaining({
          errorType: 'content_safety',
        }),
      );
    });

    test('should default to api_failure for unknown error types', async () => {
      mockConvexClient.mutation
        .mockResolvedValueOnce({ refundAmount: 1000, newBalance: 2000 })
        .mockResolvedValueOnce({
          finalStatus: 'refunded',
          refunded: true,
          refundAmount: 1000,
        });

      const eventData = {
        userId: mockUserId,
        xpAmount: 1000,
        eventType: 'refund' as const,
        reason: 'Unknown error occurred',
        imageGenerationEventId: 'evt123abc',
      };

      await xpEventTracker.trackXPRefund(eventData);

      expect(mockConvexClient.mutation).toHaveBeenCalledWith(
        'imageGeneration:updateImageGenerationEvent',
        expect.objectContaining({
          errorType: 'api_failure',
        }),
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle exceptions in tracking methods gracefully', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await xpEventTracker.trackXPDeduction({
        userId: mockUserId,
        xpAmount: 1000,
        eventType: 'deduction',
        reason: 'Test reason',
      } as any);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '💸 Tracking XP deduction:',
        expect.any(Object),
      );

      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });
});
