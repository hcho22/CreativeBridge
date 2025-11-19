/**
 * Service Restoration Manager
 * 
 * Manages gradual service restoration after outages or degradation
 * Task 6.3: Service Degradation Handling - Gradual service restoration component
 */

import { structuredLogger } from '../utils/logger';
import { ServiceHealthMonitor, ServiceHealthStatus, ServiceMetrics } from './serviceHealth';
import { AutomaticFallbackManager, SystemDegradationStatus } from './automaticFallbackManager';
import { SkillManager } from '../types/claudeSkills';

export interface RestorationPhase {
  phaseId: string;
  name: string;
  description: string;
  conditions: RestorationCondition[];
  actions: RestorationAction[];
  successCriteria: SuccessCriteria;
  rollbackTriggers: RollbackTrigger[];
  estimatedDuration: number; // milliseconds
  canSkip: boolean;
}

export interface RestorationCondition {
  type: 'service_health' | 'time_elapsed' | 'stability_window' | 'user_load' | 'error_rate' | 'custom';
  target?: string; // service name if applicable
  threshold: any; // type-specific threshold value
  description: string;
}

export interface RestorationAction {
  actionType: 'enable_service' | 'increase_capacity' | 'restore_features' | 'clear_fallbacks' | 'update_config' | 'run_tests' | 'user_notification';
  target: string;
  parameters: Record<string, any>;
  timeout?: number;
  retryable: boolean;
}

export interface SuccessCriteria {
  healthThreshold: 'healthy' | 'degraded';
  stabilityPeriod: number; // milliseconds
  maxErrorRate: number;
  minSuccessRate: number;
  customChecks?: (() => Promise<boolean>)[];
}

export interface RollbackTrigger {
  condition: RestorationCondition;
  action: 'pause_restoration' | 'rollback_phase' | 'rollback_all' | 'activate_emergency';
  reason: string;
}

export interface RestorationPlan {
  planId: string;
  name: string;
  description: string;
  phases: RestorationPhase[];
  totalEstimatedDuration: number;
  applicableToServices: string[];
  priority: number;
}

export interface RestorationExecution {
  planId: string;
  startTime: Date;
  currentPhase: number;
  phaseExecutions: PhaseExecution[];
  overallStatus: 'in_progress' | 'completed' | 'failed' | 'paused' | 'rolled_back';
  errors: string[];
  metrics: RestorationMetrics;
}

export interface PhaseExecution {
  phaseId: string;
  startTime: Date;
  endTime?: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped' | 'rolled_back';
  actionsExecuted: RestorationAction[];
  conditionsChecked: RestorationCondition[];
  errors: string[];
  duration?: number;
}

export interface RestorationMetrics {
  totalDuration: number;
  phasesCompleted: number;
  phasesSkipped: number;
  phasesFailed: number;
  rollbacksTriggered: number;
  finalSuccessRate: number;
  userImpactScore: number; // 0-1, lower is better
  systemStabilityScore: number; // 0-1, higher is better
}

export class ServiceRestorationManager {
  private healthMonitor: ServiceHealthMonitor;
  private fallbackManager: AutomaticFallbackManager;
  private skillManager: SkillManager;

  private restorationPlans: Map<string, RestorationPlan> = new Map();
  private activeRestorations: Map<string, RestorationExecution> = new Map();
  private restorationHistory: RestorationExecution[] = [];
  
  private isEnabled: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(
    healthMonitor: ServiceHealthMonitor,
    fallbackManager: AutomaticFallbackManager,
    skillManager: SkillManager
  ) {
    this.healthMonitor = healthMonitor;
    this.fallbackManager = fallbackManager;
    this.skillManager = skillManager;

    this.initializeRestorationPlans();
  }

