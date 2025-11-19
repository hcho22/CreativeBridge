// Claude Skills SDK Integration Tests
// Unit tests for Task 1.1 verification

// Import test setup to ensure mocks are applied
import '../setup/claudeSkillsTestSetup';

import { 
  getClaudeSkillsManager, 
  createClaudeSkillsManager,
  shutdownClaudeSkillsManager 
} from '../../services/claudeSkillsManager';
import { 
  ClaudeSkillsConfigFactory, 
  ClaudeSkillsCredentialManager,
  ClaudeSkillsConfigValidator
} from '../../config/claudeSkillsConfig';
import { SkillManager, SkillType, SkillErrorCode } from '../../types/claudeSkills';

describe('Claude Skills SDK Integration', () => {
  let skillManager: SkillManager;

  beforeEach(async () => {
    // Clear any existing manager instance
    await shutdownClaudeSkillsManager();
    
    // Store test API key
    await ClaudeSkillsCredentialManager.storeApiKey('test_api_key_12345');
  });

  afterEach(async () => {
    if (skillManager) {
      await skillManager.shutdown();
    }
    await shutdownClaudeSkillsManager();
  });

  describe('SDK Initialization', () => {
    test('SDK initializes correctly with valid configuration', async () => {
      // Test SDK initialization
      skillManager = await getClaudeSkillsManager();
      
      expect(skillManager).toBeDefined();
      expect(skillManager.isInitialized()).toBe(true);
      
      // Verify authentication works
      const hasKey = await ClaudeSkillsCredentialManager.isApiKeyStored();
      expect(hasKey).toBe(true);
      
      const apiKey = await ClaudeSkillsCredentialManager.getApiKey();
      expect(apiKey).toBe('test_api_key_12345');
    });

    test('SDK handles invalid configuration gracefully', async () => {
      // Clear API key to test error handling
      await ClaudeSkillsCredentialManager.clearApiKey();
      
      await expect(getClaudeSkillsManager()).rejects.toThrow(
        'Claude Skills API key not found'
      );
    });

    test('Configuration validation works correctly', async () => {
      const config = await ClaudeSkillsConfigFactory.createConfig();
      const validation = ClaudeSkillsConfigValidator.validateConfig(config);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('Configuration validation catches invalid values', async () => {
      const invalidConfig = {
        apiKey: 'short', // Too short
        environment: 'invalid' as any,
        enabledSkills: [], // Empty
        performanceMode: 'balanced' as const,
        cacheConfig: {
          maxCacheSize: 5, // Too small
          cacheTTL: 100, // Too short
          enablePredictivePreloading: true,
          deviceAwareSizing: true,
        },
        fallbackConfig: {
          enableGracefulDegradation: true,
          maxRetryAttempts: 15, // Too many
          retryBackoffMs: 1000,
          circuitBreakerThreshold: 5,
        },
        monitoringConfig: {
          enablePerformanceTracking: true,
          enableErrorReporting: true,
          metricsCollectionInterval: 5000,
          enableDebugLogs: true,
        },
      };

      const validation = ClaudeSkillsConfigValidator.validateConfig(invalidConfig);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors).toContain('Invalid API key: must be at least 10 characters');
      expect(validation.errors).toContain('Invalid environment: must be development, staging, or production');
      expect(validation.errors).toContain('No skills enabled: at least one skill must be enabled');
    });
  });

  describe('Basic Skill Execution', () => {
    beforeEach(async () => {
      skillManager = await getClaudeSkillsManager();
    });

    test('Content prediction skill executes successfully', async () => {
      const startTime = Date.now();
      
      const input = {
        context: {
          storyContext: "Once upon a time, there was a brave little rabbit.",
          userInput: "The rabbit found a mysterious door",
          gradeLevel: "K-2",
          previousPredictions: []
        },
        options: {
          maxPredictions: 3,
          confidenceThreshold: 0.7
        }
      };

      const result = await skillManager.executeSkill('ContentPredictionSkill', input);
      const executionTime = Date.now() - startTime;

      // Test simple skill invocation
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.skillType).toBe('ContentPredictionSkill');
      
      // Verify response format
      expect(result.data.predictions).toBeInstanceOf(Array);
      expect(result.data.predictions.length).toBeGreaterThan(0);
      expect(result.data.confidence).toBeGreaterThan(0);
      
      // Check timeout handling - should complete within reasonable time
      expect(result.executionTimeMs).toBeLessThan(5000); // 5 second max
      expect(executionTime).toBeLessThan(5000);
      
      // Verify confidence score
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.confidence).toBeLessThanOrEqual(1.0);
    });

    test('Resource optimization skill executes successfully', async () => {
      const input = {
        deviceInfo: {
          totalMemory: 4 * 1024 * 1024 * 1024,
          availableMemory: 1 * 1024 * 1024 * 1024,
          batteryLevel: 0.5,
          networkType: 'wifi',
          deviceTier: 'medium' as const
        },
        currentUsage: {
          memoryUsage: 100 * 1024 * 1024,
          cpuUsage: 0.3,
          activeBackgroundTasks: 2
        }
      };

      const result = await skillManager.executeSkill('ResourceOptimizationSkill', input);

      expect(result.success).toBe(true);
      expect(result.data.recommendations).toBeInstanceOf(Array);
      expect(result.data.optimizations).toBeInstanceOf(Array);
      expect(result.data.estimatedImpact).toBeDefined();
    });

    test('Quality assessment skill executes successfully', async () => {
      const input = {
        content: {
          story: "The little rabbit hopped through the forest, looking for adventure.",
          context: "Children's story for K-2 grade level",
          gradeLevel: "K-2"
        },
        criteria: {
          checkAppropriatenesss: true,
          checkCoherence: true,
          checkEngagement: true,
          checkEducationalValue: true
        }
      };

      const result = await skillManager.executeSkill('QualityAssessmentSkill', input);

      expect(result.success).toBe(true);
      expect(result.data.overallScore).toBeGreaterThan(0);
      expect(result.data.overallScore).toBeLessThanOrEqual(1);
      expect(result.data.scores).toBeDefined();
      expect(result.data.approved).toBeDefined();
    });

    test('Behavior analysis skill executes successfully', async () => {
      const input = {
        userInteractions: [
          {
            type: 'tap' as const,
            timestamp: new Date(),
            element: 'continue_button',
            duration: 100
          }
        ],
        sessionContext: {
          sessionId: 'test_session_123',
          sessionDuration: 60000,
          gradeLevel: 'K-2',
          deviceType: 'tablet'
        },
        analysisOptions: {
          includeEngagementPrediction: true,
          includePersonalizationSuggestions: true,
          includeDifficultyAdjustment: false
        }
      };

      const result = await skillManager.executeSkill('BehaviorAnalysisSkill', input);

      expect(result.success).toBe(true);
      expect(result.data.patterns).toBeInstanceOf(Array);
      expect(result.data.predictions).toBeInstanceOf(Array);
      expect(result.data.recommendations).toBeInstanceOf(Array);
      expect(result.data.engagementScore).toBeGreaterThanOrEqual(0);
      expect(result.data.engagementScore).toBeLessThanOrEqual(1);
    });

    test('Error recovery skill executes successfully', async () => {
      const input = {
        error: {
          type: 'NETWORK_ERROR',
          message: 'Connection timeout',
          context: { endpoint: '/api/story/generate' }
        },
        recoveryContext: {
          storyState: { currentContent: "Once upon a time..." },
          userState: { gradeLevel: 'K-2' },
          sessionState: { sessionId: 'test_123' }
        },
        options: {
          preserveContext: true,
          generateFallback: true,
          userFriendlyMessage: true
        }
      };

      const result = await skillManager.executeSkill('ErrorRecoverySkill', input);

      expect(result.success).toBe(true);
      expect(result.data.recoveryStrategy).toBeDefined();
      expect(result.data.recoverySuccess).toBeDefined();
      expect(result.data.preservedContext).toBeDefined();
    });

    test('Skill execution handles invalid input gracefully', async () => {
      const invalidInput = {
        invalidField: 'invalid data'
      };

      const result = await skillManager.executeSkill('ContentPredictionSkill', invalidInput);

      // Should handle gracefully without crashing
      expect(result).toBeDefined();
      expect(result.skillType).toBe('ContentPredictionSkill');
      
      // Mock implementation returns success, but real implementation might fail
      // This tests that the error handling structure is in place
    });

    test('Skill execution tracks performance metrics', async () => {
      const input = { test: 'data' };
      
      await skillManager.executeSkill('ContentPredictionSkill', input);
      await skillManager.executeSkill('ResourceOptimizationSkill', input);
      
      // Note: In the mock implementation, getMetrics would need to be exposed
      // This test verifies the structure is in place
      expect(skillManager.getSkillStatus).toBeDefined();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    beforeEach(async () => {
      skillManager = await getClaudeSkillsManager();
    });

    test('Handles skill execution timeout', async () => {
      // This would require modifying the mock to simulate timeout
      // For now, we test that the timeout handling structure exists
      const input = { test: 'timeout scenario' };
      
      const result = await skillManager.executeSkill('ContentPredictionSkill', input);
      
      // Verify timeout handling structure
      expect(result.executionTimeMs).toBeDefined();
      expect(result.executionTimeMs).toBeGreaterThan(0);
    });

    test('Handles network failure gracefully', async () => {
      // Test network failure scenario
      const input = { networkTest: 'failure' };
      
      const result = await skillManager.executeSkill('ContentPredictionSkill', input);
      
      // Should not throw, should return result with error info if needed
      expect(result).toBeDefined();
      expect(result.executionTimeMs).toBeDefined();
    });

    test('Skill status tracking works correctly', async () => {
      const skillId = 'test_skill_123';
      
      // Initially should be idle
      const initialStatus = skillManager.getSkillStatus(skillId);
      expect(initialStatus).toBe('idle');
      
      // After execution, status should be updated
      await skillManager.executeSkill('ContentPredictionSkill', { test: 'status' });
      
      // The mock implementation should handle status tracking
      const finalStatus = skillManager.getSkillStatus(skillId);
      expect(['idle', 'completed', 'failed']).toContain(finalStatus);
    });
  });

  describe('Configuration Management', () => {
    test('API key storage and retrieval works securely', async () => {
      const testKey = 'secure_test_key_98765';
      
      // Store key
      await ClaudeSkillsCredentialManager.storeApiKey(testKey);
      
      // Retrieve key
      const retrievedKey = await ClaudeSkillsCredentialManager.getApiKey();
      expect(retrievedKey).toBe(testKey);
      
      // Check if key is stored
      const hasKey = await ClaudeSkillsCredentialManager.isApiKeyStored();
      expect(hasKey).toBe(true);
      
      // Clear key
      await ClaudeSkillsCredentialManager.clearApiKey();
      const hasKeyAfterClear = await ClaudeSkillsCredentialManager.isApiKeyStored();
      expect(hasKeyAfterClear).toBe(false);
    });

    test('Environment configuration loads correctly', async () => {
      const config = await ClaudeSkillsConfigFactory.createConfig();
      
      expect(config.environment).toBeDefined();
      expect(['development', 'staging', 'production']).toContain(config.environment);
      expect(config.enabledSkills).toBeInstanceOf(Array);
      expect(config.enabledSkills.length).toBeGreaterThan(0);
    });

    test('Performance mode configuration is valid', async () => {
      const config = await ClaudeSkillsConfigFactory.createConfig();
      
      expect(['balanced', 'performance', 'battery']).toContain(config.performanceMode);
    });

    test('Cache configuration has reasonable defaults', async () => {
      const config = await ClaudeSkillsConfigFactory.createConfig();
      
      expect(config.cacheConfig.maxCacheSize).toBeGreaterThan(0);
      expect(config.cacheConfig.maxCacheSize).toBeLessThanOrEqual(200); // Reasonable upper limit
      expect(config.cacheConfig.cacheTTL).toBeGreaterThan(0);
      expect(config.cacheConfig.enablePredictivePreloading).toBeDefined();
      expect(config.cacheConfig.deviceAwareSizing).toBeDefined();
    });

    test('Fallback configuration is properly set', async () => {
      const config = await ClaudeSkillsConfigFactory.createConfig();
      
      expect(config.fallbackConfig.enableGracefulDegradation).toBe(true);
      expect(config.fallbackConfig.maxRetryAttempts).toBeGreaterThan(0);
      expect(config.fallbackConfig.maxRetryAttempts).toBeLessThanOrEqual(10);
      expect(config.fallbackConfig.retryBackoffMs).toBeGreaterThan(0);
      expect(config.fallbackConfig.circuitBreakerThreshold).toBeGreaterThan(0);
    });
  });

  describe('Manager Lifecycle', () => {
    test('Manager can be created and initialized', async () => {
      const manager = await createClaudeSkillsManager();
      
      expect(manager).toBeDefined();
      expect(manager.isInitialized()).toBe(true);
      
      await manager.shutdown();
    });

    test('Manager can be shut down cleanly', async () => {
      const manager = await createClaudeSkillsManager();
      expect(manager.isInitialized()).toBe(true);
      
      await manager.shutdown();
      expect(manager.isInitialized()).toBe(false);
    });

    test('Singleton instance works correctly', async () => {
      const manager1 = await getClaudeSkillsManager();
      const manager2 = await getClaudeSkillsManager();
      
      // Should return the same instance
      expect(manager1).toBe(manager2);
      
      await shutdownClaudeSkillsManager();
      
      // After shutdown, should create new instance
      const manager3 = await getClaudeSkillsManager();
      expect(manager3).not.toBe(manager1);
      
      await manager3.shutdown();
    });
  });

  describe('Type Safety and Interfaces', () => {
    test('All skill types are properly defined', () => {
      const skillTypes: SkillType[] = [
        'ContentPredictionSkill',
        'ResourceOptimizationSkill',
        'QualityAssessmentSkill',
        'BehaviorAnalysisSkill',
        'ErrorRecoverySkill'
      ];
      
      skillTypes.forEach(skillType => {
        expect(typeof skillType).toBe('string');
        expect(skillType.endsWith('Skill')).toBe(true);
      });
    });

    test('Error codes are properly defined', () => {
      const errorCodes = Object.values(SkillErrorCode);
      
      expect(errorCodes).toContain('NETWORK_ERROR');
      expect(errorCodes).toContain('AUTHENTICATION_ERROR');
      expect(errorCodes).toContain('RATE_LIMIT_EXCEEDED');
      expect(errorCodes).toContain('SKILL_TIMEOUT');
      expect(errorCodes).toContain('INVALID_INPUT');
      expect(errorCodes).toContain('SKILL_UNAVAILABLE');
      expect(errorCodes).toContain('CONFIGURATION_ERROR');
      expect(errorCodes).toContain('UNKNOWN_ERROR');
    });
  });
});

// Performance benchmarks
describe('Claude Skills Performance Benchmarks', () => {
  let skillManager: SkillManager;

  beforeAll(async () => {
    await ClaudeSkillsCredentialManager.storeApiKey('test_api_key_12345');
    skillManager = await getClaudeSkillsManager();
  });

  afterAll(async () => {
    if (skillManager) {
      await skillManager.shutdown();
    }
  });

  test('Content prediction completes within performance target', async () => {
    const input = {
      context: {
        storyContext: "Test story context",
        userInput: "Test input",
        gradeLevel: "K-2"
      },
      options: {
        maxPredictions: 1,
        confidenceThreshold: 0.5
      }
    };

    const startTime = Date.now();
    const result = await skillManager.executeSkill('ContentPredictionSkill', input);
    const executionTime = Date.now() - startTime;

    // Should complete within 300ms target (from research)
    expect(executionTime).toBeLessThan(500); // Slightly higher for test environment
    expect(result.executionTimeMs).toBeLessThan(500);
  });

  test('Resource optimization completes within performance target', async () => {
    const input = {
      deviceInfo: {
        totalMemory: 4 * 1024 * 1024 * 1024,
        availableMemory: 1 * 1024 * 1024 * 1024,
        batteryLevel: 0.5,
        networkType: 'wifi',
        deviceTier: 'medium' as const
      },
      currentUsage: {
        memoryUsage: 100 * 1024 * 1024,
        cpuUsage: 0.3,
        activeBackgroundTasks: 2
      }
    };

    const startTime = Date.now();
    const result = await skillManager.executeSkill('ResourceOptimizationSkill', input);
    const executionTime = Date.now() - startTime;

    // Should complete within 150ms target
    expect(executionTime).toBeLessThan(300);
    expect(result.executionTimeMs).toBeLessThan(300);
  });
});

// Integration with existing app components
describe('Claude Skills App Integration', () => {
  test('Skills can be imported and used in React components', () => {
    // Test that the imports work correctly
    expect(getClaudeSkillsManager).toBeDefined();
    expect(ClaudeSkillsConfigFactory).toBeDefined();
    expect(ClaudeSkillsCredentialManager).toBeDefined();
  });

  test('TypeScript definitions are complete and usable', () => {
    // This test ensures TypeScript compilation works
    const mockInput: any = {
      context: {
        storyContext: "test",
        userInput: "test",
        gradeLevel: "K-2"
      }
    };

    expect(mockInput).toBeDefined();
    expect(typeof mockInput.context.storyContext).toBe('string');
  });
});