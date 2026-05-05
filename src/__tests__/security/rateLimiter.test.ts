import { rateLimiter, ActionType } from '../../services/rateLimiter';
import { mockSupabase } from '../mocks/supabaseMock';

// Mock dependencies — use requireActual inside the factory so the supabaseMock
// module resolves at factory-execution time (the surrounding import binding may
// still be in TDZ when transitive imports trigger this factory first).
jest.mock('../../services/supabase', () => ({
  supabase: jest.requireActual('../mocks/supabaseMock').mockSupabase,
}));

jest.mock('../../services/auditLogger', () => ({
  auditLogger: {
    logRateLimitExceeded: jest.fn(),
  },
}));

describe('RateLimiter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.__testUtils.clear();
  });

  describe('checkRateLimit', () => {
    it('should allow requests within rate limit', async () => {
      // Mock database function to return true (allowed)
      mockSupabase.rpc.mockResolvedValueOnce({
        data: true,
        error: null,
      });

      const result = await rateLimiter.checkRateLimit(
        '192.168.1.1',
        ActionType.LOGIN_ATTEMPT,
      );

      expect(result.allowed).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('check_rate_limit', {
        p_identifier: '192.168.1.1',
        p_action_type: 'LOGIN_ATTEMPT',
        p_window_minutes: 15,
        p_max_attempts: 5,
      });
    });

    it('should deny requests exceeding rate limit', async () => {
      // Mock database function to return false (blocked)
      mockSupabase.rpc.mockResolvedValueOnce({
        data: false,
        error: null,
      });

      const result = await rateLimiter.checkRateLimit(
        '192.168.1.1',
        ActionType.LOGIN_ATTEMPT,
      );

      expect(result.allowed).toBe(false);
      expect(result.isBlocked).toBe(true);
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' },
      });

      const result = await rateLimiter.checkRateLimit(
        '192.168.1.1',
        ActionType.LOGIN_ATTEMPT,
      );

      // Should allow on error to prevent blocking legitimate users
      expect(result.allowed).toBe(true);
      expect(result.error).toBe('Database error');
    });

    it('should use custom rate limit configuration', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: true,
        error: null,
      });

      await rateLimiter.checkRateLimit('user-123', ActionType.PASSWORD_RESET, {
        maxAttempts: 3,
        windowMinutes: 60,
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('check_rate_limit', {
        p_identifier: 'user-123',
        p_action_type: 'PASSWORD_RESET',
        p_window_minutes: 60,
        p_max_attempts: 3,
      });
    });

    it('should handle network errors', async () => {
      mockSupabase.rpc.mockRejectedValueOnce(new Error('Network error'));

      const result = await rateLimiter.checkRateLimit(
        '192.168.1.1',
        ActionType.LOGIN_ATTEMPT,
      );

      // Should allow on network error
      expect(result.allowed).toBe(true);
      expect(result.error).toBe('Network error');
    });
  });

  describe('getRateLimitStatus', () => {
    it('should return current rate limit status', async () => {
      const mockRateLimitData = {
        identifier: '192.168.1.1',
        action_type: 'LOGIN_ATTEMPT',
        window_start: new Date().toISOString(),
        attempt_count: 3,
        is_blocked: false,
        blocked_until: null,
      };

      mockSupabase.from().eq.mockResolvedValueOnce({
        data: mockRateLimitData,
        error: null,
      });

      const status = await rateLimiter.getRateLimitStatus(
        '192.168.1.1',
        ActionType.LOGIN_ATTEMPT,
      );

      expect(status).toEqual({
        allowed: true,
        remainingAttempts: 2, // 5 - 3
        windowResetTime: expect.any(Date),
        isBlocked: false,
        nextAllowedTime: undefined,
      });
    });

    it('should handle blocked status correctly', async () => {
      const blockedUntil = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
      const mockRateLimitData = {
        identifier: '192.168.1.1',
        action_type: 'LOGIN_ATTEMPT',
        window_start: new Date().toISOString(),
        attempt_count: 5,
        is_blocked: true,
        blocked_until: blockedUntil,
      };

      mockSupabase.from().eq.mockResolvedValueOnce({
        data: mockRateLimitData,
        error: null,
      });

      const status = await rateLimiter.getRateLimitStatus(
        '192.168.1.1',
        ActionType.LOGIN_ATTEMPT,
      );

      expect(status).toEqual({
        allowed: false,
        remainingAttempts: 0,
        windowResetTime: expect.any(Date),
        isBlocked: true,
        blockedUntil: new Date(blockedUntil),
        nextAllowedTime: new Date(blockedUntil),
      });
    });

    it('should return clean status when no rate limit record exists', async () => {
      mockSupabase.from().eq.mockResolvedValueOnce({
        data: null,
        error: { message: 'Record not found' },
      });

      const status = await rateLimiter.getRateLimitStatus(
        '192.168.1.1',
        ActionType.LOGIN_ATTEMPT,
      );

      expect(status).toEqual({
        allowed: true,
        remainingAttempts: 5,
        windowResetTime: expect.any(Date),
        isBlocked: false,
      });
    });
  });

  describe('clearRateLimit', () => {
    it('should clear rate limit for identifier', async () => {
      mockSupabase.from().delete.mockReturnValueOnce({
        eq: jest.fn().mockResolvedValueOnce({ error: null }),
      });

      const result = await rateLimiter.clearRateLimit(
        '192.168.1.1',
        ActionType.LOGIN_ATTEMPT,
      );

      expect(result.success).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('rate_limits');
    });

    it('should handle clear errors', async () => {
      mockSupabase.from().delete.mockReturnValueOnce({
        eq: jest
          .fn()
          .mockResolvedValueOnce({ error: { message: 'Delete failed' } }),
      });

      const result = await rateLimiter.clearRateLimit(
        '192.168.1.1',
        ActionType.LOGIN_ATTEMPT,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Delete failed');
    });
  });

  describe('action type specific limits', () => {
    it('should use correct limits for login attempts', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ data: true, error: null });

      await rateLimiter.checkRateLimit('192.168.1.1', ActionType.LOGIN_ATTEMPT);

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'check_rate_limit',
        expect.objectContaining({
          p_max_attempts: 5,
          p_window_minutes: 15,
        }),
      );
    });

    it('should use correct limits for password reset', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ data: true, error: null });

      await rateLimiter.checkRateLimit(
        'user@example.com',
        ActionType.PASSWORD_RESET,
      );

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'check_rate_limit',
        expect.objectContaining({
          p_max_attempts: 3,
          p_window_minutes: 60,
        }),
      );
    });

    it('should use correct limits for profile updates', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ data: true, error: null });

      await rateLimiter.checkRateLimit('user-123', ActionType.PROFILE_UPDATE);

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'check_rate_limit',
        expect.objectContaining({
          p_max_attempts: 10,
          p_window_minutes: 10,
        }),
      );
    });

    it('should use correct limits for API requests', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ data: true, error: null });

      await rateLimiter.checkRateLimit('user-123', ActionType.API_REQUEST);

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'check_rate_limit',
        expect.objectContaining({
          p_max_attempts: 100,
          p_window_minutes: 1,
        }),
      );
    });
  });

  describe('security logging', () => {
    it('should log rate limit exceeded events', async () => {
      const { auditLogger } = require('../../services/auditLogger');

      mockSupabase.rpc.mockResolvedValueOnce({
        data: false,
        error: null,
      });

      await rateLimiter.checkRateLimit('192.168.1.1', ActionType.LOGIN_ATTEMPT);

      expect(auditLogger.logRateLimitExceeded).toHaveBeenCalledWith(
        '192.168.1.1',
        'LOGIN_ATTEMPT',
        expect.any(Object),
      );
    });

    it('should not log when rate limit is not exceeded', async () => {
      const { auditLogger } = require('../../services/auditLogger');

      mockSupabase.rpc.mockResolvedValueOnce({
        data: true,
        error: null,
      });

      await rateLimiter.checkRateLimit('192.168.1.1', ActionType.LOGIN_ATTEMPT);

      expect(auditLogger.logRateLimitExceeded).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle very large attempt counts', async () => {
      const mockRateLimitData = {
        identifier: '192.168.1.1',
        action_type: 'LOGIN_ATTEMPT',
        window_start: new Date().toISOString(),
        attempt_count: 999999,
        is_blocked: true,
        blocked_until: new Date(Date.now() + 3600000).toISOString(),
      };

      mockSupabase.from().eq.mockResolvedValueOnce({
        data: mockRateLimitData,
        error: null,
      });

      const status = await rateLimiter.getRateLimitStatus(
        '192.168.1.1',
        ActionType.LOGIN_ATTEMPT,
      );

      expect(status.remainingAttempts).toBe(0);
      expect(status.isBlocked).toBe(true);
    });

    it('should handle expired blocks correctly', async () => {
      const expiredBlockTime = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
      const mockRateLimitData = {
        identifier: '192.168.1.1',
        action_type: 'LOGIN_ATTEMPT',
        window_start: new Date().toISOString(),
        attempt_count: 5,
        is_blocked: true,
        blocked_until: expiredBlockTime,
      };

      mockSupabase.from().eq.mockResolvedValueOnce({
        data: mockRateLimitData,
        error: null,
      });

      const status = await rateLimiter.getRateLimitStatus(
        '192.168.1.1',
        ActionType.LOGIN_ATTEMPT,
      );

      // Should be allowed since block has expired
      expect(status.allowed).toBe(true);
      expect(status.isBlocked).toBe(false);
    });
  });
});
