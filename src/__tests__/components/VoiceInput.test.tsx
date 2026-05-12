/**
 * VoiceInput — US-007 push-to-talk + engine routing.
 *
 * v3 (US-007) replaced the silence-VAD cloud-Whisper pipeline with a
 * dual-engine push-to-talk driver:
 *   - on-device → `audioCaptureService` + `onDeviceTranscriptionService`
 *   - cloud → legacy `whisperTranscriptionService` (kept for 13+ opt-in)
 *
 * The engine is resolved once at start time via
 * `getTranscriptionEngine()` and pinned for the recording's duration.
 *
 * This suite covers:
 *   1. **Imperative `finalize()` handle** (preserved from US-014).
 *      - Calls the pinned engine's stop+transcribe exactly once when
 *        recording is in flight (AC #8).
 *      - No-op when no recording started (AC #5).
 *      - Idempotent across concurrent invocations.
 *   2. **Engine routing on start** — under-13 grade routes to
 *      audioCaptureService; 9-12 + cloud preference routes to
 *      whisperTranscriptionService. The COPPA invariant ("under-13 audio
 *      never reaches whisperTranscriptionService") is asserted directly.
 *   3. **Engine pinning** — the engine resolved at start is the engine
 *      used at stop, even if the parent's `preferences` prop changes
 *      mid-recording.
 *   4. **Component identity** — `displayName === 'VoiceInput'` survives
 *      the memo+forwardRef wrap (legacy AC #6).
 *
 * Why the mocks are local to this file (not inherited from setup.ts):
 *   we need full control of `isRecording()` and `start/stop/cancel` mocks
 *   to drive specific code paths. The global expo-av mock is fine for
 *   the bar test (where VoiceInput is fully stubbed), but here we render
 *   the real component and need its backend services to behave on cue.
 */

import React from 'react';
import { render, act } from '@testing-library/react-native';

// -- Mocks ----------------------------------------------------------------

jest.mock('../../services/audioCaptureService', () => ({
  audioCaptureService: {
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue({
      uri: 'file:///mock/cache/capture.wav',
      durationMs: 1200,
    }),
    cancel: jest.fn().mockResolvedValue(undefined),
    isRecording: jest.fn().mockReturnValue(false),
  },
}));

jest.mock('../../services/onDeviceTranscriptionService', () => ({
  onDeviceTranscriptionService: {
    transcribe: jest.fn().mockResolvedValue({
      text: 'hello from on-device',
      latencyMs: 850,
    }),
  },
  TranscriptionError: class TranscriptionError extends Error {},
}));

jest.mock('../../services/whisperTranscriptionService', () => ({
  whisperTranscriptionService: {
    startRecording: jest.fn().mockResolvedValue(undefined),
    stopAndTranscribe: jest.fn().mockResolvedValue('hello from cloud'),
    cancel: jest.fn().mockResolvedValue(undefined),
    isRecording: jest.fn().mockReturnValue(false),
  },
}));

// AccessibilityInfo.announceForAccessibility is called by autoStart;
// patch onto the (globally-mocked) RN module.
const RN = jest.requireMock('react-native');
if (RN?.AccessibilityInfo) {
  RN.AccessibilityInfo.announceForAccessibility = jest.fn();
}

// -- SUT imports (after mocks) -------------------------------------------

import {
  VoiceInput,
  type VoiceInputHandle,
} from '../../components/common/VoiceInput';
import { audioCaptureService } from '../../services/audioCaptureService';
import { onDeviceTranscriptionService } from '../../services/onDeviceTranscriptionService';
import { whisperTranscriptionService } from '../../services/whisperTranscriptionService';

const mockedAudioCapture = audioCaptureService as jest.Mocked<
  typeof audioCaptureService
>;
const mockedOnDevice = onDeviceTranscriptionService as jest.Mocked<
  typeof onDeviceTranscriptionService
>;
const mockedCloud = whisperTranscriptionService as jest.Mocked<
  typeof whisperTranscriptionService
>;

