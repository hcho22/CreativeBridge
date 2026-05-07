// Authentication flow integration tests (US-016: Clerk-only)
// Tests AuthContext interface shape and behavior via renderHook.
// Component-level rendering tests for AuthScreen are deferred to E2E tests
// due to extensive native module dependencies (navigation, OAuth buttons, etc.)
import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';

// Mock dependencies — Supabase still imported by AuthContext for migrateFromSupabase
jest.mock('../../services/supabase', () => ({
  supabase: {
    auth: {
      signOut: jest.fn(() => Promise.resolve({ error: null })),
      signInWithPassword: jest.fn(() =>
        Promise.resolve({ data: {}, error: null }),
      ),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      single: jest.fn(() => Promise.resolve({ data: null, error: null })),
    })),
  },
}));

// Mock Clerk hooks
jest.mock('../../hooks/useSafeClerkAuth', () => ({
  useSafeClerkAuth: () => ({
    clerkAuth: {
      isSignedIn: false,
      userId: null,
      signOut: jest.fn(),
      getToken: jest.fn(),
    },
    clerkUser: null,
    clerkSSO: null,
    clerkSignIn: null,
    clerkSignUp: null,
  }),
}));

jest.mock('convex/react', () => ({
  useQuery: jest.fn().mockReturnValue(null),
  useMutation: jest.fn().mockReturnValue(jest.fn()),
  useConvex: jest.fn().mockReturnValue({ query: jest.fn() }),
  useConvexAuth: jest
    .fn()
    .mockReturnValue({ isAuthenticated: false, isLoading: false }),
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
    consent: {
      recordTermsConsent: 'recordTermsConsent',
    },
  },
}));

jest.mock('../../utils/clerkTokenCache', () => ({
  clearAllClerkTokens: jest.fn().mockResolvedValue(undefined),
  clearAndVerifyTokens: jest.fn().mockResolvedValue(true),
  hasClerkTokens: jest.fn().mockResolvedValue(false),
  clerkTokenCache: { clearToken: jest.fn() },
}));

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
}));

jest.mock('../../services/xpEventTracker', () => ({
  xpEventTracker: {
    trackXPDeduction: jest.fn(),
    trackXPRefund: jest.fn(),
    trackXPValidation: jest.fn(),
    calculateXPCost: jest.fn().mockReturnValue(1000),
    createImageGenerationEvent: jest.fn().mockResolvedValue({ success: true }),
  },
}));

jest.mock('../../utils/rememberMeStorage', () => ({
  RememberMeStorage: {
    setRememberMe: jest.fn(),
    getRememberMe: jest.fn().mockResolvedValue({ isEnabled: false }),
    clearRememberMe: jest.fn(),
  },
}));

jest.mock('../../utils/asyncStorageWrapper', () => ({
  __esModule: true,
  default: {
    getAllKeys: jest.fn(() => Promise.resolve([])),
    multiRemove: jest.fn(() => Promise.resolve()),
    multiGet: jest.fn(() => Promise.resolve([])),
    multiSet: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
    setItem: jest.fn(() => Promise.resolve()),
    getItem: jest.fn(() => Promise.resolve(null)),
    clear: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('../../services/reactotron', () => ({
  log: jest.fn(),
  error: jest.fn(),
}));

// Import after mocks
import { AuthProvider, useAuth } from '../../context/AuthContext';

describe('Authentication Flow Integration Tests (US-016)', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('AuthContext Interface', () => {
    it('should provide Clerk-only auth functions via useAuth hook', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      // US-016: Clerk-only auth functions
      expect(typeof result.current.signIn).toBe('function');
      expect(typeof result.current.signOut).toBe('function');
      expect(typeof result.current.signUpWithClerk).toBe('function');
      expect(typeof result.current.signInWithClerk).toBe('function');
      expect(typeof result.current.verifyEmailCode).toBe('function');
      expect(typeof result.current.resetPasswordWithClerk).toBe('function');
      expect(typeof result.current.verifyPasswordResetCode).toBe('function');
      expect(typeof result.current.migrateFromSupabase).toBe('function');

      // US-016: Removed Supabase-specific functions
      expect((result.current as any).signUp).toBeUndefined();
      expect((result.current as any).resendConfirmation).toBeUndefined();
      expect((result.current as any).checkEmailConfirmation).toBeUndefined();
      expect((result.current as any).session).toBeUndefined();
    });

    it('should initialize with null user when not signed in', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.userProfile).toBeNull();
    });

    it('should have XP operation functions', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(typeof result.current.deductXP).toBe('function');
      expect(typeof result.current.refundXP).toBe('function');
      expect(typeof result.current.awardOnboardingXP).toBe('function');
    });

    it('should have profile management functions', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(typeof result.current.updateProfile).toBe('function');
      expect(typeof result.current.refreshProfile).toBe('function');
      expect(typeof result.current.checkProfileCompletion).toBe('function');
    });

    it('should return error when updating profile without user', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let updateResult: any;
      await act(async () => {
        updateResult = await result.current.updateProfile({
          display_name: 'Test',
        });
      });

      expect(updateResult).toEqual({ error: 'No user logged in' });
    });
  });

  describe('OAuth Functions', () => {
    it('should have Google sign-in function', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      expect(typeof result.current.signInWithGoogle).toBe('function');
    });

    it('should have Apple sign-in function', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      expect(typeof result.current.signInWithApple).toBe('function');
    });
  });
});
