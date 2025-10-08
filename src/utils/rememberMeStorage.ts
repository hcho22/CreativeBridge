import AsyncStorage from '@react-native-async-storage/async-storage';

const REMEMBER_ME_KEY = '@CreativeBridge:rememberMe';
const USER_EMAIL_KEY = '@CreativeBridge:userEmail';

export interface RememberMeData {
  isEnabled: boolean;
  userEmail?: string;
  savedAt: string;
}

export class RememberMeStorage {
  // Save remember me preference
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

      await AsyncStorage.setItem(REMEMBER_ME_KEY, JSON.stringify(data));

      // Store email separately for easy access
      if (enabled && userEmail) {
        await AsyncStorage.setItem(USER_EMAIL_KEY, userEmail);
      } else {
        await AsyncStorage.removeItem(USER_EMAIL_KEY);
      }
    } catch (error) {
      console.error('Error saving remember me preference:', error);
    }
  }

  // Get remember me preference
  static async getRememberMe(): Promise<RememberMeData | null> {
    try {
      const data = await AsyncStorage.getItem(REMEMBER_ME_KEY);
      if (!data) {
        return null;
      }

      const parsed: RememberMeData = JSON.parse(data);

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

  // Get saved email (for quick access)
  static async getSavedEmail(): Promise<string | null> {
    try {
      const email = await AsyncStorage.getItem(USER_EMAIL_KEY);
      return email;
    } catch (error) {
      console.error('Error getting saved email:', error);
      return null;
    }
  }

  // Clear remember me data
  static async clearRememberMe(): Promise<void> {
    try {
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
