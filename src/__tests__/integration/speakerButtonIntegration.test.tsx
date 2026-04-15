/**
 * Integration tests for the Speaker (Listen) Round Button
 *
 * Updated for PRD "Voice-First Input Bar" US-012: the Listen button lives
 * inside `VoiceFirstInputBar` and exposes `accessibilityLabel="Listen to the
 * story so far"`. Its `testID="speaker-button"` is preserved for back-compat
 * with existing test harnesses. This suite verifies:
 *
 *   - a single tap still toggles TTS by invoking `onSpeakerPress`
 *   - a long press still invokes `onSpeakerLongPress` (pause/resume)
 *   - disabled state reflects `canUseSpeaker` and `isGenerating`
 *   - the icon swaps to a Stop glyph while TTS is actively speaking
 *
 * Host-side behavior (the actual TTS engine calls made from
 * `handleSpeakerButtonPress`) is verified in services/textToSpeech* tests.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, TextInput } from 'react-native';
import VoiceFirstInputBar, {
  VoiceFirstInputBarProps,
} from '../../components/story/VoiceFirstInputBar';

// jest.setup.js omits announceForAccessibility from its AccessibilityInfo mock;
// patch it so the mode-entry effect doesn't throw on render.
(AccessibilityInfo as any).announceForAccessibility = jest.fn();

// jest.setup.js's Animated.loop mock returns `{ start }` only; the component's
// pulse animation cleanup calls `.stop()` on unmount. Supply both handles.
(Animated as any).loop = jest.fn(() => ({
  start: jest.fn(),
  stop: jest.fn(),
}));

jest.mock('../../components/common/VoiceInput', () => ({
  __esModule: true,
  VoiceInput: () => null,
  default: () => null,
}));

jest.mock('../../services/textToSpeechIsolated', () => ({
  textToSpeechService: {
    stop: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@react-native-voice/voice');

// Override jest.setup.js's broken MaterialIcons mock (it calls Text() instead
// of returning JSX). No-op icon — this suite only checks button behavior.
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

describe('Speaker (Listen) Button Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('testID compatibility', () => {
    test('renders under the preserved testID="speaker-button"', () => {
      const { getByTestId } = renderBar();
      expect(getByTestId('speaker-button')).toBeTruthy();
    });

    test('is also resolvable by its new accessibilityLabel', () => {
      const { getByLabelText, getByTestId } = renderBar();
      expect(getByTestId('speaker-button')).toBe(
        getByLabelText('Listen to the story so far'),
      );
    });
  });

  describe('Tap toggles TTS', () => {
    test('single tap invokes onSpeakerPress exactly once', () => {
      const { getByTestId, props } = renderBar();
      fireEvent.press(getByTestId('speaker-button'));
      expect(props.onSpeakerPress).toHaveBeenCalledTimes(1);
    });

    test('two taps invoke the handler twice (TTS start → stop toggle)', () => {
      const { getByTestId, props } = renderBar();
      const button = getByTestId('speaker-button');
      fireEvent.press(button);
      fireEvent.press(button);
      expect(props.onSpeakerPress).toHaveBeenCalledTimes(2);
    });
  });

  describe('Long press invokes pause/resume', () => {
    test('onLongPress fires onSpeakerLongPress', () => {
      const { getByTestId, props } = renderBar();
      fireEvent(getByTestId('speaker-button'), 'longPress');
      expect(props.onSpeakerLongPress).toHaveBeenCalledTimes(1);
    });
  });

  describe('Disabled states', () => {
    test('canUseSpeaker=false renders disabled button', () => {
      const { getByTestId } = renderBar({ canUseSpeaker: false });
      const button = getByTestId('speaker-button');
      expect(button.props.accessibilityState?.disabled).toBe(true);
    });

    test('isGenerating=true renders disabled button', () => {
      const { getByTestId } = renderBar({ isGenerating: true });
      const button = getByTestId('speaker-button');
      expect(button.props.accessibilityState?.disabled).toBe(true);
    });

    test('disabled state propagates to TouchableOpacity.disabled prop', () => {
      // @testing-library/react-native's `fireEvent.press` calls the onPress
      // prop directly regardless of `disabled` — that's a platform-level guard
      // inside RN's native TouchableOpacity, not something we can verify with
      // fireEvent. The next-best assertion is that we *wired* the disabled
      // prop through correctly (RN handles the rest at runtime).
      const { getByTestId } = renderBar({ canUseSpeaker: false });
      const button = getByTestId('speaker-button');
      expect(button.props.disabled).toBe(true);
      expect(button.props.accessibilityState?.disabled).toBe(true);
    });
  });

  describe('Icon swap follows speakerState (not mode)', () => {
    test('idle speakerState renders the speaker icon (not stop)', () => {
      // Icon is a MaterialIcons child — we verify by checking accessibility
      // state is NOT selected (which is what Listen toggles when TTS is live).
      const { getByTestId } = renderBar({ speakerState: 'idle' });
      expect(
        getByTestId('speaker-button').props.accessibilityState?.selected,
      ).toBe(false);
    });

    test('speaking speakerState renders the active / stop-icon look', () => {
      const { getByTestId } = renderBar({ speakerState: 'speaking' });
      expect(
        getByTestId('speaker-button').props.accessibilityState?.selected,
      ).toBe(true);
    });

    test('starting speakerState ALSO shows active look (handshake window)', () => {
      // speakerState transitions 'idle' → 'starting' → 'speaking'; the active
      // styling must not flicker off during the 'starting' handshake.
      const { getByTestId } = renderBar({ speakerState: 'starting' });
      expect(
        getByTestId('speaker-button').props.accessibilityState?.selected,
      ).toBe(true);
    });

    test('paused speakerState still shows Listen, not active', () => {
      // When paused, the user sees a "resume" affordance, not "stop" — the
      // active styling should be off.
      const { getByTestId } = renderBar({ speakerState: 'paused' });
      expect(
        getByTestId('speaker-button').props.accessibilityState?.selected,
      ).toBe(false);
    });
  });

  describe('Accessibility affordances', () => {
    test('has accessibilityRole="button"', () => {
      const { getByTestId } = renderBar();
      expect(getByTestId('speaker-button').props.accessibilityRole).toBe(
        'button',
      );
    });

    test('label is the AC-specified static string', () => {
      const { getByTestId } = renderBar();
      expect(getByTestId('speaker-button').props.accessibilityLabel).toBe(
        'Listen to the story so far',
      );
    });
  });
});
