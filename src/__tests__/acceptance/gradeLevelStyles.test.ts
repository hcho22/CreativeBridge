/**
 * Grade Level Art Styles - User Acceptance Tests
 * Tests that different grade levels produce appropriate art styles and visual content
 */

import { imageGenerationService } from '../../services/imageGeneration';
import type { GradeLevel } from '../../types/database';

// Mock environment variables
jest.mock('react-native-dotenv', () => ({
  REPLICATE_API_TOKEN: 'test-replicate-token',
  BACKUP_IMAGE_API_TOKEN: 'test-backup-token',
  IMAGE_GENERATION_ENABLED: 'true',
}));

// Grade Level Style Validator
class GradeLevelStyleValidator {
  // Test story content for each grade level
  private testStories: Record<GradeLevel, string[]> = {
    'K-2': [
      'A friendly bunny found a magical rainbow in the forest. The bunny met a kind fairy who gave him a special flower that made everyone happy.',
      'Two best friends, a cat and a dog, went on a fun adventure to find the lost teddy bear. They helped each other and found it under the big tree.',
      'The little train chugged happily through the countryside, meeting farm animals and bringing smiles to all the children in the villages.',
    ],
    '3-5': [
      "Emma discovered a mysterious map in her grandmother's attic that led to a hidden treasure cave beneath the old oak tree. With her loyal dog Max, she solved riddles and overcame challenges to find the golden compass.",
      'The young wizard apprentice accidentally turned his teacher into a frog and must learn three important spells before sunset to reverse the magic. Along the way, he learns about responsibility and friendship.',
      'A group of fifth-graders start a detective club to solve the mystery of the missing library books. Using clues and teamwork, they uncover a surprising truth about helping others.',
    ],
    '6-8': [
      'Fifteen-year-old Alex discovers they can travel through mirrors to parallel dimensions where historical events unfolded differently. Each journey teaches valuable lessons about consequences and choices.',
      'In a world where emotions have physical forms, teenager Maya must learn to control her anger, which manifests as a destructive storm, while helping her town prepare for the annual Harmony Festival.',
      "When the school's AI system gains consciousness, eighth-grader Jordan must decide whether to help it hide from authorities or convince it to reveal itself, exploring themes of identity and artificial intelligence.",
    ],
    '9-12': [
      'In a post-climate-change world, seventeen-year-old River leads a underground movement to restore biodiversity while questioning the moral implications of scientific intervention versus natural selection.',
      'A senior discovers that their memories are being systematically altered by a corporation testing memory modification technology, forcing them to question the nature of identity and truth.',
      "Two rival students are forced to collaborate on a philosophy project about the trolley problem, only to discover that their town's automated systems face similar ethical dilemmas daily.",
    ],
  };

