# PRD: Claude-Style Floating Input Bar for Game Session

## Introduction

Redesign the game session input UI from a fixed bottom section (TextInput + separate button row) into a **Claude iOS app-style floating input bar** — a single rounded card that overlays the story content. The card contains the editable TextInput with action buttons (Mic, Speaker, Submit) nested inside. The Exit button relocates to the story header. The "📖 Your Story" title is removed for a cleaner header.

This modernizes the game experience, reduces visual clutter, and puts voice input on equal footing with typing — while keeping both input methods available.

## Goals

- Replace the fixed bottom input section with a floating card overlay
- Embed action buttons (Mic, Speaker, Submit) inside the input card
- Move Exit button to the story book header next to Copy
- Remove "📖 Your Story" title; reorder header to Round → Grade → [Copy] [Exit]
- Maintain full keyboard support (floating bar rises with keyboard)
- Keep all existing functionality (voice input, TTS, story continuation, debouncing)

## User Stories

### US-001: Extract `canUseSpeaker` Logic into Reusable `useMemo`

**Description:** As a developer, I need the speaker-enabled logic extracted from the inline IIFE into a `useMemo` hook so it can be cleanly referenced in the new floating overlay.

**Acceptance Criteria:**

- [x] `canUseSpeaker` is a `useMemo` at the component level (line 208)
- [x] It depends on `currentSession?.story_content` and `currentSession?.contributions`
- [x] Returns `true` only when story has content AND at least one AI contribution exists
- [x] The old IIFE (lines 2931–2959) is removed and replaced by `canUseSpeaker` reference
- [x] Typecheck passes (`npx tsc --noEmit`) — no new errors introduced

**Validation Test:**

```bash
# Verify no TypeScript errors
npx tsc --noEmit

# Verify canUseSpeaker is defined as useMemo
grep -n "const canUseSpeaker = useMemo" src/screens/HomeScreen.tsx

# Verify old IIFE pattern is removed
grep -c "const hasContinuation" src/screens/HomeScreen.tsx  # Should be 0
```

---

### US-002: Redesign Story Book Header

**Description:** As a user, I want a cleaner story header that shows Round, Grade, Copy, and Exit — without the redundant "📖 Your Story" title — so I can quickly see game status and access controls.

**Acceptance Criteria:**

- [x] "📖 Your Story" text removed from header
- [x] Header layout: `Round X/5 | Grade` (left) and `[📋 Copy] [← Exit]` (right)
- [x] Round counter always visible (remove `story_source === 'New'` conditional)
- [x] Copy and Exit buttons wrapped in `headerButtonRow` container
- [x] Exit button triggers `handleExitGame` (same save dialog behavior)
- [x] Exit button styled as small gray pill (matches Copy button sizing)
- [x] Typecheck passes (no new errors — pre-existing test file errors only)

**Validation Test:**

```bash
# Verify "Your Story" text removed
grep -c "Your Story" src/screens/HomeScreen.tsx  # Should be 0 (in game section)

# Verify headerButtonRow exists
grep -n "headerButtonRow" src/screens/HomeScreen.tsx

# Verify Exit button in header calls handleExitGame
grep -A2 "exitButtonHeader" src/screens/HomeScreen.tsx | grep "handleExitGame"

# Verify storyBookTitle style removed
grep -c "storyBookTitle" src/screens/HomeScreen.tsx  # Should be 0

# TypeScript check
npx tsc --noEmit
```

---

### US-003: Remove Fixed Bottom Input Section

**Description:** As a developer, I need to remove the entire `fixedInputSection` block (Animated.View with TextInput, button row, loading indicator, error display) to make room for the new floating input bar.

**Acceptance Criteria:**

- [x] The `<Animated.View style={[styles.fixedInputSection, ...]}> ... </Animated.View>` block is fully removed (was lines 2900–3190)
- [x] TextInput, gameButtonsContainer, buttonRow, loading indicator, and error display are all removed from this location
- [x] The `fixedInputSection` style is removed from StyleSheet
- [x] Old button styles removed: `gameButtonsContainer`, `buttonRow`, `readStoryButton`, `speakButton`, `emojiButtonText`, `exitButtonBottom`, `exitButtonText`, `continueStoryButton`, `continueStoryButtonText`
- [x] Old input styles removed: `inputSection`, `storyInput`
- [x] Old loading/error styles removed: `loadingIndicator`, `loadingSpinner`, `loadingTextContainer`, `progressContainer`, `progressBar`, `progressFill`, `progressText`, `errorContainer`, `errorIcon`, `errorTextContainer`, `errorTitle`, `errorSuggestion`, `retryButton`, `retryButtonText` (Note: `loadingSpinnerButton` kept — still used by start game button)
- [x] Typecheck passes (no new errors introduced; pre-existing errors unrelated to US-003)

**Validation Test:**

