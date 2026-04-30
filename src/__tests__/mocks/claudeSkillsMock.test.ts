/**
 * Claude Skills Mock Infrastructure Tests
 *
 * Tests for Task 2.2: Enhanced Testing Infrastructure
 * Validates mock consistency, determinism, and performance simulation
 */

import {
  MockSkillManager,
  createMockSkillManager,
  MOCK_SKILL_RESPONSES,
  MOCK_EXECUTION_TIMES,
  MOCK_ERROR_SCENARIOS,
  SkillTestUtils,
} from './claudeSkillsMock';
import { SkillType, SkillErrorCode } from '../../types/claudeSkills';

describe('Claude Skills Mock Infrastructure', () => {
  let mockManager: MockSkillManager;

  beforeEach(() => {
    mockManager = createMockSkillManager();
  });

  describe('Mock Consistency', () => {
    test('Mocks provide consistent responses', async () => {
      await mockManager.initialize({
        apiKey: 'test_key',
        environment: 'development',
        enabledSkills: ['ContentPredictionSkill'],
        performanceMode: 'balanced',
      });

      const input = SkillTestUtils.createTestInput.ContentPredictionSkill();

      // Execute multiple times
      const results = await Promise.all([
        mockManager.executeSkill('ContentPredictionSkill_mock', input),
        mockManager.executeSkill('ContentPredictionSkill_mock', input),
        mockManager.executeSkill('ContentPredictionSkill_mock', input),
      ]);

      // All results should have same structure
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(
          SkillTestUtils.validateResponse.ContentPredictionSkill(result.data),
        ).toBe(true);
      });

      // Responses should be consistent (same confidence, similar structure)
      const confidences = results.map(r => r.confidence).filter(Boolean);
      if (confidences.length > 0) {
        const firstConfidence = confidences[0];
        confidences.forEach(conf => {
          expect(conf).toBeCloseTo(firstConfidence, 1);
        });
      }
    });

    test('Response format matches real skills', async () => {
      await mockManager.initialize({
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

      // Test each skill type
      const skillTypes: SkillType[] = [
        'ContentPredictionSkill',
        'QualityAssessmentSkill',
        'ResourceOptimizationSkill',
        'BehaviorAnalysisSkill',
        'ErrorRecoverySkill',
      ];

      for (const skillType of skillTypes) {
        const input = SkillTestUtils.createTestInput[skillType]();
        const result = await mockManager.executeSkill(
          `${skillType}_mock`,
          input,
        );

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(SkillTestUtils.validateResponse[skillType](result.data)).toBe(
          true,
        );
        expect(result.skillType).toBe(skillType);
        expect(result.executionTimeMs).toBeGreaterThan(0);
      }
    });

    test('Performance simulation accurate', async () => {
      await mockManager.initialize({
        apiKey: 'test_key',
        environment: 'development',
        enabledSkills: ['ContentPredictionSkill'],
        performanceMode: 'balanced',
      });

      const input = SkillTestUtils.createTestInput.ContentPredictionSkill();
      const startTime = Date.now();

      await mockManager.executeSkill('ContentPredictionSkill_mock', input);

      const actualTime = Date.now() - startTime;
      const expectedTime = MOCK_EXECUTION_TIMES.ContentPredictionSkill;

      // Should be within reasonable range (allowing for test overhead)
      expect(actualTime).toBeGreaterThanOrEqual(expectedTime - 50);
      expect(actualTime).toBeLessThan(expectedTime + 200);
    });
  });

  describe('Integration Test Coverage', () => {
    test('Integration tests cover all scenarios', async () => {
      await mockManager.initialize({
        apiKey: 'test_key',
        environment: 'development',
        enabledSkills: ['ContentPredictionSkill', 'QualityAssessmentSkill'],
        performanceMode: 'balanced',
      });

      // Test success scenario
      const successResult = await mockManager.executeSkill(
        'ContentPredictionSkill_mock',
        SkillTestUtils.createTestInput.ContentPredictionSkill(),
      );
      expect(successResult.success).toBe(true);

      // Test error scenario
      mockManager.setErrorSimulation(true, 'networkError');
      const errorResult = await mockManager.executeSkill(
        'ContentPredictionSkill_mock',
        SkillTestUtils.createTestInput.ContentPredictionSkill(),
      );
      expect(errorResult.success).toBe(false);
      expect(errorResult.error?.code).toBe(SkillErrorCode.NETWORK_ERROR);

      // Test timeout scenario
      mockManager.setErrorSimulation(true, 'timeoutError');
      const timeoutResult = await mockManager.executeSkill(
        'ContentPredictionSkill_mock',
        SkillTestUtils.createTestInput.ContentPredictionSkill(),
      );
      expect(timeoutResult.success).toBe(false);
      expect(timeoutResult.error?.code).toBe(SkillErrorCode.SKILL_TIMEOUT);
    });

    test('Failure mode coverage complete', async () => {
      await mockManager.initialize({
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
        mockManager.setErrorSimulation(true, failureMode);
        const result = await mockManager.executeSkill(
          'ContentPredictionSkill_mock',
          SkillTestUtils.createTestInput.ContentPredictionSkill(),
        );

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(MOCK_ERROR_SCENARIOS[failureMode].code);
      }
    });

    test('Edge case handling verified', async () => {
      await mockManager.initialize({
        apiKey: 'test_key',
        environment: 'development',
        enabledSkills: ['ContentPredictionSkill'],
        performanceMode: 'balanced',
      });

      // Test with empty input
      const emptyInput = {};
      const emptyResult = await mockManager.executeSkill(
        'ContentPredictionSkill_mock',
        emptyInput,
      );
      expect(emptyResult).toBeDefined();

      // Test with invalid skill ID
      const invalidResult = await mockManager.executeSkill(
        'invalid_skill_id',
        {},
      );
      expect(invalidResult.success).toBe(false);
      expect(invalidResult.error?.code).toBe(SkillErrorCode.SKILL_UNAVAILABLE);

      // Test before initialization
      const uninitializedManager = createMockSkillManager();
      await expect(
        uninitializedManager.executeSkill('test_skill', {}),
      ).rejects.toThrow();
    });
  });

  describe('Performance Regression Detection', () => {
    test('Baseline establishment works', async () => {
      await mockManager.initialize({
        apiKey: 'test_key',
        environment: 'development',
        enabledSkills: ['ContentPredictionSkill'],
        performanceMode: 'balanced',
      });

      const input = SkillTestUtils.createTestInput.ContentPredictionSkill();
      const executionTimes: number[] = [];

      // Run multiple times to establish baseline
      for (let i = 0; i < 10; i++) {
        const startTime = Date.now();
        await mockManager.executeSkill('ContentPredictionSkill_mock', input);
        executionTimes.push(Date.now() - startTime);
      }

      const averageTime =
        executionTimes.reduce((sum, time) => sum + time, 0) /
        executionTimes.length;
      const baseline = MOCK_EXECUTION_TIMES.ContentPredictionSkill;

      // Baseline should be close to expected execution time
      expect(averageTime).toBeGreaterThanOrEqual(baseline - 50);
      expect(averageTime).toBeLessThan(baseline + 200);
    });

    test('Regression detection sensitivity (20% slowdown)', async () => {
      await mockManager.initialize({
        apiKey: 'test_key',
        environment: 'development',
        enabledSkills: ['ContentPredictionSkill'],
        performanceMode: 'balanced',
      });

      const input = SkillTestUtils.createTestInput.ContentPredictionSkill();
      const baseline = MOCK_EXECUTION_TIMES.ContentPredictionSkill;
      const regressionThreshold = baseline * 1.2; // 20% slower

      // Simulate normal performance
      const normalStart = Date.now();
      await mockManager.executeSkill('ContentPredictionSkill_mock', input);
      const normalTime = Date.now() - normalStart;

      expect(normalTime).toBeLessThan(regressionThreshold);

      // Simulate regression (by adding delay)
      const slowManager = createMockSkillManager();
      await slowManager.initialize({
        apiKey: 'test_key',
        environment: 'development',
        enabledSkills: ['ContentPredictionSkill'],
        performanceMode: 'balanced',
      });

      // Manually add delay to simulate regression
      const slowStart = Date.now();
      await new Promise(resolve => setTimeout(resolve, baseline * 0.25)); // Add 25% delay
      await slowManager.executeSkill('ContentPredictionSkill_mock', input);
      const slowTime = Date.now() - slowStart;

      // Should detect regression
      expect(slowTime).toBeGreaterThan(regressionThreshold);
    });

    test('False positive rate acceptable', async () => {
      await mockManager.initialize({
        apiKey: 'test_key',
        environment: 'development',
        enabledSkills: ['ContentPredictionSkill'],
        performanceMode: 'balanced',
      });

      const input = SkillTestUtils.createTestInput.ContentPredictionSkill();
      const baseline = MOCK_EXECUTION_TIMES.ContentPredictionSkill;
      const regressionThreshold = baseline * 1.2;
      const falsePositives: number[] = [];

      // Run multiple times - should not trigger false positives
      for (let i = 0; i < 20; i++) {
        const startTime = Date.now();
        await mockManager.executeSkill('ContentPredictionSkill_mock', input);
        const executionTime = Date.now() - startTime;

        if (executionTime > regressionThreshold) {
          falsePositives.push(executionTime);
        }
      }

      // False positive rate should be low (< 10%)
      const falsePositiveRate = falsePositives.length / 20;
      expect(falsePositiveRate).toBeLessThan(0.1);
    });
  });
});
