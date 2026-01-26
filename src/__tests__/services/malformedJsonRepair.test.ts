/**
 * Test suite for JSON repair logic in storyElementExtractionService
 *
 * Tests the repair of malformed JSON responses from LLM that may have:
 * - Orphaned strings
 * - Missing required fields
 * - Incomplete structures
 */

import StoryElementExtractionService from '../../services/storyElementExtractionService';

describe('StoryElementExtractionService - JSON Repair', () => {
  let service: StoryElementExtractionService;

  beforeEach(() => {
    service = new StoryElementExtractionService();
  });

  /**
   * Access private method for testing using TypeScript type assertion
   */
  const callRepairMethod = (jsonString: string): string => {
    return (service as any).repairMalformedJSON(jsonString);
  };

  describe('repairMalformedJSON', () => {
    it('should repair JSON with orphaned empty string and missing plot_patterns', () => {
      // This is the exact malformed JSON from the production error
      const malformedJSON = `{
  "characters": [
    {"name": "maya", "type": "human", "role": "protagonist"},
    {"name": "leo", "type": "human", "role": "protagonist"},
    {"name": "inhabitants", "type": "human", "role": "helper"}
  ],
  "settings": [
    {"location": "", "environment": ""},
    {"location":"village suspended in time","environment":"realm of twilight"}
  ],
  "objects":[],
  ""

  ]
}`;

      const repaired = callRepairMethod(malformedJSON);
      const parsed = JSON.parse(repaired);

      // Should have all required fields
      expect(parsed).toHaveProperty('characters');
      expect(parsed).toHaveProperty('settings');
      expect(parsed).toHaveProperty('objects');
      expect(parsed).toHaveProperty('plot_patterns');

      // Should preserve valid data
      expect(parsed.characters).toHaveLength(3);
      expect(parsed.characters[0].name).toBe('maya');

      expect(parsed.settings).toHaveLength(2);
      expect(parsed.settings[1].location).toBe('village suspended in time');

      expect(parsed.objects).toEqual([]);

      // Should add missing field with empty array
      expect(parsed.plot_patterns).toEqual([]);
    });

    it('should remove orphaned empty strings in arrays', () => {
      const malformedJSON = `{
  "characters": [],
  "settings": [],
  "objects": [],
  ""
}`;

      const repaired = callRepairMethod(malformedJSON);
      const parsed = JSON.parse(repaired);

      expect(parsed.characters).toEqual([]);
      expect(parsed.settings).toEqual([]);
      expect(parsed.objects).toEqual([]);
      expect(parsed.plot_patterns).toEqual([]);
    });

    it('should remove trailing commas in arrays', () => {
      const malformedJSON = `{
  "characters": [
    {"name": "test", "type": "human", "role": "protagonist"},
  ],
  "settings": [],
  "objects": [],
  "plot_patterns": []
}`;

      const repaired = callRepairMethod(malformedJSON);
      const parsed = JSON.parse(repaired);

      expect(parsed.characters).toHaveLength(1);
      expect(parsed.characters[0].name).toBe('test');
    });

    it('should remove trailing commas in objects', () => {
      const malformedJSON = `{
  "characters": [],
  "settings": [],
  "objects": [],
  "plot_patterns": [],
}`;

      const repaired = callRepairMethod(malformedJSON);
      const parsed = JSON.parse(repaired);

      expect(parsed).toHaveProperty('characters');
      expect(parsed).toHaveProperty('settings');
      expect(parsed).toHaveProperty('objects');
      expect(parsed).toHaveProperty('plot_patterns');
    });

    it('should add missing required fields', () => {
      const malformedJSON = `{
  "characters": [
    {"name": "hero", "type": "human", "role": "protagonist"}
  ],
  "settings": []
}`;

      const repaired = callRepairMethod(malformedJSON);
      const parsed = JSON.parse(repaired);

      // Should have all required fields
      expect(parsed.characters).toHaveLength(1);
      expect(parsed.settings).toEqual([]);
      expect(parsed.objects).toEqual([]);
      expect(parsed.plot_patterns).toEqual([]);
    });

    it('should handle completely broken JSON by returning empty structure', () => {
      const malformedJSON = `{
  "characters": [
    {"name": "test"
  ]
  ""
  broken syntax here
}`;

      const repaired = callRepairMethod(malformedJSON);
      const parsed = JSON.parse(repaired);

      // Should return valid empty structure
      expect(parsed.characters).toEqual([]);
      expect(parsed.settings).toEqual([]);
      expect(parsed.objects).toEqual([]);
      expect(parsed.plot_patterns).toEqual([]);
    });

    it('should preserve valid JSON unchanged', () => {
      const validJSON = `{
  "characters": [
    {"name": "hero", "type": "human", "role": "protagonist"}
  ],
  "settings": [
    {"location": "forest", "environment": "woodland"}
  ],
  "objects": [
    {"name": "sword", "magical": true, "purpose": "weapon"}
  ],
  "plot_patterns": [
    {"action": "quest", "discovery_type": "treasure"}
  ]
}`;

      const repaired = callRepairMethod(validJSON);
      const parsed = JSON.parse(repaired);

      expect(parsed.characters).toHaveLength(1);
      expect(parsed.settings).toHaveLength(1);
      expect(parsed.objects).toHaveLength(1);
      expect(parsed.plot_patterns).toHaveLength(1);
    });

    it('should handle JSON with all fields empty', () => {
      const emptyJSON = `{
  "characters": [],
  "settings": [],
  "objects": [],
  "plot_patterns": []
}`;

      const repaired = callRepairMethod(emptyJSON);
      const parsed = JSON.parse(repaired);

      expect(parsed.characters).toEqual([]);
      expect(parsed.settings).toEqual([]);
      expect(parsed.objects).toEqual([]);
      expect(parsed.plot_patterns).toEqual([]);
    });

    it('should handle JSON with nested trailing commas', () => {
      const malformedJSON = `{
  "characters": [
    {
      "name": "hero",
      "type": "human",
      "role": "protagonist",
    },
  ],
  "settings": [],
  "objects": [],
  "plot_patterns": []
}`;

      const repaired = callRepairMethod(malformedJSON);
      const parsed = JSON.parse(repaired);

      expect(parsed.characters).toHaveLength(1);
      expect(parsed.characters[0].name).toBe('hero');
    });
  });
});
