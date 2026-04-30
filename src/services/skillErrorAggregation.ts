/**
 * Claude Skills Error Aggregation and Alerting
 *
 * Aggregates errors, tracks error rates, and triggers alerts
 * when thresholds are exceeded.
 */

import { SkillError, SkillType } from '../types/claudeSkills';
import { structuredLogger } from '../utils/logger';
import { auditLogger, EventType, EventCategory, Severity } from './auditLogger';
import { claudeSkillsMonitor } from './claudeSkillsMonitor';

export interface ErrorAggregation {
  skillType: SkillType;
  totalErrors: number;
  errorRate: number; // Percentage
  errorsByCode: Map<string, number>;
  recentErrors: SkillError[];
  lastErrorTime: Date | null;
  alertThreshold: number;
  isAlerting: boolean;
}

export interface AlertConfig {
  errorRateThreshold: number; // Percentage
  errorCountThreshold: number;
  timeWindow: number; // Milliseconds
  cooldownPeriod: number; // Milliseconds
}

class SkillErrorAggregationService {
  private aggregations: Map<SkillType, ErrorAggregation> = new Map();
  private alertConfigs: Map<SkillType, AlertConfig> = new Map();
  private lastAlertTime: Map<SkillType, number> = new Map();
  private readonly DEFAULT_ALERT_CONFIG: AlertConfig = {
    errorRateThreshold: 10, // 10% error rate
    errorCountThreshold: 10, // 10 errors
    timeWindow: 60000, // 1 minute
    cooldownPeriod: 300000, // 5 minutes
  };

  constructor() {
    this.initializeDefaultConfigs();
  }

  /**
   * Initialize default alert configurations
   */
  private initializeDefaultConfigs(): void {
    const skillTypes: SkillType[] = [
      'ContentPredictionSkill',
      'QualityAssessmentSkill',
      'ResourceOptimizationSkill',
      'BehaviorAnalysisSkill',
      'ErrorRecoverySkill',
    ];

    skillTypes.forEach(skillType => {
      this.alertConfigs.set(skillType, { ...this.DEFAULT_ALERT_CONFIG });
      this.aggregations.set(skillType, {
        skillType,
        totalErrors: 0,
        errorRate: 0,
        errorsByCode: new Map(),
        recentErrors: [],
        lastErrorTime: null,
        alertThreshold: this.DEFAULT_ALERT_CONFIG.errorRateThreshold,
        isAlerting: false,
      });
    });
  }

  /**
   * Record an error
   */
  recordError(
    skillType: SkillType,
    error: SkillError,
    totalExecutions: number,
  ): void {
    const aggregation = this.aggregations.get(skillType);
    if (!aggregation) {
      return;
    }

    // Update aggregation
    aggregation.totalErrors++;
    aggregation.lastErrorTime = new Date();
    aggregation.errorRate = (aggregation.totalErrors / totalExecutions) * 100;

    // Track errors by code
    const errorCode = error.code;
    const currentCount = aggregation.errorsByCode.get(errorCode) || 0;
    aggregation.errorsByCode.set(errorCode, currentCount + 1);

    // Add to recent errors (keep last 100)
    aggregation.recentErrors.push(error);
    if (aggregation.recentErrors.length > 100) {
      aggregation.recentErrors.shift();
    }

    // Check alert thresholds
    this.checkAlertThresholds(skillType, aggregation);
  }

  /**
   * Check alert thresholds and trigger alerts if needed
   */
  private async checkAlertThresholds(
    skillType: SkillType,
    aggregation: ErrorAggregation,
  ): Promise<void> {
    const config = this.alertConfigs.get(skillType);
    if (!config) {
      return;
    }

    const now = Date.now();
    const lastAlert = this.lastAlertTime.get(skillType) || 0;
    const timeSinceLastAlert = now - lastAlert;

    // Check cooldown period
    if (timeSinceLastAlert < config.cooldownPeriod && aggregation.isAlerting) {
      return; // Still in cooldown
    }

    // Check error rate threshold
    if (aggregation.errorRate >= config.errorRateThreshold) {
      await this.triggerAlert(skillType, aggregation, 'error_rate');
      aggregation.isAlerting = true;
      this.lastAlertTime.set(skillType, now);
      return;
    }

    // Check error count threshold (within time window)
    const recentErrorCount = this.getRecentErrorCount(
      skillType,
      config.timeWindow,
    );
    if (recentErrorCount >= config.errorCountThreshold) {
      await this.triggerAlert(skillType, aggregation, 'error_count');
      aggregation.isAlerting = true;
      this.lastAlertTime.set(skillType, now);
      return;
    }

    // Reset alerting state if below thresholds
    if (aggregation.errorRate < config.errorRateThreshold * 0.5) {
      aggregation.isAlerting = false;
    }
  }

