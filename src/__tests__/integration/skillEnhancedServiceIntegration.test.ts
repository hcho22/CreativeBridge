/**
 * Skill Enhanced Service Integration Tests
 * 
 * Integration tests for Task 2.1: Skill-Enhanced Service Architecture
 */

import {
  SkillEnhancedServiceFactory,
  SkillEnhancedServiceConfig,
} from '../../services/base/SkillEnhancedService';
import { getClaudeSkillsManager } from '../../services/claudeSkillsManager';
import { SkillManager } from '../../types/claudeSkills';

describe('Skill Enhanced Service Integration', () => {
  let skillManager: SkillManager;

  beforeAll(async () => {
    skillManager = await getClaudeSkillsManager();
  });

  describe('Enhanced Services Integration', () => {
    test('Enhanced services integrate with existing app flow', async () => {
      // Create a mock service that simulates story generation
      const storyService = {
        execute: async (request: { prompt: string }) => {
          return {
            success: true,
            story: `Generated story: ${request.prompt}`,
            qualityScore: 0.8,
          };
        },
      };

      const config: SkillEnhancedServiceConfig = {
        enabled: true,
        skillTypes: ['ContentPredictionSkill', 'QualityAssessmentSkill'],
        fallbackEnabled: true,
        userId: 'test_user',
      };

      const enhancedService = SkillEnhancedServiceFactory.wrapService(
        storyService,
        skillManager,
        config,
        {
          buildSkillExecutionPlan: async (request) => {
            // Use skills to enhance story generation
            return {
              skills: [
                {
                  skillType: 'ContentPredictionSkill',
                  skillId: 'content_prediction_1',
                  input: { context: { storyContext: request.prompt } },
                  required: false,
                },
              ],
              parallel: false,
              stopOnError: false,
            };
          },
          processSkillResults: async (request, orchestrationResult) => {
            // Combine skill results with original service
            const originalResult = await storyService.execute(request);
            return {
              ...originalResult,
              enhanced: true,
              skillResults: Array.from(orchestrationResult.results.values()),
            };
          },
        }
      );

      const result = await enhancedService.execute({ prompt: 'A magical adventure' });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    test('Multiple enhanced services work together', async () => {
      // Create multiple services
      const service1 = {
        execute: async (req: { input: string }) => ({ result: `Service1: ${req.input}` }),
      };

      const service2 = {
        execute: async (req: { input: string }) => ({ result: `Service2: ${req.input}` }),
      };

      const config: SkillEnhancedServiceConfig = {
        enabled: true,
        skillTypes: ['ContentPredictionSkill'],
        fallbackEnabled: true,
      };

      const enhanced1 = SkillEnhancedServiceFactory.wrapService(
        service1,
        skillManager,
        config,
        {
          buildSkillExecutionPlan: async () => null,
          processSkillResults: async (req, _) => service1.execute(req),
        }
      );

      const enhanced2 = SkillEnhancedServiceFactory.wrapService(
        service2,
        skillManager,
        config,
        {
          buildSkillExecutionPlan: async () => null,
          processSkillResults: async (req, _) => service2.execute(req),
        }
      );

      // Use both services together
      const result1 = await enhanced1.execute({ input: 'test1' });
      const result2 = await enhanced2.execute({ input: 'test2' });

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(result1.result).toContain('Service1');
      expect(result2.result).toContain('Service2');
    });
  });

  describe('Error Handling', () => {
    test('Error handling propagates correctly through architecture', async () => {
      const failingService = {
        execute: async (req: { input: string }) => {
          throw new Error('Service error');
        },
      };

      const config: SkillEnhancedServiceConfig = {
        enabled: true,
        skillTypes: ['ContentPredictionSkill'],
        fallbackEnabled: true,
      };

      const enhancedService = SkillEnhancedServiceFactory.wrapService(
        failingService,
        skillManager,
        config,
        {
          buildSkillExecutionPlan: async () => ({
            skills: [
              {
                skillType: 'ContentPredictionSkill',
                skillId: 'test_skill',
                input: {},
                required: false,
              },
            ],
            parallel: false,
            stopOnError: false,
          }),
          processSkillResults: async () => {
            throw new Error('Processing error');
          },
        }
      );

      // Should handle errors gracefully
      await expect(
        enhancedService.execute({ input: 'test' })
      ).rejects.toThrow();
    });
  });

  describe('Service Dependencies', () => {
    test('Service dependencies resolve correctly', async () => {
      const dependentService = {
        execute: async (req: { input: string; dependency?: any }) => {
          if (req.dependency) {
            return { result: `With dependency: ${req.input}` };
          }
          return { result: `Without dependency: ${req.input}` };
        },
      };

      const config: SkillEnhancedServiceConfig = {
        enabled: true,
        skillTypes: ['ContentPredictionSkill'],
        fallbackEnabled: true,
      };

      const enhancedService = SkillEnhancedServiceFactory.wrapService(
        dependentService,
        skillManager,
        config,
        {
          buildSkillExecutionPlan: async (request) => {
            // Skills can provide dependencies
            return {
              skills: [
                {
                  skillType: 'ContentPredictionSkill',
                  skillId: 'dependency_provider',
                  input: { context: request },
                  required: false,
                },
              ],
              parallel: false,
              stopOnError: false,
            };
          },
          processSkillResults: async (request, orchestrationResult) => {
            // Extract dependency from skill results
            const dependency = orchestrationResult.results.size > 0
              ? { provided: true }
              : undefined;

            return dependentService.execute({
              ...request,
              dependency,
            });
          },
        }
      );

      const result = await enhancedService.execute({ input: 'test' });
      expect(result).toBeDefined();
    });
  });
});

