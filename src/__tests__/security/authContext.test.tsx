import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../../context/AuthContext';
import { mockSupabase } from '../mocks/supabaseMock';
import {
  createMockUser,
  createMockUserProfile,
  createMockSession,
} from '../utils/testUtils';

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

describe('AuthContext', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.__testUtils.clear();
  });

  describe('initialization', () => {
    it('should initialize with loading state', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current.loading).toBe(true);
      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
      expect(result.current.userProfile).toBeNull();
    });

    it('should load existing session on mount', async () => {
      const mockUser = createMockUser();
      const mockProfile = createMockUserProfile();
      const mockSession = createMockSession({ user: mockUser });

      mockSupabase.auth.getSession.mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      mockSupabase.__testUtils.setData(
        'user_profiles',
        mockUser.id,
        mockProfile,
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.session).toEqual(mockSession);
      expect(result.current.userProfile).toEqual(mockProfile);
    });

    it('should handle session initialization errors', async () => {
      mockSupabase.auth.getSession.mockResolvedValueOnce({
        data: { session: null },
        error: { message: 'Session error' },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
    });
  });

  describe('authentication', () => {
    it('should sign in successfully with valid credentials', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let signInResult: any;
      await act(async () => {
        signInResult = await result.current.signIn(
          'valid@example.com',
          'correctpassword',
        );
      });

      expect(signInResult).toEqual({});
      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'valid@example.com',
        password: 'correctpassword',
      });
    });

    it('should return error for invalid credentials', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let signInResult: any;
      await act(async () => {
        signInResult = await result.current.signIn(
          'invalid@example.com',
          'wrongpassword',
        );
      });

      expect(signInResult).toEqual({ error: 'Invalid credentials' });
    });

    it('should sign up new user successfully', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const profileData = {
        username: 'newuser',
        displayName: 'New User',
        gradeLevel: 'K-2' as const,
      };

      let signUpResult: any;
      await act(async () => {
        signUpResult = await result.current.signUp(
          'new@example.com',
          'password123',
          profileData,
        );
      });

      expect(signUpResult).toEqual({});
      expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'password123',
      });
    });

    it('should handle existing user signup error', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let signUpResult: any;
      await act(async () => {
        signUpResult = await result.current.signUp(
          'existing@example.com',
          'password123',
        );
      });

      expect(signUpResult).toEqual({ error: 'User already exists' });
    });

    it('should sign out successfully', async () => {
      const mockUser = createMockUser();
      mockSupabase.__testUtils.setUser(mockUser);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.signOut();
      });

      expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    });
  });

  describe('profile management', () => {
    it('should update user profile successfully', async () => {
      const mockUser = createMockUser();
      const mockProfile = createMockUserProfile();

      mockSupabase.__testUtils.setUser(mockUser);
      mockSupabase.__testUtils.setData(
        'user_profiles',
        mockUser.id,
        mockProfile,
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const updates = { display_name: 'Updated Name' };
      let updateResult: any;

      await act(async () => {
        updateResult = await result.current.updateProfile(updates);
      });

      expect(updateResult).toEqual({});
      expect(mockSupabase.from).toHaveBeenCalledWith('user_profiles');
    });

    it('should handle profile update errors', async () => {
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

    it('should refresh profile data', async () => {
      const mockUser = createMockUser();
      const mockProfile = createMockUserProfile();

      mockSupabase.__testUtils.setUser(mockUser);
      mockSupabase.__testUtils.setData(
        'user_profiles',
        mockUser.id,
        mockProfile,
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.refreshProfile();
      });

      // Should have called the profile fetch
      expect(mockSupabase.from).toHaveBeenCalledWith('user_profiles');
    });
  });

  describe('email confirmation', () => {
    it('should handle unconfirmed email state', async () => {
      const unconfirmedUser = createMockUser({ email_confirmed_at: null });
      const mockSession = createMockSession({ user: unconfirmedUser });

      mockSupabase.auth.getSession.mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.emailConfirmed).toBe(false);
    });

    it('should check email confirmation status', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let confirmationStatus: boolean;
      await act(async () => {
        confirmationStatus = await result.current.checkEmailConfirmation();
      });

      expect(mockSupabase.auth.getUser).toHaveBeenCalled();
    });

    it('should resend confirmation email', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let resendResult: any;
      await act(async () => {
        resendResult = await result.current.resendConfirmation(
          'test@example.com',
        );
      });

      expect(resendResult).toEqual({});
      expect(mockSupabase.auth.resend).toHaveBeenCalledWith({
        type: 'signup',
        email: 'test@example.com',
      });
    });
  });

  describe('password reset', () => {
    it('should send password reset email', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let resetResult: any;
      await act(async () => {
        resetResult = await result.current.resetPassword('test@example.com');
      });

      expect(resetResult).toEqual({});
      expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'test@example.com',
        { redirectTo: 'creativebridge://reset-password' },
      );
    });
  });

  describe('profile creation and matching', () => {
    it('should create new profile for new user', async () => {
      const newUser = createMockUser({ email: 'newuser@example.com' });
      const mockSession = createMockSession({ user: newUser });

      mockSupabase.auth.getSession.mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      // No existing profile found
      mockSupabase.from().eq.mockResolvedValueOnce({
        data: null,
        error: { message: 'Record not found' },
      });

      // No matching profiles
      mockSupabase.from().ilike.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should have attempted to create a new profile
      expect(mockSupabase.from().insert).toHaveBeenCalled();
    });

    it('should link existing profile by email match', async () => {
      const existingUser = createMockUser({ email: 'existing@example.com' });
      const mockSession = createMockSession({ user: existingUser });
      const existingProfile = createMockUserProfile({
        username: 'existinguser',
      });

      mockSupabase.auth.getSession.mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      // No direct profile match
      mockSupabase.from().eq.mockResolvedValueOnce({
        data: null,
        error: { message: 'Record not found' },
      });

      // Found matching profile by email prefix
      mockSupabase.from().ilike.mockResolvedValueOnce({
        data: [existingProfile],
        error: null,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should have attempted to link the existing profile
      expect(mockSupabase.from().update).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      mockSupabase.auth.signInWithPassword.mockRejectedValueOnce(
        new Error('Network error'),
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let signInResult: any;
      await act(async () => {
        signInResult = await result.current.signIn(
          'test@example.com',
          'password',
        );
      });

      expect(signInResult).toEqual({ error: 'An unexpected error occurred' });
    });

    it('should handle profile fetch errors', async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession({ user: mockUser });

      mockSupabase.auth.getSession.mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      // Simulate profile fetch error
      mockSupabase.from().eq.mockRejectedValueOnce(new Error('Database error'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should still have user but no profile
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.userProfile).toBeNull();
    });
  });
});
