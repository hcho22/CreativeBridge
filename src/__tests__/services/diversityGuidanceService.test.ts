/**
 * Tests for Diversity Guidance Generation Service
 *
 * Validates diversity guidance generation logic including:
 * - Element avoidance list creation
 * - Alternative suggestion generation
 * - Guidance text formatting
 * - Edge cases and empty inputs
 */

import { diversityGuidanceService } from '../../services/diversityGuidanceService';
import { RecentElements } from '../../services/recentElementsService';

describe('DiversityGuidanceService', () => {
  // Helper function to create test elements
  const createRecentElements = (
    overrides: Partial<RecentElements> = {},
  ): RecentElements => {
    return {
      characters: [],
      settings: [],
      objects: [],
      plot_patterns: [],
      ...overrides,
    };
  };

  describe('generateDiversityGuidance', () => {
    it('should return empty guidance when no recent elements', () => {
      const recentElements = createRecentElements();

      const guidance = diversityGuidanceService.generateDiversityGuidance({
        recentElements,
      });

      expect(guidance.hasGuidance).toBe(false);
      expect(guidance.guidanceText).toBe('');
      expect(guidance.avoidedElementsCount).toBe(0);
      expect(guidance.suggestedAlternativesCount).toBe(0);
    });

    it('should generate guidance for repeated characters', () => {
      const recentElements = createRecentElements({
        characters: [
          {
            elementText: 'dragon',
            embeddingVector: null,
            frequency: 3,
            lastUsed: new Date(),
          },
          {
            elementText: 'wizard',
            embeddingVector: null,
            frequency: 2,
            lastUsed: new Date(),
          },
        ],
      });

      const guidance = diversityGuidanceService.generateDiversityGuidance({
        recentElements,
      });

      expect(guidance.hasGuidance).toBe(true);
      expect(guidance.avoidedElementsCount).toBe(2);
      expect(guidance.guidanceText).toContain('dragon');
      expect(guidance.guidanceText).toContain('wizard');
      expect(guidance.guidanceText).toContain('3 times');
      expect(guidance.guidanceText).toContain('2 times');
    });

    it('should generate guidance for repeated settings', () => {
      const recentElements = createRecentElements({
        settings: [
          {
            elementText: 'enchanted forest',
            embeddingVector: null,
            frequency: 4,
            lastUsed: new Date(),
          },
          {
            elementText: 'castle',
            embeddingVector: null,
            frequency: 2,
            lastUsed: new Date(),
          },
        ],
      });

      const guidance = diversityGuidanceService.generateDiversityGuidance({
        recentElements,
      });

      expect(guidance.hasGuidance).toBe(true);
      expect(guidance.avoidedElementsCount).toBe(2);
      expect(guidance.guidanceText).toContain('enchanted forest');
      expect(guidance.guidanceText).toContain('castle');
      expect(guidance.guidanceText).toContain('4 times');
    });

    it('should generate guidance for repeated objects', () => {
      const recentElements = createRecentElements({
        objects: [
          {
            elementText: 'magic key',
            embeddingVector: null,
            frequency: 3,
            lastUsed: new Date(),
          },
        ],
      });

      const guidance = diversityGuidanceService.generateDiversityGuidance({
        recentElements,
      });

      expect(guidance.hasGuidance).toBe(true);
      expect(guidance.avoidedElementsCount).toBe(1);
      expect(guidance.guidanceText).toContain('magic key');
      expect(guidance.guidanceText).toContain('3 times');
    });

    it('should generate guidance for repeated plot patterns', () => {
      const recentElements = createRecentElements({
        plot_patterns: [
          {
            elementText: 'found a mysterious object',
            embeddingVector: null,
            frequency: 5,
            lastUsed: new Date(),
          },
        ],
      });

      const guidance = diversityGuidanceService.generateDiversityGuidance({
        recentElements,
      });

      expect(guidance.hasGuidance).toBe(true);
      expect(guidance.avoidedElementsCount).toBe(1);
      expect(guidance.guidanceText).toContain('found a mysterious object');
      expect(guidance.guidanceText).toContain('5 times');
    });

    it('should combine elements from multiple categories', () => {
      const recentElements = createRecentElements({
        characters: [
          {
            elementText: 'dragon',
            embeddingVector: null,
            frequency: 3,
            lastUsed: new Date(),
          },
        ],
        settings: [
          {
            elementText: 'forest',
            embeddingVector: null,
            frequency: 2,
            lastUsed: new Date(),
          },
        ],
        objects: [
          {
            elementText: 'magic wand',
            embeddingVector: null,
            frequency: 2,
            lastUsed: new Date(),
          },
        ],
      });

      const guidance = diversityGuidanceService.generateDiversityGuidance({
        recentElements,
      });

      expect(guidance.hasGuidance).toBe(true);
      expect(guidance.avoidedElementsCount).toBe(3);
      expect(guidance.guidanceText).toContain('dragon');
      expect(guidance.guidanceText).toContain('forest');
      expect(guidance.guidanceText).toContain('magic wand');
    });

    it('should sort elements by frequency (descending)', () => {
      const recentElements = createRecentElements({
        characters: [
          {
            elementText: 'wizard',
            embeddingVector: null,
            frequency: 2,
            lastUsed: new Date(),
          },
          {
            elementText: 'dragon',
            embeddingVector: null,
            frequency: 5,
            lastUsed: new Date(),
          },
          {
            elementText: 'fairy',
            embeddingVector: null,
            frequency: 3,
            lastUsed: new Date(),
          },
        ],
      });

      const guidance = diversityGuidanceService.generateDiversityGuidance({
        recentElements,
      });

      // Dragon (5) should come before fairy (3) which should come before wizard (2)
      const dragonIndex = guidance.guidanceText.indexOf('dragon');
      const fairyIndex = guidance.guidanceText.indexOf('fairy');
      const wizardIndex = guidance.guidanceText.indexOf('wizard');

      expect(dragonIndex).toBeLessThan(fairyIndex);
      expect(fairyIndex).toBeLessThan(wizardIndex);
    });

    it('should respect maxElementsToList parameter', () => {
      const recentElements = createRecentElements({
        characters: [
          {
            elementText: 'dragon',
            embeddingVector: null,
            frequency: 5,
            lastUsed: new Date(),
          },
          {
            elementText: 'wizard',
            embeddingVector: null,
            frequency: 4,
            lastUsed: new Date(),
          },
          {
            elementText: 'fairy',
            embeddingVector: null,
            frequency: 3,
            lastUsed: new Date(),
          },
          {
            elementText: 'elf',
            embeddingVector: null,
            frequency: 2,
            lastUsed: new Date(),
          },
        ],
      });

      const guidance = diversityGuidanceService.generateDiversityGuidance({
        recentElements,
        maxElementsToList: 2,
      });

      expect(guidance.avoidedElementsCount).toBe(2);
      expect(guidance.guidanceText).toContain('dragon');
      expect(guidance.guidanceText).toContain('wizard');
      expect(guidance.guidanceText).not.toContain('fairy');
      expect(guidance.guidanceText).not.toContain('elf');
    });

    it('should only include elements with frequency >= 2', () => {
      const recentElements = createRecentElements({
        characters: [
          {
            elementText: 'dragon',
            embeddingVector: null,
            frequency: 3,
            lastUsed: new Date(),
          },
          {
            elementText: 'wizard',
            embeddingVector: null,
            frequency: 1, // Should be excluded
            lastUsed: new Date(),
          },
        ],
      });

      const guidance = diversityGuidanceService.generateDiversityGuidance({
        recentElements,
      });

      expect(guidance.avoidedElementsCount).toBe(1);
      expect(guidance.guidanceText).toContain('dragon');
      expect(guidance.guidanceText).not.toContain('wizard');
    });

    it('should include suggested alternatives when includeAlternatives is true', () => {
      const recentElements = createRecentElements({
        characters: [
          {
            elementText: 'dragon',
            embeddingVector: null,
            frequency: 3,
            lastUsed: new Date(),
          },
        ],
        settings: [
          {
            elementText: 'forest',
            embeddingVector: null,
            frequency: 2,
            lastUsed: new Date(),
          },
        ],
      });

      const guidance = diversityGuidanceService.generateDiversityGuidance({
        recentElements,
        includeAlternatives: true,
      });

      expect(guidance.guidanceText).toContain('Suggested alternatives:');
      expect(guidance.suggestedAlternativesCount).toBeGreaterThan(0);
    });

    it('should not include alternatives when includeAlternatives is false', () => {
      const recentElements = createRecentElements({
        characters: [
          {
            elementText: 'dragon',
            embeddingVector: null,
            frequency: 3,
            lastUsed: new Date(),
          },
        ],
      });

      const guidance = diversityGuidanceService.generateDiversityGuidance({
        recentElements,
        includeAlternatives: false,
      });

      expect(guidance.guidanceText).not.toContain('Suggested alternatives:');
      expect(guidance.suggestedAlternativesCount).toBe(0);
    });

    it('should suggest character alternatives for overused animals', () => {
      const recentElements = createRecentElements({
        characters: [
          {
            elementText: 'dragon',
            embeddingVector: null,
            frequency: 3,
            lastUsed: new Date(),
          },
          {
            elementText: 'wolf',
            embeddingVector: null,
            frequency: 2,
            lastUsed: new Date(),
          },
        ],
      });

      const guidance = diversityGuidanceService.generateDiversityGuidance({
        recentElements,
        includeAlternatives: true,
      });

      expect(guidance.guidanceText).toContain('Suggested alternatives:');
      expect(guidance.guidanceText.toLowerCase()).toMatch(
        /human|robot|mythical/,
      );
    });

    it('should suggest setting alternatives for overused forests', () => {
      const recentElements = createRecentElements({
        settings: [
          {
            elementText: 'enchanted forest',
            embeddingVector: null,
            frequency: 4,
            lastUsed: new Date(),
          },
          {
            elementText: 'dark woods',
            embeddingVector: null,
            frequency: 2,
            lastUsed: new Date(),
          },
        ],
      });

      const guidance = diversityGuidanceService.generateDiversityGuidance({
        recentElements,
        includeAlternatives: true,
      });

      expect(guidance.guidanceText).toContain('Suggested alternatives:');
      expect(guidance.guidanceText.toLowerCase()).toMatch(/urban|desert|ocean/);
    });

    it('should suggest object alternatives for overused magic items', () => {
      const recentElements = createRecentElements({
        objects: [
          {
            elementText: 'magic wand',
            embeddingVector: null,
            frequency: 3,
            lastUsed: new Date(),
          },
          {
            elementText: 'enchanted potion',
            embeddingVector: null,
            frequency: 2,
            lastUsed: new Date(),
          },
        ],
      });

      const guidance = diversityGuidanceService.generateDiversityGuidance({
        recentElements,
        includeAlternatives: true,
      });

      expect(guidance.guidanceText).toContain('Suggested alternatives:');
      expect(guidance.guidanceText.toLowerCase()).toMatch(
        /everyday|technological|natural/,
      );
    });

    it('should suggest plot pattern alternatives for overused discovery', () => {
      const recentElements = createRecentElements({
        plot_patterns: [
          {
            elementText: 'discovered a secret',
            embeddingVector: null,
            frequency: 4,
            lastUsed: new Date(),
          },
          {
            elementText: 'found a hidden treasure',
            embeddingVector: null,
            frequency: 2,
            lastUsed: new Date(),
          },
        ],
      });

      const guidance = diversityGuidanceService.generateDiversityGuidance({
        recentElements,
        includeAlternatives: true,
      });

      expect(guidance.guidanceText).toContain('Suggested alternatives:');
      expect(guidance.guidanceText.toLowerCase()).toMatch(
        /seeking|planning|creating|building/,
      );
    });

    it('should use subtle emphasis level correctly', () => {
      const recentElements = createRecentElements({
        characters: [
          {
            elementText: 'dragon',
            embeddingVector: null,
            frequency: 3,
            lastUsed: new Date(),
          },
        ],
      });

      const guidance = diversityGuidanceService.generateDiversityGuidance({
        recentElements,
        emphasisLevel: 'subtle',
      });

      expect(guidance.guidanceText).toContain('Consider avoiding');
      expect(guidance.guidanceText).toContain('Try to create something fresh');
    });

    it('should use moderate emphasis level correctly', () => {
      const recentElements = createRecentElements({
        characters: [
          {
            elementText: 'dragon',
            embeddingVector: null,
            frequency: 3,
            lastUsed: new Date(),
          },
        ],
      });

      const guidance = diversityGuidanceService.generateDiversityGuidance({
        recentElements,
        emphasisLevel: 'moderate',
      });

      expect(guidance.guidanceText).toContain(
        'Recently used elements to avoid',
      );
      expect(guidance.guidanceText).toContain(
        'Goal: Create a story with fresh, unexpected elements',
      );
    });

    it('should use strong emphasis level correctly', () => {
      const recentElements = createRecentElements({
        characters: [
          {
            elementText: 'dragon',
            embeddingVector: null,
            frequency: 3,
            lastUsed: new Date(),
          },
        ],
      });

      const guidance = diversityGuidanceService.generateDiversityGuidance({
        recentElements,
        emphasisLevel: 'strong',
      });

      expect(guidance.guidanceText).toContain('⚠️ IMPORTANT');
      expect(guidance.guidanceText).toContain('🎯 PRIMARY GOAL');
      expect(guidance.guidanceText).toContain('highly diverse');
    });

    it('should include goal statement at the end', () => {
      const recentElements = createRecentElements({
        characters: [
          {
            elementText: 'dragon',
            embeddingVector: null,
            frequency: 3,
            lastUsed: new Date(),
          },
        ],
      });

      const guidance = diversityGuidanceService.generateDiversityGuidance({
        recentElements,
      });

      expect(guidance.guidanceText).toContain('Goal:');
      expect(guidance.guidanceText).toContain('fresh');
      expect(guidance.guidanceText).toContain('unexpected');
    });

    it('should format guidance with proper structure', () => {
      const recentElements = createRecentElements({
        characters: [
          {
            elementText: 'dragon',
            embeddingVector: null,
            frequency: 3,
            lastUsed: new Date(),
          },
        ],
        settings: [
          {
            elementText: 'forest',
            embeddingVector: null,
            frequency: 2,
            lastUsed: new Date(),
          },
        ],
      });

      const guidance = diversityGuidanceService.generateDiversityGuidance({
        recentElements,
        includeAlternatives: true,
      });

      // Should have three parts separated by newlines
      const lines = guidance.guidanceText.split('\n');
      expect(lines.length).toBe(3);

      // Part 1: Recently used elements
      expect(lines[0]).toContain('Recently used elements to avoid');

      // Part 2: Suggested alternatives
      expect(lines[1]).toContain('Suggested alternatives:');

      // Part 3: Goal
      expect(lines[2]).toContain('Goal:');
    });
  });

  describe('generateCompactGuidance', () => {
    it('should generate compact guidance with limited elements', () => {
      const recentElements = createRecentElements({
        characters: [
          {
            elementText: 'dragon',
            embeddingVector: null,
            frequency: 5,
            lastUsed: new Date(),
          },
          {
            elementText: 'wizard',
            embeddingVector: null,
            frequency: 4,
            lastUsed: new Date(),
          },
          {
            elementText: 'fairy',
            embeddingVector: null,
            frequency: 3,
            lastUsed: new Date(),
          },
          {
            elementText: 'elf',
            embeddingVector: null,
            frequency: 2,
            lastUsed: new Date(),
          },
        ],
      });

      const guidance = diversityGuidanceService.generateCompactGuidance({
        recentElements,
      });

      // Should limit to 3 elements
      expect(guidance.avoidedElementsCount).toBe(3);

      // Should not include alternatives
      expect(guidance.guidanceText).not.toContain('Suggested alternatives');
      expect(guidance.suggestedAlternativesCount).toBe(0);

      // Should use subtle emphasis
      expect(guidance.guidanceText).toContain('Consider avoiding');
    });

    it('should return empty compact guidance for no recent elements', () => {
      const recentElements = createRecentElements();

      const guidance = diversityGuidanceService.generateCompactGuidance({
        recentElements,
      });

      expect(guidance.hasGuidance).toBe(false);
      expect(guidance.guidanceText).toBe('');
    });
  });

  describe('Edge Cases', () => {
    it('should handle elements with frequency of exactly 2', () => {
      const recentElements = createRecentElements({
        characters: [
          {
            elementText: 'dragon',
            embeddingVector: null,
            frequency: 2, // Exactly at threshold
            lastUsed: new Date(),
          },
        ],
      });

      const guidance = diversityGuidanceService.generateDiversityGuidance({
        recentElements,
      });

      expect(guidance.avoidedElementsCount).toBe(1);
      expect(guidance.guidanceText).toContain('dragon');
    });

    it('should handle very long element text', () => {
      const recentElements = createRecentElements({
        plot_patterns: [
          {
            elementText:
              'discovered a mysterious ancient artifact hidden deep beneath the enchanted forest that holds the key to saving the kingdom',
            embeddingVector: null,
            frequency: 3,
            lastUsed: new Date(),
          },
        ],
      });

      const guidance = diversityGuidanceService.generateDiversityGuidance({
        recentElements,
      });

      expect(guidance.hasGuidance).toBe(true);
      expect(guidance.guidanceText).toContain(
        'discovered a mysterious ancient',
      );
    });

    it('should handle special characters in element text', () => {
      const recentElements = createRecentElements({
        objects: [
          {
            elementText: "wizard's wand (magical)",
            embeddingVector: null,
            frequency: 2,
            lastUsed: new Date(),
          },
        ],
      });

      const guidance = diversityGuidanceService.generateDiversityGuidance({
        recentElements,
      });

      expect(guidance.hasGuidance).toBe(true);
      expect(guidance.guidanceText).toContain("wizard's wand (magical)");
    });

    it('should handle mix of high and low frequency elements', () => {
      const recentElements = createRecentElements({
        characters: [
          {
            elementText: 'dragon',
            embeddingVector: null,
            frequency: 10,
            lastUsed: new Date(),
          },
          {
            elementText: 'wizard',
            embeddingVector: null,
            frequency: 1, // Low frequency, should be excluded
            lastUsed: new Date(),
          },
          {
            elementText: 'fairy',
            embeddingVector: null,
            frequency: 2,
            lastUsed: new Date(),
          },
        ],
      });

      const guidance = diversityGuidanceService.generateDiversityGuidance({
        recentElements,
      });

      expect(guidance.avoidedElementsCount).toBe(2);
      expect(guidance.guidanceText).toContain('dragon');
      expect(guidance.guidanceText).toContain('fairy');
      expect(guidance.guidanceText).not.toContain('wizard');
    });
  });
});
