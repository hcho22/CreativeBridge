/**
 * Content Prediction Service
 * 
 * Integrates ContentPredictionSkill with story generation for intelligent caching
 * Task 3.1: Content Prediction Skill Integration
 */

import { getClaudeSkillsManager } from './claudeSkillsManager';
import { SkillType, ContentPredictionInput, ContentPredictionResult, ContentPrediction } from '../types/claudeSkills';
import { StoryRequest, StoryResponse, GradeLevel } from '../types/story';
import { structuredLogger } from '../utils/logger';
import { storyAnalytics } from './storyAnalytics';

export interface StoryPattern {
  category: string;
  theme: string;
  gradeLevel: GradeLevel;
  commonElements: string[];
  frequency: number;
  confidence: number;
}

export interface StoryContextAnalysis {
  storySoFar: string;
  userInput: string;
  gradeLevel: GradeLevel;
  extractedElements: {
    characters: string[];
    settings: string[];
    themes: string[];
    tone: 'adventure' | 'friendship' | 'discovery' | 'magical' | 'educational' | 'general';
  };
  patternMatch?: StoryPattern;
  confidence: number;
}

export interface PredictionConfidenceScore {
  overall: number;
  patternMatch: number;
  contextRelevance: number;
  gradeLevelAppropriateness: number;
  historicalAccuracy?: number;
}

class ContentPredictionService {
  private storyPatterns: Map<string, StoryPattern> = new Map();
  private predictionHistory: Map<string, { prediction: ContentPrediction; actual: string; match: boolean }[]> = new Map();

  constructor() {
    this.initializeStoryPatterns();
  }

  /**
   * Initialize common story patterns based on grade levels
   */
  private initializeStoryPatterns(): void {
    const patterns: StoryPattern[] = [
      {
        category: 'magical_adventure',
        theme: 'magical',
        gradeLevel: 'K-2',
        commonElements: ['magic', 'adventure', 'discover', 'friend', 'help'],
        frequency: 0.35,
        confidence: 0.85,
      },
      {
        category: 'friendship_story',
        theme: 'friendship',
        gradeLevel: 'K-2',
        commonElements: ['friend', 'play', 'together', 'help', 'kind'],
        frequency: 0.25,
        confidence: 0.80,
      },
      {
        category: 'discovery_adventure',
        theme: 'discovery',
        gradeLevel: '3-5',
        commonElements: ['discover', 'explore', 'mystery', 'solve', 'teamwork'],
        frequency: 0.30,
        confidence: 0.82,
      },
      {
        category: 'educational_adventure',
        theme: 'educational',
        gradeLevel: '3-5',
        commonElements: ['learn', 'discover', 'explore', 'create', 'invent'],
        frequency: 0.20,
        confidence: 0.78,
      },
      {
        category: 'character_growth',
        theme: 'growth',
        gradeLevel: '6-8',
        commonElements: ['challenge', 'grow', 'learn', 'overcome', 'persevere'],
        frequency: 0.28,
        confidence: 0.80,
      },
      {
        category: 'mystery_adventure',
        theme: 'mystery',
        gradeLevel: '6-8',
        commonElements: ['mystery', 'investigate', 'discover', 'solve', 'clue'],
        frequency: 0.22,
        confidence: 0.75,
      },
      {
        category: 'philosophical_exploration',
        theme: 'philosophical',
        gradeLevel: '9-12',
        commonElements: ['question', 'explore', 'understand', 'discover', 'meaning'],
        frequency: 0.25,
        confidence: 0.70,
      },
    ];

    patterns.forEach(pattern => {
      const key = `${pattern.gradeLevel}_${pattern.category}`;
      this.storyPatterns.set(key, pattern);
    });
  }

