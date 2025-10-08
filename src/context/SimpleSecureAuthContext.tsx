import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import type {
  UserProfile,
  UserProfileInsert,
  GradeLevel,
} from '../types/database';
import reactotron from '../services/reactotron';

interface SignUpData {
  username: string;
  displayName?: string;
  gradeLevel: GradeLevel;
}

interface SimpleSecureAuthContextType {
  // Basic Auth State (same as original)
  session: Session | null;
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  emailConfirmed: boolean;

  // Security State (simplified)
  requiresTwoFA: boolean;
  twoFAEnabled: boolean;
  securityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'MAXIMUM';
  suspiciousActivity: boolean;
  sessionInfo: any; // Simplified session info

  // Auth Methods (same as original)
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

  // Simplified Security Methods
  setupTwoFA: (method: string) => Promise<{ error?: string }>;
  verifyTwoFA: (code: string) => Promise<{ error?: string; success: boolean }>;
  disableTwoFA: () => Promise<{ error?: string }>;
  getTwoFARequirement: () => any;
  extendSession: () => Promise<boolean>;
  getSessionTimeRemaining: () => number;
  reportSuspiciousActivity: (description: string) => Promise<void>;
  checkSecurityStatus: () => Promise<any>;
  trustCurrentDevice: () => Promise<boolean>;
  viewAuditLogs: () => Promise<any[]>;
}

const SimpleSecureAuthContext = createContext<
  SimpleSecureAuthContextType | undefined
>(undefined);

export const useEnhancedAuth = () => {
  const context = useContext(SimpleSecureAuthContext);
  if (!context) {
    throw new Error(
      'useEnhancedAuth must be used within a SimpleSecureAuthProvider',
    );
  }
  return context;
};

interface SimpleSecureAuthProviderProps {
  children: React.ReactNode;
  onSessionWarning?: (warning: any) => void;
  onSessionExpired?: () => void;
  onSecurityAlert?: (alert: any) => void;
}

