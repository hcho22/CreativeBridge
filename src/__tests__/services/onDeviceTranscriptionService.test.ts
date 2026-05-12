// US-005 validation: OnDeviceTranscriptionService wraps whisper.rn,
// returns { text, latencyMs }, surfaces typed errors for the two
// distinct failure modes (model load vs audio decode), and emits
// telemetry that contains *no transcript content, no audio URI, and no
// user identifier* — that last property is the value-flow half of the
// H01 COPPA invariant (US-013) and is asserted explicitly below.
//
// The PRD's pass condition includes a manual real-device QA step ("a
// 30-second K-2 voice sample is captured in full with no truncation").
// That cannot run in Jest because it needs the native whisper.cpp
// binary; it is a manual gate listed in the PRD.

// We mock the whole whisperModelService module (instead of
// `requireActual`-ing it) because the real file pulls in `expo-asset`
// at import time, which has no native module under Jest. The stub
// `WhisperModelLoadError` defined inside the factory below is the
// canonical reference for both production code and this test — they
// share the same module identity once jest.mock is applied.
jest.mock('../../services/whisperModelService', () => {
  class WhisperModelLoadError extends Error {
    public readonly cause?: unknown;
    constructor(message: string, cause?: unknown) {
      super(message);
      this.name = 'WhisperModelLoadError';
      this.cause = cause;
    }
  }
  return {
    WhisperModelLoadError,
    whisperModelService: {
      getContext: jest.fn(),
      getActiveModelName: jest.fn(),
      getLoadLatencyMs: jest.fn().mockReturnValue(null),
      isLoaded: jest.fn().mockReturnValue(false),
      release: jest.fn().mockResolvedValue(undefined),
    },
  };
});

jest.mock('../../services/analyticsService', () => ({
  analyticsService: {
    trackPerformance: jest.fn().mockResolvedValue(undefined),
  },
}));

import { analyticsService } from '../../services/analyticsService';
import {
  whisperModelService,
  WhisperModelLoadError,
} from '../../services/whisperModelService';
import {
  OnDeviceTranscriptionService,
  TranscriptionError,
} from '../../services/onDeviceTranscriptionService';

const getContextMock = whisperModelService.getContext as jest.Mock;
const getActiveModelNameMock =
  whisperModelService.getActiveModelName as jest.Mock;
const trackPerformanceMock = analyticsService.trackPerformance as jest.Mock;

const FIXTURE_AUDIO_URI = 'file:///tmp/cb-capture/recording-12345.wav';

const makeContextWithResult = (
  overrides: {
    result?: string;
    isAborted?: boolean;
    rejectsWith?: unknown;
  } = {},
) => {
  const transcribe = jest.fn().mockReturnValue({
    stop: jest.fn(),
    promise: overrides.rejectsWith
      ? Promise.reject(overrides.rejectsWith)
      : Promise.resolve({
          result: overrides.result ?? '',
          segments: [],
          isAborted: overrides.isAborted ?? false,
        }),
  });
  return {
    id: 99,
    transcribe,
    release: jest.fn().mockResolvedValue(undefined),
  };
};

