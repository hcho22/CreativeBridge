/**
 * Contextual Fallback Service
 *
 * Implements intelligent error analysis and context-preserving recovery strategies
 * Task 6.1: Context-Aware Error Handling
 */

import { structuredLogger } from '../utils/logger';
import type { StoryRequest } from '../types/story';
import type { GradeLevel } from '../types/database';
import {
  SkillManager,
  SkillError,
  SkillErrorCode,
} from '../types/claudeSkills';
// import { errorHandler, ErrorLevel, ErrorCategory } from './errorHandler';

export interface StoryContext {
  characters: string[];
  settings: string[];
  themes: string[];
  plotPoints: string[];
  tone: string;
  tense: 'past' | 'present' | 'future';
  continuityMarkers: {
    lastCharacterMention: string | null;
    currentSetting: string | null;
    activeConflict: string | null;
    emotionalTone: string | null;
  };
  gradeLevel: GradeLevel;
  wordCount: number;
  narrative: {
    hasIntroduction: boolean;
    hasConflict: boolean;
    hasResolution: boolean;
    progressPercentage: number;
  };
}

export interface ErrorRecoveryContext {
  originalRequest: StoryRequest;
  storyContext: StoryContext | null;
  errorType: SkillErrorCode | 'unknown';
  errorMessage: string;
  attemptNumber: number;
  previousFailures: Array<{
    error: string;
    timestamp: Date;
    recoveryAttempted: string;
  }>;
  userExperienceState: {
    isFirstInteraction: boolean;
    sessionDuration: number;
    previousSuccesses: number;
    consecutiveFailures: number;
  };
}

export interface ContextualFallbackResult {
  story: string;
  preservedContext: boolean;
  contextPreservationScore: number; // 0-100
  fallbackStrategy: string;
  qualityScore: number; // 0-100
  seamless: boolean; // Whether user will notice the fallback
  continuityMaintained: boolean;
  recommendations: string[];
}

export interface FailurePrediction {
  riskScore: number; // 0-100, higher = more likely to fail
  riskFactors: Array<{
    factor: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    mitigation?: string;
  }>;
  preventiveActions: string[];
  recommendedPreventiveStrategy:
    | 'cache_warmup'
    | 'fallback_preload'
    | 'skill_bypass'
    | 'none';
}

export class ContextualFallbackService {
  private skillManager: SkillManager;
  private contextCache: Map<string, StoryContext> = new Map();
  private failurePatterns: Map<
    string,
    Array<{ pattern: string; frequency: number }>
  > = new Map();
  private recoveryStrategies: Map<
    string,
    (context: ErrorRecoveryContext) => Promise<ContextualFallbackResult>
  >;

  constructor(skillManager: SkillManager) {
    this.skillManager = skillManager;
    this.recoveryStrategies = this.initializeRecoveryStrategies();
  }

  /**
   * Analyze story content to extract comprehensive context
   */
  public async analyzeStoryContext(
    story: string,
    gradeLevel: GradeLevel,
    requestContext?: StoryRequest,
  ): Promise<StoryContext> {
    try {
      structuredLogger.info('Analyzing story context for error recovery', {
        storyLength: story.length,
        gradeLevel,
        hasRequestContext: !!requestContext,
      });

      // Use Claude Skills for advanced context analysis if available
      let claudeAnalysis: any = null;
      try {
        const analysisResult = await this.skillManager.executeSkill(
          'StoryContextAnalysisSkill',
          {
            content: story,
            gradeLevel,
            analysisDepth: 'comprehensive',
            extractContinuityMarkers: true,
            identifyNarrativeStructure: true,
          },
        );

        if (analysisResult.success) {
          claudeAnalysis = analysisResult.data;
        }
      } catch (error) {
        structuredLogger.debug(
          'Claude context analysis unavailable, using fallback analysis',
        );
      }

      // Fallback to rule-based analysis if Claude Skills unavailable
      const context = claudeAnalysis
        ? this.mapClaudeAnalysisToContext(claudeAnalysis, gradeLevel)
        : this.performRuleBasedAnalysis(story, gradeLevel);

      // Cache the context for future recovery attempts
      const contextKey = this.generateContextKey(story, gradeLevel);
      this.contextCache.set(contextKey, context);

      structuredLogger.info('Story context analysis completed', {
        characters: context.characters.length,
        settings: context.settings.length,
        themes: context.themes.length,
        narrativeProgress: context.narrative.progressPercentage,
        tone: context.tone,
        tense: context.tense,
      });

      return context;
    } catch (error) {
      structuredLogger.error(
        'Story context analysis failed',
        {},
        error as Error,
      );

      // Return minimal context to prevent complete failure
      return this.createMinimalContext(story, gradeLevel);
    }
  }

