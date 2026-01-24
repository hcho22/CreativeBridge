/**
 * Navigation Flow Optimizer Service
 *
 * Intelligent navigation flow optimization and user journey enhancement
 * Task 7.2: Dynamic UI Optimization - Subtask 3
 */

import { structuredLogger } from '../utils/logger';
import { behaviorAnalytics, BehaviorPattern } from './behaviorAnalytics';
import { engagementOptimizer } from './engagementOptimizer';
import { GradeLevel } from '../types/database';

export interface NavigationEvent {
  id: string;
  type:
    | 'screen_enter'
    | 'screen_exit'
    | 'navigation_action'
    | 'back_navigation'
    | 'tab_switch'
    | 'deep_link'
    | 'external_link';
  fromScreen?: string;
  toScreen: string;
  timestamp: number;
  sessionId: string;
  navigationMethod: 'tab' | 'stack' | 'modal' | 'gesture' | 'button' | 'auto';
  duration?: number; // For screen_exit events
  context: {
    gradeLevel: GradeLevel;
    userExperience: number;
    sessionPosition: number;
    previousScreens: string[];
  };
  metadata: Record<string, any>;
}

export interface NavigationPattern {
  id: string;
  patternType:
    | 'optimal_flow'
    | 'navigation_struggle'
    | 'dead_end'
    | 'loop_behavior'
    | 'abandonment_risk'
    | 'efficiency_opportunity';
  sequence: string[]; // Sequence of screens
  frequency: number;
  averageDuration: number;
  successRate: number; // Completion rate for this flow
  strugglesDetected: string[];
  confidence: number;
  firstDetected: number;
  lastSeen: number;
  associatedEvents: NavigationEvent[];
}

export interface NavigationOptimization {
  id: string;
  type:
    | 'shortcut_creation'
    | 'flow_simplification'
    | 'breadcrumb_enhancement'
    | 'contextual_navigation'
    | 'progress_indication'
    | 'smart_defaults'
    | 'gesture_optimization'
    | 'accessibility_improvement';
  targetFlow: string[];
  priority: number;
  expectedImpact: number;
  implementation: {
    changes: NavigationChange[];
    rollbackData?: any;
  };
  validationMetrics: string[];
  appliedAt?: number;
  effectiveness?: number;
}

export interface NavigationChange {
  changeType:
    | 'add_shortcut'
    | 'remove_step'
    | 'reorder_flow'
    | 'add_progress'
    | 'improve_feedback'
    | 'enhance_gestures'
    | 'add_breadcrumbs'
    | 'optimize_transitions';
  target: string; // Screen or component identifier
  properties: Record<string, any>;
  condition?: string;
}

export interface UserJourney {
  id: string;
  userId: string;
  sessionId: string;
  startTime: number;
  endTime?: number;
  screens: Array<{
    screen: string;
    enterTime: number;
    exitTime?: number;
    duration?: number;
    interactions: number;
    strugglesDetected: boolean;
  }>;
  totalDuration?: number;
  completionStatus: 'ongoing' | 'completed' | 'abandoned';
  goalAchieved: boolean;
  efficencyScore: number; // 0-1, based on optimal path
  strugglesEncountered: string[];
}

export interface NavigationMetrics {
  flowEfficiency: Record<string, number>; // Flow name -> efficiency score
  averageNavigationTime: Record<string, number>; // Screen transitions
  abandonmentRates: Record<string, number>; // Per screen
  backNavigationFrequency: Record<string, number>;
  optimalPathAdherence: number;
  userSatisfactionByFlow: Record<string, number>;
}

interface NavigationConfig {
  enabled: boolean;
  trackingInterval: number;
  patternDetectionMinSamples: number;
  optimizationThreshold: number; // Minimum efficiency drop to trigger optimization
  gradeLevelFlows: Record<
    GradeLevel,
    {
      maxFlowLength: number;
      preferredNavigationMethods: string[];
      complexityTolerance: number;
      assistanceThreshold: number;
    }
  >;
  commonFlows: Array<{
    name: string;
    sequence: string[];
    expectedDuration: number;
    criticalPath: boolean;
  }>;
}

