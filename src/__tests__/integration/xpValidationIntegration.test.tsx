/**
 * XP Validation Integration Test
 * Tests the actual AuthContext validation prevents image generation when XP < 1000
 *
 * ─── ARCHITECTURE-MIGRATION ROUTING (US-015f.1.xp-integration.rewrite) ───
 *
 * Same situation as xpDeductionIntegration.test.tsx (see that file's
 * header marker for full context). Tests AuthContext through the
 * legacy Supabase path; AuthContext has migrated to Clerk + Convex
 * (PRIMARY) so `userProfile` never hydrates with the supplied mocks.
 * 6 of 8 tests fail; the other 2 happen to assert default-state
 * behavior that doesn't depend on a populated profile.
 *
 * Re-enable after rewriting the mock setup against the Clerk + Convex
 * surface (see xpDeductionIntegration.test.tsx header for the rewrite
 * recipe). Tests below remain skipped via describe.skip as a
 * behavioral spec for the rewrite. Routed to
 * US-015f.1.xp-integration.rewrite.
 */

import React from 'react';
import { render, act } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';

// Mock Supabase
jest.mock('../../services/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      resend: jest.fn(),
      getUser: jest.fn(),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
        })),
        ilike: jest.fn(),
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(),
          })),
        })),
      })),
    })),
    rpc: jest.fn(),
  },
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  multiRemove: jest.fn(),
  getAllKeys: jest.fn(() => Promise.resolve([])),
}));

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

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

