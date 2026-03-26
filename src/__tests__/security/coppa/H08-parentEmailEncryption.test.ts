/**
 * H-08 — Parent Email Encryption Tests
 *
 * Verifies that parentEmail is encrypted at rest in Convex consentRecords
 * and not leaked to the client through queries.
 *
 * Currently parentEmail is stored in plaintext. The test.failing() tests
 * document the expected encryption/decryption pattern. When encryption is
 * implemented, these tests will auto-flip to failures — convert them to
 * normal test() at that point.
 *
 * @see .claude/audit/coppa-audit-2026-03-25.md — Finding H-08
 */

import { readSourceFile, extractFunctionBlock } from './helpers';

const CONSENT_SOURCE = readSourceFile('convex/consent.ts');

describe('H-08: Parent Email Encryption', () => {
  // ── Encryption at rest (test.failing — not yet implemented) ────────

  test.failing('[H-08] consentRecords.parentEmail is stored encrypted', () => {
    const fnBlock = extractFunctionBlock(CONSENT_SOURCE, 'submitParentEmail');
    expect(fnBlock).toBeTruthy();

    // Find the db.insert call and verify encryption happens before it
    const insertIdx = fnBlock.indexOf('ctx.db.insert');
    expect(insertIdx).toBeGreaterThan(-1);

    // There should be an encryption call before the insert
    const beforeInsert = fnBlock.substring(0, insertIdx);
    const hasEncryption =
      /encrypt|cipher|crypto\.subtle|createCipheriv|aes/i.test(beforeInsert);
    expect(hasEncryption).toBe(true);
  });

  test.failing('[H-08] parentEmail is decrypted on read', () => {
    // Query paths that access parentEmail should decrypt it
    // Look for a decrypt utility or inline decryption in consent queries
    const hasDecryption =
      /decrypt|decipher|crypto\.subtle|createDecipheriv/i.test(CONSENT_SOURCE);
    expect(hasDecryption).toBe(true);
  });

  // ── Client exposure checks (should pass now) ──────────────────────

  test('[H-08] getConsentStatus does not return parentEmail', () => {
    const fnBlock = extractFunctionBlock(CONSENT_SOURCE, 'getConsentStatus');
    expect(fnBlock).toBeTruthy();

    // Extract the return object(s) — excluding `return null`
    const returnMatches = fnBlock.match(/return\s*\{[\s\S]*?\};/g);
    expect(returnMatches).not.toBeNull();

    const objectReturns = returnMatches!
      .join('\n')
      .replace(/return null;/g, '');
    expect(objectReturns).not.toContain('parentEmail');
  });

  test('[H-08] parentEmail is not returned to client in non-parent-facing queries', () => {
    // getConsentStatus and isConsentRequired are the main client-facing queries.
    // They must NOT expose parentEmail.
    // (getParentalDashboardData and exportChildData are parent-facing —
    //  returning parentEmail there is acceptable under COPPA as the parent
    //  is the data subject requesting their own data.)

    const getConsentStatus = extractFunctionBlock(
      CONSENT_SOURCE,
      'getConsentStatus',
    );
    const isConsentRequired = extractFunctionBlock(
      CONSENT_SOURCE,
      'isConsentRequired',
    );

    // Neither child-facing query should expose parentEmail in its return
    const getConsentReturns = getConsentStatus
      .match(/return\s*\{[\s\S]*?\};/g)
      ?.join('\n')
      .replace(/return null;/g, '');
    const isConsentReturns = isConsentRequired
      .match(/return\s*\{[\s\S]*?\};/g)
      ?.join('\n')
      .replace(/return null;/g, '');

    if (getConsentReturns) {
      expect(getConsentReturns).not.toContain('parentEmail');
    }
    if (isConsentReturns) {
      expect(isConsentReturns).not.toContain('parentEmail');
    }
  });
});
