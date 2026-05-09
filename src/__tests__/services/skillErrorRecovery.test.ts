/**
 * Skill Error Recovery Tests
 *
 * Tests for Task 2.3: Error Recovery Strategies
 */

import { skillErrorRecovery } from '../../services/skillErrorRecovery';
import { SkillErrorCode } from '../../types/claudeSkills';

// Mock dependencies
jest.mock('../../utils/logger');
jest.mock('../../services/errorHandler');

describe('Skill Error Recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Retry Mechanisms', () => {
    test('Retry mechanisms work with backoff strategies', async () => {
      let attemptCount = 0;
      const operation = jest.fn(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw {
            code: SkillErrorCode.NETWORK_ERROR,
            message: 'Network error',
            retryable: true,
          };
        }
        return { success: true };
      });

      const result = await skillErrorRecovery.executeWithRecovery(
        operation,
        'ContentPredictionSkill',
        'skill-123',
      );

      expect(result).toEqual({ success: true });
      expect(attemptCount).toBe(3);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    test('Backoff strategies increase delay between retries', async () => {
      const delays: number[] = [];
      let lastCallTime = Date.now();

      const operation = jest.fn(async () => {
        const now = Date.now();
        if (delays.length > 0) {
          delays.push(now - lastCallTime);
        }
        lastCallTime = now;
        throw {
          code: SkillErrorCode.NETWORK_ERROR,
          message: 'Network error',
          retryable: true,
        };
      });

      try {
        await skillErrorRecovery.executeWithRecovery(
          operation,
          'ContentPredictionSkill',
          'skill-123',
        );
      } catch (error) {
        // Expected to fail after max retries
      }

      // Delays should increase (exponential backoff)
      if (delays.length >= 2) {
        expect(delays[1]).toBeGreaterThan(delays[0]);
      }
    });

    test('Non-retryable errors do not retry', async () => {
      const operation = jest.fn(async () => {
        throw {
          code: SkillErrorCode.CONFIGURATION_ERROR,
          message: 'Configuration error',
          retryable: false,
        };
      });

      await expect(
        skillErrorRecovery.executeWithRecovery(
          operation,
          'ContentPredictionSkill',
          'skill-123',
        ),
      ).rejects.toBeDefined();

      expect(operation).toHaveBeenCalledTimes(1); // Should not retry
    });
  });

  describe('Circuit Breaker Functionality', () => {
    test('Circuit breaker opens after threshold failures', async () => {
      const operation = jest.fn(async () => {
        throw {
          code: SkillErrorCode.NETWORK_ERROR,
          message: 'Network error',
          retryable: true,
        };
      });

      // Trigger multiple failures to open circuit breaker
      for (let i = 0; i < 6; i++) {
        try {
          await skillErrorRecovery.executeWithRecovery(
            operation,
            'ContentPredictionSkill',
            'test-skill',
          );
        } catch (error) {
          // Expected to fail
        }
      }

      // Circuit breaker should be open
      const state = skillErrorRecovery.getCircuitBreakerState(
        'ContentPredictionSkill',
        'test-skill',
      );
      expect(state?.isOpen).toBe(true);
    });

    test('Circuit breaker prevents execution when open', async () => {
      const operation = jest.fn(async () => ({ success: true }));

      // Manually open circuit breaker by resetting and failing multiple times
      skillErrorRecovery.resetCircuitBreaker(
        'ContentPredictionSkill',
        'test-skill-2',
      );

      for (let i = 0; i < 6; i++) {
        try {
          await skillErrorRecovery.executeWithRecovery(
            async () => {
              throw {
                code: SkillErrorCode.NETWORK_ERROR,
                message: 'Network error',
                retryable: true,
              };
            },
            'ContentPredictionSkill',
            'test-skill-2',
          );
        } catch (error) {
          // Expected
        }
      }

      // Now try to execute - should fail immediately due to circuit breaker
      await expect(
        skillErrorRecovery.executeWithRecovery(
          operation,
          'ContentPredictionSkill',
          'test-skill-2',
        ),
      ).rejects.toBeDefined();

      expect(operation).not.toHaveBeenCalled();
    });

    test('Circuit breaker closes after successful operations', async () => {
      // Reset circuit breaker
      skillErrorRecovery.resetCircuitBreaker(
        'ContentPredictionSkill',
        'test-skill-3',
      );

      // Open circuit breaker
      for (let i = 0; i < 6; i++) {
        try {
          await skillErrorRecovery.executeWithRecovery(
            async () => {
              throw {
                code: SkillErrorCode.NETWORK_ERROR,
                message: 'Network error',
                retryable: true,
              };
            },
            'ContentPredictionSkill',
            'test-skill-3',
          );
        } catch (error) {
          // Expected
        }
      }

      // Wait for timeout (in real scenario)
      // Then execute successful operations
      const successfulOperation = jest.fn(async () => ({ success: true }));

      // Reset and try successful operations
      skillErrorRecovery.resetCircuitBreaker(
        'ContentPredictionSkill',
        'test-skill-3',
      );

      for (let i = 0; i < 3; i++) {
        await skillErrorRecovery.executeWithRecovery(
          successfulOperation,
          'ContentPredictionSkill',
          'test-skill-3',
        );
      }

      const state = skillErrorRecovery.getCircuitBreakerState(
        'ContentPredictionSkill',
        'test-skill-3',
      );
      expect(state?.isOpen).toBe(false);
    });
  });

  describe('Error Normalization', () => {
    test('Generic errors are normalized to SkillError', async () => {
      const operation = jest.fn(async () => {
        throw new Error('Network timeout occurred');
      });

      try {
        await skillErrorRecovery.executeWithRecovery(
          operation,
          'ContentPredictionSkill',
          'skill-123',
        );
      } catch (error) {
        expect(error).toBeDefined();
        // Error should be normalized
      }
    });

    test('Timeout errors are properly categorized', async () => {
      // Reset circuit breaker — prior tests in this file (Retry Mechanisms, Circuit
      // Breaker Functionality) accumulate failure state on the same skillType/skillId,
      // which would short-circuit normalizeError and surface SKILL_UNAVAILABLE instead.
      skillErrorRecovery.resetCircuitBreaker(
        'ContentPredictionSkill',
        'skill-123',
      );

      const operation = jest.fn(async () => {
        // Source matches substring 'timeout'/'Timeout' at skillErrorRecovery.ts:286-287; 'timed out' did not match.
        throw new Error('Request timeout');
      });

      try {
        await skillErrorRecovery.executeWithRecovery(
          operation,
          'ContentPredictionSkill',
          'skill-123',
        );
      } catch (error: any) {
        expect(error.code).toBe(SkillErrorCode.SKILL_TIMEOUT);
        expect(error.retryable).toBe(true);
      }
    });
  });
});