  /**
   * Enable automatic service restoration
   */
  public enable(): void {
    if (this.isEnabled) {
      structuredLogger.warn('Service restoration already enabled');
      return;
    }

    this.isEnabled = true;
    this.startRestorationMonitoring();
    
    structuredLogger.info('Service restoration manager enabled', {
      plansCount: this.restorationPlans.size,
      plans: Array.from(this.restorationPlans.keys())
    });
  }

  /**
   * Disable automatic service restoration
   */
  public disable(): void {
    if (!this.isEnabled) return;

    this.isEnabled = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    // Pause any active restorations
    for (const execution of this.activeRestorations.values()) {
      if (execution.overallStatus === 'in_progress') {
        execution.overallStatus = 'paused';
      }
    }
    
    structuredLogger.info('Service restoration manager disabled');
  }

  /**
   * Manually trigger restoration for specific services
   */
  public async triggerRestoration(
    services: string[], 
    planId?: string,
    force: boolean = false
  ): Promise<string | null> {
    try {
      // Find appropriate restoration plan
      const plan = planId ? 
        this.restorationPlans.get(planId) :
        this.findBestRestorationPlan(services);

      if (!plan) {
        structuredLogger.warn('No suitable restoration plan found', { services, planId });
        return null;
      }

      // Check if we should start restoration
      if (!force && !this.shouldStartRestoration(services)) {
        structuredLogger.info('Restoration conditions not met', { services, planId: plan.planId });
        return null;
      }

      // Start restoration execution
      const executionId = await this.startRestorationExecution(plan, services);
      
      structuredLogger.info('Manual restoration triggered', {
        services,
        planId: plan.planId,
        executionId
      });
      
      return executionId;

    } catch (error) {
      structuredLogger.error('Failed to trigger restoration', { services, planId }, error as Error);
      return null;
    }
  }

  /**
   * Get current restoration status
   */
  public getRestorationStatus(): {
    enabled: boolean;
    activeRestorations: number;
    restorationExecutions: RestorationExecution[];
    systemStatus: SystemDegradationStatus;
  } {
    return {
      enabled: this.isEnabled,
      activeRestorations: this.activeRestorations.size,
      restorationExecutions: Array.from(this.activeRestorations.values()),
      systemStatus: this.fallbackManager.getSystemStatus()
    };
  }

  /**
   * Get restoration execution details
   */
  public getRestorationExecution(executionId: string): RestorationExecution | undefined {
    return this.activeRestorations.get(executionId);
  }

  /**
   * Pause an active restoration
   */
  public pauseRestoration(executionId: string): boolean {
    const execution = this.activeRestorations.get(executionId);
    if (!execution || execution.overallStatus !== 'in_progress') {
      return false;
    }

    execution.overallStatus = 'paused';
    structuredLogger.info('Restoration paused', { executionId });
    return true;
  }

  /**
   * Resume a paused restoration
   */
  public async resumeRestoration(executionId: string): Promise<boolean> {
    const execution = this.activeRestorations.get(executionId);
    if (!execution || execution.overallStatus !== 'paused') {
      return false;
    }

    execution.overallStatus = 'in_progress';
    structuredLogger.info('Restoration resumed', { executionId });
    
    // Continue execution
    await this.continueRestorationExecution(execution);
    return true;
  }

  /**
   * Cancel an active restoration
   */
  public async cancelRestoration(executionId: string): Promise<boolean> {
    const execution = this.activeRestorations.get(executionId);
    if (!execution) return false;

    try {
      await this.rollbackRestoration(execution, 'User cancellation');
      structuredLogger.info('Restoration cancelled', { executionId });
      return true;
    } catch (error) {
      structuredLogger.error('Failed to cancel restoration', { executionId }, error as Error);
      return false;
    }
  }

  // Private methods

