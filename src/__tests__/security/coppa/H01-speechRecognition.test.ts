/**
 * H-01: Speech Recognition Audio Disclosure Tests
 *
 * Audit finding: Speech recognition audio may be sent to cloud services
 * (Google Cloud Speech on Android via @react-native-voice/voice) without
 * disclosure in the privacy policy.
 *
 * iOS uses on-device SFSpeechRecognizer (NativeModules.SpeechRecognizerModule).
 * Android falls back to @react-native-voice/voice which routes through Google.
 *
 * Tests 1-2: Verify iOS on-device preference (already implemented).
 * Test 3: Documents missing privacy policy disclosure (test.failing).
 *
 * @implements H-01
 */

import { readSourceFile } from './helpers';

describe('H-01: Speech Recognition Audio Disclosure', () => {
  let speechRecognizerSource: string;
  let voiceInputSource: string;

  beforeAll(() => {
    speechRecognizerSource = readSourceFile(
      'src/services/nativeSpeechRecognizer.ts',
    );
    voiceInputSource = readSourceFile('src/components/common/VoiceInput.tsx');
  });

  test('[H-01] nativeSpeechRecognizer uses NativeModules.SpeechRecognizerModule (iOS on-device)', () => {
    // The service must reference the native iOS SpeechRecognizerModule
    expect(speechRecognizerSource).toContain(
      'NativeModules.SpeechRecognizerModule',
    );
    // It should be gated to iOS only
    expect(speechRecognizerSource).toMatch(/Platform\.OS\s*===\s*['"]ios['"]/);
  });

  test('[H-01] VoiceInput prefers native iOS recognizer when Platform.OS === "ios"', () => {
    // VoiceInput must import the native speech recognizer
    expect(voiceInputSource).toContain('nativeSpeechRecognizer');
    // It must check Platform.OS for iOS to decide which recognizer to use
    expect(voiceInputSource).toMatch(/Platform\.OS\s*===\s*['"]ios['"]/);
    // It should have a variable/constant that gates native iOS usage
    expect(voiceInputSource).toMatch(
      /useNativeIOSSpeechRecognizer|nativeSpeechRecognizer\.isModuleAvailable/,
    );
  });

  // This test documents the audit gap: the privacy policy does not mention
  // voice/speech data handling. Once a "Voice Data" section is added,
  // this test will start passing and test.failing() will flag it for update.
  test.failing('[H-01] Privacy policy discloses voice data handling', () => {
    const privacyPolicy = readSourceFile('docs/legal/privacy-policy.md');
    // Policy should mention voice or speech data collection
    expect(privacyPolicy).toMatch(/voice|speech|audio|dictation/i);
  });
});
