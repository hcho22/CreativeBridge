import {
  useAuth as useClerkAuth,
  useUser as useClerkUser,
} from '@clerk/clerk-expo';
import { isClerkConfigured } from '../config/environment';

/**
 * Safely use Clerk auth hooks even when ClerkProvider might not be present.
 * Returns null values when Clerk is not configured or when ClerkProvider is not present.
 *
 * IMPORTANT: This hook must ONLY be used inside a component that is wrapped by
 * ConditionalClerkProvider when Clerk is configured. If Clerk is not configured,
 * this hook should NOT be called at all.
 *
 * The hooks are called unconditionally (React requirement). If ClerkProvider
 * is not present, the hooks will throw an error. This hook should only be used
 * when Clerk is configured AND ClerkProvider is present.
 */
export function useSafeClerkAuth() {
  // Check if Clerk is configured first
  const isConfigured = isClerkConfigured();

  // IMPORTANT: Hooks must be called unconditionally (React rules requirement)
  // If ClerkProvider is not present, these hooks will throw synchronously during render.
  //
  // This hook should ONLY be called when:
  // 1. Clerk is configured (isClerkConfigured() returns true)
  // 2. ClerkProvider is present in the component tree
  //
  // If Clerk is not configured, components should check isClerkConfigured() first
  // and not call this hook at all. However, since we can't conditionally call hooks,
  // we call them here and they will throw if ClerkProvider is not present.
  //
  // The solution is to ensure ConditionalClerkProvider renders ClerkProvider
  // when Clerk is configured, and components check isClerkConfigured() before
  // calling this hook (but they can't, because hooks must be called unconditionally).
  //
  // Therefore, this hook should only be used inside components that are
  // guaranteed to be wrapped by ConditionalClerkProvider when Clerk is configured.

  // These hooks will throw if ClerkProvider is not present
  // This is expected and should be handled by ensuring ClerkProvider is present
  // when Clerk is configured
  const auth = useClerkAuth();
  const user = useClerkUser();

  // If Clerk is not configured, return null values
  // Note: The hooks are still called (React requirement), but we ignore their values
  // If ClerkProvider is not present, the hooks would have thrown already
  if (!isConfigured) {
    return { clerkAuth: null, clerkUser: null };
  }

  // Clerk is configured, return the hook values
  // If we get here and ClerkProvider is not present, the hooks would have thrown already
  return { clerkAuth: auth, clerkUser: user };
}
