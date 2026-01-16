/**
 * Diversity Guidance Generation Service
 *
 * Generates natural language guidance to inject into story generation prompts
 * to help the LLM avoid repetitive elements and create fresh, diverse stories.
 *
 * Part of the Story Diversity Tracking System (US-008)
 */

import { RecentElements, ElementWithFrequency } from './recentElementsService';

/**
 * Options for generating diversity guidance
 */
export interface DiversityGuidanceOptions {
  recentElements: RecentElements;
  maxElementsToList?: number; // Max number of elements to list per category (default: 5)
  includeAlternatives?: boolean; // Whether to suggest alternatives (default: true)
  emphasisLevel?: 'subtle' | 'moderate' | 'strong'; // How strongly to emphasize diversity (default: 'moderate')
}

/**
 * Generated diversity guidance with metadata
 */
export interface DiversityGuidance {
  guidanceText: string;
  avoidedElementsCount: number;
  suggestedAlternativesCount: number;
  hasGuidance: boolean; // False if no recent elements to avoid
}

/**
 * Alternative suggestions for each element category
 */
interface AlternativesByCategory {
  characters: string[];
  settings: string[];
  objects: string[];
  plot_patterns: string[];
}

/**
 * Diversity Guidance Generation Service
 *
 * Analyzes recent story elements and generates guidance text that can be
 * injected into story generation prompts to encourage creative diversity.
 */
class DiversityGuidanceService {
  private static readonly DEFAULT_MAX_ELEMENTS = 5;
  private static readonly FREQUENCY_THRESHOLD_HIGH = 3; // Elements used 3+ times are "overused"
  private static readonly FREQUENCY_THRESHOLD_MEDIUM = 2; // Elements used 2+ times are "common"

  /**
   * Generate diversity guidance from recent elements
   *
   * Analyzes the frequency of recent story elements and generates guidance
   * text that lists elements to avoid and suggests fresh alternatives.
   *
   * @param options - Recent elements and generation options
   * @returns DiversityGuidance - Guidance text with metadata
   *
   * @example
   * const guidance = generateDiversityGuidance({
   *   recentElements: await getRecentElements({ sessionId }),
   *   maxElementsToList: 5,
   *   includeAlternatives: true,
   *   emphasisLevel: 'moderate'
   * });
   * console.log(guidance.guidanceText);
   * // Output:
   * // Recently used elements to avoid: dragon (3 times), forest (2 times), magic key (2 times)
   * // Suggested alternatives: Try urban settings, ocean environments, desert landscapes...
   * // Goal: Create a story with fresh, unexpected elements
   */
  generateDiversityGuidance(
    options: DiversityGuidanceOptions,
  ): DiversityGuidance {
    const {
      recentElements,
      maxElementsToList = DiversityGuidanceService.DEFAULT_MAX_ELEMENTS,
      includeAlternatives = true,
      emphasisLevel = 'moderate',
    } = options;

    // Check if we have any recent elements
    const hasElements = this.hasRecentElements(recentElements);
    if (!hasElements) {
      return {
        guidanceText: '',
        avoidedElementsCount: 0,
        suggestedAlternativesCount: 0,
        hasGuidance: false,
      };
    }

    // Collect elements to avoid (sorted by frequency, descending)
    const avoidList = this.buildAvoidList(recentElements, maxElementsToList);

    // Generate alternative suggestions based on what's overused
    const alternatives = includeAlternatives
      ? this.generateAlternatives(recentElements)
      : null;

    // Build the final guidance text
    const guidanceText = this.buildGuidanceText(
      avoidList,
      alternatives,
      emphasisLevel,
    );

    return {
      guidanceText,
      avoidedElementsCount: avoidList.length,
      suggestedAlternativesCount: alternatives
        ? this.countAlternatives(alternatives)
        : 0,
      hasGuidance: true,
    };
  }

  /**
   * Check if there are any recent elements
   */
  private hasRecentElements(recentElements: RecentElements): boolean {
    return (
      recentElements.characters.length > 0 ||
      recentElements.settings.length > 0 ||
      recentElements.objects.length > 0 ||
      recentElements.plot_patterns.length > 0
    );
  }

