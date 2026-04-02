# PRD: Fix Game Round Completion — End After Both Players Complete Round 5

## Introduction

The collaborative story game should end after 5 complete rounds, where each round is an atomic pair of one user contribution + one AI continuation. Currently, the game ends when the first player enters round 6 due to a state synchronization bug between React component state (`currentRound` in `HomeScreen.tsx`) and the session manager's authoritative `current_round`. This causes the game to end prematurely or allow a 6th contribution depending on timing.

The fix ensures the game ends only when the 5th round is fully complete — meaning both the user and the AI have made their 5th contribution — regardless of who goes first in the turn order.

## Goals

- Fix the round completion check so the game ends after both players complete round 5
- Eliminate the dual-state bug where React state and session manager disagree on the current round
- Keep input enabled during AI's final response generation, then show completion UI
- Add validation tests for each implementation step to prevent regression
- Minimal scope: fix logic only, no refactoring or UI redesign

## User Stories

### US-001: Sync Frontend Round State from Session Manager

**Description:** As a developer, I need the frontend `currentRound` React state to derive from the session manager's `current_round` (source of truth), so that round checks are never based on stale state.

**Acceptance Criteria:**

- [x] After each `storySessionManager.addContribution()` call in `HomeScreen.tsx`, `setCurrentRound()` uses `updatedSession.current_round` instead of computing `currentRound + 1`
- [x] Remove the independent `const nextRound = currentRound + 1; setCurrentRound(nextRound)` pattern at `HomeScreen.tsx:1852-1854`
- [x] `currentRound` React state matches `session.current_round` after every contribution
- [x] Typecheck passes (`npx tsc --noEmit`)

**Validation Test:** `src/__tests__/bugfixes/US001-roundStateSync.test.ts`

```
Test: "frontend currentRound stays in sync with session.current_round after each contribution"
- Mock storySessionManager.addContribution to return sessions with current_round 1→5
- Verify setCurrentRound is called with updatedSession.current_round, not currentRound + 1
- Verify no independent round calculation exists in handleContinueStory
```

---

### US-002: Check Completion from Session State, Not React State

**Description:** As a developer, I need the game completion check (`isGameCompleted`) to use the session manager's `isCompleted` flag rather than comparing React state `currentRound >= MAX_ROUNDS`, so the game ends at the correct moment.

**Acceptance Criteria:**

- [x] Replace `if (currentRound >= MAX_ROUNDS)` at `HomeScreen.tsx:1781` with `if (updatedSession.isCompleted)` ✅ Done 2026-04-02
- [x] The `isCompleted` flag is set by `storySessionManager` only after the AI's contribution completes round 5 (existing logic at `storySessionManager.ts:278`) ✅ Verified
- [x] Game does NOT end after the user's 5th input (before AI responds) ✅ Test passes
- [x] Game DOES end after the AI's 5th response completes the round ✅ Test passes
- [x] Typecheck passes (`npx tsc --noEmit`) ✅ No new errors (pre-existing errors only)

**Validation Test:** `src/__tests__/bugfixes/US002-completionFromSession.test.ts`

```
Test 1: "game does not end when user submits 5th input before AI responds"
- Simulate: user adds 5th contribution → session.isCompleted is still false
- Verify: isGameCompleted is NOT set to true

Test 2: "game ends when AI completes 5th round"
- Simulate: AI adds 5th contribution → session.isCompleted becomes true
- Verify: isGameCompleted IS set to true, completion UI shown

Test 3: "completion check uses updatedSession.isCompleted, not currentRound >= MAX_ROUNDS"
- Read HomeScreen.tsx source code
- Verify the pattern `updatedSession.isCompleted` exists in the completion check
- Verify the pattern `currentRound >= MAX_ROUNDS` does NOT exist as a completion trigger
```

---

### US-003: Validate Session Manager Round Increment Logic

**Description:** As a developer, I need to confirm that `storySessionManager.addContribution()` correctly increments rounds only after AI responses and marks completion only when both players finish round 5.

**Acceptance Criteria:**

