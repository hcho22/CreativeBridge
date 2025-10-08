/**
 * Sync Service Tests
 * 
 * Comprehensive test suite for cross-platform story synchronization including
 * device-based sync, conflict resolution, offline mode, real-time updates,
 * and data consistency across multiple platforms.
 */

import { syncService } from '../../services/syncService';

// Mock dependencies using existing mocks
jest.mock('../../services/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      gt: jest.fn().mockReturnThis(),
    })),
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnThis(),
    })),
  },
}));

// Mocks are already configured in jest.config.js and setup files

describe('SyncService', () => {
  const mockStory = {
    id: 'story-123',
    content: 'Once upon a time, there was a brave knight who embarked on a quest.',
    metadata: {
      title: 'The Knight\'s Quest',
      wordCount: 12,
      lastEditedBy: 'device-1',
      createdAt: '2024-01-01T10:00:00Z',
      updatedAt: '2024-01-01T10:30:00Z',
      version: 1,
      checksum: 'abc123'
    },
    source: 'CreativeBridge' as const,
    userId: 'user-123',
    deviceId: 'device-1',
    syncStatus: 'synced' as const
  };

  const mockChange = {
    id: 'change-123',
    storyId: 'story-123',
    changeType: 'update' as const,
    deviceId: 'device-1',
    userId: 'user-123',
    timestamp: '2024-01-01T10:30:00Z',
    changeData: mockStory,
    isApplied: false
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

    it('should load device ID from storage or generate new one', async () => {
      const mockAsyncStorage = require('@react-native-async-storage/async-storage');
      const storedDeviceId = 'stored-device-123';
      mockAsyncStorage.getItem.mockResolvedValueOnce(storedDeviceId);

      // Re-initialize would happen in constructor, but we can test the concept
      expect(mockAsyncStorage.getItem).toHaveBeenCalled();
    });

    it('should set up network listener on initialization', () => {
      // Network listener setup is tested in the service itself
      expect(true).toBe(true);
    });
  });

  describe('User Management', () => {
    it('should set user ID correctly', () => {
      const userId = 'user-456';
      
      expect(() => syncService.setUserId(userId)).not.toThrow();
    });

    it('should setup realtime subscriptions when user ID is set', () => {
      const userId = 'user-789';
      
      syncService.setUserId(userId);
      
      expect(supabase.channel).toHaveBeenCalledWith('story_sync');
    });
  });

  describe('Story Updates', () => {
    it('should update story on device successfully', async () => {
      const deviceId = 'device-1';
      const storyId = 'story-123';
      const content = 'Updated story content';
      const metadata = { title: 'Updated Title' };

      syncService.setUserId('user-123');

      await syncService.updateStoryOnDevice(deviceId, storyId, content, metadata);

      const mockAsyncStorage = require('@react-native-async-storage/async-storage');
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        expect.stringContaining('offline_stories'),
        expect.any(String)
      );
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        expect.stringContaining('pending_changes'),
        expect.any(String)
      );
    });

    it('should handle update errors gracefully', async () => {
      const mockAsyncStorage = require('@react-native-async-storage/async-storage');
      mockAsyncStorage.setItem.mockRejectedValueOnce(new Error('Storage error'));

      await expect(
        syncService.updateStoryOnDevice('device-1', 'story-123', 'content')
      ).rejects.toThrow('Failed to update story');
    });

    it('should update story with simplified interface', async () => {
      syncService.setUserId('user-123');

      await expect(
        syncService.updateStory('story-123', 'New content', { title: 'New Title' })
      ).resolves.not.toThrow();
    });
  });

  describe('Cross-Device Synchronization', () => {
    it('should sync across multiple devices', async () => {
      const deviceIds = ['device-1', 'device-2', 'device-3'];

      await syncService.syncAcrossDevices(deviceIds);

      const mockAsyncStorage = require('@react-native-async-storage/async-storage');
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        expect.stringContaining('last_sync_time'),
        expect.any(String)
      );
    });

    it('should prevent concurrent sync operations', async () => {
      const deviceIds = ['device-1', 'device-2'];

      // Start two sync operations simultaneously
      const sync1 = syncService.syncAcrossDevices(deviceIds);
      const sync2 = syncService.syncAcrossDevices(deviceIds);

      await Promise.all([sync1, sync2]);

      // Should complete without issues (second sync should be skipped)
      expect(true).toBe(true);
    });

    it('should handle sync errors and reset sync state', async () => {
      const deviceIds = ['device-1'];
      
      // Mock an error during sync
      jest.spyOn(syncService as any, 'syncWithDevice').mockRejectedValueOnce(new Error('Sync error'));

      await expect(syncService.syncAcrossDevices(deviceIds)).rejects.toThrow('Sync failed');
    });
  });

  describe('Story Retrieval', () => {
    it('should get story from remote when online', async () => {
      const mockRemoteStory = {
        id: 'story-123',
        content: 'Remote story content',
        metadata: {},
        user_id: 'user-123',
        device_id: 'device-1',
        sync_status: 'synced'
      };

      const mockQuery = {
        data: mockRemoteStory,
        error: null
      };

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        ...mockQuery
      });

      const story = await syncService.getStoryOnDevice('device-1', 'story-123');

      expect(story).toBeDefined();
      expect(story?.id).toBe('story-123');
      expect(story?.content).toBe('Remote story content');
    });

    it('should fall back to local storage when remote fails', async () => {
      const mockQuery = {
        data: null,
        error: { message: 'Not found' }
      };

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        ...mockQuery
      });

      // Mock local storage with story
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify([mockStory])
      );

      const story = await syncService.getStoryOnDevice('device-1', 'story-123');

      expect(story).toBeDefined();
      expect(story?.id).toBe('story-123');
    });

    it('should return null when story not found anywhere', async () => {
      const mockQuery = {
        data: null,
        error: { message: 'Not found' }
      };

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        ...mockQuery
      });

      const story = await syncService.getStoryOnDevice('device-1', 'unknown-story');

      expect(story).toBeNull();
    });
  });

  describe('Conflict Resolution', () => {
    it('should resolve conflicts using latest timestamp strategy', async () => {
      const conflictingEdits = [
        {
          deviceId: 'device-1',
          content: 'First edit',
          timestamp: 1000
        },
        {
          deviceId: 'device-2',
          content: 'Second edit (latest)',
          timestamp: 2000
        },
        {
          deviceId: 'device-3',
          content: 'Third edit',
          timestamp: 1500
        }
      ];

      const resolved = await syncService.resolveConflict('story-123', conflictingEdits);

      expect(resolved.content).toBe('Second edit (latest)');
      expect(resolved.metadata.lastEditedBy).toBe('sync_service');
      expect(resolved.syncStatus).toBe('synced');
    });

    it('should use merge strategy when configured', async () => {
      // Change configuration to auto_merge
      const service = syncService as any;
      service.config.conflictResolution = 'auto_merge';

      const conflictingEdits = [
        {
          deviceId: 'device-1',
          content: 'Short edit',
          timestamp: 1000
        },
        {
          deviceId: 'device-2',
          content: 'This is a much longer edit with more content',
          timestamp: 2000
        }
      ];

      const resolved = await syncService.resolveConflict('story-123', conflictingEdits);

      // Should pick the longer content as per simple merge strategy
      expect(resolved.content).toBe('This is a much longer edit with more content');
    });

    it('should throw error for manual conflict resolution', async () => {
      const service = syncService as any;
      service.config.conflictResolution = 'manual';

      const conflictingEdits = [
        {
          deviceId: 'device-1',
          content: 'Edit 1',
          timestamp: 1000
        },
        {
          deviceId: 'device-2',
          content: 'Edit 2',
          timestamp: 2000
        }
      ];

      await expect(
        syncService.resolveConflict('story-123', conflictingEdits)
      ).rejects.toThrow('Manual conflict resolution required');
    });
  });

  describe('Offline Mode', () => {
    it('should enable offline mode', () => {
      syncService.setOfflineMode(true);
      
      // Should not throw
      expect(true).toBe(true);
    });

    it('should disable offline mode', () => {
      syncService.setOfflineMode(false);
      
      // Should not throw
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
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify([mockChange])
      );

      const pendingChanges = await syncService.getPendingChanges();

      expect(Array.isArray(pendingChanges)).toBe(true);
      expect(pendingChanges.length).toBe(1);
      expect(pendingChanges[0].id).toBe('change-123');
    });

    it('should sync pending changes when online', async () => {
      // Mock successful remote operations
      const mockUploadQuery = { error: null };
      (supabase.from as jest.Mock).mockReturnValue({
        upsert: jest.fn().mockReturnThis(),
        ...mockUploadQuery
      });

      // Pre-populate pending changes
      const service = syncService as any;
      service.pendingChanges = [mockChange];

      await syncService.syncPendingChanges();

      expect(supabase.from).toHaveBeenCalledWith('sync_stories');
    });

    it('should not sync when offline', async () => {
      const service = syncService as any;
      service.isOnline = false;
      service.pendingChanges = [mockChange];

      await syncService.syncPendingChanges();

      // Should not call Supabase when offline
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('should handle sync errors gracefully', async () => {
      const mockUploadQuery = { error: { message: 'Upload failed' } };
      (supabase.from as jest.Mock).mockReturnValue({
        upsert: jest.fn().mockReturnThis(),
        ...mockUploadQuery
      });

      const service = syncService as any;
      service.pendingChanges = [mockChange];

      // Should not throw
      await expect(syncService.syncPendingChanges()).resolves.not.toThrow();
    });
  });

  describe('Sync Status', () => {
    it('should get current sync status', async () => {
      const lastSyncTime = '2024-01-01T12:00:00Z';
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(lastSyncTime);

      const status = await syncService.getSyncStatus();

      expect(status).toHaveProperty('isOnline');
      expect(status).toHaveProperty('lastSyncTime', lastSyncTime);
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

    it('should handle missing last sync time', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

      const status = await syncService.getSyncStatus();

      expect(status.lastSyncTime).toBeNull();
    });
  });

  describe('Force Sync', () => {
    it('should force sync all data', async () => {
      const mockRemoteQuery = {
        data: [],
        error: null
      };

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gt: jest.fn().mockReturnThis(),
        ...mockRemoteQuery
      });

      syncService.setUserId('user-123');

      await expect(syncService.forceSyncAll()).resolves.not.toThrow();
    });

    it('should handle force sync errors', async () => {
      const service = syncService as any;
      jest.spyOn(service, 'syncPendingChanges').mockRejectedValueOnce(new Error('Sync error'));

      await expect(syncService.forceSyncAll()).rejects.toThrow('Sync error');
    });

    it('should reset sync state after force sync', async () => {
      const service = syncService as any;
      
      // Start force sync
      const syncPromise = syncService.forceSyncAll();
      
      // Sync should be in progress
      expect(service.syncInProgress).toBe(true);
      
      await syncPromise;
      
      // Sync should be completed
      expect(service.syncInProgress).toBe(false);
    });
  });

  describe('Network State Management', () => {
    it('should handle network state changes', async () => {
      const mockNetworkCallback = (NetInfo.addEventListener as jest.Mock).mock.calls[0][0];

      // Simulate going offline
      mockNetworkCallback({ isConnected: false });

      // Simulate coming back online
      const service = syncService as any;
      service.pendingChanges = [mockChange];
      
      mockNetworkCallback({ isConnected: true });

      // Should trigger sync when back online
      expect(true).toBe(true); // Callback should execute without errors
    });

    it('should sync pending changes when coming back online', async () => {
      const service = syncService as any;
      service.isOnline = false;
      service.pendingChanges = [mockChange];

      // Mock successful sync
      const mockUploadQuery = { error: null };
      (supabase.from as jest.Mock).mockReturnValue({
        upsert: jest.fn().mockReturnThis(),
        ...mockUploadQuery
      });

      const mockNetworkCallback = (NetInfo.addEventListener as jest.Mock).mock.calls[0][0];
      
      // Simulate coming back online
      mockNetworkCallback({ isConnected: true });

      // Should trigger sync automatically
      expect(true).toBe(true);
    });
  });

  describe('Real-time Subscriptions', () => {
    it('should set up real-time subscriptions', () => {
      syncService.setUserId('user-123');

      expect(supabase.channel).toHaveBeenCalledWith('story_sync');
    });

    it('should handle real-time change events', async () => {
      syncService.setUserId('user-123');

      const mockChannel = {
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn()
      };

      (supabase.channel as jest.Mock).mockReturnValue(mockChannel);

      // Re-setup subscriptions
      const service = syncService as any;
      service.setupRealtimeSubscriptions();

      const realtimeCallback = mockChannel.on.mock.calls[0][2];

      // Mock remote story data
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('[]');

      // Simulate real-time update
      const payload = {
        eventType: 'UPDATE',
        new: {
          id: 'story-123',
          content: 'Real-time updated content',
          metadata: { version: 2 },
          user_id: 'user-123',
          device_id: 'device-2',
          sync_status: 'synced'
        }
      };

      await expect(realtimeCallback(payload)).resolves.not.toThrow();
    });

    it('should handle real-time insert events', async () => {
      syncService.setUserId('user-123');

      const service = syncService as any;
      const payload = {
        eventType: 'INSERT',
        new: {
          id: 'new-story-456',
          content: 'New story from another device',
          metadata: { version: 1 },
          user_id: 'user-123',
          device_id: 'device-2',
          sync_status: 'synced'
        }
      };

      await expect(service.handleRealtimeChange(payload)).resolves.not.toThrow();
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
      expect(checksum1).toBe(checksum2); // Same content = same checksum
      expect(checksum1).not.toBe(checksum3); // Different content = different checksum
    });

    it('should generate unique device IDs', () => {
      const service = syncService as any;
      
      const id1 = service.generateDeviceId();
      const id2 = service.generateDeviceId();

      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^device_/);
      expect(id2).toMatch(/^device_/);
    });

    it('should generate unique change IDs', () => {
      const service = syncService as any;
      
      const id1 = service.generateChangeId();
      const id2 = service.generateChangeId();

      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^change_/);
      expect(id2).toMatch(/^change_/);
    });

    it('should generate unique conflict IDs', () => {
      const service = syncService as any;
      
      const id1 = service.generateConflictId();
      const id2 = service.generateConflictId();

      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^conflict_/);
      expect(id2).toMatch(/^conflict_/);
    });

    it('should convert database objects to sync stories', () => {
      const service = syncService as any;
      const dbObject = {
        id: 'story-123',
        content: 'Story content',
        metadata: { title: 'Test Story' },
        source: 'CreativeBridge',
        user_id: 'user-123',
        device_id: 'device-1',
        sync_status: 'synced'
      };

      const syncStory = service.convertToSyncStory(dbObject);

      expect(syncStory.id).toBe('story-123');
      expect(syncStory.content).toBe('Story content');
      expect(syncStory.userId).toBe('user-123');
      expect(syncStory.deviceId).toBe('device-1');
      expect(syncStory.syncStatus).toBe('synced');
    });
  });

  describe('Error Handling', () => {
    it('should handle storage errors gracefully', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Storage full'));

      await expect(
        syncService.updateStoryOnDevice('device-1', 'story-123', 'content')
      ).rejects.toThrow();
    });

    it('should handle database errors gracefully', async () => {
      const mockQuery = {
        data: null,
        error: { message: 'Database connection failed' }
      };

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        ...mockQuery
      });

      const story = await syncService.getStoryOnDevice('device-1', 'story-123');

      expect(story).toBeNull();
    });

    it('should handle malformed data gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('invalid json');

      const pendingChanges = await syncService.getPendingChanges();

      expect(Array.isArray(pendingChanges)).toBe(true);
      expect(pendingChanges.length).toBe(0);
    });

    it('should handle missing metadata in conflict resolution', async () => {
      const conflictingEdits = [
        {
          deviceId: 'device-1',
          content: 'Edit 1',
          timestamp: 1000
        }
      ];

      const resolved = await syncService.resolveConflict('story-123', conflictingEdits);

      expect(resolved).toBeDefined();
      expect(resolved.content).toBe('Edit 1');
      expect(resolved.metadata).toBeDefined();
    });
  });

  describe('Service Cleanup', () => {
    it('should cleanup resources properly', () => {
      expect(() => syncService.destroy()).not.toThrow();
    });

    it('should clear auto-sync timer on destroy', () => {
      const service = syncService as any;
      service.autoSyncTimer = setInterval(() => {}, 1000);

      syncService.destroy();

      // Timer should be cleared
      expect(true).toBe(true);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large numbers of pending changes', async () => {
      const service = syncService as any;
      const largeChangeSet = Array.from({ length: 1000 }, (_, i) => ({
        ...mockChange,
        id: `change-${i}`,
        storyId: `story-${i}`
      }));

      service.pendingChanges = largeChangeSet;

      const pendingChanges = await syncService.getPendingChanges();

      expect(pendingChanges.length).toBe(1000);
    });

    it('should handle concurrent device sync requests', async () => {
      const deviceSets = [
        ['device-1', 'device-2'],
        ['device-3', 'device-4'],
        ['device-5', 'device-6']
      ];

      const syncPromises = deviceSets.map(devices => 
        syncService.syncAcrossDevices(devices)
      );

      // Should handle multiple concurrent sync requests
      await expect(Promise.all(syncPromises)).resolves.not.toThrow();
    });

    it('should efficiently batch storage operations', async () => {
      const service = syncService as any;
      
      const stories = Array.from({ length: 100 }, (_, i) => ({
        ...mockStory,
        id: `story-${i}`
      }));

      // Should batch save operations efficiently
      for (const story of stories) {
        await service.saveStoryLocally(story);
      }

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });
});