/**
 * Google Sign-In Button Component
 *
 * A button component for Google OAuth authentication that matches the app's design system
 */

import React, { useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { theme } from '../../constants/theme';
import { handleOAuthError } from '../../utils/oauthErrorHandler';
import {
  checkNetworkBeforeOAuth,
  getNetworkErrorMessage,
} from '../../utils/oauthNetworkCheck';

interface GoogleSignInButtonProps {
  /**
   * Optional callback when sign-in is initiated
   */
  onSignInStart?: () => void;
  /**
   * Optional callback when sign-in completes (success or error)
   */
  onSignInComplete?: (error?: string) => void;
  /**
   * Optional custom style for the button
   */
  style?: object;
  /**
   * Optional disabled state (external control)
   */
  disabled?: boolean;
}

/**
 * Google Sign-In Button Component
 *
 * Displays a button with Google branding that initiates the Google OAuth flow.
 * Handles loading states, errors, and accessibility.
 */
export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onSignInStart,
  onSignInComplete,
  style,
  disabled: externalDisabled = false,
}) => {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const handlePress = async (isRetry = false) => {
    if (loading || externalDisabled) {
      return;
    }

    // Check network connectivity before attempting OAuth
    if (!isRetry) {
      const networkState = await checkNetworkBeforeOAuth();
      const networkError = getNetworkErrorMessage(networkState);
      
      if (networkError) {
        Alert.alert(
          'No Internet Connection',
          networkError,
          [
            {
              text: 'Retry',
              onPress: () => {
                // Retry after a short delay
                setTimeout(() => {
                  handlePress(false);
                }, 1000);
              },
            },
            { text: 'OK', style: 'default' as const },
          ],
        );
        onSignInComplete?.(networkError);
        return;
      }
    }

    setLoading(true);
    onSignInStart?.();

    try {
      const result = await signInWithGoogle();

      if (result.error) {
        console.error('Google sign-in error:', result.error);

        // Use comprehensive error handler
        const currentAttempt = isRetry ? retryCount + 1 : 1;
        const errorResult = handleOAuthError(result.error, {
          provider: 'google',
          attemptNumber: currentAttempt,
        });

        // Handle user cancellation silently (no error shown per PRD)
        if (!errorResult.shouldShowError) {
          // User cancelled - silent return (no error shown per PRD)
          console.log('Google sign-in was cancelled by user');
          onSignInComplete?.();
          setLoading(false);
          return;
        }

        // Build error message with fallback option if available
        let errorMessage = errorResult.userMessage;
        if (errorResult.fallbackAvailable) {
          errorMessage +=
            '\n\nYou can also sign in using your email and password.';
        }

        // Build alert buttons
        const buttons: any[] = [];

        // Add retry button if error is retryable
        if (errorResult.canRetry && !isRetry) {
          buttons.push({
            text: 'Retry',
            onPress: () => {
              // Retry after delay (exponential backoff)
              const delay = errorResult.retryDelay || 2000;
              setRetryCount(prev => prev + 1);
              setTimeout(() => {
                handlePress(true);
              }, delay);
            },
            style: 'default' as const,
          });
        }

        // Add OK button
        buttons.push({
          text: 'OK',
          style: 'default' as const,
        });

        // Show error alert with retry option if applicable
        Alert.alert('Sign-In Error', errorMessage, buttons);
        onSignInComplete?.(result.error);
      } else {
        console.log('Google sign-in initiated successfully');

        // Show brief success feedback (visual indicator)
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
        }, 2000); // Show success state for 2 seconds

        // The auth state change listener will handle navigation
        // Success is indicated by navigation to the app
        onSignInComplete?.();
      }
    } catch (error) {
      console.error('Unexpected error during Google sign-in:', error);

      // Use error handler for unexpected errors too
      const currentAttempt = isRetry ? retryCount + 1 : 1;
      const errorResult = handleOAuthError(error, {
        provider: 'google',
        attemptNumber: currentAttempt,
      });

      let errorMessage = errorResult.userMessage;
      if (errorResult.fallbackAvailable) {
        errorMessage +=
          '\n\nYou can also sign in using your email and password.';
      }

      const buttons: any[] = [];
      if (errorResult.canRetry && !isRetry) {
        buttons.push({
          text: 'Retry',
          onPress: () => {
            const delay = errorResult.retryDelay || 2000;
            setRetryCount(prev => prev + 1);
            setTimeout(() => {
              handlePress(true);
            }, delay);
          },
          style: 'default' as const,
        });
      }
      buttons.push({
        text: 'OK',
        style: 'default' as const,
      });

      Alert.alert('Error', errorMessage, buttons);
      onSignInComplete?.(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const isDisabled = loading || externalDisabled || showSuccess;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        isDisabled && styles.buttonDisabled,
        showSuccess && styles.buttonSuccess,
        style,
      ]}
      onPress={handlePress}
      disabled={isDisabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
      accessibilityHint="Sign in or create an account using your Google account"
      accessibilityState={{ disabled: isDisabled }}
      testID="google-sign-in-button"
    >
      {loading ? (
        <View style={styles.loadingContainer} testID="google-button-loading">
          <ActivityIndicator
            size="small"
            color={theme.colors.text}
            style={styles.loadingSpinner}
          />
          <Text style={styles.buttonText}>Signing in...</Text>
        </View>
      ) : showSuccess ? (
        <View style={styles.content}>
          <Text style={styles.successIcon}>✓</Text>
          <Text style={[styles.buttonText, styles.successText]}>
            Sign-in successful!
          </Text>
        </View>
      ) : (
        // Show Google icon and "Continue with Google" text
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Text style={styles.googleIcon}>G</Text>
          </View>
          <Text style={styles.buttonText}>Continue with Google</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8, // Match AuthScreen button borderRadius
    paddingVertical: 15, // Match AuthScreen button paddingVertical
    paddingHorizontal: theme.spacing.base,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden', // Ensure icon and content stay visually inside button
    marginVertical: theme.spacing.sm,
    minHeight: 50,
    alignSelf: 'stretch', // Stretch to fill available width, but allow flex override
    ...theme.shadows.sm,
  },
  buttonDisabled: {
    backgroundColor: theme.colors.disabled,
    borderColor: theme.colors.disabled,
    opacity: 0.6,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4285F4', // Google blue
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.sm,
  },
  googleIcon: {
    fontSize: 16,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.surface,
  },
  buttonText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text,
    ...theme.typography.textStyles.button,
  },
  buttonTextDisabled: {
    color: theme.colors.textDisabled,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingSpinner: {
    marginRight: theme.spacing.sm,
  },
  buttonSuccess: {
    backgroundColor: '#d4edda',
    borderColor: '#28a745',
  },
  successIcon: {
    fontSize: 20,
    fontWeight: theme.typography.fontWeight.bold,
    color: '#28a745',
    marginRight: theme.spacing.sm,
  },
  successText: {
    color: '#28a745',
  },
});

export default GoogleSignInButton;
