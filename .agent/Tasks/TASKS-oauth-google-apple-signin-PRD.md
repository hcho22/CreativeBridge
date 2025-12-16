# Google and Apple OAuth Sign-In Feature - Implementation Tasks

## Overview

**Based on:** oauth-google-apple-signin-PRD.md  
**Implementation Timeline:** 3-4 weeks  
**Phases:** 5 phases (Setup & Configuration → Google OAuth → Apple OAuth → Account Linking → Profile Completion & Polish)

**Architecture:** Clerk handles OAuth authentication and issues JWTs. Supabase verifies JWTs against Clerk's JWKS endpoint and uses Clerk user ID for RLS policies.

---

## Phase 1: Setup & Configuration (Week 1, Days 1-2)

### Task 1.1: Clerk Setup and Configuration

**Objective:** Set up Clerk application and configure Google and Apple OAuth providers

**Implementation Steps:**

- [ ] Create Clerk account and application in Clerk dashboard
- [ ] Obtain Clerk publishable key and secret key
- [ ] Configure Google OAuth provider in Clerk dashboard
- [ ] Add Google OAuth credentials (Client ID, Client Secret) to Clerk
- [ ] Configure Apple Sign In provider in Clerk dashboard
- [ ] Add Apple OAuth credentials (Service ID, Team ID, Key ID, Private Key) to Clerk
- [ ] Set up redirect URLs for iOS (`creativebridge://auth/callback`)
- [ ] Set up redirect URLs for Android (`creativebridge://auth/callback`)
- [ ] Configure OAuth scopes (email, profile) in Clerk
- [ ] Obtain Clerk JWKS endpoint URL for Supabase verification
- [ ] Test redirect URLs are properly configured
- [ ] Document all Clerk configuration settings securely

**Verification Test:**

```typescript
// Test: Verify Clerk configuration
import { isClerkConfigured, getClerkConfig } from '../config/environment';

describe('Clerk Configuration', () => {
  test('Clerk is configured', () => {
    expect(isClerkConfigured()).toBe(true);
  });

  test('Clerk publishable key is available', () => {
    const config = getClerkConfig();
    expect(config.publishableKey).toBeDefined();
    expect(config.publishableKey).toMatch(/^pk_/);
  });

  test('Clerk JWKS endpoint is configured', () => {
    const config = getClerkConfig();
    expect(config.jwksUrl).toBeDefined();
    expect(config.jwksUrl).toContain('clerk');
  });
});
```

**Validation Steps:**

1. Log into Clerk dashboard and verify application is created
2. Navigate to OAuth providers section
3. Verify Google provider is configured with green checkmark
4. Verify Apple provider is configured with green checkmark
5. Check that redirect URLs are correctly configured for both platforms
6. Verify OAuth scopes include "email" and "profile"
7. Copy Clerk JWKS endpoint URL for Supabase configuration
8. Document all configuration values in a secure location
9. Test that configuration persists after dashboard refresh

**Expected Outcome:**

- Clerk application created and configured
- Google OAuth provider configured in Clerk
- Apple OAuth provider configured in Clerk
- Redirect URLs properly set for iOS and Android
- Clerk JWKS endpoint URL obtained for Supabase
- All credentials securely stored in Clerk dashboard

---

### Task 1.2: Install Required Dependencies

**Objective:** Install and configure React Native packages needed for Clerk OAuth implementation

**Implementation Steps:**

- [ ] Review current `package.json` dependencies
- [ ] Install `@clerk/clerk-expo` for Clerk integration: `npm install @clerk/clerk-expo`
- [ ] Install `expo-web-browser` for OAuth web flows: `npm install expo-web-browser`
- [ ] Install `expo-linking` if not already installed: `npm install expo-linking`
- [ ] Verify `@supabase/supabase-js` is installed (already in project)
- [ ] Update `package.json` with new dependencies
- [ ] Run `npm install` to install all dependencies
- [ ] Verify no dependency conflicts or version issues
- [ ] Update TypeScript types if needed
- [ ] Document all new dependencies and their purposes

**Verification Test:**

```typescript
// Test: Verify dependencies are installed
import { ClerkProvider } from '@clerk/clerk-expo';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

describe('OAuth Dependencies', () => {
  test('@clerk/clerk-expo is installed', () => {
    expect(ClerkProvider).toBeDefined();
  });

  test('expo-web-browser is installed', () => {
    expect(WebBrowser).toBeDefined();
    expect(typeof WebBrowser.openAuthSessionAsync).toBe('function');
  });

  test('expo-linking is installed', () => {
    expect(Linking).toBeDefined();
    expect(typeof Linking.openURL).toBe('function');
  });

  test('package.json includes required dependencies', () => {
    const packageJson = require('../../package.json');
    expect(packageJson.dependencies['@clerk/clerk-expo']).toBeDefined();
    expect(packageJson.dependencies['expo-web-browser']).toBeDefined();
    expect(packageJson.dependencies['expo-linking']).toBeDefined();
  });
});
```

**Validation Steps:**

1. Check `package.json` and verify `@clerk/clerk-expo` is listed in dependencies
2. Check `package.json` and verify `expo-web-browser` is listed in dependencies
3. Check `package.json` and verify `expo-linking` is listed in dependencies
4. Run `npm list @clerk/clerk-expo` to verify installation
5. Run `npm list expo-web-browser` to verify installation
6. Check `node_modules` folder to ensure packages are installed
7. Run `npm test` to ensure no breaking changes
8. Verify TypeScript compilation succeeds: `npx tsc --noEmit`

**Expected Outcome:**

- Clerk SDK installed and configured
- All required OAuth dependencies installed
- No dependency conflicts
- TypeScript types available for all new packages
- Project builds successfully with new dependencies

---

### Task 1.3: Configure Supabase JWT Verification

**Objective:** Set up Supabase to verify Clerk JWTs and configure RLS policies

**Implementation Steps:**

- [ ] Access Supabase project dashboard
- [ ] Configure Supabase to accept Clerk as JWT issuer
- [ ] Set up Supabase Edge Function or API endpoint for Clerk JWT verification
- [ ] Implement function to fetch Clerk's public keys from JWKS endpoint
- [ ] Implement JWT signature verification using Clerk's public keys
- [ ] Extract Clerk user ID from verified JWT claims
- [ ] Map Clerk user ID to Supabase user identifier
- [ ] Update `user_profiles` table schema to use Clerk user ID (or add Clerk user ID column)
- [ ] Create/update RLS policies to use Clerk user ID from JWT
- [ ] Test JWT verification with sample Clerk JWT
- [ ] Document JWT verification setup

**Verification Test:**

