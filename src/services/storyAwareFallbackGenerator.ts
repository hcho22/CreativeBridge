/**
 * Story-Aware Fallback Generator
 * 
 * Implements intelligent story generation fallbacks that maintain context and narrative flow
 * Task 6.1: Context-Aware Error Handling - Story-aware fallback generation
 */

import { structuredLogger } from '../utils/logger';
import { StoryRequest, StoryResponse, GradeLevel } from '../types/story';
import { StoryContext, ContextualFallbackResult, ErrorRecoveryContext } from './contextualFallback';

interface FallbackTemplate {
  id: string;
  gradeLevel: GradeLevel;
  category: 'adventure' | 'friendship' | 'mystery' | 'family' | 'learning' | 'generic';
  templates: {
    continuation: string[];
    transition: string[];
    resolution: string[];
  };
  contextAdaptations: {
    requiresCharacter: boolean;
    requiresSetting: boolean;
    adaptToTone: boolean;
    preserveTense: boolean;
  };
}

interface StoryGenerationPattern {
  pattern: string;
  gradeLevel: GradeLevel;
  successRate: number;
  avgQualityScore: number;
  contextPreservation: number;
  usageCount: number;
}

interface AdaptiveParameters {
  creativity: number; // 0-1
  safety: number; // 0-1
  continuity: number; // 0-1
  complexity: number; // 0-1
}

export class StoryAwareFallbackGenerator {
  private fallbackTemplates: Map<string, FallbackTemplate[]> = new Map();
  private successPatterns: Map<string, StoryGenerationPattern[]> = new Map();
  private adaptiveCache: Map<string, string> = new Map();
  private qualityThresholds: Record<GradeLevel, number>;

  constructor() {
    this.initializeFallbackTemplates();
    this.initializeSuccessPatterns();
    this.qualityThresholds = {
      'K-2': 0.7,
      '3-5': 0.75,
      '6-8': 0.8,
      'Grade3': 0.75
    };
  }

  /**
   * Generate story-aware fallback content based on context and error type
   */
  public async generateContextAwareFallback(
    recoveryContext: ErrorRecoveryContext
  ): Promise<ContextualFallbackResult> {
    try {
      structuredLogger.info('Generating story-aware fallback', {
        gradeLevel: recoveryContext.originalRequest.gradeLevel,
        hasContext: !!recoveryContext.storyContext,
        attemptNumber: recoveryContext.attemptNumber,
        errorType: recoveryContext.errorType
      });

      const storyContext = recoveryContext.storyContext;
      const gradeLevel = recoveryContext.originalRequest.gradeLevel;
      
      // Analyze the optimal fallback strategy
      const strategy = this.selectOptimalStrategy(recoveryContext);
      
      // Generate fallback content based on strategy
      let fallbackContent: string;
      let contextPreservationScore: number;
      let qualityScore: number;
      
      switch (strategy) {
        case 'contextual_template':
          ({ content: fallbackContent, contextScore: contextPreservationScore, quality: qualityScore } = 
            await this.generateContextualTemplate(storyContext, recoveryContext));
          break;
          
        case 'pattern_based':
          ({ content: fallbackContent, contextScore: contextPreservationScore, quality: qualityScore } = 
            await this.generatePatternBased(storyContext, recoveryContext));
          break;
          
        case 'adaptive_generation':
          ({ content: fallbackContent, contextScore: contextPreservationScore, quality: qualityScore } = 
            await this.generateAdaptive(storyContext, recoveryContext));
          break;
          
        default:
          ({ content: fallbackContent, contextScore: contextPreservationScore, quality: qualityScore } = 
            await this.generateBasicFallback(gradeLevel));
      }

      // Apply post-processing for quality enhancement
      const enhancedContent = await this.enhanceContentQuality(
        fallbackContent, 
        storyContext, 
        gradeLevel
      );

      // Calculate seamless experience score
      const seamless = this.calculateSeamlessScore(
        enhancedContent, 
        storyContext, 
        recoveryContext
      ) > 0.75;

      // Generate recommendations
      const recommendations = this.generateRecommendations(
        strategy, 
        contextPreservationScore, 
        qualityScore,
        recoveryContext
      );

      const result: ContextualFallbackResult = {
        story: enhancedContent,
        preservedContext: contextPreservationScore > 0.6,
        contextPreservationScore,
        fallbackStrategy: strategy,
        qualityScore,
        seamless,
        continuityMaintained: contextPreservationScore > 0.7,
        recommendations
      };

      // Learn from this generation for future improvements
      await this.updateGenerationPatterns(result, recoveryContext);

      structuredLogger.info('Story-aware fallback generation completed', {
        strategy,
        contentLength: enhancedContent.length,
        contextScore: contextPreservationScore,
        qualityScore,
        seamless
      });

      return result;
    } catch (error) {
      structuredLogger.error('Story-aware fallback generation failed', {}, error as Error);
      
      // Emergency fallback to basic template
      return this.generateEmergencyFallback(recoveryContext.originalRequest.gradeLevel);
    }
  }

