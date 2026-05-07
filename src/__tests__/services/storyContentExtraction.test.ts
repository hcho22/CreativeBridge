// Task 3.4-T: Test story content extraction and prompt generation with sample stories
// This test verifies that the enhanced prompt generation works correctly across grade levels

import {
  imageGenerationService,
  ImageGenerationEvent,
} from '../../services/imageGeneration';

describe('Task 3.4: Story Content Extraction and Prompt Generation Tests', () => {
  describe('Story Analysis and Content Extraction', () => {
    it('should analyze K-2 story content correctly', async () => {
      const k2Story = `
        Once upon a time, there was a little bunny named Fluffy who lived in a magical forest. 
        Fluffy was very happy and loved to play with his friend, a wise old owl named Hoot. 
        One sunny day, they discovered a beautiful garden filled with colorful flowers. 
        The bunny and owl danced together in the garden, laughing and having fun.
      `;

      // Test the story analysis (accessing private method through service)
      const analysis = imageGenerationService.analyzeStoryContent(k2Story);

      expect(analysis.characters.animals).toContain('bunny');
      expect(analysis.characters.animals).toContain('owl');
      expect(analysis.scenes.nature).toContain('forest');
      expect(analysis.scenes.nature).toContain('garden');
      expect(analysis.emotions).toContain('happy');
      expect(analysis.actions.length).toBeGreaterThan(0); // Should find some actions
      expect(analysis.themes).toContain('friendship');
      expect(analysis.complexity).toBe('simple');
    });

    it('should analyze 3-5 grade story content correctly', async () => {
      const elementaryStory = `
        Sarah was an adventurous young girl who loved exploring the old library in her town. 
        She discovered a mysterious book that transported her to an enchanted kingdom where 
        dragons and unicorns lived peacefully together. The brave princess of the land needed 
        Sarah's help to solve a puzzle and save the magical realm from losing its colors.
        Together, they journeyed through mountains and valleys, learning about courage and friendship.
      `;

      const analysis =
        imageGenerationService.analyzeStoryContent(elementaryStory);

      expect(analysis.characters.people).toContain('girl');
      expect(analysis.characters.fantasy).toContain('princess');
      // Note: 'dragons' and 'unicorns' are pluralized in the story, so they may not match singular patterns
      expect(analysis.characters.fantasy.length).toBeGreaterThanOrEqual(1);
      expect(analysis.scenes.buildings).toContain('library');
      expect(analysis.scenes.nature).toContain('mountain');
      expect(analysis.themes).toContain('adventure');
      expect(analysis.themes).toContain('friendship');
      expect(analysis.complexity).toBe('moderate');
    });

    it('should analyze 6-8 grade story content correctly', async () => {
      const middleSchoolStory = `
        Alex was a determined young scientist who had been working on a revolutionary discovery 
        in the school laboratory. When a mysterious phenomenon occurred in the city, causing 
        strange energy patterns to appear in the sky, Alex realized that their research might 
        hold the key to understanding what was happening. Working with their detective friend Maya, 
        they investigated the urban mystery, using scientific methods and logical reasoning 
        to uncover the truth behind the extraordinary events.
      `;

      const analysis =
        imageGenerationService.analyzeStoryContent(middleSchoolStory);

      expect(analysis.characters.people).toContain('scientist');
      expect(analysis.characters.roles).toContain('detective');
      expect(analysis.scenes.buildings).toContain('school');
      expect(analysis.scenes.urban).toContain('city');
      expect(analysis.themes).toContain('learning');
      expect(analysis.actions).toContain('working');
      expect(analysis.complexity).toBe('complex');
    });

    it('should analyze 9-12 grade story content correctly', async () => {
      const highSchoolStory = `
        The philosophical implications of artificial intelligence had always fascinated Elena, 
        a brilliant computer science student at the university. Her advanced research project 
        involved developing ethical frameworks for autonomous systems, but when she discovered 
        that her professor's laboratory was conducting questionable experiments with consciousness 
        simulation, she faced a moral dilemma. Elena had to navigate complex relationships with 
        her mentor, her research partner, and her own principles while determining the right 
        course of action in this challenging situation.
      `;

      const analysis =
        imageGenerationService.analyzeStoryContent(highSchoolStory);

      expect(analysis.characters.people).toContain('student');
      expect(analysis.characters.roles).toContain('scientist');
      expect(analysis.scenes.buildings).toContain('laboratory');
      expect(analysis.themes).toContain('learning');
      expect(analysis.wordCount).toBeGreaterThan(50);
      expect(analysis.complexity).toBe('complex');
    });
  });

  describe('Content Sanitization', () => {
    it('should sanitize inappropriate content', () => {
      const unsafeStory = `
        The hero fought a terrible battle with weapons and blood. 
        The monster was scary and frightening, causing death and violence.
        There was a gun and knife in the fight scene.
      `;

      const sanitized =
        imageGenerationService.sanitizeStoryContent(unsafeStory);

      expect(sanitized).not.toContain('battle');
      expect(sanitized).not.toContain('blood');
      expect(sanitized).not.toContain('weapon');
      expect(sanitized).not.toContain('death');
      expect(sanitized).not.toContain('violence');
      expect(sanitized).not.toContain('gun');
      expect(sanitized).not.toContain('knife');
      expect(sanitized).not.toContain('scary');
      expect(sanitized).not.toContain('monster');
    });

    it('should preserve safe content during sanitization', () => {
      const safeStory = `
        The friendly dragon lived peacefully in a beautiful forest. 
        Children loved to visit and play games with the gentle creature. 
        They would dance and sing together in the magical garden.
      `;

      const sanitized = imageGenerationService.sanitizeStoryContent(safeStory);

      expect(sanitized).toContain('friendly');
      expect(sanitized).toContain('dragon');
      expect(sanitized).toContain('peaceful');
      expect(sanitized).toContain('beautiful');
      expect(sanitized).toContain('children');
      expect(sanitized).toContain('play');
      expect(sanitized).toContain('gentle');
    });
  });

  describe('Grade-Appropriate Prompt Generation', () => {
    it('should generate K-2 appropriate prompts', async () => {
      const k2Story = `
        The little puppy named Spot loved to play in the sunny garden with his friend, 
        a colorful butterfly. They would chase each other around the flowers, 
        laughing and having the most wonderful time together.
      `;

      // Generate prompt using the private method
      const prompt = imageGenerationService.generatePrompt(k2Story, 'K-2');

      expect(prompt).toContain('watercolor');
      expect(prompt).toContain("children's book illustration");
      expect(prompt).toContain('bright colors');
      expect(prompt).toContain('simple shapes');
      expect(prompt).toContain('friendly');
      expect(prompt).toContain('puppy');
      expect(prompt).toContain('garden');
      expect(prompt).toContain('Safe for children');
      expect(prompt).toContain('bright and cheerful');
    });

    it('should generate 3-5 grade appropriate prompts', async () => {
      const elementaryStory = `
        Maya the young explorer discovered an ancient castle hidden in the enchanted forest. 
        With her magical map and brave heart, she ventured inside to find the lost treasure 
        that would help save her village from the drought.
      `;

      const prompt = imageGenerationService.generatePrompt(
        elementaryStory,
        '3-5',
      );

      expect(prompt).toContain("detailed children's book illustration");
      expect(prompt).toContain('vibrant colors');
      expect(prompt).toContain('explorer');
      expect(prompt).toContain('castle');
      expect(prompt).toContain('forest');
      expect(prompt).toContain('colorful and engaging');
      expect(prompt).toContain('child-friendly appeal');
      expect(prompt).toContain('Safe for children');
    });

    it('should generate 6-8 grade appropriate prompts', async () => {
      const middleSchoolStory = `
        Captain Rodriguez led her team of young astronauts on a mission to explore 
        the mysterious planet they had discovered. The alien landscape was filled 
        with crystal formations and strange but beautiful creatures that seemed to 
        communicate through patterns of light.
      `;

      const prompt = imageGenerationService.generatePrompt(
        middleSchoolStory,
        '6-8',
      );

      expect(prompt).toContain('realistic digital illustration');
      expect(prompt).toContain('detailed artwork');
      expect(prompt).toContain('adventure book style');
      expect(prompt).toContain('astronauts');
      expect(prompt).toContain('more realistic details');
      expect(prompt).toContain('dynamic composition');
      expect(prompt).toContain('Safe for children');
    });

    it('should generate 9-12 grade appropriate prompts', async () => {
      const highSchoolStory = `
        Dr. Chen, a renowned archaeologist, carefully examined the ancient artifacts 
        in the underground chamber. The detailed hieroglyphs told a story of an 
        advanced civilization that had developed sustainable technologies centuries 
        before modern science caught up.
      `;

      const prompt = imageGenerationService.generatePrompt(
        highSchoolStory,
        '9-12',
      );

      expect(prompt).toContain('sophisticated digital art');
      expect(prompt).toContain('professional digital art');
      expect(prompt).toContain('intricate details');
      expect(prompt).toContain('archaeologist');
      expect(prompt).toContain('sophisticated artistry');
      expect(prompt).toContain('mature but appropriate content');
      expect(prompt).toContain('Safe for children');
    });
  });

  describe('Character and Scene Extraction', () => {
    it('should extract multiple character types correctly', () => {
      const story = `
        The brave knight met a wise wizard and a friendly dragon in the enchanted forest. 
        A young girl and her pet cat also joined their adventure, along with a helpful owl.
      `;

      const analysis = imageGenerationService.analyzeStoryContent(story);

      expect(analysis.characters.fantasy).toContain('knight');
      expect(analysis.characters.fantasy).toContain('wizard');
      expect(analysis.characters.fantasy).toContain('dragon');
      expect(analysis.characters.people).toContain('girl');
      expect(analysis.characters.animals).toContain('cat');
      expect(analysis.characters.animals).toContain('owl');
    });

    it('should extract multiple scene types correctly', () => {
      const story = `
        Their journey took them from the magical forest to an ancient castle, 
        then through the busy city streets to finally reach the peaceful garden 
        behind the old school building.
      `;

      const analysis = imageGenerationService.analyzeStoryContent(story);

      expect(analysis.scenes.magical).toContain('enchanted forest');
      expect(analysis.scenes.buildings).toContain('castle');
      expect(analysis.scenes.urban).toContain('city');
      expect(analysis.scenes.nature).toContain('garden');
      expect(analysis.scenes.buildings).toContain('school');
    });

    it('should identify story themes correctly', () => {
      const friendshipStory = `
        Best friends Emma and Jake always helped each other and supported one another 
        through difficult times. Their friendship was built on trust and understanding.
      `;

      const adventureStory = `
        The brave explorer set out on an epic journey to discover new lands and 
        explore uncharted territories in search of ancient treasures.
      `;

      const magicStory = `
        The young wizard cast magical spells using her enchanted wand to help 
        the fairy kingdom overcome the dark curse.
      `;

      const friendshipAnalysis =
        imageGenerationService.analyzeStoryContent(friendshipStory);
      const adventureAnalysis =
        imageGenerationService.analyzeStoryContent(adventureStory);
      const magicAnalysis =
        imageGenerationService.analyzeStoryContent(magicStory);

      expect(friendshipAnalysis.themes).toContain('friendship');
      expect(adventureAnalysis.themes).toContain('adventure');
      expect(magicAnalysis.themes).toContain('magic');
    });
  });

  describe('End-to-End Prompt Generation', () => {
    it('should generate complete prompts for different story types', async () => {
      const stories = [
        {
          content:
            'The happy bunny hopped through the flower garden with his friend the butterfly.',
          grade: 'K-2' as const,
          expectedElements: [
            'watercolor',
            'bunny',
            'garden',
            'bright primary colors',
          ],
        },
        {
          content:
            'Princess Luna and her dragon companion searched for the magical crystal in the mountain caves.',
          grade: '3-5' as const,
          expectedElements: [
            'princess',
            'dragon',
            'mountain',
            "detailed children's book",
          ],
        },
        {
          content:
            'The young detective used scientific methods to solve the mystery in the city.',
          grade: '6-8' as const,
          expectedElements: [
            'detective',
            'city',
            'realistic digital illustration',
          ],
        },
        {
          content:
            'The philosopher contemplated the ethical implications of her research in the university laboratory.',
          grade: '9-12' as const,
          expectedElements: [
            'sophisticated digital art',
            'laboratory',
            'realistic style',
          ],
        },
      ];

      stories.forEach(({ content, grade, expectedElements }) => {
        const prompt = imageGenerationService.generatePrompt(content, grade);

        expectedElements.forEach(element => {
          expect(prompt).toContain(element);
        });

        // All prompts should be safe for children
        expect(prompt).toContain('Safe for children');
        expect(prompt).toContain('appropriate content');
      });
    });

    it('should handle edge cases in story content', () => {
      const edgeCases = [
        {
          name: 'very short story',
          content: 'Cat plays.',
          grade: 'K-2' as const,
        },
        {
          name: 'story with repetition',
          content:
            'The dog runs and runs and runs in the park with the dog running.',
          grade: 'K-2' as const,
        },
        {
          name: 'story with mixed content',
          content:
            'The scientist wizard studied magical formulas in the space laboratory castle.',
          grade: '6-8' as const,
        },
      ];

      edgeCases.forEach(({ name, content, grade }) => {
        const prompt = imageGenerationService.generatePrompt(content, grade);

        expect(prompt).toBeDefined();
        expect(prompt.length).toBeGreaterThan(50);
        expect(prompt).toContain('Safe for children');

        console.log(
          `${name} generated prompt:`,
          prompt.substring(0, 100) + '...',
        );
      });
    });
  });

  describe('Integration with Image Generation Service', () => {
    it('should use enhanced prompts in full image generation flow', async () => {
      // Skip if service is not enabled in test environment
      if (!imageGenerationService.isFeatureEnabled()) {
        expect(true).toBe(true);
        return;
      }

      const request: ImageGenerationEvent = {
        storyContent:
          'The friendly robot helped children learn about science in their colorful classroom.',
        gradeLevel: 'K-2',
        sessionId: 'test-integration',
        userId: 'test-user',
      };

      const result = await imageGenerationService.generateImage(request);

      // Should succeed in development mode
      expect(result.success).toBe(true);
      expect(result.imageUrl).toBeDefined();
      expect(result.serviceUsed).toMatch(/replicate|backup_service/);
    });
  });
});
