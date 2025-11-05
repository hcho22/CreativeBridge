# Story Continuation Code Examples

## Overview

This document provides practical code examples for implementing and using the Story Continuation features in CreativeBridge.

## Basic Usage Examples

### Importing Stories from Files

```typescript
import { storyImportService } from '../services/storyImportService';
import DocumentPicker from 'react-native-document-picker';

// Example: File import with error handling
async function importStoryFromFile() {
  try {
    // Open file picker
    const result = await DocumentPicker.pick({
      type: [DocumentPicker.types.plainText],
      copyTo: 'cachesDirectory',
    });

    if (result.length > 0) {
      const file = result[0];

      // Validate file
      if (file.size > 10 * 1024 * 1024) {
        // 10MB limit
        throw new Error('File too large');
      }

      // Import story
      const importedStory = await storyImportService.importFromFile(
        file.fileCopyUri,
      );

      console.log('Story imported successfully:', {
        id: importedStory.id,
        title: importedStory.title,
        wordCount: importedStory.metadata?.wordCount,
      });

      return importedStory;
    }
  } catch (error) {
    if (DocumentPicker.isCancel(error)) {
      console.log('User cancelled file picker');
    } else {
      console.error('File import error:', error);
      throw error;
    }
  }
}

// Example: Batch file import
async function importMultipleStories(fileUris: string[]) {
  const results = [];

  for (const fileUri of fileUris) {
    try {
      const story = await storyImportService.importFromFile(fileUri);
      results.push({ success: true, story });
    } catch (error) {
      results.push({ success: false, error: error.message, fileUri });
    }
  }

  return results;
}
```

### Fetching Stories from Database

```typescript
import { storyManagementService } from '../services/storyManagementService';

// Example: Fetch user stories with pagination
async function fetchUserStoriesWithPagination(
  userId: string,
  page: number = 1,
) {
  const limit = 20;
  const offset = (page - 1) * limit;

  try {
    const stories = await storyManagementService.getUserStories(userId, {
      limit,
      offset,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    });

    return {
      stories,
      hasMore: stories.length === limit,
      currentPage: page,
      totalShown: offset + stories.length,
    };
  } catch (error) {
    console.error('Failed to fetch stories:', error);
    throw error;
  }
}

// Example: Search stories with filters
async function searchStoriesWithFilters(query: string, filters: any) {
  try {
    const searchOptions = {
      limit: 50,
      includeSnippets: true,
      sources: filters.sources || ['CreativeBridge', 'File', 'Story_Quest'],
      dateRange: filters.dateRange,
      minWordCount: filters.minWordCount,
      maxWordCount: filters.maxWordCount,
    };

    const results = await storyManagementService.searchStories(
      query,
      searchOptions,
    );

    return results.map(result => ({
      story: result.story,
      relevanceScore: result.relevanceScore,
      snippet: result.snippets?.[0] || '',
      matchedTerms: result.highlights || [],
    }));
  } catch (error) {
    console.error('Search failed:', error);
    return [];
  }
}
```

## Analytics Implementation Examples

### Event Tracking

