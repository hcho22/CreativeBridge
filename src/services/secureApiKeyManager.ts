/**
 * Secure API Key Management Service
 *
 * This service provides secure storage and access to API keys for the
 * Story Image Generation feature, ensuring keys are never exposed in logs
 * and implementing additional security measures.
 */

import { env } from './environment';
import { auditLogger, EventType, EventCategory, Severity } from './auditLogger';
import { SecurityContext, SecurityError } from '../types/security';

// Security constants for API key management
const API_KEY_SECURITY = {
  MASK_LENGTH: 8, // Number of characters to show when logging (e.g., "sk-proj-abc...xyz")
  LOG_THRESHOLD: 4, // Minimum characters to show in logs
  MAX_ACCESS_FREQUENCY: 100, // Max API key accesses per minute per service
  KEY_ROTATION_WARNING_DAYS: 30, // Warn about key rotation after 30 days
} as const;

// API service identifiers
export enum ApiService {
  REPLICATE_PRIMARY = 'replicate_primary',
  REPLICATE_BACKUP = 'replicate_backup',
  OPENAI = 'openai',
}

// API key access tracking
interface ApiKeyAccessLog {
  service: ApiService;
  lastAccess: Date;
  accessCount: number;
  dailyAccessCount: number;
  lastAccessReset: Date;
}

// In-memory access tracking (reset on app restart)
const keyAccessLog = new Map<ApiService, ApiKeyAccessLog>();

/**
 * Utility class for secure API key operations
 */
class SecureApiKeyManager {
  private readonly securityContext: SecurityContext;

  constructor() {
    this.securityContext = {
      timestamp: new Date(),
      action: 'API_KEY_ACCESS',
      resource: 'secure_api_keys',
    };
  }

  /**
   * Safely mask an API key for logging purposes
   */
  private maskApiKey(key: string | undefined): string {
    if (!key || key.length === 0) {
      return '[MISSING_KEY]';
    }

    if (key.length <= API_KEY_SECURITY.LOG_THRESHOLD) {
      return '[MASKED]';
    }

    const prefixLength = Math.min(API_KEY_SECURITY.MASK_LENGTH, key.length - 4);
    const suffixLength = Math.min(3, key.length - prefixLength);

    return `${key.substring(0, prefixLength)}...${key.substring(
      key.length - suffixLength,
    )}`;
  }

  /**
   * Validate API key format and security
   */
  private validateApiKey(
    service: ApiService,
    key: string | undefined,
  ): SecurityError | null {
    if (!key || key.trim().length === 0) {
      return {
        code: 'MISSING_API_KEY',
        message: `API key for ${service} is missing or empty`,
        severity: 'HIGH',
        context: this.securityContext,
        timestamp: new Date(),
        userFriendlyMessage:
          'Service configuration error - please contact support',
        retryable: false,
      };
    }

    // Basic format validation based on service
    switch (service) {
      case ApiService.REPLICATE_PRIMARY:
      case ApiService.REPLICATE_BACKUP:
        if (!key.startsWith('r8_')) {
          return {
            code: 'INVALID_REPLICATE_KEY_FORMAT',
            message: `Invalid Replicate API key format for ${service}`,
            severity: 'HIGH',
            context: this.securityContext,
            timestamp: new Date(),
            userFriendlyMessage: 'Invalid service configuration',
            retryable: false,
          };
        }
        break;

      case ApiService.OPENAI:
        if (!key.startsWith('sk-')) {
          return {
            code: 'INVALID_OPENAI_KEY_FORMAT',
            message: `Invalid OpenAI API key format for ${service}`,
            severity: 'HIGH',
            context: this.securityContext,
            timestamp: new Date(),
            userFriendlyMessage: 'Invalid service configuration',
            retryable: false,
          };
        }
        break;
    }

    return null; // Valid
  }

