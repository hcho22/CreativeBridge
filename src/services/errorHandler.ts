import { auditLogger, EventType, EventCategory, Severity } from './auditLogger';

export enum ErrorLevel {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

export enum ErrorCategory {
  AUTHENTICATION = 'AUTHENTICATION',
  NETWORK = 'NETWORK',
  VALIDATION = 'VALIDATION',
  PERMISSION = 'PERMISSION',
  DATABASE = 'DATABASE',
  UI = 'UI',
  SYSTEM = 'SYSTEM',
  SECURITY = 'SECURITY',
}

export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  component?: string;
  action?: string;
  metadata?: Record<string, any>;
  userAgent?: string;
  timestamp?: Date;
}

export interface ProcessedError {
  id: string;
  message: string;
  userMessage: string;
  level: ErrorLevel;
  category: ErrorCategory;
  isRetryable: boolean;
  context: ErrorContext;
  originalError?: Error;
}

class ErrorHandler {
  private errorCount = 0;

  /**
   * Process and log an error with appropriate security measures
   */
  async handleError(
    error: Error | string,
    level: ErrorLevel = ErrorLevel.ERROR,
    category: ErrorCategory = ErrorCategory.SYSTEM,
    context: ErrorContext = {},
  ): Promise<ProcessedError> {
    const errorId = this.generateErrorId();
    const timestamp = new Date();

    // Create processed error object
    const processedError: ProcessedError = {
      id: errorId,
      message: typeof error === 'string' ? error : error.message,
      userMessage: this.getUserFriendlyMessage(error, category),
      level,
      category,
      isRetryable: this.isRetryable(error, category),
      context: {
        ...context,
        timestamp,
      },
      originalError: typeof error === 'string' ? undefined : error,
    };

    // Sanitize for production logging
    const sanitizedError = this.sanitizeError(processedError);

    // Log to audit system
    await this.logToAuditSystem(sanitizedError);

    // Log to console in development
    if (__DEV__) {
      this.logToConsole(processedError);
    }

    // Send to crash reporting in production
    if (!__DEV__) {
      this.sendToCrashReporting(sanitizedError);
    }

    return processedError;
  }

  /**
   * Handle authentication-specific errors
   */
  async handleAuthError(
    error: Error | string,
    context: ErrorContext = {},
  ): Promise<ProcessedError> {
    const authContext = {
      ...context,
      category: ErrorCategory.AUTHENTICATION,
    };

    // Check for suspicious patterns
    const isSuspicious = this.detectSuspiciousAuthActivity(error, context);

    if (isSuspicious) {
      await auditLogger.logSuspiciousActivity(
        context.userId,
        `Suspicious authentication error: ${
          typeof error === 'string' ? error : error.message
        }`,
        70,
        authContext.metadata,
      );
    }

    return this.handleError(
      error,
      ErrorLevel.WARNING,
      ErrorCategory.AUTHENTICATION,
      authContext,
    );
  }

  /**
   * Handle validation errors with input logging
   */
  async handleValidationError(
    error: Error | string,
    fieldName?: string,
    inputValue?: any,
    context: ErrorContext = {},
  ): Promise<ProcessedError> {
    const validationContext = {
      ...context,
      metadata: {
        ...context.metadata,
        fieldName,
        inputLength:
          typeof inputValue === 'string' ? inputValue.length : undefined,
        inputType: typeof inputValue,
        // Don't log actual values in production for security
        inputSample: __DEV__ ? inputValue : undefined,
      },
    };

    // Log validation error for security monitoring
    await auditLogger.logEvent({
      userId: context.userId,
      eventType: EventType.VALIDATION_ERROR,
      eventCategory: EventCategory.ERROR,
      severity: Severity.LOW,
      description: `Validation error on field: ${fieldName || 'unknown'}`,
      metadata: validationContext.metadata,
    });

    return this.handleError(
      error,
      ErrorLevel.WARNING,
      ErrorCategory.VALIDATION,
      validationContext,
    );
  }

