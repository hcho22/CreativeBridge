/**
 * Enhanced Error Logging and Monitoring Service
 *
 * This service provides comprehensive error logging, monitoring, and alerting
 * capabilities for the image generation system.
 */

export interface ErrorLogEntry {
  id?: string;
  timestamp: string;
  errorType:
    | 'api_failure'
    | 'timeout'
    | 'rate_limit'
    | 'content_safety'
    | 'insufficient_xp'
    | 'system_error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  service:
    | 'replicate'
    | 'flux_aquarell'
    | 'backup_service'
    | 'xp_system'
    | 'database'
    | 'queue_manager';
  message: string;
  errorDetails: Record<string, any>;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  stackTrace?: string;
  context: Record<string, any>;
  responseTime?: number;
  retryCount?: number;
  resolution?: string;
  resolvedAt?: string;
}

export interface MonitoringMetrics {
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsBySeverity: Record<string, number>;
  errorsByService: Record<string, number>;
  averageResponseTime: number;
  uptime: number;
  lastError?: ErrorLogEntry;
  alertsTriggered: number;
  errorRate: number; // errors per minute
}

export interface AlertRule {
  id: string;
  name: string;
  condition:
    | 'error_rate'
    | 'consecutive_errors'
    | 'service_down'
    | 'high_severity';
  threshold: number;
  timeWindow: number; // in milliseconds
  isActive: boolean;
  lastTriggered?: number;
}

class ErrorLogger {
  private errorQueue: ErrorLogEntry[] = [];
  private metrics: MonitoringMetrics;
  private alertRules: AlertRule[] = [];
  private startTime: number;
  private recentErrors: ErrorLogEntry[] = [];
  private maxRecentErrors = 100;
  private flushInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startTime = Date.now();
    this.metrics = {
      totalErrors: 0,
      errorsByType: {},
      errorsBySeverity: {},
      errorsByService: {},
      averageResponseTime: 0,
      uptime: 0,
      alertsTriggered: 0,
      errorRate: 0,
    };

