/**
 * Profile Completion Flow Tests
 *
 * Integration tests for profile completion flow after OAuth authentication
 * Tests profile completion screen, validation, and navigation
 *
 * Based on: TASKS-oauth-google-apple-signin-PRD.md Task 5.5
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import ProfileCompletionScreen from '../../screens/ProfileCompletionScreen';
import { useAuth } from '../../context/AuthContext';
import { useSafeClerkAuth } from '../../hooks/useSafeClerkAuth';
import { validateUsername } from '../../utils/usernameValidation';
import { mockSupabase } from '../mocks/supabaseMock';

// Mock dependencies
jest.mock('../../context/AuthContext');
jest.mock('../../hooks/useSafeClerkAuth');
jest.mock('../../utils/usernameValidation');
jest.mock('../../services/supabase', () => ({
  supabase: jest.requireActual('../mocks/supabaseMock').mockSupabase,
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseSafeClerkAuth = useSafeClerkAuth as jest.MockedFunction<
  typeof useSafeClerkAuth
>;
const mockValidateUsername = validateUsername as jest.MockedFunction<
  typeof validateUsername
>;

describe('Profile Completion Flow', () => {
  let mockUpdateProfile: jest.Mock;
  let mockRefreshProfile: jest.Mock;
  let mockOnComplete: jest.Mock;
  let mockOnSkip: jest.Mock;
  let mockClerkUser: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.__testUtils.clear();

    mockUpdateProfile = jest.fn();
    mockRefreshProfile = jest.fn().mockResolvedValue(undefined);
    mockOnComplete = jest.fn();
    mockOnSkip = jest.fn();

    mockClerkUser = {
      id: 'user_clerk123',
      emailAddresses: [{ emailAddress: 'test@example.com' }],
      firstName: 'Test',
      lastName: 'User',
    };

    mockUseAuth.mockReturnValue({
      user: { id: 'supabase-user-id' },
      userProfile: null,
      updateProfile: mockUpdateProfile,
      refreshProfile: mockRefreshProfile,
    } as any);

    mockUseSafeClerkAuth.mockReturnValue({
      clerkUser: mockClerkUser,
    } as any);

    mockValidateUsername.mockResolvedValue({
      isValid: true,
      errors: [],
      warnings: [],
    });

    // Mock successful profile creation
    mockSupabase.from().insert.mockResolvedValue({
      data: null,
      error: null,
    });
  });

  describe('Rendering', () => {
    test('renders profile completion form', () => {
      const { getByPlaceholderText, getByText } = render(
        <ProfileCompletionScreen
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />,
      );

      expect(getByPlaceholderText('Choose a username')).toBeTruthy();
      expect(getByText('Select Grade Level')).toBeTruthy();
    });

    test('pre-fills display name from Clerk user', () => {
      const { getByDisplayValue } = render(
        <ProfileCompletionScreen
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />,
      );

      // Display name should be pre-filled from Clerk user
      expect(getByDisplayValue('Test User')).toBeTruthy();
    });
  });

  describe('Form Validation', () => {
    test('validates username on input', async () => {
      const { getByPlaceholderText } = render(
        <ProfileCompletionScreen
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />,
      );

      const usernameInput = getByPlaceholderText('Choose a username');
      fireEvent.changeText(usernameInput, 'testuser');

      await waitFor(() => {
        expect(mockValidateUsername).toHaveBeenCalledWith('testuser', true);
      });
    });

    test('shows validation error for invalid username', async () => {
      mockValidateUsername.mockResolvedValueOnce({
        isValid: false,
        errors: ['Username is too short'],
        warnings: [],
      });

      const { getByPlaceholderText } = render(
        <ProfileCompletionScreen
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />,
      );

      const usernameInput = getByPlaceholderText('Choose a username');
      fireEvent.changeText(usernameInput, 'ab');
      fireEvent(usernameInput, 'blur');

      await waitFor(() => {
        expect(mockValidateUsername).toHaveBeenCalled();
      });
    });

    test('requires username for submission', async () => {
      const { getByText } = render(
        <ProfileCompletionScreen
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />,
      );

      const submitButton = getByText('Complete Profile');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Error',
          'Username is required',
        );
      });
    });

    test('requires grade level for submission', async () => {
      const { getByPlaceholderText, getByText } = render(
        <ProfileCompletionScreen
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />,
      );

      const usernameInput = getByPlaceholderText('Choose a username');
      fireEvent.changeText(usernameInput, 'testuser');

      const submitButton = getByText('Complete Profile');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Error',
          'Grade level is required',
        );
      });
    });
  });

  describe('Profile Submission', () => {
    test('saves profile on successful submission', async () => {
      const { getByPlaceholderText, getByText } = render(
        <ProfileCompletionScreen
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />,
      );

      const usernameInput = getByPlaceholderText('Choose a username');
      fireEvent.changeText(usernameInput, 'testuser');

      // Select grade level
      const gradeLevelOption = getByText('Kindergarten - 2nd Grade');
      fireEvent.press(gradeLevelOption);

      const submitButton = getByText('Complete Profile');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(mockValidateUsername).toHaveBeenCalled();
        expect(mockSupabase.from).toHaveBeenCalledWith('user_profiles');
      });
    });

    test('calls onComplete callback after successful submission', async () => {
      const { getByPlaceholderText, getByText } = render(
        <ProfileCompletionScreen
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />,
      );

      const usernameInput = getByPlaceholderText('Choose a username');
      fireEvent.changeText(usernameInput, 'testuser');

      const gradeLevelOption = getByText('Kindergarten - 2nd Grade');
      fireEvent.press(gradeLevelOption);

      const submitButton = getByText('Complete Profile');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(mockRefreshProfile).toHaveBeenCalled();
      });
    });

    test('handles profile creation errors', async () => {
      mockSupabase.from().insert.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error', code: 'PGRST_ERROR' },
      });

      const { getByPlaceholderText, getByText } = render(
        <ProfileCompletionScreen
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />,
      );

      const usernameInput = getByPlaceholderText('Choose a username');
      fireEvent.changeText(usernameInput, 'testuser');

      const gradeLevelOption = getByText('Kindergarten - 2nd Grade');
      fireEvent.press(gradeLevelOption);

      const submitButton = getByText('Complete Profile');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Error',
          expect.stringContaining('Failed to create profile'),
        );
      });
    });
  });

  describe('Skip Functionality', () => {
    test('allows skipping profile completion', () => {
      const { getByText } = render(
        <ProfileCompletionScreen
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />,
      );

      const skipButton = getByText('Skip for now');
      fireEvent.press(skipButton);

      expect(mockOnSkip).toHaveBeenCalled();
    });

    test('calls refreshProfile when skipping', async () => {
      const { getByText } = render(
        <ProfileCompletionScreen
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />,
      );

      const skipButton = getByText('Skip for now');
      fireEvent.press(skipButton);

      await waitFor(() => {
        expect(mockRefreshProfile).toHaveBeenCalled();
      });
    });
  });

  describe('Loading States', () => {
    test('shows loading indicator during submission', async () => {
      let resolveValidation: (value: any) => void;
      const slowValidation = new Promise(resolve => {
        resolveValidation = resolve;
      });

      mockValidateUsername.mockReturnValue(slowValidation as any);

      const { getByPlaceholderText, getByText, queryByTestId } = render(
        <ProfileCompletionScreen
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />,
      );

      const usernameInput = getByPlaceholderText('Choose a username');
      fireEvent.changeText(usernameInput, 'testuser');

      const gradeLevelOption = getByText('Kindergarten - 2nd Grade');
      fireEvent.press(gradeLevelOption);

      const submitButton = getByText('Complete Profile');
      fireEvent.press(submitButton);

      // Should show loading indicator
      await waitFor(() => {
        expect(queryByTestId('profile-completion-loading')).toBeTruthy();
      });

      resolveValidation!({
        isValid: true,
        errors: [],
        warnings: [],
      });
    });
  });
});
