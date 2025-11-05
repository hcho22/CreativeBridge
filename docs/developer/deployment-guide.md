# Deployment and Configuration Guide

## Overview

This guide covers deployment procedures, configuration requirements, and database setup for the Story Continuation features in CreativeBridge.

## Prerequisites

### System Requirements

**Development Environment:**

- Node.js 18.0 or higher
- React Native CLI 0.81.1
- Xcode 14+ (for iOS)
- Android Studio 2022.1+ (for Android)

**Production Environment:**

- Supabase project with PostgreSQL
- OpenAI API access
- Cloud storage for file uploads
- CDN for static assets

### Environment Variables

Create `.env` file with required configuration:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key
OPENAI_ORG_ID=your_organization_id

# App Configuration
APP_ENV=production
APP_VERSION=2.0.0
DEBUG_MODE=false

# Analytics Configuration
ANALYTICS_ENABLED=true
ANALYTICS_BATCH_SIZE=50
ANALYTICS_UPLOAD_INTERVAL=30000

# Sync Configuration
SYNC_ENABLED=true
SYNC_AUTO_INTERVAL=30000
SYNC_CONFLICT_RESOLUTION=auto_latest

# File Upload Configuration
MAX_FILE_SIZE=10485760  # 10MB
ALLOWED_FILE_TYPES=txt,plain
UPLOAD_TIMEOUT=30000

# Security Configuration
ENCRYPTION_ENABLED=true
RATE_LIMIT_ENABLED=true
AUDIT_LOGGING_ENABLED=true
```

## Database Setup

### Schema Migration

Run the following SQL scripts in order:

#### 1. Story Continuation Schema

```sql
-- Add story continuation fields to existing table
ALTER TABLE game_sessions
ADD COLUMN IF NOT EXISTS imported_story_content TEXT,
ADD COLUMN IF NOT EXISTS story_source TEXT
  CHECK (story_source IN ('CreativeBridge', 'Story_Quest', 'File')),
ADD COLUMN IF NOT EXISTS original_creation_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS story_metadata JSONB DEFAULT '{}';

-- Create index for better search performance
CREATE INDEX IF NOT EXISTS idx_game_sessions_story_source
ON game_sessions(story_source);

CREATE INDEX IF NOT EXISTS idx_game_sessions_content_search
ON game_sessions USING gin(to_tsvector('english', imported_story_content));
```

#### 2. Analytics Tables

```sql
-- Analytics events table
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  subtype TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analytics reports table
CREATE TABLE IF NOT EXISTS analytics_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT NOT NULL,
  date_range JSONB NOT NULL,
  summary JSONB NOT NULL,
  insights TEXT[],
  recommendations TEXT[],
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Indexes for analytics
CREATE INDEX IF NOT EXISTS idx_analytics_events_type
ON analytics_events(type, timestamp);

CREATE INDEX IF NOT EXISTS idx_analytics_events_user
ON analytics_events(user_id, timestamp);

CREATE INDEX IF NOT EXISTS idx_analytics_events_session
ON analytics_events(session_id);
```

#### 3. Sync Tables

```sql
-- Cross-platform sync stories table
CREATE TABLE IF NOT EXISTS sync_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  source TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  sync_status TEXT DEFAULT 'pending'
    CHECK (sync_status IN ('pending', 'synced', 'conflict', 'error')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sync conflicts table
CREATE TABLE IF NOT EXISTS sync_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL,
  conflict_type TEXT NOT NULL,
  local_version JSONB,
  remote_version JSONB,
  resolution_strategy TEXT,
  is_resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for sync
CREATE INDEX IF NOT EXISTS idx_sync_stories_user_device
ON sync_stories(user_id, device_id);

CREATE INDEX IF NOT EXISTS idx_sync_stories_status
ON sync_stories(sync_status, updated_at);

CREATE INDEX IF NOT EXISTS idx_sync_conflicts_story
ON sync_conflicts(story_id, is_resolved);
```

#### 4. Advanced Search Tables

```sql
-- Search indices table for faster lookups
CREATE TABLE IF NOT EXISTS search_indices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL,
  content_vector tsvector,
  metadata_vector tsvector,
  last_indexed TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create full-text search index
CREATE INDEX IF NOT EXISTS idx_search_content_vector
ON search_indices USING gin(content_vector);

CREATE INDEX IF NOT EXISTS idx_search_metadata_vector
ON search_indices USING gin(metadata_vector);
```

### Row Level Security (RLS) Policies

```sql
-- Enable RLS on all new tables
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_indices ENABLE ROW LEVEL SECURITY;

-- Analytics events policies
CREATE POLICY "Users can insert their own analytics events"
ON analytics_events FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own analytics events"
ON analytics_events FOR SELECT
USING (auth.uid() = user_id);

-- Analytics reports policies (admin only)
CREATE POLICY "Admin can manage analytics reports"
ON analytics_reports FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND (metadata->>'role')::text = 'admin'
  )
);

