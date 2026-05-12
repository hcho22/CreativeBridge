/**
 * US-011: Hide voice input on Android (coming-soon state)
 *
 * Snapshot tests that verify the platform gate added to VoiceInput.tsx:
 *   - iOS render contains the mic-button TouchableOpacity (testID="mic-button").
 *   - Android render produces null — no mic button anywhere in the tree.
 *
 * Uses the existing override-restore pattern on `Platform.OS` (see
 * `src/__tests__/integration/storyImportFlow.test.tsx` for the prior art).
 * The implementation reads `Platform.OS` inline at render time rather than
 * capturing it in a module-level constant, so mutating the property
 * between tests is sufficient — no `jest.resetModules()` needed.
 *
 * Snapshots are committed; they're how we lock in "the iOS UI is
 * unaffected" (AC #4) — if a future change accidentally re-introduces
 * platform-shared logic that drops the mic button on iOS, the iOS
 * snapshot diff will catch it.
 */

import React from 'react';
import { render } from '@testing-library/react-native';

// -- Mocks ----------------------------------------------------------------

jest.mock('../../services/audioCaptureService', () => ({
  audioCaptureService: {
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue({
      uri: 'file:///mock/cache/capture.wav',
      durationMs: 1000,
    }),
    cancel: jest.fn().mockResolvedValue(undefined),
    isRecording: jest.fn().mockReturnValue(false),
  },
}));

jest.mock('../../services/onDeviceTranscriptionService', () => ({
  onDeviceTranscriptionService: {
    transcribe: jest.fn().mockResolvedValue({ text: '', latencyMs: 0 }),
  },
  TranscriptionError: class TranscriptionError extends Error {},
}));

jest.mock('../../services/whisperTranscriptionService', () => ({
  whisperTranscriptionService: {
    startRecording: jest.fn().mockResolvedValue(undefined),
    stopAndTranscribe: jest.fn().mockResolvedValue(''),
    cancel: jest.fn().mockResolvedValue(undefined),
    isRecording: jest.fn().mockReturnValue(false),
  },
}));

// The global setup.ts mocks AsyncStorage's methods as bare `jest.fn()`s,
// which means they return `undefined` rather than a Promise. The
// US-011 one-time-alert effect chains `.then(...)` off `getItem`, so we
// need actual Promise returns here. Override the global mock with
// Promise-returning fns. `getItem` resolves to `null` by default so the
// first Android mount fires the alert (matching the production path).
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
  },
}));

// The Android branch fires Alert.alert via a one-time AsyncStorage gate.
// The global setup.ts already mocks both AsyncStorage and Alert.alert, but
// reset their call records between tests so Android snapshots aren't
// affected by prior runs.
const RN = jest.requireMock('react-native');
if (RN?.AccessibilityInfo) {
  RN.AccessibilityInfo.announceForAccessibility = jest.fn();
}

// -- SUT (imported after mocks) ------------------------------------------

import { VoiceInput } from '../../components/common/VoiceInput';

const baseProps = {
  onSpeechResult: jest.fn(),
  isEnabled: true,
};

describe('US-011: VoiceInput platform gate', () => {
  const originalPlatformOS = require('react-native').Platform.OS;

  afterEach(() => {
    require('react-native').Platform.OS = originalPlatformOS;
  });

  describe('iOS', () => {
    beforeEach(() => {
      require('react-native').Platform.OS = 'ios';
    });

    it('renders the mic button on iOS', () => {
      const { queryByTestId } = render(<VoiceInput {...baseProps} />);
      expect(queryByTestId('mic-button')).not.toBeNull();
    });

    it('matches the iOS snapshot', () => {
      const tree = render(<VoiceInput {...baseProps} />).toJSON();
      expect(tree).toMatchSnapshot();
    });
  });

  describe('Android', () => {
    beforeEach(() => {
      require('react-native').Platform.OS = 'android';
    });

    it('does not render the mic button on Android', () => {
      const { queryByTestId } = render(<VoiceInput {...baseProps} />);
      expect(queryByTestId('mic-button')).toBeNull();
    });

    it('renders nothing (null) on Android', () => {
      const tree = render(<VoiceInput {...baseProps} />).toJSON();
      // The component returns null. Some RNTL versions surface this as
      // `null`, others as an empty array — accept either.
      expect(tree === null || (Array.isArray(tree) && tree.length === 0)).toBe(
        true,
      );
    });

    it('matches the Android snapshot', () => {
      const tree = render(<VoiceInput {...baseProps} />).toJSON();
      expect(tree).toMatchSnapshot();
    });
  });
});
