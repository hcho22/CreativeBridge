import {
  useAuth as useClerkAuth,
  useUser as useClerkUser,
} from '@clerk/clerk-expo';
import { isClerkConfigured } from '../config/environment';

/**
 * Safely use Clerk auth hooks even when ClerkProvider might not be present.
 * Returns null values when Clerk is not configured.
 *
 * Note: Hooks must be called unconditionally. If ClerkProvider is not present,
 * the hooks will throw an error, which is expected behavior.
 */
export function useSafeClerkAuth() {
  // Hooks must be called unconditionally at the top level
  const auth = useClerkAuth();
  const user = useClerkUser();

  // Check if Clerk is configured - if not, return null values
  const isConfigured = isClerkConfigured();

  if (!isConfigured) {
    return { clerkAuth: null, clerkUser: null };
  }

  return { clerkAuth: auth, clerkUser: user };
}
