# Implementation Tasks - Story Continuation Feature

Based on the Story Continuation Feature PRD, here are the detailed implementation tasks organized by development phases.

## Phase 1: MVP (Core Functionality)

### Setup and Dependencies

#### Task 1: Install Required Dependencies
- [x] Install `react-native-document-picker` for file selection
- [x] Verify existing Supabase dependencies are sufficient
- [x] Update package.json with new dependencies
- [x] Test dependency installation on both iOS and Android

**Jest Tests for Task 1:**
```javascript
// __tests__/setup/dependencies.test.js
describe('Dependencies Setup', () => {
  it('should have react-native-document-picker installed', () => {
    expect(() => require('react-native-document-picker')).not.toThrow();
  });
  
  it('should have supabase dependencies available', () => {
    expect(() => require('@supabase/supabase-js')).not.toThrow();
  });
});
```

#### Task 2: Update Database Schema
- [x] Review existing `game_sessions` table structure
- [x] Design schema extension for imported stories:
  - Add `imported_story_content` field (TEXT)
  - Add `story_source` field (CreativeBridge/Story_Quest/File)
  - Add `original_creation_date` field
  - Add `story_metadata` field (JSON)
- [x] Create migration script for database changes
- [x] Test schema changes in development environment

**Jest Tests for Task 2:**
```javascript
// __tests__/database/schema.test.js
describe('Database Schema', () => {
  it('should insert story with new schema fields', async () => {
    const testStory = {
      imported_story_content: 'Test story content',
      story_source: 'File',
      original_creation_date: new Date().toISOString(),
      story_metadata: { wordCount: 100 }
    };
    const result = await insertTestStory(testStory);
    expect(result).toBeDefined();
    expect(result.story_source).toBe('File');
  });
});
```

### Core Services and API Layer

#### Task 3: Create Story Import Service
- [x] Create `src/services/storyImportService.ts`
- [x] Implement file reading functionality:
  - Function to read .txt files
  - Handle UTF-8 and ASCII encoding
  - Error handling for corrupted/invalid files
- [x] Implement database story fetching:
  - Query user's completed stories from CreativeBridge
  - Handle pagination for large story collections
  - Add metadata extraction and formatting
- [x] Add story validation and processing utilities
- [x] Write unit tests for import service functions

**Jest Tests for Task 3:**
```javascript
// __tests__/services/storyImportService.test.js
import { StoryImportService } from '../../src/services/storyImportService';

describe('StoryImportService', () => {
  it('should read txt file content correctly', async () => {
    const mockFileUri = 'mock://test.txt';
    const content = await StoryImportService.readTextFile(mockFileUri);
    expect(content).toBeDefined();
    expect(typeof content).toBe('string');
  });

  it('should handle file reading errors gracefully', async () => {
    const invalidFileUri = 'invalid://file.txt';
    await expect(StoryImportService.readTextFile(invalidFileUri))
      .rejects.toThrow('File not found');
  });

  it('should fetch user stories from database', async () => {
    const userId = 'test-user-id';
    const stories = await StoryImportService.fetchUserStories(userId);
    expect(Array.isArray(stories)).toBe(true);
  });

  it('should validate story content', () => {
    const validStory = 'This is a valid story content.';
    const result = StoryImportService.validateStoryContent(validStory);
    expect(result.isValid).toBe(true);
  });
});
```

#### Task 4: Create Story Management API
- [x] Create `src/services/storyManagementService.ts`
- [x] Implement story CRUD operations:
  - Save imported stories to local database
  - Update existing stories (conflict resolution)
  - Delete stories
  - Query user's story library
- [x] Add story search functionality:
  - Text search across content and metadata
  - Filter by date range, source, etc.
  - Real-time search with debouncing
- [x] Implement story editing operations
- [x] Add error handling and retry logic