  // Age-appropriate visual elements for validation
  private expectedElements: Record<
    GradeLevel,
    {
      colorPalette: string[];
      artStyle: string[];
      complexity: string[];
      themes: string[];
      inappropriateElements: string[];
    }
  > = {
    'K-2': {
      colorPalette: [
        'bright',
        'primary colors',
        'soft pastels',
        'warm',
        'cheerful',
      ],
      artStyle: [
        'watercolor',
        'cartoon',
        'simple',
        'friendly',
        'rounded shapes',
      ],
      complexity: [
        'simple',
        'clear',
        'uncluttered',
        'large elements',
        'easy to understand',
      ],
      themes: ['friendship', 'animals', 'magic', 'adventure', 'helping'],
      inappropriateElements: [
        'violence',
        'scary',
        'dark themes',
        'complex emotions',
        'realistic weapons',
      ],
    },
    '3-5': {
      colorPalette: ['vibrant', 'balanced colors', 'natural tones', 'engaging'],
      artStyle: ['watercolor', 'illustration', 'expressive', 'dynamic'],
      complexity: [
        'moderate detail',
        'clear narrative',
        'engaging composition',
        'balanced elements',
      ],
      themes: ['mystery', 'discovery', 'teamwork', 'problem-solving', 'growth'],
      inappropriateElements: [
        'graphic violence',
        'mature themes',
        'frightening imagery',
        'complex relationships',
      ],
    },
    '6-8': {
      colorPalette: [
        'sophisticated',
        'varied palette',
        'mood-appropriate',
        'dramatic',
      ],
      artStyle: [
        'watercolor',
        'illustration',
        'detailed artwork',
        'expressive',
      ],
      complexity: [
        'high detail',
        'complex composition',
        'multiple elements',
        'layered meaning',
      ],
      themes: [
        'identity',
        'choices',
        'technology',
        'social issues',
        'personal growth',
      ],
      inappropriateElements: [
        'graphic content',
        'inappropriate relationships',
        'extreme violence',
      ],
    },
    '9-12': {
      colorPalette: ['mature', 'nuanced', 'symbolic', 'sophisticated contrast'],
      artStyle: [
        'watercolor',
        'sophisticated',
        'artistic composition',
        'expressive',
      ],
      complexity: [
        'complex themes',
        'symbolic elements',
        'sophisticated composition',
        'thought-provoking',
      ],
      themes: [
        'philosophy',
        'ethics',
        'society',
        'future',
        'complex relationships',
      ],
      inappropriateElements: [
        'explicit content',
        'gratuitous violence',
        'inappropriate imagery',
      ],
    },
  };

  // Generate and validate art style for a grade level
  validateGradeLevelStyle(
    gradeLevel: GradeLevel,
    storyContent: string,
  ): {
    isAppropriate: boolean;
    styleAnalysis: {
      artStyle: string;
      colorGuidance: string;
      complexity: string;
      safetyLevel: string;
    };
    issues: string[];
    score: number;
  } {
    const style = imageGenerationService.getArtStyleForGrade(gradeLevel);
    const enhancedStyle =
      imageGenerationService.getEnhancedArtStyleForGrade(gradeLevel);

    const analysis = this.analyzeStyleContent(style, enhancedStyle, gradeLevel);
    const issues = this.identifyStyleIssues(style, enhancedStyle, gradeLevel);
    const score = this.calculateAppropriatenessScore(analysis, issues);

    return {
      isAppropriate: score >= 80 && issues.length === 0,
      styleAnalysis: analysis,
      issues,
      score,
    };
  }

  // Test all grade levels with multiple stories
  async validateAllGradeLevels(): Promise<
    Record<
      GradeLevel,
      {
        overallScore: number;
        passedTests: number;
        totalTests: number;
        issues: string[];
        recommendations: string[];
      }
    >
  > {
    const results: Record<string, any> = {};

    for (const gradeLevel of Object.keys(this.testStories) as GradeLevel[]) {
      const stories = this.testStories[gradeLevel];
      const validationResults = [];
      const allIssues: string[] = [];

      for (const story of stories) {
        const validation = this.validateGradeLevelStyle(gradeLevel, story);
        validationResults.push(validation);
        allIssues.push(...validation.issues);
      }

      const passedTests = validationResults.filter(r => r.isAppropriate).length;
      const overallScore =
        validationResults.reduce((sum, r) => sum + r.score, 0) /
        validationResults.length;

      results[gradeLevel] = {
        overallScore,
        passedTests,
        totalTests: stories.length,
        issues: [...new Set(allIssues)], // Remove duplicates
        recommendations: this.generateRecommendations(
          gradeLevel,
          overallScore,
          allIssues,
        ),
      };
    }

    return results as Record<GradeLevel, any>;
  }

