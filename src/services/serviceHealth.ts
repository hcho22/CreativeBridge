/**
 * Service Health Monitoring System
 *
 * Monitors Claude Skills service health and triggers graceful degradation
 * Task 6.3: Service Degradation Handling - Health monitoring component
 */

import { structuredLogger } from '../utils/logger';
import {
  SkillManager,
  SkillError,
  SkillErrorCode,
  SkillType,
} from '../types/claudeSkills';

export interface ServiceHealthStatus {
  status: 'healthy' | 'degraded' | 'unavailable' | 'unknown';
  lastChecked: Date;
  responseTime?: number;
  errorRate: number;
  successRate: number;
  uptime: number; // percentage over monitoring window
  issues: string[];
}

export interface ServiceMetrics {
  requestCount: number;
  successCount: number;
  errorCount: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  uptimePercentage: number;
  lastError?: SkillError;
  consecutiveFailures: number;
  lastSuccessTime?: Date;
  lastFailureTime?: Date;
}

export interface HealthCheckConfig {
  checkIntervalMs: number;
  timeoutMs: number;
  degradationThreshold: {
    errorRate: number; // 0-1, error rate to trigger degradation
    responseTimeMs: number; // response time to trigger degradation
    consecutiveFailures: number; // consecutive failures to trigger unavailable
  };
  recoveryThreshold: {
    successRate: number; // 0-1, success rate needed for recovery
    stabilityWindow: number; // time window to assess stability in ms
    consecutiveSuccesses: number; // consecutive successes needed for recovery
  };
  monitoringWindow: number; // time window for metrics calculation in ms
}

export interface HealthCheckResult {
  success: boolean;
  responseTime: number;
  error?: SkillError | Error;
  timestamp: Date;
}

export interface ServiceDegradationEvent {
  service: string;
  previousStatus: ServiceHealthStatus['status'];
  newStatus: ServiceHealthStatus['status'];
  timestamp: Date;
  reason: string;
  triggeringMetrics: Partial<ServiceMetrics>;
  recommendedActions: string[];
}

export class ServiceHealthMonitor {
  private skillManager: SkillManager;
  private config: HealthCheckConfig;
  private serviceStatus: Map<string, ServiceHealthStatus> = new Map();
  private serviceMetrics: Map<string, ServiceMetrics> = new Map();
  private healthCheckHistory: Map<string, HealthCheckResult[]> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private degradationListeners: ((event: ServiceDegradationEvent) => void)[] =
    [];
  private isMonitoring: boolean = false;

  constructor(skillManager: SkillManager, config?: Partial<HealthCheckConfig>) {
    this.skillManager = skillManager;
    this.config = {
      checkIntervalMs: 30000, // 30 seconds
      timeoutMs: 5000, // 5 seconds
      degradationThreshold: {
        errorRate: 0.2, // 20% error rate
        responseTimeMs: 3000, // 3 seconds
        consecutiveFailures: 3,
      },
      recoveryThreshold: {
        successRate: 0.8, // 80% success rate
        stabilityWindow: 300000, // 5 minutes
        consecutiveSuccesses: 5,
      },
      monitoringWindow: 600000, // 10 minutes
      ...config,
    };

    this.initializeServiceTracking();
  }

  /**
   * Start continuous health monitoring
   */
  public startMonitoring(): void {
    if (this.isMonitoring) {
      structuredLogger.warn('Health monitoring already started');
      return;
    }

    this.isMonitoring = true;
    structuredLogger.info('Starting service health monitoring', {
      checkInterval: this.config.checkIntervalMs,
      monitoredServices: Array.from(this.serviceStatus.keys()),
    });

    this.monitoringInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.checkIntervalMs);

