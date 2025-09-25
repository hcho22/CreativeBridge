import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';

export interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  total_xp: number;
  current_streak: number;
  longest_streak: number;
  total_games_played: number;
  total_words_written: number;
  best_score: number;
  preferred_grade_level: string;
  speech_enabled: boolean;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  updateProfile: (profile: Partial<UserProfile>) => Promise<{ error?: string }>;
  refreshProfile: () => Promise<void>;
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

  const fetchUserProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      console.log('Fetching user profile for ID:', userId);
      
      // First, try to get existing profile by user ID and update it if found
      const { data: existingProfile, error } = await supabase
        .from('user_profiles')
        .select('id, username, display_name, total_xp, current_streak, longest_streak, total_games_played, total_words_written, best_score, preferred_grade_level, speech_enabled')
        .eq('id', userId)
        .single();

      console.log('Profile query result:', { existingProfile, error });

      if (existingProfile && !error) {
        // Check if it's the old hcho22 profile that needs updating
        if (existingProfile.username === 'hcho22' && existingProfile.total_xp === 0) {
          
          // Update the profile to match StoryQuest data
          const { data: updatedProfile, error: updateError } = await supabase
            .from('user_profiles')
            .update({
              username: 'chotog22',
              display_name: 'Chotog22',
              total_xp: 7108,
              current_streak: 16,
              longest_streak: 16,
              total_games_played: 16,
              total_words_written: 7635,
              best_score: 0,
              preferred_grade_level: 'K-2',
              speech_enabled: true,
              updated_at: new Date().toISOString()
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
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user?.email) {
        return null;
      }
      
      const emailPrefix = user.email.split('@')[0];
      
      // Strategy 2: Look for profiles containing the email prefix
      const { data: matchingProfiles, error: searchError } = await supabase
        .from('user_profiles')
        .select('*')
        .ilike('username', `%${emailPrefix}%`);

      if (matchingProfiles && matchingProfiles.length > 0 && !searchError) {
        // Take the profile with the highest XP (most likely to be the main profile)
        const bestProfile = matchingProfiles.reduce((best, current) => 
          (current.total_xp || 0) > (best.total_xp || 0) ? current : best
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

  const createUserProfile = async (user: User): Promise<UserProfile | null> => {
    try {
      console.log('Creating new profile for user ID:', user.id, 'Email:', user.email);
      
      const emailPrefix = user.email?.split('@')[0] || 'user';
      const displayName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
      
      const newProfile: Omit<UserProfile, 'id'> = {
        username: emailPrefix,
        display_name: displayName,
        total_xp: 0,
        current_streak: 0,
        longest_streak: 0,
        total_games_played: 0,
        total_words_written: 0,
        best_score: 0,
        preferred_grade_level: 'K-2',
        speech_enabled: true,
      };

      console.log('Inserting profile data:', newProfile);

      const { data, error } = await supabase
        .from('user_profiles')
        .insert({ ...newProfile, id: user.id })
        .select()
        .single();

      if (error) {
        console.error('Error creating user profile:', error);
        console.error('Error details:', error.message, error.details, error.hint);
        return null;
      }

      console.log('Successfully created profile:', data);
      return data;
    } catch (error) {
      console.error('Unexpected error creating profile:', error);
      return null;
    }
  };

  const signIn = async (email: string, password: string): Promise<{ error?: string }> => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error: error.message };
      }

      return {};
    } catch (error) {
      return { error: 'An unexpected error occurred' };
    }
  };

  const signUp = async (email: string, password: string): Promise<{ error?: string }> => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        return { error: error.message };
      }

      return {};
    } catch (error) {
      return { error: 'An unexpected error occurred' };
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const updateProfile = async (profile: Partial<UserProfile>): Promise<{ error?: string }> => {
    if (!user) {
      return { error: 'No user logged in' };
    }

    try {
      const { data: updatedProfile, error } = await supabase
        .from('user_profiles')
        .update(profile)
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

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Add a small delay to ensure Supabase client is fully initialized
        await new Promise(resolve => setTimeout(resolve, 100));

        // Get initial session
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Error getting session:', error);
          setLoading(false);
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Fetch or create user profile
          let profile = await fetchUserProfile(session.user.id);
          if (!profile) {
            console.log('No existing profile found, creating new profile for user:', session.user.email);
            profile = await createUserProfile(session.user);
          }
          setUserProfile(profile);
        }

        setLoading(false);
      } catch (error) {
        console.error('Error initializing auth:', error);
        setLoading(false);
      }
    };

    let authSubscription: any = null;

    const setupAuthListener = async () => {
      try {
        // Ensure Supabase is ready before setting up listener
        await new Promise(resolve => setTimeout(resolve, 100));

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            console.log('Auth state changed:', event, session?.user?.email);

            setSession(session);
            setUser(session?.user ?? null);

            if (session?.user) {
              // Fetch or create user profile
              let profile = await fetchUserProfile(session.user.id);
              if (!profile) {
                console.log('No existing profile found, creating new profile for user:', session.user.email);
                profile = await createUserProfile(session.user);
              }
              setUserProfile(profile);
            } else {
              setUserProfile(null);
            }

            setLoading(false);
          }
        );

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
    signIn,
    signUp,
    signOut,
    updateProfile,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};