/**
 * Seamless Error Masking Service
 *
 * Handles user experience preservation during error recovery scenarios
 * Task 6.1: Context-Aware Error Handling - Seamless error masking for user experience
 */

import { structuredLogger } from '../utils/logger';
import { SkillError, SkillErrorCode } from '../types/claudeSkills';
import { GradeLevel } from '../types/story';
import {
  ContextualFallbackResult,
  ErrorRecoveryContext,
} from './contextualFallback';

export interface UserProfile {
  userId: string;
  ageGroup: 'child' | 'teen' | 'adult';
  gradeLevel: GradeLevel;
  expectationLevel: 'low' | 'medium' | 'high';
  preferredInteractionStyle: 'guided' | 'independent' | 'collaborative';
  attentionSpan: 'short' | 'medium' | 'long';
  previousExperience: {
    totalSessions: number;
    successRate: number;
    averageSessionDuration: number;
    lastInteractionDate: Date;
  };
  accessibility: {
    needsSimpleLanguage: boolean;
    prefersVisualFeedback: boolean;
    requiresAudioSupport: boolean;
  };
}

export interface SessionContext {
  sessionId: string;
  startTime: Date;
  currentDuration: number;
  interactionCount: number;
  successfulInteractions: number;
  errorCount: number;
  userEngagementScore: number; // 0-100
  isFirstSession: boolean;
  deviceType: 'phone' | 'tablet' | 'desktop';
  networkQuality: 'excellent' | 'good' | 'poor' | 'offline';
  backgroundProcessing: boolean;
}

export interface ErrorMaskingStrategy {
  strategy: string;
  userMessage: string | null;
  showProgress: boolean;
  delayResponse: boolean;
  delayDuration?: number; // milliseconds
  alternativeAction?:
    | 'suggest_different_direction'
    | 'offer_alternatives'
    | 'provide_help'
    | 'show_examples';
  fallbackContent?: string;
  progressIndicator: {
    type: 'spinner' | 'dots' | 'progress_bar' | 'creative_animation' | 'none';
    message: string;
    estimated_duration?: number;
  };
  soundEffects?: {
    enabled: boolean;
    type: 'thinking' | 'processing' | 'magical' | 'none';
  };
  visualEffects?: {
    enabled: boolean;
    type: 'gentle_transition' | 'sparkles' | 'fade' | 'none';
  };
}

export interface RecoveryExperience {
  seamlessScore: number; // 0-100, how invisible the error was to user
  userSatisfaction: number; // 0-100, predicted user satisfaction
  immersionPreserved: boolean;
  alternativeOffered: boolean;
  recoveryTime: number; // milliseconds
  strategiesUsed: string[];
  userFeedback?: {
    collected: boolean;
    rating?: number;
    comments?: string;
  };
}

export class SeamlessErrorMaskingService {
  private userProfiles: Map<string, UserProfile> = new Map();
  private sessionContexts: Map<string, SessionContext> = new Map();
  private maskingStrategies: Map<string, ErrorMaskingStrategy> = new Map();
  private recoveryMetrics: Map<string, RecoveryExperience[]> = new Map();

  constructor() {
    this.initializeMaskingStrategies();
  }

