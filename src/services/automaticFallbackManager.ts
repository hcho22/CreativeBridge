/**
 * Automatic Fallback Manager
 *
 * Coordinates automatic fallback triggers based on service health and handles
 * graceful degradation across the entire system
 * Task 6.3: Service Degradation Handling - Automatic fallback triggers
 */

import { structuredLogger } from '../utils/logger';
import {
  ServiceHealthMonitor,
  ServiceDegradationEvent,
  ServiceHealthStatus,
} from './serviceHealth';
import { ProgressiveEnhancementService } from './progressiveEnhancement';
import { NetworkAdapterService } from './networkAdapter';
import {
  SkillManager,
  SkillError,
  SkillErrorCode,
} from '../types/claudeSkills';
// import { StoryRequest, StoryResponse } from '../types/story';

export interface FallbackStrategy {
  strategyId: string;
  name: string;
  description: string;
  trigger: FallbackTrigger;
  actions: FallbackAction[];
  priority: number; // 1 = highest priority
  canRevert: boolean;
  estimatedImpact: ServiceImpact;
}

export interface FallbackTrigger {
  servicePattern: string; // service name or pattern (e.g., '*', 'claude_skills_*')
  healthThreshold: 'degraded' | 'unavailable';
  errorRateThreshold?: number;
  responseTimeThreshold?: number;
  consecutiveFailuresThreshold?: number;
  customCondition?: (status: ServiceHealthStatus) => boolean;
}

export interface FallbackAction {
  actionType:
    | 'disable_service'
    | 'enable_fallback'
    | 'switch_mode'
    | 'reduce_quality'
    | 'cache_only'
    | 'offline_mode'
    | 'user_notification';
  target: string; // service name, feature, or component
  parameters: Record<string, any>;
  rollbackAction?: FallbackAction;
}

export interface ServiceImpact {
  functionalityLoss: number; // 0-1, amount of functionality lost
  performanceImpact: number; // 0-1, performance impact (negative = improvement)
  userExperienceImpact: number; // 0-1, impact on user experience
  dataAvailability: number; // 0-1, impact on data availability
}

export interface FallbackState {
  strategyId: string;
  activatedAt: Date;
  trigger: ServiceDegradationEvent;
  actionsExecuted: FallbackAction[];
  currentImpact: ServiceImpact;
  canRevert: boolean;
  revertConditions: string[];
}

export interface SystemDegradationStatus {
  overall: 'normal' | 'degraded' | 'critical' | 'emergency';
  activeFallbacks: FallbackState[];
  availableFeatures: string[];
  disabledFeatures: string[];
  estimatedRecoveryTime?: number;
  userMessage?: string;
}

export class AutomaticFallbackManager {
  private healthMonitor: ServiceHealthMonitor;
  private progressiveEnhancement: ProgressiveEnhancementService;
  private networkAdapter: NetworkAdapterService;
  private skillManager: SkillManager;

  private fallbackStrategies: Map<string, FallbackStrategy> = new Map();
  private activeFallbacks: Map<string, FallbackState> = new Map();
  private systemDegradation: SystemDegradationStatus;
  private fallbackHistory: FallbackState[] = [];

  private isActive: boolean = false;
  private recoveryCheckInterval: NodeJS.Timeout | null = null;

  constructor(
    healthMonitor: ServiceHealthMonitor,
    progressiveEnhancement: ProgressiveEnhancementService,
    networkAdapter: NetworkAdapterService,
    skillManager: SkillManager,
  ) {
    this.healthMonitor = healthMonitor;
    this.progressiveEnhancement = progressiveEnhancement;
    this.networkAdapter = networkAdapter;
    this.skillManager = skillManager;

    this.systemDegradation = {
      overall: 'normal',
      activeFallbacks: [],
      availableFeatures: [],
      disabledFeatures: [],
    };

    this.initializeFallbackStrategies();
    this.setupHealthMonitoringIntegration();
  }

  /**
   * Activate automatic fallback management
   */
  public activate(): void {
    if (this.isActive) {
      structuredLogger.warn('Automatic fallback manager already active');
      return;
    }

    this.isActive = true;

    // Start recovery monitoring
    this.startRecoveryMonitoring();

    structuredLogger.info('Automatic fallback manager activated', {
      strategiesCount: this.fallbackStrategies.size,
      monitoringServices: this.getMonitoredServices(),
    });
  }

