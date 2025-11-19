/**
 * Service Health Monitor Tests
 * 
 * Tests for service health monitoring and degradation detection
 * Task 6.3: Service Degradation Handling - Health monitoring tests
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ServiceHealthMonitor, ServiceDegradationEvent } from '../../services/serviceHealth';
import { SkillManager, SkillErrorCode } from '../../types/claudeSkills';

jest.mock('../../utils/logger');

describe('Service Health Monitor', () => {
  let mockSkillManager: jest.Mocked<SkillManager>;
  let healthMonitor: ServiceHealthMonitor;
  let degradationEvents: ServiceDegradationEvent[] = [];

  beforeEach(() => {
    jest.clearAllMocks();
    degradationEvents = [];

    mockSkillManager = {
      initialize: jest.fn().mockResolvedValue(undefined),
      registerSkill: jest.fn(),
      executeSkill: jest.fn(),
      getSkillStatus: jest.fn().mockReturnValue('idle'),
      shutdown: jest.fn().mockResolvedValue(undefined),
      isInitialized: jest.fn().mockReturnValue(true),
    };

    healthMonitor = new ServiceHealthMonitor(mockSkillManager);
    
    // Capture degradation events
    healthMonitor.addDegradationListener((event) => {
      degradationEvents.push(event);
    });
  });

  afterEach(() => {
    healthMonitor.stopMonitoring();
  });

  describe('Service Health Tracking', () => {
    it('should initialize with default healthy status for known services', () => {
      const allHealth = healthMonitor.getAllServicesHealth();
      
      expect(Object.keys(allHealth)).toContain('claude_skills_api');
      expect(Object.keys(allHealth)).toContain('story_generation');
      expect(Object.keys(allHealth)).toContain('content_prediction');
      
      for (const [serviceName, status] of Object.entries(allHealth)) {
        expect(status.status).toBe('unknown');
        expect(status.errorRate).toBe(0);
        expect(status.successRate).toBe(1);
        expect(status.uptime).toBe(100);
      }
    });

    it('should record successful service operations correctly', () => {
      healthMonitor.recordServiceResult('story_generation', true, 500);
      
      const status = healthMonitor.getServiceHealth('story_generation');
      const metrics = healthMonitor.getServiceMetrics('story_generation');
      
      expect(status?.status).toBe('healthy');
      expect(metrics?.requestCount).toBe(1);
      expect(metrics?.successCount).toBe(1);
      expect(metrics?.errorCount).toBe(0);
      expect(metrics?.averageResponseTime).toBe(500);
      expect(metrics?.successRate).toBe(1);
      expect(metrics?.errorRate).toBe(0);
      expect(metrics?.consecutiveFailures).toBe(0);
    });

    it('should record failed service operations correctly', () => {
      const mockError = new Error('Service timeout');
      
      healthMonitor.recordServiceResult('story_generation', false, 3000, mockError);
      
      const status = healthMonitor.getServiceHealth('story_generation');
      const metrics = healthMonitor.getServiceMetrics('story_generation');
      
      expect(metrics?.requestCount).toBe(1);
      expect(metrics?.successCount).toBe(0);
      expect(metrics?.errorCount).toBe(1);
      expect(metrics?.averageResponseTime).toBe(3000);
      expect(metrics?.successRate).toBe(0);
      expect(metrics?.errorRate).toBe(1);
      expect(metrics?.consecutiveFailures).toBe(1);
      expect(metrics?.lastError?.message).toBe('Service timeout');
    });
  });

  describe('Service Degradation Detection', () => {
    it('should detect service degradation based on error rate', () => {
      const serviceName = 'story_generation';
      
      // Record mix of successful and failed operations to trigger degradation
      for (let i = 0; i < 10; i++) {
        const isSuccess = i < 7; // 70% success, 30% error rate (above 20% threshold)
        healthMonitor.recordServiceResult(serviceName, isSuccess, 1000);
      }
      
      const status = healthMonitor.getServiceHealth(serviceName);
      expect(status?.status).toBe('degraded');
      expect(status?.issues).toContain(expect.stringMatching(/Error rate.*exceeds threshold/));
    });

    it('should detect service degradation based on response time', () => {
      const serviceName = 'content_prediction';
      
      // Record operations with high response time
      for (let i = 0; i < 5; i++) {
        healthMonitor.recordServiceResult(serviceName, true, 4000); // Above 3000ms threshold
      }
      
      const status = healthMonitor.getServiceHealth(serviceName);
      expect(status?.status).toBe('degraded');
      expect(status?.issues).toContain(expect.stringMatching(/Response time.*exceeds threshold/));
    });

    it('should detect service unavailability based on consecutive failures', () => {
      const serviceName = 'claude_skills_api';
      
      // Record consecutive failures to trigger unavailable status
      for (let i = 0; i < 3; i++) {
        healthMonitor.recordServiceResult(serviceName, false, 1000);
      }
      
      const status = healthMonitor.getServiceHealth(serviceName);
      expect(status?.status).toBe('unavailable');
      expect(status?.issues).toContain(expect.stringMatching(/3 consecutive failures/));
    });

    it('should fire degradation events when status changes', async () => {
      const serviceName = 'story_generation';
      
      // Trigger degradation
      for (let i = 0; i < 10; i++) {
        healthMonitor.recordServiceResult(serviceName, i < 7, 1000);
      }
      
      // Wait for potential async processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(degradationEvents.length).toBeGreaterThan(0);
      
      const event = degradationEvents[degradationEvents.length - 1];
      expect(event.service).toBe(serviceName);
      expect(event.newStatus).toBe('degraded');
      expect(event.previousStatus).toBe('healthy');
      expect(event.recommendedActions).toContain('Enable progressive enhancement');
    });
  });

  describe('Service Recovery Detection', () => {
    it('should detect service recovery from degraded to healthy', () => {
      const serviceName = 'story_generation';
      
      // First, make service degraded
      for (let i = 0; i < 10; i++) {
        healthMonitor.recordServiceResult(serviceName, i < 7, 1000);
      }
      expect(healthMonitor.getServiceHealth(serviceName)?.status).toBe('degraded');
      
      // Then record successful operations to recover
      for (let i = 0; i < 10; i++) {
        healthMonitor.recordServiceResult(serviceName, true, 800);
      }
      
      const status = healthMonitor.getServiceHealth(serviceName);
      expect(status?.status).toBe('healthy');
      expect(status?.issues).toHaveLength(0);
    });

    it('should require stability period for recovery from unavailable', () => {
      const serviceName = 'claude_skills_api';
      
      // Make service unavailable
      for (let i = 0; i < 3; i++) {
        healthMonitor.recordServiceResult(serviceName, false, 1000);
      }
      expect(healthMonitor.getServiceHealth(serviceName)?.status).toBe('unavailable');
      
      // Record some successes but not enough for recovery
      healthMonitor.recordServiceResult(serviceName, true, 800);
      expect(healthMonitor.getServiceHealth(serviceName)?.status).toBe('unavailable');
      
      // Record enough consecutive successes
      for (let i = 0; i < 5; i++) {
        healthMonitor.recordServiceResult(serviceName, true, 800);
      }
      
      // Should recover since we have enough recent successes
      const status = healthMonitor.getServiceHealth(serviceName);
      expect(status?.status).toBe('healthy');
    });
  });

  describe('Health Check Execution', () => {
    it('should perform basic health check for Claude Skills API', async () => {
      mockSkillManager.isInitialized.mockReturnValue(true);
      mockSkillManager.getSkillStatus.mockReturnValue('idle');
      
      const result = await healthMonitor.checkServiceHealth('claude_skills_api');
      
      expect(result.success).toBe(true);
      expect(result.responseTime).toBeGreaterThan(0);
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(mockSkillManager.isInitialized).toHaveBeenCalled();
    });

    it('should handle health check failures gracefully', async () => {
      mockSkillManager.isInitialized.mockReturnValue(false);
      
      const result = await healthMonitor.checkServiceHealth('claude_skills_api');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('not initialized');
    });

    it('should respect health check timeout', async () => {
      // Mock a slow health check
      mockSkillManager.getSkillStatus.mockImplementation(() => {
        return new Promise(resolve => setTimeout(() => resolve('idle'), 10000)) as any;
      });
      
      const startTime = Date.now();
      const result = await healthMonitor.checkServiceHealth('claude_skills_api');
      const duration = Date.now() - startTime;
      
      expect(result.success).toBe(false);
      expect(duration).toBeLessThan(6000); // Should timeout before 10 seconds
      expect(result.error?.message).toContain('timeout');
    });
  });

  describe('System Health Overview', () => {
    it('should provide accurate overall system health', () => {
      // Make some services degraded/unavailable
      healthMonitor.recordServiceResult('claude_skills_api', false, 1000);
      healthMonitor.recordServiceResult('claude_skills_api', false, 1000);
      healthMonitor.recordServiceResult('claude_skills_api', false, 1000);
      
      for (let i = 0; i < 10; i++) {
        healthMonitor.recordServiceResult('story_generation', i < 7, 1000);
      }
      
      const systemHealth = healthMonitor.getSystemHealth();
      
      expect(systemHealth.overall).toBe('degraded'); // Some services degraded/unavailable
      expect(systemHealth.unavailableServices).toContain('claude_skills_api');
      expect(systemHealth.criticalIssues.length).toBeGreaterThan(0);
      expect(systemHealth.criticalIssues[0]).toContain('claude_skills_api is unavailable');
    });

    it('should report healthy system when all services are healthy', () => {
      // Record successful operations for all services
      const services = ['claude_skills_api', 'story_generation', 'content_prediction'];
      
      services.forEach(service => {
        for (let i = 0; i < 5; i++) {
          healthMonitor.recordServiceResult(service, true, 800);
        }
      });
      
      const systemHealth = healthMonitor.getSystemHealth();
      
      expect(systemHealth.overall).toBe('healthy');
      expect(systemHealth.unavailableServices).toHaveLength(0);
      expect(systemHealth.criticalIssues).toHaveLength(0);
      expect(systemHealth.availableServices.length).toBeGreaterThan(0);
    });
  });

  describe('Health Monitoring Automation', () => {
    it('should start and stop monitoring correctly', () => {
      expect(healthMonitor['isMonitoring']).toBe(false);
      
      healthMonitor.startMonitoring();
      expect(healthMonitor['isMonitoring']).toBe(true);
      expect(healthMonitor['monitoringInterval']).toBeDefined();
      
      healthMonitor.stopMonitoring();
      expect(healthMonitor['isMonitoring']).toBe(false);
      expect(healthMonitor['monitoringInterval']).toBeNull();
    });

    it('should not start monitoring if already active', () => {
      healthMonitor.startMonitoring();
      const firstInterval = healthMonitor['monitoringInterval'];
      
      healthMonitor.startMonitoring(); // Try to start again
      expect(healthMonitor['monitoringInterval']).toBe(firstInterval);
    });
  });

  describe('Degradation Event Listeners', () => {
    it('should add and remove degradation listeners correctly', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      healthMonitor.addDegradationListener(listener1);
      healthMonitor.addDegradationListener(listener2);
      
      // Trigger degradation
      for (let i = 0; i < 3; i++) {
        healthMonitor.recordServiceResult('test_service', false, 1000);
      }
      
      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
      
      // Remove one listener
      healthMonitor.removeDegradationListener(listener1);
      
      // Reset mocks and trigger another degradation
      listener1.mockClear();
      listener2.mockClear();
      
      for (let i = 0; i < 3; i++) {
        healthMonitor.recordServiceResult('another_service', false, 1000);
      }
      
      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it('should handle listener errors gracefully', () => {
      const errorListener = jest.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      const goodListener = jest.fn();
      
      healthMonitor.addDegradationListener(errorListener);
      healthMonitor.addDegradationListener(goodListener);
      
      // Trigger degradation
      for (let i = 0; i < 3; i++) {
        healthMonitor.recordServiceResult('test_service', false, 1000);
      }
      
      // Both listeners should have been called despite the error
      expect(errorListener).toHaveBeenCalled();
      expect(goodListener).toHaveBeenCalled();
    });
  });

  describe('Metrics and History', () => {
    it('should maintain health check history', async () => {
      const serviceName = 'claude_skills_api';
      
      // Perform several health checks
      await healthMonitor.checkServiceHealth(serviceName);
      await healthMonitor.checkServiceHealth(serviceName);
      await healthMonitor.checkServiceHealth(serviceName);
      
      const history = healthMonitor.getHealthCheckHistory(serviceName);
      expect(history).toHaveLength(3);
      
      history.forEach(result => {
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('responseTime');
        expect(result).toHaveProperty('timestamp');
        expect(result.timestamp).toBeInstanceOf(Date);
      });
    });

    it('should limit health check history size', async () => {
      const serviceName = 'test_service';
      
      // Perform more health checks than the limit (100)
      for (let i = 0; i < 150; i++) {
        healthMonitor.recordServiceResult(serviceName, true, 100);
      }
      
      const history = healthMonitor.getHealthCheckHistory(serviceName);
      expect(history.length).toBeLessThanOrEqual(100);
    });

    it('should provide metrics for monitoring dashboards', () => {
      const serviceName = 'story_generation';
      
      // Record various operations
      for (let i = 0; i < 20; i++) {
        const isSuccess = i < 16; // 80% success rate
        const responseTime = isSuccess ? 800 : 2500;
        healthMonitor.recordServiceResult(serviceName, isSuccess, responseTime);
      }
      
      const metrics = healthMonitor.getServiceMetrics(serviceName);
      
      expect(metrics?.requestCount).toBe(20);
      expect(metrics?.successCount).toBe(16);
      expect(metrics?.errorCount).toBe(4);
      expect(metrics?.successRate).toBe(0.8);
      expect(metrics?.errorRate).toBe(0.2);
      expect(metrics?.averageResponseTime).toBeGreaterThan(0);
      expect(metrics?.uptimePercentage).toBeDefined();
    });
  });

  describe('Service Availability Checks', () => {
    it('should correctly identify healthy services as available', () => {
      healthMonitor.recordServiceResult('test_service', true, 800);
      
      expect(healthMonitor.isServiceHealthy('test_service')).toBe(true);
      expect(healthMonitor.isServiceAvailable('test_service')).toBe(true);
    });

    it('should correctly identify degraded services as available but not healthy', () => {
      // Make service degraded
      for (let i = 0; i < 10; i++) {
        healthMonitor.recordServiceResult('test_service', i < 7, 1000);
      }
      
      expect(healthMonitor.isServiceHealthy('test_service')).toBe(false);
      expect(healthMonitor.isServiceAvailable('test_service')).toBe(true);
    });

    it('should correctly identify unavailable services', () => {
      // Make service unavailable
      for (let i = 0; i < 3; i++) {
        healthMonitor.recordServiceResult('test_service', false, 1000);
      }
      
      expect(healthMonitor.isServiceHealthy('test_service')).toBe(false);
      expect(healthMonitor.isServiceAvailable('test_service')).toBe(false);
    });
  });

  describe('Configuration and Customization', () => {
    it('should accept custom configuration', () => {
      const customConfig = {
        checkIntervalMs: 60000,
        degradationThreshold: {
          errorRate: 0.1,
          responseTimeMs: 2000,
          consecutiveFailures: 5
        }
      };
      
      const customMonitor = new ServiceHealthMonitor(mockSkillManager, customConfig);
      
      expect(customMonitor['config'].checkIntervalMs).toBe(60000);
      expect(customMonitor['config'].degradationThreshold.errorRate).toBe(0.1);
    });

    it('should reset all metrics when requested', () => {
      // Record some operations
      healthMonitor.recordServiceResult('test_service', false, 1000);
      
      expect(healthMonitor.getServiceMetrics('test_service')?.requestCount).toBe(1);
      
      // Reset metrics
      healthMonitor.resetAllMetrics();
      
      // Service should be back to initial state
      const metrics = healthMonitor.getServiceMetrics('test_service');
      expect(metrics?.requestCount).toBe(0);
      
      const status = healthMonitor.getServiceHealth('test_service');
      expect(status?.status).toBe('unknown');
    });
  });
});