// Environment configuration for React Native
// This file provides centralized access to environment variables

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
}

// For React Native, we need to handle environment variables differently
// In development, these can be set directly here
// In production, use react-native-config or similar
const getEnvironmentConfig = (): EnvironmentConfig => {
  // Development configuration - replace with your actual API keys
  // React Native doesn't automatically load .env files, so we hardcode for development
  const config: EnvironmentConfig = {
    openai: {
      apiKey: __DEV__
        ? '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'
        : process.env.OPENAI_API_KEY || '',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4-turbo-preview',
      maxTokens: 2000,
      temperature: 0.7,
    },
    supabase: {
      url: process.env.SUPABASE_URL || 'https://your-project-ref.supabase.co',
      anonKey: process.env.SUPABASE_ANON_KEY || 'your_supabase_anon_key_here',
    },
    elevenlabs: {
      apiKey: process.env.ELEVENLABS_API_KEY || '',
    },
    clerk: {
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY || '',
      secretKey: process.env.CLERK_SECRET_KEY || '',
      jwksUrl: process.env.CLERK_JWKS_URL || '', // Format: https://your-clerk-instance.clerk.accounts.dev/.well-known/jwks.json
    },
    app: {
      name: 'CreativeBridge',
      version: '1.0.0',
      environment: __DEV__ ? 'development' : 'production',
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
    return Boolean(
      config.publishableKey &&
        config.publishableKey.startsWith('pk_') &&
        config.publishableKey.length > 10 && // Ensure it's not just 'pk_'
        config.jwksUrl &&
        config.jwksUrl.includes('clerk') &&
        config.jwksUrl.includes('.well-known/jwks.json') &&
        config.jwksUrl.startsWith('https://'), // Ensure HTTPS
    );
  } catch {
    return false;
  }
};
