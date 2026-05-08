/**
 * H-01: Speech Recognition Audio Disclosure Tests
 *
 * Audit finding: Speech recognition audio may be sent to cloud services
 * without disclosure in the privacy policy.
 *
 * !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 * !! REGRESSION DETECTED (US-015f.1.3, 2026-05-08)                    !!
 * !!                                                                  !!
 * !! When this audit was originally written, iOS used on-device       !!
 * !! `SFSpeechRecognizer` via `NativeModules.SpeechRecognizerModule`   !!
 * !! (covered by `src/services/nativeSpeechRecognizer.ts`, still      !!
 * !! present in the repo but with ZERO production consumers).         !!
 * !!                                                                  !!
 * !! Per the 2026-04-14 architectural decision, `VoiceInput.tsx`     !!
 * !! was rewritten to use `whisperTranscriptionService`, which        !!
 * !! sends audio to OpenAI Whisper via the Convex `transcribeAudio`   !!
 * !! action — i.e., to a cloud service. The H-01 protection (iOS     !!
 * !! on-device speech recognition) has been silently lost. Test 2    !!
 * !! correctly fails because of this; do NOT "fix" it by editing the !!
 * !! assertion to match the new (cloud-based) implementation.        !!
 * !!                                                                  !!
 * !! Required action (NOT in scope for US-015f.1.3 mechanical fix):  !!
 * !!   - Maintainer + legal/COPPA officer must decide whether to:    !!
 * !!     (a) restore on-device iOS speech recognition (preserves      !!
 * !!         original H-01 protection), OR                            !!
 * !!     (b) update privacy policy to disclose cloud-based voice     !!
 * !!         transcription via OpenAI Whisper (test.failing #3       !!
 * !!         already tracks this), AND obtain renewed consent.       !!
 * !!                                                                  !!
 * !! Until that decision lands, this test stays failing as a real    !!
 * !! audit signal, NOT as US-015f cleanup work.                      !!
 * !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
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