  /**
   * Determine optimal error masking strategy for user experience
   */
  public async maskErrorForUser(
    error: SkillError | Error,
    recoveryResult: ContextualFallbackResult,
    userProfile: UserProfile,
    sessionContext: SessionContext,
    recoveryContext: ErrorRecoveryContext,
  ): Promise<ErrorMaskingStrategy> {
    try {
      structuredLogger.info('Determining error masking strategy', {
        errorType: error instanceof SkillError ? error.code : 'unknown',
        userId: userProfile.userId,
        ageGroup: userProfile.ageGroup,
        expectationLevel: userProfile.expectationLevel,
        sessionDuration: sessionContext.currentDuration,
        fallbackQuality: recoveryResult.qualityScore,
      });

      // Analyze error characteristics
      const errorCharacteristics = this.analyzeErrorCharacteristics(
        error,
        recoveryContext,
      );

      // Assess user vulnerability to error perception
      const userVulnerability = this.assessUserVulnerability(
        userProfile,
        sessionContext,
      );

      // Evaluate recovery quality and seamlessness potential
      const recoveryQuality = this.evaluateRecoveryQuality(recoveryResult);

      // Select optimal masking strategy
      const strategy = this.selectMaskingStrategy(
        errorCharacteristics,
        userVulnerability,
        recoveryQuality,
        userProfile,
        sessionContext,
      );

      // Customize strategy for specific user and context
      const customizedStrategy = await this.customizeStrategy(
        strategy,
        userProfile,
        sessionContext,
      );

      // Log strategy selection for learning
      await this.logStrategySelection(
        customizedStrategy,
        userProfile,
        sessionContext,
        recoveryResult,
      );

      structuredLogger.info('Error masking strategy determined', {
        strategy: customizedStrategy.strategy,
        showProgress: customizedStrategy.showProgress,
        delayResponse: customizedStrategy.delayResponse,
        hasAlternative: !!customizedStrategy.alternativeAction,
      });

      return customizedStrategy;
    } catch (error) {
      structuredLogger.error(
        'Error masking strategy determination failed',
        {},
        error as Error,
      );

      // Return safe default strategy
      return this.getFailsafeStrategy(userProfile.ageGroup);
    }
  }

  /**
   * Execute error masking strategy and monitor user experience
   */
  public async executeMaskingStrategy(
    strategy: ErrorMaskingStrategy,
    userProfile: UserProfile,
    sessionContext: SessionContext,
  ): Promise<{
    executed: boolean;
    userExperienceScore: number;
    adjustmentsNeeded: string[];
    nextActions: string[];
  }> {
    try {
      const startTime = Date.now();

      structuredLogger.info('Executing error masking strategy', {
        strategy: strategy.strategy,
        userId: userProfile.userId,
        hasDelay: strategy.delayResponse,
        showsProgress: strategy.showProgress,
      });

      // Apply delay if specified (simulate normal processing time)
      if (strategy.delayResponse && strategy.delayDuration) {
        await this.simulateProcessingDelay(
          strategy.delayDuration,
          strategy.progressIndicator,
        );
      }

      // Execute visual and audio effects
      await this.executeUserInterfaceEffects(strategy, userProfile);

      // Monitor user experience during execution
      const experienceScore = this.monitorUserExperience(
        strategy,
        userProfile,
        sessionContext,
      );

      // Determine if adjustments are needed
      const adjustments = this.assessAdjustmentsNeeded(
        strategy,
        experienceScore,
        userProfile,
      );

      // Generate next action recommendations
      const nextActions = this.generateNextActions(
        strategy,
        experienceScore,
        adjustments,
      );

      const executionTime = Date.now() - startTime;

      // Update session context
      this.updateSessionContext(sessionContext, strategy, experienceScore);

      structuredLogger.info('Error masking strategy executed', {
        strategy: strategy.strategy,
        executionTime,
        experienceScore,
        adjustmentsNeeded: adjustments.length,
      });

      return {
        executed: true,
        userExperienceScore: experienceScore,
        adjustmentsNeeded: adjustments,
        nextActions,
      };
    } catch (error) {
      structuredLogger.error(
        'Error masking strategy execution failed',
        {},
        error as Error,
      );

      return {
        executed: false,
        userExperienceScore: 30, // Low score for failed masking
        adjustmentsNeeded: [
          'Strategy execution failed - review implementation',
        ],
        nextActions: ['Fallback to basic error handling'],
      };
    }
  }