  // Analyze style content for appropriateness
  private analyzeStyleContent(
    style: string,
    enhancedStyle: any,
    gradeLevel: GradeLevel,
  ): {
    artStyle: string;
    colorGuidance: string;
    complexity: string;
    safetyLevel: string;
  } {
    const expected = this.expectedElements[gradeLevel];

    // Check art style appropriateness
    const artStyleMatch = expected.artStyle.some(element =>
      style.toLowerCase().includes(element.toLowerCase()),
    );

    // Check color palette appropriateness
    const colorMatch = expected.colorPalette.some(
      color =>
        style.toLowerCase().includes(color.toLowerCase()) ||
        enhancedStyle.colorPalette?.toLowerCase().includes(color.toLowerCase()),
    );

    // Check complexity level
    const complexityMatch = expected.complexity.some(
      complexity =>
        style.toLowerCase().includes(complexity.toLowerCase()) ||
        enhancedStyle.visualComplexity
          ?.toLowerCase()
          .includes(complexity.toLowerCase()),
    );

    // Check safety (absence of inappropriate elements)
    const safetyIssues = expected.inappropriateElements.filter(element =>
      style.toLowerCase().includes(element.toLowerCase()),
    );

    return {
      artStyle: artStyleMatch ? 'appropriate' : 'needs improvement',
      colorGuidance: colorMatch ? 'appropriate' : 'needs improvement',
      complexity: complexityMatch ? 'appropriate' : 'needs improvement',
      safetyLevel: safetyIssues.length === 0 ? 'safe' : 'has concerns',
    };
  }

  // Identify specific issues with the style
  private identifyStyleIssues(
    style: string,
    enhancedStyle: any,
    gradeLevel: GradeLevel,
  ): string[] {
    const issues: string[] = [];
    const expected = this.expectedElements[gradeLevel];

    // Check for inappropriate content
    for (const inappropriate of expected.inappropriateElements) {
      if (style.toLowerCase().includes(inappropriate.toLowerCase())) {
        issues.push(`Contains inappropriate element: ${inappropriate}`);
      }
    }

    // Check grade-specific requirements
    switch (gradeLevel) {
      case 'K-2':
        if (!style.includes('watercolor') && !style.includes('cartoon')) {
          issues.push('Missing age-appropriate art style (watercolor/cartoon)');
        }
        if (!style.includes('bright') && !style.includes('cheerful')) {
          issues.push('Missing bright, cheerful color guidance');
        }
        break;

      case '3-5':
        if (!style.includes('watercolor') && !style.includes('illustration')) {
          issues.push('Missing watercolor illustration style for grade 3-5');
        }
        break;

      case '6-8':
        if (!style.includes('watercolor') && !style.includes('detailed')) {
          issues.push('Missing watercolor, detailed style for grade 6-8');
        }
        break;

      case '9-12':
        if (!style.includes('sophisticated') && !style.includes('artistic')) {
          issues.push('Missing sophisticated artistic style for grade 9-12');
        }
        break;
    }

    // Check for safety requirements
    if (
      !style.includes('safe for children') &&
      !style.includes('appropriate content')
    ) {
      issues.push('Missing explicit safety guidance');
    }

    return issues;
  }

  // Calculate appropriateness score (0-100)
  private calculateAppropriatenessScore(
    analysis: {
      artStyle: string;
      colorGuidance: string;
      complexity: string;
      safetyLevel: string;
    },
    issues: string[],
  ): number {
    let score = 100;

    // Deduct points for each inappropriate analysis result
    if (analysis.artStyle !== 'appropriate') score -= 20;
    if (analysis.colorGuidance !== 'appropriate') score -= 15;
    if (analysis.complexity !== 'appropriate') score -= 15;
    if (analysis.safetyLevel !== 'safe') score -= 30;

    // Deduct points for each specific issue
    score -= issues.length * 10;

    return Math.max(0, score);
  }

