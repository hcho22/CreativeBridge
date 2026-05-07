// Task 3.5-T: Test enhanced grade-level art style mapping
// This test verifies that the enhanced art style mapping is properly implemented

import { imageGenerationService } from '../../services/imageGeneration';

describe('Task 3.5: Enhanced Grade-Level Art Style Mapping Tests', () => {
  describe('Enhanced Art Style Integration', () => {
    it('should use enhanced art style definitions for K-2', () => {
      const story =
        'The friendly bunny played in the sunny garden with butterflies.';
      const prompt = imageGenerationService.generatePrompt(story, 'K-2');

      // Test enhanced K-2 style elements
      expect(prompt).toContain("watercolor children's book illustration");
      expect(prompt).toContain(
        'bright primary colors, soft pastels, warm and inviting tones',
      );
      expect(prompt).toContain('simple shapes, clear outlines, minimal detail');
      expect(prompt).toContain('watercolor painting style, soft brush strokes');
      expect(prompt).toContain('magical and whimsical, innocent and joyful');
      expect(prompt).toContain('centered composition, spacious layout');
      expect(prompt).toContain(
        'friendly cartoon animals, simple human figures',
      );
      expect(prompt).toContain('soft dreamy backgrounds, simple landscapes');
    });

    it('should use enhanced art style definitions for 3-5', () => {
      const story =
        'The brave princess and her dragon friend explored the magical castle.';
      const prompt = imageGenerationService.generatePrompt(story, '3-5');

      // Test enhanced 3-5 style elements
      expect(prompt).toContain("watercolor children's book illustration");
      expect(prompt).toContain('vibrant colors, rich earth tones');
      expect(prompt).toContain('moderate detail, clear focal points');
      expect(prompt).toContain(
        'watercolor painting style, textured brushstrokes',
      );
      expect(prompt).toContain(
        'adventurous and exciting, encouraging exploration',
      );
      expect(prompt).toContain(
        'expressive watercolor characters, lively poses',
      );
    });

    it('should use enhanced art style definitions for 6-8', () => {
      const story =
        'The young scientist discovered mysterious artifacts in the laboratory.';
      const prompt = imageGenerationService.generatePrompt(story, '6-8');

      // Test enhanced 6-8 style elements
      expect(prompt).toContain('watercolor illustration');
      expect(prompt).toContain(
        'sophisticated color schemes, dramatic lighting',
      );
      expect(prompt).toContain(
        'high detail, complex compositions, well-proportioned figures',
      );
      expect(prompt).toContain(
        'watercolor painting style, rich wet-on-wet techniques',
      );
      expect(prompt).toContain('adventurous and heroic, inspiring confidence');
      expect(prompt).toContain(
        'detailed watercolor characters, expressive facial features',
      );
    });

    it('should use enhanced art style definitions for 9-12', () => {
      const story =
        'The philosopher contemplated the ethical implications of research.';
      const prompt = imageGenerationService.generatePrompt(story, '9-12');

      // Test enhanced 9-12 style elements
      expect(prompt).toContain('sophisticated watercolor art');
      expect(prompt).toContain('mature color palettes, subtle gradients');
      expect(prompt).toContain('intricate details, advanced visual concepts');
      expect(prompt).toContain(
        'professional watercolor technique, advanced color layering',
      );
      expect(prompt).toContain(
        'thoughtful and inspiring, intellectually engaging',
      );
      expect(prompt).toContain(
        'detailed watercolor figures, nuanced expressions',
      );
    });
  });

  describe('Enhanced Emotional Tone Integration', () => {
    it('should enhance emotional tone based on story analysis', () => {
      const happyStory =
        'The joyful children played together in the magical garden.';
      const adventureStory =
        'The brave explorer discovered ancient treasures on an epic quest.';
      const friendshipStory =
        'Best friends helped each other overcome challenges together.';

      const happyPrompt = imageGenerationService.generatePrompt(
        happyStory,
        'K-2',
      );
      const adventurePrompt = imageGenerationService.generatePrompt(
        adventureStory,
        '3-5',
      );
      const friendshipPrompt = imageGenerationService.generatePrompt(
        friendshipStory,
        '6-8',
      );

      // Test emotional tone enhancements
      expect(happyPrompt).toContain('joyful atmosphere');
      expect(adventurePrompt).toContain('adventurous');
      expect(friendshipPrompt).toContain('inspiring confidence');
    });
  });

  describe('Enhanced Background Integration', () => {
    it('should integrate story scenes with enhanced background styles', () => {
      const forestStory =
        'The animals lived peacefully in the enchanted forest.';
      const castleStory = 'The princess lived in a beautiful magical castle.';
      const cityStory = 'The detective solved mysteries in the busy city.';

      const forestPrompt = imageGenerationService.generatePrompt(
        forestStory,
        'K-2',
      );
      const castlePrompt = imageGenerationService.generatePrompt(
        castleStory,
        '3-5',
      );
      const cityPrompt = imageGenerationService.generatePrompt(
        cityStory,
        '6-8',
      );

      // Test background integration
      expect(forestPrompt).toContain('forest');
      expect(forestPrompt).toContain('soft dreamy backgrounds');
      expect(castlePrompt).toContain('castle');
      expect(castlePrompt).toContain(
        'detailed environments, recognizable settings',
      );
      expect(cityPrompt).toContain('city');
      expect(cityPrompt).toContain(
        'detailed watercolor environments, atmospheric washes',
      );
    });
  });

  describe('Enhanced Prompt Structure', () => {
    it('should generate well-structured enhanced prompts for all grade levels', () => {
      const testStory = 'A curious character explored an interesting place.';
      const grades = ['K-2', '3-5', '6-8', '9-12'] as const;

      grades.forEach(grade => {
        const prompt = imageGenerationService.generatePrompt(testStory, grade);

        // Test prompt structure
        expect(prompt).toContain('Create a');
        expect(prompt).toContain('using');
        expect(prompt).toContain('with');
        expect(prompt).toContain('rendered in');
        expect(prompt).toContain('conveying');
        expect(prompt).toContain('composed with');
        expect(prompt).toContain('featuring');
        expect(prompt).toContain('Safe for children');

        // Test prompt length and comprehensiveness
        expect(prompt.length).toBeGreaterThan(200);
        expect(prompt.split(',').length).toBeGreaterThan(8);
      });
    });

    it('should maintain safety guidelines in all enhanced prompts', () => {
      const testStory = 'A hero helped someone in need.';
      const grades = ['K-2', '3-5', '6-8', '9-12'] as const;

      grades.forEach(grade => {
        const prompt = imageGenerationService.generatePrompt(testStory, grade);

        expect(prompt).toContain('Safe for children');
        expect(prompt).toContain('appropriate content');
      });
    });
  });

  describe('Integration with Public API Methods', () => {
    it('should work with getEnhancedArtStyleForGrade method', () => {
      const grades = ['K-2', '3-5', '6-8', '9-12'] as const;

      grades.forEach(grade => {
        const artStyle =
          imageGenerationService.getEnhancedArtStyleForGrade(grade);

        expect(artStyle).toHaveProperty('baseStyle');
        expect(artStyle).toHaveProperty('colorPalette');
        expect(artStyle).toHaveProperty('visualComplexity');
        expect(artStyle).toHaveProperty('artisticTechnique');
        expect(artStyle).toHaveProperty('emotionalTone');
        expect(artStyle).toHaveProperty('layoutStyle');
        expect(artStyle).toHaveProperty('characterStyle');
        expect(artStyle).toHaveProperty('backgroundStyle');

        expect(typeof artStyle.baseStyle).toBe('string');
        expect(artStyle.baseStyle.length).toBeGreaterThan(10);
      });
    });

    it('should provide backward compatibility with simple art style mapping', () => {
      const grades = ['K-2', '3-5', '6-8', '9-12'] as const;

      grades.forEach(grade => {
        const simpleStyle = imageGenerationService.getArtStyleForGrade(grade);

        expect(typeof simpleStyle).toBe('string');
        expect(simpleStyle.length).toBeGreaterThan(20);
      });
    });
  });
});