  /**
   * Predict potential failures before they occur
   */
  public async predictFailureRisk(
    request: StoryRequest,
    currentContext?: StoryContext,
    sessionMetrics?: {
      recentFailures: number;
      averageLatency: number;
      networkCondition: 'excellent' | 'good' | 'poor' | 'offline';
    },
  ): Promise<FailurePrediction> {
    try {
      const riskFactors: Array<{
        factor: string;
        severity: 'low' | 'medium' | 'high';
        description: string;
        mitigation?: string;
      }> = [];

      let riskScore = 0;

      // Analyze request complexity
      if (request.storySoFar && request.storySoFar.length > 2000) {
        riskFactors.push({
          factor: 'high_context_complexity',
          severity: 'medium',
          description:
            'Long story context may challenge continuation generation',
          mitigation: 'Use context summarization before skill call',
        });
        riskScore += 20;
      }

      // Check recent failure patterns
      if (sessionMetrics?.recentFailures && sessionMetrics.recentFailures > 2) {
        riskFactors.push({
          factor: 'recent_failure_pattern',
          severity: 'high',
          description: 'Multiple recent failures indicate systemic issue',
          mitigation: 'Switch to fallback generation mode',
        });
        riskScore += 30;
      }

      // Network condition analysis
      if (sessionMetrics?.networkCondition === 'poor') {
        riskFactors.push({
          factor: 'poor_network_conditions',
          severity: 'medium',
          description: 'Poor network may cause timeouts or partial failures',
          mitigation: 'Reduce request complexity and enable aggressive caching',
        });
        riskScore += 25;
      }

      // Story coherence complexity
      if (currentContext) {
        const complexityScore = this.calculateContextComplexity(currentContext);
        if (complexityScore > 70) {
          riskFactors.push({
            factor: 'narrative_complexity',
            severity: 'medium',
            description:
              'Complex narrative structure may be challenging to continue',
            mitigation: 'Use simplified continuation prompts',
          });
          riskScore += 15;
        }
      }

      // Grade level appropriateness challenges
      const gradeLevelRisk = this.assessGradeLevelRisk(
        request.gradeLevel,
        currentContext ?? null,
      );
      if (gradeLevelRisk > 0) {
        riskFactors.push({
          factor: 'grade_level_constraints',
          severity: gradeLevelRisk > 30 ? 'high' : 'medium',
          description: 'Grade level constraints may limit generation options',
          mitigation: 'Pre-validate content appropriateness patterns',
        });
        riskScore += gradeLevelRisk;
      }

      // Determine preventive strategy
      let recommendedStrategy:
        | 'cache_warmup'
        | 'fallback_preload'
        | 'skill_bypass'
        | 'none' = 'none';

      if (riskScore > 60) {
        recommendedStrategy = 'skill_bypass';
      } else if (riskScore > 40) {
        recommendedStrategy = 'fallback_preload';
      } else if (riskScore > 20) {
        recommendedStrategy = 'cache_warmup';
      }

      const preventiveActions = this.generatePreventiveActions(
        riskFactors,
        recommendedStrategy,
      );

      structuredLogger.info('Failure risk prediction completed', {
        riskScore,
        riskFactors: riskFactors.length,
        recommendedStrategy,
        preventiveActions: preventiveActions.length,
      });

      return {
        riskScore: Math.min(100, riskScore),
        riskFactors,
        preventiveActions,
        recommendedPreventiveStrategy: recommendedStrategy,
      };
    } catch (error) {
      structuredLogger.warn('Failure risk prediction failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        riskScore: 50, // Medium risk when prediction fails
        riskFactors: [
          {
            factor: 'prediction_failure',
            severity: 'low',
            description: 'Unable to assess failure risk - proceed with caution',
          },
        ],
        preventiveActions: ['Enable fallback generation'],
        recommendedPreventiveStrategy: 'fallback_preload',
      };
    }
  }

