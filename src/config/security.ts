import { SecurityConfiguration } from '../types/security';
import { ActionType } from '../services/rateLimiter';
import { TwoFAMethod } from '../services/twoFactorAuth';

/**
 * Security Configuration for CreativeBridge
 *
 * This configuration defines the security policies and settings for the application.
 * Modify these settings based on your security requirements.
 */

export const SECURITY_CONFIG: SecurityConfiguration = {
  // Audit Logging Configuration
  audit: {
    enabled: true,
    logLevel: __DEV__ ? 'DEBUG' : 'INFO',
    retentionDays: 90, // Keep audit logs for 90 days
    realTimeAlerts: true, // Enable real-time security alerts
  },

  // Rate Limiting Configuration
  rateLimit: {
    enabled: true,
    defaultWindow: 15, // 15 minutes
    defaultMaxAttempts: 5, // 5 attempts per window
    rules: [
      {
        actionType: ActionType.LOGIN_ATTEMPT,
        windowMinutes: 15,
        maxAttempts: 5,
        blockDurationMinutes: 60,
        enabled: true,
      },
      {
        actionType: ActionType.PASSWORD_RESET,
        windowMinutes: 60,
        maxAttempts: 3,
        blockDurationMinutes: 120,
        enabled: true,
      },
      {
        actionType: ActionType.EMAIL_VERIFICATION,
        windowMinutes: 60,
        maxAttempts: 5,
        blockDurationMinutes: 60,
        enabled: true,
      },
      {
        actionType: ActionType.PROFILE_UPDATE,
        windowMinutes: 60,
        maxAttempts: 10,
        blockDurationMinutes: 30,
        enabled: true,
      },
      {
        actionType: ActionType.DEVICE_REGISTRATION,
        windowMinutes: 60,
        maxAttempts: 3,
        blockDurationMinutes: 120,
        enabled: true,
      },
    ],
  },

  // Session Management Configuration
  sessionManagement: {
    maxSessionDuration: 24 * 60, // 24 hours
    idleTimeout: 30, // 30 minutes
    warningBeforeExpiry: 5, // 5 minutes warning
    maxConcurrentSessions: 3, // Maximum 3 active sessions per user
    requireTwoFAForSensitive: true, // Require 2FA for sensitive operations
    autoLogoutOnSuspicious: true, // Auto logout on suspicious activity
  },

  // Two-Factor Authentication Configuration
  twoFactor: {
    enabled: true,
    requiredFor: ['SENSITIVE_OPERATIONS'], // 2FA required for sensitive operations
    methods: [TwoFAMethod.TOTP, TwoFAMethod.EMAIL], // Available 2FA methods
    backupCodeCount: 10, // Number of backup codes to generate
    codeValidityMinutes: 5, // How long 2FA codes are valid
  },

  // Anomaly Detection Configuration
  anomalyDetection: {
    enabled: true,
    autoBlock: false, // Don't auto-block, require manual review
    autoNotify: true, // Notify admins of anomalies
    learningMode: false, // Set to true during initial deployment
    rules: [
      {
        id: 'multiple_failed_logins',
        name: 'Multiple Failed Login Attempts',
        description: 'Detects multiple failed login attempts in short time',
        severity: 'HIGH',
        enabled: true,
        threshold: 5,
        timeWindow: 15,
        category: 'AUTHENTICATION',
      },
      {
        id: 'unusual_login_time',
        name: 'Unusual Login Time',
        description: 'Detects logins at unusual times for the user',
        severity: 'MEDIUM',
        enabled: true,
        threshold: 0.8,
        timeWindow: 60 * 24 * 7, // 7 days
        category: 'BEHAVIOR',
      },
      {
        id: 'new_device_login',
        name: 'New Device Login',
        description: 'Detects login from previously unseen device',
        severity: 'MEDIUM',
        enabled: true,
        threshold: 1,
        timeWindow: 60 * 24 * 30, // 30 days
        category: 'DEVICE',
      },
      {
        id: 'rapid_profile_changes',
        name: 'Rapid Profile Changes',
        description: 'Detects multiple profile changes in short time',
        severity: 'MEDIUM',
        enabled: true,
        threshold: 3,
        timeWindow: 10,
        category: 'BEHAVIOR',
      },
      {
        id: 'privilege_escalation_attempt',
        name: 'Privilege Escalation Attempt',
        description: 'Detects attempts to access unauthorized resources',
        severity: 'CRITICAL',
        enabled: true,
        threshold: 1,
        timeWindow: 5,
        category: 'SYSTEM',
      },
    ],
  },

  // Device Management Configuration
  deviceManagement: {
    enabled: true,
    maxDevicesPerUser: 5, // Maximum devices per user
    trustScoreThreshold: 70, // Minimum trust score for automatic approval
    requireApprovalForNewDevices: false, // Set to true for high-security environments
  },
};

/**
 * Security Level Definitions
 *
 * These levels determine the security measures applied based on risk assessment.
 */
export const SECURITY_LEVELS = {
  LOW: {
    name: 'Low Security',
    description: 'Standard security measures',
    requires2FA: false,
    sessionTimeout: 24 * 60, // 24 hours
    anomalyThreshold: 30,
    autoBlock: false,
  },
  MEDIUM: {
    name: 'Medium Security',
    description: 'Enhanced security measures',
    requires2FA: false,
    sessionTimeout: 8 * 60, // 8 hours
    anomalyThreshold: 20,
    autoBlock: false,
  },
  HIGH: {
    name: 'High Security',
    description: 'Strict security measures',
    requires2FA: true,
    sessionTimeout: 2 * 60, // 2 hours
    anomalyThreshold: 10,
    autoBlock: false,
  },
  MAXIMUM: {
    name: 'Maximum Security',
    description: 'Lockdown mode - maximum security',
    requires2FA: true,
    sessionTimeout: 30, // 30 minutes
    anomalyThreshold: 5,
    autoBlock: true,
  },
};