const DEFAULT_CONFIG: NavigationConfig = {
  enabled: true,
  trackingInterval: 15000, // 15 seconds
  patternDetectionMinSamples: 5,
  optimizationThreshold: 0.7, // Trigger optimization if efficiency drops below 70%
  gradeLevelFlows: {
    'K-2': {
      maxFlowLength: 3,
      preferredNavigationMethods: ['tab', 'button'],
      complexityTolerance: 0.3,
      assistanceThreshold: 0.8,
    },
    '3-5': {
      maxFlowLength: 4,
      preferredNavigationMethods: ['tab', 'button', 'gesture'],
      complexityTolerance: 0.5,
      assistanceThreshold: 0.7,
    },
    '6-8': {
      maxFlowLength: 5,
      preferredNavigationMethods: ['tab', 'button', 'gesture', 'modal'],
      complexityTolerance: 0.7,
      assistanceThreshold: 0.6,
    },
    '9-12': {
      maxFlowLength: 6,
      preferredNavigationMethods: [
        'tab',
        'button',
        'gesture',
        'modal',
        'stack',
      ],
      complexityTolerance: 0.9,
      assistanceThreshold: 0.5,
    },
  },
  commonFlows: [
    {
      name: 'story_creation_flow',
      sequence: ['Home', 'ImportOptions', 'StorySelection', 'StoryPreviewEdit'],
      expectedDuration: 180000, // 3 minutes
      criticalPath: true,
    },
    {
      name: 'settings_flow',
      sequence: ['Home', 'Settings'],
      expectedDuration: 60000, // 1 minute
      criticalPath: false,
    },
    {
      name: 'profile_flow',
      sequence: ['Home', 'Profile'],
      expectedDuration: 60000, // 1 minute
      criticalPath: false,
    },
  ],
};

class NavigationOptimizerService {
  private config: NavigationConfig;
  private events: NavigationEvent[] = [];
  private patterns: NavigationPattern[] = [];
  private optimizations: NavigationOptimization[] = [];
  private journeys: Map<string, UserJourney> = new Map(); // sessionId -> journey
  private sessionId: string | null = null;
  private currentScreen: string | null = null;
  private screenEnterTime: number = 0;
  private trackingTimer: NodeJS.Timeout | null = null;
  private isInitialized = false;