  /**
   * Handle network errors with retry logic
   */
  async handleNetworkError(
    error: Error | string,
    endpoint?: string,
    method?: string,
    context: ErrorContext = {},
  ): Promise<ProcessedError> {
    const networkContext = {
      ...context,
      metadata: {
        ...context.metadata,
        endpoint,
        method,
        timestamp: new Date().toISOString(),
      },
    };

    return this.handleError(
      error,
      ErrorLevel.ERROR,
      ErrorCategory.NETWORK,
      networkContext,
    );
  }

  /**
   * Handle security-related errors
   */
  async handleSecurityError(
    error: Error | string,
    securityEvent: string,
    riskScore: number = 50,
    context: ErrorContext = {},
  ): Promise<ProcessedError> {
    const securityContext = {
      ...context,
      metadata: {
        ...context.metadata,
        securityEvent,
        riskScore,
        timestamp: new Date().toISOString(),
      },
    };

    // Always log security errors as suspicious
    await auditLogger.logSuspiciousActivity(
      context.userId,
      `Security error: ${securityEvent}`,
      riskScore,
      securityContext.metadata,
    );

    return this.handleError(
      error,
      riskScore > 70 ? ErrorLevel.CRITICAL : ErrorLevel.ERROR,
      ErrorCategory.SECURITY,
      securityContext,
    );
  }

  private generateErrorId(): string {
    this.errorCount++;
    return `err_${Date.now()}_${this.errorCount}_${Math.random()
      .toString(36)
      .substr(2, 5)}`;
  }

