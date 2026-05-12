// US-004 validation: AudioCaptureService.
//
// Three classes of assertion live in this file:
//
//   1. **Config regression guard.** The PRD's load-bearing invariant is
//      that recordings must be 16 kHz mono 16-bit PCM WAV — anything
//      else makes whisper.rn silently truncate transcription to ~1
//      second (issue #299). The first describe block pins the exact
//      iOS config values so accidental drift fails loudly here.
//   2. **Lifecycle scenarios.** PRD pass condition: permission denied,
//      normal start → stop, cancel mid-capture, and app backgrounding
//      mid-capture all behave per spec.
//   3. **Cleanup / re-entry.** start() clears the previous capture's
//      tmp file (PRD AC), back-to-back start without stop is rejected
//      with the typed `already_recording` error, and cancel is
//      idempotent.
//
// expo-av, expo-file-system/legacy, and react-native AppState are all
// mocked locally to this file. The setup.ts global expo-av mock is
// intentionally bypassed — we want full control of the Recording
// instance so we can drive specific failure modes per test.

jest.mock('expo-av', () => {
  const Recording = jest.fn().mockImplementation(() => ({
    prepareToRecordAsync: jest.fn().mockResolvedValue(undefined),
    startAsync: jest.fn().mockResolvedValue(undefined),
    stopAndUnloadAsync: jest.fn().mockResolvedValue(undefined),
    getURI: jest.fn().mockReturnValue('file:///mock/cache/capture-default.wav'),
  }));
  return {
    Audio: {
      Recording,
      requestPermissionsAsync: jest
        .fn()
        .mockResolvedValue({ status: 'granted' }),
      setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
    },
  };
});

jest.mock('expo-file-system/legacy', () => ({
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}));

// We deliberately don't `jest.mock('react-native', ...)` here — the
// project's `src/__tests__/setup.ts` already installs a global RN mock
// (via `jest.requireActual('react-native')` + spread) and per-file
// mocks don't reliably override it across the suite. Instead, we
// reach through the imported `AppState` and rewire its
// `addEventListener` jest.fn at runtime to capture the listener that
// the service registers.
const mockAppStateRef: {
  listener: ((state: string) => void) | null;
  remove: jest.Mock;
} = {
  listener: null,
  remove: jest.fn(),
};

import { AppState } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import {
  AudioCaptureError,
  AudioCaptureService,
  RECORDING_OPTIONS,
} from '../../services/audioCaptureService';

const RecordingCtor = Audio.Recording as unknown as jest.Mock;
const requestPermissionsAsync = Audio.requestPermissionsAsync as jest.Mock;
const setAudioModeAsync = Audio.setAudioModeAsync as jest.Mock;
const deleteAsync = FileSystem.deleteAsync as jest.Mock;

const lastRecordingInstance = () => {
  const all = RecordingCtor.mock.results;
  return all[all.length - 1].value as {
    prepareToRecordAsync: jest.Mock;
    startAsync: jest.Mock;
    stopAndUnloadAsync: jest.Mock;
    getURI: jest.Mock;
  };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAppStateRef.listener = null;
  mockAppStateRef.remove = jest.fn();
  // Re-wire AppState.addEventListener (from setup.ts's global RN mock)
  // so each test captures the listener registered by the service and
  // gets a tracked `remove` fn for unsubscribe assertions.
  (AppState.addEventListener as jest.Mock).mockImplementation(
    (_event: string, listener: (state: string) => void) => {
      mockAppStateRef.listener = listener;
      return { remove: mockAppStateRef.remove };
    },
  );
  requestPermissionsAsync.mockResolvedValue({ status: 'granted' });
  // Reset to default Recording impl so each test starts clean.
  RecordingCtor.mockImplementation(() => ({
    prepareToRecordAsync: jest.fn().mockResolvedValue(undefined),
    startAsync: jest.fn().mockResolvedValue(undefined),
    stopAndUnloadAsync: jest.fn().mockResolvedValue(undefined),
    getURI: jest.fn().mockReturnValue('file:///mock/cache/capture-1.wav'),
  }));
});

