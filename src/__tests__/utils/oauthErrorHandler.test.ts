/**
 * OAuth Error Handler Unit Tests
 *
 * Comprehensive unit tests for OAuth error handling utility
 * Tests error classification, user-friendly messages, retry logic, and exponential backoff
 *
 * Based on: TASKS-oauth-google-apple-signin-PRD.md Task 5.5
 */

import { handleOAuthError } from '../../utils/oauthErrorHandler';

describe('OAuth Error Handler', () => {
  describe('User Cancellation', () => {
    test('handles user cancellation silently', () => {
      const error = 'User cancelled';
      const result = handleOAuthError(error, { provider: 'google' });

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

    test('handles cancellation in error objects', () => {
      const error = { message: 'User cancelled the operation' };
      const result = handleOAuthError(error, { provider: 'apple' });

      expect(result.shouldShowError).toBe(false);
    });
  });

  describe('Network Errors', () => {
    test('handles network errors with retry option', () => {
      const error = 'network_error';
      const result = handleOAuthError(error, { provider: 'google' });

      expect(result.shouldShowError).toBe(true);
      expect(result.userMessage).toContain('Connection error');
      expect(result.fallbackAvailable).toBe(true);
      expect(result.canRetry).toBe(true);
      expect(result.retryDelay).toBeDefined();
    });

    test('handles various network error messages', () => {
      const networkErrors = [
        'network_error',
        'network_request_failed',
        'connection_error',
        'timeout',
        'offline',
        'no internet',
        'fetch failed',
        'request timeout',
      ];

      networkErrors.forEach(errorMsg => {
        const result = handleOAuthError(errorMsg, { provider: 'google' });
        expect(result.shouldShowError).toBe(true);
        expect(result.canRetry).toBe(true);
        expect(result.userMessage).toContain('Connection');
      });
    });

    test('applies exponential backoff for network errors', () => {
      const error = 'network_error';
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

      expect(attempt2.retryDelay).toBeGreaterThan(attempt1.retryDelay!);
      expect(attempt3.canRetry).toBe(false); // Max retries reached
    });

    test('caps retry delay at maximum', () => {
      const error = 'network_error';
      const result = handleOAuthError(error, {
        provider: 'google',
        attemptNumber: 10, // Very high attempt number
      });

      expect(result.retryDelay).toBeLessThanOrEqual(10000); // Max delay
    });
  });

  describe('Account Linking Errors', () => {
    test('handles account already linked error', () => {
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

  describe('Database Errors', () => {
    test('handles constraint violation errors', () => {
      const error = 'Unique constraint violation';
      const result = handleOAuthError(error, { provider: 'google' });

      expect(result.shouldShowError).toBe(true);
      expect(result.userMessage).toContain('already linked');
      expect(result.canRetry).toBe(false);
    });

    test('handles general database errors with retry', () => {
      const error = 'database_error';
      const result = handleOAuthError(error, {
        provider: 'google',
        attemptNumber: 1,
      });

      expect(result.shouldShowError).toBe(true);
      expect(result.userMessage).toContain('save account information');
      expect(result.canRetry).toBe(true);
      expect(result.retryDelay).toBe(2000);
    });

    test('limits database error retries', () => {
      const error = 'Database error';
      const result = handleOAuthError(error, {
        provider: 'google',
        attemptNumber: 2,
      });

      expect(result.canRetry).toBe(false);
    });
  });

  describe('Provider Errors', () => {
    test('handles Clerk errors', () => {
      const error = 'Clerk error';
      const result = handleOAuthError(error, { provider: 'google' });

      expect(result.shouldShowError).toBe(true);
      expect(result.userMessage).toContain('Authentication service');
      expect(result.canRetry).toBe(true);
    });

    test('handles server errors', () => {
      const error = 'Internal server error';
      const result = handleOAuthError(error, { provider: 'google' });

      expect(result.shouldShowError).toBe(true);
      expect(result.userMessage).toContain('experiencing issues');
      expect(result.canRetry).toBe(true);
    });

    test('handles gateway errors', () => {
      const error = 'Bad gateway';
      const result = handleOAuthError(error, { provider: 'google' });

      expect(result.shouldShowError).toBe(true);
      expect(result.userMessage).toContain('experiencing issues');
      expect(result.canRetry).toBe(true);
    });

    test('applies exponential backoff for provider errors', () => {
      const error = 'Server error';
      const attempt1 = handleOAuthError(error, {
        provider: 'google',
        attemptNumber: 1,
      });
      const attempt2 = handleOAuthError(error, {
        provider: 'google',
        attemptNumber: 2,
      });

      expect(attempt2.retryDelay).toBeGreaterThan(attempt1.retryDelay!);
    });
  });

  describe('Token and Expiration Errors', () => {
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

  describe('Supabase Errors', () => {
    test('handles Supabase-specific errors', () => {
      const error = 'Supabase authentication failed';
      const result = handleOAuthError(error, { provider: 'google' });

      expect(result.shouldShowError).toBe(true);
      expect(result.userMessage).toContain('Authentication failed');
      expect(result.canRetry).toBe(true);
      expect(result.fallbackAvailable).toBe(true);
    });

    test('handles invalid credentials errors', () => {
      const error = 'invalid_credentials';
      const result = handleOAuthError(error, { provider: 'google' });

      expect(result.shouldShowError).toBe(true);
      expect(result.userMessage).toContain('Authentication failed');
      expect(result.canRetry).toBe(true);
    });
  });

  describe('Default/Unknown Errors', () => {
    test('handles unknown errors with generic message', () => {
      const error = 'Some unexpected error';
      const result = handleOAuthError(error, { provider: 'google' });

      expect(result.shouldShowError).toBe(true);
      expect(result.userMessage).toContain('error occurred');
      expect(result.canRetry).toBe(true);
      expect(result.fallbackAvailable).toBe(true);
    });

    test('applies exponential backoff for unknown errors', () => {
      const error = 'Unknown error';
      const attempt1 = handleOAuthError(error, {
        provider: 'google',
        attemptNumber: 1,
      });
      const attempt2 = handleOAuthError(error, {
        provider: 'google',
        attemptNumber: 2,
      });

      expect(attempt2.retryDelay).toBeGreaterThan(attempt1.retryDelay!);
    });

    test('limits retries for unknown errors', () => {
      const error = 'Unknown error';
      const result = handleOAuthError(error, {
        provider: 'google',
        attemptNumber: 2,
      });

      expect(result.canRetry).toBe(false);
    });
  });

  describe('Error Message Extraction', () => {
    test('extracts message from string errors', () => {
      const error = 'Simple error message';
      const result = handleOAuthError(error, { provider: 'google' });

      expect(result.userMessage).toBeDefined();
    });

    test('extracts message from error objects', () => {
      const error = { message: 'Error from object' };
      const result = handleOAuthError(error, { provider: 'google' });

      expect(result.userMessage).toBeDefined();
    });

    test('extracts message from nested error objects', () => {
      const error = { error: { message: 'Nested error message' } };
      const result = handleOAuthError(error, { provider: 'google' });

      expect(result.userMessage).toBeDefined();
    });

    test('handles errors without message gracefully', () => {
      const error = {};
      const result = handleOAuthError(error, { provider: 'google' });

      expect(result.userMessage).toBeDefined();
      expect(result.userMessage.length).toBeGreaterThan(0);
    });
  });

  describe('Provider-Specific Handling', () => {
    test('handles Google-specific errors', () => {
      const error = 'Google OAuth error';
      const result = handleOAuthError(error, { provider: 'google' });

      expect(result.shouldShowError).toBe(true);
      expect(result.fallbackAvailable).toBe(true);
    });

    test('handles Apple-specific errors', () => {
      const error = 'Apple OAuth error';
      const result = handleOAuthError(error, { provider: 'apple' });

      expect(result.shouldShowError).toBe(true);
      expect(result.fallbackAvailable).toBe(true);
    });
  });

  describe('Retry Logic', () => {
    test('allows retry for retryable errors on first attempt', () => {
      const error = 'Network error';
      const result = handleOAuthError(error, {
        provider: 'google',
        attemptNumber: 1,
      });

      expect(result.canRetry).toBe(true);
    });

    test('disallows retry after max attempts', () => {
      const error = 'Network error';
      const result = handleOAuthError(error, {
        provider: 'google',
        attemptNumber: 3,
      });

      expect(result.canRetry).toBe(false);
    });

    test('provides retry delay for retryable errors', () => {
      const error = 'Network error';
      const result = handleOAuthError(error, {
        provider: 'google',
        attemptNumber: 1,
      });

      expect(result.retryDelay).toBeDefined();
      expect(result.retryDelay).toBeGreaterThan(0);
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
      });
    });

    test('fallback message suggests email/password', () => {
      const error = 'Account linking failed';
      const result = handleOAuthError(error, { provider: 'google' });

      expect(result.userMessage).toContain('email and password');
    });
  });
});