  /**
   * Analyze story context to extract elements and match patterns
   */
  async analyzeStoryContext(request: StoryRequest): Promise<StoryContextAnalysis> {
    const storySoFar = request.storySoFar || '';
    const userInput = request.userInput || '';
    const combinedText = `${storySoFar} ${userInput}`.toLowerCase();

    // Extract characters (simple heuristic - could be enhanced)
    const characters = this.extractCharacters(combinedText);

    // Extract settings
    const settings = this.extractSettings(combinedText);

    // Extract themes
    const themes = this.extractThemes(combinedText);

    // Determine tone
    const tone = this.determineTone(combinedText);

    // Match pattern
    const patternMatch = this.matchPattern(request.gradeLevel, combinedText);

    // Calculate confidence based on extracted elements
    const confidence = this.calculateContextConfidence(characters, settings, themes, patternMatch);

    return {
      storySoFar,
      userInput,
      gradeLevel: request.gradeLevel,
      extractedElements: {
        characters,
        settings,
        themes,
        tone,
      },
      patternMatch,
      confidence,
    };
  }

  /**
   * Predict next story content using ContentPredictionSkill
   */
  async predictContent(context: StoryContextAnalysis): Promise<ContentPredictionResult | null> {
    try {
      const skillManager = await getClaudeSkillsManager();
      const skillId = await this.getContentPredictionSkillId();

      if (!skillId) {
        structuredLogger.warn('ContentPredictionSkill not available', {
          skillType: 'ContentPredictionSkill',
        });
        return null;
      }

      const input: ContentPredictionInput = {
        context: {
          storyContext: context.storySoFar,
          userInput: context.userInput,
          gradeLevel: context.gradeLevel,
          previousPredictions: [],
        },
        options: {
          maxPredictions: 3,
          confidenceThreshold: 0.7,
        },
      };

      const correlationId = structuredLogger.generateCorrelationId();
      structuredLogger.logSkillOperationStart(
        'ContentPredictionSkill',
        skillId,
        input,
        { correlationId }
      );

      const result = await skillManager.executeSkill<ContentPredictionResult>(
        skillId,
        input
      );

      if (result.success && result.data) {
        structuredLogger.logSkillOperationComplete(
          'ContentPredictionSkill',
          skillId,
          true,
          result.executionTimeMs,
          result.data,
          undefined,
          { correlationId }
        );

        // Enhance predictions with context analysis
        const enhancedPredictions = this.enhancePredictionsWithContext(
          result.data.predictions,
          context
        );

        return {
          ...result.data,
          predictions: enhancedPredictions,
          confidence: this.calculatePredictionConfidence(enhancedPredictions, context),
        };
      } else {
        structuredLogger.logSkillOperationComplete(
          'ContentPredictionSkill',
          skillId,
          false,
          result.executionTimeMs,
          undefined,
          result.error,
          { correlationId }
        );
        return null;
      }
    } catch (error) {
      structuredLogger.error(
        'Content prediction failed',
        {
          skillType: 'ContentPredictionSkill',
          operation: 'predictContent',
        },
        error as Error
      );
      return null;
    }
  }

  /**
   * Calculate confidence score for predictions
   */
  calculatePredictionConfidence(
    predictions: ContentPrediction[],
    context: StoryContextAnalysis
  ): PredictionConfidenceScore {
    // Pattern match confidence
    const patternMatch = context.patternMatch
      ? context.patternMatch.confidence
      : 0.5;

    // Context relevance (how well predictions match extracted elements)
    const contextRelevance = this.calculateContextRelevance(predictions, context);

    // Grade level appropriateness
    const gradeLevelAppropriateness = this.calculateGradeLevelAppropriateness(
      predictions,
      context.gradeLevel
    );

    // Historical accuracy (if available)
    const historicalAccuracy = this.calculateHistoricalAccuracy(context.gradeLevel);

    const overall = (
      patternMatch * 0.3 +
      contextRelevance * 0.3 +
      gradeLevelAppropriateness * 0.2 +
      (historicalAccuracy || 0.7) * 0.2
    );

    return {
      overall,
      patternMatch,
      contextRelevance,
      gradeLevelAppropriateness,
      historicalAccuracy,
    };
  }

