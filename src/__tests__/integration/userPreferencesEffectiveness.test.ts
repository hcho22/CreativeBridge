/**
 * User Preferences Effectiveness Tests
 * 
 * Tests personalization effectiveness and learning improvements over time
 */

import { userPreferencesService } from '../../services/userPreferences';
import { secureStorage } from '../../utils/secureStorage';
import { StoryRequest, StoryResponse } from '../../types/story';

jest.mock('../../utils/secureStorage');
jest.mock('../../utils/logger', () => ({
  structuredLogger: {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

const mockSecureStorage = secureStorage as jest.Mocked<typeof secureStorage>;

describe('User Preferences Effectiveness', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (userPreferencesService as any).personalizationData = null;
    (userPreferencesService as any).isInitialized = false;
    mockSecureStorage.get.mockResolvedValue(null);
    mockSecureStorage.set.mockResolvedValue(undefined);
  });

  describe('Personalization Improvement Over Time', () => {
    test('should improve content relevance with more interactions', async () => {
      await userPreferencesService.initialize('Grade3');

      const storyRequests = [
        { userInput: 'adventure with dragons', rating: 5 },
        { userInput: 'magical quest story', rating: 5 },
        { userInput: 'dragon adventure tale', rating: 4 },
        { userInput: 'fantasy adventure', rating: 5 },
        { userInput: 'epic dragon story', rating: 4 },
        { userInput: 'boring math story', rating: 1 },
        { userInput: 'science homework help', rating: 1 },
      ];

      // Simulate user interactions over time
      for (const { userInput, rating } of storyRequests) {
        const request: StoryRequest = {
          gradeLevel: 'Grade3',
          userInput,
        };

        const response: StoryResponse = {
          story: `A ${userInput} story...`,
          success: true,
          gradeLevel: 'Grade3',
        };

        await userPreferencesService.updatePreferencesFromStoryFeedback(request, response, rating);
      }

      const recommendations = userPreferencesService.getPersonalizedRecommendations({
        gradeLevel: 'Grade3',
      });

      // Should now prefer adventure and fantasy themes
      expect(recommendations.recommendedThemes).toContain('adventure');
      expect(recommendations.recommendedThemes).toContain('fantasy');
      expect(recommendations.confidenceScore).toBeGreaterThan(0.3);

      const data = userPreferencesService.getPreferencesData();
      expect(data?.storyPreferences.themes.adventure).toBeGreaterThan(0.7);
      expect(data?.storyPreferences.themes.fantasy).toBeGreaterThan(0.7);
    });

    test('should adapt to changing user preferences', async () => {
      await userPreferencesService.initialize('Grade3');

      // Phase 1: User likes adventure stories
      const adventureStories = [
        { userInput: 'adventure story', rating: 5 },
        { userInput: 'exploration tale', rating: 5 },
        { userInput: 'treasure hunt', rating: 4 },
      ];

      for (const { userInput, rating } of adventureStories) {
        const request: StoryRequest = { gradeLevel: 'Grade3', userInput };
        const response: StoryResponse = {
          story: `A ${userInput}...`,
          success: true,
          gradeLevel: 'Grade3',
        };
        await userPreferencesService.updatePreferencesFromStoryFeedback(request, response, rating);
      }

      let recommendations = userPreferencesService.getPersonalizedRecommendations({
        gradeLevel: 'Grade3',
      });
      expect(recommendations.recommendedThemes).toContain('adventure');

      // Phase 2: User shifts to science fiction
      const sciFiStories = [
        { userInput: 'space adventure', rating: 5 },
        { userInput: 'robot story', rating: 5 },
        { userInput: 'space exploration', rating: 5 },
        { userInput: 'future technology', rating: 4 },
        { userInput: 'adventure story', rating: 2 }, // Now rates adventure lower
      ];

      for (const { userInput, rating } of sciFiStories) {
        const request: StoryRequest = { gradeLevel: 'Grade3', userInput };
        const response: StoryResponse = {
          story: `A ${userInput}...`,
          success: true,
          gradeLevel: 'Grade3',
        };
        await userPreferencesService.updatePreferencesFromStoryFeedback(request, response, rating);
      }

      recommendations = userPreferencesService.getPersonalizedRecommendations({
        gradeLevel: 'Grade3',
      });

      // Should now prefer sci-fi over pure adventure
      expect(recommendations.recommendedThemes).toContain('sci-fi');

      const data = userPreferencesService.getPreferencesData();
      expect(data?.storyPreferences.themes['sci-fi']).toBeGreaterThan(0.6);
    });

    test('should show learning improvement trend', async () => {
      await userPreferencesService.initialize('Grade3');

      // Simulate improving user ratings over time
      const improvingRatings = [2, 2, 3, 3, 3, 4, 4, 4, 5, 5];

      for (const rating of improvingRatings) {
        const request: StoryRequest = {
          gradeLevel: 'Grade3',
          userInput: 'story',
        };

        const response: StoryResponse = {
          story: 'A story...',
          success: true,
          gradeLevel: 'Grade3',
        };

        await userPreferencesService.updatePreferencesFromStoryFeedback(request, response, rating);
      }

      const data = userPreferencesService.getPreferencesData();
      expect(data?.learningMetrics.improvementTrend).toBeGreaterThan(0);
      expect(data?.learningMetrics.sessionCount).toBe(improvingRatings.length);
    });
  });

  describe('Session Pattern Recognition', () => {
    test('should track completion rate improvements', async () => {
      await userPreferencesService.initialize('Grade3');

      // Simulate sessions with varying completion rates
      const sessionData = [
        // Session 1: Low completion
        { requests: 5, completions: 2 },
        // Session 2: Better completion  
        { requests: 4, completions: 3 },
        // Session 3: High completion
        { requests: 3, completions: 3 },
      ];

      for (const session of sessionData) {
        // Record requests
        for (let i = 0; i < session.requests; i++) {
          await userPreferencesService.recordInteraction('story_request', {
            gradeLevel: 'Grade3',
          });
        }

        // Record completions
        for (let i = 0; i < session.completions; i++) {
          await userPreferencesService.recordInteraction('story_completion', {
            gradeLevel: 'Grade3',
            duration: 180,
          });
        }
      }

      const data = userPreferencesService.getPreferencesData();
      const totalRequests = sessionData.reduce((sum, s) => sum + s.requests, 0);
      const totalCompletions = sessionData.reduce((sum, s) => sum + s.completions, 0);
      
      expect(data?.sessionPatterns.completionRate).toBeCloseTo(totalCompletions / totalRequests, 1);
    });

    test('should calculate engagement score based on recent activity', async () => {
      await userPreferencesService.initialize('Grade3');

      // Record high engagement (many completions)
      for (let i = 0; i < 15; i++) {
        await userPreferencesService.recordInteraction('story_completion', {
          gradeLevel: 'Grade3',
          duration: 200,
        });
      }

      const data = userPreferencesService.getPreferencesData();
      expect(data?.sessionPatterns.engagementScore).toBeGreaterThan(0.8);
    });
  });

  describe('Recommendation Quality', () => {
    test('should provide higher confidence with more data', async () => {
      await userPreferencesService.initialize('Grade3');

      // Get initial recommendations (should be low confidence)
      let recommendations = userPreferencesService.getPersonalizedRecommendations({
        gradeLevel: 'Grade3',
      });
      const initialConfidence = recommendations.confidenceScore;

      // Build up data through interactions
      for (let i = 0; i < 20; i++) {
        await userPreferencesService.recordInteraction('story_request', {
          gradeLevel: 'Grade3',
        });

        const request: StoryRequest = {
          gradeLevel: 'Grade3',
          userInput: 'consistent adventure story',
        };

        const response: StoryResponse = {
          story: 'An adventure story...',
          success: true,
          gradeLevel: 'Grade3',
        };

        await userPreferencesService.updatePreferencesFromStoryFeedback(request, response, 4);
      }

      // Get updated recommendations
      recommendations = userPreferencesService.getPersonalizedRecommendations({
        gradeLevel: 'Grade3',
      });

      expect(recommendations.confidenceScore).toBeGreaterThan(initialConfidence);
      expect(recommendations.confidenceScore).toBeGreaterThan(0.5);
    });

    test('should provide consistent recommendations for similar preferences', async () => {
      await userPreferencesService.initialize('Grade3');

      // Build consistent preferences
      const consistentRatings = [4, 4, 4, 4, 4, 4, 4, 4];

      for (const rating of consistentRatings) {
        const request: StoryRequest = {
          gradeLevel: 'Grade3',
          userInput: 'adventure story',
        };

        const response: StoryResponse = {
          story: 'An adventure...',
          success: true,
          gradeLevel: 'Grade3',
        };

        await userPreferencesService.updatePreferencesFromStoryFeedback(request, response, rating);
      }

      const data = userPreferencesService.getPreferencesData();
      expect(data?.learningMetrics.consistencyScore).toBeGreaterThan(0.8);

      // Multiple calls should give similar results
      const rec1 = userPreferencesService.getPersonalizedRecommendations({ gradeLevel: 'Grade3' });
      const rec2 = userPreferencesService.getPersonalizedRecommendations({ gradeLevel: 'Grade3' });
      
      expect(rec1.recommendedThemes).toEqual(rec2.recommendedThemes);
      expect(rec1.recommendedComplexity).toEqual(rec2.recommendedComplexity);
    });
  });

  describe('Cross-Session Persistence', () => {
    test('should maintain preferences across app sessions', async () => {
      // First session
      await userPreferencesService.initialize('Grade3');

      const request: StoryRequest = {
        gradeLevel: 'Grade3',
        userInput: 'dragon adventure',
      };

      const response: StoryResponse = {
        story: 'A dragon adventure...',
        success: true,
        gradeLevel: 'Grade3',
      };

      await userPreferencesService.updatePreferencesFromStoryFeedback(request, response, 5);

      const firstSessionData = userPreferencesService.getPreferencesData();
      const dragonPreference = firstSessionData?.storyPreferences.themes.adventure;

      // Simulate app restart by resetting service and mocking stored data
      (userPreferencesService as any).personalizationData = null;
      (userPreferencesService as any).isInitialized = false;

      mockSecureStorage.get.mockResolvedValue(firstSessionData);

      // Second session
      await userPreferencesService.initialize('Grade3');

      const secondSessionData = userPreferencesService.getPreferencesData();
      expect(secondSessionData?.storyPreferences.themes.adventure).toEqual(dragonPreference);
    });

    test('should continue learning from previous sessions', async () => {
      // Create initial data with some preferences
      const initialData = {
        userId: 'test-user',
        gradeLevel: 'Grade3' as const,
        storyPreferences: {
          themes: { adventure: 0.7, fantasy: 0.6 },
          characters: {},
          settings: {},
          tones: {},
          complexity: { medium: 0.8 },
          genres: {},
        },
        sessionPatterns: {
          averageSessionDuration: 300,
          storiesPerSession: 2.5,
          preferredTimeOfDay: ['afternoon'],
          completionRate: 0.8,
          retryPattern: 0.2,
          engagementScore: 0.75,
        },
        learningMetrics: {
          improvementTrend: 0.1,
          consistencyScore: 0.8,
          explorationScore: 0.6,
          lastUpdated: Date.now() - 1000 * 60 * 60, // 1 hour ago
          sessionCount: 5,
        },
        interactions: [],
        version: '1.0',
        createdAt: Date.now() - 1000 * 60 * 60 * 24,
        updatedAt: Date.now() - 1000 * 60 * 60,
      };

      mockSecureStorage.get.mockResolvedValue(initialData);

      await userPreferencesService.initialize('Grade3');

      // Add more feedback
      const request: StoryRequest = {
        gradeLevel: 'Grade3',
        userInput: 'adventure quest',
      };

      const response: StoryResponse = {
        story: 'An adventure quest...',
        success: true,
        gradeLevel: 'Grade3',
      };

      await userPreferencesService.updatePreferencesFromStoryFeedback(request, response, 5);

      const updatedData = userPreferencesService.getPreferencesData();
      
      // Adventure preference should have increased from previous 0.7
      expect(updatedData?.storyPreferences.themes.adventure).toBeGreaterThan(0.7);
      expect(updatedData?.learningMetrics.sessionCount).toBeGreaterThan(5);
    });
  });

  describe('Performance and Efficiency', () => {
    test('should handle large interaction histories efficiently', async () => {
      // Set config to allow more interactions for this test
      (userPreferencesService as any).config.maxInteractionHistory = 1000;

      await userPreferencesService.initialize('Grade3');

      const startTime = Date.now();

      // Record many interactions
      for (let i = 0; i < 500; i++) {
        await userPreferencesService.recordInteraction('story_request', {
          gradeLevel: 'Grade3',
          requestIndex: i,
        });
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should complete in reasonable time (less than 5 seconds for 500 interactions)
      expect(totalTime).toBeLessThan(5000);

      const data = userPreferencesService.getPreferencesData();
      expect(data?.interactions.length).toBe(500);
    });

    test('should limit interaction history size to prevent memory issues', async () => {
      // Set small limit for testing
      (userPreferencesService as any).config.maxInteractionHistory = 10;

      await userPreferencesService.initialize('Grade3');

      // Record more interactions than limit
      for (let i = 0; i < 20; i++) {
        await userPreferencesService.recordInteraction('story_request', {
          gradeLevel: 'Grade3',
          requestIndex: i,
        });
      }

      const data = userPreferencesService.getPreferencesData();
      expect(data?.interactions.length).toBe(10);
      
      // Should keep most recent interactions
      const lastInteraction = data?.interactions[data.interactions.length - 1];
      expect(lastInteraction?.context.requestIndex).toBe(19);
    });
  });

  describe('Edge Cases and Robustness', () => {
    test('should handle inconsistent user behavior gracefully', async () => {
      await userPreferencesService.initialize('Grade3');

      // Simulate very inconsistent ratings
      const inconsistentRatings = [1, 5, 1, 5, 1, 5, 1, 5];

      for (const rating of inconsistentRatings) {
        const request: StoryRequest = {
          gradeLevel: 'Grade3',
          userInput: 'adventure story',
        };

        const response: StoryResponse = {
          story: 'An adventure...',
          success: true,
          gradeLevel: 'Grade3',
        };

        await userPreferencesService.updatePreferencesFromStoryFeedback(request, response, rating);
      }

      const data = userPreferencesService.getPreferencesData();
      
      // Consistency score should be low
      expect(data?.learningMetrics.consistencyScore).toBeLessThan(0.3);
      
      // But service should still function
      const recommendations = userPreferencesService.getPersonalizedRecommendations({
        gradeLevel: 'Grade3',
      });
      expect(recommendations.confidenceScore).toBeGreaterThan(0);
    });

    test('should handle rapid grade level changes', async () => {
      await userPreferencesService.initialize('Grade1');

      // Build some preferences for Grade 1
      await userPreferencesService.recordInteraction('story_request', {
        gradeLevel: 'Grade1',
      });

      // Change to Grade 5
      await userPreferencesService.initialize('Grade5');

      const data = userPreferencesService.getPreferencesData();
      expect(data?.gradeLevel).toBe('Grade5');
      
      // Should still maintain learning metrics
      expect(data?.learningMetrics.sessionCount).toBeGreaterThanOrEqual(1);
    });

    test('should provide reasonable fallbacks when no data available', async () => {
      // Don't initialize the service
      const recommendations = userPreferencesService.getPersonalizedRecommendations({
        gradeLevel: 'Grade3',
      });

      expect(recommendations.recommendedThemes).toEqual(['adventure', 'friendship', 'discovery']);
      expect(recommendations.recommendedComplexity).toBe('medium');
      expect(recommendations.confidenceScore).toBeLessThan(0.2);
    });
  });
});