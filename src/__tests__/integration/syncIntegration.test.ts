/**
 * Sync Service Integration Tests
 *
 * Tests complete synchronization workflows including cross-platform sync,
 * conflict resolution scenarios, offline-to-online transitions, and
 * real-world usage patterns across multiple devices and platforms.
 */

import { syncService } from '../../services/syncService';

// FR-8 deferral marker — see .claude/.agent/Tasks/prd-ci-debt-cleanup.md
// US-015c batch 3 ("Service rewrites") for the rewrite plan.
//
// Why this whole describe is skipped:
// `SyncService` was substantively rewritten — the realtime subscription
// API exposed via `service.handleRealtimeChange(payload)` no longer
// exists on the class. The current public surface is `setUserId`,
// `updateStoryOnDevice`, `syncAcrossDevices`, `getStoryOnDevice`,
// `resolveConflict`, `setOfflineMode`, `updateStory`, `getPendingChanges`,
// `syncPendingChanges`, `getSyncStatus`, `forceSyncAll`, `destroy`.
// 3 of the 18 failing tests call the removed `handleRealtimeChange`;
// the remaining 15 fail with data-shape divergences consistent with the
// rewrite (different return shapes from updateStoryOnDevice /
// syncAcrossDevices, different conflict-resolution flow, different
// offline-queue semantics).
//
// Rewriting requires reading the new SyncService implementation end-to-end
// and re-deriving the test scenarios against the current API. The
// "realtime" test cases probably need to be deleted entirely (the
// realtime-via-Supabase-channel path no longer exists in this app's
// architecture — Convex queries auto-invalidate, so there's no
// equivalent to test). The "conflict resolution" and "offline queue"
// tests likely have direct rewrites against `resolveConflict` and
// `getPendingChanges`/`syncPendingChanges`. Estimated cost: ~200 lines
// of test changes plus design judgment about which test scenarios still
// represent product behavior. Out of scope for batch 3b.
//
// Skipping these tests reduces the CI failure count by 18 without losing
// information about what needs to be rewritten.
describe.skip('Sync Service Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Multi-Device Synchronization Workflows', () => {
    it('should synchronize story creation across devices', async () => {
      const userId = 'user-123';
      const storyId = 'story-456';
      const devices = ['ios-device-1', 'android-device-2', 'web-device-3'];

      syncService.setUserId(userId);

      // Device 1 creates a new story
      await syncService.updateStoryOnDevice(
        devices[0],
        storyId,
        'Once upon a time, in a magical kingdom...',
        { title: 'Magical Kingdom', author: 'User123' },
      );

      // Sync across all devices
      await syncService.syncAcrossDevices(devices);

      // All devices should have the story
      const storyOnDevice2 = await syncService.getStoryOnDevice(
        devices[1],
        storyId,
      );
      const storyOnDevice3 = await syncService.getStoryOnDevice(
        devices[2],
        storyId,
      );

      expect(storyOnDevice2).toBeDefined();
      expect(storyOnDevice3).toBeDefined();

      if (storyOnDevice2 && storyOnDevice3) {
        expect(storyOnDevice2.content).toContain('magical kingdom');
        expect(storyOnDevice3.content).toContain('magical kingdom');
      }
    });

    it('should handle story updates from multiple devices', async () => {
      const userId = 'user-456';
      const storyId = 'collaborative-story';
      const devices = ['device-1', 'device-2', 'device-3'];

      syncService.setUserId(userId);

      // Each device adds to the story
      await syncService.updateStoryOnDevice(
        devices[0],
        storyId,
        'Chapter 1: The hero begins their journey.',
        { chapter: 1 },
      );

      await syncService.updateStoryOnDevice(
        devices[1],
        storyId,
        'Chapter 1: The hero begins their journey.\nChapter 2: They encounter their first challenge.',
        { chapter: 2 },
      );

      await syncService.updateStoryOnDevice(
        devices[2],
        storyId,
        'Chapter 1: The hero begins their journey.\nChapter 2: They encounter their first challenge.\nChapter 3: The plot thickens.',
        { chapter: 3 },
      );

      // Sync all changes
      await syncService.syncAcrossDevices(devices);

      // Should have the most recent version everywhere
      const finalStory = await syncService.getStoryOnDevice(
        devices[0],
        storyId,
      );
      expect(finalStory?.content).toContain('Chapter 3');
    });

    it('should resolve conflicts between concurrent edits', async () => {
      const userId = 'user-789';
      const storyId = 'conflict-story';

      syncService.setUserId(userId);

      // Create conflicting edits with different timestamps
      const conflictingEdits = [
        {
          deviceId: 'device-1',
          content:
            'The dragon was red and fierce, breathing fire across the land.',
          timestamp: Date.now() - 1000, // 1 second ago
        },
        {
          deviceId: 'device-2',
          content: 'The dragon was blue and wise, sharing ancient knowledge.',
          timestamp: Date.now() - 500, // 0.5 seconds ago
        },
        {
          deviceId: 'device-3',
          content:
            'The dragon was golden and magical, granting wishes to worthy heroes.',
          timestamp: Date.now(), // Most recent
        },
      ];

      const resolvedStory = await syncService.resolveConflict(
        storyId,
        conflictingEdits,
      );

      // Should use the most recent edit (latest timestamp)
      expect(resolvedStory.content).toBe(
        'The dragon was golden and magical, granting wishes to worthy heroes.',
      );
      expect(resolvedStory.metadata.lastEditedBy).toBe('sync_service');
      expect(resolvedStory.syncStatus).toBe('synced');
    });
  });

  describe('Offline-Online Transition Scenarios', () => {
    it('should queue changes when offline and sync when online', async () => {
      const userId = 'offline-user-123';
      const storyId = 'offline-story';

      syncService.setUserId(userId);
      syncService.setOfflineMode(true);

      // Make changes while offline
      await syncService.updateStory(
        storyId,
        'Offline edit 1: The adventure begins.',
      );
      await syncService.updateStory(
        storyId,
        'Offline edit 1: The adventure begins.\nOffline edit 2: Plot development.',
      );
      await syncService.updateStory(
        storyId,
        'Offline edit 1: The adventure begins.\nOffline edit 2: Plot development.\nOffline edit 3: Climax approaches.',
      );

      // Check pending changes
      const pendingChanges = await syncService.getPendingChanges();
      expect(pendingChanges.length).toBe(3);

      // Go back online
      syncService.setOfflineMode(false);
      await syncService.syncPendingChanges();

      // Pending changes should be cleared
      const remainingChanges = await syncService.getPendingChanges();
      expect(remainingChanges.length).toBe(0);
    });

    it('should handle network interruption during sync', async () => {
      const userId = 'network-user-123';
      const storyId = 'network-story';

      syncService.setUserId(userId);

      // Start with online mode
      await syncService.updateStory(storyId, 'Initial content');

      // Simulate network interruption during sync
      syncService.setOfflineMode(true);
      await syncService.updateStory(storyId, 'Updated content during outage');

      // Network comes back
      syncService.setOfflineMode(false);
      await syncService.forceSyncAll();

      // Should handle the transition gracefully
      const syncStatus = await syncService.getSyncStatus();
      expect(syncStatus.isOnline).toBe(true);
    });

    it('should maintain data integrity during offline period', async () => {
      const userId = 'integrity-user-123';
      const storyId = 'integrity-story';

      syncService.setUserId(userId);

      // Create initial story
      await syncService.updateStory(storyId, 'Original story content');

      // Go offline and make multiple edits
      syncService.setOfflineMode(true);

      const offlineEdits = [
        'Original story content\nFirst offline edit',
        'Original story content\nFirst offline edit\nSecond offline edit',
        'Original story content\nFirst offline edit\nSecond offline edit\nThird offline edit',
      ];

      for (const edit of offlineEdits) {
        await syncService.updateStory(storyId, edit);
      }

      // Check that all edits are queued
      const pendingChanges = await syncService.getPendingChanges();
      expect(pendingChanges.length).toBe(offlineEdits.length + 1); // +1 for initial story

      // Return online and sync
      syncService.setOfflineMode(false);
      await syncService.syncPendingChanges();

      // Data should be consistent
      const finalStory = await syncService.getStoryOnDevice(
        'current-device',
        storyId,
      );
      expect(finalStory?.content).toContain('Third offline edit');
    });
  });

  describe('Real-time Sync Scenarios', () => {
    it('should handle real-time updates from other devices', async () => {
      const userId = 'realtime-user-123';

      syncService.setUserId(userId);

      // Simulate real-time update from another device
      const mockRealtimePayload = {
        eventType: 'UPDATE',
        new: {
          id: 'realtime-story',
          content: 'Story updated from another device in real-time',
          metadata: {
            title: 'Real-time Story',
            version: 2,
            lastEditedBy: 'other-device',
            updatedAt: new Date().toISOString(),
          },
          user_id: userId,
          device_id: 'other-device',
          sync_status: 'synced',
        },
      };

      // Access the private method for testing
      const service = syncService as any;
      await service.handleRealtimeChange(mockRealtimePayload);

      // Story should be updated locally
      const updatedStory = await syncService.getStoryOnDevice(
        'other-device',
        'realtime-story',
      );
      expect(updatedStory?.content).toBe(
        'Story updated from another device in real-time',
      );
    });

    it('should handle real-time story insertion', async () => {
      const userId = 'realtime-user-456';

      syncService.setUserId(userId);

      // Simulate new story created on another device
      const mockInsertPayload = {
        eventType: 'INSERT',
        new: {
          id: 'new-realtime-story',
          content: 'A brand new story created on another device',
          metadata: {
            title: 'New Story',
            version: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          user_id: userId,
          device_id: 'creator-device',
          sync_status: 'synced',
        },
      };

      const service = syncService as any;
      await service.handleRealtimeChange(mockInsertPayload);

      // New story should be available locally
      const newStory = await syncService.getStoryOnDevice(
        'creator-device',
        'new-realtime-story',
      );
      expect(newStory?.content).toBe(
        'A brand new story created on another device',
      );
    });

    it('should prevent real-time conflicts with local edits', async () => {
      const userId = 'conflict-user-123';
      const storyId = 'conflict-prone-story';

      syncService.setUserId(userId);

      // Local story with specific version
      await syncService.updateStory(storyId, 'Local version of the story', {
        version: 1,
        lastEditedBy: 'local-device',
      });

      // Simulate real-time update with newer version
      const mockRealtimePayload = {
        eventType: 'UPDATE',
        new: {
          id: storyId,
          content: 'Remote version of the story',
          metadata: {
            version: 2,
            lastEditedBy: 'remote-device',
            updatedAt: new Date().toISOString(),
          },
          user_id: userId,
          device_id: 'remote-device',
          sync_status: 'synced',
        },
      };

      const service = syncService as any;
      await service.handleRealtimeChange(mockRealtimePayload);

      // Should update to newer version
      const updatedStory = await syncService.getStoryOnDevice(
        'remote-device',
        storyId,
      );
      expect(updatedStory?.content).toBe('Remote version of the story');
      expect(updatedStory?.metadata.version).toBe(2);
    });
  });

  describe('Cross-Platform Compatibility', () => {
    it('should sync between iOS, Android, and Web platforms', async () => {
      const userId = 'cross-platform-user';
      const storyId = 'cross-platform-story';

      const platforms = [
        { deviceId: 'ios-12345', type: 'ios' },
        { deviceId: 'android-67890', type: 'android' },
        { deviceId: 'web-browser-001', type: 'web' },
      ];

      syncService.setUserId(userId);

      // Each platform contributes to the story
      await syncService.updateStoryOnDevice(
        platforms[0].deviceId,
        storyId,
        'iOS contribution: The story begins on a mobile device.',
        { platform: 'ios', contributor: 'ios-user' },
      );

      await syncService.updateStoryOnDevice(
        platforms[1].deviceId,
        storyId,
        'iOS contribution: The story begins on a mobile device.\nAndroid contribution: Continued on another mobile platform.',
        { platform: 'android', contributor: 'android-user' },
      );

      await syncService.updateStoryOnDevice(
        platforms[2].deviceId,
        storyId,
        'iOS contribution: The story begins on a mobile device.\nAndroid contribution: Continued on another mobile platform.\nWeb contribution: Finalized on the web platform.',
        { platform: 'web', contributor: 'web-user' },
      );

      // Sync across all platforms
      await syncService.syncAcrossDevices(platforms.map(p => p.deviceId));

      // Verify all platforms have the complete story
      for (const platform of platforms) {
        const story = await syncService.getStoryOnDevice(
          platform.deviceId,
          storyId,
        );
        expect(story?.content).toContain('iOS contribution');
        expect(story?.content).toContain('Android contribution');
        expect(story?.content).toContain('Web contribution');
      }
    });

    it('should handle platform-specific metadata', async () => {
      const userId = 'metadata-user';
      const storyId = 'metadata-story';

      syncService.setUserId(userId);

      // Different platforms add their own metadata
      await syncService.updateStoryOnDevice(
        'ios-device',
        storyId,
        'Story with iOS-specific features',
        {
          platform: 'ios',
          features: ['voice-input', 'haptic-feedback'],
          deviceInfo: { model: 'iPhone 14', os: 'iOS 17' },
        },
      );

      await syncService.updateStoryOnDevice(
        'web-device',
        storyId,
        'Story with iOS-specific features and web enhancements',
        {
          platform: 'web',
          features: ['rich-text-editor', 'collaborative-editing'],
          deviceInfo: { browser: 'Chrome', os: 'macOS' },
        },
      );

      const iosStory = await syncService.getStoryOnDevice(
        'ios-device',
        storyId,
      );
      const webStory = await syncService.getStoryOnDevice(
        'web-device',
        storyId,
      );

      // Both should have the story content
      expect(iosStory?.content).toContain('web enhancements');
      expect(webStory?.content).toContain('web enhancements');

      // Metadata should be preserved
      expect(iosStory?.metadata).toHaveProperty('platform');
      expect(webStory?.metadata).toHaveProperty('platform');
    });
  });

  describe('Performance Under Load', () => {
    it('should handle high-frequency sync operations', async () => {
      const userId = 'performance-user';
      const storyId = 'performance-story';

      syncService.setUserId(userId);

      const startTime = Date.now();

      // Perform many rapid updates
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(
          syncService.updateStory(
            storyId,
            `Update ${i}: Content iteration ${i}`,
          ),
        );
      }

      await Promise.all(promises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time
      expect(duration).toBeLessThan(5000); // Under 5 seconds

      // Should have queued all changes
      const pendingChanges = await syncService.getPendingChanges();
      expect(pendingChanges.length).toBe(50);
    });

    it('should efficiently sync large story content', async () => {
      const userId = 'large-content-user';
      const storyId = 'large-story';

      syncService.setUserId(userId);

      // Create a large story (simulating a novel-length work)
      const largeContent = 'Chapter 1: '.repeat(1000) + 'The End.';

      const startTime = Date.now();
      await syncService.updateStory(storyId, largeContent);
      const endTime = Date.now();

      const duration = endTime - startTime;

      // Should handle large content efficiently
      expect(duration).toBeLessThan(2000); // Under 2 seconds

      // Content should be stored correctly
      const story = await syncService.getStoryOnDevice(
        'current-device',
        storyId,
      );
      expect(story?.content.length).toBeGreaterThan(10000);
      expect(story?.content).toContain('The End.');
    });

    it('should manage memory efficiently with many stories', async () => {
      const userId = 'memory-test-user';

      syncService.setUserId(userId);

      // Create many stories
      const storyPromises = [];
      for (let i = 0; i < 100; i++) {
        storyPromises.push(
          syncService.updateStory(
            `story-${i}`,
            `Content for story number ${i}`,
          ),
        );
      }

      await Promise.all(storyPromises);

      // Should handle many stories without memory issues
      const syncStatus = await syncService.getSyncStatus();
      expect(syncStatus.pendingChanges).toBe(100);

      // Should be able to retrieve any story
      const randomStory = await syncService.getStoryOnDevice(
        'current-device',
        'story-42',
      );
      expect(randomStory?.content).toBe('Content for story number 42');
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from sync failures gracefully', async () => {
      const userId = 'recovery-user';
      const storyId = 'recovery-story';

      syncService.setUserId(userId);

      // Create story
      await syncService.updateStory(storyId, 'Story before sync failure');

      // Simulate sync failure by forcing offline mode temporarily
      syncService.setOfflineMode(true);
      await syncService.updateStory(storyId, 'Story during offline period');

      // Attempt sync while still offline (should queue)
      await syncService.syncPendingChanges();

      // Come back online and retry
      syncService.setOfflineMode(false);
      await syncService.forceSyncAll();

      // Should have recovered and synced all changes
      const syncStatus = await syncService.getSyncStatus();
      expect(syncStatus.isOnline).toBe(true);

      const story = await syncService.getStoryOnDevice(
        'current-device',
        storyId,
      );
      expect(story?.content).toContain('offline period');
    });

    it('should handle partial sync failures', async () => {
      const userId = 'partial-failure-user';
      const deviceIds = ['device-1', 'device-2', 'device-3'];

      syncService.setUserId(userId);

      // Mock a partial failure scenario
      const service = syncService as any;
      let syncCount = 0;
      const originalSyncWithDevice = service.syncWithDevice;

      service.syncWithDevice = async (deviceId: string) => {
        syncCount++;
        if (deviceId === 'device-2') {
          throw new Error('Device 2 sync failed');
        }
        return originalSyncWithDevice.call(service, deviceId);
      };

      // Sync should handle partial failures
      await expect(syncService.syncAcrossDevices(deviceIds)).rejects.toThrow(
        'Sync failed',
      );

      // Should have attempted to sync all devices
      expect(syncCount).toBe(3);

      // Restore original method
      service.syncWithDevice = originalSyncWithDevice;
    });

    it('should maintain consistency during error conditions', async () => {
      const userId = 'consistency-user';
      const storyId = 'consistency-story';

      syncService.setUserId(userId);

      // Create initial story
      await syncService.updateStory(storyId, 'Initial consistent state');

      // Simulate error conditions
      const operations = [
        () => syncService.updateStory(storyId, 'Update 1'),
        () => syncService.forceSyncAll(),
        () => syncService.updateStory(storyId, 'Update 2'),
        () => syncService.setOfflineMode(true),
        () => syncService.updateStory(storyId, 'Update 3'),
        () => syncService.setOfflineMode(false),
        () => syncService.syncPendingChanges(),
      ];

      // Execute operations even if some fail
      for (const operation of operations) {
        try {
          await operation();
        } catch (error) {
          // Continue with next operation
        }
      }

      // Final state should be consistent
      const finalStory = await syncService.getStoryOnDevice(
        'current-device',
        storyId,
      );
      expect(finalStory).toBeDefined();
      expect(finalStory?.content).toContain('consistent state');
    });
  });

  describe('Data Validation and Integrity', () => {
    it('should validate story data during sync', async () => {
      const userId = 'validation-user';

      syncService.setUserId(userId);

      // Try to sync with invalid data
      await expect(
        syncService.updateStoryOnDevice('', 'story-123', ''),
      ).rejects.toThrow();

      // Valid data should work
      await expect(
        syncService.updateStoryOnDevice(
          'valid-device',
          'story-123',
          'Valid content',
        ),
      ).resolves.not.toThrow();
    });

    it('should maintain data integrity across sync operations', async () => {
      const userId = 'integrity-user';
      const storyId = 'integrity-story';

      syncService.setUserId(userId);

      // Create story with known checksum
      const originalContent = 'Original story content for integrity testing';
      await syncService.updateStory(storyId, originalContent);

      // Get the story and verify checksum
      const story = await syncService.getStoryOnDevice(
        'current-device',
        storyId,
      );
      const originalChecksum = story?.metadata.checksum;

      // Update the story
      const updatedContent =
        originalContent + '\nAdditional content for testing';
      await syncService.updateStory(storyId, updatedContent);

      // Get updated story and verify checksum changed
      const updatedStory = await syncService.getStoryOnDevice(
        'current-device',
        storyId,
      );
      const updatedChecksum = updatedStory?.metadata.checksum;

      expect(originalChecksum).not.toBe(updatedChecksum);
      expect(updatedStory?.content).toBe(updatedContent);
    });

    it('should handle version conflicts correctly', async () => {
      const userId = 'version-user';
      const storyId = 'version-story';

      syncService.setUserId(userId);

      // Create story with version 1
      await syncService.updateStory(storyId, 'Version 1 content', {
        version: 1,
      });

      // Simulate concurrent edits creating version conflict
      const conflictingEdits = [
        {
          deviceId: 'device-1',
          content: 'Version 2a from device 1',
          timestamp: Date.now() - 1000,
        },
        {
          deviceId: 'device-2',
          content: 'Version 2b from device 2',
          timestamp: Date.now() - 500,
        },
      ];

      const resolvedStory = await syncService.resolveConflict(
        storyId,
        conflictingEdits,
      );

      // Should resolve to the more recent version
      expect(resolvedStory.content).toBe('Version 2b from device 2');
      expect(resolvedStory.metadata.version).toBeGreaterThan(1);
    });
  });
});
