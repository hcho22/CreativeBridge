/**
 * VoiceInput — push-to-talk driver for the on-device Whisper pipeline
 * (US-007).
 *
 * **History.** This component has been rewritten twice.
 *
 *   - v1 (legacy): wrapped `@react-native-voice/voice` / `SFSpeechRecognizer`
 *     with a 2000+-line state machine fighting iOS's aggressive VAD
 *     finalization. Couldn't capture sentences longer than ~1–2s reliably.
 *   - v2 (2026-04-14): replaced the recognizer with cloud Whisper via
 *     `whisperTranscriptionService` — recorded to a temp file, uploaded to
 *     OpenAI Whisper. Solved the truncation problem but created the H01
 *     COPPA exposure: under-13 voice was leaving the device.
 *   - v3 (this file, 2026-05-11, US-007): push-to-talk + engine routing.
 *     Under-13 users go through the on-device pipeline
 *     (`audioCaptureService` → `onDeviceTranscriptionService`). 13+ users
 *     who opt into cloud go through the legacy `whisperTranscriptionService`.
 *     Silence-based VAD finalization is removed entirely — the user (or
 *     the parent via the imperative `finalize()` handle) decides when to
 *     stop.
 *
 * **Architecture (v3).** This component is a *hidden driver*. The
 * user-visible UI (the large mic button, pulse animation, "I'm listening…"
 * label) is owned by the parent (`VoiceFirstInputBar.tsx`), which mounts
 * VoiceInput off-screen with `pointerEvents="none"` and `autoStart`.
 * VoiceInput's job is to:
 *
 *   1. Resolve the transcription engine at `startListening()` time via
 *      `getTranscriptionEngine()` and **pin it for the duration of this
 *      recording session**. Re-evaluating at stop time could route audio
 *      captured for one pipeline through the other (16 kHz mono PCM vs.
 *      44.1 kHz AAC — they're not interchangeable).
 *   2. Drive the appropriate recording backend (`audioCaptureService` for
 *      on-device, `whisperTranscriptionService` for cloud).
 *   3. On `finalize()` (called by the parent via `ref.current?.finalize()`
 *      when the user taps the stop button), stop recording, run the audio
 *      through the pinned engine, and fire `onSpeechResult(text)`.
 *
 * **What changed from v2.**
 *   - No more silence-VAD timer / metering callbacks. Push-to-talk means
 *     the user (not a heuristic) decides when to stop.
 *   - No more `onPartialResult` — per the PRD Non-Goals, Whisper transcribes
 *     full buffers in one shot. Parent code that consumed partials degrades
 *     gracefully (its placeholder copy falls back to "Listening…" /
 *     "Transcribing…").
 *   - `onHasSpokenChange` is preserved but with shifted semantics: it fires
 *     `true` immediately after a successful `start()` rather than when
 *     metering crosses a speech threshold. In push-to-talk the user's
 *     explicit tap IS the commitment signal, so the gate's original purpose
 *     (preventing empty-audio uploads) is functionally satisfied — and for
 *     the on-device path, an "empty" recording is cheap (no network, no
 *     third-party PII exposure) and surfaces naturally as an empty
 *     transcript the parent can handle.
 *   - New props `gradeLevel` and `preferences` feed the engine policy.
 *
 * **Why route inside VoiceInput rather than have the parent resolve.** Two
 * reasons: (1) keeps the parent's contract identical to v2 except for two
 * new informational props — no parent-side routing logic to test/maintain;
 * (2) ensures `getTranscriptionEngine()` is the ONE place routing decisions
 * happen (FR-2 single-source-of-truth), and putting that call inside the
 * driver makes its single use-site obvious in code review.
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
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '../../constants/theme';
import { audioCaptureService } from '../../services/audioCaptureService';
import { onDeviceTranscriptionService } from '../../services/onDeviceTranscriptionService';
import { whisperTranscriptionService } from '../../services/whisperTranscriptionService';
import type { GradeLevel } from '../../types';
import {
  getTranscriptionEngine,
  type TranscriptionEngine,
} from '../../utils/transcriptionEnginePolicy';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

interface VoiceInputProps {
  onSpeechResult: (text: string) => void;
  isEnabled: boolean;
  onError?: (error: string) => void;
  /** ISO-639-1 language hint ("en", "es"). Used by the cloud branch. */
  language?: string;
  style?: object;
  buttonText?: {
    idle: string;
    listening: string;
    processing: string;
  };
  /**
   * When true, begins recording automatically on mount. Used by
   * `VoiceFirstInputBar` which mounts VoiceInput only while the user is
   * actively in the "listening" state.
   */
  autoStart?: boolean;
  /**
   * Fires when the component enters/leaves `processing` (transcription
   * round-trip). The parent swaps its visual feedback from a "listening"
   * pulse to a "transcribing" spinner.
   */
  onProcessingStateChange?: (isProcessing: boolean) => void;
  /**
   * Fires `false` when a fresh recording begins, `true` immediately after
   * recording is successfully started. The parent uses this to gate its
   * stop button (disabled until VoiceInput confirms the recording is
   * live). Semantics shifted from v2 — see file-level docstring.
   */
  onHasSpokenChange?: (hasSpoken: boolean) => void;
  /**
   * Canonical user grade for COPPA routing. The parent passes
   * `userProfile.preferredGradeLevel` here; VoiceInput maps it onto
   * `getTranscriptionEngine`'s `gradeLevel` parameter. `undefined`
   * defaults to on-device (fail-safe).
   */
  gradeLevel?: GradeLevel;
  /**
   * Fires during the last `COUNTDOWN_WINDOW_MS` (10s) before the
   * auto-stop prompt opens — once per second with `secondsRemaining`
   * counting 10..1. Fires `null` when the countdown ends (modal opens,
   * recording finalizes, or recording is cancelled). The parent
   * decides where to render the countdown (next to the recording
   * pulse, in the live-partial card, etc.). VoiceInput itself is a
   * hidden driver and doesn't paint countdown UI. (US-008)
   */
  onCountdownChange?: (secondsRemaining: number | null) => void;
  /**
   * User preferences subset relevant to transcription routing. Only
   * `transcriptionEngine` is read. Forwarded straight into
   * `getTranscriptionEngine`.
   */
  preferences?: {
    transcriptionEngine?: TranscriptionEngine;
  };
}

