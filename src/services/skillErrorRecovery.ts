/**
 * Claude Skills Error Recovery Strategies
 *
 * Implements automatic error recovery with retry mechanisms,
 * circuit breakers, and fallback strategies.
 */

import { SkillError, SkillErrorCode, SkillType } from '../types/claudeSkills';
import { structuredLogger } from '../utils/logger';
import { errorHandler } from './errorHandler';
// import { errorHandler, ErrorLevel } from './errorHandler';

export interface RecoveryStrategy {
  shouldRetry(error: SkillError, attempt: number): boolean;
  getRetryDelay(attempt: number): number;
  getMaxRetries(): number;
}

export interface CircuitBreakerState {
  isOpen: boolean;
  failureCount: number;
  lastFailureTime: number;
  successCount: number;
}

export class SkillErrorRecoveryService {
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5; // Open after 5 failures
  private readonly CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute
  private readonly CIRCUIT_BREAKER_SUCCESS_THRESHOLD = 2; // Close after 2 successes

  /**
   * Execute operation with automatic retry and recovery
   */
  async executeWithRecovery<T>(
    operation: () => Promise<T>,
    skillType: SkillType,
    skillId: string,
    context: {
      userId?: string;
      sessionId?: string;
      correlationId?: string;
    } = {},
  ): Promise<T> {
    const circuitBreakerKey = `${skillType}_${skillId}`;

    // Check circuit breaker
    if (this.isCircuitBreakerOpen(circuitBreakerKey)) {
      throw this.createCircuitBreakerError(skillType, skillId);
    }

    const strategy = this.getRecoveryStrategy(skillType);
    let lastError: SkillError | null = null;

    for (let attempt = 1; attempt <= strategy.getMaxRetries(); attempt++) {
      try {
        const result = await operation();

        // Record success
        this.recordSuccess(circuitBreakerKey);

        if (attempt > 1) {
          structuredLogger.info(
            `Skill operation recovered after ${attempt} attempts`,
            {
              skillType,
              skillId,
              attempts: attempt,
              ...context,
            },
          );
        }

        return result;
      } catch (error) {
        lastError = this.normalizeError(error, skillType);

        // Record failure
        this.recordFailure(circuitBreakerKey);

        // Log error
        structuredLogger.logSkillError(skillType, skillId, lastError, {
          ...context,
          skillType,
          skillId,
          metadata: {
            attempt,
            maxRetries: strategy.getMaxRetries(),
          },
        });

        // Check if should retry
        if (!strategy.shouldRetry(lastError, attempt)) {
          break;
        }

        // Wait before retry
        if (attempt < strategy.getMaxRetries()) {
          const delay = strategy.getRetryDelay(attempt);
          await this.delay(delay);
        }
      }
    }

    // All retries exhausted
    if (lastError) {
      await errorHandler.handleSkillError(lastError, skillType, skillId, {
        userId: context.userId,
        sessionId: context.sessionId,
        metadata: {
          correlationId: context.correlationId,
          retriesExhausted: true,
        },
      });
    }

    throw lastError || this.createUnknownError(skillType);
  }

  /**
   * Get recovery strategy for skill type
   */
  private getRecoveryStrategy(_skillType: SkillType): RecoveryStrategy {
    return {
      shouldRetry: (error: SkillError, attempt: number) => {
        // Don't retry non-retryable errors
        if (!error.retryable) {
          return false;
        }

        // Don't retry configuration or auth errors
        if (
          error.code === SkillErrorCode.CONFIGURATION_ERROR ||
          error.code === SkillErrorCode.AUTHENTICATION_ERROR
        ) {
          return false;
        }

        // Retry network errors up to max attempts
        if (error.code === SkillErrorCode.NETWORK_ERROR) {
          return attempt < 3;
        }

        // Retry timeout errors
        if (error.code === SkillErrorCode.SKILL_TIMEOUT) {
          return attempt < 2;
        }

        // Retry rate limit errors with longer delays
        if (error.code === SkillErrorCode.RATE_LIMIT_EXCEEDED) {
          return attempt < 2;
        }

        return attempt < 2; // Default: retry once
      },
      getRetryDelay: (attempt: number) => {
        // Exponential backoff with jitter
        const baseDelay = 1000; // 1 second
        const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
        const jitter = Math.random() * 1000; // 0-1 second jitter
        return exponentialDelay + jitter;
      },
      getMaxRetries: () => 3,
    };
  }

