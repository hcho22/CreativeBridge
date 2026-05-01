// Claude Skills Credential Rotation Service
// Task 1.2: Secure credential rotation procedures

import {
  ClaudeSkillsCredentialManager,
  ClaudeSkillsConfigFactory,
  CredentialRotationInfo,
  CredentialRotationConfiguration,
} from '../config/claudeSkillsConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface RotationSchedule {
  nextRotationDue: Date;
  warningDate: Date;
  isOverdue: boolean;
  daysUntilRotation: number;
}

export interface RotationResult {
  success: boolean;
  newKeyId?: string;
  rotationInfo?: CredentialRotationInfo;
  error?: string;
  warnings?: string[];
}

export interface RotationNotification {
  type: 'warning' | 'due' | 'overdue' | 'completed' | 'failed';
  message: string;
  daysUntilRotation?: number;
  action?: 'rotate_now' | 'schedule_rotation' | 'dismiss';
}

/**
 * Automated credential rotation service with security compliance
 * Handles secure API key rotation according to security policies
 */
export class ClaudeSkillsCredentialRotationService {
  private static readonly ROTATION_SCHEDULE_KEY =
    'claude_skills_rotation_schedule';
  private static readonly ROTATION_NOTIFICATION_KEY =
    'claude_skills_rotation_notifications';
  private static readonly ROTATION_LOCK_KEY = 'claude_skills_rotation_lock';