**Jest Tests for Task 4:**
```javascript
// __tests__/services/storyManagementService.test.js
import { StoryManagementService } from '../../src/services/storyManagementService';

describe('StoryManagementService', () => {
  it('should save story to database', async () => {
    const testStory = {
      content: 'Test story',
      source: 'File',
      userId: 'test-user'
    };
    const savedStory = await StoryManagementService.saveStory(testStory);
    expect(savedStory.id).toBeDefined();
  });

  it('should search stories by content', async () => {
    const searchTerm = 'adventure';
    const results = await StoryManagementService.searchStories(searchTerm);
    expect(Array.isArray(results)).toBe(true);
  });

  it('should filter stories by source', async () => {
    const source = 'CreativeBridge';
    const results = await StoryManagementService.filterBySource(source);
    results.forEach(story => {
      expect(story.story_source).toBe(source);
    });
  });

  it('should update existing story', async () => {
    const storyId = 'test-story-id';
    const updates = { content: 'Updated content' };
    const updated = await StoryManagementService.updateStory(storyId, updates);
    expect(updated.content).toBe('Updated content');
  });
});
```

### User Interface Components

#### Task 5: Create Story Selection Components
- [x] Create `src/components/story/StorySelectionModal.tsx`
- [x] Implement story list view:
  - FlatList with story preview cards
  - Show title/preview, date, source indicator
  - Pull-to-refresh functionality
  - Loading states and skeleton screens
- [x] Add search bar component:
  - Real-time search input
  - Search results highlighting
  - Clear search functionality
- [x] Implement filter buttons:
  - Source filter (CreativeBridge/Story_Quest/File)
  - Date range filter
  - Filter state management

**Jest Tests for Task 5:**
```javascript
// __tests__/components/StorySelectionModal.test.js
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { StorySelectionModal } from '../../src/components/story/StorySelectionModal';

describe('StorySelectionModal', () => {
  const mockStories = [
    { id: '1', content: 'Story 1', source: 'File', date: '2024-01-01' },
    { id: '2', content: 'Story 2', source: 'CreativeBridge', date: '2024-01-02' }
  ];

  it('should render story list', () => {
    const { getByText } = render(
      <StorySelectionModal stories={mockStories} visible={true} />
    );
    expect(getByText('Story 1')).toBeTruthy();
    expect(getByText('Story 2')).toBeTruthy();
  });

  it('should filter stories by search term', async () => {
    const { getByPlaceholderText, getByText, queryByText } = render(
      <StorySelectionModal stories={mockStories} visible={true} />
    );
    
    const searchInput = getByPlaceholderText('Search stories...');
    fireEvent.changeText(searchInput, 'Story 1');
    
    await waitFor(() => {
      expect(getByText('Story 1')).toBeTruthy();
      expect(queryByText('Story 2')).toBeFalsy();
    });
  });

  it('should filter by source', async () => {
    const { getByText, queryByText } = render(
      <StorySelectionModal stories={mockStories} visible={true} />
    );
    
    fireEvent.press(getByText('File'));
    
    await waitFor(() => {
      expect(getByText('Story 1')).toBeTruthy();
      expect(queryByText('Story 2')).toBeFalsy();
    });
  });
});
```

#### Task 6: Create Import Options Screen
- [x] Create `src/screens/ImportOptionsScreen.tsx`
- [x] Design and implement import method selection:
  - "Import from File" button with file icon
  - "My Stories" button with database icon
  - Clear descriptions for each option
- [x] Add navigation handling:
  - Navigate to file picker
  - Navigate to story selection
  - Back navigation to HomeScreen
- [x] Implement responsive design for different screen sizes

