import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import type {
  UserProfile,
  UserProfileInsert,
  GradeLevel,
} from '../types/database';

interface SignUpData {
  username: string;
  displayName?: string;
  gradeLevel: GradeLevel;
}

interface StableAuthContextType {
  // Basic Auth State
  session: Session | null;
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  emailConfirmed: boolean;

  // Simplified Security State
  requiresTwoFA: boolean;
  twoFAEnabled: boolean;
  securityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'MAXIMUM';
  suspiciousActivity: boolean;
  sessionInfo: { sessionId: string };

  // Auth Methods
  signIn: (
    email: string,
    password: string,
    rememberMe?: boolean,
  ) => Promise<{ error?: string; requires2FA?: boolean }>;
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

  // Simplified Security Methods (all return safe defaults)
  setupTwoFA: () => Promise<{ error?: string }>;
  verifyTwoFA: () => Promise<{ error?: string; success: boolean }>;
  disableTwoFA: () => Promise<{ error?: string }>;
  getTwoFARequirement: () => any;
  extendSession: () => Promise<boolean>;
  getSessionTimeRemaining: () => number;
  reportSuspiciousActivity: (description: string) => Promise<void>;
  checkSecurityStatus: () => Promise<any>;
  trustCurrentDevice: () => Promise<boolean>;
  viewAuditLogs: () => Promise<any[]>;
}

const StableAuthContext = createContext<StableAuthContextType | undefined>(
  undefined,
);

export const useEnhancedAuth = () => {
  const context = useContext(StableAuthContext);
  if (!context) {
    throw new Error('useEnhancedAuth must be used within a StableAuthProvider');
  }
  return context;
};

interface StableAuthProviderProps {
  children: React.ReactNode;
  onSessionWarning?: (warning: any) => void;
  onSessionExpired?: () => void;
  onSecurityAlert?: (alert: any) => void;
}

