/**
 * Tests for Diversity Session Service
 *
 * Covers:
 * - Session creation for authenticated and anonymous users
 * - Session validation and expiration checking
 * - Session token storage in AsyncStorage
 * - Session reuse when valid
 * - Error handling and edge cases
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getOrCreateSession,
  getCurrentSessionToken,
  clearSession,
  getOrCreateSessionWithAuth,
} from '../../services/diversitySessionService';
import { supabase } from '../../services/supabase';

// Mock dependencies
jest.mock('../../services/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      getUser: jest.fn(),
    },
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('diversitySessionService', () => {
  const mockUserId = 'user-123';
  const mockSessionToken = 'div_sess_1234567890_abcdefghij';
  const mockSessionId = 'session-uuid-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getOrCreateSession', () => {
    describe('when no existing session', () => {
      beforeEach(() => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      });

      it('creates new session for authenticated user', async () => {
        const mockInsert = jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: mockSessionId,
                session_token: mockSessionToken,
                user_id: mockUserId,
                created_at: new Date().toISOString(),
                expires_at: new Date(
                  Date.now() + 24 * 60 * 60 * 1000,
                ).toISOString(),
                metadata: {},
              },
              error: null,
            }),
          }),
        });

        (supabase.from as jest.Mock).mockReturnValue({
          insert: mockInsert,
        });

        const session = await getOrCreateSession({ userId: mockUserId });

        expect(session.userId).toBe(mockUserId);
        expect(session.sessionToken).toBeTruthy();
        expect(session.expiresAt).toBeInstanceOf(Date);
        expect(mockInsert).toHaveBeenCalledWith(
          expect.objectContaining({
            user_id: mockUserId,
          }),
        );
      });

      it('creates new session for anonymous user (no user_id)', async () => {
        const mockInsert = jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: mockSessionId,
                session_token: mockSessionToken,
                user_id: null,
                created_at: new Date().toISOString(),
                expires_at: new Date(
                  Date.now() + 24 * 60 * 60 * 1000,
                ).toISOString(),
                metadata: {},
              },
              error: null,
            }),
          }),
        });

        (supabase.from as jest.Mock).mockReturnValue({
          insert: mockInsert,
        });

        const session = await getOrCreateSession();

        expect(session.userId).toBeNull();
        expect(session.sessionToken).toBeTruthy();
        expect(mockInsert).toHaveBeenCalledWith(
          expect.objectContaining({
            user_id: null,
          }),
        );
      });

      it('stores session token in AsyncStorage after creation', async () => {
        const mockInsert = jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: mockSessionId,
                session_token: mockSessionToken,
                user_id: mockUserId,
                created_at: new Date().toISOString(),
                expires_at: new Date(
                  Date.now() + 24 * 60 * 60 * 1000,
                ).toISOString(),
                metadata: {},
              },
              error: null,
            }),
          }),
        });

        (supabase.from as jest.Mock).mockReturnValue({
          insert: mockInsert,
        });

        await getOrCreateSession({ userId: mockUserId });

        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          '@CreativeBridge:diversitySessionToken',
          mockSessionToken,
        );
      });

      it('includes custom metadata in session', async () => {
        const metadata = { deviceType: 'iOS', appVersion: '1.0.0' };

        const mockInsert = jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: mockSessionId,
                session_token: mockSessionToken,
                user_id: mockUserId,
                created_at: new Date().toISOString(),
                expires_at: new Date(
                  Date.now() + 24 * 60 * 60 * 1000,
                ).toISOString(),
                metadata,
              },
              error: null,
            }),
          }),
        });

        (supabase.from as jest.Mock).mockReturnValue({
          insert: mockInsert,
        });

        const session = await getOrCreateSession({
          userId: mockUserId,
          metadata,
        });

        expect(session.metadata).toEqual(metadata);
        expect(mockInsert).toHaveBeenCalledWith(
          expect.objectContaining({
            metadata,
          }),
        );
      });

      it('sets expiration to 24 hours from creation', async () => {
        const beforeCreation = Date.now();

        const mockInsert = jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: mockSessionId,
                session_token: mockSessionToken,
                user_id: mockUserId,
                created_at: new Date().toISOString(),
                expires_at: new Date(
                  Date.now() + 24 * 60 * 60 * 1000,
                ).toISOString(),
                metadata: {},
              },
              error: null,
            }),
          }),
        });

        (supabase.from as jest.Mock).mockReturnValue({
          insert: mockInsert,
        });

        const session = await getOrCreateSession({ userId: mockUserId });

        const afterCreation = Date.now();
        const expectedExpiration = 24 * 60 * 60 * 1000; // 24 hours in ms
        const actualDuration =
          session.expiresAt.getTime() - session.createdAt.getTime();

        // Allow 1 second tolerance for test execution time
        expect(actualDuration).toBeGreaterThanOrEqual(
          expectedExpiration - 1000,
        );
        expect(actualDuration).toBeLessThanOrEqual(expectedExpiration + 1000);
      });
    });

    describe('when existing valid session', () => {
      it('reuses valid session without creating new one', async () => {
        const existingToken = 'div_sess_existing_token';
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(existingToken);

        const mockSelect = jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: mockSessionId,
                session_token: existingToken,
                user_id: mockUserId,
                created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
                expires_at: new Date(
                  Date.now() + 23 * 60 * 60 * 1000,
                ).toISOString(), // 23 hours from now
                metadata: {},
              },
              error: null,
            }),
          }),
        });

        const mockInsert = jest.fn();

        (supabase.from as jest.Mock).mockReturnValue({
          select: mockSelect,
          insert: mockInsert,
        });

        const session = await getOrCreateSession({ userId: mockUserId });

        expect(session.sessionToken).toBe(existingToken);
        expect(mockSelect).toHaveBeenCalled();
        expect(mockInsert).not.toHaveBeenCalled(); // Should NOT create new session
      });

      it('does not update AsyncStorage for existing valid session', async () => {
        const existingToken = 'div_sess_existing_token';
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(existingToken);

        const mockSelect = jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: mockSessionId,
                session_token: existingToken,
                user_id: mockUserId,
                created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
                expires_at: new Date(
                  Date.now() + 23 * 60 * 60 * 1000,
                ).toISOString(),
                metadata: {},
              },
              error: null,
            }),
          }),
        });

        (supabase.from as jest.Mock).mockReturnValue({
          select: mockSelect,
        });

        // Clear the setItem mock from beforeEach
        (AsyncStorage.setItem as jest.Mock).mockClear();

        await getOrCreateSession({ userId: mockUserId });

        expect(AsyncStorage.setItem).not.toHaveBeenCalled();
      });
    });

    describe('when existing expired session', () => {
      it('creates new session when stored session has expired', async () => {
        const expiredToken = 'div_sess_expired_token';
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(expiredToken);

        // Mock validation query - returns expired session
        const mockSelect = jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: mockSessionId,
                session_token: expiredToken,
                user_id: mockUserId,
                created_at: new Date(
                  Date.now() - 25 * 60 * 60 * 1000,
                ).toISOString(), // 25 hours ago
                expires_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago (EXPIRED)
                metadata: {},
              },
              error: null,
            }),
          }),
        });

        // Mock insert for new session
        const mockInsert = jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'new-session-id',
                session_token: 'div_sess_new_token',
                user_id: mockUserId,
                created_at: new Date().toISOString(),
                expires_at: new Date(
                  Date.now() + 24 * 60 * 60 * 1000,
                ).toISOString(),
                metadata: {},
              },
              error: null,
            }),
          }),
        });

        (supabase.from as jest.Mock).mockReturnValue({
          select: mockSelect,
          insert: mockInsert,
        });

        const session = await getOrCreateSession({ userId: mockUserId });

        expect(session.sessionToken).not.toBe(expiredToken);
        expect(mockInsert).toHaveBeenCalled(); // Should create new session
        expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
          '@CreativeBridge:diversitySessionToken',
        ); // Should remove expired token
      });
    });

    describe('error handling', () => {
      it('throws error when database insert fails', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

        const mockInsert = jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database connection failed' },
            }),
          }),
        });

        (supabase.from as jest.Mock).mockReturnValue({
          insert: mockInsert,
        });

        await expect(
          getOrCreateSession({ userId: mockUserId }),
        ).rejects.toThrow('Session management error');
      });

      it('handles AsyncStorage read failure gracefully', async () => {
        (AsyncStorage.getItem as jest.Mock).mockRejectedValue(
          new Error('Storage read error'),
        );

        await expect(getOrCreateSession()).rejects.toThrow(
          'Session management error',
        );
      });
    });
  });

  describe('getCurrentSessionToken', () => {
    it('returns stored session token', async () => {
      const token = 'div_sess_test_token';
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(token);

      const result = await getCurrentSessionToken();

      expect(result).toBe(token);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(
        '@CreativeBridge:diversitySessionToken',
      );
    });

    it('returns null when no token stored', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const result = await getCurrentSessionToken();

      expect(result).toBeNull();
    });

    it('returns null on storage error', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(
        new Error('Storage error'),
      );

      const result = await getCurrentSessionToken();

      expect(result).toBeNull();
    });
  });

  describe('clearSession', () => {
    it('removes session token from AsyncStorage', async () => {
      await clearSession();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
        '@CreativeBridge:diversitySessionToken',
      );
    });

    it('throws error if storage removal fails', async () => {
      (AsyncStorage.removeItem as jest.Mock).mockRejectedValue(
        new Error('Storage error'),
      );

      await expect(clearSession()).rejects.toThrow('Storage error');
    });
  });

  describe('getOrCreateSessionWithAuth', () => {
    it('creates session with authenticated user ID', async () => {
      const mockGetUser = jest.fn().mockResolvedValue({
        data: { user: { id: mockUserId } },
      });

      (supabase.auth.getUser as jest.Mock) = mockGetUser;

      const mockInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: mockSessionId,
              session_token: mockSessionToken,
              user_id: mockUserId,
              created_at: new Date().toISOString(),
              expires_at: new Date(
                Date.now() + 24 * 60 * 60 * 1000,
              ).toISOString(),
              metadata: {},
            },
            error: null,
          }),
        }),
      });

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
      });

      const session = await getOrCreateSessionWithAuth();

      expect(session.userId).toBe(mockUserId);
      expect(mockGetUser).toHaveBeenCalled();
    });

    it('creates session without user ID when not authenticated', async () => {
      const mockGetUser = jest.fn().mockResolvedValue({
        data: { user: null },
      });

      (supabase.auth.getUser as jest.Mock) = mockGetUser;

      const mockInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: mockSessionId,
              session_token: mockSessionToken,
              user_id: null,
              created_at: new Date().toISOString(),
              expires_at: new Date(
                Date.now() + 24 * 60 * 60 * 1000,
              ).toISOString(),
              metadata: {},
            },
            error: null,
          }),
        }),
      });

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
      });

      const session = await getOrCreateSessionWithAuth();

      expect(session.userId).toBeNull();
    });

    it('includes custom metadata in authenticated session', async () => {
      const metadata = { feature: 'storyGeneration' };
      const mockGetUser = jest.fn().mockResolvedValue({
        data: { user: { id: mockUserId } },
      });

      (supabase.auth.getUser as jest.Mock) = mockGetUser;

      const mockInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: mockSessionId,
              session_token: mockSessionToken,
              user_id: mockUserId,
              created_at: new Date().toISOString(),
              expires_at: new Date(
                Date.now() + 24 * 60 * 60 * 1000,
              ).toISOString(),
              metadata,
            },
            error: null,
          }),
        }),
      });

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
      });

      const session = await getOrCreateSessionWithAuth(metadata);

      expect(session.metadata).toEqual(metadata);
    });
  });

  describe('session token generation', () => {
    it('generates unique tokens for multiple sessions', async () => {
      const tokens = new Set<string>();

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      for (let i = 0; i < 10; i++) {
        const mockInsert = jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: `session-${i}`,
                session_token: `div_sess_${Date.now()}_${Math.random()
                  .toString(36)
                  .substring(2, 18)}`,
                user_id: mockUserId,
                created_at: new Date().toISOString(),
                expires_at: new Date(
                  Date.now() + 24 * 60 * 60 * 1000,
                ).toISOString(),
                metadata: {},
              },
              error: null,
            }),
          }),
        });

        (supabase.from as jest.Mock).mockReturnValue({
          insert: mockInsert,
        });

        const session = await getOrCreateSession({ userId: mockUserId });
        tokens.add(session.sessionToken);
      }

      expect(tokens.size).toBe(10); // All tokens should be unique
    });

    it('generates tokens with correct prefix', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const mockInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: mockSessionId,
              session_token: mockSessionToken,
              user_id: mockUserId,
              created_at: new Date().toISOString(),
              expires_at: new Date(
                Date.now() + 24 * 60 * 60 * 1000,
              ).toISOString(),
              metadata: {},
            },
            error: null,
          }),
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
      });

      const session = await getOrCreateSession({ userId: mockUserId });

      expect(session.sessionToken).toMatch(/^div_sess_/);
    });
  });
});
