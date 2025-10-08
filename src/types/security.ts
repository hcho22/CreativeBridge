// Security-related types and interfaces for CreativeBridge

import { EventType, EventCategory, Severity } from '../services/auditLogger';
import { TwoFAMethod } from '../services/twoFactorAuth';
import { ActionType } from '../services/rateLimiter';

// === Audit and Logging Types ===

export interface AuditLogEntry {
  id: string;
  userId?: string;
  createdAt: Date;
  eventType: EventType;
  eventCategory: EventCategory;
  severity: Severity;
  description: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: Record<string, any>;
  sessionId?: string;
  isSuspicious: boolean;
  riskScore: number;
}

export interface SecurityEvent {
  type: EventType;
  userId?: string;
  timestamp: Date;
  context: Record<string, any>;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  requiresAction: boolean;
}

// === Device Management Types ===

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  deviceType: 'MOBILE' | 'TABLET' | 'DESKTOP' | 'UNKNOWN';
  osName: string;
  osVersion: string;
  appVersion: string;
  screenDimensions: {
    width: number;
    height: number;
  };
  timezone: string;
  locale: string;
}

export interface RegisteredDevice {
  id: string;
  userId: string;
  deviceId: string;
  deviceName: string;
  deviceType: string;
  osName: string;
  osVersion: string;
  appVersion: string;
  isTrusted: boolean;
  isPrimary: boolean;
  trustScore: number;
  firstSeenIp?: string;
  lastSeenIp?: string;
  firstSeenLocation?: any;
  lastSeenLocation?: any;
  loginCount: number;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt: Date;
}

// === Session Management Types ===

export interface SessionInfo {
  sessionId: string;
  userId: string;
  deviceId: string;
  createdAt: Date;
  expiresAt: Date;
  lastActivity: Date;
  isActive: boolean;
  requiresTwoFA: boolean;
  twoFAVerified: boolean;
  ipAddress?: string;
  userAgent?: string;
  isSuspicious: boolean;
}

export interface SessionConfig {
  maxSessionDuration: number; // in minutes
  idleTimeout: number; // in minutes
  warningBeforeExpiry: number; // in minutes
  maxConcurrentSessions: number;
  requireTwoFAForSensitive: boolean;
  autoLogoutOnSuspicious: boolean;
}

export interface SessionWarning {
  type: 'IDLE_WARNING' | 'EXPIRY_WARNING' | 'SECURITY_WARNING';
  message: string;
  timeRemaining: number; // in minutes
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  onExtend?: () => Promise<boolean>;
  onLogout?: () => Promise<void>;
  onSecurityAction?: () => Promise<void>;
}

// === Rate Limiting Types ===

export interface RateLimitRule {
  actionType: ActionType;
  windowMinutes: number;
  maxAttempts: number;
  blockDurationMinutes: number;
  enabled: boolean;
}

export interface RateLimitStatus {
  allowed: boolean;
  remainingAttempts: number;
  windowResetTime: Date;
  isBlocked: boolean;
  blockedUntil?: Date;
  nextAllowedTime?: Date;
}

export interface RateLimitViolation {
  identifier: string;
  actionType: ActionType;
  attemptCount: number;
  violatedAt: Date;
  blockDuration: number;
  clientInfo?: DeviceInfo;
}

// === Two-Factor Authentication Types ===

export interface TwoFAConfig {
  userId: string;
  method: TwoFAMethod;
  isEnabled: boolean;
  secret?: string;
  backupCodes: string[];
  recoveryEmail?: string;
  recoveryPhone?: string;
  lastUsedAt?: Date;
  setupCompletedAt?: Date;
}

export interface TwoFASetupResult {
  success: boolean;
  qrCodeUri?: string;
  secret?: string;
  backupCodes?: string[];
  error?: string;
}

export interface TwoFAVerificationResult {
  success: boolean;
  method: TwoFAMethod;
  backupCodeUsed?: boolean;
  error?: string;
  remainingBackupCodes?: number;
}

export interface TwoFARequirement {
  required: boolean;
  reason: string;
  methods: TwoFAMethod[];
  canUseBackupCode: boolean;
  hasBackupCodes: boolean;
}

// === Anomaly Detection Types ===

export interface AnomalyRule {
  id: string;
  name: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  enabled: boolean;
  threshold: number;
  timeWindow: number; // in minutes
  category: 'AUTHENTICATION' | 'BEHAVIOR' | 'DEVICE' | 'LOCATION' | 'SYSTEM';
}

export interface AnomalyDetectionResult {
  isAnomalous: boolean;
  riskScore: number; // 0-100
  confidence: number; // 0-1
  triggeredRules: string[];
  evidence: Record<string, any>;
  recommendedAction: 'ALLOW' | 'WARN' | 'REQUIRE_2FA' | 'BLOCK' | 'INVESTIGATE';
  shouldLog: boolean;
  shouldNotifyUser: boolean;
  shouldNotifyAdmin: boolean;
}

export interface UserBehaviorPattern {
  userId: string;
  patternType:
    | 'LOGIN_TIME'
    | 'LOGIN_FREQUENCY'
    | 'DEVICE_USAGE'
    | 'LOCATION'
    | 'ACTIVITY';
  pattern: Record<string, any>;
  confidence: number;
  lastUpdated: Date;
  sampleSize: number;
}

// === Security Monitoring Types ===

