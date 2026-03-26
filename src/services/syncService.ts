/**
 * Cross-Platform Story Synchronization Service
 *
 * Provides synchronization capabilities for story data across
 * multiple devices and platforms, including conflict resolution,
 * offline sync, and data consistency management.
 *
 * MIGRATION NOTE: Cross-device sync via Supabase has been disabled.
 * The service now operates in local-only mode using AsyncStorage.
 * When cross-device sync is needed, implement using Convex reactive queries
 * (useQuery for real-time data, mutations for writes).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

// Feature flag for cross-device sync (requires Convex implementation)
const CROSS_DEVICE_SYNC_ENABLED = false;

// Types for synchronization
export interface SyncDevice {
  deviceId: string;
  deviceType: 'ios' | 'android' | 'web';
  lastSyncTimestamp: string;
  userId: string;
  isOnline: boolean;
  appVersion: string;
  deviceInfo?: {
    model: string;
    os: string;
    osVersion: string;
  };
}

export interface SyncStory {
  id: string;
  content: string;
  metadata: {
    title?: string;
    wordCount: number;
    lastEditedBy: string;
    createdAt: string;
    updatedAt: string;
    version: number;
    checksum: string;
  };
  source: 'CreativeBridge' | 'Story_Quest' | 'File';
  userId: string;
  deviceId: string;
  syncStatus: 'pending' | 'synced' | 'conflict' | 'error';
  conflictData?: ConflictData;
}

export interface ConflictData {
  conflictId: string;
  conflictType: 'content' | 'metadata' | 'deletion';
  localVersion: Partial<SyncStory>;
  remoteVersion: Partial<SyncStory>;
  conflictTimestamp: string;
  resolutionStrategy?:
    | 'manual'
    | 'auto_latest'
    | 'auto_merge'
    | 'auto_local'
    | 'auto_remote';
  isResolved: boolean;
}

export interface SyncChange {
  id: string;
  storyId: string;
  changeType: 'create' | 'update' | 'delete';
  deviceId: string;
  userId: string;
  timestamp: string;
  changeData: any;
  isApplied: boolean;
  conflictResolved?: boolean;
}

export interface SyncStatus {
  isOnline: boolean;
  lastSyncTime: string | null;
  pendingChanges: number;
  conflictsCount: number;
  syncInProgress: boolean;
  devicesSynced: string[];
  errorMessages: string[];
}

export interface SyncConfiguration {
  autoSyncInterval: number; // milliseconds
  conflictResolution: 'manual' | 'auto_latest' | 'auto_merge';
  maxRetries: number;
  syncTimeout: number;
  enableRealTimeSync: boolean;
  enableOfflineMode: boolean;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
}

class SyncService {
  private deviceId: string;
  private userId: string | null = null;
  private isOnline: boolean = true;
  private isOfflineMode: boolean = false;
  private syncInProgress: boolean = false;
  private autoSyncTimer?: NodeJS.Timeout;
  private conflictQueue: ConflictData[] = [];
  private pendingChanges: SyncChange[] = [];

  // Configuration
  private config: SyncConfiguration = {
    autoSyncInterval: 30000, // 30 seconds
    conflictResolution: 'manual',
    maxRetries: 3,
    syncTimeout: 60000, // 1 minute
    enableRealTimeSync: true,
    enableOfflineMode: true,
    compressionEnabled: true,
    encryptionEnabled: false,
  };

  private readonly STORAGE_KEYS = {
    PENDING_CHANGES: 'sync_pending_changes',
    CONFLICTS: 'sync_conflicts',
    DEVICE_ID: 'sync_device_id',
    LAST_SYNC: 'sync_last_sync_time',
    OFFLINE_STORIES: 'sync_offline_stories',
  };

  constructor() {
    this.deviceId = this.generateDeviceId();
    this.initializeSync();
  }

  /**
   * Initialize synchronization service
   */
  private async initializeSync(): Promise<void> {
    try {
      // Load device ID or generate new one
      const storedDeviceId = await AsyncStorage.getItem(
        this.STORAGE_KEYS.DEVICE_ID,
      );
      if (storedDeviceId) {
        this.deviceId = storedDeviceId;
      } else {
        await AsyncStorage.setItem(this.STORAGE_KEYS.DEVICE_ID, this.deviceId);
      }

      // Load pending changes and conflicts
      await this.loadPendingChanges();
      await this.loadConflicts();

      // Set up network listener
      this.setupNetworkListener();

      if (!CROSS_DEVICE_SYNC_ENABLED) {
        console.log(
          '🔄 Sync service initialized (local-only mode — cross-device sync requires Convex implementation)',
        );
        return;
      }

      // Start auto-sync if enabled
      if (this.config.enableRealTimeSync) {
        this.startAutoSync();
      }

      console.log('🔄 Sync service initialized');
    } catch (error) {
      console.error('Sync initialization error:', error);
    }
  }

  /**
   * Set user ID for synchronization
   */
  setUserId(userId: string): void {
    this.userId = userId;
  }

  /**
   * Update story on specific device
   */
  async updateStoryOnDevice(
    deviceId: string,
    storyId: string,
    content: string,
    metadata?: any,
  ): Promise<void> {
    try {
      const story: Partial<SyncStory> = {
        id: storyId,
        content,
        metadata: {
          ...metadata,
          updatedAt: new Date().toISOString(),
          version: (metadata?.version || 0) + 1,
          lastEditedBy: deviceId,
          checksum: this.calculateChecksum(content),
        },
        deviceId,
        userId: this.userId || '',
        syncStatus: CROSS_DEVICE_SYNC_ENABLED ? 'pending' : 'synced',
      };

      // Save locally
      await this.saveStoryLocally(story as SyncStory);

      // Create sync change
      const change: SyncChange = {
        id: this.generateChangeId(),
        storyId,
        changeType: 'update',
        deviceId,
        userId: this.userId || '',
        timestamp: new Date().toISOString(),
        changeData: story,
        isApplied: !CROSS_DEVICE_SYNC_ENABLED,
      };

      this.pendingChanges.push(change);
      await this.savePendingChanges();

      console.log(`📝 Story ${storyId} updated on device ${deviceId}`);
    } catch (error) {
      console.error('Update story on device error:', error);
      throw new Error(
        `Failed to update story: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  /**
   * Sync stories across multiple devices
   */
  async syncAcrossDevices(deviceIds: string[]): Promise<void> {
    if (!CROSS_DEVICE_SYNC_ENABLED) {
      console.log('🔄 Cross-device sync is disabled. Skipping.');
      return;
    }

    if (this.syncInProgress) {
      console.log('Sync already in progress, skipping');
      return;
    }

    try {
      this.syncInProgress = true;

      for (const deviceId of deviceIds) {
        await this.syncWithDevice(deviceId);
      }

      // Update last sync time
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.LAST_SYNC,
        new Date().toISOString(),
      );

      console.log(`🔄 Synced across ${deviceIds.length} devices`);
    } catch (error) {
      console.error('Sync across devices error:', error);
      throw new Error(
        `Sync failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Get story from local storage
   */
  async getStoryOnDevice(
    deviceId: string,
    storyId: string,
  ): Promise<SyncStory | null> {
    try {
      return await this.getStoryLocally(storyId);
    } catch (error) {
      console.error('Get story on device error:', error);
      return null;
    }
  }

  /**
   * Resolve conflict between story versions
   */
  async resolveConflict(
    storyId: string,
    conflictingEdits: Array<{
      deviceId: string;
      content: string;
      timestamp: number;
    }>,
  ): Promise<SyncStory> {
    try {
      // Sort by timestamp (latest first)
      const sortedEdits = conflictingEdits.sort(
        (a, b) => b.timestamp - a.timestamp,
      );
      const latestEdit = sortedEdits[0];

      // Apply resolution strategy
      let resolvedContent: string;
      let resolutionStrategy: string;

      switch (this.config.conflictResolution) {
        case 'auto_latest':
          resolvedContent = latestEdit.content;
          resolutionStrategy = 'auto_latest';
          break;
        case 'auto_merge':
          resolvedContent = await this.mergeContent(sortedEdits);
          resolutionStrategy = 'auto_merge';
          break;
        default:
          // Manual resolution - return conflict for user decision
          const conflict = await this.createConflict(storyId, sortedEdits);
          throw new Error(
            `Manual conflict resolution required: ${conflict.conflictId}`,
          );
      }

      // Create resolved story
      const resolvedStory: SyncStory = {
        id: storyId,
        content: resolvedContent,
        metadata: {
          title: `Resolved Story ${storyId}`,
          wordCount: resolvedContent.split(' ').length,
          lastEditedBy: 'sync_service',
          createdAt: new Date(
            Math.min(...sortedEdits.map(e => e.timestamp)),
          ).toISOString(),
          updatedAt: new Date().toISOString(),
          version: Math.max(...sortedEdits.map((_, i) => i + 1)),
          checksum: this.calculateChecksum(resolvedContent),
        },
        source: 'CreativeBridge',
        userId: this.userId || '',
        deviceId: this.deviceId,
        syncStatus: 'synced',
      };

      // Save resolved story locally
      await this.saveStoryLocally(resolvedStory);

      console.log(
        `⚖️ Conflict resolved for story ${storyId} using ${resolutionStrategy}`,
      );
      return resolvedStory;
    } catch (error) {
      console.error('Resolve conflict error:', error);
      throw new Error(
        `Conflict resolution failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  /**
   * Set offline mode
   */
  setOfflineMode(enabled: boolean): void {
    this.isOfflineMode = enabled;
    console.log(`📱 Offline mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Update story with offline support
   */
  async updateStory(
    storyId: string,
    content: string,
    metadata?: any,
  ): Promise<void> {
    await this.updateStoryOnDevice(this.deviceId, storyId, content, metadata);
  }

  /**
   * Get pending changes for sync
   */
  async getPendingChanges(): Promise<SyncChange[]> {
    return [...this.pendingChanges];
  }

  /**
   * Sync pending changes (no-op when cross-device sync is disabled)
   */
  async syncPendingChanges(): Promise<void> {
    if (!CROSS_DEVICE_SYNC_ENABLED) {
      return;
    }

    if (
      !this.isOnline ||
      this.isOfflineMode ||
      this.pendingChanges.length === 0
    ) {
      return;
    }

    // TODO: Implement via Convex mutations when cross-device sync is enabled
    console.log('🔄 Cross-device sync pending Convex implementation');
  }

  /**
   * Get current sync status
   */
  async getSyncStatus(): Promise<SyncStatus> {
    const lastSyncTime = await AsyncStorage.getItem(
      this.STORAGE_KEYS.LAST_SYNC,
    );

    return {
      isOnline: this.isOnline,
      lastSyncTime,
      pendingChanges: this.pendingChanges.length,
      conflictsCount: this.conflictQueue.length,
      syncInProgress: this.syncInProgress,
      devicesSynced: [],
      errorMessages: [],
    };
  }

  /**
   * Force sync all data (local-only when cross-device sync is disabled)
   */
  async forceSyncAll(): Promise<void> {
    if (!CROSS_DEVICE_SYNC_ENABLED) {
      console.log('🔄 Cross-device sync disabled, operating locally only');
      return;
    }

    try {
      this.syncInProgress = true;
      await this.syncPendingChanges();
      await this.resolveAllConflicts();
      console.log('🔄 Force sync completed');
    } catch (error) {
      console.error('Force sync error:', error);
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  // Private helper methods

  private async syncWithDevice(deviceId: string): Promise<void> {
    // TODO: Implement via Convex when cross-device sync is enabled
    console.log(
      `🔄 Sync with device ${deviceId} pending Convex implementation`,
    );
  }

  private async mergeContent(
    edits: Array<{ content: string; timestamp: number }>,
  ): Promise<string> {
    const allContent = edits.map(edit => edit.content);
    const longestContent = allContent.reduce((longest, current) =>
      current.length > longest.length ? current : longest,
    );
    return longestContent;
  }

  private async resolveAllConflicts(): Promise<void> {
    for (const conflict of this.conflictQueue) {
      if (conflict.isResolved) continue;

      try {
        if (conflict.resolutionStrategy === 'auto_latest') {
          const latest =
            conflict.remoteVersion.metadata?.updatedAt >
            conflict.localVersion.metadata?.updatedAt
              ? conflict.remoteVersion
              : conflict.localVersion;

          if (latest.id) {
            await this.saveStoryLocally(latest as SyncStory);
            conflict.isResolved = true;
          }
        }
      } catch (error) {
        console.error('Resolve conflict error:', error);
      }
    }

    this.conflictQueue = this.conflictQueue.filter(
      conflict => !conflict.isResolved,
    );
    await this.saveConflicts();
  }

  private async createConflict(
    storyId: string,
    conflictingEdits: any[],
  ): Promise<ConflictData> {
    const conflict: ConflictData = {
      conflictId: this.generateConflictId(),
      conflictType: 'content',
      localVersion: { id: storyId },
      remoteVersion: { id: storyId },
      conflictTimestamp: new Date().toISOString(),
      isResolved: false,
    };

    this.conflictQueue.push(conflict);
    await this.saveConflicts();

    return conflict;
  }

  private async saveStoryLocally(story: SyncStory): Promise<void> {
    try {
      const stories = await this.getOfflineStories();
      const existingIndex = stories.findIndex(s => s.id === story.id);

      if (existingIndex >= 0) {
        stories[existingIndex] = story;
      } else {
        stories.push(story);
      }

      await AsyncStorage.setItem(
        this.STORAGE_KEYS.OFFLINE_STORIES,
        JSON.stringify(stories),
      );
    } catch (error) {
      console.error('Save story locally error:', error);
    }
  }

  private async getStoryLocally(storyId: string): Promise<SyncStory | null> {
    try {
      const stories = await this.getOfflineStories();
      return stories.find(story => story.id === storyId) || null;
    } catch (error) {
      console.error('Get story locally error:', error);
      return null;
    }
  }

  private async getOfflineStories(): Promise<SyncStory[]> {
    try {
      const storiesJson = await AsyncStorage.getItem(
        this.STORAGE_KEYS.OFFLINE_STORIES,
      );
      return storiesJson ? JSON.parse(storiesJson) : [];
    } catch (error) {
      console.error('Get offline stories error:', error);
      return [];
    }
  }

  private async loadPendingChanges(): Promise<void> {
    try {
      const changesJson = await AsyncStorage.getItem(
        this.STORAGE_KEYS.PENDING_CHANGES,
      );
      this.pendingChanges = changesJson ? JSON.parse(changesJson) : [];
    } catch (error) {
      console.error('Load pending changes error:', error);
      this.pendingChanges = [];
    }
  }

  private async savePendingChanges(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.PENDING_CHANGES,
        JSON.stringify(this.pendingChanges),
      );
    } catch (error) {
      console.error('Save pending changes error:', error);
    }
  }

  private async loadConflicts(): Promise<void> {
    try {
      const conflictsJson = await AsyncStorage.getItem(
        this.STORAGE_KEYS.CONFLICTS,
      );
      this.conflictQueue = conflictsJson ? JSON.parse(conflictsJson) : [];
    } catch (error) {
      console.error('Load conflicts error:', error);
      this.conflictQueue = [];
    }
  }

  private async saveConflicts(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.CONFLICTS,
        JSON.stringify(this.conflictQueue),
      );
    } catch (error) {
      console.error('Save conflicts error:', error);
    }
  }

  private setupNetworkListener(): void {
    NetInfo.addEventListener(state => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected || false;

      if (!wasOnline && this.isOnline && CROSS_DEVICE_SYNC_ENABLED) {
        console.log('📶 Back online, syncing pending changes');
        this.syncPendingChanges();
      }
    });
  }

  private startAutoSync(): void {
    if (!CROSS_DEVICE_SYNC_ENABLED) return;

    this.autoSyncTimer = setInterval(async () => {
      if (this.isOnline && !this.isOfflineMode && !this.syncInProgress) {
        await this.syncPendingChanges();
      }
    }, this.config.autoSyncInterval);
  }

  private calculateChecksum(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  private generateDeviceId(): string {
    return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateChangeId(): string {
    return `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateConflictId(): string {
    return `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
    }
  }
}

// Export singleton instance
export const syncService = new SyncService();
export default syncService;