  private initializeRestorationPlans(): void {
    // Plan 1: Basic Service Recovery
    this.restorationPlans.set('basic_service_recovery', {
      planId: 'basic_service_recovery',
      name: 'Basic Service Recovery',
      description: 'Standard restoration for individual service recovery',
      phases: [
        {
          phaseId: 'health_verification',
          name: 'Health Verification',
          description: 'Verify service health before restoration',
          conditions: [
            {
              type: 'service_health',
              target: '*',
              threshold: 'degraded', // At least degraded, preferably healthy
              description: 'Service health must be at least degraded'
            },
            {
              type: 'stability_window',
              threshold: 60000, // 1 minute
              description: 'Service must be stable for 1 minute'
            }
          ],
          actions: [
            {
              actionType: 'run_tests',
              target: 'service_connectivity',
              parameters: { testDepth: 'basic' },
              retryable: true
            }
          ],
          successCriteria: {
            healthThreshold: 'degraded',
            stabilityPeriod: 30000,
            maxErrorRate: 0.1,
            minSuccessRate: 0.9
          },
          rollbackTriggers: [
            {
              condition: {
                type: 'service_health',
                threshold: 'unavailable',
                description: 'Service becomes unavailable during verification'
              },
              action: 'pause_restoration',
              reason: 'Service health deteriorated'
            }
          ],
          estimatedDuration: 120000, // 2 minutes
          canSkip: false
        },
        {
          phaseId: 'gradual_restoration',
          name: 'Gradual Restoration',
          description: 'Gradually restore service functionality',
          conditions: [
            {
              type: 'service_health',
              target: '*',
              threshold: 'healthy',
              description: 'Service health must be healthy'
            }
          ],
          actions: [
            {
              actionType: 'restore_features',
              target: 'primary_functionality',
              parameters: { 
                percentage: 25,
                monitor: true 
              },
              retryable: true
            },
            {
              actionType: 'user_notification',
              target: 'restoration_progress',
              parameters: {
                message: 'Service restoration in progress - 25% functionality restored',
                type: 'info'
              },
              retryable: false
            }
          ],
          successCriteria: {
            healthThreshold: 'healthy',
            stabilityPeriod: 120000, // 2 minutes
            maxErrorRate: 0.05,
            minSuccessRate: 0.95
          },
          rollbackTriggers: [
            {
              condition: {
                type: 'error_rate',
                threshold: 0.15,
                description: 'Error rate exceeds 15%'
              },
              action: 'rollback_phase',
              reason: 'High error rate detected'
            }
          ],
          estimatedDuration: 180000, // 3 minutes
          canSkip: false
        },
        {
          phaseId: 'full_restoration',
          name: 'Full Restoration',
          description: 'Restore full service functionality',
          conditions: [
            {
              type: 'time_elapsed',
              threshold: 300000, // 5 minutes since start
              description: '5 minutes must have elapsed since restoration start'
            }
          ],
          actions: [
            {
              actionType: 'restore_features',
              target: 'all_functionality',
              parameters: { 
                percentage: 100,
                enableAdvancedFeatures: true 
              },
              retryable: true
            },
            {
              actionType: 'clear_fallbacks',
              target: 'service_fallbacks',
              parameters: {},
              retryable: true
            },
            {
              actionType: 'user_notification',
              target: 'restoration_complete',
              parameters: {
                message: 'Service fully restored - all features available',
                type: 'success'
              },
              retryable: false
            }
          ],
          successCriteria: {
            healthThreshold: 'healthy',
            stabilityPeriod: 300000, // 5 minutes
            maxErrorRate: 0.02,
            minSuccessRate: 0.98
          },
          rollbackTriggers: [
            {
              condition: {
                type: 'error_rate',
                threshold: 0.1,
                description: 'Error rate exceeds 10% during full restoration'
              },
              action: 'rollback_phase',
              reason: 'Full restoration failed'
            }
          ],
          estimatedDuration: 300000, // 5 minutes
          canSkip: false
        }
      ],
      totalEstimatedDuration: 600000, // 10 minutes total
      applicableToServices: ['*'], // Any service
      priority: 1
    });

    // Plan 2: Critical System Recovery
    this.restorationPlans.set('critical_system_recovery', {
      planId: 'critical_system_recovery',
      name: 'Critical System Recovery',
      description: 'Recovery plan for critical system-wide outages',
      phases: [
        {
          phaseId: 'emergency_assessment',
          name: 'Emergency Assessment',
          description: 'Assess system state and prepare for restoration',
          conditions: [
            {
              type: 'custom',
              threshold: () => this.assessCriticalSystemReadiness(),
              description: 'Critical system readiness assessment'
            }
          ],
          actions: [
            {
              actionType: 'run_tests',
              target: 'system_infrastructure',
              parameters: { testDepth: 'comprehensive' },
              retryable: true
            },
            {
              actionType: 'user_notification',
              target: 'restoration_start',
              parameters: {
                message: 'System recovery initiated. Core features will be restored gradually.',
                type: 'info',
                persistent: true
              },
              retryable: false
            }
          ],
          successCriteria: {
            healthThreshold: 'degraded',
            stabilityPeriod: 120000,
            maxErrorRate: 0.2,
            minSuccessRate: 0.8
          },
          rollbackTriggers: [],
          estimatedDuration: 300000, // 5 minutes
          canSkip: false
        },
        {
          phaseId: 'core_services_restoration',
          name: 'Core Services Restoration',
          description: 'Restore essential services first',
          conditions: [
            {
              type: 'service_health',
              target: 'claude_skills_api',
              threshold: 'degraded',
              description: 'Claude Skills API must be at least degraded'
            }
          ],
          actions: [
            {
              actionType: 'enable_service',
              target: 'claude_skills_api',
              parameters: { 
                limitedMode: true,
                maxConcurrentRequests: 10 
              },
              retryable: true
            },
            {
              actionType: 'restore_features',
              target: 'story_generation',
              parameters: { 
                basicMode: true,
                useCache: true 
              },
              retryable: true
            }
          ],
          successCriteria: {
            healthThreshold: 'degraded',
            stabilityPeriod: 180000,
            maxErrorRate: 0.1,
            minSuccessRate: 0.9
          },
          rollbackTriggers: [
            {
              condition: {
                type: 'service_health',
                target: 'claude_skills_api',
                threshold: 'unavailable',
                description: 'Claude Skills API becomes unavailable'
              },
              action: 'rollback_all',
              reason: 'Core service failure'
            }
          ],
          estimatedDuration: 420000, // 7 minutes
          canSkip: false
        },
        {
          phaseId: 'enhanced_services_restoration',
          name: 'Enhanced Services Restoration',
          description: 'Restore advanced features and optimizations',
          conditions: [
            {
              type: 'time_elapsed',
              threshold: 600000, // 10 minutes since start
              description: '10 minutes must have elapsed'
            },
            {
              type: 'user_load',
              threshold: 0.5, // 50% normal load
              description: 'System load must be manageable'
            }
          ],
          actions: [
            {
              actionType: 'restore_features',
              target: 'advanced_features',
              parameters: { 
                personalization: true,
                contentPrediction: true,
                qualityAssessment: true 
              },
              retryable: true
            },
            {
              actionType: 'update_config',
              target: 'performance_settings',
              parameters: { 
                restoreOptimalSettings: true 
              },
              retryable: true
            }
          ],
          successCriteria: {
            healthThreshold: 'healthy',
            stabilityPeriod: 300000,
            maxErrorRate: 0.03,
            minSuccessRate: 0.97
          },
          rollbackTriggers: [
            {
              condition: {
                type: 'error_rate',
                threshold: 0.08,
                description: 'Error rate exceeds 8%'
              },
              action: 'rollback_phase',
              reason: 'Enhanced features causing instability'
            }
          ],
          estimatedDuration: 480000, // 8 minutes
          canSkip: true
        }
      ],
      totalEstimatedDuration: 1200000, // 20 minutes total
      applicableToServices: ['claude_skills_api', 'story_generation', 'content_prediction'],
      priority: 0 // Highest priority
    });

    structuredLogger.info('Restoration plans initialized', {
      plansCount: this.restorationPlans.size,
      plans: Array.from(this.restorationPlans.keys())
    });
  }

