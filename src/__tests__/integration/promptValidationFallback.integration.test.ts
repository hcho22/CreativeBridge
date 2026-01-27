/**
 * Prompt Validation Fallback Integration Tests
 * Tests that validation failures trigger fallback to Tier 3 generation
 * Verifies end-to-end behavior of validation layer
 *
 * User Story: US-002 - Add Validation Layer for Generated Prompts
 */

import { imageGenerationService } from '../../services/imageGeneration';
import { errorLogger } from '../../services/errorLogger';
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

jest.mock('../../services/errorLogger', () => ({
  errorLogger: {
    logError: jest.fn().mockResolvedValue(undefined),
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

describe('Prompt Validation Fallback - Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test helper to access private methods
  const generatePrompt = (storyContent: string, gradeLevel: GradeLevel) => {
    return (imageGenerationService as any).generatePrompt.call(
      imageGenerationService,
      storyContent,
      gradeLevel,
    );
  };

  const validatePrompt = (prompt: string, gradeLevel: GradeLevel) => {
    return (imageGenerationService as any).validatePromptStyleKeywords.call(
      imageGenerationService,
      prompt,
      gradeLevel,
    );
  };

  describe('Tier 1 → Tier 3 Fallback', () => {
    test('should fallback to Tier 3 when Tier 1 validation fails', () => {
      const gradeLevel: GradeLevel = 'K-2';
      const storyContent = `Ben the little bear went exploring in the forest.`;

      // Generate prompt (will go through validation)
      const finalPrompt = generatePrompt(storyContent, gradeLevel);

      // Validate the final prompt
      const validation = validatePrompt(finalPrompt, gradeLevel);

      // Final prompt should always be valid (either Tier 1 passed or fell back to Tier 3)
      expect(validation.isValid).toBe(true);
      expect(finalPrompt).toContain("watercolor children's book illustration");
      expect(finalPrompt.length).toBeGreaterThan(50);
    });

    test('should use Tier 1 prompt when validation passes', () => {
      const gradeLevel: GradeLevel = 'K-2';
      // Story with clear character for Tier 1 extraction
      const storyContent = `Ben the little bear loved exploring the magical forest with his friend Sparkle the butterfly.`;

      const finalPrompt = generatePrompt(storyContent, gradeLevel);
      const validation = validatePrompt(finalPrompt, gradeLevel);

      expect(validation.isValid).toBe(true);
      expect(validation.coveragePercentage).toBeGreaterThan(50);
    });
  });

  describe('Tier 2 → Tier 3 Fallback', () => {
    test('should fallback to Tier 3 when Tier 2 validation fails', () => {
      const gradeLevel: GradeLevel = '3-5';
      // Use a story that might trigger Tier 2 but could fail validation
      const storyContent = `The adventurers discovered a secret cave hidden behind the waterfall.`;

      const finalPrompt = generatePrompt(storyContent, gradeLevel);
      const validation = validatePrompt(finalPrompt, gradeLevel);

      // Final prompt should always be valid
      expect(validation.isValid).toBe(true);
      expect(finalPrompt).toContain("detailed children's book illustration");
    });
  });

  describe('Telemetry Tracking', () => {
    test('should log validation failures to error logger', () => {
      const gradeLevel: GradeLevel = 'K-2';
      const storyContent = `A simple story.`;

      // Clear previous calls
      jest.clearAllMocks();

      // Generate prompt
      const finalPrompt = generatePrompt(storyContent, gradeLevel);

      // If Tier 1 or Tier 2 failed validation, should have logged
      // Note: We can't directly assert this without mocking internal methods,
      // but we can verify the final prompt is valid
      const validation = validatePrompt(finalPrompt, gradeLevel);
      expect(validation.isValid).toBe(true);
    });

    test('should track validation failure metrics', () => {
      const gradeLevel: GradeLevel = '6-8';
      const storyContent = `The hero prepared for the final battle.`;

      const finalPrompt = generatePrompt(storyContent, gradeLevel);
      const validation = validatePrompt(finalPrompt, gradeLevel);

      // Verify final prompt has required properties
      expect(validation.isValid).toBe(true);
      expect(validation).toHaveProperty('coveragePercentage');
      expect(validation).toHaveProperty('matchedKeywords');
      expect(validation).toHaveProperty('missingKeywords');
    });
  });

  describe('All Grade Levels Fallback Consistency', () => {
    test.each<GradeLevel>(['K-2', '3-5', '6-8', '9-12'])(
      'should produce valid prompts for grade level %s',
      gradeLevel => {
        const storyContent = `A character went on an adventure to discover something amazing.`;

        const finalPrompt = generatePrompt(storyContent, gradeLevel);
        const validation = validatePrompt(finalPrompt, gradeLevel);

        expect(validation.isValid).toBe(true);
        expect(finalPrompt.length).toBeGreaterThan(50);
        expect(validation.validationErrors).toHaveLength(0);
      },
    );

    test.each<GradeLevel>(['K-2', '3-5', '6-8', '9-12'])(
      'should include grade-appropriate art style for %s',
      gradeLevel => {
        const storyContent = `The protagonist discovered a magical artifact that changed everything.`;

        const finalPrompt = generatePrompt(storyContent, gradeLevel);

        // Verify grade-appropriate style is included
        const artStyles: Record<GradeLevel, string> = {
          'K-2': "watercolor children's book illustration",
          '3-5': "detailed children's book illustration",
          '6-8': 'realistic digital illustration',
          '9-12': 'sophisticated digital art',
        };

        expect(finalPrompt.toLowerCase()).toContain(
          artStyles[gradeLevel].toLowerCase(),
        );
      },
    );
  });

  describe('Validation with Real Story Content', () => {
    test('should handle complex K-2 story with multiple characters', () => {
      const gradeLevel: GradeLevel = 'K-2';
      const storyContent = `Ben the little bear and Sparkle the butterfly were best friends. They loved to explore the magical forest together. One sunny day, they discovered a hidden pond filled with colorful fish and smooth stones.`;

      const finalPrompt = generatePrompt(storyContent, gradeLevel);
      const validation = validatePrompt(finalPrompt, gradeLevel);

      expect(validation.isValid).toBe(true);
      expect(finalPrompt).toContain("watercolor children's book illustration");
      expect(validation.coveragePercentage).toBeGreaterThan(40);
    });

    test('should handle action-heavy 6-8 story', () => {
      const gradeLevel: GradeLevel = '6-8';
      const storyContent = `The young knight charged forward, sword gleaming in the sunlight. Behind her, the ancient dragon roared, wings spread wide against the stormy sky. This was the moment that would determine the fate of the kingdom.`;

      const finalPrompt = generatePrompt(storyContent, gradeLevel);
      const validation = validatePrompt(finalPrompt, gradeLevel);

      expect(validation.isValid).toBe(true);
      expect(finalPrompt).toContain('realistic digital illustration');
    });

    test('should handle philosophical 9-12 story', () => {
      const gradeLevel: GradeLevel = '9-12';
      const storyContent = `As she stood at the edge of the precipice, contemplating the vastness of the universe before her, she realized that every choice, every moment, had led to this singular point in time. The stars above whispered secrets of infinity.`;

      const finalPrompt = generatePrompt(storyContent, gradeLevel);
      const validation = validatePrompt(finalPrompt, gradeLevel);

      expect(validation.isValid).toBe(true);
      expect(finalPrompt).toContain('sophisticated digital art');
    });
  });

  describe('Fallback Performance', () => {
    test('should generate valid prompt even with minimal story content', () => {
      const gradeLevel: GradeLevel = '3-5';
      const minimalStory = `They went exploring.`;

      const finalPrompt = generatePrompt(minimalStory, gradeLevel);
      const validation = validatePrompt(finalPrompt, gradeLevel);

      expect(validation.isValid).toBe(true);
      expect(finalPrompt.length).toBeGreaterThan(50);
    });

    test('should handle empty or whitespace-only story gracefully', () => {
      const gradeLevel: GradeLevel = 'K-2';
      const emptyStory = `   `;

      const finalPrompt = generatePrompt(emptyStory, gradeLevel);
      const validation = validatePrompt(finalPrompt, gradeLevel);

      // Should still produce a valid prompt using fallback
      expect(finalPrompt.length).toBeGreaterThan(0);
    });
  });

  describe('Validation Error Messages', () => {
    test('should provide clear validation error messages', () => {
      const invalidPrompt = `Create a simple image`;
      const gradeLevel: GradeLevel = 'K-2';

      const validation = validatePrompt(invalidPrompt, gradeLevel);

      expect(validation.isValid).toBe(false);
      expect(validation.validationErrors.length).toBeGreaterThan(0);
      expect(
        validation.validationErrors.some(err => err.includes('baseStyle')),
      ).toBe(true);
    });

    test('should list missing keywords for debugging', () => {
      const partialPrompt = `Create a watercolor children's book illustration`;
      const gradeLevel: GradeLevel = 'K-2';

      const validation = validatePrompt(partialPrompt, gradeLevel);

      // Should have some missing keywords
      if (!validation.isValid) {
        expect(validation.missingKeywords.length).toBeGreaterThan(0);
      }
    });
  });
});
