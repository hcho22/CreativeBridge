/**
 * XP Refund Integration Test
 * Tests the actual AuthContext XP refund functionality
 *
 * ─── ARCHITECTURE-MIGRATION ROUTING (US-015f.1.xp-integration.rewrite) ───
 *
 * Same situation as xpDeductionIntegration.test.tsx (see that file's
 * header marker for full context). Tests AuthContext through the
 * legacy Supabase path; AuthContext has migrated to Clerk + Convex
 * (PRIMARY) so `userProfile` never hydrates with the supplied mocks.
 * 6 of 6 tests fail wholesale.
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

// eslint-disable-next-line jest/no-disabled-tests -- Routed to US-015f.1.xp-integration.rewrite; see file-header marker.
describe.skip('XP Refund Integration Tests', () => {
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

  test('should successfully refund XP with proper validation', async () => {
    // Mock successful RPC call for refund
    mockSupabase.rpc.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    let refundResult: any = null;

    const TestXPRefund: React.FC = () => {
      const { refundXP, userProfile } = useAuth();

      React.useEffect(() => {
        if (userProfile) {
          refundXP(1000, 'Image generation API timeout').then(result => {
            refundResult = result;
          });
        }
      }, [userProfile, refundXP]);

      return <></>;
    };

    render(
      <AuthProvider>
        <TestXPRefund />
      </AuthProvider>,
    );

    // Wait for auth initialization and XP refund
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    });

    expect(refundResult?.success).toBe(true);
    expect(refundResult?.newBalance).toBe(6000); // 5000 + 1000 refund

    // Verify RPC was called with correct parameters for refund
    expect(mockSupabase.rpc).toHaveBeenCalledWith('add_user_xp', {
      user_uuid: 'test-user',
      xp_to_add: 1000, // Positive amount for refund
      words_added: 0,
    });
  });

  test('should reject refund with invalid parameters', async () => {
    let invalidAmountResult: any = null;
    let emptyReasonResult: any = null;

    const TestInvalidRefunds: React.FC = () => {
      const { refundXP, userProfile } = useAuth();

      React.useEffect(() => {
        if (userProfile) {
          // Test invalid amount
          refundXP(0, 'Valid reason').then(result => {
            invalidAmountResult = result;
          });

          // Test empty reason
          refundXP(1000, '').then(result => {
            emptyReasonResult = result;
          });
        }
      }, [userProfile, refundXP]);

      return <></>;
    };

    render(
      <AuthProvider>
        <TestInvalidRefunds />
      </AuthProvider>,
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(invalidAmountResult?.success).toBe(false);
    expect(invalidAmountResult?.error).toBe('Invalid refund amount');

    expect(emptyReasonResult?.success).toBe(false);
    expect(emptyReasonResult?.error).toBe('Refund reason is required');

    // No RPC calls should be made for invalid parameters
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });

  test('should handle database errors gracefully during refund', async () => {
    // Mock database error
    mockSupabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Database connection failed during refund' },
    });

    let refundResult: any = null;

    const TestDatabaseError: React.FC = () => {
      const { refundXP, userProfile } = useAuth();

      React.useEffect(() => {
        if (userProfile) {
          refundXP(1000, 'Service failure').then(result => {
            refundResult = result;
          });
        }
      }, [userProfile, refundXP]);

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

    expect(refundResult?.success).toBe(false);
    expect(refundResult?.error).toBe(
      'Database error: Database connection failed during refund',
    );
  });

  test('should complete full deduction-refund cycle correctly', async () => {
    // Mock successful deduction followed by successful refund
    mockSupabase.rpc
      .mockResolvedValueOnce({ data: null, error: null }) // Deduction
      .mockResolvedValueOnce({ data: null, error: null }); // Refund

    let deductionResult: any = null;
    let refundResult: any = null;
    let finalBalance: number | undefined;

    const TestFullCycle: React.FC = () => {
      const { deductXP, refundXP, userProfile } = useAuth();

      React.useEffect(() => {
        if (userProfile && userProfile.total_xp >= 1000) {
          // Step 1: Deduct XP for image generation attempt
          deductXP(1000, 'Image generation attempt').then(deductResult => {
            deductionResult = deductResult;

            if (deductResult.success) {
              // Step 2: Simulate image generation failure and refund
              refundXP(1000, 'Image generation failed - API timeout').then(
                refundRes => {
                  refundResult = refundRes;
                  finalBalance = refundRes.newBalance;
                },
              );
            }
          });
        }
      }, [userProfile, deductXP, refundXP]);

      return <></>;
    };

    render(
      <AuthProvider>
        <TestFullCycle />
      </AuthProvider>,
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 300));
    });

    // Verify deduction succeeded
    expect(deductionResult?.success).toBe(true);
    expect(deductionResult?.newBalance).toBe(4000); // 5000 - 1000

    // Verify refund succeeded
    expect(refundResult?.success).toBe(true);
    expect(finalBalance).toBe(5000); // Back to original 5000

    // Verify both RPC calls were made
    expect(mockSupabase.rpc).toHaveBeenCalledTimes(2);
    expect(mockSupabase.rpc).toHaveBeenNthCalledWith(1, 'add_user_xp', {
      user_uuid: 'test-user',
      xp_to_add: -1000, // Deduction
      words_added: 0,
    });
    expect(mockSupabase.rpc).toHaveBeenNthCalledWith(2, 'add_user_xp', {
      user_uuid: 'test-user',
      xp_to_add: 1000, // Refund
      words_added: 0,
    });
  });

  test('should handle multiple refunds correctly', async () => {
    // Mock multiple successful refund calls
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

    const refundResults: any[] = [];

    const TestMultipleRefunds: React.FC = () => {
      const { refundXP, userProfile } = useAuth();

      React.useEffect(() => {
        if (userProfile) {
          // Simulate multiple failed image generation attempts
          const reasons = [
            'First attempt - API timeout',
            'Second attempt - Content safety',
            'Third attempt - Service unavailable',
          ];

          reasons.forEach((reason, index) => {
            setTimeout(() => {
              refundXP(1000, reason).then(result => {
                refundResults.push({ attempt: index + 1, ...result });
              });
            }, index * 50);
          });
        }
      }, [userProfile, refundXP]);

      return <></>;
    };

    render(
      <AuthProvider>
        <TestMultipleRefunds />
      </AuthProvider>,
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 400));
    });

    expect(refundResults.length).toBe(3);
    expect(refundResults.every(r => r.success)).toBe(true);

    // Each refund should increase balance by 1000
    expect(refundResults[0].newBalance).toBe(6000); // 5000 + 1000
    expect(refundResults[1].newBalance).toBe(7000); // 6000 + 1000
    expect(refundResults[2].newBalance).toBe(8000); // 7000 + 1000

    expect(mockSupabase.rpc).toHaveBeenCalledTimes(3);
  });

  test('should maintain data integrity during concurrent operations', async () => {
    // Mock successful operations
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

    let operationResults: any[] = [];

    const TestConcurrentOperations: React.FC = () => {
      const { deductXP, refundXP, userProfile } = useAuth();

      React.useEffect(() => {
        if (userProfile) {
          // Simulate concurrent deduction and refund operations
          Promise.all([
            deductXP(500, 'Partial image generation attempt'),
            refundXP(300, 'Partial refund for previous failure'),
            deductXP(200, 'Another small deduction'),
          ]).then(results => {
            operationResults = results;
          });
        }
      }, [userProfile, deductXP, refundXP]);

      return <></>;
    };

    render(
      <AuthProvider>
        <TestConcurrentOperations />
      </AuthProvider>,
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    });

    expect(operationResults.length).toBe(3);
    expect(operationResults.every(r => r.success)).toBe(true);

    // Verify all operations were recorded
    expect(mockSupabase.rpc).toHaveBeenCalledTimes(3);
  });
});
