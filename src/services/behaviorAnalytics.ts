/**
 * Behavior Analytics Service
 *
 * Advanced user interaction pattern recognition and interface adaptation
 * Task 7.1: User Behavior Analysis Implementation
 */

import { structuredLogger } from '../utils/logger';
import { secureStorage } from '../utils/secureStorage';
import { storyAnalytics } from './storyAnalytics';
import { userPreferencesService } from './userPreferences';
import { GradeLevel } from '../types/database';

// Core interaction tracking interfaces
export interface UserInteractionEvent {
  id: string;
  type: InteractionType;
  timestamp: number;
  sessionId: string;
  component: string; // UI component name
  action: string; // specific action taken
  context: InteractionContext;
  deviceInfo: DeviceMetrics;
  duration?: number; // For timed interactions
  sequence: number; // Order within session
}

export type InteractionType =
  | 'touch'
  | 'gesture'
  | 'navigation'
  | 'input'
  | 'voice'
  | 'accessibility'
  | 'error_encounter'
  | 'help_seeking'
  | 'feature_discovery';

export interface InteractionContext {
  screenName: string;
  elementId?: string;
  elementType?: string; // button, input, card, etc.
  coordinates?: { x: number; y: number };
  inputText?: string; // Anonymized/hashed
  voiceCommand?: string; // Anonymized/hashed
  errorType?: string;
  helpTopic?: string;
  gradeLevel: GradeLevel;
  accessibilityMode: boolean;
  networkCondition: 'excellent' | 'good' | 'poor' | 'offline';
}

export interface DeviceMetrics {
  screenSize: { width: number; height: number };
  orientation: 'portrait' | 'landscape';
  touchCapability: boolean;
  keyboardVisible: boolean;
  memoryWarning: boolean;
  batteryLevel?: number; // 0-1
  performanceClass: 'low' | 'medium' | 'high';
}

// Pattern recognition interfaces
export interface BehaviorPattern {
  id: string;
  type: PatternType;
  confidence: number; // 0-1
  frequency: number; // How often this pattern occurs
  impact: PatternImpact;
  triggers: PatternTrigger[];
  metadata: Record<string, any>;
  firstSeen: number;
  lastSeen: number;
  occurrenceCount: number;
}

export type PatternType =
  | 'navigation_difficulty'
  | 'input_struggle'
  | 'accessibility_need'
  | 'help_seeking'
  | 'feature_avoidance'
  | 'efficiency_pattern'
  | 'error_prone_area'
  | 'engagement_drop'
  | 'learning_acceleration'
  | 'device_adaptation';

export interface PatternImpact {
  userExperience: number; // -1 to 1, negative is bad
  taskCompletion: number; // -1 to 1, effect on task success
  learningOutcome: number; // -1 to 1, effect on educational value
  accessibility: number; // -1 to 1, effect on accessibility
}

export interface PatternTrigger {
  condition: string;
  threshold: number;
  timeWindow: number; // milliseconds
  description: string;
}

// Interface adaptation interfaces
export interface AdaptationRecommendation {
  id: string;
  type: AdaptationType;
  priority: 'low' | 'medium' | 'high' | 'critical';
  component: string;
  changes: InterfaceChange[];
  confidence: number;
  reasoning: string[];
  estimatedImpact: PatternImpact;
  implementationComplexity: 'simple' | 'moderate' | 'complex';
}

export type AdaptationType =
  | 'layout_adjustment'
  | 'size_modification'
  | 'color_contrast'
  | 'navigation_simplification'
  | 'input_assistance'
  | 'accessibility_enhancement'
  | 'performance_optimization'
  | 'content_personalization';

export interface InterfaceChange {
  property: string;
  currentValue: any;
  recommendedValue: any;
  reason: string;
  testable: boolean;
}

// Accessibility enhancement interfaces
export interface AccessibilityInsight {
  type: 'motor' | 'visual' | 'auditory' | 'cognitive';
  severity: 'minor' | 'moderate' | 'significant';
  pattern: string;
  recommendation: string;
  implementationNotes: string[];
  wcagLevel: 'A' | 'AA' | 'AAA';
}

interface BehaviorAnalyticsConfig {
  maxInteractionsStored: number;
  patternAnalysisWindow: number; // milliseconds
  minPatternOccurrences: number;
  adaptationThreshold: number; // 0-1
  privacyMode: boolean;
  enableRealTimeAdaptation: boolean;
  accessibilityDetectionSensitivity: number; // 0-1
}

const DEFAULT_CONFIG: BehaviorAnalyticsConfig = {
  maxInteractionsStored: 5000,
  patternAnalysisWindow: 7 * 24 * 60 * 60 * 1000, // 7 days
  minPatternOccurrences: 3,
  adaptationThreshold: 0.7,
  privacyMode: true,
  enableRealTimeAdaptation: true,
  accessibilityDetectionSensitivity: 0.8,
};

const STORAGE_KEYS = {
  INTERACTION_EVENTS: 'behavior_interaction_events',
  BEHAVIOR_PATTERNS: 'behavior_patterns',
  ADAPTATION_HISTORY: 'adaptation_history',
  ACCESSIBILITY_INSIGHTS: 'accessibility_insights',
} as const;