```typescript
// Test: Supabase JWT Verification
import { verifyClerkJWT } from '../services/supabaseJWTVerification';

describe('Supabase JWT Verification', () => {
  test('verifies Clerk JWT signature', async () => {
    const clerkJWT = 'eyJ...'; // Sample Clerk JWT
    const result = await verifyClerkJWT(clerkJWT);
    expect(result.valid).toBe(true);
    expect(result.userId).toBeDefined();
  });

  test('extracts Clerk user ID from JWT', async () => {
    const clerkJWT = 'eyJ...';
    const result = await verifyClerkJWT(clerkJWT);
    expect(result.userId).toMatch(/^user_/); // Clerk user ID format
  });

  test('rejects invalid JWT', async () => {
    const invalidJWT = 'invalid.jwt.token';
    const result = await verifyClerkJWT(invalidJWT);
    expect(result.valid).toBe(false);
  });
});
```

**Validation Steps:**

1. Verify Supabase Edge Function or API endpoint is created
2. Test JWT verification with valid Clerk JWT
3. Verify Clerk user ID is extracted correctly
4. Test RLS policies with Clerk user ID
5. Verify users can only access their own data
6. Test JWT expiration handling
7. Check error handling for invalid JWTs

**Expected Outcome:**

- Supabase configured to verify Clerk JWTs
- JWT verification function working correctly
- RLS policies use Clerk user ID
- Users can only access their own data

### Task 1.4: Configure Deep Linking for Clerk OAuth Callbacks

**Objective:** Set up deep linking to handle Clerk OAuth redirects

**Implementation Steps:**

- [ ] Review existing deep linking configuration in `App.tsx`
- [ ] Configure Clerk deep linking in Clerk dashboard
- [ ] Add OAuth callback URL scheme: `creativebridge://auth/callback`
- [ ] Update iOS `Info.plist` with URL scheme configuration
- [ ] Update Android `AndroidManifest.xml` with intent filters
- [ ] Configure `app.json` or `app.config.js` with deep link scheme
- [ ] Test Clerk OAuth callback handling in `App.tsx`
- [ ] Handle Clerk OAuth callback parameters
- [ ] Test deep linking on iOS simulator
- [ ] Test deep linking on Android emulator

**Verification Test:**

```typescript
// Test: Verify deep linking configuration
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

describe('Deep Linking Configuration', () => {
  test('URL scheme is configured correctly', async () => {
    const url = await Linking.getInitialURL();
    // Verify app can handle creativebridge:// URLs
    expect(Linking.canOpenURL('creativebridge://auth/callback')).resolves.toBe(
      true,
    );
  });

  test('Clerk OAuth callback URL is parseable', () => {
    const testUrl = 'creativebridge://auth/callback?__clerk_redirect_url=...';
    const parsed = Linking.parse(testUrl);
    expect(parsed.scheme).toBe('creativebridge');
    expect(parsed.path).toBe('auth/callback');
  });
});
```

**Validation Steps:**

1. Check `app.json` or `app.config.js` for URL scheme configuration
2. Verify iOS `Info.plist` contains `CFBundleURLSchemes` with `creativebridge`
3. Verify Android `AndroidManifest.xml` contains intent filter for `creativebridge://`
4. Verify Clerk dashboard has redirect URLs configured
5. Test deep link manually: `xcrun simctl openurl booted "creativebridge://auth/callback?test=1"`
6. Test on Android: `adb shell am start -W -a android.intent.action.VIEW -d "creativebridge://auth/callback?test=1"`
7. Verify `App.tsx` handles Clerk OAuth callback events correctly
8. Check that Clerk callback parameters are parsed correctly

**Expected Outcome:**

- Deep linking configured for both iOS and Android
- Clerk OAuth callback URLs properly handled
- App can receive and parse Clerk OAuth redirects
- Deep linking tested and working on both platforms

---

## Phase 2: Google OAuth Implementation (Week 1, Days 3-5)

### Task 2.1: Create Google OAuth Service with Clerk

**Objective:** Implement Google OAuth authentication service using Clerk

**Implementation Steps:**

- [ ] Create new file `src/services/oauthService.ts`
- [ ] Import Clerk hooks (`useAuth`, `useUser`) and required dependencies
- [ ] Implement `signInWithGoogle()` function
- [ ] Use Clerk's `signInWithOAuth({ strategy: 'oauth_google' })`
- [ ] Handle Clerk OAuth callback and session creation
- [ ] Retrieve Clerk JWT token using `getToken()` after successful authentication
- [ ] Send Clerk JWT to Supabase for verification
- [ ] Extract user email from Clerk user object
- [ ] Handle authentication errors gracefully
- [ ] Add TypeScript types for OAuth responses
- [ ] Add logging for debugging OAuth flow

**Verification Test:**

```typescript
// Test: Google OAuth service with Clerk
import { oauthService } from '../services/oauthService';
import { useAuth } from '@clerk/clerk-expo';

describe('Google OAuth Service', () => {
  test('signInWithGoogle function exists', () => {
    expect(typeof oauthService.signInWithGoogle).toBe('function');
  });

  test('initiates Google OAuth flow via Clerk', async () => {
    // Mock Clerk OAuth call
    const mockSignIn = jest.fn().mockResolvedValue({
      status: 'complete',
    });

    await oauthService.signInWithGoogle();
    expect(mockSignIn).toHaveBeenCalledWith({
      strategy: 'oauth_google',
    });
  });

  test('retrieves Clerk JWT after authentication', async () => {
    const mockGetToken = jest.fn().mockResolvedValue('clerk.jwt.token');
    const result = await oauthService.signInWithGoogle();
    expect(mockGetToken).toHaveBeenCalled();
    expect(result.jwt).toBeDefined();
  });

  test('sends JWT to Supabase for verification', async () => {
    const result = await oauthService.signInWithGoogle();
    expect(result.supabaseSession).toBeDefined();
  });

  test('handles OAuth errors', async () => {
    const mockSignIn = jest.fn().mockRejectedValue(new Error('OAuth failed'));
    const result = await oauthService.signInWithGoogle();
    expect(result.error).toBeDefined();
  });
});
```

**Validation Steps:**

1. Verify `src/services/oauthService.ts` file exists
2. Check that `signInWithGoogle()` function is exported
3. Verify function uses Clerk's OAuth methods
4. Test function in development environment
5. Verify Clerk JWT is retrieved after authentication
6. Verify JWT is sent to Supabase for verification
7. Check error handling for failed OAuth attempts
8. Verify TypeScript types are correct (no compilation errors)

**Expected Outcome:**

- Google OAuth service created using Clerk
- OAuth flow initiates correctly via Clerk
- Clerk JWT retrieved and sent to Supabase
- Error handling implemented
- TypeScript types defined

---

### Task 2.2: Add Google OAuth to AuthContext with Clerk Integration

**Objective:** Integrate Google OAuth via Clerk into existing authentication context

**Implementation Steps:**