```typescript
import { analyticsService } from '../services/analyticsService';

// Example: Track story import events
class StoryImportTracker {
  static async trackImportAttempt(
    userId: string,
    source: 'file' | 'database' | 'story_quest',
  ) {
    const startTime = Date.now();

    try {
      // Track import start
      await analyticsService.trackUserEngagement(userId, 'import_started', {
        source,
        timestamp: startTime,
      });

      return startTime;
    } catch (error) {
      console.error('Failed to track import attempt:', error);
    }
  }

  static async trackImportSuccess(
    userId: string,
    source: 'file' | 'database' | 'story_quest',
    startTime: number,
    metadata: any,
  ) {
    const duration = Date.now() - startTime;

    try {
      // Track successful import
      await analyticsService.trackStoryImport(userId, source, true, {
        ...metadata,
        duration,
        timestamp: Date.now(),
      });

      // Track performance
      await analyticsService.trackPerformance('story_import', duration, true, {
        source,
        fileSize: metadata.fileSize,
        wordCount: metadata.wordCount,
      });
    } catch (error) {
      console.error('Failed to track import success:', error);
    }
  }

  static async trackImportFailure(
    userId: string,
    source: 'file' | 'database' | 'story_quest',
    startTime: number,
    error: Error,
  ) {
    const duration = Date.now() - startTime;

    try {
      // Track failed import
      await analyticsService.trackStoryImport(userId, source, false, {
        error: error.message,
        duration,
        timestamp: Date.now(),
      });

      // Track error
      await analyticsService.trackError(userId, 'import_error', error.message, {
        source,
        duration,
      });
    } catch (trackingError) {
      console.error('Failed to track import failure:', trackingError);
    }
  }
}

// Usage example
async function importStoryWithTracking(userId: string, fileUri: string) {
  const startTime = await StoryImportTracker.trackImportAttempt(userId, 'file');

  try {
    const story = await storyImportService.importFromFile(fileUri);

    await StoryImportTracker.trackImportSuccess(userId, 'file', startTime, {
      storyId: story.id,
      fileSize: story.metadata?.fileSize,
      wordCount: story.metadata?.wordCount,
      encoding: story.metadata?.encoding,
    });

    return story;
  } catch (error) {
    await StoryImportTracker.trackImportFailure(
      userId,
      'file',
      startTime,
      error,
    );
    throw error;
  }
}
```

### Analytics Dashboard Integration

```typescript
import React, { useState, useEffect } from 'react';
import { analyticsService } from '../services/analyticsService';
import AnalyticsDashboard from '../components/analytics/AnalyticsDashboard';

// Example: Analytics dashboard with real-time updates
const AnalyticsScreen: React.FC = () => {
  const [dashboardVisible, setDashboardVisible] = useState(false);
  const [userRole, setUserRole] = useState<'user' | 'admin'>('user');

  // Check user role on mount
  useEffect(() => {
    checkUserRole();
  }, []);

  const checkUserRole = async () => {
    try {
      // Get user profile and check role
      const profile = await getCurrentUserProfile();
      setUserRole(profile.metadata?.role === 'admin' ? 'admin' : 'user');
    } catch (error) {
      console.error('Failed to check user role:', error);
    }
  };

  const showDashboard = () => {
    setDashboardVisible(true);
  };

  const hideDashboard = () => {
    setDashboardVisible(false);
  };

  return (
    <>
      <TouchableOpacity onPress={showDashboard}>
        <Text>View Analytics</Text>
      </TouchableOpacity>

      <AnalyticsDashboard
        visible={dashboardVisible}
        onClose={hideDashboard}
        userRole={userRole}
      />
    </>
  );
};

// Example: Custom analytics hook
function useAnalytics(userId: string) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadMetrics();
  }, [userId]);

  const loadMetrics = async () => {
    try {
      setLoading(true);

      const endDate = new Date().toISOString();
      const startDate = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000,
      ).toISOString();

      const [usageMetrics, engagementMetrics] = await Promise.all([
        analyticsService.getUsageMetrics(startDate, endDate, userId),
        analyticsService.getUserEngagementMetrics(userId),
      ]);

      setMetrics({ usage: usageMetrics, engagement: engagementMetrics });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { metrics, loading, error, refresh: loadMetrics };
}
```

## Synchronization Examples

### Basic Sync Operations