  /**
   * Pre-generate fallback content for high-risk scenarios
   */
  public async preGenerateFallbacks(
    request: StoryRequest,
    storyContext?: StoryContext,
    riskFactors?: string[]
  ): Promise<Map<string, string>> {
    try {
      const preGeneratedContent = new Map<string, string>();
      const gradeLevel = request.gradeLevel;

      // Generate fallbacks for common error scenarios
      const scenarios = ['timeout', 'rate_limit', 'network_error', 'service_unavailable'];
      
      for (const scenario of scenarios) {
        const mockRecoveryContext: ErrorRecoveryContext = {
          originalRequest: request,
          storyContext: storyContext || null,
          errorType: scenario as any,
          errorMessage: `Mock ${scenario} for pre-generation`,
          attemptNumber: 1,
          previousFailures: [],
          userExperienceState: {
            isFirstInteraction: false,
            sessionDuration: 300000, // 5 minutes
            previousSuccesses: 3,
            consecutiveFailures: 0
          }
        };

        try {
          const result = await this.generateContextAwareFallback(mockRecoveryContext);
          preGeneratedContent.set(scenario, result.story);
        } catch (error) {
          structuredLogger.warn(`Failed to pre-generate fallback for ${scenario}`, error as Error);
        }
      }

      structuredLogger.info('Pre-generated fallbacks completed', {
        scenariosGenerated: preGeneratedContent.size,
        gradeLevel
      });

      return preGeneratedContent;
    } catch (error) {
      structuredLogger.error('Pre-generation failed', {}, error as Error);
      return new Map();
    }
  }

  // Private implementation methods

  private selectOptimalStrategy(context: ErrorRecoveryContext): string {
    const hasRichContext = context.storyContext && 
      (context.storyContext.characters.length > 0 || context.storyContext.settings.length > 0);
    
    const isHighAttempt = context.attemptNumber > 2;
    const isQuickRecovery = context.errorType === 'SKILL_TIMEOUT' || context.errorType === 'RATE_LIMIT_EXCEEDED';
    
    if (isHighAttempt) {
      return 'basic_template';
    }
    
    if (hasRichContext && !isQuickRecovery) {
      return 'contextual_template';
    }
    
    if (hasRichContext) {
      return 'pattern_based';
    }
    
    const hasSuccessHistory = context.userExperienceState.previousSuccesses > 0;
    if (hasSuccessHistory) {
      return 'adaptive_generation';
    }
    
    return 'basic_template';
  }

  private async generateContextualTemplate(
    storyContext: StoryContext | null,
    recoveryContext: ErrorRecoveryContext
  ): Promise<{ content: string; contextScore: number; quality: number }> {
    if (!storyContext) {
      return this.generateBasicFallback(recoveryContext.originalRequest.gradeLevel);
    }

    const gradeLevel = recoveryContext.originalRequest.gradeLevel;
    const templates = this.getTemplatesForGradeLevel(gradeLevel);
    
    // Select template based on story context
    const selectedTemplate = this.selectContextualTemplate(templates, storyContext);
    
    // Adapt template to story context
    const adaptedContent = this.adaptTemplateToContext(selectedTemplate, storyContext);
    
    // Calculate context preservation score
    const contextScore = this.calculateContextPreservation(adaptedContent, storyContext);
    
    // Calculate quality score
    const quality = this.assessContentQuality(adaptedContent, gradeLevel);
    
    return {
      content: adaptedContent,
      contextScore,
      quality
    };
  }

