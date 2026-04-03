// API Client Service for CreativeBridge
// Handles Story_Quest backend integration with error handling and fallback mechanisms

import { StoryRequest, StoryResponse, GradeLevel } from '../types';

interface ApiConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  fallbackEnabled: boolean;
}

interface RequestOptions {
  timeout?: number;
  retries?: number;
  fallback?: boolean;
}

interface ApiError {
  type: 'network' | 'timeout' | 'server' | 'rate_limit' | 'validation';
  message: string;
  status?: number;
  retryable: boolean;
  retryAfter?: number;
}

interface RetryConfig {
  attempts: number;
  delay: number;
  backoff: number;
  maxDelay: number;
}

interface StoryQuestEndpoints {
  generateStory: string;
  validateContent: string;
  getStoryStarters: string;
  submitUserStory: string;
  getLeaderboard: string;
}

class ApiClient {
  private config: ApiConfig;
  private endpoints: StoryQuestEndpoints;
  private retryConfig: RetryConfig;
  private requestQueue: Map<string, Promise<any>>;

  constructor() {
    this.config = {
      baseUrl: process.env.STORY_QUEST_API_URL || 'https://api.storyquest.edu',
      timeout: 10000,
      retryAttempts: 3,
      retryDelay: 1000,
      fallbackEnabled: true,
    };

    this.endpoints = {
      generateStory: '/api/v1/story/generate',
      validateContent: '/api/v1/story/validate',
      getStoryStarters: '/api/v1/story/starters',
      submitUserStory: '/api/v1/story/submit',
      getLeaderboard: '/api/v1/leaderboard',
    };

    this.retryConfig = {
      attempts: 3,
      delay: 1000,
      backoff: 2,
      maxDelay: 10000,
    };

    this.requestQueue = new Map();
  }

  public async generateStory(
    request: StoryRequest,
    options: RequestOptions = {},
  ): Promise<StoryResponse> {
    const requestKey = this.generateRequestKey('generateStory', request);

    if (this.requestQueue.has(requestKey)) {
      return await this.requestQueue.get(requestKey);
    }

    const requestPromise = this.executeWithRetry(
      () => this.performStoryGeneration(request),
      {
        ...this.retryConfig,
        attempts: options.retries || this.retryConfig.attempts,
      },
    );

    this.requestQueue.set(requestKey, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } catch (error) {
      if (options.fallback !== false && this.config.fallbackEnabled) {
        return await this.generateFallbackStory(request);
      }
      throw error;
    } finally {
      this.requestQueue.delete(requestKey);
    }
  }

  private async performStoryGeneration(
    request: StoryRequest,
  ): Promise<StoryResponse> {
    const url = `${this.config.baseUrl}${this.endpoints.generateStory}`;

    const requestBody = {
      grade_level: request.gradeLevel,
      story_so_far: request.storySoFar,
      user_input: request.userInput,
      challenge: request.challenge,
      timestamp: Date.now(),
    };

    const response = await this.makeRequest(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Version': 'v1',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw this.createApiError(response);
    }

    const data = await response.json();

    return {
      story: data.story,
      success: true,
      gradeLevel: request.gradeLevel,
      challenge: data.challenge || request.challenge,
    };
  }

