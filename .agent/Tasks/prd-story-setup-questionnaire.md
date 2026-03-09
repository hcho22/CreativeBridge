# PRD: Story Setup Questionnaire

## Introduction

When users start a new story in CreativeBridge, the app currently skips straight to AI-generated content using only the user's grade level and profile-stored genre preference. This results in a generic experience with no user input on character, setting, or narrative direction.

This feature adds a **4-step story setup wizard** that appears before each new story, letting users personalize their experience by choosing genre, character, environment, and who writes first. Every question is skippable so users who prefer to jump in quickly can do so — the app picks sensible defaults for anything skipped.

## Goals

- Let users personalize each story with genre, character, setting, and starter preferences
- Provide a smooth, skippable wizard that doesn't slow down users who want to jump in
- Adapt genre labels to be age-appropriate based on the user's grade level
- Support a "user starts first" mode where the student writes the opening line
- Pass all setup choices into the existing story generation pipeline without modifying backend services

## User Stories

---

### US-001: Type Definitions for Story Setup

**Description:** As a developer, I need TypeScript types for all story setup options and answers so the entire feature has a shared, type-safe contract.

**Acceptance Criteria:**

- [x] Create `src/types/storySetup.ts` with the following exported types:
  - `StoryGenre`: `'Mystery' | 'Fantasy' | 'Comedy' | 'Horror' | 'Fiction' | 'Fairy Tale'`
  - `CharacterType`: `'Girl' | 'Boy' | 'Animal' | 'Custom'`
  - `AnimalType`: `'Cat' | 'Dog' | 'Rabbit' | 'Owl' | 'Other'`
  - `StorySetting`: `'Forest' | 'Beach' | 'Castle' | 'Space' | 'Custom'`
  - `StoryStarter`: `'ai' | 'user'`
  - `StorySetupAnswers` interface with fields: `genre`, `characterType`, `animalType`, `customAnimal`, `customCharacter`, `characterName`, `setting`, `customSetting`, `whoStarts`
  - `ResolvedStorySetup` interface with fields: `genre: string`, `character: string | undefined`, `setting: string | undefined`, `whoStarts: StoryStarter`
- [x] Export types from `src/types/index.ts` (or verify barrel export works)
- [x] Typecheck passes: `npx tsc --noEmit`

**Validation Test:**

```
1. Run `npx tsc --noEmit` — no errors related to storySetup types
2. Verify all type unions match the agreed options (6 genres, 4 character types, 5 animal types, 5 settings, 2 starters)
3. Verify StorySetupAnswers has nullable fields (null = skipped) except whoStarts which defaults to 'ai'
```

---

### US-002: Default Resolution Utility

**Description:** As a developer, I need a utility function that resolves skipped (null) questionnaire answers into concrete values the story agent can use, so the story generation pipeline always receives valid inputs.

**Acceptance Criteria:**

- [x] Create `src/utils/storySetupDefaults.ts` with exported function `resolveStorySetup(answers?: StorySetupAnswers): ResolvedStorySetup`
- [x] When `answers` is undefined (no setup), return defaults: random genre from the 6 options, undefined character, undefined setting, `whoStarts: 'ai'`
- [x] When `genre` is null, pick a random genre from the 6 canonical values
- [x] When `characterType` is null, return `character: undefined` (AI decides)
- [x] When `characterType` is `'Girl'` or `'Boy'`, return that label (e.g., `"Girl"`)
- [x] When `characterType` is `'Animal'`:
  - If `animalType` is a preset (Cat/Dog/Rabbit/Owl), use that label (e.g., `"Cat"`)
  - If `animalType` is `'Other'` and `customAnimal` is non-empty, use the custom text
  - If `animalType` is null or `customAnimal` is empty, return `"Animal"` (generic)
- [x] When `characterType` is `'Custom'` and `customCharacter` is non-empty, use the custom text
- [x] When `characterType` is `'Custom'` and `customCharacter` is empty, return `character: undefined` (AI decides)
- [x] When `characterName` is non-empty, append `" named {name}"` to the character string (e.g., `"Cat named Whiskers"`)
- [x] When `setting` is null, return `setting: undefined` (AI decides)
- [x] When `setting` is `'Custom'` and `customSetting` is non-empty, use the custom text
- [x] When `setting` is `'Custom'` and `customSetting` is empty, return `setting: undefined`
- [x] When `setting` is a preset (Forest/Beach/Castle/Space), return that label
- [x] `whoStarts` defaults to `'ai'` when not provided
- [x] Typecheck passes: `npx tsc --noEmit`

