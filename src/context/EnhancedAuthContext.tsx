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
} from '../types/database';
import { auditLogger } from '../services/auditLogger';
import { rateLimiter, ActionType } from '../services/rateLimiter';
import { errorHandler, ErrorCategory } from '../services/errorHandler';
import { sessionManager, SessionWarning } from '../services/sessionManager';
import { anomalyDetector } from '../services/anomalyDetector';
import {
  twoFactorAuth,
  TwoFAMethod,
  TwoFASetup,
  TwoFAVerification,
} from '../services/twoFactorAuth';
import {
  SecurityContext,
  SecurityDecision,
  TwoFARequirement,
  SessionInfo,
} from '../types/security';

interface SignUpData {
  username: string;
  displayName?: string;
  gradeLevel: GradeLevel;
  enable2FA?: boolean;
  recoveryEmail?: string;
}

interface EnhancedAuthContextType {
  // Basic Auth State
  session: Session | null;
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  emailConfirmed: boolean;

  // Security State
  sessionInfo: SessionInfo | null;
  requiresTwoFA: boolean;
  twoFAEnabled: boolean;
  securityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'MAXIMUM';
  suspiciousActivity: boolean;

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

  // Profile Management
  updateProfile: (profile: Partial<UserProfile>) => Promise<{ error?: string }>;
  refreshProfile: () => Promise<void>;

  // Email Verification
  resendConfirmation: (email: string) => Promise<{ error?: string }>;
  checkEmailConfirmation: () => Promise<boolean>;
  resetPassword: (email: string) => Promise<{ error?: string }>;

  // Two-Factor Authentication
  setupTwoFA: (
    method: TwoFAMethod,
    recoveryEmail?: string,
  ) => Promise<{ error?: string; setup?: TwoFASetup }>;
  verifyTwoFA: (
    verification: TwoFAVerification,
  ) => Promise<{ error?: string; success: boolean }>;
  disableTwoFA: () => Promise<{ error?: string }>;
  getTwoFARequirement: () => TwoFARequirement;

  // Session Management
  extendSession: () => Promise<boolean>;
  getSessionTimeRemaining: () => number;
  onSessionWarning?: (warning: SessionWarning) => void;

  // Security Actions
  reportSuspiciousActivity: (
    description: string,
    metadata?: Record<string, any>,
  ) => Promise<void>;
  checkSecurityStatus: () => Promise<SecurityDecision>;
  trustCurrentDevice: () => Promise<boolean>;
  viewAuditLogs: () => Promise<any[]>;
}

const EnhancedAuthContext = createContext<EnhancedAuthContextType | undefined>(
  undefined,
);

export const useEnhancedAuth = () => {
  const context = useContext(EnhancedAuthContext);
  if (!context) {
    throw new Error(
      'useEnhancedAuth must be used within an EnhancedAuthProvider',
    );
  }
  return context;
};

interface EnhancedAuthProviderProps {
  children: React.ReactNode;
  onSessionWarning?: (warning: SessionWarning) => void;
  onSessionExpired?: () => void;
  onSecurityAlert?: (alert: any) => void;
}

