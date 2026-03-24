/**
 * Sensitive Storage Utility (US-019: COPPA Compliance)
 *
 * Encrypts sensitive data (email, profile, auth tokens) using expo-secure-store
 * while allowing non-sensitive preferences to remain in plain AsyncStorage.
 *
 * expo-secure-store uses:
 *   - iOS: Keychain Services (hardware-backed encryption)
 *   - Android: Android Keystore + EncryptedSharedPreferences
 *
 * Handles migration from plaintext AsyncStorage on first access:
 *   1. Reads plaintext from AsyncStorage
 *   2. Writes encrypted value to SecureStore
 *   3. Deletes plaintext from AsyncStorage
 *
 * SecureStore has a ~2048 byte limit per value, so large values are chunked.
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CHUNK_SIZE = 2000; // Leave headroom under the 2048 byte limit
const CHUNK_COUNT_SUFFIX = '__chunk_count';
const MIGRATED_FLAG_PREFIX = 'migrated:';

/**
 * Sanitize keys for SecureStore (alphanumeric, ".", "-", "_" only).
 * The @CreativeBridge: prefix contains invalid chars, so we normalize it.
 */
function sanitizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Store a sensitive value in expo-secure-store.
 * Large values are automatically chunked.
 */
export async function setSecureItem(key: string, value: string): Promise<void> {
  const safeKey = sanitizeKey(key);

  if (value.length <= CHUNK_SIZE) {
    // Single value — store directly
    await SecureStore.setItemAsync(safeKey, value);
    // Clean up any previous chunks
    await deleteChunks(safeKey);
  } else {
    // Chunked storage for large values
    const chunks = Math.ceil(value.length / CHUNK_SIZE);
    for (let i = 0; i < chunks; i++) {
      const chunk = value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      await SecureStore.setItemAsync(`${safeKey}.${i}`, chunk);
    }
    // Store chunk count so we know how to reassemble
    await SecureStore.setItemAsync(
      `${safeKey}${CHUNK_COUNT_SUFFIX}`,
      String(chunks),
    );
    // Store empty marker in the base key so hasSecureItem works
    await SecureStore.setItemAsync(safeKey, `__chunked:${chunks}`);
  }
}

/**
 * Retrieve a sensitive value from expo-secure-store.
 * Automatically reassembles chunked values.
 */
export async function getSecureItem(key: string): Promise<string | null> {
  const safeKey = sanitizeKey(key);

  const value = await SecureStore.getItemAsync(safeKey);
  if (value === null) {
    return null;
  }

  // Check if value is chunked
  if (value.startsWith('__chunked:')) {
    const chunkCount = parseInt(value.replace('__chunked:', ''), 10);
    const parts: string[] = [];
    for (let i = 0; i < chunkCount; i++) {
      const chunk = await SecureStore.getItemAsync(`${safeKey}.${i}`);
      if (chunk === null) {
        // Corrupted chunked data — clean up and return null
        await removeSecureItem(key);
        return null;
      }
      parts.push(chunk);
    }
    return parts.join('');
  }

  return value;
}

/**
 * Remove a sensitive value (and all its chunks) from expo-secure-store.
 */
export async function removeSecureItem(key: string): Promise<void> {
  const safeKey = sanitizeKey(key);

  // Read base value to check if chunked
  const value = await SecureStore.getItemAsync(safeKey);
  if (value?.startsWith('__chunked:')) {
    const chunkCount = parseInt(value.replace('__chunked:', ''), 10);
    await deleteChunks(safeKey, chunkCount);
  }

  await SecureStore.deleteItemAsync(safeKey);
  await SecureStore.deleteItemAsync(`${safeKey}${CHUNK_COUNT_SUFFIX}`);
}

/**
 * Delete chunk entries for a given key.
 */
async function deleteChunks(safeKey: string, maxChunks = 20): Promise<void> {
  // Try to read actual chunk count first
  const countStr = await SecureStore.getItemAsync(
    `${safeKey}${CHUNK_COUNT_SUFFIX}`,
  );
  const count = countStr ? parseInt(countStr, 10) : maxChunks;

  for (let i = 0; i < count; i++) {
    try {
      await SecureStore.deleteItemAsync(`${safeKey}.${i}`);
    } catch {
      // Chunk may not exist — that's fine
    }
  }
  try {
    await SecureStore.deleteItemAsync(`${safeKey}${CHUNK_COUNT_SUFFIX}`);
  } catch {
    // Ignore
  }
}

/**
 * Migrate a key from plaintext AsyncStorage to encrypted SecureStore.
 *
 * Migration flow:
 *   1. Check if already migrated (flag in AsyncStorage)
 *   2. Read plaintext from AsyncStorage
 *   3. Write encrypted to SecureStore
 *   4. Delete plaintext from AsyncStorage
 *   5. Set migration flag
 *
 * Returns the value (from SecureStore if already migrated, or freshly migrated).
 * This is safe to call repeatedly — it's a no-op after the first migration.
 */
export async function migrateAndGet(key: string): Promise<string | null> {
  const safeKey = sanitizeKey(key);
  const migratedFlag = `${MIGRATED_FLAG_PREFIX}${safeKey}`;

  // Check if already migrated
  const alreadyMigrated = await AsyncStorage.getItem(migratedFlag);
  if (alreadyMigrated === 'true') {
    return getSecureItem(key);
  }

  // Check if there's existing plaintext data to migrate
  const plaintextValue = await AsyncStorage.getItem(key);
  if (plaintextValue !== null) {
    // Migrate: encrypt and delete plaintext
    await setSecureItem(key, plaintextValue);
    await AsyncStorage.removeItem(key);
    await AsyncStorage.setItem(migratedFlag, 'true');
    return plaintextValue;
  }

  // No plaintext data — check if already in SecureStore
  const secureValue = await getSecureItem(key);
  if (secureValue !== null) {
    // Already in SecureStore, mark as migrated
    await AsyncStorage.setItem(migratedFlag, 'true');
    return secureValue;
  }

  // No data anywhere
  return null;
}

/**
 * Store a JSON-serializable value securely.
 * Convenience wrapper that handles JSON serialization.
 */
export async function setSecureJSON<T>(key: string, value: T): Promise<void> {
  await setSecureItem(key, JSON.stringify(value));
}

/**
 * Retrieve and parse a JSON value from secure storage.
 * Returns null if the key doesn't exist or parsing fails.
 */
export async function getSecureJSON<T>(key: string): Promise<T | null> {
  const raw = await getSecureItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Clear all sensitive storage for a set of keys.
 * Used during logout / data deletion flows.
 */
export async function clearSensitiveKeys(keys: string[]): Promise<void> {
  for (const key of keys) {
    await removeSecureItem(key);
    const safeKey = sanitizeKey(key);
    await AsyncStorage.removeItem(`${MIGRATED_FLAG_PREFIX}${safeKey}`);
  }
}

/**
 * List of all known sensitive AsyncStorage keys in the app.
 * Used by migration and cleanup routines.
 */
export const SENSITIVE_KEYS = [
  '@CreativeBridge:userEmail',
  '@CreativeBridge:rememberMe',
  '@CreativeBridge:pendingClerkProfile',
  '@CreativeBridge:pendingMigration',
] as const;

export type SensitiveKey = (typeof SENSITIVE_KEYS)[number];