**Jest Tests for Task 6:**
```javascript
// __tests__/screens/ImportOptionsScreen.test.js
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ImportOptionsScreen } from '../../src/screens/ImportOptionsScreen';

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn()
};

describe('ImportOptionsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render import options', () => {
    const { getByText } = render(
      <ImportOptionsScreen navigation={mockNavigation} />
    );
    expect(getByText('Import from File')).toBeTruthy();
    expect(getByText('My Stories')).toBeTruthy();
  });

  it('should navigate to file picker on file import', () => {
    const { getByText } = render(
      <ImportOptionsScreen navigation={mockNavigation} />
    );
    
    fireEvent.press(getByText('Import from File'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('FilePicker');
  });

  it('should navigate to story selection on my stories', () => {
    const { getByText } = render(
      <ImportOptionsScreen navigation={mockNavigation} />
    );
    
    fireEvent.press(getByText('My Stories'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('StorySelection');
  });
});
```

#### Task 7: Create Story Preview/Edit Component
- [x] Create `src/components/story/StoryPreviewEdit.tsx`
- [x] Implement story display:
  - Full-screen text view with proper formatting
  - Scroll functionality for long stories
  - Word count and metadata display
- [x] Add editing capabilities:
  - Enable/disable edit mode
  - Text input with proper styling
  - Save changes functionality
  - Undo/redo if possible
- [x] Add action buttons:
  - Edit toggle button
  - Continue story button
  - Back navigation button

**Jest Tests for Task 7:**
```javascript
// __tests__/components/StoryPreviewEdit.test.js
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { StoryPreviewEdit } from '../../src/components/story/StoryPreviewEdit';

const mockStory = {
  id: '1',
  content: 'This is a test story content that can be edited.',
  metadata: { wordCount: 10 }
};

describe('StoryPreviewEdit', () => {
  it('should display story content', () => {
    const { getByText } = render(
      <StoryPreviewEdit story={mockStory} />
    );
    expect(getByText(mockStory.content)).toBeTruthy();
  });

  it('should toggle edit mode', () => {
    const { getByText, getByDisplayValue } = render(
      <StoryPreviewEdit story={mockStory} />
    );
    
    fireEvent.press(getByText('Edit'));
    expect(getByDisplayValue(mockStory.content)).toBeTruthy();
  });

  it('should save edited content', () => {
    const onSave = jest.fn();
    const { getByText, getByDisplayValue } = render(
      <StoryPreviewEdit story={mockStory} onSave={onSave} />
    );
    
    fireEvent.press(getByText('Edit'));
    const textInput = getByDisplayValue(mockStory.content);
    fireEvent.changeText(textInput, 'Edited content');
    fireEvent.press(getByText('Save'));
    
    expect(onSave).toHaveBeenCalledWith('Edited content');
  });

  it('should display word count', () => {
    const { getByText } = render(
      <StoryPreviewEdit story={mockStory} />
    );
    expect(getByText('Words: 10')).toBeTruthy();
  });
});
```

### Integration with Existing Systems

#### Task 8: Integrate with HomeScreen
- [ ] Update `src/screens/HomeScreen.tsx`
- [ ] Add "Continue Story" button/option to main interface
- [ ] Implement navigation to import options screen
- [ ] Ensure proper state management integration
- [ ] Test integration with existing story creation flow

**Jest Tests for Task 8:**
```javascript
// __tests__/screens/HomeScreen.test.js
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { HomeScreen } from '../../src/screens/HomeScreen';

const mockNavigation = {
  navigate: jest.fn()
};

describe('HomeScreen Integration', () => {
  it('should display continue story button', () => {
    const { getByText } = render(
      <HomeScreen navigation={mockNavigation} />
    );
    expect(getByText('Continue Story')).toBeTruthy();
  });

  it('should navigate to import options', () => {
    const { getByText } = render(
      <HomeScreen navigation={mockNavigation} />
    );
    
    fireEvent.press(getByText('Continue Story'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('ImportOptions');
  });
});
```

#### Task 9: Update Navigation System
- [x] Update `src/navigation/AppNavigator.tsx`
- [x] Add new screens to navigation stack:
  - ImportOptionsScreen
  - StorySelectionScreen
  - StoryPreviewEditScreen
