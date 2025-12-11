# Google and Apple OAuth Sign-In Feature - Implementation Tasks

## Overview

**Based on:** oauth-google-apple-signin-PRD.md  
**Implementation Timeline:** 3-4 weeks  
**Phases:** 5 phases (Setup & Configuration → Google OAuth → Apple OAuth → Account Linking → Profile Completion & Polish)

---

## Phase 1: Setup & Configuration (Week 1, Days 1-2)

### Task 1.1: Supabase OAuth Configuration Setup

**Objective:** Configure Google and Apple OAuth providers in Supabase dashboard

**Implementation Steps:**

- [ ] Access Supabase project dashboard
- [ ] Navigate to Authentication → Providers section
- [ ] Enable Google OAuth provider
- [ ] Configure Google OAuth credentials (Client ID, Client Secret)
- [ ] Set up redirect URLs for iOS (`creativebridge://auth/callback`)
- [ ] Set up redirect URLs for Android (`creativebridge://auth/callback`)
- [ ] Enable Apple OAuth provider
- [ ] Configure Apple OAuth credentials (Service ID, Team ID, Key ID, Private Key)
- [ ] Configure OAuth scopes (email, profile)
- [ ] Test redirect URLs are properly configured
- [ ] Document all OAuth configuration settings

**Verification Test:**

```typescript
// Test: Verify Supabase OAuth configuration
import { supabase } from '../services/supabase';

describe('Supabase OAuth Configuration', () => {
  test('Google OAuth provider is enabled', async () => {
    // This test verifies the provider is configured
    // Note: Actual OAuth flow requires user interaction
    const providers = await supabase.auth.getSession();
    // Check if Google provider is available
    expect(supabase.auth).toBeDefined();
  });

  test('Apple OAuth provider is enabled', async () => {
    // Verify Apple provider configuration
    expect(supabase.auth).toBeDefined();
  });
});
```

**Validation Steps:**

1. Log into Supabase dashboard and navigate to Authentication → Providers
2. Verify Google provider shows as "Enabled" with green checkmark
3. Verify Apple provider shows as "Enabled" with green checkmark
4. Check that redirect URLs are correctly configured for both platforms
5. Verify OAuth scopes include "email" and "profile"
6. Document all configuration values in a secure location
7. Test that configuration persists after dashboard refresh

**Expected Outcome:**

- Google OAuth provider fully configured in Supabase
- Apple OAuth provider fully configured in Supabase
- Redirect URLs properly set for iOS and Android
- All credentials securely stored in Supabase dashboard

---

### Task 1.2: Install Required Dependencies

**Objective:** Install and configure React Native packages needed for OAuth implementation

**Implementation Steps:**

- [ ] Review current `package.json` dependencies
- [ ] Install `expo-web-browser` for OAuth web flows: `npm install expo-web-browser`
- [ ] Install `expo-linking` if not already installed: `npm install expo-linking`
- [ ] For Apple Sign In on iOS, verify `expo-apple-authentication` is available or use web flow
- [ ] Update `package.json` with new dependencies
- [ ] Run `npm install` to install all dependencies
- [ ] Verify no dependency conflicts or version issues
- [ ] Update TypeScript types if needed
- [ ] Document all new dependencies and their purposes

**Verification Test:**

```typescript
// Test: Verify dependencies are installed
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

describe('OAuth Dependencies', () => {
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
    expect(packageJson.dependencies['expo-web-browser']).toBeDefined();
    expect(packageJson.dependencies['expo-linking']).toBeDefined();
  });
});
```

**Validation Steps:**

1. Check `package.json` and verify `expo-web-browser` is listed in dependencies
2. Check `package.json` and verify `expo-linking` is listed in dependencies
3. Run `npm list expo-web-browser` to verify installation
4. Run `npm list expo-linking` to verify installation
5. Check `node_modules` folder to ensure packages are installed
6. Run `npm test` to ensure no breaking changes
7. Verify TypeScript compilation succeeds: `npx tsc --noEmit`

