/**
 * User Preferences Service Tests
 * 
 * Task 3.3-TEST: Cross-Session Personalization Testing
 */

import { userPreferencesService, PersonalizationData } from '../../services/userPreferences';
import { secureStorage } from '../../utils/secureStorage';
import { StoryRequest, StoryResponse } from '../../types/story';
import { GradeLevel } from '../../types/database';

// Mock secure storage
jest.mock('../../utils/secureStorage');
const mockSecureStorage = secureStorage as jest.Mocked<typeof secureStorage>;

// Mock logger
jest.mock('../../utils/logger', () => ({
  structuredLogger: {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('User Preferences Service', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Reset service state
    (userPreferencesService as any).personalizationData = null;
    (userPreferencesService as any).isInitialized = false;
  });

  describe('Initialization', () => {
    test('should initialize with new user data when no existing data', async () => {
      mockSecureStorage.get.mockResolvedValue(null);
      mockSecureStorage.set.mockResolvedValue(undefined);

      await userPreferencesService.initialize('Grade3');

      expect(mockSecureStorage.get).toHaveBeenCalledWith('user_personalization_data');
      expect(mockSecureStorage.set).toHaveBeenCalledWith(
        'user_personalization_data',
        expect.objectContaining({
          gradeLevel: 'Grade3',
          version: '1.0',
          storyPreferences: expect.any(Object),
          learningMetrics: expect.any(Object),
        })
      );
    });

    test('should load existing valid personalization data', async () => {
      const existingData: PersonalizationData = {
        userId: 'test-user-123',
        gradeLevel: 'Grade3',
        storyPreferences: {
          themes: { adventure: 0.8, friendship: 0.6 },
          characters: {},
          settings: {},
          tones: {},
          complexity: { medium: 0.7 },
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
          sessionCount: 10,
        },
        interactions: [],
        version: '1.0',
        createdAt: Date.now() - 1000 * 60 * 60 * 24 * 7, // 1 week ago
        updatedAt: Date.now() - 1000 * 60 * 60, // 1 hour ago
      };

      mockSecureStorage.get.mockResolvedValue(existingData);

      await userPreferencesService.initialize('Grade3');

      expect(mockSecureStorage.get).toHaveBeenCalled();
      // Should not create new data since existing data is valid
      expect(mockSecureStorage.set).not.toHaveBeenCalled();
    });

    test('should update grade level when existing data has different grade', async () => {
      const existingData: PersonalizationData = {
        userId: 'test-user-123',
        gradeLevel: 'Grade2',
        storyPreferences: {
          themes: { adventure: 0.8 },
          characters: {},
          settings: {},
          tones: {},
          complexity: {},
          genres: {},
        },
        sessionPatterns: {
          averageSessionDuration: 0,
          storiesPerSession: 0,
          preferredTimeOfDay: [],
          completionRate: 0,
          retryPattern: 0,
          engagementScore: 0.5,
        },
        learningMetrics: {
          improvementTrend: 0,
          consistencyScore: 0.5,
          explorationScore: 0.5,
          lastUpdated: Date.now(),
          sessionCount: 5,
        },
        interactions: [],
        version: '1.0',
        createdAt: Date.now() - 1000 * 60 * 60,
        updatedAt: Date.now() - 1000 * 60 * 60,
      };

      mockSecureStorage.get.mockResolvedValue(existingData);
      mockSecureStorage.set.mockResolvedValue(undefined);

      await userPreferencesService.initialize('Grade4');

      expect(mockSecureStorage.set).toHaveBeenCalledWith(
        'user_personalization_data',
        expect.objectContaining({
          gradeLevel: 'Grade4',
        })
      );
    });

    test('should initialize minimal mode when privacy consent not given', async () => {
      mockSecureStorage.get.mockImplementation((key) => {
        if (key === 'privacy_consent') return Promise.resolve(false);
        return Promise.resolve(null);
      });
      mockSecureStorage.set.mockResolvedValue(undefined);

      await userPreferencesService.initialize('Grade3');

      const data = userPreferencesService.getPreferencesData();
      expect(data?.interactions).toEqual([]);
    });
  });

  describe('Privacy Compliance', () => {
    test('should handle privacy consent correctly', async () => {
      mockSecureStorage.get.mockResolvedValue(true);
      mockSecureStorage.set.mockResolvedValue(undefined);

      const hasConsent = await userPreferencesService.hasPrivacyConsent();
      expect(hasConsent).toBe(true);

      await userPreferencesService.setPrivacyConsent(false);
      expect(mockSecureStorage.set).toHaveBeenCalledWith('privacy_consent', false);
    });

    test('should clear data when consent is revoked', async () => {
      mockSecureStorage.remove.mockResolvedValue(true);
      mockSecureStorage.set.mockResolvedValue(undefined);

      await userPreferencesService.setPrivacyConsent(false);

      expect(mockSecureStorage.remove).toHaveBeenCalledWith('user_personalization_data');
    });

    test('should anonymize interaction context', async () => {
      mockSecureStorage.get.mockResolvedValue(null);
      mockSecureStorage.set.mockResolvedValue(undefined);

      await userPreferencesService.initialize('Grade3');

      await userPreferencesService.recordInteraction('story_request', {
        gradeLevel: 'Grade3',
        userInput: 'Secret personal information',
        sensitiveData: 'This should be removed',
      });

      const data = userPreferencesService.getPreferencesData();
      const interaction = data?.interactions[0];
      
      expect(interaction?.context).not.toHaveProperty('userInput');
      expect(interaction?.context).not.toHaveProperty('sensitiveData');
      expect(interaction?.context).toHaveProperty('hasUserInput', true);
      expect(interaction?.context).toHaveProperty('userInputLength', 'Secret personal information'.length);
    });

    test('should export user data in compliance format', async () => {
      mockSecureStorage.get.mockResolvedValue(null);
      mockSecureStorage.set.mockResolvedValue(undefined);

      await userPreferencesService.initialize('Grade3');

      const exportData = await userPreferencesService.exportUserData();
      const parsed = JSON.parse(exportData);

      expect(parsed).toHaveProperty('gradeLevel');
      expect(parsed).toHaveProperty('preferences');
      expect(parsed).toHaveProperty('learningMetrics');
      expect(parsed).not.toHaveProperty('userId');
      expect(parsed).not.toHaveProperty('interactions');
    });
  });

  describe('User Interaction Recording', () => {
    beforeEach(async () => {
      mockSecureStorage.get.mockImplementation((key) => {
        if (key === 'privacy_consent') return Promise.resolve(true);
        return Promise.resolve(null);
      });
      mockSecureStorage.set.mockResolvedValue(undefined);
      await userPreferencesService.initialize('Grade3');
    });

    test('should record story request interactions', async () => {
      await userPreferencesService.recordInteraction('story_request', {
        gradeLevel: 'Grade3',
        userInput: 'I want an adventure story',
      });

      const data = userPreferencesService.getPreferencesData();
      expect(data?.interactions).toHaveLength(1);
      expect(data?.interactions[0]).toMatchObject({
        type: 'story_request',
        gradeLevel: 'Grade3',
        anonymized: true,
      });
      expect(data?.learningMetrics.sessionCount).toBe(1);
    });

    test('should record story completion interactions', async () => {
      await userPreferencesService.recordInteraction('story_completion', {
        gradeLevel: 'Grade3',
        duration: 180,
      });

      const data = userPreferencesService.getPreferencesData();
      expect(data?.interactions[0].type).toBe('story_completion');
    });

    test('should limit interaction history size', async () => {
      // Set small max history for testing
      (userPreferencesService as any).config.maxInteractionHistory = 5;

      // Record more interactions than max
      for (let i = 0; i < 10; i++) {
        await userPreferencesService.recordInteraction('story_request', {
          gradeLevel: 'Grade3',
          requestId: i,
        });
      }

      const data = userPreferencesService.getPreferencesData();
      expect(data?.interactions).toHaveLength(5);
    });
  });

  describe('Preference Learning', () => {
    beforeEach(async () => {
      mockSecureStorage.get.mockResolvedValue(null);
      mockSecureStorage.set.mockResolvedValue(undefined);
      await userPreferencesService.initialize('Grade3');
    });

    test('should update preferences from story feedback', async () => {
      const request: StoryRequest = {
        gradeLevel: 'Grade3',
        userInput: 'I want an adventure story with magic',
      };

      const response: StoryResponse = {
        story: 'Once upon a time, there was an exciting adventure with magic...',
        success: true,
        gradeLevel: 'Grade3',
      };

      await userPreferencesService.updatePreferencesFromStoryFeedback(request, response, 5);

      const data = userPreferencesService.getPreferencesData();
      expect(data?.storyPreferences.themes.adventure).toBeGreaterThan(0.5);
      expect(data?.storyPreferences.themes.fantasy).toBeGreaterThan(0.5);
    });

    test('should decrease preferences for low ratings', async () => {
      const request: StoryRequest = {
        gradeLevel: 'Grade3',
        userInput: 'boring story',
      };

      const response: StoryResponse = {
        story: 'A very boring story happened...',
        success: true,
        gradeLevel: 'Grade3',
      };

      await userPreferencesService.updatePreferencesFromStoryFeedback(request, response, 1);

      const data = userPreferencesService.getPreferencesData();
      // Preferences should move toward lower values due to low rating
      Object.values(data?.storyPreferences.themes || {}).forEach(score => {
        expect(score).toBeLessThanOrEqual(0.5);
      });
    });

    test('should apply temporal decay to preferences', async () => {
      // First, set some preferences
      const request: StoryRequest = {
        gradeLevel: 'Grade3',
        userInput: 'adventure story',
      };

      const response: StoryResponse = {
        story: 'Adventure story...',
        success: true,
        gradeLevel: 'Grade3',
      };

      await userPreferencesService.updatePreferencesFromStoryFeedback(request, response, 5);

      const initialScore = userPreferencesService.getPreferencesData()?.storyPreferences.themes.adventure;

      // Trigger multiple saves to apply decay
      for (let i = 0; i < 5; i++) {
        await userPreferencesService.recordInteraction('story_request', {
          gradeLevel: 'Grade3',
        });
      }

      const decayedScore = userPreferencesService.getPreferencesData()?.storyPreferences.themes.adventure;

      expect(decayedScore).toBeLessThan(initialScore!);
    });
  });

  describe('Personalized Recommendations', () => {
    test('should return default recommendations for new users', () => {
      const request: StoryRequest = {
        gradeLevel: 'Grade3',
      };

      const recommendations = userPreferencesService.getPersonalizedRecommendations(request);

      expect(recommendations.confidenceScore).toBeLessThan(0.5);
      expect(recommendations.recommendedThemes).toEqual(['adventure', 'friendship', 'discovery']);
      expect(recommendations.recommendedComplexity).toBe('medium');
    });

    test('should return personalized recommendations for experienced users', async () => {
      mockSecureStorage.get.mockResolvedValue(null);
      mockSecureStorage.set.mockResolvedValue(undefined);
      
      await userPreferencesService.initialize('Grade3');

      // Build up some preferences
      const request: StoryRequest = {
        gradeLevel: 'Grade3',
        userInput: 'space adventure with robots',
      };

      const response: StoryResponse = {
        story: 'A thrilling space adventure with robots...',
        success: true,
        gradeLevel: 'Grade3',
      };

      // Rate multiple space stories highly
      for (let i = 0; i < 5; i++) {
        await userPreferencesService.updatePreferencesFromStoryFeedback(request, response, 5);
        await userPreferencesService.recordInteraction('story_completion', {
          gradeLevel: 'Grade3',
        });
      }

      const recommendations = userPreferencesService.getPersonalizedRecommendations(request);

      expect(recommendations.confidenceScore).toBeGreaterThan(0.1);
      expect(recommendations.recommendedThemes).toContain('sci-fi');
    });
  });

  describe('Learning Metrics', () => {
    beforeEach(async () => {
      mockSecureStorage.get.mockResolvedValue(null);
      mockSecureStorage.set.mockResolvedValue(undefined);
      await userPreferencesService.initialize('Grade3');
    });

    test('should calculate improvement trend correctly', async () => {
      const request: StoryRequest = {
        gradeLevel: 'Grade3',
        userInput: 'story',
      };

      const response: StoryResponse = {
        story: 'A story...',
        success: true,
        gradeLevel: 'Grade3',
      };

      // Simulate improving ratings over time
      const ratings = [2, 2, 3, 3, 4, 4, 5, 5];
      for (const rating of ratings) {
        await userPreferencesService.updatePreferencesFromStoryFeedback(request, response, rating);
      }

      const data = userPreferencesService.getPreferencesData();
      expect(data?.learningMetrics.improvementTrend).toBeGreaterThan(0);
    });

    test('should calculate consistency score correctly', async () => {
      const request: StoryRequest = {
        gradeLevel: 'Grade3',
        userInput: 'story',
      };

      const response: StoryResponse = {
        story: 'A story...',
        success: true,
        gradeLevel: 'Grade3',
      };

      // Simulate consistent ratings
      for (let i = 0; i < 5; i++) {
        await userPreferencesService.updatePreferencesFromStoryFeedback(request, response, 4);
      }

      const data = userPreferencesService.getPreferencesData();
      expect(data?.learningMetrics.consistencyScore).toBeGreaterThan(0.8);
    });
  });

  describe('Session Pattern Analysis', () => {
    beforeEach(async () => {
      mockSecureStorage.get.mockResolvedValue(null);
      mockSecureStorage.set.mockResolvedValue(undefined);
      await userPreferencesService.initialize('Grade3');
    });

    test('should track completion rate correctly', async () => {
      // Record story requests
      for (let i = 0; i < 5; i++) {
        await userPreferencesService.recordInteraction('story_request', {
          gradeLevel: 'Grade3',
        });
      }

      // Record some completions
      for (let i = 0; i < 3; i++) {
        await userPreferencesService.recordInteraction('story_completion', {
          gradeLevel: 'Grade3',
        });
      }

      const data = userPreferencesService.getPreferencesData();
      expect(data?.sessionPatterns.completionRate).toBeCloseTo(0.6); // 3/5
    });

    test('should update engagement score based on recent activity', async () => {
      // Record recent completions
      for (let i = 0; i < 10; i++) {
        await userPreferencesService.recordInteraction('story_completion', {
          gradeLevel: 'Grade3',
        });
      }

      const data = userPreferencesService.getPreferencesData();
      expect(data?.sessionPatterns.engagementScore).toBe(1.0); // Max engagement
    });
  });

  describe('Data Management', () => {
    test('should reset personalization data correctly', async () => {
      mockSecureStorage.remove.mockResolvedValue(true);

      await userPreferencesService.resetPersonalizationData();

      expect(mockSecureStorage.remove).toHaveBeenCalledWith('user_personalization_data');
      expect(userPreferencesService.getPreferencesData()).toBeNull();
    });

    test('should handle invalid/expired data', async () => {
      const expiredData: PersonalizationData = {
        userId: 'test-user',
        gradeLevel: 'Grade3',
        storyPreferences: {
          themes: {},
          characters: {},
          settings: {},
          tones: {},
          complexity: {},
          genres: {},
        },
        sessionPatterns: {
          averageSessionDuration: 0,
          storiesPerSession: 0,
          preferredTimeOfDay: [],
          completionRate: 0,
          retryPattern: 0,
          engagementScore: 0.5,
        },
        learningMetrics: {
          improvementTrend: 0,
          consistencyScore: 0.5,
          explorationScore: 0.5,
          lastUpdated: Date.now(),
          sessionCount: 0,
        },
        interactions: [],
        version: '1.0',
        createdAt: Date.now() - 1000 * 60 * 60 * 24 * 35, // 35 days ago (expired)
        updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 35,
      };

      mockSecureStorage.get.mockResolvedValue(expiredData);
      mockSecureStorage.set.mockResolvedValue(undefined);

      await userPreferencesService.initialize('Grade3');

      // Should create new data instead of using expired data
      expect(mockSecureStorage.set).toHaveBeenCalledWith(
        'user_personalization_data',
        expect.objectContaining({
          createdAt: expect.any(Number),
        })
      );
    });
  });

  describe('Theme and Content Extraction', () => {
    beforeEach(async () => {
      mockSecureStorage.get.mockResolvedValue(null);
      mockSecureStorage.set.mockResolvedValue(undefined);
      await userPreferencesService.initialize('Grade3');
    });

    test('should extract themes from user input correctly', async () => {
      const requests = [
        { input: 'I want an adventure story', expectedTheme: 'adventure' },
        { input: 'Tell me about friendship', expectedTheme: 'friendship' },
        { input: 'Magic wizard story', expectedTheme: 'fantasy' },
        { input: 'Space robots', expectedTheme: 'sci-fi' },
        { input: 'My pet dog', expectedTheme: 'animals' },
      ];

      for (const { input, expectedTheme } of requests) {
        const request: StoryRequest = {
          gradeLevel: 'Grade3',
          userInput: input,
        };

        const response: StoryResponse = {
          story: 'A story...',
          success: true,
          gradeLevel: 'Grade3',
        };

        await userPreferencesService.updatePreferencesFromStoryFeedback(request, response, 5);
      }

      const data = userPreferencesService.getPreferencesData();
      const themes = Object.keys(data?.storyPreferences.themes || {});
      
      expect(themes).toContain('adventure');
      expect(themes).toContain('friendship');
      expect(themes).toContain('fantasy');
      expect(themes).toContain('sci-fi');
      expect(themes).toContain('animals');
    });

    test('should extract complexity based on grade level', async () => {
      const gradeLevels: Array<{ grade: any, expectedComplexity: string }> = [
        { grade: 'Kindergarten', expectedComplexity: 'simple' },
        { grade: 'Grade1', expectedComplexity: 'simple' },
        { grade: 'Grade3', expectedComplexity: 'medium' },
        { grade: 'Grade5', expectedComplexity: 'complex' },
      ];

      for (const { grade, expectedComplexity } of gradeLevels) {
        await userPreferencesService.initialize(grade);

        const request: StoryRequest = {
          gradeLevel: grade,
          userInput: 'story',
        };

        const response: StoryResponse = {
          story: 'A story...',
          success: true,
          gradeLevel: grade,
        };

        await userPreferencesService.updatePreferencesFromStoryFeedback(request, response, 5);

        const data = userPreferencesService.getPreferencesData();
        expect(data?.storyPreferences.complexity[expectedComplexity]).toBeDefined();
      }
    });
  });
});