// Story Service Architecture Interfaces
// Comprehensive interfaces for story generation services

import { GradeLevel } from '../types';

export interface StoryResponse {
  success: boolean;
  story?: string;
  error?: string;
  qualityScore?: number;
  metadata?: {
    gradeLevel: GradeLevel;
    theme?: string;
    genre?: string;
    processingTime?: number;
    fromCache?: boolean;
    fallbackUsed?: boolean;
    consistencyScore?: number;
  };
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  suggestions?: string[];
  confidence?: number;
  flags?: string[];
  appropriatenessScore?: number;
  readabilityScore?: number;
  violenceScore?: number;
  languageScore?: number;
}

export interface StoryContext {
  gradeLevel: GradeLevel;
  storySoFar: string;
  userInput: string;
  sessionId: string;
  challenge?: string;
  theme?: string;
  genre?: string;
  difficulty?: number;
  userPreferences?: {
    voiceEnabled?: boolean;
    complexityLevel?: number;
    contentFilters?: string[];
  };
}

export interface StoryGenerationService {
  generateStoryStarter(
    gradeLevel: GradeLevel,
    genre?: string,
  ): Promise<StoryResponse>;
  continueStory(context: StoryContext): Promise<StoryResponse>;
  validateStoryContent(
    content: string,
    gradeLevel: GradeLevel,
  ): ValidationResult;
  getCachedStory(key: string): StoryResponse | null;
  cacheStory(key: string, story: StoryResponse): void;
  assessQuality(story: string, gradeLevel: GradeLevel): QualityMetrics;
  clearCache(): void;
  getAnalytics(): StoryAnalyticsData;
}

export interface QualityMetrics {
  coherence: number;
  engagement: number;
  appropriateness: number;
  creativity: number;
  overall: number;
}

export interface StoryAnalyticsData {
  totalStories: number;
  completedStories: number;
  averageQualityScore: number;
  cacheHitRate: number;
  errorRate: number;
  userSatisfaction: number;
}

// Enhanced service implementation
export class ComprehensiveStoryService implements StoryGenerationService {
  constructor(
    private cacheService: any,
    private analyticsService: any,
    private contentValidator: any,
    private aiService: any,
  ) {}