class BehaviorAnalyticsService {
  private config: BehaviorAnalyticsConfig;
  private interactions: UserInteractionEvent[] = [];
  private patterns: Map<string, BehaviorPattern> = new Map();
  private adaptations: Map<string, AdaptationRecommendation> = new Map();
  private accessibilityInsights: AccessibilityInsight[] = [];
  private currentSessionId: string | null = null;
  private sequenceCounter = 0;
  private analysisTimer: NodeJS.Timeout | null = null;
  private isInitialized = false;

  constructor(config: Partial<BehaviorAnalyticsConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the behavior analytics service
   */
  async initialize(): Promise<void> {
    try {
      await this.loadStoredData();
      this.startAnalysisTimer();
      this.isInitialized = true;

      structuredLogger.info('Behavior analytics service initialized', {
        storedInteractions: this.interactions.length,
        storedPatterns: this.patterns.size,
        adaptationsAvailable: this.adaptations.size,
      });
    } catch (error) {
      structuredLogger.error(
        'Failed to initialize behavior analytics',
        {},
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Start a new user session
   */
  startSession(gradeLevel: GradeLevel): string {
    this.currentSessionId = `behavior_session_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2)}`;
    this.sequenceCounter = 0;

    // Record session start
    this.recordInteraction({
      type: 'navigation',
      component: 'app',
      action: 'session_start',
      context: {
        screenName: 'home',
        gradeLevel,
        accessibilityMode: false,
        networkCondition: 'good',
      },
      deviceInfo: this.getCurrentDeviceMetrics(),
    });

    structuredLogger.info('Behavior analytics session started', {
      sessionId: this.currentSessionId,
      gradeLevel,
    });

    return this.currentSessionId;
  }

  /**
   * End the current session
   */
  endSession(): void {
    if (!this.currentSessionId) return;

    this.recordInteraction({
      type: 'navigation',
      component: 'app',
      action: 'session_end',
      context: {
        screenName: 'unknown',
        gradeLevel: this.getLastKnownGradeLevel(),
        accessibilityMode: false,
        networkCondition: 'good',
      },
      deviceInfo: this.getCurrentDeviceMetrics(),
    });

    // Analyze session patterns
    this.analyzeSessionPatterns();

    this.currentSessionId = null;
    this.sequenceCounter = 0;
  }

  /**
   * Record a user interaction
   */
  recordInteraction(interaction: Partial<UserInteractionEvent>): void {
    if (!this.currentSessionId) {
      structuredLogger.warn('Recording interaction without active session');
      return;
    }

    const completeInteraction: UserInteractionEvent = {
      id: this.generateInteractionId(),
      timestamp: Date.now(),
      sessionId: this.currentSessionId,
      sequence: ++this.sequenceCounter,
      deviceInfo: this.getCurrentDeviceMetrics(),
      ...interaction,
    } as UserInteractionEvent;

    // Anonymize sensitive data
    completeInteraction.context = this.anonymizeContext(
      completeInteraction.context,
    );

    this.interactions.push(completeInteraction);

    // Keep only recent interactions
    if (this.interactions.length > this.config.maxInteractionsStored) {
      this.interactions = this.interactions.slice(
        -this.config.maxInteractionsStored,
      );
    }

    // Real-time pattern analysis for critical patterns
    if (this.config.enableRealTimeAdaptation) {
      this.checkForCriticalPatterns(completeInteraction);
    }

    // Integrate with existing analytics
    this.integrateWithExistingAnalytics(completeInteraction);

    structuredLogger.debug('Interaction recorded', {
      type: completeInteraction.type,
      component: completeInteraction.component,
      action: completeInteraction.action,
    });
  }

  /**
   * Get behavior patterns for a specific type or all patterns
   */
  getBehaviorPatterns(type?: PatternType): BehaviorPattern[] {
    const allPatterns = Array.from(this.patterns.values());

    if (type) {
      return allPatterns.filter(pattern => pattern.type === type);
    }

    return allPatterns.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Get interface adaptation recommendations
   */
  getAdaptationRecommendations(component?: string): AdaptationRecommendation[] {
    const allAdaptations = Array.from(this.adaptations.values());

    if (component) {
      return allAdaptations.filter(
        adaptation => adaptation.component === component,
      );
    }

    return allAdaptations.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Get accessibility insights
   */
  getAccessibilityInsights(): AccessibilityInsight[] {
    return [...this.accessibilityInsights].sort((a, b) => {
      const severityOrder = { significant: 3, moderate: 2, minor: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  /**
   * Apply an adaptation recommendation
   */
  applyAdaptation(adaptationId: string): boolean {
    const adaptation = this.adaptations.get(adaptationId);
    if (!adaptation) {
      structuredLogger.warn('Adaptation not found', { adaptationId });
      return false;
    }

    try {
      // Record that this adaptation was applied
      this.recordInteraction({
        type: 'accessibility',
        component: adaptation.component,
        action: 'adaptation_applied',
        context: {
          screenName: 'system',
          gradeLevel: this.getLastKnownGradeLevel(),
          accessibilityMode: true,
          networkCondition: 'good',
        },
        deviceInfo: this.getCurrentDeviceMetrics(),
      });

      // Remove applied adaptation
      this.adaptations.delete(adaptationId);

      structuredLogger.info('Adaptation applied', {
        adaptationId,
        type: adaptation.type,
        component: adaptation.component,
      });

      return true;
    } catch (error) {
      structuredLogger.error(
        'Failed to apply adaptation',
        { adaptationId },
        error as Error,
      );
      return false;
    }
  }

  /**
   * Analyze interaction patterns and generate insights
   */
  async analyzePatterns(): Promise<{
    patterns: BehaviorPattern[];
    adaptations: AdaptationRecommendation[];
    insights: string[];
  }> {
    try {
      // Analyze different pattern types
      await Promise.all([
        this.analyzeNavigationPatterns(),
        this.analyzeInputPatterns(),
        this.analyzeAccessibilityPatterns(),
        this.analyzeErrorPatterns(),
        this.analyzeEngagementPatterns(),
      ]);

      // Generate adaptation recommendations based on patterns
      this.generateAdaptationRecommendations();

      // Generate human-readable insights
      const insights = this.generateInsights();

      // Save updated patterns and adaptations
      await this.saveData();

      return {
        patterns: this.getBehaviorPatterns(),
        adaptations: this.getAdaptationRecommendations(),
        insights,
      };
    } catch (error) {
      structuredLogger.error('Pattern analysis failed', {}, error as Error);
      return {
        patterns: [],
        adaptations: [],
        insights: ['Pattern analysis temporarily unavailable'],
      };
    }
  }

  // Private methods

  private async loadStoredData(): Promise<void> {
    try {
      const [interactions, patterns, adaptations, insights] = await Promise.all(
        [
          secureStorage.get<UserInteractionEvent[]>(
            STORAGE_KEYS.INTERACTION_EVENTS,
          ),
          secureStorage.get<Record<string, BehaviorPattern>>(
            STORAGE_KEYS.BEHAVIOR_PATTERNS,
          ),
          secureStorage.get<Record<string, AdaptationRecommendation>>(
            STORAGE_KEYS.ADAPTATION_HISTORY,
          ),
          secureStorage.get<AccessibilityInsight[]>(
            STORAGE_KEYS.ACCESSIBILITY_INSIGHTS,
          ),
        ],
      );

      this.interactions = interactions || [];
      this.patterns = new Map(Object.entries(patterns || {}));
      this.adaptations = new Map(Object.entries(adaptations || {}));
      this.accessibilityInsights = insights || [];

      // Clean expired data
      this.cleanExpiredData();
    } catch (error) {
      structuredLogger.error(
        'Failed to load behavior analytics data',
        {},
        error as Error,
      );
    }
  }

  private async saveData(): Promise<void> {
    try {
      await Promise.all([
        secureStorage.set(STORAGE_KEYS.INTERACTION_EVENTS, this.interactions),
        secureStorage.set(
          STORAGE_KEYS.BEHAVIOR_PATTERNS,
          Object.fromEntries(this.patterns),
        ),
        secureStorage.set(
          STORAGE_KEYS.ADAPTATION_HISTORY,
          Object.fromEntries(this.adaptations),
        ),
        secureStorage.set(
          STORAGE_KEYS.ACCESSIBILITY_INSIGHTS,
          this.accessibilityInsights,
        ),
      ]);
    } catch (error) {
      structuredLogger.error(
        'Failed to save behavior analytics data',
        {},
        error as Error,
      );
    }
  }

  private startAnalysisTimer(): void {
    // Analyze patterns every 5 minutes
    this.analysisTimer = setInterval(() => {
      this.analyzePatterns().catch(error => {
        structuredLogger.error('Scheduled pattern analysis failed', {}, error);
      });
    }, 5 * 60 * 1000);
  }

  private generateInteractionId(): string {
    return `interaction_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2)}`;
  }

  private getCurrentDeviceMetrics(): DeviceMetrics {
    // In a real implementation, this would gather actual device metrics
    return {
      screenSize: { width: 375, height: 812 }, // Default iOS size
      orientation: 'portrait',
      touchCapability: true,
      keyboardVisible: false,
      memoryWarning: false,
      performanceClass: 'medium',
    };
  }

  private getLastKnownGradeLevel(): GradeLevel {
    const recentInteraction = this.interactions
      .filter(i => i.context.gradeLevel)
      .slice(-1)[0];

    return recentInteraction?.context.gradeLevel || '3-5';
  }

  private anonymizeContext(context: InteractionContext): InteractionContext {
    const anonymized = { ...context };

    // Hash sensitive text inputs
    if (anonymized.inputText) {
      anonymized.inputText = this.hashString(anonymized.inputText);
    }

    if (anonymized.voiceCommand) {
      anonymized.voiceCommand = this.hashString(anonymized.voiceCommand);
    }

    return anonymized;
  }

  private hashString(input: string): string {
    if (!input || !this.config.privacyMode) return input;

    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return `hashed_${Math.abs(hash).toString(36)}`;
  }

  private integrateWithExistingAnalytics(
    interaction: UserInteractionEvent,
  ): void {
    // Convert behavior interaction to story analytics format
    if (
      interaction.type === 'input' &&
      interaction.action === 'story_request'
    ) {
      storyAnalytics.trackUserBehavior(
        'input_started',
        interaction.sessionId,
        interaction.sessionId, // Using session ID as user ID for privacy
        {
          inputLength:
            typeof interaction.context.inputText === 'string'
              ? interaction.context.inputText.length
              : 0,
        },
      );
    }

    // Update user preferences based on interaction patterns
    if (
      interaction.type === 'navigation' &&
      interaction.action === 'theme_selection'
    ) {
      userPreferencesService
        .recordInteraction('theme_selection', {
          theme: interaction.context.elementId,
          gradeLevel: interaction.context.gradeLevel,
        })
        .catch(error => {
          structuredLogger.error(
            'Failed to update user preferences',
            {},
            error,
          );
        });
    }
  }

  private checkForCriticalPatterns(interaction: UserInteractionEvent): void {
    // Check for immediate accessibility needs
    if (this.detectAccessibilityStruggle(interaction)) {
      this.generateAccessibilityRecommendation(interaction);
    }

    // Check for error patterns
    if (interaction.type === 'error_encounter') {
      this.analyzeErrorPattern(interaction);
    }

    // Check for help-seeking patterns
    if (interaction.type === 'help_seeking') {
      this.analyzeHelpSeekingPattern(interaction);
    }
  }

  private analyzeSessionPatterns(): void {
    if (!this.currentSessionId) return;

    const sessionInteractions = this.interactions.filter(
      i => i.sessionId === this.currentSessionId,
    );

    // Analyze navigation efficiency
    this.analyzeNavigationEfficiency(sessionInteractions);

    // Analyze input patterns
    this.analyzeInputEfficiency(sessionInteractions);

    // Update session-based patterns
    this.updateSessionBasedPatterns(sessionInteractions);
  }

  private async analyzeNavigationPatterns(): Promise<void> {
    const navigationInteractions = this.interactions.filter(
      i => i.type === 'navigation' && this.isWithinAnalysisWindow(i.timestamp),
    );

    // Group by navigation paths
    const pathGroups = new Map<string, UserInteractionEvent[]>();

    for (const interaction of navigationInteractions) {
      const path = interaction.context.screenName;
      if (!pathGroups.has(path)) {
        pathGroups.set(path, []);
      }
      pathGroups.get(path)!.push(interaction);
    }

    // Analyze each path for difficulties
    for (const [path, interactions] of pathGroups) {
      if (interactions.length >= this.config.minPatternOccurrences) {
        const avgDuration =
          interactions
            .filter(i => i.duration)
            .reduce((sum, i) => sum + (i.duration || 0), 0) /
          interactions.length;

        if (avgDuration > 5000) {
          // More than 5 seconds indicates difficulty
          this.createOrUpdatePattern({
            type: 'navigation_difficulty',
            triggers: [
              {
                condition: 'average_navigation_time',
                threshold: 5000,
                timeWindow: this.config.patternAnalysisWindow,
                description: `Navigation to ${path} takes longer than expected`,
              },
            ],
            impact: {
              userExperience: -0.6,
              taskCompletion: -0.4,
              learningOutcome: -0.2,
              accessibility: -0.3,
            },
            metadata: { path, avgDuration, occurrences: interactions.length },
          });
        }
      }
    }
  }

  private async analyzeInputPatterns(): Promise<void> {
    const inputInteractions = this.interactions.filter(
      i => i.type === 'input' && this.isWithinAnalysisWindow(i.timestamp),
    );

    // Analyze typing patterns for struggles
    const typingInteractions = inputInteractions.filter(
      i => i.action === 'text_input',
    );

    if (typingInteractions.length >= this.config.minPatternOccurrences) {
      // Look for patterns indicating input difficulty
      const longInputSessions = typingInteractions.filter(
        i => (i.duration || 0) > 30000, // More than 30 seconds
      );

      if (longInputSessions.length / typingInteractions.length > 0.3) {
        this.createOrUpdatePattern({
          type: 'input_struggle',
          triggers: [
            {
              condition: 'long_input_sessions',
              threshold: 30000,
              timeWindow: this.config.patternAnalysisWindow,
              description: 'User frequently spends long time on text input',
            },
          ],
          impact: {
            userExperience: -0.7,
            taskCompletion: -0.5,
            learningOutcome: -0.3,
            accessibility: -0.6,
          },
          metadata: {
            longSessionRate:
              longInputSessions.length / typingInteractions.length,
            avgDuration:
              typingInteractions.reduce(
                (sum, i) => sum + (i.duration || 0),
                0,
              ) / typingInteractions.length,
          },
        });
      }
    }
  }

  private async analyzeAccessibilityPatterns(): Promise<void> {
    const accessibilityInteractions = this.interactions.filter(
      i =>
        i.type === 'accessibility' && this.isWithinAnalysisWindow(i.timestamp),
    );

    // Analyze for accessibility needs
    const voiceInteractions = this.interactions.filter(
      i => i.type === 'voice' && this.isWithinAnalysisWindow(i.timestamp),
    );

    if (voiceInteractions.length > 0) {
      const voiceSuccessRate =
        voiceInteractions.filter(i => i.context.errorType === undefined)
          .length / voiceInteractions.length;

      if (voiceSuccessRate < 0.7) {
        this.createOrUpdatePattern({
          type: 'accessibility_need',
          triggers: [
            {
              condition: 'low_voice_success_rate',
              threshold: 0.7,
              timeWindow: this.config.patternAnalysisWindow,
              description: 'Voice commands frequently fail or misunderstood',
            },
          ],
          impact: {
            userExperience: -0.8,
            taskCompletion: -0.6,
            learningOutcome: -0.2,
            accessibility: -0.9,
          },
          metadata: {
            voiceSuccessRate,
            totalVoiceInteractions: voiceInteractions.length,
          },
        });

        // Generate accessibility insight
        this.accessibilityInsights.push({
          type: 'auditory',
          severity: voiceSuccessRate < 0.5 ? 'significant' : 'moderate',
          pattern: 'voice_recognition_difficulty',
          recommendation:
            'Consider implementing alternative input methods or improving voice recognition sensitivity',
          implementationNotes: [
            'Add visual feedback for voice commands',
            'Provide keyboard alternatives for all voice features',
            'Improve error recovery for voice inputs',
          ],
          wcagLevel: 'AA',
        });
      }
    }
  }

  private async analyzeErrorPatterns(): Promise<void> {
    const errorInteractions = this.interactions.filter(
      i =>
        i.type === 'error_encounter' &&
        this.isWithinAnalysisWindow(i.timestamp),
    );

    // Group errors by location
    const errorsByComponent = new Map<string, UserInteractionEvent[]>();

    for (const error of errorInteractions) {
      const component = error.component;
      if (!errorsByComponent.has(component)) {
        errorsByComponent.set(component, []);
      }
      errorsByComponent.get(component)!.push(error);
    }

    // Identify error-prone areas
    for (const [component, errors] of errorsByComponent) {
      if (errors.length >= this.config.minPatternOccurrences) {
        this.createOrUpdatePattern({
          type: 'error_prone_area',
          triggers: [
            {
              condition: 'frequent_errors_in_component',
              threshold: this.config.minPatternOccurrences,
              timeWindow: this.config.patternAnalysisWindow,
              description: `Frequent errors encountered in ${component}`,
            },
          ],
          impact: {
            userExperience: -0.9,
            taskCompletion: -0.7,
            learningOutcome: -0.4,
            accessibility: -0.5,
          },
          metadata: {
            component,
            errorCount: errors.length,
            errorTypes: [...new Set(errors.map(e => e.context.errorType))],
          },
        });
      }
    }
  }

  private async analyzeEngagementPatterns(): Promise<void> {
    const recentSessions = new Map<string, UserInteractionEvent[]>();

    // Group interactions by session
    for (const interaction of this.interactions) {
      if (!this.isWithinAnalysisWindow(interaction.timestamp)) continue;

      if (!recentSessions.has(interaction.sessionId)) {
        recentSessions.set(interaction.sessionId, []);
      }
      recentSessions.get(interaction.sessionId)!.push(interaction);
    }

    // Analyze session durations and engagement
    const sessionDurations: number[] = [];
    const engagementScores: number[] = [];

    for (const [sessionId, interactions] of recentSessions) {
      const sessionStart = Math.min(...interactions.map(i => i.timestamp));
      const sessionEnd = Math.max(...interactions.map(i => i.timestamp));
      const duration = sessionEnd - sessionStart;

      sessionDurations.push(duration);

      // Calculate engagement score based on interaction variety and frequency
      const interactionTypes = new Set(interactions.map(i => i.type));
      const engagementScore = Math.min(
        (interactionTypes.size / 5) * (interactions.length / 20),
        1,
      );
      engagementScores.push(engagementScore);
    }

    // Identify engagement patterns
    if (sessionDurations.length >= 3) {
      const avgDuration =
        sessionDurations.reduce((sum, d) => sum + d, 0) /
        sessionDurations.length;
      const avgEngagement =
        engagementScores.reduce((sum, e) => sum + e, 0) /
        engagementScores.length;

      if (avgEngagement < 0.3) {
        this.createOrUpdatePattern({
          type: 'engagement_drop',
          triggers: [
            {
              condition: 'low_engagement_score',
              threshold: 0.3,
              timeWindow: this.config.patternAnalysisWindow,
              description: 'User engagement levels are declining',
            },
          ],
          impact: {
            userExperience: -0.6,
            taskCompletion: -0.5,
            learningOutcome: -0.8,
            accessibility: -0.2,
          },
          metadata: {
            avgDuration: avgDuration,
            avgEngagement: avgEngagement,
            sessionCount: sessionDurations.length,
          },
        });
      }
    }
  }

  private generateAdaptationRecommendations(): void {
    for (const pattern of this.patterns.values()) {
      if (pattern.confidence >= this.config.adaptationThreshold) {
        const recommendations = this.createAdaptationsForPattern(pattern);
        for (const recommendation of recommendations) {
          this.adaptations.set(recommendation.id, recommendation);
        }
      }
    }
  }

  private createAdaptationsForPattern(
    pattern: BehaviorPattern,
  ): AdaptationRecommendation[] {
    const adaptations: AdaptationRecommendation[] = [];

    switch (pattern.type) {
      case 'navigation_difficulty':
        adaptations.push({
          id: `nav_adapt_${Date.now()}`,
          type: 'navigation_simplification',
          priority: 'high',
          component: pattern.metadata.path || 'navigation',
          changes: [
            {
              property: 'navigationStyle',
              currentValue: 'complex',
              recommendedValue: 'simplified',
              reason: 'Users are struggling with current navigation',
              testable: true,
            },
          ],
          confidence: pattern.confidence,
          reasoning: [
            `Users spend ${Math.round(
              pattern.metadata.avgDuration / 1000,
            )}s on average navigating to this area`,
            'This is significantly above the expected 2-3 second threshold',
            'Simplifying navigation could improve user experience',
          ],
          estimatedImpact: {
            userExperience: 0.6,
            taskCompletion: 0.4,
            learningOutcome: 0.2,
            accessibility: 0.5,
          },
          implementationComplexity: 'moderate',
        });
        break;

      case 'input_struggle':
        adaptations.push({
          id: `input_adapt_${Date.now()}`,
          type: 'input_assistance',
          priority: 'high',
          component: 'text_input',
          changes: [
            {
              property: 'inputAssistance',
              currentValue: 'basic',
              recommendedValue: 'enhanced',
              reason: 'Users frequently struggle with text input',
              testable: true,
            },
          ],
          confidence: pattern.confidence,
          reasoning: [
            'Users spend excessive time on text input tasks',
            'Adding predictive text and voice alternatives could help',
            'Consider larger touch targets and clearer visual feedback',
          ],
          estimatedImpact: {
            userExperience: 0.7,
            taskCompletion: 0.6,
            learningOutcome: 0.3,
            accessibility: 0.8,
          },
          implementationComplexity: 'moderate',
        });
        break;

      case 'accessibility_need':
        adaptations.push({
          id: `a11y_adapt_${Date.now()}`,
          type: 'accessibility_enhancement',
          priority: 'critical',
          component: 'voice_interface',
          changes: [
            {
              property: 'voiceRecognitionSensitivity',
              currentValue: 'standard',
              recommendedValue: 'high',
              reason:
                'Voice recognition success rate is below acceptable threshold',
              testable: true,
            },
          ],
          confidence: pattern.confidence,
          reasoning: [
            `Voice success rate is only ${Math.round(
              (pattern.metadata.voiceSuccessRate || 0) * 100,
            )}%`,
            'This creates significant accessibility barriers',
            'Enhanced voice recognition and fallback options needed',
          ],
          estimatedImpact: {
            userExperience: 0.8,
            taskCompletion: 0.7,
            learningOutcome: 0.2,
            accessibility: 0.9,
          },
          implementationComplexity: 'complex',
        });
        break;

      case 'error_prone_area':
        adaptations.push({
          id: `error_adapt_${Date.now()}`,
          type: 'layout_adjustment',
          priority: 'high',
          component: pattern.metadata.component || 'unknown',
          changes: [
            {
              property: 'errorPrevention',
              currentValue: 'basic',
              recommendedValue: 'enhanced',
              reason: 'High error frequency in this component',
              testable: true,
            },
          ],
          confidence: pattern.confidence,
          reasoning: [
            `${pattern.metadata.errorCount} errors detected in this component`,
            'Error types include: ' +
              (pattern.metadata.errorTypes || []).join(', '),
            'Enhanced error prevention and clearer UI needed',
          ],
          estimatedImpact: {
            userExperience: 0.8,
            taskCompletion: 0.7,
            learningOutcome: 0.4,
            accessibility: 0.6,
          },
          implementationComplexity: 'moderate',
        });
        break;
    }

    return adaptations;
  }

  private createOrUpdatePattern(
    patternData: Partial<BehaviorPattern> & { type: PatternType },
  ): void {
    const patternId = `${patternData.type}_${Date.now()}`;

    const pattern: BehaviorPattern = {
      id: patternId,
      confidence: 0.8,
      frequency: 1,
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      occurrenceCount: 1,
      impact: {
        userExperience: 0,
        taskCompletion: 0,
        learningOutcome: 0,
        accessibility: 0,
      },
      triggers: [],
      metadata: {},
      ...patternData,
    };

    this.patterns.set(patternId, pattern);
  }

  private detectAccessibilityStruggle(
    interaction: UserInteractionEvent,
  ): boolean {
    // Detect potential accessibility issues based on interaction patterns
    if (
      interaction.type === 'touch' &&
      interaction.duration &&
      interaction.duration > 5000
    ) {
      return true; // Long touch duration might indicate motor difficulty
    }

    if (
      interaction.type === 'navigation' &&
      interaction.action === 'back_repeatedly'
    ) {
      return true; // Repeated back navigation might indicate confusion
    }

    if (interaction.context.errorType) {
      return true; // Errors might indicate accessibility barriers
    }

    return false;
  }

  private generateAccessibilityRecommendation(
    interaction: UserInteractionEvent,
  ): void {
    // Generate immediate accessibility recommendations
    if (interaction.duration && interaction.duration > 5000) {
      this.accessibilityInsights.push({
        type: 'motor',
        severity: 'moderate',
        pattern: 'long_interaction_duration',
        recommendation:
          'Consider implementing larger touch targets and simplified gestures',
        implementationNotes: [
          'Increase minimum touch target size to 44x44 points',
          'Reduce required gesture precision',
          'Add alternative interaction methods',
        ],
        wcagLevel: 'AA',
      });
    }
  }

  private analyzeErrorPattern(interaction: UserInteractionEvent): void {
    // Immediate analysis of error patterns for quick fixes
    const recentErrors = this.interactions.filter(
      i =>
        i.type === 'error_encounter' &&
        i.component === interaction.component &&
        Date.now() - i.timestamp < 60000, // Last minute
    );

    if (recentErrors.length >= 2) {
      // Rapid error succession - critical issue
      this.adaptations.set(`error_critical_${Date.now()}`, {
        id: `error_critical_${Date.now()}`,
        type: 'layout_adjustment',
        priority: 'critical',
        component: interaction.component,
        changes: [
          {
            property: 'errorPrevention',
            currentValue: 'none',
            recommendedValue: 'immediate',
            reason: 'Multiple errors in rapid succession detected',
            testable: true,
          },
        ],
        confidence: 0.9,
        reasoning: [
          'Multiple errors occurring rapidly in the same component',
          'Immediate intervention needed to prevent user frustration',
          'Consider simplified interface or guided mode',
        ],
        estimatedImpact: {
          userExperience: 0.9,
          taskCompletion: 0.8,
          learningOutcome: 0.5,
          accessibility: 0.7,
        },
        implementationComplexity: 'simple',
      });
    }
  }

  private analyzeHelpSeekingPattern(interaction: UserInteractionEvent): void {
    // Track help-seeking patterns for proactive assistance
    const recentHelpSeeking = this.interactions.filter(
      i => i.type === 'help_seeking' && Date.now() - i.timestamp < 300000, // Last 5 minutes
    );

    if (recentHelpSeeking.length >= 2) {
      // User is struggling and seeking help repeatedly
      this.adaptations.set(`help_proactive_${Date.now()}`, {
        id: `help_proactive_${Date.now()}`,
        type: 'content_personalization',
        priority: 'high',
        component: 'help_system',
        changes: [
          {
            property: 'guidanceLevel',
            currentValue: 'on_demand',
            recommendedValue: 'proactive',
            reason: 'User frequently seeking help',
            testable: true,
          },
        ],
        confidence: 0.8,
        reasoning: [
          'User has sought help multiple times recently',
          'Proactive guidance could prevent confusion',
          'Consider contextual hints and step-by-step guidance',
        ],
        estimatedImpact: {
          userExperience: 0.7,
          taskCompletion: 0.8,
          learningOutcome: 0.6,
          accessibility: 0.5,
        },
        implementationComplexity: 'moderate',
      });
    }
  }

  private analyzeNavigationEfficiency(
    interactions: UserInteractionEvent[],
  ): void {
    const navigationInteractions = interactions.filter(
      i => i.type === 'navigation',
    );

    // Calculate navigation efficiency metrics
    const screens = [
      ...new Set(navigationInteractions.map(i => i.context.screenName)),
    ];
    const avgTimePerScreen =
      navigationInteractions
        .filter(i => i.duration)
        .reduce((sum, i) => sum + (i.duration || 0), 0) /
      Math.max(navigationInteractions.length, 1);

    if (avgTimePerScreen > 3000) {
      // More than 3 seconds per navigation
      this.createOrUpdatePattern({
        type: 'navigation_difficulty',
        triggers: [
          {
            condition: 'slow_navigation',
            threshold: 3000,
            timeWindow: this.config.patternAnalysisWindow,
            description: 'Session navigation is slower than expected',
          },
        ],
        impact: {
          userExperience: -0.5,
          taskCompletion: -0.3,
          learningOutcome: -0.1,
          accessibility: -0.4,
        },
        metadata: {
          sessionId: interactions[0]?.sessionId,
          avgTimePerScreen,
          screensVisited: screens.length,
        },
      });
    }
  }

  private analyzeInputEfficiency(interactions: UserInteractionEvent[]): void {
    const inputInteractions = interactions.filter(i => i.type === 'input');

    if (inputInteractions.length === 0) return;

    const avgInputDuration =
      inputInteractions
        .filter(i => i.duration)
        .reduce((sum, i) => sum + (i.duration || 0), 0) /
      Math.max(inputInteractions.length, 1);

    if (avgInputDuration > 15000) {
      // More than 15 seconds per input
      this.createOrUpdatePattern({
        type: 'input_struggle',
        triggers: [
          {
            condition: 'slow_input',
            threshold: 15000,
            timeWindow: this.config.patternAnalysisWindow,
            description: 'Session input tasks take longer than expected',
          },
        ],
        impact: {
          userExperience: -0.6,
          taskCompletion: -0.5,
          learningOutcome: -0.3,
          accessibility: -0.7,
        },
        metadata: {
          sessionId: interactions[0]?.sessionId,
          avgInputDuration,
          inputCount: inputInteractions.length,
        },
      });
    }
  }

  private updateSessionBasedPatterns(
    interactions: UserInteractionEvent[],
  ): void {
    // Update patterns that are specific to session behavior
    const errorRate =
      interactions.filter(i => i.type === 'error_encounter').length /
      Math.max(interactions.length, 1);
    const helpSeekingRate =
      interactions.filter(i => i.type === 'help_seeking').length /
      Math.max(interactions.length, 1);

    if (errorRate > 0.1) {
      // More than 10% of interactions are errors
      this.createOrUpdatePattern({
        type: 'error_prone_area',
        triggers: [
          {
            condition: 'high_session_error_rate',
            threshold: 0.1,
            timeWindow: this.config.patternAnalysisWindow,
            description: 'High error rate during session',
          },
        ],
        impact: {
          userExperience: -0.8,
          taskCompletion: -0.7,
          learningOutcome: -0.4,
          accessibility: -0.6,
        },
        metadata: {
          sessionId: interactions[0]?.sessionId,
          errorRate,
          totalInteractions: interactions.length,
        },
      });
    }

    if (helpSeekingRate > 0.15) {
      // More than 15% of interactions are help-seeking
      this.createOrUpdatePattern({
        type: 'help_seeking',
        triggers: [
          {
            condition: 'high_session_help_rate',
            threshold: 0.15,
            timeWindow: this.config.patternAnalysisWindow,
            description: 'User frequently seeks help during session',
          },
        ],
        impact: {
          userExperience: -0.4,
          taskCompletion: -0.5,
          learningOutcome: -0.6,
          accessibility: -0.3,
        },
        metadata: {
          sessionId: interactions[0]?.sessionId,
          helpSeekingRate,
          totalInteractions: interactions.length,
        },
      });
    }
  }

  private generateInsights(): string[] {
    const insights: string[] = [];
    const patterns = this.getBehaviorPatterns();

    // Generate insights based on detected patterns
    const criticalPatterns = patterns.filter(p => p.confidence > 0.8);
    if (criticalPatterns.length > 0) {
      insights.push(
        `Detected ${criticalPatterns.length} high-confidence behavior patterns requiring attention`,
      );
    }

    const accessibilityPatterns = patterns.filter(
      p => p.type === 'accessibility_need',
    );
    if (accessibilityPatterns.length > 0) {
      insights.push(
        `Identified ${accessibilityPatterns.length} accessibility improvement opportunities`,
      );
    }

    const navigationIssues = patterns.filter(
      p => p.type === 'navigation_difficulty',
    );
    if (navigationIssues.length > 0) {
      insights.push(
        `Navigation efficiency could be improved in ${navigationIssues.length} areas`,
      );
    }

    const inputStruggles = patterns.filter(p => p.type === 'input_struggle');
    if (inputStruggles.length > 0) {
      insights.push(
        'Text input assistance features recommended based on usage patterns',
      );
    }

    const adaptations = this.getAdaptationRecommendations();
    const criticalAdaptations = adaptations.filter(
      a => a.priority === 'critical',
    );
    if (criticalAdaptations.length > 0) {
      insights.push(
        `${criticalAdaptations.length} critical interface adaptations available for immediate implementation`,
      );
    }

    if (insights.length === 0) {
      insights.push(
        'No significant behavior patterns detected - user experience appears optimal',
      );
    }

    return insights;
  }

  private isWithinAnalysisWindow(timestamp: number): boolean {
    return Date.now() - timestamp <= this.config.patternAnalysisWindow;
  }

  private cleanExpiredData(): void {
    const cutoff = Date.now() - this.config.patternAnalysisWindow;

    // Remove old interactions
    this.interactions = this.interactions.filter(i => i.timestamp > cutoff);

    // Remove old patterns
    for (const [id, pattern] of this.patterns) {
      if (pattern.lastSeen < cutoff) {
        this.patterns.delete(id);
      }
    }

    // Clean old adaptations
    for (const [id, adaptation] of this.adaptations) {
      // Remove adaptations older than 24 hours
      if (
        Date.now() - parseInt(id.split('_').pop() || '0') >
        24 * 60 * 60 * 1000
      ) {
        this.adaptations.delete(id);
      }
    }
  }

  /**
   * Get usage metrics for debugging and monitoring
   */
  getUsageMetrics(): {
    totalInteractions: number;
    patternsDetected: number;
    adaptationsAvailable: number;
    accessibilityInsights: number;
    sessionCount: number;
    avgSessionDuration: number;
  } {
    const sessions = new Map<string, number>();
    let totalDuration = 0;

    for (const interaction of this.interactions) {
      if (!sessions.has(interaction.sessionId)) {
        sessions.set(interaction.sessionId, 0);
      }
      const sessionStart = Math.min(
        ...this.interactions
          .filter(i => i.sessionId === interaction.sessionId)
          .map(i => i.timestamp),
      );
      const sessionEnd = Math.max(
        ...this.interactions
          .filter(i => i.sessionId === interaction.sessionId)
          .map(i => i.timestamp),
      );
      sessions.set(interaction.sessionId, sessionEnd - sessionStart);
    }

    totalDuration = Array.from(sessions.values()).reduce(
      (sum, d) => sum + d,
      0,
    );

    return {
      totalInteractions: this.interactions.length,
      patternsDetected: this.patterns.size,
      adaptationsAvailable: this.adaptations.size,
      accessibilityInsights: this.accessibilityInsights.length,
      sessionCount: sessions.size,
      avgSessionDuration: sessions.size > 0 ? totalDuration / sessions.size : 0,
    };
  }

  /**
   * Clean up and save data when shutting down
   */
  async shutdown(): Promise<void> {
    if (this.analysisTimer) {
      clearInterval(this.analysisTimer);
      this.analysisTimer = null;
    }

    await this.saveData();

    structuredLogger.info('Behavior analytics service shutdown completed');
  }
}

// Export singleton instance
export const behaviorAnalytics = new BehaviorAnalyticsService();
export default BehaviorAnalyticsService;