  /**
   * Build list of elements to avoid with their frequencies
   */
  private buildAvoidList(
    recentElements: RecentElements,
    maxElements: number,
  ): Array<{ text: string; frequency: number; type: string }> {
    const avoidList: Array<{ text: string; frequency: number; type: string }> =
      [];

    // Collect all elements across categories with frequency >= 2 (repeated at least once)
    const collectElements = (
      elements: ElementWithFrequency[],
      type: string,
    ) => {
      elements
        .filter(
          el =>
            el.frequency >= DiversityGuidanceService.FREQUENCY_THRESHOLD_MEDIUM,
        )
        .forEach(el => {
          avoidList.push({
            text: el.elementText,
            frequency: el.frequency,
            type,
          });
        });
    };

    collectElements(recentElements.characters, 'character');
    collectElements(recentElements.settings, 'setting');
    collectElements(recentElements.objects, 'object');
    collectElements(recentElements.plot_patterns, 'plot_pattern');

    // Sort by frequency (descending), then by type for consistency
    avoidList.sort((a, b) => {
      if (b.frequency !== a.frequency) {
        return b.frequency - a.frequency;
      }
      return a.type.localeCompare(b.type);
    });

    // Limit to maxElements
    return avoidList.slice(0, maxElements);
  }

  /**
   * Generate alternative suggestions based on overused categories
   */
  private generateAlternatives(
    recentElements: RecentElements,
  ): AlternativesByCategory | null {
    const alternatives: AlternativesByCategory = {
      characters: [],
      settings: [],
      objects: [],
      plot_patterns: [],
    };

    // Analyze characters and suggest alternatives
    alternatives.characters = this.suggestCharacterAlternatives(
      recentElements.characters,
    );

    // Analyze settings and suggest alternatives
    alternatives.settings = this.suggestSettingAlternatives(
      recentElements.settings,
    );

    // Analyze objects and suggest alternatives
    alternatives.objects = this.suggestObjectAlternatives(
      recentElements.objects,
    );

    // Analyze plot patterns and suggest alternatives
    alternatives.plot_patterns = this.suggestPlotPatternAlternatives(
      recentElements.plot_patterns,
    );

    return alternatives;
  }

  /**
   * Suggest character alternatives based on what's overused
   */
  private suggestCharacterAlternatives(
    characters: ElementWithFrequency[],
  ): string[] {
    const suggestions: string[] = [];
    const overused = this.getOverusedElements(characters);

    // Analyze common patterns in overused characters
    const hasAnimals = overused.some(c =>
      /dragon|cat|dog|wolf|fox|bird|rabbit|bear/i.test(c),
    );
    const hasHumans = overused.some(c =>
      /boy|girl|child|kid|prince|princess|wizard/i.test(c),
    );
    const hasMagical = overused.some(c =>
      /dragon|wizard|fairy|witch|elf|unicorn/i.test(c),
    );

    if (hasAnimals) {
      suggestions.push(
        'human protagonists',
        'robots or AI characters',
        'mythical creatures (not dragons)',
      );
    }
    if (hasHumans) {
      suggestions.push(
        'animal protagonists',
        'alien characters',
        'sentient objects',
      );
    }
    if (hasMagical) {
      suggestions.push(
        'ordinary characters with extraordinary circumstances',
        'scientists or inventors',
        'historical figures',
      );
    }

    // Default suggestions if none of the above match
    if (suggestions.length === 0) {
      suggestions.push(
        'diverse character types',
        'unexpected protagonists',
        'characters with unique abilities or backgrounds',
      );
    }

    return suggestions.slice(0, 3); // Limit to 3 suggestions
  }

