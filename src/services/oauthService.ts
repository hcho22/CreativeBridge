/**
 * OAuth Service with Clerk Integration
 *
 * This service handles OAuth authentication using Clerk:
 * 1. Initiates OAuth flow via Clerk
 * 2. Retrieves Clerk JWT token after authentication
 * 3. Extracts user information from Clerk user object
 *
 * Architecture: Clerk handles OAuth authentication and issues JWTs.
 * Convex handles profile creation/lookup natively via ConvexProviderWithClerk.
 *
 * Migration Note (US-032): The Supabase sync step has been removed.
 * Profile management is now handled by Convex reactive queries and
 * migrations in AuthContext.tsx.
 */

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
 * Note: OAuth sign-in is now handled via useSSO() hook directly in AuthContext
 * This interface is used for post-OAuth operations like getting tokens
 */
export interface ClerkAuthMethods {
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
 * @deprecated OAuth sign-in is now handled directly in AuthContext using useSSO() hook.
 * This function is kept for backward compatibility but should not be called.
 * Use the signInWithGoogle method from AuthContext instead.
 *
 * @param _clerkAuth Clerk auth methods (no longer used)
 * @param _clerkUser Optional Clerk user object (no longer used)
 * @returns OAuth result indicating this function is deprecated
 */
export async function signInWithGoogle(
  _clerkAuth: ClerkAuthMethods,
  _clerkUser?: ClerkUser | null,
): Promise<OAuthResult> {
  console.warn(
    '⚠️ [OAuth Service] signInWithGoogle is deprecated. OAuth is now handled directly in AuthContext using useSSO() hook.',
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

  // This function is deprecated - OAuth is now handled in AuthContext
  return {
    success: false,
    error:
      'This function is deprecated. Use AuthContext.signInWithGoogle() instead.',
  };
}

/**
 * Sign in with Apple OAuth using Clerk
 *
 * @deprecated OAuth sign-in is now handled directly in AuthContext using useSSO() hook.
 * This function is kept for backward compatibility but should not be called.
 * Use the signInWithApple method from AuthContext instead.
 *
 * Apple OAuth characteristics (handled by AuthContext):
 * 1. Private Relay Email: Apple may provide a private relay email
 * 2. Platform-Specific: iOS uses native Apple Sign In, Android uses web-based OAuth
 * 3. Email Privacy: Users can choose to hide their email
 *
 * @param _clerkAuth Clerk auth methods (no longer used)
 * @param _clerkUser Optional Clerk user object (no longer used)
 * @returns OAuth result indicating this function is deprecated
 */
export async function signInWithApple(
  _clerkAuth: ClerkAuthMethods,
  _clerkUser?: ClerkUser | null,
): Promise<OAuthResult> {
  console.warn(
    '⚠️ [OAuth Service] signInWithApple is deprecated. OAuth is now handled directly in AuthContext using useSSO() hook.',
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

  // This function is deprecated - OAuth is now handled in AuthContext
  return {
    success: false,
    error:
      'This function is deprecated. Use AuthContext.signInWithApple() instead.',
  };
}

/**
 * Complete OAuth flow after Clerk callback
 * This should be called after the OAuth callback completes via deep linking
 *
 * Migration Note (US-032): Profile creation/lookup is now handled by Convex.
 * This function no longer syncs with Supabase - it just extracts user info
 * from the Clerk session.
 *
 * @param clerkAuth Clerk auth methods from useAuth() hook
 * @param clerkUser Optional Clerk user object from useUser() hook
 * @returns OAuth result with JWT and user info
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

    // Extract user email from Clerk user object
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

    // Extract Clerk user ID
    const clerkUserId = clerkUser?.id || clerkAuth.userId || undefined;

    console.log(
      '✅ [OAuth Service] OAuth flow completed - Convex will handle profile management',
    );

    return {
      success: true,
      jwt: clerkJWT,
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
