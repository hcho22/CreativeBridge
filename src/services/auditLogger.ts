import { supabase } from './supabase';
import { Platform } from 'react-native';
import DeviceInfo from './deviceInfo';

export enum EventType {
  // Authentication Events
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  LOGIN_FAILED = 'LOGIN_FAILED',
  SIGNUP = 'SIGNUP',
  SIGNUP_FAILED = 'SIGNUP_FAILED',
  PASSWORD_RESET = 'PASSWORD_RESET',
  EMAIL_CONFIRMATION = 'EMAIL_CONFIRMATION',

  // Profile Events
  PROFILE_UPDATE = 'PROFILE_UPDATE',
  PROFILE_VIEW = 'PROFILE_VIEW',

  // Security Events
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  DEVICE_REGISTERED = 'DEVICE_REGISTERED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  TWO_FA_ENABLED = 'TWO_FA_ENABLED',
  TWO_FA_DISABLED = 'TWO_FA_DISABLED',
  TWO_FA_FAILED = 'TWO_FA_FAILED',

  // Data Events
  GAME_SESSION_START = 'GAME_SESSION_START',
  GAME_SESSION_END = 'GAME_SESSION_END',

  // Error Events
  APP_ERROR = 'APP_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}

export enum EventCategory {
  AUTH = 'AUTH',
  DATA = 'DATA',
  SECURITY = 'SECURITY',
  ERROR = 'ERROR',
}

export enum Severity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface AuditLogEntry {
  userId?: string;
  eventType: EventType;
  eventCategory: EventCategory;
  severity: Severity;
  description: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: Record<string, any>;
  sessionId?: string;
  isSuspicious?: boolean;
  riskScore?: number;
}

export interface DeviceFingerprint {
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

class AuditLogger {
  private deviceFingerprint: DeviceFingerprint | null = null;
  private sessionId: string | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Generate session ID
      this.sessionId = this.generateSessionId();

      // Collect device information
      const [
        deviceId,
        deviceName,
        systemName,
        systemVersion,
        appVersion,
        dimensions,
      ] = await Promise.all([
        DeviceInfo.getUniqueId(),
        DeviceInfo.getDeviceName(),
        DeviceInfo.getSystemName(),
        DeviceInfo.getSystemVersion(),
        DeviceInfo.getVersion(),
        DeviceInfo.getDeviceDimensions(),
      ]);

      this.deviceFingerprint = {
        deviceId,
        deviceName,
        deviceType: this.getDeviceType(),
        osName: systemName,
        osVersion: systemVersion,
        appVersion,
        screenDimensions: {
          width: dimensions.width,
          height: dimensions.height,
        },
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        locale: Intl.DateTimeFormat().resolvedOptions().locale,
      };

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize audit logger:', error);
      // Fallback device info
      this.deviceFingerprint = {
        deviceId: 'unknown',
        deviceName: 'Unknown Device',
        deviceType: this.getDeviceType(),
        osName: Platform.OS,
        osVersion: Platform.Version.toString(),
        appVersion: 'unknown',
        screenDimensions: { width: 0, height: 0 },
        timezone: 'UTC',
        locale: 'en-US',
      };
      this.isInitialized = true;
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getDeviceType(): 'MOBILE' | 'TABLET' | 'DESKTOP' | 'UNKNOWN' {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      // Simple heuristic - could be enhanced with actual tablet detection
      return 'MOBILE';
    }
    return 'UNKNOWN';
  }

  async logEvent(entry: AuditLogEntry): Promise<void> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Sanitize data for production
      const sanitizedEntry = this.sanitizeForProduction(entry);

      // Prepare the log entry
      const logData = {
        user_id: sanitizedEntry.userId || null,
        event_type: sanitizedEntry.eventType,
        event_category: sanitizedEntry.eventCategory,
        severity: sanitizedEntry.severity,
        description: sanitizedEntry.description,
        metadata: sanitizedEntry.metadata
          ? JSON.stringify(sanitizedEntry.metadata)
          : null,
        ip_address: sanitizedEntry.ipAddress || null,
        user_agent: sanitizedEntry.userAgent || this.getUserAgent(),
        device_info: this.deviceFingerprint
          ? JSON.stringify(this.deviceFingerprint)
          : null,
        session_id: this.sessionId,
        is_suspicious: sanitizedEntry.isSuspicious || false,
        risk_score: sanitizedEntry.riskScore || 0,
      };

      // Log to Supabase
      const { error } = await supabase.from('audit_logs').insert(logData);

