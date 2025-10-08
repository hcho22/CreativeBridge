import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import type {
  UserProfile,
  UserProfileInsert,
  GradeLevel,
  AuthError,
  AuthResult,
  ProfileResult,
  LoadingStates,
  SessionHealth,
  ValidationResult,
  UserValidation,
  Database,
} from '../types/database';
import { AuthErrorType } from '../types/database';
import reactotron from '../services/reactotron';

// Enhanced AuthContext interface with all improvements
interface EnhancedAuthContextType {
  // Core auth state
  session: Session | null;
  user: User | null;
  userProfile: UserProfile | null;

  // Enhanced loading states
  loadingStates: LoadingStates;

  // Session health
  sessionHealth: SessionHealth;

  // Auth operations with enhanced error handling
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<AuthResult>;
  updateProfile: (profile: Partial<UserProfile>) => Promise<ProfileResult>;
  refreshProfile: () => Promise<ProfileResult>;

  // Session validation
  validateSession: () => Promise<SessionHealth>;
  refreshSession: () => Promise<AuthResult>;

  // Helper functions
  isAuthenticated: () => boolean;
  isSessionExpired: () => boolean;
  getUserDisplayName: () => string;
  getUserStats: () => {
    xp: number;
    streak: number;
    games: number;
    words: number;
  } | null;

  // Validation helpers
  validateEmail: (email: string) => ValidationResult;
  validatePassword: (password: string) => ValidationResult;
  validateUsername: (username: string) => ValidationResult;
  validateDisplayName: (displayName: string) => ValidationResult;
  validateUserInput: (
    email: string,
    password: string,
    username?: string,
  ) => UserValidation;

  // Error utilities
  formatAuthError: (error: AuthError) => string;
  clearErrors: () => void;

  // Profile helpers
  createDefaultProfile: (email: string) => UserProfileInsert;
  hasPermission: (permission: string) => boolean;
  requireAuth: () => boolean;
}

const AuthContext = createContext<EnhancedAuthContextType | undefined>(
  undefined,
);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Error handling utilities
const createAuthError = (
  type: AuthErrorType,
  message: string,
  details?: string,
  code?: string,
  retryable = false,
): AuthError => ({
  type,
  message,
  details,
  code,
  retryable,
});

const handleSupabaseError = (error: unknown): AuthError => {
  if (!error) {
    return createAuthError(
      AuthErrorType.UNKNOWN_ERROR,
      'An unexpected error occurred',
    );
  }

  // Type guard for error objects
  const isErrorObject = (
    err: unknown,
  ): err is { message?: string; code?: string; details?: string } => {
    return typeof err === 'object' && err !== null;
  };

  const errorObj = isErrorObject(error) ? error : {};

  // Network errors
  if (errorObj.message?.includes('fetch')) {
    return createAuthError(
      AuthErrorType.NETWORK_ERROR,
      'Network connection failed. Please check your internet connection.',
      errorObj.message,
      errorObj.code,
      true,
    );
  }

  // Auth-specific errors
  if (errorObj.message?.includes('Invalid login credentials')) {
    return createAuthError(
      AuthErrorType.AUTH_ERROR,
      'Invalid email or password. Please try again.',
      errorObj.message,
      errorObj.code,
    );
  }

  if (errorObj.message?.includes('Email already registered')) {
    return createAuthError(
      AuthErrorType.AUTH_ERROR,
      'An account with this email already exists.',
      errorObj.message,
      errorObj.code,
    );
  }

  if (errorObj.message?.includes('Password should be')) {
    return createAuthError(
      AuthErrorType.VALIDATION_ERROR,
      'Password must be at least 6 characters long.',
      errorObj.message,
      errorObj.code,
    );
  }

  // Default error
  return createAuthError(
    AuthErrorType.UNKNOWN_ERROR,
    errorObj.message || 'An unexpected error occurred',
    errorObj.details,
    errorObj.code,
    false,
  );
};

