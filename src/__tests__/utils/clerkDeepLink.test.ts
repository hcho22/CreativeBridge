/**
 * Clerk Deep Link Tests
 *
 * Tests for parsing and handling Clerk OAuth callback deep links
 */

import {
  isClerkCallback,
  parseClerkCallbackURL,
  extractClerkRedirectURL,
  getClerkCallbackError,
  handleClerkCallback,
} from '../../utils/clerkDeepLink';

// Mock expo-linking parse function
jest.mock('expo-linking', () => ({
  parse: jest.fn((url: string) => {
    try {
      // Extract scheme
      const schemeMatch = url.match(/^([^:]+):/);
      const scheme = schemeMatch ? schemeMatch[1] : '';

      // Extract path and query
      const pathAndQuery = url.replace(/^[^:]+:\/\//, '');
      const [pathPart, queryPart] = pathAndQuery.split('?');
      const [pathOnly, hashPart] = pathPart.split('#');

      const queryParams: Record<string, string> = {};

      // Parse query string
      if (queryPart) {
        const params = new URLSearchParams(queryPart);
        params.forEach((value, key) => {
          queryParams[key] = value;
        });
      }

      // Parse hash fragment
      if (hashPart) {
        const hashParams = new URLSearchParams(hashPart);
        hashParams.forEach((value, key) => {
          queryParams[key] = value;
        });
      }

      return {
        scheme,
        path: pathOnly || '',
        queryParams,
      };
    } catch {
      return {
        scheme: '',
        path: '',
        queryParams: {},
      };
    }
  }),
}));

describe('Clerk Deep Link Utilities', () => {
  describe('isClerkCallback', () => {
    test('identifies Clerk callback URLs', () => {
      const clerkUrl =
        'creativebridge://auth/callback?__clerk_redirect_url=https://example.com';
      expect(isClerkCallback(clerkUrl)).toBe(true);
    });

    test('identifies Clerk callback with session', () => {
      const clerkUrl = 'creativebridge://auth/callback?__clerk_session=abc123';
      expect(isClerkCallback(clerkUrl)).toBe(true);
    });

    test('identifies Clerk callback with clerk in URL', () => {
      const clerkUrl = 'creativebridge://auth/callback?clerk_token=abc123';
      expect(isClerkCallback(clerkUrl)).toBe(true);
    });

    test('rejects non-Clerk callbacks', () => {
      const supabaseUrl = 'creativebridge://auth/callback?access_token=abc123';
      expect(isClerkCallback(supabaseUrl)).toBe(false);
    });

    test('rejects non-auth URLs', () => {
      const otherUrl = 'creativebridge://other/path';
      expect(isClerkCallback(otherUrl)).toBe(false);
    });

    test('rejects empty or null URLs', () => {
      expect(isClerkCallback('')).toBe(false);
      // @ts-ignore - testing invalid input
      expect(isClerkCallback(null)).toBe(false);
    });
  });

  describe('parseClerkCallbackURL', () => {
    test('parses Clerk callback URL correctly', () => {
      const url =
        'creativebridge://auth/callback?__clerk_redirect_url=https://example.com/callback';
      const parsed = parseClerkCallbackURL(url);

      expect(parsed).not.toBeNull();
      expect(parsed?.scheme).toBe('creativebridge');
      expect(parsed?.path).toBe('auth/callback');
      expect(parsed?.params.__clerk_redirect_url).toBe(
        'https://example.com/callback',
      );
      expect(parsed?.isClerkCallback).toBe(true);
    });

    test('parses Clerk callback with multiple parameters', () => {
      const url =
        'creativebridge://auth/callback?__clerk_redirect_url=https://example.com&__clerk_session=abc123';
      const parsed = parseClerkCallbackURL(url);

      expect(parsed).not.toBeNull();
      expect(parsed?.params.__clerk_redirect_url).toBe('https://example.com');
      expect(parsed?.params.__clerk_session).toBe('abc123');
    });

    test('parses Clerk callback with hash fragments', () => {
      const url =
        'creativebridge://auth/callback#__clerk_redirect_url=https://example.com';
      const parsed = parseClerkCallbackURL(url);

      expect(parsed).not.toBeNull();
      expect(parsed?.params.__clerk_redirect_url).toBe('https://example.com');
    });

    test('returns null for invalid URLs', () => {
      const invalidUrl = 'not-a-valid-url';
      const parsed = parseClerkCallbackURL(invalidUrl);
      expect(parsed).toBeNull();
    });
  });

  describe('extractClerkRedirectURL', () => {
    test('extracts Clerk redirect URL from callback', () => {
      const url =
        'creativebridge://auth/callback?__clerk_redirect_url=https://example.com/callback';
      const redirectUrl = extractClerkRedirectURL(url);

      expect(redirectUrl).toBe('https://example.com/callback');
    });

    test('returns null if redirect URL is missing', () => {
      const url = 'creativebridge://auth/callback?other_param=value';
      const redirectUrl = extractClerkRedirectURL(url);

      expect(redirectUrl).toBeNull();
    });

    test('returns null for invalid URLs', () => {
      const invalidUrl = 'not-a-valid-url';
      const redirectUrl = extractClerkRedirectURL(invalidUrl);

      expect(redirectUrl).toBeNull();
    });
  });

  describe('getClerkCallbackError', () => {
    test('extracts error from Clerk callback', () => {
      const url =
        'creativebridge://auth/callback?error=access_denied&error_description=User%20cancelled';
      const error = getClerkCallbackError(url);

      expect(error).not.toBeNull();
      expect(error?.error).toBe('access_denied');
      expect(error?.description).toBe('User cancelled');
    });

    test('returns null if no error in callback', () => {
      const url =
        'creativebridge://auth/callback?__clerk_redirect_url=https://example.com';
      const error = getClerkCallbackError(url);

      expect(error).toBeNull();
    });
  });

  describe('handleClerkCallback', () => {
    test('handles successful Clerk callback', () => {
      const url =
        'creativebridge://auth/callback?__clerk_redirect_url=https://example.com/callback';
      const result = handleClerkCallback(url);

      expect(result.success).toBe(true);
      expect(result.redirectUrl).toBe('https://example.com/callback');
      expect(result.error).toBeUndefined();
    });

    test('handles Clerk callback with error', () => {
      const url =
        'creativebridge://auth/callback?error=access_denied&error_description=User%20cancelled';
      const result = handleClerkCallback(url);

      // Error callbacks should still be considered Clerk callbacks
      // but the result indicates the error
      expect(result.success).toBe(false);
      expect(result.error).toBe('access_denied');
      expect(result.errorDescription).toBe('User cancelled');
    });

    test('handles Clerk callback without redirect URL', () => {
      const url = 'creativebridge://auth/callback?other_param=value';
      const result = handleClerkCallback(url);

      // ClerkProvider can handle callbacks even without explicit redirect URL
      expect(result.success).toBe(true);
      expect(result.redirectUrl).toBeUndefined();
    });

    test('rejects non-Clerk callbacks', () => {
      const url = 'creativebridge://auth/callback?access_token=abc123';
      const result = handleClerkCallback(url);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not a Clerk callback URL');
    });

    test('handles invalid URLs gracefully', () => {
      const invalidUrl = 'not-a-valid-url';
      const result = handleClerkCallback(invalidUrl);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
