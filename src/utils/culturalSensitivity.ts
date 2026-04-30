/**
 * Cultural Sensitivity and Inclusivity Utilities
 *
 * Tools for detecting bias, ensuring cultural sensitivity, and promoting inclusivity
 * Task 5.3: Educational Value Optimization - Cultural Sensitivity Validation
 */

import { structuredLogger } from './logger';
import { GradeLevel } from '../types/story';

export interface BiasDetectionResult {
  type:
    | 'gender'
    | 'racial'
    | 'socioeconomic'
    | 'religious'
    | 'cultural'
    | 'ability'
    | 'age';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  location: string; // Where in the text the bias was found
  suggestion: string; // How to fix the bias
  confidence: number; // 0-1 confidence in the detection
}

export interface CulturalRepresentationAnalysis {
  diversityScore: number; // 0-100
  representedGroups: string[];
  missingRepresentation: string[];
  stereotypes: Array<{
    group: string;
    stereotype: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  positiveRepresentation: string[];
}

export interface InclusiveLanguageAssessment {
  score: number; // 0-100
  issues: Array<{
    word: string;
    issue: string;
    suggestion: string;
    context: string;
  }>;
  improvements: string[];
}

export interface AccessibilityCheck {
  cognitiveAccessibility: number; // 0-100
  languageComplexity: number; // 0-100 (appropriate for grade level)
  conceptualDifficulty: number; // 0-100 (appropriate for grade level)
  issues: Array<{
    type: 'cognitive' | 'language' | 'conceptual';
    description: string;
    suggestion: string;
  }>;
}

// Bias detection patterns and keywords
const BIAS_PATTERNS = {
  gender: {
    stereotypical: [
      {
        pattern:
          /girls? (are|like|prefer|should|must|always|never) (pink|dolls?|cooking|cleaning|quiet|gentle)/gi,
        severity: 'medium' as const,
      },
      {
        pattern:
          /boys? (are|like|prefer|should|must|always|never) (blue|trucks?|sports?|strong|tough|loud)/gi,
        severity: 'medium' as const,
      },
      {
        pattern:
          /(women|ladies|girls) (can't|cannot|shouldn't|are not good at) (math|science|sports?|driving)/gi,
        severity: 'high' as const,
      },
      {
        pattern:
          /(men|boys|guys) (don't|cannot|shouldn't) (cry|show emotion|be gentle|cook|clean)/gi,
        severity: 'high' as const,
      },
    ],
    pronounAssumptions: [
      {
        pattern:
          /(doctor|engineer|scientist|pilot|CEO|president).*(he|him|his)/gi,
        severity: 'medium' as const,
      },
      {
        pattern: /(nurse|teacher|secretary|assistant).*(she|her|hers)/gi,
        severity: 'medium' as const,
      },
    ],
  },
  racial: {
    stereotypical: [
      {
        pattern:
          /all (black|white|asian|hispanic|latino|native american) (people|kids|children) (are|like|do)/gi,
        severity: 'high' as const,
      },
      {
        pattern:
          /(black|african).*(good at|naturally|born to) (sports?|dancing|music)/gi,
        severity: 'medium' as const,
      },
      {
        pattern:
          /(asian).*(good at|naturally|born to) (math|science|technology)/gi,
        severity: 'medium' as const,
      },
    ],
    exclusionary: [
      { pattern: /normal (hair|skin|features)/gi, severity: 'high' as const },
      {
        pattern: /(typical|regular|standard) (american|family|person)/gi,
        severity: 'medium' as const,
      },
    ],
  },
  socioeconomic: {
    stereotypical: [
      {
        pattern:
          /(poor|low-income) (kids|people|families) (are|always|never|can't)/gi,
        severity: 'medium' as const,
      },
      {
        pattern:
          /(rich|wealthy) (kids|people) (are|always|never) (spoiled|mean|selfish)/gi,
        severity: 'medium' as const,
      },
    ],
    exclusionary: [
      {
        pattern: /everyone (has|owns|can afford)/gi,
        severity: 'medium' as const,
      },
      { pattern: /just (buy|get|ask for)/gi, severity: 'low' as const },
    ],
  },
  ability: {
    ableist: [
      {
        pattern: /(crazy|insane|mental|retarded|lame|blind to|deaf to)/gi,
        severity: 'medium' as const,
      },
      {
        pattern: /(wheelchair bound|suffers from|victim of)/gi,
        severity: 'medium' as const,
      },
    ],
    exclusionary: [
      {
        pattern: /everyone can (see|hear|walk|run)/gi,
        severity: 'medium' as const,
      },
      { pattern: /normal (people|kids|children)/gi, severity: 'low' as const },
    ],
  },
  religious: {
    assumptive: [
      {
        pattern: /everyone (believes|celebrates|prays|goes to church)/gi,
        severity: 'medium' as const,
      },
      {
        pattern:
          /(christmas|easter|thanksgiving) (is|means) (everything|the most important)/gi,
        severity: 'low' as const,
      },
    ],
    stereotypical: [
      {
        pattern:
          /all (muslim|jewish|christian|hindu|buddhist) (people|families) (are|do|believe)/gi,
        severity: 'high' as const,
      },
    ],
  },
};

// Positive cultural representation indicators
const POSITIVE_REPRESENTATION_INDICATORS = [
  'diverse',
  'different backgrounds',
  'many cultures',
  'various traditions',
  'unique perspectives',
  'different languages',
  'multicultural',
  'inclusive',
  'different abilities',
  'various family types',
  'different ways of life',
  'cultural celebration',
  'tradition sharing',
  'learning from others',
];

// Inclusive language alternatives
const INCLUSIVE_LANGUAGE_ALTERNATIVES = {
  mankind: 'humanity, people, human beings',
  manpower: 'workforce, staff, personnel',
  fireman: 'firefighter',
  policeman: 'police officer',
  chairman: 'chairperson, chair',
  businessman: 'businessperson, entrepreneur',
  'normal family': 'typical family, most families',
  'real parents': 'birth parents, biological parents',
  exotic: 'unique, distinctive, from another culture',
  primitive: 'traditional, indigenous',
  'third world': 'developing countries',
  ghetto: 'neighborhood, community',
  gyp: 'cheat, shortchange',
  'spirit animal': 'favorite animal, role model',
  tribe: 'group, team, community',
  powwow: 'meeting, discussion',
  'blind spot': 'oversight, gap',
  'tone deaf': 'insensitive, unaware',
  lame: 'weak, ineffective, boring',
  crazy: 'surprising, unexpected, intense',
  insane: 'incredible, amazing, intense',
  mental: 'emotional, psychological',
};

// Grade-appropriate language complexity targets
const LANGUAGE_COMPLEXITY_TARGETS = {
  'K-2': {
    maxSyllablesPerWord: 2,
    maxWordsPerSentence: 10,
    vocabularyLevel: 'basic',
    abstractConcepts: false,
  },
  '3-5': {
    maxSyllablesPerWord: 3,
    maxWordsPerSentence: 15,
    vocabularyLevel: 'intermediate',
    abstractConcepts: true, // limited
  },
  '6-8': {
    maxSyllablesPerWord: 4,
    maxWordsPerSentence: 20,
    vocabularyLevel: 'advanced',
    abstractConcepts: true,
  },
  Grade3: {
    maxSyllablesPerWord: 3,
    maxWordsPerSentence: 12,
    vocabularyLevel: 'intermediate',
    abstractConcepts: true, // limited
  },
};

export class CulturalSensitivityValidator {
  /**
   * Detect potential bias in content
   */
  static detectBias(content: string): BiasDetectionResult[] {
    const results: BiasDetectionResult[] = [];
    const contentLower = content.toLowerCase();

    for (const [biasType, patterns] of Object.entries(BIAS_PATTERNS)) {
      for (const [patternType, patternList] of Object.entries(patterns)) {
        for (const pattern of patternList) {
          const matches = content.match(pattern.pattern);
          if (matches) {
            for (const match of matches) {
              const index = content.toLowerCase().indexOf(match.toLowerCase());
              const context = content.substring(
                Math.max(0, index - 30),
                index + match.length + 30,
              );

              results.push({
                type: biasType as BiasDetectionResult['type'],
                severity: pattern.severity,
                description: `Potential ${biasType} bias detected: "${match}"`,
                location: context,
                suggestion: this.getBiasSuggestion(biasType, match),
                confidence: this.calculateBiasConfidence(match, context),
              });
            }
          }
        }
      }
    }

    return results;
  }

  /**
   * Analyze cultural representation in content
   */
  static analyzeCulturalRepresentation(
    content: string,
  ): CulturalRepresentationAnalysis {
    const contentLower = content.toLowerCase();

    // Check for positive representation indicators
    const positiveCount = POSITIVE_REPRESENTATION_INDICATORS.filter(indicator =>
      contentLower.includes(indicator),
    ).length;

    // Detect represented groups (simplified)
    const representedGroups: string[] = [];
    const culturalIndicators = [
      'different cultures',
      'various backgrounds',
      'multicultural',
      'different languages',
      'traditions',
      'customs',
      'heritage',
    ];

    for (const indicator of culturalIndicators) {
      if (contentLower.includes(indicator)) {
        representedGroups.push(indicator);
      }
    }

    // Detect stereotypes
    const stereotypes: Array<{
      group: string;
      stereotype: string;
      severity: 'low' | 'medium' | 'high';
    }> = [];
    const biasResults = this.detectBias(content);

    for (const bias of biasResults) {
      if (bias.type === 'racial' || bias.type === 'cultural') {
        stereotypes.push({
          group: bias.type,
          stereotype: bias.description,
          severity: bias.severity === 'critical' ? 'high' : bias.severity,
        });
      }
    }

    // Calculate diversity score
    const diversityScore = Math.min(
      100,
      positiveCount * 15 + representedGroups.length * 10 + 50,
    );

    return {
      diversityScore,
      representedGroups,
      missingRepresentation: this.identifyMissingRepresentation(content),
      stereotypes,
      positiveRepresentation: representedGroups,
    };
  }

  /**
   * Assess inclusive language usage
   */
  static assessInclusiveLanguage(content: string): InclusiveLanguageAssessment {
    const issues: Array<{
      word: string;
      issue: string;
      suggestion: string;
      context: string;
    }> = [];
    let score = 100; // Start with perfect score and deduct

    for (const [problematicTerm, alternatives] of Object.entries(
      INCLUSIVE_LANGUAGE_ALTERNATIVES,
    )) {
      const pattern = new RegExp(`\\b${problematicTerm}\\b`, 'gi');
      const matches = content.match(pattern);

      if (matches) {
        for (const match of matches) {
          const index = content.toLowerCase().indexOf(match.toLowerCase());
          const context = content.substring(
            Math.max(0, index - 20),
            index + match.length + 20,
          );

          issues.push({
            word: match,
            issue: `Consider using more inclusive language`,
            suggestion: `Try: ${alternatives}`,
            context,
          });

          score -= 5; // Deduct points for each issue
        }
      }
    }

    score = Math.max(0, score);

    const improvements = this.generateLanguageImprovements(issues);

    return {
      score,
      issues,
      improvements,
    };
  }

  /**
   * Check accessibility considerations
   */
  static checkAccessibility(
    content: string,
    gradeLevel: GradeLevel,
  ): AccessibilityCheck {
    const target = LANGUAGE_COMPLEXITY_TARGETS[gradeLevel];
    const issues: Array<{
      type: 'cognitive' | 'language' | 'conceptual';
      description: string;
      suggestion: string;
    }> = [];

    // Check sentence length
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgSentenceLength =
      sentences.reduce((sum, sentence) => {
        return sum + sentence.trim().split(/\s+/).length;
      }, 0) / sentences.length;

    if (avgSentenceLength > target.maxWordsPerSentence) {
      issues.push({
        type: 'language',
        description: `Average sentence length (${avgSentenceLength.toFixed(
          1,
        )} words) exceeds recommended maximum (${
          target.maxWordsPerSentence
        } words)`,
        suggestion: 'Break long sentences into shorter, simpler sentences',
      });
    }

    // Check for complex vocabulary (simplified)
    const words = content.split(/\s+/);
    const complexWords = words.filter(
      word => word.length > target.maxSyllablesPerWord * 2.5,
    );
    const complexWordRatio = complexWords.length / words.length;

    if (complexWordRatio > 0.1) {
      issues.push({
        type: 'language',
        description: `High ratio of complex words (${(
          complexWordRatio * 100
        ).toFixed(1)}%)`,
        suggestion:
          'Replace complex words with simpler alternatives appropriate for grade level',
      });
    }

    // Check for abstract concepts in younger grades
    if (!target.abstractConcepts) {
      const abstractIndicators = [
        'concept',
        'theory',
        'abstract',
        'metaphor',
        'symbolism',
        'philosophy',
      ];
      const hasAbstractConcepts = abstractIndicators.some(indicator =>
        content.toLowerCase().includes(indicator),
      );

      if (hasAbstractConcepts) {
        issues.push({
          type: 'conceptual',
          description:
            'Content may contain abstract concepts not appropriate for this grade level',
          suggestion: 'Use concrete examples and simpler concepts',
        });
      }
    }

    // Calculate scores
    const languageComplexity = Math.max(
      0,
      100 - (avgSentenceLength - target.maxWordsPerSentence) * 5,
    );
    const cognitiveAccessibility = Math.max(
      0,
      100 - complexWordRatio * 100 * 2,
    );
    const conceptualDifficulty =
      target.abstractConcepts || !content.toLowerCase().includes('abstract')
        ? 100
        : 70;

    return {
      cognitiveAccessibility,
      languageComplexity,
      conceptualDifficulty,
      issues,
    };
  }

  /**
   * Generate comprehensive cultural sensitivity report
   */
  static generateComprehensiveReport(
    content: string,
    gradeLevel: GradeLevel,
  ): {
    overallScore: number;
    biasDetection: BiasDetectionResult[];
    culturalRepresentation: CulturalRepresentationAnalysis;
    inclusiveLanguage: InclusiveLanguageAssessment;
    accessibility: AccessibilityCheck;
    recommendations: string[];
    priorityIssues: string[];
  } {
    structuredLogger.info(
      'Generating comprehensive cultural sensitivity report',
      {
        gradeLevel,
        contentLength: content.length,
      },
    );

    const biasDetection = this.detectBias(content);
    const culturalRepresentation = this.analyzeCulturalRepresentation(content);
    const inclusiveLanguage = this.assessInclusiveLanguage(content);
    const accessibility = this.checkAccessibility(content, gradeLevel);

    // Calculate overall score
    const overallScore = Math.round(
      culturalRepresentation.diversityScore * 0.25 +
        inclusiveLanguage.score * 0.25 +
        accessibility.cognitiveAccessibility * 0.2 +
        accessibility.languageComplexity * 0.15 +
        accessibility.conceptualDifficulty * 0.15,
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      biasDetection,
      culturalRepresentation,
      inclusiveLanguage,
      accessibility,
    );

    // Identify priority issues
    const priorityIssues = this.identifyPriorityIssues(
      biasDetection,
      culturalRepresentation,
      accessibility,
    );

    structuredLogger.info('Cultural sensitivity report generated', {
      overallScore,
      biasIssues: biasDetection.length,
      diversityScore: culturalRepresentation.diversityScore,
      inclusiveLanguageScore: inclusiveLanguage.score,
      priorityIssuesCount: priorityIssues.length,
    });

    return {
      overallScore,
      biasDetection,
      culturalRepresentation,
      inclusiveLanguage,
      accessibility,
      recommendations,
      priorityIssues,
    };
  }

  // Private helper methods

  private static getBiasSuggestion(biasType: string, match: string): string {
    const suggestions = {
      gender:
        'Consider using gender-neutral language or representing diverse gender expressions',
      racial: 'Avoid stereotypes and ensure diverse, positive representation',
      socioeconomic:
        'Be mindful of economic assumptions and represent diverse backgrounds',
      religious: 'Avoid religious assumptions and respect diverse beliefs',
      cultural: 'Ensure respectful representation of all cultures',
      ability: 'Use person-first language and avoid ableist terms',
      age: 'Represent people of all ages respectfully',
    };

    return (
      suggestions[biasType as keyof typeof suggestions] ||
      'Review for potential bias and consider alternatives'
    );
  }

  private static calculateBiasConfidence(
    match: string,
    context: string,
  ): number {
    // Higher confidence for exact matches in clear contexts
    let confidence = 0.7;

    // Increase confidence for longer matches
    if (match.length > 10) confidence += 0.1;

    // Increase confidence for clear context indicators
    const strongIndicators = [
      'always',
      'never',
      'all',
      'every',
      'only',
      'just',
      'should',
      'must',
    ];
    if (
      strongIndicators.some(indicator =>
        context.toLowerCase().includes(indicator),
      )
    ) {
      confidence += 0.15;
    }

    return Math.min(1, confidence);
  }

  private static identifyMissingRepresentation(content: string): string[] {
    const missing: string[] = [];
    const contentLower = content.toLowerCase();

    const representationCategories = [
      'different cultures',
      'various abilities',
      'diverse family types',
      'multiple languages',
      'different economic backgrounds',
    ];

    for (const category of representationCategories) {
      if (
        !contentLower.includes(category.replace(' ', '')) &&
        !contentLower.includes(category)
      ) {
        missing.push(category);
      }
    }

    return missing.slice(0, 3); // Return top 3 missing categories
  }

  private static generateLanguageImprovements(
    issues: Array<{ word: string; suggestion: string }>,
  ): string[] {
    const improvements: string[] = [];

    if (issues.length > 0) {
      improvements.push('Consider using more inclusive terminology');
    }

    if (issues.length > 3) {
      improvements.push(
        'Review content for multiple instances of non-inclusive language',
      );
    }

    const commonIssueTypes = new Set(
      issues.map(issue => issue.word.toLowerCase()),
    );
    if (commonIssueTypes.has('mankind') || commonIssueTypes.has('manpower')) {
      improvements.push(
        'Replace gendered terms with gender-neutral alternatives',
      );
    }

    return improvements;
  }

  private static generateRecommendations(
    biasDetection: BiasDetectionResult[],
    culturalRepresentation: CulturalRepresentationAnalysis,
    inclusiveLanguage: InclusiveLanguageAssessment,
    accessibility: AccessibilityCheck,
  ): string[] {
    const recommendations: string[] = [];

    if (biasDetection.length > 0) {
      recommendations.push(
        'Review and address potential bias issues identified in the content',
      );
    }

    if (culturalRepresentation.diversityScore < 70) {
      recommendations.push(
        'Enhance cultural representation and diversity in characters and settings',
      );
    }

    if (inclusiveLanguage.score < 80) {
      recommendations.push(
        'Update language to be more inclusive and accessible',
      );
    }

    if (accessibility.issues.length > 0) {
      recommendations.push(
        'Simplify language and concepts for better accessibility',
      );
    }

    if (culturalRepresentation.stereotypes.length > 0) {
      recommendations.push(
        'Avoid cultural stereotypes and ensure respectful representation',
      );
    }

    return recommendations.slice(0, 5); // Return top 5 recommendations
  }

  private static identifyPriorityIssues(
    biasDetection: BiasDetectionResult[],
    culturalRepresentation: CulturalRepresentationAnalysis,
    accessibility: AccessibilityCheck,
  ): string[] {
    const priorityIssues: string[] = [];

    // High-priority bias issues
    const criticalBias = biasDetection.filter(
      bias => bias.severity === 'high' || bias.severity === 'critical',
    );

    if (criticalBias.length > 0) {
      priorityIssues.push(
        `${criticalBias.length} critical bias issue(s) require immediate attention`,
      );
    }

    // Significant accessibility issues
    const significantAccessibilityIssues = accessibility.issues.filter(
      issue =>
        issue.type === 'conceptual' ||
        (issue.type === 'language' && issue.description.includes('exceeds')),
    );

    if (significantAccessibilityIssues.length > 0) {
      priorityIssues.push(
        'Content complexity may not be appropriate for target grade level',
      );
    }

    // Diversity representation issues
    if (culturalRepresentation.diversityScore < 50) {
      priorityIssues.push(
        'Low cultural diversity representation needs improvement',
      );
    }

    // Stereotype detection
    const highSeverityStereotypes = culturalRepresentation.stereotypes.filter(
      s => s.severity === 'high',
    );

    if (highSeverityStereotypes.length > 0) {
      priorityIssues.push(
        'Cultural stereotypes detected that require revision',
      );
    }

    return priorityIssues;
  }
}