export const EnhancedAuthProvider: React.FC<SimpleSecureAuthProviderProps> = ({
  children,
  onSessionWarning,
  onSessionExpired,
  onSecurityAlert,
}) => {
  // Basic auth state
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailConfirmed, setEmailConfirmed] = useState(false);

  // Simplified security state
  const [requiresTwoFA, setRequiresTwoFA] = useState(false);
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [securityLevel, setSecurityLevel] = useState<
    'LOW' | 'MEDIUM' | 'HIGH' | 'MAXIMUM'
  >('LOW');
  const [suspiciousActivity, setSuspiciousActivity] = useState(false);
  const [sessionInfo] = useState({ sessionId: 'mock_session_id' });

  // Basic audit logging function
  const logSecurityEvent = async (
    eventType: string,
    description: string,
    metadata?: any,
  ) => {
    try {
      if (__DEV__) {
        console.log(`Security Event: ${eventType} - ${description}`, metadata);
      }

      // In production, you would log to your security service
      // For now, we'll just console log to prevent errors
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  };

  const fetchUserProfile = async (
    userId: string,
  ): Promise<UserProfile | null> => {
    try {
      console.log('Fetching user profile for ID:', userId);

      const { data: existingProfile, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      console.log('Profile query result:', { existingProfile, error });

      if (existingProfile && !error) {
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

      // Look for profiles containing the email prefix
      const { data: matchingProfiles, error: searchError } = await supabase
        .from('user_profiles')
        .select('*')
        .ilike('username', `%${emailPrefix}%`);

      if (matchingProfiles && matchingProfiles.length > 0 && !searchError) {
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
        last_activity_date: new Date().toISOString().split('T')[0],
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
  ): Promise<{ error?: string; requires2FA?: boolean }> => {
    try {
      await logSecurityEvent('LOGIN_ATTEMPT', 'User attempting to sign in', {
        email,
      });

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        await logSecurityEvent('LOGIN_FAILED', 'Sign in failed', {
          email,
          error: error.message,
        });
        return { error: error.message };
      }

      if (!data.user) {
        return { error: 'Authentication failed' };
      }

      // Save remember me preference
      const { RememberMeStorage } = await import('../utils/rememberMeStorage');
      await RememberMeStorage.setRememberMe(rememberMe, email);

      await logSecurityEvent('LOGIN_SUCCESS', 'User signed in successfully', {
        userId: data.user.id,
      });

      return {};
    } catch (error) {
      console.error('Sign in error:', error);
      return { error: 'An unexpected error occurred during sign in' };
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

      if (data.user && !data.user.email_confirmed_at) {
        setEmailConfirmed(false);
      }

      await logSecurityEvent('SIGNUP_SUCCESS', 'User signed up successfully', {
        userId: data.user?.id,
        email,
      });

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

      // Reset state
      setSession(null);
      setUser(null);
      setUserProfile(null);
      setRequiresTwoFA(false);
      setTwoFAEnabled(false);
      setSecurityLevel('LOW');
      setSuspiciousActivity(false);
      setEmailConfirmed(false);

      await logSecurityEvent('LOGOUT', 'User signed out');
    } catch (error) {
      console.error('Error signing out:', error);
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

      await logSecurityEvent('PROFILE_UPDATE', 'User profile updated', {
        userId: user.id,
        updatedFields: Object.keys(profile),
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

  // Simplified security methods (stubbed for now)
  const setupTwoFA = async (): Promise<{ error?: string }> => {
    return { error: '2FA setup not implemented yet' };
  };

  const verifyTwoFA = async (): Promise<{
    error?: string;
    success: boolean;
  }> => {
    return { success: false, error: '2FA verification not implemented yet' };
  };

  const disableTwoFA = async (): Promise<{ error?: string }> => {
    return { error: '2FA disable not implemented yet' };
  };

  const getTwoFARequirement = () => ({
    required: false,
    reason: '',
    methods: [],
    canUseBackupCode: false,
    hasBackupCodes: false,
  });

  const extendSession = async (): Promise<boolean> => {
    return false;
  };

  const getSessionTimeRemaining = (): number => {
    return 24 * 60 * 60 * 1000; // 24 hours in ms
  };

  const reportSuspiciousActivity = async (
    description: string,
  ): Promise<void> => {
    await logSecurityEvent('SUSPICIOUS_ACTIVITY', description);
    setSuspiciousActivity(true);
  };

  const checkSecurityStatus = async () => {
    return {
      action: 'ALLOW',
      reason: 'Security check passed',
      confidence: 0.9,
      riskScore: 0,
      appliedPolicies: ['basic_security'],
    };
  };

  const trustCurrentDevice = async (): Promise<boolean> => {
    await logSecurityEvent('DEVICE_TRUSTED', 'User marked device as trusted');
    return true;
  };

  const viewAuditLogs = async (): Promise<any[]> => {
    return [];
  };

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 100));

        const {
          data: { session: initialSession },
          error,
        } = await supabase.auth.getSession();

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
          if (!profile) {
            console.log(
              'No existing profile found, creating new profile for user:',
              initialSession.user.email,
            );
            profile = await createUserProfile(initialSession.user);
          }
          setUserProfile(profile);
        }

        setLoading(false);
      } catch (error) {
        console.error('Error initializing auth:', error);
        setLoading(false);
      }
    };

    let authSubscription: { unsubscribe: () => void } | null = null;

    const setupAuthListener = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 100));

        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
          console.log(
            'Auth state changed:',
            event,
            currentSession?.user?.email,
          );

          setSession(currentSession);
          setUser(currentSession?.user ?? null);

          if (currentSession?.user) {
            setEmailConfirmed(!!currentSession.user.email_confirmed_at);

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

  const value: SimpleSecureAuthContextType = {
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
    <SimpleSecureAuthContext.Provider value={value}>
      {children}
    </SimpleSecureAuthContext.Provider>
  );
};
