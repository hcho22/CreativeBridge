# Story Continuation API Documentation

## Overview

This document outlines the API interfaces for the Story Continuation features in CreativeBridge, including story import, management, analytics, and synchronization services.

## Story Import Service API

### `storyImportService`

#### Methods

##### `importFromFile(fileUri: string): Promise<ImportedStory>`

Imports a story from a text file.

**Parameters:**

- `fileUri` (string): URI of the file to import

**Returns:** Promise resolving to an `ImportedStory` object

**Example:**

```typescript
const story = await storyImportService.importFromFile(
  'file://path/to/story.txt',
);
```

##### `fetchUserStories(userId: string, options?: FetchOptions): Promise<Story[]>`

Fetches stories from the user's database.

**Parameters:**

- `userId` (string): User identifier
- `options` (FetchOptions, optional): Pagination and filtering options

**Returns:** Promise resolving to an array of `Story` objects

**Example:**

```typescript
const stories = await storyImportService.fetchUserStories('user-123', {
  limit: 20,
  offset: 0,
  source: 'CreativeBridge',
});
```

##### `validateStoryContent(content: string): ValidationResult`

Validates story content for import.

**Parameters:**

- `content` (string): Story content to validate

**Returns:** `ValidationResult` object with validation status

**Example:**

```typescript
const result = storyImportService.validateStoryContent(storyText);
if (result.isValid) {
  // Proceed with import
}
```

## Story Management Service API

### `storyManagementService`

#### Methods

##### `saveStory(story: StoryInput): Promise<Story>`

Saves a story to the database.

**Parameters:**

- `story` (StoryInput): Story data to save

**Returns:** Promise resolving to saved `Story` object

**Example:**

```typescript
const savedStory = await storyManagementService.saveStory({
  content: 'Story content',
  title: 'My Story',
  source: 'File',
  userId: 'user-123',
});
```

##### `searchStories(query: string, options?: SearchOptions): Promise<SearchResult[]>`

Searches stories by content and metadata.

**Parameters:**

- `query` (string): Search query
- `options` (SearchOptions, optional): Search parameters

**Returns:** Promise resolving to array of `SearchResult` objects

**Example:**

```typescript
const results = await storyManagementService.searchStories('adventure', {
  limit: 10,
  includeContent: true,
  sources: ['File', 'CreativeBridge'],
});
```

##### `updateStory(storyId: string, updates: StoryUpdate): Promise<Story>`

Updates an existing story.

**Parameters:**

- `storyId` (string): Story identifier
- `updates` (StoryUpdate): Fields to update

**Returns:** Promise resolving to updated `Story` object

**Example:**

```typescript
const updated = await storyManagementService.updateStory('story-123', {
  content: 'Updated content',
  metadata: { wordCount: 150 },
});
```

##### `deleteStory(storyId: string): Promise<void>`

Deletes a story from the database.

**Parameters:**

- `storyId` (string): Story identifier

**Returns:** Promise resolving when deletion is complete

**Example:**

```typescript
await storyManagementService.deleteStory('story-123');
```

## Analytics Service API

### `analyticsService`

#### Methods

##### `trackStoryImport(userId: string, source: ImportSource, success: boolean, metadata?: Record<string, any>): Promise<void>`

Tracks a story import event.

**Parameters:**

- `userId` (string): User identifier
- `source` (ImportSource): Import source ('file' | 'database' | 'story_quest')
- `success` (boolean): Whether import was successful
- `metadata` (Record<string, any>, optional): Additional event data

**Example:**

```typescript
await analyticsService.trackStoryImport('user-123', 'file', true, {
  fileSize: 2048,
  storyLength: 500,
});
```

##### `trackStoryContinuation(userId: string, storyId: string, success: boolean, metadata?: Record<string, any>): Promise<void>`

Tracks a story continuation event.

**Parameters:**

- `userId` (string): User identifier
- `storyId` (string): Story identifier
- `success` (boolean): Whether continuation was successful
- `metadata` (Record<string, any>, optional): Additional event data

