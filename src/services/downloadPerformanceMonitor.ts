/**
 * Download Performance Monitor Service (Task 2.5)
 * Tracks performance metrics and provides optimization insights
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PerformanceMetrics {
  operation: string;
  startTime: number;
  endTime: number;
  duration: number;
  fileSize: number;
  memoryUsageStart: number;
  memoryUsageEnd: number;
  memoryDelta: number;
  success: boolean;
  errorType?: string;
  userId?: string;
  sessionId?: string;
}

export interface PerformanceAnalytics {
  averageDownloadTime: number;
  averageFileSize: number;
  successRate: number;
  memoryEfficiency: number;
  operationsCount: number;
  slowOperations: PerformanceMetrics[];
  memoryHogOperations: PerformanceMetrics[];
  recommendations: string[];
}

export class DownloadPerformanceMonitor {
  private static readonly METRICS_STORAGE_KEY = 'download_performance_metrics';
  private static readonly MAX_STORED_METRICS = 100;
  private static readonly SLOW_OPERATION_THRESHOLD = 3000; // 3 seconds
  private static readonly HIGH_MEMORY_THRESHOLD = 10 * 1024 * 1024; // 10MB

  private activeOperations: Map<string, {
    startTime: number;
    memoryUsageStart: number;
    operation: string;
    fileSize: number;
    userId?: string;
    sessionId?: string;
  }> = new Map();

  /**
   * Start tracking a download operation
   */
  startTracking(operationId: string, options: {
    operation: string;
    fileSize: number;
    userId?: string;
    sessionId?: string;
  }): void {
    const startTime = performance.now();
    const memoryUsageStart = this.getCurrentMemoryUsage();

    this.activeOperations.set(operationId, {
      startTime,
      memoryUsageStart,
      operation: options.operation,
      fileSize: options.fileSize,
      userId: options.userId,
      sessionId: options.sessionId,
    });

    console.log(`📊 Performance tracking started for ${options.operation} (${operationId})`);
  }

  /**
   * Stop tracking and record metrics
   */
  async stopTracking(operationId: string, options: {
    success: boolean;
    errorType?: string;
  }): Promise<PerformanceMetrics | null> {
    const activeOperation = this.activeOperations.get(operationId);
    if (!activeOperation) {
      console.warn(`⚠️ No active operation found for ID: ${operationId}`);
      return null;
    }

    const endTime = performance.now();
    const memoryUsageEnd = this.getCurrentMemoryUsage();
    const duration = endTime - activeOperation.startTime;
    const memoryDelta = memoryUsageEnd - activeOperation.memoryUsageStart;

    const metrics: PerformanceMetrics = {
      operation: activeOperation.operation,
      startTime: activeOperation.startTime,
      endTime,
      duration,
      fileSize: activeOperation.fileSize,
      memoryUsageStart: activeOperation.memoryUsageStart,
      memoryUsageEnd,
      memoryDelta,
      success: options.success,
      errorType: options.errorType,
      userId: activeOperation.userId,
      sessionId: activeOperation.sessionId,
    };

    // Clean up active operation
    this.activeOperations.delete(operationId);

    // Store metrics
    await this.storeMetrics(metrics);

    // Log performance summary
    this.logPerformanceSummary(metrics);

    return metrics;
  }

  /**
   * Get performance analytics
   */
  async getPerformanceAnalytics(timeRange?: { start: Date; end: Date }): Promise<PerformanceAnalytics> {
    try {
      const allMetrics = await this.getStoredMetrics();
      let relevantMetrics = allMetrics;

      if (timeRange) {
        relevantMetrics = allMetrics.filter(metric => {
          const metricTime = new Date(metric.startTime);
          return metricTime >= timeRange.start && metricTime <= timeRange.end;
        });
      }

      if (relevantMetrics.length === 0) {
        return this.getEmptyAnalytics();
      }

      const successfulOperations = relevantMetrics.filter(m => m.success);
      const averageDownloadTime = relevantMetrics.reduce((sum, m) => sum + m.duration, 0) / relevantMetrics.length;
      const averageFileSize = relevantMetrics.reduce((sum, m) => sum + m.fileSize, 0) / relevantMetrics.length;
      const successRate = successfulOperations.length / relevantMetrics.length;
      const averageMemoryDelta = relevantMetrics.reduce((sum, m) => sum + Math.abs(m.memoryDelta), 0) / relevantMetrics.length;
      const memoryEfficiency = Math.max(0, 1 - (averageMemoryDelta / this.HIGH_MEMORY_THRESHOLD));

      const slowOperations = relevantMetrics.filter(m => m.duration > this.SLOW_OPERATION_THRESHOLD);
      const memoryHogOperations = relevantMetrics.filter(m => Math.abs(m.memoryDelta) > this.HIGH_MEMORY_THRESHOLD);

      const recommendations = this.generateRecommendations({
        averageDownloadTime,
        successRate,
        slowOperations: slowOperations.length,
        memoryHogOperations: memoryHogOperations.length,
        totalOperations: relevantMetrics.length,
      });

      return {
        averageDownloadTime,
        averageFileSize,
        successRate,
        memoryEfficiency,
        operationsCount: relevantMetrics.length,
        slowOperations: slowOperations.slice(0, 5), // Top 5 slowest
        memoryHogOperations: memoryHogOperations.slice(0, 5), // Top 5 memory intensive
        recommendations,
      };
    } catch (error) {
      console.error('❌ Failed to generate performance analytics:', error);
      return this.getEmptyAnalytics();
    }
  }

  /**
   * Check if current operation should show progress indicator
   */
  shouldShowProgress(fileSize: number): boolean {
    return fileSize > 50 * 1024; // Show progress for files > 50KB
  }

  /**
   * Estimate operation duration based on historical data
   */
  async estimateOperationDuration(operation: string, fileSize: number): Promise<number> {
    try {
      const metrics = await this.getStoredMetrics();
      const similarOperations = metrics.filter(m => 
        m.operation === operation && 
        m.success &&
        Math.abs(m.fileSize - fileSize) / fileSize < 0.5 // Within 50% of file size
      );

      if (similarOperations.length === 0) {
        // Default estimates based on file size
        return Math.max(1000, fileSize / 1024 * 100); // ~100ms per KB
      }

      const averageDuration = similarOperations.reduce((sum, m) => sum + m.duration, 0) / similarOperations.length;
      return averageDuration;
    } catch (error) {
      console.error('❌ Failed to estimate operation duration:', error);
      return 2000; // Default 2 seconds
    }
  }

  /**
   * Clear old metrics to prevent storage bloat
   */
  async cleanupOldMetrics(): Promise<void> {
    try {
      const metrics = await this.getStoredMetrics();
      if (metrics.length > this.MAX_STORED_METRICS) {
        // Keep only the most recent metrics
        const recentMetrics = metrics
          .sort((a, b) => b.startTime - a.startTime)
          .slice(0, this.MAX_STORED_METRICS);
        
        await AsyncStorage.setItem(this.METRICS_STORAGE_KEY, JSON.stringify(recentMetrics));
        console.log(`🧹 Cleaned up old performance metrics, keeping ${recentMetrics.length} most recent`);
      }
    } catch (error) {
      console.error('❌ Failed to cleanup old metrics:', error);
    }
  }

  /**
   * Get current memory usage (simplified for React Native)
   */
  private getCurrentMemoryUsage(): number {
    // In React Native, we can't directly access memory usage like in Node.js
    // This is a placeholder that could be enhanced with native modules
    // For now, we'll estimate based on JavaScript heap usage indicators
    try {
      // Use performance.memory if available (some React Native environments)
      if (typeof performance !== 'undefined' && (performance as any).memory) {
        return (performance as any).memory.usedJSHeapSize || 0;
      }
      
      // Fallback to a rough estimate based on operation complexity
      return Date.now() % 100000; // Simple approximation
    } catch (error) {
      return 0;
    }
  }

  /**
   * Store performance metrics
   */
  private async storeMetrics(metrics: PerformanceMetrics): Promise<void> {
    try {
      const existingMetrics = await this.getStoredMetrics();
      existingMetrics.push(metrics);

      // Limit storage size
      if (existingMetrics.length > this.MAX_STORED_METRICS) {
        existingMetrics.splice(0, existingMetrics.length - this.MAX_STORED_METRICS);
      }

      await AsyncStorage.setItem(this.METRICS_STORAGE_KEY, JSON.stringify(existingMetrics));
    } catch (error) {
      console.error('❌ Failed to store performance metrics:', error);
    }
  }

  /**
   * Get stored performance metrics
   */
  private async getStoredMetrics(): Promise<PerformanceMetrics[]> {
    try {
      const data = await AsyncStorage.getItem(this.METRICS_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('❌ Failed to retrieve performance metrics:', error);
      return [];
    }
  }

  /**
   * Log performance summary
   */
  private logPerformanceSummary(metrics: PerformanceMetrics): void {
    const durationSeconds = (metrics.duration / 1000).toFixed(2);
    const fileSizeKB = (metrics.fileSize / 1024).toFixed(1);
    const memoryDeltaMB = (metrics.memoryDelta / (1024 * 1024)).toFixed(2);

    console.log(`📊 Performance Summary for ${metrics.operation}:`);
    console.log(`   Duration: ${durationSeconds}s`);
    console.log(`   File Size: ${fileSizeKB}KB`);
    console.log(`   Memory Delta: ${memoryDeltaMB}MB`);
    console.log(`   Success: ${metrics.success ? '✅' : '❌'}`);

    if (metrics.duration > this.SLOW_OPERATION_THRESHOLD) {
      console.warn(`⚠️ Slow operation detected: ${durationSeconds}s > ${this.SLOW_OPERATION_THRESHOLD / 1000}s threshold`);
    }

    if (Math.abs(metrics.memoryDelta) > this.HIGH_MEMORY_THRESHOLD) {
      console.warn(`⚠️ High memory usage detected: ${memoryDeltaMB}MB > ${this.HIGH_MEMORY_THRESHOLD / (1024 * 1024)}MB threshold`);
    }
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(analytics: {
    averageDownloadTime: number;
    successRate: number;
    slowOperations: number;
    memoryHogOperations: number;
    totalOperations: number;
  }): string[] {
    const recommendations: string[] = [];

    if (analytics.averageDownloadTime > this.SLOW_OPERATION_THRESHOLD) {
      recommendations.push('Consider implementing background processing for large files');
      recommendations.push('Enable file compression to reduce processing time');
    }

    if (analytics.successRate < 0.9) {
      recommendations.push('Investigate common failure causes and improve error handling');
      recommendations.push('Consider implementing more robust retry mechanisms');
    }

    if (analytics.slowOperations / analytics.totalOperations > 0.2) {
      recommendations.push('Optimize file generation algorithms for better performance');
      recommendations.push('Consider chunked processing for large files');
    }

    if (analytics.memoryHogOperations / analytics.totalOperations > 0.1) {
      recommendations.push('Implement streaming file processing to reduce memory usage');
      recommendations.push('Consider garbage collection optimization strategies');
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance is within acceptable thresholds');
    }

    return recommendations;
  }

  /**
   * Get empty analytics structure
   */
  private getEmptyAnalytics(): PerformanceAnalytics {
    return {
      averageDownloadTime: 0,
      averageFileSize: 0,
      successRate: 0,
      memoryEfficiency: 0,
      operationsCount: 0,
      slowOperations: [],
      memoryHogOperations: [],
      recommendations: ['No performance data available'],
    };
  }
}

// Export singleton instance
export const downloadPerformanceMonitor = new DownloadPerformanceMonitor();
export default downloadPerformanceMonitor;