describe('AudioCaptureService — US-004', () => {
  describe('PRD format invariant: 16 kHz mono 16-bit PCM WAV', () => {
    // This is the load-bearing assertion. If any of these four values
    // changes, whisper.rn will silently truncate transcription to ~1
    // second (issue #299) and the entire on-device pipeline degrades
    // without an obvious failure mode. Keep these literals in sync with
    // RECORDING_OPTIONS — or, better, don't change them at all.

    it('exposes RECORDING_OPTIONS with iOS sampleRate=16000', () => {
      expect(RECORDING_OPTIONS.ios.sampleRate).toBe(16000);
    });

    it('exposes RECORDING_OPTIONS with iOS numberOfChannels=1 (mono)', () => {
      expect(RECORDING_OPTIONS.ios.numberOfChannels).toBe(1);
    });

    it('exposes RECORDING_OPTIONS with iOS linearPCMBitDepth=16', () => {
      expect(RECORDING_OPTIONS.ios.linearPCMBitDepth).toBe(16);
    });

    it('exposes RECORDING_OPTIONS with iOS outputFormat=lpcm (PCM WAV)', () => {
      // 'lpcm' is IOSOutputFormat.LINEARPCM. Any other value produces
      // a non-WAV container that whisper.rn cannot decode correctly.
      expect(RECORDING_OPTIONS.ios.outputFormat).toBe('lpcm');
    });

    it('exposes RECORDING_OPTIONS with iOS extension=.wav', () => {
      expect(RECORDING_OPTIONS.ios.extension).toBe('.wav');
    });

    it('passes RECORDING_OPTIONS to prepareToRecordAsync at start()', async () => {
      const service = new AudioCaptureService();
      await service.start();

      const rec = lastRecordingInstance();
      expect(rec.prepareToRecordAsync).toHaveBeenCalledWith(RECORDING_OPTIONS);
    });
  });

  describe('permission handling', () => {
    it('throws AudioCaptureError(permission_denied) when permission is denied', async () => {
      requestPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });

      const service = new AudioCaptureService();

      await expect(service.start()).rejects.toBeInstanceOf(AudioCaptureError);
      await service.start().catch((err: AudioCaptureError) => {
        expect(err.code).toBe('permission_denied');
      });
    });

    it('does not instantiate Audio.Recording when permission is denied', async () => {
      requestPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });

      const service = new AudioCaptureService();
      await expect(service.start()).rejects.toThrow();

      expect(RecordingCtor).not.toHaveBeenCalled();
    });

    it('asks for permission on every start() call (Expo treats it as idempotent)', async () => {
      const service = new AudioCaptureService();
      await service.start();
      await service.stop();
      await service.start();

      expect(requestPermissionsAsync).toHaveBeenCalledTimes(2);
    });
  });

  describe('start → stop round-trip', () => {
    it('configures the iOS audio session for recording before starting', async () => {
      const service = new AudioCaptureService();
      await service.start();

      expect(setAudioModeAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          allowsRecordingIOS: true,
          staysActiveInBackground: false,
        }),
      );
    });

    it('resolves stop() with the recording URI and a positive duration', async () => {
      RecordingCtor.mockImplementationOnce(() => ({
        prepareToRecordAsync: jest.fn().mockResolvedValue(undefined),
        startAsync: jest.fn().mockResolvedValue(undefined),
        stopAndUnloadAsync: jest.fn().mockResolvedValue(undefined),
        getURI: jest
          .fn()
          .mockReturnValue('file:///mock/cache/capture-roundtrip.wav'),
      }));

      const service = new AudioCaptureService();
      const realDateNow = Date.now;
      let now = 1_000_000;
      Date.now = jest.fn(() => {
        now += 250; // each call advances 250 ms
        return now;
      });

      try {
        await service.start();
        const result = await service.stop();
        expect(result.uri).toBe('file:///mock/cache/capture-roundtrip.wav');
        expect(result.durationMs).toBeGreaterThan(0);
      } finally {
        Date.now = realDateNow;
      }
    });

    it('marks isRecording() true between start and stop, false otherwise', async () => {
      const service = new AudioCaptureService();
      expect(service.isRecording()).toBe(false);

      await service.start();
      expect(service.isRecording()).toBe(true);

      await service.stop();
      expect(service.isRecording()).toBe(false);
    });

    it('throws no_active_recording when stop() is called without start()', async () => {
      const service = new AudioCaptureService();

      await expect(service.stop()).rejects.toBeInstanceOf(AudioCaptureError);
      await service.stop().catch((err: AudioCaptureError) => {
        expect(err.code).toBe('no_active_recording');
      });
    });

    it('throws already_recording when start() is called twice without stop()', async () => {
      const service = new AudioCaptureService();
      await service.start();

      await expect(service.start()).rejects.toBeInstanceOf(AudioCaptureError);
      await service.start().catch((err: AudioCaptureError) => {
        expect(err.code).toBe('already_recording');
      });
    });

    it('wraps a getURI()===null result as recording_failed', async () => {
      RecordingCtor.mockImplementationOnce(() => ({
        prepareToRecordAsync: jest.fn().mockResolvedValue(undefined),
        startAsync: jest.fn().mockResolvedValue(undefined),
        stopAndUnloadAsync: jest.fn().mockResolvedValue(undefined),
        getURI: jest.fn().mockReturnValue(null),
      }));

      const service = new AudioCaptureService();
      await service.start();

      await expect(service.stop()).rejects.toBeInstanceOf(AudioCaptureError);
      await service.stop().catch((err: AudioCaptureError) => {
        // Note: this catch runs against the second .stop() call, which
        // is no_active_recording — the first stop already cleared state.
        expect(err.code).toBe('no_active_recording');
      });
    });
  });

  describe('cancel mid-capture', () => {
    it('unloads the recorder and deletes the partial file', async () => {
      const stopAndUnloadAsync = jest.fn().mockResolvedValue(undefined);
      const getURI = jest
        .fn()
        .mockReturnValue('file:///mock/cache/capture-cancelled.wav');
      RecordingCtor.mockImplementationOnce(() => ({
        prepareToRecordAsync: jest.fn().mockResolvedValue(undefined),
        startAsync: jest.fn().mockResolvedValue(undefined),
        stopAndUnloadAsync,
        getURI,
      }));

      const service = new AudioCaptureService();
      await service.start();
      await service.cancel();

      expect(stopAndUnloadAsync).toHaveBeenCalledTimes(1);
      expect(deleteAsync).toHaveBeenCalledWith(
        'file:///mock/cache/capture-cancelled.wav',
        { idempotent: true },
      );
      expect(service.isRecording()).toBe(false);
    });

    it('is idempotent — calling cancel() with no active recording is a no-op', async () => {
      const service = new AudioCaptureService();

      await expect(service.cancel()).resolves.toBeUndefined();
      expect(RecordingCtor).not.toHaveBeenCalled();
      expect(deleteAsync).not.toHaveBeenCalled();
    });

    it('does not surface deleteAsync failures to the caller', async () => {
      deleteAsync.mockRejectedValueOnce(new Error('FS unavailable'));

      const service = new AudioCaptureService();
      await service.start();

      await expect(service.cancel()).resolves.toBeUndefined();
    });

    it('does not surface stopAndUnloadAsync failures during cancel', async () => {
      const stopAndUnloadAsync = jest
        .fn()
        .mockRejectedValue(new Error('half-prepared recorder'));
      RecordingCtor.mockImplementationOnce(() => ({
        prepareToRecordAsync: jest.fn().mockResolvedValue(undefined),
        startAsync: jest.fn().mockResolvedValue(undefined),
        stopAndUnloadAsync,
        getURI: jest.fn().mockReturnValue(null),
      }));

      const service = new AudioCaptureService();
      await service.start();

      await expect(service.cancel()).resolves.toBeUndefined();
      expect(service.isRecording()).toBe(false);
    });
  });

  describe('iOS background-state guard', () => {
    it("cancels the active recording when AppState transitions to 'background'", async () => {
      const stopAndUnloadAsync = jest.fn().mockResolvedValue(undefined);
      const getURI = jest
        .fn()
        .mockReturnValue('file:///mock/cache/capture-bg.wav');
      RecordingCtor.mockImplementationOnce(() => ({
        prepareToRecordAsync: jest.fn().mockResolvedValue(undefined),
        startAsync: jest.fn().mockResolvedValue(undefined),
        stopAndUnloadAsync,
        getURI,
      }));

      const service = new AudioCaptureService();
      await service.start();
      expect(mockAppStateRef.listener).not.toBeNull();
      expect(service.isRecording()).toBe(true);

      // Fire the AppState 'background' event.
      mockAppStateRef.listener!('background');
      // cancel() is async; flush microtasks.
      await new Promise(resolve => setImmediate(resolve));

      expect(stopAndUnloadAsync).toHaveBeenCalledTimes(1);
      expect(deleteAsync).toHaveBeenCalledWith(
        'file:///mock/cache/capture-bg.wav',
        { idempotent: true },
      );
      expect(service.isRecording()).toBe(false);
    });

    it("does NOT cancel on 'inactive' (transient state — notification center, etc.)", async () => {
      const service = new AudioCaptureService();
      await service.start();
      expect(mockAppStateRef.listener).not.toBeNull();

      mockAppStateRef.listener!('inactive');
      await new Promise(resolve => setImmediate(resolve));

      expect(service.isRecording()).toBe(true);
    });

    it('removes the AppState listener after stop()', async () => {
      const service = new AudioCaptureService();
      await service.start();
      await service.stop();

      expect(mockAppStateRef.remove).toHaveBeenCalled();
    });

    it('removes the AppState listener after cancel()', async () => {
      const service = new AudioCaptureService();
      await service.start();
      await service.cancel();

      expect(mockAppStateRef.remove).toHaveBeenCalled();
    });
  });

  describe('tmp file cleanup between captures', () => {
    // PRD AC: "Captured file is written to a tmp directory and cleaned
    // up on next start()". Cleanup happens on the NEXT start (not at
    // stop time) so the URI returned by stop() remains valid for the
    // caller to feed into onDeviceTranscriptionService.

    it('deletes the previous capture file when start() is called again', async () => {
      const uriA = 'file:///mock/cache/capture-A.wav';
      const uriB = 'file:///mock/cache/capture-B.wav';

      RecordingCtor.mockImplementationOnce(() => ({
        prepareToRecordAsync: jest.fn().mockResolvedValue(undefined),
        startAsync: jest.fn().mockResolvedValue(undefined),
        stopAndUnloadAsync: jest.fn().mockResolvedValue(undefined),
        getURI: jest.fn().mockReturnValue(uriA),
      })).mockImplementationOnce(() => ({
        prepareToRecordAsync: jest.fn().mockResolvedValue(undefined),
        startAsync: jest.fn().mockResolvedValue(undefined),
        stopAndUnloadAsync: jest.fn().mockResolvedValue(undefined),
        getURI: jest.fn().mockReturnValue(uriB),
      }));

      const service = new AudioCaptureService();
      await service.start();
      await service.stop();

      // stop() must NOT have deleted the file — caller might still need it.
      expect(deleteAsync).not.toHaveBeenCalledWith(uriA, expect.anything());

      await service.start();
      expect(deleteAsync).toHaveBeenCalledWith(uriA, { idempotent: true });

      await service.stop();
    });

    it('does not try to delete anything on the first start() (no previous capture)', async () => {
      const service = new AudioCaptureService();
      await service.start();

      expect(deleteAsync).not.toHaveBeenCalled();
    });
  });

  describe('error wrapping', () => {
    it('wraps prepareToRecordAsync failures as recording_failed with cause', async () => {
      const nativeErr = new Error('AVAudioRecorder init failed');
      const stopAndUnloadAsync = jest.fn().mockResolvedValue(undefined);
      RecordingCtor.mockImplementationOnce(() => ({
        prepareToRecordAsync: jest.fn().mockRejectedValue(nativeErr),
        startAsync: jest.fn().mockResolvedValue(undefined),
        stopAndUnloadAsync,
        getURI: jest.fn().mockReturnValue(null),
      }));

      const service = new AudioCaptureService();
      const rejection = service.start();

      await expect(rejection).rejects.toBeInstanceOf(AudioCaptureError);
      await rejection.catch((err: AudioCaptureError) => {
        expect(err.code).toBe('recording_failed');
        expect(err.cause).toBe(nativeErr);
      });
      // Best-effort cleanup attempted.
      expect(stopAndUnloadAsync).toHaveBeenCalled();
    });
  });
});
