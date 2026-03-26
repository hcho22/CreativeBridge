/**
 * AsyncStorage compatibility wrapper to handle TurboModule linking issues
 * Provides fallback to in-memory storage during development
 */

interface AsyncStorageInterface {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  multiGet(keys: string[]): Promise<Array<[string, string | null]>>;
  multiSet(keyValuePairs: Array<[string, string]>): Promise<void>;
  multiRemove(keys: string[]): Promise<void>;
  getAllKeys(): Promise<string[]>;
  clear(): Promise<void>;
}

class AsyncStorageWrapper implements AsyncStorageInterface {
  private inMemoryStorage: Map<string, string> = new Map();
  private nativeAsyncStorage: AsyncStorageInterface | null = null;
  private initializationAttempted: boolean = false;
  private degraded: boolean = false;

  constructor() {
    // Don't attempt to load AsyncStorage in constructor to avoid import errors
    // It will be loaded lazily on first use
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initializationAttempted) {
      return;
    }

    this.initializationAttempted = true;

    try {
      // Dynamically import to catch errors gracefully
      const AsyncStorageModule = await import(
        '@react-native-async-storage/async-storage'
      );
      if (AsyncStorageModule && AsyncStorageModule.default) {
        // Verify the native module is actually available
        try {
          await AsyncStorageModule.default.getAllKeys();
          this.nativeAsyncStorage = AsyncStorageModule.default;
          this.degraded = false;
          console.log('🗄️ [AsyncStorageWrapper] Using native AsyncStorage');
        } catch (testError) {
          this.degraded = true;
          console.warn(
            '🗄️ [AsyncStorageWrapper] WARNING: Native module loaded but not functional, using in-memory fallback. Data will not persist across app restarts.',
          );
        }
      } else {
        this.degraded = true;
        console.warn(
          '🗄️ [AsyncStorageWrapper] WARNING: Native AsyncStorage module not available, using in-memory fallback. Data will not persist across app restarts.',
        );
      }
    } catch (error: any) {
      this.degraded = true;
      console.warn(
        '🗄️ [AsyncStorageWrapper] WARNING: Failed to load native AsyncStorage, using in-memory fallback. Data will not persist across app restarts.',
        error?.message || error,
      );
    }
  }

  async getItem(key: string): Promise<string | null> {
    await this.ensureInitialized();
    try {
      if (this.nativeAsyncStorage) {
        return await this.nativeAsyncStorage.getItem(key);
      }
      const value = this.inMemoryStorage.get(key);
      return value || null;
    } catch (error) {
      console.warn('🗄️ [AsyncStorageWrapper] getItem error:', error);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    await this.ensureInitialized();
    try {
      if (this.nativeAsyncStorage) {
        return await this.nativeAsyncStorage.setItem(key, value);
      }
      this.inMemoryStorage.set(key, value);
    } catch (error) {
      console.warn('🗄️ [AsyncStorageWrapper] setItem error:', error);
    }
  }

  async removeItem(key: string): Promise<void> {
    await this.ensureInitialized();
    try {
      if (this.nativeAsyncStorage) {
        return await this.nativeAsyncStorage.removeItem(key);
      }
      this.inMemoryStorage.delete(key);
    } catch (error) {
      console.warn('🗄️ [AsyncStorageWrapper] removeItem error:', error);
    }
  }

  async multiGet(keys: string[]): Promise<Array<[string, string | null]>> {
    await this.ensureInitialized();
    try {
      if (this.nativeAsyncStorage) {
        return await this.nativeAsyncStorage.multiGet(keys);
      }
      const result: Array<[string, string | null]> = keys.map(key => [
        key,
        this.inMemoryStorage.get(key) || null,
      ]);
      return result;
    } catch (error) {
      console.warn('🗄️ [AsyncStorageWrapper] multiGet error:', error);
      return keys.map(key => [key, null]);
    }
  }

  async multiSet(keyValuePairs: Array<[string, string]>): Promise<void> {
    await this.ensureInitialized();
    try {
      if (this.nativeAsyncStorage) {
        return await this.nativeAsyncStorage.multiSet(keyValuePairs);
      }
      keyValuePairs.forEach(([key, value]) => {
        this.inMemoryStorage.set(key, value);
      });
    } catch (error) {
      console.warn('🗄️ [AsyncStorageWrapper] multiSet error:', error);
    }
  }

  async multiRemove(keys: string[]): Promise<void> {
    await this.ensureInitialized();
    try {
      if (this.nativeAsyncStorage) {
        return await this.nativeAsyncStorage.multiRemove(keys);
      }
      keys.forEach(key => {
        this.inMemoryStorage.delete(key);
      });
    } catch (error) {
      console.warn('🗄️ [AsyncStorageWrapper] multiRemove error:', error);
    }
  }

  async getAllKeys(): Promise<string[]> {
    await this.ensureInitialized();
    try {
      if (this.nativeAsyncStorage) {
        return await this.nativeAsyncStorage.getAllKeys();
      }
      const keys = Array.from(this.inMemoryStorage.keys());
      return keys;
    } catch (error) {
      console.warn('🗄️ [AsyncStorageWrapper] getAllKeys error:', error);
      return [];
    }
  }

  async clear(): Promise<void> {
    await this.ensureInitialized();
    try {
      if (this.nativeAsyncStorage) {
        return await this.nativeAsyncStorage.clear();
      }
      this.inMemoryStorage.clear();
    } catch (error) {
      console.warn('🗄️ [AsyncStorageWrapper] clear error:', error);
    }
  }

  /**
   * Returns true when the in-memory fallback is active instead of native AsyncStorage.
   * When degraded, data will not persist across app restarts.
   */
  isDegraded(): boolean {
    return this.degraded;
  }
}

// Create and export a singleton instance
const asyncStorageWrapper = new AsyncStorageWrapper();
export default asyncStorageWrapper;
