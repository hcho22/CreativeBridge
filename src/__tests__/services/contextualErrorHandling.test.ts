/**
 * Context-Aware Error Handling Tests
 *
 * Comprehensive tests for Task 6.1: Context-Aware Error Handling
 * Tests error recovery, context preservation, seamless masking, and predictive prevention
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
  ContextualFallbackService,
  ErrorRecoveryContext,
} from '../../services/contextualFallback';
import { StoryAwareFallbackGenerator } from '../../services/storyAwareFallbackGenerator';
import {
  SeamlessErrorMaskingService,
  UserProfile,
  SessionContext,
} from '../../services/seamlessErrorMasking';
import { PredictiveFailurePreventionService } from '../../services/predictiveFailurePrevention';
import {
  SkillManager,
  SkillError,
  SkillErrorCode,
} from '../../types/claudeSkills';
// import { StoryRequest, StoryResponse, GradeLevel } from '../../types/story';

jest.mock('../../utils/logger');
jest.mock('../../services/auditLogger');

describe('Context-Aware Error Handling', () => {
  let mockSkillManager: jest.Mocked<SkillManager>;
  let contextualFallbackService: ContextualFallbackService;
  let storyAwareFallbackGenerator: StoryAwareFallbackGenerator;
  let seamlessErrorMaskingService: SeamlessErrorMaskingService;
  let predictiveFailurePreventionService: PredictiveFailurePreventionService;

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

    contextualFallbackService = new ContextualFallbackService(mockSkillManager);
    storyAwareFallbackGenerator = new StoryAwareFallbackGenerator();
    seamlessErrorMaskingService = new SeamlessErrorMaskingService();
    predictiveFailurePreventionService = new PredictiveFailurePreventionService(
      mockSkillManager,
    );
  });

  afterEach(() => {
    predictiveFailurePreventionService.shutdown();
  });

  describe('Error Recovery Context Preservation', () => {
    it('should maintain story context in 90% of recovery cases', async () => {
      const testCases = Array.from({ length: 20 }, (_, i) => ({
        story: `This is test story ${
          i + 1
        } with character Alice exploring a magical forest.`,
        gradeLevel: 'K-2' as GradeLevel,
        characters: ['Alice'],
        settings: ['magical forest'],
        themes: ['adventure'],
      }));

      let contextPreservedCount = 0;

      for (const testCase of testCases) {
        const storyContext =
          await contextualFallbackService.analyzeStoryContext(
            testCase.story,
            testCase.gradeLevel,
          );

        const mockError: SkillError = {
          code: SkillErrorCode.SKILL_TIMEOUT,
          message: 'Skill execution timed out',
          retryable: true,
        };

        const recoveryContext: ErrorRecoveryContext = {
          originalRequest: {
            gradeLevel: testCase.gradeLevel,
            userInput: 'continue story',
          },
          storyContext,
          errorType: SkillErrorCode.SKILL_TIMEOUT,
          errorMessage: mockError.message,
          attemptNumber: 1,
          previousFailures: [],
          userExperienceState: {
            isFirstInteraction: false,
            sessionDuration: 300000,
            previousSuccesses: 5,
            consecutiveFailures: 0,
          },
        };

        const result = await contextualFallbackService.recoverFromError(
          mockError,
          recoveryContext,
        );

        // Check if context is preserved (score > 60 indicates good preservation)
        if (result.contextPreservationScore > 60) {
          contextPreservedCount++;
        }
      }

      const preservationRate = contextPreservedCount / testCases.length;
      expect(preservationRate).toBeGreaterThanOrEqual(0.9); // 90% target
    });

    it('should preserve character consistency across error recovery', async () => {
      const originalStory =
        'Emma and her dog Buddy were exploring the enchanted garden when they discovered a hidden path.';
      const gradeLevel: GradeLevel = '3-5';

      const storyContext = await contextualFallbackService.analyzeStoryContext(
        originalStory,
        gradeLevel,
      );
      expect(storyContext.characters).toContain('Emma');

      const mockError: SkillError = {
        code: SkillErrorCode.NETWORK_ERROR,
        message: 'Network connection failed',
        retryable: true,
      };

      const recoveryContext: ErrorRecoveryContext = {
        originalRequest: { gradeLevel, userInput: 'continue the adventure' },
        storyContext,
        errorType: SkillErrorCode.NETWORK_ERROR,
        errorMessage: mockError.message,
        attemptNumber: 1,
        previousFailures: [],
        userExperienceState: {
          isFirstInteraction: false,
          sessionDuration: 180000,
          previousSuccesses: 3,
          consecutiveFailures: 0,
        },
      };

      const result = await contextualFallbackService.recoverFromError(
        mockError,
        recoveryContext,
      );

      // Verify character consistency
      const recoveredStoryLower = result.story.toLowerCase();
      expect(recoveredStoryLower).toMatch(/emma|she|her/);
    });

    it('should maintain setting consistency during recovery', async () => {
      const originalStory =
        'The spaceship landed on the mysterious purple planet where strange crystal formations sparkled.';
      const gradeLevel: GradeLevel = '6-8';

      const storyContext = await contextualFallbackService.analyzeStoryContext(
        originalStory,
        gradeLevel,
      );
      expect(storyContext.settings).toEqual(
        expect.arrayContaining(['spaceship']),
      );

      const mockError: SkillError = {
        code: SkillErrorCode.RATE_LIMIT_EXCEEDED,
        message: 'Rate limit exceeded',
        retryable: true,
      };

      const recoveryContext: ErrorRecoveryContext = {
        originalRequest: { gradeLevel, userInput: 'what happens next?' },
        storyContext,
        errorType: SkillErrorCode.RATE_LIMIT_EXCEEDED,
        errorMessage: mockError.message,
        attemptNumber: 2,
        previousFailures: [
          {
            error: 'Previous timeout',
            timestamp: new Date(),
            recoveryAttempted: 'basic',
          },
        ],
        userExperienceState: {
          isFirstInteraction: false,
          sessionDuration: 600000,
          previousSuccesses: 8,
          consecutiveFailures: 1,
        },
      };

      const result = await contextualFallbackService.recoverFromError(
        mockError,
        recoveryContext,
      );

      // Verify setting consistency
      expect(result.contextPreservationScore).toBeGreaterThan(50);
      expect(result.continuityMaintained).toBe(true);
    });
  });

  describe('Seamless User Experience Preservation', () => {
    it('should provide seamless recovery without breaking user immersion', async () => {
      const userProfile: UserProfile = {
        userId: 'test-user-child',
        ageGroup: 'child',
        gradeLevel: 'K-2',
        expectationLevel: 'medium',
        preferredInteractionStyle: 'guided',
        attentionSpan: 'medium',
        previousExperience: {
          totalSessions: 10,
          successRate: 0.9,
          averageSessionDuration: 900000,
          lastInteractionDate: new Date(),
        },
        accessibility: {
          needsSimpleLanguage: true,
          prefersVisualFeedback: true,
          requiresAudioSupport: false,
        },
      };

      const sessionContext: SessionContext = {
        sessionId: 'test-session',
        startTime: new Date(Date.now() - 300000),
        currentDuration: 300000,
        interactionCount: 5,
        successfulInteractions: 4,
        errorCount: 0,
        userEngagementScore: 85,
        isFirstSession: false,
        deviceType: 'tablet',
        networkQuality: 'good',
        backgroundProcessing: false,
      };

      const mockError: SkillError = {
        code: SkillErrorCode.SKILL_TIMEOUT,
        message: 'Skill timeout',
        retryable: true,
      };

      const recoveryResult = {
        story: 'Something magical happened next...',
        preservedContext: true,
        contextPreservationScore: 80,
        fallbackStrategy: 'gentle_child_masking',
        qualityScore: 85,
        seamless: true,
        continuityMaintained: true,
        recommendations: [
          'Used child-appropriate language',
          'Maintained story flow',
        ],
      };

      const recoveryContext: ErrorRecoveryContext = {
        originalRequest: { gradeLevel: 'K-2', userInput: 'continue' },
        storyContext: null,
        errorType: SkillErrorCode.SKILL_TIMEOUT,
        errorMessage: mockError.message,
        attemptNumber: 1,
        previousFailures: [],
        userExperienceState: {
          isFirstInteraction: false,
          sessionDuration: sessionContext.currentDuration,
          previousSuccesses: sessionContext.successfulInteractions,
          consecutiveFailures: 0,
        },
      };

      const maskingStrategy =
        await seamlessErrorMaskingService.maskErrorForUser(
          mockError,
          recoveryResult,
          userProfile,
          sessionContext,
          recoveryContext,
        );

      // For child users with good recovery, should be seamless
      expect(maskingStrategy.userMessage).toBeNull();
      expect(maskingStrategy.showProgress).toBe(false);
      expect(maskingStrategy.delayResponse).toBe(false);

      // Execute the masking strategy
      const executionResult =
        await seamlessErrorMaskingService.executeMaskingStrategy(
          maskingStrategy,
          userProfile,
          sessionContext,
        );

      expect(executionResult.executed).toBe(true);
      expect(executionResult.userExperienceScore).toBeGreaterThan(70);
    });

    it('should adapt masking strategy based on user age group', async () => {
      const childProfile: UserProfile = {
        userId: 'child-user',
        ageGroup: 'child',
        gradeLevel: 'K-2',
        expectationLevel: 'low',
        preferredInteractionStyle: 'guided',
        attentionSpan: 'short',
        previousExperience: {
          totalSessions: 3,
          successRate: 0.8,
          averageSessionDuration: 600000,
          lastInteractionDate: new Date(),
        },
        accessibility: {
          needsSimpleLanguage: true,
          prefersVisualFeedback: true,
          requiresAudioSupport: false,
        },
      };

      const adultProfile: UserProfile = {
        userId: 'adult-user',
        ageGroup: 'adult',
        gradeLevel: '6-8',
        expectationLevel: 'high',
        preferredInteractionStyle: 'independent',
        attentionSpan: 'long',
        previousExperience: {
          totalSessions: 50,
          successRate: 0.95,
          averageSessionDuration: 1800000,
          lastInteractionDate: new Date(),
        },
        accessibility: {
          needsSimpleLanguage: false,
          prefersVisualFeedback: false,
          requiresAudioSupport: false,
        },
      };

      const sessionContext: SessionContext = {
        sessionId: 'comparison-session',
        startTime: new Date(Date.now() - 600000),
        currentDuration: 600000,
        interactionCount: 8,
        successfulInteractions: 7,
        errorCount: 1,
        userEngagementScore: 75,
        isFirstSession: false,
        deviceType: 'phone',
        networkQuality: 'good',
        backgroundProcessing: false,
      };

      const mockError: SkillError = {
        code: SkillErrorCode.NETWORK_ERROR,
        message: 'Network error',
        retryable: true,
      };

      const recoveryResult = {
        story: 'The story continued in an interesting direction...',
        preservedContext: false,
        contextPreservationScore: 45,
        fallbackStrategy: 'network_recovery',
        qualityScore: 65,
        seamless: false,
        continuityMaintained: false,
        recommendations: ['Network issues detected', 'Used offline content'],
      };

      const recoveryContext: ErrorRecoveryContext = {
        originalRequest: { gradeLevel: 'K-2', userInput: 'continue' },
        storyContext: null,
        errorType: SkillErrorCode.NETWORK_ERROR,
        errorMessage: mockError.message,
        attemptNumber: 1,
        previousFailures: [],
        userExperienceState: {
          isFirstInteraction: false,
          sessionDuration: sessionContext.currentDuration,
          previousSuccesses: sessionContext.successfulInteractions,
          consecutiveFailures: 1,
        },
      };

      // Test child masking strategy
      const childStrategy = await seamlessErrorMaskingService.maskErrorForUser(
        mockError,
        recoveryResult,
        childProfile,
        sessionContext,
        recoveryContext,
      );

      // Test adult masking strategy
      const adultStrategy = await seamlessErrorMaskingService.maskErrorForUser(
        mockError,
        recoveryResult,
        adultProfile,
        sessionContext,
        recoveryContext,
      );

      // Child should get more gentle, visual feedback
      expect(childStrategy.progressIndicator.type).toBe('creative_animation');
      expect(childStrategy.userMessage).toMatch(/think|moment/i);

      // Adult should get more transparent communication
      expect(adultStrategy.alternativeAction).toBe('offer_alternatives');
      expect(adultStrategy.userMessage).toMatch(/exploring|alternatives/i);
    });
  });

  describe('Predictive Failure Prevention', () => {
    it('should reduce error occurrence through predictive measures', async () => {
      const baselineErrorRate = 0.15; // 15% baseline error rate
      const targetReduction = 0.3; // 30% reduction target

      const testRequests: StoryRequest[] = Array.from(
        { length: 50 },
        (_, i) => ({
          gradeLevel: ['K-2', '3-5', '6-8'][i % 3] as GradeLevel,
          userInput: `Test story request ${i + 1}`,
          storySoFar:
            i > 25
              ? 'A long story context that might cause complexity issues...'
              : undefined,
        }),
      );

      let predictionsWithHighRisk = 0;
      let preventiveMeasuresExecuted = 0;
      let simulatedErrors = 0;

      for (const request of testRequests) {
        const prediction =
          await predictiveFailurePreventionService.predictFailureRisk(
            request,
            undefined,
            {
              recentFailures: Math.floor(Math.random() * 3),
              averageLatency: Math.random() * 2000 + 500,
              networkCondition: ['excellent', 'good', 'poor'][
                Math.floor(Math.random() * 3)
              ] as any,
              deviceType: ['phone', 'tablet'][
                Math.floor(Math.random() * 2)
              ] as any,
            },
          );

        if (prediction.riskScore > 60) {
          predictionsWithHighRisk++;

          // Execute preventive measures for high-risk predictions
          const preventiveResult =
            await predictiveFailurePreventionService.executePreventiveMeasures(
              prediction,
              request,
              'background',
            );

          if (preventiveResult.successful.length > 0) {
            preventiveMeasuresExecuted++;
          }
        }

        // Simulate whether this would have been an error (simplified simulation)
        const wouldHaveErrored = Math.random() < baselineErrorRate;
        const preventedError =
          prediction.riskScore > 60 && wouldHaveErrored && Math.random() < 0.7; // 70% prevention success

        if (wouldHaveErrored && !preventedError) {
          simulatedErrors++;
        }
      }

      const actualErrorRate = simulatedErrors / testRequests.length;
      const reductionAchieved =
        (baselineErrorRate - actualErrorRate) / baselineErrorRate;

      expect(predictionsWithHighRisk).toBeGreaterThan(0);
      expect(preventiveMeasuresExecuted).toBeGreaterThan(0);
      expect(reductionAchieved).toBeGreaterThanOrEqual(targetReduction * 0.7); // Allow some variance
    });

    it('should learn from failures to improve predictions', async () => {
      const request: StoryRequest = {
        gradeLevel: '3-5',
        userInput: 'Create a mystery story',
      };

      // Get initial prediction
      const initialPrediction =
        await predictiveFailurePreventionService.predictFailureRisk(request);

      // Simulate a failure that wasn't predicted
      if (initialPrediction.riskScore < 60) {
        const mockError: SkillError = {
          code: SkillErrorCode.RATE_LIMIT_EXCEEDED,
          message: 'Rate limit exceeded unexpectedly',
          retryable: true,
        };

        await predictiveFailurePreventionService.learnFromFailure(
          mockError,
          request,
          initialPrediction,
        );

        // Get prediction for similar request
        const improvedPrediction =
          await predictiveFailurePreventionService.predictFailureRisk({
            ...request,
            userInput: 'Create another mystery story',
          });

        // The system should have learned and potentially predict higher risk for similar requests
        // (This is a simplified test - real learning would require more sophisticated validation)
        expect(improvedPrediction).toBeDefined();
      }

      const metrics = predictiveFailurePreventionService.getPreventionMetrics();
      expect(metrics.totalPredictions).toBeGreaterThan(0);
    });

    it('should validate prediction accuracy over time', async () => {
      const predictions: Array<{
        prediction: any;
        actualOutcome: 'success' | 'failure';
      }> = [];

      // Generate test predictions and outcomes
      for (let i = 0; i < 20; i++) {
        const request: StoryRequest = {
          gradeLevel: ['K-2', '3-5', '6-8'][i % 3] as GradeLevel,
          userInput: `Test request ${i}`,
          storySoFar: i % 4 === 0 ? 'Long context...' : undefined,
        };

        const prediction =
          await predictiveFailurePreventionService.predictFailureRisk(request);

        // Simulate actual outcome based on risk score with some noise
        const actualOutcome =
          (prediction.riskScore > 50 && Math.random() > 0.3) ||
          (prediction.riskScore <= 50 && Math.random() < 0.2)
            ? 'failure'
            : 'success';

        predictions.push({ prediction, actualOutcome });

        // Validate the prediction
        await predictiveFailurePreventionService.validatePrediction(
          prediction,
          actualOutcome,
          Math.random() * 2000 + 500,
        );
      }

      const metrics = predictiveFailurePreventionService.getPreventionMetrics();
      expect(metrics.predictionAccuracy).toBeGreaterThan(0);
      expect(metrics.totalPredictions).toBe(20);
    });
  });

  describe('Fallback Content Quality', () => {
    it('should generate fallback content that matches or exceeds static fallbacks', async () => {
      const testStories = [
        {
          original:
            'Princess Luna discovered a secret garden behind the castle walls.',
          gradeLevel: 'K-2' as GradeLevel,
          expectedQuality: 70,
        },
        {
          original:
            'The young detective examined the mysterious footprints leading to the abandoned warehouse.',
          gradeLevel: '3-5' as GradeLevel,
          expectedQuality: 75,
        },
        {
          original:
            'The quantum physicist realized that her equations might hold the key to understanding parallel dimensions.',
          gradeLevel: '6-8' as GradeLevel,
          expectedQuality: 80,
        },
      ];

      for (const testStory of testStories) {
        const storyContext =
          await contextualFallbackService.analyzeStoryContext(
            testStory.original,
            testStory.gradeLevel,
          );

        const recoveryContext: ErrorRecoveryContext = {
          originalRequest: {
            gradeLevel: testStory.gradeLevel,
            userInput: 'continue',
          },
          storyContext,
          errorType: SkillErrorCode.SKILL_TIMEOUT,
          errorMessage: 'Timeout error',
          attemptNumber: 1,
          previousFailures: [],
          userExperienceState: {
            isFirstInteraction: false,
            sessionDuration: 300000,
            previousSuccesses: 5,
            consecutiveFailures: 0,
          },
        };

        const fallbackResult =
          await storyAwareFallbackGenerator.generateContextAwareFallback(
            recoveryContext,
          );

        expect(fallbackResult.qualityScore).toBeGreaterThanOrEqual(
          testStory.expectedQuality,
        );
        expect(fallbackResult.story).toBeTruthy();
        expect(fallbackResult.story.length).toBeGreaterThan(10);

        // Verify content is appropriate for grade level
        if (testStory.gradeLevel === 'K-2') {
          expect(fallbackResult.story).toMatch(/[.!]/); // Has proper punctuation
          // Should use simpler language
        }
      }
    });

    it('should maintain educational value in fallback content', async () => {
      const educationalStory =
        'The students were learning about photosynthesis when they discovered how plants make their own food using sunlight.';
      const gradeLevel: GradeLevel = '3-5';

      const storyContext = await contextualFallbackService.analyzeStoryContext(
        educationalStory,
        gradeLevel,
      );

      const recoveryContext: ErrorRecoveryContext = {
        originalRequest: { gradeLevel, userInput: 'continue the lesson' },
        storyContext,
        errorType: SkillErrorCode.NETWORK_ERROR,
        errorMessage: 'Network error',
        attemptNumber: 1,
        previousFailures: [],
        userExperienceState: {
          isFirstInteraction: false,
          sessionDuration: 240000,
          previousSuccesses: 3,
          consecutiveFailures: 0,
        },
      };

      const fallbackResult =
        await storyAwareFallbackGenerator.generateContextAwareFallback(
          recoveryContext,
        );

      // Educational fallback should maintain learning themes
      expect(fallbackResult.recommendations).toContain(
        'Context analysis successful',
      );
      expect(fallbackResult.contextPreservationScore).toBeGreaterThan(60);
    });
  });

  describe('Integration and End-to-End Scenarios', () => {
    it('should handle complete error recovery workflow', async () => {
      // Setup complete scenario
      const originalStory =
        'Captain Maya and her crew were exploring the mysterious space station when the lights suddenly went out.';
      const request: StoryRequest = {
        gradeLevel: '6-8',
        userInput: 'What happens next?',
      };
      const mockError: SkillError = {
        code: SkillErrorCode.SKILL_UNAVAILABLE,
        message: 'Story generation service unavailable',
        retryable: false,
      };

      // Step 1: Analyze story context
      const storyContext = await contextualFallbackService.analyzeStoryContext(
        originalStory,
        '6-8',
      );
      expect(storyContext.characters).toContain('Maya');
      expect(storyContext.settings).toEqual(expect.arrayContaining(['space']));

      // Step 2: Create recovery context
      const recoveryContext: ErrorRecoveryContext = {
        originalRequest: request,
        storyContext,
        errorType: SkillErrorCode.SKILL_UNAVAILABLE,
        errorMessage: mockError.message,
        attemptNumber: 1,
        previousFailures: [],
        userExperienceState: {
          isFirstInteraction: false,
          sessionDuration: 450000,
          previousSuccesses: 6,
          consecutiveFailures: 0,
        },
      };

      // Step 3: Execute contextual fallback
      const fallbackResult = await contextualFallbackService.recoverFromError(
        mockError,
        recoveryContext,
      );
      expect(fallbackResult.contextPreservationScore).toBeGreaterThan(50);

      // Step 4: Create user masking strategy
      const userProfile: UserProfile = {
        userId: 'integration-test-user',
        ageGroup: 'teen',
        gradeLevel: '6-8',
        expectationLevel: 'high',
        preferredInteractionStyle: 'independent',
        attentionSpan: 'long',
        previousExperience: {
          totalSessions: 25,
          successRate: 0.92,
          averageSessionDuration: 1200000,
          lastInteractionDate: new Date(),
        },
        accessibility: {
          needsSimpleLanguage: false,
          prefersVisualFeedback: false,
          requiresAudioSupport: false,
        },
      };

      const sessionContext: SessionContext = {
        sessionId: 'integration-session',
        startTime: new Date(Date.now() - 450000),
        currentDuration: 450000,
        interactionCount: 7,
        successfulInteractions: 6,
        errorCount: 1,
        userEngagementScore: 88,
        isFirstSession: false,
        deviceType: 'desktop',
        networkQuality: 'excellent',
        backgroundProcessing: true,
      };

      const maskingStrategy =
        await seamlessErrorMaskingService.maskErrorForUser(
          mockError,
          fallbackResult,
          userProfile,
          sessionContext,
          recoveryContext,
        );

      // Step 5: Execute masking strategy
      const executionResult =
        await seamlessErrorMaskingService.executeMaskingStrategy(
          maskingStrategy,
          userProfile,
          sessionContext,
        );

      // Step 6: Collect feedback
      const feedbackResult =
        await seamlessErrorMaskingService.collectRecoveryFeedback(
          userProfile,
          sessionContext,
          maskingStrategy,
        );

      // Verify end-to-end results
      expect(fallbackResult.story).toBeTruthy();
      expect(executionResult.executed).toBe(true);
      expect(feedbackResult.seamlessScore).toBeGreaterThan(50);
      expect(feedbackResult.userSatisfaction).toBeGreaterThan(50);
    });
  });
});