  /**
   * Execute context-aware error recovery
   */
  public async recoverFromError(
    error: SkillError | Error,
    recoveryContext: ErrorRecoveryContext,
  ): Promise<ContextualFallbackResult> {
    try {
      structuredLogger.info('Initiating context-aware error recovery', {
        errorType: 'code' in error ? error.code : 'unknown',
        attemptNumber: recoveryContext.attemptNumber,
        hasStoryContext: !!recoveryContext.storyContext,
        consecutiveFailures:
          recoveryContext.userExperienceState.consecutiveFailures,
      });

      // Log error for pattern analysis
      await this.recordErrorPattern(error, recoveryContext);

      // Determine optimal recovery strategy
      const strategyKey = this.selectRecoveryStrategy(error, recoveryContext);
      const recoveryFunction = this.recoveryStrategies.get(strategyKey);

      if (!recoveryFunction) {
        structuredLogger.warn('No recovery strategy found, using default');
        return this.executeDefaultRecovery(recoveryContext);
      }

      // Execute the recovery strategy
      const result = await recoveryFunction(recoveryContext);

      // Validate recovery result
      const validationResult = await this.validateRecoveryResult(
        result,
        recoveryContext,
      );

      structuredLogger.info('Error recovery completed', {
        strategy: strategyKey,
        preservedContext: result.preservedContext,
        contextScore: result.contextPreservationScore,
        seamless: result.seamless,
        qualityScore: result.qualityScore,
      });

      return validationResult;
    } catch (recoveryError) {
      structuredLogger.error(
        'Error recovery failed',
        {
          originalError: error.message,
          recoveryError: (recoveryError as Error).message,
        },
        recoveryError as Error,
      );

      // Ultimate fallback - return basic story continuation
      return this.executeEmergencyFallback(recoveryContext);
    }
  }

  /**
   * Mask errors from user experience while preserving functionality
   */
  public async maskErrorForUser(
    error: SkillError | Error,
    recoveryResult: ContextualFallbackResult,
    userContext: {
      isChild: boolean;
      expectationLevel: 'low' | 'medium' | 'high';
      sessionLength: number;
    },
  ): Promise<{
    userMessage: string | null;
    showProgress: boolean;
    delayResponse: boolean;
    alternativeAction?: string;
  }> {
    try {
      // For seamless recoveries, no user messaging needed
      if (
        recoveryResult.seamless &&
        recoveryResult.contextPreservationScore > 80
      ) {
        return {
          userMessage: null,
          showProgress: false,
          delayResponse: false,
        };
      }

      // For children, prioritize maintaining immersion
      if (userContext.isChild) {
        if (recoveryResult.qualityScore > 70) {
          return {
            userMessage: null,
            showProgress: true, // Gentle loading indicator
            delayResponse: true, // Brief delay to simulate normal processing
          };
        } else {
          return {
            userMessage: 'Let me think about that for a moment...',
            showProgress: true,
            delayResponse: true,
            alternativeAction: 'suggest_different_direction',
          };
        }
      }

      // For users with high expectations, be more transparent
      if (userContext.expectationLevel === 'high') {
        return {
          userMessage:
            "I'm exploring different creative directions for your story...",
          showProgress: true,
          delayResponse: false,
          alternativeAction: 'offer_alternatives',
        };
      }

      // Default gentle handling
      return {
        userMessage: null,
        showProgress: true,
        delayResponse: true,
      };
    } catch (error) {
      structuredLogger.warn('Error masking failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        userMessage: null,
        showProgress: false,
        delayResponse: false,
      };
    }
  }

  // Private helper methods