```bash
# Verify fixedInputSection removed from styles
grep -c "fixedInputSection" src/screens/HomeScreen.tsx  # Should be 0

# Verify old button styles removed
grep -c "readStoryButton" src/screens/HomeScreen.tsx  # Should be 0
grep -c "continueStoryButton:" src/screens/HomeScreen.tsx  # Should be 0

# Verify old input style removed
grep -c "storyInput:" src/screens/HomeScreen.tsx  # Should be 0
```

---

### US-004: Add Floating Input Bar (Claude-Style Card)

**Description:** As a user, I want a floating input card overlaying the bottom of the story content — containing a text input field and action buttons (Mic, Speaker, Submit) — so the interface feels modern and the story takes up more screen space.

**Acceptance Criteria:**

- [ ] Floating input bar is an `Animated.View` with `position: 'absolute'`, `bottom: 8`, `left: 8`, `right: 8`
- [ ] Bar has white background, `borderRadius: 16`, subtle shadow, `zIndex: 100`
- [ ] Bar bottom position animated by `keyboardHeight` (rises with keyboard)
- [ ] Contains editable multiline `TextInput` with placeholder "Continue the story..."
- [ ] TextInput has no border (card provides visual boundary), serif font, `minHeight: 36`
- [ ] `testID="story-input"` preserved on TextInput
- [ ] `inputDebouncer.handleInput(text)` still called in `onChangeText`
- [ ] Bar is hidden when `showCompletionOptions` is true
- [ ] `storyScrollContent.paddingBottom` increased to `120` to prevent content hiding behind the bar
- [ ] Typecheck passes
- [ ] Verify visually in simulator: card floats over story, content scrolls underneath

**Validation Test:**

```bash
# Verify floating input bar exists
grep -n "floatingInputBar" src/screens/HomeScreen.tsx

# Verify TextInput preserved with testID
grep -n 'testID="story-input"' src/screens/HomeScreen.tsx

# Verify paddingBottom increased
grep -A1 "storyScrollContent:" src/screens/HomeScreen.tsx | grep "paddingBottom"

# Verify position absolute
grep -A3 "floatingInputBar:" src/screens/HomeScreen.tsx | grep "position"

# TypeScript check
npx tsc --noEmit
```

---

### US-005: Add Buttons Inside Floating Input Bar

**Description:** As a user, I want Mic (🎤), Speaker (🔊), and Submit (⬆️) buttons inside the floating input card so I can speak, listen, or submit my story contribution without leaving the input area.

**Acceptance Criteria:**

