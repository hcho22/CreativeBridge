# PRD: Fix Loaded Story Continuation Bugs

## Introduction

When a user continues a story from their library, three bugs degrade the experience:

1. **Image generation blocked** — The old generated image URL from the prior session persists, showing "View Generated Image" instead of "Generate Image" after completing a new round.
2. **Inflated word/character counts** — The completion stats include all previously written content (loaded story), not just the current round's contributions.
3. **Incomplete "Previously Written" section** — When continuing a story for the 3rd+ time, only the original imported text appears under "Previously Written," missing accumulated content from intermediate continuation rounds.

### Root Cause (Shared)

The session is not properly reset when re-continuing a loaded story. `handleContinueImportedStory` (HomeScreen.tsx:1220-1280) loads the existing session object but does not:

- Clear old image URLs or `generatedImageUrl` React state
- Reset `current_round` (stays at 5) or `isCompleted` (stays true) on the session object
- Clear stale AsyncStorage contribution cache (preserving the old `loaded` contribution)
- Reset `wordsWritten` in Convex (initialized with imported word count at creation)

## Goals

- Allow users to generate a new image after completing any continuation round
- Display word count and story length reflecting only the current round's contributions
- Show ALL previously written content under "Previously Written" on every continuation, segmented into "Original Story" and "Previous Continuation" when applicable
- Reset XP earned to 0 for each new continuation round (independent earnings per round)
- Always reset session state (round counter, completion, image fields) on every continuation, regardless of prior session state

## User Stories

### US-001: Add `resetSessionForContinuation` Convex mutation

**Description:** As a developer, I need a Convex mutation to reset session fields (completion, rounds, image, XP) so that a story can be cleanly re-continued from the database.

**Acceptance Criteria:**

- [x] New mutation `resetSessionForContinuation` added to `convex/gameSessions.ts` after `createStoryContinuationSession` (~line 205)
- [x] Accepts `sessionId: v.id('gameSessions')` as argument
- [x] Verifies authorization: fetches session, checks `session.clerkUserId === clerkUserId` from `getClerkUserId(ctx)`
- [x] Patches session to clear: `completedAt`, `generatedImageUrl`, `imageGenerationTimestamp`, `imageGenerationCost`, `storageId`, `imageUploadStatus`, `imageUploadAttempts`, `imageUploadError`
- [x] Patches session to reset: `currentRound: 1`, `wordsWritten: 0`, `xpEarned: 0`, `finalScore: 0`
- [x] Does NOT modify `storyContent`, `importedStoryContent`, `storySource`, `storyMetadata`, `gradeLevel`
- [x] Typecheck/lint passes

**Validation Test:**

- [x] Run `npx convex dev` — mutation deploys without errors (lint passes; deployment deferred to integration)
- [x] In `convex/gameSessions.ts`, verify the mutation follows the same auth pattern as `updateSession` (uses `getClerkUserId` for ownership check, matching the pattern for mutations that modify existing sessions)
- [x] Grep for `resetSessionForContinuation` in convex/ — confirmed exported at line 205

---

### US-002: Fix `createStoryContinuationSession` to initialize `wordsWritten: 0`

**Description:** As a developer, I need continuation sessions to start with `wordsWritten: 0` so the field tracks only new contributions, not imported content.

**Acceptance Criteria:**

- [x] In `convex/gameSessions.ts` line 185, change `wordsWritten: wordCount` to `wordsWritten: 0`
- [x] The imported content word count is still derivable from `importedStoryContent` (no data loss)
- [x] `storyContent` still initialized with `args.importedContent` (unchanged)
- [x] Typecheck/lint passes

**Validation Test:**

- [x] Read `convex/gameSessions.ts` and confirm line 185 now reads `wordsWritten: 0`
- [x] Run `npm run lint` — passes
- [x] Verify no other code depends on `wordsWritten` being pre-populated with imported word count (grep for `wordsWritten` in `convex/` and `src/services/`)

---

### US-003: Add `clearCachedContributions` method to `storySessionManager`

**Description:** As a developer, I need a way to clear the AsyncStorage contribution cache for a specific session so that the `loaded` contribution is re-synthesized from the latest `storyContent` on each continuation.

**Acceptance Criteria:**

- [x] New public method `clearCachedContributions(sessionId: string): Promise<void>` added to `StorySessionManager` class in `src/services/storySessionManager.ts` (after `clearCache` ~line 1196)
- [x] Reads `this.SESSIONS_KEY` from AsyncStorage, sets `sessions[sessionId].contributions = []` if entry exists, writes back
- [x] Also calls `this.invalidateCache(sessionId)` to clear the in-memory cache
- [x] Handles errors gracefully (try/catch, logs error, does not throw)
- [x] Typecheck/lint passes

