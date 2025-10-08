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
      stop: ['\n\n', '###'],
    };

    const response = await this.createChatCompletion(request);

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('Empty response from OpenAI API');
    }

    return content;
  }
}

// Export singleton instance
export const openaiClient = new OpenAIClient();
