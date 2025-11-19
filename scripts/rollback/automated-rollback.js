#!/usr/bin/env node

/**
 * Automated Rollback System
 * Claude Skills Integration - CreativeBridge
 * 
 * Handles automatic rollback scenarios based on monitoring triggers
 * Task 8.3: Production Deployment Preparation - Automated Rollback
 */

const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const fs = require('fs').promises;
const path = require('path');

class AutomatedRollbackSystem {
  constructor() {
    this.config = {
      environment: process.env.NODE_ENV || 'production',
      monitoringEndpoint: process.env.MONITORING_ENDPOINT || 'https://monitoring.creativebridge.app',
      rollbackThresholds: {
        criticalErrorRate: 0.05, // 5%
        claudeSkillsFailureRate: 0.20, // 20%
        responseTimeP95: 5000, // 5 seconds
        memoryUsageThreshold: 0.95, // 95%
        continuousFailureDuration: 300000, // 5 minutes
      },
      rollbackStrategies: {
        immediate: 'disable-claude-skills',
        staged: 'gradual-feature-disable',
        full: 'complete-application-rollback',
      },
      notificationChannels: {
        pager: process.env.PAGERDUTY_URL,
        slack: process.env.SLACK_WEBHOOK_URL,
        email: process.env.EMAIL_NOTIFICATION_URL,
      },
    };
    
    this.rollbackHistory = [];
    this.isRollbackInProgress = false;
    this.monitoringInterval = null;
  }

  /**
   * Initialize the automated rollback system
   */
  async initialize() {
    try {
      console.log('Initializing Automated Rollback System...');
      
      // Validate configuration
      await this.validateConfiguration();
      
      // Set up monitoring
      await this.setupMonitoring();
      
      // Register signal handlers for graceful shutdown
      this.setupSignalHandlers();
      
      console.log('Automated Rollback System initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize rollback system:', error);
      throw error;
    }
  }