**Validation Test:**

```
1. Run `npx tsc --noEmit` — no errors
2. Write a quick unit test or manual console check for these cases:
   a. resolveStorySetup(undefined) → random genre, undefined character, undefined setting, whoStarts: 'ai'
   b. resolveStorySetup({ genre: null, characterType: 'Animal', animalType: 'Cat', characterName: 'Whiskers', ... }) → genre is random, character is "Cat named Whiskers"
   c. resolveStorySetup({ genre: 'Horror', characterType: 'Custom', customCharacter: '', characterName: null, setting: 'Custom', customSetting: '', ... }) → genre: 'Horror', character: undefined, setting: undefined
   d. resolveStorySetup({ characterType: 'Animal', animalType: 'Other', customAnimal: 'hedgehog', characterName: 'Spike', ... }) → character: "hedgehog named Spike"
   e. resolveStorySetup({ characterType: 'Girl', characterName: 'Luna', ... }) → character: "Girl named Luna"
```

---

### US-003: Story Setup Wizard Screen — Genre Step (Step 0)

**Description:** As a user, I want to pick a story genre before starting so the AI creates a story in the style I prefer.

**Acceptance Criteria:**

- [x] Create `src/screens/StorySetupScreen.tsx` as a new screen component with `export default`
- [x] Display progress indicator at top: 4 dots, first dot filled (active)
- [x] Show step title: "Pick a story genre"
- [x] Show 6 genre option buttons in a 2-column grid layout (~48% width each, `flexWrap: 'wrap'`)
- [x] Genre options: Mystery, Fantasy, Comedy, Horror, Fiction, Fairy Tale (with emoji icons)
- [x] **Grade-adaptive labels**: Horror displays as "Spooky" for K-2 and 3-5, "Suspense" for 6-8, "Horror" for 9-12. Comedy displays as "Funny" for K-2. Fiction displays as "Story" for K-2. All other labels remain standard.
- [x] The **stored value** is always the canonical genre (`'Horror'`, `'Comedy'`, etc.) regardless of display label
- [x] Selected option shows `theme.colors.primary` border + light green background
- [x] Tapping a selected option deselects it
- [x] Bottom bar shows: "Close" (X icon) on left (since step 0 has no back), "Skip" centered, "Next" on right
- [x] "Skip" sets genre to null and advances to step 1
- [x] "Next" advances to step 1 with the selected genre (or null if none selected — same as skip)
- [x] "Close" (X) navigates back to HomeScreen without starting a story
- [x] Use `theme.ts` constants for all colors, spacing, typography, shadows
- [x] Screen reads `gradeLevel` from user profile (via `useAuth` context or route params) for grade-adaptive labels
- [x] Typecheck passes: `npx tsc --noEmit`

**Validation Test:**

```
1. Run `npx tsc --noEmit` — no errors
2. Open app → tap "Start New Story" → verify StorySetupScreen renders (may need US-005 navigation wiring first; for isolated testing, temporarily render the screen directly)
3. Verify 6 genre buttons displayed in 2-column grid
4. Tap a genre → verify selected styling (green border + light bg)
5. Tap it again → deselects
6. Switch user profile to K-2 grade → verify Horror shows as "Spooky", Comedy as "Funny", Fiction as "Story"
7. Switch to 6-8 grade → verify Horror shows as "Suspense"
8. Tap "Skip" → verify advances to step 1 (progress dot updates)
9. Tap X (Close) → verify returns to Home screen
```

---

### US-004: Story Setup Wizard — Character Step (Step 1)

**Description:** As a user, I want to choose my story's character type, pick a specific animal if applicable, and optionally name my character — all on one screen.

**Acceptance Criteria:**

- [ ] Step 1 shows title: "Who is your character?"
- [ ] Display 4 character type buttons in 2-column grid: Girl (with emoji), Boy (with emoji), Animal (with emoji), Custom (with emoji)
- [ ] Selected option shows `theme.colors.primary` border + light green background
- [ ] **Animal inline expansion**: When "Animal" is selected, a sub-section slides in below the grid with label "Pick an animal:" and 5 options in a 2-column grid: Cat, Dog, Rabbit, Owl, Other (each with emoji)
- [ ] When "Other" animal is selected, a TextInput appears below the animal grid with placeholder "Type of animal..." and `maxLength={30}`
- [ ] **Custom inline expansion**: When "Custom" is selected, a TextInput appears below the grid with placeholder "Describe your character..." and `maxLength={50}`
- [ ] **Name input**: Always visible at bottom of step with label "Give them a name: (optional)" and `maxLength={30}`
- [ ] **State cleanup**: Switching character type clears irrelevant sub-state:
  - Switching away from "Animal" → clears `animalType`, `customAnimal`
  - Switching away from "Custom" → clears `customCharacter`
  - `characterName` persists across type switches (it applies to all types)