- [x] Round increments only on `type === 'ai'` contributions (existing behavior at `storySessionManager.ts:271`)
- [x] Round is capped at `MAX_ROUNDS` (5) and never exceeds it
- [x] `isCompleted` is set to `true` only when `current_round >= MAX_ROUNDS` after an AI contribution
- [x] `completed_at` timestamp is set at the same time as `isCompleted`
- [x] User contributions do not change `current_round`
- [x] No changes needed to session manager (this story validates existing behavior)

**Validation Test:** `src/__tests__/bugfixes/US003-sessionManagerRounds.test.ts`

```
Test 1: "round increments only after AI contribution"
- Create session at round 1
- Add user contribution → verify current_round === 1
- Add AI contribution → verify current_round === 2

Test 2: "round caps at MAX_ROUNDS"
- Create session at round 4
- Add AI contribution → verify current_round === 5
- Add another AI contribution → verify current_round === 5 (not 6)

Test 3: "isCompleted set when round reaches MAX_ROUNDS after AI response"
- Create session at round 4
- Add AI contribution → verify current_round === 5, isCompleted === true, completed_at is set

Test 4: "isCompleted NOT set before MAX_ROUNDS"
- Create session at round 3
- Add AI contribution → verify current_round === 4, isCompleted === false

Test 5: "full 5-round game simulation"
- Alternate 5 user + 5 AI contributions
- Verify: round increments only after each AI response (1→2→3→4→5)
- Verify: isCompleted === true only after 5th AI contribution
- Verify: contributions array has exactly 10 entries

Test 6: "loaded contributions do not affect round count"
- Add contribution with type 'loaded'
- Verify current_round unchanged
```

---

### US-004: Prevent Input After Game Completion

**Description:** As a user, I want the input field to remain enabled while the AI generates its final response, but become disabled once the AI's 5th response arrives and the game is marked complete.

**Acceptance Criteria:**

- [x] Input field stays enabled after user submits 5th contribution (AI is still generating)
- [x] Input field is disabled after AI's 5th response arrives and `isGameCompleted` is set
- [x] Submit button is not pressable when `isGameCompleted === true`
- [x] `handleContinueStory` returns early (no-ops) if `isGameCompleted === true`
- [x] Typecheck passes (`npx tsc --noEmit`)

**Validation Test:** `src/__tests__/bugfixes/US004-inputDisabledAfterCompletion.test.ts`

```
Test 1: "input remains enabled during AI's final generation"
- Set currentRound to 5, isGameCompleted to false
- Verify: TextInput is not disabled, submit button is pressable

Test 2: "input is disabled after game completion"
- Set isGameCompleted to true
- Verify: TextInput is disabled or hidden, submit button is not pressable

Test 3: "handleContinueStory no-ops when game is completed"
- Set isGameCompleted to true
- Call handleContinueStory with valid input
- Verify: no API calls made, no contributions added
```

---

### US-005: Backend Guard — Reject Updates to Completed Sessions

**Description:** As a developer, I need the Convex `updateSession` mutation to reject round updates to already-completed sessions, as a backend safety net.

**Acceptance Criteria:**

- [x] `convex/gameSessions.ts` `updateSession` already rejects updates when `session.completedAt` is set (existing behavior at line 294-299) ✅ Verified 2026-04-02
- [x] `currentRound` update is capped at 5 (existing behavior at line 319) ✅ Verified
- [x] No changes needed to backend (this story validates existing guards) ✅ Confirmed, tests written

**Validation Test:** `src/__tests__/bugfixes/US005-backendGuards.test.ts`

```
Test 1: "updateSession rejects updates to completed sessions"
- Read gameSessions.ts source
- Verify: completedAt check exists before applying updates
- Verify: error message is 'Cannot update a completed session'

Test 2: "updateSession caps currentRound at 5"
- Read gameSessions.ts source
- Verify: Math.min(Math.round(args.updates.currentRound), 5) pattern exists

Test 3: "completeSession sets currentRound to 5"
- Read gameSessions.ts source
- Verify: completeSession mutation sets currentRound: 5
```

---

### US-006: Regression Test — Original Bug Cannot Recur

**Description:** As a developer, I need a regression test that directly reproduces the original bug scenario to ensure it never recurs.

**Acceptance Criteria:**

- [x] Test simulates the exact bug: game ending when first player enters round 6
- [x] Test verifies the fix: game ends only when 5th round pair is complete
- [x] Test covers both standard mode (AI starts) and user-starts-first mode (US-011)
- [x] All tests pass after the fix is applied

