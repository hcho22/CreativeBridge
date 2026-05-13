/**
 * Image Generation XP System Unit Tests
 * Tests XP validation, deduction, and refund mechanisms specific to image generation
 */

import { supabase } from '../../services/supabase';

// Mock supabase
jest.mock('../../services/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

// Mock implementation of XP system functions based on AuthContext patterns
class MockXPSystem {
  private userXP: number = 5000;

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

  async deductXP(
    userId: string,
    amount: number,
  ): Promise<{ success: boolean; error?: string; newBalance?: number }> {
    if (amount <= 0) {
      return { success: false, error: 'Invalid XP amount' };
    }

    const { error } = await supabase.rpc('add_user_xp', {
      user_uuid: userId,
      xp_to_add: -amount,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    this.userXP -= amount;
    return { success: true, newBalance: this.userXP };
  }

  async refundXP(
    userId: string,
    amount: number,
  ): Promise<{ success: boolean; error?: string; newBalance?: number }> {
    if (amount <= 0) {
      return { success: false, error: 'Invalid XP amount' };
    }

    const { error } = await supabase.rpc('add_user_xp', {
      user_uuid: userId,
      xp_to_add: amount,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    this.userXP += amount;
    return { success: true, newBalance: this.userXP };
  }

  validateXPBalance(requiredAmount: number): boolean {
    return this.userXP >= requiredAmount;
  }

  getXPBalanceInfo(requiredAmount: number) {
    const currentXP = this.userXP;
    const hasEnoughXP = currentXP >= requiredAmount;
    const shortfall = hasEnoughXP ? 0 : requiredAmount - currentXP;
    const maxGenerations = Math.floor(currentXP / requiredAmount);

    return {
      hasEnoughXP,
      currentXP,
      shortfall,
      canGenerate: hasEnoughXP,
      maxGenerations,
    };
  }

  // Helper method to set XP for testing
  setUserXP(amount: number) {
    this.userXP = amount;
  }
}

describe('Image Generation XP System - Unit Tests', () => {
  let xpSystem: MockXPSystem;
  const testUserId = 'test-user-123';
  const IMAGE_GENERATION_COST = 1000;

  beforeEach(() => {
    jest.clearAllMocks();
    xpSystem = new MockXPSystem();

    // Default mock for successful database operations
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

    const mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };
    mockSupabase.from.mockReturnValue(mockQueryBuilder as any);
  });

  describe('XP Balance Validation', () => {
    test('should correctly validate sufficient XP balance', () => {
      xpSystem.setUserXP(2500);

      const isValid = xpSystem.validateXPBalance(IMAGE_GENERATION_COST);
      expect(isValid).toBe(true);
    });

    test('should correctly validate insufficient XP balance', () => {
      xpSystem.setUserXP(500);

      const isValid = xpSystem.validateXPBalance(IMAGE_GENERATION_COST);
      expect(isValid).toBe(false);
    });

    test('should handle exact XP balance', () => {
      xpSystem.setUserXP(IMAGE_GENERATION_COST);

      const isValid = xpSystem.validateXPBalance(IMAGE_GENERATION_COST);
      expect(isValid).toBe(true);
    });

    test('should handle zero XP balance', () => {
      xpSystem.setUserXP(0);

      const isValid = xpSystem.validateXPBalance(IMAGE_GENERATION_COST);
      expect(isValid).toBe(false);
    });
  });

  describe('XP Balance Information', () => {
    test('should provide correct balance information for sufficient XP', () => {
      xpSystem.setUserXP(2500);

      const info = xpSystem.getXPBalanceInfo(IMAGE_GENERATION_COST);

      expect(info.hasEnoughXP).toBe(true);
      expect(info.currentXP).toBe(2500);
      expect(info.shortfall).toBe(0);
      expect(info.canGenerate).toBe(true);
      expect(info.maxGenerations).toBe(2);
    });

    test('should provide correct balance information for insufficient XP', () => {
      xpSystem.setUserXP(750);

      const info = xpSystem.getXPBalanceInfo(IMAGE_GENERATION_COST);

      expect(info.hasEnoughXP).toBe(false);
      expect(info.currentXP).toBe(750);
      expect(info.shortfall).toBe(250);
      expect(info.canGenerate).toBe(false);
      expect(info.maxGenerations).toBe(0);
    });

    test('should calculate maximum generations correctly', () => {
      xpSystem.setUserXP(3500);

      const info = xpSystem.getXPBalanceInfo(IMAGE_GENERATION_COST);

      expect(info.maxGenerations).toBe(3);
    });

    test('should handle partial XP for generation calculation', () => {
      xpSystem.setUserXP(1850);

      const info = xpSystem.getXPBalanceInfo(IMAGE_GENERATION_COST);

      expect(info.maxGenerations).toBe(1);
      expect(info.hasEnoughXP).toBe(true);
    });
  });

  describe('XP Deduction', () => {
    test('should successfully deduct XP when balance is sufficient', async () => {
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

      xpSystem.setUserXP(2500);
      const result = await xpSystem.deductXP(testUserId, IMAGE_GENERATION_COST);

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(1500);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('add_user_xp', {
        user_uuid: testUserId,
        xp_to_add: -IMAGE_GENERATION_COST,
      });
    });

    test('should handle XP deduction database errors', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      });

      const result = await xpSystem.deductXP(testUserId, IMAGE_GENERATION_COST);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
    });

    test('should reject invalid XP deduction amounts', async () => {
      const result = await xpSystem.deductXP(testUserId, 0);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid XP amount');
    });

    test('should reject negative XP deduction amounts', async () => {
      const result = await xpSystem.deductXP(testUserId, -100);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid XP amount');
    });
  });

  describe('XP Refund', () => {
    test('should successfully refund XP when image generation fails', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

      xpSystem.setUserXP(1500); // After deduction
      const result = await xpSystem.refundXP(testUserId, IMAGE_GENERATION_COST);

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(2500);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('add_user_xp', {
        user_uuid: testUserId,
        xp_to_add: IMAGE_GENERATION_COST,
      });
    });

    test('should handle XP refund database errors', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Refund operation failed' },
      });

      const result = await xpSystem.refundXP(testUserId, IMAGE_GENERATION_COST);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Refund operation failed');
    });

    test('should reject invalid XP refund amounts', async () => {
      const result = await xpSystem.refundXP(testUserId, 0);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid XP amount');
    });

    test('should reject negative XP refund amounts', async () => {
      const result = await xpSystem.refundXP(testUserId, -500);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid XP amount');
    });
  });

  describe('XP Balance Checking', () => {
    test('should successfully retrieve user XP balance', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { total_xp: 3200 },
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQueryBuilder as any);

      const balance = await xpSystem.checkUserXPBalance(testUserId);

      expect(balance).toBe(3200);
      expect(mockSupabase.from).toHaveBeenCalledWith('user_profiles');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('total_xp');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', testUserId);
    });

    test('should handle user not found errors', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'User profile not found' },
        }),
      };
      mockSupabase.from.mockReturnValue(mockQueryBuilder as any);

      await expect(xpSystem.checkUserXPBalance(testUserId)).rejects.toThrow(
        'Failed to check XP balance: User profile not found',
      );
    });

    test('should handle null XP balance gracefully', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { total_xp: null },
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQueryBuilder as any);

      const balance = await xpSystem.checkUserXPBalance(testUserId);

      expect(balance).toBe(0);
    });

    test('should handle undefined XP balance gracefully', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {},
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQueryBuilder as any);

      const balance = await xpSystem.checkUserXPBalance(testUserId);

      expect(balance).toBe(0);
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    test('should handle very large XP amounts', () => {
      xpSystem.setUserXP(Number.MAX_SAFE_INTEGER);

      const info = xpSystem.getXPBalanceInfo(IMAGE_GENERATION_COST);
      expect(info.hasEnoughXP).toBe(true);
      expect(info.maxGenerations).toBeGreaterThan(1000000);
    });

    test('should handle floating point XP amounts correctly', () => {
      // XP should always be integers, but test robustness
      const floatAmount = 1000.5;
      xpSystem.setUserXP(2000);

      const isValid = xpSystem.validateXPBalance(floatAmount);
      expect(isValid).toBe(true);
    });

    test('should handle multiple consecutive operations', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

      xpSystem.setUserXP(5000);

      // First deduction
      const deduction1 = await xpSystem.deductXP(
        testUserId,
        IMAGE_GENERATION_COST,
      );
      expect(deduction1.success).toBe(true);
      expect(deduction1.newBalance).toBe(4000);

      // Second deduction
      const deduction2 = await xpSystem.deductXP(
        testUserId,
        IMAGE_GENERATION_COST,
      );
      expect(deduction2.success).toBe(true);
      expect(deduction2.newBalance).toBe(3000);

      // Refund
      const refund = await xpSystem.refundXP(testUserId, IMAGE_GENERATION_COST);
      expect(refund.success).toBe(true);
      expect(refund.newBalance).toBe(4000);
    });

    test('should maintain transaction atomicity on database errors', async () => {
      xpSystem.setUserXP(2000);
      const initialBalance = xpSystem.getXPBalanceInfo(
        IMAGE_GENERATION_COST,
      ).currentXP;

      // Simulate database error
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Connection timeout' },
      });

      const result = await xpSystem.deductXP(testUserId, IMAGE_GENERATION_COST);

      expect(result.success).toBe(false);
      // Balance should remain unchanged due to error
      const finalBalance = xpSystem.getXPBalanceInfo(
        IMAGE_GENERATION_COST,
      ).currentXP;
      expect(finalBalance).toBe(initialBalance);
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle rapid successive XP operations', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
      xpSystem.setUserXP(10000);

      const operations = [];
      for (let i = 0; i < 10; i++) {
        operations.push(xpSystem.deductXP(testUserId, 100));
      }

      const results = await Promise.all(operations);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      expect(mockSupabase.rpc).toHaveBeenCalledTimes(10);
    });

    test('should efficiently calculate balance information', () => {
      const startTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        xpSystem.setUserXP(i * 100);
        const info = xpSystem.getXPBalanceInfo(IMAGE_GENERATION_COST);
        expect(typeof info.maxGenerations).toBe('number');
      }

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Smoke-perf assertion (not a gate-perf one): 1000 calls of a pure
      // synchronous balance calc should land well under 500ms on any
      // reasonable runner. Tight thresholds (<100ms) flaked on GitHub
      // Actions where noisy-neighbor variance pushed real-time runtime
      // past 120ms even though correctness held. 500ms keeps the
      // catastrophic-regression signal (10x slowdown trips it) without
      // false-failing on CI variance.
      expect(executionTime).toBeLessThan(500);
    });
  });
});