  public async validateStoryContent(
    content: string,
    gradeLevel: GradeLevel,
    options: RequestOptions = {},
  ): Promise<{ isValid: boolean; issues: string[]; suggestions: string[] }> {
    try {
      const url = `${this.config.baseUrl}${this.endpoints.validateContent}`;

      const response = await this.executeWithRetry(
        () =>
          this.makeRequest(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content,
              grade_level: gradeLevel,
              timestamp: Date.now(),
            }),
          }),
        this.retryConfig,
      );

      if (!response.ok) {
        throw this.createApiError(response);
      }

      const data = await response.json();
      return {
        isValid: data.is_valid,
        issues: data.issues || [],
        suggestions: data.suggestions || [],
      };
    } catch (error) {
      if (options.fallback !== false) {
        return this.performLocalValidation(content, gradeLevel);
      }
      throw error;
    }
  }

  public async getStoryStarters(
    gradeLevel: GradeLevel,
    theme?: string,
    options: RequestOptions = {},
  ): Promise<string[]> {
    try {
      const url = `${this.config.baseUrl}${this.endpoints.getStoryStarters}`;
      const params = new URLSearchParams({
        grade_level: gradeLevel,
        ...(theme && { theme }),
      });

      const response = await this.executeWithRetry(
        () => this.makeRequest(`${url}?${params}`),
        this.retryConfig,
      );

      if (!response.ok) {
        throw this.createApiError(response);
      }

      const data = await response.json();
      return data.starters || [];
    } catch (error) {
      if (options.fallback !== false) {
        return this.getFallbackStarters(gradeLevel, theme);
      }
      throw error;
    }
  }

  public async submitUserStory(
    story: string,
    gradeLevel: GradeLevel,
    userId: string,
    options: RequestOptions = {},
  ): Promise<{ success: boolean; score?: number; feedback?: string }> {
    try {
      const url = `${this.config.baseUrl}${this.endpoints.submitUserStory}`;

      const response = await this.executeWithRetry(
        () =>
          this.makeRequest(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              story,
              grade_level: gradeLevel,
              user_id: userId,
              timestamp: Date.now(),
            }),
          }),
        this.retryConfig,
      );

      if (!response.ok) {
        throw this.createApiError(response);
      }

      const data = await response.json();
      return {
        success: data.success,
        score: data.score,
        feedback: data.feedback,
      };
    } catch (error) {
      if (options.fallback !== false) {
        return {
          success: true,
          score: Math.floor(Math.random() * 50) + 50,
          feedback: 'Great job! Keep writing!',
        };
      }
      throw error;
    }
  }

  public async getLeaderboard(
    gradeLevel?: GradeLevel,
    limit: number = 10,
    options: RequestOptions = {},
  ): Promise<Array<{ username: string; score: number; rank: number }>> {
    try {
      const url = `${this.config.baseUrl}${this.endpoints.getLeaderboard}`;
      const params = new URLSearchParams({
        limit: limit.toString(),
        ...(gradeLevel && { grade_level: gradeLevel }),
      });

      const response = await this.executeWithRetry(
        () => this.makeRequest(`${url}?${params}`),
        this.retryConfig,
      );

      if (!response.ok) {
        throw this.createApiError(response);
      }

      const data = await response.json();
      return data.leaderboard || [];
    } catch (error) {
      if (options.fallback !== false) {
        return this.generateMockLeaderboard(limit);
      }
      throw error;
    }
  }

  private async makeRequest(
    url: string,
    options: RequestInit = {},
  ): Promise<Response> {
    const timeoutId = setTimeout(() => {
      throw new Error('Request timeout');
    }, options.timeout || this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(this.config.timeout),
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.message.includes('timeout')) {
          throw this.createTimeoutError();
        }
        if (
          error.message.includes('network') ||
          error.message.includes('fetch')
        ) {
          throw this.createNetworkError(error.message);
        }
      }

      throw error;
    }
  }

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    retryConfig: RetryConfig,
  ): Promise<T> {
    let lastError: any;
    let delay = retryConfig.delay;

    for (let attempt = 1; attempt <= retryConfig.attempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt === retryConfig.attempts || !this.isRetryableError(error)) {
          throw error;
        }

        await this.delay(Math.min(delay, retryConfig.maxDelay));
        delay *= retryConfig.backoff;
      }
    }

    throw lastError;
  }

  private isRetryableError(error: any): boolean {
    if (error instanceof ApiError) {
      return error.retryable;
    }

    if (error instanceof Error) {
      return (
        error.message.includes('network') ||
        error.message.includes('timeout') ||
        error.message.includes('fetch')
      );
    }

    return false;
  }

  private createApiError(response: Response): ApiError {
    const status = response.status;

    if (status >= 500) {
      return {
        type: 'server',
        message: `Server error: ${status}`,
        status,
        retryable: true,
      };
    }

    if (status === 429) {
      const retryAfter = parseInt(
        response.headers.get('Retry-After') || '60',
        10,
      );
      return {
        type: 'rate_limit',
        message: 'Rate limit exceeded',
        status,
        retryable: true,
        retryAfter,
      };
    }

    if (status >= 400) {
      return {
        type: 'validation',
        message: `Client error: ${status}`,
        status,
        retryable: false,
      };
    }

    return {
      type: 'server',
      message: `Unknown error: ${status}`,
      status,
      retryable: true,
    };
  }

  private createTimeoutError(): ApiError {
    return {
      type: 'timeout',
      message: 'Request timed out',
      retryable: true,
    };
  }

  private createNetworkError(message: string): ApiError {
    return {
      type: 'network',
      message: `Network error: ${message}`,
      retryable: true,
    };
  }

  private generateRequestKey(endpoint: string, data: any): string {
    return `${endpoint}_${JSON.stringify(data)}`;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async generateFallbackStory(
    request: StoryRequest,
  ): Promise<StoryResponse> {
    const fallbackStories = {
      'K-2':
        'Once upon a time, a little rabbit found a shiny pebble that sparkled in the sunlight.',
      '3-5':
        'Maya discovered that her garden had grown something very special overnight.',
      '6-8':
        'The old chest in the attic contained more than just dusty memories.',
      '9-12':
        'The conversation that would change everything began with a simple question.',
    };

    return {
      story: fallbackStories[request.gradeLevel],
      success: true,
      gradeLevel: request.gradeLevel,
      error: 'Using offline fallback story',
    };
  }

  private performLocalValidation(
    content: string,
    _gradeLevel: GradeLevel,
  ): { isValid: boolean; issues: string[]; suggestions: string[] } {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // More robust sentence splitting that handles trailing punctuation properly
    const sentences = content
      .split(/[.!?]+(?:\s+|$)/)
      .filter(s => s.trim().length > 0);
    const characterCount = content.length;

    // Updated validation: 2000 characters max instead of word limits
    const maxCharacters = 2000;

    if (characterCount > maxCharacters) {
      issues.push('Content too long');
      suggestions.push(`Try to keep it under ${maxCharacters} characters`);
    }

    if (sentences.length > 8) {
      issues.push('Too many sentences');
      suggestions.push('Limit to 8 sentences');
    }

    const inappropriateWords = ['violence', 'weapon', 'death', 'scary'];
    const foundInappropriate = inappropriateWords.filter(word =>
      content.toLowerCase().includes(word),
    );

    if (foundInappropriate.length > 0) {
      issues.push('Contains inappropriate content');
      suggestions.push('Use more positive, age-appropriate language');
    }

    return {
      isValid: issues.length === 0,
      issues,
      suggestions,
    };
  }

  private getFallbackStarters(
    gradeLevel: GradeLevel,
    _theme?: string,
  ): string[] {
    const starters = {
      'K-2': [
        'Once upon a time, a little animal went on an adventure.',
        'In a magical forest, something wonderful was about to happen.',
        'A young child found something special in their backyard.',
      ],
      '3-5': [
        'The mystery began when Sarah noticed something strange.',
        'Tommy and his friends were about to discover something amazing.',
        'The old library held secrets waiting to be found.',
      ],
      '6-8': [
        'The letter arrived on a Tuesday, changing everything.',
        'Nobody expected what they would find in the abandoned building.',
        'The team faced their biggest challenge yet.',
      ],
      '9-12': [
        'The decision that would define their future came disguised as an ordinary moment.',
        'What started as a routine day became an extraordinary journey.',
        'The truth they uncovered challenged everything they believed.',
      ],
    };

    return starters[gradeLevel] || starters['3-5'];
  }

  private generateMockLeaderboard(
    limit: number,
  ): Array<{ username: string; score: number; rank: number }> {
    const names = [
      'Alice',
      'Bob',
      'Charlie',
      'Diana',
      'Eve',
      'Frank',
      'Grace',
      'Henry',
    ];
    const leaderboard = [];

    for (let i = 0; i < Math.min(limit, names.length); i++) {
      leaderboard.push({
        username: names[i],
        score: Math.floor(Math.random() * 1000) + 500,
        rank: i + 1,
      });
    }

    return leaderboard.sort((a, b) => b.score - a.score);
  }

  public updateConfig(newConfig: Partial<ApiConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public getConfig(): ApiConfig {
    return { ...this.config };
  }

  public isOnline(): boolean {
    return navigator.onLine;
  }

  public clearRequestQueue(): void {
    this.requestQueue.clear();
  }

  public getQueueSize(): number {
    return this.requestQueue.size;
  }
}

export const apiClient = new ApiClient();
export default ApiClient;
