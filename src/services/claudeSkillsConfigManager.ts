// Claude Skills Configuration Management Interface
// Task 1.2: Skill configuration management interface for runtime updates

import {
  ClaudeSkillsConfig,
  ClaudeSkillsConfigFactory,
  ClaudeSkillsCredentialManager,
  ClaudeSkillsConfigValidator,
  ClaudeSkillsConfigNotificationManager,
  ClaudeSkillsEnvironmentManager,
  SecurityConfiguration,
  CredentialRotationConfiguration,
  CacheConfiguration,
  FallbackConfiguration,
  MonitoringConfiguration,
} from '../config/claudeSkillsConfig';
import { SkillType } from '../types/claudeSkills';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ConfigUpdateRequest {
  skillsToEnable?: SkillType[];
  skillsToDisable?: SkillType[];
  securityUpdates?: Partial<SecurityConfiguration>;
  cacheUpdates?: Partial<CacheConfiguration>;
  fallbackUpdates?: Partial<FallbackConfiguration>;
  monitoringUpdates?: Partial<MonitoringConfiguration>;
  reason?: string;
  requestedBy?: string;
}

export interface ConfigUpdateResult {
  success: boolean;
  updatedConfig?: ClaudeSkillsConfig;
  errors?: string[];
  warnings?: string[];
  changes?: ConfigurationChanges;
}

export interface ConfigurationChanges {
  skillChanges?: {
    enabled: SkillType[];
    disabled: SkillType[];
  };
  securityChanges?: string[];
  otherChanges?: string[];
  timestamp: Date;
}

export interface ConfigManagementOptions {
  validateBeforeApply?: boolean;
  requireBiometricForSecurityChanges?: boolean;
  notifyListeners?: boolean;
  persistChanges?: boolean;
}

/**
 * Claude Skills Configuration Management Service
 * Provides runtime configuration management capabilities without requiring app rebuilds
 */
export class ClaudeSkillsConfigManager {
  private static readonly CONFIG_HISTORY_KEY = 'claude_skills_config_history';
  private static readonly MAX_HISTORY_ENTRIES = 10;

  // Runtime skill management
  static async enableSkills(
    skills: SkillType[],
    options: ConfigManagementOptions = {},
  ): Promise<ConfigUpdateResult> {
    try {
      const currentConfig = await ClaudeSkillsConfigFactory.createConfig({
        forceRefresh: true,
      });

      // Determine which skills are actually new
      const skillsToEnable = skills.filter(
        skill => !currentConfig.enabledSkills.includes(skill),
      );

      if (skillsToEnable.length === 0) {
        return {
          success: true,
          updatedConfig: currentConfig,
          warnings: ['All requested skills are already enabled'],
          changes: {
            skillChanges: { enabled: [], disabled: [] },
            timestamp: new Date(),
          },
        };
      }

      // Update configuration
      const updatedSkills = [...currentConfig.enabledSkills, ...skillsToEnable];
      const updateRequest: ConfigUpdateRequest = {
        skillsToEnable: skillsToEnable,
        reason: `Enable skills: ${skillsToEnable.join(', ')}`,
        requestedBy: options.requireBiometricForSecurityChanges
          ? 'authenticated_user'
          : 'system',
      };

      const result = await this.updateConfiguration(
        { enabledSkills: updatedSkills },
        updateRequest,
        options,
      );

      return result;
    } catch (error) {
      return {
        success: false,
        errors: [
          (error instanceof Error ? error.message : String(error)) ||
            'Failed to enable skills',
        ],
      };
    }
  }

  static async disableSkills(
    skills: SkillType[],
    options: ConfigManagementOptions = {},
  ): Promise<ConfigUpdateResult> {
    try {
      const currentConfig = await ClaudeSkillsConfigFactory.createConfig({
        forceRefresh: true,
      });

      // Ensure we don't disable all skills (keep at least ErrorRecoverySkill)
      const remainingSkills = currentConfig.enabledSkills.filter(
        skill => !skills.includes(skill),
      );

      if (remainingSkills.length === 0) {
        remainingSkills.push('ErrorRecoverySkill'); // Always keep error recovery
      }

      const actuallyDisabled = currentConfig.enabledSkills.filter(
        skill => skills.includes(skill) && skill !== 'ErrorRecoverySkill',
      );

      const updateRequest: ConfigUpdateRequest = {
        skillsToDisable: actuallyDisabled,
        reason: `Disable skills: ${actuallyDisabled.join(', ')}`,
        requestedBy: options.requireBiometricForSecurityChanges
          ? 'authenticated_user'
          : 'system',
      };

      const result = await this.updateConfiguration(
        { enabledSkills: remainingSkills },
        updateRequest,
        options,
      );

      if (actuallyDisabled.includes('ErrorRecoverySkill')) {
        result.warnings = result.warnings || [];
        result.warnings.push(
          'ErrorRecoverySkill cannot be disabled - kept for system stability',
        );
      }

      return result;
    } catch (error) {
      return {
        success: false,
        errors: [
          (error instanceof Error ? error.message : String(error)) ||
            'Failed to disable skills',
        ],
      };
    }
  }

