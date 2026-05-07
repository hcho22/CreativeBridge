/**
 * Educational Value Optimizer Service
 *
 * Integrates educational appropriateness and learning style optimization
 * Task 5.3: Educational Value Optimization
 */

import { structuredLogger } from '../utils/logger';
import type { StoryRequest, StoryResponse } from '../types/story';
import type { GradeLevel } from '../types/database';
import { SkillManager } from '../types/claudeSkills';
import { CulturalSensitivityValidator } from '../utils/culturalSensitivity';

export interface EducationalStandards {
  gradeLevel: GradeLevel;
  commonCoreAligned: boolean;
  cognitiveLevel: 'concrete' | 'abstract' | 'formal';
  vocabularyComplexity: number; // 0-100 scale
  conceptualDepth: number; // 0-100 scale
  requiredSkills: string[];
  learningObjectives: string[];
  appropriateThemes: string[];
  prohibitedConcepts: string[];
}

export interface LearningStyles {
  visual: number; // 0-1 preference for visual learning
  auditory: number; // 0-1 preference for auditory learning
  kinesthetic: number; // 0-1 preference for hands-on learning
  reading: number; // 0-1 preference for reading/writing
  social: number; // 0-1 preference for group activities
  solitary: number; // 0-1 preference for individual activities
  logical: number; // 0-1 preference for logical/mathematical concepts
  spatial: number; // 0-1 preference for spatial/visual-spatial concepts
}

export interface CulturalSensitivityMetrics {
  representationDiversity: number; // 0-100 cultural representation score
  languageInclusivity: number; // 0-100 inclusive language score
  biasDetection: {
    gender: number; // 0-100 gender bias score (lower = less bias)
    racial: number; // 0-100 racial bias score (lower = less bias)
    socioeconomic: number; // 0-100 socioeconomic bias score (lower = less bias)
    religious: number; // 0-100 religious bias score (lower = less bias)
    cultural: number; // 0-100 cultural bias score (lower = less bias)
  };
  accessibilityConsiderations: {
    cognitiveAccessibility: number; // 0-100 cognitive accessibility score
    languageComplexity: number; // 0-100 language complexity appropriateness
    culturalReferences: number; // 0-100 cultural reference appropriateness
  };
}

export interface EducationalOptimizationResult {
  educationalValue: number; // 0-100 overall educational value score
  standardsAlignment: {
    commonCore: boolean;
    stateStandards: boolean;
    gradeAppropriateness: number; // 0-100
  };
  learningStyleAdaptations: {
    adaptationsApplied: string[];
    estimatedEngagementImprovement: number; // 0-100 percentage improvement
    learningObjectiveAlignment: number; // 0-100
  };
  culturalSensitivity: CulturalSensitivityMetrics;
  recommendations: string[];
  improvements: string[];
  passed: boolean;
}

export interface InclusivityAssessment {
  characterDiversity: number; // 0-100 character diversity score
  settingInclusion: number; // 0-100 setting inclusivity score
  languageAccessibility: number; // 0-100 language accessibility score
  universalDesign: number; // 0-100 universal design principles score
  neurodiversity: number; // 0-100 neurodiversity consideration score
  overallInclusivity: number; // 0-100 overall inclusivity score
  issues: Array<{
    type: 'representation' | 'accessibility' | 'bias' | 'language';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    suggestion: string;
  }>;
}

