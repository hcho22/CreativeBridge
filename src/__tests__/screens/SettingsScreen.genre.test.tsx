/**
 * US-005: Genre selector in Settings screen
 *
 * Verifies that the SettingsScreen renders 6 genre buttons + "No Preference",
 * tapping a genre calls updateProfile, and tapping the active genre deselects it.
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import SettingsScreen from '../../screens/SettingsScreen';
import { useAuth } from '../../context/AuthContext';
import type { StoryGenre } from '../../types/database';

// --- Mock setup ---

const mockUpdateProfile = jest.fn();
const mockSignOut = jest.fn();

const createMockUserProfile = (genre?: StoryGenre) => ({
  id: 'user-123',
  username: 'testuser',
  display_name: 'Test User',
  preferred_grade_level: 'K-2',
  speech_enabled: false,
  total_xp: 100,
  current_streak: 0,
  longest_streak: 0,
  last_activity_date: '2026-03-01',
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
  updated_at: '2026-03-01',
  preferred_genre: genre,
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

// Mock navigation
const mockNavigation = {
  navigate: jest.fn(),
  setOptions: jest.fn(),
} as any;

jest.spyOn(Alert, 'alert').mockImplementation(() => {});

const GENRES: StoryGenre[] = [
  'Mystery',
  'Fantasy',
  'Comedy',
  'Horror',
  'Fiction',
  'Fairy Tale',
];

// FR-8 deferral marker — see .claude/.agent/Tasks/prd-ci-debt-cleanup.md
// US-015c.7 verdict for the deferral context.
//
// Why this whole describe is skipped:
// The "Story Genre" UI section was intentionally removed from
// `src/screens/SettingsScreen.tsx` in commit a1dc5b2 ("fix: remove
// redundant story genre section from Settings screen"). All 17 tests in
// this file assert against UI elements (genre buttons "Mystery" /
// "Fantasy" / "Comedy" / "Horror" / etc., "📚 Story Genre" section
// header, "Clear Selection (No Preference)" button, and the success/
// error alerts that fire when tapping a genre) that the screen no longer
// renders. The rendered tree confirms: SettingsScreen's "Workshop"
// shows Reading-level controls but no genre controls at all.
//
// The genre PREFERENCE field itself still exists on userProfile
// (`preferred_genre`) and is still consumed by `HomeScreen.tsx` (line
// 259) and `src/utils/storySetupDefaults.ts` (the `GENRES` list at line
// 17 — Mystery, Fantasy, Comedy, Horror, etc.). Genre selection
// presumably happens elsewhere now (story-setup wizard / onboarding /
// removed entirely with random fallback). Determining the new entry
// point requires product judgment — out of scope for this long-tail
// per-file mock-only sweep.
//
// Categorization: same shape as US-015c.6 (`syncIntegration.test.ts`)
// — feature substantively removed/relocated; per-test "fixes" don't
// make sense; FR-9.1 mock-only changes have no leverage. The right
// resolution is either:
//   (a) Delete this file entirely (the feature is gone); or
//   (b) Rewrite tests against wherever genre selection now lives, after
//       a product decision on the new UX.
//
// Skipping (vs deletion) preserves the test scenarios as a paper trail
// for "if we re-introduce settings-screen genre selection, here's what
// was previously asserted" archaeology. Cost of skip: zero. Routes to a
// follow-up product+test decision under US-015c.7.1.
//
// Skipping these tests reduces the CI failure count by 17 without
// losing information about what needs to be rewritten/deleted.
// eslint-disable-next-line jest/no-disabled-tests -- FR-8-compliant skip with tracking comment above
describe.skip('US-005: SettingsScreen genre selector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateProfile.mockResolvedValue({});
    (useAuth as jest.Mock).mockReturnValue({
      userProfile: createMockUserProfile(),
      updateProfile: mockUpdateProfile,
      signOut: mockSignOut,
    });
  });

  it('renders all 6 genre buttons', () => {
    const { getByText } = render(
      <SettingsScreen navigation={mockNavigation} />,
    );

    for (const genre of GENRES) {
      expect(getByText(genre)).toBeTruthy();
    }
  });

  it('renders the "Story Genre" section title', () => {
    const { getByText } = render(
      <SettingsScreen navigation={mockNavigation} />,
    );

    expect(getByText('📚 Story Genre')).toBeTruthy();
  });

  it('shows default description when no genre selected', () => {
    const { getByText } = render(
      <SettingsScreen navigation={mockNavigation} />,
    );

    expect(getByText('Stories will vary in theme each time')).toBeTruthy();
  });

  it('shows genre description when a genre is selected', () => {
    (useAuth as jest.Mock).mockReturnValue({
      userProfile: createMockUserProfile('Mystery'),
      updateProfile: mockUpdateProfile,
      signOut: mockSignOut,
    });

    const { getByText } = render(
      <SettingsScreen navigation={mockNavigation} />,
    );

    expect(getByText('Clues, secrets, and puzzles to solve')).toBeTruthy();
  });

  it('calls updateProfile with preferred_genre when tapping a genre', async () => {
    const { getByText } = render(
      <SettingsScreen navigation={mockNavigation} />,
    );

    fireEvent.press(getByText('Mystery'));

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        preferred_genre: 'Mystery',
      });
    });
  });

  it('shows success alert after selecting a genre', async () => {
    const { getByText } = render(
      <SettingsScreen navigation={mockNavigation} />,
    );

    fireEvent.press(getByText('Fantasy'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Success',
        'Story genre set to Fantasy!',
      );
    });
  });

  it('deselects genre when tapping the already-selected genre', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      userProfile: createMockUserProfile('Comedy'),
      updateProfile: mockUpdateProfile,
      signOut: mockSignOut,
    });

    const { getByText } = render(
      <SettingsScreen navigation={mockNavigation} />,
    );

    // Tap the already-selected Comedy genre
    fireEvent.press(getByText('Comedy'));

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        preferred_genre: undefined,
      });
    });
  });

  it('shows "Genre preference cleared!" alert when deselecting', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      userProfile: createMockUserProfile('Horror'),
      updateProfile: mockUpdateProfile,
      signOut: mockSignOut,
    });

    const { getByText } = render(
      <SettingsScreen navigation={mockNavigation} />,
    );

    fireEvent.press(getByText('Horror'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Success',
        'Genre preference cleared!',
      );
    });
  });

  it('shows "Clear Selection" button when a genre is selected', () => {
    (useAuth as jest.Mock).mockReturnValue({
      userProfile: createMockUserProfile('Fiction'),
      updateProfile: mockUpdateProfile,
      signOut: mockSignOut,
    });

    const { getByText } = render(
      <SettingsScreen navigation={mockNavigation} />,
    );

    expect(getByText('Clear Selection (No Preference)')).toBeTruthy();
  });

  it('does not show "Clear Selection" button when no genre is selected', () => {
    const { queryByText } = render(
      <SettingsScreen navigation={mockNavigation} />,
    );

    expect(queryByText('Clear Selection (No Preference)')).toBeNull();
  });

  it('reverts selection on error', async () => {
    mockUpdateProfile.mockResolvedValue({ error: 'Update failed' });

    (useAuth as jest.Mock).mockReturnValue({
      userProfile: createMockUserProfile('Mystery'),
      updateProfile: mockUpdateProfile,
      signOut: mockSignOut,
    });

    const { getByText } = render(
      <SettingsScreen navigation={mockNavigation} />,
    );

    // Try to change to Fantasy (currently Mystery)
    fireEvent.press(getByText('Fantasy'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Update Failed',
        'Update failed',
      );
    });
  });

  it('reverts selection on exception', async () => {
    mockUpdateProfile.mockRejectedValue(new Error('Network error'));

    const { getByText } = render(
      <SettingsScreen navigation={mockNavigation} />,
    );

    fireEvent.press(getByText('Mystery'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        'Failed to update genre preference',
      );
    });
  });

  it.each(GENRES)('calls updateProfile with genre "%s"', async genre => {
    const { getByText } = render(
      <SettingsScreen navigation={mockNavigation} />,
    );

    fireEvent.press(getByText(genre));

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        preferred_genre: genre,
      });
    });
  });
});
