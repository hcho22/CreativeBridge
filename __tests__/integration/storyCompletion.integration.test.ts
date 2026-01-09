/**
 * Integration Test: Story Completion Flow
 * Task 6.2 - Test complete flow from round 1 to 5
 *
 * Tests the full story completion journey including:
 * - Session creation
 * - Round progression through contributions
 * - Auto-completion at round 5
 * - Database persistence
 */

import { storySessionManager, StorySession } from '../../src/services/storySessionManager';
import { supabase } from '../../src/services/supabase';
import { GradeLevel } from '../../src/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage');

// Mock Supabase with realistic behavior
jest.mock('../../src/services/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

describe('Integration Test: Story Completion Flow', () => {
  const TEST_USER_ID = 'integration-test-user-001';
  const TEST_GRADE_LEVEL: GradeLevel = 'K-2';
  const MAX_ROUNDS = 5;

  let mockSessionData: any;
  let sessionCallCount = 0;

  beforeEach(() => {
    jest.clearAllMocks();
    sessionCallCount = 0;

    // Initialize mock session data
    mockSessionData = {
      id: `integration-session-${Date.now()}`,
      user_id: TEST_USER_ID,
      grade_level: TEST_GRADE_LEVEL,
      created_at: new Date().toISOString(),
      current_round: 1,
      final_score: 0,
      words_written: 0,
      sentences_completed: 0,
      challenges_completed: 0,
      xp_earned: 0,
      story_content: '',
      story_source: 'New',
      story_metadata: {},
      completed_at: null,
    };

    // Mock AsyncStorage
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  /**
   * Test 1: Complete user journey from session creation to completion
   * Simulates a realistic user writing a 5-round story
   */
  it('should complete full story journey from round 1 to 5', async () => {
    console.log('🧪 Test 1: Complete story journey (round 1→5)');

    // Setup mocks for session creation
    setupSessionCreationMock();

    // Step 1: Create new session
    const session = await storySessionManager.createSession(TEST_USER_ID, TEST_GRADE_LEVEL);

    expect(session).toBeTruthy();
    expect(session.id).toBe(mockSessionData.id);
    expect(session.current_round).toBe(1);
    expect(session.isCompleted).toBe(false);
    console.log(`  ✅ Session created at round 1`);

    // Step 2: Complete 5 rounds of contributions
    let currentSession = session;

    for (let round = 1; round <= MAX_ROUNDS; round++) {
      console.log(`  🔄 Processing round ${round}/${MAX_ROUNDS}...`);

      // User contribution
      const userContent = `User contribution for round ${round}. This is part of the story.`;
      setupContributionMock(currentSession, 'user', userContent, round);

      currentSession = (await storySessionManager.addContribution(
        currentSession.id,
        'user',
        userContent,
        currentSession
      ))!;

      expect(currentSession).toBeTruthy();
      expect(currentSession.current_round).toBe(round); // Round doesn't change on user input
      console.log(`    ✓ User contribution added (round still ${round})`);

      // AI contribution - this increments the round
      const aiContent = `AI response for round ${round}. The story continues...`;
      const nextRound = Math.min(round + 1, MAX_ROUNDS);
      const shouldComplete = round === MAX_ROUNDS;

      setupContributionMock(currentSession, 'ai', aiContent, nextRound, shouldComplete);

      currentSession = (await storySessionManager.addContribution(
        currentSession.id,
        'ai',
        aiContent,
        currentSession
      ))!;

      expect(currentSession).toBeTruthy();

      if (shouldComplete) {
        expect(currentSession.current_round).toBe(MAX_ROUNDS);
        expect(currentSession.isCompleted).toBe(true);
        expect(currentSession.completed_at).toBeTruthy();
        console.log(`    ✅ AI contribution added - STORY COMPLETE! (round ${MAX_ROUNDS})`);
      } else {
        expect(currentSession.current_round).toBe(nextRound);
        expect(currentSession.isCompleted).toBe(false);
        console.log(`    ✓ AI contribution added (round advanced to ${nextRound})`);
      }
    }

    // Step 3: Verify final state
    expect(currentSession.current_round).toBe(MAX_ROUNDS);
    expect(currentSession.isCompleted).toBe(true);
    expect(currentSession.completed_at).toBeTruthy();
    expect(currentSession.story_content).toContain('User contribution');
    expect(currentSession.story_content).toContain('AI response');

    console.log(`  ✅ Story completed successfully at round ${MAX_ROUNDS}`);
    console.log(`     - Total rounds: ${currentSession.current_round}`);
    console.log(`     - Completion time: ${currentSession.completed_at}`);
    console.log(`     - Story length: ${currentSession.words_written} words`);
  });

  /**
   * Test 2: Verify database persistence at each step
   * Ensures that every contribution is properly saved
   */
  it('should persist state to database after each contribution', async () => {
    console.log('🧪 Test 2: Database persistence verification');

    setupSessionCreationMock();
    const session = await storySessionManager.createSession(TEST_USER_ID, TEST_GRADE_LEVEL);

    const updateCalls: any[] = [];

    // Track all update calls
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'game_sessions') {
        return {
          update: (data: any) => {
            updateCalls.push(data);
            return {
              eq: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { ...mockSessionData, ...data },
                    error: null,
                  }),
                }),
              }),
            };
          },
        };
      }
      return { select: jest.fn() };
    });

    // Add one user and one AI contribution
    await storySessionManager.addContribution(session.id, 'user', 'Test user input', session);
    await storySessionManager.addContribution(session.id, 'ai', 'Test AI response', session);

    // Verify database updates were called
    expect(updateCalls.length).toBeGreaterThanOrEqual(2);

    // Verify current_round was persisted in at least one call
    const roundUpdates = updateCalls.filter(call => call.current_round !== undefined);
    expect(roundUpdates.length).toBeGreaterThan(0);

    console.log(`  ✅ Database updates verified: ${updateCalls.length} total calls`);
    console.log(`     - Round updates: ${roundUpdates.length}`);
  });

  /**
   * Test 3: Story cannot exceed MAX_ROUNDS
   * Ensures boundary conditions are properly handled
   */
  it('should not allow current_round to exceed MAX_ROUNDS', async () => {
    console.log('🧪 Test 3: MAX_ROUNDS boundary enforcement');

    // Start with a session already at round 5
    mockSessionData.current_round = MAX_ROUNDS;
    mockSessionData.isCompleted = true;
    mockSessionData.completed_at = new Date().toISOString();
    mockSessionData.story_content = 'Complete story...';

    setupSessionCreationMock();
    const session = await storySessionManager.createSession(TEST_USER_ID, TEST_GRADE_LEVEL);
    session.current_round = MAX_ROUNDS;
    session.isCompleted = true;

    // Try to add another contribution
    setupContributionMock(session, 'ai', 'Extra content', MAX_ROUNDS, true);

    const result = await storySessionManager.addContribution(
      session.id,
      'ai',
      'Extra content after completion',
      session
    );

    expect(result?.current_round).toBe(MAX_ROUNDS);
    expect(result?.current_round).not.toBeGreaterThan(MAX_ROUNDS);

    console.log(`  ✅ Round properly capped at ${MAX_ROUNDS}`);
  });

  /**
   * Test 4: Partial story progress is saved correctly
   * Tests mid-story state persistence
   */
  it('should correctly save and restore partial story progress', async () => {
    console.log('🧪 Test 4: Partial story progress persistence');

    setupSessionCreationMock();
    let session = await storySessionManager.createSession(TEST_USER_ID, TEST_GRADE_LEVEL);

    // Complete 3 rounds
    for (let round = 1; round <= 3; round++) {
      setupContributionMock(session, 'user', `User ${round}`, round);
      session = (await storySessionManager.addContribution(
        session.id,
        'user',
        `User ${round}`,
        session
      ))!;

      setupContributionMock(session, 'ai', `AI ${round}`, round + 1, false);
      session = (await storySessionManager.addContribution(
        session.id,
        'ai',
        `AI ${round}`,
        session
      ))!;
    }

    // Verify mid-story state
    expect(session.current_round).toBe(4); // After 3 complete rounds
    expect(session.isCompleted).toBe(false);
    expect(session.completed_at).toBeFalsy();
    expect(session.story_content).toBeTruthy();

    console.log(`  ✅ Partial progress saved correctly`);
    console.log(`     - Current round: ${session.current_round}/5`);
    console.log(`     - Completion status: ${session.isCompleted}`);

    // Mock getting the session from database
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              ...mockSessionData,
              current_round: 4,
              story_content: session.story_content,
              isCompleted: false,
            },
            error: null,
          }),
        }),
      }),
    });

    // Retrieve session and verify it matches
    const retrieved = await storySessionManager.getSession(session.id);
    expect(retrieved?.current_round).toBe(4);
    expect(retrieved?.isCompleted).toBe(false);

    console.log(`  ✅ Retrieved session matches saved state`);
  });

  /**
   * Test 5: Completion timestamp is accurate
   * Verifies completed_at is set correctly
   */
  it('should set accurate completion timestamp when story completes', async () => {
    console.log('🧪 Test 5: Completion timestamp accuracy');

    const beforeTest = Date.now();

    setupSessionCreationMock();
    let session = await storySessionManager.createSession(TEST_USER_ID, TEST_GRADE_LEVEL);

    // Fast-forward to round 4
    session.current_round = 4;

    // Complete the final round
    setupContributionMock(session, 'user', 'Final user input', 4);
    session = (await storySessionManager.addContribution(
      session.id,
      'user',
      'Final user input',
      session
    ))!;

    const completionAt = new Date().toISOString();
    setupContributionMock(session, 'ai', 'The end.', 5, true, completionAt);
    session = (await storySessionManager.addContribution(
      session.id,
      'ai',
      'The end.',
      session
    ))!;

    const afterTest = Date.now();

    expect(session.completed_at).toBeTruthy();

    const completedTime = new Date(session.completed_at!).getTime();
    expect(completedTime).toBeGreaterThanOrEqual(beforeTest);
    expect(completedTime).toBeLessThanOrEqual(afterTest);

    console.log(`  ✅ Completion timestamp verified`);
    console.log(`     - Completed at: ${session.completed_at}`);
    console.log(`     - Time window: ${afterTest - beforeTest}ms`);
  });

  // Helper function: Setup session creation mock
  function setupSessionCreationMock() {
    (supabase.from as jest.Mock).mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockSessionData,
            error: null,
          }),
        }),
      }),
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockSessionData,
            error: null,
          }),
        }),
      }),
    });
  }

  // Helper function: Setup contribution mock
  function setupContributionMock(
    session: StorySession,
    type: 'user' | 'ai',
    content: string,
    newRound: number,
    shouldComplete: boolean = false,
    completedAt?: string
  ) {
    const updatedContent = session.story_content
      ? `${session.story_content}\n${type === 'user' ? 'User' : 'AI'}: ${content}`
      : `${type === 'user' ? 'User' : 'AI'}: ${content}`;

    const wordCount = content.split(' ').length;
    const sentenceCount = content.split(/[.!?]/).length;

    const updatedData = {
      ...mockSessionData,
      id: session.id,
      current_round: newRound,
      story_content: updatedContent,
      words_written: session.words_written + wordCount,
      sentences_completed: session.sentences_completed + sentenceCount,
      completed_at: shouldComplete ? (completedAt || new Date().toISOString()) : null,
    };

    mockSessionData = updatedData;

    (supabase.from as jest.Mock).mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: updatedData,
              error: null,
            }),
          }),
        }),
      }),
    });
  }
});
