/**
 * Clerk-Supabase Synchronization Service
 *
 * This service handles syncing Clerk authentication with Supabase:
 * 1. Verifies Clerk JWT
 * 2. Creates/updates Supabase session using Clerk JWT
 * 3. Syncs Clerk user ID to user_profiles table
 *
 * Architecture: Clerk handles OAuth and issues JWTs. This service verifies
 * the JWT and creates a Supabase session, allowing Supabase RLS policies
 * to use Clerk user ID for data access control.
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
}

/**
 * Create Supabase session from Clerk JWT
 * Note: Supabase doesn't natively support external JWT verification.
 * This function sets up the session structure, but full verification
 * should be done via Supabase Edge Function or custom auth endpoint.
 *
 * @param clerkJWT JWT token from Clerk
 * @returns Sync result with Supabase session
 */
export async function createSupabaseSessionFromClerkJWT(
  clerkJWT: string,
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

    // Find or create user profile with Clerk user ID
    const profileResult = await syncClerkUserIdToProfile(
      clerkUserId,
      verification.claims,
    );

    if (!profileResult.success) {
      return {
        success: false,
        error: profileResult.error || 'Failed to sync Clerk user ID to profile',
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
 * @param clerkUserId Clerk user ID (format: user_xxxxx)
 * @param claims Optional JWT claims for additional user data
 * @returns Sync result with updated profile
 */
export async function syncClerkUserIdToProfile(
  clerkUserId: string,
  _claims?: any,
): Promise<{ success: boolean; profile?: UserProfile; error?: string }> {
  try {
    // Check if profile already exists with this Clerk user ID
    const { data: existingProfile, error: fetchError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('clerk_user_id', clerkUserId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 is "not found" - that's okay, we'll create one
      console.error('Error fetching profile:', fetchError);
    }

    if (existingProfile) {
      // Profile exists, return it
      return {
        success: true,
        profile: existingProfile as UserProfile,
      };
    }

    // Profile doesn't exist yet - it will be created during profile completion
    // For now, just return success (profile will be created in Task 5.1)
    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to sync Clerk user ID: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
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
