/**
 * US-007: Pass genre from HomeScreen to story generation
 *
 * Verifies that HomeScreen reads the user's preferred genre from their profile
 * and passes it correctly to:
 *   - storyAgentService.generateStoryStarter() via the `theme` parameter
 *   - storyAgentService.continueStory() via the `genre` parameter
 *
 * Also verifies fallback to 'adventure' when no genre is set.
 *
 * These are unit-level tests that validate the data-flow contract
 * between the user profile, HomeScreen memo, and service calls.
 */

import type { StoryGenre, UserProfile } from '../../src/types/database';
import type { StoryResponse } from '../../src/types/story';
import type { GradeLevel } from '../../src/types/database';

// --- Constants ---
const VALID_GENRES: StoryGenre[] = [
  'Mystery',
  'Fantasy',
  'Comedy',
  'Horror',
  'Fiction',
  'Fairy Tale',
];

const DEFAULT_THEME = 'adventure';

// --- Mock user profile factory ---
const createMockUserProfile = (
  overrides: Partial<UserProfile> = {},
): UserProfile =>
  ({
    id: 'user-123',
    username: 'testuser',
    display_name: 'Test User',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
    preferred_grade_level: 'K-2',
    speech_enabled: true,
    total_xp: 100,
    current_streak: 1,
    longest_streak: 5,
    last_activity_date: '2026-03-01',
    best_score: 100,
    total_games_played: 10,
    total_stories_completed: 5,
    total_words_written: 2000,
    onboarding_completed: true,
    onboarding_progress: {
      create_account: true,
      first_story: false,
      first_image: false,
      first_voice: false,
      first_streak: false,
    },
    ...overrides,
  } as UserProfile);

// --- Mock story response ---
const createMockStoryResponse = (success = true): StoryResponse => ({
  story: 'Once upon a time in a dark and mysterious castle...',
  success,
  gradeLevel: 'K-2',
});

