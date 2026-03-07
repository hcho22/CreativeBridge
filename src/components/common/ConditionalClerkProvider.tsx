import React, { useMemo, useCallback } from 'react';
import { View, Text } from 'react-native';
import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { isClerkConfigured, getClerkConfig } from '../../config/environment';
import { clerkTokenCache } from '../../utils/clerkTokenCache';
import { getConvexClient } from '../../services/convex';

/**
 * Helper to decode JWT payload without verification (for debugging only)
 */
function decodeJwtPart(part: string): Record<string, unknown> | null {
  try {
    const decoded = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return decodeJwtPart(parts[1]);
  } catch {
    return null;
  }
}

function decodeJwtHeader(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return decodeJwtPart(parts[0]);
  } catch {
    return null;
  }
}

/**
 * Custom hook that wraps useAuth with debug logging for Convex token fetching
 */
function useAuthWithConvexDebug() {
  const auth = useAuth();

  // Wrap getToken to log what's happening
  const wrappedGetToken = useCallback(
    async (options?: { template?: string; skipCache?: boolean }) => {
      const template = options?.template || '(default)';
      console.log(
        `🔑 [Convex Auth Debug] getToken called with template: "${template}"`,
      );

      try {
        const token = await auth.getToken(options);

        if (token) {
          console.log(
            `✅ [Convex Auth Debug] Token received for template "${template}"`,
          );
          console.log(`🔑 [Convex Auth Debug] Token length: ${token.length}`);

          // Decode and log JWT HEADER for debugging
          const header = decodeJwtHeader(token);
          if (header) {
            console.log(
              `🔑 [Convex Auth Debug] JWT HEADER:`,
              JSON.stringify(header, null, 2),
            );
          }

          // Decode and log ALL claims for debugging
          const payload = decodeJwtPayload(token);
          if (payload) {
            console.log(
              `🔑 [Convex Auth Debug] Token claims (ALL):`,
              JSON.stringify(payload, null, 2),
            );
            console.log(`🔑 [Convex Auth Debug] OIDC Required claims check:`, {
              iss: payload.iss ? '✅' : '❌ MISSING',
              sub: payload.sub ? '✅' : '❌ MISSING',
              aud: payload.aud ? '✅' : '❌ MISSING',
              exp: payload.exp ? '✅' : '❌ MISSING',
              iat: payload.iat ? '✅' : '❌ MISSING',
            });
          }
        } else {
          console.warn(
            `⚠️ [Convex Auth Debug] getToken returned null for template "${template}"`,
          );
          console.warn(
            `⚠️ [Convex Auth Debug] This usually means the JWT template "${template}" doesn't exist in Clerk Dashboard`,
          );
        }

        return token;
      } catch (error) {
        console.error(
          `❌ [Convex Auth Debug] getToken THREW for template "${template}":`,
          error,
        );
        throw error;
      }
    },
    [auth],
  );

  return {
    ...auth,
    getToken: wrappedGetToken,
  };
}

interface ConditionalClerkProviderProps {
  children: React.ReactNode;
}

/**
 * Conditionally wraps children with ClerkProvider.
 *
 * When Clerk is properly configured, it wraps children with ClerkProvider using the real key.
 * When Clerk is not configured, it still wraps children with ClerkProvider using a dummy key
 * to prevent Clerk hooks from throwing errors. Components should check isClerkConfigured()
 * before using Clerk functionality.
 *
 * This ensures ClerkProvider is always present, preventing hook errors when components
 * unconditionally call Clerk hooks (as required by React's rules of hooks).
 */
export const ConditionalClerkProvider: React.FC<
  ConditionalClerkProviderProps
> = ({ children }) => {
  // Memoize the configuration check to ensure consistency
  const clerkConfig = useMemo(() => {
    // Check if Clerk is configured
    if (!isClerkConfigured()) {
      return null;
    }

    // Get Clerk configuration
    try {
      const config = getClerkConfig();
      // Validate the publishable key
      if (
        !config.publishableKey ||
        !config.publishableKey.startsWith('pk_') ||
        config.publishableKey.length < 10
      ) {
        console.warn(
          '⚠️ Clerk publishable key is invalid, rendering without ClerkProvider',
        );
        return null;
      }
      return config;
    } catch (error) {
      console.warn(
        '⚠️ Failed to get Clerk config, rendering without ClerkProvider:',
        error,
      );
      return null;
    }
  }, []);

  // If Clerk is not configured, don't render children
  // This prevents AuthProvider from calling Clerk hooks when ClerkProvider is not present
  // Components that need to work without Clerk should be rendered outside this provider
  if (!clerkConfig) {
    console.warn(
      '⚠️ Clerk is not configured. ConditionalClerkProvider will not render children.',
    );
    return null;
  }

  // Get Convex client (may be null if not configured)
  const convexClientInstance = useMemo(() => getConvexClient(), []);

  // Clerk is configured, wrap with ClerkProvider
  // This ensures ClerkProvider is present when Clerk hooks are called
  return (
    <ClerkProvider
      publishableKey={clerkConfig.publishableKey}
      tokenCache={clerkTokenCache}
    >
      {convexClientInstance ? (
        // Convex is configured - wrap with ConvexProviderWithClerk
        // ConvexProviderWithClerk must be INSIDE ClerkProvider because it uses useAuth
        // Using useAuthWithConvexDebug to add logging for debugging token issues
        <ConvexProviderWithClerk
          client={convexClientInstance}
          useAuth={useAuthWithConvexDebug}
        >
          {children}
        </ConvexProviderWithClerk>
      ) : (
        // Convex not configured - AuthProvider requires ConvexProvider for its hooks
        // (useConvex, useMutation, useQuery). Rendering children without it would crash.
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
          }}
        >
          <Text
            style={{
              fontSize: 20,
              fontWeight: 'bold',
              color: '#333',
              textAlign: 'center',
              marginBottom: 10,
            }}
          >
            Backend Not Configured
          </Text>
          <Text style={{ fontSize: 18, color: '#666', textAlign: 'center' }}>
            CONVEX_URL is not set. Please configure the Convex backend URL to
            continue.
          </Text>
        </View>
      )}
    </ClerkProvider>
  );
};