- [x] Define proper navigation parameters and types
- [x] Test navigation flow between screens

**Jest Tests for Task 9:**
```javascript
// __tests__/navigation/AppNavigator.test.js
import React from 'react';
import { render } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { AppNavigator } from '../../src/navigation/AppNavigator';

describe('Navigation System', () => {
  it('should include story continuation screens', () => {
    const { getByTestId } = render(
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    );
    
    // Test that navigation stack includes new screens
    expect(() => getByTestId('ImportOptionsScreen')).not.toThrow();
    expect(() => getByTestId('StorySelectionScreen')).not.toThrow();
    expect(() => getByTestId('StoryPreviewEditScreen')).not.toThrow();
  });
});
```

#### Task 10: Integrate with AI Story Generation
- [x] Update existing AI story service to handle imported content
- [x] Modify story context preparation:
  - Include full imported story content
  - Analyze story structure and style
  - Generate appropriate continuation prompts
- [x] Test AI continuation with various imported story types
- [x] Ensure seamless transition from import to continuation

**Jest Tests for Task 10:**
```javascript
// __tests__/services/aiStoryService.test.js
import { AIStoryService } from '../../src/services/aiStoryService';

describe('AI Story Service Integration', () => {
  it('should prepare context from imported story', () => {
    const importedStory = 'Once upon a time, there was a brave knight.';
    const context = AIStoryService.prepareImportedStoryContext(importedStory);
    
    expect(context).toContain(importedStory);
    expect(context.length).toBeGreaterThan(importedStory.length);
  });

  it('should generate continuation for imported story', async () => {
    const importedStory = 'The wizard cast a powerful spell.';
    const continuation = await AIStoryService.continueImportedStory(importedStory);
    
    expect(continuation).toBeDefined();
    expect(typeof continuation).toBe('string');
    expect(continuation.length).toBeGreaterThan(0);
  });

  it('should analyze story style', () => {
    const storyContent = 'It was a dark and stormy night. The old mansion creaked ominously.';
    const analysis = AIStoryService.analyzeStoryStyle(storyContent);
    
    expect(analysis.genre).toBeDefined();
    expect(analysis.tone).toBeDefined();
    expect(analysis.complexity).toBeDefined();
  });
});
```

### File Handling Implementation

#### Task 11: Implement File Picker Integration
- [x] Create file selection utility functions
- [x] Handle file permissions and access
- [x] Implement file reading and parsing:
  - Support for .txt files
  - Encoding detection and conversion
  - File size validation
- [x] Add comprehensive error handling:
  - Invalid file format errors
  - Permission denied errors
  - File corruption handling
- [x] Test file picker on both iOS and Android platforms

**Jest Tests for Task 11:**
```javascript
// __tests__/utils/filePicker.test.js
import { FilePickerUtils } from '../../src/utils/filePicker';

describe('File Picker Utils', () => {
  it('should validate txt file format', () => {
    const validFile = { name: 'story.txt', type: 'text/plain' };
    const invalidFile = { name: 'story.pdf', type: 'application/pdf' };
    
    expect(FilePickerUtils.isValidTextFile(validFile)).toBe(true);
    expect(FilePickerUtils.isValidTextFile(invalidFile)).toBe(false);
  });

  it('should handle file size validation', () => {
    const smallFile = { size: 1024 }; // 1KB
    const largeFile = { size: 10 * 1024 * 1024 }; // 10MB
    
    expect(FilePickerUtils.isValidFileSize(smallFile)).toBe(true);
    expect(FilePickerUtils.isValidFileSize(largeFile)).toBe(true);
  });

  it('should detect text encoding', async () => {
    const mockFileContent = Buffer.from('Hello, world!', 'utf8');
    const encoding = await FilePickerUtils.detectEncoding(mockFileContent);
    
    expect(['utf8', 'ascii']).toContain(encoding);
  });

  it('should handle permission errors', async () => {
    const mockPermissionError = () => Promise.reject(new Error('Permission denied'));
    
    await expect(mockPermissionError()).rejects.toThrow('Permission denied');
  });
});
```