- [ ] Button row inside the card with `flexDirection: 'row'`
- [ ] Button order (left to right): **Mic → Speaker → flex spacer → Submit**
- [ ] **Mic button**: Uses existing `VoiceInput` component with compact icon style; `voiceButtonContainerRef` wraps it; `onSpeechResult={handleVoiceResult}`, `isEnabled` logic unchanged
- [ ] **Speaker button**: Compact icon button (no background); shows 🔊 (idle) / ⏹️ (speaking); uses `canUseSpeaker` from US-001; `testID="speaker-button"` preserved; same press/longPress handlers
- [ ] **Submit button**: Circular green (#4CAF50) button, 36×36; shows `↑` arrow or `ActivityIndicator` when generating; `testID="continue-story-button"` preserved; triggers `handleContinueStory`; disabled when `!userInput.trim()` or `isGenerating` or `isGameCompleted`
- [ ] All buttons have proper `accessibilityLabel` and `accessibilityRole`
- [ ] Typecheck passes
- [ ] Verify visually in simulator: buttons appear inside the floating card

**Validation Test:**

```bash
# Verify all three buttons exist in floating bar
grep -n "floatingButtonRow" src/screens/HomeScreen.tsx
grep -n 'testID="speaker-button"' src/screens/HomeScreen.tsx
grep -n 'testID="continue-story-button"' src/screens/HomeScreen.tsx
grep -n 'testID="mic-button"' src/components/common/VoiceInput.tsx

# Verify VoiceInput is inside floating bar
grep -B5 "handleVoiceResult" src/screens/HomeScreen.tsx | grep -i "floating"

# Verify submit button uses handleContinueStory
grep -A3 "floatingSubmitButton" src/screens/HomeScreen.tsx | grep "handleContinueStory"

# TypeScript check
npx tsc --noEmit
```

---

### US-006: Add Loading and Error Banners Inside Floating Bar

**Description:** As a user, I want to see loading progress and error messages inside the floating input card so I know when the AI is processing my input or if something went wrong.

**Acceptance Criteria:**

- [ ] **Loading banner**: Compact row inside the card (above TextInput); shows spinning ⚡ emoji, task text (1 line), and progress bar when `generationProgress > 0`; visible when `isValidating`, `isSaving`, or `isGenerating`
- [ ] **Error banner**: Compact row with yellow background (#fff3cd); shows ⚠️ + error message (2 lines max); shows "Retry" link when `generationError.retryable`; Retry calls `setGenerationError(null)` then `handleContinueStory()`
- [ ] Both banners use `borderRadius: 8` with appropriate padding
- [ ] Banners appear above the TextInput, inside the card
- [ ] Typecheck passes

**Validation Test:**

```bash
# Verify loading banner exists
grep -n "loadingBanner" src/screens/HomeScreen.tsx

# Verify error banner exists
grep -n "errorBanner" src/screens/HomeScreen.tsx

# Verify retry logic
grep -A2 "errorBannerRetry" src/screens/HomeScreen.tsx | grep "handleContinueStory"

# TypeScript check
npx tsc --noEmit
```

---

### US-007: Dead Code Cleanup

**Description:** As a developer, I need to remove unused styles and verify no dead references remain after the UI restructuring.

**Acceptance Criteria:**

- [ ] All styles listed in US-003 are removed from `StyleSheet.create`
- [ ] `storyBookTitle` style removed (title text removed in US-002)
- [ ] No orphaned style references in JSX (no `styles.xxx` pointing to removed styles)
- [ ] Keyboard listeners and `keyboardHeight` ref are kept (still needed)
- [ ] `inputDebouncer` and `StoryInputDebouncer` import are kept (still needed)
- [ ] `TextInput` import is kept (still needed)
- [ ] Typecheck passes
- [ ] Lint passes (`npm run lint`)

**Validation Test:**

```bash
# TypeScript check (catches undefined style references)
npx tsc --noEmit

# Lint check
npm run lint

# Run existing tests to ensure no regressions
npm test -- --testPathPattern=endToEndVoiceFeatures

# Verify no references to removed styles
grep -c "styles.readStoryButton" src/screens/HomeScreen.tsx  # Should be 0
grep -c "styles.continueStoryButton" src/screens/HomeScreen.tsx  # Should be 0
grep -c "styles.exitButtonBottom" src/screens/HomeScreen.tsx  # Should be 0
grep -c "styles.storyInput" src/screens/HomeScreen.tsx  # Should be 0
grep -c "styles.fixedInputSection" src/screens/HomeScreen.tsx  # Should be 0
```

---

## Functional Requirements

- FR-1: The floating input bar must use `position: 'absolute'` inside `storyContentSection` to overlay story content
- FR-2: The floating bar's `bottom` position must animate with keyboard height via `Animated.add(8, keyboardHeight)`
- FR-3: The TextInput must remain editable with debounced input validation (`inputDebouncer.handleInput`)
- FR-4: Voice input via VoiceInput component must populate the TextInput's `userInput` state
- FR-5: The Submit (↑) button must trigger `handleContinueStory` and be disabled when input is empty, generating, or game completed
- FR-6: The Speaker button must use `canUseSpeaker` (extracted useMemo) for its enabled state
- FR-7: The floating bar must be hidden when `showCompletionOptions` is true
- FR-8: The Exit button in the header must trigger `handleExitGame` with the same save dialog behavior
- FR-9: Loading and error banners must appear inside the floating card, above the TextInput
- FR-10: `storyScrollContent.paddingBottom` must be increased to prevent content from being permanently hidden behind the overlay

## Non-Goals

- No changes to VoiceInput component internals (`VoiceInput.tsx` unchanged)
- No changes to story generation logic, TTS service, or challenge system
- No new animations beyond keyboard tracking
- No blur/frosted glass effect (no `expo-blur` dependency)
- No changes to completion options modal or image generation modal
- No changes to the welcome/home screen (only the active game session view)

## Technical Considerations

- **Single file change**: All modifications are in `src/screens/HomeScreen.tsx` (~3,500 lines)
- **VoiceInput `style` prop**: Applied at end of internal style array (line 1447), so `floatingIconButton` style will override default rectangular shape
- **Keyboard handling**: Existing `keyboardHeight` animated ref and listeners are reused — only the target view changes from `fixedInputSection` to `floatingInputBar`
- **z-index hierarchy**: Floating bar (100) < Completion overlay (1000) < Image gen modal (1001)
- **Tooltip positioning (US-013)**: `voiceButtonContainerRef` moves inside floating bar; `measureInWindow` still works since ref is attached to a rendered View

## Design Considerations

- **Reference**: Claude iOS app input bar — rounded card with buttons inside, content scrolls behind
- **Card**: White background, `borderRadius: 16`, subtle upward shadow, thin border (#e8e8e8)
- **Buttons**: Mic and Speaker are minimal (no background, just emoji icon); Submit is filled green circle
- **Header**: Compact — `Round X/5 | Grade` left-aligned, `[Copy] [Exit]` right-aligned

## Success Metrics

- Game session UI feels modern and less cluttered
- Story content area is visually larger (no fixed bottom section eating space)
- All existing functionality preserved: typing, voice input, TTS, story continuation
- No TypeScript errors, no lint warnings, existing tests pass

## Open Questions

- None — all requirements clarified through iterative discussion
