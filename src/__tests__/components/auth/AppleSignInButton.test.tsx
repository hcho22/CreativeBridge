/**
 * Apple Sign-In Button Component Tests
 *
 * Tests for Apple OAuth button component including user interactions,
 * error handling, network checks, dark mode support, and accessibility
 *
 * Based on: TASKS-oauth-google-apple-signin-PRD.md Task 5.5
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { AppleSignInButton } from '../../../components/auth/AppleSignInButton';
import { useAuth } from '../../../context/AuthContext';
import { checkNetworkBeforeOAuth, getNetworkErrorMessage } from '../../../utils/oauthNetworkCheck';
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
const mockCheckNetworkBeforeOAuth = checkNetworkBeforeOAuth as jest.MockedFunction<
  typeof checkNetworkBeforeOAuth
>;
const mockGetNetworkErrorMessage = getNetworkErrorMessage as jest.MockedFunction<
  typeof getNetworkErrorMessage
>;
const mockHandleOAuthError = handleOAuthError as jest.MockedFunction<typeof handleOAuthError>;

describe('AppleSignInButton', () => {
  let mockSignInWithApple: jest.Mock;
  let mockOnSignInStart: jest.Mock;
  let mockOnSignInComplete: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSignInWithApple = jest.fn().mockResolvedValue({ success: true });
    mockOnSignInStart = jest.fn();
    mockOnSignInComplete = jest.fn();

    mockUseAuth.mockReturnValue({
      signInWithApple: mockSignInWithApple,
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
    test('renders Apple sign-in button', () => {
      const { getByText } = render(<AppleSignInButton />);

      expect(getByText('Continue with Apple')).toBeTruthy();
    });

    test('renders with custom style', () => {
      const customStyle = { marginTop: 20 };
      const { getByText } = render(<AppleSignInButton style={customStyle} />);

      expect(getByText('Continue with Apple')).toBeTruthy();
    });

    test('renders in disabled state when disabled prop is true', () => {
      const { getByText } = render(<AppleSignInButton disabled={true} />);

      const button = getByText('Continue with Apple').parent;
      expect(button?.props.disabled).toBe(true);
    });
  });

  describe('User Interactions', () => {
    test('calls signInWithApple on button press', async () => {
      const { getByText } = render(<AppleSignInButton />);

      fireEvent.press(getByText('Continue with Apple'));

      await waitFor(() => {
        expect(mockSignInWithApple).toHaveBeenCalled();
      });
    });

    test('calls onSignInStart callback when provided', async () => {
      const { getByText } = render(
        <AppleSignInButton onSignInStart={mockOnSignInStart} />,
      );

      fireEvent.press(getByText('Continue with Apple'));

      await waitFor(() => {
        expect(mockOnSignInStart).toHaveBeenCalled();
      });
    });

    test('calls onSignInComplete callback on success', async () => {
      const { getByText } = render(
        <AppleSignInButton onSignInComplete={mockOnSignInComplete} />,
      );

      fireEvent.press(getByText('Continue with Apple'));

      await waitFor(() => {
        expect(mockOnSignInComplete).toHaveBeenCalled();
      });
    });

    test('does not initiate OAuth when disabled', async () => {
      const { getByText } = render(<AppleSignInButton disabled={true} />);

      fireEvent.press(getByText('Continue with Apple'));

      await waitFor(() => {
        expect(mockSignInWithApple).not.toHaveBeenCalled();
      });
    });
  });

  describe('Network Checking', () => {
    test('checks network before OAuth initiation', async () => {
      const { getByText } = render(<AppleSignInButton />);

      fireEvent.press(getByText('Continue with Apple'));

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

      const { getByText } = render(<AppleSignInButton />);

      fireEvent.press(getByText('Continue with Apple'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'No Internet Connection',
          expect.stringContaining('No internet connection'),
          expect.any(Array),
        );
      });
    });
  });

  describe('Error Handling', () => {
    test('handles OAuth errors gracefully', async () => {
      const error = 'Authentication failed';
      mockSignInWithApple.mockResolvedValue({ success: false, error });

      mockHandleOAuthError.mockReturnValue({
        shouldShowError: true,
        userMessage: 'Authentication failed. Please try again.',
        fallbackAvailable: true,
        canRetry: true,
        retryDelay: 2000,
      });

      const { getByText } = render(<AppleSignInButton />);

      fireEvent.press(getByText('Continue with Apple'));

      await waitFor(() => {
        expect(mockHandleOAuthError).toHaveBeenCalled();
      });
    });

    test('handles user cancellation silently (common with Apple Sign In)', async () => {
      const error = 'User cancelled';
      mockSignInWithApple.mockResolvedValue({ success: false, error });

      mockHandleOAuthError.mockReturnValue({
        shouldShowError: false,
        userMessage: '',
        fallbackAvailable: true,
        canRetry: false,
      });

      const { getByText } = render(<AppleSignInButton />);

      fireEvent.press(getByText('Continue with Apple'));

      await waitFor(() => {
        expect(mockHandleOAuthError).toHaveBeenCalled();
      });

      // Should not show error alert for user cancellation
      expect(Alert.alert).not.toHaveBeenCalled();
    });

    test('handles Apple private relay email scenarios', async () => {
      // Apple Sign In may return private relay emails
      // This is handled by Clerk, but we test that the flow works
      mockSignInWithApple.mockResolvedValue({
        success: true,
        userEmail: 'privaterelay@icloud.com',
      });

      const { getByText } = render(<AppleSignInButton />);

      fireEvent.press(getByText('Continue with Apple'));

      await waitFor(() => {
        expect(mockSignInWithApple).toHaveBeenCalled();
      });
    });
  });

  describe('Loading States', () => {
    test('shows loading indicator during OAuth', async () => {
      let resolveOAuth: (value: any) => void;
      const slowOAuth = new Promise(resolve => {
        resolveOAuth = resolve;
      });

      mockSignInWithApple.mockReturnValue(slowOAuth as any);

      const { getByText, queryByTestId } = render(<AppleSignInButton />);

      fireEvent.press(getByText('Continue with Apple'));

      // Should show loading indicator
      await waitFor(() => {
        expect(queryByTestId('apple-button-loading')).toBeTruthy();
      });

      // Resolve OAuth
      resolveOAuth!({ success: true });
    });

    test('disables button during OAuth', async () => {
      let resolveOAuth: (value: any) => void;
      const slowOAuth = new Promise(resolve => {
        resolveOAuth = resolve;
      });

      mockSignInWithApple.mockReturnValue(slowOAuth as any);

      const { getByText } = render(<AppleSignInButton />);
      const button = getByText('Continue with Apple').parent;

      fireEvent.press(getByText('Continue with Apple'));

      // Button should be disabled during OAuth
      await waitFor(() => {
        expect(button?.props.disabled).toBe(true);
      });

      resolveOAuth!({ success: true });
    });
  });

  describe('Success Feedback', () => {
    test('shows success feedback after successful OAuth', async () => {
      mockSignInWithApple.mockResolvedValue({ success: true });

      const { getByText, queryByTestId } = render(<AppleSignInButton />);

      fireEvent.press(getByText('Continue with Apple'));

      await waitFor(() => {
        // Success indicator should appear briefly
        expect(queryByTestId('apple-button-success')).toBeTruthy();
      });
    });
  });

  describe('Accessibility', () => {
    test('has accessibility label', () => {
      const { getByLabelText } = render(<AppleSignInButton />);

      expect(getByLabelText('Continue with Apple')).toBeTruthy();
    });

    test('has accessibility hint', () => {
      const { getByLabelText } = render(<AppleSignInButton />);

      const button = getByLabelText('Continue with Apple');
      expect(button.props.accessibilityHint).toBeDefined();
    });
  });
});