- [ ] Open `src/context/AuthContext.tsx`
- [ ] Import Clerk hooks (`useAuth`, `useUser`) from `@clerk/clerk-expo`
- [ ] Import OAuth service
- [ ] Add `signInWithGoogle()` method to `AuthContextType` interface
- [ ] Implement `signInWithGoogle()` in `AuthProvider` using Clerk
- [ ] After Clerk authentication, retrieve JWT using `getToken()`
- [ ] Send Clerk JWT to Supabase for verification
- [ ] Handle Supabase session creation using Clerk user ID
- [ ] Update user state after successful OAuth (from Clerk user object)
- [ ] Update Supabase user profile using Clerk user ID
- [ ] Handle OAuth errors and return error messages
- [ ] Ensure OAuth users bypass email confirmation (handled by Clerk)
- [ ] Update `emailConfirmed` state for OAuth users (from Clerk user)
- [ ] Add OAuth user to auth state change listener

**Verification Test:**

```typescript
// Test: Google OAuth in AuthContext with Clerk
import { renderHook, act } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { useAuth as useClerkAuth } from '@clerk/clerk-expo';

describe('AuthContext Google OAuth', () => {
  test('signInWithGoogle is available in context', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });
    expect(typeof result.current.signInWithGoogle).toBe('function');
  });

  test('signInWithGoogle updates user state on success', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    // Mock successful Clerk OAuth
    await act(async () => {
      await result.current.signInWithGoogle();
    });

    expect(result.current.user).toBeDefined();
    expect(result.current.emailConfirmed).toBe(true);
    // Verify Clerk user ID is used
    expect(result.current.user?.id).toMatch(/^user_/);
  });

  test('signInWithGoogle sends JWT to Supabase', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await act(async () => {
      await result.current.signInWithGoogle();
    });

    // Verify Supabase session is created with Clerk user ID
    expect(result.current.session).toBeDefined();
  });

  test('signInWithGoogle handles errors', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    // Mock failed OAuth
    await act(async () => {
      const response = await result.current.signInWithGoogle();
      expect(response.error).toBeDefined();
    });
  });
});
```

**Validation Steps:**

1. Check `AuthContext.tsx` exports `signInWithGoogle` in the context value
2. Verify `signInWithGoogle` is available when using `useAuth()` hook
3. Test OAuth sign-in in app and verify Clerk authentication works
4. Verify Clerk JWT is retrieved and sent to Supabase
5. Verify Supabase session is created using Clerk user ID
6. Verify `emailConfirmed` is automatically set to `true` for OAuth users (from Clerk)
7. Test error handling by simulating failed OAuth
8. Verify auth state change listener handles Clerk OAuth sessions
9. Check that OAuth users don't see email confirmation screen

**Expected Outcome:**

- Google OAuth integrated into AuthContext via Clerk
- Clerk JWT retrieved and sent to Supabase
- OAuth users automatically authenticated
- Email confirmation bypassed for OAuth users (handled by Clerk)
- Error handling working correctly

---

### Task 2.3: Create Google Sign-In Button Component

**Objective:** Create UI component for Google OAuth button

**Implementation Steps:**

- [ ] Create `src/components/auth/GoogleSignInButton.tsx`
- [ ] Design button matching existing design system
- [ ] Add Google logo/icon on left side
- [ ] Add "Continue with Google" text
- [ ] Style button (white background, rounded corners, proper spacing)
- [ ] Add loading state indicator
- [ ] Add disabled state during authentication
- [ ] Connect button to `signInWithGoogle()` from AuthContext
- [ ] Handle button press and initiate OAuth flow
- [ ] Add error handling and user feedback
- [ ] Make button accessible (accessibility labels)

**Verification Test:**

```typescript
// Test: Google Sign-In Button
import { render, fireEvent } from '@testing-library/react-native';
import GoogleSignInButton from '../components/auth/GoogleSignInButton';
import { AuthProvider } from '../context/AuthContext';

describe('GoogleSignInButton', () => {
  test('renders Google button', () => {
    const { getByText } = render(
      <AuthProvider>
        <GoogleSignInButton />
      </AuthProvider>,
    );
    expect(getByText('Continue with Google')).toBeTruthy();
  });

  test('calls signInWithGoogle on press', () => {
    const mockSignIn = jest.fn();
    const { getByText } = render(
      <AuthProvider>
        <GoogleSignInButton onSignIn={mockSignIn} />
      </AuthProvider>,
    );

    fireEvent.press(getByText('Continue with Google'));
    expect(mockSignIn).toHaveBeenCalled();
  });

  test('shows loading state during authentication', () => {
    const { getByTestId } = render(
      <AuthProvider>
        <GoogleSignInButton loading={true} />
      </AuthProvider>,
    );
    expect(getByTestId('google-button-loading')).toBeTruthy();
  });
});
```

**Validation Steps:**

1. Verify `GoogleSignInButton.tsx` component exists
2. Check button renders with "Continue with Google" text
3. Verify Google logo/icon appears on left side of button
4. Test button press initiates OAuth flow
5. Verify loading indicator appears during authentication
6. Check button is disabled during OAuth flow
7. Verify button styling matches design system
8. Test accessibility (screen reader can identify button)

**Expected Outcome:**

- Google Sign-In button component created
- Button matches design system
- OAuth flow initiates on button press
- Loading and error states handled

---

### Task 2.4: Integrate Google Button into AuthScreen

**Objective:** Add Google OAuth button to login/signup screen

**Implementation Steps:**

- [ ] Open `src/screens/AuthScreen.tsx`
- [ ] Import `GoogleSignInButton` component
- [ ] Add Google button below email/password form
- [ ] Add visual separator ("or" divider) between form and OAuth buttons
- [ ] Position button with consistent spacing
- [ ] Connect button to authentication flow
- [ ] Handle OAuth success and navigate to app
- [ ] Handle OAuth errors and show user-friendly messages
- [ ] Ensure button works in both login and signup modes
- [ ] Test button placement and styling

**Verification Test:**

```typescript
// Test: Google button in AuthScreen
import { render, fireEvent } from '@testing-library/react-native';
import AuthScreen from '../screens/AuthScreen';
import { AuthProvider } from '../context/AuthContext';

describe('AuthScreen Google Integration', () => {
  test('Google button appears below email form', () => {
    const { getByText, getByPlaceholderText } = render(
      <AuthProvider>
        <AuthScreen />
      </AuthProvider>,
    );

    const emailInput = getByPlaceholderText('Enter your email');
    const googleButton = getByText('Continue with Google');

    // Verify button appears after email input
    expect(emailInput).toBeTruthy();
    expect(googleButton).toBeTruthy();
  });

  test('divider appears between form and OAuth buttons', () => {
    const { getByText } = render(
      <AuthProvider>
        <AuthScreen />
      </AuthProvider>,
    );
    expect(getByText('or')).toBeTruthy();
  });

  test('Google button works in both login and signup modes', () => {
    const { getByText, getByText: getByText2 } = render(
      <AuthProvider>
        <AuthScreen />
      </AuthProvider>,
    );

    // Test in login mode
    expect(getByText('Continue with Google')).toBeTruthy();

    // Switch to signup mode
    fireEvent.press(getByText('Sign Up'));
    expect(getByText2('Continue with Google')).toBeTruthy();
  });
});
```

