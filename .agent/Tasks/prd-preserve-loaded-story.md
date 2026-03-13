# PRD: Preserve Loaded Story on Continuation

## Introduction

When a user loads an existing story from their library and taps "Continue," the previously written story text disappears after the first round starts. The user loses all visual context of what they wrote before, making it impossible to refer back to the story. This PRD addresses the bug and adds a collapsible "Previously Written" section to handle long loaded stories gracefully.

### Root Cause

The display renders from `contributions[]` (structured array) when it has entries, and falls back to `story_content` (flat string) when empty. On load, `contributions` is `[]` so the fallback renders the story. But when the user submits text, a contribution is added, switching the display to map `contributions` — which only contains the new entry. The original story vanishes because it was never in the `contributions` array.

## Goals

- Prevent loaded story text from disappearing when a user continues an existing story
- Visually distinguish the loaded story from new round contributions using a 📖 "Previously written" label
- Add a collapsible/expandable section for loaded stories to prevent long stories from dominating the screen
- Maintain round counter reset to 1 for continued stories (existing behavior, confirmed correct)
- Zero regression on new story flow or completed story display

## User Stories

### US-001: Extend StoryContribution type to support loaded stories

**Description:** As a developer, I need the data model to distinguish loaded story content from user/AI contributions so the UI can render them differently.

**Acceptance Criteria:**

- [x] `StoryContribution.type` extended from `'user' | 'ai'` to `'user' | 'ai' | 'loaded'`
- [x] No existing code that checks `type === 'user'` or `type === 'ai'` breaks (verify all usages)
- [x] Typecheck/lint passes

**Validation Test:**

- [x] Run `npm run lint` and `npm test` — all pass with no type errors
- [x] Grep for all `contribution.type` usages and verify none assume only `'user' | 'ai'`

---

### US-002: Synthesize loaded contribution in storySessionManager.getSession()

**Description:** As a user continuing a story, I want the loaded story content preserved in the contributions array so it remains visible throughout gameplay.

**Acceptance Criteria:**

- [x] In `storySessionManager.ts` `getSession()`, after building the session (after the existing contributions recalculation block ~line 386), add logic: if `contributions` is empty but `story_content` exists and is non-empty, synthesize a single contribution with `type: 'loaded'`
- [x] The synthesized contribution uses `story_content` as its content, the session's `created_at` timestamp, and a calculated word count
- [x] Pass `preserveContributions: true` in `HomeScreen.tsx` line 1224 when loading for continuation (primary path)
- [x] The synthesis acts as a fallback when AsyncStorage cache has no contributions
- [x] New stories (empty `story_content`) do NOT get a synthesized contribution
- [x] Typecheck/lint passes

**Validation Test:**

- [ ] Load an existing story with content → verify `contributions[0].type === 'loaded'` and `contributions[0].content` matches `story_content`
- [ ] Start a brand new story → verify no `'loaded'` contribution is created
- [ ] Submit user text after loading → verify contributions array has `['loaded', 'user', 'ai']` types in order
- [ ] Verify `story_content` grows correctly after each contribution (no duplication)

---

### US-003: Render loaded story with 📖 label in story display

**Description:** As a user, I want to see my previously written story labeled with 📖 "Previously written" so I can distinguish it from new round contributions.

**Acceptance Criteria:**

- [x] In `HomeScreen.tsx` story display section (~line 2684-2713), handle `contribution.type === 'loaded'` with a 📖 emoji label
- [x] The label text shows "📖" in the contribution header (same position as 🤖/✍️)
- [x] Add a `loadedLabel` style with a distinct color (e.g., `#8b5cf6` purple) to differentiate from AI blue and user green
- [x] Word count displays correctly for loaded contributions
- [x] Typecheck/lint passes (no new errors introduced)

**Validation Test:**

- [ ] Load an existing story → verify the loaded story shows with 📖 label and purple color
- [ ] New contributions after loaded story show with correct ✍️/🤖 labels
- [ ] Visual inspection: loaded story is clearly distinguishable from new contributions

---

### US-004: Collapsible "Story So Far" section for loaded stories

**Description:** As a user continuing a long story, I want the loaded story in a collapsible section so new contributions aren't pushed far down the screen.

**Acceptance Criteria:**