  /**
   * Suggest setting alternatives based on what's overused
   */
  private suggestSettingAlternatives(
    settings: ElementWithFrequency[],
  ): string[] {
    const suggestions: string[] = [];
    const overused = this.getOverusedElements(settings);

    // Analyze common patterns in overused settings
    const hasForest = overused.some(s => /forest|woods|jungle|tree/i.test(s));
    const hasCastle = overused.some(s => /castle|palace|kingdom/i.test(s));
    const hasSchool = overused.some(s => /school|classroom|library/i.test(s));
    const hasOcean = overused.some(s => /ocean|sea|beach|underwater/i.test(s));
    const hasUrban = overused.some(s => /city|town|street|building/i.test(s));

    if (hasForest) {
      suggestions.push(
        'urban environments',
        'desert landscapes',
        'ocean or underwater settings',
      );
    }
    if (hasCastle) {
      suggestions.push(
        'modern settings',
        'futuristic locations',
        'natural environments',
      );
    }
    if (hasSchool) {
      suggestions.push('outdoor adventures', 'home settings', 'fantasy realms');
    }
    if (hasOcean) {
      suggestions.push(
        'mountain settings',
        'space environments',
        'underground locations',
      );
    }
    if (hasUrban) {
      suggestions.push('rural settings', 'wilderness areas', 'magical realms');
    }

    // Default suggestions if none of the above match
    if (suggestions.length === 0) {
      suggestions.push(
        'unexpected locations',
        'settings that contrast with typical stories',
        'culturally diverse environments',
      );
    }

    return suggestions.slice(0, 3); // Limit to 3 suggestions
  }

  /**
   * Suggest object alternatives based on what's overused
   */
  private suggestObjectAlternatives(objects: ElementWithFrequency[]): string[] {
    const suggestions: string[] = [];
    const overused = this.getOverusedElements(objects);

    // Analyze common patterns in overused objects
    const hasMagicItems = overused.some(o =>
      /magic|magical|enchanted|wand|spell|potion/i.test(o),
    );
    const hasKeys = overused.some(o => /key|keys|lock/i.test(o));
    const hasBooks = overused.some(o => /book|scroll|map|letter/i.test(o));
    const hasJewelry = overused.some(o =>
      /ring|necklace|crown|amulet|gem|crystal/i.test(o),
    );

    if (hasMagicItems) {
      suggestions.push(
        'everyday objects with surprising importance',
        'technological gadgets',
        'natural items (stones, plants, etc.)',
      );
    }
    if (hasKeys) {
      suggestions.push(
        'puzzles or riddles as solutions',
        'passwords or codes',
        'relationships or trust as the "key"',
      );
    }
    if (hasBooks) {
      suggestions.push(
        'digital or modern communication devices',
        'musical instruments',
        'tools or weapons',
      );
    }
    if (hasJewelry) {
      suggestions.push(
        'clothing or accessories',
        'food or consumables',
        'living objects (plants, animals)',
      );
    }

    // Default suggestions if none of the above match
    if (suggestions.length === 0) {
      suggestions.push(
        'unconventional objects',
        'items from different cultures',
        'objects with emotional rather than magical significance',
      );
    }

    return suggestions.slice(0, 3); // Limit to 3 suggestions
  }

  /**
   * Suggest plot pattern alternatives based on what's overused
   */
  private suggestPlotPatternAlternatives(
    plotPatterns: ElementWithFrequency[],
  ): string[] {
    const suggestions: string[] = [];
    const overused = this.getOverusedElements(plotPatterns);

    // Analyze common patterns in overused plot patterns
    const hasDiscovery = overused.some(p =>
      /found|discovered|stumbled|noticed/i.test(p),
    );
    const hasChase = overused.some(p =>
      /chase|run|escape|flee|follow/i.test(p),
    );
    const hasMystery = overused.some(p =>
      /mystery|puzzle|secret|hidden|clue/i.test(p),
    );
    const hasTransformation = overused.some(p =>
      /transform|change|become|turn into/i.test(p),
    );

    if (hasDiscovery) {
      suggestions.push(
        'deliberate seeking or planning',
        'receiving gifts or inheritances',
        'creating or building something new',
      );
    }
    if (hasChase) {
      suggestions.push(
        'negotiation or diplomacy',
        'solving problems through cleverness',
        'waiting or patience as the solution',
      );
    }
    if (hasMystery) {
      suggestions.push(
        'transparent challenges with clear obstacles',
        'interpersonal conflicts',
        'self-discovery journeys',
      );
    }
    if (hasTransformation) {
      suggestions.push(
        'characters staying true to themselves',
        'external changes in environment or relationships',
        'gradual growth rather than sudden change',
      );
    }

    // Default suggestions if none of the above match
    if (suggestions.length === 0) {
      suggestions.push(
        'character-driven plots',
        'unexpected plot twists',
        'collaborative problem-solving',
      );
    }

    return suggestions.slice(0, 3); // Limit to 3 suggestions
  }

