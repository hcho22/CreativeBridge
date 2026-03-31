# PRD: Story Setup Questionnaire UI Upgrade

## Introduction

The `StorySetupScreen` questionnaire currently looks plain and form-like — small cramped 2-column grid cards, simple dots for progress, and flat text-only navigation buttons. This upgrade transforms it into a polished, modern card-list design that feels premium and fun for kids, inspired by a reference questionnaire UI with full-width option cards, a progress bar with step badges, and a gradient CTA button.

This is a **visual-only upgrade** — no logic, state management, or navigation changes. All modifications are confined to the StyleSheet and render methods within the single existing file.

## Goals

- Transform the questionnaire from a generic form into a delightful, polished experience
- Switch all steps from 2-column grid to full-width list cards for consistency and larger touch targets
- Add a progress bar with numbered step badge and label to replace plain dots
- Add subtitle helper text to each step for better guidance
- Replace flat bottom bar with a full-width gradient (green→blue) CTA button
- Add emoji background circles and checkbox indicators to option cards
- Maintain all existing functionality (animations, keyboard handling, navigation, skip logic)

## User Stories

---

### US-001: Progress Bar with Step Badge

**Description:** As a young user, I want to see a clear progress bar with a numbered step so I know how far along I am in the story setup.

**Acceptance Criteria:**

- [x] Horizontal progress bar track (4px height, full width, `#e0e0e0` background, full border-radius)
- [x] Animated green fill that grows proportionally: `(currentStep + 1) / TOTAL_STEPS * 100%`
- [x] Centered numbered circle badge (32px diameter) above the bar with current step number (1-indexed), white text on `primary` background
- [x] Step label text below the badge showing the step name: "Genre", "Character", "Setting", "Start"
- [x] Spring animation on the badge preserved (reuse existing `dotAnims` logic adapted to the badge)
- [x] Old dot-based progress indicator fully removed

**Validation Test:**

```
Manual: Navigate through all 4 steps and verify:
1. Progress bar fill animates smoothly from 25% → 50% → 75% → 100%
2. Badge number updates (1 → 2 → 3 → 4) with spring pop animation
3. Step label text changes correctly per step
4. Going backward (Back button) reverses the bar fill and badge number
5. No layout shift or flicker during transitions
```

---

### US-002: Title + Subtitle Section

**Description:** As a user, I want to see a helpful subtitle below each step title so I understand what to do.

**Acceptance Criteria:**

- [x] Step title remains bold, centered, `h2` size (26px)
- [x] New subtitle text below each title:
  - Step 0 (Genre): "Choose a genre for your adventure"
  - Step 1 (Character): "Pick who will star in your story"
  - Step 2 (Setting): "Select where the magic happens"
  - Step 3 (Starter): "Decide how your story begins"
- [x] Subtitle styled: `fontSize: 15`, `color: textSecondary (#666666)`, `textAlign: 'center'`, `marginTop: 8`, `marginBottom: 24`
- [x] Subtitles are part of the animated slide content (move with the step transition)

**Validation Test:**

```
Manual: Navigate through all 4 steps and verify:
1. Each step shows the correct title AND subtitle
2. Subtitle text is gray (#666), smaller than the title, centered
3. Subtitles slide in/out with the step content during transitions
4. No text wrapping issues on smaller screen widths (iPhone SE)
```

---

### US-003: Full-Width Option Card — Genre Step ✅

**Status:** COMPLETE (2026-03-31)

**Description:** As a user, I want genre options displayed as polished full-width cards so they are easy to read and tap.

**Acceptance Criteria:**

- [x] Each genre option is a full-width horizontal card (not 2-column grid)
- [x] Card layout: `flexDirection: 'row'`, `alignItems: 'center'`
- [x] **Left — Emoji circle:** 44x44px rounded circle, `backgroundColor: #f5f5f5`, centered emoji (24px font)
- [x] **Center — Label:** `flex: 1`, `marginLeft: 14`, `fontSize: 17`, `fontWeight: '500'`, `color: #333333`
- [x] **Right — Checkbox:** 22x22px rounded square (`borderRadius: 6`), `borderWidth: 1.5`, `borderColor: #d0d0d0`
- [x] Card styling: `paddingVertical: 16`, `paddingHorizontal: 16`, `borderRadius: 12`, `borderWidth: 1.5`, `borderColor: #e0e0e0`, `backgroundColor: #ffffff`, `marginBottom: 12`, shadow: `theme.shadows.sm`
- [x] **Selected state:**
  - Card: `borderColor: primary (#4CAF50)`, `backgroundColor: #f0fff0`
  - Emoji circle: `backgroundColor: #e8f5e9` (light primary tint)
  - Label: `fontWeight: '600'`, `color: primary`
  - Checkbox: `backgroundColor: primary`, `borderColor: primary`, white checkmark "✓" inside
