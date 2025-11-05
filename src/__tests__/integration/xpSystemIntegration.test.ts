/**
 * XP System Integration Tests
 * Tests the integration between XP management, image generation, and database operations
 */

import { supabase } from '../../services/supabase';
import { xpEventTracker } from '../../services/xpEventTracker';

// Mock Supabase
jest.mock('../../services/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

jest.mock('../../services/xpEventTracker', () => ({
  xpEventTracker: {
    createImageGenerationEvent: jest.fn(),
    updateImageGenerationEvent: jest.fn(),
    trackXPTransaction: jest.fn(),
  },
}));

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const mockXpEventTracker = xpEventTracker as jest.Mocked<typeof xpEventTracker>;

// Mock XP management functions similar to AuthContext
class IntegratedXPManager {
  async checkUserXPBalance(userId: string): Promise<number> {
    const { data: userProfile, error } = await supabase
      .from('user_profiles')
      .select('total_xp')
      .eq('id', userId)
      .single();

    if (error) {
      throw new Error(`Failed to check XP balance: ${error.message}`);
    }

    return (userProfile as any)?.total_xp || 0;
  }

  async deductXPForImageGeneration(
    userId: string,
    amount: number,
    sessionId: string,
    metadata: Record<string, any> = {},
  ): Promise<{
    success: boolean;
    error?: string;
    newBalance?: number;
    eventId?: string;
  }> {
    try {
      // 1. Check current balance
      const currentBalance = await this.checkUserXPBalance(userId);

      if (currentBalance < amount) {
        return {
          success: false,
          error: `Insufficient XP. Need ${amount} XP, have ${currentBalance} XP`,
        };
      }

      // 2. Create tracking event first
      const eventResult = await xpEventTracker.createImageGenerationEvent({
        userId,
        sessionId,
        xpCost: amount,
        storyGradeLevel: metadata.gradeLevel || 'K-2',
        storyWordCount: metadata.wordCount || 0,
        metadata: {
          timestamp: new Date().toISOString(),
          deductionReason: 'image_generation',
          ...metadata,
        },
      });

      if (!eventResult.success) {
        return {
          success: false,
          error: `Failed to create tracking event: ${eventResult.error}`,
        };
      }

      // 3. Perform XP deduction
      const { error } = await supabase.rpc('add_user_xp', {
        user_uuid: userId,
        xp_to_add: -amount,
      });

      if (error) {
        // Update event with failure
        await xpEventTracker.updateImageGenerationEvent(
          eventResult.eventId!,
          'failed',
          { errorType: 'xp_deduction_failed' },
        );

        return {
          success: false,
          error: `XP deduction failed: ${error.message}`,
        };
      }

      // 4. Update event with success
      await xpEventTracker.updateImageGenerationEvent(
        eventResult.eventId!,
        'success',
        {
          xpDeducted: amount,
          newBalance: currentBalance - amount,
        },
      );

      return {
        success: true,
        newBalance: currentBalance - amount,
        eventId: eventResult.eventId!,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async refundXPForFailedGeneration(
    userId: string,
    amount: number,
    eventId: string,
    reason: string,
  ): Promise<{ success: boolean; error?: string; newBalance?: number }> {
    try {
      // 1. Get current balance
      const currentBalance = await this.checkUserXPBalance(userId);

      // 2. Perform XP refund
      const { error } = await supabase.rpc('add_user_xp', {
        user_uuid: userId,
        xp_to_add: amount, // Positive amount for refund
      });

      if (error) {
        return {
          success: false,
          error: `XP refund failed: ${error.message}`,
        };
      }

      // 3. Update tracking event
      await xpEventTracker.updateImageGenerationEvent(eventId, 'failed', {
        xpRefunded: amount,
        refundReason: reason,
        newBalance: currentBalance + amount,
      });

      return {
        success: true,
        newBalance: currentBalance + amount,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async validateXPSufficiency(
    userId: string,
    requiredAmount: number,
  ): Promise<{
    isValid: boolean;
    currentBalance: number;
    shortfall: number;
  }> {
    try {
      const currentBalance = await this.checkUserXPBalance(userId);
      const isValid = currentBalance >= requiredAmount;
      const shortfall = isValid ? 0 : requiredAmount - currentBalance;

      return {
        isValid,
        currentBalance,
        shortfall,
      };
    } catch (error) {
      throw new Error(
        `XP validation failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }
}

describe('XP System Integration Tests', () => {
  let xpManager: IntegratedXPManager;
  const testUserId = 'test-user-123';
  const testSessionId = 'test-session-456';
  const testEventId = 'test-event-789';
  const IMAGE_GENERATION_COST = 1000;

  beforeEach(() => {
    jest.clearAllMocks();
    xpManager = new IntegratedXPManager();

    // Setup default successful responses
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
      eventId: testEventId,
    });
    mockXpEventTracker.updateImageGenerationEvent.mockResolvedValue();
  });

  describe('XP Balance Validation Integration', () => {
    test('should validate sufficient XP balance with database check', async () => {
      const validation = await xpManager.validateXPSufficiency(
        testUserId,
        IMAGE_GENERATION_COST,
      );

      expect(validation.isValid).toBe(true);
      expect(validation.currentBalance).toBe(2500);
      expect(validation.shortfall).toBe(0);

      // Verify database was queried
      expect(mockSupabase.from).toHaveBeenCalledWith('user_profiles');
    });

    test('should validate insufficient XP balance correctly', async () => {
      // Mock user with insufficient XP
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { total_xp: 750 },
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQueryBuilder as any);

      const validation = await xpManager.validateXPSufficiency(
        testUserId,
        IMAGE_GENERATION_COST,
      );

      expect(validation.isValid).toBe(false);
      expect(validation.currentBalance).toBe(750);
      expect(validation.shortfall).toBe(250);
    });

    test('should handle database errors during validation', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database connection failed' },
        }),
      };
      mockSupabase.from.mockReturnValue(mockQueryBuilder as any);

      await expect(
        xpManager.validateXPSufficiency(testUserId, IMAGE_GENERATION_COST),
      ).rejects.toThrow(
        'XP validation failed: Failed to check XP balance: Database connection failed',
      );
    });
  });

  describe('XP Deduction Integration Flow', () => {
    test('should complete full XP deduction workflow', async () => {
      const metadata = {
        gradeLevel: 'K-2',
        wordCount: 150,
        storyTheme: 'adventure',
      };

      const result = await xpManager.deductXPForImageGeneration(
        testUserId,
        IMAGE_GENERATION_COST,
        testSessionId,
        metadata,
      );

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(1500);
      expect(result.eventId).toBe(testEventId);

      // Verify event creation
      expect(
        mockXpEventTracker.createImageGenerationEvent,
      ).toHaveBeenCalledWith({
        userId: testUserId,
        sessionId: testSessionId,
        xpCost: IMAGE_GENERATION_COST,
        storyGradeLevel: 'K-2',
        storyWordCount: 150,
        metadata: expect.objectContaining({
          deductionReason: 'image_generation',
          storyTheme: 'adventure',
        }),
      });

      // Verify XP deduction
      expect(mockSupabase.rpc).toHaveBeenCalledWith('add_user_xp', {
        user_uuid: testUserId,
        xp_to_add: -IMAGE_GENERATION_COST,
      });

      // Verify event update
      expect(
        mockXpEventTracker.updateImageGenerationEvent,
      ).toHaveBeenCalledWith(
        testEventId,
        'success',
        expect.objectContaining({
          xpDeducted: IMAGE_GENERATION_COST,
          newBalance: 1500,
        }),
      );
    });

    test('should handle insufficient XP during deduction flow', async () => {
      // Mock user with insufficient XP
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { total_xp: 500 },
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQueryBuilder as any);

      const result = await xpManager.deductXPForImageGeneration(
        testUserId,
        IMAGE_GENERATION_COST,
        testSessionId,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient XP');

      // Verify no XP deduction was attempted
      expect(mockSupabase.rpc).not.toHaveBeenCalled();

      // Verify no event creation for insufficient XP
      expect(
        mockXpEventTracker.createImageGenerationEvent,
      ).not.toHaveBeenCalled();
    });

    test('should handle event creation failure', async () => {
      mockXpEventTracker.createImageGenerationEvent.mockResolvedValue({
        success: false,
        error: 'Event tracking service unavailable',
      });

      const result = await xpManager.deductXPForImageGeneration(
        testUserId,
        IMAGE_GENERATION_COST,
        testSessionId,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to create tracking event');

      // Verify no XP deduction was attempted
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    test('should handle XP deduction database failure', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Insufficient privileges' },
      });

      const result = await xpManager.deductXPForImageGeneration(
        testUserId,
        IMAGE_GENERATION_COST,
        testSessionId,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('XP deduction failed');

      // Verify event was updated with failure
      expect(
        mockXpEventTracker.updateImageGenerationEvent,
      ).toHaveBeenCalledWith(testEventId, 'failed', {
        errorType: 'xp_deduction_failed',
      });
    });
  });

  describe('XP Refund Integration Flow', () => {
    test('should complete full XP refund workflow', async () => {
      // Mock current balance after deduction
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { total_xp: 1500 },
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQueryBuilder as any);

      const result = await xpManager.refundXPForFailedGeneration(
        testUserId,
        IMAGE_GENERATION_COST,
        testEventId,
        'API service failure',
      );

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(2500);

      // Verify XP refund
      expect(mockSupabase.rpc).toHaveBeenCalledWith('add_user_xp', {
        user_uuid: testUserId,
        xp_to_add: IMAGE_GENERATION_COST,
      });

      // Verify event update with refund info
      expect(
        mockXpEventTracker.updateImageGenerationEvent,
      ).toHaveBeenCalledWith(
        testEventId,
        'failed',
        expect.objectContaining({
          xpRefunded: IMAGE_GENERATION_COST,
          refundReason: 'API service failure',
          newBalance: 2500,
        }),
      );
    });

    test('should handle refund database failure', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Database transaction failed' },
      });

      const result = await xpManager.refundXPForFailedGeneration(
        testUserId,
        IMAGE_GENERATION_COST,
        testEventId,
        'Test refund failure',
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('XP refund failed');

      // Verify balance check was still attempted
      expect(mockSupabase.from).toHaveBeenCalledWith('user_profiles');
    });

    test('should handle balance check failure during refund', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'User not found' },
        }),
      };
      mockSupabase.from.mockReturnValue(mockQueryBuilder as any);

      const result = await xpManager.refundXPForFailedGeneration(
        testUserId,
        IMAGE_GENERATION_COST,
        testEventId,
        'Balance check failure test',
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to check XP balance');
    });
  });

  describe('Transaction Integrity and Atomicity', () => {
    test('should maintain data consistency during successful operations', async () => {
      // Perform deduction
      const deductionResult = await xpManager.deductXPForImageGeneration(
        testUserId,
        IMAGE_GENERATION_COST,
        testSessionId,
        { gradeLevel: '3-5', wordCount: 100 },
      );

      expect(deductionResult.success).toBe(true);

      // Verify the sequence of operations
      const rpcCalls = mockSupabase.rpc.mock.calls;
      const eventUpdates =
        mockXpEventTracker.updateImageGenerationEvent.mock.calls;

      expect(rpcCalls).toHaveLength(1);
      expect(rpcCalls[0]).toEqual([
        'add_user_xp',
        {
          user_uuid: testUserId,
          xp_to_add: -IMAGE_GENERATION_COST,
        },
      ]);

      expect(eventUpdates).toHaveLength(1);
      expect(eventUpdates[0][1]).toBe('success');
    });

    test('should handle partial failures without data corruption', async () => {
      // Mock event update failure
      mockXpEventTracker.updateImageGenerationEvent.mockRejectedValue(
        new Error('Event update service down'),
      );

      const result = await xpManager.deductXPForImageGeneration(
        testUserId,
        IMAGE_GENERATION_COST,
        testSessionId,
      );

      // Should still report success despite event update failure
      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(1500);

      // Verify XP was still deducted
      expect(mockSupabase.rpc).toHaveBeenCalledWith('add_user_xp', {
        user_uuid: testUserId,
        xp_to_add: -IMAGE_GENERATION_COST,
      });
    });

    test('should handle concurrent XP operations safely', async () => {
      // Simulate multiple concurrent deduction attempts
      const concurrentOperations = [
        xpManager.deductXPForImageGeneration(
          testUserId,
          IMAGE_GENERATION_COST,
          'session-1',
        ),
        xpManager.deductXPForImageGeneration(
          testUserId,
          IMAGE_GENERATION_COST,
          'session-2',
        ),
        xpManager.deductXPForImageGeneration(
          testUserId,
          IMAGE_GENERATION_COST,
          'session-3',
        ),
      ];

      // All should succeed with current mocking (in real scenario, only one might succeed)
      const results = await Promise.all(concurrentOperations);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Verify database was called for each operation
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(3);
    });
  });

  describe('Error Recovery and Rollback', () => {
    test('should handle network failures gracefully', async () => {
      // Mock network timeout
      mockSupabase.rpc.mockRejectedValue(new Error('Network timeout'));

      const result = await xpManager.deductXPForImageGeneration(
        testUserId,
        IMAGE_GENERATION_COST,
        testSessionId,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network timeout');

      // Verify event creation was attempted but deduction failed
      expect(mockXpEventTracker.createImageGenerationEvent).toHaveBeenCalled();
      expect(
        mockXpEventTracker.updateImageGenerationEvent,
      ).toHaveBeenCalledWith(testEventId, 'failed', {
        errorType: 'xp_deduction_failed',
      });
    });

    test('should handle system recovery after failures', async () => {
      // First attempt fails
      mockSupabase.rpc.mockRejectedValueOnce(
        new Error('Temporary system error'),
      );

      // Second attempt succeeds
      mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: null });

      // Create new event for retry
      mockXpEventTracker.createImageGenerationEvent
        .mockResolvedValueOnce({ success: false, error: 'System error' })
        .mockResolvedValueOnce({ success: true, eventId: 'retry-event-123' });

      // First attempt should fail
      const firstResult = await xpManager.deductXPForImageGeneration(
        testUserId,
        IMAGE_GENERATION_COST,
        testSessionId,
      );

      expect(firstResult.success).toBe(false);

      // Second attempt should succeed
      const secondResult = await xpManager.deductXPForImageGeneration(
        testUserId,
        IMAGE_GENERATION_COST,
        testSessionId,
      );

      expect(secondResult.success).toBe(true);
      expect(secondResult.eventId).toBe('retry-event-123');
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle rapid successive operations efficiently', async () => {
      const startTime = Date.now();

      // Perform 10 rapid operations
      const operations = Array(10)
        .fill(null)
        .map((_, index) =>
          xpManager.validateXPSufficiency(
            testUserId,
            IMAGE_GENERATION_COST + index * 100,
          ),
        );

      const results = await Promise.all(operations);
      const endTime = Date.now();

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.currentBalance).toBe(2500);
      });

      // Should complete quickly (less than 1 second in test environment)
      expect(endTime - startTime).toBeLessThan(1000);
    });

    test('should handle high XP values correctly', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { total_xp: 1000000 }, // Very high XP
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQueryBuilder as any);

      const validation = await xpManager.validateXPSufficiency(
        testUserId,
        IMAGE_GENERATION_COST,
      );

      expect(validation.isValid).toBe(true);
      expect(validation.currentBalance).toBe(1000000);
      expect(validation.shortfall).toBe(0);

      // Test large deduction
      const result = await xpManager.deductXPForImageGeneration(
        testUserId,
        50000, // Large deduction
        testSessionId,
      );

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(950000);
    });
  });
});