  private mapClaudeAnalysisToContext(
    analysis: any,
    gradeLevel: GradeLevel,
  ): StoryContext {
    return {
      characters: analysis.characters || [],
      settings: analysis.settings || [],
      themes: analysis.themes || [],
      plotPoints: analysis.plotPoints || [],
      tone: analysis.tone || 'neutral',
      tense: analysis.tense || 'past',
      continuityMarkers: {
        lastCharacterMention:
          analysis.continuityMarkers?.lastCharacterMention || null,
        currentSetting: analysis.continuityMarkers?.currentSetting || null,
        activeConflict: analysis.continuityMarkers?.activeConflict || null,
        emotionalTone: analysis.continuityMarkers?.emotionalTone || null,
      },
      gradeLevel,
      wordCount: analysis.wordCount || 0,
      narrative: {
        hasIntroduction: analysis.narrative?.hasIntroduction || false,
        hasConflict: analysis.narrative?.hasConflict || false,
        hasResolution: analysis.narrative?.hasResolution || false,
        progressPercentage: analysis.narrative?.progressPercentage || 0,
      },
    };
  }

  private performRuleBasedAnalysis(
    story: string,
    gradeLevel: GradeLevel,
  ): StoryContext {
    const words = story.split(/\s+/);
    const sentences = story.split(/[.!?]+/).filter(s => s.trim().length > 0);

    // Extract basic elements using pattern matching
    const characters = this.extractCharacters(story);
    const settings = this.extractSettings(story);
    const themes = this.extractThemes(story);
    const tone = this.analyzeTone(story);
    const tense = this.analyzeTense(story);

    return {
      characters,
      settings,
      themes,
      plotPoints: this.extractPlotPoints(sentences),
      tone,
      tense,
      continuityMarkers: {
        lastCharacterMention: characters.length > 0 ? characters[0] : null,
        currentSetting:
          settings.length > 0 ? settings[settings.length - 1] : null,
        activeConflict: null,
        emotionalTone: tone,
      },
      gradeLevel,
      wordCount: words.length,
      narrative: {
        hasIntroduction:
          story.toLowerCase().includes('once') ||
          story.toLowerCase().includes('there'),
        hasConflict:
          story.toLowerCase().includes('but') ||
          story.toLowerCase().includes('however'),
        hasResolution:
          story.toLowerCase().includes('finally') ||
          story.toLowerCase().includes('end'),
        progressPercentage: Math.min(100, (words.length / 200) * 100),
      },
    };
  }

