/**
 * VoiceFirstInputBar
 *
 * Skeleton for the voice-first input bar shown at the bottom of the game session
 * screen. Exposes a finite-state-machine over the five input modes so downstream
 * user stories (US-003 through US-010) can plug concrete UI into the transitions
 * without re-defining the state shape.
 *
 * State table (full UI comes in subsequent stories):
 *
 *   Current              | Action              | Next
 *   ---------------------+---------------------+----------------------
 *   idle                 | TAP_SPEAK           | listening
 *   idle                 | TAP_LISTEN          | playing-tts
 *   idle                 | TAP_KEYBOARD        | typing
 *   listening            | VOICE_RESULT        | reviewing-transcript
 *   listening            | VOICE_EMPTY         | idle
 *   listening            | TAP_SPEAK (cancel)  | idle
 *   listening            | VOICE_ERROR         | idle
 *   reviewing-transcript | RE_RECORD           | listening
 *   reviewing-transcript | EDIT                | typing
 *   reviewing-transcript | TAP_KEYBOARD        | typing       (US-016)
 *   reviewing-transcript | SUBMIT              | idle
 *   playing-tts          | TTS_COMPLETED       | idle
 *   playing-tts          | TAP_LISTEN (stop)   | idle
 *   typing               | TAP_KEYBOARD        | idle
 *   typing               | SUBMIT              | idle
 *   *                    | RESET               | idle
 *
 * This component intentionally renders only a placeholder <View> in US-002.
 * Concrete UI (buttons, labels, review card, embedded TextInput) is added in
 * US-003+. Theme tokens from US-001 are not referenced here yet.
 */