// Flush queued microtasks so React's useImperativeHandle commit and any
// pending async start/stop chains resolve before the next assertion.
const flushMicrotasks = () =>
  new Promise<void>(resolve => setImmediate(resolve));

// Stateful mock fixtures. The SUT's `startListening` and imperative
// `finalize()` both consult `isRecording()` as a guard, so a plain
// `mockReturnValue(true)` from before render would short-circuit
// `startListening` (it would see "we're already recording" and bail
// before calling `start`). Mirror real service behavior: flip
// isRecording in lockstep with start/stop/cancel.

interface EngineFlag {
  active: boolean;
}
const onDeviceFlag: EngineFlag = { active: false };
const cloudFlag: EngineFlag = { active: false };

beforeEach(() => {
  jest.clearAllMocks();
  onDeviceFlag.active = false;
  cloudFlag.active = false;

  mockedAudioCapture.start.mockImplementation(async () => {
    onDeviceFlag.active = true;
  });
  mockedAudioCapture.stop.mockImplementation(async () => {
    onDeviceFlag.active = false;
    return { uri: 'file:///mock/cache/capture.wav', durationMs: 1200 };
  });
  mockedAudioCapture.cancel.mockImplementation(async () => {
    onDeviceFlag.active = false;
  });
  mockedAudioCapture.isRecording.mockImplementation(() => onDeviceFlag.active);

  mockedOnDevice.transcribe.mockResolvedValue({
    text: 'hello from on-device',
    latencyMs: 850,
  });

  mockedCloud.startRecording.mockImplementation(async () => {
    cloudFlag.active = true;
  });
  mockedCloud.stopAndTranscribe.mockImplementation(async () => {
    cloudFlag.active = false;
    return 'hello from cloud';
  });
  mockedCloud.cancel.mockImplementation(async () => {
    cloudFlag.active = false;
  });
  mockedCloud.isRecording.mockImplementation(() => cloudFlag.active);
});

describe('VoiceInput — imperative finalize() handle (legacy US-014)', () => {
  it('exposes finalize() and routes to the pinned engine when recording', async () => {
    const onSpeechResult = jest.fn();
    const ref = React.createRef<VoiceInputHandle>();

    render(
      <VoiceInput
        ref={ref}
        onSpeechResult={onSpeechResult}
        isEnabled
        autoStart
        gradeLevel="K-2" // under-13 → on-device
      />,
    );

    // Let autoStart complete so the on-device engine is pinned.
    await act(async () => {
      await flushMicrotasks();
    });
    expect(ref.current).not.toBeNull();
    expect(mockedAudioCapture.start).toHaveBeenCalledTimes(1);

    await act(async () => {
      await ref.current!.finalize();
    });

    expect(mockedAudioCapture.stop).toHaveBeenCalledTimes(1);
    expect(mockedOnDevice.transcribe).toHaveBeenCalledWith(
      'file:///mock/cache/capture.wav',
    );
    // Cloud path must NOT have fired for an under-13 user.
    expect(mockedCloud.stopAndTranscribe).not.toHaveBeenCalled();
  });

  it('is a no-op when called before any recording has started', async () => {
    // No recording in flight (default fixture state).
    const ref = React.createRef<VoiceInputHandle>();
    render(
      // No autoStart → no recording is ever initiated.
      <VoiceInput ref={ref} onSpeechResult={jest.fn()} isEnabled />,
    );

    await act(async () => {
      await flushMicrotasks();
    });
    expect(ref.current).not.toBeNull();

    await act(async () => {
      await expect(ref.current!.finalize()).resolves.toBeUndefined();
    });

    expect(mockedAudioCapture.stop).not.toHaveBeenCalled();
    expect(mockedCloud.stopAndTranscribe).not.toHaveBeenCalled();
  });

  it('absorbs concurrent finalize() invocations (idempotency latch)', async () => {
    const ref = React.createRef<VoiceInputHandle>();
    render(
      <VoiceInput
        ref={ref}
        onSpeechResult={jest.fn()}
        isEnabled
        autoStart
        gradeLevel="K-2"
      />,
    );

    await act(async () => {
      await flushMicrotasks();
    });

    await act(async () => {
      await Promise.all([
        ref.current!.finalize(),
        ref.current!.finalize(),
        ref.current!.finalize(),
      ]);
    });

    expect(mockedAudioCapture.stop).toHaveBeenCalledTimes(1);
    expect(mockedOnDevice.transcribe).toHaveBeenCalledTimes(1);
  });

  it("preserves component.displayName === 'VoiceInput' through memo+forwardRef", () => {
    expect((VoiceInput as { displayName?: string }).displayName).toBe(
      'VoiceInput',
    );
  });
});