  // Check if rotation is due based on current configuration
  static async getRotationSchedule(): Promise<RotationSchedule> {
    try {
      const config = await ClaudeSkillsConfigFactory.createConfig();
      const rotationConfig = config.rotationConfig;
      const rotationMetadata =
        await ClaudeSkillsCredentialManager.getRotationMetadata();

      if (!rotationMetadata) {
        // No rotation history, create initial schedule
        const now = new Date();
        const nextRotation = new Date(
          now.getTime() +
            rotationConfig.rotationIntervalDays * 24 * 60 * 60 * 1000,
        );
        const warningDate = new Date(
          nextRotation.getTime() -
            rotationConfig.expiryWarningDays * 24 * 60 * 60 * 1000,
        );

        return {
          nextRotationDue: nextRotation,
          warningDate,
          isOverdue: false,
          daysUntilRotation: rotationConfig.rotationIntervalDays,
        };
      }

      const now = new Date();
      const nextRotationDue = new Date(rotationMetadata.nextRotationDue);
      const warningDate = new Date(
        nextRotationDue.getTime() -
          rotationConfig.expiryWarningDays * 24 * 60 * 60 * 1000,
      );
      const daysUntilRotation = Math.ceil(
        (nextRotationDue.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
      );

      return {
        nextRotationDue,
        warningDate,
        isOverdue: now > nextRotationDue,
        daysUntilRotation,
      };
    } catch (error) {
      console.error('Failed to get rotation schedule:', error);
      throw new Error('Unable to determine rotation schedule');
    }
  }

  // Check if rotation warning should be shown
  static async shouldShowRotationWarning(): Promise<RotationNotification | null> {
    try {
      const config = await ClaudeSkillsConfigFactory.createConfig();
      const schedule = await this.getRotationSchedule();

      if (!config.rotationConfig.notifyBeforeExpiry) {
        return null;
      }

      const now = new Date();

      if (schedule.isOverdue) {
        return {
          type: 'overdue',
          message: `API key rotation is overdue by ${Math.abs(
            schedule.daysUntilRotation,
          )} days. Immediate rotation required.`,
          action: 'rotate_now',
        };
      }

      if (schedule.daysUntilRotation <= 0) {
        return {
          type: 'due',
          message: 'API key rotation is due today. Please rotate credentials.',
          daysUntilRotation: 0,
          action: 'rotate_now',
        };
      }

      if (now >= schedule.warningDate) {
        return {
          type: 'warning',
          message: `API key rotation due in ${schedule.daysUntilRotation} days.`,
          daysUntilRotation: schedule.daysUntilRotation,
          action: 'schedule_rotation',
        };
      }

      return null;
    } catch (error) {
      console.error('Failed to check rotation warning:', error);
      return null;
    }
  }

  // Perform automatic credential rotation
  static async performAutomaticRotation(
    newApiKey?: string,
  ): Promise<RotationResult> {
    try {
      // Check if rotation is locked (already in progress)
      const isLocked = await this.isRotationLocked();
      if (isLocked) {
        return {
          success: false,
          error: 'Rotation already in progress',
        };
      }

      // Lock rotation to prevent concurrent operations
      await this.lockRotation();

      try {
        const config = await ClaudeSkillsConfigFactory.createConfig();

        if (!config.rotationConfig.enableAutoRotation && !newApiKey) {
          return {
            success: false,
            error: 'Automatic rotation is disabled and no new key provided',
          };
        }

        let rotationKey: string;

        if (newApiKey) {
          // Use provided key
          rotationKey = newApiKey;
        } else {
          // In a real implementation, this would fetch a new key from the API service
          rotationKey = await this.generateNewApiKey();
        }

        // Validate the new key format
        if (!this.validateApiKeyFormat(rotationKey)) {
          return {
            success: false,
            error: 'Invalid API key format',
          };
        }

        // Perform the rotation
        await ClaudeSkillsCredentialManager.rotateApiKey(rotationKey, {
          keepBackups: config.rotationConfig.backupKeyCount,
        });

        // Update rotation metadata
        const rotationInfo: CredentialRotationInfo = {
          rotatedAt: new Date(),
          rotatedBy: newApiKey ? 'admin' : 'system',
          previousKeyHash: await this.hashApiKey(config.apiKey),
          nextRotationDue: this.calculateNextRotationDate(
            config.rotationConfig.rotationIntervalDays,
          ),
        };

        // Clear configuration cache to force reload
        ClaudeSkillsConfigFactory.clearCache();

        // Log rotation event
        await this.logRotationEvent('ROTATION_COMPLETED', {
          rotationInfo,
          automatic: !newApiKey,
        });

        // Create completion notification
        await this.createRotationNotification({
          type: 'completed',
          message: `API key rotation completed successfully. Next rotation due: ${rotationInfo.nextRotationDue.toLocaleDateString()}`,
          action: 'dismiss',
        });

        return {
          success: true,
          newKeyId: this.getKeyIdentifier(rotationKey),
          rotationInfo,
        };
      } finally {
        // Always unlock rotation
        await this.unlockRotation();
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error('Automatic rotation failed:', error);

      // Log failure
      await this.logRotationEvent('ROTATION_FAILED', {
        error: errorMessage,
        automatic: !newApiKey,
      });

      // Create failure notification
      await this.createRotationNotification({
        type: 'failed',
        message: `API key rotation failed: ${errorMessage}`,
        action: 'rotate_now',
      });

      return {
        success: false,
        error: errorMessage || 'Rotation failed',
      };
    }
  }

  // Schedule future rotation
  static async scheduleRotation(date: Date): Promise<boolean> {
    try {
      const schedule = {
        scheduledRotationDate: date,
        scheduledBy: 'user',
        scheduledAt: new Date(),
      };

      await AsyncStorage.setItem(
        this.ROTATION_SCHEDULE_KEY,
        JSON.stringify(schedule),
      );

      await this.logRotationEvent('ROTATION_SCHEDULED', { schedule });

      return true;
    } catch (error) {
      console.error('Failed to schedule rotation:', error);
      return false;
    }
  }

  // Cancel scheduled rotation
  static async cancelScheduledRotation(): Promise<boolean> {
    try {
      await AsyncStorage.removeItem(this.ROTATION_SCHEDULE_KEY);
      await this.logRotationEvent('ROTATION_CANCELLED');
      return true;
    } catch (error) {
      console.error('Failed to cancel scheduled rotation:', error);
      return false;
    }
  }

  // Get rotation history
  static async getRotationHistory(): Promise<any[]> {
    try {
      const history = await AsyncStorage.getItem(
        'claude_skills_rotation_history',
      );
      return history ? JSON.parse(history) : [];
    } catch (error) {
      console.error('Failed to get rotation history:', error);
      return [];
    }
  }

  // Emergency rotation (immediate, forced)
  static async performEmergencyRotation(
    newApiKey: string,
    reason: string,
  ): Promise<RotationResult> {
    try {
      // Override rotation lock for emergency
      await this.unlockRotation();

      const result = await this.performAutomaticRotation(newApiKey);

      if (result.success) {
        await this.logRotationEvent('EMERGENCY_ROTATION', {
          reason,
          rotationInfo: result.rotationInfo,
        });
      }

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage || 'Emergency rotation failed',
      };
    }
  }

  // Rotation monitoring and background checks
  static async startRotationMonitoring(
    intervalHours: number = 24,
  ): Promise<() => void> {
    const checkRotation = async () => {
      try {
        const config = await ClaudeSkillsConfigFactory.createConfig();

        if (config.rotationConfig.enableAutoRotation) {
          const schedule = await this.getRotationSchedule();

          if (schedule.isOverdue) {
            console.log('🔄 Starting overdue credential rotation');
            await this.performAutomaticRotation();
          } else {
            const warning = await this.shouldShowRotationWarning();
            if (warning) {
              await this.createRotationNotification(warning);
            }
          }
        }
      } catch (error) {
        console.error('Rotation monitoring check failed:', error);
      }
    };

    // Initial check
    await checkRotation();

    // Schedule periodic checks
    const interval = setInterval(checkRotation, intervalHours * 60 * 60 * 1000);

    // Return cleanup function
    return () => {
      clearInterval(interval);
    };
  }

  // Utility methods
  private static async generateNewApiKey(): Promise<string> {
    // In a real implementation, this would call the Claude Skills API to generate a new key
    // For now, return a mock key format (COPPA: no device IDs in key generation)
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 8);
    return `cs_auto_${timestamp}_${random}`;
  }

