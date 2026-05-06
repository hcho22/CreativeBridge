/**
 * Google Sign-In Button Component Tests
 *
 * Tests for Google OAuth button component including user interactions,
 * error handling, network checks, and accessibility
 *
 * Based on: TASKS-oauth-google-apple-signin-PRD.md Task 5.5
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { GoogleSignInButton } from '../../../components/auth/GoogleSignInButton';
import { useAuth } from '../../../context/AuthContext';
import {
  checkNetworkBeforeOAuth,
  getNetworkErrorMessage,
} from '../../../utils/oauthNetworkCheck';
import { handleOAuthError } from '../../../utils/oauthErrorHandler';

// Mock dependencies
jest.mock('../../../context/AuthContext');
jest.mock('../../../utils/oauthNetworkCheck');
jest.mock('../../../utils/oauthErrorHandler');
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Alert: {
      alert: jest.fn(),
    },
  };
});

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockCheckNetworkBeforeOAuth =
  checkNetworkBeforeOAuth as jest.MockedFunction<
    typeof checkNetworkBeforeOAuth
  >;
const mockGetNetworkErrorMessage =
  getNetworkErrorMessage as jest.MockedFunction<typeof getNetworkErrorMessage>;
const mockHandleOAuthError = handleOAuthError as jest.MockedFunction<
  typeof handleOAuthError
>;

describe('GoogleSignInButton', () => {
  let mockSignInWithGoogle: jest.Mock;
  let mockOnSignInStart: jest.Mock;
  let mockOnSignInComplete: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSignInWithGoogle = jest.fn().mockResolvedValue({ success: true });
    mockOnSignInStart = jest.fn();
    mockOnSignInComplete = jest.fn();

    mockUseAuth.mockReturnValue({
      signInWithGoogle: mockSignInWithGoogle,
    } as any);

    mockCheckNetworkBeforeOAuth.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
      connectionType: 'wifi',
    });

    mockGetNetworkErrorMessage.mockReturnValue(null);
    mockHandleOAuthError.mockReturnValue({
      shouldShowError: false,
      userMessage: '',
      fallbackAvailable: true,
      canRetry: false,
    });
  });

  describe('Rendering', () => {
    test('renders Google sign-in button', () => {
      const { getByLabelText } = render(<GoogleSignInButton />);

      expect(getByLabelText('Continue with Google')).toBeTruthy();
    });

    test('renders with custom style', () => {
      const customStyle = { marginTop: 20 };
      const { getByLabelText } = render(
        <GoogleSignInButton style={customStyle} />,
      );

      expect(getByLabelText('Continue with Google')).toBeTruthy();
    });

    test('renders in disabled state when disabled prop is true', () => {
      const { getByLabelText } = render(<GoogleSignInButton disabled={true} />);

      const button = getByLabelText('Continue with Google');
      expect(button?.props.disabled).toBe(true);
    });
  });

  describe('User Interactions', () => {
    test('calls signInWithGoogle on button press', async () => {
      const { getByLabelText } = render(<GoogleSignInButton />);

      fireEvent.press(getByLabelText('Continue with Google'));

      await waitFor(() => {
        expect(mockSignInWithGoogle).toHaveBeenCalled();
      });
    });

    test('calls onSignInStart callback when provided', async () => {
      const { getByLabelText } = render(
        <GoogleSignInButton onSignInStart={mockOnSignInStart} />,
      );

      fireEvent.press(getByLabelText('Continue with Google'));

      await waitFor(() => {
        expect(mockOnSignInStart).toHaveBeenCalled();
      });
    });

    test('calls onSignInComplete callback on success', async () => {
      const { getByLabelText } = render(
        <GoogleSignInButton onSignInComplete={mockOnSignInComplete} />,
      );

      fireEvent.press(getByLabelText('Continue with Google'));

      await waitFor(() => {
        expect(mockOnSignInComplete).toHaveBeenCalled();
      });
    });

    test('does not initiate OAuth when disabled', async () => {
      const { getByLabelText } = render(<GoogleSignInButton disabled={true} />);

      fireEvent.press(getByLabelText('Continue with Google'));

      await waitFor(() => {
        expect(mockSignInWithGoogle).not.toHaveBeenCalled();
      });
    });
  });

  describe('Network Checking', () => {
    test('checks network before OAuth initiation', async () => {
      const { getByLabelText } = render(<GoogleSignInButton />);

      fireEvent.press(getByLabelText('Continue with Google'));

      await waitFor(() => {
        expect(mockCheckNetworkBeforeOAuth).toHaveBeenCalled();
      });
    });

    test('shows network error alert when offline', async () => {
      mockCheckNetworkBeforeOAuth.mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
        connectionType: 'none',
      });

      mockGetNetworkErrorMessage.mockReturnValue(
        'No internet connection. Please check your network settings and try again.',
      );

      const { getByLabelText } = render(<GoogleSignInButton />);

      fireEvent.press(getByLabelText('Continue with Google'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'No Internet Connection',
          expect.stringContaining('No internet connection'),
          expect.any(Array),
        );
      });
    });

    test('allows retry after network error', async () => {
      mockCheckNetworkBeforeOAuth.mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
        connectionType: 'none',
      });

      mockGetNetworkErrorMessage.mockReturnValue(
        'No internet connection. Please check your network settings and try again.',
      );

      const { getByLabelText } = render(<GoogleSignInButton />);

      fireEvent.press(getByLabelText('Continue with Google'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });

      // Simulate retry
      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const retryButton = alertCall[2]?.find(
        (btn: any) => btn.text === 'Retry',
      );
      if (retryButton) {
        retryButton.onPress();
        await waitFor(() => {
          expect(mockCheckNetworkBeforeOAuth).toHaveBeenCalledTimes(2);
        });
      }
    });
  });

  describe('Error Handling', () => {
    test('handles OAuth errors gracefully', async () => {
      const error = 'Authentication failed';
      mockSignInWithGoogle.mockResolvedValue({ success: false, error });

      mockHandleOAuthError.mockReturnValue({
        shouldShowError: true,
        userMessage: 'Authentication failed. Please try again.',
        fallbackAvailable: true,
        canRetry: true,
        retryDelay: 2000,
      });

      const { getByLabelText } = render(<GoogleSignInButton />);

      fireEvent.press(getByLabelText('Continue with Google'));

      await waitFor(() => {
        expect(mockHandleOAuthError).toHaveBeenCalled();
      });
    });

    test('shows error alert for retryable errors', async () => {
      const error = 'Network error';
      mockSignInWithGoogle.mockResolvedValue({ success: false, error });

      mockHandleOAuthError.mockReturnValue({
        shouldShowError: true,
        userMessage:
          'Connection error. Please check your internet connection and try again.',
        fallbackAvailable: true,
        canRetry: true,
        retryDelay: 2000,
      });

      const { getByLabelText } = render(<GoogleSignInButton />);

      fireEvent.press(getByLabelText('Continue with Google'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Sign-In Error',
          expect.stringContaining('Connection error'),
          expect.any(Array),
        );
      });
    });

    test('handles user cancellation silently', async () => {
      const error = 'User cancelled';
      mockSignInWithGoogle.mockResolvedValue({ success: false, error });

      mockHandleOAuthError.mockReturnValue({
        shouldShowError: false,
        userMessage: '',
        fallbackAvailable: true,
        canRetry: false,
      });

      const { getByLabelText } = render(<GoogleSignInButton />);

      fireEvent.press(getByLabelText('Continue with Google'));

      await waitFor(() => {
        expect(mockHandleOAuthError).toHaveBeenCalled();
      });

      // Should not show error alert for user cancellation
      expect(Alert.alert).not.toHaveBeenCalled();
    });

    test('provides retry option for retryable errors', async () => {
      const error = 'Network error';
      mockSignInWithGoogle.mockResolvedValue({ success: false, error });

      mockHandleOAuthError.mockReturnValue({
        shouldShowError: true,
        userMessage: 'Connection error. Please try again.',
        fallbackAvailable: true,
        canRetry: true,
        retryDelay: 2000,
      });

      const { getByLabelText } = render(<GoogleSignInButton />);

      fireEvent.press(getByLabelText('Continue with Google'));

      await waitFor(() => {
        const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
        const buttons = alertCall[2];
        const retryButton = buttons?.find((btn: any) => btn.text === 'Retry');
        expect(retryButton).toBeDefined();
      });
    });
  });

  describe('Loading States', () => {
    test('shows loading indicator during OAuth', async () => {
      let resolveOAuth: (value: any) => void;
      const slowOAuth = new Promise(resolve => {
        resolveOAuth = resolve;
      });

      mockSignInWithGoogle.mockReturnValue(slowOAuth as any);

      const { getByLabelText, queryByTestId } = render(<GoogleSignInButton />);

      fireEvent.press(getByLabelText('Continue with Google'));

      // Should show loading indicator
      await waitFor(() => {
        // Loading indicator should be visible
        expect(queryByTestId('google-button-loading')).toBeTruthy();
      });

      // Resolve OAuth
      resolveOAuth!({ success: true });
    });

    test('disables button during OAuth', async () => {
      let resolveOAuth: (value: any) => void;
      const slowOAuth = new Promise(resolve => {
        resolveOAuth = resolve;
      });

      mockSignInWithGoogle.mockReturnValue(slowOAuth as any);

      const { getByLabelText } = render(<GoogleSignInButton />);
      const button = getByLabelText('Continue with Google');

      fireEvent.press(getByLabelText('Continue with Google'));

      // Button should be disabled during OAuth
      await waitFor(() => {
        expect(button?.props.disabled).toBe(true);
      });

      resolveOAuth!({ success: true });
    });
  });

  describe('Success Feedback', () => {
    test('shows success feedback after successful OAuth', async () => {
      mockSignInWithGoogle.mockResolvedValue({ success: true });

      const { getByLabelText, queryByTestId } = render(<GoogleSignInButton />);

      fireEvent.press(getByLabelText('Continue with Google'));

      await waitFor(() => {
        // Success indicator should appear briefly
        expect(queryByTestId('google-button-success')).toBeTruthy();
      });
    });
  });

  describe('Accessibility', () => {
    test('has accessibility label', () => {
      const { getByLabelText } = render(<GoogleSignInButton />);

      expect(getByLabelText('Continue with Google')).toBeTruthy();
    });

    test('has accessibility hint', () => {
      const { getByLabelText } = render(<GoogleSignInButton />);

      const button = getByLabelText('Continue with Google');
      expect(button.props.accessibilityHint).toBeDefined();
    });
  });
});
