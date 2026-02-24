/**
 * Mock Convex context for unit testing Convex functions.
 *
 * Provides a fully simulated Convex environment including:
 * - In-memory database with query/mutation support
 * - Authentication simulation with Clerk-style identities
 * - Storage simulation for file uploads
 * - Index support for efficient queries
 *
 * @implements US-028: Unit Test Convex Functions
 */

import { UserIdentity } from 'convex/server';

// ============================================================================
// Types
// ============================================================================

/**
 * Simulated Convex document with auto-generated fields.
 */
export interface MockDocument {
  _id: string;
  _creationTime: number;
  [key: string]: unknown;
}

/**
 * Index definition for the mock database.
 */
interface IndexDefinition {
  tableName: string;
  indexName: string;
  fields: string[];
}

/**
 * Storage entry for mock file storage.
 */
interface StorageEntry {
  data: Blob | Buffer;
  contentType: string;
  url: string;
}

// ============================================================================
// Mock ID Generator
// ============================================================================

let idCounter = 0;

/**
 * Generate a mock Convex ID that looks realistic.
 * Format: k[tableName]_[random chars]
 */
export function generateMockId(tableName: string): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let suffix = '';
  for (let i = 0; i < 12; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  idCounter++;
  return `k${tableName.slice(0, 2)}${idCounter}_${suffix}`;
}

/**
 * Generate a mock storage ID.
 */
export function generateStorageId(): string {
  return generateMockId('_storage');
}

// ============================================================================
// Mock Database
// ============================================================================

/**
 * Creates a mock Convex database with in-memory storage.
 */
export function createMockDatabase() {
  const tables = new Map<string, Map<string, MockDocument>>();
  const indexes: IndexDefinition[] = [
    // userProfiles indexes
    {
      tableName: 'userProfiles',
      indexName: 'by_clerk_user_id',
      fields: ['clerkUserId'],
    },
    {
      tableName: 'userProfiles',
      indexName: 'by_total_xp',
      fields: ['totalXp'],
    },
    // gameSessions indexes
    { tableName: 'gameSessions', indexName: 'by_user', fields: ['userId'] },
    {
      tableName: 'gameSessions',
      indexName: 'by_clerk_user',
      fields: ['clerkUserId'],
    },
    // imageGenerationEvents indexes
    {
      tableName: 'imageGenerationEvents',
      indexName: 'by_user',
      fields: ['userId'],
    },
    {
      tableName: 'imageGenerationEvents',
      indexName: 'by_session',
      fields: ['sessionId'],
    },
    {
      tableName: 'imageGenerationEvents',
      indexName: 'by_clerk_user',
      fields: ['clerkUserId'],
    },
    // storyElements indexes
    {
      tableName: 'storyElements',
      indexName: 'by_session',
      fields: ['sessionId'],
    },
    // storyDiversityScores indexes
    {
      tableName: 'storyDiversityScores',
      indexName: 'by_session',
      fields: ['sessionId'],
    },
    // storyDownloadHistory indexes
    {
      tableName: 'storyDownloadHistory',
      indexName: 'by_user',
      fields: ['userId'],
    },
    // featureFlags indexes
    { tableName: 'featureFlags', indexName: 'by_key', fields: ['key'] },
  ];

  function getTable(tableName: string): Map<string, MockDocument> {
    if (!tables.has(tableName)) {
      tables.set(tableName, new Map());
    }
    return tables.get(tableName)!;
  }

  return {
    /**
     * Insert a document into a table.
     */
    insert: jest.fn(
      async (
        tableName: string,
        doc: Record<string, unknown>,
      ): Promise<string> => {
        const id = generateMockId(tableName);
        const document: MockDocument = {
          _id: id,
          _creationTime: Date.now(),
          ...doc,
        };
        getTable(tableName).set(id, document);
        return id;
      },
    ),

    /**
     * Get a document by ID.
     */
    get: jest.fn(async (id: string): Promise<MockDocument | null> => {
      // Extract table name from ID pattern (e.g., kus1_xxx for userProfiles)
      for (const [, table] of tables) {
        if (table.has(id)) {
          return table.get(id) || null;
        }
      }
      return null;
    }),

    /**
     * Update a document by ID (partial update).
     */
    patch: jest.fn(
      async (id: string, updates: Record<string, unknown>): Promise<void> => {
        for (const [, table] of tables) {
          if (table.has(id)) {
            const doc = table.get(id)!;
            table.set(id, { ...doc, ...updates });
            return;
          }
        }
        throw new Error(`Document not found: ${id}`);
      },
    ),

    /**
     * Replace a document entirely.
     */
    replace: jest.fn(
      async (id: string, doc: Record<string, unknown>): Promise<void> => {
        for (const [, table] of tables) {
          if (table.has(id)) {
            const existing = table.get(id)!;
            table.set(id, {
              _id: existing._id,
              _creationTime: existing._creationTime,
              ...doc,
            });
            return;
          }
        }
        throw new Error(`Document not found: ${id}`);
      },
    ),

    /**
     * Delete a document by ID.
     */
    delete: jest.fn(async (id: string): Promise<void> => {
      for (const [, table] of tables) {
        if (table.has(id)) {
          table.delete(id);
          return;
        }
      }
      throw new Error(`Document not found: ${id}`);
    }),

    /**
     * Query builder for table queries.
     */
    query: jest.fn((tableName: string) => {
      return createQueryBuilder(tableName, getTable(tableName), indexes);
    }),

    // Test utilities
    __testUtils: {
      /**
       * Clear all tables.
       */
      clear: () => {
        tables.clear();
        idCounter = 0;
      },

      /**
       * Set a document directly (for test setup).
       */
      setDocument: (tableName: string, doc: MockDocument) => {
        getTable(tableName).set(doc._id, doc);
      },

      /**
       * Get all documents from a table.
       */
      getAll: (tableName: string): MockDocument[] => {
        return Array.from(getTable(tableName).values());
      },

      /**
       * Get a document by ID directly.
       */
      getById: (tableName: string, id: string): MockDocument | undefined => {
        return getTable(tableName).get(id);
      },

      /**
       * Get raw tables for inspection.
       */
      getTables: () => tables,
    },
  };
}

