/**
 * Clerk Email/Password Sign-Up Flow Integration Tests
 *
 * Verifies the complete sign-up flow with email verification (US-002, US-003, US-004):
 * 1. User fills in sign-up form (email, password, username, grade level, terms)
 * 2. Clerk creates account and sends 6-digit verification code via email
 * 3. User enters verification code on the verification screen
 * 4. Clerk verifies code, activates session, and creates Convex profile
 *
 * Also covers: resend code, error handling, navigation between screens.
 */

import React from 'react';
import {
  render,
  fireEvent,
  waitFor,
  screen,
} from '@testing-library/react-native';
import { Alert } from 'react-native';

// Override the jest.setup.js react-native mock to include KeyboardAvoidingView
jest.mock('react-native', () => {
  const React = require('react');
  const createComponent = (name: string) =>
    React.forwardRef((props: any, ref: any) =>
      React.createElement(name, { ...props, ref }, props.children),
    );
  return {
    StyleSheet: {
      create: jest.fn((styles: any) => styles),
      absoluteFill: {},
      absoluteFillObject: {},
      flatten: jest.fn((style: any) => style),
    },
    Dimensions: {
      get: jest.fn(() => ({ width: 375, height: 812 })),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    },
    Alert: { alert: jest.fn() },
    Platform: {
      OS: 'ios',
      select: jest.fn((config: any) => config.ios || config.default),
    },
    View: createComponent('View'),
    Text: createComponent('Text'),
    TextInput: createComponent('TextInput'),
    TouchableOpacity: createComponent('TouchableOpacity'),
    ScrollView: createComponent('ScrollView'),
    KeyboardAvoidingView: createComponent('KeyboardAvoidingView'),
    ActivityIndicator: createComponent('ActivityIndicator'),
  };
});

// Mock expo-secure-store (transitive dependency via AuthContext → clerkTokenCache)
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

// Mock the entire AuthContext module
jest.mock('../../context/AuthContext');

import AuthScreen from '../../screens/AuthScreen';
import { useAuth } from '../../context/AuthContext';

// Mock Alert.alert to capture calls
jest.spyOn(Alert, 'alert');

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

// Mock validation utilities with default valid results
jest.mock('../../utils/emailValidation', () => ({
  validateEmail: jest.fn().mockResolvedValue({
    isValid: true,
    errors: [],
    warnings: [],
  }),
}));

jest.mock('../../utils/passwordValidation', () => ({
  validatePassword: jest.fn().mockReturnValue({
    isValid: true,
    score: 4,
    feedback: ['Strong password'],
  }),
  PasswordValidator: {
    getStrengthColor: jest.fn().mockReturnValue('#44aa44'),
    getStrengthLabel: jest.fn().mockReturnValue('Strong'),
  },
}));

jest.mock('../../utils/usernameValidation', () => ({
  validateUsername: jest.fn().mockResolvedValue({
    isValid: true,
    errors: [],
    warnings: [],
  }),
}));

jest.mock('../../utils/rememberMeStorage', () => ({
  RememberMeStorage: {
    setRememberMe: jest.fn(),
    getRememberMe: jest.fn().mockResolvedValue({ isEnabled: false }),
    clearRememberMe: jest.fn(),
  },
}));

// Mock navigation
jest.mock('@react-navigation/stack', () => ({
  StackNavigationProp: {},
}));

// Mock auth button components
jest.mock('../../components/auth/GoogleSignInButton', () => ({
  GoogleSignInButton: () => null,
}));

jest.mock('../../components/auth/AppleSignInButton', () => ({
  AppleSignInButton: () => null,
}));

jest.mock('../../components/common/OAuthSessionHelpModal', () => ({
  OAuthSessionHelpModal: () => null,
  OAuthProvider: {},
}));

