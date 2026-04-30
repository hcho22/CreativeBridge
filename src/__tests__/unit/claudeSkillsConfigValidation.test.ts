// Claude Skills Configuration Validation Tests
// Task 1.2-TEST: Unit tests for configuration validation and security

import { ClaudeSkillsConfigValidator } from '../../config/claudeSkillsConfig';
import { SkillType } from '../../types/claudeSkills';

describe('Claude Skills Configuration Validation', () => {
  describe('Basic Configuration Validation', () => {
    test('Valid configuration passes all validation checks', () => {
      const validConfig = {
        apiKey: 'valid_test_api_key_12345',
        environment: 'development' as const,
        enabledSkills: [
          'ResourceOptimizationSkill',
          'ErrorRecoverySkill',
        ] as SkillType[],
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
          encryptionLevel: 'enhanced' as const,
          requireBiometricAuth: true,
          sessionTimeout: 30,
          maxFailedAttempts: 5,
          enableAuditLogging: true,
        },
        rotationConfig: {
          enableAutoRotation: true,
          rotationIntervalDays: 30,
          notifyBeforeExpiry: true,
          expiryWarningDays: 7,
          backupKeyCount: 3,
        },
      };

      const validation =
        ClaudeSkillsConfigValidator.validateConfig(validConfig);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('Invalid API key format is rejected', () => {
      const invalidApiKeyConfig = {
        apiKey: 'short', // Too short (less than 10 characters)
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
          encryptionLevel: 'standard' as const,
          requireBiometricAuth: false,
          sessionTimeout: 30,
          maxFailedAttempts: 5,
          enableAuditLogging: true,
        },
        rotationConfig: {
          enableAutoRotation: false,
          rotationIntervalDays: 90,
          notifyBeforeExpiry: true,
          expiryWarningDays: 7,
          backupKeyCount: 3,
        },
      };

      const validation =
        ClaudeSkillsConfigValidator.validateConfig(invalidApiKeyConfig);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        'Invalid API key: must be at least 10 characters',
      );
    });

    test('Invalid environment is rejected', () => {
      const invalidEnvConfig = {
        apiKey: 'valid_test_api_key_12345',
        environment: 'invalid_environment' as any, // Invalid environment
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
          encryptionLevel: 'standard' as const,
          requireBiometricAuth: false,
          sessionTimeout: 30,
          maxFailedAttempts: 5,
          enableAuditLogging: true,
        },
        rotationConfig: {
          enableAutoRotation: false,
          rotationIntervalDays: 90,
          notifyBeforeExpiry: true,
          expiryWarningDays: 7,
          backupKeyCount: 3,
        },
      };

      const validation =
        ClaudeSkillsConfigValidator.validateConfig(invalidEnvConfig);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        'Invalid environment: must be development, staging, or production',
      );
    });

    test('Empty skills array is rejected', () => {
      const noSkillsConfig = {
        apiKey: 'valid_test_api_key_12345',
        environment: 'development' as const,
        enabledSkills: [] as SkillType[], // No skills enabled
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
          encryptionLevel: 'standard' as const,
          requireBiometricAuth: false,
          sessionTimeout: 30,
          maxFailedAttempts: 5,
          enableAuditLogging: true,
        },
        rotationConfig: {
          enableAutoRotation: false,
          rotationIntervalDays: 90,
          notifyBeforeExpiry: true,
          expiryWarningDays: 7,
          backupKeyCount: 3,
        },
      };

      const validation =
        ClaudeSkillsConfigValidator.validateConfig(noSkillsConfig);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        'No skills enabled: at least one skill must be enabled',
      );
    });
  });

  describe('Security Configuration Validation', () => {
    test('Invalid encryption level is rejected', () => {
      const invalidSecurityConfig = {
        apiKey: 'valid_test_api_key_12345',
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
          encryptionLevel: 'invalid_level' as any, // Invalid encryption level
          requireBiometricAuth: false,
          sessionTimeout: 30,
          maxFailedAttempts: 5,
          enableAuditLogging: true,
        },
        rotationConfig: {
          enableAutoRotation: false,
          rotationIntervalDays: 90,
          notifyBeforeExpiry: true,
          expiryWarningDays: 7,
          backupKeyCount: 3,
        },
      };

      const validation = ClaudeSkillsConfigValidator.validateConfig(
        invalidSecurityConfig,
      );

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        'Invalid encryption level: must be standard or enhanced',
      );
    });

    test('Invalid session timeout is rejected', () => {
      const invalidTimeoutConfig = {
        apiKey: 'valid_test_api_key_12345',
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
          encryptionLevel: 'standard' as const,
          requireBiometricAuth: false,
          sessionTimeout: 200, // Invalid - too high (>120 minutes)
          maxFailedAttempts: 5,
          enableAuditLogging: true,
        },
        rotationConfig: {
          enableAutoRotation: false,
          rotationIntervalDays: 90,
          notifyBeforeExpiry: true,
          expiryWarningDays: 7,
          backupKeyCount: 3,
        },
      };

      const validation =
        ClaudeSkillsConfigValidator.validateConfig(invalidTimeoutConfig);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        'Invalid session timeout: must be between 5 and 120 minutes',
      );
    });

    test('Invalid max failed attempts is rejected', () => {
      const invalidFailedAttemptsConfig = {
        apiKey: 'valid_test_api_key_12345',
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
          encryptionLevel: 'standard' as const,
          requireBiometricAuth: false,
          sessionTimeout: 30,
          maxFailedAttempts: 0, // Invalid - too low
          enableAuditLogging: true,
        },
        rotationConfig: {
          enableAutoRotation: false,
          rotationIntervalDays: 90,
          notifyBeforeExpiry: true,
          expiryWarningDays: 7,
          backupKeyCount: 3,
        },
      };

      const validation = ClaudeSkillsConfigValidator.validateConfig(
        invalidFailedAttemptsConfig,
      );

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        'Invalid max failed attempts: must be between 1 and 20',
      );
    });

    test('Missing security configuration is rejected', () => {
      const noSecurityConfig = {
        apiKey: 'valid_test_api_key_12345',
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
        securityConfig: null as any, // Missing security config
        rotationConfig: {
          enableAutoRotation: false,
          rotationIntervalDays: 90,
          notifyBeforeExpiry: true,
          expiryWarningDays: 7,
          backupKeyCount: 3,
        },
      };

      const validation =
        ClaudeSkillsConfigValidator.validateConfig(noSecurityConfig);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Security configuration is required');
    });
  });

  describe('Rotation Configuration Validation', () => {
    test('Invalid rotation interval is rejected', () => {
      const invalidRotationConfig = {
        apiKey: 'valid_test_api_key_12345',
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
          encryptionLevel: 'standard' as const,
          requireBiometricAuth: false,
          sessionTimeout: 30,
          maxFailedAttempts: 5,
          enableAuditLogging: true,
        },
        rotationConfig: {
          enableAutoRotation: true,
          rotationIntervalDays: 0, // Invalid - too low
          notifyBeforeExpiry: true,
          expiryWarningDays: 7,
          backupKeyCount: 3,
        },
      };

      const validation = ClaudeSkillsConfigValidator.validateConfig(
        invalidRotationConfig,
      );

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        'Invalid rotation interval: must be between 1 and 365 days',
      );
    });

    test('Invalid expiry warning days is rejected', () => {
      const invalidWarningConfig = {
        apiKey: 'valid_test_api_key_12345',
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
          encryptionLevel: 'standard' as const,
          requireBiometricAuth: false,
          sessionTimeout: 30,
          maxFailedAttempts: 5,
          enableAuditLogging: true,
        },
        rotationConfig: {
          enableAutoRotation: true,
          rotationIntervalDays: 30,
          notifyBeforeExpiry: true,
          expiryWarningDays: 50, // Invalid - too high
          backupKeyCount: 3,
        },
      };

      const validation =
        ClaudeSkillsConfigValidator.validateConfig(invalidWarningConfig);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        'Invalid expiry warning days: must be between 1 and 30 days',
      );
    });

    test('Invalid backup key count is rejected', () => {
      const invalidBackupConfig = {
        apiKey: 'valid_test_api_key_12345',
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
          encryptionLevel: 'standard' as const,
          requireBiometricAuth: false,
          sessionTimeout: 30,
          maxFailedAttempts: 5,
          enableAuditLogging: true,
        },
        rotationConfig: {
          enableAutoRotation: true,
          rotationIntervalDays: 30,
          notifyBeforeExpiry: true,
          expiryWarningDays: 7,
          backupKeyCount: 20, // Invalid - too high
        },
      };

      const validation =
        ClaudeSkillsConfigValidator.validateConfig(invalidBackupConfig);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        'Invalid backup key count: must be between 1 and 10',
      );
    });

    test('Missing rotation configuration is rejected', () => {
      const noRotationConfig = {
        apiKey: 'valid_test_api_key_12345',
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
          encryptionLevel: 'standard' as const,
          requireBiometricAuth: false,
          sessionTimeout: 30,
          maxFailedAttempts: 5,
          enableAuditLogging: true,
        },
        rotationConfig: null as any, // Missing rotation config
      };

      const validation =
        ClaudeSkillsConfigValidator.validateConfig(noRotationConfig);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Rotation configuration is required');
    });
  });

  describe('Cache Configuration Validation', () => {
    test('Invalid cache size is rejected', () => {
      const invalidCacheConfig = {
        apiKey: 'valid_test_api_key_12345',
        environment: 'development' as const,
        enabledSkills: ['ErrorRecoverySkill'] as SkillType[],
        performanceMode: 'balanced' as const,
        cacheConfig: {
          maxCacheSize: 5, // Too small
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
          encryptionLevel: 'standard' as const,
          requireBiometricAuth: false,
          sessionTimeout: 30,
          maxFailedAttempts: 5,
          enableAuditLogging: true,
        },
        rotationConfig: {
          enableAutoRotation: false,
          rotationIntervalDays: 90,
          notifyBeforeExpiry: true,
          expiryWarningDays: 7,
          backupKeyCount: 3,
        },
      };

      const validation =
        ClaudeSkillsConfigValidator.validateConfig(invalidCacheConfig);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        'Invalid cache size: must be between 10MB and 200MB',
      );
    });

    test('Invalid cache TTL is rejected', () => {
      const invalidTTLConfig = {
        apiKey: 'valid_test_api_key_12345',
        environment: 'development' as const,
        enabledSkills: ['ErrorRecoverySkill'] as SkillType[],
        performanceMode: 'balanced' as const,
        cacheConfig: {
          maxCacheSize: 50,
          cacheTTL: 100, // Too short
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
          encryptionLevel: 'standard' as const,
          requireBiometricAuth: false,
          sessionTimeout: 30,
          maxFailedAttempts: 5,
          enableAuditLogging: true,
        },
        rotationConfig: {
          enableAutoRotation: false,
          rotationIntervalDays: 90,
          notifyBeforeExpiry: true,
          expiryWarningDays: 7,
          backupKeyCount: 3,
        },
      };

      const validation =
        ClaudeSkillsConfigValidator.validateConfig(invalidTTLConfig);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        'Invalid cache TTL: must be between 5 minutes and 24 hours',
      );
    });
  });

  describe('Fallback Configuration Validation', () => {
    test('Invalid retry attempts is rejected', () => {
      const invalidRetriesConfig = {
        apiKey: 'valid_test_api_key_12345',
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
        securityConfig: {
          encryptionLevel: 'standard' as const,
          requireBiometricAuth: false,
          sessionTimeout: 30,
          maxFailedAttempts: 5,
          enableAuditLogging: true,
        },
        rotationConfig: {
          enableAutoRotation: false,
          rotationIntervalDays: 90,
          notifyBeforeExpiry: true,
          expiryWarningDays: 7,
          backupKeyCount: 3,
        },
      };

      const validation =
        ClaudeSkillsConfigValidator.validateConfig(invalidRetriesConfig);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        'Invalid retry attempts: must be between 1 and 10',
      );
    });
  });

  describe('Environment-Specific Validation', () => {
    test('Production environment requires enhanced encryption', () => {
      const productionConfig = {
        apiKey: 'prod_test_api_key_12345',
        environment: 'production' as const,
        enabledSkills: ['ResourceOptimizationSkill'] as SkillType[],
        performanceMode: 'battery' as const,
        cacheConfig: {
          maxCacheSize: 50,
          cacheTTL: 7200,
          enablePredictivePreloading: true,
          deviceAwareSizing: true,
        },
        fallbackConfig: {
          enableGracefulDegradation: true,
          maxRetryAttempts: 2,
          retryBackoffMs: 2000,
          circuitBreakerThreshold: 5,
        },
        monitoringConfig: {
          enablePerformanceTracking: true,
          enableErrorReporting: true,
          metricsCollectionInterval: 60000,
          enableDebugLogs: false,
        },
        securityConfig: {
          encryptionLevel: 'standard' as const, // Should require enhanced
          requireBiometricAuth: false,
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
        productionConfig,
        'production',
      );

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        'Production environment requires enhanced encryption',
      );
      expect(validation.warnings).toContain(
        'Consider enabling biometric authentication for production',
      );
    });

    test('Development environment allows more lenient settings', () => {
      const devConfig = {
        apiKey: 'dev_test_api_key_12345',
        environment: 'development' as const,
        enabledSkills: [
          'ResourceOptimizationSkill',
          'ContentPredictionSkill',
        ] as SkillType[],
        performanceMode: 'performance' as const,
        cacheConfig: {
          maxCacheSize: 100,
          cacheTTL: 1800,
          enablePredictivePreloading: true,
          deviceAwareSizing: true,
        },
        fallbackConfig: {
          enableGracefulDegradation: true,
          maxRetryAttempts: 5,
          retryBackoffMs: 500,
          circuitBreakerThreshold: 10,
        },
        monitoringConfig: {
          enablePerformanceTracking: true,
          enableErrorReporting: true,
          metricsCollectionInterval: 5000,
          enableDebugLogs: true,
        },
        securityConfig: {
          encryptionLevel: 'standard' as const,
          requireBiometricAuth: false,
          sessionTimeout: 60,
          maxFailedAttempts: 10,
          enableAuditLogging: true,
        },
        rotationConfig: {
          enableAutoRotation: false,
          rotationIntervalDays: 90,
          notifyBeforeExpiry: true,
          expiryWarningDays: 14,
          backupKeyCount: 2,
        },
      };

      const validation = ClaudeSkillsConfigValidator.validateForEnvironment(
        devConfig,
        'development',
      );

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('Auto-rotation warning for development environment', () => {
      const devConfigWithAutoRotation = {
        apiKey: 'dev_test_api_key_12345',
        environment: 'development' as const,
        enabledSkills: ['ResourceOptimizationSkill'] as SkillType[],
        performanceMode: 'performance' as const,
        cacheConfig: {
          maxCacheSize: 100,
          cacheTTL: 1800,
          enablePredictivePreloading: true,
          deviceAwareSizing: true,
        },
        fallbackConfig: {
          enableGracefulDegradation: true,
          maxRetryAttempts: 5,
          retryBackoffMs: 500,
          circuitBreakerThreshold: 10,
        },
        monitoringConfig: {
          enablePerformanceTracking: true,
          enableErrorReporting: true,
          metricsCollectionInterval: 5000,
          enableDebugLogs: true,
        },
        securityConfig: {
          encryptionLevel: 'standard' as const,
          requireBiometricAuth: false,
          sessionTimeout: 60,
          maxFailedAttempts: 10,
          enableAuditLogging: true,
        },
        rotationConfig: {
          enableAutoRotation: true, // Should trigger warning for dev
          rotationIntervalDays: 90,
          notifyBeforeExpiry: true,
          expiryWarningDays: 14,
          backupKeyCount: 2,
        },
      };

      const validation = ClaudeSkillsConfigValidator.validateForEnvironment(
        devConfigWithAutoRotation,
        'development',
      );

      expect(validation.isValid).toBe(true);
      expect(validation.warnings).toContain(
        'Auto-rotation might be unnecessary for development environment',
      );
    });
  });

  describe('Performance and Edge Cases', () => {
    test('Configuration validation performance', () => {
      const startTime = Date.now();

      const testConfig = {
        apiKey: 'performance_test_key_12345',
        environment: 'development' as const,
        enabledSkills: [
          'ResourceOptimizationSkill',
          'ContentPredictionSkill',
          'QualityAssessmentSkill',
        ] as SkillType[],
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
          encryptionLevel: 'enhanced' as const,
          requireBiometricAuth: true,
          sessionTimeout: 30,
          maxFailedAttempts: 5,
          enableAuditLogging: true,
        },
        rotationConfig: {
          enableAutoRotation: true,
          rotationIntervalDays: 30,
          notifyBeforeExpiry: true,
          expiryWarningDays: 7,
          backupKeyCount: 3,
        },
      };

      const validation = ClaudeSkillsConfigValidator.validateConfig(testConfig);

      const executionTime = Date.now() - startTime;

      expect(validation.isValid).toBe(true);
      expect(executionTime).toBeLessThan(50); // Should be fast
    });

    test('Complex configuration with multiple errors', () => {
      const complexInvalidConfig = {
        apiKey: 'x', // Too short
        environment: 'invalid' as any, // Invalid env
        enabledSkills: [] as SkillType[], // No skills
        performanceMode: 'balanced' as const,
        cacheConfig: {
          maxCacheSize: 300, // Too large
          cacheTTL: 100000, // Too long
          enablePredictivePreloading: true,
          deviceAwareSizing: true,
        },
        fallbackConfig: {
          enableGracefulDegradation: true,
          maxRetryAttempts: 0, // Too few
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
          encryptionLevel: 'invalid' as any, // Invalid
          requireBiometricAuth: false,
          sessionTimeout: 200, // Too high
          maxFailedAttempts: 30, // Too many
          enableAuditLogging: true,
        },
        rotationConfig: {
          enableAutoRotation: true,
          rotationIntervalDays: 400, // Too many
          notifyBeforeExpiry: true,
          expiryWarningDays: 50, // Too many
          backupKeyCount: 15, // Too many
        },
      };

      const validation =
        ClaudeSkillsConfigValidator.validateConfig(complexInvalidConfig);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(5); // Multiple errors
      expect(validation.errors).toContain(
        'Invalid API key: must be at least 10 characters',
      );
      expect(validation.errors).toContain(
        'Invalid environment: must be development, staging, or production',
      );
      expect(validation.errors).toContain(
        'No skills enabled: at least one skill must be enabled',
      );
    });
  });
});
