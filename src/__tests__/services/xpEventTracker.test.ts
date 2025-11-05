/**
 * XP Event Tracker Test Suite
 * Tests for XP tracking and analytics for image generation events
 */

import { xpEventTracker } from '../../services/xpEventTracker';
import { supabase } from '../../services/supabase';

// Mock supabase
jest.mock('../../services/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('XP Event Tracker Service', () => {
  const mockUserId = 'test-user-123';
  const mockSessionId = 'session-456';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Image Generation Event Creation', () => {
    test('should create image generation event with XP tracking', async () => {
      const mockEventId = 'event-789';
      mockSupabase.rpc.mockResolvedValueOnce({
        data: mockEventId,
        error: null,
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
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'create_image_generation_event',
        {
          p_user_id: mockUserId,
          p_session_id: mockSessionId,
          p_xp_cost: 1000,
          p_story_grade_level: 'K-2',
          p_story_word_count: 150,
          p_metadata: { test: true },
        },
      );
    });

    test('should handle database errors during event creation', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database connection failed' },
      });

      const eventData = {
        userId: mockUserId,
        sessionId: mockSessionId,
        xpCost: 1000,
      };

      const result = await xpEventTracker.createImageGenerationEvent(eventData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
    });

    test('should handle exceptions during event creation', async () => {
      mockSupabase.rpc.mockRejectedValueOnce(new Error('Network error'));

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
    test('should update event status successfully', async () => {
      const eventId = 'event-789';
      mockSupabase.rpc.mockResolvedValueOnce({
        data: true,
        error: null,
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
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'update_image_generation_event',
        {
          p_event_id: eventId,
          p_status: 'success',
          p_image_url: 'https://example.com/image.jpg',
          p_error_type: undefined,
          p_service_used: 'replicate',
          p_api_response_time: 45000,
          p_prompt_used: 'A beautiful story illustration',
        },
      );
    });

    test('should update event with failure status and error type', async () => {
      const eventId = 'event-789';
      mockSupabase.rpc.mockResolvedValueOnce({
        data: true,
        error: null,
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
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'update_image_generation_event',
        {
          p_event_id: eventId,
          p_status: 'failed',
          p_image_url: undefined,
          p_error_type: 'api_failure',
          p_service_used: 'backup_service',
          p_api_response_time: 65000,
          p_prompt_used: undefined,
        },
      );
    });

    test('should handle database errors during event update', async () => {
      const eventId = 'event-789';
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Update failed' },
      });

      const result = await xpEventTracker.updateImageGenerationEvent(
        eventId,
        'success',
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
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
        imageGenerationEventId: 'event-123',
        metadata: { test: true },
      };

      await xpEventTracker.trackXPDeduction(eventData);

      expect(consoleSpy).toHaveBeenCalledWith(
        '💸 Tracking XP deduction:',
        expect.objectContaining({
          userId: mockUserId,
          xpAmount: 1000,
          reason: 'Image generation attempt',
          imageGenerationEventId: 'event-123',
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

    test('should track XP refund and update event status', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Mock the update call for refunded status
      mockSupabase.rpc.mockResolvedValueOnce({
        data: true,
        error: null,
      });

      const eventData = {
        userId: mockUserId,
        sessionId: mockSessionId,
        xpAmount: 1000,
        eventType: 'refund' as const,
        reason: 'API timeout failure',
        imageGenerationEventId: 'event-123',
      };

      await xpEventTracker.trackXPRefund(eventData);

      expect(consoleSpy).toHaveBeenCalledWith(
        '💰 Tracking XP refund:',
        expect.objectContaining({
          userId: mockUserId,
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

      // Should update the event status to 'refunded'
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'update_image_generation_event',
        {
          p_event_id: 'event-123',
          p_status: 'refunded',
          p_image_url: undefined,
          p_error_type: 'timeout',
          p_service_used: undefined,
          p_api_response_time: undefined,
          p_prompt_used: undefined,
        },
      );

      consoleSpy.mockRestore();
    });

    test('should track XP validation events', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await xpEventTracker.trackXPValidation(
        mockUserId,
        1000, // required XP
        1500, // current XP
        true, // validation result
        'image_generation',
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

    test('should track validation failure with shortfall', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await xpEventTracker.trackXPValidation(
        mockUserId,
        1000, // required XP
        750, // current XP
        false, // validation result
        'image_generation',
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '🔍 XP Validation Event:',
        expect.objectContaining({
          validationResult: false,
          shortfall: 250,
        }),
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Analytics and Reporting', () => {
    test('should fetch XP analytics successfully', async () => {
      const mockAnalytics = [
        {
          total_attempts: 10,
          successful_generations: 8,
          failed_generations: 2,
          total_xp_spent: 8000,
          avg_response_time: 42.5,
        },
      ];

      mockSupabase.rpc.mockResolvedValueOnce({
        data: mockAnalytics,
        error: null,
      });

      const result = await xpEventTracker.getXPAnalytics(
        mockUserId,
        '2024-01-01',
        '2024-01-31',
      );

      expect(result).toEqual(mockAnalytics);
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'get_image_generation_analytics',
        {
          p_user_id: mockUserId,
          p_start_date: '2024-01-01',
          p_end_date: '2024-01-31',
        },
      );
    });

    test('should fetch user events successfully', async () => {
      const mockEvents = [
        {
          event_id: 'event-1',
          xp_cost: 1000,
          generation_status: 'success',
          created_at: '2024-01-01T10:00:00Z',
        },
        {
          event_id: 'event-2',
          xp_cost: 1000,
          generation_status: 'failed',
          created_at: '2024-01-02T11:00:00Z',
        },
      ];

      mockSupabase.rpc.mockResolvedValueOnce({
        data: mockEvents,
        error: null,
      });

      const result = await xpEventTracker.getUserImageGenerationEvents(
        mockUserId,
        10,
        0,
      );

      expect(result).toEqual(mockEvents);
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'get_user_image_generation_events',
        {
          p_user_id: mockUserId,
          p_limit: 10,
          p_offset: 0,
        },
      );
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
      expect(cost).toBe(1000); // Base cost for now
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
      mockSupabase.rpc.mockResolvedValueOnce({ data: true, error: null });

      const eventData = {
        userId: mockUserId,
        xpAmount: 1000,
        eventType: 'refund' as const,
        reason: 'API timeout after 60 seconds',
        imageGenerationEventId: 'event-123',
      };

      await xpEventTracker.trackXPRefund(eventData);

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'update_image_generation_event',
        expect.objectContaining({
          p_error_type: 'timeout',
        }),
      );
    });

    test('should detect content safety error type from reason', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ data: true, error: null });

      const eventData = {
        userId: mockUserId,
        xpAmount: 1000,
        eventType: 'refund' as const,
        reason: 'Content safety filter violation',
        imageGenerationEventId: 'event-123',
      };

      await xpEventTracker.trackXPRefund(eventData);

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'update_image_generation_event',
        expect.objectContaining({
          p_error_type: 'content_safety',
        }),
      );
    });

    test('should default to api_failure for unknown error types', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ data: true, error: null });

      const eventData = {
        userId: mockUserId,
        xpAmount: 1000,
        eventType: 'refund' as const,
        reason: 'Unknown error occurred',
        imageGenerationEventId: 'event-123',
      };

      await xpEventTracker.trackXPRefund(eventData);

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'update_image_generation_event',
        expect.objectContaining({
          p_error_type: 'api_failure',
        }),
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle analytics fetch errors gracefully', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Analytics fetch failed' },
      });

      const result = await xpEventTracker.getXPAnalytics(mockUserId);

      expect(result).toBeNull();
    });

    test('should handle user events fetch errors gracefully', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Events fetch failed' },
      });

      const result = await xpEventTracker.getUserImageGenerationEvents(
        mockUserId,
      );

      expect(result).toEqual([]);
    });

    test('should handle exceptions in tracking methods gracefully', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // The method doesn't throw exceptions, it just logs events
      // Test that it can handle malformed data without crashing
      await xpEventTracker.trackXPDeduction({
        userId: 'test-user',
        xpAmount: 1000,
        eventType: 'deduction',
        reason: 'Test reason',
      } as any);

      // Should have logged the tracking attempt
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '💸 Tracking XP deduction:',
        expect.any(Object),
      );

      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });
});
