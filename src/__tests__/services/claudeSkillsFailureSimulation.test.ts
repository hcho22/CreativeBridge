/**
 * Claude Skills Failure Simulation Tests
 * 
 * Comprehensive failure scenario testing for Task 2.2
 * Tests all identified failure modes and recovery strategies
 */

import { createMockSkillManager } from '../mocks/claudeSkillsMock';
import { SkillManager, SkillErrorCode } from '../../types/claudeSkills';
import { SkillTestUtils, MOCK_ERROR_SCENARIOS } from '../mocks/claudeSkillsMock';
import {
  SkillEnhancedServiceFactory,
  SkillEnhancedServiceConfig,
} from '../../services/base/SkillEnhancedService';

describe('Claude Skills Failure Simulation', () => {
  let skillManager: SkillManager;
  let mockService: { execute: (req: any) => Promise<any> };

  beforeEach(() => {
    skillManager = createMockSkillManager();
    mockService = {
      execute: async (request: { input: string }) => {
        return { success: true, data: `Original: ${request.input}` };
      },
    };
  });

  describe('Network Error Simulation', () => {
    test('Network errors handled gracefully', async () => {
      await skillManager.initialize({
        apiKey: 'test_key',
        environment: 'development',
        enabledSkills: ['ContentPredictionSkill'],
        performanceMode: 'balanced',
      });

      (skillManager as any).setErrorSimulation(true, 'networkError');

      const result = await skillManager.executeSkill(
        'ContentPredictionSkill_mock',
        SkillTestUtils.createTestInput.ContentPredictionSkill()
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(SkillErrorCode.NETWORK_ERROR);
      expect(result.error?.retryable).toBe(true);
    });

    test('Network error triggers fallback', async () => {
      await skillManager.initialize({
        apiKey: 'test_key',
        environment: 'development',
        enabledSkills: ['ContentPredictionSkill'],
        performanceMode: 'balanced',
      });

      (skillManager as any).setErrorSimulation(true, 'networkError');

      const config: SkillEnhancedServiceConfig = {
        enabled: true,
        skillTypes: ['ContentPredictionSkill'],
        fallbackEnabled: true,
      };

      const enhancedService = SkillEnhancedServiceFactory.wrapService(
        mockService,
        skillManager,
        config,
        {
          buildSkillExecutionPlan: async () => ({
            skills: [
              {
                skillType: 'ContentPredictionSkill',
                skillId: 'ContentPredictionSkill_mock',
                input: {},
                required: false,
              },
            ],
            parallel: false,
            stopOnError: false,
          }),
          processSkillResults: async () => {
            throw new Error('Processing failed');
          },
        }
      );

      const result = await enhancedService.execute({ input: 'test' });
      expect(result).toBeDefined();
      expect(result.success).toBe(true); // Should fall back to original service
    });
  });

  describe('Authentication Error Simulation', () => {
    test('Authentication errors handled correctly', async () => {
      await skillManager.initialize({
        apiKey: 'test_key',
        environment: 'development',
        enabledSkills: ['ContentPredictionSkill'],
        performanceMode: 'balanced',
      });

      (skillManager as any).setErrorSimulation(true, 'authError');

      const result = await skillManager.executeSkill(
        'ContentPredictionSkill_mock',
        SkillTestUtils.createTestInput.ContentPredictionSkill()
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(SkillErrorCode.AUTHENTICATION_ERROR);
      expect(result.error?.retryable).toBe(false);
    });
  });

  describe('Rate Limit Error Simulation', () => {
    test('Rate limit errors handled with retry logic', async () => {
      await skillManager.initialize({
        apiKey: 'test_key',
        environment: 'development',
        enabledSkills: ['ContentPredictionSkill'],
        performanceMode: 'balanced',
      });

      (skillManager as any).setErrorSimulation(true, 'rateLimitError');

      const result = await skillManager.executeSkill(
        'ContentPredictionSkill_mock',
        SkillTestUtils.createTestInput.ContentPredictionSkill()
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(SkillErrorCode.RATE_LIMIT_EXCEEDED);
      expect(result.error?.retryable).toBe(true);
    });
  });

  describe('Timeout Error Simulation', () => {
    test('Timeout errors handled correctly', async () => {
      await skillManager.initialize({
        apiKey: 'test_key',
        environment: 'development',
        enabledSkills: ['ContentPredictionSkill'],
        performanceMode: 'balanced',
      });

      (skillManager as any).setErrorSimulation(true, 'timeoutError');

      const result = await skillManager.executeSkill(
        'ContentPredictionSkill_mock',
        SkillTestUtils.createTestInput.ContentPredictionSkill()
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(SkillErrorCode.SKILL_TIMEOUT);
      expect(result.error?.retryable).toBe(true);
    });
  });

  describe('All Failure Modes Coverage', () => {
    test('All identified failure modes covered', async () => {
      await skillManager.initialize({
        apiKey: 'test_key',
        environment: 'development',
        enabledSkills: ['ContentPredictionSkill'],
        performanceMode: 'balanced',
      });

      const failureModes: Array<keyof typeof MOCK_ERROR_SCENARIOS> = [
        'networkError',
        'authError',
        'rateLimitError',
        'timeoutError',
      ];

      for (const failureMode of failureModes) {
        (skillManager as any).setErrorSimulation(true, failureMode);

        const result = await skillManager.executeSkill(
          'ContentPredictionSkill_mock',
          SkillTestUtils.createTestInput.ContentPredictionSkill()
        );

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(MOCK_ERROR_SCENARIOS[failureMode].code);
      }
    });

    test('Failure modes trigger appropriate recovery', async () => {
      await skillManager.initialize({
        apiKey: 'test_key',
        environment: 'development',
        enabledSkills: ['ContentPredictionSkill'],
        performanceMode: 'balanced',
      });

      const config: SkillEnhancedServiceConfig = {
        enabled: true,
        skillTypes: ['ContentPredictionSkill'],
        fallbackEnabled: true,
      };

      const failureModes: Array<keyof typeof MOCK_ERROR_SCENARIOS> = [
        'networkError',
        'timeoutError',
        'rateLimitError',
      ];

      for (const failureMode of failureModes) {
        (skillManager as any).setErrorSimulation(true, failureMode);

        const enhancedService = SkillEnhancedServiceFactory.wrapService(
          mockService,
          skillManager,
          config,
          {
            buildSkillExecutionPlan: async () => ({
              skills: [
                {
                  skillType: 'ContentPredictionSkill',
                  skillId: 'ContentPredictionSkill_mock',
                  input: {},
                  required: false,
                },
              ],
              parallel: false,
              stopOnError: false,
            }),
            processSkillResults: async () => {
              throw new Error('Processing failed');
            },
          }
        );

        // Should fall back to original service
        const result = await enhancedService.execute({ input: 'test' });
        expect(result).toBeDefined();
        expect(result.success).toBe(true);
      }
    });
  });

  describe('Cascading Failure Simulation', () => {
    test('Multiple skill failures handled', async () => {
      await skillManager.initialize({
        apiKey: 'test_key',
        environment: 'development',
        enabledSkills: ['ContentPredictionSkill', 'QualityAssessmentSkill'],
        performanceMode: 'balanced',
      });

      (skillManager as any).setErrorSimulation(true, 'networkError');

      const config: SkillEnhancedServiceConfig = {
        enabled: true,
        skillTypes: ['ContentPredictionSkill', 'QualityAssessmentSkill'],
        fallbackEnabled: true,
      };

      const enhancedService = SkillEnhancedServiceFactory.wrapService(
        mockService,
        skillManager,
        config,
        {
          buildSkillExecutionPlan: async () => ({
            skills: [
              {
                skillType: 'ContentPredictionSkill',
                skillId: 'ContentPredictionSkill_mock',
                input: {},
                required: false,
              },
              {
                skillType: 'QualityAssessmentSkill',
                skillId: 'QualityAssessmentSkill_mock',
                input: {},
                required: false,
              },
            ],
            parallel: false,
            stopOnError: false,
          }),
          processSkillResults: async () => {
            throw new Error('All skills failed');
          },
        }
      );

      const result = await enhancedService.execute({ input: 'test' });
      expect(result).toBeDefined();
      // Should fall back even when multiple skills fail
    });
  });

  describe('Partial Failure Simulation', () => {
    test('Partial skill failures handled correctly', async () => {
      await skillManager.initialize({
        apiKey: 'test_key',
        environment: 'development',
        enabledSkills: ['ContentPredictionSkill', 'QualityAssessmentSkill'],
        performanceMode: 'balanced',
      });

      // Simulate one skill failing, one succeeding
      let callCount = 0;
      const originalExecute = skillManager.executeSkill.bind(skillManager);
      (skillManager as any).executeSkill = async function(skillId: string, input: any) {
        callCount++;
        if (skillId.includes('ContentPredictionSkill')) {
          // First skill fails
          return {
            success: false,
            error: {
              code: SkillErrorCode.NETWORK_ERROR,
              message: 'Network error',
              retryable: true,
            },
            executionTimeMs: 100,
            skillType: 'ContentPredictionSkill',
          };
        }
        // Second skill succeeds
        return originalExecute(skillId, input);
      };

      const config: SkillEnhancedServiceConfig = {
        enabled: true,
        skillTypes: ['ContentPredictionSkill', 'QualityAssessmentSkill'],
        fallbackEnabled: true,
      };

      const enhancedService = SkillEnhancedServiceFactory.wrapService(
        mockService,
        skillManager,
        config,
        {
          buildSkillExecutionPlan: async () => ({
            skills: [
              {
                skillType: 'ContentPredictionSkill',
                skillId: 'ContentPredictionSkill_mock',
                input: {},
                required: false, // Non-fatal
              },
              {
                skillType: 'QualityAssessmentSkill',
                skillId: 'QualityAssessmentSkill_mock',
                input: {},
                required: false,
              },
            ],
            parallel: false,
            stopOnError: false,
          }),
          processSkillResults: async (request, orchestrationResult) => {
            // Should have one success, one failure
            expect(orchestrationResult.results.size).toBe(1);
            expect(orchestrationResult.errors.size).toBe(1);
            return { success: true, partial: true };
          },
        }
      );

      const result = await enhancedService.execute({ input: 'test' });
      expect(result).toBeDefined();
    });
  });
});

