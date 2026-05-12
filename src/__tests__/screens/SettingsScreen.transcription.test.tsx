/**
 * US-009: Voice transcription quality toggle in Settings screen
 *
 * Verifies the visibility matrix from the PRD:
 *   - K-2 / 3-5 / 6-8 / undefined → toggle is hidden
 *   - 9-12 → toggle is rendered
 * Plus toggle persistence: tapping "Cloud" calls updateProfile with the
 * snake_case `preferences.transcription_engine` shape that AuthContext maps
 * into the camelCase Convex mutation.
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import SettingsScreen from '../../screens/SettingsScreen';
import { useAuth } from '../../context/AuthContext';
import type { GradeLevel } from '../../types/database';

const mockUpdateProfile = jest.fn();
const mockSignOut = jest.fn();

interface MockProfileOverrides {
  preferred_grade_level?: GradeLevel;
  preferences?: { transcription_engine?: 'on-device' | 'cloud' };
}

const createMockUserProfile = (overrides: MockProfileOverrides = {}) => ({
  id: 'user-123',
  username: 'testuser',
  display_name: 'Test User',
  preferred_grade_level: overrides.preferred_grade_level,
  speech_enabled: false,
  total_xp: 0,
  current_streak: 0,
  longest_streak: 0,
  last_activity_date: '2026-05-01',
  best_score: 0,
  total_games_played: 0,
  total_stories_completed: 0,
  total_words_written: 0,
  onboarding_completed: true,
  onboarding_progress: {
    create_account: true,
    first_story: false,
    first_image: false,
    first_voice: false,
    first_streak: false,
  },
  created_at: '2026-01-01',
  updated_at: '2026-05-01',
  preferences: overrides.preferences,
});

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: jest.fn(() => ({ top: 0, bottom: 0, left: 0, right: 0 })),
}));

jest.mock('../../components/onboarding/OnboardingChecklistModal', () => ({
  OnboardingChecklistModal: () => null,
}));

jest.mock('../../services/onboardingMilestoneTracker', () => ({
  onboardingMilestoneTracker: {
    isOnboardingComplete: jest.fn().mockResolvedValue(true),
  },
}));

// The real ParentalGate renders a Modal with accessibilityViewIsModal=true,
// which makes RNTL's getByText/getByLabelText scope to the modal subtree
// and miss content rendered alongside it. Replace it with a passthrough.
jest.mock('../../components/common/ParentalGate', () => ({
  useParentalGate: () => ({
    openURL: jest.fn(),
    parentalGateModal: null,
  }),
}));

// US-010 introduced Convex hooks in SettingsScreen for cloud-transcription
// consent. This test file is scoped to the toggle UI itself, not the
// consent modal — so we pretend the user has previously granted, which
// makes the modal a no-op and lets persistence assertions run cleanly.
// The dedicated cloudConsent.test.tsx covers the consent branches.
jest.mock('convex/react', () => ({
  useQuery: jest
    .fn()
    .mockReturnValue({ action: 'granted', consentType: 'cloudTranscription' }),
  useMutation: jest.fn().mockReturnValue(jest.fn()),
}));

jest.mock('../../../convex/_generated/api', () => ({
  api: {
    consent: {
      getLatestCloudTranscriptionConsent: 'consent/getLatest',
      logCloudTranscriptionConsent: 'consent/log',
    },
  },
}));

const mockNavigation = {
  navigate: jest.fn(),
  setOptions: jest.fn(),
} as any;

jest.spyOn(Alert, 'alert').mockImplementation(() => {});

const setProfile = (overrides: MockProfileOverrides = {}) => {
  (useAuth as jest.Mock).mockReturnValue({
    userProfile: createMockUserProfile(overrides),
    updateProfile: mockUpdateProfile,
    signOut: mockSignOut,
  });
};

describe('US-009: SettingsScreen transcription engine toggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateProfile.mockResolvedValue({});
  });

  describe('visibility matrix', () => {
    const hiddenForGrades: Array<GradeLevel | undefined> = [
      'K-2',
      '3-5',
      '6-8',
      undefined,
    ];

    it.each(hiddenForGrades)(
      'hides the toggle when grade is %s',
      gradeLevel => {
        setProfile({ preferred_grade_level: gradeLevel });
        const { queryByText } = render(
          <SettingsScreen navigation={mockNavigation} />,
        );
        expect(queryByText('Voice transcription quality')).toBeNull();
        expect(queryByText('On-device')).toBeNull();
        expect(queryByText('Cloud')).toBeNull();
      },
    );

    it('renders the toggle when grade is 9-12', () => {
      setProfile({ preferred_grade_level: '9-12' });
      const { getByText } = render(
        <SettingsScreen navigation={mockNavigation} />,
      );
      expect(getByText('Voice transcription quality')).toBeTruthy();
      expect(getByText('On-device')).toBeTruthy();
      expect(getByText('Cloud')).toBeTruthy();
    });
  });

  describe('default selection', () => {
    it('defaults to on-device when no preference is set', () => {
      setProfile({ preferred_grade_level: '9-12' });
      const { getByLabelText } = render(
        <SettingsScreen navigation={mockNavigation} />,
      );
      expect(
        getByLabelText('On-device transcription').props.accessibilityState
          .selected,
      ).toBe(true);
      expect(
        getByLabelText('Cloud transcription').props.accessibilityState.selected,
      ).toBe(false);
    });

    it('reflects the stored preference when set to cloud', () => {
      setProfile({
        preferred_grade_level: '9-12',
        preferences: { transcription_engine: 'cloud' },
      });
      const { getByLabelText } = render(
        <SettingsScreen navigation={mockNavigation} />,
      );
      expect(
        getByLabelText('Cloud transcription').props.accessibilityState.selected,
      ).toBe(true);
      expect(
        getByLabelText('On-device transcription').props.accessibilityState
          .selected,
      ).toBe(false);
    });
  });

  describe('persistence', () => {
    it('persists "cloud" via updateProfile when the user taps Cloud', async () => {
      setProfile({ preferred_grade_level: '9-12' });
      const { getByText } = render(
        <SettingsScreen navigation={mockNavigation} />,
      );

      fireEvent.press(getByText('Cloud'));

      await waitFor(() => {
        expect(mockUpdateProfile).toHaveBeenCalledWith({
          preferences: { transcription_engine: 'cloud' },
        });
      });
    });

    it('persists "on-device" via updateProfile when switching back', async () => {
      setProfile({
        preferred_grade_level: '9-12',
        preferences: { transcription_engine: 'cloud' },
      });
      const { getByText } = render(
        <SettingsScreen navigation={mockNavigation} />,
      );

      fireEvent.press(getByText('On-device'));

      await waitFor(() => {
        expect(mockUpdateProfile).toHaveBeenCalledWith({
          preferences: { transcription_engine: 'on-device' },
        });
      });
    });

    it('does not call updateProfile when tapping the already-selected option', async () => {
      setProfile({
        preferred_grade_level: '9-12',
        preferences: { transcription_engine: 'on-device' },
      });
      const { getByText } = render(
        <SettingsScreen navigation={mockNavigation} />,
      );

      fireEvent.press(getByText('On-device'));

      // Give any pending promises a chance to resolve before asserting.
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(mockUpdateProfile).not.toHaveBeenCalled();
    });

    it('reverts the selection if updateProfile returns an error', async () => {
      mockUpdateProfile.mockResolvedValue({ error: 'Network down' });
      setProfile({ preferred_grade_level: '9-12' });
      const { getByText, getByLabelText } = render(
        <SettingsScreen navigation={mockNavigation} />,
      );

      fireEvent.press(getByText('Cloud'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Update Failed',
          'Network down',
        );
      });
      expect(
        getByLabelText('On-device transcription').props.accessibilityState
          .selected,
      ).toBe(true);
    });

    it('reverts the selection if updateProfile throws', async () => {
      mockUpdateProfile.mockRejectedValue(new Error('Network error'));
      setProfile({ preferred_grade_level: '9-12' });
      const { getByText, getByLabelText } = render(
        <SettingsScreen navigation={mockNavigation} />,
      );

      fireEvent.press(getByText('Cloud'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Error',
          'Failed to update transcription preference',
        );
      });
      expect(
        getByLabelText('On-device transcription').props.accessibilityState
          .selected,
      ).toBe(true);
    });
  });
});
