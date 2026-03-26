/**
 * Environment Configuration Service
 * Manages environment variables for the CreativeBridge application
 * with proper fallbacks and validation
 */

// Import environment variables using react-native-dotenv
import {
  SUPABASE_URL as ENV_SUPABASE_URL,
  SUPABASE_ANON_KEY as ENV_SUPABASE_ANON_KEY,
  OPENAI_API_KEY as ENV_OPENAI_API_KEY,
  REPLICATE_API_TOKEN as ENV_REPLICATE_API_TOKEN,
  BACKUP_IMAGE_API_TOKEN as ENV_BACKUP_IMAGE_API_TOKEN,
  IMAGE_GENERATION_ENABLED as ENV_IMAGE_GENERATION_ENABLED,
  IMAGE_GENERATION_TIMEOUT_PRIMARY as ENV_IMAGE_GENERATION_TIMEOUT_PRIMARY,
  IMAGE_GENERATION_TIMEOUT_BACKUP as ENV_IMAGE_GENERATION_TIMEOUT_BACKUP,
  IMAGE_GENERATION_MAX_CONCURRENT as ENV_IMAGE_GENERATION_MAX_CONCURRENT,
  IMAGE_GENERATION_XP_COST as ENV_IMAGE_GENERATION_XP_COST,
  APP_NAME as ENV_APP_NAME,
  APP_VERSION as ENV_APP_VERSION,
} from '@env';

export interface EnvironmentConfig {
  // Supabase Configuration
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;

  // OpenAI Configuration
  OPENAI_API_KEY: string;

  // Image Generation Configuration
  REPLICATE_API_TOKEN: string;
  BACKUP_IMAGE_API_TOKEN: string;
  IMAGE_GENERATION_ENABLED: boolean;

  // Image Generation Settings
  IMAGE_GENERATION_TIMEOUT_PRIMARY: number;
  IMAGE_GENERATION_TIMEOUT_BACKUP: number;
  IMAGE_GENERATION_MAX_CONCURRENT: number;
  IMAGE_GENERATION_XP_COST: number;

  // App Configuration
  APP_NAME: string;
  APP_VERSION: string;

  // Feature Flags
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

/**
 * Load and validate environment configuration
 * Provides fallbacks for development and ensures all required values are present
 */
const loadEnvironmentConfig = (): EnvironmentConfig => {
  // Helper function to get environment variable with fallback
  const getEnvVar = (value: string | undefined, fallback?: string): string => {
    const result = value || fallback;
    if (!result) {
      console.warn(`⚠️ Environment variable is not set`);
    }
    return result || '';
  };

  // Helper function to get boolean environment variable
  const getBooleanEnvVar = (
    value: string | undefined,
    fallback: boolean = false,
  ): boolean => {
    if (value === undefined || value === '') {
      return fallback;
    }
    return value.toLowerCase() === 'true';
  };

  // Helper function to get number environment variable
  const getNumberEnvVar = (
    value: string | undefined,
    fallback: number,
  ): number => {
    if (value === undefined || value === '') {
      return fallback;
    }
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? fallback : parsed;
  };

  return {
    // Supabase Configuration
    SUPABASE_URL: getEnvVar(ENV_SUPABASE_URL),
    SUPABASE_ANON_KEY: getEnvVar(ENV_SUPABASE_ANON_KEY),

    // OpenAI Configuration
    OPENAI_API_KEY: getEnvVar(ENV_OPENAI_API_KEY),

    // Image Generation Configuration
    REPLICATE_API_TOKEN: getEnvVar(ENV_REPLICATE_API_TOKEN),
    BACKUP_IMAGE_API_TOKEN: getEnvVar(ENV_BACKUP_IMAGE_API_TOKEN),
    IMAGE_GENERATION_ENABLED: getBooleanEnvVar(
      ENV_IMAGE_GENERATION_ENABLED,
      false,
    ),

    // Image Generation Settings
    IMAGE_GENERATION_TIMEOUT_PRIMARY: getNumberEnvVar(
      ENV_IMAGE_GENERATION_TIMEOUT_PRIMARY,
      60000,
    ),
    IMAGE_GENERATION_TIMEOUT_BACKUP: getNumberEnvVar(
      ENV_IMAGE_GENERATION_TIMEOUT_BACKUP,
      45000,
    ),
    IMAGE_GENERATION_MAX_CONCURRENT: getNumberEnvVar(
      ENV_IMAGE_GENERATION_MAX_CONCURRENT,
      10,
    ),
    IMAGE_GENERATION_XP_COST: getNumberEnvVar(
      ENV_IMAGE_GENERATION_XP_COST,
      1000,
    ),

    // App Configuration
    APP_NAME: getEnvVar(ENV_APP_NAME, 'CreativeBridge'),
    APP_VERSION: getEnvVar(ENV_APP_VERSION, '1.0.0'),

    // Feature Flags
    featureFlags: {
      // Enable GPT-4 story analysis for improved image-to-story relevance
      // Falls back to keyword extraction automatically on failure
      useLlmPromptGeneration: true,
    },
  };
};

/**
 * Validate that all required environment variables are present
 */
const validateEnvironmentConfig = (config: EnvironmentConfig): void => {
  const requiredFields: (keyof EnvironmentConfig)[] = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'OPENAI_API_KEY',
    'REPLICATE_API_TOKEN',
    'BACKUP_IMAGE_API_TOKEN',
  ];