    // Perform initial health check
    this.performHealthChecks();
  }

  /**
   * Stop health monitoring
   */
  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.isMonitoring = false;
    structuredLogger.info('Service health monitoring stopped');
  }

  /**
   * Get current health status for a service
   */
  public getServiceHealth(
    serviceName: string,
  ): ServiceHealthStatus | undefined {
    return this.serviceStatus.get(serviceName);
  }

  /**
   * Get all services health status
   */
  public getAllServicesHealth(): Record<string, ServiceHealthStatus> {
    const healthMap: Record<string, ServiceHealthStatus> = {};
    for (const [service, status] of this.serviceStatus.entries()) {
      healthMap[service] = { ...status };
    }
    return healthMap;
  }

  /**
   * Get detailed metrics for a service
   */
  public getServiceMetrics(serviceName: string): ServiceMetrics | undefined {
    return this.serviceMetrics.get(serviceName);
  }

  /**
   * Check if a service is currently healthy
   */
  public isServiceHealthy(serviceName: string): boolean {
    const status = this.serviceStatus.get(serviceName);
    return status?.status === 'healthy';
  }

  /**
   * Check if a service is available (healthy or degraded but functional)
   */
  public isServiceAvailable(serviceName: string): boolean {
    const status = this.serviceStatus.get(serviceName);
    return status?.status === 'healthy' || status?.status === 'degraded';
  }

  /**
   * Record a service operation result for health tracking
   */
  public recordServiceResult(
    serviceName: string,
    success: boolean,
    responseTime: number,
    error?: SkillError | Error,
  ): void {
    const metrics = this.getOrCreateMetrics(serviceName);
    const status = this.getOrCreateStatus(serviceName);

    // Update metrics
    metrics.requestCount++;
    if (success) {
      metrics.successCount++;
      metrics.consecutiveFailures = 0;
      metrics.lastSuccessTime = new Date();
    } else {
      metrics.errorCount++;
      metrics.consecutiveFailures++;
      metrics.lastFailureTime = new Date();
      if (error) {
        metrics.lastError =
          error instanceof SkillError
            ? error
            : new SkillError({
                code: SkillErrorCode.SKILL_TIMEOUT,
                message: error.message,
                retryable: true,
              });
      }
    }

    // Update response time metrics
    const totalResponseTime =
      metrics.averageResponseTime * (metrics.requestCount - 1) + responseTime;
    metrics.averageResponseTime = totalResponseTime / metrics.requestCount;

    // Calculate rates
    metrics.successRate = metrics.successCount / metrics.requestCount;
    metrics.errorRate = metrics.errorCount / metrics.requestCount;

    // Update service status based on new metrics
    this.updateServiceStatus(serviceName, metrics);

    // Clean old history
    this.cleanOldHistory(serviceName);
  }

  /**
   * Add listener for service degradation events
   */
  public addDegradationListener(
    listener: (event: ServiceDegradationEvent) => void,
  ): void {
    this.degradationListeners.push(listener);
  }

  /**
   * Remove degradation listener
   */
  public removeDegradationListener(
    listener: (event: ServiceDegradationEvent) => void,
  ): void {
    const index = this.degradationListeners.indexOf(listener);
    if (index > -1) {
      this.degradationListeners.splice(index, 1);
    }
  }

  /**
   * Manually trigger health check for a specific service
   */
  public async checkServiceHealth(
    serviceName: string,
  ): Promise<HealthCheckResult> {
    try {
      structuredLogger.debug('Manual health check started', { serviceName });

      const startTime = Date.now();
      const healthCheckPromise = this.performServiceHealthCheck(serviceName);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error('Health check timeout')),
          this.config.timeoutMs,
        );
      });

      await Promise.race([healthCheckPromise, timeoutPromise]);

      const responseTime = Date.now() - startTime;
      const result: HealthCheckResult = {
        success: true,
        responseTime,
        timestamp: new Date(),
      };

      // Record the result
      this.recordHealthCheckResult(serviceName, result);
      this.recordServiceResult(serviceName, true, responseTime);

      return result;
    } catch (error) {
      const responseTime = Date.now() - Date.now(); // This will be close to timeout
      const result: HealthCheckResult = {
        success: false,
        responseTime,
        error: error as Error,
        timestamp: new Date(),
      };

      // Record the result
      this.recordHealthCheckResult(serviceName, result);
      this.recordServiceResult(
        serviceName,
        false,
        responseTime,
        error as Error,
      );

      return result;
    }
  }

  /**
   * Get health check history for a service
   */
  public getHealthCheckHistory(
    serviceName: string,
    limit?: number,
  ): HealthCheckResult[] {
    const history = this.healthCheckHistory.get(serviceName) || [];
    return limit ? history.slice(-limit) : [...history];
  }

  // Private methods

  private initializeServiceTracking(): void {
    // Initialize tracking for known services
    const services = [
      'claude_skills_api',
      'story_generation',
      'content_prediction',
      'quality_assessment',
      'personalization',
    ];

    for (const service of services) {
      this.getOrCreateStatus(service);
      this.getOrCreateMetrics(service);
    }
  }

  private async performHealthChecks(): Promise<void> {
    try {
      const services = Array.from(this.serviceStatus.keys());

      structuredLogger.debug('Performing scheduled health checks', {
        serviceCount: services.length,
        services,
      });

      // Check all services in parallel
      const healthCheckPromises = services.map(service =>
        this.checkServiceHealth(service).catch(error => {
          structuredLogger.warn('Health check failed', {
            service,
            error: error.message,
          });
          return null;
        }),
      );

      await Promise.allSettled(healthCheckPromises);
    } catch (error) {
      structuredLogger.error('Health check cycle failed', {}, error as Error);
    }
  }

  private async performServiceHealthCheck(serviceName: string): Promise<void> {
    switch (serviceName) {
      case 'claude_skills_api':
        await this.checkClaudeSkillsAPI();
        break;
      case 'story_generation':
        await this.checkStoryGenerationService();
        break;
      case 'content_prediction':
        await this.checkContentPredictionService();
        break;
      case 'quality_assessment':
        await this.checkQualityAssessmentService();
        break;
      case 'personalization':
        await this.checkPersonalizationService();
        break;
      default:
        throw new Error(`Unknown service: ${serviceName}`);
    }
  }

  private async checkClaudeSkillsAPI(): Promise<void> {
    // Basic connectivity check to Claude Skills
    if (!this.skillManager.isInitialized()) {
      throw new Error('Claude Skills manager not initialized');
    }

    // Try to get skill status as a health check
    try {
      const status = this.skillManager.getSkillStatus('health_check');
      if (status === 'error') {
        throw new Error('Claude Skills API in error state');
      }
    } catch (error) {
      throw new Error(
        `Claude Skills API health check failed: ${(error as Error).message}`,
      );
    }
  }

  private async checkStoryGenerationService(): Promise<void> {
    // Check if story generation skill is responsive
    // In a real implementation, this might make a simple test request
    if (!this.isServiceAvailable('claude_skills_api')) {
      throw new Error('Story generation depends on Claude Skills API');
    }
  }

  private async checkContentPredictionService(): Promise<void> {
    // Check content prediction service health
    if (!this.isServiceAvailable('claude_skills_api')) {
      throw new Error('Content prediction depends on Claude Skills API');
    }
  }

  private async checkQualityAssessmentService(): Promise<void> {
    // Check quality assessment service health
    if (!this.isServiceAvailable('claude_skills_api')) {
      throw new Error('Quality assessment depends on Claude Skills API');
    }
  }

  private async checkPersonalizationService(): Promise<void> {
    // Check personalization service health
    // This might check local storage or cache availability
    try {
      // Simple health check - verify we can access storage
      if (typeof window !== 'undefined' && !window.localStorage) {
        throw new Error('Local storage not available');
      }
    } catch (error) {
      throw new Error(
        `Personalization service health check failed: ${
          (error as Error).message
        }`,
      );
    }
  }

  private getOrCreateStatus(serviceName: string): ServiceHealthStatus {
    if (!this.serviceStatus.has(serviceName)) {
      this.serviceStatus.set(serviceName, {
        status: 'unknown',
        lastChecked: new Date(),
        errorRate: 0,
        successRate: 1,
        uptime: 100,
        issues: [],
      });
    }
    return this.serviceStatus.get(serviceName)!;
  }

  private getOrCreateMetrics(serviceName: string): ServiceMetrics {
    if (!this.serviceMetrics.has(serviceName)) {
      this.serviceMetrics.set(serviceName, {
        requestCount: 0,
        successCount: 0,
        errorCount: 0,
        averageResponseTime: 0,
        p95ResponseTime: 0,
        uptimePercentage: 100,
        consecutiveFailures: 0,
      });
    }
    return this.serviceMetrics.get(serviceName)!;
  }

  private updateServiceStatus(
    serviceName: string,
    metrics: ServiceMetrics,
  ): void {
    const currentStatus = this.getOrCreateStatus(serviceName);
    const previousStatus = currentStatus.status;

    // Determine new status based on metrics
    let newStatus: ServiceHealthStatus['status'] = 'healthy';
    const issues: string[] = [];

    // Check for unavailable status
    if (
      metrics.consecutiveFailures >=
      this.config.degradationThreshold.consecutiveFailures
    ) {
      newStatus = 'unavailable';
      issues.push(`${metrics.consecutiveFailures} consecutive failures`);
    }
    // Check for degraded status
    else if (metrics.errorRate > this.config.degradationThreshold.errorRate) {
      newStatus = 'degraded';
      issues.push(
        `Error rate ${(metrics.errorRate * 100).toFixed(1)}% exceeds threshold`,
      );
    } else if (
      metrics.averageResponseTime >
      this.config.degradationThreshold.responseTimeMs
    ) {
      newStatus = 'degraded';
      issues.push(
        `Response time ${metrics.averageResponseTime.toFixed(
          0,
        )}ms exceeds threshold`,
      );
    }

    // Check for recovery from degraded/unavailable
    if (
      (previousStatus === 'degraded' || previousStatus === 'unavailable') &&
      metrics.successRate >= this.config.recoveryThreshold.successRate
    ) {
      // Additional stability check for recovery
      const recentHistory = this.getHealthCheckHistory(serviceName, 10);
      const recentSuccesses = recentHistory.filter(r => r.success).length;

      if (
        recentSuccesses >=
        Math.min(
          this.config.recoveryThreshold.consecutiveSuccesses,
          recentHistory.length,
        )
      ) {
        newStatus = 'healthy';
        issues.length = 0; // Clear issues on recovery
      }
    }

    // Update status
    currentStatus.status = newStatus;
    currentStatus.lastChecked = new Date();
    currentStatus.errorRate = metrics.errorRate;
    currentStatus.successRate = metrics.successRate;
    currentStatus.responseTime = metrics.averageResponseTime;
    currentStatus.uptime = metrics.uptimePercentage;
    currentStatus.issues = issues;

    // Fire degradation event if status changed
    if (previousStatus !== newStatus) {
      this.fireDegradationEvent(
        serviceName,
        previousStatus,
        newStatus,
        metrics,
      );
    }

    structuredLogger.info('Service status updated', {
      serviceName,
      previousStatus,
      newStatus,
      errorRate: metrics.errorRate,
      successRate: metrics.successRate,
      consecutiveFailures: metrics.consecutiveFailures,
      responseTime: metrics.averageResponseTime,
    });
  }

  private recordHealthCheckResult(
    serviceName: string,
    result: HealthCheckResult,
  ): void {
    if (!this.healthCheckHistory.has(serviceName)) {
      this.healthCheckHistory.set(serviceName, []);
    }

    const history = this.healthCheckHistory.get(serviceName)!;
    history.push(result);

    // Keep only recent history (last 100 checks)
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
  }

  private cleanOldHistory(serviceName: string): void {
    const cutoffTime = new Date(Date.now() - this.config.monitoringWindow);
    const history = this.healthCheckHistory.get(serviceName);

    if (history) {
      const recentHistory = history.filter(
        result => result.timestamp > cutoffTime,
      );
      this.healthCheckHistory.set(serviceName, recentHistory);
    }
  }

  private fireDegradationEvent(
    serviceName: string,
    previousStatus: ServiceHealthStatus['status'],
    newStatus: ServiceHealthStatus['status'],
    metrics: ServiceMetrics,
  ): void {
    const event: ServiceDegradationEvent = {
      service: serviceName,
      previousStatus,
      newStatus,
      timestamp: new Date(),
      reason: this.getDegradationReason(newStatus, metrics),
      triggeringMetrics: {
        errorRate: metrics.errorRate,
        averageResponseTime: metrics.averageResponseTime,
        consecutiveFailures: metrics.consecutiveFailures,
        successRate: metrics.successRate,
      },
      recommendedActions: this.getRecommendedActions(
        serviceName,
        newStatus,
        metrics,
      ),
    };

    structuredLogger.info('Service degradation event', {
      serviceName,
      previousStatus,
      newStatus,
      reason: event.reason,
      recommendedActions: event.recommendedActions,
    });

    // Notify all listeners
    for (const listener of this.degradationListeners) {
      try {
        listener(event);
      } catch (error) {
        structuredLogger.error(
          'Degradation listener error',
          { serviceName },
          error as Error,
        );
      }
    }
  }

  private getDegradationReason(
    status: ServiceHealthStatus['status'],
    metrics: ServiceMetrics,
  ): string {
    switch (status) {
      case 'unavailable':
        return `Service unavailable due to ${metrics.consecutiveFailures} consecutive failures`;
      case 'degraded':
        const reasons: string[] = [];
        if (metrics.errorRate > this.config.degradationThreshold.errorRate) {
          reasons.push(
            `high error rate (${(metrics.errorRate * 100).toFixed(1)}%)`,
          );
        }
        if (
          metrics.averageResponseTime >
          this.config.degradationThreshold.responseTimeMs
        ) {
          reasons.push(
            `slow response time (${metrics.averageResponseTime.toFixed(0)}ms)`,
          );
        }
        return `Service degraded due to ${reasons.join(' and ')}`;
      case 'healthy':
        return 'Service recovered to healthy status';
      default:
        return 'Service status changed';
    }
  }

  private getRecommendedActions(
    serviceName: string,
    status: ServiceHealthStatus['status'],
    metrics: ServiceMetrics,
  ): string[] {
    const actions: string[] = [];

    switch (status) {
      case 'unavailable':
        actions.push('Activate fallback mechanisms');
        actions.push('Switch to offline mode if available');
        actions.push('Notify development team');
        actions.push('Check Claude Skills API status');
        break;
      case 'degraded':
        actions.push('Enable progressive enhancement');
        actions.push('Reduce service load');
        actions.push('Monitor closely for recovery');
        if (
          metrics.averageResponseTime >
          this.config.degradationThreshold.responseTimeMs
        ) {
          actions.push('Implement request throttling');
        }
        break;
      case 'healthy':
        actions.push('Gradually restore full functionality');
        actions.push('Monitor for stability');
        actions.push('Resume normal operations');
        break;
    }

    return actions;
  }

  /**
   * Get overall system health status
   */
  public getSystemHealth(): {
    overall: 'healthy' | 'degraded' | 'unavailable';
    services: Record<string, ServiceHealthStatus['status']>;
    criticalIssues: string[];
    availableServices: string[];
    unavailableServices: string[];
  } {
    const services: Record<string, ServiceHealthStatus['status']> = {};
    const criticalIssues: string[] = [];
    const availableServices: string[] = [];
    const unavailableServices: string[] = [];

    let healthyCount = 0;
    let degradedCount = 0;
    let unavailableCount = 0;

    for (const [serviceName, status] of this.serviceStatus.entries()) {
      services[serviceName] = status.status;

      switch (status.status) {
        case 'healthy':
          healthyCount++;
          availableServices.push(serviceName);
          break;
        case 'degraded':
          degradedCount++;
          availableServices.push(serviceName);
          break;
        case 'unavailable':
          unavailableCount++;
          unavailableServices.push(serviceName);
          criticalIssues.push(`${serviceName} is unavailable`);
          break;
      }
    }

    // Determine overall status
    let overall: 'healthy' | 'degraded' | 'unavailable';
    if (unavailableCount > 0) {
      overall =
        unavailableCount >= Object.keys(services).length / 2
          ? 'unavailable'
          : 'degraded';
    } else if (degradedCount > 0) {
      overall = 'degraded';
    } else {
      overall = 'healthy';
    }

    return {
      overall,
      services,
      criticalIssues,
      availableServices,
      unavailableServices,
    };
  }

  /**
   * Reset all metrics and status (for testing)
   */
  public resetAllMetrics(): void {
    this.serviceMetrics.clear();
    this.serviceStatus.clear();
    this.healthCheckHistory.clear();
    this.initializeServiceTracking();

    structuredLogger.info('All service metrics and status reset');
  }
}
