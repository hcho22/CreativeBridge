// React Native compatible OpenAI client
// Uses fetch API instead of OpenAI SDK for better React Native compatibility

import {
  Environment,
  getOpenAIHeaders,
  isOpenAIConfigured,
} from '../config/environment';

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

export class OpenAIClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor() {
    this.baseUrl = Environment.openai.baseUrl;
    this.headers = getOpenAIHeaders();
  }

  public isConfigured(): boolean {
    return isOpenAIConfigured();
  }

  public async createChatCompletion(
    request: OpenAICompletionRequest,
  ): Promise<OpenAIResponse> {
    if (!this.isConfigured()) {
      throw new Error(
        'OpenAI API key not configured. Please set your API key in environment configuration.',
      );
    }

    const url = `${this.baseUrl}/chat/completions`;

    console.log('🚀 Making OpenAI API request:', {
      model: request.model,
      messageCount: request.messages.length,
      maxTokens: request.max_tokens,
      temperature: request.temperature,
    });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ OpenAI API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        });

        if (response.status === 401) {
          throw new Error(
            'Invalid OpenAI API key. Please check your configuration.',
          );
        } else if (response.status === 429) {
          throw new Error(
            'OpenAI API rate limit exceeded. Please try again later.',
          );
        } else if (response.status >= 500) {
          throw new Error('OpenAI API server error. Please try again later.');
        } else {
          throw new Error(
            `OpenAI API error: ${response.status} ${response.statusText}`,
          );
        }
      }

      const data: OpenAIResponse = await response.json();

      console.log('✅ OpenAI API success:', {
        generatedLength: data.choices[0]?.message?.content?.length || 0,
        finishReason: data.choices[0]?.finish_reason,
        usage: data.usage,
      });

      return data;
    } catch (error) {
      console.error('💥 OpenAI API request failed:', error);
      throw error;
    }
  }

  public async generateStoryCompletion(
    systemPrompt: string,
    userPrompt: string,
    options: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
      stop?: string[]; // Allow custom stop sequences
    } = {},
  ): Promise<string> {
    const request: OpenAICompletionRequest = {
      model: options.model || Environment.openai.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: options.maxTokens || Environment.openai.maxTokens,
      temperature: options.temperature || Environment.openai.temperature,
      frequency_penalty: 0.7,
      presence_penalty: 0.6,
      // CRITICAL FIX: Only use stop sequences if explicitly provided
      // Default stop sequences like '\n\n' can truncate JSON responses
      ...(options.stop && { stop: options.stop }),
    };

    const response = await this.createChatCompletion(request);

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('Empty response from OpenAI API');
    }

    return content;
  }

  /**
   * Story Analysis Prompt Template for Image Generation
   * Analyzes narrative text and extracts key visual elements for Stable Diffusion
   *
   * This template is designed to:
   * - Extract main subject, setting, mood, and visual elements
   * - Maintain narrative coherence in generated images
   * - Provide concise, focused prompts (under 200 tokens)
   * - Ensure single cohesive scenes with clear focal points
   */
  private static readonly STORY_ANALYSIS_SYSTEM_PROMPT = `You are an expert at analyzing children's stories and creating detailed image generation prompts.

Your task is to read a story excerpt and create an optimized prompt for Stable Diffusion that will generate a single, cohesive image that captures the story's essence.

REQUIREMENTS:
1. Extract the MAIN SUBJECT (who/what is the focus?)
2. Identify the SETTING (where does this take place?)
3. Capture the MOOD (what emotion or atmosphere?)
4. Note KEY VISUAL ELEMENTS (important objects, colors, actions)
5. Suggest ARTISTIC STYLE (illustration style appropriate for children)

COMPOSITION RULES:
- Create ONE cohesive scene with a CLEAR FOCAL POINT
- Avoid split images, multiple scenes, or collages
- Ensure the main subject is prominent and well-framed
- Keep the composition simple and child-friendly

OUTPUT FORMAT:
Provide a concise image generation prompt in this format:
"[Main subject and action], [setting details], [mood/lighting], [artistic style], [additional visual elements]"

Keep the entire prompt under 200 tokens and avoid redundancy.`;

  private static readonly STORY_ANALYSIS_USER_PROMPT_TEMPLATE = `Analyze this story excerpt and create an optimized Stable Diffusion prompt:

Story:
"""
{storyText}
"""

Create a focused image prompt that captures the story's key visual moment.`;

  /**
   * Analyze story text and generate optimized image prompt using GPT-4 Turbo
   *
   * Uses LLM to extract visual elements from narrative and create a focused
   * Stable Diffusion prompt with better story-to-image relevance.
   *
   * Features:
   * - Exponential backoff retry logic (max 3 retries)
   * - Handles rate limits, timeouts, and API errors gracefully
   * - Uses GPT-4 Turbo for cost-effective story analysis
   *
   * @param storyText - The story excerpt to analyze
   * @returns Optimized image generation prompt string
   * @throws Error if all retries fail or if API returns invalid response
   */
  public async analyzeStoryForImageGeneration(
    storyText: string,
  ): Promise<string> {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second

    // Prepare the user prompt with story text
    const userPrompt = OpenAIClient.STORY_ANALYSIS_USER_PROMPT_TEMPLATE.replace(
      '{storyText}',
      storyText,
    );

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(
          `🎨 Analyzing story for image generation (attempt ${
            attempt + 1
          }/${maxRetries})`,
        );

        const request: OpenAICompletionRequest = {
          model: 'gpt-4-turbo-preview', // Use GPT-4 Turbo for cost efficiency
          messages: [
            {
              role: 'system',
              content: OpenAIClient.STORY_ANALYSIS_SYSTEM_PROMPT,
            },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 200, // Concise output as per requirements
          temperature: 0.7, // Balanced creativity
        };

        const response = await this.createChatCompletion(request);

        const imagePrompt = response.choices[0]?.message?.content?.trim();
        if (!imagePrompt) {
          throw new Error('Empty image prompt from GPT-4 analysis');
        }

        console.log('✅ Story analysis complete:', {
          promptLength: imagePrompt.length,
          tokensUsed: response.usage?.total_tokens,
        });

        return imagePrompt;
      } catch (error: any) {
        const isLastAttempt = attempt === maxRetries - 1;
        const isRateLimitError =
          error.message?.includes('rate limit') ||
          error.message?.includes('429');
        const isTimeoutError =
          error.message?.includes('timeout') ||
          error.message?.includes('ETIMEDOUT');
        const isServerError = error.message?.includes('server error');

        // Log the error with context
        console.error(`❌ Story analysis attempt ${attempt + 1} failed:`, {
          error: error.message,
          isRateLimitError,
          isTimeoutError,
          isServerError,
        });

        // Don't retry on authentication errors
        if (error.message?.includes('Invalid OpenAI API key')) {
          throw error;
        }

        // If last attempt or non-retryable error, throw
        if (isLastAttempt) {
          throw new Error(
            `Story analysis failed after ${maxRetries} attempts: ${error.message}`,
          );
        }

        // Exponential backoff: 1s, 2s, 4s
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // Should never reach here, but TypeScript needs this
    throw new Error('Story analysis failed: max retries exceeded');
  }
}

// Export singleton instance
export const openaiClient = new OpenAIClient();
