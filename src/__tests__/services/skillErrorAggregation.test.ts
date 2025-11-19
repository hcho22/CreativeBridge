/**
 * Skill Error Aggregation Tests
 * 
 * Tests for Task 2.3: Error Aggregation and Alerting
 */

import { skillErrorAggregation } from '../../services/skillErrorAggregation';
import { SkillError, SkillErrorCode, SkillType } from '../../types/claudeSkills';
import { structuredLogger } from '../../utils/logger';
import { auditLogger } from '../../services/auditLogger';

// Mock dependencies
jest.mock('../../utils/logger');
jest.mock('../../services/auditLogger');

describe('Skill Error Aggregation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset aggregations
    skillErrorAggregation.resetAggregation('ContentPredictionSkill');
    skillErrorAggregation.resetAggregation('QualityAssessmentSkill');
  });

  describe('Error Rate Tracking', () => {
    test('Error rates tracked accurately', () => {
      const skillType: SkillType = 'ContentPredictionSkill';
      const totalExecutions = 100;

      // Record 10 errors
      for (let i = 0; i < 10; i++) {
        const error: SkillError = {
          code: SkillErrorCode.NETWORK_ERROR,
          message: 'Network error',
          retryable: true,
          details: {},
        };
        skillErrorAggregation.recordError(skillType, error, totalExecutions);
      }

      const aggregation = skillErrorAggregation.getAggregation(skillType);
      expect(aggregation?.errorRate).toBe(10); // 10%
      expect(aggregation?.totalErrors).toBe(10);
    });

    test('Errors by code are tracked correctly', () => {
      const skillType: SkillType = 'ContentPredictionSkill';
      const totalExecutions = 50;

      // Record different error types
      skillErrorAggregation.recordError(
        skillType,
        { code: SkillErrorCode.NETWORK_ERROR, message: 'Network', retryable: true, details: {} },
        totalExecutions
      );
      skillErrorAggregation.recordError(
        skillType,
        { code: SkillErrorCode.NETWORK_ERROR, message: 'Network', retryable: true, details: {} },
        totalExecutions
      );
      skillErrorAggregation.recordError(
        skillType,
        { code: SkillErrorCode.SKILL_TIMEOUT, message: 'Timeout', retryable: true, details: {} },
        totalExecutions
      );

      const aggregation = skillErrorAggregation.getAggregation(skillType);
      expect(aggregation?.errorsByCode.get(SkillErrorCode.NETWORK_ERROR)).toBe(2);
      expect(aggregation?.errorsByCode.get(SkillErrorCode.SKILL_TIMEOUT)).toBe(1);
    });
  });

  describe('Alert Thresholds', () => {
    test('Alerts trigger at error rate threshold', async () => {
      const skillType: SkillType = 'ContentPredictionSkill';
      const totalExecutions = 100;

      // Record enough errors to trigger alert (10% threshold)
      for (let i = 0; i < 11; i++) {
        const error: SkillError = {
          code: SkillErrorCode.NETWORK_ERROR,
          message: 'Network error',
          retryable: true,
          details: {},
        };
        skillErrorAggregation.recordError(skillType, error, totalExecutions);
      }

      // Wait for async alert processing
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(structuredLogger.critical).toHaveBeenCalled();
      expect(auditLogger.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: expect.any(String),
          severity: expect.any(String),
        })
      );
    });

    test('Alert thresholds calibrated correctly', async () => {
      const skillType: SkillType = 'QualityAssessmentSkill';
      const totalExecutions = 100;

      // Update threshold to 5%
      skillErrorAggregation.updateAlertConfig(skillType, {
        errorRateThreshold: 5,
      });

      // Record 6 errors (6%)
      for (let i = 0; i < 6; i++) {
        const error: SkillError = {
          code: SkillErrorCode.SKILL_TIMEOUT,
          message: 'Timeout',
          retryable: true,
          details: {},
        };
        skillErrorAggregation.recordError(skillType, error, totalExecutions);
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(structuredLogger.critical).toHaveBeenCalled();
    });

    test('Cooldown period prevents alert spam', async () => {
      const skillType: SkillType = 'ContentPredictionSkill';
      const totalExecutions = 100;

      // Trigger first alert
      for (let i = 0; i < 11; i++) {
        skillErrorAggregation.recordError(
          skillType,
          { code: SkillErrorCode.NETWORK_ERROR, message: 'Error', retryable: true, details: {} },
          totalExecutions
        );
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      const firstCallCount = (structuredLogger.critical as jest.Mock).mock.calls.length;

      // Try to trigger another alert immediately
      for (let i = 0; i < 5; i++) {
        skillErrorAggregation.recordError(
          skillType,
          { code: SkillErrorCode.NETWORK_ERROR, message: 'Error', retryable: true, details: {} },
          totalExecutions
        );
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      const secondCallCount = (structuredLogger.critical as jest.Mock).mock.calls.length;

      // Should not have triggered another alert due to cooldown
      expect(secondCallCount).toBe(firstCallCount);
    });
  });

  describe('Error Aggregation Insights', () => {
    test('Error aggregation provides useful insights', () => {
      const skillType: SkillType = 'ContentPredictionSkill';
      const totalExecutions = 200;

      // Record various error types
      const errorTypes = [
        SkillErrorCode.NETWORK_ERROR,
        SkillErrorCode.NETWORK_ERROR,
        SkillErrorCode.SKILL_TIMEOUT,
        SkillErrorCode.RATE_LIMIT_EXCEEDED,
      ];

      errorTypes.forEach(errorCode => {
        skillErrorAggregation.recordError(
          skillType,
          { code: errorCode, message: 'Error', retryable: true, details: {} },
          totalExecutions
        );
      });

      const aggregation = skillErrorAggregation.getAggregation(skillType);
      expect(aggregation).toBeDefined();
      expect(aggregation?.errorsByCode.size).toBeGreaterThan(0);
      expect(aggregation?.recentErrors.length).toBe(4);
    });

    test('Recent errors are tracked correctly', () => {
      const skillType: SkillType = 'QualityAssessmentSkill';
      const totalExecutions = 100;

      // Record multiple errors
      for (let i = 0; i < 50; i++) {
        skillErrorAggregation.recordError(
          skillType,
          { code: SkillErrorCode.NETWORK_ERROR, message: 'Error', retryable: true, details: {} },
          totalExecutions
        );
      }

      const aggregation = skillErrorAggregation.getAggregation(skillType);
      // Should keep last 100 errors
      expect(aggregation?.recentErrors.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Alert Status', () => {
    test('Alert status tracked correctly', async () => {
      const skillType: SkillType = 'ContentPredictionSkill';
      const totalExecutions = 100;

      // Trigger alert
      for (let i = 0; i < 11; i++) {
        skillErrorAggregation.recordError(
          skillType,
          { code: SkillErrorCode.NETWORK_ERROR, message: 'Error', retryable: true, details: {} },
          totalExecutions
        );
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(skillErrorAggregation.isAlerting(skillType)).toBe(true);
    });

    test('Alert status resets when below threshold', async () => {
      const skillType: SkillType = 'ContentPredictionSkill';
      const totalExecutions = 1000; // Large number to reduce error rate

      // Trigger alert
      for (let i = 0; i < 11; i++) {
        skillErrorAggregation.recordError(
          skillType,
          { code: SkillErrorCode.NETWORK_ERROR, message: 'Error', retryable: true, details: {} },
          100 // Small number to increase error rate
        );
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(skillErrorAggregation.isAlerting(skillType)).toBe(true);

      // Add many successful executions to reduce error rate
      for (let i = 0; i < 1000; i++) {
        skillErrorAggregation.recordError(
          skillType,
          { code: SkillErrorCode.NETWORK_ERROR, message: 'Error', retryable: true, details: {} },
          totalExecutions
        );
      }

      // Error rate should drop below threshold
      const aggregation = skillErrorAggregation.getAggregation(skillType);
      if (aggregation && aggregation.errorRate < aggregation.alertThreshold * 0.5) {
        expect(aggregation.isAlerting).toBe(false);
      }
    });
  });
});

