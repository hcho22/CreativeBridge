/**
 * Reading Comprehension Optimizer Service
 * 
 * Educational reading comprehension enhancement and optimization features
 * Task 7.2: Dynamic UI Optimization - Subtask 4
 */

import { structuredLogger } from '../utils/logger';
import { behaviorAnalyticsService } from './behaviorAnalytics';
import { engagementOptimizer } from './engagementOptimizer';
import { uiPerformanceMonitor } from './uiPerformanceMonitor';
import { GradeLevel } from '../types/database';

export interface ReadingEvent {
  id: string;
  type: 'reading_start' | 'reading_pause' | 'reading_resume' | 'reading_complete' | 'word_lookup' | 'reread_section' | 'highlight_text' | 'reading_assistance' | 'comprehension_question';
  timestamp: number;
  sessionId: string;
  contentId: string;
  context: {
    gradeLevel: GradeLevel;
    readingSpeed: number; // words per minute
    comprehensionLevel: number; // 0-1 estimated based on behavior
    textComplexity: number; // 0-1 complexity score
    position: {
      wordIndex: number;
      percentageComplete: number;
      currentSentence: string;
      currentParagraph: number;
    };
  };
  metadata: Record<string, any>;
}

export interface ReadingPattern {
  id: string;
  patternType: 'fluent_reading' | 'struggling_reader' | 'skipping_behavior' | 'high_comprehension' | 'vocabulary_gaps' | 'attention_issues' | 'advanced_reader' | 'assistance_seeking';
  confidence: number;
  detectedAt: number;
  indicators: string[];
  associatedEvents: ReadingEvent[];
  readingMetrics: {
    averageSpeed: number;
    pauseFrequency: number;
    rereadsCount: number;
    vocabularyLookups: number;
    attentionSpan: number; // seconds
  };
  recommendedOptimizations: ReadingOptimization[];
}

export interface ReadingOptimization {
  id: string;
  type: 'text_simplification' | 'vocabulary_assistance' | 'reading_pace_adjustment' | 'comprehension_aids' | 'visual_enhancements' | 'interactive_features' | 'progress_feedback' | 'adaptive_questioning';
  priority: number;
  expectedImpact: number;
  targetPattern: string;
  implementation: {
    textModifications: TextModification[];
    uiChanges: UIReadingChange[];
    assistanceFeatures: AssistanceFeature[];
  };
  gradeLevelAdaptation: Record<GradeLevel, any>;
  validationCriteria: string[];
  appliedAt?: number;
  effectiveness?: number;
}

export interface TextModification {
  modificationType: 'sentence_simplification' | 'vocabulary_replacement' | 'paragraph_chunking' | 'concept_explanation' | 'context_enhancement' | 'structure_improvement';
  target: string; // Text selection or identifier
  originalText: string;
  modifiedText: string;
  reasoning: string;
  reversible: boolean;
}

export interface UIReadingChange {
  changeType: 'font_adjustment' | 'line_spacing' | 'highlight_current' | 'progress_visualization' | 'reading_guides' | 'focus_mode' | 'interactive_elements';
  target: string;
  properties: Record<string, any>;
  gradeSpecific: boolean;
}

export interface AssistanceFeature {
  featureType: 'word_pronunciation' | 'definition_popup' | 'concept_linking' | 'comprehension_hints' | 'reading_buddy' | 'pace_guidance' | 'break_reminders';
  trigger: string; // When to activate
  properties: Record<string, any>;
  adaptToUser: boolean;
}

export interface ComprehensionMetrics {
  readingSpeed: number; // WPM
  comprehensionScore: number; // 0-1
  vocabularyLevel: number; // Grade level equivalent
  attentionSpan: number; // Average sustained reading time
  strugglingIndicators: string[];
  strengths: string[];
  improvementAreas: string[];
  recommendedLevel: GradeLevel;
}

interface ReadingConfig {
  enabled: boolean;
  analysisInterval: number; // milliseconds
  adaptationThreshold: number; // minimum confidence for optimizations
  gradeLevelBaselines: Record<GradeLevel, {
    expectedReadingSpeed: number; // WPM
    averageAttentionSpan: number; // seconds
    vocabularyThreshold: number; // complexity level
    comprehensionTarget: number; // 0-1
  }>;
  optimizationSettings: {
    maxTextSimplification: number; // 0-1, how much to simplify
    assistanceDelay: number; // ms before offering help
    adaptationSensitivity: number; // how quickly to adapt
    preserveEducationalValue: boolean;
  };
}

const DEFAULT_CONFIG: ReadingConfig = {
  enabled: true,
  analysisInterval: 30000, // 30 seconds
  adaptationThreshold: 0.6,
  gradeLevelBaselines: {
    'K-2': {
      expectedReadingSpeed: 60,
      averageAttentionSpan: 120, // 2 minutes
      vocabularyThreshold: 0.3,
      comprehensionTarget: 0.7,
    },
    '3-5': {
      expectedReadingSpeed: 120,
      averageAttentionSpan: 300, // 5 minutes
      vocabularyThreshold: 0.5,
      comprehensionTarget: 0.75,
    },
    '6-8': {
      expectedReadingSpeed: 160,
      averageAttentionSpan: 600, // 10 minutes
      vocabularyThreshold: 0.7,
      comprehensionTarget: 0.8,
    },
    '9-12': {
      expectedReadingSpeed: 200,
      averageAttentionSpan: 900, // 15 minutes
      vocabularyThreshold: 0.9,
      comprehensionTarget: 0.85,
    },
  },
  optimizationSettings: {
    maxTextSimplification: 0.3, // Maximum 30% simplification
    assistanceDelay: 10000, // 10 seconds
    adaptationSensitivity: 0.1,
    preserveEducationalValue: true,
  },
};

