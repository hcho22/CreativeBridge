/**
 * Integration Test: Offline to Online Sync
 * Task 6.2 - Test offline caching and online synchronization
 *
 * Tests the offline/online data flow including:
 * - Caching session data locally when online
 * - Retrieving from cache when offline
 * - Syncing local changes when back online
 * - Conflict resolution
 * - Image URL persistence across offline/online states
 */

import { storySessionManager } from '../../src/services/storySessionManager';
import { supabase } from '../../src/services/supabase';
import { GradeLevel } from '../../src/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage');

// Mock Supabase
jest.mock('../../src/services/supabase');

describe('Integration Test: Offline to Online Sync', () => {
  const TEST_USER_ID = 'test-user-offline';
  const TEST_GRADE_LEVEL: GradeLevel = 'K-2';
  const MOCK_REPLICATE_URL = 'https://replicate.delivery/offline-test.png';
  const MOCK_SUPABASE_URL =
    'https://supabase.co/storage/story-images/offline-test.png';

  let mockCache: Record<string, any> = {};

  beforeEach(() => {
    jest.clearAllMocks();
    mockCache = {};

    // Setup AsyncStorage mock
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      return Promise.resolve(mockCache[key] || null);
    });

    (AsyncStorage.setItem as jest.Mock).mockImplementation(
      (key: string, value: string) => {
        mockCache[key] = value;
        return Promise.resolve();
      },
    );

    // Setup Supabase mock
    setupSupabaseMock();
  });

  /**
   * Test 1: Session data is cached locally when online
   * Ensures data persistence for offline access
   */
  it('should cache session data to AsyncStorage when online', async () => {
    console.log('🧪 Test 1: Online session caching');

    // Create session (simulates online operation)
    const session = await storySessionManager.createSession(
      TEST_USER_ID,
      TEST_GRADE_LEVEL,
    );

    // Update session with data
    session.current_round = 3;
    session.story_content = 'Test story content';
    session.generated_image_url = MOCK_REPLICATE_URL;
    session.supabase_image_url = MOCK_SUPABASE_URL;
    session.image_upload_status = 'uploaded';

    await storySessionManager.updateSession(session);

    // Verify data was cached
    const cachedData = mockCache['@CreativeBridge:sessions'];
    expect(cachedData).toBeTruthy();

    const parsedCache = JSON.parse(cachedData);
    expect(parsedCache[session.id]).toBeTruthy();
    expect(parsedCache[session.id].supabase_image_url).toBe(MOCK_SUPABASE_URL);
    expect(parsedCache[session.id].image_upload_status).toBe('uploaded');

    console.log('  ✅ Session data cached successfully');
    console.log(`     - Cached session ID: ${session.id}`);
    console.log(
      `     - Image URLs cached: ${!!parsedCache[session.id]
        .supabase_image_url}`,
    );
  });

  /**
   * Test 2: Can retrieve session from cache when offline
   * Critical for offline functionality
   */
  it('should retrieve session from cache when offline (database unavailable)', async () => {
    console.log('🧪 Test 2: Offline session retrieval from cache');

    const sessionId = 'offline-test-session';

    // First, cache a session (while "online")
    const cachedSession = {
      id: sessionId,
      user_id: TEST_USER_ID,
      grade_level: TEST_GRADE_LEVEL,
      created_at: new Date().toISOString(),
      current_round: 4,
      story_content: 'Cached story content',
      generated_image_url: MOCK_REPLICATE_URL,
      supabase_image_url: MOCK_SUPABASE_URL,
      image_upload_status: 'uploaded',
      final_score: 0,
      words_written: 25,
      sentences_completed: 5,
      challenges_completed: 0,
      xp_earned: 0,
      isCompleted: false,
      contributions: [],
      sessionStats: {
        totalWords: 25,
        userWords: 12,
        aiWords: 13,
        sessionDuration: 180000,
        contributionCount: 5,
      },
      metadata: {},
    };

    mockCache['@CreativeBridge:sessions'] = JSON.stringify({
      [sessionId]: cachedSession,
    });

    // Simulate offline: make database calls fail
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest
            .fn()
            .mockRejectedValue(new Error('Network request failed')),
        }),
      }),
    });

    // Try to retrieve session (should fall back to cache)
    const session = await storySessionManager.getSession(sessionId);

    expect(session).toBeTruthy();
    expect(session?.id).toBe(sessionId);
    expect(session?.supabase_image_url).toBe(MOCK_SUPABASE_URL);
    expect(session?.image_upload_status).toBe('uploaded');
    expect(session?.story_content).toBe('Cached story content');

    console.log('  ✅ Session retrieved from cache while offline');
    console.log(`     - Session ID: ${session?.id}`);
    console.log(`     - Image accessible: ${!!session?.supabase_image_url}`);
  });

  /**
   * Test 3: Local changes sync to database when back online
   * Tests the offline → online transition
   */
  it('should sync local changes to database when connection restored', async () => {
    console.log('🧪 Test 3: Offline to online sync');

    const sessionId = 'sync-test-session';
    let dbState: any = {
      id: sessionId,
      current_round: 2,
      story_content: 'Old content from server',
    };

    // Start offline
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockRejectedValue(new Error('Offline')),
        }),
      }),
    });

    // Cache initial session
    mockCache['@CreativeBridge:sessions'] = JSON.stringify({
      [sessionId]: {
        id: sessionId,
        user_id: TEST_USER_ID,
        grade_level: TEST_GRADE_LEVEL,
        created_at: new Date().toISOString(),
        current_round: 2,
        story_content: 'Old content from server',
        final_score: 0,
        words_written: 10,
        sentences_completed: 2,
        challenges_completed: 0,
        xp_earned: 0,
        isCompleted: false,
        contributions: [],
        sessionStats: {
          totalWords: 10,
          userWords: 5,
          aiWords: 5,
          sessionDuration: 100000,
          contributionCount: 2,
        },
        metadata: {},
      },
    });

    // Get session (from cache since offline)
    const session = await storySessionManager.getSession(sessionId);
    expect(session).toBeTruthy();

    // Make local changes while offline
    session!.current_round = 3;
    session!.story_content = 'New content added offline';
    session!.words_written = 20;

    // Update session (will only update cache since offline)
    await storySessionManager.updateSession(session!);

    // Verify cache was updated
    const cachedData = JSON.parse(mockCache['@CreativeBridge:sessions']);
    expect(cachedData[sessionId].current_round).toBe(3);
    expect(cachedData[sessionId].story_content).toBe(
      'New content added offline',
    );

    console.log('  - Offline changes cached ✓');

    // Go back online
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'game_sessions') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: dbState,
                error: null,
              }),
            }),
          }),
          update: (data: any) => {
            dbState = { ...dbState, ...data };
            return {
              eq: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: dbState,
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

    // Update session again (should sync to database now)
    await storySessionManager.updateSession(session!);

    // Verify database was updated
    expect(dbState.current_round).toBe(3);
    expect(dbState.story_content).toBe('New content added offline');
    expect(dbState.words_written).toBe(20);

    console.log('  - Online sync completed ✓');
    console.log('  ✅ Offline changes synced to database');
  });

  /**
   * Test 4: Image URLs persist across offline/online transitions
   * Critical: User should always have access to their generated images
   */
  it('should preserve image URLs across offline/online transitions', async () => {
    console.log('🧪 Test 4: Image URL persistence across transitions');

    // Start online, create session with images
    const session = await storySessionManager.createSession(
      TEST_USER_ID,
      TEST_GRADE_LEVEL,
    );
    session.generated_image_url = MOCK_REPLICATE_URL;
    session.supabase_image_url = MOCK_SUPABASE_URL;
    session.image_upload_status = 'uploaded';

    await storySessionManager.updateSession(session);

    // Verify images are cached
    let cachedData = JSON.parse(mockCache['@CreativeBridge:sessions']);
    expect(cachedData[session.id].supabase_image_url).toBe(MOCK_SUPABASE_URL);

    console.log('  - Images cached while online ✓');

    // Go offline
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockRejectedValue(new Error('Offline')),
        }),
      }),
    });

    // Retrieve session offline
    const offlineSession = await storySessionManager.getSession(session.id);

    expect(offlineSession?.supabase_image_url).toBe(MOCK_SUPABASE_URL);
    expect(offlineSession?.generated_image_url).toBe(MOCK_REPLICATE_URL);

    console.log('  - Images accessible while offline ✓');

    // Go back online
    setupSupabaseMock();

    // Retrieve session online
    const onlineSession = await storySessionManager.getSession(session.id);

    expect(onlineSession?.supabase_image_url).toBe(MOCK_SUPABASE_URL);
    expect(onlineSession?.generated_image_url).toBe(MOCK_REPLICATE_URL);

    console.log('  - Images accessible after coming back online ✓');
    console.log('  ✅ Image URLs persisted across all transitions');
  });

  /**
   * Test 5: Conflict resolution when local and remote differ
   * Tests merge strategy for conflicting data
   */
  it('should resolve conflicts when local and remote data differ', async () => {
    console.log('🧪 Test 5: Conflict resolution (remote wins)');

    const sessionId = 'conflict-test-session';

    // Local cache has round 3
    mockCache['@CreativeBridge:sessions'] = JSON.stringify({
      [sessionId]: {
        id: sessionId,
        user_id: TEST_USER_ID,
        grade_level: TEST_GRADE_LEVEL,
        created_at: new Date().toISOString(),
        current_round: 3,
        story_content: 'Local content',
        words_written: 15,
        supabase_image_url: null,
        final_score: 0,
        sentences_completed: 3,
        challenges_completed: 0,
        xp_earned: 0,
        isCompleted: false,
        contributions: [],
        sessionStats: {
          totalWords: 15,
          userWords: 8,
          aiWords: 7,
          sessionDuration: 150000,
          contributionCount: 3,
        },
        metadata: {},
      },
    });

    // Remote database has round 5 (completed)
    const remoteSession = {
      id: sessionId,
      user_id: TEST_USER_ID,
      grade_level: TEST_GRADE_LEVEL,
      created_at: new Date().toISOString(),
      current_round: 5,
      story_content: 'Complete story from remote',
      words_written: 50,
      completed_at: new Date().toISOString(),
      supabase_image_url: MOCK_SUPABASE_URL,
      image_upload_status: 'uploaded',
    };

    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: remoteSession,
            error: null,
          }),
        }),
      }),
    });

    // Get session (should prioritize remote data)
    const session = await storySessionManager.getSession(sessionId);

    // Remote data should win (more complete)
    expect(session?.current_round).toBe(5);
    expect(session?.story_content).toBe('Complete story from remote');
    expect(session?.supabase_image_url).toBe(MOCK_SUPABASE_URL);
    expect(session?.isCompleted).toBe(true);

    // Cache should be updated with remote data
    const updatedCache = JSON.parse(mockCache['@CreativeBridge:sessions']);
    expect(updatedCache[sessionId].current_round).toBe(5);

    console.log('  ✅ Conflict resolved: remote data took precedence');
    console.log(`     - Local round: 3 → Remote round: 5`);
    console.log(`     - Cache updated with remote data`);
  });

  /**
   * Test 6: Multiple sessions cached and synced correctly
   * Tests bulk offline/online operations
   */
  it('should handle multiple sessions in offline cache', async () => {
    console.log('🧪 Test 6: Multiple session caching');

    const session1 = 'multi-session-1';
    const session2 = 'multi-session-2';
    const session3 = 'multi-session-3';

    // Cache multiple sessions
    const multiCache = {
      [session1]: {
        id: session1,
        user_id: TEST_USER_ID,
        current_round: 2,
        supabase_image_url: `${MOCK_SUPABASE_URL}/1`,
      },
      [session2]: {
        id: session2,
        user_id: TEST_USER_ID,
        current_round: 4,
        supabase_image_url: `${MOCK_SUPABASE_URL}/2`,
      },
      [session3]: {
        id: session3,
        user_id: TEST_USER_ID,
        current_round: 5,
        supabase_image_url: `${MOCK_SUPABASE_URL}/3`,
        completed_at: new Date().toISOString(),
      },
    };

    mockCache['@CreativeBridge:sessions'] = JSON.stringify(multiCache);

    // Go offline
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockRejectedValue(new Error('Offline')),
        }),
      }),
    });

    // Retrieve all sessions offline
    const retrieved1 = await storySessionManager.getSession(session1);
    const retrieved2 = await storySessionManager.getSession(session2);
    const retrieved3 = await storySessionManager.getSession(session3);

    expect(retrieved1?.id).toBe(session1);
    expect(retrieved2?.id).toBe(session2);
    expect(retrieved3?.id).toBe(session3);

    expect(retrieved1?.supabase_image_url).toBeTruthy();
    expect(retrieved2?.supabase_image_url).toBeTruthy();
    expect(retrieved3?.supabase_image_url).toBeTruthy();

    console.log('  ✅ Multiple sessions retrieved from cache');
    console.log(`     - Session 1: round ${retrieved1?.current_round}`);
    console.log(`     - Session 2: round ${retrieved2?.current_round}`);
    console.log(
      `     - Session 3: round ${retrieved3?.current_round} (completed)`,
    );
  });

  /**
   * Test 7: Cache doesn't grow indefinitely
   * Tests cache cleanup mechanisms
   */
  it('should clean up old sessions from cache', async () => {
    console.log('🧪 Test 7: Cache cleanup for old sessions');

    // Create cache with many old sessions
    const oldCache: Record<string, any> = {};

    // Add 100 old sessions
    for (let i = 0; i < 100; i++) {
      oldCache[`old-session-${i}`] = {
        id: `old-session-${i}`,
        user_id: TEST_USER_ID,
        created_at: new Date(
          Date.now() - 30 * 24 * 60 * 60 * 1000,
        ).toISOString(), // 30 days ago
        current_round: 1,
      };
    }

    // Add 1 recent session
    oldCache['recent-session'] = {
      id: 'recent-session',
      user_id: TEST_USER_ID,
      created_at: new Date().toISOString(),
      current_round: 3,
    };

    mockCache['@CreativeBridge:sessions'] = JSON.stringify(oldCache);

    // Create a new session (should trigger cleanup)
    const newSession = await storySessionManager.createSession(
      TEST_USER_ID,
      TEST_GRADE_LEVEL,
    );
    await storySessionManager.updateSession(newSession);

    // Check cache size after cleanup
    const cachedData = JSON.parse(mockCache['@CreativeBridge:sessions']);
    const cacheSize = Object.keys(cachedData).length;

    // Cache should be smaller than original (old sessions cleaned)
    expect(cacheSize).toBeLessThan(101);

    console.log('  ✅ Cache cleanup executed');
    console.log(`     - Original cache size: 101 sessions`);
    console.log(`     - After cleanup: ${cacheSize} sessions`);
  });

  // Helper: Setup Supabase mock with default behavior
  function setupSupabaseMock() {
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'game_sessions') {
        return {
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: `session-${Date.now()}`,
                  user_id: TEST_USER_ID,
                  grade_level: TEST_GRADE_LEVEL,
                  created_at: new Date().toISOString(),
                  current_round: 1,
                  final_score: 0,
                  words_written: 0,
                  sentences_completed: 0,
                  challenges_completed: 0,
                  xp_earned: 0,
                  story_source: 'New',
                  story_metadata: {},
                },
                error: null,
              }),
            }),
          }),
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'test-session',
                  user_id: TEST_USER_ID,
                  grade_level: TEST_GRADE_LEVEL,
                  created_at: new Date().toISOString(),
                  current_round: 1,
                  supabase_image_url: MOCK_SUPABASE_URL,
                  generated_image_url: MOCK_REPLICATE_URL,
                  image_upload_status: 'uploaded',
                },
                error: null,
              }),
            }),
          }),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: 'test-session',
                    user_id: TEST_USER_ID,
                  },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });
  }
});
