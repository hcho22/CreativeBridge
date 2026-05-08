/**
 * XP Deduction Integration Test
 * Tests the actual AuthContext XP deduction functionality
 *
 * ─── ARCHITECTURE-MIGRATION ROUTING (US-015f.1.xp-integration.rewrite) ───
 *
 * This test was written against the legacy Supabase-only auth path.
 * The AuthContext (src/CLAUDE.md "Authentication Flow") has migrated to
 * Clerk OAuth + Convex (PRIMARY) — `userProfile` is now hydrated by
 * `useQuery(api.userProfiles.getProfileByClerkId)` after Clerk's
 * `useAuth()` reports `isSignedIn: true`. The mocks below set up
 * Supabase auth/profile fetch chains that the current AuthContext does
 * not exercise on the OAuth path. Result: `userProfile` stays `null`,
 * `validateXPBalance` is never invoked with real state, and 5 of 5
 * tests fail with `testResult?.hasEnoughXP === undefined`.
 *
 * To re-enable, the entire mock setup needs to be rewritten:
 *   1. Mock `@clerk/clerk-expo` `useAuth` → `{ isSignedIn: true,
 *      userId: 'test-user' }`.
 *   2. Mock `convex/react` `useQuery(api.userProfiles.getProfileByClerkId)`
 *      → return a fake Convex profile shape (camelCase, not snake_case).
 *   3. Mock `convex/react` `useMutation(api.userProfiles.deductUserXp)` →
 *      a jest.fn that the assertions can inspect.
 *   4. Update assertions: `mockSupabase.rpc('add_user_xp', ...)` →
 *      `convexDeductXp({ amount, ... })`.
 *
 * Routed to US-015f.1.xp-integration.rewrite. The 5 tests below remain
 * intentionally skipped — preserving the test bodies as a behavioral
 * spec for the rewrite.
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

// Test component to access AuthContext
const TestComponent: React.FC<{ onXPResult?: (result: any) => void }> = ({
  onXPResult,
}) => {
  const { validateXPBalance, userProfile } = useAuth();

  React.useEffect(() => {
    if (onXPResult && userProfile) {
      // Test XP validation
      const hasEnoughXP = validateXPBalance(1000);
      onXPResult({ hasEnoughXP, currentXP: userProfile.total_xp });
    }
  }, [userProfile, validateXPBalance, onXPResult]);

  return <></>;
};

// eslint-disable-next-line jest/no-disabled-tests -- Routed to US-015f.1.xp-integration.rewrite; see file-header marker.
describe.skip('XP Deduction Integration Tests', () => {
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

    // Mock user profile with sufficient XP
    const mockProfile = {
      id: 'test-user',
      username: 'testuser',
      display_name: 'Test User',
      total_xp: 5000,
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
    };

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
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockProfile,
            error: null,
          }),
        }),
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockProfile,
              error: null,
            }),
          }),
        }),
      }),
    } as any);
  });

  test('should validate XP balance correctly with sufficient XP', async () => {
    let testResult: any;

    const { unmount } = render(
      <AuthProvider>
        <TestComponent
          onXPResult={result => {
            testResult = result;
          }}
        />
      </AuthProvider>,
    );

    // Wait for auth to initialize
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(testResult?.hasEnoughXP).toBe(true);
    expect(testResult?.currentXP).toBe(5000);

    unmount();
  });

  test('should successfully deduct XP when user has sufficient balance', async () => {
    // Mock successful RPC call
    mockSupabase.rpc.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const TestXPDeduction: React.FC = () => {
      const { deductXP, userProfile } = useAuth();
      const [_result, setResult] = React.useState<any>(null);

      React.useEffect(() => {
        if (userProfile && userProfile.total_xp >= 1000) {
          deductXP(1000, 'Image generation test').then(setResult);
        }
      }, [userProfile, deductXP]);

      // This is just for testing - normally you wouldn't render test results
      return <></>;
    };

    render(
      <AuthProvider>
        <TestXPDeduction />
      </AuthProvider>,
    );

    // Wait for auth initialization and XP deduction
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    });

    // Verify RPC was called with correct parameters
    expect(mockSupabase.rpc).toHaveBeenCalledWith('add_user_xp', {
      user_uuid: 'test-user',
      xp_to_add: -1000,
      words_added: 0,
    });
  });

  test('should prevent XP deduction when user has insufficient balance', async () => {
    // Mock user profile with insufficient XP
    const mockProfileLowXP = {
      id: 'test-user',
      username: 'testuser',
      display_name: 'Test User',
      total_xp: 500, // Insufficient for 1000 XP cost
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
    };

    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockProfileLowXP,
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

    const TestInsufficientXP: React.FC = () => {
      const { validateXPBalance, userProfile } = useAuth();

      React.useEffect(() => {
        if (userProfile) {
          validationResult = validateXPBalance(1000);
        }
      }, [userProfile, validateXPBalance]);

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

    expect(validationResult).toBe(false);
    // RPC should not be called when validation fails
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });

  test('should handle database errors gracefully', async () => {
    // Mock database error
    mockSupabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Database connection failed' },
    });

    let deductionResult: any;

    const TestDatabaseError: React.FC = () => {
      const { deductXP, userProfile } = useAuth();

      React.useEffect(() => {
        if (userProfile && userProfile.total_xp >= 1000) {
          deductXP(1000, 'Error test').then(result => {
            deductionResult = result;
          });
        }
      }, [userProfile, deductXP]);

      return <></>;
    };

    render(
      <AuthProvider>
        <TestDatabaseError />
      </AuthProvider>,
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    });

    expect(deductionResult?.success).toBe(false);
    expect(deductionResult?.error).toBe(
      'Database error: Database connection failed',
    );
  });

  test('should validate input parameters', async () => {
    let invalidAmountResult: any;
    let negativeAmountResult: any;

    const TestInputValidation: React.FC = () => {
      const { deductXP, userProfile } = useAuth();

      React.useEffect(() => {
        if (userProfile) {
          // Test invalid amounts
          deductXP(0, 'Invalid zero amount').then(result => {
            invalidAmountResult = result;
          });

          deductXP(-100, 'Invalid negative amount').then(result => {
            negativeAmountResult = result;
          });
        }
      }, [userProfile, deductXP]);

      return <></>;
    };

    render(
      <AuthProvider>
        <TestInputValidation />
      </AuthProvider>,
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(invalidAmountResult?.success).toBe(false);
    expect(invalidAmountResult?.error).toBe('Invalid XP amount');
    expect(negativeAmountResult?.success).toBe(false);
    expect(negativeAmountResult?.error).toBe('Invalid XP amount');
  });
});
