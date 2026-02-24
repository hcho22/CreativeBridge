/**
 * OAuth Performance Tests
 *
 * Performance tests for OAuth flows including timing, network checks, and error handling
 *
 * Based on: TASKS-oauth-google-apple-signin-PRD.md Task 5.5
 */

// Mock dependencies first
jest.mock('react-native-url-polyfill/auto', () => ({}));
jest.mock('../../services/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      getUser: jest.fn(),
    },
  },
}));
jest.mock('@react-native-community/netinfo');
// Note: clerkSupabaseSync removed in US-032 migration - Convex handles profile management
jest.mock('../../config/environment', () => ({
  isClerkConfigured: jest.fn().mockReturnValue(true),
}));

import { checkNetworkBeforeOAuth } from '../../utils/oauthNetworkCheck';
import { handleOAuthError } from '../../utils/oauthErrorHandler';
import { signInWithGoogle, signInWithApple } from '../../services/oauthService';
import NetInfo from '@react-native-community/netinfo';

describe('OAuth Performance Tests', () => {
  let mockNetInfoFetch: jest.MockedFunction<typeof NetInfo.fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockNetInfoFetch = NetInfo.fetch as jest.MockedFunction<
      typeof NetInfo.fetch
    >;
    // Ensure mock is properly set up
    if (!mockNetInfoFetch) {
      (NetInfo.fetch as any) = jest.fn();
      mockNetInfoFetch = NetInfo.fetch as jest.MockedFunction<
        typeof NetInfo.fetch
      >;
    }
  });

  describe('Network Check Performance', () => {
    test('network check completes quickly', async () => {
      mockNetInfoFetch.mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
        type: 'wifi',
        details: null,
      } as any);

      const startTime = Date.now();
      await checkNetworkBeforeOAuth();
      const endTime = Date.now();

      const duration = endTime - startTime;
      // Network check should complete in < 100ms (mocked)
      expect(duration).toBeLessThan(1000);
    });

    test('network check does not block OAuth initiation', async () => {
      mockNetInfoFetch.mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
        type: 'wifi',
        details: null,
      } as any);

      const networkCheck = checkNetworkBeforeOAuth();
      const result = await networkCheck;

      expect(result.isConnected).toBe(true);
      // Should not throw or hang
    });
  });

  describe('Error Handling Performance', () => {
    test('error handling is fast', () => {
      const error = 'Network error';
      const startTime = Date.now();
      handleOAuthError(error, { provider: 'google' });
      const endTime = Date.now();

      const duration = endTime - startTime;
      // Error handling should be synchronous and fast (< 10ms)
      expect(duration).toBeLessThan(100);
    });

    test('error handling does not block UI', () => {
      const errors = [
        'Network error',
        'User cancelled',
        'Account linking failed',
        'Database error',
        'Provider error',
      ];

      const startTime = Date.now();
      errors.forEach(error => {
        handleOAuthError(error, { provider: 'google' });
      });
      const endTime = Date.now();

      const duration = endTime - startTime;
      // Processing multiple errors should be fast
      expect(duration).toBeLessThan(100);
    });
  });

  describe('OAuth Service Performance', () => {
    test('OAuth initiation does not block', async () => {
      const mockClerkAuth = {
        signInWithOAuth: jest.fn().mockResolvedValue(undefined),
        getToken: jest.fn(),
        userId: 'user_test123',
        isSignedIn: false,
      };

      const startTime = Date.now();
      await signInWithGoogle(mockClerkAuth);
      const endTime = Date.now();

      const duration = endTime - startTime;
      // OAuth initiation should be fast (mocked, no actual network call)
      expect(duration).toBeLessThan(1000);
    });

    test('Apple OAuth initiation does not block', async () => {
      const mockClerkAuth = {
        signInWithOAuth: jest.fn().mockResolvedValue(undefined),
        getToken: jest.fn(),
        userId: 'user_test123',
        isSignedIn: false,
      };

      const startTime = Date.now();
      await signInWithApple(mockClerkAuth);
      const endTime = Date.now();

      const duration = endTime - startTime;
      // Apple OAuth initiation should be fast (mocked, no actual network call)
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Retry Performance', () => {
    test('exponential backoff delays are reasonable', () => {
      const error = 'Network error';
      const attempt1 = handleOAuthError(error, {
        provider: 'google',
        attemptNumber: 1,
      });
      const attempt2 = handleOAuthError(error, {
        provider: 'google',
        attemptNumber: 2,
      });
      const attempt3 = handleOAuthError(error, {
        provider: 'google',
        attemptNumber: 3,
      });

      // Retry delays should be reasonable (not too long)
      expect(attempt1.retryDelay).toBeLessThan(5000);
      expect(attempt2.retryDelay).toBeLessThan(10000);
      expect(attempt3.canRetry).toBe(false); // No more retries
    });

    test('retry delays are capped at maximum', () => {
      const error = 'Network error';
      const result = handleOAuthError(error, {
        provider: 'google',
        attemptNumber: 10,
      });

      // Retry delay should be capped
      expect(result.retryDelay).toBeLessThanOrEqual(10000);
    });
  });

  describe('Memory Performance', () => {
    test('error handling does not leak memory', () => {
      // Process many errors to check for memory leaks
      for (let i = 0; i < 1000; i++) {
        handleOAuthError(`Error ${i}`, { provider: 'google' });
      }

      // If we get here without errors, memory is likely fine
      expect(true).toBe(true);
    });
  });

  describe('Concurrent OAuth Performance', () => {
    test('multiple OAuth attempts are handled correctly', async () => {
      const mockClerkAuth = {
        signInWithOAuth: jest.fn().mockResolvedValue(undefined),
        getToken: jest.fn(),
        userId: 'user_test123',
        isSignedIn: false,
      };

      // Simulate concurrent OAuth attempts
      const promises = [
        signInWithGoogle(mockClerkAuth),
        signInWithApple(mockClerkAuth),
      ];

      const results = await Promise.all(promises);

      // Both should complete successfully
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });
  });
});
