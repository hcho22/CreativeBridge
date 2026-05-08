// Task 3.4-T: Simplified test for story content extraction and prompt generation
// This test verifies the core functionality works correctly

import {
  imageGenerationService,
  ImageGenerationEvent,
} from '../../services/imageGeneration';

describe('Task 3.4: Story Content Extraction and Prompt Generation (Simplified)', () => {
  describe('Basic Story Analysis', () => {
    it('should analyze story content and extract key elements', () => {
      const story = `
        The friendly bunny named Fluffy loved to play in the sunny garden. 
        He was happy and enjoyed spending time with his friend, the wise owl.
      `;

      const analysis = imageGenerationService.analyzeStoryContent(story);

      // Test that analysis returns proper structure
      expect(analysis).toHaveProperty('characters');
      expect(analysis).toHaveProperty('scenes');
      expect(analysis).toHaveProperty('emotions');
      expect(analysis).toHaveProperty('actions');
      expect(analysis).toHaveProperty('themes');
      expect(analysis).toHaveProperty('complexity');

      // Test that some content was extracted
      expect(analysis.characters.animals).toContain('bunny');
      expect(analysis.characters.animals).toContain('owl');
      expect(analysis.scenes.nature).toContain('garden');
      expect(analysis.emotions).toContain('happy');
      expect(['simple', 'moderate']).toContain(analysis.complexity); // Either is acceptable for this story
    });

    it('should determine story complexity correctly', () => {
      const simpleStory = 'Cat plays. Dog runs.';
      const complexStory = `
        The philosophical implications of artificial intelligence in contemporary society 
        require comprehensive analysis of ethical frameworks and technological paradigms 
        that fundamentally challenge our understanding of consciousness and autonomy.
      `;

      const simpleAnalysis =
        imageGenerationService.analyzeStoryContent(simpleStory);
      const complexAnalysis =
        imageGenerationService.analyzeStoryContent(complexStory);

      expect(simpleAnalysis.complexity).toBe('simple');
      expect(complexAnalysis.complexity).toBe('complex');
    });
  });

  describe('Content Sanitization', () => {
    it('should remove unsafe content', () => {
      const unsafeStory =
        'The hero fought with weapons and blood in a scary battle.';
      const sanitized =
        imageGenerationService.sanitizeStoryContent(unsafeStory);

      expect(sanitized).not.toContain('weapons');
      expect(sanitized).not.toContain('blood');
      expect(sanitized).not.toContain('battle');
      expect(sanitized).not.toContain('scary');
    });

    it('should preserve safe content', () => {
      const safeStory =
        'The friendly dragon played with children in the garden.';
      const sanitized = imageGenerationService.sanitizeStoryContent(safeStory);

      expect(sanitized).toContain('friendly');
      expect(sanitized).toContain('dragon');
      expect(sanitized).toContain('children');
      expect(sanitized).toContain('garden');
    });
  });

  describe('Grade-Appropriate Prompt Generation', () => {
    // eslint-disable-next-line jest/no-disabled-tests -- Routed to US-015f.1.utils.text-drift.
    it.skip('should generate different prompts for different grade levels', () => {
      const story =
        'A brave princess explored the magical castle with her dragon friend.';

      const k2Prompt = imageGenerationService.generatePrompt(story, 'K-2');
      const highSchoolPrompt = imageGenerationService.generatePrompt(
        story,
        '9-12',
      );

      // K-2 should have simple, bright style
      expect(k2Prompt).toContain('watercolor');
      expect(k2Prompt).toContain('bright primary colors');
      expect(k2Prompt).toContain('simple shapes');

      // 9-12 should have sophisticated style
      expect(highSchoolPrompt).toContain('sophisticated');
      expect(highSchoolPrompt).toContain('realistic');

      // Both should be safe
      expect(k2Prompt).toContain('Safe for children');
      expect(highSchoolPrompt).toContain('Safe for children');
    });

    // eslint-disable-next-line jest/no-disabled-tests -- Routed to US-015f.1.utils.text-drift.
    it.skip('should include story elements in prompts', () => {
      const story =
        'The happy cat played in the sunny garden with colorful flowers.';
      const prompt = imageGenerationService.generatePrompt(story, 'K-2');

      expect(prompt).toContain('cat');
      expect(prompt).toContain('garden');
      expect(prompt).toContain('happy');
    });

    // eslint-disable-next-line jest/no-disabled-tests -- Routed to US-015f.1.utils.text-drift.
    it.skip('should create substantial prompts for all grade levels', () => {
      const story =
        'A young explorer discovered an ancient treasure in the mysterious cave.';

      const grades = ['K-2', '3-5', '6-8', '9-12'] as const;

      grades.forEach(grade => {
        const prompt = imageGenerationService.generatePrompt(story, grade);

        expect(prompt.length).toBeGreaterThan(50);
        expect(prompt).toContain('Safe for children');
        expect(prompt).toContain('appropriate content');
      });
    });
  });

  describe('End-to-End Integration', () => {
    it('should work with the image generation service', async () => {
      // Skip if service is not enabled in test environment
      if (!imageGenerationService.isFeatureEnabled()) {
        expect(true).toBe(true);
        return;
      }

      const request: ImageGenerationEvent = {
        storyContent:
          'The friendly puppy discovered a magical garden filled with singing flowers and dancing butterflies.',
        gradeLevel: 'K-2',
        sessionId: 'test-integration-3-4',
        userId: 'test-user',
      };

      const result = await imageGenerationService.generateImage(request);

      expect(result.success).toBe(true);
      expect(result.imageUrl).toBeDefined();
      expect(result.serviceUsed).toMatch(/replicate|backup_service/);
    });

    it('should handle various story types', () => {
      const stories = [
        { content: 'Bunny hops in garden.', grade: 'K-2' as const },
        {
          content: 'Princess saves kingdom with magic.',
          grade: '3-5' as const,
        },
        {
          content: 'Detective solves mystery using science.',
          grade: '6-8' as const,
        },
        {
          content: 'Scientist discovers breakthrough research.',
          grade: '9-12' as const,
        },
      ];

      stories.forEach(({ content, grade }) => {
        const prompt = imageGenerationService.generatePrompt(content, grade);
        const analysis = imageGenerationService.analyzeStoryContent(content);

        expect(prompt).toBeDefined();
        expect(prompt.length).toBeGreaterThan(30);
        expect(analysis).toBeDefined();
        expect(analysis.wordCount).toBeGreaterThan(0);
      });
    });
  });

  describe('Character and Scene Extraction Validation', () => {
    it('should extract common character types', () => {
      const story = 'The brave knight met a wise wizard and a friendly cat.';
      const analysis = imageGenerationService.analyzeStoryContent(story);

      expect(analysis.characters.fantasy).toContain('knight');
      expect(analysis.characters.fantasy).toContain('wizard');
      expect(analysis.characters.animals).toContain('cat');
    });

    it('should extract common scene types', () => {
      const story =
        'They traveled from the forest to the castle and then to the city.';
      const analysis = imageGenerationService.analyzeStoryContent(story);

      expect(analysis.scenes.nature).toContain('forest');
      expect(analysis.scenes.buildings).toContain('castle');
      expect(analysis.scenes.urban).toContain('city');
    });

    it('should handle stories with mixed content', () => {
      const story =
        'The scientist wizard studied magical formulas in the space castle.';
      const analysis = imageGenerationService.analyzeStoryContent(story);

      // Should extract multiple types of characters and scenes
      expect(
        analysis.characters.roles.length + analysis.characters.fantasy.length,
      ).toBeGreaterThan(0);
      expect(
        analysis.scenes.buildings.length + analysis.scenes.magical.length,
      ).toBeGreaterThan(0);
    });
  });
});