**Expected Outcome:**

- All required OAuth dependencies installed
- No dependency conflicts
- TypeScript types available for all new packages
- Project builds successfully with new dependencies

---

### Task 1.3: Configure Deep Linking for OAuth Callbacks

**Objective:** Set up deep linking to handle OAuth redirects from providers

**Implementation Steps:**

- [ ] Review existing deep linking configuration in `App.tsx`
- [ ] Add OAuth callback URL scheme: `creativebridge://auth/callback`
- [ ] Update iOS `Info.plist` with URL scheme configuration
- [ ] Update Android `AndroidManifest.xml` with intent filters
- [ ] Configure `app.json` or `app.config.js` with deep link scheme
- [ ] Test deep link handling in `App.tsx` for OAuth callbacks
- [ ] Add URL parsing logic for OAuth tokens
- [ ] Handle OAuth callback parameters (access_token, refresh_token, etc.)
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

  test('OAuth callback URL is parseable', () => {
    const testUrl =
      'creativebridge://auth/callback?access_token=test&refresh_token=test';
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
4. Test deep link manually: `xcrun simctl openurl booted "creativebridge://auth/callback?test=1"`
5. Test on Android: `adb shell am start -W -a android.intent.action.VIEW -d "creativebridge://auth/callback?test=1"`
6. Verify `App.tsx` handles deep link events correctly
7. Check that OAuth callback parameters are parsed correctly

**Expected Outcome:**

- Deep linking configured for both iOS and Android
- OAuth callback URLs properly handled
- App can receive and parse OAuth redirects
- Deep linking tested and working on both platforms

---

## Phase 2: Google OAuth Implementation (Week 1, Days 3-5)

### Task 2.1: Create Google OAuth Service

**Objective:** Implement Google OAuth authentication service using Supabase

**Implementation Steps:**

- [ ] Create new file `src/services/oauthService.ts`
- [ ] Import Supabase client and required dependencies
- [ ] Implement `signInWithGoogle()` function
- [ ] Use `supabase.auth.signInWithOAuth({ provider: 'google' })`
- [ ] Configure OAuth options (redirectTo, scopes)
- [ ] Handle OAuth callback and session creation
- [ ] Extract user email from Google account
- [ ] Handle authentication errors gracefully
- [ ] Add TypeScript types for OAuth responses
- [ ] Add logging for debugging OAuth flow

**Verification Test:**

```typescript
// Test: Google OAuth service
import { oauthService } from '../services/oauthService';
import { supabase } from '../services/supabase';

describe('Google OAuth Service', () => {
  test('signInWithGoogle function exists', () => {
    expect(typeof oauthService.signInWithGoogle).toBe('function');
  });

  test('initiates Google OAuth flow', async () => {
    // Mock Supabase OAuth call
    const mockSignIn = jest.spyOn(supabase.auth, 'signInWithOAuth');
    mockSignIn.mockResolvedValue({
      data: { url: 'https://google.com/oauth' },
      error: null,
    });

    await oauthService.signInWithGoogle();
    expect(mockSignIn).toHaveBeenCalledWith({
      provider: 'google',
      options: expect.objectContaining({
        redirectTo: expect.stringContaining('creativebridge://'),
      }),
    });
  });

  test('handles OAuth errors', async () => {
    const mockSignIn = jest.spyOn(supabase.auth, 'signInWithOAuth');
    mockSignIn.mockResolvedValue({
      data: null,
      error: { message: 'OAuth failed' },
    });

    const result = await oauthService.signInWithGoogle();
    expect(result.error).toBeDefined();
  });
});
```

**Validation Steps:**

1. Verify `src/services/oauthService.ts` file exists
2. Check that `signInWithGoogle()` function is exported
3. Verify function calls `supabase.auth.signInWithOAuth()` with correct parameters
4. Test function in development environment
5. Verify redirect URL is correctly formatted
6. Check error handling for failed OAuth attempts
7. Verify TypeScript types are correct (no compilation errors)

**Expected Outcome:**

- Google OAuth service created and functional
- OAuth flow initiates correctly
- Error handling implemented
- TypeScript types defined

---

### Task 2.2: Add Google OAuth to AuthContext

**Objective:** Integrate Google OAuth into existing authentication context

**Implementation Steps:**

- [ ] Open `src/context/AuthContext.tsx`
- [ ] Import OAuth service
- [ ] Add `signInWithGoogle()` method to `AuthContextType` interface
- [ ] Implement `signInWithGoogle()` in `AuthProvider`
- [ ] Handle OAuth session creation
- [ ] Update user state after successful OAuth
- [ ] Handle OAuth errors and return error messages
- [ ] Ensure OAuth users bypass email confirmation
- [ ] Update `emailConfirmed` state for OAuth users
- [ ] Add OAuth user to auth state change listener

**Verification Test:**

```typescript
// Test: Google OAuth in AuthContext
import { renderHook, act } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../context/AuthContext';

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

    // Mock successful OAuth
    await act(async () => {
      await result.current.signInWithGoogle();
    });

    expect(result.current.user).toBeDefined();
    expect(result.current.emailConfirmed).toBe(true);
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
3. Test OAuth sign-in in app and verify user state updates
4. Verify `emailConfirmed` is automatically set to `true` for OAuth users
5. Test error handling by simulating failed OAuth
6. Verify auth state change listener handles OAuth sessions
7. Check that OAuth users don't see email confirmation screen

**Expected Outcome:**

- Google OAuth integrated into AuthContext
- OAuth users automatically authenticated
- Email confirmation bypassed for OAuth users
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

### Task 3.1: Create Apple OAuth Service

**Objective:** Implement Apple OAuth authentication service using Supabase

**Implementation Steps:**

- [ ] Open `src/services/oauthService.ts`
- [ ] Implement `signInWithApple()` function
- [ ] Use `supabase.auth.signInWithOAuth({ provider: 'apple' })`
- [ ] Configure OAuth options (redirectTo, scopes)
- [ ] Handle Apple-specific requirements (private relay email)
- [ ] Handle OAuth callback and session creation
- [ ] Extract user email from Apple account
- [ ] Handle authentication errors gracefully
- [ ] Add platform-specific logic (iOS native vs Android web)
- [ ] Add logging for debugging OAuth flow

**Verification Test:**

```typescript
// Test: Apple OAuth service
import { oauthService } from '../services/oauthService';
import { supabase } from '../services/supabase';
import { Platform } from 'react-native';

describe('Apple OAuth Service', () => {
  test('signInWithApple function exists', () => {
    expect(typeof oauthService.signInWithApple).toBe('function');
  });

  test('initiates Apple OAuth flow', async () => {
    const mockSignIn = jest.spyOn(supabase.auth, 'signInWithOAuth');
    mockSignIn.mockResolvedValue({
      data: { url: 'https://apple.com/oauth' },
      error: null,
    });

    await oauthService.signInWithApple();
    expect(mockSignIn).toHaveBeenCalledWith({
      provider: 'apple',
      options: expect.objectContaining({
        redirectTo: expect.stringContaining('creativebridge://'),
      }),
    });
  });

  test('handles Apple private relay email', async () => {
    // Test handling of Apple's email privacy feature
    const mockUser = {
      email: 'privaterelay@icloud.com',
      app_metadata: { provider: 'apple' },
    };
    // Verify private relay email is handled correctly
    expect(mockUser.app_metadata.provider).toBe('apple');
  });
});
```

**Validation Steps:**

1. Verify `signInWithApple()` function exists in `oauthService.ts`
2. Check function calls `supabase.auth.signInWithOAuth()` with 'apple' provider
3. Test function in development environment
4. Verify redirect URL is correctly formatted
5. Test handling of Apple private relay email
6. Check error handling for failed OAuth attempts
7. Verify platform-specific logic works on both iOS and Android

**Expected Outcome:**

- Apple OAuth service created and functional
- OAuth flow initiates correctly
- Apple-specific features handled
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

### Task 4.1: Implement Account Linking Logic

**Objective:** Automatically link OAuth providers to existing accounts when same email is used

**Implementation Steps:**

- [ ] Review Supabase account linking capabilities
- [ ] Implement email matching logic (case-insensitive)
- [ ] Check if email exists in Supabase before creating account
- [ ] Link OAuth provider to existing account if email matches
- [ ] Handle multiple provider linking (Google + Apple)
- [ ] Store provider information in Supabase auth metadata
- [ ] Handle account linking errors gracefully
- [ ] Add logging for account linking attempts
- [ ] Test account linking with email/password accounts
- [ ] Test account linking with existing OAuth accounts

**Verification Test:**

```typescript
// Test: Account Linking Logic
import { supabase } from '../services/supabase';
import { oauthService } from '../services/oauthService';

describe('Account Linking', () => {
  test('links OAuth to existing email/password account', async () => {
    // Create test user with email/password
    const testEmail = 'test@example.com';
    await supabase.auth.signUp({
      email: testEmail,
      password: 'testpassword123',
    });

    // Sign in with Google using same email
    const result = await oauthService.signInWithGoogle();

    // Verify account is linked
    const {
      data: { user },
    } = await supabase.auth.getUser();
    expect(user?.email).toBe(testEmail);

    // Check providers are linked
    const providers = user?.app_metadata?.providers || [];
    expect(providers).toContain('google');
  });

  test('handles case-insensitive email matching', async () => {
    const testEmail = 'Test@Example.com';
    await supabase.auth.signUp({
      email: testEmail.toLowerCase(),
      password: 'testpassword123',
    });

    // Sign in with Google using different case
    await oauthService.signInWithGoogle();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    expect(user?.email?.toLowerCase()).toBe(testEmail.toLowerCase());
  });

  test('allows linking multiple OAuth providers', async () => {
    // Sign in with Google
    await oauthService.signInWithGoogle();
    const {
      data: { user: user1 },
    } = await supabase.auth.getUser();
    const email = user1?.email;

    // Sign out
    await supabase.auth.signOut();

    // Sign in with Apple using same email
    await oauthService.signInWithApple();
    const {
      data: { user: user2 },
    } = await supabase.auth.getUser();

    expect(user2?.email).toBe(email);
    const providers = user2?.app_metadata?.providers || [];
    expect(providers).toContain('google');
    expect(providers).toContain('apple');
  });
});
```

**Validation Steps:**

1. Create test account with email/password
2. Sign in with Google using same email
3. Verify account is automatically linked (check Supabase dashboard)
4. Test with different email cases (uppercase/lowercase)
5. Sign in with Apple using same email
6. Verify both providers are linked to same account
7. Test error handling for linking failures
8. Check Supabase auth metadata contains provider information
9. Verify users can sign in with any linked provider

**Expected Outcome:**

- Account linking works automatically
- Email matching is case-insensitive
- Multiple providers can be linked to same account
- Provider information stored in Supabase metadata
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

**Objective:** Prompt OAuth users to complete profile after first login

**Implementation Steps:**

- [ ] Create `src/screens/ProfileCompletionScreen.tsx` or modal component
- [ ] Design profile completion form (username, grade level, display name)
- [ ] Pre-fill display name from OAuth provider if available
- [ ] Add username validation (availability check)
- [ ] Add grade level selector
- [ ] Add form validation
- [ ] Handle form submission
- [ ] Save profile to `user_profiles` table
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

  test('pre-fills display name from OAuth', () => {
    const oauthUser = { name: 'John Doe', email: 'john@example.com' };
    const { getByDisplayValue } = render(
      <AuthProvider>
        <ProfileCompletionScreen user={oauthUser} />
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

  test('saves profile on submission', async () => {
    const { getByPlaceholderText, getByText } = render(
      <AuthProvider>
        <ProfileCompletionScreen />
      </AuthProvider>,
    );

    fireEvent.changeText(getByPlaceholderText('Choose a username'), 'testuser');
    fireEvent.press(getByText('Complete Profile'));

    // Verify profile is saved
    // Check Supabase database
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

**Objective:** Show profile completion screen after OAuth authentication for new users

**Implementation Steps:**

- [ ] Update `AuthContext` to check if profile exists after OAuth
- [ ] Add logic to detect first-time OAuth users
- [ ] Show profile completion screen if profile doesn't exist
- [ ] Skip profile completion for returning users
- [ ] Handle profile completion in auth state change listener
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

    // Mock new OAuth user without profile
    await act(async () => {
      await result.current.signInWithGoogle();
    });

    // Check if profile completion is needed
    const needsProfileCompletion = !result.current.userProfile;
    expect(needsProfileCompletion).toBe(true);
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

### Task 5.3: Update App.tsx for OAuth Deep Linking

**Objective:** Handle OAuth callbacks via deep linking in main app file

**Implementation Steps:**

- [ ] Open `App.tsx`
- [ ] Review existing deep linking implementation
- [ ] Add OAuth callback URL handling
- [ ] Parse OAuth tokens from callback URLs
- [ ] Exchange tokens with Supabase
- [ ] Handle OAuth session creation
- [ ] Update auth state after OAuth callback
- [ ] Handle OAuth errors in deep link
- [ ] Test deep linking on iOS
- [ ] Test deep linking on Android

**Verification Test:**

```typescript
// Test: OAuth Deep Linking
import { Linking } from 'react-native';
import { handleOAuthCallback } from '../utils/oauthDeepLink';

describe('OAuth Deep Linking', () => {
  test('handles OAuth callback URL', async () => {
    const callbackUrl =
      'creativebridge://auth/callback?access_token=test&refresh_token=test';
    const result = await handleOAuthCallback(callbackUrl);
    expect(result.success).toBe(true);
  });

  test('parses OAuth tokens from URL', () => {
    const url =
      'creativebridge://auth/callback?access_token=abc123&refresh_token=xyz789';
    const tokens = parseOAuthTokens(url);
    expect(tokens.access_token).toBe('abc123');
    expect(tokens.refresh_token).toBe('xyz789');
  });

  test('handles OAuth errors in callback', async () => {
    const errorUrl = 'creativebridge://auth/callback?error=access_denied';
    const result = await handleOAuthCallback(errorUrl);
    expect(result.error).toBeDefined();
  });
});
```

**Validation Steps:**

1. Test OAuth flow and verify deep link is called
2. Check OAuth callback URL is parsed correctly
3. Verify tokens are exchanged with Supabase
4. Test error handling in deep link
5. Test on iOS device/simulator
6. Test on Android device/emulator
7. Verify auth state updates after OAuth callback
8. Check navigation works after OAuth success

**Expected Outcome:**

- OAuth deep linking works correctly
- Tokens parsed and exchanged successfully
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

This task list covers the complete implementation of Google and Apple OAuth sign-in feature for CreativeBridge. The implementation is divided into 5 phases:

1. **Setup & Configuration**: Supabase OAuth setup, dependencies, deep linking
2. **Google OAuth**: Service, AuthContext integration, UI components
3. **Apple OAuth**: Service, AuthContext integration, UI components
4. **Account Linking**: Automatic account linking logic and error handling
5. **Profile Completion & Polish**: Profile completion flow, testing, documentation

Each task includes:

- Clear objective
- Step-by-step implementation checklist
- Verification test code
- Validation steps for manual testing
- Expected outcomes

**Total Estimated Time**: 3-4 weeks

**Key Deliverables**:

- Google and Apple OAuth authentication
- Automatic account linking
- Profile completion for new OAuth users
- Comprehensive error handling
- Full documentation

**Next Steps After Completion**:

1. Deploy to staging environment
2. Perform user acceptance testing
3. Monitor OAuth success rates
4. Gather user feedback
5. Deploy to production
