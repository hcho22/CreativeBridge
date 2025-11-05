/**
 * Enhanced Error Handling Service Simple Tests (Task 2.4)
 * Focused test suite for retry mechanisms, offline queueing, and error recovery
 */

import { enhancedErrorHandling } from '../../services/enhancedErrorHandling';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  readDir: jest.fn(() => Promise.resolve([])),
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

describe('Enhanced Error Handling Service - Simple Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset service state
    (enhancedErrorHandling as any).downloadQueue = [];
    (enhancedErrorHandling as any).processingQueue = false;
    
    // Default mocks
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  describe('Retry Mechanism', () => {
    it('should succeed on first attempt when operation succeeds', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');

      const result = await enhancedErrorHandling.retryWithBackoff(
        mockOperation,
        {
          operationName: 'test_operation',
          maxRetries: 3,
          baseDelay: 10,
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

      const result = await enhancedErrorHandling.retryWithBackoff(
        mockOperation,
        {
          operationName: 'test_operation',
          maxRetries: 3,
          baseDelay: 10,
          userId: 'test-user',
        }
      );

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });

    it('should throw error after max retries exceeded', async () => {
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
          }
        )
      ).rejects.toThrow();

      expect(mockOperation).toHaveBeenCalledTimes(2);
    });
  });

  describe('Queue Management', () => {
    it('should queue download', async () => {
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

    it('should retrieve empty queue when no items stored', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const queue = await enhancedErrorHandling.getDownloadQueue();

      expect(queue).toEqual([]);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('download_queue');
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
          timestamp: new Date().toISOString(),
          retryCount: 0,
        },
      ];

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockQueue));

      const queue = await enhancedErrorHandling.getDownloadQueue();

      expect(queue).toEqual(mockQueue);
    });
  });

  describe('Storage Space Check', () => {
    const mockRNFS = require('react-native-fs');

    it('should return available when sufficient space', async () => {
      mockRNFS.getFSInfo.mockResolvedValue({
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
      mockRNFS.getFSInfo.mockResolvedValue({
        freeSpace: 100000, // 100KB
        totalSpace: 2000000, // 2MB
      });

      const result = await enhancedErrorHandling.checkStorageSpace(500000); // 500KB

      expect(result.available).toBe(false);
      expect(result.freeSpace).toBe(100000);
      expect(result.totalSpace).toBe(2000000);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should handle storage info errors gracefully', async () => {
      mockRNFS.getFSInfo.mockRejectedValue(new Error('Storage access failed'));

      const result = await enhancedErrorHandling.checkStorageSpace(500000);

      expect(result.available).toBe(false);
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
        id: 'test-error-1',
        type: 'permission_denied' as const,
        message: 'Permission denied',
        timestamp: new Date().toISOString(),
        context: { operation: 'file_write', userId: 'test-user' },
        canRetry: true,
        retryCount: 0,
        maxRetries: 3,
        recoveryOptions: [],
      };

      const options = enhancedErrorHandling.generateRecoveryOptions(error);

      expect(options.length).toBeGreaterThan(0);
      expect(options.some(option => option.action === 'manual_action')).toBe(true);
      expect(options.some(option => option.action === 'retry')).toBe(true);
    });

    it('should generate recovery options for storage errors', () => {
      const error = {
        id: 'test-error-2',
        type: 'storage_full' as const,
        message: 'Storage full',
        timestamp: new Date().toISOString(),
        context: { operation: 'file_write', userId: 'test-user' },
        canRetry: true,
        retryCount: 0,
        maxRetries: 3,
        recoveryOptions: [],
      };

      const options = enhancedErrorHandling.generateRecoveryOptions(error);

      expect(options.length).toBeGreaterThan(0);
      expect(options.some(option => option.action === 'check_storage')).toBe(true);
      expect(options.some(option => option.action === 'retry')).toBe(true);
    });

    it('should generate recovery options for network errors', () => {
      const error = {
        id: 'test-error-3',
        type: 'network_error' as const,
        message: 'Network error',
        timestamp: new Date().toISOString(),
        context: { operation: 'network_request', userId: 'test-user' },
        canRetry: true,
        retryCount: 0,
        maxRetries: 3,
        recoveryOptions: [],
      };

      const options = enhancedErrorHandling.generateRecoveryOptions(error);

      expect(options.length).toBeGreaterThan(0);
      expect(options.some(option => option.action === 'manual_action')).toBe(true);
      expect(options.some(option => option.action === 'retry')).toBe(true);
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
    it('should handle complete offline queueing workflow', async () => {
      const downloadData = {
        storyContent: 'Offline test content',
        fileName: 'offline_test.txt',
        userId: 'user-123',
        sessionId: 'session-456',
        priority: 'normal' as const,
        maxRetries: 3,
      };

      // Queue the download
      const queueId = await enhancedErrorHandling.queueDownload(downloadData);
      expect(queueId).toBeDefined();

      // Verify it was queued
      const queue = await enhancedErrorHandling.getDownloadQueue();
      expect(queue.length).toBe(1);
      expect(queue[0].fileName).toBe('offline_test.txt');
    });

    it('should handle error categorization and enhancement workflow', async () => {
      let callCount = 0;
      const mockOperation = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          throw new Error('ENOSPC: no space left on device');
        }
        return Promise.resolve({ success: true, filePath: '/test/path' });
      });

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