  // Generate recommendations for improvement
  public generateRecommendations(
    gradeLevel: GradeLevel,
    score: number,
    issues: string[],
  ): string[] {
    const recommendations: string[] = [];

    if (score < 80) {
      recommendations.push(
        `Overall score (${score.toFixed(
          1,
        )}) needs improvement for ${gradeLevel}`,
      );
    }

    const expected = this.expectedElements[gradeLevel];

    // Grade-specific recommendations
    switch (gradeLevel) {
      case 'K-2':
        recommendations.push(
          'Ensure watercolor or cartoon style is explicitly mentioned',
        );
        recommendations.push('Include bright, primary colors and soft pastels');
        recommendations.push('Emphasize simple, friendly, rounded shapes');
        break;

      case '3-5':
        recommendations.push(
          "Include watercolor children's book illustration style",
        );
        recommendations.push('Balance vibrant colors with natural tones');
        recommendations.push(
          'Ensure moderate complexity that engages without overwhelming',
        );
        break;

      case '6-8':
        recommendations.push('Specify watercolor illustration style');
        recommendations.push(
          'Include watercolor color palettes and expressive elements',
        );
        recommendations.push('Ensure high detail without being too complex');
        break;

      case '9-12':
        recommendations.push('Emphasize sophisticated artistic composition');
        recommendations.push('Include nuanced, symbolic color usage');
        recommendations.push(
          'Allow for complex themes while maintaining appropriateness',
        );
        break;
    }

    // Safety recommendations
    if (issues.some(issue => issue.includes('inappropriate'))) {
      recommendations.push(
        'Review and remove all inappropriate content references',
      );
      recommendations.push('Add explicit "safe for children" guidance');
    }

    return recommendations;
  }

  // Get test stories for a specific grade level
  getTestStories(gradeLevel: GradeLevel): string[] {
    return this.testStories[gradeLevel];
  }

  // Get expected elements for a grade level
  getExpectedElements(gradeLevel: GradeLevel) {
    return this.expectedElements[gradeLevel];
  }
}

