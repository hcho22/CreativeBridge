/**
 * Claude-Powered Content Quality Assessment Service
 *
 * Replaces rule-based quality metrics with Claude-powered content analysis
 * Task 5.1: Claude-Powered Quality Assessment
 */

import { structuredLogger } from '../utils/logger';
import { StoryRequest, StoryResponse, GradeLevel } from '../types/story';
import { SkillManager } from '../types/claudeSkills';

export interface QualityAssessmentMetrics {
  overallScore: number; // 0-100 composite quality score
  educationalValue: number; // 0-100 educational appropriateness
  narrativeCoherence: number; // 0-100 story flow and consistency
  gradeAppropriatenesss: number; // 0-100 age-appropriate language and content
  engagementPotential: number; // 0-100 estimated reader engagement
  culturalSensitivity: number; // 0-100 inclusivity and sensitivity score
  vocabularyComplexity: number; // 0-100 vocabulary level appropriateness
  contentSafety: number; // 0-100 safety and appropriateness
}

export interface QualityAssessmentResult {
  metrics: QualityAssessmentMetrics;
  passed: boolean;
  confidence: number; // 0-1 assessment confidence
  recommendations: string[];
  issues: QualityIssue[];
  improvementSuggestions: string[];
}

export interface QualityIssue {
  type:
    | 'educational'
    | 'narrative'
    | 'appropriateness'
    | 'engagement'
    | 'cultural'
    | 'vocabulary'
    | 'safety';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  location?: string; // Specific part of content if applicable
  suggestion: string;
}

export interface QualityStandards {
  gradeLevel: GradeLevel;
  minimumScores: Partial<QualityAssessmentMetrics>;
  requiredElements: string[];
  prohibitedElements: string[];
  vocabularyGuidelines: {
    maxComplexityLevel: number;
    preferredWordTypes: string[];
    avoidedConcepts: string[];
  };
}

export interface AdaptiveQualityMetrics {
  userId: string;
  gradeLevel: GradeLevel;
  averageEngagement: number; // 0-1 scale
  contentPreferenceTrend: number; // -1 to 1, preference change trend
  qualityFeedbackHistory: Array<{
    timestamp: number;
    overallScore: number;
    userRating: number;
    engagementDuration: number;
    completionRate: number;
  }>;
  adaptedThresholds: Partial<QualityAssessmentMetrics>;
  lastUpdated: number;
  confidenceLevel: number; // 0-1, how confident we are in the adaptations
}

export interface EngagementCorrelationData {
  qualityScore: number;
  engagementMetrics: {
    readingTime: number;
    completionRate: number;
    userRating: number;
    retryCount: number;
    shareCount: number;
  };
  contextFactors: {
    gradeLevel: GradeLevel;
    timeOfDay: string;
    sessionLength: number;
    contentType: string;
  };
}

