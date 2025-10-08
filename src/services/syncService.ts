/**
 * Cross-Platform Story Synchronization Service
 * 
 * Provides comprehensive synchronization capabilities for story data across
 * multiple devices and platforms, including real-time updates, conflict
 * resolution, offline sync, and data consistency management.
 */

import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

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
  resolutionStrategy?: 'manual' | 'auto_latest' | 'auto_merge' | 'auto_local' | 'auto_remote';
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
    encryptionEnabled: false
  };

  private readonly STORAGE_KEYS = {
    PENDING_CHANGES: 'sync_pending_changes',
    CONFLICTS: 'sync_conflicts',
    DEVICE_ID: 'sync_device_id',
    LAST_SYNC: 'sync_last_sync_time',
    OFFLINE_STORIES: 'sync_offline_stories'
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
      const storedDeviceId = await AsyncStorage.getItem(this.STORAGE_KEYS.DEVICE_ID);
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

      // Start auto-sync if enabled
      if (this.config.enableRealTimeSync) {
        this.startAutoSync();
      }

      // Set up real-time subscriptions
      if (this.config.enableRealTimeSync) {
        this.setupRealtimeSubscriptions();
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
    if (this.config.enableRealTimeSync && this.isOnline) {
      this.setupRealtimeSubscriptions();
    }
  }

  /**
   * Update story on specific device
   */
  async updateStoryOnDevice(deviceId: string, storyId: string, content: string, metadata?: any): Promise<void> {
    try {
      const story: Partial<SyncStory> = {
        id: storyId,
        content,
        metadata: {
          ...metadata,
          updatedAt: new Date().toISOString(),
          version: (metadata?.version || 0) + 1,
          lastEditedBy: deviceId,
          checksum: this.calculateChecksum(content)
        },
        deviceId,
        userId: this.userId || '',
        syncStatus: 'pending'
      };

      // Save locally first
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
        isApplied: false
      };

      this.pendingChanges.push(change);
      await this.savePendingChanges();

      // Attempt immediate sync if online
      if (this.isOnline && !this.isOfflineMode) {
        await this.syncPendingChanges();
      }

      console.log(`📝 Story ${storyId} updated on device ${deviceId}`);
    } catch (error) {
      console.error('Update story on device error:', error);
      throw new Error(`Failed to update story: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Sync stories across multiple devices
   */
  async syncAcrossDevices(deviceIds: string[]): Promise<void> {
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
      await AsyncStorage.setItem(this.STORAGE_KEYS.LAST_SYNC, new Date().toISOString());

      console.log(`🔄 Synced across ${deviceIds.length} devices`);
    } catch (error) {
      console.error('Sync across devices error:', error);
      throw new Error(`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Get story from specific device
   */
  async getStoryOnDevice(deviceId: string, storyId: string): Promise<SyncStory | null> {
    try {
      // Try to get from remote first if online
      if (this.isOnline && !this.isOfflineMode) {
        const { data: remoteStory, error } = await supabase
          .from('sync_stories')
          .select('*')
          .eq('id', storyId)
          .eq('device_id', deviceId)
          .single();

        if (!error && remoteStory) {
          return this.convertToSyncStory(remoteStory);
        }
      }

      // Fall back to local storage
      return await this.getStoryLocally(storyId);
    } catch (error) {
      console.error('Get story on device error:', error);
      return null;
    }
  }

  /**
   * Resolve conflict between story versions
   */
  async resolveConflict(storyId: string, conflictingEdits: Array<{
    deviceId: string;
    content: string;
    timestamp: number;
  }>): Promise<SyncStory> {
    try {
      // Sort by timestamp (latest first)
      const sortedEdits = conflictingEdits.sort((a, b) => b.timestamp - a.timestamp);
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
          throw new Error(`Manual conflict resolution required: ${conflict.conflictId}`);
      }

      // Create resolved story
      const resolvedStory: SyncStory = {
        id: storyId,
        content: resolvedContent,
        metadata: {
          title: `Resolved Story ${storyId}`,
          wordCount: resolvedContent.split(' ').length,
          lastEditedBy: 'sync_service',
          createdAt: new Date(Math.min(...sortedEdits.map(e => e.timestamp))).toISOString(),
          updatedAt: new Date().toISOString(),
          version: Math.max(...sortedEdits.map((_, i) => i + 1)),
          checksum: this.calculateChecksum(resolvedContent)
        },
        source: 'CreativeBridge',
        userId: this.userId || '',
        deviceId: this.deviceId,
        syncStatus: 'synced'
      };

      // Save resolved story
      await this.saveStoryLocally(resolvedStory);
      await this.uploadStoryToRemote(resolvedStory);

      console.log(`⚖️ Conflict resolved for story ${storyId} using ${resolutionStrategy}`);
      return resolvedStory;
    } catch (error) {
      console.error('Resolve conflict error:', error);
      throw new Error(`Conflict resolution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
  async updateStory(storyId: string, content: string, metadata?: any): Promise<void> {
    await this.updateStoryOnDevice(this.deviceId, storyId, content, metadata);
  }

  /**
   * Get pending changes for sync
   */
  async getPendingChanges(): Promise<SyncChange[]> {
    return [...this.pendingChanges];
  }

  /**
   * Sync pending changes to remote
   */
  async syncPendingChanges(): Promise<void> {
    if (!this.isOnline || this.isOfflineMode || this.pendingChanges.length === 0) {
      return;
    }

    try {
      for (const change of this.pendingChanges) {
        if (change.isApplied) continue;

        switch (change.changeType) {
          case 'create':
          case 'update':
            await this.syncStoryChange(change);
            break;
          case 'delete':
            await this.syncStoryDeletion(change);
            break;
        }

        change.isApplied = true;
      }

      // Remove applied changes
      this.pendingChanges = this.pendingChanges.filter(change => !change.isApplied);
      await this.savePendingChanges();

      console.log('✅ Pending changes synced');
    } catch (error) {
      console.error('Sync pending changes error:', error);
    }
  }

  /**
   * Get current sync status
   */
  async getSyncStatus(): Promise<SyncStatus> {
    const lastSyncTime = await AsyncStorage.getItem(this.STORAGE_KEYS.LAST_SYNC);
    
    return {
      isOnline: this.isOnline,
      lastSyncTime,
      pendingChanges: this.pendingChanges.length,
      conflictsCount: this.conflictQueue.length,
      syncInProgress: this.syncInProgress,
      devicesSynced: [], // Would be populated from device registry
      errorMessages: []
    };
  }

  /**
   * Force sync all data
   */
  async forceSyncAll(): Promise<void> {
    try {
      this.syncInProgress = true;

      // Sync pending changes
      await this.syncPendingChanges();

      // Pull remote changes
      await this.pullRemoteChanges();

      // Resolve any conflicts
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
    try {
      // Get device's last sync timestamp
      const device = await this.getDeviceInfo(deviceId);
      if (!device) return;

      // Get changes since last sync
      const changes = await this.getChangesSince(device.lastSyncTimestamp, deviceId);

      // Apply changes and detect conflicts
      for (const change of changes) {
        await this.applyChange(change);
      }

      // Update device sync timestamp
      await this.updateDeviceSyncTime(deviceId);
    } catch (error) {
      console.error(`Sync with device ${deviceId} error:`, error);
    }
  }

  private async syncStoryChange(change: SyncChange): Promise<void> {
    try {
      const story = change.changeData as SyncStory;

      // Check for conflicts
      const remoteStory = await this.getRemoteStory(story.id);
      if (remoteStory && this.hasConflict(story, remoteStory)) {
        await this.handleConflict(story, remoteStory);
        return;
      }

      // Upload to remote
      await this.uploadStoryToRemote(story);
    } catch (error) {
      console.error('Sync story change error:', error);
    }
  }

  private async syncStoryDeletion(change: SyncChange): Promise<void> {
    try {
      const { error } = await supabase
        .from('sync_stories')
        .delete()
        .eq('id', change.storyId)
        .eq('device_id', change.deviceId);

      if (error) {
        console.error('Delete story from remote error:', error);
      }
    } catch (error) {
      console.error('Sync story deletion error:', error);
    }
  }

  private async uploadStoryToRemote(story: SyncStory): Promise<void> {
    try {
      const { error } = await supabase
        .from('sync_stories')
        .upsert({
          id: story.id,
          content: story.content,
          metadata: story.metadata,
          source: story.source,
          user_id: story.userId,
          device_id: story.deviceId,
          sync_status: story.syncStatus,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Upload story to remote error:', error);
        throw error;
      }
    } catch (error) {
      console.error('Upload story error:', error);
      throw error;
    }
  }

  private async getRemoteStory(storyId: string): Promise<SyncStory | null> {
    try {
      const { data, error } = await supabase
        .from('sync_stories')
        .select('*')
        .eq('id', storyId)
        .single();

      if (error || !data) return null;

      return this.convertToSyncStory(data);
    } catch (error) {
      console.error('Get remote story error:', error);
      return null;
    }
  }

  private hasConflict(localStory: SyncStory, remoteStory: SyncStory): boolean {
    return (
      localStory.metadata.checksum !== remoteStory.metadata.checksum &&
      localStory.metadata.version !== remoteStory.metadata.version
    );
  }

  private async handleConflict(localStory: SyncStory, remoteStory: SyncStory): Promise<void> {
    const conflict: ConflictData = {
      conflictId: this.generateConflictId(),
      conflictType: 'content',
      localVersion: localStory,
      remoteVersion: remoteStory,
      conflictTimestamp: new Date().toISOString(),
      resolutionStrategy: this.config.conflictResolution,
      isResolved: false
    };

    this.conflictQueue.push(conflict);
    await this.saveConflicts();

    console.log(`⚠️ Conflict detected for story ${localStory.id}`);
  }

  private async createConflict(storyId: string, conflictingEdits: any[]): Promise<ConflictData> {
    const conflict: ConflictData = {
      conflictId: this.generateConflictId(),
      conflictType: 'content',
      localVersion: { id: storyId },
      remoteVersion: { id: storyId },
      conflictTimestamp: new Date().toISOString(),
      isResolved: false
    };

    this.conflictQueue.push(conflict);
    await this.saveConflicts();

    return conflict;
  }

  private async mergeContent(edits: Array<{ content: string; timestamp: number }>): Promise<string> {
    // Simple merge strategy - could be enhanced with diff algorithms
    const allContent = edits.map(edit => edit.content);
    const longestContent = allContent.reduce((longest, current) => 
      current.length > longest.length ? current : longest
    );

    return longestContent;
  }

  private async pullRemoteChanges(): Promise<void> {
    try {
      const lastSyncTime = await AsyncStorage.getItem(this.STORAGE_KEYS.LAST_SYNC) || '1970-01-01T00:00:00Z';

      const { data: remoteChanges, error } = await supabase
        .from('sync_stories')
        .select('*')
        .eq('user_id', this.userId)
        .gt('updated_at', lastSyncTime);

      if (error) {
        console.error('Pull remote changes error:', error);
        return;
      }

      for (const remoteStory of remoteChanges || []) {
        const localStory = await this.getStoryLocally(remoteStory.id);
        
        if (!localStory) {
          // New story from remote
          await this.saveStoryLocally(this.convertToSyncStory(remoteStory));
        } else if (this.hasConflict(localStory, this.convertToSyncStory(remoteStory))) {
          // Conflict detected
          await this.handleConflict(localStory, this.convertToSyncStory(remoteStory));
        } else if (remoteStory.updated_at > localStory.metadata.updatedAt) {
          // Remote is newer, update local
          await this.saveStoryLocally(this.convertToSyncStory(remoteStory));
        }
      }
    } catch (error) {
      console.error('Pull remote changes error:', error);
    }
  }

  private async resolveAllConflicts(): Promise<void> {
    for (const conflict of this.conflictQueue) {
      if (conflict.isResolved) continue;

      try {
        if (conflict.resolutionStrategy === 'auto_latest') {
          // Auto-resolve with latest timestamp
          const latest = conflict.remoteVersion.metadata?.updatedAt > conflict.localVersion.metadata?.updatedAt 
            ? conflict.remoteVersion 
            : conflict.localVersion;

          if (latest.id) {
            await this.saveStoryLocally(latest as SyncStory);
            conflict.isResolved = true;
          }
        }
        // Other resolution strategies would be implemented here
      } catch (error) {
        console.error('Resolve conflict error:', error);
      }
    }

    // Remove resolved conflicts
    this.conflictQueue = this.conflictQueue.filter(conflict => !conflict.isResolved);
    await this.saveConflicts();
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

      await AsyncStorage.setItem(this.STORAGE_KEYS.OFFLINE_STORIES, JSON.stringify(stories));
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
      const storiesJson = await AsyncStorage.getItem(this.STORAGE_KEYS.OFFLINE_STORIES);
      return storiesJson ? JSON.parse(storiesJson) : [];
    } catch (error) {
      console.error('Get offline stories error:', error);
      return [];
    }
  }

  private async loadPendingChanges(): Promise<void> {
    try {
      const changesJson = await AsyncStorage.getItem(this.STORAGE_KEYS.PENDING_CHANGES);
      this.pendingChanges = changesJson ? JSON.parse(changesJson) : [];
    } catch (error) {
      console.error('Load pending changes error:', error);
      this.pendingChanges = [];
    }
  }

  private async savePendingChanges(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEYS.PENDING_CHANGES, JSON.stringify(this.pendingChanges));
    } catch (error) {
      console.error('Save pending changes error:', error);
    }
  }

  private async loadConflicts(): Promise<void> {
    try {
      const conflictsJson = await AsyncStorage.getItem(this.STORAGE_KEYS.CONFLICTS);
      this.conflictQueue = conflictsJson ? JSON.parse(conflictsJson) : [];
    } catch (error) {
      console.error('Load conflicts error:', error);
      this.conflictQueue = [];
    }
  }

  private async saveConflicts(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEYS.CONFLICTS, JSON.stringify(this.conflictQueue));
    } catch (error) {
      console.error('Save conflicts error:', error);
    }
  }

  private setupNetworkListener(): void {
    NetInfo.addEventListener(state => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected || false;

      if (!wasOnline && this.isOnline) {
        // Back online - sync pending changes
        console.log('📶 Back online, syncing pending changes');
        this.syncPendingChanges();
      }
    });
  }

  private startAutoSync(): void {
    this.autoSyncTimer = setInterval(async () => {
      if (this.isOnline && !this.isOfflineMode && !this.syncInProgress) {
        await this.syncPendingChanges();
      }
    }, this.config.autoSyncInterval);
  }

  private setupRealtimeSubscriptions(): void {
    if (!this.userId) return;

    supabase
      .channel('story_sync')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'sync_stories',
          filter: `user_id=eq.${this.userId}`
        },
        async (payload) => {
          console.log('📡 Real-time sync change received:', payload);
          await this.handleRealtimeChange(payload);
        }
      )
      .subscribe();
  }

  private async handleRealtimeChange(payload: any): Promise<void> {
    try {
      if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
        const remoteStory = this.convertToSyncStory(payload.new);
        const localStory = await this.getStoryLocally(remoteStory.id);

        if (!localStory || remoteStory.metadata.version > localStory.metadata.version) {
          await this.saveStoryLocally(remoteStory);
          console.log(`🔄 Story ${remoteStory.id} updated from real-time sync`);
        }
      }
    } catch (error) {
      console.error('Handle real-time change error:', error);
    }
  }

  private convertToSyncStory(data: any): SyncStory {
    return {
      id: data.id,
      content: data.content,
      metadata: data.metadata || {},
      source: data.source || 'CreativeBridge',
      userId: data.user_id,
      deviceId: data.device_id,
      syncStatus: data.sync_status || 'synced'
    };
  }

  private calculateChecksum(content: string): string {
    // Simple checksum calculation
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
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

  private async getDeviceInfo(deviceId: string): Promise<SyncDevice | null> {
    // This would query a device registry
    return null;
  }

  private async getChangesSince(timestamp: string, deviceId: string): Promise<SyncChange[]> {
    // This would query changes since timestamp
    return [];
  }

  private async applyChange(change: SyncChange): Promise<void> {
    // Apply change locally
  }

  private async updateDeviceSyncTime(deviceId: string): Promise<void> {
    // Update device sync timestamp
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