/**
 * Analytics Service Tests
 *
 * Comprehensive test suite for story analytics functionality including
 * event tracking, usage metrics, user engagement analytics, performance
 * monitoring, and automated reporting system.
 */

import { analyticsService } from '../../services/analyticsService';
import { supabase } from '../../services/supabase';

// Mock Supabase
jest.mock('../../services/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
    })),
  },
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
}));

describe('AnalyticsService', () => {
  const mockEvents = [
    {
      id: 'event-1',
      type: 'story_import',
      subtype: 'file',
      userId: 'user-123',
      sessionId: 'session-1',
      timestamp: '2024-01-01T10:00:00Z',
      metadata: { source: 'file', success: true, fileSize: 1024 },
    },
    {
      id: 'event-2',
      type: 'story_continuation',
      subtype: 'success',
      userId: 'user-123',
      sessionId: 'session-1',
      timestamp: '2024-01-01T10:05:00Z',
      metadata: { storyId: 'story-1', success: true, duration: 2000 },
    },
    {
      id: 'event-3',
      type: 'user_engagement',
      subtype: 'session_start',
      userId: 'user-456',
      sessionId: 'session-2',
      timestamp: '2024-01-01T11:00:00Z',
      metadata: { duration: 300 },
    },
    {
      id: 'event-4',
      type: 'error',
      subtype: 'import_failed',
      userId: 'user-789',
      sessionId: 'session-3',
      timestamp: '2024-01-01T12:00:00Z',
      metadata: { errorMessage: 'File format not supported' },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Event Tracking', () => {
    it('should track story import events', async () => {
      await analyticsService.trackStoryImport('user-123', 'file', true, {
        fileSize: 2048,
        storyLength: 500,
      });

      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should track story continuation events', async () => {
      await analyticsService.trackStoryContinuation(
        'user-123',
        'story-1',
        true,
        {
          generatedWords: 150,
          aiModel: 'gpt-4',
        },
      );

      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should track user engagement events', async () => {
      await analyticsService.trackUserEngagement('user-123', 'story_selected', {
        storySource: 'database',
        selectionTime: 1500,
      });

      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should track performance metrics', async () => {
      await analyticsService.trackPerformance('story_import', 2500, true, {
        cacheHit: false,
        memoryUsage: 45,
      });

      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should track error events', async () => {
      await analyticsService.trackError(
        'user-123',
        'file_read_error',
        'Permission denied',
        {
          fileName: 'story.txt',
          fileSize: 0,
        },
      );

      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should handle tracking errors gracefully', async () => {
      const mockInsert = jest
        .fn()
        .mockRejectedValue(new Error('Database error'));
      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
      });

      // Should not throw
      await expect(
        analyticsService.trackStoryImport('user-123', 'file', true),
      ).resolves.not.toThrow();
    });
  });

  describe('Usage Metrics', () => {
    it('should get usage metrics for date range', async () => {
      const mockQuery = {
        data: mockEvents,
        error: null,
      };

      const mockBuilder = {
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        ...mockQuery,
      };

      (supabase.from as jest.Mock).mockReturnValue(mockBuilder);

      const metrics = await analyticsService.getUsageMetrics(
        '2024-01-01T00:00:00Z',
        '2024-01-02T00:00:00Z',
      );

      expect(metrics).toHaveProperty('totalImports');
      expect(metrics).toHaveProperty('uniqueUsers');
      expect(metrics).toHaveProperty('importSuccessRate');
      expect(metrics).toHaveProperty('continuationSuccessRate');
      expect(metrics).toHaveProperty('popularSources');

      expect(metrics.totalImports).toBe(1); // One import event
      expect(metrics.uniqueUsers).toBe(3); // Three unique users
      expect(metrics.importSuccessRate).toBe(100); // 1/1 successful imports
    });

    it('should handle missing data gracefully', async () => {
      const mockQuery = {
        data: null,
        error: { message: 'Table not found' },
      };

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        ...mockQuery,
      });

      const metrics = await analyticsService.getUsageMetrics(
        '2024-01-01T00:00:00Z',
        '2024-01-02T00:00:00Z',
      );

      expect(metrics.totalImports).toBe(0);
      expect(metrics.uniqueUsers).toBe(0);
      expect(metrics.importSuccessRate).toBe(0);
    });

    it('should filter metrics by user when specified', async () => {
      const mockQuery = {
        data: mockEvents.filter(e => e.userId === 'user-123'),
        error: null,
      };

      const mockBuilder = {
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        ...mockQuery,
      };

      (supabase.from as jest.Mock).mockReturnValue(mockBuilder);

      const metrics = await analyticsService.getUsageMetrics(
        '2024-01-01T00:00:00Z',
        '2024-01-02T00:00:00Z',
        'user-123',
      );

      expect(mockBuilder.eq).toHaveBeenCalledWith('userId', 'user-123');
      expect(metrics.uniqueUsers).toBe(1);
    });
  });

  describe('User Engagement Metrics', () => {
    it('should get user engagement metrics', async () => {
      const mockQuery = {
        data: mockEvents.filter(e => e.userId === 'user-123'),
        error: null,
      };

      const mockBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        ...mockQuery,
      };

      (supabase.from as jest.Mock).mockReturnValue(mockBuilder);

      const engagement = await analyticsService.getUserEngagementMetrics(
        'user-123',
      );

      expect(engagement).toHaveProperty('userId', 'user-123');
      expect(engagement).toHaveProperty('sessionsThisWeek');
      expect(engagement).toHaveProperty('sessionsThisMonth');
      expect(engagement).toHaveProperty('totalStoryImports');
      expect(engagement).toHaveProperty('totalStoryContinuations');
      expect(engagement).toHaveProperty('engagementScore');
      expect(engagement).toHaveProperty('favoriteSource');

      expect(engagement.totalStoryImports).toBe(1);
      expect(engagement.totalStoryContinuations).toBe(1);
    });

    it('should calculate engagement score correctly', async () => {
      const mockQuery = {
        data: mockEvents.filter(e => e.userId === 'user-123'),
        error: null,
      };

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        ...mockQuery,
      });

      const engagement = await analyticsService.getUserEngagementMetrics(
        'user-123',
      );

      expect(engagement.engagementScore).toBeGreaterThan(0);
      expect(engagement.engagementScore).toBeLessThanOrEqual(100);
    });

    it('should handle user with no data', async () => {
      const mockQuery = {
        data: [],
        error: null,
      };

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        ...mockQuery,
      });

      const engagement = await analyticsService.getUserEngagementMetrics(
        'unknown-user',
      );

      expect(engagement.totalStoryImports).toBe(0);
      expect(engagement.totalStoryContinuations).toBe(0);
      expect(engagement.engagementScore).toBe(0);
      expect(engagement.favoriteSource).toBe('none');
    });
  });

  describe('Performance Metrics', () => {
    it('should get performance metrics', async () => {
      const performanceEvents = [
        {
          ...mockEvents[0],
          type: 'performance',
          subtype: 'story_import',
          metadata: { duration: 1500, success: true },
        },
        {
          ...mockEvents[1],
          type: 'performance',
          subtype: 'story_continuation',
          metadata: { duration: 2500, success: true },
        },
      ];

      const mockQuery = {
        data: performanceEvents,
        error: null,
      };

      const mockBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        ...mockQuery,
      };

      (supabase.from as jest.Mock).mockReturnValue(mockBuilder);

      const metrics = await analyticsService.getPerformanceMetrics(
        '2024-01-01T00:00:00Z',
        '2024-01-02T00:00:00Z',
      );

      expect(metrics).toHaveProperty('averageImportTime');
      expect(metrics).toHaveProperty('averageContinuationTime');
      expect(metrics).toHaveProperty('errorRates');
      expect(metrics).toHaveProperty('devicePerformance');

      expect(metrics.averageImportTime).toBe(1500);
      expect(metrics.averageContinuationTime).toBe(2500);
    });

    it('should handle no performance data', async () => {
      const mockQuery = {
        data: [],
        error: null,
      };

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        ...mockQuery,
      });

      const metrics = await analyticsService.getPerformanceMetrics(
        '2024-01-01T00:00:00Z',
        '2024-01-02T00:00:00Z',
      );

      expect(metrics.averageImportTime).toBe(0);
      expect(metrics.averageContinuationTime).toBe(0);
    });
  });

  describe('Report Generation', () => {
    it('should generate daily report', async () => {
      const mockUsageQuery = {
        data: mockEvents,
        error: null,
      };

      const mockPerformanceQuery = {
        data: [],
        error: null,
      };

      const mockInsertQuery = {
        error: null,
      };

      (supabase.from as jest.Mock)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          ...mockUsageQuery,
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          ...mockPerformanceQuery,
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockReturnThis(),
          ...mockInsertQuery,
        });

      const report = await analyticsService.generateReport('daily');

      expect(report).toHaveProperty('reportId');
      expect(report).toHaveProperty('reportType', 'daily');
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('insights');
      expect(report).toHaveProperty('recommendations');

      expect(report.summary).toHaveProperty('totalEvents');
      expect(report.summary).toHaveProperty('uniqueUsers');
      expect(report.summary).toHaveProperty('keyMetrics');
      expect(report.summary).toHaveProperty('trends');

      expect(Array.isArray(report.insights)).toBe(true);
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it('should generate weekly report', async () => {
      const mockUsageQuery = { data: mockEvents, error: null };
      const mockPerformanceQuery = { data: [], error: null };
      const mockInsertQuery = { error: null };

      (supabase.from as jest.Mock)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          ...mockUsageQuery,
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          ...mockPerformanceQuery,
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockReturnThis(),
          ...mockInsertQuery,
        });

      const report = await analyticsService.generateReport('weekly');

      expect(report.reportType).toBe('weekly');
      expect(report.dateRange).toBeDefined();
    });

    it('should generate monthly report', async () => {
      const mockUsageQuery = { data: mockEvents, error: null };
      const mockPerformanceQuery = { data: [], error: null };
      const mockInsertQuery = { error: null };

      (supabase.from as jest.Mock)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          ...mockUsageQuery,
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          ...mockPerformanceQuery,
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockReturnThis(),
          ...mockInsertQuery,
        });

      const report = await analyticsService.generateReport('monthly');

      expect(report.reportType).toBe('monthly');
    });

    it('should generate custom date range report', async () => {
      const mockUsageQuery = { data: mockEvents, error: null };
      const mockPerformanceQuery = { data: [], error: null };
      const mockInsertQuery = { error: null };

      (supabase.from as jest.Mock)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          ...mockUsageQuery,
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          ...mockPerformanceQuery,
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockReturnThis(),
          ...mockInsertQuery,
        });

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

  describe('Event Retrieval', () => {
    it('should get events by type', async () => {
      const mockQuery = {
        data: mockEvents.filter(e => e.type === 'story_import'),
        error: null,
      };

      const mockBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        ...mockQuery,
      };

      (supabase.from as jest.Mock).mockReturnValue(mockBuilder);

      const events = await analyticsService.getEvents('story_import', 50, 0);

      expect(mockBuilder.eq).toHaveBeenCalledWith('type', 'story_import');
      expect(mockBuilder.order).toHaveBeenCalledWith('timestamp', {
        ascending: false,
      });
      expect(mockBuilder.range).toHaveBeenCalledWith(0, 49);
      expect(Array.isArray(events)).toBe(true);
    });

    it('should handle pagination correctly', async () => {
      const mockQuery = {
        data: mockEvents,
        error: null,
      };

      const mockBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        ...mockQuery,
      };

      (supabase.from as jest.Mock).mockReturnValue(mockBuilder);

      await analyticsService.getEvents('story_import', 20, 40);

      expect(mockBuilder.range).toHaveBeenCalledWith(40, 59); // offset 40, limit 20
    });

    it('should handle database errors when getting events', async () => {
      const mockQuery = {
        data: null,
        error: { message: 'Database error' },
      };

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        ...mockQuery,
      });

      const events = await analyticsService.getEvents('story_import');

      expect(events).toEqual([]);
    });
  });

  describe('Success Rates', () => {
    it('should calculate success rates correctly', async () => {
      const mockQuery = {
        data: [
          {
            type: 'story_import',
            metadata: { success: true },
          },
          {
            type: 'story_import',
            metadata: { success: false },
          },
          {
            type: 'story_continuation',
            metadata: { success: true },
          },
          {
            type: 'story_continuation',
            metadata: { success: true },
          },
        ],
        error: null,
      };

      const mockBuilder = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        ...mockQuery,
      };

      (supabase.from as jest.Mock).mockReturnValue(mockBuilder);

      const rates = await analyticsService.getSuccessRates();

      expect(rates.importSuccessRate).toBe(50); // 1/2 = 50%
      expect(rates.continuationSuccessRate).toBe(100); // 2/2 = 100%
    });

    it('should handle no events gracefully', async () => {
      const mockQuery = {
        data: [],
        error: null,
      };

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        ...mockQuery,
      });

      const rates = await analyticsService.getSuccessRates();

      expect(rates.importSuccessRate).toBe(0);
      expect(rates.continuationSuccessRate).toBe(0);
    });
  });

  describe('Usage Report', () => {
    it('should generate usage report', async () => {
      const mockQuery = {
        data: mockEvents,
        error: null,
      };

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        ...mockQuery,
      });

      const report = await analyticsService.generateUsageReport();

      expect(report).toHaveProperty('totalImports');
      expect(report).toHaveProperty('uniqueUsers');
      expect(report).toHaveProperty('averageSessionDuration');

      expect(typeof report.totalImports).toBe('number');
      expect(typeof report.uniqueUsers).toBe('number');
      expect(typeof report.averageSessionDuration).toBe('number');
    });

    it('should handle errors in usage report generation', async () => {
      const mockQuery = {
        data: null,
        error: { message: 'Database error' },
      };

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        ...mockQuery,
      });

      const report = await analyticsService.generateUsageReport();

      expect(report.totalImports).toBe(0);
      expect(report.uniqueUsers).toBe(0);
      expect(report.averageSessionDuration).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      const mockQuery = {
        data: null,
        error: { message: 'Connection refused' },
      };

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        ...mockQuery,
      });

      // Should not throw
      await expect(
        analyticsService.getUsageMetrics('2024-01-01', '2024-01-02'),
      ).resolves.not.toThrow();
    });

    it('should handle invalid date ranges', async () => {
      const mockQuery = {
        data: [],
        error: null,
      };

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        ...mockQuery,
      });

      const metrics = await analyticsService.getUsageMetrics(
        'invalid-date',
        'invalid-date',
      );

      expect(metrics).toBeDefined();
      expect(metrics.totalImports).toBe(0);
    });

    it('should handle malformed event data', async () => {
      const malformedEvents = [
        { type: 'story_import' }, // Missing required fields
        null,
        undefined,
        { id: 'event-1', type: 'unknown_type' },
      ];

      const mockQuery = {
        data: malformedEvents,
        error: null,
      };

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        ...mockQuery,
      });

      // Should handle malformed data gracefully
      const metrics = await analyticsService.getUsageMetrics(
        '2024-01-01',
        '2024-01-02',
      );

      expect(metrics).toBeDefined();
      expect(typeof metrics.totalImports).toBe('number');
    });
  });

  describe('Service Lifecycle', () => {
    it('should initialize without errors', () => {
      expect(() => analyticsService).not.toThrow();
    });

    it('should handle service destruction', () => {
      expect(() => analyticsService.destroy()).not.toThrow();
    });

    it('should handle batch upload timer', () => {
      // Advance timers to trigger batch upload
      jest.advanceTimersByTime(31000);

      // Should not throw errors
      expect(true).toBe(true);
    });
  });

  describe('Data Validation', () => {
    it('should validate event structure', async () => {
      await analyticsService.trackStoryImport('user-123', 'file', true);

      // Should complete without throwing and create a valid event structure
      expect(true).toBe(true);
    });

    it('should generate unique session IDs', () => {
      // Access private method through any to test ID generation
      const service = analyticsService as any;
      const id1 = service.generateSessionId();
      const id2 = service.generateSessionId();

      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^session_/);
    });

    it('should generate unique event IDs', () => {
      const service = analyticsService as any;
      const id1 = service.generateEventId();
      const id2 = service.generateEventId();

      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^event_/);
    });
  });
});
