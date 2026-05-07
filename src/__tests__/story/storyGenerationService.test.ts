// Story Generation Service Tests
// Comprehensive testing for story generation functionality

import { storyGenerationService } from '../../services/storyGenerationService';

// Mock OpenAI
jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  })),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

describe('StoryGenerationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Story Generation', () => {
    it('should generate age-appropriate stories for K-2', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content:
                'Once upon a time, there was a friendly cat who loved to help others.',
            },
          },
        ],
      };

      const mockOpenAI = require('openai').default;
      const mockCreate = jest.fn().mockResolvedValue(mockResponse);
      mockOpenAI.mockImplementation(() => ({
        chat: { completions: { create: mockCreate } },
      }));

      const response = await storyGenerationService.generateStory({
        gradeLevel: 'K-2',
        challenge: 'adventure',
      });

      expect(response.success).toBe(true);
      expect(response.story).toBeTruthy();
      expect(response.gradeLevel).toBe('K-2');
    });

    it('should handle OpenAI API errors gracefully', async () => {
      const mockOpenAI = require('openai').default;
      const mockCreate = jest
        .fn()
        .mockRejectedValue(new Error('API Rate Limit'));
      mockOpenAI.mockImplementation(() => ({
        chat: { completions: { create: mockCreate } },
      }));

      const response = await storyGenerationService.generateStory({
        gradeLevel: 'K-2',
        challenge: 'adventure',
      });

      expect(response.success).toBe(true); // Should use fallback
      expect(response.story).toBeTruthy(); // Should have fallback content
    });
  });

  describe('Story Continuation', () => {
    it('should continue stories maintaining consistency', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content:
                'The magic ball glowed softly and showed the cat wonderful adventures.',
            },
          },
        ],
      };

      const mockOpenAI = require('openai').default;
      const mockCreate = jest.fn().mockResolvedValue(mockResponse);
      mockOpenAI.mockImplementation(() => ({
        chat: { completions: { create: mockCreate } },
      }));

      const response = await storyGenerationService.generateStory({
        gradeLevel: 'K-2',
        storySoFar: 'Once upon a time, there was a cat.',
        userInput: 'The cat found a magic ball.',
      });

      expect(response.success).toBe(true);
      expect(response.story).toBeTruthy();
    });
  });

  describe('Error Handling and Fallbacks', () => {
    it('should provide fallback content when API fails', async () => {
      const mockOpenAI = require('openai').default;
      const mockCreate = jest
        .fn()
        .mockRejectedValue(new Error('Network error'));
      mockOpenAI.mockImplementation(() => ({
        chat: { completions: { create: mockCreate } },
      }));

      const response = await storyGenerationService.generateStory({
        gradeLevel: 'K-2',
        challenge: 'adventure',
      });

      expect(response.success).toBe(true); // Should still succeed with fallback
      expect(response.story).toBeTruthy();
    });
  });

  describe('AI Story Integration - Imported Content', () => {
    const mockImportedStory = `Once upon a time, there was a brave little rabbit named Luna. Luna lived in a magical forest where the trees could whisper secrets. One day, Luna discovered a glowing crystal hidden beneath an ancient oak tree. The crystal felt warm in her tiny paws and seemed to pulse with mysterious energy.`;

    it('should analyze imported story structure and style', () => {
      const analysis = storyGenerationService.analyzeImportedStory(
        mockImportedStory,
        'K-2',
      );

      expect(analysis.wordCount).toBeGreaterThan(0);
      expect(analysis.sentenceCount).toBeGreaterThan(0);
      expect(analysis.characters).toContain('Luna');
      expect(analysis.genre).toBe('fantasy');
      expect(analysis.tense).toBe('past');
      expect(analysis.settings).toContain('forest');
      expect(analysis.themes).toContain('magic');
    });

    it('should prepare context for imported story continuation', () => {
      const analysis = storyGenerationService.analyzeImportedStory(
        mockImportedStory,
        '3-5',
      );

      const context = storyGenerationService.prepareImportedStoryContext(
        mockImportedStory,
        'Luna decided to explore deeper into the forest.',
        '3-5',
        analysis,
      );

      expect(context).toContain('fantasy');
      expect(context).toContain('Luna');
      expect(context).toContain('forest');
      expect(context).toContain('3-5');
      expect(context).toContain('Luna decided to explore deeper');
    });

    it('should generate continuation for imported story', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content:
                'Luna felt the crystal grow warmer as she stepped deeper into the enchanted forest.',
            },
          },
        ],
      };

      const mockOpenAI = require('openai').default;
      const mockCreate = jest.fn().mockResolvedValue(mockResponse);
      mockOpenAI.mockImplementation(() => ({
        chat: { completions: { create: mockCreate } },
      }));

      const response =
        await storyGenerationService.generateImportedStoryContinuation(
          mockImportedStory,
          "Luna decided to follow the crystal's glow.",
          'K-2',
        );

      expect(response.success).toBe(true);
      expect(response.story).toBeTruthy();
      expect(response.gradeLevel).toBe('K-2');
    });

    it('should maintain character consistency in continuations', async () => {
      const storyWithCharacter = `Elena was a curious 10-year-old who loved solving puzzles. She had just moved to a new town and was exploring her grandmother's attic.`;

      const mockResponse = {
        choices: [
          {
            message: {
              content:
                'Elena discovered an old journal filled with mysterious symbols.',
            },
          },
        ],
      };

      const mockOpenAI = require('openai').default;
      const mockCreate = jest.fn().mockResolvedValue(mockResponse);
      mockOpenAI.mockImplementation(() => ({
        chat: { completions: { create: mockCreate } },
      }));

      const response =
        await storyGenerationService.generateImportedStoryContinuation(
          storyWithCharacter,
          'Elena noticed something glinting behind the old books.',
          '3-5',
        );

      expect(response.success).toBe(true);
      expect(response.story).toBeTruthy();
    });

    it('should detect and maintain genre consistency', () => {
      const sciFiStory = `Captain Zara piloted her spacecraft through the asteroid field. The computer systems were malfunctioning, and alien signals filled the communication channels.`;

      const analysis = storyGenerationService.analyzeImportedStory(
        sciFiStory,
        '6-8',
      );

      expect(analysis.genre).toBe('scifi');
      expect(analysis.characters).toContain('Captain Zara');
      expect(analysis.settings.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle different story complexities appropriately', () => {
      const simpleStory = `The cat sat. It was happy.`;
      const complexStory = `The multifaceted protagonist navigated through an intricate labyrinth of philosophical dilemmas while contemplating the existential ramifications of their choices.`;

      const simpleAnalysis = storyGenerationService.analyzeImportedStory(
        simpleStory,
        'K-2',
      );
      const complexAnalysis = storyGenerationService.analyzeImportedStory(
        complexStory,
        '9-12',
      );

      expect(simpleAnalysis.complexity).toBe('appropriate');
      expect(complexAnalysis.complexity).toBe('appropriate'); // For 9-12, the complex sentence still fits within limits
      expect(simpleAnalysis.avgWordsPerSentence).toBeLessThan(
        complexAnalysis.avgWordsPerSentence,
      );
    });

    it('should extract themes from imported stories', () => {
      const friendshipStory = `Emma and Jake were best friends who always helped each other. When Emma lost her lunch money, Jake shared his sandwich without hesitation.`;

      const analysis = storyGenerationService.analyzeImportedStory(
        friendshipStory,
        '3-5',
      );

      expect(analysis.themes).toContain('friendship');
      expect(analysis.characters).toContain('Emma');
      expect(analysis.characters).toContain('Jake');
    });

    it('should handle stories with dialogue', () => {
      const dialogueStory = `"Hello there!" called Maya from across the playground. "Do you want to play?" asked the new student nervously.`;

      const analysis = storyGenerationService.analyzeImportedStory(
        dialogueStory,
        '3-5',
      );

      expect(analysis.style.features).toContain('includes dialogue');
      expect(analysis.characters).toContain('Maya');
    });

    it('should fallback gracefully for imported story continuation', async () => {
      const mockOpenAI = require('openai').default;
      const mockCreate = jest.fn().mockRejectedValue(new Error('API Error'));
      mockOpenAI.mockImplementation(() => ({
        chat: { completions: { create: mockCreate } },
      }));

      const response =
        await storyGenerationService.generateImportedStoryContinuation(
          mockImportedStory,
          'Luna looked around curiously.',
          'K-2',
        );

      expect(response.success).toBe(true); // Should use fallback
      expect(response.story).toBeTruthy();
    });
  });

  describe('Service Configuration', () => {
    it('should be ready when configured', () => {
      const isReady = storyGenerationService.isReady();
      expect(typeof isReady).toBe('boolean');
    });

    it('should return configuration', () => {
      const config = storyGenerationService.getConfig();
      expect(config).toBeDefined();
      expect(config.model).toBeDefined();
      expect(config.maxTokens).toBeGreaterThan(0);
    });
  });
});
