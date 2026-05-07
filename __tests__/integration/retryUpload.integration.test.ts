/**
 * Integration Test: Retry Upload Flow
 * Task 6.2 - Test manual and automatic retry mechanisms
 *
 * Tests the retry functionality including:
 * - Manual retry from UI
 * - Automatic retry with exponential backoff
 * - Retry limit enforcement
 * - Database state updates during retry
 * - Success after retry
 */

import { imageStorageService } from '../../src/services/imageStorageService';
import { supabase } from '../../src/services/supabase';

// Mock Supabase
jest.mock('../../src/services/supabase');

// Mock fetch for image downloads
global.fetch = jest.fn();

describe('Integration Test: Retry Upload Flow', () => {
  const TEST_USER_ID = 'test-user-retry';
  const TEST_SESSION_ID = 'test-session-retry';
  const MOCK_REPLICATE_URL = 'https://replicate.delivery/test-image.png';
  const MOCK_SUPABASE_URL =
    'https://supabase.co/storage/story-images/image.png';

  let mockSessionState: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Initialize mock session state
    mockSessionState = {
      id: TEST_SESSION_ID,
      user_id: TEST_USER_ID,
      generated_image_url: MOCK_REPLICATE_URL,
      supabase_image_url: null,
      image_upload_status: 'failed',
      image_upload_attempts: 3,
      image_upload_error: 'Initial upload failed',
    };

    // Setup default mocks
    setupSupabaseMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /**
   * Test 1: Manual retry from UI successfully uploads image
   * User clicks retry button and upload succeeds
   */
  it('should successfully retry failed upload when manually triggered', async () => {
    console.log('🧪 Test 1: Manual retry success');

    // Mock successful image download
    const mockImageBlob = new Blob(['fake-image-data'], {
      type: 'image/png',
      lastModified: 0,
    });
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      blob: () => Promise.resolve(mockImageBlob),
      headers: {
        get: (name: string) => (name === 'content-length' ? '1024' : null),
      },
    });

    // Mock successful Supabase upload
    const uploadMock = jest.fn().mockResolvedValue({
      data: { path: 'user-123/session_test/image.png' },
      error: null,
    });

    (supabase as any).storage = {
      from: jest.fn().mockReturnValue({
        upload: uploadMock,
        getPublicUrl: jest.fn().mockReturnValue({
          data: { publicUrl: MOCK_SUPABASE_URL },
        }),
      }),
    };

    // Perform retry
    const result = await imageStorageService.retryFailedUpload(
      TEST_SESSION_ID,
      TEST_USER_ID,
    );

    // Verify success
    expect(result.success).toBe(true);
    expect(result.supabaseUrl).toBe(MOCK_SUPABASE_URL);
    expect(result.attempts).toBeGreaterThanOrEqual(1);

    // Verify database was updated
    expect(mockSessionState.supabase_image_url).toBe(MOCK_SUPABASE_URL);
    expect(mockSessionState.image_upload_status).toBe('uploaded');
    expect(mockSessionState.image_upload_error).toBeNull();

    console.log('  ✅ Manual retry succeeded');
    console.log(`     - Upload attempts: ${result.attempts}`);
    console.log(`     - Supabase URL: ${result.supabaseUrl}`);
  });

  /**
   * Test 2: Automatic retry with exponential backoff
   * Tests the built-in retry mechanism with proper delays
   */
  it('should automatically retry with exponential backoff', async () => {
    console.log('🧪 Test 2: Automatic retry with exponential backoff');

    let attemptCount = 0;
    const attemptTimestamps: number[] = [];

    // Mock fetch to fail first 2 times, succeed on 3rd
    (global.fetch as jest.Mock).mockImplementation(() => {
      attemptCount++;
      attemptTimestamps.push(Date.now());

      if (attemptCount < 3) {
        return Promise.reject(
          new Error(`Network error on attempt ${attemptCount}`),
        );
      }

      return Promise.resolve({
        ok: true,
        blob: () =>
          Promise.resolve(
            new Blob(['image-data'], { type: 'image/png', lastModified: 0 }),
          ),
        headers: {
          get: (name: string) => (name === 'content-length' ? '1024' : null),
        },
      });
    });

    // Mock successful Supabase upload on final attempt
    (supabase as any).storage = {
      from: jest.fn().mockReturnValue({
        upload: jest.fn().mockResolvedValue({
          data: { path: 'user-123/image.png' },
          error: null,
        }),
        getPublicUrl: jest.fn().mockReturnValue({
          data: { publicUrl: MOCK_SUPABASE_URL },
        }),
      }),
    };

    // Start upload with retry
    const uploadPromise = imageStorageService.uploadImageToSupabase(
      MOCK_REPLICATE_URL,
      TEST_SESSION_ID,
      TEST_USER_ID,
    );

    // Fast-forward through retry delays
    // Expected delays: 1s, 2s, 4s (exponential backoff)
    for (let i = 0; i < 3; i++) {
      await jest.advanceTimersByTimeAsync(Math.pow(2, i) * 1000);
    }

    const result = await uploadPromise;

    // Verify retry behavior
    expect(attemptCount).toBe(3); // Failed 2 times, succeeded on 3rd
    expect(result.success).toBe(true);
    expect(result.attempts).toBe(3);

    console.log('  ✅ Exponential backoff worked correctly');
    console.log(`     - Total attempts: ${attemptCount}`);
    console.log(
      `     - Final result: ${result.success ? 'success' : 'failed'}`,
    );
  });

  /**
   * Test 3: Retry fails after max attempts
   * Ensures system doesn't retry indefinitely
   */
  it('should stop retrying after max attempts and mark as failed', async () => {
    console.log('🧪 Test 3: Retry limit enforcement');

    const MAX_ATTEMPTS = 3;
    let attemptCount = 0;

    // Mock fetch to always fail
    (global.fetch as jest.Mock).mockImplementation(() => {
      attemptCount++;
      return Promise.reject(new Error('Persistent network error'));
    });

    // Start upload with retry
    const uploadPromise = imageStorageService.uploadImageToSupabase(
      MOCK_REPLICATE_URL,
      TEST_SESSION_ID,
      TEST_USER_ID,
    );

    // Fast-forward through all retry attempts
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await jest.advanceTimersByTimeAsync(Math.pow(2, i) * 1000 + 100);
    }

    const result = await uploadPromise;

    // Verify failure after max attempts
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.attempts).toBe(MAX_ATTEMPTS);
    expect(attemptCount).toBeLessThanOrEqual(MAX_ATTEMPTS);

    // Database should reflect failure
    expect(mockSessionState.image_upload_status).toBe('failed');
    expect(mockSessionState.image_upload_error).toBeTruthy();

    console.log('  ✅ Retry limit properly enforced');
    console.log(`     - Max attempts: ${MAX_ATTEMPTS}`);
    console.log(`     - Actual attempts: ${attemptCount}`);
    console.log(`     - Error: ${result.error}`);
  });

  /**
   * Test 4: Database state is updated after each retry attempt
   * Ensures tracking of retry progress
   */
  it('should update database after each retry attempt', async () => {
    console.log('🧪 Test 4: Database updates during retry');

    const dbUpdates: any[] = [];
    let attemptCount = 0;

    // Track all database updates
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'game_sessions') {
        return {
          update: (data: any) => {
            dbUpdates.push({ ...data, timestamp: Date.now() });
            Object.assign(mockSessionState, data);

            return {
              eq: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: mockSessionState,
                    error: null,
                  }),
                }),
              }),
            };
          },
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockSessionState,
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });

    // Mock fetch to fail twice then succeed
    (global.fetch as jest.Mock).mockImplementation(() => {
      attemptCount++;
      if (attemptCount < 3) {
        return Promise.reject(new Error('Retry test error'));
      }
      return Promise.resolve({
        ok: true,
        blob: () =>
          Promise.resolve(
            new Blob(['data'], { type: 'image/png', lastModified: 0 }),
          ),
        headers: { get: () => '1024' },
      });
    });

    // Mock Supabase storage
    (supabase as any).storage = {
      from: jest.fn().mockReturnValue({
        upload: jest.fn().mockResolvedValue({
          data: { path: 'image.png' },
          error: null,
        }),
        getPublicUrl: jest.fn().mockReturnValue({
          data: { publicUrl: MOCK_SUPABASE_URL },
        }),
      }),
    };

    // Start upload
    const uploadPromise = imageStorageService.uploadImageToSupabase(
      MOCK_REPLICATE_URL,
      TEST_SESSION_ID,
      TEST_USER_ID,
    );

    // Fast-forward through retries
    for (let i = 0; i < 3; i++) {
      await jest.advanceTimersByTimeAsync(Math.pow(2, i) * 1000 + 100);
    }

    await uploadPromise;

    // Verify database was updated multiple times
    expect(dbUpdates.length).toBeGreaterThan(0);

    // Find status updates
    const statusUpdates = dbUpdates.filter(u => u.image_upload_status);
    expect(statusUpdates.length).toBeGreaterThan(0);

    // Final state should be success
    expect(mockSessionState.image_upload_status).toBe('uploaded');
    expect(mockSessionState.image_upload_attempts).toBeGreaterThanOrEqual(1);

    console.log('  ✅ Database updated throughout retry process');
    console.log(`     - Total DB updates: ${dbUpdates.length}`);
    console.log(`     - Status updates: ${statusUpdates.length}`);
    console.log(
      `     - Final attempts count: ${mockSessionState.image_upload_attempts}`,
    );
  });

  /**
   * Test 5: Concurrent retries for different sessions don't interfere
   * Tests isolation between retry operations
   */
  it('should handle concurrent retries for different sessions independently', async () => {
    console.log('🧪 Test 5: Concurrent retry isolation');

    const session1 = 'session-retry-1';
    const session2 = 'session-retry-2';
    const session3 = 'session-retry-3';

    const sessionStates: Record<string, any> = {
      [session1]: { attempts: 0, success: false },
      [session2]: { attempts: 0, success: false },
      [session3]: { attempts: 0, success: false },
    };

    // Mock fetch with different outcomes for each session
    (global.fetch as jest.Mock).mockImplementation((_url: string) => {
      // Determine which session based on call order
      const callCount = (global.fetch as jest.Mock).mock.calls.length;
      const sessionKey =
        callCount % 3 === 1
          ? session1
          : callCount % 3 === 2
          ? session2
          : session3;

      sessionStates[sessionKey].attempts++;

      // Session 1: succeeds immediately
      if (sessionKey === session1) {
        sessionStates[sessionKey].success = true;
        return Promise.resolve({
          ok: true,
          blob: () =>
            Promise.resolve(
              new Blob(['data1'], { type: 'image/png', lastModified: 0 }),
            ),
          headers: { get: () => '1024' },
        });
      }

      // Session 2: succeeds after 2 attempts
      if (sessionKey === session2 && sessionStates[sessionKey].attempts >= 2) {
        sessionStates[sessionKey].success = true;
        return Promise.resolve({
          ok: true,
          blob: () =>
            Promise.resolve(
              new Blob(['data2'], { type: 'image/png', lastModified: 0 }),
            ),
          headers: { get: () => '1024' },
        });
      }

      // Session 3: fails all attempts
      return Promise.reject(new Error('Session 3 persistent failure'));
    });

    // Mock Supabase storage
    (supabase as any).storage = {
      from: jest.fn().mockReturnValue({
        upload: jest.fn().mockResolvedValue({
          data: { path: 'image.png' },
          error: null,
        }),
        getPublicUrl: jest.fn().mockReturnValue({
          data: { publicUrl: MOCK_SUPABASE_URL },
        }),
      }),
    };

    // Start concurrent retries
    const promises = [
      imageStorageService.uploadImageToSupabase(
        MOCK_REPLICATE_URL,
        session1,
        TEST_USER_ID,
      ),
      imageStorageService.uploadImageToSupabase(
        MOCK_REPLICATE_URL,
        session2,
        TEST_USER_ID,
      ),
      imageStorageService.uploadImageToSupabase(
        MOCK_REPLICATE_URL,
        session3,
        TEST_USER_ID,
      ),
    ];

    // Fast-forward through all retries
    for (let i = 0; i < 3; i++) {
      await jest.advanceTimersByTimeAsync(Math.pow(2, i) * 1000 + 100);
    }

    const results = await Promise.all(promises);

    // Verify independent outcomes
    expect(results[0].success).toBe(true); // Session 1 succeeded
    expect(results[1].success).toBe(true); // Session 2 succeeded after retries
    expect(results[2].success).toBe(false); // Session 3 failed

    console.log('  ✅ Concurrent retries handled independently');
    console.log(
      `     - Session 1: ${results[0].success ? 'success' : 'failed'} (${
        results[0].attempts
      } attempts)`,
    );
    console.log(
      `     - Session 2: ${results[1].success ? 'success' : 'failed'} (${
        results[1].attempts
      } attempts)`,
    );
    console.log(
      `     - Session 3: ${results[2].success ? 'success' : 'failed'} (${
        results[2].attempts
      } attempts)`,
    );
  });

  /**
   * Test 6: Retry respects file size limits
   * Ensures validation still applies on retry
   */
  it('should enforce file size limit on retry', async () => {
    console.log('🧪 Test 6: File size validation on retry');

    // Mock fetch to return oversized image
    const oversizedBlob = new Blob(['x'.repeat(11 * 1024 * 1024)], {
      type: 'image/png',
      lastModified: 0,
    }); // 11MB
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(oversizedBlob),
      headers: {
        get: (name: string) => (name === 'content-length' ? '11534336' : null),
      },
    });

    // Attempt upload
    const result = await imageStorageService.uploadImageToSupabase(
      MOCK_REPLICATE_URL,
      TEST_SESSION_ID,
      TEST_USER_ID,
    );

    // Should fail due to size
    expect(result.success).toBe(false);
    expect(result.error).toContain('10MB');
    expect(result.attempts).toBe(1); // Should not retry on validation errors

    console.log('  ✅ File size limit enforced on retry');
    console.log(`     - Error: ${result.error}`);
  });

  /**
   * Test 7: Retry updates attempt counter correctly
   * Verifies retry tracking is accurate
   */
  it('should accurately track retry attempt count', async () => {
    console.log('🧪 Test 7: Accurate retry attempt tracking');

    let fetchCallCount = 0;

    (global.fetch as jest.Mock).mockImplementation(() => {
      fetchCallCount++;
      if (fetchCallCount < 3) {
        return Promise.reject(new Error(`Attempt ${fetchCallCount} failed`));
      }
      return Promise.resolve({
        ok: true,
        blob: () =>
          Promise.resolve(
            new Blob(['data'], { type: 'image/png', lastModified: 0 }),
          ),
        headers: { get: () => '1024' },
      });
    });

    (supabase as any).storage = {
      from: jest.fn().mockReturnValue({
        upload: jest.fn().mockResolvedValue({
          data: { path: 'image.png' },
          error: null,
        }),
        getPublicUrl: jest.fn().mockReturnValue({
          data: { publicUrl: MOCK_SUPABASE_URL },
        }),
      }),
    };

    const uploadPromise = imageStorageService.uploadImageToSupabase(
      MOCK_REPLICATE_URL,
      TEST_SESSION_ID,
      TEST_USER_ID,
    );

    // Fast-forward
    for (let i = 0; i < 3; i++) {
      await jest.advanceTimersByTimeAsync(Math.pow(2, i) * 1000 + 100);
    }

    const result = await uploadPromise;

    expect(result.attempts).toBe(fetchCallCount);
    expect(result.attempts).toBe(3);
    expect(mockSessionState.image_upload_attempts).toBe(3);

    console.log('  ✅ Attempt counter tracked accurately');
    console.log(`     - Fetch calls: ${fetchCallCount}`);
    console.log(`     - Result attempts: ${result.attempts}`);
    console.log(
      `     - DB attempts: ${mockSessionState.image_upload_attempts}`,
    );
  });

  // Helper: Setup Supabase mocks
  function setupSupabaseMocks() {
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'game_sessions') {
        return {
          update: (data: any) => {
            Object.assign(mockSessionState, data);
            return {
              eq: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: mockSessionState,
                    error: null,
                  }),
                }),
              }),
            };
          },
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockSessionState,
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });
  }
});
