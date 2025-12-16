# Clerk Deep Linking Setup Guide

This guide explains how deep linking is configured for Clerk OAuth callbacks in CreativeBridge.

## Overview

**Deep Link Scheme:** `creativebridge://auth/callback`

Clerk OAuth callbacks are handled via deep links that redirect back to the app after authentication. The app receives these callbacks and processes them to complete the OAuth flow.

## Configuration

### 1. app.json

**File:** `app.json`

The URL scheme is already configured:

```json
{
  "scheme": "creativebridge"
}
```

This tells Expo to register the `creativebridge://` URL scheme for deep linking.

### 2. iOS Configuration

**File:** `ios/CreativeBridge/Info.plist`

The URL scheme is configured in `CFBundleURLTypes`:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>creativebridge</string>
    </array>
  </dict>
</array>
```

**Verification:**

```bash
# Test deep link on iOS simulator
xcrun simctl openurl booted "creativebridge://auth/callback?test=1"
```

### 3. Android Configuration

**File:** `android/app/src/main/AndroidManifest.xml`

The intent filter is configured in the MainActivity:

```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="creativebridge" />
</intent-filter>
```

**Verification:**

```bash
# Test deep link on Android emulator
adb shell am start -W -a android.intent.action.VIEW -d "creativebridge://auth/callback?test=1"
```

### 4. App.tsx Deep Link Handler

**File:** `App.tsx`

The app handles deep links in the `MainApp` component:

1. **Clerk Callback Detection**: Checks if the URL is a Clerk OAuth callback
2. **Supabase Callback Detection**: Falls back to Supabase OAuth/email confirmation handling
3. **Error Handling**: Processes OAuth errors gracefully

**Key Features:**

- Handles app launch with deep link
- Handles deep links while app is running
- Completes OAuth sessions when app returns from background
- Processes both Clerk and Supabase callbacks

### 5. Clerk Deep Link Utilities

**File:** `src/utils/clerkDeepLink.ts`

Utility functions for parsing and handling Clerk callbacks:

- `isClerkCallback(url)` - Identifies Clerk OAuth callbacks
- `parseClerkCallbackURL(url)` - Parses callback URL structure
- `extractClerkRedirectURL(url)` - Extracts Clerk redirect URL
- `getClerkCallbackError(url)` - Extracts error information
- `handleClerkCallback(url)` - Processes Clerk callback

## Clerk OAuth Callback Format

Clerk OAuth callbacks typically come in these formats:

### Success Callback

```
creativebridge://auth/callback?__clerk_redirect_url=https://clerk.example.com/callback
```

### Error Callback

```
creativebridge://auth/callback?error=access_denied&error_description=User%20cancelled
```

### With Session

```
creativebridge://auth/callback?__clerk_session=abc123&__clerk_redirect_url=https://...
```

## Deep Link Flow

### 1. User Initiates OAuth

User taps "Continue with Google" or "Continue with Apple" button.

### 2. Clerk OAuth Flow

- Clerk opens OAuth provider (Google/Apple) in browser
- User authenticates with provider
- Provider redirects back to Clerk
- Clerk processes authentication

### 3. Deep Link Redirect

- Clerk redirects to `creativebridge://auth/callback?__clerk_redirect_url=...`
- App receives deep link via `Linking` API
- `App.tsx` detects Clerk callback
- Clerk callback is processed

### 4. Session Completion

- ClerkProvider handles the redirect URL
- OAuth session is completed
- User is authenticated

## Testing

### Run Tests

```bash
npm test -- src/__tests__/utils/clerkDeepLink.test.ts
```

### Manual Testing

**iOS Simulator:**

```bash
xcrun simctl openurl booted "creativebridge://auth/callback?__clerk_redirect_url=https://example.com"
```

**Android Emulator:**

```bash
adb shell am start -W -a android.intent.action.VIEW -d "creativebridge://auth/callback?__clerk_redirect_url=https://example.com"
```

### Test Scenarios

1. **Successful Callback**: URL with `__clerk_redirect_url`
2. **Error Callback**: URL with `error` parameter
3. **Missing Parameters**: URL without required parameters
4. **Invalid URL**: Malformed or non-callback URLs

## Troubleshooting

### Issue: Deep Link Not Opening App

**Solution:**

1. Verify URL scheme is configured in `app.json`
2. Check iOS `Info.plist` has `creativebridge` in `CFBundleURLSchemes`
3. Check Android `AndroidManifest.xml` has intent filter
4. Rebuild app after configuration changes

### Issue: Clerk Callback Not Detected

**Solution:**

1. Verify callback URL includes `auth/callback` path
2. Check that URL doesn't have `access_token` (Supabase callback)
3. Ensure URL has Clerk-specific parameters or error parameters
4. Check console logs for deep link reception

### Issue: OAuth Session Not Completing

**Solution:**

1. Verify `ClerkProvider` is wrapping the app
2. Check that `maybeCompleteAuthSession()` is called
3. Ensure redirect URL is passed to Clerk
4. Check Clerk dashboard for OAuth configuration

## Clerk Dashboard Configuration

In Clerk dashboard, ensure redirect URLs are configured:

1. Navigate to **Settings** → **Paths**
2. Add redirect URLs:
   - **iOS**: `creativebridge://auth/callback`
   - **Android**: `creativebridge://auth/callback`
3. Save configuration

## Integration with ClerkProvider

The `ClerkProvider` component automatically handles OAuth callbacks when:

- Deep link is received with Clerk redirect URL
- `maybeCompleteAuthSession()` is called
- Redirect URL is passed to Clerk

**Note:** ClerkProvider handles the OAuth completion automatically. The deep link handler just needs to recognize Clerk callbacks and let Clerk process them.

## Next Steps

After completing this setup:

1. ✅ Task 1.1: Clerk Setup and Configuration
2. ✅ Task 1.2: Install Required Dependencies
3. ✅ Task 1.3: Configure Supabase JWT Verification
4. ✅ Task 1.4: Configure Deep Linking for Clerk OAuth Callbacks (this task)
5. ⏭️ Phase 2: Google OAuth Implementation

See `TASKS-oauth-google-apple-signin-PRD.md` for the complete implementation plan.

## References

- [Expo Linking Documentation](https://docs.expo.dev/versions/latest/sdk/linking/)
- [Clerk OAuth Documentation](https://clerk.com/docs/authentication/social-connections)
- [React Native Deep Linking](https://reactnative.dev/docs/linking)
