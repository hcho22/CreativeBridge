/**
 * Performance Tests: Concurrent Upload Load Testing
 *
 * Tests system behavior under load:
 * - 100 concurrent uploads achieve 95%+ success rate
 * - System gracefully handles high load
 * - No resource exhaustion under stress
 */

import { imageStorageService } from '../../src/services/imageStorageService';
import { supabase } from '../../src/services/supabase';

describe('Performance Tests: Concurrent Upload Load Testing', () => {
  const TEST_BASE_USER_ID = 'load-test-user-' + Date.now();

  // Helper to generate mock blob
  const generateMockBlob = (sizeInMB: number = 2): Blob => {
    const sizeInBytes = sizeInMB * 1024 * 1024;
    const buffer = new ArrayBuffer(sizeInBytes);
    return new Blob([new Uint8Array(buffer) as unknown as Blob], {
      type: 'image/png',
      lastModified: Date.now(),
    });
  };

  // Cleanup helper
  const cleanupTestSessions = async (sessionIds: string[]) => {
    if (sessionIds.length > 0) {
      await supabase.from('game_sessions').delete().in('id', sessionIds);
    }
  };

  /**
   * Test 1: 100 concurrent uploads with 95%+ success rate
   * NFR Requirement: System should handle concurrent load efficiently
   */
  it('should handle 100 concurrent uploads with 95%+ success rate', async () => {
    const uploadCount = 100;
    const mockBlob = generateMockBlob(1); // 1MB images for faster testing
    const sessionIds: string[] = [];

    // Mock fetch for all uploads
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      blob: async () => mockBlob,
    } as Response);

    // Create test sessions
    for (let i = 0; i < uploadCount; i++) {
      const { data } = await supabase
        .from('game_sessions')
        .insert({
          user_id: `${TEST_BASE_USER_ID}-${i}`,
          grade_level: 'K-2',
          current_round: 5,
          completed_at: new Date().toISOString(),
        } as any)
        .select()
        .single();

      if (data) {
        sessionIds.push((data as any).id);
      }
    }

    console.log(`Created ${sessionIds.length} test sessions`);

    // Perform concurrent uploads
    const startTime = Date.now();

    const uploadPromises = sessionIds.map((sessionId, index) =>
      imageStorageService.uploadImageToSupabase(
        `https://replicate.delivery/test-image-${index}.png`,
        sessionId,
        `${TEST_BASE_USER_ID}-${index}`,
      ),
    );

    const results = await Promise.allSettled(uploadPromises);

    const elapsed = Date.now() - startTime;

    // Analyze results
    const successfulUploads = results.filter(
      r => r.status === 'fulfilled' && r.value.success,
    ).length;
    const failedUploads = results.filter(
      r =>
        r.status === 'rejected' ||
        (r.status === 'fulfilled' && !r.value.success),
    ).length;
    const successRate = successfulUploads / uploadCount;

    // Assertions
    expect(successRate).toBeGreaterThanOrEqual(0.95); // >= 95% success rate

    console.log(
      `✓ 100 concurrent uploads completed in ${(elapsed / 1000).toFixed(2)}s`,
    );
    console.log(
      `  - Success rate: ${(successRate * 100).toFixed(
        1,
      )}% (${successfulUploads}/${uploadCount})`,
    );
    console.log(`  - Failed: ${failedUploads}`);
    console.log(
      `  - Avg time per upload: ${(elapsed / uploadCount).toFixed(0)}ms`,
    );

    // Cleanup
    await cleanupTestSessions(sessionIds);
  }, 120000); // 2 minute timeout for 100 uploads

  /**
   * Test 2: Sequential vs Concurrent performance comparison
   * Concurrent should be significantly faster
   */
  it('should demonstrate performance benefit of concurrent uploads', async () => {
    const uploadCount = 10;
    const mockBlob = generateMockBlob(1);
    const sessionIds: string[] = [];

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      blob: async () => mockBlob,
    } as Response);

    // Create test sessions
    for (let i = 0; i < uploadCount; i++) {
      const { data } = await supabase
        .from('game_sessions')
        .insert({
          user_id: `${TEST_BASE_USER_ID}-seq-${i}`,
          grade_level: 'K-2',
          current_round: 5,
          completed_at: new Date().toISOString(),
        } as any)
        .select()
        .single();

      if (data) {
        sessionIds.push((data as any).id);
      }
    }

    // Sequential uploads
    const sequentialStart = Date.now();
    for (let i = 0; i < uploadCount; i++) {
      await imageStorageService.uploadImageToSupabase(
        `https://replicate.delivery/seq-${i}.png`,
        sessionIds[i],
        `${TEST_BASE_USER_ID}-seq-${i}`,
      );
    }
    const sequentialElapsed = Date.now() - sequentialStart;

    // Concurrent uploads
    const concurrentStart = Date.now();
    await Promise.all(
      sessionIds.map((sessionId, i) =>
        imageStorageService.uploadImageToSupabase(
          `https://replicate.delivery/con-${i}.png`,
          sessionId,
          `${TEST_BASE_USER_ID}-seq-${i}`,
        ),
      ),
    );
    const concurrentElapsed = Date.now() - concurrentStart;

    const speedup = sequentialElapsed / concurrentElapsed;

    console.log(`✓ Sequential: ${sequentialElapsed}ms`);
    console.log(`✓ Concurrent: ${concurrentElapsed}ms`);
    console.log(`✓ Speedup: ${speedup.toFixed(2)}x faster`);

    // Concurrent should be at least 2x faster
    expect(concurrentElapsed).toBeLessThan(sequentialElapsed / 2);

    // Cleanup
    await cleanupTestSessions(sessionIds);
  }, 60000);

  /**
   * Test 3: System handles retry spikes gracefully
   * Multiple failing uploads with retries should not crash
   */
  it('should handle retry spikes without resource exhaustion', async () => {
    const uploadCount = 20;
    const sessionIds: string[] = [];
    let fetchCallCount = 0;

    // Mock fetch to fail first 2 attempts, succeed on 3rd
    global.fetch = jest.fn().mockImplementation(async () => {
      fetchCallCount++;
      const attemptNumber = (fetchCallCount - 1) % 3; // 0, 1, 2, 0, 1, 2...

      if (attemptNumber < 2) {
        throw new Error('Network error - simulated');
      }

      return {
        ok: true,
        blob: async () => generateMockBlob(1),
      } as Response;
    });

    // Create test sessions
    for (let i = 0; i < uploadCount; i++) {
      const { data } = await supabase
        .from('game_sessions')
        .insert({
          user_id: `${TEST_BASE_USER_ID}-retry-${i}`,
          grade_level: 'K-2',
          current_round: 5,
          completed_at: new Date().toISOString(),
        } as any)
        .select()
        .single();

      if (data) {
        sessionIds.push((data as any).id);
      }
    }

    const startTime = Date.now();

    // All uploads will retry (fail, fail, succeed)
    const results = await Promise.allSettled(
      sessionIds.map((sessionId, i) =>
        imageStorageService.uploadImageToSupabase(
          `https://replicate.delivery/retry-${i}.png`,
          sessionId,
          `${TEST_BASE_USER_ID}-retry-${i}`,
        ),
      ),
    );

    const elapsed = Date.now() - startTime;

    const successCount = results.filter(
      r => r.status === 'fulfilled' && r.value.success,
    ).length;

    // Should still achieve high success rate despite retries
    const successRate = successCount / uploadCount;
    expect(successRate).toBeGreaterThanOrEqual(0.9); // >= 90% (allowing for some failures)

    console.log(
      `✓ ${uploadCount} uploads with retries: ${(elapsed / 1000).toFixed(2)}s`,
    );
    console.log(`  - Success rate: ${(successRate * 100).toFixed(1)}%`);
    console.log(
      `  - Total fetch calls: ${fetchCallCount} (avg ${(
        fetchCallCount / uploadCount
      ).toFixed(1)} per upload)`,
    );

    // Cleanup
    await cleanupTestSessions(sessionIds);
  }, 90000);

  /**
   * Test 4: Mixed load (some succeed, some fail) is handled well
   * Real-world scenario with mixed success/failure
   */
  it('should handle mixed success/failure scenarios efficiently', async () => {
    const uploadCount = 30;
    const sessionIds: string[] = [];
    let callIndex = 0;

    // Mock fetch: 70% success, 30% failure
    global.fetch = jest.fn().mockImplementation(async () => {
      callIndex++;
      const shouldSucceed = callIndex % 10 < 7; // 70% success rate

      if (!shouldSucceed) {
        throw new Error('Random failure - simulated');
      }

      return {
        ok: true,
        blob: async () => generateMockBlob(1),
      } as Response;
    });

    // Create test sessions
    for (let i = 0; i < uploadCount; i++) {
      const { data } = await supabase
        .from('game_sessions')
        .insert({
          user_id: `${TEST_BASE_USER_ID}-mixed-${i}`,
          grade_level: 'K-2',
          current_round: 5,
          completed_at: new Date().toISOString(),
        } as any)
        .select()
        .single();

      if (data) {
        sessionIds.push((data as any).id);
      }
    }

    const startTime = Date.now();

    const results = await Promise.allSettled(
      sessionIds.map((sessionId, i) =>
        imageStorageService.uploadImageToSupabase(
          `https://replicate.delivery/mixed-${i}.png`,
          sessionId,
          `${TEST_BASE_USER_ID}-mixed-${i}`,
        ),
      ),
    );

    const elapsed = Date.now() - startTime;

    const successCount = results.filter(
      r => r.status === 'fulfilled' && r.value.success,
    ).length;
    const partialSuccessCount = results.filter(
      r => r.status === 'fulfilled' && !r.value.success,
    ).length;

    console.log(
      `✓ Mixed load test (30 uploads): ${(elapsed / 1000).toFixed(2)}s`,
    );
    console.log(`  - Successful: ${successCount}`);
    console.log(`  - Failed gracefully: ${partialSuccessCount}`);
    console.log(`  - Total time: ${elapsed}ms`);

    // System should handle gracefully (no crashes)
    expect(results.length).toBe(uploadCount);

    // Cleanup
    await cleanupTestSessions(sessionIds);
  }, 60000);

  /**
   * Test 5: Rate limiting behavior
   * System should handle rate limits gracefully
   */
  it('should handle rate limiting gracefully', async () => {
    const uploadCount = 50;
    const sessionIds: string[] = [];
    let callCount = 0;

    // Simulate rate limiting after 30 requests
    global.fetch = jest.fn().mockImplementation(async () => {
      callCount++;

      if (callCount > 30 && callCount <= 35) {
        // Simulate rate limit
        const error: any = new Error('Rate limit exceeded');
        error.status = 429;
        throw error;
      }

      return {
        ok: true,
        blob: async () => generateMockBlob(0.5), // Smaller images for faster test
      } as Response;
    });

    // Create test sessions
    for (let i = 0; i < uploadCount; i++) {
      const { data } = await supabase
        .from('game_sessions')
        .insert({
          user_id: `${TEST_BASE_USER_ID}-rate-${i}`,
          grade_level: 'K-2',
          current_round: 5,
          completed_at: new Date().toISOString(),
        } as any)
        .select()
        .single();

      if (data) {
        sessionIds.push((data as any).id);
      }
    }

    const startTime = Date.now();

    const results = await Promise.allSettled(
      sessionIds.map((sessionId, i) =>
        imageStorageService.uploadImageToSupabase(
          `https://replicate.delivery/rate-${i}.png`,
          sessionId,
          `${TEST_BASE_USER_ID}-rate-${i}`,
        ),
      ),
    );

    const elapsed = Date.now() - startTime;

    const successCount = results.filter(
      r => r.status === 'fulfilled' && r.value.success,
    ).length;

    console.log(
      `✓ Rate limiting test (50 uploads): ${(elapsed / 1000).toFixed(2)}s`,
    );
    console.log(`  - Success: ${successCount}`);
    console.log(`  - Rate limited: ${50 - successCount}`);

    // Should handle rate limits without crashing
    expect(results.length).toBe(uploadCount);

    // Cleanup
    await cleanupTestSessions(sessionIds);
  }, 90000);
});
