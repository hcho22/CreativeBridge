/**
 * Clerk-Supabase Synchronization Service
 *
 * This service handles syncing Clerk authentication with Supabase:
 * 1. Verifies Clerk JWT
 * 2. Creates/updates Supabase session using Clerk JWT
 * 3. Syncs Clerk user ID to user_profiles table
 * 4. Handles account linking when same email is used
 *
 * Architecture: Clerk handles OAuth and issues JWTs. This service verifies
 * the JWT and creates a Supabase session, allowing Supabase RLS policies
 * to use Clerk user ID for data access control.
 *
 * Account Linking:
 * - Clerk automatically handles account linking when the same email is used
 *   (case-insensitive). When a user signs in with OAuth using an email that
 *   already exists in Clerk, Clerk automatically links the new provider to
 *   the existing account.
 * - Multiple OAuth providers (Google + Apple) can be linked to the same
 *   Clerk account. Clerk handles this automatically - users can sign in with
 *   any linked provider and get the same Clerk user ID.
 * - This service syncs the Clerk user ID to Supabase profiles, enabling
 *   account linking between OAuth and email/password accounts in Supabase.
 */

import { supabase } from './supabase';
import { verifyClerkJWT } from './clerkJWTVerification';
import type { UserProfile } from '../types/database';

export interface ClerkSupabaseSyncResult {
  success: boolean;
  session?: any; // Supabase session
  user?: any; // Supabase user
  profile?: UserProfile;
  error?: string;
  errorType?:
    | 'ACCOUNT_LINKING_CONFLICT'
    | 'DATABASE_ERROR'
    | 'EMAIL_MISMATCH'
    | 'UNKNOWN';
}

/**
 * Create Supabase session from Clerk JWT
 * Note: Supabase doesn't natively support external JWT verification.
 * This function sets up the session structure, but full verification
 * should be done via Supabase Edge Function or custom auth endpoint.
 *
 * @param clerkJWT JWT token from Clerk
 * @param userEmail Optional email address from Clerk user (for account linking)
 * @returns Sync result with Supabase session
 */
export async function createSupabaseSessionFromClerkJWT(
  clerkJWT: string,
  userEmail?: string,
): Promise<ClerkSupabaseSyncResult> {
  try {
    // Verify Clerk JWT
    const verification = await verifyClerkJWT(clerkJWT);

    if (!verification.valid || !verification.userId) {
      return {
        success: false,
        error: verification.error || 'Invalid Clerk JWT',
      };
    }

    const clerkUserId = verification.userId;

    // Note: Supabase doesn't directly accept external JWTs.
    // In production, you should:
    // 1. Send Clerk JWT to Supabase Edge Function
    // 2. Edge Function verifies JWT against Clerk JWKS
    // 3. Edge Function creates Supabase session with Clerk user ID
    // 4. Return session to client

    // For now, we'll sync the Clerk user ID to the profile
    // The actual session creation should be done server-side

    // Extract email from claims if not provided
    const emailToUse =
      userEmail ||
      verification.claims?.email ||
      verification.claims?.sub?.email;

    // Find or create user profile with Clerk user ID (with account linking support)
    const profileResult = await syncClerkUserIdToProfile(
      clerkUserId,
      emailToUse,
      verification.claims,
    );

    if (!profileResult.success) {
      const errorMessage =
        profileResult.error || 'Failed to sync Clerk user ID to profile';
      console.error(
        '❌ [Account Linking] Failed to sync Clerk user ID:',
        errorMessage,
      );
      console.error(
        '❌ [Account Linking] Error type:',
        profileResult.errorType || 'UNKNOWN',
      );

      return {
        success: false,
        error: errorMessage,
        errorType: profileResult.errorType || 'UNKNOWN',
      };
    }

    return {
      success: true,
      profile: profileResult.profile,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to create Supabase session: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    };
  }
}