  private async generatePatternBased(
    storyContext: StoryContext | null,
    recoveryContext: ErrorRecoveryContext
  ): Promise<{ content: string; contextScore: number; quality: number }> {
    const gradeLevel = recoveryContext.originalRequest.gradeLevel;
    const patterns = this.getSuccessfulPatterns(gradeLevel);
    
    if (patterns.length === 0) {
      return this.generateBasicFallback(gradeLevel);
    }

    // Select best pattern based on context similarity
    const selectedPattern = this.selectBestPattern(patterns, storyContext);
    
    // Generate content based on pattern
    const content = this.generateFromPattern(selectedPattern, storyContext);
    
    const contextScore = storyContext ? this.calculateContextPreservation(content, storyContext) : 0.3;
    const quality = this.assessContentQuality(content, gradeLevel);
    
    return { content, contextScore, quality };
  }

  private async generateAdaptive(
    storyContext: StoryContext | null,
    recoveryContext: ErrorRecoveryContext
  ): Promise<{ content: string; contextScore: number; quality: number }> {
    const gradeLevel = recoveryContext.originalRequest.gradeLevel;
    
    // Calculate adaptive parameters based on context and error history
    const parameters = this.calculateAdaptiveParameters(storyContext, recoveryContext);
    
    // Generate content using adaptive approach
    const content = this.generateAdaptiveContent(parameters, storyContext, gradeLevel);
    
    const contextScore = storyContext ? this.calculateContextPreservation(content, storyContext) : 0.4;
    const quality = this.assessContentQuality(content, gradeLevel);
    
    return { content, contextScore, quality };
  }

  private async generateBasicFallback(gradeLevel: GradeLevel): Promise<{ content: string; contextScore: number; quality: number }> {
    const basicTemplates = {
      'K-2': [
        "Something wonderful happened next.",
        "The adventure continued in a magical way.",
        "A new friend appeared to help."
      ],
      '3-5': [
        "The story took an unexpected turn.",
        "A new challenge appeared that would test their courage.",
        "Something important was about to be discovered."
      ],
      '6-8': [
        "The situation became more complex as new elements emerged.",
        "A crucial moment arrived that would change everything.",
        "An unexpected revelation shifted their understanding."
      ],
      'Grade3': [
        "The story continued with new discoveries.",
        "An interesting challenge presented itself.",
        "Something surprising was about to happen."
      ]
    };

    const templates = basicTemplates[gradeLevel];
    const content = templates[Math.floor(Math.random() * templates.length)];
    
    return {
      content,
      contextScore: 0.2, // Low context preservation for basic fallback
      quality: 0.6 // Moderate quality
    };
  }

  private getTemplatesForGradeLevel(gradeLevel: GradeLevel): FallbackTemplate[] {
    return this.fallbackTemplates.get(gradeLevel) || [];
  }

  private selectContextualTemplate(templates: FallbackTemplate[], context: StoryContext): FallbackTemplate {
    // Score templates based on context compatibility
    const scoredTemplates = templates.map(template => {
      let score = 0;
      
      // Character compatibility
      if (template.contextAdaptations.requiresCharacter && context.characters.length > 0) {
        score += 30;
      }
      
      // Setting compatibility
      if (template.contextAdaptations.requiresSetting && context.settings.length > 0) {
        score += 25;
      }
      
      // Tone compatibility
      if (template.contextAdaptations.adaptToTone) {
        score += 20;
      }
      
      // Tense compatibility
      if (template.contextAdaptations.preserveTense) {
        score += 15;
      }
      
      // Category matching
      if (context.themes.some(theme => theme === template.category)) {
        score += 25;
      }
      
      return { template, score };
    });

    // Return highest scoring template, or first one if none score well
    scoredTemplates.sort((a, b) => b.score - a.score);
    return scoredTemplates[0]?.template || templates[0];
  }