import React, {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  Keyboard,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { theme } from '../../constants/theme';
// US-004: the embedded VoiceInput drives actual speech recognition while we
// stop the TTS engine before entering `listening` mode so the iOS audio
// session isn't captured by playback when the mic tries to start.
// US-015 (2026-04-15): we now also talk to VoiceInput imperatively via a
// ref, invoking `finalize()` when the user taps the center ↑ button to
// stop recording immediately (bypassing the 2000ms silence-detect window).
import {
  VoiceInput,
  type VoiceInputHandle,
} from '@/components/common/VoiceInput';
import { textToSpeechService } from '../../services/textToSpeechIsolated';

// ============================================================================
// Public types
// ============================================================================

/**
 * The five input modes the bar can be in at any moment. Enforced via a
 * reducer so illegal transitions (e.g. `listening → typing` directly) cannot
 * be dispatched from UI event handlers.
 */
export type InputMode =
  | 'idle'
  | 'listening'
  | 'reviewing-transcript'
  | 'playing-tts'
  | 'typing';

/**
 * Props for `VoiceFirstInputBar`. All handler props are invoked unchanged from
 * their HomeScreen definitions — this component does NOT reimplement any of
 * `handleVoiceResult`, `handleContinueStory`, `handleSpeakerButtonPress`, or
 * `handleSpeakerButtonLongPress`. See FR-10 in the PRD.
 */
export interface VoiceFirstInputBarProps {
  /** Current draft text for this turn. Mirrors HomeScreen's `userInput` state. */
  userInput: string;

  /** Controlled setter for `userInput` (typically `setUserInput`). */
  onUserInputChange: (text: string) => void;

  /**
   * Ref to the embedded TextInput that appears in `typing` mode. Passed through
   * from HomeScreen so existing focus/blur call sites keep working.
   */
  storyInputRef: React.RefObject<TextInput | null>;

  /**
   * Called after voice recognition finalizes with non-empty text. This is
   * HomeScreen's `handleVoiceResult` and preserves the Jan 2026 REPLACE
   * semantics for cumulative partial results — do NOT re-implement.
   */
  onVoiceResult: (text: string) => void;

  /** Master toggle: when false, the Speak button is disabled. */
  voiceInputEnabled: boolean;

  /** HomeScreen's `handleSpeakerButtonPress` — TTS start/stop. */
  onSpeakerPress: () => void;

  /** HomeScreen's `handleSpeakerButtonLongPress` — TTS pause/resume. */
  onSpeakerLongPress: () => void;

  /** Current TTS speaker state, passed through from HomeScreen. */
  speakerState: 'idle' | 'starting' | 'speaking' | 'paused';

  /** Whether the speaker/Listen button is currently usable. */
  canUseSpeaker: boolean;

  /** Called when the user confirms (Submit) — wires to `handleContinueStory`. */
  onSubmit: () => void;

  /** True while the story engine is generating a response. Disables all buttons. */
  isGenerating: boolean;

  /** True when the session is over — the whole bar returns null (US-010). */
  isGameCompleted: boolean;

  /** Affects the keyboard-mode placeholder copy ("Start your story..." vs "Continue the story..."). */
  isUserStarting: boolean;
}

// ============================================================================
// State machine
// ============================================================================

interface VoiceFirstState {
  mode: InputMode;
}

/**
 * Every legal transition in the state table gets a named action. Centralizing
 * them here (rather than in stringly-typed dispatches) means TypeScript will
 * flag any typo'd action name at the dispatch site.
 */
export type VoiceFirstAction =
  | { type: 'TAP_SPEAK' }
  | { type: 'TAP_LISTEN' }
  | { type: 'TAP_KEYBOARD' }
  | { type: 'VOICE_RESULT' }
  | { type: 'VOICE_EMPTY' }
  | { type: 'VOICE_ERROR' }
  | { type: 'RE_RECORD' }
  | { type: 'EDIT' }
  | { type: 'SUBMIT' }
  | { type: 'TTS_STARTED' }
  | { type: 'TTS_COMPLETED' }
  | { type: 'RESET' };

const initialState: VoiceFirstState = { mode: 'idle' };

/**
 * Pure reducer — trivially unit-testable in US-011. Illegal transitions
 * (e.g. dispatching `EDIT` while in `idle`) fall through to the current state
 * unchanged so the UI can't get wedged.
 */
export function voiceFirstReducer(
  state: VoiceFirstState,
  action: VoiceFirstAction,
): VoiceFirstState {
  switch (action.type) {
    case 'RESET':
      return { mode: 'idle' };

    case 'VOICE_ERROR':
      return { mode: 'idle' };

    case 'TAP_SPEAK':
      // From idle: enter listening. From listening: cancel back to idle.
      if (state.mode === 'idle' || state.mode === 'playing-tts') {
        return { mode: 'listening' };
      }
      if (state.mode === 'listening') {
        return { mode: 'idle' };
      }
      return state;

    case 'TAP_LISTEN':
      // From idle: start TTS. From playing-tts: stop → idle.
      if (state.mode === 'idle') {
        return { mode: 'playing-tts' };
      }
      if (state.mode === 'playing-tts') {
        return { mode: 'idle' };
      }
      return state;

    case 'TAP_KEYBOARD':
      // From idle: open typing. From typing: close back to idle.
      // From reviewing-transcript: enter typing mode to edit the transcript
      // (US-016). `userInput` is intentionally NOT mutated here — it still
      // holds the Whisper transcript set by HomeScreen's `onVoiceResult`, so
      // the TextInput renders the transcript pre-filled automatically.
      if (state.mode === 'idle' || state.mode === 'reviewing-transcript') {
        return { mode: 'typing' };
      }
      if (state.mode === 'typing') {
        return { mode: 'idle' };
      }
      return state;

    case 'VOICE_RESULT':
      // Only valid mid-listening; non-empty transcript moves to review.
      if (state.mode === 'listening') {
        return { mode: 'reviewing-transcript' };
      }
      return state;

    case 'VOICE_EMPTY':
      // Empty transcript from voice recognition — snap back to idle.
      if (state.mode === 'listening') {
        return { mode: 'idle' };
      }
      return state;

    case 'RE_RECORD':
      // On the review card, user wants to try again.
      if (state.mode === 'reviewing-transcript') {
        return { mode: 'listening' };
      }
      return state;

    case 'EDIT':
      // On the review card, user wants to edit the transcript via keyboard.
      if (state.mode === 'reviewing-transcript') {
        return { mode: 'typing' };
      }
      return state;

    case 'SUBMIT':
      // From review card or typing mode: contribution sent, return to idle.
      if (state.mode === 'reviewing-transcript' || state.mode === 'typing') {
        return { mode: 'idle' };
      }
      return state;

    case 'TTS_STARTED':
      // Speaker service confirms playback started.
      if (state.mode === 'idle') {
        return { mode: 'playing-tts' };
      }
      return state;

    case 'TTS_COMPLETED':
      // Speaker finished or was stopped externally.
      if (state.mode === 'playing-tts') {
        return { mode: 'idle' };
      }
      return state;

    default: {
      // Exhaustiveness check — if a new action is added to the union but not
      // handled above, TypeScript will flag this line at compile time.
      const _exhaustive: never = action;
      void _exhaustive;
      return state;
    }
  }
}

// ============================================================================
// Component
// ============================================================================

/**
 * US-003: three circular buttons rendered in DOM order
 *   Listen (volume-up)  |  Speak (mic, PRIMARY — larger)  |  Keyboard (keyboard)
 *
 * Sizing comes from `theme.voiceFirst.*` so the primary-vs-secondary size
 * hierarchy is expressed as named tokens (see US-001). The Speak button also
 * carries a resting primary-colored border + 10% alpha tint so its primacy is
 * visible even when no mode is active (FR-11).
 *
 * Dispatch wiring for the buttons is fully live: US-004 wires Speak → listening
 * (via `handleSpeakPress` + embedded `VoiceInput`), US-006 syncs Listen → TTS
 * through the `speakerState` effect, and US-007 wires Keyboard → typing with
 * an embedded `TextInput` + submit arrow mounted above the three round
 * buttons. The typing row stays mounted across all modes (display toggled)
 * so `testID="story-input"` queries resolve from any state.
 */
const VoiceFirstInputBar: React.FC<VoiceFirstInputBarProps> = props => {
  // `dispatch` is consumed by US-005's review-card handlers (Re-record, Edit,
  // Submit) and by US-006's speaker-state sync effect below. US-004 and US-007
  // will add additional dispatch sites.
  const [state, dispatch] = useReducer(voiceFirstReducer, initialState);
  const insets = useSafeAreaInsets();

  // US-013 (Whisper migration, 2026-04-14): after silence auto-finalize or
  // tap-to-stop, the embedded VoiceInput spends ~1–3s uploading audio to
  // Whisper. Bar stays in `listening` mode throughout (the reducer doesn't
  // need a new state for this) but the visual swaps from the pulsing ring
  // to an ActivityIndicator, and Speak is disabled so a second tap can't
  // cancel a transcribe that's already in flight (the user's words would
  // be lost). VoiceInput reports the transition via `onProcessingStateChange`.
  const [isTranscribing, setIsTranscribing] = useState(false);

  // US-015 (2026-04-15): the parent talks to VoiceInput imperatively via
  // this ref so tapping the center ↑ button during listening can stop
  // recording on demand, bypassing the 2000ms silence-detect window. The
  // handle's `finalize()` is idempotent and no-ops if no recording is in
  // flight, so we don't have to guard the call site.
  const voiceInputRef = useRef<VoiceInputHandle>(null);

  // US-015 pre-speech guard: the center ↑ button stays disabled during
  // `listening` until VoiceInput reports at least one above-threshold
  // metering frame. Without this, a user who taps Speak and immediately
  // taps ↑ would ship an empty audio clip to Whisper for no reason.
  // VoiceInput fires `onHasSpokenChange(false)` on every `startListening`
  // and `onHasSpokenChange(true)` the first time the mic hears speech.
  const [hasSpoken, setHasSpoken] = useState(false);

  // 2026-04-15 real-time partials: live transcript streamed from the
  // secondary `@react-native-voice/voice` recognizer while Whisper records
  // in parallel. Display-only — the authoritative final comes from Whisper
  // via `props.onVoiceResult` (which drives `props.userInput`, rendered in
  // the review card). The partial is wiped on every mode transition out of
  // `listening` so a stale preview never leaks into review / idle.
  const [livePartial, setLivePartial] = useState('');
  useEffect(() => {
    if (state.mode !== 'listening' && livePartial) {
      setLivePartial('');
    }
  }, [state.mode, livePartial]);

  // US-013 safety: if the mode leaves `listening` for any reason (cancel,
  // result received, error), make sure the transcribing spinner is off.
  // The embedded VoiceInput normally clears this via its
  // `onProcessingStateChange(false)` call, but an unmount mid-upload skips
  // that — this effect catches that case.
  useEffect(() => {
    if (state.mode !== 'listening' && isTranscribing) {
      setIsTranscribing(false);
    }
  }, [state.mode, isTranscribing]);

  // US-005 / US-006 / US-008: announce mode entries to VoiceOver / TalkBack.
  // Keyed on `state.mode` rather than the dispatching action so every entry
  // path (VOICE_RESULT, TTS_STARTED, TAP_KEYBOARD, TAP_SPEAK, EDIT, RE_RECORD,
  // ...) fires the same announcement — the state machine is the single source
  // of truth for what the user hears. Strings are the AC-mandated copy,
  // including terminal periods, so VoiceOver's intonation engine closes each
  // utterance with a sentence-final fall.
  useEffect(() => {
    switch (state.mode) {
      case 'listening':
        AccessibilityInfo.announceForAccessibility('Listening. Speak now.');
        break;
      case 'reviewing-transcript':
        AccessibilityInfo.announceForAccessibility(
          'Review your transcription.',
        );
        break;
      case 'playing-tts':
        AccessibilityInfo.announceForAccessibility('Playing story.');
        break;
      case 'typing':
        AccessibilityInfo.announceForAccessibility('Keyboard open.');
        break;
      // `idle` intentionally silent — announcing every return-to-idle would be
      // noisy (e.g. immediately after Submit, which is already acknowledged by
      // the host's result toast) and isn't part of US-008's AC.
      case 'idle':
        break;
    }
  }, [state.mode]);

  // US-007: manage the TextInput's focus and the soft keyboard's visibility
  // across typing-mode transitions. Entering `typing` focuses the TextInput on
  // the next tick — the render that reveals the input via `display` must
  // commit before `.current.focus()` is meaningful. Leaving `typing` — whether
  // via Submit, a second Keyboard tap, Edit-from-review, or any future exit —
  // dismisses the soft keyboard. The initial mount (mode='idle') hits the
  // dismiss branch once; it's a safe no-op when no keyboard is open.
  // `storyInputRef` is identity-stable because the host calls `useRef` once,
  // so including it in deps only satisfies exhaustive-deps without churning.
  useEffect(() => {
    if (state.mode === 'typing') {
      const handle = setTimeout(() => {
        props.storyInputRef.current?.focus();
      }, 0);
      return () => clearTimeout(handle);
    }
    Keyboard.dismiss();
  }, [state.mode, props.storyInputRef]);

  // US-006: sync external TTS engine → internal mode. Driving via effect (not
  // optimistic `TAP_LISTEN` dispatch on tap) keeps us in lockstep with the real
  // speaker: if TTS fails to start, `speakerState` stays `'idle'` and we never
  // falsely enter `playing-tts`. `'paused'` is deliberately a no-op so long-
  // press pause/resume keeps the bar in `playing-tts` and the Listen button
  // remains primed to stop with a single tap.
  useEffect(() => {
    const isTtsActive =
      props.speakerState === 'speaking' || props.speakerState === 'starting';
    if (isTtsActive) {
      dispatch({ type: 'TTS_STARTED' });
    } else if (props.speakerState === 'idle') {
      dispatch({ type: 'TTS_COMPLETED' });
    }
  }, [props.speakerState]);

  // Submit — fires the host's submit handler (wired to `handleContinueStory`
  // via props per FR-10) and dispatches SUBMIT. Hoisted above
  // `handleSpeakPress` as a `useCallback` so US-015's center ↑ handler
  // can reach it in `reviewing-transcript` mode without a forward reference.
  // If the host wants to guard against double-submit, that's its concern —
  // dispatch is idempotent for unchanged state.
  const handleSubmit = useCallback(() => {
    props.onSubmit();
    dispatch({ type: 'SUBMIT' });
  }, [props.onSubmit]);

  // --- Speak button wiring (US-004, extended by US-015 on 2026-04-15) -----
  //
  // Behavior branches on the current mode:
  //   · reviewing-transcript → calls `handleSubmit()`. The center button
  //     has already swapped its icon to ↑, so the tap reads visually as
  //     "send." Does NOT dispatch TAP_SPEAK.
  //   · listening → fires a medium-strength haptic pulse FIRST (the
  //     "physical cut-the-mic" moment), then calls `voiceInputRef.current
  //     ?.finalize()` to stop recording immediately and hand the audio to
  //     Whisper. Bypasses the 2000 ms silence-detect window. Does NOT
  //     dispatch TAP_SPEAK — the reducer moves to `reviewing-transcript`
  //     via VOICE_RESULT when Whisper returns.
  //   · idle / playing-tts → existing behavior: pre-empt any in-flight TTS
  //     so the iOS audio session is released before the mic tries to
  //     claim it, then dispatch TAP_SPEAK to flip mode → 'listening'.
  //   · typing → no-op (the center button is visually occluded by the
  //     typing-mode arrow; handler stays defensive).
  //
  // Haptics are fire-and-forget: `expo-haptics` safely no-ops on iOS
  // simulator and on Android devices without a linear-resonant actuator,
  // so we don't need to probe device capability. The `.catch(() => {})`
  // is defense-in-depth against unforeseen native-side rejections.
  //
  // Wrapped in useCallback so the <TouchableOpacity>'s onPress identity
  // stays stable and children don't re-render gratuitously.
  const handleSpeakPress = useCallback(() => {
    if (state.mode === 'reviewing-transcript') {
      handleSubmit();
      return;
    }
    if (state.mode === 'listening') {
      // US-015 AC #5: haptic on stop-recording, NOT on submit. The review-
      // mode submit above deliberately skips this call.
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      voiceInputRef.current?.finalize();
      return;
    }
    // Any other mode (idle / playing-tts): pre-empt TTS, then dispatch
    // TAP_SPEAK. Fire-and-forget is safe: textToSpeechIsolated.stop()
    // internally guards against double-stop and returns quickly on the
    // simulator where TTS is a no-op fallback.
    if (
      props.speakerState === 'speaking' ||
      props.speakerState === 'starting'
    ) {
      textToSpeechService.stop();
    }
    dispatch({ type: 'TAP_SPEAK' });
  }, [state.mode, props.speakerState, handleSubmit]);

  // Bridge from the embedded VoiceInput's `onSpeechResult` into our state
  // machine + the host's `handleVoiceResult`. Empty/whitespace-only results
  // snap back to `idle` with a VoiceOver announcement (matches AC: "If
  // result is empty, dispatches back to `idle` and calls announceFor-
  // Accessibility('I didn't catch that, try again')"). Non-empty results
  // invoke the host's handler first — this is where the Jan 2026 voice-
  // duplication REPLACE-semantics fix lives — then advance mode to
  // `reviewing-transcript` so US-005's card can render.
  const handleEmbeddedSpeechResult = useCallback(
    (text: string) => {
      const trimmed = text?.trim() ?? '';
      if (!trimmed) {
        AccessibilityInfo.announceForAccessibility(
          "I didn't catch that, try again",
        );
        dispatch({ type: 'VOICE_EMPTY' });
        return;
      }
      props.onVoiceResult(trimmed);
      dispatch({ type: 'VOICE_RESULT' });
    },
    [props],
  );

  // Any VoiceInput error (permission denied, native module failure, timeout)
  // snaps us back to idle via the reducer's VOICE_ERROR case. VoiceInput
  // itself shows the user-facing Alert, so we don't need to surface the
  // message — we only need to unwedge the state machine.
  const handleEmbeddedVoiceError = useCallback((_err: string) => {
    dispatch({ type: 'VOICE_ERROR' });
  }, []);

  // Pulsing waveform animation shown around the Speak button while listening.
  // Decorative only (PRD explicitly rules out real-waveform visualization):
  // one ring that scales 1.0 → 1.25 and fades 0.6 → 0 in a 1.2s loop. We
  // drive `useNativeDriver: true` because both transform and opacity are
  // supported on the native thread — keeps the ring smooth even while the
  // JS thread is busy with VoiceInput's partial-result handling.
  const pulseValue = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (state.mode !== 'listening') {
      pulseValue.stopAnimation();
      pulseValue.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(pulseValue, {
        toValue: 1,
        duration: 1200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [state.mode, pulseValue]);

  const pulseScale = pulseValue.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.25],
  });
  const pulseOpacity = pulseValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 0],
  });

  // US-005 review-card handlers. Each combines a required side-effect with
  // the reducer dispatch so state and the outside world stay in lockstep.
  const handleReRecord = () => {
    // Clear the old transcript BEFORE transitioning back to listening so
    // US-004's VoiceInput doesn't see stale text when it remounts.
    props.onUserInputChange('');
    dispatch({ type: 'RE_RECORD' });
  };

  // US-016: `handleEdit` removed — the Keyboard button now owns the Edit
  // role via the reducer's extended `TAP_KEYBOARD` case
  // (reviewing-transcript → typing). The typing-mode focus `useEffect`
  // (see earlier in this component) already focuses the TextInput on every
  // `mode → 'typing'` transition, regardless of source state, so a handler-
  // local `setTimeout(focus, 0)` is unnecessary.

  // US-010: when the session is complete, the bar disappears entirely.
  if (props.isGameCompleted) {
    return null;
  }

  const { mode } = state;

  // Submit is disabled whenever the engine is busy or the session is over.
  // The `isGameCompleted` check is redundant with the early-return above but
  // satisfies US-005's AC literally and survives any future refactor that
  // removes the early-return.
  const submitDisabled = props.isGenerating || props.isGameCompleted;

  // US-007: the typing-mode arrow additionally requires non-empty text —
  // mirrors HomeScreen's existing floatingSubmitButton logic (HomeScreen.tsx:
  // 3388-3391). Keeping `submitDisabled` and `typingSubmitDisabled` distinct
  // is deliberate: the review-card Submit can fire even with empty userInput
  // (the transcript may have been cleared by a race with Re-record), so only
  // the typing arrow guards on `.trim()`.
  const typingSubmitDisabled =
    !props.userInput.trim() || props.isGenerating || props.isGameCompleted;

  // Which round button currently carries "active" styling (elevation + scale).
  // Listen also keys off `speakerState` so the active look stays accurate
  // during the 'starting' → 'speaking' handshake (before `mode` catches up via
  // the US-006 sync effect above).
  const isListenActive =
    mode === 'playing-tts' ||
    props.speakerState === 'speaking' ||
    props.speakerState === 'starting';
  const isSpeakActive = mode === 'listening';
  const isKeyboardActive = mode === 'typing';

  // Disabled logic (visual only at US-003; US-010 refines interactions).
  const listenDisabled = !props.canUseSpeaker || props.isGenerating;
  // US-015 (2026-04-15): the center button's disabled rule is now mode-
  // aware.
  //   · reviewing-transcript → derive from `submitDisabled` (isGenerating
  //     || isGameCompleted). `voiceInputEnabled` and `isTranscribing` are
  //     irrelevant here since the button is a Submit, not a mic tap.
  //   · listening → block until the pre-speech guard fires (hasSpoken)
  //     AND while Whisper is uploading (isTranscribing). Tapping during
  //     transcribing would unmount VoiceInput mid-upload and drop audio.
  //   · all other modes → preserved idle behavior.
  const isReviewing = mode === 'reviewing-transcript';
  const speakDisabled = isReviewing
    ? submitDisabled
    : isSpeakActive
    ? !hasSpoken || isTranscribing
    : !props.voiceInputEnabled || props.isGenerating || isTranscribing;
  const keyboardDisabled = props.isGenerating;

  // US-015 center-button presentation: icon / testID / a11y strings all key
  // off `isReviewing` + `isSpeakActive`. Hoisted out of JSX for
  // readability and so they're grep-able for the US-015 validation tests.
  //
  // 2026-04-15 update: the button now has THREE distinct visual phases —
  // Speak (mic) → Stop (stop icon) → Upload (↑). The stop phase covers
  // both active listening and the Whisper transcribing round-trip (both
  // live under the reducer's `mode === 'listening'`), so a single
  // `centerShowsStop` flag drives both sub-states.
  const centerShowsArrow = isReviewing;
  const centerShowsStop = isSpeakActive;
  const centerTestID = isReviewing
    ? 'continue-story-button'
    : 'voice-speak-button';
  const centerAccessibilityLabel = isReviewing
    ? 'Submit transcript'
    : isSpeakActive
    ? isTranscribing
      ? 'Transcribing your voice'
      : 'Stop recording'
    : 'Speak your contribution';
  const centerAccessibilityHint = isReviewing
    ? 'Tap to send the transcript.'
    : isSpeakActive
    ? isTranscribing
      ? 'Please wait for transcription to finish.'
      : 'Tap to stop recording and begin transcription.'
    : 'Primary input. Double tap to start voice recording.';

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
      {/*
        2026-04-15 live partial transcript. Rendered only while listening so
        the user sees text as they speak (closes the ~1–3s Whisper round-trip
        perceived-latency gap). Styled like the review card so the visual
        handoff to the post-finalize review card is seamless. If the
        `@react-native-voice/voice` recognizer failed to start (iOS mic
        contention, denied recognizer permission) `livePartial` stays empty
        and we fall back to a muted "Listening…" hint rather than an empty
        white rectangle.
      */}
      {mode === 'listening' && (
        <View
          style={styles.livePartialCard}
          accessibilityLiveRegion="polite"
          accessibilityLabel={
            livePartial
              ? `Partial transcript: ${livePartial}`
              : isTranscribing
              ? 'Transcribing your speech'
              : 'Listening for speech'
          }
        >
          <Text
            style={[
              styles.transcriptText,
              !livePartial && styles.livePartialPlaceholder,
            ]}
            numberOfLines={3}
          >
            {/*
              Three-state placeholder copy keyed off `livePartial` +
              `isTranscribing`:
                · partial present         → show the partial text live
                · no partial, not done    → "Listening…" (pre-speech or the
                   Voice recognizer failed to start)
                · no partial, transcribing → "Transcribing…" (user stopped,
                   Whisper round-trip is in flight — accurate text imminent)
              Without the third branch the card would freeze on "Listening…"
              for the 1–3s Whisper window, which is the exact UX bug this
              change was meant to fix.
            */}
            {livePartial || (isTranscribing ? 'Transcribing…' : 'Listening…')}
          </Text>
        </View>
      )}

      {/*
        US-005 / US-016: Transcript review card — only rendered while
        reviewing. Collapsed in US-016 to just the transcript surface: the
        three inline action buttons (Re-record / Edit / Submit) were replaced
        by the contextualized main button row beneath (left slot → Redo,
        right slot → Edit via Keyboard, and — once US-015 lands — center slot
        → Submit-↑). Keeping the three primary round buttons as the only
        action surface preserves the three-button rhythm the user already
        knows and avoids introducing a fourth primary affordance.
      */}
      {mode === 'reviewing-transcript' && (
        <View style={styles.reviewCard} accessibilityLiveRegion="polite">
          <ScrollView
            style={styles.transcriptScroll}
            nestedScrollEnabled
            showsVerticalScrollIndicator
          >
            <Text style={styles.transcriptText}>{props.userInput}</Text>
          </ScrollView>
        </View>
      )}

      {/*
        US-007: Typing-mode TextInput + submit arrow.

        The wrapper stays MOUNTED across every mode (visibility toggled via
        `display`) so tests querying `testID="story-input"` — including the
        existing performance suite — resolve regardless of the bar's state.
        See PRD AC #9 for the mounting requirement.

        The submit arrow, by contrast, is conditionally rendered ONLY inside
        `typing` mode. This is intentional: `testID="continue-story-button"`
        is also owned by the review card's Submit button, and React Native
        Testing Library's `getByTestId` does not respect `display: 'none'`.
        Rendering the arrow only when mode === 'typing' keeps the two testIDs
        mutually exclusive (typing and reviewing-transcript are disjoint
        modes per the state table).
      */}
      <View style={[styles.typingRow, mode !== 'typing' && styles.hidden]}>
        <TextInput
          ref={props.storyInputRef}
          testID="story-input"
          style={styles.floatingTextInput}
          placeholder={
            props.isUserStarting
              ? 'Start your story...'
              : 'Continue the story...'
          }
          placeholderTextColor="#999"
          multiline
          value={props.userInput}
          onChangeText={props.onUserInputChange}
          editable={!props.isGenerating && !props.isGameCompleted}
        />
        {mode === 'typing' && (
          <TouchableOpacity
            testID="continue-story-button"
            style={[
              styles.typingSubmitButton,
              typingSubmitDisabled && styles.typingSubmitButtonDisabled,
            ]}
            // Reuses US-005's handleSubmit — the reducer's SUBMIT case already
            // handles both `reviewing-transcript → idle` AND `typing → idle`,
            // so one handler covers both surfaces. On typing-mode SUBMIT the
            // focus/dismiss effect above then dismisses the soft keyboard
            // automatically (AC #7).
            onPress={handleSubmit}
            disabled={typingSubmitDisabled}
            accessibilityRole="button"
            accessibilityLabel="Submit story contribution"
          >
            <Text style={styles.typingSubmitText}>↑</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.buttonRow}>
        {/*
          LEFT slot.
          · Default modes (idle / playing-tts / listening / typing): acts as
            the Listen/TTS control (US-003 / US-006).
          · `reviewing-transcript` (US-016): re-skins as "Redo" — a primary
            re-record affordance sitting in the same geometric slot so the
            user's muscle memory for "leftmost = secondary action" stays
            intact. Icon swaps to `refresh`, label swaps to "Redo",
            onPress → `handleReRecord` (clears `props.userInput` +
            dispatches RE_RECORD), onLongPress is intentionally undefined
            (TTS pause/resume semantics do not apply here), and disabled is
            derived from `submitDisabled` rather than `listenDisabled`.
        */}
        <View style={styles.buttonColumn}>
          <TouchableOpacity
            testID="speaker-button"
            style={[
              styles.secondaryButton,
              styles.listenButton,
              // Only apply the TTS-active styling outside review mode —
              // during review the button is semantically "Redo", so there
              // is no "active TTS" state for it to reflect.
              mode !== 'reviewing-transcript' &&
                isListenActive &&
                styles.activeButton,
              (mode === 'reviewing-transcript'
                ? submitDisabled
                : listenDisabled) && styles.disabledButton,
            ]}
            onPress={
              mode === 'reviewing-transcript'
                ? handleReRecord
                : props.onSpeakerPress
            }
            // Explicitly pass `undefined` during review so the default long-
            // press TTS pause/resume doesn't leak into the Redo context.
            onLongPress={
              mode === 'reviewing-transcript'
                ? undefined
                : props.onSpeakerLongPress
            }
            disabled={
              mode === 'reviewing-transcript' ? submitDisabled : listenDisabled
            }
            accessibilityRole="button"
            // US-008: static label outside review mode — VoiceOver conveys
            // *running* state via the "Playing story." announcement fired by
            // the mode effect above, and the volume-up → stop icon swap
            // handles sighted feedback. US-016: review mode gets the
            // dedicated "Redo voice input" label.
            accessibilityLabel={
              mode === 'reviewing-transcript'
                ? 'Redo voice input'
                : 'Listen to the story so far'
            }
            accessibilityState={
              mode === 'reviewing-transcript'
                ? { disabled: submitDisabled }
                : {
                    disabled: listenDisabled,
                    selected: isListenActive,
                  }
            }
          >
            <MaterialIcons
              // US-006: mirror HomeScreen.tsx:3373-3377 emoji swap — show a
              // Stop glyph while TTS is actually running, else the speaker
              // icon. Keys off `speakerState` (not `mode`) so the swap tracks
              // the real engine even during the 'starting' → 'speaking'
              // handshake window.
              // US-016: in review mode, swap to `refresh` to match the Redo
              // semantics (re-record the transcript from scratch).
              name={
                mode === 'reviewing-transcript'
                  ? 'refresh'
                  : props.speakerState === 'speaking' ||
                    props.speakerState === 'starting'
                  ? 'stop'
                  : 'volume-up'
              }
              size={32}
              color={theme.colors.ink.base}
            />
          </TouchableOpacity>
          <Text style={styles.secondaryLabel}>
            {mode === 'reviewing-transcript' ? 'Redo' : 'Listen'}
          </Text>
        </View>

        {/* Speak — CENTER, PRIMARY (visibly larger) */}
        <View style={styles.buttonColumn}>
          {/*
            Wrap Speak in a relative container so we can absolutely-position
            (a) the US-004 pulsing ring UNDER the TouchableOpacity and
            (b) the embedded VoiceInput that drives real recording. The
            ring uses `pointerEvents="none"` so taps still land on Speak.
          */}
          <View style={styles.speakWrap}>
            {isSpeakActive && (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.speakPulse,
                  {
                    transform: [{ scale: pulseScale }],
                    opacity: pulseOpacity,
                  },
                ]}
              />
            )}
            <TouchableOpacity
              // US-015 (2026-04-15): testID migrates to `continue-story-button`
              // during reviewing-transcript so existing E2E / integration tests
              // that target "whatever button commits the turn" keep resolving
              // (see US-017 note in the PRD). Retains `voice-speak-button` in
              // every other mode so idle / listening / typing tests are
              // unaffected.
              testID={centerTestID}
              style={[
                styles.primaryButton,
                isSpeakActive && styles.activePrimaryButton,
                // US-006 fix: solid foxglove + 30% opacity from
                // `disabledButton` was reading as a peachy-tan, easy to
                // mistake for "still active." Swap in a desaturated
                // ink-faint surface during the listening+transcribing
                // window so the disabled state is unambiguous.
                isSpeakActive && isTranscribing && styles.transcribingButton,
                speakDisabled && styles.disabledButton,
              ]}
              onPress={handleSpeakPress}
              disabled={speakDisabled}
              accessibilityRole="button"
              // US-015: a11y copy is mode-aware. Idle/playing-tts keeps the
              // US-008 "Speak your contribution" / "Primary input. Double tap
              // to start voice recording." phrasing; listening and
              // reviewing-transcript flip to Submit-facing copy since the
              // button's meaning is "commit this."
              accessibilityLabel={centerAccessibilityLabel}
              accessibilityHint={centerAccessibilityHint}
              accessibilityState={{
                disabled: speakDisabled,
                selected: isSpeakActive,
                busy: props.isGenerating,
              }}
            >
              {/*
                Icon precedence:
                  1. Spinner during isGenerating (post-submit AI generation —
                     no user-recoverable stop action, so loading state is
                     appropriate). Opaque enough that users never mistake the
                     state for "tappable."
                  2. ↑ arrow-upward during reviewing-transcript (US-015) —
                     tap to submit. Same size/color as the mic so the
                     button's footprint stays constant across the swap.
                  3. Stop (filled square) during listening AND transcribing
                     (2026-04-15). The stop icon during transcribing is
                     intentionally rendered disabled (see `speakDisabled`)
                     so the glyph is consistent but non-interactive while
                     Whisper is in flight — a "can't stop this now" hint.
                  4. mic icon in every other mode.
              */}
              {props.isGenerating ? (
                <ActivityIndicator
                  size="large"
                  color={theme.colors.paper.cream}
                  accessibilityLabel="Generating response"
                />
              ) : centerShowsArrow ? (
                <MaterialIcons
                  name="arrow-upward"
                  size={40}
                  color={theme.colors.paper.cream}
                />
              ) : centerShowsStop && isTranscribing ? (
                // US-006 fix: spinner instead of stop glyph during the
                // Whisper round-trip so the user sees clear "processing"
                // feedback. Mirrors the isGenerating spinner pattern.
                <ActivityIndicator
                  size="large"
                  color={theme.colors.paper.cream}
                  accessibilityLabel="Transcribing your speech"
                />
              ) : centerShowsStop ? (
                <MaterialIcons
                  name="stop"
                  size={40}
                  color={theme.colors.paper.cream}
                />
              ) : (
                <MaterialIcons
                  name="mic"
                  size={40}
                  color={theme.colors.paper.cream}
                />
              )}
            </TouchableOpacity>
            {/*
              US-004: mount the embedded VoiceInput only while listening.
              `autoStart` makes recording begin as soon as permissions and
              `isEnabled` are true — so a single Speak tap is enough. We
              hide it off-screen (pointerEvents='none', zero footprint) so
              its TouchableOpacity doesn't compete with the Speak visual
              above; users interact with Speak, not with this mount.
            */}
            {isSpeakActive && (
              <View style={styles.hiddenVoiceInput} pointerEvents="none">
                <VoiceInput
                  // US-015: `ref` exposes `VoiceInput.finalize()` so the
                  // center ↑ handler can stop recording immediately.
                  // `onHasSpokenChange` drives the pre-speech guard on the
                  // button (disabled until the first speech-level metering
                  // frame arrives from the recorder).
                  ref={voiceInputRef}
                  isEnabled
                  autoStart
                  onSpeechResult={handleEmbeddedSpeechResult}
                  onError={handleEmbeddedVoiceError}
                  onProcessingStateChange={setIsTranscribing}
                  onPartialResult={setLivePartial}
                  onHasSpokenChange={setHasSpoken}
                />
              </View>
            )}
          </View>
          <Text style={styles.primaryLabel}>
            {centerShowsArrow
              ? 'Upload'
              : centerShowsStop
              ? isTranscribing
                ? 'Transcribing…'
                : 'Stop'
              : 'Speak'}
          </Text>
        </View>

        {/* Keyboard — RIGHT, secondary */}
        <View style={styles.buttonColumn}>
          <TouchableOpacity
            style={[
              styles.secondaryButton,
              styles.keyboardButton,
              isKeyboardActive && styles.activeButton,
              keyboardDisabled && styles.disabledButton,
            ]}
            // US-007: toggle typing mode. The reducer's TAP_KEYBOARD case
            // handles BOTH directions (idle → typing and typing → idle), so
            // a single action covers both "open textbox" and "close textbox
            // via the Keyboard button itself". The focus/dismiss effect takes
            // care of calling focus / Keyboard.dismiss as mode transitions.
            onPress={() => dispatch({ type: 'TAP_KEYBOARD' })}
            disabled={keyboardDisabled}
            accessibilityRole="button"
            accessibilityLabel="Type with the keyboard"
            accessibilityState={{
              disabled: keyboardDisabled,
              selected: isKeyboardActive,
            }}
          >
            <MaterialIcons
              name="keyboard"
              size={32}
              color={theme.colors.ink.base}
            />
          </TouchableOpacity>
          <Text style={styles.secondaryLabel}>Keyboard</Text>
        </View>
      </View>
    </View>
  );
};

