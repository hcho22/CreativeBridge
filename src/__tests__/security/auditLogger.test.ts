import {
  auditLogger,
  EventType,
  EventCategory,
  Severity,
} from '../../services/auditLogger';
import { mockSupabase } from '../mocks/supabaseMock';
import mockDeviceInfo from '../mocks/deviceInfoMock';

// Mock dependencies — use requireActual inside the factory so the supabaseMock
// module resolves at factory-execution time (avoids TDZ when transitive imports
// trigger this factory before the test-file's own imports have initialized).
jest.mock('../../services/supabase', () => ({
  supabase: jest.requireActual('../mocks/supabaseMock').mockSupabase,
}));

jest.mock(
  '../../services/deviceInfo',
  () => jest.requireActual('../mocks/deviceInfoMock').default,
);

jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    Version: '15.0',
  },
}));

describe('AuditLogger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.__testUtils.clear();
    mockDeviceInfo.__testUtils.reset();
  });

  describe('initialization', () => {
    it('should initialize device fingerprint correctly', async () => {
      await auditLogger.initialize();

      const deviceFingerprint = auditLogger.getDeviceFingerprint();

      expect(deviceFingerprint).toEqual({
        deviceId: 'test-device-id-123',
        deviceName: 'Test Device',
        deviceType: 'MOBILE',
        osName: 'iOS',
        osVersion: '15.0',
        appVersion: '1.0.0',
        screenDimensions: { width: 375, height: 812 },
        timezone: expect.any(String),
        locale: expect.any(String),
      });
    });

    it('should generate unique session ID', async () => {
      await auditLogger.initialize();

      const sessionId = auditLogger.getSessionId();

      expect(sessionId).toMatch(/^session_\d+_[a-z0-9]+$/);
    });

    it('should handle device info errors gracefully', async () => {
      mockDeviceInfo.getUniqueId.mockRejectedValue(new Error('Device error'));

      await auditLogger.initialize();

      const deviceFingerprint = auditLogger.getDeviceFingerprint();
      expect(deviceFingerprint?.deviceId).toBe('unknown');
    });
  });

  describe('logEvent', () => {
    beforeEach(async () => {
      await auditLogger.initialize();
    });

    it('should log basic event successfully', async () => {
      const logEntry = {
        userId: 'test-user',
        eventType: EventType.LOGIN,
        eventCategory: EventCategory.AUTH,
        severity: Severity.LOW,
        description: 'User login successful',
      };

      await auditLogger.logEvent(logEntry);

      expect(mockSupabase.from).toHaveBeenCalledWith('audit_logs');
      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'test-user',
          event_type: 'LOGIN',
          event_category: 'AUTH',
          severity: 'LOW',
          description: 'User login successful',
          is_suspicious: false,
          risk_score: 0,
        }),
      );
    });

    it('should sanitize sensitive data in production', async () => {
      // Mock production environment
      const originalDev = (global as any).__DEV__;
      (global as any).__DEV__ = false;

      const logEntry = {
        eventType: EventType.LOGIN,
        eventCategory: EventCategory.AUTH,
        severity: Severity.LOW,
        description: 'Login attempt',
        metadata: {
          password: 'secret123',
          token: 'bearer-token',
          normalField: 'safe-data',
        },
      };

      await auditLogger.logEvent(logEntry);

      const insertCall = mockSupabase.from().insert.mock.calls[0][0];
      const metadata = JSON.parse(insertCall.metadata);

      expect(metadata.password).toBeUndefined();
      expect(metadata.token).toBeUndefined();
      expect(metadata.normalField).toBe('safe-data');

      // Restore original environment
      (global as any).__DEV__ = originalDev;
    });

    it('should handle logging errors gracefully', async () => {
      mockSupabase.from().insert.mockRejectedValue(new Error('Database error'));

      const logEntry = {
        eventType: EventType.APP_ERROR,
        eventCategory: EventCategory.ERROR,
        severity: Severity.MEDIUM,
        description: 'Test error',
      };

      // Should not throw
      await expect(auditLogger.logEvent(logEntry)).resolves.toBeUndefined();
    });
  });

  describe('convenience methods', () => {
    beforeEach(async () => {
      await auditLogger.initialize();
    });

    it('should log auth success correctly', async () => {
      await auditLogger.logAuthSuccess('user-123', { loginMethod: 'email' });

      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
          event_type: 'LOGIN',
          event_category: 'AUTH',
          severity: 'LOW',
          description: 'User successfully authenticated',
        }),
      );
    });

    it('should log auth failure as suspicious', async () => {
      await auditLogger.logAuthFailure('user@example.com', 'Invalid password');

      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'LOGIN_FAILED',
          event_category: 'AUTH',
          severity: 'MEDIUM',
          is_suspicious: true,
          risk_score: 30,
        }),
      );
    });

    it('should log profile updates', async () => {
      await auditLogger.logProfileUpdate('user-123', ['username', 'email']);

      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
          event_type: 'PROFILE_UPDATE',
          event_category: 'DATA',
          description: 'Profile updated: username, email',
        }),
      );
    });

    it('should log suspicious activity with high risk score', async () => {
      await auditLogger.logSuspiciousActivity(
        'user-123',
        'Multiple failed logins',
        80,
      );

      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
          event_type: 'SUSPICIOUS_ACTIVITY',
          event_category: 'SECURITY',
          severity: 'HIGH',
          is_suspicious: true,
          risk_score: 80,
        }),
      );
    });

    it('should log rate limit exceeded events', async () => {
      await auditLogger.logRateLimitExceeded('192.168.1.1', 'LOGIN_ATTEMPT');

      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'RATE_LIMIT_EXCEEDED',
          event_category: 'SECURITY',
          severity: 'HIGH',
          is_suspicious: true,
          risk_score: 60,
        }),
      );
    });

    it('should log application errors', async () => {
      const error = new Error('Test error');
      await auditLogger.logError(error, 'user-123');

      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
          event_type: 'APP_ERROR',
          event_category: 'ERROR',
          severity: 'MEDIUM',
          description: 'Application error: Test error',
        }),
      );
    });
  });

  describe('device registration', () => {
    beforeEach(async () => {
      await auditLogger.initialize();
    });

    it('should register device successfully', async () => {
      await auditLogger.registerDevice('user-123');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('register_device', {
        p_user_id: 'user-123',
        p_device_id: 'test-device-id-123',
        p_device_name: 'Test Device',
        p_device_type: 'MOBILE',
        p_os_name: 'iOS',
        p_os_version: '15.0',
        p_app_version: '1.0.0',
        p_ip_address: null,
        p_location_info: null,
      });

      // Should also log the device registration event
      expect(mockSupabase.from).toHaveBeenCalledWith('audit_logs');
    });

    it('should handle device registration errors gracefully', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        error: { message: 'Device error' },
      });

      // Should not throw
      await expect(
        auditLogger.registerDevice('user-123'),
      ).resolves.toBeUndefined();
    });
  });

  describe('data sanitization', () => {
    it('should truncate long description in production', async () => {
      const originalDev = (global as any).__DEV__;
      (global as any).__DEV__ = false;

      await auditLogger.initialize();

      const longDescription = 'a'.repeat(1500);
      await auditLogger.logEvent({
        eventType: EventType.APP_ERROR,
        eventCategory: EventCategory.ERROR,
        severity: Severity.LOW,
        description: longDescription,
      });

      const insertCall = mockSupabase.from().insert.mock.calls[0][0];
      expect(insertCall.description).toHaveLength(1003); // 1000 chars + '...'
      expect(insertCall.description).toEndWith('...');

      (global as any).__DEV__ = originalDev;
    });

    it('should truncate long metadata values in production', async () => {
      const originalDev = (global as any).__DEV__;
      (global as any).__DEV__ = false;

      await auditLogger.initialize();

      const longValue = 'x'.repeat(600);
      await auditLogger.logEvent({
        eventType: EventType.APP_ERROR,
        eventCategory: EventCategory.ERROR,
        severity: Severity.LOW,
        description: 'Test',
        metadata: { longField: longValue },
      });

      const insertCall = mockSupabase.from().insert.mock.calls[0][0];
      const metadata = JSON.parse(insertCall.metadata);
      expect(metadata.longField).toHaveLength(503); // 500 chars + '...'

      (global as any).__DEV__ = originalDev;
    });
  });
});