  private getUserFriendlyMessage(
    error: Error | string,
    category: ErrorCategory,
  ): string {
    const message = typeof error === 'string' ? error : error.message;

    // Don't expose sensitive error details to users
    switch (category) {
      case ErrorCategory.AUTHENTICATION:
        if (message.toLowerCase().includes('password')) {
          return 'Invalid email or password. Please try again.';
        }
        if (message.toLowerCase().includes('email')) {
          return 'Please check your email address and try again.';
        }
        return 'Authentication failed. Please try again.';

      case ErrorCategory.NETWORK:
        if (message.toLowerCase().includes('timeout')) {
          return 'Request timed out. Please check your connection and try again.';
        }
        return 'Network error. Please check your connection and try again.';

      case ErrorCategory.VALIDATION:
        return 'Please check your input and try again.';

      case ErrorCategory.PERMISSION:
        return "You don't have permission to perform this action.";

      case ErrorCategory.DATABASE:
        return 'A temporary issue occurred. Please try again.';

      case ErrorCategory.SECURITY:
        return 'Security check failed. Please contact support if this continues.';

      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  private isRetryable(error: Error | string, category: ErrorCategory): boolean {
    const message = typeof error === 'string' ? error : error.message;

    switch (category) {
      case ErrorCategory.NETWORK:
        return !message.toLowerCase().includes('unauthorized');

      case ErrorCategory.DATABASE:
        return true;

      case ErrorCategory.AUTHENTICATION:
        return false; // Don't auto-retry auth errors

      case ErrorCategory.SECURITY:
        return false; // Don't auto-retry security errors

      case ErrorCategory.VALIDATION:
        return false; // User needs to fix input

      default:
        return true;
    }
  }

  private sanitizeError(error: ProcessedError): ProcessedError {
    const sanitized = { ...error };

    if (!__DEV__) {
      // Remove potentially sensitive information in production
      if (sanitized.context.metadata) {
        const cleanMetadata = { ...sanitized.context.metadata };

        // Remove sensitive fields
        delete cleanMetadata.password;
        delete cleanMetadata.token;
        delete cleanMetadata.secret;
        delete cleanMetadata.key;
        delete cleanMetadata.credential;
        delete cleanMetadata.inputSample;

        // Truncate long values
        Object.keys(cleanMetadata).forEach(key => {
          if (
            typeof cleanMetadata[key] === 'string' &&
            cleanMetadata[key].length > 200
          ) {
            cleanMetadata[key] = cleanMetadata[key].substring(0, 200) + '...';
          }
        });

        sanitized.context.metadata = cleanMetadata;
      }

      // Sanitize error message
      if (sanitized.message.length > 500) {
        sanitized.message = sanitized.message.substring(0, 500) + '...';
      }

      // Remove stack trace in production
      if (sanitized.originalError) {
        sanitized.originalError = {
          ...sanitized.originalError,
          stack: undefined,
        };
      }
    }

    return sanitized;
  }

  private async logToAuditSystem(error: ProcessedError): Promise<void> {
    try {
      const eventType = this.mapErrorToEventType(error.category);
      const severity = this.mapErrorLevelToSeverity(error.level);

      await auditLogger.logEvent({
        userId: error.context.userId,
        eventType,
        eventCategory: EventCategory.ERROR,
        severity,
        description: `${error.category}: ${error.message}`,
        metadata: {
          errorId: error.id,
          level: error.level,
          category: error.category,
          isRetryable: error.isRetryable,
          component: error.context.component,
          action: error.context.action,
          ...error.context.metadata,
        },
        sessionId: error.context.sessionId,
      });
    } catch (auditError) {
      // Don't let audit logging errors crash the app
      if (__DEV__) {
        console.error('Failed to log error to audit system:', auditError);
      }
    }
  }

  private logToConsole(error: ProcessedError): void {
    const logMethod =
      error.level === ErrorLevel.CRITICAL || error.level === ErrorLevel.ERROR
        ? console.error
        : error.level === ErrorLevel.WARNING
        ? console.warn
        : console.log;

    logMethod(`[${error.level}] ${error.category}: ${error.message}`, {
      id: error.id,
      context: error.context,
      originalError: error.originalError,
    });
  }

  private sendToCrashReporting(error: ProcessedError): void {
    // Placeholder for crash reporting service integration
    // In a real app, you would integrate with services like:
    // - Sentry
    // - Bugsnag
    // - Firebase Crashlytics
    // - Custom logging service

    if (
      error.level === ErrorLevel.CRITICAL ||
      error.level === ErrorLevel.ERROR
    ) {
      // Send to crash reporting service
      // Example: Sentry.captureException(error.originalError, { extra: error.context });
    }
  }

  private detectSuspiciousAuthActivity(
    error: Error | string,
    context: ErrorContext,
  ): boolean {
    const message = typeof error === 'string' ? error : error.message;
    const lowercaseMessage = message.toLowerCase();

    // Patterns that might indicate malicious activity
    const suspiciousPatterns = [
      'too many attempts',
      'rate limit',
      'blocked',
      'suspicious',
      'sql injection',
      'script',
      'xss',
      'payload',
    ];

    return suspiciousPatterns.some(pattern =>
      lowercaseMessage.includes(pattern),
    );
  }

  private mapErrorToEventType(category: ErrorCategory): EventType {
    switch (category) {
      case ErrorCategory.AUTHENTICATION:
        return EventType.LOGIN_FAILED;
      case ErrorCategory.NETWORK:
        return EventType.NETWORK_ERROR;
      case ErrorCategory.VALIDATION:
        return EventType.VALIDATION_ERROR;
      case ErrorCategory.SECURITY:
        return EventType.SUSPICIOUS_ACTIVITY;
      default:
        return EventType.APP_ERROR;
    }
  }

  private mapErrorLevelToSeverity(level: ErrorLevel): Severity {
    switch (level) {
      case ErrorLevel.CRITICAL:
        return Severity.CRITICAL;
      case ErrorLevel.ERROR:
        return Severity.HIGH;
      case ErrorLevel.WARNING:
        return Severity.MEDIUM;
      default:
        return Severity.LOW;
    }
  }
}

// Export singleton instance
export const errorHandler = new ErrorHandler();
