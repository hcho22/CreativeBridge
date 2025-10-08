import { storyAgentService } from '../../services/storyAgent';

describe('Story Agent Service', () => {
  describe('continueStory', () => {
    it('should generate story continuation successfully', async () => {
      const request = {
        gradeLevel: 'K-2' as const,
        storySoFar:
          'Once upon a time, there was a little rabbit who loved to explore.',
        userInput: 'The rabbit found a magical door in the forest.',
        consistencyCheck: true,
        qualityThreshold: 0.7,
      };

      const result = await storyAgentService.continueStory(request);

      expect(result.success).toBe(true);
      expect(result.story).toBeTruthy();
      expect(result.story.length).toBeGreaterThan(10);
      expect(result.gradeLevel).toBe('K-2');

      console.log('Story continuation result:', result.story);
    });

    it('should handle all grade levels', async () => {
      const gradeLevels: Array<'K-2' | '3-5' | '6-8' | '9-12'> = [
        'K-2',
        '3-5',
        '6-8',
        '9-12',
      ];

      for (const gradeLevel of gradeLevels) {
        const request = {
          gradeLevel,
          storySoFar: 'The story began with an interesting character.',
          userInput: 'Something exciting happened next.',
          consistencyCheck: false,
        };

        const result = await storyAgentService.continueStory(request);

        expect(result.success).toBe(true);
        expect(result.story).toBeTruthy();
        expect(result.gradeLevel).toBe(gradeLevel);

        console.log(
          `${gradeLevel} continuation:`,
          result.story.substring(0, 100) + '...',
        );
      }
    });

    it('should always succeed even with problematic input', async () => {
      const request = {
        gradeLevel: 'K-2' as const,
        storySoFar: 'A very short story.',
        userInput: 'x', // Minimal input
        consistencyCheck: true,
        qualityThreshold: 0.9, // High threshold
      };

      const result = await storyAgentService.continueStory(request);

      expect(result.success).toBe(true);
      expect(result.story).toBeTruthy();
      expect(result.story.length).toBeGreaterThan(5);

      console.log('Problematic input result:', result.story);
    });
  });

  describe('generateStoryStarter', () => {
    it('should generate story starters', async () => {
      const request = {
        gradeLevel: 'K-2' as const,
        theme: 'adventure',
      };

      const result = await storyAgentService.generateStoryStarter(request);

      expect(result.success).toBe(true);
      expect(result.story).toBeTruthy();
      expect(result.story.length).toBeGreaterThan(20);

      console.log('Story starter result:', result.story);
    });
  });
});