  /**
   * Collect user feedback on error recovery experience
   */
  public async collectRecoveryFeedback(
    userProfile: UserProfile,
    sessionContext: SessionContext,
    strategy: ErrorMaskingStrategy,
    implicit: boolean = true,
  ): Promise<RecoveryExperience> {
    try {
      const recoveryExperience: RecoveryExperience = {
        seamlessScore: this.calculateSeamlessScore(
          strategy,
          userProfile,
          sessionContext,
        ),
        userSatisfaction: this.estimateUserSatisfaction(
          strategy,
          userProfile,
          sessionContext,
        ),
        immersionPreserved: this.assessImmersionPreservation(
          strategy,
          sessionContext,
        ),
        alternativeOffered: !!strategy.alternativeAction,
        recoveryTime: strategy.delayDuration || 0,
        strategiesUsed: [strategy.strategy],
        userFeedback: {
          collected: implicit,
          rating: implicit ? this.inferUserRating(sessionContext) : undefined,
          comments: undefined,
        },
      };

      // Store recovery experience for learning
      const userExperiences =
        this.recoveryMetrics.get(userProfile.userId) || [];
      userExperiences.push(recoveryExperience);

      // Keep only recent experiences (last 50)
      this.recoveryMetrics.set(userProfile.userId, userExperiences.slice(-50));

      structuredLogger.info('Recovery feedback collected', {
        userId: userProfile.userId,
        seamlessScore: recoveryExperience.seamlessScore,
        userSatisfaction: recoveryExperience.userSatisfaction,
        immersionPreserved: recoveryExperience.immersionPreserved,
      });

      return recoveryExperience;
    } catch (error) {
      structuredLogger.error(
        'Recovery feedback collection failed',
        {},
        error as Error,
      );

      // Return minimal experience record
      return {
        seamlessScore: 50,
        userSatisfaction: 50,
        immersionPreserved: false,
        alternativeOffered: false,
        recoveryTime: 0,
        strategiesUsed: ['unknown'],
        userFeedback: { collected: false },
      };
    }
  }

  // Private implementation methods

  private analyzeErrorCharacteristics(
    error: SkillError | Error,
    recoveryContext: ErrorRecoveryContext,
  ): {
    severity: 'low' | 'medium' | 'high' | 'critical';
    recoverability: 'easy' | 'moderate' | 'difficult';
    userVisibility: 'hidden' | 'subtle' | 'noticeable' | 'obvious';
    timeToRecover: number;
  } {
    const isSkillError = error instanceof SkillError;
    const errorCode = isSkillError ? error.code : 'UNKNOWN_ERROR';
    const attemptNumber = recoveryContext.attemptNumber;

    let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
    let recoverability: 'easy' | 'moderate' | 'difficult' = 'moderate';
    let userVisibility: 'hidden' | 'subtle' | 'noticeable' | 'obvious' =
      'subtle';
    let timeToRecover = 2000; // Default 2 seconds

    // Analyze based on error type
    if (isSkillError) {
      switch (errorCode) {
        case SkillErrorCode.SKILL_TIMEOUT:
          severity = 'medium';
          recoverability = 'easy';
          userVisibility = 'hidden';
          timeToRecover = 1500;
          break;
        case SkillErrorCode.RATE_LIMIT_EXCEEDED:
          severity = 'medium';
          recoverability = 'moderate';
          userVisibility = 'subtle';
          timeToRecover = 3000;
          break;
        case SkillErrorCode.NETWORK_ERROR:
          severity = 'high';
          recoverability = 'difficult';
          userVisibility = 'noticeable';
          timeToRecover = 5000;
          break;
        case SkillErrorCode.SKILL_UNAVAILABLE:
          severity = 'high';
          recoverability = 'moderate';
          userVisibility = 'subtle';
          timeToRecover = 2500;
          break;
        case SkillErrorCode.AUTHENTICATION_ERROR:
          severity = 'critical';
          recoverability = 'difficult';
          userVisibility = 'obvious';
          timeToRecover = 4000;
          break;
      }
    }

    // Adjust based on attempt number
    if (attemptNumber > 1) {
      if (severity === 'low') severity = 'medium';
      else if (severity === 'medium') severity = 'high';

      if (recoverability === 'easy') recoverability = 'moderate';
      else if (recoverability === 'moderate') recoverability = 'difficult';

      timeToRecover += (attemptNumber - 1) * 1000;
    }

    return { severity, recoverability, userVisibility, timeToRecover };
  }

