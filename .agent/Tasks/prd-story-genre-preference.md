# PRD: Story Genre Preference

## Introduction

Users currently have no control over the genre or tone of AI-generated stories. The story generation pipeline hardcodes `theme: 'adventure'`, producing similar-feeling stories regardless of user preference. This feature adds a genre selector to the Settings tab, persists the user's choice in their profile, and threads the selected genre through the entire story generation pipeline so GPT-4 produces genre-appropriate content.

**Supported Genres:** Mystery, Fantasy, Comedy, Horror, Fiction, Fairy Tale

**Key Decisions:**

- Horror is auto-softened for younger grade levels (K-2 becomes "spooky/silly", 3-5 becomes "mild suspense")
- Users can clear their genre selection ("No Preference") to get varied stories (falls back to `'adventure'`)
- Each user story includes a Jest unit test for validation

## Goals

- Allow users to select a preferred story genre from 6 options in the Settings tab
- Persist genre preference in the Convex database (no migration needed — optional field)
- Generate genre-appropriate story starters and continuations via GPT-4
- Auto-soften Horror content for K-2 and 3-5 grade levels
- Allow clearing genre selection for varied/random stories
- Maintain full backward compatibility for existing users (undefined genre = no change in behavior)

## User Stories

### US-001: Add genre field to Convex schema

**Description:** As a developer, I need a `preferredGenre` field in the `userProfiles` table so the user's genre preference persists across sessions.

**Acceptance Criteria:**

- [x] Add `genreValidator` to `convex/schema.ts` using `v.union(v.literal('Mystery'), v.literal('Fantasy'), v.literal('Comedy'), v.literal('Horror'), v.literal('Fiction'), v.literal('Fairy Tale'))`
- [x] Add `preferredGenre: v.optional(genreValidator)` to the `userProfiles` table definition, under the existing `speechEnabled` field
- [x] Existing user profiles without this field continue to load without error (`v.optional` ensures this)
- [x] Typecheck passes (`npx tsc --noEmit`)

**Validation Test:**

- [x] Write `__tests__/schema/genreValidator.test.ts`: verify the 6 genre literals are accepted and invalid strings are rejected by the validator type

---

### US-002: Allow updating genre via Convex mutation

**Description:** As a developer, I need the `updateProfile` mutation to accept and persist `preferredGenre` so the Settings screen can save the user's choice.

**Acceptance Criteria:**

- [x] Import `genreValidator` in `convex/userProfiles.ts`
- [x] Add `preferredGenre: v.optional(genreValidator)` to the `updateProfile` mutation's `updates` arg validator
- [x] Add `if (args.updates.preferredGenre !== undefined) updateFields.preferredGenre = args.updates.preferredGenre;` in the handler
- [x] Typecheck passes (no new errors introduced; pre-existing errors in unrelated files)

**Validation Test:**

- [x] Write `__tests__/convex/userProfiles.genre.test.ts`: mock the mutation and verify `preferredGenre` is included in the patched fields when provided, and excluded when not provided (11 tests, all passing)

---

### US-003: Add StoryGenre TypeScript type and UserProfile field

**Description:** As a developer, I need a `StoryGenre` type and a `preferred_genre` field on the `UserProfile` interface so the app can type-check genre usage throughout the codebase.

**Acceptance Criteria:**

- [x] Add `export type StoryGenre = 'Mystery' | 'Fantasy' | 'Comedy' | 'Horror' | 'Fiction' | 'Fairy Tale'` to `src/types/database.ts`
- [x] Add `preferred_genre?: StoryGenre` to the `UserProfile` interface in the same file
- [x] Typecheck passes

**Validation Test:**

- [x] Write `__tests__/types/storyGenre.test.ts`: verify that all 6 genre string literals satisfy the `StoryGenre` type (compile-time test via type assertions), and verify `UserProfile` accepts `preferred_genre` as optional

---

### US-004: Wire genre through AuthContext mapping layer

**Description:** As a developer, I need the AuthContext to map `preferredGenre` (Convex camelCase) to `preferred_genre` (legacy snake_case) bidirectionally so the Settings screen and HomeScreen can read/write genre consistently.

**Acceptance Criteria:**

- [ ] In `convertConvexProfileToLegacy()` in `src/context/AuthContext.tsx`: map `convexProfile.preferredGenre` to `preferred_genre`
- [ ] In `updateProfile()` in `src/context/AuthContext.tsx`: map `profile.preferred_genre` to `convexUpdates.preferredGenre`
- [ ] When `preferredGenre` is undefined on the Convex profile, `preferred_genre` is undefined on the legacy profile (not null or empty string)
- [ ] Typecheck passes

**Validation Test:**

- [ ] Write `__tests__/context/authContextGenreMapping.test.ts`: test `convertConvexProfileToLegacy` with genre set to each of the 6 values and with genre undefined; test `updateProfile` mapping from snake_case to camelCase

---

### US-005: Add genre selector to Settings screen

