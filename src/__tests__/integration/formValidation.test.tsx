// Form validation and submission integration tests
import React from 'react';
import { render, fireEvent, screen, waitFor } from '../utils/testUtils';
import AuthScreen from '../../screens/AuthScreen';
import { mockSupabase } from '../mocks/supabaseMock';
import { createMockUser, SECURITY_TEST_CONSTANTS } from '../utils/testUtils';

// Mock validation utilities
const mockEmailValidation = {
  validateEmail: jest.fn(),
};

const mockPasswordValidation = {
  validatePassword: jest.fn(),
  PasswordValidator: {
    getStrengthColor: jest.fn(),
    getStrengthLabel: jest.fn(),
  },
};

const mockUsernameValidation = {
  validateUsername: jest.fn(),
};

jest.mock('../../utils/emailValidation', () => mockEmailValidation);
jest.mock('../../utils/passwordValidation', () => mockPasswordValidation);
jest.mock('../../utils/usernameValidation', () => mockUsernameValidation);

jest.mock('../../services/supabase', () => ({
  supabase: mockSupabase,
}));

jest.mock('../../context/StableAuthContext', () => ({
  useEnhancedAuth: () => require('../../context/AuthContext').useAuth(),
}));

jest.mock('../../utils/rememberMeStorage', () => ({
  RememberMeStorage: {
    setRememberMe: jest.fn(),
    getRememberMe: jest.fn().mockResolvedValue({ isEnabled: false }),
    clearRememberMe: jest.fn(),
  },
}));

