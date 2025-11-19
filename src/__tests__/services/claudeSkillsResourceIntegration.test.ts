/**
 * Claude Skills Resource Integration Tests
 * 
 * Specialized tests for Claude Skills integration in resource management
 * Task 4.1.1: Resource allocation skill integration
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import DynamicResourceManager from '../../services/resourceManager';
import { 
  SkillManager, 
  ResourceOptimizationInput,
  ResourceOptimizationResult,
  SkillResult,
  SkillErrorCode,
  SkillError
} from '../../types/claudeSkills';

jest.mock('react-native-device-info');
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  AppState: { addEventListener: jest.fn() },
}));

describe('Claude Skills Resource Integration', () => {
  let resourceManager: DynamicResourceManager;
  let mockSkillManager: jest.Mocked<SkillManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    resourceManager = new DynamicResourceManager();
    
    mockSkillManager = {
      initialize: jest.fn().mockResolvedValue(undefined),
      registerSkill: jest.fn().mockResolvedValue({
        skill: {
          id: 'resource-optimization',
          type: 'ResourceOptimizationSkill',
          version: '1.0.0',
          description: 'Resource optimization skill',
          inputSchema: {},
          outputSchema: {},
        },
        isEnabled: true,
        executionCount: 0,
        averageExecutionTime: 0,
        successRate: 1.0,
      }),
      executeSkill: jest.fn(),
      getSkillStatus: jest.fn().mockReturnValue('idle'),
      shutdown: jest.fn().mockResolvedValue(undefined),
      isInitialized: jest.fn().mockReturnValue(true),
    };
  });

  afterEach(() => {
    resourceManager.destroy();
  });

  describe('Skill Manager Integration', () => {
    it('should initialize with Claude Skills successfully', async () => {
      await resourceManager.initialize(mockSkillManager);

      expect(mockSkillManager.initialize).toHaveBeenCalledTimes(0); // ResourceManager doesn't call init
      expect(resourceManager.getCurrentStrategy()).toBeTruthy();
    });

    it('should handle skill manager unavailability gracefully', async () => {
      const result = await resourceManager.requestClaudeOptimization();
      expect(result).toBeNull();
    });

    it('should respect cooldown period between skill executions', async () => {
      await resourceManager.initialize(mockSkillManager);

      const mockResult: SkillResult<ResourceOptimizationResult> = {
        success: true,
        data: {
          recommendations: [],
          optimizations: [],
          estimatedImpact: {
            memorySavings: 0,
            batterySavings: 0,
            performanceImprovement: 0,
          },
        },
        executionTimeMs: 100,
        skillType: 'ResourceOptimizationSkill',
        confidence: 0.8,
      };

      mockSkillManager.executeSkill.mockResolvedValue(mockResult);

      // First call should execute
      const result1 = await resourceManager.requestClaudeOptimization();
      expect(result1).toBeTruthy();
      expect(mockSkillManager.executeSkill).toHaveBeenCalledTimes(1);

      // Second immediate call should be blocked by cooldown
      const result2 = await resourceManager.requestClaudeOptimization();
      expect(result2).toBeNull();
      expect(mockSkillManager.executeSkill).toHaveBeenCalledTimes(1);
    });

    it('should force optimization bypassing cooldown', async () => {
      await resourceManager.initialize(mockSkillManager);

      const mockResult: SkillResult<ResourceOptimizationResult> = {
        success: true,
        data: {
          recommendations: [],
          optimizations: [],
          estimatedImpact: {
            memorySavings: 0,
            batterySavings: 0,
            performanceImprovement: 0,
          },
        },
        executionTimeMs: 100,
        skillType: 'ResourceOptimizationSkill',
        confidence: 0.8,
      };

      mockSkillManager.executeSkill.mockResolvedValue(mockResult);

      // First call
      await resourceManager.requestClaudeOptimization();
      expect(mockSkillManager.executeSkill).toHaveBeenCalledTimes(1);

      // Force optimization should bypass cooldown
      const result = await resourceManager.forceOptimization();
      expect(result).toBeTruthy();
      expect(mockSkillManager.executeSkill).toHaveBeenCalledTimes(2);
    });
  });

  describe('Resource Optimization Input Generation', () => {
    beforeEach(async () => {
      await resourceManager.initialize(mockSkillManager);
    });

    it('should generate correct device info for skill input', async () => {
      const mockResult: SkillResult<ResourceOptimizationResult> = {
        success: true,
        data: {
          recommendations: [],
          optimizations: [],
          estimatedImpact: {
            memorySavings: 0,
            batterySavings: 0,
            performanceImprovement: 0,
          },
        },
        executionTimeMs: 100,
        skillType: 'ResourceOptimizationSkill',
      };

      mockSkillManager.executeSkill.mockResolvedValue(mockResult);

      await resourceManager.requestClaudeOptimization();

      expect(mockSkillManager.executeSkill).toHaveBeenCalledWith(
        'ResourceOptimizationSkill',
        expect.objectContaining({
          deviceInfo: expect.objectContaining({
            totalMemory: expect.any(Number),
            availableMemory: expect.any(Number),
            batteryLevel: expect.any(Number),
            networkType: expect.any(String),
            deviceTier: expect.stringMatching(/^(low|medium|high)$/),
          }),
          currentUsage: expect.objectContaining({
            memoryUsage: expect.any(Number),
            cpuUsage: expect.any(Number),
            activeBackgroundTasks: expect.any(Number),
          }),
        })
      );
    });

    it('should use safe defaults when device info is unavailable', async () => {
      // Mock DeviceInfo to throw errors
      const DeviceInfo = require('react-native-device-info');
      DeviceInfo.getTotalMemory.mockRejectedValue(new Error('Device info error'));
      DeviceInfo.getBatteryLevel.mockRejectedValue(new Error('Battery info error'));

      const mockResult: SkillResult<ResourceOptimizationResult> = {
        success: true,
        data: {
          recommendations: [],
          optimizations: [],
          estimatedImpact: {
            memorySavings: 0,
            batterySavings: 0,
            performanceImprovement: 0,
          },
        },
        executionTimeMs: 100,
        skillType: 'ResourceOptimizationSkill',
      };

      mockSkillManager.executeSkill.mockResolvedValue(mockResult);

      await resourceManager.requestClaudeOptimization();

      const call = mockSkillManager.executeSkill.mock.calls[0];
      const input = call[1] as ResourceOptimizationInput;

      // Should use safe defaults
      expect(input.deviceInfo.totalMemory).toBe(4 * 1024 * 1024 * 1024);
      expect(input.deviceInfo.batteryLevel).toBe(1.0);
    });
  });

  describe('Skill Result Processing', () => {
    beforeEach(async () => {
      await resourceManager.initialize(mockSkillManager);
    });

    it('should process memory optimization recommendations', async () => {
      const mockResult: SkillResult<ResourceOptimizationResult> = {
        success: true,
        data: {
          recommendations: [
            {
              type: 'memory',
              action: 'reduce_cache',
              priority: 'high',
              estimatedImpact: 0.8,
            },
          ],
          optimizations: [
            {
              parameter: 'memory_limit',
              currentValue: 100,
              recommendedValue: 80,
              reason: 'High memory pressure detected',
            },
          ],
          estimatedImpact: {
            memorySavings: 20 * 1024 * 1024,
            batterySavings: 0.1,
            performanceImprovement: 0.15,
          },
        },
        executionTimeMs: 150,
        skillType: 'ResourceOptimizationSkill',
        confidence: 0.9,
      };

      mockSkillManager.executeSkill.mockResolvedValue(mockResult);

      await resourceManager.requestClaudeOptimization();

      const strategy = resourceManager.getCurrentStrategy();
      expect(strategy.cacheStrategy).toBe('minimal');
      expect(strategy.memoryLimitMB).toBe(80);
    });

    it('should process CPU optimization recommendations', async () => {
      const mockResult: SkillResult<ResourceOptimizationResult> = {
        success: true,
        data: {
          recommendations: [
            {
              type: 'cpu',
              action: 'reduce_concurrent_operations',
              priority: 'medium',
              estimatedImpact: 0.6,
            },
          ],
          optimizations: [],
          estimatedImpact: {
            memorySavings: 0,
            batterySavings: 0.05,
            performanceImprovement: 0.1,
          },
        },
        executionTimeMs: 120,
        skillType: 'ResourceOptimizationSkill',
        confidence: 0.7,
      };

      mockSkillManager.executeSkill.mockResolvedValue(mockResult);

      const initialStrategy = resourceManager.getCurrentStrategy();
      const initialConcurrent = initialStrategy.maxConcurrentOperations;

      await resourceManager.requestClaudeOptimization();

      const newStrategy = resourceManager.getCurrentStrategy();
      expect(newStrategy.maxConcurrentOperations).toBe(
        Math.max(1, initialConcurrent - 1)
      );
    });

    it('should process battery optimization recommendations', async () => {
      const mockResult: SkillResult<ResourceOptimizationResult> = {
        success: true,
        data: {
          recommendations: [
            {
              type: 'battery',
              action: 'reduce_background_tasks',
              priority: 'high',
              estimatedImpact: 0.9,
            },
            {
              type: 'battery',
              action: 'reduce_animations',
              priority: 'medium',
              estimatedImpact: 0.5,
            },
          ],
          optimizations: [],
          estimatedImpact: {
            memorySavings: 0,
            batterySavings: 0.2,
            performanceImprovement: 0,
          },
        },
        executionTimeMs: 100,
        skillType: 'ResourceOptimizationSkill',
        confidence: 0.8,
      };

      mockSkillManager.executeSkill.mockResolvedValue(mockResult);

      await resourceManager.requestClaudeOptimization();

      const strategy = resourceManager.getCurrentStrategy();
      expect(strategy.enableBackgroundTasks).toBe(false);
      expect(strategy.animationComplexity).toBe('none');
    });

    it('should process network optimization recommendations', async () => {
      const mockResult: SkillResult<ResourceOptimizationResult> = {
        success: true,
        data: {
          recommendations: [
            {
              type: 'network',
              action: 'batch_requests',
              priority: 'medium',
              estimatedImpact: 0.4,
            },
          ],
          optimizations: [],
          estimatedImpact: {
            memorySavings: 0,
            batterySavings: 0.1,
            performanceImprovement: 0.05,
          },
        },
        executionTimeMs: 80,
        skillType: 'ResourceOptimizationSkill',
        confidence: 0.6,
      };

      mockSkillManager.executeSkill.mockResolvedValue(mockResult);

      await resourceManager.requestClaudeOptimization();

      const strategy = resourceManager.getCurrentStrategy();
      expect(strategy.networkRequestPriority).toBe('low');
    });

    it('should process multiple optimization types in single result', async () => {
      const mockResult: SkillResult<ResourceOptimizationResult> = {
        success: true,
        data: {
          recommendations: [
            {
              type: 'memory',
              action: 'increase_cache',
              priority: 'low',
              estimatedImpact: 0.3,
            },
            {
              type: 'cpu',
              action: 'increase_concurrent_operations',
              priority: 'medium',
              estimatedImpact: 0.5,
            },
          ],
          optimizations: [
            {
              parameter: 'image_quality',
              currentValue: 'medium',
              recommendedValue: 'high',
              reason: 'Device has sufficient resources',
            },
            {
              parameter: 'prefetching',
              currentValue: true,
              recommendedValue: false,
              reason: 'Network conditions are poor',
            },
          ],
          estimatedImpact: {
            memorySavings: -10 * 1024 * 1024, // Negative = more usage
            batterySavings: -0.05,
            performanceImprovement: 0.2,
          },
        },
        executionTimeMs: 200,
        skillType: 'ResourceOptimizationSkill',
        confidence: 0.85,
      };

      mockSkillManager.executeSkill.mockResolvedValue(mockResult);

      const initialStrategy = resourceManager.getCurrentStrategy();
      await resourceManager.requestClaudeOptimization();

      const newStrategy = resourceManager.getCurrentStrategy();
      
      // Should apply memory recommendation
      expect(newStrategy.cacheStrategy).toBe('aggressive');
      
      // Should apply CPU recommendation
      expect(newStrategy.maxConcurrentOperations).toBe(
        Math.min(4, initialStrategy.maxConcurrentOperations + 1)
      );
      
      // Should apply optimizations
      expect(newStrategy.imageQuality).toBe('high');
      expect(newStrategy.enablePrefetching).toBe(false);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await resourceManager.initialize(mockSkillManager);
    });

    it('should handle skill execution failure', async () => {
      const skillError: SkillError = {
        code: SkillErrorCode.NETWORK_ERROR,
        message: 'Network timeout',
        details: { timeout: 5000 },
        retryable: true,
      };

      mockSkillManager.executeSkill.mockRejectedValue(skillError);

      const result = await resourceManager.requestClaudeOptimization();
      expect(result).toBeNull();
    });

    it('should handle unsuccessful skill results', async () => {
      const mockResult: SkillResult<ResourceOptimizationResult> = {
        success: false,
        error: {
          code: SkillErrorCode.INVALID_INPUT,
          message: 'Invalid device information',
          details: {},
          retryable: false,
        },
        executionTimeMs: 50,
        skillType: 'ResourceOptimizationSkill',
      };

      mockSkillManager.executeSkill.mockResolvedValue(mockResult);

      const result = await resourceManager.requestClaudeOptimization();
      expect(result).toBeNull();
    });

    it('should handle malformed skill results', async () => {
      const mockResult = {
        success: true,
        data: null, // Malformed - no data
        executionTimeMs: 100,
        skillType: 'ResourceOptimizationSkill',
      } as SkillResult<ResourceOptimizationResult>;

      mockSkillManager.executeSkill.mockResolvedValue(mockResult);

      const result = await resourceManager.requestClaudeOptimization();
      expect(result).toBeNull();
    });

    it('should handle skill execution timeout', async () => {
      const skillError: SkillError = {
        code: SkillErrorCode.SKILL_TIMEOUT,
        message: 'Skill execution timed out',
        details: { timeoutMs: 30000 },
        retryable: true,
      };

      const mockResult: SkillResult<ResourceOptimizationResult> = {
        success: false,
        error: skillError,
        executionTimeMs: 30000,
        skillType: 'ResourceOptimizationSkill',
      };

      mockSkillManager.executeSkill.mockResolvedValue(mockResult);

      const result = await resourceManager.requestClaudeOptimization();
      expect(result).toBeNull();
    });
  });

  describe('Integration with Performance Optimizer', () => {
    beforeEach(async () => {
      const { performanceOptimizer } = require('../../services/performanceOptimizer');
      performanceOptimizer.enableResourceManagerIntegration = jest.fn();
      performanceOptimizer.updateSettings = jest.fn();
      performanceOptimizer.isResourceManagerIntegrated = jest.fn(() => true);
      
      await resourceManager.initialize(mockSkillManager);
    });

    it('should notify performance optimizer of resource manager integration', async () => {
      const { performanceOptimizer } = require('../../services/performanceOptimizer');
      
      // Integration should be enabled during initialization
      expect(performanceOptimizer.enableResourceManagerIntegration).toHaveBeenCalled();
    });

    it('should update performance optimizer settings when strategy changes', async () => {
      const { performanceOptimizer } = require('../../services/performanceOptimizer');
      
      const mockResult: SkillResult<ResourceOptimizationResult> = {
        success: true,
        data: {
          recommendations: [],
          optimizations: [
            {
              parameter: 'memory_limit',
              currentValue: 100,
              recommendedValue: 150,
              reason: 'Device can handle more memory usage',
            },
          ],
          estimatedImpact: {
            memorySavings: -50 * 1024 * 1024,
            batterySavings: 0,
            performanceImprovement: 0.1,
          },
        },
        executionTimeMs: 100,
        skillType: 'ResourceOptimizationSkill',
      };

      mockSkillManager.executeSkill.mockResolvedValue(mockResult);

      await resourceManager.requestClaudeOptimization();

      // Should update performance optimizer settings
      expect(performanceOptimizer.updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          maxConcurrentRequests: expect.any(Number),
          prefetchEnabled: expect.any(Boolean),
          backgroundProcessing: expect.any(Boolean),
          animationsEnabled: expect.any(Boolean),
          compressionLevel: expect.any(Number),
        })
      );
    });
  });

  describe('Confidence and Quality Metrics', () => {
    beforeEach(async () => {
      await resourceManager.initialize(mockSkillManager);
    });

    it('should respect skill confidence scores', async () => {
      const lowConfidenceResult: SkillResult<ResourceOptimizationResult> = {
        success: true,
        data: {
          recommendations: [
            {
              type: 'memory',
              action: 'reduce_cache',
              priority: 'high',
              estimatedImpact: 0.8,
            },
          ],
          optimizations: [],
          estimatedImpact: {
            memorySavings: 20 * 1024 * 1024,
            batterySavings: 0,
            performanceImprovement: 0,
          },
        },
        executionTimeMs: 100,
        skillType: 'ResourceOptimizationSkill',
        confidence: 0.2, // Very low confidence
      };

      mockSkillManager.executeSkill.mockResolvedValue(lowConfidenceResult);

      const initialStrategy = resourceManager.getCurrentStrategy();
      await resourceManager.requestClaudeOptimization();
      const newStrategy = resourceManager.getCurrentStrategy();

      // With very low confidence, changes should still be applied
      // (This tests that the system doesn't have confidence-based filtering yet)
      expect(newStrategy.cacheStrategy).toBe('minimal');
    });

    it('should track skill execution metrics', async () => {
      const mockResult: SkillResult<ResourceOptimizationResult> = {
        success: true,
        data: {
          recommendations: [],
          optimizations: [],
          estimatedImpact: {
            memorySavings: 0,
            batterySavings: 0,
            performanceImprovement: 0,
          },
        },
        executionTimeMs: 250, // Longer execution time
        skillType: 'ResourceOptimizationSkill',
        confidence: 0.95,
        metadata: {
          modelVersion: '1.2.3',
          requestId: 'test-request-123',
        },
      };

      mockSkillManager.executeSkill.mockResolvedValue(mockResult);

      await resourceManager.requestClaudeOptimization();

      // Should have logged execution metrics
      const { structuredLogger } = require('../../utils/logger');
      expect(structuredLogger.info).toHaveBeenCalledWith(
        'Claude optimization applied',
        expect.objectContaining({
          executionTime: 250,
          estimatedImpact: expect.any(Object),
        })
      );
    });
  });
});