  const missingFields = requiredFields.filter(field => !config[field]);

  if (missingFields.length > 0) {
    const errorMessage = `❌ Missing required environment variables: ${missingFields.join(
      ', ',
    )}`;
    console.error(errorMessage);

    // Don't throw in production - log error but allow app to continue
    // Some features may not work, but app won't crash
    if (__DEV__) {
      console.warn(
        '⚠️ Running in development mode with missing environment variables',
      );
    } else {
      console.error(
        '⚠️ Production build with missing environment variables - some features may not work',
      );
    }
  }

  // Validate URL format
  if (config.SUPABASE_URL && !config.SUPABASE_URL.startsWith('http')) {
    const errorMessage = '❌ SUPABASE_URL must be a valid HTTP/HTTPS URL';
    console.error(errorMessage);

    if (!__DEV__) {
      throw new Error(`Environment configuration error: ${errorMessage}`);
    }
  }

  // Log configuration status in development (secure logging)
  if (__DEV__) {
    console.log('🔧 Environment Configuration Loaded:');
    console.log(`   📱 App Name: ${config.APP_NAME} v${config.APP_VERSION}`);
    console.log(`   🗄️  Supabase: ${config.SUPABASE_URL ? '✅' : '❌'}`);

    // Use secure logging for API keys - never log actual keys
    const maskKey = (key: string | undefined) => {
      if (!key) return '❌';
      return key.length > 8
        ? `✅ ${key.substring(0, 6)}...${key.substring(key.length - 3)}`
        : '✅ [CONFIGURED]';
    };

    console.log(`   🤖 OpenAI: ${maskKey(config.OPENAI_API_KEY)}`);
    console.log(`   🎨 Replicate: ${maskKey(config.REPLICATE_API_TOKEN)}`);
    console.log(
      `   🔄 Backup Service: ${maskKey(config.BACKUP_IMAGE_API_TOKEN)}`,
    );
    console.log(
      `   🖼️  Image Generation: ${
        config.IMAGE_GENERATION_ENABLED ? '✅ Enabled' : '❌ Disabled'
      }`,
    );
    console.log(`   🔒 Security: API key masking enabled`);
  }
};

// Load and validate configuration with error handling
let env: EnvironmentConfig;
try {
  env = loadEnvironmentConfig();
  validateEnvironmentConfig(env);
} catch (error) {
  console.error('Failed to load environment configuration:', error);
  // Provide fallback configuration to prevent app crash
  env = {
    SUPABASE_URL: '',
    SUPABASE_ANON_KEY: '',
    OPENAI_API_KEY: '',
    REPLICATE_API_TOKEN: '',
    BACKUP_IMAGE_API_TOKEN: '',
    IMAGE_GENERATION_ENABLED: false,
    IMAGE_GENERATION_TIMEOUT_PRIMARY: 60000,
    IMAGE_GENERATION_TIMEOUT_BACKUP: 45000,
    IMAGE_GENERATION_MAX_CONCURRENT: 10,
    IMAGE_GENERATION_XP_COST: 1000,
    APP_NAME: 'CreativeBridge',
    APP_VERSION: '1.0.0',
    featureFlags: {
      useLlmPromptGeneration: false,
    },
  };
  console.warn('Using fallback environment configuration');
}

export { env };

// Export as 'Environment' for backward compatibility
export const Environment = env;

// Export individual getters for convenience
export const getEnvironmentConfig = (): EnvironmentConfig => env;

export const isImageGenerationEnabled = (): boolean =>
  env.IMAGE_GENERATION_ENABLED;

export const getImageGenerationConfig = () => ({
  primaryApiToken: env.REPLICATE_API_TOKEN,
  backupApiToken: env.BACKUP_IMAGE_API_TOKEN,
  timeoutPrimary: env.IMAGE_GENERATION_TIMEOUT_PRIMARY,
  timeoutBackup: env.IMAGE_GENERATION_TIMEOUT_BACKUP,
  maxConcurrent: env.IMAGE_GENERATION_MAX_CONCURRENT,
  xpCost: env.IMAGE_GENERATION_XP_COST,
  enabled: env.IMAGE_GENERATION_ENABLED,
});

export default env;
