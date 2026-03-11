/**
 * Story Element Extraction Service
 *
 * Extracts narrative elements (characters, settings, objects, plot patterns)
 * from story text using LLM-based structured output analysis.
 *
 * Part of the Story Diversity Tracking System (US-002)
 */

import { openaiClient } from './openaiClient';

/**
 * Structured story elements extracted from narrative text
 */
export interface StoryElements {
  characters: Character[];
  settings: Setting[];
  objects: StoryObject[];
  plot_patterns: PlotPattern[];
}

export interface Character {
  name: string;
  type: string; // e.g., "human", "animal", "magical creature"
  role: string; // e.g., "protagonist", "antagonist", "helper"
}

export interface Setting {
  location: string;
  environment: string; // e.g., "forest", "urban", "fantasy", "underwater"
}

export interface StoryObject {
  name: string;
  magical: boolean;
  purpose: string; // narrative role of the object
}

export interface PlotPattern {
  action: string; // key plot action
  discovery_type: string; // type of discovery or event
}

/**
 * Story Element Extraction Service
 *
 * Uses OpenAI GPT-4 with structured prompting to extract key narrative elements.
 * Elements are normalized (lowercase, singular form) for semantic comparison.
 */
class StoryElementExtractionService {
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY_MS = 1000;

  /**
   * System prompt for structured element extraction
   *
   * Guides the LLM to extract specific narrative elements in consistent format
   */
  private static readonly EXTRACTION_SYSTEM_PROMPT = `You are an expert literary analyst specializing in narrative structure and story elements.

Your task is to analyze story text and extract key narrative elements in a structured JSON format.

EXTRACTION REQUIREMENTS:

1. CHARACTERS:
   - Extract main characters mentioned in the story
   - Include name (or description if unnamed), type, and narrative role
   - Types: human, animal, magical creature, robot, etc.
   - Roles: protagonist, antagonist, helper, mentor, friend, etc.
   - Normalize names to lowercase for consistency

2. SETTINGS:
   - Extract locations and environments where the story takes place
   - Include both specific locations and general environment types
   - Environments: forest, urban, underwater, magical realm, school, home, etc.
   - Normalize to lowercase

3. OBJECTS:
   - Extract significant objects that play a role in the narrative
   - Mark whether the object is magical/special or ordinary
   - Include the object's narrative purpose
   - Normalize to lowercase and singular form (e.g., "keys" → "key")

4. PLOT PATTERNS:
   - Extract key plot actions and discovery types
   - Actions: finding, escaping, solving, helping, transforming, etc.
   - Discovery types: hidden treasure, secret identity, magical power, friendship, etc.
   - Normalize to lowercase

NORMALIZATION RULES:
- Convert all text to lowercase
- Use singular form for countable nouns (e.g., "books" → "book")
- Use generic forms (e.g., "Luna the rabbit" → name: "luna", type: "animal")
- Keep verbs in base form (e.g., "running" → "run")

OUTPUT FORMAT:
Return ONLY valid JSON with this exact structure (no markdown, no code blocks, no explanations):
{
  "characters": [{"name": "string", "type": "string", "role": "string"}],
  "settings": [{"location": "string", "environment": "string"}],
  "objects": [{"name": "string", "magical": boolean, "purpose": "string"}],
  "plot_patterns": [{"action": "string", "discovery_type": "string"}]
}`;

  /**
   * User prompt template for story analysis
   */
  private static readonly EXTRACTION_USER_PROMPT_TEMPLATE = `Analyze this story excerpt and extract narrative elements in JSON format:

Story:
"""
{storyText}
"""

Extract characters, settings, objects, and plot patterns. Return valid JSON only.`;