  private adaptTemplateToContext(template: FallbackTemplate, context: StoryContext): string {
    const templates = this.selectTemplateType(template, context);
    let selectedTemplate = templates[Math.floor(Math.random() * templates.length)];

    // Replace placeholders with context information
    if (context.characters.length > 0) {
      selectedTemplate = selectedTemplate.replace(/{character}/g, context.characters[0]);
      selectedTemplate = selectedTemplate.replace(/{characters}/g, 
        context.characters.slice(0, 2).join(' and '));
    }

    if (context.settings.length > 0) {
      selectedTemplate = selectedTemplate.replace(/{setting}/g, 
        context.settings[context.settings.length - 1]);
    }

    if (context.continuityMarkers.activeConflict) {
      selectedTemplate = selectedTemplate.replace(/{conflict}/g, 
        context.continuityMarkers.activeConflict);
    }

    // Adapt tense if needed
    if (template.contextAdaptations.preserveTense && context.tense === 'present') {
      selectedTemplate = this.convertToPresentTense(selectedTemplate);
    }

    return selectedTemplate;
  }

  private selectTemplateType(template: FallbackTemplate, context: StoryContext): string[] {
    const progressPercentage = context.narrative.progressPercentage;
    
    if (progressPercentage < 30) {
      return template.templates.continuation;
    } else if (progressPercentage < 80) {
      return [...template.templates.continuation, ...template.templates.transition];
    } else {
      return template.templates.resolution;
    }
  }

  private convertToPresentTense(text: string): string {
    // Simple present tense conversion (basic implementation)
    return text
      .replace(/\bwent\b/g, 'goes')
      .replace(/\bwas\b/g, 'is')
      .replace(/\bwere\b/g, 'are')
      .replace(/\bhad\b/g, 'has')
      .replace(/\bdid\b/g, 'does')
      .replace(/\bsaid\b/g, 'says');
  }

  private getSuccessfulPatterns(gradeLevel: GradeLevel): StoryGenerationPattern[] {
    return this.successPatterns.get(gradeLevel) || [];
  }

  private selectBestPattern(patterns: StoryGenerationPattern[], context: StoryContext | null): StoryGenerationPattern {
    if (!context) {
      return patterns.sort((a, b) => b.successRate - a.successRate)[0];
    }

    // Select pattern with highest combined score of success rate and context preservation
    return patterns.sort((a, b) => {
      const scoreA = a.successRate * 0.6 + a.contextPreservation * 0.4;
      const scoreB = b.successRate * 0.6 + b.contextPreservation * 0.4;
      return scoreB - scoreA;
    })[0];
  }

  private generateFromPattern(pattern: StoryGenerationPattern, context: StoryContext | null): string {
    // Use pattern as base and adapt with context
    let content = pattern.pattern;
    
    if (context) {
      // Apply basic context adaptations
      content = this.applyBasicContextAdaptations(content, context);
    }
    
    return content;
  }

  private calculateAdaptiveParameters(
    context: StoryContext | null, 
    recoveryContext: ErrorRecoveryContext
  ): AdaptiveParameters {
    const baseParams = { creativity: 0.6, safety: 0.9, continuity: 0.7, complexity: 0.5 };
    
    // Adjust based on attempt number
    if (recoveryContext.attemptNumber > 1) {
      baseParams.creativity *= 0.8; // Reduce creativity for stability
      baseParams.safety += 0.05; // Increase safety
      baseParams.continuity += 0.1; // Prioritize continuity
    }
    
    // Adjust based on user experience state
    if (recoveryContext.userExperienceState.consecutiveFailures > 0) {
      baseParams.complexity *= 0.7; // Reduce complexity
      baseParams.safety += 0.05; // Increase safety
    }
    
    // Grade level adjustments
    switch (recoveryContext.originalRequest.gradeLevel) {
      case 'K-2':
        baseParams.complexity = 0.3;
        baseParams.safety = 0.95;
        break;
      case '6-8':
        baseParams.complexity = 0.7;
        baseParams.creativity = 0.8;
        break;
    }
    
    return baseParams;
  }