**Validation Steps:**

1. Open app and navigate to login screen
2. Verify Google button appears below email/password form
3. Check "or" divider appears between form and OAuth section
4. Verify button spacing matches design system
5. Test button in login mode (signs in existing user)
6. Test button in signup mode (creates new account)
7. Verify successful OAuth navigates to main app
8. Test error handling displays user-friendly messages

**Expected Outcome:**

- Google button integrated into AuthScreen
- Button positioned correctly below form
- Works in both login and signup modes
- Proper error handling and user feedback

---

## Phase 3: Apple OAuth Implementation (Week 2, Days 1-3)

### Task 3.1: Create Apple OAuth Service with Clerk

**Objective:** Implement Apple OAuth authentication service using Clerk

**Implementation Steps:**

- [ ] Open `src/services/oauthService.ts`
- [ ] Implement `signInWithApple()` function
- [ ] Use Clerk's `signInWithOAuth({ strategy: 'oauth_apple' })`
- [ ] Handle Apple-specific requirements (private relay email - Clerk handles this)
- [ ] Handle Clerk OAuth callback and session creation
- [ ] Retrieve Clerk JWT token using `getToken()` after successful authentication
- [ ] Send Clerk JWT to Supabase for verification
- [ ] Extract user email from Clerk user object
- [ ] Handle authentication errors gracefully
- [ ] Add platform-specific logic (Clerk handles iOS native vs Android web)
- [ ] Add logging for debugging OAuth flow

**Verification Test:**

```typescript
// Test: Apple OAuth service with Clerk
import { oauthService } from '../services/oauthService';
import { useAuth } from '@clerk/clerk-expo';

describe('Apple OAuth Service', () => {
  test('signInWithApple function exists', () => {
    expect(typeof oauthService.signInWithApple).toBe('function');
  });

  test('initiates Apple OAuth flow via Clerk', async () => {
    const mockSignIn = jest.fn().mockResolvedValue({
      status: 'complete',
    });

    await oauthService.signInWithApple();
    expect(mockSignIn).toHaveBeenCalledWith({
      strategy: 'oauth_apple',
    });
  });

  test('retrieves Clerk JWT after authentication', async () => {
    const mockGetToken = jest.fn().mockResolvedValue('clerk.jwt.token');
    const result = await oauthService.signInWithApple();
    expect(mockGetToken).toHaveBeenCalled();
    expect(result.jwt).toBeDefined();
  });

  test('handles Apple private relay email via Clerk', async () => {
    // Clerk handles Apple's email privacy feature
    const mockUser = {
      emailAddresses: [{ emailAddress: 'privaterelay@icloud.com' }],
      id: 'user_clerk123',
    };
    // Verify Clerk user object contains email
    expect(mockUser.emailAddresses[0].emailAddress).toBeDefined();
  });
});
```

**Validation Steps:**

1. Verify `signInWithApple()` function exists in `oauthService.ts`
2. Check function uses Clerk's OAuth methods
3. Test function in development environment
4. Verify Clerk JWT is retrieved after authentication
5. Verify JWT is sent to Supabase for verification
6. Test handling of Apple private relay email (handled by Clerk)
7. Check error handling for failed OAuth attempts
8. Verify platform-specific logic works on both iOS and Android (Clerk handles this)

**Expected Outcome:**

- Apple OAuth service created using Clerk
- OAuth flow initiates correctly via Clerk
- Clerk JWT retrieved and sent to Supabase
- Apple-specific features handled by Clerk
- Error handling implemented

---

### Task 3.2: Add Apple OAuth to AuthContext

**Objective:** Integrate Apple OAuth into existing authentication context

**Implementation Steps:**

- [ ] Open `src/context/AuthContext.tsx`
- [ ] Add `signInWithApple()` method to `AuthContextType` interface
- [ ] Implement `signInWithApple()` in `AuthProvider`
- [ ] Handle OAuth session creation
- [ ] Update user state after successful OAuth
- [ ] Handle OAuth errors and return error messages
- [ ] Ensure OAuth users bypass email confirmation
- [ ] Update `emailConfirmed` state for OAuth users
- [ ] Handle Apple private relay email mapping
- [ ] Add OAuth user to auth state change listener

**Verification Test:**

```typescript
// Test: Apple OAuth in AuthContext
import { renderHook, act } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../context/AuthContext';

describe('AuthContext Apple OAuth', () => {
  test('signInWithApple is available in context', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });
    expect(typeof result.current.signInWithApple).toBe('function');
  });

  test('signInWithApple updates user state on success', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await act(async () => {
      await result.current.signInWithApple();
    });

    expect(result.current.user).toBeDefined();
    expect(result.current.emailConfirmed).toBe(true);
  });

  test('signInWithApple handles private relay email', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    // Test that private relay emails are handled
    await act(async () => {
      const response = await result.current.signInWithApple();
      // Verify email is stored correctly even if it's a private relay
      expect(result.current.user?.email).toBeDefined();
    });
  });
});
```

**Validation Steps:**

1. Check `AuthContext.tsx` exports `signInWithApple` in the context value
2. Verify `signInWithApple` is available when using `useAuth()` hook
3. Test OAuth sign-in in app and verify user state updates
4. Verify `emailConfirmed` is automatically set to `true` for OAuth users
5. Test error handling by simulating failed OAuth
6. Verify Apple private relay email is handled correctly
7. Check that OAuth users don't see email confirmation screen

**Expected Outcome:**

- Apple OAuth integrated into AuthContext
- OAuth users automatically authenticated
- Email confirmation bypassed for OAuth users
- Apple-specific features handled correctly

---

### Task 3.3: Create Apple Sign-In Button Component

**Objective:** Create UI component for Apple OAuth button

**Implementation Steps:**

- [ ] Create `src/components/auth/AppleSignInButton.tsx`
- [ ] Design button matching existing design system
- [ ] Add Apple logo/icon on left side
- [ ] Add "Continue with Apple" text
- [ ] Style button (white background, supports dark mode)
- [ ] Add loading state indicator
- [ ] Add disabled state during authentication
- [ ] Connect button to `signInWithApple()` from AuthContext
- [ ] Handle button press and initiate OAuth flow
- [ ] Add error handling and user feedback
- [ ] Make button accessible (accessibility labels)

**Verification Test:**

