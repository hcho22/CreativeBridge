/**
 * L-02: Username Auto-Fill Privacy Test
 *
 * Verifies that under-13 users do not have their real name auto-populated
 * from OAuth, and that username derivation uses email prefix only.
 * Documents that email-prefix auto-fill for username is still active
 * for under-13 users (a weaker concern than real name exposure).
 *
 * @finding L-02: Username auto-filled from email prefix for all users
 * @status Partially addressed — display name blocked for under-13, username not
 */

import { readSourceFile } from '../../security/coppa/helpers';

describe('L-02: Username auto-fill privacy', () => {
  let profileSource: string;

  beforeAll(() => {
    profileSource = readSourceFile('src/screens/ProfileCompletionScreen.tsx');
  });

  test('[L-02] Under-13 display name is NOT auto-filled from OAuth', () => {
    // US-010: The guard at line 97 prevents auto-fill when isUnder13 is true
    // Pattern: `if (!displayName && !displayNameTouched && !isUnder13)`
    expect(profileSource).toMatch(
      /!displayName\s*&&\s*!displayNameTouched\s*&&\s*!isUnder13/,
    );

    // isUnder13 should be derived from age_group
    expect(profileSource).toMatch(
      /isUnder13\s*=\s*userProfile\?\.age_group\s*===\s*['"]under_13['"]/,
    );
  });

  test('[L-02] Username derived from email prefix via split(@)', () => {
    // Username auto-fill extracts prefix from email
    expect(profileSource).toMatch(/\.split\(\s*['"]@['"]\s*\)\[0\]/);
  });

  test('[L-02] Username sanitization removes dots and special chars', () => {
    // Sanitization chain: lowercase, replace invalid chars, trim edges
    expect(profileSource).toMatch(/\.toLowerCase\(\)/);
    // The sanitization regex replaces non-alphanumeric chars with underscore
    expect(profileSource).toContain(".replace(/[^a-z0-9_-]/g, '_')");
  });

  test.failing(
    '[L-02] Under-13 username auto-fill from email prefix should also be blocked',
    () => {
      // The username auto-fill useEffect does NOT check isUnder13 —
      // it populates for all users. For COPPA compliance, under-13 users
      // should not have any PII (including email prefix) auto-populated.
      //
      // Expected fix: add `&& !isUnder13` to the username auto-fill guard,
      // or at minimum ensure the email prefix doesn't reveal PII.
      const usernameAutoFillBlock = profileSource.match(
        /Pre-fill username[\s\S]*?setUsername\(/,
      );
      expect(usernameAutoFillBlock).not.toBeNull();
      // The block should contain an isUnder13 check
      expect(usernameAutoFillBlock![0]).toMatch(/isUnder13/);
    },
  );
});
