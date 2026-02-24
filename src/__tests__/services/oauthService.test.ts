/**
 * OAuth Service Unit Tests
 *
 * Comprehensive unit tests for OAuth service functions (Google and Apple OAuth)
 * Tests OAuth flow completion, JWT retrieval, and error handling
 *
 * Migration Note (US-032): The Supabase sync step has been removed.
 * Profile management is now handled by Convex reactive queries in AuthContext.
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
import { isClerkConfigured } from '../../config/environment';

// Mock dependencies
jest.mock('../../config/environment');

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
  });

  describe('signInWithGoogle (deprecated)', () => {
    test('returns deprecation error - OAuth now handled in AuthContext', async () => {
      const result = await signInWithGoogle(mockClerkAuth, mockClerkUser);

      // Function is deprecated - returns error directing to AuthContext
      expect(result.success).toBe(false);
      expect(result.error).toContain('deprecated');
    });

    test('returns error if Clerk is not configured', async () => {
      mockIsClerkConfigured.mockReturnValue(false);

      const result = await signInWithGoogle(mockClerkAuth, mockClerkUser);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Clerk is not configured');
    });
  });

  describe('signInWithApple (deprecated)', () => {
    test('returns deprecation error - OAuth now handled in AuthContext', async () => {
      const result = await signInWithApple(mockClerkAuth, mockClerkUser);

      // Function is deprecated - returns error directing to AuthContext
      expect(result.success).toBe(false);
      expect(result.error).toContain('deprecated');
    });

    test('returns error if Clerk is not configured', async () => {
      mockIsClerkConfigured.mockReturnValue(false);

      const result = await signInWithApple(mockClerkAuth, mockClerkUser);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Clerk is not configured');
    });
  });

  describe('completeOAuthFlow', () => {
    test('completes OAuth flow successfully', async () => {
      const result = await completeOAuthFlow(mockClerkAuth, mockClerkUser);

      expect(mockClerkAuth.getToken).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.jwt).toBe('mock-clerk-jwt-token');
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
    });

    test('extracts email from Clerk user object', async () => {
      const result = await completeOAuthFlow(mockClerkAuth, mockClerkUser);

      expect(result.userEmail).toBe('test@example.com');
    });

    test('handles Apple private relay email', async () => {
      const appleUser = {
        ...mockClerkUser,
        emailAddresses: [{ emailAddress: 'privaterelay@icloud.com' }],
      };

      const result = await completeOAuthFlow(mockClerkAuth, appleUser);

      expect(result.userEmail).toBe('privaterelay@icloud.com');
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
    });

    test('handles unexpected errors during completion', async () => {
      mockClerkAuth.getToken.mockRejectedValue(new Error('Unexpected error'));

      const result = await completeOAuthFlow(mockClerkAuth, mockClerkUser);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
