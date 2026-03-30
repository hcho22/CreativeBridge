/**
 * L-04: Display Name Free-Text Input Safety Test
 *
 * Verifies that under-13 users see a "fun nickname" placeholder
 * (discouraging real names) and that OAuth real-name auto-fill is blocked.
 * Documents missing autoComplete/textContentType restrictions and
 * the absence of a name-pattern validator for under-13 inputs.
 *
 * @finding L-04: Display name is free-text with no real-name detection
 * @status Partially addressed — placeholder and auto-fill guard exist
 */

import { readSourceFile } from '../../security/coppa/helpers';

describe('L-04: Display name free-text safety', () => {
  let profileSource: string;

  beforeAll(() => {
    profileSource = readSourceFile('src/screens/ProfileCompletionScreen.tsx');
  });

  test('[L-04] Under-13 display name field has placeholder discouraging real names', () => {
    // For under-13 users, the placeholder should suggest a nickname, not a real name
    // Pattern: isUnder13 ? 'Choose a fun nickname!' : 'How should we display your name?'
    expect(profileSource).toMatch(/isUnder13[\s\S]*?Choose a fun nickname!/);

    // The label should also change to "Nickname" for under-13
    expect(profileSource).toMatch(
      /isUnder13\s*\?\s*['"]Nickname['"]\s*:\s*['"]Display Name['"]/,
    );
  });

  test('[L-04] Under-13 display name is not pre-filled from OAuth', () => {
    // The useEffect guard: `!displayName && !displayNameTouched && !isUnder13`
    // prevents auto-filling from Clerk firstName/lastName for under-13 users
    expect(profileSource).toMatch(
      /!displayName\s*&&\s*!displayNameTouched\s*&&\s*!isUnder13/,
    );

    // The skip flow also guards against OAuth name for under-13
    // Pattern: `isUnder13 ? displayName.trim() || ... : ... clerkUserObj?.firstName`
    expect(profileSource).toMatch(
      /isUnder13[\s\S]*?displayName\.trim\(\)[\s\S]*?clerkUserObj\?\.firstName/,
    );
  });

  test.failing(
    '[L-04] Display name input should have autoComplete="off" or textContentType="none" for under-13',
    () => {
      // The TextInput for display name should disable OS-level autocomplete
      // which can suggest the user's real name from contacts/keyboard dictionary.
      // Currently, no autoComplete or textContentType prop is set on the input.

      // Find the display name TextInput block
      const displayNameInput = profileSource.match(
        /Nickname['"][\s\S]*?<TextInput[\s\S]*?onChangeText={handleDisplayNameChange}/,
      );
      expect(displayNameInput).not.toBeNull();

      // Assert autoComplete or textContentType is set
      const hasAutoCompleteOff = /autoComplete\s*=\s*['"]off['"]/.test(
        displayNameInput![0],
      );
      const hasTextContentTypeNone = /textContentType\s*=\s*['"]none['"]/.test(
        displayNameInput![0],
      );
      expect(hasAutoCompleteOff || hasTextContentTypeNone).toBe(true);
    },
  );

  test.failing(
    '[L-04] Name-pattern validator exists for under-13 display names',
    () => {
      // A name-pattern validator would detect patterns that look like real names
      // (e.g., "FirstName LastName" format) and warn/block under-13 users.
      // Currently no such validator exists in the codebase.

      // Check for a name validation utility or inline check
      const hasNameValidator =
        /validateDisplayName|isRealName|namePattern|realNameCheck/.test(
          profileSource,
        );
      expect(hasNameValidator).toBe(true);
    },
  );
});
