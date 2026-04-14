/**
 * End-to-End Integration Tests for Voice-First Input Bar
 *
 * Updated for PRD "Voice-First Input Bar" US-012. Walks the full Speak-to-
 * Submit path that replaced the legacy inline mic/TextInput row:
 *
 *   tap Speak → (mode → listening) → mock voice result →
 *     review card appears → tap Submit → onSubmit (handleContinueStory) fires
 *
 * The embedded `VoiceInput` is mocked so we can feed a transcript into the
 * reducer synchronously without exercising the real permissions/autoStart
 * pipeline — that layer has dedicated coverage in VoiceInput.test.tsx.
 */

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, TextInput } from 'react-native';
import VoiceFirstInputBar, {
  VoiceFirstInputBarProps,
} from '../../components/story/VoiceFirstInputBar';

// jest.setup.js omits announceForAccessibility from AccessibilityInfo; patch
// before any render so the US-008 mode-entry effect can call it safely.
(AccessibilityInfo as any).announceForAccessibility = jest.fn();

// jest.setup.js's Animated.loop mock lacks `.stop()`; VoiceFirstInputBar's
// pulse animation cleanup calls it on unmount. Patch to supply both handles.
(Animated as any).loop = jest.fn(() => ({
  start: jest.fn(),
  stop: jest.fn(),
}));

jest.mock('../../components/common/VoiceInput', () => ({
  __esModule: true,
  VoiceInput: (props: any) => {
    (global as any).__lastSpeechResult = props.onSpeechResult;
    (global as any).__lastSpeechError = props.onError;
    return null;
  },
  default: (props: any) => {
    (global as any).__lastSpeechResult = props.onSpeechResult;
    (global as any).__lastSpeechError = props.onError;
    return null;
  },
}));

