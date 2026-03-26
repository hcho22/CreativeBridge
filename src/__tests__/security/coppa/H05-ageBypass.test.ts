/**
 * H-05: Age Bypass Prevention Tests
 *
 * Audit finding: Once a child selects "under 13", the age group could
 * theoretically be changed to an older category, bypassing COPPA consent
 * requirements. The server-side setAgeGroup mutation must prevent
 * "promotion" from under_13 to any older age group.
 *
 * Tests 1 & 4: Verify architecture (server-side mutation, no bypass flag).
 * Tests 2 & 3: Document missing promotion guard (test.failing).
 *
 * @implements H-05
 */

import { readSourceFile, extractFunctionBlock } from './helpers';

describe('H-05: Age Bypass Prevention', () => {
  let ageGatingSource: string;
  let userProfilesSource: string;
  let appSource: string;
  let setAgeGroupBlock: string;

  beforeAll(() => {
    ageGatingSource = readSourceFile('src/screens/AgeGatingScreen.tsx');
    userProfilesSource = readSourceFile('convex/userProfiles.ts');
    appSource = readSourceFile('App.tsx');
    setAgeGroupBlock = extractFunctionBlock(userProfilesSource, 'setAgeGroup');
  });

  test('[H-05] AgeGatingScreen calls server-side Convex mutation (not client-only storage)', () => {
    // Must use useMutation hook — age group is persisted server-side
    expect(ageGatingSource).toContain('useMutation');
    // Must target the Convex userProfiles.setAgeGroup action
    expect(ageGatingSource).toMatch(
      /api\.userProfiles\.setAgeGroup|userProfiles\.setAgeGroup/,
    );
    // Must NOT use AsyncStorage for age group (client-only would be bypassable)
    expect(ageGatingSource).not.toContain('AsyncStorage');
  });

  // The setAgeGroup mutation currently patches the ageGroup unconditionally.
  // A promotion guard should check whether the *existing* profile ageGroup is
  // 'under_13' and reject attempts to change it to an older group.
  test.failing(
    '[H-05] setAgeGroup mutation prevents promotion from under_13 to 18_plus',
    () => {
      // The handler must read the existing profile.ageGroup and guard against promotion.
      // A proper guard would look like: if (profile.ageGroup === 'under_13' && args.ageGroup !== 'under_13')
      // The key indicator is checking profile.ageGroup (the stored value) — not args.ageGroup (the request).
      expect(setAgeGroupBlock).toMatch(
        /profile\.ageGroup\s*===\s*['"]under_13['"]/,
      );
      // It must explicitly throw/reject when a promotion attempt is detected
      expect(setAgeGroupBlock).toMatch(
        /cannot\s+change|promotion|cannot.*promote|age.*locked|immutable/i,
      );
    },
  );

  test.failing(
    '[H-05] setAgeGroup mutation prevents promotion from under_13 to 13_to_17',
    () => {
      // Same promotion guard — the stored ageGroup must be checked before patch
      expect(setAgeGroupBlock).toMatch(
        /profile\.ageGroup\s*===\s*['"]under_13['"]/,
      );
      // The guard must block ALL promotions from under_13, not just to 18_plus
      expect(setAgeGroupBlock).toMatch(
        /args\.ageGroup\s*!==\s*['"]under_13['"]|['"]13_to_17['"]|['"]18_plus['"]/,
      );
    },
  );

  test('[H-05] App.tsx has no bypass parameter for needsAgeVerification', () => {
    // The needsAgeVerification condition must not have a skip/override flag
    // Look for patterns like: needsAgeVerification && !skipAge, or bypass parameters
    expect(appSource).not.toMatch(
      /skipAge|bypassAge|forceAge|overrideAge|debugAge/i,
    );
    // The condition should be a simple boolean check, not overridable
    expect(appSource).toMatch(/if\s*\(\s*needsAgeVerification\s*\)/);
    // No query parameter or env var that disables age gating
    expect(appSource).not.toMatch(/DISABLE_AGE|SKIP_AGE|NO_AGE_GATE/i);
  });
});
