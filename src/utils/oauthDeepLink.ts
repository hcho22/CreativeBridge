/**
 * OAuth Deep Link Utilities
 *
 * Handles parsing and processing OAuth callback URLs from deep links
 */

import 'react-native-url-polyfill/auto';
import * as Linking from 'expo-linking';

export interface OAuthCallbackParams {
  access_token?: string;
  refresh_token?: string;
  expires_in?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
  state?: string;
}

export interface ParsedOAuthURL {
  scheme: string;
  host: string;
  path: string;
  params: OAuthCallbackParams;
}

/**
 * Parse OAuth callback URL and extract parameters
 * @param url - The OAuth callback URL (e.g., creativebridge://auth/callback?access_token=...)
 * @returns Parsed URL with extracted parameters
 */
export function parseOAuthCallbackURL(url: string): ParsedOAuthURL | null {
  try {
    const parsed = Linking.parse(url);

    // Extract query parameters
    const params: OAuthCallbackParams = {};
    if (parsed.queryParams) {
      Object.keys(parsed.queryParams).forEach(key => {
        const value = parsed.queryParams[key];
        if (typeof value === 'string') {
          params[key as keyof OAuthCallbackParams] = value;
        }
      });
    }

    // Also check for hash fragments (some OAuth flows use # instead of ?)
    if (url.includes('#')) {
      const hashPart = url.split('#')[1];
      if (hashPart) {
        const hashParams = new URLSearchParams(hashPart);
        hashParams.forEach((value, key) => {
          params[key as keyof OAuthCallbackParams] = value;
        });
      }
    }

    return {
      scheme: parsed.scheme || '',
      host: parsed.hostname || '',
      path: parsed.path || '',
      params,
    };
  } catch (error) {
    console.error('Error parsing OAuth callback URL:', error);
    return null;
  }
}

/**
 * Check if a URL is an OAuth callback
 * @param url - The URL to check
 * @returns True if the URL is an OAuth callback
 */
export function isOAuthCallback(url: string): boolean {
  if (!url) return false;

  // Check for OAuth callback patterns
  const oauthPatterns = [
    /creativebridge:\/\/auth\/callback/,
    /access_token=/,
    /error=/,
    /code=/,
  ];

  return oauthPatterns.some(pattern => pattern.test(url));
}

/**
 * Extract OAuth tokens from callback URL
 * @param url - The OAuth callback URL
 * @returns Object with access_token and refresh_token if available
 */
export function extractOAuthTokens(url: string): {
  access_token?: string;
  refresh_token?: string;
  error?: string;
} {
  const parsed = parseOAuthCallbackURL(url);
  if (!parsed) {
    return {};
  }

  return {
    access_token: parsed.params.access_token,
    refresh_token: parsed.params.refresh_token,
    error: parsed.params.error,
  };
}

/**
 * Handle OAuth callback URL
 * This function processes the OAuth callback and extracts relevant information
 * @param url - The OAuth callback URL
 * @returns Success status and extracted tokens/error
 */
export function handleOAuthCallback(url: string): {
  success: boolean;
  access_token?: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
} {
  if (!isOAuthCallback(url)) {
    return { success: false, error: 'Not an OAuth callback URL' };
  }

  const parsed = parseOAuthCallbackURL(url);
  if (!parsed) {
    return { success: false, error: 'Failed to parse OAuth callback URL' };
  }

  // Check for errors
  if (parsed.params.error) {
    return {
      success: false,
      error: parsed.params.error,
      error_description: parsed.params.error_description,
    };
  }

  // Extract tokens
  if (parsed.params.access_token) {
    return {
      success: true,
      access_token: parsed.params.access_token,
      refresh_token: parsed.params.refresh_token,
    };
  }

  return { success: false, error: 'No access token found in callback' };
}
