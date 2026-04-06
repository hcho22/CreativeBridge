/**
 * Art Style Enforcement Test Suite
 * Comprehensive tests to verify prompt generation works correctly for all grade levels
 * Ensures consistent art style enforcement across the entire system
 *
 * Test Coverage:
 * - All grade levels (K-2, 3-5, 6-8, 9-12)
 * - Primary path: generateStorySpecificPrompt
 * - Fallback paths: generatePrompt and getArtStyleForGrade
 * - Regression tests with real story content from different genres
 * - Expected style keywords verification per grade level
 */

import { imageGenerationService } from '../../services/imageGeneration';
import type { GradeLevel } from '../../types/database';

// Mock environment variables
jest.mock('react-native-dotenv', () => ({
  REPLICATE_API_TOKEN: 'test-replicate-token',
  BACKUP_IMAGE_API_TOKEN: 'test-backup-token',
  IMAGE_GENERATION_ENABLED: 'true',
}));

// Mock external dependencies
jest.mock('../../services/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

jest.mock('../../services/xpEventTracker', () => ({
  xpEventTracker: {
    createImageGenerationEvent: jest.fn(),
    updateImageGenerationEvent: jest.fn(),
  },
}));

jest.mock('../../services/storySessionManager', () => ({
  storySessionManager: {
    updateSessionWithImage: jest.fn(),
  },
}));

describe('Art Style Enforcement - Comprehensive Test Suite', () => {
  describe('Grade Level K-2: Watercolor Style Enforcement', () => {
    const gradeLevel: GradeLevel = 'K-2';

    test('should contain watercolor base style keywords', () => {
      const storyContent =
        'A friendly bunny named Ben hopped through the garden with colorful flowers.';
      const artStyle =
        imageGenerationService.getEnhancedArtStyleForGrade(gradeLevel);
      const generateStorySpecificPrompt = (imageGenerationService as any)
        .generateStorySpecificPrompt;
      const prompt = generateStorySpecificPrompt.call(
        imageGenerationService,
        storyContent,
        gradeLevel,
        artStyle,
      );

      expect(prompt).toContain('watercolor');
      expect(prompt).toMatch(/children's book/i);
    });

    test('should contain bright colors and primary color keywords', () => {
      const storyContent =
        'The happy children played in the sunny park with red balloons and blue skies.';
      const artStyle =
        imageGenerationService.getEnhancedArtStyleForGrade(gradeLevel);
      const generateStorySpecificPrompt = (imageGenerationService as any)
        .generateStorySpecificPrompt;
      const prompt = generateStorySpecificPrompt.call(
        imageGenerationService,
        storyContent,
        gradeLevel,
        artStyle,
      );

      expect(prompt).toMatch(/bright/i);
      expect(prompt).toMatch(/color/i);
    });

    test('should contain simple shapes and visual complexity keywords', () => {
      const storyContent =
        'A little turtle swam in the pond with green lily pads.';
      const artStyle =
        imageGenerationService.getEnhancedArtStyleForGrade(gradeLevel);
      const generateStorySpecificPrompt = (imageGenerationService as any)
        .generateStorySpecificPrompt;
      const prompt = generateStorySpecificPrompt.call(
        imageGenerationService,
        storyContent,
        gradeLevel,
        artStyle,
      );

      expect(prompt).toMatch(/simple/i);
    });

    test('should contain magical and whimsical tone keywords', () => {
      const storyContent =
        'The magic fairy sprinkled sparkles on the enchanted forest.';
      const artStyle =
        imageGenerationService.getEnhancedArtStyleForGrade(gradeLevel);
      const generateStorySpecificPrompt = (imageGenerationService as any)
        .generateStorySpecificPrompt;
      const prompt = generateStorySpecificPrompt.call(
        imageGenerationService,
        storyContent,
        gradeLevel,
        artStyle,
      );

      expect(prompt).toMatch(/magical|whimsical/i);
    });

    test('should use friendly cartoon character style', () => {
      const storyContent =
        'Timmy the tiger and his friend the elephant played together.';
      const artStyle =
        imageGenerationService.getEnhancedArtStyleForGrade(gradeLevel);
      const generateStorySpecificPrompt = (imageGenerationService as any)
        .generateStorySpecificPrompt;
      const prompt = generateStorySpecificPrompt.call(
        imageGenerationService,
        storyContent,
        gradeLevel,
        artStyle,
      );

      expect(prompt).toMatch(/friendly|cartoon/i);
    });

    test('fallback: getArtStyleForGrade returns correct K-2 style', () => {
      const style = imageGenerationService.getArtStyleForGrade(gradeLevel);

      expect(style).toContain('watercolor');
      expect(style).toContain("children's book");
      expect(style).toContain('bright colors');
      expect(style).toContain('friendly cartoon');
    });
  });

  describe("Grade Level 3-5: Watercolor Children's Book Illustration", () => {
    const gradeLevel: GradeLevel = '3-5';

    test('should contain watercolor illustration base style keywords', () => {
      const storyContent =
        'Alex the brave explorer climbed the tall mountain to discover ancient golden treasures.';
      const artStyle =
        imageGenerationService.getEnhancedArtStyleForGrade(gradeLevel);
      const generateStorySpecificPrompt = (imageGenerationService as any)
        .generateStorySpecificPrompt;
      const prompt = generateStorySpecificPrompt.call(
        imageGenerationService,
        storyContent,
        gradeLevel,
        artStyle,
      );

      expect(prompt).toMatch(/watercolor/i);
      expect(prompt).toMatch(/children's book/i);
      expect(prompt).toMatch(/illustration/i);
    });

    test('should contain vibrant colors keywords', () => {
      const storyContent =
        'Rainbow the magical unicorn appeared after the rain, showing brilliant colors across the blue sky.';
      const artStyle =
        imageGenerationService.getEnhancedArtStyleForGrade(gradeLevel);
      const generateStorySpecificPrompt = (imageGenerationService as any)
        .generateStorySpecificPrompt;
      const prompt = generateStorySpecificPrompt.call(
        imageGenerationService,
        storyContent,
        gradeLevel,
        artStyle,
      );

      expect(prompt).toMatch(/vibrant/i);
      expect(prompt).toMatch(/color/i);
    });

    test('should contain watercolor painting technique keywords', () => {
      const storyContent =
        'Sarah the curious artist painted a beautiful picture of the blue ocean with playful dolphins.';
      const artStyle =
        imageGenerationService.getEnhancedArtStyleForGrade(gradeLevel);
      const generateStorySpecificPrompt = (imageGenerationService as any)
        .generateStorySpecificPrompt;
      const prompt = generateStorySpecificPrompt.call(
        imageGenerationService,
        storyContent,
        gradeLevel,
        artStyle,
      );

      expect(prompt).toMatch(/watercolor|painting/i);
    });

    test('should contain adventurous and exciting tone keywords', () => {
      const storyContent =
        'Captain Jake the brave adventurer set sail on the wooden ship for an exciting journey to explore new tropical lands.';
      const artStyle =
        imageGenerationService.getEnhancedArtStyleForGrade(gradeLevel);
      const generateStorySpecificPrompt = (imageGenerationService as any)
        .generateStorySpecificPrompt;
      const prompt = generateStorySpecificPrompt.call(
        imageGenerationService,
        storyContent,
        gradeLevel,
        artStyle,
      );

      expect(prompt).toMatch(/adventurous|exciting/i);
    });

    test('should use expressive watercolor character style', () => {
      const storyContent =
        'Emma the young scientist examined the colorful specimens carefully in her bright laboratory.';
      const artStyle =
        imageGenerationService.getEnhancedArtStyleForGrade(gradeLevel);
      const generateStorySpecificPrompt = (imageGenerationService as any)
        .generateStorySpecificPrompt;
      const prompt = generateStorySpecificPrompt.call(
        imageGenerationService,
        storyContent,
        gradeLevel,
        artStyle,
      );

      expect(prompt).toMatch(/watercolor|expressive/i);
    });

    test('fallback: getArtStyleForGrade returns correct 3-5 style', () => {
      const style = imageGenerationService.getArtStyleForGrade(gradeLevel);

      expect(style).toContain("watercolor children's book");
      expect(style).toContain('vibrant colors');
      expect(style).toContain('watercolor style');
    });
  });

  describe('Grade Level 6-8: Watercolor Illustration', () => {
    const gradeLevel: GradeLevel = '6-8';

    test('should contain watercolor illustration base style keywords', () => {
      const storyContent =
        'Detective Morgan the clever investigator carefully analyzed the mysterious clues in the dimly lit room to solve the complex case.';
      const artStyle =
        imageGenerationService.getEnhancedArtStyleForGrade(gradeLevel);
      const generateStorySpecificPrompt = (imageGenerationService as any)
        .generateStorySpecificPrompt;
      const prompt = generateStorySpecificPrompt.call(
        imageGenerationService,
        storyContent,
        gradeLevel,
        artStyle,
      );

      expect(prompt).toMatch(/watercolor/i);
      expect(prompt).toMatch(/illustration/i);
    });

    test('should contain sophisticated color scheme keywords', () => {
      const storyContent =
        'Marcus the talented artist used dramatic golden lighting to create atmosphere in the beautiful painting.';
      const artStyle =
        imageGenerationService.getEnhancedArtStyleForGrade(gradeLevel);
      const generateStorySpecificPrompt = (imageGenerationService as any)
        .generateStorySpecificPrompt;
      const prompt = generateStorySpecificPrompt.call(
        imageGenerationService,
        storyContent,
        gradeLevel,
        artStyle,
      );

      expect(prompt).toMatch(/sophisticated/i);
    });

    test('should contain high detail and complex composition keywords', () => {
      const storyContent =
        'Professor Chen the brilliant inventor examined the intricate golden clockwork mechanism that revealed the complexity of the ancient invention.';
      const artStyle =
        imageGenerationService.getEnhancedArtStyleForGrade(gradeLevel);
      const generateStorySpecificPrompt = (imageGenerationService as any)
        .generateStorySpecificPrompt;
      const prompt = generateStorySpecificPrompt.call(
        imageGenerationService,
        storyContent,
        gradeLevel,
        artStyle,
      );

      expect(prompt).toMatch(/detail|complex/i);
    });

    test('should contain adventurous and heroic tone keywords', () => {
      const storyContent =
        'Jordan the brave hero stood courageously against the dangerous challenges to protect the innocent people in the city.';
      const artStyle =
        imageGenerationService.getEnhancedArtStyleForGrade(gradeLevel);
      const generateStorySpecificPrompt = (imageGenerationService as any)
        .generateStorySpecificPrompt;
      const prompt = generateStorySpecificPrompt.call(
        imageGenerationService,
        storyContent,
        gradeLevel,
        artStyle,
      );

      expect(prompt).toMatch(/adventurous|heroic/i);
    });

    test('should use watercolor character style', () => {
      const storyContent =
        'Dr. Sarah the dedicated researcher worked together with her team in the modern laboratory to make an important scientific discovery.';
      const artStyle =
        imageGenerationService.getEnhancedArtStyleForGrade(gradeLevel);
      const generateStorySpecificPrompt = (imageGenerationService as any)
        .generateStorySpecificPrompt;
      const prompt = generateStorySpecificPrompt.call(
        imageGenerationService,
        storyContent,
        gradeLevel,
        artStyle,
      );

      expect(prompt).toMatch(/watercolor/i);
    });

    test('fallback: getArtStyleForGrade returns correct 6-8 style', () => {
      const style = imageGenerationService.getArtStyleForGrade(gradeLevel);

      expect(style).toContain('watercolor illustration');
      expect(style).toContain('detailed artwork');
      expect(style).toContain('adventure book style');
    });
  });

  describe('Grade Level 9-12: Sophisticated Watercolor Art', () => {
    const gradeLevel: GradeLevel = '9-12';

    test('should contain sophisticated watercolor art base style keywords', () => {
      const storyContent =
        'Dr. Nathaniel the wise philosopher contemplated the deep meaning of existence in the modern urban world.';
      const artStyle =
        imageGenerationService.getEnhancedArtStyleForGrade(gradeLevel);
      const generateStorySpecificPrompt = (imageGenerationService as any)
        .generateStorySpecificPrompt;
      const prompt = generateStorySpecificPrompt.call(
        imageGenerationService,
        storyContent,
        gradeLevel,
        artStyle,
      );

      expect(prompt).toMatch(/sophisticated/i);
      expect(prompt).toMatch(/watercolor/i);
      expect(prompt).toMatch(/art/i);
    });

    test('should contain mature color palette keywords', () => {
      const storyContent =
        'Elena the talented painter created subtle golden gradations of light that formed a professional artistic composition.';
      const artStyle =
        imageGenerationService.getEnhancedArtStyleForGrade(gradeLevel);
      const generateStorySpecificPrompt = (imageGenerationService as any)
        .generateStorySpecificPrompt;
      const prompt = generateStorySpecificPrompt.call(
        imageGenerationService,
        storyContent,
        gradeLevel,
        artStyle,
      );

      expect(prompt).toMatch(/mature/i);
    });

    test('should contain complex artistic composition keywords', () => {
      const storyContent =
        'Architect Rodriguez the brilliant designer examined the intricate details of the modern architectural design that showed advanced engineering concepts.';
      const artStyle =
        imageGenerationService.getEnhancedArtStyleForGrade(gradeLevel);
      const generateStorySpecificPrompt = (imageGenerationService as any)
        .generateStorySpecificPrompt;
      const prompt = generateStorySpecificPrompt.call(
        imageGenerationService,
        storyContent,
        gradeLevel,
        artStyle,
      );

      expect(prompt).toMatch(/complex|intricate/i);
    });

    test('should contain thoughtful and inspiring tone keywords', () => {
      const storyContent =
        'Professor Williams the inspiring educator motivated the young students to pursue their intellectual goals in the university library.';
      const artStyle =
        imageGenerationService.getEnhancedArtStyleForGrade(gradeLevel);
      const generateStorySpecificPrompt = (imageGenerationService as any)
        .generateStorySpecificPrompt;
      const prompt = generateStorySpecificPrompt.call(
        imageGenerationService,
        storyContent,
        gradeLevel,
        artStyle,
      );

      expect(prompt).toMatch(/thoughtful|inspiring/i);
    });

    test('should use professional watercolor technique', () => {
      const storyContent =
        'Master Lee the professional artist demonstrated advanced lighting techniques in the contemporary art studio.';
      const artStyle =
        imageGenerationService.getEnhancedArtStyleForGrade(gradeLevel);
      const generateStorySpecificPrompt = (imageGenerationService as any)
        .generateStorySpecificPrompt;
      const prompt = generateStorySpecificPrompt.call(
        imageGenerationService,
        storyContent,
        gradeLevel,
        artStyle,
      );

      expect(prompt).toMatch(/professional/i);
      expect(prompt).toMatch(/watercolor/i);
    });

    test('fallback: getArtStyleForGrade returns correct 9-12 style', () => {
      const style = imageGenerationService.getArtStyleForGrade(gradeLevel);

      expect(style).toContain('sophisticated watercolor art');
      expect(style).toContain('expressive style');
      expect(style).toContain('mature artistic composition');
    });
  });

  describe('Regression Tests: Adventure Genre Stories', () => {
    test('K-2: Adventure story maintains watercolor style', () => {
      const storyContent =
        'Captain Whiskers the brave cat sailed across the sparkling blue ocean to find the treasure island with golden palm trees.';
      const gradeLevel: GradeLevel = 'K-2';
      const artStyle =
        imageGenerationService.getEnhancedArtStyleForGrade(gradeLevel);
      const generateStorySpecificPrompt = (imageGenerationService as any)
        .generateStorySpecificPrompt;
      const prompt = generateStorySpecificPrompt.call(
        imageGenerationService,
        storyContent,
        gradeLevel,
        artStyle,
      );

      expect(prompt).toContain('watercolor');
      expect(prompt).toMatch(/children's book/i);
      expect(prompt).toMatch(/bright|colorful/i);
      expect(prompt).toMatch(/simple/i);
    });

    test('3-5: Adventure story maintains watercolor illustration style', () => {
      const storyContent =
        'Maya the curious explorer discovered an ancient temple hidden deep in the green jungle, filled with mysterious golden artifacts and colorful tropical plants.';
      const gradeLevel: GradeLevel = '3-5';
      const artStyle =
        imageGenerationService.getEnhancedArtStyleForGrade(gradeLevel);
      const generateStorySpecificPrompt = (imageGenerationService as any)
        .generateStorySpecificPrompt;
      const prompt = generateStorySpecificPrompt.call(
        imageGenerationService,
        storyContent,
        gradeLevel,
        artStyle,
      );

      expect(prompt).toMatch(/watercolor/i);
      expect(prompt).toMatch(/illustration/i);
      expect(prompt).toMatch(/vibrant/i);
      expect(prompt).toMatch(/adventurous/i);
    });

    test('6-8: Adventure story maintains watercolor illustration style', () => {
      const storyContent =
        'Captain Torres the determined mountaineer navigated through treacherous snowy mountain passes, using advanced equipment and teamwork to overcome every obstacle.';
      const gradeLevel: GradeLevel = '6-8';
      const artStyle =
        imageGenerationService.getEnhancedArtStyleForGrade(gradeLevel);
      const generateStorySpecificPrompt = (imageGenerationService as any)
        .generateStorySpecificPrompt;
      const prompt = generateStorySpecificPrompt.call(
        imageGenerationService,
        storyContent,
        gradeLevel,
        artStyle,
      );

      expect(prompt).toMatch(/watercolor/i);
      expect(prompt).toMatch(/illustration/i);
      expect(prompt).toMatch(/detail/i);
    });

    test('9-12: Adventure story maintains sophisticated art style', () => {
      const storyContent =
        'Dr. Harrison the meticulous archaeologist excavated the ancient site, revealing golden artifacts that would reshape our understanding of historical civilizations.';
      const gradeLevel: GradeLevel = '9-12';
      const artStyle =
        imageGenerationService.getEnhancedArtStyleForGrade(gradeLevel);
      const generateStorySpecificPrompt = (imageGenerationService as any)
        .generateStorySpecificPrompt;
      const prompt = generateStorySpecificPrompt.call(
        imageGenerationService,
        storyContent,
        gradeLevel,
        artStyle,
      );

      expect(prompt).toMatch(/sophisticated/i);
      expect(prompt).toMatch(/professional/i);
      expect(prompt).toMatch(/complex|intricate/i);
    });
  });

  describe('Regression Tests: Friendship Genre Stories', () => {
    test('K-2: Friendship story maintains watercolor style', () => {
      const storyContent =
        'Lily the cheerful bunny and Max the playful puppy became best friends when they shared their colorful crayons and drew happy pictures together in the sunny park.';
      const gradeLevel: GradeLevel = 'K-2';
      const artStyle =
        imageGenerationService.getEnhancedArtStyleForGrade(gradeLevel);
      const generateStorySpecificPrompt = (imageGenerationService as any)
        .generateStorySpecificPrompt;
      const prompt = generateStorySpecificPrompt.call(
        imageGenerationService,
        storyContent,
        gradeLevel,
        artStyle,
      );

      expect(prompt).toContain('watercolor');
      expect(prompt).toMatch(/bright|warm/i);
      expect(prompt).toMatch(/simple/i);
      expect(prompt).toMatch(/friendly/i);
    });

    test('3-5: Friendship story maintains watercolor illustration style', () => {
      const storyContent =
        'Tommy the creative builder and his friends worked together to build a wooden treehouse with colorful flags, learning about cooperation and supporting each other through challenges.';
      const gradeLevel: GradeLevel = '3-5';
      const artStyle =
        imageGenerationService.getEnhancedArtStyleForGrade(gradeLevel);
      const generateStorySpecificPrompt = (imageGenerationService as any)
        .generateStorySpecificPrompt;
      const prompt = generateStorySpecificPrompt.call(
        imageGenerationService,
        storyContent,
        gradeLevel,
        artStyle,
      );

      expect(prompt).toMatch(/watercolor/i);
      expect(prompt).toMatch(/illustration/i);
      expect(prompt).toMatch(/vibrant/i);
    });

    test('6-8: Friendship story maintains watercolor illustration style', () => {
      const storyContent =
        'Aisha the passionate scientist and her diverse group of classmates formed a strong bond through their shared experiments with colorful chemical reactions in the modern laboratory.';
      const gradeLevel: GradeLevel = '6-8';
      const artStyle =
        imageGenerationService.getEnhancedArtStyleForGrade(gradeLevel);
      const generateStorySpecificPrompt = (imageGenerationService as any)
        .generateStorySpecificPrompt;
      const prompt = generateStorySpecificPrompt.call(
        imageGenerationService,
        storyContent,
        gradeLevel,
        artStyle,
      );

      expect(prompt).toMatch(/watercolor/i);
      expect(prompt).toMatch(/illustration/i);
      expect(prompt).toMatch(/sophisticated/i);
    });

    test('9-12: Friendship story maintains sophisticated art style', () => {
      const storyContent =
        'Professor Chen the thoughtful philosopher and Dr. Martinez the insightful psychologist built their lifelong friendship on mutual respect and deep intellectual discussions in the university library with rich mahogany shelves.';
      const gradeLevel: GradeLevel = '9-12';
      const artStyle =
        imageGenerationService.getEnhancedArtStyleForGrade(gradeLevel);
      const generateStorySpecificPrompt = (imageGenerationService as any)
        .generateStorySpecificPrompt;
      const prompt = generateStorySpecificPrompt.call(
        imageGenerationService,
        storyContent,
        gradeLevel,
        artStyle,
      );

      expect(prompt).toMatch(/sophisticated/i);
      expect(prompt).toMatch(/mature/i);
      expect(prompt).toMatch(/thoughtful/i);
    });
  });

  describe('Regression Tests: Mystery Genre Stories', () => {
    test('K-2: Mystery story maintains watercolor style', () => {
      const storyContent =
        'Detective Benny the curious bunny followed the trail of muddy footprints through the colorful garden to find who ate the missing orange carrots.';
      const gradeLevel: GradeLevel = 'K-2';
      const artStyle =
        imageGenerationService.getEnhancedArtStyleForGrade(gradeLevel);
      const generateStorySpecificPrompt = (imageGenerationService as any)
        .generateStorySpecificPrompt;
      const prompt = generateStorySpecificPrompt.call(
        imageGenerationService,
        storyContent,
        gradeLevel,
        artStyle,
      );

      expect(prompt).toContain('watercolor');
      expect(prompt).toMatch(/children's book/i);
      expect(prompt).toMatch(/friendly/i);
      expect(prompt).toMatch(/simple/i);
    });

    test('3-5: Mystery story maintains watercolor illustration style', () => {
      const storyContent =
        'Sophie the clever detective and her Mystery Club friends investigated the strange noises in the old library with dusty brown shelves, carefully examining colorful clues to solve the puzzle.';
      const gradeLevel: GradeLevel = '3-5';
      const artStyle =
        imageGenerationService.getEnhancedArtStyleForGrade(gradeLevel);
      const generateStorySpecificPrompt = (imageGenerationService as any)
        .generateStorySpecificPrompt;
      const prompt = generateStorySpecificPrompt.call(
        imageGenerationService,
        storyContent,
        gradeLevel,
        artStyle,
      );

      expect(prompt).toMatch(/watercolor/i);
      expect(prompt).toMatch(/illustration/i);
      expect(prompt).toMatch(/vibrant|rich/i);
    });

    test('6-8: Mystery story maintains watercolor illustration style', () => {
      const storyContent =
        'Detective Rivera the methodical investigator analyzed the evidence meticulously in the modern crime lab, piecing together the complex web of clues to uncover the truth.';
      const gradeLevel: GradeLevel = '6-8';
      const artStyle =
        imageGenerationService.getEnhancedArtStyleForGrade(gradeLevel);
      const generateStorySpecificPrompt = (imageGenerationService as any)
        .generateStorySpecificPrompt;
      const prompt = generateStorySpecificPrompt.call(
        imageGenerationService,
        storyContent,
        gradeLevel,
        artStyle,
      );

      expect(prompt).toMatch(/watercolor/i);
      expect(prompt).toMatch(/illustration/i);
      expect(prompt).toMatch(/detail|complex/i);
    });

    test('9-12: Mystery story maintains sophisticated art style', () => {
      const storyContent =
        'Agent Thompson the analytical forensic expert investigated the sophisticated conspiracy in the high-tech facility, challenging everything the professional team thought they knew about the complex case.';
      const gradeLevel: GradeLevel = '9-12';
      const artStyle =
        imageGenerationService.getEnhancedArtStyleForGrade(gradeLevel);
      const generateStorySpecificPrompt = (imageGenerationService as any)
        .generateStorySpecificPrompt;
      const prompt = generateStorySpecificPrompt.call(
        imageGenerationService,
        storyContent,
        gradeLevel,
        artStyle,
      );

      expect(prompt).toMatch(/sophisticated/i);
      expect(prompt).toMatch(/professional/i);
      expect(prompt).toMatch(/mature/i);
    });
  });

  describe('Fallback Path Testing: generatePrompt', () => {
    test('generatePrompt fallback maintains K-2 watercolor style', () => {
      const storyContent = 'A happy puppy played in the park with a red ball.';
      const gradeLevel: GradeLevel = 'K-2';
      const generatePrompt = (imageGenerationService as any).generatePrompt;
      const prompt = generatePrompt.call(
        imageGenerationService,
        storyContent,
        gradeLevel,
      );

      expect(prompt).toMatch(/watercolor/i);
      expect(prompt).toMatch(/children's book/i);
    });

    test('generatePrompt fallback maintains 3-5 watercolor illustration style', () => {
      const storyContent =
        'The students built a robot for the science fair competition.';
      const gradeLevel: GradeLevel = '3-5';
      const generatePrompt = (imageGenerationService as any).generatePrompt;
      const prompt = generatePrompt.call(
        imageGenerationService,
        storyContent,
        gradeLevel,
      );

      expect(prompt).toMatch(/watercolor/i);
      expect(prompt).toMatch(/illustration/i);
    });

    test('generatePrompt fallback generates 6-8 watercolor style', () => {
      const storyContent =
        'The team developed an innovative solution to the environmental challenge.';
      const gradeLevel: GradeLevel = '6-8';
      const generatePrompt = (imageGenerationService as any).generatePrompt;
      const prompt = generatePrompt.call(
        imageGenerationService,
        storyContent,
        gradeLevel,
      );

      expect(prompt).toMatch(/watercolor/i);
      expect(prompt).toMatch(/illustration/i);
    });

    test('generatePrompt fallback maintains 9-12 sophisticated style', () => {
      const storyContent =
        'The researchers published their findings on advanced sustainable technologies.';
      const gradeLevel: GradeLevel = '9-12';
      const generatePrompt = (imageGenerationService as any).generatePrompt;
      const prompt = generatePrompt.call(
        imageGenerationService,
        storyContent,
        gradeLevel,
      );

      expect(prompt).toMatch(/sophisticated/i);
      expect(prompt).toMatch(/professional/i);
    });
  });

  describe('Cross-Grade Level Consistency', () => {
    test('all grade levels should generate non-empty prompts for valid content', () => {
      const storyContent =
        'A character explored a beautiful landscape with interesting features.';
      const gradeLevels: GradeLevel[] = ['K-2', '3-5', '6-8', '9-12'];

      gradeLevels.forEach(gradeLevel => {
        const artStyle =
          imageGenerationService.getEnhancedArtStyleForGrade(gradeLevel);
        const generateStorySpecificPrompt = (imageGenerationService as any)
          .generateStorySpecificPrompt;
        const prompt = generateStorySpecificPrompt.call(
          imageGenerationService,
          storyContent,
          gradeLevel,
          artStyle,
        );

        expect(prompt.length).toBeGreaterThan(0);
      });
    });

    test('all grade levels should include safety constraints', () => {
      const storyContent =
        'Buddy the friendly puppy went on a fun journey through the colorful meadow with his loyal companions.';
      const gradeLevels: GradeLevel[] = ['K-2', '3-5', '6-8', '9-12'];

      gradeLevels.forEach(gradeLevel => {
        const artStyle =
          imageGenerationService.getEnhancedArtStyleForGrade(gradeLevel);
        const generateStorySpecificPrompt = (imageGenerationService as any)
          .generateStorySpecificPrompt;
        const prompt = generateStorySpecificPrompt.call(
          imageGenerationService,
          storyContent,
          gradeLevel,
          artStyle,
        );

        expect(prompt).toMatch(/safe for children|G-rated/i);
      });
    });

    test('art complexity should increase with grade level', () => {
      const artK2 = imageGenerationService.getEnhancedArtStyleForGrade('K-2');
      const art35 = imageGenerationService.getEnhancedArtStyleForGrade('3-5');
      const art68 = imageGenerationService.getEnhancedArtStyleForGrade('6-8');
      const art912 = imageGenerationService.getEnhancedArtStyleForGrade('9-12');

      expect(artK2.visualComplexity).toMatch(/simple/i);
      expect(art35.visualComplexity).toMatch(/moderate/i);
      expect(art68.visualComplexity).toMatch(/high|complex/i);
      expect(art912.visualComplexity).toMatch(/complex|intricate/i);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle minimal story content gracefully', () => {
      const storyContent = 'A character.';
      const gradeLevels: GradeLevel[] = ['K-2', '3-5', '6-8', '9-12'];

      gradeLevels.forEach(gradeLevel => {
        const artStyle =
          imageGenerationService.getEnhancedArtStyleForGrade(gradeLevel);
        const generateStorySpecificPrompt = (imageGenerationService as any)
          .generateStorySpecificPrompt;

        expect(() => {
          generateStorySpecificPrompt.call(
            imageGenerationService,
            storyContent,
            gradeLevel,
            artStyle,
          );
        }).not.toThrow();
      });
    });

    test('should return empty string for content without visual elements', () => {
      const storyContent = 'And then it happened.';
      const gradeLevel: GradeLevel = 'K-2';
      const artStyle =
        imageGenerationService.getEnhancedArtStyleForGrade(gradeLevel);
      const generateStorySpecificPrompt = (imageGenerationService as any)
        .generateStorySpecificPrompt;
      const prompt = generateStorySpecificPrompt.call(
        imageGenerationService,
        storyContent,
        gradeLevel,
        artStyle,
      );

      expect(prompt).toBe('');
    });

    test('should handle null or undefined inputs gracefully', () => {
      const gradeLevel: GradeLevel = 'K-2';
      const artStyle =
        imageGenerationService.getEnhancedArtStyleForGrade(gradeLevel);
      const generateStorySpecificPrompt = (imageGenerationService as any)
        .generateStorySpecificPrompt;

      expect(() => {
        generateStorySpecificPrompt.call(
          imageGenerationService,
          null,
          gradeLevel,
          artStyle,
        );
      }).not.toThrow();

      const result = generateStorySpecificPrompt.call(
        imageGenerationService,
        null,
        gradeLevel,
        artStyle,
      );
      expect(result).toBe('');
    });
  });
});
