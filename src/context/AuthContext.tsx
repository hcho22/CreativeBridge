import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import AsyncStorage from '../utils/asyncStorageWrapper';
import { supabase } from '../services/supabase';
import { useSafeClerkAuth } from '../hooks/useSafeClerkAuth';
// Note (US-016): completeOAuthFlow, ClerkAuthMethods, ClerkUser removed — no longer needed
import type { UserProfile, GradeLevel, StoryGenre } from '../types/database';
import { RememberMeStorage } from '../utils/rememberMeStorage';
import { xpEventTracker } from '../services/xpEventTracker';
import {
  clearAllClerkTokens,
  clearAndVerifyTokens,
  hasClerkTokens,
  clerkTokenCache,
} from '../utils/clerkTokenCache';
import * as WebBrowser from 'expo-web-browser';
// Convex imports for database migration (US-017)
import { useQuery, useMutation, useConvex } from 'convex/react';
import { api } from '../services/convex';
import type { Doc } from '../../convex/_generated/dataModel';

/**
 * Simplified user type for auth context (US-016).
 * Replaces Supabase `User` — consumers only need id and email.
 */
export interface AppUser {
  id: string;
  email: string;
}

/**
 * Helper to convert Convex userProfile to legacy UserProfile type
 * This ensures backward compatibility during the migration period.
 */
export const convertConvexProfileToLegacy = (
  convexProfile: Doc<'userProfiles'>,
): UserProfile => ({
  id: convexProfile._id,
  clerk_user_id: convexProfile.clerkUserId,
  username: convexProfile.username,
  display_name: convexProfile.displayName,
  total_xp: convexProfile.totalXp,
  current_streak: convexProfile.currentStreak,
  longest_streak: convexProfile.longestStreak,
  last_activity_date: convexProfile.lastActivityDate,
  best_score: convexProfile.bestScore,
  total_games_played: convexProfile.totalGamesPlayed,
  total_stories_completed: convexProfile.totalStoriesCompleted,
  total_words_written: convexProfile.totalWordsWritten,
  preferred_grade_level: convexProfile.preferredGradeLevel as GradeLevel,
  speech_enabled: convexProfile.speechEnabled,
  preferred_genre: convexProfile.preferredGenre as StoryGenre | undefined,
  avatar_url: convexProfile.avatarUrl,
  bio: convexProfile.bio,
  onboarding_completed: convexProfile.onboardingCompleted,
  onboarding_progress: convexProfile.onboardingProgress,
  first_story_completed_at: convexProfile.firstStoryCompletedAt,
  first_image_generated_at: convexProfile.firstImageGeneratedAt,
  first_voice_input_at: convexProfile.firstVoiceInputAt,
  first_streak_achieved_at: convexProfile.firstStreakAchievedAt,
  created_at: new Date(convexProfile._creationTime).toISOString(),
  updated_at: new Date().toISOString(),
});

interface SignUpData {
  username: string;
  displayName?: string;
  gradeLevel: GradeLevel;
}

/**
 * Pending profile data stored in AsyncStorage during Clerk email/password sign-up.
 * This data is stored after sign-up but before email verification,
 * and used to create the Convex profile after verification completes.
 */
interface PendingClerkProfile {
  username: string;
  displayName: string;
  gradeLevel: GradeLevel;
  email: string;
  createdAt: string;
}

// AsyncStorage key for pending Clerk profile data (US-002)
const PENDING_CLERK_PROFILE_KEY = '@CreativeBridge:pendingClerkProfile';

// AsyncStorage key for pending migration data (US-007)
const PENDING_MIGRATION_KEY = '@CreativeBridge:pendingMigration';

/**
 * Data stored in AsyncStorage during Supabase → Clerk migration (US-007).
 * Persisted between Phase A (create Clerk account) and Phase B (post-verification data transfer).
 */
interface PendingMigrationData {
  supabaseUserId: string;
  email: string;
  // Profile stats to migrate
  totalXp: number;
  currentStreak: number;
  longestStreak: number;
  bestScore: number;
  totalGamesPlayed: number;
  totalStoriesCompleted: number;
  totalWordsWritten: number;
  lastActivityDate: string;
  preferredGradeLevel: GradeLevel;
  onboardingCompleted: boolean;
  onboardingProgress: {
    create_account: boolean;
    first_story: boolean;
    first_image: boolean;
    first_voice: boolean;
    first_streak: boolean;
  };
  firstStoryCompletedAt?: string;
  firstImageGeneratedAt?: string;
  firstVoiceInputAt?: string;
  firstStreakAchievedAt?: string;
  // Game sessions to migrate
  gameSessions: Array<{
    completedAt?: string;
    gradeLevel: string;
    finalScore: number;
    wordsWritten: number;
    sentencesCompleted: number;
    challengesCompleted: number;
    xpEarned: number;
    storyContent?: string;
    importedStoryContent?: string;
    storySource: string;
    originalCreationDate?: string;
    storyMetadata?: Record<string, unknown>;
    generatedImageUrl?: string;
    imageGenerationTimestamp?: string;
    imageGenerationCost?: number;
    currentRound: number;
  }>;
}

