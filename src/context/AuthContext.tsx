import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { Session, User } from '@supabase/supabase-js';
import { Linking } from 'react-native';
import AsyncStorage from '../utils/asyncStorageWrapper';
import { supabase } from '../services/supabase';

// Import expo-web-browser with error handling for native module linking
let WebBrowser: any = null;
try {
  WebBrowser = require('expo-web-browser');
} catch (error) {
  console.warn(
    '⚠️ expo-web-browser native module not available. Run "cd ios && pod install" to link it.',
  );
}
import type {
  UserProfile,
  UserProfileInsert,
  GradeLevel,
} from '../types/database';
import { RememberMeStorage } from '../utils/rememberMeStorage';
import { xpEventTracker } from '../services/xpEventTracker';

// Verify supabase is properly imported
if (!supabase) {
  console.error(
    '❌ CRITICAL: Supabase client is not initialized at module load time',
  );
}

interface SignUpData {
  username: string;
  displayName?: string;
  gradeLevel: GradeLevel;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  emailConfirmed: boolean;
  signIn: (
    email: string,
    password: string,
    rememberMe?: boolean,
  ) => Promise<{ error?: string }>;
  signUp: (
    email: string,
    password: string,
    profileData?: SignUpData,
  ) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  updateProfile: (profile: Partial<UserProfile>) => Promise<{ error?: string }>;
  refreshProfile: () => Promise<void>;
  resendConfirmation: (email: string) => Promise<{ error?: string }>;
  checkEmailConfirmation: () => Promise<boolean>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  deductXP: (
    amount: number,
    reason?: string,
  ) => Promise<{ success: boolean; error?: string; newBalance?: number }>;
  refundXP: (
    amount: number,
    reason: string,
  ) => Promise<{ success: boolean; error?: string; newBalance?: number }>;
  validateXPBalance: (requiredAmount: number) => boolean;
  getXPBalanceInfo: (requiredAmount: number) => {
    hasEnoughXP: boolean;
    currentXP: number;
    shortfall: number;
    canGenerate: boolean;
    maxGenerations: number;
  };
  canGenerateImage: () => boolean;
  trackXPEvent: (eventData: {
    type: 'deduction' | 'refund' | 'validation';
    amount: number;
    reason: string;
    sessionId?: string;
  }) => Promise<void>;
  createImageGenerationEvent: (
    sessionId?: string,
    storyGradeLevel?: string,
    storyWordCount?: number,
  ) => Promise<string | null>;
  signInWithGoogle: () => Promise<{ error?: string }>;
  signInWithApple: () => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailConfirmed, setEmailConfirmed] = useState(false);

  const fetchUserProfile = async (
    userId: string,
  ): Promise<UserProfile | null> => {
    try {
      console.log('Fetching user profile for ID:', userId);

      // First, try to get existing profile by user ID and update it if found
      const { data: existingProfile, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      console.log('Profile query result:', { existingProfile, error });

      if (existingProfile && !error) {
        // Check if it's the old hcho22 profile that needs updating
        if (
          existingProfile.username === 'hcho22' &&
          existingProfile.total_xp === 0
        ) {
          // Update the profile to match StoryQuest data
          const { data: updatedProfile, error: updateError } = await supabase
            .from('user_profiles')
            .update({
              username: 'chotog22',
              display_name: 'Chotog22',
              total_xp: 7108,
              current_streak: 16,
              longest_streak: 16,
              last_activity_date: new Date().toISOString().split('T')[0],
              total_games_played: 16,
              total_stories_completed: 16,
              total_words_written: 7635,
              best_score: 0,
              preferred_grade_level: 'K-2' as GradeLevel,
              speech_enabled: true,
            })
            .eq('id', userId)
            .select('*')
            .single();

          if (updatedProfile && !updateError) {
            return updatedProfile;
          }
        }

        return existingProfile;
      }

      // Get user email to check for potential matches
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (!currentUser?.email) {
        return null;
      }

      const emailPrefix = currentUser.email.split('@')[0];

      // Strategy 2: Look for profiles containing the email prefix
      const { data: matchingProfiles, error: searchError } = await supabase
        .from('user_profiles')
        .select('*')
        .ilike('username', `%${emailPrefix}%`);

      if (matchingProfiles && matchingProfiles.length > 0 && !searchError) {
        // Take the profile with the highest XP (most likely to be the main profile)
        const bestProfile = matchingProfiles.reduce((best, current) =>
          (current.total_xp || 0) > (best.total_xp || 0) ? current : best,
        );

        // Link this profile to the current user
        const { data: linkedProfile, error: linkError } = await supabase
          .from('user_profiles')
          .update({ id: userId })
          .eq('username', bestProfile.username)
          .select('*')
          .single();

        if (linkedProfile && !linkError) {
          return linkedProfile;
        }
      }

      return null;
    } catch (error) {
      console.error('Unexpected error fetching profile:', error);
      return null;
    }
  };

  const createUserProfile = async (
    userParam: User,
  ): Promise<UserProfile | null> => {
    try {
      console.log(
        'Creating new profile for user ID:',
        userParam.id,
        'Email:',
        userParam.email,
      );

      const emailPrefix = userParam.email?.split('@')[0] || 'user';
      const displayName =
        emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);

      const newProfile: UserProfileInsert = {
        username: emailPrefix,
        display_name: displayName,
        total_xp: 0,
        current_streak: 0,
        longest_streak: 0,
        last_activity_date: new Date().toISOString().split('T')[0], // Today's date
        best_score: 0,
        total_games_played: 0,
        total_stories_completed: 0,
        total_words_written: 0,
        preferred_grade_level: 'K-2' as GradeLevel,
        speech_enabled: true,
      };

      console.log('Inserting profile data:', newProfile);

      const { data, error } = await supabase
        .from('user_profiles')
        .insert({ ...newProfile, id: userParam.id })
        .select()
        .single();

      if (error) {
        console.error('Error creating user profile:', error);
        console.error(
          'Error details:',
          error.message,
          error.details,
          error.hint,
        );
        return null;
      }

      console.log('Successfully created profile:', data);
      return data;
    } catch (error) {
      console.error('Unexpected error creating profile:', error);
      return null;
    }
  };

  const signIn = async (
    email: string,
    password: string,
    rememberMe = false,
  ): Promise<{ error?: string }> => {
    try {
      console.log('🔐 Attempting sign in', { email, rememberMe });

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('❌ Sign in failed', error.message);
        return { error: error.message };
      }

      // Save remember me preference
      await RememberMeStorage.setRememberMe(rememberMe, email);

      console.log('✅ Sign in successful', { rememberMe });
      return {};
    } catch (error) {
      console.error('💥 Sign in exception', error);
      return { error: 'An unexpected error occurred' };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    profileData?: SignUpData,
  ): Promise<{ error?: string }> => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        return { error: error.message };
      }

      // Check if user needs email confirmation
      if (data.user && !data.user.email_confirmed_at) {
        setEmailConfirmed(false);
      }

      // Create user profile if signup was successful and profile data provided
      if (data.user && profileData) {
        try {
          const newProfile: Omit<UserProfile, 'created_at' | 'updated_at'> = {
            id: data.user.id,
            username: profileData.username,
            display_name: profileData.displayName || profileData.username,
            total_xp: 0,
            current_streak: 0,
            longest_streak: 0,
            last_activity_date: new Date().toISOString().split('T')[0],
            total_games_played: 0,
            total_stories_completed: 0,
            total_words_written: 0,
            best_score: 0,
            preferred_grade_level: profileData.gradeLevel,
            speech_enabled: true,
          };

          const { error: profileError } = await supabase
            .from('user_profiles')
            .insert(newProfile as any);

          if (profileError) {
            console.error('❌ Profile creation failed', profileError);
            // Don't return error here as the user account was created successfully
            // They can complete their profile later
          } else {
            console.log('✅ User profile created');
          }
        } catch (profileError) {
          console.error('💥 Profile creation exception', profileError);
          // Don't return error here as the user account was created successfully
        }
      }

      return {};
    } catch (error) {
      return { error: 'An unexpected error occurred' };
    }
  };

  // Clear all app-related AsyncStorage data during logout
  const clearAllAppData = async (
    keepRememberMe: boolean = false,
  ): Promise<void> => {
    try {
      console.log('🧹 Clearing app data...');

      // Get all AsyncStorage keys
      const allKeys = await AsyncStorage.getAllKeys();

      // Filter keys that belong to CreativeBridge app
      const appKeys = allKeys.filter(key => key.startsWith('@CreativeBridge:'));

      // Keys to clear based on whether to keep remember me data
      const keysToRemove = appKeys.filter(key => {
        if (keepRememberMe) {
          // Keep remember me and user email data
          return !key.includes('rememberMe') && !key.includes('userEmail');
        }
        // Clear everything
        return true;
      });

      if (keysToRemove.length > 0) {
        console.log('🗑️ Removing keys:', keysToRemove);
        await AsyncStorage.multiRemove(keysToRemove);
      }

      // Specifically handle remember me data
      if (!keepRememberMe) {
        await RememberMeStorage.clearRememberMe();
      }

      console.log('✅ App data cleared successfully');
    } catch (error) {
      console.error('❌ Error clearing app data:', error);
      // Don't throw - let logout continue even if clearing fails
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      console.log('🔐 Starting logout process...');

      // Check if remember me is enabled before signing out
      const rememberMeData = await RememberMeStorage.getRememberMe();

      // Clear local state immediately (before Supabase signOut)
      console.log('🧹 Clearing local state...');
      setLoading(true); // Show loading during logout
      setSession(null);
      setUser(null);
      setUserProfile(null);
      setEmailConfirmed(false);

      // Clear all app-related AsyncStorage data
      await clearAllAppData(rememberMeData?.isEnabled);

      // Sign out from Supabase (this will trigger the auth state change listener)
      console.log('🔐 Signing out from Supabase...');
      await supabase.auth.signOut();

      // Give a moment for the auth state change to propagate
      await new Promise(resolve => setTimeout(resolve, 100));

      // Ensure loading is false after logout
      setLoading(false);

      console.log('✅ User signed out successfully', {
        rememberMeEnabled: rememberMeData?.isEnabled,
      });
    } catch (error) {
      console.error('❌ Error signing out:', error);

      // Force clear state even if Supabase signout fails
      console.log('🆘 Forcing logout state clear...');
      setSession(null);
      setUser(null);
      setUserProfile(null);
      setEmailConfirmed(false);
      setLoading(false);

      // Still try to clear app data
      try {
        await clearAllAppData(false);
      } catch (clearError) {
        console.error(
          '❌ Error clearing app data during fallback:',
          clearError,
        );
      }

      // Force sign out even if there's an error
      try {
        await supabase.auth.signOut();
      } catch (forceSignOutError) {
        console.error('❌ Force sign out also failed:', forceSignOutError);
      }
    }
  };

  const updateProfile = async (
    profile: Partial<UserProfile>,
  ): Promise<{ error?: string }> => {
    if (!user) {
      return { error: 'No user logged in' };
    }

    try {
      const { data: updatedProfile, error } = await supabase
        .from('user_profiles')
        .update(profile as any)
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        return { error: error.message };
      }

      setUserProfile(updatedProfile);
      return {};
    } catch (error) {
      return { error: 'An unexpected error occurred' };
    }
  };

  const resendConfirmation = async (
    email: string,
  ): Promise<{ error?: string }> => {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });

      if (error) {
        return { error: error.message };
      }

      return {};
    } catch (error) {
      return { error: 'An unexpected error occurred' };
    }
  };

  const checkEmailConfirmation = async (): Promise<boolean> => {
    try {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (currentUser?.email_confirmed_at) {
        setEmailConfirmed(true);
        return true;
      }

      setEmailConfirmed(false);
      return false;
    } catch (error) {
      console.error('Error checking email confirmation:', error);
      setEmailConfirmed(false);
      return false;
    }
  };

  const resetPassword = async (email: string): Promise<{ error?: string }> => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'creativebridge://reset-password',
      });

      if (error) {
        return { error: error.message };
      }

      return {};
    } catch (error) {
      return { error: 'An unexpected error occurred' };
    }
  };

  const validateXPBalance = (requiredAmount: number): boolean => {
    // Skip XP validation if testing mode is enabled
    if (process.env.DISABLE_XP_COSTS_FOR_TESTING === 'true') {
      console.log(
        `🧪 Testing mode: Skipping XP validation for ${requiredAmount} XP`,
      );
      return true;
    }

    if (!userProfile) {
      console.log('🚫 XP validation failed: No user profile available');
      return false;
    }

    const currentXP = userProfile.total_xp || 0;
    const hasEnoughXP = currentXP >= requiredAmount;

    console.log(
      `💰 XP Balance Check: Current=${currentXP}, Required=${requiredAmount}, Valid=${hasEnoughXP}`,
    );
    return hasEnoughXP;
  };

  const getXPBalanceInfo = (requiredAmount: number) => {
    const currentXP = userProfile?.total_xp || 0;
    const hasEnoughXP = currentXP >= requiredAmount;
    const shortfall = hasEnoughXP ? 0 : requiredAmount - currentXP;
    const canGenerate = hasEnoughXP && !!userProfile && !!user;
    const maxGenerations = Math.floor(currentXP / requiredAmount);

    const info = {
      hasEnoughXP,
      currentXP,
      shortfall,
      canGenerate,
      maxGenerations,
    };

    console.log('📊 XP Balance Info:', {
      ...info,
      requiredAmount,
      userLoggedIn: !!user,
      profileLoaded: !!userProfile,
    });

    return info;
  };

  const canGenerateImage = (): boolean => {
    const IMAGE_GENERATION_COST = 1000;

    if (!user) {
      console.log('🚫 Image generation blocked: User not logged in');
      return false;
    }

    if (!userProfile) {
      console.log('🚫 Image generation blocked: User profile not loaded');
      return false;
    }

    const currentXP = userProfile.total_xp || 0;
    const canGenerate = currentXP >= IMAGE_GENERATION_COST;

    console.log(
      `🎨 Image Generation Check: XP=${currentXP}, Cost=${IMAGE_GENERATION_COST}, CanGenerate=${canGenerate}`,
    );

    if (!canGenerate) {
      const shortfall = IMAGE_GENERATION_COST - currentXP;
      console.log(`💡 User needs ${shortfall} more XP to generate image`);
    }

    return canGenerate;
  };

  const trackXPEvent = async (eventData: {
    type: 'deduction' | 'refund' | 'validation';
    amount: number;
    reason: string;
    sessionId?: string;
  }): Promise<void> => {
    if (!user) {
      console.log('🚫 XP event tracking skipped: No user logged in');
      return;
    }

    try {
      const xpEventData = {
        userId: user.id,
        sessionId: eventData.sessionId,
        xpAmount: eventData.amount,
        eventType:
          eventData.type === 'deduction'
            ? ('deduction' as const)
            : eventData.type === 'refund'
            ? ('refund' as const)
            : ('validation_check' as const),
        reason: eventData.reason,
        metadata: {
          timestamp: new Date().toISOString(),
          userXPBefore: userProfile?.total_xp || 0,
        },
      };

      if (eventData.type === 'deduction') {
        await xpEventTracker.trackXPDeduction(xpEventData);
      } else if (eventData.type === 'refund') {
        await xpEventTracker.trackXPRefund(xpEventData);
      } else {
        await xpEventTracker.trackXPValidation(
          user.id,
          eventData.amount,
          userProfile?.total_xp || 0,
          (userProfile?.total_xp || 0) >= eventData.amount,
          'image_generation',
        );
      }
    } catch (error) {
      console.error('💥 Error tracking XP event:', error);
    }
  };

  const createImageGenerationEvent = async (
    sessionId?: string,
    storyGradeLevel?: string,
    storyWordCount?: number,
  ): Promise<string | null> => {
    if (!user) {
      console.log(
        '🚫 Image generation event creation skipped: No user logged in',
      );
      return null;
    }

    try {
      const xpCost = xpEventTracker.calculateXPCost(
        storyGradeLevel,
        storyWordCount,
      );

      const result = await xpEventTracker.createImageGenerationEvent({
        userId: user.id,
        sessionId,
        xpCost,
        storyGradeLevel,
        storyWordCount,
        metadata: {
          userXPBefore: userProfile?.total_xp || 0,
          timestamp: new Date().toISOString(),
        },
      });

      if (result.success) {
        console.log(
          '✅ Image generation event created for tracking:',
          result.eventId,
        );
        return result.eventId || null;
      } else {
        console.error(
          '❌ Failed to create image generation event:',
          result.error,
        );
        return null;
      }
    } catch (error) {
      console.error('💥 Error creating image generation event:', error);
      return null;
    }
  };

  const signInWithGoogle = async (): Promise<{ error?: string }> => {
    try {
      console.log('🔐 Initiating Google OAuth sign-in...');

      // Use the deep link scheme for redirect
      const redirectTo = 'creativebridge://auth/callback';

      console.log('📋 Redirect URL:', redirectTo);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.error('❌ Google OAuth error:', error);
        console.error('❌ Error details:', JSON.stringify(error, null, 2));
        return { error: error.message || 'Failed to initiate Google sign-in' };
      }

      if (!data?.url) {
        console.error('❌ No OAuth URL returned from Supabase');
        return { error: 'Failed to generate authentication URL' };
      }

      console.log(
        '✅ Google OAuth URL generated:',
        data.url.substring(0, 100) + '...',
      );
      console.log('🌐 Opening browser with OAuth URL...');

      try {
        // Use expo-web-browser for OAuth flow
        console.log('📱 Using expo-web-browser for OAuth flow...');
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectTo,
        );

        console.log('🔗 OAuth browser result:', result.type);

        if (result.type === 'success' && result.url) {
          console.log(
            '✅ OAuth callback received:',
            result.url.substring(0, 100) + '...',
          );

          // Parse the callback URL
          const url = result.url;
          const hashMatch = url.match(/#(.+)/);

          if (hashMatch) {
            const hashParams = new URLSearchParams(hashMatch[1]);
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');
            const errorParam = hashParams.get('error');
            const errorDescription = hashParams.get('error_description');

            if (errorParam) {
              console.error(
                '❌ OAuth error in callback:',
                errorParam,
                errorDescription,
              );
              return {
                error:
                  errorDescription || errorParam || 'Authentication failed',
              };
            }

            if (accessToken && refreshToken) {
              console.log('🔐 Setting OAuth session from callback...');
              const { error: sessionError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });

              if (sessionError) {
                console.error('❌ Error setting session:', sessionError);
                console.error(
                  '❌ Error details:',
                  JSON.stringify(sessionError, null, 2),
                );
                return {
                  error: sessionError.message || 'Failed to complete sign-in',
                };
              }

              console.log('✅ Google sign-in successful');
              return {};
            } else {
              console.error('❌ Missing tokens in OAuth callback');
              console.error('❌ URL received:', url.substring(0, 200));
              return {
                error: 'Authentication callback missing required tokens',
              };
            }
          } else {
            console.warn('⚠️ OAuth callback URL format unexpected:', url);
            // Try to let Supabase handle it via deep link
            return {};
          }
        } else if (result.type === 'cancel') {
          console.log('ℹ️ User cancelled OAuth flow');
          return {}; // Silent return for user cancellation
        } else {
          console.error('❌ Unexpected OAuth result type:', result.type);
          return { error: 'Authentication was cancelled or failed' };
        }
      } catch (browserError) {
        console.error('❌ Error opening browser:', browserError);
        console.error(
          '❌ Browser error details:',
          JSON.stringify(browserError, null, 2),
        );
        // Fallback to Linking if WebBrowser fails
        try {
          const canOpen = await Linking.canOpenURL(data.url);
          if (canOpen) {
            await Linking.openURL(data.url);
            console.log('✅ Opened OAuth URL using Linking (fallback)');
            return {}; // Deep link handler will process the callback
          } else {
            return { error: 'Unable to open authentication page' };
          }
        } catch (linkingError) {
          console.error('❌ Error with Linking fallback:', linkingError);
          return { error: 'Unable to open authentication page' };
        }
      }
    } catch (error) {
      console.error('💥 Unexpected error during Google sign-in:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'An unexpected error occurred';
      return { error: errorMessage };
    }
  };

  const signInWithApple = async (): Promise<{ error?: string }> => {
    try {
      console.log('🔐 Initiating Apple OAuth sign-in...');

      // Use the deep link scheme for redirect
      const redirectTo = 'creativebridge://auth/callback';

      console.log('📋 Redirect URL:', redirectTo);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo,
        },
      });

      if (error) {
        console.error('❌ Apple OAuth error:', error);
        console.error('❌ Error details:', JSON.stringify(error, null, 2));
        return { error: error.message || 'Failed to initiate Apple sign-in' };
      }

      if (!data?.url) {
        console.error('❌ No OAuth URL returned from Supabase');
        return { error: 'Failed to generate authentication URL' };
      }

      console.log(
        '✅ Apple OAuth URL generated:',
        data.url.substring(0, 100) + '...',
      );
      console.log('🌐 Opening browser with OAuth URL...');

      try {
        // Use expo-web-browser for OAuth flow if available, otherwise fall back to Linking
        let result: any = null;

        if (WebBrowser?.openAuthSessionAsync) {
          console.log('📱 Using expo-web-browser for OAuth flow...');
          result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        } else {
          console.log(
            '📱 expo-web-browser not available, using Linking.openURL...',
          );
          console.log(
            '⚠️ Run "cd ios && pod install" to enable expo-web-browser',
          );
          // Fallback to Linking - the deep link handler will process the callback
          const canOpen = await Linking.canOpenURL(data.url);
          if (canOpen) {
            await Linking.openURL(data.url);
            console.log('✅ Opened OAuth URL using Linking');
            // Return early - deep link handler in App.tsx will process the callback
            return {};
          } else {
            return { error: 'Unable to open authentication page' };
          }
        }

        console.log('🔗 OAuth browser result:', result.type);

        if (result.type === 'success' && result.url) {
          console.log(
            '✅ OAuth callback received:',
            result.url.substring(0, 100) + '...',
          );

          // Parse the callback URL
          const url = result.url;
          const hashMatch = url.match(/#(.+)/);

          if (hashMatch) {
            const hashParams = new URLSearchParams(hashMatch[1]);
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');
            const errorParam = hashParams.get('error');
            const errorDescription = hashParams.get('error_description');

            if (errorParam) {
              console.error(
                '❌ OAuth error in callback:',
                errorParam,
                errorDescription,
              );
              return {
                error:
                  errorDescription || errorParam || 'Authentication failed',
              };
            }

            if (accessToken && refreshToken) {
              console.log('🔐 Setting OAuth session from callback...');
              const { error: sessionError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });

              if (sessionError) {
                console.error('❌ Error setting session:', sessionError);
                console.error(
                  '❌ Error details:',
                  JSON.stringify(sessionError, null, 2),
                );
                return {
                  error: sessionError.message || 'Failed to complete sign-in',
                };
              }

              console.log('✅ Apple sign-in successful');
              return {};
            } else {
              console.error('❌ Missing tokens in OAuth callback');
              console.error('❌ URL received:', url.substring(0, 200));
              return {
                error: 'Authentication callback missing required tokens',
              };
            }
          } else {
            console.warn('⚠️ OAuth callback URL format unexpected:', url);
            // Try to let Supabase handle it via deep link
            return {};
          }
        } else if (result.type === 'cancel') {
          console.log('ℹ️ User cancelled OAuth flow');
          return {}; // Silent return for user cancellation
        } else {
          console.error('❌ Unexpected OAuth result type:', result.type);
          return { error: 'Authentication was cancelled or failed' };
        }
      } catch (browserError) {
        console.error('❌ Error opening browser:', browserError);
        console.error(
          '❌ Browser error details:',
          JSON.stringify(browserError, null, 2),
        );
        // Fallback to Linking if WebBrowser fails
        try {
          const canOpen = await Linking.canOpenURL(data.url);
          if (canOpen) {
            await Linking.openURL(data.url);
            console.log('✅ Opened OAuth URL using Linking (fallback)');
            return {}; // Deep link handler will process the callback
          } else {
            return { error: 'Unable to open authentication page' };
          }
        } catch (linkingError) {
          console.error('❌ Error with Linking fallback:', linkingError);
          return { error: 'Unable to open authentication page' };
        }
      }
    } catch (error) {
      console.error('💥 Unexpected error during Apple sign-in:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'An unexpected error occurred';
      return { error: errorMessage };
    }
  };

  const deductXP = async (
    amount: number,
    reason: string = 'Image generation',
  ): Promise<{ success: boolean; error?: string; newBalance?: number }> => {
    // Skip XP deduction if testing mode is enabled
    if (process.env.DISABLE_XP_COSTS_FOR_TESTING === 'true') {
      console.log(
        `🧪 Testing mode: Skipping ${amount} XP deduction for ${reason}`,
      );
      return {
        success: true,
        newBalance: userProfile?.total_xp || 0,
      };
    }

    if (!user || !userProfile) {
      console.error('❌ XP deduction failed: No user logged in');
      return {
        success: false,
        error: 'No user logged in',
      };
    }

    // Validate amount is positive
    if (amount <= 0) {
      console.error('❌ XP deduction failed: Invalid amount', { amount });
      return {
        success: false,
        error: 'Invalid XP amount',
      };
    }

    // Check if user has enough XP
    if (!validateXPBalance(amount)) {
      console.error('❌ XP deduction failed: Insufficient balance', {
        currentXP: userProfile.total_xp,
        requestedAmount: amount,
      });
      return {
        success: false,
        error: 'Insufficient XP balance',
      };
    }

    try {
      console.log('💸 Deducting XP:', {
        userId: user.id,
        amount,
        reason,
        currentBalance: userProfile.total_xp,
      });

      // Use negative amount for deduction with the add_user_xp function
      const { error } = await supabase.rpc('add_user_xp', {
        user_uuid: user.id,
        xp_to_add: -amount,
        words_added: 0,
      });

      if (error) {
        console.error('❌ Database XP deduction failed:', error);
        return {
          success: false,
          error: `Database error: ${error.message}`,
        };
      }

      // Update local state immediately for better UX
      const newBalance = (userProfile.total_xp || 0) - amount;
      const updatedProfile = {
        ...userProfile,
        total_xp: newBalance,
      };
      setUserProfile(updatedProfile);

      console.log('✅ XP deduction successful:', {
        previousBalance: userProfile.total_xp,
        deductedAmount: amount,
        newBalance,
        reason,
      });

      // Track the XP deduction event
      await trackXPEvent({
        type: 'deduction',
        amount,
        reason,
      });

      return {
        success: true,
        newBalance,
      };
    } catch (error) {
      console.error('💥 XP deduction exception:', error);
      return {
        success: false,
        error: 'An unexpected error occurred during XP deduction',
      };
    }
  };

  const refundXP = async (
    amount: number,
    reason: string,
  ): Promise<{ success: boolean; error?: string; newBalance?: number }> => {
    if (!user || !userProfile) {
      console.error('❌ XP refund failed: No user logged in');
      return {
        success: false,
        error: 'No user logged in',
      };
    }

    // Validate amount is positive
    if (amount <= 0) {
      console.error('❌ XP refund failed: Invalid amount', { amount });
      return {
        success: false,
        error: 'Invalid refund amount',
      };
    }

    // Validate reason is provided
    if (!reason || reason.trim().length === 0) {
      console.error('❌ XP refund failed: No reason provided');
      return {
        success: false,
        error: 'Refund reason is required',
      };
    }

    try {
      console.log('💰 Refunding XP:', {
        userId: user.id,
        amount,
        reason: reason.trim(),
        currentBalance: userProfile.total_xp,
      });

      // Use positive amount for refund with the add_user_xp function
      const { error } = await supabase.rpc('add_user_xp', {
        user_uuid: user.id,
        xp_to_add: amount,
        words_added: 0,
      });

      if (error) {
        console.error('❌ Database XP refund failed:', error);
        return {
          success: false,
          error: `Database error: ${error.message}`,
        };
      }

      // Update local state immediately for better UX
      const newBalance = (userProfile.total_xp || 0) + amount;
      const updatedProfile = {
        ...userProfile,
        total_xp: newBalance,
      };
      setUserProfile(updatedProfile);

      console.log('✅ XP refund successful:', {
        previousBalance: userProfile.total_xp,
        refundedAmount: amount,
        newBalance,
        reason: reason.trim(),
      });

      // Track the XP refund event
      await trackXPEvent({
        type: 'refund',
        amount,
        reason: reason.trim(),
      });

      return {
        success: true,
        newBalance,
      };
    } catch (error) {
      console.error('💥 XP refund exception:', error);
      return {
        success: false,
        error: 'An unexpected error occurred during XP refund',
      };
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        console.log('🔄 Starting auth initialization...');

        // Ensure supabase is initialized before use
        if (!supabase) {
          console.error('❌ Supabase client is not initialized');
          setLoading(false);
          return;
        }

        if (!supabase.auth) {
          console.error('❌ Supabase auth is not available');
          setLoading(false);
          return;
        }

        // Get initial session with error handling
        const {
          data: { session: initialSession },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error('❌ Error getting session:', error);
          setLoading(false);
          return;
        }

        console.log('✅ Session retrieved:', !!initialSession);
        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        if (initialSession?.user) {
          console.log('👤 User found, checking email confirmation...');
          setEmailConfirmed(!!initialSession.user.email_confirmed_at);

          console.log('📋 Fetching user profile...');
          try {
            let profile = await fetchUserProfile(initialSession.user.id);
            if (!profile) {
              console.log(
                'Creating new profile for user:',
                initialSession.user.email,
              );
              profile = await createUserProfile(initialSession.user);
            }
            setUserProfile(profile);
          } catch (profileError) {
            console.error('Profile fetch/create error:', profileError);
            setUserProfile(null);
          }
        }

        console.log('🎉 Auth initialization complete!');
        setLoading(false);
      } catch (error) {
        // Safely log the error without causing additional errors
        try {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          const errorStack = error instanceof Error ? error.stack : undefined;
          console.error(
            '❌ Error initializing auth:',
            errorMessage,
            errorStack,
          );
        } catch (logError) {
          // Fallback if even logging fails
          console.error(
            '❌ Error initializing auth (logging failed):',
            String(error),
          );
        }
        setLoading(false);
      }
    };

    let authSubscription: { unsubscribe: () => void } | null = null;

    const setupAuthListener = async () => {
      try {
        // Ensure Supabase is ready before setting up listener
        await new Promise(resolve => setTimeout(resolve, 100));

        // Ensure supabase is initialized before use
        if (!supabase || !supabase.auth) {
          console.error(
            '❌ Supabase client is not initialized, cannot setup auth listener',
          );
          return;
        }

        // Listen for auth changes
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
          console.log(
            'Auth state changed:',
            event,
            currentSession?.user?.email,
          );

          // Handle sign out event specifically
          if (event === 'SIGNED_OUT') {
            console.log('🔐 Handling SIGNED_OUT event');
            setSession(null);
            setUser(null);
            setUserProfile(null);
            setEmailConfirmed(false);
            setLoading(false);
            return;
          }

          setSession(currentSession);
          setUser(currentSession?.user ?? null);

          if (currentSession?.user) {
            // Check email confirmation status
            setEmailConfirmed(!!currentSession.user.email_confirmed_at);

            // Fetch or create user profile
            let profile = await fetchUserProfile(currentSession.user.id);
            if (!profile) {
              console.log(
                'No existing profile found, creating new profile for user:',
                currentSession.user.email,
              );
              profile = await createUserProfile(currentSession.user);
            }
            setUserProfile(profile);
          } else {
            setUserProfile(null);
            setEmailConfirmed(false);
          }

          setLoading(false);
        });

        authSubscription = subscription;
      } catch (error) {
        console.error('Error setting up auth listener:', error);
      }
    };

    initializeAuth();
    setupAuthListener();

    return () => {
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
    };
  }, []);

  const refreshProfile = useCallback(async (): Promise<void> => {
    if (user?.id) {
      const profile = await fetchUserProfile(user.id);
      setUserProfile(profile);
    }
  }, [user?.id]);

  const value: AuthContextType = {
    session,
    user,
    userProfile,
    loading,
    emailConfirmed,
    signIn,
    signUp,
    signOut,
    updateProfile,
    refreshProfile,
    resendConfirmation,
    checkEmailConfirmation,
    resetPassword,
    deductXP,
    refundXP,
    validateXPBalance,
    getXPBalanceInfo,
    canGenerateImage,
    trackXPEvent,
    createImageGenerationEvent,
    signInWithGoogle,
    signInWithApple,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
