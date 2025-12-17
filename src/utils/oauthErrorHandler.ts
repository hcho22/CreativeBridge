/**
 * OAuth Error Handler
 *
 * Provides comprehensive error handling for OAuth authentication flows (Google, Apple).
 * Handles various error types including network errors, user cancellations, and provider errors.
 * Returns structured error information for consistent error handling across the app.
 *
 * Error Scenarios Handled:
 * 1. User Cancellation - Silent return (no error shown to user)
 * 2. Network Errors - Retryable with exponential backoff
 * 3. Account Linking Errors - Not retryable, specific messages
 * 4. Database Errors - Retryable with delay
 * 5. Provider Errors (Clerk, Google, Apple) - Retryable with exponential backoff
 * 6. Token/Expiration Errors - Retryable
 * 7. Default/Unknown Errors - Generic message, retryable
 *
 * All errors include:
 * - User-friendly error messages
 * - Retry options when applicable
 * - Fallback to email/password option
 * - Exponential backoff for retries
 */

export interface OAuthErrorOptions {
  provider: 'google' | 'apple';
  attemptNumber?: number;
}

export interface OAuthErrorResult {
  /**
   * Whether an error should be shown to the user
   * Set to false for user cancellations (silent failures)
   */
  shouldShowError: boolean;

  /**
   * User-friendly error message
   */
  userMessage: string;

  /**
   * Whether email/password fallback is available
   */
  fallbackAvailable: boolean;

  /**
   * Whether the error is retryable
   */
  canRetry: boolean;

  /**
   * Optional delay in milliseconds before retry
   */
  retryDelay?: number;
}

/**
 * Common OAuth error codes and messages
 */
const OAUTH_ERROR_CODES = {
  // User cancellation (should be silent)
  USER_CANCELLED: [
    'user_cancelled',
    'user_canceled',
    'cancelled',
    'canceled',
    'user_cancelled_login',
    'user_canceled_login',
    'cancelled_by_user',
    'canceled_by_user',
    'user_cancelled_authorization',
    'user_canceled_authorization',
  ],

  // Network errors (retryable)
  NETWORK_ERROR: [
    'network_error',
    'network_request_failed',
    'network_unavailable',
    'connection_error',
    'timeout',
    'offline',
    'no internet',
    'no_internet',
    'network connection',
    'connection lost',
    'connection_lost',
    'fetch failed',
    'fetch_failed',
    'request timeout',
    'request_timeout',
    'econnrefused',
    'enotfound',
    'eai_again',
    'socket hang up',
    'socket_hang_up',
  ],

  // Provider errors (retryable with delay)
  PROVIDER_ERROR: [
    'provider_error',
    'authentication_failed',
    'invalid_request',
    'server_error',
    'service_unavailable',
    'oauth_error',
    'oauth_failed',
    'clerk error',
    'clerk_error',
    'internal server error',
    'internal_server_error',
    'bad gateway',
    'bad_gateway',
    'gateway timeout',
    'gateway_timeout',
  ],

  // Account linking errors (not retryable)
  ACCOUNT_ERROR: [
    'email_already_exists',
    'account_exists',
    'email_mismatch',
    'account_linking_failed',
    'profile is already linked',
    'already linked to a different',
    'clerk account',
    'different clerk account',
    'account conflict',
    'linking conflict',
  ],

  // Database errors during account linking
  DATABASE_ERROR: [
    'database_error',
    'database_failed',
    'failed to update profile',
    'failed to link',
    'pg_error',
    'postgres_error',
    'constraint violation',
    'unique constraint',
  ],
};

/**
 * Checks if an error message or code matches any of the given patterns
 */
function matchesErrorPattern(error: any, patterns: string[]): boolean {
  if (!error) return false;

  const errorString =
    typeof error === 'string'
      ? error.toLowerCase()
      : String(error).toLowerCase();

  const errorMessage = error?.message?.toLowerCase() || '';
  const errorCode = error?.code?.toLowerCase() || '';

  return patterns.some(
    pattern =>
      errorString.includes(pattern) ||
      errorMessage.includes(pattern) ||
      errorCode.includes(pattern),
  );
}

/**
 * Extracts error message from various error formats
 */
function extractErrorMessage(error: any): string {
  if (typeof error === 'string') {
    return error;
  }

  if (error?.message) {
    return error.message;
  }

  if (error?.error) {
    return extractErrorMessage(error.error);
  }

  return 'An unexpected error occurred';
}

/**
 * Handles OAuth authentication errors
 *
 * @param error - The error object or message from the OAuth provider
 * @param options - Options including provider type and attempt number
 * @returns Structured error result with handling instructions
 */