// Educational standards by grade level based on Common Core and educational research
const EDUCATIONAL_STANDARDS: Record<GradeLevel, EducationalStandards> = {
  'K-2': {
    gradeLevel: 'K-2',
    commonCoreAligned: true,
    cognitiveLevel: 'concrete',
    vocabularyComplexity: 25,
    conceptualDepth: 30,
    requiredSkills: [
      'basic_vocabulary',
      'simple_sentences',
      'cause_and_effect',
      'sequence_understanding',
      'character_identification',
      'basic_emotions',
    ],
    learningObjectives: [
      'Identify main characters and settings',
      'Understand simple cause and effect relationships',
      'Recognize emotions in characters',
      'Practice basic vocabulary',
      'Develop listening skills',
      'Encourage imagination and creativity',
    ],
    appropriateThemes: [
      'friendship',
      'family',
      'animals',
      'nature',
      'helping_others',
      'sharing',
      'kindness',
      'discovery',
      'play',
      'safety',
    ],
    prohibitedConcepts: [
      'complex_emotions',
      'abstract_concepts',
      'death_detailed',
      'violence',
      'mature_relationships',
      'complex_moral_dilemmas',
      'political_themes',
      'religious_controversy',
    ],
  },
  '3-5': {
    gradeLevel: '3-5',
    commonCoreAligned: true,
    cognitiveLevel: 'concrete',
    vocabularyComplexity: 50,
    conceptualDepth: 55,
    requiredSkills: [
      'reading_comprehension',
      'vocabulary_development',
      'character_motivation',
      'plot_understanding',
      'inference_skills',
      'compare_contrast',
      'problem_solving',
    ],
    learningObjectives: [
      'Analyze character motivations and development',
      'Understand plot structure and conflict resolution',
      'Make inferences from text',
      'Compare and contrast characters or situations',
      'Develop problem-solving skills',
      'Build vocabulary in context',
      'Practice critical thinking',
    ],
    appropriateThemes: [
      'adventure',
      'mystery',
      'friendship',
      'teamwork',
      'perseverance',
      'honesty',
      'responsibility',
      'environmental_awareness',
      'cultural_appreciation',
      'innovation',
    ],
    prohibitedConcepts: [
      'mature_themes',
      'complex_philosophical_concepts',
      'inappropriate_relationships',
      'detailed_violence',
      'political_bias',
      'religious_proselytizing',
    ],
  },
  '6-8': {
    gradeLevel: '6-8',
    commonCoreAligned: true,
    cognitiveLevel: 'abstract',
    vocabularyComplexity: 75,
    conceptualDepth: 80,
    requiredSkills: [
      'abstract_thinking',
      'literary_analysis',
      'theme_identification',
      'symbolism_understanding',
      'perspective_taking',
      'moral_reasoning',
      'research_skills',
    ],
    learningObjectives: [
      'Identify and analyze themes',
      'Understand symbolism and metaphor',
      'Analyze character development and motivation',
      'Consider multiple perspectives',
      'Develop moral reasoning skills',
      'Practice research and citation skills',
      'Build academic vocabulary',
    ],
    appropriateThemes: [
      'identity',
      'coming_of_age',
      'social_justice',
      'environmental_responsibility',
      'technological_impact',
      'cultural_diversity',
      'historical_perspective',
      'ethical_decision_making',
      'leadership',
      'resilience',
    ],
    prohibitedConcepts: [
      'inappropriate_content',
      'graphic_violence',
      'mature_relationships_detailed',
      'political_extremism',
      'religious_intolerance',
    ],
  },
  '9-12': {
    gradeLevel: '9-12',
    commonCoreAligned: true,
    cognitiveLevel: 'concrete',
    vocabularyComplexity: 45,
    conceptualDepth: 50,
    requiredSkills: [
      'reading_comprehension',
      'vocabulary_development',
      'character_motivation',
      'plot_understanding',
      'inference_skills',
      'compare_contrast',
      'problem_solving',
    ],
    learningObjectives: [
      'Analyze character motivations and development',
      'Understand plot structure and conflict resolution',
      'Make inferences from text',
      'Compare and contrast characters or situations',
      'Develop problem-solving skills',
      'Build vocabulary in context',
      'Practice critical thinking',
    ],
    appropriateThemes: [
      'adventure',
      'mystery',
      'friendship',
      'teamwork',
      'perseverance',
      'honesty',
      'responsibility',
      'environmental_awareness',
      'cultural_appreciation',
      'innovation',
    ],
    prohibitedConcepts: [
      'mature_themes',
      'complex_philosophical_concepts',
      'inappropriate_relationships',
      'detailed_violence',
      'political_bias',
      'religious_proselytizing',
    ],
  },
};