- [ ] Step wrapped in `ScrollView` to handle content growth from inline expansions
- [ ] `KeyboardAvoidingView` wrapping for text inputs
- [ ] Bottom bar: "Back" (goes to step 0), "Skip" (sets all character fields to null, advances), "Next" (advances with current selections)
- [ ] If "Custom" or "Other" is selected but text is empty, treat as skip for that sub-field (AI decides)
- [ ] Progress indicator shows dot 2 of 4 filled
- [ ] Typecheck passes: `npx tsc --noEmit`

**Validation Test:**

```
1. Run `npx tsc --noEmit` — no errors
2. Navigate to step 1 → verify 4 character buttons in grid
3. Tap "Animal" → verify sub-options slide in (Cat, Dog, Rabbit, Owl, Other)
4. Tap "Cat" → verify selected styling on both "Animal" and "Cat"
5. Tap "Other" → verify text input appears with placeholder "Type of animal..."
6. Type "hedgehog" → verify text is captured
7. Now tap "Girl" → verify animal sub-options disappear, animalType/customAnimal cleared
8. Tap "Custom" → verify text input appears with placeholder "Describe your character..."
9. Type a character name in the name field → verify it persists when switching between character types
10. Tap "Skip" → verify advances to step 2 with all character fields null
11. Tap "Back" → verify returns to step 0 (genre) with previous genre selection intact
12. Verify maxLength limits: name capped at 30, custom animal at 30, custom character at 50
```

---

### US-005: Story Setup Wizard — Setting Step (Step 2)

**Description:** As a user, I want to choose where my story takes place so the AI sets the scene in my preferred environment.

**Acceptance Criteria:**

- [ ] Step 2 shows title: "Where does the story happen?"
- [ ] Display 5 setting option buttons in 2-column grid: Forest (with tree emoji), Beach (with palm emoji), Castle (with castle emoji), Space (with rocket emoji), Custom (with pencil emoji)
- [ ] Selected option shows `theme.colors.primary` border + light green background
- [ ] When "Custom" is selected, a TextInput slides in below the grid with placeholder "Describe a place..." and `maxLength={50}`
- [ ] If "Custom" is selected but text is empty and user taps Next, treat as skip (AI decides)
- [ ] `KeyboardAvoidingView` wrapping for the custom text input
- [ ] Bottom bar: "Back" (goes to step 1), "Skip" (sets setting to null, advances), "Next" (advances with selection)
- [ ] Progress indicator shows dot 3 of 4 filled
- [ ] Typecheck passes: `npx tsc --noEmit`

**Validation Test:**

```
1. Run `npx tsc --noEmit` — no errors
2. Navigate to step 2 → verify 5 setting buttons in grid
3. Tap "Castle" → verify selected styling
4. Tap "Custom" → verify text input appears
5. Type "underwater cave" → verify captured
6. Clear text, tap Next → verify treated as skip (setting null in answers)
7. Tap "Back" → verify returns to step 1 with previous character selections intact
8. Tap "Skip" → verify advances to step 3
```

---

### US-006: Story Setup Wizard — Who Starts Step (Step 3)

**Description:** As a user, I want to choose whether the AI or I write the first part of the story, so I can either get inspired by AI or take creative control from the start.

**Acceptance Criteria:**

- [ ] Step 3 shows title: "Who writes first?"
- [ ] Display 2 option buttons (can be full-width stacked or 2-column): "AI starts the story" (with robot/sparkle emoji), "I want to start" (with pencil/writing emoji)
- [ ] "AI starts the story" is pre-highlighted as the default/recommended option
- [ ] Selected option shows `theme.colors.primary` border + light green background
- [ ] Bottom bar: "Back" (goes to step 2), "Skip" (defaults to 'ai', triggers start), "Start Story" (primary button styling, replaces "Next")
- [ ] **Double-tap prevention**: "Start Story" button disables after first tap to prevent duplicate calls
- [ ] Tapping "Start Story" navigates back to HomeScreen with `{ storySetup: StorySetupAnswers }` route params
- [ ] Progress indicator shows dot 4 of 4 filled
- [ ] Typecheck passes: `npx tsc --noEmit`

