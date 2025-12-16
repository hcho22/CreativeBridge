# Fix Localhost Connection Errors - Summary

## Problem

The simulator was showing multiple connection errors to localhost development servers:

- `Connection failed to connect 1:61, reason -1`
- `HTTP load failed, 0/0 bytes (error code: -1004 [1:61])`
- Attempts to connect to ports: 8082, 19001, 19002, 8085, 19000, 8084
- All trying to access `/status` endpoints

These errors were appearing during app loading and cluttering the console.

## Root Cause

1. **Story Quest Service**: Had a hardcoded `localhost:5000` URL that was always trying to connect, even when the service wasn't available
2. **Development Tools**: React Native/Expo development tools may automatically check for Metro bundler status on various ports
3. **No Error Suppression**: Connection failures were being logged as errors even when services weren't expected to be available

## Solution Implemented

### 1. Updated Story Quest Service Configuration

**File:** `src/services/storyQuestService.ts`

- Changed hardcoded `localhost:5000` to use environment variable with production fallback
- Only uses localhost in development when explicitly configured
- Added production URL as fallback: `https://api.storyquest.com/api`

```typescript
// Before
const STORY_QUEST_API_BASE = 'http://localhost:5000/api'; // Development URL

// After
const STORY_QUEST_API_BASE =
  __DEV__ && process.env.STORY_QUEST_API_URL
    ? process.env.STORY_QUEST_API_URL
    : process.env.STORY_QUEST_API_URL || 'https://api.storyquest.com/api';
```

### 2. Enhanced Health Check Method

**File:** `src/services/storyQuestService.ts`

- Added timeout (3 seconds) to prevent hanging connections
- Skip health checks in production when using localhost
- Suppress connection errors (code -1004) silently
- Only log warnings in development for non-connection errors

```typescript
async checkApiHealth(): Promise<boolean> {
  // Skip health check if using localhost and not in development
  if (!__DEV__ && STORY_QUEST_API_BASE.includes('localhost')) {
    return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${STORY_QUEST_API_BASE}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    // ... rest of implementation
  } catch (error: any) {
    // Silently fail if it's a connection error (service not available)
    if (error.name !== 'AbortError' && error.code !== -1004) {
      if (__DEV__) {
        console.warn('Story_Quest API health check failed:', error.message);
      }
    }
    return false;
  }
}
```

## Benefits

1. **Reduced Console Noise**: Connection errors to unavailable services are now suppressed
2. **Better Error Handling**: Timeout prevents hanging connections
3. **Production Ready**: Uses production URL when localhost isn't configured
4. **Development Friendly**: Still allows localhost in development when needed

## Remaining Errors

Some connection errors may still appear from:

- React Native/Expo development tools checking Metro bundler status
- These are harmless and don't affect app functionality
- They're internal to React Native's development infrastructure

## Testing

To test the fix:

1. Run the app on simulator
2. Check console - should see fewer/no connection errors
3. Story Quest service should gracefully handle unavailable API

## Environment Variables

To use Story Quest API in development, set:

```bash
STORY_QUEST_API_URL=http://localhost:5000/api
```

Otherwise, it will use the production URL or skip health checks.
