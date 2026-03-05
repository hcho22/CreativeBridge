import React, { Component, ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
// Conditionally import reactotron only in dev to avoid production bundle issues
let reactotron: { error?: (...args: unknown[]) => void } = {};
if (__DEV__) {
  try {
    reactotron = require('../../services/reactotron').default;
  } catch {
    // Reactotron not available
  }
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: string) => void;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log to Reactotron in development
    if (__DEV__) {
      reactotron.error?.('🚨 Error Boundary Caught Error', {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      });
    }

    // Log to console for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Update state with error info
    this.setState({
      errorInfo: errorInfo.componentStack || null,
    });

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo.componentStack || '');
  }

  handleRestart = (): void => {
    // Reset error boundary state
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleShowDetails = (): void => {
    const { error, errorInfo } = this.state;

    if (!error) return;

    const errorMessage = `
Error: ${error.message}

Stack Trace:
${error.stack || 'No stack trace available'}

Component Stack:
${errorInfo || 'No component stack available'}
    `.trim();

    Alert.alert(
      'Error Details',
      errorMessage,
      [
        {
          text: 'Copy Error',
          onPress: () => {
            // In a real app, you might want to copy to clipboard
            console.log('Error details:', errorMessage);
          },
        },
        { text: 'OK' },
      ],
      { cancelable: true },
    );
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      // If a custom fallback is provided, use it
      if (fallback) {
        return fallback;
      }

      // Default error UI
      return (
        <View style={styles.errorContainer}>
          <ScrollView contentContainerStyle={styles.errorContent}>
            <Text style={styles.errorEmoji}>💥</Text>
            <Text style={styles.errorTitle}>Oops! Something went wrong</Text>
            <Text style={styles.errorMessage}>
              We're sorry, but something unexpected happened. The app
              encountered an error and couldn't continue.
            </Text>

            {__DEV__ && error && (
              <View style={styles.errorDetails}>
                <Text style={styles.errorDetailsTitle}>
                  Error Details (Debug Mode):
                </Text>
                <Text style={styles.errorDetailsText}>{error.message}</Text>
              </View>
            )}

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                onPress={this.handleRestart}
              >
                <Text style={styles.primaryButtonText}>Try Again</Text>
              </TouchableOpacity>

              {__DEV__ && (
                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton]}
                  onPress={this.handleShowDetails}
                >
                  <Text style={styles.secondaryButtonText}>Show Details</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.helpText}>
              If this problem persists, please restart the app or contact
              support.
            </Text>
          </ScrollView>
        </View>
      );
    }

    return children;
  }
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  errorContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: '100%',
  },
  errorEmoji: {
    fontSize: 64,
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#dc3545',
    textAlign: 'center',
    marginBottom: 16,
  },
  errorMessage: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  errorDetails: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    width: '100%',
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  errorDetailsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
  },
  errorDetailsText: {
    fontSize: 12,
    color: '#6c757d',
    fontFamily: 'monospace',
  },
  buttonContainer: {
    flexDirection: 'column',
    gap: 12,
    width: '100%',
    maxWidth: 300,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#007bff',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#6c757d',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#6c757d',
    fontSize: 16,
    fontWeight: '500',
  },
  helpText: {
    fontSize: 14,
    color: '#adb5bd',
    textAlign: 'center',
    marginTop: 24,
    fontStyle: 'italic',
  },
});

export default ErrorBoundary;