**Validation Test:**

```
1. Run `npx tsc --noEmit` — no errors
2. Navigate to step 3 → verify 2 options displayed
3. Verify "AI starts the story" is pre-selected by default
4. Tap "I want to start" → verify it becomes selected, AI option deselects
5. Tap "Start Story" → verify navigation back to Home with storySetup params
6. Verify "Start Story" button disables after first tap (rapidly double-tap to test)
7. Tap "Back" → verify returns to step 2 with setting selection intact
8. Tap "Skip" → verify defaults to 'ai' and navigates to Home
```

---

### US-007: Wizard Step Animations and Back Gesture Handling

**Description:** As a user, I want smooth animated transitions between wizard steps and intuitive back navigation, so the setup feels polished and native.

**Acceptance Criteria:**

- [ ] Steps transition with horizontal slide animation using `Animated.timing` with `translateX` (duration: `theme.animation.normal` = 300ms)
- [ ] Going forward: current step slides left out, new step slides in from right
- [ ] Going backward: current step slides right out, previous step slides in from left
- [ ] Progress dots animate fill state with `Animated.spring`
- [ ] **Android hardware back button**: On steps 1-3, goes to previous step (not exit screen). On step 0, exits the setup screen.
- [ ] **iOS swipe-back gesture**: Intercepted via `navigation.addListener('beforeRemove')` — on steps 1-3, prevent default and go to previous step. On step 0, allow default (exit screen).
- [ ] Typecheck passes: `npx tsc --noEmit`

**Validation Test:**

```
1. Run `npx tsc --noEmit` — no errors
2. Navigate forward through all 4 steps → verify smooth left-slide animation on each transition
3. Tap "Back" on step 2 → verify right-slide animation back to step 1
4. On step 0, tap Close (X) → verify exits setup screen
5. (Android) Press hardware back on step 2 → verify goes to step 1, not Home
6. (Android) Press hardware back on step 0 → verify exits to Home
7. (iOS) Swipe back on step 2 → verify goes to step 1
8. (iOS) Swipe back on step 0 → verify exits to Home
9. Verify progress dots animate when transitioning between steps
```

---

### US-008: Navigation Wiring — Register StorySetup Screen

**Description:** As a developer, I need to register the StorySetupScreen in the navigation stack and update route types so the wizard is accessible from HomeScreen.

**Acceptance Criteria:**

- [ ] Add `StorySetup: undefined` to `HomeStackParamList` in `src/navigation/AppNavigator.tsx`
- [ ] Add `storySetup?: StorySetupAnswers` to the `Home` route params type (alongside existing `continueStory`)
- [ ] Import `StorySetupScreen` in `AppNavigator.tsx`
- [ ] Register `<HomeStack.Screen name="StorySetup" component={StorySetupScreen} options={{ headerShown: false }} />` in the HomeStack navigator
- [ ] Add `export { default as StorySetupScreen } from './StorySetupScreen';` to `src/screens/index.ts`
- [ ] Typecheck passes: `npx tsc --noEmit`

**Validation Test:**

```
1. Run `npx tsc --noEmit` — no errors
2. Verify `navigation.navigate('StorySetup')` compiles without type errors
3. Verify `route.params?.storySetup` is accessible in HomeScreen without type errors
4. App loads without crash — navigation container initializes correctly
```

---

### US-009: HomeScreen — Redirect "Start New Story" to Setup Wizard

**Description:** As a user, when I tap "Start New Story", I should see the setup wizard instead of immediately generating a story.

**Acceptance Criteria:**

- [ ] In `src/screens/HomeScreen.tsx`, modify `handleStartNewGame()`:
  - Auth/profile validation stays unchanged (lines 1400-1448)
  - Replace `executeStartNewGame(userIdForSession)` (line 1474) with `navigation.navigate('StorySetup')`
  - Replace `pendingStoryActionRef.current` assignment (line 1463) with `() => navigation.navigate('StorySetup')` so first-story guidance modal navigates to wizard after dismissal
- [ ] Add `useEffect` that watches `route.params?.storySetup`:
  - When `storySetup` param arrives and user is authenticated and no game is active, call `executeStartNewGame(userIdForSession, setup)`
  - Clear the param immediately via `navigation.setParams({ storySetup: undefined })` to prevent re-triggering