// eslint-disable-next-line jest/no-disabled-tests -- Routed to US-015f.1.xp-integration.rewrite; see file-header marker.
describe.skip('XP Validation Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock successful auth session
    mockSupabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'test-user',
            email: 'test@example.com',
            email_confirmed_at: new Date().toISOString(),
          },
          access_token: 'token',
          refresh_token: 'refresh',
          expires_at: Date.now() + 3600000,
          expires_in: 3600,
          token_type: 'bearer',
        } as any,
      },
      error: null,
    });
  });

  test('should prevent image generation when user has XP < 1000', async () => {
    // Mock user profile with insufficient XP (500 XP)
    const mockProfile = createMockProfile(500);

    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockProfile,
            error: null,
          }),
        }),
        ilike: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      }),
      insert: jest.fn(),
      update: jest.fn(),
    } as any);

    let validationResult: boolean | undefined;
    let balanceInfo: any;
    let canGenerate: boolean | undefined;

    const TestInsufficientXP: React.FC = () => {
      const {
        validateXPBalance,
        getXPBalanceInfo,
        canGenerateImage,
        userProfile,
      } = useAuth();

      React.useEffect(() => {
        if (userProfile) {
          validationResult = validateXPBalance(1000);
          balanceInfo = getXPBalanceInfo(1000);
          canGenerate = canGenerateImage();
        }
      }, [userProfile, validateXPBalance, getXPBalanceInfo, canGenerateImage]);

      return <></>;
    };

    render(
      <AuthProvider>
        <TestInsufficientXP />
      </AuthProvider>,
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // All validation functions should return false for insufficient XP
    expect(validationResult).toBe(false);
    expect(canGenerate).toBe(false);

    // Balance info should show insufficient funds
    expect(balanceInfo?.hasEnoughXP).toBe(false);
    expect(balanceInfo?.currentXP).toBe(500);
    expect(balanceInfo?.shortfall).toBe(500);
    expect(balanceInfo?.canGenerate).toBe(false);
    expect(balanceInfo?.maxGenerations).toBe(0);
  });

  test('should allow image generation when user has XP >= 1000', async () => {
    // Mock user profile with sufficient XP (1500 XP)
    const mockProfile = createMockProfile(1500);

    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockProfile,
            error: null,
          }),
        }),
        ilike: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      }),
      insert: jest.fn(),
      update: jest.fn(),
    } as any);

    let validationResult: boolean | undefined;
    let balanceInfo: any;
    let canGenerate: boolean | undefined;

    const TestSufficientXP: React.FC = () => {
      const {
        validateXPBalance,
        getXPBalanceInfo,
        canGenerateImage,
        userProfile,
      } = useAuth();

      React.useEffect(() => {
        if (userProfile) {
          validationResult = validateXPBalance(1000);
          balanceInfo = getXPBalanceInfo(1000);
          canGenerate = canGenerateImage();
        }
      }, [userProfile, validateXPBalance, getXPBalanceInfo, canGenerateImage]);

      return <></>;
    };

    render(
      <AuthProvider>
        <TestSufficientXP />
      </AuthProvider>,
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // All validation functions should return true for sufficient XP
    expect(validationResult).toBe(true);
    expect(canGenerate).toBe(true);

    // Balance info should show sufficient funds
    expect(balanceInfo?.hasEnoughXP).toBe(true);
    expect(balanceInfo?.currentXP).toBe(1500);
    expect(balanceInfo?.shortfall).toBe(0);
    expect(balanceInfo?.canGenerate).toBe(true);
    expect(balanceInfo?.maxGenerations).toBe(1);
  });

  test('should prevent image generation when user has exactly 999 XP', async () => {
    // Mock user profile with 1 XP short of requirement
    const mockProfile = createMockProfile(999);

    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockProfile,
            error: null,
          }),
        }),
        ilike: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      }),
      insert: jest.fn(),
      update: jest.fn(),
    } as any);

    let canGenerate: boolean | undefined;
    let balanceInfo: any;

    const TestEdgeCase: React.FC = () => {
      const { canGenerateImage, getXPBalanceInfo, userProfile } = useAuth();

      React.useEffect(() => {
        if (userProfile) {
          canGenerate = canGenerateImage();
          balanceInfo = getXPBalanceInfo(1000);
        }
      }, [userProfile, canGenerateImage, getXPBalanceInfo]);

      return <></>;
    };

    render(
      <AuthProvider>
        <TestEdgeCase />
      </AuthProvider>,
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(canGenerate).toBe(false);
    expect(balanceInfo?.shortfall).toBe(1);
    expect(balanceInfo?.maxGenerations).toBe(0);
  });

  test('should allow image generation when user has exactly 1000 XP', async () => {
    // Mock user profile with exact requirement
    const mockProfile = createMockProfile(1000);

    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockProfile,
            error: null,
          }),
        }),
        ilike: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      }),
      insert: jest.fn(),
      update: jest.fn(),
    } as any);

    let canGenerate: boolean | undefined;
    let balanceInfo: any;

    const TestExactAmount: React.FC = () => {
      const { canGenerateImage, getXPBalanceInfo, userProfile } = useAuth();

      React.useEffect(() => {
        if (userProfile) {
          canGenerate = canGenerateImage();
          balanceInfo = getXPBalanceInfo(1000);
        }
      }, [userProfile, canGenerateImage, getXPBalanceInfo]);

      return <></>;
    };

    render(
      <AuthProvider>
        <TestExactAmount />
      </AuthProvider>,
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(canGenerate).toBe(true);
    expect(balanceInfo?.hasEnoughXP).toBe(true);
    expect(balanceInfo?.shortfall).toBe(0);
    expect(balanceInfo?.maxGenerations).toBe(1);
  });

  test('should prevent image generation when user is not logged in', async () => {
    // Mock no session
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    let canGenerate: boolean | undefined;

    const TestNoUser: React.FC = () => {
      const { canGenerateImage } = useAuth();

      React.useEffect(() => {
        canGenerate = canGenerateImage();
      }, [canGenerateImage]);

      return <></>;
    };

    render(
      <AuthProvider>
        <TestNoUser />
      </AuthProvider>,
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(canGenerate).toBe(false);
  });

  test('should prevent image generation when profile is not loaded', async () => {
    // Mock session but no profile
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Profile not found' },
          }),
        }),
        ilike: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      }),
      insert: jest.fn(),
      update: jest.fn(),
    } as any);

    let canGenerate: boolean | undefined;

    const TestNoProfile: React.FC = () => {
      const { canGenerateImage, userProfile } = useAuth();

      React.useEffect(() => {
        // Only test after auth has tried to load profile
        if (userProfile === null) {
          canGenerate = canGenerateImage();
        }
      }, [canGenerateImage, userProfile]);

      return <></>;
    };

    render(
      <AuthProvider>
        <TestNoProfile />
      </AuthProvider>,
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(canGenerate).toBe(false);
  });

  test('should calculate maximum image generations correctly', async () => {
    // Test with various XP amounts
    const testCases = [
      { xp: 5000, expectedMax: 5 },
      { xp: 2500, expectedMax: 2 },
      { xp: 1999, expectedMax: 1 },
      { xp: 1000, expectedMax: 1 },
      { xp: 999, expectedMax: 0 },
      { xp: 0, expectedMax: 0 },
    ];

    for (const testCase of testCases) {
      const mockProfile = createMockProfile(testCase.xp);

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockProfile,
              error: null,
            }),
          }),
          ilike: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
        insert: jest.fn(),
        update: jest.fn(),
      } as any);

      let maxGenerations: number | undefined;

      const TestMaxGenerations: React.FC = () => {
        const { getXPBalanceInfo, userProfile } = useAuth();

        React.useEffect(() => {
          if (userProfile) {
            const balanceInfo = getXPBalanceInfo(1000);
            maxGenerations = balanceInfo.maxGenerations;
          }
        }, [userProfile, getXPBalanceInfo]);

        return <></>;
      };

      const { unmount } = render(
        <AuthProvider>
          <TestMaxGenerations />
        </AuthProvider>,
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(maxGenerations).toBe(testCase.expectedMax);

      unmount();
    }
  });

  test('should provide accurate shortfall calculations', async () => {
    // Test shortfall calculations for users with insufficient XP
    const testCases = [
      { currentXP: 500, expectedShortfall: 500 },
      { currentXP: 750, expectedShortfall: 250 },
      { currentXP: 999, expectedShortfall: 1 },
      { currentXP: 0, expectedShortfall: 1000 },
      { currentXP: 1000, expectedShortfall: 0 },
      { currentXP: 1500, expectedShortfall: 0 },
    ];

    for (const testCase of testCases) {
      const mockProfile = createMockProfile(testCase.currentXP);

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockProfile,
              error: null,
            }),
          }),
          ilike: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
        insert: jest.fn(),
        update: jest.fn(),
      } as any);

      let shortfall: number | undefined;

      const TestShortfall: React.FC = () => {
        const { getXPBalanceInfo, userProfile } = useAuth();

        React.useEffect(() => {
          if (userProfile) {
            const balanceInfo = getXPBalanceInfo(1000);
            shortfall = balanceInfo.shortfall;
          }
        }, [userProfile, getXPBalanceInfo]);

        return <></>;
      };

      const { unmount } = render(
        <AuthProvider>
          <TestShortfall />
        </AuthProvider>,
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(shortfall).toBe(testCase.expectedShortfall);

      unmount();
    }
  });
});