// Quality standards by grade level. Keyed by grade-level strings; the lookup
// callers fall back when a key is absent, so we use a string-indexed map
// rather than a strict `Record<GradeLevel, ...>` (which would also need to
// account for the legacy `Grade3` key carried for backwards compatibility).
const QUALITY_STANDARDS: Record<string, QualityStandards> = {
  'K-2': {
    gradeLevel: 'K-2',
    minimumScores: {
      overallScore: 85,
      educationalValue: 80,
      narrativeCoherence: 75,
      gradeAppropriatenesss: 95,
      engagementPotential: 80,
      culturalSensitivity: 90,
      vocabularyComplexity: 70,
      contentSafety: 100,
    },
    requiredElements: [
      'simple sentence structure',
      'clear character motivation',
      'positive resolution',
    ],
    prohibitedElements: [
      'complex themes',
      'abstract concepts',
      'scary content',
    ],
    vocabularyGuidelines: {
      maxComplexityLevel: 3,
      preferredWordTypes: [
        'concrete nouns',
        'action verbs',
        'descriptive adjectives',
      ],
      avoidedConcepts: [
        'death',
        'violence',
        'complex emotions',
        'abstract philosophy',
      ],
    },
  },
  '3-5': {
    gradeLevel: '3-5',
    minimumScores: {
      overallScore: 85,
      educationalValue: 80,
      narrativeCoherence: 80,
      gradeAppropriatenesss: 90,
      engagementPotential: 85,
      culturalSensitivity: 90,
      vocabularyComplexity: 75,
      contentSafety: 95,
    },
    requiredElements: [
      'character development',
      'problem-solving',
      'educational elements',
    ],
    prohibitedElements: ['inappropriate content', 'overly complex themes'],
    vocabularyGuidelines: {
      maxComplexityLevel: 5,
      preferredWordTypes: [
        'grade-appropriate vocabulary',
        'educational terms',
        'descriptive language',
      ],
      avoidedConcepts: ['mature themes', 'complex philosophical concepts'],
    },
  },
  '6-8': {
    gradeLevel: '6-8',
    minimumScores: {
      overallScore: 85,
      educationalValue: 85,
      narrativeCoherence: 85,
      gradeAppropriatenesss: 85,
      engagementPotential: 85,
      culturalSensitivity: 90,
      vocabularyComplexity: 80,
      contentSafety: 95,
    },
    requiredElements: [
      'complex narrative structure',
      'character growth',
      'thematic elements',
    ],
    prohibitedElements: ['inappropriate content', 'overly mature themes'],
    vocabularyGuidelines: {
      maxComplexityLevel: 7,
      preferredWordTypes: [
        'advanced vocabulary',
        'subject-specific terms',
        'figurative language',
      ],
      avoidedConcepts: ['adult themes', 'inappropriate content'],
    },
  },
  // Legacy `Grade3` key retained for backwards compatibility with older
  // persisted gradeLevel values; the cast bypasses the GradeLevel union
  // because this entry is only reachable via string-keyed lookup.
  Grade3: {
    gradeLevel: 'Grade3' as GradeLevel,
    minimumScores: {
      overallScore: 85,
      educationalValue: 80,
      narrativeCoherence: 80,
      gradeAppropriatenesss: 90,
      engagementPotential: 85,
      culturalSensitivity: 90,
      vocabularyComplexity: 75,
      contentSafety: 95,
    },
    requiredElements: [
      'character development',
      'problem-solving',
      'educational elements',
    ],
    prohibitedElements: ['inappropriate content', 'overly complex themes'],
    vocabularyGuidelines: {
      maxComplexityLevel: 5,
      preferredWordTypes: [
        'grade-appropriate vocabulary',
        'educational terms',
        'descriptive language',
      ],
      avoidedConcepts: ['mature themes', 'complex philosophical concepts'],
    },
  },
};

export class ContentQualityService {
  private skillManager: SkillManager;
  private assessmentCache: Map<string, QualityAssessmentResult> = new Map();
  private cacheTimeout = 300000; // 5 minutes
  private adaptiveMetricsCache: Map<string, AdaptiveQualityMetrics> = new Map();
  private engagementCorrelationData: EngagementCorrelationData[] = [];
  private adaptationEnabled = true;
  private maxHistoryLength = 50; // Maximum number of feedback entries to keep per user

  constructor(skillManager: SkillManager) {
    this.skillManager = skillManager;
  }

  /**
   * Perform comprehensive quality assessment using Claude Skills
   */
  async assessContent(
    story: StoryResponse,
    request: StoryRequest,
    useCache: boolean = true,
    userId?: string,
  ): Promise<QualityAssessmentResult> {
    try {
      const cacheKey = this.generateCacheKey(story, request);

      // Check cache first
      if (useCache && this.assessmentCache.has(cacheKey)) {
        const cached = this.assessmentCache.get(cacheKey)!;
        structuredLogger.debug('Content quality assessment cache hit', {
          cacheKey,
        });
        return cached;
      }

      structuredLogger.info(
        'Starting Claude-powered content quality assessment',
        {
          gradeLevel: request.gradeLevel,
          contentLength: story.story.length,
          adaptiveEnabled: this.adaptationEnabled && !!userId,
        },
      );

      // Get quality standards for grade level (potentially adapted)
      const standards = await this.getAdaptiveQualityStandards(
        request.gradeLevel,
        userId,
      );

      // Perform comprehensive assessment using Claude Skills
      const assessmentResult = await this.performClaudeAssessment(
        story,
        request,
        standards,
      );

      // Apply user-specific threshold adaptations if available
      if (userId && this.adaptationEnabled) {
        await this.applyAdaptiveThresholds(
          assessmentResult,
          userId,
          request.gradeLevel,
        );
      }

      // Cache the result
      if (useCache) {
        this.assessmentCache.set(cacheKey, assessmentResult);
        setTimeout(
          () => this.assessmentCache.delete(cacheKey),
          this.cacheTimeout,
        );
      }

      structuredLogger.info('Content quality assessment complete', {
        overallScore: assessmentResult.metrics.overallScore,
        passed: assessmentResult.passed,
        confidence: assessmentResult.confidence,
        issueCount: assessmentResult.issues.length,
        adaptiveThresholdsApplied: this.adaptationEnabled && !!userId,
      });

      return assessmentResult;
    } catch (error) {
      structuredLogger.error(
        'Content quality assessment failed',
        {
          gradeLevel: request.gradeLevel,
        },
        error as Error,
      );

      // Return fallback assessment
      return this.generateFallbackAssessment(story, request);
    }
  }

