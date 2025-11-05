// Enhanced Content Analysis Service
// This service provides sophisticated content analysis that can understand abstract concepts,
// philosophical text, poetry, and various content types beyond simple narratives.

interface ContentType {
  type:
    | 'narrative'
    | 'abstract'
    | 'inspirational'
    | 'philosophical'
    | 'poetic'
    | 'instructional';
  confidence: number;
  reasoning: string[];
}

interface AbstractConcept {
  concept: string;
  weight: number;
  category: 'emotion' | 'value' | 'action' | 'metaphor' | 'theme';
  context: string[];
}

interface SemanticTheme {
  theme: string;
  strength: number;
  keywords: string[];
  visualMetaphors: string[];
}

interface VisualConcept {
  element: string;
  description: string;
  abstractLevel: 'concrete' | 'metaphorical' | 'symbolic';
  visualWeight: number;
}

interface EnhancedContentAnalysis {
  contentType: ContentType;
  abstractConcepts: AbstractConcept[];
  semanticThemes: SemanticTheme[];
  visualConcepts: VisualConcept[];
  emotionalTone: {
    primary: string;
    secondary: string[];
    intensity: number;
  };
  narrativeElements: {
    hasCharacters: boolean;
    hasPlot: boolean;
    hasSettings: boolean;
    timeframe: 'present' | 'past' | 'future' | 'timeless';
  };
  visualSuggestions: {
    artStyle: string;
    composition: string;
    colorMood: string;
    symbolism: string[];
  };
}

export class EnhancedContentAnalyzer {
  // Content type detection patterns
  private readonly NARRATIVE_INDICATORS = [
    /once upon a time/i,
    /\b(he|she|they|it)\s+(was|were|went|said|did|found)/gi,
    /\b(character|story|adventure|journey)\b/gi,
    /\b(in\s+a\s+\w+|long\s+ago|one\s+day)\b/gi,
  ];

  private readonly ABSTRACT_INDICATORS = [
    /\b(concept|idea|notion|principle|philosophy)\b/gi,
    /\b(represents?|symbolizes?|embodies?|signifies?)\b/gi,
    /\b(metaphor|allegory|symbol|meaning)\b/gi,
    /\b(essence|nature|spirit|soul)\b/gi,
  ];

