import {
  useAuth as useClerkAuth,
  useUser as useClerkUser,
} from '@clerk/clerk-expo';
import { isClerkConfigured } from '../config/environment';

/**
 * Safely use Clerk auth hooks even when ClerkProvider might not be present.
 * Returns null values when Clerk is not configured.
 *
 * IMPORTANT: This hook must be used inside a component that is wrapped by
 * ConditionalClerkProvider. ConditionalClerkProvider ensures ClerkProvider
 * is present when Clerk is configured.
 *
 * If ClerkProvider is not in the component tree when this hook is called,
 * the hooks will throw an error that should be caught by an ErrorBoundary.
 */
export function useSafeClerkAuth() {
  // Hooks must be called unconditionally at the top level (React rules requirement)
  // ConditionalClerkProvider ensures ClerkProvider is present when Clerk is configured,
  // so these hooks will work correctly when needed.
  // If ClerkProvider is not in the component tree when Clerk is configured,
  // these will throw synchronously during render, which will be caught by ErrorBoundary.
  const auth = useClerkAuth();
  const user = useClerkUser();

  // Check if Clerk is configured - if not, return null values
  // This allows components to check if Clerk is available
  const isConfigured = isClerkConfigured();

  if (!isConfigured) {
    return { clerkAuth: null, clerkUser: null };
  }

  return { clerkAuth: auth, clerkUser: user };
}
