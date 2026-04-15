/**
 * US-014: Unit tests for the imperative `finalize()` handle on `VoiceInput`.
 *
 * Scope: verify the `ref.current.finalize()` surface only. Silence detection
 * and the Whisper round-trip itself are covered elsewhere (functional /
 * integration suites) — here we just prove:
 *
 *   1. When the service is actively recording, calling `finalize()` through
 *      the ref invokes `whisperTranscriptionService.stopAndTranscribe`
 *      exactly once (AC #8).
 *   2. When the service is NOT recording (i.e. before any session started),
 *      calling `finalize()` is a no-op — the handle must not throw and must
 *      not invoke `stopAndTranscribe` (AC #5).
 *   3. The component still identifies itself as `'VoiceInput'` even though
 *      it is now wrapped in `React.memo(React.forwardRef(...))` (AC #6).
 *
 * The `whisperTranscriptionService` is mocked at the module boundary so no
 * real microphone / Convex call is made from Jest.
 */

import React from 'react';
import { render } from '@testing-library/react-native';

// -- Mocks -----------------------------------------------------------------

// Minimal mock surface: only the methods `VoiceInput` calls during the
// code paths exercised here (start, stop, isRecording, cancel).
jest.mock('../../services/whisperTranscriptionService', () => ({
  whisperTranscriptionService: {
    startRecording: jest.fn().mockResolvedValue(undefined),
    stopAndTranscribe: jest.fn().mockResolvedValue('hello world'),
    cancel: jest.fn().mockResolvedValue(undefined),
    isRecording: jest.fn().mockReturnValue(false),
  },
}));

// `AccessibilityInfo.announceForAccessibility` is called on autoStart; the
// global RN mock doesn't include it, so patch it in place.
const RN = jest.requireMock('react-native');
if (RN?.AccessibilityInfo) {
  RN.AccessibilityInfo.announceForAccessibility = jest.fn();
}

// -- SUT imports (after mocks) --------------------------------------------

import {
  VoiceInput,
  type VoiceInputHandle,
} from '../../components/common/VoiceInput';
import { whisperTranscriptionService } from '../../services/whisperTranscriptionService';

const mockedService = whisperTranscriptionService as jest.Mocked<
  typeof whisperTranscriptionService
>;

// Helper to pump microtasks between an awaited promise and the next
// assertion — React's internal scheduler queues the imperative-handle
// update on commit, so we need one flush before reading `ref.current`.
const flushMicrotasks = () =>
  new Promise<void>(resolve => setImmediate(resolve));

describe('VoiceInput — imperative finalize() handle (US-014)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exposes finalize() via ref and calls stopAndTranscribe exactly once when recording', async () => {
    // Simulate an in-flight recording so the guard in the handle passes.
    mockedService.isRecording.mockReturnValue(true);

    const ref = React.createRef<VoiceInputHandle>();
    render(
      <VoiceInput
        ref={ref}
        onSpeechResult={jest.fn()}
        isEnabled={true}
        // autoStart omitted — we don't want the component trying to
        // kick off a real recording from inside the test.
      />,
    );

    // The handle should be installed on commit.
    await flushMicrotasks();
    expect(ref.current).not.toBeNull();
    expect(typeof ref.current?.finalize).toBe('function');

    await ref.current!.finalize();

    expect(mockedService.stopAndTranscribe).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when called before any recording has started (AC #5)', async () => {
    // Service reports no active recording — the handle's guard should
    // short-circuit the call.
    mockedService.isRecording.mockReturnValue(false);

    const ref = React.createRef<VoiceInputHandle>();
    render(
      <VoiceInput ref={ref} onSpeechResult={jest.fn()} isEnabled={true} />,
    );

    await flushMicrotasks();
    expect(ref.current).not.toBeNull();

    // Should NOT throw and should NOT invoke the service.
    await expect(ref.current!.finalize()).resolves.toBeUndefined();
    expect(mockedService.stopAndTranscribe).not.toHaveBeenCalled();
  });

  it("preserves component.displayName === 'VoiceInput' through memo+forwardRef (AC #6)", () => {
    // Guards against devtools / consumer code that looks up the name on
    // the outer wrapper. React resolves displayName by walking through
    // memo/forwardRef; we only need the outer assignment to be right.
    expect((VoiceInput as { displayName?: string }).displayName).toBe(
      'VoiceInput',
    );
  });
});
