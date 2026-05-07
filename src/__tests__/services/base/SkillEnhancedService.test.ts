/**
 * Skill Enhanced Service Architecture Tests
 *
 * Comprehensive tests for Task 2.1: Skill-Enhanced Service Architecture
 */

import {
  SkillEnhancedServiceFactory,
  SkillEnhancedServiceConfig,
} from '../../../services/base/SkillEnhancedService';
import { SkillManager, SkillErrorCode } from '../../../types/claudeSkills';

// Mock dependencies
jest.mock('../../../services/claudeSkillsMonitor');
jest.mock('../../../services/abTesting');

describe('Skill Enhanced Service Architecture', () => {
  // Mock skill manager
  const mockSkillManager: Partial<SkillManager> = {
    executeSkill: jest.fn(),
    isInitialized: jest.fn(() => true),
  };

  // Mock original service
  const mockOriginalService = {
    execute: jest.fn(async (request: any) => {
      return { success: true, data: `Original: ${request.input}` };
    }),
  };

  const defaultConfig: SkillEnhancedServiceConfig = {
    enabled: true,
    skillTypes: ['ContentPredictionSkill'],
    fallbackEnabled: true,
  };

  describe('Service Wrapper', () => {
    test('Service wrapper preserves original functionality', async () => {
      const wrappedService = SkillEnhancedServiceFactory.wrapService(
        mockOriginalService,
        mockSkillManager as SkillManager,
        defaultConfig,
        {
          buildSkillExecutionPlan: async () => null, // No skills
          processSkillResults: async () => ({ success: false }),
        },
      );

      const request = { input: 'test' };
      const result = await wrappedService.execute(request);

      // Should use original service when no skills
      expect(mockOriginalService.execute).toHaveBeenCalledWith(request);
      expect(result).toEqual({ success: true, data: 'Original: test' });
    });

    test('Interface compatibility maintained', async () => {
      const wrappedService = SkillEnhancedServiceFactory.wrapService(
        mockOriginalService,
        mockSkillManager as SkillManager,
        defaultConfig,
        {
          buildSkillExecutionPlan: async () => null,
          processSkillResults: async () => ({ success: false }),
        },
      );

      // Should have same interface
      expect(typeof wrappedService.execute).toBe('function');
      expect(typeof wrappedService.executeOriginal).toBe('function');
      expect(typeof wrappedService.areSkillsEnabled).toBe('function');
    });

    test('Performance overhead < 10ms per service call', async () => {
      const wrappedService = SkillEnhancedServiceFactory.wrapService(
        mockOriginalService,
        mockSkillManager as SkillManager,
        { ...defaultConfig, enabled: false }, // Disable skills to test overhead
        {
          buildSkillExecutionPlan: async () => null,
          processSkillResults: async () => ({ success: false }),
        },
      );

      const startTime = performance.now();
      await wrappedService.execute({ input: 'test' });
      const endTime = performance.now();

      const overhead = endTime - startTime;
      expect(overhead).toBeLessThan(10); // Should be very fast when skills disabled
    });
  });

  describe('Fallback Strategy', () => {
    test('Fallback strategy activates on skill failure', async () => {
      // Mock skill failure
      (mockSkillManager.executeSkill as jest.Mock).mockResolvedValue({
        success: false,
        error: {
          code: SkillErrorCode.NETWORK_ERROR,
          message: 'Network error',
          retryable: true,
        },
        executionTimeMs: 100,
        skillType: 'ContentPredictionSkill',
      });

      const wrappedService = SkillEnhancedServiceFactory.wrapService(
        mockOriginalService,
        mockSkillManager as SkillManager,
        defaultConfig,
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
            throw new Error('Skill failed');
          },
        },
      );

      const result = await wrappedService.execute({ input: 'test' });

      // Should fall back to original service
      expect(mockOriginalService.execute).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    test('Automatic fallback to original service', async () => {
      const wrappedService = SkillEnhancedServiceFactory.wrapService(
        mockOriginalService,
        mockSkillManager as SkillManager,
        defaultConfig,
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
            throw new Error('Processing failed');
          },
        },
      );

      // Mock skill to fail
      (mockSkillManager.executeSkill as jest.Mock).mockResolvedValue({
        success: false,
        error: {
          code: SkillErrorCode.SKILL_UNAVAILABLE,
          message: 'Skill unavailable',
          retryable: false,
        },
        executionTimeMs: 0,
        skillType: 'ContentPredictionSkill',
      });

      const result = await wrappedService.execute({ input: 'test' });

      // Should use original service
      expect(result).toBeDefined();
      expect(mockOriginalService.execute).toHaveBeenCalled();
    });

    test('Fallback strategy works for all failure modes', async () => {
      const failureModes = [
        SkillErrorCode.NETWORK_ERROR,
        SkillErrorCode.SKILL_TIMEOUT,
        SkillErrorCode.RATE_LIMIT_EXCEEDED,
        SkillErrorCode.SKILL_UNAVAILABLE,
        SkillErrorCode.CONFIGURATION_ERROR,
      ];

      for (const errorCode of failureModes) {
        (mockSkillManager.executeSkill as jest.Mock).mockResolvedValue({
          success: false,
          error: {
            code: errorCode,
            message: 'Test error',
            retryable: errorCode === SkillErrorCode.NETWORK_ERROR,
          },
          executionTimeMs: 0,
          skillType: 'ContentPredictionSkill',
        });

        const wrappedService = SkillEnhancedServiceFactory.wrapService(
          mockOriginalService,
          mockSkillManager as SkillManager,
          defaultConfig,
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
              throw new Error('Processing failed');
            },
          },
        );

        const result = await wrappedService.execute({ input: 'test' });
        expect(result).toBeDefined(); // Should always get a result via fallback
      }
    });
  });

  describe('Skill Orchestration', () => {
    test('Skill orchestration handles multiple skills', async () => {
      const skillResults = [
        {
          success: true,
          data: { prediction: 'result1' },
          executionTimeMs: 100,
          skillType: 'ContentPredictionSkill' as const,
        },
        {
          success: true,
          data: { quality: 0.9 },
          executionTimeMs: 150,
          skillType: 'QualityAssessmentSkill' as const,
        },
      ];

      let callCount = 0;
      (mockSkillManager.executeSkill as jest.Mock).mockImplementation(
        async () => {
          return skillResults[callCount++];
        },
      );

      const wrappedService = SkillEnhancedServiceFactory.wrapService(
        mockOriginalService,
        mockSkillManager as SkillManager,
        defaultConfig,
        {
          buildSkillExecutionPlan: async () => ({
            skills: [
              {
                skillType: 'ContentPredictionSkill',
                skillId: 'skill1',
                input: {},
                required: true,
              },
              {
                skillType: 'QualityAssessmentSkill',
                skillId: 'skill2',
                input: {},
                required: false,
              },
            ],
            parallel: false,
            stopOnError: false,
          }),
          processSkillResults: async (request, orchestrationResult) => {
            expect(orchestrationResult.results.size).toBe(2);
            return { success: true, combined: 'result' };
          },
        },
      );

      const result = await wrappedService.execute({ input: 'test' });
      expect(result).toBeDefined();
      expect(mockSkillManager.executeSkill).toHaveBeenCalledTimes(2);
    });

    test('Execution order respected in sequential mode', async () => {
      const executionOrder: string[] = [];

      (mockSkillManager.executeSkill as jest.Mock).mockImplementation(
        async (skillId: string) => {
          executionOrder.push(skillId);
          return {
            success: true,
            data: {},
            executionTimeMs: 50,
            skillType: 'ContentPredictionSkill' as const,
          };
        },
      );

      const wrappedService = SkillEnhancedServiceFactory.wrapService(
        mockOriginalService,
        mockSkillManager as SkillManager,
        defaultConfig,
        {
          buildSkillExecutionPlan: async () => ({
            skills: [
              {
                skillType: 'ContentPredictionSkill',
                skillId: 'skill1',
                input: {},
                required: true,
              },
              {
                skillType: 'QualityAssessmentSkill',
                skillId: 'skill2',
                input: {},
                dependsOn: ['skill1'],
                required: false,
              },
            ],
            parallel: false,
            stopOnError: false,
          }),
          processSkillResults: async () => ({ success: true }),
        },
      );

      await wrappedService.execute({ input: 'test' });

      // Should execute in order
      expect(executionOrder[0]).toBe('skill1');
      expect(executionOrder[1]).toBe('skill2');
    });

    test('Error propagation handled correctly', async () => {
      (mockSkillManager.executeSkill as jest.Mock).mockResolvedValue({
        success: false,
        error: {
          code: SkillErrorCode.SKILL_UNAVAILABLE,
          message: 'Skill unavailable',
          retryable: false,
        },
        executionTimeMs: 0,
        skillType: 'ContentPredictionSkill' as const,
      });

      const wrappedService = SkillEnhancedServiceFactory.wrapService(
        mockOriginalService,
        mockSkillManager as SkillManager,
        defaultConfig,
        {
          buildSkillExecutionPlan: async () => ({
            skills: [
              {
                skillType: 'ContentPredictionSkill',
                skillId: 'skill1',
                input: {},
                required: false, // Non-fatal
              },
            ],
            parallel: false,
            stopOnError: false,
          }),
          processSkillResults: async (request, orchestrationResult) => {
            // Should handle errors gracefully
            expect(orchestrationResult.errors.size).toBeGreaterThan(0);
            return { success: true, fallback: true };
          },
        },
      );

      const result = await wrappedService.execute({ input: 'test' });
      expect(result).toBeDefined();
    });
  });

  describe('Service Contracts', () => {
    test('Service contracts remain unchanged after enhancement', async () => {
      interface TestRequest {
        input: string;
      }

      interface TestResponse {
        success: boolean;
        data: string;
      }

      const originalService = {
        execute: async (request: TestRequest): Promise<TestResponse> => {
          return { success: true, data: request.input };
        },
      };

      const wrappedService = SkillEnhancedServiceFactory.wrapService(
        originalService,
        mockSkillManager as SkillManager,
        { ...defaultConfig, enabled: false }, // Disable to test contract
        {
          buildSkillExecutionPlan: async () => null,
          processSkillResults: async () => ({ success: false, data: '' }),
        },
      );

      const request: TestRequest = { input: 'test' };
      const result = await wrappedService.execute(request);

      // Contract should be preserved
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('data');
      expect(typeof result.success).toBe('boolean');
    });
  });
});
