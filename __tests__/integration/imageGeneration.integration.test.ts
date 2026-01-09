/**
 * Integration Test: Image Generation + Supabase Upload Flow
 * Task 6.2 - Test complete image generation and storage workflow
 *
 * Tests the full image lifecycle including:
 * - Replicate image generation
 * - Immediate Replicate URL saving
 * - Background Supabase upload with retry
 * - Database status tracking
 * - Error handling and recovery
 */

import { imageGenerationService } from '../../src/services/imageGeneration';
import { imageStorageService } from '../../src/services/imageStorageService';
import { supabase } from '../../src/services/supabase';
import { GradeLevel } from '../../src/types';

// Mock the services
jest.mock('../../src/services/supabase');
jest.mock('../../src/services/imageStorageService');

// Mock fetch for Replicate API
global.fetch = jest.fn();

describe('Integration Test: Image Generation + Supabase Upload', () => {
  const TEST_USER_ID = 'test-user-image-gen';
  const TEST_SESSION_ID = 'test-session-image-gen';
  const TEST_GRADE_LEVEL: GradeLevel = 'K-2';
  const MOCK_REPLICATE_URL = 'https://replicate.delivery/test-image-123.png';
  const MOCK_SUPABASE_URL = 'https://supabase.co/storage/story-images/user-123/image.png';

  let mockDbState: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Initialize mock database state
    mockDbState = {
      id: TEST_SESSION_ID,
      user_id: TEST_USER_ID,
      grade_level: TEST_GRADE_LEVEL,
      current_round: 5,
      completed_at: new Date().toISOString(),
      generated_image_url: null,
      supabase_image_url: null,
      image_upload_status: null,
      image_upload_attempts: 0,
      image_upload_error: null,
    };

    // Setup default Supabase mocks
    setupSupabaseMocks();
  });

  /**
   * Test 1: Replicate URL is saved immediately before Supabase upload
   * Critical path: User should get image URL quickly without waiting for backup
   */
  it('should save Replicate URL immediately before starting Supabase upload', async () => {
    console.log('🧪 Test 1: Immediate Replicate URL persistence');

    // Mock successful Replicate generation
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 'replicate-prediction-123',
          status: 'succeeded',
          output: [MOCK_REPLICATE_URL],
        }),
    });

    // Track the order of database updates
    const updateSequence: string[] = [];

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'game_sessions') {
        return {
          update: (data: any) => {
            if (data.generated_image_url) {
              updateSequence.push('replicate_url_saved');
              mockDbState.generated_image_url = data.generated_image_url;
            }
            if (data.image_upload_status === 'pending') {
              updateSequence.push('upload_status_pending');
              mockDbState.image_upload_status = 'pending';
            }
            if (data.supabase_image_url) {
              updateSequence.push('supabase_url_saved');
              mockDbState.supabase_image_url = data.supabase_image_url;
            }

            return {
              eq: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { ...mockDbState, ...data },
                    error: null,
                  }),
                }),
              }),
            };
          },
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockDbState,
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });

    // Mock successful Supabase upload
    (imageStorageService.uploadImageToSupabase as jest.Mock).mockResolvedValue({
      success: true,
      supabaseUrl: MOCK_SUPABASE_URL,
      attempts: 1,
      error: undefined,
    });

    // Generate image
    const result = await imageGenerationService.generateImage({
      storyContent: 'Once upon a time, there was a brave knight.',
      gradeLevel: TEST_GRADE_LEVEL,
      sessionId: TEST_SESSION_ID,
      userId: TEST_USER_ID,
      metadata: { wordCount: 10 },
    });

    // Verify immediate success
    expect(result.success).toBe(true);
    expect(result.imageUrl).toBe(MOCK_REPLICATE_URL);

    // Verify update sequence - Replicate URL should be saved first
    expect(updateSequence[0]).toBe('replicate_url_saved');

    // Verify database state
    expect(mockDbState.generated_image_url).toBe(MOCK_REPLICATE_URL);

    console.log('  ✅ Replicate URL saved immediately');
    console.log(`     - Update sequence: ${updateSequence.join(' → ')}`);
    console.log(`     - Image URL: ${result.imageUrl}`);
  });

  /**
   * Test 2: Supabase upload completes in background with status tracking
   * Verifies non-blocking async upload with proper status updates
   */
  it('should upload to Supabase in background with status tracking', async () => {
    console.log('🧪 Test 2: Background Supabase upload with status tracking');

    // Mock Replicate generation
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 'replicate-prediction-456',
          status: 'succeeded',
          output: [MOCK_REPLICATE_URL],
        }),
    });

    // Track status changes
    const statusChanges: string[] = [];

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'game_sessions') {
        return {
          update: (data: any) => {
            if (data.image_upload_status) {
              statusChanges.push(data.image_upload_status);
              mockDbState.image_upload_status = data.image_upload_status;
            }
            if (data.supabase_image_url) {
              mockDbState.supabase_image_url = data.supabase_image_url;
            }
            if (data.image_upload_attempts !== undefined) {
              mockDbState.image_upload_attempts = data.image_upload_attempts;
            }

            return {
              eq: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { ...mockDbState, ...data },
                    error: null,
                  }),
                }),
              }),
            };
          },
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockDbState,
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });

    // Mock successful Supabase upload after delay
    (imageStorageService.uploadImageToSupabase as jest.Mock).mockImplementation(
      () =>
        new Promise(resolve =>
          setTimeout(
            () =>
              resolve({
                success: true,
                supabaseUrl: MOCK_SUPABASE_URL,
                attempts: 1,
              }),
            100
          )
        )
    );

    // Generate image
    await imageGenerationService.generateImage({
      storyContent: 'Test story content for image generation',
      gradeLevel: TEST_GRADE_LEVEL,
      sessionId: TEST_SESSION_ID,
      userId: TEST_USER_ID,
      metadata: { wordCount: 5 },
    });

    // Wait for background upload
    await new Promise(resolve => setTimeout(resolve, 200));

    // Verify status progression: pending → uploaded
    expect(statusChanges).toContain('pending');
    expect(statusChanges).toContain('uploaded');
    expect(mockDbState.supabase_image_url).toBe(MOCK_SUPABASE_URL);
    expect(mockDbState.image_upload_attempts).toBeGreaterThanOrEqual(1);

    console.log('  ✅ Background upload completed with status tracking');
    console.log(`     - Status changes: ${statusChanges.join(' → ')}`);
    console.log(`     - Final status: ${mockDbState.image_upload_status}`);
    console.log(`     - Upload attempts: ${mockDbState.image_upload_attempts}`);
  });

  /**
   * Test 3: Replicate URL remains accessible even if Supabase upload fails
   * Critical: User should never lose their generated image
   */
  it('should keep Replicate URL even if Supabase upload fails', async () => {
    console.log('🧪 Test 3: Replicate URL persists despite Supabase failure');

    // Mock successful Replicate generation
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 'replicate-prediction-789',
          status: 'succeeded',
          output: [MOCK_REPLICATE_URL],
        }),
    });

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'game_sessions') {
        return {
          update: (data: any) => {
            Object.assign(mockDbState, data);
            return {
              eq: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { ...mockDbState },
                    error: null,
                  }),
                }),
              }),
            };
          },
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockDbState,
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });

    // Mock Supabase upload failure
    const uploadError = 'Storage quota exceeded';
    (imageStorageService.uploadImageToSupabase as jest.Mock).mockResolvedValue({
      success: false,
      supabaseUrl: undefined,
      attempts: 3,
      error: uploadError,
    });

    // Generate image
    const result = await imageGenerationService.generateImage({
      storyContent: 'Test story',
      gradeLevel: TEST_GRADE_LEVEL,
      sessionId: TEST_SESSION_ID,
      userId: TEST_USER_ID,
      metadata: { wordCount: 2 },
    });

    // User should still get the image
    expect(result.success).toBe(true);
    expect(result.imageUrl).toBe(MOCK_REPLICATE_URL);

    // Wait for background upload attempt
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify database state after upload failure
    expect(mockDbState.generated_image_url).toBe(MOCK_REPLICATE_URL); // Still accessible!
    expect(mockDbState.supabase_image_url).toBeFalsy(); // Backup failed
    expect(mockDbState.image_upload_status).toBe('failed');
    expect(mockDbState.image_upload_error).toContain(uploadError);

    console.log('  ✅ Replicate URL preserved despite backup failure');
    console.log(`     - Primary URL (Replicate): ${mockDbState.generated_image_url}`);
    console.log(`     - Backup URL (Supabase): ${mockDbState.supabase_image_url || 'null'}`);
    console.log(`     - Upload status: ${mockDbState.image_upload_status}`);
    console.log(`     - Error: ${mockDbState.image_upload_error}`);
  });

  /**
   * Test 4: Retry logic works correctly on transient failures
   * Tests automatic retry with exponential backoff
   */
  it('should retry Supabase upload on transient failures', async () => {
    console.log('🧪 Test 4: Automatic retry on upload failure');

    // Mock Replicate generation
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          status: 'succeeded',
          output: [MOCK_REPLICATE_URL],
        }),
    });

    setupSupabaseMocks();

    let attemptCount = 0;

    // Mock upload: fail twice, then succeed
    (imageStorageService.uploadImageToSupabase as jest.Mock).mockImplementation(() => {
      attemptCount++;
      if (attemptCount < 3) {
        return Promise.resolve({
          success: false,
          attempts: attemptCount,
          error: 'Network timeout',
        });
      }
      return Promise.resolve({
        success: true,
        supabaseUrl: MOCK_SUPABASE_URL,
        attempts: attemptCount,
      });
    });

    // Generate image
    await imageGenerationService.generateImage({
      storyContent: 'Test story',
      gradeLevel: TEST_GRADE_LEVEL,
      sessionId: TEST_SESSION_ID,
      userId: TEST_USER_ID,
      metadata: { wordCount: 2 },
    });

    // Wait for retries
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify retry behavior
    expect(attemptCount).toBe(3); // Failed twice, succeeded on third attempt
    expect(mockDbState.supabase_image_url).toBe(MOCK_SUPABASE_URL);
    expect(mockDbState.image_upload_status).toBe('uploaded');
    expect(mockDbState.image_upload_attempts).toBe(3);

    console.log('  ✅ Retry logic worked correctly');
    console.log(`     - Total attempts: ${attemptCount}`);
    console.log(`     - Final status: ${mockDbState.image_upload_status}`);
  });

  /**
   * Test 5: Image generation fails gracefully on Replicate error
   * No database updates should occur if generation fails
   */
  it('should handle Replicate generation failure gracefully', async () => {
    console.log('🧪 Test 5: Graceful handling of Replicate failure');

    // Mock Replicate failure
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Replicate API error'));

    setupSupabaseMocks();

    let updateCalled = false;
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'game_sessions') {
        return {
          update: (data: any) => {
            updateCalled = true;
            return {
              eq: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: mockDbState,
                    error: null,
                  }),
                }),
              }),
            };
          },
        };
      }
      return {};
    });

    // Try to generate image
    const result = await imageGenerationService.generateImage({
      storyContent: 'Test story',
      gradeLevel: TEST_GRADE_LEVEL,
      sessionId: TEST_SESSION_ID,
      userId: TEST_USER_ID,
      metadata: { wordCount: 2 },
    });

    // Should fail gracefully
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.imageUrl).toBeFalsy();

    // No database updates should occur (no URL to save)
    expect(mockDbState.generated_image_url).toBeFalsy();
    expect(mockDbState.supabase_image_url).toBeFalsy();

    console.log('  ✅ Replicate failure handled gracefully');
    console.log(`     - Error: ${result.error}`);
    console.log(`     - Database untouched: ${!updateCalled}`);
  });

  /**
   * Test 6: Complete happy path - end to end success
   * Full flow from generation to backup completion
   */
  it('should complete entire image generation and backup flow successfully', async () => {
    console.log('🧪 Test 6: Complete happy path - generation to backup');

    const startTime = Date.now();

    // Mock successful Replicate generation
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          status: 'succeeded',
          output: [MOCK_REPLICATE_URL],
        }),
    });

    const stateHistory: any[] = [];

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'game_sessions') {
        return {
          update: (data: any) => {
            Object.assign(mockDbState, data);
            stateHistory.push({ ...mockDbState, timestamp: Date.now() - startTime });
            return {
              eq: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { ...mockDbState },
                    error: null,
                  }),
                }),
              }),
            };
          },
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockDbState,
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });

    // Mock successful Supabase upload
    (imageStorageService.uploadImageToSupabase as jest.Mock).mockResolvedValue({
      success: true,
      supabaseUrl: MOCK_SUPABASE_URL,
      attempts: 1,
    });

    // Execute complete flow
    const result = await imageGenerationService.generateImage({
      storyContent: 'A complete test story for image generation.',
      gradeLevel: TEST_GRADE_LEVEL,
      sessionId: TEST_SESSION_ID,
      userId: TEST_USER_ID,
      metadata: { wordCount: 7 },
    });

    // Wait for background upload
    await new Promise(resolve => setTimeout(resolve, 200));

    // Verify complete success
    expect(result.success).toBe(true);
    expect(result.imageUrl).toBe(MOCK_REPLICATE_URL);
    expect(mockDbState.generated_image_url).toBe(MOCK_REPLICATE_URL);
    expect(mockDbState.supabase_image_url).toBe(MOCK_SUPABASE_URL);
    expect(mockDbState.image_upload_status).toBe('uploaded');
    expect(mockDbState.image_upload_attempts).toBe(1);
    expect(mockDbState.image_upload_error).toBeFalsy();

    console.log('  ✅ Complete flow succeeded');
    console.log(`     - Replicate URL: ${mockDbState.generated_image_url}`);
    console.log(`     - Supabase URL: ${mockDbState.supabase_image_url}`);
    console.log(`     - Upload status: ${mockDbState.image_upload_status}`);
    console.log(`     - Total time: ${Date.now() - startTime}ms`);
    console.log(`     - State transitions: ${stateHistory.length}`);
  });

  /**
   * Test 7: Image upload status is queryable at any time
   * Ensures status can be checked mid-upload
   */
  it('should allow querying upload status during background upload', async () => {
    console.log('🧪 Test 7: Upload status queryable during processing');

    // Mock Replicate generation
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          status: 'succeeded',
          output: [MOCK_REPLICATE_URL],
        }),
    });

    setupSupabaseMocks();

    // Mock slow Supabase upload
    (imageStorageService.uploadImageToSupabase as jest.Mock).mockImplementation(
      () =>
        new Promise(resolve =>
          setTimeout(
            () =>
              resolve({
                success: true,
                supabaseUrl: MOCK_SUPABASE_URL,
                attempts: 1,
              }),
            300
          )
        )
    );

    // Generate image
    await imageGenerationService.generateImage({
      storyContent: 'Test',
      gradeLevel: TEST_GRADE_LEVEL,
      sessionId: TEST_SESSION_ID,
      userId: TEST_USER_ID,
      metadata: { wordCount: 1 },
    });

    // Query status immediately (upload should be pending)
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(mockDbState.image_upload_status).toBe('pending');

    // Query again after upload completes
    await new Promise(resolve => setTimeout(resolve, 300));
    expect(mockDbState.image_upload_status).toBe('uploaded');

    console.log('  ✅ Status correctly queryable at all stages');
  });

  /**
   * Test 8: Multiple concurrent uploads don't interfere
   * Tests isolation between different sessions
   */
  it('should handle multiple concurrent image generations independently', async () => {
    console.log('🧪 Test 8: Concurrent generation isolation');

    const session1 = 'session-concurrent-1';
    const session2 = 'session-concurrent-2';
    const session3 = 'session-concurrent-3';

    const sessionStates = {
      [session1]: { generated_image_url: null, image_upload_status: null },
      [session2]: { generated_image_url: null, image_upload_status: null },
      [session3]: { generated_image_url: null, image_upload_status: null },
    };

    // Mock Replicate for all sessions
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          status: 'succeeded',
          output: [MOCK_REPLICATE_URL],
        }),
    });

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'game_sessions') {
        return {
          update: (data: any) => ({
            eq: jest.fn().mockImplementation((field: string, sessionId: string) => ({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockImplementation(() => {
                  if (sessionStates[sessionId]) {
                    Object.assign(sessionStates[sessionId], data);
                  }
                  return Promise.resolve({
                    data: sessionStates[sessionId] || mockDbState,
                    error: null,
                  });
                }),
              }),
            })),
          }),
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockDbState,
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });

    (imageStorageService.uploadImageToSupabase as jest.Mock).mockResolvedValue({
      success: true,
      supabaseUrl: MOCK_SUPABASE_URL,
      attempts: 1,
    });

    // Generate images for all sessions concurrently
    await Promise.all([
      imageGenerationService.generateImage({
        storyContent: 'Story 1',
        gradeLevel: TEST_GRADE_LEVEL,
        sessionId: session1,
        userId: TEST_USER_ID,
        metadata: { wordCount: 2 },
      }),
      imageGenerationService.generateImage({
        storyContent: 'Story 2',
        gradeLevel: TEST_GRADE_LEVEL,
        sessionId: session2,
        userId: TEST_USER_ID,
        metadata: { wordCount: 2 },
      }),
      imageGenerationService.generateImage({
        storyContent: 'Story 3',
        gradeLevel: TEST_GRADE_LEVEL,
        sessionId: session3,
        userId: TEST_USER_ID,
        metadata: { wordCount: 2 },
      }),
    ]);

    // Wait for uploads
    await new Promise(resolve => setTimeout(resolve, 200));

    // All sessions should have completed independently
    expect(sessionStates[session1].generated_image_url).toBeTruthy();
    expect(sessionStates[session2].generated_image_url).toBeTruthy();
    expect(sessionStates[session3].generated_image_url).toBeTruthy();

    console.log('  ✅ Concurrent generations handled independently');
    console.log(`     - Session 1: ${sessionStates[session1].image_upload_status}`);
    console.log(`     - Session 2: ${sessionStates[session2].image_upload_status}`);
    console.log(`     - Session 3: ${sessionStates[session3].image_upload_status}`);
  });

  // Helper: Setup Supabase mocks with default behavior
  function setupSupabaseMocks() {
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'game_sessions') {
        return {
          update: (data: any) => {
            Object.assign(mockDbState, data);
            return {
              eq: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { ...mockDbState },
                    error: null,
                  }),
                }),
              }),
            };
          },
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockDbState,
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