  async generateStoryStarter(
    gradeLevel: GradeLevel,
    genre?: string,
  ): Promise<StoryResponse> {
    const cacheKey = `starter:${gradeLevel}:${genre || 'default'}`;

    // Check cache first
    const cached = this.getCachedStory(cacheKey);
    if (cached) {
      this.analyticsService.trackPerformance('cache_hit', { cacheKey });
      return {
        ...cached,
        metadata: {
          ...cached.metadata,
          fromCache: true,
        } as StoryResponse['metadata'],
      };
    }

    this.analyticsService.trackPerformance('cache_miss', { cacheKey });

    try {
      const startTime = Date.now();

      // Generate story using AI service
      const story = await this.aiService.generateStarter(gradeLevel, genre);

      const processingTime = Date.now() - startTime;

      // Validate content
      const validation = this.validateStoryContent(story, gradeLevel);
      if (!validation.isValid) {
        throw new Error(
          `Generated content failed validation: ${validation.errors.join(
            ', ',
          )}`,
        );
      }

      // Assess quality
      const qualityScore = this.assessQuality(story, gradeLevel).overall;

      const response: StoryResponse = {
        success: true,
        story,
        qualityScore,
        metadata: {
          gradeLevel,
          genre,
          processingTime,
          fromCache: false,
          fallbackUsed: false,
        },
      };

      // Cache the response
      this.cacheStory(cacheKey, response);

      return response;
    } catch (error) {
      // Use fallback
      const fallbackStory = this.generateFallbackStarter(gradeLevel);

      return {
        success: true,
        story: fallbackStory,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          gradeLevel,
          genre,
          fallbackUsed: true,
          fromCache: false,
        },
      };
    }
  }

  async continueStory(context: StoryContext): Promise<StoryResponse> {
    const cacheKey = `continue:${this.hashContext(context)}`;

    // Check cache for similar contexts
    const cached = this.getCachedStory(cacheKey);
    if (cached) {
      this.analyticsService.trackPerformance('cache_hit', { cacheKey });
      return {
        ...cached,
        metadata: {
          ...cached.metadata,
          fromCache: true,
        } as StoryResponse['metadata'],
      };
    }

    this.analyticsService.trackPerformance('cache_miss', { cacheKey });

    try {
      // Validate user input first
      const inputValidation = this.validateStoryContent(
        context.userInput,
        context.gradeLevel,
      );
      if (!inputValidation.isValid) {
        return {
          success: false,
          error: 'User input validation failed',
          metadata: {
            gradeLevel: context.gradeLevel,
          },
        };
      }

      const startTime = Date.now();

      // Generate continuation
      const continuation = await this.aiService.continueStory(context);

      const processingTime = Date.now() - startTime;

      // Validate generated content
      const validation = this.validateStoryContent(
        continuation,
        context.gradeLevel,
      );
      if (!validation.isValid) {
        throw new Error(
          `Generated continuation failed validation: ${validation.errors.join(
            ', ',
          )}`,
        );
      }

      // Check consistency with existing story
      const consistencyScore = this.calculateConsistency(
        context.storySoFar,
        continuation,
      );

      const qualityScore = this.assessQuality(
        continuation,
        context.gradeLevel,
      ).overall;

      const response: StoryResponse = {
        success: true,
        story: continuation,
        qualityScore,
        metadata: {
          gradeLevel: context.gradeLevel,
          theme: context.theme,
          genre: context.genre,
          processingTime,
          fromCache: false,
          fallbackUsed: false,
          consistencyScore,
        },
      };

      // Cache the response
      this.cacheStory(cacheKey, response);

      return response;
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Story continuation failed',
        metadata: {
          gradeLevel: context.gradeLevel,
          fallbackUsed: true,
        },
      };
    }
  }

  validateStoryContent(
    content: string,
    gradeLevel: GradeLevel,
  ): ValidationResult {
    return this.contentValidator.validateContent(content, gradeLevel);
  }

  getCachedStory(key: string): StoryResponse | null {
    return this.cacheService.get(key);
  }

  cacheStory(key: string, story: StoryResponse): void {
    this.cacheService.set(key, story);
  }

  assessQuality(story: string, gradeLevel: GradeLevel): QualityMetrics {
    // Implementation would use actual quality assessment logic
    const words = story.split(/\s+/).filter(word => word.length > 0);
    const sentences = story.split(/[.!?]+/).filter(s => s.trim().length > 0);

    // Basic quality metrics
    const avgWordsPerSentence = words.length / Math.max(sentences.length, 1);
    const hasDialogue = story.includes('"') || story.includes("'");
    const hasVariety = sentences.some(s => s.includes('!') || s.includes('?'));

    // Grade level appropriateness
    const gradeExpectations = {
      'K-2': { maxWords: 8, maxWordLength: 5 },
      '3-5': { maxWords: 12, maxWordLength: 6 },
      '6-8': { maxWords: 16, maxWordLength: 7 },
      '9-12': { maxWords: 20, maxWordLength: 8 },
    };

    const expectations = gradeExpectations[gradeLevel];
    const avgWordLength =
      words.reduce((sum, word) => sum + word.length, 0) /
      Math.max(words.length, 1);

    const coherence = Math.min(
      1,
      Math.max(
        0,
        1 - Math.abs(avgWordsPerSentence - expectations.maxWords) / 10,
      ),
    );
    const appropriateness = Math.min(
      1,
      Math.max(0, 1 - Math.abs(avgWordLength - expectations.maxWordLength) / 4),
    );
    const engagement =
      (hasDialogue ? 0.3 : 0) +
      (hasVariety ? 0.3 : 0) +
      (words.length > 20 ? 0.4 : words.length / 50);

    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    const creativity = Math.min(
      1,
      uniqueWords.size / Math.max(words.length * 0.7, 1),
    );

    const overall = (coherence + engagement + appropriateness + creativity) / 4;

    return {
      coherence,
      engagement,
      appropriateness,
      creativity,
      overall,
    };
  }

  clearCache(): void {
    this.cacheService.clear();
  }

  getAnalytics(): StoryAnalyticsData {
    const metrics = this.analyticsService.getMetrics();

    return {
      totalStories: metrics.storyGeneration.totalStories,
      completedStories: metrics.storyGeneration.completedStories,
      averageQualityScore: metrics.storyGeneration.averageQualityScore,
      cacheHitRate: metrics.performance.cacheHitRate,
      errorRate: metrics.storyGeneration.errorRate,
      userSatisfaction: metrics.gradeLevelBreakdown['K-2'].satisfaction, // Simplified
    };
  }

  // Private helper methods
  private hashContext(context: StoryContext): string {
    const key = `${context.gradeLevel}:${context.storySoFar.slice(-100)}:${
      context.userInput
    }`;
    return Buffer.from(key).toString('base64').slice(0, 32);
  }

  private generateFallbackStarter(gradeLevel: GradeLevel): string {
    const fallbacks = {
      'K-2':
        'Once upon a time, there was a friendly animal who loved adventures.',
      '3-5': 'In a magical place, something wonderful was about to happen.',
      '6-8':
        'The mysterious discovery would change everything they thought they knew.',
      '9-12':
        'At the crossroads of destiny, a choice would define their future.',
    };

    return fallbacks[gradeLevel];
  }

  private calculateConsistency(
    existingStory: string,
    continuation: string,
  ): number {
    // Simplified consistency check
    const existingWords = new Set(
      existingStory.toLowerCase().match(/\w+/g) || [],
    );
    const continuationWords = new Set(
      continuation.toLowerCase().match(/\w+/g) || [],
    );

    const overlap = new Set(
      [...existingWords].filter(x => continuationWords.has(x)),
    );
    const union = new Set([...existingWords, ...continuationWords]);

    return union.size > 0 ? overlap.size / union.size : 0;
  }
}

export default StoryGenerationService;