/**
 * Query builder interface for chainable mock queries.
 */
export interface MockQueryBuilder {
  withIndex: jest.Mock<
    MockQueryBuilder,
    [string, ((q: IndexFilterBuilder) => IndexFilter)?]
  >;
  filter: jest.Mock<MockQueryBuilder, [(doc: MockDocument) => boolean]>;
  order: jest.Mock<MockQueryBuilder, ['asc' | 'desc']>;
  first: jest.Mock<Promise<MockDocument | null>, []>;
  collect: jest.Mock<Promise<MockDocument[]>, []>;
  take: jest.Mock<Promise<MockDocument[]>, [number]>;
}

/**
 * Creates a chainable query builder for mock database queries.
 */
function createQueryBuilder(
  tableName: string,
  table: Map<string, MockDocument>,
  indexes: IndexDefinition[],
): MockQueryBuilder {
  const documents = Array.from(table.values());
  let filterFn: ((doc: MockDocument) => boolean) | null = null;
  let orderDirection: 'asc' | 'desc' = 'asc';
  let orderField: string | null = null;

  const builder: MockQueryBuilder = {
    /**
     * Use an index for the query.
     */
    withIndex: jest.fn(
      (
        indexName: string,
        filterBuilder?: (q: IndexFilterBuilder) => IndexFilter,
      ): MockQueryBuilder => {
        const indexDef = indexes.find(
          i => i.tableName === tableName && i.indexName === indexName,
        );
        if (!indexDef) {
          throw new Error(`Index ${indexName} not found on table ${tableName}`);
        }

        if (filterBuilder) {
          const qBuilder: IndexFilterBuilder = {
            eq: (field: string, value: unknown) => ({ field, op: 'eq', value }),
            gt: (field: string, value: unknown) => ({ field, op: 'gt', value }),
            gte: (field: string, value: unknown) => ({
              field,
              op: 'gte',
              value,
            }),
            lt: (field: string, value: unknown) => ({ field, op: 'lt', value }),
            lte: (field: string, value: unknown) => ({
              field,
              op: 'lte',
              value,
            }),
          };
          const filter = filterBuilder(qBuilder);
          filterFn = (doc: MockDocument) => {
            const docValue = doc[filter.field];
            switch (filter.op) {
              case 'eq':
                return docValue === filter.value;
              case 'gt':
                return (docValue as number) > (filter.value as number);
              case 'gte':
                return (docValue as number) >= (filter.value as number);
              case 'lt':
                return (docValue as number) < (filter.value as number);
              case 'lte':
                return (docValue as number) <= (filter.value as number);
              default:
                return true;
            }
          };
        }

        // Set order field based on index for proper ordering
        if (indexDef.fields.length > 0) {
          orderField = indexDef.fields[0];
        }

        return builder;
      },
    ),

    /**
     * Filter documents.
     */
    filter: jest.fn(
      (predicate: (doc: MockDocument) => boolean): MockQueryBuilder => {
        const existingFilter = filterFn;
        filterFn = doc => {
          if (existingFilter && !existingFilter(doc)) return false;
          return predicate(doc);
        };
        return builder;
      },
    ),

    /**
     * Order results.
     */
    order: jest.fn((direction: 'asc' | 'desc'): MockQueryBuilder => {
      orderDirection = direction;
      return builder;
    }),

    /**
     * Get the first matching document.
     */
    first: jest.fn(async (): Promise<MockDocument | null> => {
      let results = filterFn ? documents.filter(filterFn) : documents;

      if (orderField) {
        results = results.sort((a, b) => {
          const aVal = a[orderField!];
          const bVal = b[orderField!];
          if (typeof aVal === 'number' && typeof bVal === 'number') {
            return orderDirection === 'asc' ? aVal - bVal : bVal - aVal;
          }
          const aStr = String(aVal);
          const bStr = String(bVal);
          return orderDirection === 'asc'
            ? aStr.localeCompare(bStr)
            : bStr.localeCompare(aStr);
        });
      }

      return results[0] || null;
    }),

    /**
     * Collect all matching documents.
     */
    collect: jest.fn(async (): Promise<MockDocument[]> => {
      let results = filterFn ? documents.filter(filterFn) : documents;

      if (orderField) {
        results = results.sort((a, b) => {
          const aVal = a[orderField!];
          const bVal = b[orderField!];
          if (typeof aVal === 'number' && typeof bVal === 'number') {
            return orderDirection === 'asc' ? aVal - bVal : bVal - aVal;
          }
          const aStr = String(aVal);
          const bStr = String(bVal);
          return orderDirection === 'asc'
            ? aStr.localeCompare(bStr)
            : bStr.localeCompare(aStr);
        });
      }

      return results;
    }),

    /**
     * Take first N documents.
     */
    take: jest.fn(async (n: number): Promise<MockDocument[]> => {
      let results = filterFn ? documents.filter(filterFn) : documents;

      if (orderField) {
        results = results.sort((a, b) => {
          const aVal = a[orderField!];
          const bVal = b[orderField!];
          if (typeof aVal === 'number' && typeof bVal === 'number') {
            return orderDirection === 'asc' ? aVal - bVal : bVal - aVal;
          }
          const aStr = String(aVal);
          const bStr = String(bVal);
          return orderDirection === 'asc'
            ? aStr.localeCompare(bStr)
            : bStr.localeCompare(aStr);
        });
      }

      return results.slice(0, n);
    }),
  };

  return builder;
}

