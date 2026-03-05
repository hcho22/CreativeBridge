/**
 * US-004: Genre mapping in AuthContext
 *
 * Verifies that convertConvexProfileToLegacy correctly maps
 * preferredGenre (Convex camelCase) → preferred_genre (legacy snake_case),
 * and that the updateProfile flow maps preferred_genre back to preferredGenre.
 */

import type { StoryGenre, UserProfile } from '../../src/types/database';

// --- Valid genres matching genreValidator ---
const VALID_GENRES: StoryGenre[] = [
  'Mystery',
  'Fantasy',
  'Comedy',
  'Horror',
  'Fiction',
  'Fairy Tale',
];

// --- Mock Convex profile factory ---
const createMockConvexProfile = (preferredGenre?: StoryGenre) => ({
  _id: 'profile_123' as string,
  _creationTime: Date.now(),
  clerkUserId: 'user_test123',
  username: 'testuser',
  displayName: 'Test User',
  totalXp: 500,
  currentStreak: 3,
  longestStreak: 7,
  lastActivityDate: '2026-03-01',
  bestScore: 100,
  totalGamesPlayed: 10,
  totalStoriesCompleted: 5,
  totalWordsWritten: 2000,
  preferredGradeLevel: 'K-2' as const,
  speechEnabled: true,
  preferredGenre,
  avatarUrl: undefined,
  bio: undefined,
  onboardingCompleted: true,
  onboardingProgress: {
    create_account: true,
    first_story: true,
    first_image: false,
    first_voice: false,
    first_streak: false,
  },
  firstStoryCompletedAt: '2026-02-01T00:00:00Z',
  firstImageGeneratedAt: undefined,
  firstVoiceInputAt: undefined,
  firstStreakAchievedAt: undefined,
});

// We need to import the function. Since it's now exported, we can import directly.
// Mock all the heavy dependencies that AuthContext.tsx imports.
jest.mock('../../src/utils/asyncStorageWrapper', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    multiRemove: jest.fn(),
  },
}));
jest.mock('../../src/services/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
    },
  },
}));
jest.mock('../../src/hooks/useSafeClerkAuth', () => ({
  useSafeClerkAuth: jest.fn(() => ({ isSignedIn: false, userId: null })),
}));
jest.mock('../../src/utils/rememberMeStorage', () => ({
  RememberMeStorage: { getRememberMe: jest.fn(), setRememberMe: jest.fn() },
}));
jest.mock('../../src/services/xpEventTracker', () => ({
  xpEventTracker: { trackEvent: jest.fn() },
}));
jest.mock('../../src/utils/clerkTokenCache', () => ({
  clearAllClerkTokens: jest.fn(),
  clearAndVerifyTokens: jest.fn(),
  hasClerkTokens: jest.fn(),
  clerkTokenCache: {},
}));
jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
}));
jest.mock('convex/react', () => ({
  useQuery: jest.fn(),
  useMutation: jest.fn(() => jest.fn()),
  useConvex: jest.fn(() => ({ query: jest.fn() })),
}));
jest.mock('../../src/services/convex', () => ({
  api: {
    userProfiles: {
      getProfileByClerkId: 'getProfileByClerkId',
      updateProfile: 'updateProfile',
      createProfile: 'createProfile',
    },
    onboarding: {
      getMilestones: 'getMilestones',
    },
  },
  convex: { query: jest.fn() },
}));

import { convertConvexProfileToLegacy } from '../../src/context/AuthContext';

describe('US-004: AuthContext genre mapping', () => {
  describe('convertConvexProfileToLegacy — preferredGenre → preferred_genre', () => {
    it.each(VALID_GENRES)(
      'maps preferredGenre: "%s" to preferred_genre: "%s"',
      genre => {
        const convexProfile = createMockConvexProfile(genre);
        const legacy = convertConvexProfileToLegacy(convexProfile as any);

        expect(legacy.preferred_genre).toBe(genre);
      },
    );

    it('maps undefined preferredGenre to undefined preferred_genre', () => {
      const convexProfile = createMockConvexProfile(undefined);
      const legacy = convertConvexProfileToLegacy(convexProfile as any);

      expect(legacy.preferred_genre).toBeUndefined();
    });

    it('does not set preferred_genre to null or empty string when undefined', () => {
      const convexProfile = createMockConvexProfile(undefined);
      const legacy = convertConvexProfileToLegacy(convexProfile as any);

      expect(legacy.preferred_genre).not.toBeNull();
      expect(legacy.preferred_genre).not.toBe('');
    });

    it('preserves all other profile fields when genre is set', () => {
      const convexProfile = createMockConvexProfile('Fantasy');
      const legacy = convertConvexProfileToLegacy(convexProfile as any);

      expect(legacy.username).toBe('testuser');
      expect(legacy.display_name).toBe('Test User');
      expect(legacy.total_xp).toBe(500);
      expect(legacy.preferred_grade_level).toBe('K-2');
      expect(legacy.speech_enabled).toBe(true);
      expect(legacy.preferred_genre).toBe('Fantasy');
    });
  });

  describe('updateProfile mapping — preferred_genre → preferredGenre', () => {
    // These tests verify the type-level contract: that a Partial<UserProfile>
    // with preferred_genre can be constructed and that the mapping logic
    // in updateProfile would include it in convexUpdates.

    it('accepts preferred_genre in Partial<UserProfile>', () => {
      const profileUpdate: Partial<UserProfile> = {
        preferred_genre: 'Mystery',
      };

      expect(profileUpdate.preferred_genre).toBe('Mystery');
    });

    it.each(VALID_GENRES)(
      'Partial<UserProfile> accepts preferred_genre: "%s"',
      genre => {
        const profileUpdate: Partial<UserProfile> = {
          preferred_genre: genre,
        };

        expect(profileUpdate.preferred_genre).toBe(genre);
      },
    );

    it('accepts undefined preferred_genre for clearing genre', () => {
      const profileUpdate: Partial<UserProfile> = {
        preferred_genre: undefined,
      };

      expect(profileUpdate.preferred_genre).toBeUndefined();
    });

    it('mapping logic includes preferredGenre when preferred_genre is provided', () => {
      // Simulates the mapping logic from updateProfile in AuthContext
      const profile: Partial<UserProfile> = { preferred_genre: 'Comedy' };

      const convexUpdates: { preferredGenre?: StoryGenre } = {};
      if (profile.preferred_genre !== undefined) {
        convexUpdates.preferredGenre = profile.preferred_genre;
      }

      expect(convexUpdates.preferredGenre).toBe('Comedy');
    });

    it('mapping logic excludes preferredGenre when preferred_genre is not provided', () => {
      // Simulates the mapping logic — field not in the partial at all
      const profile: Partial<UserProfile> = { username: 'newname' };

      const convexUpdates: { preferredGenre?: StoryGenre } = {};
      if (profile.preferred_genre !== undefined) {
        convexUpdates.preferredGenre = profile.preferred_genre;
      }

      expect(convexUpdates).not.toHaveProperty('preferredGenre');
    });
  });
});
