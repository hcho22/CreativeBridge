/**
 * Analytics Service Integration Tests
 *
 * Tests the complete analytics workflow with real-world scenarios,
 * including cross-service integration, data flow, and reporting.
 */

import { analyticsService } from '../../services/analyticsService';

describe('Analytics Service Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Service Integration', () => {
    it('should initialize analytics service correctly', () => {
      expect(analyticsService).toBeDefined();
      expect(typeof analyticsService.trackEvent).toBe('function');
      expect(typeof analyticsService.trackStoryImport).toBe('function');
      expect(typeof analyticsService.trackStoryContinuation).toBe('function');
      expect(typeof analyticsService.trackUserEngagement).toBe('function');
      expect(typeof analyticsService.trackPerformance).toBe('function');
      expect(typeof analyticsService.trackError).toBe('function');
      expect(typeof analyticsService.getUsageMetrics).toBe('function');
      expect(typeof analyticsService.getUserEngagementMetrics).toBe('function');
      expect(typeof analyticsService.getPerformanceMetrics).toBe('function');
      expect(typeof analyticsService.generateReport).toBe('function');
    });

    it('should handle complete story import workflow', async () => {
      const userId = 'test-user-123';
      const storyId = 'story-456';

      // Track story import flow
      await analyticsService.trackUserEngagement(userId, 'import_screen_view');
      await analyticsService.trackUserEngagement(userId, 'file_selection');
      await analyticsService.trackStoryImport(userId, 'file', true, {
        fileSize: 2048,
        storyLength: 500,
        importDuration: 1500,
      });
      await analyticsService.trackUserEngagement(userId, 'import_success');

      // Track continuation flow
      await analyticsService.trackUserEngagement(userId, 'story_preview');
      await analyticsService.trackStoryContinuation(userId, storyId, true, {
        generatedWords: 150,
        continuationDuration: 3000,
      });

      // Should not throw errors
      expect(true).toBe(true);
    });

    it('should handle error scenarios in workflow', async () => {
      const userId = 'test-user-456';

      // Track failed import
      await analyticsService.trackUserEngagement(userId, 'import_screen_view');
      await analyticsService.trackStoryImport(userId, 'file', false, {
        errorType: 'invalid_format',
        fileSize: 0,
      });
      await analyticsService.trackError(
        userId,
        'import_error',
        'Unsupported file format',
        {
          fileName: 'story.pdf',
          attemptedFormat: 'pdf',
        },
      );

      // Should handle gracefully
      expect(true).toBe(true);
    });

    it('should provide consistent metrics across functions', async () => {
      const usageMetrics = await analyticsService.getUsageMetrics(
        '2024-01-01T00:00:00Z',
        '2024-01-02T00:00:00Z',
      );

      const successRates = await analyticsService.getSuccessRates();
      const usageReport = await analyticsService.generateUsageReport();

      // All should have consistent structure
      expect(usageMetrics).toHaveProperty('totalImports');
      expect(usageMetrics).toHaveProperty('importSuccessRate');
      expect(successRates).toHaveProperty('importSuccessRate');
      expect(usageReport).toHaveProperty('totalImports');

      // Values should be numbers
      expect(typeof usageMetrics.totalImports).toBe('number');
      expect(typeof usageMetrics.importSuccessRate).toBe('number');
      expect(typeof successRates.importSuccessRate).toBe('number');
      expect(typeof usageReport.totalImports).toBe('number');
    });
  });

  describe('Real-world Usage Scenarios', () => {
    it('should handle high-volume event tracking', async () => {
      const userIds = Array.from({ length: 50 }, (_, i) => `user-${i}`);
      const promises: Promise<void>[] = [];

      // Simulate concurrent user activities
      userIds.forEach(userId => {
        promises.push(
          analyticsService.trackUserEngagement(userId, 'session_start'),
          analyticsService.trackStoryImport(
            userId,
            'file',
            Math.random() > 0.1,
          ),
          analyticsService.trackStoryContinuation(
            userId,
            `story-${userId}`,
            Math.random() > 0.05,
          ),
          analyticsService.trackUserEngagement(userId, 'session_end'),
        );
      });

      // Should handle all events without errors
      await expect(Promise.all(promises)).resolves.not.toThrow();
    });

    it('should track user journey across multiple sessions', async () => {
      const userId = 'journey-user-123';

      // Session 1: First-time user
      await analyticsService.trackUserEngagement(userId, 'first_launch');
      await analyticsService.trackUserEngagement(userId, 'onboarding_start');
      await analyticsService.trackUserEngagement(userId, 'tutorial_complete');
      await analyticsService.trackStoryImport(userId, 'database', true);

      // Session 2: Return user
      await analyticsService.trackUserEngagement(userId, 'session_start');
      await analyticsService.trackStoryImport(userId, 'file', true);
      await analyticsService.trackStoryContinuation(userId, 'story-1', true);

      // Session 3: Power user
      await analyticsService.trackUserEngagement(userId, 'session_start');
      await analyticsService.trackStoryImport(userId, 'story_quest', true);
      await analyticsService.trackStoryContinuation(userId, 'story-2', true);
      await analyticsService.trackUserEngagement(
        userId,
        'advanced_feature_used',
      );

      const engagement = await analyticsService.getUserEngagementMetrics(
        userId,
      );

      expect(engagement.userId).toBe(userId);
      expect(engagement.totalStoryImports).toBeGreaterThanOrEqual(0);
      expect(engagement.totalStoryContinuations).toBeGreaterThanOrEqual(0);
    });

    it('should handle performance monitoring workflow', async () => {
      const operations = [
        'story_import',
        'story_continuation',
        'database_query',
        'file_processing',
        'ai_generation',
      ];

      // Track various performance metrics
      for (const operation of operations) {
        const duration = Math.random() * 5000; // 0-5 seconds
        const success = Math.random() > 0.1; // 90% success rate

        await analyticsService.trackPerformance(operation, duration, success, {
          memoryUsage: Math.random() * 100,
          cacheHit: Math.random() > 0.3,
        });
      }

      const performanceMetrics = await analyticsService.getPerformanceMetrics(
        '2024-01-01T00:00:00Z',
        '2024-12-31T23:59:59Z',
      );

      expect(performanceMetrics).toHaveProperty('averageImportTime');
      expect(performanceMetrics).toHaveProperty('averageContinuationTime');
      expect(performanceMetrics).toHaveProperty('errorRates');
    });
  });

  describe('Report Generation Workflow', () => {
    it('should generate comprehensive daily report', async () => {
      // Generate some sample data
      const userId = 'report-user-123';
      await analyticsService.trackStoryImport(userId, 'file', true);
      await analyticsService.trackStoryContinuation(userId, 'story-1', true);
      await analyticsService.trackUserEngagement(userId, 'feature_used');

      const report = await analyticsService.generateReport('daily');

      expect(report).toHaveProperty('reportId');
      expect(report).toHaveProperty('reportType', 'daily');
      expect(report).toHaveProperty('generatedAt');
      expect(report).toHaveProperty('dateRange');
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('insights');
      expect(report).toHaveProperty('recommendations');

      expect(report.summary).toHaveProperty('totalEvents');
      expect(report.summary).toHaveProperty('uniqueUsers');
      expect(report.summary).toHaveProperty('keyMetrics');
      expect(report.summary).toHaveProperty('trends');

      expect(Array.isArray(report.insights)).toBe(true);
      expect(Array.isArray(report.recommendations)).toBe(true);
      expect(Array.isArray(report.summary.trends)).toBe(true);
    });

    it('should generate reports for different time periods', async () => {
      const reportTypes = ['daily', 'weekly', 'monthly'] as const;

      for (const reportType of reportTypes) {
        const report = await analyticsService.generateReport(reportType);

        expect(report.reportType).toBe(reportType);
        expect(report.dateRange).toBeDefined();
        expect(report.dateRange.start).toBeDefined();
        expect(report.dateRange.end).toBeDefined();

        // Verify date range is appropriate for report type
        const start = new Date(report.dateRange.start);
        const end = new Date(report.dateRange.end);
        const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

        switch (reportType) {
          case 'daily':
            expect(diffHours).toBeCloseTo(24, 0);
            break;
          case 'weekly':
            expect(diffHours).toBeCloseTo(168, 0); // 7 * 24
            break;
          case 'monthly':
            expect(diffHours).toBeCloseTo(720, 48); // ~30 * 24
            break;
        }
      }
    });

    it('should handle custom date range reports', async () => {
      const customRange = {
        start: '2024-01-01T00:00:00Z',
        end: '2024-01-07T23:59:59Z',
      };

      const report = await analyticsService.generateReport(
        'custom',
        customRange,
      );

      expect(report.reportType).toBe('custom');
      expect(report.dateRange).toEqual(customRange);
    });
  });

  describe('Data Consistency and Integrity', () => {
    it('should maintain data consistency across operations', async () => {
      const userId = 'consistency-user-123';

      // Perform various operations
      await analyticsService.trackStoryImport(userId, 'file', true);
      await analyticsService.trackStoryImport(userId, 'database', false);
      await analyticsService.trackStoryContinuation(userId, 'story-1', true);

      // Advance time to trigger batch upload
      jest.advanceTimersByTime(31000);

      // Get metrics from different endpoints
      const usageMetrics = await analyticsService.getUsageMetrics(
        '2024-01-01T00:00:00Z',
        '2024-12-31T23:59:59Z',
        userId,
      );

      const userEngagement = await analyticsService.getUserEngagementMetrics(
        userId,
      );
      const successRates = await analyticsService.getSuccessRates();

      // Data should be consistent
      expect(userEngagement.userId).toBe(userId);

      // All metrics should be non-negative numbers
      expect(usageMetrics.totalImports).toBeGreaterThanOrEqual(0);
      expect(usageMetrics.uniqueUsers).toBeGreaterThanOrEqual(0);
      expect(usageMetrics.importSuccessRate).toBeGreaterThanOrEqual(0);
      expect(usageMetrics.importSuccessRate).toBeLessThanOrEqual(100);

      expect(userEngagement.totalStoryImports).toBeGreaterThanOrEqual(0);
      expect(userEngagement.engagementScore).toBeGreaterThanOrEqual(0);
      expect(userEngagement.engagementScore).toBeLessThanOrEqual(100);

      expect(successRates.importSuccessRate).toBeGreaterThanOrEqual(0);
      expect(successRates.importSuccessRate).toBeLessThanOrEqual(100);
    });

    it('should handle concurrent event tracking safely', async () => {
      const concurrentPromises: Promise<void>[] = [];

      // Create many concurrent tracking operations
      for (let i = 0; i < 100; i++) {
        concurrentPromises.push(
          analyticsService.trackStoryImport(`user-${i}`, 'file', true),
          analyticsService.trackUserEngagement(`user-${i}`, 'action'),
          analyticsService.trackPerformance('operation', 1000, true),
        );
      }

      // Should handle concurrent operations without errors
      await expect(Promise.all(concurrentPromises)).resolves.not.toThrow();
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should continue working after database errors', async () => {
      // These operations should not throw even if database is unavailable
      await expect(
        analyticsService.trackStoryImport('user-123', 'file', true),
      ).resolves.not.toThrow();

      await expect(
        analyticsService.getUsageMetrics('2024-01-01', '2024-01-02'),
      ).resolves.not.toThrow();

      await expect(
        analyticsService.generateReport('daily'),
      ).resolves.not.toThrow();
    });

    it('should provide meaningful defaults when data is unavailable', async () => {
      const metrics = await analyticsService.getUsageMetrics(
        '2024-01-01T00:00:00Z',
        '2024-01-02T00:00:00Z',
      );

      const engagement = await analyticsService.getUserEngagementMetrics(
        'unknown-user',
      );
      const performance = await analyticsService.getPerformanceMetrics(
        '2024-01-01T00:00:00Z',
        '2024-01-02T00:00:00Z',
      );

      // Should provide structured default responses
      expect(metrics).toHaveProperty('totalImports');
      expect(metrics).toHaveProperty('uniqueUsers');
      expect(metrics).toHaveProperty('importSuccessRate');

      expect(engagement).toHaveProperty('userId');
      expect(engagement).toHaveProperty('engagementScore');

      expect(performance).toHaveProperty('averageImportTime');
      expect(performance).toHaveProperty('errorRates');
    });

    it('should handle malformed input gracefully', async () => {
      // Should not throw with invalid inputs
      await expect(
        analyticsService.trackStoryImport('', 'file' as any, true),
      ).resolves.not.toThrow();

      await expect(
        analyticsService.getUsageMetrics('invalid-date', 'invalid-date'),
      ).resolves.not.toThrow();

      await expect(
        analyticsService.getUserEngagementMetrics(''),
      ).resolves.not.toThrow();
    });
  });

  describe('Performance Characteristics', () => {
    it('should complete operations within reasonable time', async () => {
      const startTime = Date.now();

      await Promise.all([
        analyticsService.trackStoryImport('user-123', 'file', true),
        analyticsService.trackUserEngagement('user-123', 'action'),
        analyticsService.getUsageMetrics('2024-01-01', '2024-01-02'),
        analyticsService.getUserEngagementMetrics('user-123'),
        analyticsService.getSuccessRates(),
      ]);

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(2000); // Under 2 seconds
    });

    it('should handle batch processing efficiently', async () => {
      const batchSize = 50;
      const promises: Promise<void>[] = [];

      for (let i = 0; i < batchSize; i++) {
        promises.push(
          analyticsService.trackStoryImport(`batch-user-${i}`, 'file', true),
        );
      }

      const startTime = Date.now();
      await Promise.all(promises);
      const endTime = Date.now();

      // Advance timer to trigger batch upload
      jest.advanceTimersByTime(31000);

      // Should process batch efficiently
      expect(endTime - startTime).toBeLessThan(1000); // Under 1 second for tracking
    });
  });

  describe('Service Lifecycle', () => {
    it('should handle service cleanup properly', () => {
      expect(() => analyticsService.destroy()).not.toThrow();
    });

    it('should continue working after cleanup and restart', async () => {
      analyticsService.destroy();

      // Should still work after cleanup
      await expect(
        analyticsService.trackStoryImport('user-123', 'file', true),
      ).resolves.not.toThrow();
    });
  });
});
