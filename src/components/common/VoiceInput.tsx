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
import Voice, {
  SpeechResultsEvent,
  SpeechErrorEvent,
  SpeechStartEvent,
  SpeechEndEvent,
} from '@react-native-voice/voice';
import { theme } from '../../constants/theme';

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
    const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastPartialResultRef = useRef<string | null>(null);
    const pendingResultRef = useRef<string | null>(null);
    const partialResultCountRef = useRef<number>(0); // Track partial results to detect noise
    const lastPartialResultTimeRef = useRef<number>(0); // Track timing of partial results

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
      }
      // iOS permissions are handled automatically by the system
      // The system shows the permission dialog on first use
      return true;
    }, []);

    // Initialize Voice listeners
    useEffect(() => {
      const initializeVoice = async () => {
        try {
          const permissionGranted = await checkPermissions();
          setHasPermission(permissionGranted);

          if (!permissionGranted) {
            const errorMessage =
              'Microphone permission is required for voice input. You can enable it in your device settings. Typing is still available.';
            onError?.(errorMessage);

            // Show helpful alert with option to open settings
            Alert.alert(
              'Microphone Permission Required',
              errorMessage,
              [
                { text: 'OK' },
                ...(Platform.OS === 'android'
                  ? [
                      {
                        text: 'Open Settings',
                        onPress: () => {
                          Linking.openSettings().catch(() => {
                            console.log('Could not open settings');
                          });
                        },
                      },
                    ]
                  : []),
              ],
              { cancelable: true },
            );
            return;
          }

          // Set up Voice event listeners
          Voice.onSpeechStart = (e: SpeechStartEvent) => {
            console.log('Speech started:', e);
            setVoiceState('listening');
            // Announce state change for screen readers
            AccessibilityInfo.announceForAccessibility(
              'Voice input started, listening',
            );
          };

          Voice.onSpeechEnd = (e: SpeechEndEvent) => {
            console.log('Speech ended:', e);
            setVoiceState('processing');
            // Announce state change for screen readers
            AccessibilityInfo.announceForAccessibility(
              'Processing your speech',
            );
          };

          Voice.onSpeechResults = (e: SpeechResultsEvent) => {
            console.log('Speech results:', e.value);
            // Clear silence timer when final results arrive
            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = null;
            }

            // Process results asynchronously to avoid blocking UI thread
            requestAnimationFrame(() => {
              if (e.value && e.value[0]) {
                const speechText = e.value[0];
                // Use final result (more accurate than partial)
                // Show transcribed text even if it seems incomplete (handles noise)
                onSpeechResult(speechText);
                setVoiceState('idle');
                pendingResultRef.current = null;
                lastPartialResultRef.current = null;
                partialResultCountRef.current = 0;

                // Show visual success feedback
                setShowSuccessFeedback(true);
                setTimeout(() => {
                  setShowSuccessFeedback(false);
                }, 1500); // Show for 1.5 seconds

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
                  pendingResultRef.current ||
                  lastPartialResultRef.current ||
                  '';
                if (fallbackText.trim()) {
                  // Show incomplete transcription - user can edit to fix noise-related errors
                  onSpeechResult(fallbackText);
                  setVoiceState('idle');
                  pendingResultRef.current = null;
                  lastPartialResultRef.current = null;
                  partialResultCountRef.current = 0;

                  // Show visual success feedback (even if incomplete)
                  setShowSuccessFeedback(true);
                  setTimeout(() => {
                    setShowSuccessFeedback(false);
                  }, 1500);

                  // Hint that user can edit if needed
                  if (showRecordingTips) {
                    console.log(
                      '💡 Tip: Transcription may be incomplete. You can edit it in the input field.',
                    );
                  }
                  // Announce incomplete transcription for screen readers (non-blocking)
                  AccessibilityInfo.announceForAccessibility(
                    'Transcription may be incomplete. You can edit the text in the input field.',
                  );
                }
              }
            });
          };

          Voice.onSpeechPartialResults = (e: SpeechResultsEvent) => {
            // Process partial results asynchronously to avoid blocking UI thread
            requestAnimationFrame(() => {
              console.log('Partial results:', e.value);
              // Track partial results for silence detection and noise detection
              if (e.value && e.value[0]) {
                const partialText = e.value[0];
                const currentTime = Date.now();

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
                  ? silenceTimeout * 1.5
                  : silenceTimeout;

                // Set new timeout to wait for silence
                silenceTimerRef.current = setTimeout(() => {
                  // Silence detected - finalize with last partial result
                  const finalText =
                    pendingResultRef.current ||
                    lastPartialResultRef.current ||
                    '';
                  if (finalText.trim()) {
                    // Process asynchronously to avoid blocking
                    requestAnimationFrame(() => {
                      // Show transcribed text even if incomplete (handles noise-related issues)
                      onSpeechResult(finalText);
                      setVoiceState('idle');
                      pendingResultRef.current = null;
                      lastPartialResultRef.current = null;
                      partialResultCountRef.current = 0;

                      // Show visual success feedback
                      setShowSuccessFeedback(true);
                      setTimeout(() => {
                        setShowSuccessFeedback(false);
                      }, 1500);

                      // If we detected potential noise, show a helpful hint
                      if (isRapidUpdates && showRecordingTips) {
                        // Subtle hint - user can edit the text if needed
                        console.log(
                          '💡 Tip: If transcription seems incorrect, you can edit it in the input field.',
                        );
                      }
                    });
                  }
                  silenceTimerRef.current = null;
                }, adaptiveTimeout);
              }
            });
          };

          Voice.onSpeechError = (e: SpeechErrorEvent) => {
            const errorCode = e.error?.code || '';
            const errorMessageText = e.error?.message?.toLowerCase() || '';

            // Log error (but use console.log for expected errors like permission denied)
            if (
              errorMessageText.includes('denied') ||
              errorMessageText.includes('permission')
            ) {
              console.log('⚠️ Speech recognition permission denied:', e.error);
            } else {
              console.error('Speech recognition error:', e.error);
            }

            setVoiceState('error');

            // Clear silence timer on error
            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = null;
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
              // Update permission state
              setHasPermission(false);
              // Don't call onError for permission errors - they're expected in simulator
              // Just reset state after a delay
              setTimeout(() => {
                setVoiceState('idle');
              }, 500);
              return; // Exit early to avoid duplicate alerts
            }

            // Map error types to user-friendly messages (for non-permission errors)
            let errorMessage = 'Voice recognition failed. Please try again.';
            // let errorTitle = 'Voice Input Error'; // Not used, errorMessage is sufficient

            // Network errors
            if (
              errorCode === 'network' ||
              errorMessageText.includes('network') ||
              errorMessageText.includes('connection') ||
              errorMessageText.includes('timeout')
            ) {
              // errorTitle = 'Network Error'; // Not used, errorMessage is sufficient
              errorMessage =
                'Network error. Please check your connection and try again.';
            }
            // Recognition errors
            else if (
              errorCode === 'recognition' ||
              errorMessageText.includes('recognition') ||
              errorMessageText.includes('not available') ||
              errorMessageText.includes('unavailable')
            ) {
              // errorTitle = 'Recognition Error'; // Not used, errorMessage is sufficient
              errorMessage =
                'Voice recognition is not available. Please try again or type your input.';
            }
            // Audio errors
            else if (
              errorCode === 'audio' ||
              errorMessageText.includes('audio')
            ) {
              // errorTitle = 'Audio Error'; // Not used, errorMessage is sufficient
              errorMessage =
                'Audio recording error. Please check your microphone and try again.';
            }
            // Generic errors
            else {
              // errorTitle = 'Voice Input Error'; // Not used, errorMessage is sufficient
              errorMessage =
                'Something went wrong with voice recognition. Please try again or type your input.';
            }

            // For other errors, call error callback with user-friendly message
            // The callback will show an alert
            onError?.(errorMessage);

            // Auto-reset state after showing error (fallback)
            // Note: "Try Again" button handler resets state immediately, so this is just a fallback
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
            }, 3000);
          };
        } catch (error) {
          console.error('Error initializing voice:', error);
          setHasPermission(false);

          const errorMessage =
            'Failed to initialize voice recognition. You can still type your input.';
          onError?.(errorMessage);

          // Show Alert with helpful message
          Alert.alert(
            'Voice Input Unavailable',
            errorMessage,
            [{ text: 'OK' }],
            { cancelable: true },
          );
        }
      };

      initializeVoice();

      // Re-check permissions when app comes to foreground (in case user enabled in settings)
      const appStateSubscription = AppState.addEventListener(
        'change',
        async nextAppState => {
          if (nextAppState === 'active' && hasPermission === false) {
            // App came to foreground and permission was previously denied
            // Re-check permission status
            const permissionGranted = await checkPermissions();
            if (permissionGranted) {
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
        // Clear silence timer on unmount
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }

        // Clear success feedback timer if active
        setShowSuccessFeedback(false);

        // Remove app state subscription
        appStateSubscription.remove();

        // Clean up Voice listeners and destroy instance
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

        // Clear all refs to prevent memory leaks
        pendingResultRef.current = null;
        lastPartialResultRef.current = null;
        partialResultCountRef.current = 0;
        lastPartialResultTimeRef.current = 0;
      };
    }, [
      checkPermissions,
      onError,
      onSpeechResult,
      silenceTimeout,
      hasPermission,
      showRecordingTips,
    ]);

    const startListening = useCallback(async () => {
      if (!isEnabled || !hasPermission || voiceState !== 'idle') {
        return;
      }

      // Check if Voice service is available
      try {
        // Voice service availability is checked by attempting to start
        // If Voice module is not available, the error will be caught below
      } catch (error) {
        console.error('Voice service not available:', error);
        const errorMessage =
          'Speech recognition is not available on this device. You can still type your input.';
        onError?.(errorMessage);
        Alert.alert(
          'Speech Recognition Unavailable',
          errorMessage,
          [{ text: 'OK' }],
          { cancelable: true },
        );
        return;
      }

      try {
        setVoiceState('listening');
        // Start voice recognition asynchronously to avoid blocking UI
        await Voice.start(language);
      } catch (error) {
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
        // Clear silence timer on manual stop
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }

        await Voice.stop();
        setVoiceState('processing');

        // If we have pending/partial results, use them immediately
        // Manual stop overrides auto-stop - allows user to stop during noise
        const finalText =
          pendingResultRef.current || lastPartialResultRef.current || '';
        if (finalText.trim()) {
          // Small delay to ensure Voice.stop() completes
          setTimeout(() => {
            // Show transcribed text even if incomplete - user can edit to fix noise-related errors
            onSpeechResult(finalText);
            setVoiceState('idle');
            pendingResultRef.current = null;
            lastPartialResultRef.current = null;
            partialResultCountRef.current = 0;

            // Show visual success feedback
            setShowSuccessFeedback(true);
            setTimeout(() => {
              setShowSuccessFeedback(false);
            }, 1500);
          }, 100);
        } else {
          setVoiceState('idle');
          partialResultCountRef.current = 0;
        }
      } catch (error) {
        console.error('Error stopping voice recognition:', error);
        setVoiceState('idle');

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
      if (!isEnabled) {
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

      if (hasPermission === false) {
        // Permission was denied - offer to open settings
        Alert.alert(
          'Microphone Permission Required',
          'Microphone permission is required for voice input. You can enable it in your device settings. Typing is still available.',
          [
            { text: 'OK' },
            ...(Platform.OS === 'android'
              ? [
                  {
                    text: 'Open Settings',
                    onPress: () => {
                      Linking.openSettings().catch(() => {
                        console.log('Could not open settings');
                      });
                    },
                  },
                ]
              : []),
          ],
        );
        return;
      }

      if (hasPermission === null) {
        Alert.alert(
          'Checking Permissions',
          'Please wait while we check microphone permissions.',
          [{ text: 'OK' }],
        );
        return;
      }

      switch (voiceState) {
        case 'idle':
          startListening();
          break;
        case 'listening':
          stopListening();
          break;
        case 'processing':
          // Cannot interrupt processing
          break;
        case 'error':
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
    ...theme.shadows.sm,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  idle: {
    backgroundColor: theme.colors.accent,
  },
  listening: {
    backgroundColor: theme.colors.error,
  },
  processing: {
    backgroundColor: theme.colors.warning,
  },
  error: {
    backgroundColor: theme.colors.error,
    opacity: 0.7,
  },
  success: {
    backgroundColor: '#4CAF50', // Green for success
    opacity: 1,
  },
  disabled: {
    backgroundColor: theme.colors.disabled,
    opacity: 1, // Keep full opacity so button is always visible
  },
  voiceButtonText: {
    color: '#FFFFFF', // Explicit white color for visibility
    textAlign: 'center',
    fontSize: 20, // Match speaker button emoji size
    fontWeight: 'normal',
    includeFontPadding: false, // Android: remove extra padding
    textAlignVertical: 'center', // Android: center text vertically
  },
  loadingIcon: {
    marginRight: theme.spacing.xs,
  },
  successIcon: {
    fontSize: 16,
    color: theme.colors.surface,
    marginRight: theme.spacing.xs,
    fontWeight: 'bold',
  },
});
