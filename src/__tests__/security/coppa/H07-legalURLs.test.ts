/**
 * H-07: Legal URL Placeholder Tests
 *
 * Verifies that privacy policy, terms of service, and consent-related pages
 * use production-ready URLs — not localhost, example.com, or TODO placeholders.
 *
 * COPPA requires that parents be provided a link to the full privacy policy
 * before granting consent. These tests document gaps where legal URLs are
 * still placeholder values or missing entirely.
 *
 * All tests use test.failing() to document known gaps.
 * When a gap is fixed, the test will start failing — flip it to test().
 *
 * @implements COPPA Audit Finding H-07
 * @see .claude/audit/coppa-audit-2026-03-25.md
 */

import { readSourceFile, extractFunctionBlock } from './helpers';

describe('H-07: Legal URL Placeholders', () => {
  // -------------------------------------------------------------------------
  // All tests below use test.failing() to document known gaps.
  // When a fix lands, the test will fail — convert it to a regular test().
  // -------------------------------------------------------------------------

  const legalUrlsSource = readSourceFile('src/config/legalUrls.ts');

  test.failing(
    '[H-07] Privacy policy URL is not localhost or placeholder',
    () => {
      // legalUrls.ts currently has a TODO comment indicating the URLs are not
      // production-ready. Even though the URL format looks real (https://...),
      // the TODO marker signals it hasn't been verified as live.
      // A production-ready legal URL file should not contain TODO markers.
      expect(legalUrlsSource).toMatch(/PRIVACY_POLICY:\s*['"]https:\/\//);
      expect(legalUrlsSource).not.toMatch(/TODO/i);
      expect(legalUrlsSource).not.toMatch(/localhost/i);
      expect(legalUrlsSource).not.toMatch(/example\.com/i);
    },
  );

  test.failing('[H-07] Terms of service URL is production-ready', () => {
    // Same gap as above — ToS URL exists but is marked with a TODO placeholder.
    expect(legalUrlsSource).toMatch(/TERMS_OF_SERVICE:\s*['"]https:\/\//);
    expect(legalUrlsSource).not.toMatch(/TODO/i);
    expect(legalUrlsSource).not.toMatch(/localhost/i);
    expect(legalUrlsSource).not.toMatch(/example\.com/i);
  });

  test.failing('[H-07] Consent email HTML contains real legal URLs', () => {
    // COPPA requires that the consent email link to the full privacy policy
    // so parents can review data practices before clicking "I Consent".
    // Currently, buildConsentEmailHtml only includes the consent verification
    // link (consentUrl) but no link to the privacy policy or terms of service.
    const consentSource = readSourceFile('convex/consent.ts');
    const emailHtmlBody = extractFunctionBlock(
      consentSource,
      'buildConsentEmailHtml',
    );

    expect(emailHtmlBody).not.toBe('');
    // Should contain an <a href="https://..."> linking to the privacy policy
    expect(emailHtmlBody).toMatch(/href=.*privacy/i);
  });

  test.failing(
    '[H-07] Consent verification page links to real privacy policy',
    () => {
      // The consent verification page (http.ts buildConsentPage) describes data
      // practices inline but does not link to the full privacy policy document.
      // COPPA requires a "direct link" to the complete privacy policy.
      const httpSource = readSourceFile('convex/http.ts');
      const consentPageBody = extractFunctionBlock(
        httpSource,
        'buildConsentPage',
      );

      expect(consentPageBody).not.toBe('');
      // Should contain an <a href="https://..."> linking to the privacy policy
      expect(consentPageBody).toMatch(/href=.*privacy/i);
    },
  );
});