- [ ] Import `StorySetupAnswers` type in HomeScreen
- [ ] Typecheck passes: `npx tsc --noEmit`

**Validation Test:**

```
1. Run `npx tsc --noEmit` — no errors
2. Tap "Start New Story" → verify navigates to StorySetupScreen (not immediate story generation)
3. Complete the wizard → verify navigates back to Home and story generation begins
4. Verify first-story guidance flow: new user → guidance modal → dismiss → navigates to wizard
5. Verify "Continue Story" flow is unaffected (still goes to ImportOptions, not the wizard)
```

---

### US-010: HomeScreen — Pass Setup Answers to Story Generation

**Description:** As a developer, I need `executeStartNewGame` to use the questionnaire answers so the AI generates stories matching the user's chosen genre, character, and setting.

**Acceptance Criteria:**

- [ ] Modify `executeStartNewGame` signature to accept optional `StorySetupAnswers`:
  ```typescript
  const executeStartNewGame = async (overrideUserId?: string, setup?: StorySetupAnswers) => {
  ```
- [ ] At the start of `executeStartNewGame`, call `resolveStorySetup(setup)` to get resolved values
- [ ] Pass resolved genre to `storySessionManager.createSession()` metadata as `theme`
- [ ] Pass resolved character to session metadata as `character`
- [ ] Pass resolved setting to session metadata as `setting`
- [ ] Pass resolved genre as `theme` to `storyAgentService.generateStoryStarter()` (replaces `preferredGenre ?? 'adventure'`)
- [ ] Pass resolved character as `character` to `generateStoryStarter()` (field already exists on `StoryStarterRequest`)
- [ ] Pass resolved setting as `setting` to `generateStoryStarter()` (field already exists on `StoryStarterRequest`)
- [ ] When `setup` is undefined (fallback/legacy path), behavior is identical to current: uses `preferredGenre ?? 'adventure'`, no character/setting
- [ ] Typecheck passes: `npx tsc --noEmit`

**Validation Test:**

```
1. Run `npx tsc --noEmit` — no errors
2. Complete wizard with: genre=Fantasy, character=Girl named Luna, setting=Castle
   → Verify AI-generated story is fantasy-themed, mentions a girl (ideally named Luna), set in a castle
3. Complete wizard with: genre=Mystery, character=Animal(Cat) named Whiskers, setting=Forest
   → Verify AI-generated story is mystery-themed with a cat character in a forest
4. Skip all questions → Verify story generates successfully with a random genre and AI-chosen character/setting
5. Verify no changes needed in storyAgent.ts or storyGenerationService.ts (existing fields used as-is)
```

---

### US-011: HomeScreen — "User Starts First" Mode

**Description:** As a user, when I choose "I want to start" in the wizard, I should see an empty story with a writing prompt so I can write the opening line myself.

**Acceptance Criteria:**

- [ ] Add state variable `isUserStarting` (boolean, default false) to HomeScreen
- [ ] When `resolvedSetup.whoStarts === 'user'` in `executeStartNewGame`:
  - Create session normally (with metadata) via `storySessionManager.createSession()`
  - **Skip** the `storyAgentService.generateStoryStarter()` call entirely
  - Set `currentSession` to the new (empty) session
  - Set `isGameActive` to true
  - Set `isUserStarting` to true
  - Initialize challenge system normally
- [ ] In the story display area, when `isUserStarting && contributions.length === 0`:
  - Show a styled prompt card with text: "Write the first line of your story..."
  - Generic prompt with no contextual hints from setup choices
  - Auto-focus the text input field
- [ ] After user submits their first contribution:
  - Set `isUserStarting` to false
  - Normal AI continuation flow resumes via existing `continueStory()`
  - AI response uses the session metadata (genre, character, setting) when continuing
- [ ] When user quits/exits a "user starts" session without writing, handle via existing quit flow (no special handling needed)
- [ ] Reset `isUserStarting` to false when a new game starts or session ends
- [ ] Typecheck passes: `npx tsc --noEmit`

**Validation Test:**

```
1. Run `npx tsc --noEmit` — no errors
2. Complete wizard with "I want to start" → Verify:
   a. No AI text appears in the story area
   b. A styled prompt card shows "Write the first line of your story..."
   c. Text input is auto-focused
3. Type a sentence and submit → Verify:
   a. User's text appears as first contribution
   b. AI generates a continuation (uses genre/character/setting from setup)
   c. isUserStarting flips to false, normal turn-taking continues
4. Complete wizard with "AI starts the story" → Verify normal AI starter flow (no prompt card)
5. Start "user starts" mode → quit without writing → Verify clean exit, no errors
6. Start a new story after quitting → Verify isUserStarting is reset to false
```

