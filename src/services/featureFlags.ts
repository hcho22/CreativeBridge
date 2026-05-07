/**
 * Feature Flag Management Service
 *
 * Provides controlled rollout and management of features including
 * the Story Image Generation feature with gradual rollout capabilities.
 */

import { env } from './environment';
import { auditLogger, EventType, EventCategory, Severity } from './auditLogger';

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  rolloutPercentage: number;
  userGroups?: string[];
  conditions?: FeatureFlagCondition[];
  metadata?: Record<string, any>;
}

export interface FeatureFlagCondition {
  type:
    | 'user_id'
    | 'grade_level'
    | 'xp_threshold'
    | 'device_type'
    | 'app_version';
  operator:
    | 'equals'
    | 'not_equals'
    | 'greater_than'
    | 'less_than'
    | 'in'
    | 'not_in';
  value: any;
}

export interface UserContext {
  userId: string;
  gradeLevel?: string;
  totalXp?: number;
  deviceType?: string;
  appVersion?: string;
  betaTester?: boolean;
}

export enum FeatureFlagKey {
  IMAGE_GENERATION = 'image_generation',
  IMAGE_GENERATION_BETA = 'image_generation_beta',
  IMAGE_GENERATION_XP_DISCOUNT = 'image_generation_xp_discount',
  ADVANCED_ART_STYLES = 'advanced_art_styles',
  BATCH_IMAGE_GENERATION = 'batch_image_generation',
}