export interface IndexFilterBuilder {
  eq: (field: string, value: unknown) => IndexFilter;
  gt: (field: string, value: unknown) => IndexFilter;
  gte: (field: string, value: unknown) => IndexFilter;
  lt: (field: string, value: unknown) => IndexFilter;
  lte: (field: string, value: unknown) => IndexFilter;
}

export interface IndexFilter {
  field: string;
  op: 'eq' | 'gt' | 'gte' | 'lt' | 'lte';
  value: unknown;
}

// ============================================================================
// Mock Storage
// ============================================================================

/**
 * Creates a mock Convex storage system.
 */
export function createMockStorage() {
  const files = new Map<string, StorageEntry>();
  let uploadUrlCounter = 0;
  const pendingUploads = new Map<string, string>(); // uploadUrl -> expectedStorageId

  return {
    /**
     * Generate a presigned upload URL.
     */
    generateUploadUrl: jest.fn(async (): Promise<string> => {
      uploadUrlCounter++;
      const uploadUrl = `https://mock-convex-storage.com/upload/${uploadUrlCounter}`;
      const expectedStorageId = generateStorageId();
      pendingUploads.set(uploadUrl, expectedStorageId);
      return uploadUrl;
    }),

    /**
     * Get URL for a stored file.
     */
    getUrl: jest.fn(async (storageId: string): Promise<string | null> => {
      const entry = files.get(storageId);
      return entry ? entry.url : null;
    }),

    /**
     * Store a file (server-side).
     */
    store: jest.fn(async (blob: Blob): Promise<string> => {
      const storageId = generateStorageId();
      files.set(storageId, {
        data: blob,
        contentType: blob.type || 'application/octet-stream',
        url: `https://mock-convex-storage.com/files/${storageId}`,
      });
      return storageId;
    }),

    /**
     * Delete a file.
     */
    delete: jest.fn(async (storageId: string): Promise<void> => {
      files.delete(storageId);
    }),

    // Test utilities
    __testUtils: {
      /**
       * Clear all stored files.
       */
      clear: () => {
        files.clear();
        uploadUrlCounter = 0;
        pendingUploads.clear();
      },

      /**
       * Simulate completing an upload (for testing upload flows).
       */
      completeUpload: (
        uploadUrl: string,
        data: Blob | Buffer,
        contentType: string,
      ): string => {
        const storageId = pendingUploads.get(uploadUrl) || generateStorageId();
        files.set(storageId, {
          data,
          contentType,
          url: `https://mock-convex-storage.com/files/${storageId}`,
        });
        pendingUploads.delete(uploadUrl);
        return storageId;
      },

      /**
       * Directly add a file (for test setup).
       */
      addFile: (
        storageId: string,
        data: Blob | Buffer,
        contentType: string,
      ): void => {
        files.set(storageId, {
          data,
          contentType,
          url: `https://mock-convex-storage.com/files/${storageId}`,
        });
      },

      /**
       * Check if a file exists.
       */
      hasFile: (storageId: string): boolean => {
        return files.has(storageId);
      },

      /**
       * Get raw files map.
       */
      getFiles: () => files,
    },
  };
}