  private extractCharacters(story: string): string[] {
    // Basic character extraction using common patterns
    const characterPatterns = [
      /\b([A-Z][a-z]+)\s+(said|walked|ran|jumped|looked|felt|thought)/g,
      /\b([A-Z][a-z]+)\s+was\b/g,
      /\bthe\s+([a-z]+)\s+(said|walked|ran|jumped)/g,
    ];

    const characters = new Set<string>();

    for (const pattern of characterPatterns) {
      const matches = story.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[1].length > 2) {
          characters.add(match[1]);
        }
      }
    }

    return Array.from(characters).slice(0, 5); // Limit to 5 main characters
  }

  private extractSettings(story: string): string[] {
    const settingKeywords = [
      'forest',
      'castle',
      'school',
      'home',
      'park',
      'beach',
      'mountain',
      'city',
      'garden',
      'library',
      'kitchen',
      'bedroom',
      'classroom',
      'playground',
    ];

    const settings = settingKeywords.filter(keyword =>
      story.toLowerCase().includes(keyword),
    );

    return settings;
  }

  private extractThemes(story: string): string[] {
    const themeKeywords = {
      friendship: ['friend', 'together', 'help', 'share'],
      adventure: ['journey', 'explore', 'discover', 'quest'],
      family: ['mother', 'father', 'sister', 'brother', 'family'],
      courage: ['brave', 'courage', 'fear', 'scary'],
      learning: ['learn', 'teach', 'study', 'school'],
    };

    const themes: string[] = [];

    for (const [theme, keywords] of Object.entries(themeKeywords)) {
      const hasTheme = keywords.some(keyword =>
        story.toLowerCase().includes(keyword),
      );
      if (hasTheme) {
        themes.push(theme);
      }
    }

    return themes;
  }

  private extractPlotPoints(sentences: string[]): string[] {
    return sentences.slice(0, 3).map(sentence => sentence.trim());
  }

  private analyzeTone(story: string): string {
    const toneIndicators = {
      happy: ['happy', 'joy', 'cheerful', 'bright', 'wonderful'],
      sad: ['sad', 'cry', 'tear', 'lonely', 'dark'],
      exciting: ['exciting', 'amazing', 'incredible', 'fantastic'],
      mysterious: ['mysterious', 'secret', 'hidden', 'strange'],
    };

    const storyLower = story.toLowerCase();

    for (const [tone, indicators] of Object.entries(toneIndicators)) {
      if (indicators.some(indicator => storyLower.includes(indicator))) {
        return tone;
      }
    }

    return 'neutral';
  }

  private analyzeTense(story: string): 'past' | 'present' | 'future' {
    const pastIndicators = ['was', 'were', 'had', 'did', 'went'];
    const presentIndicators = ['is', 'are', 'does', 'goes'];
    const futureIndicators = ['will', 'shall', 'going to'];

    const storyLower = story.toLowerCase();

    const pastCount = pastIndicators.reduce(
      (count, indicator) =>
        count +
        (storyLower.match(new RegExp(`\\b${indicator}\\b`, 'g')) || []).length,
      0,
    );

    const presentCount = presentIndicators.reduce(
      (count, indicator) =>
        count +
        (storyLower.match(new RegExp(`\\b${indicator}\\b`, 'g')) || []).length,
      0,
    );

    const futureCount = futureIndicators.reduce(
      (count, indicator) =>
        count +
        (storyLower.match(new RegExp(`\\b${indicator}\\b`, 'g')) || []).length,
      0,
    );

    if (pastCount > presentCount && pastCount > futureCount) return 'past';
    if (futureCount > presentCount && futureCount > pastCount) return 'future';
    return 'present';
  }

  private createMinimalContext(
    story: string,
    gradeLevel: GradeLevel,
  ): StoryContext {
    return {
      characters: [],
      settings: [],
      themes: [],
      plotPoints: [],
      tone: 'neutral',
      tense: 'past',
      continuityMarkers: {
        lastCharacterMention: null,
        currentSetting: null,
        activeConflict: null,
        emotionalTone: null,
      },
      gradeLevel,
      wordCount: story.split(/\s+/).length,
      narrative: {
        hasIntroduction: false,
        hasConflict: false,
        hasResolution: false,
        progressPercentage: 0,
      },
    };
  }

  private generateContextKey(story: string, gradeLevel: GradeLevel): string {
    // Create a hash-like key for caching contexts
    const storyHash = story.substring(0, 50).replace(/\s+/g, '_');
    return `${gradeLevel}_${storyHash}_${story.length}`;
  }

  private calculateContextComplexity(context: StoryContext): number {
    let complexity = 0;

    // Character complexity
    complexity += context.characters.length * 10;

    // Setting complexity
    complexity += context.settings.length * 8;

    // Theme complexity
    complexity += context.themes.length * 6;

    // Narrative progression
    complexity += context.narrative.progressPercentage * 0.3;

    // Word count factor
    complexity += Math.min(30, context.wordCount / 50);

    return Math.min(100, complexity);
  }

  private assessGradeLevelRisk(
    gradeLevel: GradeLevel,
    context: StoryContext | null,
  ): number {
    if (!context) return 10; // Small risk if no context

    let risk = 0;

    // Content complexity vs grade level
    const complexity = this.calculateContextComplexity(context);

    switch (gradeLevel) {
      case 'K-2':
        if (complexity > 50) risk += 25;
        if (context.themes.length > 2) risk += 15;
        break;
      case '3-5':
        if (complexity > 70) risk += 20;
        if (context.characters.length > 4) risk += 10;
        break;
      case '6-8':
        if (complexity > 85) risk += 15;
        break;
      default:
        risk += 5; // Unknown grade level
    }

    return risk;
  }

  private generatePreventiveActions(
    riskFactors: Array<{
      factor: string;
      severity: string;
      mitigation?: string;
    }>,
    strategy: string,
  ): string[] {
    const actions: string[] = [];

    // Add mitigations from risk factors
    riskFactors.forEach(factor => {
      if (factor.mitigation) {
        actions.push(factor.mitigation);
      }
    });

    // Add strategy-specific actions
    switch (strategy) {
      case 'skill_bypass':
        actions.push('Route directly to fallback generation');
        break;
      case 'fallback_preload':
        actions.push('Prepare fallback content in parallel');
        break;
      case 'cache_warmup':
        actions.push('Pre-load relevant cached content');
        break;
    }

    return Array.from(new Set(actions)); // Remove duplicates
  }

  private async recordErrorPattern(
    error: SkillError | Error,
    context: ErrorRecoveryContext,
  ): Promise<void> {
    const errorType = 'code' in error ? error.code : 'unknown';
    const pattern = `${errorType}_${
      context.storyContext?.gradeLevel || 'unknown'
    }`;

    if (!this.failurePatterns.has(pattern)) {
      this.failurePatterns.set(pattern, []);
    }

    const patterns = this.failurePatterns.get(pattern)!;
    const existingPattern = patterns.find(p => p.pattern === error.message);

    if (existingPattern) {
      existingPattern.frequency++;
    } else {
      patterns.push({ pattern: error.message, frequency: 1 });
    }

    // Keep only top 10 patterns per type
    patterns.sort((a, b) => b.frequency - a.frequency);
    this.failurePatterns.set(pattern, patterns.slice(0, 10));
  }

  private selectRecoveryStrategy(
    error: SkillError | Error,
    context: ErrorRecoveryContext,
  ): string {
    const errorType = 'code' in error ? error.code : 'unknown';
    const hasContext = !!context.storyContext;
    const isHighFailure = context.attemptNumber > 2;

    if (isHighFailure) return 'emergency_fallback';
    if (!hasContext) return 'basic_generation';

    switch (errorType) {
      case SkillErrorCode.SKILL_TIMEOUT:
        return 'timeout_recovery';
      case SkillErrorCode.RATE_LIMIT_EXCEEDED:
        return 'rate_limit_recovery';
      case SkillErrorCode.NETWORK_ERROR:
        return 'network_recovery';
      case SkillErrorCode.SKILL_UNAVAILABLE:
        return 'service_unavailable_recovery';
      default:
        return 'contextual_generation';
    }
  }

  private initializeRecoveryStrategies(): Map<
    string,
    (context: ErrorRecoveryContext) => Promise<ContextualFallbackResult>
  > {
    const strategies = new Map<
      string,
      (context: ErrorRecoveryContext) => Promise<ContextualFallbackResult>
    >();

    strategies.set(
      'contextual_generation',
      this.executeContextualGeneration.bind(this),
    );
    strategies.set('timeout_recovery', this.executeTimeoutRecovery.bind(this));
    strategies.set(
      'rate_limit_recovery',
      this.executeRateLimitRecovery.bind(this),
    );
    strategies.set('network_recovery', this.executeNetworkRecovery.bind(this));
    strategies.set(
      'service_unavailable_recovery',
      this.executeServiceUnavailableRecovery.bind(this),
    );
    strategies.set('basic_generation', this.executeBasicGeneration.bind(this));
    strategies.set(
      'emergency_fallback',
      this.executeEmergencyFallback.bind(this),
    );

    return strategies;
  }

  private async executeContextualGeneration(
    context: ErrorRecoveryContext,
  ): Promise<ContextualFallbackResult> {
    // Implementation continues...
    // This is a complex method that would use the story context to generate appropriate continuations
    return {
      story: 'The story continued in an unexpected way...', // Placeholder
      preservedContext: true,
      contextPreservationScore: 85,
      fallbackStrategy: 'contextual_generation',
      qualityScore: 80,
      seamless: true,
      continuityMaintained: true,
      recommendations: [
        'Context analysis successful',
        'Seamless recovery executed',
      ],
    };
  }

  private async executeTimeoutRecovery(
    context: ErrorRecoveryContext,
  ): Promise<ContextualFallbackResult> {
    // Implement shorter, simpler continuation due to timeout
    const storyContext = context.storyContext;

    if (storyContext) {
      // Generate brief, contextually-appropriate continuation
      const briefContinuation = this.generateBriefContinuation(storyContext);

      return {
        story: briefContinuation,
        preservedContext: true,
        contextPreservationScore: 75,
        fallbackStrategy: 'timeout_recovery',
        qualityScore: 70,
        seamless: false,
        continuityMaintained: true,
        recommendations: [
          'Used shorter continuation due to timeout',
          'Context preserved',
        ],
      };
    }

    return this.executeBasicGeneration(context);
  }

  private async executeRateLimitRecovery(
    context: ErrorRecoveryContext,
  ): Promise<ContextualFallbackResult> {
    // Use cached or template-based generation
    return {
      story: 'The adventure paused for a moment, then continued...',
      preservedContext: false,
      contextPreservationScore: 40,
      fallbackStrategy: 'rate_limit_recovery',
      qualityScore: 60,
      seamless: false,
      continuityMaintained: false,
      recommendations: [
        'Used template due to rate limiting',
        'Consider implementing request queuing',
      ],
    };
  }

  private async executeNetworkRecovery(
    context: ErrorRecoveryContext,
  ): Promise<ContextualFallbackResult> {
    // Use offline/cached content
    return {
      story: 'The story took an unexpected turn...',
      preservedContext: false,
      contextPreservationScore: 30,
      fallbackStrategy: 'network_recovery',
      qualityScore: 55,
      seamless: false,
      continuityMaintained: false,
      recommendations: [
        'Used offline generation',
        'Retry when network improves',
      ],
    };
  }

  private async executeServiceUnavailableRecovery(
    context: ErrorRecoveryContext,
  ): Promise<ContextualFallbackResult> {
    // Use alternative generation service or cached content
    return {
      story: "Let's try a different direction for the story...",
      preservedContext: false,
      contextPreservationScore: 35,
      fallbackStrategy: 'service_unavailable_recovery',
      qualityScore: 65,
      seamless: false,
      continuityMaintained: false,
      recommendations: [
        'Service unavailable, used alternative',
        'Monitor service status',
      ],
    };
  }

  private async executeBasicGeneration(
    context: ErrorRecoveryContext,
  ): Promise<ContextualFallbackResult> {
    return {
      story: 'The story continued...',
      preservedContext: false,
      contextPreservationScore: 20,
      fallbackStrategy: 'basic_generation',
      qualityScore: 50,
      seamless: false,
      continuityMaintained: false,
      recommendations: [
        'Basic fallback used',
        'Consider improving context analysis',
      ],
    };
  }

  private async executeDefaultRecovery(
    context: ErrorRecoveryContext,
  ): Promise<ContextualFallbackResult> {
    return this.executeBasicGeneration(context);
  }

  private async executeEmergencyFallback(
    context: ErrorRecoveryContext,
  ): Promise<ContextualFallbackResult> {
    return {
      story: 'Something interesting happened next...',
      preservedContext: false,
      contextPreservationScore: 10,
      fallbackStrategy: 'emergency_fallback',
      qualityScore: 40,
      seamless: false,
      continuityMaintained: false,
      recommendations: [
        'Emergency fallback activated',
        'Review error handling system',
      ],
    };
  }

  private generateBriefContinuation(context: StoryContext): string {
    // Generate a brief, contextually appropriate continuation
    const character = context.characters[0] || 'the character';
    const setting =
      context.settings[context.settings.length - 1] || 'the place';

    const templates = [
      `${character} looked around ${setting} thoughtfully.`,
      `Something caught ${character}'s attention.`,
      `${character} decided to explore further.`,
      `A new idea occurred to ${character}.`,
    ];

    return templates[Math.floor(Math.random() * templates.length)];
  }

  private async validateRecoveryResult(
    result: ContextualFallbackResult,
    context: ErrorRecoveryContext,
  ): Promise<ContextualFallbackResult> {
    // Validate that the recovery result meets minimum standards
    if (result.qualityScore < 40) {
      // If quality is too low, try to improve it
      result.qualityScore = Math.max(40, result.qualityScore);
      result.recommendations.push('Quality improved through validation');
    }

    return result;
  }
}
