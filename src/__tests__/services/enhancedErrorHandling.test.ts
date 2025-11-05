/**
 * Enhanced Error Handling Service Tests (Task 2.4)
 * Comprehensive test suite for retry mechanisms, offline queueing, and error recovery
 */

import { enhancedErrorHandling, EnhancedErrorHandlingService } from '../../services/enhancedErrorHandling';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as RNFS from 'react-native-fs';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
}));

jest.mock('react-native-fs', () => ({
  getFSInfo: jest.fn(),
  DocumentDirectoryPath: '/test/documents',
  TemporaryDirectoryPath: '/test/temp',
  CachesDirectoryPath: '/test/cache',
  writeFile: jest.fn(),
  exists: jest.fn(),
  readDir: jest.fn(),
  unlink: jest.fn(),
}));

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(() => Promise.resolve({
      isConnected: true,
      type: 'wifi',
      isInternetReachable: true
    })),
    addEventListener: jest.fn(() => () => {}),
  },
}));

jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
}));

// Mock network monitor
jest.mock('../../services/networkMonitor', () => ({
  networkMonitor: {
    getCurrentStatus: jest.fn(() => ({
      isConnected: true,
      connectionType: 'wifi',
      isInternetReachable: true,
      strength: 'good'
    })),
    addListener: jest.fn(() => () => {}),
  }
}));

