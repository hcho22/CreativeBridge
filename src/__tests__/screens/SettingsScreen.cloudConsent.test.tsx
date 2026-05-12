/**
 * US-010: Cloud transcription disclosure modal
 *
 * Covers the consent gate added on top of the US-009 toggle:
 *   - First-time cloud toggle for a 9-12 user → modal renders.
 *   - Subsequent toggles (after a stored grant) → modal does NOT render;
 *     preference persists directly.
 *   - Cancel → modal closes, toggle stays on on-device, no mutations fire.
 *   - Agree → consent event logged (log-first), then preference persisted.
 *   - Revoke (cloud → on-device) → no modal, preference persists, a
 *     revoke event is logged.
 *   - Re-grant after a stored revoke → modal renders again (consent did
 *     not persist past revocation).
 *
 * The Convex hooks are mocked at the module boundary. We don't exercise
 * the actual `consentEvents` round-trip here (that belongs in a Convex
 * unit test) — we only assert that the SettingsScreen invokes them with
 * the right arguments in the right order.
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import SettingsScreen from '../../screens/SettingsScreen';
import { useAuth } from '../../context/AuthContext';
import { useMutation, useQuery } from 'convex/react';
import type { GradeLevel } from '../../types/database';

const mockUpdateProfile = jest.fn();
const mockSignOut = jest.fn();
const mockLogConsent = jest.fn();

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

// Same parental-gate stub as the US-009 test — its real Modal sets
// accessibilityViewIsModal=true which traps RNTL queries.
jest.mock('../../components/common/ParentalGate', () => ({
  useParentalGate: () => ({
    openURL: jest.fn(),
    parentalGateModal: null,
  }),
}));

jest.mock('convex/react', () => ({
  useQuery: jest.fn(),
  useMutation: jest.fn(),
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

type ConsentEvent =
  | null
  | undefined
  | { action: 'granted' | 'revoked'; consentType: 'cloudTranscription' };

const setup = ({
  latestConsent,
  overrides = {},
}: {
  latestConsent: ConsentEvent;
  overrides?: MockProfileOverrides;
}) => {
  (useAuth as jest.Mock).mockReturnValue({
    userProfile: createMockUserProfile({
      preferred_grade_level: '9-12',
      ...overrides,
    }),
    updateProfile: mockUpdateProfile,
    signOut: mockSignOut,
  });
  (useQuery as jest.Mock).mockReturnValue(latestConsent);
  (useMutation as jest.Mock).mockReturnValue(mockLogConsent);
};

describe('US-010: Cloud transcription disclosure modal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateProfile.mockResolvedValue({});
    mockLogConsent.mockResolvedValue({ eventId: 'evt_1' });
  });

  describe('first-time toggle', () => {
    it('shows the disclosure modal when the user taps Cloud and has no consent history', () => {
      setup({ latestConsent: null });
      const { getByText } = render(
        <SettingsScreen navigation={mockNavigation} />,
      );

      fireEvent.press(getByText('Cloud'));

      expect(getByText('Use cloud transcription?')).toBeTruthy();
      expect(getByText('Cancel')).toBeTruthy();
      expect(getByText('I understand and agree')).toBeTruthy();
    });

    it('does not call updateProfile while the modal is open', () => {
      setup({ latestConsent: null });
      const { getByText } = render(
        <SettingsScreen navigation={mockNavigation} />,
      );

      fireEvent.press(getByText('Cloud'));

      expect(mockUpdateProfile).not.toHaveBeenCalled();
      expect(mockLogConsent).not.toHaveBeenCalled();
    });

    // (Cannot assert the segmented control state while the disclosure
    // modal is open because the modal's `accessibilityViewIsModal=true`
    // scopes RNTL queries to the modal subtree. The "after Cancel"
    // assertion in the cancel-path describe block below verifies the
    // same no-flicker invariant on the closed-modal side.)
  });

  describe('agree path', () => {
    it('writes a granted consent event and then persists transcriptionEngine = cloud', async () => {
      setup({ latestConsent: null });
      const { getByText } = render(
        <SettingsScreen navigation={mockNavigation} />,
      );

      fireEvent.press(getByText('Cloud'));
      fireEvent.press(getByText('I understand and agree'));

      await waitFor(() => {
        expect(mockLogConsent).toHaveBeenCalledWith({ action: 'granted' });
      });
      await waitFor(() => {
        expect(mockUpdateProfile).toHaveBeenCalledWith({
          preferences: { transcription_engine: 'cloud' },
        });
      });

      // Log-first ordering: consent must be invoked before the
      // preference write so we can never have a 'cloud' preference
      // with no audit row.
      const logOrder = mockLogConsent.mock.invocationCallOrder[0];
      const updateOrder = mockUpdateProfile.mock.invocationCallOrder[0];
      expect(logOrder).toBeLessThan(updateOrder);
    });

    it('aborts and does not persist if the consent log write throws', async () => {
      mockLogConsent.mockRejectedValue(new Error('Convex offline'));
      setup({ latestConsent: null });
      const { getByText } = render(
        <SettingsScreen navigation={mockNavigation} />,
      );

      fireEvent.press(getByText('Cloud'));
      fireEvent.press(getByText('I understand and agree'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Error',
          'Could not record your consent. Please try again.',
        );
      });
      expect(mockUpdateProfile).not.toHaveBeenCalled();
    });
  });

  describe('cancel path', () => {
    it('closes the modal and does not call updateProfile or logConsent', async () => {
      setup({ latestConsent: null });
      const { getByText, queryByText } = render(
        <SettingsScreen navigation={mockNavigation} />,
      );

      fireEvent.press(getByText('Cloud'));
      fireEvent.press(getByText('Cancel'));

      await waitFor(() => {
        expect(queryByText('Use cloud transcription?')).toBeNull();
      });
      expect(mockUpdateProfile).not.toHaveBeenCalled();
      expect(mockLogConsent).not.toHaveBeenCalled();
    });

    it('leaves the segmented control on On-device after Cancel', async () => {
      setup({ latestConsent: null });
      const { getByText, getByLabelText } = render(
        <SettingsScreen navigation={mockNavigation} />,
      );

      fireEvent.press(getByText('Cloud'));
      fireEvent.press(getByText('Cancel'));

      await waitFor(() => {
        expect(
          getByLabelText('On-device transcription').props.accessibilityState
            .selected,
        ).toBe(true);
      });
    });
  });

  describe('subsequent toggles (already consented)', () => {
    it('does NOT show the modal when latest consent is granted', () => {
      setup({
        latestConsent: { action: 'granted', consentType: 'cloudTranscription' },
      });
      const { getByText, queryByText } = render(
        <SettingsScreen navigation={mockNavigation} />,
      );

      fireEvent.press(getByText('Cloud'));

      expect(queryByText('Use cloud transcription?')).toBeNull();
    });

    it('persists transcriptionEngine = cloud directly without logging a new grant', async () => {
      setup({
        latestConsent: { action: 'granted', consentType: 'cloudTranscription' },
      });
      const { getByText } = render(
        <SettingsScreen navigation={mockNavigation} />,
      );

      fireEvent.press(getByText('Cloud'));

      await waitFor(() => {
        expect(mockUpdateProfile).toHaveBeenCalledWith({
          preferences: { transcription_engine: 'cloud' },
        });
      });
      expect(mockLogConsent).not.toHaveBeenCalled();
    });
  });

  describe('revoke path (cloud → on-device)', () => {
    it('persists transcriptionEngine = on-device and logs a revoke event, no modal', async () => {
      setup({
        latestConsent: { action: 'granted', consentType: 'cloudTranscription' },
        overrides: { preferences: { transcription_engine: 'cloud' } },
      });
      const { getByText, queryByText } = render(
        <SettingsScreen navigation={mockNavigation} />,
      );

      fireEvent.press(getByText('On-device'));

      // No modal renders for the on-device direction.
      expect(queryByText('Use cloud transcription?')).toBeNull();

      await waitFor(() => {
        expect(mockUpdateProfile).toHaveBeenCalledWith({
          preferences: { transcription_engine: 'on-device' },
        });
      });
      await waitFor(() => {
        expect(mockLogConsent).toHaveBeenCalledWith({ action: 'revoked' });
      });
    });
  });

  describe('re-grant after revoke', () => {
    it('shows the modal again when latest consent is revoked', () => {
      setup({
        latestConsent: { action: 'revoked', consentType: 'cloudTranscription' },
      });
      const { getByText } = render(
        <SettingsScreen navigation={mockNavigation} />,
      );

      fireEvent.press(getByText('Cloud'));

      // "Consent persists until revoked" — once revoked, a new grant
      // needs to go through the modal again.
      expect(getByText('Use cloud transcription?')).toBeTruthy();
    });
  });
});
