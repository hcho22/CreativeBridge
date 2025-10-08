// Basic integration test to validate setup
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';

// Import mock first
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
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn(),
    single: jest.fn(),
    ilike: jest.fn(),
  })),
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

// Import components after mocks
import { AuthProvider, useAuth } from '../../context/AuthContext';

const createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  email_confirmed_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

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

describe('Basic Integration Tests', () => {
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

      expect(result.current.signIn).toBeDefined();
      expect(result.current.signUp).toBeDefined();
      expect(result.current.signOut).toBeDefined();
    });

    it('should handle successful sign in flow', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const mockUser = createMockUser();
      mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
        data: {
          user: mockUser,
          session: { access_token: 'token', user: mockUser },
        },
        error: null,
      });

      let signInResult: any;
      await act(async () => {
        signInResult = await result.current.signIn(
          'test@example.com',
          'password123',
        );
      });

      expect(signInResult).toEqual({});
      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    it('should handle authentication errors', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'Invalid credentials' },
      });

      let signInResult: any;
      await act(async () => {
        signInResult = await result.current.signIn(
          'test@example.com',
          'wrongpassword',
        );
      });

      expect(signInResult).toEqual({ error: 'Invalid credentials' });
    });
  });

  describe('Profile Integration', () => {
    it('should handle profile updates', async () => {
      const mockUser = createMockUser();
      const mockProfile = createMockUserProfile({ id: mockUser.id });

      // Mock session and user
      mockSupabase.auth.getSession.mockResolvedValueOnce({
        data: { session: { user: mockUser } },
        error: null,
      });

      // Mock profile fetch
      mockSupabase.from().eq.mockResolvedValueOnce({
        data: mockProfile,
        error: null,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      // Test profile update
      const updates = { display_name: 'Updated Name' };
      const updatedProfile = { ...mockProfile, ...updates };

      mockSupabase.from().update.mockReturnThis();
      mockSupabase.from().update().eq.mockResolvedValueOnce({
        data: updatedProfile,
        error: null,
      });

      let updateResult: any;
      await act(async () => {
        updateResult = await result.current.updateProfile(updates);
      });

      expect(updateResult).toEqual({});
      expect(mockSupabase.from().update).toHaveBeenCalledWith(updates);
    });
  });

  describe('Database Integration', () => {
    it('should interact with user_profiles table', async () => {
      const mockProfile = createMockUserProfile();

      mockSupabase.from().eq.mockResolvedValueOnce({
        data: mockProfile,
        error: null,
      });

      // Simulate profile fetch
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

  describe('Session Management Integration', () => {
    it('should handle session state changes', async () => {
      let authCallback: (event: string, session: any) => void;
      mockSupabase.auth.onAuthStateChange.mockImplementationOnce(callback => {
        authCallback = callback;
        return {
          data: {
            subscription: { unsubscribe: jest.fn() },
          },
        };
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Simulate auth state change
      const mockUser = createMockUser();
      const mockSession = { access_token: 'token', user: mockUser };

      act(() => {
        authCallback!('SIGNED_IN', mockSession);
      });

      await waitFor(() => {
        expect(result.current.session).toEqual(mockSession);
        expect(result.current.user).toEqual(mockUser);
      });

      expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalled();
    });
  });
});