  private generateAdaptiveContent(
    parameters: AdaptiveParameters,
    context: StoryContext | null,
    gradeLevel: GradeLevel
  ): string {
    // Use parameters to guide content generation
    const templates = this.getAdaptiveTemplates(parameters, gradeLevel);
    let content = templates[Math.floor(Math.random() * templates.length)];
    
    if (context) {
      content = this.applyBasicContextAdaptations(content, context);
    }
    
    return content;
  }

  private getAdaptiveTemplates(parameters: AdaptiveParameters, gradeLevel: GradeLevel): string[] {
    const creativity = parameters.creativity;
    const complexity = parameters.complexity;
    
    const templates: string[] = [];
    
    if (creativity > 0.7) {
      templates.push(
        "An incredible adventure was about to unfold.",
        "Something extraordinary caught their attention."
      );
    }
    
    if (complexity > 0.6) {
      templates.push(
        "The situation became more intricate as multiple factors converged.",
        "A complex challenge emerged that required careful consideration."
      );
    } else {
      templates.push(
        "Something simple but important happened.",
        "A clear path forward appeared."
      );
    }
    
    // Ensure at least one template is available
    if (templates.length === 0) {
      templates.push("The story continued in an interesting way.");
    }
    
    return templates;
  }

  private applyBasicContextAdaptations(content: string, context: StoryContext): string {
    // Apply basic context-aware adaptations
    if (context.characters.length > 0) {
      const character = context.characters[0];
      content = content.replace(/they/g, character);
      content = content.replace(/them/g, character);
    }
    
    if (context.settings.length > 0) {
      const setting = context.settings[context.settings.length - 1];
      content = content.replace(/the place/g, setting);
      content = content.replace(/here/g, `in the ${setting}`);
    }
    
    return content;
  }

  private calculateContextPreservation(content: string, context: StoryContext): number {
    let score = 0;
    const maxScore = 100;
    
    // Character preservation
    if (context.characters.length > 0) {
      const characterMentioned = context.characters.some(char => 
        content.toLowerCase().includes(char.toLowerCase())
      );
      if (characterMentioned) score += 30;
    }
    
    // Setting preservation
    if (context.settings.length > 0) {
      const settingMentioned = context.settings.some(setting => 
        content.toLowerCase().includes(setting.toLowerCase())
      );
      if (settingMentioned) score += 25;
    }
    
    // Tone preservation
    if (context.tone !== 'neutral') {
      const toneWords = this.getToneWords(context.tone);
      const tonePreserved = toneWords.some(word => 
        content.toLowerCase().includes(word)
      );
      if (tonePreserved) score += 20;
    }
    
    // Theme preservation
    if (context.themes.length > 0) {
      const themeWords = this.getThemeWords(context.themes);
      const themePreserved = themeWords.some(word => 
        content.toLowerCase().includes(word)
      );
      if (themePreserved) score += 25;
    }
    
    return Math.min(maxScore, score);
  }

  private getToneWords(tone: string): string[] {
    const toneMap: Record<string, string[]> = {
      'happy': ['joy', 'cheerful', 'bright', 'wonderful'],
      'sad': ['sad', 'somber', 'melancholy'],
      'exciting': ['thrilling', 'amazing', 'incredible'],
      'mysterious': ['mysterious', 'intriguing', 'curious']
    };
    
    return toneMap[tone] || [];
  }

  private getThemeWords(themes: string[]): string[] {
    const themeMap: Record<string, string[]> = {
      'friendship': ['friend', 'together', 'help'],
      'adventure': ['journey', 'explore', 'discover'],
      'family': ['family', 'home', 'love'],
      'courage': ['brave', 'courage', 'strength'],
      'learning': ['learn', 'discover', 'understand']
    };
    
    return themes.flatMap(theme => themeMap[theme] || []);
  }