- [x] Grade-adaptive genre labels preserved (e.g., "Spooky" for K-2)
- [x] Toggle behavior preserved (tap to select, tap again to deselect)
- [x] Old `gridContainer` and `genreButton` styles removed — deferred: still used by Character/Setting steps (US-004, US-005); will be removed when those steps migrate to the new card pattern

**Validation Test:**

```
Manual: On the Genre step:
1. All 6 genre cards render full-width in a vertical list
2. Each card shows emoji circle (left), label (center), checkbox (right)
3. Tap a card → selected state applies (green border, green checkbox with ✓, green label)
4. Tap same card again → deselects back to default state
5. Tap a different card → previous deselects, new one selects
6. Scroll works if content overflows on smaller screens
7. Grade-level labels display correctly (switch profile grade to verify)
```

---

### US-004: Full-Width Option Card — Character Step

**Description:** As a user, I want character options as full-width cards with the animal sub-options and text inputs matching the new style.

**Acceptance Criteria:**

- [x] Character type options (Girl, Boy, Animal, Custom) use the same full-width card pattern as Genre
- [x] Animal sub-options (Cat, Dog, Rabbit, Owl, Other) also use the same card pattern, indented or in a sub-section
- [x] Expansion label ("Pick an animal:") styled: `fontSize: 14`, `fontWeight: '600'`, `color: textSecondary`, `marginBottom: 10`, `marginTop: 20`
- [x] Text inputs (custom animal, custom character, character name) updated:
  - `borderRadius: 12` (match cards)
  - `borderWidth: 1.5`
  - `borderColor: #e0e0e0`
  - `backgroundColor: #ffffff` (white, not gray)
  - `paddingVertical: 14`, `paddingHorizontal: 16`
  - `fontSize: 16`
- [x] "Give them a name: (optional)" label matches expansion label style
- [x] Keyboard avoidance still functions correctly on iOS and Android
- [x] All text input max lengths preserved

**Validation Test:**

```
Manual: On the Character step:
1. 4 character cards render full-width
2. Select "Animal" → sub-section appears with "Pick an animal:" label and 5 animal cards
3. Select "Other" animal → text input appears with new styling (white bg, 12px radius)
4. Select "Custom" character → text input appears
5. Character name input always visible at bottom
6. Keyboard avoidance works — inputs scroll into view on iOS
7. All max lengths enforced (type >30 chars in name field)
8. Toggle selection on/off works for both main and sub options
```

---

### US-005: Full-Width Option Card — Setting Step ✅

**Status:** COMPLETE (2026-03-31)

**Description:** As a user, I want setting options as full-width cards matching the same pattern.

**Acceptance Criteria:**

- [x] Setting options (Forest, Beach, Castle, Space, Custom) use the same full-width card pattern
- [x] Custom setting text input uses updated input styling (same as US-004)
- [x] Custom input auto-focuses when "Custom" is selected
- [x] Keyboard avoidance functions correctly

**Validation Test:**

```
Manual: On the Setting step:
1. 5 setting cards render full-width with correct emojis
2. Selection/deselection toggle works
3. Select "Custom" → text input appears and auto-focuses
4. Deselect "Custom" → text input disappears and custom text clears
5. Keyboard avoidance works on iOS
```

---

### US-006: Full-Width Option Card — Starter Step

**Description:** As a user, I want the "Who writes first?" options to use the same consistent card pattern.

**Acceptance Criteria:**

- [x] Starter options ("AI starts the story", "I want to start") use the same full-width card pattern
- [x] "AI" is pre-selected by default (existing behavior preserved)
- [x] Old `starterButton`, `starterButtonSelected`, `starterEmoji`, `starterLabel` styles removed and replaced with shared card styles

**Validation Test:**

```
Manual: On the Starter step:
1. 2 starter cards render full-width
2. "AI starts the story" is selected by default (green border, checkbox checked)
3. Tap "I want to start" → switches selection
4. Only one option can be selected at a time
```

---

### US-007: Bottom Bar — Gradient CTA Button

**Description:** As a user, I want a prominent, fun gradient button at the bottom instead of a flat text button.

**Acceptance Criteria:**

- [x] Bottom bar restructured:
  - **Top row:** Back (left, steps 1-3) / Close "✕" (left, step 0) + Skip (right), both as `textSecondary` colored text buttons
  - **CTA button:** Full-width, `height: 52`, `borderRadius: 12`, `marginHorizontal: 20`, `marginBottom: 8`
- [x] CTA uses `react-native-linear-gradient` (already installed; `expo-linear-gradient` was not available) with gradient: `['#4CAF50', '#2196F3']` (green→blue), `start: {x:0, y:0}`, `end: {x:1, y:0}`
- [x] CTA text: white, `fontSize: 18`, `fontWeight: '600'`, centered
- [x] CTA label changes per step: "Next" (steps 0-2), "Start Story" (step 3), "Starting..." (when loading)
- [x] Disabled state: `opacity: 0.5` (when `isStarting` is true)
- [x] Old `borderTopWidth` separator removed — use `paddingTop: 12` spacing instead
- [x] Double-tap prevention on "Start Story" preserved