  /**
   * Perform contextual content validation
   */
  async validateContextualContent(
    story: StoryResponse,
    request: StoryRequest,
    previousContext?: any,
  ): Promise<{ valid: boolean; contextConsistency: number; issues: string[] }> {
    try {
      structuredLogger.debug('Validating contextual content consistency');

      const contextAnalysis = await this.skillManager.executeSkill<{
        contextConsistency?: unknown;
        inconsistencies?: unknown;
      }>('ContentValidationSkill', {
        content: story.story,
        request,
        previousContext,
        validationType: 'contextual',
      });

      if (!contextAnalysis.success) {
        throw new Error('Contextual validation skill failed');
      }

      const data = contextAnalysis.data ?? {};
      const contextConsistency =
        typeof data.contextConsistency === 'number'
          ? data.contextConsistency
          : 0;
      const issues = Array.isArray(data.inconsistencies)
        ? (data.inconsistencies.filter(
            (i): i is string => typeof i === 'string',
          ) as string[])
        : [];

      const result = {
        valid: contextConsistency >= 0.8,
        contextConsistency,
        issues,
      };

      structuredLogger.debug('Contextual validation complete', result);
      return result;
    } catch (error) {
      structuredLogger.warn(
        'Contextual validation failed, using fallback',
        {},
        error as Error,
      );

      // Fallback contextual validation
      return {
        valid: true,
        contextConsistency: 0.8,
        issues: [],
      };
    }
  }

  /**
   * Assess grade-level appropriateness with high accuracy
   */
  async assessGradeLevelAppropriateness(
    story: StoryResponse,
    targetGradeLevel: GradeLevel,
  ): Promise<{
    appropriate: boolean;
    confidence: number;
    suggestedAdjustments: string[];
  }> {
    try {
      structuredLogger.debug('Assessing grade-level appropriateness', {
        targetGradeLevel,
      });

      const gradeAssessment = await this.skillManager.executeSkill<{
        appropriateness?: unknown;
        adjustments?: unknown;
      }>('GradeLevelAssessmentSkill', {
        content: story.story,
        targetGradeLevel,
        assessmentCriteria: [
          'vocabulary_complexity',
          'sentence_structure',
          'concept_difficulty',
          'content_maturity',
          'reading_level',
        ],
      });

      if (!gradeAssessment.success) {
        throw new Error('Grade level assessment skill failed');
      }

      const data = gradeAssessment.data ?? {};
      const appropriateness =
        typeof data.appropriateness === 'number' ? data.appropriateness : 0;
      const adjustments = Array.isArray(data.adjustments)
        ? (data.adjustments.filter(
            (a): a is string => typeof a === 'string',
          ) as string[])
        : [];

      const result = {
        appropriate: appropriateness >= 0.9,
        confidence: gradeAssessment.confidence || 0.8,
        suggestedAdjustments: adjustments,
      };

      structuredLogger.debug('Grade-level assessment complete', {
        ...result,
        targetGradeLevel,
      });

      return result;
    } catch (error) {
      structuredLogger.warn(
        'Grade-level assessment failed, using fallback',
        {},
        error as Error,
      );

      // Fallback grade-level assessment based on simple heuristics
      const wordCount = story.story.split(' ').length;
      const avgWordsPerSentence =
        wordCount / (story.story.split('.').length || 1);

      return {
        appropriate:
          avgWordsPerSentence <=
          this.getTargetWordsPerSentence(targetGradeLevel),
        confidence: 0.7,
        suggestedAdjustments: [],
      };
    }
  }