  private static validateApiKeyFormat(apiKey: string): boolean {
    // Basic validation - adjust based on actual Claude Skills API key format
    return (
      Boolean(apiKey) && apiKey.length >= 10 && /^[a-zA-Z0-9_-]+$/.test(apiKey)
    );
  }

  private static async hashApiKey(apiKey: string): Promise<string> {
    // Simple hash for audit purposes
    const start = apiKey.substring(0, 4);
    const end = apiKey.substring(apiKey.length - 4);
    return `hash_${start}...${end}_${apiKey.length}`;
  }

  private static getKeyIdentifier(apiKey: string): string {
    // Create a safe identifier for the key
    const hash = this.hashApiKey(apiKey);
    return `key_${Date.now()}_${hash}`;
  }

  private static calculateNextRotationDate(intervalDays: number): Date {
    const now = new Date();
    return new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);
  }

  // Rotation locking to prevent concurrent operations
  private static async lockRotation(): Promise<void> {
    const lockData = {
      lockedAt: new Date().toISOString(),
      lockId: `lock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
    await AsyncStorage.setItem(
      this.ROTATION_LOCK_KEY,
      JSON.stringify(lockData),
    );
  }

  private static async unlockRotation(): Promise<void> {
    await AsyncStorage.removeItem(this.ROTATION_LOCK_KEY);
  }

  private static async isRotationLocked(): Promise<boolean> {
    try {
      const lockData = await AsyncStorage.getItem(this.ROTATION_LOCK_KEY);
      if (!lockData) return false;

      const lock = JSON.parse(lockData);
      const lockAge = Date.now() - new Date(lock.lockedAt).getTime();

      // Auto-unlock after 10 minutes to prevent permanent locks
      if (lockAge > 10 * 60 * 1000) {
        await this.unlockRotation();
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  // Notification management
  private static async createRotationNotification(
    notification: RotationNotification,
  ): Promise<void> {
    try {
      const notifications = await this.getRotationNotifications();
      const updatedNotifications = [
        {
          ...notification,
          id: `notification_${Date.now()}`,
          createdAt: new Date().toISOString(),
          read: false,
        },
        ...notifications.slice(0, 9), // Keep last 10 notifications
      ];

      await AsyncStorage.setItem(
        this.ROTATION_NOTIFICATION_KEY,
        JSON.stringify(updatedNotifications),
      );
    } catch (error) {
      console.error('Failed to create rotation notification:', error);
    }
  }

  static async getRotationNotifications(): Promise<any[]> {
    try {
      const notifications = await AsyncStorage.getItem(
        this.ROTATION_NOTIFICATION_KEY,
      );
      return notifications ? JSON.parse(notifications) : [];
    } catch (error) {
      console.error('Failed to get rotation notifications:', error);
      return [];
    }
  }

  static async markNotificationAsRead(notificationId: string): Promise<void> {
    try {
      const notifications = await this.getRotationNotifications();
      const updated = notifications.map(n =>
        n.id === notificationId ? { ...n, read: true } : n,
      );
      await AsyncStorage.setItem(
        this.ROTATION_NOTIFICATION_KEY,
        JSON.stringify(updated),
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }

  static async clearOldNotifications(): Promise<void> {
    try {
      const notifications = await this.getRotationNotifications();
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const recentNotifications = notifications.filter(
        n => new Date(n.createdAt) > oneWeekAgo,
      );

      await AsyncStorage.setItem(
        this.ROTATION_NOTIFICATION_KEY,
        JSON.stringify(recentNotifications),
      );
    } catch (error) {
      console.error('Failed to clear old notifications:', error);
    }
  }

  // Logging and audit trail
  private static async logRotationEvent(
    event: string,
    details: any = {},
  ): Promise<void> {
    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        event,
        details,
        environment: process.env.CLAUDE_SKILLS_ENVIRONMENT || 'unknown',
      };

      // Get existing history
      const history = await this.getRotationHistory();
      const updatedHistory = [logEntry, ...history.slice(0, 49)]; // Keep last 50 events

      await AsyncStorage.setItem(
        'claude_skills_rotation_history',
        JSON.stringify(updatedHistory),
      );

      // Also log to console for development
      console.log('🔐 Claude Skills Rotation Event:', logEntry);
    } catch (error) {
      console.error('Failed to log rotation event:', error);
    }
  }

  // Health check and validation
  static async validateRotationSystem(): Promise<{
    isHealthy: boolean;
    issues: string[];
    warnings: string[];
  }> {
    const issues: string[] = [];
    const warnings: string[] = [];

    try {
      // Check if credentials are stored
      const hasCredentials =
        await ClaudeSkillsCredentialManager.isApiKeyStored();
      if (!hasCredentials) {
        issues.push('No API key stored');
      }

      // Check rotation configuration
      const config = await ClaudeSkillsConfigFactory.createConfig();
      if (config.rotationConfig.enableAutoRotation) {
        const schedule = await this.getRotationSchedule();

        if (schedule.isOverdue) {
          issues.push('Credential rotation is overdue');
        } else if (schedule.daysUntilRotation <= 3) {
          warnings.push('Credential rotation due soon');
        }
      }

      // Check for stuck rotation locks
      const isLocked = await this.isRotationLocked();
      if (isLocked) {
        warnings.push(
          'Rotation system is locked - may indicate stuck operation',
        );
      }

      return {
        isHealthy: issues.length === 0,
        issues,
        warnings,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        isHealthy: false,
        issues: [errorMessage || 'Rotation system validation failed'],
        warnings: [],
      };
    }
  }
}

export default ClaudeSkillsCredentialRotationService;