class ReadingComprehensionOptimizerService {
  private config: ReadingConfig;
  private events: ReadingEvent[] = [];
  private patterns: ReadingPattern[] = [];
  private optimizations: ReadingOptimization[] = [];
  private currentReadingSession: {
    contentId: string;
    startTime: number;
    wordCount: number;
    currentPosition: number;
    pauseCount: number;
    lastActivityTime: number;
  } | null = null;
  private sessionId: string | null = null;
  private analysisTimer: NodeJS.Timeout | null = null;
  private isInitialized = false;

  constructor(config: Partial<ReadingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize reading comprehension optimizer
   */
  async initialize(sessionId: string, gradeLevel: GradeLevel): Promise<void> {
    try {
      this.sessionId = sessionId;
      
      // Start analysis if enabled
      if (this.config.enabled) {
        this.startAnalysis();
      }
      
      this.isInitialized = true;
      
      structuredLogger.info('Reading Comprehension Optimizer initialized', {
        sessionId,
        gradeLevel,
        analysisInterval: this.config.analysisInterval,
        baselineSpeed: this.config.gradeLevelBaselines[gradeLevel].expectedReadingSpeed,
      });
    } catch (error) {
      structuredLogger.error('Failed to initialize Reading Comprehension Optimizer', {}, error as Error);
      throw error;
    }
  }

  /**
   * Start reading session
   */
  startReadingSession(contentId: string, wordCount: number): void {
    if (!this.isInitialized) return;

    this.currentReadingSession = {
      contentId,
      startTime: Date.now(),
      wordCount,
      currentPosition: 0,
      pauseCount: 0,
      lastActivityTime: Date.now(),
    };

    this.recordReadingEvent('reading_start', contentId, {
      wordIndex: 0,
      percentageComplete: 0,
      currentSentence: '',
      currentParagraph: 0,
    });
  }

  /**
   * Record reading event
   */
  recordReadingEvent(
    type: ReadingEvent['type'],
    contentId: string,
    position: ReadingEvent['context']['position'],
    context?: Partial<ReadingEvent['context']>,
    metadata: Record<string, any> = {}
  ): void {
    if (!this.isInitialized || !this.sessionId) return;

    const event: ReadingEvent = {
      id: this.generateEventId(),
      type,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      contentId,
      context: {
        gradeLevel: context?.gradeLevel || 'Grade3',
        readingSpeed: context?.readingSpeed || this.calculateCurrentReadingSpeed(),
        comprehensionLevel: context?.comprehensionLevel || this.estimateComprehensionLevel(),
        textComplexity: context?.textComplexity || this.calculateTextComplexity(position.currentSentence),
        position,
      },
      metadata,
    };

    this.events.push(event);
    this.updateReadingSession(event);
    this.analyzeReadingBehavior(event);

    // Record with other analytics services
    this.recordWithOtherServices(event);
  }

  /**
   * Get current comprehension metrics
   */
  getCurrentComprehensionMetrics(): ComprehensionMetrics {
    if (!this.currentReadingSession || this.events.length === 0) {
      return this.getDefaultMetrics();
    }

    const recentEvents = this.events.filter(e => 
      e.contentId === this.currentReadingSession.contentId &&
      Date.now() - e.timestamp < 300000 // Last 5 minutes
    );

    const readingSpeed = this.calculateReadingSpeed(recentEvents);
    const comprehensionScore = this.estimateComprehensionScore(recentEvents);
    const vocabularyLevel = this.estimateVocabularyLevel(recentEvents);
    const attentionSpan = this.calculateAttentionSpan(recentEvents);

    return {
      readingSpeed,
      comprehensionScore,
      vocabularyLevel,
      attentionSpan,
      strugglingIndicators: this.identifyStrugglingIndicators(recentEvents),
      strengths: this.identifyStrengths(recentEvents),
      improvementAreas: this.identifyImprovementAreas(recentEvents),
      recommendedLevel: this.recommendGradeLevel(readingSpeed, comprehensionScore, vocabularyLevel),
    };
  }

  /**
   * Get reading patterns
   */
  getReadingPatterns(patternType?: ReadingPattern['patternType']): ReadingPattern[] {
    let patterns = this.patterns;
    
    if (patternType) {
      patterns = patterns.filter(p => p.patternType === patternType);
    }

    return patterns.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Apply reading optimization
   */
  async applyReadingOptimization(optimizationId: string): Promise<boolean> {
    try {
      const optimization = this.optimizations.find(o => o.id === optimizationId);
      if (!optimization || optimization.appliedAt) {
        structuredLogger.warn('Reading optimization not found or already applied', { optimizationId });
        return false;
      }

      // Execute the optimization
      await this.executeReadingOptimization(optimization);
      
      optimization.appliedAt = Date.now();

      structuredLogger.info('Reading optimization applied', {
        optimizationId,
        type: optimization.type,
        expectedImpact: optimization.expectedImpact,
        textModificationsCount: optimization.implementation.textModifications.length,
        uiChangesCount: optimization.implementation.uiChanges.length,
      });

      return true;
    } catch (error) {
      structuredLogger.error('Failed to apply reading optimization', { optimizationId }, error as Error);
      return false;
    }
  }

  /**
   * Get optimization effectiveness
   */
  getOptimizationEffectiveness(): {
    overall: number;
    byType: Record<string, number>;
    recentOptimizations: Array<{
      id: string;
      type: string;
      effectiveness: number;
      appliedAt: number;
    }>;
  } {
    const appliedOptimizations = this.optimizations.filter(o => 
      o.appliedAt && o.effectiveness !== undefined
    );

    const overall = appliedOptimizations.length > 0
      ? appliedOptimizations.reduce((sum, o) => sum + (o.effectiveness || 0), 0) / appliedOptimizations.length
      : 0;

    const byType: Record<string, number> = {};
    appliedOptimizations.forEach(o => {
      if (!byType[o.type]) {
        byType[o.type] = 0;
      }
      byType[o.type] += (o.effectiveness || 0);
    });

    Object.keys(byType).forEach(type => {
      const count = appliedOptimizations.filter(o => o.type === type).length;
      if (count > 0) {
        byType[type] /= count;
      }
    });

    const recentOptimizations = appliedOptimizations
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
      recentOptimizations,
    };
  }

  /**
   * Private helper methods
   */
  private generateEventId(): string {
    return `reading_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  private calculateCurrentReadingSpeed(): number {
    if (!this.currentReadingSession) return 100; // Default speed

    const timeElapsed = (Date.now() - this.currentReadingSession.startTime) / 1000 / 60; // minutes
    const wordsRead = this.currentReadingSession.currentPosition;

    return timeElapsed > 0 ? wordsRead / timeElapsed : 100;
  }

  private estimateComprehensionLevel(): number {
    const recentEvents = this.events.filter(e => 
      Date.now() - e.timestamp < 60000 // Last minute
    );

    // Higher comprehension if fewer lookups and re-reads
    const lookups = recentEvents.filter(e => e.type === 'word_lookup').length;
    const rereads = recentEvents.filter(e => e.type === 'reread_section').length;
    const pauses = recentEvents.filter(e => e.type === 'reading_pause').length;

    const struggleScore = (lookups + rereads + pauses) / Math.max(recentEvents.length, 1);
    return Math.max(0.2, 1 - struggleScore);
  }

  private calculateTextComplexity(sentence: string): number {
    if (!sentence) return 0.5;

    const words = sentence.split(' ');
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
    const sentenceLength = words.length;

    // Simple complexity based on word and sentence length
    const wordComplexity = Math.min(avgWordLength / 8, 1); // Normalize to 8-letter average
    const sentenceComplexity = Math.min(sentenceLength / 20, 1); // Normalize to 20-word average

    return (wordComplexity + sentenceComplexity) / 2;
  }

  private updateReadingSession(event: ReadingEvent): void {
    if (!this.currentReadingSession) return;

    switch (event.type) {
      case 'reading_pause':
        this.currentReadingSession.pauseCount++;
        break;
      case 'reading_resume':
      case 'reading_start':
        this.currentReadingSession.lastActivityTime = Date.now();
        break;
    }

    this.currentReadingSession.currentPosition = event.context.position.wordIndex;
  }

  private analyzeReadingBehavior(event: ReadingEvent): void {
    // Real-time analysis for immediate interventions
    if (event.type === 'word_lookup' && this.shouldOfferVocabularyAssistance(event)) {
      this.generateVocabularyOptimization(event);
    }

    if (event.type === 'reading_pause' && this.shouldOfferReadingAssistance(event)) {
      this.generateReadingAssistanceOptimization(event);
    }
  }

  private shouldOfferVocabularyAssistance(event: ReadingEvent): boolean {
    const recentLookups = this.events.filter(e => 
      e.type === 'word_lookup' &&
      e.contentId === event.contentId &&
      Date.now() - e.timestamp < 120000 // Last 2 minutes
    ).length;

    return recentLookups > 3; // More than 3 lookups in 2 minutes
  }

  private shouldOfferReadingAssistance(event: ReadingEvent): boolean {
    const timeSinceLastActivity = Date.now() - (this.currentReadingSession?.lastActivityTime || Date.now());
    return timeSinceLastActivity > this.config.optimizationSettings.assistanceDelay;
  }

  private generateVocabularyOptimization(triggerEvent: ReadingEvent): void {
    const optimization: ReadingOptimization = {
      id: this.generateOptimizationId(),
      type: 'vocabulary_assistance',
      priority: 4,
      expectedImpact: 0.5,
      targetPattern: 'vocabulary_gaps',
      implementation: {
        textModifications: [{
          modificationType: 'vocabulary_replacement',
          target: triggerEvent.context.position.currentSentence,
          originalText: triggerEvent.metadata.word || '',
          modifiedText: triggerEvent.metadata.simpleAlternative || '',
          reasoning: 'High vocabulary lookup frequency detected',
          reversible: true,
        }],
        uiChanges: [{
          changeType: 'interactive_elements',
          target: '.reading-content',
          properties: {
            vocabularyAssistance: true,
            definitionTooltips: true,
            synonymSuggestions: true,
          },
          gradeSpecific: true,
        }],
        assistanceFeatures: [{
          featureType: 'definition_popup',
          trigger: 'word_click',
          properties: {
            showDefinition: true,
            showPronunciation: true,
            showExamples: true,
          },
          adaptToUser: true,
        }],
      },
      gradeLevelAdaptation: {
        'K-2': { simplificationLevel: 0.8, visualAids: true },
        '3-5': { simplificationLevel: 0.6, contextClues: true },
        '6-8': { simplificationLevel: 0.4, etymologyHints: true },
        '9-12': { simplificationLevel: 0.2, advancedContext: true },
      },
      validationCriteria: ['vocabulary_lookup_reduction', 'comprehension_improvement'],
    };

    this.optimizations.push(optimization);
    
    // Auto-apply high priority vocabulary optimizations
    if (optimization.priority >= 4) {
      this.applyReadingOptimization(optimization.id);
    }
  }

  private generateReadingAssistanceOptimization(triggerEvent: ReadingEvent): void {
    const optimization: ReadingOptimization = {
      id: this.generateOptimizationId(),
      type: 'comprehension_aids',
      priority: 3,
      expectedImpact: 0.4,
      targetPattern: 'attention_issues',
      implementation: {
        textModifications: [],
        uiChanges: [{
          changeType: 'focus_mode',
          target: '.reading-content',
          properties: {
            highlightCurrentSentence: true,
            dimOtherContent: true,
            progressIndicator: true,
          },
          gradeSpecific: true,
        }],
        assistanceFeatures: [{
          featureType: 'reading_buddy',
          trigger: 'inactivity_detected',
          properties: {
            encouragementMessages: true,
            readingTips: true,
            breakSuggestions: true,
          },
          adaptToUser: true,
        }],
      },
      gradeLevelAdaptation: {
        'K-2': { encouragement: 'high', breakFrequency: 'frequent' },
        '3-5': { encouragement: 'medium', tips: 'basic' },
        '6-8': { encouragement: 'low', tips: 'intermediate' },
        '9-12': { encouragement: 'minimal', tips: 'advanced' },
      },
      validationCriteria: ['attention_span_increase', 'reading_completion_rate'],
    };

    this.optimizations.push(optimization);
  }

  private generateOptimizationId(): string {
    return `reading_opt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  }

  private recordWithOtherServices(event: ReadingEvent): void {
    // Record with behavior analytics
    if (behaviorAnalyticsService) {
      behaviorAnalyticsService.recordInteraction({
        component: 'reading_content',
        action: event.type,
        context: {
          contentId: event.contentId,
          position: event.context.position.percentageComplete,
          readingSpeed: event.context.readingSpeed,
        },
        duration: event.type === 'reading_pause' ? 
          (Date.now() - this.currentReadingSession?.lastActivityTime!) : undefined,
      });
    }

    // Record with engagement optimizer
    if (engagementOptimizer) {
      let engagementValue = 0.5;
      
      switch (event.type) {
        case 'reading_start':
        case 'reading_resume':
          engagementValue = 0.8;
          break;
        case 'reading_complete':
          engagementValue = 1.0;
          break;
        case 'reading_pause':
          engagementValue = 0.2;
          break;
        case 'word_lookup':
        case 'highlight_text':
          engagementValue = 0.7;
          break;
      }

      engagementOptimizer.recordEngagementMetric(
        'content_engagement',
        engagementValue,
        'reading_content',
        'reading_optimizer',
        event.context
      );
    }

    // Record with UI performance monitor
    if (uiPerformanceMonitor && event.type === 'reading_start') {
      uiPerformanceMonitor.recordRenderPerformance(
        'reading_content',
        'reading_screen',
        16.67, // Assume 60fps
        event.context
      );
    }
  }

  private startAnalysis(): void {
    this.analysisTimer = setInterval(() => {
      this.performPeriodicAnalysis();
    }, this.config.analysisInterval);
  }

  private performPeriodicAnalysis(): void {
    try {
      // Detect reading patterns
      this.detectReadingPatterns();
      
      // Generate optimizations
      this.generatePeriodicOptimizations();
      
      // Measure optimization effectiveness
      this.measureOptimizationEffectiveness();
      
      // Clean up old data
      this.cleanupOldData();
      
      structuredLogger.debug('Reading comprehension analysis completed', {
        eventsCount: this.events.length,
        patternsDetected: this.patterns.length,
        optimizationsGenerated: this.optimizations.length,
        currentSession: !!this.currentReadingSession,
      });
    } catch (error) {
      structuredLogger.error('Reading comprehension analysis failed', {}, error as Error);
    }
  }

  private detectReadingPatterns(): void {
    const recentEvents = this.events.filter(e => 
      Date.now() - e.timestamp < this.config.analysisInterval * 3
    );

    if (recentEvents.length < 5) return; // Need sufficient data

    // Detect struggling reader pattern
    if (this.detectStrugglingReader(recentEvents)) {
      this.createReadingPattern('struggling_reader', recentEvents);
    }

    // Detect fluent reader pattern
    if (this.detectFluentReader(recentEvents)) {
      this.createReadingPattern('fluent_reading', recentEvents);
    }

    // Detect vocabulary gaps
    if (this.detectVocabularyGaps(recentEvents)) {
      this.createReadingPattern('vocabulary_gaps', recentEvents);
    }

    // Detect attention issues
    if (this.detectAttentionIssues(recentEvents)) {
      this.createReadingPattern('attention_issues', recentEvents);
    }
  }

  private detectStrugglingReader(events: ReadingEvent[]): boolean {
    const lookups = events.filter(e => e.type === 'word_lookup').length;
    const rereads = events.filter(e => e.type === 'reread_section').length;
    const pauses = events.filter(e => e.type === 'reading_pause').length;
    
    const avgReadingSpeed = events
      .filter(e => e.context.readingSpeed > 0)
      .reduce((sum, e) => sum + e.context.readingSpeed, 0) / events.length || 100;

    const expectedSpeed = this.config.gradeLevelBaselines['Grade3'].expectedReadingSpeed; // Default

    return (lookups + rereads) > events.length * 0.2 || 
           pauses > events.length * 0.3 ||
           avgReadingSpeed < expectedSpeed * 0.7;
  }

  private detectFluentReader(events: ReadingEvent[]): boolean {
    const avgReadingSpeed = events
      .filter(e => e.context.readingSpeed > 0)
      .reduce((sum, e) => sum + e.context.readingSpeed, 0) / events.length || 100;

    const avgComprehension = events
      .reduce((sum, e) => sum + e.context.comprehensionLevel, 0) / events.length;

    const expectedSpeed = this.config.gradeLevelBaselines['Grade3'].expectedReadingSpeed; // Default

    return avgReadingSpeed > expectedSpeed * 1.2 && avgComprehension > 0.8;
  }

  private detectVocabularyGaps(events: ReadingEvent[]): boolean {
    const lookups = events.filter(e => e.type === 'word_lookup').length;
    const totalEvents = events.length;

    return lookups > totalEvents * 0.15; // More than 15% vocabulary lookups
  }

  private detectAttentionIssues(events: ReadingEvent[]): boolean {
    const pauses = events.filter(e => e.type === 'reading_pause').length;
    const longPauses = events.filter(e => 
      e.type === 'reading_pause' && 
      (e.metadata.pauseDuration || 0) > 30000 // 30+ seconds
    ).length;

    return pauses > events.length * 0.4 || longPauses > 2;
  }

  private createReadingPattern(
    patternType: ReadingPattern['patternType'],
    events: ReadingEvent[]
  ): void {
    
    const existingPattern = this.patterns.find(p => p.patternType === patternType);
    
    if (existingPattern) {
      // Update existing pattern
      existingPattern.confidence = Math.min(1, existingPattern.confidence + 0.1);
      existingPattern.associatedEvents.push(...events);
      existingPattern.readingMetrics = this.calculateReadingMetrics(
        [...existingPattern.associatedEvents, ...events]
      );
    } else {
      // Create new pattern
      const pattern: ReadingPattern = {
        id: `pattern_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        patternType,
        confidence: this.calculatePatternConfidence(patternType, events),
        detectedAt: Date.now(),
        indicators: this.identifyPatternIndicators(patternType, events),
        associatedEvents: events,
        readingMetrics: this.calculateReadingMetrics(events),
        recommendedOptimizations: this.generatePatternOptimizations(patternType, events),
      };

      if (pattern.confidence >= this.config.adaptationThreshold) {
        this.patterns.push(pattern);
        
        structuredLogger.info('Reading pattern detected', {
          patternType,
          confidence: pattern.confidence,
          indicators: pattern.indicators,
          recommendationsCount: pattern.recommendedOptimizations.length,
        });
      }
    }
  }

  private calculatePatternConfidence(patternType: ReadingPattern['patternType'], events: ReadingEvent[]): number {
    const sampleSizeConfidence = Math.min(events.length / 10, 1);
    
    let patternStrengthConfidence = 0.5;
    
    switch (patternType) {
      case 'struggling_reader':
        const strugglingEvents = events.filter(e => 
          ['word_lookup', 'reread_section', 'reading_assistance'].includes(e.type)
        ).length;
        patternStrengthConfidence = Math.min(strugglingEvents / events.length * 2, 1);
        break;
        
      case 'fluent_reading':
        const avgSpeed = events.reduce((sum, e) => sum + e.context.readingSpeed, 0) / events.length;
        const expectedSpeed = 120; // Default expected speed
        patternStrengthConfidence = Math.min((avgSpeed / expectedSpeed), 1);
        break;
        
      case 'vocabulary_gaps':
        const lookupRatio = events.filter(e => e.type === 'word_lookup').length / events.length;
        patternStrengthConfidence = Math.min(lookupRatio * 5, 1);
        break;
    }
    
    return (sampleSizeConfidence + patternStrengthConfidence) / 2;
  }

  private identifyPatternIndicators(patternType: ReadingPattern['patternType'], events: ReadingEvent[]): string[] {
    const indicators: string[] = [];
    
    switch (patternType) {
      case 'struggling_reader':
        const lookups = events.filter(e => e.type === 'word_lookup').length;
        const rereads = events.filter(e => e.type === 'reread_section').length;
        
        if (lookups > 0) indicators.push(`${lookups} vocabulary lookups`);
        if (rereads > 0) indicators.push(`${rereads} text re-reads`);
        break;
        
      case 'fluent_reading':
        const avgSpeed = events.reduce((sum, e) => sum + e.context.readingSpeed, 0) / events.length;
        indicators.push(`Reading speed: ${Math.round(avgSpeed)} WPM`);
        break;
        
      case 'vocabulary_gaps':
        const uniqueWords = new Set(events.filter(e => e.type === 'word_lookup').map(e => e.metadata.word)).size;
        indicators.push(`${uniqueWords} unique words looked up`);
        break;
    }
    
    return indicators;
  }

  private calculateReadingMetrics(events: ReadingEvent[]): ReadingPattern['readingMetrics'] {
    const speedEvents = events.filter(e => e.context.readingSpeed > 0);
    const averageSpeed = speedEvents.length > 0 
      ? speedEvents.reduce((sum, e) => sum + e.context.readingSpeed, 0) / speedEvents.length 
      : 100;

    const pauseEvents = events.filter(e => e.type === 'reading_pause');
    const pauseFrequency = pauseEvents.length / Math.max(events.length, 1);

    const rereadsCount = events.filter(e => e.type === 'reread_section').length;
    const vocabularyLookups = events.filter(e => e.type === 'word_lookup').length;

    // Calculate attention span as average time between pauses
    const readingSessions = this.calculateReadingSessions(events);
    const attentionSpan = readingSessions.length > 0 
      ? readingSessions.reduce((sum, duration) => sum + duration, 0) / readingSessions.length / 1000 // Convert to seconds
      : 120; // Default 2 minutes

    return {
      averageSpeed,
      pauseFrequency,
      rereadsCount,
      vocabularyLookups,
      attentionSpan,
    };
  }

  private calculateReadingSessions(events: ReadingEvent[]): number[] {
    const sessions: number[] = [];
    let sessionStart: number | null = null;

    events.sort((a, b) => a.timestamp - b.timestamp).forEach(event => {
      if (event.type === 'reading_start' || event.type === 'reading_resume') {
        sessionStart = event.timestamp;
      } else if ((event.type === 'reading_pause' || event.type === 'reading_complete') && sessionStart) {
        sessions.push(event.timestamp - sessionStart);
        sessionStart = null;
      }
    });

    return sessions;
  }

  private generatePatternOptimizations(patternType: ReadingPattern['patternType'], events: ReadingEvent[]): ReadingOptimization[] {
    const optimizations: ReadingOptimization[] = [];
    
    switch (patternType) {
      case 'struggling_reader':
        optimizations.push(this.createTextSimplificationOptimization(events));
        optimizations.push(this.createReadingPaceOptimization(events));
        break;
        
      case 'vocabulary_gaps':
        optimizations.push(this.createVocabularyAssistanceOptimization(events));
        break;
        
      case 'attention_issues':
        optimizations.push(this.createAttentionSupportOptimization(events));
        break;
        
      case 'fluent_reading':
        optimizations.push(this.createAdvancedFeaturesOptimization(events));
        break;
    }
    
    return optimizations.filter(o => o.priority >= 2);
  }

  private createTextSimplificationOptimization(events: ReadingEvent[]): ReadingOptimization {
    return {
      id: this.generateOptimizationId(),
      type: 'text_simplification',
      priority: 4,
      expectedImpact: 0.5,
      targetPattern: 'struggling_reader',
      implementation: {
        textModifications: [{
          modificationType: 'sentence_simplification',
          target: 'complex_sentences',
          originalText: '',
          modifiedText: '',
          reasoning: 'Struggling reader pattern detected',
          reversible: true,
        }],
        uiChanges: [{
          changeType: 'font_adjustment',
          target: '.reading-content',
          properties: {
            fontSize: 'larger',
            lineHeight: 'increased',
            fontFamily: 'dyslexia-friendly',
          },
          gradeSpecific: true,
        }],
        assistanceFeatures: [{
          featureType: 'reading_buddy',
          trigger: 'continuous',
          properties: {
            encouragement: true,
            paceGuidance: true,
          },
          adaptToUser: true,
        }],
      },
      gradeLevelAdaptation: {
        'K-2': { simplificationLevel: 0.8 },
        '3-5': { simplificationLevel: 0.6 },
        '6-8': { simplificationLevel: 0.4 },
        '9-12': { simplificationLevel: 0.2 },
      },
      validationCriteria: ['reading_speed_improvement', 'comprehension_maintenance'],
    };
  }

  private createReadingPaceOptimization(events: ReadingEvent[]): ReadingOptimization {
    return {
      id: this.generateOptimizationId(),
      type: 'reading_pace_adjustment',
      priority: 3,
      expectedImpact: 0.4,
      targetPattern: 'struggling_reader',
      implementation: {
        textModifications: [],
        uiChanges: [{
          changeType: 'reading_guides',
          target: '.reading-content',
          properties: {
            paceIndicator: true,
            highlightCurrentLine: true,
            scrollPacing: 'automatic',
          },
          gradeSpecific: true,
        }],
        assistanceFeatures: [{
          featureType: 'pace_guidance',
          trigger: 'reading_speed_detection',
          properties: {
            suggestedPace: 'adaptive',
            visualCues: true,
          },
          adaptToUser: true,
        }],
      },
      gradeLevelAdaptation: {
        'K-2': { targetPace: 60 },
        '3-5': { targetPace: 120 },
        '6-8': { targetPace: 160 },
        '9-12': { targetPace: 200 },
      },
      validationCriteria: ['reading_pace_consistency', 'user_comfort_increase'],
    };
  }

  private createVocabularyAssistanceOptimization(events: ReadingEvent[]): ReadingOptimization {
    return {
      id: this.generateOptimizationId(),
      type: 'vocabulary_assistance',
      priority: 4,
      expectedImpact: 0.6,
      targetPattern: 'vocabulary_gaps',
      implementation: {
        textModifications: [],
        uiChanges: [{
          changeType: 'interactive_elements',
          target: '.reading-content',
          properties: {
            wordClickDefinitions: true,
            vocabularyHighlights: true,
            contextualHints: true,
          },
          gradeSpecific: true,
        }],
        assistanceFeatures: [{
          featureType: 'word_pronunciation',
          trigger: 'word_click',
          properties: {
            audioPlayback: true,
            syllableBreakdown: true,
          },
          adaptToUser: true,
        }],
      },
      gradeLevelAdaptation: {
        'K-2': { pronunciationGuide: true, visualCues: true },
        '3-5': { contextClues: true, synonyms: true },
        '6-8': { etymology: true, wordRelations: true },
        '9-12': { advancedDefinitions: true, usageExamples: true },
      },
      validationCriteria: ['vocabulary_lookup_reduction', 'comprehension_improvement'],
    };
  }

  private createAttentionSupportOptimization(events: ReadingEvent[]): ReadingOptimization {
    return {
      id: this.generateOptimizationId(),
      type: 'comprehension_aids',
      priority: 3,
      expectedImpact: 0.4,
      targetPattern: 'attention_issues',
      implementation: {
        textModifications: [],
        uiChanges: [{
          changeType: 'focus_mode',
          target: '.reading-content',
          properties: {
            distractionReduction: true,
            currentSentenceHighlight: true,
            progressVisualization: true,
          },
          gradeSpecific: true,
        }],
        assistanceFeatures: [{
          featureType: 'break_reminders',
          trigger: 'attention_span_detection',
          properties: {
            gentleReminders: true,
            optimalBreakTiming: true,
          },
          adaptToUser: true,
        }],
      },
      gradeLevelAdaptation: {
        'K-2': { breakFrequency: 'high', gamification: true },
        '3-5': { breakFrequency: 'medium', rewards: true },
        '6-8': { breakFrequency: 'low', progress: true },
        '9-12': { breakFrequency: 'minimal', analytics: true },
      },
      validationCriteria: ['attention_span_increase', 'completion_rate_improvement'],
    };
  }

  private createAdvancedFeaturesOptimization(events: ReadingEvent[]): ReadingOptimization {
    return {
      id: this.generateOptimizationId(),
      type: 'interactive_features',
      priority: 2,
      expectedImpact: 0.3,
      targetPattern: 'fluent_reading',
      implementation: {
        textModifications: [],
        uiChanges: [{
          changeType: 'interactive_elements',
          target: '.reading-content',
          properties: {
            speedReading: true,
            comprehensionQuestions: true,
            annotationTools: true,
          },
          gradeSpecific: false,
        }],
        assistanceFeatures: [{
          featureType: 'comprehension_hints',
          trigger: 'section_completion',
          properties: {
            thinkingQuestions: true,
            connectionPrompts: true,
          },
          adaptToUser: true,
        }],
      },
      gradeLevelAdaptation: {
        'K-2': { simpleQuestions: true },
        '3-5': { multipleChoice: true },
        '6-8': { openEnded: true },
        '9-12': { criticalThinking: true },
      },
      validationCriteria: ['engagement_increase', 'comprehension_depth'],
    };
  }

  private generatePeriodicOptimizations(): void {
    // Generate optimizations based on current patterns
    this.patterns.forEach(pattern => {
      pattern.recommendedOptimizations.forEach(optimization => {
        if (!this.optimizations.find(o => o.id === optimization.id)) {
          this.optimizations.push(optimization);
        }
      });
    });
  }

  private measureOptimizationEffectiveness(): void {
    const appliedOptimizations = this.optimizations.filter(o => 
      o.appliedAt && !o.effectiveness &&
      Date.now() - o.appliedAt > 300000 // At least 5 minutes since application
    );

    appliedOptimizations.forEach(optimization => {
      const effectiveness = this.calculateOptimizationEffectiveness(optimization);
      
      if (effectiveness !== null) {
        optimization.effectiveness = effectiveness;
        
        structuredLogger.info('Reading optimization effectiveness measured', {
          optimizationId: optimization.id,
          type: optimization.type,
          effectiveness,
        });
      }
    });
  }

  private calculateOptimizationEffectiveness(optimization: ReadingOptimization): number | null {
    const beforeEvents = this.events.filter(e => 
      e.timestamp < optimization.appliedAt! &&
      e.timestamp > optimization.appliedAt! - 600000 // 10 minutes before
    );

    const afterEvents = this.events.filter(e => 
      e.timestamp > optimization.appliedAt! &&
      e.timestamp < optimization.appliedAt! + 600000 // 10 minutes after
    );

    if (beforeEvents.length < 3 || afterEvents.length < 3) {
      return null; // Insufficient data
    }

    // Calculate improvement based on optimization type
    switch (optimization.type) {
      case 'vocabulary_assistance':
        return this.calculateVocabularyEffectiveness(beforeEvents, afterEvents);
      case 'text_simplification':
        return this.calculateSimplificationEffectiveness(beforeEvents, afterEvents);
      case 'reading_pace_adjustment':
        return this.calculatePaceEffectiveness(beforeEvents, afterEvents);
      default:
        return 0.5; // Default moderate effectiveness
    }
  }

  private calculateVocabularyEffectiveness(beforeEvents: ReadingEvent[], afterEvents: ReadingEvent[]): number {
    const beforeLookups = beforeEvents.filter(e => e.type === 'word_lookup').length;
    const afterLookups = afterEvents.filter(e => e.type === 'word_lookup').length;
    
    const beforeRate = beforeLookups / beforeEvents.length;
    const afterRate = afterLookups / afterEvents.length;
    
    const improvement = beforeRate > 0 ? (beforeRate - afterRate) / beforeRate : 0;
    return Math.max(0, Math.min(1, improvement));
  }

  private calculateSimplificationEffectiveness(beforeEvents: ReadingEvent[], afterEvents: ReadingEvent[]): number {
    const beforeComprehension = beforeEvents.reduce((sum, e) => sum + e.context.comprehensionLevel, 0) / beforeEvents.length;
    const afterComprehension = afterEvents.reduce((sum, e) => sum + e.context.comprehensionLevel, 0) / afterEvents.length;
    
    const improvement = afterComprehension - beforeComprehension;
    return Math.max(0, Math.min(1, improvement + 0.5));
  }

  private calculatePaceEffectiveness(beforeEvents: ReadingEvent[], afterEvents: ReadingEvent[]): number {
    const beforeSpeeds = beforeEvents.map(e => e.context.readingSpeed).filter(s => s > 0);
    const afterSpeeds = afterEvents.map(e => e.context.readingSpeed).filter(s => s > 0);
    
    if (beforeSpeeds.length === 0 || afterSpeeds.length === 0) return 0.5;
    
    const beforeAvg = beforeSpeeds.reduce((sum, s) => sum + s, 0) / beforeSpeeds.length;
    const afterAvg = afterSpeeds.reduce((sum, s) => sum + s, 0) / afterSpeeds.length;
    
    const beforeVariance = this.calculateVariance(beforeSpeeds);
    const afterVariance = this.calculateVariance(afterSpeeds);
    
    // Effectiveness based on consistency improvement (lower variance is better)
    const consistencyImprovement = beforeVariance > 0 ? (beforeVariance - afterVariance) / beforeVariance : 0;
    return Math.max(0, Math.min(1, consistencyImprovement));
  }

  private calculateVariance(numbers: number[]): number {
    const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
    const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2));
    return squaredDiffs.reduce((sum, d) => sum + d, 0) / numbers.length;
  }

  private async executeReadingOptimization(optimization: ReadingOptimization): Promise<void> {
    // In a real implementation, this would apply the reading optimizations
    structuredLogger.info('Executing reading optimization', {
      type: optimization.type,
      textModifications: optimization.implementation.textModifications.length,
      uiChanges: optimization.implementation.uiChanges.length,
      assistanceFeatures: optimization.implementation.assistanceFeatures.length,
    });
  }

  // Additional helper methods for metrics calculation
  private calculateReadingSpeed(events: ReadingEvent[]): number {
    const speedEvents = events.filter(e => e.context.readingSpeed > 0);
    return speedEvents.length > 0 
      ? speedEvents.reduce((sum, e) => sum + e.context.readingSpeed, 0) / speedEvents.length 
      : 100;
  }

  private estimateComprehensionScore(events: ReadingEvent[]): number {
    const comprehensionEvents = events.filter(e => e.context.comprehensionLevel !== undefined);
    return comprehensionEvents.length > 0 
      ? comprehensionEvents.reduce((sum, e) => sum + e.context.comprehensionLevel, 0) / comprehensionEvents.length 
      : 0.5;
  }

  private estimateVocabularyLevel(events: ReadingEvent[]): number {
    const complexityEvents = events.filter(e => e.context.textComplexity !== undefined);
    const avgComplexity = complexityEvents.length > 0 
      ? complexityEvents.reduce((sum, e) => sum + e.context.textComplexity, 0) / complexityEvents.length 
      : 0.5;

    // Convert complexity to grade level (simplified mapping)
    if (avgComplexity < 0.3) return 2; // K-2
    if (avgComplexity < 0.5) return 5; // 3-5
    if (avgComplexity < 0.7) return 8; // 6-8
    return 12; // 9-12
  }

  private calculateAttentionSpan(events: ReadingEvent[]): number {
    const sessions = this.calculateReadingSessions(events);
    return sessions.length > 0 
      ? sessions.reduce((sum, duration) => sum + duration, 0) / sessions.length / 1000 
      : 120;
  }

  private identifyStrugglingIndicators(events: ReadingEvent[]): string[] {
    const indicators: string[] = [];
    
    const lookupCount = events.filter(e => e.type === 'word_lookup').length;
    if (lookupCount > events.length * 0.15) {
      indicators.push('High vocabulary lookup frequency');
    }
    
    const rereadCount = events.filter(e => e.type === 'reread_section').length;
    if (rereadCount > events.length * 0.1) {
      indicators.push('Frequent text re-reading');
    }
    
    const avgSpeed = this.calculateReadingSpeed(events);
    if (avgSpeed < 80) {
      indicators.push('Below-average reading speed');
    }
    
    return indicators;
  }

  private identifyStrengths(events: ReadingEvent[]): string[] {
    const strengths: string[] = [];
    
    const avgSpeed = this.calculateReadingSpeed(events);
    if (avgSpeed > 150) {
      strengths.push('Above-average reading speed');
    }
    
    const comprehension = this.estimateComprehensionScore(events);
    if (comprehension > 0.8) {
      strengths.push('High comprehension level');
    }
    
    const attentionSpan = this.calculateAttentionSpan(events);
    if (attentionSpan > 300) { // 5+ minutes
      strengths.push('Good sustained attention');
    }
    
    return strengths;
  }

  private identifyImprovementAreas(events: ReadingEvent[]): string[] {
    const areas: string[] = [];
    
    const lookupFreq = events.filter(e => e.type === 'word_lookup').length / events.length;
    if (lookupFreq > 0.1) {
      areas.push('Vocabulary development');
    }
    
    const attentionSpan = this.calculateAttentionSpan(events);
    if (attentionSpan < 120) { // Less than 2 minutes
      areas.push('Sustained attention');
    }
    
    const comprehension = this.estimateComprehensionScore(events);
    if (comprehension < 0.6) {
      areas.push('Reading comprehension');
    }
    
    return areas;
  }

  private recommendGradeLevel(readingSpeed: number, comprehension: number, vocabulary: number): GradeLevel {
    // Simple algorithm to recommend appropriate grade level
    const speedGrade = readingSpeed < 80 ? 'K-2' : 
                     readingSpeed < 130 ? '3-5' : 
                     readingSpeed < 180 ? '6-8' : '9-12';
    
    const comprGrade = comprehension < 0.6 ? 'K-2' : 
                      comprehension < 0.7 ? '3-5' : 
                      comprehension < 0.8 ? '6-8' : '9-12';
    
    const vocabGrade = vocabulary < 4 ? 'K-2' : 
                      vocabulary < 7 ? '3-5' : 
                      vocabulary < 10 ? '6-8' : '9-12';
    
    // Return the median grade level
    const grades = [speedGrade, comprGrade, vocabGrade];
    return grades.sort()[1] as GradeLevel;
  }

  private getDefaultMetrics(): ComprehensionMetrics {
    return {
      readingSpeed: 100,
      comprehensionScore: 0.5,
      vocabularyLevel: 5,
      attentionSpan: 180,
      strugglingIndicators: [],
      strengths: [],
      improvementAreas: [],
      recommendedLevel: 'Grade3',
    };
  }

  private cleanupOldData(): void {
    const cutoff = Date.now() - 3600000; // Keep 1 hour of data
    
    this.events = this.events.filter(e => e.timestamp > cutoff);
    this.patterns = this.patterns.filter(p => p.detectedAt > cutoff);
    
    // Keep optimizations longer for effectiveness tracking
    const optimizationCutoff = Date.now() - 7200000; // Keep 2 hours
    this.optimizations = this.optimizations.filter(o => 
      !o.appliedAt || o.appliedAt > optimizationCutoff
    );
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    if (this.analysisTimer) {
      clearInterval(this.analysisTimer);
      this.analysisTimer = null;
    }
    
    // Complete current reading session if active
    if (this.currentReadingSession) {
      this.recordReadingEvent('reading_complete', this.currentReadingSession.contentId, {
        wordIndex: this.currentReadingSession.currentPosition,
        percentageComplete: this.currentReadingSession.currentPosition / this.currentReadingSession.wordCount,
        currentSentence: '',
        currentParagraph: 0,
      });
    }
    
    structuredLogger.info('Reading Comprehension Optimizer shutdown completed', {
      eventsRecorded: this.events.length,
      patternsDetected: this.patterns.length,
      optimizationsGenerated: this.optimizations.length,
      sessionCompleted: !!this.currentReadingSession,
    });
  }
}

export const readingComprehensionOptimizer = new ReadingComprehensionOptimizerService();
export { ReadingComprehensionOptimizerService };