jest.mock('../../services/textToSpeechIsolated', () => ({
  textToSpeechService: {
    stop: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@react-native-voice/voice');

// Override jest.setup.js's broken MaterialIcons mock — it tries Text() as a
// function call rather than JSX, which crashes render. No-op icon is fine.
jest.mock('react-native-vector-icons/MaterialIcons', () => {
  return function MockIcon() {
    return null;
  };
});

const baseProps = (): VoiceFirstInputBarProps => ({
  userInput: '',
  onUserInputChange: jest.fn(),
  storyInputRef: React.createRef<TextInput | null>() as any,
  onVoiceResult: jest.fn(),
  voiceInputEnabled: true,
  onSpeakerPress: jest.fn(),
  onSpeakerLongPress: jest.fn(),
  speakerState: 'idle',
  canUseSpeaker: true,
  onSubmit: jest.fn(),
  isGenerating: false,
  isGameCompleted: false,
  isUserStarting: false,
});

const renderBar = (overrides: Partial<VoiceFirstInputBarProps> = {}) => {
  const props = { ...baseProps(), ...overrides };
  const utils = render(<VoiceFirstInputBar {...props} />);
  return { ...utils, props };
};

describe('End-to-End Voice Features', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).__lastSpeechResult = undefined;
    (global as any).__lastSpeechError = undefined;
    // Announcements go through AccessibilityInfo; silence them in tests.
    jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => {});
  });

  describe('Complete User Journey', () => {
    test('tap Speak → mock voice result → review card → Submit → onSubmit fires', () => {
      const transcript = 'The hero continued the amazing adventure';
      const { getByLabelText, getByText, props } = renderBar({
        userInput: transcript,
      });

      // 1. Tap Speak → reducer: idle → listening; Speak reports selected=true.
      const speak = getByLabelText('Speak your contribution');
      fireEvent.press(speak);
      expect(speak.props.accessibilityState?.selected).toBe(true);

      // 2. Embedded VoiceInput delivers a transcription.
      act(() => {
        (global as any).__lastSpeechResult?.(transcript);
      });
      expect(props.onVoiceResult).toHaveBeenCalledWith(transcript);

      // 3. Review card renders Re-record / Edit / Submit.
      expect(getByText('Re-record')).toBeTruthy();
      expect(getByText('Edit')).toBeTruthy();
      expect(getByText('Submit')).toBeTruthy();

      // 4. Submit invokes onSubmit (wired to handleContinueStory in the host).
      fireEvent.press(getByText('Submit'));
      expect(props.onSubmit).toHaveBeenCalledTimes(1);
    });

    test('Re-record clears transcript and returns to listening', () => {
      const transcript = 'First attempt';
      const { getByLabelText, getByText, props } = renderBar({
        userInput: transcript,
      });
      fireEvent.press(getByLabelText('Speak your contribution'));
      act(() => {
        (global as any).__lastSpeechResult?.(transcript);
      });
      fireEvent.press(getByText('Re-record'));
      // Re-record calls onUserInputChange('') to clear stale text before the
      // embedded VoiceInput remounts into a fresh listening session.
      expect(props.onUserInputChange).toHaveBeenCalledWith('');
      // Speak is selected again → mode is 'listening'.
      expect(
        getByLabelText('Speak your contribution').props.accessibilityState
          ?.selected,
      ).toBe(true);
    });

    test('Edit transitions to typing mode preserving transcript for inline correction', () => {
      const transcript = 'Original voice text';
      const { getByLabelText, getByText, getByTestId } = renderBar({
        userInput: transcript,
      });
      fireEvent.press(getByLabelText('Speak your contribution'));
      act(() => {
        (global as any).__lastSpeechResult?.(transcript);
      });
      fireEvent.press(getByText('Edit'));
      // In typing mode, the TextInput is visible and pre-filled with the
      // transcript so the user can correct a word without re-recording.
      const input = getByTestId('story-input');
      expect(input.props.value).toBe(transcript);
    });
  });

  describe('Error Scenarios', () => {
    test('voice error during listening snaps the bar back to idle', () => {
      const { getByLabelText } = renderBar();
      const speak = getByLabelText('Speak your contribution');
      fireEvent.press(speak); // listening
      expect(speak.props.accessibilityState?.selected).toBe(true);
      act(() => {
        (global as any).__lastSpeechError?.('permission_denied');
      });
      expect(speak.props.accessibilityState?.selected).toBe(false);
    });

    test('empty transcript path does not invoke onVoiceResult', () => {
      const { getByLabelText, props } = renderBar();
      fireEvent.press(getByLabelText('Speak your contribution'));
      act(() => {
        (global as any).__lastSpeechResult?.('');
      });
      expect(props.onVoiceResult).not.toHaveBeenCalled();
    });

    test('typing always works as a fallback', () => {
      const { getByLabelText, getByTestId, props } = renderBar();
      fireEvent.press(getByLabelText('Type with the keyboard'));
      fireEvent.changeText(getByTestId('story-input'), 'Typed fallback');
      expect(props.onUserInputChange).toHaveBeenCalledWith('Typed fallback');
    });
  });

  describe('Grade Level & Session State', () => {
    const gradeLevels = ['K-2', '3-5', '6-8', '9-12'];
    gradeLevels.forEach(grade => {
      test(`renders identically across grade level ${grade}`, () => {
        const { getByLabelText } = renderBar();
        expect(getByLabelText('Listen to the story so far')).toBeTruthy();
        expect(getByLabelText('Speak your contribution')).toBeTruthy();
        expect(getByLabelText('Type with the keyboard')).toBeTruthy();
      });
    });

    test('isGameCompleted=true hides the entire bar (US-010)', () => {
      const { queryByLabelText } = renderBar({ isGameCompleted: true });
      expect(queryByLabelText('Speak your contribution')).toBeNull();
      expect(queryByLabelText('Listen to the story so far')).toBeNull();
      expect(queryByLabelText('Type with the keyboard')).toBeNull();
    });
  });

  describe('Story Length Handling (transcript length)', () => {
    test('short transcript flows through onVoiceResult trimmed', () => {
      const { getByLabelText, props } = renderBar();
      fireEvent.press(getByLabelText('Speak your contribution'));
      act(() => {
        (global as any).__lastSpeechResult?.('Hi');
      });
      expect(props.onVoiceResult).toHaveBeenCalledWith('Hi');
    });

    test('long transcript is preserved verbatim (no truncation inside the bar)', () => {
      const long = 'sentence. '.repeat(60).trim();
      const { getByLabelText, props } = renderBar({ userInput: long });
      fireEvent.press(getByLabelText('Speak your contribution'));
      act(() => {
        (global as any).__lastSpeechResult?.(long);
      });
      expect(props.onVoiceResult).toHaveBeenCalledWith(long);
    });
  });

  describe('Edge Cases', () => {
    test('rapid Speak taps end up idle after an even count', () => {
      const { getByLabelText } = renderBar();
      const speak = getByLabelText('Speak your contribution');
      fireEvent.press(speak); // listening
      fireEvent.press(speak); // idle
      fireEvent.press(speak); // listening
      fireEvent.press(speak); // idle
      expect(speak.props.accessibilityState?.selected).toBe(false);
    });

    test('buttons are disabled while generating', () => {
      const { getByLabelText } = renderBar({ isGenerating: true });
      expect(
        getByLabelText('Speak your contribution').props.accessibilityState
          ?.disabled,
      ).toBe(true);
      expect(
        getByLabelText('Listen to the story so far').props.accessibilityState
          ?.disabled,
      ).toBe(true);
      expect(
        getByLabelText('Type with the keyboard').props.accessibilityState
          ?.disabled,
      ).toBe(true);
    });
  });

  describe('Accessibility Compliance', () => {
    test('all three round buttons expose accessibilityRole="button"', () => {
      const { getByLabelText } = renderBar();
      expect(
        getByLabelText('Listen to the story so far').props.accessibilityRole,
      ).toBe('button');
      expect(
        getByLabelText('Speak your contribution').props.accessibilityRole,
      ).toBe('button');
      expect(
        getByLabelText('Type with the keyboard').props.accessibilityRole,
      ).toBe('button');
    });

    test('AccessibilityInfo.announceForAccessibility is called on mode transitions', () => {
      const spy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
      const { getByLabelText } = renderBar();
      fireEvent.press(getByLabelText('Speak your contribution'));
      expect(spy).toHaveBeenCalledWith('Listening. Speak now.');
    });
  });

  describe('Regression Prevention', () => {
    test('typing fallback still works if voice errors out first', () => {
      const { getByLabelText, getByTestId, props } = renderBar();
      fireEvent.press(getByLabelText('Speak your contribution'));
      act(() => {
        (global as any).__lastSpeechError?.('any_error');
      });
      fireEvent.press(getByLabelText('Type with the keyboard'));
      fireEvent.changeText(getByTestId('story-input'), 'After voice error');
      expect(props.onUserInputChange).toHaveBeenCalledWith('After voice error');
    });

    test('voice and typing do not interfere — typing still routes to onUserInputChange', () => {
      const { getByLabelText, getByTestId, props } = renderBar();
      fireEvent.press(getByLabelText('Type with the keyboard'));
      fireEvent.changeText(getByTestId('story-input'), 'Mixed flow');
      expect(props.onUserInputChange).toHaveBeenCalledWith('Mixed flow');
    });
  });
});
