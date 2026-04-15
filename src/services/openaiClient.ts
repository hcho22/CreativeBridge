// Server-Side OpenAI Client Wrapper
// Routes all AI calls through Convex actions so API keys never appear in the client bundle.
// Direct fetch calls to OpenAI have been removed (US-001: S-1.4).

import { getConvexClient, api } from './convex';
import { isConvexConfigured } from '@/config/environment';

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

export interface OpenAICompletionRequest {
  model: string;
  messages: OpenAIMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];
}

/**
 * OpenAI client that routes all calls through Convex server-side actions.
 *
 * Previously this class made direct fetch calls to OpenAI using
 * a client-side API key. Now it delegates to convex/ai.ts actions which
 * hold the key server-side and scrub PII before calling the AI provider.
 */
export class OpenAIClient {
  /**
   * Check if the Convex backend is configured and ready for AI calls.
   * (Previously checked if a local API key was present.)
   */
  public isConfigured(): boolean {
    return isConvexConfigured();
  }

  /**
   * Generate a story completion via the Convex generateStoryCompletion action.
   */
  public async generateStoryCompletion(
    systemPrompt: string,
    userPrompt: string,
    options: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
      stop?: string[];
    } = {},
  ): Promise<string> {
    const client = getConvexClient();
    if (!client) {
      throw new Error(
        'Convex client not available. Cannot generate story completion.',
      );
    }

    const content = await client.action(api.ai.generateStoryCompletion, {
      systemPrompt,
      userPrompt,
      model: options.model,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
    });

    return content;
  }

  /**
   * Analyze story text and generate an optimized image prompt
   * via the Convex analyzeStoryForImageGeneration action.
   */
  public async analyzeStoryForImageGeneration(
    storyText: string,
    gradeLevel?: string,
    artStyleGuidance?: string,
  ): Promise<string> {
    const client = getConvexClient();
    if (!client) {
      throw new Error(
        'Convex client not available. Cannot analyze story for image generation.',
      );
    }

    const imagePrompt = await client.action(
      api.ai.analyzeStoryForImageGeneration,
      { storyText, gradeLevel, artStyleGuidance },
    );

    return imagePrompt;
  }

  /**
   * Transcribe a recorded audio clip via the Convex `transcribeAudio` action
   * (OpenAI Whisper). Replaces on-device speech recognition for US-013 —
   * Whisper handles arbitrary-length utterances without iOS
   * `SFSpeechRecognizer`'s aggressive segmentation problems.
   */
  public async transcribeAudio(
    audioBase64: string,
    mimeType: string,
    language?: string,
  ): Promise<string> {
    const client = getConvexClient();
    if (!client) {
      throw new Error('Convex client not available. Cannot transcribe audio.');
    }

    const transcript = await client.action(api.ai.transcribeAudio, {
      audioBase64,
      mimeType,
      language,
    });

    return transcript;
  }
}

// Export singleton instance
export const openaiClient = new OpenAIClient();