  /**
   * Get overused elements (frequency >= 3) from a list
   */
  private getOverusedElements(elements: ElementWithFrequency[]): string[] {
    return elements
      .filter(
        el => el.frequency >= DiversityGuidanceService.FREQUENCY_THRESHOLD_HIGH,
      )
      .map(el => el.elementText);
  }

  /**
   * Build the final guidance text
   */
  private buildGuidanceText(
    avoidList: Array<{ text: string; frequency: number; type: string }>,
    alternatives: AlternativesByCategory | null,
    emphasisLevel: 'subtle' | 'moderate' | 'strong',
  ): string {
    const parts: string[] = [];

    // Part 1: Elements to avoid
    if (avoidList.length > 0) {
      const avoidedItems = avoidList
        .map(item => {
          const timesText =
            item.frequency === 1 ? 'time' : `${item.frequency} times`;
          return `"${item.text}" (${timesText})`;
        })
        .join(', ');

      const emphasisPrefix = {
        subtle: 'Consider avoiding recently used elements:',
        moderate: 'Recently used elements to avoid:',
        strong: '⚠️ IMPORTANT - Avoid these recently overused elements:',
      };

      parts.push(`${emphasisPrefix[emphasisLevel]} ${avoidedItems}`);
    }

    // Part 2: Suggested alternatives
    if (alternatives) {
      const alternativeParts: string[] = [];

      if (alternatives.characters.length > 0) {
        alternativeParts.push(
          `Characters: ${alternatives.characters.join(', ')}`,
        );
      }
      if (alternatives.settings.length > 0) {
        alternativeParts.push(`Settings: ${alternatives.settings.join(', ')}`);
      }
      if (alternatives.objects.length > 0) {
        alternativeParts.push(`Objects: ${alternatives.objects.join(', ')}`);
      }
      if (alternatives.plot_patterns.length > 0) {
        alternativeParts.push(
          `Plot patterns: ${alternatives.plot_patterns.join(', ')}`,
        );
      }

      if (alternativeParts.length > 0) {
        parts.push(`Suggested alternatives: ${alternativeParts.join('; ')}`);
      }
    }

    // Part 3: Goal statement
    const goalStatements = {
      subtle: 'Try to create something fresh and unexpected.',
      moderate: 'Goal: Create a story with fresh, unexpected elements.',
      strong:
        '🎯 PRIMARY GOAL: Create a highly diverse story with completely fresh, unexpected elements that break away from recent patterns.',
    };

    parts.push(goalStatements[emphasisLevel]);

    return parts.join('\n');
  }

  /**
   * Count total alternatives suggested
   */
  private countAlternatives(alternatives: AlternativesByCategory): number {
    return (
      alternatives.characters.length +
      alternatives.settings.length +
      alternatives.objects.length +
      alternatives.plot_patterns.length
    );
  }

  /**
   * Generate a compact version of guidance for token-limited contexts
   *
   * Useful when the full guidance text would exceed token limits.
   * Keeps only the most critical information (top 3 elements to avoid).
   */
  generateCompactGuidance(
    options: DiversityGuidanceOptions,
  ): DiversityGuidance {
    return this.generateDiversityGuidance({
      ...options,
      maxElementsToList: 3,
      includeAlternatives: false,
      emphasisLevel: 'subtle',
    });
  }
}

// Export singleton instance
export const diversityGuidanceService = new DiversityGuidanceService();
