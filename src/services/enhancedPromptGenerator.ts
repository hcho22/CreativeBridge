// Enhanced Prompt Generator
// This service creates sophisticated AI prompts based on enhanced content analysis
// that can handle narrative stories, abstract concepts, inspirational content, and more.

import {
  enhancedContentAnalyzer,
  type EnhancedContentAnalysis,
} from './enhancedContentAnalysis';

export type GradeLevel = 'K-2' | '3-5' | '6-8' | '9-12';

interface ArtStyleDefinition {
  narrative: {
    baseStyle: string;
    technique: string;
    composition: string;
  };
  abstract: {
    baseStyle: string;
    technique: string;
    composition: string;
  };
  inspirational: {
    baseStyle: string;
    technique: string;
    composition: string;
  };
  philosophical: {
    baseStyle: string;
    technique: string;
    composition: string;
  };
  poetic: {
    baseStyle: string;
    technique: string;
    composition: string;
  };
}

export class EnhancedPromptGenerator {
  private readonly GRADE_LEVEL_STYLES: Record<GradeLevel, ArtStyleDefinition> =
    {
      'K-2': {
        narrative: {
          baseStyle: "children's book watercolor illustration",
          technique: 'soft watercolor with gentle brush strokes',
          composition: 'simple, clear, and child-friendly layout',
        },
        abstract: {
          baseStyle: 'playful abstract art for children',
          technique: 'bright colors with simple shapes',
          composition: 'cheerful and non-threatening visual elements',
        },
        inspirational: {
          baseStyle: "uplifting children's illustration",
          technique: 'warm watercolors with encouraging imagery',
          composition: 'positive and empowering visual metaphors',
        },
        philosophical: {
          baseStyle: "thoughtful children's book art",
          technique: 'gentle illustrations with deeper meaning',
          composition: 'simple wisdom conveyed through imagery',
        },
        poetic: {
          baseStyle: 'whimsical poetry illustration',
          technique: 'dreamy watercolors with flowing elements',
          composition: 'lyrical and imaginative visual poetry',
        },
      },
      '3-5': {
        narrative: {
          baseStyle: "detailed children's book illustration",
          technique: 'mixed media with vibrant colors',
          composition: 'engaging scenes with clear storytelling',
        },
        abstract: {
          baseStyle: 'colorful abstract expressionism for kids',
          technique: 'bold colors with expressive brushwork',
          composition: 'dynamic and engaging abstract forms',
        },
        inspirational: {
          baseStyle: 'motivational illustration art',
          technique: 'inspiring imagery with rich colors',
          composition: 'empowering symbols and metaphors',
        },
        philosophical: {
          baseStyle: 'contemplative illustration',
          technique: 'thoughtful art with symbolic elements',
          composition: 'meaningful imagery that sparks curiosity',
        },
        poetic: {
          baseStyle: 'artistic poetry visualization',
          technique: 'expressive art with rhythmic elements',
          composition: 'visual representation of poetic beauty',
        },
      },
      '6-8': {
        narrative: {
          baseStyle: 'realistic digital illustration',
          technique: 'detailed digital painting',
          composition: 'cinematic storytelling with depth',
        },
        abstract: {
          baseStyle: 'sophisticated abstract art',
          technique: 'complex layering with rich textures',
          composition: 'thought-provoking abstract concepts',
        },
        inspirational: {
          baseStyle: 'powerful conceptual artwork',
          technique: 'dramatic lighting with symbolic imagery',
          composition: 'inspiring visual metaphors with impact',
        },
        philosophical: {
          baseStyle: 'profound philosophical art',
          technique: 'deep symbolism with artistic mastery',
          composition: 'contemplative imagery that provokes thought',
        },
        poetic: {
          baseStyle: 'artistic interpretation of poetry',
          technique: 'sophisticated visual poetry techniques',
          composition: 'elegant representation of poetic themes',
        },
      },
      '9-12': {
        narrative: {
          baseStyle: 'professional narrative illustration',
          technique: 'advanced digital art techniques',
          composition: 'complex storytelling with mature themes',
        },
        abstract: {
          baseStyle: 'contemporary abstract expressionism',
          technique: 'masterful abstract painting techniques',
          composition: 'sophisticated conceptual abstraction',
        },
        inspirational: {
          baseStyle: 'profound inspirational artwork',
          technique: 'professional artistic execution',
          composition: 'mature and sophisticated motivational imagery',
        },
        philosophical: {
          baseStyle: 'deep philosophical visualization',
          technique: 'artistic mastery with profound symbolism',
          composition: 'complex philosophical concepts rendered beautifully',
        },
        poetic: {
          baseStyle: 'sophisticated poetic art',
          technique: 'advanced artistic interpretation',
          composition: 'mature and nuanced visual poetry',
        },
      },
    };

