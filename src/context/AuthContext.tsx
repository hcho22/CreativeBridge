import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '../utils/asyncStorageWrapper';
import { supabase } from '../services/supabase';
import { useSafeClerkAuth } from '../hooks/useSafeClerkAuth';
import {
  completeOAuthFlow,
  type ClerkAuthMethods,
  type ClerkUser,
} from '../services/oauthService';
import type {
  UserProfile,
  UserProfileInsert,
  GradeLevel,
} from '../types/database';
import { RememberMeStorage } from '../utils/rememberMeStorage';
import { xpEventTracker } from '../services/xpEventTracker';
import {
  clearAllClerkTokens,
  clearAndVerifyTokens,
  hasClerkTokens,
  clerkTokenCache,
} from '../utils/clerkTokenCache';

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
  needsProfileCompletion: boolean;
  oauthError: string | null; // Latest OAuth error (for display)
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
  awardOnboardingXP: (
    milestoneType:
      | 'first_story'
      | 'first_image'
      | 'first_voice'
      | 'first_streak',
  ) => Promise<{
    success: boolean;
    error?: string;
    newBalance?: number;
    xpAwarded: number;
  }>;
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
    storyCompleted?: boolean,
  ) => Promise<string | null>;
  signInWithGoogle: () => Promise<{
    error?: string;
    showSessionHelp?: boolean;
    provider?: 'google' | 'apple';
  }>;
  signInWithApple: () => Promise<{
    error?: string;
    showSessionHelp?: boolean;
    provider?: 'google' | 'apple';
  }>;
  checkProfileCompletion: () => Promise<void>;
  clearOAuthError: () => void;
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