  /**
   * Extract story elements from narrative text using LLM
   *
   * @param storyText - The story text to analyze
   * @returns Structured story elements with normalized text
   * @throws Error if extraction fails after all retries
   */
  public async extractStoryElements(storyText: string): Promise<StoryElements> {
    if (!storyText || storyText.trim().length === 0) {
      throw new Error('Story text cannot be empty');
    }

    // Truncate extremely long stories to avoid token limits
    const maxLength = 4000; // ~1000 tokens
    const truncatedText =
      storyText.length > maxLength
        ? storyText.substring(0, maxLength) + '...'
        : storyText;

    for (
      let attempt = 0;
      attempt < StoryElementExtractionService.MAX_RETRIES;
      attempt++
    ) {
      try {
        console.log(
          `📖 Extracting story elements (attempt ${attempt + 1}/${
            StoryElementExtractionService.MAX_RETRIES
          })`,
          {
            storyLength: truncatedText.length,
          },
        );

        const elements = await this.extractWithLLM(truncatedText);

        // Normalize extracted elements
        const normalized = this.normalizeElements(elements);

        console.log('✅ Story elements extracted successfully:', {
          characters: normalized.characters.length,
          settings: normalized.settings.length,
          objects: normalized.objects.length,
          plot_patterns: normalized.plot_patterns.length,
        });

        return normalized;
      } catch (error: any) {
        const isLastAttempt =
          attempt === StoryElementExtractionService.MAX_RETRIES - 1;

        console.error(`❌ Extraction attempt ${attempt + 1} failed:`, {
          error: error.message,
        });

        // Don't retry on authentication errors
        if (error.message?.includes('Invalid OpenAI API key')) {
          throw error;
        }

        // If last attempt, fall back to basic extraction
        if (isLastAttempt) {
          console.warn('⚠️ All LLM extraction attempts failed, using fallback');
          return this.fallbackExtraction(truncatedText);
        }

        // Exponential backoff
        const delay =
          StoryElementExtractionService.RETRY_DELAY_MS * Math.pow(2, attempt);
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // Should never reach here, but TypeScript needs this
    throw new Error('Story element extraction failed: max retries exceeded');
  }

  /**
   * Extract elements using OpenAI LLM with structured output
   *
   * @private
   */
  private async extractWithLLM(storyText: string): Promise<StoryElements> {
    if (!openaiClient.isConfigured()) {
      throw new Error('OpenAI client not configured');
    }

    const userPrompt =
      StoryElementExtractionService.EXTRACTION_USER_PROMPT_TEMPLATE.replace(
        '{storyText}',
        storyText,
      );

    const response = await openaiClient.generateStoryCompletion(
      StoryElementExtractionService.EXTRACTION_SYSTEM_PROMPT,
      userPrompt,
      {
        maxTokens: 800, // Enough for structured JSON output
        temperature: 0.3, // Low temperature for consistent structured output
      },
    );

    // Parse JSON response
    try {
      // Step 1: Clean the response thoroughly
      let cleanedResponse = response.trim();

      // Step 2: Remove BOM (Byte Order Mark) if present
      if (cleanedResponse.charCodeAt(0) === 0xfeff) {
        cleanedResponse = cleanedResponse.substring(1);
      }

      // Step 3: Remove zero-width characters and other invisible Unicode characters
      cleanedResponse = cleanedResponse.replace(
        /[\u200B-\u200D\uFEFF\u00A0]/g,
        '',
      );

      // Step 4: Remove markdown code blocks if present
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse
          .replace(/^```json\s*/, '')
          .replace(/\s*```$/, '');
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse
          .replace(/^```\s*/, '')
          .replace(/\s*```$/, '');
      }

      // Step 5: Trim again after cleanup
      cleanedResponse = cleanedResponse.trim();

      // Step 6: Repair common JSON structure issues
      cleanedResponse = this.repairMalformedJSON(cleanedResponse);

      // Step 7: Log the first 500 chars for debugging (increased from 200)
      console.log('🔍 Attempting to parse cleaned JSON:', {
        firstChars: cleanedResponse.substring(0, 500),
        length: cleanedResponse.length,
        startsWithBrace: cleanedResponse.startsWith('{'),
        endsWithBrace: cleanedResponse.endsWith('}'),
      });

      // Step 8: Parse JSON
      const elements = JSON.parse(cleanedResponse) as StoryElements;

      // Step 9: Validate structure
      if (
        !elements.characters ||
        !elements.settings ||
        !elements.objects ||
        !elements.plot_patterns
      ) {
        throw new Error('Invalid JSON structure: missing required fields');
      }

      // Step 10: Validate arrays exist (even if empty)
      if (
        !Array.isArray(elements.characters) ||
        !Array.isArray(elements.settings) ||
        !Array.isArray(elements.objects) ||
        !Array.isArray(elements.plot_patterns)
      ) {
        throw new Error('Invalid JSON structure: fields must be arrays');
      }

      console.log('✅ JSON parsed successfully:', {
        characterCount: elements.characters.length,
        settingCount: elements.settings.length,
        objectCount: elements.objects.length,
        plotPatternCount: elements.plot_patterns.length,
      });

      return elements;
    } catch (parseError: any) {
      // Enhanced error logging with full response for debugging
      console.error('❌ Failed to parse LLM response as JSON:', {
        fullResponse: response, // Log FULL response to see the actual issue
        firstChars: response.substring(0, 500),
        lastChars: response.substring(Math.max(0, response.length - 100)),
        length: response.length,
        error: parseError.message,
        errorStack: parseError.stack,
      });
      throw new Error(`JSON parsing failed: ${parseError.message}`);
    }
  }

  /**
   * Normalize extracted elements to lowercase and singular form
   *
   * @private
   */
  private normalizeElements(elements: StoryElements): StoryElements {
    return {
      characters: elements.characters.map(char => ({
        name: this.normalizeText(char.name),
        type: this.normalizeText(char.type),
        role: this.normalizeText(char.role),
      })),
      settings: elements.settings.map(setting => ({
        location: this.normalizeText(setting.location),
        environment: this.normalizeText(setting.environment),
      })),
      objects: elements.objects.map(obj => ({
        name: this.normalizeSingular(obj.name),
        magical: obj.magical,
        purpose: this.normalizeText(obj.purpose),
      })),
      plot_patterns: elements.plot_patterns.map(pattern => ({
        action: this.normalizeVerb(pattern.action),
        discovery_type: this.normalizeText(pattern.discovery_type),
      })),
    };
  }

  /**
   * Repair common malformed JSON patterns from LLM responses
   *
   * Handles issues like:
   * - Orphaned strings without keys
   * - Missing required fields
   * - Incomplete array/object structures
   * - Trailing commas or broken syntax
   *
   * @private
   */
  private repairMalformedJSON(jsonString: string): string {
    let repaired = jsonString;

    // Pattern 1: Remove orphaned empty strings in the structure
    // This handles cases like: `"objects":[], "" ]}`
    // Remove standalone empty strings that appear after commas or arrays
    repaired = repaired.replace(/,\s*""\s*(?=[,\]\}])/g, '');