  generateEnhancedPrompt(
    content: string,
    gradeLevel: GradeLevel,
  ): {
    prompt: string;
    analysis: EnhancedContentAnalysis;
    reasoning: string[];
  } {
    // Analyze the content using enhanced analysis
    const analysis = enhancedContentAnalyzer.analyzeContent(content);
    const reasoning: string[] = [];

    // Get appropriate art style for content type and grade level
    const artStyle = this.getArtStyle(analysis.contentType.type, gradeLevel);
    reasoning.push(
      `Content type: ${
        analysis.contentType.type
      } (${analysis.contentType.confidence.toFixed(1)}% confidence)`,
    );

    // Build prompt based on content type
    let prompt: string;

    switch (analysis.contentType.type) {
      case 'narrative':
        prompt = this.generateNarrativePrompt(analysis, artStyle, gradeLevel);
        reasoning.push(
          'Generated narrative-focused prompt with characters and scenes',
        );
        break;

      case 'abstract':
        prompt = this.generateAbstractPrompt(analysis, artStyle, gradeLevel);
        reasoning.push('Generated abstract concept-focused prompt');
        break;

      case 'inspirational':
        prompt = this.generateInspirationalPrompt(
          analysis,
          artStyle,
          gradeLevel,
        );
        reasoning.push('Generated inspirational and motivational prompt');
        break;

      case 'philosophical':
        prompt = this.generatePhilosophicalPrompt(
          analysis,
          artStyle,
          gradeLevel,
        );
        reasoning.push('Generated philosophical and contemplative prompt');
        break;

      case 'poetic':
        prompt = this.generatePoeticPrompt(analysis, artStyle, gradeLevel);
        reasoning.push('Generated poetic and lyrical prompt');
        break;

      default:
        prompt = this.generateGenericPrompt(analysis, artStyle, gradeLevel);
        reasoning.push('Generated generic prompt as fallback');
    }

    // Add safety guidelines
    prompt += this.getSafetyGuidelines(gradeLevel);
    reasoning.push(`Added ${gradeLevel} appropriate safety guidelines`);

    return { prompt, analysis, reasoning };
  }

  private generateNarrativePrompt(
    analysis: EnhancedContentAnalysis,
    artStyle: ArtStyleDefinition[keyof ArtStyleDefinition],
    _gradeLevel: GradeLevel,
  ): string {
    const parts: string[] = [];

    // Base style
    parts.push(`Create a ${artStyle.baseStyle}`);

    // Add narrative elements if they exist
    if (analysis.narrativeElements.hasCharacters) {
      const characterElements = analysis.visualConcepts
        .filter(vc => vc.abstractLevel === 'concrete')
        .slice(0, 3)
        .map(vc => vc.element);

      if (characterElements.length > 0) {
        parts.push(`featuring ${characterElements.join(', ')}`);
      }
    }

    // Add visual concepts
    const mainConcepts = analysis.visualConcepts
      .slice(0, 3)
      .map(vc => vc.element);

    if (mainConcepts.length > 0) {
      parts.push(`depicting ${mainConcepts.join(', ')}`);
    }

    // Add emotional tone
    if (analysis.emotionalTone.primary !== 'neutral') {
      parts.push(`with a ${analysis.emotionalTone.primary} atmosphere`);
    }

    // Add technique and composition
    parts.push(`using ${artStyle.technique}`);
    parts.push(`with ${artStyle.composition}`);

    return parts.join(', ');
  }