export const EnhancedAuthProvider: React.FC<EnhancedAuthProviderProps> = ({
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

  // Security state
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [requiresTwoFA, setRequiresTwoFA] = useState(false);
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [securityLevel, setSecurityLevel] = useState<
    'LOW' | 'MEDIUM' | 'HIGH' | 'MAXIMUM'
  >('LOW');
  const [suspiciousActivity, setSuspiciousActivity] = useState(false);

  // Initialize security services
  useEffect(() => {
    const initializeSecurity = async () => {
      try {
        await auditLogger.initialize();
        await anomalyDetector.initialize();
        await sessionManager.initialize(onSessionWarning, onSessionExpired);
      } catch (error) {
        console.error('Failed to initialize security services:', error);
      }
    };

    initializeSecurity();
  }, [onSessionWarning, onSessionExpired]);

  const createSecurityContext = useCallback(
    (action: string, metadata?: Record<string, any>): SecurityContext => {
      return {
        userId: user?.id,
        sessionId: sessionInfo?.sessionId,
        deviceId: sessionInfo?.deviceId,
        timestamp: new Date(),
        action,
        metadata,
      };
    },
    [user?.id, sessionInfo],
  );

  const performSecurityCheck = useCallback(
    async (
      action: string,
      context?: Record<string, any>,
    ): Promise<SecurityDecision> => {
      if (!user) {
        return {
          action: 'DENY',
          reason: 'User not authenticated',
          confidence: 1,
          riskScore: 0,
          appliedPolicies: ['authentication_required'],
        };
      }

      try {
        // Check for anomalies
        const anomalyContext = {
          userId: user.id,
          deviceId: sessionInfo?.deviceId,
          sessionId: sessionInfo?.sessionId,
          action,
          timestamp: new Date(),
          metadata: context,
        };

        const anomalies = await anomalyDetector.analyzeContext(anomalyContext);
        const highestRisk = anomalyDetector.getHighestRiskScore(anomalies);
        const recommendedAction =
          anomalyDetector.getMostSevereAction(anomalies);

        if (highestRisk > 70 || recommendedAction === 'BLOCK') {
          setSuspiciousActivity(true);
          setSecurityLevel('MAXIMUM');

          return {
            action: 'DENY',
            reason: 'High risk activity detected',
            confidence: 0.9,
            riskScore: highestRisk,
            appliedPolicies: ['anomaly_detection'],
            requiredActions: ['REQUIRE_2FA', 'BLOCK_USER'],
          };
        }

        if (highestRisk > 40 || recommendedAction === 'REQUIRE_2FA') {
          setSecurityLevel('HIGH');

          return {
            action: 'REQUIRE_2FA',
            reason: 'Elevated risk requires additional verification',
            confidence: 0.8,
            riskScore: highestRisk,
            appliedPolicies: ['elevated_risk_2fa'],
          };
        }

        return {
          action: 'ALLOW',
          reason: 'Security check passed',
          confidence: 0.9,
          riskScore: highestRisk,
          appliedPolicies: ['standard_security'],
        };
      } catch (error) {
        await errorHandler.handleSecurityError(
          error instanceof Error ? error : new Error(String(error)),
          'Security check failed',
          50,
          createSecurityContext(action, context),
        );

        return {
          action: 'ALLOW', // Fail open for security check errors
          reason: 'Security check failed, allowing with caution',
          confidence: 0.3,
          riskScore: 30,
          appliedPolicies: ['error_fallback'],
        };
      }
    },
    [user, sessionInfo, createSecurityContext],
  );

  const signIn = async (
    email: string,
    password: string,
    rememberMe = false,
  ): Promise<{ error?: string; requires2FA?: boolean }> => {
    try {
      // Check rate limiting
      const rateLimitResult = await rateLimiter.checkRateLimit(
        email,
        ActionType.LOGIN_ATTEMPT,
      );

      if (!rateLimitResult.allowed) {
        await auditLogger.logAuthFailure(email, 'Rate limit exceeded');
        return {
          error: `Too many login attempts. Please try again in ${Math.ceil(
            (rateLimitResult.blockedUntil?.getTime() || 0 - Date.now()) / 60000,
          )} minutes.`,
        };
      }

      // Attempt authentication
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        await rateLimiter.recordAttempt(email, ActionType.LOGIN_ATTEMPT, false);
        await auditLogger.logAuthFailure(email, error.message);
        return { error: error.message };
      }

      if (!data.user) {
        return { error: 'Authentication failed' };
      }

      // Record successful attempt
      await rateLimiter.recordAttempt(email, ActionType.LOGIN_ATTEMPT, true);

      // Register device
      await auditLogger.registerDevice(data.user.id);

      // Check if 2FA is enabled
      const requires2FA = await twoFactorAuth.isTwoFAEnabled(data.user.id);

      if (requires2FA) {
        setRequiresTwoFA(true);
        return { requires2FA: true };
      }

      // Create session
      const deviceFingerprint = auditLogger.getDeviceFingerprint();
      if (deviceFingerprint) {
        const newSessionInfo = await sessionManager.createSession(
          data.user.id,
          deviceFingerprint.deviceId,
          false,
        );
        setSessionInfo(newSessionInfo);
      }

      // Save remember me preference
      const { RememberMeStorage } = await import('../utils/rememberMeStorage');
      await RememberMeStorage.setRememberMe(rememberMe, email);

      // Log successful authentication
      await auditLogger.logAuthSuccess(data.user.id, { rememberMe });

      return {};
    } catch (error) {
      await errorHandler.handleAuthError(
        error instanceof Error ? error : new Error(String(error)),
        createSecurityContext('LOGIN', { email }),
      );
      return { error: 'An unexpected error occurred during sign in' };
    }
  };

  const verifyTwoFA = async (
    verification: TwoFAVerification,
  ): Promise<{ error?: string; success: boolean }> => {
    if (!user) {
      return { error: 'User not authenticated', success: false };
    }

    try {
      const success = await twoFactorAuth.verifyCode(user.id, verification);

      if (success) {
        setRequiresTwoFA(false);

        // Create session after 2FA verification
        const deviceFingerprint = auditLogger.getDeviceFingerprint();
        if (deviceFingerprint) {
          const newSessionInfo = await sessionManager.createSession(
            user.id,
            deviceFingerprint.deviceId,
            false,
          );
          setSessionInfo(newSessionInfo);

          // Verify 2FA for session
          await sessionManager.verifyTwoFA();
        }

        return { success: true };
      } else {
        await auditLogger.logEvent({
          userId: user.id,
          eventType: 'TWO_FA_FAILED' as any,
          eventCategory: 'SECURITY',
          severity: 'MEDIUM',
          description: '2FA verification failed',
          metadata: { method: verification.method },
        });

        return { error: 'Invalid verification code', success: false };
      }
    } catch (error) {
      await errorHandler.handleAuthError(
        error instanceof Error ? error : new Error(String(error)),
        createSecurityContext('2FA_VERIFY'),
      );
      return { error: 'An error occurred during verification', success: false };
    }
  };

  const setupTwoFA = async (
    method: TwoFAMethod,
    recoveryEmail?: string,
  ): Promise<{ error?: string; setup?: TwoFASetup }> => {
    if (!user) {
      return { error: 'User not authenticated' };
    }

    try {
      const setup = await twoFactorAuth.setupTwoFA(
        user.id,
        method,
        recoveryEmail,
      );
      return { setup };
    } catch (error) {
      await errorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        'ERROR',
        ErrorCategory.SECURITY,
        createSecurityContext('2FA_SETUP'),
      );
      return { error: 'Failed to setup 2FA' };
    }
  };

  const disableTwoFA = async (): Promise<{ error?: string }> => {
    if (!user) {
      return { error: 'User not authenticated' };
    }

    try {
      const success = await twoFactorAuth.disableTwoFA(user.id);
      if (success) {
        setTwoFAEnabled(false);
        return {};
      } else {
        return { error: 'Failed to disable 2FA' };
      }
    } catch (error) {
      return { error: 'An error occurred while disabling 2FA' };
    }
  };

  const updateProfile = async (
    profile: Partial<UserProfile>,
  ): Promise<{ error?: string }> => {
    if (!user) {
      return { error: 'No user logged in' };
    }

    try {
      // Security check for profile updates
      const securityDecision = await performSecurityCheck('PROFILE_UPDATE', {
        updatedFields: Object.keys(profile),
      });

      if (securityDecision.action === 'DENY') {
        return { error: securityDecision.reason };
      }

      if (
        securityDecision.action === 'REQUIRE_2FA' &&
        !sessionInfo?.twoFAVerified
      ) {
        return { error: 'Two-factor authentication required for this action' };
      }

      // Check rate limiting for profile updates
      const rateLimitResult = await rateLimiter.checkRateLimit(
        user.id,
        ActionType.PROFILE_UPDATE,
      );

      if (!rateLimitResult.allowed) {
        return { error: 'Too many profile updates. Please try again later.' };
      }

      const { data: updatedProfile, error } = await supabase
        .from('user_profiles')
        .update(profile as any)
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        await errorHandler.handleError(
          error,
          'ERROR',
          ErrorCategory.DATABASE,
          createSecurityContext('PROFILE_UPDATE'),
        );
        return { error: error.message };
      }

      setUserProfile(updatedProfile);

      // Log profile update
      await auditLogger.logProfileUpdate(user.id, Object.keys(profile), {
        profile,
      });

      return {};
    } catch (error) {
      await errorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        'ERROR',
        ErrorCategory.SYSTEM,
        createSecurityContext('PROFILE_UPDATE'),
      );
      return { error: 'An unexpected error occurred' };
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      // End session
      if (sessionInfo) {
        await sessionManager.endSession();
      }

      // Check if remember me is enabled before signing out
      const { RememberMeStorage } = await import('../utils/rememberMeStorage');
      const rememberMeData = await RememberMeStorage.getRememberMe();

      await supabase.auth.signOut();

      // Only clear remember me data if it was disabled
      if (!rememberMeData?.isEnabled) {
        await RememberMeStorage.clearRememberMe();
      }

      // Reset state
      setSession(null);
      setUser(null);
      setUserProfile(null);
      setSessionInfo(null);
      setRequiresTwoFA(false);
      setTwoFAEnabled(false);
      setSecurityLevel('LOW');
      setSuspiciousActivity(false);
      setEmailConfirmed(false);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const getTwoFARequirement = (): TwoFARequirement => {
    return {
      required: requiresTwoFA,
      reason: requiresTwoFA
        ? 'Your account has two-factor authentication enabled'
        : '',
      methods: [TwoFAMethod.TOTP, TwoFAMethod.EMAIL],
      canUseBackupCode: twoFAEnabled,
      hasBackupCodes: twoFAEnabled,
    };
  };

  const extendSession = async (): Promise<boolean> => {
    return await sessionManager.extendSession();
  };

  const getSessionTimeRemaining = (): number => {
    return sessionManager.getTimeUntilExpiry();
  };

  const reportSuspiciousActivity = async (
    description: string,
    metadata?: Record<string, any>,
  ): Promise<void> => {
    await auditLogger.logSuspiciousActivity(
      user?.id,
      description,
      60,
      metadata,
    );
    setSuspiciousActivity(true);
  };

  const checkSecurityStatus = async (): Promise<SecurityDecision> => {
    return await performSecurityCheck('SECURITY_CHECK');
  };

  const trustCurrentDevice = async (): Promise<boolean> => {
    if (!user || !sessionInfo) return false;

    try {
      const { error } = await supabase
        .from('user_devices')
        .update({ is_trusted: true, trust_score: 100 })
        .eq('user_id', user.id)
        .eq('device_id', sessionInfo.deviceId);

      if (!error) {
        await auditLogger.logEvent({
          userId: user.id,
          eventType: 'DEVICE_REGISTERED' as any,
          eventCategory: 'SECURITY',
          severity: 'LOW',
          description: 'Device marked as trusted',
          metadata: { deviceId: sessionInfo.deviceId },
        });
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  };

  const viewAuditLogs = async (): Promise<any[]> => {
    if (!user) return [];

    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      return data || [];
    } catch (error) {
      return [];
    }
  };

  // Continue with existing profile management and authentication logic
  const fetchUserProfile = async (
    userId: string,
  ): Promise<UserProfile | null> => {
    // ... existing implementation from original AuthContext
    return null; // Placeholder
  };

  const signUp = async (
    email: string,
    password: string,
    profileData?: SignUpData,
  ): Promise<{ error?: string }> => {
    // ... existing implementation with security enhancements
    return {}; // Placeholder
  };

  const refreshProfile = async (): Promise<void> => {
    // ... existing implementation
  };

  const resendConfirmation = async (
    email: string,
  ): Promise<{ error?: string }> => {
    // ... existing implementation with rate limiting
    return {}; // Placeholder
  };

  const checkEmailConfirmation = async (): Promise<boolean> => {
    // ... existing implementation
    return false; // Placeholder
  };

  const resetPassword = async (email: string): Promise<{ error?: string }> => {
    // ... existing implementation with rate limiting
    return {}; // Placeholder
  };

  // Initialize auth state on mount
  useEffect(() => {
    // ... existing implementation with security checks
  }, []);

  const value: EnhancedAuthContextType = {
    // Basic auth state
    session,
    user,
    userProfile,
    loading,
    emailConfirmed,

    // Security state
    sessionInfo,
    requiresTwoFA,
    twoFAEnabled,
    securityLevel,
    suspiciousActivity,

    // Auth methods
    signIn,
    signUp,
    signOut,

    // Profile management
    updateProfile,
    refreshProfile,

    // Email verification
    resendConfirmation,
    checkEmailConfirmation,
    resetPassword,

    // Two-factor authentication
    setupTwoFA,
    verifyTwoFA,
    disableTwoFA,
    getTwoFARequirement,

    // Session management
    extendSession,
    getSessionTimeRemaining,
    onSessionWarning,

    // Security actions
    reportSuspiciousActivity,
    checkSecurityStatus,
    trustCurrentDevice,
    viewAuditLogs,
  };

  return (
    <EnhancedAuthContext.Provider value={value}>
      {children}
    </EnhancedAuthContext.Provider>
  );
};