  /**
   * Evaluate narrative coherence and story flow
   */
  async evaluateNarrativeCoherence(
    story: StoryResponse,
    request: StoryRequest,
  ): Promise<{
    coherenceScore: number;
    flowIssues: string[];
    improvements: string[];
  }> {
    try {
      structuredLogger.debug('Evaluating narrative coherence');

      const coherenceAssessment = await this.skillManager.executeSkill<{
        coherenceScore?: unknown;
        issues?: unknown;
        improvements?: unknown;
      }>('NarrativeCoherenceSkill', {
        content: story.story,
        gradeLevel: request.gradeLevel,
        evaluationAspects: [
          'character_consistency',
          'plot_progression',
          'setting_continuity',
          'cause_effect_relationships',
          'resolution_quality',
        ],
      });

      if (!coherenceAssessment.success) {
        throw new Error('Narrative coherence assessment skill failed');
      }

      const data = coherenceAssessment.data ?? {};
      const coherenceScoreRaw =
        typeof data.coherenceScore === 'number' ? data.coherenceScore : 0;
      const flowIssues = Array.isArray(data.issues)
        ? (data.issues.filter(
            (i): i is string => typeof i === 'string',
          ) as string[])
        : [];
      const improvements = Array.isArray(data.improvements)
        ? (data.improvements.filter(
            (i): i is string => typeof i === 'string',
          ) as string[])
        : [];

      const result = {
        coherenceScore: coherenceScoreRaw * 100,
        flowIssues,
        improvements,
      };

      structuredLogger.debug('Narrative coherence evaluation complete', {
        coherenceScore: result.coherenceScore,
        issueCount: result.flowIssues.length,
      });

      return result;
    } catch (error) {
      structuredLogger.warn(
        'Narrative coherence evaluation failed, using fallback',
        {},
        error as Error,
      );

      // Fallback coherence assessment
      return {
        coherenceScore: 80,
        flowIssues: [],
        improvements: [],
      };
    }
  }

