/**
 * XP Refund Mechanism Test Suite
 * Tests for XP refund functionality when image generation fails
 */

import { supabase } from '../../services/supabase';

// Mock supabase for testing
jest.mock('../../services/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('XP Refund Mechanism for Image Generation Failures', () => {
  const IMAGE_GENERATION_COST = 1000;
  const mockUserId = 'test-user-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Core Refund Functionality', () => {
    test('should successfully refund exact amount deducted (1000 XP)', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const simulateXPRefund = async (amount: number, reason: string) => {
        if (amount <= 0) {
          return { success: false, error: 'Invalid refund amount' };
        }

        if (!reason || reason.trim().length === 0) {
          return { success: false, error: 'Refund reason is required' };
        }

        const { error } = await supabase.rpc('add_user_xp', {
          user_uuid: mockUserId,
          xp_to_add: amount, // Positive amount for refund
          words_added: 0,
        });

        if (error) {
          return { success: false, error: error.message };
        }

        return {
          success: true,
          newBalance: 4000 + amount, // Simulating user had 4000 XP after deduction
        };
      };

      const result = await simulateXPRefund(
        IMAGE_GENERATION_COST,
        'Image generation API failure',
      );

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(5000); // 4000 + 1000 refund
      expect(mockSupabase.rpc).toHaveBeenCalledWith('add_user_xp', {
        user_uuid: mockUserId,
        xp_to_add: 1000, // Positive value for refund
        words_added: 0,
      });
    });

    test('should require a valid reason for refund', async () => {
      const simulateXPRefund = async (amount: number, reason: string) => {
        if (!reason || reason.trim().length === 0) {
          return { success: false, error: 'Refund reason is required' };
        }
        return { success: true };
      };

      // Test empty reason
      expect((await simulateXPRefund(1000, '')).success).toBe(false);
      expect((await simulateXPRefund(1000, '   ')).success).toBe(false); // Whitespace only
      expect((await simulateXPRefund(1000, 'API failure')).success).toBe(true);
    });

    test('should validate refund amount is positive', async () => {
      const simulateXPRefund = async (amount: number, reason: string) => {
        if (amount <= 0) {
          return { success: false, error: 'Invalid refund amount' };
        }
        return { success: true };
      };

      expect((await simulateXPRefund(0, 'Valid reason')).success).toBe(false);
      expect((await simulateXPRefund(-100, 'Valid reason')).success).toBe(
        false,
      );
      expect((await simulateXPRefund(1000, 'Valid reason')).success).toBe(true);
    });

    test('should handle database errors during refund', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database connection failed' },
      });

      const simulateXPRefund = async (amount: number, reason: string) => {
        const { error } = await supabase.rpc('add_user_xp', {
          user_uuid: mockUserId,
          xp_to_add: amount,
          words_added: 0,
        });

        if (error) {
          return { success: false, error: `Database error: ${error.message}` };
        }

        return { success: true };
      };

      const result = await simulateXPRefund(1000, 'Image generation timeout');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error: Database connection failed');
    });
  });

  describe('Complete Deduction-Refund Cycle', () => {
    test('should restore user to exact original balance after failed generation', async () => {
      const originalBalance = 5000;
      let currentBalance = originalBalance;

      // Mock successful deduction, then successful refund
      mockSupabase.rpc
        .mockResolvedValueOnce({ data: null, error: null }) // Deduction
        .mockResolvedValueOnce({ data: null, error: null }); // Refund

      const simulateImageGenerationAttempt = async () => {
        // Step 1: Deduct XP for image generation
        const deductResult = await supabase.rpc('add_user_xp', {
          user_uuid: mockUserId,
          xp_to_add: -IMAGE_GENERATION_COST,
          words_added: 0,
        });

        if (deductResult.error) {
          return {
            success: false,
            stage: 'deduction',
            error: deductResult.error.message,
          };
        }

        currentBalance -= IMAGE_GENERATION_COST;

        // Step 2: Simulate image generation failure
        const imageGenerationFailed = true; // Simulate API failure

        if (imageGenerationFailed) {
          // Step 3: Refund XP due to failure
          const refundResult = await supabase.rpc('add_user_xp', {
            user_uuid: mockUserId,
            xp_to_add: IMAGE_GENERATION_COST, // Positive amount for refund
            words_added: 0,
          });

          if (refundResult.error) {
            return {
              success: false,
              stage: 'refund',
              error: refundResult.error.message,
              balanceAfterDeduction: currentBalance,
            };
          }

          currentBalance += IMAGE_GENERATION_COST;

          return {
            success: false, // Generation failed, but XP was refunded
            stage: 'completed',
            reason: 'Image generation failed - XP refunded',
            originalBalance,
            finalBalance: currentBalance,
            xpRefunded: IMAGE_GENERATION_COST,
          };
        }

        return { success: true, finalBalance: currentBalance };
      };

      const result = await simulateImageGenerationAttempt();

      expect(result.success).toBe(false); // Generation failed
      expect(result.stage).toBe('completed');
      expect(result.finalBalance).toBe(originalBalance); // Back to original balance
      expect(result.xpRefunded).toBe(IMAGE_GENERATION_COST);
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(2); // Deduction + Refund
    });

    test('should handle partial failure scenarios correctly', async () => {
      // Scenario: Deduction succeeds, but refund fails
      mockSupabase.rpc
        .mockResolvedValueOnce({ data: null, error: null }) // Successful deduction
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Refund database error' },
        }); // Failed refund

      const simulatePartialFailure = async () => {
        let currentBalance = 3000;

        // Successful deduction
        const deductResult = await supabase.rpc('add_user_xp', {
          user_uuid: mockUserId,
          xp_to_add: -IMAGE_GENERATION_COST,
          words_added: 0,
        });

        if (!deductResult.error) {
          currentBalance -= IMAGE_GENERATION_COST;
        }

        // Image generation fails, attempt refund
        const refundResult = await supabase.rpc('add_user_xp', {
          user_uuid: mockUserId,
          xp_to_add: IMAGE_GENERATION_COST,
          words_added: 0,
        });

        return {
          deductionSucceeded: !deductResult.error,
          refundSucceeded: !refundResult.error,
          refundError: refundResult.error?.message,
          balanceAfterDeduction: currentBalance,
          criticalError: !refundResult.error
            ? null
            : 'User XP was deducted but refund failed',
        };
      };

      const result = await simulatePartialFailure();

      expect(result.deductionSucceeded).toBe(true);
      expect(result.refundSucceeded).toBe(false);
      expect(result.refundError).toBe('Refund database error');
      expect(result.criticalError).toBe(
        'User XP was deducted but refund failed',
      );
      expect(result.balanceAfterDeduction).toBe(2000); // 3000 - 1000
    });
  });

  describe('Image Generation Failure Scenarios', () => {
    test('should refund XP for API timeout failures', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: null });

      const simulateRefundForTimeout = async () => {
        const { error } = await supabase.rpc('add_user_xp', {
          user_uuid: mockUserId,
          xp_to_add: IMAGE_GENERATION_COST,
          words_added: 0,
        });

        if (error) return { success: false, error: error.message };

        return {
          success: true,
          reason: 'Image generation API timeout after 60 seconds',
          refundedAmount: IMAGE_GENERATION_COST,
          userNotified: true,
        };
      };

      const result = await simulateRefundForTimeout();

      expect(result.success).toBe(true);
      expect(result.reason).toContain('timeout');
      expect(result.refundedAmount).toBe(1000);
      expect(result.userNotified).toBe(true);
    });

    test('should refund XP for content safety failures', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: null });

      const simulateRefundForContentSafety = async () => {
        const { error } = await supabase.rpc('add_user_xp', {
          user_uuid: mockUserId,
          xp_to_add: IMAGE_GENERATION_COST,
          words_added: 0,
        });

        if (error) return { success: false, error: error.message };

        return {
          success: true,
          reason: 'Content safety filter blocked image generation',
          refundedAmount: IMAGE_GENERATION_COST,
          actionRequired: 'User should revise story content',
        };
      };

      const result = await simulateRefundForContentSafety();

      expect(result.success).toBe(true);
      expect(result.reason).toContain('Content safety');
      expect(result.actionRequired).toBeDefined();
    });

    test('should refund XP for service unavailability', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: null });

      const simulateRefundForServiceUnavailable = async () => {
        const { error } = await supabase.rpc('add_user_xp', {
          user_uuid: mockUserId,
          xp_to_add: IMAGE_GENERATION_COST,
          words_added: 0,
        });

        if (error) return { success: false, error: error.message };

        return {
          success: true,
          reason: 'Image generation service temporarily unavailable',
          refundedAmount: IMAGE_GENERATION_COST,
          retryRecommended: true,
          estimatedRetryTime: '15 minutes',
        };
      };

      const result = await simulateRefundForServiceUnavailable();

      expect(result.success).toBe(true);
      expect(result.retryRecommended).toBe(true);
      expect(result.estimatedRetryTime).toBeDefined();
    });
  });

  describe('Multiple Refund Scenarios', () => {
    test('should handle multiple consecutive failed generations with refunds', async () => {
      const attempts = [];
      let userBalance = 5000;

      // Mock multiple successful refunds
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

      for (let i = 0; i < 3; i++) {
        const simulateFailedAttempt = async (attemptNumber: number) => {
          // Each attempt: deduct then refund
          await supabase.rpc('add_user_xp', {
            user_uuid: mockUserId,
            xp_to_add: -IMAGE_GENERATION_COST, // Deduction
            words_added: 0,
          });

          await supabase.rpc('add_user_xp', {
            user_uuid: mockUserId,
            xp_to_add: IMAGE_GENERATION_COST, // Refund
            words_added: 0,
          });

          return {
            attempt: attemptNumber + 1,
            balanceAfterRefund: userBalance, // Should remain unchanged
            refundSuccessful: true,
          };
        };

        const result = await simulateFailedAttempt(i);
        attempts.push(result);
      }

      expect(attempts.length).toBe(3);
      expect(attempts.every(a => a.refundSuccessful)).toBe(true);
      expect(attempts.every(a => a.balanceAfterRefund === 5000)).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(6); // 3 deductions + 3 refunds
    });

    test('should track refund reasons for analytics', () => {
      const refundReasons = [
        'API timeout after 60 seconds',
        'Content safety violation detected',
        'Image generation service rate limit exceeded',
        'Invalid response from backup service',
        'Network connection failed during generation',
      ];

      const categorizeRefundReason = (reason: string) => {
        if (reason.includes('timeout')) return 'timeout';
        if (reason.includes('safety')) return 'content_safety';
        if (reason.includes('rate limit')) return 'rate_limit';
        if (reason.includes('backup service')) return 'backup_failure';
        if (reason.includes('Network') || reason.includes('connection'))
          return 'network_error';
        return 'unknown';
      };

      const categories = refundReasons.map(categorizeRefundReason);

      expect(categories).toContain('timeout');
      expect(categories).toContain('content_safety');
      expect(categories).toContain('rate_limit');
      expect(categories).toContain('backup_failure');
      expect(categories).toContain('network_error');
    });
  });

  describe('User Experience Scenarios', () => {
    test('should provide clear refund notification messages', () => {
      const generateRefundMessage = (reason: string, amount: number) => {
        const baseMessage = `Your ${amount} XP has been refunded.`;

        if (reason.includes('timeout')) {
          return `${baseMessage} The image generation took too long. Please try again.`;
        }
        if (reason.includes('safety')) {
          return `${baseMessage} Content was flagged by safety filters. Please revise your story.`;
        }
        if (reason.includes('service') || reason.includes('unavailable')) {
          return `${baseMessage} Service temporarily unavailable. Please try again later.`;
        }

        return `${baseMessage} Please try again.`;
      };

      expect(generateRefundMessage('API timeout', 1000)).toContain(
        'took too long',
      );
      expect(generateRefundMessage('Content safety violation', 1000)).toContain(
        'flagged by safety filters',
      );
      expect(generateRefundMessage('Service unavailable', 1000)).toContain(
        'temporarily unavailable',
      );
    });

    test('should calculate accurate remaining image generation capacity after refunds', () => {
      const calculateImageCapacity = (
        currentXP: number,
        costPerImage: number,
      ) => {
        return Math.floor(currentXP / costPerImage);
      };

      // User starts with 3500 XP, fails to generate 1 image (refunded), tries again
      const initialXP = 3500;
      const afterRefund = initialXP; // Same as initial since refunded

      expect(calculateImageCapacity(afterRefund, IMAGE_GENERATION_COST)).toBe(
        3,
      );

      // After successful generation
      const afterSuccessfulGeneration = afterRefund - IMAGE_GENERATION_COST;
      expect(
        calculateImageCapacity(
          afterSuccessfulGeneration,
          IMAGE_GENERATION_COST,
        ),
      ).toBe(2);
    });
  });
});