describe('Form Validation and Submission Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.__testUtils.clear();

    // Set up default mock implementations
    mockEmailValidation.validateEmail.mockResolvedValue({
      isValid: true,
      errors: [],
      warnings: [],
    });

    mockPasswordValidation.validatePassword.mockReturnValue({
      isValid: true,
      score: 4,
      feedback: ['Strong password'],
    });

    mockPasswordValidation.PasswordValidator.getStrengthColor.mockReturnValue(
      '#44aa44',
    );
    mockPasswordValidation.PasswordValidator.getStrengthLabel.mockReturnValue(
      'Strong',
    );

    mockUsernameValidation.validateUsername.mockResolvedValue({
      isValid: true,
      errors: [],
      warnings: [],
    });
  });

  describe('Email Validation', () => {
    it('should validate email format in real-time', async () => {
      render(<AuthScreen />);

      const emailInput = screen.getByPlaceholderText('Enter your email');

      // Type invalid email
      fireEvent.changeText(emailInput, 'invalid-email');

      // Mock validation failure
      mockEmailValidation.validateEmail.mockResolvedValueOnce({
        isValid: false,
        errors: ['Invalid email format'],
        warnings: [],
      });

      // Trigger validation
      fireEvent(emailInput, 'blur');

      await waitFor(() => {
        expect(mockEmailValidation.validateEmail).toHaveBeenCalledWith(
          'invalid-email',
          false,
        );
      });

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText('❌ Invalid email format')).toBeTruthy();
      });
    });

    it('should show email validation suggestions', async () => {
      render(<AuthScreen />);

      const emailInput = screen.getByPlaceholderText('Enter your email');

      fireEvent.changeText(emailInput, 'user@gmial.com');

      // Mock validation with suggestions
      mockEmailValidation.validateEmail.mockResolvedValueOnce({
        isValid: false,
        errors: ['Domain not found'],
        warnings: ['Did you mean gmail.com?'],
        suggestions: ['user@gmail.com'],
      });

      fireEvent(emailInput, 'blur');

      await waitFor(() => {
        expect(screen.getByText('⚠️ Did you mean gmail.com?')).toBeTruthy();
        expect(screen.getByText('💡 user@gmail.com')).toBeTruthy();
      });
    });

    it('should validate email availability during signup', async () => {
      render(<AuthScreen />);

      // Switch to signup mode
      const switchToSignup = screen.getByText('Sign Up');
      fireEvent.press(switchToSignup);

      const emailInput = screen.getByPlaceholderText('Enter your email');

      fireEvent.changeText(emailInput, 'existing@example.com');

      // Mock email already taken
      mockEmailValidation.validateEmail.mockResolvedValueOnce({
        isValid: false,
        errors: ['Email already registered'],
        warnings: [],
      });

      fireEvent(emailInput, 'blur');

      await waitFor(() => {
        expect(mockEmailValidation.validateEmail).toHaveBeenCalledWith(
          'existing@example.com',
          true,
        );
        expect(screen.getByText('❌ Email already registered')).toBeTruthy();
      });
    });

    it('should show loading state during email validation', async () => {
      render(<AuthScreen />);

      const emailInput = screen.getByPlaceholderText('Enter your email');

      // Mock slow validation
      let resolveValidation: (value: any) => void;
      const slowValidationPromise = new Promise(resolve => {
        resolveValidation = resolve;
      });
      mockEmailValidation.validateEmail.mockReturnValueOnce(
        slowValidationPromise,
      );

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent(emailInput, 'blur');

      // Should show loading spinner
      await waitFor(() => {
        expect(screen.getByTestId('loading-spinner')).toBeTruthy();
      });

      // Resolve validation
      resolveValidation!({
        isValid: true,
        errors: [],
        warnings: [],
      });

      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).toBeNull();
      });
    });
  });

  describe('Password Validation', () => {
    it('should validate password strength in real-time', async () => {
      render(<AuthScreen />);

      // Switch to signup mode to see password strength indicator
      const switchToSignup = screen.getByText('Sign Up');
      fireEvent.press(switchToSignup);

      const passwordInput = screen.getByPlaceholderText('Enter your password');

      // Type weak password
      fireEvent.changeText(passwordInput, 'weak');

      // Mock weak password validation
      mockPasswordValidation.validatePassword.mockReturnValueOnce({
        isValid: false,
        score: 1,
        feedback: ['Password is too weak', 'Add more characters'],
      });
      mockPasswordValidation.PasswordValidator.getStrengthColor.mockReturnValueOnce(
        '#ff4444',
      );
      mockPasswordValidation.PasswordValidator.getStrengthLabel.mockReturnValueOnce(
        'Weak',
      );

      fireEvent(passwordInput, 'blur');

      await waitFor(() => {
        expect(mockPasswordValidation.validatePassword).toHaveBeenCalledWith(
          'weak',
        );
        expect(screen.getByText('❌ Password is too weak')).toBeTruthy();
        expect(screen.getByText('❌ Add more characters')).toBeTruthy();
        expect(screen.getByText('Weak')).toBeTruthy();
      });
    });

    it('should show password strength indicator during signup', async () => {
      render(<AuthScreen />);

      const switchToSignup = screen.getByText('Sign Up');
      fireEvent.press(switchToSignup);

      const passwordInput = screen.getByPlaceholderText('Enter your password');

      // Type strong password
      fireEvent.changeText(passwordInput, 'StrongPassword123!');

      mockPasswordValidation.validatePassword.mockReturnValueOnce({
        isValid: true,
        score: 5,
        feedback: ['Strong password'],
      });
      mockPasswordValidation.PasswordValidator.getStrengthColor.mockReturnValueOnce(
        '#44aa44',
      );
      mockPasswordValidation.PasswordValidator.getStrengthLabel.mockReturnValueOnce(
        'Very Strong',
      );

      fireEvent(passwordInput, 'blur');

      await waitFor(() => {
        expect(screen.getByText('Very Strong')).toBeTruthy();
        expect(screen.getByText('✅ Strong password')).toBeTruthy();
      });
    });

    it('should toggle password visibility', async () => {
      render(<AuthScreen />);

      const passwordInput = screen.getByPlaceholderText('Enter your password');
      const toggleButton = screen.getByText('👁️');

      // Initially password should be hidden
      expect(passwordInput.props.secureTextEntry).toBe(true);

      // Toggle to show password
      fireEvent.press(toggleButton);

      await waitFor(() => {
        expect(passwordInput.props.secureTextEntry).toBe(false);
        expect(screen.getByText('🙈')).toBeTruthy();
      });

      // Toggle back to hide password
      fireEvent.press(screen.getByText('🙈'));

      await waitFor(() => {
        expect(passwordInput.props.secureTextEntry).toBe(true);
        expect(screen.getByText('👁️')).toBeTruthy();
      });
    });
  });

  describe('Username Validation', () => {
    it('should validate username format and availability', async () => {
      render(<AuthScreen />);

      const switchToSignup = screen.getByText('Sign Up');
      fireEvent.press(switchToSignup);

      const usernameInput = screen.getByPlaceholderText('Choose a username');

      // Type invalid username
      fireEvent.changeText(usernameInput, 'ab');

      mockUsernameValidation.validateUsername.mockResolvedValueOnce({
        isValid: false,
        errors: ['Username too short (minimum 3 characters)'],
        warnings: [],
      });

      fireEvent(usernameInput, 'blur');

      await waitFor(() => {
        expect(mockUsernameValidation.validateUsername).toHaveBeenCalledWith(
          'ab',
          true,
        );
        expect(
          screen.getByText('❌ Username too short (minimum 3 characters)'),
        ).toBeTruthy();
      });
    });

    it('should show username suggestions when taken', async () => {
      render(<AuthScreen />);

      const switchToSignup = screen.getByText('Sign Up');
      fireEvent.press(switchToSignup);

      const usernameInput = screen.getByPlaceholderText('Choose a username');

      fireEvent.changeText(usernameInput, 'admin');

      mockUsernameValidation.validateUsername.mockResolvedValueOnce({
        isValid: false,
        errors: ['Username already taken'],
        warnings: [],
        suggestions: ['admin123', 'admin2024', 'adminuser'],
      });

      fireEvent(usernameInput, 'blur');

      await waitFor(() => {
        expect(screen.getByText('❌ Username already taken')).toBeTruthy();
        expect(screen.getByText('💡 Try: admin123')).toBeTruthy();
        expect(screen.getByText('💡 Try: admin2024')).toBeTruthy();
      });
    });

    it('should validate username with special characters', async () => {
      render(<AuthScreen />);

      const switchToSignup = screen.getByText('Sign Up');
      fireEvent.press(switchToSignup);

      const usernameInput = screen.getByPlaceholderText('Choose a username');

      fireEvent.changeText(usernameInput, 'user@name!');

      mockUsernameValidation.validateUsername.mockResolvedValueOnce({
        isValid: false,
        errors: [
          'Username can only contain letters, numbers, underscores, and hyphens',
        ],
        warnings: [],
      });

      fireEvent(usernameInput, 'blur');

      await waitFor(() => {
        expect(
          screen.getByText(
            '❌ Username can only contain letters, numbers, underscores, and hyphens',
          ),
        ).toBeTruthy();
      });
    });
  });

  describe('Form Submission Validation', () => {
    it('should prevent submission with invalid fields', async () => {
      render(<AuthScreen />);

      // Try to submit empty form
      const signInButton = screen.getByText('Sign In');
      fireEvent.press(signInButton);

      await waitFor(() => {
        expect(screen.getByText('Please fill in all fields')).toBeTruthy();
      });

      // Supabase should not be called
      expect(mockSupabase.auth.signInWithPassword).not.toHaveBeenCalled();
    });

    it('should prevent signup with invalid email', async () => {
      render(<AuthScreen />);

      const switchToSignup = screen.getByText('Sign Up');
      fireEvent.press(switchToSignup);

      // Fill form with invalid email
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Enter your password');
      const usernameInput = screen.getByPlaceholderText('Choose a username');

      fireEvent.changeText(emailInput, 'invalid-email');
      fireEvent.changeText(passwordInput, 'StrongPassword123!');
      fireEvent.changeText(usernameInput, 'validuser');

      // Mock invalid email
      mockEmailValidation.validateEmail.mockResolvedValueOnce({
        isValid: false,
        errors: ['Invalid email format'],
        warnings: [],
      });

      // Select grade level and accept terms
      const gradeLevelOption = screen.getByText('Kindergarten - 2nd Grade');
      fireEvent.press(gradeLevelOption);

      const termsCheckbox = screen.getByText(/I agree to the/);
      fireEvent.press(termsCheckbox);

      const createAccountButton = screen.getByText('Create Account');
      fireEvent.press(createAccountButton);

      await waitFor(() => {
        expect(
          screen.getByText('Please enter a valid email address'),
        ).toBeTruthy();
      });

      expect(mockSupabase.auth.signUp).not.toHaveBeenCalled();
    });

    it('should prevent signup with weak password', async () => {
      render(<AuthScreen />);

      const switchToSignup = screen.getByText('Sign Up');
      fireEvent.press(switchToSignup);

      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Enter your password');
      const usernameInput = screen.getByPlaceholderText('Choose a username');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'weak');
      fireEvent.changeText(usernameInput, 'validuser');

      // Mock weak password
      mockPasswordValidation.validatePassword.mockReturnValueOnce({
        isValid: false,
        score: 1,
        feedback: ['Password too weak'],
      });

      const gradeLevelOption = screen.getByText('Kindergarten - 2nd Grade');
      fireEvent.press(gradeLevelOption);

      const termsCheckbox = screen.getByText(/I agree to the/);
      fireEvent.press(termsCheckbox);

      const createAccountButton = screen.getByText('Create Account');
      fireEvent.press(createAccountButton);

      await waitFor(() => {
        expect(
          screen.getByText('Please choose a stronger password'),
        ).toBeTruthy();
      });

      expect(mockSupabase.auth.signUp).not.toHaveBeenCalled();
    });

    it('should require terms acceptance for signup', async () => {
      render(<AuthScreen />);

      const switchToSignup = screen.getByText('Sign Up');
      fireEvent.press(switchToSignup);

      // Fill valid form but don't accept terms
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Enter your password');
      const usernameInput = screen.getByPlaceholderText('Choose a username');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'StrongPassword123!');
      fireEvent.changeText(usernameInput, 'validuser');

      const gradeLevelOption = screen.getByText('Kindergarten - 2nd Grade');
      fireEvent.press(gradeLevelOption);

      // Don't accept terms
      const createAccountButton = screen.getByText('Create Account');
      fireEvent.press(createAccountButton);

      await waitFor(() => {
        expect(
          screen.getByText('Please accept the Terms of Service to continue'),
        ).toBeTruthy();
      });

      expect(mockSupabase.auth.signUp).not.toHaveBeenCalled();
    });

    it('should require grade level selection for signup', async () => {
      render(<AuthScreen />);

      const switchToSignup = screen.getByText('Sign Up');
      fireEvent.press(switchToSignup);

      // Fill form without selecting grade level
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Enter your password');
      const usernameInput = screen.getByPlaceholderText('Choose a username');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'StrongPassword123!');
      fireEvent.changeText(usernameInput, 'validuser');

      const termsCheckbox = screen.getByText(/I agree to the/);
      fireEvent.press(termsCheckbox);

      const createAccountButton = screen.getByText('Create Account');
      fireEvent.press(createAccountButton);

      await waitFor(() => {
        expect(screen.getByText('Please select your grade level')).toBeTruthy();
      });

      expect(mockSupabase.auth.signUp).not.toHaveBeenCalled();
    });
  });

  describe('Form Field Interactions', () => {
    it('should handle form field focus and blur events', async () => {
      render(<AuthScreen />);

      const emailInput = screen.getByPlaceholderText('Enter your email');

      // Focus should not trigger validation immediately
      fireEvent(emailInput, 'focus');
      expect(mockEmailValidation.validateEmail).not.toHaveBeenCalled();

      // Change text and blur should trigger validation
      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent(emailInput, 'blur');

      await waitFor(() => {
        expect(mockEmailValidation.validateEmail).toHaveBeenCalledWith(
          'test@example.com',
          false,
        );
      });
    });

    it('should debounce validation calls', async () => {
      render(<AuthScreen />);

      const emailInput = screen.getByPlaceholderText('Enter your email');

      // Rapid typing should not trigger multiple validation calls
      fireEvent.changeText(emailInput, 't');
      fireEvent.changeText(emailInput, 'te');
      fireEvent.changeText(emailInput, 'tes');
      fireEvent.changeText(emailInput, 'test');
      fireEvent.changeText(emailInput, 'test@');
      fireEvent.changeText(emailInput, 'test@example.com');

      // Wait for debounced validation
      await waitFor(
        () => {
          expect(mockEmailValidation.validateEmail).toHaveBeenCalledTimes(1);
          expect(mockEmailValidation.validateEmail).toHaveBeenCalledWith(
            'test@example.com',
            false,
          );
        },
        { timeout: 1000 },
      );
    });

    it('should clear validation state when switching forms', async () => {
      render(<AuthScreen />);

      // Fill email with error
      const emailInput = screen.getByPlaceholderText('Enter your email');
      fireEvent.changeText(emailInput, 'invalid-email');

      mockEmailValidation.validateEmail.mockResolvedValueOnce({
        isValid: false,
        errors: ['Invalid email format'],
        warnings: [],
      });

      fireEvent(emailInput, 'blur');

      await waitFor(() => {
        expect(screen.getByText('❌ Invalid email format')).toBeTruthy();
      });

      // Switch to signup mode
      const switchToSignup = screen.getByText('Sign Up');
      fireEvent.press(switchToSignup);

      // Switch back to login
      const switchToLogin = screen.getByText('Sign In');
      fireEvent.press(switchToLogin);

      // Validation error should be cleared
      await waitFor(() => {
        expect(screen.queryByText('❌ Invalid email format')).toBeNull();
      });
    });
  });

  describe('Accessibility and Form Validation', () => {
    it('should provide accessible error messages', async () => {
      render(<AuthScreen />);

      const emailInput = screen.getByPlaceholderText('Enter your email');

      fireEvent.changeText(emailInput, 'invalid-email');

      mockEmailValidation.validateEmail.mockResolvedValueOnce({
        isValid: false,
        errors: ['Invalid email format'],
        warnings: [],
      });

      fireEvent(emailInput, 'blur');

      await waitFor(() => {
        // Error messages should be accessible to screen readers
        const errorMessage = screen.getByText('❌ Invalid email format');
        expect(errorMessage).toBeTruthy();
      });
    });

    it('should handle form submission with keyboard', async () => {
      render(<AuthScreen />);

      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Enter your password');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');

      // Submit with Enter key (if supported)
      fireEvent(passwordInput, 'submitEditing');

      // Should trigger form submission
      await waitFor(() => {
        expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalled();
      });
    });
  });
});
