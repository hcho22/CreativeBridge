/**
 * US-011: Unit tests for the Voice-First Input Bar mode reducer.
 *
 * The PRD (`.claude/.agent/Tasks/prd-voice-first-input-bar.md`) asks for
 * every transition in the state table to be exercised, plus two render-level
 * invariants (disabled propagation from `isGenerating`, and `null` render
 * when `isGameCompleted`). We split the suite accordingly:
 *
 *   1. `voiceFirstReducer` — pure-function tests, one per transition. The
 *      reducer is exported specifically for this purpose (see US-002 ACs).
 *   2. `VoiceFirstInputBar` — render + fireEvent tests for the props that
 *      affect the JSX tree, not the reducer.
 *
 * External collaborators are mocked: `VoiceInput` (speech recognition
 * component) and `textToSpeechService` (TTS engine) have real-device side
 * effects that we don't want crossing the test boundary. `react-native-
 * safe-area-context` is stubbed to keep `useSafeAreaInsets` synchronous
 * and deterministic.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

// -- Mocks -----------------------------------------------------------------

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }: any) => children,
}));

// Override the global `MaterialIcons` mock from jest.setup.js. The global
// mock returns `Text(props.name)` as a plain function call, but the same
// setup.js stubs `react-native.Text` as the string `'Text'` — which is
// not callable and crashes under react-test-renderer. Returning a string
// sidesteps the crash while still rendering a stable placeholder node.
jest.mock('react-native-vector-icons/MaterialIcons', () => 'MaterialIcons');

// The global `react-native` mock (jest.setup.js) declares
// `AccessibilityInfo` without `announceForAccessibility`, which the
// component calls in its mode-effect. Patch the method onto the already-
// mocked module rather than re-declaring the whole RN mock — that way
// the rest of the global mocks (StyleSheet, TouchableOpacity, etc.)
// stay intact.
const RN = jest.requireMock('react-native');
if (RN?.AccessibilityInfo) {
  RN.AccessibilityInfo.announceForAccessibility = jest.fn();
}

// The global `Animated.loop(...)` mock returns only `{ start }`. The SUT's
// pulse-animation cleanup calls `.stop()` on teardown (see US-004), so we
// patch a no-op `stop` onto the mock to avoid a TypeError during unmount.
if (RN?.Animated?.loop) {
  RN.Animated.loop = jest.fn(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    reset: jest.fn(),
  }));
}

// Stubbed VoiceInput — the component under test passes it props, but we
// never want the real speech-recognition pipeline to fire from a Jest run.
jest.mock('@/components/common/VoiceInput', () => ({
  VoiceInput: () => null,
}));

// Stubbed TTS service — only `.stop()` is referenced in the code paths we
// exercise here. Keeping this a plain jest.fn() lets future tests assert
// call counts without widening the mock later.
jest.mock('../../services/textToSpeechIsolated', () => ({
  textToSpeechService: {
    stop: jest.fn(),
    speak: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
  },
}));

// -- SUT imports (after mocks) --------------------------------------------

import VoiceFirstInputBar, {
  voiceFirstReducer,
  type VoiceFirstAction,
  type InputMode,
  type VoiceFirstInputBarProps,
} from '../../components/story/VoiceFirstInputBar';

// -- Reducer tests ---------------------------------------------------------

describe('voiceFirstReducer', () => {
  // Helper keeps each transition test to a single line and makes the table
  // visually line up with the state table in the PRD.
  const step = (mode: InputMode, action: VoiceFirstAction): InputMode =>
    voiceFirstReducer({ mode }, action).mode;

  describe('from idle', () => {
    it('TAP_SPEAK transitions idle → listening', () => {
      expect(step('idle', { type: 'TAP_SPEAK' })).toBe('listening');
    });

    it('TAP_LISTEN transitions idle → playing-tts', () => {
      expect(step('idle', { type: 'TAP_LISTEN' })).toBe('playing-tts');
    });

    it('TAP_KEYBOARD transitions idle → typing', () => {
      expect(step('idle', { type: 'TAP_KEYBOARD' })).toBe('typing');
    });

    it('TTS_STARTED transitions idle → playing-tts', () => {
      expect(step('idle', { type: 'TTS_STARTED' })).toBe('playing-tts');
    });

    it('EDIT dispatched from idle is a no-op (illegal transition)', () => {
      expect(step('idle', { type: 'EDIT' })).toBe('idle');
    });
  });

  describe('from listening', () => {
    it('VOICE_RESULT transitions listening → reviewing-transcript', () => {
      expect(step('listening', { type: 'VOICE_RESULT' })).toBe(
        'reviewing-transcript',
      );
    });

    it('VOICE_EMPTY transitions listening → idle (empty transcript)', () => {
      expect(step('listening', { type: 'VOICE_EMPTY' })).toBe('idle');
    });

    it('TAP_SPEAK transitions listening → idle (cancel)', () => {
      expect(step('listening', { type: 'TAP_SPEAK' })).toBe('idle');
    });

    it('VOICE_ERROR transitions listening → idle', () => {
      expect(step('listening', { type: 'VOICE_ERROR' })).toBe('idle');
    });
  });

  describe('from reviewing-transcript', () => {
    it('RE_RECORD transitions reviewing-transcript → listening', () => {
      expect(step('reviewing-transcript', { type: 'RE_RECORD' })).toBe(
        'listening',
      );
    });

    it('EDIT transitions reviewing-transcript → typing', () => {
      expect(step('reviewing-transcript', { type: 'EDIT' })).toBe('typing');
    });

    it('SUBMIT transitions reviewing-transcript → idle', () => {
      expect(step('reviewing-transcript', { type: 'SUBMIT' })).toBe('idle');
    });
  });

  describe('from playing-tts', () => {
    it('TAP_LISTEN transitions playing-tts → idle (stop)', () => {
      expect(step('playing-tts', { type: 'TAP_LISTEN' })).toBe('idle');
    });

    it('TTS_COMPLETED transitions playing-tts → idle', () => {
      expect(step('playing-tts', { type: 'TTS_COMPLETED' })).toBe('idle');
    });

    it('TAP_SPEAK pre-empts TTS and transitions playing-tts → listening', () => {
      // The in-component handler also calls `textToSpeechService.stop()`
      // prior to dispatching, but the reducer alone must still drive the
      // state change so the UI updates regardless of whether the host
      // forgets to pre-empt.
      expect(step('playing-tts', { type: 'TAP_SPEAK' })).toBe('listening');
    });
  });

  describe('from typing', () => {
    it('TAP_KEYBOARD transitions typing → idle (toggle close)', () => {
      expect(step('typing', { type: 'TAP_KEYBOARD' })).toBe('idle');
    });

    it('SUBMIT transitions typing → idle', () => {
      expect(step('typing', { type: 'SUBMIT' })).toBe('idle');
    });
  });

  describe('RESET and illegal transitions', () => {
    it.each<InputMode>([
      'idle',
      'listening',
      'reviewing-transcript',
      'playing-tts',
      'typing',
    ])('RESET from %s always lands on idle', mode => {
      expect(step(mode, { type: 'RESET' })).toBe('idle');
    });

    it('SUBMIT from idle is a no-op (illegal transition)', () => {
      expect(step('idle', { type: 'SUBMIT' })).toBe('idle');
    });

    it('VOICE_RESULT dispatched outside listening is a no-op', () => {
      expect(step('typing', { type: 'VOICE_RESULT' })).toBe('typing');
    });

    it('TTS_COMPLETED dispatched outside playing-tts is a no-op', () => {
      expect(step('listening', { type: 'TTS_COMPLETED' })).toBe('listening');
    });
  });
});

// -- Component render tests ------------------------------------------------

describe('VoiceFirstInputBar component', () => {
  // Minimal props satisfying the interface — individual tests override the
  // fields they care about. Using a factory keeps each test's intent local
  // without repeating the full 13-field prop bag.
  const makeProps = (
    overrides: Partial<VoiceFirstInputBarProps> = {},
  ): VoiceFirstInputBarProps => ({
    userInput: '',
    onUserInputChange: jest.fn(),
    storyInputRef: { current: null },
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
    ...overrides,
  });

  it('renders null when isGameCompleted is true', () => {
    const { toJSON } = render(
      <VoiceFirstInputBar {...makeProps({ isGameCompleted: true })} />,
    );
    // `null` renders produce a null JSON tree — the session-over early return
    // at VoiceFirstInputBar.tsx:473 removes the entire bar from the layout.
    expect(toJSON()).toBeNull();
  });

  it('renders the three round buttons in the default idle state', () => {
    const { getByLabelText } = render(<VoiceFirstInputBar {...makeProps()} />);
    expect(getByLabelText('Listen to the story so far')).toBeTruthy();
    expect(getByLabelText('Speak your contribution')).toBeTruthy();
    expect(getByLabelText('Type with the keyboard')).toBeTruthy();
  });

  it('disables every round button when isGenerating is true', () => {
    const { getByLabelText } = render(
      <VoiceFirstInputBar {...makeProps({ isGenerating: true })} />,
    );

    const listen = getByLabelText('Listen to the story so far');
    const speak = getByLabelText('Speak your contribution');
    const keyboard = getByLabelText('Type with the keyboard');

    // `disabled` prop on TouchableOpacity is the source of truth for tap
    // suppression. The accessibilityState mirrors it for assistive tech.
    expect(listen.props.accessibilityState).toMatchObject({ disabled: true });
    expect(speak.props.accessibilityState).toMatchObject({ disabled: true });
    expect(keyboard.props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('disables Listen when canUseSpeaker is false even if not generating', () => {
    // Confirms the disabled propagation is per-button, not just global.
    const { getByLabelText } = render(
      <VoiceFirstInputBar {...makeProps({ canUseSpeaker: false })} />,
    );
    expect(
      getByLabelText('Listen to the story so far').props.accessibilityState,
    ).toMatchObject({ disabled: true });
    expect(
      getByLabelText('Type with the keyboard').props.accessibilityState,
    ).toMatchObject({ disabled: false });
  });

  it('Speak tap invokes textToSpeechService.stop() when speakerState is speaking', () => {
    // Integration-ish check on the TTS pre-emption contract from FR-7:
    // tapping Speak while TTS is playing must stop TTS before entering
    // listening mode. Pulled from the imported mock module.
    const {
      textToSpeechService,
    } = require('../../services/textToSpeechIsolated');
    (textToSpeechService.stop as jest.Mock).mockClear();

    const { getByLabelText } = render(
      <VoiceFirstInputBar {...makeProps({ speakerState: 'speaking' })} />,
    );

    fireEvent.press(getByLabelText('Speak your contribution'));
    expect(textToSpeechService.stop).toHaveBeenCalledTimes(1);
  });
});
