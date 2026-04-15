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
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
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

const VoiceInput: React.FC<VoiceInputProps> = React.memo(
  ({
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
  }) => {
    const [voiceState, setVoiceState] = useState<VoiceState>('idle');

    // Keep latest prop callbacks accessible from effects without re-running them.
    const onSpeechResultRef = useRef(onSpeechResult);
    const onErrorRef = useRef(onError);
    const onProcessingStateChangeRef = useRef(onProcessingStateChange);
    useEffect(() => {
      onSpeechResultRef.current = onSpeechResult;
    }, [onSpeechResult]);
    useEffect(() => {
      onErrorRef.current = onError;
    }, [onError]);
    useEffect(() => {
      onProcessingStateChangeRef.current = onProcessingStateChange;
    }, [onProcessingStateChange]);

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
    const silenceCheckTimerRef = useRef<ReturnType<typeof setInterval> | null>(
      null,
    );

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
        hasSpokenRef.current = true;
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
        const transcript = await whisperTranscriptionService.stopAndTranscribe(
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
      lastSpeechAtRef.current = Date.now();
      recordingStartedAtRef.current = Date.now();

      try {
        await whisperTranscriptionService.startRecording(handleMetering);
      } catch (err) {
        console.error('[VoiceInput] Failed to start recording:', err);
        const message = (err as Error).message ?? 'Failed to start recording';
        onErrorRef.current?.(message);
        if ((err as Error).message?.includes('permission')) {
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
);

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