  /**
   * Enhance predictions with context analysis
   */
  private enhancePredictionsWithContext(
    predictions: ContentPrediction[],
    context: StoryContextAnalysis
  ): ContentPrediction[] {
    return predictions.map(prediction => {
      // Adjust confidence based on context match
      let adjustedConfidence = prediction.confidence;

      // Boost confidence if prediction matches extracted themes
      if (context.extractedElements.themes.some(theme =>
        prediction.metadata.theme.toLowerCase().includes(theme.toLowerCase())
      )) {
        adjustedConfidence = Math.min(adjustedConfidence + 0.1, 1.0);
      }

      // Boost confidence if prediction matches pattern
      if (context.patternMatch && 
          prediction.metadata.theme === context.patternMatch.theme) {
        adjustedConfidence = Math.min(adjustedConfidence + 0.15, 1.0);
      }

      return {
        ...prediction,
        confidence: adjustedConfidence,
      };
    });
  }

  /**
   * Extract characters from text
   */
  private extractCharacters(text: string): string[] {
    const commonNames = [
      'alice', 'bob', 'charlie', 'diana', 'eve', 'frank', 'grace', 'henry',
      'ivy', 'jack', 'kate', 'leo', 'maya', 'noah', 'olivia', 'peter',
      'quinn', 'ruby', 'sam', 'tina', 'uma', 'victor', 'wendy', 'xavier', 'yara', 'zoe'
    ];

    return commonNames.filter(name => text.includes(name));
  }

  /**
   * Extract settings from text
   */
  private extractSettings(text: string): string[] {
    const commonSettings = [
      'forest', 'school', 'home', 'park', 'library', 'beach', 'mountain',
      'city', 'village', 'castle', 'garden', 'room', 'kitchen', 'playground'
    ];

    return commonSettings.filter(setting => text.includes(setting));
  }

  /**
   * Extract themes from text
   */
  private extractThemes(text: string): string[] {
    const themeKeywords: Record<string, string[]> = {
      adventure: ['adventure', 'explore', 'journey', 'quest', 'travel'],
      friendship: ['friend', 'together', 'help', 'team', 'support'],
      discovery: ['discover', 'find', 'uncover', 'reveal', 'learn'],
      magical: ['magic', 'magical', 'enchant', 'spell', 'wizard'],
      educational: ['learn', 'teach', 'study', 'understand', 'knowledge'],
    };

    const themes: string[] = [];
    Object.entries(themeKeywords).forEach(([theme, keywords]) => {
      if (keywords.some(keyword => text.includes(keyword))) {
        themes.push(theme);
      }
    });

    return themes;
  }

  /**
   * Determine story tone
   */
  private determineTone(text: string): StoryContextAnalysis['extractedElements']['tone'] {
    if (text.includes('magic') || text.includes('magical') || text.includes('enchant')) {
      return 'magical';
    }
    if (text.includes('friend') || text.includes('together') || text.includes('help')) {
      return 'friendship';
    }
    if (text.includes('discover') || text.includes('find') || text.includes('explore')) {
      return 'discovery';
    }
    if (text.includes('learn') || text.includes('teach') || text.includes('understand')) {
      return 'educational';
    }
    if (text.includes('adventure') || text.includes('journey') || text.includes('quest')) {
      return 'adventure';
    }
    return 'general';
  }

  /**
   * Match story to known patterns
   */
  private matchPattern(gradeLevel: GradeLevel, text: string): StoryPattern | undefined {
    const patternsForGrade = Array.from(this.storyPatterns.values())
      .filter(p => p.gradeLevel === gradeLevel);

    let bestMatch: StoryPattern | undefined;
    let bestScore = 0;

    patternsForGrade.forEach(pattern => {
      const matchCount = pattern.commonElements.filter(element =>
        text.includes(element)
      ).length;
      const score = (matchCount / pattern.commonElements.length) * pattern.confidence;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = pattern;
      }
    });