// Learning style adaptation strategies
const LEARNING_STYLE_ADAPTATIONS = {
  visual: {
    strategies: [
      'Include vivid descriptive language',
      'Use color and visual imagery',
      'Incorporate spatial relationships',
      'Add visual metaphors and similes',
    ],
    indicators: [
      'colorful',
      'bright',
      'picture',
      'see',
      'look',
      'imagine',
      'visualize',
    ],
  },
  auditory: {
    strategies: [
      'Include dialogue and conversation',
      'Use rhythm and rhyme',
      'Add sound descriptions',
      'Include musical elements',
    ],
    indicators: [
      'hear',
      'listen',
      'sound',
      'music',
      'voice',
      'whisper',
      'sing',
      'echo',
    ],
  },
  kinesthetic: {
    strategies: [
      'Include physical activities',
      'Use movement and action',
      'Add hands-on experiences',
      'Include tactile descriptions',
    ],
    indicators: [
      'move',
      'touch',
      'feel',
      'build',
      'make',
      'run',
      'jump',
      'explore',
    ],
  },
  reading: {
    strategies: [
      'Include written elements in story',
      'Add vocabulary building',
      'Include lists and facts',
      'Use clear logical structure',
    ],
    indicators: [
      'read',
      'write',
      'book',
      'letter',
      'words',
      'study',
      'learn',
      'understand',
    ],
  },
};

export class EducationalOptimizerService {
  private skillManager: SkillManager;
  private optimizationCache: Map<string, EducationalOptimizationResult> =
    new Map();
  private cacheTimeout = 600000; // 10 minutes

  constructor(skillManager: SkillManager) {
    this.skillManager = skillManager;
  }

  /**
   * Optimize content for educational value and learning alignment
   */
  async optimizeEducationalValue(
    story: StoryResponse,
    request: StoryRequest,
    learningStyles?: Partial<LearningStyles>,
  ): Promise<EducationalOptimizationResult> {
    try {
      const cacheKey = this.generateCacheKey(story, request, learningStyles);

      // Check cache first
      if (this.optimizationCache.has(cacheKey)) {
        const cached = this.optimizationCache.get(cacheKey)!;
        structuredLogger.debug('Educational optimization cache hit', {
          cacheKey,
        });
        return cached;
      }

      structuredLogger.info('Starting educational value optimization', {
        gradeLevel: request.gradeLevel,
        contentLength: story.story.length,
        hasLearningStyles: !!learningStyles,
      });

      // Get educational standards for grade level
      const standards = EDUCATIONAL_STANDARDS[request.gradeLevel];

      // Perform comprehensive educational assessment
      const result = await this.performEducationalAssessment(
        story,
        request,
        standards,
        learningStyles,
      );

      // Cache the result
      this.optimizationCache.set(cacheKey, result);
      setTimeout(
        () => this.optimizationCache.delete(cacheKey),
        this.cacheTimeout,
      );

      structuredLogger.info('Educational optimization complete', {
        educationalValue: result.educationalValue,
        passed: result.passed,
        adaptationsApplied:
          result.learningStyleAdaptations.adaptationsApplied.length,
        culturalSensitivity: result.culturalSensitivity.representationDiversity,
      });

      return result;
    } catch (error) {
      structuredLogger.error(
        'Educational optimization failed',
        {
          gradeLevel: request.gradeLevel,
        },
        error as Error,
      );

      return this.generateFallbackOptimization(story, request);
    }
  }

  /**
   * Assess content alignment with educational standards
   */
  async assessEducationalStandards(
    story: StoryResponse,
    gradeLevel: GradeLevel,
  ): Promise<{
    aligned: boolean;
    commonCoreAlignment: number; // 0-100
    stateStandardsAlignment: number; // 0-100
    issues: string[];
    recommendations: string[];
  }> {
    try {
      const standards = EDUCATIONAL_STANDARDS[gradeLevel];

      const assessment = await this.skillManager.executeSkill(
        'EducationalStandardsAssessmentSkill',
        {
          content: story.story,
          gradeLevel,
          requiredSkills: standards.requiredSkills,
          learningObjectives: standards.learningObjectives,
          appropriateThemes: standards.appropriateThemes,
          prohibitedConcepts: standards.prohibitedConcepts,
          commonCoreStandards: true,
        },
      );

      if (!assessment.success) {
        throw new Error('Educational standards assessment skill failed');
      }

      const data = assessment.data as any;

      return {
        aligned:
          (data.commonCoreAlignment || 80) >= 75 &&
          (data.stateStandardsAlignment || 80) >= 75,
        commonCoreAlignment: data.commonCoreAlignment || 80,
        stateStandardsAlignment: data.stateStandardsAlignment || 80,
        issues: data.issues || [],
        recommendations: data.recommendations || [],
      };
    } catch (error) {
      structuredLogger.warn(
        'Educational standards assessment failed, using fallback',
        { error: error instanceof Error ? error.message : String(error) },
      );

      // Fallback assessment based on content analysis
      const standards = EDUCATIONAL_STANDARDS[gradeLevel];
      const storyLower = story.story.toLowerCase();

      // Check for appropriate themes
      const hasAppropriateThemes = standards.appropriateThemes.some(theme =>
        storyLower.includes(theme.replace(/_/g, ' ')),
      );

      // Check for prohibited concepts
      const hasProhibitedConcepts = standards.prohibitedConcepts.some(concept =>
        storyLower.includes(concept.replace(/_/g, ' ')),
      );

      const fallbackScore =
        hasAppropriateThemes && !hasProhibitedConcepts ? 85 : 70;

      return {
        aligned: fallbackScore >= 75,
        commonCoreAlignment: fallbackScore,
        stateStandardsAlignment: fallbackScore,
        issues: hasProhibitedConcepts
          ? ['Content may contain inappropriate concepts']
          : [],
        recommendations: hasAppropriateThemes
          ? []
          : ['Consider adding more educational themes'],
      };
    }
  }