**Validation Test:**

- [x] Read the method and confirm it uses `this.SESSIONS_KEY` (not a hardcoded string)
- [x] Confirm it calls `this.invalidateCache(sessionId)` (reuses existing cache invalidation)
- [x] Run `npm run lint` — passes
- [x] Grep for `clearCachedContributions` — confirm it's defined and public

---

### US-004: Fix `sessionStats` initialization in `getSession`

**Description:** As a developer, I need `sessionStats.userWords` to start at 0 (not `wordsWritten`) so that stats accurately reflect only the current round's contributions after recalculation from the contributions array.

**Acceptance Criteria:**

- [x] In `src/services/storySessionManager.ts` `getSession()` (~line 344-347), change `sessionStats` initialization:
  - `userWords: 0` (was `convexSession.wordsWritten || 0`)
  - `aiWords: 0` (unchanged)
  - `totalWords: 0` (was `convexSession.wordsWritten || 0`)
- [x] The existing recalculation block at lines 378-394 continues to correctly compute stats from contributions (excluding `loaded` type)
- [x] `sessionDuration` and `contributionCount` initialization remain unchanged
- [x] Typecheck/lint passes

**Validation Test:**

- [x] Read lines 344-347 and confirm `userWords: 0` and `totalWords: 0`
- [x] Trace the flow: after init to 0, verify the recalculation block at 378-394 sums only `user` and `ai` contributions (confirm `loaded` is excluded at line 388)
- [x] Run `npm run lint` — passes

---

### US-005: Reset session state in `handleContinueImportedStory`

**Description:** As a user continuing a story, I want the game to start fresh (new rounds, no old image, clean stats) so I can play a full new continuation round and generate a new image at the end.

**Acceptance Criteria:**

- [x] In `src/screens/HomeScreen.tsx` `handleContinueImportedStory`, BEFORE the `getSession` call (~line 1240):
  - Call `storySessionManager.clearCachedContributions(continueParams.sessionId)` to clear stale cache
- [x] AFTER the `getSession` call returns `existingSession`, BEFORE `setCurrentSession`:
  - Call `resetSessionForContinuation` Convex mutation to reset DB state
  - Reset React state: `setGeneratedImageUrl(null)`, `setShowImageGeneration(false)`, `setShowImageDisplayModal(false)`
  - Reset local session object fields: `current_round = 1`, `isCompleted = false`, `completed_at = undefined`, all image fields = undefined, `xp_earned = 0`, `final_score = 0`, `words_written = 0`
- [x] Add necessary imports: `api` from convex, `Id` type, `getConvexClient`, `isConvexReady`
- [x] The existing `setCurrentRound(1)` and `setIsGameCompleted(false)` at lines 1257-1258 remain (React state reset)
- [x] Typecheck/lint passes

**Validation Test:**

- [x] Read `handleContinueImportedStory` and confirm:
  1. `clearCachedContributions` is called before `getSession`
  2. `resetSessionForContinuation` mutation is called after `getSession`
  3. `setGeneratedImageUrl(null)` is called
  4. `existingSession.current_round = 1` and `existingSession.isCompleted = false` are set
  5. All image fields on `existingSession` are cleared
- [x] Run `npm run lint` — passes
- [x] Verify imports: `getConvexClient`, `isConvexReady`, and `api` are already imported (check top of file)

---

### US-006: Fix "Story Length" display in completion stats

**Description:** As a user, I want "Story Length" in the completion modal to show only the characters I wrote in this round, not the entire accumulated story including previously written content.

**Acceptance Criteria:**

- [x] In `src/screens/HomeScreen.tsx` completion stats (~line 3103-3113), change "Story Length" to calculate new content only: `total story_content length - loaded contribution content length`
- [x] If no loaded contribution exists (new story), display total `story_content.length` as before
- [x] The value is never negative (guard with `Math.max(0, ...)`)
- [x] Typecheck/lint passes

**Validation Test:**

- [x] Read lines 3103-3113 and confirm the calculation subtracts loaded content
- [x] Verify the fallback: when `loadedContribution` is null/undefined, it shows total length (no regression for new stories)
- [x] Run `npm run lint` — passes

---

### US-007: Segment "Previously Written" into Original and Previous Continuation

**Description:** As a user continuing a story for the 3rd+ time, I want to see "Previously Written" content separated into "Original Story" and "Previous Continuation" sections so I can understand the story's history.

**Acceptance Criteria:**

