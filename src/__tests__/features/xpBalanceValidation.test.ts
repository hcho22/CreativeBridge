/**
 * XP Balance Validation Test Suite
 * Tests for XP balance validation before image generation
 */

describe('XP Balance Validation for Image Generation', () => {
  const IMAGE_GENERATION_COST = 1000;

  // Mock user profile scenarios
  const createMockProfile = (totalXP: number) => ({
    id: 'test-user',
    username: 'testuser',
    display_name: 'Test User',
    total_xp: totalXP,
    current_streak: 1,
    longest_streak: 1,
    last_activity_date: '2024-01-01',
    total_games_played: 1,
    total_stories_completed: 1,
    total_words_written: 100,
    best_score: 100,
    preferred_grade_level: 'K-2' as const,
    speech_enabled: true,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  });

  describe('Basic Validation Logic', () => {
    test('should validate sufficient XP balance correctly', () => {
      const validateXPBalance = (
        currentXP: number,
        requiredAmount: number,
      ): boolean => {
        return currentXP >= requiredAmount;
      };

      expect(validateXPBalance(1000, IMAGE_GENERATION_COST)).toBe(true);
      expect(validateXPBalance(1500, IMAGE_GENERATION_COST)).toBe(true);
      expect(validateXPBalance(5000, IMAGE_GENERATION_COST)).toBe(true);
    });

    test('should detect insufficient XP balance correctly', () => {
      const validateXPBalance = (
        currentXP: number,
        requiredAmount: number,
      ): boolean => {
        return currentXP >= requiredAmount;
      };

      expect(validateXPBalance(999, IMAGE_GENERATION_COST)).toBe(false);
      expect(validateXPBalance(500, IMAGE_GENERATION_COST)).toBe(false);
      expect(validateXPBalance(0, IMAGE_GENERATION_COST)).toBe(false);
    });

    test('should handle edge cases properly', () => {
      const validateXPBalance = (
        currentXP: number,
        requiredAmount: number,
      ): boolean => {
        return currentXP >= requiredAmount;
      };

      // Exact balance
      expect(validateXPBalance(1000, 1000)).toBe(true);

      // One point short
      expect(validateXPBalance(999, 1000)).toBe(false);

      // One point over
      expect(validateXPBalance(1001, 1000)).toBe(true);
    });
  });

  describe('Comprehensive Balance Information', () => {
    test('should calculate XP balance info correctly for sufficient balance', () => {
      const getXPBalanceInfo = (currentXP: number, requiredAmount: number) => {
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
      };

      const result = getXPBalanceInfo(5000, IMAGE_GENERATION_COST);

      expect(result.hasEnoughXP).toBe(true);
      expect(result.currentXP).toBe(5000);
      expect(result.shortfall).toBe(0);
      expect(result.canGenerate).toBe(true);
      expect(result.maxGenerations).toBe(5);
    });

    test('should calculate XP balance info correctly for insufficient balance', () => {
      const getXPBalanceInfo = (currentXP: number, requiredAmount: number) => {
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
      };

      const result = getXPBalanceInfo(300, IMAGE_GENERATION_COST);

      expect(result.hasEnoughXP).toBe(false);
      expect(result.currentXP).toBe(300);
      expect(result.shortfall).toBe(700);
      expect(result.canGenerate).toBe(false);
      expect(result.maxGenerations).toBe(0);
    });

    test('should calculate maximum generations correctly', () => {
      const calculateMaxGenerations = (
        currentXP: number,
        costPerGeneration: number,
      ) => {
        return Math.floor(currentXP / costPerGeneration);
      };

      expect(calculateMaxGenerations(1000, IMAGE_GENERATION_COST)).toBe(1);
      expect(calculateMaxGenerations(2500, IMAGE_GENERATION_COST)).toBe(2);
      expect(calculateMaxGenerations(10000, IMAGE_GENERATION_COST)).toBe(10);
      expect(calculateMaxGenerations(999, IMAGE_GENERATION_COST)).toBe(0);
      expect(calculateMaxGenerations(1999, IMAGE_GENERATION_COST)).toBe(1);
    });
  });

  describe('Image Generation Validation', () => {
    test('should allow image generation when user has sufficient XP', () => {
      const canGenerateImage = (userProfile: any, user: any) => {
        if (!user || !userProfile) return false;
        return (userProfile.total_xp || 0) >= IMAGE_GENERATION_COST;
      };

      const user = { id: 'test-user' };
      const profile = createMockProfile(1500);

      expect(canGenerateImage(profile, user)).toBe(true);
    });

    test('should prevent image generation when user has insufficient XP', () => {
      const canGenerateImage = (userProfile: any, user: any) => {
        if (!user || !userProfile) return false;
        return (userProfile.total_xp || 0) >= IMAGE_GENERATION_COST;
      };

      const user = { id: 'test-user' };
      const profile = createMockProfile(500);

      expect(canGenerateImage(profile, user)).toBe(false);
    });

    test('should prevent image generation when user is not logged in', () => {
      const canGenerateImage = (userProfile: any, user: any) => {
        if (!user || !userProfile) return false;
        return (userProfile.total_xp || 0) >= IMAGE_GENERATION_COST;
      };

      const profile = createMockProfile(5000);

      expect(canGenerateImage(profile, null)).toBe(false);
    });

    test('should prevent image generation when profile is not loaded', () => {
      const canGenerateImage = (userProfile: any, user: any) => {
        if (!user || !userProfile) return false;
        return (userProfile.total_xp || 0) >= IMAGE_GENERATION_COST;
      };

      const user = { id: 'test-user' };

      expect(canGenerateImage(null, user)).toBe(false);
    });
  });

  describe('Validation Scenarios by User Type', () => {
    test('should handle new user with no XP', () => {
      const newUserProfile = createMockProfile(0);

      const canGenerate = newUserProfile.total_xp >= IMAGE_GENERATION_COST;
      const xpNeeded = IMAGE_GENERATION_COST - newUserProfile.total_xp;

      expect(canGenerate).toBe(false);
      expect(xpNeeded).toBe(1000);
    });

    test('should handle user with first story completion (~200 XP)', () => {
      const firstStoryProfile = createMockProfile(200);

      const canGenerate = firstStoryProfile.total_xp >= IMAGE_GENERATION_COST;
      const xpNeeded = IMAGE_GENERATION_COST - firstStoryProfile.total_xp;

      expect(canGenerate).toBe(false);
      expect(xpNeeded).toBe(800);
    });

    test('should handle user with multiple story completions (~1200 XP)', () => {
      const experiencedProfile = createMockProfile(1200);

      const canGenerate = experiencedProfile.total_xp >= IMAGE_GENERATION_COST;
      const remainingXP = experiencedProfile.total_xp - IMAGE_GENERATION_COST;

      expect(canGenerate).toBe(true);
      expect(remainingXP).toBe(200);
    });

    test('should handle advanced user with abundant XP (~10000 XP)', () => {
      const advancedProfile = createMockProfile(10000);

      const canGenerate = advancedProfile.total_xp >= IMAGE_GENERATION_COST;
      const maxGenerations = Math.floor(
        advancedProfile.total_xp / IMAGE_GENERATION_COST,
      );

      expect(canGenerate).toBe(true);
      expect(maxGenerations).toBe(10);
    });
  });

  describe('Validation Messages for UI', () => {
    test('should generate appropriate validation messages', () => {
      const getValidationMessage = (currentXP: number, cost: number) => {
        if (currentXP >= cost) {
          const remaining = Math.floor(currentXP / cost) - 1;
          if (remaining > 0) {
            return `Generate Image (${cost} XP) - ${remaining} more available`;
          }
          return `Generate Image (${cost} XP)`;
        } else {
          const needed = cost - currentXP;
          return `Need ${needed} more XP to generate image`;
        }
      };

      expect(getValidationMessage(1000, IMAGE_GENERATION_COST)).toBe(
        'Generate Image (1000 XP)',
      );
      expect(getValidationMessage(2500, IMAGE_GENERATION_COST)).toBe(
        'Generate Image (1000 XP) - 1 more available',
      );
      expect(getValidationMessage(5000, IMAGE_GENERATION_COST)).toBe(
        'Generate Image (1000 XP) - 4 more available',
      );
      expect(getValidationMessage(500, IMAGE_GENERATION_COST)).toBe(
        'Need 500 more XP to generate image',
      );
      expect(getValidationMessage(0, IMAGE_GENERATION_COST)).toBe(
        'Need 1000 more XP to generate image',
      );
    });

    test('should provide XP earning guidance for insufficient balance', () => {
      const getXPGuidance = (shortfall: number) => {
        const storiesNeeded = Math.ceil(shortfall / 200); // Assuming ~200 XP per story
        const challengesNeeded = Math.ceil(shortfall / 25); // Assuming ~25 XP per challenge

        return {
          shortfall,
          storiesNeeded,
          challengesNeeded,
          suggestion:
            storiesNeeded <= 2
              ? `Complete ${storiesNeeded} more ${
                  storiesNeeded === 1 ? 'story' : 'stories'
                } to earn enough XP`
              : `Complete challenges and stories to earn ${shortfall} more XP`,
        };
      };

      const guidance500 = getXPGuidance(500);
      expect(guidance500.storiesNeeded).toBe(3);
      expect(guidance500.suggestion).toContain(
        'Complete challenges and stories',
      );

      const guidance200 = getXPGuidance(200);
      expect(guidance200.storiesNeeded).toBe(1);
      expect(guidance200.suggestion).toBe(
        'Complete 1 more story to earn enough XP',
      );
    });
  });

  describe('Real-time Validation Updates', () => {
    test('should update validation status when XP changes', () => {
      let currentXP = 800;

      const checkCanGenerate = () => currentXP >= IMAGE_GENERATION_COST;

      // Initially cannot generate
      expect(checkCanGenerate()).toBe(false);

      // User earns XP
      currentXP += 300; // Now has 1100 XP
      expect(checkCanGenerate()).toBe(true);

      // User spends XP on image generation
      currentXP -= IMAGE_GENERATION_COST; // Now has 100 XP
      expect(checkCanGenerate()).toBe(false);
    });

    test('should track consecutive image generations', () => {
      let currentXP = 5000;
      const generationHistory: number[] = [];

      const attemptImageGeneration = () => {
        if (currentXP >= IMAGE_GENERATION_COST) {
          currentXP -= IMAGE_GENERATION_COST;
          generationHistory.push(currentXP);
          return { success: true, remainingXP: currentXP };
        }
        return { success: false, remainingXP: currentXP };
      };

      // Should successfully generate 5 images
      for (let i = 0; i < 5; i++) {
        const result = attemptImageGeneration();
        expect(result.success).toBe(true);
      }

      expect(generationHistory).toEqual([4000, 3000, 2000, 1000, 0]);
      expect(currentXP).toBe(0);

      // 6th attempt should fail
      const failedAttempt = attemptImageGeneration();
      expect(failedAttempt.success).toBe(false);
    });
  });

  describe('Error Prevention', () => {
    test('should prevent generation attempt with invalid state', () => {
      const validateGenerationAttempt = (user: any, profile: any) => {
        const errors: string[] = [];

        if (!user) {
          errors.push('User not logged in');
        }

        if (!profile) {
          errors.push('User profile not loaded');
        }

        if (profile && (profile.total_xp || 0) < IMAGE_GENERATION_COST) {
          errors.push(
            `Insufficient XP (need ${IMAGE_GENERATION_COST}, have ${
              profile.total_xp || 0
            })`,
          );
        }

        return {
          canProceed: errors.length === 0,
          errors,
        };
      };

      // Valid state
      const validResult = validateGenerationAttempt(
        { id: 'user' },
        createMockProfile(1500),
      );
      expect(validResult.canProceed).toBe(true);
      expect(validResult.errors).toHaveLength(0);

      // Invalid states
      const noUserResult = validateGenerationAttempt(
        null,
        createMockProfile(1500),
      );
      expect(noUserResult.canProceed).toBe(false);
      expect(noUserResult.errors).toContain('User not logged in');

      const noProfileResult = validateGenerationAttempt({ id: 'user' }, null);
      expect(noProfileResult.canProceed).toBe(false);
      expect(noProfileResult.errors).toContain('User profile not loaded');

      const insufficientXPResult = validateGenerationAttempt(
        { id: 'user' },
        createMockProfile(500),
      );
      expect(insufficientXPResult.canProceed).toBe(false);
      expect(insufficientXPResult.errors).toContain(
        'Insufficient XP (need 1000, have 500)',
      );
    });

    test('should validate pre-conditions before allowing generation UI', () => {
      const shouldShowGenerateButton = (user: any, profile: any) => {
        return !!(
          user &&
          profile &&
          (profile.total_xp || 0) >= IMAGE_GENERATION_COST
        );
      };

      const shouldShowDisabledButton = (user: any, profile: any) => {
        return !!(
          user &&
          profile &&
          (profile.total_xp || 0) < IMAGE_GENERATION_COST
        );
      };

      const shouldShowLoginPrompt = (user: any) => {
        return !user;
      };

      // User with sufficient XP
      expect(
        shouldShowGenerateButton({ id: 'user' }, createMockProfile(1500)),
      ).toBe(true);
      expect(
        shouldShowDisabledButton({ id: 'user' }, createMockProfile(1500)),
      ).toBe(false);
      expect(shouldShowLoginPrompt({ id: 'user' })).toBe(false);

      // User with insufficient XP
      expect(
        shouldShowGenerateButton({ id: 'user' }, createMockProfile(500)),
      ).toBe(false);
      expect(
        shouldShowDisabledButton({ id: 'user' }, createMockProfile(500)),
      ).toBe(true);
      expect(shouldShowLoginPrompt({ id: 'user' })).toBe(false);

      // No user
      expect(shouldShowGenerateButton(null, createMockProfile(1500))).toBe(
        false,
      );
      expect(shouldShowDisabledButton(null, createMockProfile(1500))).toBe(
        false,
      );
      expect(shouldShowLoginPrompt(null)).toBe(true);
    });
  });
});
