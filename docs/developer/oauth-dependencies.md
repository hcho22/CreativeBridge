# OAuth Dependencies Documentation

This document describes the dependencies required for Google and Apple OAuth authentication implementation in CreativeBridge.

## Overview

The OAuth implementation uses Clerk as the authentication provider, which handles OAuth flows and JWT token management. The following dependencies are required:

## Required Dependencies

### 1. @clerk/clerk-expo (v2.19.12+)

**Purpose**: Clerk SDK for React Native/Expo applications. Provides OAuth authentication, user management, and JWT token handling.

**Key Features**:

- Google OAuth integration
- Apple Sign In integration
- JWT token management
- User session management
- Automatic account linking

**Usage**:

```typescript
import { ClerkProvider, useAuth, useUser } from '@clerk/clerk-expo';

// Wrap app with ClerkProvider
<ClerkProvider publishableKey={clerkPublishableKey}>
  <App />
</ClerkProvider>;

// Use hooks in components
const { signIn, signOut, getToken } = useAuth();
const { user } = useUser();
```

**Documentation**: [Clerk Expo Documentation](https://clerk.com/docs/quickstarts/expo)

---

### 2. expo-web-browser (~15.0.10)

**Purpose**: Provides web browser functionality for OAuth flows. Handles opening OAuth provider authentication pages and managing redirects.

**Key Features**:

- Open OAuth authentication sessions
- Handle OAuth redirects
- Dismiss browser sessions
- Support for custom URL schemes

**Usage**:

```typescript
import * as WebBrowser from 'expo-web-browser';

// Open OAuth session
const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
```

**Note**: This package is already installed in the project and is used by Clerk internally for OAuth flows.

**Documentation**: [Expo Web Browser Documentation](https://docs.expo.dev/versions/latest/sdk/webbrowser/)

---

### 3. expo-linking (^8.0.10)

**Purpose**: Handles deep linking for OAuth callbacks. Manages URL schemes and parsing OAuth callback parameters.

**Key Features**:

- Parse deep link URLs
- Open URLs with custom schemes
- Handle OAuth callback URLs
- Get initial URL when app opens from deep link

**Usage**:

```typescript
import * as Linking from 'expo-linking';

// Parse OAuth callback URL
const url = await Linking.getInitialURL();
const parsed = Linking.parse(url);

// Open URL
await Linking.openURL('creativebridge://auth/callback');
```

**Deep Link Scheme**: `creativebridge://auth/callback`

**Documentation**: [Expo Linking Documentation](https://docs.expo.dev/versions/latest/sdk/linking/)

---

### 4. @supabase/supabase-js (^2.57.4+)

**Purpose**: Supabase client for database operations and JWT verification. Used to verify Clerk JWTs and manage user data.

**Key Features**:

- JWT verification against Clerk's JWKS endpoint
- Database operations with RLS policies
- User profile management
- Session management

**Usage**:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Verify Clerk JWT and create session
const { data, error } = await supabase.auth.setSession({
  access_token: clerkJWT,
  refresh_token: '',
});
```

**Note**: This package is already installed in the project.

**Documentation**: [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)

---

## Installation

All dependencies have been installed. To verify installation:

```bash
# Check installed versions
npm list @clerk/clerk-expo expo-web-browser expo-linking @supabase/supabase-js

# Run verification tests
npm test -- src/__tests__/setup/oauthDependencies.test.ts
```

## Dependency Versions

| Package                 | Version  | Status               |
| ----------------------- | -------- | -------------------- |
| `@clerk/clerk-expo`     | ^2.19.12 | ✅ Installed         |
| `expo-web-browser`      | ~15.0.10 | ✅ Already installed |
| `expo-linking`          | ^8.0.10  | ✅ Installed         |
| `@supabase/supabase-js` | ^2.57.4  | ✅ Already installed |

## Compatibility

All dependencies are compatible with:

- React Native 0.81.5
- Expo SDK ~54.0.25
- React 19.1.0
- TypeScript 5.8.3

## Testing

Verification tests are located at:

- `src/__tests__/setup/oauthDependencies.test.ts`

These tests verify:

- All packages are installed
- Required functions/classes are available
- TypeScript types are correct
- Packages can be imported together without conflicts

Run tests with:

```bash
npm test -- src/__tests__/setup/oauthDependencies.test.ts
```

## Jest Configuration

The following Jest configuration updates were made to support OAuth dependencies:

1. **transformIgnorePatterns**: Added `@clerk`, `expo-web-browser`, and `expo-linking` to allow Jest to transform these packages.

2. **Mocks**: Added mocks in `jest.setup.js` for:
   - `@clerk/clerk-expo` - Mocks ClerkProvider and hooks
   - `expo-web-browser` - Mocks OAuth session functions
   - `expo-linking` - Mocks deep linking functions

## Troubleshooting

### Issue: Module not found errors

**Solution**: Ensure all dependencies are installed:

```bash
npm install
```

### Issue: Jest test failures with Clerk

**Solution**: The Jest configuration includes mocks for Clerk. If tests fail, check:

1. `jest.config.js` includes `@clerk` in `transformIgnorePatterns`
2. `jest.setup.js` includes Clerk mocks

### Issue: TypeScript errors

**Solution**: Ensure TypeScript can resolve the packages:

```bash
npx tsc --noEmit
```

If errors persist, check that `node_modules` contains the packages.

## Next Steps

After dependencies are installed:

1. ✅ Task 1.1: Clerk Setup and Configuration
2. ✅ Task 1.2: Install Required Dependencies (this task)
3. ⏭️ Task 1.3: Configure Supabase JWT Verification
4. ⏭️ Task 1.4: Configure Deep Linking for Clerk OAuth Callbacks

See `TASKS-oauth-google-apple-signin-PRD.md` for the complete implementation plan.

## References

- [Clerk Expo Documentation](https://clerk.com/docs/quickstarts/expo)
- [Expo Web Browser](https://docs.expo.dev/versions/latest/sdk/webbrowser/)
- [Expo Linking](https://docs.expo.dev/versions/latest/sdk/linking/)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