  private assessContentQuality(content: string, gradeLevel: GradeLevel): number {
    let score = 50; // Base score
    
    // Length appropriateness
    const words = content.split(/\s+/).length;
    const optimalLength = this.getOptimalLength(gradeLevel);
    
    if (Math.abs(words - optimalLength) < optimalLength * 0.3) {
      score += 20;
    }
    
    // Readability (simple heuristic)
    const avgWordLength = content.split(/\s+/).reduce((sum, word) => sum + word.length, 0) / words;
    const readabilityScore = this.calculateReadabilityScore(avgWordLength, gradeLevel);
    score += readabilityScore;
    
    // Engagement factors
    const hasDialogue = content.includes('"') || content.includes("'");
    const hasAction = /\b(ran|jumped|walked|went|came|moved)\b/.test(content);
    
    if (hasDialogue) score += 10;
    if (hasAction) score += 10;
    
    return Math.min(100, Math.max(0, score));
  }

  private getOptimalLength(gradeLevel: GradeLevel): number {
    const lengthMap: Record<GradeLevel, number> = {
      'K-2': 15,
      '3-5': 25,
      '6-8': 35,
      'Grade3': 20
    };
    
    return lengthMap[gradeLevel] || 25;
  }

  private calculateReadabilityScore(avgWordLength: number, gradeLevel: GradeLevel): number {
    const targetLength: Record<GradeLevel, number> = {
      'K-2': 4.5,
      '3-5': 5.5,
      '6-8': 6.5,
      'Grade3': 5.0
    };
    
    const target = targetLength[gradeLevel] || 5.5;
    const diff = Math.abs(avgWordLength - target);
    
    return Math.max(0, 20 - (diff * 5));
  }

  private async enhanceContentQuality(
    content: string,
    context: StoryContext | null,
    gradeLevel: GradeLevel
  ): Promise<string> {
    // Apply post-processing enhancements
    let enhanced = content;
    
    // Ensure proper capitalization
    enhanced = enhanced.charAt(0).toUpperCase() + enhanced.slice(1);
    
    // Ensure proper ending punctuation
    if (!/[.!?]$/.test(enhanced)) {
      enhanced += '.';
    }
    
    // Grade-level specific enhancements
    if (gradeLevel === 'K-2') {
      // Simplify language for younger readers
      enhanced = this.simplifyLanguage(enhanced);
    }
    
    return enhanced;
  }

  private simplifyLanguage(content: string): string {
    // Simple language simplification
    return content
      .replace(/\bobserved\b/g, 'saw')
      .replace(/\bdiscovered\b/g, 'found')
      .replace(/\bexamined\b/g, 'looked at')
      .replace(/\bproceed\b/g, 'go');
  }

  private calculateSeamlessScore(
    content: string,
    context: StoryContext | null,
    recoveryContext: ErrorRecoveryContext
  ): number {
    let score = 0.5; // Base seamlessness
    
    // Context continuity contributes to seamlessness
    if (context) {
      const contextScore = this.calculateContextPreservation(content, context) / 100;
      score += contextScore * 0.3;
    }
    
    // Quality contributes to seamlessness
    const quality = this.assessContentQuality(content, recoveryContext.originalRequest.gradeLevel) / 100;
    score += quality * 0.2;
    
    // Lower attempt numbers are more seamless
    score -= (recoveryContext.attemptNumber - 1) * 0.1;
    
    return Math.max(0, Math.min(1, score));
  }

  private generateRecommendations(
    strategy: string,
    contextScore: number,
    qualityScore: number,
    recoveryContext: ErrorRecoveryContext
  ): string[] {
    const recommendations: string[] = [];
    
    recommendations.push(`Used ${strategy} strategy for recovery`);
    
    if (contextScore < 50) {
      recommendations.push('Context preservation could be improved');
    }
    
    if (qualityScore < 60) {
      recommendations.push('Content quality enhancement needed');
    }
    
    if (recoveryContext.attemptNumber > 1) {
      recommendations.push('Multiple attempts detected - consider system optimization');
    }
    
    return recommendations;
  }

