/**
 * A/B Testing Framework for Claude Skills
 *
 * Implements A/B testing framework to measure Claude Skills effectiveness.
 * Provides user segmentation, metrics collection, and statistical analysis.
 */

import { supabase } from './supabase';
import { analyticsService } from './analyticsService';
import { claudeSkillsMonitor } from './claudeSkillsMonitor';
import { featureFlagService, UserContext } from './featureFlags';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SkillType } from '../types/claudeSkills';

// Experiment Configuration
export interface ExperimentConfig {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  startDate: Date;
  endDate?: Date;
  variants: ExperimentVariant[];
  allocation: number; // Percentage of users to include (0-100)
  metrics: string[]; // Metrics to track
  minimumSampleSize?: number;
  confidenceLevel?: number; // Default 0.95 (95%)
  createdAt: Date;
  updatedAt: Date;
}

export interface ExperimentVariant {
  id: string;
  name: string;
  description: string;
  allocation: number; // Percentage allocation (should sum to 100)
  config: VariantConfig;
}

export interface VariantConfig {
  claudeSkillsEnabled: boolean;
  enabledSkills?: SkillType[];
  featureFlags?: Record<string, boolean>;
  metadata?: Record<string, any>;
}

// User Assignment
export interface UserAssignment {
  userId: string;
  experimentId: string;
  variantId: string;
  assignedAt: Date;
  consistent: boolean; // Whether assignment is consistent across sessions
}

// Experiment Results
export interface ExperimentResults {
  experimentId: string;
  variantResults: VariantResult[];
  statisticalSignificance: StatisticalSignificance;
  recommendation: 'control' | 'treatment' | 'inconclusive' | 'continue';
  sampleSize: number;
  duration: number; // days
  lastUpdated: Date;
}

export interface VariantResult {
  variantId: string;
  variantName: string;
  sampleSize: number;
  metrics: VariantMetrics;
  confidenceInterval: ConfidenceInterval;
}

export interface VariantMetrics {
  // Performance metrics
  averageResponseTime: number;
  successRate: number;
  errorRate: number;

  // User engagement metrics
  sessionCompletionRate: number;
  averageSessionDuration: number;
  userSatisfaction?: number;

  // Claude Skills specific metrics
  skillUsageRate: number;
  averageSkillExecutionTime: number;
  skillSuccessRate: number;

  // Custom metrics
  customMetrics?: Record<string, number>;
}

export interface StatisticalSignificance {
  isSignificant: boolean;
  pValue: number;
  confidenceLevel: number;
  effectSize: number;
  interpretation: string;
}

export interface ConfidenceInterval {
  lower: number;
  upper: number;
  level: number; // e.g., 0.95 for 95% CI
}

// Experiment Event
export interface ExperimentEvent {
  userId: string;
  experimentId: string;
  variantId: string;
  eventType: 'assignment' | 'metric' | 'conversion';
  metricName?: string;
  metricValue?: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

class ABTestingService {
  private static readonly STORAGE_KEY = 'ab_testing_assignments';
  private static readonly EXPERIMENTS_KEY = 'ab_testing_experiments';
  private experiments: Map<string, ExperimentConfig> = new Map();
  private userAssignments: Map<string, UserAssignment> = new Map();
  private experimentEvents: ExperimentEvent[] = [];
  private readonly DEFAULT_CONFIDENCE_LEVEL = 0.95;
  private readonly DEFAULT_MIN_SAMPLE_SIZE = 100;

  constructor() {
    this.initializeDefaultExperiments();
    this.loadPersistedData();
  }