    // Pattern 2: Remove trailing commas in arrays
    repaired = repaired.replace(/,\s*]/g, ']');

    // Pattern 3: Remove trailing commas in objects
    repaired = repaired.replace(/,\s*}/g, '}');

    // Pattern 4: Fix nested object trailing commas
    repaired = repaired.replace(/,(\s*[}\]])/g, '$1');

    // Pattern 5: Check if required fields are missing and add defaults
    const requiredFields = [
      'characters',
      'settings',
      'objects',
      'plot_patterns',
    ];

    try {
      // Try to parse to check for missing fields
      const partial = JSON.parse(repaired);

      // Add missing required fields with empty arrays
      let needsRepair = false;
      requiredFields.forEach(field => {
        if (!(field in partial)) {
          needsRepair = true;
        }
      });

      if (needsRepair) {
        // Build complete object with defaults
        const complete: any = {
          characters: partial.characters || [],
          settings: partial.settings || [],
          objects: partial.objects || [],
          plot_patterns: partial.plot_patterns || [],
        };
        repaired = JSON.stringify(complete);
        console.log('🔧 Added missing required fields to JSON');
      }

      return repaired;
    } catch (e) {
      // If JSON is still unparseable, try aggressive repair
      console.log(
        '⚠️ JSON still malformed after basic repairs, attempting extraction',
      );

      // Strategy: Extract each field individually with regex, then reconstruct
      const extracted: any = {
        characters: [],
        settings: [],
        objects: [],
        plot_patterns: [],
      };

      requiredFields.forEach(field => {
        // Match field with its array content, handling nested structures
        const fieldRegex = new RegExp(`"${field}"\\s*:\\s*\\[(.*?)\\]`, 's');
        const fieldMatch = repaired.match(fieldRegex);

        if (fieldMatch && fieldMatch[1]) {
          const arrayContent = fieldMatch[1].trim();

          if (arrayContent.length > 0) {
            try {
              // Try to parse the array content
              const parsed = JSON.parse(`[${arrayContent}]`);
              extracted[field] = parsed;
              console.log(`✓ Extracted ${field}: ${parsed.length} items`);
            } catch (arrayParseError) {
              // Array content is malformed, try to fix it
              let fixedArrayContent = arrayContent;

              // Remove trailing commas within the array
              fixedArrayContent = fixedArrayContent.replace(
                /,(\s*[}\]])/g,
                '$1',
              );

              try {
                const parsed = JSON.parse(`[${fixedArrayContent}]`);
                extracted[field] = parsed;
                console.log(
                  `✓ Extracted ${field} after repair: ${parsed.length} items`,
                );
              } catch {
                console.log(`✗ Could not extract ${field}, using empty array`);
                extracted[field] = [];
              }
            }
          }
        }
      });

      repaired = JSON.stringify(extracted);
      console.log('🔧 Reconstructed JSON from extracted fields');
      return repaired;
    }
  }

  /**
   * Normalize text to lowercase
   *
   * @private
   */
  private normalizeText(text: string): string {
    return text.toLowerCase().trim();
  }

  /**
   * Normalize to singular form using simple heuristics
   *
   * @private
   */
  private normalizeSingular(text: string): string {
    const normalized = this.normalizeText(text);

    // Simple pluralization rules (English)
    if (normalized.endsWith('ies') && normalized.length > 4) {
      return normalized.slice(0, -3) + 'y'; // berries → berry
    }
    if (normalized.endsWith('es') && normalized.length > 3) {
      return normalized.slice(0, -2); // boxes → box
    }
    if (
      normalized.endsWith('s') &&
      normalized.length > 2 &&
      !normalized.endsWith('ss')
    ) {
      return normalized.slice(0, -1); // keys → key
    }

    return normalized;
  }

  /**
   * Normalize verb to base form using simple heuristics
   *
   * @private
   */
  private normalizeVerb(text: string): string {
    const normalized = this.normalizeText(text);

    // Simple verb normalization
    if (normalized.endsWith('ing') && normalized.length > 4) {
      // running → run, finding → find
      const base = normalized.slice(0, -3);
      // Handle double consonants: running → run
      if (base.length >= 3 && base[base.length - 1] === base[base.length - 2]) {
        return base.slice(0, -1);
      }
      return base;
    }
    if (normalized.endsWith('ed') && normalized.length > 3) {
      return normalized.slice(0, -2); // discovered → discover
    }

    return normalized;
  }

  /**
   * Fallback extraction using regex patterns when LLM fails
   *
   * This provides basic element extraction using keyword matching.
   * Less accurate than LLM but ensures the service never completely fails.
   *
   * @private
   */
  private fallbackExtraction(storyText: string): StoryElements {
    console.log('🔧 Using fallback extraction method');

    const lowerText = storyText.toLowerCase();

    return {
      characters: this.extractCharactersFallback(storyText, lowerText),
      settings: this.extractSettingsFallback(lowerText),
      objects: this.extractObjectsFallback(lowerText),
      plot_patterns: this.extractPlotPatternsFallback(lowerText),
    };
  }

  /**
   * Extract characters using regex patterns (fallback)
   * @private
   */
  private extractCharactersFallback(
    originalText: string,
    lowerText: string,
  ): Character[] {
    const characters: Character[] = [];

    // Extract proper names (capitalized words)
    const namePattern = /\b([A-Z][a-z]+)\b/g;
    const names = originalText.match(namePattern) || [];
    const uniqueNames = [...new Set(names)].slice(0, 5); // Limit to 5

    uniqueNames.forEach(name => {
      const normalizedName = this.normalizeText(name);
      // Skip common words
      if (
        !['the', 'this', 'that', 'when', 'then', 'once'].includes(
          normalizedName,
        )
      ) {
        characters.push({
          name: normalizedName,
          type: 'character',
          role: 'unknown',
        });
      }
    });

    // Check for animal types
    const animalTypes = [
      'rabbit',
      'cat',
      'dog',
      'fox',
      'bird',
      'mouse',
      'squirrel',
      'hedgehog',
      'owl',
    ];
    animalTypes.forEach(animal => {
      if (lowerText.includes(animal)) {
        characters.push({
          name: animal,
          type: 'animal',
          role: 'protagonist',
        });
      }
    });

    return characters.slice(0, 10); // Limit total
  }

  /**
   * Extract settings using keyword matching (fallback)
   * @private
   */
  private extractSettingsFallback(lowerText: string): Setting[] {
    const settings: Setting[] = [];

    const settingKeywords = {
      forest: 'forest',
      garden: 'garden',
      school: 'school',
      home: 'home',
      castle: 'castle',
      ocean: 'ocean',
      mountain: 'mountain',
      city: 'urban',
      village: 'village',
      cave: 'cave',
    };

    Object.entries(settingKeywords).forEach(([keyword, environment]) => {
      if (lowerText.includes(keyword)) {
        settings.push({
          location: keyword,
          environment,
        });
      }
    });

    return settings.slice(0, 5); // Limit
  }

  /**
   * Extract objects using keyword matching (fallback)
   * @private
   */
  private extractObjectsFallback(lowerText: string): StoryObject[] {
    const objects: StoryObject[] = [];

    const magicalObjects = [
      'wand',
      'crystal',
      'gem',
      'potion',
      'spell',
      'magic',
    ];
    const ordinaryObjects = ['key', 'book', 'map', 'bell', 'stone', 'flower'];

    magicalObjects.forEach(obj => {
      if (lowerText.includes(obj)) {
        objects.push({
          name: this.normalizeSingular(obj),
          magical: true,
          purpose: 'magical item',
        });
      }
    });

    ordinaryObjects.forEach(obj => {
      if (lowerText.includes(obj)) {
        objects.push({
          name: this.normalizeSingular(obj),
          magical: false,
          purpose: 'story item',
        });
      }
    });

    return objects.slice(0, 8); // Limit
  }

  /**
   * Extract plot patterns using keyword matching (fallback)
   * @private
   */
  private extractPlotPatternsFallback(lowerText: string): PlotPattern[] {
    const patterns: PlotPattern[] = [];

    const actionKeywords = {
      find: 'finding',
      discover: 'discovery',
      escape: 'escaping',
      help: 'helping',
      solve: 'solving',
      transform: 'transformation',
      explore: 'exploration',
    };

    Object.entries(actionKeywords).forEach(([keyword, action]) => {
      if (lowerText.includes(keyword)) {
        patterns.push({
          action,
          discovery_type: 'adventure',
        });
      }
    });

    return patterns.slice(0, 5); // Limit
  }
}

// Export singleton instance
export const storyElementExtractionService =
  new StoryElementExtractionService();
export default StoryElementExtractionService;