- [x] Loaded contributions (`type === 'loaded'`) render inside a collapsible container
- [x] Header shows "📖 Previously Written" with a word count and expand/collapse chevron (▼/▶)
- [x] Default state: collapsed if loaded content is > 500 characters, expanded if ≤ 500 characters
- [x] Tapping the header toggles expand/collapse with smooth animation
- [x] When expanded, full loaded story text is visible and selectable
- [x] When collapsed, shows first ~100 characters as a preview with "..." ellipsis
- [x] A visual separator (thin line or spacing) appears between the loaded section and new contributions
- [x] Typecheck/lint passes (no new errors introduced)

**Validation Test:**

- [ ] Load a short story (< 500 chars) → verify it starts expanded
- [ ] Load a long story (> 500 chars) → verify it starts collapsed with preview
- [ ] Tap header → verify it toggles between expanded/collapsed states
- [ ] Verify auto-scroll still works correctly (scrolls to newest contribution, not to loaded content)
- [ ] Start a new story (no loaded content) → verify no collapsible section appears

---

### US-005: Protect addContribution from double-counting loaded content

**Description:** As a developer, I need to ensure that the loaded contribution doesn't cause word count inflation or story_content duplication when new contributions are added.

**Acceptance Criteria:**

- [x] In `addContribution()`, the `story_content` concatenation logic (line 236-241) correctly handles sessions that have a loaded contribution — no duplicate text
- [x] Session stats (`userWords`, `aiWords`, `totalWords`) correctly exclude loaded contribution words from new round counts
- [x] `words_written` field (user-authored words only) is not inflated by loaded content
- [x] Typecheck/lint passes

**Validation Test:**

- [ ] Load a story with 100 user words → submit 50 new user words → verify `words_written` increases by 50 (not 150)
- [ ] Verify `story_content` after 2 new contributions doesn't contain the original story text twice
- [ ] Run `npm test` — all existing tests pass

---

## Functional Requirements

- FR-1: `StoryContribution.type` must support `'loaded'` in addition to `'user'` and `'ai'`
- FR-2: `getSession()` must synthesize a `type: 'loaded'` contribution from `story_content` when `contributions` is empty but `story_content` is non-empty
- FR-3: `getSession()` must first attempt to load cached contributions via `preserveContributions: true` before falling back to synthesis
- FR-4: The loaded contribution must render with a 📖 label and distinct purple color (`#8b5cf6`)
- FR-5: Loaded contributions must render inside a collapsible container with expand/collapse toggle
- FR-6: Collapsible section defaults to collapsed for stories > 500 characters
- FR-7: A visual separator must appear between loaded content and new contributions
- FR-8: `addContribution()` must not duplicate `story_content` when a loaded contribution exists
- FR-9: Word count statistics must not be inflated by loaded contribution content

## Non-Goals

- No changes to the round counter behavior (stays at reset to 1)
- No changes to how `story_content` is stored in Convex
- No changes to the story completion logic or XP calculation
- No migration of existing sessions — fix is forward-looking
- No changes to the story generation/AI continuation prompt construction

## Technical Considerations

- `StoryContribution` type change in `storySessionManager.ts` affects all consumers — must verify no `if/else` assumes only two types
- The collapsible section should use React Native's `LayoutAnimation` or `Animated` for smooth expand/collapse
- `addContribution()` word stat logic at lines 242-278 must be audited to ensure `'loaded'` type doesn't inflate `userWords` or `aiWords`
- The `buildCurrentStory()` helper (used in `addContribution`) joins all contributions — loaded contributions should be included so `storySoFar` sent to AI is correct

## Design Considerations

- 📖 label color: `#8b5cf6` (purple) — distinct from AI blue (`#4285f4`) and user green (`#22c55e`)
- Collapsible header style: same font family (`ArchitectsDaughter_400Regular`), slightly smaller size, with chevron icon
- Collapsed preview: first ~100 chars in lighter color with "..." to indicate more content
- Separator: 1px line in `#e5e7eb` with 12px vertical margin

## Success Metrics

- Loaded story remains visible throughout all rounds of a continued game
- No story content duplication in `story_content` field
- No word count inflation in session stats
- Collapsible section correctly defaults based on content length

## Open Questions

- Should the loaded story preview (when collapsed) show the beginning or ending of the story?
- If a story is continued multiple times, should each previous continuation get its own loaded block, or merge into one?

## Files to Modify

| File                                  | Changes                                                                                                   |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `src/services/storySessionManager.ts` | Extend `StoryContribution.type`, add synthesis logic in `getSession()`, audit `addContribution()`         |
| `src/screens/HomeScreen.tsx`          | Pass `preserveContributions: true`, add 📖 label rendering, add collapsible section component, add styles |
