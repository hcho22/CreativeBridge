// Auth Integration Tests (US-019)
// Comprehensive tests for Clerk email/password auth flows:
//   - Sign-up with email verification (US-002/003)
//   - Sign-in with Clerk email/password (US-005)
//   - Password reset flow (US-006)
//   - Supabase → Clerk migration (US-007)
//   - Invalid verification code handling
//   - Network error handling during migration

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mocks — jest.mock factories are hoisted above imports. To reference mutable
// mock objects from within factories, we use closures (mockImplementation)
// so variable references are resolved at call-time, not at hoist-time.
// Variables prefixed with `mock` are hoisted by Jest's babel plugin.
// ---------------------------------------------------------------------------

// Clerk hook mock functions
const mockSignUpCreate = jest.fn();
const mockPrepareEmailVerification = jest.fn();
const mockAttemptEmailVerification = jest.fn();
const mockSignInCreate = jest.fn();
const mockSignInAttemptFirstFactor = jest.fn();
const mockSignInPrepareSecondFactor = jest.fn();
const mockSignInResetPassword = jest.fn();
const mockSetActiveSignUp = jest.fn();
const mockSetActiveSignIn = jest.fn();
const mockClerkSignOut = jest.fn();

// Mutable Clerk state (reconfigured per-test)
const mockClerkState = {
  isSignedIn: false,
  userId: null as string | null,
  signUpAvailable: true,
  signInAvailable: true,
};

jest.mock('../../hooks/useSafeClerkAuth', () => ({
  useSafeClerkAuth: () => ({
    clerkAuth: {
      get isSignedIn() {
        return mockClerkState.isSignedIn;
      },
      get userId() {
        return mockClerkState.userId;
      },
      signOut: mockClerkSignOut,
      getToken: jest.fn(),
    },
    clerkUser: null,
    clerkSSO: null,
    clerkSignIn: {
      get signIn() {
        if (!mockClerkState.signInAvailable) return null;
        return {
          create: mockSignInCreate,
          attemptFirstFactor: mockSignInAttemptFirstFactor,
          prepareSecondFactor: mockSignInPrepareSecondFactor,
          resetPassword: mockSignInResetPassword,
        };
      },
      setActive: mockSetActiveSignIn,
      isLoaded: true,
    },
    clerkSignUp: {
      get signUp() {
        if (!mockClerkState.signUpAvailable) return null;
        return {
          create: mockSignUpCreate,
          prepareEmailAddressVerification: mockPrepareEmailVerification,
          attemptEmailAddressVerification: mockAttemptEmailVerification,
        };
      },
      setActive: mockSetActiveSignUp,
      isLoaded: true,
    },
  }),
}));

// Supabase mock
const mockSupabaseSignInWithPassword = jest.fn();
const mockSupabaseSignOut = jest.fn().mockResolvedValue({ error: null });
const mockSupabaseFrom = jest.fn();

jest.mock('../../services/supabase', () => ({
  supabase: {
    auth: {
      get signInWithPassword() {
        return mockSupabaseSignInWithPassword;
      },
      get signOut() {
        return mockSupabaseSignOut;
      },
    },
    get from() {
      return mockSupabaseFrom;
    },
  },
}));

// Convex mock — uses mockImplementation so mockConvexMutation is resolved at call-time
const mockConvexMutation = jest.fn().mockResolvedValue(undefined);

jest.mock('convex/react', () => ({
  useQuery: jest.fn().mockReturnValue(null),
  useMutation: jest.fn().mockImplementation(() => mockConvexMutation),
  useConvex: jest.fn().mockReturnValue({ query: jest.fn() }),
}));

jest.mock('../../services/convex', () => ({
  api: {
    userProfiles: {
      getProfileByClerkId: 'getProfileByClerkId',
      createOAuthProfile: 'createOAuthProfile',
      updateProfile: 'updateProfile',
      addUserXp: 'addUserXp',
      deductUserXp: 'deductUserXp',
      refundUserXp: 'refundUserXp',
      migrateUserStats: 'migrateUserStats',
    },
    migration: {
      migrateUserGameSessions: 'migrateUserGameSessions',
      logMigrationEvent: 'logMigrationEvent',
    },
  },
}));

// AsyncStorage mock — inline, with reference obtained via require after imports
jest.mock('../../utils/asyncStorageWrapper', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
    getAllKeys: jest.fn().mockResolvedValue([]),
    multiRemove: jest.fn().mockResolvedValue(undefined),
    multiGet: jest.fn().mockResolvedValue([]),
    multiSet: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
  },
}));

// Token cache mock
jest.mock('../../utils/clerkTokenCache', () => ({
  clearAllClerkTokens: jest.fn().mockResolvedValue(undefined),
  clearAndVerifyTokens: jest.fn().mockResolvedValue(true),
  hasClerkTokens: jest.fn().mockResolvedValue(false),
  clerkTokenCache: { clearToken: jest.fn() },
}));

// Remaining dependency mocks
jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
}));

