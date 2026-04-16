/**
 * VoiceInput — Whisper-backed voice recognition for the voice-first input
 * bar (US-013).
 *
 * **History**: previously wrapped `@react-native-voice/voice` /
 * `SFSpeechRecognizer` with a 2000+-line state machine that tried to work
 * around iOS's aggressive "search-mode" VAD auto-finalization by restarting
 * the recognizer mid-sentence. That approach leaked audio across
 * `AVAudioSession` transitions and couldn't capture sentences longer than
 * ~1–2s reliably (the user's log showed "In the twinkling expanse of the
 * Cosmic Carnival" truncating to "In Lots of"). Per the 2026-04-14 decision,
 * we replaced that stack with `whisperTranscriptionService`: the mic records
 * to a temp file via `expo-av`, silence-auto-finalize triggers upload to
 * OpenAI Whisper through the Convex `transcribeAudio` action, and the
 * server-returned transcript fires `onSpeechResult`. No more partial
 * accumulation, no restart loop, no stale-echo guards.
 *
 * **Tradeoff**: no live partial transcripts. The consumer sees a brief
 * `processing` state (~1–3s Whisper round-trip) before the transcript
 * lands. The host (`VoiceFirstInputBar`) can swap its pulsing ring to a
 * spinner via the `onProcessingStateChange` prop.
 *
 * **Silence detection**: expo-av emits metering (dB) updates every 100ms.
 * We auto-finalize when the audio has been below `SILENCE_DB_THRESHOLD`
 * for `silenceTimeout` ms *after* we've seen at least one speech-level
 * reading (prevents finalize-before-speech when the mic is still warming
 * up on iOS).
 */

import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { theme } from '../../constants/theme';
import { whisperTranscriptionService } from '../../services/whisperTranscriptionService';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

interface VoiceInputProps {
  onSpeechResult: (text: string) => void;
  isEnabled: boolean;
  onError?: (error: string) => void;
  /** ISO-639-1 language hint for Whisper ("en", "es"). Improves accuracy. */
  language?: string;
  style?: object;
  buttonText?: {
    idle: string;
    listening: string;
    processing: string;
  };
  /** Silence duration in ms before auto-finalize (default 2000ms). */
  silenceTimeout?: number;
  /**
   * When true, begins recording automatically on mount (used by the
   * voice-first input bar which mounts VoiceInput only while in `listening`
   * mode — the user's Speak tap already committed to recording).
   */
  autoStart?: boolean;
  /**
   * Fired when the component moves into/out of the `processing` state
   * (Whisper round-trip). The host can swap its visual feedback from a
   * "listening" pulse to a "transcribing" spinner.
   */
  onProcessingStateChange?: (isProcessing: boolean) => void;
  /**
   * Live-partial transcripts emitted while the user is still speaking.
   * Best-effort stream from `@react-native-voice/voice` running in parallel
   * with the Whisper recording — lets the host show text as it's being
   * spoken rather than waiting the full Whisper round-trip. The final
   * transcript (passed to `onSpeechResult`) still comes from Whisper and
   * may differ from the last partial. See the 2026-04-15 real-time
   * partials change in `whisperTranscriptionService.ts`.
   */
  onPartialResult?: (text: string) => void;
  /**
   * Fired whenever the "user has spoken at least once this session" flag
   * changes: `true` the first time a metering sample crosses
   * `SILENCE_DB_THRESHOLD` after recording starts, `false` when a new
   * recording begins (reset). The voice-first bar uses this as a pre-speech
   * guard — the center ↑ button stays disabled until the mic has actually
   * caught speech, so a too-eager tap can't ship an empty audio clip to
   * Whisper. Added by US-015 (2026-04-15).
   */
  onHasSpokenChange?: (hasSpoken: boolean) => void;
}

/**
 * Imperative handle exposed via `ref`. Lets the parent
 * (`VoiceFirstInputBar`) stop recording immediately when the user taps the
 * center ↑ button — bypassing the 2000ms silence-detection window.
 *
 * Added by US-014 (2026-04-15). See PRD note on why an imperative handle
 * is preferable to a "triggerFinalize" prop: props require the parent to
 * bounce boolean state after each call; an imperative verb matches the
 * way `TextInput.focus()` works and keeps the bar's reducer free of
 * bookkeeping actions.
 */
