// End-to-end authentication flow integration tests
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import {
  createMockUser,
  createMockUserProfile,
  SECURITY_TEST_CONSTANTS,
} from '../utils/testUtils';

// Import mocks first
import { mockSupabase } from '../mocks/supabaseMock';

// Mock dependencies
jest.mock('../../services/supabase', () => ({
  supabase: mockSupabase,
}));

// Import components after mocks
import { render, fireEvent, screen } from '../utils/testUtils';
import { AuthProvider, useAuth } from '../../context/AuthContext';
import AuthScreen from '../../screens/AuthScreen';

jest.mock('../../context/StableAuthContext', () => ({
  useEnhancedAuth: () => require('../../context/AuthContext').useAuth(),
}));

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

describe('Authentication Flow Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.__testUtils.clear();
  });

  describe('Complete Login Flow', () => {
    it('should complete successful login flow end-to-end', async () => {
      // Set up mock user and profile
      const mockUser = createMockUser({
        email: 'test@example.com',
        email_confirmed_at: new Date().toISOString(),
      });
      const mockProfile = createMockUserProfile({ id: mockUser.id });

      // Mock successful authentication
      mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
        data: {
          user: mockUser,
          session: { access_token: 'token', user: mockUser },
        },
        error: null,
      });

      // Mock profile fetch
      mockSupabase.__testUtils.setData(
        'user_profiles',
        mockUser.id,
        mockProfile,
      );
      mockSupabase.from().eq.mockResolvedValueOnce({
        data: mockProfile,
        error: null,
      });

      // Render AuthScreen
      render(<AuthScreen />);

      // Fill in login form
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Enter your password');
      const signInButton = screen.getByText('Sign In');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');

      // Submit form
      fireEvent.press(signInButton);

      // Wait for authentication to complete
      await waitFor(() => {
        expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
        });
      });

      // Verify profile was fetched
      expect(mockSupabase.from).toHaveBeenCalledWith('user_profiles');
    });

    it('should handle login validation errors', async () => {
      render(<AuthScreen />);

      const signInButton = screen.getByText('Sign In');

      // Try to submit without filling fields
      fireEvent.press(signInButton);

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText('Please fill in all fields')).toBeTruthy();
      });
    });

    it('should handle authentication errors gracefully', async () => {
      // Mock authentication failure
      mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'Invalid credentials' },
      });

      render(<AuthScreen />);

      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Enter your password');
      const signInButton = screen.getByText('Sign In');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'wrongpassword');
      fireEvent.press(signInButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid credentials')).toBeTruthy();
      });
    });
  });

  describe('Complete Signup Flow', () => {
    it('should complete successful signup flow end-to-end', async () => {
      const newUser = createMockUser({
        email: 'newuser@example.com',
        email_confirmed_at: null, // Unconfirmed
      });

      // Mock successful signup
      mockSupabase.auth.signUp.mockResolvedValueOnce({
        data: { user: newUser, session: null },
        error: null,
      });

      render(<AuthScreen />);

      // Switch to signup mode
      const switchToSignup = screen.getByText('Sign Up');
      fireEvent.press(switchToSignup);

      // Fill signup form
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Enter your password');
      const usernameInput = screen.getByPlaceholderText('Choose a username');
      const createAccountButton = screen.getByText('Create Account');

      fireEvent.changeText(emailInput, 'newuser@example.com');
      fireEvent.changeText(passwordInput, 'StrongPassword123!');
      fireEvent.changeText(usernameInput, 'newuser');

      // Select grade level
      const gradeLevelOption = screen.getByText('Kindergarten - 2nd Grade');
      fireEvent.press(gradeLevelOption);

      // Accept terms
      const termsCheckbox = screen.getByText(/I agree to the/);
      fireEvent.press(termsCheckbox);

      // Submit signup
      fireEvent.press(createAccountButton);

      await waitFor(() => {
        expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
          email: 'newuser@example.com',
          password: 'StrongPassword123!',
        });
      });

      // Should show email confirmation message
      await waitFor(() => {
        expect(screen.getByText('Account Created!')).toBeTruthy();
      });
    });

    it('should validate signup form fields', async () => {
      render(<AuthScreen />);

      // Switch to signup mode
      const switchToSignup = screen.getByText('Sign Up');
      fireEvent.press(switchToSignup);

      const createAccountButton = screen.getByText('Create Account');

      // Try to submit without required fields
      fireEvent.press(createAccountButton);

      await waitFor(() => {
        expect(screen.getByText('Please fill in all fields')).toBeTruthy();
      });
    });

    it('should validate username requirements', async () => {
      const { validateUsername } = require('../../utils/usernameValidation');
      validateUsername.mockResolvedValueOnce({
        isValid: false,
        errors: ['Username is too short'],
        warnings: [],
      });

      render(<AuthScreen />);

      // Switch to signup mode
      const switchToSignup = screen.getByText('Sign Up');
      fireEvent.press(switchToSignup);

      // Fill form with invalid username
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Enter your password');
      const usernameInput = screen.getByPlaceholderText('Choose a username');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'StrongPassword123!');
      fireEvent.changeText(usernameInput, 'ab'); // Too short

      // Trigger validation
      fireEvent(usernameInput, 'blur');

      await waitFor(() => {
        expect(validateUsername).toHaveBeenCalledWith('ab', true);
      });
    });
  });

  describe('Email Confirmation Flow', () => {
    it('should handle email confirmation workflow', async () => {
      const unconfirmedUser = createMockUser({
        email: 'test@example.com',
        email_confirmed_at: null,
      });

      // Mock initial state with unconfirmed user
      mockSupabase.auth.getSession.mockResolvedValueOnce({
        data: { session: { user: unconfirmedUser } },
        error: null,
      });

      render(<AuthScreen />);

      // Should show email confirmation screen
      await waitFor(() => {
        expect(screen.getByText('📧 Confirm Your Email')).toBeTruthy();
      });

      // Test resend confirmation
      const resendButton = screen.getByText('Resend Confirmation Email');
      fireEvent.press(resendButton);

      await waitFor(() => {
        expect(mockSupabase.auth.resend).toHaveBeenCalledWith({
          type: 'signup',
          email: 'test@example.com',
        });
      });
    });

    it('should handle email confirmation check', async () => {
      const confirmedUser = createMockUser({
        email: 'test@example.com',
        email_confirmed_at: new Date().toISOString(),
      });

      // Mock confirmed user
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: confirmedUser },
        error: null,
      });

      render(<AuthScreen />);

      // Simulate user clicking "I've Confirmed My Email"
      const checkButton = screen.getByText("I've Confirmed My Email");
      fireEvent.press(checkButton);

      await waitFor(() => {
        expect(mockSupabase.auth.getUser).toHaveBeenCalled();
      });
    });
  });

  describe('Password Reset Flow', () => {
    it('should handle password reset workflow', async () => {
      render(<AuthScreen />);

      // Click forgot password link
      const forgotPasswordLink = screen.getByText('Forgot your password?');
      fireEvent.press(forgotPasswordLink);

      // Should show reset password screen
      await waitFor(() => {
        expect(screen.getByText('🔑 Reset Password')).toBeTruthy();
      });

      // Fill email and submit
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const sendResetButton = screen.getByText('Send Reset Email');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.press(sendResetButton);

      await waitFor(() => {
        expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
          'test@example.com',
          { redirectTo: 'creativebridge://reset-password' },
        );
      });
    });

    it('should validate email before sending reset', async () => {
      const { validateEmail } = require('../../utils/emailValidation');
      validateEmail.mockResolvedValueOnce({
        isValid: false,
        errors: ['Invalid email format'],
        warnings: [],
      });

      render(<AuthScreen />);

      const forgotPasswordLink = screen.getByText('Forgot your password?');
      fireEvent.press(forgotPasswordLink);

      const emailInput = screen.getByPlaceholderText('Enter your email');
      const sendResetButton = screen.getByText('Send Reset Email');

      fireEvent.changeText(emailInput, 'invalid-email');
      fireEvent.press(sendResetButton);

      await waitFor(() => {
        expect(
          screen.getByText('Please enter a valid email address'),
        ).toBeTruthy();
      });
    });
  });

  describe('Remember Me Flow', () => {
    it('should handle remember me functionality', async () => {
      const { RememberMeStorage } = require('../../utils/rememberMeStorage');

      render(<AuthScreen />);

      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Enter your password');
      const rememberMeCheckbox = screen.getByText('Remember me on this device');
      const signInButton = screen.getByText('Sign In');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(rememberMeCheckbox);
      fireEvent.press(signInButton);

      await waitFor(() => {
        expect(RememberMeStorage.setRememberMe).toHaveBeenCalledWith(
          true,
          'test@example.com',
        );
      });
    });

    it('should load saved email on component mount', async () => {
      const { RememberMeStorage } = require('../../utils/rememberMeStorage');
      RememberMeStorage.getRememberMe.mockResolvedValueOnce({
        isEnabled: true,
        userEmail: 'saved@example.com',
      });

      render(<AuthScreen />);

      await waitFor(() => {
        const emailInput = screen.getByDisplayValue('saved@example.com');
        expect(emailInput).toBeTruthy();
      });
    });
  });

  describe('Form Switching and State Management', () => {
    it('should properly switch between login and signup forms', async () => {
      render(<AuthScreen />);

      // Initially in login mode
      expect(screen.getByText('Welcome Back!')).toBeTruthy();
      expect(screen.getByText('Sign In')).toBeTruthy();

      // Switch to signup
      const switchToSignup = screen.getByText('Sign Up');
      fireEvent.press(switchToSignup);

      await waitFor(() => {
        expect(screen.getByText('Create Account')).toBeTruthy();
        expect(screen.getByPlaceholderText('Choose a username')).toBeTruthy();
      });

      // Switch back to login
      const switchToLogin = screen.getByText('Sign In');
      fireEvent.press(switchToLogin);

      await waitFor(() => {
        expect(screen.getByText('Welcome Back!')).toBeTruthy();
        expect(screen.queryByPlaceholderText('Choose a username')).toBeNull();
      });
    });

    it('should clear form when switching modes', async () => {
      render(<AuthScreen />);

      // Fill login form
      const emailInput = screen.getByPlaceholderText('Enter your email');
      fireEvent.changeText(emailInput, 'test@example.com');

      // Switch to signup
      const switchToSignup = screen.getByText('Sign Up');
      fireEvent.press(switchToSignup);

      // Switch back to login
      const switchToLogin = screen.getByText('Sign In');
      fireEvent.press(switchToLogin);

      // Email should be cleared
      await waitFor(() => {
        const clearedEmailInput =
          screen.getByPlaceholderText('Enter your email');
        expect(clearedEmailInput.props.value).toBe('');
      });
    });
  });

  describe('Loading and Error States', () => {
    it('should show loading state during authentication', async () => {
      // Mock slow authentication
      let resolveAuth: (value: any) => void;
      const slowAuthPromise = new Promise(resolve => {
        resolveAuth = resolve;
      });

      mockSupabase.auth.signInWithPassword.mockReturnValueOnce(slowAuthPromise);

      render(<AuthScreen />);

      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Enter your password');
      const signInButton = screen.getByText('Sign In');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(signInButton);

      // Should show loading state
      await waitFor(() => {
        expect(screen.getByText('Please wait...')).toBeTruthy();
      });

      // Resolve authentication
      resolveAuth!({
        data: { user: createMockUser(), session: { access_token: 'token' } },
        error: null,
      });

      await waitFor(() => {
        expect(screen.queryByText('Please wait...')).toBeNull();
      });
    });

    it('should disable form during loading', async () => {
      let resolveAuth: (value: any) => void;
      const slowAuthPromise = new Promise(resolve => {
        resolveAuth = resolve;
      });

      mockSupabase.auth.signInWithPassword.mockReturnValueOnce(slowAuthPromise);

      render(<AuthScreen />);

      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Enter your password');
      const signInButton = screen.getByText('Sign In');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(signInButton);

      // Inputs should be disabled
      await waitFor(() => {
        expect(emailInput.props.editable).toBe(false);
        expect(passwordInput.props.editable).toBe(false);
      });

      // Resolve authentication
      resolveAuth!({
        data: { user: createMockUser(), session: { access_token: 'token' } },
        error: null,
      });
    });
  });
});