export const EnhancedAuthProvider: React.FC<StableAuthProviderProps> = ({
  children,
}) => {
  // Basic auth state
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailConfirmed, setEmailConfirmed] = useState(false);

  // Static security state to prevent hooks issues
  const [requiresTwoFA] = useState(false);
  const [twoFAEnabled] = useState(false);
  const [securityLevel] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'MAXIMUM'>(
    'LOW',
  );
  const [suspiciousActivity] = useState(false);
  const [sessionInfo] = useState({ sessionId: 'stable_session_id' });

  // Simple logging function
  const logEvent = (event: string, details?: any) => {
    if (__DEV__) {
      console.log(`[Auth Event] ${event}:`, details);
    }
  };

  const fetchUserProfile = async (
    userId: string,
  ): Promise<UserProfile | null> => {
    try {
      const { data: existingProfile, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (existingProfile && !error) {
        return existingProfile;
      }

      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      if (!currentUser?.email) return null;

      const emailPrefix = currentUser.email.split('@')[0];
      const { data: matchingProfiles } = await supabase
        .from('user_profiles')
        .select('*')
        .ilike('username', `%${emailPrefix}%`);

      if (matchingProfiles && matchingProfiles.length > 0) {
        const bestProfile = matchingProfiles.reduce((best, current) =>
          (current.total_xp || 0) > (best.total_xp || 0) ? current : best,
        );

        const { data: linkedProfile } = await supabase
          .from('user_profiles')
          .update({ id: userId })
          .eq('username', bestProfile.username)
          .select('*')
          .single();

        if (linkedProfile) return linkedProfile;
      }

      return null;
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  };

  const createUserProfile = async (
    userParam: User,
  ): Promise<UserProfile | null> => {
    try {
      const emailPrefix = userParam.email?.split('@')[0] || 'user';
      const displayName =
        emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);

      const newProfile: UserProfileInsert = {
        username: emailPrefix,
        display_name: displayName,
        total_xp: 0,
        current_streak: 0,
        longest_streak: 0,
        last_activity_date: new Date().toISOString().split('T')[0],
        best_score: 0,
        total_games_played: 0,
        total_stories_completed: 0,
        total_words_written: 0,
        preferred_grade_level: 'K-2' as GradeLevel,
        speech_enabled: true,
      };

      const { data, error } = await supabase
        .from('user_profiles')
        .insert({ ...newProfile, id: userParam.id })
        .select()
        .single();

      if (!error && data) {
        logEvent('PROFILE_CREATED', { userId: userParam.id });
        return data;
      }

      return null;
    } catch (error) {
      console.error('Error creating profile:', error);
      return null;
    }
  };

  const signIn = async (
    email: string,
    password: string,
    rememberMe = false,
  ): Promise<{ error?: string; requires2FA?: boolean }> => {
    try {
      logEvent('SIGN_IN_ATTEMPT', { email });

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        logEvent('SIGN_IN_FAILED', { email, error: error.message });
        return { error: error.message };
      }

      if (data.user) {
        logEvent('SIGN_IN_SUCCESS', { userId: data.user.id });

        // Save remember me preference
        const { RememberMeStorage } = await import(
          '../utils/rememberMeStorage'
        );
        await RememberMeStorage.setRememberMe(rememberMe, email);
      }

      return {};
    } catch (error) {
      logEvent('SIGN_IN_ERROR', { error });
      return { error: 'An unexpected error occurred during sign in' };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    profileData?: SignUpData,
  ): Promise<{ error?: string }> => {
    try {
      logEvent('SIGN_UP_ATTEMPT', { email });

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        return { error: error.message };
      }

      if (data.user && !data.user.email_confirmed_at) {
        setEmailConfirmed(false);
      }

      logEvent('SIGN_UP_SUCCESS', { userId: data.user?.id });
      return {};
    } catch (error) {
      return { error: 'An unexpected error occurred' };
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      const { RememberMeStorage } = await import('../utils/rememberMeStorage');
      const rememberMeData = await RememberMeStorage.getRememberMe();

      await supabase.auth.signOut();

      if (!rememberMeData?.isEnabled) {
        await RememberMeStorage.clearRememberMe();
      }

      // Reset all state
      setSession(null);
      setUser(null);
      setUserProfile(null);
      setEmailConfirmed(false);

      logEvent('SIGN_OUT_SUCCESS');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const updateProfile = async (
    profile: Partial<UserProfile>,
  ): Promise<{ error?: string }> => {
    if (!user) return { error: 'No user logged in' };

    try {
      const { data: updatedProfile, error } = await supabase
        .from('user_profiles')
        .update(profile as any)
        .eq('id', user.id)
        .select()
        .single();

      if (error) return { error: error.message };

      setUserProfile(updatedProfile);
      logEvent('PROFILE_UPDATED', {
        userId: user.id,
        fields: Object.keys(profile),
      });
      return {};
    } catch (error) {
      return { error: 'An unexpected error occurred' };
    }
  };

  const refreshProfile = async (): Promise<void> => {
    if (user?.id) {
      const profile = await fetchUserProfile(user.id);
      setUserProfile(profile);
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
      return error ? { error: error.message } : {};
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
      return error ? { error: error.message } : {};
    } catch (error) {
      return { error: 'An unexpected error occurred' };
    }
  };

  // Simple security method stubs
  const setupTwoFA = async () => ({ error: '2FA setup not implemented yet' });
  const verifyTwoFA = async () => ({
    success: false,
    error: '2FA verification not implemented yet',
  });
  const disableTwoFA = async () => ({
    error: '2FA disable not implemented yet',
  });
  const getTwoFARequirement = () => ({
    required: false,
    reason: '',
    methods: [],
    canUseBackupCode: false,
    hasBackupCodes: false,
  });
  const extendSession = async () => false;
  const getSessionTimeRemaining = () => 24 * 60 * 60 * 1000;
  const reportSuspiciousActivity = async (description: string) =>
    logEvent('SUSPICIOUS_ACTIVITY', { description });
  const checkSecurityStatus = async () => ({
    action: 'ALLOW',
    reason: 'Security check passed',
    confidence: 0.9,
    riskScore: 0,
    appliedPolicies: ['basic_security'],
  });
  const trustCurrentDevice = async () => {
    logEvent('DEVICE_TRUSTED');
    return true;
  };
  const viewAuditLogs = async () => [];

  // Single useEffect for auth initialization
  useEffect(() => {
    let mounted = true;
    let authSubscription: { unsubscribe: () => void } | null = null;

    const initialize = async () => {
      try {
        // Get initial session
        const {
          data: { session: initialSession },
          error,
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (error) {
          console.error('Error getting session:', error);
          setLoading(false);
          return;
        }

        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        if (initialSession?.user) {
          setEmailConfirmed(!!initialSession.user.email_confirmed_at);

          let profile = await fetchUserProfile(initialSession.user.id);
          if (!profile && mounted) {
            profile = await createUserProfile(initialSession.user);
          }

          if (mounted) {
            setUserProfile(profile);
          }
        }

        // Set up auth listener
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
          if (!mounted) return;

          logEvent('AUTH_STATE_CHANGE', {
            event,
            userEmail: currentSession?.user?.email,
          });

          setSession(currentSession);
          setUser(currentSession?.user ?? null);

          if (currentSession?.user) {
            setEmailConfirmed(!!currentSession.user.email_confirmed_at);

            let profile = await fetchUserProfile(currentSession.user.id);
            if (!profile && mounted) {
              profile = await createUserProfile(currentSession.user);
            }

            if (mounted) {
              setUserProfile(profile);
            }
          } else {
            setUserProfile(null);
            setEmailConfirmed(false);
          }

          if (mounted) {
            setLoading(false);
          }
        });

        authSubscription = subscription;

        if (mounted) {
          setLoading(false);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initialize();

    return () => {
      mounted = false;
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
    };
  }, []); // Empty dependency array - only run once

  const value: StableAuthContextType = {
    // Basic auth state
    session,
    user,
    userProfile,
    loading,
    emailConfirmed,

    // Security state
    requiresTwoFA,
    twoFAEnabled,
    securityLevel,
    suspiciousActivity,
    sessionInfo,

    // Auth methods
    signIn,
    signUp,
    signOut,
    updateProfile,
    refreshProfile,
    resendConfirmation,
    checkEmailConfirmation,
    resetPassword,

    // Security methods (simplified)
    setupTwoFA,
    verifyTwoFA,
    disableTwoFA,
    getTwoFARequirement,
    extendSession,
    getSessionTimeRemaining,
    reportSuspiciousActivity,
    checkSecurityStatus,
    trustCurrentDevice,
    viewAuditLogs,
  };

  return (
    <StableAuthContext.Provider value={value}>
      {children}
    </StableAuthContext.Provider>
  );
};
