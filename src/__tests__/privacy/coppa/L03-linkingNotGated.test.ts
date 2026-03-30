/**
 * L-03: Linking.openSettings() Not Gated by Parental Gate Test
 *
 * Documents that VoiceInput.tsx and OAuthSessionHelpModal.tsx call
 * Linking.openSettings() without routing through the parental gate.
 * Risk level: lower (on-device settings, not external web), but
 * still a navigation escape from the app.
 *
 * @finding L-03: Linking.openSettings() bypasses parental gate
 * @status Unresolved — test.failing() documents the gap
 */

import { readSourceFile, findAllFiles } from '../../security/coppa/helpers';

describe('L-03: Linking.openSettings() not gated', () => {
  test.failing(
    '[L-03] VoiceInput.tsx Linking.openSettings() should be wrapped in parental gate',
    () => {
      const source = readSourceFile('src/components/common/VoiceInput.tsx');

      // VoiceInput calls Linking.openSettings() but does NOT import parental gate
      const hasOpenSettings = /Linking\.openSettings\(\)/.test(source);
      const hasParentalGate = /useParentalGate|ParentalGate/.test(source);

      // If it calls openSettings, it should also use the parental gate
      expect(hasOpenSettings && !hasParentalGate).toBe(false);
    },
  );

  test.failing(
    '[L-03] OAuthSessionHelpModal.tsx Linking.openSettings() should use parental gate',
    () => {
      const source = readSourceFile(
        'src/components/common/OAuthSessionHelpModal.tsx',
      );

      // OAuthSessionHelpModal imports useParentalGate but only uses it for openURL (Google).
      // The Apple path calls Linking.openSettings() directly, bypassing the gate.
      const hasParentalGate = /useParentalGate/.test(source);
      expect(hasParentalGate).toBe(true); // It does import it

      // But the handleOpenSettings for Apple uses Linking.openSettings() directly
      // instead of routing through the parental gate's openURL
      const handleOpenSettings = source.match(
        /handleOpenSettings[\s\S]*?Linking\.openSettings\(\)/,
      );
      expect(handleOpenSettings).not.toBeNull();

      // The fix: replace Linking.openSettings() with a parental-gated action
      // For now, assert the direct call does NOT exist (will fail, documenting the gap)
      expect(source).not.toMatch(/Linking\.openSettings\(\)/);
    },
  );

  test('[L-03] Risk level: on-device settings (lower risk than external web)', () => {
    // This test documents the risk assessment:
    // - Linking.openSettings() opens the device's Settings app
    // - Unlike Linking.openURL() which navigates to the web, this stays on-device
    // - The child could change app permissions but cannot access external content
    // - Risk is lower than unguarded web navigation but still an app escape route
    //
    // Files with Linking.openSettings():
    const voiceInput = readSourceFile('src/components/common/VoiceInput.tsx');
    const oauthModal = readSourceFile(
      'src/components/common/OAuthSessionHelpModal.tsx',
    );

    // Confirm both files use Linking.openSettings
    expect(voiceInput).toMatch(/Linking\.openSettings\(\)/);
    expect(oauthModal).toMatch(/Linking\.openSettings\(\)/);

    // Confirm the parental gate IS used for external URLs in OAuthSessionHelpModal
    // (shows the pattern exists, just isn't applied to openSettings)
    expect(oauthModal).toMatch(/useParentalGate/);
    expect(oauthModal).toMatch(/openURL\(/);
  });
});
