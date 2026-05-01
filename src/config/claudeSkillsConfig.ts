// Claude Skills Configuration
// Enhanced secure configuration management for Claude Skills SDK integration
// Task 1.2: Authentication & Configuration System

import { SkillConfig, SkillType, PerformanceMode } from '../types/claudeSkills';
import { Environment } from './environment';
import Keychain, { Options } from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ClaudeSkillsConfig extends SkillConfig {
  apiKey: string;
  environment: 'development' | 'staging' | 'production';
  enabledSkills: SkillType[];
  performanceMode: PerformanceMode;
  cacheConfig: CacheConfiguration;
  fallbackConfig: FallbackConfiguration;
  monitoringConfig: MonitoringConfiguration;
  securityConfig: SecurityConfiguration;
  rotationConfig: CredentialRotationConfiguration;
}

export interface SecurityConfiguration {
  encryptionLevel: 'standard' | 'enhanced';
  requireBiometricAuth: boolean;
  sessionTimeout: number; // in minutes
  maxFailedAttempts: number;
  enableAuditLogging: boolean;
}

export interface CredentialRotationConfiguration {
  enableAutoRotation: boolean;
  rotationIntervalDays: number;
  notifyBeforeExpiry: boolean;
  expiryWarningDays: number;
  backupKeyCount: number;
}

export interface CacheConfiguration {
  maxCacheSize: number; // in MB
  cacheTTL: number; // in seconds
  enablePredictivePreloading: boolean;
  deviceAwareSizing: boolean;
}

export interface FallbackConfiguration {
  enableGracefulDegradation: boolean;
  maxRetryAttempts: number;
  retryBackoffMs: number;
  circuitBreakerThreshold: number;
}

export interface MonitoringConfiguration {
  enablePerformanceTracking: boolean;
  enableErrorReporting: boolean;
  metricsCollectionInterval: number; // in ms
  enableDebugLogs: boolean;
}

// Enhanced secure credential storage service with rotation and biometric support
export class ClaudeSkillsCredentialManager {
  private static readonly KEYCHAIN_SERVICE = 'CreativeBridge_ClaudeSkills';
  private static readonly API_KEY_KEY = 'claude_skills_api_key';
  private static readonly BACKUP_KEY_PREFIX = 'claude_skills_backup_key_';
  private static readonly ROTATION_METADATA_KEY =
    'claude_skills_rotation_metadata';
  private static readonly FAILED_ATTEMPTS_KEY = 'claude_skills_failed_attempts';
  private static readonly SESSION_KEY = 'claude_skills_session_token';

  // Enhanced keychain options with biometric support
  private static getKeychainOptions(
    requireBiometric: boolean = false,
  ): Options {
    const options: Options = {
      service: this.KEYCHAIN_SERVICE,
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      authenticationPrompt: 'Authenticate to access Claude Skills',
    };

    if (!requireBiometric) {
      delete options.accessControl;
    }

    return options;
  }