**Validation Test:**

```
Manual: On each step:
1. Bottom area shows Back/Close (left) and Skip (right) as text links
2. Full-width gradient button shows below: green-to-blue horizontal gradient
3. Button reads "Next" on steps 0-2, "Start Story" on step 3
4. Tap "Next" → advances to next step
5. Tap "Start Story" → button text changes to "Starting...", becomes semi-transparent, and navigates to Home
6. Double-tap "Start Story" quickly → only fires once
7. "Back" navigates to previous step; "Skip" clears state and advances
8. On step 0, left button is "✕" (close) and navigates back
```

---

### US-008: Slide Animations & Transitions Preserved ✅

**Status:** COMPLETE (2026-03-31) — verification audit, no code changes required

**Description:** As a user, I want the step transitions to remain smooth with the existing slide animations.

**Acceptance Criteria:**

- [x] Slide left/right animations between steps still work (150ms timing) — `animateStepTransition` lines 200-227, `slideAnim` translateX on line 918
- [x] Progress bar fill animates smoothly (not instant jump) — `progressAnim` with `Animated.timing` (300ms, useNativeDriver: false) lines 382-386, interpolated to fill width line 443
- [x] Step badge spring animation preserved — `dotAnims` spring pop (1→1.3→1) lines 363-379, applied to badge scale line 429
- [x] Android hardware back button still navigates to previous step (steps 1-3) or allows exit (step 0) — `BackHandler` listener lines 390-399
- [x] iOS swipe-back gesture still intercepted on steps 1-3 — `beforeRemove` listener lines 402-411, guarded by `isNavigatingAway` ref

**Validation Test:**

```
Manual:
1. Tap "Next" → content slides left out, new content slides right in
2. Tap "Back" → content slides right out, previous slides left in
3. Progress bar fill transitions smoothly (not instant)
4. [Android] Press hardware back on step 2 → goes to step 1
5. [iOS] Swipe from left edge on step 2 → goes to step 1, not exit screen
6. No jank or layout shift during any transition
```

---

## Functional Requirements

- **FR-1:** Replace dot progress indicator with horizontal progress bar + numbered badge + step label
- **FR-2:** Add subtitle text below each step title
- **FR-3:** Replace 2-column grid layout with full-width vertical list cards on all 4 steps
- **FR-4:** Each option card has: emoji in colored circle (left), label (center), checkbox indicator (right)
- **FR-5:** Selected cards show green border, green-tinted emoji circle, green label, filled green checkbox with ✓
- **FR-6:** Text inputs use white background, 12px border radius, 1.5px border matching card style
- **FR-7:** Bottom bar has text-only Back/Skip row + full-width gradient (green→blue) CTA button
- **FR-8:** CTA button uses `expo-linear-gradient` for the gradient
- **FR-9:** All existing animations, keyboard handling, and navigation logic remain unchanged
- **FR-10:** All existing state management (selection, toggle, skip/clear) remains unchanged

## Non-Goals (Out of Scope)

- No new files or extracted components — all changes within `StorySetupScreen.tsx`
- No changes to theme.ts or shared style utilities
- No changes to state logic, navigation params, or handler functions
- No dark mode support (existing TODO)
- No new dependencies (expo-linear-gradient already installed)
- No changes to other screens or components
- No accessibility/a11y enhancements beyond what exists (future task)

## Design Considerations

- **Touch targets:** Full-width cards provide ~52px tap height, exceeding the 44px minimum for children's apps
- **Color contrast:** Primary green (#4CAF50) on white meets WCAG AA for large text; checkbox uses filled green background with white ✓ for clear visibility
- **Gradient direction:** Horizontal left-to-right (green→blue) creates a playful, kid-friendly feel without being distracting
- **Consistency:** All 4 steps use the identical card pattern — reduces cognitive load for young users

## Technical Considerations

- **Single file change:** `src/screens/StorySetupScreen.tsx` — styles + render methods only
- **expo-linear-gradient:** Already in `package.json` — import `LinearGradient` from `expo-linear-gradient` for the CTA button
- **Animated progress bar width:** Use `Animated.timing` with the existing `slideAnim` pattern, or a separate `Animated.Value` for the bar fill percentage
- **Style cleanup:** Remove old grid/dot styles (`gridContainer`, `genreButton`, `genreButtonSelected`, `genreEmoji`, `genreLabel`, `genreLabelSelected`, `progressDot`, `progressDotActive`, `starterButton`, `starterButtonSelected`, `starterEmoji`, `starterLabel`, `starterLabelSelected`)

## Success Metrics

- All 4 questionnaire steps render with the new card-list design
- Step transitions remain smooth with no jank
- All selection/deselection interactions work identically to before
- Gradient CTA button renders correctly on both iOS and Android
- Progress bar animates smoothly between steps
- No TypeScript or ESLint errors introduced

## Open Questions

- None — scope is well-defined as a visual-only upgrade within a single file