/**
 * Sync Clerk user ID to user_profiles table
 * This function handles account linking by:
 * 1. Checking if a profile already exists with this Clerk user ID
 * 2. If not, checking if a profile exists with the same email (account linking)
 * 3. Linking the existing profile to the Clerk user ID if found
 *
 * Note: Clerk automatically handles account linking when the same email is used.
 * This function syncs that linking to Supabase by updating the profile's clerk_user_id.
 *
 * @param clerkUserId Clerk user ID (format: user_xxxxx)
 * @param userEmail Optional email address from Clerk user (for account linking)
 * @param claims Optional JWT claims for additional user data
 * @returns Sync result with updated profile
 */
export async function syncClerkUserIdToProfile(
  clerkUserId: string,
  userEmail?: string,
  claims?: any,
): Promise<{
  success: boolean;
  profile?: UserProfile;
  error?: string;
  linked?: boolean;
  errorType?:
    | 'ACCOUNT_LINKING_CONFLICT'
    | 'DATABASE_ERROR'
    | 'EMAIL_MISMATCH'
    | 'UNKNOWN';
}> {
  try {
    console.log(
      `🔗 [Account Linking] Syncing Clerk user ID to profile: ${clerkUserId}`,
      userEmail ? `(email: ${userEmail})` : '',
    );

    // Step 1: Check if profile already exists with this Clerk user ID
    // This handles cases where:
    // - User has already linked their account
    // - User is signing in with a previously linked OAuth provider
    const { data: existingProfile, error: fetchError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('clerk_user_id', clerkUserId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 is "not found" - that's okay, we'll check for account linking
      console.error(
        '❌ [Account Linking] Error fetching profile by Clerk user ID:',
        fetchError,
      );
    }

    if (existingProfile) {
      console.log(
        '✅ [Account Linking] Profile already exists with Clerk user ID:',
        clerkUserId,
      );
      return {
        success: true,
        profile: existingProfile as UserProfile,
        linked: false, // Already linked, not a new link
      };
    }

    // Step 2: Account Linking - Attempt to link existing Supabase profile
    // Clerk automatically handles account linking when the same email is used.
    // We need to sync this to Supabase by finding any existing profile and
    // updating it with the Clerk user ID.
    //
    // Note: We can't directly query Supabase auth.users by email from the client.
    // Account linking will be handled when:
    // 1. User signs in with OAuth via Clerk (Clerk links accounts automatically)
    // 2. If there's an active Supabase session from email/password, we can link that profile
    // 3. Otherwise, profile will be created during profile completion (Task 5.1)
    const emailToCheck = userEmail || claims?.email || claims?.sub?.email;

    if (emailToCheck) {
      console.log(
        `🔍 [Account Linking] Attempting account linking for email: ${emailToCheck}`,
      );

      // Try to find if there's an active Supabase session (from email/password login)
      // If there is, we can link that profile to the Clerk user ID
      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (currentSession?.user) {
          const supabaseUserId = currentSession.user.id;
          const supabaseUserEmail = currentSession.user.email;

          // Check if the email matches (case-insensitive)
          // Clerk handles case-insensitive email matching automatically
          if (
            supabaseUserEmail &&
            supabaseUserEmail.toLowerCase() === emailToCheck.toLowerCase()
          ) {
            console.log(
              `🔗 [Account Linking] Found matching Supabase session for email: ${emailToCheck}`,
            );
            console.log(
              `🔗 [Account Linking] Linking Supabase profile (ID: ${supabaseUserId}) to Clerk user ID: ${clerkUserId}`,
            );

            // Find the profile for this Supabase user
            const { data: profileToLink, error: profileError } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('id', supabaseUserId)
              .single();

            if (profileError && profileError.code !== 'PGRST116') {
              console.error(
                '❌ [Account Linking] Error finding profile to link:',
                profileError,
              );
            } else if (profileToLink) {
              // Check if this profile is already linked to a different Clerk user
              if (
                profileToLink.clerk_user_id &&
                profileToLink.clerk_user_id !== clerkUserId
              ) {
                const errorMessage =
                  'Profile is already linked to a different Clerk account';
                console.warn(`⚠️ [Account Linking] ${errorMessage}`);
                console.warn(
                  `⚠️ [Account Linking] Existing Clerk user ID: ${profileToLink.clerk_user_id}`,
                );
                console.warn(
                  `⚠️ [Account Linking] Attempted Clerk user ID: ${clerkUserId}`,
                );
                console.warn(
                  `⚠️ [Account Linking] This may indicate an account conflict.`,
                );

                // Log account linking conflict for monitoring
                createAccountLinkingErrorLog(
                  'ACCOUNT_LINKING_CONFLICT',
                  errorMessage,
                  {
                    clerkUserId,
                    existingClerkUserId: profileToLink.clerk_user_id,
                    userEmail: userEmail || 'not provided',
                    profileId: profileToLink.id,
                  },
                );
                // Don't overwrite - Clerk should handle this case
                return {
                  success: false,
                  error: errorMessage,
                  errorType: 'ACCOUNT_LINKING_CONFLICT',
                };
              }

              // Update the profile with Clerk user ID
              const { data: updatedProfile, error: updateError } =
                await supabase
                  .from('user_profiles')
                  .update({ clerk_user_id: clerkUserId })
                  .eq('id', supabaseUserId)
                  .select()
                  .single();

              if (updateError) {
                const errorMessage = `Failed to link profile: ${updateError.message}`;
                console.error(
                  '❌ [Account Linking] Error updating profile with Clerk user ID:',
                  updateError,
                );
                console.error(
                  '❌ [Account Linking] Error code:',
                  updateError.code,
                );
                console.error(
                  '❌ [Account Linking] Error details:',
                  updateError.details,
                );
                console.error(
                  '❌ [Account Linking] Error hint:',
                  updateError.hint,
                );

                // Determine error type for better error handling
                let errorType:
                  | 'DATABASE_ERROR'
                  | 'ACCOUNT_LINKING_CONFLICT'
                  | 'UNKNOWN' = 'DATABASE_ERROR';
                const errorCode = updateError.code?.toLowerCase() || '';
                const errorMessageLower =
                  updateError.message?.toLowerCase() || '';

                if (
                  errorCode.includes('23505') || // Unique constraint violation
                  errorMessageLower.includes('unique') ||
                  errorMessageLower.includes('duplicate') ||
                  errorMessageLower.includes('constraint')
                ) {
                  errorType = 'ACCOUNT_LINKING_CONFLICT';
                  console.warn(
                    '⚠️ [Account Linking] Unique constraint violation detected - account may already be linked',
                  );

                  // Log constraint violation for monitoring
                  createAccountLinkingErrorLog(
                    'ACCOUNT_LINKING_CONFLICT',
                    errorMessage,
                    {
                      clerkUserId,
                      userEmail: userEmail || 'not provided',
                      errorCode: updateError.code,
                      errorDetails: updateError.details,
                    },
                  );
                } else {
                  // Log database error for monitoring
                  createAccountLinkingErrorLog('DATABASE_ERROR', errorMessage, {
                    clerkUserId,
                    userEmail: userEmail || 'not provided',
                    errorCode: updateError.code,
                    errorDetails: updateError.details,
                  });
                }

                return {
                  success: false,
                  error: errorMessage,
                  errorType,
                };
              }

              console.log(
                '✅ [Account Linking] Successfully linked existing profile to Clerk user ID',
              );
              return {
                success: true,
                profile: updatedProfile as UserProfile,
                linked: true, // This was a new link
              };
            } else {
              console.log(
                'ℹ️ [Account Linking] No profile found for Supabase user, will be created during profile completion',
              );
            }
          } else {
            console.log(
              `ℹ️ [Account Linking] Supabase session email (${supabaseUserEmail}) doesn't match OAuth email (${emailToCheck})`,
            );
          }
        } else {
          console.log(
            'ℹ️ [Account Linking] No active Supabase session found for account linking',
          );
        }
      } catch (sessionError) {
        console.error(
          '❌ [Account Linking] Error checking Supabase session:',
          sessionError,
        );
        // Continue - this is not a critical error, profile will be created later
      }

      console.log(
        'ℹ️ [Account Linking] Account linking check completed. Profile will be created during profile completion if needed.',
      );
    }

    // Step 3: Profile doesn't exist yet - it will be created during profile completion
    // For new OAuth users, the profile will be created in Task 5.1 (Profile Completion)
    console.log(
      '📋 [Account Linking] No existing profile found. Profile will be created during profile completion.',
    );
    return {
      success: true,
      linked: false,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error(
      '❌ [Account Linking] Unexpected error syncing Clerk user ID:',
      errorMessage,
    );
    if (errorStack) {
      console.error('❌ [Account Linking] Error stack:', errorStack);
    }
    console.error('❌ [Account Linking] Full error object:', error);

    // Log error for monitoring (in production, this would go to error tracking service)
    createAccountLinkingErrorLog('UNKNOWN', errorMessage, {
      clerkUserId,
      userEmail: userEmail || 'not provided',
    });

    return {
      success: false,
      error: `Failed to sync Clerk user ID: ${errorMessage}`,
      errorType: 'UNKNOWN',
    };
  }
}

/**
 * Update user profile with Clerk user ID
 * @param profileId Supabase user profile ID
 * @param clerkUserId Clerk user ID
 * @returns Updated profile
 */
export async function updateProfileWithClerkUserId(
  profileId: string,
  clerkUserId: string,
): Promise<{ success: boolean; profile?: UserProfile; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .update({ clerk_user_id: clerkUserId })
      .eq('id', profileId)
      .select()
      .single();

    if (error) {
      return {
        success: false,
        error: `Failed to update profile: ${error.message}`,
      };
    }

    return {
      success: true,
      profile: data as UserProfile,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to update profile: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    };
  }
}

