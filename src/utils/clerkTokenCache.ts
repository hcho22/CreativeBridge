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
 */
export const clerkTokenCache: TokenCache = {
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
 * @returns Promise<boolean> - true if all tokens were cleared successfully
 */
export async function clearAllClerkTokens(): Promise<boolean> {
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
    // Clear common Clerk token keys to ensure thorough cleanup
    console.log(
      '🧹 tokenKeys Set is empty (app may have restarted), clearing common Clerk token keys...',
    );

    const commonClerkKeys = [
      '__clerk_client_jwt',
      '__session',
      '__clerk_db_jwt',
      '__clerk_refresh_token',
      '__clerk_session',
    ];

    keysToCheck = commonClerkKeys.map(
      key => `${CLERK_TOKEN_PREFIX}${sanitizeKey(key)}`,
    );
  }

  // Iterate through all keys and delete them
  for (const key of keysToCheck) {
    try {
      await SecureStore.deleteItemAsync(key);
      successCount++;
      console.log(`✅ Deleted token: ${key}`);
    } catch (error) {
      console.error(`❌ Failed to delete token ${key}:`, error);
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
  // We need to probe SecureStore for common Clerk token keys
  try {
    console.log(
      '🔍 tokenKeys Set is empty (app may have restarted), probing SecureStore for actual tokens...',
    );

    // List of common Clerk token keys to check
    // These are the standard keys Clerk uses for session management
    const commonClerkKeys = [
      '__clerk_client_jwt',
      '__session',
      '__clerk_db_jwt',
      '__clerk_refresh_token',
      '__clerk_session',
    ];

    // Check each common key to see if it exists in SecureStore
    for (const key of commonClerkKeys) {
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
      '✅ No Clerk tokens found in SecureStore (checked common token keys)',
    );
    return false;
  } catch (error) {
    console.error('❌ Error checking for Clerk tokens:', error);
    // Return true on error to be safe - triggers cleanup attempt
    return true;
  }
}
