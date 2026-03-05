// Story generation types for CreativeBridge
// Defines interfaces for OpenAI integration and story generation services

import { GradeLevel } from './database';

export interface StoryResponse {
  story: string;
  success: boolean;
  error?: string;
  gradeLevel: GradeLevel;
  challenge?: string;
}

export interface StoryRequest {
  gradeLevel: GradeLevel;
  storySoFar?: string;
  userInput?: string;
  challenge?: string;
  sessionId?: string; // Optional session ID for diversity tracking
  userId?: string; // Optional user ID for diversity tracking (fallback when no sessionId)
  storyId?: string; // Optional story ID for post-generation element storage
  genre?: string; // Optional genre preference for genre-aware story generation (US-006)
}

export interface AgentConfig {
  role: string;
  goal: string;
  backstory: string;
}

// Agent configurations matching Story_Quest patterns
export interface StoryAgents {
  creative_writer: AgentConfig;
  story_partner: AgentConfig;
}

// Content filtering and validation
export interface ContentFilterConfig {
  maxSentences: number;
  minSentences: number;
  inappropriateWords: string[];
  gradeAppropriate: boolean;
}

export interface ContentValidationResult {
  isValid: boolean;
  violations: string[];
  filteredContent?: string;
}

// OpenAI integration types
export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Fallback story generation
export interface FallbackStory {
  template: string;
  gradeLevel: GradeLevel;
  category: string;
}

export interface StoryGenerationError {
  type: 'network' | 'api' | 'validation' | 'content_filter' | 'rate_limit';
  message: string;
  retryable: boolean;
  fallbackUsed?: boolean;
}

// Story service configuration
export interface StoryServiceConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  contentFilter: ContentFilterConfig;
  fallbackEnabled: boolean;
  retryAttempts: number;
}

// Story analysis for imported content
export interface StoryAnalysis {
  wordCount: number;
  sentenceCount: number;
  avgWordsPerSentence: number;
  characters: string[];
  settings: string[];
  themes: string[];
  tense: 'past' | 'present' | 'future';
  genre: string;
  tone: string;
  complexity: string;
  style: {
    description: string;
    features: string[];
  };
}