**Validation Test:** `src/__tests__/bugfixes/US006-gameEndsAfterBothPlayersComplete.test.ts`

```
Test 1: "BUG REPRO — game does NOT end when user is first to reach 5 inputs"
- Simulate 5 rounds: for each round, user submits → then AI responds
- After user's 5th input (before AI's 5th response): verify isCompleted === false
- After AI's 5th response: verify isCompleted === true

Test 2: "BUG REPRO — game does NOT end based on stale React currentRound state"
- Simulate: React state currentRound = 5 (stale), but session.current_round = 4
- Verify: game does NOT end (session is authoritative, not React state)

Test 3: "user-starts-first mode — same completion behavior"
- Simulate US-011 mode: user goes first each round
- After 5 complete rounds (5 user + 5 AI contributions): verify isCompleted === true
- Verify: game did not end at any earlier point

Test 4: "AI failure at round 5 does not complete the game"
- Simulate: user submits 5th input, AI generation fails
- Verify: isCompleted === false, current_round still 4
- User can retry, AI succeeds → verify isCompleted === true

Test 5: "round counter UI displays correctly through all 5 rounds"
- Step through rounds 1-5
- Verify: "Round {n}/5" matches actual round at each step
- Verify: never displays "Round 6/5"
```

---

## Functional Requirements

- **FR-1:** A "round" is defined as one atomic pair: one user contribution + one AI continuation. The game has 5 rounds.
- **FR-2:** The game ends when the 5th round is complete (both the user's 5th contribution and the AI's 5th continuation have been recorded).
- **FR-3:** The frontend `currentRound` state must be derived from `storySessionManager`'s `session.current_round` after each contribution, not calculated independently.
- **FR-4:** The game completion check must use `updatedSession.isCompleted` (set by session manager), not `currentRound >= MAX_ROUNDS` (React state comparison).
- **FR-5:** The user input field remains enabled while the AI generates its final (5th) response. It is disabled only after the AI's response arrives and `isGameCompleted` is set.
- **FR-6:** `handleContinueStory` must no-op if `isGameCompleted === true`, preventing any post-completion submissions.
- **FR-7:** The Convex backend must continue to reject `updateSession` calls on completed sessions and cap `currentRound` at 5 (existing guards, no changes needed).

## Non-Goals (Out of Scope)

- No refactoring of the dual-state architecture (React state + session manager) — this fix synchronizes them but does not eliminate the dual tracking
- No changes to the session manager's round increment logic (it's already correct)
- No changes to the Convex `completeSession` or `updateSession` mutations (existing guards are sufficient)
- No UI redesign of the round counter or completion flow
- No changes to the "user starts first" (US-011) mode logic beyond ensuring it completes correctly
- No changes to XP, scoring, or celebration logic — only the trigger timing for when they fire

## Technical Considerations

- **State synchronization:** The root cause is that `HomeScreen.tsx` maintains an independent `currentRound` counter that drifts from `session.current_round`. The fix syncs from session → React state after each contribution.
- **Existing correct logic:** `storySessionManager.ts:270-289` already handles round incrementing and completion detection correctly. The fix is entirely in `HomeScreen.tsx`.
- **Files to modify:**
  - `src/screens/HomeScreen.tsx` — lines ~1781 (completion check) and ~1852-1854 (round increment)
- **Files to validate (no changes):**
  - `src/services/storySessionManager.ts` — round logic already correct
  - `convex/gameSessions.ts` — backend guards already correct

## Success Metrics

- All 6 validation test files pass (`npm test -- --testPathPattern=bugfixes/US00`)
- Game consistently ends after both players complete round 5 in manual testing
- No regression in existing session completion tests (`sessionCompletionGuard.test.ts`, `gameSessions.test.ts`)
- Round counter never displays "Round 6/5" or higher

## Open Questions

- Should `handleContinueStory` check `isGameCompleted` at the very top (before validation), or after validation but before API calls? (Recommendation: at the very top for clarity)
- If the session is resumed from a saved state at round 5, should the user be able to submit one more input or is the game already complete? (Depends on whether the saved `isCompleted` flag is true)