    this.initializeDefaultAlertRules();
    this.startPeriodicFlush();
  }

  private initializeDefaultAlertRules(): void {
    this.alertRules = [
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        condition: 'error_rate',
        threshold: 5, // 5 errors per minute
        timeWindow: 60000, // 1 minute
        isActive: true,
      },
      {
        id: 'consecutive_api_failures',
        name: 'Consecutive API Failures',
        condition: 'consecutive_errors',
        threshold: 3, // 3 consecutive API failures
        timeWindow: 300000, // 5 minutes
        isActive: true,
      },
      {
        id: 'critical_system_error',
        name: 'Critical System Error',
        condition: 'high_severity',
        threshold: 1, // Any critical error
        timeWindow: 60000, // 1 minute
        isActive: true,
      },
    ];
  }

  private startPeriodicFlush(): void {
    // Flush error logs to database every 30 seconds
    this.flushInterval = setInterval(() => {
      this.flushErrorQueue().catch(error => {
        console.error('📝 Failed to flush error queue:', error);
      });
      this.updateMetrics();
    }, 30000);
  }

  public async logError(
    errorType: ErrorLogEntry['errorType'],
    severity: ErrorLogEntry['severity'],
    service: ErrorLogEntry['service'],
    message: string,
    context: Record<string, any> = {},
    error?: Error,
  ): Promise<string> {
    const errorId = this.generateErrorId();
    const timestamp = new Date().toISOString();

    const errorEntry: ErrorLogEntry = {
      id: errorId,
      timestamp,
      errorType,
      severity,
      service,
      message,
      errorDetails: {
        errorName: error?.name,
        errorMessage: error?.message,
        ...(context.errorDetails || {}),
      },
      userId: context.userId,
      sessionId: context.sessionId,
      requestId: context.requestId,
      stackTrace: error?.stack,
      context: {
        ...context,
        userAgent: context.userAgent || 'unknown',
        platform: context.platform || 'mobile',
        appVersion: context.appVersion || 'unknown',
      },
      responseTime: context.responseTime,
      retryCount: context.retryCount || 0,
    };

    // Add to error queue for batch processing
    this.errorQueue.push(errorEntry);

    // Add to recent errors for monitoring
    this.recentErrors.push(errorEntry);
    if (this.recentErrors.length > this.maxRecentErrors) {
      this.recentErrors.shift();
    }

    // Update metrics immediately
    this.updateErrorMetrics(errorEntry);

    // Check alert rules
    this.checkAlertRules(errorEntry);

    // Log to console with enhanced formatting
    this.logToConsole(errorEntry);

    // For critical errors, flush immediately
    if (severity === 'critical') {
      await this.flushErrorQueue();
    }

    return errorId;
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateErrorMetrics(errorEntry: ErrorLogEntry): void {
    this.metrics.totalErrors++;

    // Update error counts by type
    this.metrics.errorsByType[errorEntry.errorType] =
      (this.metrics.errorsByType[errorEntry.errorType] || 0) + 1;

    // Update error counts by severity
    this.metrics.errorsBySeverity[errorEntry.severity] =
      (this.metrics.errorsBySeverity[errorEntry.severity] || 0) + 1;

    // Update error counts by service
    this.metrics.errorsByService[errorEntry.service] =
      (this.metrics.errorsByService[errorEntry.service] || 0) + 1;

    // Update average response time
    if (errorEntry.responseTime) {
      const currentTotal =
        this.metrics.averageResponseTime * (this.metrics.totalErrors - 1);
      this.metrics.averageResponseTime =
        (currentTotal + errorEntry.responseTime) / this.metrics.totalErrors;
    }

    // Update last error
    this.metrics.lastError = errorEntry;

    // Calculate error rate (errors in last minute)
    const oneMinuteAgo = Date.now() - 60000;
    const recentErrorCount = this.recentErrors.filter(
      err => new Date(err.timestamp).getTime() > oneMinuteAgo,
    ).length;
    this.metrics.errorRate = recentErrorCount;
  }

  private updateMetrics(): void {
    // Update uptime
    this.metrics.uptime = Date.now() - this.startTime;
  }

  private checkAlertRules(errorEntry: ErrorLogEntry): void {
    for (const rule of this.alertRules) {
      if (!rule.isActive) continue;

      let shouldTrigger = false;
      const now = Date.now();
      const timeWindowStart = now - rule.timeWindow;

      switch (rule.condition) {
        case 'error_rate':
          const recentErrors = this.recentErrors.filter(
            err => new Date(err.timestamp).getTime() > timeWindowStart,
          );
          shouldTrigger = recentErrors.length >= rule.threshold;
          break;

        case 'consecutive_errors':
          const lastNErrors = this.recentErrors.slice(-rule.threshold);
          shouldTrigger =
            lastNErrors.length === rule.threshold &&
            lastNErrors.every(err => err.errorType === 'api_failure');
          break;

        case 'high_severity':
          shouldTrigger = errorEntry.severity === 'critical';
          break;

        case 'service_down':
          const serviceErrors = this.recentErrors.filter(
            err =>
              err.service === errorEntry.service &&
              new Date(err.timestamp).getTime() > timeWindowStart,
          );
          shouldTrigger = serviceErrors.length >= rule.threshold;
          break;
      }

      if (shouldTrigger) {
        this.triggerAlert(rule, errorEntry);
      }
    }
  }

  private triggerAlert(rule: AlertRule, errorEntry: ErrorLogEntry): void {
    const now = Date.now();

    // Prevent spam by enforcing minimum time between same alert
    if (rule.lastTriggered && now - rule.lastTriggered < 300000) {
      // 5 minutes
      return;
    }

    rule.lastTriggered = now;
    this.metrics.alertsTriggered++;

    const alertMessage = `🚨 ALERT: ${rule.name} - ${errorEntry.message}`;

    console.error('🚨 MONITORING ALERT:', {
      rule: rule.name,
      condition: rule.condition,
      threshold: rule.threshold,
      errorEntry: {
        type: errorEntry.errorType,
        severity: errorEntry.severity,
        service: errorEntry.service,
        message: errorEntry.message,
      },
      metrics: {
        totalErrors: this.metrics.totalErrors,
        errorRate: this.metrics.errorRate,
        uptime: this.metrics.uptime,
      },
    });

    // Here you could integrate with external alerting systems
    // this.sendToSlack(alertMessage);
    // this.sendToEmail(alertMessage);
    // this.sendToPagerDuty(alertMessage);
  }

  private logToConsole(errorEntry: ErrorLogEntry): void {
    const emoji = this.getSeverityEmoji(errorEntry.severity);
    const serviceEmoji = this.getServiceEmoji(errorEntry.service);

    console.error(
      `${emoji} ${serviceEmoji} [${errorEntry.errorType.toUpperCase()}] ${
        errorEntry.message
      }`,
      {
        id: errorEntry.id,
        severity: errorEntry.severity,
        service: errorEntry.service,
        userId: errorEntry.userId,
        sessionId: errorEntry.sessionId,
        responseTime: errorEntry.responseTime,
        context: errorEntry.context,
        timestamp: errorEntry.timestamp,
      },
    );

    if (errorEntry.stackTrace && errorEntry.severity === 'critical') {
      console.error('📋 Stack trace:', errorEntry.stackTrace);
    }
  }

  private getSeverityEmoji(severity: string): string {
    switch (severity) {
      case 'low':
        return '⚪';
      case 'medium':
        return '🟡';
      case 'high':
        return '🟠';
      case 'critical':
        return '🔴';
      default:
        return '⚫';
    }
  }

  private getServiceEmoji(service: string): string {
    switch (service) {
      case 'replicate':
        return '🎨';
      case 'backup_service':
        return '🛡️';
      case 'xp_system':
        return '⭐';
      case 'database':
        return '🗄️';
      case 'queue_manager':
        return '📋';
      default:
        return '🔧';
    }
  }

  private async flushErrorQueue(): Promise<void> {
    if (this.errorQueue.length === 0) return;

    const errors = [...this.errorQueue];
    this.errorQueue = [];

    try {
      // In a real implementation, you would save to database
      // For now, we'll simulate database saving
      console.log(
        `📝 Flushing ${errors.length} errors to monitoring system...`,
      );

      // Simulate database save
      await this.saveErrorsToDatabase(errors);

      console.log(
        `✅ Successfully saved ${errors.length} errors to monitoring system`,
      );
    } catch (error) {
      console.error('💥 Failed to save errors to database:', error);
      // Re-add errors to queue for retry
      this.errorQueue.unshift(...errors);
    }
  }

  private async saveErrorsToDatabase(errors: ErrorLogEntry[]): Promise<void> {
    // Simulate database operation
    await new Promise(resolve => setTimeout(resolve, 100));

    // In a real implementation, you would use Supabase or another database
    // const { error } = await supabase
    //   .from('error_logs')
    //   .insert(errors.map(err => ({
    //     id: err.id,
    //     timestamp: err.timestamp,
    //     error_type: err.errorType,
    //     severity: err.severity,
    //     service: err.service,
    //     message: err.message,
    //     error_details: err.errorDetails,
    //     user_id: err.userId,
    //     session_id: err.sessionId,
    //     request_id: err.requestId,
    //     stack_trace: err.stackTrace,
    //     context: err.context,
    //     response_time: err.responseTime,
    //     retry_count: err.retryCount
    //   })));

    // if (error) {
    //   throw new Error(`Database error: ${error.message}`);
    // }
  }

  public getMetrics(): MonitoringMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  public getRecentErrors(limit: number = 20): ErrorLogEntry[] {
    return this.recentErrors.slice(-limit);
  }

  public getErrorsByTimeRange(startTime: Date, endTime: Date): ErrorLogEntry[] {
    return this.recentErrors.filter(error => {
      const errorTime = new Date(error.timestamp);
      return errorTime >= startTime && errorTime <= endTime;
    });
  }

  public clearOldErrors(olderThanMs: number = 3600000): number {
    // Default: 1 hour
    const cutoffTime = Date.now() - olderThanMs;
    const initialCount = this.recentErrors.length;

    this.recentErrors = this.recentErrors.filter(
      error => new Date(error.timestamp).getTime() > cutoffTime,
    );

    return initialCount - this.recentErrors.length;
  }

  public updateAlertRule(ruleId: string, updates: Partial<AlertRule>): boolean {
    const ruleIndex = this.alertRules.findIndex(rule => rule.id === ruleId);
    if (ruleIndex === -1) return false;

    this.alertRules[ruleIndex] = { ...this.alertRules[ruleIndex], ...updates };
    return true;
  }

  public getAlertRules(): AlertRule[] {
    return [...this.alertRules];
  }

  public addAlertRule(rule: AlertRule): void {
    this.alertRules.push(rule);
  }

  public removeAlertRule(ruleId: string): boolean {
    const initialLength = this.alertRules.length;
    this.alertRules = this.alertRules.filter(rule => rule.id !== ruleId);
    return this.alertRules.length < initialLength;
  }

  public shutdown(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    // Final flush
    this.flushErrorQueue().catch(error => {
      console.error('📝 Failed final error flush during shutdown:', error);
    });
  }

  // Convenience methods for common error types
  public async logAPIError(
    service: 'replicate' | 'flux_aquarell' | 'backup_service',
    message: string,
    context: Record<string, any> = {},
    error?: Error,
  ): Promise<string> {
    return this.logError(
      'api_failure',
      'high',
      service,
      message,
      context,
      error,
    );
  }

  public async logTimeoutError(
    service: ErrorLogEntry['service'],
    message: string,
    context: Record<string, any> = {},
  ): Promise<string> {
    return this.logError('timeout', 'medium', service, message, context);
  }

  public async logRateLimitError(
    userId: string,
    message: string,
    context: Record<string, any> = {},
  ): Promise<string> {
    return this.logError('rate_limit', 'low', 'queue_manager', message, {
      ...context,
      userId,
    });
  }

  public async logSystemError(
    service: ErrorLogEntry['service'],
    message: string,
    context: Record<string, any> = {},
    error?: Error,
  ): Promise<string> {
    return this.logError(
      'system_error',
      'critical',
      service,
      message,
      context,
      error,
    );
  }
}

// Export singleton instance
export const errorLogger = new ErrorLogger();

// Graceful shutdown handling (Node.js only - React Native doesn't support process events)
if (typeof process !== 'undefined' && process.on) {
  process.on('SIGINT', () => {
    console.log('📝 Shutting down error logger...');
    errorLogger.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('📝 Shutting down error logger...');
    errorLogger.shutdown();
    process.exit(0);
  });
}
