/**
 * On-Device Transcription Service (US-005)
 *
 * Thin wrapper over `whisper.rn` that takes a 16kHz mono 16-bit WAV (per
 * the format contract spelled out in US-004 / `audioCaptureService`) and
 * returns the transcribed text plus an end-to-end latency measurement.
 * The whisper context itself is owned by `whisperModelService`, which
 * lazy-loads the best available model (tiny if it's the only thing
 * bundled, base once US-003's lazy download has landed); this service is
 * only responsible for driving a single transcribe call and producing
 * telemetry around it.
 *
 * Architectural notes:
 *   - **No PII in telemetry.** The analytics call records *only* the
 *     engine name, model name, latency, and success boolean. It must
 *     never include the transcript text, the audio file URI, or any
 *     user identifier. This is the value-flow half of the H01 COPPA
 *     invariant (US-013): the import-graph half ensures the cloud
 *     `transcribeAudio` action is never called for under-13 users; this
 *     file ensures that even on the on-device path, we don't leak
 *     transcript content into our own observability pipeline.
 *   - **Typed failure modes.** Model-load failures and transcription
 *     failures both surface as `TranscriptionError` but with different
 *     `cause` shapes (a `WhisperModelLoadError` vs. the underlying
 *     whisper.rn error), so callers can branch on the cause if they
 *     want to differentiate "load the model" vs. "process the audio".
 *   - **Aborted runs.** `whisper.rn` exposes an `isAborted` flag on the
 *     result. The current service does not expose a cancel API (push-
 *     to-talk in US-007 only cancels at the audio-capture layer), but
 *     if an aborted result ever does surface, we treat it as a failed
 *     transcription rather than silently returning partial text.
 *   - **Latency wall-clock includes model load.** When the model has
 *     not yet been initialized, `getContext()` does the lazy load on
 *     this call's path, which can add hundreds of ms on iPhone 12+.
 *     The returned `latencyMs` reflects that real user-perceived wait;
 *     `whisperModelService.getLoadLatencyMs()` is available separately
 *     for attributing the load portion when needed.
 */

import { analyticsService } from './analyticsService';
import {
  whisperModelService,
  WhisperModelLoadError,
  type WhisperModelName,
} from './whisperModelService';

export class TranscriptionError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'TranscriptionError';
  }
}

export interface TranscriptionResult {
  text: string;
  latencyMs: number;
}

export class OnDeviceTranscriptionService {
  public async transcribe(audioUri: string): Promise<TranscriptionResult> {
    const startedAt = Date.now();

    let context;
    try {
      context = await whisperModelService.getContext();
    } catch (err) {
      const latencyMs = Date.now() - startedAt;
      const reason =
        err instanceof WhisperModelLoadError
          ? 'model_load'
          : 'model_load_unknown';
      this.recordTelemetry(latencyMs, null, false, reason);
      throw new TranscriptionError(
        'On-device transcription failed: Whisper model could not be loaded',
        err,
      );
    }

    const modelName = whisperModelService.getActiveModelName();

    let result;
    try {
      const handle = context.transcribe(audioUri);
      result = await handle.promise;
    } catch (err) {
      const latencyMs = Date.now() - startedAt;
      this.recordTelemetry(latencyMs, modelName, false, 'audio_decode');
      throw new TranscriptionError(
        'On-device transcription failed during whisper.rn transcribe()',
        err,
      );
    }

    const latencyMs = Date.now() - startedAt;

    if (result.isAborted) {
      this.recordTelemetry(latencyMs, modelName, false, 'aborted');
      throw new TranscriptionError(
        'On-device transcription was aborted before completion',
      );
    }

    this.recordTelemetry(latencyMs, modelName, true);

    return {
      text: (result.result ?? '').trim(),
      latencyMs,
    };
  }

  private recordTelemetry(
    latencyMs: number,
    model: WhisperModelName | null,
    success: boolean,
    failureReason?: string,
  ): void {
    const metadata: Record<string, unknown> = {
      engine: 'on-device',
      model: model ?? 'unknown',
    };
    if (failureReason) {
      metadata.failureReason = failureReason;
    }

    // Fire-and-forget. Analytics failures must never block transcription.
    analyticsService
      .trackPerformance('on_device_transcription', latencyMs, success, metadata)
      .catch(() => {
        // intentionally swallowed — telemetry is best-effort
      });
  }
}

export const onDeviceTranscriptionService = new OnDeviceTranscriptionService();