  private async updateGenerationPatterns(
    result: ContextualFallbackResult,
    recoveryContext: ErrorRecoveryContext
  ): Promise<void> {
    // Update success patterns based on result quality
    const gradeLevel = recoveryContext.originalRequest.gradeLevel;
    const patterns = this.successPatterns.get(gradeLevel) || [];
    
    const newPattern: StoryGenerationPattern = {
      pattern: result.story,
      gradeLevel,
      successRate: result.qualityScore / 100,
      avgQualityScore: result.qualityScore,
      contextPreservation: result.contextPreservationScore,
      usageCount: 1
    };
    
    patterns.push(newPattern);
    
    // Keep only top patterns (limit to 50)
    patterns.sort((a, b) => (b.successRate + b.contextPreservation) / 2 - (a.successRate + a.contextPreservation) / 2);
    this.successPatterns.set(gradeLevel, patterns.slice(0, 50));
  }

  private generateEmergencyFallback(gradeLevel: GradeLevel): ContextualFallbackResult {
    const emergencyContent = "The story continued...";
    
    return {
      story: emergencyContent,
      preservedContext: false,
      contextPreservationScore: 0,
      fallbackStrategy: 'emergency',
      qualityScore: 30,
      seamless: false,
      continuityMaintained: false,
      recommendations: ['Emergency fallback used', 'System requires attention']
    };
  }

  private initializeFallbackTemplates(): void {
    // Initialize templates for each grade level
    const k2Templates: FallbackTemplate[] = [
      {
        id: 'k2_adventure',
        gradeLevel: 'K-2',
        category: 'adventure',
        templates: {
          continuation: [
            "{character} found something special.",
            "A friendly animal came to help {character}.",
            "{character} discovered a magical {setting}."
          ],
          transition: [
            "Then something wonderful happened.",
            "{character} had a great idea.",
            "The adventure was just beginning."
          ],
          resolution: [
            "{character} felt happy about what they learned.",
            "Everyone became good friends.",
            "The adventure ended with smiles."
          ]
        },
        contextAdaptations: {
          requiresCharacter: true,
          requiresSetting: true,
          adaptToTone: true,
          preserveTense: true
        }
      }
    ];

    const grades35Templates: FallbackTemplate[] = [
      {
        id: '35_mystery',
        gradeLevel: '3-5',
        category: 'mystery',
        templates: {
          continuation: [
            "{character} noticed something strange about {setting}.",
            "A mysterious clue appeared that would help solve the puzzle.",
            "{character} and their friends decided to investigate further."
          ],
          transition: [
            "The mystery deepened as new evidence emerged.",
            "{character} realized they needed to think differently.",
            "An unexpected ally offered to help with the investigation."
          ],
          resolution: [
            "The pieces of the puzzle finally came together.",
            "{character} solved the mystery through careful thinking.",
            "Everyone learned something important from this adventure."
          ]
        },
        contextAdaptations: {
          requiresCharacter: true,
          requiresSetting: true,
          adaptToTone: true,
          preserveTense: true
        }
      }
    ];

    this.fallbackTemplates.set('K-2', k2Templates);
    this.fallbackTemplates.set('3-5', grades35Templates);
    this.fallbackTemplates.set('6-8', grades35Templates); // Reuse for now
    this.fallbackTemplates.set('Grade3', grades35Templates); // Reuse for now
  }

  private initializeSuccessPatterns(): void {
    // Initialize with some basic successful patterns
    const basicPatterns: StoryGenerationPattern[] = [
      {
        pattern: "The character looked around and made an important discovery.",
        gradeLevel: 'K-2',
        successRate: 0.8,
        avgQualityScore: 75,
        contextPreservation: 60,
        usageCount: 10
      },
      {
        pattern: "A new challenge presented itself that would test their abilities.",
        gradeLevel: '3-5',
        successRate: 0.85,
        avgQualityScore: 80,
        contextPreservation: 70,
        usageCount: 15
      }
    ];

    for (const pattern of basicPatterns) {
      const patterns = this.successPatterns.get(pattern.gradeLevel) || [];
      patterns.push(pattern);
      this.successPatterns.set(pattern.gradeLevel, patterns);
    }
  }
}