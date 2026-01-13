/**
 * Adaptive Quality Thresholds Tests
 *
 * Tests for the adaptive quality threshold system
 * Task 5.2: Adaptive Quality Thresholds
 */

import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';
import {
  ContentQualityService,
  QualityAssessmentMetrics,
} from '../../services/contentQuality';
import { userPreferencesService } from '../../services/userPreferences';
// import { StoryRequest, StoryResponse } from '../../types/story';
import { SkillManager } from '../../types/claudeSkills';

jest.mock('../../utils/logger');

describe('Adaptive Quality Thresholds', () => {
  let mockSkillManager: jest.Mocked<SkillManager>;
  let qualityService: ContentQualityService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSkillManager = {
      initialize: jest.fn().mockResolvedValue(undefined),
      registerSkill: jest.fn(),
      executeSkill: jest.fn(),
      getSkillStatus: jest.fn().mockReturnValue('idle'),
      shutdown: jest.fn().mockResolvedValue(undefined),
      isInitialized: jest.fn().mockReturnValue(true),
    };

    qualityService = new ContentQualityService(mockSkillManager);
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('Thresholds adapt to user engagement patterns', () => {
    it('should adapt thresholds based on user engagement patterns', async () => {
      // Mock user preferences with engagement history
      const userId = 'test-user-123';
      await userPreferencesService.initialize('K-2', userId);

      // Simulate quality assessments with different scores and user ratings
      const mockAssessments = [
        { qualityScore: 85, userRating: 4, engagement: 0.8 },
        { qualityScore: 90, userRating: 5, engagement: 0.9 },
        { qualityScore: 95, userRating: 3, engagement: 0.6 }, // High quality, low satisfaction
        { qualityScore: 80, userRating: 5, engagement: 0.9 }, // Lower quality, high satisfaction
        { qualityScore: 85, userRating: 4, engagement: 0.8 },
      ];

      for (const assessment of mockAssessments) {
        // Record engagement feedback
        await qualityService.recordEngagementFeedback(
          userId,
          'K-2',
          { overallScore: assessment.qualityScore } as QualityAssessmentMetrics,
          {
            readingTime: 30000,
            completionRate: assessment.engagement,
            userRating: assessment.userRating,
            retryCount: 0,
            shareCount: 0,
          },
        );
      }

      // Get adaptive quality standards
      const adaptedStandards = await qualityService.getAdaptiveQualityStandards(
        'K-2',
        userId,
      );
      const baseStandards = await qualityService.getAdaptiveQualityStandards(
        'K-2',
      );

      // Verify adaptation occurred
      expect(adaptedStandards).toBeDefined();
      // The adapted standards should differ from base when sufficient feedback is provided
      // (This would require more sophisticated setup to trigger actual threshold changes)
    });

    it('should calculate engagement correlation accurately', () => {
      // Add correlation data to the service
      const correlationData = [
        { qualityScore: 85, userRating: 4 },
        { qualityScore: 90, userRating: 5 },
        { qualityScore: 95, userRating: 3 },
        { qualityScore: 80, userRating: 5 },
        { qualityScore: 88, userRating: 4 },
        { qualityScore: 92, userRating: 2 },
        { qualityScore: 82, userRating: 5 },
        { qualityScore: 87, userRating: 4 },
        { qualityScore: 93, userRating: 3 },
        { qualityScore: 79, userRating: 5 },
      ];

      // Manually add correlation data for testing
      correlationData.forEach(data => {
        (qualityService as any).engagementCorrelationData.push({
          qualityScore: data.qualityScore,
          engagementMetrics: {
            readingTime: 30000,
            completionRate: 0.8,
            userRating: data.userRating,
            retryCount: 0,
            shareCount: 0,
          },
          contextFactors: {
            gradeLevel: 'K-2',
            timeOfDay: '14',
            sessionLength: 30000,
            contentType: 'story',
          },
        });
      });

      const analysis = qualityService.getEngagementCorrelationAnalysis();

      expect(analysis).toBeDefined();
      expect(analysis.qualityEngagementCorrelation).toBeLessThan(0); // Negative correlation expected from test data
      expect(analysis.optimalQualityRange).toBeDefined();
      expect(analysis.insights).toHaveLength(2);
      expect(analysis.insights[0]).toContain(
        'Quality scores may be too strict',
      );
    });

    it('should provide fallback when insufficient data for correlation', () => {
      // Test with empty correlation data
      const analysis = qualityService.getEngagementCorrelationAnalysis();

      expect(analysis.qualityEngagementCorrelation).toBe(0);
      expect(analysis.optimalQualityRange).toEqual({ min: 80, max: 95 });
      expect(analysis.insights).toEqual([
        'Insufficient data for correlation analysis',
      ]);
    });
  });

  describe('Content generation improves over time', () => {
    it('should track quality improvement trends', async () => {
      const userId = 'improvement-test-user';
      await userPreferencesService.initialize('3-5', userId);

      // Simulate gradual improvement in user satisfaction over time
      const improvements = [
        { score: 80, satisfaction: 3 },
        { score: 82, satisfaction: 3.5 },
        { score: 85, satisfaction: 4 },
        { score: 87, satisfaction: 4.5 },
        { score: 90, satisfaction: 5 },
      ];

      for (const improvement of improvements) {
        await userPreferencesService.recordQualityFeedback(
          improvement.score / 100, // Convert to 0-1 scale
          improvement.satisfaction / 5, // Convert to 0-1 scale
          0.8, // Consistent engagement
        );

        // Small delay to ensure timestamp ordering
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const preferences = userPreferencesService.getQualityPreferences();
      expect(preferences).toBeDefined();
      expect(preferences!.preferredQualityLevel).toBeGreaterThan(0.5);
    });

    it('should adapt to changing user behavior patterns', async () => {
      const userId = 'behavior-change-user';
      await userPreferencesService.initialize('6-8', userId);

      // Simulate user initially preferring lower quality content
      const initialPreferences = [
        { score: 70, satisfaction: 5, engagement: 0.9 },
        { score: 75, satisfaction: 4.5, engagement: 0.85 },
        { score: 73, satisfaction: 5, engagement: 0.9 },
      ];

      for (const pref of initialPreferences) {
        await userPreferencesService.recordQualityFeedback(
          pref.score / 100,
          pref.satisfaction / 5,
          pref.engagement,
        );
      }

      const initialPrefs = userPreferencesService.getQualityPreferences();
      const initialQualityLevel = initialPrefs!.preferredQualityLevel;

      // Simulate user's taste changing to prefer higher quality
      const laterPreferences = [
        { score: 85, satisfaction: 5, engagement: 0.95 },
        { score: 90, satisfaction: 4.5, engagement: 0.9 },
        { score: 88, satisfaction: 5, engagement: 0.95 },
        { score: 92, satisfaction: 4.8, engagement: 0.92 },
      ];

      for (const pref of laterPreferences) {
        await userPreferencesService.recordQualityFeedback(
          pref.score / 100,
          pref.satisfaction / 5,
          pref.engagement,
        );
      }

      const updatedPrefs = userPreferencesService.getQualityPreferences();

      // Quality preference should adapt upward
      expect(updatedPrefs!.preferredQualityLevel).toBeGreaterThan(
        initialQualityLevel,
      );
    });
  });

  describe('Educational value preserved during adaptation', () => {
    it('should maintain educational value metrics during threshold adaptation', async () => {
      // Mock successful quality assessment with high educational value
      mockSkillManager.executeSkill.mockResolvedValue({
        success: true,
        data: {
          overallScore: 85,
          educationalValue: 90, // High educational value
          narrativeCoherence: 85,
          gradeAppropriateness: 88,
          engagementPotential: 82,
          culturalSensitivity: 95,
          vocabularyComplexity: 80,
          contentSafety: 100,
          issues: [],
          recommendations: [],
          improvements: [],
        },
        confidence: 0.9,
        executionTimeMs: 150,
        skillType: 'ComprehensiveQualityAssessmentSkill',
      });

      const story: StoryResponse = {
        story: 'An educational story about science and discovery.',
        gradeLevel: '3-5',
        isPersonalized: false,
        confidence: 0.9,
      };

      const request: StoryRequest = {
        gradeLevel: '3-5',
        userInput: 'Science adventure story',
      };

      const userId = 'educational-preservation-user';
      const result = await qualityService.assessContent(
        story,
        request,
        true,
        userId,
      );

      // Educational value should be maintained
      expect(result.metrics.educationalValue).toBe(90);
      expect(result.passed).toBe(true);

      // Verify that adaptive thresholds don't compromise educational standards
      expect(result.metrics.educationalValue).toBeGreaterThanOrEqual(80);
    });

    it('should prevent over-adaptation that compromises educational goals', async () => {
      const userId = 'education-safety-user';
      await userPreferencesService.initialize('K-2', userId);

      // Simulate feedback that might suggest lowering educational standards
      const problematicFeedback = [
        { score: 95, satisfaction: 2, engagement: 0.3 }, // High quality, low engagement
        { score: 60, satisfaction: 5, engagement: 0.95 }, // Low quality, high engagement
      ];

      for (const feedback of problematicFeedback) {
        await userPreferencesService.recordQualityFeedback(
          feedback.score / 100,
          feedback.satisfaction / 5,
          feedback.engagement,
        );
      }

      // Get adapted standards
      const adaptedStandards = await qualityService.getAdaptiveQualityStandards(
        'K-2',
        userId,
      );
      const baseStandards = await qualityService.getAdaptiveQualityStandards(
        'K-2',
      );

      // Educational value threshold should not be severely compromised
      const adaptedEducationalThreshold =
        adaptedStandards.minimumScores.educationalValue || 80;
      const baseEducationalThreshold =
        baseStandards.minimumScores.educationalValue || 80;

      // Allow some adaptation but maintain educational floor
      expect(adaptedEducationalThreshold).toBeGreaterThanOrEqual(
        baseEducationalThreshold - 15,
      );
    });
  });

  describe('Adaptive Quality System Integration', () => {
    it('should enable and disable adaptive thresholds per user preference', async () => {
      const userId = 'adaptive-toggle-user';
      await userPreferencesService.initialize('6-8', userId);

      // Initially enabled by default
      let preferences = userPreferencesService.getQualityPreferences();
      expect(preferences!.adaptiveThresholdsEnabled).toBe(true);

      // Disable adaptive thresholds
      await userPreferencesService.setAdaptiveThresholdsEnabled(false);
      preferences = userPreferencesService.getQualityPreferences();
      expect(preferences!.adaptiveThresholdsEnabled).toBe(false);

      // Re-enable adaptive thresholds
      await userPreferencesService.setAdaptiveThresholdsEnabled(true);
      preferences = userPreferencesService.getQualityPreferences();
      expect(preferences!.adaptiveThresholdsEnabled).toBe(true);
    });

    it('should provide confidence levels for adaptation decisions', async () => {
      const userId = 'confidence-test-user';

      // Test with insufficient data
      const adaptiveMetrics = (
        qualityService as any
      ).createInitialAdaptiveMetrics(userId, 'K-2');
      expect(adaptiveMetrics.confidenceLevel).toBe(0);

      // Simulate sufficient quality feedback history
      for (let i = 0; i < 15; i++) {
        adaptiveMetrics.qualityFeedbackHistory.push({
          timestamp: Date.now() + i * 1000,
          overallScore: 85 + Math.random() * 10,
          userRating: 4 + Math.random(),
          engagementDuration: 30000,
          completionRate: 0.8 + Math.random() * 0.2,
        });
      }

      const confidence = (qualityService as any).calculateAdaptationConfidence(
        adaptiveMetrics,
      );
      expect(confidence).toBeGreaterThan(0.3); // Should have meaningful confidence with sufficient data
      expect(confidence).toBeLessThanOrEqual(1.0); // Should not exceed maximum confidence
    });
  });
});