-- Sync stories policies
CREATE POLICY "Users can manage their own sync stories"
ON sync_stories FOR ALL
USING (auth.uid() = user_id);

-- Sync conflicts policies
CREATE POLICY "Users can view conflicts for their stories"
ON sync_conflicts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM sync_stories
    WHERE id = story_id
    AND user_id = auth.uid()
  )
);
```

### Database Functions

```sql
-- Function to update search indices
CREATE OR REPLACE FUNCTION update_search_index()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO search_indices (story_id, content_vector, metadata_vector)
  VALUES (
    NEW.id,
    to_tsvector('english', COALESCE(NEW.imported_story_content, '')),
    to_tsvector('english', COALESCE(NEW.story_metadata::text, ''))
  )
  ON CONFLICT (story_id) DO UPDATE SET
    content_vector = EXCLUDED.content_vector,
    metadata_vector = EXCLUDED.metadata_vector,
    last_indexed = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update search indices
CREATE TRIGGER update_search_index_trigger
  AFTER INSERT OR UPDATE ON game_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_search_index();

-- Function to clean up old analytics events
CREATE OR REPLACE FUNCTION cleanup_old_analytics()
RETURNS void AS $$
BEGIN
  DELETE FROM analytics_events
  WHERE created_at < NOW() - INTERVAL '1 year';
END;
$$ LANGUAGE plpgsql;
```

## Application Configuration

### React Native Configuration

#### Metro Configuration

Update `metro.config.js`:

```javascript
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const config = {
  resolver: {
    alias: {
      '@': './src',
    },
  },
  transformer: {
    minifierConfig: {
      keep_classnames: true,
      keep_fnames: true,
      mangle: {
        keep_classnames: true,
        keep_fnames: true,
      },
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
```

#### Babel Configuration

Update `babel.config.js`:

```javascript
module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        alias: {
          '@': './src',
        },
      },
    ],
  ],
};
```

### iOS Configuration

#### Info.plist Updates

Add to `ios/CreativeBridge/Info.plist`:

```xml
<key>NSDocumentPickerUsageDescription</key>
<string>CreativeBridge needs access to documents to import story files</string>

<key>NSFileProviderDomainUsageDescription</key>
<string>CreativeBridge accesses files to import stories for continuation</string>

<key>NSMicrophoneUsageDescription</key>
<string>CreativeBridge uses microphone for voice input features</string>

<key>NSCameraUsageDescription</key>
<string>CreativeBridge may use camera for document scanning</string>
```

#### Podfile Configuration

Ensure `ios/Podfile` includes:

```ruby
platform :ios, '12.4'
require_relative '../node_modules/react-native/scripts/react_native_pods'
require_relative '../node_modules/@react-native-community/cli-platform-ios/native_modules'

target 'CreativeBridge' do
  config = use_native_modules!

  use_react_native!(
    :path => config[:reactNativePath],
    :hermes_enabled => true,
    :fabric_enabled => false,
    :flipper_configuration => FlipperConfiguration.enabled,
    :app_path => "#{Pod::Config.instance.installation_root}/.."
  )

  # Story continuation dependencies
  pod 'react-native-document-picker', :path => '../node_modules/react-native-document-picker'

  post_install do |installer|
    react_native_post_install(installer)
  end
