/**
 * Performance Tests: Database Query Performance
 *
 * Tests database operation performance to ensure:
 * - Completion tracking adds < 50ms overhead
 * - Session updates are fast
 * - Index queries are efficient
 */

import { storySessionManager } from '../../src/services/storySessionManager';
import { supabase } from '../../src/services/supabase';

describe('Performance Tests: Database Query Performance', () => {
  const TEST_USER_ID = 'db-perf-test-' + Date.now();
  let testSessionId: string;

  beforeEach(async () => {
    // Create a fresh test session for each test
    const session = await storySessionManager.createSession(
      TEST_USER_ID,
      'K-2',
    );
    testSessionId = session!.id;
  });

  afterEach(async () => {
    // Cleanup test session
    if (testSessionId) {
      await supabase.from('game_sessions').delete().eq('id', testSessionId);
    }
  });

  afterAll(async () => {
    // Cleanup all test sessions
    await supabase.from('game_sessions').delete().eq('user_id', TEST_USER_ID);
  });

  /**
   * Test 1: Completion tracking adds < 50ms overhead
   * NFR Requirement: Round tracking should not significantly slow down contributions
   */
  it('should add contribution with < 50ms overhead for completion tracking', async () => {
    const session = await storySessionManager.getSession(testSessionId);
    expect(session).toBeTruthy();

    // Measure baseline: just the database update
    const baselineStart = Date.now();
    await (supabase.from('game_sessions') as any)
      .update({ words_written: 10 })
      .eq('id', testSessionId);
    const baselineElapsed = Date.now() - baselineStart;

    // Measure with completion tracking
    const trackingStart = Date.now();
    await storySessionManager.addContribution(
      testSessionId,
      'ai',
      'AI response for performance test.',
      session!,
    );
    const trackingElapsed = Date.now() - trackingStart;

    const overhead = trackingElapsed - baselineElapsed;

    // Overhead should be minimal (< 50ms additional)
    expect(overhead).toBeLessThan(50);

    console.log(
      `✓ Completion tracking overhead: ${overhead}ms (baseline: ${baselineElapsed}ms, total: ${trackingElapsed}ms)`,
    );
  });

  /**
   * Test 2: Session retrieval is fast
   * Getting a session should be < 100ms
   */
  it('should retrieve session in < 100ms', async () => {
    const startTime = Date.now();

    const session = await storySessionManager.getSession(testSessionId);

    const elapsed = Date.now() - startTime;

    expect(session).toBeTruthy();
    expect(elapsed).toBeLessThan(100); // < 100ms

    console.log(`✓ Session retrieval: ${elapsed}ms`);
  });

  /**
   * Test 3: Session update is fast
   * Updating session fields should be < 100ms
   */
  it('should update session in < 100ms', async () => {
    const session = await storySessionManager.getSession(testSessionId);
    expect(session).toBeTruthy();

    session!.current_round = 3;
    session!.words_written = 50;
    session!.sentences_completed = 3;

    const startTime = Date.now();

    const updatedSession = await storySessionManager.updateSession(session!);

    const elapsed = Date.now() - startTime;

    expect(updatedSession).toBeTruthy();
    expect(updatedSession!.current_round).toBe(3);
    expect(elapsed).toBeLessThan(100); // < 100ms

    console.log(`✓ Session update: ${elapsed}ms`);
  });

  /**
   * Test 4: Bulk session queries are efficient
   * Querying multiple sessions should scale well
   */
  it('should efficiently query completed sessions with index', async () => {
    // Create 5 completed sessions
    const sessionIds: string[] = [];
    for (let i = 0; i < 5; i++) {
      const session = await storySessionManager.createSession(
        TEST_USER_ID,
        'K-2',
      );
      sessionIds.push(session!.id);

      // Mark as completed
      await (supabase.from('game_sessions') as any)
        .update({
          current_round: 5,
          completed_at: new Date().toISOString(),
        })
        .eq('id', session!.id);
    }

    // Query all completed sessions for user
    const startTime = Date.now();

    const { data: completedSessions } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('user_id', TEST_USER_ID)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false });

    const elapsed = Date.now() - startTime;

    expect(completedSessions).toBeTruthy();
    expect(completedSessions!.length).toBeGreaterThanOrEqual(5);
    // Index query should be fast even with multiple rows
    expect(elapsed).toBeLessThan(150); // < 150ms

    console.log(
      `✓ Indexed query for ${
        completedSessions!.length
      } completed sessions: ${elapsed}ms`,
    );

    // Cleanup
    await supabase.from('game_sessions').delete().in('id', sessionIds);
  });

  /**
   * Test 5: Image upload status queries are fast
   * Querying by upload status should use index efficiently
   */
  it('should efficiently query by upload status with index', async () => {
    // Create sessions with different upload statuses
    const sessionIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const session = await storySessionManager.createSession(
        TEST_USER_ID,
        'K-2',
      );
      sessionIds.push(session!.id);

      await (supabase.from('game_sessions') as any)
        .update({
          generated_image_url: 'https://example.com/image.png',
          image_upload_status:
            i === 0 ? 'pending' : i === 1 ? 'uploaded' : 'failed',
        })
        .eq('id', session!.id);
    }

    // Query by upload status
    const startTime = Date.now();

    const { data: failedUploads } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('user_id', TEST_USER_ID)
      .eq('image_upload_status', 'failed');

    const elapsed = Date.now() - startTime;

    expect(failedUploads).toBeTruthy();
    expect(failedUploads!.length).toBeGreaterThanOrEqual(1);
    // Index on image_upload_status should make this fast
    expect(elapsed).toBeLessThan(100); // < 100ms

    console.log(`✓ Upload status query: ${elapsed}ms`);

    // Cleanup
    await supabase.from('game_sessions').delete().in('id', sessionIds);
  });

  /**
   * Test 6: Contribution loop performance
   * Simulating a full 5-round story should be performant
   */
  it('should complete 5 rounds efficiently', async () => {
    const startTime = Date.now();

    // Simulate 5 complete rounds (user + AI each round)
    for (let round = 1; round <= 5; round++) {
      await storySessionManager.addContribution(
        testSessionId,
        'user',
        `User contribution for round ${round}`,
      );

      await storySessionManager.addContribution(
        testSessionId,
        'ai',
        `AI response for round ${round}`,
      );
    }

    const elapsed = Date.now() - startTime;

    // Verify completion
    const finalSession = await storySessionManager.getSession(testSessionId);
    expect(finalSession!.current_round).toBe(5);
    expect(finalSession!.isCompleted).toBe(true);

    // 10 contributions (5 user + 5 AI) should be reasonably fast
    // Even at 100ms per contribution, should be < 1.5s total
    expect(elapsed).toBeLessThan(1500); // < 1.5 seconds

    console.log(
      `✓ 5 complete rounds (10 contributions): ${elapsed}ms (avg ${(
        elapsed / 10
      ).toFixed(1)}ms per contribution)`,
    );
  }, 5000); // 5 second timeout

  /**
   * Test 7: Concurrent session updates
   * Multiple simultaneous updates should not cause slowdowns
   */
  it('should handle concurrent session updates efficiently', async () => {
    // Create 5 test sessions
    const sessionIds: string[] = [];
    for (let i = 0; i < 5; i++) {
      const session = await storySessionManager.createSession(
        TEST_USER_ID,
        'K-2',
      );
      sessionIds.push(session!.id);
    }

    // Update all sessions concurrently
    const startTime = Date.now();

    await Promise.all(
      sessionIds.map(sessionId =>
        (supabase.from('game_sessions') as any)
          .update({
            current_round: 3,
            words_written: 50,
          })
          .eq('id', sessionId),
      ),
    );

    const elapsed = Date.now() - startTime;

    // Concurrent updates should be faster than sequential
    // With proper connection pooling, should be < 300ms
    expect(elapsed).toBeLessThan(300);

    console.log(
      `✓ 5 concurrent updates: ${elapsed}ms (avg ${(elapsed / 5).toFixed(
        1,
      )}ms per update)`,
    );

    // Cleanup
    await supabase.from('game_sessions').delete().in('id', sessionIds);
  });
});