```typescript
import { syncService } from '../services/syncService';

// Example: Initialize sync for user
class SyncManager {
  static async initializeSync(userId: string) {
    try {
      // Set user for sync
      syncService.setUserId(userId);

      // Get initial sync status
      const status = await syncService.getSyncStatus();
      console.log('Sync initialized:', status);

      // Force initial sync if needed
      if (status.pendingChanges > 0) {
        await syncService.syncPendingChanges();
      }

      return status;
    } catch (error) {
      console.error('Sync initialization failed:', error);
      throw error;
    }
  }

  static async updateStoryWithSync(
    storyId: string,
    content: string,
    metadata?: any,
  ) {
    try {
      // Update story locally and queue for sync
      await syncService.updateStory(storyId, content, metadata);

      // Check sync status
      const status = await syncService.getSyncStatus();

      return {
        updated: true,
        pendingSync: status.pendingChanges > 0,
        syncStatus: status,
      };
    } catch (error) {
      console.error('Story update failed:', error);
      throw error;
    }
  }

  static async handleOfflineMode(isOnline: boolean) {
    try {
      if (isOnline) {
        // Coming back online - sync pending changes
        syncService.setOfflineMode(false);
        await syncService.syncPendingChanges();
        console.log('Synced pending changes after coming online');
      } else {
        // Going offline - enable offline mode
        syncService.setOfflineMode(true);
        console.log('Enabled offline mode');
      }
    } catch (error) {
      console.error('Offline mode handling failed:', error);
    }
  }
}

// Example: Multi-device sync
async function syncAcrossUserDevices(userId: string) {
  try {
    // Get user's registered devices
    const devices = await getUserDevices(userId);
    const deviceIds = devices.map(device => device.id);

    // Sync across all devices
    await syncService.syncAcrossDevices(deviceIds);

    // Get final sync status
    const status = await syncService.getSyncStatus();

    return {
      syncedDevices: deviceIds.length,
      pendingChanges: status.pendingChanges,
      conflicts: status.conflictsCount,
    };
  } catch (error) {
    console.error('Multi-device sync failed:', error);
    throw error;
  }
}
```

### Conflict Resolution

```typescript
// Example: Automated conflict resolution
class ConflictResolver {
  static async resolveStoryConflicts(storyId: string) {
    try {
      // Get conflicting versions
      const conflicts = await getStoryConflicts(storyId);

      if (conflicts.length === 0) {
        return { resolved: false, message: 'No conflicts found' };
      }

      // Prepare conflict edits for resolution
      const conflictingEdits = conflicts.map(conflict => ({
        deviceId: conflict.deviceId,
        content: conflict.content,
        timestamp: new Date(conflict.timestamp).getTime(),
      }));

      // Resolve using sync service
      const resolvedStory = await syncService.resolveConflict(
        storyId,
        conflictingEdits,
      );

      return {
        resolved: true,
        resolvedStory,
        strategy: 'latest_timestamp',
        conflictsResolved: conflicts.length,
      };
    } catch (error) {
      console.error('Conflict resolution failed:', error);
      return { resolved: false, error: error.message };
    }
  }

  static async handleManualConflictResolution(
    storyId: string,
    chosenVersion: 'local' | 'remote' | 'merged',
    mergedContent?: string,
  ) {
    try {
      const conflicts = await getStoryConflicts(storyId);
      const conflict = conflicts[0]; // Assuming single conflict

      let finalContent: string;

      switch (chosenVersion) {
        case 'local':
          finalContent = conflict.localVersion.content;
          break;
        case 'remote':
          finalContent = conflict.remoteVersion.content;
          break;
        case 'merged':
          if (!mergedContent) {
            throw new Error('Merged content required');
          }
          finalContent = mergedContent;
          break;
        default:
          throw new Error('Invalid version choice');
      }

      // Update story with chosen content
      await syncService.updateStory(storyId, finalContent, {
        resolvedConflict: true,
        resolutionStrategy: chosenVersion,
        resolvedAt: new Date().toISOString(),
      });

      return { resolved: true, chosenVersion, finalContent };
    } catch (error) {
      console.error('Manual conflict resolution failed:', error);
      throw error;
    }
  }
}
```

## Advanced Search Examples

### Full-Text Search Implementation