**Example:**

```typescript
await analyticsService.trackStoryContinuation('user-123', 'story-456', true, {
  generatedWords: 150,
  aiModel: 'gpt-4',
});
```

##### `getUsageMetrics(startDate: string, endDate: string, userId?: string): Promise<UsageMetrics>`

Retrieves usage metrics for a date range.

**Parameters:**

- `startDate` (string): Start date (ISO format)
- `endDate` (string): End date (ISO format)
- `userId` (string, optional): Filter by specific user

**Returns:** Promise resolving to `UsageMetrics` object

**Example:**

```typescript
const metrics = await analyticsService.getUsageMetrics(
  '2024-01-01T00:00:00Z',
  '2024-01-31T23:59:59Z',
  'user-123',
);
```

##### `generateReport(reportType: ReportType, dateRange?: DateRange): Promise<AnalyticsReport>`

Generates an analytics report.

**Parameters:**

- `reportType` (ReportType): Type of report ('daily' | 'weekly' | 'monthly' | 'custom')
- `dateRange` (DateRange, optional): Custom date range for 'custom' reports

**Returns:** Promise resolving to `AnalyticsReport` object

**Example:**

```typescript
const report = await analyticsService.generateReport('weekly');
```

## Sync Service API

### `syncService`

#### Methods

##### `setUserId(userId: string): void`

Sets the user ID for synchronization.

**Parameters:**

- `userId` (string): User identifier

**Example:**

```typescript
syncService.setUserId('user-123');
```

##### `updateStoryOnDevice(deviceId: string, storyId: string, content: string, metadata?: any): Promise<void>`

Updates a story on a specific device.

**Parameters:**

- `deviceId` (string): Device identifier
- `storyId` (string): Story identifier
- `content` (string): Story content
- `metadata` (any, optional): Story metadata

**Example:**

```typescript
await syncService.updateStoryOnDevice(
  'device-123',
  'story-456',
  'Updated story content',
  { wordCount: 100 },
);
```

##### `syncAcrossDevices(deviceIds: string[]): Promise<void>`

Synchronizes stories across multiple devices.

**Parameters:**

- `deviceIds` (string[]): Array of device identifiers

**Example:**

```typescript
await syncService.syncAcrossDevices(['device-1', 'device-2', 'device-3']);
```

##### `resolveConflict(storyId: string, conflictingEdits: ConflictEdit[]): Promise<SyncStory>`

Resolves conflicts between story versions.

**Parameters:**

- `storyId` (string): Story identifier
- `conflictingEdits` (ConflictEdit[]): Array of conflicting edits

**Returns:** Promise resolving to resolved `SyncStory` object

**Example:**

```typescript
const resolved = await syncService.resolveConflict('story-123', [
  { deviceId: 'device-1', content: 'Version A', timestamp: 1000 },
  { deviceId: 'device-2', content: 'Version B', timestamp: 2000 },
]);
```

##### `setOfflineMode(enabled: boolean): void`

Enables or disables offline mode.

**Parameters:**

- `enabled` (boolean): Whether to enable offline mode

**Example:**

```typescript
syncService.setOfflineMode(true);
```

##### `getSyncStatus(): Promise<SyncStatus>`

Gets the current synchronization status.

**Returns:** Promise resolving to `SyncStatus` object

**Example:**

```typescript
const status = await syncService.getSyncStatus();
console.log(`Pending changes: ${status.pendingChanges}`);
```

## Advanced Search Service API

### `advancedSearchService`

#### Methods

##### `fullTextSearch(query: string, options?: SearchOptions): Promise<SearchResult[]>`

Performs full-text search across story content.

**Parameters:**

- `query` (string): Search query
- `options` (SearchOptions, optional): Search configuration

**Returns:** Promise resolving to array of `SearchResult` objects

**Example:**

```typescript
const results = await advancedSearchService.fullTextSearch('dragon adventure', {
  limit: 20,
  includeSnippets: true,
});
```

