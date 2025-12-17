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
  errorType?:
    | 'ACCOUNT_LINKING_CONFLICT'
    | 'DATABASE_ERROR'
    | 'EMAIL_MISMATCH'
    | 'UNKNOWN';
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
 * Apple OAuth has several unique characteristics that Clerk handles automatically:
 * 1. Private Relay Email: Apple may provide a private relay email (e.g., privaterelay@icloud.com)
 *    instead of the user's real email. Clerk handles this transparently and provides the email
 *    address in the Clerk user object, whether it's a real email or a private relay.
 * 2. Platform-Specific Implementation:
 *    - iOS: Clerk uses native Apple Sign In (ASWebAuthenticationSession) for better UX
 *    - Android: Clerk uses web-based OAuth flow (browser/webview)
 *    Clerk automatically selects the appropriate method based on the platform.
 * 3. Email Privacy: Users can choose to hide their email, in which case Apple provides
 *    a private relay email. Clerk stores this email and we can use it for account identification.
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
      '🍎 [OAuth Service] Initiating Apple OAuth sign-in via Clerk...',
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

    // Use Clerk's OAuth sign-in with Apple strategy
    // Platform-specific behavior (handled automatically by Clerk):
    // - iOS: Uses native Apple Sign In (ASWebAuthenticationSession) for seamless UX
    // - Android: Uses web-based OAuth flow in browser/webview
    // Clerk automatically detects the platform and uses the appropriate method
    console.log(
      '📋 [OAuth Service] Calling Clerk signInWithOAuth with strategy: oauth_apple',
    );
    console.log(
      '📱 [OAuth Service] Platform-specific handling: Clerk will use native Apple Sign In on iOS, web OAuth on Android',
    );

    await clerkAuth.signInWithOAuth({
      strategy: 'oauth_apple',
      redirectUrl: 'creativebridge://auth/callback',
    });

    console.log(
      '🌐 [OAuth Service] Apple OAuth flow initiated, waiting for callback via deep linking...',
    );
    console.log(
      '📱 [OAuth Service] OAuth callback will be handled automatically by Clerk via deep link',
    );
    console.log(
      '🍎 [OAuth Service] Note: Apple may provide a private relay email - Clerk handles this automatically',
    );

    // Clerk's signInWithOAuth opens the OAuth provider and handles the callback automatically
    // After the callback completes, the user will be signed in to Clerk
    // We need to wait for the OAuth callback to complete before getting the JWT
    // The callback is handled via deep linking in App.tsx
    //
    // Apple-specific considerations:
    // - If user chooses to hide email, Apple provides a private relay email
    // - Clerk stores this email in the user object (emailAddresses array)
    // - We can use this email for account identification (it's stable per user)
    // - The email will be available in clerkUser.emailAddresses after authentication

    // For now, return success - the actual JWT retrieval and Supabase sync
    // should happen after the OAuth callback completes (handled in AuthContext)
    // This allows the OAuth flow to complete asynchronously via deep linking
    return {
      success: true,
      // JWT and session will be available after OAuth callback completes
      // The caller should check auth state after OAuth callback
      // Note: User email (including private relay) will be available in Clerk user object
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

    // Handle specific Apple OAuth errors
    if (error instanceof Error) {
      // User cancellation (common on Apple Sign In)
      if (
        error.message.includes('cancel') ||
        error.message.includes('dismissed') ||
        error.message.includes('user_cancelled')
      ) {
        console.log(
          'ℹ️ [OAuth Service] Apple sign-in was cancelled by user (silent return)',
        );
        // Return success: false but don't show error to user (handled in UI)
        return {
          success: false,
          error: 'User cancelled Apple sign-in',
        };
      }

      // Network errors
      if (
        error.message.includes('network') ||
        error.message.includes('connection')
      ) {
        console.error(
          '🌐 [OAuth Service] Network error during Apple sign-in',
          error.message,
        );
        return {
          success: false,
          error: 'Network error. Please check your connection and try again.',
        };
      }
    }

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

    // Extract user email from Clerk user object (before Supabase sync for account linking)
    // Note: For Apple OAuth, this may be a private relay email (e.g., privaterelay@icloud.com)
    // Clerk handles Apple's email privacy feature automatically and provides the email
    // (whether real or private relay) in the user object
    let userEmail: string | undefined;
    if (clerkUser?.emailAddresses && clerkUser.emailAddresses.length > 0) {
      userEmail = clerkUser.emailAddresses[0].emailAddress;
      console.log('📧 [OAuth Service] User email extracted:', userEmail);

      // Log if this appears to be an Apple private relay email
      if (
        userEmail.includes('privaterelay') ||
        userEmail.includes('icloud.com')
      ) {
        console.log(
          '🍎 [OAuth Service] Apple private relay email detected - this is normal for Apple Sign In users who choose to hide their email',
        );
        console.log(
          'ℹ️ [OAuth Service] Private relay emails are stable per user and can be used for account identification',
        );
      }
    } else if (clerkAuth.userId) {
      // Fallback: try to get email from Clerk auth if user object not provided
      console.log(
        '⚠️ [OAuth Service] Clerk user object not provided, using userId:',
        clerkAuth.userId,
      );
      console.log(
        '⚠️ [OAuth Service] Email will not be available until user object is provided',
      );
    }

    // Send Clerk JWT to Supabase for verification (with email for account linking)
    console.log(
      '🔄 [OAuth Service] Sending Clerk JWT to Supabase for verification and account linking...',
    );
    const supabaseResult = await createSupabaseSessionFromClerkJWT(
      clerkJWT,
      userEmail,
    );

    if (!supabaseResult.success) {
      const error =
        supabaseResult.error ||
        'Failed to create Supabase session from Clerk JWT';
      const errorType = supabaseResult.errorType || 'UNKNOWN';

      console.error('❌ [OAuth Service] Account linking/sync failed:', error);
      console.error('❌ [OAuth Service] Error type:', errorType);

      // Log account linking errors for monitoring
      const errorContext = {
        errorType,
        errorMessage: error,
        clerkUserId: clerkUser?.id || clerkAuth.userId || 'unknown',
        userEmail: userEmail || 'not provided',
        timestamp: new Date().toISOString(),
      };
      console.error(
        '📊 [OAuth Service] Account linking error context:',
        errorContext,
      );

      // Return error with type for better error handling in UI
      // The error handler will use the error type to provide appropriate user messages
      return {
        success: false,
        error: error, // Error message that will be processed by error handler
        errorType, // Additional context for error handling
        jwt: clerkJWT, // Still return JWT even if Supabase sync fails
      };
    }

    console.log('✅ [OAuth Service] Supabase session created successfully');

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
