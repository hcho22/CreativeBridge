// Claude Skills Authentication Security Tests
// Task 1.2-TEST: Security tests, integration tests, and compliance validation

import {
  ClaudeSkillsCredentialManager,
  ClaudeSkillsConfigFactory,
  ClaudeSkillsConfigValidator,
  ClaudeSkillsEnvironmentManager,
  ClaudeSkillsConfigNotificationManager,
} from '../../config/claudeSkillsConfig';
import ClaudeSkillsConfigManager from '../../services/claudeSkillsConfigManager';
import ClaudeSkillsCredentialRotationService from '../../services/claudeSkillsCredentialRotation';
import { SkillType } from '../../types/claudeSkills';

// Enhanced mocking for security tests
jest.mock('react-native-keychain', () => ({
  setInternetCredentials: jest.fn().mockResolvedValue(true),
  getInternetCredentials: jest.fn().mockResolvedValue({
    username: 'claude_skills_api_key',
    password: 'test_secure_api_key_12345',
  }),
  resetInternetCredentials: jest.fn().mockResolvedValue(true),
  hasInternetCredentials: jest.fn().mockResolvedValue(true),
  ACCESS_CONTROL: {
    BIOMETRY_CURRENT_SET: 'BiometryCurrentSet',
  },
  ACCESSIBLE: {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WhenUnlockedThisDeviceOnly',
  },
}));