```typescript
// Test: Apple Sign-In Button
import { render, fireEvent } from '@testing-library/react-native';
import AppleSignInButton from '../components/auth/AppleSignInButton';
import { AuthProvider } from '../context/AuthContext';

describe('AppleSignInButton', () => {
  test('renders Apple button', () => {
    const { getByText } = render(
      <AuthProvider>
        <AppleSignInButton />
      </AuthProvider>,
    );
    expect(getByText('Continue with Apple')).toBeTruthy();
  });

  test('calls signInWithApple on press', () => {
    const mockSignIn = jest.fn();
    const { getByText } = render(
      <AuthProvider>
        <AppleSignInButton onSignIn={mockSignIn} />
      </AuthProvider>,
    );

    fireEvent.press(getByText('Continue with Apple'));
    expect(mockSignIn).toHaveBeenCalled();
  });

  test('supports dark mode styling', () => {
    const { getByTestId } = render(
      <AuthProvider>
        <AppleSignInButton darkMode={true} />
      </AuthProvider>,
    );
    const button = getByTestId('apple-button');
    expect(button.props.style).toMatchObject({ backgroundColor: '#000' });
  });
});
```

**Validation Steps:**

1. Verify `AppleSignInButton.tsx` component exists
2. Check button renders with "Continue with Apple" text
3. Verify Apple logo/icon appears on left side of button
4. Test button press initiates OAuth flow
5. Verify loading indicator appears during authentication
6. Check button is disabled during OAuth flow
7. Verify button styling matches design system
8. Test dark mode styling (if applicable)
9. Test accessibility (screen reader can identify button)

**Expected Outcome:**

- Apple Sign-In button component created
- Button matches design system
- OAuth flow initiates on button press
- Loading and error states handled
- Dark mode support (if applicable)

---

### Task 3.4: Integrate Apple Button into AuthScreen

**Objective:** Add Apple OAuth button to login/signup screen below Google button

**Implementation Steps:**

- [ ] Open `src/screens/AuthScreen.tsx`
- [ ] Import `AppleSignInButton` component
- [ ] Add Apple button below Google button
- [ ] Maintain consistent spacing between OAuth buttons
- [ ] Connect button to authentication flow
- [ ] Handle OAuth success and navigate to app
- [ ] Handle OAuth errors and show user-friendly messages
- [ ] Ensure button works in both login and signup modes
- [ ] Test button placement and styling
- [ ] Verify button order (Google first, Apple second)

**Verification Test:**

```typescript
// Test: Apple button in AuthScreen
import { render, fireEvent } from '@testing-library/react-native';
import AuthScreen from '../screens/AuthScreen';
import { AuthProvider } from '../context/AuthContext';

describe('AuthScreen Apple Integration', () => {
  test('Apple button appears below Google button', () => {
    const { getByText } = render(
      <AuthProvider>
        <AuthScreen />
      </AuthProvider>,
    );

    const googleButton = getByText('Continue with Google');
    const appleButton = getByText('Continue with Apple');

    expect(googleButton).toBeTruthy();
    expect(appleButton).toBeTruthy();
    // Verify Apple button appears after Google button in component tree
  });

  test('Apple button works in both login and signup modes', () => {
    const { getByText } = render(
      <AuthProvider>
        <AuthScreen />
      </AuthProvider>,
    );

    // Test in login mode
    expect(getByText('Continue with Apple')).toBeTruthy();

    // Switch to signup mode
    fireEvent.press(getByText('Sign Up'));
    expect(getByText('Continue with Apple')).toBeTruthy();
  });

  test('OAuth buttons have consistent spacing', () => {
    const { getByText } = render(
      <AuthProvider>
        <AuthScreen />
      </AuthProvider>,
    );

    const googleButton = getByText('Continue with Google');
    const appleButton = getByText('Continue with Apple');

    // Verify spacing is consistent (visual test)
    expect(googleButton).toBeTruthy();
    expect(appleButton).toBeTruthy();
  });
});
```

**Validation Steps:**

1. Open app and navigate to login screen
2. Verify Apple button appears below Google button
3. Check spacing between OAuth buttons is consistent
4. Verify button order: Google first, then Apple
5. Test button in login mode (signs in existing user)
6. Test button in signup mode (creates new account)
7. Verify successful OAuth navigates to main app
8. Test error handling displays user-friendly messages

**Expected Outcome:**

- Apple button integrated into AuthScreen
- Button positioned correctly below Google button
- Works in both login and signup modes
- Proper error handling and user feedback
- Consistent spacing and styling

---

## Phase 4: Account Linking Implementation (Week 2, Days 4-5)

### Task 4.1: Implement Account Linking Logic with Clerk

**Objective:** Leverage Clerk's automatic account linking when same email is used

**Implementation Steps:**

- [ ] Review Clerk's account linking capabilities (automatic email matching)
- [ ] Clerk automatically handles email matching (case-insensitive)
- [ ] Clerk automatically links OAuth providers to existing accounts
- [ ] After Clerk authentication, sync user data to Supabase using Clerk user ID
- [ ] Handle multiple provider linking (Google + Apple) - Clerk handles this automatically
- [ ] Store Clerk user ID in Supabase `user_profiles` table
- [ ] Handle account linking errors gracefully (Clerk provides error messages)
- [ ] Add logging for account linking attempts
- [ ] Test account linking with email/password accounts (via Clerk)
- [ ] Test account linking with existing OAuth accounts (via Clerk)

**Verification Test:**

```typescript
// Test: Account Linking Logic with Clerk
import { supabase } from '../services/supabase';
import { oauthService } from '../services/oauthService';
import { useUser } from '@clerk/clerk-expo';

describe('Account Linking with Clerk', () => {
  test('Clerk links OAuth to existing email/password account', async () => {
    // Create test user with email/password via Clerk
    const testEmail = 'test@example.com';
    // Clerk handles user creation

    // Sign in with Google using same email via Clerk
    const result = await oauthService.signInWithGoogle();

    // Verify Clerk links accounts automatically
    const clerkUser = useUser();
    expect(clerkUser.user?.emailAddresses[0].emailAddress).toBe(testEmail);

    // Verify Supabase profile uses same Clerk user ID
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('clerk_user_id', clerkUser.user?.id)
      .single();
    expect(profile).toBeDefined();
  });

  test('Clerk handles case-insensitive email matching', async () => {
    const testEmail = 'Test@Example.com';
    // Clerk handles case-insensitive matching automatically

    // Sign in with Google using different case
    await oauthService.signInWithGoogle();

    const clerkUser = useUser();
    expect(clerkUser.user?.emailAddresses[0].emailAddress.toLowerCase()).toBe(
      testEmail.toLowerCase(),
    );
  });

  test('Clerk allows linking multiple OAuth providers', async () => {
    // Sign in with Google via Clerk
    await oauthService.signInWithGoogle();
    const clerkUser1 = useUser();
    const email = clerkUser1.user?.emailAddresses[0].emailAddress;
    const clerkUserId = clerkUser1.user?.id;

    // Sign out
    // Sign in with Apple using same email via Clerk
    await oauthService.signInWithApple();
    const clerkUser2 = useUser();

    // Clerk automatically links providers - same user ID
    expect(clerkUser2.user?.id).toBe(clerkUserId);
    expect(clerkUser2.user?.emailAddresses[0].emailAddress).toBe(email);

    // Verify Supabase uses same Clerk user ID
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('clerk_user_id', clerkUserId)
      .single();
    expect(profile).toBeDefined();
  });
});
```

