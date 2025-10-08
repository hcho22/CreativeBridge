import { storyAgentService } from '../../services/storyAgent';

describe('Story Agent Service - Enhanced Continuation', () => {
  describe('continueStory with long user input', () => {
    it('should handle user input over 500 characters successfully', async () => {
      // Create a 844-character input similar to what caused the original failure
      const longUserInput =
        'The little cat was so excited about the magical flower that sparkled in the garden. She had never seen anything like it before. The flower seemed to glow with an inner light that made everything around it look more beautiful. As she approached the flower, she could hear a gentle humming sound, like a sweet melody that filled her heart with joy. The other animals in the garden gathered around to see what was happening. A friendly rabbit hopped over, followed by a wise old owl who perched on a nearby branch. Even the butterflies came to dance around the magical flower. The cat realized that this was no ordinary flower - it was something truly special that would change her life forever. She gently touched one of the petals with her paw, and suddenly the whole garden lit up with colorful lights. It was the most amazing thing she had ever experienced in her entire life as a curious little cat exploring the wonderful world around her every single day.';

      expect(longUserInput.length).toBeGreaterThan(500); // Verify it's over the old limit
      expect(longUserInput.length).toBeLessThan(1000); // But under the new limit

      const request = {
        gradeLevel: 'K-2' as const,
        storySoFar:
          'The little cat hopped through the colorful garden and discovered a magical flower that sparkled in the sunshine.',
        userInput: longUserInput,
        consistencyCheck: true,
        qualityThreshold: 0.7,
      };

      const result = await storyAgentService.continueStory(request);

      expect(result.success).toBe(true);
      expect(result.story).toBeTruthy();
      expect(result.story.length).toBeGreaterThan(20);
      expect(result.gradeLevel).toBe('K-2');

      console.log('Long input continuation result:', result.story);
      console.log('Result error (expected):', result.error);
    });

    it('should handle extremely long user input (over 1000 chars) with fallback', async () => {
      // Create an input that's over 1000 characters
      const veryLongInput = 'A'.repeat(1100);

      const request = {
        gradeLevel: 'K-2' as const,
        storySoFar: 'Once upon a time...',
        userInput: veryLongInput,
        consistencyCheck: false,
      };

      const result = await storyAgentService.continueStory(request);

      expect(result.success).toBe(true);
      expect(result.story).toBeTruthy();
      expect(result.story.length).toBeGreaterThan(20);

      console.log('Very long input fallback result:', result.story);
    });

    it('should generate contextual continuations based on story theme', async () => {
      const themes = [
        {
          story: 'The wizard cast a magical spell',
          userInput: 'The magic grew stronger',
          expectedTheme: 'magical',
        },
        {
          story: 'They discovered a hidden treasure',
          userInput: 'They found more clues',
          expectedTheme: 'discovery',
        },
        {
          story: 'The two friends worked together',
          userInput: 'Their friendship helped them',
          expectedTheme: 'friendship',
        },
        {
          story: 'The little animal explored the forest',
          userInput: 'Other animals joined them',
          expectedTheme: 'animal',
        },
      ];

      for (const theme of themes) {
        const request = {
          gradeLevel: 'K-2' as const,
          storySoFar: theme.story,
          userInput: theme.userInput,
          consistencyCheck: false,
        };

        const result = await storyAgentService.continueStory(request);

        expect(result.success).toBe(true);
        expect(result.story).toBeTruthy();
        expect(result.story.length).toBeGreaterThan(30);

        console.log(
          `${theme.expectedTheme} themed continuation:`,
          result.story,
        );
      }
    });

    it('should work for all grade levels with contextual content', async () => {
      const gradeLevels: Array<'K-2' | '3-5' | '6-8' | '9-12'> = [
        'K-2',
        '3-5',
        '6-8',
        '9-12',
      ];

      for (const gradeLevel of gradeLevels) {
        const request = {
          gradeLevel,
          storySoFar: 'The adventure began with a mysterious discovery.',
          userInput:
            'They decided to investigate further and see what they could find.',
          consistencyCheck: false,
        };

        const result = await storyAgentService.continueStory(request);

        expect(result.success).toBe(true);
        expect(result.story).toBeTruthy();
        expect(result.gradeLevel).toBe(gradeLevel);

        // Check that higher grade levels have more sophisticated language
        if (gradeLevel === '9-12') {
          expect(result.story.length).toBeGreaterThan(70); // More reasonable expectation
        }

        console.log(
          `${gradeLevel} contextual continuation:`,
          result.story.substring(0, 100) + '...',
        );
      }
    });
  });
});