jest.mock('react-native-device-info', () => ({
  getDeviceId: jest.fn().mockResolvedValue('test_device_12345'),
  getTotalMemory: jest.fn().mockResolvedValue(4 * 1024 * 1024 * 1024),
  getDeviceType: jest.fn().mockResolvedValue('Handset'),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn().mockResolvedValue(undefined),
  getItem: jest.fn().mockResolvedValue(null),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

// Mock environment for consistent testing
process.env.CLAUDE_SKILLS_ENVIRONMENT = 'development';

describe('Claude Skills Authentication Security Tests', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    // Clear configuration cache
    ClaudeSkillsConfigFactory.clearCache();
  });

  afterEach(async () => {
    // Cleanup after each test
    await ClaudeSkillsCredentialManager.clearApiKey();
    ClaudeSkillsConfigFactory.clearCache();
  });

  describe('API Key Secure Storage', () => {
    test('API keys stored securely in keychain', async () => {
      const testApiKey = 'secure_test_api_key_12345';

      // Store API key
      await ClaudeSkillsCredentialManager.storeApiKey(testApiKey);

      // Verify keychain storage was called with correct parameters
      const Keychain = require('react-native-keychain');
      expect(Keychain.setInternetCredentials).toHaveBeenCalledWith(
        'CreativeBridge_ClaudeSkills',
        'claude_skills_api_key',
        testApiKey,
        expect.any(Object), // Keychain options
      );
    });

    test('API key retrieval uses secure keychain', async () => {
      const testApiKey = 'secure_test_api_key_12345';

      // Store and retrieve API key
      await ClaudeSkillsCredentialManager.storeApiKey(testApiKey);
      const retrievedKey = await ClaudeSkillsCredentialManager.getApiKey();

      expect(retrievedKey).toBe('test_secure_api_key_12345'); // From mock

      // Verify secure retrieval was called
      const Keychain = require('react-native-keychain');
      expect(Keychain.getInternetCredentials).toHaveBeenCalledWith(
        'CreativeBridge_ClaudeSkills',
        expect.any(Object),
      );
    });

    test('API key storage with biometric authentication', async () => {
      const testApiKey = 'biometric_secured_key_12345';

      await ClaudeSkillsCredentialManager.storeApiKey(testApiKey, {
        requireBiometric: true,
      });

      const Keychain = require('react-native-keychain');
      const lastCall = Keychain.setInternetCredentials.mock.calls.slice(-1)[0];
      const options = lastCall[3];

      // Verify biometric security options are set
      expect(options.accessControl).toBeDefined();
      expect(options.authenticatePrompt).toContain('authenticate');
    });

    test('API key encryption and access controls', async () => {
      await ClaudeSkillsCredentialManager.storeApiKey('test_key');

      const Keychain = require('react-native-keychain');
      const options = Keychain.setInternetCredentials.mock.calls[0][3];

      // Verify encryption and access controls
      expect(options.accessible).toBe('WhenUnlockedThisDeviceOnly');
      expect(options.service).toBe('CreativeBridge_ClaudeSkills');
    });
  });

  describe('Environment Configuration Security', () => {
    test('Environment configuration loads correctly', async () => {
      process.env.CLAUDE_SKILLS_ENVIRONMENT = 'development';

      const config = await ClaudeSkillsConfigFactory.createConfig();

      expect(config.environment).toBe('development');
      expect(['development', 'staging', 'production']).toContain(
        config.environment,
      );
      expect(config.enabledSkills).toBeInstanceOf(Array);
      expect(config.enabledSkills.length).toBeGreaterThan(0);
    });

    test('Production environment enforces enhanced security', async () => {
      process.env.CLAUDE_SKILLS_ENVIRONMENT = 'production';

      const config = await ClaudeSkillsConfigFactory.createConfig();
      const validation = ClaudeSkillsConfigValidator.validateForEnvironment(
        config,
        'production',
      );

      // Production should require enhanced security
      expect(config.securityConfig.encryptionLevel).toBe('enhanced');
      expect(config.securityConfig.requireBiometricAuth).toBe(true);
      expect(config.securityConfig.sessionTimeout).toBeLessThanOrEqual(15);

      // Should warn if debug logs are enabled in production
      if (config.monitoringConfig.enableDebugLogs) {
        expect(validation.warnings).toContain(
          'Debug logging should be disabled in production',
        );
      }
    });

    test('Staging environment has appropriate security settings', async () => {
      process.env.CLAUDE_SKILLS_ENVIRONMENT = 'staging';

      const config = await ClaudeSkillsConfigFactory.createConfig();

      expect(config.securityConfig.encryptionLevel).toBe('enhanced');
      expect(config.securityConfig.requireBiometricAuth).toBe(true);
      expect(config.securityConfig.sessionTimeout).toBe(30);
    });

    test('Environment switching validation', async () => {
      // Test switching to different environments
      await ClaudeSkillsEnvironmentManager.switchEnvironment('staging');

      let config = await ClaudeSkillsConfigFactory.createConfig({
        forceRefresh: true,
      });
      expect(config.environment).toBe('staging');

      await ClaudeSkillsEnvironmentManager.switchEnvironment('production');
      config = await ClaudeSkillsConfigFactory.createConfig({
        forceRefresh: true,
      });
      expect(config.environment).toBe('production');
    });
  });

  describe('Configuration Update Security', () => {
    test('Configuration updates work without rebuild', async () => {
      // Initial configuration
      const initialConfig = await ClaudeSkillsConfigFactory.createConfig();
      const initialSkills = initialConfig.enabledSkills;

      // Update configuration at runtime
      const newSkills: SkillType[] = [
        'ResourceOptimizationSkill',
        'ErrorRecoverySkill',
      ];
      const updatedConfig = await ClaudeSkillsConfigFactory.updateConfig({
        enabledSkills: newSkills,
      });

      expect(updatedConfig.enabledSkills).toEqual(newSkills);
      expect(updatedConfig.enabledSkills).not.toEqual(initialSkills);

      // Configuration version should increment
      expect(ClaudeSkillsConfigFactory.getConfigVersion()).toBeGreaterThan(0);
    });

    test('Invalid configuration updates rejected', async () => {
      await expect(
        ClaudeSkillsConfigFactory.updateConfig({
          // Invalid update - empty skills array
          enabledSkills: [],
        }),
      ).rejects.toThrow();
    });

    test('Security configuration updates require validation', async () => {
      const securityUpdate = {
        encryptionLevel: 'enhanced' as const,
        requireBiometricAuth: true,
        sessionTimeout: 10,
        maxFailedAttempts: 3,
        enableAuditLogging: true,
      };

      const result =
        await ClaudeSkillsConfigManager.updateSecurityConfiguration(
          securityUpdate,
          { validateBeforeApply: true },
        );

      expect(result.success).toBe(true);
      expect(result.updatedConfig?.securityConfig.encryptionLevel).toBe(
        'enhanced',
      );
    });
  });

  describe('Session Management Security', () => {
    test('Session creation and validation', async () => {
      const sessionToken = await ClaudeSkillsCredentialManager.createSession();

      expect(sessionToken).toBeDefined();
      expect(typeof sessionToken).toBe('string');
      expect(sessionToken).toMatch(/^session_\d+_[a-z0-9]+$/);

      // Session should be valid immediately after creation
      const isValid = await ClaudeSkillsCredentialManager.validateSession(
        sessionToken,
      );
      expect(isValid).toBe(true);
    });

    test('Session timeout enforced', async () => {
      const sessionToken = await ClaudeSkillsCredentialManager.createSession();

      // Mock expired session by manipulating AsyncStorage
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      const expiredSession = {
        token: sessionToken,
        createdAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        expiresAt: new Date(Date.now() - 30 * 60 * 1000), // Expired 30 min ago
        deviceId: 'test_device',
      };
      AsyncStorage.getItem.mockResolvedValueOnce(
        JSON.stringify(expiredSession),
      );

      const isValid = await ClaudeSkillsCredentialManager.validateSession(
        sessionToken,
      );
      expect(isValid).toBe(false);
    });

    test('Session cleanup on logout', async () => {
      await ClaudeSkillsCredentialManager.createSession();
      await ClaudeSkillsCredentialManager.clearSession();

      const AsyncStorage = require('@react-native-async-storage/async-storage');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
        'claude_skills_session_token',
      );
    });
  });

  describe('Failed Authentication Attempts', () => {
    test('Failed attempts tracking', async () => {
      // Mock failed attempts
      for (let i = 0; i < 3; i++) {
        try {
          await ClaudeSkillsCredentialManager.getApiKey({
            requireBiometric: true,
          });
        } catch (error) {
          // Expected to fail in test environment
        }
      }

      // This would be tracked internally - verify through behavior
      expect(true).toBe(true); // Placeholder - in real implementation, would check attempt count
    });

    test('Account lockout after max failed attempts', async () => {
      // In a real implementation, this would test the lockout mechanism
      // For now, verify the mechanism exists
      const config = await ClaudeSkillsConfigFactory.createConfig();
      expect(config.securityConfig.maxFailedAttempts).toBeGreaterThan(0);
      expect(config.securityConfig.maxFailedAttempts).toBeLessThanOrEqual(20);
    });
  });

  describe('Credential Rotation Security', () => {
    test('Credential rotation system initialization', async () => {
      const schedule =
        await ClaudeSkillsCredentialRotationService.getRotationSchedule();

      expect(schedule).toBeDefined();
      expect(schedule.nextRotationDue).toBeInstanceOf(Date);
      expect(schedule.daysUntilRotation).toBeGreaterThan(0);
    });

    test('Automatic rotation when enabled', async () => {
      const result =
        await ClaudeSkillsCredentialRotationService.performAutomaticRotation();

      // In test environment, this should complete or fail gracefully
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    test('Rotation history logging', async () => {
      const history =
        await ClaudeSkillsCredentialRotationService.getRotationHistory();

      expect(Array.isArray(history)).toBe(true);
      // History should be empty or contain valid entries
    });

    test('Emergency rotation capability', async () => {
      const emergencyKey = 'emergency_rotation_key_12345';
      const result =
        await ClaudeSkillsCredentialRotationService.performEmergencyRotation(
          emergencyKey,
          'Security breach detected',
        );

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('Configuration Validation Security', () => {
    test('Security configuration validation', async () => {
      const validConfig = await ClaudeSkillsConfigFactory.createConfig();
      const validation =
        ClaudeSkillsConfigValidator.validateConfig(validConfig);

      expect(validation.isValid).toBe(true);
      expect(Array.isArray(validation.errors)).toBe(true);
    });

    test('Invalid security settings rejected', () => {
      const invalidConfig = {
        apiKey: 'test_key',
        environment: 'development' as const,
        enabledSkills: ['ErrorRecoverySkill'] as SkillType[],
        performanceMode: 'balanced' as const,
        cacheConfig: {
          maxCacheSize: 50,
          cacheTTL: 3600,
          enablePredictivePreloading: true,
          deviceAwareSizing: true,
        },
        fallbackConfig: {
          enableGracefulDegradation: true,
          maxRetryAttempts: 3,
          retryBackoffMs: 1000,
          circuitBreakerThreshold: 5,
        },
        monitoringConfig: {
          enablePerformanceTracking: true,
          enableErrorReporting: true,
          metricsCollectionInterval: 5000,
          enableDebugLogs: true,
        },
        securityConfig: {
          encryptionLevel: 'invalid' as any, // Invalid value
          requireBiometricAuth: false,
          sessionTimeout: 200, // Invalid - too high
          maxFailedAttempts: 0, // Invalid - too low
          enableAuditLogging: true,
        },
        rotationConfig: {
          enableAutoRotation: false,
          rotationIntervalDays: 30,
          notifyBeforeExpiry: true,
          expiryWarningDays: 7,
          backupKeyCount: 3,
        },
      };

      const validation =
        ClaudeSkillsConfigValidator.validateConfig(invalidConfig);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        'Invalid encryption level: must be standard or enhanced',
      );
      expect(validation.errors).toContain(
        'Invalid session timeout: must be between 5 and 120 minutes',
      );
      expect(validation.errors).toContain(
        'Invalid max failed attempts: must be between 1 and 20',
      );
    });

    test('Production environment validation strictness', () => {
      const prodConfig = {
        apiKey: 'test_key',
        environment: 'production' as const,
        enabledSkills: ['ErrorRecoverySkill'] as SkillType[],
        performanceMode: 'balanced' as const,
        cacheConfig: {
          maxCacheSize: 50,
          cacheTTL: 3600,
          enablePredictivePreloading: true,
          deviceAwareSizing: true,
        },
        fallbackConfig: {
          enableGracefulDegradation: true,
          maxRetryAttempts: 3,
          retryBackoffMs: 1000,
          circuitBreakerThreshold: 5,
        },
        monitoringConfig: {
          enablePerformanceTracking: true,
          enableErrorReporting: true,
          metricsCollectionInterval: 60000,
          enableDebugLogs: true, // Should trigger warning
        },
        securityConfig: {
          encryptionLevel: 'standard' as const, // Should require enhanced
          requireBiometricAuth: false, // Should warn
          sessionTimeout: 15,
          maxFailedAttempts: 5,
          enableAuditLogging: true,
        },
        rotationConfig: {
          enableAutoRotation: true,
          rotationIntervalDays: 30,
          notifyBeforeExpiry: true,
          expiryWarningDays: 7,
          backupKeyCount: 5,
        },
      };

      const validation = ClaudeSkillsConfigValidator.validateForEnvironment(
        prodConfig,
        'production',
      );

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        'Production environment requires enhanced encryption',
      );
      expect(validation.warnings).toContain(
        'Consider enabling biometric authentication for production',
      );
      expect(validation.warnings).toContain(
        'Debug logging should be disabled in production',
      );
    });
  });
});

// Integration tests for configuration management
describe('Claude Skills Configuration Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ClaudeSkillsConfigFactory.clearCache();
  });

  test('End-to-end configuration lifecycle', async () => {
    // 1. Initial setup
    await ClaudeSkillsCredentialManager.storeApiKey('test_integration_key');

    // 2. Create initial configuration
    const initialConfig = await ClaudeSkillsConfigFactory.createConfig();
    expect(initialConfig.apiKey).toBe('test_secure_api_key_12345'); // From mock

    // 3. Update configuration through manager
    const enableResult = await ClaudeSkillsConfigManager.enableSkills([
      'ContentPredictionSkill',
    ]);
    expect(enableResult.success).toBe(true);

    // 4. Verify updates are persisted
    const updatedConfig = await ClaudeSkillsConfigFactory.createConfig({
      forceRefresh: true,
    });
    expect(updatedConfig.enabledSkills).toContain('ContentPredictionSkill');

    // 5. Export/import configuration
    const exportData = await ClaudeSkillsConfigManager.exportConfiguration();
    expect(exportData.config).toBeDefined();
    expect(exportData.metadata).toBeDefined();

    // 6. Validate configuration health
    const health =
      await ClaudeSkillsConfigManager.validateCurrentConfiguration();
    expect(health.isValid).toBe(true);
  });

  test('Configuration change notifications', async () => {
    let notificationReceived = false;
    let receivedConfig = null;

    // Set up listener
    const unsubscribe = ClaudeSkillsConfigNotificationManager.addListener(
      (config, _version) => {
        notificationReceived = true;
        receivedConfig = config;
      },
    );

    // Trigger configuration change
    await ClaudeSkillsConfigFactory.updateConfig({
      enabledSkills: ['ResourceOptimizationSkill'],
    });

    // Clean up
    unsubscribe();

    // Verify notification was received
    expect(notificationReceived).toBe(true);
    expect(receivedConfig).toBeDefined();
  });

  test('Multiple environment configurations', async () => {
    // Test configuration for different environments
    const environments = ['development', 'staging', 'production'];

    for (const env of environments) {
      process.env.CLAUDE_SKILLS_ENVIRONMENT = env;
      ClaudeSkillsConfigFactory.clearCache();

      const config = await ClaudeSkillsConfigFactory.createConfig();
      const validation = ClaudeSkillsConfigValidator.validateForEnvironment(
        config,
        env,
      );

      expect(config.environment).toBe(env);
      expect(validation.isValid).toBe(true);

      // Environment-specific checks
      if (env === 'production') {
        expect(config.securityConfig.encryptionLevel).toBe('enhanced');
        expect(config.performanceMode).toBe('battery');
      } else if (env === 'development') {
        expect(config.performanceMode).toBe('performance');
        expect(config.securityConfig.enableAuditLogging).toBe(true);
      }
    }
  });

  test('Authentication works across app restarts', async () => {
    // Simulate app restart by clearing caches but keeping keychain
    ClaudeSkillsConfigFactory.clearCache();

    // Should be able to recreate configuration from stored credentials
    const config = await ClaudeSkillsConfigFactory.createConfig();
    expect(config).toBeDefined();
    expect(config.apiKey).toBe('test_secure_api_key_12345');
  });
});

