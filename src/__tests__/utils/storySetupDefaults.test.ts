/**
 * Unit tests for resolveStorySetup utility
 * Covers all resolution cases from US-002 acceptance criteria
 */

import { resolveStorySetup } from '../../utils/storySetupDefaults';
import { StorySetupAnswers } from '../../types/storySetup';

/** Helper to build answers with defaults — all null/skipped except whoStarts. */
function makeAnswers(
  overrides: Partial<StorySetupAnswers> = {},
): StorySetupAnswers {
  return {
    genre: null,
    characterType: null,
    animalType: null,
    customAnimal: null,
    customCharacter: null,
    characterName: null,
    setting: null,
    customSetting: null,
    whoStarts: 'ai',
    ...overrides,
  };
}

const VALID_GENRES = [
  'Mystery',
  'Fantasy',
  'Comedy',
  'Horror',
  'Fiction',
  'Fairy Tale',
];

describe('resolveStorySetup', () => {
  // ── No answers (undefined) ────────────────────

  describe('when answers is undefined (no wizard)', () => {
    it('returns a random genre from the 6 canonical options', () => {
      const result = resolveStorySetup(undefined);
      expect(VALID_GENRES).toContain(result.genre);
    });

    it('returns undefined character', () => {
      expect(resolveStorySetup(undefined).character).toBeUndefined();
    });

    it('returns undefined setting', () => {
      expect(resolveStorySetup(undefined).setting).toBeUndefined();
    });

    it('defaults whoStarts to ai', () => {
      expect(resolveStorySetup(undefined).whoStarts).toBe('ai');
    });
  });

  // ── Genre resolution ──────────────────────────

  describe('genre resolution', () => {
    it('uses the selected genre when provided', () => {
      const result = resolveStorySetup(makeAnswers({ genre: 'Horror' }));
      expect(result.genre).toBe('Horror');
    });

    it('picks a random genre when genre is null (skipped)', () => {
      const result = resolveStorySetup(makeAnswers({ genre: null }));
      expect(VALID_GENRES).toContain(result.genre);
    });

    it('picks random genres from the full set (statistical check)', () => {
      const seen = new Set<string>();
      for (let i = 0; i < 200; i++) {
        seen.add(resolveStorySetup(makeAnswers({ genre: null })).genre);
      }
      // With 200 tries and 6 options, we should see at least 3 distinct genres
      expect(seen.size).toBeGreaterThanOrEqual(3);
    });
  });

  // ── Character resolution ──────────────────────

  describe('character resolution', () => {
    it('returns undefined when characterType is null (skipped)', () => {
      expect(resolveStorySetup(makeAnswers()).character).toBeUndefined();
    });

    it('returns "Girl" for Girl character type', () => {
      const result = resolveStorySetup(makeAnswers({ characterType: 'Girl' }));
      expect(result.character).toBe('Girl');
    });

    it('returns "Boy" for Boy character type', () => {
      const result = resolveStorySetup(makeAnswers({ characterType: 'Boy' }));
      expect(result.character).toBe('Boy');
    });

    // ── Animal sub-type ───────────────────────

    it('returns preset animal label for Cat', () => {
      const result = resolveStorySetup(
        makeAnswers({ characterType: 'Animal', animalType: 'Cat' }),
      );
      expect(result.character).toBe('Cat');
    });

    it('returns preset animal label for Dog', () => {
      const result = resolveStorySetup(
        makeAnswers({ characterType: 'Animal', animalType: 'Dog' }),
      );
      expect(result.character).toBe('Dog');
    });

    it('returns preset animal label for Rabbit', () => {
      const result = resolveStorySetup(
        makeAnswers({ characterType: 'Animal', animalType: 'Rabbit' }),
      );
      expect(result.character).toBe('Rabbit');
    });

    it('returns preset animal label for Owl', () => {
      const result = resolveStorySetup(
        makeAnswers({ characterType: 'Animal', animalType: 'Owl' }),
      );
      expect(result.character).toBe('Owl');
    });

    it('returns custom animal text for Other with non-empty custom text', () => {
      const result = resolveStorySetup(
        makeAnswers({
          characterType: 'Animal',
          animalType: 'Other',
          customAnimal: 'hedgehog',
        }),
      );
      expect(result.character).toBe('hedgehog');
    });

    it('returns "Animal" when animalType is Other but customAnimal is empty', () => {
      const result = resolveStorySetup(
        makeAnswers({
          characterType: 'Animal',
          animalType: 'Other',
          customAnimal: '',
        }),
      );
      expect(result.character).toBe('Animal');
    });

    it('returns "Animal" when animalType is Other but customAnimal is null', () => {
      const result = resolveStorySetup(
        makeAnswers({
          characterType: 'Animal',
          animalType: 'Other',
          customAnimal: null,
        }),
      );
      expect(result.character).toBe('Animal');
    });

    it('returns "Animal" when animalType is null (generic)', () => {
      const result = resolveStorySetup(
        makeAnswers({ characterType: 'Animal', animalType: null }),
      );
      expect(result.character).toBe('Animal');
    });

    // ── Custom character ──────────────────────

    it('returns custom character text when provided', () => {
      const result = resolveStorySetup(
        makeAnswers({
          characterType: 'Custom',
          customCharacter: 'a brave knight',
        }),
      );
      expect(result.character).toBe('a brave knight');
    });

    it('returns undefined when Custom character text is empty', () => {
      const result = resolveStorySetup(
        makeAnswers({ characterType: 'Custom', customCharacter: '' }),
      );
      expect(result.character).toBeUndefined();
    });

    it('returns undefined when Custom character text is null', () => {
      const result = resolveStorySetup(
        makeAnswers({ characterType: 'Custom', customCharacter: null }),
      );
      expect(result.character).toBeUndefined();
    });

    it('trims whitespace from custom character text', () => {
      const result = resolveStorySetup(
        makeAnswers({
          characterType: 'Custom',
          customCharacter: '  dragon wizard  ',
        }),
      );
      expect(result.character).toBe('dragon wizard');
    });

    // ── Name appending ────────────────────────

    it('appends name to Girl character', () => {
      const result = resolveStorySetup(
        makeAnswers({ characterType: 'Girl', characterName: 'Luna' }),
      );
      expect(result.character).toBe('Girl named Luna');
    });

    it('appends name to Boy character', () => {
      const result = resolveStorySetup(
        makeAnswers({ characterType: 'Boy', characterName: 'Max' }),
      );
      expect(result.character).toBe('Boy named Max');
    });

    it('appends name to preset animal', () => {
      const result = resolveStorySetup(
        makeAnswers({
          characterType: 'Animal',
          animalType: 'Cat',
          characterName: 'Whiskers',
        }),
      );
      expect(result.character).toBe('Cat named Whiskers');
    });

    it('appends name to custom animal', () => {
      const result = resolveStorySetup(
        makeAnswers({
          characterType: 'Animal',
          animalType: 'Other',
          customAnimal: 'hedgehog',
          characterName: 'Spike',
        }),
      );
      expect(result.character).toBe('hedgehog named Spike');
    });

    it('appends name to custom character', () => {
      const result = resolveStorySetup(
        makeAnswers({
          characterType: 'Custom',
          customCharacter: 'a brave knight',
          characterName: 'Sir Lancelot',
        }),
      );
      expect(result.character).toBe('a brave knight named Sir Lancelot');
    });

    it('does not append name when characterType is null', () => {
      const result = resolveStorySetup(
        makeAnswers({ characterType: null, characterName: 'Luna' }),
      );
      expect(result.character).toBeUndefined();
    });

    it('does not append empty name', () => {
      const result = resolveStorySetup(
        makeAnswers({ characterType: 'Girl', characterName: '' }),
      );
      expect(result.character).toBe('Girl');
    });

    it('does not append whitespace-only name', () => {
      const result = resolveStorySetup(
        makeAnswers({ characterType: 'Girl', characterName: '   ' }),
      );
      expect(result.character).toBe('Girl');
    });

    it('trims name whitespace', () => {
      const result = resolveStorySetup(
        makeAnswers({ characterType: 'Boy', characterName: '  Max  ' }),
      );
      expect(result.character).toBe('Boy named Max');
    });
  });

  // ── Setting resolution ────────────────────────

  describe('setting resolution', () => {
    it('returns undefined when setting is null (skipped)', () => {
      expect(resolveStorySetup(makeAnswers()).setting).toBeUndefined();
    });

    it('returns "Forest" for Forest setting', () => {
      const result = resolveStorySetup(makeAnswers({ setting: 'Forest' }));
      expect(result.setting).toBe('Forest');
    });

    it('returns "Beach" for Beach setting', () => {
      const result = resolveStorySetup(makeAnswers({ setting: 'Beach' }));
      expect(result.setting).toBe('Beach');
    });

    it('returns "Castle" for Castle setting', () => {
      const result = resolveStorySetup(makeAnswers({ setting: 'Castle' }));
      expect(result.setting).toBe('Castle');
    });

    it('returns "Space" for Space setting', () => {
      const result = resolveStorySetup(makeAnswers({ setting: 'Space' }));
      expect(result.setting).toBe('Space');
    });

    it('returns custom setting text when provided', () => {
      const result = resolveStorySetup(
        makeAnswers({ setting: 'Custom', customSetting: 'underwater cave' }),
      );
      expect(result.setting).toBe('underwater cave');
    });

    it('returns undefined when Custom setting text is empty', () => {
      const result = resolveStorySetup(
        makeAnswers({ setting: 'Custom', customSetting: '' }),
      );
      expect(result.setting).toBeUndefined();
    });

    it('returns undefined when Custom setting text is null', () => {
      const result = resolveStorySetup(
        makeAnswers({ setting: 'Custom', customSetting: null }),
      );
      expect(result.setting).toBeUndefined();
    });

    it('trims whitespace from custom setting text', () => {
      const result = resolveStorySetup(
        makeAnswers({ setting: 'Custom', customSetting: '  haunted house  ' }),
      );
      expect(result.setting).toBe('haunted house');
    });
  });

  // ── whoStarts resolution ──────────────────────

  describe('whoStarts resolution', () => {
    it('defaults to ai when whoStarts is ai', () => {
      const result = resolveStorySetup(makeAnswers({ whoStarts: 'ai' }));
      expect(result.whoStarts).toBe('ai');
    });

    it('passes through user when selected', () => {
      const result = resolveStorySetup(makeAnswers({ whoStarts: 'user' }));
      expect(result.whoStarts).toBe('user');
    });
  });

  // ── PRD validation scenarios ──────────────────

  describe('PRD validation scenarios', () => {
    it('case (a): undefined → random genre, undefined character/setting, ai starts', () => {
      const result = resolveStorySetup(undefined);
      expect(VALID_GENRES).toContain(result.genre);
      expect(result.character).toBeUndefined();
      expect(result.setting).toBeUndefined();
      expect(result.whoStarts).toBe('ai');
    });

    it('case (b): null genre + Animal Cat named Whiskers → random genre, "Cat named Whiskers"', () => {
      const result = resolveStorySetup(
        makeAnswers({
          genre: null,
          characterType: 'Animal',
          animalType: 'Cat',
          characterName: 'Whiskers',
        }),
      );
      expect(VALID_GENRES).toContain(result.genre);
      expect(result.character).toBe('Cat named Whiskers');
    });

    it('case (c): Horror + empty Custom character + empty Custom setting → Horror, undefined, undefined', () => {
      const result = resolveStorySetup(
        makeAnswers({
          genre: 'Horror',
          characterType: 'Custom',
          customCharacter: '',
          characterName: null,
          setting: 'Custom',
          customSetting: '',
        }),
      );
      expect(result.genre).toBe('Horror');
      expect(result.character).toBeUndefined();
      expect(result.setting).toBeUndefined();
    });

    it('case (d): Animal Other "hedgehog" named Spike → "hedgehog named Spike"', () => {
      const result = resolveStorySetup(
        makeAnswers({
          characterType: 'Animal',
          animalType: 'Other',
          customAnimal: 'hedgehog',
          characterName: 'Spike',
        }),
      );
      expect(result.character).toBe('hedgehog named Spike');
    });

    it('case (e): Girl named Luna → "Girl named Luna"', () => {
      const result = resolveStorySetup(
        makeAnswers({
          characterType: 'Girl',
          characterName: 'Luna',
        }),
      );
      expect(result.character).toBe('Girl named Luna');
    });
  });
});