  /**
   * Deactivate automatic fallback management
   */
  public deactivate(): void {
    if (!this.isActive) return;

    this.isActive = false;

    if (this.recoveryCheckInterval) {
      clearInterval(this.recoveryCheckInterval);
      this.recoveryCheckInterval = null;
    }

    structuredLogger.info('Automatic fallback manager deactivated');
  }

  /**
   * Get current system degradation status
   */
  public getSystemStatus(): SystemDegradationStatus {
    return {
      ...this.systemDegradation,
      activeFallbacks: [...this.systemDegradation.activeFallbacks],
    };
  }

  /**
   * Check if a specific feature is available
   */
  public isFeatureAvailable(featureName: string): boolean {
    return !this.systemDegradation.disabledFeatures.includes(featureName);
  }

  /**
   * Get recommended user message for current degradation state
   */
  public getUserMessage(): string | null {
    if (this.systemDegradation.overall === 'normal') {
      return null;
    }

    return (
      this.systemDegradation.userMessage || this.generateDefaultUserMessage()
    );
  }

  /**
   * Manually trigger fallback for a service (for testing or emergency)
   */
  public async manuallyTriggerFallback(
    serviceName: string,
    reason: string = 'Manual intervention',
  ): Promise<boolean> {
    try {
      const mockEvent: ServiceDegradationEvent = {
        service: serviceName,
        previousStatus: 'healthy',
        newStatus: 'unavailable',
        timestamp: new Date(),
        reason,
        triggeringMetrics: {},
        recommendedActions: ['Activate fallback mechanisms'],
      };

      await this.handleServiceDegradation(mockEvent);
      return true;
    } catch (error) {
      structuredLogger.error(
        'Manual fallback trigger failed',
        { serviceName, reason },
        error as Error,
      );
      return false;
    }
  }

  /**
   * Attempt to revert a specific fallback
   */
  public async revertFallback(strategyId: string): Promise<boolean> {
    const fallbackState = this.activeFallbacks.get(strategyId);
    if (!fallbackState) {
      structuredLogger.warn('Cannot revert fallback - not found', {
        strategyId,
      });
      return false;
    }

    if (!fallbackState.canRevert) {
      structuredLogger.warn('Cannot revert fallback - not reversible', {
        strategyId,
      });
      return false;
    }

    try {
      await this.executeFallbackReversion(fallbackState);
      return true;
    } catch (error) {
      structuredLogger.error(
        'Fallback reversion failed',
        { strategyId },
        error as Error,
      );
      return false;
    }
  }

  // Private methods

