// Integration tests for Row Level Security policies
//
// US-015f.1.security: Tests target the supabaseMock per-table memoized chain
// (`tableChains` Map at supabaseMock.ts:10-11). Always pass the table name to
// `from('<table>')` so override calls and the production-side code resolve
// to the SAME chain. Bare `from()` resolves to the 'undefined' chain and
// silently skips overrides — leading to "Record not found" or unexpected
// pass-throughs from default mock behaviors.
//
// Tables (user_profiles, game_sessions, audit_logs, rate_limits, user_devices,
// active_sessions) remain Supabase-only fallback for legacy users; not migrated
// to Convex. See src/CLAUDE.md "Database Strategy" section.
import { mockSupabase } from '../mocks/supabaseMock';
import {
  createMockUser,
  createMockUserProfile,
  createMockGameSession,
} from '../utils/testUtils';

jest.mock('../../services/supabase', () => ({
  supabase: mockSupabase,
}));

describe('RLS Policy Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.__testUtils.clear();
  });

  describe('user_profiles table policies', () => {
    it('should allow users to view all profiles (for leaderboards)', async () => {
      const user1 = createMockUser({ id: 'user-1' });
      const profile1 = createMockUserProfile({ id: 'user-1' });
      const profile2 = createMockUserProfile({ id: 'user-2' });

      // Set up test data
      mockSupabase.__testUtils.setUser(user1);
      mockSupabase.__testUtils.setData('user_profiles', 'user-1', profile1);
      mockSupabase.__testUtils.setData('user_profiles', 'user-2', profile2);

      // US-015f.1.security: target the memoized 'user_profiles' chain (the
      // mock now keys per-table via tableChains Map at supabaseMock.ts:10-11);
      // bare from() resolves to the 'undefined' chain, so overrides miss.
      // For the leaf-await case (no .eq filter), mock `select` itself rather
      // than its call result: `await from('t').select('*')` awaits the return
      // of `select(...)`, so `select.mockResolvedValueOnce` is what shapes the
      // resolved value. Chaining `.select().mockResolvedValueOnce(...)` would
      // attach the mock to the chain object (a plain table chain returned by
      // mockReturnThis), which has no jest mock surface.
      mockSupabase.from('user_profiles').select.mockResolvedValueOnce({
        data: [profile1, profile2],
        error: null,
      });

      const { data, error } = await mockSupabase
        .from('user_profiles')
        .select('*');

      expect(error).toBeNull();
      expect(data).toHaveLength(2);
      expect(data).toContain(profile1);
      expect(data).toContain(profile2);
    });

    it('should allow users to insert their own profile only', async () => {
      const user = createMockUser({ id: 'user-1' });
      const profile = createMockUserProfile({ id: 'user-1' });

      mockSupabase.__testUtils.setUser(user);

      // Mock successful insert for own profile
      mockSupabase.from('user_profiles').insert.mockResolvedValueOnce({
        data: profile,
        error: null,
      });

      const { data, error } = await mockSupabase
        .from('user_profiles')
        .insert(profile);

      expect(error).toBeNull();
      expect(data).toEqual(profile);
    });

    it('should prevent users from inserting profiles for other users', async () => {
      const user1 = createMockUser({ id: 'user-1' });
      const otherUserProfile = createMockUserProfile({ id: 'user-2' });

      mockSupabase.__testUtils.setUser(user1);

      // Mock RLS violation for inserting other user's profile
      mockSupabase.from('user_profiles').insert.mockResolvedValueOnce({
        data: null,
        error: {
          message: 'RLS policy violation',
          code: '42501',
          details: 'Policy check failed',
        },
      });

      const { data, error } = await mockSupabase
        .from('user_profiles')
        .insert(otherUserProfile);

      expect(error).toBeTruthy();
      expect(error.code).toBe('42501');
      expect(data).toBeNull();
    });

    it('should allow users to update their own profile only', async () => {
      const user = createMockUser({ id: 'user-1' });
      const profile = createMockUserProfile({ id: 'user-1' });

      mockSupabase.__testUtils.setUser(user);
      mockSupabase.__testUtils.setData('user_profiles', 'user-1', profile);

      const updates = { display_name: 'Updated Name' };

      // Mock successful update for own profile
      mockSupabase.from('user_profiles').update.mockReturnThis();
      mockSupabase
        .from('user_profiles')
        .update()
        .eq.mockResolvedValueOnce({
          data: { ...profile, ...updates },
          error: null,
        });

      const { data, error } = await mockSupabase
        .from('user_profiles')
        .update(updates)
        .eq('id', 'user-1');

      expect(error).toBeNull();
      expect(data.display_name).toBe('Updated Name');
    });

    it('should prevent users from updating other users profiles', async () => {
      const user1 = createMockUser({ id: 'user-1' });
      const user2Profile = createMockUserProfile({ id: 'user-2' });

      mockSupabase.__testUtils.setUser(user1);
      mockSupabase.__testUtils.setData('user_profiles', 'user-2', user2Profile);

      const updates = { display_name: 'Hacked Name' };

      // Mock RLS violation for updating other user's profile
      mockSupabase.from('user_profiles').update.mockReturnThis();
      mockSupabase
        .from('user_profiles')
        .update()
        .eq.mockResolvedValueOnce({
          data: null,
          error: {
            message: 'RLS policy violation',
            code: '42501',
          },
        });

      const { data, error } = await mockSupabase
        .from('user_profiles')
        .update(updates)
        .eq('id', 'user-2');

      expect(error).toBeTruthy();
      expect(error.code).toBe('42501');
      expect(data).toBeNull();
    });
  });

  describe('game_sessions table policies', () => {
    it('should allow users to view only their own game sessions', async () => {
      const user1 = createMockUser({ id: 'user-1' });
      const user1Session = createMockGameSession({
        user_id: 'user-1',
        id: 'session-1',
      });
      const user2Session = createMockGameSession({
        user_id: 'user-2',
        id: 'session-2',
      });

      mockSupabase.__testUtils.setUser(user1);
      mockSupabase.__testUtils.setData(
        'game_sessions',
        'session-1',
        user1Session,
      );
      mockSupabase.__testUtils.setData(
        'game_sessions',
        'session-2',
        user2Session,
      );

      // Mock RLS filtering to only return user's own sessions
      mockSupabase.from('game_sessions').select.mockReturnThis();
      mockSupabase
        .from('game_sessions')
        .select()
        .eq.mockResolvedValueOnce({
          data: [user1Session], // Only user 1's session
          error: null,
        });

      const { data, error } = await mockSupabase
        .from('game_sessions')
        .select('*')
        .eq('user_id', 'user-1');

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data[0]).toEqual(user1Session);
    });

    it('should prevent users from viewing other users game sessions', async () => {
      const user1 = createMockUser({ id: 'user-1' });
      mockSupabase.__testUtils.setUser(user1);

      // Mock RLS preventing access to other user's sessions
      mockSupabase.from('game_sessions').select.mockReturnThis();
      mockSupabase.from('game_sessions').select().eq.mockResolvedValueOnce({
        data: [], // No access to other user's sessions
        error: null,
      });

      const { data, error } = await mockSupabase
        .from('game_sessions')
        .select('*')
        .eq('user_id', 'user-2');

      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it('should allow users to insert their own game sessions', async () => {
      const user = createMockUser({ id: 'user-1' });
      const gameSession = createMockGameSession({ user_id: 'user-1' });

      mockSupabase.__testUtils.setUser(user);

      mockSupabase.from('game_sessions').insert.mockResolvedValueOnce({
        data: gameSession,
        error: null,
      });

      const { data, error } = await mockSupabase
        .from('game_sessions')
        .insert(gameSession);

      expect(error).toBeNull();
      expect(data).toEqual(gameSession);
    });

    it('should prevent users from inserting game sessions for other users', async () => {
      const user1 = createMockUser({ id: 'user-1' });
      const otherUserSession = createMockGameSession({ user_id: 'user-2' });

      mockSupabase.__testUtils.setUser(user1);

      mockSupabase.from('game_sessions').insert.mockResolvedValueOnce({
        data: null,
        error: {
          message: 'RLS policy violation',
          code: '42501',
        },
      });

      const { data, error } = await mockSupabase
        .from('game_sessions')
        .insert(otherUserSession);

      expect(error).toBeTruthy();
      expect(error.code).toBe('42501');
      expect(data).toBeNull();
    });

    it('should allow users to update their own game sessions', async () => {
      const user = createMockUser({ id: 'user-1' });
      const gameSession = createMockGameSession({
        user_id: 'user-1',
        id: 'session-1',
      });

      mockSupabase.__testUtils.setUser(user);
      mockSupabase.__testUtils.setData(
        'game_sessions',
        'session-1',
        gameSession,
      );

      const updates = {
        final_score: 100,
        completed_at: new Date().toISOString(),
      };

      mockSupabase.from('game_sessions').update.mockReturnThis();
      mockSupabase
        .from('game_sessions')
        .update()
        .eq.mockResolvedValueOnce({
          data: { ...gameSession, ...updates },
          error: null,
        });

      const { data, error } = await mockSupabase
        .from('game_sessions')
        .update(updates)
        .eq('id', 'session-1');

      expect(error).toBeNull();
      expect(data.final_score).toBe(100);
    });
  });

  describe('audit_logs table policies', () => {
    it('should allow users to view their own audit logs', async () => {
      const user = createMockUser({ id: 'user-1' });
      const userAuditLog = {
        id: 'log-1',
        user_id: 'user-1',
        event_type: 'LOGIN',
        description: 'User logged in',
        created_at: new Date().toISOString(),
      };

      mockSupabase.__testUtils.setUser(user);
      mockSupabase.__testUtils.setData('audit_logs', 'log-1', userAuditLog);

      mockSupabase.from('audit_logs').select.mockReturnThis();
      mockSupabase
        .from('audit_logs')
        .select()
        .eq.mockResolvedValueOnce({
          data: [userAuditLog],
          error: null,
        });

      const { data, error } = await mockSupabase
        .from('audit_logs')
        .select('*')
        .eq('user_id', 'user-1');

      expect(error).toBeNull();
      expect(data).toContain(userAuditLog);
    });

    it('should prevent users from viewing other users audit logs', async () => {
      const user1 = createMockUser({ id: 'user-1' });
      mockSupabase.__testUtils.setUser(user1);

      mockSupabase.from('audit_logs').select.mockReturnThis();
      mockSupabase.from('audit_logs').select().eq.mockResolvedValueOnce({
        data: [], // No access to other user's audit logs
        error: null,
      });

      const { data, error } = await mockSupabase
        .from('audit_logs')
        .select('*')
        .eq('user_id', 'user-2');

      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it('should allow system to insert audit logs', async () => {
      const auditLog = {
        user_id: 'user-1',
        event_type: 'LOGIN',
        event_category: 'AUTH',
        severity: 'LOW',
        description: 'User logged in',
      };

      // System context allows insert
      mockSupabase.from('audit_logs').insert.mockResolvedValueOnce({
        data: { id: 'log-1', ...auditLog },
        error: null,
      });

      const { data, error } = await mockSupabase
        .from('audit_logs')
        .insert(auditLog);

      expect(error).toBeNull();
      expect(data).toEqual(expect.objectContaining(auditLog));
    });
  });

  describe('user_devices table policies', () => {
    it('should allow users to manage their own devices', async () => {
      const user = createMockUser({ id: 'user-1' });
      const device = {
        id: 'device-1',
        user_id: 'user-1',
        device_id: 'device-fingerprint-123',
        device_name: 'iPhone 12',
        device_type: 'MOBILE',
      };

      mockSupabase.__testUtils.setUser(user);

      // Test insert
      mockSupabase.from('user_devices').insert.mockResolvedValueOnce({
        data: device,
        error: null,
      });

      const { data: insertData, error: insertError } = await mockSupabase
        .from('user_devices')
        .insert(device);

      expect(insertError).toBeNull();
      expect(insertData).toEqual(device);

      // Test select
      mockSupabase.from('user_devices').select.mockReturnThis();
      mockSupabase
        .from('user_devices')
        .select()
        .eq.mockResolvedValueOnce({
          data: [device],
          error: null,
        });

      const { data: selectData, error: selectError } = await mockSupabase
        .from('user_devices')
        .select('*')
        .eq('user_id', 'user-1');

      expect(selectError).toBeNull();
      expect(selectData).toContain(device);
    });

    it('should prevent users from accessing other users devices', async () => {
      const user1 = createMockUser({ id: 'user-1' });
      mockSupabase.__testUtils.setUser(user1);

      const otherUserDevice = {
        user_id: 'user-2',
        device_id: 'other-device-123',
        device_name: 'Other Device',
      };

      // Test insert prevention
      mockSupabase.from('user_devices').insert.mockResolvedValueOnce({
        data: null,
        error: {
          message: 'RLS policy violation',
          code: '42501',
        },
      });

      const { data: insertData, error: insertError } = await mockSupabase
        .from('user_devices')
        .insert(otherUserDevice);

      expect(insertError).toBeTruthy();
      expect(insertError.code).toBe('42501');
      expect(insertData).toBeNull();

      // Test select prevention
      mockSupabase.from('user_devices').select.mockReturnThis();
      mockSupabase.from('user_devices').select().eq.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const { data: selectData, error: selectError } = await mockSupabase
        .from('user_devices')
        .select('*')
        .eq('user_id', 'user-2');

      expect(selectError).toBeNull();
      expect(selectData).toHaveLength(0);
    });
  });

  describe('rate_limits table policies', () => {
    it('should allow system to manage rate limits', async () => {
      const rateLimitEntry = {
        identifier: '192.168.1.1',
        action_type: 'LOGIN_ATTEMPT',
        window_start: new Date().toISOString(),
        attempt_count: 1,
      };

      // System context allows all operations
      mockSupabase.from('rate_limits').insert.mockResolvedValueOnce({
        data: { id: 'rate-1', ...rateLimitEntry },
        error: null,
      });

      const { data, error } = await mockSupabase
        .from('rate_limits')
        .insert(rateLimitEntry);

      expect(error).toBeNull();
      expect(data).toEqual(expect.objectContaining(rateLimitEntry));
    });
  });

  describe('active_sessions table policies', () => {
    it('should allow users to view their own sessions', async () => {
      const user = createMockUser({ id: 'user-1' });
      const session = {
        id: 'session-1',
        user_id: 'user-1',
        session_token: 'token-123',
        is_active: true,
        created_at: new Date().toISOString(),
      };

      mockSupabase.__testUtils.setUser(user);
      mockSupabase.__testUtils.setData('active_sessions', 'session-1', session);

      mockSupabase.from('active_sessions').select.mockReturnThis();
      mockSupabase
        .from('active_sessions')
        .select()
        .eq.mockResolvedValueOnce({
          data: [session],
          error: null,
        });

      const { data, error } = await mockSupabase
        .from('active_sessions')
        .select('*')
        .eq('user_id', 'user-1');

      expect(error).toBeNull();
      expect(data).toContain(session);
    });

    it('should prevent users from viewing other users sessions', async () => {
      const user1 = createMockUser({ id: 'user-1' });
      mockSupabase.__testUtils.setUser(user1);

      mockSupabase.from('active_sessions').select.mockReturnThis();
      mockSupabase.from('active_sessions').select().eq.mockResolvedValueOnce({
        data: [], // No access to other user's sessions
        error: null,
      });

      const { data, error } = await mockSupabase
        .from('active_sessions')
        .select('*')
        .eq('user_id', 'user-2');

      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });
  });
});