describe('VoiceInput — engine routing (US-007)', () => {
  // Engine selection happens once at start time via the policy helper:
  //   K-2 / 3-5 / 6-8 / undefined → on-device (FR-2 COPPA gate)
  //   9-12 + preference='cloud' → cloud
  //   9-12 + preference='on-device'|undefined → on-device

  it('routes under-13 (K-2) to audioCaptureService on autoStart', async () => {
    render(
      <VoiceInput
        onSpeechResult={jest.fn()}
        isEnabled
        autoStart
        gradeLevel="K-2"
      />,
    );
    await act(async () => {
      await flushMicrotasks();
    });

    expect(mockedAudioCapture.start).toHaveBeenCalledTimes(1);
    expect(mockedCloud.startRecording).not.toHaveBeenCalled();
  });

  it('routes 6-8 to audioCaptureService even if preference says cloud (FR-2 fail-safe)', async () => {
    // This is the load-bearing COPPA assertion: a stale 'cloud' preference
    // on an under-13 user's profile MUST NOT leak audio to OpenAI.
    render(
      <VoiceInput
        onSpeechResult={jest.fn()}
        isEnabled
        autoStart
        gradeLevel="6-8"
        preferences={{ transcriptionEngine: 'cloud' }}
      />,
    );
    await act(async () => {
      await flushMicrotasks();
    });

    expect(mockedAudioCapture.start).toHaveBeenCalledTimes(1);
    expect(mockedCloud.startRecording).not.toHaveBeenCalled();
  });

  it('routes 9-12 with preference=cloud to whisperTranscriptionService', async () => {
    render(
      <VoiceInput
        onSpeechResult={jest.fn()}
        isEnabled
        autoStart
        gradeLevel="9-12"
        preferences={{ transcriptionEngine: 'cloud' }}
      />,
    );
    await act(async () => {
      await flushMicrotasks();
    });

    expect(mockedCloud.startRecording).toHaveBeenCalledTimes(1);
    expect(mockedAudioCapture.start).not.toHaveBeenCalled();
  });

  it('routes 9-12 with preference=on-device to audioCaptureService', async () => {
    render(
      <VoiceInput
        onSpeechResult={jest.fn()}
        isEnabled
        autoStart
        gradeLevel="9-12"
        preferences={{ transcriptionEngine: 'on-device' }}
      />,
    );
    await act(async () => {
      await flushMicrotasks();
    });

    expect(mockedAudioCapture.start).toHaveBeenCalledTimes(1);
    expect(mockedCloud.startRecording).not.toHaveBeenCalled();
  });

  it('routes undefined grade to audioCaptureService (fail-safe default)', async () => {
    render(<VoiceInput onSpeechResult={jest.fn()} isEnabled autoStart />);
    await act(async () => {
      await flushMicrotasks();
    });

    expect(mockedAudioCapture.start).toHaveBeenCalledTimes(1);
    expect(mockedCloud.startRecording).not.toHaveBeenCalled();
  });
});