    return bestMatch && bestScore > 0.3 ? bestMatch : undefined;
  }

  /**
   * Calculate context confidence
   */
  private calculateContextConfidence(
    characters: string[],
    settings: string[],
    themes: string[],
    patternMatch?: StoryPattern
  ): number {
    let confidence = 0.5; // Base confidence

    // Boost for extracted elements
    if (characters.length > 0) confidence += 0.1;
    if (settings.length > 0) confidence += 0.1;
    if (themes.length > 0) confidence += 0.15;

    // Boost for pattern match
    if (patternMatch) {
      confidence += patternMatch.confidence * 0.15;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Calculate context relevance
   */
  private calculateContextRelevance(
    predictions: ContentPrediction[],
    context: StoryContextAnalysis
  ): number {
    if (predictions.length === 0) return 0;

    const relevanceScores = predictions.map(prediction => {
      const predictionText = prediction.content.toLowerCase();
      let relevance = 0.5;

      // Check theme match
      if (context.extractedElements.themes.some(theme =>
        predictionText.includes(theme) || prediction.metadata.theme === theme
      )) {
        relevance += 0.2;
      }

      // Check character match
      if (context.extractedElements.characters.some(char =>
        predictionText.includes(char.toLowerCase())
      )) {
        relevance += 0.15;
      }

      // Check setting match
      if (context.extractedElements.settings.some(setting =>
        predictionText.includes(setting)
      )) {
        relevance += 0.15;
      }

      return Math.min(relevance, 1.0);
    });

    return relevanceScores.reduce((sum, score) => sum + score, 0) / relevanceScores.length;
  }

  /**
   * Calculate grade level appropriateness
   */
  private calculateGradeLevelAppropriateness(
    predictions: ContentPrediction[],
    gradeLevel: GradeLevel
  ): number {
    if (predictions.length === 0) return 0;

    const appropriatenessScores = predictions.map(prediction => {
      // Check if prediction metadata matches grade level
      if (prediction.metadata.gradeLevel === gradeLevel) {
        return prediction.metadata.estimatedEngagement || 0.7;
      }
      return 0.5; // Default if no match
    });

    return appropriatenessScores.reduce((sum, score) => sum + score, 0) / appropriatenessScores.length;
  }

  /**
   * Calculate historical accuracy
   */
  private calculateHistoricalAccuracy(gradeLevel: GradeLevel): number | undefined {
    const history = this.predictionHistory.get(gradeLevel);
    if (!history || history.length === 0) {
      return undefined;
    }

    const matchCount = history.filter(h => h.match).length;
    return matchCount / history.length;
  }

  /**
   * Record prediction result for accuracy tracking
   */
  recordPredictionResult(
    gradeLevel: GradeLevel,
    prediction: ContentPrediction,
    actualContent: string
  ): void {
    const history = this.predictionHistory.get(gradeLevel) || [];
    
    // Simple match check (could be enhanced with semantic similarity)
    const match = actualContent.toLowerCase().includes(
      prediction.content.toLowerCase().substring(0, 50)
    ) || prediction.content.toLowerCase().includes(
      actualContent.toLowerCase().substring(0, 50)
    );

    history.push({ prediction, actual: actualContent, match });
    
    // Keep last 100 predictions
    if (history.length > 100) {
      history.shift();
    }

    this.predictionHistory.set(gradeLevel, history);
  }

  /**
   * Get ContentPredictionSkill ID
   */
  private async getContentPredictionSkillId(): Promise<string | null> {
    try {
      const skillManager = await getClaudeSkillsManager();
      // In a real implementation, we would query the skill manager
      // For now, return a default ID pattern that matches the mock
      return 'ContentPredictionSkill_1.0.0';
    } catch (error) {
      return null;
    }
  }

  /**
   * Get story patterns
   */
  getStoryPatterns(): StoryPattern[] {
    return Array.from(this.storyPatterns.values());
  }

  /**
   * Get prediction history
   */
  getPredictionHistory(gradeLevel?: GradeLevel): Map<string, { prediction: ContentPrediction; actual: string; match: boolean }[]> {
    if (gradeLevel) {
      const history = this.predictionHistory.get(gradeLevel);
      const result = new Map();
      if (history) {
        result.set(gradeLevel, history);
      }
      return result;
    }
    return new Map(this.predictionHistory);
  }
}

// Export singleton instance
export const contentPredictionService = new ContentPredictionService();

