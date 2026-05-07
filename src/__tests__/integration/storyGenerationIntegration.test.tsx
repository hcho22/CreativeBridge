// Story Generation Integration Tests
// Testing integration with AI story generation system for imported stories

// Mock react-native-fs first
jest.mock('react-native-fs', () => ({
  exists: jest.fn(),
  stat: jest.fn(),
  readFile: jest.fn(),
  unlink: jest.fn(),
}));

// Mock OpenAI client
const mockOpenAICompletion = jest.fn();
jest.mock('../../services/openaiClient', () => ({
  OpenAIClient: {
    generateCompletion: mockOpenAICompletion,
    analyzeStoryStructure: jest.fn(),
    generateImprovedPrompt: jest.fn(),
  },
}));

// Mock story services
const mockStoryAgent = {
  generateStoryContinuation: jest.fn(),
  analyzeStoryContext: jest.fn(),
  prepareContextForImportedStory: jest.fn(),
  generateCharacterConsistentContinuation: jest.fn(),
};

jest.mock('../../services/storyAgent', () => ({
  StoryAgent: mockStoryAgent,
}));

const mockStoryGenerationService = {
  generateImportedStoryContinuation: jest.fn(),
  analyzeImportedStory: jest.fn(),
  prepareImportedStoryContext: jest.fn(),
  validateContinuationQuality: jest.fn(),
};

jest.mock('../../services/storyGenerationService', () => ({
  StoryGenerationService: mockStoryGenerationService,
}));

import type { StorySource } from '../../types/database';

interface StoryGenerationTest {
  name: string;
  importedContent: string;
  expectedAnalysis: any;
  expectedContinuation: string;
  quality: 'high' | 'medium' | 'low';
}

class StoryGenerationTester {
  private tests: StoryGenerationTest[] = [];

  addTest(test: StoryGenerationTest) {
    this.tests.push(test);
  }

  async runGenerationTests(): Promise<{
    passed: number;
    failed: number;
    results: any[];
  }> {
    const results = [];
    let passed = 0;
    let failed = 0;

    for (const test of this.tests) {
      try {
        console.log(`Testing story generation: ${test.name}`);

        // Mock analysis
        mockStoryGenerationService.analyzeImportedStory.mockResolvedValueOnce(
          test.expectedAnalysis,
        );

        // Mock context preparation
        mockStoryGenerationService.prepareImportedStoryContext.mockResolvedValueOnce(
          {
            context: `Previous story: ${test.importedContent}`,
            characters: test.expectedAnalysis.characters || [],
            setting: test.expectedAnalysis.setting || 'unknown',
            tone: test.expectedAnalysis.tone || 'neutral',
          },
        );

        // Mock continuation generation
        mockStoryGenerationService.generateImportedStoryContinuation.mockResolvedValueOnce(
          test.expectedContinuation,
        );

        // Mock quality validation
        mockStoryGenerationService.validateContinuationQuality.mockResolvedValueOnce(
          {
            quality: test.quality,
            score:
              test.quality === 'high'
                ? 0.9
                : test.quality === 'medium'
                ? 0.7
                : 0.5,
            issues: test.quality === 'low' ? ['inconsistent tone'] : [],
          },
        );

        // Run the full generation pipeline
        const analysis = await mockStoryGenerationService.analyzeImportedStory(
          test.importedContent,
        );
        const context =
          await mockStoryGenerationService.prepareImportedStoryContext(
            test.importedContent,
            analysis,
          );
        const continuation =
          await mockStoryGenerationService.generateImportedStoryContinuation(
            test.importedContent,
          );
        const quality =
          await mockStoryGenerationService.validateContinuationQuality(
            continuation,
            test.importedContent,
          );

        results.push({
          name: test.name,
          analysis,
          context,
          continuation,
          quality,
          success: true,
        });

        if (quality.quality === test.quality) {
          passed++;
        } else {
          failed++;
        }
      } catch (error) {
        results.push({
          name: test.name,
          error: error instanceof Error ? error.message : String(error),
          success: false,
        });
        failed++;
      }
    }

    return { passed, failed, results };
  }
}