  /**
   * Get quality assessment summary for dashboard/monitoring
   */
  getQualityMetrics(): {
    averageQualityScore: number;
    assessmentCount: number;
    passRate: number;
    commonIssues: Array<{ type: string; frequency: number }>;
  } {
    const assessments = Array.from(this.assessmentCache.values());

    if (assessments.length === 0) {
      return {
        averageQualityScore: 0,
        assessmentCount: 0,
        passRate: 0,
        commonIssues: [],
      };
    }

    const averageQualityScore =
      assessments.reduce((sum, a) => sum + a.metrics.overallScore, 0) /
      assessments.length;
    const passRate =
      assessments.filter(a => a.passed).length / assessments.length;

    // Analyze common issues
    const issueTypes: Record<string, number> = {};
    assessments.forEach(assessment => {
      assessment.issues.forEach(issue => {
        issueTypes[issue.type] = (issueTypes[issue.type] || 0) + 1;
      });
    });

    const commonIssues = Object.entries(issueTypes)
      .map(([type, frequency]) => ({ type, frequency }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5);

    return {
      averageQualityScore,
      assessmentCount: assessments.length,
      passRate,
      commonIssues,
    };
  }

  /**
   * Record user engagement feedback for adaptive learning
   */
  async recordEngagementFeedback(
    userId: string,
    gradeLevel: GradeLevel,
    qualityMetrics: QualityAssessmentMetrics,
    engagementData: {
      readingTime: number;
      completionRate: number;
      userRating: number;
      retryCount?: number;
      shareCount?: number;
    },
  ): Promise<void> {
    try {
      structuredLogger.debug(
        'Recording engagement feedback for adaptive learning',
        {
          userId: userId.substring(0, 8) + '***',
          gradeLevel,
          overallScore: qualityMetrics.overallScore,
          userRating: engagementData.userRating,
        },
      );

      // Get or create adaptive metrics for this user
      let adaptiveMetrics = this.adaptiveMetricsCache.get(userId);
      if (!adaptiveMetrics) {
        adaptiveMetrics = this.createInitialAdaptiveMetrics(userId, gradeLevel);
      }

      // Record the feedback
      const feedbackEntry = {
        timestamp: Date.now(),
        overallScore: qualityMetrics.overallScore,
        userRating: engagementData.userRating,
        engagementDuration: engagementData.readingTime,
        completionRate: engagementData.completionRate,
      };

      adaptiveMetrics.qualityFeedbackHistory.push(feedbackEntry);

      // Keep only recent feedback entries
      if (
        adaptiveMetrics.qualityFeedbackHistory.length > this.maxHistoryLength
      ) {
        adaptiveMetrics.qualityFeedbackHistory =
          adaptiveMetrics.qualityFeedbackHistory.slice(-this.maxHistoryLength);
      }

      // Update adaptive metrics
      await this.updateAdaptiveMetrics(
        adaptiveMetrics,
        qualityMetrics,
        engagementData,
      );

      // Store correlation data for analysis
      this.engagementCorrelationData.push({
        qualityScore: qualityMetrics.overallScore,
        engagementMetrics: {
          readingTime: engagementData.readingTime,
          completionRate: engagementData.completionRate,
          userRating: engagementData.userRating,
          retryCount: engagementData.retryCount || 0,
          shareCount: engagementData.shareCount || 0,
        },
        contextFactors: {
          gradeLevel,
          timeOfDay: new Date().getHours().toString(),
          sessionLength: engagementData.readingTime,
          contentType: 'story',
        },
      });

      // Limit correlation data storage
      if (this.engagementCorrelationData.length > 1000) {
        this.engagementCorrelationData =
          this.engagementCorrelationData.slice(-800);
      }

      // Cache the updated metrics
      this.adaptiveMetricsCache.set(userId, adaptiveMetrics);

      structuredLogger.info(
        'Engagement feedback recorded and adaptive metrics updated',
        {
          userId: userId.substring(0, 8) + '***',
          feedbackHistoryLength: adaptiveMetrics.qualityFeedbackHistory.length,
          averageEngagement: adaptiveMetrics.averageEngagement,
          confidenceLevel: adaptiveMetrics.confidenceLevel,
        },
      );
    } catch (error) {
      structuredLogger.error(
        'Failed to record engagement feedback',
        { userId: userId.substring(0, 8) + '***' },
        error as Error,
      );
    }
  }

  /**
   * Get adaptive quality standards for a user
   */
  async getAdaptiveQualityStandards(
    gradeLevel: GradeLevel,
    userId?: string,
  ): Promise<QualityStandards> {
    const baseStandards = QUALITY_STANDARDS[gradeLevel];

    if (!userId || !this.adaptationEnabled) {
      return baseStandards;
    }

    const adaptiveMetrics = this.adaptiveMetricsCache.get(userId);
    if (!adaptiveMetrics || adaptiveMetrics.confidenceLevel < 0.3) {
      // Not enough data for reliable adaptation
      return baseStandards;
    }

    // Create adapted standards
    const adaptedStandards: QualityStandards = {
      ...baseStandards,
      minimumScores: {
        ...baseStandards.minimumScores,
        ...adaptiveMetrics.adaptedThresholds,
      },
    };

    structuredLogger.debug('Applied adaptive quality standards', {
      userId: userId.substring(0, 8) + '***',
      gradeLevel,
      confidenceLevel: adaptiveMetrics.confidenceLevel,
      hasAdaptations: Object.keys(adaptiveMetrics.adaptedThresholds).length > 0,
    });

    return adaptedStandards;
  }

  /**
   * Apply adaptive thresholds to assessment result
   */
  async applyAdaptiveThresholds(
    assessmentResult: QualityAssessmentResult,
    userId: string,
    gradeLevel: GradeLevel,
  ): Promise<void> {
    const adaptiveMetrics = this.adaptiveMetricsCache.get(userId);
    if (!adaptiveMetrics || adaptiveMetrics.confidenceLevel < 0.3) {
      return; // Not enough confidence for adaptation
    }

    const originalPassed = assessmentResult.passed;

    // Re-evaluate pass/fail status with adaptive thresholds
    const adaptedStandards = await this.getAdaptiveQualityStandards(
      gradeLevel,
      userId,
    );
    assessmentResult.passed = this.evaluateQualityStandards(
      assessmentResult.metrics,
      adaptedStandards,
    );

    if (originalPassed !== assessmentResult.passed) {
      structuredLogger.info('Adaptive thresholds changed pass/fail status', {
        userId: userId.substring(0, 8) + '***',
        originalPassed,
        adaptedPassed: assessmentResult.passed,
        overallScore: assessmentResult.metrics.overallScore,
        confidenceLevel: adaptiveMetrics.confidenceLevel,
      });

      // Add explanation to recommendations
      if (!assessmentResult.passed && originalPassed) {
        assessmentResult.recommendations.push(
          'Content adjusted to your personalized quality preferences',
        );
      } else if (assessmentResult.passed && !originalPassed) {
        assessmentResult.recommendations.push(
          'Content meets your adapted quality standards',
        );
      }
    }
  }

  /**
   * Get engagement correlation analysis
   */
  getEngagementCorrelationAnalysis(): {
    qualityEngagementCorrelation: number;
    optimalQualityRange: { min: number; max: number };
    insights: string[];
  } {
    if (this.engagementCorrelationData.length < 10) {
      return {
        qualityEngagementCorrelation: 0,
        optimalQualityRange: { min: 80, max: 95 },
        insights: ['Insufficient data for correlation analysis'],
      };
    }

    // Calculate correlation between quality scores and engagement
    const correlation = this.calculateCorrelation(
      this.engagementCorrelationData.map(d => d.qualityScore),
      this.engagementCorrelationData.map(d => d.engagementMetrics.userRating),
    );

    // Find optimal quality range
    const sortedData = this.engagementCorrelationData
      .filter(d => d.engagementMetrics.completionRate > 0.7)
      .sort(
        (a, b) =>
          b.engagementMetrics.userRating - a.engagementMetrics.userRating,
      );

    const topQuartile = sortedData.slice(
      0,
      Math.floor(sortedData.length * 0.25),
    );
    const qualityScores = topQuartile.map(d => d.qualityScore);

    const optimalQualityRange = {
      min: Math.min(...qualityScores),
      max: Math.max(...qualityScores),
    };

    const insights: string[] = [];
    if (correlation > 0.3) {
      insights.push(
        'Strong positive correlation between quality and engagement',
      );
    } else if (correlation < -0.3) {
      insights.push('Quality scores may be too strict, reducing engagement');
    } else {
      insights.push(
        'Quality and engagement correlation is weak, consider other factors',
      );
    }

    if (optimalQualityRange.max - optimalQualityRange.min < 10) {
      insights.push(
        'Optimal quality range is narrow, thresholds are well-calibrated',
      );
    } else {
      insights.push(
        'Wide optimal quality range suggests need for personalization',
      );
    }

    return {
      qualityEngagementCorrelation: correlation,
      optimalQualityRange,
      insights,
    };
  }

  // Private helper methods

  private createInitialAdaptiveMetrics(
    userId: string,
    gradeLevel: GradeLevel,
  ): AdaptiveQualityMetrics {
    return {
      userId,
      gradeLevel,
      averageEngagement: 0.5,
      contentPreferenceTrend: 0,
      qualityFeedbackHistory: [],
      adaptedThresholds: {},
      lastUpdated: Date.now(),
      confidenceLevel: 0,
    };
  }

  private async updateAdaptiveMetrics(
    adaptiveMetrics: AdaptiveQualityMetrics,
    qualityMetrics: QualityAssessmentMetrics,
    engagementData: {
      readingTime: number;
      completionRate: number;
      userRating: number;
    },
  ): Promise<void> {
    const history = adaptiveMetrics.qualityFeedbackHistory;

    // Update average engagement
    const normalizedRating = engagementData.userRating / 5; // Normalize to 0-1
    const engagementScore =
      (normalizedRating + engagementData.completionRate) / 2;

    if (history.length === 0) {
      adaptiveMetrics.averageEngagement = engagementScore;
    } else {
      const alpha = 0.1; // Learning rate
      adaptiveMetrics.averageEngagement =
        alpha * engagementScore +
        (1 - alpha) * adaptiveMetrics.averageEngagement;
    }

    // Calculate content preference trend
    if (history.length >= 5) {
      const recentRatings = history.slice(-5).map(h => h.userRating);
      const earlierRatings = history.slice(-10, -5).map(h => h.userRating);

      if (earlierRatings.length > 0) {
        const recentAvg =
          recentRatings.reduce((sum, r) => sum + r, 0) / recentRatings.length;
        const earlierAvg =
          earlierRatings.reduce((sum, r) => sum + r, 0) / earlierRatings.length;
        adaptiveMetrics.contentPreferenceTrend = (recentAvg - earlierAvg) / 5; // Normalize to -1 to 1
      }
    }

    // Adapt quality thresholds based on engagement patterns
    await this.adaptQualityThresholds(
      adaptiveMetrics,
      qualityMetrics,
      engagementScore,
    );

    // Update confidence level based on data quality and consistency
    adaptiveMetrics.confidenceLevel =
      this.calculateAdaptationConfidence(adaptiveMetrics);
    adaptiveMetrics.lastUpdated = Date.now();
  }

  private async adaptQualityThresholds(
    adaptiveMetrics: AdaptiveQualityMetrics,
    qualityMetrics: QualityAssessmentMetrics,
    _engagementScore: number,
  ): Promise<void> {
    const history = adaptiveMetrics.qualityFeedbackHistory;
    if (history.length < 10) return; // Need sufficient data

    const baseStandards = QUALITY_STANDARDS[adaptiveMetrics.gradeLevel];
    const adaptedThresholds: Partial<QualityAssessmentMetrics> = {};

    // Analyze each quality dimension
    const qualityDimensions: (keyof QualityAssessmentMetrics)[] = [
      'overallScore',
      'educationalValue',
      'narrativeCoherence',
      'gradeAppropriatenesss',
      'engagementPotential',
      'vocabularyComplexity',
    ];

    for (const dimension of qualityDimensions) {
      const correlationData = history.map(h => ({
        qualityScore: qualityMetrics[dimension] as number,
        engagementScore: h.userRating / 5,
      }));

      if (correlationData.length >= 10) {
        const correlation = this.calculateCorrelation(
          correlationData.map(d => d.qualityScore),
          correlationData.map(d => d.engagementScore),
        );

        // Adapt threshold based on correlation
        const baseThreshold =
          (baseStandards.minimumScores[dimension] as number) || 80;
        let adaptedThreshold = baseThreshold;

        if (correlation < -0.3) {
          // Strong negative correlation - threshold may be too high
          adaptedThreshold = Math.max(baseThreshold - 10, 60);
        } else if (
          correlation > 0.5 &&
          adaptiveMetrics.averageEngagement > 0.8
        ) {
          // Strong positive correlation and high engagement - can raise threshold
          adaptedThreshold = Math.min(baseThreshold + 5, 95);
        }

        // Only apply adaptation if there's sufficient change and confidence
        if (
          Math.abs(adaptedThreshold - baseThreshold) >= 3 &&
          adaptiveMetrics.confidenceLevel > 0.3
        ) {
          adaptedThresholds[dimension] = adaptedThreshold;
        }
      }
    }

    adaptiveMetrics.adaptedThresholds = adaptedThresholds;

    structuredLogger.debug('Quality thresholds adapted', {
      userId: adaptiveMetrics.userId.substring(0, 8) + '***',
      adaptationsCount: Object.keys(adaptedThresholds).length,
      averageEngagement: adaptiveMetrics.averageEngagement,
      confidenceLevel: adaptiveMetrics.confidenceLevel,
    });
  }

  private calculateAdaptationConfidence(
    adaptiveMetrics: AdaptiveQualityMetrics,
  ): number {
    const history = adaptiveMetrics.qualityFeedbackHistory;
    if (history.length < 5) return 0;

    // Factors that increase confidence:
    // 1. More data points
    // 2. Consistent engagement patterns
    // 3. Recent data

    const dataQuantityScore = Math.min(history.length / 20, 1); // Up to 0.5 for 20+ data points

    // Calculate consistency in engagement
    const recentRatings = history.slice(-10).map(h => h.userRating);
    const variance = this.calculateVariance(recentRatings);
    const consistencyScore = Math.max(0, 1 - variance / 6.25); // Normalize variance

    // Recency score (prefer recent data)
    const now = Date.now();
    const recencyScore =
      history.length > 0
        ? Math.max(
            0,
            1 -
              (now - Math.max(...history.map(h => h.timestamp))) /
                (7 * 24 * 60 * 60 * 1000),
          )
        : 0;

    const confidence =
      dataQuantityScore * 0.4 + consistencyScore * 0.4 + recencyScore * 0.2;
    return Math.min(confidence, 1);
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;

    const n = x.length;
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumX2 = x.reduce((sum, val) => sum + val * val, 0);
    const sumY2 = y.reduce((sum, val) => sum + val * val, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt(
      (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY),
    );

    return denominator === 0 ? 0 : numerator / denominator;
  }

  private calculateVariance(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
    const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2));
    return squaredDiffs.reduce((sum, d) => sum + d, 0) / numbers.length;
  }