  private assessUserVulnerability(
    userProfile: UserProfile,
    sessionContext: SessionContext,
  ): {
    errorSensitivity: number; // 0-100, higher = more sensitive to errors
    expectationLevel: number; // 0-100, higher = expects perfect experience
    attentionToDetail: number; // 0-100, higher = likely to notice inconsistencies
    patienceLevel: number; // 0-100, higher = more patient with delays
  } {
    let errorSensitivity = 50;
    let expectationLevel = 50;
    let attentionToDetail = 50;
    let patienceLevel = 50;

    // Age group adjustments
    switch (userProfile.ageGroup) {
      case 'child':
        errorSensitivity = 30; // Children less sensitive to technical errors
        attentionToDetail = 20; // Less likely to notice technical inconsistencies
        patienceLevel = 30; // Lower patience for delays
        break;
      case 'teen':
        errorSensitivity = 60;
        attentionToDetail = 70;
        patienceLevel = 40;
        break;
      case 'adult':
        errorSensitivity = 70;
        attentionToDetail = 80;
        patienceLevel = 60;
        break;
    }

    // Expectation level adjustments
    switch (userProfile.expectationLevel) {
      case 'low':
        expectationLevel = 30;
        errorSensitivity -= 20;
        break;
      case 'medium':
        expectationLevel = 60;
        break;
      case 'high':
        expectationLevel = 90;
        errorSensitivity += 20;
        attentionToDetail += 15;
        break;
    }

    // Experience adjustments
    const experienceLevel = userProfile.previousExperience.totalSessions;
    if (experienceLevel > 10) {
      attentionToDetail += 15; // Experienced users notice more
      expectationLevel += 10;
    }

    // Session context adjustments
    if (sessionContext.errorCount > 0) {
      errorSensitivity += sessionContext.errorCount * 10; // Each error increases sensitivity
      patienceLevel -= sessionContext.errorCount * 5;
    }

    if (sessionContext.currentDuration > 1800000) {
      // 30 minutes
      patienceLevel -= 20; // User fatigue reduces patience
    }

    // Clamp values to 0-100 range
    return {
      errorSensitivity: Math.max(0, Math.min(100, errorSensitivity)),
      expectationLevel: Math.max(0, Math.min(100, expectationLevel)),
      attentionToDetail: Math.max(0, Math.min(100, attentionToDetail)),
      patienceLevel: Math.max(0, Math.min(100, patienceLevel)),
    };
  }

  private evaluateRecoveryQuality(recoveryResult: ContextualFallbackResult): {
    contentQuality: number;
    contextPreservation: number;
    seamlessPotential: number;
    overallRecoveryScore: number;
  } {
    return {
      contentQuality: recoveryResult.qualityScore,
      contextPreservation: recoveryResult.contextPreservationScore,
      seamlessPotential: recoveryResult.seamless ? 90 : 50,
      overallRecoveryScore:
        (recoveryResult.qualityScore +
          recoveryResult.contextPreservationScore) /
        2,
    };
  }

  private selectMaskingStrategy(
    errorCharacteristics: any,
    userVulnerability: any,
    recoveryQuality: any,
    userProfile: UserProfile,
    sessionContext: SessionContext,
  ): ErrorMaskingStrategy {
    // High-quality recovery with low error visibility = invisible strategy
    if (
      recoveryQuality.overallRecoveryScore > 80 &&
      errorCharacteristics.userVisibility === 'hidden'
    ) {
      return this.getStrategy('invisible_recovery');
    }

    // Child user with good recovery = gentle masking
    if (
      userProfile.ageGroup === 'child' &&
      recoveryQuality.contentQuality > 60
    ) {
      return this.getStrategy('gentle_child_masking');
    }

    // High expectation user with good recovery = transparent enhancement
    if (
      userProfile.expectationLevel === 'high' &&
      recoveryQuality.overallRecoveryScore > 70
    ) {
      return this.getStrategy('transparent_enhancement');
    }

    // Network error with poor connection = offline mode masking
    if (sessionContext.networkQuality === 'poor') {
      return this.getStrategy('offline_mode_masking');
    }

    // Multiple attempts = apologetic recovery
    if (sessionContext.errorCount > 1) {
      return this.getStrategy('apologetic_recovery');
    }

    // Default to standard masking
    return this.getStrategy('standard_masking');
  }

