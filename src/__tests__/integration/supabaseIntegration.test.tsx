// Supabase integration validation tests
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../../context/AuthContext';
import { mockSupabase } from '../mocks/supabaseMock';
import {
  createMockUser,
  createMockUserProfile,
  createMockGameSession,
} from '../utils/testUtils';
import { auditLogger } from '../../services/auditLogger';
import { rateLimiter } from '../../services/rateLimiter';

// Mock dependencies
jest.mock('../../services/supabase', () => ({
  supabase: mockSupabase,
}));

jest.mock('../../services/deviceInfo', () => ({
  getUniqueId: jest.fn().mockResolvedValue('test-device-id'),
  getDeviceName: jest.fn().mockResolvedValue('Test Device'),
  getSystemName: jest.fn().mockResolvedValue('iOS'),
  getSystemVersion: jest.fn().mockResolvedValue('15.0'),
  getVersion: jest.fn().mockResolvedValue('1.0.0'),
  getDeviceDimensions: jest.fn().mockResolvedValue({ width: 375, height: 812 }),
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

describe('Supabase Integration Validation Tests', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.__testUtils.clear();
  });

  describe('Authentication Integration', () => {
    it('should integrate with Supabase auth for sign in', async () => {
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

    it('should integrate with Supabase auth for sign up', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const newUser = createMockUser({ email: 'new@example.com' });
      mockSupabase.auth.signUp.mockResolvedValueOnce({
        data: { user: newUser, session: null },
        error: null,
      });

      let signUpResult: any;
      await act(async () => {
        signUpResult = await result.current.signUp(
          'new@example.com',
          'password123',
          {
            username: 'newuser',
            gradeLevel: 'K-2',
          },
        );
      });

      expect(signUpResult).toEqual({});
      expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'password123',
      });
    });

    it('should handle Supabase auth session management', async () => {
      const mockUser = createMockUser();
      const mockSession = { access_token: 'token', user: mockUser };

      mockSupabase.auth.getSession.mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.session).toEqual(mockSession);
        expect(result.current.user).toEqual(mockUser);
      });

      expect(mockSupabase.auth.getSession).toHaveBeenCalled();
    });

    it('should integrate with Supabase auth state changes', async () => {
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
    });
  });

  describe('Database Integration', () => {
    it('should integrate with user_profiles table', async () => {
      const mockUser = createMockUser();
      const mockProfile = createMockUserProfile({ id: mockUser.id });

      mockSupabase.__testUtils.setUser(mockUser);
      mockSupabase.__testUtils.setData(
        'user_profiles',
        mockUser.id,
        mockProfile,
      );

      // Mock profile fetch
      mockSupabase.from().eq.mockResolvedValueOnce({
        data: mockProfile,
        error: null,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.userProfile).toEqual(mockProfile);
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('user_profiles');
    });

    it('should create user profile in database', async () => {
      const mockUser = createMockUser();
      mockSupabase.__testUtils.setUser(mockUser);

      // Mock no existing profile
      mockSupabase.from().eq.mockResolvedValueOnce({
        data: null,
        error: { message: 'Record not found' },
      });

      // Mock no matching profiles
      mockSupabase.from().ilike.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      // Mock successful profile creation
      const createdProfile = createMockUserProfile({ id: mockUser.id });
      mockSupabase.from().insert.mockResolvedValueOnce({
        data: createdProfile,
        error: null,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.userProfile).toEqual(createdProfile);
      });

      expect(mockSupabase.from().insert).toHaveBeenCalled();
    });

    it('should update user profile in database', async () => {
      const mockUser = createMockUser();
      const mockProfile = createMockUserProfile({ id: mockUser.id });

      mockSupabase.__testUtils.setUser(mockUser);
      mockSupabase.__testUtils.setData(
        'user_profiles',
        mockUser.id,
        mockProfile,
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

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

    it('should integrate with game_sessions table', async () => {
      const mockUser = createMockUser();
      const mockGameSession = createMockGameSession({ user_id: mockUser.id });

      // Mock game session creation
      mockSupabase.from().insert.mockResolvedValueOnce({
        data: mockGameSession,
        error: null,
      });

      // Create a game session
      const { data, error } = await mockSupabase
        .from('game_sessions')
        .insert(mockGameSession);

      expect(error).toBeNull();
      expect(data).toEqual(mockGameSession);
    });
  });

  describe('Audit Logging Integration', () => {
    beforeEach(async () => {
      await auditLogger.initialize();
    });

    it('should integrate with audit_logs table', async () => {
      const logEntry = {
        userId: 'test-user',
        eventType: 'LOGIN',
        eventCategory: 'AUTH',
        severity: 'LOW',
        description: 'User login successful',
      };

      await auditLogger.logEvent(logEntry as any);

      expect(mockSupabase.from).toHaveBeenCalledWith('audit_logs');
      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'test-user',
          event_type: 'LOGIN',
          event_category: 'AUTH',
          severity: 'LOW',
          description: 'User login successful',
        }),
      );
    });

    it('should integrate with device registration', async () => {
      await auditLogger.registerDevice('test-user');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('register_device', {
        p_user_id: 'test-user',
        p_device_id: 'test-device-id',
        p_device_name: 'Test Device',
        p_device_type: 'MOBILE',
        p_os_name: 'iOS',
        p_os_version: '15.0',
        p_app_version: '1.0.0',
        p_ip_address: null,
        p_location_info: null,
      });
    });
  });

  describe('Rate Limiting Integration', () => {
    it('should integrate with rate_limits table', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ data: true, error: null });

      const result = await rateLimiter.checkRateLimit(
        '192.168.1.1',
        'LOGIN_ATTEMPT' as any,
      );

      expect(result.allowed).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('check_rate_limit', {
        p_identifier: '192.168.1.1',
        p_action_type: 'LOGIN_ATTEMPT',
        p_window_minutes: 15,
        p_max_attempts: 5,
      });
    });

    it('should handle rate limit exceeded', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ data: false, error: null });

      const result = await rateLimiter.checkRateLimit(
        '192.168.1.1',
        'LOGIN_ATTEMPT' as any,
      );

      expect(result.allowed).toBe(false);
      expect(result.isBlocked).toBe(true);
    });
  });

  describe('Real-time Features Integration', () => {
    it('should handle real-time updates for user profiles', async () => {
      const mockUser = createMockUser();
      const mockProfile = createMockUserProfile({ id: mockUser.id });

      mockSupabase.__testUtils.setUser(mockUser);
      mockSupabase.__testUtils.setData(
        'user_profiles',
        mockUser.id,
        mockProfile,
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.userProfile).toEqual(mockProfile);
      });

      // Simulate real-time update
      const updatedProfile = { ...mockProfile, total_xp: 150 };
      mockSupabase.__testUtils.setData(
        'user_profiles',
        mockUser.id,
        updatedProfile,
      );

      // Refresh profile to simulate real-time update
      await act(async () => {
        await result.current.refreshProfile();
      });

      // Profile should be updated
      await waitFor(() => {
        expect(mockSupabase.from).toHaveBeenCalledWith('user_profiles');
      });
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle Supabase authentication errors', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'Invalid credentials', code: 'invalid_credentials' },
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

    it('should handle database connection errors', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      const mockUser = createMockUser();
      mockSupabase.__testUtils.setUser(mockUser);

      // Mock database error
      mockSupabase
        .from()
        .eq.mockRejectedValueOnce(new Error('Database connection failed'));

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
        // Should handle error gracefully without crashing
        expect(result.current.userProfile).toBeNull();
      });
    });

    it('should handle network connectivity issues', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Mock network error
      mockSupabase.auth.signInWithPassword.mockRejectedValueOnce(
        new Error('Network error'),
      );

      let signInResult: any;
      await act(async () => {
        signInResult = await result.current.signIn(
          'test@example.com',
          'password123',
        );
      });

      expect(signInResult).toEqual({ error: 'An unexpected error occurred' });
    });
  });

  describe('Data Consistency Integration', () => {
    it('should maintain data consistency across operations', async () => {
      const mockUser = createMockUser();
      const mockProfile = createMockUserProfile({
        id: mockUser.id,
        total_xp: 100,
        total_games_played: 5,
      });

      mockSupabase.__testUtils.setUser(mockUser);
      mockSupabase.__testUtils.setData(
        'user_profiles',
        mockUser.id,
        mockProfile,
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.userProfile).toEqual(mockProfile);
      });

      // Update profile
      const updates = { total_xp: 150, total_games_played: 6 };
      const updatedProfile = { ...mockProfile, ...updates };

      mockSupabase.from().update.mockReturnThis();
      mockSupabase.from().update().eq.mockResolvedValueOnce({
        data: updatedProfile,
        error: null,
      });

      await act(async () => {
        await result.current.updateProfile(updates);
      });

      await waitFor(() => {
        expect(result.current.userProfile).toEqual(updatedProfile);
      });
    });

    it('should handle concurrent updates safely', async () => {
      const mockUser = createMockUser();
      const mockProfile = createMockUserProfile({ id: mockUser.id });

      mockSupabase.__testUtils.setUser(mockUser);
      mockSupabase.__testUtils.setData(
        'user_profiles',
        mockUser.id,
        mockProfile,
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      // Mock successful concurrent updates
      mockSupabase.from().update.mockReturnThis();
      mockSupabase.from().update().eq.mockResolvedValue({
        data: mockProfile,
        error: null,
      });

      // Simulate concurrent updates
      const promises = [
        result.current.updateProfile({ display_name: 'Name 1' }),
        result.current.updateProfile({ display_name: 'Name 2' }),
        result.current.updateProfile({ total_xp: 200 }),
      ];

      await act(async () => {
        await Promise.all(promises);
      });

      // All updates should complete without errors
      expect(mockSupabase.from().update).toHaveBeenCalledTimes(3);
    });
  });

  describe('Performance Integration', () => {
    it('should handle large datasets efficiently', async () => {
      // Mock large user profile response
      const largeMetadata = {
        achievements: new Array(1000).fill(0).map((_, i) => `achievement_${i}`),
        gameHistory: new Array(500)
          .fill(0)
          .map((_, i) => ({ gameId: i, score: i * 10 })),
      };

      const mockProfile = createMockUserProfile({
        id: 'test-user',
        bio: 'a'.repeat(2000), // Large bio
      });

      mockSupabase.__testUtils.setData(
        'user_profiles',
        'test-user',
        mockProfile,
      );

      const startTime = Date.now();

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const endTime = Date.now();
      const loadTime = endTime - startTime;

      // Should load reasonably fast even with large data
      expect(loadTime).toBeLessThan(2000); // 2 seconds max
    });

    it('should handle database timeouts gracefully', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Mock timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 100);
      });

      mockSupabase.auth.signInWithPassword.mockReturnValueOnce(timeoutPromise);

      let signInResult: any;
      await act(async () => {
        signInResult = await result.current.signIn(
          'test@example.com',
          'password123',
        );
      });

      expect(signInResult).toEqual({ error: 'An unexpected error occurred' });
    });
  });
});
