// Story Genre Type Tests (US-003)
// Validates StoryGenre type and UserProfile.preferred_genre field

import { StoryGenre, UserProfile } from '../../src/types/database';

describe('StoryGenre type', () => {
  const ALL_GENRES: StoryGenre[] = [
    'Mystery',
    'Fantasy',
    'Comedy',
    'Horror',
    'Fiction',
    'Fairy Tale',
  ];

  it('should accept all 6 valid genre literals', () => {
    // Compile-time type assertions — if these assignments fail to compile,
    // the type is misconfigured
    const mystery: StoryGenre = 'Mystery';
    const fantasy: StoryGenre = 'Fantasy';
    const comedy: StoryGenre = 'Comedy';
    const horror: StoryGenre = 'Horror';
    const fiction: StoryGenre = 'Fiction';
    const fairyTale: StoryGenre = 'Fairy Tale';

    expect(mystery).toBe('Mystery');
    expect(fantasy).toBe('Fantasy');
    expect(comedy).toBe('Comedy');
    expect(horror).toBe('Horror');
    expect(fiction).toBe('Fiction');
    expect(fairyTale).toBe('Fairy Tale');
  });

  it('should have exactly 6 genres', () => {
    expect(ALL_GENRES).toHaveLength(6);
  });

  it('should reject invalid genre strings at compile time', () => {
    // This test documents the type constraint — invalid strings
    // would cause a TypeScript compile error:
    // const invalid: StoryGenre = 'Romance'; // TS Error
    // const invalid2: StoryGenre = 'adventure'; // TS Error (case-sensitive)

    // Runtime check: only valid genres are in the list
    const invalidGenres = ['Romance', 'adventure', 'Sci-Fi', '', 'mystery'];
    invalidGenres.forEach(invalid => {
      expect(ALL_GENRES).not.toContain(invalid);
    });
  });
});

describe('UserProfile.preferred_genre', () => {
  const baseProfile: UserProfile = {
    id: 'test-user-id',
    username: 'testuser',
    display_name: 'Test User',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    total_xp: 0,
    current_streak: 0,
    longest_streak: 0,
    last_activity_date: '2026-01-01',
    best_score: 0,
    total_games_played: 0,
    total_stories_completed: 0,
    total_words_written: 0,
    preferred_grade_level: 'K-2',
    speech_enabled: false,
    onboarding_completed: false,
    onboarding_progress: {
      create_account: true,
      first_story: false,
      first_image: false,
      first_voice: false,
      first_streak: false,
    },
  };

  it('should accept preferred_genre as optional (undefined)', () => {
    // preferred_genre not set — simulates existing users without a genre
    expect(baseProfile.preferred_genre).toBeUndefined();
  });

  it('should accept each valid genre value', () => {
    const genres: StoryGenre[] = [
      'Mystery',
      'Fantasy',
      'Comedy',
      'Horror',
      'Fiction',
      'Fairy Tale',
    ];

    genres.forEach(genre => {
      const profileWithGenre: UserProfile = {
        ...baseProfile,
        preferred_genre: genre,
      };
      expect(profileWithGenre.preferred_genre).toBe(genre);
    });
  });

  it('should allow clearing genre back to undefined', () => {
    const profileWithGenre: UserProfile = {
      ...baseProfile,
      preferred_genre: 'Mystery',
    };
    expect(profileWithGenre.preferred_genre).toBe('Mystery');

    const clearedProfile: UserProfile = {
      ...profileWithGenre,
      preferred_genre: undefined,
    };
    expect(clearedProfile.preferred_genre).toBeUndefined();
  });
});