describe('VoiceInput — engine pinning (US-007)', () => {
  it('uses the engine resolved at start, even if preferences change before stop', async () => {
    // 9-12 user starts with cloud preference → cloud engine pinned.
    const ref = React.createRef<VoiceInputHandle>();
    const { rerender } = render(
      <VoiceInput
        ref={ref}
        onSpeechResult={jest.fn()}
        isEnabled
        autoStart
        gradeLevel="9-12"
        preferences={{ transcriptionEngine: 'cloud' }}
      />,
    );

    await act(async () => {
      await flushMicrotasks();
    });
    expect(mockedCloud.startRecording).toHaveBeenCalledTimes(1);

    // Parent toggles preference to on-device mid-recording. The pinned
    // engine should stay 'cloud' — the audio was captured for the cloud
    // pipeline (44.1 kHz AAC) and must be stopped/transcribed by cloud.
    rerender(
      <VoiceInput
        ref={ref}
        onSpeechResult={jest.fn()}
        isEnabled
        autoStart
        gradeLevel="9-12"
        preferences={{ transcriptionEngine: 'on-device' }}
      />,
    );

    await act(async () => {
      await ref.current!.finalize();
    });

    expect(mockedCloud.stopAndTranscribe).toHaveBeenCalledTimes(1);
    expect(mockedOnDevice.transcribe).not.toHaveBeenCalled();
    expect(mockedAudioCapture.stop).not.toHaveBeenCalled();
  });
});

describe('VoiceInput — onHasSpokenChange semantics (US-007 shift)', () => {
  it('fires false on start then true after a successful start (push-to-talk equivalent)', async () => {
    const onHasSpokenChange = jest.fn();

    render(
      <VoiceInput
        onSpeechResult={jest.fn()}
        isEnabled
        autoStart
        gradeLevel="K-2"
        onHasSpokenChange={onHasSpokenChange}
      />,
    );

    await act(async () => {
      await flushMicrotasks();
    });

    // v3 semantics: false on the reset, then true after start() resolves.
    expect(onHasSpokenChange).toHaveBeenCalledWith(false);
    expect(onHasSpokenChange).toHaveBeenCalledWith(true);
    // Ordering: false must precede true.
    const calls = onHasSpokenChange.mock.calls.map(c => c[0]);
    expect(calls.indexOf(false)).toBeLessThan(calls.indexOf(true));
  });

  it('does NOT fire true if start() rejects', async () => {
    mockedAudioCapture.start.mockRejectedValueOnce(
      new Error('mic in use by another app'),
    );
    const onHasSpokenChange = jest.fn();

    render(
      <VoiceInput
        onSpeechResult={jest.fn()}
        isEnabled
        autoStart
        gradeLevel="K-2"
        onHasSpokenChange={onHasSpokenChange}
        onError={jest.fn()}
      />,
    );

    await act(async () => {
      await flushMicrotasks();
    });

    // Should have fired the false (reset), but NOT the true (start failed).
    expect(onHasSpokenChange).toHaveBeenCalledWith(false);
    expect(onHasSpokenChange).not.toHaveBeenCalledWith(true);
  });
});

describe('VoiceInput — happy path end-to-end (on-device)', () => {
  it('start → finalize → onSpeechResult fires with on-device transcript', async () => {
    mockedOnDevice.transcribe.mockResolvedValueOnce({
      text: 'the quick brown fox',
      latencyMs: 920,
    });

    const onSpeechResult = jest.fn();
    const onProcessingStateChange = jest.fn();
    const ref = React.createRef<VoiceInputHandle>();

    render(
      <VoiceInput
        ref={ref}
        onSpeechResult={onSpeechResult}
        onProcessingStateChange={onProcessingStateChange}
        isEnabled
        autoStart
        gradeLevel="K-2"
      />,
    );

    await act(async () => {
      await flushMicrotasks();
    });

    await act(async () => {
      await ref.current!.finalize();
    });

    expect(onSpeechResult).toHaveBeenCalledWith('the quick brown fox');
    // processing state transitions: true at finalize start, false on success
    const processingCalls = onProcessingStateChange.mock.calls.map(c => c[0]);
    expect(processingCalls).toContain(true);
    expect(processingCalls[processingCalls.length - 1]).toBe(false);
  });
});
