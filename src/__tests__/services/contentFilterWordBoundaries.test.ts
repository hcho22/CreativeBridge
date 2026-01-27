/**
 * Content Filter Word Boundary Tests
 *
 * Tests that the inappropriate word filter uses word boundaries correctly
 * to avoid false positives while still catching actual inappropriate content.
 */

import StoryGenerationService from '../../services/storyGenerationService';

describe('Content Filter - Word Boundary Detection', () => {
  let service: StoryGenerationService;

  beforeEach(() => {
    service = new StoryGenerationService();
  });

  describe('False Positive Prevention', () => {
    test('should NOT flag "aware" when filtering "war"', () => {
      const content =
        'Alex stood awestruck, gazing at the horizon where mountains floated above the ground.';
      const result = (service as any).filterAndLimitContent(content, '9-12');

      expect(result.isValid).toBe(true);
      expect(result.violations).not.toContain(
        'Contains inappropriate word: war',
      );
    });

    test('should NOT flag "warm" when filtering "war"', () => {
      const content = 'The warm sun shone down on the peaceful village.';
      const result = (service as any).filterAndLimitContent(content, 'K-2');

      expect(result.isValid).toBe(true);
      expect(result.violations).not.toContain(
        'Contains inappropriate word: war',
      );
    });

    test('should NOT flag "award" when filtering "war"', () => {
      const content = 'Sarah received an award for her bravery and kindness.';
      const result = (service as any).filterAndLimitContent(content, '3-5');

      expect(result.isValid).toBe(true);
      expect(result.violations).not.toContain(
        'Contains inappropriate word: war',
      );
    });

    test('should NOT flag "whatever" when filtering "hate"', () => {
      const content =
        'Whatever happens, we will face it together with courage.';
      const result = (service as any).filterAndLimitContent(content, '6-8');

      expect(result.isValid).toBe(true);
      expect(result.violations).not.toContain(
        'Contains inappropriate word: hate',
      );
    });

    test('should NOT flag "whispered" when filtering for multiple words', () => {
      const content =
        'In this realm, trees whispered secrets of ancient magic, inviting Alex to uncover the mysteries.';
      const result = (service as any).filterAndLimitContent(content, '9-12');

      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    test('should NOT flag "hatred" suffix when filtering "hate"', () => {
      const content =
        'The hero overcame their inner hatred through understanding and compassion.';
      const result = (service as any).filterAndLimitContent(content, '9-12');

      // Note: This might fail since "hatred" contains "hate" as a root word
      // This is a gray area - adjust based on requirements
      expect(result.isValid).toBe(true);
    });

    test('should NOT flag the actual problematic story from logs', () => {
      const content =
        'Alex stood awestruck, gazing at the horizon where mountains floated above the ground and rivers ran through the sky. In this realm, trees whispered secrets of ancient magic, inviting Alex to uncover the mysteries.';
      const result = (service as any).filterAndLimitContent(content, '9-12');

      expect(result.isValid).toBe(true);
      expect(result.violations).not.toContain(
        'Contains inappropriate word: war',
      );
      expect(result.violations).not.toContain(
        'Contains inappropriate word: hate',
      );
    });
  });

  describe('True Positive Detection', () => {
    test('should FLAG actual "war" as standalone word', () => {
      const content = 'The kingdom was in a state of war with its neighbors.';
      const result = (service as any).filterAndLimitContent(content, '6-8');

      expect(result.isValid).toBe(false);
      expect(result.violations).toContain('Contains inappropriate word: war');
    });

    test('should FLAG actual "hate" as standalone word', () => {
      const content = 'She felt hate towards those who had wronged her.';
      const result = (service as any).filterAndLimitContent(content, '6-8');

      expect(result.isValid).toBe(false);
      expect(result.violations).toContain('Contains inappropriate word: hate');
    });

    test('should FLAG "kill" as standalone word', () => {
      const content = 'The villain wanted to kill the hero in the story.';
      const result = (service as any).filterAndLimitContent(content, '3-5');

      expect(result.isValid).toBe(false);
      expect(result.violations).toContain('Contains inappropriate word: kill');
    });

    test('should FLAG "murder" as standalone word', () => {
      const content = 'The detective investigated the murder mystery.';
      const result = (service as any).filterAndLimitContent(content, '6-8');

      expect(result.isValid).toBe(false);
      expect(result.violations).toContain(
        'Contains inappropriate word: murder',
      );
    });

    test('should FLAG "blood" as standalone word', () => {
      const content =
        'There was blood on the ground from the injured character.';
      const result = (service as any).filterAndLimitContent(content, 'K-2');

      expect(result.isValid).toBe(false);
      expect(result.violations).toContain('Contains inappropriate word: blood');
    });
  });

  describe('Case Insensitive Detection', () => {
    test('should FLAG "War" with capital letter', () => {
      const content = 'War broke out between the two kingdoms.';
      const result = (service as any).filterAndLimitContent(content, '6-8');

      expect(result.isValid).toBe(false);
      expect(result.violations).toContain('Contains inappropriate word: war');
    });

    test('should FLAG "HATE" in all caps', () => {
      const content = 'The character felt HATE towards the villain.';
      const result = (service as any).filterAndLimitContent(content, '6-8');

      expect(result.isValid).toBe(false);
      expect(result.violations).toContain('Contains inappropriate word: hate');
    });
  });

  describe('Edge Cases', () => {
    test('should handle punctuation correctly - "war."', () => {
      const content = 'The story was about war.';
      const result = (service as any).filterAndLimitContent(content, '9-12');

      expect(result.isValid).toBe(false);
      expect(result.violations).toContain('Contains inappropriate word: war');
    });

    test('should handle punctuation correctly - "war,"', () => {
      const content = 'In times of war, courage is tested.';
      const result = (service as any).filterAndLimitContent(content, '9-12');

      expect(result.isValid).toBe(false);
      expect(result.violations).toContain('Contains inappropriate word: war');
    });

    test('should NOT flag skill/skillet when filtering "kill"', () => {
      const content = 'The chef used their skill to prepare a delicious meal.';
      const result = (service as any).filterAndLimitContent(content, '3-5');

      expect(result.isValid).toBe(true);
      expect(result.violations).not.toContain(
        'Contains inappropriate word: kill',
      );
    });
  });

  describe('Multi-violation Detection', () => {
    test('should flag multiple inappropriate words in same content', () => {
      const content = 'The story of war and hate was not appropriate.';
      const result = (service as any).filterAndLimitContent(content, 'K-2');

      expect(result.isValid).toBe(false);
      expect(result.violations).toContain('Contains inappropriate word: war');
      expect(result.violations).toContain('Contains inappropriate word: hate');
    });
  });
});