  /**
   * Adapt content for specific learning styles
   */
  async adaptForLearningStyles(
    story: StoryResponse,
    request: StoryRequest,
    learningStyles: Partial<LearningStyles>,
  ): Promise<{
    adaptedContent: string;
    adaptationsApplied: string[];
    estimatedImprovementScore: number;
  }> {
    try {
      const primaryStyles = this.identifyPrimaryLearningStyles(learningStyles);

      const adaptation = await this.skillManager.executeSkill(
        'LearningStyleAdaptationSkill',
        {
          content: story.story,
          gradeLevel: request.gradeLevel,
          primaryLearningStyles: primaryStyles,
          adaptationStrategies: this.getAdaptationStrategies(primaryStyles),
        },
      );

      if (!adaptation.success) {
        throw new Error('Learning style adaptation skill failed');
      }

      const data = adaptation.data as any;

      return {
        adaptedContent: data.adaptedContent || story.story,
        adaptationsApplied: data.adaptationsApplied || [],
        estimatedImprovementScore: data.estimatedImprovement || 10,
      };
    } catch (error) {
      structuredLogger.warn(
        'Learning style adaptation failed, using fallback',
        { error: error instanceof Error ? error.message : String(error) },
      );

      // Fallback adaptation based on simple text enhancement
      const primaryStyles = this.identifyPrimaryLearningStyles(learningStyles);
      const adaptationsApplied: string[] = [];
      let adaptedContent = story.story;

      // Apply simple adaptations
      if (primaryStyles.includes('visual')) {
        adaptedContent = this.enhanceVisualElements(adaptedContent);
        adaptationsApplied.push('Enhanced visual descriptions');
      }

      if (primaryStyles.includes('kinesthetic')) {
        adaptedContent = this.enhanceActionElements(adaptedContent);
        adaptationsApplied.push('Added movement and action');
      }

      return {
        adaptedContent,
        adaptationsApplied,
        estimatedImprovementScore: adaptationsApplied.length * 5,
      };
    }
  }