  private initializeFallbackStrategies(): void {
    // Strategy 1: Claude Skills API unavailable
    this.fallbackStrategies.set('claude_skills_unavailable', {
      strategyId: 'claude_skills_unavailable',
      name: 'Claude Skills API Unavailable',
      description: 'Handle complete Claude Skills API unavailability',
      trigger: {
        servicePattern: 'claude_skills_api',
        healthThreshold: 'unavailable',
      },
      actions: [
        {
          actionType: 'disable_service',
          target: 'claude_skills_api',
          parameters: {},
          rollbackAction: {
            actionType: 'enable_fallback',
            target: 'claude_skills_api',
            parameters: {},
          },
        },
        {
          actionType: 'enable_fallback',
          target: 'story_generation',
          parameters: {
            mode: 'template_based',
            qualityLevel: 'basic',
          },
        },
        {
          actionType: 'cache_only',
          target: 'content_cache',
          parameters: {
            aggressiveCaching: true,
          },
        },
        {
          actionType: 'user_notification',
          target: 'system_status',
          parameters: {
            message: 'Using offline mode for story creation',
            type: 'info',
          },
        },
      ],
      priority: 1,
      canRevert: true,
      estimatedImpact: {
        functionalityLoss: 0.6,
        performanceImpact: 0.2, // Actually faster due to no network calls
        userExperienceImpact: 0.4,
        dataAvailability: 0.3,
      },
    });

    // Strategy 2: Story generation degraded
    this.fallbackStrategies.set('story_generation_degraded', {
      strategyId: 'story_generation_degraded',
      name: 'Story Generation Degraded',
      description: 'Handle degraded story generation performance',
      trigger: {
        servicePattern: 'story_generation',
        healthThreshold: 'degraded',
        responseTimeThreshold: 3000,
      },
      actions: [
        {
          actionType: 'switch_mode',
          target: 'story_generation',
          parameters: {
            mode: 'progressive_enhancement',
            retryStrategy: 'conservative',
            fallbackChain: 'story_generation',
          },
        },
        {
          actionType: 'reduce_quality',
          target: 'content_quality',
          parameters: {
            qualityLevel: 'standard',
            timeoutReduction: 0.5,
          },
        },
      ],
      priority: 2,
      canRevert: true,
      estimatedImpact: {
        functionalityLoss: 0.2,
        performanceImpact: -0.1, // Performance improvement
        userExperienceImpact: 0.15,
        dataAvailability: 0.1,
      },
    });

    // Strategy 3: Network connectivity issues
    this.fallbackStrategies.set('network_degraded', {
      strategyId: 'network_degraded',
      name: 'Network Connectivity Degraded',
      description: 'Handle poor network conditions',
      trigger: {
        servicePattern: '*',
        healthThreshold: 'degraded',
        customCondition: status => {
          // Check if degradation is network-related
          return status.issues.some(
            issue =>
              issue.includes('timeout') ||
              issue.includes('network') ||
              issue.includes('connectivity'),
          );
        },
      },
      actions: [
        {
          actionType: 'switch_mode',
          target: 'network_adapter',
          parameters: {
            adaptationLevel: 'aggressive',
            enableOfflineMode: true,
          },
        },
        {
          actionType: 'cache_only',
          target: 'content_cache',
          parameters: {
            preferCache: true,
            maxCacheAge: 3600000, // 1 hour
          },
        },
        {
          actionType: 'reduce_quality',
          target: 'all_services',
          parameters: {
            compression: true,
            simplifiedRequests: true,
          },
        },
      ],
      priority: 3,
      canRevert: true,
      estimatedImpact: {
        functionalityLoss: 0.3,
        performanceImpact: -0.2,
        userExperienceImpact: 0.2,
        dataAvailability: 0.4,
      },
    });

    // Strategy 4: Multiple services unavailable (emergency)
    this.fallbackStrategies.set('multiple_services_emergency', {
      strategyId: 'multiple_services_emergency',
      name: 'Multiple Services Emergency',
      description:
        'Emergency fallback when multiple critical services are unavailable',
      trigger: {
        servicePattern: '*',
        healthThreshold: 'unavailable',
        customCondition: status => {
          const systemHealth = this.healthMonitor.getSystemHealth();
          return systemHealth.unavailableServices.length >= 2;
        },
      },
      actions: [
        {
          actionType: 'offline_mode',
          target: 'entire_system',
          parameters: {
            emergencyMode: true,
          },
        },
        {
          actionType: 'cache_only',
          target: 'all_content',
          parameters: {
            readOnly: true,
          },
        },
        {
          actionType: 'user_notification',
          target: 'system_status',
          parameters: {
            message:
              'System is in emergency offline mode. Core features available with limited functionality.',
            type: 'warning',
            persistent: true,
          },
        },
      ],
      priority: 1, // Highest priority for emergency
      canRevert: true,
      estimatedImpact: {
        functionalityLoss: 0.8,
        performanceImpact: 0.1,
        userExperienceImpact: 0.7,
        dataAvailability: 0.9,
      },
    });

    structuredLogger.info('Fallback strategies initialized', {
      strategiesCount: this.fallbackStrategies.size,
      strategies: Array.from(this.fallbackStrategies.keys()),
    });
  }

  private setupHealthMonitoringIntegration(): void {
    this.healthMonitor.addDegradationListener(
      async (event: ServiceDegradationEvent) => {
        if (this.isActive) {
          await this.handleServiceDegradation(event);
        }
      },
    );
  }

  private async handleServiceDegradation(
    event: ServiceDegradationEvent,
  ): Promise<void> {
    try {
      structuredLogger.info('Handling service degradation', {
        service: event.service,
        previousStatus: event.previousStatus,
        newStatus: event.newStatus,
        reason: event.reason,
      });

      // Find applicable fallback strategies
      const applicableStrategies = this.findApplicableStrategies(event);

      if (applicableStrategies.length === 0) {
        structuredLogger.debug('No applicable fallback strategies found', {
          service: event.service,
          status: event.newStatus,
        });
        return;
      }

      // Execute strategies in priority order
      for (const strategy of applicableStrategies) {
        await this.executeFallbackStrategy(strategy, event);
      }

      // Update system status
      this.updateSystemDegradationStatus();
    } catch (error) {
      structuredLogger.error(
        'Service degradation handling failed',
        {
          service: event.service,
          status: event.newStatus,
        },
        error as Error,
      );
    }
  }