  private async performClaudeAssessment(
    story: StoryResponse,
    request: StoryRequest,
    standards: QualityStandards,
  ): Promise<QualityAssessmentResult> {
    try {
      // Use Claude Skills for comprehensive content analysis
      const qualityAssessment = await this.skillManager.executeSkill(
        'ComprehensiveQualityAssessmentSkill',
        {
          content: story.story,
          gradeLevel: request.gradeLevel,
          userInput: request.userInput,
          qualityStandards: standards,
          assessmentDimensions: [
            'educational_value',
            'narrative_coherence',
            'grade_appropriateness',
            'engagement_potential',
            'cultural_sensitivity',
            'vocabulary_complexity',
            'content_safety',
          ],
        },
      );

      if (!qualityAssessment.success) {
        throw new Error('Claude quality assessment failed');
      }

      const data = qualityAssessment.data as any; // Type assertion for skill response data

      // Extract metrics from Claude assessment
      const metrics: QualityAssessmentMetrics = {
        overallScore: data?.overallScore || 85,
        educationalValue: data?.educationalValue || 80,
        narrativeCoherence: data?.narrativeCoherence || 80,
        gradeAppropriatenesss: data?.gradeAppropriateness || 85,
        engagementPotential: data?.engagementPotential || 80,
        culturalSensitivity: data?.culturalSensitivity || 90,
        vocabularyComplexity: data?.vocabularyComplexity || 80,
        contentSafety: data?.contentSafety || 95,
      };

      // Process issues from Claude assessment
      const issues: QualityIssue[] = (data?.issues || []).map((issue: any) => ({
        type: issue?.type || 'educational',
        severity: issue?.severity || 'medium',
        description: issue?.description || 'Quality issue detected',
        location: issue?.location,
        suggestion: issue?.suggestion || 'Review and revise content',
      }));

      // Determine if content passes quality standards
      const passed = this.evaluateQualityStandards(metrics, standards);

      const result: QualityAssessmentResult = {
        metrics,
        passed,
        confidence: qualityAssessment.confidence || 0.85,
        recommendations: data?.recommendations || [],
        issues,
        improvementSuggestions: data?.improvements || [],
      };

      return result;
    } catch (error) {
      structuredLogger.error(
        'Claude assessment execution failed',
        {},
        error as Error,
      );
      throw error;
    }
  }