end
```

### Android Configuration

#### Permissions

Add to `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
```

#### ProGuard Configuration

Update `android/app/proguard-rules.pro`:

```proguard
# Keep Story Continuation classes
-keep class com.creativebridge.story.** { *; }
-keep class com.creativebridge.analytics.** { *; }
-keep class com.creativebridge.sync.** { *; }

# Keep React Native modules
-keep class com.facebook.react.** { *; }
-keep class com.reactnativecommunity.** { *; }

# Keep Supabase/OpenAI related classes
-keep class io.supabase.** { *; }
-keep class com.openai.** { *; }
```

## Deployment Procedures

### Development Deployment

```bash
# Install dependencies
npm install

# iOS deployment
cd ios && pod install && cd ..
npx react-native run-ios

# Android deployment
npx react-native run-android
```

### Staging Deployment

```bash
# Build for staging
npm run build:staging

# iOS staging build
npm run build:ios -- --configuration Staging

# Android staging build
npm run build:android -- --variant staging
```

### Production Deployment

#### iOS Production Build

```bash
# Clean build directory
cd ios && rm -rf build && cd ..

# Install pods
cd ios && pod install && cd ..

# Build for App Store
npx react-native run-ios --configuration Release

# Or use Xcode for distribution build
```

#### Android Production Build

```bash
# Clean build
cd android && ./gradlew clean && cd ..

# Generate signed APK
cd android && ./gradlew assembleRelease

# Generate signed AAB (recommended)
cd android && ./gradlew bundleRelease
```

### Database Migration in Production

```bash
# Create backup before migration
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Run migration scripts
psql $DATABASE_URL < migrations/001_story_continuation.sql
psql $DATABASE_URL < migrations/002_analytics_tables.sql
psql $DATABASE_URL < migrations/003_sync_tables.sql
psql $DATABASE_URL < migrations/004_search_tables.sql

# Verify migration
psql $DATABASE_URL -c "\d+ game_sessions"
psql $DATABASE_URL -c "\d+ analytics_events"
```

## Configuration Management

### Environment-Specific Configs

#### Development Config

```typescript
// src/config/development.ts
export const developmentConfig = {
  apiUrl: 'http://localhost:3000',
  supabaseUrl: process.env.SUPABASE_URL_DEV,
  openaiApiKey: process.env.OPENAI_API_KEY_DEV,
  enableDebugLogs: true,
  enableAnalytics: false,
  syncInterval: 10000, // 10 seconds for faster development
  maxFileSize: 5242880, // 5MB for development
};
```

#### Production Config

```typescript
// src/config/production.ts
export const productionConfig = {
  apiUrl: 'https://api.creativebridge.com',
  supabaseUrl: process.env.SUPABASE_URL_PROD,
  openaiApiKey: process.env.OPENAI_API_KEY_PROD,
  enableDebugLogs: false,
  enableAnalytics: true,
  syncInterval: 30000, // 30 seconds
  maxFileSize: 10485760, // 10MB
};
```

### Feature Flags

```typescript
// src/config/features.ts
export const featureFlags = {
  storyImportEnabled: true,
  analyticsEnabled: true,
  syncEnabled: true,
  advancedSearchEnabled: true,
  storyQuestIntegration: false, // Not yet implemented
  collaborativeWriting: false, // Future feature
  voiceInput: true,
  offlineMode: true,
};
```

## Monitoring and Observability

### Application Performance Monitoring

```typescript
// src/services/monitoring.ts
import { crashlytics } from '@react-native-firebase/crashlytics';
import { perf } from '@react-native-firebase/perf';

export class MonitoringService {
  static recordError(error: Error, context?: Record<string, any>) {
    crashlytics().recordError(error);
    if (context) {
      crashlytics().setAttributes(context);
    }
  }

  static startTrace(name: string) {
    return perf().startTrace(name);
  }