##### `searchByMetadata(metadata: SearchMetadata): Promise<SearchResult[]>`

Searches stories by metadata fields.

**Parameters:**

- `metadata` (SearchMetadata): Metadata search criteria

**Returns:** Promise resolving to array of `SearchResult` objects

**Example:**

```typescript
const results = await advancedSearchService.searchByMetadata({
  author: 'John Doe',
  genre: 'fantasy',
  wordCountMin: 500,
});
```

##### `getSuggestions(partialQuery: string): Promise<string[]>`

Gets search suggestions for partial queries.

**Parameters:**

- `partialQuery` (string): Partial search query

**Returns:** Promise resolving to array of suggestion strings

**Example:**

```typescript
const suggestions = await advancedSearchService.getSuggestions('adven');
// Returns: ['adventure', 'adventurous', 'adventures']
```

## Type Definitions

### Core Types

```typescript
interface Story {
  id: string;
  content: string;
  title?: string;
  source: 'CreativeBridge' | 'Story_Quest' | 'File';
  userId: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

interface ImportedStory extends Story {
  originalPath?: string;
  fileSize?: number;
  encoding?: string;
}

interface StoryInput {
  content: string;
  title?: string;
  source: string;
  userId: string;
  metadata?: Record<string, any>;
}

interface StoryUpdate {
  content?: string;
  title?: string;
  metadata?: Record<string, any>;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface SearchOptions {
  limit?: number;
  offset?: number;
  includeContent?: boolean;
  includeSnippets?: boolean;
  sources?: string[];
}

interface SearchResult {
  story: Story;
  relevanceScore: number;
  snippets?: string[];
  highlights?: string[];
}

interface FetchOptions {
  limit?: number;
  offset?: number;
  source?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'title';
  sortOrder?: 'asc' | 'desc';
}
```

### Analytics Types

```typescript
interface UsageMetrics {
  totalImports: number;
  uniqueUsers: number;
  importSuccessRate: number;
  continuationSuccessRate: number;
  popularSources: SourceUsage[];
}

interface SourceUsage {
  source: string;
  count: number;
  percentage: number;
}

interface UserEngagementMetrics {
  userId: string;
  sessionsThisWeek: number;
  sessionsThisMonth: number;
  totalStoryImports: number;
  totalStoryContinuations: number;
  engagementScore: number;
  favoriteSource: string;
  lastActiveDate?: string;
}

interface AnalyticsReport {
  reportId: string;
  reportType: ReportType;
  dateRange: DateRange;
  summary: ReportSummary;
  insights: string[];
  recommendations: string[];
  generatedAt: string;
}

type ReportType = 'daily' | 'weekly' | 'monthly' | 'custom';
type ImportSource = 'file' | 'database' | 'story_quest';

interface DateRange {
  start: string;
  end: string;
}
```

### Sync Types

```typescript
interface SyncStory {
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
}

interface ConflictEdit {
  deviceId: string;
  content: string;
  timestamp: number;
}

interface SyncStatus {
  isOnline: boolean;
  lastSyncTime: string | null;
  pendingChanges: number;
  conflictsCount: number;
  syncInProgress: boolean;
  devicesSynced: string[];
  errorMessages: string[];
}
```

## Error Handling

All API methods follow consistent error handling patterns:

```typescript
try {
  const result = await apiMethod();
  // Handle success
} catch (error) {
  if (error instanceof ValidationError) {
    // Handle validation errors
  } else if (error instanceof NetworkError) {
    // Handle network errors
  } else {
    // Handle other errors
  }
}
```

## Rate Limiting

Some API endpoints have rate limiting:

- Analytics tracking: 100 events per minute per user
- Search operations: 60 requests per minute per user
- Sync operations: 30 requests per minute per device

## Authentication

All API calls require valid authentication:

```typescript
// Ensure user is authenticated before making API calls
const user = await supabase.auth.getUser();
if (!user) {
  throw new Error('Authentication required');
}
```