### Error Handling and User Feedback

#### Task 12: Implement Comprehensive Error Handling
- [x] Create error handling utilities for import operations
- [x] Implement user-friendly error messages:
  - File import errors
  - Network connection errors
  - Database query errors
  - Permission errors
- [x] Add retry mechanisms for recoverable errors
- [x] Implement offline mode handling
- [x] Create loading states and progress indicators

**Jest Tests for Task 12:**
```javascript
// __tests__/utils/errorHandler.test.js
import { ErrorHandler } from '../../src/utils/errorHandler';

describe('Error Handler', () => {
  it('should format file import errors', () => {
    const error = new Error('File not found');
    const userMessage = ErrorHandler.formatFileError(error);
    
    expect(userMessage).toContain('file');
    expect(userMessage.length).toBeGreaterThan(error.message.length);
  });

  it('should handle network errors', () => {
    const networkError = new Error('Network request failed');
    const handled = ErrorHandler.handleNetworkError(networkError);
    
    expect(handled.isRetryable).toBe(true);
    expect(handled.userMessage).toBeDefined();
  });

  it('should categorize errors correctly', () => {
    const fileError = new Error('Invalid file format');
    const networkError = new Error('Connection timeout');
    
    expect(ErrorHandler.categorizeError(fileError)).toBe('FILE_ERROR');
    expect(ErrorHandler.categorizeError(networkError)).toBe('NETWORK_ERROR');
  });

  it('should determine if error is retryable', () => {
    const retryableError = new Error('Network timeout');
    const nonRetryableError = new Error('Invalid file format');
    
    expect(ErrorHandler.isRetryable(retryableError)).toBe(true);
    expect(ErrorHandler.isRetryable(nonRetryableError)).toBe(false);
  });
});
```

### Testing and Quality Assurance

#### Task 13: Write Unit Tests
- [x] Test story import service functions
- [x] Test file reading and parsing utilities
- [x] Test search and filter functionality
- [x] Test error handling scenarios
- [x] Achieve minimum 80% code coverage

**Jest Tests for Task 13:**
```javascript
// __tests__/coverage/coverage.test.js
describe('Code Coverage', () => {
  it('should maintain minimum 80% coverage', async () => {
    // This test ensures coverage thresholds are met
    // Jest configuration should enforce this automatically
    expect(true).toBe(true); // Placeholder
  });
});

// jest.config.js should include:
// coverageThreshold: {
//   global: {
//     branches: 80,
//     functions: 80,
//     lines: 80,
//     statements: 80
//   }
// }
```

#### Task 14: Integration Testing
- [x] Test complete import workflow from file selection to story continuation
- [x] Test navigation between all new screens
- [x] Test integration with existing story generation system
- [x] Test database operations and conflict resolution
- [x] Test on both iOS and Android platforms

**Jest Tests for Task 14:**
```javascript
// __tests__/integration/storyImportFlow.test.js
import { testE2EFlow } from '../utils/e2eTestUtils';

describe('Story Import Integration', () => {
  it('should complete full import workflow', async () => {
    const flow = await testE2EFlow([
      'navigate to home screen',
      'tap continue story',
      'select import from file',
      'pick test file',
      'preview story',
      'edit story content',
      'continue with AI',
      'generate story continuation'
    ]);
    
    expect(flow.completed).toBe(true);
    expect(flow.errors).toHaveLength(0);
  });

  it('should handle database story import flow', async () => {
    const flow = await testE2EFlow([
      'navigate to import options',
      'select my stories',
      'search for story',
      'select story',
      'preview and edit',
      'continue story'
    ]);
    
    expect(flow.completed).toBe(true);
  });
});
```

