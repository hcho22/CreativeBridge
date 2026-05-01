/**
 * Dynamic UI Coordinator Service
 *
 * Central coordination service for all UI optimization components
 * Task 7.2: Dynamic UI Optimization - Integration Layer
 */

import { structuredLogger } from '../utils/logger';
import {
  uiPerformanceMonitor,
  UIPerformanceMetric,
  OptimizationRecommendation,
} from './uiPerformanceMonitor';
import {
  engagementOptimizer,
  EngagementMetric,
  EngagementOptimization,
} from './engagementOptimizer';
import {
  navigationOptimizer,
  NavigationEvent,
  NavigationOptimization,
} from './navigationOptimizer';
import {
  readingComprehensionOptimizer,
  ReadingEvent,
  ReadingOptimization,
} from './readingComprehensionOptimizer';
import { behaviorAnalytics } from './behaviorAnalytics';
import { GradeLevel } from '../types/database';

export interface UIOptimizationState {
  overall: {
    health: 'excellent' | 'good' | 'fair' | 'poor';
    lastUpdate: number;
    activeOptimizations: number;
  };
  performance: {
    score: number; // 0-1
    criticalIssues: number;
    averageRenderTime: number;
    memoryUsage: number;
  };
  engagement: {
    score: number; // 0-1
    trend: 'increasing' | 'stable' | 'decreasing';
    indicators: string[];
  };
  navigation: {
    efficiency: number; // 0-1
    strugglingPatterns: number;
    optimizationOpportunities: number;
  };
  reading: {
    comprehensionScore: number; // 0-1
    readingSpeed: number; // WPM
    strugglingIndicators: number;
    supportLevel: 'minimal' | 'moderate' | 'intensive';
  };
}

export interface CoordinatedOptimization {
  id: string;
  type: 'performance' | 'engagement' | 'navigation' | 'reading' | 'combined';
  priority: number;
  components: string[]; // Which optimizers are involved
  expectedImpact: number;
  implementation: {
    performanceActions?: OptimizationRecommendation[];
    engagementActions?: EngagementOptimization[];
    navigationActions?: NavigationOptimization[];
    readingActions?: ReadingOptimization[];
  };
  dependencies: string[]; // Other optimizations this depends on
  conflicts: string[]; // Other optimizations that conflict with this
  status:
    | 'pending'
    | 'applying'
    | 'applied'
    | 'measuring'
    | 'completed'
    | 'failed';
  appliedAt?: number;
  effectiveness?: number;
}

interface CoordinatorConfig {
  enabled: boolean;
  coordinationInterval: number; // milliseconds
  optimizationCooldown: number; // minimum time between optimizations
  maxConcurrentOptimizations: number;
  priorityThresholds: {
    critical: number; // Auto-apply above this priority
    high: number;
    medium: number;
  };
  integrationSettings: {
    performanceWeight: number; // 0-1
    engagementWeight: number; // 0-1
    navigationWeight: number; // 0-1
    readingWeight: number; // 0-1
  };
}

const DEFAULT_CONFIG: CoordinatorConfig = {
  enabled: true,
  coordinationInterval: 60000, // 1 minute
  optimizationCooldown: 300000, // 5 minutes
  maxConcurrentOptimizations: 3,
  priorityThresholds: {
    critical: 4.5,
    high: 3.5,
    medium: 2.5,
  },
  integrationSettings: {
    performanceWeight: 0.3,
    engagementWeight: 0.3,
    navigationWeight: 0.2,
    readingWeight: 0.2,
  },
};

class DynamicUICoordinatorService {
  private config: CoordinatorConfig;
  private optimizations: CoordinatedOptimization[] = [];
  private sessionId: string | null = null;
  private gradeLevel: GradeLevel = '3-5';
  private coordinationTimer: NodeJS.Timeout | null = null;
  private lastOptimizationTime: number = 0;
  private isInitialized = false;