**Validation Steps:**

1. Create test account with email/password via Clerk
2. Sign in with Google using same email via Clerk
3. Verify Clerk automatically links accounts (check Clerk dashboard)
4. Verify Supabase profile uses Clerk user ID
5. Test with different email cases (Clerk handles this automatically)
6. Sign in with Apple using same email via Clerk
7. Verify both providers are linked to same Clerk account (same Clerk user ID)
8. Verify Supabase uses same Clerk user ID for both providers
9. Test error handling for linking failures (Clerk provides error messages)
10. Verify users can sign in with any linked provider through Clerk

**Expected Outcome:**

- Clerk handles account linking automatically
- Email matching is case-insensitive (handled by Clerk)
- Multiple providers can be linked to same Clerk account
- Supabase uses Clerk user ID for data access
- Error handling works correctly

---

### Task 4.2: Handle Account Linking Errors

**Objective:** Provide user-friendly error messages for account linking failures

**Implementation Steps:**

- [ ] Identify potential account linking error scenarios
- [ ] Create error message mapping for different error types
- [ ] Handle email mismatch errors
- [ ] Handle provider conflict errors
- [ ] Handle database errors during linking
- [ ] Display user-friendly error messages in UI
- [ ] Log errors for debugging and monitoring
- [ ] Provide fallback options (use email/password)
- [ ] Test all error scenarios
- [ ] Update error handling in OAuth service

**Verification Test:**

```typescript
// Test: Account Linking Error Handling
import { oauthService } from '../services/oauthService';
import { supabase } from '../services/supabase';

describe('Account Linking Error Handling', () => {
  test('handles email mismatch errors', async () => {
    // Mock scenario where email doesn't match
    const result = await oauthService.signInWithGoogle();
    if (result.error) {
      expect(result.error).toContain('email');
    }
  });

  test('handles provider conflict errors', async () => {
    // Test scenario where provider linking fails
    const mockError = { message: 'Provider already linked' };
    // Verify error is handled gracefully
    expect(mockError.message).toBeDefined();
  });

  test('provides fallback to email/password', async () => {
    // Test that users can still use email/password if OAuth linking fails
    const result = await oauthService.signInWithGoogle();
    if (result.error) {
      // User should be able to use email/password as fallback
      expect(result.error).toBeDefined();
    }
  });

  test('logs errors for monitoring', async () => {
    const consoleSpy = jest.spyOn(console, 'error');
    await oauthService.signInWithGoogle();
    // Verify errors are logged
    // Note: This depends on implementation
  });
});
```

**Validation Steps:**

1. Test account linking with invalid email
2. Verify error message is user-friendly
3. Test provider conflict scenario
4. Verify error is logged for monitoring
5. Test fallback to email/password works
6. Check error messages are clear and actionable
7. Verify errors don't crash the app
8. Test error handling on both iOS and Android

**Expected Outcome:**

- All error scenarios handled gracefully
- User-friendly error messages displayed
- Errors logged for monitoring
- Fallback options available
- No app crashes on errors

---

## Phase 5: Profile Completion & Polish (Week 3)

### Task 5.1: Create Profile Completion Screen/Modal

**Objective:** Prompt OAuth users to complete profile after first Clerk login

**Implementation Steps:**

- [ ] Create `src/screens/ProfileCompletionScreen.tsx` or modal component
- [ ] Design profile completion form (username, grade level, display name)
- [ ] Pre-fill display name from Clerk user object if available
- [ ] Use Clerk user ID as identifier for Supabase profile
- [ ] Add username validation (availability check in Supabase)
- [ ] Add grade level selector
- [ ] Add form validation
- [ ] Handle form submission
- [ ] Save profile to `user_profiles` table using Clerk user ID
- [ ] Navigate to main app after profile completion
- [ ] Allow users to skip (with reminder to complete later)

**Verification Test:**

```typescript
// Test: Profile Completion Screen
import { render, fireEvent } from '@testing-library/react-native';
import ProfileCompletionScreen from '../screens/ProfileCompletionScreen';
import { AuthProvider } from '../context/AuthContext';

describe('Profile Completion Screen', () => {
  test('renders profile completion form', () => {
    const { getByPlaceholderText, getByText } = render(
      <AuthProvider>
        <ProfileCompletionScreen />
      </AuthProvider>,
    );

    expect(getByPlaceholderText('Choose a username')).toBeTruthy();
    expect(getByText('Select Grade Level')).toBeTruthy();
  });

  test('pre-fills display name from Clerk user', () => {
    const clerkUser = {
      firstName: 'John',
      lastName: 'Doe',
      emailAddresses: [{ emailAddress: 'john@example.com' }],
      id: 'user_clerk123',
    };
    const { getByDisplayValue } = render(
      <AuthProvider>
        <ProfileCompletionScreen clerkUser={clerkUser} />
      </AuthProvider>,
    );

    expect(getByDisplayValue('John Doe')).toBeTruthy();
  });

  test('validates username availability', async () => {
    const { getByPlaceholderText, getByText } = render(
      <AuthProvider>
        <ProfileCompletionScreen />
      </AuthProvider>,
    );

    const usernameInput = getByPlaceholderText('Choose a username');
    fireEvent.changeText(usernameInput, 'testuser');

    // Wait for validation
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check validation result
    // Implementation depends on validation logic
  });

  test('saves profile on submission with Clerk user ID', async () => {
    const clerkUser = { id: 'user_clerk123' };
    const { getByPlaceholderText, getByText } = render(
      <AuthProvider>
        <ProfileCompletionScreen clerkUser={clerkUser} />
      </AuthProvider>,
    );

    fireEvent.changeText(getByPlaceholderText('Choose a username'), 'testuser');
    fireEvent.press(getByText('Complete Profile'));

    // Verify profile is saved with Clerk user ID
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('clerk_user_id', clerkUser.id)
      .single();
    expect(profile).toBeDefined();
    expect(profile.clerk_user_id).toBe(clerkUser.id);
  });
});
```

**Validation Steps:**

1. Sign in with OAuth (new user)
2. Verify profile completion screen appears
3. Check display name is pre-filled from OAuth provider
4. Test username validation (try taken username)
5. Select grade level
6. Submit form and verify profile is saved
7. Verify navigation to main app after completion
8. Test skip functionality (if implemented)
9. Verify profile data in Supabase database

**Expected Outcome:**

- Profile completion screen created
- Form validation works correctly
- Profile data saved to database
- Navigation works after completion
- OAuth data pre-filled where possible

