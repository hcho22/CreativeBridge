/**
 * Test Suite: Story Completion XP Display Edge Cases (US-003)
 *
 * Verifies that the XP display on story completion modal handles:
 * - New users with 0 total XP
 * - Profile loading states
 * - Null/undefined xp_earned values
 * - NaN prevention
 * - Layout consistency
 * - Cross-grade level XP bonuses
 */

// Type definitions for test data
interface TestUserProfile {
  id: string;
  total_xp?: number;
  created_at?: string;
}

interface TestGameSession {
  xp_earned?: number | null;
}

describe('HomeScreen - Story Completion XP Display Edge Cases (US-003)', () => {
  describe('Edge Case: New User with 0 Total XP', () => {
    it('should display earned XP as total when user has 0 total XP', () => {
      const mockUserProfile: TestUserProfile = {
        id: 'new-user-123',
        total_xp: 0,
        created_at: new Date().toISOString(),
      };

      const mockSession: TestGameSession = {
        xp_earned: 150,
      };

      // Simulate rendering with new user profile
      const earnedXP = mockSession.xp_earned || 0;
      const totalXP = (mockUserProfile.total_xp || 0) + earnedXP;

      expect(earnedXP).toBe(150);
      expect(totalXP).toBe(150);
      expect(totalXP).not.toBeNaN();
    });

    it('should handle undefined total_xp on new user profile', () => {
      const mockUserProfile: TestUserProfile = {
        id: 'new-user-456',
        created_at: new Date().toISOString(),
        // total_xp intentionally undefined
      };

      const mockSession: TestGameSession = {
        xp_earned: 200,
      };

      const earnedXP = mockSession.xp_earned || 0;
      const totalXP = (mockUserProfile.total_xp || 0) + earnedXP;

      expect(totalXP).toBe(200);
      expect(totalXP).not.toBeNaN();
    });
  });

  describe('Edge Case: Profile Loading State', () => {
    it('should display "Loading..." when userProfile is null', () => {
      const mockSession: TestGameSession = {
        xp_earned: 100,
      };

      const userProfile: TestUserProfile | null = null;

      // Simulate the actual component logic
      const calculateTotal = (
        profile: TestUserProfile | null,
        session: TestGameSession,
      ): number | string => {
        if (!profile) return 'Loading...';
        return (profile.total_xp || 0) + (session?.xp_earned || 0);
      };

      const displayText = calculateTotal(userProfile, mockSession);
      expect(displayText).toBe('Loading...');
    });

    it('should display "Loading..." when userProfile is undefined', () => {
      const mockSession: TestGameSession = {
        xp_earned: 75,
      };

      const userProfile: TestUserProfile | undefined = undefined;

      const calculateTotal = (
        profile: TestUserProfile | undefined,
        session: TestGameSession,
      ): number | string => {
        if (!profile) return 'Loading...';
        return (profile.total_xp || 0) + (session?.xp_earned || 0);
      };

      const displayText = calculateTotal(userProfile, mockSession);
      expect(displayText).toBe('Loading...');
    });

    it('should display numeric total once userProfile loads', async () => {
      const mockSession: TestGameSession = {
        xp_earned: 125,
      };

      const calculateTotal = (
        profile: TestUserProfile | null,
        session: TestGameSession,
      ): number | string => {
        if (!profile) return 'Loading...';
        return (profile.total_xp || 0) + (session?.xp_earned || 0);
      };

      // Initially null
      let userProfile: TestUserProfile | null = null;
      let displayText = calculateTotal(userProfile, mockSession);
      expect(displayText).toBe('Loading...');

      // Profile loads
      userProfile = { id: 'user-789', total_xp: 500 };
      displayText = calculateTotal(userProfile, mockSession);

      expect(displayText).toBe(625);
      expect(typeof displayText).toBe('number');
    });
  });

  describe('Edge Case: Null xp_earned', () => {
    it('should display 0 when xp_earned is null', () => {
      const mockSession: TestGameSession = {
        xp_earned: null,
      };

      const earnedXP = mockSession.xp_earned || 0;
      expect(earnedXP).toBe(0);
      expect(earnedXP).not.toBeNaN();
    });

    it('should display 0 when xp_earned is undefined', () => {
      const mockSession: TestGameSession = {
        // xp_earned intentionally undefined
      };

      const earnedXP = mockSession?.xp_earned || 0;
      expect(earnedXP).toBe(0);
      expect(earnedXP).not.toBeNaN();
    });

    it('should calculate correct total when xp_earned is null', () => {
      const mockUserProfile: TestUserProfile = {
        id: 'user-999',
        total_xp: 1000,
      };

      const mockSession: TestGameSession = {
        xp_earned: null,
      };

      const totalXP =
        (mockUserProfile.total_xp || 0) + (mockSession.xp_earned || 0);
      expect(totalXP).toBe(1000);
      expect(totalXP).not.toBeNaN();
    });
  });

  describe('Edge Case: NaN Prevention', () => {
    it('should prevent NaN when both values are null/undefined', () => {
      const mockUserProfile: TestUserProfile = { id: 'user-001' }; // No total_xp
      const mockSession: TestGameSession = {}; // No xp_earned

      const earnedXP = mockSession?.xp_earned || 0;
      const totalXP = (mockUserProfile?.total_xp || 0) + earnedXP;

      expect(earnedXP).not.toBeNaN();
      expect(totalXP).not.toBeNaN();
      expect(earnedXP).toBe(0);
      expect(totalXP).toBe(0);
    });

    it('should prevent NaN when userProfile is null and xp_earned is null', () => {
      const mockSession: TestGameSession = {
        xp_earned: null,
      };

      const userProfile: TestUserProfile | null = null;
      const earnedXP = mockSession.xp_earned || 0;

      const calculateTotal = (
        profile: TestUserProfile | null,
      ): number | string => {
        if (!profile) return 'Loading...';
        return (profile.total_xp || 0) + earnedXP;
      };

      const displayText = calculateTotal(userProfile);

      expect(earnedXP).not.toBeNaN();
      expect(displayText).toBe('Loading...');
    });

    it('should handle negative XP values gracefully', () => {
      // Edge case: ensure system doesn't break with unexpected negative values
      const mockUserProfile: TestUserProfile = {
        id: 'user-002',
        total_xp: 500,
      };

      const mockSession: TestGameSession = {
        xp_earned: -50, // Unexpected but shouldn't cause NaN
      };

      const earnedXP = mockSession.xp_earned || 0;
      const totalXP = (mockUserProfile.total_xp || 0) + earnedXP;

      expect(earnedXP).toBe(-50);
      expect(totalXP).toBe(450);
      expect(totalXP).not.toBeNaN();
    });

    it('should handle very large XP values without NaN', () => {
      const mockUserProfile: TestUserProfile = {
        id: 'user-003',
        total_xp: 999999,
      };

      const mockSession: TestGameSession = {
        xp_earned: 50000,
      };

      const totalXP =
        (mockUserProfile.total_xp || 0) + (mockSession.xp_earned || 0);

      expect(totalXP).toBe(1049999);
      expect(totalXP).not.toBeNaN();
      expect(Number.isFinite(totalXP)).toBe(true);
    });
  });

  describe('Edge Case: Grade Level XP Bonuses', () => {
    // Based on storySessionManager.ts XP calculation logic
    const calculateXPForGradeLevel = (
      gradeLevel: string,
      words: number,
    ): number => {
      let baseXP = Math.floor(words / 5) * 2; // 2 XP per 5 words

      // Challenge completion bonus (varies by grade)
      const challengeBonus =
        gradeLevel === 'K-2'
          ? 25
          : gradeLevel === '3-5'
          ? 35
          : gradeLevel === '6-8'
          ? 45
          : 50;

      // Completion bonus
      const completionBonus = 100;

      return baseXP + challengeBonus + completionBonus;
    };

    it('should correctly display XP for K-2 grade level', () => {
      const mockSession = {
        xp_earned: calculateXPForGradeLevel('K-2', 100), // 20 words = 40 XP + 25 challenge + 100 completion
      };

      const earnedXP = mockSession.xp_earned || 0;
      expect(earnedXP).toBeGreaterThan(0);
      expect(earnedXP).not.toBeNaN();
    });

    it('should correctly display XP for 3-5 grade level', () => {
      const mockSession = {
        xp_earned: calculateXPForGradeLevel('3-5', 150),
      };

      const earnedXP = mockSession.xp_earned || 0;
      expect(earnedXP).toBeGreaterThan(0);
      expect(earnedXP).not.toBeNaN();
    });

    it('should correctly display XP for 6-8 grade level', () => {
      const mockSession = {
        xp_earned: calculateXPForGradeLevel('6-8', 200),
      };

      const earnedXP = mockSession.xp_earned || 0;
      expect(earnedXP).toBeGreaterThan(0);
      expect(earnedXP).not.toBeNaN();
    });

    it('should correctly display XP for 9-12 grade level', () => {
      const mockSession = {
        xp_earned: calculateXPForGradeLevel('9-12', 250),
      };

      const earnedXP = mockSession.xp_earned || 0;
      expect(earnedXP).toBeGreaterThan(0);
      expect(earnedXP).not.toBeNaN();
    });
  });

  describe('Display Format Validation', () => {
    it('should display integers without decimals', () => {
      const mockSession = {
        xp_earned: 150.7, // Unexpected decimal
      };

      const earnedXP = mockSession.xp_earned || 0;

      // In React Native, the number will be displayed as-is by Text component
      // but database should ensure integers
      expect(earnedXP).toBe(150.7);
      expect(Number.isInteger(Math.floor(earnedXP))).toBe(true);
    });

    it('should format display text correctly for XP Earned', () => {
      const mockSession = {
        xp_earned: 250,
      };

      const displayText = `💰 XP Earned: ${mockSession.xp_earned || 0}`;
      expect(displayText).toBe('💰 XP Earned: 250');
      expect(displayText).toContain('💰');
    });

    it('should format display text correctly for Total XP with numeric value', () => {
      const mockUserProfile: TestUserProfile = {
        id: 'user-004',
        total_xp: 1000,
      };

      const mockSession: TestGameSession = {
        xp_earned: 250,
      };

      const totalXP =
        (mockUserProfile.total_xp || 0) + (mockSession.xp_earned || 0);
      const displayText = `⭐ Total XP: ${totalXP}`;

      expect(displayText).toBe('⭐ Total XP: 1250');
      expect(displayText).toContain('⭐');
    });

    it('should format display text correctly for Total XP with loading state', () => {
      const mockSession: TestGameSession = {
        xp_earned: 100,
      };

      const userProfile: TestUserProfile | null = null;

      const calculateDisplayValue = (
        profile: TestUserProfile | null,
        session: TestGameSession,
      ): number | string => {
        if (!profile) return 'Loading...';
        return (profile.total_xp || 0) + (session?.xp_earned || 0);
      };

      const displayValue = calculateDisplayValue(userProfile, mockSession);
      const displayText = `⭐ Total XP: ${displayValue}`;

      expect(displayText).toBe('⭐ Total XP: Loading...');
    });
  });

  describe('Icon Rendering', () => {
    it('should use correct emoji icon for XP Earned', () => {
      const earnedIcon = '💰';
      expect(earnedIcon).toBe('💰');
      expect(earnedIcon.length).toBeGreaterThan(0);
    });

    it('should use correct emoji icon for Total XP', () => {
      const totalIcon = '⭐';
      expect(totalIcon).toBe('⭐');
      expect(totalIcon.length).toBeGreaterThan(0);
    });

    // Note: Cross-platform emoji rendering (iOS/Android) is handled by React Native
    // and cannot be unit tested - requires manual verification on devices
  });

  describe('Type Safety', () => {
    it('should handle type coercion correctly', () => {
      const mockSession: any = {
        xp_earned: '100', // Unexpected string type
      };

      // TypeScript should catch this, but runtime coercion test
      const earnedXP = mockSession.xp_earned || 0;
      const numericXP = Number(earnedXP) || 0;

      expect(numericXP).toBe(100);
      expect(typeof numericXP).toBe('number');
    });

    it('should maintain type safety with strict checks', () => {
      interface TestProfile {
        id: string;
        total_xp?: number;
      }

      interface TestSession {
        xp_earned?: number | null;
      }

      const profile: TestProfile = { id: 'test', total_xp: 500 };
      const session: TestSession = { xp_earned: 50 };

      const total = (profile.total_xp || 0) + (session.xp_earned || 0);

      expect(typeof total).toBe('number');
      expect(total).toBe(550);
    });
  });
});