export interface SecurityAlert {
  id: string;
  type:
    | 'BREACH_ATTEMPT'
    | 'SUSPICIOUS_ACTIVITY'
    | 'POLICY_VIOLATION'
    | 'ANOMALY_DETECTED';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  userId?: string;
  deviceId?: string;
  title: string;
  description: string;
  evidence: Record<string, any>;
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'FALSE_POSITIVE';
  createdAt: Date;
  resolvedAt?: Date;
  assignedTo?: string;
  actions: SecurityAction[];
}

export interface SecurityAction {
  type:
    | 'BLOCK_USER'
    | 'BLOCK_DEVICE'
    | 'REQUIRE_2FA'
    | 'FORCE_PASSWORD_RESET'
    | 'NOTIFY_USER'
    | 'LOG_ONLY';
  executedAt: Date;
  executedBy: string;
  success: boolean;
  details?: string;
}

// === Security Policy Types ===

export interface SecurityPolicy {
  id: string;
  name: string;
  description: string;
  category:
    | 'AUTHENTICATION'
    | 'SESSION'
    | 'DEVICE'
    | 'DATA_ACCESS'
    | 'MONITORING';
  enabled: boolean;
  rules: SecurityPolicyRule[];
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface SecurityPolicyRule {
  id: string;
  condition: string; // JSON logic expression
  action: SecurityAction['type'];
  parameters: Record<string, any>;
  priority: number;
  enabled: boolean;
}

// === Security Context Types ===

export interface SecurityContext {
  userId?: string;
  sessionId?: string;
  deviceId?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  action: string;
  resource?: string;
  metadata?: Record<string, any>;
}

export interface SecurityDecision {
  action: 'ALLOW' | 'DENY' | 'REQUIRE_2FA' | 'CHALLENGE';
  reason: string;
  confidence: number;
  riskScore: number;
  appliedPolicies: string[];
  requiredActions?: SecurityAction['type'][];
  expiresAt?: Date;
}

// === Error and Validation Types ===

export interface SecurityError {
  code: string;
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  context?: SecurityContext;
  timestamp: Date;
  stack?: string;
  userFriendlyMessage: string;
  retryable: boolean;
}

export interface SecurityValidationResult {
  isValid: boolean;
  errors: SecurityError[];
  warnings: string[];
  riskScore: number;
  recommendations: string[];
}

// === API Response Types ===

export interface SecurityApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: SecurityError;
  warnings?: string[];
  metadata?: {
    requestId: string;
    timestamp: Date;
    processingTime: number;
    riskScore?: number;
  };
}

// === Configuration Types ===

export interface SecurityConfiguration {
  audit: {
    enabled: boolean;
    logLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
    retentionDays: number;
    realTimeAlerts: boolean;
  };
  rateLimit: {
    enabled: boolean;
    rules: RateLimitRule[];
    defaultWindow: number;
    defaultMaxAttempts: number;
  };
  sessionManagement: SessionConfig;
  twoFactor: {
    enabled: boolean;
    requiredFor: ('LOGIN' | 'SENSITIVE_OPERATIONS' | 'ADMIN_ACTIONS')[];
    methods: TwoFAMethod[];
    backupCodeCount: number;
    codeValidityMinutes: number;
  };
  anomalyDetection: {
    enabled: boolean;
    rules: AnomalyRule[];
    autoBlock: boolean;
    autoNotify: boolean;
    learningMode: boolean;
  };
  deviceManagement: {
    enabled: boolean;
    maxDevicesPerUser: number;
    trustScoreThreshold: number;
    requireApprovalForNewDevices: boolean;
  };
}

// === Utility Types ===

export type SecurityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'MAXIMUM';

export type SecurityEventHandler = (event: SecurityEvent) => Promise<void>;

export type SecurityMiddleware = (
  context: SecurityContext,
) => Promise<SecurityDecision>;

// === Database Schema Types ===

export interface SecurityDatabase {
  audit_logs: {
    Row: AuditLogEntry;
    Insert: Omit<AuditLogEntry, 'id' | 'createdAt'> & {
      id?: string;
      created_at?: string;
    };
    Update: Partial<Omit<AuditLogEntry, 'id' | 'createdAt'>>;
  };
  user_devices: {
    Row: RegisteredDevice;
    Insert: Omit<RegisteredDevice, 'id' | 'createdAt' | 'updatedAt'> & {
      id?: string;
      created_at?: string;
      updated_at?: string;
    };
    Update: Partial<Omit<RegisteredDevice, 'id' | 'createdAt' | 'userId'>>;
  };
  active_sessions: {
    Row: SessionInfo & {
      id: string;
      session_token: string;
      refresh_token?: string;
      created_at: string;
      updated_at: string;
    };
    Insert: Omit<SessionInfo, 'sessionId'> & {
      session_token: string;
      refresh_token?: string;
    };
    Update: Partial<Omit<SessionInfo, 'sessionId' | 'userId' | 'createdAt'>>;
  };
  user_2fa: {
    Row: TwoFAConfig & {
      id: string;
      created_at: string;
      updated_at: string;
    };
    Insert: Omit<TwoFAConfig, 'userId'> & {
      user_id: string;
    };
    Update: Partial<Omit<TwoFAConfig, 'userId'>>;
  };
  rate_limits: {
    Row: {
      id: string;
      identifier: string;
      action_type: ActionType;
      window_start: string;
      attempt_count: number;
      is_blocked: boolean;
      blocked_until?: string;
      created_at: string;
    };
    Insert: {
      identifier: string;
      action_type: ActionType;
      window_start: string;
      attempt_count?: number;
      is_blocked?: boolean;
      blocked_until?: string;
    };
    Update: Partial<{
      attempt_count: number;
      is_blocked: boolean;
      blocked_until: string;
    }>;
  };
}