```typescript
import { advancedSearchService } from '../services/advancedSearchService';

// Example: Advanced search with highlighting
class StorySearchManager {
  static async performAdvancedSearch(query: string, options: any = {}) {
    try {
      const searchOptions = {
        limit: options.limit || 20,
        includeSnippets: true,
        highlightMatches: true,
        fuzzySearch: options.fuzzy || false,
        synonyms: options.useSynonyms || true,
        ...options,
      };

      const results = await advancedSearchService.fullTextSearch(
        query,
        searchOptions,
      );

      return results.map(result => ({
        story: result.story,
        relevanceScore: result.relevanceScore,
        snippet: this.formatSnippet(result.snippets?.[0], query),
        highlights: result.highlights || [],
        matchedTerms: this.extractMatchedTerms(query, result.story.content),
      }));
    } catch (error) {
      console.error('Advanced search failed:', error);
      return [];
    }
  }

  static formatSnippet(snippet: string, query: string): string {
    if (!snippet) return '';

    const queryTerms = query.toLowerCase().split(/\s+/);
    let formattedSnippet = snippet;

    queryTerms.forEach(term => {
      const regex = new RegExp(`(${term})`, 'gi');
      formattedSnippet = formattedSnippet.replace(regex, '<mark>$1</mark>');
    });

    return formattedSnippet;
  }

  static extractMatchedTerms(query: string, content: string): string[] {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const contentLower = content.toLowerCase();

    return queryTerms.filter(term => contentLower.includes(term));
  }

  static async getSearchSuggestions(partialQuery: string): Promise<string[]> {
    try {
      if (partialQuery.length < 2) return [];

      const suggestions = await advancedSearchService.getSuggestions(
        partialQuery,
      );

      // Add some intelligent suggestions based on common patterns
      const contextualSuggestions =
        this.generateContextualSuggestions(partialQuery);

      return [...new Set([...suggestions, ...contextualSuggestions])].slice(
        0,
        10,
      );
    } catch (error) {
      console.error('Failed to get search suggestions:', error);
      return [];
    }
  }

  private static generateContextualSuggestions(partial: string): string[] {
    const commonPatterns = {
      adv: ['adventure', 'advanced', 'advent'],
      fant: ['fantasy', 'fantastic'],
      sci: ['science fiction', 'sci-fi'],
      rom: ['romance', 'romantic'],
      myst: ['mystery', 'mysterious'],
      hor: ['horror', 'horrible'],
    };

    return commonPatterns[partial.toLowerCase()] || [];
  }
}

// Example: Search with filters and facets
async function searchWithFiltersAndFacets(query: string) {
  try {
    // Perform main search
    const searchResults = await StorySearchManager.performAdvancedSearch(
      query,
      {
        limit: 100, // Get more results for faceting
        includeMetadata: true,
      },
    );

    // Generate facets from results
    const facets = generateFacets(searchResults);

    return {
      results: searchResults.slice(0, 20), // Show first 20
      facets,
      totalFound: searchResults.length,
      query,
    };
  } catch (error) {
    console.error('Search with facets failed:', error);
    throw error;
  }
}

function generateFacets(results: any[]) {
  const facets = {
    sources: {},
    authors: {},
    genres: {},
    wordCountRanges: {
      '0-1000': 0,
      '1001-5000': 0,
      '5001-10000': 0,
      '10000+': 0,
    },
  };

  results.forEach(result => {
    const story = result.story;

    // Source facet
    facets.sources[story.source] = (facets.sources[story.source] || 0) + 1;

    // Author facet
    const author = story.metadata?.author || 'Unknown';
    facets.authors[author] = (facets.authors[author] || 0) + 1;

    // Genre facet
    const genre = story.metadata?.genre || 'Unspecified';
    facets.genres[genre] = (facets.genres[genre] || 0) + 1;

    // Word count range facet
    const wordCount = story.metadata?.wordCount || 0;
    if (wordCount <= 1000) {
      facets.wordCountRanges['0-1000']++;
    } else if (wordCount <= 5000) {
      facets.wordCountRanges['1001-5000']++;
    } else if (wordCount <= 10000) {
      facets.wordCountRanges['5001-10000']++;
    } else {
      facets.wordCountRanges['10000+']++;
    }
  });

  return facets;
}
```