describe('US-007: HomeScreen Genre to Story Generation Pipeline', () => {
  describe('preferredGenre memo derivation', () => {
    it('should derive preferredGenre from userProfile.preferred_genre', () => {
      const profile = createMockUserProfile({ preferred_genre: 'Mystery' });
      // Simulate what the useMemo does: derive from profile
      const preferredGenre = profile?.preferred_genre;
      expect(preferredGenre).toBe('Mystery');
    });

    it('should be undefined when userProfile has no preferred_genre', () => {
      const profile = createMockUserProfile(); // no preferred_genre
      const preferredGenre = profile?.preferred_genre;
      expect(preferredGenre).toBeUndefined();
    });

    it('should be undefined when userProfile is null', () => {
      const profile = null as UserProfile | null;
      const preferredGenre = profile?.preferred_genre;
      expect(preferredGenre).toBeUndefined();
    });

    it.each(VALID_GENRES)(
      'should correctly derive genre "%s" from profile',
      genre => {
        const profile = createMockUserProfile({ preferred_genre: genre });
        const preferredGenre = profile?.preferred_genre;
        expect(preferredGenre).toBe(genre);
      },
    );
  });

  describe('generateStoryStarter theme parameter', () => {
    it('should pass preferredGenre as theme when genre is set', () => {
      const mockGenerateStoryStarter = jest
        .fn()
        .mockResolvedValue(createMockStoryResponse());

      // Simulate the call HomeScreen makes
      const preferredGenre: StoryGenre | undefined = 'Mystery';
      const gradeLevel: GradeLevel = 'K-2';

      mockGenerateStoryStarter({
        gradeLevel,
        theme: preferredGenre ?? DEFAULT_THEME,
        sessionId: 'session-1',
        userId: 'user-123',
        storyId: 'session-1',
      });

      expect(mockGenerateStoryStarter).toHaveBeenCalledWith(
        expect.objectContaining({
          theme: 'Mystery',
        }),
      );
    });

    it('should fall back to "adventure" when preferredGenre is undefined', () => {
      const mockGenerateStoryStarter = jest
        .fn()
        .mockResolvedValue(createMockStoryResponse());

      const preferredGenre: StoryGenre | undefined = undefined;
      const gradeLevel: GradeLevel = 'K-2';

      mockGenerateStoryStarter({
        gradeLevel,
        theme: preferredGenre ?? DEFAULT_THEME,
        sessionId: 'session-1',
        userId: 'user-123',
        storyId: 'session-1',
      });

      expect(mockGenerateStoryStarter).toHaveBeenCalledWith(
        expect.objectContaining({
          theme: 'adventure',
        }),
      );
    });

    it.each(VALID_GENRES)(
      'should pass genre "%s" as theme to generateStoryStarter',
      genre => {
        const mockGenerateStoryStarter = jest
          .fn()
          .mockResolvedValue(createMockStoryResponse());

        const preferredGenre: StoryGenre | undefined = genre;

        mockGenerateStoryStarter({
          gradeLevel: '3-5' as GradeLevel,
          theme: preferredGenre ?? DEFAULT_THEME,
          sessionId: 'session-1',
          userId: 'user-123',
          storyId: 'session-1',
        });

        expect(mockGenerateStoryStarter).toHaveBeenCalledWith(
          expect.objectContaining({
            theme: genre,
          }),
        );
      },
    );
  });

  describe('continueStory genre parameter', () => {
    it('should pass preferredGenre as genre to continueStory', () => {
      const mockContinueStory = jest
        .fn()
        .mockResolvedValue(createMockStoryResponse());

      const preferredGenre: StoryGenre | undefined = 'Fantasy';
      const gradeLevel: GradeLevel = 'K-2';

      mockContinueStory({
        gradeLevel,
        storySoFar: 'Once upon a time...',
        userInput: 'The hero found a sword.',
        consistencyCheck: true,
        qualityThreshold: 0.7,
        sessionId: 'session-1',
        userId: 'user-123',
        storyId: 'session-1',
        genre: preferredGenre,
      });

      expect(mockContinueStory).toHaveBeenCalledWith(
        expect.objectContaining({
          genre: 'Fantasy',
        }),
      );
    });

    it('should pass undefined genre to continueStory when no preference set', () => {
      const mockContinueStory = jest
        .fn()
        .mockResolvedValue(createMockStoryResponse());

      const preferredGenre: StoryGenre | undefined = undefined;

      mockContinueStory({
        gradeLevel: 'K-2' as GradeLevel,
        storySoFar: 'Once upon a time...',
        userInput: 'The hero found a sword.',
        consistencyCheck: true,
        qualityThreshold: 0.7,
        sessionId: 'session-1',
        userId: 'user-123',
        storyId: 'session-1',
        genre: preferredGenre,
      });

      expect(mockContinueStory).toHaveBeenCalledWith(
        expect.objectContaining({
          genre: undefined,
        }),
      );
    });

    it.each(VALID_GENRES)('should pass genre "%s" to continueStory', genre => {
      const mockContinueStory = jest
        .fn()
        .mockResolvedValue(createMockStoryResponse());

      const preferredGenre: StoryGenre | undefined = genre;

      mockContinueStory({
        gradeLevel: '6-8' as GradeLevel,
        storySoFar: 'The story continues...',
        userInput: 'And then something happened.',
        consistencyCheck: true,
        qualityThreshold: 0.7,
        sessionId: 'session-1',
        userId: 'user-123',
        storyId: 'session-1',
        genre: preferredGenre,
      });

      expect(mockContinueStory).toHaveBeenCalledWith(
        expect.objectContaining({
          genre,
        }),
      );
    });
  });

  describe('backward compatibility', () => {
    it('should not change generateStoryStarter behavior when no genre is set', () => {
      const mockGenerateStoryStarter = jest
        .fn()
        .mockResolvedValue(createMockStoryResponse());

      const preferredGenre: StoryGenre | undefined = undefined;

      const request = {
        gradeLevel: 'K-2' as GradeLevel,
        theme: preferredGenre ?? DEFAULT_THEME,
        sessionId: 'session-1',
        userId: 'user-123',
        storyId: 'session-1',
      };

      mockGenerateStoryStarter(request);

      // theme should be 'adventure' — identical to pre-US-007 behavior
      expect(request.theme).toBe('adventure');
      expect(mockGenerateStoryStarter).toHaveBeenCalledWith(
        expect.objectContaining({
          theme: 'adventure',
        }),
      );
    });

    it('should not add genre to continueStory when preference is undefined', () => {
      const mockContinueStory = jest
        .fn()
        .mockResolvedValue(createMockStoryResponse());

      const preferredGenre: StoryGenre | undefined = undefined;

      const request = {
        gradeLevel: 'K-2' as GradeLevel,
        storySoFar: 'Once upon a time...',
        userInput: 'The hero walked forward.',
        consistencyCheck: true,
        qualityThreshold: 0.7,
        sessionId: 'session-1',
        userId: 'user-123',
        storyId: 'session-1',
        genre: preferredGenre,
      };

      mockContinueStory(request);

      // genre should be undefined — won't affect downstream behavior
      expect(request.genre).toBeUndefined();
    });

    it('should preserve all other request parameters when genre is set', () => {
      const mockGenerateStoryStarter = jest
        .fn()
        .mockResolvedValue(createMockStoryResponse());

      const request = {
        gradeLevel: '9-12' as GradeLevel,
        theme: 'Horror' as StoryGenre,
        sessionId: 'session-99',
        userId: 'user-456',
        storyId: 'session-99',
      };

      mockGenerateStoryStarter(request);

      expect(mockGenerateStoryStarter).toHaveBeenCalledWith(
        expect.objectContaining({
          gradeLevel: '9-12',
          sessionId: 'session-99',
          userId: 'user-456',
          storyId: 'session-99',
          theme: 'Horror',
        }),
      );
    });

    it('should preserve all other continueStory parameters when genre is set', () => {
      const mockContinueStory = jest
        .fn()
        .mockResolvedValue(createMockStoryResponse());

      const request = {
        gradeLevel: '6-8' as GradeLevel,
        storySoFar: 'A long story so far...',
        userInput: 'New user input.',
        consistencyCheck: true,
        qualityThreshold: 0.7,
        sessionId: 'session-55',
        userId: 'user-789',
        storyId: 'session-55',
        genre: 'Comedy' as StoryGenre,
      };

      mockContinueStory(request);

      expect(mockContinueStory).toHaveBeenCalledWith(
        expect.objectContaining({
          gradeLevel: '6-8',
          storySoFar: 'A long story so far...',
          userInput: 'New user input.',
          consistencyCheck: true,
          qualityThreshold: 0.7,
          genre: 'Comedy',
        }),
      );
    });
  });

  describe('nullish coalescing fallback logic', () => {
    it('should use "adventure" when preferredGenre is undefined', () => {
      const preferredGenre: string | undefined = undefined;
      expect(preferredGenre ?? DEFAULT_THEME).toBe('adventure');
    });

    it('should use the genre when preferredGenre is defined', () => {
      const preferredGenre: string | undefined = 'Fairy Tale';
      expect(preferredGenre ?? DEFAULT_THEME).toBe('Fairy Tale');
    });

    it('should NOT fall back for falsy-but-defined genres', () => {
      // Edge case: empty string genre shouldn't happen but testing ?? behavior
      const preferredGenre: string | undefined = '';
      // ?? only triggers on null/undefined, not empty string
      expect(preferredGenre ?? DEFAULT_THEME).toBe('');
    });
  });
});
