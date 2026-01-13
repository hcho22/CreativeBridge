// Environment configuration for React Native
// This file provides centralized access to environment variables

// Import environment variables using react-native-dotenv
import {
  CLERK_PUBLISHABLE_KEY,
  CLERK_SECRET_KEY,
  CLERK_JWKS_URL,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  OPENAI_API_KEY,
  ELEVENLABS_API_KEY,
} from '@env';

export interface EnvironmentConfig {
  openai: {
    apiKey: string;
    baseUrl: string;
    model: string;
    maxTokens: number;
    temperature: number;
  };
  supabase: {
    url: string;
    anonKey: string;
  };
  elevenlabs?: {
    apiKey: string;
  };
  clerk?: {
    publishableKey: string;
    secretKey?: string;
    jwksUrl: string;
  };
  app: {
    name: string;
    version: string;
    environment: 'development' | 'production';
  };
  featureFlags: {
    /**
     * USE_LLM_PROMPT_GENERATION - Enable GPT-4 story analysis for image generation
     *
     * When enabled (true):
     * - Uses GPT-4 Turbo to analyze story text and generate optimized image prompts
     * - Automatically falls back to keyword extraction on LLM failure
     * - Improves image-to-story relevance and visual coherence
     *
     * When disabled (false):
     * - Uses traditional keyword extraction method
     * - No LLM API calls made
     *
     * Default: false (safe deployment - no behavior change until explicitly enabled)
     *
     * Cost Impact: ~$0.01-0.02 per image generation when enabled
     * Rollback: Set to false to immediately revert to keyword extraction
     */
    useLlmPromptGeneration: boolean;
  };
}

// For React Native, we need to handle environment variables differently
// In development, these can be set directly here
// In production, use react-native-config or similar
const getEnvironmentConfig = (): EnvironmentConfig => {
  // Development configuration - replace with your actual API keys
  // React Native doesn't automatically load .env files, so we hardcode for development
  const config: EnvironmentConfig = {
    openai: {
      apiKey:
        OPENAI_API_KEY ||
        (__DEV__
          ? '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'
          : ''),
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4-turbo-preview',
      maxTokens: 2000,
      temperature: 0.7,
    },
    supabase: {
      url: SUPABASE_URL || 'https://your-project-ref.supabase.co',
      anonKey: SUPABASE_ANON_KEY || 'your_supabase_anon_key_here',
    },
    elevenlabs: {
      apiKey: ELEVENLABS_API_KEY || '',
    },
    clerk: {
      publishableKey: CLERK_PUBLISHABLE_KEY || '',
      secretKey: CLERK_SECRET_KEY || '',
      jwksUrl: CLERK_JWKS_URL || '', // Format: https://your-clerk-instance.clerk.accounts.dev/.well-known/jwks.json
    },
    app: {
      name: 'CreativeBridge',
      version: '1.0.0',
      environment: __DEV__ ? 'development' : 'production',
    },
    featureFlags: {
      // Default to false for safe deployment - no behavior change until explicitly enabled
      useLlmPromptGeneration: false,
    },
  };

  // Validate required environment variables
  if (
    !config.openai.apiKey ||
    config.openai.apiKey === 'your-openai-api-key-here'
  ) {
    console.warn(
      '⚠️ OpenAI API key not configured. Please set OPENAI_API_KEY in environment or update config/environment.ts',
    );
  }

  return config;
};

export const Environment = getEnvironmentConfig();

// Helper to check if OpenAI is properly configured
export const isOpenAIConfigured = (): boolean => {
  return Boolean(
    Environment.openai.apiKey &&
      Environment.openai.apiKey !== 'your-openai-api-key-here' &&
      Environment.openai.apiKey.startsWith('sk-'),
  );
};

// Helper to get OpenAI headers
export const getOpenAIHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${Environment.openai.apiKey}`,
});

// Clerk Configuration Helpers

export interface ClerkConfig {
  publishableKey: string;
  secretKey?: string;
  jwksUrl: string;
}

/**
 * Get Clerk configuration
 * @returns Clerk configuration object
 * @throws Error if Clerk is not configured
 */
export const getClerkConfig = (): ClerkConfig => {
  const clerkConfig = Environment.clerk;
  if (!clerkConfig || !clerkConfig.publishableKey || !clerkConfig.jwksUrl) {
    throw new Error(
      'Clerk is not configured. Please set CLERK_PUBLISHABLE_KEY and CLERK_JWKS_URL environment variables.',
    );
  }
  return clerkConfig;
};

/**
 * Check if Clerk is properly configured
 * @returns true if Clerk publishable key and JWKS URL are configured
 */
export const isClerkConfigured = (): boolean => {
  try {
    const config = getClerkConfig();
    const isConfigured = Boolean(
      config.publishableKey &&
        config.publishableKey.startsWith('pk_') &&
        config.publishableKey.length > 10 && // Ensure it's not just 'pk_'
        config.jwksUrl &&
        config.jwksUrl.includes('clerk') &&
        config.jwksUrl.includes('.well-known/jwks.json') &&
        config.jwksUrl.startsWith('https://'), // Ensure HTTPS
    );

    // Debug logging in development
    if (__DEV__) {
      console.log('🔧 Clerk Configuration Check:');
      console.log(
        '  CLERK_PUBLISHABLE_KEY:',
        CLERK_PUBLISHABLE_KEY
          ? `${CLERK_PUBLISHABLE_KEY.substring(0, 10)}...`
          : 'NOT SET',
      );
      console.log(
        '  CLERK_JWKS_URL:',
        CLERK_JWKS_URL ? CLERK_JWKS_URL : 'NOT SET',
      );
      console.log('  isClerkConfigured():', isConfigured);
    }

    return isConfigured;
  } catch (error) {
    if (__DEV__) {
      console.log('🔧 Clerk Configuration Check:');
      console.log(
        '  CLERK_PUBLISHABLE_KEY:',
        CLERK_PUBLISHABLE_KEY
          ? `${CLERK_PUBLISHABLE_KEY.substring(0, 10)}...`
          : 'NOT SET',
      );
      console.log(
        '  CLERK_JWKS_URL:',
        CLERK_JWKS_URL ? CLERK_JWKS_URL : 'NOT SET',
      );
      console.log(
        '  Error:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      console.log('  isClerkConfigured():', false);
    }
    return false;
  }
};