// ============================================================================
// Mock Auth
// ============================================================================

/**
 * Creates a mock Convex auth context.
 */
export function createMockAuth(identity: UserIdentity | null = null) {
  let currentIdentity = identity;

  return {
    /**
     * Get the current user identity.
     */
    getUserIdentity: jest.fn(async (): Promise<UserIdentity | null> => {
      return currentIdentity;
    }),

    // Test utilities
    __testUtils: {
      /**
       * Set the current identity.
       */
      setIdentity: (newIdentity: UserIdentity | null) => {
        currentIdentity = newIdentity;
      },

      /**
       * Clear the identity (simulate logged out).
       */
      clearIdentity: () => {
        currentIdentity = null;
      },
    },
  };
}

/**
 * Create a mock Clerk user identity for testing.
 */
export function createMockClerkIdentity(
  clerkUserId: string,
  options?: {
    email?: string;
    name?: string;
    pictureUrl?: string;
  },
): UserIdentity {
  return {
    subject: clerkUserId,
    issuer: 'https://clerk.your-domain.com',
    email: options?.email || `${clerkUserId}@example.com`,
    emailVerified: true,
    name: options?.name || `User ${clerkUserId}`,
    pictureUrl: options?.pictureUrl,
    tokenIdentifier: `${clerkUserId}-token`,
  };
}