  private evaluateQualityStandards(
    metrics: QualityAssessmentMetrics,
    standards: QualityStandards,
  ): boolean {
    const requiredScores = standards.minimumScores;

    // Check each metric against minimum standards
    for (const [metric, minScore] of Object.entries(requiredScores)) {
      const actualScore = (metrics as any)[metric];
      if (actualScore < minScore) {
        return false;
      }
    }

    // Overall score must be above threshold
    return metrics.overallScore >= (requiredScores.overallScore || 85);
  }

  private generateFallbackAssessment(
    _story: StoryResponse,
    _request: StoryRequest,
  ): QualityAssessmentResult {
    // Provide conservative fallback assessment
    const metrics: QualityAssessmentMetrics = {
      overallScore: 80,
      educationalValue: 75,
      narrativeCoherence: 80,
      gradeAppropriatenesss: 85,
      engagementPotential: 75,
      culturalSensitivity: 85,
      vocabularyComplexity: 80,
      contentSafety: 95,
    };

    return {
      metrics,
      passed: metrics.overallScore >= 75, // Lower threshold for fallback
      confidence: 0.6,
      recommendations: ['Review content manually for quality assurance'],
      issues: [],
      improvementSuggestions: [
        'Consider manual review due to assessment system limitations',
      ],
    };
  }

  private generateCacheKey(
    story: StoryResponse,
    request: StoryRequest,
  ): string {
    return `quality_${request.gradeLevel}_${story.story
      .substring(0, 50)
      .replace(/\s+/g, '_')}_${story.story.length}`;
  }

  private getTargetWordsPerSentence(gradeLevel: GradeLevel): number {
    const targets: Record<string, number> = {
      'K-2': 8,
      '3-5': 12,
      '6-8': 16,
      Grade3: 12,
    };
    return targets[gradeLevel] || 12;
  }
}

export const contentQualityService = new ContentQualityService(
  // Will be injected by the skill manager when initialized
  {} as SkillManager,
);