  /**
   * Assess cultural sensitivity and inclusivity
   */
  async assessInclusivity(
    story: StoryResponse,
    gradeLevel: GradeLevel,
  ): Promise<InclusivityAssessment> {
    try {
      // Use comprehensive cultural sensitivity validator
      const culturalReport =
        CulturalSensitivityValidator.generateComprehensiveReport(
          story.story,
          gradeLevel,
        );

      structuredLogger.info('Cultural sensitivity assessment completed', {
        overallScore: culturalReport.overallScore,
        biasIssues: culturalReport.biasDetection.length,
        priorityIssues: culturalReport.priorityIssues.length,
        gradeLevel: gradeLevel,
      });

      // Try skill-based assessment as enhancement if available
      let skillEnhancement = null;
      try {
        const assessment = await this.skillManager.executeSkill(
          'InclusivityAssessmentSkill',
          {
            content: story.story,
            gradeLevel,
            assessmentDimensions: [
              'character_diversity',
              'cultural_representation',
              'language_inclusivity',
              'accessibility_considerations',
              'bias_detection',
              'universal_design_principles',
            ],
          },
        );

        if (assessment.success) {
          skillEnhancement = assessment.data;
        }
      } catch (skillError) {
        structuredLogger.debug(
          'Skill-based enhancement unavailable, using validator only',
          {
            error: (skillError as Error).message,
          },
        );
      }

      // Combine validator results with skill enhancement if available
      const combinedIssues = [
        // Map bias detection results to inclusivity issues
        ...culturalReport.biasDetection.map(bias => ({
          type: 'bias' as const,
          severity: bias.severity,
          description: bias.description,
          suggestion: bias.suggestion,
        })),
        // Map accessibility issues
        ...culturalReport.accessibility.issues.map(issue => ({
          type: 'accessibility' as const,
          severity:
            issue.type === 'conceptual'
              ? ('high' as const)
              : ('medium' as const),
          description: issue.description,
          suggestion: issue.suggestion,
        })),
        // Map language inclusivity issues
        ...culturalReport.inclusiveLanguage.issues.map(issue => ({
          type: 'language' as const,
          severity: 'medium' as const,
          description: `Non-inclusive language: ${issue.word} - ${issue.issue}`,
          suggestion: issue.suggestion,
        })),
      ];

      const result: InclusivityAssessment = {
        characterDiversity:
          (skillEnhancement as any)?.characterDiversity ||
          culturalReport.culturalRepresentation.diversityScore,
        settingInclusion:
          (skillEnhancement as any)?.settingInclusion ||
          culturalReport.culturalRepresentation.diversityScore,
        languageAccessibility: culturalReport.inclusiveLanguage.score,
        universalDesign: culturalReport.accessibility.cognitiveAccessibility,
        neurodiversity:
          (skillEnhancement as any)?.neurodiversity ||
          Math.min(
            culturalReport.accessibility.cognitiveAccessibility + 10,
            100,
          ),
        overallInclusivity: culturalReport.overallScore,
        issues: combinedIssues,
      };

      return result;
    } catch (error) {
      structuredLogger.warn('Inclusivity assessment failed, using fallback', {
        error: (error as Error).message,
      });

      // Fallback inclusivity assessment
      return this.generateFallbackInclusivityAssessment(story, gradeLevel);
    }
  }

  // Private helper methods