  /**
   * Trigger alert
   */
  private async triggerAlert(
    skillType: SkillType,
    aggregation: ErrorAggregation,
    reason: 'error_rate' | 'error_count',
  ): Promise<void> {
    const severity =
      aggregation.errorRate >= 20 ? Severity.CRITICAL : Severity.HIGH;

    structuredLogger.critical(`Alert triggered for ${skillType}: ${reason}`, {
      skillType,
      metadata: {
        errorRate: aggregation.errorRate,
        totalErrors: aggregation.totalErrors,
        reason,
        errorsByCode: Object.fromEntries(aggregation.errorsByCode),
      },
    });

    await auditLogger.logEvent({
      eventType: EventType.ALERT_TRIGGERED,
      eventCategory: EventCategory.SYSTEM,
      severity,
      description: `Claude Skills Error Alert: ${skillType} - ${reason}`,
      metadata: {
        skillType,
        errorRate: aggregation.errorRate,
        totalErrors: aggregation.totalErrors,
        reason,
        errorsByCode: Object.fromEntries(aggregation.errorsByCode),
        lastErrorTime: aggregation.lastErrorTime?.toISOString(),
      },
    });
  }

  /**
   * Get recent error count within time window
   */
  private getRecentErrorCount(
    skillType: SkillType,
    timeWindow: number,
  ): number {
    const aggregation = this.aggregations.get(skillType);
    if (!aggregation) {
      return 0;
    }

    const cutoffTime = Date.now() - timeWindow;
    return aggregation.recentErrors.filter(
      error =>
        aggregation.lastErrorTime &&
        aggregation.lastErrorTime.getTime() >= cutoffTime,
    ).length;
  }

  /**
   * Get error aggregation for skill type
   */
  getAggregation(skillType: SkillType): ErrorAggregation | undefined {
    return this.aggregations.get(skillType);
  }

  /**
   * Get all aggregations
   */
  getAllAggregations(): ErrorAggregation[] {
    return Array.from(this.aggregations.values());
  }

  /**
   * Update alert configuration
   */
  updateAlertConfig(skillType: SkillType, config: Partial<AlertConfig>): void {
    const currentConfig = this.alertConfigs.get(skillType);
    if (currentConfig) {
      this.alertConfigs.set(skillType, { ...currentConfig, ...config });

      const aggregation = this.aggregations.get(skillType);
      if (aggregation && config.errorRateThreshold) {
        aggregation.alertThreshold = config.errorRateThreshold;
      }
    }
  }

  /**
   * Reset aggregation for skill type
   */
  resetAggregation(skillType: SkillType): void {
    const aggregation = this.aggregations.get(skillType);
    if (aggregation) {
      aggregation.totalErrors = 0;
      aggregation.errorRate = 0;
      aggregation.errorsByCode.clear();
      aggregation.recentErrors = [];
      aggregation.lastErrorTime = null;
      aggregation.isAlerting = false;
    }
  }

  /**
   * Get error rate for skill type
   */
  getErrorRate(skillType: SkillType): number {
    const aggregation = this.aggregations.get(skillType);
    return aggregation?.errorRate || 0;
  }

  /**
   * Check if skill is currently alerting
   */
  isAlerting(skillType: SkillType): boolean {
    const aggregation = this.aggregations.get(skillType);
    return aggregation?.isAlerting || false;
  }
}

// Export singleton instance
export const skillErrorAggregation = new SkillErrorAggregationService();