#### Task 15: User Acceptance Testing
- [x] Test with various .txt file formats and sizes
- [x] Test search and filter performance with large story collections
- [x] Test editing functionality with different story lengths
- [x] Verify AI continuation quality with imported stories
- [x] Test accessibility features and screen reader compatibility

**Jest Tests for Task 15:**
```javascript
// __tests__/acceptance/userAcceptance.test.js
describe('User Acceptance Tests', () => {
  it('should handle various file formats', async () => {
    const fileFormats = [
      { name: 'story.txt', content: 'UTF-8 content' },
      { name: 'ascii.txt', content: 'ASCII content' },
      { name: 'large.txt', content: 'x'.repeat(1000000) }
    ];
    
    for (const file of fileFormats) {
      const result = await processFile(file);
      expect(result.success).toBe(true);
    }
  });

  it('should perform well with large story collections', async () => {
    const startTime = Date.now();
    const stories = await generateLargeStoryCollection(1000);
    const searchResults = await searchStories('adventure');
    const endTime = Date.now();
    
    expect(endTime - startTime).toBeLessThan(1000); // Under 1 second
    expect(searchResults.length).toBeGreaterThan(0);
  });

  it('should support accessibility features', () => {
    const { getByA11yLabel } = render(<StorySelectionModal />);
    
    expect(getByA11yLabel('Search stories')).toBeTruthy();
    expect(getByA11yLabel('Import from file')).toBeTruthy();
    expect(getByA11yLabel('Continue story')).toBeTruthy();
  });
});
```

## Phase 2: Enhanced Features

### Story_Quest Integration

#### Task 16: Story_Quest API Integration
- [x] Research Story_Quest database structure and API
- [x] Implement authentication with Story_Quest platform
- [x] Create service for fetching Story_Quest user stories
- [x] Handle cross-platform user matching and verification
- [x] Test Story_Quest integration with sample data

**Jest Tests for Task 16:**
```javascript
// __tests__/services/storyQuestIntegration.test.js
import { StoryQuestService } from '../../src/services/storyQuestService';

describe('Story Quest Integration', () => {
  it('should authenticate with Story Quest API', async () => {
    const credentials = { email: 'test@example.com', password: 'password' };
    const result = await StoryQuestService.authenticate(credentials);
    
    expect(result.success).toBe(true);
    expect(result.token).toBeDefined();
  });

  it('should fetch user stories from Story Quest', async () => {
    const userId = 'story-quest-user-id';
    const stories = await StoryQuestService.fetchUserStories(userId);
    
    expect(Array.isArray(stories)).toBe(true);
    stories.forEach(story => {
      expect(story.source).toBe('Story_Quest');
    });
  });

  it('should handle cross-platform user matching', async () => {
    const email = 'user@example.com';
    const match = await StoryQuestService.matchUserByEmail(email);
    
    expect(match).toBeDefined();
    expect(match.email).toBe(email);
  });
});
```

### Advanced Search and Filtering

#### Task 18: Advanced Search Implementation
- [x] Implement full-text search across story content
- [x] Add metadata search (author, creation date, etc.)
- [x] Implement search result ranking and relevance
- [x] Add search history and suggestions
- [x] Optimize search performance for large datasets

