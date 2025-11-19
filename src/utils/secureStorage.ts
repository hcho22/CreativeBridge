/**
 * Secure Storage Utility
 * 
 * Provides COPPA-compliant secure storage for user personalization data
 * Uses React Native Keychain for sensitive data encryption
 */

import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { structuredLogger } from './logger';

export interface SecureStorageOptions {
  service?: string;
  accessGroup?: string;
  encryptionLevel?: 'basic' | 'enhanced';
  expirationTime?: number; // in milliseconds
}

export interface StorageMetadata {
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
  version: string;
  encrypted: boolean;
}

const DEFAULT_OPTIONS: Required<SecureStorageOptions> = {
  service: 'CreativeBridge',
  accessGroup: 'group.creativeBridge.app',
  encryptionLevel: 'enhanced',
  expirationTime: 30 * 24 * 60 * 60 * 1000, // 30 days
};

class SecureStorageService {
  private readonly options: Required<SecureStorageOptions>;
  private readonly metadataPrefix = 'metadata:';

  constructor(options: SecureStorageOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Store sensitive data securely using Keychain
   */
  async setSecure<T>(key: string, value: T, options?: SecureStorageOptions): Promise<void> {
    try {
      const finalOptions = { ...this.options, ...options };
      const serializedValue = JSON.stringify(value);
      const metadata: StorageMetadata = {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        expiresAt: finalOptions.expirationTime ? Date.now() + finalOptions.expirationTime : undefined,
        version: '1.0',
        encrypted: true,
      };

      // Store the actual data in Keychain
      await Keychain.setInternetCredentials(
        `${finalOptions.service}:${key}`,
        key, // username
        serializedValue, // password (actual data)
        {
          accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
          authenticationType: Keychain.AUTHENTICATION_TYPE.DEVICE_PASSCODE_OR_BIOMETRICS,
          accessGroup: finalOptions.accessGroup,
          storage: Keychain.STORAGE_TYPE.KC,
        }
      );

      // Store metadata in AsyncStorage for quick access checks
      await AsyncStorage.setItem(
        `${this.metadataPrefix}${key}`,
        JSON.stringify(metadata)
      );

      structuredLogger.debug('Secure data stored', {
        key: this.hashKey(key),
        encrypted: true,
        hasExpiration: !!metadata.expiresAt,
      });
    } catch (error) {
      structuredLogger.error('Failed to store secure data', { key: this.hashKey(key) }, error as Error);
      throw new Error(`Failed to store secure data for key: ${this.hashKey(key)}`);
    }
  }

  /**
   * Retrieve sensitive data from Keychain
   */
  async getSecure<T>(key: string): Promise<T | null> {
    try {
      // Check metadata for expiration
      const metadata = await this.getMetadata(key);
      if (metadata?.expiresAt && Date.now() > metadata.expiresAt) {
        await this.removeSecure(key);
        return null;
      }

      // Retrieve from Keychain
      const credentials = await Keychain.getInternetCredentials(`${this.options.service}:${key}`);
      
      if (!credentials || credentials === false) {
        return null;
      }

      const deserializedValue = JSON.parse(credentials.password) as T;
      return deserializedValue;
    } catch (error) {
      structuredLogger.error('Failed to retrieve secure data', { key: this.hashKey(key) }, error as Error);
      return null;
    }
  }

  /**
   * Store non-sensitive data in AsyncStorage
   */
  async set<T>(key: string, value: T, options?: SecureStorageOptions): Promise<void> {
    try {
      const finalOptions = { ...this.options, ...options };
      const metadata: StorageMetadata = {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        expiresAt: finalOptions.expirationTime ? Date.now() + finalOptions.expirationTime : undefined,
        version: '1.0',
        encrypted: false,
      };

      const wrappedValue = {
        data: value,
        metadata,
      };

      await AsyncStorage.setItem(key, JSON.stringify(wrappedValue));

      structuredLogger.debug('Data stored', {
        key: this.hashKey(key),
        encrypted: false,
        hasExpiration: !!metadata.expiresAt,
      });
    } catch (error) {
      structuredLogger.error('Failed to store data', { key: this.hashKey(key) }, error as Error);
      throw new Error(`Failed to store data for key: ${this.hashKey(key)}`);
    }
  }

  /**
   * Retrieve non-sensitive data from AsyncStorage
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const stored = await AsyncStorage.getItem(key);
      if (!stored) {
        return null;
      }

      const parsed = JSON.parse(stored);
      const { data, metadata } = parsed;

      // Check expiration
      if (metadata?.expiresAt && Date.now() > metadata.expiresAt) {
        await this.remove(key);
        return null;
      }

      return data as T;
    } catch (error) {
      structuredLogger.error('Failed to retrieve data', { key: this.hashKey(key) }, error as Error);
      return null;
    }
  }

  /**
   * Remove secure data
   */
  async removeSecure(key: string): Promise<boolean> {
    try {
      const result = await Keychain.resetInternetCredentials(`${this.options.service}:${key}`);
      await AsyncStorage.removeItem(`${this.metadataPrefix}${key}`);
      
      structuredLogger.debug('Secure data removed', {
        key: this.hashKey(key),
        success: result,
      });

      return result;
    } catch (error) {
      structuredLogger.error('Failed to remove secure data', { key: this.hashKey(key) }, error as Error);
      return false;
    }
  }

  /**
   * Remove non-sensitive data
   */
  async remove(key: string): Promise<boolean> {
    try {
      await AsyncStorage.removeItem(key);
      return true;
    } catch (error) {
      structuredLogger.error('Failed to remove data', { key: this.hashKey(key) }, error as Error);
      return false;
    }
  }

  /**
   * Check if secure key exists and is not expired
   */
  async hasSecure(key: string): Promise<boolean> {
    try {
      const metadata = await this.getMetadata(key);
      if (!metadata) {
        return false;
      }

      // Check expiration
      if (metadata.expiresAt && Date.now() > metadata.expiresAt) {
        await this.removeSecure(key);
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if non-sensitive key exists and is not expired
   */
  async has(key: string): Promise<boolean> {
    try {
      const data = await this.get(key);
      return data !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get metadata for a key
   */
  private async getMetadata(key: string): Promise<StorageMetadata | null> {
    try {
      const metadataStr = await AsyncStorage.getItem(`${this.metadataPrefix}${key}`);
      return metadataStr ? JSON.parse(metadataStr) : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Hash key for logging (privacy protection)
   */
  private hashKey(key: string): string {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36).substring(0, 8);
  }

  /**
   * Clear all stored data (for privacy compliance)
   */
  async clearAll(): Promise<void> {
    try {
      // Clear all AsyncStorage data
      const allKeys = await AsyncStorage.getAllKeys();
      await AsyncStorage.multiRemove(allKeys);

      // Clear Keychain data for this service
      await Keychain.resetInternetCredentials(this.options.service);

      structuredLogger.info('All storage cleared', {
        keysCleared: allKeys.length,
      });
    } catch (error) {
      structuredLogger.error('Failed to clear all storage', {}, error as Error);
      throw new Error('Failed to clear all storage');
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    totalKeys: number;
    expiredKeys: number;
    secureKeys: number;
    storageSize: number;
  }> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const metadataKeys = allKeys.filter(key => key.startsWith(this.metadataPrefix));
      
      let expiredKeys = 0;
      let secureKeys = 0;

      for (const metaKey of metadataKeys) {
        const metadata = await this.getMetadata(metaKey.replace(this.metadataPrefix, ''));
        if (metadata) {
          if (metadata.encrypted) {
            secureKeys++;
          }
          if (metadata.expiresAt && Date.now() > metadata.expiresAt) {
            expiredKeys++;
          }
        }
      }

      // Estimate storage size
      let storageSize = 0;
      for (const key of allKeys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          storageSize += value.length;
        }
      }

      return {
        totalKeys: allKeys.length,
        expiredKeys,
        secureKeys,
        storageSize,
      };
    } catch (error) {
      structuredLogger.error('Failed to get storage stats', {}, error as Error);
      return {
        totalKeys: 0,
        expiredKeys: 0,
        secureKeys: 0,
        storageSize: 0,
      };
    }
  }

  /**
   * Cleanup expired entries
   */
  async cleanupExpired(): Promise<number> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const metadataKeys = allKeys.filter(key => key.startsWith(this.metadataPrefix));
      let cleanedCount = 0;

      for (const metaKey of metadataKeys) {
        const actualKey = metaKey.replace(this.metadataPrefix, '');
        const metadata = await this.getMetadata(actualKey);
        
        if (metadata?.expiresAt && Date.now() > metadata.expiresAt) {
          if (metadata.encrypted) {
            await this.removeSecure(actualKey);
          } else {
            await this.remove(actualKey);
          }
          cleanedCount++;
        }
      }

      structuredLogger.info('Expired entries cleaned', {
        cleanedCount,
      });

      return cleanedCount;
    } catch (error) {
      structuredLogger.error('Failed to cleanup expired entries', {}, error as Error);
      return 0;
    }
  }
}

// Export singleton instance
export const secureStorage = new SecureStorageService();