  private findApplicableStrategies(
    event: ServiceDegradationEvent,
  ): FallbackStrategy[] {
    const applicable: FallbackStrategy[] = [];

    for (const strategy of this.fallbackStrategies.values()) {
      if (this.activeFallbacks.has(strategy.strategyId)) {
        continue; // Skip already active strategies
      }

      if (this.isStrategyApplicable(strategy, event)) {
        applicable.push(strategy);
      }
    }

    // Sort by priority (lower number = higher priority)
    return applicable.sort((a, b) => a.priority - b.priority);
  }

  private isStrategyApplicable(
    strategy: FallbackStrategy,
    event: ServiceDegradationEvent,
  ): boolean {
    const trigger = strategy.trigger;

    // Check service pattern match
    if (!this.matchesServicePattern(trigger.servicePattern, event.service)) {
      return false;
    }

    // Check health threshold
    if (!this.meetsHealthThreshold(trigger.healthThreshold, event.newStatus)) {
      return false;
    }

    // Check specific thresholds
    if (
      trigger.errorRateThreshold &&
      (!event.triggeringMetrics.errorRate ||
        event.triggeringMetrics.errorRate < trigger.errorRateThreshold)
    ) {
      return false;
    }

    if (
      trigger.responseTimeThreshold &&
      (!event.triggeringMetrics.averageResponseTime ||
        event.triggeringMetrics.averageResponseTime <
          trigger.responseTimeThreshold)
    ) {
      return false;
    }

    if (
      trigger.consecutiveFailuresThreshold &&
      (!event.triggeringMetrics.consecutiveFailures ||
        event.triggeringMetrics.consecutiveFailures <
          trigger.consecutiveFailuresThreshold)
    ) {
      return false;
    }

    // Check custom condition
    if (trigger.customCondition) {
      const serviceStatus = this.healthMonitor.getServiceHealth(event.service);
      if (!serviceStatus || !trigger.customCondition(serviceStatus)) {
        return false;
      }
    }

    return true;
  }

  private matchesServicePattern(pattern: string, serviceName: string): boolean {
    if (pattern === '*') return true;
    if (pattern === serviceName) return true;

    // Simple wildcard matching
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      return serviceName.startsWith(prefix);
    }

    if (pattern.startsWith('*')) {
      const suffix = pattern.slice(1);
      return serviceName.endsWith(suffix);
    }

