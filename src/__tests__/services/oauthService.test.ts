/**
 * OAuth Service Unit Tests
 *
 * Comprehensive unit tests for OAuth service functions (Google and Apple OAuth)
 * Tests OAuth flow initiation, JWT retrieval, Supabase sync, and error handling
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

import {
  signInWithGoogle,
  signInWithApple,
  completeOAuthFlow,
} from '../../services/oauthService';
import { createSupabaseSessionFromClerkJWT } from '../../services/clerkSupabaseSync';
import { isClerkConfigured } from '../../config/environment';

// Mock dependencies
jest.mock('../../services/clerkSupabaseSync');
jest.mock('../../config/environment');

const mockCreateSupabaseSessionFromClerkJWT =
  createSupabaseSessionFromClerkJWT as jest.MockedFunction<
    typeof createSupabaseSessionFromClerkJWT
  >;
const mockIsClerkConfigured = isClerkConfigured as jest.MockedFunction<
  typeof isClerkConfigured
>;

describe('OAuth Service', () => {
  let mockClerkAuth: any;
  let mockClerkUser: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    mockIsClerkConfigured.mockReturnValue(true);

    mockClerkAuth = {
      signInWithOAuth: jest.fn().mockResolvedValue(undefined),
      getToken: jest.fn().mockResolvedValue('mock-clerk-jwt-token'),
      userId: 'user_test123',
      isSignedIn: true,
    };

    mockClerkUser = {
      id: 'user_test123',
      emailAddresses: [{ emailAddress: 'test@example.com' }],
      firstName: 'Test',
      lastName: 'User',
    };

    mockCreateSupabaseSessionFromClerkJWT.mockResolvedValue({
      success: true,
      session: { access_token: 'supabase-token', user: { id: 'supabase-user-id' } },
    });
  });

  describe('signInWithGoogle', () => {
    test('initiates Google OAuth flow via Clerk', async () => {
      const result = await signInWithGoogle(mockClerkAuth, mockClerkUser);

      expect(mockClerkAuth.signInWithOAuth).toHaveBeenCalledWith({
        strategy: 'oauth_google',
        redirectUrl: 'creativebridge://auth/callback',
      });
      expect(result.success).toBe(true);
    });

    test('returns error if Clerk is not configured', async () => {
      mockIsClerkConfigured.mockReturnValue(false);

      const result = await signInWithGoogle(mockClerkAuth, mockClerkUser);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Clerk is not configured');
      expect(mockClerkAuth.signInWithOAuth).not.toHaveBeenCalled();
    });

    test('handles OAuth initiation errors', async () => {
      const error = new Error('OAuth initiation failed');
      mockClerkAuth.signInWithOAuth.mockRejectedValue(error);

      const result = await signInWithGoogle(mockClerkAuth, mockClerkUser);

      expect(result.success).toBe(false);
      expect(result.error).toBe('OAuth initiation failed');
    });

    test('handles unexpected errors gracefully', async () => {
      mockClerkAuth.signInWithOAuth.mockRejectedValue('Unexpected error');

      const result = await signInWithGoogle(mockClerkAuth, mockClerkUser);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('signInWithApple', () => {
    test('initiates Apple OAuth flow via Clerk', async () => {
      const result = await signInWithApple(mockClerkAuth, mockClerkUser);

      expect(mockClerkAuth.signInWithOAuth).toHaveBeenCalledWith({
        strategy: 'oauth_apple',
        redirectUrl: 'creativebridge://auth/callback',
      });
      expect(result.success).toBe(true);
    });

    test('returns error if Clerk is not configured', async () => {
      mockIsClerkConfigured.mockReturnValue(false);

      const result = await signInWithApple(mockClerkAuth, mockClerkUser);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Clerk is not configured');
      expect(mockClerkAuth.signInWithOAuth).not.toHaveBeenCalled();
    });

    test('handles user cancellation silently', async () => {
      const error = new Error('User cancelled Apple sign-in');
      mockClerkAuth.signInWithOAuth.mockRejectedValue(error);

      const result = await signInWithApple(mockClerkAuth, mockClerkUser);

      expect(result.success).toBe(false);
      expect(result.error).toBe('User cancelled Apple sign-in');
    });

    test('handles network errors', async () => {
      const error = new Error('Network connection error');
      mockClerkAuth.signInWithOAuth.mockRejectedValue(error);

      const result = await signInWithApple(mockClerkAuth, mockClerkUser);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    test('handles unexpected errors gracefully', async () => {
      mockClerkAuth.signInWithOAuth.mockRejectedValue('Unexpected error');

      const result = await signInWithApple(mockClerkAuth, mockClerkUser);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('completeOAuthFlow', () => {
    test('completes OAuth flow successfully', async () => {
      const result = await completeOAuthFlow(mockClerkAuth, mockClerkUser);

      expect(mockClerkAuth.getToken).toHaveBeenCalled();
      expect(mockCreateSupabaseSessionFromClerkJWT).toHaveBeenCalledWith(
        'mock-clerk-jwt-token',
        'test@example.com',
      );
      expect(result.success).toBe(true);
      expect(result.jwt).toBe('mock-clerk-jwt-token');
      expect(result.supabaseSession).toBeDefined();
      expect(result.userEmail).toBe('test@example.com');
      expect(result.clerkUserId).toBe('user_test123');
    });

    test('returns error if user is not signed in', async () => {
      mockClerkAuth.isSignedIn = false;

      const result = await completeOAuthFlow(mockClerkAuth, mockClerkUser);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not signed in');
      expect(mockClerkAuth.getToken).not.toHaveBeenCalled();
    });

    test('returns error if JWT retrieval fails', async () => {
      mockClerkAuth.getToken.mockResolvedValue(null);

      const result = await completeOAuthFlow(mockClerkAuth, mockClerkUser);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to retrieve Clerk JWT token');
      expect(mockCreateSupabaseSessionFromClerkJWT).not.toHaveBeenCalled();
    });

    test('handles Supabase sync failure', async () => {
      mockCreateSupabaseSessionFromClerkJWT.mockResolvedValue({
        success: false,
        error: 'Account linking failed',
        errorType: 'ACCOUNT_LINKING_CONFLICT',
      });

      const result = await completeOAuthFlow(mockClerkAuth, mockClerkUser);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Account linking failed');
      expect(result.errorType).toBe('ACCOUNT_LINKING_CONFLICT');
      expect(result.jwt).toBe('mock-clerk-jwt-token'); // JWT still returned
    });

    test('extracts email from Clerk user object', async () => {
      const result = await completeOAuthFlow(mockClerkAuth, mockClerkUser);

      expect(result.userEmail).toBe('test@example.com');
      expect(mockCreateSupabaseSessionFromClerkJWT).toHaveBeenCalledWith(
        'mock-clerk-jwt-token',
        'test@example.com',
      );
    });

    test('handles Apple private relay email', async () => {
      const appleUser = {
        ...mockClerkUser,
        emailAddresses: [{ emailAddress: 'privaterelay@icloud.com' }],
      };

      const result = await completeOAuthFlow(mockClerkAuth, appleUser);

      expect(result.userEmail).toBe('privaterelay@icloud.com');
      expect(mockCreateSupabaseSessionFromClerkJWT).toHaveBeenCalledWith(
        'mock-clerk-jwt-token',
        'privaterelay@icloud.com',
      );
    });

    test('uses Clerk user ID from user object', async () => {
      const result = await completeOAuthFlow(mockClerkAuth, mockClerkUser);

      expect(result.clerkUserId).toBe('user_test123');
    });

    test('falls back to Clerk auth userId if user object not provided', async () => {
      const result = await completeOAuthFlow(mockClerkAuth, null);

      expect(result.clerkUserId).toBe('user_test123');
    });

    test('handles missing email addresses gracefully', async () => {
      const userWithoutEmail = {
        ...mockClerkUser,
        emailAddresses: [],
      };

      const result = await completeOAuthFlow(mockClerkAuth, userWithoutEmail);

      expect(result.success).toBe(true);
      expect(result.userEmail).toBeUndefined();
      expect(mockCreateSupabaseSessionFromClerkJWT).toHaveBeenCalledWith(
        'mock-clerk-jwt-token',
        undefined,
      );
    });

    test('handles unexpected errors during completion', async () => {
      mockClerkAuth.getToken.mockRejectedValue(new Error('Unexpected error'));

      const result = await completeOAuthFlow(mockClerkAuth, mockClerkUser);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Error Types', () => {
    test('returns correct error type for account linking conflicts', async () => {
      mockCreateSupabaseSessionFromClerkJWT.mockResolvedValue({
        success: false,
        error: 'Profile already linked to different Clerk account',
        errorType: 'ACCOUNT_LINKING_CONFLICT',
      });

      const result = await completeOAuthFlow(mockClerkAuth, mockClerkUser);

      expect(result.errorType).toBe('ACCOUNT_LINKING_CONFLICT');
    });

    test('returns correct error type for email mismatch', async () => {
      mockCreateSupabaseSessionFromClerkJWT.mockResolvedValue({
        success: false,
        error: 'Email mismatch',
        errorType: 'EMAIL_MISMATCH',
      });

      const result = await completeOAuthFlow(mockClerkAuth, mockClerkUser);

      expect(result.errorType).toBe('EMAIL_MISMATCH');
    });

    test('returns correct error type for database errors', async () => {
      mockCreateSupabaseSessionFromClerkJWT.mockResolvedValue({
        success: false,
        error: 'Database constraint violation',
        errorType: 'DATABASE_ERROR',
      });

      const result = await completeOAuthFlow(mockClerkAuth, mockClerkUser);

      expect(result.errorType).toBe('DATABASE_ERROR');
    });
  });
});

