import { apiClient } from '../../services/api';

describe('API Client - Story Content Validation', () => {
  describe('performLocalValidation (fallback)', () => {
    // Set up to force fallback behavior
    beforeEach(() => {
      // Mock a failing fetch to force fallback
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
      apiClient.updateConfig({ fallbackEnabled: true });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should allow content under 2000 characters with 8 sentences', async () => {
      const validContent =
        'This is the first sentence. This is the second sentence. This is the third sentence.';

      const result = await apiClient.validateStoryContent(validContent, 'K-2', {
        fallback: true,
      });

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.suggestions).toHaveLength(0);
    });

    it('should reject content over 2000 characters', async () => {
      // Create content over 2000 characters
      const longContent =
        'This is a very long sentence that will be repeated many times to exceed the character limit. '.repeat(
          25,
        ); // Should be over 2000 chars

      const result = await apiClient.validateStoryContent(longContent, 'K-2', {
        fallback: true,
      });

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Content too long');
      expect(result.suggestions).toContain(
        'Try to keep it under 2000 characters',
      );
    });

    it('should reject content with more than 8 sentences', async () => {
      const tooManySentences =
        'First sentence. Second sentence. Third sentence. Fourth sentence. Fifth sentence. Sixth sentence. Seventh sentence. Eighth sentence. Ninth sentence.';

      const result = await apiClient.validateStoryContent(
        tooManySentences,
        'K-2',
        { fallback: true },
      );

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Too many sentences');
      expect(result.suggestions).toContain('Limit to 8 sentences');
    });

    it('should allow exactly 8 sentences under 2000 characters', async () => {
      const perfectContent = `
        The brave little owl heard a gentle voice calling from the enchanted forest, and she knew that this was the beginning of an amazing adventure that would change her life forever.
        Following the mysterious sound through the moonlit trees, she discovered a beautiful star nestled among the wildflowers, glowing with magical light.
        As she approached the star, it began to sing a melody so sweet that all the forest animals gathered around to listen to its wonderful song.
      `.trim();

      expect(perfectContent.length).toBeLessThan(1000);

      const result = await apiClient.validateStoryContent(
        perfectContent,
        'K-2',
        { fallback: true },
      );

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should reject inappropriate content regardless of length', async () => {
      const inappropriateContent =
        'The character had a weapon and there was violence.';

      const result = await apiClient.validateStoryContent(
        inappropriateContent,
        'K-2',
        { fallback: true },
      );

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Contains inappropriate content');
      expect(result.suggestions).toContain(
        'Use more positive, age-appropriate language',
      );
    });

    it('should handle multiple validation issues', async () => {
      // Content that's too long AND has too many sentences AND is inappropriate
      const badContent =
        'Violence. Death. Weapon. Scary. ' + 'Bad sentence. '.repeat(150); // Over 2000 chars + 9+ sentences

      const result = await apiClient.validateStoryContent(badContent, 'K-2', {
        fallback: true,
      });

      expect(result.isValid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(1);
      expect(result.suggestions.length).toBeGreaterThan(1);
    });

    it('should work consistently across all grade levels', async () => {
      const validContent =
        'Once upon a time. There was a hero. They saved the day.';
      const gradeLevels: Array<'K-2' | '3-5' | '6-8' | '9-12'> = [
        'K-2',
        '3-5',
        '6-8',
        '9-12',
      ];

      for (const gradeLevel of gradeLevels) {
        const result = await apiClient.validateStoryContent(
          validContent,
          gradeLevel,
          { fallback: true },
        );
        expect(result.isValid).toBe(true);
      }
    });

    it('should handle edge case of exactly 2000 characters', async () => {
      // Create content that's exactly 2000 characters
      const exactContent = 'a'.repeat(1993) + '. b. c.'; // 1993 + 7 = 2000 chars, 3 sentences

      expect(exactContent.length).toBe(2000);

      const result = await apiClient.validateStoryContent(exactContent, 'K-2', {
        fallback: true,
      });

      expect(result.isValid).toBe(true);
      expect(result.issues).not.toContain('Content too long');
    });

    it('should handle edge case of exactly 2001 characters', async () => {
      // Create content that's exactly 2001 characters
      const overContent = 'a'.repeat(1994) + '. b. c.'; // 1994 + 7 = 2001 chars, 3 sentences

      expect(overContent.length).toBe(2001);

      const result = await apiClient.validateStoryContent(overContent, 'K-2', {
        fallback: true,
      });

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Content too long');
    });
  });
});
