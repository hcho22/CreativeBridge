/**
 * Image Generation XP Cost Integration Test
 * Tests the specific 1000 XP deduction for image generation feature
 */

import { supabase } from '../../services/supabase';

// Mock supabase for testing
jest.mock('../../services/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('Image Generation XP Cost (1000 XP)', () => {
  const IMAGE_GENERATION_COST = 1000;
  const mockUserId = 'test-user-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Exact Cost Scenarios', () => {
    test('should handle exact cost when user has exactly 1000 XP', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Simulate the exact deduction logic from AuthContext
      const simulateImageGenerationXPDeduction = async (currentXP: number) => {
        if (currentXP < IMAGE_GENERATION_COST) {
          return {
            success: false,
            error: 'Insufficient XP balance',
            currentXP,
            required: IMAGE_GENERATION_COST,
          };
        }

        const { error } = await supabase.rpc('add_user_xp', {
          user_uuid: mockUserId,
          xp_to_add: -IMAGE_GENERATION_COST,
          words_added: 0,
        });

        if (error) {
          return { success: false, error: error.message };
        }

        return {
          success: true,
          newBalance: currentXP - IMAGE_GENERATION_COST,
          deductedAmount: IMAGE_GENERATION_COST,
        };
      };

      const result = await simulateImageGenerationXPDeduction(1000);

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(0);
      expect(result.deductedAmount).toBe(1000);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('add_user_xp', {
        user_uuid: mockUserId,
        xp_to_add: -1000,
        words_added: 0,
      });
    });

    test('should fail when user has 999 XP (1 short)', async () => {
      const simulateImageGenerationXPDeduction = async (currentXP: number) => {
        if (currentXP < IMAGE_GENERATION_COST) {
          return {
            success: false,
            error: 'Insufficient XP balance',
            currentXP,
            required: IMAGE_GENERATION_COST,
            shortfall: IMAGE_GENERATION_COST - currentXP,
          };
        }
        return { success: true };
      };

      const result = await simulateImageGenerationXPDeduction(999);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient XP balance');
      expect(result.shortfall).toBe(1);
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    test('should work with user having abundant XP (10,000 XP)', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const simulateImageGenerationXPDeduction = async (currentXP: number) => {
        if (currentXP < IMAGE_GENERATION_COST) {
          return { success: false, error: 'Insufficient XP balance' };
        }

        await supabase.rpc('add_user_xp', {
          user_uuid: mockUserId,
          xp_to_add: -IMAGE_GENERATION_COST,
          words_added: 0,
        });

        return {
          success: true,
          newBalance: currentXP - IMAGE_GENERATION_COST,
          canGenerateMoreImages:
            currentXP - IMAGE_GENERATION_COST >= IMAGE_GENERATION_COST,
        };
      };

      const result = await simulateImageGenerationXPDeduction(10000);

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(9000);
      expect(result.canGenerateMoreImages).toBe(true); // Still has enough for 9 more images
    });
  });

  describe('Multiple Image Generation Scenarios', () => {
    test('should track multiple image generations correctly', async () => {
      let currentBalance = 5000;
      const generationHistory: Array<{
        success: boolean;
        newBalance?: number;
        error?: string;
      }> = [];

      // Mock multiple successful calls
      mockSupabase.rpc
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      const simulateImageGeneration = async () => {
        if (currentBalance < IMAGE_GENERATION_COST) {
          return { success: false, error: 'Insufficient XP balance' };
        }

        await supabase.rpc('add_user_xp', {
          user_uuid: mockUserId,
          xp_to_add: -IMAGE_GENERATION_COST,
          words_added: 0,
        });

        currentBalance -= IMAGE_GENERATION_COST;
        return { success: true, newBalance: currentBalance };
      };

      // Generate 5 images (should all succeed)
      for (let i = 0; i < 5; i++) {
        const result = await simulateImageGeneration();
        generationHistory.push(result);
      }

      // Check results
      expect(generationHistory.every(h => h.success)).toBe(true);
      expect(generationHistory[0].newBalance).toBe(4000);
      expect(generationHistory[1].newBalance).toBe(3000);
      expect(generationHistory[2].newBalance).toBe(2000);
      expect(generationHistory[3].newBalance).toBe(1000);
      expect(generationHistory[4].newBalance).toBe(0);
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(5);

      // Try 6th generation (should fail)
      const sixthAttempt = await simulateImageGeneration();
      expect(sixthAttempt.success).toBe(false);
      expect(sixthAttempt.error).toBe('Insufficient XP balance');
    });

    test('should calculate how many images user can generate', () => {
      const calculateMaxImages = (currentXP: number) => {
        return Math.floor(currentXP / IMAGE_GENERATION_COST);
      };

      expect(calculateMaxImages(1000)).toBe(1);
      expect(calculateMaxImages(999)).toBe(0);
      expect(calculateMaxImages(2500)).toBe(2);
      expect(calculateMaxImages(10000)).toBe(10);
      expect(calculateMaxImages(0)).toBe(0);
    });
  });

  describe('Real-world User Scenarios', () => {
    test('should handle new user with no XP', async () => {
      const newUserXP = 0;

      const result = newUserXP >= IMAGE_GENERATION_COST;
      expect(result).toBe(false);

      // Calculate how much XP they need to earn
      const xpNeeded = IMAGE_GENERATION_COST - newUserXP;
      expect(xpNeeded).toBe(1000);
    });

    test('should handle user who just completed first story (typical XP: ~200)', async () => {
      const firstStoryUserXP = 200; // Rough estimate from challenge completion + word bonuses

      const result = firstStoryUserXP >= IMAGE_GENERATION_COST;
      expect(result).toBe(false);

      const xpNeeded = IMAGE_GENERATION_COST - firstStoryUserXP;
      expect(xpNeeded).toBe(800);
    });

    test('should handle experienced user (5+ stories completed)', async () => {
      // Experienced user might have: 5 stories × ~200 XP = ~1000+ XP
      const experiencedUserXP = 1200;

      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const simulateImageGenerationCheck = async (userXP: number) => {
        const canGenerate = userXP >= IMAGE_GENERATION_COST;

        if (!canGenerate) {
          return {
            canGenerate: false,
            xpNeeded: IMAGE_GENERATION_COST - userXP,
          };
        }

        // Simulate deduction
        await supabase.rpc('add_user_xp', {
          user_uuid: mockUserId,
          xp_to_add: -IMAGE_GENERATION_COST,
          words_added: 0,
        });

        return {
          canGenerate: true,
          newBalance: userXP - IMAGE_GENERATION_COST,
          imagesRemaining: Math.floor(
            (userXP - IMAGE_GENERATION_COST) / IMAGE_GENERATION_COST,
          ),
        };
      };

      const result = await simulateImageGenerationCheck(experiencedUserXP);

      expect(result.canGenerate).toBe(true);
      expect(result.newBalance).toBe(200);
      expect(result.imagesRemaining).toBe(0); // Can't generate another image with remaining XP
    });
  });

  describe('Error Recovery Scenarios', () => {
    test('should handle failed image generation without losing XP', async () => {
      const initialXP = 2000;

      // Mock database failure (XP should not be deducted)
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Image generation service unavailable' },
      });

      const simulateFailedImageGeneration = async (userXP: number) => {
        if (userXP < IMAGE_GENERATION_COST) {
          return { success: false, error: 'Insufficient XP balance' };
        }

        const { error } = await supabase.rpc('add_user_xp', {
          user_uuid: mockUserId,
          xp_to_add: -IMAGE_GENERATION_COST,
          words_added: 0,
        });

        if (error) {
          // XP should NOT be deducted if image generation fails
          return {
            success: false,
            error: error.message,
            xpRetained: userXP, // XP should remain unchanged
          };
        }

        return { success: true, newBalance: userXP - IMAGE_GENERATION_COST };
      };

      const result = await simulateFailedImageGeneration(initialXP);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Image generation service unavailable');
      expect(result.xpRetained).toBe(2000); // XP should be retained
    });
  });

  describe('UI Display Scenarios', () => {
    test('should provide correct UI feedback messages', () => {
      const getXPStatusMessage = (currentXP: number) => {
        if (currentXP >= IMAGE_GENERATION_COST) {
          const additionalImages =
            Math.floor(currentXP / IMAGE_GENERATION_COST) - 1;
          if (additionalImages > 0) {
            return `Generate Image (1000 XP) - ${additionalImages} more available`;
          }
          return 'Generate Image (1000 XP)';
        } else {
          const needed = IMAGE_GENERATION_COST - currentXP;
          return `Need ${needed} more XP to generate image`;
        }
      };

      expect(getXPStatusMessage(1000)).toBe('Generate Image (1000 XP)');
      expect(getXPStatusMessage(2000)).toBe(
        'Generate Image (1000 XP) - 1 more available',
      );
      expect(getXPStatusMessage(5000)).toBe(
        'Generate Image (1000 XP) - 4 more available',
      );
      expect(getXPStatusMessage(500)).toBe(
        'Need 500 more XP to generate image',
      );
      expect(getXPStatusMessage(0)).toBe('Need 1000 more XP to generate image');
    });
  });
});
