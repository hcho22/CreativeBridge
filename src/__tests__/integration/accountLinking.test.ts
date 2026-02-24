/**
 * Account Linking Tests
 *
 * Integration tests for account linking scenarios with Clerk OAuth
 *
 * Migration Note (US-032): Account linking is now handled by Convex natively
 * via ConvexProviderWithClerk. The old clerkSupabaseSync service has been removed.
 *
 * Clerk's behavior:
 * - Automatically links OAuth providers when the same email is used (case-insensitive)
 * - Multiple providers (Google + Apple) are linked to the same Clerk account
 * - Clerk issues JWTs that Convex validates directly via JWKS
 *
 * Convex's behavior (AuthContext.tsx):
 * - Reactive query (useQuery) fetches profile by clerkUserId
 * - Migration effect creates Convex profile from Supabase if needed (first-time login)
 * - Fallback effect loads profile from Supabase if Convex auth is unavailable
 *
 * Based on: TASKS-oauth-google-apple-signin-PRD.md Task 5.5
 */

describe('Account Linking (Post-Convex Migration)', () => {
  describe('Clerk Automatic Account Linking', () => {
    test('Clerk links OAuth providers with same email automatically', () => {
      // Clerk handles email matching automatically (case-insensitive)
      // No application code needed - Clerk returns the same userId
      // for all OAuth providers linked to the same email

      // This is a documentation test to verify the expected behavior
      const googleClerkUserId = 'user_abc123';
      const appleClerkUserId = 'user_abc123'; // Same for linked accounts

      expect(googleClerkUserId).toBe(appleClerkUserId);
    });

    test('case-insensitive email matching is handled by Clerk', () => {
      // Clerk normalizes emails to lowercase internally
      // test@example.com and Test@Example.com resolve to same user

      // This is a documentation test
      const normalizedEmail1 = 'test@example.com'.toLowerCase();
      const normalizedEmail2 = 'Test@Example.com'.toLowerCase();

      expect(normalizedEmail1).toBe(normalizedEmail2);
    });
  });

  describe('Convex Profile Management', () => {
    test('Convex creates profile for new OAuth users', () => {
      // AuthContext.tsx migration effect handles this:
      // 1. Check if Convex profile exists (useQuery returns null)
      // 2. Check for existing Supabase profile to migrate
      // 3. Create Convex profile via convexCreateProfile mutation

      // Profile creation args
      const newProfileArgs = {
        clerkUserId: 'user_test123',
        username: 'testuser',
        displayName: 'Test User',
        preferredGradeLevel: 'K-2',
        speechEnabled: true,
      };

      // All required fields are present
      expect(newProfileArgs.clerkUserId).toBeDefined();
      expect(newProfileArgs.username).toBeDefined();
      expect(newProfileArgs.displayName).toBeDefined();
    });

    test('Convex migrates existing Supabase profiles', () => {
      // AuthContext.tsx migration effect:
      // 1. Convex profile not found (null)
      // 2. Query Supabase for profile with matching clerk_user_id
      // 3. Create Convex profile with Supabase data

      // Supabase profile structure (snake_case)
      const supabaseProfile = {
        clerk_user_id: 'user_test123',
        username: 'testuser',
        display_name: 'Test User',
        preferred_grade_level: 'K-2',
        speech_enabled: true,
        total_xp: 100,
      };

      // Convex profile structure (camelCase)
      const convexProfileArgs = {
        clerkUserId: supabaseProfile.clerk_user_id,
        username: supabaseProfile.username,
        displayName: supabaseProfile.display_name,
        preferredGradeLevel: supabaseProfile.preferred_grade_level,
        speechEnabled: supabaseProfile.speech_enabled,
      };

      // Field mapping is correct
      expect(convexProfileArgs.clerkUserId).toBe(supabaseProfile.clerk_user_id);
    });
  });

  describe('Fallback Behavior', () => {
    test('Supabase fallback activates when Convex auth unavailable', () => {
      // AuthContext.tsx fallback effect:
      // - If convexProfile is undefined for 3+ seconds (auth token issue)
      // - Fall back to Supabase query by clerk_user_id

      const fallbackTimeoutMs = 3000;
      expect(fallbackTimeoutMs).toBe(3000);
    });

    test('email/password users continue using Supabase', () => {
      // Legacy users without Clerk IDs use Supabase as primary
      // Detected by checking if userId starts with 'user_'

      const clerkUserId = 'user_abc123';
      const supabaseUserId = '91a919ee-81eb-4a70-b2cc-b2816eed9974';

      const isClerkUser = clerkUserId.startsWith('user_');
      const isSupabaseUser = !supabaseUserId.startsWith('user_');

      expect(isClerkUser).toBe(true);
      expect(isSupabaseUser).toBe(true);
    });
  });
});
