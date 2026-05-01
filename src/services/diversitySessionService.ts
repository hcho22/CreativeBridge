/**
 * Diversity Session Management Service
 *
 * Manages user sessions specifically for story diversity tracking.
 * This is separate from authentication sessions (sessionManager.ts) and focuses
 * on scoping story element history to 24-hour creative windows.
 *
 * Architecture:
 * - Uses user_sessions table created in US-001
 * - Stores session token in AsyncStorage (React Native doesn't support HTTP cookies)
 * - Links to authenticated users when available (auth.uid())
 * - Supports anonymous sessions for non-logged-in users
 * - 24-hour expiration window for diversity tracking scope
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

/**
 * Row / Insert shapes for the `user_sessions` table. The shared `Database`
 * type in `src/types/database.ts` does not satisfy postgrest-js's
 * `GenericSchema` constraint (its Row types lack the implicit
 * `Record<string, unknown>` index signature), so `supabase.from(
 * 'user_sessions')` resolves Row / Insert to `never`. We declare the shape
 * locally and apply it at the response boundary. Type-only — no runtime
 * change.
 */
interface UserSessionRow {
  id: string;
  session_token: string;
  user_id: string | null;
  created_at: string;
  expires_at: string;
  metadata: Record<string, unknown> | null;
}

interface UserSessionInsert {
  id?: string;
  session_token: string;
  user_id: string | null;
  created_at?: string;
  expires_at: string;
  metadata?: Record<string, unknown>;
}

const STORAGE_KEY = '@CreativeBridge:diversitySessionToken';
const SESSION_DURATION_HOURS = 24;

export interface DiversitySession {
  id: string;
  sessionToken: string;
  userId: string | null;
  createdAt: Date;
  expiresAt: Date;
  metadata?: Record<string, unknown>;
}

export interface CreateSessionOptions {
  userId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Get or create a diversity tracking session.
 *
 * Flow:
 * 1. Check AsyncStorage for existing session token
 * 2. If found, validate it's not expired and exists in database
 * 3. If valid, return existing session
 * 4. If invalid/missing, create new session and store token
 *
 * @param options - Optional user ID and metadata for session creation
 * @returns Promise<DiversitySession> - Active diversity session
 *
 * @example
 * // For authenticated users
 * const session = await getOrCreateSession({ userId: user.id });
 *
 * @example
 * // For anonymous users
 * const session = await getOrCreateSession();
 */
export async function getOrCreateSession(
  options: CreateSessionOptions = {},
): Promise<DiversitySession> {
  try {
    // Step 1: Check for existing session token in local storage
    const storedToken = await AsyncStorage.getItem(STORAGE_KEY);

    if (storedToken) {
      // Step 2: Validate existing session
      const existingSession = await validateSession(storedToken);

      if (existingSession) {
        // Session is valid and not expired
        return existingSession;
      }

      // Session is invalid or expired, will create new one below
      await AsyncStorage.removeItem(STORAGE_KEY);
    }

    // Step 3: Create new session
    const newSession = await createNewSession(options);

    // Step 4: Store token locally for future requests
    await AsyncStorage.setItem(STORAGE_KEY, newSession.sessionToken);

    return newSession;
  } catch (error) {
    console.error('Failed to get or create diversity session:', error);
    throw new Error(
      `Session management error: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    );
  }
}

/**
 * Validate an existing session token.
 *
 * Checks:
 * - Session exists in database
 * - Session has not expired (expires_at > now)
 *
 * @param sessionToken - Session token to validate
 * @returns Promise<DiversitySession | null> - Session if valid, null if invalid/expired
 */
async function validateSession(
  sessionToken: string,
): Promise<DiversitySession | null> {
  try {
    const { data, error } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('session_token', sessionToken)
      .single();

    if (error || !data) {
      // Session not found in database
      return null;
    }

    // postgrest-js infers `data` as `never` because our Database type doesn't
    // satisfy GenericSchema (see header). Cast at the boundary to the locally
    // declared row shape.
    const row = data as unknown as UserSessionRow;

    // Check if session has expired
    const expiresAt = new Date(row.expires_at);
    const now = new Date();

    if (now > expiresAt) {
      // Session expired
      return null;
    }

    // Session is valid
    return {
      id: row.id,
      sessionToken: row.session_token,
      userId: row.user_id,
      createdAt: new Date(row.created_at),
      expiresAt,
      metadata: row.metadata ?? undefined,
    };
  } catch (error) {
    console.error('Session validation error:', error);
    return null;
  }
}

/**
 * Create a new diversity tracking session.
 *
 * Generates a unique session token, stores in database with 24-hour expiration,
 * and optionally links to authenticated user.
 *
 * @param options - User ID and metadata for session
 * @returns Promise<DiversitySession> - Newly created session
 */
async function createNewSession(
  options: CreateSessionOptions,
): Promise<DiversitySession> {
  const sessionToken = generateSessionToken();
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + SESSION_DURATION_HOURS * 60 * 60 * 1000,
  );

  const insertPayload: UserSessionInsert = {
    session_token: sessionToken,
    user_id: options.userId || null,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    metadata: options.metadata || {},
  };

  const { data, error } = await supabase
    .from('user_sessions')
    // postgrest-js infers Insert as `never` because our Database type doesn't
    // satisfy GenericSchema (see header). Cast at the call boundary to keep
    // the strongly-typed payload defined above.
    .insert(insertPayload as unknown as never)
    .select()
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to create session: ${error?.message || 'Unknown error'}`,
    );
  }

  // Same `never` issue on the returned row — cast at the boundary.
  const row = data as unknown as UserSessionRow;

  return {
    id: row.id,
    sessionToken: row.session_token,
    userId: row.user_id,
    createdAt: new Date(row.created_at),
    expiresAt: new Date(row.expires_at),
    metadata: row.metadata ?? undefined,
  };
}

/**
 * Generate a unique session token.
 *
 * Format: div_sess_{timestamp}_{random}
 * - "div_sess" prefix identifies diversity sessions
 * - Timestamp ensures chronological ordering
 * - Random string ensures uniqueness
 *
 * @returns string - Unique session token
 */
function generateSessionToken(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 18); // 16 char random string
  return `div_sess_${timestamp}_${random}`;
}

/**
 * Get the current session token from storage without validation.
 * Useful for passing session ID to other services without database roundtrip.
 *
 * @returns Promise<string | null> - Session token if exists, null otherwise
 */
export async function getCurrentSessionToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to get current session token:', error);
    return null;
  }
}

/**
 * Clear the current diversity session.
 * Removes token from local storage but does NOT delete from database
 * (database cleanup handled by scheduled job).
 *
 * @returns Promise<void>
 */
export async function clearSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear session:', error);
    throw error;
  }
}

/**
 * Get or create session with automatic user context.
 * Convenience wrapper that automatically fetches current user from Supabase auth.
 *
 * @param metadata - Optional metadata to attach to session
 * @returns Promise<DiversitySession> - Active diversity session
 */
export async function getOrCreateSessionWithAuth(
  metadata?: Record<string, unknown>,
): Promise<DiversitySession> {
  try {
    // Get current authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return await getOrCreateSession({
      userId: user?.id,
      metadata,
    });
  } catch (error) {
    console.error('Failed to get session with auth:', error);
    throw error;
  }
}
