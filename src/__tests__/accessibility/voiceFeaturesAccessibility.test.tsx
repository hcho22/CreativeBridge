/**
 * Accessibility Testing for the Voice-First Input Bar
 *
 * Updated for PRD "Voice-First Input Bar" US-012. Verifies VoiceOver /
 * TalkBack affordances on the three round buttons and on mode transitions:
 *
 *   1. Static `accessibilityLabel` strings match US-008 literally.
 *   2. `accessibilityRole="button"` on every tappable control.
 *   3. `accessibilityState` reports `{ disabled, selected }` derived from the
 *      reducer so screen readers can announce toggle state.
 *   4. `AccessibilityInfo.announceForAccessibility` fires the AC-mandated
 *      copy on every reducer-driven mode entry (listening, reviewing-
 *      transcript, playing-tts, typing). `idle` stays silent on purpose
 *      (US-008 Implementation Notes).
 *   5. Touch targets: Speak is 96pt (primary) and Listen/Keyboard are 64pt
 *      — both comfortably above the 44pt iOS HIG minimum.
 */

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, TextInput } from 'react-native';
import VoiceFirstInputBar, {
  VoiceFirstInputBarProps,
} from '../../components/story/VoiceFirstInputBar';
import { theme } from '../../constants/theme';

// jest.setup.js omits announceForAccessibility from AccessibilityInfo — add it
// before the spy in beforeEach can attach to a defined property.
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
    return null;
  },
  default: (props: any) => {
    (global as any).__lastSpeechResult = props.onSpeechResult;
    return null;
  },
}));

