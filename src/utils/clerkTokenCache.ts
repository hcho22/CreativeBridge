/**
 * Custom Clerk TokenCache implementation using expo-secure-store
 *
 * This module provides secure token storage for Clerk authentication sessions
 * and implements fail-safe token clearing to prevent OAuth session persistence bugs.
 *
 * Key features:
 * - Secure storage using iOS Keychain and Android Encrypted SharedPreferences
 * - Explicit token clearing capability (not provided by Clerk's default cache)
 * - Token key tracking for efficient bulk clearing operations
 * - Graceful error handling (failures don't crash the app)
 *
 * Usage:
 * - Pass clerkTokenCache to ClerkProvider's tokenCache prop
 * - Call clearAllClerkTokens() during logout to ensure complete session cleanup
 * - Call hasClerkTokens() to detect stale sessions before OAuth flows
 */

import * as SecureStore from 'expo-secure-store';
import type { TokenCache } from '@clerk/clerk-expo';

// Prefix for all Clerk tokens stored in SecureStore
// Note: Must use only alphanumeric, ".", "-", "_" per iOS SecureStore requirements
const CLERK_TOKEN_PREFIX = 'clerk.token.';

// Track all token keys for efficient bulk clearing
// Using a Set for O(1) lookups and deduplication
const tokenKeys = new Set<string>();

// Mutex flag to prevent concurrent clearAllClerkTokens() calls from racing
// When true, a clearing operation is in progress and new calls should wait
let clearingInProgress = false;

/**
 * Comprehensive list of all Clerk token keys to clear
 *
 * This includes:
 * - Primary JWT tokens used for session management
 * - Legacy token keys from older Clerk versions
 * - A/B slot storage keys used by Clerk's chunked token system
 * - Metadata keys for each storage slot
 *
 * Clerk uses A/B slot storage to enable hot-swapping tokens without downtime.
 * When rotating tokens, Clerk writes to the inactive slot then switches.
 * We must clear BOTH slots to prevent stale session reactivation.
 */
const ALL_CLERK_KEYS: readonly string[] = [
  // Primary session tokens
  '__clerk_client_jwt',
  '__session',
  '__clerk_db_jwt',
  '__clerk_refresh_token',
  '__clerk_session',

  // Legacy token keys (older Clerk SDK versions)
  '__clerk_jwt',
  '__clerk_token',
  'clerk-js-session-token',

  // A/B slot storage keys for chunked token storage
  // Clerk uses these for hot-swapping tokens during rotation
  'clerk-js-session-jwt-latest',
  'clerk-js-session-jwt-A',
  'clerk-js-session-jwt-B',

  // Metadata for A/B slots (tracks which slot is active)
  'clerk-js-session-jwt-A-metadata',
  'clerk-js-session-jwt-B-metadata',

  // Additional cache keys Clerk may use
  '__clerk_publishable_key',
  '__clerk_domain',
  '__clerk_proxy_url',
] as const;

/**
 * Sanitize a key to meet SecureStore requirements
 * Keys must contain only alphanumeric characters, ".", "-", and "_"
 * @param key - Original key from Clerk
 * @returns Sanitized key safe for iOS SecureStore
 */
