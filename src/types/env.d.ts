/**
 * TypeScript declarations for react-native-dotenv
 * This allows TypeScript to recognize imports from '@env'
 */

declare module '@env' {
  // Supabase Configuration
  export const SUPABASE_URL: string;
  export const SUPABASE_ANON_KEY: string;

  // OpenAI Configuration
  export const OPENAI_API_KEY: string;
  export const OPENAI_MODEL: string;
  export const OPENAI_ORG_ID: string;

  // Image Generation Configuration
  export const REPLICATE_API_TOKEN: string;
  export const BACKUP_IMAGE_API_TOKEN: string;
  export const IMAGE_GENERATION_ENABLED: string;

  // Image Generation Settings
  export const IMAGE_GENERATION_TIMEOUT_PRIMARY: string;
  export const IMAGE_GENERATION_TIMEOUT_BACKUP: string;
  export const IMAGE_GENERATION_MAX_CONCURRENT: string;
  export const IMAGE_GENERATION_XP_COST: string;

  // App Configuration
  export const APP_NAME: string;
  export const APP_VERSION: string;

  // Clerk OAuth Configuration
  export const CLERK_PUBLISHABLE_KEY: string;
  export const CLERK_SECRET_KEY: string;
  export const CLERK_JWKS_URL: string;

  // Convex Configuration
  export const CONVEX_URL: string;
}
