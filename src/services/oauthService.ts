/**
 * OAuth Service with Clerk Integration
 *
 * This service handles OAuth authentication using Clerk:
 * 1. Initiates OAuth flow via Clerk
 * 2. Retrieves Clerk JWT token after authentication
 * 3. Sends Clerk JWT to Supabase for verification
 * 4. Extracts user information from Clerk user object
 *
 * Architecture: Clerk handles OAuth authentication and issues JWTs.
 * This service coordinates between Clerk and Supabase.
 */

import { createSupabaseSessionFromClerkJWT } from './clerkSupabaseSync';
import { isClerkConfigured } from '../config/environment';

/**
 * OAuth response types
 */
export interface OAuthResult {
  success: boolean;
  jwt?: string;
  supabaseSession?: any;
  userEmail?: string;
  clerkUserId?: string;
  error?: string;
}

/**
 * Clerk auth methods interface
 * These methods come from Clerk's useAuth() hook
 */
export interface ClerkAuthMethods {
  signInWithOAuth: (params: {
    strategy: 'oauth_google' | 'oauth_apple';
    redirectUrl?: string;
  }) => Promise<void>;
  getToken: () => Promise<string | null>;
  userId?: string | null;
  isSignedIn?: boolean;
}

/**
 * Clerk user object interface
 */
export interface ClerkUser {
  id: string;
  emailAddresses: Array<{ emailAddress: string }>;
  firstName?: string | null;
  lastName?: string | null;
}

/**
 * Sign in with Google OAuth using Clerk
 *
 * @param clerkAuth Clerk auth methods from useAuth() hook
 * @param clerkUser Optional Clerk user object from useUser() hook
 * @returns OAuth result with JWT and Supabase session
 */
