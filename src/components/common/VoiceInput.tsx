import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Alert,
  Platform,
  PermissionsAndroid,
  ActivityIndicator,
  View,
  ViewStyle,
  Linking,
  AppState,
  AccessibilityInfo,
} from 'react-native';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import Voice, {
  SpeechResultsEvent,
  SpeechErrorEvent,
  SpeechStartEvent,
  SpeechEndEvent,
} from '@react-native-voice/voice';
import DeviceInfo from 'react-native-device-info';
import { theme } from '../../constants/theme';
import { nativeSpeechRecognizer } from '../../services/nativeSpeechRecognizer';

// Determine if we should use native iOS speech recognizer
const useNativeIOSSpeechRecognizer =
  Platform.OS === 'ios' && nativeSpeechRecognizer.isModuleAvailable();

/**
 * VoiceInput component provides voice recognition functionality with robust error handling
 * and timer cleanup to prevent memory leaks.
 *
 * **Timer Lifecycle Management:**
 * This component manages 4 types of tracked timers that are cleaned up on unmount:
 * - silenceTimerRef: Adaptive silence detection during partial results (tracked, cleaned up)
 * - retryTimerRef: Automatic retry delay for recoverable errors (tracked, cleaned up)
 * - successFeedbackTimerRef: Success feedback display timeout (tracked, cleaned up)
 * - stopListeningTimerRef: iOS-specific 100ms delay for native module (tracked, cleaned up)
 *
 * **Untracked Timers (Safe):**
 * - Error state reset timers (lines 340, 640, 727, 912, 1187): Only transition error→idle,
 *   safe to fire on unmounted component as they use prevState checks
 * - Promise delays (lines 664, 783, 791, 1111, 1254): Synchronous waits for native module
 *   coordination, do not mutate state directly
 *
 * **Cleanup Strategy:**
 * All tracked timers are cleared in the useEffect cleanup function before component unmount.
 * isMountedRef tracks component lifecycle to prevent async operations after unmount.
 *
 * @component
 */
interface VoiceInputProps {
  onSpeechResult: (text: string) => void;
  isEnabled: boolean;
  onError?: (error: string) => void;
  language?: string;
  style?: object;
  buttonText?: {
    idle: string;
    listening: string;
    processing: string;
  };
  silenceTimeout?: number; // Timeout in milliseconds to wait for silence before finalizing (default: 2000ms)
  showRecordingTips?: boolean; // Show tips for optimal recording conditions (default: true)
}

type VoiceState = 'idle' | 'listening' | 'processing' | 'error';