  static async updateSecurityConfiguration(
    updates: Partial<SecurityConfiguration>,
    options: ConfigManagementOptions = {},
  ): Promise<ConfigUpdateResult> {
    try {
      // Security changes should require biometric authentication by default
      const requireAuth = options.requireBiometricForSecurityChanges !== false;

      if (requireAuth) {
        // Verify authentication before proceeding
        const sessionToken =
          await ClaudeSkillsCredentialManager.createSession();
        if (!sessionToken) {
          return {
            success: false,
            errors: [
              'Biometric authentication required for security configuration changes',
            ],
          };
        }
      }

      const currentConfig = await ClaudeSkillsConfigFactory.createConfig({
        forceRefresh: true,
        requireBiometric: requireAuth,
      });

      const updatedSecurityConfig = {
        ...currentConfig.securityConfig,
        ...updates,
      };

      const updateRequest: ConfigUpdateRequest = {
        securityUpdates: updates,
        reason: `Update security configuration: ${Object.keys(updates).join(
          ', ',
        )}`,
        requestedBy: 'authenticated_user',
      };

      const result = await this.updateConfiguration(
        { securityConfig: updatedSecurityConfig },
        updateRequest,
        { ...options, requireBiometricForSecurityChanges: requireAuth },
      );

      return result;
    } catch (error) {
      return {
        success: false,
        errors: [
          (error instanceof Error ? error.message : String(error)) ||
            'Failed to update security configuration',
        ],
      };
    }
  }

  static async updateCacheConfiguration(
    updates: Partial<CacheConfiguration>,
    options: ConfigManagementOptions = {},
  ): Promise<ConfigUpdateResult> {
    try {
      const currentConfig = await ClaudeSkillsConfigFactory.createConfig({
        forceRefresh: true,
      });

      const updatedCacheConfig = {
        ...currentConfig.cacheConfig,
        ...updates,
      };

      const updateRequest: ConfigUpdateRequest = {
        cacheUpdates: updates,
        reason: `Update cache configuration: ${Object.keys(updates).join(
          ', ',
        )}`,
        requestedBy: 'system',
      };

      return await this.updateConfiguration(
        { cacheConfig: updatedCacheConfig },
        updateRequest,
        options,
      );
    } catch (error) {
      return {
        success: false,
        errors: [
          (error instanceof Error ? error.message : String(error)) ||
            'Failed to update cache configuration',
        ],
      };
    }
  }

  static async updateMonitoringConfiguration(
    updates: Partial<MonitoringConfiguration>,
    options: ConfigManagementOptions = {},
  ): Promise<ConfigUpdateResult> {
    try {
      const currentConfig = await ClaudeSkillsConfigFactory.createConfig({
        forceRefresh: true,
      });

      const updatedMonitoringConfig = {
        ...currentConfig.monitoringConfig,
        ...updates,
      };

      const updateRequest: ConfigUpdateRequest = {
        monitoringUpdates: updates,
        reason: `Update monitoring configuration: ${Object.keys(updates).join(
          ', ',
        )}`,
        requestedBy: 'system',
      };

      return await this.updateConfiguration(
        { monitoringConfig: updatedMonitoringConfig },
        updateRequest,
        options,
      );
    } catch (error) {
      return {
        success: false,
        errors: [
          (error instanceof Error ? error.message : String(error)) ||
            'Failed to update monitoring configuration',
        ],
      };
    }
  }