// ============================================================================
// Styles
// ============================================================================

const {
  primaryButtonSize,
  secondaryButtonSize,
  primaryButtonRadius,
  secondaryButtonRadius,
  idleElevation,
  activeElevation,
  labelFontSize,
  primaryLabelFontSize,
  labelMarginTop,
} = theme.voiceFirst;

// Helper keeping Android `elevation` and iOS `shadow*` in sync per button
// depth tier. Kept inline (not exported) — only this component uses it.
const shadowFor = (elevation: number) => ({
  elevation,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: Math.max(1, Math.round(elevation / 2)) },
  shadowOpacity: 0.12,
  shadowRadius: elevation,
});

const styles = StyleSheet.create({
  // US-006: dock chrome — paper-cream rounded card with paper-edge border
  // (cf. /tmp/cb_design/components/screens-app.jsx:212-217). The lift shadow
  // floats the dock above the story page underneath.
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 8,
    backgroundColor: theme.colors.paper.cream,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.paper.edge,
    ...shadowFor(idleElevation),
  },
  buttonRow: {
    flexDirection: 'row',
    // `alignItems: 'center'` is deliberate — because the Speak button is 18pt
    // taller than the secondary buttons (96 vs 78), this vertically centers
    // Listen and Keyboard against Speak's midline (see PRD Design Considerations).
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  buttonColumn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // --- Secondary buttons (Listen, Keyboard) ---
  // US-006: hue-tinted soft disc per design DockButton (hue 210 = Listen,
  // hue 120 = Keyboard). Specific tints live in `listenButton` / `keyboardButton`
  // below; this base style holds dimensions + border + shadow.
  secondaryButton: {
    width: secondaryButtonSize,
    height: secondaryButtonSize,
    borderRadius: secondaryButtonRadius,
    backgroundColor: theme.colors.paper.card,
    borderWidth: 1.5,
    borderColor: theme.colors.paper.edge,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadowFor(idleElevation),
  },
  // Listen — hue 210 (storybook blue tint).
  listenButton: {
    backgroundColor: '#DCE6F0',
    borderColor: '#A8BED4',
  },
  // Keyboard — hue 120 (storybook green tint).
  keyboardButton: {
    backgroundColor: '#DDE8D0',
    borderColor: '#AAC09A',
  },
  secondaryLabel: {
    marginTop: labelMarginTop,
    fontSize: labelFontSize,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily.uiSemibold,
    color: theme.colors.ink.soft,
  },
  // --- Primary button (Speak) ---
  // US-006: foxglove fill with darker foxglove border + lifted shadow.
  // The full radial-gradient from screens-app.jsx:321 is approximated as a
  // solid foxglove since RN's StyleSheet doesn't natively render OKLCH radial
  // gradients (PRD §9 deviation precedent — same call as US-002 Watercolor).
  primaryButton: {
    width: primaryButtonSize,
    height: primaryButtonSize,
    borderRadius: primaryButtonRadius,
    backgroundColor: theme.colors.accents.foxglove,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadowFor(activeElevation),
  },
  primaryLabel: {
    marginTop: labelMarginTop,
    fontSize: primaryLabelFontSize,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily.uiSemibold,
    color: theme.colors.accents.foxglove,
  },
  // --- Active state: scale up + elevated shadow ---
  activeButton: {
    transform: [{ scale: 1.05 }],
    ...shadowFor(activeElevation),
  },
  activePrimaryButton: {
    backgroundColor: '#9A2F08', // Foxglove pressed — 10% darker
    transform: [{ scale: 1.05 }],
    ...shadowFor(activeElevation),
  },
  // US-006 fix: distinct surface during the listening+transcribing window.
  // Desaturated ink-faint background communicates "processing, please wait"
  // unambiguously — the previous foxglove-at-30%-opacity composition
  // composited as a peachy tan that read as "still tappable."
  transcribingButton: {
    backgroundColor: theme.colors.ink.faint,
    transform: [{ scale: 1.0 }],
    ...shadowFor(idleElevation),
  },
  // --- Disabled state (matches floatingIconButtonDisabled convention) ---
  disabledButton: {
    opacity: 0.3,
  },
  // --- US-004: Speak button container + pulsing listening ring ---
  // `speakWrap` is a positioning context so `speakPulse` and the hidden
  // VoiceInput can overlay the Speak button without affecting layout of
  // the neighboring Listen / Keyboard columns.
  speakWrap: {
    width: primaryButtonSize,
    height: primaryButtonSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Decorative pulsing ring shown while mode === 'listening'. Positioned
  // underneath the Speak TouchableOpacity (so the icon remains crisply on
  // top) and slightly larger than the button so the scale-up is visible
  // beyond the button's edge.
  speakPulse: {
    position: 'absolute',
    width: primaryButtonSize,
    height: primaryButtonSize,
    borderRadius: primaryButtonRadius,
    borderWidth: 3,
    borderColor: theme.colors.accents.foxglove,
    backgroundColor: 'transparent',
  },
  // The embedded VoiceInput is a behavioral mount only — its TouchableOpacity
  // must not intercept taps meant for Speak, and its default text/emoji
  // button must not be visible. We position it absolute + zero-opacity so
  // React Native still commits it (required so its `autoStart` useEffect
  // runs) but it contributes no pixels.
  hiddenVoiceInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
  },
  // --- US-005: Transcript review card ---
  // Hex '#F9F9F9' is mandated verbatim by the PRD's AC ("Card styling:
  // backgroundColor: #F9F9F9, borderRadius: 12, padding 12"). Kept inline
  // rather than promoted to theme.colors because it's a one-off neutral
  // surface shade that exists only for this card's visual spec.
  reviewCard: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8, // 8px gap above the three-button row, per AC.
  },
  // Live partial card: mirrors `reviewCard` metrics so the handoff from
  // "speaking" (this card) to "reviewing" (the review card below) is
  // visually continuous — same padding, radius, and row spacing above the
  // buttons. Slightly softer background separates it from the finalized
  // transcript state.
  livePartialCard: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    minHeight: 48,
  },
  livePartialPlaceholder: {
    fontStyle: 'italic',
    // `textSecondary` is the theme's semantic token for subordinate text
    // (same shade used for field hints). Matches the "not-yet-spoken" feel
    // we want for the pre-partial placeholder — reads as inactive without
    // feeling disabled.
    color: theme.colors.textSecondary,
  },
  transcriptScroll: {
    // ~4 visible lines at fontSize 16 + lineHeight 22 → 88pt. Any overflow
    // scrolls vertically (nestedScrollEnabled above keeps gesture priority
    // correct when this card sits inside a scrollable parent).
    maxHeight: 88,
  },
  transcriptText: {
    fontSize: 16,
    lineHeight: 22,
    color: theme.colors.text,
  },
  // US-016: the inline review card button row and its five associated
  // styles were removed alongside the three inline action buttons. The
  // review-mode actions now live on the three main round buttons (Redo on
  // the left slot, Edit on the Keyboard slot, and once US-015 lands,
  // Submit-↑ on the center slot) so no dedicated inline button styles
  // are needed.

  // --- US-007: Typing-mode TextInput row + submit arrow ---
  // Row sits ABOVE the three round buttons (which remain visible during
  // typing per the user's one-tap mode-switch UX decision). `alignItems:
  // 'flex-end'` pins the submit arrow to the bottom of the row so it stays
  // anchored as the multiline TextInput grows up to its maxHeight.
  typingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 4,
    marginBottom: 12,
    gap: 8,
  },
  // Mirrors HomeScreen's legacy `floatingTextInput` (HomeScreen.tsx:3907) for
  // the four properties PRD US-007 AC #4 requires to match: minHeight 36,
  // maxHeight 120, fontSize 18, ArchitectsDaughter_400Regular. `flex: 1` is
  // added so the input fills the row beside the submit arrow — the legacy
  // HomeScreen layout put input and buttons on separate rows so no flex was
  // needed there. Color points at `theme.colors.text` instead of the legacy
  // '#333' literal so the input tracks any future brand-text change.
  floatingTextInput: {
    flex: 1,
    minHeight: 36,
    maxHeight: 120,
    fontSize: 18,
    fontFamily: 'ArchitectsDaughter_400Regular',
    color: theme.colors.text,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  // Matches HomeScreen's `floatingSubmitButton` (HomeScreen.tsx:3938) — 36pt
  // pill, primary green, white up-arrow glyph. Deliberately smaller than the
  // three round action buttons (64 / 96pt) so it reads as the typing-surface
  // affordance rather than a primary mode switch.
  typingSubmitButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.accents.foxglove,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Uses `theme.colors.disabled` (#cccccc) instead of the legacy '#ccc'
  // literal so the disabled look tracks the theme's disabled semantic token.
  typingSubmitButtonDisabled: {
    backgroundColor: theme.colors.disabled,
  },
  typingSubmitText: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.headerText,
  },
  // Keeps the typing row mounted but visually hidden so `testID="story-input"`
  // queries resolve from any mode (see PRD US-007 AC #9). `display: 'none'`
  // removes layout participation (no phantom whitespace) while preserving
  // the node in the render tree for RNTL queries.
  hidden: {
    display: 'none',
  },
});

export default VoiceFirstInputBar;