export function handleOAuthError(
  error: any,
  options: OAuthErrorOptions,
): OAuthErrorResult {
  const { attemptNumber = 1 } = options;
  const errorMessage = extractErrorMessage(error);
  const errorString = errorMessage.toLowerCase();

  // User cancellation - silent failure (no error shown)
  if (matchesErrorPattern(error, OAUTH_ERROR_CODES.USER_CANCELLED)) {
    return {
      shouldShowError: false,
      userMessage: '',
      fallbackAvailable: true,
      canRetry: false,
    };
  }

  // Network errors - retryable
  if (matchesErrorPattern(error, OAUTH_ERROR_CODES.NETWORK_ERROR)) {
    // Calculate exponential backoff for retries
    const baseDelay = 2000;
    const retryDelay = attemptNumber > 1 ? baseDelay * Math.pow(2, attemptNumber - 1) : baseDelay;
    const maxDelay = 10000; // Cap at 10 seconds
    const finalDelay = Math.min(retryDelay, maxDelay);

    return {
      shouldShowError: true,
      userMessage:
        'Connection error. Please check your internet connection and try again.',
      fallbackAvailable: true,
      canRetry: attemptNumber < 3, // Allow up to 2 retries for network errors
      retryDelay: finalDelay,
    };
  }

  // Account linking errors - not retryable, specific message
  if (matchesErrorPattern(error, OAUTH_ERROR_CODES.ACCOUNT_ERROR)) {
    // Profile already linked to different Clerk account
    if (
      errorString.includes('already linked') ||
      errorString.includes('different clerk') ||
      errorString.includes('account conflict')
    ) {
      return {
        shouldShowError: true,
        userMessage:
          'This account is already linked to a different sign-in method. Please use your original sign-in method or contact support.',
        fallbackAvailable: true,
        canRetry: false,
      };
    }

    // Email mismatch errors
    if (errorString.includes('email') && errorString.includes('mismatch')) {
      return {
        shouldShowError: true,
        userMessage:
          'The email address does not match your account. Please sign in with the email address associated with your account.',
        fallbackAvailable: true,
        canRetry: false,
      };
    }

    // Email already exists (but different account)
    if (errorString.includes('email') && errorString.includes('already')) {
      return {
        shouldShowError: true,
        userMessage:
          'This email is already associated with another account. Please sign in with your email and password instead.',
        fallbackAvailable: true,
        canRetry: false,
      };
    }

    // General account linking failure
    if (errorString.includes('linking')) {
      return {
        shouldShowError: true,
        userMessage:
          'Unable to link your account. Please try signing in with your email and password, or contact support if this issue persists.',
        fallbackAvailable: true,
        canRetry: false,
      };
    }

    // Default account error
    return {
      shouldShowError: true,
      userMessage:
        'There was an issue linking your account. Please sign in with your email and password instead.',
      fallbackAvailable: true,
      canRetry: false,
    };
  }

  // Database errors during account linking
  if (matchesErrorPattern(error, OAUTH_ERROR_CODES.DATABASE_ERROR)) {
    // Check if it's a constraint violation (e.g., unique constraint on clerk_user_id)
    if (
      errorString.includes('constraint') ||
      errorString.includes('unique') ||
      errorString.includes('duplicate')
    ) {
      return {
        shouldShowError: true,
        userMessage:
          'This account is already linked. Please sign in with your existing account.',
        fallbackAvailable: true,
        canRetry: false,
      };
    }

    // General database error
    return {
      shouldShowError: true,
      userMessage:
        'Unable to save account information. Please try again or use email and password to sign in.',
      fallbackAvailable: true,
      canRetry: attemptNumber < 2, // Allow one retry for database errors
      retryDelay: 2000,
    };
  }

  // Provider errors - retryable with delay
  if (matchesErrorPattern(error, OAUTH_ERROR_CODES.PROVIDER_ERROR)) {
    // Calculate exponential backoff for retries
    const baseDelay = 3000;
    const retryDelay = attemptNumber > 1 ? baseDelay * Math.pow(2, attemptNumber - 1) : baseDelay;
    const maxDelay = 15000; // Cap at 15 seconds
    const finalDelay = Math.min(retryDelay, maxDelay);

    // Provide more specific messages for Clerk errors
    let userMessage = 'Authentication failed. Please try again.';
    if (errorString.includes('clerk')) {
      userMessage = 'Authentication service temporarily unavailable. Please try again in a moment.';
    } else if (errorString.includes('server') || errorString.includes('gateway')) {
      userMessage = 'The authentication service is experiencing issues. Please try again in a moment.';
    }

    return {
      shouldShowError: true,
      userMessage,
      fallbackAvailable: true,
      canRetry: attemptNumber < 2, // Allow one retry
      retryDelay: finalDelay,
    };
  }

  // Supabase-specific errors
  if (
    errorString.includes('supabase') ||
    errorString.includes('invalid_credentials')
  ) {
    return {
      shouldShowError: true,
      userMessage:
        'Authentication failed. Please try again or use email and password.',
      fallbackAvailable: true,
      canRetry: attemptNumber < 2,
      retryDelay: 2000,
    };
  }

  // Invalid credentials or token errors
  if (
    errorString.includes('invalid') ||
    errorString.includes('token') ||
    errorString.includes('expired')
  ) {
    return {
      shouldShowError: true,
      userMessage: 'Authentication session expired. Please try again.',
      fallbackAvailable: true,
      canRetry: true,
      retryDelay: 1000,
    };
  }

  // Clerk-specific errors
  if (errorString.includes('clerk') || errorString.includes('jwt') || errorString.includes('jwks')) {
    return {
      shouldShowError: true,
      userMessage:
        'Authentication service error. Please try again or use email and password to sign in.',
      fallbackAvailable: true,
      canRetry: attemptNumber < 2,
      retryDelay: 3000,
    };
  }

  // Default error - generic message, retryable
  // Calculate exponential backoff for retries
  const baseDelay = 2000;
  const retryDelay = attemptNumber > 1 ? baseDelay * Math.pow(2, attemptNumber - 1) : baseDelay;
  const maxDelay = 8000; // Cap at 8 seconds
  const finalDelay = Math.min(retryDelay, maxDelay);

  return {
    shouldShowError: true,
    userMessage:
      'An error occurred during sign-in. Please try again or use email and password.',
    fallbackAvailable: true,
    canRetry: attemptNumber < 2,
    retryDelay: finalDelay,
  };
}
