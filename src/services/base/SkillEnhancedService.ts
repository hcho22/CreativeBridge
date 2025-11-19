/**
 * Skill-Enhanced Service Architecture
 * 
 * Base classes and interfaces for wrapping existing services with Claude Skills.
 * Provides reusable enhancement pattern with automatic fallback.
 */

import {
  SkillManager,
  SkillType,
  SkillInput,
  SkillResult,
  SkillError,
} from '../../types/claudeSkills';
import { SkillOrchestrator, SkillExecutionPlan, SkillAggregator } from './SkillOrchestrator';
import {
  FallbackStrategyManager,
  FallbackContext,
  FallbackResult,
  OriginalServiceFallbackStrategy,
} from './FallbackStrategy';
import { abTestingService } from '../abTesting';

/**
 * Base interface for skill-enhanced services
 */
export interface ISkillEnhancedService<TRequest, TResponse> {
  /**
   * Execute the service operation with skill enhancement
   */
  execute(request: TRequest): Promise<TResponse>;

  /**
   * Execute without skills (original service)
   */
  executeOriginal(request: TRequest): Promise<TResponse>;

  /**
   * Check if skills are enabled for this service
   */
  areSkillsEnabled(): Promise<boolean>;
}

/**
 * Configuration for skill-enhanced service
 */
export interface SkillEnhancedServiceConfig {
  enabled: boolean;
  skillTypes: SkillType[];
  fallbackEnabled: boolean;
  userId?: string;
  experimentId?: string;
  metadata?: Record<string, any>;
}

/**
 * Base class for skill-enhanced services
 * Wraps existing services with Claude Skills capabilities
 */
