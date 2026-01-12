/**
 * Clerk Configuration Verification Tests
 *
 * These tests verify that Clerk is properly configured according to Task 1.1
 * of the OAuth implementation plan.
 *
 * Based on: TASKS-oauth-google-apple-signin-PRD.md
 */

import {
  isClerkConfigured,
  getClerkConfig,
  Environment,
} from '../../config/environment';

describe('Clerk Configuration', () => {
  describe('isClerkConfigured', () => {
    test('returns false when Clerk is not configured', () => {
      // Mock environment without Clerk config
      const originalClerk = Environment.clerk;
      delete (Environment as any).clerk;

      const result = isClerkConfigured();
      expect(result).toBe(false);

      // Restore
      (Environment as any).clerk = originalClerk;
    });

    test('returns false when publishable key is missing', () => {
      const originalClerk = Environment.clerk;
      (Environment as any).clerk = {
        publishableKey: '',
        jwksUrl: 'https://test.clerk.accounts.dev/.well-known/jwks.json',
      };

      const result = isClerkConfigured();
      expect(result).toBe(false);

      // Restore
      (Environment as any).clerk = originalClerk;
    });

    test('returns false when JWKS URL is missing', () => {
      const originalClerk = Environment.clerk;
      (Environment as any).clerk = {
        publishableKey: 'pk_test_1234567890',
        jwksUrl: '',
      };

      const result = isClerkConfigured();
      expect(result).toBe(false);

      // Restore
      (Environment as any).clerk = originalClerk;
    });

    test('returns false when publishable key does not start with pk_', () => {
      const originalClerk = Environment.clerk;
      (Environment as any).clerk = {
        publishableKey: 'invalid_key_1234567890',
        jwksUrl: 'https://test.clerk.accounts.dev/.well-known/jwks.json',
      };

      const result = isClerkConfigured();
      expect(result).toBe(false);

      // Restore
      (Environment as any).clerk = originalClerk;
    });

    test('returns false when JWKS URL does not contain clerk', () => {
      const originalClerk = Environment.clerk;
      (Environment as any).clerk = {
        publishableKey: 'pk_test_1234567890',
        jwksUrl: 'https://invalid-url.com/.well-known/jwks.json',
      };

      const result = isClerkConfigured();
      expect(result).toBe(false);

      // Restore
      (Environment as any).clerk = originalClerk;
    });

    test('returns false when JWKS URL does not contain .well-known/jwks.json', () => {
      const originalClerk = Environment.clerk;
      (Environment as any).clerk = {
        publishableKey: 'pk_test_1234567890',
        jwksUrl: 'https://test.clerk.accounts.dev/invalid-path',
      };

      const result = isClerkConfigured();
      expect(result).toBe(false);

      // Restore
      (Environment as any).clerk = originalClerk;
    });

    test('returns true when Clerk is properly configured', () => {
      const originalClerk = Environment.clerk;
      (Environment as any).clerk = {
        publishableKey: 'pk_test_1234567890abcdefghijklmnopqrstuvwxyz',
        jwksUrl:
          'https://test-clerk-instance.clerk.accounts.dev/.well-known/jwks.json',
      };

      const result = isClerkConfigured();
      expect(result).toBe(true);

      // Restore
      (Environment as any).clerk = originalClerk;
    });
  });

  describe('getClerkConfig', () => {
    test('throws error when Clerk is not configured', () => {
      const originalClerk = Environment.clerk;
      delete (Environment as any).clerk;

      expect(() => getClerkConfig()).toThrow(
        'Clerk is not configured. Please set CLERK_PUBLISHABLE_KEY and CLERK_JWKS_URL environment variables.',
      );

      // Restore
      (Environment as any).clerk = originalClerk;
    });

    test('throws error when publishable key is missing', () => {
      const originalClerk = Environment.clerk;
      (Environment as any).clerk = {
        publishableKey: '',
        jwksUrl: 'https://test.clerk.accounts.dev/.well-known/jwks.json',
      };

      expect(() => getClerkConfig()).toThrow(
        'Clerk is not configured. Please set CLERK_PUBLISHABLE_KEY and CLERK_JWKS_URL environment variables.',
      );

      // Restore
      (Environment as any).clerk = originalClerk;
    });

    test('throws error when JWKS URL is missing', () => {
      const originalClerk = Environment.clerk;
      (Environment as any).clerk = {
        publishableKey: 'pk_test_1234567890',
        jwksUrl: '',
      };

      expect(() => getClerkConfig()).toThrow(
        'Clerk is not configured. Please set CLERK_PUBLISHABLE_KEY and CLERK_JWKS_URL environment variables.',
      );

      // Restore
      (Environment as any).clerk = originalClerk;
    });

    test('returns Clerk config when properly configured', () => {
      const originalClerk = Environment.clerk;
      const testConfig = {
        publishableKey: 'pk_test_1234567890abcdefghijklmnopqrstuvwxyz',
        secretKey: 'sk_test_secret_key',
        jwksUrl:
          'https://test-clerk-instance.clerk.accounts.dev/.well-known/jwks.json',
      };
      (Environment as any).clerk = testConfig;

      const result = getClerkConfig();
      expect(result).toEqual(testConfig);
      expect(result.publishableKey).toBe(testConfig.publishableKey);
      expect(result.jwksUrl).toBe(testConfig.jwksUrl);
      expect(result.secretKey).toBe(testConfig.secretKey);

      // Restore
      (Environment as any).clerk = originalClerk;
    });

    test('returns config without secret key when secret key is not provided', () => {
      const originalClerk = Environment.clerk;
      const testConfig = {
        publishableKey: 'pk_test_1234567890abcdefghijklmnopqrstuvwxyz',
        jwksUrl:
          'https://test-clerk-instance.clerk.accounts.dev/.well-known/jwks.json',
      };
      (Environment as any).clerk = testConfig;

      const result = getClerkConfig();
      expect(result.publishableKey).toBe(testConfig.publishableKey);
      expect(result.jwksUrl).toBe(testConfig.jwksUrl);
      expect(result.secretKey).toBeUndefined();

      // Restore
      (Environment as any).clerk = originalClerk;
    });
  });

  describe('Clerk Configuration Format Validation', () => {
    test('publishable key format validation', () => {
      const validKeys = [
        'pk_test_1234567890',
        'pk_live_abcdefghijklmnopqrstuvwxyz',
        'pk_test_1234567890abcdefghijklmnopqrstuvwxyz1234567890',
      ];

      const invalidKeys = [
        'sk_test_1234567890', // Secret key instead of publishable
        'invalid_key',
        'pk_', // Too short (less than 10 chars)
        'pk_test', // Too short (less than 10 chars)
        '',
      ];

      validKeys.forEach(key => {
        const originalClerk = Environment.clerk;
        (Environment as any).clerk = {
          publishableKey: key,
          jwksUrl: 'https://test.clerk.accounts.dev/.well-known/jwks.json',
        };
        expect(isClerkConfigured()).toBe(true);
        (Environment as any).clerk = originalClerk;
      });

      invalidKeys.forEach(key => {
        const originalClerk = Environment.clerk;
        (Environment as any).clerk = {
          publishableKey: key,
          jwksUrl: 'https://test.clerk.accounts.dev/.well-known/jwks.json',
        };
        expect(isClerkConfigured()).toBe(false);
        (Environment as any).clerk = originalClerk;
      });
    });

    test('JWKS URL format validation', () => {
      const validUrls = [
        'https://test-clerk-instance.clerk.accounts.dev/.well-known/jwks.json',
        'https://my-app.clerk.accounts.dev/.well-known/jwks.json',
        'https://clerk-test.clerk.accounts.dev/.well-known/jwks.json',
      ];

      const invalidUrls = [
        'https://invalid-url.com/.well-known/jwks.json', // No clerk domain
        'https://test.clerk.accounts.dev/invalid-path', // Wrong path
        'http://test.clerk.accounts.dev/.well-known/jwks.json', // HTTP instead of HTTPS (should fail)
        '',
      ];

      validUrls.forEach(url => {
        const originalClerk = Environment.clerk;
        (Environment as any).clerk = {
          publishableKey: 'pk_test_1234567890',
          jwksUrl: url,
        };
        expect(isClerkConfigured()).toBe(true);
        (Environment as any).clerk = originalClerk;
      });

      invalidUrls.forEach(url => {
        const originalClerk = Environment.clerk;
        (Environment as any).clerk = {
          publishableKey: 'pk_test_1234567890',
          jwksUrl: url,
        };
        expect(isClerkConfigured()).toBe(false);
        (Environment as any).clerk = originalClerk;
      });
    });
  });

  describe('Integration with Environment Config', () => {
    test('Clerk config is part of EnvironmentConfig interface', () => {
      // This test ensures TypeScript type checking
      const config = Environment;
      expect(config).toHaveProperty('clerk');

      if (config.clerk) {
        expect(config.clerk).toHaveProperty('publishableKey');
        expect(config.clerk).toHaveProperty('jwksUrl');
        // secretKey is optional
      }
    });

    test('Environment config can be accessed without errors', () => {
      expect(() => {
        const config = Environment;
        return config.clerk;
      }).not.toThrow();
    });
  });
});