jest.mock('../../services/xpEventTracker', () => ({
  xpEventTracker: {
    trackXPDeduction: jest.fn(),
    trackXPRefund: jest.fn(),
    trackXPValidation: jest.fn(),
    calculateXPCost: jest.fn().mockReturnValue(1000),
    createImageGenerationEvent: jest
      .fn()
      .mockResolvedValue({ success: true, eventId: 'test' }),
  },
}));

jest.mock('../../utils/rememberMeStorage', () => ({
  RememberMeStorage: {
    setRememberMe: jest.fn(),
    getRememberMe: jest.fn().mockResolvedValue({ isEnabled: false }),
    clearRememberMe: jest.fn(),
  },
}));

jest.mock('../../services/reactotron', () => ({
  log: jest.fn(),
  error: jest.fn(),
}));

// Import after mocks are registered
import { AuthProvider, useAuth } from '../../context/AuthContext';

// Obtain the mock AsyncStorage reference created by the factory
const mockAsyncStorage = require('../../utils/asyncStorageWrapper').default;

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('Clerk Auth Flows Integration Tests (US-019)', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mutable Clerk state
    mockClerkState.isSignedIn = false;
    mockClerkState.userId = null;
    mockClerkState.signUpAvailable = true;
    mockClerkState.signInAvailable = true;

    // Re-set default return values (clearAllMocks clears call history, not implementations,
    // but mockResolvedValue set inline in factory is not affected — only those set via
    // beforeEach need refreshing)
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue(undefined);
    mockAsyncStorage.removeItem.mockResolvedValue(undefined);
    mockAsyncStorage.getAllKeys.mockResolvedValue([]);

    mockSupabaseSignInWithPassword.mockResolvedValue({
      data: {},
      error: null,
    });
    mockSupabaseSignOut.mockResolvedValue({ error: null });
    mockSupabaseFrom.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    });

    mockConvexMutation.mockResolvedValue(undefined);
  });

  // =========================================================================
  // 1. New User Sign-Up with Email Verification (US-002 / US-003)
  // =========================================================================

  describe('Sign-up with email verification', () => {
    it('should create Clerk account and return needsVerification on success', async () => {
      mockSignUpCreate.mockResolvedValue({});
      mockPrepareEmailVerification.mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuth(), { wrapper });

      let signUpResult: any;
      await act(async () => {
        signUpResult = await result.current.signUpWithClerk(
          'new@example.com',
          'Password123!',
          { username: 'newuser', gradeLevel: 'K-2' as any },
        );
      });

      expect(signUpResult).toEqual({ needsVerification: true });
      expect(mockSignUpCreate).toHaveBeenCalledWith({
        emailAddress: 'new@example.com',
        password: 'Password123!',
      });
      expect(mockPrepareEmailVerification).toHaveBeenCalledWith({
        strategy: 'email_code',
      });
      // Pending profile stored in AsyncStorage
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        '@CreativeBridge:pendingClerkProfile',
        expect.stringContaining('"username":"newuser"'),
      );
    });

    it('should store displayName defaulting to username when not provided', async () => {
      mockSignUpCreate.mockResolvedValue({});
      mockPrepareEmailVerification.mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.signUpWithClerk(
          'test@example.com',
          'Password123!',
          { username: 'testuser', gradeLevel: '3-5' as any },
        );
      });

      const storedProfile = JSON.parse(
        mockAsyncStorage.setItem.mock.calls.find(
          (call: any) => call[0] === '@CreativeBridge:pendingClerkProfile',
        )[1],
      );
      expect(storedProfile.displayName).toBe('testuser');
    });

    it('should return error for duplicate email', async () => {
      mockSignUpCreate.mockRejectedValue(
        new Error('That email_address is taken. Please try another.'),
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      let signUpResult: any;
      await act(async () => {
        signUpResult = await result.current.signUpWithClerk(
          'existing@example.com',
          'Password123!',
          { username: 'existinguser', gradeLevel: 'K-2' as any },
        );
      });

      expect(signUpResult.error).toContain('already registered');
    });

    it('should return error for breached password', async () => {
      mockSignUpCreate.mockRejectedValue(
        new Error(
          'Password has been found in an online data breach. For account safety, please use a different password.',
        ),
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      let signUpResult: any;
      await act(async () => {
        signUpResult = await result.current.signUpWithClerk(
          'test@example.com',
          'password123',
          { username: 'user', gradeLevel: 'K-2' as any },
        );
      });

      expect(signUpResult.error).toContain('data breach');
    });

    it('should return error for weak password', async () => {
      mockSignUpCreate.mockRejectedValue(new Error('Password is too weak.'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      let signUpResult: any;
      await act(async () => {
        signUpResult = await result.current.signUpWithClerk(
          'test@example.com',
          'abc',
          { username: 'user', gradeLevel: 'K-2' as any },
        );
      });

      expect(signUpResult.error).toContain('too weak');
    });

    it('should return error for short password', async () => {
      mockSignUpCreate.mockRejectedValue(
        new Error('Password is too short. Minimum 8 characters.'),
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      let signUpResult: any;
      await act(async () => {
        signUpResult = await result.current.signUpWithClerk(
          'test@example.com',
          '1234',
          { username: 'user', gradeLevel: 'K-2' as any },
        );
      });

      expect(signUpResult.error).toContain('8 characters');
    });

    it('should return error when Clerk is not available', async () => {
      mockClerkState.signUpAvailable = false;

      const { result } = renderHook(() => useAuth(), { wrapper });

      let signUpResult: any;
      await act(async () => {
        signUpResult = await result.current.signUpWithClerk(
          'test@example.com',
          'Password123!',
          { username: 'user', gradeLevel: 'K-2' as any },
        );
      });

      expect(signUpResult.error).toContain('not configured');
    });

    it('should return error for rate limiting', async () => {
      mockSignUpCreate.mockRejectedValue(new Error('Rate limit exceeded'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      let signUpResult: any;
      await act(async () => {
        signUpResult = await result.current.signUpWithClerk(
          'test@example.com',
          'Password123!',
          { username: 'user', gradeLevel: 'K-2' as any },
        );
      });

      expect(signUpResult.error).toContain('Too many');
    });
  });

  // =========================================================================
  // 2. Email Verification (US-003)
  // =========================================================================

  describe('Email verification (verifyEmailCode)', () => {
    it('should verify code, activate session, and create Convex profile', async () => {
      mockAttemptEmailVerification.mockResolvedValue({
        status: 'complete',
        createdSessionId: 'sess_abc123',
        createdUserId: 'user_clerk123',
      });
      mockSetActiveSignUp.mockResolvedValue(undefined);

      // Pending profile available in AsyncStorage
      mockAsyncStorage.getItem.mockImplementation((key: string) => {
        if (key === '@CreativeBridge:pendingClerkProfile') {
          return Promise.resolve(
            JSON.stringify({
              username: 'newuser',
              displayName: 'New User',
              gradeLevel: 'K-2',
              email: 'new@example.com',
              createdAt: new Date().toISOString(),
            }),
          );
        }
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      let verifyResult: any;
      await act(async () => {
        verifyResult = await result.current.verifyEmailCode('123456');
      });

      expect(verifyResult).toEqual({});
      expect(mockAttemptEmailVerification).toHaveBeenCalledWith({
        code: '123456',
      });
      expect(mockSetActiveSignUp).toHaveBeenCalledWith({
        session: 'sess_abc123',
      });
      // Convex profile creation (mutation called with profile args)
      expect(mockConvexMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          clerkUserId: 'user_clerk123',
          username: 'newuser',
          displayName: 'New User',
          preferredGradeLevel: 'K-2',
        }),
      );
      // Pending profile cleared
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(
        '@CreativeBridge:pendingClerkProfile',
      );
    });

    it('should succeed even without pending profile (graceful degradation)', async () => {
      mockAttemptEmailVerification.mockResolvedValue({
        status: 'complete',
        createdSessionId: 'sess_abc123',
        createdUserId: 'user_clerk123',
      });
      mockSetActiveSignUp.mockResolvedValue(undefined);
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const { result } = renderHook(() => useAuth(), { wrapper });

      let verifyResult: any;
      await act(async () => {
        verifyResult = await result.current.verifyEmailCode('123456');
      });

      // Should succeed — no profile creation, but session activated
      expect(verifyResult).toEqual({});
      expect(mockSetActiveSignUp).toHaveBeenCalled();
    });

    it('should return error for incomplete verification status', async () => {
      mockAttemptEmailVerification.mockResolvedValue({
        status: 'pending',
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      let verifyResult: any;
      await act(async () => {
        verifyResult = await result.current.verifyEmailCode('000000');
      });

      expect(verifyResult.error).toContain('not complete');
    });

    it('should return error when no session created', async () => {
      mockAttemptEmailVerification.mockResolvedValue({
        status: 'complete',
        createdSessionId: null,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      let verifyResult: any;
      await act(async () => {
        verifyResult = await result.current.verifyEmailCode('123456');
      });

      expect(verifyResult.error).toContain('session could not be created');
    });

    it('should return error when Clerk signUp is unavailable', async () => {
      mockClerkState.signUpAvailable = false;

      const { result } = renderHook(() => useAuth(), { wrapper });

      let verifyResult: any;
      await act(async () => {
        verifyResult = await result.current.verifyEmailCode('123456');
      });

      expect(verifyResult.error).toContain('not available');
    });

    it('should complete migration Phase B when pending migration data exists', async () => {
      mockAttemptEmailVerification.mockResolvedValue({
        status: 'complete',
        createdSessionId: 'sess_mig123',
        createdUserId: 'user_migrated1',
      });
      mockSetActiveSignUp.mockResolvedValue(undefined);

      // Both pending profile and migration data available
      mockAsyncStorage.getItem.mockImplementation((key: string) => {
        if (key === '@CreativeBridge:pendingClerkProfile') {
          return Promise.resolve(
            JSON.stringify({
              username: 'migrateduser',
              displayName: 'Migrated User',
              gradeLevel: '3-5',
              email: 'migrated@example.com',
              createdAt: new Date().toISOString(),
            }),
          );
        }
        if (key === '@CreativeBridge:pendingMigration') {
          return Promise.resolve(
            JSON.stringify({
              supabaseUserId: 'sb-uuid-123',
              email: 'migrated@example.com',
              totalXp: 5000,
              currentStreak: 3,
              longestStreak: 7,
              bestScore: 95,
              totalGamesPlayed: 20,
              totalStoriesCompleted: 15,
              totalWordsWritten: 3000,
              lastActivityDate: '2026-02-20',
              preferredGradeLevel: '3-5',
              onboardingCompleted: true,
              onboardingProgress: {
                create_account: true,
                first_story: true,
                first_image: true,
                first_voice: false,
                first_streak: true,
              },
              gameSessions: [
                {
                  completedAt: '2026-02-18',
                  gradeLevel: '3-5',
                  finalScore: 90,
                  wordsWritten: 200,
                  sentencesCompleted: 5,
                  challengesCompleted: 3,
                  xpEarned: 100,
                  currentRound: 3,
                },
              ],
            }),
          );
        }
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      let verifyResult: any;
      await act(async () => {
        verifyResult = await result.current.verifyEmailCode('654321');
      });

      expect(verifyResult).toEqual({});
      // Convex profile created + stats migrated + sessions migrated
      // (all via the same mockConvexMutation since useMutation returns it for all mutations)
      expect(mockConvexMutation).toHaveBeenCalled();
      // Supabase signed out after migration
      expect(mockSupabaseSignOut).toHaveBeenCalled();
      // Migration data cleared
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(
        '@CreativeBridge:pendingMigration',
      );
    });

    it('should handle migration Phase B failure gracefully (non-fatal)', async () => {
      mockAttemptEmailVerification.mockResolvedValue({
        status: 'complete',
        createdSessionId: 'sess_abc',
        createdUserId: 'user_new',
      });
      mockSetActiveSignUp.mockResolvedValue(undefined);

      // Pending profile present, migration data is invalid JSON
      mockAsyncStorage.getItem.mockImplementation((key: string) => {
        if (key === '@CreativeBridge:pendingClerkProfile') {
          return Promise.resolve(
            JSON.stringify({
              username: 'user',
              displayName: 'User',
              gradeLevel: 'K-2',
              email: 'user@example.com',
              createdAt: new Date().toISOString(),
            }),
          );
        }
        if (key === '@CreativeBridge:pendingMigration') {
          return Promise.resolve('INVALID JSON{{{{');
        }
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      let verifyResult: any;
      await act(async () => {
        verifyResult = await result.current.verifyEmailCode('123456');
      });

      // Migration failure is non-fatal — verification still succeeds
      expect(verifyResult).toEqual({});
      expect(mockSetActiveSignUp).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 3. Handling of Invalid Verification Codes
  // =========================================================================

  describe('Invalid verification codes', () => {
    it('should return error for invalid/incorrect code', async () => {
      mockAttemptEmailVerification.mockRejectedValue(
        new Error('Incorrect code provided'),
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      let verifyResult: any;
      await act(async () => {
        verifyResult = await result.current.verifyEmailCode('000000');
      });

      expect(verifyResult.error).toContain('Invalid verification code');
    });

    it('should return error for expired verification', async () => {
      // Note: error message must NOT contain "code"/"incorrect"/"invalid"
      // because the AuthContext error handler checks those keywords first
      mockAttemptEmailVerification.mockRejectedValue(
        new Error('Verification has expired. Request a new one.'),
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      let verifyResult: any;
      await act(async () => {
        verifyResult = await result.current.verifyEmailCode('111111');
      });

      expect(verifyResult.error).toContain('expired');
    });

    it('should return rate-limit error for too many attempts', async () => {
      mockAttemptEmailVerification.mockRejectedValue(
        new Error('Rate limit exceeded'),
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      let verifyResult: any;
      await act(async () => {
        verifyResult = await result.current.verifyEmailCode('999999');
      });

      expect(verifyResult.error).toContain('Too many');
    });

    it('should return generic error for unexpected failures', async () => {
      mockAttemptEmailVerification.mockRejectedValue(
        new Error('Something completely unexpected'),
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      let verifyResult: any;
      await act(async () => {
        verifyResult = await result.current.verifyEmailCode('555555');
      });

      // Falls through to the raw error message
      expect(verifyResult.error).toBe('Something completely unexpected');
    });
  });

  // =========================================================================
  // 4. Resend Verification Code (US-004)
  // =========================================================================

  describe('Resend verification code', () => {
    it('should resend verification code successfully', async () => {
      mockPrepareEmailVerification.mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuth(), { wrapper });

      let resendResult: any;
      await act(async () => {
        resendResult = await result.current.resendClerkVerificationCode();
      });

      expect(resendResult).toEqual({});
      expect(mockPrepareEmailVerification).toHaveBeenCalledWith({
        strategy: 'email_code',
      });
    });

    it('should return error when Clerk is unavailable', async () => {
      mockClerkState.signUpAvailable = false;

      const { result } = renderHook(() => useAuth(), { wrapper });

      let resendResult: any;
      await act(async () => {
        resendResult = await result.current.resendClerkVerificationCode();
      });

      expect(resendResult.error).toContain('not available');
    });

    it('should return rate-limit error', async () => {
      mockPrepareEmailVerification.mockRejectedValue(
        new Error('Rate limit exceeded'),
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      let resendResult: any;
      await act(async () => {
        resendResult = await result.current.resendClerkVerificationCode();
      });

      expect(resendResult.error).toContain('Too many');
    });
  });

  // =========================================================================
  // 5. Sign-In with Clerk Email/Password (US-005)
  // =========================================================================

  describe('Sign-in with Clerk email/password', () => {
    it('should sign in successfully and activate session', async () => {
      mockSignInCreate.mockResolvedValue({
        status: 'complete',
        createdSessionId: 'sess_signin123',
      });
      mockSetActiveSignIn.mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuth(), { wrapper });

      let signInResult: any;
      await act(async () => {
        signInResult = await result.current.signInWithClerk(
          'user@example.com',
          'Password123!',
        );
      });

      expect(signInResult).toEqual({});
      expect(mockSignInCreate).toHaveBeenCalledWith({
        identifier: 'user@example.com',
        password: 'Password123!',
      });
      expect(mockSetActiveSignIn).toHaveBeenCalledWith({
        session: 'sess_signin123',
      });
    });

    it('should return needsMigration when user not found in Clerk', async () => {
      const clerkError: any = new Error('User not found');
      clerkError.errors = [{ code: 'form_identifier_not_found' }];
      mockSignInCreate.mockRejectedValue(clerkError);

      const { result } = renderHook(() => useAuth(), { wrapper });

      let signInResult: any;
      await act(async () => {
        signInResult = await result.current.signInWithClerk(
          'legacy@example.com',
          'password',
        );
      });

      expect(signInResult).toEqual({ needsMigration: true });
    });

    it('should return error for incorrect password', async () => {
      const clerkError: any = new Error('Password incorrect');
      clerkError.errors = [{ code: 'form_password_incorrect' }];
      mockSignInCreate.mockRejectedValue(clerkError);

      const { result } = renderHook(() => useAuth(), { wrapper });

      let signInResult: any;
      await act(async () => {
        signInResult = await result.current.signInWithClerk(
          'user@example.com',
          'wrongpassword',
        );
      });

      expect(signInResult).toEqual({ error: 'Invalid credentials' });
    });

    it('should return error for OAuth-only accounts', async () => {
      const clerkError: any = new Error('Strategy invalid');
      clerkError.errors = [{ code: 'strategy_for_user_invalid' }];
      mockSignInCreate.mockRejectedValue(clerkError);

      const { result } = renderHook(() => useAuth(), { wrapper });

      let signInResult: any;
      await act(async () => {
        signInResult = await result.current.signInWithClerk(
          'oauth@example.com',
          'password',
        );
      });

      expect(signInResult.error).toContain('social sign-in');
    });

    it('should return needsSecondFactor when 2FA is required', async () => {
      mockSignInCreate.mockResolvedValue({
        status: 'needs_second_factor',
        supportedSecondFactors: [{ strategy: 'email_code' }],
      });
      mockSignInPrepareSecondFactor.mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuth(), { wrapper });

      let signInResult: any;
      await act(async () => {
        signInResult = await result.current.signInWithClerk(
          'user@example.com',
          'Password123!',
        );
      });

      expect(signInResult).toEqual({ needsSecondFactor: true });
      expect(mockSignInPrepareSecondFactor).toHaveBeenCalledWith({
        strategy: 'email_code',
      });
    });

    it('should return error when Clerk is unavailable', async () => {
      mockClerkState.signInAvailable = false;

      const { result } = renderHook(() => useAuth(), { wrapper });

      let signInResult: any;
      await act(async () => {
        signInResult = await result.current.signInWithClerk(
          'user@example.com',
          'password',
        );
      });

      expect(signInResult.error).toContain('not available');
    });

    it('should return error for network failures', async () => {
      mockSignInCreate.mockRejectedValue(new Error('Network request failed'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      let signInResult: any;
      await act(async () => {
        signInResult = await result.current.signInWithClerk(
          'user@example.com',
          'password',
        );
      });

      expect(signInResult.error).toContain('Network error');
    });

    it('should return error for rate limiting', async () => {
      mockSignInCreate.mockRejectedValue(new Error('Rate limit exceeded'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      let signInResult: any;
      await act(async () => {
        signInResult = await result.current.signInWithClerk(
          'user@example.com',
          'password',
        );
      });

      expect(signInResult.error).toContain('Too many');
    });

    it('should return error for incomplete sign-in status', async () => {
      mockSignInCreate.mockResolvedValue({
        status: 'needs_identifier',
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      let signInResult: any;
      await act(async () => {
        signInResult = await result.current.signInWithClerk(
          'user@example.com',
          'password',
        );
      });

      expect(signInResult.error).toContain('incomplete');
    });
  });

  // =========================================================================
  // 6. Sign-In wrapper (signIn) — delegates to signInWithClerk
  // =========================================================================

  describe('signIn wrapper (Clerk-first)', () => {
    it('should delegate to signInWithClerk and return success', async () => {
      mockSignInCreate.mockResolvedValue({
        status: 'complete',
        createdSessionId: 'sess_wrap1',
      });
      mockSetActiveSignIn.mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuth(), { wrapper });

      let signInResult: any;
      await act(async () => {
        signInResult = await result.current.signIn(
          'user@example.com',
          'Password123!',
        );
      });

      expect(signInResult).toEqual({});
    });

    it('should propagate needsMigration from signInWithClerk', async () => {
      const clerkError: any = new Error('Not found');
      clerkError.errors = [{ code: 'form_identifier_not_found' }];
      mockSignInCreate.mockRejectedValue(clerkError);

      const { result } = renderHook(() => useAuth(), { wrapper });

      let signInResult: any;
      await act(async () => {
        signInResult = await result.current.signIn(
          'legacy@example.com',
          'password',
        );
      });

      expect(signInResult).toEqual({ needsMigration: true });
    });

    it('should propagate needsSecondFactor from signInWithClerk', async () => {
      mockSignInCreate.mockResolvedValue({
        status: 'needs_second_factor',
        supportedSecondFactors: [{ strategy: 'email_code' }],
      });
      mockSignInPrepareSecondFactor.mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuth(), { wrapper });

      let signInResult: any;
      await act(async () => {
        signInResult = await result.current.signIn(
          'user@example.com',
          'Password123!',
        );
      });

      expect(signInResult).toEqual({ needsSecondFactor: true });
    });
  });

  // =========================================================================
  // 7. Password Reset Flow (US-006)
  // =========================================================================

  describe('Password reset flow', () => {
    describe('resetPasswordWithClerk', () => {
      it('should send reset code and return needsCode', async () => {
        mockSignInCreate.mockResolvedValue({});

        const { result } = renderHook(() => useAuth(), { wrapper });

        let resetResult: any;
        await act(async () => {
          resetResult = await result.current.resetPasswordWithClerk(
            'user@example.com',
          );
        });

        expect(resetResult).toEqual({ needsCode: true });
        expect(mockSignInCreate).toHaveBeenCalledWith({
          strategy: 'reset_password_email_code',
          identifier: 'user@example.com',
        });
      });

      it('should return error when user not found', async () => {
        const clerkError: any = new Error('Not found');
        clerkError.errors = [{ code: 'form_identifier_not_found' }];
        mockSignInCreate.mockRejectedValue(clerkError);

        const { result } = renderHook(() => useAuth(), { wrapper });

        let resetResult: any;
        await act(async () => {
          resetResult = await result.current.resetPasswordWithClerk(
            'unknown@example.com',
          );
        });

        expect(resetResult.error).toContain('No account found');
      });

      it('should return error for OAuth-only accounts', async () => {
        const clerkError: any = new Error('Strategy invalid');
        clerkError.errors = [{ code: 'strategy_for_user_invalid' }];
        mockSignInCreate.mockRejectedValue(clerkError);

        const { result } = renderHook(() => useAuth(), { wrapper });

        let resetResult: any;
        await act(async () => {
          resetResult = await result.current.resetPasswordWithClerk(
            'oauth@example.com',
          );
        });

        expect(resetResult.error).toContain('social sign-in');
      });

      it('should return error when Clerk is unavailable', async () => {
        mockClerkState.signInAvailable = false;

        const { result } = renderHook(() => useAuth(), { wrapper });

        let resetResult: any;
        await act(async () => {
          resetResult = await result.current.resetPasswordWithClerk(
            'user@example.com',
          );
        });

        expect(resetResult.error).toContain('not available');
      });

      it('should return error for rate limiting', async () => {
        mockSignInCreate.mockRejectedValue(new Error('Rate limit exceeded'));

        const { result } = renderHook(() => useAuth(), { wrapper });

        let resetResult: any;
        await act(async () => {
          resetResult = await result.current.resetPasswordWithClerk(
            'user@example.com',
          );
        });

        expect(resetResult.error).toContain('Too many');
      });
    });

    describe('verifyPasswordResetCode', () => {
      it('should verify code and set new password successfully', async () => {
        mockSignInAttemptFirstFactor.mockResolvedValue({
          status: 'needs_new_password',
        });
        mockSignInResetPassword.mockResolvedValue({
          status: 'complete',
          createdSessionId: 'sess_reset123',
        });
        mockSetActiveSignIn.mockResolvedValue(undefined);

        const { result } = renderHook(() => useAuth(), { wrapper });

        let verifyResult: any;
        await act(async () => {
          verifyResult = await result.current.verifyPasswordResetCode(
            '123456',
            'NewPassword123!',
          );
        });

        expect(verifyResult).toEqual({});
        expect(mockSignInAttemptFirstFactor).toHaveBeenCalledWith({
          strategy: 'reset_password_email_code',
          code: '123456',
        });
        expect(mockSignInResetPassword).toHaveBeenCalledWith({
          password: 'NewPassword123!',
          signOutOfOtherSessions: true,
        });
        expect(mockSetActiveSignIn).toHaveBeenCalledWith({
          session: 'sess_reset123',
        });
      });

      it('should handle direct complete status from attemptFirstFactor', async () => {
        mockSignInAttemptFirstFactor.mockResolvedValue({
          status: 'complete',
          createdSessionId: 'sess_direct',
        });
        mockSetActiveSignIn.mockResolvedValue(undefined);

        const { result } = renderHook(() => useAuth(), { wrapper });

        let verifyResult: any;
        await act(async () => {
          verifyResult = await result.current.verifyPasswordResetCode(
            '123456',
            'NewPassword123!',
          );
        });

        expect(verifyResult).toEqual({});
        expect(mockSetActiveSignIn).toHaveBeenCalledWith({
          session: 'sess_direct',
        });
        // resetPassword should NOT be called
        expect(mockSignInResetPassword).not.toHaveBeenCalled();
      });

      it('should return error when Clerk is unavailable', async () => {
        mockClerkState.signInAvailable = false;

        const { result } = renderHook(() => useAuth(), { wrapper });

        let verifyResult: any;
        await act(async () => {
          verifyResult = await result.current.verifyPasswordResetCode(
            '123456',
            'NewPassword123!',
          );
        });

        expect(verifyResult.error).toContain('not available');
      });

      it('should return error for incomplete reset after password change', async () => {
        mockSignInAttemptFirstFactor.mockResolvedValue({
          status: 'needs_new_password',
        });
        mockSignInResetPassword.mockResolvedValue({
          status: 'needs_second_factor',
        });

        const { result } = renderHook(() => useAuth(), { wrapper });

        let verifyResult: any;
        await act(async () => {
          verifyResult = await result.current.verifyPasswordResetCode(
            '123456',
            'NewPassword123!',
          );
        });

        expect(verifyResult.error).toContain('incomplete');
      });
    });
  });

  // =========================================================================
  // 8. Migration Flow — Supabase to Clerk (US-007)
  // =========================================================================

  describe('Supabase to Clerk migration (migrateFromSupabase)', () => {
    // Helper to set up a valid Supabase profile response
    const setupSupabaseProfile = (
      userId: string,
      overrides: Record<string, any> = {},
    ) => {
      mockSupabaseSignInWithPassword.mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      });

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'user_profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: userId,
                    username: 'legacyuser',
                    display_name: 'Legacy User',
                    preferred_grade_level: '3-5',
                    total_xp: 5000,
                    current_streak: 3,
                    longest_streak: 7,
                    best_score: 95,
                    total_games_played: 20,
                    total_stories_completed: 15,
                    total_words_written: 3000,
                    last_activity_date: '2026-02-20',
                    onboarding_completed: true,
                    onboarding_progress: {
                      create_account: true,
                      first_story: true,
                      first_image: false,
                      first_voice: false,
                      first_streak: false,
                    },
                    ...overrides,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'game_sessions') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [
                  {
                    completed_at: '2026-02-18',
                    grade_level: '3-5',
                    final_score: 90,
                    words_written: 200,
                    sentences_completed: 5,
                    challenges_completed: 3,
                    xp_earned: 100,
                    current_round: 3,
                  },
                ],
                error: null,
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
        };
      });
    };

    it('should complete Phase A: verify Supabase, create Clerk, return needsVerification', async () => {
      setupSupabaseProfile('sb-uuid-123');
      mockSignUpCreate.mockResolvedValue({});
      mockPrepareEmailVerification.mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuth(), { wrapper });

      let migrationResult: any;
      await act(async () => {
        migrationResult = await result.current.migrateFromSupabase(
          'legacy@example.com',
          'legacypassword',
        );
      });

      expect(migrationResult).toEqual({ needsVerification: true });
      // Verified Supabase credentials
      expect(mockSupabaseSignInWithPassword).toHaveBeenCalledWith({
        email: 'legacy@example.com',
        password: 'legacypassword',
      });
      // Created Clerk account
      expect(mockSignUpCreate).toHaveBeenCalledWith({
        emailAddress: 'legacy@example.com',
        password: 'legacypassword',
      });
      // Migration data stored
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        '@CreativeBridge:pendingMigration',
        expect.any(String),
      );
      // Pending profile stored
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        '@CreativeBridge:pendingClerkProfile',
        expect.any(String),
      );
    });

    it('should return error for invalid Supabase credentials', async () => {
      mockSupabaseSignInWithPassword.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid login credentials' },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      let migrationResult: any;
      await act(async () => {
        migrationResult = await result.current.migrateFromSupabase(
          'wrong@example.com',
          'wrongpassword',
        );
      });

      expect(migrationResult.error).toContain('Invalid login credentials');
    });

    it('should return error when Supabase profile not found', async () => {
      mockSupabaseSignInWithPassword.mockResolvedValue({
        data: { user: { id: 'sb-uuid-456' } },
        error: null,
      });

      mockSupabaseFrom.mockImplementation(() => ({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Row not found' },
            }),
          }),
        }),
      }));

      const { result } = renderHook(() => useAuth(), { wrapper });

      let migrationResult: any;
      await act(async () => {
        migrationResult = await result.current.migrateFromSupabase(
          'noprofile@example.com',
          'password',
        );
      });

      expect(migrationResult.error).toContain('profile data');
    });

    it('should complete directly when Clerk account already exists', async () => {
      setupSupabaseProfile('sb-uuid-789');

      // Clerk sign-up fails because account exists
      const clerkError: any = new Error('Email taken');
      clerkError.errors = [{ code: 'form_identifier_exists' }];
      mockSignUpCreate.mockRejectedValue(clerkError);

      // Sign-in to existing Clerk account succeeds
      mockSignInCreate.mockResolvedValue({
        status: 'complete',
        createdSessionId: 'sess_existing',
      });
      mockSetActiveSignIn.mockResolvedValue(undefined);

      // Set clerkAuth.userId for completeMigrationDirectly
      mockClerkState.userId = 'user_existing_clerk';
      mockClerkState.isSignedIn = true;

      const { result } = renderHook(() => useAuth(), { wrapper });

      let migrationResult: any;
      await act(async () => {
        migrationResult = await result.current.migrateFromSupabase(
          'existing@example.com',
          'password',
        );
      });

      expect(migrationResult).toEqual({});
      // Signed in to existing Clerk account
      expect(mockSignInCreate).toHaveBeenCalledWith({
        identifier: 'existing@example.com',
        password: 'password',
      });
      // Convex mutations called (profile + stats + sessions)
      expect(mockConvexMutation).toHaveBeenCalled();
      // Supabase signed out
      expect(mockSupabaseSignOut).toHaveBeenCalled();
    });

    it('should return error when Clerk is unavailable during migration', async () => {
      setupSupabaseProfile('sb-uuid-999');
      mockClerkState.signUpAvailable = false;

      const { result } = renderHook(() => useAuth(), { wrapper });

      let migrationResult: any;
      await act(async () => {
        migrationResult = await result.current.migrateFromSupabase(
          'user@example.com',
          'password',
        );
      });

      expect(migrationResult.error).toContain('not available');
    });

    it('should handle game session fetch failure gracefully (non-fatal)', async () => {
      mockSupabaseSignInWithPassword.mockResolvedValue({
        data: { user: { id: 'sb-uuid-111' } },
        error: null,
      });

      // Profile found, but game sessions fail
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'user_profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: 'sb-uuid-111',
                    username: 'user',
                    total_xp: 100,
                    current_streak: 0,
                    longest_streak: 0,
                    best_score: 0,
                    total_games_played: 0,
                    total_stories_completed: 0,
                    total_words_written: 0,
                    last_activity_date: '2026-02-26',
                    preferred_grade_level: 'K-2',
                    onboarding_completed: false,
                    onboarding_progress: {
                      create_account: true,
                      first_story: false,
                      first_image: false,
                      first_voice: false,
                      first_streak: false,
                    },
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'game_sessions') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockRejectedValue(new Error('Network timeout')),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
        };
      });

      mockSignUpCreate.mockResolvedValue({});
      mockPrepareEmailVerification.mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuth(), { wrapper });

      let migrationResult: any;
      await act(async () => {
        migrationResult = await result.current.migrateFromSupabase(
          'user@example.com',
          'password',
        );
      });

      // Migration proceeds despite session fetch failure
      expect(migrationResult).toEqual({ needsVerification: true });
    });
  });

  // =========================================================================
  // 9. Network Error Handling During Migration
  // =========================================================================

  describe('Network errors during migration', () => {
    it('should return error when Supabase auth throws', async () => {
      mockSupabaseSignInWithPassword.mockRejectedValue(
        new Error('Network request failed'),
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      let migrationResult: any;
      await act(async () => {
        migrationResult = await result.current.migrateFromSupabase(
          'user@example.com',
          'password',
        );
      });

      expect(migrationResult.error).toContain('Network request failed');
    });

    it('should return error when Clerk account creation fails unexpectedly', async () => {
      mockSupabaseSignInWithPassword.mockResolvedValue({
        data: { user: { id: 'sb-uuid-net1' } },
        error: null,
      });

      mockSupabaseFrom.mockImplementation(() => ({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'sb-uuid-net1',
                username: 'netuser',
                total_xp: 0,
                current_streak: 0,
                longest_streak: 0,
                best_score: 0,
                total_games_played: 0,
                total_stories_completed: 0,
                total_words_written: 0,
                last_activity_date: '2026-02-26',
                preferred_grade_level: 'K-2',
                onboarding_completed: false,
                onboarding_progress: {
                  create_account: true,
                  first_story: false,
                  first_image: false,
                  first_voice: false,
                  first_streak: false,
                },
              },
              error: null,
            }),
          }),
        }),
      }));

      // Clerk throws unexpected error (not "already exists")
      mockSignUpCreate.mockRejectedValue(new Error('Internal server error'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      let migrationResult: any;
      await act(async () => {
        migrationResult = await result.current.migrateFromSupabase(
          'user@example.com',
          'password',
        );
      });

      expect(migrationResult.error).toContain('Internal server error');
    });
  });

  // =========================================================================
  // 10. resetPassword wrapper
  // =========================================================================

  describe('resetPassword wrapper', () => {
    it('should delegate to resetPasswordWithClerk', async () => {
      mockSignInCreate.mockResolvedValue({});

      const { result } = renderHook(() => useAuth(), { wrapper });

      let resetResult: any;
      await act(async () => {
        resetResult = await result.current.resetPassword('user@example.com');
      });

      expect(mockSignInCreate).toHaveBeenCalledWith({
        strategy: 'reset_password_email_code',
        identifier: 'user@example.com',
      });
    });
  });
});