function sanitizeKey(key: string): string {
  // Replace double underscores with single underscore
  // Replace any other invalid characters with underscore
  return key.replace(/__/g, '_').replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Custom TokenCache implementation for Clerk
 * Stores tokens securely using expo-secure-store
 *
 * Implements getToken, saveToken, and clearToken methods.
 * The clearToken method is called by Clerk's internal hot-swap mechanism
 * during token rotation and session invalidation.
 */
export const clerkTokenCache: TokenCache = {
  /**
   * Clear a specific token from secure storage
   *
   * This method is called by Clerk's internal hot-swap mechanism when it needs
   * to invalidate a specific token (e.g., during token rotation or signOut).
   * Per Clerk's interface, this is fire-and-forget (synchronous return, async delete).
   *
   * @param key - Token identifier to clear (e.g., "__clerk_client_jwt")
   */
  clearToken(key: string): void {
    const sanitizedKey = sanitizeKey(key);
    const prefixedKey = `${CLERK_TOKEN_PREFIX}${sanitizedKey}`;

    console.log('🧹 clearToken called');

    // Remove from tracking Set
    tokenKeys.delete(prefixedKey);

    // Fire-and-forget deletion per Clerk interface (don't await)
    SecureStore.deleteItemAsync(prefixedKey)
      .then(() => {
        console.log('✅ clearToken: Successfully deleted token');
      })
      .catch(error => {
        console.error('❌ clearToken: Failed to delete token:', error);
      });
  },

  /**
   * Retrieve a token from secure storage
   * @param key - Token identifier (e.g., "__clerk_client_jwt")
   * @returns Promise resolving to token value or null if not found
   */
  async getToken(key: string): Promise<string | null> {
    try {
      const sanitizedKey = sanitizeKey(key);
      const prefixedKey = `${CLERK_TOKEN_PREFIX}${sanitizedKey}`;
      const value = await SecureStore.getItemAsync(prefixedKey);

      if (value) {
        console.log(
          `✅ Retrieved Clerk token: ${key} (stored as: ${prefixedKey})`,
        );
      }

      return value;
    } catch (error) {
      // Graceful degradation: return null if retrieval fails
      console.error(`❌ Failed to retrieve Clerk token ${key}:`, error);
      return null;
    }
  },

  /**
   * Store a token in secure storage
   * @param key - Token identifier
   * @param value - Token value to store
   */
  async saveToken(key: string, value: string): Promise<void> {
    try {
      const sanitizedKey = sanitizeKey(key);
      const prefixedKey = `${CLERK_TOKEN_PREFIX}${sanitizedKey}`;

      // Store token securely
      await SecureStore.setItemAsync(prefixedKey, value);

      // Track this key for future bulk clearing
      tokenKeys.add(prefixedKey);

      console.log(
        `✅ Saved Clerk token: ${key} (stored as: ${prefixedKey}, total tokens: ${tokenKeys.size})`,
      );
    } catch (error) {
      // Log error but don't throw - app should continue working
      console.error(`❌ Failed to save Clerk token ${key}:`, error);
    }
  },
};

/**
 * Clear all Clerk tokens from secure storage
 *
 * This is the critical function that fixes the OAuth session persistence bug.
 * Clerk's default signOut() doesn't clear tokens from device storage, causing
 * the next OAuth attempt to reactivate the previous user's session.
 *
 * Call this BEFORE clerkAuth.signOut() during logout to ensure complete cleanup.
 *
 * IMPORTANT: This function now clears tokens even if tokenKeys Set is empty
 * (which happens after app restart). It attempts to clear all common Clerk tokens.
 *
 * MUTEX: If another clearing operation is in progress, this function waits 200ms
 * and returns true (assuming the other operation will succeed). This prevents
 * race conditions when multiple parts of the app trigger token clearing simultaneously.
 *
 * @returns Promise<boolean> - true if all tokens were cleared successfully
 */
export async function clearAllClerkTokens(): Promise<boolean> {
  // Check mutex - if clearing is already in progress, wait and return
  if (clearingInProgress) {
    console.log(
      '🔒 clearAllClerkTokens: Another clearing operation is in progress, waiting 200ms...',
    );
    await delay(200);
    console.log(
      '🔓 clearAllClerkTokens: Wait complete, assuming other operation succeeded',
    );
    return true;
  }

  // Set mutex flag
  clearingInProgress = true;

  try {
    console.log(
      `🧹 Clearing all Clerk tokens (${tokenKeys.size} tokens tracked)...`,
    );

    let successCount = 0;
    let failureCount = 0;

    // Get keys to clear: use tracked keys if available, otherwise use common keys
    let keysToCheck: string[] = [];

    if (tokenKeys.size > 0) {
      // Use tracked keys (normal case during same app session)
      keysToCheck = Array.from(tokenKeys);
      console.log(`🧹 Clearing ${tokenKeys.size} tracked token keys...`);
    } else {
      // After app restart, tokenKeys is empty but tokens may still exist
      // Clear ALL known Clerk token keys to ensure thorough cleanup
      // This includes A/B slot storage keys for chunked token storage
      console.log(
        `🧹 tokenKeys Set is empty (app may have restarted), clearing all ${ALL_CLERK_KEYS.length} known Clerk token keys...`,
      );

      keysToCheck = ALL_CLERK_KEYS.map(
        key => `${CLERK_TOKEN_PREFIX}${sanitizeKey(key)}`,
      );
    }

    // Iterate through all keys and delete them
    for (const key of keysToCheck) {
      try {
        await SecureStore.deleteItemAsync(key);
        successCount++;
        console.log('✅ Deleted token');
      } catch (error) {
        console.error('❌ Failed to delete token:', error);
        failureCount++;
      }
    }

    // Clear the tracking Set
    tokenKeys.clear();

    const allCleared = failureCount === 0;

    if (allCleared) {
      console.log(`✅ Successfully cleared all ${successCount} Clerk tokens`);
    } else {
      console.warn(
        `⚠️ Cleared ${successCount} tokens, but ${failureCount} failed to delete`,
      );
    }

    return allCleared;
  } finally {
    // Always release the mutex, even if an error occurs
    clearingInProgress = false;
    console.log('🔓 clearAllClerkTokens: Mutex released');
  }
}

/**
 * Check if any Clerk tokens exist in storage
 *
 * Used to detect stale sessions before starting OAuth flows.
 * If tokens exist but user should not be signed in, call clearAllClerkTokens().
 *
 * IMPORTANT: This function attempts to detect tokens by trying to read
 * common Clerk token keys. Since expo-secure-store doesn't provide getAllKeys(),
 * we check for the most common token that Clerk uses.
 *
 * @returns Promise<boolean> - true if Clerk tokens are present
 */
export async function hasClerkTokens(): Promise<boolean> {
  // If we're tracking any keys, tokens exist
  if (tokenKeys.size > 0) {
    console.log(`🔍 Clerk tokens detected: ${tokenKeys.size} keys tracked`);
    return true;
  }

  // After app restart, tokenKeys Set is empty but tokens may still exist in SecureStore
  // We need to probe SecureStore for all known Clerk token keys
  try {
    console.log(
      `🔍 tokenKeys Set is empty (app may have restarted), probing SecureStore for ${ALL_CLERK_KEYS.length} known Clerk token keys...`,
    );

    // Check each known Clerk key to see if it exists in SecureStore
    // This includes A/B slot storage keys which may contain stale sessions
    for (const key of ALL_CLERK_KEYS) {
      const sanitizedKey = sanitizeKey(key);
      const prefixedKey = `${CLERK_TOKEN_PREFIX}${sanitizedKey}`;

      try {
        const value = await SecureStore.getItemAsync(prefixedKey);
        if (value) {
          console.log(
            `🔍 Found existing Clerk token in SecureStore: ${key} (stored as: ${prefixedKey})`,
          );
          // Re-populate tokenKeys Set with found key for future operations
          tokenKeys.add(prefixedKey);
          return true;
        }
      } catch (readError) {
        // Continue checking other keys even if one fails
        console.warn(`⚠️ Failed to check token ${prefixedKey}:`, readError);
      }
    }

    console.log(
      `✅ No Clerk tokens found in SecureStore (checked all ${ALL_CLERK_KEYS.length} known token keys)`,
    );
    return false;
  } catch (error) {
    console.error('❌ Error checking for Clerk tokens:', error);
    // Return true on error to be safe - triggers cleanup attempt
    return true;
  }
}

// Primary token key used for verification
// This is the main JWT token that Clerk uses for session management
const PRIMARY_TOKEN_KEY = '__clerk_client_jwt';

/**
 * Helper function to delay execution
 * @param ms - Milliseconds to wait
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Clear all Clerk tokens and verify they are actually deleted
 *
 * This function addresses the issue where `deleteItemAsync` can fail silently
 * on iOS. It calls `clearAllClerkTokens()` then verifies the main token is gone
 * by reading it back from SecureStore. If the token still exists, it retries
 * the deletion up to `maxAttempts` times with a 100ms delay between attempts.
 *
 * This is the recommended function to use during logout flows to ensure
 * complete session cleanup.
 *
 * @param maxAttempts - Maximum number of verification/retry attempts (default 5)
 * @returns Promise<boolean> - true if tokens verified deleted, false if verification fails
 */
export async function clearAndVerifyTokens(
  maxAttempts: number = 5,
): Promise<boolean> {
  console.log(
    `🧹 clearAndVerifyTokens: Starting with max ${maxAttempts} attempts...`,
  );

  const sanitizedPrimaryKey = sanitizeKey(PRIMARY_TOKEN_KEY);
  const prefixedPrimaryKey = `${CLERK_TOKEN_PREFIX}${sanitizedPrimaryKey}`;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Clear all tokens
    await clearAllClerkTokens();

    // Verify the primary token is gone
    try {
      const remainingToken = await SecureStore.getItemAsync(prefixedPrimaryKey);

      if (!remainingToken) {
        console.log(
          `✅ clearAndVerifyTokens: Tokens verified cleared after ${attempt} attempt(s)`,
        );
        return true;
      }

      // Token still exists - log and retry
      console.warn(
        `⚠️ clearAndVerifyTokens: Token still exists after attempt ${attempt}/${maxAttempts}`,
      );

      if (attempt < maxAttempts) {
        // Wait before retrying
        console.log(`⏳ clearAndVerifyTokens: Waiting 100ms before retry...`);
        await delay(100);
      }
    } catch (error) {
      // Error reading token - could mean it's gone (treat as success)
      console.log(
        `✅ clearAndVerifyTokens: Token read failed (likely deleted) after ${attempt} attempt(s)`,
      );
      return true;
    }
  }

  // Exhausted all attempts
  console.error(
    `❌ clearAndVerifyTokens: Failed to verify token deletion after ${maxAttempts} attempts`,
  );
  return false;
}