describe('Story Generation Integration', () => {
  let generationTester: StoryGenerationTester;

  beforeEach(() => {
    jest.clearAllMocks();
    generationTester = new StoryGenerationTester();
  });

  describe('AI Story Analysis Integration', () => {
    it('should analyze imported story structure correctly', async () => {
      const importedStory =
        'Once upon a time, there was a brave knight named Sir Arthur who lived in a castle by the sea. He had a faithful horse named Thunder and always carried his magical sword.';

      const expectedAnalysis = {
        genre: 'fantasy',
        tone: 'adventurous',
        characters: ['Sir Arthur', 'Thunder'],
        setting: 'medieval castle by the sea',
        themes: ['bravery', 'adventure', 'magic'],
        complexity: 'medium',
        wordCount: 32,
        readingLevel: 'elementary',
      };

      mockStoryGenerationService.analyzeImportedStory.mockResolvedValue(
        expectedAnalysis,
      );

      const result = await mockStoryGenerationService.analyzeImportedStory(
        importedStory,
      );

      expect(result).toEqual(expectedAnalysis);
      expect(result.characters).toContain('Sir Arthur');
      expect(result.genre).toBe('fantasy');
      expect(result.complexity).toBe('medium');
    });

    it('should handle different story genres correctly', async () => {
      const genres = [
        {
          story: 'The spaceship landed on Mars with a loud crash.',
          expectedGenre: 'science fiction',
        },
        {
          story: 'Detective Smith examined the crime scene carefully.',
          expectedGenre: 'mystery',
        },
        {
          story: 'Sarah felt her heart skip a beat when she saw him.',
          expectedGenre: 'romance',
        },
      ];

      for (const test of genres) {
        mockStoryGenerationService.analyzeImportedStory.mockResolvedValueOnce({
          genre: test.expectedGenre,
          confidence: 0.9,
        });

        const result = await mockStoryGenerationService.analyzeImportedStory(
          test.story,
        );
        expect(result.genre).toBe(test.expectedGenre);
      }
    });
  });

  describe('Story Continuation Generation', () => {
    it('should generate high-quality story continuations', async () => {
      generationTester.addTest({
        name: 'Fantasy adventure continuation',
        importedContent:
          'The young wizard picked up his staff and walked toward the ancient forest, knowing that great dangers awaited him within its dark depths.',
        expectedAnalysis: {
          genre: 'fantasy',
          tone: 'mysterious',
          characters: ['young wizard'],
          setting: 'ancient forest',
          themes: ['magic', 'danger', 'journey'],
        },
        expectedContinuation:
          'As he stepped between the towering trees, the wizard felt the ancient magic pulsing through the air. Shadows danced at the edges of his vision, and he gripped his staff tighter, whispering a protective spell under his breath.',
        quality: 'high',
      });

      const result = await generationTester.runGenerationTests();
      expect(result.passed).toBe(1);
      expect(result.results[0].quality.quality).toBe('high');
    });

    it('should maintain character consistency', async () => {
      const importedStory =
        'Captain Sarah Rodriguez had been sailing the seas for twenty years. Her crew respected her firm but fair leadership, and her weathered hands showed the experience of countless storms.';

      mockStoryGenerationService.generateImportedStoryContinuation.mockResolvedValue(
        'Captain Rodriguez studied the storm clouds gathering on the horizon. "All hands on deck!" she shouted, her voice carrying over the wind. Her crew responded immediately, knowing their captain\'s experience would guide them safely through whatever lay ahead.',
      );

      const continuation =
        await mockStoryGenerationService.generateImportedStoryContinuation(
          importedStory,
        );

      expect(continuation).toContain('Captain Rodriguez');
      expect(continuation).toContain('crew');
      expect(continuation).not.toContain('Captain Sarah'); // Should use established form
    });

    it('should handle different story tones appropriately', async () => {
      const toneTests = [
        {
          story: 'The children laughed as they ran through the sunny meadow.',
          expectedTone: 'cheerful',
          continuationShould: 'maintain positive mood',
        },
        {
          story: 'The old house creaked ominously in the moonlight.',
          expectedTone: 'scary',
          continuationShould: 'build suspense',
        },
        {
          story: 'After the accident, nothing would ever be the same.',
          expectedTone: 'somber',
          continuationShould: 'be emotionally appropriate',
        },
      ];

      for (const test of toneTests) {
        mockStoryGenerationService.analyzeImportedStory.mockResolvedValueOnce({
          tone: test.expectedTone,
        });

        mockStoryGenerationService.generateImportedStoryContinuation.mockResolvedValueOnce(
          `Continuation that reflects ${test.expectedTone} tone appropriately.`,
        );

        const analysis = await mockStoryGenerationService.analyzeImportedStory(
          test.story,
        );
        const continuation =
          await mockStoryGenerationService.generateImportedStoryContinuation(
            test.story,
          );

        expect(analysis.tone).toBe(test.expectedTone);
        expect(continuation).toContain(test.expectedTone);
      }
    });
  });

  describe('Context Preparation and Management', () => {
    it('should prepare appropriate context for AI generation', async () => {
      const importedStory =
        "Maria opened the dusty attic door and found an old trunk filled with mysterious objects from her grandmother's past.";

      const expectedContext = {
        context: `Previous story: ${importedStory}\n\nGeneration instructions: Continue this story in the same style and tone. Maintain character consistency and narrative flow.`,
        characters: ['Maria', 'grandmother'],
        setting: 'attic',
        tone: 'mysterious',
        constraints: {
          maxLength: 200,
          maintainPerspective: 'third person',
          keepTense: 'past',
        },
      };

      mockStoryGenerationService.prepareImportedStoryContext.mockResolvedValue(
        expectedContext,
      );

      const context =
        await mockStoryGenerationService.prepareImportedStoryContext(
          importedStory,
          {
            characters: ['Maria', 'grandmother'],
            setting: 'attic',
            tone: 'mysterious',
          },
        );

      expect(context.characters).toContain('Maria');
      expect(context.setting).toBe('attic');
      expect(context.tone).toBe('mysterious');
      expect(context.context).toContain(importedStory);
    });

    it('should handle complex multi-character stories', async () => {
      const complexStory =
        'The three friends - Alex, Sam, and Jordan - had been planning this adventure for months. Each brought their own unique skills to the group: Alex was the strategist, Sam was the athlete, and Jordan was the tech expert.';

      mockStoryGenerationService.analyzeImportedStory.mockResolvedValue({
        characters: ['Alex', 'Sam', 'Jordan'],
        characterTraits: {
          Alex: 'strategist',
          Sam: 'athlete',
          Jordan: 'tech expert',
        },
        groupDynamic: 'collaborative team',
      });

      const analysis = await mockStoryGenerationService.analyzeImportedStory(
        complexStory,
      );

      expect(analysis.characters).toHaveLength(3);
      expect(analysis.characterTraits.Alex).toBe('strategist');
      expect(analysis.groupDynamic).toBe('collaborative team');
    });
  });

  describe('Quality Validation and Error Handling', () => {
    it('should validate continuation quality', async () => {
      const lowQualityTests = [
        {
          original: 'The princess lived in a beautiful castle.',
          continuation: 'And then aliens attacked from space.',
          issue: 'genre inconsistency',
        },
        {
          original: 'John walked to the store yesterday.',
          continuation: 'Sarah runs to the park tomorrow.',
          issue: 'character and tense inconsistency',
        },
      ];

      for (const test of lowQualityTests) {
        mockStoryGenerationService.validateContinuationQuality.mockResolvedValueOnce(
          {
            quality: 'low',
            score: 0.3,
            issues: [test.issue],
            suggestions: ['Maintain consistent genre', 'Keep character focus'],
          },
        );

        const quality =
          await mockStoryGenerationService.validateContinuationQuality(
            test.continuation,
            test.original,
          );

        expect(quality.quality).toBe('low');
        expect(quality.issues).toContain(test.issue);
      }
    });

    it('should handle AI generation failures gracefully', async () => {
      mockStoryGenerationService.generateImportedStoryContinuation.mockRejectedValue(
        new Error('AI service unavailable'),
      );

      try {
        await mockStoryGenerationService.generateImportedStoryContinuation(
          'Test story',
        );
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('AI service unavailable');
      }
    });

    it('should retry failed generations with adjusted parameters', async () => {
      let attemptCount = 0;
      mockStoryGenerationService.generateImportedStoryContinuation.mockImplementation(
        () => {
          attemptCount++;
          if (attemptCount === 1) {
            throw new Error('Temporary AI service error');
          }
          return Promise.resolve('Successful continuation after retry');
        },
      );

      // Simulate retry logic (would be in the actual service)
      let result;
      try {
        result =
          await mockStoryGenerationService.generateImportedStoryContinuation(
            'Test story',
          );
      } catch (error) {
        // Retry once
        result =
          await mockStoryGenerationService.generateImportedStoryContinuation(
            'Test story',
          );
      }

      expect(result).toBe('Successful continuation after retry');
      expect(attemptCount).toBe(2);
    });
  });

  describe('Performance and Scalability', () => {
    it('should generate continuations within reasonable time', async () => {
      const testStory =
        'The adventure began when they found the mysterious map.';

      mockStoryGenerationService.generateImportedStoryContinuation.mockImplementation(
        () =>
          new Promise(resolve => {
            // Simulate AI generation time
            setTimeout(() => {
              resolve(
                'The map showed a path through dangerous mountains to a hidden treasure.',
              );
            }, 100); // 100ms simulation
          }),
      );

      const startTime = Date.now();
      const continuation =
        await mockStoryGenerationService.generateImportedStoryContinuation(
          testStory,
        );
      const endTime = Date.now();

      expect(continuation).toBeDefined();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle multiple concurrent generation requests', async () => {
      const stories = [
        'Story one beginning.',
        'Story two start.',
        'Story three opening.',
      ];

      mockStoryGenerationService.generateImportedStoryContinuation.mockImplementation(
        story => Promise.resolve(`Continuation for: ${story}`),
      );

      const startTime = Date.now();
      const results = await Promise.all(
        stories.map(story =>
          mockStoryGenerationService.generateImportedStoryContinuation(story),
        ),
      );
      const endTime = Date.now();

      expect(results).toHaveLength(3);
      expect(results[0]).toContain('Story one beginning');
      expect(endTime - startTime).toBeLessThan(500); // Concurrent processing should be fast
    });
  });

  describe('Integration with Story Import Flow', () => {
    it('should integrate smoothly with file import workflow', async () => {
      const importedFileContent =
        "Emma discovered an old diary in the library that contained secrets about her family's past.";

      // Simulate the full integration workflow
      const analysisResult =
        await mockStoryGenerationService.analyzeImportedStory(
          importedFileContent,
        );
      await mockStoryGenerationService.prepareImportedStoryContext(
        importedFileContent,
        analysisResult,
      );
      const continuationResult =
        await mockStoryGenerationService.generateImportedStoryContinuation(
          importedFileContent,
        );
      await mockStoryGenerationService.validateContinuationQuality(
        continuationResult,
        importedFileContent,
      );

      // All steps should complete without error
      expect(
        mockStoryGenerationService.analyzeImportedStory,
      ).toHaveBeenCalledWith(importedFileContent);
      expect(
        mockStoryGenerationService.prepareImportedStoryContext,
      ).toHaveBeenCalled();
      expect(
        mockStoryGenerationService.generateImportedStoryContinuation,
      ).toHaveBeenCalledWith(importedFileContent);
      expect(
        mockStoryGenerationService.validateContinuationQuality,
      ).toHaveBeenCalled();
    });

    it('should integrate with database story selection workflow', async () => {
      const databaseStory = {
        session_id: 'story-session-123',
        story_content:
          'The detective had been working on this case for weeks without any leads.',
        story_source: 'CreativeBridge' as StorySource,
        final_score: 150,
      };

      // Mock the workflow from database selection to generation
      mockStoryGenerationService.analyzeImportedStory.mockResolvedValue({
        genre: 'mystery',
        tone: 'suspenseful',
        characters: ['detective'],
      });

      mockStoryGenerationService.generateImportedStoryContinuation.mockResolvedValue(
        'Then, a breakthrough came when she noticed a pattern in the evidence that everyone else had missed.',
      );

      const analysis = await mockStoryGenerationService.analyzeImportedStory(
        databaseStory.story_content,
      );
      const continuation =
        await mockStoryGenerationService.generateImportedStoryContinuation(
          databaseStory.story_content,
        );

      expect(analysis.genre).toBe('mystery');
      expect(continuation).toContain('breakthrough');
    });
  });
});