  private getStrategy(strategyKey: string): ErrorMaskingStrategy {
    return (
      this.maskingStrategies.get(strategyKey) ||
      this.getFailsafeStrategy('child')
    );
  }

  private async customizeStrategy(
    baseStrategy: ErrorMaskingStrategy,
    userProfile: UserProfile,
    sessionContext: SessionContext,
  ): Promise<ErrorMaskingStrategy> {
    const customized = { ...baseStrategy };

    // Customize messages for age group
    if (userProfile.ageGroup === 'child' && customized.userMessage) {
      customized.userMessage = this.simplifyLanguageForChild(
        customized.userMessage,
      );
    }

    // Adjust delay based on attention span
    if (userProfile.attentionSpan === 'short' && customized.delayDuration) {
      customized.delayDuration = Math.min(customized.delayDuration, 2000);
    }

    // Customize visual effects based on preferences
    if (
      userProfile.accessibility.prefersVisualFeedback &&
      customized.visualEffects
    ) {
      customized.visualEffects.enabled = true;
    }

    // Customize progress indicator based on device type
    if (
      sessionContext.deviceType === 'phone' &&
      customized.progressIndicator.type === 'progress_bar'
    ) {
      customized.progressIndicator.type = 'dots'; // Better for small screens
    }

    return customized;
  }

  private simplifyLanguageForChild(message: string): string {
    return message
      .replace(/processing/gi, 'thinking')
      .replace(/analyzing/gi, 'looking at')
      .replace(/generating/gi, 'making')
      .replace(/optimizing/gi, 'making better');
  }

  private async simulateProcessingDelay(
    duration: number,
    progressIndicator: any,
  ): Promise<void> {
    // This would integrate with the UI to show progress
    return new Promise(resolve => {
      setTimeout(resolve, duration);
    });
  }

  private async executeUserInterfaceEffects(
    strategy: ErrorMaskingStrategy,
    userProfile: UserProfile,
  ): Promise<void> {
    // This would integrate with the UI layer to execute visual/audio effects
    if (strategy.visualEffects?.enabled) {
      structuredLogger.debug('Executing visual effects', {
        type: strategy.visualEffects.type,
        userId: userProfile.userId,
      });
    }

    if (strategy.soundEffects?.enabled) {
      structuredLogger.debug('Executing sound effects', {
        type: strategy.soundEffects.type,
        userId: userProfile.userId,
      });
    }
  }