  private generateAbstractPrompt(
    analysis: EnhancedContentAnalysis,
    artStyle: ArtStyleDefinition[keyof ArtStyleDefinition],
    _gradeLevel: GradeLevel,
  ): string {
    const parts: string[] = [];

    // Base style
    parts.push(`Create a ${artStyle.baseStyle}`);

    // Add main abstract concepts
    const topConcepts = analysis.abstractConcepts
      .slice(0, 3)
      .map(concept => concept.concept);

    if (topConcepts.length > 0) {
      parts.push(`representing the concepts of ${topConcepts.join(', ')}`);
    }

    // Add visual metaphors
    const visualMetaphors = analysis.visualConcepts
      .filter(vc => vc.abstractLevel === 'metaphorical')
      .slice(0, 3)
      .map(vc => vc.element);

    if (visualMetaphors.length > 0) {
      parts.push(
        `through visual metaphors including ${visualMetaphors.join(', ')}`,
      );
    }

    // Add semantic themes
    const mainThemes = analysis.semanticThemes
      .slice(0, 2)
      .map(theme => theme.theme);

    if (mainThemes.length > 0) {
      parts.push(`exploring themes of ${mainThemes.join(' and ')}`);
    }

    // Add emotional context
    parts.push(`with a ${analysis.emotionalTone.primary} emotional resonance`);

    // Add technique and composition
    parts.push(`using ${artStyle.technique}`);
    parts.push(`with ${artStyle.composition}`);

    return parts.join(', ');
  }

  private generateInspirationalPrompt(
    analysis: EnhancedContentAnalysis,
    artStyle: ArtStyleDefinition[keyof ArtStyleDefinition],
    _gradeLevel: GradeLevel,
  ): string {
    const parts: string[] = [];

    // Base style
    parts.push(`Create an ${artStyle.baseStyle}`);

    // Add inspirational elements
    const inspirationalConcepts = analysis.abstractConcepts
      .filter(concept =>
        ['hope', 'courage', 'determination', 'growth', 'achievement'].includes(
          concept.concept,
        ),
      )
      .slice(0, 3);

    if (inspirationalConcepts.length > 0) {
      const conceptNames = inspirationalConcepts.map(c => c.concept);
      parts.push(`celebrating ${conceptNames.join(', ')}`);
    }

    // Add uplifting visual elements
    const upliftingVisuals = analysis.visualConcepts
      .filter(vc =>
        ['rising sun', 'soaring eagle', 'mountain peak', 'breakthrough'].some(
          term => vc.element.includes(term),
        ),
      )
      .slice(0, 3);

    if (upliftingVisuals.length > 0) {
      parts.push(
        `featuring ${upliftingVisuals.map(v => v.element).join(', ')}`,
      );
    }

    // Add motivational symbolism
    const symbolism = analysis.visualSuggestions.symbolism.slice(0, 2);
    if (symbolism.length > 0) {
      parts.push(
        `incorporating symbolic elements like ${symbolism.join(' and ')}`,
      );
    }

    // Add dynamic composition
    parts.push(`with an uplifting and energetic composition`);
    parts.push(`using ${artStyle.technique}`);

    return parts.join(', ');
  }

