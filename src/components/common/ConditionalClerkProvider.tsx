import React, { useMemo } from 'react';
import { ClerkProvider } from '@clerk/clerk-expo';
import { isClerkConfigured, getClerkConfig } from '../../config/environment';

interface ConditionalClerkProviderProps {
  children: React.ReactNode;
}

/**
 * Conditionally wraps children with ClerkProvider only when Clerk is properly configured.
 * When Clerk is not configured, it just renders children without the provider.
 * This prevents hook errors when Clerk hooks are used but ClerkProvider is not present.
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

  // If Clerk is not configured, render children without ClerkProvider
  if (!clerkConfig) {
    return <>{children}</>;
  }

  // Clerk is configured, wrap with ClerkProvider
  return (
    <ClerkProvider publishableKey={clerkConfig.publishableKey}>
      {children}
    </ClerkProvider>
  );
};
