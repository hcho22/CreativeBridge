/**
 * storySessionManager — pending-flush idempotency.
 *
 * Verifies the contract added in `bugs/convex_server`:
 *
 *   1. `updateSession` queues by sessionId during the unauth window, so
 *      rapid edits to the same story do not enqueue duplicate writes.
 *   2. `flushPendingUpdates` replays each queued entry exactly once on
 *      success, then clears the entry — re-flushing is a no-op.
 *   3. A failed flush (network blip, server still rejecting auth) leaves
 *      the entry queued so the next auth-ready edge retries it. No silent
 *      drop, no double-write.
 *
 * Heavy mocking is intentional: this is a queue-state test, not an
 * end-to-end Convex test. The real Convex round-trip is covered by
 * manual on-device validation per the PR test plan.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
  multiRemove: jest.fn(async () => undefined),
}));

const mockConvexClient = {
  mutation: jest.fn(),
  query: jest.fn(),
};

// Jest hoists `jest.mock` factories above all `const`/`let`, so any closure
// the factory captures must be prefixed with `mock` (Jest's allow-list) or
// declared with `var`. We use the `mock`-prefix convention for both
// closures referenced inside the factory.
const mockWaitForConvexAuth = jest.fn(async () => true);

jest.mock('../../services/convex', () => ({
  getConvexClient: jest.fn(() => mockConvexClient),
  isConvexReady: jest.fn(() => true),
  waitForConvexAuth: (...args: unknown[]) => mockWaitForConvexAuth(...args),
  // Constructor calls onConvexAuthReady once on import to register the
  // flush listener. The test drives `flushPendingUpdates` directly, so
  // the listener body is never exercised — we just need the mock to
  // accept the call without throwing.
  onConvexAuthReady: jest.fn(() => () => {}),
  api: {
    gameSessions: {
      updateSession: 'gameSessions:updateSession',
    },
  },
}));

import { storySessionManager } from '../../services/storySessionManager';
import type { StorySession } from '../../services/storySessionManager';

const baseSession = (overrides: Partial<StorySession> = {}): StorySession =>
  ({
    id: 'sess_abc',
    user_id: 'user_xyz',
    created_at: new Date().toISOString(),
    completed_at: undefined,
    grade_level: 'K-2',
    final_score: 0,
    words_written: 5,
    sentences_completed: 1,
    challenges_completed: 0,
    xp_earned: 0,
    story_content: 'once upon a time',
    story_source: 'New',
    current_round: 1,
    isCompleted: false,
    contributions: [],
    sessionStats: {
      totalContributions: 0,
      averageWordsPerContribution: 0,
      timeSpent: 0,
    },
    metadata: {},
    ...overrides,
  } as unknown as StorySession);

beforeEach(() => {
  mockConvexClient.mutation.mockReset();
  mockWaitForConvexAuth.mockReset();
  mockWaitForConvexAuth.mockResolvedValue(true);
  (AsyncStorage.getItem as jest.Mock).mockReset().mockResolvedValue(null);
  (AsyncStorage.setItem as jest.Mock).mockReset().mockResolvedValue(undefined);
  // Clear any leftover queue from a prior test (singleton is process-scoped).
  // Casting to any is the cleanest way to reach the private map without
  // exposing it on the public API.
  (storySessionManager as any).pendingSessionUpdates.clear();
});

describe('storySessionManager — pending-flush idempotency', () => {
  it('queues by sessionId — rapid edits during unauth window collapse to one entry', async () => {
    mockWaitForConvexAuth.mockResolvedValue(false); // never ready

    await storySessionManager.updateSession(
      baseSession({ words_written: 1, story_content: 'a' }),
    );
    await storySessionManager.updateSession(
      baseSession({ words_written: 2, story_content: 'a b' }),
    );
    await storySessionManager.updateSession(
      baseSession({ words_written: 3, story_content: 'a b c' }),
    );

    const queue: Map<string, { wordsWritten: number; storyContent: string }> = (
      storySessionManager as any
    ).pendingSessionUpdates;

    expect(queue.size).toBe(1);
    expect(queue.get('sess_abc')?.wordsWritten).toBe(3);
    expect(queue.get('sess_abc')?.storyContent).toBe('a b c');
    // No mutation should have fired — auth was never ready.
    expect(mockConvexClient.mutation).not.toHaveBeenCalled();
  });

  it('flushPendingUpdates replays each entry exactly once and clears on success', async () => {
    mockWaitForConvexAuth.mockResolvedValue(false);
    mockConvexClient.mutation.mockResolvedValue(undefined);

    await storySessionManager.updateSession(
      baseSession({ id: 'sess_a', words_written: 10 }),
    );
    await storySessionManager.updateSession(
      baseSession({ id: 'sess_b', words_written: 20 }),
    );
    expect((storySessionManager as any).pendingSessionUpdates.size).toBe(2);

    await storySessionManager.flushPendingUpdates();

    expect(mockConvexClient.mutation).toHaveBeenCalledTimes(2);
    expect(mockConvexClient.mutation).toHaveBeenCalledWith(
      'gameSessions:updateSession',
      expect.objectContaining({
        sessionId: 'sess_a',
        updates: expect.objectContaining({ wordsWritten: 10 }),
      }),
    );
    expect(mockConvexClient.mutation).toHaveBeenCalledWith(
      'gameSessions:updateSession',
      expect.objectContaining({
        sessionId: 'sess_b',
        updates: expect.objectContaining({ wordsWritten: 20 }),
      }),
    );
    expect((storySessionManager as any).pendingSessionUpdates.size).toBe(0);
  });

  it('re-flushing after a successful flush is a no-op (no duplicate writes)', async () => {
    mockWaitForConvexAuth.mockResolvedValue(false);
    mockConvexClient.mutation.mockResolvedValue(undefined);

    await storySessionManager.updateSession(baseSession());
    await storySessionManager.flushPendingUpdates();
    expect(mockConvexClient.mutation).toHaveBeenCalledTimes(1);

    // Second flush — queue is empty, nothing should fire.
    await storySessionManager.flushPendingUpdates();
    expect(mockConvexClient.mutation).toHaveBeenCalledTimes(1);
  });

  it('failed flush keeps the entry queued for the next auth-ready edge', async () => {
    mockWaitForConvexAuth.mockResolvedValue(false);
    // First flush rejects (server still says no), second succeeds.
    mockConvexClient.mutation
      .mockRejectedValueOnce(new Error('Not authenticated'))
      .mockResolvedValueOnce(undefined);

    await storySessionManager.updateSession(baseSession());
    await storySessionManager.flushPendingUpdates();

    expect(mockConvexClient.mutation).toHaveBeenCalledTimes(1);
    // Entry is still queued — a transient failure must not silently drop.
    expect(
      (storySessionManager as any).pendingSessionUpdates.has('sess_abc'),
    ).toBe(true);

    // Retry on the next ready edge succeeds and clears.
    await storySessionManager.flushPendingUpdates();
    expect(mockConvexClient.mutation).toHaveBeenCalledTimes(2);
    expect((storySessionManager as any).pendingSessionUpdates.size).toBe(0);
  });

  it('a successful direct updateSession drops any pending queued entry for that session', async () => {
    // Pre-populate the queue with stale data (simulates a previous failure).
    (storySessionManager as any).pendingSessionUpdates.set('sess_abc', {
      storyContent: 'stale',
      wordsWritten: 1,
    });

    mockWaitForConvexAuth.mockResolvedValue(true);
    mockConvexClient.mutation.mockResolvedValue(undefined);

    await storySessionManager.updateSession(
      baseSession({ words_written: 99, story_content: 'fresh' }),
    );

    expect(mockConvexClient.mutation).toHaveBeenCalledTimes(1);
    // Queue cleared — the just-completed write supersedes the stale entry.
    expect((storySessionManager as any).pendingSessionUpdates.size).toBe(0);
  });

  it('an auth-error caught from a direct updateSession is queued for retry', async () => {
    mockWaitForConvexAuth.mockResolvedValue(true);
    mockConvexClient.mutation.mockRejectedValueOnce(
      new Error(
        '[CONVEX M(gameSessions:updateSession)] Server Error: Uncaught Error: Not authenticated',
      ),
    );

    await storySessionManager.updateSession(baseSession({ words_written: 7 }));

    // The session was queued because it was an auth race, not silently dropped.
    expect(
      (storySessionManager as any).pendingSessionUpdates.get('sess_abc')
        ?.wordsWritten,
    ).toBe(7);
  });
});