// Internal component that uses Clerk hooks - only rendered when ClerkProvider is present
const AuthProviderWithClerk: React.FC<AuthProviderProps> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);
  const [oauthError, setOAuthError] = useState<string | null>(null);

  // Get Clerk auth and user hooks
  // This component is only rendered when ClerkProvider is present, so hooks are safe
  const { clerkAuth, clerkUser, clerkSSO } = useSafeClerkAuth();

  // Track if we're processing an OAuth flow
  const isProcessingOAuth = useRef(false);

  // Track if we're signing out to prevent re-syncing during logout
  const isSigningOut = useRef(false);

  // Track the last Clerk user ID we synced to prevent infinite sync loops
  const lastSyncedClerkUserId = useRef<string | null>(null);

  const fetchUserProfile = async (
    userId: string,
  ): Promise<UserProfile | null> => {
    try {
      console.log('Fetching user profile for ID:', userId);

      // For OAuth users, the userId is actually the Clerk user ID
      // We need to check if this is a Clerk user ID (starts with 'user_')
      // and query by clerk_user_id field instead of id field
      const isClerkUserId = userId.startsWith('user_');

      if (isClerkUserId) {
        console.log(
          '🔍 Detected Clerk user ID, querying by clerk_user_id field',
        );

        // Query by clerk_user_id for OAuth users
        const { data: profiles, error: clerkError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('clerk_user_id', userId)
          .limit(1);

        console.log('Profile query result (by clerk_user_id):', {
          profiles,
          error: clerkError,
        });

        if (clerkError) {
          console.error(
            '❌ Error fetching profile by clerk_user_id:',
            clerkError,
          );
          return null;
        }

        const existingProfile =
          profiles && profiles.length > 0 ? profiles[0] : null;

        if (existingProfile) {
          console.log('✅ Found OAuth user profile:', existingProfile.username);
          return existingProfile;
        }

        // No profile found for OAuth user - will be created during profile completion
        console.log('📋 No profile found for OAuth user');
        return null;
      }

      // For regular email/password users, query by id field
      console.log('🔍 Regular user ID, querying by id field');
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

      // Generate unique username - avoid default 'user' which causes duplicates
      // Try to extract email from userParam.email or clerkUser.user.emailAddresses
      const email =
        userParam.email || clerkUser?.user?.emailAddresses?.[0]?.emailAddress;

      let emailPrefix: string;
      if (email) {
        emailPrefix = email.split('@')[0];
        console.log(
          '📧 [createUserProfile] Extracting username from email:',
          emailPrefix,
          'from',
          email,
        );
      } else {
        // For users without email, create unique username using user ID suffix
        const uniqueSuffix = userParam.id.slice(-8);
        emailPrefix = `user_${uniqueSuffix}`;
        console.log(
          '🆔 [createUserProfile] No email available, using user ID suffix:',
          uniqueSuffix,
        );
      }

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

      // Set signing out flag to prevent re-syncing during logout
      isSigningOut.current = true;

      // US-007: Set atomic logout flag in AsyncStorage to survive app backgrounding
      // If the app is backgrounded during logout, we can detect this on restart
      // and complete the interrupted logout by clearing any remaining tokens
      await AsyncStorage.setItem('__logout_in_progress', 'true');
      console.log('🔒 Set __logout_in_progress flag in AsyncStorage');

      // Clear the last synced Clerk user ID
      lastSyncedClerkUserId.current = null;

      // Check if remember me is enabled before signing out
      const rememberMeData = await RememberMeStorage.getRememberMe();

      // Clear local state immediately (before signouts)
      console.log('🧹 Clearing local state...');
      setLoading(true); // Show loading during logout
      setSession(null);
      setUser(null);
      setUserProfile(null);
      setEmailConfirmed(false);
      setNeedsProfileCompletion(false);

      // Clear all app-related AsyncStorage data
      await clearAllAppData(rememberMeData?.isEnabled);

      // Sign out from Clerk (for OAuth users)
      if (clerkAuth?.isSignedIn) {
        console.log('🔐 Signing out from Clerk...');
        try {
          // BEFORE clearing Clerk tokens, capture current user ID for session validation
          const clerkUserIdToLogOut = clerkAuth?.userId;
          if (clerkUserIdToLogOut) {
            console.log(
              '📝 Storing previous Clerk user ID for session validation:',
              clerkUserIdToLogOut,
            );
            await AsyncStorage.setItem(
              '__previous_clerk_user_id',
              clerkUserIdToLogOut,
            );
            await AsyncStorage.setItem(
              '__previous_logout_timestamp',
              Date.now().toString(),
            );
          }

          // CRITICAL FIX (US-005): Call signOut() FIRST, then clear tokens
          // Clerk's __unstable__onAfterResponse callback writes tokens back AFTER
          // the API call returns, so we must wait for it to complete before clearing.
          await clerkAuth.signOut();
          console.log('✅ Signed out from Clerk successfully');

          // Wait for Clerk's async callbacks to complete (onAfterResponse writes tokens)
          console.log('⏳ Waiting for Clerk callbacks...');
          await new Promise(resolve => setTimeout(resolve, 200));

          // NOW clear and verify tokens are actually deleted
          console.log('🧹 Clearing all Clerk tokens...');
          const verified = await clearAndVerifyTokens();
          if (verified) {
            console.log('✅ Tokens verified cleared after signOut');
          } else {
            // If verification fails, try one more time
            console.warn(
              '⚠️ Token verification failed, attempting second clearing...',
            );
            const secondAttempt = await clearAndVerifyTokens();
            if (secondAttempt) {
              console.log('✅ Tokens verified cleared on second attempt');
            } else {
              console.error(
                '❌ Failed to verify token deletion after multiple attempts',
              );
            }
          }

          // Verify that Clerk session is fully cleared
          if (clerkAuth.isSignedIn) {
            console.warn(
              '⚠️ Clerk still reports isSignedIn=true after signOut!',
            );
          } else {
            console.log('✅ Verified Clerk isSignedIn is now false');
          }
        } catch (clerkError: any) {
          // If the error is "already signed out", treat it as success
          const errorMessage = clerkError?.message || String(clerkError);
          if (errorMessage.includes('signed out')) {
            console.log(
              'ℹ️ Clerk reports already signed out - clearing and verifying tokens as fail-safe',
            );
            await clearAndVerifyTokens();
          } else {
            console.error('❌ Error signing out from Clerk:', clerkError);
            // Still try to clear tokens on error
            await clearAndVerifyTokens();
          }
          // Continue with Supabase signout even if Clerk fails
        }
      }

      // Sign out from Supabase (this will trigger the auth state change listener)
      console.log('🔐 Signing out from Supabase...');
      await supabase.auth.signOut();

      // Give a moment for the auth state change to propagate
      await new Promise(resolve => setTimeout(resolve, 100));

      // Ensure loading is false after logout
      setLoading(false);

      // Clear signing out flag
      isSigningOut.current = false;

      console.log('✅ User signed out successfully', {
        rememberMeEnabled: rememberMeData?.isEnabled,
      });
    } catch (error) {
      console.error('❌ Error signing out:', error);

      // Force clear state even if signout fails
      console.log('🆘 Forcing logout state clear...');
      setSession(null);
      setUser(null);
      setUserProfile(null);
      setEmailConfirmed(false);
      setNeedsProfileCompletion(false);
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

      // Force sign out from Clerk even if there's an error
      if (clerkAuth?.isSignedIn) {
        try {
          await clerkAuth.signOut();
          console.log('✅ Force signed out from Clerk');

          // Wait for Clerk's async callbacks, then clear and verify tokens
          await new Promise(resolve => setTimeout(resolve, 200));
          await clearAndVerifyTokens();
        } catch (clerkForceError: any) {
          console.error(
            '❌ Force Clerk sign out also failed:',
            clerkForceError,
          );
          // Clear tokens even if signOut fails (ultimate fail-safe)
          console.log(
            '🆘 Force-clearing Clerk tokens despite signOut failure...',
          );
          try {
            await clearAndVerifyTokens();
            console.log('✅ Clerk tokens force-cleared and verified');
          } catch (tokenClearError) {
            console.error('❌ Failed to clear tokens:', tokenClearError);
          }
        }
      }

      // Force sign out from Supabase even if there's an error
      try {
        await supabase.auth.signOut();
      } catch (forceSignOutError) {
        console.error(
          '❌ Force Supabase sign out also failed:',
          forceSignOutError,
        );
      }

      // Clear signing out flag
      isSigningOut.current = false;
    } finally {
      // US-007: Always remove the atomic logout flag in finally block
      // This ensures the flag is cleared even if an error occurs
      try {
        await AsyncStorage.removeItem('__logout_in_progress');
        console.log('🔓 Removed __logout_in_progress flag from AsyncStorage');
      } catch (flagError) {
        console.warn(
          '⚠️ Failed to remove __logout_in_progress flag:',
          flagError,
        );
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
      // Get Clerk user ID if available (for OAuth users)
      // clerkUser from useClerkUser() returns UseUserReturn which has id, emailAddresses, etc. when loaded
      // Using optional chaining to safely access id property
      const clerkUserId: string | undefined =
        (clerkUser as any)?.id || user.user_metadata?.clerk_user_id;

      // For OAuth users, check if profile exists in database first
      // Don't rely on userProfile context state as it may be stale
      if (clerkUserId) {
        console.log(
          '📋 [AuthContext] Checking for existing profile for Clerk user ID:',
          clerkUserId,
        );

        const { data: existingProfiles, error: fetchError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('clerk_user_id', clerkUserId)
          .limit(1);

        if (fetchError) {
          console.error(
            '❌ [AuthContext] Error checking for existing profile:',
            fetchError,
          );
          return { error: 'Failed to check profile status' };
        }

        const existingProfile =
          existingProfiles && existingProfiles.length > 0
            ? existingProfiles[0]
            : null;

        // Profile exists - update it
        if (existingProfile) {
          console.log(
            '✅ [AuthContext] Found existing profile, updating it:',
            existingProfile.id,
          );

          // For OAuth users, we need to update and then fetch separately
          // because RLS policies might block SELECT in the same query
          const { error: updateError } = await supabase
            .from('user_profiles')
            .update(profile as any)
            .eq('clerk_user_id', clerkUserId);

          if (updateError) {
            console.error(
              '❌ [AuthContext] Failed to update profile:',
              updateError,
            );
            return { error: updateError.message };
          }

          // Fetch the updated profile using clerk_user_id (which passes RLS)
          const { data: updatedProfiles, error: fetchError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('clerk_user_id', clerkUserId)
            .limit(1);

          if (fetchError || !updatedProfiles || updatedProfiles.length === 0) {
            console.error(
              '❌ [AuthContext] Failed to fetch updated profile:',
              fetchError,
            );
            return { error: 'Failed to fetch updated profile' };
          }

          const updatedProfile = updatedProfiles[0];
          console.log('✅ [AuthContext] Profile updated successfully');
          setUserProfile(updatedProfile);
          return {};
        }

        // Profile doesn't exist - create one using RPC function that bypasses RLS
        console.log(
          '📋 [AuthContext] No existing profile found, creating new profile for OAuth user',
        );

        // Generate unique username for OAuth users
        // If no email or username provided, generate one using Clerk user ID suffix
        const generateUniqueUsername = () => {
          if (profile.username) return profile.username;

          // Try to extract username from email (check both user.email and clerkUser emailAddresses)
          // clerkUser is UseUserReturn type, use type assertion to access properties
          const email =
            user.email || (clerkUser as any)?.emailAddresses?.[0]?.emailAddress;
          if (email) {
            const emailPrefix = email.split('@')[0];
            console.log(
              '📧 [AuthContext] Extracting username from email:',
              emailPrefix,
              'from',
              email,
            );
            return emailPrefix;
          }

          // For users without email (e.g., Apple "Hide My Email"), create unique username
          // Using last 8 characters of Clerk user ID for uniqueness
          const uniqueSuffix = clerkUserId.slice(-8);
          console.log(
            '🆔 [AuthContext] No email available, using Clerk user ID suffix:',
            uniqueSuffix,
          );
          return `user_${uniqueSuffix}`;
        };

        const generateDisplayName = () => {
          if (profile.display_name) return profile.display_name;
          if (profile.username) return profile.username;

          // Try to extract display name from email (check both user.email and clerkUser emailAddresses)
          // clerkUser is UseUserReturn type, use type assertion to access properties
          const email =
            user.email || (clerkUser as any)?.emailAddresses?.[0]?.emailAddress;
          if (email) {
            const emailPrefix = email.split('@')[0];
            const displayName =
              emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
            console.log(
              '📧 [AuthContext] Extracting display name from email:',
              displayName,
            );
            return displayName;
          }

          // For users without email, use a friendly default with unique suffix
          const uniqueSuffix = clerkUserId.slice(-8);
          console.log(
            '🆔 [AuthContext] No email available, using default display name with suffix:',
            uniqueSuffix,
          );
          return `User ${uniqueSuffix}`;
        };

        // Use RPC function to create profile (bypasses RLS)
        const { data: createdProfile, error: createError } = await (
          supabase as any
        )
          .rpc('create_oauth_user_profile', {
            p_clerk_user_id: clerkUserId,
            p_username: generateUniqueUsername(),
            p_display_name: generateDisplayName(),
            p_preferred_grade_level: profile.preferred_grade_level || 'K-2',
            p_email: user.email || null,
            p_speech_enabled: profile.speech_enabled ?? true,
          })
          .single();

        if (createError) {
          console.error(
            '❌ [AuthContext] Failed to create profile:',
            createError,
          );
          return { error: createError.message };
        }

        console.log(
          '✅ [AuthContext] Profile created successfully:',
          createdProfile?.id,
        );

        // Update the synthetic user's ID to match the generated profile ID
        // This ensures that future operations that check user.id === profile.id will work
        if (createdProfile && user.id !== createdProfile.id) {
          console.log(
            '🔗 [AuthContext] Updating synthetic user ID to match profile ID:',
            createdProfile.id,
          );
          setUser({
            ...user,
            id: createdProfile.id,
          });
        }

        setUserProfile(createdProfile as any);
        setNeedsProfileCompletion(false);
        return {};
      }

      // For non-OAuth users with profile in context, update it directly
      if (userProfile?.id) {
        const { data: updatedProfile, error } = await supabase
          .from('user_profiles')
          .update(profile as any)
          .eq('id', userProfile.id)
          .select()
          .single();

        if (error) {
          return { error: error.message };
        }

        setUserProfile(updatedProfile);
        return {};
      }

      // No Clerk user ID and no profile in context - shouldn't happen
      console.error(
        '❌ [AuthContext] Cannot update profile - no user identification available',
      );
      return { error: 'Unable to identify user profile' };
    } catch (error) {
      console.error('💥 [AuthContext] Profile update/create error:', error);
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
    storyCompleted?: boolean,
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
        storyCompleted: storyCompleted ?? true, // Default to true for backward compatibility
        metadata: {
          userXPBefore: userProfile?.total_xp || 0,
          timestamp: new Date().toISOString(),
          storyCompleted: storyCompleted ?? true,
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

  const signInWithGoogle = async (): Promise<{
    error?: string;
    showSessionHelp?: boolean;
    provider?: 'google' | 'apple';
  }> => {
    try {
      console.log(
        '🔐 [AuthContext] Initiating Google OAuth sign-in via Clerk...',
      );

      // Check if Clerk SSO is available
      if (!clerkSSO) {
        const error =
          'Clerk is not configured or not available. Please configure Clerk to use OAuth.';
        console.error('❌ [AuthContext]', error);
        return { error };
      }

      // US-004: Pre-OAuth session detection and cleanup
      // CRITICAL: Always check for stale tokens regardless of clerkAuth.isSignedIn
      // because Clerk's in-memory state may not reflect SecureStore reality after app restart
      console.log('🔍 [AuthContext] Pre-OAuth: Checking for stale sessions...');

      const hasTokens = await hasClerkTokens();
      const clerkIsSignedIn = clerkAuth?.isSignedIn || false;

      console.log('🔍 [AuthContext] Pre-OAuth state check:', {
        hasTokensInStorage: hasTokens,
        clerkIsSignedIn: clerkIsSignedIn,
      });

      // US-006: Enhanced Pre-OAuth Cleanup with Verification
      // If EITHER condition is true, we need to perform deep cleanup
      if (hasTokens || clerkIsSignedIn) {
        console.warn(
          '⚠️ [AuthContext] Stale session detected before Google OAuth, performing deep cleanup...',
        );

        // Step 1: Sign out from Clerk FIRST (per US-005 learnings)
        // This is critical because Clerk's __unstable__onAfterResponse callback
        // writes tokens back AFTER the API call returns
        try {
          await clerkAuth.signOut();
          console.log('✅ [AuthContext] Clerk signOut completed');
        } catch (signOutError) {
          console.warn(
            '⚠️ [AuthContext] Clerk signOut failed (may already be signed out):',
            signOutError,
          );
        }

        // Step 2: Wait 300ms for Clerk's async callbacks to complete
        console.log('⏳ [AuthContext] Waiting for async callbacks...');
        await new Promise(resolve => setTimeout(resolve, 300));

        // Step 3: Clear and verify tokens are actually deleted
        console.log('🧹 [AuthContext] Clearing all Clerk tokens...');
        const verified = await clearAndVerifyTokens();
        if (verified) {
          console.log('✅ [AuthContext] Tokens verified cleared');
        } else {
          console.warn(
            '⚠️ [AuthContext] Token verification failed on first attempt',
          );
        }

        // Step 4: Double-check with hasClerkTokens - if tokens reappeared, clear again
        const tokensReappeared = await hasClerkTokens();
        if (tokensReappeared) {
          console.warn(
            '⚠️ [AuthContext] Tokens reappeared after clearing! Performing second cleanup...',
          );
          await clearAndVerifyTokens();
        }

        // Step 5: Direct clearToken call for the primary JWT token as final safeguard
        console.log(
          '🧹 [AuthContext] Final safeguard: directly clearing primary JWT token...',
        );
        clerkTokenCache.clearToken('__clerk_client_jwt');

        console.log(
          '✅ [AuthContext] Deep cleanup complete, proceeding with Google OAuth',
        );
      } else {
        console.log(
          '✅ [AuthContext] No stale session detected, proceeding with clean Google OAuth',
        );
      }

      // Mark that we're processing OAuth
      isProcessingOAuth.current = true;

      // Use Clerk's useSSO hook to start OAuth flow
      console.log(
        '📋 [AuthContext] Calling Clerk startSSOFlow with strategy: oauth_google',
      );
      const result = await clerkSSO.startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: 'creativebridge://auth/callback',
      });

      console.log('🔄 [AuthContext] OAuth flow result:', {
        createdSessionId: result.createdSessionId,
        authSessionResult: result.authSessionResult?.type,
        hasSignUp: !!result.signUp,
        hasSignIn: !!result.signIn,
        signUpCreatedUserId: result.signUp?.createdUserId,
        signInIdentifier: result.signIn?.identifier,
      });

      // Check if user cancelled the OAuth flow
      if (
        result.authSessionResult?.type === 'cancel' ||
        result.authSessionResult?.type === 'dismiss'
      ) {
        isProcessingOAuth.current = false;
        console.log('ℹ️ [AuthContext] Google sign-in was cancelled by user');
        return {}; // Silent return for user cancellation
      }

      // CRITICAL FIX #5: Validate OAuth result identity before calling setActive
      // The previous fixes cleared client-side tokens, but Clerk's server and OAuth providers
      // can still return a STALE session. We must validate the OAuth result's user identity
      // BEFORE activating the session.
      if (result.createdSessionId && result.setActive) {
        console.log('🔍 [AuthContext] Validating OAuth result identity...');

        // Extract the user identity from OAuth result
        // Note: For sign-in, we'll validate using the identifier (email) and check after setActive
        const oauthUserId = result.signUp?.createdUserId;
        const oauthEmail =
          result.signUp?.emailAddress || result.signIn?.identifier;
        const isSignUp = !!result.signUp?.createdUserId;
        const isSignIn = !!result.signIn;

        console.log('🔍 [AuthContext] OAuth result identity:', {
          userId: oauthUserId,
          email: oauthEmail,
          isSignUp,
          isSignIn,
        });

        // CRITICAL: Check if this is the SAME user who just logged out
        // For sign-up flows, we can check the createdUserId
        // For sign-in flows, we'll verify after setActive() in post-activation check
        const previousUserId = await AsyncStorage.getItem(
          '__previous_clerk_user_id',
        );
        const previousLogoutTimestamp = await AsyncStorage.getItem(
          '__previous_logout_timestamp',
        );

        if (previousUserId && oauthUserId && oauthUserId === previousUserId) {
          const timeSinceLogout =
            Date.now() - parseInt(previousLogoutTimestamp || '0', 10);
          const wasRecentLogout = timeSinceLogout < 60000; // Within last 60 seconds

          if (wasRecentLogout) {
            console.error(
              '🚨 [AuthContext] CRITICAL: OAuth returned the PREVIOUS user who just logged out!',
            );
            console.error('🚨 [AuthContext] Previous user ID:', previousUserId);
            console.error(
              '🚨 [AuthContext] OAuth returned user ID:',
              oauthUserId,
            );
            console.error(
              '🚨 [AuthContext] Time since logout:',
              timeSinceLogout,
              'ms',
            );
            console.error('🚨 [AuthContext] This indicates:');
            console.error(
              '    1. OAuth provider (Google/Apple) has active OS-level session for previous user',
            );
            console.error(
              '    2. Clerk server recognized previous user and returned their session',
            );
            console.error(
              '🚨 [AuthContext] ABORTING OAuth flow - clearing tokens and rejecting',
            );

            // Emergency clear - remove tokens written during startSSOFlow
            await clearAllClerkTokens();

            // Clear the tracking data so next attempt doesn't fail
            await AsyncStorage.removeItem('__previous_clerk_user_id');
            await AsyncStorage.removeItem('__previous_logout_timestamp');

            // Reset OAuth processing flag
            isProcessingOAuth.current = false;

            // US-011: Return user-friendly error with showSessionHelp trigger
            return {
              error:
                'The previous user is still logged into Google/Apple at the system level. ' +
                'Please log out from Google/Apple in your device Settings, then try again.',
              showSessionHelp: true,
              provider: 'google',
            };
          } else {
            // More than 60 seconds ago - probably legitimate account linking
            console.log(
              'ℹ️ [AuthContext] Same user detected, but logout was >60s ago - allowing (likely account linking)',
            );
          }
        }

        // For sign-in flows (oauthUserId is undefined), we MUST check if Clerk is already signed in
        // because sign-in flows don't provide createdUserId before setActive()
        if (isSignIn && !oauthUserId) {
          console.log(
            'ℹ️ [AuthContext] Sign-in flow detected - checking for pre-existing Clerk session',
          );

          // CRITICAL FIX: For sign-in flows, check if Clerk is already signed in
          // This indicates OAuth reactivated the previous user's session
          if (clerkAuth?.isSignedIn && previousUserId) {
            const currentClerkUserId = clerkAuth.userId;
            const timeSinceLogout =
              Date.now() - parseInt(previousLogoutTimestamp || '0', 10);
            const wasRecentLogout = timeSinceLogout < 60000; // Within last 60 seconds

            if (wasRecentLogout && currentClerkUserId === previousUserId) {
              console.error(
                '🚨 [AuthContext] CRITICAL: Sign-in flow reactivated PREVIOUS user who just logged out!',
              );
              console.error(
                '🚨 [AuthContext] Previous user ID:',
                previousUserId,
              );
              console.error(
                '🚨 [AuthContext] Current Clerk user ID:',
                currentClerkUserId,
              );
              console.error(
                '🚨 [AuthContext] Time since logout:',
                timeSinceLogout,
                'ms',
              );
              console.error('🚨 [AuthContext] This indicates:');
              console.error(
                '    1. OAuth provider (Google/Apple) has active OS-level session for previous user',
              );
              console.error(
                '    2. Clerk recognized previous user and activated their session DURING startSSOFlow',
              );
              console.error(
                '🚨 [AuthContext] ABORTING - clearing session and rejecting',
              );

              // Emergency clear - remove the reactivated session
              await clearAllClerkTokens();
              await clerkAuth.signOut();
              await clearAllClerkTokens();

              // Clear tracking data
              await AsyncStorage.removeItem('__previous_clerk_user_id');
              await AsyncStorage.removeItem('__previous_logout_timestamp');

              // Reset OAuth processing flag
              isProcessingOAuth.current = false;

              // US-011: Return user-friendly error with showSessionHelp trigger
              return {
                error:
                  'The previous user is still logged into Google/Apple at the system level. ' +
                  'Please log out from Google/Apple in your device Settings, then try again.',
                showSessionHelp: true,
                provider: 'google',
              };
            }
          }
        }

        // ADDITIONAL CHECK: Verify Clerk isn't already signed in with wrong user (for sign-up flows)
        if (
          clerkAuth?.isSignedIn &&
          oauthUserId &&
          clerkAuth.userId !== oauthUserId
        ) {
          console.error(
            '🚨 [AuthContext] CRITICAL: Clerk already signed in with DIFFERENT user!',
          );
          console.error(
            '🚨 [AuthContext] Clerk active user:',
            clerkAuth.userId,
          );
          console.error('🚨 [AuthContext] OAuth returned user:', oauthUserId);
          console.error('🚨 [AuthContext] Force clearing and rejecting...');

          await clearAllClerkTokens();
          await clerkAuth.signOut();
          await clearAllClerkTokens();

          isProcessingOAuth.current = false;

          return {
            error: 'Session mismatch detected. Please try signing in again.',
          };
        }

        // Validation passed - proceed with setActive
        console.log(
          '✅ [AuthContext] OAuth identity validated, activating session...',
        );
        await result.setActive({ session: result.createdSessionId });
        console.log('✅ [AuthContext] Session activated successfully');

        // Clear the previous user tracking after successful different-user OAuth
        if (previousUserId && oauthUserId !== previousUserId) {
          console.log(
            '✅ [AuthContext] Different user signed in, clearing previous user tracking',
          );
          await AsyncStorage.removeItem('__previous_clerk_user_id');
          await AsyncStorage.removeItem('__previous_logout_timestamp');
        }

        // POST-ACTIVATION VERIFICATION: Double-check activated user
        const activatedUserId = clerkAuth?.userId;
        const previousUserIdAfterActivation = await AsyncStorage.getItem(
          '__previous_clerk_user_id',
        );

        if (
          activatedUserId &&
          previousUserIdAfterActivation &&
          activatedUserId === previousUserIdAfterActivation
        ) {
          const previousLogoutTimestampAfterActivation =
            await AsyncStorage.getItem('__previous_logout_timestamp');
          const timeSinceLogoutAfterActivation =
            Date.now() -
            parseInt(previousLogoutTimestampAfterActivation || '0', 10);

          if (timeSinceLogoutAfterActivation < 60000) {
            console.error(
              '🚨 [AuthContext] POST-ACTIVATION CRITICAL: Activated the SAME user who just logged out!',
            );
            console.error(
              '🚨 [AuthContext] This should have been caught in pre-activation validation!',
            );
            console.error('🚨 [AuthContext] Emergency rollback...');

            // Emergency rollback
            await clearAllClerkTokens();
            await clerkAuth.signOut();
            await clearAllClerkTokens();
            await AsyncStorage.removeItem('__previous_clerk_user_id');
            await AsyncStorage.removeItem('__previous_logout_timestamp');

            isProcessingOAuth.current = false;

            // US-011: Return user-friendly error with showSessionHelp trigger
            return {
              error:
                'Cannot sign in - previous user session detected. Please log out from ' +
                'Google/Apple in device Settings and try again.',
              showSessionHelp: true,
              provider: 'google',
            };
          }
        }

        console.log('✅ [AuthContext] Post-activation verification passed');
      }

      // Sync with Supabase after successful OAuth
      const syncResult = await syncClerkWithSupabase();
      if (!syncResult.success) {
        console.warn(
          '⚠️ [AuthContext] OAuth succeeded but Supabase sync failed:',
          syncResult.error,
        );
      }

      console.log('✅ [AuthContext] Google OAuth flow completed successfully');

      // Return success - the auth state change listener will handle the rest
      return {};
    } catch (error) {
      isProcessingOAuth.current = false;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      console.log(
        '🔍 [AuthContext] Google sign-in caught error:',
        errorMessage,
      );

      // Handle "already signed in" error - this means OAuth succeeded previously
      // but Supabase wasn't synced. Try to sync now.
      const isAlreadySignedIn = errorMessage
        .toLowerCase()
        .includes('already signed in');
      console.log(
        '🔍 [AuthContext] Is already signed in error?',
        isAlreadySignedIn,
      );

      if (isAlreadySignedIn) {
        console.log(
          '🔄 [AuthContext] User already signed in with Clerk, attempting to sync with Supabase...',
        );
        try {
          const syncResult = await syncClerkWithSupabase();
          console.log('🔍 [AuthContext] Sync result:', syncResult);
          if (syncResult.success) {
            console.log(
              '✅ [AuthContext] Synced existing Clerk session with Supabase',
            );
            return {}; // Success - user is now fully authenticated
          } else {
            console.error(
              '❌ [AuthContext] Failed to sync existing Clerk session:',
              syncResult.error,
            );
            return {
              error: syncResult.error || 'Failed to sync authentication',
            };
          }
        } catch (syncError) {
          console.error('💥 [AuthContext] Error during sync:', syncError);
          return { error: 'Failed to sync authentication' };
        }
      }

      console.error(
        '💥 [AuthContext] Unexpected error during Google sign-in:',
        error,
      );
      return { error: errorMessage };
    }
  };

  const signInWithApple = async (): Promise<{
    error?: string;
    showSessionHelp?: boolean;
    provider?: 'google' | 'apple';
  }> => {
    try {
      console.log(
        '🍎 [AuthContext] Initiating Apple OAuth sign-in via Clerk...',
      );

      // Check if Clerk SSO is available
      if (!clerkSSO) {
        const error =
          'Clerk is not configured or not available. Please configure Clerk to use OAuth.';
        console.error('❌ [AuthContext]', error);
        return { error };
      }

      // US-004: Pre-OAuth session detection and cleanup
      // CRITICAL: Always check for stale tokens regardless of clerkAuth.isSignedIn
      // because Clerk's in-memory state may not reflect SecureStore reality after app restart
      console.log('🔍 [AuthContext] Pre-OAuth: Checking for stale sessions...');

      const hasTokens = await hasClerkTokens();
      const clerkIsSignedIn = clerkAuth?.isSignedIn || false;

      console.log('🔍 [AuthContext] Pre-OAuth state check:', {
        hasTokensInStorage: hasTokens,
        clerkIsSignedIn: clerkIsSignedIn,
      });

      // US-006: Enhanced Pre-OAuth Cleanup with Verification
      // If EITHER condition is true, we need to perform deep cleanup
      if (hasTokens || clerkIsSignedIn) {
        console.warn(
          '⚠️ [AuthContext] Stale session detected before Apple OAuth, performing deep cleanup...',
        );

        // Step 1: Sign out from Clerk FIRST (per US-005 learnings)
        // This is critical because Clerk's __unstable__onAfterResponse callback
        // writes tokens back AFTER the API call returns
        try {
          await clerkAuth.signOut();
          console.log('✅ [AuthContext] Clerk signOut completed');
        } catch (signOutError) {
          console.warn(
            '⚠️ [AuthContext] Clerk signOut failed (may already be signed out):',
            signOutError,
          );
        }

        // Step 2: Wait 300ms for Clerk's async callbacks to complete
        console.log('⏳ [AuthContext] Waiting for async callbacks...');
        await new Promise(resolve => setTimeout(resolve, 300));

        // Step 3: Clear and verify tokens are actually deleted
        console.log('🧹 [AuthContext] Clearing all Clerk tokens...');
        const verified = await clearAndVerifyTokens();
        if (verified) {
          console.log('✅ [AuthContext] Tokens verified cleared');
        } else {
          console.warn(
            '⚠️ [AuthContext] Token verification failed on first attempt',
          );
        }

        // Step 4: Double-check with hasClerkTokens - if tokens reappeared, clear again
        const tokensReappeared = await hasClerkTokens();
        if (tokensReappeared) {
          console.warn(
            '⚠️ [AuthContext] Tokens reappeared after clearing! Performing second cleanup...',
          );
          await clearAndVerifyTokens();
        }

        // Step 5: Direct clearToken call for the primary JWT token as final safeguard
        console.log(
          '🧹 [AuthContext] Final safeguard: directly clearing primary JWT token...',
        );
        clerkTokenCache.clearToken('__clerk_client_jwt');

        console.log(
          '✅ [AuthContext] Deep cleanup complete, proceeding with Apple OAuth',
        );
      } else {
        console.log(
          '✅ [AuthContext] No stale session detected, proceeding with clean Apple OAuth',
        );
      }

      // Mark that we're processing OAuth
      isProcessingOAuth.current = true;

      // Use Clerk's useSSO hook to start OAuth flow
      console.log(
        '📋 [AuthContext] Calling Clerk startSSOFlow with strategy: oauth_apple',
      );
      console.log(
        '📱 [AuthContext] Platform-specific handling: Clerk will use native Apple Sign In on iOS',
      );

      const result = await clerkSSO.startSSOFlow({
        strategy: 'oauth_apple',
        redirectUrl: 'creativebridge://auth/callback',
      });

      console.log('🔄 [AuthContext] Apple OAuth flow result:', {
        createdSessionId: result.createdSessionId,
        authSessionResult: result.authSessionResult?.type,
        hasSignUp: !!result.signUp,
        hasSignIn: !!result.signIn,
        signUpCreatedUserId: result.signUp?.createdUserId,
        signInIdentifier: result.signIn?.identifier,
      });

      // Check if user cancelled the OAuth flow
      if (
        result.authSessionResult?.type === 'cancel' ||
        result.authSessionResult?.type === 'dismiss'
      ) {
        isProcessingOAuth.current = false;
        console.log('ℹ️ [AuthContext] Apple sign-in was cancelled by user');
        return {}; // Silent return for user cancellation
      }

      // CRITICAL FIX #5: Validate OAuth result identity before calling setActive
      // The previous fixes cleared client-side tokens, but Clerk's server and OAuth providers
      // can still return a STALE session. We must validate the OAuth result's user identity
      // BEFORE activating the session.
      if (result.createdSessionId && result.setActive) {
        console.log('🔍 [AuthContext] Validating OAuth result identity...');

        // Extract the user identity from OAuth result
        // Note: For sign-in, we'll validate using the identifier (email) and check after setActive
        const oauthUserId = result.signUp?.createdUserId;
        const oauthEmail =
          result.signUp?.emailAddress || result.signIn?.identifier;
        const isSignUp = !!result.signUp?.createdUserId;
        const isSignIn = !!result.signIn;

        console.log('🔍 [AuthContext] OAuth result identity:', {
          userId: oauthUserId,
          email: oauthEmail,
          isSignUp,
          isSignIn,
        });

        // CRITICAL: Check if this is the SAME user who just logged out
        // For sign-up flows, we can check the createdUserId
        // For sign-in flows, we'll verify after setActive() in post-activation check
        const previousUserId = await AsyncStorage.getItem(
          '__previous_clerk_user_id',
        );
        const previousLogoutTimestamp = await AsyncStorage.getItem(
          '__previous_logout_timestamp',
        );

        if (previousUserId && oauthUserId && oauthUserId === previousUserId) {
          const timeSinceLogout =
            Date.now() - parseInt(previousLogoutTimestamp || '0', 10);
          const wasRecentLogout = timeSinceLogout < 60000; // Within last 60 seconds

          if (wasRecentLogout) {
            console.error(
              '🚨 [AuthContext] CRITICAL: OAuth returned the PREVIOUS user who just logged out!',
            );
            console.error('🚨 [AuthContext] Previous user ID:', previousUserId);
            console.error(
              '🚨 [AuthContext] OAuth returned user ID:',
              oauthUserId,
            );
            console.error(
              '🚨 [AuthContext] Time since logout:',
              timeSinceLogout,
              'ms',
            );
            console.error('🚨 [AuthContext] This indicates:');
            console.error(
              '    1. OAuth provider (Google/Apple) has active OS-level session for previous user',
            );
            console.error(
              '    2. Clerk server recognized previous user and returned their session',
            );
            console.error(
              '🚨 [AuthContext] ABORTING OAuth flow - clearing tokens and rejecting',
            );

            // Emergency clear - remove tokens written during startSSOFlow
            await clearAllClerkTokens();

            // Clear the tracking data so next attempt doesn't fail
            await AsyncStorage.removeItem('__previous_clerk_user_id');
            await AsyncStorage.removeItem('__previous_logout_timestamp');

            // Reset OAuth processing flag
            isProcessingOAuth.current = false;

            // US-011: Return user-friendly error with showSessionHelp trigger
            return {
              error:
                'The previous user is still logged into Google/Apple at the system level. ' +
                'Please log out from Google/Apple in your device Settings, then try again.',
              showSessionHelp: true,
              provider: 'apple',
            };
          } else {
            // More than 60 seconds ago - probably legitimate account linking
            console.log(
              'ℹ️ [AuthContext] Same user detected, but logout was >60s ago - allowing (likely account linking)',
            );
          }
        }

        // For sign-in flows (oauthUserId is undefined), we MUST check if Clerk is already signed in
        // because sign-in flows don't provide createdUserId before setActive()
        if (isSignIn && !oauthUserId) {
          console.log(
            'ℹ️ [AuthContext] Sign-in flow detected - checking for pre-existing Clerk session',
          );

          // CRITICAL FIX: For sign-in flows, check if Clerk is already signed in
          // This indicates OAuth reactivated the previous user's session
          if (clerkAuth?.isSignedIn && previousUserId) {
            const currentClerkUserId = clerkAuth.userId;
            const timeSinceLogout =
              Date.now() - parseInt(previousLogoutTimestamp || '0', 10);
            const wasRecentLogout = timeSinceLogout < 60000; // Within last 60 seconds

            if (wasRecentLogout && currentClerkUserId === previousUserId) {
              console.error(
                '🚨 [AuthContext] CRITICAL: Sign-in flow reactivated PREVIOUS user who just logged out!',
              );
              console.error(
                '🚨 [AuthContext] Previous user ID:',
                previousUserId,
              );
              console.error(
                '🚨 [AuthContext] Current Clerk user ID:',
                currentClerkUserId,
              );
              console.error(
                '🚨 [AuthContext] Time since logout:',
                timeSinceLogout,
                'ms',
              );
              console.error('🚨 [AuthContext] This indicates:');
              console.error(
                '    1. OAuth provider (Google/Apple) has active OS-level session for previous user',
              );
              console.error(
                '    2. Clerk recognized previous user and activated their session DURING startSSOFlow',
              );
              console.error(
                '🚨 [AuthContext] ABORTING - clearing session and rejecting',
              );

              // Emergency clear - remove the reactivated session
              await clearAllClerkTokens();
              await clerkAuth.signOut();
              await clearAllClerkTokens();

              // Clear tracking data
              await AsyncStorage.removeItem('__previous_clerk_user_id');
              await AsyncStorage.removeItem('__previous_logout_timestamp');

              // Reset OAuth processing flag
              isProcessingOAuth.current = false;

              // US-011: Return user-friendly error with showSessionHelp trigger
              return {
                error:
                  'The previous user is still logged into Google/Apple at the system level. ' +
                  'Please log out from Google/Apple in your device Settings, then try again.',
                showSessionHelp: true,
                provider: 'apple',
              };
            }
          }
        }

        // ADDITIONAL CHECK: Verify Clerk isn't already signed in with wrong user (for sign-up flows)
        if (
          clerkAuth?.isSignedIn &&
          oauthUserId &&
          clerkAuth.userId !== oauthUserId
        ) {
          console.error(
            '🚨 [AuthContext] CRITICAL: Clerk already signed in with DIFFERENT user!',
          );
          console.error(
            '🚨 [AuthContext] Clerk active user:',
            clerkAuth.userId,
          );
          console.error('🚨 [AuthContext] OAuth returned user:', oauthUserId);
          console.error('🚨 [AuthContext] Force clearing and rejecting...');

          await clearAllClerkTokens();
          await clerkAuth.signOut();
          await clearAllClerkTokens();

          isProcessingOAuth.current = false;

          return {
            error: 'Session mismatch detected. Please try signing in again.',
          };
        }

        // Validation passed - proceed with setActive
        console.log(
          '✅ [AuthContext] OAuth identity validated, activating session...',
        );
        await result.setActive({ session: result.createdSessionId });
        console.log('✅ [AuthContext] Session activated successfully');
        console.log(
          '🍎 [AuthContext] Note: Apple may provide a private relay email - Clerk handles this automatically',
        );

        // Clear the previous user tracking after successful different-user OAuth
        if (previousUserId && oauthUserId !== previousUserId) {
          console.log(
            '✅ [AuthContext] Different user signed in, clearing previous user tracking',
          );
          await AsyncStorage.removeItem('__previous_clerk_user_id');
          await AsyncStorage.removeItem('__previous_logout_timestamp');
        }

        // POST-ACTIVATION VERIFICATION: Double-check activated user
        const activatedUserId = clerkAuth?.userId;
        const previousUserIdAfterActivation = await AsyncStorage.getItem(
          '__previous_clerk_user_id',
        );

        if (
          activatedUserId &&
          previousUserIdAfterActivation &&
          activatedUserId === previousUserIdAfterActivation
        ) {
          const previousLogoutTimestampAfterActivation =
            await AsyncStorage.getItem('__previous_logout_timestamp');
          const timeSinceLogoutAfterActivation =
            Date.now() -
            parseInt(previousLogoutTimestampAfterActivation || '0', 10);

          if (timeSinceLogoutAfterActivation < 60000) {
            console.error(
              '🚨 [AuthContext] POST-ACTIVATION CRITICAL: Activated the SAME user who just logged out!',
            );
            console.error(
              '🚨 [AuthContext] This should have been caught in pre-activation validation!',
            );
            console.error('🚨 [AuthContext] Emergency rollback...');

            // Emergency rollback
            await clearAllClerkTokens();
            await clerkAuth.signOut();
            await clearAllClerkTokens();
            await AsyncStorage.removeItem('__previous_clerk_user_id');
            await AsyncStorage.removeItem('__previous_logout_timestamp');

            isProcessingOAuth.current = false;

            // US-011: Return user-friendly error with showSessionHelp trigger
            return {
              error:
                'Cannot sign in - previous user session detected. Please log out from ' +
                'Google/Apple in device Settings and try again.',
              showSessionHelp: true,
              provider: 'apple',
            };
          }
        }

        console.log('✅ [AuthContext] Post-activation verification passed');
      }

      // Sync with Supabase after successful OAuth
      const syncResult = await syncClerkWithSupabase();
      if (!syncResult.success) {
        console.warn(
          '⚠️ [AuthContext] OAuth succeeded but Supabase sync failed:',
          syncResult.error,
        );
      }

      console.log('✅ [AuthContext] Apple OAuth flow completed successfully');

      // Return success - the auth state change listener will handle the rest
      return {};
    } catch (error) {
      isProcessingOAuth.current = false;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      console.log('🔍 [AuthContext] Apple sign-in caught error:', errorMessage);

      // Handle "already signed in" error - this means OAuth succeeded previously
      // but Supabase wasn't synced. Try to sync now.
      const isAlreadySignedIn = errorMessage
        .toLowerCase()
        .includes('already signed in');
      console.log(
        '🔍 [AuthContext] Is already signed in error?',
        isAlreadySignedIn,
      );

      if (isAlreadySignedIn) {
        console.log(
          '🔄 [AuthContext] User already signed in with Clerk, attempting to sync with Supabase...',
        );
        try {
          const syncResult = await syncClerkWithSupabase();
          console.log('🔍 [AuthContext] Sync result:', syncResult);
          if (syncResult.success) {
            console.log(
              '✅ [AuthContext] Synced existing Clerk session with Supabase',
            );
            return {}; // Success - user is now fully authenticated
          } else {
            console.error(
              '❌ [AuthContext] Failed to sync existing Clerk session:',
              syncResult.error,
            );
            return {
              error: syncResult.error || 'Failed to sync authentication',
            };
          }
        } catch (syncError) {
          console.error('💥 [AuthContext] Error during sync:', syncError);
          return { error: 'Failed to sync authentication' };
        }
      }

      console.error(
        '💥 [AuthContext] Unexpected error during Apple sign-in:',
        error,
      );
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

  /**
   * Award XP for completing onboarding milestones (US-010)
   * Each milestone can only award XP once per user.
   *
   * XP Rewards:
   * - first_story: +50 XP
   * - first_image: +25 XP
   * - first_voice: +25 XP
   * - first_streak: +50 XP
   */
  const awardOnboardingXP = async (
    milestoneType:
      | 'first_story'
      | 'first_image'
      | 'first_voice'
      | 'first_streak',
  ): Promise<{
    success: boolean;
    error?: string;
    newBalance?: number;
    xpAwarded: number;
  }> => {
    // Define XP amounts for each milestone
    const XP_REWARDS: Record<typeof milestoneType, number> = {
      first_story: 50,
      first_image: 25,
      first_voice: 25,
      first_streak: 50,
    };

    const xpAmount = XP_REWARDS[milestoneType];

    if (!user || !userProfile) {
      console.error('❌ Onboarding XP award failed: No user logged in');
      return {
        success: false,
        error: 'No user logged in',
        xpAwarded: 0,
      };
    }

    try {
      console.log('🎁 Awarding onboarding XP:', {
        userId: user.id,
        milestoneType,
        xpAmount,
        currentBalance: userProfile.total_xp,
      });

      // Use positive amount to add XP with the add_user_xp function
      const { error } = await supabase.rpc('add_user_xp', {
        user_uuid: user.id,
        xp_to_add: xpAmount,
        words_added: 0,
      });

      if (error) {
        console.error('❌ Database onboarding XP award failed:', error);
        return {
          success: false,
          error: `Database error: ${error.message}`,
          xpAwarded: 0,
        };
      }

      // Update local state immediately for better UX
      const newBalance = (userProfile.total_xp || 0) + xpAmount;
      const updatedProfile = {
        ...userProfile,
        total_xp: newBalance,
      };
      setUserProfile(updatedProfile);

      console.log('✅ Onboarding XP award successful:', {
        milestoneType,
        previousBalance: userProfile.total_xp,
        awardedAmount: xpAmount,
        newBalance,
      });

      // Track the XP award event
      await trackXPEvent({
        type: 'refund', // Using 'refund' type as it's a positive XP change
        amount: xpAmount,
        reason: `Onboarding milestone: ${milestoneType}`,
      });

      return {
        success: true,
        newBalance,
        xpAwarded: xpAmount,
      };
    } catch (error) {
      console.error('💥 Onboarding XP award exception:', error);
      return {
        success: false,
        error: 'An unexpected error occurred during onboarding XP award',
        xpAwarded: 0,
      };
    }
  };

  /**
   * Check if profile completion is needed for OAuth users
   * This checks if:
   * 1. User is an OAuth user (has Clerk user ID)
   * 2. Profile doesn't exist OR profile is incomplete (missing username or grade level)
   */
  const checkProfileCompletion = useCallback(async (): Promise<void> => {
    try {
      // Only check for OAuth users (users with Clerk user ID)
      if (!clerkUser?.id) {
        setNeedsProfileCompletion(false);
        return;
      }

      // Only check if email is confirmed
      // Note: OAuth users don't have a Supabase session, so we don't check for it
      if (!emailConfirmed) {
        setNeedsProfileCompletion(false);
        return;
      }

      const clerkUserId = clerkUser.id;

      // Check if profile exists and is complete
      if (userProfile) {
        // Profile exists - check if it's complete
        const isComplete =
          userProfile.username &&
          userProfile.username.trim().length > 0 &&
          userProfile.preferred_grade_level;

        setNeedsProfileCompletion(!isComplete);
        console.log(
          `📋 [AuthContext] Profile completion check: ${
            isComplete ? 'Complete' : 'Incomplete'
          }`,
        );
        return;
      }

      // No profile in context - check Supabase directly using Clerk user ID
      console.log(
        '📋 [AuthContext] Checking profile completion for Clerk user ID:',
        clerkUserId,
      );

      const { data: profiles, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('clerk_user_id', clerkUserId)
        .limit(1);

      if (profileError) {
        console.error(
          '❌ [AuthContext] Error checking profile:',
          profileError.message,
        );
        // On error, assume profile needs completion
        setNeedsProfileCompletion(true);
        return;
      }

      // Handle case where query returns array
      const profile = profiles && profiles.length > 0 ? profiles[0] : null;

      // Log warning if multiple profiles found (data integrity issue)
      if (profiles && profiles.length > 1) {
        console.warn(
          '⚠️ [AuthContext] Multiple profiles found for Clerk user ID. Using oldest profile.',
          `Found ${profiles.length} profiles for clerk_user_id: ${clerkUserId}`,
        );
      }

      if (profile) {
        // Profile exists in DB - check if it's complete
        const isComplete =
          profile.username &&
          profile.username.trim().length > 0 &&
          profile.preferred_grade_level;

        setNeedsProfileCompletion(!isComplete);
        console.log(
          `📋 [AuthContext] Profile found in DB: ${
            isComplete ? 'Complete' : 'Incomplete'
          }`,
        );

        // Update context with profile if it exists
        if (!userProfile) {
          setUserProfile(profile);
        }
      } else {
        // No profile found - needs completion
        setNeedsProfileCompletion(true);
        console.log(
          '📋 [AuthContext] No profile found - profile completion needed',
        );
      }
    } catch (error) {
      console.error(
        '❌ [AuthContext] Error checking profile completion:',
        error,
      );
      // On error, assume profile needs completion to be safe
      setNeedsProfileCompletion(true);
    }
  }, [clerkUser?.id, session, emailConfirmed, userProfile]);

  /**
   * Sync Clerk auth state with Supabase
   * This can be called:
   * 1. After OAuth flow completes
   * 2. On app initialization when Clerk is signed in but Supabase isn't
   * 3. When we get "already signed in" error during OAuth attempt
   */
  const syncClerkWithSupabase = useCallback(async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    if (!clerkAuth?.isSignedIn || !clerkAuth) {
      console.log('⚠️ [AuthContext] Cannot sync: Clerk user is not signed in');
      return { success: false, error: 'User is not signed in with Clerk' };
    }

    // Clear signing out flag if it's stuck - this is a new sign-in operation
    if (isSigningOut.current) {
      console.log(
        '🔄 [AuthContext] Clearing stuck isSigningOut flag for new OAuth sign-in',
      );
      isSigningOut.current = false;
    }

    try {
      console.log('🔄 [AuthContext] Syncing Clerk auth with Supabase...');

      // Convert Clerk auth to the interface expected by oauthService
      const clerkAuthMethods: ClerkAuthMethods = {
        getToken: clerkAuth.getToken.bind(clerkAuth),
        userId: clerkAuth.userId,
        isSignedIn: clerkAuth.isSignedIn,
      };

      // Convert Clerk user to the interface expected by oauthService
      const clerkUserData: ClerkUser | null = clerkUser
        ? {
            id: clerkUser.id,
            emailAddresses: clerkUser.emailAddresses || [],
            firstName: clerkUser.firstName,
            lastName: clerkUser.lastName,
          }
        : null;

      // Complete OAuth flow: get JWT and sync with Supabase
      const oauthResult = await completeOAuthFlow(
        clerkAuthMethods,
        clerkUserData,
      );

      if (!oauthResult.success) {
        const errorMessage =
          oauthResult.error || 'Unknown error during OAuth completion';
        const errorType = oauthResult.errorType || 'UNKNOWN';

        console.error(
          '❌ [AuthContext] Failed to complete OAuth flow:',
          errorMessage,
        );
        console.error('❌ [AuthContext] Error type:', errorType);

        // Log account linking errors for monitoring
        if (
          errorType === 'ACCOUNT_LINKING_CONFLICT' ||
          errorType === 'DATABASE_ERROR'
        ) {
          console.error(
            '⚠️ [AuthContext] Account linking error detected - user will see error message',
          );
          const errorContext = {
            errorType,
            errorMessage,
            clerkUserId:
              clerkUserData?.id || clerkAuthMethods.userId || 'unknown',
            timestamp: new Date().toISOString(),
          };
          console.error(
            '📊 [AuthContext] Account linking error context for monitoring:',
            errorContext,
          );
        }

        isProcessingOAuth.current = false;

        // Log error for monitoring and debugging
        console.error(
          '❌ [AuthContext] OAuth completion error details:',
          JSON.stringify(
            {
              errorMessage,
              errorType,
              clerkUserId:
                clerkUserData?.id || clerkAuthMethods.userId || 'unknown',
              timestamp: new Date().toISOString(),
            },
            null,
            2,
          ),
        );

        // Store error for display to user
        // Use error handler to get user-friendly message
        try {
          const { handleOAuthError } = require('../utils/oauthErrorHandler');
          const errorResult = handleOAuthError(errorMessage, {
            provider: 'google', // Default, will be refined based on actual provider
            attemptNumber: 1,
          });

          if (errorResult.shouldShowError) {
            setOAuthError(errorResult.userMessage);
            // Clear error after 10 seconds
            setTimeout(() => {
              setOAuthError(null);
            }, 10000);
          }
        } catch (importError) {
          // Fallback if error handler import fails
          console.error('Error importing oauthErrorHandler:', importError);
          setOAuthError(errorMessage);
          setTimeout(() => {
            setOAuthError(null);
          }, 10000);
        }

        // Note: Error from OAuth completion is not directly returned to button components
        // because the OAuth flow is asynchronous (initiation → callback → completion)
        // If completion fails, the user won't be signed in and can try again
        // The button components handle errors from the initiation phase
        return;
      }

      console.log('✅ [AuthContext] OAuth flow completed successfully');

      // Clear any previous OAuth errors on success
      setOAuthError(null);

      // OAuth users bypass email confirmation (handled by Clerk)
      // This applies to both Google and Apple OAuth users
      setEmailConfirmed(true);
      console.log(
        '✅ [AuthContext] Email confirmed automatically for OAuth user (bypassed email confirmation)',
      );

      // Create a synthetic user object for OAuth users
      // This is needed because components like HomeScreen check for `user` to allow actions
      // Since we don't create a Supabase session for OAuth users, we create a user-like object
      const oauthUserId = oauthResult.clerkUserId || clerkAuth?.userId;
      if (oauthUserId) {
        const syntheticUser = {
          id: oauthUserId,
          email:
            oauthResult.userEmail ||
            clerkUser?.emailAddresses?.[0]?.emailAddress ||
            '',
          email_confirmed_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          app_metadata: { provider: 'clerk_oauth' },
          user_metadata: {
            clerk_user_id: oauthUserId,
            full_name:
              clerkUser?.firstName && clerkUser?.lastName
                ? `${clerkUser.firstName} ${clerkUser.lastName}`
                : clerkUser?.firstName || '',
          },
          aud: 'authenticated',
          role: 'authenticated',
        } as User;

        console.log('👤 [AuthContext] Created synthetic user for OAuth:', {
          id: syntheticUser.id,
          email: syntheticUser.email,
        });

        setUser(syntheticUser);
      }

      // Handle Apple private relay email mapping
      // Clerk provides the email (whether real or private relay) in oauthResult.userEmail
      if (oauthResult.userEmail) {
        console.log(
          '📧 [AuthContext] User email from OAuth:',
          oauthResult.userEmail,
        );

        // Log if this appears to be an Apple private relay email
        if (
          oauthResult.userEmail.includes('privaterelay') ||
          oauthResult.userEmail.includes('icloud.com')
        ) {
          console.log(
            '🍎 [AuthContext] Apple private relay email detected - this is normal for Apple Sign In users who choose to hide their email',
          );
          console.log(
            'ℹ️ [AuthContext] Private relay emails are stable per user and can be used for account identification',
          );
        }
      }

      // Update user profile if available
      // Note: Account linking is handled automatically by syncClerkUserIdToProfile
      // which checks for existing Supabase profiles and links them to the Clerk user ID
      if (oauthResult.clerkUserId) {
        console.log(
          '👤 [AuthContext] Looking up user profile with Clerk user ID:',
          oauthResult.clerkUserId,
        );
        console.log(
          '🔗 [AuthContext] Account linking was handled during OAuth completion',
        );

        // Find profile with Clerk user ID (account linking should have already happened)
        const { data: profiles, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('clerk_user_id', oauthResult.clerkUserId)
          .limit(1);

        if (profileError) {
          console.error(
            '❌ [AuthContext] Error finding profile:',
            profileError.message,
          );
        }

        // Handle case where query returns array
        const profile = profiles && profiles.length > 0 ? profiles[0] : null;

        // Log warning if multiple profiles found (data integrity issue)
        if (profiles && profiles.length > 1) {
          console.warn(
            '⚠️ [AuthContext] Multiple profiles found for Clerk user ID. Using oldest profile.',
            `Found ${profiles.length} profiles for clerk_user_id: ${oauthResult.clerkUserId}`,
          );
        }

        if (profile) {
          console.log('✅ [AuthContext] User profile found and loaded');
          console.log(
            '✅ [AuthContext] Profile ID:',
            profile.id,
            'Username:',
            profile.username,
          );
          setUserProfile(profile);
        } else {
          // Profile will be created during profile completion (Task 5.1)
          console.log(
            '📋 [AuthContext] Profile not found. Will be created during profile completion',
          );
          console.log(
            'ℹ️ [AuthContext] This is normal for new OAuth users or if account linking did not find a matching profile',
          );
        }

        // Check if profile completion is needed after OAuth
        await checkProfileCompletion();
      }

      // Mark OAuth processing as complete
      isProcessingOAuth.current = false;

      // Track that we've successfully synced this Clerk user ID
      if (oauthResult.clerkUserId) {
        lastSyncedClerkUserId.current = oauthResult.clerkUserId;
      }

      return { success: true };
    } catch (error) {
      console.error(
        '💥 [AuthContext] Error syncing Clerk with Supabase:',
        error,
      );
      isProcessingOAuth.current = false;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error during sync';
      return { success: false, error: errorMessage };
    }
  }, [clerkAuth, clerkUser]);

  // Handle Clerk OAuth completion after callback (wraps syncClerkWithSupabase)
  const handleClerkOAuthCompletion = useCallback(async () => {
    // Only process if we're in the middle of an OAuth flow and Clerk user is signed in
    if (!isProcessingOAuth.current || !clerkAuth?.isSignedIn) {
      return;
    }

    await syncClerkWithSupabase();
  }, [clerkAuth?.isSignedIn, syncClerkWithSupabase]);

  // Monitor Clerk auth state changes to detect OAuth completion or existing session
  useEffect(() => {
    const checkAndSync = async () => {
      console.log('🔍 [AuthContext] Clerk auth state changed:', {
        isSignedIn: clerkAuth?.isSignedIn,
        userId: clerkAuth?.userId,
        hasSession: !!session,
        hasUser: !!user,
        isProcessingOAuth: isProcessingOAuth.current,
        isSigningOut: isSigningOut.current,
      });

      // Skip syncing if we're in the middle of signing out
      if (isSigningOut.current) {
        console.log('⏭️ [AuthContext] Skipping sync - signing out in progress');
        return;
      }

      // If Clerk is signed in but we don't have a session or user, try to sync
      // Check if we've already synced this Clerk user ID to prevent infinite loops
      const currentClerkUserId = clerkAuth?.userId;
      const alreadySynced =
        currentClerkUserId === lastSyncedClerkUserId.current;

      if (
        clerkAuth?.isSignedIn &&
        !session &&
        !user &&
        !loading &&
        !alreadySynced
      ) {
        console.log(
          '🔄 [AuthContext] Clerk signed in but no session/user - attempting sync...',
        );
        const syncResult = await syncClerkWithSupabase();
        if (syncResult.success) {
          console.log(
            '✅ [AuthContext] Auto-synced Clerk session with Supabase',
          );
        } else {
          console.error('❌ [AuthContext] Auto-sync failed:', syncResult.error);
        }
      } else if (alreadySynced && clerkAuth?.isSignedIn && !user) {
        console.log(
          '⏭️ [AuthContext] Skipping sync - already synced this Clerk user ID',
        );
      }
      // Check for OAuth completion when Clerk auth state changes during OAuth flow
      else if (clerkAuth?.isSignedIn && isProcessingOAuth.current) {
        handleClerkOAuthCompletion();
      }
    };

    checkAndSync();
  }, [clerkAuth?.isSignedIn, clerkAuth?.userId, session, user, loading]);

  useEffect(() => {
    const initializeAuth = async () => {
      // Skip initialization if we're signing out
      if (isSigningOut.current) {
        console.log(
          '⏭️ [AuthContext] Skipping auth init - signing out in progress',
        );
        return;
      }

      try {
        console.log('🔄 Starting auth initialization...');

        // US-007: Check for interrupted logout (app was backgrounded during logout)
        // If the __logout_in_progress flag exists, the previous logout didn't complete
        // We need to finish the token cleanup before proceeding
        const logoutInProgress = await AsyncStorage.getItem(
          '__logout_in_progress',
        );
        if (logoutInProgress === 'true') {
          console.warn(
            '⚠️ [AuthContext] Detected interrupted logout - completing token cleanup...',
          );
          try {
            // Complete the interrupted logout by clearing all Clerk tokens
            await clearAndVerifyTokens();
            console.log(
              '✅ [AuthContext] Completed interrupted logout - tokens cleared',
            );
          } catch (cleanupError) {
            console.error(
              '❌ [AuthContext] Error completing interrupted logout:',
              cleanupError,
            );
          } finally {
            // Always remove the flag, even if cleanup fails
            await AsyncStorage.removeItem('__logout_in_progress');
            console.log(
              '🔓 [AuthContext] Removed __logout_in_progress flag after completing interrupted logout',
            );
          }
        }

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
          // Handle invalid refresh token by clearing the stale session data
          // This is a known/expected error when session expires, so we log as warn not error
          if (
            error.code === 'refresh_token_not_found' ||
            error.message?.includes('Refresh Token Not Found')
          ) {
            console.warn(
              '⚠️ Session expired (refresh token not found) - clearing stale data...',
            );
            try {
              // Sign out to clear the invalid session data
              await supabase.auth.signOut();
              console.log('✅ Cleared invalid session data');
            } catch (signOutError) {
              console.error('❌ Error clearing session:', signOutError);
            }
          } else {
            // Log other session errors normally
            console.error('❌ Error getting session:', error);
          }

          // Continue initialization with no session (treat as logged out)
          setSession(null);
          setUser(null);
          // Don't set loading false yet - continue to check for Clerk auth below
        } else {
          // No error - process the session normally
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
        }

        // Debug Clerk auth state
        console.log('🔍 [AuthContext] Clerk auth state on init:', {
          isSignedIn: clerkAuth?.isSignedIn,
          userId: clerkAuth?.userId,
          hasClerkUser: !!clerkUser,
          clerkUserId: clerkUser?.id,
        });

        // Check if Clerk user is signed in but Supabase session is missing
        // This can happen if OAuth completed but sync failed, or app was killed mid-flow, or refresh token was invalid
        if (clerkAuth?.isSignedIn && !initialSession) {
          console.log(
            '🔐 [AuthContext] Clerk user is signed in but no Supabase session found. Syncing...',
          );
          const syncResult = await syncClerkWithSupabase();
          if (syncResult.success) {
            console.log(
              '✅ [AuthContext] Successfully synced Clerk session with Supabase on init',
            );
          } else {
            console.error(
              '❌ [AuthContext] Failed to sync Clerk session on init:',
              syncResult.error,
            );
          }
        }
        // Also handle case where we're in the middle of OAuth processing
        else if (
          clerkAuth?.isSignedIn &&
          clerkUser &&
          isProcessingOAuth.current
        ) {
          console.log(
            '🔐 [AuthContext] Clerk user is signed in, checking for OAuth completion...',
          );
          // This will trigger the OAuth completion handler
          await handleClerkOAuthCompletion();
        }

        // Check profile completion after initialization
        if (initialSession?.user && emailConfirmed) {
          await checkProfileCompletion();
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

    initializeAuth();

    let authSubscription: { unsubscribe: () => void } | null = null;

    const setupAuthListener = async () => {
      // Skip setting up listener if we're signing out
      if (isSigningOut.current) {
        console.log(
          '⏭️ [AuthContext] Skipping auth listener setup - signing out in progress',
        );
        return;
      }

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
            'isSigningOut:',
            isSigningOut.current,
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

          // US-008: Skip processing auth changes during logout to prevent race conditions
          // We check both the in-memory ref (for in-session logouts) and the persistent
          // AsyncStorage flag (for interrupted logouts that may have restarted the app)
          if (isSigningOut.current) {
            console.log(
              '⏭️ [AuthContext] Skipping auth state change - isSigningOut.current is true',
            );
            return;
          }

          // US-008: Also check AsyncStorage for __logout_in_progress flag
          // This catches edge cases where the app restarted during logout but
          // the auth state change fires before initializeAuth can complete cleanup
          try {
            const logoutInProgress = await AsyncStorage.getItem(
              '__logout_in_progress',
            );
            if (logoutInProgress === 'true') {
              console.log(
                '⏭️ [AuthContext] Skipping auth state change - __logout_in_progress flag detected in AsyncStorage',
              );
              return;
            }
          } catch (flagCheckError) {
            // If we can't check the flag, continue with caution (log but don't block)
            console.warn(
              '⚠️ [AuthContext] Failed to check __logout_in_progress flag:',
              flagCheckError,
            );
          }

          setSession(currentSession);
          setUser(currentSession?.user ?? null);

          if (currentSession?.user) {
            // Check email confirmation status
            const isEmailConfirmed = !!currentSession.user.email_confirmed_at;
            setEmailConfirmed(isEmailConfirmed);

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

            // Check profile completion after profile is loaded (for OAuth users)
            if (isEmailConfirmed && clerkUser?.id) {
              // Use setTimeout to ensure state is updated before checking
              setTimeout(async () => {
                await checkProfileCompletion();
              }, 100);
            }
          } else {
            setUserProfile(null);
            setEmailConfirmed(false);
            setNeedsProfileCompletion(false);
          }

          setLoading(false);
        });

        authSubscription = subscription;
      } catch (error) {
        console.error('Error setting up auth listener:', error);
      }
    };

    // Note: initializeAuth() is already called at line 1736, don't call twice
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
      // Check profile completion after refresh
      await checkProfileCompletion();
    } else if (
      clerkUser &&
      'id' in clerkUser &&
      typeof clerkUser.id === 'string'
    ) {
      // Fallback for OAuth users if user.id is not set yet
      console.log(
        '🔄 [AuthContext] Refreshing profile using Clerk user ID:',
        clerkUser.id,
      );
      const profile = await fetchUserProfile(clerkUser.id as string);
      setUserProfile(profile);
      await checkProfileCompletion();
    }
  }, [user?.id, clerkUser, checkProfileCompletion]);

  const clearOAuthError = useCallback(() => {
    setOAuthError(null);
  }, []);

  const value: AuthContextType = {
    session,
    user,
    userProfile,
    loading,
    emailConfirmed,
    needsProfileCompletion,
    oauthError,
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
    awardOnboardingXP,
    validateXPBalance,
    getXPBalanceInfo,
    canGenerateImage,
    trackXPEvent,
    createImageGenerationEvent,
    signInWithGoogle,
    signInWithApple,
    checkProfileCompletion,
    clearOAuthError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Export AuthProviderWithClerk as the main AuthProvider
// It will be wrapped in ConditionalClerkProvider when Clerk is configured
export const AuthProvider = AuthProviderWithClerk;