  private startRestorationMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      await this.checkForRestorationOpportunities();
      await this.continueActiveRestorations();
    }, 30000); // Check every 30 seconds
  }

  private async checkForRestorationOpportunities(): Promise<void> {
    if (!this.isEnabled) return;

    const systemStatus = this.fallbackManager.getSystemStatus();
    
    // Only consider restoration if system is degraded but not in emergency
    if (systemStatus.overall === 'normal' || systemStatus.overall === 'emergency') {
      return;
    }

    // Check each disabled service for restoration potential
    const systemHealth = this.healthMonitor.getSystemHealth();
    
    for (const serviceName of systemHealth.unavailableServices) {
      const serviceHealth = this.healthMonitor.getServiceHealth(serviceName);
      
      // If service health improved, consider restoration
      if (serviceHealth?.status === 'healthy' || serviceHealth?.status === 'degraded') {
        const hasActiveRestoration = Array.from(this.activeRestorations.values())
          .some(exec => exec.planId.includes(serviceName) && exec.overallStatus === 'in_progress');
        
        if (!hasActiveRestoration && this.shouldStartRestoration([serviceName])) {
          structuredLogger.info('Restoration opportunity detected', {
            service: serviceName,
            currentHealth: serviceHealth.status
          });
          
          await this.triggerRestoration([serviceName]);
        }
      }
    }
  }

  private async continueActiveRestorations(): Promise<void> {
    for (const execution of this.activeRestorations.values()) {
      if (execution.overallStatus === 'in_progress') {
        await this.continueRestorationExecution(execution);
      }
    }
  }

  private shouldStartRestoration(services: string[]): boolean {
    // Check if services are in a state where restoration makes sense
    for (const serviceName of services) {
      const serviceHealth = this.healthMonitor.getServiceHealth(serviceName);
      if (!serviceHealth || serviceHealth.status === 'unavailable') {
        return false;
      }
    }

    // Check system load and conditions
    const systemStatus = this.fallbackManager.getSystemStatus();
    if (systemStatus.overall === 'emergency') {
      return false; // Don't restore during emergencies
    }

    return true;
  }

  private findBestRestorationPlan(services: string[]): RestorationPlan | undefined {
    const plans = Array.from(this.restorationPlans.values());
    
    // Filter plans applicable to these services
    const applicablePlans = plans.filter(plan =>
      plan.applicableToServices.includes('*') || 
      services.some(service => plan.applicableToServices.includes(service))
    );

    if (applicablePlans.length === 0) return undefined;

    // Choose plan based on priority and scope
    const systemStatus = this.fallbackManager.getSystemStatus();
    
    if (systemStatus.overall === 'critical' || services.length > 2) {
      // Use critical recovery plan for widespread issues
      return applicablePlans.find(plan => plan.planId === 'critical_system_recovery') || applicablePlans[0];
    } else {
      // Use basic recovery for individual services
      return applicablePlans.find(plan => plan.planId === 'basic_service_recovery') || applicablePlans[0];
    }
  }

  private async startRestorationExecution(plan: RestorationPlan, services: string[]): Promise<string> {
    const executionId = `resto_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    const execution: RestorationExecution = {
      planId: plan.planId,
      startTime: new Date(),
      currentPhase: 0,
      phaseExecutions: [],
      overallStatus: 'in_progress',
      errors: [],
      metrics: {
        totalDuration: 0,
        phasesCompleted: 0,
        phasesSkipped: 0,
        phasesFailed: 0,
        rollbacksTriggered: 0,
        finalSuccessRate: 0,
        userImpactScore: 0.5,
        systemStabilityScore: 0.5
      }
    };

    this.activeRestorations.set(executionId, execution);
    
    structuredLogger.info('Restoration execution started', {
      executionId,
      planId: plan.planId,
      services,
      estimatedDuration: plan.totalEstimatedDuration
    });

    // Start executing phases
    await this.continueRestorationExecution(execution);
    
    return executionId;
  }

  private async continueRestorationExecution(execution: RestorationExecution): Promise<void> {
    if (execution.overallStatus !== 'in_progress') return;

    const plan = this.restorationPlans.get(execution.planId);
    if (!plan) {
      execution.overallStatus = 'failed';
      execution.errors.push('Restoration plan not found');
      return;
    }

    try {
      while (execution.currentPhase < plan.phases.length && execution.overallStatus === 'in_progress') {
        const phase = plan.phases[execution.currentPhase];
        await this.executeRestorationPhase(execution, phase);
        
        if (execution.overallStatus === 'in_progress') {
          execution.currentPhase++;
        }
      }

      // If all phases completed successfully
      if (execution.currentPhase >= plan.phases.length && execution.overallStatus === 'in_progress') {
        execution.overallStatus = 'completed';
        await this.finalizeRestoration(execution);
      }

    } catch (error) {
      structuredLogger.error('Restoration execution failed', {
        planId: execution.planId
      }, error as Error);
      
      execution.overallStatus = 'failed';
      execution.errors.push((error as Error).message);
    }
  }

  private async executeRestorationPhase(execution: RestorationExecution, phase: RestorationPhase): Promise<void> {
    const phaseExecution: PhaseExecution = {
      phaseId: phase.phaseId,
      startTime: new Date(),
      status: 'in_progress',
      actionsExecuted: [],
      conditionsChecked: [],
      errors: []
    };

    execution.phaseExecutions.push(phaseExecution);
    
    try {
      structuredLogger.info('Starting restoration phase', {
        phaseId: phase.phaseId,
        phaseName: phase.name
      });

      // Check conditions
      const conditionsMet = await this.checkRestorationConditions(phase.conditions);
      phaseExecution.conditionsChecked = [...phase.conditions];

      if (!conditionsMet && !phase.canSkip) {
        phaseExecution.status = 'failed';
        phaseExecution.errors.push('Phase conditions not met');
        execution.overallStatus = 'failed';
        return;
      }

      if (!conditionsMet && phase.canSkip) {
        phaseExecution.status = 'skipped';
        execution.metrics.phasesSkipped++;
        structuredLogger.info('Restoration phase skipped', {
          phaseId: phase.phaseId,
          reason: 'Conditions not met but phase is skippable'
        });
        return;
      }

      // Execute actions
      for (const action of phase.actions) {
        try {
          await this.executeRestorationAction(action);
          phaseExecution.actionsExecuted.push(action);
        } catch (actionError) {
          const errorMsg = `Action failed: ${action.actionType} on ${action.target}`;
          phaseExecution.errors.push(errorMsg);
          
          if (!action.retryable) {
            throw new Error(errorMsg);
          }
          
          structuredLogger.warn('Restoration action failed but continuing', {
            phaseId: phase.phaseId,
            actionType: action.actionType,
            error: (actionError as Error).message
          });
        }
      }

      // Verify success criteria
      const success = await this.verifyPhaseSuccess(phase.successCriteria);
      
      if (success) {
        phaseExecution.status = 'completed';
        execution.metrics.phasesCompleted++;
        
        structuredLogger.info('Restoration phase completed', {
          phaseId: phase.phaseId,
          duration: Date.now() - phaseExecution.startTime.getTime()
        });
      } else {
        phaseExecution.status = 'failed';
        execution.metrics.phasesFailed++;
        execution.overallStatus = 'failed';
        
        structuredLogger.error('Restoration phase failed verification', {
          phaseId: phase.phaseId
        });
      }

    } catch (error) {
      phaseExecution.status = 'failed';
      phaseExecution.errors.push((error as Error).message);
      execution.metrics.phasesFailed++;
      execution.overallStatus = 'failed';
      
      structuredLogger.error('Restoration phase execution failed', {
        phaseId: phase.phaseId
      }, error as Error);
    } finally {
      phaseExecution.endTime = new Date();
      phaseExecution.duration = phaseExecution.endTime.getTime() - phaseExecution.startTime.getTime();
    }
  }

  private async checkRestorationConditions(conditions: RestorationCondition[]): Promise<boolean> {
    for (const condition of conditions) {
      const met = await this.evaluateCondition(condition);
      if (!met) {
        structuredLogger.debug('Restoration condition not met', {
          type: condition.type,
          target: condition.target,
          description: condition.description
        });
        return false;
      }
    }
    return true;
  }

  private async evaluateCondition(condition: RestorationCondition): Promise<boolean> {
    switch (condition.type) {
      case 'service_health':
        const serviceHealth = condition.target === '*' ? 
          this.healthMonitor.getSystemHealth() :
          this.healthMonitor.getServiceHealth(condition.target!);
        
        if (condition.target === '*') {
          const health = serviceHealth as ReturnType<typeof this.healthMonitor.getSystemHealth>;
          return health.overall !== 'unavailable';
        } else {
          const health = serviceHealth as ServiceHealthStatus;
          return health?.status === condition.threshold || 
                 (condition.threshold === 'degraded' && health?.status === 'healthy');
        }

      case 'time_elapsed':
        // Implementation would check elapsed time
        return true; // Simplified

      case 'stability_window':
        // Implementation would check service stability over time window
        return true; // Simplified

      case 'error_rate':
        const metrics = this.healthMonitor.getServiceMetrics(condition.target!);
        return !metrics || metrics.errorRate <= condition.threshold;

      case 'user_load':
        // Implementation would check current system load
        return true; // Simplified

      case 'custom':
        if (typeof condition.threshold === 'function') {
          return await condition.threshold();
        }
        return true;

      default:
        return true;
    }
  }

  private async executeRestorationAction(action: RestorationAction): Promise<void> {
    switch (action.actionType) {
      case 'enable_service':
        await this.enableService(action.target, action.parameters);
        break;
      case 'restore_features':
        await this.restoreFeatures(action.target, action.parameters);
        break;
      case 'clear_fallbacks':
        await this.clearFallbacks(action.target, action.parameters);
        break;
      case 'run_tests':
        await this.runTests(action.target, action.parameters);
        break;
      case 'user_notification':
        await this.sendRestorationNotification(action.target, action.parameters);
        break;
      case 'increase_capacity':
        await this.increaseCapacity(action.target, action.parameters);
        break;
      case 'update_config':
        await this.updateConfiguration(action.target, action.parameters);
        break;
      default:
        throw new Error(`Unknown restoration action: ${action.actionType}`);
    }
  }

  private async enableService(target: string, parameters: Record<string, any>): Promise<void> {
    structuredLogger.info('Enabling service', { target, parameters });
    // Implementation would enable the specific service
  }

  private async restoreFeatures(target: string, parameters: Record<string, any>): Promise<void> {
    structuredLogger.info('Restoring features', { target, parameters });
    // Implementation would restore specific features
  }

  private async clearFallbacks(target: string, parameters: Record<string, any>): Promise<void> {
    structuredLogger.info('Clearing fallbacks', { target, parameters });
    // Implementation would clear relevant fallbacks
  }

  private async runTests(target: string, parameters: Record<string, any>): Promise<void> {
    structuredLogger.info('Running restoration tests', { target, parameters });
    
    // Basic connectivity test
    if (target === 'service_connectivity') {
      const systemHealth = this.healthMonitor.getSystemHealth();
      if (systemHealth.overall === 'unavailable') {
        throw new Error('Service connectivity test failed');
      }
    }
  }

  private async sendRestorationNotification(target: string, parameters: Record<string, any>): Promise<void> {
    structuredLogger.info('Sending restoration notification', { target, parameters });
    // Implementation would send user notification
  }

  private async increaseCapacity(target: string, parameters: Record<string, any>): Promise<void> {
    structuredLogger.info('Increasing service capacity', { target, parameters });
    // Implementation would increase system capacity
  }

  private async updateConfiguration(target: string, parameters: Record<string, any>): Promise<void> {
    structuredLogger.info('Updating configuration', { target, parameters });
    // Implementation would update service configuration
  }

  private async verifyPhaseSuccess(criteria: SuccessCriteria): Promise<boolean> {
    // Check health threshold
    const systemHealth = this.healthMonitor.getSystemHealth();
    const healthMet = systemHealth.overall === criteria.healthThreshold || 
                     (criteria.healthThreshold === 'degraded' && systemHealth.overall === 'healthy');

    if (!healthMet) return false;

    // Check custom checks
    if (criteria.customChecks) {
      for (const check of criteria.customChecks) {
        const result = await check();
        if (!result) return false;
      }
    }

    return true;
  }

  private async rollbackRestoration(execution: RestorationExecution, reason: string): Promise<void> {
    try {
      structuredLogger.info('Rolling back restoration', {
        planId: execution.planId,
        reason
      });

      execution.overallStatus = 'rolled_back';
      execution.errors.push(`Rollback triggered: ${reason}`);
      execution.metrics.rollbacksTriggered++;

      // Implementation would reverse restoration actions
      
    } catch (error) {
      structuredLogger.error('Restoration rollback failed', {
        planId: execution.planId
      }, error as Error);
    }
  }

  private async finalizeRestoration(execution: RestorationExecution): Promise<void> {
    execution.metrics.totalDuration = Date.now() - execution.startTime.getTime();
    
    // Calculate final metrics
    const systemHealth = this.healthMonitor.getSystemHealth();
    execution.metrics.systemStabilityScore = systemHealth.overall === 'normal' ? 1 : 0.7;
    execution.metrics.userImpactScore = 0.2; // Low impact after successful restoration

    // Move to history
    this.restorationHistory.push({...execution});
    this.activeRestorations.delete(execution.planId);

    structuredLogger.info('Restoration completed successfully', {
      planId: execution.planId,
      totalDuration: execution.metrics.totalDuration,
      phasesCompleted: execution.metrics.phasesCompleted
    });
  }

  private async assessCriticalSystemReadiness(): Promise<boolean> {
    const systemHealth = this.healthMonitor.getSystemHealth();
    return systemHealth.unavailableServices.length < systemHealth.availableServices.length;
  }

  /**
   * Get restoration history and metrics
   */
  public getRestorationMetrics(): {
    totalRestorations: number;
    successfulRestorations: number;
    averageRestorationTime: number;
    restorationSuccessRate: number;
    mostUsedPlan: string | null;
    recentHistory: RestorationExecution[];
  } {
    const history = this.restorationHistory;
    const successful = history.filter(exec => exec.overallStatus === 'completed').length;
    
    let averageTime = 0;
    if (history.length > 0) {
      averageTime = history.reduce((sum, exec) => sum + exec.metrics.totalDuration, 0) / history.length;
    }

    // Find most used plan
    const planCounts: Record<string, number> = {};
    history.forEach(exec => {
      planCounts[exec.planId] = (planCounts[exec.planId] || 0) + 1;
    });
    
    const mostUsedPlan = Object.entries(planCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || null;

    return {
      totalRestorations: history.length,
      successfulRestorations: successful,
      averageRestorationTime: averageTime,
      restorationSuccessRate: history.length > 0 ? successful / history.length : 1,
      mostUsedPlan,
      recentHistory: history.slice(-10) // Last 10 restorations
    };
  }
}