/**
 * Imperative handle exposed via `ref`. Lets the parent stop recording
 * immediately (push-to-talk: user taps the "I'm done" button).
 */
export interface VoiceInputHandle {
  /**
   * Stop recording and transcribe. Idempotent:
   *  - Safe to call multiple times — concurrent calls are absorbed.
   *  - Safe to call before recording started — a no-op that returns
   *    without throwing (preserves US-014 AC #5).
   */
  finalize: () => Promise<void>;
}

type VoiceState = 'idle' | 'listening' | 'processing' | 'error';

// ---------------------------------------------------------------------------
// US-008 — Auto-stop prompt tuning
// ---------------------------------------------------------------------------
//
// Two independent timers govern long recordings:
//
//   1. **Soft prompt** at `PROMPT_AT_MS` (60s). Opens the "Are you still
//      telling your story?" modal. The user picks "Yes, keep going" (which
//      reschedules another 60s) or "I'm done" (which finalizes). If they
//      pick nothing within `PROMPT_AUTO_DISMISS_MS` (10s), the modal
//      defaults to "I'm done" — protects against the K-2 student who set
//      the device down and walked away.
//
//   2. **Hard ceiling** at `HARD_CEILING_MS` (5 min) from the original
//      `start()` — finalizes regardless of modal state. Independent of
//      the soft prompt; "Keep going" does NOT reset it. Defends against a
//      runaway "Keep going" loop and is the architectural backstop on
//      battery / disk usage for a forgotten recording.
//
// During `COUNTDOWN_WINDOW_MS` (last 10s) before the soft prompt, the
// component fires `onCountdownChange(secondsRemaining)` once per second.
// The parent renders the countdown — VoiceInput is a hidden driver so we
// don't paint countdown UI ourselves. `onCountdownChange(null)` fires
// when the countdown ends (either modal opens or recording finalizes).
//
// Recording is NOT literally paused while the modal is up. The PRD's
// "capture is paused" is a UX claim, not a technical one: pausing
// `audioCaptureService` / `whisperTranscriptionService` mid-stream would
// require new APIs on both services (neither supports pause/resume),
// and Whisper handles the extra ≤10s of "modal-open" audio fine. "Keep
// going" therefore just reschedules the next prompt 60s from the press.

const PROMPT_AT_MS = 60_000;
const PROMPT_AUTO_DISMISS_MS = 10_000;
const COUNTDOWN_WINDOW_MS = 10_000;
const HARD_CEILING_MS = 300_000;