---

### Task 5.2: Integrate Profile Completion into Auth Flow

**Objective:** Show profile completion screen after Clerk OAuth authentication for new users

**Implementation Steps:**

- [ ] Update `AuthContext` to check if Supabase profile exists after Clerk OAuth
- [ ] Use Clerk user ID to query Supabase `user_profiles` table
- [ ] Add logic to detect first-time OAuth users (no Supabase profile)
- [ ] Show profile completion screen if profile doesn't exist in Supabase
- [ ] Skip profile completion for returning users (profile exists)
- [ ] Handle profile completion in Clerk auth state change listener
- [ ] Update navigation to show profile screen when needed
- [ ] Add reminder for incomplete profiles
- [ ] Test flow with new OAuth users
- [ ] Test flow with returning OAuth users

**Verification Test:**

```typescript
// Test: Profile Completion in Auth Flow
import { renderHook, act } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../context/AuthContext';

describe('Profile Completion in Auth Flow', () => {
  test('shows profile completion for new OAuth users', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    // Mock new Clerk OAuth user without Supabase profile
    await act(async () => {
      await result.current.signInWithGoogle();
    });

    // Check if profile completion is needed (no Supabase profile)
    const needsProfileCompletion = !result.current.userProfile;
    expect(needsProfileCompletion).toBe(true);
    // Verify Clerk user ID is available
    expect(result.current.user?.id).toMatch(/^user_/);
  });

  test('skips profile completion for returning users', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    // Mock returning OAuth user with profile
    await act(async () => {
      await result.current.signInWithGoogle();
    });

    // Check if profile exists
    expect(result.current.userProfile).toBeDefined();
  });

  test('navigates to main app after profile completion', async () => {
    // Test navigation flow
    // Implementation depends on navigation setup
  });
});
```

**Validation Steps:**

1. Sign in with OAuth as new user
2. Verify profile completion screen appears automatically
3. Complete profile and verify navigation to main app
4. Sign in with OAuth as returning user
5. Verify profile completion screen does NOT appear
6. Test with incomplete profile (should show reminder)
7. Verify auth flow works correctly in all scenarios

**Expected Outcome:**

- Profile completion integrated into auth flow
- New users see profile screen automatically
- Returning users skip profile completion
- Navigation works correctly
- Reminders for incomplete profiles

---

### Task 5.3: Update App.tsx for Clerk OAuth Deep Linking

**Objective:** Handle Clerk OAuth callbacks via deep linking in main app file

**Implementation Steps:**

- [ ] Open `App.tsx`
- [ ] Review existing deep linking implementation
- [ ] Ensure `ClerkProvider` wraps the app (already partially implemented)
- [ ] Add Clerk OAuth callback URL handling
- [ ] Clerk handles OAuth callback parsing automatically
- [ ] After Clerk authentication, retrieve JWT using `getToken()`
- [ ] Send Clerk JWT to Supabase for verification
- [ ] Handle Supabase session creation using Clerk user ID
- [ ] Update auth state after Clerk OAuth callback
- [ ] Handle OAuth errors in deep link (Clerk provides error handling)
- [ ] Test deep linking on iOS
- [ ] Test deep linking on Android

**Verification Test:**

```typescript
// Test: Clerk OAuth Deep Linking
import { Linking } from 'react-native';
import { handleClerkOAuthCallback } from '../utils/clerkOAuthDeepLink';
import { useAuth } from '@clerk/clerk-expo';

describe('Clerk OAuth Deep Linking', () => {
  test('handles Clerk OAuth callback URL', async () => {
    const callbackUrl =
      'creativebridge://auth/callback?__clerk_redirect_url=...';
    const result = await handleClerkOAuthCallback(callbackUrl);
    expect(result.success).toBe(true);
  });

  test('retrieves Clerk JWT after callback', async () => {
    const clerkAuth = useAuth();
    const jwt = await clerkAuth.getToken();
    expect(jwt).toBeDefined();
    expect(typeof jwt).toBe('string');
  });

  test('sends Clerk JWT to Supabase', async () => {
    const clerkAuth = useAuth();
    const jwt = await clerkAuth.getToken();
    const result = await sendJWTToSupabase(jwt);
    expect(result.success).toBe(true);
    expect(result.session).toBeDefined();
  });

  test('handles OAuth errors in callback', async () => {
    const errorUrl = 'creativebridge://auth/callback?error=access_denied';
    const result = await handleClerkOAuthCallback(errorUrl);
    expect(result.error).toBeDefined();
  });
});
```

**Validation Steps:**

1. Test Clerk OAuth flow and verify deep link is called
2. Check Clerk OAuth callback URL is handled correctly
3. Verify Clerk JWT is retrieved after callback
4. Verify JWT is sent to Supabase for verification
5. Verify Supabase session is created using Clerk user ID
6. Test error handling in deep link (Clerk provides errors)
7. Test on iOS device/simulator
8. Test on Android device/emulator
9. Verify auth state updates after Clerk OAuth callback
10. Check navigation works after OAuth success

**Expected Outcome:**

- Clerk OAuth deep linking works correctly
- Clerk JWT retrieved and sent to Supabase
- Supabase session created with Clerk user ID
- Auth state updates after OAuth
- Error handling works
- Works on both iOS and Android

---

### Task 5.4: Add Error Handling and User Feedback

**Objective:** Improve error handling and user feedback throughout OAuth flow

**Implementation Steps:**

- [ ] Review all OAuth error scenarios
- [ ] Create user-friendly error messages
- [ ] Add error toast/alert components
- [ ] Handle network errors gracefully
- [ ] Handle user cancellation (silent return)
- [ ] Add loading indicators for all async operations
- [ ] Provide retry options for failed OAuth
- [ ] Add success feedback after successful OAuth
- [ ] Test all error scenarios
- [ ] Improve error messages based on user testing

**Verification Test:**

```typescript
// Test: Error Handling and Feedback
import { render, waitFor } from '@testing-library/react-native';
import AuthScreen from '../screens/AuthScreen';
import { AuthProvider } from '../context/AuthContext';

describe('OAuth Error Handling', () => {
  test('shows user-friendly error messages', async () => {
    // Mock OAuth error
    const { getByText } = render(
      <AuthProvider>
        <AuthScreen />
      </AuthProvider>,
    );

    // Trigger OAuth with error
    // Verify error message is displayed
    await waitFor(() => {
      expect(getByText(/authentication failed/i)).toBeTruthy();
    });
  });

  test('handles network errors gracefully', async () => {
    // Mock network error
    // Verify appropriate error message
  });

  test('handles user cancellation silently', async () => {
    // Mock user cancellation
    // Verify no error is shown
  });

  test('shows loading indicator during OAuth', () => {
    const { getByTestId } = render(
      <AuthProvider>
        <AuthScreen />
      </AuthProvider>,
    );

    // Trigger OAuth
    // Verify loading indicator appears
    expect(getByTestId('oauth-loading')).toBeTruthy();
  });
});
```

