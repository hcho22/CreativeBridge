import { storyGenerationService } from '../../services/storyGenerationService';
import { StoryRequest } from '../../types';

describe('Story Generation Service', () => {
  describe('generateStory', () => {
    it('should generate a story starter for K-2 grade level', async () => {
      const request: StoryRequest = {
        gradeLevel: 'K-2',
        userInput: 'Create a story about a magical adventure',
      };

      const result = await storyGenerationService.generateStory(request);

      expect(result.success).toBe(true);
      expect(result.story).toBeTruthy();
      expect(result.story.length).toBeGreaterThan(10);
      expect(result.gradeLevel).toBe('K-2');

      console.log('Generated K-2 story:', result.story);
    });

    it('should generate story continuation', async () => {
      const request: StoryRequest = {
        gradeLevel: 'K-2',
        storySoFar:
          'Once upon a time, there was a little rabbit who loved to explore.',
        userInput: 'The rabbit found a magical door in the forest.',
      };

      const result = await storyGenerationService.generateStory(request);

      expect(result.success).toBe(true);
      expect(result.story).toBeTruthy();
      expect(result.story.length).toBeGreaterThan(10);
      expect(result.gradeLevel).toBe('K-2');

      console.log('Generated continuation:', result.story);
    });

    it('should work across all grade levels', async () => {
      const gradeLevels: Array<'K-2' | '3-5' | '6-8' | '9-12'> = [
        'K-2',
        '3-5',
        '6-8',
        '9-12',
      ];

      for (const gradeLevel of gradeLevels) {
        const request: StoryRequest = {
          gradeLevel,
          userInput: `Create a story appropriate for grade level ${gradeLevel}`,
        };

        const result = await storyGenerationService.generateStory(request);

        expect(result.success).toBe(true);
        expect(result.story).toBeTruthy();
        expect(result.gradeLevel).toBe(gradeLevel);

        console.log(
          `Generated ${gradeLevel} story:`,
          result.story.substring(0, 100) + '...',
        );
      }
    });

    it('should handle story continuation with context', async () => {
      const request: StoryRequest = {
        gradeLevel: '3-5',
        storySoFar:
          'Maya discovered that her garden had grown something very special overnight. The purple flowers were glowing with a soft light.',
        userInput: 'Maya touched one of the glowing flowers',
      };

      const result = await storyGenerationService.generateStory(request);

      expect(result.success).toBe(true);
      expect(result.story).toBeTruthy();
      expect(result.gradeLevel).toBe('3-5');

      console.log('Generated contextual continuation:', result.story);
    });
  });

  describe('fallback system', () => {
    it('should always provide a story even without OpenAI', async () => {
      // Force service to use fallback by updating config
      storyGenerationService.updateConfig({
        apiKey: '', // Remove API key to force fallback
        fallbackEnabled: true,
      });

      const request: StoryRequest = {
        gradeLevel: 'K-2',
        userInput: 'Create a magical story',
      };

      const result = await storyGenerationService.generateStory(request);

      expect(result.success).toBe(true);
      expect(result.story).toBeTruthy();
      expect(result.story.length).toBeGreaterThan(20);

      console.log('Fallback story:', result.story);
    });
  });
});
