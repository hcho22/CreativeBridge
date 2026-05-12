/**
 * C-05: Privacy Policy Placeholder Completeness Test
 *
 * Verifies that docs/legal/privacy-policy.md does NOT contain placeholder
 * fields ([INSERT ...], [TODO], [TBD]). Originally written as `test.failing`
 * tripwires while the policy still had `[INSERT CONTACT EMAIL]` /
 * `[INSERT MAILING ADDRESS]` markers; the operator contact block was
 * populated as part of the US-012 legal readback (2026-05-12), so per the
 * original file directive the tests are now regular passing assertions.
 *
 * @finding C-05: Privacy policy has placeholder fields
 * @status Resolved — placeholders filled in 2026-05-12
 */

import { readSourceFile } from './helpers';

describe('C-05: Privacy policy completeness', () => {
  let policySource: string;

  beforeAll(() => {
    policySource = readSourceFile('docs/legal/privacy-policy.md');
  });

  test('[C-05] Privacy policy contains no [INSERT ...] placeholders', () => {
    const insertPlaceholders = policySource.match(/\[INSERT[^\]]*\]/g);
    expect(insertPlaceholders).toBeNull();
  });

  test('[C-05] Privacy policy contains no [TODO] or [TBD] placeholders', () => {
    const todoPlaceholders = policySource.match(/\[(TODO|TBD)[^\]]*\]/gi);
    expect(todoPlaceholders).toBeNull();
  });

  // US-012 (2026-05-11): the Effective Date / Last Updated fields were
  // bumped to a real date (2026-05-11) as part of the voice-processing
  // disclosure update. Test converted from .failing to passing per the
  // file's docstring directive.
  test('[C-05] Effective date is a real date, not a placeholder', () => {
    // The first 10 lines should contain the effective date without [INSERT.
    // We deliberately scope to the header so the body's INSERT placeholders
    // (contact email / mailing address — still tracked by the other
    // `test.failing` assertions in this file) don't false-positive here.
    const headerLines = policySource.split('\n').slice(0, 10).join('\n');
    expect(headerLines).not.toMatch(/\[INSERT/);
  });

  test('[C-05] Contact email is populated with a real email address', () => {
    const hasPlaceholderEmail = /\[INSERT CONTACT EMAIL\]/.test(policySource);
    const hasRealEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(
      policySource,
    );
    expect(hasPlaceholderEmail).toBe(false);
    expect(hasRealEmail).toBe(true);
  });

  // §312.4(d)(1) postal-address disclosure is handled via the
  // "address upon request" pattern (the operator block notes that
  // postal correspondence is provided on email request rather than
  // publishing a literal address). This assertion guards against a
  // literal `[INSERT MAILING ADDRESS]` placeholder sneaking back in.
  test('[C-05] No [INSERT MAILING ADDRESS] placeholder remains', () => {
    expect(policySource).not.toMatch(/\[INSERT MAILING ADDRESS\]/);
  });
});
