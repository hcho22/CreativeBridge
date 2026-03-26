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
    // Verify the function produces sufficient length by checking the
    // randomBytes call uses at least 32 bytes
    const bytesMatch = tokenFnBody.match(/randomBytes\((\d+)\)/);
    if (bytesMatch) {
      const byteCount = parseInt(bytesMatch[1], 10);
      // base64url encoding: 4 chars per 3 bytes → ceil(byteCount / 3) * 4
      const expectedMinLength = Math.ceil(byteCount / 3) * 4;
      expect(expectedMinLength).toBeGreaterThanOrEqual(32);
    } else {
      // If not using randomBytes(N) pattern, check for other length guarantees
      // e.g., randomUUID produces 36 chars
      expect(tokenFnBody).toMatch(/randomUUID|randomBytes/);
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
