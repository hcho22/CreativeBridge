/**
 * Convex auth-bridge contract tests.
 *
 * Covers the `setConvexAuthReady` / `waitForConvexAuth` / `onConvexAuthReady`
 * trio added to `services/convex.ts` to fix the "Not authenticated" race
 * for singleton-client callers (`whisperTranscriptionService`,
 * `storySessionManager`, etc.). These three exports are what every
 * non-React caller relies on — if their semantics drift, the auth race
 * comes back silently.
 */

import {
  setConvexAuthReady,
  isConvexAuthCurrentlyReady,
  waitForConvexAuth,
  onConvexAuthReady,
} from '../../services/convex';

beforeEach(() => {
  // Module state is process-scoped; reset to a known false at the top of
  // every test so order-dependent state doesn't leak between cases.
  setConvexAuthReady(false);
});

describe('convex auth bridge', () => {
  describe('setConvexAuthReady / isConvexAuthCurrentlyReady', () => {
    it('reflects the latest set value synchronously', () => {
      expect(isConvexAuthCurrentlyReady()).toBe(false);
      setConvexAuthReady(true);
      expect(isConvexAuthCurrentlyReady()).toBe(true);
      setConvexAuthReady(false);
      expect(isConvexAuthCurrentlyReady()).toBe(false);
    });

    it('is idempotent — repeated calls with the same value are no-ops', () => {
      const listener = jest.fn();
      onConvexAuthReady(listener);
      setConvexAuthReady(true);
      setConvexAuthReady(true);
      setConvexAuthReady(true);
      // Listener fires only on transition, not on every call.
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('waitForConvexAuth', () => {
    it('resolves true immediately when auth is already ready', async () => {
      setConvexAuthReady(true);
      await expect(waitForConvexAuth(50)).resolves.toBe(true);
    });

    it('resolves true when auth flips to ready before timeout', async () => {
      const promise = waitForConvexAuth(1000);
      // Simulate the ConvexAuthBridge flipping the flag mid-wait.
      setTimeout(() => setConvexAuthReady(true), 10);
      await expect(promise).resolves.toBe(true);
    });

    it('resolves false on timeout', async () => {
      // Tiny timeout — auth never flips, so we should see false.
      await expect(waitForConvexAuth(20)).resolves.toBe(false);
    });

    it('multiple concurrent waiters all resolve on a single ready edge', async () => {
      const a = waitForConvexAuth(500);
      const b = waitForConvexAuth(500);
      const c = waitForConvexAuth(500);
      setConvexAuthReady(true);
      await expect(Promise.all([a, b, c])).resolves.toEqual([true, true, true]);
    });
  });

  describe('onConvexAuthReady', () => {
    it('fires listeners on every false→true transition', () => {
      const listener = jest.fn();
      onConvexAuthReady(listener);
      setConvexAuthReady(true);
      setConvexAuthReady(false);
      setConvexAuthReady(true);
      expect(listener).toHaveBeenCalledTimes(2);
    });

    it('does NOT fire on true→false (no point flushing offline)', () => {
      setConvexAuthReady(true);
      const listener = jest.fn();
      onConvexAuthReady(listener);
      setConvexAuthReady(false);
      // No transition into "ready" happened after registration.
      expect(listener).not.toHaveBeenCalled();
    });

    it('fires once on the next microtask if registered while already ready', async () => {
      setConvexAuthReady(true);
      const listener = jest.fn();
      onConvexAuthReady(listener);
      // Microtask hasn't drained yet.
      expect(listener).not.toHaveBeenCalled();
      await Promise.resolve();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('returns an unsubscribe function that prevents further firings', () => {
      const listener = jest.fn();
      const unsubscribe = onConvexAuthReady(listener);
      unsubscribe();
      setConvexAuthReady(true);
      expect(listener).not.toHaveBeenCalled();
    });

    it('does not let one throwing listener block others', () => {
      const a = jest.fn(() => {
        throw new Error('boom');
      });
      const b = jest.fn();
      onConvexAuthReady(a);
      onConvexAuthReady(b);
      // Should not throw, and b should still fire.
      expect(() => setConvexAuthReady(true)).not.toThrow();
      expect(a).toHaveBeenCalledTimes(1);
      expect(b).toHaveBeenCalledTimes(1);
    });
  });
});
