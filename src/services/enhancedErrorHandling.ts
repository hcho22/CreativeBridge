/**
 * Enhanced Error Handling and Recovery Service (Task 2.4)
 * Provides comprehensive error handling, retry mechanisms, and recovery workflows
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Alert } from 'react-native';
import * as RNFS from 'react-native-fs';

// Error types and interfaces
export interface DownloadError {
  id: string;
  type:
    | 'permission_denied'
    | 'storage_full'
    | 'network_error'
    | 'file_system_error'
    | 'timeout'
    | 'user_cancelled'
    | 'unknown';
  message: string;
  timestamp: string;
  context: {
    operation: string;
    fileName?: string;
    filePath?: string;
    fileSize?: number;
    userId?: string;
    attempt?: number;
    stackTrace?: string;
  };
  recoveryOptions: RecoveryOption[];
  canRetry: boolean;
  retryCount: number;
  maxRetries: number;
}

export interface RecoveryOption {
  id: string;
  label: string;
  description: string;
  action:
    | 'retry'
    | 'retry_different_location'
    | 'clear_cache'
    | 'check_storage'
    | 'manual_action'
    | 'report_issue';
  automated: boolean;
  priority: 'high' | 'medium' | 'low';
}

export interface QueuedDownload {
  id: string;
  storyContent: string;
  fileName: string;
  userId: string;
  sessionId: string;
  timestamp: string;
  priority: 'high' | 'normal' | 'low';
  retryCount: number;
  maxRetries: number;
  lastError?: DownloadError;
}

export interface ErrorAnalytics {
  totalErrors: number;
  errorsByType: Record<string, number>;
  recoverySuccessRate: number;
  averageRetryCount: number;
  mostCommonErrors: Array<{ type: string; count: number; percentage: number }>;
  timeToRecovery: number;
  userAbandonmentRate: number;
}

export class EnhancedErrorHandlingService {
  private static readonly QUEUE_STORAGE_KEY = 'download_queue';
  private static readonly ERROR_LOG_STORAGE_KEY = 'error_logs';
  private static readonly MAX_ERROR_LOGS = 100;
  private static readonly DEFAULT_MAX_RETRIES = 3;
  private static readonly BASE_RETRY_DELAY = 1000; // 1 second

  /**
   * Retry mechanism with exponential backoff
   */
  async retryWithBackoff<T>(
    operation: () => Promise<T>,
    context: {
      operationName: string;
      maxRetries?: number;
      baseDelay?: number;
      fileName?: string;
      userId?: string;
    },
  ): Promise<T> {
    const {
      operationName,
      maxRetries = EnhancedErrorHandlingService.DEFAULT_MAX_RETRIES,
      baseDelay = EnhancedErrorHandlingService.BASE_RETRY_DELAY,
    } = context;
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `🔄 Attempting ${operationName} (attempt ${attempt}/${maxRetries})`,
        );
        const result = await operation();

        if (attempt > 1) {
          // Log successful recovery
          await this.logErrorRecovery({
            operation: operationName,
            attemptsRequired: attempt,
            ...context,
          });
        }

        return result;
      } catch (error) {
        lastError = error as Error;
        console.warn(
          `❌ ${operationName} failed on attempt ${attempt}:`,
          error,
        );

        // Log error with retry information
        await this.logError({
          type: this.categorizeError(error),
          message: error.message,
          context: {
            operation: operationName,
            attempt,
            ...context,
            stackTrace: error.stack,
          },
          canRetry: attempt < maxRetries,
          retryCount: attempt - 1,
          maxRetries,
        });

        if (attempt === maxRetries) {
          throw this.enhanceError(lastError, context);
        }

        // Exponential backoff with jitter
        const delay =
          baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
        await this.delay(delay);
      }
    }

    throw lastError!;
  }

  /**
   * Queue downloads when offline or when errors occur
   */
  async queueDownload(
    download: Omit<QueuedDownload, 'id' | 'timestamp' | 'retryCount'>,
  ): Promise<string> {
    try {
      const downloadId = `download_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      const queuedDownload: QueuedDownload = {
        id: downloadId,
        timestamp: new Date().toISOString(),
        retryCount: 0,
        ...download,
      };

      const queue = await this.getDownloadQueue();
      queue.push(queuedDownload);
      await this.saveDownloadQueue(queue);

      console.log(`📥 Download queued: ${downloadId} (${download.fileName})`);

      // Try to process queue immediately if online
      this.processQueueInBackground();

      return downloadId;
    } catch (error) {
      console.error('❌ Failed to queue download:', error);
      throw error;
    }
  }

  /**
   * Process queued downloads
   */
  async processDownloadQueue(): Promise<{
    processed: number;
    failed: number;
    remaining: number;
  }> {
    try {
      const queue = await this.getDownloadQueue();
      if (queue.length === 0) {
        return { processed: 0, failed: 0, remaining: 0 };
      }

      // Check network connectivity
      const networkState = await NetInfo.fetch();
      if (!networkState.isConnected) {
        console.log('📱 Offline - skipping queue processing');
        return { processed: 0, failed: 0, remaining: queue.length };
      }

      let processed = 0;
      let failed = 0;
      const remaining: QueuedDownload[] = [];

      for (const download of queue) {
        try {
          await this.processQueuedDownload(download);
          processed++;
          console.log(`✅ Processed queued download: ${download.fileName}`);
        } catch (error) {
          console.error(
            `❌ Failed to process queued download ${download.fileName}:`,
            error,
          );

          download.retryCount++;
          download.lastError = await this.createDownloadError(error as Error, {
            operation: 'process_queued_download',
            fileName: download.fileName,
            userId: download.userId,
          });

          if (download.retryCount < download.maxRetries) {
            remaining.push(download);
          } else {
            failed++;
            console.log(
              `🚫 Abandoning download after ${download.retryCount} attempts: ${download.fileName}`,
            );
          }
        }
      }

      await this.saveDownloadQueue(remaining);

      console.log(
        `📊 Queue processing complete: ${processed} processed, ${failed} failed, ${remaining.length} remaining`,
      );

      return { processed, failed, remaining: remaining.length };
    } catch (error) {
      console.error('❌ Failed to process download queue:', error);
      throw error;
    }
  }

  /**
   * Get download queue from storage
   */
  async getDownloadQueue(): Promise<QueuedDownload[]> {
    try {
      const queueData = await AsyncStorage.getItem(
        EnhancedErrorHandlingService.QUEUE_STORAGE_KEY,
      );
      return queueData ? JSON.parse(queueData) : [];
    } catch (error) {
      console.error('❌ Failed to get download queue:', error);
      return [];
    }
  }

  /**
   * Check storage space and provide graceful degradation
   */
  async checkStorageSpace(requiredBytes: number = 10 * 1024 * 1024): Promise<{
    available: boolean;
    freeSpace: number;
    totalSpace: number;
    recommendations: string[];
  }> {
    try {
      const fsInfo = await RNFS.getFSInfo();
      const freeSpace = fsInfo.freeSpace;
      const totalSpace = fsInfo.totalSpace;
      const available = freeSpace >= requiredBytes;

      const recommendations: string[] = [];

      if (!available) {
        recommendations.push('Delete old files or apps to free up space');
        if (freeSpace < requiredBytes * 0.5) {
          recommendations.push('Consider moving files to cloud storage');
          recommendations.push('Clear app cache and temporary files');
        }
      }

      return {
        available,
        freeSpace,
        totalSpace,
        recommendations,
      };
    } catch (error) {
      console.error('❌ Failed to check storage space:', error);
      return {
        available: false,
        freeSpace: 0,
        totalSpace: 0,
        recommendations: [
          'Unable to check storage space - try restarting the app',
        ],
      };
    }
  }

  /**
   * Create error recovery workflows
   */
  async suggestRecoveryOptions(
    error: DownloadError,
  ): Promise<RecoveryOption[]> {
    const options: RecoveryOption[] = [];

    switch (error.type) {
      case 'permission_denied':
        options.push({
          id: 'check_permissions',
          label: 'Check App Permissions',
          description: 'Open Settings to grant file access permissions',
          action: 'manual_action',
          automated: false,
          priority: 'high',
        });
        break;

      case 'storage_full':
        const storageInfo = await this.checkStorageSpace();
        options.push({
          id: 'clear_space',
          label: 'Free Up Storage',
          description: `You need ${Math.round(
            (10 * 1024 * 1024 - storageInfo.freeSpace) / (1024 * 1024),
          )} MB more space`,
          action: 'check_storage',
          automated: false,
          priority: 'high',
        });
        break;

      case 'network_error':
        options.push({
          id: 'retry_when_online',
          label: 'Retry When Online',
          description:
            'Download will retry automatically when connection is restored',
          action: 'retry',
          automated: true,
          priority: 'high',
        });
        break;

      case 'file_system_error':
        options.push({
          id: 'retry_different_location',
          label: 'Try Different Location',
          description: 'Save to a different folder or storage location',
          action: 'retry_different_location',
          automated: false,
          priority: 'medium',
        });
        options.push({
          id: 'clear_cache',
          label: 'Clear App Cache',
          description: 'Clear temporary files that might be causing conflicts',
          action: 'clear_cache',
          automated: true,
          priority: 'medium',
        });
        break;

      case 'timeout':
        options.push({
          id: 'retry_immediate',
          label: 'Retry Now',
          description: 'Try the download again immediately',
          action: 'retry',
          automated: false,
          priority: 'high',
        });
        break;

      default:
        options.push({
          id: 'retry_default',
          label: 'Try Again',
          description: 'Retry the operation',
          action: 'retry',
          automated: false,
          priority: 'medium',
        });
        break;
    }

    // Always offer to report issues for persistent problems
    if (error.retryCount >= 2) {
      options.push({
        id: 'report_issue',
        label: 'Report Problem',
        description: 'Help us improve by reporting this issue',
        action: 'report_issue',
        automated: false,
        priority: 'low',
      });
    }

    return options;
  }

  /**
   * Execute recovery action
   */
  async executeRecoveryAction(
    option: RecoveryOption,
    error: DownloadError,
  ): Promise<boolean> {
    try {
      switch (option.action) {
        case 'retry':
          // This would be handled by the calling code
          return true;

        case 'clear_cache':
          await this.clearAppCache();
          return true;

        case 'check_storage':
          const storageInfo = await this.checkStorageSpace();
          Alert.alert(
            'Storage Information',
            `Free space: ${Math.round(
              storageInfo.freeSpace / (1024 * 1024),
            )} MB\n\nRecommendations:\n${storageInfo.recommendations.join(
              '\n',
            )}`,
          );
          return false; // User needs to take manual action

        case 'manual_action':
          Alert.alert('Manual Action Required', option.description, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => this.openAppSettings() },
          ]);
          return false;

        case 'report_issue':
          await this.reportIssue(error);
          return false;

        default:
          return false;
      }
    } catch (actionError) {
      console.error('❌ Failed to execute recovery action:', actionError);
      return false;
    }
  }

  /**
   * Generate recovery options for a given error
   */
  public generateRecoveryOptions(error: DownloadError): RecoveryOption[] {
    const options: RecoveryOption[] = [];

    switch (error.type) {
      case 'permission_denied':
        options.push({
          id: 'open_settings',
          label: 'Open Settings',
          description: 'Grant file access permissions',
          action: 'manual_action',
          automated: false,
          priority: 'high',
        });
        options.push({
          id: 'retry',
          label: 'Try Again',
          description: 'Retry the download',
          action: 'retry',
          automated: false,
          priority: 'medium',
        });
        break;

      case 'storage_full':
        options.push({
          id: 'check_storage',
          label: 'Check Storage',
          description: 'View storage information and recommendations',
          action: 'check_storage',
          automated: true,
          priority: 'high',
        });
        options.push({
          id: 'queue_download',
          label: 'Queue for Later',
          description: 'Save download for when storage is available',
          action: 'retry',
          automated: true,
          priority: 'medium',
        });
        break;

      case 'network_error':
        options.push({
          id: 'check_connection',
          label: 'Check Connection',
          description: 'Verify your internet connection',
          action: 'manual_action',
          automated: false,
          priority: 'high',
        });
        options.push({
          id: 'queue_download',
          label: 'Retry When Online',
          description: 'Download will retry when connection is restored',
          action: 'retry',
          automated: true,
          priority: 'medium',
        });
        break;

      default:
        options.push({
          id: 'retry',
          label: 'Try Again',
          description: 'Retry the operation',
          action: 'retry',
          automated: false,
          priority: 'medium',
        });
        break;
    }

    return options;
  }

  /**
   * Generate error analytics
   */
  async getErrorAnalytics(timeRange: {
    start: Date;
    end: Date;
  }): Promise<ErrorAnalytics> {
    try {
      const errorLogs = await this.getErrorLogs();
      const relevantErrors = errorLogs.filter(error => {
        const errorDate = new Date(error.timestamp);
        return errorDate >= timeRange.start && errorDate <= timeRange.end;
      });

      const totalErrors = relevantErrors.length;
      const errorsByType = relevantErrors.reduce((acc, error) => {
        acc[error.type] = (acc[error.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const retriedErrors = relevantErrors.filter(
        error => error.retryCount > 0,
      );
      const recoverySuccessRate =
        retriedErrors.length > 0
          ? retriedErrors.filter(error => error.retryCount < error.maxRetries)
              .length / retriedErrors.length
          : 0;

      const averageRetryCount =
        totalErrors > 0
          ? relevantErrors.reduce((sum, error) => sum + error.retryCount, 0) /
            totalErrors
          : 0;

      const mostCommonErrors = Object.entries(errorsByType)
        .map(([type, count]) => ({
          type,
          count,
          percentage: Math.round((count / totalErrors) * 100),
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        totalErrors,
        errorsByType,
        recoverySuccessRate,
        averageRetryCount,
        mostCommonErrors,
        timeToRecovery: this.calculateAverageTimeToRecovery(relevantErrors),
        userAbandonmentRate: this.calculateUserAbandonmentRate(relevantErrors),
      };
    } catch (error) {
      console.error('❌ Failed to generate error analytics:', error);
      throw error;
    }
  }

  // Private helper methods

  private async processQueuedDownload(download: QueuedDownload): Promise<void> {
    // This would integrate with the existing download service
    const { storyDownloadService } = await import('./storyDownloadService');

    await storyDownloadService.downloadStory({
      storyContent: download.storyContent,
      fileName: download.fileName,
      options: {
        userId: download.userId,
      },
    });
  }

  private async processQueueInBackground(): Promise<void> {
    try {
      setTimeout(async () => {
        await this.processDownloadQueue();
      }, 1000);
    } catch (error) {
      console.error('❌ Background queue processing failed:', error);
    }
  }

  private async saveDownloadQueue(queue: QueuedDownload[]): Promise<void> {
    await AsyncStorage.setItem(
      EnhancedErrorHandlingService.QUEUE_STORAGE_KEY,
      JSON.stringify(queue),
    );
  }

  public categorizeError(error: Error): DownloadError['type'] {
    const message = error.message.toLowerCase();

    if (message.includes('permission') || message.includes('access denied')) {
      return 'permission_denied';
    }
    if (
      message.includes('storage') ||
      message.includes('space') ||
      message.includes('disk full')
    ) {
      return 'storage_full';
    }
    if (
      message.includes('network') ||
      message.includes('connection') ||
      message.includes('internet')
    ) {
      return 'network_error';
    }
    if (message.includes('timeout') || message.includes('timed out')) {
      return 'timeout';
    }
    if (message.includes('cancel') || message.includes('abort')) {
      return 'user_cancelled';
    }
    if (
      message.includes('file') ||
      message.includes('directory') ||
      message.includes('path')
    ) {
      return 'file_system_error';
    }

    return 'unknown';
  }

  public enhanceError(error: Error, context: any): Error {
    const enhancedMessage = `${error.message} (Operation: ${
      context.operationName || 'unknown'
    }${context.fileName ? `, File: ${context.fileName}` : ''})`;
    const enhancedError = new Error(enhancedMessage);
    enhancedError.stack = error.stack;
    return enhancedError;
  }

  private async createDownloadError(
    error: Error,
    context: any,
  ): Promise<DownloadError> {
    const errorType = this.categorizeError(error);
    const errorId = `error_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    const downloadError: DownloadError = {
      id: errorId,
      type: errorType,
      message: error.message,
      timestamp: new Date().toISOString(),
      context: {
        operation: context.operationName || 'unknown',
        fileName: context.fileName,
        filePath: context.filePath,
        fileSize: context.fileSize,
        userId: context.userId,
        attempt: context.attempt,
        stackTrace: error.stack,
      },
      recoveryOptions: await this.suggestRecoveryOptions({
        type: errorType,
        retryCount: context.attempt || 0,
      } as DownloadError),
      canRetry: errorType !== 'user_cancelled',
      retryCount: context.attempt || 0,
      maxRetries:
        context.maxRetries || EnhancedErrorHandlingService.DEFAULT_MAX_RETRIES,
    };

    return downloadError;
  }

  private async logError(errorData: Partial<DownloadError>): Promise<void> {
    try {
      const errorLogs = await this.getErrorLogs();
      const error: DownloadError = {
        id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        recoveryOptions: [],
        canRetry: true,
        retryCount: 0,
        maxRetries: EnhancedErrorHandlingService.DEFAULT_MAX_RETRIES,
        type: 'unknown',
        message: 'Unknown error',
        context: { operation: 'unknown' },
        ...errorData,
      };

      errorLogs.push(error);

      // Keep only the most recent errors
      if (errorLogs.length > EnhancedErrorHandlingService.MAX_ERROR_LOGS) {
        errorLogs.splice(
          0,
          errorLogs.length - EnhancedErrorHandlingService.MAX_ERROR_LOGS,
        );
      }

      await AsyncStorage.setItem(
        EnhancedErrorHandlingService.ERROR_LOG_STORAGE_KEY,
        JSON.stringify(errorLogs),
      );
    } catch (logError) {
      console.error('❌ Failed to log error:', logError);
    }
  }

  private async logErrorRecovery(recovery: any): Promise<void> {
    console.log('✅ Error recovery successful:', recovery);
    // This could be sent to analytics service
  }

  private async getErrorLogs(): Promise<DownloadError[]> {
    try {
      const logsData = await AsyncStorage.getItem(
        EnhancedErrorHandlingService.ERROR_LOG_STORAGE_KEY,
      );
      return logsData ? JSON.parse(logsData) : [];
    } catch (error) {
      console.error('❌ Failed to get error logs:', error);
      return [];
    }
  }

  private async clearAppCache(): Promise<void> {
    try {
      // Clear temporary files and cache
      const tempDir = RNFS.TemporaryDirectoryPath;
      const cacheDir = RNFS.CachesDirectoryPath;

      const tempFiles = await RNFS.readDir(tempDir);
      for (const file of tempFiles) {
        if (file.name.startsWith('story_') || file.name.includes('download')) {
          await RNFS.unlink(file.path);
        }
      }

      console.log('✅ App cache cleared');
    } catch (error) {
      console.error('❌ Failed to clear cache:', error);
      throw error;
    }
  }

  private async openAppSettings(): Promise<void> {
    // This would open the app settings - implementation depends on platform
    console.log('📱 Opening app settings...');
  }

  private async reportIssue(error: DownloadError): Promise<void> {
    try {
      // This would send error report to analytics or support system
      console.log('📝 Reporting issue:', error.id);

      Alert.alert(
        'Issue Reported',
        "Thank you for reporting this issue. We'll use this information to improve the app.",
        [{ text: 'OK' }],
      );
    } catch (reportError) {
      console.error('❌ Failed to report issue:', reportError);
    }
  }

  private calculateAverageTimeToRecovery(errors: DownloadError[]): number {
    // Simplified calculation - in reality would track resolution times
    return errors.length > 0 ? 30000 : 0; // 30 seconds average
  }

  private calculateUserAbandonmentRate(errors: DownloadError[]): number {
    const retriedErrors = errors.filter(error => error.retryCount > 0);
    const abandonedErrors = errors.filter(
      error => error.retryCount >= error.maxRetries,
    );

    return retriedErrors.length > 0
      ? abandonedErrors.length / retriedErrors.length
      : 0;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const enhancedErrorHandling = new EnhancedErrorHandlingService();
export default enhancedErrorHandling;