**Description:** As a user, I want to select my preferred story genre in the Settings tab so that AI-generated stories match my taste.

**Acceptance Criteria:**

- [ ] Genre selector section appears below the Grade Level selector in SettingsScreen
- [ ] 6 genre buttons displayed in a grid (3 rows x 2 columns), reusing existing `gradeButton` / `selectedGradeButton` styles
- [ ] A 7th "No Preference" option allows clearing the genre (sets `preferred_genre` to `undefined`)
- [ ] Selected genre is visually highlighted
- [ ] Genre description text shown below the buttons (e.g., Mystery: "Clues, secrets, and puzzles to solve")
- [ ] When no genre is selected, description reads: "Stories will vary in theme each time"
- [ ] Tapping a genre calls `updateProfile({ preferred_genre: genre })` and shows a success alert
- [ ] Tapping the already-selected genre deselects it (sets to undefined — "No Preference" behavior)
- [ ] On error, selection reverts to previous value
- [ ] Typecheck/lint passes
- [ ] Verify on iOS simulator

**Validation Test:**

- [ ] Write `__tests__/screens/SettingsScreen.genre.test.ts`: render SettingsScreen with mocked AuthContext; verify 6 genre buttons + "No Preference" render; verify tapping "Mystery" calls `updateProfile` with `{ preferred_genre: 'Mystery' }`; verify tapping active genre deselects it

---

### US-006: Add `genre` to StoryRequest type

**Description:** As a developer, I need a `genre` field on `StoryRequest` so the story generation pipeline can receive genre information from the UI layer.

**Acceptance Criteria:**

- [ ] Add `genre?: string` to `StoryRequest` in `src/types/story.ts`
- [ ] `StoryContinuationRequest` (which extends `StoryRequest`) automatically inherits the field
- [ ] Typecheck passes

**Validation Test:**

- [ ] Write `__tests__/types/storyRequest.test.ts`: verify a `StoryRequest` object with `genre: 'Mystery'` compiles; verify `StoryContinuationRequest` also accepts `genre`

---

### US-007: Pass genre from HomeScreen to story generation

**Description:** As a developer, I need HomeScreen to read the user's preferred genre and pass it to both `generateStoryStarter()` and `continueStory()` so the AI uses the correct genre.

**Acceptance Criteria:**

- [ ] Add `preferredGenre` memo derived from `userProfile?.preferred_genre` (next to existing `gradeLevel` memo in HomeScreen)
- [ ] In `executeStartNewGame`: change `theme: 'adventure'` to `theme: preferredGenre ?? 'adventure'`
- [ ] In `continueStory` call: add `genre: preferredGenre` to the request object
- [ ] When `preferredGenre` is undefined, behavior is unchanged from current (theme defaults to `'adventure'`)
- [ ] Typecheck passes

**Validation Test:**

- [ ] Write `__tests__/screens/HomeScreen.genre.test.ts`: mock `storyAgentService.generateStoryStarter` and `storyAgentService.continueStory`; verify `theme` param equals the user's preferred genre; verify fallback to `'adventure'` when no genre set

---

### US-008: Genre-aware story generation prompts

**Description:** As a user, I want the AI to generate stories that match my selected genre so that Mystery stories feel mysterious, Fantasy stories feel magical, etc.

**Acceptance Criteria:**

- [ ] `buildSystemPrompt()` in `storyGenerationService.ts` accepts a `genre?: string` parameter
- [ ] When genre is set, a `GENRE: <NAME>` block with genre-specific writing guidance is inserted into the system prompt between vocabulary requirements and key guidelines
- [ ] Genre guidance map covers all 6 genres with distinct style instructions
- [ ] Horror guidance for K-2 says "spooky and silly" (not scary); for 3-5 says "mild suspense and mystery" (not frightening)
- [ ] `buildPrompts()` passes `request.genre` to `buildSystemPrompt()`
- [ ] `buildUserPrompt()` story continuation branch appends `Maintain the ${genre} genre throughout.` when genre is set
- [ ] `buildUserPrompt()` story starter branch adds a `GENRE REQUIREMENT` paragraph when genre is set
- [ ] Fallback story selection prefers matching genre categories when genre is set (e.g., Mystery → `['mystery']`, Fantasy → `['fantasy', 'adventure']`)
- [ ] When genre is undefined, all prompts are identical to current behavior (no regression)
- [ ] Typecheck passes

**Validation Test:**

- [ ] Write `__tests__/services/storyGenerationService.genre.test.ts`:
  - Test `buildSystemPrompt` with each genre → output contains genre name and guidance text
  - Test `buildSystemPrompt` with `genre: 'Horror'` and `gradeLevel: 'K-2'` → output contains "spooky" or "silly", NOT "scary" or "frightening"
  - Test `buildSystemPrompt` with no genre → output does NOT contain "GENRE:"
  - Test `buildUserPrompt` continuation with genre → output contains "Maintain the Mystery genre"
  - Test `buildUserPrompt` starter with genre → output contains "GENRE REQUIREMENT"
  - Test `buildUserPrompt` without genre → output unchanged from baseline