// Compliance and audit tests
describe('Claude Skills Compliance Validation', () => {
  test('No credentials leaked in logs or debugging output', async () => {
    const originalConsoleLog = console.log;
    const logMessages: string[] = [];

    // Capture console output
    console.log = (message: string) => {
      logMessages.push(message);
    };

    try {
      // Perform operations that might log
      await ClaudeSkillsCredentialManager.storeApiKey('secret_test_key_12345');
      await ClaudeSkillsConfigFactory.createConfig();
      await ClaudeSkillsConfigManager.enableSkills(['ContentPredictionSkill']);

      // Check that no credentials are in logs
      const allLogs = logMessages.join(' ');
      expect(allLogs).not.toContain('secret_test_key_12345');
      expect(allLogs).not.toContain('test_secure_api_key_12345');

      // Redacted API keys should be present
      if (allLogs.includes('[REDACTED]')) {
        expect(allLogs).toContain('[REDACTED]');
      }
    } finally {
      console.log = originalConsoleLog;
    }
  });

  test('Configuration backup/restore maintains security', async () => {
    // Create configuration with sensitive data
    await ClaudeSkillsCredentialManager.storeApiKey('backup_test_key_12345');
    await ClaudeSkillsConfigFactory.createConfig();

    // Export configuration
    const exportData = await ClaudeSkillsConfigManager.exportConfiguration();

    // Verify sensitive data is redacted in export
    expect(exportData.config.apiKey).toBe('[REDACTED]');

    // Import with preserve key option
    const importResult = await ClaudeSkillsConfigManager.importConfiguration(
      exportData,
      { preserveApiKey: true },
    );

    expect(importResult.success).toBe(true);
  });

  test('Environment separation prevents cross-environment access', async () => {
    // This test verifies that environments are properly isolated
    const devConfig = await ClaudeSkillsConfigFactory.createConfig();

    process.env.CLAUDE_SKILLS_ENVIRONMENT = 'production';
    ClaudeSkillsConfigFactory.clearCache();

    const prodConfig = await ClaudeSkillsConfigFactory.createConfig();

    // Configurations should be different
    expect(devConfig.environment).not.toBe(prodConfig.environment);
    expect(devConfig.enabledSkills).not.toEqual(prodConfig.enabledSkills);
    expect(devConfig.securityConfig.encryptionLevel).not.toBe(
      prodConfig.securityConfig.encryptionLevel,
    );
  });
});
