/**
 * Clerk JWT Verification Tests
 *
 * Tests for verifying Clerk JWTs and extracting user IDs
 */

import {
  verifyClerkJWT,
  extractClerkUserId,
  decodeJWT,
} from '../../services/clerkJWTVerification';

// Mock fetch
global.fetch = jest.fn();

// Mock environment config
jest.mock('../../config/environment', () => ({
  getClerkConfig: jest.fn(() => ({
    publishableKey: 'pk_test_1234567890',
    jwksUrl:
      'https://test-clerk-instance.clerk.accounts.dev/.well-known/jwks.json',
  })),
}));

describe('Clerk JWT Verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('decodeJWT', () => {
    test('decodes valid JWT', () => {
      // Create a mock JWT (not cryptographically valid, but structurally correct)
      const header = { alg: 'RS256', kid: 'test-key-id' };
      const payload = {
        sub: 'user_test123',
        iss: 'https://test-clerk-instance.clerk.accounts.dev',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      // Properly encode with padding
      const encodedHeader = btoa(JSON.stringify(header))
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
      const encodedPayload = btoa(JSON.stringify(payload))
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
      const token = `${encodedHeader}.${encodedPayload}.signature`;

      const result = decodeJWT(token);
      expect(result.header).toEqual(header);
      expect(result.payload).toEqual(payload);
    });

    test('throws error for invalid JWT format', () => {
      expect(() => decodeJWT('invalid.token')).toThrow();
      expect(() => decodeJWT('onlyonepart')).toThrow();
    });
  });

  describe('extractClerkUserId', () => {
    test('extracts Clerk user ID from valid JWT', () => {
      const header = { alg: 'RS256', kid: 'test-key-id' };
      const payload = {
        sub: 'user_test123',
        iss: 'https://test-clerk-instance.clerk.accounts.dev',
      };
      const encodedHeader = btoa(JSON.stringify(header))
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
      const encodedPayload = btoa(JSON.stringify(payload))
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
      const token = `${encodedHeader}.${encodedPayload}.signature`;

      const userId = extractClerkUserId(token);
      expect(userId).toBe('user_test123');
    });

    test('returns null for JWT without sub claim', () => {
      const header = { alg: 'RS256', kid: 'test-key-id' };
      const payload = { iss: 'https://test-clerk-instance.clerk.accounts.dev' };
      const encodedHeader = btoa(JSON.stringify(header))
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
      const encodedPayload = btoa(JSON.stringify(payload))
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
      const token = `${encodedHeader}.${encodedPayload}.signature`;

      const userId = extractClerkUserId(token);
      expect(userId).toBeNull();
    });

    test('returns null for invalid JWT', () => {
      const userId = extractClerkUserId('invalid.jwt.token');
      expect(userId).toBeNull();
    });
  });

  describe('verifyClerkJWT', () => {
    const mockJWKS = {
      keys: [
        {
          kty: 'RSA',
          kid: 'test-key-id',
          alg: 'RS256',
          use: 'sig',
          n: 'test-n-value',
          e: 'AQAB',
        },
      ],
    };

    test('verifies valid Clerk JWT', async () => {
      // Mock fetch for JWKS
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockJWKS,
      });

      // Create a mock JWT with valid structure
      const header = { alg: 'RS256', kid: 'test-key-id' };
      const payload = {
        sub: 'user_test123',
        iss: 'https://test-clerk-instance.clerk.accounts.dev',
        exp: Math.floor(Date.now() / 1000) + 3600, // Not expired
        iat: Math.floor(Date.now() / 1000),
      };

      const encodedHeader = btoa(JSON.stringify(header))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/[=]/g, '');
      const encodedPayload = btoa(JSON.stringify(payload))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/[=]/g, '');
      const token = `${encodedHeader}.${encodedPayload}.signature`;

      const result = await verifyClerkJWT(token);

      // Note: Full signature verification requires server-side implementation
      // This test verifies the structure and claims extraction
      expect(result.valid).toBe(true);
      expect(result.userId).toBe('user_test123');
      expect(result.claims).toBeDefined();
    });

    test('rejects invalid JWT format', async () => {
      const result = await verifyClerkJWT('invalid.jwt.token');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('rejects expired JWT', async () => {
      // Mock fetch for JWKS
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockJWKS,
      });

      const header = { alg: 'RS256', kid: 'test-key-id' };
      const payload = {
        sub: 'user_test123',
        iss: 'https://test-clerk-instance.clerk.accounts.dev',
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired
        iat: Math.floor(Date.now() / 1000) - 7200,
      };

      const encodedHeader = btoa(JSON.stringify(header))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/[=]/g, '');
      const encodedPayload = btoa(JSON.stringify(payload))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/[=]/g, '');
      const token = `${encodedHeader}.${encodedPayload}.signature`;

      const result = await verifyClerkJWT(token);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expired');
    });

    test('rejects JWT without user ID', async () => {
      // Mock fetch for JWKS
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockJWKS,
      });

      const header = { alg: 'RS256', kid: 'test-key-id' };
      const payload = {
        iss: 'https://test-clerk-instance.clerk.accounts.dev',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        // Missing 'sub' claim
      };

      const encodedHeader = btoa(JSON.stringify(header))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/[=]/g, '');
      const encodedPayload = btoa(JSON.stringify(payload))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/[=]/g, '');
      const token = `${encodedHeader}.${encodedPayload}.signature`;

      const result = await verifyClerkJWT(token);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('user ID');
    });

    test('handles JWKS fetch error', async () => {
      // Mock fetch failure
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network error'),
      );

      const token = 'header.payload.signature';
      const result = await verifyClerkJWT(token);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('handles invalid JWKS response', async () => {
      // Mock invalid JWKS response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invalid: 'response' }),
      });

      const token = 'header.payload.signature';
      const result = await verifyClerkJWT(token);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('rejects empty or null JWT', async () => {
      const result1 = await verifyClerkJWT('');
      expect(result1.valid).toBe(false);

      // @ts-ignore - testing invalid input
      const result2 = await verifyClerkJWT(null);
      expect(result2.valid).toBe(false);
    });
  });
});
