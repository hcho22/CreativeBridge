/**
 * Enhanced Error Handling Integration Tests (Task 2.4)
 * End-to-end testing of error handling, recovery, and offline queueing workflows
 */

import { storyDownloadService } from '../../services/storyDownloadService';
import { enhancedErrorHandling } from '../../services/enhancedErrorHandling';
import { networkMonitor } from '../../services/networkMonitor';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as RNFS from 'react-native-fs';
import Share from 'react-native-share';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/test/documents',
  writeFile: jest.fn(),
  getFSInfo: jest.fn(),
  exists: jest.fn(),
}));

jest.mock('react-native-share', () => ({
  open: jest.fn(),
}));

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(),
  fetch: jest.fn(),
}));

describe('Enhanced Error Handling Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset service states
    (enhancedErrorHandling as any).downloadQueue = [];
    (enhancedErrorHandling as any).processingQueue = false;

    // Default mocks
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (RNFS.getFSInfo as jest.Mock).mockResolvedValue({
      freeSpace: 10000000, // 10MB
      totalSpace: 20000000, // 20MB
    });
    (RNFS.writeFile as jest.Mock).mockResolvedValue(undefined);
    (Share.open as jest.Mock).mockResolvedValue(undefined);
  });

  describe('Complete Download with Recovery Workflow', () => {
    it('should successfully download story on first attempt', async () => {
      const result = await storyDownloadService.downloadStoryWithRecovery({
        storyContent: 'Test story content for successful download',
        fileName: 'test_story.txt',
        userId: 'user-123',
        sessionId: 'session-456',
        maxRetries: 3,
      });

      expect(result.success).toBe(true);
      expect(result.fileName).toBe('test_story.txt');
      expect(result.queued).toBeUndefined();
      expect(RNFS.writeFile).toHaveBeenCalledWith(
        '/test/documents/test_story.txt',
        'Test story content for successful download',
        'utf8',
      );
      expect(Share.open).toHaveBeenCalled();
    });

    it('should retry download after temporary failure', async () => {
      // First call fails, second succeeds
      (RNFS.writeFile as jest.Mock)
        .mockRejectedValueOnce(new Error('Temporary file system error'))
        .mockResolvedValueOnce(undefined);

      const result = await storyDownloadService.downloadStoryWithRecovery({
        storyContent: 'Test story content with retry',
        fileName: 'retry_story.txt',
        userId: 'user-123',
        sessionId: 'session-456',
        maxRetries: 3,
      });

      expect(result.success).toBe(true);
      expect(result.fileName).toBe('retry_story.txt');
      expect(RNFS.writeFile).toHaveBeenCalledTimes(2);
    });

    it('should queue download when storage is full', async () => {
      (RNFS.getFSInfo as jest.Mock).mockResolvedValue({
        freeSpace: 100, // Very little space
        totalSpace: 1000000,
      });

      const result = await storyDownloadService.downloadStoryWithRecovery({
        storyContent:
          'Large story content that requires significant storage space',
        fileName: 'large_story.txt',
        userId: 'user-123',
        sessionId: 'session-456',
        maxRetries: 3,
      });

      expect(result.success).toBe(false);
      expect(result.errorType).toBe('storage_full');
      expect(result.storageInfo).toBeDefined();
      expect(result.storageInfo?.available).toBe(false);
      expect(result.storageInfo?.recommendations).toContain(
        expect.stringContaining('Free up'),
      );
    });

    it('should queue download when offline', async () => {
      // Mock network monitor to return offline status
      jest.spyOn(networkMonitor, 'getCurrentStatus').mockReturnValue({
        isConnected: false,
        connectionType: 'none',
        isInternetReachable: false,
        strength: 'unknown',
      });

      const result = await storyDownloadService.downloadStoryWithRecovery({
        storyContent: 'Offline story content',
        fileName: 'offline_story.txt',
        userId: 'user-123',
        sessionId: 'session-456',
        maxRetries: 3,
      });

      expect(result.success).toBe(false);
      expect(result.queued).toBe(true);
      expect(result.queueId).toBeDefined();
      expect(result.error).toContain('Download queued');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'download_queue',
        expect.stringContaining(result.queueId!),
      );
    });
  });

  describe('Offline Queue Processing Workflow', () => {
    it('should process queued downloads when coming back online', async () => {
      // Set up queued downloads
      const mockQueue = [
        {
          id: 'queue-1',
          storyContent: 'Queued story 1',
          fileName: 'queued_1.txt',
          userId: 'user-123',
          sessionId: 'session-1',
          priority: 'high',
          maxRetries: 3,
          queuedAt: Date.now() - 1000,
          retryCount: 0,
        },
        {
          id: 'queue-2',
          storyContent: 'Queued story 2',
          fileName: 'queued_2.txt',
          userId: 'user-123',
          sessionId: 'session-2',
          priority: 'normal',
          maxRetries: 3,
          queuedAt: Date.now() - 500,
          retryCount: 1,
        },
      ];

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(mockQueue),
      );

      const result = await enhancedErrorHandling.processDownloadQueue();

      expect(result.total).toBe(2);
      expect(result.processed).toBe(2);
      expect(result.failed).toBe(0);

      // Should have written both files
      expect(RNFS.writeFile).toHaveBeenCalledTimes(2);
      expect(RNFS.writeFile).toHaveBeenCalledWith(
        '/test/documents/queued_1.txt',
        'Queued story 1',
        'utf8',
      );
      expect(RNFS.writeFile).toHaveBeenCalledWith(
        '/test/documents/queued_2.txt',
        'Queued story 2',
        'utf8',
      );

      // Should clear the queue
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('download_queue', '[]');
    });

    it('should handle partial queue processing failures', async () => {
      const mockQueue = [
        {
          id: 'queue-1',
          storyContent: 'Success story',
          fileName: 'success.txt',
          userId: 'user-123',
          sessionId: 'session-1',
          priority: 'normal',
          maxRetries: 3,
          queuedAt: Date.now(),
          retryCount: 0,
        },
        {
          id: 'queue-2',
          storyContent: 'Failure story',
          fileName: 'failure.txt',
          userId: 'user-123',
          sessionId: 'session-2',
          priority: 'normal',
          maxRetries: 1, // Low retry limit
          queuedAt: Date.now(),
          retryCount: 0,
        },
      ];

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(mockQueue),
      );

      // First call succeeds, second fails
      (RNFS.writeFile as jest.Mock)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValue(new Error('Persistent failure'));

      const result = await enhancedErrorHandling.processDownloadQueue();

      expect(result.total).toBe(2);
      expect(result.processed).toBe(1);
      expect(result.failed).toBe(1);

      // Should have attempted both files
      expect(RNFS.writeFile).toHaveBeenCalledTimes(2);
    });

    it('should respect priority ordering in queue processing', async () => {
      const processOrder: string[] = [];

      // Mock the internal file write to track order
      (RNFS.writeFile as jest.Mock).mockImplementation((path: string) => {
        const fileName = path.split('/').pop();
        processOrder.push(fileName!);
        return Promise.resolve();
      });

      const mockQueue = [
        {
          id: 'queue-1',
          fileName: 'normal1.txt',
          priority: 'normal',
          queuedAt: Date.now() - 2000, // Oldest
        },
        {
          id: 'queue-2',
          fileName: 'high1.txt',
          priority: 'high',
          queuedAt: Date.now() - 1000,
        },
        {
          id: 'queue-3',
          fileName: 'normal2.txt',
          priority: 'normal',
          queuedAt: Date.now() - 1500,
        },
        {
          id: 'queue-4',
          fileName: 'high2.txt',
          priority: 'high',
          queuedAt: Date.now() - 500, // Newest high priority
        },
      ];

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(mockQueue),
      );

      await enhancedErrorHandling.processDownloadQueue();

      // High priority items should be processed first, then normal by age
      expect(processOrder).toEqual([
        'high1.txt', // High priority, older
        'high2.txt', // High priority, newer
        'normal1.txt', // Normal priority, oldest
        'normal2.txt', // Normal priority, newer
      ]);
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('should handle permission denied errors with recovery options', async () => {
      (RNFS.writeFile as jest.Mock).mockRejectedValue(
        new Error('EACCES: permission denied'),
      );

      const result = await storyDownloadService.downloadStoryWithRecovery({
        storyContent: 'Permission test story',
        fileName: 'permission_test.txt',
        userId: 'user-123',
        sessionId: 'session-456',
        maxRetries: 2,
      });

      expect(result.success).toBe(false);
      expect(result.queued).toBe(true);
      expect(result.queueId).toBeDefined();

      // Verify the download was queued for later retry
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'download_queue',
        expect.stringContaining(result.queueId!),
      );
    });

    it('should handle network timeout errors with exponential backoff', async () => {
      // Mock Share.open to simulate network timeout
      (Share.open as jest.Mock)
        .mockRejectedValueOnce(new Error('Request timeout'))
        .mockRejectedValueOnce(new Error('Request timeout'))
        .mockResolvedValueOnce(undefined);

      const startTime = Date.now();
      const result = await storyDownloadService.downloadStoryWithRecovery({
        storyContent: 'Timeout test story',
        fileName: 'timeout_test.txt',
        userId: 'user-123',
        sessionId: 'session-456',
        maxRetries: 3,
      });

      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(Share.open).toHaveBeenCalledTimes(3);
      // Should have some delay due to exponential backoff
      expect(duration).toBeGreaterThan(50);
    });

    it('should handle file system errors with appropriate categorization', async () => {
      (RNFS.writeFile as jest.Mock).mockRejectedValue(
        new Error('ENOENT: no such file or directory'),
      );

      const result = await storyDownloadService.downloadStoryWithRecovery({
        storyContent: 'File system error test',
        fileName: 'fs_error_test.txt',
        userId: 'user-123',
        sessionId: 'session-456',
        maxRetries: 1,
      });

      expect(result.success).toBe(false);
      expect(result.queued).toBe(true);

      // Verify error was properly logged and categorized
      const queue = await enhancedErrorHandling.getDownloadQueue();
      expect(queue.length).toBe(1);
      expect(queue[0].fileName).toBe('fs_error_test.txt');
    });
  });

  describe('Storage Space Management', () => {
    it('should provide helpful recommendations when storage is low', async () => {
      (RNFS.getFSInfo as jest.Mock).mockResolvedValue({
        freeSpace: 50000, // 50KB
        totalSpace: 1000000, // 1MB
      });

      const result = await storyDownloadService.downloadStoryWithRecovery({
        storyContent: 'Large story that requires more space than available',
        fileName: 'large_story.txt',
        userId: 'user-123',
        sessionId: 'session-456',
      });

      expect(result.success).toBe(false);
      expect(result.errorType).toBe('storage_full');
      expect(result.storageInfo).toBeDefined();
      expect(result.storageInfo?.recommendations).toContain(
        expect.stringMatching(/Free up.*space/i),
      );
      expect(result.storageInfo?.recommendations).toContain(
        expect.stringMatching(/Delete.*files/i),
      );
    });

    it('should handle storage check failures gracefully', async () => {
      (RNFS.getFSInfo as jest.Mock).mockRejectedValue(
        new Error('Storage access denied'),
      );

      const result = await storyDownloadService.downloadStoryWithRecovery({
        storyContent: 'Storage check failure test',
        fileName: 'storage_check_test.txt',
        userId: 'user-123',
        sessionId: 'session-456',
      });

      // Should continue with download attempt despite storage check failure
      expect(RNFS.writeFile).toHaveBeenCalled();
    });
  });

  describe('Real-world Integration Scenarios', () => {
    it('should handle complete offline to online workflow', async () => {
      // Start offline
      jest.spyOn(networkMonitor, 'getCurrentStatus').mockReturnValue({
        isConnected: false,
        connectionType: 'none',
        isInternetReachable: false,
        strength: 'unknown',
      });

      // Queue a download while offline
      const offlineResult =
        await storyDownloadService.downloadStoryWithRecovery({
          storyContent: 'Offline to online test story',
          fileName: 'offline_online_test.txt',
          userId: 'user-123',
          sessionId: 'session-456',
        });

      expect(offlineResult.success).toBe(false);
      expect(offlineResult.queued).toBe(true);

      // Simulate coming back online
      jest.spyOn(networkMonitor, 'getCurrentStatus').mockReturnValue({
        isConnected: true,
        connectionType: 'wifi',
        isInternetReachable: true,
        strength: 'good',
      });

      // Process the queue
      const queueResult = await enhancedErrorHandling.processDownloadQueue();

      expect(queueResult.processed).toBe(1);
      expect(queueResult.failed).toBe(0);
      expect(RNFS.writeFile).toHaveBeenCalledWith(
        '/test/documents/offline_online_test.txt',
        'Offline to online test story',
        'utf8',
      );
    });

    it('should handle multiple concurrent error scenarios', async () => {
      // Simulate low storage and network issues
      (RNFS.getFSInfo as jest.Mock).mockResolvedValue({
        freeSpace: 100,
        totalSpace: 1000000,
      });

      jest.spyOn(networkMonitor, 'getCurrentStatus').mockReturnValue({
        isConnected: true,
        connectionType: 'cellular',
        isInternetReachable: true,
        strength: 'poor', // Poor connection
      });

      const result = await storyDownloadService.downloadStoryWithRecovery({
        storyContent: 'Multiple error scenario test story content',
        fileName: 'multi_error_test.txt',
        userId: 'user-123',
        sessionId: 'session-456',
      });

      // Should handle storage issue first
      expect(result.success).toBe(false);
      expect(result.errorType).toBe('storage_full');
    });

    it('should maintain error context across retry attempts', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      (Share.open as jest.Mock)
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockRejectedValueOnce(new Error('Second attempt failed'))
        .mockResolvedValueOnce(undefined);

      await storyDownloadService.downloadStoryWithRecovery({
        storyContent: 'Context preservation test',
        fileName: 'context_test.txt',
        userId: 'user-123',
        sessionId: 'session-456',
        maxRetries: 3,
      });

      // Should log each retry attempt with context
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ story_download failed on attempt 1:'),
        expect.any(Error),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ story_download failed on attempt 2:'),
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });
});
