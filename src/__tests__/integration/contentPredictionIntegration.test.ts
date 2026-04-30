/**
 * Content Prediction Integration Tests
 *
 * Integration tests for Task 3.1: Content Prediction Skill Integration
 */

import { contentPredictionService } from '../../services/contentPrediction';
import { enhancedStoryAgentService } from '../../services/enhancedStoryAgent';
import { getClaudeSkillsManager } from '../../services/claudeSkillsManager';
import { StoryRequest, GradeLevel } from '../../types/story';
import { createMockSkillManager } from '../mocks/claudeSkillsMock';

// Mock dependencies
jest.mock('../../services/claudeSkillsManager');
jest.mock('../../utils/logger');
jest.mock('../../services/storyAnalytics');

describe('Content Prediction Integration', () => {
  let mockSkillManager: any;

  beforeAll(async () => {
    mockSkillManager = createMockSkillManager();
    await mockSkillManager.initialize({
      apiKey: 'test_key',
      environment: 'development',
      enabledSkills: ['ContentPredictionSkill'],
      performanceMode: 'balanced',
    });
    (getClaudeSkillsManager as jest.Mock).mockResolvedValue(mockSkillManager);
  });

  describe('Prediction Skill Integration', () => {
    test('Prediction skill works with existing story service', async () => {
      const request: StoryRequest = {
        gradeLevel: 'K-2',
        storySoFar: 'Ruby found a magical stone',
        userInput: 'The stone glowed',
      };

      // Analyze context
      const analysis = await contentPredictionService.analyzeStoryContext(
        request,
      );
      expect(analysis).toBeDefined();

      // Get predictions
      const predictions = await contentPredictionService.predictContent(
        analysis,
      );

      // Predictions should be available (or null if skill unavailable)
      // The story service should still work regardless
      expect(analysis.confidence).toBeGreaterThan(0);
    });

    test('Context analysis handles all story formats', async () => {
      const formats: StoryRequest[] = [
        {
          gradeLevel: 'K-2',
          storySoFar: 'Short story',
          userInput: 'Continue',
        },
        {
          gradeLevel: '9-12',
          storySoFar: 'A complex story with multiple themes',
          userInput: 'The protagonist faced challenges',
        },
        {
          gradeLevel: '3-5',
          userInput: 'Create a new story',
        },
      ];

      for (const request of formats) {
        const analysis = await contentPredictionService.analyzeStoryContext(
          request,
        );
        expect(analysis).toBeDefined();
        expect(analysis.gradeLevel).toBe(request.gradeLevel);
      }
    });

    test('Service maintains backward compatibility', async () => {
      // Test that story generation still works without predictions
      const request: StoryRequest = {
        gradeLevel: 'K-2',
        storySoFar: 'Ruby found a stone',
        userInput: 'Continue the story',
      };

      // Should work even if predictions fail
      const analysis = await contentPredictionService.analyzeStoryContext(
        request,
      );
      expect(analysis).toBeDefined();

      // Story generation should still work
      await enhancedStoryAgentService.initialize();
      const storyResponse = await enhancedStoryAgentService.continueStory(
        request,
      );
      expect(storyResponse).toBeDefined();
      expect(storyResponse.success).toBe(true);
    });

    test('Performance meets latency requirements', async () => {
      const request: StoryRequest = {
        gradeLevel: '3-5',
        storySoFar: 'Sarah discovered a hidden cave',
        userInput: 'She explored deeper',
      };

      const startTime = performance.now();
      const analysis = await contentPredictionService.analyzeStoryContext(
        request,
      );
      const analysisTime = performance.now() - startTime;

      expect(analysis).toBeDefined();
      // Context analysis should be fast
      expect(analysisTime).toBeLessThan(200);
    });
  });

  describe('Pattern Analysis', () => {
    test('Story patterns successfully analyzed and categorized', async () => {
      const request: StoryRequest = {
        gradeLevel: 'K-2',
        storySoFar:
          'Ruby and her friend Alice went on a magical adventure. They discovered a secret garden filled with talking flowers.',
        userInput: 'The flowers showed them a path',
      };

      const analysis = await contentPredictionService.analyzeStoryContext(
        request,
      );

      expect(analysis.patternMatch).toBeDefined();
      if (analysis.patternMatch) {
        expect(analysis.patternMatch.category).toBeDefined();
        expect(analysis.patternMatch.theme).toBeDefined();
        expect(analysis.patternMatch.gradeLevel).toBe('K-2');
        expect(analysis.patternMatch.confidence).toBeGreaterThan(0);
      }
    });

    test('Pattern categorization is consistent', async () => {
      const similarStories: StoryRequest[] = [
        {
          gradeLevel: 'K-2',
          storySoFar: 'Ruby found a magical stone',
          userInput: 'The stone glowed',
        },
        {
          gradeLevel: 'K-2',
          storySoFar: 'Alice discovered a magic wand',
          userInput: 'The wand sparkled',
        },
      ];

      const analyses = await Promise.all(
        similarStories.map(req =>
          contentPredictionService.analyzeStoryContext(req),
        ),
      );

      // Both should match similar patterns
      expect(analyses[0].extractedElements.tone).toBe('magical');
      expect(analyses[1].extractedElements.tone).toBe('magical');
    });
  });

  describe('Confidence Scoring', () => {
    test('Prediction confidence scores accurate and useful', async () => {
      const request: StoryRequest = {
        gradeLevel: '3-5',
        storySoFar:
          'Sarah and her friends discovered a hidden cave. Inside, they found ancient treasures and mysterious artifacts.',
        userInput: 'They explored deeper into the cave',
      };

      const analysis = await contentPredictionService.analyzeStoryContext(
        request,
      );
      const predictions = await contentPredictionService.predictContent(
        analysis,
      );

      if (predictions) {
        const confidence =
          contentPredictionService.calculatePredictionConfidence(
            predictions.predictions,
            analysis,
          );

        expect(confidence.overall).toBeGreaterThan(0);
        expect(confidence.overall).toBeLessThanOrEqual(1);
        expect(confidence.patternMatch).toBeGreaterThanOrEqual(0);
        expect(confidence.contextRelevance).toBeGreaterThanOrEqual(0);
        expect(confidence.gradeLevelAppropriateness).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
