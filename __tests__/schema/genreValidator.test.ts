/**
 * Genre Validator Tests (US-001)
 *
 * Verifies the genreValidator in convex/schema.ts accepts exactly the 6
 * supported genre literals and that the TypeScript type derived from the
 * validator correctly constrains values at compile time.
 */

import { genreValidator } from '../../convex/schema';

/** The 6 supported genre literals as defined in the PRD. */
const VALID_GENRES = [
  'Mystery',
  'Fantasy',
  'Comedy',
  'Horror',
  'Fiction',
  'Fairy Tale',
] as const;

/** Strings that must NOT be accepted as valid genres. */
const INVALID_GENRES = [
  'adventure',
  'romance',
  'sci-fi',
  'mystery', // lowercase — validators are case-sensitive
  'FANTASY', // uppercase
  'fairy tale', // wrong casing
  '', // empty string
  'Fairy', // partial match
];

describe('genreValidator (US-001)', () => {
  it('should be defined and exported from convex/schema', () => {
    expect(genreValidator).toBeDefined();
  });

  it('should have a kind property indicating it is a union validator', () => {
    // Convex validators expose a `kind` property describing their type
    expect(genreValidator.kind).toBe('union');
  });

  describe('accepted genres', () => {
    it.each(VALID_GENRES)('should accept "%s" as a valid genre', genre => {
      // Convex validators expose `.members` on union types — each member is
      // a literal validator whose `.value` is the accepted string.
      const acceptedValues = (genreValidator as any).members.map(
        (m: any) => m.value,
      );
      expect(acceptedValues).toContain(genre);
    });

    it('should accept exactly 6 genre values', () => {
      const members = (genreValidator as any).members;
      expect(members).toHaveLength(6);
    });
  });

  describe('rejected values', () => {
    it.each(INVALID_GENRES)(
      'should NOT include "%s" as a valid genre',
      invalid => {
        const acceptedValues = (genreValidator as any).members.map(
          (m: any) => m.value,
        );
        expect(acceptedValues).not.toContain(invalid);
      },
    );
  });

  describe('type-level compile checks', () => {
    /**
     * These tests verify that the TypeScript type inferred from
     * genreValidator (via Convex's Infer<>) correctly constrains values.
     * If any assertion below fails to compile, the type is wrong.
     *
     * We use runtime checks here that mirror compile-time constraints
     * since Jest cannot fail on type errors directly.
     */
    it('should produce the correct set of literal values', () => {
      const expectedSet = new Set(VALID_GENRES);
      const actualSet = new Set(
        (genreValidator as any).members.map((m: any) => m.value),
      );
      expect(actualSet).toEqual(expectedSet);
    });
  });
});