- [x] In `src/screens/HomeScreen.tsx`, where the `loaded` contribution is rendered (~lines 2759-2912), detect if the loaded content contains both original imported content and continuation content
- [x] Use the session's `imported_story_content` (mapped from Convex `importedStoryContent` field) to split: the original story is the `importedStoryContent` portion; the "Previous Continuation" is the remaining text (`storyContent` minus `importedStoryContent`)
- [x] If `importedStoryContent` is not available or equals the full `storyContent`, render as a single "Previously Written" block (no segmentation needed — first continuation)
- [x] Each segment has its own collapsible header with word count:
  - "Original Story" — shows `importedStoryContent` with word count
  - "Previous Continuation" — shows remaining text with word count
- [x] Both segments are independently collapsible (`isLoadedStoryExpanded` + `isPrevContinuationExpanded`)
- [x] Typecheck/lint passes

**Validation Test:**

- [x] Read the rendering logic and confirm it checks for `imported_story_content` to determine segmentation
- [x] Verify that a first-time continuation (where loaded content = imported content) renders as single block
- [x] Verify that a 3rd+ continuation (where loaded content > imported content) renders both segments
- [x] Run `npm run lint` — passes

---

### US-008: Expose `imported_story_content` on StorySession interface

**Description:** As a developer, I need the `importedStoryContent` field from Convex available on the local `StorySession` interface so US-007 can compare it against `story_content` for segmentation.

**Acceptance Criteria:**

- [x] Add `imported_story_content?: string` field to the `StorySession` interface in `src/services/storySessionManager.ts` (~line 57)
- [x] Map `importedStoryContent` from Convex to `imported_story_content` in `convertConvexSessionToLegacy` (~line 23)
- [x] Typecheck/lint passes

**Validation Test:**

- [x] Read `StorySession` interface and confirm `imported_story_content?: string` is present
- [x] Read `convertConvexSessionToLegacy` and confirm mapping: `imported_story_content: convexSession.importedStoryContent`
- [x] Run `npm run lint` — passes
- [x] Grep for `importedStoryContent` in `convex/schema.ts` to confirm the field exists in the Convex schema

---

## Functional Requirements

- FR-1: Add `resetSessionForContinuation` mutation to `convex/gameSessions.ts` that clears completion, image, and score fields while preserving story content
- FR-2: Change `createStoryContinuationSession` to initialize `wordsWritten: 0` instead of imported word count
- FR-3: Add `clearCachedContributions` method to `storySessionManager` to clear AsyncStorage cache for a specific session
- FR-4: Initialize `sessionStats.userWords` and `totalWords` to 0 in `getSession` instead of from `wordsWritten`
- FR-5: In `handleContinueImportedStory`, clear contribution cache, call Convex reset mutation, reset React state and local session fields before starting continuation
- FR-6: Display "Story Length" as new content characters only (total minus loaded) in completion stats
- FR-7: Segment "Previously Written" into "Original Story" and "Previous Continuation" when continuing a previously-continued story
- FR-8: Expose `imported_story_content` on `StorySession` interface for UI segmentation logic

## Non-Goals

- No changes to the new story flow (only continuation flow is affected)
- No migration of existing Convex sessions (existing `wordsWritten` values remain; the reset mutation handles re-continuation)
- No changes to the story download/export feature
- No changes to the XP economy or image generation cost (1000 XP)
- No changes to the `addContribution` method's counting logic (already correct for `loaded` exclusion)

## Technical Considerations

- **Convex schema compatibility:** All fields being cleared (`completedAt`, `generatedImageUrl`, etc.) are already `v.optional()` in `convex/schema.ts`, so `undefined` is a valid value
- **AsyncStorage key:** The sessions cache key is `@CreativeBridge:sessions` (via `this.SESSIONS_KEY` in `storySessionManager`)
- **Auth pattern:** The new Convex mutation should use `getClerkUserId(ctx)` for authorization, matching the pattern in `createStoryContinuationSession`
- **Backward compatibility:** Existing sessions with non-zero `wordsWritten` will be reset to 0 when the `resetSessionForContinuation` mutation runs, so no migration needed
- **Import availability:** `getConvexClient`, `isConvexReady`, and `api` are already imported in HomeScreen.tsx; `Id` type may need to be added

## Success Metrics

- Users can generate a new image on every continuation round (not blocked by prior image)
- "Words Written" shows only current-round words (verified by comparing against loaded word count)
- "Story Length" shows only current-round characters
- "Previously Written" shows ALL prior content on 3rd+ continuations, segmented into original and continuation sections
- No regression on new story flow (fresh stories unaffected)

## Open Questions

- Should the "Previous Continuation" segment in US-007 be further split if the story has been continued 4+ times, or is a two-segment split (original + all continuations) sufficient? **Decision: Two segments is sufficient for now.**