export async function signInWithGoogle(
  clerkAuth: ClerkAuthMethods,
  _clerkUser?: ClerkUser | null,
): Promise<OAuthResult> {
  try {
    console.log(
      '🔐 [OAuth Service] Initiating Google OAuth sign-in via Clerk...',
    );

    // Check if Clerk is configured
    if (!isClerkConfigured()) {
      const error =
        'Clerk is not configured. Please set CLERK_PUBLISHABLE_KEY and CLERK_JWKS_URL.';
      console.error('❌ [OAuth Service]', error);
      return {
        success: false,
        error,
      };
    }

    // Use Clerk's OAuth sign-in
    // Note: Clerk's signInWithOAuth opens the OAuth provider in a browser/webview
    // The OAuth callback is handled via deep linking (creativebridge://auth/callback)
    // After the callback, Clerk automatically completes the authentication
    console.log(
      '📋 [OAuth Service] Calling Clerk signInWithOAuth with strategy: oauth_google',
    );
    await clerkAuth.signInWithOAuth({
      strategy: 'oauth_google',
      redirectUrl: 'creativebridge://auth/callback',
    });

    console.log(
      '🌐 [OAuth Service] OAuth flow initiated, waiting for callback via deep linking...',
    );
    console.log(
      '📱 [OAuth Service] OAuth callback will be handled automatically by Clerk via deep link',
    );

    // Clerk's signInWithOAuth opens the OAuth provider and handles the callback automatically
    // After the callback completes, the user will be signed in to Clerk
    // We need to wait for the OAuth callback to complete before getting the JWT
    // The callback is handled via deep linking in App.tsx

    // For now, return success - the actual JWT retrieval and Supabase sync
    // should happen after the OAuth callback completes (handled in AuthContext)
    // This allows the OAuth flow to complete asynchronously via deep linking
    return {
      success: true,
      // JWT and session will be available after OAuth callback completes
      // The caller should check auth state after OAuth callback
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'An unexpected error occurred during Google OAuth';
    console.error(
      '💥 [OAuth Service] Unexpected error during Google sign-in:',
      errorMessage,
    );
    console.error('💥 [OAuth Service] Error details:', error);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Sign in with Apple OAuth using Clerk
 *
 * @param clerkAuth Clerk auth methods from useAuth() hook
 * @param clerkUser Optional Clerk user object from useUser() hook
 * @returns OAuth result with JWT and Supabase session
 */
export async function signInWithApple(
  clerkAuth: ClerkAuthMethods,
  _clerkUser?: ClerkUser | null,
): Promise<OAuthResult> {
  try {
    console.log(
      '🔐 [OAuth Service] Initiating Apple OAuth sign-in via Clerk...',
    );

    // Check if Clerk is configured
    if (!isClerkConfigured()) {
      const error =
        'Clerk is not configured. Please set CLERK_PUBLISHABLE_KEY and CLERK_JWKS_URL.';
      console.error('❌ [OAuth Service]', error);
      return {
        success: false,
        error,
      };
    }

    // Use Clerk's OAuth sign-in
    // Note: Clerk's signInWithOAuth opens the OAuth provider in a browser/webview
    // The OAuth callback is handled via deep linking (creativebridge://auth/callback)
    // After the callback, Clerk automatically completes the authentication
    console.log(
      '📋 [OAuth Service] Calling Clerk signInWithOAuth with strategy: oauth_apple',
    );
    await clerkAuth.signInWithOAuth({
      strategy: 'oauth_apple',
      redirectUrl: 'creativebridge://auth/callback',
    });

    console.log(
      '🌐 [OAuth Service] OAuth flow initiated, waiting for callback via deep linking...',
    );
    console.log(
      '📱 [OAuth Service] OAuth callback will be handled automatically by Clerk via deep link',
    );

    // Clerk's signInWithOAuth opens the OAuth provider and handles the callback automatically
    // After the callback completes, the user will be signed in to Clerk
    // We need to wait for the OAuth callback to complete before getting the JWT
    // The callback is handled via deep linking in App.tsx

    // For now, return success - the actual JWT retrieval and Supabase sync
    // should happen after the OAuth callback completes (handled in AuthContext)
    // This allows the OAuth flow to complete asynchronously via deep linking
    return {
      success: true,
      // JWT and session will be available after OAuth callback completes
      // The caller should check auth state after OAuth callback
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'An unexpected error occurred during Apple OAuth';
    console.error(
      '💥 [OAuth Service] Unexpected error during Apple sign-in:',
      errorMessage,
    );
    console.error('💥 [OAuth Service] Error details:', error);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Complete OAuth flow after Clerk callback
 * This should be called after the OAuth callback completes via deep linking
 *
 * @param clerkAuth Clerk auth methods from useAuth() hook
 * @param clerkUser Optional Clerk user object from useUser() hook
 * @returns OAuth result with JWT and Supabase session
 */
export async function completeOAuthFlow(
  clerkAuth: ClerkAuthMethods,
  clerkUser?: ClerkUser | null,
): Promise<OAuthResult> {
  try {
    console.log('🔄 [OAuth Service] Completing OAuth flow after callback...');

    // Check if user is signed in
    if (!clerkAuth.isSignedIn) {
      const error = 'User is not signed in after OAuth callback';
      console.error('❌ [OAuth Service]', error);
      return {
        success: false,
        error,
      };
    }

    // Retrieve Clerk JWT token
    console.log('🔑 [OAuth Service] Retrieving Clerk JWT token...');
    const clerkJWT = await clerkAuth.getToken();

    if (!clerkJWT) {
      const error = 'Failed to retrieve Clerk JWT token after authentication';
      console.error('❌ [OAuth Service]', error);
      return {
        success: false,
        error,
      };
    }

    console.log('✅ [OAuth Service] Clerk JWT retrieved successfully');

    // Send Clerk JWT to Supabase for verification
    console.log(
      '🔄 [OAuth Service] Sending Clerk JWT to Supabase for verification...',
    );
    const supabaseResult = await createSupabaseSessionFromClerkJWT(clerkJWT);

    if (!supabaseResult.success) {
      const error =
        supabaseResult.error ||
        'Failed to create Supabase session from Clerk JWT';
      console.error('❌ [OAuth Service]', error);
      return {
        success: false,
        error,
        jwt: clerkJWT, // Still return JWT even if Supabase sync fails
      };
    }

    console.log('✅ [OAuth Service] Supabase session created successfully');

    // Extract user email from Clerk user object
    let userEmail: string | undefined;
    if (clerkUser?.emailAddresses && clerkUser.emailAddresses.length > 0) {
      userEmail = clerkUser.emailAddresses[0].emailAddress;
      console.log('📧 [OAuth Service] User email extracted:', userEmail);
    } else if (clerkAuth.userId) {
      // Fallback: try to get email from Clerk auth if user object not provided
      console.log(
        '⚠️ [OAuth Service] Clerk user object not provided, using userId:',
        clerkAuth.userId,
      );
    }

    // Extract Clerk user ID
    const clerkUserId = clerkUser?.id || clerkAuth.userId || undefined;

    return {
      success: true,
      jwt: clerkJWT,
      supabaseSession: supabaseResult.session,
      userEmail,
      clerkUserId,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'An unexpected error occurred while completing OAuth flow';
    console.error(
      '💥 [OAuth Service] Unexpected error completing OAuth flow:',
      errorMessage,
    );
    console.error('💥 [OAuth Service] Error details:', error);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * OAuth service object for easy importing
 */
export const oauthService = {
  signInWithGoogle,
  signInWithApple,
  completeOAuthFlow,
};