  /**
   * Track API key access for security monitoring
   */
  private trackApiKeyAccess(service: ApiService): void {
    const now = new Date();
    const currentLog = keyAccessLog.get(service);

    if (!currentLog) {
      keyAccessLog.set(service, {
        service,
        lastAccess: now,
        accessCount: 1,
        dailyAccessCount: 1,
        lastAccessReset: now,
      });
    } else {
      // Reset daily count if it's a new day
      const hoursSinceReset =
        (now.getTime() - currentLog.lastAccessReset.getTime()) /
        (1000 * 60 * 60);
      if (hoursSinceReset >= 24) {
        currentLog.dailyAccessCount = 1;
        currentLog.lastAccessReset = now;
      } else {
        currentLog.dailyAccessCount++;
      }

      currentLog.accessCount++;
      currentLog.lastAccess = now;
    }

    // Log suspicious access patterns
    const log = keyAccessLog.get(service)!;
    if (log.dailyAccessCount > API_KEY_SECURITY.MAX_ACCESS_FREQUENCY) {
      auditLogger.logSecurityEvent({
        eventType: EventType.SECURITY_POLICY_VIOLATION,
        eventCategory: EventCategory.API_ACCESS,
        severity: Severity.MEDIUM,
        description: `Excessive API key access detected for ${service}`,
        metadata: {
          service,
          dailyAccessCount: log.dailyAccessCount,
          totalAccessCount: log.accessCount,
        },
        context: this.securityContext,
      });
    }
  }

  /**
   * Securely retrieve an API key with validation and logging
   */
  getApiKey(service: ApiService): { key: string; error?: SecurityError } {
    let rawKey: string | undefined;

    // Get the raw key from environment
    switch (service) {
      case ApiService.REPLICATE_PRIMARY:
        rawKey = env.REPLICATE_API_TOKEN;
        break;
      case ApiService.REPLICATE_BACKUP:
        rawKey = env.BACKUP_IMAGE_API_TOKEN;
        break;
      case ApiService.OPENAI:
        rawKey = env.OPENAI_API_KEY;
        break;
      default:
        return {
          key: '',
          error: {
            code: 'UNKNOWN_API_SERVICE',
            message: `Unknown API service: ${service}`,
            severity: 'HIGH',
            context: this.securityContext,
            timestamp: new Date(),
            userFriendlyMessage: 'Service configuration error',
            retryable: false,
          },
        };
    }

    // Validate the key
    const validationError = this.validateApiKey(service, rawKey);
    if (validationError) {
      // Log validation failure without exposing the key
      auditLogger.logSecurityEvent({
        eventType: EventType.SECURITY_POLICY_VIOLATION,
        eventCategory: EventCategory.API_ACCESS,
        severity: validationError.severity as Severity,
        description: `API key validation failed for service: ${service}`,
        metadata: {
          service,
          errorCode: validationError.code,
          keyMask: this.maskApiKey(rawKey),
        },
        context: this.securityContext,
      });

      return { key: '', error: validationError };
    }

    // Track access for monitoring
    this.trackApiKeyAccess(service);

    // Log successful access (without the actual key)
    if (__DEV__) {
      console.log(
        `🔑 API key accessed for ${service}: ${this.maskApiKey(rawKey)}`,
      );
    }

    // Audit log for production
    auditLogger.logEvent({
      eventType: EventType.API_KEY_ACCESSED,
      eventCategory: EventCategory.API_ACCESS,
      severity: Severity.INFO,
      description: `API key accessed for ${service}`,
      metadata: {
        service,
        keyMask: this.maskApiKey(rawKey),
        accessMethod: 'secure_manager',
      },
      context: this.securityContext,
    });

    return { key: rawKey!, error: undefined };
  }

  /**
   * Get API key configuration status for monitoring
   */
  getApiKeyStatus(): Record<
    ApiService,
    { configured: boolean; masked: string; valid: boolean }
  > {
    const status: Record<
      string,
      { configured: boolean; masked: string; valid: boolean }
    > = {};

    for (const service of Object.values(ApiService)) {
      let rawKey: string | undefined;

      switch (service) {
        case ApiService.REPLICATE_PRIMARY:
          rawKey = env.REPLICATE_API_TOKEN;
          break;
        case ApiService.REPLICATE_BACKUP:
          rawKey = env.BACKUP_IMAGE_API_TOKEN;
          break;
        case ApiService.OPENAI:
          rawKey = env.OPENAI_API_KEY;
          break;
      }

      const configured = Boolean(rawKey && rawKey.trim().length > 0);
      const validationError = this.validateApiKey(service, rawKey);

      status[service] = {
        configured,
        masked: this.maskApiKey(rawKey),
        valid: configured && !validationError,
      };
    }

    return status as Record<
      ApiService,
      { configured: boolean; masked: string; valid: boolean }
    >;
  }

