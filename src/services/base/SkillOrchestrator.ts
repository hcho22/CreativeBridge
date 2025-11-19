/**
 * Skill Orchestration Layer
 * 
 * Coordinates multiple Claude Skills for a single operation.
 * Handles skill execution order, dependency management, and result aggregation.
 */

import {
  SkillManager,
  SkillType,
  SkillInput,
  SkillResult,
  SkillError,
} from '../../types/claudeSkills';
import { claudeSkillsMonitor } from '../claudeSkillsMonitor';

export interface SkillExecutionPlan {
  skills: SkillExecutionStep[];
  parallel: boolean; // Execute in parallel or sequentially
  stopOnError: boolean; // Stop execution on first error
}

export interface SkillExecutionStep {
  skillType: SkillType;
  skillId: string;
  input: SkillInput;
  dependsOn?: string[]; // IDs of steps this depends on
  required: boolean; // If false, errors are non-fatal
  timeout?: number; // Custom timeout in ms
}

export interface OrchestrationResult<T = any> {
  success: boolean;
  results: Map<string, SkillResult<any>>;
  errors: Map<string, SkillError>;
  executionTime: number;
  metadata: {
    totalSkills: number;
    successfulSkills: number;
    failedSkills: number;
    skippedSkills: number;
  };
  aggregatedData?: T;
}

export interface SkillAggregator<T> {
  /**
   * Aggregate results from multiple skill executions
   */
  aggregate(results: Map<string, SkillResult<any>>): T;
}

/**
 * Skill Orchestrator - coordinates multiple skill executions
 */
export class SkillOrchestrator {
  constructor(private skillManager: SkillManager) {}

