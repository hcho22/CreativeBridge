import React, { useState, useEffect, useCallback } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Alert,
  Platform,
  PermissionsAndroid,
  ActivityIndicator,
  View,
} from 'react-native';
import Voice, {
  SpeechResultsEvent,
  SpeechErrorEvent,
  SpeechStartEvent,
  SpeechEndEvent,
} from '@react-native-voice/voice';
import { theme } from '../../styles/theme';

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
}

type VoiceState = 'idle' | 'listening' | 'processing' | 'error';

export const VoiceInput: React.FC<VoiceInputProps> = ({
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
}) => {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // Check and request microphone permissions
  const checkPermissions = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
        );
        
        if (!granted) {
          const requestResult = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
            {
              title: 'Voice Input Permission',
              message: 'CreativeBridge needs access to your microphone to enable voice input for stories.',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            }
          );
          return requestResult === PermissionsAndroid.RESULTS.GRANTED;
        }
        return true;
      } catch (error) {
        console.error('Error checking microphone permissions:', error);
        return false;
      }
    }
    return true; // iOS permissions are handled automatically
  }, []);

  // Initialize Voice listeners
  useEffect(() => {
    const initializeVoice = async () => {
      try {
        const permissionGranted = await checkPermissions();
        setHasPermission(permissionGranted);

        if (!permissionGranted) {
          onError?.('Microphone permission is required for voice input.');
          return;
        }

        // Set up Voice event listeners
        Voice.onSpeechStart = (e: SpeechStartEvent) => {
          console.log('Speech started:', e);
          setVoiceState('listening');
        };

        Voice.onSpeechEnd = (e: SpeechEndEvent) => {
          console.log('Speech ended:', e);
          setVoiceState('processing');
        };

        Voice.onSpeechResults = (e: SpeechResultsEvent) => {
          console.log('Speech results:', e.value);
          if (e.value && e.value[0]) {
            const speechText = e.value[0];
            onSpeechResult(speechText);
            setVoiceState('idle');
          }
        };

        Voice.onSpeechPartialResults = (e: SpeechResultsEvent) => {
          console.log('Partial results:', e.value);
          // Could be used to show real-time transcription
        };

        Voice.onSpeechError = (e: SpeechErrorEvent) => {
          console.error('Speech recognition error:', e.error);
          setVoiceState('error');
          
          let errorMessage = 'Voice recognition failed. Please try again.';
          if (e.error?.message?.includes('network')) {
            errorMessage = 'Network error. Please check your connection and try again.';
          } else if (e.error?.message?.includes('permission')) {
            errorMessage = 'Microphone permission is required for voice input.';
          }
          
          onError?.(errorMessage);
          
          // Reset state after showing error
          setTimeout(() => {
            setVoiceState('idle');
          }, 2000);
        };

      } catch (error) {
        console.error('Error initializing voice:', error);
        setHasPermission(false);
        onError?.('Failed to initialize voice recognition.');
      }
    };

    initializeVoice();

    // Cleanup function
    return () => {
      Voice.destroy().then(() => {
        Voice.removeAllListeners();
      });
    };
  }, [checkPermissions, onError, onSpeechResult]);

  const startListening = async () => {
    if (!isEnabled || !hasPermission || voiceState !== 'idle') {
      return;
    }

    try {
      setVoiceState('listening');
      await Voice.start(language);
    } catch (error) {
      console.error('Error starting voice recognition:', error);
      setVoiceState('error');
      onError?.('Failed to start voice recognition. Please try again.');
      
      setTimeout(() => {
        setVoiceState('idle');
      }, 2000);
    }
  };

  const stopListening = async () => {
    try {
      await Voice.stop();
      setVoiceState('processing');
    } catch (error) {
      console.error('Error stopping voice recognition:', error);
      setVoiceState('idle');
      onError?.('Error stopping voice recognition.');
    }
  };

  const getButtonText = (): string => {
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
  };

  const getButtonStyle = () => {
    const baseStyle = [styles.voiceButton];
    
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
          baseStyle.push(styles.idle);
      }
    }
    
    if (style) {
      baseStyle.push(style);
    }
    
    return baseStyle;
  };

  const handlePress = () => {
    if (!isEnabled || hasPermission === false) {
      Alert.alert(
        'Voice Input Disabled',
        'Voice input is not available. Please enable it in your profile settings and ensure microphone permissions are granted.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (hasPermission === null) {
      Alert.alert(
        'Checking Permissions',
        'Please wait while we check microphone permissions.',
        [{ text: 'OK' }]
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

  return (
    <TouchableOpacity
      style={getButtonStyle()}
      onPress={handlePress}
      disabled={voiceState === 'processing'}
      accessibilityLabel="Voice input button"
      accessibilityHint={`Tap to ${voiceState === 'listening' ? 'stop' : 'start'} voice recognition`}
      accessibilityRole="button"
    >
      <View style={styles.buttonContent}>
        {voiceState === 'processing' && (
          <ActivityIndicator 
            size="small" 
            color={theme.colors.surface} 
            style={styles.loadingIcon} 
          />
        )}
        <Text style={styles.voiceButtonText}>
          {getButtonText()}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  voiceButton: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
    ...theme.shadows.small,
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
  disabled: {
    backgroundColor: theme.colors.disabled,
    opacity: 0.6,
  },
  voiceButtonText: {
    ...theme.typography.button,
    color: theme.colors.surface,
    textAlign: 'center',
  },
  loadingIcon: {
    marginRight: theme.spacing.xs,
  },
});