  /**
   * Check if circuit breaker is open
   */
  private isCircuitBreakerOpen(key: string): boolean {
    const state = this.circuitBreakers.get(key);
    if (!state || !state.isOpen) {
      return false;
    }

    // Check if timeout has passed
    const timeSinceLastFailure = Date.now() - state.lastFailureTime;
    if (timeSinceLastFailure > this.CIRCUIT_BREAKER_TIMEOUT) {
      // Half-open state - allow one attempt
      state.isOpen = false;
      return false;
    }

    return true;
  }

  /**
   * Record success for circuit breaker
   */
  private recordSuccess(key: string): void {
    const state =
      this.circuitBreakers.get(key) || this.createCircuitBreakerState();
    state.successCount++;
    state.failureCount = 0;

    // Close circuit breaker after threshold successes
    if (
      state.isOpen &&
      state.successCount >= this.CIRCUIT_BREAKER_SUCCESS_THRESHOLD
    ) {
      state.isOpen = false;
      state.successCount = 0;
      structuredLogger.info(`Circuit breaker closed for ${key}`);
    }

    this.circuitBreakers.set(key, state);
  }

  /**
   * Record failure for circuit breaker
   */
  private recordFailure(key: string): void {
    const state =
      this.circuitBreakers.get(key) || this.createCircuitBreakerState();
    state.failureCount++;
    state.lastFailureTime = Date.now();
    state.successCount = 0;

    // Open circuit breaker after threshold failures
    if (state.failureCount >= this.CIRCUIT_BREAKER_THRESHOLD) {
      state.isOpen = true;
      structuredLogger.warn(
        `Circuit breaker opened for ${key} after ${state.failureCount} failures`,
      );
    }

    this.circuitBreakers.set(key, state);
  }

  /**
   * Create circuit breaker state
   */
  private createCircuitBreakerState(): CircuitBreakerState {
    return {
      isOpen: false,
      failureCount: 0,
      lastFailureTime: 0,
      successCount: 0,
    };
  }

  /**
   * Create circuit breaker error
   */
  private createCircuitBreakerError(
    skillType: SkillType,
    skillId: string,
  ): SkillError {
    return {
      code: SkillErrorCode.SKILL_UNAVAILABLE,
      message: `Circuit breaker is open for ${skillType}. Service temporarily unavailable.`,
      retryable: true,
      details: {
        skillType,
        skillId,
        reason: 'circuit_breaker_open',
      },
    };
  }

  /**
   * Create unknown error
   */
  private createUnknownError(skillType: SkillType): SkillError {
    return {
      code: SkillErrorCode.UNKNOWN_ERROR,
      message: `Unknown error occurred for ${skillType}`,
      retryable: false,
      details: {
        skillType,
      },
    };
  }

  /**
   * Normalize error to SkillError
   */
  private normalizeError(error: any, skillType: SkillType): SkillError {
    if (this.isSkillError(error)) {
      return error;
    }

    // Convert generic errors to skill errors
    if (error instanceof Error) {
      if (
        error.message.includes('timeout') ||
        error.message.includes('Timeout')
      ) {
        return {
          code: SkillErrorCode.SKILL_TIMEOUT,
          message: error.message,
          retryable: true,
          details: { skillType, originalError: error.message },
        };
      }

      if (
        error.message.includes('network') ||
        error.message.includes('Network')
      ) {
        return {
          code: SkillErrorCode.NETWORK_ERROR,
          message: error.message,
          retryable: true,
          details: { skillType, originalError: error.message },
        };
      }
    }

    return {
      code: SkillErrorCode.UNKNOWN_ERROR,
      message: error?.message || 'Unknown error',
      retryable: false,
      details: { skillType, originalError: error },
    };
  }

  /**
   * Check if error is SkillError
   */
  private isSkillError(error: any): error is SkillError {
    return (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      'message' in error &&
      'retryable' in error
    );
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState(
    skillType: SkillType,
    skillId: string,
  ): CircuitBreakerState | undefined {
    const key = `${skillType}_${skillId}`;
    return this.circuitBreakers.get(key);
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(skillType: SkillType, skillId: string): void {
    const key = `${skillType}_${skillId}`;
    this.circuitBreakers.delete(key);
    structuredLogger.info(`Circuit breaker reset for ${key}`);
  }
}

// Export singleton instance
export const skillErrorRecovery = new SkillErrorRecoveryService();