## Error Handling Examples

### Comprehensive Error Handling

```typescript
// Example: Centralized error handling for story operations
class StoryErrorHandler {
  static async handleStoryOperation<T>(
    operation: () => Promise<T>,
    context: string,
    userId?: string,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      return this.processError(error, context, userId);
    }
  }

  private static async processError(
    error: any,
    context: string,
    userId?: string,
  ): Promise<never> {
    const errorInfo = {
      context,
      userId,
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
    };

    // Log error for debugging
    console.error(`Story operation error in ${context}:`, errorInfo);

    // Track error in analytics
    if (userId) {
      try {
        await analyticsService.trackError(userId, context, error.message, {
          errorType: error.name,
          context,
        });
      } catch (trackingError) {
        console.error('Failed to track error:', trackingError);
      }
    }

    // Convert to user-friendly error
    const userError = this.createUserFriendlyError(error, context);
    throw userError;
  }

  private static createUserFriendlyError(error: any, context: string): Error {
    const errorMappings = {
      IMPORT_001: 'The file format is not supported. Please use a .txt file.',
      IMPORT_002: 'The file is too large. Maximum size is 10MB.',
      IMPORT_003: 'The file encoding is not supported. Please save as UTF-8.',
      SYNC_001: 'Network connection failed. Please check your internet.',
      SYNC_002: 'Authentication failed. Please log in again.',
      AI_001: 'Story generation timed out. Please try with shorter content.',
      SEARCH_001: 'Search is temporarily unavailable. Please try again later.',
    };

    // Check for specific error codes
    const errorCode = this.extractErrorCode(error.message);
    if (errorCode && errorMappings[errorCode]) {
      return new Error(errorMappings[errorCode]);
    }

    // Generic error messages by context
    const contextMessages = {
      story_import:
        'Failed to import story. Please check the file and try again.',
      story_search: 'Search failed. Please try again or contact support.',
      story_sync: 'Synchronization failed. Your changes are saved locally.',
      ai_generation: 'Story generation failed. Please try again.',
    };

    return new Error(
      contextMessages[context] || 'An unexpected error occurred.',
    );
  }

  private static extractErrorCode(message: string): string | null {
    const match = message.match(/([A-Z]+_\d+)/);
    return match ? match[1] : null;
  }
}

// Usage examples with error handling
async function importStoryWithErrorHandling(userId: string, fileUri: string) {
  return StoryErrorHandler.handleStoryOperation(
    () => storyImportService.importFromFile(fileUri),
    'story_import',
    userId,
  );
}

async function searchStoriesWithErrorHandling(query: string, userId?: string) {
  return StoryErrorHandler.handleStoryOperation(
    () => storyManagementService.searchStories(query),
    'story_search',
    userId,
  );
}
```

## React Component Integration Examples

### Story Import Component

```typescript
import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import DocumentPicker from 'react-native-document-picker';
import { storyImportService } from '../services/storyImportService';
import { useAuth } from '../context/AuthContext';

const StoryImportComponent: React.FC = () => {
  const { user } = useAuth();
  const [importing, setImporting] = useState(false);
  const [importedStory, setImportedStory] = useState(null);

  const handleFileImport = useCallback(async () => {
    if (!user) return;

    try {
      setImporting(true);

      // Pick file
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.plainText],
        copyTo: 'cachesDirectory',
      });

      if (result.length > 0) {
        const file = result[0];

        // Import with error handling
        const story = await importStoryWithErrorHandling(
          user.id,
          file.fileCopyUri,
        );

        setImportedStory(story);
        Alert.alert('Success', 'Story imported successfully!');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setImporting(false);
    }
  }, [user]);

  return (
    <View style={{ padding: 20 }}>
      <TouchableOpacity
        onPress={handleFileImport}
        disabled={importing || !user}
        style={{
          backgroundColor: importing ? '#ccc' : '#007AFF',
          padding: 15,
          borderRadius: 8,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: 'white', fontSize: 16 }}>
          {importing ? 'Importing...' : 'Import Story from File'}
        </Text>
      </TouchableOpacity>

      {importedStory && (
        <View style={{ marginTop: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold' }}>
            Imported: {importedStory.title || 'Untitled Story'}
          </Text>
          <Text style={{ color: '#666', marginTop: 5 }}>
            Word count: {importedStory.metadata?.wordCount || 'Unknown'}
          </Text>
        </View>
      )}
    </View>
  );
};

export default StoryImportComponent;
```