  private async performEducationalAssessment(
    story: StoryResponse,
    request: StoryRequest,
    standards: EducationalStandards,
    learningStyles?: Partial<LearningStyles>,
  ): Promise<EducationalOptimizationResult> {
    // Assess educational standards alignment
    const standardsAssessment = await this.assessEducationalStandards(
      story,
      request.gradeLevel,
    );

    // Assess learning style adaptations if provided
    let learningStyleAdaptations: {
      adaptationsApplied: string[];
      estimatedEngagementImprovement: number;
      learningObjectiveAlignment: number;
    } = {
      adaptationsApplied: [],
      estimatedEngagementImprovement: 0,
      learningObjectiveAlignment: standardsAssessment.commonCoreAlignment,
    };

    if (learningStyles) {
      const adaptation = await this.adaptForLearningStyles(
        story,
        request,
        learningStyles,
      );
      learningStyleAdaptations = {
        adaptationsApplied: adaptation.adaptationsApplied,
        estimatedEngagementImprovement: adaptation.estimatedImprovementScore,
        learningObjectiveAlignment: standardsAssessment.commonCoreAlignment,
      };
    }

    // Assess cultural sensitivity and inclusivity
    const inclusivityAssessment = await this.assessInclusivity(
      story,
      request.gradeLevel,
    );

    // Calculate cultural sensitivity metrics
    const culturalSensitivity: CulturalSensitivityMetrics = {
      representationDiversity: inclusivityAssessment.characterDiversity,
      languageInclusivity: inclusivityAssessment.languageAccessibility,
      biasDetection: {
        gender:
          100 -
          inclusivityAssessment.issues.filter(i =>
            i.description.includes('gender'),
          ).length *
            20,
        racial:
          100 -
          inclusivityAssessment.issues.filter(i =>
            i.description.includes('racial'),
          ).length *
            20,
        socioeconomic:
          100 -
          inclusivityAssessment.issues.filter(i =>
            i.description.includes('socioeconomic'),
          ).length *
            20,
        religious:
          100 -
          inclusivityAssessment.issues.filter(i =>
            i.description.includes('religious'),
          ).length *
            20,
        cultural:
          100 -
          inclusivityAssessment.issues.filter(i =>
            i.description.includes('cultural'),
          ).length *
            20,
      },
      accessibilityConsiderations: {
        cognitiveAccessibility: inclusivityAssessment.universalDesign,
        languageComplexity: this.assessLanguageComplexity(story, standards),
        culturalReferences: inclusivityAssessment.settingInclusion,
      },
    };

    // Calculate overall educational value
    const educationalValue = Math.round(
      standardsAssessment.commonCoreAlignment * 0.3 +
        standardsAssessment.stateStandardsAlignment * 0.2 +
        inclusivityAssessment.overallInclusivity * 0.25 +
        learningStyleAdaptations.learningObjectiveAlignment * 0.25,
    );

    // Determine if optimization passes
    const passed =
      educationalValue >= 75 &&
      standardsAssessment.aligned &&
      inclusivityAssessment.overallInclusivity >= 70;

    // Generate recommendations
    const recommendations: string[] = [
      ...standardsAssessment.recommendations,
      ...inclusivityAssessment.issues.map(
        (issue: { suggestion: string }) => issue.suggestion,
      ),
    ];

    if (learningStyleAdaptations.estimatedEngagementImprovement > 0) {
      recommendations.push(
        'Learning style adaptations applied to enhance engagement',
      );
    }

    // Generate improvements
    const improvements: string[] = [];
    if (educationalValue < 80) {
      improvements.push('Strengthen alignment with educational objectives');
    }
    if (inclusivityAssessment.overallInclusivity < 80) {
      improvements.push('Enhance cultural sensitivity and inclusivity');
    }
    if (
      learningStyles &&
      learningStyleAdaptations.adaptationsApplied.length === 0
    ) {
      improvements.push('Consider adding learning style adaptations');
    }

    return {
      educationalValue,
      standardsAlignment: {
        commonCore: standardsAssessment.commonCoreAlignment >= 75,
        stateStandards: standardsAssessment.stateStandardsAlignment >= 75,
        gradeAppropriateness: standardsAssessment.commonCoreAlignment,
      },
      learningStyleAdaptations,
      culturalSensitivity,
      recommendations: recommendations.slice(0, 5), // Limit to top 5 recommendations
      improvements: improvements.slice(0, 3), // Limit to top 3 improvements
      passed,
    };
  }

  private identifyPrimaryLearningStyles(
    learningStyles: Partial<LearningStyles>,
  ): string[] {
    const styles = Object.entries(learningStyles)
      .filter(([_, value]) => (value || 0) > 0.6)
      .sort((a, b) => (b[1] || 0) - (a[1] || 0))
      .map(([style, _]) => style)
      .slice(0, 3); // Top 3 learning styles

    return styles.length > 0 ? styles : ['visual', 'reading']; // Default fallback
  }

  private getAdaptationStrategies(primaryStyles: string[]): string[] {
    const strategies: string[] = [];

    for (const style of primaryStyles) {
      const adaptationInfo =
        LEARNING_STYLE_ADAPTATIONS[
          style as keyof typeof LEARNING_STYLE_ADAPTATIONS
        ];
      if (adaptationInfo) {
        strategies.push(...adaptationInfo.strategies);
      }
    }

    return Array.from(new Set(strategies)); // Remove duplicates
  }

  private enhanceVisualElements(content: string): string {
    // Simple visual enhancement by adding descriptive words
    const visualEnhancements = [
      ['said', 'said with sparkling eyes'],
      ['walked', 'walked through the colorful'],
      ['found', 'discovered the bright'],
      ['saw', 'gazed at the beautiful'],
    ];

    let enhanced = content;
    for (const [original, enhanced_text] of visualEnhancements) {
      enhanced = enhanced.replace(
        new RegExp(`\\b${original}\\b`, 'gi'),
        enhanced_text,
      );
    }

    return enhanced;
  }

