/**
 * Functional Testing for the Voice-First Input Bar
 *
 * Updated for PRD "Voice-First Input Bar" US-012: assertions target the three
 * round buttons by their new static `accessibilityLabel` values (US-008) and
 * the component is rendered in isolation rather than through the HomeScreen
 * host. Prior to the voice-first refactor HomeScreen exposed inline
 * `testID="mic-button"` / `testID="speaker-button"` controls; after US-009
 * those controls live inside `VoiceFirstInputBar` and are addressed by label:
 *
 *   - Listen   → `accessibilityLabel="Listen to the story so far"`   (LEFT)
 *   - Speak    → `accessibilityLabel="Speak your contribution"`      (CENTER, PRIMARY)
 *   - Keyboard → `accessibilityLabel="Type with the keyboard"`       (RIGHT)
 *
 * We mock the embedded `VoiceInput` so a transcript can be fed into the
 * reducer synchronously via `global.__lastSpeechResult(...)` — this lets the
 * review card render without driving the real permissions/autoStart pipeline.
 */

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, TextInput } from 'react-native';
import VoiceFirstInputBar, {
  VoiceFirstInputBarProps,
} from '../../components/story/VoiceFirstInputBar';

// jest.setup.js:209 mocks `AccessibilityInfo` without `announceForAccessibility`,
// so the mode-transition effect (VoiceFirstInputBar.tsx:295) would crash as
// soon as mode moves off 'idle'. Patch the method onto the mocked module for
// this suite — behavior test files don't assert on the announcements here
// (that's voiceFeaturesAccessibility.test.tsx's job).
(AccessibilityInfo as any).announceForAccessibility = jest.fn();

// jest.setup.js:233+ mocks `Animated.loop` returning only `{ start }` — no
// `stop`. VoiceFirstInputBar's pulse animation calls `loop.stop()` in cleanup
// (VoiceFirstInputBar.tsx:~430), which would crash on unmount. Supply both.
(Animated as any).loop = jest.fn(() => ({
  start: jest.fn(),
  stop: jest.fn(),
}));

// Expose the embedded VoiceInput's callbacks so tests can simulate a speech
// result / error at will. The mock renders nothing — VoiceFirstInputBar still
// controls every visual and only mounts VoiceInput while in `listening` mode.
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

