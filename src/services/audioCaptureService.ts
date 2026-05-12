/**
 * Audio Capture Service (US-004)
 *
 * Push-to-talk audio capture for the on-device Whisper pipeline. Replaces
 * the continuous-listening + VAD model used by the legacy
 * `whisperTranscriptionService`; the caller (US-007's rewritten
 * `VoiceInput.tsx`) drives explicit `start()` / `stop()` calls bound to
 * tap-to-start, tap-to-stop UI affordances.
 *
 * Why this service exists separately from `whisperTranscriptionService`:
 *   - The legacy service uses `RecordingOptionsPresets.HIGH_QUALITY`,
 *     which produces a 44.1 kHz stereo AAC `.m4a`. whisper.rn reads only
 *     16 kHz mono 16-bit PCM WAV; feeding it 44.1 kHz stereo AAC causes
 *     it to silently truncate transcription to ~1 second (whisper.rn
 *     issue #299). Producing the wrong format is the failure mode the
 *     entire on-device PRD is trying to escape, so the recording config
 *     is load-bearing.
 *   - The legacy service is bound to the cloud OpenAI Whisper path
 *     (which happily accepts AAC). Mutating it to also produce PCM WAV
 *     would create two callers with diverging format needs on one code
 *     path. A fresh, narrow service is cheaper to reason about.
 *
 * Format contract (locked by `RECORDING_OPTIONS` below, and asserted in
 * `audioCaptureService.test.ts`):
 *   - 16 000 Hz sample rate
 *   - 1 channel (mono)
 *   - 16-bit signed PCM
 *   - WAV container
 *
 * Lifecycle invariants:
 *   - At most one recording is active at any time. A second `start()`
 *     while a capture is in progress throws `AudioCaptureError`
 *     (`already_recording`) — there is no implicit cancel-and-restart.
 *   - `stop()` returns the URI of the captured file *and the wall-clock
 *     duration*. The file remains on disk until the *next* `start()`
 *     clears it (or the OS evicts the cache directory), so the caller
 *     can pass the URI straight into `onDeviceTranscriptionService`.
 *   - `cancel()` is idempotent. If called with no active recording it
 *     resolves silently. If called mid-capture it unloads the native
 *     recorder and deletes any partial file.
 *   - iOS background guard: while a recording is active, an
 *     `AppState` listener watches for `'background'` transitions. The
 *     guard fires `cancel()`, which releases the AVAudioSession so the
 *     mic doesn't stay locked. Only `'background'` is reacted to —
 *     `'inactive'` is transient (notification center, incoming-call
 *     alert) and would falsely cancel during normal use.
 *
 * Permissions: `Audio.requestPermissionsAsync()` is called on every
 * `start()`. Expo treats it as idempotent once granted, so callers do
 * not need to gate on a pre-flight check. Permission denial surfaces as
 * `AudioCaptureError('permission_denied')` — typed so the UI layer can
 * distinguish "user said no" from a generic recorder failure.
 */

import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import {
  AppState,
  type AppStateStatus,
  type NativeEventSubscription,
} from 'react-native';

// `expo-av` enum members are exported from
// `expo-av/build/Audio/RecordingConstants`. The deep path is fragile
// across minor versions, so we inline the values with explanatory
// comments. The regression test alongside this file pins the iOS
// quartet (sampleRate / numberOfChannels / linearPCMBitDepth /
// outputFormat) so accidental drift fails loudly.
//
//   IOSOutputFormat.LINEARPCM  → 'lpcm'
//   IOSAudioQuality.HIGH       → 96
//   AndroidOutputFormat.DEFAULT → 0
//   AndroidAudioEncoder.DEFAULT → 0

const SAMPLE_RATE_HZ = 16000;
const CHANNELS = 1;
const BIT_DEPTH = 16;
// sampleRate * channels * bitDepth = 16000 * 1 * 16 = 256000 bits/sec.
// Required by expo-av RecordingOptions even though for LPCM it's not
// strictly used by the encoder; the iOS recorder still wants the field.
const BIT_RATE = SAMPLE_RATE_HZ * CHANNELS * BIT_DEPTH;