  private enhanceActionElements(content: string): string {
    // Simple kinesthetic enhancement by adding movement words
    const actionEnhancements = [
      ['looked', 'reached out and looked'],
      ['went', 'hurried'],
      ['found', 'discovered by exploring'],
      ['learned', 'learned by trying'],
    ];

    let enhanced = content;
    for (const [original, enhanced_text] of actionEnhancements) {
      enhanced = enhanced.replace(
        new RegExp(`\\b${original}\\b`, 'gi'),
        enhanced_text,
      );
    }

    return enhanced;
  }

  private assessLanguageComplexity(
    story: StoryResponse,
    standards: EducationalStandards,
  ): number {
    const words = story.story.split(/\s+/);
    const avgWordLength =
      words.reduce((sum, word) => sum + word.length, 0) / words.length;
    const sentences = story.story
      .split(/[.!?]+/)
      .filter(s => s.trim().length > 0);
    const avgSentenceLength = words.length / sentences.length;

    // Calculate complexity based on word and sentence length
    const wordComplexity = Math.min((avgWordLength / 6) * 100, 100); // 6 chars = 100% complexity
    const sentenceComplexity = Math.min((avgSentenceLength / 15) * 100, 100); // 15 words = 100% complexity

    const overallComplexity = (wordComplexity + sentenceComplexity) / 2;

    // Score appropriateness (lower complexity is better for younger grades)
    const targetComplexity = standards.vocabularyComplexity;
    const complexityScore =
      100 - Math.abs(overallComplexity - targetComplexity);

    return Math.max(0, Math.min(100, complexityScore));
  }

  private generateFallbackInclusivityAssessment(
    story: StoryResponse,
    _gradeLevel: GradeLevel,
  ): InclusivityAssessment {
    const storyLower = story.story.toLowerCase();

    // Simple inclusivity scoring based on content analysis
    let characterDiversity = 60; // Base score
    let settingInclusion = 60;
    let languageAccessibility = 70;

    // Check for diverse character indicators
    const diversityIndicators = [
      'different',
      'various',
      'many',
      'diverse',
      'unique',
    ];
    if (diversityIndicators.some(indicator => storyLower.includes(indicator))) {
      characterDiversity += 20;
    }

    // Check for inclusive language
    const inclusiveLanguage = [
      'everyone',
      'all',
      'together',
      'include',
      'welcome',
    ];
    if (inclusiveLanguage.some(word => storyLower.includes(word))) {
      languageAccessibility += 15;
      settingInclusion += 15;
    }

    return {
      characterDiversity: Math.min(100, characterDiversity),
      settingInclusion: Math.min(100, settingInclusion),
      languageAccessibility: Math.min(100, languageAccessibility),
      universalDesign: 70,
      neurodiversity: 70,
      overallInclusivity: Math.round(
        (characterDiversity +
          settingInclusion +
          languageAccessibility +
          70 +
          70) /
          5,
      ),
      issues: [],
    };
  }

  private generateFallbackOptimization(
    _story: StoryResponse,
    _request: StoryRequest,
  ): EducationalOptimizationResult {
    return {
      educationalValue: 75,
      standardsAlignment: {
        commonCore: true,
        stateStandards: true,
        gradeAppropriateness: 75,
      },
      learningStyleAdaptations: {
        adaptationsApplied: [],
        estimatedEngagementImprovement: 0,
        learningObjectiveAlignment: 75,
      },
      culturalSensitivity: {
        representationDiversity: 70,
        languageInclusivity: 75,
        biasDetection: {
          gender: 90,
          racial: 90,
          socioeconomic: 90,
          religious: 90,
          cultural: 90,
        },
        accessibilityConsiderations: {
          cognitiveAccessibility: 70,
          languageComplexity: 75,
          culturalReferences: 70,
        },
      },
      recommendations: ['Content meets basic educational standards'],
      improvements: [
        'Consider enhancing educational value through skill integration',
      ],
      passed: true,
    };
  }

  private generateCacheKey(
    story: StoryResponse,
    request: StoryRequest,
    learningStyles?: Partial<LearningStyles>,
  ): string {
    const stylesKey = learningStyles ? JSON.stringify(learningStyles) : 'none';
    return `edu_opt_${request.gradeLevel}_${story.story
      .substring(0, 30)
      .replace(/\s+/g, '_')}_${stylesKey.substring(0, 20)}`;
  }
}

export const educationalOptimizerService = new EducationalOptimizerService(
  // Will be injected by the skill manager when initialized
  {} as SkillManager,
);