describe('OnDeviceTranscriptionService — US-005', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getActiveModelNameMock.mockReturnValue('tiny');
  });

  describe('happy path', () => {
    it('returns the trimmed whisper.rn result and a non-negative latencyMs', async () => {
      const ctx = makeContextWithResult({ result: '  hello world  ' });
      getContextMock.mockResolvedValue(ctx);

      const service = new OnDeviceTranscriptionService();
      const { text, latencyMs } = await service.transcribe(FIXTURE_AUDIO_URI);

      expect(text).toBe('hello world');
      expect(typeof latencyMs).toBe('number');
      expect(latencyMs).toBeGreaterThanOrEqual(0);
      expect(ctx.transcribe).toHaveBeenCalledWith(FIXTURE_AUDIO_URI);
    });

    it('handles an empty result without throwing (silent audio is a valid outcome)', async () => {
      const ctx = makeContextWithResult({ result: '' });
      getContextMock.mockResolvedValue(ctx);

      const service = new OnDeviceTranscriptionService();
      const { text } = await service.transcribe(FIXTURE_AUDIO_URI);

      expect(text).toBe('');
    });

    it('coerces a missing result string to ""', async () => {
      const ctx = {
        id: 5,
        transcribe: jest.fn().mockReturnValue({
          stop: jest.fn(),
          promise: Promise.resolve({ segments: [], isAborted: false }),
        }),
        release: jest.fn().mockResolvedValue(undefined),
      };
      getContextMock.mockResolvedValue(ctx);

      const service = new OnDeviceTranscriptionService();
      const { text } = await service.transcribe(FIXTURE_AUDIO_URI);

      expect(text).toBe('');
    });
  });

  describe('model selection (US-005 AC: prefer base when available)', () => {
    it('records the active model name (tiny) in telemetry', async () => {
      getActiveModelNameMock.mockReturnValue('tiny');
      getContextMock.mockResolvedValue(makeContextWithResult({ result: 'ok' }));

      const service = new OnDeviceTranscriptionService();
      await service.transcribe(FIXTURE_AUDIO_URI);

      expect(trackPerformanceMock).toHaveBeenCalledWith(
        'on_device_transcription',
        expect.any(Number),
        true,
        expect.objectContaining({ engine: 'on-device', model: 'tiny' }),
      );
    });

    it('records the active model name (base) in telemetry when base is loaded', async () => {
      getActiveModelNameMock.mockReturnValue('base');
      getContextMock.mockResolvedValue(makeContextWithResult({ result: 'ok' }));

      const service = new OnDeviceTranscriptionService();
      await service.transcribe(FIXTURE_AUDIO_URI);

      expect(trackPerformanceMock).toHaveBeenCalledWith(
        'on_device_transcription',
        expect.any(Number),
        true,
        expect.objectContaining({ engine: 'on-device', model: 'base' }),
      );
    });

    it('falls back to "unknown" model label when getActiveModelName() returns null', async () => {
      getActiveModelNameMock.mockReturnValue(null);
      getContextMock.mockResolvedValue(makeContextWithResult({ result: 'ok' }));

      const service = new OnDeviceTranscriptionService();
      await service.transcribe(FIXTURE_AUDIO_URI);

      expect(trackPerformanceMock).toHaveBeenCalledWith(
        'on_device_transcription',
        expect.any(Number),
        true,
        expect.objectContaining({ model: 'unknown' }),
      );
    });
  });

  describe('error handling', () => {
    it('throws TranscriptionError when the model fails to load', async () => {
      const loadErr = new WhisperModelLoadError('init failed');
      getContextMock.mockRejectedValue(loadErr);

      const service = new OnDeviceTranscriptionService();
      const rejection = service.transcribe(FIXTURE_AUDIO_URI);

      await expect(rejection).rejects.toBeInstanceOf(TranscriptionError);
      await rejection.catch((err: TranscriptionError) => {
        expect(err.cause).toBe(loadErr);
      });
    });

    it('logs failure telemetry with model=unknown when the model fails to load', async () => {
      getContextMock.mockRejectedValue(new WhisperModelLoadError('boom'));

      const service = new OnDeviceTranscriptionService();
      await expect(service.transcribe(FIXTURE_AUDIO_URI)).rejects.toThrow();

      expect(trackPerformanceMock).toHaveBeenCalledWith(
        'on_device_transcription',
        expect.any(Number),
        false,
        expect.objectContaining({
          engine: 'on-device',
          model: 'unknown',
          failureReason: 'model_load',
        }),
      );
    });

    it('throws TranscriptionError when whisper.rn transcribe() rejects', async () => {
      const decodeErr = new Error('Invalid WAV header');
      getContextMock.mockResolvedValue(
        makeContextWithResult({ rejectsWith: decodeErr }),
      );

      const service = new OnDeviceTranscriptionService();
      const rejection = service.transcribe(FIXTURE_AUDIO_URI);

      await expect(rejection).rejects.toBeInstanceOf(TranscriptionError);
      await rejection.catch((err: TranscriptionError) => {
        expect(err.cause).toBe(decodeErr);
      });
      expect(trackPerformanceMock).toHaveBeenCalledWith(
        'on_device_transcription',
        expect.any(Number),
        false,
        expect.objectContaining({ failureReason: 'audio_decode' }),
      );
    });

    it('throws TranscriptionError when whisper.rn returns isAborted=true', async () => {
      getContextMock.mockResolvedValue(
        makeContextWithResult({ result: 'partial...', isAborted: true }),
      );

      const service = new OnDeviceTranscriptionService();

      await expect(
        service.transcribe(FIXTURE_AUDIO_URI),
      ).rejects.toBeInstanceOf(TranscriptionError);
      expect(trackPerformanceMock).toHaveBeenCalledWith(
        'on_device_transcription',
        expect.any(Number),
        false,
        expect.objectContaining({ failureReason: 'aborted' }),
      );
    });
  });

  describe('telemetry contains no PII (H01 COPPA invariant)', () => {
    // Even on the on-device path, we must never let transcript content,
    // audio paths, or user identifiers cross into analytics. The H01
    // tripwire (US-013) catches the cloud path by import-graph; this
    // suite is the value-flow guard for the on-device path.

    it('does not include the transcript text in telemetry metadata', async () => {
      const sensitiveTranscript = 'my name is Hyung and I live at 123 Main St';
      getContextMock.mockResolvedValue(
        makeContextWithResult({ result: sensitiveTranscript }),
      );

      const service = new OnDeviceTranscriptionService();
      await service.transcribe(FIXTURE_AUDIO_URI);

      const [, , , metadata] = trackPerformanceMock.mock.calls[0];
      const serialized = JSON.stringify(metadata);
      expect(serialized).not.toContain('Hyung');
      expect(serialized).not.toContain('123 Main St');
      expect(serialized).not.toContain(sensitiveTranscript);
    });

    it('does not include the audio file URI in telemetry metadata', async () => {
      getContextMock.mockResolvedValue(makeContextWithResult({ result: 'ok' }));

      const service = new OnDeviceTranscriptionService();
      await service.transcribe(FIXTURE_AUDIO_URI);

      const [, , , metadata] = trackPerformanceMock.mock.calls[0];
      const serialized = JSON.stringify(metadata);
      expect(serialized).not.toContain(FIXTURE_AUDIO_URI);
      expect(serialized).not.toContain('recording-12345');
    });

    it('records exactly the expected metadata keys on success', async () => {
      getContextMock.mockResolvedValue(makeContextWithResult({ result: 'ok' }));

      const service = new OnDeviceTranscriptionService();
      await service.transcribe(FIXTURE_AUDIO_URI);

      const [, , , metadata] = trackPerformanceMock.mock.calls[0];
      expect(Object.keys(metadata).sort()).toEqual(['engine', 'model']);
    });

    it('records exactly engine + model + failureReason on a failure', async () => {
      getContextMock.mockResolvedValue(
        makeContextWithResult({ rejectsWith: new Error('decode failed') }),
      );

      const service = new OnDeviceTranscriptionService();
      await expect(service.transcribe(FIXTURE_AUDIO_URI)).rejects.toThrow();

      const [, , , metadata] = trackPerformanceMock.mock.calls[0];
      expect(Object.keys(metadata).sort()).toEqual([
        'engine',
        'failureReason',
        'model',
      ]);
    });
  });

  describe('telemetry resilience', () => {
    it('does not surface analytics failures back to the caller', async () => {
      trackPerformanceMock.mockRejectedValueOnce(new Error('analytics down'));
      getContextMock.mockResolvedValue(makeContextWithResult({ result: 'ok' }));

      const service = new OnDeviceTranscriptionService();
      await expect(
        service.transcribe(FIXTURE_AUDIO_URI),
      ).resolves.toMatchObject({
        text: 'ok',
      });
    });
  });
});
