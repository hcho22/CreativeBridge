import { renderHook, act } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../../context/AuthContext';

// Mock asyncStorageWrapper (what AuthContext actually imports)
// Define mock inline in factory to avoid Jest hoisting issues
jest.mock('../../utils/asyncStorageWrapper', () => ({
  __esModule: true,
  default: {
    getAllKeys: jest.fn(() =>
      Promise.resolve([
        '@CreativeBridge:currentSession',
        '@CreativeBridge:analytics_events',
        '@CreativeBridge:storyCache',
        '@CreativeBridge:rememberMe',
        '@CreativeBridge:userEmail',
        'otherApp:data',
      ]),
    ),
    multiRemove: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
    setItem: jest.fn(() => Promise.resolve()),
    getItem: jest.fn(() => Promise.resolve(null)),
    multiGet: jest.fn(() => Promise.resolve([])),
    multiSet: jest.fn(() => Promise.resolve()),
    clear: jest.fn(() => Promise.resolve()),
  },
}));

// Get reference to the mock AFTER mock is registered
const mockAsyncStorage = require('../../utils/asyncStorageWrapper').default;

// Mock Supabase (still needed for migrateFromSupabase)
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

// Mock RememberMeStorage
jest.mock('../../utils/rememberMeStorage', () => ({
  RememberMeStorage: {
    getRememberMe: jest.fn(() => Promise.resolve({ isEnabled: false })),
    clearRememberMe: jest.fn(() => Promise.resolve()),
  },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('Logout Functionality (US-016)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset default mock return values after clearAllMocks
    mockAsyncStorage.getAllKeys.mockResolvedValue([
      '@CreativeBridge:currentSession',
      '@CreativeBridge:analytics_events',
      '@CreativeBridge:storyCache',
      '@CreativeBridge:rememberMe',
      '@CreativeBridge:userEmail',
      'otherApp:data',
    ]);
    mockAsyncStorage.multiRemove.mockResolvedValue(undefined);
    mockAsyncStorage.removeItem.mockResolvedValue(undefined);
    mockAsyncStorage.setItem.mockResolvedValue(undefined);
    mockAsyncStorage.getItem.mockResolvedValue(null);
  });

  it('should clear all app data during logout', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.signOut();
    });

    // Verify getAllKeys was called to get storage keys
    expect(mockAsyncStorage.getAllKeys).toHaveBeenCalled();

    // Verify multiRemove was called with CreativeBridge keys
    expect(mockAsyncStorage.multiRemove).toHaveBeenCalledWith([
      '@CreativeBridge:currentSession',
      '@CreativeBridge:analytics_events',
      '@CreativeBridge:storyCache',
      '@CreativeBridge:rememberMe',
      '@CreativeBridge:userEmail',
    ]);

    // Verify auth state is cleared (US-016: no session in interface)
    expect(result.current.user).toBeNull();
    expect(result.current.userProfile).toBeNull();
    expect(result.current.emailConfirmed).toBe(false);
  });

  it('should preserve remember me data when enabled', async () => {
    // Mock remember me as enabled
    const mockRememberMeStorage =
      require('../../utils/rememberMeStorage').RememberMeStorage;
    mockRememberMeStorage.getRememberMe.mockResolvedValue({ isEnabled: true });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.signOut();
    });

    // Verify multiRemove excludes remember me keys
    expect(mockAsyncStorage.multiRemove).toHaveBeenCalledWith([
      '@CreativeBridge:currentSession',
      '@CreativeBridge:analytics_events',
      '@CreativeBridge:storyCache',
    ]);

    // Verify clearRememberMe was NOT called
    expect(mockRememberMeStorage.clearRememberMe).not.toHaveBeenCalled();
  });

  it('should handle AsyncStorage errors gracefully', async () => {
    // Mock AsyncStorage to fail
    mockAsyncStorage.getAllKeys.mockRejectedValue(new Error('Storage error'));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.signOut();
    });

    // Logout should still complete — state cleared
    expect(result.current.user).toBeNull();
  });
});