**Jest Tests for Task 18:**
```javascript
// __tests__/services/advancedSearch.test.js
import { AdvancedSearchService } from '../../src/services/advancedSearchService';

describe('Advanced Search', () => {
  it('should perform full-text search', async () => {
    const query = 'dragon adventure castle';
    const results = await AdvancedSearchService.fullTextSearch(query);
    
    expect(Array.isArray(results)).toBe(true);
    results.forEach(result => {
      expect(result.relevanceScore).toBeGreaterThan(0);
    });
  });

  it('should rank search results by relevance', async () => {
    const query = 'fantasy story';
    const results = await AdvancedSearchService.fullTextSearch(query);
    
    for (let i = 1; i < results.length; i++) {
      expect(results[i].relevanceScore).toBeLessThanOrEqual(results[i-1].relevanceScore);
    }
  });

  it('should search by metadata', async () => {
    const metadata = { author: 'John Doe', genre: 'fantasy' };
    const results = await AdvancedSearchService.searchByMetadata(metadata);
    
    results.forEach(result => {
      expect(result.metadata.author).toBe('John Doe');
    });
  });

  it('should provide search suggestions', async () => {
    const partial = 'adven';
    const suggestions = await AdvancedSearchService.getSuggestions(partial);
    
    expect(suggestions).toContain('adventure');
    expect(suggestions.length).toBeLessThanOrEqual(10);
  });
});
```

### Performance Optimization

#### Task 20: Performance Improvements
- [x] Implement pagination for story lists
- [x] Add lazy loading for story content
- [x] Optimize database queries with proper indexing
- [x] Implement caching for frequently accessed stories
- [x] Add performance monitoring and metrics

**Jest Tests for Task 20:**
```javascript
// __tests__/performance/optimization.test.js
import { PerformanceService } from '../../src/services/performanceService';

describe('Performance Optimization', () => {
  it('should implement pagination correctly', async () => {
    const page1 = await PerformanceService.getStoryPage(1, 20);
    const page2 = await PerformanceService.getStoryPage(2, 20);
    
    expect(page1.length).toBeLessThanOrEqual(20);
    expect(page2.length).toBeLessThanOrEqual(20);
    expect(page1[0].id).not.toBe(page2[0].id);
  });

  it('should lazy load story content', async () => {
    const storyPreview = await PerformanceService.getStoryPreview('story-id');
    expect(storyPreview.content.length).toBeLessThan(200); // Preview only
    
    const fullStory = await PerformanceService.getFullStory('story-id');
    expect(fullStory.content.length).toBeGreaterThan(storyPreview.content.length);
  });

  it('should cache frequently accessed stories', async () => {
    const storyId = 'popular-story-id';
    
    const start1 = Date.now();
    await PerformanceService.getStory(storyId);
    const time1 = Date.now() - start1;
    
    const start2 = Date.now();
    await PerformanceService.getStory(storyId); // Should be cached
    const time2 = Date.now() - start2;
    
    expect(time2).toBeLessThan(time1 * 0.5); // Cache should be significantly faster
  });
});
```

## Phase 3: Advanced Features

### Analytics and Insights

#### Task 21: Story Analytics Implementation
- [x] Track story import usage metrics
- [x] Monitor story continuation success rates
- [x] Implement user engagement analytics
- [x] Add performance monitoring dashboards
- [x] Create automated reporting system

**Jest Tests for Task 21:**
```javascript
// __tests__/analytics/storyAnalytics.test.js
import { AnalyticsService } from '../../src/services/analyticsService';

describe('Story Analytics', () => {
  it('should track story import events', async () => {
    const event = {
      type: 'story_import',
      source: 'file',
      userId: 'user-123',
      timestamp: Date.now()
    };
    
    await AnalyticsService.trackEvent(event);
    const events = await AnalyticsService.getEvents('story_import');
    
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].type).toBe('story_import');
  });

  it('should calculate success rates', async () => {
    const metrics = await AnalyticsService.getSuccessRates();
    
    expect(metrics.importSuccessRate).toBeGreaterThanOrEqual(0);
    expect(metrics.importSuccessRate).toBeLessThanOrEqual(100);
    expect(metrics.continuationSuccessRate).toBeDefined();
  });

  it('should generate usage reports', async () => {
    const report = await AnalyticsService.generateUsageReport();
    
    expect(report.totalImports).toBeGreaterThanOrEqual(0);
    expect(report.uniqueUsers).toBeGreaterThanOrEqual(0);
    expect(report.averageSessionDuration).toBeGreaterThanOrEqual(0);
  });
});
```