// US-011 one-time-banner persistence. Tracked at the device level (not the
// user level) because the message is about the platform's capabilities, not
// the user's preference. The flag is set after the alert is acknowledged so
// subsequent mounts skip it silently.
const ANDROID_COMING_SOON_SEEN_KEY =
  '@CreativeBridge:androidVoiceComingSoonSeen';

// US-011: voice input is iOS-only today (whisper.rn's Android binary is not
// bundled per AC #3). Each call site reads `Platform.OS` inline rather than
// capturing it in a module-level constant so tests can override it via the
// existing override-restore pattern without resetting the module cache. The
// same `iOS-only` rule gates: (a) the visible button render, (b) the
// autoStart effect, and (c) the imperative handle's finalize().

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
        autoStart = false,
        onProcessingStateChange,
        onHasSpokenChange,
        gradeLevel,
        preferences,
        onCountdownChange,
      },
      ref,
    ) => {
      const [voiceState, setVoiceState] = useState<VoiceState>('idle');
      // US-008: show/hide the "Are you still telling your story?" modal.
      const [showAutoStopPrompt, setShowAutoStopPrompt] = useState(false);

      // Latest-callback refs so effects don't re-run when the parent's
      // callback identity changes.
      const onSpeechResultRef = useRef(onSpeechResult);
      const onErrorRef = useRef(onError);
      const onProcessingStateChangeRef = useRef(onProcessingStateChange);
      const onHasSpokenChangeRef = useRef(onHasSpokenChange);
      const onCountdownChangeRef = useRef(onCountdownChange);
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
        onHasSpokenChangeRef.current = onHasSpokenChange;
      }, [onHasSpokenChange]);
      useEffect(() => {
        onCountdownChangeRef.current = onCountdownChange;
      }, [onCountdownChange]);

      // Pinned engine for the active recording session. Set at start,
      // cleared at idle/error.
      const activeEngineRef = useRef<TranscriptionEngine | null>(null);

      // Idempotency for finalize — both the parent's ref.current.finalize()
      // call and the in-component tap handler can race; the latch absorbs
      // the second caller.
      const isFinalizingRef = useRef<boolean>(false);
      const isMountedRef = useRef<boolean>(true);

      // -------------------------------------------------------------------
      // US-008 auto-stop timer scaffolding
      // -------------------------------------------------------------------
      // Four orchestrated timers:
      //   - promptTimer: fires at +60s into the current "leg" of recording
      //     (resets on every "Keep going").
      //   - hardCeilingTimer: fires at +5min from the ORIGINAL start
      //     (does NOT reset on "Keep going" — architectural backstop).
      //   - countdownStartTimer: fires at +50s, opens the 1Hz countdown
      //     interval below.
      //   - countdownIntervalRef: fires every 1s during the last 10s,
      //     emits 10..1 to `onCountdownChange`.
      //   - promptAutoDismissTimer: fires 10s after the modal opens,
      //     auto-selects "I'm done" (for the walk-away case).
      const promptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
      const hardCeilingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
        null,
      );
      const countdownStartTimerRef = useRef<ReturnType<
        typeof setTimeout
      > | null>(null);
      const countdownIntervalRef = useRef<ReturnType<
        typeof setInterval
      > | null>(null);
      const promptAutoDismissTimerRef = useRef<ReturnType<
        typeof setTimeout
      > | null>(null);

      // Clears every auto-stop timer/interval. Called from finalize, cancel,
      // unmount, and "I'm done". Intentionally does NOT touch the modal
      // visibility — callers control that explicitly.
      const clearAutoStopTimers = useCallback(() => {
        if (promptTimerRef.current) {
          clearTimeout(promptTimerRef.current);
          promptTimerRef.current = null;
        }
        if (hardCeilingTimerRef.current) {
          clearTimeout(hardCeilingTimerRef.current);
          hardCeilingTimerRef.current = null;
        }
        if (countdownStartTimerRef.current) {
          clearTimeout(countdownStartTimerRef.current);
          countdownStartTimerRef.current = null;
        }
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        if (promptAutoDismissTimerRef.current) {
          clearTimeout(promptAutoDismissTimerRef.current);
          promptAutoDismissTimerRef.current = null;
        }
      }, []);

      // -------------------------------------------------------------------
      // Engine-aware recording helpers
      // -------------------------------------------------------------------
      // Each helper consults the pinned engine and dispatches to the
      // appropriate service. Kept as plain function expressions (not
      // useCallback) because they're only called from already-memoized
      // handlers and a per-render allocation here is negligible.

      const isRecordingForEngine = (
        engine: TranscriptionEngine | null,
      ): boolean => {
        if (engine === 'on-device') return audioCaptureService.isRecording();
        if (engine === 'cloud')
          return whisperTranscriptionService.isRecording();
        return false;
      };

      const cancelForEngine = async (
        engine: TranscriptionEngine | null,
      ): Promise<void> => {
        try {
          if (engine === 'on-device') {
            await audioCaptureService.cancel();
          } else if (engine === 'cloud') {
            await whisperTranscriptionService.cancel();
          }
        } catch {
          // Cancellation is best-effort — the services already swallow
          // their own sub-errors.
        }
      };

      // -------------------------------------------------------------------
      // Finalize: stop recording + transcribe + fire result.
      // -------------------------------------------------------------------
      // Idempotent. Pinned engine determines which backend to invoke.

      const finalize = useCallback(async () => {
        if (isFinalizingRef.current) return;
        isFinalizingRef.current = true;
        // US-008: any auto-stop timers in flight must NOT fire after
        // finalize starts. Also dismiss the prompt modal if visible so
        // the user doesn't see a stale dialog over the processing UI.
        clearAutoStopTimers();
        onCountdownChangeRef.current?.(null);
        setShowAutoStopPrompt(false);

        if (!isMountedRef.current) return;
        setVoiceState('processing');
        onProcessingStateChangeRef.current?.(true);

        const engine = activeEngineRef.current;

        try {
          let text = '';
          if (engine === 'cloud') {
            // Legacy cloud path — service owns its own recording state.
            text = await whisperTranscriptionService.stopAndTranscribe(
              // Whisper API wants ISO-639-1 two-letter code; strip region.
              language.split('-')[0],
            );
          } else {
            // On-device path (also the fail-safe when engine is null —
            // shouldn't happen but if finalize() somehow runs without
            // a pinned engine, the conservative choice is on-device).
            const { uri } = await audioCaptureService.stop();
            const result = await onDeviceTranscriptionService.transcribe(uri);
            text = result.text;
          }

          if (!isMountedRef.current) return;
          activeEngineRef.current = null;
          onSpeechResultRef.current(text);
          setVoiceState('idle');
          onProcessingStateChangeRef.current?.(false);
        } catch (err) {
          console.error('[VoiceInput] Transcription failed:', err);
          activeEngineRef.current = null;
          if (!isMountedRef.current) return;
          onProcessingStateChangeRef.current?.(false);
          const message = (err as Error).message ?? 'Transcription failed';
          onErrorRef.current?.(message);
          setVoiceState('error');
          // Auto-reset so the next Speak tap is clean.
          setTimeout(() => {
            if (isMountedRef.current) setVoiceState('idle');
          }, 2000);
        }
      }, [language, clearAutoStopTimers]);

      // -------------------------------------------------------------------
      // US-008 — leg scheduling
      // -------------------------------------------------------------------
      // Schedules the soft prompt + countdown for ONE leg of recording.
      // A "leg" is the span between a fresh start (or a "Keep going" tap)
      // and the next prompt. Each leg gets its own 60s prompt timer and a
      // 50s countdown-start timer. The hard-ceiling timer is scheduled
      // separately by startListening and reused across legs.

      // Order matters here: openAutoStopPrompt is referenced by
      // scheduleAutoStopLeg's setTimeout, and React's useCallback deps
      // are linted to enforce closure freshness. Declaring
      // openAutoStopPrompt first keeps scheduleAutoStopLeg's dep array
      // honest.

      const openAutoStopPrompt = useCallback(() => {
        // Countdown is over — null it out so the parent's UI can revert.
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        onCountdownChangeRef.current?.(null);

        setShowAutoStopPrompt(true);

        // Walk-away guard: if the user doesn't respond within
        // PROMPT_AUTO_DISMISS_MS, default to "I'm done".
        promptAutoDismissTimerRef.current = setTimeout(() => {
          if (!isMountedRef.current || isFinalizingRef.current) return;
          setShowAutoStopPrompt(false);
          finalize();
        }, PROMPT_AUTO_DISMISS_MS);
      }, [finalize]);

      const scheduleAutoStopLeg = useCallback(() => {
        // Defensive: clear any pre-existing leg timers (e.g., re-entry on
        // "Keep going"). Hard-ceiling timer stays untouched — see
        // architectural backstop note in the constants header.
        if (promptTimerRef.current) {
          clearTimeout(promptTimerRef.current);
          promptTimerRef.current = null;
        }
        if (countdownStartTimerRef.current) {
          clearTimeout(countdownStartTimerRef.current);
          countdownStartTimerRef.current = null;
        }
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }

        // Open the 1Hz countdown at PROMPT_AT_MS − COUNTDOWN_WINDOW_MS.
        countdownStartTimerRef.current = setTimeout(() => {
          if (!isMountedRef.current || isFinalizingRef.current) return;
          let remaining = Math.floor(COUNTDOWN_WINDOW_MS / 1000); // 10
          onCountdownChangeRef.current?.(remaining);
          countdownIntervalRef.current = setInterval(() => {
            remaining -= 1;
            if (remaining <= 0) {
              // Don't fire 0 — the prompt timer takes over at this moment
              // and will emit null via openAutoStopPrompt.
              if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
                countdownIntervalRef.current = null;
              }
              return;
            }
            onCountdownChangeRef.current?.(remaining);
          }, 1000);
        }, PROMPT_AT_MS - COUNTDOWN_WINDOW_MS);

        // Open the prompt at PROMPT_AT_MS.
        promptTimerRef.current = setTimeout(() => {
          if (!isMountedRef.current || isFinalizingRef.current) return;
          openAutoStopPrompt();
        }, PROMPT_AT_MS);
      }, [openAutoStopPrompt]);

      const handleKeepGoing = useCallback(() => {
        // Clear the modal + its auto-dismiss timer, then start a fresh
        // leg. Hard-ceiling timer is untouched — see PRD: "Keep going"
        // does NOT reset the 5-minute cap.
        setShowAutoStopPrompt(false);
        if (promptAutoDismissTimerRef.current) {
          clearTimeout(promptAutoDismissTimerRef.current);
          promptAutoDismissTimerRef.current = null;
        }
        scheduleAutoStopLeg();
      }, [scheduleAutoStopLeg]);

      const handleImDone = useCallback(() => {
        setShowAutoStopPrompt(false);
        if (promptAutoDismissTimerRef.current) {
          clearTimeout(promptAutoDismissTimerRef.current);
          promptAutoDismissTimerRef.current = null;
        }
        finalize();
      }, [finalize]);

      // -------------------------------------------------------------------
      // Imperative handle (US-014, preserved)
      // -------------------------------------------------------------------
      // No-ops cleanly when no recording is in flight — matches AC #5 of
      // the original US-014 plus the explicit AC in US-007 to "preserve
      // the finalize() handle or migrate to an equivalent."

      useImperativeHandle(
        ref,
        () => ({
          finalize: async () => {
            // US-011: on Android there is no recording in flight (we
            // skipped autoStart), so the call is a structural no-op.
            // We still register the handle so `voiceInputRef.current?.
            // finalize()` doesn't blow up at the parent's call site.
            if (Platform.OS !== 'ios') {
              return;
            }
            const engine = activeEngineRef.current;
            if (!isRecordingForEngine(engine) && !isFinalizingRef.current) {
              return;
            }
            await finalize();
          },
        }),
        [finalize],
      );

      // -------------------------------------------------------------------
      // Start: pin engine → start the right service → enter listening
      // -------------------------------------------------------------------

      const startListening = useCallback(async () => {
        // Resolve engine and pin for the duration of this session.
        const engine = getTranscriptionEngine({ gradeLevel, preferences });

        if (isRecordingForEngine(engine)) {
          // Double-invocation guard. Shouldn't happen with push-to-talk
          // but defends against re-mount races.
          return;
        }
        activeEngineRef.current = engine;
        isFinalizingRef.current = false;

        // Reset the parent's pre-speech guard. Fires once on every fresh
        // recording — including the Redo path where VoiceInput remounts.
        onHasSpokenChangeRef.current?.(false);

        // iOS refuses to activate AVAudioSession while the app is
        // background/inactive. Wait for foreground with one retry to
        // handle the TOCTOU race where the app slips inactive between
        // our check and the native call. (Carried over from v2 because
        // it's a real iOS constraint, not a VAD artifact.)
        const waitForForeground = (): Promise<void> => {
          if (AppState.currentState === 'active') return Promise.resolve();
          return new Promise<void>(resolve => {
            const sub = AppState.addEventListener('change', nextState => {
              if (nextState === 'active') {
                sub.remove();
                resolve();
              }
            });
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
            if (engine === 'on-device') {
              await audioCaptureService.start();
            } else {
              await whisperTranscriptionService.startRecording();
            }
            startErr = null;
            break;
          } catch (err) {
            startErr = err as Error;
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
          activeEngineRef.current = null;
          const message = startErr.message ?? 'Failed to start recording';
          onErrorRef.current?.(message);
          if (
            startErr.message?.toLowerCase().includes('permission') ||
            (startErr as { code?: string }).code === 'permission_denied'
          ) {
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
          // Unmounted while awaiting start — bail cleanly so we don't
          // leave a dangling AVAudioSession.
          cancelForEngine(engine);
          return;
        }

        setVoiceState('listening');

        // Push-to-talk equivalent of v2's "metering threshold crossed":
        // the user's explicit Speak tap IS the commitment signal. Fire
        // hasSpoken=true so the parent's "I'm done" button enables
        // immediately rather than waiting for a metering callback that
        // no longer exists in the push-to-talk flow.
        onHasSpokenChangeRef.current?.(true);

        // US-008: install the auto-stop timers. The hard ceiling is
        // anchored to THIS start() — "Keep going" presses won't reset
        // it. The first leg's prompt timer + countdown are scheduled
        // via scheduleAutoStopLeg.
        hardCeilingTimerRef.current = setTimeout(() => {
          if (!isMountedRef.current || isFinalizingRef.current) return;
          setShowAutoStopPrompt(false);
          finalize();
        }, HARD_CEILING_MS);
        scheduleAutoStopLeg();
      }, [gradeLevel, preferences, finalize, scheduleAutoStopLeg]);

      // -------------------------------------------------------------------
      // Mount / unmount
      // -------------------------------------------------------------------

      useEffect(() => {
        isMountedRef.current = true;
        return () => {
          isMountedRef.current = false;
          // US-008: tear down auto-stop timers so they can't fire after
          // unmount and call setState on an unmounted component.
          clearAutoStopTimers();
          // If the user unmounts mid-recording, discard whatever's
          // captured. The on-device path's audioCaptureService also has
          // its own AppState 'background' cancel guard, but unmount can
          // happen on foreground transitions too (route change, parent
          // re-render), so we cancel explicitly here.
          const engine = activeEngineRef.current;
          if (isRecordingForEngine(engine)) {
            cancelForEngine(engine);
          }
          activeEngineRef.current = null;
        };
      }, [clearAutoStopTimers]);

      // autoStart: when the parent mounts us with autoStart=true, begin
      // recording immediately rather than waiting for the user to tap
      // this (hidden) button.
      useEffect(() => {
        // US-011: never auto-start on Android. The recording services
        // (audioCaptureService / whisperTranscriptionService) have no
        // Android binary today and would fail in a hard-to-diagnose way.
        if (Platform.OS !== 'ios') return;
        if (!autoStart || !isEnabled) return;
        if (voiceState !== 'idle') return;
        AccessibilityInfo.announceForAccessibility('Listening. Speak now.');
        startListening();
        // Intentional: startListening's identity can churn; we want one
        // auto-start per mount, not per re-render. The parent
        // unmounts/remounts us for every listening session.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [autoStart, isEnabled]);

      // US-011: on Android, show a one-time alert explaining that voice
      // input is coming soon. AsyncStorage flag prevents repeat displays.
      // The effect runs only once on mount; if it fires before the flag
      // read resolves the user sees the alert (which is the desired
      // first-mount behavior anyway).
      useEffect(() => {
        if (Platform.OS === 'ios') return;
        let cancelled = false;
        AsyncStorage.getItem(ANDROID_COMING_SOON_SEEN_KEY)
          .then(seen => {
            if (cancelled || seen) return;
            Alert.alert(
              'Voice input',
              'Voice input is coming soon to Android. Type your story for now.',
            );
            // Set asynchronously; failure here just means the user might
            // see the alert once more on next mount — a benign worst case.
            AsyncStorage.setItem(ANDROID_COMING_SOON_SEEN_KEY, '1').catch(
              () => {},
            );
          })
          .catch(() => {
            // Read failure: don't show the alert. Better to under-notify
            // than to spam on every mount because of a storage error.
          });
        return () => {
          cancelled = true;
        };
      }, []);

      // -------------------------------------------------------------------
      // Interaction handlers (for the standalone, visible button — kept
      // for completeness even though the parent uses VoiceInput as a
      // hidden driver. A future caller that wants the button visible
      // gets a working tap-to-record / tap-to-stop UX for free.)
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
            // Push-to-talk stop: user explicitly ends recording.
            await finalize();
            break;
          case 'processing':
            // Ignore taps during transcription round-trip.
            break;
          case 'error':
            setVoiceState('idle');
            break;
        }
      }, [isEnabled, voiceState, startListening, finalize]);

      // -------------------------------------------------------------------
      // Button presentation
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

      // US-011: no visible UI on Android. All the hooks above ran (so
      // hook order is stable across platforms and the imperative handle
      // is registered as a no-op for the parent), but nothing renders.
      // Combined with the autoStart guard above and the imperative
      // no-op, this collapses VoiceInput to a fully inert component on
      // Android — satisfying the "voice/mic button is not rendered" AC.
      if (Platform.OS !== 'ios') {
        return null;
      }

      return (
        <>
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
                : 'Tap to start voice recording. Speak your story, then tap again to finish.'
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

          {/*
          US-008 — "Are you still telling your story?" prompt.

          Rendered as a React Native Modal so it escapes the
          `pointerEvents="none"` ancestor that VoiceFirstInputBar wraps
          us in (Modal renders into a separate native window — the
          ancestor's pointer settings don't reach it). This is what
          makes the hidden-driver pattern work alongside an interactive
          modal that needs to receive taps.

          K-2 reading level for copy. Two buttons matching the PRD's
          named branches. No `onRequestClose` (Android back-button) —
          if the user dismisses via system gesture, we treat that as
          "I'm done" so the recording doesn't run indefinitely.
        */}
          <Modal
            visible={showAutoStopPrompt}
            animationType="fade"
            transparent
            onRequestClose={handleImDone}
            accessibilityViewIsModal
            statusBarTranslucent
          >
            {/*
            Children gated on `showAutoStopPrompt` so test queries
            (which traverse the React tree and don't see the native
            Modal `visible` attribute) only locate the inner nodes
            while the prompt is actually visible. Also avoids
            rendering work when the modal is closed.
          */}
            {showAutoStopPrompt && (
              <View style={styles.autoStopBackdrop}>
                <View
                  style={styles.autoStopCard}
                  testID="auto-stop-prompt"
                  accessibilityLiveRegion="polite"
                >
                  <Text style={styles.autoStopTitle}>
                    Are you still telling your story?
                  </Text>
                  <View style={styles.autoStopButtons}>
                    <TouchableOpacity
                      testID="auto-stop-keep-going"
                      style={[styles.autoStopButton, styles.autoStopKeepGoing]}
                      onPress={handleKeepGoing}
                      accessibilityRole="button"
                      accessibilityLabel="Yes, keep going"
                      accessibilityHint="Continue recording your story for another minute"
                    >
                      <Text style={styles.autoStopButtonText}>
                        Yes, keep going
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      testID="auto-stop-im-done"
                      style={[styles.autoStopButton, styles.autoStopImDone]}
                      onPress={handleImDone}
                      accessibilityRole="button"
                      accessibilityLabel="I'm done"
                      accessibilityHint="Stop recording and finish your story"
                    >
                      <Text style={styles.autoStopButtonText}>
                        I&apos;m done
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </Modal>
        </>
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
// Styles — kept intentionally minimal. The voice-first bar renders the
// visible UI (large mic button, pulse animation, "I'm listening…" label).
// VoiceInput is almost always mounted hidden behind the bar.
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
  // US-008 — auto-stop prompt modal. Kept simple per AC ("uses existing
  // app modal patterns, no custom dialog"). Two-button column layout
  // matches the project's other prompt-style modals (e.g., permission
  // gates) without pulling in animation/confetti like CelebrationModal.
  autoStopBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  autoStopCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: theme.spacing.lg,
    width: '100%',
    maxWidth: 360,
  },
  autoStopTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  autoStopButtons: {
    flexDirection: 'column',
    gap: theme.spacing.sm,
  },
  autoStopButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  autoStopKeepGoing: {
    backgroundColor: theme.colors.primary,
  },
  autoStopImDone: {
    backgroundColor: theme.colors.secondary,
  },
  autoStopButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
