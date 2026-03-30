/**
 * C-07 — Email Plus VPC (Verifiable Parental Consent) Flow Verification
 *
 * Verifies the structural completeness of the Email Plus VPC consent flow:
 *   1. submitParentEmail mutation accepts parentEmail and creates consent record
 *   2. sendConsentEmail action dispatches the verification email
 *   3. GET /consent/verify renders consent page with data practices disclosure
 *   4. POST /consent/verify processes the parent's consent decision
 *   5. Token expires after 48 hours
 *
 * All tests use static source analysis — no Convex runtime required.
 *
 * @see .claude/audit/coppa-audit-2026-03-25.md — Finding C-07
 */

import { readSourceFile, extractFunctionBlock } from './helpers';

const CONSENT_SOURCE = readSourceFile('convex/consent.ts');
const HTTP_SOURCE = readSourceFile('convex/http.ts');

describe('C-07: Email Plus VPC Flow Verification', () => {
  test('[C-07] submitParentEmail mutation exists and accepts parentEmail argument', () => {
    // Verify it is declared as a mutation
    expect(CONSENT_SOURCE).toMatch(
      /export\s+const\s+submitParentEmail\s*=\s*mutation\s*\(/,
    );

    // Verify parentEmail is in the args validator
    const fnBlock = extractFunctionBlock(CONSENT_SOURCE, 'submitParentEmail');
    expect(fnBlock).toBeTruthy();
    expect(fnBlock).toContain('parentEmail');
    expect(fnBlock).toMatch(/parentEmail:\s*v\.string\(\)/);
  });

  test('[C-07] sendConsentEmail action exists', () => {
    // Verify it is declared as an action or internalAction
    expect(CONSENT_SOURCE).toMatch(
      /export\s+const\s+sendConsentEmail\s*=\s*(?:action|internalAction)\s*\(/,
    );
  });

  test('[C-07] GET /consent/verify endpoint exists in http.ts', () => {
    // Verify route handler for GET /consent/verify
    expect(HTTP_SOURCE).toContain("path: '/consent/verify'");
    expect(HTTP_SOURCE).toContain("method: 'GET'");

    // Verify GET and /consent/verify appear in close proximity (same route block)
    const getPattern =
      /path:\s*['"]\/consent\/verify['"][\s\S]{0,50}method:\s*['"]GET['"]/;
    const getPatternAlt =
      /method:\s*['"]GET['"][\s\S]{0,50}path:\s*['"]\/consent\/verify['"]/;
    expect(
      getPattern.test(HTTP_SOURCE) || getPatternAlt.test(HTTP_SOURCE),
    ).toBe(true);
  });

  test('[C-07] POST /consent/verify endpoint exists for form submission', () => {
    // Verify route handler for POST /consent/verify
    expect(HTTP_SOURCE).toContain("method: 'POST'");

    // Verify POST and /consent/verify appear in close proximity (same route block)
    const postPattern =
      /path:\s*['"]\/consent\/verify['"][\s\S]{0,50}method:\s*['"]POST['"]/;
    const postPatternAlt =
      /method:\s*['"]POST['"][\s\S]{0,50}path:\s*['"]\/consent\/verify['"]/;
    expect(
      postPattern.test(HTTP_SOURCE) || postPatternAlt.test(HTTP_SOURCE),
    ).toBe(true);
  });

  test('[C-07] Token expires after 48 hours (172800000 ms)', () => {
    // Verify the constant is defined with the correct value
    // 48 * 60 * 60 * 1000 = 172,800,000 ms
    expect(CONSENT_SOURCE).toMatch(
      /CONSENT_TOKEN_EXPIRY_MS\s*=\s*48\s*\*\s*60\s*\*\s*60\s*\*\s*1000/,
    );
  });

  test('[C-07] Consent page HTML includes data practices disclosure', () => {
    // The consent verification page must disclose:
    //   1. What data is collected
    //   2. Third-party service usage
    //   3. Parental rights

    // Data collection disclosure
    expect(HTTP_SOURCE).toMatch(/data\s+(we\s+)?collect/i);

    // Third-party service disclosure
    expect(HTTP_SOURCE).toMatch(/third.party/i);

    // Parental rights section
    expect(HTTP_SOURCE).toMatch(/your\s+rights|parental\s+rights/i);
  });
});
