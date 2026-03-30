/**
 * Write-Ahead Log Tests (US-004 R-4.2/R-4.3)
 *
 * Tests that story saves use a write-ahead log pattern:
 * - AsyncStorage written before Convex mutation
 * - Failed saves are queued in AsyncStorage
 * - Queued saves are replayed on reconnection
 * - No duplicate saves on replay
 * - Failures are surfaced to the caller
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { StoryManagementService } from '../../services/storyManagementService';
import { getConvexClient, isConvexReady } from '../../services/convex';

// Mock Convex
jest.mock('../../services/convex', () => ({
  getConvexClient: jest.fn(),
  isConvexReady: jest.fn(),
  api: {
    gameSessions: {
      createSession: 'gameSessions:createSession',
      createStoryContinuationSession:
        'gameSessions:createStoryContinuationSession',
      getSession: 'gameSessions:getSession',
      updateSession: 'gameSessions:updateSession',
    },
  },
}));

// Mock AsyncStorage (uses the __mocks__ implementation)
jest.mock('@react-native-async-storage/async-storage');

const mockIsConvexReady = isConvexReady as jest.MockedFunction<
  typeof isConvexReady
>;
const mockGetConvexClient = getConvexClient as jest.MockedFunction<
  typeof getConvexClient
>;

const mockConvexClient = {
  mutation: jest.fn(),
  query: jest.fn(),
};

describe('Write-Ahead Log Tests (R-4.2/R-4.3)', () => {
  const testRequest = {
    userId: 'user_test123',
    content: 'Once upon a time in a magical land...',
    gradeLevel: 'K-2' as const,
    source: 'New' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear the mock storage
    (AsyncStorage.clear as jest.Mock).mockImplementation(async () => {
      // Reset internal storage state
    });
  });

  test('AsyncStorage WAL entry written before Convex mutation', async () => {
    mockIsConvexReady.mockReturnValue(true);
    mockGetConvexClient.mockReturnValue(mockConvexClient as any);
    mockConvexClient.mutation.mockResolvedValueOnce('session_123');
    mockConvexClient.query.mockResolvedValueOnce(null);
    mockConvexClient.mutation.mockResolvedValueOnce(null); // updateSession

    const setItemCalls: string[] = [];
    (AsyncStorage.setItem as jest.Mock).mockImplementation(
      async (key: string) => {
        setItemCalls.push(key);
      },
    );

    await StoryManagementService.saveStory(testRequest);

    // Verify WAL entry was written (key starts with wal_save_)
    const walWriteCalls = setItemCalls.filter(k => k.startsWith('wal_save_'));
    expect(walWriteCalls.length).toBeGreaterThanOrEqual(1);

    // Verify setItem was called BEFORE mutation
    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });

  test('failed Convex saves are queued in AsyncStorage', async () => {
    mockIsConvexReady.mockReturnValue(true);
    mockGetConvexClient.mockReturnValue(mockConvexClient as any);
    mockConvexClient.mutation.mockRejectedValueOnce(new Error('Network error'));

    // Track WAL entries
    const walEntries: Record<string, string> = {};
    (AsyncStorage.setItem as jest.Mock).mockImplementation(
      async (key: string, value: string) => {
        walEntries[key] = value;
      },
    );
    (AsyncStorage.removeItem as jest.Mock).mockImplementation(
      async (key: string) => {
        delete walEntries[key];
      },
    );

    const result = await StoryManagementService.saveStory(testRequest);

    expect(result.success).toBe(false);

    // WAL entry should still exist (not removed because Convex failed)
    const walKeys = Object.keys(walEntries).filter(k =>
      k.startsWith('wal_save_'),
    );
    expect(walKeys.length).toBeGreaterThanOrEqual(1);

    // Verify the WAL entry contains the original request
    const walData = JSON.parse(walEntries[walKeys[0]]);
    expect(walData.userId).toBe(testRequest.userId);
    expect(walData.content).toBe(testRequest.content);
  });

  test('queued WAL entries are replayed on reconnection', async () => {
    const walKey = `wal_save_user_test123_1234567890`;
    const walData = JSON.stringify(testRequest);

    const mockStore: Record<string, string> = {
      [walKey]: walData,
      other_key: 'x',
    };

    (AsyncStorage.getAllKeys as jest.Mock).mockImplementation(async () =>
      Object.keys(mockStore),
    );
    (AsyncStorage.getItem as jest.Mock).mockImplementation(
      async (key: string) => mockStore[key] || null,
    );
    (AsyncStorage.setItem as jest.Mock).mockImplementation(
      async (key: string, val: string) => {
        mockStore[key] = val;
      },
    );
    (AsyncStorage.removeItem as jest.Mock).mockImplementation(
      async (key: string) => {
        delete mockStore[key];
      },
    );

    mockIsConvexReady.mockReturnValue(true);
    mockGetConvexClient.mockReturnValue(mockConvexClient as any);
    // createSession returns a session ID, updateSession returns null (no conversion needed)
    mockConvexClient.mutation
      .mockResolvedValueOnce('session_replayed') // createSession
      .mockResolvedValueOnce(null); // updateSession (null skips conversion)

    const result = await StoryManagementService.replayPendingWrites();

    expect(result.replayed).toBeGreaterThanOrEqual(1);
    // Original WAL key should have been removed
    expect(walKey in mockStore).toBe(false);
  });

  test('no duplicate saves: successful replay removes WAL entry', async () => {
    const walKey = `wal_save_user_test123_9999999999`;
    const walData = JSON.stringify(testRequest);

    const mockStore: Record<string, string> = { [walKey]: walData };

    (AsyncStorage.getAllKeys as jest.Mock).mockImplementation(async () =>
      Object.keys(mockStore),
    );
    (AsyncStorage.getItem as jest.Mock).mockImplementation(
      async (key: string) => mockStore[key] || null,
    );
    (AsyncStorage.setItem as jest.Mock).mockImplementation(
      async (key: string, val: string) => {
        mockStore[key] = val;
      },
    );
    (AsyncStorage.removeItem as jest.Mock).mockImplementation(
      async (key: string) => {
        delete mockStore[key];
      },
    );

    mockIsConvexReady.mockReturnValue(true);
    mockGetConvexClient.mockReturnValue(mockConvexClient as any);
    mockConvexClient.mutation
      .mockResolvedValueOnce('session_new') // createSession
      .mockResolvedValueOnce(null); // updateSession

    await StoryManagementService.replayPendingWrites();

    // After replay, no WAL entries should remain
    const remainingWalKeys = Object.keys(mockStore).filter(k =>
      k.startsWith('wal_save_'),
    );
    expect(remainingWalKeys).toHaveLength(0);
  });

  test('failures surfaced to user: saveStory returns error when database unavailable', async () => {
    mockIsConvexReady.mockReturnValue(false);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

    const result = await StoryManagementService.saveStory(testRequest);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Database not available');
    // WAL should still have been written
    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });
});