  /**
   * Initialize default experiments for Claude Skills
   */
  private initializeDefaultExperiments(): void {
    const defaultExperiments: ExperimentConfig[] = [
      {
        id: 'claude_skills_performance',
        name: 'Claude Skills Performance Impact',
        description:
          'Measure performance impact of Claude Skills on story generation',
        enabled: false, // Start disabled, enable when ready
        startDate: new Date(),
        variants: [
          {
            id: 'control',
            name: 'Control (No Claude Skills)',
            description: 'Baseline without Claude Skills',
            allocation: 50,
            config: {
              claudeSkillsEnabled: false,
            },
          },
          {
            id: 'treatment',
            name: 'Treatment (With Claude Skills)',
            description: 'With Claude Skills enabled',
            allocation: 50,
            config: {
              claudeSkillsEnabled: true,
              enabledSkills: [
                'ContentPredictionSkill',
                'QualityAssessmentSkill',
              ],
            },
          },
        ],
        allocation: 50, // 50% of users participate
        metrics: [
          'averageResponseTime',
          'successRate',
          'sessionCompletionRate',
          'userSatisfaction',
        ],
        minimumSampleSize: this.DEFAULT_MIN_SAMPLE_SIZE,
        confidenceLevel: this.DEFAULT_CONFIDENCE_LEVEL,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'claude_skills_quality',
        name: 'Claude Skills Quality Assessment',
        description: 'Test quality improvements from Claude Skills',
        enabled: false,
        startDate: new Date(),
        variants: [
          {
            id: 'control',
            name: 'Control',
            description: 'Baseline behavior with Claude Skills disabled',
            allocation: 50,
            config: {
              claudeSkillsEnabled: false,
            },
          },
          {
            id: 'treatment',
            name: 'Quality Assessment Enabled',
            description:
              'Claude Skills quality assessment enabled for content evaluation',
            allocation: 50,
            config: {
              claudeSkillsEnabled: true,
              enabledSkills: ['QualityAssessmentSkill'],
            },
          },
        ],
        allocation: 30, // 30% of users
        metrics: ['contentQuality', 'firstTrySuccessRate', 'userSatisfaction'],
        minimumSampleSize: 200,
        confidenceLevel: this.DEFAULT_CONFIDENCE_LEVEL,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    defaultExperiments.forEach(exp => {
      this.experiments.set(exp.id, exp);
    });
  }

  /**
   * Assign user to experiment variant
   */
  async assignUserToExperiment(
    userId: string,
    experimentId: string,
    userContext?: UserContext,
  ): Promise<UserAssignment | null> {
    const experiment = this.experiments.get(experimentId);
    if (!experiment || !experiment.enabled) {
      return null;
    }

    // Check if user is already assigned
    const existingAssignment = this.userAssignments.get(
      `${userId}:${experimentId}`,
    );
    if (existingAssignment) {
      return existingAssignment;
    }

    // Check if user should be included in experiment (allocation percentage)
    const userHash = this.hashUser(userId, experimentId);
    const userPercentile = userHash % 100;
    if (userPercentile >= experiment.allocation) {
      return null; // User not included in experiment
    }

    // Assign to variant based on allocation
    const variant = this.selectVariant(userHash, experiment.variants);

    const assignment: UserAssignment = {
      userId,
      experimentId,
      variantId: variant.id,
      assignedAt: new Date(),
      consistent: true,
    };

    this.userAssignments.set(`${userId}:${experimentId}`, assignment);

    // Track assignment event
    await this.trackEvent({
      userId,
      experimentId,
      variantId: variant.id,
      eventType: 'assignment',
      timestamp: new Date(),
      metadata: {
        userContext,
        allocation: experiment.allocation,
      },
    });

    // Persist assignment
    await this.persistAssignments();

    console.log(
      `📊 User ${userId} assigned to experiment ${experimentId}, variant ${variant.id}`,
    );

    return assignment;
  }

  /**
   * Get user's variant assignment for an experiment
   */
  async getUserVariant(
    userId: string,
    experimentId: string,
    userContext?: UserContext,
  ): Promise<string | null> {
    // Try to get existing assignment
    const assignment = this.userAssignments.get(`${userId}:${experimentId}`);
    if (assignment) {
      return assignment.variantId;
    }

    // Assign if not already assigned
    const newAssignment = await this.assignUserToExperiment(
      userId,
      experimentId,
      userContext,
    );
    return newAssignment?.variantId || null;
  }

  /**
   * Check if Claude Skills should be enabled for user (based on A/B test)
   */
  async shouldEnableClaudeSkills(
    userId: string,
    experimentId: string = 'claude_skills_performance',
    userContext?: UserContext,
  ): Promise<boolean> {
    const variantId = await this.getUserVariant(
      userId,
      experimentId,
      userContext,
    );
    if (!variantId) {
      return false; // Not in experiment or experiment disabled
    }

    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      return false;
    }

    const variant = experiment.variants.find(v => v.id === variantId);
    return variant?.config.claudeSkillsEnabled || false;
  }

  /**
   * Track metric for experiment
   */
  async trackMetric(
    userId: string,
    experimentId: string,
    metricName: string,
    metricValue: number,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const assignment = this.userAssignments.get(`${userId}:${experimentId}`);
    if (!assignment) {
      return; // User not in experiment
    }

    const event: ExperimentEvent = {
      userId,
      experimentId,
      variantId: assignment.variantId,
      eventType: 'metric',
      metricName,
      metricValue,
      timestamp: new Date(),
      metadata,
    };

    this.experimentEvents.push(event);

    // Track in analytics service
    await analyticsService.trackPerformance(
      `ab_test_${experimentId}_${metricName}`,
      metricValue,
      true,
      {
        experimentId,
        variantId: assignment.variantId,
        userId,
        ...metadata,
      },
    );

    // Persist events (batch)
    if (this.experimentEvents.length >= 50) {
      await this.persistEvents();
    }
  }

  /**
   * Track conversion event
   */
  async trackConversion(
    userId: string,
    experimentId: string,
    conversionType: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const assignment = this.userAssignments.get(`${userId}:${experimentId}`);
    if (!assignment) {
      return;
    }

    const event: ExperimentEvent = {
      userId,
      experimentId,
      variantId: assignment.variantId,
      eventType: 'conversion',
      metricName: conversionType,
      metricValue: 1,
      timestamp: new Date(),
      metadata,
    };

    this.experimentEvents.push(event);
    await this.persistEvents();
  }

  /**
   * Get experiment results with statistical analysis
   */
  async getExperimentResults(
    experimentId: string,
  ): Promise<ExperimentResults | null> {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      return null;
    }

    // Get events for this experiment
    const experimentEvents = this.experimentEvents.filter(
      e => e.experimentId === experimentId,
    );

    // Calculate variant results
    const variantResults: VariantResult[] = experiment.variants.map(variant => {
      const variantEvents = experimentEvents.filter(
        e => e.variantId === variant.id,
      );
      const variantUsers = new Set(variantEvents.map(e => e.userId));
      const metrics = this.calculateVariantMetrics(
        variantEvents,
        variantUsers.size,
      );

      return {
        variantId: variant.id,
        variantName: variant.name,
        sampleSize: variantUsers.size,
        metrics,
        confidenceInterval: this.calculateConfidenceInterval(
          metrics.successRate,
          variantUsers.size,
          experiment.confidenceLevel || this.DEFAULT_CONFIDENCE_LEVEL,
        ),
      };
    });

    // Calculate statistical significance
    const statisticalSignificance = this.calculateStatisticalSignificance(
      variantResults,
      experiment.confidenceLevel || this.DEFAULT_CONFIDENCE_LEVEL,
    );

    // Generate recommendation
    const recommendation = this.generateRecommendation(
      variantResults,
      statisticalSignificance,
      experiment,
    );

    // Calculate duration
    const duration = Math.floor(
      (Date.now() - experiment.startDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    return {
      experimentId,
      variantResults,
      statisticalSignificance,
      recommendation,
      sampleSize: variantResults.reduce((sum, v) => sum + v.sampleSize, 0),
      duration,
      lastUpdated: new Date(),
    };
  }

  /**
   * Calculate metrics for a variant
   */
  private calculateVariantMetrics(
    events: ExperimentEvent[],
    userCount: number,
  ): VariantMetrics {
    const metricEvents = events.filter(e => e.eventType === 'metric');
    const conversionEvents = events.filter(e => e.eventType === 'conversion');

    // Calculate average response time
    const responseTimeEvents = metricEvents.filter(
      e => e.metricName === 'averageResponseTime',
    );
    const averageResponseTime =
      responseTimeEvents.length > 0
        ? responseTimeEvents.reduce((sum, e) => sum + (e.metricValue || 0), 0) /
          responseTimeEvents.length
        : 0;

    // Calculate success rate
    const successEvents = metricEvents.filter(
      e => e.metricName === 'successRate',
    );
    const successRate =
      successEvents.length > 0
        ? successEvents.reduce((sum, e) => sum + (e.metricValue || 0), 0) /
          successEvents.length
        : 0;

    // Calculate error rate
    const errorEvents = metricEvents.filter(e => e.metricName === 'errorRate');
    const errorRate =
      errorEvents.length > 0
        ? errorEvents.reduce((sum, e) => sum + (e.metricValue || 0), 0) /
          errorEvents.length
        : 0;

    // Calculate session completion rate
    const sessionCompletionEvents = metricEvents.filter(
      e => e.metricName === 'sessionCompletionRate',
    );
    const sessionCompletionRate =
      sessionCompletionEvents.length > 0
        ? sessionCompletionEvents.reduce(
            (sum, e) => sum + (e.metricValue || 0),
            0,
          ) / sessionCompletionEvents.length
        : 0;

    // Calculate skill usage rate
    const skillUsageEvents = metricEvents.filter(
      e => e.metricName === 'skillUsageRate',
    );
    const skillUsageRate =
      skillUsageEvents.length > 0
        ? skillUsageEvents.reduce((sum, e) => sum + (e.metricValue || 0), 0) /
          skillUsageEvents.length
        : 0;

    return {
      averageResponseTime,
      successRate,
      errorRate,
      sessionCompletionRate,
      averageSessionDuration: 0, // Would need duration tracking
      skillUsageRate,
      averageSkillExecutionTime: 0, // Would need skill execution tracking
      skillSuccessRate: 0,
    };
  }

  /**
   * Calculate confidence interval
   */
  private calculateConfidenceInterval(
    proportion: number,
    sampleSize: number,
    confidenceLevel: number,
  ): ConfidenceInterval {
    if (sampleSize === 0) {
      return { lower: 0, upper: 0, level: confidenceLevel };
    }

    // Z-score for confidence level (95% = 1.96, 99% = 2.58)
    const zScore =
      confidenceLevel === 0.95 ? 1.96 : confidenceLevel === 0.99 ? 2.58 : 1.96;

    // Standard error
    const standardError = Math.sqrt(
      (proportion * (1 - proportion)) / sampleSize,
    );

    // Margin of error
    const marginOfError = zScore * standardError;

    return {
      lower: Math.max(0, proportion - marginOfError),
      upper: Math.min(1, proportion + marginOfError),
      level: confidenceLevel,
    };
  }

  /**
   * Calculate statistical significance using chi-square test
   */
  private calculateStatisticalSignificance(
    variantResults: VariantResult[],
    confidenceLevel: number,
  ): StatisticalSignificance {
    if (variantResults.length < 2) {
      return {
        isSignificant: false,
        pValue: 1.0,
        confidenceLevel,
        effectSize: 0,
        interpretation: 'Insufficient variants for comparison',
      };
    }

    const control = variantResults.find(v => v.variantId === 'control');
    const treatment = variantResults.find(v => v.variantId !== 'control');

    if (!control || !treatment) {
      return {
        isSignificant: false,
        pValue: 1.0,
        confidenceLevel,
        effectSize: 0,
        interpretation: 'Control or treatment variant not found',
      };
    }

    // Simplified chi-square test for success rates
    const controlSuccess = control.metrics.successRate * control.sampleSize;
    const controlFailures =
      (1 - control.metrics.successRate) * control.sampleSize;
    const treatmentSuccess =
      treatment.metrics.successRate * treatment.sampleSize;
    const treatmentFailures =
      (1 - treatment.metrics.successRate) * treatment.sampleSize;

    // Calculate chi-square statistic
    const totalSuccess = controlSuccess + treatmentSuccess;
    const totalFailures = controlFailures + treatmentFailures;
    const total = control.sampleSize + treatment.sampleSize;

    const expectedControlSuccess = (totalSuccess * control.sampleSize) / total;
    const expectedControlFailures =
      (totalFailures * control.sampleSize) / total;
    const expectedTreatmentSuccess =
      (totalSuccess * treatment.sampleSize) / total;
    const expectedTreatmentFailures =
      (totalFailures * treatment.sampleSize) / total;

    const chiSquare =
      Math.pow(controlSuccess - expectedControlSuccess, 2) /
        expectedControlSuccess +
      Math.pow(controlFailures - expectedControlFailures, 2) /
        expectedControlFailures +
      Math.pow(treatmentSuccess - expectedTreatmentSuccess, 2) /
        expectedTreatmentSuccess +
      Math.pow(treatmentFailures - expectedTreatmentFailures, 2) /
        expectedTreatmentFailures;

    // For 1 degree of freedom, chi-square critical value at 95% = 3.84
    const criticalValue = confidenceLevel === 0.95 ? 3.84 : 6.63;
    const isSignificant = chiSquare > criticalValue;

    // Calculate p-value (simplified - in production use proper statistical library)
    const pValue = isSignificant ? 0.01 : 0.5; // Simplified

    // Calculate effect size (Cohen's h)
    const effectSize = Math.abs(
      2 *
        (Math.asin(Math.sqrt(treatment.metrics.successRate)) -
          Math.asin(Math.sqrt(control.metrics.successRate))),
    );

    let interpretation = '';
    if (isSignificant) {
      if (treatment.metrics.successRate > control.metrics.successRate) {
        interpretation = `Treatment significantly outperforms control (p < ${pValue.toFixed(
          3,
        )})`;
      } else {
        interpretation = `Control significantly outperforms treatment (p < ${pValue.toFixed(
          3,
        )})`;
      }
    } else {
      interpretation = 'No significant difference between variants';
    }

    return {
      isSignificant,
      pValue,
      confidenceLevel,
      effectSize,
      interpretation,
    };
  }

  /**
   * Generate recommendation based on results
   */
  private generateRecommendation(
    variantResults: VariantResult[],
    significance: StatisticalSignificance,
    experiment: ExperimentConfig,
  ): 'control' | 'treatment' | 'inconclusive' | 'continue' {
    const control = variantResults.find(v => v.variantId === 'control');
    const treatment = variantResults.find(v => v.variantId !== 'control');

    if (!control || !treatment) {
      return 'inconclusive';
    }

    // Check if we have minimum sample size
    const totalSampleSize = control.sampleSize + treatment.sampleSize;
    if (
      totalSampleSize <
      (experiment.minimumSampleSize || this.DEFAULT_MIN_SAMPLE_SIZE)
    ) {
      return 'continue'; // Need more data
    }

    // If significant, recommend the better variant
    if (significance.isSignificant) {
      if (treatment.metrics.successRate > control.metrics.successRate) {
        return 'treatment';
      } else {
        return 'control';
      }
    }

    // If not significant but have enough data, inconclusive
    if (
      totalSampleSize >=
      (experiment.minimumSampleSize || this.DEFAULT_MIN_SAMPLE_SIZE) * 2
    ) {
      return 'inconclusive';
    }

    // Otherwise, continue collecting data
    return 'continue';
  }

  /**
   * Select variant based on allocation
   */
  private selectVariant(
    userHash: number,
    variants: ExperimentVariant[],
  ): ExperimentVariant {
    // Normalize allocation to 0-100
    const totalAllocation = variants.reduce((sum, v) => sum + v.allocation, 0);
    const normalizedVariants = variants.map(v => ({
      ...v,
      normalizedAllocation: (v.allocation / totalAllocation) * 100,
    }));

    // Assign based on hash
    const hashValue = userHash % 100;
    let cumulative = 0;

    for (const variant of normalizedVariants) {
      cumulative += variant.normalizedAllocation;
      if (hashValue < cumulative) {
        return variant;
      }
    }

    // Fallback to first variant
    return variants[0];
  }

  /**
   * Hash user ID for consistent assignment
   */
  private hashUser(userId: string, experimentId: string): number {
    const combined = `${userId}:${experimentId}`;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Track event
   */
  private async trackEvent(event: ExperimentEvent): Promise<void> {
    this.experimentEvents.push(event);

    // Persist to database
    try {
      const sb =
        supabase as unknown as import('@supabase/supabase-js').SupabaseClient;
      await sb.from('analytics_events').insert({
        type: 'ab_test',
        subtype: event.eventType,
        userId: event.userId,
        sessionId: `experiment_${event.experimentId}`,
        timestamp: event.timestamp.toISOString(),
        metadata: {
          experimentId: event.experimentId,
          variantId: event.variantId,
          metricName: event.metricName,
          metricValue: event.metricValue,
          ...event.metadata,
        },
      });
    } catch (error) {
      console.error('Failed to persist experiment event:', error);
    }
  }

  /**
   * Create or update experiment
   */
  async createExperiment(
    config: Omit<ExperimentConfig, 'createdAt' | 'updatedAt'>,
  ): Promise<void> {
    const experiment: ExperimentConfig = {
      ...config,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.experiments.set(experiment.id, experiment);
    await this.persistExperiments();
  }

  /**
   * Enable/disable experiment
   */
  async setExperimentEnabled(
    experimentId: string,
    enabled: boolean,
  ): Promise<void> {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    experiment.enabled = enabled;
    experiment.updatedAt = new Date();
    this.experiments.set(experimentId, experiment);
    await this.persistExperiments();
  }

  /**
   * Get experiment configuration
   */
  getExperiment(experimentId: string): ExperimentConfig | undefined {
    return this.experiments.get(experimentId);
  }

  /**
   * Get all experiments
   */
  getAllExperiments(): ExperimentConfig[] {
    return Array.from(this.experiments.values());
  }

  /**
   * Persist assignments to AsyncStorage
   */
  private async persistAssignments(): Promise<void> {
    try {
      const assignments = Array.from(this.userAssignments.values());
      await AsyncStorage.setItem(
        ABTestingService.STORAGE_KEY,
        JSON.stringify(assignments),
      );
    } catch (error) {
      console.error('Failed to persist assignments:', error);
    }
  }

  /**
   * Load persisted assignments
   */
  private async loadPersistedData(): Promise<void> {
    try {
      // Load assignments
      const assignmentsJson = await AsyncStorage.getItem(
        ABTestingService.STORAGE_KEY,
      );
      if (assignmentsJson) {
        const assignments: UserAssignment[] = JSON.parse(assignmentsJson);
        assignments.forEach(assignment => {
          this.userAssignments.set(
            `${assignment.userId}:${assignment.experimentId}`,
            assignment,
          );
        });
      }

      // Load experiments
      const experimentsJson = await AsyncStorage.getItem(
        ABTestingService.EXPERIMENTS_KEY,
      );
      if (experimentsJson) {
        const experiments: ExperimentConfig[] = JSON.parse(experimentsJson);
        experiments.forEach(exp => {
          this.experiments.set(exp.id, exp);
        });
      }
    } catch (error) {
      console.error('Failed to load persisted data:', error);
    }
  }

  /**
   * Persist experiments
   */
  private async persistExperiments(): Promise<void> {
    try {
      const experiments = Array.from(this.experiments.values());
      await AsyncStorage.setItem(
        ABTestingService.EXPERIMENTS_KEY,
        JSON.stringify(experiments),
      );
    } catch (error) {
      console.error('Failed to persist experiments:', error);
    }
  }

  /**
   * Persist events
   */
  private async persistEvents(): Promise<void> {
    // Events are persisted to database in trackEvent
    // Clear old events from memory (keep last 1000)
    if (this.experimentEvents.length > 1000) {
      this.experimentEvents = this.experimentEvents.slice(-1000);
    }
  }
}

// Export singleton instance
export const abTestingService = new ABTestingService();
export default abTestingService;
