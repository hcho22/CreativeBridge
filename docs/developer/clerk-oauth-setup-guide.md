# Clerk OAuth Setup Guide

This guide walks you through setting up Clerk for Google and Apple OAuth authentication in CreativeBridge.

## Overview

Clerk handles OAuth authentication and issues JWTs. Supabase verifies JWTs against Clerk's JWKS endpoint and uses Clerk user ID for RLS policies.

**Architecture:**

- **Clerk** → Handles OAuth authentication, issues JWTs
- **Supabase** → Verifies JWTs, uses Clerk user ID for data access
- **Deep Linking** → `creativebridge://auth/callback` for OAuth callbacks

---

## Step 1: Create Clerk Account and Application

1. Go to [https://clerk.com](https://clerk.com) and sign up for an account
2. Create a new application in the Clerk dashboard
3. Choose your application name (e.g., "CreativeBridge")
4. Select your preferred authentication methods (Email/Password, Google, Apple)

---

## Step 2: Obtain Clerk Keys

1. In the Clerk dashboard, navigate to **API Keys**
2. Copy the **Publishable Key** (starts with `pk_`)
3. Copy the **Secret Key** (starts with `sk_`) - keep this secure!
4. Navigate to **JWT Templates** or **Settings** → **JWT**
5. Find your **JWKS endpoint URL** (format: `https://your-instance.clerk.accounts.dev/.well-known/jwks.json`)

**Important:** The JWKS URL format is typically:

```
https://[your-clerk-instance].clerk.accounts.dev/.well-known/jwks.json
```

You can also find it in your Clerk dashboard under **Settings** → **JWT** → **JWKS Endpoint**.

---

## Step 3: Configure Google OAuth Provider

### 3.1: Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Configure OAuth consent screen (if not already done):
   - User Type: External (for public apps) or Internal (for Google Workspace)
   - App name: CreativeBridge
   - User support email: Your email
   - Developer contact: Your email
6. Create OAuth client ID:
   - Application type: **Web application**
   - Name: CreativeBridge OAuth
   - Authorized redirect URIs:
     - `https://[your-clerk-instance].clerk.accounts.dev/v1/oauth_callback`
     - Add this exact URL from your Clerk dashboard (found in OAuth settings)
7. Copy the **Client ID** and **Client Secret**

### 3.2: Add Google OAuth to Clerk

1. In Clerk dashboard, navigate to **User & Authentication** → **Social Connections**
2. Click **Google** to enable it
3. Enter your Google **Client ID** and **Client Secret**
4. Configure OAuth scopes:
   - ✅ Email
   - ✅ Profile
5. Save the configuration

---

## Step 4: Configure Apple Sign In Provider

### 4.1: Create Apple OAuth Credentials

1. Go to [Apple Developer Portal](https://developer.apple.com/)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Create a **Service ID** (if you don't have one):
   - Click **Identifiers** → **+** → **Services IDs**
   - Description: CreativeBridge OAuth
   - Identifier: `com.creativebridge.oauth` (or your bundle ID)
   - Enable **Sign in with Apple**
   - Configure domains and redirect URLs:
     - Domains: `[your-clerk-instance].clerk.accounts.dev`
     - Return URLs: `https://[your-clerk-instance].clerk.accounts.dev/v1/oauth_callback`
4. Create a **Key** for Sign in with Apple:
   - Click **Keys** → **+**
   - Key Name: CreativeBridge Sign In with Apple
   - Enable **Sign in with Apple**
   - Download the key file (`.p8` file) - **you can only download this once!**
   - Note the **Key ID**
5. Note your **Team ID** (found in top right of Apple Developer portal)

### 4.2: Add Apple OAuth to Clerk

1. In Clerk dashboard, navigate to **User & Authentication** → **Social Connections**
2. Click **Apple** to enable it
3. Enter the following:
   - **Service ID**: The identifier you created (e.g., `com.creativebridge.oauth`)
   - **Team ID**: Your Apple Developer Team ID
   - **Key ID**: The Key ID from the key you created
   - **Private Key**: The contents of the `.p8` file you downloaded
4. Save the configuration

---

## Step 5: Configure Redirect URLs

### 5.1: Deep Link Scheme

The app uses the deep link scheme: `creativebridge://auth/callback`

This is already configured in:

- `app.json`: `"scheme": "creativebridge"`
- iOS `Info.plist`: URL scheme configuration
- Android `AndroidManifest.xml`: Intent filters

### 5.2: Configure in Clerk Dashboard

1. In Clerk dashboard, navigate to **Settings** → **Paths**
2. Add redirect URLs:
   - **iOS**: `creativebridge://auth/callback`
   - **Android**: `creativebridge://auth/callback`
3. Save the configuration

---

## Step 6: Configure OAuth Scopes

1. In Clerk dashboard, navigate to **User & Authentication** → **Social Connections**
2. For each provider (Google, Apple), ensure these scopes are enabled:
   - ✅ **Email** - Required for user identification
   - ✅ **Profile** - Required for user profile data
3. Save the configuration

---

## Step 7: Set Environment Variables

Add the following environment variables to your `.env` file (or your environment configuration):

```bash
# Clerk Configuration
CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxx
CLERK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxx
CLERK_JWKS_URL=https://your-instance.clerk.accounts.dev/.well-known/jwks.json
```

**Important Security Notes:**

- Never commit `.env` files to version control
- Use different keys for development and production
- The `CLERK_SECRET_KEY` should only be used server-side (if needed)
- For React Native, only the `CLERK_PUBLISHABLE_KEY` is needed in the app

---

## Step 8: Verify Configuration

### 8.1: Check Clerk Configuration in Code

The app includes helper functions to verify Clerk configuration:

```typescript
import { isClerkConfigured, getClerkConfig } from '../config/environment';

// Check if Clerk is configured
if (isClerkConfigured()) {
  const config = getClerkConfig();
  console.log('Clerk Publishable Key:', config.publishableKey);
  console.log('Clerk JWKS URL:', config.jwksUrl);
}
```

### 8.2: Test Redirect URLs

**iOS Simulator:**

```bash
xcrun simctl openurl booted "creativebridge://auth/callback?test=1"
```

**Android Emulator:**

```bash
adb shell am start -W -a android.intent.action.VIEW -d "creativebridge://auth/callback?test=1"
```

### 8.3: Verify OAuth Providers

1. In Clerk dashboard, navigate to **User & Authentication** → **Social Connections**
2. Verify both Google and Apple show green checkmarks (✅)
3. Test OAuth flow in the app (after implementing OAuth UI)

---

## Step 9: Document Configuration Settings

Create a secure document (not in version control) with:

- Clerk Publishable Key
- Clerk Secret Key (if needed server-side)
- Clerk JWKS URL
- Google OAuth Client ID
- Google OAuth Client Secret
- Apple Service ID
- Apple Team ID
- Apple Key ID
- Apple Private Key location (secure storage)

**Security Best Practices:**

- Store secrets in a password manager
- Use environment-specific keys (dev/staging/production)
- Rotate keys periodically
- Never share keys in chat or email

---

## Troubleshooting

### Issue: "Clerk is not configured" error

**Solution:**

1. Verify environment variables are set correctly
2. Check that `CLERK_PUBLISHABLE_KEY` starts with `pk_`
3. Verify `CLERK_JWKS_URL` includes `clerk` and `.well-known/jwks.json`
4. Restart the app after setting environment variables

### Issue: OAuth redirect not working

**Solution:**

1. Verify redirect URLs are configured in Clerk dashboard
2. Check that `app.json` has the correct scheme
3. Verify iOS `Info.plist` and Android `AndroidManifest.xml` are configured
4. Test deep linking manually (see Step 8.2)

### Issue: Google OAuth fails

**Solution:**

1. Verify Google OAuth credentials are correct in Clerk
2. Check that redirect URI in Google Cloud Console matches Clerk's callback URL
3. Ensure OAuth consent screen is configured
4. Verify scopes (email, profile) are enabled

### Issue: Apple Sign In fails

**Solution:**

1. Verify Apple Service ID is configured correctly
2. Check that domains and return URLs match Clerk's callback URL
3. Ensure the `.p8` key file is valid and not expired
4. Verify Team ID and Key ID are correct
5. Check that Sign in with Apple is enabled for your Service ID

---

## Next Steps

After completing this setup:

1. ✅ Task 1.1: Clerk Setup and Configuration (this guide)
2. ⏭️ Task 1.2: Install Required Dependencies
3. ⏭️ Task 1.3: Configure Supabase JWT Verification
4. ⏭️ Task 1.4: Configure Deep Linking for Clerk OAuth Callbacks

See `TASKS-oauth-google-apple-signin-PRD.md` for the complete implementation plan.

---

## References

- [Clerk Documentation](https://clerk.com/docs)
- [Clerk React Native Setup](https://clerk.com/docs/quickstarts/expo)
- [Google OAuth Setup](https://developers.google.com/identity/protocols/oauth2)
- [Apple Sign In Setup](https://developer.apple.com/sign-in-with-apple/)
- [Clerk OAuth Providers](https://clerk.com/docs/authentication/social-connections)