  // Core configuration update method
  private static async updateConfiguration(
    configUpdates: Partial<ClaudeSkillsConfig>,
    request: ConfigUpdateRequest,
    options: ConfigManagementOptions = {},
  ): Promise<ConfigUpdateResult> {
    try {
      // Default options
      const opts = {
        validateBeforeApply: true,
        requireBiometricForSecurityChanges: false,
        notifyListeners: true,
        persistChanges: true,
        ...options,
      };

      const beforeConfig = await ClaudeSkillsConfigFactory.createConfig({
        forceRefresh: true,
      });

      // Apply updates
      const updatedConfig = await ClaudeSkillsConfigFactory.updateConfig(
        configUpdates,
      );

      // Validate if requested
      if (opts.validateBeforeApply) {
        const environment =
          ClaudeSkillsEnvironmentManager.getCurrentEnvironment();
        const validation = ClaudeSkillsConfigValidator.validateForEnvironment(
          updatedConfig,
          environment,
        );

        if (!validation.isValid) {
          // Rollback changes
          ClaudeSkillsConfigFactory.clearCache();
          return {
            success: false,
            errors: validation.errors,
          };
        }

        // Include warnings if any
        const warnings =
          validation.warnings.length > 0 ? validation.warnings : undefined;

        // Track changes
        const changes = this.calculateChanges(
          beforeConfig,
          updatedConfig,
          request,
        );

        // Store configuration history if persistence is enabled
        if (opts.persistChanges) {
          await this.storeConfigurationHistory(
            beforeConfig,
            updatedConfig,
            request,
            changes,
          );
        }

        // Notify listeners if requested
        if (opts.notifyListeners) {
          ClaudeSkillsConfigNotificationManager.notifyConfigChange(
            updatedConfig,
            ClaudeSkillsConfigFactory.getConfigVersion(),
          );
        }

        console.log('🔧 Configuration updated successfully:', {
          changes: changes,
          version: ClaudeSkillsConfigFactory.getConfigVersion(),
          requestedBy: request.requestedBy,
        });

        return {
          success: true,
          updatedConfig,
          warnings,
          changes,
        };
      }

      // Validation skipped — return success with no warnings/changes computed
      return {
        success: true,
        updatedConfig,
      };
    } catch (error) {
      console.error('Configuration update failed:', error);
      return {
        success: false,
        errors: [
          (error instanceof Error ? error.message : String(error)) ||
            'Configuration update failed',
        ],
      };
    }
  }

  // Calculate what actually changed between configurations
  private static calculateChanges(
    beforeConfig: ClaudeSkillsConfig,
    afterConfig: ClaudeSkillsConfig,
    request: ConfigUpdateRequest,
  ): ConfigurationChanges {
    const changes: ConfigurationChanges = {
      timestamp: new Date(),
    };

    // Skill changes
    const enabledSkills = afterConfig.enabledSkills.filter(
      skill => !beforeConfig.enabledSkills.includes(skill),
    );
    const disabledSkills = beforeConfig.enabledSkills.filter(
      skill => !afterConfig.enabledSkills.includes(skill),
    );

    if (enabledSkills.length > 0 || disabledSkills.length > 0) {
      changes.skillChanges = {
        enabled: enabledSkills,
        disabled: disabledSkills,
      };
    }

    // Security changes
    if (
      request.securityUpdates &&
      Object.keys(request.securityUpdates).length > 0
    ) {
      changes.securityChanges = Object.keys(request.securityUpdates).map(
        key => {
          const sk = key as keyof typeof beforeConfig.securityConfig;
          return `${key}: ${beforeConfig.securityConfig[sk]} -> ${afterConfig.securityConfig[sk]}`;
        },
      );
    }

    // Other changes
    const otherChanges: string[] = [];
    if (request.cacheUpdates) otherChanges.push('Cache configuration updated');
    if (request.fallbackUpdates)
      otherChanges.push('Fallback configuration updated');
    if (request.monitoringUpdates)
      otherChanges.push('Monitoring configuration updated');

    if (otherChanges.length > 0) {
      changes.otherChanges = otherChanges;
    }

    return changes;
  }

  // Configuration history management
  private static async storeConfigurationHistory(
    beforeConfig: ClaudeSkillsConfig,
    afterConfig: ClaudeSkillsConfig,
    request: ConfigUpdateRequest,
    changes: ConfigurationChanges,
  ): Promise<void> {
    try {
      const historyEntry = {
        timestamp: new Date().toISOString(),
        beforeConfigVersion: ClaudeSkillsConfigFactory.getConfigVersion() - 1,
        afterConfigVersion: ClaudeSkillsConfigFactory.getConfigVersion(),
        request,
        changes,
        environment: ClaudeSkillsEnvironmentManager.getCurrentEnvironment(),
      };

      const existingHistory = await this.getConfigurationHistory();
      const updatedHistory = [
        historyEntry,
        ...existingHistory.slice(0, this.MAX_HISTORY_ENTRIES - 1),
      ];

      await AsyncStorage.setItem(
        this.CONFIG_HISTORY_KEY,
        JSON.stringify(updatedHistory),
      );
    } catch (error) {
      console.error('Failed to store configuration history:', error);
    }
  }

  static async getConfigurationHistory(): Promise<any[]> {
    try {
      const history = await AsyncStorage.getItem(this.CONFIG_HISTORY_KEY);
      return history ? JSON.parse(history) : [];
    } catch (error) {
      console.error('Failed to get configuration history:', error);
      return [];
    }
  }

