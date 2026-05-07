/**
 * Unit Tests for Story Element Extraction Service
 *
 * Tests LLM-based extraction, normalization, fallback logic, and error handling
 */

import { storyElementExtractionService } from '../../services/storyElementExtractionService';
import { openaiClient } from '../../services/openaiClient';

// Mock the OpenAI client
jest.mock('../../services/openaiClient', () => ({
  openaiClient: {
    isConfigured: jest.fn(),
    generateStoryCompletion: jest.fn(),
  },
}));

describe('StoryElementExtractionService', () => {
  const mockOpenAIClient = openaiClient as jest.Mocked<typeof openaiClient>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('extractStoryElements', () => {
    it('should extract elements successfully with valid LLM response', async () => {
      mockOpenAIClient.isConfigured.mockReturnValue(true);
      mockOpenAIClient.generateStoryCompletion.mockResolvedValue(
        JSON.stringify({
          characters: [
            { name: 'Luna', type: 'rabbit', role: 'protagonist' },
            { name: 'wise owl', type: 'bird', role: 'mentor' },
          ],
          settings: [{ location: 'enchanted forest', environment: 'forest' }],
          objects: [
            { name: 'crystal', magical: true, purpose: 'grants wishes' },
            { name: 'key', magical: false, purpose: 'unlocks door' },
          ],
          plot_patterns: [
            { action: 'discovering', discovery_type: 'hidden treasure' },
          ],
        }),
      );

      const storyText =
        'Luna the rabbit found a glowing crystal in the enchanted forest.';
      const result = await storyElementExtractionService.extractStoryElements(
        storyText,
      );

      expect(result).toBeDefined();
      expect(result.characters).toHaveLength(2);
      expect(result.characters[0].name).toBe('luna'); // normalized to lowercase
      expect(result.settings).toHaveLength(1);
      expect(result.objects).toHaveLength(2);
      expect(result.plot_patterns).toHaveLength(1);
    });

    it('should normalize elements to lowercase and singular form', async () => {
      mockOpenAIClient.isConfigured.mockReturnValue(true);
      mockOpenAIClient.generateStoryCompletion.mockResolvedValue(
        JSON.stringify({
          characters: [{ name: 'ALEX', type: 'HUMAN', role: 'PROTAGONIST' }],
          settings: [{ location: 'MAGICAL FOREST', environment: 'FOREST' }],
          objects: [{ name: 'KEYS', magical: false, purpose: 'OPENING DOORS' }],
          plot_patterns: [{ action: 'RUNNING', discovery_type: 'FRIENDSHIP' }],
        }),
      );

      const result = await storyElementExtractionService.extractStoryElements(
        'Test story',
      );

      expect(result.characters[0].name).toBe('alex');
      expect(result.characters[0].type).toBe('human');
      expect(result.characters[0].role).toBe('protagonist');
      expect(result.settings[0].location).toBe('magical forest');
      expect(result.objects[0].name).toBe('key'); // plural normalized to singular
      expect(result.plot_patterns[0].action).toBe('run'); // -ing removed
    });

    it('should handle markdown code blocks in LLM response', async () => {
      mockOpenAIClient.isConfigured.mockReturnValue(true);
      mockOpenAIClient.generateStoryCompletion.mockResolvedValue(
        '```json\n' +
          JSON.stringify({
            characters: [{ name: 'test', type: 'human', role: 'hero' }],
            settings: [{ location: 'city', environment: 'urban' }],
            objects: [],
            plot_patterns: [],
          }) +
          '\n```',
      );

      const result = await storyElementExtractionService.extractStoryElements(
        'Test story',
      );

      expect(result.characters).toHaveLength(1);
      expect(result.characters[0].name).toBe('test');
    });

    it('should throw error for empty story text', async () => {
      await expect(
        storyElementExtractionService.extractStoryElements(''),
      ).rejects.toThrow('Story text cannot be empty');

      await expect(
        storyElementExtractionService.extractStoryElements('   '),
      ).rejects.toThrow('Story text cannot be empty');
    });

    it('should retry on API failures with exponential backoff', async () => {
      mockOpenAIClient.isConfigured.mockReturnValue(true);

      // First two attempts fail, third succeeds
      mockOpenAIClient.generateStoryCompletion
        .mockRejectedValueOnce(new Error('rate limit exceeded'))
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce(
          JSON.stringify({
            characters: [{ name: 'test', type: 'human', role: 'hero' }],
            settings: [],
            objects: [],
            plot_patterns: [],
          }),
        );

      const result = await storyElementExtractionService.extractStoryElements(
        'Test story',
      );

      expect(mockOpenAIClient.generateStoryCompletion).toHaveBeenCalledTimes(3);
      expect(result.characters).toHaveLength(1);
    });

    it('should use fallback extraction after all retries fail', async () => {
      mockOpenAIClient.isConfigured.mockReturnValue(true);
      mockOpenAIClient.generateStoryCompletion.mockRejectedValue(
        new Error('API unavailable'),
      );

      const storyText =
        'Luna the rabbit found a crystal in the forest with a magic key.';
      const result = await storyElementExtractionService.extractStoryElements(
        storyText,
      );

      // Fallback should still return valid structure
      expect(result).toBeDefined();
      expect(result.characters).toBeDefined();
      expect(result.settings).toBeDefined();
      expect(result.objects).toBeDefined();
      expect(result.plot_patterns).toBeDefined();

      // Should detect "rabbit" and "forest" from keywords
      expect(result.characters.length).toBeGreaterThan(0);
      expect(result.settings.length).toBeGreaterThan(0);
    });

    it('should not retry on authentication errors', async () => {
      mockOpenAIClient.isConfigured.mockReturnValue(true);
      mockOpenAIClient.generateStoryCompletion.mockRejectedValue(
        new Error('Invalid OpenAI API key'),
      );

      await expect(
        storyElementExtractionService.extractStoryElements('Test story'),
      ).rejects.toThrow('Invalid OpenAI API key');

      // Should only try once, not retry
      expect(mockOpenAIClient.generateStoryCompletion).toHaveBeenCalledTimes(1);
    });

    it('should handle invalid JSON responses gracefully', async () => {
      mockOpenAIClient.isConfigured.mockReturnValue(true);
      mockOpenAIClient.generateStoryCompletion.mockResolvedValue(
        'This is not valid JSON',
      );

      // Should fall back to keyword extraction
      const result = await storyElementExtractionService.extractStoryElements(
        'Alex found a magic key in the forest',
      );

      expect(result).toBeDefined();
      expect(result.characters).toBeDefined();
    });

    it('should truncate very long stories to avoid token limits', async () => {
      mockOpenAIClient.isConfigured.mockReturnValue(true);
      mockOpenAIClient.generateStoryCompletion.mockResolvedValue(
        JSON.stringify({
          characters: [],
          settings: [],
          objects: [],
          plot_patterns: [],
        }),
      );

      // Create a story longer than 4000 characters
      const longStory = 'Once upon a time, '.repeat(300);
      await storyElementExtractionService.extractStoryElements(longStory);

      // Verify the LLM received truncated text
      const callArgs = mockOpenAIClient.generateStoryCompletion.mock.calls[0];
      const userPrompt = callArgs[1];
      expect(userPrompt.length).toBeLessThan(5000); // Should be truncated
    });
  });

  describe('Normalization', () => {
    it('should normalize plurals to singular form', async () => {
      mockOpenAIClient.isConfigured.mockReturnValue(true);
      mockOpenAIClient.generateStoryCompletion.mockResolvedValue(
        JSON.stringify({
          characters: [],
          settings: [],
          objects: [
            { name: 'keys', magical: false, purpose: 'test' },
            { name: 'boxes', magical: false, purpose: 'test' },
            { name: 'berries', magical: false, purpose: 'test' },
          ],
          plot_patterns: [],
        }),
      );

      const result = await storyElementExtractionService.extractStoryElements(
        'Test',
      );

      expect(result.objects[0].name).toBe('key');
      expect(result.objects[1].name).toBe('box');
      expect(result.objects[2].name).toBe('berry');
    });

    it('should normalize verbs to base form', async () => {
      mockOpenAIClient.isConfigured.mockReturnValue(true);
      mockOpenAIClient.generateStoryCompletion.mockResolvedValue(
        JSON.stringify({
          characters: [],
          settings: [],
          objects: [],
          plot_patterns: [
            { action: 'running', discovery_type: 'test' },
            { action: 'discovered', discovery_type: 'test' },
            { action: 'finding', discovery_type: 'test' },
          ],
        }),
      );

      const result = await storyElementExtractionService.extractStoryElements(
        'Test',
      );

      expect(result.plot_patterns[0].action).toBe('run');
      expect(result.plot_patterns[1].action).toBe('discover');
      expect(result.plot_patterns[2].action).toBe('find');
    });
  });

  describe('Fallback Extraction', () => {
    beforeEach(() => {
      mockOpenAIClient.isConfigured.mockReturnValue(true);
      mockOpenAIClient.generateStoryCompletion.mockRejectedValue(
        new Error('LLM unavailable'),
      );
    });

    it('should extract characters from capitalized names', async () => {
      const story = 'Luna the brave rabbit met Maya and Sam in the forest.';
      const result = await storyElementExtractionService.extractStoryElements(
        story,
      );

      // Should extract Luna, Maya, Sam, and rabbit
      expect(result.characters.length).toBeGreaterThan(0);
      const names = result.characters.map(c => c.name);
      expect(names).toContain('luna');
      expect(names).toContain('rabbit');
    });

    it('should extract common settings', async () => {
      const story =
        'The children went to school, then home, and finally to the forest.';
      const result = await storyElementExtractionService.extractStoryElements(
        story,
      );

      expect(result.settings.length).toBeGreaterThan(0);
      const locations = result.settings.map(s => s.location);
      expect(locations).toContain('school');
      expect(locations).toContain('forest');
    });

    it('should detect magical vs ordinary objects', async () => {
      const story = 'She found a magic crystal, a wand, and a regular key.';
      const result = await storyElementExtractionService.extractStoryElements(
        story,
      );

      const magical = result.objects.filter(o => o.magical);
      const ordinary = result.objects.filter(o => !o.magical);

      expect(magical.length).toBeGreaterThan(0);
      expect(ordinary.length).toBeGreaterThan(0);
    });

    it('should extract plot patterns from action verbs', async () => {
      const story =
        'They discovered a secret, helped their friend, and escaped danger.';
      const result = await storyElementExtractionService.extractStoryElements(
        story,
      );

      expect(result.plot_patterns.length).toBeGreaterThan(0);
      const actions = result.plot_patterns.map(p => p.action);
      expect(
        actions.some(
          a =>
            a.includes('discover') || a.includes('help') || a.includes('escap'),
        ),
      ).toBe(true);
    });

    it('should limit number of extracted elements', async () => {
      const story =
        'Alex, Maya, Sam, Jordan, Casey, Riley, Morgan, Quinn, Sage, River, and many others explored the forest, garden, mountain, beach, cave, castle, ocean, city, village, and park.';
      const result = await storyElementExtractionService.extractStoryElements(
        story,
      );

      // Should limit to reasonable numbers
      expect(result.characters.length).toBeLessThanOrEqual(10);
      expect(result.settings.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle stories with only dialogue', async () => {
      mockOpenAIClient.isConfigured.mockReturnValue(true);
      mockOpenAIClient.generateStoryCompletion.mockResolvedValue(
        JSON.stringify({
          characters: [{ name: 'speaker', type: 'human', role: 'protagonist' }],
          settings: [],
          objects: [],
          plot_patterns: [],
        }),
      );

      const story = '"Hello," she said. "How are you?" he replied.';
      const result = await storyElementExtractionService.extractStoryElements(
        story,
      );

      expect(result).toBeDefined();
      expect(result.characters.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle stories with special characters', async () => {
      mockOpenAIClient.isConfigured.mockReturnValue(true);
      mockOpenAIClient.generateStoryCompletion.mockResolvedValue(
        JSON.stringify({
          characters: [],
          settings: [],
          objects: [],
          plot_patterns: [],
        }),
      );

      const story = 'The robot 🤖 found a key 🔑 in the castle 🏰!';
      const result = await storyElementExtractionService.extractStoryElements(
        story,
      );

      expect(result).toBeDefined();
    });

    it('should handle non-English text gracefully', async () => {
      mockOpenAIClient.isConfigured.mockReturnValue(true);
      mockOpenAIClient.generateStoryCompletion.mockResolvedValue(
        JSON.stringify({
          characters: [],
          settings: [],
          objects: [],
          plot_patterns: [],
        }),
      );

      const story = 'Un chat trouvé une clé magique.';
      const result = await storyElementExtractionService.extractStoryElements(
        story,
      );

      expect(result).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should complete extraction within reasonable time', async () => {
      mockOpenAIClient.isConfigured.mockReturnValue(true);
      mockOpenAIClient.generateStoryCompletion.mockResolvedValue(
        JSON.stringify({
          characters: [{ name: 'test', type: 'human', role: 'hero' }],
          settings: [],
          objects: [],
          plot_patterns: [],
        }),
      );

      const start = Date.now();
      await storyElementExtractionService.extractStoryElements(
        'Quick test story',
      );
      const duration = Date.now() - start;

      // Should complete in under 5 seconds (without actual API calls)
      expect(duration).toBeLessThan(5000);
    }, 10000);
  });
});
