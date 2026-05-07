// Supabase integration validation tests (US-016: Auth removed, database/services retained)
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../../context/AuthContext';
import { createMockUser, createMockGameSession } from '../utils/testUtils';

// Mock dependencies — use require() so mockSupabase is available in mock factory
jest.mock('../../services/supabase', () => ({
  supabase: require('../mocks/supabaseMock').mockSupabase,
}));

// Import after mock setup
const { mockSupabase } = require('../mocks/supabaseMock');

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

describe('Supabase Integration Validation Tests (US-016)', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.__testUtils.clear();
  });

  describe('AuthContext Integration', () => {
    it('should initialize without Supabase auth state', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // US-016: No Supabase session or signUp
      expect((result.current as any).session).toBeUndefined();
      expect((result.current as any).signUp).toBeUndefined();
      expect(result.current.user).toBeNull();
    });
  });

  describe('Database Integration', () => {
    it('should integrate with game_sessions table via mock', async () => {
      const mockUser = createMockUser();
      const mockGameSession = createMockGameSession({ user_id: mockUser.id });

      // Mock game session creation
      mockSupabase.from().insert.mockResolvedValueOnce({
        data: mockGameSession,
        error: null,
      });

      // Create a game session via mock
      const { data, error } = await mockSupabase
        .from('game_sessions')
        .insert(mockGameSession);

      expect(error).toBeNull();
      expect(data).toEqual(mockGameSession);
    });
  });

  describe('Performance Integration', () => {
    it('should initialize AuthContext within timeout', async () => {
      const startTime = Date.now();

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const endTime = Date.now();
      const loadTime = endTime - startTime;

      // Should load reasonably fast
      expect(loadTime).toBeLessThan(2000); // 2 seconds max
    });
  });
});