// ============================================================================
// Mock Convex Context
// ============================================================================

export type MockDb = ReturnType<typeof createMockDatabase>;
export type MockStorage = ReturnType<typeof createMockStorage>;
export type MockAuth = ReturnType<typeof createMockAuth>;

/**
 * Full mock Convex context for testing queries, mutations, and actions.
 */
export interface MockConvexContext {
  db: MockDb;
  storage: MockStorage;
  auth: MockAuth;
}

/**
 * Create a complete mock Convex context for testing.
 */
export function createMockConvexContext(
  identity?: UserIdentity | null,
): MockConvexContext {
  return {
    db: createMockDatabase(),
    storage: createMockStorage(),
    auth: createMockAuth(identity ?? null),
  };
}

/**
 * Reset all mocks in a context (for beforeEach cleanup).
 */
export function resetMockContext(ctx: MockConvexContext): void {
  ctx.db.__testUtils.clear();
  ctx.storage.__testUtils.clear();
  ctx.auth.__testUtils.clearIdentity();

  // Reset all jest mock call counts
  jest.clearAllMocks();
}

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a test user profile in the mock database.
 */
export async function createTestUserProfile(
  ctx: MockConvexContext,
  clerkUserId: string,
  overrides?: Partial<MockDocument>,
): Promise<MockDocument> {
  const today = new Date().toISOString().split('T')[0];
  const profile = {
    clerkUserId,
    username: `user_${clerkUserId.slice(-6)}`,
    displayName: `Test User ${clerkUserId.slice(-6)}`,
    totalXp: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastActivityDate: today,
    bestScore: 0,
    totalGamesPlayed: 0,
    totalStoriesCompleted: 0,
    totalWordsWritten: 0,
    preferredGradeLevel: 'K-2',
    speechEnabled: true,
    onboardingCompleted: false,
    onboardingProgress: {
      create_account: true,
      first_story: false,
      first_image: false,
      first_voice: false,
      first_streak: false,
    },
    ...overrides,
  };

  const id = await ctx.db.insert('userProfiles', profile);
  return ctx.db.__testUtils.getById('userProfiles', id)!;
}

/**
 * Create a test game session in the mock database.
 */
export async function createTestGameSession(
  ctx: MockConvexContext,
  userId: string,
  clerkUserId: string,
  overrides?: Partial<MockDocument>,
): Promise<MockDocument> {
  const session = {
    userId,
    clerkUserId,
    gradeLevel: 'K-2',
    storySource: 'New',
    currentRound: 1,
    finalScore: 0,
    wordsWritten: 0,
    sentencesCompleted: 0,
    challengesCompleted: 0,
    xpEarned: 0,
    storyContent: '',
    storyMetadata: {},
    ...overrides,
  };

  const id = await ctx.db.insert('gameSessions', session);
  return ctx.db.__testUtils.getById('gameSessions', id)!;
}

/**
 * Create a test image generation event in the mock database.
 */
export async function createTestImageGenerationEvent(
  ctx: MockConvexContext,
  userId: string,
  clerkUserId: string,
  overrides?: Partial<MockDocument>,
): Promise<MockDocument> {
  const event = {
    userId,
    clerkUserId,
    xpCost: 1000,
    generationStatus: 'pending',
    serviceUsed: 'stability-ai/stable-diffusion-3.5-large',
    metadata: {},
    ...overrides,
  };

  const id = await ctx.db.insert('imageGenerationEvents', event);
  return ctx.db.__testUtils.getById('imageGenerationEvents', id)!;
}
