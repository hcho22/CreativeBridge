/**
 * Prompt Style Validation Tests
 * Unit tests for validatePromptStyleKeywords method
 * Tests validation logic for all grade levels and fallback behavior
 *
 * User Story: US-002 - Add Validation Layer for Generated Prompts
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

describe('Prompt Style Validation - Unit Tests', () => {
  // Test helper to access private method using reflection
  const validatePrompt = (prompt: string, gradeLevel: GradeLevel) => {
    return (imageGenerationService as any).validatePromptStyleKeywords.call(
      imageGenerationService,
      prompt,
      gradeLevel,
    );
  };

  describe('K-2 Grade Level Validation', () => {
    const gradeLevel: GradeLevel = 'K-2';

    test('should pass validation with all required art style keywords', () => {
      const validPrompt = `Create a watercolor children's book illustration showing Ben the little bear exploring underwater with colorful fish and coral, bright primary colors, soft pastels, warm and inviting tones, using watercolor painting style, soft brush strokes, gentle textures, magical and whimsical, centered composition, friendly cartoon animals, soft dreamy backgrounds`;

      const result = validatePrompt(validPrompt, gradeLevel);

      expect(result.isValid).toBe(true);
      expect(result.validationErrors).toHaveLength(0);
      expect(result.coveragePercentage).toBeGreaterThan(50);
    });

    test('should fail validation when baseStyle is missing', () => {
      const invalidPrompt = `Create a realistic digital painting showing a child with detailed shading and complex composition`;

      const result = validatePrompt(invalidPrompt, gradeLevel);

      expect(result.isValid).toBe(false);
      expect(result.validationErrors.length).toBeGreaterThan(0);
      expect(
        result.validationErrors.some(err => err.includes('baseStyle')),
      ).toBe(true);
    });

    test('should fail validation with insufficient art style properties', () => {
      const invalidPrompt = `Create a watercolor children's book illustration showing a simple scene`;

      const result = validatePrompt(invalidPrompt, gradeLevel);

      // Should have baseStyle but insufficient other properties
      expect(result.isValid).toBe(false);
      expect(
        result.validationErrors.some(err =>
          err.includes('Insufficient art style properties'),
        ),
      ).toBe(true);
    });

    test('should identify missing keywords correctly', () => {
      const partialPrompt = `Create a watercolor children's book illustration showing Ben the bear`;

      const result = validatePrompt(partialPrompt, gradeLevel);

      expect(result.missingKeywords.length).toBeGreaterThan(0);
      expect(result.matchedKeywords).toContain(
        "watercolor children's book illustration",
      );
    });
  });

  describe('3-5 Grade Level Validation', () => {
    const gradeLevel: GradeLevel = '3-5';

    test('should pass validation with all required art style keywords', () => {
      const validPrompt = `Create a watercolor children's book illustration showing characters on an adventure, vibrant colors, rich earth tones, watercolor painting style, textured brushstrokes, adventurous and exciting, dynamic composition, expressive watercolor characters, detailed environments`;

      const result = validatePrompt(validPrompt, gradeLevel);

      expect(result.isValid).toBe(true);
      expect(result.validationErrors).toHaveLength(0);
    });

    test('should fail validation with wrong base style for 3-5', () => {
      const wrongStylePrompt = `Create a realistic digital illustration with bright colors and detailed shading`;

      const result = validatePrompt(wrongStylePrompt, gradeLevel);

      expect(result.isValid).toBe(false);
      expect(
        result.validationErrors.some(err => err.includes('baseStyle')),
      ).toBe(true);
    });

    test('should validate coverage percentage calculation', () => {
      const partialPrompt = `Create a watercolor children's book illustration showing an adventure with vibrant colors`;

      const result = validatePrompt(partialPrompt, gradeLevel);

      expect(result.coveragePercentage).toBeGreaterThanOrEqual(0);
      expect(result.coveragePercentage).toBeLessThanOrEqual(100);
    });
  });

  describe('6-8 Grade Level Validation', () => {
    const gradeLevel: GradeLevel = '6-8';

    test('should pass validation with watercolor illustration style', () => {
      const validPrompt = `Create a watercolor illustration with sophisticated color schemes, dramatic lighting, high detail, complex compositions, watercolor painting style, rich wet-on-wet techniques, adventurous and heroic, dynamic action compositions, detailed watercolor characters, detailed watercolor environments`;

      const result = validatePrompt(validPrompt, gradeLevel);

      expect(result.isValid).toBe(true);
      expect(result.validationErrors).toHaveLength(0);
    });

    test('should fail validation with wrong base style for 6-8', () => {
      const wrongStylePrompt = `Create a sophisticated digital art with advanced lighting and professional rendering`;

      const result = validatePrompt(wrongStylePrompt, gradeLevel);

      expect(result.isValid).toBe(false);
    });
  });

  describe('9-12 Grade Level Validation', () => {
    const gradeLevel: GradeLevel = '9-12';

    test('should pass validation with sophisticated watercolor art style', () => {
      const validPrompt = `Create a sophisticated watercolor art with mature color palettes, subtle gradients, professional watercolor technique, advanced color layering, thoughtful and inspiring, artistic composition, detailed watercolor figures, richly detailed watercolor environments`;

      const result = validatePrompt(validPrompt, gradeLevel);

      expect(result.isValid).toBe(true);
      expect(result.validationErrors).toHaveLength(0);
    });

    test('should fail validation with lower grade level styles', () => {
      const wrongStylePrompt = `Create a realistic digital illustration with bright colors and friendly cartoon style`;

      const result = validatePrompt(wrongStylePrompt, gradeLevel);

      expect(result.isValid).toBe(false);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle empty prompt gracefully', () => {
      const emptyPrompt = '';
      const gradeLevel: GradeLevel = 'K-2';

      const result = validatePrompt(emptyPrompt, gradeLevel);

      expect(result.isValid).toBe(false);
      expect(result.validationErrors.length).toBeGreaterThan(0);
      expect(result.coveragePercentage).toBe(0);
    });

    test('should handle very short prompt', () => {
      const shortPrompt = 'Create an image';
      const gradeLevel: GradeLevel = '3-5';

      const result = validatePrompt(shortPrompt, gradeLevel);

      expect(result.isValid).toBe(false);
      expect(result.missingKeywords.length).toBeGreaterThan(0);
    });

    test('should be case-insensitive for keyword matching', () => {
      const mixedCasePrompt = `Create a WATERCOLOR CHILDREN'S BOOK ILLUSTRATION with BRIGHT PRIMARY COLORS and WATERCOLOR PAINTING STYLE`;
      const gradeLevel: GradeLevel = 'K-2';

      const result = validatePrompt(mixedCasePrompt, gradeLevel);

      // Should find matches despite case differences
      expect(result.matchedKeywords.length).toBeGreaterThan(0);
    });

    test('should validate all grade levels with consistent logic', () => {
      const gradeLevels: GradeLevel[] = ['K-2', '3-5', '6-8', '9-12'];

      gradeLevels.forEach(gradeLevel => {
        const emptyResult = validatePrompt('', gradeLevel);
        expect(emptyResult.isValid).toBe(false);
        expect(emptyResult.validationErrors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Validation Result Structure', () => {
    test('should return all expected properties in ValidationResult', () => {
      const prompt = `Create a watercolor children's book illustration`;
      const gradeLevel: GradeLevel = 'K-2';

      const result = validatePrompt(prompt, gradeLevel);

      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('missingKeywords');
      expect(result).toHaveProperty('matchedKeywords');
      expect(result).toHaveProperty('validationErrors');
      expect(result).toHaveProperty('coveragePercentage');

      expect(typeof result.isValid).toBe('boolean');
      expect(Array.isArray(result.missingKeywords)).toBe(true);
      expect(Array.isArray(result.matchedKeywords)).toBe(true);
      expect(Array.isArray(result.validationErrors)).toBe(true);
      expect(typeof result.coveragePercentage).toBe('number');
    });

    test('should calculate coverage percentage correctly', () => {
      const fullPrompt = `Create a watercolor children's book illustration showing a character in a magical setting, bright primary colors, soft pastels, warm and inviting tones, watercolor painting style, soft brush strokes, gentle textures, magical and whimsical, innocent and joyful, centered composition, friendly cartoon animals, simple shapes, soft dreamy backgrounds`;
      const gradeLevel: GradeLevel = 'K-2';

      const result = validatePrompt(fullPrompt, gradeLevel);

      // High coverage should result in high percentage
      expect(result.coveragePercentage).toBeGreaterThan(70);
    });
  });

  describe('Minimum Keyword Requirements', () => {
    test('should require baseStyle + at least 2 other properties for K-2', () => {
      const gradeLevel: GradeLevel = 'K-2';

      // Just baseStyle - should fail
      const onlyBaseStyle = `Create a watercolor children's book illustration`;
      let result = validatePrompt(onlyBaseStyle, gradeLevel);
      expect(result.isValid).toBe(false);

      // BaseStyle + 1 other property - should fail
      const baseStylePlusOne = `Create a watercolor children's book illustration with bright primary colors`;
      result = validatePrompt(baseStylePlusOne, gradeLevel);
      expect(result.isValid).toBe(false);

      // BaseStyle + 2 other properties - should pass
      const baseStylePlusTwo = `Create a watercolor children's book illustration with bright primary colors and watercolor painting style`;
      result = validatePrompt(baseStylePlusTwo, gradeLevel);
      expect(result.isValid).toBe(true);
    });

    test('should require baseStyle + at least 2 other properties for all grades', () => {
      const testCases: Array<{
        gradeLevel: GradeLevel;
        baseStyle: string;
        prop1: string;
        prop2: string;
      }> = [
        {
          gradeLevel: 'K-2',
          baseStyle: "watercolor children's book illustration",
          prop1: 'bright primary colors',
          prop2: 'watercolor painting style',
        },
        {
          gradeLevel: '3-5',
          baseStyle: "watercolor children's book illustration",
          prop1: 'vibrant colors',
          prop2: 'watercolor painting style',
        },
        {
          gradeLevel: '6-8',
          baseStyle: 'watercolor illustration',
          prop1: 'sophisticated color schemes',
          prop2: 'watercolor painting style',
        },
        {
          gradeLevel: '9-12',
          baseStyle: 'sophisticated watercolor art',
          prop1: 'mature color palettes',
          prop2: 'professional watercolor technique',
        },
      ];

      testCases.forEach(({ gradeLevel, baseStyle, prop1, prop2 }) => {
        const validPrompt = `Create a ${baseStyle} with ${prop1} and ${prop2}`;
        const result = validatePrompt(validPrompt, gradeLevel);
        expect(result.isValid).toBe(true);
      });
    });
  });
});