    return false;
  }

  private meetsHealthThreshold(
    threshold: 'degraded' | 'unavailable',
    status: ServiceHealthStatus['status'],
  ): boolean {
    switch (threshold) {
      case 'degraded':
        return status === 'degraded' || status === 'unavailable';
      case 'unavailable':
        return status === 'unavailable';
      default:
        return false;
    }
  }

  private async executeFallbackStrategy(
    strategy: FallbackStrategy,
    event: ServiceDegradationEvent,
  ): Promise<void> {
    try {
      structuredLogger.info('Executing fallback strategy', {
        strategyId: strategy.strategyId,
        service: event.service,
        actionsCount: strategy.actions.length,
      });

      const fallbackState: FallbackState = {
        strategyId: strategy.strategyId,
        activatedAt: new Date(),
        trigger: event,
        actionsExecuted: [],
        currentImpact: strategy.estimatedImpact,
        canRevert: strategy.canRevert,
        revertConditions: [],
      };

      // Execute each action in the strategy
      for (const action of strategy.actions) {
        try {
          await this.executeFallbackAction(action);
          fallbackState.actionsExecuted.push(action);

          structuredLogger.debug('Fallback action executed', {
            strategyId: strategy.strategyId,
            actionType: action.actionType,
            target: action.target,
          });
        } catch (actionError) {
          structuredLogger.error(
            'Fallback action failed',
            {
              strategyId: strategy.strategyId,
              actionType: action.actionType,
              target: action.target,
            },
            actionError as Error,
          );

          // Continue with other actions even if one fails
        }
      }

      // Record the active fallback
      this.activeFallbacks.set(strategy.strategyId, fallbackState);
      this.fallbackHistory.push({ ...fallbackState });

      structuredLogger.info('Fallback strategy executed', {
        strategyId: strategy.strategyId,
        actionsExecuted: fallbackState.actionsExecuted.length,
        estimatedImpact: strategy.estimatedImpact,
      });
    } catch (error) {
      structuredLogger.error(
        'Fallback strategy execution failed',
        {
          strategyId: strategy.strategyId,
          service: event.service,
        },
        error as Error,
      );
    }
  }

  private async executeFallbackAction(action: FallbackAction): Promise<void> {
    switch (action.actionType) {
      case 'disable_service':
        await this.disableService(action.target, action.parameters);
        break;
      case 'enable_fallback':
        await this.enableFallback(action.target, action.parameters);
        break;
      case 'switch_mode':
        await this.switchMode(action.target, action.parameters);
        break;
      case 'reduce_quality':
        await this.reduceQuality(action.target, action.parameters);
        break;
      case 'cache_only':
        await this.enableCacheOnly(action.target, action.parameters);
        break;
      case 'offline_mode':
        await this.enableOfflineMode(action.target, action.parameters);
        break;
      case 'user_notification':
        await this.sendUserNotification(action.target, action.parameters);
        break;
      default:
        throw new Error(`Unknown fallback action type: ${action.actionType}`);
    }
  }

  private async disableService(
    target: string,
    parameters: Record<string, any>,
  ): Promise<void> {
    structuredLogger.info('Disabling service', { target, parameters });
    // Implementation would disable the specific service
    this.systemDegradation.disabledFeatures.push(target);
  }

  private async enableFallback(
    target: string,
    parameters: Record<string, any>,
  ): Promise<void> {
    structuredLogger.info('Enabling fallback', { target, parameters });
    // Implementation would enable fallback for the target
  }

  private async switchMode(
    target: string,
    parameters: Record<string, any>,
  ): Promise<void> {
    structuredLogger.info('Switching mode', { target, parameters });

    if (
      target === 'story_generation' &&
      parameters.mode === 'progressive_enhancement'
    ) {
      // Already implemented in our progressive enhancement service
      this.progressiveEnhancement.updateNetworkConditionsManually({
        quality: 'poor', // Force degraded mode
      });
    }
  }

  private async reduceQuality(
    target: string,
    parameters: Record<string, any>,
  ): Promise<void> {
    structuredLogger.info('Reducing quality', { target, parameters });
    // Implementation would reduce quality for the target service
  }

  private async enableCacheOnly(
    target: string,
    parameters: Record<string, any>,
  ): Promise<void> {
    structuredLogger.info('Enabling cache-only mode', { target, parameters });
    // Implementation would switch to cache-only operation
  }

  private async enableOfflineMode(
    target: string,
    parameters: Record<string, any>,
  ): Promise<void> {
    structuredLogger.info('Enabling offline mode', { target, parameters });

    if (target === 'entire_system') {
      // Activate network adapter offline mode
      await this.networkAdapter.handleConnectionLoss();
    }
  }

  private async sendUserNotification(
    target: string,
    parameters: Record<string, any>,
  ): Promise<void> {
    structuredLogger.info('Sending user notification', { target, parameters });

    if (parameters.message) {
      this.systemDegradation.userMessage = parameters.message;
    }
  }

  private async executeFallbackReversion(
    fallbackState: FallbackState,
  ): Promise<void> {
    try {
      structuredLogger.info('Reverting fallback strategy', {
        strategyId: fallbackState.strategyId,
      });

      // Execute rollback actions in reverse order
      for (let i = fallbackState.actionsExecuted.length - 1; i >= 0; i--) {
        const action = fallbackState.actionsExecuted[i];
        if (action.rollbackAction) {
          await this.executeFallbackAction(action.rollbackAction);
        }
      }

      // Remove from active fallbacks
      this.activeFallbacks.delete(fallbackState.strategyId);

      // Update system status
      this.updateSystemDegradationStatus();

      structuredLogger.info('Fallback strategy reverted', {
        strategyId: fallbackState.strategyId,
      });
    } catch (error) {
      structuredLogger.error(
        'Fallback reversion failed',
        {
          strategyId: fallbackState.strategyId,
        },
        error as Error,
      );
      throw error;
    }
  }

  private startRecoveryMonitoring(): void {
    this.recoveryCheckInterval = setInterval(async () => {
      await this.checkForRecovery();
    }, 30000); // Check every 30 seconds
  }

  private async checkForRecovery(): Promise<void> {
    if (this.activeFallbacks.size === 0) return;

    const systemHealth = this.healthMonitor.getSystemHealth();

    for (const [strategyId, fallbackState] of this.activeFallbacks.entries()) {
      if (!fallbackState.canRevert) continue;

      const serviceHealth = this.healthMonitor.getServiceHealth(
        fallbackState.trigger.service,
      );

      // Check if service has recovered
      if (serviceHealth?.status === 'healthy') {
        const timeSinceActivation =
          Date.now() - fallbackState.activatedAt.getTime();

        // Wait at least 2 minutes before reverting to ensure stability
        if (timeSinceActivation > 120000) {
          structuredLogger.info(
            'Service recovery detected, reverting fallback',
            {
              strategyId,
              service: fallbackState.trigger.service,
              timeSinceActivation,
            },
          );

          await this.revertFallback(strategyId);
        }
      }
    }
  }

  private updateSystemDegradationStatus(): void {
    const activeFallbacks = Array.from(this.activeFallbacks.values());

    // Determine overall system status
    let overall: SystemDegradationStatus['overall'] = 'normal';

    if (activeFallbacks.length > 0) {
      const hasEmergency = activeFallbacks.some(
        f => f.currentImpact.functionalityLoss > 0.7,
      );
      const hasCritical = activeFallbacks.some(
        f => f.currentImpact.functionalityLoss > 0.4,
      );

      if (hasEmergency) {
        overall = 'emergency';
      } else if (hasCritical || activeFallbacks.length > 2) {
        overall = 'critical';
      } else {
        overall = 'degraded';
      }
    }

    this.systemDegradation = {
      overall,
      activeFallbacks,
      availableFeatures: this.getAvailableFeatures(),
      disabledFeatures: [...this.systemDegradation.disabledFeatures],
      estimatedRecoveryTime: this.estimateRecoveryTime(),
      userMessage: this.systemDegradation.userMessage,
    };
  }

  private getAvailableFeatures(): string[] {
    const allFeatures = [
      'story_generation',
      'content_prediction',
      'personalization',
      'quality_assessment',
    ];
    return allFeatures.filter(
      feature => !this.systemDegradation.disabledFeatures.includes(feature),
    );
  }

  private estimateRecoveryTime(): number | undefined {
    if (this.activeFallbacks.size === 0) return undefined;

    // Simple estimation based on service health trends
    // In a real implementation, this would be more sophisticated
    return Math.max(
      ...Array.from(this.activeFallbacks.values()).map(
        f => (Date.now() - f.activatedAt.getTime()) * 2, // Estimate double the time already spent
      ),
    );
  }

  private generateDefaultUserMessage(): string {
    switch (this.systemDegradation.overall) {
      case 'degraded':
        return 'Some features are temporarily running in reduced mode to ensure the best experience.';
      case 'critical':
        return "We're experiencing some technical difficulties. Core features remain available with limited functionality.";
      case 'emergency':
        return 'The system is in emergency mode. Basic story creation is available offline while we work to restore full service.';
      default:
        return 'All systems operating normally.';
    }
  }

  private getMonitoredServices(): string[] {
    const systemHealth = this.healthMonitor.getSystemHealth();
    return Object.keys(systemHealth.services);
  }

  /**
   * Get fallback execution history
   */
  public getFallbackHistory(limit?: number): FallbackState[] {
    const history = [...this.fallbackHistory];
    return limit ? history.slice(-limit) : history;
  }

  /**
   * Get metrics about fallback effectiveness
   */
  public getFallbackMetrics(): {
    totalActivations: number;
    successfulReversions: number;
    currentlyActive: number;
    averageActivationTime: number;
    mostTriggeredStrategy: string | null;
  } {
    const history = this.fallbackHistory;
    const successfulReversions = history.length - this.activeFallbacks.size;

    let averageActivationTime = 0;
    if (history.length > 0) {
      const totalTime = history.reduce((sum, state) => {
        const endTime = this.activeFallbacks.has(state.strategyId)
          ? Date.now()
          : Date.now(); // Simplified - would track actual reversion time
        return sum + (endTime - state.activatedAt.getTime());
      }, 0);
      averageActivationTime = totalTime / history.length;
    }

    // Find most triggered strategy
    const strategyCounts: Record<string, number> = {};
    history.forEach(state => {
      strategyCounts[state.strategyId] =
        (strategyCounts[state.strategyId] || 0) + 1;
    });

    const mostTriggeredStrategy =
      Object.entries(strategyCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ||
      null;

    return {
      totalActivations: history.length,
      successfulReversions,
      currentlyActive: this.activeFallbacks.size,
      averageActivationTime,
      mostTriggeredStrategy,
    };
  }
}