  private generatePhilosophicalPrompt(
    analysis: EnhancedContentAnalysis,
    artStyle: ArtStyleDefinition[keyof ArtStyleDefinition],
    _gradeLevel: GradeLevel,
  ): string {
    const parts: string[] = [];

    // Base style
    parts.push(`Create a ${artStyle.baseStyle}`);

    // Add philosophical concepts
    const philosophicalConcepts = analysis.abstractConcepts
      .filter(
        concept =>
          concept.category === 'value' ||
          ['wisdom', 'truth', 'existence', 'consciousness'].includes(
            concept.concept,
          ),
      )
      .slice(0, 3);

    if (philosophicalConcepts.length > 0) {
      const conceptNames = philosophicalConcepts.map(c => c.concept);
      parts.push(`contemplating ${conceptNames.join(', ')}`);
    }

    // Add contemplative imagery
    const contemplativeElements = analysis.visualConcepts
      .filter(vc =>
        ['ancient tree', 'wise owl', 'flowing water', 'mountain vista'].some(
          term => vc.element.includes(term),
        ),
      )
      .slice(0, 2);

    if (contemplativeElements.length > 0) {
      parts.push(
        `featuring ${contemplativeElements.map(v => v.element).join(' and ')}`,
      );
    }

    // Add depth and meaning
    parts.push(`with layers of symbolic meaning`);
    parts.push(`encouraging deep reflection`);
    parts.push(`using ${artStyle.technique}`);
    parts.push(`with ${artStyle.composition}`);

    return parts.join(', ');
  }

  private generatePoeticPrompt(
    analysis: EnhancedContentAnalysis,
    artStyle: ArtStyleDefinition[keyof ArtStyleDefinition],
    _gradeLevel: GradeLevel,
  ): string {
    const parts: string[] = [];

    // Base style
    parts.push(`Create a ${artStyle.baseStyle}`);

    // Add lyrical elements
    const poeticConcepts = analysis.abstractConcepts
      .filter(
        concept =>
          concept.category === 'emotion' || concept.category === 'metaphor',
      )
      .slice(0, 3);

    if (poeticConcepts.length > 0) {
      const conceptNames = poeticConcepts.map(c => c.concept);
      parts.push(`expressing ${conceptNames.join(', ')}`);
    }

    // Add flowing, rhythmic elements
    parts.push(`with flowing, rhythmic visual elements`);

    // Add poetic imagery
    const poeticVisuals = analysis.visualConcepts
      .filter(vc => vc.abstractLevel === 'metaphorical')
      .slice(0, 3);

    if (poeticVisuals.length > 0) {
      parts.push(
        `incorporating ${poeticVisuals.map(v => v.element).join(', ')}`,
      );
    }

    // Add lyrical quality
    parts.push(`with a lyrical and musical quality`);
    parts.push(`using ${artStyle.technique}`);

    return parts.join(', ');
  }

  private generateGenericPrompt(
    analysis: EnhancedContentAnalysis,
    artStyle: ArtStyleDefinition[keyof ArtStyleDefinition],
    _gradeLevel: GradeLevel,
  ): string {
    const parts: string[] = [];

    parts.push(`Create a ${artStyle.baseStyle}`);

    // Add top visual concepts
    const topVisuals = analysis.visualConcepts.slice(0, 3);
    if (topVisuals.length > 0) {
      parts.push(`featuring ${topVisuals.map(v => v.element).join(', ')}`);
    }

    // Add emotional tone
    parts.push(`with a ${analysis.emotionalTone.primary} mood`);

    // Add technique
    parts.push(`using ${artStyle.technique}`);

    return parts.join(', ');
  }

  private getArtStyle(
    contentType: string,
    gradeLevel: GradeLevel,
  ): ArtStyleDefinition[keyof ArtStyleDefinition] {
    const styles = this.GRADE_LEVEL_STYLES[gradeLevel];
    return styles[contentType as keyof ArtStyleDefinition] || styles.abstract;
  }

  private getSafetyGuidelines(gradeLevel: GradeLevel): string {
    const guidelines = {
      'K-2':
        ', safe for very young children, bright and cheerful, G-rated content',
      '3-5':
        ', age-appropriate for children, positive and encouraging, family-friendly',
      '6-8':
        ', suitable for middle school students, inspiring and thought-provoking',
      '9-12':
        ', appropriate for young adults, sophisticated yet positive, mature themes handled thoughtfully',
    };

    return guidelines[gradeLevel];
  }
}

export const enhancedPromptGenerator = new EnhancedPromptGenerator();
