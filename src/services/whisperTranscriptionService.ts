/**
 * WhisperTranscriptionService
 *
 * Records microphone audio to a local file via `expo-av` and ships the file
 * to OpenAI Whisper (through the Convex `transcribeAudio` action) for
 * transcription. Replaces the on-device `@react-native-voice/voice` /
 * `SFSpeechRecognizer` stack for the voice-first input bar (US-013).
 *
 * **Why this exists**: iOS's `SFSpeechRecognizer` runs in "search" mode by
 * default — aggressive VAD that auto-finalizes after ~1s of speech, chopping
 * long sentences like "In the twinkling expanse of the Cosmic Carnival" into
 * garbled first-segment fragments ("In Lots of"). `@react-native-voice/voice`
 * does not expose `taskHint = .dictation` and restarting the recognizer
 * loses audio across `AVAudioSession` transitions. Whisper processes the
 * whole utterance server-side with no segmentation, giving us accurate
 * transcripts at the cost of ~1–3s round-trip latency (no live partials).
 *
 * **API surface** (imperative, single active recording at a time):
 *   - `isAvailable()`           — check permissions + Convex readiness
 *   - `requestPermissions()`    — prompt for mic access
 *   - `startRecording()`        — begin capturing to a temp .m4a file
 *   - `stopAndTranscribe()`     — stop + upload + return final transcript
 *   - `cancel()`                — abort current recording, discard audio
 *   - `isRecording()`           — check current state
 *   - `getMaxDurationMs()`      — safety cap for runaway recordings
 *
 * **Error handling** follows `src/services/CLAUDE.md`: throw descriptive
 * errors with context; callers handle UX messaging.
 */

import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { openaiClient } from './openaiClient';

// ----------------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------------

/**
 * Hard cap on recording length. K-2 kids telling a story turn rarely need
 * more than ~30s — past that we risk runaway recordings (battery, storage,
 * and Whisper cost) if the user walks away without tapping stop. If the cap
 * trips we auto-finalize with whatever we have.
 */
const MAX_RECORDING_MS = 60_000;

/**
 * Empty-audio floor. A recording shorter than this is almost certainly a
 * tap-then-release mis-press — we bail early rather than upload 0.2s of
 * silence to Whisper (which returns a hallucinated fragment or empty
 * string, both wasteful).
 */
const MIN_RECORDING_MS = 400;

// ----------------------------------------------------------------------------
// Service
// ----------------------------------------------------------------------------

export class WhisperTranscriptionService {
  private recording: Audio.Recording | null = null;
  private recordingStartedAt = 0;
  private safetyTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * True when Convex is reachable AND we have (or can get) mic permission.
   * Used by VoiceInput to decide whether to show the Speak button at all.
   */
  public async isAvailable(): Promise<boolean> {
    if (!openaiClient.isConfigured()) {
      return false;
    }
    try {
      const { status } = await Audio.getPermissionsAsync();
      // If already granted we're good; if undetermined we can prompt later.
      return status !== 'denied';
    } catch {
      return false;
    }
  }

  /**
   * Prompt the user for microphone permission. Returns true if granted.
   * No-op if permission is already granted. The caller should present its
   * own error UX on false (usually "open Settings" deep link).
   */
  public async requestPermissions(): Promise<boolean> {
    const { status } = await Audio.requestPermissionsAsync();
    return status === 'granted';
  }

