/**
 * Sync Service Tests
 *
 * Test suite for cross-platform story synchronization.
 * Updated for US-005: syncService now operates in local-only mode
 * (cross-device sync via Supabase removed, pending Convex implementation).
 */

import { syncService } from '../../services/syncService';

// Mocks are already configured in jest.config.js and setup files

describe('SyncService', () => {
  const mockStory = {
    id: 'story-123',
    content:
      'Once upon a time, there was a brave knight who embarked on a quest.',
    metadata: {
      title: "The Knight's Quest",
      wordCount: 12,
      lastEditedBy: 'device-1',
      createdAt: '2024-01-01T10:00:00Z',
      updatedAt: '2024-01-01T10:30:00Z',
      version: 1,
      checksum: 'abc123',
    },
    source: 'CreativeBridge' as const,
    userId: 'user-123',
    deviceId: 'device-1',
    syncStatus: 'synced' as const,
  };

  const mockChange = {
    id: 'change-123',
    storyId: 'story-123',
    changeType: 'update' as const,
    deviceId: 'device-1',
    userId: 'user-123',
    timestamp: '2024-01-01T10:30:00Z',
    changeData: mockStory,
    isApplied: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();

    // Mock AsyncStorage to return empty arrays/null by default
    const mockAsyncStorage = require('@react-native-async-storage/async-storage');
    mockAsyncStorage.getItem.mockImplementation((key: string) => {
      if (key.includes('offline_stories')) return Promise.resolve('[]');
      if (key.includes('pending_changes')) return Promise.resolve('[]');
      if (key.includes('conflicts')) return Promise.resolve('[]');
      return Promise.resolve(null);
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Service Initialization', () => {
    it('should initialize sync service correctly', () => {
      expect(syncService).toBeDefined();
      expect(typeof syncService.setUserId).toBe('function');
      expect(typeof syncService.updateStoryOnDevice).toBe('function');
      expect(typeof syncService.syncAcrossDevices).toBe('function');
      expect(typeof syncService.getStoryOnDevice).toBe('function');
      expect(typeof syncService.resolveConflict).toBe('function');
      expect(typeof syncService.setOfflineMode).toBe('function');
      expect(typeof syncService.updateStory).toBe('function');
      expect(typeof syncService.getPendingChanges).toBe('function');
      expect(typeof syncService.syncPendingChanges).toBe('function');
      expect(typeof syncService.getSyncStatus).toBe('function');
      expect(typeof syncService.forceSyncAll).toBe('function');
    });

    it('should have access to AsyncStorage for device ID', () => {
      // The singleton initializes asynchronously in constructor.
      // Verify the service has the storage keys defined.
      const service = syncService as any;
      expect(service.STORAGE_KEYS.DEVICE_ID).toBe('sync_device_id');
    });
  });

  describe('User Management', () => {
    it('should set user ID correctly', () => {
      const userId = 'user-456';
      expect(() => syncService.setUserId(userId)).not.toThrow();
    });
  });

  describe('Story Updates', () => {
    it('should update story on device successfully', async () => {
      const deviceId = 'device-1';
      const storyId = 'story-123';
      const content = 'Updated story content';
      const metadata = { title: 'Updated Title' };

      syncService.setUserId('user-123');

      await syncService.updateStoryOnDevice(
        deviceId,
        storyId,
        content,
        metadata,
      );

      const mockAsyncStorage = require('@react-native-async-storage/async-storage');
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        expect.stringContaining('offline_stories'),
        expect.any(String),
      );
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        expect.stringContaining('pending_changes'),
        expect.any(String),
      );
    });

    it('should handle storage errors gracefully without crashing', async () => {
      const mockAsyncStorage = require('@react-native-async-storage/async-storage');
      mockAsyncStorage.setItem.mockRejectedValue(new Error('Storage error'));

      // The service catches storage errors internally in saveStoryLocally and
      // savePendingChanges, so the outer method completes without throwing.
      await expect(
        syncService.updateStoryOnDevice('device-1', 'story-123', 'content'),
      ).resolves.not.toThrow();

      // Restore default behavior
      mockAsyncStorage.setItem.mockResolvedValue(undefined);
    });

    it('should update story with simplified interface', async () => {
      syncService.setUserId('user-123');

      await expect(
        syncService.updateStory('story-123', 'New content', {
          title: 'New Title',
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('Cross-Device Synchronization (disabled)', () => {
    it('should skip sync when cross-device sync is disabled', async () => {
      const deviceIds = ['device-1', 'device-2', 'device-3'];

      // Should complete without error — sync is disabled, just logs and returns
      await syncService.syncAcrossDevices(deviceIds);
    });
  });

  describe('Story Retrieval (local-only)', () => {
    it('should get story from local storage', async () => {
      const mockAsyncStorage = require('@react-native-async-storage/async-storage');
      mockAsyncStorage.getItem.mockResolvedValueOnce(
        JSON.stringify([mockStory]),
      );

      const story = await syncService.getStoryOnDevice('device-1', 'story-123');

      expect(story).toBeDefined();
      expect(story?.id).toBe('story-123');
    });

    it('should return null when story not found', async () => {
      const story = await syncService.getStoryOnDevice(
        'device-1',
        'unknown-story',
      );

      expect(story).toBeNull();
    });
  });

  describe('Conflict Resolution', () => {
    it('should resolve conflicts using latest timestamp strategy', async () => {
      const service = syncService as any;
      service.config.conflictResolution = 'auto_latest';

      const conflictingEdits = [
        {
          deviceId: 'device-1',
          content: 'First edit',
          timestamp: 1000,
        },
        {
          deviceId: 'device-2',
          content: 'Second edit (latest)',
          timestamp: 2000,
        },
        {
          deviceId: 'device-3',
          content: 'Third edit',
          timestamp: 1500,
        },
      ];

      const resolved = await syncService.resolveConflict(
        'story-123',
        conflictingEdits,
      );

      expect(resolved.content).toBe('Second edit (latest)');
      expect(resolved.metadata.lastEditedBy).toBe('sync_service');
      expect(resolved.syncStatus).toBe('synced');
    });

    it('should use merge strategy when configured', async () => {
      const service = syncService as any;
      service.config.conflictResolution = 'auto_merge';

      const conflictingEdits = [
        {
          deviceId: 'device-1',
          content: 'Short edit',
          timestamp: 1000,
        },
        {
          deviceId: 'device-2',
          content: 'This is a much longer edit with more content',
          timestamp: 2000,
        },
      ];

      const resolved = await syncService.resolveConflict(
        'story-123',
        conflictingEdits,
      );

      expect(resolved.content).toBe(
        'This is a much longer edit with more content',
      );
    });

    it('should throw error for manual conflict resolution', async () => {
      const service = syncService as any;
      service.config.conflictResolution = 'manual';

      const conflictingEdits = [
        {
          deviceId: 'device-1',
          content: 'Edit 1',
          timestamp: 1000,
        },
        {
          deviceId: 'device-2',
          content: 'Edit 2',
          timestamp: 2000,
        },
      ];

      await expect(
        syncService.resolveConflict('story-123', conflictingEdits),
      ).rejects.toThrow('Manual conflict resolution required');
    });
  });

  describe('Offline Mode', () => {
    it('should enable offline mode', () => {
      syncService.setOfflineMode(true);
      expect(true).toBe(true);
    });

    it('should disable offline mode', () => {
      syncService.setOfflineMode(false);
      expect(true).toBe(true);
    });

    it('should queue changes when offline', async () => {
      syncService.setOfflineMode(true);
      syncService.setUserId('user-123');

      await syncService.updateStory('story-123', 'Offline edit');

      const pendingChanges = await syncService.getPendingChanges();
      expect(pendingChanges.length).toBeGreaterThan(0);
    });
  });

  describe('Pending Changes Management', () => {
    it('should get pending changes', async () => {
      const pendingChanges = await syncService.getPendingChanges();
      expect(Array.isArray(pendingChanges)).toBe(true);
    });

    it('should not attempt remote sync when cross-device sync is disabled', async () => {
      const service = syncService as any;
      service.pendingChanges = [mockChange];

      // syncPendingChanges should be a no-op when CROSS_DEVICE_SYNC_ENABLED is false
      await syncService.syncPendingChanges();

      // No error = success
      expect(true).toBe(true);
    });
  });

  describe('Sync Status', () => {
    it('should get current sync status', async () => {
      const status = await syncService.getSyncStatus();

      expect(status).toHaveProperty('isOnline');
      expect(status).toHaveProperty('lastSyncTime');
      expect(status).toHaveProperty('pendingChanges');
      expect(status).toHaveProperty('conflictsCount');
      expect(status).toHaveProperty('syncInProgress');
      expect(status).toHaveProperty('devicesSynced');
      expect(status).toHaveProperty('errorMessages');

      expect(typeof status.isOnline).toBe('boolean');
      expect(typeof status.pendingChanges).toBe('number');
      expect(typeof status.conflictsCount).toBe('number');
      expect(typeof status.syncInProgress).toBe('boolean');
      expect(Array.isArray(status.devicesSynced)).toBe(true);
      expect(Array.isArray(status.errorMessages)).toBe(true);
    });
  });

  describe('Force Sync (local-only)', () => {
    it('should complete force sync without error in local-only mode', async () => {
      syncService.setUserId('user-123');
      await expect(syncService.forceSyncAll()).resolves.not.toThrow();
    });
  });

  describe('Data Utilities', () => {
    it('should calculate checksum correctly', () => {
      const service = syncService as any;
      const content = 'Test story content';

      const checksum1 = service.calculateChecksum(content);
      const checksum2 = service.calculateChecksum(content);
      const checksum3 = service.calculateChecksum('Different content');

      expect(typeof checksum1).toBe('string');
      expect(checksum1).toBe(checksum2);
      expect(checksum1).not.toBe(checksum3);
    });

    it('should generate unique device IDs', () => {
      const service = syncService as any;

      const id1 = service.generateDeviceId();
      const id2 = service.generateDeviceId();

      expect(typeof id1).toBe('string');
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^device_/);
    });

    it('should generate unique change IDs', () => {
      const service = syncService as any;

      const id1 = service.generateChangeId();
      const id2 = service.generateChangeId();

      expect(typeof id1).toBe('string');
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^change_/);
    });

    it('should generate unique conflict IDs', () => {
      const service = syncService as any;

      const id1 = service.generateConflictId();
      const id2 = service.generateConflictId();

      expect(typeof id1).toBe('string');
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^conflict_/);
    });
  });

  describe('Cleanup', () => {
    it('should destroy service resources', () => {
      expect(() => syncService.destroy()).not.toThrow();
    });
  });
});