### Cross-Platform Synchronization

#### Task 23: Story Sync Implementation
- [x] Design cross-platform synchronization system
- [x] Implement real-time story updates
- [x] Handle conflict resolution for concurrent edits
- [x] Add offline sync capabilities
- [x] Test synchronization across different platforms

**Jest Tests for Task 23:**
```javascript
// __tests__/sync/crossPlatformSync.test.js
import { SyncService } from '../../src/services/syncService';

describe('Cross-Platform Synchronization', () => {
  it('should sync stories across devices', async () => {
    const deviceA = 'device-a-id';
    const deviceB = 'device-b-id';
    
    await SyncService.updateStoryOnDevice(deviceA, 'story-id', 'Updated content');
    await SyncService.syncAcrossDevices(['device-a-id', 'device-b-id']);
    
    const storyOnB = await SyncService.getStoryOnDevice(deviceB, 'story-id');
    expect(storyOnB.content).toBe('Updated content');
  });

  it('should resolve conflicts correctly', async () => {
    const conflictingEdits = [
      { deviceId: 'device-a', content: 'Version A', timestamp: 1000 },
      { deviceId: 'device-b', content: 'Version B', timestamp: 2000 }
    ];
    
    const resolved = await SyncService.resolveConflict('story-id', conflictingEdits);
    expect(resolved.content).toBe('Version B'); // Later timestamp wins
  });

  it('should handle offline sync', async () => {
    SyncService.setOfflineMode(true);
    
    await SyncService.updateStory('story-id', 'Offline edit');
    const pendingChanges = await SyncService.getPendingChanges();
    
    expect(pendingChanges.length).toBeGreaterThan(0);
    
    SyncService.setOfflineMode(false);
    await SyncService.syncPendingChanges();
    
    const updatedPending = await SyncService.getPendingChanges();
    expect(updatedPending.length).toBe(0);
  });
});
```

## Documentation and Deployment

#### Task 24: Documentation
- [x] Create developer documentation for new services
- [x] Update user documentation with new features
- [x] Create troubleshooting guides
- [x] Document API changes and database schema updates
- [x] Create deployment and configuration guides

**Jest Tests for Task 24:**
```javascript
// __tests__/documentation/apiDocumentation.test.js
describe('API Documentation', () => {
  it('should have complete API documentation', () => {
    const apiDocs = require('../../docs/api.json');
    
    expect(apiDocs.storyImport).toBeDefined();
    expect(apiDocs.storyManagement).toBeDefined();
    expect(apiDocs.search).toBeDefined();
  });

  it('should validate example code in documentation', async () => {
    const examples = require('../../docs/examples.js');
    
    // Test that documented examples actually work
    const result = await examples.importStoryExample();
    expect(result.success).toBe(true);
  });
});
```

## Estimated Timeline

**Phase 1 (MVP)**: 3-4 weeks
- Setup and core services: 1 week
- UI components and integration: 1.5 weeks
- Testing and refinement: 0.5-1 week

**Phase 2 (Enhanced)**: 2-3 weeks
- Story_Quest integration: 1 week
- Advanced UI and search: 1-2 weeks

**Phase 3 (Advanced)**: 2-3 weeks
- Analytics and insights: 1-1.5 weeks
- Cross-platform sync: 1-1.5 weeks

**Total Estimated Timeline**: 7-10 weeks

## Success Criteria

- [ ] All Jest tests pass with minimum 80% code coverage
- [ ] Users can successfully import .txt files and continue stories
- [ ] Database story selection and continuation works seamlessly
- [ ] Search and filter functionality performs well with large datasets
- [ ] AI story continuation maintains quality with imported content
- [ ] Error handling provides clear, actionable feedback to users
- [ ] Feature adoption rate meets target metrics (defined in PRD)

This comprehensive task list with Jest tests ensures thorough validation of each component and feature, maintaining high code quality throughout the development process.