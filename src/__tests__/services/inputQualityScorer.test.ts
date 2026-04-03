import { scoreInputQuality } from '../../services/inputQualityScorer';

describe('scoreInputQuality', () => {
  describe('bug scenario: 5 single unrelated words', () => {
    it('should score very low for single unrelated words', () => {
      const contributions = ['cat', 'blue', 'run', 'seven', 'lamp'];
      const score = scoreInputQuality(contributions, '3-5');
      expect(score).toBeLessThanOrEqual(0.2);
    });

    it('should be capped by the MIN_TOTAL_WORDS floor rule', () => {
      // 5 words total < 15 minimum, so score capped at 0.2
      const contributions = ['hello', 'world', 'test', 'words', 'here'];
      const score = scoreInputQuality(contributions);
      expect(score).toBeLessThanOrEqual(0.2);
    });
  });

  describe('empty and degenerate inputs', () => {
    it('should return 0 for empty contributions array', () => {
      expect(scoreInputQuality([])).toBe(0);
    });

    it('should return 0 for all-empty-string contributions', () => {
      const contributions = ['', '', '', '', ''];
      expect(scoreInputQuality(contributions)).toBe(0);
    });

    it('should return 0 for whitespace-only contributions', () => {
      const contributions = ['   ', '  ', '    '];
      expect(scoreInputQuality(contributions)).toBe(0);
    });
  });

  describe('repeated words (gaming attempt)', () => {
    it('should score very low for repeated identical words', () => {
      const contributions = [
        'the the the the the',
        'the the the the the',
        'the the the the the',
      ];
      const score = scoreInputQuality(contributions, '3-5');
      // Low diversity, no sentence structure, all stopwords for coherence
      expect(score).toBeLessThanOrEqual(0.3);
    });

    it('should score low for a single repeated non-stopword', () => {
      const contributions = [
        'cat cat cat cat cat',
        'cat cat cat cat cat',
        'cat cat cat cat cat',
      ];
      const score = scoreInputQuality(contributions, '3-5');
      // Word count met but diversity is terrible
      expect(score).toBeLessThan(0.5);
    });
  });

  describe('minimal but real sentences', () => {
    it('should score moderately for short simple sentences', () => {
      const contributions = [
        'The cat sat.',
        'It was blue.',
        'They ran fast.',
        'Seven came home.',
        'A lamp lit up.',
      ];
      const score = scoreInputQuality(contributions, 'K-2');
      // Has sentence structure, meets K-2 word count — scores reasonably well
      expect(score).toBeGreaterThan(0.2);
      expect(score).toBeLessThanOrEqual(1.0);
    });
  });

  describe('good quality contributions', () => {
    it('should score high for well-written story contributions', () => {
      const contributions = [
        'The brave knight rode through the dark forest searching for the lost treasure.',
        'She discovered a hidden cave behind the waterfall where ancient maps were stored.',
        'The knight followed the map through dangerous mountains and crossed the river.',
        'Inside the castle, she found the treasure chest guarded by a sleeping dragon.',
        'Using her cleverness, the knight quietly took the treasure and returned home safely.',
      ];
      const score = scoreInputQuality(contributions, '3-5');
      expect(score).toBeGreaterThanOrEqual(0.6);
    });

    it('should score high for K-2 appropriate content', () => {
      const contributions = [
        'I see a big dog in the park.',
        'The dog is brown and very fluffy.',
        'It runs fast and catches the ball.',
        'I like playing with the dog a lot.',
        'The dog goes home and takes a nap.',
      ];
      const score = scoreInputQuality(contributions, 'K-2');
      expect(score).toBeGreaterThanOrEqual(0.6);
    });
  });

  describe('single contribution edge case', () => {
    it('should handle a single long contribution', () => {
      const contributions = [
        'The knight rode into battle and fought bravely against the dragon who had been terrorizing the village for many months.',
      ];
      const score = scoreInputQuality(contributions, '3-5');
      // Good word count and sentence structure, but no coherence pairs
      expect(score).toBeGreaterThan(0.3);
    });
  });

  describe('grade level sensitivity', () => {
    it('should score higher for K-2 than 9-12 with enough words', () => {
      // Use contributions with enough words to exceed MIN_TOTAL_WORDS floor
      const contributions = [
        'I see a cat sitting in the garden today.',
        'The cat is nice and very fluffy and soft.',
        'I like the cat because it purrs so much.',
        'The cat plays with yarn and runs around.',
      ];
      const k2Score = scoreInputQuality(contributions, 'K-2');
      const highSchoolScore = scoreInputQuality(contributions, '9-12');
      expect(k2Score).toBeGreaterThan(highSchoolScore);
    });
  });

  describe('score is bounded', () => {
    it('should always return between 0 and 1', () => {
      const testCases = [
        { contributions: [], grade: '3-5' as const },
        { contributions: ['a'], grade: 'K-2' as const },
        { contributions: ['word '.repeat(100)], grade: '9-12' as const },
        {
          contributions: Array(10).fill(
            'A very long and detailed story contribution with many words.',
          ),
          grade: '6-8' as const,
        },
      ];

      for (const { contributions, grade } of testCases) {
        const score = scoreInputQuality(contributions, grade);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('determinism', () => {
    it('should return the same score for the same input', () => {
      const contributions = [
        'The cat sat on the mat.',
        'It looked around the room.',
        'Then it fell asleep quietly.',
      ];
      const score1 = scoreInputQuality(contributions, '3-5');
      const score2 = scoreInputQuality(contributions, '3-5');
      expect(score1).toBe(score2);
    });
  });
});