---

## Functional Requirements

- FR-1: The system must display a 4-step wizard screen when user taps "Start New Story"
- FR-2: Step 0 must show 6 genre options with grade-adaptive display labels (canonical values stored internally)
- FR-3: Step 1 must show 4 character types with inline expansion for Animal (5 sub-options) and Custom (text input), plus an always-visible optional name field
- FR-4: Step 2 must show 5 setting options with inline text input for Custom
- FR-5: Step 3 must show 2 starter options (AI / User) with AI pre-selected as default
- FR-6: Every step must have a "Skip" button that sets the answer to null (or default for whoStarts)
- FR-7: Text inputs must enforce character limits: names 30 chars, descriptions 50 chars
- FR-8: Empty custom text inputs must be treated as skipped (AI decides), with no validation error
- FR-9: Switching character type must clear irrelevant sub-state (animal/custom selections)
- FR-10: The wizard must pass `StorySetupAnswers` back to HomeScreen via navigation params
- FR-11: `executeStartNewGame` must resolve answers and pass genre/character/setting to `storyAgentService.generateStoryStarter()` and `storySessionManager.createSession()` metadata
- FR-12: When `whoStarts === 'user'`, the system must skip AI story generation and show a generic writing prompt with auto-focused input
- FR-13: After the user's first contribution in "user starts" mode, normal AI turn-taking must resume
- FR-14: The "Start Story" button must disable after first tap to prevent duplicate session creation
- FR-15: Step transitions must animate with horizontal slide (300ms) and progress dots must animate with spring
- FR-16: Android back button and iOS swipe-back must navigate to previous step (not exit) on steps 1-3
- FR-17: No database session is created until after the wizard completes (no orphaned sessions on cancel)

## Non-Goals (Out of Scope)

- No persistence of previous setup choices across sessions (fresh each time)
- No contextual writing prompt for "user starts" mode (generic prompt only)
- No changes to the story agent service or story generation service (existing fields are sufficient)
- No changes to Convex backend mutations or schema
- No new onboarding flow or tutorial for the wizard
- No A/B testing of wizard vs. direct start
- No analytics tracking for wizard completion rates (can be added later)

## Design Considerations

- **UI Pattern Reference**: Grade-level toggle buttons in `src/screens/ProfileCompletionScreen.tsx` (lines 596-618) — use same TouchableOpacity selected/unselected pattern
- **Modal Animation Reference**: `src/components/onboarding/OnboardingChecklistModal.tsx` — scale + opacity entrance pattern
- **Theme Constants**: All styling must use `src/constants/theme.ts` (colors, spacing, typography, shadows, animations, borderRadius)
- **Glass Effects**: Not used for this screen — keep it simple with solid backgrounds matching `theme.colors.background`

## Technical Considerations

- **Existing API compatibility**: `StoryStarterRequest` in `src/services/storyAgent.ts` already has `theme`, `character`, `setting` fields. `storySessionManager.createSession()` already accepts metadata with `theme`, `character`, `setting`. No backend changes needed.
- **HomeScreen complexity**: `src/screens/HomeScreen.tsx` is ~3200 lines. Changes should be minimal and surgical. Consider extracting `executeStartNewGame` into a hook in a future refactor (out of scope).
- **Navigation typing**: `HomeStackParamList.Home` is already a union type (`{ continueStory?: ... } | undefined`). Adding `storySetup` extends this — ensure both params can coexist without conflicts.
- **ScrollView on Character step**: Step 1 content can grow significantly with Animal sub-options + Other text input + name field. Must use `ScrollView` to prevent content overflow.

## Success Metrics

- Users can complete the full wizard in under 30 seconds
- Users can skip the entire wizard (all 4 skips) in under 5 seconds
- AI-generated stories reflect the chosen genre, character, and setting
- "User starts first" mode works seamlessly with existing turn-taking flow
- No increase in story creation errors or session failures

## Open Questions

- Should we add analytics events for wizard step completion/skip rates in a follow-up?
- Should the wizard eventually remember user preferences (opt-in setting)?
- Should there be a "Surprise me!" single button that skips the entire wizard with random choices?
