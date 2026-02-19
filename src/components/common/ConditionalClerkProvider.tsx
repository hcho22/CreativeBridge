import React, { useMemo } from 'react';
import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { isClerkConfigured, getClerkConfig } from '../../config/environment';
import { clerkTokenCache } from '../../utils/clerkTokenCache';
import { getConvexClient } from '../../services/convex';

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
        <ConvexProviderWithClerk
          client={convexClientInstance}
          useAuth={useAuth}
        >
          {children}
        </ConvexProviderWithClerk>
      ) : (
        // Convex not configured - render children without Convex
        children
      )}
    </ClerkProvider>
  );
};
