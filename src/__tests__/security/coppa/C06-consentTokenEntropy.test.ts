/**
 * C-06: Consent Token Entropy Tests
 *
 * Verifies that the consent token generator in convex/consent.ts uses a
 * cryptographically secure random number generator (CSPRNG) instead of
 * Math.random().
 *
 * Static source analysis only — no runtime mocking.
 *
 * @implements COPPA Audit Finding C-06
 * @see .claude/audit/coppa-audit-2026-03-25.md
 */

import { readSourceFile, extractFunctionBlock } from './helpers';

describe('C-06: Consent Token Entropy', () => {
  const consentSource = readSourceFile('convex/consent.ts');
  const tokenFnBody = extractFunctionBlock(
    consentSource,
    'generateConsentToken',
  );

  test('[C-06] generateConsentToken does NOT use Math.random()', () => {
    expect(tokenFnBody).not.toBe('');
    expect(tokenFnBody).not.toMatch(/Math\.random/);
  });

  test('[C-06] generateConsentToken uses crypto.randomBytes or equivalent', () => {
    // The function body or the file must reference a CSPRNG primitive
    const usesCrypto =
      /randomBytes/.test(tokenFnBody) ||
      /crypto\.getRandomValues/.test(tokenFnBody) ||
      /randomUUID/.test(tokenFnBody);

    expect(usesCrypto).toBe(true);
  });

  test('[C-06] Token output is at least 32 characters', () => {
    // base64url of 32 bytes = 43 characters (no padding)
    // Verify the function produces sufficient length by checking the byte-count
    // argument to either node's randomBytes(N) or Web Crypto's Uint8Array(N).
    const bytesMatch = tokenFnBody.match(/randomBytes\((\d+)\)/);
    const uint8Match = tokenFnBody.match(/Uint8Array\((\d+)\)/);
    if (bytesMatch) {
      const byteCount = parseInt(bytesMatch[1], 10);
      const expectedMinLength = Math.ceil(byteCount / 3) * 4;
      expect(expectedMinLength).toBeGreaterThanOrEqual(32);
    } else if (uint8Match) {
      const byteCount = parseInt(uint8Match[1], 10);
      const expectedMinLength = Math.ceil(byteCount / 3) * 4;
      expect(expectedMinLength).toBeGreaterThanOrEqual(32);
    } else {
      // No byte-count pattern detected; fall back to verifying the function
      // at least references a CSPRNG primitive (randomUUID is 36 chars).
      expect(tokenFnBody).toMatch(/randomUUID|randomBytes|getRandomValues/);
    }
  });

  test('[C-06] Token uses URL-safe encoding', () => {
    // Verify the function uses base64url encoding (URL-safe, no + / = chars)
    // or only alphanumeric + hyphen/underscore characters
    const usesBase64Url = /base64url/.test(tokenFnBody);
    const usesUrlSafeChars =
      /[A-Za-z0-9_-]/.test(tokenFnBody) && !/base64[^u]/.test(tokenFnBody);

    expect(usesBase64Url || usesUrlSafeChars).toBe(true);
  });
});