// Helper to create a mock useAuth return value with all required fields
function createMockAuthContext(
  overrides: Partial<ReturnType<typeof useAuth>> = {},
) {
  return {
    user: null,
    session: null,
    userProfile: null,
    loading: false,
    emailConfirmed: true,
    needsProfileCompletion: false,
    oauthError: null,
    signIn: jest.fn().mockResolvedValue({}),
    signUp: jest.fn().mockResolvedValue({}),
    signOut: jest.fn().mockResolvedValue(undefined),
    updateProfile: jest.fn().mockResolvedValue(undefined),
    refreshProfile: jest.fn().mockResolvedValue(undefined),
    resendConfirmation: jest.fn().mockResolvedValue({}),
    checkEmailConfirmation: jest.fn().mockResolvedValue(false),
    addXp: jest.fn().mockResolvedValue(undefined),
    deductXp: jest.fn().mockResolvedValue({ success: true }),
    signInWithGoogle: jest.fn().mockResolvedValue({}),
    signInWithApple: jest.fn().mockResolvedValue({}),
    checkProfileCompletion: jest.fn().mockResolvedValue(undefined),
    clearOAuthError: jest.fn(),
    signUpWithClerk: jest.fn().mockResolvedValue({ needsVerification: true }),
    verifyEmailCode: jest.fn().mockResolvedValue({}),
    resendClerkVerificationCode: jest.fn().mockResolvedValue({}),
    signInWithClerk: jest.fn().mockResolvedValue({}),
    verifySignInSecondFactor: jest.fn().mockResolvedValue({}),
    resetPasswordWithClerk: jest.fn().mockResolvedValue({}),
    verifyPasswordResetCode: jest.fn().mockResolvedValue({}),
    migrateFromSupabase: jest.fn().mockResolvedValue({}),
    createImageGenerationEvent: jest.fn().mockResolvedValue(null),
    logImageGenerationResult: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as ReturnType<typeof useAuth>;
}

describe('Clerk Email/Password Sign-Up Flow', () => {
  let mockSignUpWithClerk: jest.Mock;
  let mockVerifyEmailCode: jest.Mock;
  let mockResendClerkVerificationCode: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSignUpWithClerk = jest
      .fn()
      .mockResolvedValue({ needsVerification: true });
    mockVerifyEmailCode = jest.fn().mockResolvedValue({});
    mockResendClerkVerificationCode = jest.fn().mockResolvedValue({});

    mockUseAuth.mockReturnValue(
      createMockAuthContext({
        signUpWithClerk: mockSignUpWithClerk,
        verifyEmailCode: mockVerifyEmailCode,
        resendClerkVerificationCode: mockResendClerkVerificationCode,
      }),
    );
  });

  // ===========================================================================
  // Happy Path: Complete Sign-Up → Email Verification
  // ===========================================================================

  describe('Complete Sign-Up → Email Verification Flow', () => {
    it('should complete full sign-up and show verification screen', async () => {
      render(<AuthScreen />);

      // Switch to sign-up mode
      const signUpTab = screen.getByText('Sign Up');
      fireEvent.press(signUpTab);

      // Fill in all required fields
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your email')).toBeTruthy();
      });

      fireEvent.changeText(
        screen.getByPlaceholderText('Enter your email'),
        'newuser@example.com',
      );
      fireEvent.changeText(
        screen.getByPlaceholderText('Enter your password'),
        'StrongPass123!',
      );
      fireEvent.changeText(
        screen.getByPlaceholderText('Choose a username'),
        'newuser',
      );

      // Select grade level
      const gradeOption = screen.getByText('Kindergarten - 2nd Grade');
      fireEvent.press(gradeOption);

      // Accept terms
      const termsCheckbox = screen.getByText(/I agree to the/);
      fireEvent.press(termsCheckbox);

      // Submit sign-up form
      const createAccountButton = screen.getByText('Create Account');
      fireEvent.press(createAccountButton);

      // Wait for signUpWithClerk to be called
      await waitFor(() => {
        expect(mockSignUpWithClerk).toHaveBeenCalledWith(
          'newuser@example.com',
          'StrongPass123!',
          expect.objectContaining({
            username: 'newuser',
            gradeLevel: 'K-2',
          }),
        );
      });

      // After successful sign-up, verification screen should appear
      await waitFor(() => {
        expect(screen.getByText('Verify Email')).toBeTruthy();
        expect(screen.getByText('Check Your Inbox')).toBeTruthy();
      });
    });

    it('should verify email code and complete registration', async () => {
      render(<AuthScreen />);

      // Switch to sign-up mode and fill form
      fireEvent.press(screen.getByText('Sign Up'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your email')).toBeTruthy();
      });

      fireEvent.changeText(
        screen.getByPlaceholderText('Enter your email'),
        'newuser@example.com',
      );
      fireEvent.changeText(
        screen.getByPlaceholderText('Enter your password'),
        'StrongPass123!',
      );
      fireEvent.changeText(
        screen.getByPlaceholderText('Choose a username'),
        'newuser',
      );
      fireEvent.press(screen.getByText('Kindergarten - 2nd Grade'));
      fireEvent.press(screen.getByText(/I agree to the/));
      fireEvent.press(screen.getByText('Create Account'));

      // Wait for verification screen
      await waitFor(() => {
        expect(screen.getByText('Verify Email')).toBeTruthy();
      });

      // Enter 6-digit verification code
      const codeInput = screen.getByPlaceholderText('000000');
      fireEvent.changeText(codeInput, '123456');

      // Submit verification code
      const verifyButton = screen.getByText('Verify');
      fireEvent.press(verifyButton);

      await waitFor(() => {
        expect(mockVerifyEmailCode).toHaveBeenCalledWith('123456');
      });
    });

    it('should show email address on verification screen', async () => {
      render(<AuthScreen />);

      // Switch to sign-up mode
      fireEvent.press(screen.getByText('Sign Up'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your email')).toBeTruthy();
      });

      // Fill form with specific email
      fireEvent.changeText(
        screen.getByPlaceholderText('Enter your email'),
        'johndoe@example.com',
      );
      fireEvent.changeText(
        screen.getByPlaceholderText('Enter your password'),
        'StrongPass123!',
      );
      fireEvent.changeText(
        screen.getByPlaceholderText('Choose a username'),
        'johndoe',
      );
      fireEvent.press(screen.getByText('3rd - 5th Grade'));
      fireEvent.press(screen.getByText(/I agree to the/));
      fireEvent.press(screen.getByText('Create Account'));

      // Verification screen should show the email
      await waitFor(() => {
        expect(screen.getByText('johndoe@example.com')).toBeTruthy();
      });
    });
  });

  // ===========================================================================
  // Form Validation
  // ===========================================================================

  describe('Sign-Up Form Validation', () => {
    it('should show error when fields are empty', async () => {
      render(<AuthScreen />);

      // Switch to sign-up mode
      fireEvent.press(screen.getByText('Sign Up'));

      await waitFor(() => {
        expect(screen.getByText('Create Account')).toBeTruthy();
      });

      // Try to submit empty form
      fireEvent.press(screen.getByText('Create Account'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Error',
          'Please fill in all fields',
        );
      });
    });

    it('should show error when grade level is not selected', async () => {
      render(<AuthScreen />);

      fireEvent.press(screen.getByText('Sign Up'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your email')).toBeTruthy();
      });

      fireEvent.changeText(
        screen.getByPlaceholderText('Enter your email'),
        'test@example.com',
      );
      fireEvent.changeText(
        screen.getByPlaceholderText('Enter your password'),
        'StrongPass123!',
      );
      fireEvent.changeText(
        screen.getByPlaceholderText('Choose a username'),
        'testuser',
      );

      // Don't select grade level — accept terms
      fireEvent.press(screen.getByText(/I agree to the/));
      fireEvent.press(screen.getByText('Create Account'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Error',
          'Please select your grade level',
        );
      });
    });

    it('should show error when terms are not accepted', async () => {
      render(<AuthScreen />);

      fireEvent.press(screen.getByText('Sign Up'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your email')).toBeTruthy();
      });

      fireEvent.changeText(
        screen.getByPlaceholderText('Enter your email'),
        'test@example.com',
      );
      fireEvent.changeText(
        screen.getByPlaceholderText('Enter your password'),
        'StrongPass123!',
      );
      fireEvent.changeText(
        screen.getByPlaceholderText('Choose a username'),
        'testuser',
      );
      fireEvent.press(screen.getByText('Kindergarten - 2nd Grade'));

      // Don't accept terms
      fireEvent.press(screen.getByText('Create Account'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Error',
          'Please accept the Terms of Service to continue',
        );
      });
    });
  });

  // ===========================================================================
  // Verification Code Validation
  // ===========================================================================

  describe('Verification Code Input', () => {
    async function navigateToVerificationScreen() {
      render(<AuthScreen />);

      fireEvent.press(screen.getByText('Sign Up'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your email')).toBeTruthy();
      });

      fireEvent.changeText(
        screen.getByPlaceholderText('Enter your email'),
        'test@example.com',
      );
      fireEvent.changeText(
        screen.getByPlaceholderText('Enter your password'),
        'StrongPass123!',
      );
      fireEvent.changeText(
        screen.getByPlaceholderText('Choose a username'),
        'testuser',
      );
      fireEvent.press(screen.getByText('Kindergarten - 2nd Grade'));
      fireEvent.press(screen.getByText(/I agree to the/));
      fireEvent.press(screen.getByText('Create Account'));

      await waitFor(() => {
        expect(screen.getByText('Verify Email')).toBeTruthy();
      });
    }

    it('should show error for incomplete verification code', async () => {
      await navigateToVerificationScreen();

      // Enter only 3 digits
      fireEvent.changeText(screen.getByPlaceholderText('000000'), '123');

      // Verify button should be disabled for codes < 6 digits
      const verifyButton = screen.getByText('Verify');
      fireEvent.press(verifyButton);

      // verifyEmailCode should NOT be called
      expect(mockVerifyEmailCode).not.toHaveBeenCalled();
    });

    it('should strip non-numeric characters from verification code', async () => {
      await navigateToVerificationScreen();

      // Enter text with non-numeric characters
      const codeInput = screen.getByPlaceholderText('000000');
      fireEvent.changeText(codeInput, '12ab34cd56');

      // Only digits should remain, and max 6 characters
      expect(codeInput.props.value).toBe('123456');
    });

    it('should handle invalid verification code error', async () => {
      mockVerifyEmailCode.mockResolvedValueOnce({
        error: 'Invalid verification code. Please check and try again.',
      });

      await navigateToVerificationScreen();

      fireEvent.changeText(screen.getByPlaceholderText('000000'), '000000');
      fireEvent.press(screen.getByText('Verify'));

      await waitFor(() => {
        expect(
          screen.getByText(
            'Invalid verification code. Please check and try again.',
          ),
        ).toBeTruthy();
      });
    });

    it('should handle expired verification code error', async () => {
      mockVerifyEmailCode.mockResolvedValueOnce({
        error: 'Verification code has expired. Please request a new code.',
      });

      await navigateToVerificationScreen();

      fireEvent.changeText(screen.getByPlaceholderText('000000'), '999999');
      fireEvent.press(screen.getByText('Verify'));

      await waitFor(() => {
        expect(
          screen.getByText(
            'Verification code has expired. Please request a new code.',
          ),
        ).toBeTruthy();
      });
    });
  });

  // ===========================================================================
  // Resend Verification Code
  // ===========================================================================

  describe('Resend Verification Code', () => {
    async function navigateToVerificationScreen() {
      render(<AuthScreen />);

      fireEvent.press(screen.getByText('Sign Up'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your email')).toBeTruthy();
      });

      fireEvent.changeText(
        screen.getByPlaceholderText('Enter your email'),
        'test@example.com',
      );
      fireEvent.changeText(
        screen.getByPlaceholderText('Enter your password'),
        'StrongPass123!',
      );
      fireEvent.changeText(
        screen.getByPlaceholderText('Choose a username'),
        'testuser',
      );
      fireEvent.press(screen.getByText('Kindergarten - 2nd Grade'));
      fireEvent.press(screen.getByText(/I agree to the/));
      fireEvent.press(screen.getByText('Create Account'));

      await waitFor(() => {
        expect(screen.getByText('Verify Email')).toBeTruthy();
      });
    }

    it('should resend verification code successfully', async () => {
      await navigateToVerificationScreen();

      const resendButton = screen.getByText('Resend Code');
      fireEvent.press(resendButton);

      await waitFor(() => {
        expect(mockResendClerkVerificationCode).toHaveBeenCalled();
      });

      // Should show success alert
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Code Sent',
          'A new verification code has been sent to your email.',
        );
      });
    });

    it('should handle resend failure', async () => {
      mockResendClerkVerificationCode.mockResolvedValueOnce({
        error: 'Too many attempts. Please wait a moment and try again.',
      });

      await navigateToVerificationScreen();

      fireEvent.press(screen.getByText('Resend Code'));

      await waitFor(() => {
        expect(
          screen.getByText(
            'Too many attempts. Please wait a moment and try again.',
          ),
        ).toBeTruthy();
      });
    });
  });

  // ===========================================================================
  // Navigation: Back from Verification
  // ===========================================================================

  describe('Navigation', () => {
    it('should go back from verification to sign-up form', async () => {
      render(<AuthScreen />);

      fireEvent.press(screen.getByText('Sign Up'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your email')).toBeTruthy();
      });

      fireEvent.changeText(
        screen.getByPlaceholderText('Enter your email'),
        'test@example.com',
      );
      fireEvent.changeText(
        screen.getByPlaceholderText('Enter your password'),
        'StrongPass123!',
      );
      fireEvent.changeText(
        screen.getByPlaceholderText('Choose a username'),
        'testuser',
      );
      fireEvent.press(screen.getByText('Kindergarten - 2nd Grade'));
      fireEvent.press(screen.getByText(/I agree to the/));
      fireEvent.press(screen.getByText('Create Account'));

      // Wait for verification screen
      await waitFor(() => {
        expect(screen.getByText('Verify Email')).toBeTruthy();
      });

      // Press back button
      fireEvent.press(screen.getByText('Back to Sign Up'));

      // Should return to sign-up form
      await waitFor(() => {
        expect(screen.getByText('Create Account')).toBeTruthy();
        expect(screen.queryByText('Verify Email')).toBeNull();
      });
    });
  });

  // ===========================================================================
  // Sign-Up Error Handling
  // ===========================================================================

  describe('Sign-Up Error Handling', () => {
    it('should show error when email is already registered', async () => {
      mockSignUpWithClerk.mockResolvedValueOnce({
        error:
          'This email address is already registered. Please sign in instead.',
      });

      render(<AuthScreen />);

      fireEvent.press(screen.getByText('Sign Up'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your email')).toBeTruthy();
      });

      fireEvent.changeText(
        screen.getByPlaceholderText('Enter your email'),
        'existing@example.com',
      );
      fireEvent.changeText(
        screen.getByPlaceholderText('Enter your password'),
        'StrongPass123!',
      );
      fireEvent.changeText(
        screen.getByPlaceholderText('Choose a username'),
        'existinguser',
      );
      fireEvent.press(screen.getByText('Kindergarten - 2nd Grade'));
      fireEvent.press(screen.getByText(/I agree to the/));
      fireEvent.press(screen.getByText('Create Account'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Error',
          'This email address is already registered. Please sign in instead.',
        );
      });

      // Should NOT show verification screen
      expect(screen.queryByText('Verify Email')).toBeNull();
    });

    it('should show error when password is in a data breach', async () => {
      mockSignUpWithClerk.mockResolvedValueOnce({
        error:
          'This password has appeared in a known data breach. Please choose a different, unique password for your security.',
      });

      render(<AuthScreen />);

      fireEvent.press(screen.getByText('Sign Up'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your email')).toBeTruthy();
      });

      fireEvent.changeText(
        screen.getByPlaceholderText('Enter your email'),
        'test@example.com',
      );
      fireEvent.changeText(
        screen.getByPlaceholderText('Enter your password'),
        'password123',
      );
      fireEvent.changeText(
        screen.getByPlaceholderText('Choose a username'),
        'testuser',
      );
      fireEvent.press(screen.getByText('Kindergarten - 2nd Grade'));
      fireEvent.press(screen.getByText(/I agree to the/));
      fireEvent.press(screen.getByText('Create Account'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Error',
          expect.stringContaining('data breach'),
        );
      });
    });

    it('should show error for rate limiting', async () => {
      mockSignUpWithClerk.mockResolvedValueOnce({
        error: 'Too many sign-up attempts. Please wait a moment and try again.',
      });

      render(<AuthScreen />);

      fireEvent.press(screen.getByText('Sign Up'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your email')).toBeTruthy();
      });

      fireEvent.changeText(
        screen.getByPlaceholderText('Enter your email'),
        'test@example.com',
      );
      fireEvent.changeText(
        screen.getByPlaceholderText('Enter your password'),
        'StrongPass123!',
      );
      fireEvent.changeText(
        screen.getByPlaceholderText('Choose a username'),
        'testuser',
      );
      fireEvent.press(screen.getByText('Kindergarten - 2nd Grade'));
      fireEvent.press(screen.getByText(/I agree to the/));
      fireEvent.press(screen.getByText('Create Account'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Error',
          expect.stringContaining('Too many'),
        );
      });
    });
  });

  // ===========================================================================
  // Verification Screen UI State
  // ===========================================================================

  describe('Verification Screen UI', () => {
    async function navigateToVerificationScreen() {
      render(<AuthScreen />);

      fireEvent.press(screen.getByText('Sign Up'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your email')).toBeTruthy();
      });

      fireEvent.changeText(
        screen.getByPlaceholderText('Enter your email'),
        'test@example.com',
      );
      fireEvent.changeText(
        screen.getByPlaceholderText('Enter your password'),
        'StrongPass123!',
      );
      fireEvent.changeText(
        screen.getByPlaceholderText('Choose a username'),
        'testuser',
      );
      fireEvent.press(screen.getByText('Kindergarten - 2nd Grade'));
      fireEvent.press(screen.getByText(/I agree to the/));
      fireEvent.press(screen.getByText('Create Account'));

      await waitFor(() => {
        expect(screen.getByText('Verify Email')).toBeTruthy();
      });
    }

    it('should show spam folder help text', async () => {
      await navigateToVerificationScreen();

      expect(
        screen.getByText("Check your spam folder if you don't see the email"),
      ).toBeTruthy();
    });

    it('should have Resend Code and Back to Sign Up buttons', async () => {
      await navigateToVerificationScreen();

      expect(screen.getByText('Resend Code')).toBeTruthy();
      expect(screen.getByText('Back to Sign Up')).toBeTruthy();
    });

    it('should have numeric keyboard for code input', async () => {
      await navigateToVerificationScreen();

      const codeInput = screen.getByPlaceholderText('000000');
      expect(codeInput.props.keyboardType).toBe('number-pad');
      expect(codeInput.props.maxLength).toBe(6);
    });

    it('should support iOS one-time code autofill', async () => {
      await navigateToVerificationScreen();

      const codeInput = screen.getByPlaceholderText('000000');
      expect(codeInput.props.textContentType).toBe('oneTimeCode');
    });

    it('should clear verification error when user types new code', async () => {
      mockVerifyEmailCode.mockResolvedValueOnce({
        error: 'Invalid verification code. Please check and try again.',
      });

      await navigateToVerificationScreen();

      // Enter wrong code and verify
      fireEvent.changeText(screen.getByPlaceholderText('000000'), '000000');
      fireEvent.press(screen.getByText('Verify'));

      // Wait for error to appear
      await waitFor(() => {
        expect(
          screen.getByText(
            'Invalid verification code. Please check and try again.',
          ),
        ).toBeTruthy();
      });

      // Type a new code — error should be cleared
      fireEvent.changeText(screen.getByPlaceholderText('000000'), '1');

      await waitFor(() => {
        expect(
          screen.queryByText(
            'Invalid verification code. Please check and try again.',
          ),
        ).toBeNull();
      });
    });
  });
});
