/**
 * C-05: Privacy Policy Placeholder Completeness Test
 *
 * Documents that docs/legal/privacy-policy.md still contains placeholder
 * fields ([INSERT ...], [TODO], [TBD]). No code fix is possible — this
 * requires legal/business input to populate real values.
 *
 * All tests use test.failing() to pass in CI while documenting the gap.
 * Once placeholders are filled, these tests will auto-flip and should
 * be converted to regular test() calls.
 *
 * @finding C-05: Privacy policy has placeholder fields
 * @status Unresolved — requires legal/business input
 */

import { readSourceFile } from './helpers';

describe('C-05: Privacy policy completeness', () => {
  let policySource: string;

  beforeAll(() => {
    policySource = readSourceFile('docs/legal/privacy-policy.md');
  });

  test.failing(
    '[C-05] Privacy policy contains no [INSERT ...] placeholders',
    () => {
      const insertPlaceholders = policySource.match(/\[INSERT[^\]]*\]/g);
      expect(insertPlaceholders).toBeNull();
    },
  );

  test('[C-05] Privacy policy contains no [TODO] or [TBD] placeholders', () => {
    // Currently passes — no [TODO]/[TBD] markers present (only [INSERT ...])
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

  test.failing(
    '[C-05] Contact email is populated with a real email address',
    () => {
      // The contact section should have a real email, not [INSERT CONTACT EMAIL]
      // A real email matches user@domain.tld pattern
      const hasPlaceholderEmail = /\[INSERT CONTACT EMAIL\]/.test(policySource);
      const hasRealEmail =
        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(policySource);
      expect(hasPlaceholderEmail).toBe(false);
      expect(hasRealEmail).toBe(true);
    },
  );

  test.failing(
    '[C-05] Operator mailing address is populated, not a placeholder',
    () => {
      expect(policySource).not.toMatch(/\[INSERT MAILING ADDRESS\]/);
    },
  );
});