  constructor(config: Partial<CoordinatorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the dynamic UI coordinator
   */
  async initialize(
    sessionId: string,
    gradeLevel: GradeLevel,
    initialScreen: string,
  ): Promise<void> {
    try {
      this.sessionId = sessionId;
      this.gradeLevel = gradeLevel;

      // Initialize all optimization services
      await Promise.all([
        uiPerformanceMonitor.initialize(sessionId),
        engagementOptimizer.initialize(sessionId, gradeLevel),
        navigationOptimizer.initialize(sessionId, initialScreen, gradeLevel),
        readingComprehensionOptimizer.initialize(sessionId, gradeLevel),
      ]);

      // Start coordination
      if (this.config.enabled) {
        this.startCoordination();
      }

      this.isInitialized = true;

      structuredLogger.info('Dynamic UI Coordinator initialized', {
        sessionId,
        gradeLevel,
        initialScreen,
        coordinationInterval: this.config.coordinationInterval,
        maxConcurrentOptimizations: this.config.maxConcurrentOptimizations,
      });
    } catch (error) {
      structuredLogger.error(
        'Failed to initialize Dynamic UI Coordinator',
        {},
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Get current optimization state
   */
  getOptimizationState(): UIOptimizationState {
    if (!this.isInitialized) {
      return this.getDefaultState();
    }

    const performanceSummary = uiPerformanceMonitor.getPerformanceSummary();
    const engagementState = engagementOptimizer.getCurrentEngagementState();
    const navigationMetrics = navigationOptimizer.getNavigationMetrics();
    const readingMetrics =
      readingComprehensionOptimizer.getCurrentComprehensionMetrics();

    const overallHealth = this.calculateOverallHealth(
      performanceSummary,
      engagementState,
      navigationMetrics,
      readingMetrics,
    );

    return {
      overall: {
        health: overallHealth,
        lastUpdate: Date.now(),
        activeOptimizations: this.optimizations.filter(o =>
          ['applying', 'applied', 'measuring'].includes(o.status),
        ).length,
      },
      performance: {
        score: this.calculatePerformanceScore(performanceSummary),
        criticalIssues: performanceSummary.criticalIssues,
        averageRenderTime: performanceSummary.averageRenderTime,
        memoryUsage: performanceSummary.memoryUsage,
      },
      engagement: {
        score: engagementState.score,
        trend: engagementState.trend,
        indicators: engagementState.indicators,
      },
      navigation: {
        efficiency: navigationMetrics.optimalPathAdherence,
        strugglingPatterns: Object.values(
          navigationMetrics.backNavigationFrequency,
        ).filter(freq => freq > 0.3).length,
        optimizationOpportunities:
          navigationOptimizer.getNavigationOptimizations(false).length,
      },
      reading: {
        comprehensionScore: readingMetrics.comprehensionScore,
        readingSpeed: readingMetrics.readingSpeed,
        strugglingIndicators: readingMetrics.strugglingIndicators.length,
        supportLevel: this.determineSupportLevel(readingMetrics),
      },
    };
  }

  /**
   * Get coordinated optimizations
   */
  getCoordinatedOptimizations(
    status?: CoordinatedOptimization['status'],
  ): CoordinatedOptimization[] {
    let optimizations = this.optimizations;

    if (status) {
      optimizations = optimizations.filter(o => o.status === status);
    }

    return optimizations.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Apply coordinated optimization
   */
  async applyCoordinatedOptimization(optimizationId: string): Promise<boolean> {
    try {
      const optimization = this.optimizations.find(
        o => o.id === optimizationId,
      );
      if (!optimization || optimization.status !== 'pending') {
        structuredLogger.warn('Coordinated optimization not available', {
          optimizationId,
          currentStatus: optimization?.status,
        });
        return false;
      }

      // Check cooldown
      if (
        Date.now() - this.lastOptimizationTime <
        this.config.optimizationCooldown
      ) {
        structuredLogger.info('Optimization skipped due to cooldown', {
          optimizationId,
          cooldownRemaining:
            this.config.optimizationCooldown -
            (Date.now() - this.lastOptimizationTime),
        });
        return false;
      }

      // Check concurrent optimizations limit
      const activeOptimizations = this.optimizations.filter(o =>
        ['applying', 'applied', 'measuring'].includes(o.status),
      ).length;

      if (activeOptimizations >= this.config.maxConcurrentOptimizations) {
        structuredLogger.info('Optimization skipped due to concurrent limit', {
          optimizationId,
          activeOptimizations,
          maxConcurrent: this.config.maxConcurrentOptimizations,
        });
        return false;
      }

      optimization.status = 'applying';

      // Apply optimizations across components
      const results = await Promise.all([
        this.applyPerformanceOptimizations(
          optimization.implementation.performanceActions || [],
        ),
        this.applyEngagementOptimizations(
          optimization.implementation.engagementActions || [],
        ),
        this.applyNavigationOptimizations(
          optimization.implementation.navigationActions || [],
        ),
        this.applyReadingOptimizations(
          optimization.implementation.readingActions || [],
        ),
      ]);

      const allSucceeded = results.every(result => result);

      if (allSucceeded) {
        optimization.status = 'applied';
        optimization.appliedAt = Date.now();
        this.lastOptimizationTime = Date.now();

        structuredLogger.info('Coordinated optimization applied successfully', {
          optimizationId,
          type: optimization.type,
          components: optimization.components,
          expectedImpact: optimization.expectedImpact,
        });
      } else {
        optimization.status = 'failed';
        structuredLogger.error('Coordinated optimization failed', {
          optimizationId,
          results,
        });
      }

      return allSucceeded;
    } catch (error) {
      const optimization = this.optimizations.find(
        o => o.id === optimizationId,
      );
      if (optimization) {
        optimization.status = 'failed';
      }

      structuredLogger.error(
        'Failed to apply coordinated optimization',
        { optimizationId },
        error as Error,
      );
      return false;
    }
  }

  /**
   * Get optimization effectiveness summary
   */
  getOptimizationEffectiveness(): {
    overall: number;
    byType: Record<string, number>;
    byComponent: Record<string, number>;
    recentOptimizations: Array<{
      id: string;
      type: string;
      effectiveness: number;
      appliedAt: number;
    }>;
  } {
    const completedOptimizations = this.optimizations.filter(
      o => o.effectiveness !== undefined,
    );

    const overall =
      completedOptimizations.length > 0
        ? completedOptimizations.reduce(
            (sum, o) => sum + (o.effectiveness || 0),
            0,
          ) / completedOptimizations.length
        : 0;

    // Group by type
    const byType: Record<string, number> = {};
    completedOptimizations.forEach(o => {
      if (!byType[o.type]) {
        byType[o.type] = 0;
      }
      byType[o.type] += o.effectiveness || 0;
    });

    Object.keys(byType).forEach(type => {
      const count = completedOptimizations.filter(o => o.type === type).length;
      if (count > 0) {
        byType[type] /= count;
      }
    });

    // Group by component
    const byComponent: Record<string, number> = {};
    completedOptimizations.forEach(o => {
      o.components.forEach(component => {
        if (!byComponent[component]) {
          byComponent[component] = 0;
        }
        byComponent[component] += o.effectiveness || 0;
      });
    });

    Object.keys(byComponent).forEach(component => {
      const count = completedOptimizations.filter(o =>
        o.components.includes(component),
      ).length;
      if (count > 0) {
        byComponent[component] /= count;
      }
    });

    // Recent optimizations
    const recentOptimizations = completedOptimizations
      .filter(o => Date.now() - (o.appliedAt || 0) < 3600000) // Last hour
      .map(o => ({
        id: o.id,
        type: o.type,
        effectiveness: o.effectiveness || 0,
        appliedAt: o.appliedAt!,
      }))
      .sort((a, b) => b.appliedAt - a.appliedAt);

    return {
      overall,
      byType,
      byComponent,
      recentOptimizations,
    };
  }

  /**
   * Private helper methods
   */
  private startCoordination(): void {
    this.coordinationTimer = setInterval(() => {
      this.performCoordination();
    }, this.config.coordinationInterval);
  }

  private async performCoordination(): Promise<void> {
    try {
      // Analyze current state across all components
      const currentState = this.getOptimizationState();

      // Generate coordinated optimizations
      await this.generateCoordinatedOptimizations(currentState);

      // Auto-apply critical optimizations
      await this.autoApplyCriticalOptimizations();

      // Measure effectiveness of applied optimizations
      this.measureCoordinatedEffectiveness();

      // Clean up old optimizations
      this.cleanupOptimizations();

      structuredLogger.debug('UI coordination completed', {
        overallHealth: currentState.overall.health,
        activeOptimizations: currentState.overall.activeOptimizations,
        pendingOptimizations: this.optimizations.filter(
          o => o.status === 'pending',
        ).length,
      });
    } catch (error) {
      structuredLogger.error('UI coordination failed', {}, error as Error);
    }
  }

  private async generateCoordinatedOptimizations(
    state: UIOptimizationState,
  ): Promise<void> {
    // Generate performance-focused optimizations
    if (state.performance.score < 0.7 || state.performance.criticalIssues > 0) {
      this.createPerformanceOptimization(state);
    }

    // Generate engagement-focused optimizations
    if (
      state.engagement.score < 0.6 ||
      state.engagement.trend === 'decreasing'
    ) {
      this.createEngagementOptimization(state);
    }

    // Generate navigation optimizations
    if (
      state.navigation.efficiency < 0.7 ||
      state.navigation.strugglingPatterns > 2
    ) {
      this.createNavigationOptimization(state);
    }

    // Generate reading comprehension optimizations
    if (
      state.reading.comprehensionScore < 0.7 ||
      state.reading.strugglingIndicators > 2
    ) {
      this.createReadingOptimization(state);
    }

    // Generate combined optimizations for complex issues
    if (this.shouldCreateCombinedOptimization(state)) {
      this.createCombinedOptimization(state);
    }
  }

  private createPerformanceOptimization(state: UIOptimizationState): void {
    const performanceInsights = uiPerformanceMonitor.getPerformanceInsights();

    if (performanceInsights.recommendations.length > 0) {
      const optimization: CoordinatedOptimization = {
        id: this.generateOptimizationId(),
        type: 'performance',
        priority: state.performance.criticalIssues > 0 ? 5 : 3,
        components: ['performance'],
        expectedImpact: 0.4,
        implementation: {
          performanceActions: performanceInsights.recommendations.slice(0, 3), // Top 3
        },
        dependencies: [],
        conflicts: [],
        status: 'pending',
      };

      this.optimizations.push(optimization);
    }
  }

  private createEngagementOptimization(state: UIOptimizationState): void {
    const engagementPatterns = engagementOptimizer.getEngagementPatterns();
    const relevantOptimizations = engagementPatterns
      .flatMap(p => p.recommendedActions)
      .filter(o => o.priority >= 3)
      .slice(0, 2);

    if (relevantOptimizations.length > 0) {
      const optimization: CoordinatedOptimization = {
        id: this.generateOptimizationId(),
        type: 'engagement',
        priority: state.engagement.score < 0.4 ? 4 : 3,
        components: ['engagement'],
        expectedImpact: 0.3,
        implementation: {
          engagementActions: relevantOptimizations,
        },
        dependencies: [],
        conflicts: [],
        status: 'pending',
      };

      this.optimizations.push(optimization);
    }
  }

  private createNavigationOptimization(state: UIOptimizationState): void {
    const navigationOptimizations = navigationOptimizer
      .getNavigationOptimizations(false)
      .filter(o => o.priority >= 3)
      .slice(0, 2);

    if (navigationOptimizations.length > 0) {
      const optimization: CoordinatedOptimization = {
        id: this.generateOptimizationId(),
        type: 'navigation',
        priority: state.navigation.efficiency < 0.5 ? 4 : 3,
        components: ['navigation'],
        expectedImpact: 0.3,
        implementation: {
          navigationActions: navigationOptimizations,
        },
        dependencies: [],
        conflicts: [],
        status: 'pending',
      };

      this.optimizations.push(optimization);
    }
  }

  private createReadingOptimization(state: UIOptimizationState): void {
    const readingPatterns = readingComprehensionOptimizer.getReadingPatterns();
    const relevantOptimizations = readingPatterns
      .flatMap(p => p.recommendedOptimizations)
      .filter(o => o.priority >= 3)
      .slice(0, 2);

    if (relevantOptimizations.length > 0) {
      const optimization: CoordinatedOptimization = {
        id: this.generateOptimizationId(),
        type: 'reading',
        priority: state.reading.supportLevel === 'intensive' ? 4 : 3,
        components: ['reading'],
        expectedImpact: 0.4,
        implementation: {
          readingActions: relevantOptimizations,
        },
        dependencies: [],
        conflicts: [],
        status: 'pending',
      };

      this.optimizations.push(optimization);
    }
  }

  private shouldCreateCombinedOptimization(
    state: UIOptimizationState,
  ): boolean {
    // Create combined optimizations when multiple systems are struggling
    const strugglingComponents = [];

    if (state.performance.score < 0.6) strugglingComponents.push('performance');
    if (state.engagement.score < 0.6) strugglingComponents.push('engagement');
    if (state.navigation.efficiency < 0.6)
      strugglingComponents.push('navigation');
    if (state.reading.comprehensionScore < 0.6)
      strugglingComponents.push('reading');

    return strugglingComponents.length >= 2;
  }

  private createCombinedOptimization(state: UIOptimizationState): void {
    const components: string[] = [];
    const actions: any = {};

    // Include performance actions if needed
    if (state.performance.score < 0.6) {
      components.push('performance');
      const perfInsights = uiPerformanceMonitor.getPerformanceInsights();
      actions.performanceActions = perfInsights.recommendations.slice(0, 2);
    }

    // Include engagement actions if needed
    if (state.engagement.score < 0.6) {
      components.push('engagement');
      const engagementPatterns = engagementOptimizer.getEngagementPatterns();
      actions.engagementActions = engagementPatterns
        .flatMap(p => p.recommendedActions)
        .filter(o => o.priority >= 3)
        .slice(0, 1);
    }

    // Include navigation actions if needed
    if (state.navigation.efficiency < 0.6) {
      components.push('navigation');
      actions.navigationActions = navigationOptimizer
        .getNavigationOptimizations(false)
        .filter(o => o.priority >= 3)
        .slice(0, 1);
    }

    // Include reading actions if needed
    if (state.reading.comprehensionScore < 0.6) {
      components.push('reading');
      const readingPatterns =
        readingComprehensionOptimizer.getReadingPatterns();
      actions.readingActions = readingPatterns
        .flatMap(p => p.recommendedOptimizations)
        .filter(o => o.priority >= 3)
        .slice(0, 1);
    }

    if (components.length >= 2) {
      const optimization: CoordinatedOptimization = {
        id: this.generateOptimizationId(),
        type: 'combined',
        priority: 4,
        components,
        expectedImpact: 0.5,
        implementation: actions,
        dependencies: [],
        conflicts: [],
        status: 'pending',
      };

      this.optimizations.push(optimization);
    }
  }

  private async autoApplyCriticalOptimizations(): Promise<void> {
    const criticalOptimizations = this.optimizations.filter(
      o =>
        o.status === 'pending' &&
        o.priority >= this.config.priorityThresholds.critical,
    );

    for (const optimization of criticalOptimizations) {
      await this.applyCoordinatedOptimization(optimization.id);

      // Small delay between critical optimizations
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  private async applyPerformanceOptimizations(
    actions: OptimizationRecommendation[],
  ): Promise<boolean> {
    if (actions.length === 0) return true;

    try {
      // In a real implementation, this would apply performance optimizations
      structuredLogger.info('Applying performance optimizations', {
        actionsCount: actions.length,
      });
      return true;
    } catch (error) {
      structuredLogger.error(
        'Failed to apply performance optimizations',
        {},
        error as Error,
      );
      return false;
    }
  }

  private async applyEngagementOptimizations(
    actions: EngagementOptimization[],
  ): Promise<boolean> {
    if (actions.length === 0) return true;

    try {
      const results = await Promise.all(
        actions.map(action =>
          engagementOptimizer.applyEngagementOptimization(action.id),
        ),
      );
      return results.every(result => result);
    } catch (error) {
      structuredLogger.error(
        'Failed to apply engagement optimizations',
        {},
        error as Error,
      );
      return false;
    }
  }

  private async applyNavigationOptimizations(
    actions: NavigationOptimization[],
  ): Promise<boolean> {
    if (actions.length === 0) return true;

    try {
      const results = await Promise.all(
        actions.map(action =>
          navigationOptimizer.applyNavigationOptimization(action.id),
        ),
      );
      return results.every(result => result);
    } catch (error) {
      structuredLogger.error(
        'Failed to apply navigation optimizations',
        {},
        error as Error,
      );
      return false;
    }
  }

  private async applyReadingOptimizations(
    actions: ReadingOptimization[],
  ): Promise<boolean> {
    if (actions.length === 0) return true;

    try {
      const results = await Promise.all(
        actions.map(action =>
          readingComprehensionOptimizer.applyReadingOptimization(action.id),
        ),
      );
      return results.every(result => result);
    } catch (error) {
      structuredLogger.error(
        'Failed to apply reading optimizations',
        {},
        error as Error,
      );
      return false;
    }
  }

  private measureCoordinatedEffectiveness(): void {
    const measuringOptimizations = this.optimizations.filter(
      o =>
        o.status === 'applied' &&
        !o.effectiveness &&
        o.appliedAt &&
        Date.now() - o.appliedAt > 300000, // At least 5 minutes
    );

    measuringOptimizations.forEach(optimization => {
      const effectiveness =
        this.calculateCoordinatedEffectiveness(optimization);

      if (effectiveness !== null) {
        optimization.effectiveness = effectiveness;
        optimization.status = 'completed';

        structuredLogger.info(
          'Coordinated optimization effectiveness measured',
          {
            optimizationId: optimization.id,
            type: optimization.type,
            effectiveness,
            components: optimization.components,
          },
        );
      } else {
        optimization.status = 'measuring'; // Continue measuring
      }
    });
  }

  private calculateCoordinatedEffectiveness(
    optimization: CoordinatedOptimization,
  ): number | null {
    const componentEffectiveness: number[] = [];

    // Get effectiveness from each component
    if (optimization.components.includes('performance')) {
      const perfSummary = uiPerformanceMonitor.getPerformanceSummary();
      // Simple heuristic: better performance means higher effectiveness
      componentEffectiveness.push(
        perfSummary.overallHealth === 'excellent'
          ? 1.0
          : perfSummary.overallHealth === 'good'
          ? 0.8
          : perfSummary.overallHealth === 'fair'
          ? 0.6
          : 0.4,
      );
    }

    if (optimization.components.includes('engagement')) {
      const engagementState = engagementOptimizer.getCurrentEngagementState();
      componentEffectiveness.push(engagementState.score);
    }

    if (optimization.components.includes('navigation')) {
      const navMetrics = navigationOptimizer.getNavigationMetrics();
      componentEffectiveness.push(navMetrics.optimalPathAdherence);
    }

    if (optimization.components.includes('reading')) {
      const readingMetrics =
        readingComprehensionOptimizer.getCurrentComprehensionMetrics();
      componentEffectiveness.push(readingMetrics.comprehensionScore);
    }

    if (componentEffectiveness.length === 0) return null;

    // Calculate weighted average effectiveness
    const weights = optimization.components.map(component => {
      switch (component) {
        case 'performance':
          return this.config.integrationSettings.performanceWeight;
        case 'engagement':
          return this.config.integrationSettings.engagementWeight;
        case 'navigation':
          return this.config.integrationSettings.navigationWeight;
        case 'reading':
          return this.config.integrationSettings.readingWeight;
        default:
          return 0.25;
      }
    });

    const weightedSum = componentEffectiveness.reduce(
      (sum, eff, i) => sum + eff * weights[i],
      0,
    );
    const weightSum = weights.reduce((sum, w) => sum + w, 0);

    return weightSum > 0 ? weightedSum / weightSum : null;
  }

  private calculateOverallHealth(
    performance: any,
    engagement: any,
    navigation: any,
    reading: any,
  ): 'excellent' | 'good' | 'fair' | 'poor' {
    const scores: number[] = [];

    // Convert performance health to score
    scores.push(
      performance.overallHealth === 'excellent'
        ? 1.0
        : performance.overallHealth === 'good'
        ? 0.8
        : performance.overallHealth === 'fair'
        ? 0.6
        : 0.4,
    );

    scores.push(engagement.score);
    scores.push(navigation.optimalPathAdherence);
    scores.push(reading.comprehensionScore);

    const averageScore =
      scores.reduce((sum, score) => sum + score, 0) / scores.length;

    if (averageScore >= 0.9) return 'excellent';
    if (averageScore >= 0.7) return 'good';
    if (averageScore >= 0.5) return 'fair';
    return 'poor';
  }

  private calculatePerformanceScore(summary: any): number {
    // Convert performance summary to normalized score
    if (summary.overallHealth === 'excellent') return 1.0;
    if (summary.overallHealth === 'good') return 0.8;
    if (summary.overallHealth === 'fair') return 0.6;
    return 0.4;
  }

  private determineSupportLevel(
    metrics: any,
  ): 'minimal' | 'moderate' | 'intensive' {
    const strugglingCount = metrics.strugglingIndicators.length;
    const comprehensionScore = metrics.comprehensionScore;

    if (strugglingCount >= 3 || comprehensionScore < 0.5) return 'intensive';
    if (strugglingCount >= 1 || comprehensionScore < 0.7) return 'moderate';
    return 'minimal';
  }

  private generateOptimizationId(): string {
    return `coord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  }

  private cleanupOptimizations(): void {
    const cutoff = Date.now() - 3600000; // Keep 1 hour

    this.optimizations = this.optimizations.filter(o =>
      o.appliedAt ? o.appliedAt > cutoff : Date.now() - cutoff < 300000,
    );
  }

  private getDefaultState(): UIOptimizationState {
    return {
      overall: {
        health: 'good',
        lastUpdate: Date.now(),
        activeOptimizations: 0,
      },
      performance: {
        score: 0.8,
        criticalIssues: 0,
        averageRenderTime: 16.67,
        memoryUsage: 50,
      },
      engagement: {
        score: 0.7,
        trend: 'stable',
        indicators: [],
      },
      navigation: {
        efficiency: 0.8,
        strugglingPatterns: 0,
        optimizationOpportunities: 0,
      },
      reading: {
        comprehensionScore: 0.75,
        readingSpeed: 120,
        strugglingIndicators: 0,
        supportLevel: 'minimal',
      },
    };
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    if (this.coordinationTimer) {
      clearInterval(this.coordinationTimer);
      this.coordinationTimer = null;
    }

    // Shutdown all component services
    await Promise.all([
      uiPerformanceMonitor.shutdown(),
      engagementOptimizer.shutdown(),
      navigationOptimizer.shutdown(),
      readingComprehensionOptimizer.shutdown(),
    ]);

    structuredLogger.info('Dynamic UI Coordinator shutdown completed', {
      optimizationsGenerated: this.optimizations.length,
      completedOptimizations: this.optimizations.filter(
        o => o.status === 'completed',
      ).length,
    });
  }
}

export const dynamicUICoordinator = new DynamicUICoordinatorService();
export { DynamicUICoordinatorService };
