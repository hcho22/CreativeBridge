/**
 * Claude Skills Integration Test Framework
 *
 * Comprehensive integration test framework for Task 2.2
 * Tests skill integration across services and components
 */

import { getClaudeSkillsManager } from '../../services/claudeSkillsManager';
import { createMockSkillManager } from '../mocks/claudeSkillsMock';
import { SkillManager } from '../../types/claudeSkills';
import {
  SkillEnhancedServiceFactory,
  SkillEnhancedServiceConfig,
} from '../../services/base/SkillEnhancedService';
import { SkillTestUtils } from '../mocks/claudeSkillsMock';

describe('Claude Skills Integration Test Framework', () => {
  let mockSkillManager: SkillManager;

  beforeAll(async () => {
    await getClaudeSkillsManager();
    mockSkillManager = createMockSkillManager();
    await mockSkillManager.initialize({
      apiKey: 'test_key',
      environment: 'development',
      enabledSkills: [
        'ContentPredictionSkill',
        'QualityAssessmentSkill',
        'ResourceOptimizationSkill',
        'BehaviorAnalysisSkill',
        'ErrorRecoverySkill',
      ],
      performanceMode: 'balanced',
    });
  });

  describe('Service Integration', () => {
    test('Skills integrate with enhanced services', async () => {
      const mockService = {
        execute: async (request: { input: string }) => {
          return { result: `Original: ${request.input}` };
        },
      };

      const config: SkillEnhancedServiceConfig = {
        enabled: true,
        skillTypes: ['ContentPredictionSkill'],
        fallbackEnabled: true,
      };

      const enhancedService = SkillEnhancedServiceFactory.wrapService(
        mockService,
        mockSkillManager,
        config,
        {
          buildSkillExecutionPlan: async _request => {
            return {
              skills: [
                {
                  skillType: 'ContentPredictionSkill',
                  skillId: 'ContentPredictionSkill_mock',
                  input:
                    SkillTestUtils.createTestInput.ContentPredictionSkill(),
                  required: false,
                },
              ],
              parallel: false,
              stopOnError: false,
            };
          },
          processSkillResults: async (request, orchestrationResult) => {
            const skillData = orchestrationResult.results.get(
              'ContentPredictionSkill_mock',
            );
            return {
              result: `Enhanced: ${request.input}`,
              skillData: skillData?.data,
            };
          },
        },
      );

      const result = await enhancedService.execute({ input: 'test' });
      expect(result).toBeDefined();
      expect(result.result).toContain('Enhanced');
    });

    test('Skills work with multiple services simultaneously', async () => {
      const service1 = {
        execute: async (req: { id: number }) => ({ service: 1, id: req.id }),
      };
      const service2 = {
        execute: async (req: { id: number }) => ({ service: 2, id: req.id }),
      };

      const config: SkillEnhancedServiceConfig = {
        enabled: true,
        skillTypes: ['ContentPredictionSkill'],
        fallbackEnabled: true,
      };

      const enhanced1 = SkillEnhancedServiceFactory.wrapService(
        service1,
        mockSkillManager,
        config,
        {
          buildSkillExecutionPlan: async () => null,
          processSkillResults: async (req, _) => service1.execute(req),
        },
      );

      const enhanced2 = SkillEnhancedServiceFactory.wrapService(
        service2,
        mockSkillManager,
        config,
        {
          buildSkillExecutionPlan: async () => null,
          processSkillResults: async (req, _) => service2.execute(req),
        },
      );

      const [result1, result2] = await Promise.all([
        enhanced1.execute({ id: 1 }),
        enhanced2.execute({ id: 2 }),
      ]);

      expect(result1.service).toBe(1);
      expect(result2.service).toBe(2);
    });
  });

  describe('Error Handling Integration', () => {
    test('Error propagation through service layers', async () => {
      const mockService = {
        execute: async (_request: { input: string }) => {
          throw new Error('Service error');
        },
      };

      const config: SkillEnhancedServiceConfig = {
        enabled: true,
        skillTypes: ['ContentPredictionSkill'],
        fallbackEnabled: true,
      };

      // Configure mock to fail
      (mockSkillManager as any).setErrorSimulation(true, 'networkError');

      const enhancedService = SkillEnhancedServiceFactory.wrapService(
        mockService,
        mockSkillManager,
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
        },
      );

      // Should fall back to original service
      await expect(
        enhancedService.execute({ input: 'test' }),
      ).rejects.toThrow();
    });
  });

  describe('Performance Integration', () => {
    test('Skills maintain performance within acceptable limits', async () => {
      const mockService = {
        execute: async (request: { input: string }) => {
          return { result: request.input };
        },
      };

      const config: SkillEnhancedServiceConfig = {
        enabled: true,
        skillTypes: ['ContentPredictionSkill'],
        fallbackEnabled: true,
      };

      const enhancedService = SkillEnhancedServiceFactory.wrapService(
        mockService,
        mockSkillManager,
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
          processSkillResults: async (req, _) => mockService.execute(req),
        },
      );

      const startTime = performance.now();
      await enhancedService.execute({ input: 'test' });
      const executionTime = performance.now() - startTime;

      // Should complete within reasonable time (< 1 second)
      expect(executionTime).toBeLessThan(1000);
    });
  });
});
