import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../../context/AuthContext';

// Mock dependencies
jest.mock('../../services/supabase', () => ({
  supabase: {
    auth: {
      signOut: jest.fn().mockResolvedValue({ error: null }),
      signInWithPassword: jest
        .fn()
        .mockResolvedValue({ data: {}, error: null }),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
    })),
  },
}));

jest.mock('../../services/reactotron', () => ({
  log: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../utils/rememberMeStorage', () => ({
  RememberMeStorage: {
    setRememberMe: jest.fn(),
    getRememberMe: jest.fn().mockResolvedValue({ isEnabled: false }),
    clearRememberMe: jest.fn(),
  },
}));

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
    },
  },
}));

jest.mock('../../utils/asyncStorageWrapper', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
    getAllKeys: jest.fn().mockResolvedValue([]),
    multiRemove: jest.fn().mockResolvedValue(undefined),
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
    createImageGenerationEvent: jest
      .fn()
      .mockResolvedValue({ success: true, eventId: 'test' }),
  },
}));

describe('AuthContext (US-016)', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with loading state', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current.loading).toBe(true);
      expect(result.current.user).toBeNull();
      expect(result.current.userProfile).toBeNull();
    });

    it('should not expose session in AuthContextType', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      // US-016: session is removed from the interface
      expect((result.current as any).session).toBeUndefined();
    });

    it('should not expose signUp in AuthContextType', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      // US-016: Supabase signUp removed; use signUpWithClerk instead
      expect((result.current as any).signUp).toBeUndefined();
    });

    it('should not expose resendConfirmation in AuthContextType', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      // US-016: Supabase resendConfirmation removed
      expect((result.current as any).resendConfirmation).toBeUndefined();
    });

    it('should not expose checkEmailConfirmation in AuthContextType', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      // US-016: Supabase checkEmailConfirmation removed
      expect((result.current as any).checkEmailConfirmation).toBeUndefined();
    });
  });

  describe('AppUser type', () => {
    it('should provide user as AppUser type with id and email', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // When not signed in, user should be null
      expect(result.current.user).toBeNull();
    });
  });

  describe('authentication', () => {
    it('should have signIn function', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      expect(typeof result.current.signIn).toBe('function');
    });

    it('should have signOut function', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      expect(typeof result.current.signOut).toBe('function');
    });

    it('should have signUpWithClerk function', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      expect(typeof result.current.signUpWithClerk).toBe('function');
    });

    it('should have verifyEmailCode function', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      expect(typeof result.current.verifyEmailCode).toBe('function');
    });

    it('should have signInWithClerk function', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      expect(typeof result.current.signInWithClerk).toBe('function');
    });

    it('should have migrateFromSupabase function', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      expect(typeof result.current.migrateFromSupabase).toBe('function');
    });
  });

  describe('profile management', () => {
    it('should handle profile update error when no user', async () => {
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

  describe('password reset', () => {
    it('should have resetPassword function', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      expect(typeof result.current.resetPassword).toBe('function');
    });

    it('should have resetPasswordWithClerk function', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      expect(typeof result.current.resetPasswordWithClerk).toBe('function');
    });

    it('should have verifyPasswordResetCode function', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      expect(typeof result.current.verifyPasswordResetCode).toBe('function');
    });
  });

  describe('XP operations', () => {
    it('should have deductXP function', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      expect(typeof result.current.deductXP).toBe('function');
    });

    it('should have refundXP function', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      expect(typeof result.current.refundXP).toBe('function');
    });

    it('should have awardOnboardingXP function', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      expect(typeof result.current.awardOnboardingXP).toBe('function');
    });
  });
});