const VoiceInput: React.FC<VoiceInputProps> = React.memo(
  ({
    onSpeechResult,
    isEnabled,
    onError,
    language = 'en-US',
    style,
    buttonText = {
      idle: '🎤 Voice',
      listening: '🔴 Listening...',
      processing: '⏳ Processing...',
    },
    silenceTimeout = 2000, // Default: 2 seconds of silence before finalizing
    showRecordingTips = true, // Show tips for optimal recording conditions
  }) => {
    const [voiceState, setVoiceState] = useState<VoiceState>('idle');
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [showSuccessFeedback, setShowSuccessFeedback] = useState(false);

    // ============================================================================
    // TIMER REFS - Tracked and cleaned up on unmount to prevent memory leaks
    // ============================================================================

    /**
     * Silence detection timer (TRACKED)
     * Lifecycle: Created on partial results (line 575), cleared on new results or cleanup (lines 456, 607, 974-977, 1202)
     * Purpose: Adaptive timeout to detect when user stops speaking
     * Cleanup: Cleared in useEffect return (line 974-977)
     */
    const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    /**
     * Error retry timer (TRACKED)
     * Lifecycle: Created on retryable errors (line 750), cleared on success/unmount (lines 613, 980-983, 1071)
     * Purpose: Delay before automatic retry attempt for transient errors
     * Cleanup: Cleared in useEffect return (line 980-983)
     */
    const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    /**
     * Success feedback timer (TRACKED)
     * Lifecycle: Created by showSuccessFeedbackBriefly() (line 245), cleared on new feedback or unmount (lines 236, 986-989)
     * Purpose: Show success checkmark for 1.5s after successful transcription
     * Cleanup: Cleared in useEffect return (line 986-989)
     */
    const successFeedbackTimerRef = useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

    /**
     * iOS stopListening delay timer (TRACKED)
     * Lifecycle: Created in iOS stopListening() (line 1219), cleared on unmount (lines 991-995)
     * Purpose: 100ms delay for iOS native module to finalize results before callback
     * Cleanup: Cleared in useEffect return (line 991-995)
     */
    const stopListeningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
      null,
    );

    /**
     * Component mount state tracker (TRACKED)
     * Lifecycle: Set to true on mount, false on unmount (line 971)
     * Purpose: Prevent async operations (retry logic, iOS callbacks) from running after unmount
     * Usage: Checked before retry (line 753), iOS stop callback (line 1221)
     */
    const isMountedRef = useRef<boolean>(true);

    // ============================================================================
    // OTHER REFS - Speech recognition state tracking
    // ============================================================================

    const lastPartialResultRef = useRef<string | null>(null);
    const pendingResultRef = useRef<string | null>(null);
    const partialResultCountRef = useRef<number>(0); // Track partial results to detect noise
    const lastPartialResultTimeRef = useRef<number>(0); // Track timing of partial results
    const retryCountRef = useRef<number>(0); // Track retry attempts for retryable errors
    const lastErrorTimeRef = useRef<number>(0); // Track when last error occurred to detect rapid failures
    const manualStopInProgressRef = useRef<boolean>(false); // Track if user manually stopped (prevent retries on manual stop)

    // ============================================================================
    // CALLBACK REFS - Keep latest prop values accessible without re-running effects
    // ============================================================================
    const onSpeechResultRef = useRef(onSpeechResult);
    const onErrorRef = useRef(onError);
    const silenceTimeoutRef = useRef(silenceTimeout);
    const showRecordingTipsRef = useRef(showRecordingTips);
    const hasPermissionRef = useRef(hasPermission);

    // Sync refs with latest prop values (no-op renders, no effect re-runs)
    useEffect(() => {
      onSpeechResultRef.current = onSpeechResult;
    }, [onSpeechResult]);
    useEffect(() => {
      onErrorRef.current = onError;
    }, [onError]);
    useEffect(() => {
      silenceTimeoutRef.current = silenceTimeout;
    }, [silenceTimeout]);
    useEffect(() => {
      showRecordingTipsRef.current = showRecordingTips;
    }, [showRecordingTips]);
    useEffect(() => {
      hasPermissionRef.current = hasPermission;
    }, [hasPermission]);

    // Check and request microphone permissions
    const checkPermissions = useCallback(async (): Promise<boolean> => {
      if (Platform.OS === 'android') {
        try {
          const granted = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          );

          if (!granted) {
            // Show explanation dialog before requesting permission
            return new Promise(resolve => {
              Alert.alert(
                'Microphone Permission',
                'CreativeBridge needs access to your microphone to enable voice input for stories. This allows you to speak your story contributions instead of typing.',
                [
                  {
                    text: 'Cancel',
                    style: 'cancel',
                    onPress: () => {
                      resolve(false);
                      // Show helpful message about typing fallback
                      Alert.alert(
                        'Permission Not Granted',
                        'Voice input is disabled. You can still type your story contributions.',
                        [{ text: 'OK' }],
                      );
                    },
                  },
                  {
                    text: 'Continue',
                    onPress: async () => {
                      try {
                        const requestResult = await PermissionsAndroid.request(
                          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
                          {
                            title: 'Voice Input Permission',
                            message:
                              'CreativeBridge needs access to your microphone to enable voice input for stories.',
                            buttonNeutral: 'Ask Me Later',
                            buttonNegative: 'Cancel',
                            buttonPositive: 'OK',
                          },
                        );

                        if (
                          requestResult === PermissionsAndroid.RESULTS.GRANTED
                        ) {
                          // Permission granted - show success feedback
                          console.log('✅ Microphone permission granted');
                          // Optional: Show brief success message
                          Alert.alert(
                            'Permission Granted',
                            'Microphone permission granted! You can now use voice input.',
                            [{ text: 'OK' }],
                            { cancelable: true },
                          );
                          resolve(true);
                        } else if (
                          requestResult === PermissionsAndroid.RESULTS.DENIED
                        ) {
                          // Permission denied - show helpful message
                          Alert.alert(
                            'Permission Denied',
                            'Microphone permission was denied. You can enable it later in Settings > Apps > CreativeBridge > Permissions. Voice input is disabled, but you can still type your story contributions.',
                            [
                              { text: 'OK' },
                              {
                                text: 'Open Settings',
                                onPress: () => {
                                  Linking.openSettings().catch(() => {
                                    console.log('Could not open settings');
                                  });
                                },
                              },
                            ],
                          );
                          resolve(false);
                        } else {
                          // Ask Me Later
                          resolve(false);
                        }
                      } catch (error) {
                        console.error(
                          'Error requesting microphone permissions:',
                          error,
                        );
                        resolve(false);
                      }
                    },
                  },
                ],
                { cancelable: true },
              );
            });
          }
          return true;
        } catch (error) {
          console.error('Error checking microphone permissions:', error);
          return false;
        }
      } else if (Platform.OS === 'ios') {
        // iOS: Check microphone and speech recognition permissions
        try {
          // Check microphone permission
          const micStatus = await check(PERMISSIONS.IOS.MICROPHONE);
          console.log('🎤 [VoiceInput] iOS mic permission status:', micStatus);

          if (micStatus === RESULTS.GRANTED) {
            // Check speech recognition permission
            const speechStatus = await check(
              PERMISSIONS.IOS.SPEECH_RECOGNITION,
            );
            console.log(
              '🎤 [VoiceInput] iOS speech permission status:',
              speechStatus,
            );

            if (speechStatus === RESULTS.GRANTED) {
              return true;
            } else if (speechStatus === RESULTS.DENIED) {
              // Request speech recognition permission
              const requestResult = await request(
                PERMISSIONS.IOS.SPEECH_RECOGNITION,
              );
              return requestResult === RESULTS.GRANTED;
            } else {
              // Blocked or unavailable — user must enable in Settings
              console.log(
                '🎤 [VoiceInput] Speech recognition blocked/unavailable:',
                speechStatus,
              );
              return false;
            }
          } else if (micStatus === RESULTS.DENIED) {
            // Request microphone permission first (triggers iOS system dialog)
            const micRequestResult = await request(PERMISSIONS.IOS.MICROPHONE);
            console.log(
              '🎤 [VoiceInput] Mic request result:',
              micRequestResult,
            );

            if (micRequestResult === RESULTS.GRANTED) {
              // Now request speech recognition
              const speechRequestResult = await request(
                PERMISSIONS.IOS.SPEECH_RECOGNITION,
              );
              console.log(
                '🎤 [VoiceInput] Speech request result:',
                speechRequestResult,
              );
              return speechRequestResult === RESULTS.GRANTED;
            }
            return false;
          } else if (micStatus === RESULTS.BLOCKED) {
            // Previously denied — user must re-enable in Settings
            console.log(
              '🎤 [VoiceInput] Mic permission blocked — user must enable in Settings',
            );
            return false;
          } else {
            // Unavailable (e.g., missing Info.plist key or unsupported device)
            console.log(
              '🎤 [VoiceInput] Mic permission unavailable:',
              micStatus,
            );
            return false;
          }
        } catch (error) {
          console.error('Error checking iOS permissions:', error);
          return false;
        }
      }
      return false;
    }, []);

    // Helper function to show success feedback briefly and manage timer lifecycle
    // This prevents memory leaks by tracking and cleaning up the timer on unmount
    const showSuccessFeedbackBriefly = useCallback(() => {
      // Clear any existing success feedback timer to prevent overlapping timers
      if (successFeedbackTimerRef.current) {
        clearTimeout(successFeedbackTimerRef.current);
        successFeedbackTimerRef.current = null;
      }

      // Show success feedback
      setShowSuccessFeedback(true);

      // Hide success feedback after 1.5 seconds
      successFeedbackTimerRef.current = setTimeout(() => {
        setShowSuccessFeedback(false);
        successFeedbackTimerRef.current = null;
      }, 1500);
    }, []);

    // Native iOS Speech Recognizer event unsubscribers
    const nativeEventUnsubscribers = useRef<(() => void)[]>([]);

    // Initialize Voice listeners
    useEffect(() => {
      const initializeVoice = async () => {
        console.log('🎤 [VoiceInput] Initializing voice recognition...');
        console.log(
          '🎤 [VoiceInput] Using native iOS recognizer:',
          useNativeIOSSpeechRecognizer,
        );

        try {
          // iOS: Use native SFSpeechRecognizer
          if (useNativeIOSSpeechRecognizer) {
            console.log(
              '🎤 [VoiceInput] Setting up native iOS speech recognizer...',
            );

            // Check if native module is available
            const isAvailable = await nativeSpeechRecognizer.isAvailable();
            console.log(
              '🎤 [VoiceInput] Native iOS recognizer available:',
              isAvailable,
            );

            if (!isAvailable) {
              console.warn(
                '⚠️ [VoiceInput] Native iOS speech recognizer not available',
              );
              setHasPermission(false);
              onErrorRef.current?.(
                'Speech recognition is not available on this device.',
              );
              return;
            }

            // Only CHECK permissions during init — don't REQUEST (no system dialog on mount).
            // Permission will be requested lazily when user taps the mic button.
            const permissions = await nativeSpeechRecognizer.checkPermissions();
            console.log('🎤 [VoiceInput] iOS permissions:', permissions);

            if (!permissions.granted) {
              setHasPermission(false);
              console.log(
                '🎤 [VoiceInput] iOS permissions not yet granted during init — will request on first use',
              );
              return;
            }

            setHasPermission(true);

            // Set up native event listeners
            const unsubResult = nativeSpeechRecognizer.onResult(event => {
              console.log('🎤 [VoiceInput] Native iOS result:', event.text);
              onSpeechResultRef.current(event.text);
              setVoiceState('idle');
              pendingResultRef.current = null;
              lastPartialResultRef.current = null;

              // Show success feedback using helper (prevents memory leak)
              showSuccessFeedbackBriefly();

              AccessibilityInfo.announceForAccessibility(
                `Transcription complete. ${event.text.length} characters transcribed.`,
              );
            });

            const unsubPartial = nativeSpeechRecognizer.onPartialResult(
              event => {
                console.log('🎤 [VoiceInput] Native iOS partial:', event.text);
                lastPartialResultRef.current = event.text;
                pendingResultRef.current = event.text;
              },
            );

            const unsubError = nativeSpeechRecognizer.onError(event => {
              console.error(
                '❌ [VoiceInput] Native iOS error:',
                event.code,
                event.message,
              );
              setVoiceState('error');
              onErrorRef.current?.(event.message);
              // UNTRACKED TIMER (SAFE): Error state reset
              // This timer only transitions error→idle and uses no refs
              // Safe to fire on unmounted component (setState is idempotent)
              setTimeout(() => setVoiceState('idle'), 3000);
            });

            const unsubState = nativeSpeechRecognizer.onStateChange(event => {
              console.log(
                '🎤 [VoiceInput] Native iOS state change:',
                event.state,
              );
              if (event.state === 'listening') {
                setVoiceState('listening');
                AccessibilityInfo.announceForAccessibility(
                  'Voice input started, listening',
                );
              } else if (event.state === 'processing') {
                setVoiceState('processing');
                AccessibilityInfo.announceForAccessibility(
                  'Processing your speech',
                );
              } else if (event.state === 'idle') {
                setVoiceState('idle');
              }
            });

            nativeEventUnsubscribers.current = [
              unsubResult,
              unsubPartial,
              unsubError,
              unsubState,
            ];
            console.log(
              '✅ [VoiceInput] Native iOS speech recognizer initialized',
            );
            return;
          }

          // Android/fallback: Use @react-native-voice/voice
          // Check if Voice module is available
          console.log('🎤 [VoiceInput] Checking Voice module availability...');
          console.log(
            '🎤 [VoiceInput] Voice object:',
            Voice ? 'exists' : 'missing',
          );
          console.log('🎤 [VoiceInput] Voice.start type:', typeof Voice?.start);

          if (!Voice || typeof Voice.start !== 'function') {
            console.error('❌ [VoiceInput] Voice module is not available');
            setHasPermission(false);
            onErrorRef.current?.(
              'Voice recognition is not available on this device.',
            );
            return;
          }

          // Set up Voice event listeners BEFORE permission check.
          // Listeners are just JS callbacks — they don't require permission.
          // They must be registered now so that events are received when
          // Voice.start() is called later (after lazy permission grant).
          console.log('🎤 [VoiceInput] Setting up Voice event listeners...');
          Voice.onSpeechStart = (e: SpeechStartEvent) => {
            console.log('🎤 [VoiceInput] ✅ Speech started event received:', e);
            setVoiceState('listening');
            // Announce state change for screen readers
            AccessibilityInfo.announceForAccessibility(
              'Voice input started, listening',
            );
          };

          Voice.onSpeechEnd = (e: SpeechEndEvent) => {
            console.log('🎤 [VoiceInput] Speech ended event received:', e);
            setVoiceState('processing');
            // Announce state change for screen readers
            AccessibilityInfo.announceForAccessibility(
              'Processing your speech',
            );
          };

          Voice.onSpeechResults = (e: SpeechResultsEvent) => {
            console.log(
              '🎤 [VoiceInput] ✅ Speech results event received:',
              e.value,
            );
            // Clear silence timer when final results arrive
            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = null;
            }

            // Reset retry counter on successful speech results (actual success, not just Voice.start())
            retryCountRef.current = 0;

            // Process results - call callback immediately to ensure text appears
            if (e.value && e.value[0]) {
              const speechText = e.value[0];
              console.log(
                '✅ [VoiceInput] Final speech text received:',
                speechText,
              );
              // Use final result (more accurate than partial)
              // Call callback immediately to ensure text appears in input field
              onSpeechResultRef.current(speechText);
              setVoiceState('idle');
              pendingResultRef.current = null;
              lastPartialResultRef.current = null;
              partialResultCountRef.current = 0;

              // Show visual success feedback using helper (prevents memory leak)
              showSuccessFeedbackBriefly();

              // Announce completion for screen readers (non-blocking)
              AccessibilityInfo.announceForAccessibility(
                `Transcription complete. ${speechText.length} characters transcribed. You can edit the text in the input field.`,
              );
            } else if (
              pendingResultRef.current ||
              lastPartialResultRef.current
            ) {
              // Fallback to partial result if final is empty
              // This handles cases where noise prevents final results
              const fallbackText =
                pendingResultRef.current || lastPartialResultRef.current || '';
              if (fallbackText.trim()) {
                console.log('✅ Using fallback partial text:', fallbackText);
                // Show incomplete transcription - user can edit to fix noise-related errors
                onSpeechResultRef.current(fallbackText);
                setVoiceState('idle');
                pendingResultRef.current = null;
                lastPartialResultRef.current = null;
                partialResultCountRef.current = 0;

                // Show visual success feedback using helper (even if incomplete, prevents memory leak)
                showSuccessFeedbackBriefly();

                // Hint that user can edit if needed
                if (showRecordingTipsRef.current) {
                  console.log(
                    '💡 Tip: Transcription may be incomplete. You can edit it in the input field.',
                  );
                }
                // Announce incomplete transcription for screen readers (non-blocking)
                AccessibilityInfo.announceForAccessibility(
                  'Transcription may be incomplete. You can edit the text in the input field.',
                );
              } else {
                console.log('⚠️ No speech text available in results');
              }
            } else {
              console.log('⚠️ No speech results and no pending results');
            }
          };

          Voice.onSpeechPartialResults = (e: SpeechResultsEvent) => {
            // Process partial results asynchronously to avoid blocking UI thread
            requestAnimationFrame(() => {
              console.log('🎤 [VoiceInput] Partial results received:', e.value);
              // Track partial results for silence detection and noise detection
              if (e.value && e.value[0]) {
                const partialText = e.value[0];
                const currentTime = Date.now();

                // Reset retry counter on partial results - this indicates recognition is working
                if (retryCountRef.current > 0) {
                  console.log(
                    '✅ Got partial results - recognition is working, resetting retry counter',
                  );
                  retryCountRef.current = 0;
                }

                // Calculate time since last result (before updating)
                const previousTime =
                  lastPartialResultTimeRef.current || currentTime;
                const timeSinceLastResult = currentTime - previousTime;

                // Update partial result tracking
                lastPartialResultRef.current = partialText;
                pendingResultRef.current = partialText;
                partialResultCountRef.current += 1;
                lastPartialResultTimeRef.current = currentTime;

                // Detect potential noise: rapid partial results with little change
                // This is a simple heuristic - if we get many partial results quickly
                // with similar text, it might indicate background noise
                // Rapid updates: >10 results and average time between results <100ms
                const isRapidUpdates =
                  timeSinceLastResult < 100 &&
                  partialResultCountRef.current > 10;

                // Reset silence timer when we receive new partial results
                if (silenceTimerRef.current) {
                  clearTimeout(silenceTimerRef.current);
                  silenceTimerRef.current = null;
                }

                // Adaptive silence timeout: slightly longer in noisy environments
                // If we detect rapid updates, increase timeout to filter noise
                const adaptiveTimeout = isRapidUpdates
                  ? silenceTimeoutRef.current * 1.5
                  : silenceTimeoutRef.current;

                // Set new timeout to wait for silence
                // Note: We track silence for potential UI feedback but DO NOT finalize here
                // Only Voice.onSpeechResults should call onSpeechResult() to prevent duplicates
                silenceTimerRef.current = setTimeout(() => {
                  // Silence detected - log for debugging but don't finalize
                  const partialText =
                    pendingResultRef.current ||
                    lastPartialResultRef.current ||
                    '';
                  if (partialText.trim()) {
                    console.log(
                      '🔇 Silence detected after partial result:',
                      partialText,
                    );
                    // DO NOT call onSpeechResult() here - this was causing duplicates
                    // iOS will send Voice.onSpeechResults when transcription is truly complete
                  }
                  silenceTimerRef.current = null;
                }, adaptiveTimeout);
              }
            });
          };

          Voice.onSpeechError = async (e: SpeechErrorEvent) => {
            const errorCode = e.error?.code || '';
            const errorMessageText = e.error?.message?.toLowerCase() || '';
            const errorMessageRaw = e.error?.message || '';

            // Log initial error info (use console.log to avoid spamming during retries)
            console.log('🎤 [VoiceInput] Speech error event received:', {
              code: errorCode,
              message: errorMessageRaw,
            });

            // Clear silence timer on error
            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = null;
            }

            // Clear any pending retry timer
            if (retryTimerRef.current) {
              clearTimeout(retryTimerRef.current);
              retryTimerRef.current = null;
            }

            // CRITICAL FIX: If user manually stopped (rapid button press with no speech),
            // do NOT retry even if error is "recognition_fail" / "no speech detected"
            // This prevents the button from hanging when user rapidly presses twice
            if (manualStopInProgressRef.current) {
              console.log(
                '🎤 [VoiceInput] Error after manual stop - ignoring and resetting to idle (no retry)',
              );
              manualStopInProgressRef.current = false; // Reset flag
              setVoiceState('idle');
              retryCountRef.current = 0;
              return; // Exit early - don't process this error or retry
            }

            // Check for permission errors FIRST and handle them gracefully
            // This must happen before error message mapping to catch "user denied" errors
            const isPermissionError =
              errorCode === 'permission' ||
              errorMessageText.includes('permission') ||
              errorMessageText.includes('microphone') ||
              errorMessageText.includes('access denied') ||
              errorMessageText.includes('denied') ||
              errorMessageText.includes('user denied');

            if (isPermissionError) {
              console.log(
                '⚠️ [VoiceInput] Speech recognition permission denied:',
                e.error,
              );
              // Update permission state
              setHasPermission(false);
              // Reset retry count on permission error
              retryCountRef.current = 0;
              setVoiceState('error');
              // Don't call onError for permission errors - they're expected in simulator
              // Just reset state after a delay
              // UNTRACKED TIMER (SAFE): Permission error state reset
              setTimeout(() => {
                setVoiceState('idle');
              }, 500);
              return; // Exit early to avoid duplicate alerts
            }

            // Handle "already started" error gracefully
            // This occurs when Voice.start() is called while recognition is already running
            const isAlreadyStartedError =
              errorMessageText.includes('already started') ||
              errorMessageText.includes('already listening') ||
              errorMessageText.includes('recognition is running');

            if (isAlreadyStartedError) {
              console.log(
                '⚠️ [VoiceInput] Speech recognition already running, ignoring duplicate start',
              );
              // If we're already listening, just keep the current state
              if (voiceState === 'listening') {
                return; // Already listening, nothing to do
              }
              // If we're in a different state, try to cancel and reset
              try {
                await Voice.cancel();
                // UNTRACKED TIMER (SAFE): Promise-based delay for Voice.cancel() to complete
                // This is a synchronous wait, not a state mutation
                await new Promise(resolve => setTimeout(resolve, 200));
              } catch (cancelError) {
                console.log(
                  'Note: Voice.cancel() during already-started handling:',
                  cancelError,
                );
              }
              // Reset to idle and let user try again
              setVoiceState('idle');
              retryCountRef.current = 0;
              return; // Exit early - not a real error
            }

            // Check for retryable errors (recognition_fail with 203/Retry or similar)
            // Error 203 on iOS means "Speech recognition service temporarily unavailable"
            let isRetryableError =
              errorCode === 'recognition_fail' ||
              errorMessageRaw.includes('203') ||
              errorMessageRaw.includes('Retry') ||
              (errorCode === 'recognition' &&
                errorMessageText.includes('retry'));

            // Maximum retry attempts (3 retries)
            const MAX_RETRIES = 3;
            const RETRY_DELAY = 1000; // 1 second delay between retries

            // Detect rapid failures (errors happening very quickly after start)
            // This might indicate the service is fundamentally broken (e.g., simulator issue)
            const currentTime = Date.now();
            const timeSinceLastError = currentTime - lastErrorTimeRef.current;
            const isRapidFailure =
              timeSinceLastError < 500 && lastErrorTimeRef.current > 0; // Error within 500ms of previous

            // Check if we're in a simulator/emulator using DeviceInfo
            let isEmulator = false;
            try {
              isEmulator = await DeviceInfo.isEmulator();
            } catch {
              // Fallback: assume not emulator if detection fails
              isEmulator = false;
            }

            // Also consider rapid failures as simulator-like behavior
            const isSimulatorLike =
              isEmulator || (isRapidFailure && retryCountRef.current >= 1);

            if (isSimulatorLike && errorCode === 'recognition_fail') {
              // If we're in simulator/emulator or getting rapid failures, likely a fundamental issue
              const reason = isEmulator
                ? 'Simulator/Emulator limitation'
                : 'service unavailable';
              console.warn(
                `⚠️ [VoiceInput] Speech recognition not available - ${reason}. Stopping retries.`,
              );
              retryCountRef.current = MAX_RETRIES; // Force stop retries
              isRetryableError = false; // Treat as non-retryable

              // Show helpful message for simulator/emulator
              if (isEmulator) {
                const errorMessage =
                  'Voice recognition is not available in the Simulator/Emulator. Please test on a physical device to use voice input.';
                setVoiceState('error');
                onErrorRef.current?.(errorMessage);
                // UNTRACKED TIMER (SAFE): Simulator error state reset
                setTimeout(() => {
                  setVoiceState('idle');
                }, 2000);
                return; // Exit early
              }
            }

            lastErrorTimeRef.current = currentTime;

            if (isRetryableError && retryCountRef.current < MAX_RETRIES) {
              // Increment retry counter BEFORE the retry attempt
              retryCountRef.current += 1;

              // Log as info during retries - not an error yet
              console.log(
                `🔄 [VoiceInput] Retrying voice recognition (attempt ${retryCountRef.current}/${MAX_RETRIES})...`,
                `Reason: ${errorCode} - ${errorMessageRaw}`,
              );

              // Don't set error state during retries - stay in processing/listening mode
              setVoiceState('processing');

              // Automatically retry after a short delay
              retryTimerRef.current = setTimeout(async () => {
                try {
                  // Check if component is still mounted (prevent operations on unmounted component)
                  if (!isMountedRef.current) {
                    console.log(
                      '⚠️ Cannot retry: component unmounted during retry delay',
                    );
                    return;
                  }

                  // Validate voice state before retry (should be processing or idle)
                  if (voiceState !== 'processing' && voiceState !== 'idle') {
                    console.log(
                      `⚠️ Cannot retry: invalid voice state '${voiceState}' (expected 'processing' or 'idle')`,
                    );
                    retryCountRef.current = 0; // Reset retry count
                    return;
                  }

                  // Check if we should still retry (permissions and enabled state)
                  if (!hasPermission || !isEnabled) {
                    console.log(
                      '⚠️ Cannot retry: permissions or enabled state changed',
                    );
                    retryCountRef.current = 0; // Reset retry count
                    setVoiceState('idle');
                    return;
                  }

                  // Reset state to idle before retrying
                  setVoiceState('idle');

                  // Small delay to ensure state is reset and give the service time to recover
                  // UNTRACKED TIMER (SAFE): Promise-based delay for state reset coordination
                  await new Promise(resolve => setTimeout(resolve, 200));

                  // Attempt to start listening again
                  try {
                    // Cancel any existing recognition first to avoid "already started" conflicts
                    // Voice.cancel() is more robust than Voice.stop() as it immediately stops
                    try {
                      await Voice.cancel();
                      // UNTRACKED TIMER (SAFE): Promise-based delay for Voice.cancel() to complete
                      await new Promise(resolve => setTimeout(resolve, 150));
                    } catch (cancelError) {
                      // Ignore cancel errors - might not be running
                      console.log(
                        'Note: Voice.cancel() during retry:',
                        cancelError,
                      );
                    }

                    await Voice.start(language);
                    setVoiceState('listening');
                    console.log(
                      `✅ Retry ${retryCountRef.current}/${MAX_RETRIES} - Voice.start() succeeded, waiting for results...`,
                    );
                    // DO NOT reset retry count here - only reset on actual successful results
                    // The retry count will be reset when we get speech results or when max retries is reached
                  } catch (retryError) {
                    // If retry fails, the error handler will be called again
                    // which will either retry again (if under MAX_RETRIES) or show error
                    console.warn(
                      `⚠️ Retry ${retryCountRef.current}/${MAX_RETRIES} failed:`,
                      retryError,
                    );
                    // The error will be handled by onSpeechError being called again
                  }
                } catch (retryError) {
                  console.warn('⚠️ Error during retry:', retryError);
                  // If retry completely fails, don't reset counter yet - let it try again
                  setVoiceState('idle');
                }
              }, RETRY_DELAY);

              // Don't show error message yet - wait for retries to complete
              return;
            }

            // If we get here, either it's not retryable or retries are exhausted
            // NOW we set the error state and log the error
            setVoiceState('error');

            // Reset retry counter if we've exhausted retries or it's not a retryable error
            // But don't reset if we detected rapid failures (keep it at MAX_RETRIES to prevent further retries)
            const shouldResetRetryCount =
              !isRapidFailure &&
              (!isRetryableError || retryCountRef.current >= MAX_RETRIES);

            // Log final error (only after retries exhausted or non-retryable)
            if (retryCountRef.current >= MAX_RETRIES) {
              console.error(
                '❌ [VoiceInput] Speech recognition failed after all retries:',
                e.error,
              );
            } else if (!isRetryableError) {
              console.error(
                '❌ [VoiceInput] Non-retryable speech recognition error:',
                e.error,
              );
            }

            if (shouldResetRetryCount) {
              retryCountRef.current = 0;
            }

            // Map error types to user-friendly messages (for non-permission errors)
            let errorMessage = 'Voice recognition failed. Please try again.';

            // Network errors
            if (
              errorCode === 'network' ||
              errorMessageText.includes('network') ||
              errorMessageText.includes('connection') ||
              errorMessageText.includes('timeout')
            ) {
              errorMessage =
                'Network error. Please check your connection and try again.';
            }
            // Recognition errors (including recognition_fail)
            else if (
              errorCode === 'recognition' ||
              errorCode === 'recognition_fail' ||
              errorMessageText.includes('recognition') ||
              errorMessageText.includes('not available') ||
              errorMessageText.includes('unavailable')
            ) {
              if (isEmulator) {
                errorMessage =
                  'Voice recognition is not available in the Simulator/Emulator. Please test on a physical device to use voice input.';
              } else if (isRapidFailure) {
                errorMessage =
                  'Voice recognition service is not available. Please check your internet connection and try again, or type your input.';
              } else if (
                retryCountRef.current >= MAX_RETRIES ||
                (isRetryableError && shouldResetRetryCount)
              ) {
                errorMessage =
                  'Voice recognition failed after multiple attempts. Please check your internet connection and try again, or type your input.';
              } else {
                errorMessage =
                  'Voice recognition is not available. Please try again or type your input.';
              }
            }
            // Audio errors
            else if (
              errorCode === 'audio' ||
              errorMessageText.includes('audio')
            ) {
              errorMessage =
                'Audio recording error. Please check your microphone and try again.';
            }
            // Generic errors
            else {
              errorMessage =
                'Something went wrong with voice recognition. Please try again or type your input.';
            }

            // For other errors, call error callback with user-friendly message
            // The callback will show an alert
            onErrorRef.current?.(errorMessage);

            // Auto-reset state after showing error (fallback)
            // Note: "Try Again" button handler resets state immediately, so this is just a fallback
            // UNTRACKED TIMER (SAFE): Generic error state reset with prevState check
            setTimeout(() => {
              setVoiceState(prevState => {
                // Only reset if still in error state (user hasn't tried again)
                if (prevState === 'error') {
                  return 'idle';
                }
                return prevState;
              });
              pendingResultRef.current = null;
              lastPartialResultRef.current = null;
              retryCountRef.current = 0; // Reset retry count on final error
            }, 3000);
          };

          console.log(
            '✅ [VoiceInput] Voice event listeners initialized successfully',
          );

          // Silent permission check during init — no dialogs, no requests.
          // Permission will be requested lazily when user taps the mic button.
          console.log('🎤 [VoiceInput] Checking permissions silently...');
          let permissionGranted = false;
          if (Platform.OS === 'android') {
            permissionGranted = await PermissionsAndroid.check(
              PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
            );
          } else {
            // iOS fallback path (non-native recognizer)
            const micStatus = await check(PERMISSIONS.IOS.MICROPHONE);
            const speechStatus = await check(
              PERMISSIONS.IOS.SPEECH_RECOGNITION,
            );
            permissionGranted =
              micStatus === RESULTS.GRANTED && speechStatus === RESULTS.GRANTED;
          }
          console.log(
            '🎤 [VoiceInput] Permission check result:',
            permissionGranted,
          );
          setHasPermission(permissionGranted);
        } catch (error) {
          console.error('❌ [VoiceInput] Error initializing voice:', error);
          setHasPermission(false);

          const errorMessage =
            'Failed to initialize voice recognition. You can still type your input.';
          onErrorRef.current?.(errorMessage);
          // Don't show alert here - handlePress will inform user when they tap mic
        }
      };

      console.log('🎤 [VoiceInput] Calling initializeVoice()...');
      initializeVoice();

      // Re-check permissions silently when app comes to foreground (in case user enabled in settings)
      const appStateSubscription = AppState.addEventListener(
        'change',
        async nextAppState => {
          if (nextAppState === 'active' && hasPermissionRef.current === false) {
            // Silent re-check — no dialogs, just update state
            let granted = false;
            if (useNativeIOSSpeechRecognizer) {
              const perms = await nativeSpeechRecognizer.checkPermissions();
              granted = perms.granted;
            } else if (Platform.OS === 'android') {
              granted = await PermissionsAndroid.check(
                PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
              );
            } else {
              const micStatus = await check(PERMISSIONS.IOS.MICROPHONE);
              const speechStatus = await check(
                PERMISSIONS.IOS.SPEECH_RECOGNITION,
              );
              granted =
                micStatus === RESULTS.GRANTED &&
                speechStatus === RESULTS.GRANTED;
            }
            if (granted) {
              setHasPermission(true);
              console.log(
                '✅ Permission granted after returning from settings',
              );
            }
          }
        },
      );

      // Cleanup function - ensure all resources are freed
      return () => {
        // Mark component as unmounted to prevent async operations
        isMountedRef.current = false;

        // Clear silence timer on unmount
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }

        // Clear retry timer on unmount
        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current);
          retryTimerRef.current = null;
        }

        // Clear success feedback timer on unmount (prevents memory leak and setState warnings)
        if (successFeedbackTimerRef.current) {
          clearTimeout(successFeedbackTimerRef.current);
          successFeedbackTimerRef.current = null;
        }

        // Clear iOS stopListening timer on unmount (prevents memory leak from 100ms delay)
        if (stopListeningTimerRef.current) {
          clearTimeout(stopListeningTimerRef.current);
          stopListeningTimerRef.current = null;
        }
        setShowSuccessFeedback(false);

        // Remove app state subscription
        appStateSubscription.remove();

        // Clean up native iOS listeners if using native module
        if (useNativeIOSSpeechRecognizer) {
          nativeEventUnsubscribers.current.forEach(unsub => {
            try {
              unsub();
            } catch (error) {
              // Ignore cleanup errors
            }
          });
          nativeEventUnsubscribers.current = [];
          nativeSpeechRecognizer.removeAllListeners();
        } else {
          // Clean up Voice listeners and destroy instance (Android)
          // Use async cleanup but don't block unmount
          Voice.destroy()
            .then(() => {
              Voice.removeAllListeners();
            })
            .catch(error => {
              console.warn('Error during Voice cleanup:', error);
              // Still try to remove listeners even if destroy fails
              Voice.removeAllListeners();
            });
        }

        // Clear all refs to prevent memory leaks
        pendingResultRef.current = null;
        lastPartialResultRef.current = null;
        partialResultCountRef.current = 0;
        lastPartialResultTimeRef.current = 0;
        retryCountRef.current = 0;
        lastErrorTimeRef.current = 0;
        manualStopInProgressRef.current = false;
      };
      // Mount-only initialization: Voice module setup, permission check, and event listeners.
      // Callback props are accessed via refs (onSpeechResultRef, onErrorRef, etc.) to avoid
      // re-initialization cycles. Previously, including hasPermission/isEnabled/onSpeechResult
      // as dependencies caused the effect to re-run on every state change, triggering repeated
      // permission alerts (the root cause of the mic permission dialog bug).
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const startListening = useCallback(async () => {
      console.log('🎤 [VoiceInput] startListening called', {
        isEnabled,
        hasPermission,
        voiceState,
      });

      if (!isEnabled || !hasPermission || voiceState !== 'idle') {
        console.log('🎤 [VoiceInput] ⚠️ Cannot start listening:', {
          isEnabled,
          hasPermission,
          voiceState,
        });
        return;
      }

      // At this point, voiceState is guaranteed to be 'idle' due to the check above
      try {
        console.log('🎤 [VoiceInput] Starting voice recognition...');
        // Reset retry count and error tracking when starting a new listening session
        retryCountRef.current = 0;
        lastErrorTimeRef.current = 0;
        manualStopInProgressRef.current = false; // Clear manual stop flag when starting fresh

        // Clear any pending retry timer
        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current);
          retryTimerRef.current = null;
        }

        // iOS: Use native SFSpeechRecognizer
        if (useNativeIOSSpeechRecognizer) {
          console.log('🎤 [VoiceInput] Using native iOS speech recognizer...');
          setVoiceState('listening');
          try {
            await nativeSpeechRecognizer.startDictation(language);
            console.log('✅ [VoiceInput] Native iOS dictation started');
          } catch (nativeError: any) {
            console.error(
              '❌ [VoiceInput] Native iOS dictation error:',
              nativeError,
            );
            setVoiceState('idle');
            throw nativeError;
          }
          return;
        }

        // Android: Use @react-native-voice/voice
        // Add defensive check to ensure Voice module is available
        if (!Voice || typeof Voice.start !== 'function') {
          console.error(
            '❌ [VoiceInput] Voice module not available in startListening',
          );
          throw new Error('Voice recognition module is not available');
        }

        console.log(
          '🎤 [VoiceInput] Setting state to listening and calling Voice.start()...',
        );

        // Cancel any existing recognition to prevent "already started" errors
        // This handles edge cases where state is out of sync with native module
        try {
          await Voice.cancel();
          // UNTRACKED TIMER (SAFE): Promise-based delay for Voice.cancel() coordination
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (cancelError) {
          // Ignore cancel errors - might not be running
          console.log('Note: Voice.cancel() before start:', cancelError);
        }

        setVoiceState('listening');
        // Start voice recognition asynchronously to avoid blocking UI
        // Wrap in try-catch to handle native crashes gracefully
        try {
          console.log(
            '🎤 [VoiceInput] Calling Voice.start() with language:',
            language,
          );
          await Voice.start(language);
          console.log('✅ [VoiceInput] Voice.start() completed successfully');
        } catch (voiceError: any) {
          console.error(
            '❌ [VoiceInput] Voice.start() threw error:',
            voiceError,
          );
          console.error('Voice.start() error:', voiceError);
          // Reset state immediately to prevent UI lock
          setVoiceState('idle');

          // Check for specific error types
          const errorMessage = voiceError?.message || String(voiceError);
          if (
            errorMessage.includes('permission') ||
            errorMessage.includes('Permission')
          ) {
            throw new Error(
              'Microphone or speech recognition permission is required',
            );
          } else if (
            errorMessage.includes('not available') ||
            errorMessage.includes('unavailable')
          ) {
            throw new Error(
              'Speech recognition is not available on this device',
            );
          } else {
            throw voiceError;
          }
        }
      } catch (error: any) {
        console.error('Error starting voice recognition:', error);
        setVoiceState('error');

        const errorMessage =
          'Failed to start voice recognition. Please try again or type your input.';
        onError?.(errorMessage);

        // Show Alert with "Try Again" option (non-blocking)
        requestAnimationFrame(() => {
          Alert.alert(
            'Voice Input Error',
            errorMessage,
            [
              {
                text: 'OK',
                style: 'default',
              },
              {
                text: 'Try Again',
                style: 'default',
                onPress: () => {
                  setVoiceState('idle');
                },
              },
            ],
            { cancelable: true },
          );
        });

        // Auto-reset state after showing error
        // UNTRACKED TIMER (SAFE): startListening error state reset with prevState check
        setTimeout(() => {
          setVoiceState(prevState => {
            // Only reset if still in error state
            if (prevState === 'error') {
              return 'idle';
            }
            return prevState;
          });
        }, 3000);
      }
    }, [isEnabled, hasPermission, voiceState, language, onError]);

    const stopListening = async () => {
      try {
        // Mark that user is manually stopping - this prevents retry logic if Voice.stop() triggers "no speech detected" error
        manualStopInProgressRef.current = true;

        // Clear silence timer on manual stop
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }

        // iOS: Use native SFSpeechRecognizer
        if (useNativeIOSSpeechRecognizer) {
          console.log('🎤 [VoiceInput] Stopping native iOS dictation...');
          setVoiceState('processing');
          await nativeSpeechRecognizer.stopDictation();
          // Native module will send final result via event
          // If we have pending partial results, use them as fallback
          const finalText =
            pendingResultRef.current || lastPartialResultRef.current || '';
          if (finalText.trim()) {
            console.log('✅ iOS Manual stop, using partial text:', finalText);
            // Track the 100ms delay timer to prevent memory leaks on unmount
            stopListeningTimerRef.current = setTimeout(() => {
              // Check if component is still mounted before proceeding
              if (!isMountedRef.current) {
                console.log(
                  '⚠️ Component unmounted during iOS stopListening delay, aborting',
                );
                return;
              }
              onSpeechResult(finalText);
              setVoiceState('idle');
              pendingResultRef.current = null;
              lastPartialResultRef.current = null;
              // Show success feedback using helper (prevents memory leak)
              showSuccessFeedbackBriefly();
              // Clear the timer ref after execution
              stopListeningTimerRef.current = null;
              // Reset manual stop flag after successful iOS stop
              manualStopInProgressRef.current = false;
            }, 100);
          } else {
            // No text - reset flag immediately for iOS
            manualStopInProgressRef.current = false;
          }
          return;
        }

        // Android: Use @react-native-voice/voice
        // Add defensive check to ensure Voice module is available
        if (!Voice || typeof Voice.stop !== 'function') {
          throw new Error('Voice recognition module is not available');
        }

        await Voice.stop();
        setVoiceState('processing');

        // If we have pending/partial results, use them immediately
        // Manual stop overrides auto-stop - allows user to stop during noise
        const finalText =
          pendingResultRef.current || lastPartialResultRef.current || '';
        if (finalText.trim()) {
          console.log('✅ Manual stop, using text:', finalText);
          // Small delay to ensure Voice.stop() completes, then call callback
          // UNTRACKED TIMER (SAFE): 100ms delay for Voice.stop() coordination on Android
          // Does not need tracking - immediate callback with no cancellation requirement
          setTimeout(() => {
            // Show transcribed text even if incomplete - user can edit to fix noise-related errors
            onSpeechResult(finalText);
            setVoiceState('idle');
            pendingResultRef.current = null;
            lastPartialResultRef.current = null;
            partialResultCountRef.current = 0;

            // Show visual success feedback using helper (prevents memory leak)
            showSuccessFeedbackBriefly();
            // Reset manual stop flag after successful Android stop
            manualStopInProgressRef.current = false;
          }, 100);
        } else {
          console.log('⚠️ Manual stop but no text available');
          setVoiceState('idle');
          partialResultCountRef.current = 0;
          // Reset manual stop flag when no text available (rapid double-tap case)
          // Wait 150ms to ensure any pending error events are caught by the flag
          setTimeout(() => {
            manualStopInProgressRef.current = false;
          }, 150);
        }
      } catch (error) {
        console.error('Error stopping voice recognition:', error);
        setVoiceState('idle');
        // Reset manual stop flag on error
        manualStopInProgressRef.current = false;

        const errorMessage =
          'Error stopping voice recognition. The input field is still available for typing.';
        onError?.(errorMessage);

        // Show Alert for stopping errors (less critical)
        Alert.alert('Voice Input Notice', errorMessage, [{ text: 'OK' }], {
          cancelable: true,
        });
      }
    };

    // Memoize button text to prevent unnecessary re-renders
    const getButtonText = useCallback((): string => {
      switch (voiceState) {
        case 'listening':
          return buttonText.listening;
        case 'processing':
          return buttonText.processing;
        case 'error':
          return '❌ Error';
        default:
          return buttonText.idle;
      }
    }, [voiceState, buttonText]);

    // Memoize button style to prevent unnecessary re-renders
    const getButtonStyle = useMemo(() => {
      const baseStyle: ViewStyle[] = [styles.voiceButton];

      // Always show the button, even if disabled
      if (!isEnabled || hasPermission === false) {
        baseStyle.push(styles.disabled);
      } else {
        switch (voiceState) {
          case 'listening':
            baseStyle.push(styles.listening);
            break;
          case 'processing':
            baseStyle.push(styles.processing);
            break;
          case 'error':
            baseStyle.push(styles.error);
            break;
          default:
            // Show success state briefly after transcription
            if (showSuccessFeedback) {
              baseStyle.push(styles.success);
            } else {
              baseStyle.push(styles.idle);
            }
        }
      }

      if (style) {
        baseStyle.push(style);
      }

      return baseStyle;
    }, [voiceState, isEnabled, hasPermission, showSuccessFeedback, style]);

    const handlePress = async () => {
      console.log('🎤 [VoiceInput] Button pressed!', {
        isEnabled,
        hasPermission,
        voiceState,
      });

      if (!isEnabled) {
        console.log('🎤 [VoiceInput] ⚠️ Voice input is disabled');
        Alert.alert(
          'Voice Input Disabled',
          'Voice input is disabled in your profile settings. You can enable it in Settings or continue typing your story contributions.',
          [
            { text: 'OK' },
            {
              text: 'Open Settings',
              onPress: () => {
                // Navigate to settings screen if available
                // For now, just show message
                Alert.alert(
                  'Settings',
                  'Please go to Settings to enable voice input features.',
                  [{ text: 'OK' }],
                );
              },
            },
          ],
        );
        return;
      }

      if (hasPermission === false || hasPermission === null) {
        console.log(
          '🎤 [VoiceInput] Permission not yet granted, requesting...',
        );
        // Try to request permission lazily on first mic tap
        let granted = false;
        if (useNativeIOSSpeechRecognizer) {
          const result = await nativeSpeechRecognizer.requestPermissions();
          granted = result.granted;
        } else {
          granted = await checkPermissions();
        }

        if (granted) {
          setHasPermission(true);
          console.log('✅ Permission granted on mic tap');
          // Permission just granted — start listening immediately.
          // We cannot call startListening() here because it captures
          // hasPermission from its closure which is still false (React
          // state updates are async). Instead, start Voice directly.
          try {
            retryCountRef.current = 0;
            manualStopInProgressRef.current = false;
            if (useNativeIOSSpeechRecognizer) {
              setVoiceState('listening');
              await nativeSpeechRecognizer.startDictation(language);
            } else if (Voice && typeof Voice.start === 'function') {
              try {
                await Voice.cancel();
                await new Promise(resolve => setTimeout(resolve, 100));
              } catch (cancelError) {
                // Ignore cancel errors - may not be running
              }
              setVoiceState('listening');
              await Voice.start(language);
            }
            console.log('✅ Voice recognition started after permission grant');
          } catch (startError) {
            console.error(
              '❌ Failed to start voice after permission grant:',
              startError,
            );
            setVoiceState('error');
            setTimeout(() => setVoiceState('idle'), 3000);
          }
          return;
        }

        // Permission truly denied — show helpful alert
        Alert.alert(
          'Microphone Permission Required',
          'Microphone permission is required for voice input. You can enable it in your device settings. Typing is still available.',
          [
            { text: 'OK' },
            {
              text: 'Open Settings',
              onPress: () => {
                Linking.openSettings().catch(() => {
                  console.log('Could not open settings');
                });
              },
            },
          ],
        );
        return;
      }

      switch (voiceState) {
        case 'idle':
          console.log(
            '🎤 [VoiceInput] State is idle, calling startListening()...',
          );
          startListening();
          break;
        case 'listening':
          console.log(
            '🎤 [VoiceInput] State is listening, calling stopListening()...',
          );
          stopListening();
          break;
        case 'processing':
          console.log('🎤 [VoiceInput] State is processing, cannot interrupt');
          // Cannot interrupt processing
          break;
        case 'error':
          console.log('🎤 [VoiceInput] State is error, resetting to idle');
          setVoiceState('idle');
          break;
      }
    };

    // Memoize button text value to avoid recalculating on every render
    const buttonTextValue = useMemo(() => getButtonText(), [getButtonText]);

    return (
      <TouchableOpacity
        testID="mic-button"
        style={getButtonStyle}
        onPress={handlePress}
        disabled={voiceState === 'processing'}
        accessibilityLabel={
          !isEnabled
            ? 'Voice input button, disabled'
            : hasPermission === false
            ? 'Voice input button, microphone permission required'
            : voiceState === 'listening'
            ? 'Voice input, listening'
            : voiceState === 'processing'
            ? 'Voice input, processing'
            : voiceState === 'error'
            ? 'Voice input, error occurred'
            : 'Voice input button'
        }
        accessibilityHint={
          !isEnabled
            ? 'Voice input is disabled. You can type your story contribution instead.'
            : hasPermission === false
            ? 'Microphone permission is required for voice input. You can enable it in settings or type your input.'
            : voiceState === 'listening'
            ? 'Tap to stop voice recognition and finalize transcription'
            : voiceState === 'processing'
            ? 'Processing your speech, please wait'
            : voiceState === 'error'
            ? 'An error occurred. Tap to try again or type your input.'
            : 'Tap to start voice recognition. Speak your story contribution, then tap again to stop.'
        }
        accessibilityRole="button"
        accessibilityState={{
          disabled:
            !isEnabled ||
            hasPermission === false ||
            voiceState === 'processing',
          selected: voiceState === 'listening',
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
          {showSuccessFeedback && voiceState === 'idle' && (
            <Text style={styles.successIcon}>✓</Text>
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
  idle: {
    backgroundColor: 'transparent',
  },
  listening: {
    backgroundColor: 'transparent',
  },
  processing: {
    backgroundColor: 'transparent',
  },
  error: {
    backgroundColor: 'transparent',
    opacity: 0.7,
  },
  success: {
    backgroundColor: 'transparent',
    opacity: 1,
  },
  disabled: {
    backgroundColor: 'transparent',
    opacity: 0.4,
  },
  voiceButtonText: {
    color: '#FFFFFF', // Explicit white color for visibility
    textAlign: 'center',
    fontSize: 22, // Match speaker button emoji size
    fontWeight: 'normal',
    includeFontPadding: false, // Android: remove extra padding
    textAlignVertical: 'center', // Android: center text vertically
  },
  loadingIcon: {
    marginRight: theme.spacing.xs,
  },
  successIcon: {
    fontSize: 18,
    color: theme.colors.surface,
    marginRight: theme.spacing.xs,
    fontWeight: 'bold',
  },
});