  /**
   * Begin recording to a temp .m4a file. Throws if permissions are missing
   * or if a recording is already in flight (caller must cancel or finalize
   * the prior recording first).
   *
   * @param onMetering Optional callback invoked every ~100ms with the
   *   current audio level in dB (negative, ~-160 = silence, ~-20 = loud
   *   speech). Used by `VoiceInput` to auto-finalize after a silence
   *   window — we can't rely on `@react-native-voice/voice`'s VAD anymore.
   */
  public async startRecording(
    onMetering?: (meteringDb: number) => void,
  ): Promise<void> {
    if (this.recording) {
      throw new Error(
        'WhisperTranscriptionService.startRecording called while a recording is already active.',
      );
    }

    const { status } = await Audio.getPermissionsAsync();
    if (status !== 'granted') {
      const granted = await this.requestPermissions();
      if (!granted) {
        throw new Error('Microphone permission was not granted.');
      }
    }

    // `allowsRecordingIOS: true` puts the audio session in PlayAndRecord so
    // the TTS that just finished playing has released the mic route. The
    // caller (VoiceFirstInputBar's handleSpeakPress) also stops TTS before
    // dispatch — this is belt-and-suspenders.
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });

    const recording = new Audio.Recording();
    // Enable metering so callers can implement their own silence detection.
    // Base preset is HIGH_QUALITY; we shallow-merge `isMeteringEnabled: true`.
    const options = {
      ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
      isMeteringEnabled: true,
    };
    await recording.prepareToRecordAsync(options);
    // Status updates fire at ~100ms cadence while recording is active; each
    // carries a `metering` field in dB. Forward only the metering number to
    // the caller — everything else (duration, URI, etc.) is owned by us.
    if (onMetering) {
      recording.setOnRecordingStatusUpdate(status => {
        if (status.isRecording && typeof status.metering === 'number') {
          onMetering(status.metering);
        }
      });
      // iOS: poll interval for status updates. Default is ~500ms which is
      // too slow for a responsive 2s silence timer; 100ms gives a snappy
      // finalize without burning CPU.
      recording.setProgressUpdateInterval(100);
    }
    await recording.startAsync();

    this.recording = recording;
    this.recordingStartedAt = Date.now();

    // Runaway-recording guard. If the caller never invokes stop, we flip the
    // recording off after MAX_RECORDING_MS so we don't burn battery. We
    // don't auto-transcribe here — the caller's UI state machine would get
    // out of sync. Instead we stop and let the next stopAndTranscribe()
    // call notice the recording is already stopped and return whatever we
    // captured.
    this.safetyTimer = setTimeout(() => {
      if (this.recording === recording) {
        // Fire-and-forget: the caller's stopAndTranscribe() will observe
        // the stopped state and handle it.
        recording.stopAndUnloadAsync().catch(() => {
          /* ignore — stop errors aren't recoverable here */
        });
      }
    }, MAX_RECORDING_MS);
  }

  /**
   * Stop the active recording, upload it to Whisper, and return the
   * transcript. Returns an empty string if the recording was too short
   * (< MIN_RECORDING_MS) to be meaningful — callers should treat this
   * as "I didn't catch that".
   *
   * Cleans up the temp file after upload regardless of success/failure so
   * we don't leak audio on the device.
   */
  public async stopAndTranscribe(language?: string): Promise<string> {
    const recording = this.recording;
    if (!recording) {
      throw new Error(
        'WhisperTranscriptionService.stopAndTranscribe called with no active recording.',
      );
    }
    this.clearSafetyTimer();
    this.recording = null;

    const durationMs = Date.now() - this.recordingStartedAt;
    let uri: string | null = null;
    try {
      await recording.stopAndUnloadAsync();
      uri = recording.getURI();
    } catch (err) {
      // If the safety timer already stopped the recording, stopAndUnloadAsync
      // throws — but the file still exists and getURI() is valid.
      uri = recording.getURI();
      if (!uri) {
        throw new Error(
          `Failed to finalize recording: ${(err as Error).message}`,
        );
      }
    }

    if (!uri) {
      throw new Error('Recording produced no file URI.');
    }

    // Too-short guard: tap-and-release mis-presses produce ~100ms files
    // that Whisper will either reject or hallucinate against. Skip the
    // round-trip entirely — caller sees empty string → "I didn't catch
    // that, try again" (VoiceFirstInputBar's VOICE_EMPTY path).
    if (durationMs < MIN_RECORDING_MS) {
      await this.deleteFile(uri);
      return '';
    }

    try {
      const audioBase64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const mimeType = Platform.OS === 'ios' ? 'audio/m4a' : 'audio/m4a';
      const transcript = await openaiClient.transcribeAudio(
        audioBase64,
        mimeType,
        language,
      );
      return transcript.trim();
    } finally {
      // Always clean up — even on Whisper errors we don't want to leave
      // recordings on disk.
      await this.deleteFile(uri);
    }
  }

  /**
   * Abort the active recording and discard the audio file without
   * transcribing. Used when the user taps Speak a second time to cancel
   * (TAP_SPEAK from listening → idle in VoiceFirstInputBar's reducer).
   */
  public async cancel(): Promise<void> {
    const recording = this.recording;
    if (!recording) return;
    this.clearSafetyTimer();
    this.recording = null;

    let uri: string | null = null;
    try {
      await recording.stopAndUnloadAsync();
      uri = recording.getURI();
    } catch {
      uri = recording.getURI();
    }
    if (uri) {
      await this.deleteFile(uri);
    }
  }

  /**
   * True iff a recording is currently in flight. Useful for UI guards and
   * tests.
   */
  public isRecording(): boolean {
    return this.recording !== null;
  }

  /**
   * Exposed for tests and for VoiceInput's status copy ("Recording will
   * auto-stop after 60 seconds").
   */
  public getMaxDurationMs(): number {
    return MAX_RECORDING_MS;
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private clearSafetyTimer(): void {
    if (this.safetyTimer) {
      clearTimeout(this.safetyTimer);
      this.safetyTimer = null;
    }
  }

  private async deleteFile(uri: string): Promise<void> {
    try {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch {
      // Non-fatal — temp directory gets swept by the OS eventually.
    }
  }
}

export const whisperTranscriptionService = new WhisperTranscriptionService();