  // Store API key with enhanced security options
  static async storeApiKey(
    apiKey: string,
    options: {
      requireBiometric?: boolean;
      rotationInfo?: CredentialRotationInfo;
    } = {},
  ): Promise<void> {
    try {
      const keychainOptions = this.getKeychainOptions(options.requireBiometric);

      await Keychain.setInternetCredentials(
        this.KEYCHAIN_SERVICE,
        this.API_KEY_KEY,
        apiKey,
        keychainOptions,
      );

      // Store rotation metadata if provided
      if (options.rotationInfo) {
        await this.storeRotationMetadata(options.rotationInfo);
      }

      // Log security event
      await this.logSecurityEvent('API_KEY_STORED', {
        requireBiometric: options.requireBiometric,
      });
    } catch (error) {
      console.error('Failed to store Claude Skills API key:', error);
      await this.logSecurityEvent('API_KEY_STORE_FAILED', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to securely store API credentials');
    }
  }

  // Retrieve API key with session management
  static async getApiKey(
    options: { requireBiometric?: boolean; sessionToken?: string } = {},
  ): Promise<string | null> {
    try {
      // Check if session is still valid
      if (
        options.sessionToken &&
        !(await this.validateSession(options.sessionToken))
      ) {
        await this.logSecurityEvent('INVALID_SESSION_ATTEMPT');
        return null;
      }

      // Check for too many failed attempts
      if (await this.isTooManyFailedAttempts()) {
        await this.logSecurityEvent('TOO_MANY_FAILED_ATTEMPTS');
        throw new Error(
          'Too many failed authentication attempts. Please try again later.',
        );
      }

      const keychainOptions = this.getKeychainOptions(options.requireBiometric);

      const credentials = await Keychain.getInternetCredentials(
        this.KEYCHAIN_SERVICE,
        keychainOptions,
      );

      if (credentials && credentials.password) {
        // Reset failed attempts on success
        await this.resetFailedAttempts();
        await this.logSecurityEvent('API_KEY_RETRIEVED', {
          requireBiometric: options.requireBiometric,
        });
        return credentials.password;
      }

      return null;
    } catch (error) {
      console.error('Failed to retrieve Claude Skills API key:', error);
      await this.incrementFailedAttempts();
      await this.logSecurityEvent('API_KEY_RETRIEVAL_FAILED', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  // Clear API key and associated metadata
  static async clearApiKey(): Promise<void> {
    try {
      await Keychain.resetInternetCredentials(this.KEYCHAIN_SERVICE);
      await AsyncStorage.removeItem(this.ROTATION_METADATA_KEY);
      await this.resetFailedAttempts();
      await this.clearSession();
      await this.logSecurityEvent('API_KEY_CLEARED');
    } catch (error) {
      console.error('Failed to clear Claude Skills API key:', error);
      await this.logSecurityEvent('API_KEY_CLEAR_FAILED', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Check if API key is stored
  static async isApiKeyStored(): Promise<boolean> {
    try {
      const credentials = await Keychain.getInternetCredentials(
        this.KEYCHAIN_SERVICE,
      );
      return !!(credentials && credentials.password);
    } catch (error) {
      return false;
    }
  }

  // Credential rotation functionality
  static async rotateApiKey(
    newApiKey: string,
    options: { keepBackups?: number } = {},
  ): Promise<void> {
    try {
      // Get current key for backup
      const currentKey = await this.getApiKey();

      if (currentKey) {
        await this.createBackupKey(currentKey, options.keepBackups || 3);
      }

      // Store new key with updated rotation info
      const rotationInfo: CredentialRotationInfo = {
        rotatedAt: new Date(),
        rotatedBy: 'system', // Could be 'user' or 'admin'
        previousKeyHash: currentKey ? await this.hashKey(currentKey) : null,
        nextRotationDue: this.calculateNextRotation(),
      };

      await this.storeApiKey(newApiKey, { rotationInfo });
      await this.logSecurityEvent('API_KEY_ROTATED', { rotationInfo });
    } catch (error) {
      console.error('Failed to rotate Claude Skills API key:', error);
      await this.logSecurityEvent('API_KEY_ROTATION_FAILED', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to rotate API credentials');
    }
  }

  // Session management
  static async createSession(): Promise<string> {
    const sessionToken = this.generateSessionToken();
    const sessionData = {
      token: sessionToken,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
    };

    await AsyncStorage.setItem(this.SESSION_KEY, JSON.stringify(sessionData));
    await this.logSecurityEvent('SESSION_CREATED');
    return sessionToken;
  }

  static async validateSession(sessionToken: string): Promise<boolean> {
    try {
      const sessionData = await AsyncStorage.getItem(this.SESSION_KEY);
      if (!sessionData) return false;

      const session = JSON.parse(sessionData);
      const now = new Date();
      const expiresAt = new Date(session.expiresAt);

      if (session.token === sessionToken && now < expiresAt) {
        return true;
      }

      // Clean up expired session
      await this.clearSession();
      return false;
    } catch (error) {
      return false;
    }
  }

  static async clearSession(): Promise<void> {
    await AsyncStorage.removeItem(this.SESSION_KEY);
    await this.logSecurityEvent('SESSION_CLEARED');
  }

  // Backup key management
  private static async createBackupKey(
    apiKey: string,
    maxBackups: number,
  ): Promise<void> {
    const timestamp = Date.now();
    const backupKey = `${this.BACKUP_KEY_PREFIX}${timestamp}`;

    await Keychain.setInternetCredentials(
      backupKey,
      'backup',
      apiKey,
      this.getKeychainOptions(false),
    );

    // Clean up old backups if we exceed the limit
    await this.cleanupOldBackups(maxBackups);
  }

  private static async cleanupOldBackups(maxBackups: number): Promise<void> {
    // This would require enumerating keychain entries
    // For now, we'll implement a simple cleanup strategy
    // In a real implementation, you'd track backup keys in AsyncStorage
  }

  // Rotation metadata management
  private static async storeRotationMetadata(
    rotationInfo: CredentialRotationInfo,
  ): Promise<void> {
    await AsyncStorage.setItem(
      this.ROTATION_METADATA_KEY,
      JSON.stringify(rotationInfo),
    );
  }

  static async getRotationMetadata(): Promise<CredentialRotationInfo | null> {
    try {
      const metadata = await AsyncStorage.getItem(this.ROTATION_METADATA_KEY);
      return metadata ? JSON.parse(metadata) : null;
    } catch (error) {
      return null;
    }
  }

  // Failed attempts management
  private static async incrementFailedAttempts(): Promise<void> {
    try {
      const attempts = await this.getFailedAttempts();
      await AsyncStorage.setItem(
        this.FAILED_ATTEMPTS_KEY,
        (attempts + 1).toString(),
      );
    } catch (error) {
      console.error('Failed to increment failed attempts:', error);
    }
  }

  private static async resetFailedAttempts(): Promise<void> {
    await AsyncStorage.removeItem(this.FAILED_ATTEMPTS_KEY);
  }

  private static async getFailedAttempts(): Promise<number> {
    try {
      const attempts = await AsyncStorage.getItem(this.FAILED_ATTEMPTS_KEY);
      return attempts ? parseInt(attempts, 10) : 0;
    } catch (error) {
      return 0;
    }
  }

  private static async isTooManyFailedAttempts(): Promise<boolean> {
    const attempts = await this.getFailedAttempts();
    return attempts >= 5; // Configurable threshold
  }

  // Utility methods
  private static generateSessionToken(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private static async hashKey(key: string): Promise<string> {
    // Simple hash for audit purposes (in real app, use proper crypto)
    return `hash_${key.slice(0, 8)}...${key.slice(-8)}`;
  }

  private static calculateNextRotation(): Date {
    const now = new Date();
    return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
  }

  // Security audit logging
  private static async logSecurityEvent(
    event: string,
    details: Record<string, unknown> = {},
  ): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      details,
    };

    // In production, send to secure logging service
    console.log('🔐 Claude Skills Security Event:', logEntry);
  }
}

// Supporting interfaces
export interface CredentialRotationInfo {
  rotatedAt: Date;
  rotatedBy: 'system' | 'user' | 'admin';
  previousKeyHash: string | null;
  nextRotationDue: Date;
}

// Enhanced configuration factory with environment separation and runtime updates
export class ClaudeSkillsConfigFactory {
  // Configuration cache for runtime updates
  private static configCache: ClaudeSkillsConfig | null = null;
  private static configVersion: number = 0;

  static async createConfig(
    options: { forceRefresh?: boolean; requireBiometric?: boolean } = {},
  ): Promise<ClaudeSkillsConfig> {
    // Return cached config unless force refresh is requested
    if (!options.forceRefresh && this.configCache) {
      return this.configCache;
    }

    const apiKey = await ClaudeSkillsCredentialManager.getApiKey({
      requireBiometric: options.requireBiometric,
    });

    if (!apiKey) {
      throw new Error(
        'Claude Skills API key not found. Please configure credentials.',
      );
    }

    const environment = this.getEnvironment();
    const baseConfig: ClaudeSkillsConfig = {
      apiKey,
      environment,
      enabledSkills: await this.getEnabledSkills(environment),
      performanceMode: this.getPerformanceMode(environment),
      cacheConfig: this.getCacheConfig(environment),
      fallbackConfig: this.getFallbackConfig(environment),
      monitoringConfig: this.getMonitoringConfig(environment),
      securityConfig: this.getSecurityConfig(environment),
      rotationConfig: this.getRotationConfig(environment),
    };

    // Cache the configuration
    this.configCache = baseConfig;
    this.configVersion++;

    return baseConfig;
  }

  // Runtime configuration updates
  static async updateConfig(
    updates: Partial<ClaudeSkillsConfig>,
  ): Promise<ClaudeSkillsConfig> {
    const currentConfig = await this.createConfig({ forceRefresh: true });

    const updatedConfig = {
      ...currentConfig,
      ...updates,
    };

    // Validate the updated configuration
    const validation =
      ClaudeSkillsConfigValidator.validateConfig(updatedConfig);
    if (!validation.isValid) {
      throw new Error(
        `Configuration update failed: ${validation.errors.join(', ')}`,
      );
    }

    // Update cache
    this.configCache = updatedConfig;
    this.configVersion++;

    // Persist skill configuration changes
    if (updates.enabledSkills) {
      await this.persistSkillConfiguration(updates.enabledSkills);
    }

    return updatedConfig;
  }

  // Get current configuration version for change detection
  static getConfigVersion(): number {
    return this.configVersion;
  }

  // Clear configuration cache
  static clearCache(): void {
    this.configCache = null;
  }

  private static getEnvironment(): 'development' | 'staging' | 'production' {
    // Enhanced environment detection with multiple sources

    // 1. Check explicit environment variable
    const explicitEnv = process.env.CLAUDE_SKILLS_ENVIRONMENT;
    if (
      explicitEnv === 'development' ||
      explicitEnv === 'staging' ||
      explicitEnv === 'production'
    ) {
      return explicitEnv;
    }

    // 2. Check if we're in React Native development mode
    if (__DEV__) {
      return 'development';
    }

    // 3. Check Node environment (fallback)
    const nodeEnv = process.env.NODE_ENV;
    if (nodeEnv === 'development') {
      return 'development';
    } else if (nodeEnv === 'staging') {
      return 'staging';
    }

    // 4. Check app environment from main config
    if (Environment.app.environment === 'development') {
      return 'development';
    }

    // 5. Safe default - production
    return 'production';
  }

  private static async getEnabledSkills(
    environment: string,
  ): Promise<SkillType[]> {
    // Check for persisted skill configuration
    const persistedSkills = await this.getPersistedSkillConfiguration();
    if (persistedSkills.length > 0) {
      return persistedSkills;
    }

    // Default skill configurations by environment
    const allSkills: SkillType[] = [
      'ContentPredictionSkill',
      'ResourceOptimizationSkill',
      'QualityAssessmentSkill',
      'BehaviorAnalysisSkill',
      'ErrorRecoverySkill',
    ];

    switch (environment) {
      case 'development':
        // Enable all skills for testing
        return allSkills;

      case 'staging':
        // Enable most skills for validation
        return [
          'ContentPredictionSkill',
          'ResourceOptimizationSkill',
          'QualityAssessmentSkill',
          'ErrorRecoverySkill',
        ];

      case 'production':
        // Conservative approach - start with essential skills
        return ['ResourceOptimizationSkill', 'ErrorRecoverySkill'];

      default:
        return ['ErrorRecoverySkill']; // Minimum viable skill set
    }
  }

  private static getPerformanceMode(environment: string): PerformanceMode {
    // Performance mode based on environment and device capabilities
    switch (environment) {
      case 'development':
        return 'performance'; // Prioritize speed for development
      case 'staging':
        return 'balanced'; // Test production-like behavior
      case 'production':
        return 'battery'; // Optimize for battery in production
      default:
        return 'balanced';
    }
  }

  private static getCacheConfig(environment: string): CacheConfiguration {
    const baseConfig = {
      enablePredictivePreloading: true,
      deviceAwareSizing: true,
    };

    switch (environment) {
      case 'development':
        return {
          ...baseConfig,
          maxCacheSize: 100, // Larger cache for testing
          cacheTTL: 1800, // 30 minutes for faster iteration
        };

      case 'staging':
        return {
          ...baseConfig,
          maxCacheSize: 75, // Medium cache size
          cacheTTL: 3600, // 1 hour
        };

      case 'production':
        return {
          ...baseConfig,
          maxCacheSize: 50, // Conservative cache size
          cacheTTL: 7200, // 2 hours for stability
        };

      default:
        return {
          ...baseConfig,
          maxCacheSize: 25,
          cacheTTL: 3600,
        };
    }
  }

  private static getFallbackConfig(environment: string): FallbackConfiguration {
    const baseConfig = {
      enableGracefulDegradation: true,
    };

    switch (environment) {
      case 'development':
        return {
          ...baseConfig,
          maxRetryAttempts: 5, // More retries for debugging
          retryBackoffMs: 500, // Faster retries
          circuitBreakerThreshold: 10,
        };

      case 'staging':
        return {
          ...baseConfig,
          maxRetryAttempts: 3,
          retryBackoffMs: 1000,
          circuitBreakerThreshold: 7,
        };

      case 'production':
        return {
          ...baseConfig,
          maxRetryAttempts: 2, // Conservative retries
          retryBackoffMs: 2000, // Longer backoff
          circuitBreakerThreshold: 5,
        };

      default:
        return {
          ...baseConfig,
          maxRetryAttempts: 1,
          retryBackoffMs: 3000,
          circuitBreakerThreshold: 3,
        };
    }
  }

  private static getMonitoringConfig(
    environment: string,
  ): MonitoringConfiguration {
    switch (environment) {
      case 'development':
        return {
          enablePerformanceTracking: true,
          enableErrorReporting: true,
          metricsCollectionInterval: 5000, // Frequent monitoring
          enableDebugLogs: true,
        };

      case 'staging':
        return {
          enablePerformanceTracking: true,
          enableErrorReporting: true,
          metricsCollectionInterval: 15000,
          enableDebugLogs: true, // Keep debug logs for staging
        };

      case 'production':
        return {
          enablePerformanceTracking: true,
          enableErrorReporting: true,
          metricsCollectionInterval: 60000, // Less frequent in production
          enableDebugLogs: false,
        };

      default:
        return {
          enablePerformanceTracking: false,
          enableErrorReporting: true,
          metricsCollectionInterval: 120000,
          enableDebugLogs: false,
        };
    }
  }

  // Security configuration based on environment
  private static getSecurityConfig(environment: string): SecurityConfiguration {
    switch (environment) {
      case 'development':
        return {
          encryptionLevel: 'standard',
          requireBiometricAuth: false, // Easier for development
          sessionTimeout: 60, // 1 hour
          maxFailedAttempts: 10, // More lenient
          enableAuditLogging: true,
        };

      case 'staging':
        return {
          encryptionLevel: 'enhanced',
          requireBiometricAuth: true,
          sessionTimeout: 30, // 30 minutes
          maxFailedAttempts: 7,
          enableAuditLogging: true,
        };

      case 'production':
        return {
          encryptionLevel: 'enhanced',
          requireBiometricAuth: true,
          sessionTimeout: 15, // 15 minutes
          maxFailedAttempts: 5,
          enableAuditLogging: true,
        };

      default:
        return {
          encryptionLevel: 'standard',
          requireBiometricAuth: false,
          sessionTimeout: 10,
          maxFailedAttempts: 3,
          enableAuditLogging: false,
        };
    }
  }

  // Credential rotation configuration
  private static getRotationConfig(
    environment: string,
  ): CredentialRotationConfiguration {
    switch (environment) {
      case 'development':
        return {
          enableAutoRotation: false, // Manual rotation for dev
          rotationIntervalDays: 90,
          notifyBeforeExpiry: true,
          expiryWarningDays: 14,
          backupKeyCount: 2,
        };

      case 'staging':
        return {
          enableAutoRotation: true,
          rotationIntervalDays: 45, // More frequent for testing
          notifyBeforeExpiry: true,
          expiryWarningDays: 7,
          backupKeyCount: 3,
        };

      case 'production':
        return {
          enableAutoRotation: true,
          rotationIntervalDays: 30, // Monthly rotation
          notifyBeforeExpiry: true,
          expiryWarningDays: 7,
          backupKeyCount: 5,
        };

      default:
        return {
          enableAutoRotation: false,
          rotationIntervalDays: 365,
          notifyBeforeExpiry: false,
          expiryWarningDays: 30,
          backupKeyCount: 1,
        };
    }
  }

  // Skill configuration persistence
  private static readonly SKILL_CONFIG_KEY = 'claude_skills_enabled_skills';

  private static async persistSkillConfiguration(
    skills: SkillType[],
  ): Promise<void> {
    try {
      await AsyncStorage.setItem(this.SKILL_CONFIG_KEY, JSON.stringify(skills));
    } catch (error) {
      console.error('Failed to persist skill configuration:', error);
    }
  }

  private static async getPersistedSkillConfiguration(): Promise<SkillType[]> {
    try {
      const skills = await AsyncStorage.getItem(this.SKILL_CONFIG_KEY);
      return skills ? JSON.parse(skills) : [];
    } catch (error) {
      console.error('Failed to get persisted skill configuration:', error);
      return [];
    }
  }

  // Clear all persisted configurations
  static async clearPersistedConfig(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.SKILL_CONFIG_KEY);
      this.clearCache();
    } catch (error) {
      console.error('Failed to clear persisted configuration:', error);
    }
  }
}

// Enhanced configuration validation with security checks
export class ClaudeSkillsConfigValidator {
  static validateConfig(config: ClaudeSkillsConfig): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Validate API key
    if (!config.apiKey || config.apiKey.length < 10) {
      errors.push('Invalid API key: must be at least 10 characters');
    }

    // Validate environment
    if (
      !['development', 'staging', 'production'].includes(config.environment)
    ) {
      errors.push(
        'Invalid environment: must be development, staging, or production',
      );
    }

    // Validate enabled skills
    if (!config.enabledSkills || config.enabledSkills.length === 0) {
      errors.push('No skills enabled: at least one skill must be enabled');
    }

    // Validate cache configuration
    if (
      config.cacheConfig.maxCacheSize < 10 ||
      config.cacheConfig.maxCacheSize > 200
    ) {
      errors.push('Invalid cache size: must be between 10MB and 200MB');
    }

    if (
      config.cacheConfig.cacheTTL < 300 ||
      config.cacheConfig.cacheTTL > 86400
    ) {
      errors.push('Invalid cache TTL: must be between 5 minutes and 24 hours');
    }

    // Validate fallback configuration
    if (
      config.fallbackConfig.maxRetryAttempts < 1 ||
      config.fallbackConfig.maxRetryAttempts > 10
    ) {
      errors.push('Invalid retry attempts: must be between 1 and 10');
    }

    // Additional security validations
    this.validateSecurityConfig(config, errors);
    this.validateRotationConfig(config, errors);

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private static validateSecurityConfig(
    config: ClaudeSkillsConfig,
    errors: string[],
  ): void {
    const security = config.securityConfig;

    if (!security) {
      errors.push('Security configuration is required');
      return;
    }

    if (!['standard', 'enhanced'].includes(security.encryptionLevel)) {
      errors.push('Invalid encryption level: must be standard or enhanced');
    }

    if (security.sessionTimeout < 5 || security.sessionTimeout > 120) {
      errors.push('Invalid session timeout: must be between 5 and 120 minutes');
    }

    if (security.maxFailedAttempts < 1 || security.maxFailedAttempts > 20) {
      errors.push('Invalid max failed attempts: must be between 1 and 20');
    }
  }

  private static validateRotationConfig(
    config: ClaudeSkillsConfig,
    errors: string[],
  ): void {
    const rotation = config.rotationConfig;

    if (!rotation) {
      errors.push('Rotation configuration is required');
      return;
    }

    if (
      rotation.rotationIntervalDays < 1 ||
      rotation.rotationIntervalDays > 365
    ) {
      errors.push('Invalid rotation interval: must be between 1 and 365 days');
    }

    if (rotation.expiryWarningDays < 1 || rotation.expiryWarningDays > 30) {
      errors.push('Invalid expiry warning days: must be between 1 and 30 days');
    }

    if (rotation.backupKeyCount < 1 || rotation.backupKeyCount > 10) {
      errors.push('Invalid backup key count: must be between 1 and 10');
    }
  }

  // Validate configuration for specific environment
  static validateForEnvironment(
    config: ClaudeSkillsConfig,
    environment: string,
  ): { isValid: boolean; errors: string[]; warnings: string[] } {
    const baseValidation = this.validateConfig(config);
    const warnings: string[] = [];

    // Environment-specific validations
    if (environment === 'production') {
      if (config.securityConfig.encryptionLevel !== 'enhanced') {
        baseValidation.errors.push(
          'Production environment requires enhanced encryption',
        );
      }

      if (!config.securityConfig.requireBiometricAuth) {
        warnings.push(
          'Consider enabling biometric authentication for production',
        );
      }

      if (config.monitoringConfig.enableDebugLogs) {
        warnings.push('Debug logging should be disabled in production');
      }
    }

    if (
      environment === 'development' &&
      config.rotationConfig.enableAutoRotation
    ) {
      warnings.push(
        'Auto-rotation might be unnecessary for development environment',
      );
    }

    return {
      ...baseValidation,
      warnings,
    };
  }
}

// Environment-specific configuration manager
export class ClaudeSkillsEnvironmentManager {
  static async switchEnvironment(
    newEnvironment: 'development' | 'staging' | 'production',
  ): Promise<void> {
    // Clear current configuration
    ClaudeSkillsConfigFactory.clearCache();

    // Set environment variable for future config creation
    process.env.CLAUDE_SKILLS_ENVIRONMENT = newEnvironment;

    // Create new configuration
    const newConfig = await ClaudeSkillsConfigFactory.createConfig({
      forceRefresh: true,
    });

    // Validate the new configuration
    const validation = ClaudeSkillsConfigValidator.validateForEnvironment(
      newConfig,
      newEnvironment,
    );
    if (!validation.isValid) {
      throw new Error(
        `Invalid configuration for ${newEnvironment}: ${validation.errors.join(
          ', ',
        )}`,
      );
    }

    // Notify listeners of the change
    ClaudeSkillsConfigNotificationManager.notifyConfigChange(
      newConfig,
      ClaudeSkillsConfigFactory.getConfigVersion(),
    );

    console.log(`🔄 Switched to ${newEnvironment} environment`);
    if (validation.warnings.length > 0) {
      console.warn('⚠️ Configuration warnings:', validation.warnings);
    }
  }

  static getCurrentEnvironment(): string {
    return (
      process.env.CLAUDE_SKILLS_ENVIRONMENT ||
      Environment.app.environment ||
      (__DEV__ ? 'development' : 'production')
    );
  }

  static async validateCurrentEnvironment(): Promise<{
    isValid: boolean;
    issues: string[];
  }> {
    try {
      const currentEnv = this.getCurrentEnvironment();
      const config = await ClaudeSkillsConfigFactory.createConfig();
      const validation = ClaudeSkillsConfigValidator.validateForEnvironment(
        config,
        currentEnv,
      );

      return {
        isValid: validation.isValid && validation.warnings.length === 0,
        issues: [...validation.errors, ...validation.warnings],
      };
    } catch (error) {
      return {
        isValid: false,
        issues: [error instanceof Error ? error.message : String(error)],
      };
    }
  }
}

// Configuration change notification system
export class ClaudeSkillsConfigNotificationManager {
  private static listeners: Array<
    (config: ClaudeSkillsConfig, version: number) => void
  > = [];

  static addListener(
    listener: (config: ClaudeSkillsConfig, version: number) => void,
  ): () => void {
    this.listeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  static notifyConfigChange(config: ClaudeSkillsConfig, version: number): void {
    this.listeners.forEach(listener => {
      try {
        listener(config, version);
      } catch (error) {
        console.error('Error in config change listener:', error);
      }
    });
  }
}

// Default export
export default ClaudeSkillsConfigFactory;