  constructor(config: Partial<NavigationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize navigation optimizer
   */
  async initialize(
    sessionId: string,
    initialScreen: string,
    gradeLevel: GradeLevel,
  ): Promise<void> {
    try {
      this.sessionId = sessionId;
      this.currentScreen = initialScreen;
      this.screenEnterTime = Date.now();

      // Initialize user journey
      this.startUserJourney(sessionId, initialScreen, gradeLevel);

      // Start tracking
      if (this.config.enabled) {
        this.startTracking();
      }

      this.isInitialized = true;

      structuredLogger.info('Navigation Optimizer initialized', {
        sessionId,
        initialScreen,
        gradeLevel,
        commonFlows: this.config.commonFlows.length,
      });
    } catch (error) {
      structuredLogger.error(
        'Failed to initialize Navigation Optimizer',
        {},
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Record navigation event
   */
  recordNavigationEvent(
    type: NavigationEvent['type'],
    toScreen: string,
    navigationMethod: NavigationEvent['navigationMethod'],
    context: Partial<NavigationEvent['context']>,
    metadata: Record<string, any> = {},
  ): void {
    if (!this.isInitialized || !this.sessionId) return;

    const fromScreen = this.currentScreen;
    const duration =
      type === 'screen_exit' ? Date.now() - this.screenEnterTime : undefined;

    const event: NavigationEvent = {
      id: this.generateEventId(),
      type,
      fromScreen: fromScreen || undefined,
      toScreen,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      navigationMethod,
      duration,
      context: {
        gradeLevel: context.gradeLevel || 'Grade3',
        userExperience: context.userExperience || 0.5,
        sessionPosition: context.sessionPosition || this.getSessionPosition(),
        previousScreens: context.previousScreens || this.getPreviousScreens(),
      },
      metadata,
    };

    this.events.push(event);
    this.updateUserJourney(event);
    this.analyzeNavigationPattern(event);

    // Update current state
    if (type === 'screen_enter') {
      this.currentScreen = toScreen;
      this.screenEnterTime = Date.now();
    }

    // Record with behavior analytics
    if (behaviorAnalytics) {
      behaviorAnalytics.recordInteraction({
        component: 'navigation',
        action: `${type}_${navigationMethod}`,
        context: {
          fromScreen,
          toScreen,
          duration,
        },
      });
    }

    // Record with engagement optimizer
    if (engagementOptimizer && type === 'screen_enter') {
      engagementOptimizer.recordEngagementMetric(
        'interaction_frequency',
        1,
        toScreen,
        'navigation',
        context,
      );
    }
  }

  /**
   * Get navigation patterns
   */
  getNavigationPatterns(
    patternType?: NavigationPattern['patternType'],
  ): NavigationPattern[] {
    let patterns = this.patterns;

    if (patternType) {
      patterns = patterns.filter(p => p.patternType === patternType);
    }

    return patterns.sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Get current navigation metrics
   */
  getNavigationMetrics(): NavigationMetrics {
    const recentEvents = this.events.filter(
      e => Date.now() - e.timestamp < 3600000, // Last hour
    );

    return {
      flowEfficiency: this.calculateFlowEfficiency(recentEvents),
      averageNavigationTime: this.calculateAverageNavigationTimes(recentEvents),
      abandonmentRates: this.calculateAbandonmentRates(recentEvents),
      backNavigationFrequency:
        this.calculateBackNavigationFrequency(recentEvents),
      optimalPathAdherence: this.calculateOptimalPathAdherence(recentEvents),
      userSatisfactionByFlow: this.calculateSatisfactionByFlow(recentEvents),
    };
  }

  /**
   * Get navigation optimizations
   */
  getNavigationOptimizations(applied?: boolean): NavigationOptimization[] {
    let optimizations = this.optimizations;

    if (applied !== undefined) {
      optimizations = optimizations.filter(o => !!o.appliedAt === applied);
    }

    return optimizations.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Apply navigation optimization
   */
  async applyNavigationOptimization(optimizationId: string): Promise<boolean> {
    try {
      const optimization = this.optimizations.find(
        o => o.id === optimizationId,
      );
      if (!optimization || optimization.appliedAt) {
        structuredLogger.warn('Optimization not found or already applied', {
          optimizationId,
        });
        return false;
      }

      // Execute the optimization
      await this.executeNavigationOptimization(optimization);

      optimization.appliedAt = Date.now();

      structuredLogger.info('Navigation optimization applied', {
        optimizationId,
        type: optimization.type,
        targetFlow: optimization.targetFlow,
        expectedImpact: optimization.expectedImpact,
      });

      return true;
    } catch (error) {
      structuredLogger.error(
        'Failed to apply navigation optimization',
        { optimizationId },
        error as Error,
      );
      return false;
    }
  }

  /**
   * Get user journey analysis
   */
  getUserJourneyAnalysis(sessionId?: string): {
    currentJourney?: UserJourney;
    recentJourneys: UserJourney[];
    averageJourneyLength: number;
    commonDropoffPoints: string[];
    efficiencyTrends: Array<{ timestamp: number; efficiency: number }>;
  } {
    const targetSessionId = sessionId || this.sessionId;
    const currentJourney = targetSessionId
      ? this.journeys.get(targetSessionId)
      : undefined;

    const recentJourneys = Array.from(this.journeys.values())
      .filter(j => Date.now() - j.startTime < 86400000) // Last 24 hours
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, 10);

    const averageJourneyLength =
      recentJourneys.length > 0
        ? recentJourneys.reduce((sum, j) => sum + j.screens.length, 0) /
          recentJourneys.length
        : 0;

    const commonDropoffPoints =
      this.identifyCommonDropoffPoints(recentJourneys);
    const efficiencyTrends = this.calculateEfficiencyTrends(recentJourneys);

    return {
      currentJourney,
      recentJourneys,
      averageJourneyLength,
      commonDropoffPoints,
      efficiencyTrends,
    };
  }

  /**
   * Private helper methods
   */
  private generateEventId(): string {
    return `nav_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  private getSessionPosition(): number {
    const sessionStart =
      this.journeys.get(this.sessionId!)?.startTime || Date.now();
    return (Date.now() - sessionStart) / 1000; // Seconds into session
  }

  private getPreviousScreens(): string[] {
    const journey = this.journeys.get(this.sessionId!);
    return journey ? journey.screens.map(s => s.screen) : [];
  }

  private startUserJourney(
    sessionId: string,
    initialScreen: string,
    gradeLevel: GradeLevel,
  ): void {
    const journey: UserJourney = {
      id: `journey_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: `user_${gradeLevel}`, // Simplified user ID
      sessionId,
      startTime: Date.now(),
      screens: [
        {
          screen: initialScreen,
          enterTime: Date.now(),
          interactions: 0,
          strugglesDetected: false,
        },
      ],
      completionStatus: 'ongoing',
      goalAchieved: false,
      efficencyScore: 1.0,
      strugglesEncountered: [],
    };

    this.journeys.set(sessionId, journey);
  }

  private updateUserJourney(event: NavigationEvent): void {
    const journey = this.journeys.get(event.sessionId);
    if (!journey) return;

    if (event.type === 'screen_enter') {
      // Add new screen to journey
      journey.screens.push({
        screen: event.toScreen,
        enterTime: event.timestamp,
        interactions: 0,
        strugglesDetected: false,
      });
    } else if (event.type === 'screen_exit' && journey.screens.length > 0) {
      // Update the last screen with exit information
      const lastScreen = journey.screens[journey.screens.length - 1];
      lastScreen.exitTime = event.timestamp;
      lastScreen.duration = event.duration;

      // Check for struggles (very short or very long stays)
      if (event.duration) {
        if (event.duration < 5000 || event.duration > 300000) {
          // Less than 5s or more than 5min
          lastScreen.strugglesDetected = true;
          journey.strugglesEncountered.push(
            `unusual_duration_${event.fromScreen}`,
          );
        }
      }
    }

    // Update journey efficiency
    journey.efficencyScore = this.calculateJourneyEfficiency(journey);
  }

  private calculateJourneyEfficiency(journey: UserJourney): number {
    // Find matching optimal flow
    const currentSequence = journey.screens.map(s => s.screen);
    const matchingFlow = this.config.commonFlows.find(flow =>
      this.isSequenceMatch(currentSequence, flow.sequence),
    );

    if (!matchingFlow) return 0.5; // Default efficiency for unknown flows

    // Calculate efficiency based on optimal path adherence and time
    const pathEfficiency =
      currentSequence.length <= matchingFlow.sequence.length
        ? 1.0
        : matchingFlow.sequence.length / currentSequence.length;

    const timeEfficiency =
      journey.totalDuration &&
      journey.totalDuration <= matchingFlow.expectedDuration
        ? 1.0
        : matchingFlow.expectedDuration /
          (journey.totalDuration || matchingFlow.expectedDuration);

    return (pathEfficiency + timeEfficiency) / 2;
  }

  private isSequenceMatch(current: string[], optimal: string[]): boolean {
    // Check if current sequence follows the optimal sequence (allowing for extra steps)
    let optimalIndex = 0;

    for (const screen of current) {
      if (optimalIndex < optimal.length && screen === optimal[optimalIndex]) {
        optimalIndex++;
      }
    }

    return optimalIndex >= optimal.length * 0.8; // At least 80% of optimal sequence
  }

  private startTracking(): void {
    this.trackingTimer = setInterval(() => {
      this.performPeriodicAnalysis();
    }, this.config.trackingInterval);
  }

  private performPeriodicAnalysis(): void {
    try {
      // Detect navigation patterns
      this.detectNavigationPatterns();

      // Generate optimizations
      this.generateNavigationOptimizations();

      // Measure optimization effectiveness
      this.measureOptimizationEffectiveness();

      // Clean up old data
      this.cleanupOldData();

      structuredLogger.debug('Navigation analysis completed', {
        eventsCount: this.events.length,
        patternsDetected: this.patterns.length,
        activeJourneys: this.journeys.size,
        optimizationsGenerated: this.optimizations.length,
      });
    } catch (error) {
      structuredLogger.error('Navigation analysis failed', {}, error as Error);
    }
  }

  private detectNavigationPatterns(): void {
    const recentEvents = this.events.filter(
      e => Date.now() - e.timestamp < this.config.trackingInterval * 4,
    );

    // Group events by navigation sequences
    const sequences = this.extractNavigationSequences(recentEvents);

    sequences.forEach(sequence => {
      if (sequence.events.length >= this.config.patternDetectionMinSamples) {
        const patternType = this.classifyNavigationPattern(sequence);

        if (patternType) {
          this.createNavigationPattern(patternType, sequence);
        }
      }
    });
  }

  private extractNavigationSequences(events: NavigationEvent[]): Array<{
    sequence: string[];
    events: NavigationEvent[];
    frequency: number;
    averageDuration: number;
  }> {
    const sequenceMap = new Map<string, NavigationEvent[]>();

    // Group events by session and extract sequences
    const sessionEvents = new Map<string, NavigationEvent[]>();
    events.forEach(event => {
      if (!sessionEvents.has(event.sessionId)) {
        sessionEvents.set(event.sessionId, []);
      }
      sessionEvents.get(event.sessionId)!.push(event);
    });

    sessionEvents.forEach(sessionEventList => {
      const navigationEvents = sessionEventList
        .filter(e => e.type === 'screen_enter')
        .sort((a, b) => a.timestamp - b.timestamp);

      if (navigationEvents.length >= 2) {
        const sequence = navigationEvents.map(e => e.toScreen);
        const sequenceKey = sequence.join(' -> ');

        if (!sequenceMap.has(sequenceKey)) {
          sequenceMap.set(sequenceKey, []);
        }
        sequenceMap.get(sequenceKey)!.push(...navigationEvents);
      }
    });

    // Convert to result format
    return Array.from(sequenceMap.entries()).map(([sequenceKey, events]) => {
      const sequence = sequenceKey.split(' -> ');
      const durations = events.filter(e => e.duration).map(e => e.duration!);

      return {
        sequence,
        events,
        frequency: events.length,
        averageDuration:
          durations.length > 0
            ? durations.reduce((sum, d) => sum + d, 0) / durations.length
            : 0,
      };
    });
  }

  private classifyNavigationPattern(sequence: {
    sequence: string[];
    events: NavigationEvent[];
    frequency: number;
    averageDuration: number;
  }): NavigationPattern['patternType'] | null {
    // Check for optimal flows
    const isOptimalFlow = this.config.commonFlows.some(flow =>
      this.isSequenceMatch(sequence.sequence, flow.sequence),
    );

    if (isOptimalFlow && sequence.averageDuration < 60000) {
      return 'optimal_flow';
    }

    // Check for navigation struggles
    const backNavigations = sequence.events.filter(
      e => e.type === 'back_navigation',
    ).length;

    if (backNavigations > sequence.sequence.length * 0.3) {
      return 'navigation_struggle';
    }

    // Check for loop behavior
    const uniqueScreens = new Set(sequence.sequence);
    if (sequence.sequence.length > uniqueScreens.size * 1.5) {
      return 'loop_behavior';
    }

    // Check for dead ends (short sequences with high abandonment)
    if (sequence.sequence.length <= 2 && sequence.averageDuration < 10000) {
      return 'dead_end';
    }

    // Check for efficiency opportunities
    const matchingFlow = this.config.commonFlows.find(flow =>
      this.isSequenceMatch(sequence.sequence, flow.sequence),
    );

    if (
      matchingFlow &&
      sequence.sequence.length > matchingFlow.sequence.length * 1.3
    ) {
      return 'efficiency_opportunity';
    }

    return null;
  }

  private createNavigationPattern(
    patternType: NavigationPattern['patternType'],
    sequence: {
      sequence: string[];
      events: NavigationEvent[];
      frequency: number;
      averageDuration: number;
    },
  ): void {
    const existingPattern = this.patterns.find(
      p =>
        p.patternType === patternType &&
        JSON.stringify(p.sequence) === JSON.stringify(sequence.sequence),
    );

    if (existingPattern) {
      // Update existing pattern
      existingPattern.frequency += sequence.frequency;
      existingPattern.lastSeen = Date.now();
      existingPattern.associatedEvents.push(...sequence.events);
      existingPattern.averageDuration =
        (existingPattern.averageDuration + sequence.averageDuration) / 2;
    } else {
      // Create new pattern
      const pattern: NavigationPattern = {
        id: `pattern_${Date.now()}_${Math.random()
          .toString(36)
          .substring(2, 6)}`,
        patternType,
        sequence: sequence.sequence,
        frequency: sequence.frequency,
        averageDuration: sequence.averageDuration,
        successRate: this.calculateSuccessRate(sequence.events),
        strugglesDetected: this.identifyStruggles(sequence.events),
        confidence: this.calculatePatternConfidence(sequence),
        firstDetected: Date.now(),
        lastSeen: Date.now(),
        associatedEvents: sequence.events,
      };

      this.patterns.push(pattern);

      structuredLogger.info('Navigation pattern detected', {
        patternType,
        sequence: sequence.sequence,
        frequency: sequence.frequency,
        confidence: pattern.confidence,
      });
    }
  }

  private calculateSuccessRate(events: NavigationEvent[]): number {
    const completedJourneys = events.filter(
      e => e.metadata.journeyCompleted === true,
    ).length;

    return events.length > 0 ? completedJourneys / events.length : 0.5;
  }

  private identifyStruggles(events: NavigationEvent[]): string[] {
    const struggles: string[] = [];

    const backNavigations = events.filter(
      e => e.type === 'back_navigation',
    ).length;
    if (backNavigations > events.length * 0.2) {
      struggles.push('excessive_back_navigation');
    }

    const longDurations = events.filter(
      e => e.duration && e.duration > 180000,
    ).length;
    if (longDurations > events.length * 0.1) {
      struggles.push('long_screen_durations');
    }

    return struggles;
  }

  private calculatePatternConfidence(sequence: {
    sequence: string[];
    events: NavigationEvent[];
    frequency: number;
    averageDuration: number;
  }): number {
    const frequencyConfidence = Math.min(sequence.frequency / 10, 1); // Max confidence at 10+ occurrences
    const consistencyConfidence =
      sequence.events.length > 1
        ? 1 -
          this.calculateVariance(sequence.events.map(e => e.duration || 0)) /
            100000
        : 0.5;

    return (frequencyConfidence + consistencyConfidence) / 2;
  }

  private calculateVariance(numbers: number[]): number {
    const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
    const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2));
    return squaredDiffs.reduce((sum, d) => sum + d, 0) / numbers.length;
  }

  private generateNavigationOptimizations(): void {
    // Analyze patterns and generate optimizations
    this.patterns.forEach(pattern => {
      if (pattern.patternType === 'navigation_struggle') {
        this.generateStruggleOptimization(pattern);
      } else if (pattern.patternType === 'efficiency_opportunity') {
        this.generateEfficiencyOptimization(pattern);
      } else if (pattern.patternType === 'dead_end') {
        this.generateDeadEndOptimization(pattern);
      }
    });
  }

  private generateStruggleOptimization(pattern: NavigationPattern): void {
    const optimization: NavigationOptimization = {
      id: this.generateOptimizationId(),
      type: 'flow_simplification',
      targetFlow: pattern.sequence,
      priority: 4,
      expectedImpact: 0.4,
      implementation: {
        changes: [
          {
            changeType: 'add_breadcrumbs',
            target: pattern.sequence.join(','),
            properties: {
              showBreadcrumbs: true,
              highlightCurrentStep: true,
              allowDirectNavigation: true,
            },
          },
          {
            changeType: 'add_progress',
            target: pattern.sequence.join(','),
            properties: {
              showProgress: true,
              estimatedTimeRemaining: true,
            },
          },
        ],
      },
      validationMetrics: [
        'back_navigation_reduction',
        'flow_completion_increase',
      ],
    };

    if (!this.optimizations.find(o => o.id === optimization.id)) {
      this.optimizations.push(optimization);
    }
  }

  private generateEfficiencyOptimization(pattern: NavigationPattern): void {
    const optimization: NavigationOptimization = {
      id: this.generateOptimizationId(),
      type: 'shortcut_creation',
      targetFlow: pattern.sequence,
      priority: 3,
      expectedImpact: 0.3,
      implementation: {
        changes: [
          {
            changeType: 'add_shortcut',
            target: pattern.sequence[0],
            properties: {
              shortcutTarget: pattern.sequence[pattern.sequence.length - 1],
              shortcutLabel: 'Quick Access',
              showAfterFirstUse: true,
            },
          },
        ],
      },
      validationMetrics: [
        'navigation_time_reduction',
        'user_satisfaction_increase',
      ],
    };

    if (!this.optimizations.find(o => o.id === optimization.id)) {
      this.optimizations.push(optimization);
    }
  }

  private generateDeadEndOptimization(pattern: NavigationPattern): void {
    const optimization: NavigationOptimization = {
      id: this.generateOptimizationId(),
      type: 'contextual_navigation',
      targetFlow: pattern.sequence,
      priority: 5,
      expectedImpact: 0.5,
      implementation: {
        changes: [
          {
            changeType: 'improve_feedback',
            target: pattern.sequence[pattern.sequence.length - 1],
            properties: {
              suggestedNextActions: true,
              contextualHints: true,
              exitGuidance: true,
            },
          },
        ],
      },
      validationMetrics: ['abandonment_reduction', 'engagement_increase'],
    };

    if (!this.optimizations.find(o => o.id === optimization.id)) {
      this.optimizations.push(optimization);
    }
  }

  private generateOptimizationId(): string {
    return `nav_opt_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 6)}`;
  }

  private async executeNavigationOptimization(
    optimization: NavigationOptimization,
  ): Promise<void> {
    // In a real implementation, this would apply the navigation changes
    structuredLogger.info('Executing navigation optimization', {
      type: optimization.type,
      targetFlow: optimization.targetFlow,
      changesCount: optimization.implementation.changes.length,
    });
  }

  private measureOptimizationEffectiveness(): void {
    const appliedOptimizations = this.optimizations.filter(
      o => o.appliedAt && !o.effectiveness && Date.now() - o.appliedAt > 300000, // At least 5 minutes since application
    );

    appliedOptimizations.forEach(optimization => {
      const effectiveness =
        this.calculateOptimizationEffectiveness(optimization);

      if (effectiveness !== null) {
        optimization.effectiveness = effectiveness;

        structuredLogger.info(
          'Navigation optimization effectiveness measured',
          {
            optimizationId: optimization.id,
            type: optimization.type,
            effectiveness,
          },
        );
      }
    });
  }

  private calculateOptimizationEffectiveness(
    optimization: NavigationOptimization,
  ): number | null {
    // Compare metrics before and after optimization
    const beforeEvents = this.events.filter(
      e =>
        e.timestamp < optimization.appliedAt! &&
        e.timestamp > optimization.appliedAt! - 1800000, // 30 minutes before
    );

    const afterEvents = this.events.filter(
      e =>
        e.timestamp > optimization.appliedAt! &&
        e.timestamp < optimization.appliedAt! + 1800000, // 30 minutes after
    );

    if (beforeEvents.length < 5 || afterEvents.length < 5) {
      return null; // Insufficient data
    }

    // Calculate improvement based on optimization type
    switch (optimization.type) {
      case 'flow_simplification':
        return this.calculateFlowSimplificationEffectiveness(
          beforeEvents,
          afterEvents,
        );
      case 'shortcut_creation':
        return this.calculateShortcutEffectiveness(beforeEvents, afterEvents);
      case 'contextual_navigation':
        return this.calculateContextualNavigationEffectiveness(
          beforeEvents,
          afterEvents,
        );
      default:
        return 0.5; // Default moderate effectiveness
    }
  }

  private calculateFlowSimplificationEffectiveness(
    beforeEvents: NavigationEvent[],
    afterEvents: NavigationEvent[],
  ): number {
    const beforeBackNavs = beforeEvents.filter(
      e => e.type === 'back_navigation',
    ).length;
    const afterBackNavs = afterEvents.filter(
      e => e.type === 'back_navigation',
    ).length;

    const beforeRate = beforeBackNavs / beforeEvents.length;
    const afterRate = afterBackNavs / afterEvents.length;

    return Math.max(0, Math.min(1, beforeRate - afterRate + 0.5));
  }

  private calculateShortcutEffectiveness(
    beforeEvents: NavigationEvent[],
    afterEvents: NavigationEvent[],
  ): number {
    const beforeAvgDuration =
      beforeEvents
        .filter(e => e.duration)
        .reduce((sum, e) => sum + e.duration!, 0) / beforeEvents.length;

    const afterAvgDuration =
      afterEvents
        .filter(e => e.duration)
        .reduce((sum, e) => sum + e.duration!, 0) / afterEvents.length;

    if (beforeAvgDuration === 0) return 0.5;

    const improvement =
      (beforeAvgDuration - afterAvgDuration) / beforeAvgDuration;
    return Math.max(0, Math.min(1, improvement + 0.5));
  }

  private calculateContextualNavigationEffectiveness(
    beforeEvents: NavigationEvent[],
    afterEvents: NavigationEvent[],
  ): number {
    // Measure based on abandonment reduction (simplified)
    const beforeAbandonments = beforeEvents.filter(
      e => e.metadata.abandoned === true,
    ).length;

    const afterAbandonments = afterEvents.filter(
      e => e.metadata.abandoned === true,
    ).length;

    const beforeRate = beforeAbandonments / beforeEvents.length;
    const afterRate = afterAbandonments / afterEvents.length;

    return Math.max(0, Math.min(1, beforeRate - afterRate + 0.5));
  }

  private calculateFlowEfficiency(
    events: NavigationEvent[],
  ): Record<string, number> {
    const flowEfficiency: Record<string, number> = {};

    this.config.commonFlows.forEach(flow => {
      const flowEvents = events.filter(e => flow.sequence.includes(e.toScreen));

      if (flowEvents.length > 0) {
        const avgDuration =
          flowEvents
            .filter(e => e.duration)
            .reduce((sum, e) => sum + (e.duration || 0), 0) / flowEvents.length;

        const efficiency =
          flow.expectedDuration > 0
            ? Math.min(1, flow.expectedDuration / avgDuration)
            : 0.5;

        flowEfficiency[flow.name] = efficiency;
      }
    });

    return flowEfficiency;
  }

  private calculateAverageNavigationTimes(
    events: NavigationEvent[],
  ): Record<string, number> {
    const navigationTimes: Record<string, number[]> = {};

    events.forEach(event => {
      if (event.type === 'screen_enter' && event.duration) {
        const key = `${event.fromScreen || 'start'}_to_${event.toScreen}`;

        if (!navigationTimes[key]) {
          navigationTimes[key] = [];
        }
        navigationTimes[key].push(event.duration);
      }
    });

    const averageTimes: Record<string, number> = {};
    Object.entries(navigationTimes).forEach(([key, times]) => {
      averageTimes[key] =
        times.reduce((sum, time) => sum + time, 0) / times.length;
    });

    return averageTimes;
  }

  private calculateAbandonmentRates(
    events: NavigationEvent[],
  ): Record<string, number> {
    const screenVisits: Record<string, number> = {};
    const screenAbandonments: Record<string, number> = {};

    events.forEach(event => {
      if (event.type === 'screen_enter') {
        screenVisits[event.toScreen] = (screenVisits[event.toScreen] || 0) + 1;

        if (event.metadata.abandoned) {
          screenAbandonments[event.toScreen] =
            (screenAbandonments[event.toScreen] || 0) + 1;
        }
      }
    });

    const abandonmentRates: Record<string, number> = {};
    Object.entries(screenVisits).forEach(([screen, visits]) => {
      const abandonments = screenAbandonments[screen] || 0;
      abandonmentRates[screen] = visits > 0 ? abandonments / visits : 0;
    });

    return abandonmentRates;
  }

  private calculateBackNavigationFrequency(
    events: NavigationEvent[],
  ): Record<string, number> {
    const screenEnters: Record<string, number> = {};
    const backNavigations: Record<string, number> = {};

    events.forEach(event => {
      if (event.type === 'screen_enter') {
        screenEnters[event.toScreen] = (screenEnters[event.toScreen] || 0) + 1;
      } else if (event.type === 'back_navigation') {
        backNavigations[event.toScreen] =
          (backNavigations[event.toScreen] || 0) + 1;
      }
    });

    const backFrequency: Record<string, number> = {};
    Object.entries(screenEnters).forEach(([screen, enters]) => {
      const backs = backNavigations[screen] || 0;
      backFrequency[screen] = enters > 0 ? backs / enters : 0;
    });

    return backFrequency;
  }

  private calculateOptimalPathAdherence(events: NavigationEvent[]): number {
    const navigationSequences = this.extractNavigationSequences(events);

    if (navigationSequences.length === 0) return 0.5;

    const adherenceScores = navigationSequences.map(sequence => {
      const matchingFlow = this.config.commonFlows.find(flow =>
        this.isSequenceMatch(sequence.sequence, flow.sequence),
      );

      if (!matchingFlow) return 0.3; // Low score for unknown flows

      return sequence.sequence.length <= matchingFlow.sequence.length
        ? 1.0
        : matchingFlow.sequence.length / sequence.sequence.length;
    });

    return (
      adherenceScores.reduce((sum, score) => sum + score, 0) /
      adherenceScores.length
    );
  }

  private calculateSatisfactionByFlow(
    events: NavigationEvent[],
  ): Record<string, number> {
    // Simplified satisfaction calculation based on completion rates and efficiency
    const flowSatisfaction: Record<string, number> = {};

    this.config.commonFlows.forEach(flow => {
      const flowEvents = events.filter(e => flow.sequence.includes(e.toScreen));

      if (flowEvents.length > 0) {
        const completions = flowEvents.filter(
          e => e.metadata.completed === true,
        ).length;

        const completionRate = completions / flowEvents.length;
        const backNavRate =
          flowEvents.filter(e => e.type === 'back_navigation').length /
          flowEvents.length;

        // Satisfaction based on completion and low back navigation
        const satisfaction = completionRate * (1 - backNavRate);
        flowSatisfaction[flow.name] = Math.max(0, Math.min(1, satisfaction));
      }
    });

    return flowSatisfaction;
  }

  private identifyCommonDropoffPoints(journeys: UserJourney[]): string[] {
    const dropoffs: Record<string, number> = {};

    journeys.forEach(journey => {
      if (
        journey.completionStatus === 'abandoned' &&
        journey.screens.length > 0
      ) {
        const lastScreen = journey.screens[journey.screens.length - 1].screen;
        dropoffs[lastScreen] = (dropoffs[lastScreen] || 0) + 1;
      }
    });

    return Object.entries(dropoffs)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([screen]) => screen);
  }

  private calculateEfficiencyTrends(
    journeys: UserJourney[],
  ): Array<{ timestamp: number; efficiency: number }> {
    return journeys
      .map(journey => ({
        timestamp: journey.startTime,
        efficiency: journey.efficencyScore,
      }))
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-20); // Last 20 journeys
  }

