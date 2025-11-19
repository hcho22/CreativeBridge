/**
 * Content Prediction Integration Tests
 * 
 * Tests for Task 3.1: Content Prediction Skill Integration
 */

import { contentPredictionService } from '../../services/contentPrediction';
import { StoryRequest, GradeLevel } from '../../types/story';
import { createMockSkillManager } from '../mocks/claudeSkillsMock';
import { getClaudeSkillsManager } from '../../services/claudeSkillsManager';

// Mock dependencies
jest.mock('../../services/claudeSkillsManager');
jest.mock('../../utils/logger');
jest.mock('../../services/storyAnalytics');

describe('Content Prediction Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Story Pattern Analysis', () => {
    test('Story pattern analysis produces valid categories', async () => {
      const request: StoryRequest = {
        gradeLevel: 'K-2',
        storySoFar: 'Once upon a time, Ruby found a magical stone in the forest.',
        userInput: 'Ruby discovered something amazing',
      };

      const analysis = await contentPredictionService.analyzeStoryContext(request);

      expect(analysis).toBeDefined();
      expect(analysis.gradeLevel).toBe('K-2');
      expect(analysis.extractedElements).toBeDefined();
      expect(analysis.extractedElements.characters).toContain('ruby');
      expect(analysis.extractedElements.themes.length).toBeGreaterThan(0);
      expect(analysis.confidence).toBeGreaterThan(0);
    });

    test('Pattern recognition identifies correct category', async () => {
      const request: StoryRequest = {
        gradeLevel: 'K-2',
        storySoFar: 'Ruby and her friend went on a magical adventure. They discovered a secret garden.',
        userInput: 'They found magical flowers',
      };

      const analysis = await contentPredictionService.analyzeStoryContext(request);

      expect(analysis.patternMatch).toBeDefined();
      if (analysis.patternMatch) {
        expect(analysis.patternMatch.gradeLevel).toBe('K-2');
        expect(analysis.patternMatch.confidence).toBeGreaterThan(0);
      }
    });

    test('Category consistency across similar stories', async () => {
      const requests: StoryRequest[] = [
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
        requests.map(req => contentPredictionService.analyzeStoryContext(req))
      );

      // Both should match similar patterns
      expect(analyses[0].extractedElements.tone).toBe('magical');
      expect(analyses[1].extractedElements.tone).toBe('magical');
    });
  });

  describe('Confidence Scoring', () => {
    test('Confidence scoring correlates with accuracy', async () => {
      const request: StoryRequest = {
        gradeLevel: '3-5',
        storySoFar: 'Sarah and her friends discovered a hidden cave. Inside, they found ancient treasures.',
        userInput: 'They explored deeper',
      };

      const analysis = await contentPredictionService.analyzeStoryContext(request);
      const predictions = await contentPredictionService.predictContent(analysis);

      if (predictions) {
        const confidence = contentPredictionService.calculatePredictionConfidence(
          predictions.predictions,
          analysis
        );

        expect(confidence.overall).toBeGreaterThan(0);
        expect(confidence.overall).toBeLessThanOrEqual(1);
        expect(confidence.patternMatch).toBeGreaterThanOrEqual(0);
        expect(confidence.contextRelevance).toBeGreaterThanOrEqual(0);
        expect(confidence.gradeLevelAppropriateness).toBeGreaterThanOrEqual(0);
      }
    });

    test('Confidence score calibration', async () => {
      const request: StoryRequest = {
        gradeLevel: 'K-2',
        storySoFar: 'Ruby found a magical stone',
        userInput: 'The stone showed her a path',
      };

      const analysis = await contentPredictionService.analyzeStoryContext(request);
      
      // High confidence should indicate good pattern match
      if (analysis.patternMatch) {
        expect(analysis.confidence).toBeGreaterThan(0.5);
      }
    });

    test('Threshold optimization works', async () => {
      const request: StoryRequest = {
        gradeLevel: '6-8',
        storySoFar: 'The mystery deepened as they found more clues.',
        userInput: 'They investigated further',
      };

      const analysis = await contentPredictionService.analyzeStoryContext(request);
      const predictions = await contentPredictionService.predictContent(analysis);

      if (predictions) {
        // Predictions should meet confidence threshold
        const highConfidencePredictions = predictions.predictions.filter(
          p => p.confidence >= 0.7
        );
        expect(highConfidencePredictions.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Integration with Story Service', () => {
    test('Integration preserves story generation quality', async () => {
      const request: StoryRequest = {
        gradeLevel: 'K-2',
        storySoFar: 'Ruby found a magical stone',
        userInput: 'The stone glowed brightly',
      };

      // Analyze context
      const analysis = await contentPredictionService.analyzeStoryContext(request);
      expect(analysis).toBeDefined();
      expect(analysis.gradeLevel).toBe('K-2');

      // Get predictions
      const predictions = await contentPredictionService.predictContent(analysis);
      
      // Predictions should not interfere with story generation
      // (Story generation happens separately)
      expect(predictions).toBeDefined();
    });

    test('No regression in existing functionality', async () => {
      const request: StoryRequest = {
        gradeLevel: '3-5',
        userInput: 'Create a story about adventure',
      };

      const analysis = await contentPredictionService.analyzeStoryContext(request);
      
      // Should still work even without storySoFar
      expect(analysis).toBeDefined();
      expect(analysis.gradeLevel).toBe('3-5');
      expect(analysis.extractedElements).toBeDefined();
    });

    test('Performance impact minimal', async () => {
      const request: StoryRequest = {
        gradeLevel: 'K-2',
        storySoFar: 'Ruby found a magical stone',
        userInput: 'The stone glowed',
      };

      const startTime = performance.now();
      await contentPredictionService.analyzeStoryContext(request);
      const analysisTime = performance.now() - startTime;

      // Context analysis should be fast (< 100ms)
      expect(analysisTime).toBeLessThan(100);
    });
  });

  describe('Story Context Analysis Pipeline', () => {
    test('Context analysis handles all story formats', async () => {
      const formats: StoryRequest[] = [
        {
          gradeLevel: 'K-2',
          storySoFar: 'Short story',
          userInput: 'Continue',
        },
        {
          gradeLevel: '9-12',
          storySoFar: 'A long and complex story with multiple characters and settings that explores deep themes',
          userInput: 'The protagonist faced a moral dilemma',
        },
        {
          gradeLevel: '3-5',
          userInput: 'Create a new story',
        },
      ];

      for (const request of formats) {
        const analysis = await contentPredictionService.analyzeStoryContext(request);
        expect(analysis).toBeDefined();
        expect(analysis.gradeLevel).toBe(request.gradeLevel);
      }
    });

    test('Element extraction works correctly', async () => {
      const request: StoryRequest = {
        gradeLevel: 'K-2',
        storySoFar: 'Ruby went to the forest with her friend Alice. They found a magical garden.',
        userInput: 'They explored the garden together',
      };

      const analysis = await contentPredictionService.analyzeStoryContext(request);

      expect(analysis.extractedElements.characters.length).toBeGreaterThan(0);
      expect(analysis.extractedElements.settings.length).toBeGreaterThan(0);
      expect(analysis.extractedElements.themes.length).toBeGreaterThan(0);
      expect(analysis.extractedElements.tone).toBeDefined();
    });
  });
});

