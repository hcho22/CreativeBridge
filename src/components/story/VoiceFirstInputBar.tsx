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
import { theme } from '../../constants/theme';
// US-004: the embedded VoiceInput drives actual speech recognition while we
// stop the TTS engine before entering `listening` mode so the iOS audio
// session isn't captured by playback when the mic tries to start.
import { VoiceInput } from '@/components/common/VoiceInput';
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
      if (state.mode === 'idle') {
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

  // --- US-004: Speak button wiring ----------------------------------------
  //
  // The Speak tap handler must accomplish three things in order:
  //   (a) pre-empt any in-flight TTS so the iOS audio session is released
  //       before the mic tries to claim it — skipping this is the #1 cause
  //       of "speech recognition starts but captures nothing" on device;
  //   (b) dispatch TAP_SPEAK so the reducer flips mode → 'listening'
  //       (or back to 'idle' when tapped again during listening — cancel);
  //   (c) do nothing else: the embedded <VoiceInput autoStart> renders only
  //       when mode === 'listening' and kicks off recording via its own
  //       permission-aware effect (see `autoStart` on VoiceInput).
  //
  // Wrapped in useCallback because the <TouchableOpacity>'s onPress prop
  // identity would otherwise change every render and force children to
  // re-render for no reason.
  const handleSpeakPress = useCallback(() => {
    // Fire-and-forget is safe here: textToSpeechIsolated.stop() internally
    // guards against double-stop and returns quickly on the simulator where
    // TTS is a no-op fallback.
    if (
      props.speakerState === 'speaking' ||
      props.speakerState === 'starting'
    ) {
      textToSpeechService.stop();
    }
    dispatch({ type: 'TAP_SPEAK' });
  }, [props.speakerState]);

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

  const handleEdit = () => {
    dispatch({ type: 'EDIT' });
    // Focus the TextInput mounted by US-007. Deferred one tick so the
    // 'typing' render has committed before we call focus. No-ops safely
    // until US-007 lands (ref will be null).
    setTimeout(() => {
      props.storyInputRef.current?.focus();
    }, 0);
  };

  const handleSubmit = () => {
    // Fire the host's submit (wired to `handleContinueStory` via props per
    // FR-10) first, then transition. If the host wants to guard against
    // double-submit, that's its concern — dispatch is idempotent here.
    props.onSubmit();
    dispatch({ type: 'SUBMIT' });
  };

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
  // `isTranscribing` blocks Speak taps during the Whisper round-trip so the
  // user can't accidentally cancel a transcribe mid-upload (which would
  // unmount VoiceInput and discard the audio).
  const speakDisabled =
    !props.voiceInputEnabled || props.isGenerating || isTranscribing;
  const keyboardDisabled = props.isGenerating;

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
      {/* US-005: Transcript review card — only rendered while reviewing. */}
      {mode === 'reviewing-transcript' && (
        <View style={styles.reviewCard} accessibilityLiveRegion="polite">
          <ScrollView
            style={styles.transcriptScroll}
            nestedScrollEnabled
            showsVerticalScrollIndicator
          >
            <Text style={styles.transcriptText}>{props.userInput}</Text>
          </ScrollView>
          <View style={styles.reviewActions}>
            <TouchableOpacity
              style={styles.reviewSecondaryButton}
              onPress={handleReRecord}
              accessibilityRole="button"
              accessibilityLabel="Re-record voice input"
            >
              <Text style={styles.reviewSecondaryLabel}>Re-record</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.reviewSecondaryButton}
              onPress={handleEdit}
              accessibilityRole="button"
              accessibilityLabel="Edit transcript"
            >
              <Text style={styles.reviewSecondaryLabel}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="continue-story-button"
              style={[
                styles.reviewPrimaryButton,
                submitDisabled && styles.disabledButton,
              ]}
              onPress={handleSubmit}
              disabled={submitDisabled}
              accessibilityRole="button"
              accessibilityLabel="Submit transcript"
            >
              <Text style={styles.reviewPrimaryLabel}>Submit</Text>
            </TouchableOpacity>
          </View>
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
        {/* Listen — LEFT, secondary */}
        <View style={styles.buttonColumn}>
          <TouchableOpacity
            testID="speaker-button"
            style={[
              styles.secondaryButton,
              isListenActive && styles.activeButton,
              listenDisabled && styles.disabledButton,
            ]}
            onPress={props.onSpeakerPress}
            onLongPress={props.onSpeakerLongPress}
            disabled={listenDisabled}
            accessibilityRole="button"
            // US-008: static label — VoiceOver conveys *running* state via the
            // "Playing story." announcement fired by the mode effect above,
            // and the volume-up → stop icon swap handles sighted feedback.
            // Keeping the label static avoids drifting away from the AC's
            // literal string (the validation grep scans for exactly this).
            accessibilityLabel="Listen to the story so far"
            accessibilityState={{
              disabled: listenDisabled,
              selected: isListenActive,
            }}
          >
            <MaterialIcons
              // US-006: mirror HomeScreen.tsx:3373-3377 emoji swap — show a
              // Stop glyph while TTS is actually running, else the speaker
              // icon. Keys off `speakerState` (not `mode`) so the swap tracks
              // the real engine even during the 'starting' → 'speaking'
              // handshake window.
              name={
                props.speakerState === 'speaking' ||
                props.speakerState === 'starting'
                  ? 'stop'
                  : 'volume-up'
              }
              size={28}
              color={theme.colors.text}
            />
          </TouchableOpacity>
          <Text style={styles.secondaryLabel}>Listen</Text>
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
              testID="voice-speak-button"
              style={[
                styles.primaryButton,
                isSpeakActive && styles.activePrimaryButton,
                speakDisabled && styles.disabledButton,
              ]}
              onPress={handleSpeakPress}
              disabled={speakDisabled}
              accessibilityRole="button"
              accessibilityLabel="Speak your contribution"
              // US-008: the hint is what screen readers announce AFTER the
              // label as explanatory text. "Primary input." signals this is
              // the main action relative to Listen / Keyboard; "Double tap
              // to start voice recording." is VoiceOver's own phrasing (a
              // VoiceOver single-finger tap is "double tap" in its model),
              // so users hear guidance that matches their actual gesture.
              accessibilityHint="Primary input. Double tap to start voice recording."
              accessibilityState={{
                disabled: speakDisabled,
                selected: isSpeakActive,
                busy: props.isGenerating,
              }}
            >
              {/*
                US-010 AC #1: while the story engine is generating, swap the
                mic glyph for an ActivityIndicator so the disabled state is
                visually unambiguous (opacity alone reads as "you can tap but
                it'll be greyed" to many users). The spinner uses the same
                primary-green tint as the mic icon so the button's identity
                stays coherent across the swap. `size="large"` matches the
                40pt MaterialIcons footprint visually without needing a
                numeric override.
              */}
              {props.isGenerating || isTranscribing ? (
                <ActivityIndicator
                  size="large"
                  color={theme.colors.primary}
                  accessibilityLabel={
                    isTranscribing
                      ? 'Transcribing your voice'
                      : 'Generating response'
                  }
                />
              ) : (
                <MaterialIcons
                  name="mic"
                  size={40}
                  color={theme.colors.primary}
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
                  isEnabled
                  autoStart
                  onSpeechResult={handleEmbeddedSpeechResult}
                  onError={handleEmbeddedVoiceError}
                  onProcessingStateChange={setIsTranscribing}
                />
              </View>
            )}
          </View>
          <Text style={styles.primaryLabel}>Speak</Text>
        </View>

        {/* Keyboard — RIGHT, secondary */}
        <View style={styles.buttonColumn}>
          <TouchableOpacity
            style={[
              styles.secondaryButton,
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
              size={28}
              color={theme.colors.text}
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
  container: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    // `alignItems: 'center'` is deliberate — because the Speak button is 32pt
    // taller than the secondary buttons, this vertically centers Listen and
    // Keyboard against Speak's midline (see PRD Design Considerations).
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  buttonColumn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // --- Secondary buttons (Listen, Keyboard) ---
  secondaryButton: {
    width: secondaryButtonSize,
    height: secondaryButtonSize,
    borderRadius: secondaryButtonRadius,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadowFor(idleElevation),
  },
  secondaryLabel: {
    marginTop: labelMarginTop,
    fontSize: labelFontSize,
    fontWeight: '500',
    color: theme.colors.text,
  },
  // --- Primary button (Speak) ---
  primaryButton: {
    width: primaryButtonSize,
    height: primaryButtonSize,
    borderRadius: primaryButtonRadius,
    // Resting emphasis: 10% alpha tint of theme.colors.primary (#4CAF50) plus
    // a 2pt primary-colored border. Satisfies FR-11 — the Speak button reads
    // as the primary action even when no mode is active.
    backgroundColor: 'rgba(76, 175, 80, 0.10)',
    borderWidth: 2,
    borderColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadowFor(idleElevation),
  },
  primaryLabel: {
    marginTop: labelMarginTop,
    fontSize: primaryLabelFontSize,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  // --- Active state: scale up + elevated shadow ---
  activeButton: {
    transform: [{ scale: 1.05 }],
    ...shadowFor(activeElevation),
  },
  activePrimaryButton: {
    backgroundColor: 'rgba(76, 175, 80, 0.20)',
    transform: [{ scale: 1.05 }],
    ...shadowFor(activeElevation),
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
    borderColor: theme.colors.primary,
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
  reviewActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  reviewSecondaryButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  reviewSecondaryLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text,
  },
  reviewPrimaryButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    // Primary green background — semantic token, not a hex literal (keeps
    // the button in lockstep with any future brand-color change).
    backgroundColor: theme.colors.primary,
  },
  reviewPrimaryLabel: {
    fontSize: 14,
    fontWeight: '600',
    // `headerText` is the theme's semantic token for "text on primary green"
    // (it's used wherever there's a primary-background surface already).
    color: theme.colors.headerText,
  },
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
    backgroundColor: theme.colors.primary,
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