  private readonly INSPIRATIONAL_INDICATORS = [
    /\b(inspire|motivate|encourage|empower)\b/gi,
    /\b(dream|believe|achieve|overcome|succeed)\b/gi,
    /\b(here's\s+to|celebrate|honor|tribute)\b/gi,
    /\b(vision|hope|courage|strength|determination)\b/gi,
  ];

  private readonly PHILOSOPHICAL_INDICATORS = [
    /\b(truth|reality|existence|consciousness|being)\b/gi,
    /\b(question|ponder|contemplate|reflect|consider)\b/gi,
    /\b(wisdom|knowledge|understanding|insight)\b/gi,
    /\b(life|death|meaning|purpose|destiny)\b/gi,
  ];

  // Abstract concept categories
  private readonly EMOTIONAL_CONCEPTS = {
    positive: [
      'joy',
      'happiness',
      'love',
      'hope',
      'peace',
      'wonder',
      'excitement',
      'inspiration',
    ],
    negative: [
      'sadness',
      'fear',
      'anger',
      'despair',
      'loneliness',
      'anxiety',
      'frustration',
    ],
    complex: [
      'nostalgia',
      'melancholy',
      'bittersweet',
      'ambivalence',
      'yearning',
      'contemplation',
    ],
  };

  private readonly VALUE_CONCEPTS = {
    personal: [
      'freedom',
      'authenticity',
      'creativity',
      'individuality',
      'growth',
      'wisdom',
    ],
    social: [
      'unity',
      'community',
      'justice',
      'equality',
      'compassion',
      'cooperation',
    ],
    universal: [
      'truth',
      'beauty',
      'harmony',
      'balance',
      'transcendence',
      'enlightenment',
    ],
  };

  private readonly ACTION_CONCEPTS = {
    creation: [
      'create',
      'build',
      'invent',
      'design',
      'craft',
      'compose',
      'generate',
    ],
    exploration: [
      'discover',
      'explore',
      'journey',
      'venture',
      'seek',
      'quest',
      'investigate',
    ],
    transformation: [
      'change',
      'evolve',
      'transform',
      'grow',
      'develop',
      'progress',
      'advance',
    ],
    connection: [
      'unite',
      'connect',
      'bridge',
      'link',
      'join',
      'merge',
      'blend',
    ],
  };

  // Visual metaphor mappings
  private readonly VISUAL_METAPHORS = {
    freedom: [
      'open sky',
      'flying birds',
      'vast horizons',
      'breaking chains',
      'soaring eagle',
    ],
    creativity: [
      'painting palette',
      'empty canvas',
      'flowing colors',
      'artist tools',
      'bursting imagination',
    ],
    growth: [
      'growing tree',
      'blooming flower',
      'rising sun',
      'climbing mountain',
      'flowing river',
    ],
    unity: [
      'interlocking hands',
      'puzzle pieces',
      'woven threads',
      'bridge connections',
      'circular harmony',
    ],
    innovation: [
      'lightbulb',
      'gears turning',
      'rocket launch',
      'breakthrough moment',
      'pioneering path',
    ],
    wisdom: [
      'ancient tree',
      'owl',
      'opened book',
      'lighthouse',
      'clear crystal',
    ],
    courage: [
      'lion',
      'warrior',
      'mountain climber',
      'storm navigator',
      'flame torch',
    ],
    hope: [
      'sunrise',
      'rainbow after storm',
      'lighthouse beacon',
      'growing seedling',
      'guiding star',
    ],
  };

  analyzeContent(content: string): EnhancedContentAnalysis {
    const contentType = this.detectContentType(content);
    const abstractConcepts = this.extractAbstractConcepts(content);
    const semanticThemes = this.analyzeSemanticThemes(
      content,
      abstractConcepts,
    );
    const visualConcepts = this.generateVisualConcepts(
      abstractConcepts,
      semanticThemes,
    );
    const emotionalTone = this.analyzeEmotionalTone(content, abstractConcepts);
    const narrativeElements = this.analyzeNarrativeElements(content);
    const visualSuggestions = this.generateVisualSuggestions(
      contentType,
      semanticThemes,
      emotionalTone,
    );

    return {
      contentType,
      abstractConcepts,
      semanticThemes,
      visualConcepts,
      emotionalTone,
      narrativeElements,
      visualSuggestions,
    };
  }

  private detectContentType(content: string): ContentType {
    const text = content.toLowerCase();
    const scores = {
      narrative: 0,
      abstract: 0,
      inspirational: 0,
      philosophical: 0,
      poetic: 0,
      instructional: 0,
    };

    const reasoning: string[] = [];

    // Check narrative indicators
    this.NARRATIVE_INDICATORS.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        scores.narrative += matches.length * 2;
        reasoning.push(`Found narrative pattern: "${matches[0]}"`);
      }
    });

    // Check abstract indicators
    this.ABSTRACT_INDICATORS.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        scores.abstract += matches.length * 1.5;
        reasoning.push(`Found abstract pattern: "${matches[0]}"`);
      }
    });

    // Check inspirational indicators
    this.INSPIRATIONAL_INDICATORS.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        scores.inspirational += matches.length * 2;
        reasoning.push(`Found inspirational pattern: "${matches[0]}"`);
      }
    });

    // Check philosophical indicators
    this.PHILOSOPHICAL_INDICATORS.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        scores.philosophical += matches.length * 1.5;
        reasoning.push(`Found philosophical pattern: "${matches[0]}"`);
      }
    });

    // Check for poetic indicators
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    const avgLineLength =
      lines.reduce((sum, line) => sum + line.length, 0) / lines.length;
    if (avgLineLength < 50 && lines.length > 3) {
      scores.poetic += 2;
      reasoning.push('Short lines suggest poetic structure');
    }

    // Check for instructional indicators
    if (
      text.includes('step') ||
      text.includes('how to') ||
      text.includes('instructions')
    ) {
      scores.instructional += 2;
      reasoning.push('Found instructional language');
    }

    // Determine primary type
    const maxScore = Math.max(...Object.values(scores));
    const primaryType =
      (Object.entries(scores).find(
        ([_, score]) => score === maxScore,
      )?.[0] as ContentType['type']) || 'abstract';

    // Calculate confidence based on score differences
    const totalScore = Object.values(scores).reduce(
      (sum, score) => sum + score,
      0,
    );
    const confidence = totalScore > 0 ? (maxScore / totalScore) * 100 : 50;

    return {
      type: primaryType,
      confidence: Math.min(confidence, 95),
      reasoning,
    };
  }

  private extractAbstractConcepts(content: string): AbstractConcept[] {
    const concepts: AbstractConcept[] = [];
    const text = content.toLowerCase();
    const words = text.split(/\s+/);

    // Extract emotional concepts
    Object.entries(this.EMOTIONAL_CONCEPTS).forEach(
      ([subcategory, conceptList]) => {
        conceptList.forEach(concept => {
          if (text.includes(concept)) {
            const context = this.findContext(content, concept);
            concepts.push({
              concept,
              weight: this.calculateConceptWeight(concept, text),
              category: 'emotion',
              context,
            });
          }
        });
      },
    );

    // Extract value concepts
    Object.entries(this.VALUE_CONCEPTS).forEach(
      ([subcategory, conceptList]) => {
        conceptList.forEach(concept => {
          if (text.includes(concept)) {
            const context = this.findContext(content, concept);
            concepts.push({
              concept,
              weight: this.calculateConceptWeight(concept, text),
              category: 'value',
              context,
            });
          }
        });
      },
    );

    // Extract action concepts
    Object.entries(this.ACTION_CONCEPTS).forEach(
      ([subcategory, conceptList]) => {
        conceptList.forEach(concept => {
          const regex = new RegExp(`\\b${concept}\\w*\\b`, 'gi');
          if (regex.test(text)) {
            const context = this.findContext(content, concept);
            concepts.push({
              concept,
              weight: this.calculateConceptWeight(concept, text),
              category: 'action',
              context,
            });
          }
        });
      },
    );

    // Extract metaphorical concepts
    const metaphorPatterns = [
      /like\s+a?\s*(\w+)/gi,
      /as\s+(\w+)\s+as/gi,
      /metaphor\s+(?:of|for)\s+(\w+)/gi,
    ];

    metaphorPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        concepts.push({
          concept: match[1],
          weight: 1.5,
          category: 'metaphor',
          context: [match[0]],
        });
      }
    });

    return concepts.sort((a, b) => b.weight - a.weight).slice(0, 10);
  }

  private analyzeSemanticThemes(
    content: string,
    concepts: AbstractConcept[],
  ): SemanticTheme[] {
    const themes: SemanticTheme[] = [];
    const text = content.toLowerCase();

    // Group concepts by common themes
    const themeGroups = {
      innovation: [
        'create',
        'invent',
        'imagine',
        'creativity',
        'innovation',
        'new',
        'original',
      ],
      rebellion: [
        'rebel',
        'misfit',
        'different',
        'change',
        'challenge',
        'break',
        'unconventional',
      ],
      inspiration: [
        'inspire',
        'motivate',
        'push',
        'forward',
        'progress',
        'achieve',
        'dream',
      ],
      uniqueness: [
        'unique',
        'individual',
        'special',
        'distinct',
        'rare',
        'exceptional',
      ],
      transformation: [
        'change',
        'transform',
        'evolve',
        'grow',
        'develop',
        'become',
      ],
      vision: [
        'see',
        'vision',
        'imagine',
        'picture',
        'visualize',
        'dream',
        'foresee',
      ],
    };

    Object.entries(themeGroups).forEach(([themeName, keywords]) => {
      const foundKeywords = keywords.filter(
        keyword =>
          text.includes(keyword) ||
          concepts.some(c => c.concept.includes(keyword)),
      );

      if (foundKeywords.length > 0) {
        const strength = foundKeywords.length / keywords.length;
        const visualMetaphors =
          this.VISUAL_METAPHORS[
            themeName as keyof typeof this.VISUAL_METAPHORS
          ] || [];

        themes.push({
          theme: themeName,
          strength,
          keywords: foundKeywords,
          visualMetaphors,
        });
      }
    });

    return themes.sort((a, b) => b.strength - a.strength);
  }

  private generateVisualConcepts(
    concepts: AbstractConcept[],
    themes: SemanticTheme[],
  ): VisualConcept[] {
    const visualConcepts: VisualConcept[] = [];

    // Convert abstract concepts to visual elements
    concepts.forEach(concept => {
      const visualMetaphors =
        this.VISUAL_METAPHORS[
          concept.concept as keyof typeof this.VISUAL_METAPHORS
        ];
      if (visualMetaphors) {
        visualMetaphors.forEach(metaphor => {
          visualConcepts.push({
            element: metaphor,
            description: `Visual representation of ${concept.concept}`,
            abstractLevel: 'metaphorical',
            visualWeight: concept.weight,
          });
        });
      } else {
        // Create symbolic representation
        visualConcepts.push({
          element: this.generateSymbolicElement(concept.concept),
          description: `Symbolic representation of ${concept.concept}`,
          abstractLevel: 'symbolic',
          visualWeight: concept.weight * 0.8,
        });
      }
    });

    // Add theme-based visual elements
    themes.forEach(theme => {
      theme.visualMetaphors.forEach(metaphor => {
        if (!visualConcepts.some(vc => vc.element === metaphor)) {
          visualConcepts.push({
            element: metaphor,
            description: `Visual metaphor for ${theme.theme}`,
            abstractLevel: 'metaphorical',
            visualWeight: theme.strength * 2,
          });
        }
      });
    });

    return visualConcepts
      .sort((a, b) => b.visualWeight - a.visualWeight)
      .slice(0, 8);
  }

  private analyzeEmotionalTone(
    content: string,
    concepts: AbstractConcept[],
  ): EnhancedContentAnalysis['emotionalTone'] {
    const emotionalConcepts = concepts.filter(c => c.category === 'emotion');
    const text = content.toLowerCase();

    // Determine primary emotional tone
    let primary = 'neutral';
    let intensity = 0.5;

    if (emotionalConcepts.length > 0) {
      primary = emotionalConcepts[0].concept;
      intensity = Math.min(emotionalConcepts[0].weight / 3, 1);
    } else {
      // Analyze text sentiment
      if (
        text.includes('inspire') ||
        text.includes('celebrate') ||
        text.includes('amazing')
      ) {
        primary = 'inspiring';
        intensity = 0.8;
      } else if (
        text.includes('challenge') ||
        text.includes('fight') ||
        text.includes('struggle')
      ) {
        primary = 'determined';
        intensity = 0.7;
      }
    }

    const secondary = emotionalConcepts.slice(1, 4).map(c => c.concept);

    return { primary, secondary, intensity };
  }

  private analyzeNarrativeElements(
    content: string,
  ): EnhancedContentAnalysis['narrativeElements'] {
    const text = content.toLowerCase();

    return {
      hasCharacters:
        /\b(he|she|they|character|person|people|protagonist)\b/gi.test(text),
      hasPlot:
        /\b(story|plot|adventure|journey|quest|happened|occurred)\b/gi.test(
          text,
        ),
      hasSettings:
        /\b(in\s+a|at\s+the|forest|castle|city|place|location)\b/gi.test(text),
      timeframe: this.detectTimeframe(text),
    };
  }

  private generateVisualSuggestions(
    contentType: ContentType,
    themes: SemanticTheme[],
    emotionalTone: EnhancedContentAnalysis['emotionalTone'],
  ): EnhancedContentAnalysis['visualSuggestions'] {
    const suggestions = {
      artStyle: 'abstract expressionism',
      composition: 'dynamic and flowing',
      colorMood: 'vibrant and energetic',
      symbolism: [] as string[],
    };

    // Adjust based on content type
    switch (contentType.type) {
      case 'inspirational':
        suggestions.artStyle = 'uplifting conceptual art';
        suggestions.composition = 'ascending and expansive';
        suggestions.colorMood = 'bright and optimistic';
        break;
      case 'philosophical':
        suggestions.artStyle = 'contemplative surrealism';
        suggestions.composition = 'balanced and thoughtful';
        suggestions.colorMood = 'deep and contemplative';
        break;
      case 'abstract':
        suggestions.artStyle = 'pure abstraction';
        suggestions.composition = 'flowing and organic';
        suggestions.colorMood = 'expressive and bold';
        break;
    }

    // Add symbolism from themes
    themes.slice(0, 3).forEach(theme => {
      suggestions.symbolism.push(...theme.visualMetaphors.slice(0, 2));
    });

    return suggestions;
  }

  private calculateConceptWeight(concept: string, text: string): number {
    const regex = new RegExp(`\\b${concept}\\w*\\b`, 'gi');
    const matches = text.match(regex);
    const frequency = matches ? matches.length : 0;

    // Base weight + frequency bonus + position bonus (concepts near beginning get higher weight)
    const position = text.indexOf(concept.toLowerCase()) / text.length;
    const positionBonus = position < 0.3 ? 0.5 : 0;

    return 1 + frequency * 0.5 + positionBonus;
  }

  private findContext(content: string, concept: string): string[] {
    const sentences = content.split(/[.!?]+/);
    const context: string[] = [];

    sentences.forEach(sentence => {
      if (sentence.toLowerCase().includes(concept.toLowerCase())) {
        context.push(sentence.trim());
      }
    });

    return context.slice(0, 2);
  }

  private generateSymbolicElement(concept: string): string {
    const symbolMap: { [key: string]: string } = {
      freedom: 'soaring eagle',
      peace: 'dove with olive branch',
      strength: 'mighty oak tree',
      wisdom: 'ancient owl',
      love: 'intertwined hearts',
      growth: 'blooming lotus',
      courage: 'roaring lion',
      hope: 'rising phoenix',
    };

    return symbolMap[concept] || `abstract representation of ${concept}`;
  }

  private detectTimeframe(
    text: string,
  ): 'present' | 'past' | 'future' | 'timeless' {
    if (/\b(was|were|had|did|happened|once|ago|yesterday)\b/gi.test(text)) {
      return 'past';
    } else if (/\b(will|shall|future|tomorrow|next|going to)\b/gi.test(text)) {
      return 'future';
    } else if (/\b(is|are|now|today|currently|present)\b/gi.test(text)) {
      return 'present';
    } else {
      return 'timeless';
    }
  }
}

export const enhancedContentAnalyzer = new EnhancedContentAnalyzer();