  /**
   * Validate all API keys and return comprehensive status
   */
  validateAllKeys(): {
    isValid: boolean;
    errors: SecurityError[];
    warnings: string[];
  } {
    const errors: SecurityError[] = [];
    const warnings: string[] = [];

    // Check required keys
    const requiredServices = [ApiService.REPLICATE_PRIMARY, ApiService.OPENAI];

    for (const service of requiredServices) {
      const { error } = this.getApiKey(service);
      if (error) {
        errors.push(error);
      }
    }

    // Check optional keys and add warnings
    const optionalServices = [ApiService.REPLICATE_BACKUP];

    for (const service of optionalServices) {
      const { error } = this.getApiKey(service);
      if (error) {
        warnings.push(
          `Backup image generation service not configured: ${service}`,
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get access statistics for monitoring
   */
  getAccessStatistics(): Record<ApiService, ApiKeyAccessLog | null> {
    const stats: Record<string, ApiKeyAccessLog | null> = {};

    for (const service of Object.values(ApiService)) {
      stats[service] = keyAccessLog.get(service) || null;
    }

    return stats as Record<ApiService, ApiKeyAccessLog | null>;
  }

  /**
   * Clear access statistics (for testing or reset)
   */
  clearAccessStatistics(): void {
    keyAccessLog.clear();

    auditLogger.logEvent({
      eventType: EventType.SYSTEM_MAINTENANCE,
      eventCategory: EventCategory.SYSTEM,
      severity: Severity.INFO,
      description: 'API key access statistics cleared',
      metadata: { action: 'clear_stats' },
      context: this.securityContext,
    });
  }
}

// Export singleton instance
export const secureApiKeyManager = new SecureApiKeyManager();

// Export utility functions for convenience
export const getApiKey = (service: ApiService) =>
  secureApiKeyManager.getApiKey(service);
export const getApiKeyStatus = () => secureApiKeyManager.getApiKeyStatus();
export const validateAllApiKeys = () => secureApiKeyManager.validateAllKeys();

/**
 * React hook for API key status monitoring
 */
export const useApiKeyStatus = () => {
  const status = getApiKeyStatus();
  const validation = validateAllApiKeys();

  return {
    status,
    isValid: validation.isValid,
    errors: validation.errors,
    warnings: validation.warnings,
    statistics: secureApiKeyManager.getAccessStatistics(),
  };
};

/**
 * Enhanced logging utilities that prevent key exposure
 */
export const secureLogger = {
  /**
   * Log API-related information without exposing keys
   */
  logApiCall: (
    service: ApiService,
    endpoint: string,
    success: boolean,
    metadata?: Record<string, any>,
  ) => {
    auditLogger.logEvent({
      eventType: success
        ? EventType.API_CALL_SUCCESS
        : EventType.API_CALL_FAILED,
      eventCategory: EventCategory.API_ACCESS,
      severity: success ? Severity.INFO : Severity.WARN,
      description: `API call to ${service} ${success ? 'succeeded' : 'failed'}`,
      metadata: {
        service,
        endpoint,
        success,
        keyMask: secureApiKeyManager.maskApiKey(getApiKey(service).key),
        ...metadata,
      },
      context: {
        timestamp: new Date(),
        action: 'API_CALL',
        resource: endpoint,
      },
    });
  },

  /**
   * Log service initialization without exposing configuration secrets
   */
  logServiceInit: (
    service: ApiService,
    initialized: boolean,
    metadata?: Record<string, any>,
  ) => {
    const status = getApiKeyStatus()[service];

    auditLogger.logEvent({
      eventType: initialized
        ? EventType.SERVICE_INITIALIZED
        : EventType.SERVICE_INIT_FAILED,
      eventCategory: EventCategory.SYSTEM,
      severity: initialized ? Severity.INFO : Severity.ERROR,
      description: `Service ${service} initialization ${
        initialized ? 'completed' : 'failed'
      }`,
      metadata: {
        service,
        initialized,
        keyConfigured: status.configured,
        keyValid: status.valid,
        keyMask: status.masked,
        ...metadata,
      },
      context: {
        timestamp: new Date(),
        action: 'SERVICE_INIT',
        resource: service,
      },
    });
  },
};

export default secureApiKeyManager;