  private cleanupOldData(): void {
    const cutoff = Date.now() - 7200000; // Keep 2 hours of data

    this.events = this.events.filter(e => e.timestamp > cutoff);
    this.patterns = this.patterns.filter(p => p.lastSeen > cutoff);

    // Clean up journeys older than 24 hours
    const journeyKeys = Array.from(this.journeys.keys());
    journeyKeys.forEach(key => {
      const journey = this.journeys.get(key);
      if (journey && Date.now() - journey.startTime > 86400000) {
        this.journeys.delete(key);
      }
    });
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    if (this.trackingTimer) {
      clearInterval(this.trackingTimer);
      this.trackingTimer = null;
    }

    // Complete current journey if active
    if (this.sessionId) {
      const journey = this.journeys.get(this.sessionId);
      if (journey && journey.completionStatus === 'ongoing') {
        journey.endTime = Date.now();
        journey.totalDuration = journey.endTime - journey.startTime;
        journey.completionStatus = 'completed';
      }
    }

    structuredLogger.info('Navigation Optimizer shutdown completed', {
      eventsRecorded: this.events.length,
      patternsDetected: this.patterns.length,
      optimizationsGenerated: this.optimizations.length,
      journeysTracked: this.journeys.size,
    });
  }
}

export const navigationOptimizer = new NavigationOptimizerService();
export { NavigationOptimizerService };