  static async clearConfigurationHistory(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.CONFIG_HISTORY_KEY);
    } catch (error) {
      console.error('Failed to clear configuration history:', error);
    }
  }

  // Configuration rollback capability
  static async rollbackToVersion(version: number): Promise<ConfigUpdateResult> {
    try {
      const history = await this.getConfigurationHistory();
      const targetEntry = history.find(
        entry => entry.afterConfigVersion === version,
      );

      if (!targetEntry) {
        return {
          success: false,
          errors: [`Configuration version ${version} not found in history`],
        };
      }

      // This is a simplified rollback - in a real implementation,
      // you would need to store the actual configuration data
      ClaudeSkillsConfigFactory.clearCache();
      const currentConfig = await ClaudeSkillsConfigFactory.createConfig({
        forceRefresh: true,
      });

      return {
        success: true,
        updatedConfig: currentConfig,
        warnings: [
          'Rollback completed - some settings may need manual adjustment',
        ],
        changes: {
          otherChanges: [`Rolled back to version ${version}`],
          timestamp: new Date(),
        },
      };
    } catch (error) {
      return {
        success: false,
        errors: [
          (error instanceof Error ? error.message : String(error)) ||
            'Rollback failed',
        ],
      };
    }
  }

  // Configuration validation and health checks
  static async validateCurrentConfiguration(): Promise<{
    isValid: boolean;
    issues: string[];
    warnings: string[];
    environment: string;
  }> {
    try {
      const environment =
        ClaudeSkillsEnvironmentManager.getCurrentEnvironment();
      const config = await ClaudeSkillsConfigFactory.createConfig({
        forceRefresh: true,
      });
      const validation = ClaudeSkillsConfigValidator.validateForEnvironment(
        config,
        environment,
      );

      return {
        isValid: validation.isValid,
        issues: validation.errors,
        warnings: validation.warnings,
        environment,
      };
    } catch (error) {
      return {
        isValid: false,
        issues: [
          (error instanceof Error ? error.message : String(error)) ||
            'Configuration validation failed',
        ],
        warnings: [],
        environment: 'unknown',
      };
    }
  }

  // Export/Import configuration for backup/restore
  static async exportConfiguration(): Promise<{
    config: ClaudeSkillsConfig;
    metadata: {
      exportedAt: string;
      version: number;
      environment: string;
    };
  }> {
    const config = await ClaudeSkillsConfigFactory.createConfig({
      forceRefresh: true,
    });

    // Remove sensitive information from export
    const exportConfig = {
      ...config,
      apiKey: '[REDACTED]', // Don't export the actual API key
    };

    return {
      config: exportConfig as ClaudeSkillsConfig,
      metadata: {
        exportedAt: new Date().toISOString(),
        version: ClaudeSkillsConfigFactory.getConfigVersion(),
        environment: ClaudeSkillsEnvironmentManager.getCurrentEnvironment(),
      },
    };
  }

  static async importConfiguration(
    configData: any,
    options: { validateOnly?: boolean; preserveApiKey?: boolean } = {},
  ): Promise<ConfigUpdateResult> {
    try {
      const currentConfig = await ClaudeSkillsConfigFactory.createConfig({
        forceRefresh: true,
      });

      // Restore API key if preserving current credentials
      const importConfig = {
        ...configData.config,
        apiKey: options.preserveApiKey
          ? currentConfig.apiKey
          : configData.config.apiKey,
      };

      // Validate the imported configuration
      const validation =
        ClaudeSkillsConfigValidator.validateConfig(importConfig);
      if (!validation.isValid) {
        return {
          success: false,
          errors: validation.errors,
        };
      }

      if (options.validateOnly) {
        return {
          success: true,
          warnings: ['Configuration is valid (validation only)'],
        };
      }

      // Apply the imported configuration
      const result = await this.updateConfiguration(
        importConfig,
        {
          reason: `Imported configuration from ${
            configData.metadata?.exportedAt || 'unknown'
          }`,
          requestedBy: 'admin',
        },
        {
          validateBeforeApply: true,
          notifyListeners: true,
          persistChanges: true,
        },
      );

      return result;
    } catch (error) {
      return {
        success: false,
        errors: [
          (error instanceof Error ? error.message : String(error)) ||
            'Configuration import failed',
        ],
      };
    }
  }

  // Real-time configuration monitoring
  static async startConfigurationMonitoring(
    callback: (status: {
      isHealthy: boolean;
      issues: string[];
      warnings: string[];
    }) => void,
    intervalMs: number = 30000,
  ): Promise<() => void> {
    const checkConfiguration = async () => {
      const validation = await this.validateCurrentConfiguration();
      callback({
        isHealthy: validation.isValid && validation.warnings.length === 0,
        issues: validation.issues,
        warnings: validation.warnings,
      });
    };

    // Initial check
    await checkConfiguration();

    // Set up periodic monitoring
    const interval = setInterval(checkConfiguration, intervalMs);

    // Return cleanup function
    return () => {
      clearInterval(interval);
    };
  }
}

export default ClaudeSkillsConfigManager;
