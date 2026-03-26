/**
 * Clerk JWT Verification Tests
 *
 * Tests for verifying Clerk JWTs and extracting user IDs.
 * Includes US-001 tests for forged JWT rejection and RSA JWKS verification.
 */

import {
  verifyClerkJWT,
  extractClerkUserId,
  decodeJWT,
} from '../../services/clerkJWTVerification';

// Mock fetch
global.fetch = jest.fn();

// Mock jose for controlled testing
const mockJwtVerify = jest.fn();
const mockCreateRemoteJWKSet = jest.fn(() => 'mock-jwks-set');

jest.mock('jose', () => ({
  jwtVerify: function () {
    return mockJwtVerify.apply(null, arguments);
  },
  createRemoteJWKSet: function () {
    return mockCreateRemoteJWKSet.apply(null, arguments);
  },
}));

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
      const header = { alg: 'RS256', kid: 'test-key-id' };
      const payload = {
        sub: 'user_test123',
        iss: 'https://test-clerk-instance.clerk.accounts.dev',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

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
    test('verifies valid Clerk JWT via jose', async () => {
      mockJwtVerify.mockResolvedValueOnce({
        payload: {
          sub: 'user_test123',
          iss: 'https://test-clerk-instance.clerk.accounts.dev',
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        },
        protectedHeader: { alg: 'RS256', kid: 'test-key-id' },
      });

      const result = await verifyClerkJWT('valid.jwt.token');

      expect(result.valid).toBe(true);
      expect(result.userId).toBe('user_test123');
      expect(result.claims).toBeDefined();
      expect(mockJwtVerify).toHaveBeenCalledTimes(1);
    });

    test('rejects expired JWT', async () => {
      mockJwtVerify.mockRejectedValueOnce(
        new Error('"exp" claim timestamp check failed - token expired'),
      );

      const result = await verifyClerkJWT('expired.jwt.token');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expired');
    });

    test('rejects JWT without user ID', async () => {
      mockJwtVerify.mockResolvedValueOnce({
        payload: {
          iss: 'https://test-clerk-instance.clerk.accounts.dev',
          exp: Math.floor(Date.now() / 1000) + 3600,
          // Missing 'sub' claim
        },
        protectedHeader: { alg: 'RS256', kid: 'test-key-id' },
      });

      const result = await verifyClerkJWT('no-sub.jwt.token');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('user ID');
    });

    test('handles JWKS fetch/verification error', async () => {
      mockJwtVerify.mockRejectedValueOnce(new Error('Network error'));

      const result = await verifyClerkJWT('header.payload.signature');
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

    // US-001: New tests for proper signature verification

    test('rejects JWT with forged signature', async () => {
      mockJwtVerify.mockRejectedValueOnce(
        new Error('signature verification failed'),
      );

      const result = await verifyClerkJWT('forged.jwt.badsignature');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('signature verification failed');
    });

    test('verifies RSA signature against JWKS endpoint', async () => {
      mockJwtVerify.mockResolvedValueOnce({
        payload: {
          sub: 'user_rsa_verified',
          iss: 'https://test-clerk-instance.clerk.accounts.dev',
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        },
        protectedHeader: { alg: 'RS256', kid: 'rsa-key-id' },
      });

      const result = await verifyClerkJWT('rsa.signed.jwt');

      expect(result.valid).toBe(true);
      expect(result.userId).toBe('user_rsa_verified');
      // Verify that createRemoteJWKSet was called with the Clerk JWKS URL
      expect(mockCreateRemoteJWKSet).toHaveBeenCalledWith(
        new URL(
          'https://test-clerk-instance.clerk.accounts.dev/.well-known/jwks.json',
        ),
      );
      // Verify jwtVerify was called with the token and JWKS set
      expect(mockJwtVerify).toHaveBeenCalledWith(
        'rsa.signed.jwt',
        'mock-jwks-set',
      );
    });
  });
});
