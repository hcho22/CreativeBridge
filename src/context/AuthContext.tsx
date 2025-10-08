import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';
import type {
  UserProfile,
  UserProfileInsert,
  GradeLevel,
} from '../types/database';
import { RememberMeStorage } from '../utils/rememberMeStorage';

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

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        console.log('🔄 Starting auth initialization...');

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
        console.error('❌ Error initializing auth:', error);
        setLoading(false);
      }
    };

    let authSubscription: { unsubscribe: () => void } | null = null;

    const setupAuthListener = async () => {
      try {
        // Ensure Supabase is ready before setting up listener
        await new Promise(resolve => setTimeout(resolve, 100));

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

  const refreshProfile = async (): Promise<void> => {
    if (user?.id) {
      const profile = await fetchUserProfile(user.id);
      setUserProfile(profile);
    }
  };

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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
