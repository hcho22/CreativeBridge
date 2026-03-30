/**
 * Clerk JWT Verification Service
 *
 * This service verifies Clerk JWTs by:
 * 1. Fetching Clerk's public keys from JWKS endpoint
 * 2. Verifying JWT signature using RSA/EC via the jose library
 * 3. Extracting Clerk user ID from verified JWT
 *
 * Architecture: Clerk handles OAuth and issues JWTs. Supabase verifies JWTs
 * against Clerk's JWKS endpoint and uses Clerk user ID for RLS policies.
 *
 * @implements US-001 S-1.3: Proper RSA/EC signature verification via jose
 */

import { jwtVerify, createRemoteJWKSet } from 'jose';
import { getClerkConfig } from '../config/environment';

export interface JWK {
  kty: string;
  use?: string;
  kid: string;
  alg: string;
  n?: string;
  e?: string;
  x?: string;
  y?: string;
  crv?: string;
}

export interface JWKS {
  keys: JWK[];
}

export interface ClerkJWTClaims {
  sub: string; // Clerk user ID (format: user_xxxxx)
  iss: string; // Issuer (Clerk instance)
  aud: string | string[]; // Audience
  exp: number; // Expiration timestamp
  iat: number; // Issued at timestamp
  [key: string]: any; // Additional claims
}

export interface JWTVerificationResult {
  valid: boolean;
  userId?: string; // Clerk user ID (extracted from 'sub' claim)
  claims?: ClerkJWTClaims;
  error?: string;
}

/**
 * Decode JWT without verification (for extracting header and claims)
 * @param token JWT token string
 * @returns Decoded header and payload
 */
export function decodeJWT(token: string): { header: any; payload: any } {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format: must have 3 parts');
    }

    // Base64 URL decode
    const base64UrlDecode = (str: string): string => {
      let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) {
        base64 += '=';
      }
      try {
        if (typeof atob !== 'undefined') {
          return atob(base64);
        } else if (typeof Buffer !== 'undefined') {
          return Buffer.from(base64, 'base64').toString('utf-8');
        } else {
          throw new Error('No base64 decoder available');
        }
      } catch (e) {
        throw new Error(
          `Base64 decode failed: ${
            e instanceof Error ? e.message : 'Unknown error'
          }`,
        );
      }
    };

    const header = JSON.parse(base64UrlDecode(parts[0]));
    const payload = JSON.parse(base64UrlDecode(parts[1]));

    return { header, payload };
  } catch (error) {
    throw new Error(
      `Failed to decode JWT: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    );
  }
}

/**
 * Verify Clerk JWT token with full cryptographic signature verification.
 *
 * Uses the jose library to:
 * 1. Fetch the JWKS from Clerk's endpoint
 * 2. Match the signing key by kid
 * 3. Verify RSA/EC signature
 * 4. Validate exp, iss claims
 *
 * @param clerkJWT JWT token from Clerk
 * @returns Verification result with Clerk user ID
 */
export async function verifyClerkJWT(
  clerkJWT: string,
): Promise<JWTVerificationResult> {
  try {
    if (!clerkJWT || typeof clerkJWT !== 'string') {
      return {
        valid: false,
        error: 'Invalid JWT: token is required',
      };
    }

    const clerkConfig = getClerkConfig();
    const jwksUrl = clerkConfig.jwksUrl;

    if (!jwksUrl) {
      return {
        valid: false,
        error: 'Clerk JWKS URL not configured',
      };
    }

    // Create a remote JWKS set that fetches and caches keys from Clerk
    const JWKS = createRemoteJWKSet(new URL(jwksUrl));

    // Verify the JWT signature and expiration
    const { payload } = await jwtVerify(clerkJWT, JWKS);

    // Validate issuer contains 'clerk'
    if (!payload.iss || !payload.iss.includes('clerk')) {
      return {
        valid: false,
        error: 'Invalid JWT issuer: not from Clerk',
      };
    }

    const userId = payload.sub;
    if (!userId || typeof userId !== 'string') {
      return {
        valid: false,
        error: 'JWT missing user ID (sub claim)',
      };
    }

    return {
      valid: true,
      userId,
      claims: payload as unknown as ClerkJWTClaims,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Provide specific error messages for common failures
    if (message.includes('expired')) {
      return {
        valid: false,
        error: 'JWT has expired',
      };
    }
    if (
      message.includes('signature') ||
      message.includes('verification failed')
    ) {
      return {
        valid: false,
        error: 'JWT signature verification failed',
      };
    }

    return {
      valid: false,
      error: `JWT verification error: ${message}`,
    };
  }
}

/**
 * Extract Clerk user ID from JWT without full verification
 * Useful for quick extraction when token is already trusted
 * @param clerkJWT JWT token from Clerk
 * @returns Clerk user ID or null
 */
export function extractClerkUserId(clerkJWT: string): string | null {
  try {
    const { payload } = decodeJWT(clerkJWT);
    return payload.sub || null;
  } catch {
    return null;
  }
}
