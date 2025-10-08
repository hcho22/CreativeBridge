import { renderHook, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider, useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
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
}));

// Mock Supabase
jest.mock('../../services/supabase', () => ({
  supabase: {
    auth: {
      signOut: jest.fn(() => Promise.resolve({ error: null })),
      getSession: jest.fn(() =>
        Promise.resolve({ data: { session: null }, error: null }),
      ),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
      getUser: jest.fn(() =>
        Promise.resolve({ data: { user: null }, error: null }),
      ),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
    })),
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

describe('Logout Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should clear all app data during logout', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.signOut();
    });

    // Verify Supabase signOut was called
    expect(supabase.auth.signOut).toHaveBeenCalled();

    // Verify getAllKeys was called to get storage keys
    expect(AsyncStorage.getAllKeys).toHaveBeenCalled();

    // Verify multiRemove was called with CreativeBridge keys (including remember me when disabled)
    expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
      '@CreativeBridge:currentSession',
      '@CreativeBridge:analytics_events',
      '@CreativeBridge:storyCache',
      '@CreativeBridge:rememberMe',
      '@CreativeBridge:userEmail',
    ]);

    // Verify auth state is cleared
    expect(result.current.session).toBeNull();
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
    expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
      '@CreativeBridge:currentSession',
      '@CreativeBridge:analytics_events',
      '@CreativeBridge:storyCache',
    ]);

    // Verify clearRememberMe was NOT called
    expect(mockRememberMeStorage.clearRememberMe).not.toHaveBeenCalled();
  });

  it('should handle logout errors gracefully', async () => {
    // Mock Supabase signOut to fail
    const mockSupabase = supabase as any;
    mockSupabase.auth.signOut.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.signOut();
    });

    // Even with error, state should be cleared
    expect(result.current.session).toBeNull();
    expect(result.current.user).toBeNull();
    expect(result.current.userProfile).toBeNull();

    // AsyncStorage should still be cleared
    expect(AsyncStorage.multiRemove).toHaveBeenCalled();
  });

  it('should handle AsyncStorage errors gracefully', async () => {
    // Mock AsyncStorage to fail
    (AsyncStorage.getAllKeys as jest.Mock).mockRejectedValue(
      new Error('Storage error'),
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.signOut();
    });

    // Logout should still complete
    expect(supabase.auth.signOut).toHaveBeenCalled();
    expect(result.current.session).toBeNull();
  });
});
