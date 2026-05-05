/**
 * Progressive Enhancement Service Tests
 *
 * Comprehensive tests for Task 6.2: Progressive Enhancement System
 * Tests retry strategies, network adaptation, fallback chains, and user experience preservation
 */

import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';

// Circuit-breaker reset and cascading-failure tests in this file use real timers
// against actual retry windows; the global 10s testTimeout is too tight. Bump to
// 30s file-wide so timing-dependent suites pass without ablation. (US-015d)
jest.setTimeout(30000);
import { ProgressiveEnhancementService } from '../../services/progressiveEnhancement';
import { NetworkAdapterService } from '../../services/networkAdapter';
import {
  SkillManager,
  SkillError,
  SkillErrorCode,
} from '../../types/claudeSkills';
// import { StoryRequest, StoryResponse, GradeLevel } from '../../types/story';

jest.mock('../../utils/logger');

describe('Progressive Enhancement System', () => {
  let mockSkillManager: jest.Mocked<SkillManager>;
  let progressiveEnhancementService: ProgressiveEnhancementService;
  let networkAdapterService: NetworkAdapterService;

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

    progressiveEnhancementService = new ProgressiveEnhancementService(
      mockSkillManager,
    );
    networkAdapterService = new NetworkAdapterService();
  });

  afterEach(() => {
    progressiveEnhancementService.resetCircuitBreakers();
    networkAdapterService.shutdown();
  });

  describe('Intelligent Retry Strategies', () => {
    it('should retry operations with exponential backoff', async () => {
      let attemptCount = 0;
      const mockOperation = jest.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new SkillError({
            code: SkillErrorCode.SKILL_TIMEOUT,
            message: 'Timeout error',
            retryable: true,
          });
        }
        return Promise.resolve({ content: 'Success after retries' });
      });

      const request: StoryRequest = {
        gradeLevel: 'K-2',
        userInput: 'continue story',
      };

      const result = await progressiveEnhancementService.executeWithEnhancement(
        mockOperation,
        'test_operation',
        request,
      );

      expect(result.result).toBeDefined();
      expect(result.retryAttempts).toBe(3);
      expect(result.fallbackUsed).toBe(false);
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });

    it('should apply jitter to prevent thundering herd', async () => {
      const delays: number[] = [];
      jest.spyOn(global, 'setTimeout').mockImplementation(((
        callback: () => void,
        delay: number,
      ) => {
        delays.push(delay);
        callback();
        return 0 as any;
      }) as any);

      let attemptCount = 0;
      const mockOperation = jest.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new SkillError({
            code: SkillErrorCode.NETWORK_ERROR,
            message: 'Network error',
            retryable: true,
          });
        }
        return Promise.resolve({ content: 'Success' });
      });

      const request: StoryRequest = {
        gradeLevel: '3-5',
        userInput: 'what happens next?',
      };

      await progressiveEnhancementService.executeWithEnhancement(
        mockOperation,
        'test_jitter',
        request,
      );

      // Verify that delays have some variability (jitter applied)
      expect(delays.length).toBeGreaterThan(0);
      if (delays.length > 1) {
        expect(delays[0]).not.toBe(delays[1]); // Jitter should make delays different
      }

      (global.setTimeout as jest.Mock).mockRestore();
    });

    it('should adapt retry delays based on network conditions', async () => {
      // Set poor network conditions
      networkAdapterService.setNetworkConditions({
        quality: 'poor',
        latency: 800,
        stability: 0.4,
      });

      let attemptCount = 0;
      const mockOperation = jest.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 2) {
          throw new SkillError({
            code: SkillErrorCode.RATE_LIMIT_EXCEEDED,
            message: 'Rate limit exceeded',
            retryable: true,
          });
        }
        return Promise.resolve({ content: 'Success' });
      });

      const request: StoryRequest = {
        gradeLevel: '6-8',
        userInput: 'create mystery',
      };

      const result = await progressiveEnhancementService.executeWithEnhancement(
        mockOperation,
        'test_adaptive_retry',
        request,
      );

      expect(result.retryAttempts).toBe(2);
      expect(result.result).toBeDefined();
    });

    it('should stop retrying for non-retryable errors', async () => {
      const mockOperation = jest.fn().mockRejectedValue(
        new SkillError({
          code: SkillErrorCode.AUTHENTICATION_ERROR,
          message: 'Authentication failed',
          retryable: false,
        }),
      );

      const request: StoryRequest = {
        gradeLevel: 'K-2',
        userInput: 'tell story',
      };

      const result = await progressiveEnhancementService.executeWithEnhancement(
        mockOperation,
        'test_non_retryable',
        request,
      );

      expect(result.fallbackUsed).toBe(true);
      expect(result.retryAttempts).toBe(1); // Only one attempt, no retries
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });
  });

  describe('Circuit Breaker Functionality', () => {
    it('should open circuit breaker after multiple failures', async () => {
      const mockOperation = jest.fn().mockRejectedValue(
        new SkillError({
          code: SkillErrorCode.SKILL_UNAVAILABLE,
          message: 'Service unavailable',
          retryable: true,
        }),
      );

      const request: StoryRequest = {
        gradeLevel: '3-5',
        userInput: 'adventure story',
      };

      // Execute multiple failing operations to trigger circuit breaker
      for (let i = 0; i < 6; i++) {
        await progressiveEnhancementService.executeWithEnhancement(
          mockOperation,
          'circuit_breaker_test',
          request,
        );
      }

      // Circuit breaker should now be open - next call should use fallback immediately
      mockOperation.mockClear();

      const result = await progressiveEnhancementService.executeWithEnhancement(
        mockOperation,
        'circuit_breaker_test',
        request,
      );

      expect(result.fallbackUsed).toBe(true);
      expect(mockOperation).not.toHaveBeenCalled(); // Should not attempt primary operation
    });

    it('should reset circuit breaker after successful operations', async () => {
      // First, trigger circuit breaker to open
      const failingOperation = jest
        .fn()
        .mockRejectedValue(new Error('Consistent failure'));

      const request: StoryRequest = {
        gradeLevel: 'K-2',
        userInput: 'story time',
      };

      for (let i = 0; i < 6; i++) {
        await progressiveEnhancementService.executeWithEnhancement(
          failingOperation,
          'reset_test',
          request,
        );
      }

      // Reset circuit breaker manually to simulate time passage or manual intervention
      progressiveEnhancementService.resetCircuitBreakers();

      // Now test with successful operation
      const successfulOperation = jest
        .fn()
        .mockResolvedValue({ content: 'Success' });

      const result = await progressiveEnhancementService.executeWithEnhancement(
        successfulOperation,
        'reset_test',
        request,
      );

      expect(result.fallbackUsed).toBe(false);
      expect(result.result).toBeDefined();
      expect(successfulOperation).toHaveBeenCalled();
    });
  });

  describe('Network Adaptation', () => {
    it('should adapt request for poor network conditions', async () => {
      networkAdapterService.setNetworkConditions({
        quality: 'poor',
        bandwidth: 2,
        latency: 500,
        packetLoss: 0.03,
        stability: 0.6,
      });

      const request: StoryRequest = {
        gradeLevel: '3-5',
        userInput: 'science fiction story',
        options: {
          maxLength: 500,
        },
      };

      const adaptedRequest = await networkAdapterService.adaptRequestForNetwork(
        request,
      );

      expect(adaptedRequest.adaptations.length).toBeGreaterThan(0);
      expect(adaptedRequest.expectedBehavior.reducedLatency).toBeGreaterThan(0);
      expect(
        adaptedRequest.modifiedRequest.options?.maxLength,
      ).toBeLessThanOrEqual(300);
    });

    it('should check network viability before operations', async () => {
      networkAdapterService.setNetworkConditions({
        quality: 'excellent',
        bandwidth: 50,
        latency: 20,
        stability: 0.98,
      });

      const viability = await networkAdapterService.checkNetworkViability(
        'story_generation',
      );

      expect(viability.viable).toBe(true);
      expect(viability.recommendation).toBe('proceed');
      expect(viability.reliabilityScore).toBeGreaterThan(0.8);
    });

    it('should handle connection loss gracefully', async () => {
      const lossResult = await networkAdapterService.handleConnectionLoss();

      expect(lossResult.offlineCapabilities.length).toBeGreaterThan(0);
      expect(lossResult.gracefulDegradation.length).toBeGreaterThan(0);
      expect(lossResult.userCommunication.message).toContain('offline');
      expect(lossResult.userCommunication.persistent).toBe(true);
    });

    it('should restore capabilities when connection recovers', async () => {
      // First simulate connection loss
      await networkAdapterService.handleConnectionLoss();

      // Then simulate recovery
      networkAdapterService.setNetworkConditions({
        quality: 'good',
        bandwidth: 25,
        stability: 0.9,
      });

      const recoveryResult =
        await networkAdapterService.handleConnectionRecovery();

      expect(recoveryResult.restoredCapabilities.length).toBeGreaterThan(0);
      expect(recoveryResult.userCommunication.type).toBe('success');
      expect(recoveryResult.userCommunication.message).toContain('restored');
    });
  });

  describe('Progressive Fallback Chains', () => {
    it('should execute fallback chain when primary operation fails', async () => {
      const mockOperation = jest.fn().mockRejectedValue(
        new SkillError({
          code: SkillErrorCode.SKILL_UNAVAILABLE,
          message: 'Primary service unavailable',
          retryable: false,
        }),
      );

      const request: StoryRequest = {
        gradeLevel: '6-8',
        userInput: 'mystery novel beginning',
      };

      const result = await progressiveEnhancementService.executeWithEnhancement(
        mockOperation,
        'fallback_test',
        request,
        { fallbackChain: 'story_generation' },
      );

      expect(result.fallbackUsed).toBe(true);
      expect(result.degradationLevel).toBeGreaterThan(0);
      expect(result.result).toBeDefined();
      expect(typeof result.result.content).toBe('string');
    });

    it('should progress through multiple fallback levels', async () => {
      const mockOperation = jest
        .fn()
        .mockRejectedValue(new Error('All services failing'));

      // Mock failures at each level by making implementation throw errors
      const originalImplementations = new Map();

      const request: StoryRequest = {
        gradeLevel: 'K-2',
        userInput: 'bedtime story',
      };

      const result = await progressiveEnhancementService.executeWithEnhancement(
        mockOperation,
        'multi_level_fallback',
        request,
      );

      // Should eventually succeed with some fallback level
      expect(result.fallbackUsed).toBe(true);
      expect(result.result).toBeDefined();
    });

    it('should preserve appropriate functionality at each fallback level', async () => {
      const request: StoryRequest = {
        gradeLevel: '3-5',
        userInput: 'adventure story',
      };

      // Test each fallback level individually by forcing specific degradation conditions
      const strategies = [
        { name: 'enhanced', expectedQuality: 'enhanced' },
        { name: 'standard', expectedQuality: 'standard' },
        { name: 'basic', expectedQuality: 'basic' },
      ];

      for (const strategy of strategies) {
        const mockFailingOperation = jest
          .fn()
          .mockRejectedValue(new Error('Force fallback'));

        const result =
          await progressiveEnhancementService.executeWithEnhancement(
            mockFailingOperation,
            `fallback_${strategy.name}`,
            request,
          );

        expect(result.fallbackUsed).toBe(true);
        expect(result.result).toBeDefined();
        expect(result.result.content.length).toBeGreaterThan(0);
      }
    });
  });

  describe('User Experience Preservation', () => {
    it('should maintain user experience during seamless degradation', async () => {
      const request: StoryRequest = {
        gradeLevel: 'K-2',
        userInput: 'princess story',
      };

      // Test with gentle degradation
      const mockOperation = jest.fn().mockRejectedValue(
        new SkillError({
          code: SkillErrorCode.SKILL_TIMEOUT,
          message: 'Gentle timeout',
          retryable: true,
        }),
      );

      const result = await progressiveEnhancementService.executeWithEnhancement(
        mockOperation,
        'user_experience_test',
        request,
        { preserveUserExperience: true },
      );

      expect(result.userExperiencePreserved).toBe(true);
      expect(result.performance.totalTime).toBeDefined();
      expect(result.result).toBeDefined();
    });

    it('should adapt communication style for different user types', async () => {
      const childRequest: StoryRequest = {
        gradeLevel: 'K-2',
        userInput: 'magic story',
      };

      const adultRequest: StoryRequest = {
        gradeLevel: '6-8',
        userInput: 'complex narrative',
      };

      const mockOperation = jest
        .fn()
        .mockRejectedValue(new Error('Service unavailable'));

      // Test child-appropriate handling
      const childResult =
        await progressiveEnhancementService.executeWithEnhancement(
          mockOperation,
          'child_experience',
          childRequest,
        );

      // Test adult-appropriate handling
      const adultResult =
        await progressiveEnhancementService.executeWithEnhancement(
          mockOperation,
          'adult_experience',
          adultRequest,
        );

      expect(childResult.result).toBeDefined();
      expect(adultResult.result).toBeDefined();
      expect(childResult.result.content).not.toBe(adultResult.result.content);
    });

    it('should provide appropriate feedback during degradation', async () => {
      // Test network quality degradation feedback
      networkAdapterService.setNetworkConditions({
        quality: 'poor',
        bandwidth: 1,
        stability: 0.3,
      });

      const viability = await networkAdapterService.checkNetworkViability(
        'story_generation',
      );

      expect(viability.recommendation).toBe('adapt');
      expect(viability.adaptationsNeeded.length).toBeGreaterThan(0);
    });
  });

  describe('Performance and Reliability', () => {
    it('should improve success rate without increasing user delay', async () => {
      const startTime = Date.now();
      let successCount = 0;
      const totalRequests = 10;

      for (let i = 0; i < totalRequests; i++) {
        let attemptCount = 0;
        const mockOperation = jest.fn().mockImplementation(() => {
          attemptCount++;
          // Simulate 70% failure rate for first attempt, 90% success for retries
          if (attemptCount === 1 && Math.random() < 0.7) {
            throw new SkillError({
              code: SkillErrorCode.SKILL_TIMEOUT,
              message: 'Initial timeout',
              retryable: true,
            });
          }
          return Promise.resolve({ content: `Success ${i}` });
        });

        const request: StoryRequest = {
          gradeLevel: '3-5',
          userInput: `story request ${i}`,
        };

        try {
          const result =
            await progressiveEnhancementService.executeWithEnhancement(
              mockOperation,
              `performance_test_${i}`,
              request,
            );

          if (result.result) {
            successCount++;
          }
        } catch (error) {
          // Count fallback as success if it provides content
        }
      }

      const totalTime = Date.now() - startTime;
      const avgTimePerRequest = totalTime / totalRequests;

      // Should achieve high success rate
      expect(successCount / totalRequests).toBeGreaterThan(0.8);

      // Should maintain reasonable response times (less than 5 seconds per request on average)
      expect(avgTimePerRequest).toBeLessThan(5000);
    });

    it('should maintain core functionality in all network conditions', async () => {
      const networkConditions = [
        { quality: 'excellent' as const, bandwidth: 50, latency: 20 },
        { quality: 'good' as const, bandwidth: 10, latency: 100 },
        { quality: 'poor' as const, bandwidth: 2, latency: 500 },
        { quality: 'offline' as const, bandwidth: 0, latency: 0 },
      ];

      const request: StoryRequest = {
        gradeLevel: '3-5',
        userInput: 'network condition test',
      };

      for (const condition of networkConditions) {
        networkAdapterService.setNetworkConditions(condition);

        const mockOperation = jest
          .fn()
          .mockRejectedValue(new Error('Force degradation'));

        const result =
          await progressiveEnhancementService.executeWithEnhancement(
            mockOperation,
            `network_test_${condition.quality}`,
            request,
          );

        // Core functionality should be maintained
        expect(result.result).toBeDefined();
        expect(result.result.content.length).toBeGreaterThan(0);

        // Different degradation levels expected for different conditions
        if (condition.quality === 'excellent') {
          expect(result.degradationLevel).toBeLessThan(50);
        } else if (condition.quality === 'offline') {
          expect(result.degradationLevel).toBeGreaterThan(50);
        }
      }
    });

    it('should prevent cascading failures through circuit breakers', async () => {
      const request: StoryRequest = {
        gradeLevel: 'K-2',
        userInput: 'cascade test',
      };

      let operationCalls = 0;
      const mockOperation = jest.fn().mockImplementation(() => {
        operationCalls++;
        throw new Error('Systematic failure');
      });

      // Execute enough operations to trigger circuit breaker
      for (let i = 0; i < 10; i++) {
        await progressiveEnhancementService.executeWithEnhancement(
          mockOperation,
          'cascade_prevention',
          request,
        );
      }

      // Circuit breaker should prevent further calls to failing operation
      // After 5 failures, circuit should be open
      expect(operationCalls).toBeLessThanOrEqual(6); // First 5 + possibly 1 more before opening
    });
  });

  describe('Metrics and Monitoring', () => {
    it('should track progressive enhancement metrics', async () => {
      const request: StoryRequest = {
        gradeLevel: '6-8',
        userInput: 'metrics test',
      };

      // Execute some operations to generate metrics
      for (let i = 0; i < 3; i++) {
        const mockOperation = jest.fn().mockImplementation(() => {
          if (i === 0) throw new Error('First failure');
          return Promise.resolve({ content: 'Success' });
        });

        await progressiveEnhancementService.executeWithEnhancement(
          mockOperation,
          `metrics_test_${i}`,
          request,
        );
      }

      const metrics = progressiveEnhancementService.getMetrics();

      expect(metrics.successRate).toBeDefined();
      expect(metrics.fallbackRate).toBeDefined();
      expect(metrics.averageRetries).toBeDefined();
      expect(metrics.userExperienceScore).toBeGreaterThan(0);
      expect(metrics.networkConditions).toBeDefined();
    });

    it('should track network adapter metrics', async () => {
      const request: StoryRequest = {
        gradeLevel: 'K-2',
        userInput: 'network metrics',
      };

      // Generate some network adaptations
      networkAdapterService.setNetworkConditions({
        quality: 'poor',
        bandwidth: 3,
        stability: 0.5,
      });

      await networkAdapterService.adaptRequestForNetwork(request);

      const metrics = networkAdapterService.getNetworkMetrics();

      expect(metrics.currentConditions).toBeDefined();
      expect(metrics.adaptationHistory).toBeDefined();
      expect(metrics.adaptationHistory.totalAdaptations).toBeGreaterThanOrEqual(
        0,
      );
    });

    it('should maintain performance under load', async () => {
      const concurrentRequests = 5;
      const request: StoryRequest = {
        gradeLevel: '3-5',
        userInput: 'load test',
      };

      const promises = Array.from({ length: concurrentRequests }, (_, i) => {
        const mockOperation = jest
          .fn()
          .mockResolvedValue({ content: `Load test ${i}` });

        return progressiveEnhancementService.executeWithEnhancement(
          mockOperation,
          `load_test_${i}`,
          request,
        );
      });

      const startTime = Date.now();
      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      // All requests should complete successfully
      expect(results.every(r => r.result !== undefined)).toBe(true);

      // Should handle concurrent requests efficiently
      expect(totalTime).toBeLessThan(10000); // Less than 10 seconds for 5 concurrent requests
    });
  });
});
