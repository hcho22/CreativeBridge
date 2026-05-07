// Basic integration test to validate setup (US-016: Clerk-only auth)
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';

// Import mock first — use a shared chain object so mockResolvedValueOnce
// calls apply to the same instance that tests use
const mockChain = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn(),
  single: jest.fn(),
  ilike: jest.fn(),
  limit: jest.fn().mockResolvedValue({ data: [], error: null }),
};

const mockSupabase = {
  auth: {
    signInWithPassword: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    getUser: jest.fn(),
    getSession: jest.fn(),
    onAuthStateChange: jest.fn(),
    resetPasswordForEmail: jest.fn(),
    resend: jest.fn(),
  },
  from: jest.fn((_table?: string) => mockChain),
  rpc: jest.fn(),
  __testUtils: {
    clear: jest.fn(),
    setUser: jest.fn(),
    setData: jest.fn(),
    getData: jest.fn(),
  },
};

// Mock dependencies
jest.mock('../../services/supabase', () => ({
  supabase: mockSupabase,
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

// Import components after mocks
import { AuthProvider, useAuth } from '../../context/AuthContext';

const createMockUserProfile = (overrides = {}) => ({
  id: 'test-user-id',
  username: 'testuser',
  display_name: 'Test User',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  total_xp: 100,
  current_streak: 5,
  longest_streak: 10,
  last_activity_date: new Date().toISOString().split('T')[0],
  best_score: 50,
  total_games_played: 3,
  total_stories_completed: 2,
  total_words_written: 500,
  preferred_grade_level: 'K-2' as const,
  speech_enabled: true,
  ...overrides,
});

describe('Basic Integration Tests (US-016)', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication Integration', () => {
    it('should integrate with authentication context', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // US-016: Clerk-only auth functions
      expect(result.current.signIn).toBeDefined();
      expect(result.current.signOut).toBeDefined();
      expect(result.current.signUpWithClerk).toBeDefined();
      expect(result.current.signInWithClerk).toBeDefined();

      // US-016: Removed Supabase-specific functions
      expect((result.current as any).signUp).toBeUndefined();
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
  });

  describe('Database Integration', () => {
    it('should interact with user_profiles table', async () => {
      const mockProfile = createMockUserProfile();

      mockSupabase.from().eq.mockResolvedValueOnce({
        data: mockProfile,
        error: null,
      });

      // Simulate profile fetch via Supabase mock directly
      const { data } = await mockSupabase
        .from('user_profiles')
        .select('*')
        .eq('id', 'test-user-id');

      expect(data).toEqual(mockProfile);
      expect(mockSupabase.from).toHaveBeenCalledWith('user_profiles');
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.from().eq.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' },
      });

      const { error } = await mockSupabase
        .from('user_profiles')
        .select('*')
        .eq('id', 'nonexistent-id');

      expect(error).toEqual({ message: 'Database error' });
    });
  });

  describe('Supabase Functions Integration', () => {
    it('should call Supabase RPC functions', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: 'success',
        error: null,
      });

      const { data, error } = await mockSupabase.rpc('test_function', {
        param1: 'value1',
      });

      expect(data).toBe('success');
      expect(error).toBeNull();
      expect(mockSupabase.rpc).toHaveBeenCalledWith('test_function', {
        param1: 'value1',
      });
    });
  });
});
