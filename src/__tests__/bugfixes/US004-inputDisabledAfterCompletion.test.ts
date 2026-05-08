/**
 * US-004: Prevent Input After Game Completion
 *
 * Validates that:
 * 1. Input field stays enabled while AI generates its final (5th) response
 * 2. Input field is disabled after AI's 5th response and isGameCompleted is set
 * 3. Submit button is not pressable when isGameCompleted === true
 * 4. handleContinueStory returns early (no-ops) if isGameCompleted === true
 *
 * Uses source code verification for UI-level checks (TextInput editable,
 * button disabled) and session manager integration for completion flow.
 */

import * as fs from 'fs';
import * as path from 'path';
import { storySessionManager } from '../../services/storySessionManager';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock Convex client
const mockConvexClient = {
  mutation: jest.fn(),
  query: jest.fn(),
};

jest.mock('../../services/convex', () => ({
  getConvexClient: jest.fn(() => mockConvexClient),
  isConvexReady: jest.fn(() => true),
  api: {
    gameSessions: {
      createSession: 'gameSessions:createSession',
      getSession: 'gameSessions:getSession',
      getUserSessions: 'gameSessions:getUserSessions',
      updateSession: 'gameSessions:updateSession',
      updateStoryGeneratedImage: 'gameSessions:updateStoryGeneratedImage',
      updateImageUploadStatus: 'gameSessions:updateImageUploadStatus',
    },
    userProfiles: {
      completeGameSession: 'userProfiles:completeGameSession',
    },
  },
}));

const { isConvexReady, getConvexClient } = require('../../services/convex');

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('../../services/challengeService', () => ({
  ChallengeService: {
    getInstance: jest.fn(() => ({
      calculateXPRewards: jest.fn(() => ({
        baseXP: 100,
        challengeXP: 50,
        completionXP: 100,
        timeBonus: 25,
      })),
      getTotalXP: jest.fn(() => 275),
    })),
  },
}));

function mockConvexSession(overrides: Record<string, any> = {}) {
  return {
    _id: 'session-us004',
    _creationTime: Date.now(),
    userId: 'user_test_us004',
    clerkUserId: 'user_test_us004',
    gradeLevel: '3-5',
    storyContent: '',
    wordsWritten: 0,
    sentencesCompleted: 0,
    challengesCompleted: 0,
    currentRound: 1,
    xpEarned: 0,
    finalScore: 0,
    completedAt: undefined,
    storySource: 'New',
    storyMetadata: {},
    generatedImageUrl: undefined,
    imageGenerationTimestamp: undefined,
    imageGenerationCost: undefined,
    imageUploadStatus: undefined,
    imageUploadAttempts: undefined,
    imageUploadError: undefined,
    ...overrides,
  };
}

