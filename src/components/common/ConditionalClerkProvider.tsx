import React from 'react';
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
  // Check if Clerk is configured
  if (!isClerkConfigured()) {
    // Clerk is not configured, render children without ClerkProvider
    // Note: Components using Clerk hooks will need to handle this case
    return <>{children}</>;
  }

  // Get Clerk configuration
  let clerkPublishableKey: string;
  try {
    const clerkConfig = getClerkConfig();
    clerkPublishableKey = clerkConfig.publishableKey;
  } catch (error) {
    console.warn(
      '⚠️ Failed to get Clerk config, rendering without ClerkProvider:',
      error,
    );
    return <>{children}</>;
  }

  // Clerk is configured, wrap with ClerkProvider
  return (
    <ClerkProvider publishableKey={clerkPublishableKey}>
      {children}
    </ClerkProvider>
  );
};