/**
 * Security Policy Templates
 *
 * Pre-defined security policies for different use cases.
 */
export const SECURITY_POLICIES = {
  EDUCATION: {
    name: 'Education Environment',
    description: 'Balanced security for educational applications',
    config: {
      ...SECURITY_CONFIG,
      twoFactor: {
        ...SECURITY_CONFIG.twoFactor,
        requiredFor: [],
      },
      sessionManagement: {
        ...SECURITY_CONFIG.sessionManagement,
        maxSessionDuration: 8 * 60, // 8 hours for school day
        idleTimeout: 60, // 1 hour idle timeout
      },
    },
  },
  ENTERPRISE: {
    name: 'Enterprise Environment',
    description: 'High security for enterprise deployments',
    config: {
      ...SECURITY_CONFIG,
      twoFactor: {
        ...SECURITY_CONFIG.twoFactor,
        requiredFor: ['LOGIN', 'SENSITIVE_OPERATIONS', 'ADMIN_ACTIONS'],
      },
      sessionManagement: {
        ...SECURITY_CONFIG.sessionManagement,
        maxSessionDuration: 4 * 60, // 4 hours
        idleTimeout: 15, // 15 minutes idle timeout
        requireTwoFAForSensitive: true,
      },
      anomalyDetection: {
        ...SECURITY_CONFIG.anomalyDetection,
        autoBlock: true,
        autoNotify: true,
      },
    },
  },
  DEVELOPMENT: {
    name: 'Development Environment',
    description: 'Relaxed security for development',
    config: {
      ...SECURITY_CONFIG,
      audit: {
        ...SECURITY_CONFIG.audit,
        logLevel: 'DEBUG' as const,
        realTimeAlerts: false,
      },
      rateLimit: {
        ...SECURITY_CONFIG.rateLimit,
        enabled: false, // Disable rate limiting in development
      },
      twoFactor: {
        ...SECURITY_CONFIG.twoFactor,
        enabled: false, // Disable 2FA in development
      },
      anomalyDetection: {
        ...SECURITY_CONFIG.anomalyDetection,
        enabled: false, // Disable anomaly detection in development
      },
    },
  },
};

/**
 * Get security configuration based on environment
 */
export function getSecurityConfig(): SecurityConfiguration {
  if (__DEV__) {
    return SECURITY_POLICIES.DEVELOPMENT.config;
  }

  // You can add environment-specific logic here
  // For example, check environment variables or build configuration
  return SECURITY_CONFIG;
}

/**
 * Security Constants
 */
export const SECURITY_CONSTANTS = {
  // Password Requirements
  PASSWORD: {
    MIN_LENGTH: 8,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBERS: true,
    REQUIRE_SYMBOLS: false,
    MAX_CONSECUTIVE_IDENTICAL: 2,
  },

  // Account Lockout
  LOCKOUT: {
    MAX_FAILED_ATTEMPTS: 5,
    LOCKOUT_DURATION_MINUTES: 30,
    PROGRESSIVE_DELAY: true,
  },

  // Session Security
  SESSION: {
    REGENERATE_ON_LOGIN: true,
    SECURE_COOKIES: true,
    SAME_SITE: 'strict' as const,
    HTTP_ONLY: true,
  },

  // Encryption
  ENCRYPTION: {
    ALGORITHM: 'AES-256-GCM',
    KEY_ROTATION_DAYS: 90,
    SALT_ROUNDS: 12,
  },

  // API Security
  API: {
    RATE_LIMIT_REQUESTS_PER_MINUTE: 60,
    REQUEST_TIMEOUT_SECONDS: 30,
    MAX_REQUEST_SIZE_MB: 10,
  },
};

/**
 * Security Event Types for Monitoring
 */
export const SECURITY_EVENTS = {
  AUTHENTICATION: [
    'LOGIN_SUCCESS',
    'LOGIN_FAILED',
    'LOGOUT',
    'PASSWORD_CHANGED',
    'ACCOUNT_LOCKED',
    'ACCOUNT_UNLOCKED',
  ],
  AUTHORIZATION: [
    'ACCESS_GRANTED',
    'ACCESS_DENIED',
    'PRIVILEGE_ESCALATION',
    'UNAUTHORIZED_ACCESS_ATTEMPT',
  ],
  DATA_ACCESS: [
    'DATA_VIEWED',
    'DATA_MODIFIED',
    'DATA_DELETED',
    'DATA_EXPORTED',
    'SENSITIVE_DATA_ACCESS',
  ],
  SECURITY: [
    'ANOMALY_DETECTED',
    'SECURITY_POLICY_VIOLATION',
    'SUSPICIOUS_ACTIVITY',
    'SECURITY_ALERT_TRIGGERED',
    'SECURITY_SCAN_COMPLETED',
  ],
};

/**
 * Validate security configuration
 */
export function validateSecurityConfig(
  config: SecurityConfiguration,
): string[] {
  const errors: string[] = [];

  if (
    config.sessionManagement.maxSessionDuration <
    config.sessionManagement.idleTimeout
  ) {
    errors.push('Session duration cannot be less than idle timeout');
  }

  if (
    config.sessionManagement.warningBeforeExpiry >=
    config.sessionManagement.idleTimeout
  ) {
    errors.push('Warning time cannot be greater than or equal to idle timeout');
  }

  if (config.twoFactor.codeValidityMinutes > 30) {
    errors.push('2FA code validity should not exceed 30 minutes for security');
  }

  if (config.audit.retentionDays < 30) {
    errors.push(
      'Audit log retention should be at least 30 days for compliance',
    );
  }

  return errors;
}