// Retry mechanism
const withRetry = async <T extends any>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 1000,
): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: unknown) {
      lastError = error;

      const authError = handleSupabaseError(error);
      if (!authError.retryable || attempt === maxRetries) {
        throw error;
      }

      reactotron.warn?.(
        `🔄 Retry attempt ${attempt}/${maxRetries} for operation: ${authError.message}`,
      );
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }

  throw lastError;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // Core state
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // Enhanced loading states
  const [loadingStates, setLoadingStates] = useState<LoadingStates>({
    initializing: true,
    signingIn: false,
    signingUp: false,
    signingOut: false,
    updatingProfile: false,
    refreshingProfile: false,
    fetchingProfile: false,
    validatingSession: false,
  });

  // Session health state
  const [sessionHealth, setSessionHealth] = useState<SessionHealth>({
    isValid: false,
    needsRefresh: false,
    errors: [],
  });

  // Helper to update specific loading state
  const setLoadingState = useCallback(
    (key: keyof LoadingStates, value: boolean) => {
      setLoadingStates(prev => ({ ...prev, [key]: value }));
    },
    [],
  );

  // Validation helpers
  const validateEmail = useCallback((email: string): ValidationResult => {
    const errors: string[] = [];

    if (!email) {
      errors.push('Email is required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push('Please enter a valid email address');
    }

    return { isValid: errors.length === 0, errors };
  }, []);

  const validatePassword = useCallback((password: string): ValidationResult => {
    const errors: string[] = [];

    if (!password) {
      errors.push('Password is required');
    } else {
      if (password.length < 6) {
        errors.push('Password must be at least 6 characters long');
      }
      if (!/[A-Za-z]/.test(password)) {
        errors.push('Password must contain at least one letter');
      }
    }

    return { isValid: errors.length === 0, errors };
  }, []);

  const validateUsername = useCallback((username: string): ValidationResult => {
    const errors: string[] = [];

    if (!username) {
      errors.push('Username is required');
    } else {
      if (username.length < 3) {
        errors.push('Username must be at least 3 characters long');
      }
      if (username.length > 50) {
        errors.push('Username must be less than 50 characters');
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
        errors.push(
          'Username can only contain letters, numbers, underscores, and hyphens',
        );
      }
    }

    return { isValid: errors.length === 0, errors };
  }, []);

  const validateDisplayName = useCallback(
    (displayName: string): ValidationResult => {
      const errors: string[] = [];

      if (displayName && displayName.length > 100) {
        errors.push('Display name must be less than 100 characters');
      }

      return { isValid: errors.length === 0, errors };
    },
    [],
  );

  const validateUserInput = useCallback(
    (email: string, password: string, username?: string): UserValidation => {
      return {
        email: validateEmail(email),
        password: validatePassword(password),
        username: username
          ? validateUsername(username)
          : { isValid: true, errors: [] },
        displayName: { isValid: true, errors: [] },
      };
    },
    [validateEmail, validatePassword, validateUsername],
  );

  // Session validation
  const validateSession = useCallback(async (): Promise<SessionHealth> => {
    setLoadingState('validatingSession', true);

    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        const health: SessionHealth = {
          isValid: false,
          needsRefresh: true,
          errors: [handleSupabaseError(error)],
        };
        setSessionHealth(health);
        return health;
      }

      if (!data.session) {
        const health: SessionHealth = {
          isValid: false,
          needsRefresh: false,
          errors: [],
        };
        setSessionHealth(health);
        return health;
      }

      // Check if session will expire soon (within 5 minutes)
      const expiresAt = data.session.expires_at
        ? data.session.expires_at * 1000
        : 0;
      const needsRefresh =
        expiresAt > 0 && expiresAt - Date.now() < 5 * 60 * 1000;

      const health: SessionHealth = {
        isValid: true,
        expiresAt,
        needsRefresh,
        errors: [],
      };

      setSessionHealth(health);
      return health;
    } catch (error) {
      const health: SessionHealth = {
        isValid: false,
        needsRefresh: true,
        errors: [handleSupabaseError(error)],
      };
      setSessionHealth(health);
      return health;
    } finally {
      setLoadingState('validatingSession', false);
    }
  }, [setLoadingState]);

  // Enhanced profile fetching with retry
  const fetchUserProfile = useCallback(
    async (userId: string): Promise<UserProfile | null> => {
      setLoadingState('fetchingProfile', true);

      try {
        return await withRetry(async () => {
          const { data: existingProfile, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', userId)
            .single();

          if (error) {
            const errorObj = isErrorObject(error) ? error : {};
            if (errorObj.code === 'PGRST116') {
              // No rows found - this is expected for new users
              return null;
            }
            throw error;
          }

          return existingProfile;
        });
      } catch (error) {
        reactotron.error?.(
          '❌ Failed to fetch user profile',
          handleSupabaseError(error),
        );
        return null;
      } finally {
        setLoadingState('fetchingProfile', false);
      }
    },
    [setLoadingState],
  );

  // Enhanced profile creation
  const createUserProfile = useCallback(
    async (user: User): Promise<UserProfile | null> => {
      try {
        const emailPrefix = user.email?.split('@')[0] || 'user';
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

        return await withRetry(async () => {
          const insertData: UserProfileInsert = { ...newProfile, id: user.id };
          const { data, error } = await supabase
            .from('user_profiles')
            .insert(insertData)
            .select()
            .single();

          if (error) {
            throw error;
          }

          return data;
        });
      } catch (error) {
        reactotron.error?.(
          '❌ Failed to create user profile',
          handleSupabaseError(error),
        );
        return null;
      }
    },
    [],
  );

  // Enhanced auth operations with improved error handling and loading states
  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      setLoadingState('signingIn', true);

      try {
        // Validate input
        const validation = validateUserInput(email, password);
        if (!validation.email.isValid || !validation.password.isValid) {
          const errors = [
            ...validation.email.errors,
            ...validation.password.errors,
          ];
          return {
            error: createAuthError(
              AuthErrorType.VALIDATION_ERROR,
              errors.join(', '),
            ),
            success: false,
          };
        }

        reactotron.log?.('🔐 Attempting sign in', { email });

        const result = await withRetry(async () => {
          const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (error) {
            throw error;
          }

          return { success: true };
        });

        reactotron.log?.('✅ Sign in successful');
        return { success: true };
      } catch (error) {
        const authError = handleSupabaseError(error);
        reactotron.error?.('❌ Sign in failed', authError.message);
        return { error: authError, success: false };
      } finally {
        setLoadingState('signingIn', false);
      }
    },
    [setLoadingState, validateUserInput],
  );

  const signUp = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      setLoadingState('signingUp', true);

      try {
        // Validate input
        const validation = validateUserInput(email, password);
        if (!validation.email.isValid || !validation.password.isValid) {
          const errors = [
            ...validation.email.errors,
            ...validation.password.errors,
          ];
          return {
            error: createAuthError(
              AuthErrorType.VALIDATION_ERROR,
              errors.join(', '),
            ),
            success: false,
          };
        }

        reactotron.log?.('📝 Attempting sign up', { email });

        const result = await withRetry(async () => {
          const { error } = await supabase.auth.signUp({
            email,
            password,
          });

          if (error) {
            throw error;
          }

          return { success: true };
        });

        reactotron.log?.('✅ Sign up successful');
        return { success: true };
      } catch (error) {
        const authError = handleSupabaseError(error);
        reactotron.error?.('❌ Sign up failed', authError.message);
        return { error: authError, success: false };
      } finally {
        setLoadingState('signingUp', false);
      }
    },
    [setLoadingState, validateUserInput],
  );

  const signOut = useCallback(async (): Promise<AuthResult> => {
    setLoadingState('signingOut', true);

    try {
      await withRetry(async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
          throw error;
        }
      });

      reactotron.log?.('👋 Sign out successful');
      return { success: true };
    } catch (error) {
      const authError = handleSupabaseError(error);
      reactotron.error?.('❌ Sign out failed', authError.message);
      return { error: authError, success: false };
    } finally {
      setLoadingState('signingOut', false);
    }
  }, [setLoadingState]);

  const updateProfile = useCallback(
    async (profile: Partial<UserProfile>): Promise<ProfileResult> => {
      if (!user) {
        return {
          error: createAuthError(AuthErrorType.AUTH_ERROR, 'No user logged in'),
          success: false,
        };
      }

      setLoadingState('updatingProfile', true);

      try {
        const updatedProfile = await withRetry(async () => {
          const updateData =
            profile as Database['public']['Tables']['user_profiles']['Update'];
          const { data, error } = await supabase
            .from('user_profiles')
            .update(updateData)
            .eq('id', user.id)
            .select()
            .single();

          if (error) {
            throw error;
          }

          return data;
        });

        setUserProfile(updatedProfile);
        reactotron.log?.('✅ Profile updated successfully');

        return { profile: updatedProfile, success: true };
      } catch (error) {
        const authError = handleSupabaseError(error);
        reactotron.error?.('❌ Profile update failed', authError.message);
        return { error: authError, success: false };
      } finally {
        setLoadingState('updatingProfile', false);
      }
    },
    [user, setLoadingState],
  );

  const refreshProfile = useCallback(async (): Promise<ProfileResult> => {
    if (!user?.id) {
      return {
        error: createAuthError(AuthErrorType.AUTH_ERROR, 'No user logged in'),
        success: false,
      };
    }

    setLoadingState('refreshingProfile', true);

    try {
      const profile = await fetchUserProfile(user.id);
      if (profile) {
        setUserProfile(profile);
        return { profile, success: true };
      } else {
        return {
          error: createAuthError(
            AuthErrorType.PROFILE_ERROR,
            'Failed to refresh profile',
          ),
          success: false,
        };
      }
    } catch (error) {
      const authError = handleSupabaseError(error);
      return { error: authError, success: false };
    } finally {
      setLoadingState('refreshingProfile', false);
    }
  }, [user, fetchUserProfile, setLoadingState]);

  const refreshSession = useCallback(async (): Promise<AuthResult> => {
    try {
      const { error } = await supabase.auth.refreshSession();

      if (error) {
        return {
          error: handleSupabaseError(error),
          success: false,
        };
      }

      return { success: true };
    } catch (error) {
      return {
        error: handleSupabaseError(error),
        success: false,
      };
    }
  }, []);

  // Helper functions
  const isAuthenticated = useCallback((): boolean => {
    return !!(session && user);
  }, [session, user]);

  const isSessionExpired = useCallback((): boolean => {
    if (!session) return true;

    const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
    return expiresAt > 0 && Date.now() > expiresAt;
  }, [session]);

  const getUserDisplayName = useCallback((): string => {
    return (
      userProfile?.display_name ||
      userProfile?.username ||
      user?.email ||
      'User'
    );
  }, [userProfile, user]);

  const getUserStats = useCallback(() => {
    if (!userProfile) return null;

    return {
      xp: userProfile.total_xp,
      streak: userProfile.current_streak,
      games: userProfile.total_games_played,
      words: userProfile.total_words_written,
    };
  }, [userProfile]);

  const formatAuthError = useCallback((error: AuthError): string => {
    return error.message;
  }, []);

  const clearErrors = useCallback(() => {
    setSessionHealth(prev => ({ ...prev, errors: [] }));
  }, []);

  const createDefaultProfile = useCallback(
    (email: string): UserProfileInsert => {
      const emailPrefix = email.split('@')[0] || 'user';
      const displayName =
        emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);

      return {
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
    },
    [],
  );

  const hasPermission = useCallback(
    (permission: string): boolean => {
      // Basic permission system - can be expanded
      return isAuthenticated();
    },
    [isAuthenticated],
  );

  const requireAuth = useCallback((): boolean => {
    const authenticated = isAuthenticated();
    if (!authenticated) {
      reactotron.warn?.('🔒 Authentication required');
    }
    return authenticated;
  }, [isAuthenticated]);

  // Enhanced initialization with session validation
  useEffect(() => {
    const initializeAuth = async () => {
      setLoadingState('initializing', true);

      try {
        // Small delay for client initialization
        await new Promise(resolve => setTimeout(resolve, 100));

        // Get and validate initial session
        const health = await validateSession();

        if (health.isValid && health.needsRefresh) {
          await refreshSession();
        }

        // Get session after potential refresh
        const {
          data: { session: currentSession },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          const errorObj = isErrorObject(error) ? error : {};
          reactotron.error?.('❌ Error getting session', errorObj.message);
          return;
        }

        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          // Fetch or create user profile
          let profile = await fetchUserProfile(currentSession.user.id);
          if (!profile) {
            reactotron.log?.('📝 Creating new user profile');
            profile = await createUserProfile(currentSession.user);
          }
          setUserProfile(profile);
        }
      } catch (error) {
        reactotron.error?.(
          '❌ Auth initialization failed',
          handleSupabaseError(error),
        );
      } finally {
        setLoadingState('initializing', false);
      }
    };

    // Enhanced auth state listener
    const setupAuthListener = async () => {
      try {
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
          reactotron.log?.('🔄 Auth state changed', {
            event,
            email: currentSession?.user?.email,
          });

          setSession(currentSession);
          setUser(currentSession?.user ?? null);

          if (currentSession?.user) {
            // Validate session health
            await validateSession();

            // Fetch or create user profile
            let profile = await fetchUserProfile(currentSession.user.id);
            if (!profile) {
              profile = await createUserProfile(currentSession.user);
            }
            setUserProfile(profile);
          } else {
            setUserProfile(null);
            setSessionHealth({
              isValid: false,
              needsRefresh: false,
              errors: [],
            });
          }

          setLoadingState('initializing', false);
        });

        return subscription;
      } catch (error) {
        reactotron.error?.(
          '❌ Failed to setup auth listener',
          handleSupabaseError(error),
        );
        return null;
      }
    };

    initializeAuth();
    const listenerPromise = setupAuthListener();

    return () => {
      listenerPromise.then(subscription => {
        if (subscription) {
          subscription.unsubscribe();
        }
      });
    };
  }, [
    validateSession,
    refreshSession,
    fetchUserProfile,
    createUserProfile,
    setLoadingState,
  ]);

  // Periodic session validation
  useEffect(() => {
    if (!isAuthenticated()) return;

    const interval = setInterval(async () => {
      const health = await validateSession();
      if (health.needsRefresh) {
        await refreshSession();
      }
    }, 5 * 60 * 1000); // Check every 5 minutes

    return () => clearInterval(interval);
  }, [isAuthenticated, validateSession, refreshSession]);

  const value: EnhancedAuthContextType = {
    session,
    user,
    userProfile,
    loadingStates,
    sessionHealth,
    signIn,
    signUp,
    signOut,
    updateProfile,
    refreshProfile,
    validateSession,
    refreshSession,
    isAuthenticated,
    isSessionExpired,
    getUserDisplayName,
    getUserStats,
    validateEmail,
    validatePassword,
    validateUsername,
    validateDisplayName,
    validateUserInput,
    formatAuthError,
    clearErrors,
    createDefaultProfile,
    hasPermission,
    requireAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Alias for compatibility
export const EnhancedAuthProvider = AuthProvider;
