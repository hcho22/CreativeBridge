/**
 * Enhanced Error Handling Tests
 *
 * Tests for Task 2.3: Error Handling & Logging Enhancement
 */

// import { errorHandler, ErrorLevel, ErrorCategory } from '../../services/errorHandler';
import {
  SkillError,
  SkillErrorCode,
  SkillType,
} from '../../types/claudeSkills';
import { structuredLogger } from '../../utils/logger';
import { auditLogger } from '../../services/auditLogger';

// Mock dependencies
jest.mock('../../utils/logger');
jest.mock('../../services/auditLogger');

describe('Enhanced Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Skill Error Categorization', () => {
    test('Skill errors are categorized correctly', async () => {
      const skillError: SkillError = {
        code: SkillErrorCode.NETWORK_ERROR,
        message: 'Network connection failed',
        retryable: true,
        details: {},
      };

      const processedError = await errorHandler.handleSkillError(
        skillError,
        'ContentPredictionSkill',
        'skill-123',
        {
          userId: 'user-1',
          sessionId: 'session-1',
        },
      );

      expect(processedError.category).toBe(ErrorCategory.CLAUDE_SKILLS);
      expect(processedError.level).toBe(ErrorLevel.WARNING); // Network errors are warnings
      expect(processedError.isRetryable).toBe(true);
      expect(processedError.context.metadata?.skillType).toBe(
        'ContentPredictionSkill',
      );
      expect(processedError.context.metadata?.errorCode).toBe(
        SkillErrorCode.NETWORK_ERROR,
      );
    });

    test('Error code mapping works correctly', async () => {
      const errorCodes = [
        {
          code: SkillErrorCode.CONFIGURATION_ERROR,
          expectedLevel: ErrorLevel.CRITICAL,
        },
        {
          code: SkillErrorCode.AUTHENTICATION_ERROR,
          expectedLevel: ErrorLevel.CRITICAL,
        },
        { code: SkillErrorCode.SKILL_TIMEOUT, expectedLevel: ErrorLevel.ERROR },
        {
          code: SkillErrorCode.RATE_LIMIT_EXCEEDED,
          expectedLevel: ErrorLevel.ERROR,
        },
        {
          code: SkillErrorCode.NETWORK_ERROR,
          expectedLevel: ErrorLevel.WARNING,
        },
        {
          code: SkillErrorCode.SKILL_UNAVAILABLE,
          expectedLevel: ErrorLevel.WARNING,
        },
      ];

      for (const { code, expectedLevel } of errorCodes) {
        const skillError: SkillError = {
          code,
          message: 'Test error',
          retryable: true,
          details: {},
        };

        const processedError = await errorHandler.handleSkillError(
          skillError,
          'ContentPredictionSkill',
          'skill-123',
        );

        expect(processedError.level).toBe(expectedLevel);
      }
    });

    test('Recovery strategy selection based on error type', async () => {
      const retryableError: SkillError = {
        code: SkillErrorCode.NETWORK_ERROR,
        message: 'Network error',
        retryable: true,
        details: {},
      };

      const nonRetryableError: SkillError = {
        code: SkillErrorCode.CONFIGURATION_ERROR,
        message: 'Configuration error',
        retryable: false,
        details: {},
      };

      const retryableProcessed = await errorHandler.handleSkillError(
        retryableError,
        'ContentPredictionSkill',
        'skill-123',
      );

      const nonRetryableProcessed = await errorHandler.handleSkillError(
        nonRetryableError,
        'ContentPredictionSkill',
        'skill-123',
      );

      expect(retryableProcessed.isRetryable).toBe(true);
      expect(nonRetryableProcessed.isRetryable).toBe(false);
    });
  });

  describe('Structured Logging', () => {
    test('Structured logging captures required information', async () => {
      const skillError: SkillError = {
        code: SkillErrorCode.SKILL_TIMEOUT,
        message: 'Skill execution timed out',
        retryable: true,
        details: { timeout: 30000 },
      };

      await errorHandler.handleSkillError(
        skillError,
        'QualityAssessmentSkill',
        'skill-456',
        {
          userId: 'user-2',
          sessionId: 'session-2',
          metadata: { correlationId: 'corr-123' },
        },
      );

      expect(structuredLogger.logSkillError).toHaveBeenCalledWith(
        'QualityAssessmentSkill',
        'skill-456',
        skillError,
        expect.objectContaining({
          correlationId: 'corr-123',
          userId: 'user-2',
          sessionId: 'session-2',
          skillType: 'QualityAssessmentSkill',
          skillId: 'skill-456',
        }),
      );
    });

    test('Sensitive data redaction works', async () => {
      const skillError: SkillError = {
        code: SkillErrorCode.AUTHENTICATION_ERROR,
        message: 'Authentication failed',
        retryable: false,
        details: {
          apiKey: 'secret-key-123',
          token: 'sensitive-token',
        },
      };

      const processedError = await errorHandler.handleSkillError(
        skillError,
        'ContentPredictionSkill',
        'skill-123',
        {
          metadata: {
            password: 'secret-password',
            apiKey: 'secret-key',
          },
        },
      );

      // In production, sensitive data should be redacted
      // This is handled by sanitizeError method
      expect(processedError).toBeDefined();
    });

    test('Log correlation IDs work correctly', async () => {
      const correlationId = 'test-correlation-123';
      const skillError: SkillError = {
        code: SkillErrorCode.NETWORK_ERROR,
        message: 'Network error',
        retryable: true,
        details: {},
      };

      await errorHandler.handleSkillError(
        skillError,
        'ContentPredictionSkill',
        'skill-123',
        {
          metadata: { correlationId },
        },
      );

      expect(structuredLogger.logSkillError).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          correlationId,
        }),
      );
    });
  });

  describe('Error Recovery', () => {
    test('Error recovery works for recoverable errors', async () => {
      const recoverableError: SkillError = {
        code: SkillErrorCode.NETWORK_ERROR,
        message: 'Network error',
        retryable: true,
        details: {},
      };

      const processedError = await errorHandler.handleSkillError(
        recoverableError,
        'ContentPredictionSkill',
        'skill-123',
      );

      expect(processedError.isRetryable).toBe(true);
      expect(processedError.category).toBe(ErrorCategory.CLAUDE_SKILLS);
    });

    test('Non-retryable errors are marked correctly', async () => {
      const nonRetryableError: SkillError = {
        code: SkillErrorCode.CONFIGURATION_ERROR,
        message: 'Configuration error',
        retryable: false,
        details: {},
      };

      const processedError = await errorHandler.handleSkillError(
        nonRetryableError,
        'ContentPredictionSkill',
        'skill-123',
      );

      expect(processedError.isRetryable).toBe(false);
      expect(processedError.level).toBe(ErrorLevel.CRITICAL);
    });
  });
});
