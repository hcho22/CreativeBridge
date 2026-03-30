/**
 * C-01: Age Gate Ordering Regression Test
 *
 * Verifies that the age verification check (AgeGatingScreen) always
 * precedes the profile completion check (ProfileCompletionScreen)
 * in App.tsx. This prevents OAuth from collecting child PII before
 * confirming the user's age — a COPPA requirement.
 *
 * @finding C-01: OAuth collects child PII before age gate
 * @status Already fixed — regression test only
 */

import { readSourceFile } from './helpers';

describe('C-01: Age gate ordering regression', () => {
  let appSource: string;
  let ageGatingSource: string;

  beforeAll(() => {
    appSource = readSourceFile('App.tsx');
    ageGatingSource = readSourceFile('src/screens/AgeGatingScreen.tsx');
  });

  test('C-01: AgeGatingScreen conditional precedes ProfileCompletionScreen conditional in App.tsx', () => {
    const ageCheckIndex = appSource.indexOf('needsAgeVerification');
    const profileCheckIndex = appSource.indexOf('needsProfileCompletion');

    // Both must exist
    expect(ageCheckIndex).toBeGreaterThan(-1);
    expect(profileCheckIndex).toBeGreaterThan(-1);

    // But we need the *conditional* usage (the `if` statement), not the destructuring.
    // Find the conditional if-blocks for each:
    const ageIfIndex = appSource.indexOf('if (needsAgeVerification)');
    const profileIfIndex = appSource.indexOf(
      'if (\n    needsProfileCompletion',
    );

    // Fall back to a broader search if exact format differs
    const ageConditionalIndex =
      ageIfIndex !== -1
        ? ageIfIndex
        : appSource.search(/if\s*\(\s*needsAgeVerification\s*\)/);
    const profileConditionalIndex =
      profileIfIndex !== -1
        ? profileIfIndex
        : appSource.search(/if\s*\(\s*\n?\s*needsProfileCompletion/);

    expect(ageConditionalIndex).toBeGreaterThan(-1);
    expect(profileConditionalIndex).toBeGreaterThan(-1);
    expect(ageConditionalIndex).toBeLessThan(profileConditionalIndex);
  });

  test('C-01: needsAgeVerification returns AgeGatingScreen before needsProfileCompletion returns ProfileCompletionScreen', () => {
    // Find the return(<AgeGatingScreen) and return(<ProfileCompletionScreen) positions
    // These represent the actual early-return render paths
    const ageReturnIndex = appSource.search(
      /return\s*\(\s*\n?\s*<AgeGatingScreen/,
    );
    const profileReturnIndex = appSource.search(
      /return\s*\(\s*\n?\s*<ProfileCompletionScreen/,
    );

    expect(ageReturnIndex).toBeGreaterThan(-1);
    expect(profileReturnIndex).toBeGreaterThan(-1);

    // Verify ordering: AgeGatingScreen return comes first
    expect(ageReturnIndex).toBeLessThan(profileReturnIndex);
  });

  test('C-01: AgeGatingScreen calls setAgeGroup Convex mutation', () => {
    // Verify AgeGatingScreen uses the Convex mutation to persist age group
    expect(ageGatingSource).toMatch(/useMutation/);
    expect(ageGatingSource).toMatch(/api\.userProfiles\.setAgeGroup/);
  });

  test('C-01: No bypass route when ageGroup is null/undefined', () => {
    // The needsAgeVerification flag is derived from `!userProfile.age_group`
    // in AuthContext — verify the condition checks for falsy ageGroup.
    const authContextSource = readSourceFile('src/context/AuthContext.tsx');

    // The derivation should check for falsy age_group
    const derivationPattern =
      /needsAgeVerification\s*=\s*!!\(\s*userProfile\s*&&\s*!userProfile\.age_group\s*\)/;
    expect(authContextSource).toMatch(derivationPattern);

    // In App.tsx, the age verification check is a simple truthy check
    // with an early return — no way to bypass
    const earlyReturnPattern =
      /if\s*\(\s*needsAgeVerification\s*\)\s*\{?\s*\n?\s*return/;
    expect(appSource).toMatch(earlyReturnPattern);
  });
});