/**
 * Find user profile by Clerk user ID
 * @param clerkUserId Clerk user ID
 * @returns User profile or null
 */
export async function findProfileByClerkUserId(
  clerkUserId: string,
): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('clerk_user_id', clerkUserId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return null;
      }
      throw error;
    }

    return data as UserProfile;
  } catch (error) {
    console.error('Error finding profile by Clerk user ID:', error);
    return null;
  }
}

/**
 * Check account linking status for a Clerk user
 * This function checks if a profile is linked to the given Clerk user ID
 * and provides information about the linking status.
 *
 * @param clerkUserId Clerk user ID
 * @returns Account linking status information
 */
export async function checkAccountLinkingStatus(clerkUserId: string): Promise<{
  isLinked: boolean;
  profile?: UserProfile;
  error?: string;
}> {
  try {
    console.log(
      `🔍 [Account Linking] Checking linking status for Clerk user ID: ${clerkUserId}`,
    );

    const profile = await findProfileByClerkUserId(clerkUserId);

    if (profile) {
      console.log(
        `✅ [Account Linking] Account is linked. Profile ID: ${profile.id}`,
      );
      return {
        isLinked: true,
        profile,
      };
    } else {
      console.log(
        `ℹ️ [Account Linking] Account is not yet linked. Profile will be created during profile completion.`,
      );
      return {
        isLinked: false,
      };
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error(
      '❌ [Account Linking] Error checking linking status:',
      errorMessage,
    );
    return {
      isLinked: false,
      error: errorMessage,
    };
  }
}

/**
 * Create a structured error log entry for account linking errors
 * This helps with monitoring and debugging account linking issues
 *
 * @param errorType Type of error that occurred
 * @param errorMessage Error message
 * @param context Additional context (clerkUserId, userEmail, etc.)
 * @returns Structured error log entry
 */
export function createAccountLinkingErrorLog(
  errorType:
    | 'ACCOUNT_LINKING_CONFLICT'
    | 'DATABASE_ERROR'
    | 'EMAIL_MISMATCH'
    | 'UNKNOWN',
  errorMessage: string,
  context?: {
    clerkUserId?: string;
    userEmail?: string;
    profileId?: string;
    [key: string]: any;
  },
): {
  errorType: string;
  errorMessage: string;
  timestamp: string;
  context: Record<string, any>;
} {
  const errorLog = {
    errorType,
    errorMessage,
    timestamp: new Date().toISOString(),
    context: {
      ...context,
    },
  };

  // Log for monitoring (in production, this would be sent to error tracking service)
  console.error('📊 [Account Linking] Error log entry:', errorLog);

  return errorLog;
}