interface AuthContextType {
  user: AppUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  emailConfirmed: boolean;
  needsProfileCompletion: boolean;
  oauthError: string | null; // Latest OAuth error (for display)
  signIn: (
    email: string,
    password: string,
    rememberMe?: boolean,
  ) => Promise<{
    error?: string;
    needsMigration?: boolean;
    needsSecondFactor?: boolean;
  }>;
  signOut: () => Promise<void>;
  updateProfile: (profile: Partial<UserProfile>) => Promise<{ error?: string }>;
  refreshProfile: () => Promise<void>;
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
  // Clerk email/password authentication (US-002)
  signUpWithClerk: (
    email: string,
    password: string,
    profileData: SignUpData,
  ) => Promise<{ needsVerification?: boolean; error?: string }>;
  // Clerk email verification (US-003)
  verifyEmailCode: (code: string) => Promise<{ error?: string }>;
  // Clerk resend verification code (US-004)
  resendClerkVerificationCode: () => Promise<{ error?: string }>;
  // Clerk email/password sign-in (US-005)
  signInWithClerk: (
    email: string,
    password: string,
  ) => Promise<{
    needsMigration?: boolean;
    needsSecondFactor?: boolean;
    error?: string;
  }>;
  // Clerk sign-in second factor verification
  verifySignInSecondFactor: (code: string) => Promise<{ error?: string }>;
  // Clerk password reset (US-006)
  resetPasswordWithClerk: (
    email: string,
  ) => Promise<{ needsCode?: boolean; error?: string }>;
  verifyPasswordResetCode: (
    code: string,
    newPassword: string,
  ) => Promise<{ error?: string }>;
  // Supabase → Clerk/Convex migration (US-007)
  migrateFromSupabase: (
    email: string,
    password: string,
  ) => Promise<{
    needsVerification?: boolean;
    needsNewPassword?: boolean;
    error?: string;
  }>;
  resumeMigrationWithNewPassword: (
    newPassword: string,
  ) => Promise<{ needsVerification?: boolean; error?: string }>;
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
  const [user, setUser] = useState<AppUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);
  const [oauthError, setOAuthError] = useState<string | null>(null);

  // Get Clerk auth and user hooks
  // This component is only rendered when ClerkProvider is present, so hooks are safe
  const { clerkAuth, clerkUser, clerkSSO, clerkSignIn, clerkSignUp } =
    useSafeClerkAuth();

  // Track if we're processing an OAuth flow
  const isProcessingOAuth = useRef(false);

  // Track if we're signing out to prevent re-syncing during logout
  const isSigningOut = useRef(false);

  // Track the last Clerk user ID we synced to prevent infinite sync loops
  const lastSyncedClerkUserId = useRef<string | null>(null);

  // ============================================================================
  // CONVEX INTEGRATION (US-017)
  // ============================================================================

  // Get Convex client for direct mutations
  const convex = useConvex();

  // Convex mutations for user profile operations
  const convexCreateProfile = useMutation(api.userProfiles.createOAuthProfile);
  const convexUpdateProfile = useMutation(api.userProfiles.updateProfile);
  const convexAddXp = useMutation(api.userProfiles.addUserXp);
  const convexDeductXp = useMutation(api.userProfiles.deductUserXp);
  const convexRefundXp = useMutation(api.userProfiles.refundUserXp);
  const convexMigrateStats = useMutation(api.userProfiles.migrateUserStats);
  const convexMigrateGameSessions = useMutation(
    api.migration.migrateUserGameSessions,
  );
  const convexLogMigrationEvent = useMutation(api.migration.logMigrationEvent);

  // Convex reactive query for current user's profile
  // This will automatically update when the profile changes in the database
  const clerkUserId = clerkAuth?.userId;
  const convexProfile = useQuery(
    api.userProfiles.getProfileByClerkId,
    clerkUserId ? { clerkUserId } : 'skip',
  );

  // Effect to sync Convex profile to local state
  // This replaces the manual fetchUserProfile for OAuth users
  useEffect(() => {
    if (convexProfile && clerkUserId) {
      // Convert Convex profile to legacy format
      const legacyProfile = convertConvexProfileToLegacy(convexProfile);

      // Only update state if values actually changed to prevent infinite re-renders
      // Compare key fields that would trigger dependent useEffects
      setUserProfile(currentProfile => {
        if (
          currentProfile &&
          currentProfile.total_xp === legacyProfile.total_xp &&
          currentProfile.speech_enabled === legacyProfile.speech_enabled &&
          currentProfile.preferred_grade_level ===
            legacyProfile.preferred_grade_level &&
          currentProfile.current_streak === legacyProfile.current_streak &&
          currentProfile.username === legacyProfile.username &&
          currentProfile.preferred_genre === legacyProfile.preferred_genre
        ) {
          // No meaningful change, return current state to prevent re-render
          return currentProfile;
        }

        console.log('🔄 [Convex] Profile updated from reactive query:', {
          clerkUserId,
          username: convexProfile.username,
          totalXp: convexProfile.totalXp,
        });

        return legacyProfile;
      });
    }
  }, [convexProfile, clerkUserId]);

  // Note (US-016): Supabase fallback and migration effects removed.
  // Convex reactive query (above) is the sole profile data source.

  // Note (US-016): fetchUserProfile and createUserProfile removed.
  // Profile data comes from Convex reactive query; creation via convexCreateProfile mutation.

  const signIn = async (
    email: string,
    password: string,
    rememberMe = false,
  ): Promise<{
    error?: string;
    needsMigration?: boolean;
    needsSecondFactor?: boolean;
  }> => {
    try {
      console.log('🔐 Attempting sign in (Clerk-first)', { email, rememberMe });

      // US-005: Try Clerk sign-in first
      const clerkResult = await signInWithClerk(email, password);

      if (clerkResult.needsSecondFactor) {
        // Second factor required — email code already sent by signInWithClerk
        console.log('🔐 Sign-in requires second factor verification');
        // Store rememberMe for after second factor completes
        await RememberMeStorage.setRememberMe(rememberMe, email);
        return { needsSecondFactor: true };
      }

      if (!clerkResult.error && !clerkResult.needsMigration) {
        // Clerk sign-in successful
        await RememberMeStorage.setRememberMe(rememberMe, email);
        console.log('✅ Sign in successful via Clerk', { rememberMe });
        return {};
      }

      if (clerkResult.needsMigration) {
        // User not found in Clerk — legacy Supabase user needs migration
        console.log('🔄 User not in Clerk — needs migration (US-007)');
        return { needsMigration: true };
      }

      // Clerk returned an error (e.g., wrong password, OAuth-only account)
      return { error: clerkResult.error };
    } catch (error) {
      console.error('💥 Sign in exception', error);
      return { error: 'An unexpected error occurred' };
    }
  };

  // Note (US-016): Supabase signUp removed. Use signUpWithClerk instead.

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

          // Note: We cannot reliably check clerkAuth.isSignedIn here because
          // it's a stale closure reference. The actual state update happens
          // asynchronously and triggers a re-render. The auth state listener
          // will receive the updated isSignedIn=false value.
          // The token verification above is the reliable check.
          console.log('✅ Clerk signOut completed and tokens verified cleared');
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
          // Continue with logout even if Clerk fails
        }
      }

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
    // US-016: Guard on clerkUserId instead of user object
    const activeClerkUserId = clerkUserId || clerkAuth?.userId;
    if (!activeClerkUserId) {
      return { error: 'No user logged in' };
    }

    try {
      // Check if profile exists in Convex
      if (userProfile) {
        console.log(
          '✅ [AuthContext] Found existing profile, updating it:',
          userProfile.id,
        );

        // Build update object for Convex (camelCase)
        const convexUpdates: {
          username?: string;
          displayName?: string;
          preferredGradeLevel?: 'K-2' | '3-5' | '6-8' | '9-12';
          speechEnabled?: boolean;
          preferredGenre?: StoryGenre | null;
          avatarUrl?: string;
          bio?: string;
        } = {};

        if (profile.username !== undefined)
          convexUpdates.username = profile.username;
        if (profile.display_name !== undefined)
          convexUpdates.displayName = profile.display_name;
        if (profile.preferred_grade_level !== undefined)
          convexUpdates.preferredGradeLevel = profile.preferred_grade_level;
        if (profile.speech_enabled !== undefined)
          convexUpdates.speechEnabled = profile.speech_enabled;
        if ('preferred_genre' in profile)
          convexUpdates.preferredGenre = profile.preferred_genre ?? null;
        if (profile.avatar_url !== undefined)
          convexUpdates.avatarUrl = profile.avatar_url;
        if (profile.bio !== undefined) convexUpdates.bio = profile.bio;

        // Update in Convex
        console.log('📝 [Convex] Updating profile for:', activeClerkUserId);
        try {
          await convexUpdateProfile({
            clerkUserId: activeClerkUserId,
            updates: convexUpdates,
          });
          console.log('✅ [Convex] Profile updated successfully');

          // Fetch updated profile from Convex
          const updatedConvexProfile = await convex.query(
            api.userProfiles.getProfileByClerkId,
            { clerkUserId: activeClerkUserId },
          );

          if (updatedConvexProfile) {
            const legacyProfile =
              convertConvexProfileToLegacy(updatedConvexProfile);
            setUserProfile(legacyProfile);
          }
        } catch (convexError) {
          console.error('❌ [Convex] Failed to update profile:', convexError);
          return {
            error:
              convexError instanceof Error
                ? convexError.message
                : 'Failed to update profile',
          };
        }

        return {};
      }

      // Profile doesn't exist - create one using RPC function that bypasses RLS
      console.log(
        '📋 [AuthContext] No existing profile found, creating new profile for OAuth user',
      );

      // Generate unique username
      const generateUniqueUsername = () => {
        if (profile.username) return profile.username;

        const userEmail =
          user?.email || clerkUser?.user?.emailAddresses?.[0]?.emailAddress;
        if (userEmail) {
          return userEmail.split('@')[0];
        }

        const uniqueSuffix = activeClerkUserId.slice(-8);
        return `user_${uniqueSuffix}`;
      };

      const generateDisplayName = () => {
        if (profile.display_name) return profile.display_name;
        if (profile.username) return profile.username;

        const userEmail =
          user?.email || clerkUser?.user?.emailAddresses?.[0]?.emailAddress;
        if (userEmail) {
          const emailPrefix = userEmail.split('@')[0];
          return emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
        }

        const uniqueSuffix = activeClerkUserId.slice(-8);
        return `User ${uniqueSuffix}`;
      };

      const username = generateUniqueUsername();
      const displayName = generateDisplayName();
      const preferredGradeLevel = (profile.preferred_grade_level ||
        'K-2') as GradeLevel;
      const speechEnabled = profile.speech_enabled ?? true;

      // Create profile in Convex
      console.log('📝 [Convex] Creating profile for user:', activeClerkUserId);
      try {
        const convexProfileId = await convexCreateProfile({
          clerkUserId: activeClerkUserId,
          username,
          displayName,
          preferredGradeLevel,
          speechEnabled,
        });

        console.log(
          '✅ [Convex] Profile created successfully:',
          convexProfileId,
        );

        // Fetch the created profile to get full data
        const createdConvexProfile = await convex.query(
          api.userProfiles.getProfileByClerkId,
          { clerkUserId: activeClerkUserId },
        );

        if (createdConvexProfile) {
          const legacyProfile =
            convertConvexProfileToLegacy(createdConvexProfile);
          setUserProfile(legacyProfile);
          setNeedsProfileCompletion(false);
        }
      } catch (convexError) {
        console.error('❌ [Convex] Failed to create profile:', convexError);
        return {
          error:
            convexError instanceof Error
              ? convexError.message
              : 'Failed to create profile',
        };
      }

      return {};
    } catch (error) {
      console.error('💥 [AuthContext] Profile update/create error:', error);
      return { error: 'An unexpected error occurred' };
    }
  };

  // Note (US-016): resendConfirmation and checkEmailConfirmation removed.
  // Clerk handles email verification via verifyEmailCode/resendClerkVerificationCode.

  const resetPassword = async (email: string): Promise<{ error?: string }> => {
    // US-006: Use Clerk password reset (sends 6-digit code)
    // The caller should check for needsCode in the result from resetPasswordWithClerk
    // to show the code verification UI. This wrapper maintains backward compatibility.
    try {
      const result = await resetPasswordWithClerk(email);
      if (result.error) {
        return { error: result.error };
      }
      // Success — the caller will handle the code input UI
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

  // ============================================================================
  // SUPABASE → CLERK/CONVEX MIGRATION (US-007)
  // ============================================================================

  /**
   * Fire-and-forget migration event logger (US-018).
   * Never blocks or fails the migration flow — errors are silently caught.
   */
  const logMigrationEvent = (params: {
    eventType: 'migration_started' | 'migration_completed' | 'migration_failed';
    step:
      | 'supabase_auth'
      | 'profile_fetch'
      | 'clerk_account'
      | 'email_verification'
      | 'profile'
      | 'stats'
      | 'sessions'
      | 'supabase_signout'
      | 'full_migration';
    clerkUserId?: string;
    supabaseUserId?: string;
    email?: string;
    error?: string;
    metadata?: Record<string, unknown>;
  }) => {
    convexLogMigrationEvent(params).catch((err: unknown) => {
      console.warn(
        '⚠️ [AuthContext] Failed to log migration event (non-fatal):',
        err,
      );
    });
  };

  /**
   * Complete migration directly when the Clerk account already exists (US-007).
   *
   * This handles the case where a user previously started migration (Phase A)
   * but didn't complete verification, and their Clerk account was already created.
   * We sign into the existing Clerk account and port all data to Convex.
   */
  const completeMigrationDirectly = async (
    migrationData: PendingMigrationData,
  ): Promise<void> => {
    const currentClerkUserId = clerkAuth?.userId;
    if (!currentClerkUserId) {
      throw new Error('Clerk user ID not available after sign-in');
    }

    console.log(
      '🔄 [AuthContext] Completing migration directly for:',
      currentClerkUserId,
    );

    const eventCtx = {
      clerkUserId: currentClerkUserId,
      supabaseUserId: migrationData.supabaseUserId,
      email: migrationData.email,
    };

    logMigrationEvent({
      eventType: 'migration_started',
      step: 'full_migration',
      ...eventCtx,
    });

    // 1. Create Convex profile (idempotent — createOAuthProfile checks for existing)
    await convexCreateProfile({
      clerkUserId: currentClerkUserId,
      username: migrationData.email.split('@')[0],
      displayName: migrationData.email.split('@')[0],
      preferredGradeLevel: migrationData.preferredGradeLevel,
    });
    logMigrationEvent({
      eventType: 'migration_completed',
      step: 'profile',
      ...eventCtx,
    });

    // 2. Migrate stats
    await convexMigrateStats({
      clerkUserId: currentClerkUserId,
      totalXp: migrationData.totalXp,
      currentStreak: migrationData.currentStreak,
      longestStreak: migrationData.longestStreak,
      bestScore: migrationData.bestScore,
      totalGamesPlayed: migrationData.totalGamesPlayed,
      totalStoriesCompleted: migrationData.totalStoriesCompleted,
      totalWordsWritten: migrationData.totalWordsWritten,
      lastActivityDate: migrationData.lastActivityDate,
      onboardingCompleted: migrationData.onboardingCompleted,
      onboardingProgress: migrationData.onboardingProgress,
      firstStoryCompletedAt: migrationData.firstStoryCompletedAt,
      firstImageGeneratedAt: migrationData.firstImageGeneratedAt,
      firstVoiceInputAt: migrationData.firstVoiceInputAt,
      firstStreakAchievedAt: migrationData.firstStreakAchievedAt,
    });
    logMigrationEvent({
      eventType: 'migration_completed',
      step: 'stats',
      ...eventCtx,
    });

    // 3. Migrate game sessions in batches of 50
    const sessions = migrationData.gameSessions;
    const BATCH_SIZE = 50;
    for (let i = 0; i < sessions.length; i += BATCH_SIZE) {
      const batch = sessions.slice(i, i + BATCH_SIZE);
      await convexMigrateGameSessions({
        clerkUserId: currentClerkUserId,
        sessions: batch,
      });
    }
    logMigrationEvent({
      eventType: 'migration_completed',
      step: 'sessions',
      ...eventCtx,
      metadata: { sessionCount: sessions.length },
    });

    // 4. Sign out of Supabase (no longer needed)
    await supabase.auth.signOut();

    // 5. Clear migration data from AsyncStorage
    await AsyncStorage.removeItem(PENDING_MIGRATION_KEY);
    await AsyncStorage.removeItem(PENDING_CLERK_PROFILE_KEY);

    logMigrationEvent({
      eventType: 'migration_completed',
      step: 'full_migration',
      ...eventCtx,
    });
    console.log(
      '✅ [AuthContext] Migration completed directly for:',
      currentClerkUserId,
    );
  };

  /**
   * Phase A of Supabase → Clerk migration (US-007).
   *
   * 1. Verifies Supabase credentials
   * 2. Fetches all user data (profile + sessions) from Supabase
   * 3. Creates a Clerk account (or signs into existing one)
   * 4. If new account: sends verification email, stores migration data
   * 5. If existing account: completes migration directly
   *
   * @param email - User's email address (same in Supabase and Clerk)
   * @param password - User's password (same for both)
   * @returns { needsVerification: true } if email verification needed,
   *          {} if migration completed directly, or { error } on failure
   */
  const migrateFromSupabase = async (
    email: string,
    password: string,
  ): Promise<{
    needsVerification?: boolean;
    needsNewPassword?: boolean;
    error?: string;
  }> => {
    try {
      console.log('🔄 [AuthContext] Starting Supabase → Clerk migration...');
      logMigrationEvent({
        eventType: 'migration_started',
        step: 'full_migration',
        email,
      });

      // Step 1: Verify Supabase credentials
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({ email, password });

      if (authError || !authData.user) {
        console.error(
          '❌ [AuthContext] Supabase auth failed during migration:',
          authError?.message,
        );
        logMigrationEvent({
          eventType: 'migration_failed',
          step: 'supabase_auth',
          email,
          error: authError?.message || 'Could not verify credentials',
        });
        return {
          error: authError?.message || 'Could not verify your credentials.',
        };
      }

      const supabaseUserId = authData.user.id;
      console.log(
        '🔄 [AuthContext] Supabase auth verified, userId:',
        supabaseUserId,
      );
      logMigrationEvent({
        eventType: 'migration_completed',
        step: 'supabase_auth',
        supabaseUserId,
        email,
      });

      // Step 2: Fetch user profile from Supabase
      const { data: profileRaw, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', supabaseUserId)
        .single();
      // Cast to any — Supabase client lacks typed schema in this project
      const profileData = profileRaw as any;

      if (profileError || !profileRaw) {
        console.error(
          '❌ [AuthContext] Failed to fetch Supabase profile:',
          profileError?.message,
        );
        logMigrationEvent({
          eventType: 'migration_failed',
          step: 'profile_fetch',
          supabaseUserId,
          email,
          error: profileError?.message || 'Profile not found',
        });
        return {
          error: 'Could not fetch your profile data. Please try again.',
        };
      }

      // Step 3: Fetch game sessions from Supabase (non-fatal if fails)
      let gameSessions: PendingMigrationData['gameSessions'] = [];
      try {
        const { data: sessionsRaw } = await supabase
          .from('game_sessions')
          .select('*')
          .eq('user_id', supabaseUserId);
        // Cast to any[] — Supabase client lacks typed schema in this project
        const sessionsData = sessionsRaw as any[];

        if (sessionsData) {
          gameSessions = sessionsData.map((s: any) => ({
            completedAt: s.completed_at ?? undefined,
            gradeLevel: s.grade_level,
            finalScore: s.final_score ?? 0,
            wordsWritten: s.words_written ?? 0,
            sentencesCompleted: s.sentences_completed ?? 0,
            challengesCompleted: s.challenges_completed ?? 0,
            xpEarned: s.xp_earned ?? 0,
            storyContent: s.story_content ?? undefined,
            importedStoryContent: s.imported_story_content ?? undefined,
            storySource: s.story_source ?? 'New',
            originalCreationDate: s.original_creation_date ?? undefined,
            storyMetadata: s.story_metadata ?? undefined,
            generatedImageUrl: s.generated_image_url ?? undefined,
            imageGenerationTimestamp: s.image_generation_timestamp ?? undefined,
            imageGenerationCost: s.image_generation_cost ?? undefined,
            currentRound: s.current_round ?? 1,
          }));
        }
        console.log(
          `🔄 [AuthContext] Fetched ${gameSessions.length} game sessions`,
        );
      } catch (sessionsError) {
        console.warn(
          '⚠️ [AuthContext] Failed to fetch game sessions (non-fatal):',
          sessionsError,
        );
      }

      logMigrationEvent({
        eventType: 'migration_completed',
        step: 'profile_fetch',
        supabaseUserId,
        email,
        metadata: { sessionCount: gameSessions.length },
      });

      // Build migration data
      const migrationData: PendingMigrationData = {
        supabaseUserId,
        email,
        totalXp: profileData.total_xp ?? 0,
        currentStreak: profileData.current_streak ?? 0,
        longestStreak: profileData.longest_streak ?? 0,
        bestScore: profileData.best_score ?? 0,
        totalGamesPlayed: profileData.total_games_played ?? 0,
        totalStoriesCompleted: profileData.total_stories_completed ?? 0,
        totalWordsWritten: profileData.total_words_written ?? 0,
        lastActivityDate:
          profileData.last_activity_date ??
          new Date().toISOString().split('T')[0],
        preferredGradeLevel:
          (profileData.preferred_grade_level as GradeLevel) ?? 'K-2',
        onboardingCompleted: profileData.onboarding_completed ?? false,
        onboardingProgress: profileData.onboarding_progress ?? {
          create_account: true,
          first_story: false,
          first_image: false,
          first_voice: false,
          first_streak: false,
        },
        firstStoryCompletedAt:
          profileData.first_story_completed_at ?? undefined,
        firstImageGeneratedAt:
          profileData.first_image_generated_at ?? undefined,
        firstVoiceInputAt: profileData.first_voice_input_at ?? undefined,
        firstStreakAchievedAt:
          profileData.first_streak_achieved_at ?? undefined,
        gameSessions,
      };

      // Step 4: Persist migration data BEFORE Clerk account creation
      // This ensures the expensive Supabase data fetch is preserved if Clerk
      // rejects the password (e.g., breached password, too weak).
      await AsyncStorage.setItem(
        PENDING_MIGRATION_KEY,
        JSON.stringify(migrationData),
      );

      // Step 5: Create Clerk account
      if (!clerkSignUp?.signUp) {
        return {
          error: 'Clerk is not available. Please try again or restart the app.',
        };
      }

      const { signUp: clerkSignUpResource } = clerkSignUp;

      try {
        await clerkSignUpResource.create({
          emailAddress: email,
          password,
        });
      } catch (clerkError: any) {
        // Check if the account already exists in Clerk
        const clerkErrors = clerkError?.errors || [];
        const firstError = clerkErrors[0];

        if (
          firstError?.code === 'form_identifier_exists' ||
          firstError?.message?.toLowerCase().includes('taken')
        ) {
          console.log(
            '🔄 [AuthContext] Clerk account already exists, signing in directly...',
          );

          // Sign into existing Clerk account and complete migration
          const signInResult = await signInWithClerk(email, password);
          if (signInResult.error) {
            return { error: signInResult.error };
          }

          // Complete migration directly (Clerk session is now active)
          await completeMigrationDirectly(migrationData);
          return {};
        }

        // Check if the password was rejected by Clerk's security policies
        if (
          firstError?.code === 'form_password_pwned' ||
          firstError?.code === 'form_password_not_strong_enough' ||
          firstError?.code === 'form_password_length_too_short'
        ) {
          console.log(
            '🔑 [AuthContext] Password rejected by Clerk policy, user needs new password',
          );
          logMigrationEvent({
            eventType: 'migration_failed',
            step: 'clerk_account',
            supabaseUserId,
            email,
            error: `Password policy: ${firstError.code}`,
            metadata: { requiresNewPassword: true },
          });
          // Migration data already saved to AsyncStorage above
          return { needsNewPassword: true };
        }

        // Re-throw unexpected Clerk errors
        logMigrationEvent({
          eventType: 'migration_failed',
          step: 'clerk_account',
          supabaseUserId,
          email,
          error:
            clerkError?.errors?.[0]?.message || 'Clerk account creation failed',
        });
        throw clerkError;
      }

      logMigrationEvent({
        eventType: 'migration_completed',
        step: 'clerk_account',
        supabaseUserId,
        email,
      });

      // Step 6: Prepare email verification
      await clerkSignUpResource.prepareEmailAddressVerification({
        strategy: 'email_code',
      });

      // Step 7: Store pending Clerk profile so verifyEmailCode creates the Convex profile
      // (Migration data was already saved in Step 4 above)
      const pendingProfile: PendingClerkProfile = {
        username: email.split('@')[0],
        displayName: email.split('@')[0],
        gradeLevel: migrationData.preferredGradeLevel,
        email,
        createdAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(
        PENDING_CLERK_PROFILE_KEY,
        JSON.stringify(pendingProfile),
      );

      logMigrationEvent({
        eventType: 'migration_completed',
        step: 'email_verification',
        supabaseUserId,
        email,
      });
      console.log(
        '✅ [AuthContext] Migration Phase A complete, verification email sent',
      );
      return { needsVerification: true };
    } catch (error) {
      console.error('❌ [AuthContext] Migration failed:', error);

      let errorMessage = 'Migration failed. Please try again.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      logMigrationEvent({
        eventType: 'migration_failed',
        step: 'full_migration',
        email,
        error: errorMessage,
      });
      return { error: errorMessage };
    }
  };

  /**
   * Resume a migration after the user's original password was rejected by Clerk.
   * Reads the cached migration data from AsyncStorage and creates a Clerk account
   * with the user's chosen new password.
   */
  const resumeMigrationWithNewPassword = async (
    newPassword: string,
  ): Promise<{ needsVerification?: boolean; error?: string }> => {
    try {
      // Step 1: Read cached migration data
      const migrationJson = await AsyncStorage.getItem(PENDING_MIGRATION_KEY);
      if (!migrationJson) {
        return {
          error:
            'Migration data not found. Please start the sign-in process again.',
        };
      }
      const migrationData: PendingMigrationData = JSON.parse(migrationJson);
      const { email } = migrationData;

      console.log(
        '🔑 [AuthContext] Resuming migration with new password for:',
        email,
      );

      // Step 2: Create Clerk account with the new password
      if (!clerkSignUp?.signUp) {
        return {
          error: 'Clerk is not available. Please try again or restart the app.',
        };
      }

      const { signUp: clerkSignUpResource } = clerkSignUp;

      try {
        await clerkSignUpResource.create({
          emailAddress: email,
          password: newPassword,
        });
      } catch (clerkError: any) {
        const clerkErrors = clerkError?.errors || [];
        const firstError = clerkErrors[0];

        // Account already exists — sign in directly and complete migration
        if (
          firstError?.code === 'form_identifier_exists' ||
          firstError?.message?.toLowerCase().includes('taken')
        ) {
          console.log(
            '🔄 [AuthContext] Clerk account already exists, signing in directly...',
          );
          const signInResult = await signInWithClerk(email, newPassword);
          if (signInResult.error) {
            return { error: signInResult.error };
          }
          await completeMigrationDirectly(migrationData);
          return {};
        }

        // Password still rejected — let user try again
        if (
          firstError?.code === 'form_password_pwned' ||
          firstError?.code === 'form_password_not_strong_enough' ||
          firstError?.code === 'form_password_length_too_short'
        ) {
          const message =
            firstError.code === 'form_password_pwned'
              ? 'This password has also been found in a data breach. Please choose a different password.'
              : firstError.longMessage ||
                firstError.message ||
                'Password does not meet security requirements.';
          return { error: message };
        }

        // Unexpected error
        return {
          error:
            firstError?.longMessage ||
            firstError?.message ||
            'Failed to create account. Please try again.',
        };
      }

      // Step 3: Prepare email verification
      await clerkSignUpResource.prepareEmailAddressVerification({
        strategy: 'email_code',
      });

      // Step 4: Store pending Clerk profile for post-verification profile creation
      const pendingProfile: PendingClerkProfile = {
        username: email.split('@')[0],
        displayName: email.split('@')[0],
        gradeLevel: migrationData.preferredGradeLevel,
        email,
        createdAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(
        PENDING_CLERK_PROFILE_KEY,
        JSON.stringify(pendingProfile),
      );

      logMigrationEvent({
        eventType: 'migration_completed',
        step: 'clerk_account',
        supabaseUserId: migrationData.supabaseUserId,
        email,
        metadata: { resumedWithNewPassword: true },
      });

      console.log(
        '✅ [AuthContext] Migration resumed, verification email sent',
      );
      return { needsVerification: true };
    } catch (error) {
      console.error(
        '❌ [AuthContext] Resume migration with new password failed:',
        error,
      );
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to resume migration. Please try again.';
      return { error: errorMessage };
    }
  };

  // ============================================================================
  // CLERK EMAIL/PASSWORD AUTHENTICATION (US-002)
  // ============================================================================

  /**
   * Sign up a new user with email and password via Clerk.
   *
   * This function:
   * 1. Creates a Clerk sign-up with email/password
   * 2. Triggers email verification code flow
   * 3. Stores pending profile data in AsyncStorage for post-verification
   *
   * @param email - User's email address
   * @param password - User's password (min 8 chars, mixed case, numbers per Clerk config)
   * @param profileData - Username, displayName, and gradeLevel for profile creation
   * @returns { needsVerification: true } on success, { error: string } on failure
   */
  const signUpWithClerk = async (
    email: string,
    password: string,
    profileData: SignUpData,
  ): Promise<{ needsVerification?: boolean; error?: string }> => {
    try {
      console.log(
        '📧 [AuthContext] Initiating Clerk email/password sign-up...',
      );

      // Check if Clerk signUp is available
      if (!clerkSignUp?.signUp) {
        const error =
          'Clerk is not configured or not available. Please configure Clerk to use email/password authentication.';
        console.error('❌ [AuthContext]', error);
        return { error };
      }

      const { signUp } = clerkSignUp;

      // Step 1: Create Clerk sign-up with email and password
      console.log('📧 [AuthContext] Creating Clerk sign-up...');
      await signUp.create({
        emailAddress: email,
        password,
      });

      // Step 2: Trigger email verification code flow
      console.log('📧 [AuthContext] Preparing email verification...');
      await signUp.prepareEmailAddressVerification({
        strategy: 'email_code',
      });

      // Step 3: Store pending profile data in AsyncStorage
      // This will be used after email verification to create the Convex profile
      const pendingProfile: PendingClerkProfile = {
        username: profileData.username,
        displayName: profileData.displayName || profileData.username,
        gradeLevel: profileData.gradeLevel,
        email,
        createdAt: new Date().toISOString(),
      };

      console.log('📧 [AuthContext] Storing pending profile data...');
      await AsyncStorage.setItem(
        PENDING_CLERK_PROFILE_KEY,
        JSON.stringify(pendingProfile),
      );

      console.log(
        '✅ [AuthContext] Clerk sign-up successful, verification email sent',
      );
      return { needsVerification: true };
    } catch (error) {
      console.error('❌ [AuthContext] Clerk sign-up failed:', error);

      // Parse Clerk error messages for user-friendly display
      let errorMessage = 'An unexpected error occurred during sign-up';

      if (error instanceof Error) {
        const message = error.message.toLowerCase();

        // Handle common Clerk errors
        if (message.includes('email_address') && message.includes('taken')) {
          errorMessage =
            'This email address is already registered. Please sign in instead.';
        } else if (message.includes('password') && message.includes('breach')) {
          errorMessage =
            'This password has appeared in a known data breach. Please choose a different, unique password for your security.';
        } else if (message.includes('password') && message.includes('weak')) {
          errorMessage =
            'Password is too weak. Please use at least 8 characters with mixed case and numbers.';
        } else if (message.includes('password') && message.includes('short')) {
          errorMessage = 'Password must be at least 8 characters long.';
        } else if (message.includes('invalid') && message.includes('email')) {
          errorMessage = 'Please enter a valid email address.';
        } else if (message.includes('rate') || message.includes('limit')) {
          errorMessage =
            'Too many sign-up attempts. Please wait a moment and try again.';
        } else {
          // Use the original error message if it's descriptive enough
          errorMessage = error.message;
        }
      }

      return { error: errorMessage };
    }
  };

  /**
   * Verify email code for Clerk email/password sign-up (US-003).
   *
   * Completes the email verification flow started by signUpWithClerk().
   * On success: activates the Clerk session, creates a Convex profile
   * from the pending profile stored in AsyncStorage, and clears the pending data.
   *
   * @param code - 6-digit verification code from the user's email
   * @returns {} on success, { error: string } on failure
   */
  const verifyEmailCode = async (code: string): Promise<{ error?: string }> => {
    try {
      console.log('📧 [AuthContext] Verifying email code...');

      // Check if Clerk signUp hook is available
      if (!clerkSignUp?.signUp || !clerkSignUp?.setActive) {
        const error =
          'Clerk is not available. Please try again or restart the app.';
        console.error('❌ [AuthContext]', error);
        return { error };
      }

      const { signUp, setActive } = clerkSignUp;

      // Step 1: Attempt email address verification with the provided code
      console.log('📧 [AuthContext] Attempting email verification...');
      const result = await signUp.attemptEmailAddressVerification({ code });

      if (result.status !== 'complete') {
        console.warn(
          '⚠️ [AuthContext] Verification incomplete, status:',
          result.status,
        );
        return {
          error:
            'Verification is not complete. Please check your code and try again.',
        };
      }

      // Step 2: Activate the Clerk session
      if (!result.createdSessionId) {
        console.error('❌ [AuthContext] No session created after verification');
        return {
          error:
            'Account verified but session could not be created. Please try signing in.',
        };
      }

      console.log('📧 [AuthContext] Activating Clerk session...');
      await setActive({ session: result.createdSessionId });

      // Step 3: Retrieve pending profile from AsyncStorage
      console.log('📧 [AuthContext] Retrieving pending profile data...');
      const pendingProfileJson = await AsyncStorage.getItem(
        PENDING_CLERK_PROFILE_KEY,
      );

      if (!pendingProfileJson) {
        console.warn(
          '⚠️ [AuthContext] No pending profile found in AsyncStorage. Profile will need to be created manually.',
        );
        // Session is active but no profile data — not a fatal error.
        // The user is authenticated; profile creation can happen via other flows.
        return {};
      }

      const pendingProfile: PendingClerkProfile =
        JSON.parse(pendingProfileJson);

      // Step 4: Create Convex profile via createOAuthProfile mutation
      // Use the Clerk user ID from the completed sign-up
      const clerkUserId = result.createdUserId;

      if (!clerkUserId) {
        console.error(
          '❌ [AuthContext] No Clerk user ID available after verification',
        );
        // Session is active but we can't create the profile without a user ID
        await AsyncStorage.removeItem(PENDING_CLERK_PROFILE_KEY);
        return {
          error:
            'Account verified but profile could not be created. Please complete your profile in settings.',
        };
      }

      console.log(
        '📧 [AuthContext] Creating Convex profile for user:',
        clerkUserId,
      );
      await convexCreateProfile({
        clerkUserId,
        username: pendingProfile.username,
        displayName: pendingProfile.displayName,
        preferredGradeLevel: pendingProfile.gradeLevel,
      });

      // Step 5 (US-007): Check for pending migration data and complete Phase B
      try {
        const migrationJson = await AsyncStorage.getItem(PENDING_MIGRATION_KEY);

        if (migrationJson) {
          console.log(
            '🔄 [AuthContext] Pending migration found — completing Phase B...',
          );
          const migrationData: PendingMigrationData = JSON.parse(migrationJson);

          const phaseBCtx = {
            clerkUserId,
            supabaseUserId: migrationData.supabaseUserId,
            email: migrationData.email,
          };

          // Migrate stats
          await convexMigrateStats({
            clerkUserId,
            totalXp: migrationData.totalXp,
            currentStreak: migrationData.currentStreak,
            longestStreak: migrationData.longestStreak,
            bestScore: migrationData.bestScore,
            totalGamesPlayed: migrationData.totalGamesPlayed,
            totalStoriesCompleted: migrationData.totalStoriesCompleted,
            totalWordsWritten: migrationData.totalWordsWritten,
            lastActivityDate: migrationData.lastActivityDate,
            onboardingCompleted: migrationData.onboardingCompleted,
            onboardingProgress: migrationData.onboardingProgress,
            firstStoryCompletedAt: migrationData.firstStoryCompletedAt,
            firstImageGeneratedAt: migrationData.firstImageGeneratedAt,
            firstVoiceInputAt: migrationData.firstVoiceInputAt,
            firstStreakAchievedAt: migrationData.firstStreakAchievedAt,
          });
          logMigrationEvent({
            eventType: 'migration_completed',
            step: 'stats',
            ...phaseBCtx,
          });

          // Migrate game sessions in batches of 50
          const sessions = migrationData.gameSessions;
          const BATCH_SIZE = 50;
          for (let i = 0; i < sessions.length; i += BATCH_SIZE) {
            const batch = sessions.slice(i, i + BATCH_SIZE);
            await convexMigrateGameSessions({
              clerkUserId,
              sessions: batch,
            });
          }
          logMigrationEvent({
            eventType: 'migration_completed',
            step: 'sessions',
            ...phaseBCtx,
            metadata: { sessionCount: sessions.length },
          });

          // Sign out of Supabase (legacy session no longer needed)
          await supabase.auth.signOut();

          // Clear migration data
          await AsyncStorage.removeItem(PENDING_MIGRATION_KEY);

          logMigrationEvent({
            eventType: 'migration_completed',
            step: 'full_migration',
            ...phaseBCtx,
          });
          console.log(
            '✅ [AuthContext] Migration Phase B complete — stats and sessions migrated',
          );
        }
      } catch (migrationError) {
        // Migration failure is non-fatal — Clerk session is still active.
        // PENDING_MIGRATION_KEY is kept so migration can be retried later.
        console.error(
          '⚠️ [AuthContext] Migration Phase B failed (non-fatal):',
          migrationError,
        );
        logMigrationEvent({
          eventType: 'migration_failed',
          step: 'full_migration',
          clerkUserId,
          error:
            migrationError instanceof Error
              ? migrationError.message
              : 'Phase B failed',
        });
      }

      // Step 6: Clear pending profile from AsyncStorage
      console.log('📧 [AuthContext] Clearing pending profile data...');
      await AsyncStorage.removeItem(PENDING_CLERK_PROFILE_KEY);

      console.log(
        '✅ [AuthContext] Email verification complete, session active, profile created',
      );
      return {};
    } catch (error) {
      console.error('❌ [AuthContext] Email verification failed:', error);

      let errorMessage = 'Verification failed. Please try again.';

      if (error instanceof Error) {
        const message = error.message.toLowerCase();

        if (
          message.includes('incorrect') ||
          message.includes('invalid') ||
          message.includes('code')
        ) {
          errorMessage =
            'Invalid verification code. Please check and try again.';
        } else if (message.includes('expired')) {
          errorMessage =
            'Verification code has expired. Please request a new code.';
        } else if (message.includes('rate') || message.includes('limit')) {
          errorMessage =
            'Too many attempts. Please wait a moment and try again.';
        } else {
          errorMessage = error.message;
        }
      }

      return { error: errorMessage };
    }
  };

  /**
   * Resend the email verification code for Clerk email/password sign-up (US-004).
   *
   * Re-triggers the email_code verification strategy on the current sign-up attempt.
   * This is safe to call multiple times — Clerk handles rate limiting.
   */
  const resendClerkVerificationCode = async (): Promise<{
    error?: string;
  }> => {
    try {
      console.log('📧 [AuthContext] Resending Clerk verification code...');

      if (!clerkSignUp?.signUp) {
        return {
          error: 'Clerk is not available. Please restart the sign-up process.',
        };
      }

      const { signUp } = clerkSignUp;

      await signUp.prepareEmailAddressVerification({
        strategy: 'email_code',
      });

      console.log('✅ [AuthContext] Verification code resent successfully');
      return {};
    } catch (error) {
      console.error(
        '❌ [AuthContext] Failed to resend verification code:',
        error,
      );

      let errorMessage =
        'Failed to resend verification code. Please try again.';

      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        if (message.includes('rate') || message.includes('limit')) {
          errorMessage =
            'Too many attempts. Please wait a moment before requesting a new code.';
        }
      }

      return { error: errorMessage };
    }
  };

  /**
   * Sign in with Clerk using email and password (US-005).
   *
   * Attempts to authenticate the user via Clerk's email/password flow.
   * Returns { needsMigration: true } when the user is not found in Clerk,
   * indicating they may be a legacy Supabase user who needs to migrate.
   *
   * @param email - User's email address
   * @param password - User's password
   * @returns {} on success, { needsMigration: true } if not in Clerk, { error } on failure
   */
  const signInWithClerk = async (
    email: string,
    password: string,
  ): Promise<{
    needsMigration?: boolean;
    needsSecondFactor?: boolean;
    error?: string;
  }> => {
    try {
      console.log(
        '🔐 [AuthContext] Attempting Clerk email/password sign-in...',
      );

      // Check if Clerk signIn hook is available
      if (!clerkSignIn?.signIn || !clerkSignIn?.setActive) {
        const error =
          'Clerk is not available. Please try again or restart the app.';
        console.error('❌ [AuthContext]', error);
        return { error };
      }

      const { signIn: clerkSignInResource, setActive } = clerkSignIn;

      // Attempt Clerk sign-in with email and password
      const result = await clerkSignInResource.create({
        identifier: email,
        password,
      });

      if (result.status === 'complete') {
        // Activate the Clerk session
        console.log('📧 [AuthContext] Activating Clerk session...');
        await setActive({ session: result.createdSessionId });
        console.log('✅ [AuthContext] Clerk sign-in successful');
        return {};
      }

      // Handle needs_second_factor: prepare email code and signal UI
      if (result.status === 'needs_second_factor') {
        console.log(
          '🔐 [AuthContext] Sign-in needs second factor. Supported:',
          result.supportedSecondFactors?.map((f: any) => f.strategy),
        );

        // Check if email_code is a supported second factor
        const hasEmailCode = result.supportedSecondFactors?.some(
          (f: any) => f.strategy === 'email_code',
        );

        if (hasEmailCode) {
          // Prepare the email code second factor — this sends the code
          await clerkSignInResource.prepareSecondFactor({
            strategy: 'email_code',
          });
          console.log(
            '📧 [AuthContext] Second factor email code sent, awaiting verification',
          );
          return { needsSecondFactor: true };
        }

        // No supported second factor strategy we can handle
        console.warn(
          '⚠️ [AuthContext] No supported second factor strategy available',
        );
        return {
          error:
            'Your account requires two-factor authentication that is not yet supported in this app.',
        };
      }

      // Handle other incomplete statuses
      console.warn(
        '⚠️ [AuthContext] Clerk sign-in incomplete, status:',
        result.status,
      );
      return {
        error: 'Sign-in incomplete. Additional verification may be required.',
      };
    } catch (error: any) {
      console.error('❌ [AuthContext] Clerk sign-in failed:', error);

      // Parse Clerk structured error codes
      const clerkErrors = error?.errors || [];
      const firstError = clerkErrors[0];

      if (firstError) {
        const code = firstError.code;

        if (code === 'form_identifier_not_found') {
          // User doesn't exist in Clerk — likely a legacy Supabase user
          console.log(
            '📋 [AuthContext] User not found in Clerk, may need migration',
          );
          return { needsMigration: true };
        }

        if (code === 'form_password_incorrect') {
          return { error: 'Invalid credentials' };
        }

        if (code === 'strategy_for_user_invalid') {
          // User exists in Clerk but only has OAuth — no password set
          return {
            error:
              'This account uses social sign-in (Google/Apple). Please use the appropriate sign-in button.',
          };
        }
      }

      // Generic error handling
      let errorMessage = 'An unexpected error occurred during sign-in';

      if (error instanceof Error) {
        const message = error.message.toLowerCase();

        if (message.includes('rate') || message.includes('limit')) {
          errorMessage =
            'Too many sign-in attempts. Please wait a moment and try again.';
        } else if (message.includes('network') || message.includes('fetch')) {
          errorMessage =
            'Network error. Please check your connection and try again.';
        }
      }

      return { error: errorMessage };
    }
  };

  /**
   * Verify second factor during sign-in.
   *
   * Called after `signInWithClerk` returns `{ needsSecondFactor: true }`.
   * The email code has already been sent by `prepareSecondFactor` inside
   * `signInWithClerk`. This function verifies the 6-digit code and
   * activates the Clerk session.
   *
   * @param code - 6-digit verification code from email
   * @returns {} on success, { error: string } on failure
   */
  const verifySignInSecondFactor = async (
    code: string,
  ): Promise<{ error?: string }> => {
    try {
      console.log('🔐 [AuthContext] Verifying sign-in second factor...');

      if (!clerkSignIn?.signIn || !clerkSignIn?.setActive) {
        return {
          error: 'Clerk is not available. Please try signing in again.',
        };
      }

      const { signIn: clerkSignInResource, setActive } = clerkSignIn;

      const result = await clerkSignInResource.attemptSecondFactor({
        strategy: 'email_code',
        code,
      });

      if (result.status === 'complete') {
        console.log('📧 [AuthContext] Activating Clerk session after 2FA...');
        await setActive({ session: result.createdSessionId });
        console.log('✅ [AuthContext] Sign-in with second factor successful');
        return {};
      }

      console.warn(
        '⚠️ [AuthContext] Second factor verification incomplete, status:',
        result.status,
      );
      return {
        error: 'Verification incomplete. Please try again.',
      };
    } catch (error: any) {
      console.error(
        '❌ [AuthContext] Second factor verification failed:',
        error,
      );

      const clerkErrors = error?.errors || [];
      const firstError = clerkErrors[0];

      if (firstError) {
        const errCode = firstError.code;

        if (errCode === 'form_code_incorrect' || errCode === 'form_param_nil') {
          return {
            error: 'Invalid verification code. Please check and try again.',
          };
        }

        if (errCode === 'verification_expired') {
          return {
            error:
              'Verification code has expired. Please sign in again to get a new code.',
          };
        }
      }

      return { error: 'Failed to verify code. Please try again.' };
    }
  };

  /**
   * Initiate Clerk password reset flow (US-006).
   *
   * Sends a 6-digit reset code to the user's email using Clerk's
   * `reset_password_email_code` strategy. The user then enters the code
   * along with a new password via `verifyPasswordResetCode()`.
   *
   * @param email - User's email address
   * @returns { needsCode: true } on success, { error: string } on failure
   */
  const resetPasswordWithClerk = async (
    email: string,
  ): Promise<{ needsCode?: boolean; error?: string }> => {
    try {
      console.log('🔑 [AuthContext] Initiating Clerk password reset...');

      if (!clerkSignIn?.signIn) {
        return {
          error: 'Clerk is not available. Please try again or restart the app.',
        };
      }

      const { signIn: clerkSignInResource } = clerkSignIn;

      // Create a sign-in attempt with the reset_password_email_code strategy
      await clerkSignInResource.create({
        strategy: 'reset_password_email_code',
        identifier: email,
      });

      console.log('✅ [AuthContext] Password reset code sent to', email);
      return { needsCode: true };
    } catch (error: any) {
      console.error('❌ [AuthContext] Password reset request failed:', error);

      // Parse Clerk structured error codes
      const clerkErrors = error?.errors || [];
      const firstError = clerkErrors[0];

      if (firstError) {
        const code = firstError.code;

        if (code === 'form_identifier_not_found') {
          return {
            error:
              'No account found with this email. Please check the address or sign up.',
          };
        }

        if (code === 'strategy_for_user_invalid') {
          return {
            error:
              'This account uses social sign-in (Google/Apple). Password reset is not available for social accounts.',
          };
        }
      }

      let errorMessage = 'An unexpected error occurred. Please try again.';

      if (error instanceof Error) {
        const message = error.message.toLowerCase();

        if (message.includes('rate') || message.includes('limit')) {
          errorMessage =
            'Too many reset attempts. Please wait a moment and try again.';
        } else if (message.includes('network') || message.includes('fetch')) {
          errorMessage =
            'Network error. Please check your connection and try again.';
        }
      }

      return { error: errorMessage };
    }
  };

  /**
   * Verify password reset code and set new password (US-006).
   *
   * Completes the password reset flow started by `resetPasswordWithClerk()`.
   * Uses Clerk's two-step flow:
   *   1. `attemptFirstFactor` verifies the 6-digit code → status: `needs_new_password`
   *   2. `resetPassword` sets the new password → status: `complete`
   *
   * @param code - 6-digit verification code from email
   * @param newPassword - The new password to set
   * @returns {} on success, { error: string } on failure
   */
  const verifyPasswordResetCode = async (
    code: string,
    newPassword: string,
  ): Promise<{ error?: string }> => {
    try {
      console.log('🔑 [AuthContext] Verifying password reset code...');

      if (!clerkSignIn?.signIn || !clerkSignIn?.setActive) {
        return {
          error:
            'Clerk is not available. Please restart the password reset process.',
        };
      }

      const { signIn: clerkSignInResource, setActive } = clerkSignIn;

      // Step 1: Verify the 6-digit code (first factor only — no password here)
      const firstFactorResult = await clerkSignInResource.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code,
      });

      console.log(
        '🔑 [AuthContext] First factor result status:',
        firstFactorResult.status,
      );

      // Step 2: Set the new password via resetPassword()
      if (firstFactorResult.status === 'needs_new_password') {
        const resetResult = await clerkSignInResource.resetPassword({
          password: newPassword,
          signOutOfOtherSessions: true,
        });

        if (resetResult.status === 'complete') {
          console.log(
            '🔑 [AuthContext] Activating session after password reset...',
          );
          await setActive({ session: resetResult.createdSessionId });
          console.log('✅ [AuthContext] Password reset and sign-in successful');
          return {};
        }

        // Unexpected status after resetPassword
        console.warn(
          '⚠️ [AuthContext] Unexpected status after resetPassword:',
          resetResult.status,
        );
        return {
          error:
            'Password reset incomplete. Please try signing in with your new password.',
        };
      }

      // If attemptFirstFactor returned 'complete' directly (e.g., password was
      // already set via optional param in some Clerk versions)
      if (firstFactorResult.status === 'complete') {
        console.log(
          '🔑 [AuthContext] Activating session after password reset...',
        );
        await setActive({ session: firstFactorResult.createdSessionId });
        console.log('✅ [AuthContext] Password reset and sign-in successful');
        return {};
      }

      // Handle needs_second_factor — user has 2FA enabled
      if (firstFactorResult.status === 'needs_second_factor') {
        console.warn(
          '⚠️ [AuthContext] Password reset requires second factor (2FA)',
        );
        return {
          error:
            'Your account has two-factor authentication enabled. Please disable 2FA first or contact support to reset your password.',
        };
      }

      // Handle any other incomplete status
      console.warn(
        '⚠️ [AuthContext] Password reset incomplete, status:',
        firstFactorResult.status,
      );
      return {
        error: 'Password reset incomplete. Please try again.',
      };
    } catch (error: any) {
      console.error(
        '❌ [AuthContext] Password reset verification failed:',
        error,
      );

      const clerkErrors = error?.errors || [];
      const firstError = clerkErrors[0];

      if (firstError) {
        const code_str = firstError.code;

        if (
          code_str === 'form_code_incorrect' ||
          code_str === 'form_param_nil'
        ) {
          return {
            error: 'Invalid verification code. Please check and try again.',
          };
        }

        if (code_str === 'verification_expired') {
          return {
            error: 'Verification code has expired. Please request a new one.',
          };
        }

        if (
          code_str === 'form_password_pwned' ||
          code_str === 'form_password_not_strong_enough'
        ) {
          return {
            error:
              'Password is too weak or has appeared in a data breach. Please choose a stronger password.',
          };
        }

        if (code_str === 'form_password_length_too_short') {
          return { error: 'Password must be at least 8 characters long.' };
        }
      }

      let errorMessage = 'Failed to reset password. Please try again.';

      if (error instanceof Error) {
        const message = error.message.toLowerCase();

        if (message.includes('rate') || message.includes('limit')) {
          errorMessage =
            'Too many attempts. Please wait a moment and try again.';
        } else if (message.includes('network') || message.includes('fetch')) {
          errorMessage =
            'Network error. Please check your connection and try again.';
        }
      }

      return { error: errorMessage };
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
        clerkTokenCache.clearToken?.('__clerk_client_jwt');

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

      // CRITICAL FIX: Use custom OAuth flow with oidcPrompt to force account picker
      // Clerk's startSSOFlow doesn't expose oidcPrompt, but signIn.create() does.
      // Setting oidcPrompt: 'select_account' forces Google to show the account picker
      // even if there's an active OS-level Google session.
      console.log(
        '📋 [AuthContext] Calling custom OAuth flow with oidcPrompt: select_account',
      );

      // Ensure clerkSignIn is available
      if (
        !clerkSignIn?.signIn ||
        !clerkSignIn?.setActive ||
        !clerkSignIn?.isLoaded
      ) {
        console.error('❌ [AuthContext] Clerk signIn hook not ready');
        isProcessingOAuth.current = false;
        return { error: 'Authentication system not ready. Please try again.' };
      }

      if (!clerkSignUp?.signUp || !clerkSignUp?.isLoaded) {
        console.error('❌ [AuthContext] Clerk signUp hook not ready');
        isProcessingOAuth.current = false;
        return { error: 'Authentication system not ready. Please try again.' };
      }

      const redirectUrl = 'creativebridge://auth/callback';

      // Step 1: Create signIn with oidcPrompt to force account picker
      console.log(
        '📋 [AuthContext] Creating signIn with strategy: oauth_google, oidcPrompt: select_account',
      );
      await clerkSignIn.signIn.create({
        strategy: 'oauth_google',
        redirectUrl,
        oidcPrompt: 'select_account', // CRITICAL: Forces Google to show account picker
      });

      // Step 2: Get the external verification redirect URL
      const { externalVerificationRedirectURL } =
        clerkSignIn.signIn.firstFactorVerification;

      if (!externalVerificationRedirectURL) {
        console.error(
          '❌ [AuthContext] Missing external verification redirect URL',
        );
        isProcessingOAuth.current = false;
        return { error: 'Failed to start Google authentication.' };
      }

      console.log(
        '🌐 [AuthContext] Opening Google OAuth with forced account picker...',
      );

      // Step 3: Open the auth session
      const authSessionResult = await WebBrowser.openAuthSessionAsync(
        externalVerificationRedirectURL.toString(),
        redirectUrl,
      );

      // Step 4: Handle the result
      // Check for user cancellation first
      if (
        authSessionResult.type === 'cancel' ||
        authSessionResult.type === 'dismiss'
      ) {
        console.log(
          '📱 [AuthContext] OAuth session cancelled by user:',
          authSessionResult.type,
        );
        isProcessingOAuth.current = false;
        return {}; // Silent return for user cancellation
      }

      if (authSessionResult.type !== 'success' || !authSessionResult.url) {
        console.log(
          '📱 [AuthContext] OAuth session failed:',
          authSessionResult.type,
        );
        isProcessingOAuth.current = false;
        return { error: 'Google authentication was not completed.' };
      }

      // Step 5: Parse the result and reload signIn
      const params = new URL(authSessionResult.url).searchParams;
      const rotatingTokenNonce = params.get('rotating_token_nonce') ?? '';
      await clerkSignIn.signIn.reload({ rotatingTokenNonce });

      // Step 6: Check if user needs to be created (sign-up transfer)
      const userNeedsToBeCreated =
        clerkSignIn.signIn.firstFactorVerification.status === 'transferable';

      if (userNeedsToBeCreated) {
        console.log(
          '📝 [AuthContext] User needs to be created, transferring to signUp',
        );
        await clerkSignUp.signUp.create({
          transfer: true,
        });
      }

      // Build result object matching startSSOFlow format
      const result = {
        createdSessionId:
          clerkSignUp.signUp.createdSessionId ??
          clerkSignIn.signIn.createdSessionId,
        setActive: clerkSignIn.setActive,
        signIn: clerkSignIn.signIn,
        signUp: clerkSignUp.signUp,
        authSessionResult,
      };

      console.log('🔄 [AuthContext] OAuth flow result:', {
        createdSessionId: result.createdSessionId,
        authSessionResult: result.authSessionResult?.type,
        hasSignUp: !!result.signUp,
        hasSignIn: !!result.signIn,
        signUpCreatedUserId: result.signUp?.createdUserId,
        signInIdentifier: result.signIn?.identifier,
      });

      // Note: Cancel/dismiss already handled above in Step 4
      // If we reach here, authSessionResult.type === 'success'

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

        // POST-ACTIVATION VERIFICATION: Log for debugging
        // Note: With oidcPrompt: 'select_account', the account picker is always shown,
        // so we no longer need to verify the user isn't the same as the previous logout.
        const previousUserIdForVerification = previousUserId; // Captured earlier in the function

        // Wait a moment for Clerk's state to update after setActive
        await new Promise(resolve => setTimeout(resolve, 100));

        console.log(
          '🔍 [AuthContext] Post-activation check - session activated successfully',
        );

        // NOTE: The post-activation same-user check has been REMOVED.
        //
        // RATIONALE: With oidcPrompt: 'select_account' in signInWithGoogle() (lines 1283-1287),
        // Google ALWAYS shows the account picker. This means:
        // 1. Users must EXPLICITLY choose an account - no silent reactivation
        // 2. If a user chooses the same account they just logged out of, that's INTENTIONAL
        // 3. The previous check was blocking legitimate re-logins of the same user
        //
        // The stale session problem is now solved at the OAuth level, making the
        // client-side post-activation check unnecessary and overly aggressive.
        if (previousUserIdForVerification && isSignIn && !oauthUserId) {
          console.log(
            '✅ [AuthContext] Sign-in flow - account picker was shown, allowing user choice',
          );
          console.log(
            'ℹ️ [AuthContext] Previous user ID:',
            previousUserIdForVerification,
            '(user explicitly chose their account)',
          );
        }

        // Clear the previous user tracking after successful verification
        // Only clear if we have a DIFFERENT user (for sign-up flows where oauthUserId is known)
        // OR after successful verification for sign-in flows
        if (previousUserIdForVerification) {
          console.log(
            '✅ [AuthContext] Clearing previous user tracking after successful verification',
          );
          await AsyncStorage.removeItem('__previous_clerk_user_id');
          await AsyncStorage.removeItem('__previous_logout_timestamp');
        }

        console.log('✅ [AuthContext] Post-activation verification passed');
      }

      // Complete auth after successful OAuth
      const authResult = await handleClerkAuthComplete();
      if (!authResult.success) {
        console.warn(
          '⚠️ [AuthContext] OAuth succeeded but auth completion failed:',
          authResult.error,
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
          '🔄 [AuthContext] User already signed in with Clerk, completing auth...',
        );
        try {
          const authResult = await handleClerkAuthComplete();
          console.log('🔍 [AuthContext] Auth result:', authResult);
          if (authResult.success) {
            console.log(
              '✅ [AuthContext] Completed auth for existing Clerk session',
            );
            return {};
          } else {
            console.error(
              '❌ [AuthContext] Failed to complete auth:',
              authResult.error,
            );
            return {
              error: authResult.error || 'Failed to complete authentication',
            };
          }
        } catch (authError) {
          console.error(
            '💥 [AuthContext] Error during auth completion:',
            authError,
          );
          return { error: 'Failed to complete authentication' };
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
        clerkTokenCache.clearToken?.('__clerk_client_jwt');

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

        // POST-ACTIVATION VERIFICATION: Log for debugging
        // Note: Apple Sign In on iOS uses native authentication which requires
        // explicit user interaction. The user must authenticate with Face ID/Touch ID.
        // Therefore, we no longer need to verify the user isn't the same as the previous logout.
        const previousUserIdForVerification = previousUserId; // Captured earlier in the function

        // Wait a moment for Clerk's state to update after setActive
        await new Promise(resolve => setTimeout(resolve, 100));

        console.log(
          '🔍 [AuthContext] Post-activation check - session activated successfully',
        );

        // NOTE: The post-activation same-user check has been REMOVED.
        //
        // RATIONALE: Apple Sign In on iOS requires explicit user authentication
        // (Face ID, Touch ID, or passcode). This means:
        // 1. Users must EXPLICITLY authenticate - no silent reactivation
        // 2. If a user chooses the same Apple ID they just logged out of, that's INTENTIONAL
        // 3. The previous check was blocking legitimate re-logins of the same user
        if (previousUserIdForVerification && isSignIn && !oauthUserId) {
          console.log(
            '✅ [AuthContext] Sign-in flow - native Apple auth used, allowing user choice',
          );
          console.log(
            'ℹ️ [AuthContext] Previous user ID:',
            previousUserIdForVerification,
            '(user explicitly authenticated)',
          );
        }

        // Clear the previous user tracking after successful sign-in
        if (previousUserIdForVerification) {
          console.log(
            '✅ [AuthContext] Clearing previous user tracking after successful sign-in',
          );
          await AsyncStorage.removeItem('__previous_clerk_user_id');
          await AsyncStorage.removeItem('__previous_logout_timestamp');
        }

        console.log('✅ [AuthContext] Post-activation completed');
      }

      // Complete auth after successful OAuth
      const authResult = await handleClerkAuthComplete();
      if (!authResult.success) {
        console.warn(
          '⚠️ [AuthContext] OAuth succeeded but auth completion failed:',
          authResult.error,
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
          '🔄 [AuthContext] User already signed in with Clerk, completing auth...',
        );
        try {
          const authResult = await handleClerkAuthComplete();
          console.log('🔍 [AuthContext] Auth result:', authResult);
          if (authResult.success) {
            console.log(
              '✅ [AuthContext] Completed auth for existing Clerk session',
            );
            return {};
          } else {
            console.error(
              '❌ [AuthContext] Failed to complete auth:',
              authResult.error,
            );
            return {
              error: authResult.error || 'Failed to complete authentication',
            };
          }
        } catch (authError) {
          console.error(
            '💥 [AuthContext] Error during auth completion:',
            authError,
          );
          return { error: 'Failed to complete authentication' };
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
    // TEMPORARY: Skip XP deduction during beta. Threshold check (canGenerateImage) still enforces >= 1000 XP.
    // TODO: Remove before production release.
    const XP_DEDUCTION_ENABLED = false;
    if (!XP_DEDUCTION_ENABLED) {
      return { success: true, newBalance: userProfile?.total_xp || 0 };
    }

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

      // Get Clerk user ID for Convex operations
      // Priority order: userProfile.clerk_user_id > clerkUserId (component-level) > clerkAuth?.userId
      const clerkUserIdForXp =
        userProfile.clerk_user_id || clerkUserId || clerkAuth?.userId;

      if (!clerkUserIdForXp) {
        console.error('❌ XP deduction failed: No Clerk user ID', {
          profileClerkId: userProfile.clerk_user_id,
          componentClerkId: clerkUserId,
          authClerkId: clerkAuth?.userId,
        });
        return {
          success: false,
          error: 'No Clerk user ID available',
        };
      }

      let newBalance = (userProfile.total_xp || 0) - amount;

      // US-017: Convex PRIMARY, Supabase FALLBACK for UUID users
      // PRIMARY: Deduct XP via Convex
      console.log('💸 [Convex] Deducting XP:', { clerkUserIdForXp, amount });
      try {
        const convexResult = await convexDeductXp({
          clerkUserId: clerkUserIdForXp,
          xpToDeduct: amount,
        });
        newBalance = convexResult.newBalance;
        console.log('✅ [Convex] XP deducted successfully:', convexResult);
      } catch (convexError) {
        console.error('❌ [Convex] XP deduction failed:', convexError);
        return {
          success: false,
          error:
            convexError instanceof Error
              ? convexError.message
              : 'XP deduction failed',
        };
      }

      // Update local state immediately for better UX
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

    // TEMPORARY: Skip XP refund during beta (nothing was deducted).
    // TODO: Remove before production release.
    const XP_DEDUCTION_ENABLED = false;
    if (!XP_DEDUCTION_ENABLED) {
      return { success: true, newBalance: userProfile?.total_xp || 0 };
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

      // Get Clerk user ID for Convex operations
      // Priority order: userProfile.clerk_user_id > clerkUserId (component-level) > clerkAuth?.userId
      const clerkUserIdForXp =
        userProfile.clerk_user_id || clerkUserId || clerkAuth?.userId;

      if (!clerkUserIdForXp) {
        console.error('❌ XP refund failed: No Clerk user ID', {
          profileClerkId: userProfile.clerk_user_id,
          componentClerkId: clerkUserId,
          authClerkId: clerkAuth?.userId,
        });
        return {
          success: false,
          error: 'No Clerk user ID available',
        };
      }

      let newBalance = (userProfile.total_xp || 0) + amount;

      // US-017: Convex PRIMARY, Supabase FALLBACK for UUID users
      // PRIMARY: Refund XP via Convex
      console.log('💰 [Convex] Refunding XP:', {
        clerkUserIdForXp,
        amount,
        reason: reason.trim(),
      });
      try {
        const convexResult = await convexRefundXp({
          clerkUserId: clerkUserIdForXp,
          xpToRefund: amount,
          reason: reason.trim(),
        });
        newBalance = convexResult.newBalance;
        console.log('✅ [Convex] XP refunded successfully:', convexResult);
      } catch (convexError) {
        console.error('❌ [Convex] XP refund failed:', convexError);
        return {
          success: false,
          error:
            convexError instanceof Error
              ? convexError.message
              : 'XP refund failed',
        };
      }

      // Update local state immediately for better UX
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
      // Get Clerk user ID for Convex operations
      // Priority order: userProfile.clerk_user_id (from Convex/Supabase) > clerkUserId (component-level const) > clerkAuth?.userId (real-time)
      // Using clerkUserId (line 223) as middle fallback since it's captured at render time and more stable
      const clerkUserIdForXp =
        userProfile.clerk_user_id || clerkUserId || clerkAuth?.userId;

      if (!clerkUserIdForXp) {
        console.error('❌ Onboarding XP award failed: No Clerk user ID', {
          profileClerkId: userProfile.clerk_user_id,
          componentClerkId: clerkUserId,
          authClerkId: clerkAuth?.userId,
        });
        return {
          success: false,
          error: 'No Clerk user ID available',
          xpAwarded: 0,
        };
      }

      console.log('🎁 Awarding onboarding XP:', {
        clerkUserId: clerkUserIdForXp,
        milestoneType,
        xpAmount,
        currentBalance: userProfile.total_xp,
      });

      let newBalance = (userProfile.total_xp || 0) + xpAmount;

      // US-017: Convex PRIMARY, Supabase FALLBACK for UUID users
      // PRIMARY: Add XP via Convex
      console.log('🎁 [Convex] Adding onboarding XP:', {
        clerkUserIdForXp,
        xpAmount,
        milestoneType,
      });
      try {
        const convexResult = await convexAddXp({
          clerkUserId: clerkUserIdForXp,
          xpToAdd: xpAmount,
          wordsAdded: 0,
        });
        newBalance = convexResult.newBalance;
        console.log(
          '✅ [Convex] Onboarding XP added successfully:',
          convexResult,
        );
      } catch (convexError) {
        console.error('❌ [Convex] Onboarding XP award failed:', convexError);
        return {
          success: false,
          error:
            convexError instanceof Error
              ? convexError.message
              : 'Onboarding XP award failed',
          xpAwarded: 0,
        };
      }

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
      // Note: clerkUser from useUser() returns { isLoaded, isSignedIn, user }
      // The actual user object with id is in clerkUser.user
      if (!clerkUser?.user?.id) {
        setNeedsProfileCompletion(false);
        return;
      }

      // Only check if email is confirmed
      // Note: OAuth users don't have a Supabase session, so we don't check for it
      if (!emailConfirmed) {
        setNeedsProfileCompletion(false);
        return;
      }

      const clerkUserId = clerkUser.user.id;

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

      // No profile in context — Convex reactive query hasn't loaded yet or no profile exists
      // Mark as needing completion; Convex reactive query will update when profile loads
      setNeedsProfileCompletion(true);
      console.log(
        '📋 [AuthContext] No profile in context - profile completion needed',
      );
    } catch (error) {
      console.error(
        '❌ [AuthContext] Error checking profile completion:',
        error,
      );
      // On error, assume profile needs completion to be safe
      setNeedsProfileCompletion(true);
    }
  }, [clerkUser?.user?.id, emailConfirmed, userProfile]);

  /**
   * Handle Clerk auth completion (US-016).
   *
   * Replaces the old syncClerkWithSupabase (~330 lines). This simplified version:
   * 1. Sets AppUser from Clerk data
   * 2. Sets emailConfirmed = true (Clerk handles email verification)
   * 3. Checks profile completion (Convex reactive query handles profile loading)
   */
  const handleClerkAuthComplete = useCallback(async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    if (!clerkAuth?.isSignedIn || !clerkAuth) {
      console.log(
        '⚠️ [AuthContext] Cannot complete auth: Clerk user is not signed in',
      );
      return { success: false, error: 'User is not signed in with Clerk' };
    }

    // Clear signing out flag if it's stuck - this is a new sign-in operation
    if (isSigningOut.current) {
      console.log(
        '🔄 [AuthContext] Clearing stuck isSigningOut flag for new sign-in',
      );
      isSigningOut.current = false;
    }

    try {
      console.log('🔄 [AuthContext] Completing Clerk auth...');

      // CRITICAL: Mark OAuth processing as complete BEFORE any state updates
      isProcessingOAuth.current = false;

      // Track that we've successfully synced this Clerk user ID
      const currentClerkUserId = clerkAuth.userId;
      if (currentClerkUserId) {
        lastSyncedClerkUserId.current = currentClerkUserId;
      }

      // Clear any previous OAuth errors on success
      setOAuthError(null);

      // Clerk handles email verification — always confirmed for active sessions
      setEmailConfirmed(true);

      // Set AppUser from Clerk data
      const userId = currentClerkUserId || '';
      const email = clerkUser?.user?.emailAddresses?.[0]?.emailAddress || '';

      console.log('👤 [AuthContext] Setting user from Clerk:', {
        id: userId,
        email,
      });

      setUser({ id: userId, email });

      // Check if profile completion is needed
      // Convex reactive query handles profile data loading automatically
      await checkProfileCompletion();

      console.log('✅ [AuthContext] Clerk auth completion successful');
      return { success: true };
    } catch (error) {
      console.error('❌ [AuthContext] Error completing Clerk auth:', error);
      isProcessingOAuth.current = false;
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown error during auth completion';
      return { success: false, error: errorMessage };
    }
  }, [clerkAuth, clerkUser, checkProfileCompletion]);

  // Handle Clerk OAuth completion after callback
  const handleClerkOAuthCompletion = useCallback(async () => {
    if (!isProcessingOAuth.current || !clerkAuth?.isSignedIn) {
      return;
    }

    await handleClerkAuthComplete();
  }, [clerkAuth?.isSignedIn, handleClerkAuthComplete]);

  // Monitor Clerk auth state changes to detect OAuth completion or existing session
  useEffect(() => {
    const checkAndSync = async () => {
      console.log('🔍 [AuthContext] Clerk auth state changed:', {
        isSignedIn: clerkAuth?.isSignedIn,
        userId: clerkAuth?.userId,
        hasUser: !!user,
        isProcessingOAuth: isProcessingOAuth.current,
        isSigningOut: isSigningOut.current,
      });

      // Skip syncing if we're in the middle of signing out
      if (isSigningOut.current) {
        console.log('⏭️ [AuthContext] Skipping sync - signing out in progress');
        return;
      }

      // If Clerk is signed in but we don't have a user, try to complete auth
      const currentClerkUserId = clerkAuth?.userId;
      const alreadySynced =
        currentClerkUserId === lastSyncedClerkUserId.current;

      if (clerkAuth?.isSignedIn && !user && !loading && !alreadySynced) {
        console.log(
          '🔄 [AuthContext] Clerk signed in but no user - completing auth...',
        );
        const authResult = await handleClerkAuthComplete();
        if (authResult.success) {
          console.log('✅ [AuthContext] Auto-completed Clerk auth');
        } else {
          console.error('❌ [AuthContext] Auto-auth failed:', authResult.error);
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
  }, [clerkAuth?.isSignedIn, clerkAuth?.userId, user, loading]);

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

        // Debug Clerk auth state
        console.log('🔍 [AuthContext] Clerk auth state on init:', {
          isSignedIn: clerkAuth?.isSignedIn,
          userId: clerkAuth?.userId,
          hasClerkUser: !!clerkUser,
          clerkUserId: clerkUser?.user?.id,
        });

        // If Clerk is signed in, set user from Clerk data
        if (clerkAuth?.isSignedIn && clerkAuth?.userId) {
          console.log(
            '🔐 [AuthContext] Clerk user is signed in, setting user...',
          );

          const userId = clerkAuth.userId;
          const email =
            clerkUser?.user?.emailAddresses?.[0]?.emailAddress || '';

          setUser({ id: userId, email });
          setEmailConfirmed(true);

          // Check profile completion
          await checkProfileCompletion();
        }
        // Handle case where we're in the middle of OAuth processing
        else if (
          clerkAuth?.isSignedIn &&
          clerkUser &&
          isProcessingOAuth.current
        ) {
          console.log(
            '🔐 [AuthContext] Clerk user is signed in, checking for OAuth completion...',
          );
          await handleClerkOAuthCompletion();
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

    // Note (US-016): Supabase auth listener (onAuthStateChange) removed.
    // Clerk auth state is monitored by the useEffect above.
  }, []);

  const refreshProfile = useCallback(async (): Promise<void> => {
    // Convex reactive query handles profile data automatically.
    // This function just triggers a profile completion re-check.
    console.log('🔄 [AuthContext] Refreshing profile (checking completion)...');
    await checkProfileCompletion();
  }, [checkProfileCompletion]);

  const clearOAuthError = useCallback(() => {
    setOAuthError(null);
  }, []);

  // Memoize context value to prevent unnecessary re-renders of consumers
  // Only include state values in deps - callbacks are stable via useCallback
  const value: AuthContextType = useMemo(
    () => ({
      user,
      userProfile,
      loading,
      emailConfirmed,
      needsProfileCompletion,
      oauthError,
      signIn,
      signOut,
      updateProfile,
      refreshProfile,
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
      signUpWithClerk,
      verifyEmailCode,
      resendClerkVerificationCode,
      signInWithClerk,
      verifySignInSecondFactor,
      resetPasswordWithClerk,
      verifyPasswordResetCode,
      migrateFromSupabase,
      resumeMigrationWithNewPassword,
    }),
    [
      user,
      userProfile,
      loading,
      emailConfirmed,
      needsProfileCompletion,
      oauthError,
      signIn,
      signOut,
      updateProfile,
      refreshProfile,
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
      signUpWithClerk,
      verifyEmailCode,
      resendClerkVerificationCode,
      signInWithClerk,
      verifySignInSecondFactor,
      resetPasswordWithClerk,
      verifyPasswordResetCode,
      migrateFromSupabase,
      resumeMigrationWithNewPassword,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Export AuthProviderWithClerk as the main AuthProvider
// It will be wrapped in ConditionalClerkProvider when Clerk is configured
export const AuthProvider = AuthProviderWithClerk;