---

### US-009: Genre-aware challenge strings

**Description:** As a developer, I need the creative challenge strings to incorporate genre-specific guidance so the AI receives consistent genre signals from both the system prompt and the challenge.

**Acceptance Criteria:**

- [ ] `getGradeLevelChallenge()` in `storyAgent.ts` accepts an optional `genre?: string` parameter
- [ ] Genre-specific challenge modifiers are appended to the base challenge (e.g., Mystery → "Include a mysterious element that raises questions", Comedy → "Include a humorous moment or funny character trait")
- [ ] `buildStarterRequest()` passes `request.theme` as the genre parameter to `getGradeLevelChallenge()`
- [ ] When genre is undefined, challenge strings are unchanged
- [ ] Typecheck passes

**Validation Test:**

- [ ] Write `__tests__/services/storyAgent.genre.test.ts`:
  - Test `getGradeLevelChallenge('K-2', 'Mystery')` → includes base K-2 challenge + mystery modifier
  - Test `getGradeLevelChallenge('9-12', 'Comedy')` → includes base 9-12 challenge + comedy modifier
  - Test `getGradeLevelChallenge('3-5')` (no genre) → identical to current output
  - Test `buildStarterRequest` with `theme: 'Fantasy'` → `challenge` field includes fantasy modifier

## Functional Requirements

- FR-1: The system must store a `preferredGenre` field on each user profile as an optional value, one of: `'Mystery' | 'Fantasy' | 'Comedy' | 'Horror' | 'Fiction' | 'Fairy Tale'`
- FR-2: The Settings screen must display 6 genre buttons plus a "No Preference" clear option below the Grade Level selector
- FR-3: When a user taps a genre button, the system must persist the selection to Convex and show a confirmation alert
- FR-4: When a user taps their currently-selected genre, the system must clear the selection (set to undefined)
- FR-5: The HomeScreen must read the user's preferred genre from their profile and pass it to `generateStoryStarter()` as the `theme` parameter
- FR-6: The HomeScreen must pass the preferred genre to `continueStory()` as the `genre` parameter on each turn
- FR-7: The GPT-4 system prompt must include genre-specific writing style guidance when a genre is selected
- FR-8: The GPT-4 user prompt must reinforce the genre requirement for both story starters and continuations
- FR-9: Horror genre guidance must be auto-softened for K-2 ("spooky and silly") and 3-5 ("mild suspense") grade levels
- FR-10: When no genre is selected, all story generation behavior must be identical to the current system (backward compatible)
- FR-11: Fallback (non-AI) story selection must prefer genre-matching categories when a genre is set

## Non-Goals (Out of Scope)

- No per-story genre selection (genre is a persistent user preference, not chosen per story)
- No genre analytics or tracking (which genres are most popular)
- No genre-specific art style changes for image generation
- No genre influence on the gamification/XP system
- No multi-genre selection (user picks one genre at a time)
- No genre recommendation engine
- No data migration for existing profiles (the field is optional)

## Design Considerations

- **UI Pattern:** Reuse the existing `gradeButton` / `selectedGradeButton` styles from SettingsScreen. The 6 genres fit into 3 rows of 2 (buttons are `width: '48%'`). Add a smaller "No Preference" text button below the grid.
- **Existing Components to Reuse:**
  - `gradeButton`, `selectedGradeButton`, `gradeButtonText`, `selectedGradeButtonText` styles in SettingsScreen
  - `handleGradeLevelChange` pattern for optimistic UI with error rollback
  - `convertConvexProfileToLegacy` mapping pattern in AuthContext

## Technical Considerations

- **No Migration Required:** `v.optional(genreValidator)` means existing Convex documents return `undefined` for `preferredGenre` — zero migration overhead
- **Type Propagation:** `StoryContinuationRequest extends StoryRequest`, so adding `genre` to `StoryRequest` automatically makes it available in continuation requests
- **Fallback Safety:** `preferredGenre ?? 'adventure'` in HomeScreen ensures the hardcoded default is preserved when no genre is selected
- **Horror Age-Gating:** Implemented at the prompt level (genre guidance map has grade-aware entries for Horror), not at the UI level — Horror remains visible to all grades but the AI generates age-appropriate content
- **Convex Reactivity:** Genre changes in Settings propagate to HomeScreen automatically via Convex's reactive `useQuery` → AuthContext pipeline

## Success Metrics

- User can select, change, and clear genre preference in under 2 taps
- Genre preference persists across app restarts
- AI-generated story starters noticeably reflect the selected genre
- AI-generated continuations maintain genre consistency within a session
- No regression in existing story generation for users without a genre preference
- All 9 validation test suites pass

## Open Questions

- Should the genre selection be part of onboarding (first-time user flow)?
- Should completed stories display their genre as a tag in the Story Library?
- Should the "No Preference" mode rotate through genres randomly instead of defaulting to 'adventure'?
