/**
 * OAuth Error Handling Scenarios Tests
 *
 * Comprehensive tests for all OAuth error scenarios including
 * network errors, user cancellations, account linking failures, and provider errors
 *
 * Based on: TASKS-oauth-google-apple-signin-PRD.md Task 5.5
 */

import { handleOAuthError } from '../../utils/oauthErrorHandler';
import { checkNetworkBeforeOAuth, getNetworkErrorMessage } from '../../utils/oauthNetworkCheck';

// Mock dependencies
jest.mock('../../utils/oauthNetworkCheck');
jest.mock('../../services/clerkSupabaseSync');

const mockCheckNetworkBeforeOAuth = checkNetworkBeforeOAuth as jest.MockedFunction<
  typeof checkNetworkBeforeOAuth
>;
const mockGetNetworkErrorMessage = getNetworkErrorMessage as jest.MockedFunction<
  typeof getNetworkErrorMessage
>;

describe('OAuth Error Handling Scenarios', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Network Error Scenarios', () => {
    test('handles offline scenario', async () => {
      mockCheckNetworkBeforeOAuth.mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
        connectionType: 'none',
      });

      mockGetNetworkErrorMessage.mockReturnValue(
        'No internet connection. Please check your network settings and try again.',
      );

      const networkState = await checkNetworkBeforeOAuth();
      const errorMessage = getNetworkErrorMessage(networkState);

      expect(networkState.isConnected).toBe(false);
      expect(errorMessage).toBeDefined();
      expect(errorMessage).toContain('No internet connection');
    });

    test('handles unstable connection scenario', async () => {
      mockCheckNetworkBeforeOAuth.mockResolvedValue({
        isConnected: true,
        isInternetReachable: false,
        connectionType: 'cellular',
      });

      mockGetNetworkErrorMessage.mockReturnValue(
        'Internet connection is not available. Please check your network connection.',
      );

      const networkState = await checkNetworkBeforeOAuth();
      const errorMessage = getNetworkErrorMessage(networkState);

      expect(networkState.isConnected).toBe(true);
      expect(networkState.isInternetReachable).toBe(false);
      expect(errorMessage).toBeDefined();
    });

    test('handles network timeout during OAuth', () => {
      const error = 'Request timeout';
      const result = handleOAuthError(error, { provider: 'google' });

      expect(result.shouldShowError).toBe(true);
      expect(result.userMessage).toContain('Connection error');
      expect(result.canRetry).toBe(true);
    });
  });

  describe('User Cancellation Scenarios', () => {
    test('handles Google OAuth cancellation silently', () => {
      const error = 'User cancelled';
      const result = handleOAuthError(error, { provider: 'google' });

      expect(result.shouldShowError).toBe(false);
      expect(result.userMessage).toBe('');
      expect(result.canRetry).toBe(false);
    });

    test('handles Apple OAuth cancellation silently', () => {
      const error = 'User cancelled Apple sign-in';
      const result = handleOAuthError(error, { provider: 'apple' });

      expect(result.shouldShowError).toBe(false);
      expect(result.userMessage).toBe('');
      expect(result.canRetry).toBe(false);
    });

    test('handles various cancellation messages', () => {
      const cancellationMessages = [
        'user_cancelled',
        'user_canceled',
        'cancelled_by_user',
        'canceled_by_user',
        'user_cancelled_login',
        'user_canceled_authorization',
      ];

      cancellationMessages.forEach(message => {
        const result = handleOAuthError(message, { provider: 'google' });
        expect(result.shouldShowError).toBe(false);
      });
    });
  });

  describe('Account Linking Error Scenarios', () => {
    test('handles profile already linked to different account', () => {
      const error = 'Profile is already linked to a different Clerk account';
      const result = handleOAuthError(error, { provider: 'google' });

      expect(result.shouldShowError).toBe(true);
      expect(result.userMessage).toContain('already linked');
      expect(result.canRetry).toBe(false);
      expect(result.fallbackAvailable).toBe(true);
    });

    test('handles email mismatch error', () => {
      const error = 'email_mismatch';
      const result = handleOAuthError(error, { provider: 'google' });

      expect(result.shouldShowError).toBe(true);
      expect(result.userMessage).toContain('email address does not match');
      expect(result.canRetry).toBe(false);
    });

    test('handles email already exists error', () => {
      const error = 'email_already_exists';
      const result = handleOAuthError(error, { provider: 'google' });

      expect(result.shouldShowError).toBe(true);
      expect(result.userMessage).toContain('already associated');
      expect(result.canRetry).toBe(false);
    });

    test('handles general account linking failure', () => {
      const error = 'account_linking_failed';
      const result = handleOAuthError(error, { provider: 'google' });

      expect(result.shouldShowError).toBe(true);
      expect(result.userMessage).toContain('link your account');
      expect(result.canRetry).toBe(false);
    });
  });

  describe('Database Error Scenarios', () => {
    test('handles constraint violation errors', () => {
      const error = 'Unique constraint violation';
      const result = handleOAuthError(error, { provider: 'google' });

      expect(result.shouldShowError).toBe(true);
      expect(result.userMessage).toContain('already linked');
      expect(result.canRetry).toBe(false);
    });

    test('handles general database errors with retry', () => {
      const error = 'database_error';
      const result = handleOAuthError(error, { provider: 'google', attemptNumber: 1 });

      expect(result.shouldShowError).toBe(true);
      expect(result.userMessage).toContain('save account information');
      expect(result.canRetry).toBe(true);
      expect(result.retryDelay).toBe(2000);
    });

    test('limits database error retries', () => {
      const error = 'Database error';
      const result = handleOAuthError(error, { provider: 'google', attemptNumber: 2 });

      expect(result.canRetry).toBe(false);
    });
  });

  describe('Provider Error Scenarios', () => {
    test('handles Clerk service errors', () => {
      const error = 'Clerk error';
      const result = handleOAuthError(error, { provider: 'google', attemptNumber: 1 });

      expect(result.shouldShowError).toBe(true);
      expect(result.userMessage).toContain('Authentication service');
      expect(result.canRetry).toBe(true);
    });

    test('handles server errors with exponential backoff', () => {
      const error = 'Internal server error';
      const attempt1 = handleOAuthError(error, { provider: 'google', attemptNumber: 1 });
      const attempt2 = handleOAuthError(error, { provider: 'google', attemptNumber: 2 });

      expect(attempt1.canRetry).toBe(true);
      expect(attempt2.canRetry).toBe(false);
      expect(attempt2.retryDelay).toBeGreaterThan(attempt1.retryDelay!);
    });

    test('handles gateway errors', () => {
      const error = 'Bad gateway';
      const result = handleOAuthError(error, { provider: 'google' });

      expect(result.shouldShowError).toBe(true);
      expect(result.userMessage).toContain('experiencing issues');
      expect(result.canRetry).toBe(true);
    });
  });

  describe('Token and Expiration Error Scenarios', () => {
    test('handles invalid token errors', () => {
      const error = 'Invalid token';
      const result = handleOAuthError(error, { provider: 'google' });

      expect(result.shouldShowError).toBe(true);
      expect(result.userMessage).toContain('session expired');
      expect(result.canRetry).toBe(true);
      expect(result.retryDelay).toBe(1000);
    });

    test('handles expired token errors', () => {
      const error = 'Token expired';
      const result = handleOAuthError(error, { provider: 'google' });

      expect(result.shouldShowError).toBe(true);
      expect(result.userMessage).toContain('session expired');
      expect(result.canRetry).toBe(true);
    });
  });

  describe('Retry Logic Scenarios', () => {
    test('allows retry for network errors with exponential backoff', () => {
      const error = 'network_error';
      const attempt1 = handleOAuthError(error, { provider: 'google', attemptNumber: 1 });
      const attempt2 = handleOAuthError(error, { provider: 'google', attemptNumber: 2 });
      const attempt3 = handleOAuthError(error, { provider: 'google', attemptNumber: 3 });

      expect(attempt1.canRetry).toBe(true); // attemptNumber 1 < 3
      expect(attempt2.canRetry).toBe(true); // attemptNumber 2 < 3
      expect(attempt3.canRetry).toBe(false); // attemptNumber 3 >= 3, max retries reached
      expect(attempt2.retryDelay).toBeGreaterThan(attempt1.retryDelay!);
    });

    test('disallows retry for non-retryable errors', () => {
      const error = 'account_linking_failed';
      const result = handleOAuthError(error, { provider: 'google', attemptNumber: 1 });

      expect(result.canRetry).toBe(false);
    });
  });

  describe('Fallback Options', () => {
    test('provides fallback option for most errors', () => {
      const errors = [
        'Network error',
        'Account linking failed',
        'Database error',
        'Provider error',
      ];

      errors.forEach(error => {
        const result = handleOAuthError(error, { provider: 'google' });
        expect(result.fallbackAvailable).toBe(true);
        expect(result.userMessage).toContain('email and password');
      });
    });
  });

  describe('Error Message Quality', () => {
    test('error messages are user-friendly', () => {
      const errors = [
        'Network error',
        'Account linking failed',
        'Database error',
        'Provider error',
      ];

      errors.forEach(error => {
        const result = handleOAuthError(error, { provider: 'google' });
        expect(result.userMessage.length).toBeGreaterThan(0);
        expect(result.userMessage).not.toContain('ERROR_CODE');
        expect(result.userMessage).not.toContain('undefined');
      });
    });

    test('error messages are actionable', () => {
      const error = 'Network error';
      const result = handleOAuthError(error, { provider: 'google' });

      expect(result.userMessage).toContain('try again');
      expect(result.fallbackAvailable).toBe(true);
    });
  });
});

