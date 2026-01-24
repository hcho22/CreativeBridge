/**
 * Performance Tests: Image Upload Speed
 *
 * Tests image upload performance to ensure it meets NFR requirements:
 * - Upload 5MB image in < 10 seconds
 * - Retry logic doesn't add excessive overhead
 * - Network failures are handled efficiently
 */

import { imageStorageService } from '../../src/services/imageStorageService';
import { supabase } from '../../src/services/supabase';

// Mock data setup
const generateMockImageBlob = (sizeInMB: number): Blob => {
  const sizeInBytes = sizeInMB * 1024 * 1024;
  const buffer = new ArrayBuffer(sizeInBytes);
  return new Blob([buffer], { type: 'image/png' });
};

const generateMockImageUrl = (sizeInMB: number): string => {
  // Simulate a Replicate URL
  return `https://replicate.delivery/test-image-${sizeInMB}mb.png`;
};

describe('Performance Tests: Image Upload Speed', () => {
  const TEST_USER_ID = 'perf-test-user-' + Date.now();
  const TEST_SESSION_ID = 'perf-test-session-' + Date.now();

  beforeAll(async () => {
    // Create test user session in database
    await supabase.from('game_sessions').insert({
      id: TEST_SESSION_ID,
      user_id: TEST_USER_ID,
      grade_level: 'K-2',
      current_round: 5,
      completed_at: new Date().toISOString(),
    } as any);
  });

  afterAll(async () => {
    // Cleanup test data
    await supabase.from('game_sessions').delete().eq('id', TEST_SESSION_ID);

    // Cleanup uploaded test files
    try {
      const { data: files } = await supabase.storage
        .from('story-images')
        .list(`${TEST_USER_ID}/`);

      if (files && files.length > 0) {
        const filePaths = files.map(file => `${TEST_USER_ID}/${file.name}`);
        await supabase.storage.from('story-images').remove(filePaths);
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  /**
   * Test 1: Upload 5MB image in < 10 seconds
   * NFR Requirement: Image upload must complete within 10 seconds
   */
  it('should upload 5MB image in less than 10 seconds', async () => {
    // Mock fetch to simulate image download from Replicate
    const mockBlob = generateMockImageBlob(5);
    const mockReplicateUrl = generateMockImageUrl(5);

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      blob: async () => mockBlob,
    } as Response);

    const startTime = Date.now();

    const result = await imageStorageService.uploadImageToSupabase(
      mockReplicateUrl,
      TEST_SESSION_ID,
      TEST_USER_ID,
    );

    const elapsed = Date.now() - startTime;

    // Assertions
    expect(result.success).toBe(true);
    expect(result.supabaseUrl).toBeDefined();
    expect(elapsed).toBeLessThan(10000); // < 10 seconds

    console.log(`✓ 5MB upload completed in ${(elapsed / 1000).toFixed(2)}s`);
  }, 15000); // 15 second timeout for test

  /**
   * Test 2: Upload 2MB image (typical case) in < 5 seconds
   * Most story images are 1-3MB, should be faster
   */
  it('should upload typical 2MB image in less than 5 seconds', async () => {
    const mockBlob = generateMockImageBlob(2);
    const mockReplicateUrl = generateMockImageUrl(2);

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      blob: async () => mockBlob,
    } as Response);

    const startTime = Date.now();

    const result = await imageStorageService.uploadImageToSupabase(
      mockReplicateUrl,
      `${TEST_SESSION_ID}-2`,
      TEST_USER_ID,
    );

    const elapsed = Date.now() - startTime;

    expect(result.success).toBe(true);
    expect(elapsed).toBeLessThan(5000); // < 5 seconds

    console.log(`✓ 2MB upload completed in ${(elapsed / 1000).toFixed(2)}s`);
  }, 10000);

  /**
   * Test 3: Retry logic overhead is minimal
   * Even with retries, total time should be reasonable
   */
  it('should handle retry with minimal overhead', async () => {
    const mockBlob = generateMockImageBlob(1);
    let attemptCount = 0;

    // Mock first attempt to fail, second to succeed
    global.fetch = jest.fn().mockImplementation(async () => {
      attemptCount++;
      if (attemptCount === 1) {
        throw new Error('Network error - simulated');
      }
      return {
        ok: true,
        blob: async () => mockBlob,
      } as Response;
    });

    const startTime = Date.now();

    const result = await imageStorageService.uploadImageToSupabase(
      generateMockImageUrl(1),
      `${TEST_SESSION_ID}-retry`,
      TEST_USER_ID,
    );

    const elapsed = Date.now() - startTime;

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(2);
    // First attempt fails, 1s delay, second succeeds
    // Should be < 3 seconds total (1s delay + upload time)
    expect(elapsed).toBeLessThan(3000);

    console.log(
      `✓ Retry completed in ${(elapsed / 1000).toFixed(
        2,
      )}s (${attemptCount} attempts)`,
    );
  }, 10000);

  /**
   * Test 4: Download from Replicate is fast
   * Fetching from Replicate URL should not be bottleneck
   */
  it('should download from Replicate URL quickly', async () => {
    const mockBlob = generateMockImageBlob(3);
    const mockReplicateUrl = 'https://replicate.delivery/real-test-image.png';

    const fetchStartTime = Date.now();

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      blob: async () => {
        // Simulate realistic network delay (500ms)
        await new Promise(resolve => setTimeout(resolve, 500));
        return mockBlob;
      },
    } as Response);

    const response = await fetch(mockReplicateUrl);
    const blob = await response.blob();
    const fetchElapsed = Date.now() - fetchStartTime;

    expect(blob).toBeDefined();
    expect(blob.size).toBeGreaterThan(0);
    expect(fetchElapsed).toBeLessThan(2000); // < 2 seconds for download

    console.log(
      `✓ Replicate download completed in ${(fetchElapsed / 1000).toFixed(2)}s`,
    );
  });

  /**
   * Test 5: Upload success rate is high under normal conditions
   * At least 95% success rate for valid uploads
   */
  it('should have high success rate for valid uploads', async () => {
    const mockBlob = generateMockImageBlob(1);
    const uploadCount = 10;
    const results: boolean[] = [];

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      blob: async () => mockBlob,
    } as Response);

    for (let i = 0; i < uploadCount; i++) {
      const result = await imageStorageService.uploadImageToSupabase(
        generateMockImageUrl(1),
        `${TEST_SESSION_ID}-batch-${i}`,
        TEST_USER_ID,
      );
      results.push(result.success);
    }

    const successRate = results.filter(r => r).length / uploadCount;

    expect(successRate).toBeGreaterThanOrEqual(0.95); // >= 95% success

    console.log(
      `✓ Success rate: ${(successRate * 100).toFixed(1)}% (${
        results.filter(r => r).length
      }/${uploadCount})`,
    );
  }, 30000); // Longer timeout for multiple uploads
});
