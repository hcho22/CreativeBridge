/**
 * Gradual Rollout Automation Service
 * Manages the automated gradual rollout of the Story Image Generation feature
 * with safety checks and rollback capabilities
 */

import { featureFlagService } from './featureFlags';
import { monitoringService } from './monitoringService';
import { auditLogger, EventType, EventCategory, Severity } from './auditLogger';

export interface RolloutPlan {
  featureName: string;
  targetPercentage: number;
  incrementPercentage: number;
  intervalHours: number;
  safetyChecks: SafetyCheck[];
  autoRollback: boolean;
  maxRollbackAttempts: number;
}

export interface SafetyCheck {
  metric: string;
  threshold: number;
  operator: 'greater_than' | 'less_than';
  required: boolean; // If true, failure blocks rollout
}

export interface RolloutStatus {
  currentPercentage: number;
  targetPercentage: number;
  status: 'planning' | 'active' | 'paused' | 'completed' | 'rolled_back';
  nextRolloutTime?: Date;
  lastCheck: Date;
  safetyChecksPassed: boolean;
  issuesDetected: string[];
}

export interface RolloutDecision {
  action: 'proceed' | 'pause' | 'rollback';
  reason: string;
  newPercentage?: number;
  waitTimeHours?: number;
}

class RolloutAutomationService {
  private rolloutPlans: Map<string, RolloutPlan> = new Map();
  private rolloutStatus: Map<string, RolloutStatus> = new Map();
  private rolloutTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.initializeDefaultPlans();
  }

  /**
   * Initialize default rollout plans
   */
  private initializeDefaultPlans(): void {
    const imageGenerationPlan: RolloutPlan = {
      featureName: 'image_generation',
      targetPercentage: 100,
      incrementPercentage: 25,
      intervalHours: 48, // 48 hours between increments
      safetyChecks: [
        {
          metric: 'success_rate',
          threshold: 85,
          operator: 'greater_than',
          required: true,
        },
        {
          metric: 'error_rate',
          threshold: 15,
          operator: 'less_than',
          required: true,
        },
        {
          metric: 'average_response_time',
          threshold: 60000, // 60 seconds
          operator: 'less_than',
          required: false,
        },
        {
          metric: 'average_rating',
          threshold: 3.5,
          operator: 'greater_than',
          required: false,
        },
      ],
      autoRollback: true,
      maxRollbackAttempts: 2,
    };

    this.rolloutPlans.set('image_generation', imageGenerationPlan);
  }

  /**
   * Start automated rollout for a feature
   */
  async startRollout(
    featureName: string,
    customPlan?: Partial<RolloutPlan>,
  ): Promise<{
    success: boolean;
    message: string;
    status?: RolloutStatus;
  }> {
    try {
      // Get or create rollout plan
      const basePlan = this.rolloutPlans.get(featureName);
      if (!basePlan) {
        return {
          success: false,
          message: `No rollout plan found for feature: ${featureName}`,
        };
      }

      const plan: RolloutPlan = { ...basePlan, ...customPlan };
      this.rolloutPlans.set(featureName, plan);

      // Get current rollout percentage
      const currentFlag = featureFlagService.getFeatureFlag(featureName);
      const currentPercentage = currentFlag?.rolloutPercentage || 0;

      // Initialize rollout status
      const status: RolloutStatus = {
        currentPercentage,
        targetPercentage: plan.targetPercentage,
        status: 'planning',
        lastCheck: new Date(),
        safetyChecksPassed: false,
        issuesDetected: [],
      };

      this.rolloutStatus.set(featureName, status);

      // Perform initial safety check
      const initialDecision = await this.evaluateRolloutDecision(featureName);

      if (initialDecision.action === 'rollback') {
        status.status = 'rolled_back';
        status.issuesDetected.push(initialDecision.reason);
        return {
          success: false,
          message: `Rollout cannot start due to safety concerns: ${initialDecision.reason}`,
          status,
        };
      }

      // Schedule first rollout increment
      await this.scheduleNextRollout(featureName);

      status.status = 'active';
      this.rolloutStatus.set(featureName, status);

      // Log rollout start
      auditLogger.logEvent({
        eventType: EventType.ROLLOUT_STARTED,
        eventCategory: EventCategory.SYSTEM,
        severity: Severity.INFO,
        description: `Automated rollout started for ${featureName}`,
        metadata: {
          featureName,
          plan,
          currentPercentage,
          targetPercentage: plan.targetPercentage,
        },
        context: {
          timestamp: new Date(),
          action: 'rollout_start',
          resource: featureName,
        },
      });

      return {
        success: true,
        message: `Rollout started for ${featureName}. Current: ${currentPercentage}%, Target: ${plan.targetPercentage}%`,
        status,
      };
    } catch (error: any) {
      console.error('Failed to start rollout:', error);
      return {
        success: false,
        message: `Failed to start rollout: ${error.message}`,
      };
    }
  }

  /**
   * Pause rollout for a feature
   */
  async pauseRollout(
    featureName: string,
    reason: string,
  ): Promise<{ success: boolean; message: string }> {
    const status = this.rolloutStatus.get(featureName);
    if (!status) {
      return {
        success: false,
        message: `No active rollout found for ${featureName}`,
      };
    }

    // Clear any scheduled rollouts
    const timer = this.rolloutTimers.get(featureName);
    if (timer) {
      clearTimeout(timer);
      this.rolloutTimers.delete(featureName);
    }

    status.status = 'paused';
    status.issuesDetected.push(reason);
    status.lastCheck = new Date();

    auditLogger.logEvent({
      eventType: EventType.ROLLOUT_PAUSED,
      eventCategory: EventCategory.SYSTEM,
      severity: Severity.WARNING,
      description: `Rollout paused for ${featureName}: ${reason}`,
      metadata: {
        featureName,
        reason,
        currentPercentage: status.currentPercentage,
      },
      context: {
        timestamp: new Date(),
        action: 'rollout_pause',
        resource: featureName,
      },
    });

    return { success: true, message: `Rollout paused for ${featureName}` };
  }

  /**
   * Resume paused rollout
   */
  async resumeRollout(
    featureName: string,
  ): Promise<{ success: boolean; message: string }> {
    const status = this.rolloutStatus.get(featureName);
    if (!status || status.status !== 'paused') {
      return {
        success: false,
        message: `No paused rollout found for ${featureName}`,
      };
    }

    // Perform safety check before resuming
    const decision = await this.evaluateRolloutDecision(featureName);

    if (decision.action === 'rollback') {
      return { success: false, message: `Cannot resume: ${decision.reason}` };
    }

    status.status = 'active';
    status.issuesDetected = [];
    await this.scheduleNextRollout(featureName);

    auditLogger.logEvent({
      eventType: EventType.ROLLOUT_RESUMED,
      eventCategory: EventCategory.SYSTEM,
      severity: Severity.INFO,
      description: `Rollout resumed for ${featureName}`,
      metadata: { featureName, currentPercentage: status.currentPercentage },
      context: {
        timestamp: new Date(),
        action: 'rollout_resume',
        resource: featureName,
      },
    });

    return { success: true, message: `Rollout resumed for ${featureName}` };
  }

  /**
   * Perform rollback to previous percentage
   */
  async performRollback(
    featureName: string,
    targetPercentage: number,
    reason: string,
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const status = this.rolloutStatus.get(featureName);
      if (!status) {
        return {
          success: false,
          message: `No rollout status found for ${featureName}`,
        };
      }

      const previousPercentage = status.currentPercentage;

      // Update feature flag
      await featureFlagService.updateFeatureFlag(featureName, {
        rolloutPercentage: targetPercentage,
      });

      // Clear any scheduled rollouts
      const timer = this.rolloutTimers.get(featureName);
      if (timer) {
        clearTimeout(timer);
        this.rolloutTimers.delete(featureName);
      }

      // Update status
      status.currentPercentage = targetPercentage;
      status.status = 'rolled_back';
      status.issuesDetected.push(reason);
      status.lastCheck = new Date();

      // Log rollback
      auditLogger.logEvent({
        eventType: EventType.ROLLOUT_ROLLED_BACK,
        eventCategory: EventCategory.SYSTEM,
        severity: Severity.ERROR,
        description: `Rollout rolled back for ${featureName}: ${reason}`,
        metadata: {
          featureName,
          reason,
          previousPercentage,
          newPercentage: targetPercentage,
        },
        context: {
          timestamp: new Date(),
          action: 'rollout_rollback',
          resource: featureName,
        },
      });

      return {
        success: true,
        message: `Rollout rolled back from ${previousPercentage}% to ${targetPercentage}%: ${reason}`,
      };
    } catch (error: any) {
      console.error('Failed to perform rollback:', error);
      return {
        success: false,
        message: `Failed to perform rollback: ${error.message}`,
      };
    }
  }

  /**
   * Schedule next rollout increment
   */
  private async scheduleNextRollout(featureName: string): Promise<void> {
    const plan = this.rolloutPlans.get(featureName);
    const status = this.rolloutStatus.get(featureName);

    if (!plan || !status) return;

    // Check if we've reached target
    if (status.currentPercentage >= status.targetPercentage) {
      status.status = 'completed';
      auditLogger.logEvent({
        eventType: EventType.ROLLOUT_COMPLETED,
        eventCategory: EventCategory.SYSTEM,
        severity: Severity.INFO,
        description: `Rollout completed for ${featureName}`,
        metadata: { featureName, finalPercentage: status.currentPercentage },
        context: {
          timestamp: new Date(),
          action: 'rollout_complete',
          resource: featureName,
        },
      });
      return;
    }

    const nextRolloutTime = new Date();
    nextRolloutTime.setHours(nextRolloutTime.getHours() + plan.intervalHours);
    status.nextRolloutTime = nextRolloutTime;

    const timer = setTimeout(async () => {
      await this.executeRolloutIncrement(featureName);
    }, plan.intervalHours * 60 * 60 * 1000);

    this.rolloutTimers.set(featureName, timer);

    console.log(
      `📅 Next rollout for ${featureName} scheduled for ${nextRolloutTime.toLocaleString()}`,
    );
  }

  /**
   * Execute a rollout increment
   */
  private async executeRolloutIncrement(featureName: string): Promise<void> {
    try {
      const decision = await this.evaluateRolloutDecision(featureName);

      switch (decision.action) {
        case 'proceed':
          await this.incrementRollout(featureName, decision.newPercentage!);
          break;

        case 'pause':
          await this.pauseRollout(featureName, decision.reason);
          break;

        case 'rollback':
          const status = this.rolloutStatus.get(featureName);
          const rollbackTarget = Math.max(
            0,
            (status?.currentPercentage || 0) - 25,
          );
          await this.performRollback(
            featureName,
            rollbackTarget,
            decision.reason,
          );
          break;
      }
    } catch (error: any) {
      console.error('Failed to execute rollout increment:', error);
      await this.pauseRollout(featureName, `Execution error: ${error.message}`);
    }
  }

  /**
   * Increment rollout percentage
   */
  private async incrementRollout(
    featureName: string,
    newPercentage: number,
  ): Promise<void> {
    const status = this.rolloutStatus.get(featureName);
    if (!status) return;

    const previousPercentage = status.currentPercentage;

    // Update feature flag
    await featureFlagService.updateFeatureFlag(featureName, {
      rolloutPercentage: newPercentage,
    });

    // Update status
    status.currentPercentage = newPercentage;
    status.lastCheck = new Date();

    // Log increment
    auditLogger.logEvent({
      eventType: EventType.ROLLOUT_INCREMENTED,
      eventCategory: EventCategory.SYSTEM,
      severity: Severity.INFO,
      description: `Rollout incremented for ${featureName}`,
      metadata: {
        featureName,
        previousPercentage,
        newPercentage,
      },
      context: {
        timestamp: new Date(),
        action: 'rollout_increment',
        resource: featureName,
      },
    });

    console.log(
      `📈 Rollout for ${featureName} increased from ${previousPercentage}% to ${newPercentage}%`,
    );

    // Schedule next increment if not at target
    await this.scheduleNextRollout(featureName);
  }

  /**
   * Evaluate whether to proceed with rollout based on safety checks
   */
  private async evaluateRolloutDecision(
    featureName: string,
  ): Promise<RolloutDecision> {
    try {
      const plan = this.rolloutPlans.get(featureName);
      const status = this.rolloutStatus.get(featureName);

      if (!plan || !status) {
        return { action: 'pause', reason: 'Invalid rollout configuration' };
      }

      // Get current metrics
      const health = await monitoringService.checkSystemHealth();
      const metrics = health.metrics;

      // Check if system is in critical state
      if (health.status === 'critical') {
        return { action: 'rollback', reason: 'System is in critical state' };
      }

      // Evaluate safety checks
      const failedChecks: string[] = [];
      const requiredChecksFailed: string[] = [];

      for (const check of plan.safetyChecks) {
        let metricValue: number;

        switch (check.metric) {
          case 'success_rate':
            metricValue = metrics.successRate;
            break;
          case 'error_rate':
            metricValue = metrics.errorRate;
            break;
          case 'average_response_time':
            metricValue = metrics.averageResponseTime;
            break;
          case 'average_rating':
            metricValue = metrics.averageRating || 5.0;
            break;
          default:
            continue;
        }

        const checkPassed =
          check.operator === 'greater_than'
            ? metricValue > check.threshold
            : metricValue < check.threshold;

        if (!checkPassed) {
          const failureMsg = `${check.metric}: ${metricValue.toFixed(
            2,
          )} ${check.operator.replace('_', ' ')} ${check.threshold}`;
          failedChecks.push(failureMsg);

          if (check.required) {
            requiredChecksFailed.push(failureMsg);
          }
        }
      }

      // Decision logic
      if (requiredChecksFailed.length > 0) {
        return {
          action: 'rollback',
          reason: `Required safety checks failed: ${requiredChecksFailed.join(
            ', ',
          )}`,
        };
      }

      if (failedChecks.length > 2) {
        return {
          action: 'pause',
          reason: `Multiple safety checks failed: ${failedChecks.join(', ')}`,
          waitTimeHours: 24,
        };
      }

      if (health.status === 'degraded') {
        return {
          action: 'pause',
          reason: 'System is in degraded state',
          waitTimeHours: 12,
        };
      }

      // Calculate next percentage
      const nextPercentage = Math.min(
        status.currentPercentage + plan.incrementPercentage,
        status.targetPercentage,
      );

      return {
        action: 'proceed',
        reason: 'All safety checks passed',
        newPercentage: nextPercentage,
      };
    } catch (error: any) {
      return {
        action: 'pause',
        reason: `Safety check evaluation failed: ${error.message}`,
        waitTimeHours: 6,
      };
    }
  }

  /**
   * Get current rollout status for a feature
   */
  getRolloutStatus(featureName: string): RolloutStatus | null {
    return this.rolloutStatus.get(featureName) || null;
  }

  /**
   * Get all active rollouts
   */
  getAllRolloutStatuses(): Map<string, RolloutStatus> {
    return new Map(this.rolloutStatus);
  }

  /**
   * Update rollout plan
   */
  updateRolloutPlan(featureName: string, updates: Partial<RolloutPlan>): void {
    const existingPlan = this.rolloutPlans.get(featureName);
    if (existingPlan) {
      this.rolloutPlans.set(featureName, { ...existingPlan, ...updates });
    }
  }

  /**
   * Generate rollout report
   */
  async generateRolloutReport(featureName: string): Promise<{
    status: RolloutStatus | null;
    metrics: any;
    recommendations: string[];
    nextActions: string[];
  }> {
    const status = this.getRolloutStatus(featureName);
    const health = await monitoringService.checkSystemHealth();
    await monitoringService.getRolloutAnalytics();

    const recommendations: string[] = [];
    const nextActions: string[] = [];

    if (!status) {
      return {
        status: null,
        metrics: health.metrics,
        recommendations: [
          'No rollout found. Consider starting a rollout plan.',
        ],
        nextActions: [
          'Initialize rollout plan',
          'Set up monitoring thresholds',
        ],
      };
    }

    // Generate recommendations based on status
    switch (status.status) {
      case 'active':
        recommendations.push('✅ Rollout is proceeding normally');
        if (status.nextRolloutTime) {
          nextActions.push(
            `Next increment scheduled for ${status.nextRolloutTime.toLocaleString()}`,
          );
        }
        break;

      case 'paused':
        recommendations.push('⚠️ Rollout is paused - investigate issues');
        nextActions.push('Review and resolve issues before resuming');
        break;

      case 'rolled_back':
        recommendations.push(
          '🚨 Rollout was rolled back - critical issues detected',
        );
        nextActions.push(
          'Investigate root cause before attempting new rollout',
        );
        break;

      case 'completed':
        recommendations.push('🎉 Rollout completed successfully');
        nextActions.push('Monitor for ongoing stability');
        break;
    }

    return {
      status,
      metrics: health.metrics,
      recommendations,
      nextActions,
    };
  }
}

// Export singleton instance
export const rolloutAutomationService = new RolloutAutomationService();

export default rolloutAutomationService;
