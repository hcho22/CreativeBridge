/**
 * Convex Client Service
 *
 * Provides centralized access to the Convex client and typed API.
 * This file replaces supabase.ts as the primary backend client for CreativeBridge.
 *
 * Usage:
 * - React components: Use hooks from 'convex/react' with `api` import
 *   ```tsx
 *   import { useQuery, useMutation } from 'convex/react';
 *   import { api } from '@/services/convex';
 *
 *   const profile = useQuery(api.userProfiles.getMyProfile);
 *   const updateProfile = useMutation(api.userProfiles.updateProfile);
 *   ```
 *
 * - Non-React code: Use `getConvexClient()` for direct client access
 *   ```ts
 *   import { getConvexClient, api } from '@/services/convex';
 *
 *   const client = getConvexClient();
 *   if (client) {
 *     const profile = await client.query(api.userProfiles.getMyProfile);
 *   }
 *   ```
 *
 * @see prd-supabase-to-convex-migration.md (US-016)
 * @see https://docs.convex.dev/client/react
 */

import { ConvexReactClient } from 'convex/react';
import { isConvexConfigured, getConvexUrl } from '@/config/environment';

// Re-export the typed API from Convex's generated code
// This provides type-safe access to all Convex functions
export { api, internal } from '../../convex/_generated/api';

// Re-export Convex types for convenience
// These are the auto-generated types from the schema
export type { Doc, Id, TableNames } from '../../convex/_generated/dataModel';

// Re-export schema validators for use in frontend validation
export {
  gradeLevelValidator,
  storySourceValidator,
  generationStatusValidator,
  errorTypeValidator,
  serviceUsedValidator,
  elementTypeValidator,
  downloadMethodValidator,
} from '../../convex/schema';

/**
 * Type-safe grade level union type
 * Derived from Convex schema validators
 */
export type GradeLevel = 'K-2' | '3-5' | '6-8' | '9-12';

/**
 * Story source type for tracking story origins
 */
export type StorySource = 'New' | 'CreativeBridge' | 'Story_Quest' | 'File';

/**
 * Image generation status for tracking generation lifecycle
 */
export type GenerationStatus =
  | 'pending'
  | 'success'
  | 'failed'
  | 'refunded'
  | 'timeout';

/**
 * Error types for failed image generations
 */
export type ErrorType =
  | 'api_failure'
  | 'content_safety'
  | 'insufficient_xp'
  | 'timeout'
  | 'rate_limit';

/**
 * Image upload status for retry logic
 */
export type ImageUploadStatus = 'pending' | 'uploaded' | 'failed';

/**
 * Onboarding progress tracking structure
 */
export interface OnboardingProgress {
  create_account: boolean;
  first_story: boolean;
  first_image: boolean;
  first_voice: boolean;
  first_streak: boolean;
}

// Singleton Convex client instance
// This is created once and reused across the app
let convexClient: ConvexReactClient | null = null;

/**
 * Get or create the Convex client singleton
 *
 * This function returns the same client instance that's used by ConvexProviderWithClerk.
 * The client is lazily initialized on first call.
 *
 * @returns ConvexReactClient instance, or null if Convex is not configured
 *
 * @example
 * ```ts
 * const client = getConvexClient();
 * if (client) {
 *   // Client is available
 *   const data = await client.query(api.userProfiles.getMyProfile);
 * }
 * ```
 */
export const getConvexClient = (): ConvexReactClient | null => {
  // Return null if Convex is not configured
  if (!isConvexConfigured()) {
    if (__DEV__) {
      console.warn('⚠️ Convex is not configured. Set CONVEX_URL in .env');
    }
    return null;
  }

  // Create client on first access (lazy initialization)
  if (!convexClient) {
    try {
      const convexUrl = getConvexUrl();
      convexClient = new ConvexReactClient(convexUrl);

      if (__DEV__) {
        console.log('✅ Convex client initialized:', convexUrl);
      }
    } catch (error) {
      console.error('❌ Failed to initialize Convex client:', error);
      return null;
    }
  }

  return convexClient;
};

/**
 * Check if the Convex client is available and ready
 *
 * Use this to conditionally enable Convex features
 * during the dual-write migration period.
 *
 * @returns true if Convex client is initialized and ready
 */
export const isConvexReady = (): boolean => {
  return isConvexConfigured() && getConvexClient() !== null;
};

/**
 * Set the Convex client instance
 *
 * This is called by ConditionalClerkProvider to ensure
 * the same client instance is used throughout the app.
 * Should not be called directly by other code.
 *
 * @internal
 */
export const setConvexClient = (client: ConvexReactClient): void => {
  if (convexClient && convexClient !== client) {
    console.warn('⚠️ Convex client is being replaced. This may cause issues.');
  }
  convexClient = client;
};

/**
 * Export the convex client directly for use in service files
 * that need to inject the client (like imageStorageService)
 *
 * Note: This getter returns null if not initialized.
 * For React components, use the hooks instead.
 */
export const convex = {
  get client(): ConvexReactClient | null {
    return getConvexClient();
  },
};

// Default export for convenience
export default convex;
