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

// ---------------------------------------------------------------------------
// Convex auth-ready bridge
//
// `ConvexProviderWithClerk` calls `client.setAuth(getToken)` from a useEffect
// after mount, then the WebSocket performs an auth handshake with Convex.
// Until that handshake lands, calls to `convexClient.mutation()` /
// `convexClient.action()` from non-React services (storySessionManager,
// onboardingService, xpEventTracker, imageStorageService, etc.) race the
// handshake and surface as `Server Error: Not authenticated` from
// `requireAuth(ctx)`.
//
// This module-level signal lets non-React code wait for the handshake.
// `ConditionalClerkProvider` drives the boolean via `setConvexAuthReady`
// from a `useConvexAuth()` effect; service code awaits `waitForConvexAuth`
// before issuing singleton-client mutations, and registers
// `onConvexAuthReady` listeners to flush whatever it queued during the gap.
// ---------------------------------------------------------------------------

let _isConvexAuthReady = false;
const _authReadyWaiters = new Set<() => void>();
const _authReadyListeners = new Set<() => void>();

/**
 * Update the module-level auth-ready flag. Call from React when
 * `useConvexAuth().isAuthenticated` changes.
 *
 * On a `false → true` transition, all pending `waitForConvexAuth` promises
 * resolve and every `onConvexAuthReady` listener fires.
 *
 * @internal Wired by ConditionalClerkProvider; do not call from service code.
 */
export const setConvexAuthReady = (isReady: boolean): void => {
  if (_isConvexAuthReady === isReady) return;
  _isConvexAuthReady = isReady;
  if (!isReady) return;

  // Drain waiters first so synchronous listeners can't add new waiters that
  // miss this transition.
  const waiters = Array.from(_authReadyWaiters);
  _authReadyWaiters.clear();
  for (const resolve of waiters) {
    try {
      resolve();
    } catch (err) {
      console.warn('[convex] auth-ready waiter threw:', err);
    }
  }
  for (const listener of Array.from(_authReadyListeners)) {
    try {
      listener();
    } catch (err) {
      console.warn('[convex] auth-ready listener threw:', err);
    }
  }
};

/**
 * Synchronous read of the auth-ready flag.
 *
 * Equivalent to `useConvexAuth().isAuthenticated` but accessible from
 * non-React code.
 */
export const isConvexAuthCurrentlyReady = (): boolean => _isConvexAuthReady;

/**
 * Wait until Convex auth handshake has completed (or the timeout fires).
 *
 * Resolves `true` if auth is ready (immediately if already ready, or once
 * `setConvexAuthReady(true)` is called). Resolves `false` if the timeout
 * fires first — in that case the caller should fall back to local cache and
 * queue the work for `onConvexAuthReady`.
 *
 * @param timeoutMs Default 5000ms. Set lower for fast UI paths, higher for
 *   background syncs.
 */
export const waitForConvexAuth = (timeoutMs = 5000): Promise<boolean> => {
  if (_isConvexAuthReady) return Promise.resolve(true);
  return new Promise(resolve => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      _authReadyWaiters.delete(onReady);
      clearTimeout(timer);
      resolve(value);
    };
    const onReady = () => finish(true);
    _authReadyWaiters.add(onReady);
    const timer = setTimeout(() => finish(false), timeoutMs);
  });
};

/**
 * Register a one-shot-style listener that fires on every `false → true`
 * auth-ready transition. Used by service singletons to flush whatever they
 * queued while auth was unavailable.
 *
 * Returns an unsubscribe function. If auth is already ready when registered,
 * the listener is invoked once on a microtask so callers don't have to
 * branch on `isConvexAuthCurrentlyReady()` themselves.
 */
export const onConvexAuthReady = (listener: () => void): (() => void) => {
  _authReadyListeners.add(listener);
  if (_isConvexAuthReady) {
    Promise.resolve().then(() => {
      if (_authReadyListeners.has(listener)) {
        try {
          listener();
        } catch (err) {
          console.warn('[convex] initial auth-ready listener threw:', err);
        }
      }
    });
  }
  return () => {
    _authReadyListeners.delete(listener);
  };
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