  static recordCustomMetric(name: string, value: number) {
    perf().putMetric(name, value);
  }
}
```

### Health Checks

```typescript
// src/services/healthCheck.ts
export class HealthCheckService {
  static async performHealthCheck() {
    const checks = {
      database: await this.checkDatabase(),
      analytics: await this.checkAnalytics(),
      sync: await this.checkSync(),
      ai: await this.checkAIService(),
    };

    return {
      healthy: Object.values(checks).every(check => check.status === 'ok'),
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  private static async checkDatabase() {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('count')
        .limit(1);

      return error
        ? { status: 'error', message: error.message }
        : { status: 'ok', responseTime: Date.now() };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }

  // Additional health check methods...
}
```

## Security Configuration

### API Security

```typescript
// src/services/security.ts
export const securityConfig = {
  rateLimit: {
    analytics: { max: 100, window: 60000 }, // 100 requests per minute
    search: { max: 60, window: 60000 }, // 60 requests per minute
    sync: { max: 30, window: 60000 }, // 30 requests per minute
    ai: { max: 10, window: 60000 }, // 10 requests per minute
  },

  encryption: {
    algorithm: 'AES-256-GCM',
    keyDerivation: 'PBKDF2',
    iterations: 100000,
  },

  validation: {
    maxStoryLength: 1000000, // 1MB
    maxFileSize: 10485760, // 10MB
    allowedFileTypes: ['txt', 'plain'],
  },
};
```

### Content Security Policy

```typescript
// src/config/csp.ts
export const contentSecurityPolicy = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-eval'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:', 'https:'],
  'connect-src': [
    "'self'",
    'https://*.supabase.co',
    'https://api.openai.com',
    'wss://*.supabase.co',
  ],
  'font-src': ["'self'"],
  'object-src': ["'none'"],
  'media-src': ["'self'"],
  'frame-src': ["'none'"],
};
```

## Backup and Recovery

### Database Backup Strategy

```bash
#!/bin/bash
# backup-script.sh

# Environment variables
DATABASE_URL=$1
BACKUP_BUCKET=$2
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup
pg_dump $DATABASE_URL > "backup_${DATE}.sql"

# Compress backup
gzip "backup_${DATE}.sql"

# Upload to cloud storage
aws s3 cp "backup_${DATE}.sql.gz" "s3://${BACKUP_BUCKET}/backups/"

# Cleanup local backup
rm "backup_${DATE}.sql.gz"

# Keep only last 30 days of backups
aws s3 ls "s3://${BACKUP_BUCKET}/backups/" --recursive | \
  sort | head -n -30 | \
  awk '{print $4}' | \
  xargs -I {} aws s3 rm "s3://${BACKUP_BUCKET}/{}"
```

### Recovery Procedures

```bash
#!/bin/bash
# recovery-script.sh

BACKUP_FILE=$1
DATABASE_URL=$2

# Download backup from S3
aws s3 cp "s3://backup-bucket/backups/${BACKUP_FILE}" .

# Decompress
gunzip "${BACKUP_FILE}"

# Drop existing database (CAUTION!)
dropdb --if-exists $(echo $DATABASE_URL | sed 's/.*\///')

# Create new database
createdb $(echo $DATABASE_URL | sed 's/.*\///')

# Restore from backup
psql $DATABASE_URL < "${BACKUP_FILE%.gz}"

# Verify restoration
psql $DATABASE_URL -c "\d+"
```

## Maintenance Tasks

### Scheduled Maintenance

Create cron jobs for regular maintenance:

```bash
# Clean up old analytics events (daily at 2 AM)
0 2 * * * psql $DATABASE_URL -c "SELECT cleanup_old_analytics();"

# Update search indices (daily at 3 AM)
0 3 * * * psql $DATABASE_URL -c "REFRESH MATERIALIZED VIEW search_indices;"

# Backup database (daily at 4 AM)
0 4 * * * /path/to/backup-script.sh $DATABASE_URL backup-bucket

# Sync health check (every 5 minutes)
*/5 * * * * curl -f http://localhost:3000/health || echo "Health check failed"
```

### Performance Optimization

```sql
-- Analyze table statistics (weekly)
ANALYZE game_sessions;
ANALYZE analytics_events;
ANALYZE sync_stories;

-- Vacuum tables (weekly)
VACUUM ANALYZE game_sessions;
VACUUM ANALYZE analytics_events;
VACUUM ANALYZE sync_stories;

-- Reindex search tables (monthly)
REINDEX INDEX idx_search_content_vector;
REINDEX INDEX idx_search_metadata_vector;
```