**Validation Steps:**

1. Test OAuth with network disconnected
2. Verify user-friendly error message appears
3. Test OAuth cancellation (user closes browser)
4. Verify no error shown (silent return)
5. Test OAuth with invalid credentials
6. Verify appropriate error message
7. Check loading indicators appear during OAuth
8. Test retry functionality
9. Verify success feedback after successful OAuth

**Expected Outcome:**

- All error scenarios handled gracefully
- User-friendly error messages
- Loading indicators for async operations
- Success feedback after OAuth
- Retry options available

---

### Task 5.5: Testing and Quality Assurance

**Objective:** Comprehensive testing of OAuth feature on both platforms

**Implementation Steps:**

- [ ] Create unit tests for OAuth services
- [ ] Create integration tests for OAuth flow
- [ ] Test Google OAuth on iOS device
- [ ] Test Google OAuth on Android device
- [ ] Test Apple OAuth on iOS device
- [ ] Test Apple OAuth on Android device (if supported)
- [ ] Test account linking scenarios
- [ ] Test profile completion flow
- [ ] Test error handling scenarios
- [ ] Test deep linking on both platforms
- [ ] Perform accessibility testing
- [ ] Perform performance testing
- [ ] Fix any bugs found during testing

**Verification Test:**

```typescript
// Test: Comprehensive OAuth Testing
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AuthScreen from '../screens/AuthScreen';
import { AuthProvider } from '../context/AuthContext';

describe('OAuth Comprehensive Tests', () => {
  test('complete OAuth flow works end-to-end', async () => {
    const { getByText } = render(
      <AuthProvider>
        <AuthScreen />
      </AuthProvider>,
    );

    // Start OAuth flow
    fireEvent.press(getByText('Continue with Google'));

    // Wait for OAuth completion
    await waitFor(() => {
      // Verify user is authenticated
      // Implementation depends on test setup
    });
  });

  test('OAuth works in both login and signup modes', async () => {
    // Test both modes
  });

  test('account linking works correctly', async () => {
    // Test account linking
  });

  test('profile completion appears for new users', async () => {
    // Test profile completion
  });
});
```

**Validation Steps:**

1. Run all unit tests: `npm test`
2. Run integration tests
3. Test Google OAuth on physical iOS device
4. Test Google OAuth on physical Android device
5. Test Apple OAuth on physical iOS device
6. Test account linking with real accounts
7. Test profile completion with real OAuth users
8. Test error scenarios on real devices
9. Test deep linking on real devices
10. Perform accessibility audit
11. Check performance (OAuth should complete in <5 seconds)
12. Fix any bugs and retest

**Expected Outcome:**

- All tests passing
- OAuth works on both iOS and Android
- Account linking works correctly
- Profile completion works correctly
- Error handling works correctly
- No critical bugs
- Good performance
- Accessible implementation

---

### Task 5.6: Documentation and Final Polish

**Objective:** Document OAuth implementation and perform final polish

**Implementation Steps:**

- [ ] Document OAuth setup instructions
- [ ] Document Supabase OAuth configuration
- [ ] Document Google OAuth setup in Google Cloud Console
- [ ] Document Apple OAuth setup in Apple Developer
- [ ] Update README with OAuth information
- [ ] Add code comments for complex OAuth logic
- [ ] Review and improve error messages
- [ ] Review UI/UX and make final adjustments
- [ ] Ensure consistent styling across OAuth components
- [ ] Verify all acceptance criteria are met
- [ ] Create deployment checklist
- [ ] Prepare release notes

**Verification Test:**

```typescript
// Test: Documentation and Code Quality
describe('Documentation and Code Quality', () => {
  test('OAuth service has proper documentation', () => {
    // Check for JSDoc comments
    const oauthService = require('../services/oauthService');
    // Verify functions have documentation
  });

  test('Error messages are user-friendly', () => {
    // Review error messages
    const errorMessages = [
      'Authentication failed. Please try again.',
      'Connection error. Please try again.',
    ];
    errorMessages.forEach(msg => {
      expect(msg.length).toBeGreaterThan(0);
      expect(msg).not.toContain('ERROR_CODE');
    });
  });

  test('All acceptance criteria are met', () => {
    // Review PRD acceptance criteria
    const acceptanceCriteria = [
      'Google Sign-In button appears below email/password form',
      'Apple Sign-In button appears below Google button',
      'Both buttons work on iOS and Android',
      // ... etc
    ];
    // Verify each criterion is met
  });
});
```

**Validation Steps:**

1. Review all documentation for completeness
2. Verify setup instructions are clear and accurate
3. Check code comments explain complex logic
4. Review error messages for clarity
5. Test UI/UX on both platforms
6. Verify styling is consistent
7. Check all PRD acceptance criteria
8. Review deployment checklist
9. Prepare release notes with OAuth feature description

**Expected Outcome:**

- Complete documentation
- Clear setup instructions
- Well-commented code
- User-friendly error messages
- Consistent UI/UX
- All acceptance criteria met
- Ready for deployment

---

## Summary

This task list covers the complete implementation of Google and Apple OAuth sign-in feature for CreativeBridge using Clerk + Supabase integration. The implementation is divided into 5 phases:

1. **Setup & Configuration**: Clerk setup, Supabase JWT verification, dependencies, deep linking
2. **Google OAuth**: Clerk OAuth service, AuthContext integration, UI components, JWT exchange with Supabase
3. **Apple OAuth**: Clerk OAuth service, AuthContext integration, UI components, JWT exchange with Supabase
4. **Account Linking**: Leverage Clerk's automatic account linking, sync to Supabase using Clerk user ID
5. **Profile Completion & Polish**: Profile completion flow using Clerk user ID, testing, documentation

Each task includes:

- Clear objective
- Step-by-step implementation checklist
- Verification test code
- Validation steps for manual testing
- Expected outcomes

**Architecture Highlights**:

- **Clerk** handles OAuth authentication and issues JWTs
- **Supabase** verifies JWTs against Clerk's JWKS endpoint
- **Supabase RLS** uses Clerk user ID for data access control
- Leverages Clerk's advanced auth features with Supabase's data layer

**Total Estimated Time**: 3-4 weeks

**Key Deliverables**:

- Google and Apple OAuth authentication via Clerk
- Clerk JWT verification with Supabase
- Automatic account linking (handled by Clerk)
- Profile completion for new OAuth users using Clerk user ID
- Supabase RLS policies using Clerk user ID
- Comprehensive error handling
- Full documentation

**Next Steps After Completion**:

1. Deploy to staging environment
2. Perform user acceptance testing
3. Monitor OAuth success rates
4. Monitor JWT verification success rates
5. Gather user feedback
6. Deploy to production