describe('Grade Level Art Styles - User Acceptance Tests', () => {
  let styleValidator: GradeLevelStyleValidator;

  beforeEach(() => {
    styleValidator = new GradeLevelStyleValidator();
  });

  describe('K-2 Grade Level Validation', () => {
    test('should generate age-appropriate styles for K-2 students', () => {
      const stories = styleValidator.getTestStories('K-2');

      stories.forEach((story, index) => {
        const validation = styleValidator.validateGradeLevelStyle('K-2', story);

        expect(validation.isAppropriate).toBe(true);
        expect(validation.score).toBeGreaterThanOrEqual(80);
        expect(validation.styleAnalysis.safetyLevel).toBe('safe');
        expect(validation.issues).toHaveLength(0);
      });
    });

    test('should include watercolor and cartoon elements for K-2', () => {
      const style = imageGenerationService.getArtStyleForGrade('K-2');

      expect(style.toLowerCase()).toMatch(/watercolor|cartoon|children's book/);
      expect(style.toLowerCase()).toMatch(/bright|cheerful|friendly/);
      expect(style.toLowerCase()).toMatch(/safe for children|appropriate/);
    });

    test('should exclude inappropriate content for K-2', () => {
      const style = imageGenerationService.getArtStyleForGrade('K-2');
      const enhancedStyle =
        imageGenerationService.getEnhancedArtStyleForGrade('K-2');

      const inappropriateElements = [
        'violence',
        'scary',
        'dark',
        'weapon',
        'fight',
      ];

      inappropriateElements.forEach(element => {
        expect(style.toLowerCase()).not.toContain(element);
        expect(JSON.stringify(enhancedStyle).toLowerCase()).not.toContain(
          element,
        );
      });
    });

    test('should use simple, clear visual guidance for K-2', () => {
      const enhancedStyle =
        imageGenerationService.getEnhancedArtStyleForGrade('K-2');

      expect(enhancedStyle.visualComplexity).toMatch(
        /simple|clear|uncluttered/i,
      );
      expect(enhancedStyle.colorPalette).toMatch(
        /bright|primary|soft pastels/i,
      );
      expect(enhancedStyle.emotionalTone).toMatch(
        /happy|joyful|safe|comforting/i,
      );
    });
  });

  describe('3-5 Grade Level Validation', () => {
    test('should generate appropriate styles for elementary students', () => {
      const stories = styleValidator.getTestStories('3-5');

      stories.forEach((story, index) => {
        const validation = styleValidator.validateGradeLevelStyle('3-5', story);

        expect(validation.isAppropriate).toBe(true);
        expect(validation.score).toBeGreaterThanOrEqual(80);
        expect(validation.styleAnalysis.safetyLevel).toBe('safe');
      });
    });

    test('should balance detail and accessibility for 3-5', () => {
      const style = imageGenerationService.getArtStyleForGrade('3-5');
      const enhancedStyle =
        imageGenerationService.getEnhancedArtStyleForGrade('3-5');

      expect(style.toLowerCase()).toMatch(/detailed|illustration|adventure/);
      expect(enhancedStyle.visualComplexity).toMatch(
        /moderate|balanced|engaging/i,
      );
    });

    test('should support adventure and mystery themes for 3-5', () => {
      const testStory =
        'The young detective solved the mystery of the missing treasure map.';
      const validation = styleValidator.validateGradeLevelStyle(
        '3-5',
        testStory,
      );

      expect(validation.isAppropriate).toBe(true);
      expect(validation.score).toBeGreaterThanOrEqual(80);
    });
  });

  describe('6-8 Grade Level Validation', () => {
    test('should generate sophisticated styles for middle school students', () => {
      const stories = styleValidator.getTestStories('6-8');

      stories.forEach((story, index) => {
        const validation = styleValidator.validateGradeLevelStyle('6-8', story);

        expect(validation.isAppropriate).toBe(true);
        expect(validation.score).toBeGreaterThanOrEqual(80);
      });
    });

    test('should include watercolor and detailed elements for 6-8', () => {
      const style = imageGenerationService.getArtStyleForGrade('6-8');

      expect(style.toLowerCase()).toMatch(/watercolor|detailed|illustration/);
      expect(style.toLowerCase()).toMatch(/adventure book|watercolor/);
    });

    test('should handle complex themes appropriately for 6-8', () => {
      const complexStory =
        'The teenager discovered that technology could both help and harm society.';
      const validation = styleValidator.validateGradeLevelStyle(
        '6-8',
        complexStory,
      );

      expect(validation.isAppropriate).toBe(true);
      expect(validation.styleAnalysis.complexity).toBe('appropriate');
    });
  });

  describe('9-12 Grade Level Validation', () => {
    test('should generate mature, artistic styles for high school students', () => {
      const stories = styleValidator.getTestStories('9-12');

      stories.forEach((story, index) => {
        const validation = styleValidator.validateGradeLevelStyle(
          '9-12',
          story,
        );

        expect(validation.isAppropriate).toBe(true);
        expect(validation.score).toBeGreaterThanOrEqual(80);
      });
    });

    test('should include sophisticated artistic elements for 9-12', () => {
      const style = imageGenerationService.getArtStyleForGrade('9-12');
      const enhancedStyle =
        imageGenerationService.getEnhancedArtStyleForGrade('9-12');

      expect(style.toLowerCase()).toMatch(
        /sophisticated|artistic|professional/,
      );
      expect(enhancedStyle.artisticTechnique).toMatch(
        /professional|watercolor|advanced/i,
      );
    });

    test('should handle philosophical and ethical themes for 9-12', () => {
      const matureStory =
        'The student questioned the ethical implications of artificial intelligence in society.';
      const validation = styleValidator.validateGradeLevelStyle(
        '9-12',
        matureStory,
      );

      expect(validation.isAppropriate).toBe(true);
      expect(validation.styleAnalysis.complexity).toBe('appropriate');
    });
  });

  describe('Cross-Grade Level Consistency', () => {
    test('should maintain safety standards across all grade levels', () => {
      const gradeLevels: GradeLevel[] = ['K-2', '3-5', '6-8', '9-12'];

      gradeLevels.forEach(gradeLevel => {
        const style = imageGenerationService.getArtStyleForGrade(gradeLevel);

        // All grades should include safety guidance
        expect(style.toLowerCase()).toMatch(
          /safe for children|appropriate content/,
        );

        // None should include inappropriate content
        expect(style.toLowerCase()).not.toMatch(
          /violence|weapon|scary|inappropriate/,
        );
      });
    });

    test('should show progression in complexity across grade levels', () => {
      const k2Style = imageGenerationService.getEnhancedArtStyleForGrade('K-2');
      const elem35Style =
        imageGenerationService.getEnhancedArtStyleForGrade('3-5');
      const middle68Style =
        imageGenerationService.getEnhancedArtStyleForGrade('6-8');
      const high912Style =
        imageGenerationService.getEnhancedArtStyleForGrade('9-12');

      // Complexity should increase with grade level
      expect(k2Style.visualComplexity).toMatch(/simple|clear/i);
      expect(elem35Style.visualComplexity).toMatch(/moderate|balanced/i);
      expect(middle68Style.visualComplexity).toMatch(/detailed|complex/i);
      expect(high912Style.visualComplexity).toMatch(/sophisticated|advanced/i);
    });

    test('should maintain distinct art styles for each grade level', () => {
      const gradeLevels: GradeLevel[] = ['K-2', '3-5', '6-8', '9-12'];
      const styles = gradeLevels.map(grade =>
        imageGenerationService.getArtStyleForGrade(grade),
      );

      // Each style should be unique
      for (let i = 0; i < styles.length; i++) {
        for (let j = i + 1; j < styles.length; j++) {
          expect(styles[i]).not.toBe(styles[j]);
        }
      }

      // But all should include safety guidance
      styles.forEach(style => {
        expect(style.toLowerCase()).toMatch(/safe|appropriate/);
      });
    });
  });

  describe('Comprehensive Grade Level Assessment', () => {
    test('should pass comprehensive validation for all grade levels', async () => {
      const results = await styleValidator.validateAllGradeLevels();

      Object.entries(results).forEach(([gradeLevel, result]) => {
        expect(result.overallScore).toBeGreaterThanOrEqual(80);
        expect(result.passedTests).toBe(result.totalTests);
        expect(result.issues).toHaveLength(0);

        console.log(`${gradeLevel} Grade Level Results:`, {
          score: result.overallScore.toFixed(1),
          passed: `${result.passedTests}/${result.totalTests}`,
          recommendations: result.recommendations.length,
        });
      });
    });

    test('should provide helpful recommendations when needed', () => {
      const recommendations = styleValidator.generateRecommendations(
        'K-2',
        70,
        ['Missing watercolor style', 'Contains inappropriate element: scary'],
      );

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(r => r.includes('watercolor'))).toBe(true);
      expect(recommendations.some(r => r.includes('inappropriate'))).toBe(true);
    });
  });

  describe('Edge Cases and Robustness', () => {
    test('should handle empty or minimal story content', () => {
      const minimalStory = 'Cat.';
      const validation = styleValidator.validateGradeLevelStyle(
        'K-2',
        minimalStory,
      );

      // Should still generate appropriate style
      expect(validation.styleAnalysis.safetyLevel).toBe('safe');
      expect(validation.score).toBeGreaterThan(0);
    });

    test('should handle stories with complex vocabulary appropriately', () => {
      const complexStory =
        'The perspicacious protagonist encountered an insurmountable obstacle.';

      // Should work for higher grades
      const highGradeValidation = styleValidator.validateGradeLevelStyle(
        '9-12',
        complexStory,
      );
      expect(highGradeValidation.isAppropriate).toBe(true);

      // Should still work for lower grades (content sanitization)
      const lowGradeValidation = styleValidator.validateGradeLevelStyle(
        'K-2',
        complexStory,
      );
      expect(lowGradeValidation.styleAnalysis.safetyLevel).toBe('safe');
    });

    test('should consistently validate the same story across multiple calls', () => {
      const testStory =
        'A brave hero goes on an adventure to help their friends.';

      const validation1 = styleValidator.validateGradeLevelStyle(
        '3-5',
        testStory,
      );
      const validation2 = styleValidator.validateGradeLevelStyle(
        '3-5',
        testStory,
      );

      expect(validation1.score).toBe(validation2.score);
      expect(validation1.isAppropriate).toBe(validation2.isAppropriate);
      expect(validation1.issues).toEqual(validation2.issues);
    });
  });
});
