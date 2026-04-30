/**
 * Structured Logging Utility for Claude Skills
 *
 * Provides structured logging with correlation IDs, log levels,
 * and integration with monitoring systems.
 */

import {
  auditLogger,
  EventType,
  EventCategory,
  Severity,
} from '../services/auditLogger';
import { SkillType, SkillError, SkillErrorCode } from '../types/claudeSkills';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

export interface LogContext {
  correlationId?: string;
  userId?: string;
  sessionId?: string;
  skillType?: SkillType;
  skillId?: string;
  operation?: string;
  component?: string;
  metadata?: Record<string, any>;
}

export interface StructuredLogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context: LogContext;
  error?: Error | SkillError;
  stackTrace?: string;
}

class StructuredLogger {
  private correlationIdCounter = 0;
  private logBuffer: StructuredLogEntry[] = [];
  private readonly MAX_BUFFER_SIZE = 1000;
  private readonly FLUSH_INTERVAL = 30000; // 30 seconds
  private flushTimer?: NodeJS.Timeout;

  constructor() {
    this.startPeriodicFlush();
  }

  /**
   * Generate correlation ID for request tracing
   */
  generateCorrelationId(): string {
    this.correlationIdCounter++;
    return `corr_${Date.now()}_${this.correlationIdCounter}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
  }

  /**
   * Log debug message
   */
  debug(message: string, context: LogContext = {}): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log info message
   */
  info(message: string, context: LogContext = {}): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log warning message
   */
  warn(
    message: string,
    context: LogContext = {},
    error?: Error | SkillError,
  ): void {
    this.log(LogLevel.WARN, message, context, error);
  }

  /**
   * Log error message
   */
  error(
    message: string,
    context: LogContext = {},
    error?: Error | SkillError,
  ): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  /**
   * Log critical message
   */
  critical(
    message: string,
    context: LogContext = {},
    error?: Error | SkillError,
  ): void {
    this.log(LogLevel.CRITICAL, message, context, error);
  }

  /**
   * Log skill operation start
   */
  logSkillOperationStart(
    skillType: SkillType,
    skillId: string,
    input: any,
    context: LogContext = {},
  ): string {
    const correlationId = context.correlationId || this.generateCorrelationId();

    this.info(`Skill operation started: ${skillType}`, {
      ...context,
      correlationId,
      skillType,
      skillId,
      operation: 'skill_execution_start',
      metadata: {
        inputSize: JSON.stringify(input).length,
        inputKeys: Object.keys(input),
      },
    });

    return correlationId;
  }

  /**
   * Log skill operation completion
   */
  logSkillOperationComplete(
    skillType: SkillType,
    skillId: string,
    success: boolean,
    executionTimeMs: number,
    result?: any,
    error?: SkillError,
    context: LogContext = {},
  ): void {
    const level = success ? LogLevel.INFO : LogLevel.ERROR;
    const message = success
      ? `Skill operation completed: ${skillType}`
      : `Skill operation failed: ${skillType}`;

    this.log(
      level,
      message,
      {
        ...context,
        skillType,
        skillId,
        operation: 'skill_execution_complete',
        metadata: {
          success,
          executionTimeMs,
          resultSize: result ? JSON.stringify(result).length : 0,
          errorCode: error?.code,
          errorMessage: error?.message,
          retryable: error?.retryable,
        },
      },
      error,
    );
  }

  /**
   * Log skill error with categorization
   */
  logSkillError(
    skillType: SkillType,
    skillId: string,
    error: SkillError,
    context: LogContext = {},
  ): void {
    const level = this.mapSkillErrorToLogLevel(error);

    this.log(
      level,
      `Skill error: ${error.message}`,
      {
        ...context,
        skillType,
        skillId,
        operation: 'skill_error',
        metadata: {
          errorCode: error.code,
          retryable: error.retryable,
          errorDetails: error.details,
        },
      },
      error,
    );

    // Also log to audit system
    this.logToAuditSystem(skillType, error, context);
  }

  /**
   * Core logging method
   */
  private log(
    level: LogLevel,
    message: string,
    context: LogContext = {},
    error?: Error | SkillError,
  ): void {
    const entry: StructuredLogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: {
        ...context,
        correlationId: context.correlationId || this.generateCorrelationId(),
      },
      error,
      stackTrace: error instanceof Error ? error.stack : undefined,
    };

    // Add to buffer
    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.MAX_BUFFER_SIZE) {
      this.logBuffer.shift(); // Remove oldest entry
    }

    // Log to console in development
    if (__DEV__) {
      this.logToConsole(entry);
    }

    // For errors and critical, flush immediately
    if (level === LogLevel.ERROR || level === LogLevel.CRITICAL) {
      this.flushLogs();
    }
  }

  /**
   * Log to console with formatting
   */
  private logToConsole(entry: StructuredLogEntry): void {
    const prefix = `[${entry.level}] [${entry.context.correlationId}]`;
    const contextStr = entry.context.skillType
      ? `[${entry.context.skillType}]`
      : '';
    const message = `${prefix} ${contextStr} ${entry.message}`;

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(message, entry.context);
        break;
      case LogLevel.INFO:
        console.log(message, entry.context);
        break;
      case LogLevel.WARN:
        console.warn(message, entry.context, entry.error);
        break;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(message, entry.context, entry.error, entry.stackTrace);
        break;
    }
  }

  /**
   * Log to audit system
   */
  private async logToAuditSystem(
    skillType: SkillType,
    error: SkillError,
    context: LogContext,
  ): Promise<void> {
    try {
      const eventType = this.mapSkillErrorToEventType(error.code);
      const severity = this.mapSkillErrorToSeverity(error.code);

      await auditLogger.logEvent({
        userId: context.userId,
        eventType,
        eventCategory: EventCategory.ERROR,
        severity,
        description: `Claude Skills Error: ${skillType} - ${error.message}`,
        metadata: {
          skillType,
          skillId: context.skillId,
          errorCode: error.code,
          retryable: error.retryable,
          correlationId: context.correlationId,
          ...error.details,
          ...context.metadata,
        },
        sessionId: context.sessionId,
      });
    } catch (auditError) {
      // Don't let audit logging errors crash the app
      if (__DEV__) {
        console.error('Failed to log to audit system:', auditError);
      }
    }
  }

  /**
   * Map skill error code to log level
   */
  private mapSkillErrorToLogLevel(error: SkillError): LogLevel {
    switch (error.code) {
      case SkillErrorCode.CONFIGURATION_ERROR:
      case SkillErrorCode.AUTHENTICATION_ERROR:
        return LogLevel.CRITICAL;
      case SkillErrorCode.RATE_LIMIT_EXCEEDED:
      case SkillErrorCode.SKILL_TIMEOUT:
        return LogLevel.ERROR;
      case SkillErrorCode.NETWORK_ERROR:
        return LogLevel.WARN; // Network errors are often transient
      default:
        return LogLevel.ERROR;
    }
  }

  /**
   * Map skill error code to audit event type
   */
  private mapSkillErrorToEventType(errorCode: SkillErrorCode): EventType {
    switch (errorCode) {
      case SkillErrorCode.NETWORK_ERROR:
        return EventType.NETWORK_ERROR;
      case SkillErrorCode.AUTHENTICATION_ERROR:
        return EventType.LOGIN_FAILED;
      case SkillErrorCode.RATE_LIMIT_EXCEEDED:
        return EventType.RATE_LIMIT_EXCEEDED;
      case SkillErrorCode.CONFIGURATION_ERROR:
        return EventType.SERVICE_INIT_FAILED;
      default:
        return EventType.APP_ERROR;
    }
  }

  /**
   * Map skill error code to severity
   */
  private mapSkillErrorToSeverity(errorCode: SkillErrorCode): Severity {
    switch (errorCode) {
      case SkillErrorCode.CONFIGURATION_ERROR:
      case SkillErrorCode.AUTHENTICATION_ERROR:
        return Severity.CRITICAL;
      case SkillErrorCode.SKILL_TIMEOUT:
      case SkillErrorCode.RATE_LIMIT_EXCEEDED:
        return Severity.HIGH;
      case SkillErrorCode.NETWORK_ERROR:
        return Severity.MEDIUM;
      default:
        return Severity.ERROR;
    }
  }

  /**
   * Start periodic log flushing
   */
  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flushLogs();
    }, this.FLUSH_INTERVAL);
  }

  /**
   * Flush logs to persistent storage
   */
  async flushLogs(): Promise<void> {
    if (this.logBuffer.length === 0) return;

    const logsToFlush = [...this.logBuffer];
    this.logBuffer = [];

    try {
      // In production, this would send to log aggregation service
      // For now, we'll just clear the buffer
      // Could integrate with services like:
      // - CloudWatch Logs
      // - Datadog
      // - Splunk
      // - Custom log aggregation

      if (__DEV__) {
        console.log(`📤 Flushed ${logsToFlush.length} log entries`);
      }
    } catch (error) {
      // Restore logs if flush failed
      this.logBuffer.unshift(...logsToFlush);
      if (__DEV__) {
        console.error('Failed to flush logs:', error);
      }
    }
  }

  /**
   * Get recent logs for debugging
   */
  getRecentLogs(limit: number = 100): StructuredLogEntry[] {
    return this.logBuffer.slice(-limit);
  }

  /**
   * Get logs by correlation ID
   */
  getLogsByCorrelationId(correlationId: string): StructuredLogEntry[] {
    return this.logBuffer.filter(
      entry => entry.context.correlationId === correlationId,
    );
  }

  /**
   * Clear log buffer
   */
  clearLogs(): void {
    this.logBuffer = [];
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flushLogs();
  }
}

// Export singleton instance
export const structuredLogger = new StructuredLogger();
export default structuredLogger;