export abstract class SkillEnhancedService<TRequest, TResponse>
  implements ISkillEnhancedService<TRequest, TResponse>
{
  protected skillManager: SkillManager;
  protected orchestrator: SkillOrchestrator;
  protected fallbackManager: FallbackStrategyManager<TRequest, TResponse>;
  protected config: SkillEnhancedServiceConfig;
  protected originalService: {
    execute(request: TRequest): Promise<TResponse>;
  };

  constructor(
    skillManager: SkillManager,
    originalService: { execute(request: TRequest): Promise<TResponse> },
    config: SkillEnhancedServiceConfig
  ) {
    this.skillManager = skillManager;
    this.originalService = originalService;
    this.config = config;
    this.orchestrator = new SkillOrchestrator(skillManager);
    this.fallbackManager = new FallbackStrategyManager<TRequest, TResponse>();

    // Register default fallback strategies
    this.initializeFallbackStrategies();
  }

  /**
   * Initialize fallback strategies
   */
  protected initializeFallbackStrategies(): void {
    // Register original service fallback (always available)
    if (this.config.fallbackEnabled) {
      const originalFallback = new OriginalServiceFallbackStrategy(
        this.originalService
      );
      this.fallbackManager.registerStrategy(originalFallback);
    }
  }

  /**
   * Execute with skill enhancement
   */
  async execute(request: TRequest): Promise<TResponse> {
    // Check if skills are enabled
    const skillsEnabled = await this.areSkillsEnabled();
    if (!skillsEnabled || !this.config.enabled) {
      return this.executeOriginal(request);
    }

    try {
      // Build skill execution plan
      const plan = await this.buildSkillExecutionPlan(request);
      if (!plan || plan.skills.length === 0) {
        // No skills to execute, use original service
        return this.executeOriginal(request);
      }

      // Execute skills
      const orchestrationResult = await this.orchestrator.executePlan(
        plan,
        this.getAggregator()
      );

      // Process skill results
      if (orchestrationResult.success) {
        return await this.processSkillResults(request, orchestrationResult);
      } else {
        // Skills failed, use fallback
        return this.handleSkillFailure(request, orchestrationResult);
      }
    } catch (error) {
      console.error('Skill-enhanced execution error:', error);
      return this.handleSkillFailure(request, {
        success: false,
        results: new Map(),
        errors: new Map(),
        executionTime: 0,
        metadata: {
          totalSkills: 0,
          successfulSkills: 0,
          failedSkills: 0,
          skippedSkills: 0,
        },
      });
    }
  }

  /**
   * Execute original service without skills
   */
  async executeOriginal(request: TRequest): Promise<TResponse> {
    return this.originalService.execute(request);
  }

  /**
   * Check if skills are enabled (considers A/B testing)
   */
  async areSkillsEnabled(): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    // Check A/B testing if experiment ID provided
    if (this.config.experimentId && this.config.userId) {
      const enabled = await abTestingService.shouldEnableClaudeSkills(
        this.config.userId,
        this.config.experimentId
      );
      return enabled;
    }

    return this.config.enabled;
  }

  /**
   * Build skill execution plan for the request
   * Override in subclasses to define skill usage
   */
  protected abstract buildSkillExecutionPlan(
    request: TRequest
  ): Promise<SkillExecutionPlan | null>;

  /**
   * Process skill results and generate response
   * Override in subclasses to customize result processing
   */
  protected abstract processSkillResults(
    request: TRequest,
    orchestrationResult: any
  ): Promise<TResponse>;

  /**
   * Get aggregator for skill results (optional)
   */
  protected getAggregator<T>(): SkillAggregator<T> | undefined {
    return undefined;
  }

  /**
   * Handle skill failure with fallback
   */
  protected async handleSkillFailure(
    request: TRequest,
    orchestrationResult: any
  ): Promise<TResponse> {
    // Build fallback context
    const firstError = Array.from(orchestrationResult.errors.values())[0];
    const context: FallbackContext = {
      originalRequest: request,
      error: firstError,
      reason: this.getFallbackReason(firstError),
      attemptNumber: 1,
      metadata: this.config.metadata,
    };

    // Try fallback strategies
    const fallbackResult = await this.fallbackManager.executeFallback(
      request,
      context
    );

    if (fallbackResult.success && fallbackResult.data) {
      return fallbackResult.data;
    }

    // All fallbacks failed, throw error
    throw new Error(
      fallbackResult.error ||
        'Service execution failed and all fallback strategies failed'
    );
  }

  /**
   * Get fallback reason from error
   */
  protected getFallbackReason(error?: SkillError): 'skill_error' {
    if (!error) {
      return 'skill_error';
    }

    switch (error.code) {
      case 'SKILL_TIMEOUT':
        return 'skill_timeout';
      case 'NETWORK_ERROR':
        return 'network_error';
      case 'RATE_LIMIT_EXCEEDED':
        return 'skill_rate_limited';
      case 'SKILL_UNAVAILABLE':
        return 'skill_unavailable';
      case 'CONFIGURATION_ERROR':
        return 'configuration_error';
      default:
        return 'skill_error';
    }
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<SkillEnhancedServiceConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get current configuration
   */
  getConfig(): SkillEnhancedServiceConfig {
    return { ...this.config };
  }
}

/**
 * Service wrapper factory - creates skill-enhanced wrappers for existing services
 */
export class SkillEnhancedServiceFactory {
  /**
   * Wrap an existing service with skill enhancement
   */
  static wrapService<TRequest, TResponse>(
    service: { execute(request: TRequest): Promise<TResponse> },
    skillManager: SkillManager,
    config: SkillEnhancedServiceConfig,
    implementation: {
      buildSkillExecutionPlan(
        request: TRequest
      ): Promise<SkillExecutionPlan | null>;
      processSkillResults(
        request: TRequest,
        orchestrationResult: any
      ): Promise<TResponse>;
    }
  ): SkillEnhancedService<TRequest, TResponse> {
    return new (class extends SkillEnhancedService<TRequest, TResponse> {
      protected async buildSkillExecutionPlan(
        request: TRequest
      ): Promise<SkillExecutionPlan | null> {
        return implementation.buildSkillExecutionPlan(request);
      }

      protected async processSkillResults(
        request: TRequest,
        orchestrationResult: any
      ): Promise<TResponse> {
        return implementation.processSkillResults(request, orchestrationResult);
      }
    })(skillManager, service, config);
  }
}

/**
 * Helper to create skill input from request
 */
export function createSkillInput(
  request: any,
  additionalData?: Record<string, any>
): SkillInput {
  return {
    ...request,
    ...additionalData,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Helper to extract data from skill results
 */
export function extractSkillData<T>(result: SkillResult<T>): T | null {
  if (result.success && result.data) {
    return result.data;
  }
  return null;
}