describe('EnhancedErrorHandlingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton state
    (enhancedErrorHandling as any).downloadQueue = [];
    (enhancedErrorHandling as any).processingQueue = false;
  });

  describe('Retry Mechanism with Exponential Backoff', () => {
    it('should succeed on first attempt when operation succeeds', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');

      const result = await enhancedErrorHandling.retryWithBackoff(
        mockOperation,
        {
          operationName: 'test_operation',
          maxRetries: 3,
          baseDelay: 100,
          userId: 'test-user',
        }
      );

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should retry with exponential backoff on failure', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValueOnce('success');

      const startTime = Date.now();
      const result = await enhancedErrorHandling.retryWithBackoff(
        mockOperation,
        {
          operationName: 'test_operation',
          maxRetries: 3,
          baseDelay: 50, // Reduced for faster tests
          userId: 'test-user',
        }
      );

      const duration = Date.now() - startTime;
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(3);
      // Should have some delay between retries
      expect(duration).toBeGreaterThan(50);
    });

    it('should throw enhanced error after max retries exceeded', async () => {
      const originalError = new Error('Persistent failure');
      const mockOperation = jest.fn().mockRejectedValue(originalError);

      await expect(
        enhancedErrorHandling.retryWithBackoff(
          mockOperation,
          {
            operationName: 'test_operation',
            maxRetries: 2,
            baseDelay: 10,
            userId: 'test-user',
            fileName: 'test.txt',
          }
        )
      ).rejects.toThrow('Persistent failure');

      expect(mockOperation).toHaveBeenCalledTimes(2);
    });

    it('should log error recovery on successful retry', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce('success');

      await enhancedErrorHandling.retryWithBackoff(
        mockOperation,
        {
          operationName: 'test_operation',
          maxRetries: 3,
          baseDelay: 10,
          userId: 'test-user',
        }
      );

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔄 Attempting test_operation (attempt 1/3)')
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔄 Attempting test_operation (attempt 2/3)')
      );

      logSpy.mockRestore();
    });
  });

  describe('Offline Download Queue', () => {
    beforeEach(() => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    });

    it('should queue download when offline', async () => {
      const downloadData = {
        storyContent: 'Test story content',
        fileName: 'test_story.txt',
        userId: 'test-user',
        sessionId: 'test-session',
        priority: 'normal' as const,
        maxRetries: 3,
      };

      const queueId = await enhancedErrorHandling.queueDownload(downloadData);

      expect(queueId).toBeDefined();
      expect(typeof queueId).toBe('string');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'download_queue',
        expect.stringContaining(queueId)
      );
    });

    it('should retrieve queued downloads', async () => {
      const mockQueue = [
        {
          id: 'test-queue-1',
          storyContent: 'Test content 1',
          fileName: 'test1.txt',
          userId: 'test-user',
          sessionId: 'session-1',
          priority: 'normal',
          maxRetries: 3,
          queuedAt: Date.now(),
          retryCount: 0,
        },
      ];

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockQueue));

      const queue = await enhancedErrorHandling.getDownloadQueue();

      expect(queue).toEqual(mockQueue);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('download_queue');
    });

    it('should process download queue successfully', async () => {
      const mockQueue = [
        {
          id: 'test-queue-1',
          storyContent: 'Test content 1',
          fileName: 'test1.txt',
          userId: 'test-user',
          sessionId: 'session-1',
          priority: 'high',
          maxRetries: 3,
          queuedAt: Date.now(),
          retryCount: 0,
        },
        {
          id: 'test-queue-2',
          storyContent: 'Test content 2',
          fileName: 'test2.txt',
          userId: 'test-user',
          sessionId: 'session-2',
          priority: 'normal',
          maxRetries: 3,
          queuedAt: Date.now(),
          retryCount: 1,
        },
      ];

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockQueue));
      (RNFS.writeFile as jest.Mock).mockResolvedValue(undefined);

      const result = await enhancedErrorHandling.processDownloadQueue();

      expect(result.processed).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.total).toBe(2);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('download_queue', '[]');
    });

    it('should handle queue processing failures gracefully', async () => {
      const mockQueue = [
        {
          id: 'test-queue-1',
          storyContent: 'Test content 1',
          fileName: 'test1.txt',
          userId: 'test-user',
          sessionId: 'session-1',
          priority: 'normal',
          maxRetries: 1,
          queuedAt: Date.now(),
          retryCount: 0,
        },
      ];

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockQueue));
      (RNFS.writeFile as jest.Mock).mockRejectedValue(new Error('File write failed'));

      const result = await enhancedErrorHandling.processDownloadQueue();

      expect(result.processed).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.total).toBe(1);
    });

    it('should prioritize high priority downloads', async () => {
      const processOrder: string[] = [];
      const mockProcessFunction = jest.fn().mockImplementation((download) => {
        processOrder.push(download.fileName);
        return Promise.resolve({ success: true });
      });

      // Mock the internal processing function
      (enhancedErrorHandling as any).processSingleDownload = mockProcessFunction;

      const mockQueue = [
        {
          id: 'test-queue-1',
          fileName: 'normal1.txt',
          priority: 'normal',
          queuedAt: Date.now() - 1000,
        },
        {
          id: 'test-queue-2',
          fileName: 'high1.txt',
          priority: 'high',
          queuedAt: Date.now() - 500,
        },
        {
          id: 'test-queue-3',
          fileName: 'normal2.txt',
          priority: 'normal',
          queuedAt: Date.now() - 800,
        },
      ];

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockQueue));

      await enhancedErrorHandling.processDownloadQueue();

      // High priority should be processed first
      expect(processOrder[0]).toBe('high1.txt');
    });
  });

  describe('Storage Space Validation', () => {
    it('should return available when sufficient space', async () => {
      (RNFS.getFSInfo as jest.Mock).mockResolvedValue({
        freeSpace: 1000000, // 1MB
        totalSpace: 2000000, // 2MB
      });

      const result = await enhancedErrorHandling.checkStorageSpace(500000); // 500KB

      expect(result.available).toBe(true);
      expect(result.freeSpace).toBe(1000000);
      expect(result.totalSpace).toBe(2000000);
      expect(result.recommendations).toEqual([]);
    });

    it('should return unavailable when insufficient space', async () => {
      (RNFS.getFSInfo as jest.Mock).mockResolvedValue({
        freeSpace: 100000, // 100KB
        totalSpace: 2000000, // 2MB
      });

      const result = await enhancedErrorHandling.checkStorageSpace(500000); // 500KB

      expect(result.available).toBe(false);
      expect(result.freeSpace).toBe(100000);
      expect(result.totalSpace).toBe(2000000);
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations[0]).toContain('Free up');
    });

    it('should handle storage info errors gracefully', async () => {
      (RNFS.getFSInfo as jest.Mock).mockRejectedValue(new Error('Storage access failed'));

      const result = await enhancedErrorHandling.checkStorageSpace(500000);

      expect(result.available).toBe(true); // Should default to available on error
      expect(result.freeSpace).toBe(0);
      expect(result.totalSpace).toBe(0);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Error Categorization', () => {
    it('should categorize permission errors', () => {
      const error = new Error('EACCES: permission denied');
      const category = enhancedErrorHandling.categorizeError(error);
      expect(category).toBe('permission_denied');
    });

    it('should categorize storage errors', () => {
      const error = new Error('ENOSPC: no space left on device');
      const category = enhancedErrorHandling.categorizeError(error);
      expect(category).toBe('storage_full');
    });

    it('should categorize network errors', () => {
      const error = new Error('Network request failed');
      const category = enhancedErrorHandling.categorizeError(error);
      expect(category).toBe('network_error');
    });

    it('should categorize timeout errors', () => {
      const error = new Error('Request timeout');
      const category = enhancedErrorHandling.categorizeError(error);
      expect(category).toBe('timeout');
    });

    it('should categorize file system errors', () => {
      const error = new Error('ENOENT: no such file or directory');
      const category = enhancedErrorHandling.categorizeError(error);
      expect(category).toBe('file_system_error');
    });

    it('should default to unknown for unrecognized errors', () => {
      const error = new Error('Some random error');
      const category = enhancedErrorHandling.categorizeError(error);
      expect(category).toBe('unknown');
    });
  });

  describe('Recovery Options Generation', () => {
    it('should generate recovery options for permission errors', () => {
      const error = {
        type: 'permission_denied' as const,
        message: 'Permission denied',
        timestamp: Date.now(),
        context: { operation: 'file_write', userId: 'test-user' },
        canRetry: true,
        retryCount: 0,
        maxRetries: 3,
        recoveryOptions: [],
      };

      const options = enhancedErrorHandling.generateRecoveryOptions(error);

      expect(options.length).toBeGreaterThan(0);
      expect(options.some(option => option.action === 'open_settings')).toBe(true);
      expect(options.some(option => option.action === 'retry')).toBe(true);
    });

    it('should generate recovery options for storage errors', () => {
      const error = {
        type: 'storage_full' as const,
        message: 'Storage full',
        timestamp: Date.now(),
        context: { operation: 'file_write', userId: 'test-user' },
        canRetry: true,
        retryCount: 0,
        maxRetries: 3,
        recoveryOptions: [],
      };

      const options = enhancedErrorHandling.generateRecoveryOptions(error);

      expect(options.length).toBeGreaterThan(0);
      expect(options.some(option => option.action === 'check_storage')).toBe(true);
      expect(options.some(option => option.action === 'queue_download')).toBe(true);
    });

    it('should generate recovery options for network errors', () => {
      const error = {
        type: 'network_error' as const,
        message: 'Network error',
        timestamp: Date.now(),
        context: { operation: 'network_request', userId: 'test-user' },
        canRetry: true,
        retryCount: 0,
        maxRetries: 3,
        recoveryOptions: [],
      };

      const options = enhancedErrorHandling.generateRecoveryOptions(error);

      expect(options.length).toBeGreaterThan(0);
      expect(options.some(option => option.action === 'check_connection')).toBe(true);
      expect(options.some(option => option.action === 'queue_download')).toBe(true);
    });
  });

  describe('Error Logging and Analytics', () => {
    it('should log errors with context', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await enhancedErrorHandling.logError({
        type: 'network_error',
        message: 'Test network error',
        context: {
          operation: 'test_operation',
          userId: 'test-user',
          fileName: 'test.txt',
        },
        canRetry: true,
        retryCount: 1,
        maxRetries: 3,
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🚨 Error logged:'),
        expect.objectContaining({
          type: 'network_error',
          message: 'Test network error',
        })
      );

      consoleSpy.mockRestore();
    });

    it('should log error recovery events', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await enhancedErrorHandling.logErrorRecovery({
        operation: 'test_operation',
        attemptsRequired: 3,
        userId: 'test-user',
        fileName: 'test.txt',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ Error recovery successful:'),
        expect.objectContaining({
          operation: 'test_operation',
          attemptsRequired: 3,
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Enhanced Error Creation', () => {
    it('should enhance error with additional context', () => {
      const originalError = new Error('Original error message');
      const context = {
        operationName: 'test_operation',
        userId: 'test-user',
        fileName: 'test.txt',
        maxRetries: 3,
      };

      const enhancedError = enhancedErrorHandling.enhanceError(originalError, context);

      expect(enhancedError.message).toContain('Original error message');
      expect(enhancedError.message).toContain('test_operation');
      expect(enhancedError.message).toContain('test.txt');
    });

    it('should preserve original error stack trace', () => {
      const originalError = new Error('Original error');
      const originalStack = originalError.stack;
      
      const context = {
        operationName: 'test_operation',
        userId: 'test-user',
      };

      const enhancedError = enhancedErrorHandling.enhanceError(originalError, context);

      expect(enhancedError.stack).toBe(originalStack);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete error recovery workflow', async () => {
      let callCount = 0;
      const mockOperation = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          throw new Error('ENOSPC: no space left on device');
        }
        return Promise.resolve({ success: true, filePath: '/test/path' });
      });

      (RNFS.getFSInfo as jest.Mock)
        .mockResolvedValueOnce({ freeSpace: 100, totalSpace: 1000 }) // First call: no space
        .mockResolvedValue({ freeSpace: 1000000, totalSpace: 2000000 }); // Subsequent calls: space available

      const result = await enhancedErrorHandling.retryWithBackoff(
        mockOperation,
        {
          operationName: 'complete_download',
          maxRetries: 3,
          baseDelay: 10,
          userId: 'test-user',
          fileName: 'story.txt',
        }
      );

      expect(result).toEqual({ success: true, filePath: '/test/path' });
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });
  });
});