export interface VoiceInputHandle {
  /**
   * Stop recording and hand the audio to Whisper. Idempotent:
   *  - Safe to call while already finalizing (existing `isFinalizingRef`
   *    guard inside `finalize` absorbs the second call).
   *  - Safe to call before any recording started — a no-op that returns
   *    without throwing. Matches US-014 AC #5.
   */
  finalize: () => Promise<void>;
}

type VoiceState = 'idle' | 'listening' | 'processing' | 'error';

// ---------------------------------------------------------------------------
// Silence detection tuning
// ---------------------------------------------------------------------------

/**
 * Metering threshold (dB) above which we consider the user to be speaking.
 * Expo metering returns negative dBFS: -160 ≈ digital silence, -50 ≈ room
 * tone, -40 ≈ quiet speech, -25 ≈ conversational volume. We chose -40 so
 * K-2 kids' quieter voices still count as speech.
 */
const SILENCE_DB_THRESHOLD = -40;

/**
 * Grace period after start before silence detection engages. Protects
 * against the mic's "warm-up" window where iOS reports -160 dB for the
 * first ~150ms even though the user is already speaking.
 */
const START_GRACE_MS = 400;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const VoiceInput = React.memo(
  React.forwardRef<VoiceInputHandle, VoiceInputProps>(
    (
      {
        onSpeechResult,
        isEnabled,
        onError,
        language = 'en-US',
        style,
        buttonText = {
          idle: '🎤 Voice',
          listening: '🔴 Recording...',
          processing: '⏳ Transcribing...',
        },
        silenceTimeout = 2000,
        autoStart = false,
        onProcessingStateChange,
        onPartialResult,
        onHasSpokenChange,
      },
      ref,
    ) => {
      const [voiceState, setVoiceState] = useState<VoiceState>('idle');

      // Keep latest prop callbacks accessible from effects without re-running them.
      const onSpeechResultRef = useRef(onSpeechResult);
      const onErrorRef = useRef(onError);
      const onProcessingStateChangeRef = useRef(onProcessingStateChange);
      const onPartialResultRef = useRef(onPartialResult);
      const onHasSpokenChangeRef = useRef(onHasSpokenChange);
      useEffect(() => {
        onSpeechResultRef.current = onSpeechResult;
      }, [onSpeechResult]);
      useEffect(() => {
        onErrorRef.current = onError;
      }, [onError]);
      useEffect(() => {
        onProcessingStateChangeRef.current = onProcessingStateChange;
      }, [onProcessingStateChange]);
      useEffect(() => {
        onPartialResultRef.current = onPartialResult;
      }, [onPartialResult]);
      useEffect(() => {
        onHasSpokenChangeRef.current = onHasSpokenChange;
      }, [onHasSpokenChange]);

      // --- Silence-detection refs (updated by metering callbacks) -----------
      // Timestamp of the last metering reading that exceeded the speech
      // threshold. The silence timer compares against this to decide whether
      // to finalize.
      const lastSpeechAtRef = useRef<number>(0);
      // Whether we've seen at least one speech-level sample since start.
      // Prevents the silence timer from firing before the user even speaks.
      const hasSpokenRef = useRef<boolean>(false);
      // Wall-clock moment recording began — used for START_GRACE_MS guard.
      const recordingStartedAtRef = useRef<number>(0);
      // Polling timer that checks for silence at ~200ms cadence; simpler than
      // arming/disarming timeouts on every metering reading.
      const silenceCheckTimerRef = useRef<ReturnType<
        typeof setInterval
      > | null>(null);

      const isMountedRef = useRef<boolean>(true);
      // Latches once we begin finalizing so overlapping triggers (tap + silence
      // racing, or metering callbacks arriving after stop) don't double-submit.
      const isFinalizingRef = useRef<boolean>(false);

      // -------------------------------------------------------------------
      // Lifecycle helpers
      // -------------------------------------------------------------------

      const clearSilenceChecker = useCallback(() => {
        if (silenceCheckTimerRef.current) {
          clearInterval(silenceCheckTimerRef.current);
          silenceCheckTimerRef.current = null;
        }
      }, []);

      /**
       * Metering callback: Whisper service invokes this every ~100ms while
       * recording. We just update the timestamps — the actual silence check
       * runs on an interval so a single quiet frame doesn't race the decision.
       */
      const handleMetering = useCallback((meteringDb: number) => {
        if (meteringDb > SILENCE_DB_THRESHOLD) {
          lastSpeechAtRef.current = Date.now();
          // Fire the pre-speech callback exactly once per recording session —
          // the first time the mic hears speech-level audio. The bar uses
          // this to flip its center ↑ button from disabled to enabled. See
          // US-015 AC #4. Guarded on the ref so re-entering this callback
          // for every subsequent speech frame doesn't re-fire the callback
          // (cheap, but the host shouldn't see spurious state churn).
          if (!hasSpokenRef.current) {
            hasSpokenRef.current = true;
            onHasSpokenChangeRef.current?.(true);
          }
        }
      }, []);

      /**
       * Stop recording + transcribe + fire result. Idempotent: safe to call
       * from both the silence-checker and the user's tap-to-stop path.
       */
      const finalize = useCallback(async () => {
        if (isFinalizingRef.current) return;
        isFinalizingRef.current = true;
        clearSilenceChecker();

        if (!isMountedRef.current) return;
        setVoiceState('processing');
        onProcessingStateChangeRef.current?.(true);

        try {
          const transcript =
            await whisperTranscriptionService.stopAndTranscribe(
              // Strip region suffix: Whisper wants ISO-639-1 two-letter code.
              language.split('-')[0],
            );
          if (!isMountedRef.current) return;
          onSpeechResultRef.current(transcript);
          setVoiceState('idle');
          onProcessingStateChangeRef.current?.(false);
        } catch (err) {
          console.error('[VoiceInput] Transcription failed:', err);
          if (!isMountedRef.current) return;
          onProcessingStateChangeRef.current?.(false);
          const message = (err as Error).message ?? 'Transcription failed';
          onErrorRef.current?.(message);
          setVoiceState('error');
          // Auto-reset after a beat so the next Speak tap is clean.
          setTimeout(() => {
            if (isMountedRef.current) setVoiceState('idle');
          }, 2000);
        }
      }, [clearSilenceChecker, language]);

      // -------------------------------------------------------------------
      // Imperative handle (US-014)
      // -------------------------------------------------------------------
      //
      // Expose `finalize` to the parent so `VoiceFirstInputBar` can stop
      // recording on demand when the user taps the center ↑ button —
      // bypassing the 2000ms silence-detection window.
      //
      // Why this lives AFTER the `finalize` useCallback: the handle closes
      // over the memoized callback; installing before it exists would mean
      // referencing `finalize` before the `const` binding is initialized.
      //
      // Why we wrap the call (rather than just exposing `finalize` raw):
      // AC #5 requires the handle to no-op when no recording is in flight.
      // The underlying `finalize` is also called from the silence-check
      // timer's defensive "service stopped us" branch, which is allowed to
      // run with `isRecording() === false`. Keeping the guard at the
      // handle boundary confines the new behavior to explicit caller
      // intent and preserves the silence-check path unchanged.
      useImperativeHandle(
        ref,
        () => ({
          finalize: async () => {
            // If we're not recording and haven't already started finalizing,
            // nothing to do. Matches AC #5.
            if (
              !whisperTranscriptionService.isRecording() &&
              !isFinalizingRef.current
            ) {
              return;
            }
            await finalize();
          },
        }),
        [finalize],
      );

      /**
       * Main start path: request permission, kick off recording, install the
       * silence checker. All error paths route through the caller's
       * `onError` so the bar can surface a user-facing message.
       */
      const startListening = useCallback(async () => {
        if (whisperTranscriptionService.isRecording()) {
          // Already recording (double-invocation guard) — nothing to do.
          return;
        }
        isFinalizingRef.current = false;
        hasSpokenRef.current = false;
        // Notify the parent that the pre-speech guard should re-arm. Fires on
        // every fresh recording — including the Redo path (US-016) where the
        // same VoiceInput instance remounts and has to start from a
        // hasSpoken=false state again. See US-015 AC #4.
        onHasSpokenChangeRef.current?.(false);
        lastSpeechAtRef.current = Date.now();
        recordingStartedAtRef.current = Date.now();

        // iOS refuses to activate AVAudioSession while the app is in the
        // background or inactive (iPad Split View / Slide Over transitions,
        // notification banners, incoming call UI). expo-av throws
        // "This experience is currently in the background" before even
        // reaching the native AVAudioSession.setActive() call. Wait for
        // the active state before attempting, with one retry for the TOCTOU
        // race where the app slips into inactive between our check and the
        // actual iOS call inside prepareToRecordAsync.
        const waitForForeground = (): Promise<void> => {
          if (AppState.currentState === 'active') return Promise.resolve();
          return new Promise<void>(resolve => {
            const sub = AppState.addEventListener('change', nextState => {
              if (nextState === 'active') {
                sub.remove();
                resolve();
              }
            });
            // Don't block indefinitely — fall through after 5s and let the
            // normal error path handle it.
            setTimeout(() => {
              sub.remove();
              resolve();
            }, 5000);
          });
        };

        let startErr: Error | null = null;
        for (let attempt = 0; attempt < 2; attempt++) {
          await waitForForeground();
          try {
            // Pass the partial-result callback through the ref wrapper so the
            // service always sees the latest handler even if the host swaps it
            // mid-recording. The service only reads this once at startRecording
            // time, so a stable closure over the ref is what we want.
            await whisperTranscriptionService.startRecording(
              handleMetering,
              onPartialResultRef.current
                ? (text: string) => onPartialResultRef.current?.(text)
                : undefined,
            );
            startErr = null;
            break;
          } catch (err) {
            startErr = err as Error;
            // Transient background error on first attempt — retry after
            // waiting for foreground again (handles the TOCTOU race).
            if (attempt === 0 && startErr.message?.includes('background')) {
              console.warn(
                '[VoiceInput] App backgrounded during recording setup, retrying...',
              );
              continue;
            }
            break;
          }
        }

        if (startErr) {
          console.error('[VoiceInput] Failed to start recording:', startErr);
          const message = startErr.message ?? 'Failed to start recording';
          onErrorRef.current?.(message);
          if (startErr.message?.includes('permission')) {
            Alert.alert(
              'Microphone Permission Required',
              'Microphone permission is required for voice input. You can enable it in your device settings. Typing is still available.',
              [
                { text: 'OK' },
                {
                  text: 'Open Settings',
                  onPress: () => {
                    Linking.openSettings().catch(() => {
                      /* ignore */
                    });
                  },
                },
              ],
            );
          }
          if (isMountedRef.current) {
            setVoiceState('error');
            setTimeout(() => {
              if (isMountedRef.current) setVoiceState('idle');
            }, 2000);
          }
          return;
        }

        if (!isMountedRef.current) {
          // Unmounted while awaiting startRecording — bail cleanly.
          whisperTranscriptionService.cancel().catch(() => {});
          return;
        }

        setVoiceState('listening');

        // Silence-watch interval: fires every 200ms, decides whether to
        // finalize. This is cheaper than reacting to every metering frame,
        // and the 200ms granularity is well below human perceptual latency.
        silenceCheckTimerRef.current = setInterval(() => {
          if (!isMountedRef.current || isFinalizingRef.current) {
            clearSilenceChecker();
            return;
          }
          const now = Date.now();
          // Still inside the start-grace window: don't finalize yet.
          if (now - recordingStartedAtRef.current < START_GRACE_MS) return;
          // User hasn't spoken yet — wait (but don't extend beyond the
          // service's MAX_RECORDING_MS cap, which stops the recording on its
          // own if hit). We still want finalize to run at that point, so
          // check the service's isRecording() flag.
          if (!whisperTranscriptionService.isRecording()) {
            // Safety timer inside the service stopped us; transcribe what
            // we have.
            finalize();
            return;
          }
          if (!hasSpokenRef.current) return;
          const silenceMs = now - lastSpeechAtRef.current;
          if (silenceMs >= silenceTimeout) {
            finalize();
          }
        }, 200);
      }, [clearSilenceChecker, finalize, handleMetering, silenceTimeout]);

      // -------------------------------------------------------------------
      // Mount / unmount
      // -------------------------------------------------------------------

      useEffect(() => {
        isMountedRef.current = true;
        return () => {
          isMountedRef.current = false;
          clearSilenceChecker();
          // If the user unmounts mid-recording (e.g. tapped Speak to cancel),
          // discard the audio — don't upload the aborted clip.
          if (whisperTranscriptionService.isRecording()) {
            whisperTranscriptionService.cancel().catch(() => {});
          }
        };
      }, [clearSilenceChecker]);

      // autoStart: when the host mounts us with autoStart=true (voice-first
      // input bar), begin recording immediately rather than waiting for the
      // user to tap this (hidden) button.
      useEffect(() => {
        if (!autoStart || !isEnabled) return;
        if (voiceState !== 'idle') return;
        // Announce for VoiceOver so the user knows the mic is live even
        // though the visual feedback (pulse ring) is owned by the bar.
        AccessibilityInfo.announceForAccessibility('Listening. Speak now.');
        startListening();
        // We intentionally DON'T put startListening in deps — its identity
        // can churn on callback re-binding and we only want one auto-start
        // per mount. The bar unmounts/remounts us for every listening
        // session, so scoping to mount is correct.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [autoStart, isEnabled]);

      // -------------------------------------------------------------------
      // Interaction handlers
      // -------------------------------------------------------------------

      const handlePress = useCallback(async () => {
        if (!isEnabled) {
          Alert.alert(
            'Voice Input Disabled',
            'Voice input is currently disabled.',
          );
          return;
        }
        switch (voiceState) {
          case 'idle':
            await startListening();
            break;
          case 'listening':
            // Tap-to-stop: user is done talking. Same path as silence
            // auto-finalize.
            await finalize();
            break;
          case 'processing':
            // Ignore taps during upload.
            break;
          case 'error':
            setVoiceState('idle');
            break;
        }
      }, [isEnabled, voiceState, startListening, finalize]);

      // -------------------------------------------------------------------
      // Button text + styles
      // -------------------------------------------------------------------

      const buttonTextValue = useMemo(() => {
        switch (voiceState) {
          case 'listening':
            return buttonText.listening;
          case 'processing':
            return buttonText.processing;
          default:
            return buttonText.idle;
        }
      }, [voiceState, buttonText]);

      const buttonStyle = useMemo(() => {
        const base = [styles.voiceButton];
        if (!isEnabled) return [...base, styles.disabled, style];
        switch (voiceState) {
          case 'listening':
            return [...base, styles.listening, style];
          case 'processing':
            return [...base, styles.processing, style];
          case 'error':
            return [...base, styles.error, style];
          default:
            return [...base, styles.idle, style];
        }
      }, [voiceState, isEnabled, style]);

      return (
        <TouchableOpacity
          testID="mic-button"
          style={buttonStyle}
          onPress={handlePress}
          disabled={voiceState === 'processing' || !isEnabled}
          accessibilityRole="button"
          accessibilityLabel={
            !isEnabled
              ? 'Voice input button, disabled'
              : voiceState === 'listening'
              ? 'Voice input, recording'
              : voiceState === 'processing'
              ? 'Voice input, transcribing'
              : voiceState === 'error'
              ? 'Voice input, error occurred'
              : 'Voice input button'
          }
          accessibilityHint={
            !isEnabled
              ? 'Voice input is disabled. You can type your story contribution instead.'
              : voiceState === 'listening'
              ? 'Tap to stop recording and transcribe'
              : voiceState === 'processing'
              ? 'Transcribing your speech, please wait'
              : voiceState === 'error'
              ? 'An error occurred. Tap to try again or type your input.'
              : 'Tap to start voice recording. Speak your contribution, then stop talking or tap again to finish.'
          }
          accessibilityState={{
            disabled: !isEnabled || voiceState === 'processing',
            selected: voiceState === 'listening',
            busy: voiceState === 'processing',
          }}
          accessibilityLiveRegion="polite"
        >
          <View style={styles.buttonContent}>
            {voiceState === 'processing' && (
              <ActivityIndicator
                size="small"
                color={theme.colors.surface}
                style={styles.loadingIcon}
              />
            )}
            <Text style={styles.voiceButtonText} numberOfLines={1}>
              {String(buttonTextValue || buttonText.idle || '🎤')}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
  ),
);

// `displayName` assigns to the OUTER memo wrapper. React's devtools and
// consumers reading `component.displayName === 'VoiceInput'` resolve
// through memo/forwardRef chains, so the name propagates correctly even
// though the wrapped function is anonymous.
VoiceInput.displayName = 'VoiceInput';

export { VoiceInput };
export default VoiceInput;

// ---------------------------------------------------------------------------
// Styles — kept intentionally minimal; the voice-first bar renders the
// visible UI (pulse ring, spinner swap, labels). This component is almost
// always mounted hidden and exists to drive recording + transcription.
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  voiceButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  idle: { backgroundColor: 'transparent' },
  listening: { backgroundColor: 'transparent' },
  processing: { backgroundColor: 'transparent' },
  error: { backgroundColor: 'transparent', opacity: 0.7 },
  disabled: { backgroundColor: 'transparent', opacity: 0.4 },
  voiceButtonText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 22,
    fontWeight: 'normal',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  loadingIcon: {
    marginRight: theme.spacing.xs,
  },
});
