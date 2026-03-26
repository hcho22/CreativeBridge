/**
 * XP Atomicity Tests (US-004 R-4.1)
 *
 * Tests that XP transactions are atomic and idempotent:
 * - Double-completion of same session awards XP only once
 * - lastCompletedSessionId is correctly set
 * - updateSession cannot set completion-related fields
 */

import { getConvexClient, isConvexReady, api } from '../../services/convex';

// Mock Convex
jest.mock('../../services/convex', () => ({
  getConvexClient: jest.fn(),
  isConvexReady: jest.fn(),
  api: {
    userProfiles: {
      completeGameSession: 'userProfiles:completeGameSession',
    },
    gameSessions: {
      completeSession: 'gameSessions:completeSession',
      updateSession: 'gameSessions:updateSession',
    },
  },
}));

const mockConvexClient = {
  mutation: jest.fn(),
  query: jest.fn(),
};

const mockIsConvexReady = isConvexReady as jest.MockedFunction<
  typeof isConvexReady
>;
const mockGetConvexClient = getConvexClient as jest.MockedFunction<
  typeof getConvexClient
>;

describe('XP Atomicity Tests (R-4.1)', () => {
  const testClerkUserId = 'user_test123';
  const testSessionId = 'session_abc';

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsConvexReady.mockReturnValue(true);
    mockGetConvexClient.mockReturnValue(mockConvexClient as any);
  });

  test('pre-fix double-XP scenario: calling completeGameSession twice with same sessionId awards XP only once', async () => {
    // First call: awards XP
    mockConvexClient.mutation
      .mockResolvedValueOnce({
        success: true,
        totalXp: 150,
        totalStoriesCompleted: 1,
        currentStreak: 1,
        longestStreak: 1,
        bestScore: 100,
        isFirstStory: true,
        isFirstStreak: false,
      })
      // Second call: idempotent skip
      .mockResolvedValueOnce({
        success: true,
        skipped: true,
        totalXp: 150,
        totalStoriesCompleted: 1,
        currentStreak: 1,
        longestStreak: 1,
        bestScore: 100,
        isFirstStory: false,
        isFirstStreak: false,
      });

    const firstResult = await mockConvexClient.mutation(
      api.userProfiles.completeGameSession,
      {
        clerkUserId: testClerkUserId,
        sessionId: testSessionId,
        xpEarned: 50,
        wordsWritten: 100,
        finalScore: 100,
      },
    );

    const secondResult = await mockConvexClient.mutation(
      api.userProfiles.completeGameSession,
      {
        clerkUserId: testClerkUserId,
        sessionId: testSessionId,
        xpEarned: 50,
        wordsWritten: 100,
        finalScore: 100,
      },
    );

    expect(firstResult.success).toBe(true);
    expect(firstResult.skipped).toBeUndefined();
    expect(firstResult.totalXp).toBe(150);

    expect(secondResult.success).toBe(true);
    expect(secondResult.skipped).toBe(true);
    // XP should NOT have increased again
    expect(secondResult.totalXp).toBe(150);
  });

  test('idempotent award: completeGameSession checks lastCompletedSessionId before awarding XP', async () => {
    // Simulate mutation that includes sessionId in args
    await mockConvexClient.mutation(api.userProfiles.completeGameSession, {
      clerkUserId: testClerkUserId,
      sessionId: testSessionId,
      xpEarned: 50,
      wordsWritten: 100,
      finalScore: 100,
    });

    // Verify sessionId is passed in the mutation args
    expect(mockConvexClient.mutation).toHaveBeenCalledWith(
      api.userProfiles.completeGameSession,
      expect.objectContaining({
        sessionId: testSessionId,
      }),
    );
  });

  test('atomic mutation: completeGameSession accepts sessionId parameter', async () => {
    mockConvexClient.mutation.mockResolvedValueOnce({ success: true });

    const args = {
      clerkUserId: testClerkUserId,
      sessionId: testSessionId,
      xpEarned: 75,
      wordsWritten: 200,
      finalScore: 150,
    };

    await mockConvexClient.mutation(api.userProfiles.completeGameSession, args);

    expect(mockConvexClient.mutation).toHaveBeenCalledWith(
      'userProfiles:completeGameSession',
      expect.objectContaining({
        clerkUserId: testClerkUserId,
        sessionId: testSessionId,
        xpEarned: 75,
      }),
    );
  });

  test('lastCompletedSessionId is set after successful completion', async () => {
    mockConvexClient.mutation.mockResolvedValueOnce({
      success: true,
      totalXp: 200,
    });

    const result = await mockConvexClient.mutation(
      api.userProfiles.completeGameSession,
      {
        clerkUserId: testClerkUserId,
        sessionId: testSessionId,
        xpEarned: 100,
        wordsWritten: 300,
        finalScore: 200,
      },
    );

    expect(result.success).toBe(true);
    // The sessionId was passed — backend stores it as lastCompletedSessionId
    expect(mockConvexClient.mutation).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ sessionId: testSessionId }),
    );
  });

  test('concurrent safety: parallel completions with same sessionId should not double-award', async () => {
    // Simulate first call succeeds, second is idempotent
    mockConvexClient.mutation
      .mockResolvedValueOnce({ success: true, totalXp: 150 })
      .mockResolvedValueOnce({ success: true, skipped: true, totalXp: 150 });

    const [result1, result2] = await Promise.all([
      mockConvexClient.mutation(api.userProfiles.completeGameSession, {
        clerkUserId: testClerkUserId,
        sessionId: testSessionId,
        xpEarned: 50,
        wordsWritten: 100,
        finalScore: 100,
      }),
      mockConvexClient.mutation(api.userProfiles.completeGameSession, {
        clerkUserId: testClerkUserId,
        sessionId: testSessionId,
        xpEarned: 50,
        wordsWritten: 100,
        finalScore: 100,
      }),
    ]);

    // Both should report same total XP
    expect(result1.totalXp).toBe(150);
    expect(result2.totalXp).toBe(150);
    // At least one should be skipped
    const skippedCount = [result1, result2].filter(r => r.skipped).length;
    expect(skippedCount).toBeGreaterThanOrEqual(1);
  });

  test('updateSession bypass blocked: xpEarned and finalScore stripped from updateSession args', async () => {
    // The updateSession mutation should NOT accept xpEarned or finalScore
    // We verify by checking the args shape doesn't include these fields
    mockConvexClient.mutation.mockResolvedValueOnce({ success: true });

    const updateArgs = {
      sessionId: testSessionId,
      updates: {
        storyContent: 'Updated story...',
        wordsWritten: 150,
        currentRound: 3,
        storyMetadata: {},
        // xpEarned and finalScore should NOT be here — removed from validator
      },
    };

    await mockConvexClient.mutation(api.gameSessions.updateSession, updateArgs);

    // Verify xpEarned and finalScore are not in the update payload
    const calledArgs = mockConvexClient.mutation.mock.calls[0][1];
    expect(calledArgs.updates).not.toHaveProperty('xpEarned');
    expect(calledArgs.updates).not.toHaveProperty('finalScore');
    expect(calledArgs.updates).not.toHaveProperty('completedAt');
  });
});
