/**
 * Apple Sign-In Button Component
 *
 * A button component for Apple OAuth authentication that matches the app's design system
 * Supports dark mode styling per Apple's design guidelines
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

interface AppleSignInButtonProps {
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
 * Apple Sign-In Button Component
 *
 * Displays a button with Apple branding that initiates the Apple OAuth flow.
 * Handles loading states, errors, and accessibility.
 * Supports dark mode styling (black background on dark mode, white on light mode).
 */
export const AppleSignInButton: React.FC<AppleSignInButtonProps> = ({
  onSignInStart,
  onSignInComplete,
  style,
  disabled: externalDisabled = false,
}) => {
  const { signInWithApple } = useAuth();
  const [loading, setLoading] = useState(false);

  const handlePress = async (isRetry = false) => {
    if (loading || externalDisabled) {
      return;
    }

    setLoading(true);
    onSignInStart?.();

    try {
      const result = await signInWithApple();

      if (result.error) {
        console.error('Apple sign-in error:', result.error);

        // Use comprehensive error handler
        const errorResult = handleOAuthError(result.error, {
          provider: 'apple',
          attemptNumber: isRetry ? 2 : 1,
        });

        // Handle user cancellation silently (no error shown per PRD)
        if (!errorResult.shouldShowError) {
          // User cancelled - silent return (no error shown per PRD)
          console.log('Apple sign-in was cancelled by user');
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
              // Retry after delay
              const delay = errorResult.retryDelay || 2000;
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
        console.log('Apple sign-in initiated successfully');

        // Show success feedback (brief, non-intrusive)
        // The auth state change listener will handle navigation
        // We don't show an alert here as it would be too intrusive
        // Success is indicated by navigation to the app
        onSignInComplete?.();
      }
    } catch (error) {
      console.error('Unexpected error during Apple sign-in:', error);

      // Use error handler for unexpected errors too
      const errorResult = handleOAuthError(error, {
        provider: 'apple',
        attemptNumber: isRetry ? 2 : 1,
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

  const isDisabled = loading || externalDisabled;

  // Apple button styling: dark gray background
  const buttonBackgroundColor = theme.colors.surface;
  const buttonBorderColor = theme.colors.border;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor: isDisabled
            ? theme.colors.disabled
            : buttonBackgroundColor,
          borderColor: isDisabled ? theme.colors.disabled : buttonBorderColor,
        },
        isDisabled && styles.buttonDisabled,
        style,
      ]}
      onPress={handlePress}
      disabled={isDisabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel="Continue with Apple"
      accessibilityHint="Sign in or create an account using your Apple ID"
      accessibilityState={{ disabled: isDisabled }}
      testID="apple-sign-in-button"
    >
      {loading ? (
        <View style={styles.loadingContainer} testID="apple-button-loading">
          <ActivityIndicator
            size="small"
            color={theme.colors.text}
            style={styles.loadingSpinner}
          />
          <Text
            style={[
              styles.buttonText,
              { color: theme.colors.text },
              isDisabled && styles.buttonTextDisabled,
            ]}
          >
            Signing in...
          </Text>
        </View>
      ) : (
        // Center the Apple logo inside the button
        <View style={styles.iconOnlyContent}>
          <View style={styles.iconContainer}>
            <Text style={styles.appleIcon}></Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
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
    opacity: 0.6,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOnlyContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appleIcon: {
    fontSize: 16,
    fontWeight: theme.typography.fontWeight.bold,
    color: '#FFFFFF',
  },
  buttonText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
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
});

export default AppleSignInButton;
