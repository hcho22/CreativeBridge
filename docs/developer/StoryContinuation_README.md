# CreativeBridge Developer Documentation

## Overview

This documentation covers the new story continuation features implemented in CreativeBridge, including story import, analytics, synchronization, and advanced search capabilities.

## Architecture Overview

### Core Services

1. **Story Import Service** (`src/services/storyImportService.ts`)
   - File import from .txt files
   - Database story fetching
   - Story validation and processing

2. **Story Management Service** (`src/services/storyManagementService.ts`)
   - CRUD operations for stories
   - Search and filtering functionality
   - Story editing operations

3. **Analytics Service** (`src/services/analyticsService.ts`)
   - Event tracking and metrics collection
   - User engagement analytics
   - Performance monitoring and reporting

4. **Sync Service** (`src/services/syncService.ts`)
   - Cross-platform story synchronization
   - Real-time updates and conflict resolution
   - Offline-first architecture

5. **Advanced Search Service** (`src/services/advancedSearchService.ts`)
   - Full-text search across story content
   - Metadata search and filtering
   - Search result ranking and relevance

### UI Components

1. **Story Selection Components**
   - `StorySelectionModal.tsx` - Story list with search and filters
   - `StoryPreviewEdit.tsx` - Story viewing and editing
   - `AdvancedSearchModal.tsx` - Enhanced search interface

2. **Screen Components**
   - `ImportOptionsScreen.tsx` - Import method selection
   - `StorySelectionScreen.tsx` - Story browser
   - `StoryPreviewEditScreen.tsx` - Story preview and editing

3. **Analytics Components**
   - `AnalyticsDashboard.tsx` - Analytics visualization

## Quick Start

### Setting Up Development Environment

1. Ensure you have the required dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables in `.env`:
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_key
   OPENAI_API_KEY=your_openai_key
   ```

3. Run the development server:
   ```bash
   npm start
   npm run ios    # for iOS
   npm run android # for Android
   ```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm test -- --testPathPattern="services"
npm test -- --testPathPattern="integration"

# Run with coverage
npm test -- --coverage
```

## Service Integration

### Adding Story Import Functionality

```typescript
import { storyImportService } from '../services/storyImportService';

// Import from file
const importedStory = await storyImportService.importFromFile(fileUri);

// Import from database
const stories = await storyImportService.fetchUserStories(userId);
```

### Using Analytics

```typescript
import { analyticsService } from '../services/analyticsService';

// Track story import
await analyticsService.trackStoryImport(userId, 'file', true, {
  fileSize: 2048,
  storyLength: 500
});

// Get usage metrics
const metrics = await analyticsService.getUsageMetrics(
  startDate,
  endDate,
  userId
);
```

### Implementing Sync

```typescript
import { syncService } from '../services/syncService';

// Set user for sync
syncService.setUserId(userId);

// Update story on device
await syncService.updateStoryOnDevice(
  deviceId,
  storyId,
  content,
  metadata
);

// Sync across devices
await syncService.syncAcrossDevices([deviceId1, deviceId2]);
```

## Database Schema

### Story Continuation Fields

The following fields have been added to support story continuation:

```sql
-- Added to game_sessions table
ALTER TABLE game_sessions ADD COLUMN imported_story_content TEXT;
ALTER TABLE game_sessions ADD COLUMN story_source TEXT CHECK (story_source IN ('CreativeBridge', 'Story_Quest', 'File'));
ALTER TABLE game_sessions ADD COLUMN original_creation_date TIMESTAMP;
ALTER TABLE game_sessions ADD COLUMN story_metadata JSONB;
```

### Analytics Tables

```sql
-- Analytics events table
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  subtype TEXT,
  user_id UUID REFERENCES auth.users(id),
  session_id TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analytics reports table
CREATE TABLE analytics_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT NOT NULL,
  date_range JSONB NOT NULL,
  summary JSONB NOT NULL,
  insights TEXT[],
  recommendations TEXT[],
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Sync Tables

```sql
-- Cross-platform sync stories table
CREATE TABLE sync_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  metadata JSONB,
  source TEXT,
  user_id UUID REFERENCES auth.users(id),
  device_id TEXT NOT NULL,
  sync_status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Configuration

### Jest Configuration

The project uses Jest with React Native preset. Key configuration:

```javascript
// jest.config.js
module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/src/__tests__/setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@supabase|react-native-url-polyfill)/)'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};
```

### TypeScript Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "moduleResolution": "node"
  }
}
```

## Performance Considerations

### Caching Strategy

- Story content is cached locally using AsyncStorage
- Search results are cached with TTL
- Analytics events are batched for efficient upload

### Memory Management

- Large stories use lazy loading
- Component state is optimized with React.memo
- Event listeners are properly cleaned up

### Network Optimization

- Offline-first architecture with sync queues
- Batch operations for analytics and sync
- Compression for large data transfers

## Security

### Data Protection

- All sensitive data is encrypted
- RLS policies protect user data
- Input validation on all user inputs

### Authentication

- Supabase authentication with JWT tokens
- Session management with automatic refresh
- Two-factor authentication support

## Contributing

### Code Style

- Use TypeScript strict mode
- Follow React Native best practices
- Write comprehensive tests for all features
- Document all public APIs

### Pull Request Process

1. Create feature branch from main
2. Implement changes with tests
3. Run full test suite
4. Update documentation
5. Submit pull request with description

### Testing Requirements

- Minimum 80% code coverage
- Unit tests for all services
- Integration tests for workflows
- E2E tests for critical paths

## Related Documentation

- [API Documentation](../api/README.md)
- [User Guide](../user/README.md)
- [Troubleshooting](../troubleshooting/README.md)
- [Examples](../examples/README.md)