jest.mock('../../services/textToSpeechIsolated', () => ({
  textToSpeechService: {
    stop: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@react-native-voice/voice');

// Override jest.setup.js's broken MaterialIcons mock (returns Text() instead
// of JSX). No-op icon — this suite only inspects button a11y metadata.
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

const renderBar = (
  overrides: Partial<VoiceFirstInputBarProps> = {},
  announceSpy?: jest.SpyInstance,
) => {
  const props = { ...baseProps(), ...overrides };
  // Re-install the spy BEFORE rendering so the initial mount sees it. The
  // mode effect fires synchronously during render for the initial 'idle' —
  // silent, but future transitions must be captured.
  if (!announceSpy) {
    jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => {});
  }
  const utils = render(<VoiceFirstInputBar {...props} />);
  return { ...utils, props };
};

describe('Voice Features Accessibility Testing', () => {
  let announceSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).__lastSpeechResult = undefined;
    announceSpy = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    announceSpy.mockRestore();
  });

  describe('1. Static accessibility labels match PRD literally', () => {
    test('Listen button label is "Listen to the story so far"', () => {
      const { getByLabelText } = renderBar();
      expect(
        getByLabelText('Listen to the story so far').props.accessibilityLabel,
      ).toBe('Listen to the story so far');
    });

    test('Speak button label is "Speak your contribution"', () => {
      const { getByLabelText } = renderBar();
      expect(
        getByLabelText('Speak your contribution').props.accessibilityLabel,
      ).toBe('Speak your contribution');
    });

    test('Keyboard button label is "Type with the keyboard"', () => {
      const { getByLabelText } = renderBar();
      expect(
        getByLabelText('Type with the keyboard').props.accessibilityLabel,
      ).toBe('Type with the keyboard');
    });
  });

  describe('2. Speak button carries the AC-specified accessibilityHint', () => {
    test('hint explains primary action + VoiceOver "double tap" gesture', () => {
      const { getByLabelText } = renderBar();
      expect(
        getByLabelText('Speak your contribution').props.accessibilityHint,
      ).toBe('Primary input. Double tap to start voice recording.');
    });
  });

  describe('3. accessibilityRole="button" on every round control', () => {
    test('Listen has role="button"', () => {
      const { getByLabelText } = renderBar();
      expect(
        getByLabelText('Listen to the story so far').props.accessibilityRole,
      ).toBe('button');
    });

    test('Speak has role="button"', () => {
      const { getByLabelText } = renderBar();
      expect(
        getByLabelText('Speak your contribution').props.accessibilityRole,
      ).toBe('button');
    });

    test('Keyboard has role="button"', () => {
      const { getByLabelText } = renderBar();
      expect(
        getByLabelText('Type with the keyboard').props.accessibilityRole,
      ).toBe('button');
    });
  });

  describe('4. accessibilityState derived from the reducer', () => {
    test('Speak.selected flips true entering listening, false on cancel', () => {
      const { getByLabelText } = renderBar();
      const speak = getByLabelText('Speak your contribution');
      expect(speak.props.accessibilityState.selected).toBe(false);
      fireEvent.press(speak);
      expect(speak.props.accessibilityState.selected).toBe(true);
      fireEvent.press(speak);
      expect(speak.props.accessibilityState.selected).toBe(false);
    });

    test('Listen.selected reflects speakerState="speaking"', () => {
      const { getByLabelText } = renderBar({ speakerState: 'speaking' });
      expect(
        getByLabelText('Listen to the story so far').props.accessibilityState
          .selected,
      ).toBe(true);
    });

    test('Keyboard.selected flips true in typing mode', () => {
      const { getByLabelText } = renderBar();
      fireEvent.press(getByLabelText('Type with the keyboard'));
      expect(
        getByLabelText('Type with the keyboard').props.accessibilityState
          .selected,
      ).toBe(true);
    });

    test('all three expose disabled=false at idle with good session state', () => {
      const { getByLabelText } = renderBar();
      expect(
        getByLabelText('Listen to the story so far').props.accessibilityState
          .disabled,
      ).toBe(false);
      expect(
        getByLabelText('Speak your contribution').props.accessibilityState
          .disabled,
      ).toBe(false);
      expect(
        getByLabelText('Type with the keyboard').props.accessibilityState
          .disabled,
      ).toBe(false);
    });

    test('all three expose disabled=true while generating', () => {
      const { getByLabelText } = renderBar({ isGenerating: true });
      expect(
        getByLabelText('Listen to the story so far').props.accessibilityState
          .disabled,
      ).toBe(true);
      expect(
        getByLabelText('Speak your contribution').props.accessibilityState
          .disabled,
      ).toBe(true);
      expect(
        getByLabelText('Type with the keyboard').props.accessibilityState
          .disabled,
      ).toBe(true);
    });

    test('Speak exposes busy=true while isGenerating (spinner surfaces in UI)', () => {
      const { getByLabelText } = renderBar({ isGenerating: true });
      expect(
        getByLabelText('Speak your contribution').props.accessibilityState.busy,
      ).toBe(true);
    });
  });

  describe('5. announceForAccessibility fires on each mode transition', () => {
    test('idle → listening announces "Listening. Speak now."', () => {
      const { getByLabelText } = renderBar();
      announceSpy.mockClear();
      fireEvent.press(getByLabelText('Speak your contribution'));
      expect(announceSpy).toHaveBeenCalledWith('Listening. Speak now.');
    });

    test('listening → reviewing-transcript announces "Review your transcription."', () => {
      const { getByLabelText } = renderBar();
      fireEvent.press(getByLabelText('Speak your contribution'));
      announceSpy.mockClear();
      act(() => {
        (global as any).__lastSpeechResult?.('hello');
      });
      expect(announceSpy).toHaveBeenCalledWith('Review your transcription.');
    });

    test('speakerState="speaking" (mode → playing-tts) announces "Playing story."', () => {
      const { rerender } = renderBar({ speakerState: 'idle' });
      announceSpy.mockClear();
      // Same props object mutation would be invisible — construct a fresh
      // element tree with updated speakerState.
      rerender(<VoiceFirstInputBar {...baseProps()} speakerState="speaking" />);
      expect(announceSpy).toHaveBeenCalledWith('Playing story.');
    });

    test('idle → typing announces "Keyboard open."', () => {
      const { getByLabelText } = renderBar();
      announceSpy.mockClear();
      fireEvent.press(getByLabelText('Type with the keyboard'));
      expect(announceSpy).toHaveBeenCalledWith('Keyboard open.');
    });

    test('idle entry is silent (US-008: no noisy return-to-idle announcement)', () => {
      // Fresh mount lands in 'idle'. The mode effect runs for the initial
      // mount with state.mode === 'idle'; the switch case is intentionally
      // empty, so nothing should be announced.
      announceSpy.mockClear();
      renderBar();
      expect(announceSpy).not.toHaveBeenCalled();
    });
  });

  describe('6. Touch targets exceed 44pt minimum (iOS HIG)', () => {
    test('Speak (primary) is configured to be visibly larger than Listen/Keyboard', () => {
      // These are sourced from theme.voiceFirst.* — we verify the tokens
      // themselves satisfy the HIG floor AND the primary > secondary
      // hierarchy mandated by US-001.
      expect(theme.voiceFirst.primaryButtonSize).toBeGreaterThan(44);
      expect(theme.voiceFirst.secondaryButtonSize).toBeGreaterThan(44);
      expect(theme.voiceFirst.primaryButtonSize).toBeGreaterThan(
        theme.voiceFirst.secondaryButtonSize,
      );
    });

    test('all three buttons render with valid onPress handlers (keyboard-activatable)', () => {
      const { getByLabelText } = renderBar();
      expect(
        getByLabelText('Listen to the story so far').props.onPress,
      ).toBeTruthy();
      expect(
        getByLabelText('Speak your contribution').props.onPress,
      ).toBeTruthy();
      expect(
        getByLabelText('Type with the keyboard').props.onPress,
      ).toBeTruthy();
    });
  });

  describe('7. Focus / navigation order', () => {
    // Walk the toJSON() tree instead of getAllByRole('button'): the TouchableOpacity
    // mock from jest.setup.js exposes accessibilityRole but RNTL's role query can't
    // resolve it (host-component mismatch). DOM traversal is mock-independent and
    // asserts exactly what a screen reader's swipe order would report.
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

    test('tree traversal yields Listen → Speak → Keyboard (VoiceOver swipe direction)', () => {
      const { toJSON } = renderBar();
      const labels = collectButtonLabels(toJSON());
      // Expect the first three labels to be our primary row in this exact order;
      // review-card buttons (Re-record/Edit/Submit) aren't mounted in idle mode.
      expect(labels.slice(0, 3)).toEqual([
        'Listen to the story so far',
        'Speak your contribution',
        'Type with the keyboard',
      ]);
    });
  });

  describe('8. Review card affordances', () => {
    test('Re-record / Edit / Submit each have accessibilityRole="button" and a label', () => {
      const { getByLabelText } = renderBar({ userInput: 'Review me' });
      fireEvent.press(getByLabelText('Speak your contribution'));
      act(() => {
        (global as any).__lastSpeechResult?.('Review me');
      });
      expect(
        getByLabelText('Re-record voice input').props.accessibilityRole,
      ).toBe('button');
      expect(getByLabelText('Edit transcript').props.accessibilityRole).toBe(
        'button',
      );
      expect(getByLabelText('Submit transcript').props.accessibilityRole).toBe(
        'button',
      );
    });
  });
});
