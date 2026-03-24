import AsyncStorage from './asyncStorageWrapper';
import {
  setSecureJSON,
  getSecureJSON,
  removeSecureItem,
  migrateAndGet,
  setSecureItem,
  getSecureItem,
} from './sensitiveStorage';

const REMEMBER_ME_KEY = '@CreativeBridge:rememberMe';
const USER_EMAIL_KEY = '@CreativeBridge:userEmail';

export interface RememberMeData {
  isEnabled: boolean;
  userEmail?: string;
  savedAt: string;
}

export class RememberMeStorage {
  // Save remember me preference (email stored encrypted via expo-secure-store)
  static async setRememberMe(
    enabled: boolean,
    userEmail?: string,
  ): Promise<void> {
    try {
      const data: RememberMeData = {
        isEnabled: enabled,
        userEmail: enabled ? userEmail : undefined,
        savedAt: new Date().toISOString(),
      };

      await setSecureJSON(REMEMBER_ME_KEY, data);

      // Store email separately for easy access (encrypted)
      if (enabled && userEmail) {
        await setSecureItem(USER_EMAIL_KEY, userEmail);
      } else {
        await removeSecureItem(USER_EMAIL_KEY);
      }
    } catch (error) {
      console.error('Error saving remember me preference:', error);
    }
  }

  // Get remember me preference (with auto-migration from plaintext)
  static async getRememberMe(): Promise<RememberMeData | null> {
    try {
      // migrateAndGet handles the plaintext → encrypted migration transparently
      const raw = await migrateAndGet(REMEMBER_ME_KEY);
      if (!raw) {
        return null;
      }

      const parsed: RememberMeData = JSON.parse(raw);

      // Check if data is older than 30 days (optional expiration)
      const savedDate = new Date(parsed.savedAt);
      const now = new Date();
      const daysDiff =
        (now.getTime() - savedDate.getTime()) / (1000 * 3600 * 24);

      if (daysDiff > 30) {
        // Expired, clear the data
        await this.clearRememberMe();
        return null;
      }

      return parsed;
    } catch (error) {
      console.error('Error getting remember me preference:', error);
      return null;
    }
  }

  // Get saved email (for quick access, encrypted)
  static async getSavedEmail(): Promise<string | null> {
    try {
      // Auto-migrate from plaintext AsyncStorage if needed
      const email = await migrateAndGet(USER_EMAIL_KEY);
      return email;
    } catch (error) {
      console.error('Error getting saved email:', error);
      return null;
    }
  }

  // Clear remember me data (both secure store and any legacy plaintext)
  static async clearRememberMe(): Promise<void> {
    try {
      await removeSecureItem(REMEMBER_ME_KEY);
      await removeSecureItem(USER_EMAIL_KEY);
      // Also clean up any remaining plaintext (belt-and-suspenders)
      await AsyncStorage.multiRemove([REMEMBER_ME_KEY, USER_EMAIL_KEY]);
    } catch (error) {
      console.error('Error clearing remember me data:', error);
    }
  }

  // Check if remember me is enabled
  static async isRememberMeEnabled(): Promise<boolean> {
    const data = await this.getRememberMe();
    return data?.isEnabled ?? false;
  }

  // Update Supabase client configuration for remember me
  static getSupabaseStorageConfig(rememberMe: boolean) {
    return {
      // If remember me is disabled, use session storage instead of persistent storage
      // This means the session will be cleared when the app is closed
      storage: rememberMe ? AsyncStorage : undefined,
      autoRefreshToken: true,
      persistSession: rememberMe,
      detectSessionInUrl: false,
    };
  }
}