// TTS service is stubbed — Speak's tap handler calls textToSpeechService.stop()
// when the speaker is active to release the iOS audio session; we only need
// it not to crash in the jest environment.
jest.mock('../../services/textToSpeechIsolated', () => ({
  textToSpeechService: {
    stop: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@react-native-voice/voice');

// Override the global MaterialIcons mock (jest.setup.js:43-48) which mis-calls
// `Text(props.name)` as a function instead of JSX — crashes under
// react-test-renderer. A no-op icon is fine for these behavior tests.
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

describe('Voice Features Functional Testing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).__lastSpeechResult = undefined;
    (global as any).__lastSpeechError = undefined;
  });

  describe('1. Listen (speaker) button reads the story', () => {
    test('pressing Listen invokes onSpeakerPress (TTS start/stop handler)', () => {
      const { getByLabelText, props } = renderBar();
      fireEvent.press(getByLabelText('Listen to the story so far'));
      expect(props.onSpeakerPress).toHaveBeenCalledTimes(1);
    });

    test('long-pressing Listen invokes onSpeakerLongPress (pause/resume)', () => {
      const { getByLabelText, props } = renderBar();
      fireEvent(getByLabelText('Listen to the story so far'), 'longPress');
      expect(props.onSpeakerLongPress).toHaveBeenCalledTimes(1);
    });
  });

  describe('2. Speak button pause/resume via host handlers', () => {
    test('Listen disabled visually when canUseSpeaker=false', () => {
      const { getByLabelText } = renderBar({ canUseSpeaker: false });
      const listen = getByLabelText('Listen to the story so far');
      expect(listen.props.accessibilityState?.disabled).toBe(true);
    });

    test('Listen reports active state while speakerState="speaking"', () => {
      const { getByLabelText } = renderBar({ speakerState: 'speaking' });
      const listen = getByLabelText('Listen to the story so far');
      expect(listen.props.accessibilityState?.selected).toBe(true);
    });
  });

  describe('3. Speak button starts/stops listening on tap', () => {
    test('first tap enters listening (accessibilityState.selected flips true)', () => {
      const { getByLabelText } = renderBar();
      const speak = getByLabelText('Speak your contribution');
      expect(speak.props.accessibilityState?.selected).toBe(false);
      fireEvent.press(speak);
      expect(speak.props.accessibilityState?.selected).toBe(true);
    });

    test('second tap cancels back to idle', () => {
      const { getByLabelText } = renderBar();
      const speak = getByLabelText('Speak your contribution');
      fireEvent.press(speak); // → listening
      fireEvent.press(speak); // → idle
      expect(speak.props.accessibilityState?.selected).toBe(false);
    });
  });

  describe('4. Transcribed text surfaces in the review card', () => {
    test('non-empty voice result calls onVoiceResult and renders review actions', () => {
      const { getByLabelText, queryByText, props } = renderBar();
      fireEvent.press(getByLabelText('Speak your contribution'));
      act(() => {
        (global as any).__lastSpeechResult?.('Once upon a time');
      });
      expect(props.onVoiceResult).toHaveBeenCalledWith('Once upon a time');
      // Review card renders Re-record / Edit / Submit buttons.
      expect(queryByText('Re-record')).toBeTruthy();
      expect(queryByText('Edit')).toBeTruthy();
      expect(queryByText('Submit')).toBeTruthy();
    });

    test('whitespace-only voice result snaps back to idle (no review card)', () => {
      const { getByLabelText, queryByText, props } = renderBar();
      fireEvent.press(getByLabelText('Speak your contribution'));
      act(() => {
        (global as any).__lastSpeechResult?.('   ');
      });
      expect(props.onVoiceResult).not.toHaveBeenCalled();
      expect(queryByText('Re-record')).toBeNull();
    });
  });

  describe('5. Transcribed text can be edited', () => {
    test('Edit on review card switches to typing mode with transcript pre-filled', () => {
      const transcript = 'Original voice transcription';
      const { getByLabelText, getByText, getByTestId } = renderBar({
        userInput: transcript,
      });
      fireEvent.press(getByLabelText('Speak your contribution'));
      act(() => {
        (global as any).__lastSpeechResult?.(transcript);
      });
      fireEvent.press(getByText('Edit'));
      const input = getByTestId('story-input');
      expect(input.props.value).toBe(transcript);
    });

    test('typing updates userInput through onUserInputChange', () => {
      const { getByLabelText, getByTestId, props } = renderBar();
      fireEvent.press(getByLabelText('Type with the keyboard'));
      fireEvent.changeText(getByTestId('story-input'), 'Edited contribution');
      expect(props.onUserInputChange).toHaveBeenCalledWith(
        'Edited contribution',
      );
    });
  });

  describe('6. Voice input works for all grade levels', () => {
    // VoiceFirstInputBar itself is grade-level agnostic — grade level affects
    // downstream TTS / AI pipelines. We verify the bar renders the same three
    // labelled buttons regardless of session state.
    const gradeLevels = ['K-2', '3-5', '6-8', '9-12'];
    gradeLevels.forEach(grade => {
      test(`renders Listen/Speak/Keyboard at grade ${grade}`, () => {
        const { getByLabelText } = renderBar();
        expect(getByLabelText('Listen to the story so far')).toBeTruthy();
        expect(getByLabelText('Speak your contribution')).toBeTruthy();
        expect(getByLabelText('Type with the keyboard')).toBeTruthy();
      });
    });
  });

  describe('7. Submit wires voice input to handleContinueStory', () => {
    test('Submit on review card invokes onSubmit', () => {
      const { getByLabelText, getByText, props } = renderBar({
        userInput: 'Voice draft',
      });
      fireEvent.press(getByLabelText('Speak your contribution'));
      act(() => {
        (global as any).__lastSpeechResult?.('Voice draft');
      });
      fireEvent.press(getByText('Submit'));
      expect(props.onSubmit).toHaveBeenCalledTimes(1);
    });

    test('Submit from typing mode (arrow) invokes onSubmit when text is non-empty', () => {
      const { getByLabelText, getByTestId, props } = renderBar({
        userInput: 'Typed draft',
      });
      fireEvent.press(getByLabelText('Type with the keyboard'));
      fireEvent.press(getByTestId('continue-story-button'));
      expect(props.onSubmit).toHaveBeenCalledTimes(1);
    });
  });

  describe('8. Voice input respects the same constraints as typed input', () => {
    test('onVoiceResult receives trimmed text (matches typed-submission semantics)', () => {
      const { getByLabelText, props } = renderBar();
      fireEvent.press(getByLabelText('Speak your contribution'));
      act(() => {
        (global as any).__lastSpeechResult?.('  padded transcript  ');
      });
      expect(props.onVoiceResult).toHaveBeenCalledWith('padded transcript');
    });
  });

  describe('9. Typing remains available as a fallback', () => {
    test('Keyboard opens the typing row (story-input becomes queryable)', () => {
      const { getByLabelText, getByTestId } = renderBar();
      fireEvent.press(getByLabelText('Type with the keyboard'));
      expect(getByTestId('story-input')).toBeTruthy();
    });

    test('Speak disabled when voiceInputEnabled=false; typing still works', () => {
      const { getByLabelText, getByTestId, props } = renderBar({
        voiceInputEnabled: false,
      });
      const speak = getByLabelText('Speak your contribution');
      expect(speak.props.accessibilityState?.disabled).toBe(true);
      fireEvent.press(getByLabelText('Type with the keyboard'));
      fireEvent.changeText(getByTestId('story-input'), 'Keyboard fallback');
      expect(props.onUserInputChange).toHaveBeenCalledWith('Keyboard fallback');
    });
  });

  describe('10. Visual ordering is Listen → Speak → Keyboard (left to right)', () => {
    // Walk the toJSON() tree instead of getAllByRole('button'): the TouchableOpacity
    // mock in jest.setup.js renders as a leaf with `accessibilityRole="button"` but
    // RN testing-library's role query doesn't resolve it (likely host-component
    // name mismatch). DOM-order traversal is mock-independent and still asserts
    // the same thing the user would perceive via VoiceOver swipe order.
    const collectButtonLabels = (node: any, acc: string[] = []): string[] => {
      if (!node) return acc;
      if (Array.isArray(node)) {
        node.forEach(n => collectButtonLabels(n, acc));
        return acc;
      }
      if (
        node.props?.accessibilityRole === 'button' &&
        typeof node.props?.accessibilityLabel === 'string'
      ) {
        acc.push(node.props.accessibilityLabel);
      }
      if (node.children) collectButtonLabels(node.children, acc);
      return acc;
    };

    test('tree traversal yields Listen → Speak → Keyboard in DOM order', () => {
      const { toJSON } = renderBar();
      const labels = collectButtonLabels(toJSON());
      expect(labels).toEqual([
        'Listen to the story so far',
        'Speak your contribution',
        'Type with the keyboard',
      ]);
    });
  });
});