      if (error) {
        // Fallback to console in development, silent fail in production
        if (__DEV__) {
          console.error('Failed to log audit event:', error);
        }
        // In production, you might want to queue failed logs for retry
      }
    } catch (error) {
      // Silent fail in production to prevent app crashes
      if (__DEV__) {
        console.error('Audit logging error:', error);
      }
    }
  }

  private sanitizeForProduction(entry: AuditLogEntry): AuditLogEntry {
    const sanitized = { ...entry };

    if (!__DEV__) {
      // Remove sensitive information in production
      if (sanitized.metadata) {
        const cleanMetadata = { ...sanitized.metadata };

        // Remove potentially sensitive fields
        delete cleanMetadata.password;
        delete cleanMetadata.token;
        delete cleanMetadata.secret;
        delete cleanMetadata.key;
        delete cleanMetadata.credential;

        // Truncate long values
        Object.keys(cleanMetadata).forEach(key => {
          if (
            typeof cleanMetadata[key] === 'string' &&
            cleanMetadata[key].length > 500
          ) {
            cleanMetadata[key] = cleanMetadata[key].substring(0, 500) + '...';
          }
        });

        sanitized.metadata = cleanMetadata;
      }

      // Sanitize description
      if (sanitized.description.length > 1000) {
        sanitized.description =
          sanitized.description.substring(0, 1000) + '...';
      }
    }

    return sanitized;
  }

  private getUserAgent(): string {
    return `CreativeBridge/${
      this.deviceFingerprint?.appVersion || 'unknown'
    } (${this.deviceFingerprint?.osName || Platform.OS} ${
      this.deviceFingerprint?.osVersion || Platform.Version
    })`;
  }

  // Convenience methods for common events
  async logAuthSuccess(
    userId: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.logEvent({
      userId,
      eventType: EventType.LOGIN,
      eventCategory: EventCategory.AUTH,
      severity: Severity.LOW,
      description: 'User successfully authenticated',
      metadata,
    });
  }

  async logAuthFailure(
    email?: string,
    reason?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.logEvent({
      eventType: EventType.LOGIN_FAILED,
      eventCategory: EventCategory.AUTH,
      severity: Severity.MEDIUM,
      description: `Authentication failed${reason ? `: ${reason}` : ''}`,
      metadata: {
        email: email || 'unknown',
        reason,
        ...metadata,
      },
      isSuspicious: true,
      riskScore: 30,
    });
  }

  async logProfileUpdate(
    userId: string,
    updatedFields: string[],
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.logEvent({
      userId,
      eventType: EventType.PROFILE_UPDATE,
      eventCategory: EventCategory.DATA,
      severity: Severity.LOW,
      description: `Profile updated: ${updatedFields.join(', ')}`,
      metadata: {
        updatedFields,
        ...metadata,
      },
    });
  }

  async logSuspiciousActivity(
    userId?: string,
    description?: string,
    riskScore?: number,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.logEvent({
      userId,
      eventType: EventType.SUSPICIOUS_ACTIVITY,
      eventCategory: EventCategory.SECURITY,
      severity: riskScore && riskScore > 70 ? Severity.HIGH : Severity.MEDIUM,
      description: description || 'Suspicious activity detected',
      metadata,
      isSuspicious: true,
      riskScore: riskScore || 50,
    });
  }

  async logError(
    error: Error,
    userId?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.logEvent({
      userId,
      eventType: EventType.APP_ERROR,
      eventCategory: EventCategory.ERROR,
      severity: Severity.MEDIUM,
      description: `Application error: ${error.message}`,
      metadata: {
        errorName: error.name,
        errorStack: __DEV__ ? error.stack : undefined,
        ...metadata,
      },
    });
  }

  async logRateLimitExceeded(
    identifier: string,
    actionType: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.logEvent({
      eventType: EventType.RATE_LIMIT_EXCEEDED,
      eventCategory: EventCategory.SECURITY,
      severity: Severity.HIGH,
      description: `Rate limit exceeded for ${actionType}`,
      metadata: {
        identifier,
        actionType,
        ...metadata,
      },
      isSuspicious: true,
      riskScore: 60,
    });
  }

  // Device registration
  async registerDevice(userId: string): Promise<void> {
    if (!this.deviceFingerprint) {
      await this.initialize();
    }

    try {
      const { error } = await supabase.rpc('register_device', {
        p_user_id: userId,
        p_device_id: this.deviceFingerprint!.deviceId,
        p_device_name: this.deviceFingerprint!.deviceName,
        p_device_type: this.deviceFingerprint!.deviceType,
        p_os_name: this.deviceFingerprint!.osName,
        p_os_version: this.deviceFingerprint!.osVersion,
        p_app_version: this.deviceFingerprint!.appVersion,
        p_ip_address: null, // Would need to get from a service
        p_location_info: null,
      });

      if (!error) {
        await this.logEvent({
          userId,
          eventType: EventType.DEVICE_REGISTERED,
          eventCategory: EventCategory.SECURITY,
          severity: Severity.LOW,
          description: 'Device registered successfully',
          metadata: {
            deviceId: this.deviceFingerprint!.deviceId,
            deviceName: this.deviceFingerprint!.deviceName,
          },
        });
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Device registration failed:', error);
      }
    }
  }

  // Session management
  getSessionId(): string | null {
    return this.sessionId;
  }

  getDeviceFingerprint(): DeviceFingerprint | null {
    return this.deviceFingerprint;
  }
}

// Export singleton instance
export const auditLogger = new AuditLogger();