export const RECORDING_OPTIONS: Audio.RecordingOptions = Object.freeze({
  isMeteringEnabled: false,
  android: {
    extension: '.wav',
    outputFormat: 0, // AndroidOutputFormat.DEFAULT
    audioEncoder: 0, // AndroidAudioEncoder.DEFAULT
    sampleRate: SAMPLE_RATE_HZ,
    numberOfChannels: CHANNELS,
    bitRate: BIT_RATE,
  },
  ios: {
    extension: '.wav',
    outputFormat: 'lpcm', // IOSOutputFormat.LINEARPCM
    audioQuality: 96, // IOSAudioQuality.HIGH
    sampleRate: SAMPLE_RATE_HZ,
    numberOfChannels: CHANNELS,
    bitRate: BIT_RATE,
    linearPCMBitDepth: BIT_DEPTH,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/wav',
    bitsPerSecond: BIT_RATE,
  },
}) as Audio.RecordingOptions;

export type AudioCaptureErrorCode =
  | 'permission_denied'
  | 'already_recording'
  | 'no_active_recording'
  | 'recording_failed'
  | 'backgrounded';

export class AudioCaptureError extends Error {
  constructor(
    message: string,
    public readonly code: AudioCaptureErrorCode,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AudioCaptureError';
  }
}

export interface AudioCaptureResult {
  uri: string;
  durationMs: number;
}

export class AudioCaptureService {
  private recording: Audio.Recording | null = null;
  private recordingStartedAt: number | null = null;
  private appStateSubscription: NativeEventSubscription | null = null;
  private lastCapturedUri: string | null = null;

  public async start(): Promise<void> {
    if (this.recording) {
      throw new AudioCaptureError(
        'AudioCaptureService.start() called while a recording is already in progress',
        'already_recording',
      );
    }

    await this.cleanupLastCapture();

    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      throw new AudioCaptureError(
        'Microphone permission was not granted',
        'permission_denied',
      );
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });

    const recording = new Audio.Recording();
    try {
      await recording.prepareToRecordAsync(RECORDING_OPTIONS);
      await recording.startAsync();
    } catch (err) {
      try {
        await recording.stopAndUnloadAsync();
      } catch {
        // Best-effort cleanup — prepareToRecordAsync may have left the
        // native recorder in an undefined state; nothing more we can do.
      }
      throw new AudioCaptureError(
        'Failed to start audio recording',
        'recording_failed',
        err,
      );
    }

    this.recording = recording;
    this.recordingStartedAt = Date.now();
    this.installBackgroundGuard();
  }

  public async stop(): Promise<AudioCaptureResult> {
    if (!this.recording || this.recordingStartedAt === null) {
      throw new AudioCaptureError(
        'AudioCaptureService.stop() called with no active recording',
        'no_active_recording',
      );
    }

    const recording = this.recording;
    const startedAt = this.recordingStartedAt;
    this.recording = null;
    this.recordingStartedAt = null;
    this.removeBackgroundGuard();

    try {
      await recording.stopAndUnloadAsync();
    } catch (err) {
      throw new AudioCaptureError(
        'Failed to stop audio recording cleanly',
        'recording_failed',
        err,
      );
    }

    const uri = recording.getURI();
    if (!uri) {
      throw new AudioCaptureError(
        'Recording stopped but produced no file URI',
        'recording_failed',
      );
    }

    this.lastCapturedUri = uri;
    return { uri, durationMs: Date.now() - startedAt };
  }

  public async cancel(): Promise<void> {
    if (!this.recording) {
      return;
    }

    const recording = this.recording;
    this.recording = null;
    this.recordingStartedAt = null;
    this.removeBackgroundGuard();

    try {
      await recording.stopAndUnloadAsync();
    } catch {
      // Cancellation: a half-prepared recorder may throw on unload;
      // we've already detached our reference so this is non-fatal.
    }

    const uri = recording.getURI();
    if (uri) {
      try {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      } catch {
        // Non-fatal — the OS may evict the cache file before next launch.
      }
    }
    this.lastCapturedUri = null;
  }

  public isRecording(): boolean {
    return this.recording !== null;
  }

  private installBackgroundGuard(): void {
    this.appStateSubscription = AppState.addEventListener(
      'change',
      (next: AppStateStatus) => {
        if (next === 'background') {
          this.cancel().catch(() => {
            // Cancel itself swallows its sub-errors; this outer catch is
            // belt-and-suspenders against a future refactor that lets
            // an error escape and would otherwise be an unhandled
            // promise rejection inside an event listener.
          });
        }
      },
    );
  }

  private removeBackgroundGuard(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }

  private async cleanupLastCapture(): Promise<void> {
    if (!this.lastCapturedUri) {
      return;
    }
    const uri = this.lastCapturedUri;
    this.lastCapturedUri = null;
    try {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch {
      // Non-fatal — see deleteAsync rationale in cancel().
    }
  }
}

export const audioCaptureService = new AudioCaptureService();