  /**
   * Execute skills according to a plan
   */
  async executePlan<T>(
    plan: SkillExecutionPlan,
    aggregator?: SkillAggregator<T>
  ): Promise<OrchestrationResult<T>> {
    const startTime = Date.now();
    const results = new Map<string, SkillResult<any>>();
    const errors = new Map<string, SkillError>();
    const executed = new Set<string>();

    try {
      if (plan.parallel) {
        await this.executeParallel(plan, results, errors, executed);
      } else {
        await this.executeSequential(plan, results, errors, executed);
      }

      // Aggregate results if aggregator provided
      let aggregatedData: T | undefined;
      if (aggregator && results.size > 0) {
        try {
          aggregatedData = aggregator.aggregate(results);
        } catch (error) {
          console.warn('Failed to aggregate skill results:', error);
        }
      }

      const executionTime = Date.now() - startTime;
      const successfulSkills = results.size;
      const failedSkills = errors.size;
      const skippedSkills = plan.skills.length - executed.size;

      return {
        success: failedSkills === 0 || !plan.stopOnError,
        results,
        errors,
        executionTime,
        metadata: {
          totalSkills: plan.skills.length,
          successfulSkills,
          failedSkills,
          skippedSkills,
        },
        aggregatedData,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return {
        success: false,
        results,
        errors,
        executionTime,
        metadata: {
          totalSkills: plan.skills.length,
          successfulSkills: results.size,
          failedSkills: errors.size,
          skippedSkills: plan.skills.length - executed.size,
        },
      };
    }
  }

  /**
   * Execute skills in parallel
   */
  private async executeParallel(
    plan: SkillExecutionPlan,
    results: Map<string, SkillResult<any>>,
    errors: Map<string, SkillError>,
    executed: Set<string>
  ): Promise<void> {
    // Group skills by dependency level
    const dependencyGroups = this.groupByDependencies(plan.skills);

    // Execute each group in parallel, but groups sequentially
    for (const group of dependencyGroups) {
      const promises = group.map(async step => {
        if (executed.has(step.skillId)) {
          return; // Already executed
        }

        // Check dependencies
        if (step.dependsOn) {
          const allDependenciesMet = step.dependsOn.every(depId =>
            results.has(depId) || executed.has(depId)
          );
          if (!allDependenciesMet) {
            console.warn(
              `Skipping ${step.skillId}: dependencies not met`,
              step.dependsOn
            );
            return;
          }
        }

        try {
          const result = await this.executeStep(step);
          if (result.success) {
            results.set(step.skillId, result);
          } else {
            errors.set(step.skillId, result.error!);
            if (step.required && plan.stopOnError) {
              throw new Error(`Required skill ${step.skillId} failed`);
            }
          }
          executed.add(step.skillId);
        } catch (error) {
          const skillError: SkillError = {
            code: 'UNKNOWN_ERROR' as any,
            message: error instanceof Error ? error.message : 'Unknown error',
            retryable: false,
          };
          errors.set(step.skillId, skillError);
          if (step.required && plan.stopOnError) {
            throw error;
          }
        }
      });

      await Promise.all(promises);
    }
  }

  /**
   * Execute skills sequentially
   */
  private async executeSequential(
    plan: SkillExecutionPlan,
    results: Map<string, SkillResult<any>>,
    errors: Map<string, SkillError>,
    executed: Set<string>
  ): Promise<void> {
    for (const step of plan.skills) {
      if (executed.has(step.skillId)) {
        continue;
      }

      // Check dependencies
      if (step.dependsOn) {
        const allDependenciesMet = step.dependsOn.every(
          depId => results.has(depId) || executed.has(depId)
        );
        if (!allDependenciesMet) {
          console.warn(
            `Skipping ${step.skillId}: dependencies not met`,
            step.dependsOn
          );
          continue;
        }
      }

      try {
        const result = await this.executeStep(step);
        if (result.success) {
          results.set(step.skillId, result);
        } else {
          errors.set(step.skillId, result.error!);
          if (step.required && plan.stopOnError) {
            break; // Stop on error if configured
          }
        }
        executed.add(step.skillId);
      } catch (error) {
        const skillError: SkillError = {
          code: 'UNKNOWN_ERROR' as any,
          message: error instanceof Error ? error.message : 'Unknown error',
          retryable: false,
        };
        errors.set(step.skillId, skillError);
        if (step.required && plan.stopOnError) {
          break;
        }
      }
    }
  }

  /**
   * Execute a single skill step
   */
  private async executeStep(
    step: SkillExecutionStep
  ): Promise<SkillResult<any>> {
    const executionId = `orchestrator_${step.skillId}_${Date.now()}`;

    // Track execution start
    claudeSkillsMonitor.trackExecutionStart(
      executionId,
      step.skillType,
      step.skillId
    );

    try {
      // Execute with timeout if specified
      let result: SkillResult<any>;
      if (step.timeout) {
            result = await Promise.race([
              this.skillManager.executeSkill(step.skillId, step.input),
              new Promise<SkillResult<any>>((_, reject) =>
                setTimeout(
                  () =>
                    reject({
                      code: 'SKILL_TIMEOUT' as any,
                      message: `Skill ${step.skillId} timed out`,
                      retryable: false,
                    }),
                  step.timeout
                )
              ),
            ]);
      } else {
        result = await this.skillManager.executeSkill(step.skillId, step.input);
      }

      // Track execution complete
      await claudeSkillsMonitor.trackExecutionComplete(
        executionId,
        result,
        step.skillId
      );

      return result;
    } catch (error) {
      const errorResult: SkillResult<any> = {
        success: false,
        error: error as SkillError,
        executionTimeMs: 0,
        skillType: step.skillType,
      };

      await claudeSkillsMonitor.trackExecutionComplete(
        executionId,
        errorResult,
        step.skillId
      );

      return errorResult;
    }
  }

  /**
   * Group skills by dependency levels for parallel execution
   */
  private groupByDependencies(
    steps: SkillExecutionStep[]
  ): SkillExecutionStep[][] {
    const groups: SkillExecutionStep[][] = [];
    const remaining = new Set(steps.map(s => s.skillId));
    const processed = new Set<string>();

    while (remaining.size > 0) {
      const currentGroup: SkillExecutionStep[] = [];

      for (const step of steps) {
        if (processed.has(step.skillId)) {
          continue;
        }

        // Check if all dependencies are processed
        const dependenciesMet =
          !step.dependsOn ||
          step.dependsOn.every(depId => processed.has(depId));

        if (dependenciesMet) {
          currentGroup.push(step);
          processed.add(step.skillId);
          remaining.delete(step.skillId);
        }
      }

      if (currentGroup.length === 0) {
        // Circular dependency or missing dependency - add remaining
        for (const step of steps) {
          if (remaining.has(step.skillId)) {
            currentGroup.push(step);
            processed.add(step.skillId);
            remaining.delete(step.skillId);
          }
        }
      }

      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      } else {
        break; // Prevent infinite loop
      }
    }

    return groups;
  }
}