  private monitorUserExperience(
    strategy: ErrorMaskingStrategy,
    userProfile: UserProfile,
    sessionContext: SessionContext,
  ): number {
    let score = 70; // Base score

    // Strategy effectiveness
    if (strategy.strategy === 'invisible_recovery') score += 20;
    else if (strategy.strategy === 'gentle_child_masking') score += 15;

    // User compatibility
    if (
      userProfile.ageGroup === 'child' &&
      strategy.progressIndicator.type === 'creative_animation'
    ) {
      score += 10;
    }

    // Session context
    if (sessionContext.userEngagementScore > 80) score += 10;
    if (sessionContext.errorCount === 0) score += 15;

    // Accessibility
    if (
      userProfile.accessibility.prefersVisualFeedback &&
      strategy.visualEffects?.enabled
    ) {
      score += 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  private assessAdjustmentsNeeded(
    strategy: ErrorMaskingStrategy,
    experienceScore: number,
    userProfile: UserProfile,
  ): string[] {
    const adjustments: string[] = [];

    if (experienceScore < 60) {
      adjustments.push(
        'Strategy effectiveness below target - consider alternative approach',
      );
    }

    if (strategy.delayResponse && userProfile.attentionSpan === 'short') {
      adjustments.push(
        'Consider reducing delay duration for short attention span users',
      );
    }

    if (!strategy.showProgress && experienceScore < 70) {
      adjustments.push(
        'Consider adding progress indicator to improve user confidence',
      );
    }

    return adjustments;
  }

  private generateNextActions(
    strategy: ErrorMaskingStrategy,
    experienceScore: number,
    adjustments: string[],
  ): string[] {
    const actions: string[] = [];

    if (experienceScore > 80) {
      actions.push('Strategy successful - monitor for continued effectiveness');
    } else if (experienceScore > 60) {
      actions.push(
        'Strategy moderately successful - minor optimizations recommended',
      );
    } else {
      actions.push('Strategy needs improvement - consider fallback approach');
    }

    if (adjustments.length > 0) {
      actions.push(
        'Implement suggested adjustments for future similar scenarios',
      );
    }

    if (strategy.alternativeAction) {
      actions.push(`Execute alternative action: ${strategy.alternativeAction}`);
    }

    return actions;
  }

  private updateSessionContext(
    sessionContext: SessionContext,
    strategy: ErrorMaskingStrategy,
    experienceScore: number,
  ): void {
    // Update engagement score based on masking success
    const engagementImpact = ((experienceScore - 50) / 50) * 10; // -10 to +10
    sessionContext.userEngagementScore = Math.max(
      0,
      Math.min(100, sessionContext.userEngagementScore + engagementImpact),
    );

    // Update interaction count
    sessionContext.interactionCount++;

    // If experience was good, count as successful
    if (experienceScore > 70) {
      sessionContext.successfulInteractions++;
    }
  }

  private calculateSeamlessScore(
    strategy: ErrorMaskingStrategy,
    userProfile: UserProfile,
    sessionContext: SessionContext,
  ): number {
    let score = 50; // Base seamlessness

    // Strategy type impact
    if (strategy.strategy === 'invisible_recovery') score += 40;
    else if (strategy.strategy.includes('gentle')) score += 25;
    else if (strategy.strategy.includes('transparent')) score += 15;

    // User message impact (less seamless if user sees message)
    if (!strategy.userMessage) score += 20;
    else if (strategy.userMessage.length < 50) score += 10;

    // Delay impact
    if (!strategy.delayResponse) score += 10;
    else if ((strategy.delayDuration || 0) < 1000) score += 5;

    // User characteristics
    if (
      userProfile.ageGroup === 'child' &&
      userProfile.attentionSpan === 'short'
    ) {
      score += 10; // Children less likely to notice seamless recovery
    }

    return Math.max(0, Math.min(100, score));
  }

  private estimateUserSatisfaction(
    strategy: ErrorMaskingStrategy,
    userProfile: UserProfile,
    sessionContext: SessionContext,
  ): number {
    let satisfaction = 60; // Base satisfaction

    // Strategy appropriateness
    if (
      (userProfile.ageGroup === 'child' &&
        strategy.strategy.includes('child')) ||
      (userProfile.expectationLevel === 'high' &&
        strategy.strategy.includes('transparent'))
    ) {
      satisfaction += 20;
    }

    // Progress indication satisfaction
    if (
      strategy.showProgress &&
      strategy.progressIndicator.message.length > 0
    ) {
      satisfaction += 15;
    }

    // Alternative action availability
    if (strategy.alternativeAction) {
      satisfaction += 10;
    }

    // Session quality impact
    satisfaction += (sessionContext.userEngagementScore - 50) / 5;

    return Math.max(0, Math.min(100, satisfaction));
  }

  private assessImmersionPreservation(
    strategy: ErrorMaskingStrategy,
    sessionContext: SessionContext,
  ): boolean {
    // Immersion preserved if no obvious error indication and quick recovery
    const noObviousError =
      !strategy.userMessage || strategy.userMessage.length < 30;
    const quickRecovery =
      !strategy.delayResponse || (strategy.delayDuration || 0) < 2000;
    const goodEngagement = sessionContext.userEngagementScore > 70;

    return noObviousError && quickRecovery && goodEngagement;
  }

  private inferUserRating(sessionContext: SessionContext): number {
    // Infer rating from user engagement and session quality
    let rating = 3; // Base rating (out of 5)

    if (sessionContext.userEngagementScore > 80) rating = 5;
    else if (sessionContext.userEngagementScore > 60) rating = 4;
    else if (sessionContext.userEngagementScore < 40) rating = 2;
    else if (sessionContext.userEngagementScore < 20) rating = 1;

    // Adjust for error frequency
    if (sessionContext.errorCount === 0) rating += 0.5;
    else if (sessionContext.errorCount > 2) rating -= 1;

    return Math.max(1, Math.min(5, Math.round(rating)));
  }

  private async logStrategySelection(
    strategy: ErrorMaskingStrategy,
    userProfile: UserProfile,
    sessionContext: SessionContext,
    recoveryResult: ContextualFallbackResult,
  ): Promise<void> {
    structuredLogger.info('Error masking strategy selected', {
      strategy: strategy.strategy,
      userId: userProfile.userId,
      ageGroup: userProfile.ageGroup,
      expectationLevel: userProfile.expectationLevel,
      sessionErrorCount: sessionContext.errorCount,
      recoveryQuality: recoveryResult.qualityScore,
      contextPreservation: recoveryResult.contextPreservationScore,
    });
  }

  private getFailsafeStrategy(ageGroup: string): ErrorMaskingStrategy {
    const baseMessage =
      ageGroup === 'child'
        ? 'Let me think about that...'
        : 'Processing your request...';

    return {
      strategy: 'failsafe',
      userMessage: baseMessage,
      showProgress: true,
      delayResponse: true,
      delayDuration: 1500,
      progressIndicator: {
        type: 'dots',
        message: 'Please wait...',
      },
    };
  }

  private initializeMaskingStrategies(): void {
    // Invisible recovery - best case scenario
    this.maskingStrategies.set('invisible_recovery', {
      strategy: 'invisible_recovery',
      userMessage: null,
      showProgress: false,
      delayResponse: true,
      delayDuration: 500, // Minimal delay to simulate normal processing
      progressIndicator: {
        type: 'none',
        message: '',
      },
    });

    // Gentle child masking
    this.maskingStrategies.set('gentle_child_masking', {
      strategy: 'gentle_child_masking',
      userMessage: 'Let me think of something special...',
      showProgress: true,
      delayResponse: true,
      delayDuration: 2000,
      progressIndicator: {
        type: 'creative_animation',
        message: 'Creating magic...',
        estimated_duration: 2000,
      },
      visualEffects: {
        enabled: true,
        type: 'sparkles',
      },
      soundEffects: {
        enabled: true,
        type: 'magical',
      },
    });

    // Transparent enhancement - for sophisticated users
    this.maskingStrategies.set('transparent_enhancement', {
      strategy: 'transparent_enhancement',
      userMessage: "I'm exploring creative alternatives for your story...",
      showProgress: true,
      delayResponse: false,
      alternativeAction: 'offer_alternatives',
      progressIndicator: {
        type: 'progress_bar',
        message: 'Analyzing creative options...',
      },
    });

    // Offline mode masking
    this.maskingStrategies.set('offline_mode_masking', {
      strategy: 'offline_mode_masking',
      userMessage: null,
      showProgress: true,
      delayResponse: true,
      delayDuration: 1000,
      alternativeAction: 'suggest_different_direction',
      progressIndicator: {
        type: 'dots',
        message: 'Working with available resources...',
      },
    });

    // Apologetic recovery - for repeated errors
    this.maskingStrategies.set('apologetic_recovery', {
      strategy: 'apologetic_recovery',
      userMessage: 'I want to get this just right for you...',
      showProgress: true,
      delayResponse: true,
      delayDuration: 3000,
      alternativeAction: 'provide_help',
      progressIndicator: {
        type: 'spinner',
        message: 'Taking extra care...',
        estimated_duration: 3000,
      },
    });

    // Standard masking - general purpose
    this.maskingStrategies.set('standard_masking', {
      strategy: 'standard_masking',
      userMessage: null,
      showProgress: true,
      delayResponse: true,
      delayDuration: 1500,
      progressIndicator: {
        type: 'dots',
        message: 'Processing...',
      },
    });
  }
}