describe('[US-004] Prevent Input After Game Completion', () => {
  const homeScreenPath = path.resolve(
    __dirname,
    '../../screens/HomeScreen.tsx',
  );
  // Voice-First PRD US-009 (2026-04-13) relocated the TextInput and submit
  // button out of HomeScreen into VoiceFirstInputBar, so the UI-level
  // source-string assertions below read from the component file while
  // handler-level assertions continue to target HomeScreen.
  const voiceBarPath = path.resolve(
    __dirname,
    '../../components/story/VoiceFirstInputBar.tsx',
  );
  let homeScreenSource: string;
  let voiceBarSource: string;

  beforeAll(() => {
    homeScreenSource = fs.readFileSync(homeScreenPath, 'utf-8');
    voiceBarSource = fs.readFileSync(voiceBarPath, 'utf-8');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (isConvexReady as jest.Mock).mockReturnValue(true);
    (getConvexClient as jest.Mock).mockReturnValue(mockConvexClient);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({}));
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    storySessionManager.clearCache();
  });

  // ---------- Source Code Verification: TextInput ----------

  describe('TextInput editable prop', () => {
    it('input is disabled when isGameCompleted is true', () => {
      // Post US-009, the TextInput lives in VoiceFirstInputBar.tsx and props
      // are referenced via `props.`; the editable prop still composites
      // isGenerating + isGameCompleted to lock input after game completion.
      expect(voiceBarSource).toContain(
        'editable={!props.isGenerating && !props.isGameCompleted}',
      );
    });

    it('input remains enabled during AI generation (isGenerating controls it, not isGameCompleted)', () => {
      // The editable prop gates on isGenerating for mid-game generation,
      // and isGameCompleted for post-game lockout — both must be false for input
      const editablePattern =
        /editable=\{!props\.isGenerating\s*&&\s*!props\.isGameCompleted\}/;
      expect(voiceBarSource).toMatch(editablePattern);
    });
  });

  // ---------- Source Code Verification: Submit Button ----------

  describe('Submit button disabled prop', () => {
    it('submit button is disabled when isGameCompleted is true', () => {
      // Post US-009, the submit button lives in VoiceFirstInputBar.tsx and
      // its disabled prop flows through `submitDisabled`/`typingSubmitDisabled`
      // which both OR in `props.isGameCompleted`. The disabled state may be
      // expressed as either an inline JSX prop (`disabled={...isGameCompleted...}`)
      // OR — post-refactor — as a const declaration that the JSX prop then
      // references (`const submitDisabled = ... || props.isGameCompleted; ...
      // <Pressable disabled={submitDisabled} />`).
      const inlineJsxPattern = /disabled=\{[\s\S]*?isGameCompleted[\s\S]*?\}/;
      const constDeclPattern =
        /(submitDisabled|typingSubmitDisabled)\s*=\s*[\s\S]*?isGameCompleted/;
      const matchesInline = inlineJsxPattern.test(voiceBarSource);
      const matchesConst = constDeclPattern.test(voiceBarSource);
      expect(matchesInline || matchesConst).toBe(true);
    });

    it('submit button composites isGameCompleted into its disabled state', () => {
      // Post US-009, the `floatingSubmitButtonDisabled` style moved out with
      // the button. The equivalent guard now lives as `submitDisabled =
      // props.isGenerating || props.isGameCompleted` (and similarly
      // `typingSubmitDisabled`) — verify isGameCompleted contributes to it.
      expect(voiceBarSource).toContain('isGameCompleted');
      const guardPattern =
        /(submitDisabled|typingSubmitDisabled)[\s\S]{0,200}?props\.isGameCompleted/;
      expect(voiceBarSource).toMatch(guardPattern);
    });
  });

  // ---------- Source Code Verification: handleContinueStory Guard ----------

  describe('handleContinueStory early return', () => {
    it('handleContinueStory returns early when isGameCompleted is true', () => {
      // Find the handleContinueStory function
      const fnPattern =
        /const handleContinueStory\s*=\s*async\s*\(\)\s*=>\s*\{/;
      const match = homeScreenSource.match(fnPattern);
      expect(match).not.toBeNull();

      // Get the first 500 chars after the function declaration (early guards)
      const fnStart = homeScreenSource.indexOf(match![0]);
      const earlyBody = homeScreenSource.substring(fnStart, fnStart + 500);

      // Should contain isGameCompleted check before any other logic
      expect(earlyBody).toContain('if (isGameCompleted) return');
    });

    it('isGameCompleted guard comes before input validation guard', () => {
      const fnPattern = /const handleContinueStory\s*=\s*async/;
      const fnStart = homeScreenSource.search(fnPattern);
      const earlyBody = homeScreenSource.substring(fnStart, fnStart + 500);

      const gameCompletedPos = earlyBody.indexOf('isGameCompleted');
      const inputTrimPos = earlyBody.indexOf('!userInput.trim()');

      // isGameCompleted check must come BEFORE input validation
      expect(gameCompletedPos).toBeGreaterThan(-1);
      expect(inputTrimPos).toBeGreaterThan(-1);
      expect(gameCompletedPos).toBeLessThan(inputTrimPos);
    });
  });

  // ---------- Session Manager: Completion Flow ----------

  describe('completion flow', () => {
    it('isCompleted is false after user contributes at round 5 (AI still needs to respond)', async () => {
      // Load a session already at round 5 (4 full rounds complete, final round in progress)
      const convexDoc = mockConvexSession({ currentRound: 5 });
      mockConvexClient.query.mockResolvedValueOnce(convexDoc);
      mockConvexClient.mutation.mockResolvedValue(undefined);

      const session = await storySessionManager.getSession('session-us004');
      expect(session!.current_round).toBe(5);

      // User contributes at round 5 — game should NOT be complete
      // (only AI contributions trigger round increment and completion check)
      const afterUser = await storySessionManager.addContribution(
        session!.id,
        'user',
        'User contribution at round 5',
        session!,
      );
      expect(afterUser).not.toBeNull();
      expect(afterUser!.current_round).toBe(5); // unchanged by user
      expect(afterUser!.isCompleted).toBe(false);
      // At this point, input should remain enabled (isGameCompleted not set)

      // AI responds — pushes round 5→6 (>5), triggers completion, capped to 5
      const afterAI = await storySessionManager.addContribution(
        afterUser!.id,
        'ai',
        'AI response completing the game',
        afterUser!,
      );
      expect(afterAI).not.toBeNull();
      expect(afterAI!.current_round).toBe(5);
      expect(afterAI!.isCompleted).toBe(true);
      expect(afterAI!.completed_at).toBeDefined();
      // NOW isGameCompleted would be set, disabling input
    });

    it('isCompleted is true after AI response pushes current_round past MAX_ROUNDS', async () => {
      // Load session at round 5 — one AI response away from completion
      const convexDoc = mockConvexSession({ currentRound: 5 });
      mockConvexClient.query.mockResolvedValueOnce(convexDoc);
      mockConvexClient.mutation.mockResolvedValue(undefined);

      const session = await storySessionManager.getSession('session-us004');
      expect(session!.current_round).toBe(5);
      expect(session!.isCompleted).toBe(false);

      // User contributes — no completion yet
      const afterUser = (await storySessionManager.addContribution(
        session!.id,
        'user',
        'Final user input',
        session!,
      ))!;
      expect(afterUser.isCompleted).toBe(false);

      // AI responds — pushes round 5→6 (>5), triggers completion, capped to 5
      const afterAI = (await storySessionManager.addContribution(
        afterUser.id,
        'ai',
        'Final AI response',
        afterUser,
      ))!;
      expect(afterAI.isCompleted).toBe(true);
      expect(afterAI.completed_at).toBeDefined();
      expect(afterAI.current_round).toBe(5);
      // At this point, HomeScreen sets isGameCompleted = true,
      // disabling both the TextInput and submit button
    });
  });
});