### Search Component with Real-time Results

```typescript
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  TextInput,
  FlatList,
  Text,
  TouchableOpacity,
} from 'react-native';
import { debounce } from 'lodash';
import { StorySearchManager } from '../services/storySearchManager';

const StorySearchComponent: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

  // Debounced search function
  const debouncedSearch = useMemo(
    () =>
      debounce(async (searchQuery: string) => {
        if (searchQuery.length < 2) {
          setResults([]);
          return;
        }

        try {
          setLoading(true);
          const searchResults = await StorySearchManager.performAdvancedSearch(
            searchQuery,
          );
          setResults(searchResults);
        } catch (error) {
          console.error('Search failed:', error);
          setResults([]);
        } finally {
          setLoading(false);
        }
      }, 300),
    [],
  );

  // Get suggestions as user types
  const debouncedSuggestions = useMemo(
    () =>
      debounce(async (partialQuery: string) => {
        if (partialQuery.length < 2) {
          setSuggestions([]);
          return;
        }

        try {
          const newSuggestions = await StorySearchManager.getSearchSuggestions(
            partialQuery,
          );
          setSuggestions(newSuggestions);
        } catch (error) {
          console.error('Failed to get suggestions:', error);
        }
      }, 200),
    [],
  );

  useEffect(() => {
    debouncedSearch(query);
    debouncedSuggestions(query);
  }, [query, debouncedSearch, debouncedSuggestions]);

  const renderSearchResult = ({ item }) => (
    <TouchableOpacity
      style={{ padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee' }}
    >
      <Text style={{ fontSize: 16, fontWeight: 'bold' }}>
        {item.story.title}
      </Text>
      <Text style={{ color: '#666', marginTop: 5 }} numberOfLines={2}>
        {item.snippet}
      </Text>
      <Text style={{ color: '#007AFF', marginTop: 5, fontSize: 12 }}>
        Relevance: {(item.relevanceScore * 100).toFixed(1)}%
      </Text>
    </TouchableOpacity>
  );

  const renderSuggestion = ({ item }) => (
    <TouchableOpacity
      onPress={() => setQuery(item)}
      style={{
        padding: 10,
        backgroundColor: '#f5f5f5',
        marginRight: 5,
        borderRadius: 5,
      }}
    >
      <Text>{item}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search stories..."
        style={{
          borderWidth: 1,
          borderColor: '#ccc',
          padding: 10,
          borderRadius: 5,
          fontSize: 16,
        }}
      />

      {suggestions.length > 0 && (
        <FlatList
          data={suggestions}
          renderItem={renderSuggestion}
          keyExtractor={item => item}
          horizontal
          style={{ marginTop: 10, maxHeight: 40 }}
          showsHorizontalScrollIndicator={false}
        />
      )}

      {loading && (
        <Text style={{ textAlign: 'center', marginTop: 20, color: '#666' }}>
          Searching...
        </Text>
      )}

      <FlatList
        data={results}
        renderItem={renderSearchResult}
        keyExtractor={item => item.story.id}
        style={{ marginTop: 20 }}
        ListEmptyComponent={
          !loading && query.length >= 2 ? (
            <Text style={{ textAlign: 'center', color: '#666', marginTop: 20 }}>
              No stories found for "{query}"
            </Text>
          ) : null
        }
      />
    </View>
  );
};

export default StorySearchComponent;
```

These examples demonstrate practical implementation patterns for the Story Continuation features, including error handling, performance optimization, and user experience considerations.
