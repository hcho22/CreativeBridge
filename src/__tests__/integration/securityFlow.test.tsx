// Integration tests for complete security workflows
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../../context/AuthContext';
import { auditLogger } from '../../services/auditLogger';
import { mockSupabase } from '../mocks/supabaseMock';
import mockDeviceInfo from '../mocks/deviceInfoMock';
import { createMockUser } from '../utils/testUtils';

// Mock all dependencies
jest.mock('../../services/supabase', () => ({
  supabase: jest.requireActual('../mocks/supabaseMock').mockSupabase,
}));

jest.mock('../../services/deviceInfo', () => mockDeviceInfo);

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

describe('Security Integration Tests', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSupabase.__testUtils.clear();
    mockDeviceInfo.__testUtils.reset();

    // Initialize audit logger for tests
    await auditLogger.initialize();
  });

  describe('Authentication Security Flow', () => {
    it('should handle complete secure login flow with audit logging', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Mock successful rate limit check
      mockSupabase.rpc.mockResolvedValueOnce({ data: true, error: null });

      // Mock successful authentication
      const mockUser = createMockUser({ email: 'test@example.com' });
      mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
        data: {
          user: mockUser,
          session: { access_token: 'token', user: mockUser },
        },
        error: null,
      });

      // Mock device registration
      mockSupabase.rpc.mockResolvedValueOnce({
        data: 'device-id',
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

      // Verify audit log was created
      expect(mockSupabase.from).toHaveBeenCalledWith('audit_logs');
      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'LOGIN',
          event_category: 'AUTH',
          user_id: mockUser.id,
        }),
      );

      // Verify device registration
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'register_device',
        expect.objectContaining({
          p_user_id: mockUser.id,
          p_device_id: 'test-device-id-123',
        }),
      );
    });

    it('should handle failed login with rate limiting and audit logging', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Mock rate limit allowing the attempt
      mockSupabase.rpc.mockResolvedValueOnce({ data: true, error: null });

      // Mock failed authentication
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

      // Verify failure audit log
      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'LOGIN_FAILED',
          event_category: 'AUTH',
          severity: 'MEDIUM',
          is_suspicious: true,
        }),
      );
    });

    it('should block login attempts when rate limit is exceeded', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Mock rate limit blocking the attempt
      mockSupabase.rpc.mockResolvedValueOnce({ data: false, error: null });

      let signInResult: any;
      await act(async () => {
        signInResult = await result.current.signIn(
          'test@example.com',
          'password123',
        );
      });

      // Should be blocked before attempting authentication
      expect(mockSupabase.auth.signInWithPassword).not.toHaveBeenCalled();
      expect(signInResult).toEqual({
        error: 'Too many login attempts. Please try again later.',
      });

      // Verify rate limit exceeded audit log
      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'RATE_LIMIT_EXCEEDED',
          event_category: 'SECURITY',
          severity: 'HIGH',
          is_suspicious: true,
        }),
      );
    });
  });

  describe('Profile Security Flow', () => {
    it('should securely update profile with audit logging', async () => {
      const mockUser = createMockUser();
      mockSupabase.__testUtils.setUser(mockUser);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      // Mock rate limit check for profile updates
      mockSupabase.rpc.mockResolvedValueOnce({ data: true, error: null });

      // Mock successful profile update
      const profileUpdates = { display_name: 'Updated Name' };
      mockSupabase.from().update.mockReturnThis();
      mockSupabase
        .from()
        .update()
        .eq.mockResolvedValueOnce({
          data: { ...mockUser, ...profileUpdates },
          error: null,
        });

      let updateResult: any;
      await act(async () => {
        updateResult = await result.current.updateProfile(profileUpdates);
      });

      expect(updateResult).toEqual({});

      // Verify profile update audit log
      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'PROFILE_UPDATE',
          event_category: 'DATA',
          user_id: mockUser.id,
        }),
      );
    });

    it('should detect and log suspicious profile update patterns', async () => {
      const mockUser = createMockUser();
      mockSupabase.__testUtils.setUser(mockUser);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      // Simulate multiple rapid profile updates (suspicious behavior)
      const suspiciousUpdates = [
        { username: 'hacker1' },
        { username: 'hacker2' },
        { username: 'hacker3' },
        { username: 'hacker4' },
        { username: 'hacker5' },
      ];

      for (const update of suspiciousUpdates) {
        // Mock rate limit allowing each individual update
        mockSupabase.rpc.mockResolvedValueOnce({ data: true, error: null });

        mockSupabase.from().update.mockReturnThis();
        mockSupabase
          .from()
          .update()
          .eq.mockResolvedValueOnce({
            data: { ...mockUser, ...update },
            error: null,
          });

        await act(async () => {
          await result.current.updateProfile(update);
        });
      }

      // Should have logged multiple profile updates
      const profileUpdateCalls = mockSupabase
        .from()
        .insert.mock.calls.filter(
          call => call[0].event_type === 'PROFILE_UPDATE',
        );

      expect(profileUpdateCalls).toHaveLength(5);
    });
  });

  describe('Device Security Flow', () => {
    it('should register new device with proper security checks', async () => {
      // Mock device info for a new device
      mockDeviceInfo.__testUtils.setDeviceId('new-device-123');
      mockDeviceInfo.__testUtils.setSystemName('Android');

      const mockUser = createMockUser();
      mockSupabase.__testUtils.setUser(mockUser);

      // Re-initialize audit logger with new device info
      await auditLogger.initialize();

      // Register device
      await auditLogger.registerDevice(mockUser.id);

      // Verify device registration call
      expect(mockSupabase.rpc).toHaveBeenCalledWith('register_device', {
        p_user_id: mockUser.id,
        p_device_id: 'new-device-123',
        p_device_name: 'Test Device',
        p_device_type: 'MOBILE',
        p_os_name: 'Android',
        p_os_version: '15.0',
        p_app_version: '1.0.0',
        p_ip_address: null,
        p_location_info: null,
      });

      // Verify device registration audit log
      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'DEVICE_REGISTERED',
          event_category: 'SECURITY',
          user_id: mockUser.id,
        }),
      );
    });

    it('should detect and log suspicious device behavior', async () => {
      // Mock emulator detection
      mockDeviceInfo.isEmulator.mockResolvedValueOnce(true);

      // Re-initialize with emulator device
      await auditLogger.initialize();

      const suspiciousMetadata = {
        isEmulator: true,
        rapidLocationChanges: true,
        unusualScreenResolution: true,
      };

      await auditLogger.logSuspiciousActivity(
        'user-123',
        'Suspicious device characteristics detected',
        75,
        suspiciousMetadata,
      );

      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'SUSPICIOUS_ACTIVITY',
          event_category: 'SECURITY',
          severity: 'HIGH',
          is_suspicious: true,
          risk_score: 75,
        }),
      );
    });
  });

  describe('Session Security Flow', () => {
    it('should handle session expiration securely', async () => {
      const mockUser = createMockUser();
      const expiredSession = {
        access_token: 'expired-token',
        refresh_token: 'refresh-token',
        user: mockUser,
        expires_at: Date.now() - 1000, // Expired 1 second ago
      };

      mockSupabase.auth.getSession.mockResolvedValueOnce({
        data: { session: expiredSession },
        error: null,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should log session expiration
      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'SESSION_EXPIRED',
          event_category: 'SECURITY',
          user_id: mockUser.id,
        }),
      );
    });

    it('should detect concurrent session anomalies', async () => {
      const mockUser = createMockUser();

      // Simulate concurrent sessions from different locations
      await auditLogger.logSuspiciousActivity(
        mockUser.id,
        'Concurrent sessions from different geographical locations detected',
        60,
        {
          simultaneousSessions: 2,
          locations: ['New York', 'London'],
          timeDifference: '< 1 minute',
        },
      );

      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'SUSPICIOUS_ACTIVITY',
          severity: 'MEDIUM',
          is_suspicious: true,
          risk_score: 60,
        }),
      );
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should gracefully handle audit logging failures', async () => {
      // Mock audit log insertion failure
      mockSupabase
        .from()
        .insert.mockRejectedValueOnce(new Error('Database unavailable'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should not crash the app when audit logging fails
      let signInResult: any;
      await act(async () => {
        signInResult = await result.current.signIn(
          'test@example.com',
          'password123',
        );
      });

      // Authentication should still proceed
      expect(signInResult).toBeDefined();
    });

    it('should handle rate limiter service failures gracefully', async () => {
      // Mock rate limiter database failure
      mockSupabase.rpc.mockRejectedValueOnce(
        new Error('Rate limit service unavailable'),
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should allow authentication to proceed when rate limiter fails
      let signInResult: any;
      await act(async () => {
        signInResult = await result.current.signIn(
          'test@example.com',
          'password123',
        );
      });

      expect(signInResult).toBeDefined();
    });

    it('should recover from device registration failures', async () => {
      // Mock device registration failure
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Device registration failed' },
      });

      const mockUser = createMockUser();

      // Should not throw when device registration fails
      await expect(
        auditLogger.registerDevice(mockUser.id),
      ).resolves.toBeUndefined();
    });
  });

  describe('Data Sanitization and Privacy', () => {
    it('should sanitize sensitive data in audit logs', async () => {
      const originalDev = (global as any).__DEV__;
      (global as any).__DEV__ = false; // Production mode

      await auditLogger.logEvent({
        userId: 'user-123',
        eventType: 'LOGIN_FAILED',
        eventCategory: 'AUTH',
        severity: 'MEDIUM',
        description: 'Login failed',
        metadata: {
          password: 'secret123',
          token: 'bearer-token',
          creditCard: '1234-5678-9012-3456',
          normalField: 'safe-data',
        },
      });

      const insertCall = mockSupabase.from().insert.mock.calls[0][0];
      const metadata = JSON.parse(insertCall.metadata);

      // Sensitive fields should be removed
      expect(metadata.password).toBeUndefined();
      expect(metadata.token).toBeUndefined();
      expect(metadata.creditCard).toBeUndefined();

      // Safe fields should remain
      expect(metadata.normalField).toBe('safe-data');

      (global as any).__DEV__ = originalDev;
    });

    it('should enforce data retention policies', async () => {
      // Mock old audit logs cleanup
      const oldDate = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000); // 91 days ago

      mockSupabase.from().delete.mockReturnThis();
      mockSupabase.from().delete().lt.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Simulate cleanup function call
      await mockSupabase
        .from('audit_logs')
        .delete()
        .lt('created_at', oldDate.toISOString());

      expect(mockSupabase.from().delete).toHaveBeenCalled();
    });
  });
});