class FeatureFlagService {
  private flags: Map<string, FeatureFlag> = new Map();
  private userCache: Map<
    string,
    { flags: Record<string, boolean>; timestamp: number }
  > = new Map();
  private readonly cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.initializeDefaultFlags();
  }

  /**
   * Initialize default feature flags
   */
  private initializeDefaultFlags(): void {
    const defaultFlags: FeatureFlag[] = [
      {
        key: FeatureFlagKey.IMAGE_GENERATION,
        enabled: env.IMAGE_GENERATION_ENABLED || false,
        rolloutPercentage: 0, // Start with 0%, enable gradually
        conditions: [
          {
            type: 'xp_threshold',
            operator: 'greater_than',
            value: 1000, // Users must have at least 1000 XP
          },
        ],
        metadata: {
          description: 'Story Image Generation Feature',
          category: 'core_feature',
          owner: 'development_team',
          rolloutPlan: 'gradual',
        },
      },
      {
        key: FeatureFlagKey.IMAGE_GENERATION_BETA,
        enabled: false,
        rolloutPercentage: 100, // 100% for beta testers when enabled
        userGroups: ['beta_testers', 'internal_users'],
        metadata: {
          description: 'Beta testing for Image Generation',
          category: 'beta_feature',
          owner: 'qa_team',
        },
      },
      {
        key: FeatureFlagKey.IMAGE_GENERATION_XP_DISCOUNT,
        enabled: false,
        rolloutPercentage: 25,
        conditions: [
          {
            type: 'grade_level',
            operator: 'in',
            value: ['K-2', '3-5'], // Discount for younger users
          },
        ],
        metadata: {
          description: 'Reduced XP cost for younger students',
          discountPercentage: 50,
        },
      },
      {
        key: FeatureFlagKey.ADVANCED_ART_STYLES,
        enabled: false,
        rolloutPercentage: 10,
        conditions: [
          {
            type: 'grade_level',
            operator: 'in',
            value: ['9-12'], // Advanced styles for high school
          },
          {
            type: 'xp_threshold',
            operator: 'greater_than',
            value: 5000,
          },
        ],
        metadata: {
          description: 'Advanced art styles for high school users',
          category: 'premium_feature',
        },
      },
      {
        key: FeatureFlagKey.BATCH_IMAGE_GENERATION,
        enabled: false,
        rolloutPercentage: 5,
        conditions: [
          {
            type: 'xp_threshold',
            operator: 'greater_than',
            value: 10000, // High XP users can generate multiple images
          },
        ],
        metadata: {
          description: 'Generate multiple images at once',
          category: 'premium_feature',
        },
      },
    ];

    defaultFlags.forEach(flag => {
      this.flags.set(flag.key, flag);
    });

    this.logFeatureFlagInitialization();
  }

  /**
   * Check if a feature is enabled for a specific user
   */
  async isFeatureEnabled(
    flagKey: FeatureFlagKey | string,
    userContext: UserContext,
  ): Promise<boolean> {
    try {
      // Check cache first
      const cached = this.userCache.get(userContext.userId);

      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        if (cached.flags[flagKey] !== undefined) {
          return cached.flags[flagKey];
        }
      }

      const flag = this.flags.get(flagKey);
      if (!flag) {
        console.warn(`⚠️ Feature flag '${flagKey}' not found`);
        return false;
      }

      // Check if flag is globally disabled
      if (!flag.enabled) {
        this.cacheResult(userContext.userId, flagKey, false);
        return false;
      }

      // Check user groups
      if (flag.userGroups && flag.userGroups.length > 0) {
        const userInGroup = flag.userGroups.some(group =>
          this.isUserInGroup(userContext, group),
        );
        if (userInGroup) {
          this.cacheResult(userContext.userId, flagKey, true);
          this.logFeatureFlagAccess(flagKey, userContext, true, 'user_group');
          return true;
        }
      }

      // Check conditions
      if (flag.conditions && flag.conditions.length > 0) {
        const conditionsMet = flag.conditions.every(condition =>
          this.evaluateCondition(condition, userContext),
        );
        if (!conditionsMet) {
          this.cacheResult(userContext.userId, flagKey, false);
          this.logFeatureFlagAccess(
            flagKey,
            userContext,
            false,
            'conditions_not_met',
          );
          return false;
        }
      }

      // Check rollout percentage
      const userHash = this.hashUser(userContext.userId, flagKey);
      const userPercentile = userHash % 100;
      const enabled = userPercentile < flag.rolloutPercentage;

      this.cacheResult(userContext.userId, flagKey, enabled);
      this.logFeatureFlagAccess(
        flagKey,
        userContext,
        enabled,
        'rollout_percentage',
      );

      return enabled;
    } catch (error) {
      console.error(`❌ Error checking feature flag '${flagKey}':`, error);

      auditLogger.logEvent({
        eventType: EventType.FEATURE_FLAG_ERROR,
        eventCategory: EventCategory.SYSTEM,
        severity: Severity.ERROR,
        description: `Feature flag evaluation failed for ${flagKey}`,
        metadata: {
          flagKey,
          userId: userContext.userId,
          error: error instanceof Error ? error.message : String(error),
        },
        context: {
          timestamp: new Date(),
          action: 'feature_flag_check',
          resource: flagKey,
        },
      });

      return false; // Fail closed
    }
  }

  /**
   * Get feature flag configuration (for admin/debug purposes)
   */
  getFeatureFlag(flagKey: FeatureFlagKey | string): FeatureFlag | undefined {
    return this.flags.get(flagKey);
  }

  /**
   * Update feature flag configuration
   */
  async updateFeatureFlag(
    flagKey: string,
    updates: Partial<FeatureFlag>,
  ): Promise<void> {
    const existingFlag = this.flags.get(flagKey);
    if (!existingFlag) {
      throw new Error(`Feature flag '${flagKey}' not found`);
    }

    const updatedFlag: FeatureFlag = {
      ...existingFlag,
      ...updates,
      key: flagKey, // Ensure key doesn't change
    };

    this.flags.set(flagKey, updatedFlag);
    this.clearUserCache(); // Clear cache when flags change

    auditLogger.logEvent({
      eventType: EventType.FEATURE_FLAG_UPDATED,
      eventCategory: EventCategory.SYSTEM,
      severity: Severity.INFO,
      description: `Feature flag ${flagKey} updated`,
      metadata: {
        flagKey,
        previousConfig: existingFlag,
        newConfig: updatedFlag,
        changes: updates,
      },
      context: {
        timestamp: new Date(),
        action: 'feature_flag_update',
        resource: flagKey,
      },
    });
  }

  /**
   * Gradually increase rollout percentage for a feature
   */
  async increaseRollout(
    flagKey: string,
    targetPercentage: number,
    incrementPercentage: number = 10,
  ): Promise<void> {
    const flag = this.flags.get(flagKey);
    if (!flag) {
      throw new Error(`Feature flag '${flagKey}' not found`);
    }

    const newPercentage = Math.min(
      flag.rolloutPercentage + incrementPercentage,
      targetPercentage,
    );

    await this.updateFeatureFlag(flagKey, {
      rolloutPercentage: newPercentage,
    });

    console.log(
      `📈 Increased rollout for '${flagKey}' from ${flag.rolloutPercentage}% to ${newPercentage}%`,
    );
  }

  /**
   * Get rollout statistics for monitoring
   */
  async getRolloutStatistics(flagKey: string): Promise<{
    flagKey: string;
    currentRollout: number;
    enabled: boolean;
    estimatedUsers: number;
    conditions: FeatureFlagCondition[];
  }> {
    const flag = this.flags.get(flagKey);
    if (!flag) {
      throw new Error(`Feature flag '${flagKey}' not found`);
    }

    // Estimate user count (this would need actual user data in production)
    const estimatedUsers = Math.round((flag.rolloutPercentage / 100) * 1000); // Assuming 1000 total users

    return {
      flagKey,
      currentRollout: flag.rolloutPercentage,
      enabled: flag.enabled,
      estimatedUsers,
      conditions: flag.conditions || [],
    };
  }

  /**
   * Evaluate a condition against user context
   */
  private evaluateCondition(
    condition: FeatureFlagCondition,
    userContext: UserContext,
  ): boolean {
    let contextValue: any;

    switch (condition.type) {
      case 'user_id':
        contextValue = userContext.userId;
        break;
      case 'grade_level':
        contextValue = userContext.gradeLevel;
        break;
      case 'xp_threshold':
        contextValue = userContext.totalXp || 0;
        break;
      case 'device_type':
        contextValue = userContext.deviceType;
        break;
      case 'app_version':
        contextValue = userContext.appVersion;
        break;
      default:
        return false;
    }

    switch (condition.operator) {
      case 'equals':
        return contextValue === condition.value;
      case 'not_equals':
        return contextValue !== condition.value;
      case 'greater_than':
        return contextValue > condition.value;
      case 'less_than':
        return contextValue < condition.value;
      case 'in':
        return (
          Array.isArray(condition.value) &&
          condition.value.includes(contextValue)
        );
      case 'not_in':
        return (
          Array.isArray(condition.value) &&
          !condition.value.includes(contextValue)
        );
      default:
        return false;
    }
  }

  /**
   * Check if user is in a specific group
   */
  private isUserInGroup(userContext: UserContext, group: string): boolean {
    switch (group) {
      case 'beta_testers':
        return userContext.betaTester === true;
      case 'internal_users':
        return (
          userContext.userId.includes('internal_') ||
          userContext.userId.includes('admin_')
        );
      case 'high_xp_users':
        return (userContext.totalXp || 0) > 5000;
      default:
        return false;
    }
  }

  /**
   * Generate consistent hash for user and flag combination
   */
  /* eslint-disable no-bitwise -- djb2 hash: bit-shift/mask intrinsic to algorithm. */
  private hashUser(userId: string, flagKey: string): number {
    const combined = `${userId}:${flagKey}`;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
  /* eslint-enable no-bitwise */

  /**
   * Cache result for user
   */
  private cacheResult(userId: string, flagKey: string, result: boolean): void {
    const existing = this.userCache.get(userId) || {
      flags: {},
      timestamp: Date.now(),
    };
    existing.flags[flagKey] = result;
    existing.timestamp = Date.now();
    this.userCache.set(userId, existing);
  }

  /**
   * Clear user cache
   */
  private clearUserCache(): void {
    this.userCache.clear();
  }

  /**
   * Log feature flag access for analytics
   */
  private logFeatureFlagAccess(
    flagKey: string,
    userContext: UserContext,
    enabled: boolean,
    reason: string,
  ): void {
    auditLogger.logEvent({
      eventType: EventType.FEATURE_FLAG_ACCESSED,
      eventCategory: EventCategory.USER_INTERACTION,
      severity: Severity.INFO,
      description: `Feature flag ${flagKey} accessed`,
      metadata: {
        flagKey,
        userId: userContext.userId,
        enabled,
        reason,
        userContext: {
          gradeLevel: userContext.gradeLevel,
          totalXp: userContext.totalXp,
          deviceType: userContext.deviceType,
        },
      },
      context: {
        timestamp: new Date(),
        action: 'feature_flag_access',
        resource: flagKey,
      },
    });
  }

  /**
   * Log feature flag initialization
   */
  private logFeatureFlagInitialization(): void {
    const flagSummary = Array.from(this.flags.entries()).map(([key, flag]) => ({
      key,
      enabled: flag.enabled,
      rolloutPercentage: flag.rolloutPercentage,
    }));

    auditLogger.logEvent({
      eventType: EventType.SYSTEM_INITIALIZED,
      eventCategory: EventCategory.SYSTEM,
      severity: Severity.INFO,
      description: 'Feature flag service initialized',
      metadata: {
        flagCount: this.flags.size,
        flags: flagSummary,
      },
      context: {
        timestamp: new Date(),
        action: 'feature_flag_init',
        resource: 'feature_flag_service',
      },
    });

    if (__DEV__) {
      console.log('🚩 Feature Flags Initialized:');
      flagSummary.forEach(flag => {
        console.log(
          `   ${flag.enabled ? '✅' : '❌'} ${flag.key}: ${
            flag.rolloutPercentage
          }%`,
        );
      });
    }
  }
}

// Export singleton instance
export const featureFlagService = new FeatureFlagService();

// Convenience functions
export const isImageGenerationEnabled = (
  userContext: UserContext,
): Promise<boolean> =>
  featureFlagService.isFeatureEnabled(
    FeatureFlagKey.IMAGE_GENERATION,
    userContext,
  );

export const isImageGenerationBetaEnabled = (
  userContext: UserContext,
): Promise<boolean> =>
  featureFlagService.isFeatureEnabled(
    FeatureFlagKey.IMAGE_GENERATION_BETA,
    userContext,
  );

export const hasXpDiscount = (userContext: UserContext): Promise<boolean> =>
  featureFlagService.isFeatureEnabled(
    FeatureFlagKey.IMAGE_GENERATION_XP_DISCOUNT,
    userContext,
  );

// React hook factory for feature flags (import React separately when using)
export const createFeatureFlagHook = () => {
  // Note: This should be used in components with proper React imports
  // Example usage:
  // const useFeatureFlag = createFeatureFlagHook();
  // const { enabled, loading } = useFeatureFlag('image_generation', userContext);
  return {
    isAvailable: true,
    instructions:
      'Import React, useState, and useEffect in your component and implement the hook',
  };
};

export default featureFlagService;
