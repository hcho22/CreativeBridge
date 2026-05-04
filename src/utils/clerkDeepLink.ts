/**
 * Clerk Deep Link Utilities
 *
 * Handles parsing and processing Clerk OAuth callback deep links.
 * Clerk OAuth callbacks typically come in the format:
 * creativebridge://auth/callback?__clerk_redirect_url=...
 */

import * as Linking from 'expo-linking';

export interface ClerkCallbackParams {
  __clerk_redirect_url?: string;
  __clerk_session?: string;
  error?: string;
  error_description?: string;
  [key: string]: string | undefined;
}

export interface ParsedClerkCallback {
  scheme: string;
  path: string;
  params: ClerkCallbackParams;
  isClerkCallback: boolean;
}

/**
 * Check if a URL is a Clerk OAuth callback
 * @param url Deep link URL
 * @returns true if URL is a Clerk callback
 */
export function isClerkCallback(url: string): boolean {
  if (!url) return false;

  // Must be on auth/callback path
  if (!url.includes('auth/callback')) return false;

  // Exclude Supabase OAuth callbacks (they have access_token)
  if (url.includes('access_token=') || url.includes('#access_token=')) {
    return false;
  }

  // Check for Clerk-specific parameters
  const hasClerkParams =
    url.includes('__clerk_redirect_url') ||
    url.includes('__clerk_session') ||
    url.includes('clerk');

  // Check if it's an error callback (could be from Clerk OAuth)
  // Error callbacks from Clerk won't have access_token
  const hasErrorParams =
    url.includes('error=') && !url.includes('access_token');

  // If it's on auth/callback, not a Supabase callback, and has query params,
  // consider it a potential Clerk callback (ClerkProvider will handle validation)
  const hasQueryParams = url.includes('?') || url.includes('#');

  // Be lenient: if it's auth/callback and not Supabase, allow Clerk to handle it
  return hasClerkParams || hasErrorParams || hasQueryParams;
}

/**
 * Parse Clerk OAuth callback URL
 * @param url Deep link URL
 * @returns Parsed callback data or null
 */
export function parseClerkCallbackURL(url: string): ParsedClerkCallback | null {
  try {
    const parsed = Linking.parse(url);

    if (!parsed.scheme || !parsed.path) {
      return null;
    }

    // Extract query parameters
    const params: ClerkCallbackParams = {};

    // Parse query string
    const queryParams = parsed.queryParams;
    if (queryParams) {
      Object.keys(queryParams).forEach(key => {
        const value = queryParams[key];
        if (value) {
          params[key] = Array.isArray(value) ? value[0] : value;
        }
      });
    }

    // Also check for hash fragments (some OAuth flows use hash)
    const hashMatch = url.match(/#(.+)/);
    if (hashMatch) {
      const hashParams = new URLSearchParams(hashMatch[1]);
      hashParams.forEach((value, key) => {
        params[key] = value;
      });
    }

    return {
      scheme: parsed.scheme,
      path: parsed.path,
      params,
      isClerkCallback: isClerkCallback(url),
    };
  } catch (error) {
    console.error('Error parsing Clerk callback URL:', error);
    return null;
  }
}

/**
 * Extract Clerk redirect URL from callback
 * @param url Deep link URL
 * @returns Clerk redirect URL or null
 */
export function extractClerkRedirectURL(url: string): string | null {
  const parsed = parseClerkCallbackURL(url);
  if (!parsed) return null;

  return parsed.params.__clerk_redirect_url || null;
}

/**
 * Check if Clerk callback contains an error
 * @param url Deep link URL
 * @returns Error information or null
 */
export function getClerkCallbackError(
  url: string,
): { error: string; description?: string } | null {
  const parsed = parseClerkCallbackURL(url);
  if (!parsed) return null;

  if (parsed.params.error) {
    return {
      error: parsed.params.error,
      description: parsed.params.error_description,
    };
  }

  return null;
}

/**
 * Handle Clerk OAuth callback
 * @param url Deep link URL
 * @returns Callback result with redirect URL or error
 */
export function handleClerkCallback(url: string): {
  success: boolean;
  redirectUrl?: string;
  error?: string;
  errorDescription?: string;
} {
  if (!isClerkCallback(url)) {
    return {
      success: false,
      error: 'Not a Clerk callback URL',
    };
  }

  const parsed = parseClerkCallbackURL(url);
  if (!parsed) {
    return {
      success: false,
      error: 'Failed to parse callback URL',
    };
  }

  // Check for errors first
  const callbackError = getClerkCallbackError(url);
  if (callbackError) {
    return {
      success: false,
      error: callbackError.error,
      errorDescription: callbackError.description,
    };
  }

  // Extract redirect URL
  const redirectUrl = extractClerkRedirectURL(url);
  if (!redirectUrl) {
    // If no redirect URL but no error, it might still be a valid callback
    // ClerkProvider will handle it
    return {
      success: true, // Allow Clerk to handle it even without explicit redirect URL
    };
  }

  return {
    success: true,
    redirectUrl,
  };
}