  /**
   * Validate system configuration
   */
  async validateConfiguration() {
    const requiredEnvVars = [
      'MONITORING_ENDPOINT',
      'PAGERDUTY_URL',
      'SLACK_WEBHOOK_URL',
      'EMAIL_NOTIFICATION_URL',
    ];

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`Required environment variable ${envVar} is not set`);
      }
    }

    // Verify monitoring endpoint accessibility
    try {
      const { stdout } = await exec(`curl -f ${this.config.monitoringEndpoint}/health`);
      console.log('Monitoring endpoint validated');
    } catch (error) {
      throw new Error(`Monitoring endpoint not accessible: ${error.message}`);
    }
  }

  /**
   * Set up continuous monitoring for rollback triggers
   */
  async setupMonitoring() {
    console.log('Setting up continuous monitoring...');
    
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkRollbackTriggers();
      } catch (error) {
        console.error('Error in monitoring cycle:', error);
      }
    }, 30000); // Check every 30 seconds

    console.log('Continuous monitoring enabled');
  }

  /**
   * Check for conditions that should trigger rollback
   */
  async checkRollbackTriggers() {
    if (this.isRollbackInProgress) {
      return; // Don't trigger multiple rollbacks
    }

    try {
      const metrics = await this.collectMetrics();
      const triggers = await this.evaluateTriggers(metrics);

      if (triggers.length > 0) {
        console.log('Rollback triggers detected:', triggers);
        await this.executeRollback(triggers);
      }
    } catch (error) {
      console.error('Error checking rollback triggers:', error);
    }
  }

  /**
   * Collect current system metrics
   */
  async collectMetrics() {
    try {
      const metricsEndpoint = `${this.config.monitoringEndpoint}/api/v1/query`;
      
      // Collect multiple metrics in parallel
      const [errorRate, claudeSkillsHealth, responseTime, memoryUsage] = await Promise.all([
        this.queryMetric('rate(http_requests_total{status=~"5.."}[5m])'),
        this.queryMetric('claude_skills_success_rate'),
        this.queryMetric('http_request_duration_seconds{quantile="0.95"}'),
        this.queryMetric('memory_usage_percentage'),
      ]);

      return {
        errorRate: parseFloat(errorRate) || 0,
        claudeSkillsSuccessRate: parseFloat(claudeSkillsHealth) || 100,
        responseTimeP95: parseFloat(responseTime) || 0,
        memoryUsage: parseFloat(memoryUsage) || 0,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('Error collecting metrics:', error);
      return null;
    }
  }

  /**
   * Query a specific metric from monitoring system
   */
  async queryMetric(query) {
    try {
      const { stdout } = await exec(
        `curl -s "${this.config.monitoringEndpoint}/api/v1/query?query=${encodeURIComponent(query)}" | jq -r '.data.result[0].value[1]'`
      );
      return stdout.trim();
    } catch (error) {
      console.error(`Error querying metric ${query}:`, error);
      return '0';
    }
  }

  /**
   * Evaluate if current metrics trigger rollback conditions
   */
  async evaluateTriggers(metrics) {
    if (!metrics) return [];

    const triggers = [];
    const thresholds = this.config.rollbackThresholds;

    // Critical error rate trigger
    if (metrics.errorRate > thresholds.criticalErrorRate) {
      triggers.push({
        type: 'critical_error_rate',
        severity: 'critical',
        strategy: 'immediate',
        message: `Error rate ${(metrics.errorRate * 100).toFixed(2)}% exceeds threshold ${(thresholds.criticalErrorRate * 100)}%`,
        metrics: { errorRate: metrics.errorRate },
      });
    }

    // Claude Skills failure trigger
    const claudeFailureRate = 100 - metrics.claudeSkillsSuccessRate;
    if (claudeFailureRate > thresholds.claudeSkillsFailureRate * 100) {
      triggers.push({
        type: 'claude_skills_failure',
        severity: 'high',
        strategy: 'staged',
        message: `Claude Skills failure rate ${claudeFailureRate.toFixed(2)}% exceeds threshold ${(thresholds.claudeSkillsFailureRate * 100)}%`,
        metrics: { claudeSkillsSuccessRate: metrics.claudeSkillsSuccessRate },
      });
    }

    // Response time trigger
    if (metrics.responseTimeP95 > thresholds.responseTimeP95) {
      triggers.push({
        type: 'performance_degradation',
        severity: 'high',
        strategy: 'staged',
        message: `95th percentile response time ${metrics.responseTimeP95}ms exceeds threshold ${thresholds.responseTimeP95}ms`,
        metrics: { responseTimeP95: metrics.responseTimeP95 },
      });
    }

    // Memory usage trigger
    if (metrics.memoryUsage > thresholds.memoryUsageThreshold) {
      triggers.push({
        type: 'memory_exhaustion',
        severity: 'critical',
        strategy: 'immediate',
        message: `Memory usage ${(metrics.memoryUsage * 100).toFixed(2)}% exceeds threshold ${(thresholds.memoryUsageThreshold * 100)}%`,
        metrics: { memoryUsage: metrics.memoryUsage },
      });
    }

    return triggers;
  }

  /**
   * Execute rollback based on triggers
   */
  async executeRollback(triggers) {
    this.isRollbackInProgress = true;
    const rollbackId = this.generateRollbackId();

    try {
      console.log(`Starting rollback ${rollbackId} due to triggers:`, triggers.map(t => t.type));

      // Send immediate notifications
      await this.sendNotifications(triggers, rollbackId, 'started');

      // Determine rollback strategy
      const strategy = this.determineRollbackStrategy(triggers);
      
      // Execute rollback based on strategy
      const rollbackResult = await this.performRollback(strategy, triggers, rollbackId);

      // Record rollback history
      this.recordRollback(rollbackId, triggers, strategy, rollbackResult);

      // Send completion notifications
      await this.sendNotifications(triggers, rollbackId, 'completed', rollbackResult);

      console.log(`Rollback ${rollbackId} completed successfully`);
    } catch (error) {
      console.error(`Rollback ${rollbackId} failed:`, error);
      await this.sendNotifications(triggers, rollbackId, 'failed', { error: error.message });
    } finally {
      this.isRollbackInProgress = false;
    }
  }

  /**
   * Determine the appropriate rollback strategy
   */
  determineRollbackStrategy(triggers) {
    const criticalTriggers = triggers.filter(t => t.severity === 'critical');
    
    if (criticalTriggers.length > 0) {
      return 'immediate';
    }
    
    const claudeTriggers = triggers.filter(t => t.type === 'claude_skills_failure');
    if (claudeTriggers.length > 0) {
      return 'staged';
    }
    
    return 'staged';
  }

  /**
   * Perform the actual rollback
   */
  async performRollback(strategy, triggers, rollbackId) {
    const startTime = Date.now();
    console.log(`Executing ${strategy} rollback strategy...`);

    try {
      switch (strategy) {
        case 'immediate':
          return await this.executeImmediateRollback(triggers, rollbackId);
        
        case 'staged':
          return await this.executeStagedRollback(triggers, rollbackId);
          
        case 'full':
          return await this.executeFullRollback(triggers, rollbackId);
          
        default:
          throw new Error(`Unknown rollback strategy: ${strategy}`);
      }
    } catch (error) {
      console.error('Rollback execution failed:', error);
      throw error;
    }
  }

  /**
   * Execute immediate rollback (disable Claude Skills)
   */
  async executeImmediateRollback(triggers, rollbackId) {
    console.log('Executing immediate rollback - disabling Claude Skills...');

    const steps = [
      {
        name: 'disable_claude_skills',
        command: 'npm run feature-flags:emergency-disable -- --service=claude-skills --rollback-id=' + rollbackId,
      },
      {
        name: 'verify_fallback',
        command: 'npm run fallback:verify -- --environment=production',
      },
      {
        name: 'health_check',
        command: 'npm run health-check:comprehensive -- --post-rollback',
      },
    ];

    const results = [];
    for (const step of steps) {
      try {
        const { stdout, stderr } = await exec(step.command);
        results.push({
          step: step.name,
          status: 'success',
          output: stdout,
          error: stderr,
        });
        console.log(`Step ${step.name} completed successfully`);
      } catch (error) {
        results.push({
          step: step.name,
          status: 'failed',
          error: error.message,
        });
        console.error(`Step ${step.name} failed:`, error.message);
        throw new Error(`Immediate rollback failed at step ${step.name}`);
      }
    }

    return {
      strategy: 'immediate',
      steps: results,
      duration: Date.now() - Date.now(),
      success: true,
    };
  }

  /**
   * Execute staged rollback (gradual feature disable)
   */
  async executeStagedRollback(triggers, rollbackId) {
    console.log('Executing staged rollback - gradual feature disable...');

    const stages = [
      {
        name: 'reduce_traffic',
        command: 'npm run feature-flags:update -- --rollout-percentage=25',
        waitTime: 60000, // 1 minute
      },
      {
        name: 'minimal_traffic',
        command: 'npm run feature-flags:update -- --rollout-percentage=5',
        waitTime: 60000,
      },
      {
        name: 'disable_completely',
        command: 'npm run feature-flags:emergency-disable -- --service=claude-skills',
        waitTime: 30000,
      },
    ];

    const results = [];
    for (const stage of stages) {
      try {
        const { stdout, stderr } = await exec(stage.command);
        results.push({
          stage: stage.name,
          status: 'success',
          output: stdout,
        });
        
        console.log(`Stage ${stage.name} completed, waiting ${stage.waitTime}ms...`);
        await this.sleep(stage.waitTime);
        
        // Check if metrics improved
        const metrics = await this.collectMetrics();
        const remainingTriggers = await this.evaluateTriggers(metrics);
        
        if (remainingTriggers.length === 0) {
          console.log('Metrics improved, stopping staged rollback');
          break;
        }
      } catch (error) {
        results.push({
          stage: stage.name,
          status: 'failed',
          error: error.message,
        });
        throw new Error(`Staged rollback failed at stage ${stage.name}`);
      }
    }

    return {
      strategy: 'staged',
      stages: results,
      duration: Date.now() - Date.now(),
      success: true,
    };
  }

  /**
   * Execute full application rollback
   */
  async executeFullRollback(triggers, rollbackId) {
    console.log('Executing full application rollback...');

    const steps = [
      {
        name: 'create_backup',
        command: 'npm run backup:create -- --pre-rollback --rollback-id=' + rollbackId,
      },
      {
        name: 'rollback_application',
        command: 'npm run deploy:rollback -- --version=previous --environment=production',
      },
      {
        name: 'verify_health',
        command: 'npm run health-check:comprehensive -- --post-rollback',
      },
      {
        name: 'verify_functionality',
        command: 'npm run test:smoke -- --environment=production',
      },
    ];

    const results = [];
    for (const step of steps) {
      try {
        const { stdout, stderr } = await exec(step.command);
        results.push({
          step: step.name,
          status: 'success',
          output: stdout,
        });
        console.log(`Step ${step.name} completed successfully`);
      } catch (error) {
        results.push({
          step: step.name,
          status: 'failed',
          error: error.message,
        });
        throw new Error(`Full rollback failed at step ${step.name}`);
      }
    }

    return {
      strategy: 'full',
      steps: results,
      duration: Date.now() - Date.now(),
      success: true,
    };
  }

  /**
   * Send notifications about rollback events
   */
  async sendNotifications(triggers, rollbackId, status, result = null) {
    const message = this.createNotificationMessage(triggers, rollbackId, status, result);
    
    const notifications = [];
    
    // Send to appropriate channels based on severity
    const hasCritical = triggers.some(t => t.severity === 'critical');
    
    if (hasCritical) {
      notifications.push(this.sendPagerNotification(message));
    }
    
    notifications.push(this.sendSlackNotification(message));
    notifications.push(this.sendEmailNotification(message));

    try {
      await Promise.all(notifications);
      console.log('Notifications sent successfully');
    } catch (error) {
      console.error('Error sending notifications:', error);
    }
  }

  /**
   * Create notification message
   */
  createNotificationMessage(triggers, rollbackId, status, result) {
    const triggerList = triggers.map(t => `- ${t.type}: ${t.message}`).join('\n');
    
    let message = `🚨 ROLLBACK ${status.toUpperCase()}: ${rollbackId}\n\n`;
    message += `Environment: ${this.config.environment}\n`;
    message += `Timestamp: ${new Date().toISOString()}\n\n`;
    message += `Triggers:\n${triggerList}\n\n`;
    
    if (result) {
      message += `Result: ${result.success ? '✅ Success' : '❌ Failed'}\n`;
      if (result.duration) {
        message += `Duration: ${Math.round(result.duration / 1000)}s\n`;
      }
      if (result.error) {
        message += `Error: ${result.error}\n`;
      }
    }

    return message;
  }

  /**
   * Send pager notification
   */
  async sendPagerNotification(message) {
    try {
      const payload = {
        incident_key: `rollback_${Date.now()}`,
        event_type: 'trigger',
        description: message.substring(0, 1024), // PagerDuty limit
        client: 'CreativeBridge Rollback System',
        client_url: this.config.monitoringEndpoint,
      };

      const { stdout } = await exec(`curl -X POST "${this.config.notificationChannels.pager}" \
        -H "Content-Type: application/json" \
        -d '${JSON.stringify(payload)}'`);

      console.log('Pager notification sent');
    } catch (error) {
      console.error('Failed to send pager notification:', error);
    }
  }

  /**
   * Send Slack notification
   */
  async sendSlackNotification(message) {
    try {
      const payload = {
        text: message,
        username: 'Rollback System',
        icon_emoji: ':warning:',
      };

      await exec(`curl -X POST "${this.config.notificationChannels.slack}" \
        -H "Content-Type: application/json" \
        -d '${JSON.stringify(payload)}'`);

      console.log('Slack notification sent');
    } catch (error) {
      console.error('Failed to send Slack notification:', error);
    }
  }

  /**
   * Send email notification
   */
  async sendEmailNotification(message) {
    try {
      const payload = {
        subject: `CreativeBridge Rollback Alert`,
        body: message,
        priority: 'high',
      };

      await exec(`curl -X POST "${this.config.notificationChannels.email}" \
        -H "Content-Type: application/json" \
        -d '${JSON.stringify(payload)}'`);

      console.log('Email notification sent');
    } catch (error) {
      console.error('Failed to send email notification:', error);
    }
  }

  /**
   * Record rollback in history
   */
  recordRollback(rollbackId, triggers, strategy, result) {
    const record = {
      id: rollbackId,
      timestamp: Date.now(),
      triggers: triggers.map(t => ({ type: t.type, severity: t.severity, message: t.message })),
      strategy,
      result,
      environment: this.config.environment,
    };

    this.rollbackHistory.push(record);

    // Keep only last 100 rollbacks in memory
    if (this.rollbackHistory.length > 100) {
      this.rollbackHistory.shift();
    }

    // Persist to file
    this.persistRollbackHistory();
  }

  /**
   * Persist rollback history to file
   */
  async persistRollbackHistory() {
    try {
      const historyFile = path.join(__dirname, '../../logs/rollback-history.json');
      await fs.writeFile(historyFile, JSON.stringify(this.rollbackHistory, null, 2));
    } catch (error) {
      console.error('Failed to persist rollback history:', error);
    }
  }

  /**
   * Generate unique rollback ID
   */
  generateRollbackId() {
    return `rb_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  setupSignalHandlers() {
    const shutdown = async (signal) => {
      console.log(`Received ${signal}, shutting down gracefully...`);
      
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
      }
      
      if (this.isRollbackInProgress) {
        console.log('Waiting for rollback to complete...');
        // Wait up to 5 minutes for rollback to complete
        const timeout = setTimeout(() => {
          console.log('Rollback timeout, forcing shutdown');
          process.exit(1);
        }, 300000);
        
        while (this.isRollbackInProgress) {
          await this.sleep(1000);
        }
        
        clearTimeout(timeout);
      }
      
      console.log('Automated Rollback System shutdown complete');
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }

  /**
   * Get rollback history
   */
  getRollbackHistory() {
    return this.rollbackHistory;
  }

  /**
   * Get current system status
   */
  getSystemStatus() {
    return {
      isInitialized: this.monitoringInterval !== null,
      isRollbackInProgress: this.isRollbackInProgress,
      environment: this.config.environment,
      lastCheck: new Date().toISOString(),
      rollbackCount: this.rollbackHistory.length,
    };
  }
}

// CLI interface
if (require.main === module) {
  const rollbackSystem = new AutomatedRollbackSystem();
  
  rollbackSystem.initialize()
    .then(() => {
      console.log('Automated Rollback System is running...');
      console.log('Press Ctrl+C to stop');
    })
    .catch((error) => {
      console.error('Failed to start Automated Rollback System:', error);
      process.exit(1);
    });
}

module.exports = AutomatedRollbackSystem;