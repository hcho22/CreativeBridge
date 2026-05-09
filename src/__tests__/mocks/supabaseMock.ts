// Mock Supabase client for testing
export const createMockSupabaseClient = () => {
  const mockData = new Map();
  const mockUsers = new Map();
  const mockSessions = new Map();
  // Memoize per-table and per-bucket chains so repeated from()/storage.from()
  // calls return the SAME object — required for tests that want stable jest.fn
  // identities across multiple from('users') invocations (e.g., to override
  // .select.mockResolvedValue or assert on .insert.mock.calls).
  const tableChains = new Map<string, any>();
  const bucketChains = new Map<string, any>();

  const createTableChain = (table: string) => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockImplementation(data => {
      const id = `${table}-${Date.now()}`;
      const record = Array.isArray(data)
        ? data.map(item => ({ id, ...item }))
        : { id, ...data };
      mockData.set(`${table}-${id}`, record);
      return Promise.resolve({ data: record, error: null });
    }),
    update: jest.fn().mockImplementation(data => ({
      eq: jest.fn().mockImplementation((_column, value) => {
        const record = mockData.get(`${table}-${value}`) || {
          id: value,
          ...data,
        };
        mockData.set(`${table}-${value}`, { ...record, ...data });
        return Promise.resolve({ data: record, error: null });
      }),
    })),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockImplementation((_column, value) => {
      const record = mockData.get(`${table}-${value}`);
      return Promise.resolve({
        data: record || null,
        error: record ? null : { message: 'Record not found' },
      });
    }),
    single: jest.fn().mockImplementation(() => {
      return Promise.resolve({
        data: Array.from(mockData.values()).pop() || null,
        error: null,
      });
    }),
    ilike: jest.fn().mockImplementation((column, pattern) => {
      const results = Array.from(mockData.values()).filter(record =>
        record[column]
          ?.toLowerCase()
          .includes(pattern.replace(/%/g, '').toLowerCase()),
      );
      return Promise.resolve({ data: results, error: null });
    }),
  });

  const createBucketChain = () => ({
    upload: jest.fn().mockResolvedValue({
      data: { path: 'test-path.png' },
      error: null,
    }),
    download: jest.fn().mockResolvedValue({
      data: new Blob(['test'], { type: 'image/png' }),
      error: null,
    }),
    remove: jest.fn().mockResolvedValue({
      data: ['removed-file.png'],
      error: null,
    }),
    getPublicUrl: jest.fn().mockReturnValue({
      data: { publicUrl: 'https://supabase.co/storage/test.png' },
    }),
    list: jest.fn().mockResolvedValue({
      data: [],
      error: null,
    }),
  });

  return {
    auth: {
      signInWithPassword: jest
        .fn()
        .mockImplementation(({ email, password }) => {
          // Simulate different auth scenarios
          if (email === 'valid@example.com' && password === 'correctpassword') {
            const user = {
              id: 'user-123',
              email,
              email_confirmed_at: new Date().toISOString(),
            };
            mockUsers.set('user-123', user);
            return Promise.resolve({
              data: { user, session: { access_token: 'token', user } },
              error: null,
            });
          }

          if (email === 'unconfirmed@example.com') {
            const user = { id: 'user-456', email, email_confirmed_at: null };
            return Promise.resolve({
              data: { user, session: null },
              error: null,
            });
          }

          return Promise.resolve({
            data: { user: null, session: null },
            error: { message: 'Invalid credentials' },
          });
        }),

      signUp: jest.fn().mockImplementation(({ email, password: _password }) => {
        if (email === 'existing@example.com') {
          return Promise.resolve({
            data: { user: null, session: null },
            error: { message: 'User already exists' },
          });
        }

        const user = {
          id: `user-${Date.now()}`,
          email,
          email_confirmed_at: null,
        };
        return Promise.resolve({
          data: { user, session: null },
          error: null,
        });
      }),

      signOut: jest.fn().mockResolvedValue({ error: null }),

      getUser: jest.fn().mockImplementation(() => {
        const currentUser = Array.from(mockUsers.values())[0] || null;
        return Promise.resolve({
          data: { user: currentUser },
          error: null,
        });
      }),

      getSession: jest.fn().mockImplementation(() => {
        const currentUser = Array.from(mockUsers.values())[0] || null;
        const session = currentUser
          ? {
              access_token: 'token',
              user: currentUser,
            }
          : null;
        return Promise.resolve({
          data: { session },
          error: null,
        });
      }),

      onAuthStateChange: jest.fn().mockImplementation(_callback => {
        return {
          data: {
            subscription: {
              unsubscribe: jest.fn(),
            },
          },
        };
      }),

      resetPasswordForEmail: jest.fn().mockImplementation(_email => {
        return Promise.resolve({ error: null });
      }),

      resend: jest.fn().mockImplementation(({ email: _email }) => {
        return Promise.resolve({ error: null });
      }),
    },

    from: jest.fn().mockImplementation((table: string) => {
      if (!tableChains.has(table)) {
        tableChains.set(table, createTableChain(table));
      }
      return tableChains.get(table);
    }),

    rpc: jest.fn().mockImplementation((functionName, params) => {
      // Mock database functions
      switch (functionName) {
        case 'register_device':
          return Promise.resolve({ data: params.p_user_id, error: null });
        case 'check_rate_limit':
          return Promise.resolve({ data: true, error: null });
        case 'log_security_event':
          return Promise.resolve({ data: 'log-id', error: null });
        case 'update_user_streak':
          return Promise.resolve({ data: null, error: null });
        case 'add_user_xp':
          return Promise.resolve({ data: null, error: null });
        default:
          return Promise.resolve({
            data: null,
            error: { message: 'Function not found' },
          });
      }
    }),

    // Storage API mock
    storage: {
      from: jest.fn().mockImplementation((bucket: string) => {
        if (!bucketChains.has(bucket)) {
          bucketChains.set(bucket, createBucketChain());
        }
        return bucketChains.get(bucket);
      }),
    },

    // Test utilities
    __testUtils: {
      clear: () => {
        mockData.clear();
        mockUsers.clear();
        mockSessions.clear();
        tableChains.clear();
        bucketChains.clear();
      },
      setUser: (user: any) => {
        // US-015f.1.security: setUser(null) is the documented sign-out idiom
        // (see imageStorageSecurity 'should reject uploads when user is not
        // authenticated'). Without this guard, dereferencing user.id throws.
        if (user === null || user === undefined) {
          mockUsers.clear();
          return;
        }
        mockUsers.set(user.id, user);
      },
      getUser: (id: string) => mockUsers.get(id),
      setData: (table: string, id: string, data: any) => {
        mockData.set(`${table}-${id}`, data);
      },
      getData: (table: string, id: string) => mockData.get(`${table}-${id}`),
      getAllData: () => Array.from(mockData.entries()),
    },
  };
};

// Mock the main supabase export
export const mockSupabase = createMockSupabaseClient();
