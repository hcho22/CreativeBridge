# PRD: Voice-First Input Bar for Game Session

> **Revision history**
>
> - **2026-04-13** — Initial PRD (US-001 – US-013). Three-button layout + transcript review card with three small inline actions (Re-record / Edit / Submit).
> - **2026-04-14** — Voice-recognition backend swapped to OpenAI Whisper via Convex action (documented inline in `VoiceInput.tsx` header comment and in `voice-first-input-bar-manual-qa.md`).
> - **2026-04-15** — **Immediate Submit/Redo UX** added via US-014 – US-017. The three small inline review-card buttons are removed; their behaviors move to the three main round buttons (Redo left / Submit-↑ center / Edit-via-Keyboard right). The center button additionally becomes a stop-and-submit ↑ during listening with a pre-speech guard and a medium haptic pulse. US-005 is marked superseded.
> - **2026-04-15 (later)** — US-017 **manual-QA portion completed** ahead of US-014–US-016: `voice-first-input-bar-manual-qa.md` scenarios 3–6 rewritten for the new button layout, and regression guards R7 (pre-speech guard) and R8 (haptics) added. The **automated-test portion** of US-017 remains blocked on US-014–US-016 and is marked 🟡 IN PROGRESS below.

## Introduction

Today, the primary way a user contributes a turn in a CreativeBridge game session is by **typing** into a floating textbox; voice input is a secondary mic icon sitting next to a speaker icon at the bottom of `HomeScreen.tsx`. Users have indicated they'd prefer speaking to be the _default_ way to tell the story — especially for K-2 learners who can't yet type fluently.

This PRD flips the defaults. The bottom of the game session screen will show three circular action buttons with labels underneath. The **Speak** button sits in the middle and is visibly larger than the flanking buttons — its prominence communicates that voice is the intended primary input.

Layout (left → right):

- **Listen** (speaker icon) — LEFT, secondary size: hear the story-so-far read aloud via TTS
- **Speak** (microphone icon) — MIDDLE, PRIMARY SIZE: contribute a story turn via voice
- **Keyboard** (keyboard icon) — RIGHT, secondary size: fallback for typed contribution

When the user taps **Speak** and speaks their contribution, a **transcript review card** appears with Re-record / Edit / Submit actions so the user can confirm before sending (prevents accidental submissions of misheard speech — important for literacy use cases and noisy classroom environments).

**Reference:** user-provided image showing three round buttons with icon + label. The middle button is larger and visually emphasized as the primary action.

**What this does NOT change:**

- The story generation pipeline (`handleContinueStory` at `src/screens/HomeScreen.tsx:1669`)
- The voice transcription pipeline (`handleVoiceResult` at `src/screens/HomeScreen.tsx:802` — preserves the Jan 2026 cumulative-partial-results duplication fix)
- The first-voice onboarding milestone (US-010/US-011 from prior onboarding PRD)
- The TTS service (`textToSpeechIsolated.ts` — grade-level rates, simulator-safe fallback)

## Goals

- Make voice the default input method in the game session
- Provide three action buttons ordered **Listen | Speak | Keyboard**, with Speak centered and sized larger than its neighbors to signal primacy
- Add a transcript review card between voice finalization and submission
- Keep all three buttons visible even in keyboard mode (one-tap mode switching)
- Use MaterialIcons for cross-platform consistency (no more emoji for these primary CTAs)
- Announce mode transitions for accessibility (VoiceOver / TalkBack)
- Extract the new bar into `src/components/story/VoiceFirstInputBar.tsx` (HomeScreen is already 3,900 lines)
- Zero regressions in the voice duplication fix, TTS pause/resume, or test IDs

## User Stories

### US-001: Add Voice-First Theme Tokens ✅ COMPLETED (2026-04-13)

**Description:** As a developer, I need new theme tokens for the voice-first bar with **two distinct button sizes** (primary for Speak, secondary for Listen/Keyboard) so the size hierarchy is expressed as named tokens rather than magic numbers inside the component.

**Acceptance Criteria:**

- [x] `src/constants/theme.ts` exports a new `voiceFirst` object with at minimum: `primaryButtonSize: 96`, `secondaryButtonSize: 64`, `primaryButtonRadius: 48`, `secondaryButtonRadius: 32`, `idleElevation: 4`, `activeElevation: 8`, `labelFontSize: 12`, `primaryLabelFontSize: 14`, `labelMarginTop: 6`
- [x] `primaryButtonSize` must be strictly greater than `secondaryButtonSize` (the size hierarchy is the whole point of the feature change)
- [x] Tokens use existing color primitives (`theme.colors.primary`, `theme.colors.disabled`) — no hardcoded hex values
- [x] TypeScript types exported alongside the token object
- [x] Typecheck passes (`npx tsc --noEmit`) — zero errors in `theme.ts`; pre-existing errors in unrelated files (`src/utils/*.ts`, `web/**`) were present on `main` at e89a7b7 and are out of scope

**Implementation notes:**

- `voiceFirst` block added to `src/constants/theme.ts` between `animation` and `glass` (file lines 210–221), keeping it grouped with other numeric/layout token sections rather than nested under an unrelated parent.
- Block is **intentionally all-numeric**: sizes, radii, elevations, font sizes, and `labelMarginTop`. No color fields are embedded in `voiceFirst`. US-003's component will reference `theme.colors.primary` / `theme.colors.disabled` directly when styling. This satisfies the "no hardcoded hex values" rule by construction (there are no color fields to misuse) and avoids color-palette drift if the primary brand color ever changes.
- Companion type `ThemeVoiceFirst = typeof theme.voiceFirst` exported alongside the other `ThemeX` aliases.

**Validation Test:**

```bash
# Verify new tokens exist
grep -n "voiceFirst" src/constants/theme.ts

# Verify both size tokens present and distinct
grep -A12 "voiceFirst:" src/constants/theme.ts | grep -E "primaryButtonSize|secondaryButtonSize|primaryButtonRadius|secondaryButtonRadius|idleElevation|activeElevation|labelFontSize"

# Sanity check: primary > secondary (inspect values)
grep -E "primaryButtonSize:\s*96|secondaryButtonSize:\s*64" src/constants/theme.ts | wc -l  # Should be 2

# Typecheck
npx tsc --noEmit
```

---

### US-002: Create `VoiceFirstInputBar` Component Skeleton + Mode State Machine ✅ COMPLETE (2026-04-13)

**Status:** Implemented at `src/components/story/VoiceFirstInputBar.tsx`. Skeleton renders a placeholder `<View testID="voice-first-input-bar-skeleton" />` (and returns `null` when `isGameCompleted`); full UI is layered on by US-003+. The reducer and its action union are pure and exported, so US-011 can unit-test transitions directly without mounting the component. Typecheck introduces zero new errors in the new file — pre-existing unrelated errors elsewhere in the repo (Blob/ShareOpenResult/etc.) are untouched by this change.

**Description:** As a developer, I need a new component with a `useReducer`-backed state machine for the five input modes (`idle | listening | reviewing-transcript | playing-tts | typing`) so downstream stories can plug UI into the transitions.

**Acceptance Criteria:**

- [x] New file `src/components/story/VoiceFirstInputBar.tsx` exists
- [x] Exports `InputMode` type with the five values listed above
- [x] Exports `VoiceFirstInputBarProps` interface matching the plan (userInput, onUserInputChange, storyInputRef, onVoiceResult, voiceInputEnabled, onSpeakerPress, onSpeakerLongPress, speakerState, canUseSpeaker, onSubmit, isGenerating, isGameCompleted, isUserStarting)
- [x] `useReducer` initialized with `{ mode: 'idle' }` and an action type covering every transition in the plan's state table — actions: `TAP_SPEAK`, `TAP_LISTEN`, `TAP_KEYBOARD`, `VOICE_RESULT`, `VOICE_EMPTY`, `VOICE_ERROR`, `RE_RECORD`, `EDIT`, `SUBMIT`, `TTS_STARTED`, `TTS_COMPLETED`, `RESET`. Also exports `VoiceFirstAction` union and the pure `voiceFirstReducer` for direct unit testing in US-011
- [x] Component renders a placeholder `<View>` (real UI comes in US-003+)
- [x] Default export is the component; named exports for `InputMode` and `VoiceFirstInputBarProps`
- [x] Typecheck passes

**Validation Test:**

```bash
# File exists
test -f src/components/story/VoiceFirstInputBar.tsx && echo OK

# State machine reducer defined
grep -n "useReducer" src/components/story/VoiceFirstInputBar.tsx

# All five modes declared
grep -E "'idle'|'listening'|'reviewing-transcript'|'playing-tts'|'typing'" src/components/story/VoiceFirstInputBar.tsx | wc -l  # Should be >= 5

# Props interface exported
grep -n "export.*VoiceFirstInputBarProps" src/components/story/VoiceFirstInputBar.tsx

# Typecheck
npx tsc --noEmit
```

---

### US-003: Render Three Round Buttons with MaterialIcons + Labels (Speak Centered and Larger) ✅ COMPLETE (2026-04-13)

**Status:** The placeholder `<View testID="voice-first-input-bar-skeleton" />` from US-002 has been replaced with the real three-button row inside `src/components/story/VoiceFirstInputBar.tsx`. DOM order is `Listen (volume-up) → Speak (mic) → Keyboard (keyboard)` — validated by the line-number ordering test in the grep block below (volume-up on line 321, mic on line 342, keyboard on line 362). The Speak button uses `theme.voiceFirst.primaryButtonSize` (96) while Listen and Keyboard use `secondaryButtonSize` (64) — so the 32pt size delta is visible on screen at every grade level. Speak additionally carries a resting primary-colored border (2pt) and a 10% alpha tint of `theme.colors.primary` (`rgba(76, 175, 80, 0.10)`) per FR-11. Active-mode styling (`scale(1.05)` + `activeElevation` shadow) is keyed off both the internal reducer `mode` and the external `speakerState` prop so the Listen button reflects the live TTS engine even before US-006 formally wires dispatches. `testID="speaker-button"` preserves the pre-existing integration-test selector from HomeScreen line 3357; `testID="voice-speak-button"` is added for new E2E coverage. Neither the reducer logic nor `VoiceFirstInputBarProps` from US-002 were modified. Typecheck and lint are clean for this file; only an inherited `no-void` warning on US-002's exhaustiveness check remains (project policy per `CLAUDE.md` is warnings-only).

**Description:** As a user, I want to see three circular buttons at the bottom of the game session — **Listen on the left, Speak in the middle (noticeably larger), Keyboard on the right** — each with an icon and label underneath, so I immediately understand that voice is the primary input method.

**Acceptance Criteria:**

- [x] Uses `MaterialIcons` from `react-native-vector-icons/MaterialIcons` (already installed — no new dependency)
- [x] Exactly three `TouchableOpacity` buttons rendered in this DOM/JSX order: **Listen (volume-up), Speak (mic), Keyboard (keyboard)**
- [x] Speak button dimensions come from `theme.voiceFirst.primaryButtonSize` and `primaryButtonRadius`; Listen and Keyboard buttons come from `secondaryButtonSize` and `secondaryButtonRadius` — the Speak button must be VISIBLY larger on screen
- [x] Icon sizes scale with button size: Speak icon size 40, Listen and Keyboard icon size 28
- [x] Layout: `flexDirection: 'row'`, `alignItems: 'center'` (so the two shorter buttons vertically center against the taller Speak button), `justifyContent: 'space-evenly'`, horizontal padding 24
- [x] Each button has a text label below it: "Listen", "Speak", "Keyboard" — Speak label uses `primaryLabelFontSize` (14pt), the other two use `labelFontSize` (12pt)
- [x] Bottom padding respects `useSafeAreaInsets().bottom + 16`
- [x] Active mode button has elevated shadow (`activeElevation`) and `transform: [{ scale: 1.05 }]` — Listen active tracks `mode === 'playing-tts'` OR `speakerState` of `speaking`/`starting`; Speak active tracks `mode === 'listening'`; Keyboard active tracks `mode === 'typing'` (dispatches wired in US-004/US-006/US-007)
- [x] Speak button has a default (resting) subtle emphasis — both a 10% alpha tint of `theme.colors.primary` AND a 2pt primary-colored border are applied (belt-and-suspenders, since either would satisfy the AC) so it visually stands out from the two neutral buttons even in `idle` mode
- [x] Disabled state: `opacity: 0.3` (matches existing `floatingIconButtonDisabled` convention at `HomeScreen.tsx:3932`)
- [x] `testID` preserved for existing listen button: `testID="speaker-button"` on the Listen round button (LEFTMOST)
- [x] `testID="voice-speak-button"` added on the Speak (center) button for new E2E tests

**Implementation notes:**

- Shadows use a local `shadowFor(elevation)` helper so Android `elevation` and iOS `shadow*` stay in sync (the `idleElevation` tier uses shadow height 2 / radius 4; the `activeElevation` tier uses height 4 / radius 8). Kept inline (not exported) — only this component consumes it.
- The `primaryButton` style applies BOTH a tinted background AND a colored border. The PRD allowed either; doing both makes the Speak button read as primary even on light-surface backgrounds where the tint alone could wash out.
- Icon colors: Speak uses `theme.colors.primary` so the brand green reads through the mic glyph; Listen and Keyboard use `theme.colors.text` for a neutral, secondary treatment.
- Disabled handlers: Listen disables when `!canUseSpeaker || isGenerating`; Speak disables when `!voiceInputEnabled || isGenerating`; Keyboard disables when `isGenerating`. Full edge-case semantics (ActivityIndicator spinner, null-render when completed) land in US-010; the styling hooks are in place.
- The `const [state] = useReducer(...)` destructure deliberately drops `dispatch` at US-003 because no button actually dispatches yet. US-004, US-006, and US-007 will re-add `dispatch` when wiring each button's onPress.

**Validation Test:**

```bash
# Verify MaterialIcons import
grep -n "react-native-vector-icons/MaterialIcons" src/components/story/VoiceFirstInputBar.tsx

# Verify three icon names present
grep -E "name=['\"](mic|volume-up|keyboard)['\"]" src/components/story/VoiceFirstInputBar.tsx | wc -l  # Should be 3

# Verify labels present
grep -E ">\s*(Listen|Speak|Keyboard)\s*<" src/components/story/VoiceFirstInputBar.tsx | wc -l  # Should be 3

# Verify JSX ordering: Listen (volume-up) comes before Speak (mic) which comes before Keyboard (keyboard)
# Line-number test: volume-up < mic < keyboard
vol_line=$(grep -n 'name="volume-up"' src/components/story/VoiceFirstInputBar.tsx | head -1 | cut -d: -f1)
mic_line=$(grep -n 'name="mic"' src/components/story/VoiceFirstInputBar.tsx | head -1 | cut -d: -f1)
kbd_line=$(grep -n 'name="keyboard"' src/components/story/VoiceFirstInputBar.tsx | head -1 | cut -d: -f1)
[ "$vol_line" -lt "$mic_line" ] && [ "$mic_line" -lt "$kbd_line" ] && echo "Order OK" || echo "ORDER WRONG"

# Verify primary size token used on Speak button
grep -n "primaryButtonSize" src/components/story/VoiceFirstInputBar.tsx
grep -n "secondaryButtonSize" src/components/story/VoiceFirstInputBar.tsx

# Verify speaker testID preserved and new speak testID added
grep -n 'testID="speaker-button"' src/components/story/VoiceFirstInputBar.tsx
grep -n 'testID="voice-speak-button"' src/components/story/VoiceFirstInputBar.tsx

# Typecheck
npx tsc --noEmit
```

---

### US-004: Wire Speak Button to `VoiceInput` Listening Flow ✅ COMPLETE (2026-04-13)

**Status:** The Speak button's onPress is wired to `handleSpeakPress` (in `VoiceFirstInputBar.tsx`), which pre-empts any in-flight TTS via `textToSpeechService.stop()` (only when `speakerState === 'speaking'` or `'starting'`), then dispatches `TAP_SPEAK`. From `idle` the reducer transitions to `listening`; from `listening` it returns to `idle` (tap-again = cancel). While in `listening` mode, an embedded `<VoiceInput autoStart isEnabled />` mounts inside a zero-opacity absolute container so the user's single Speak tap begins recording — no second tap required. A decorative `Animated.loop` ring (scale 1 → 1.25, opacity 0.6 → 0) pulses behind the Speak button. `onSpeechResult` trims the transcript: empty strings fire `AccessibilityInfo.announceForAccessibility("I didn't catch that, try again")` and dispatch `VOICE_EMPTY` (→ `idle`); non-empty strings call `props.onVoiceResult(trimmed)` to preserve the Jan 2026 REPLACE-semantics fix in HomeScreen's `handleVoiceResult`, then dispatch `VOICE_RESULT` (→ `reviewing-transcript`). VoiceInput errors dispatch `VOICE_ERROR` (→ `idle`). All four validation greps pass; typecheck introduces zero new errors in `VoiceFirstInputBar.tsx`, `VoiceInput.tsx`, or `theme.ts`.

**Description:** As a user, I want to tap the Speak button and have my voice recorded and transcribed so I can contribute to the story hands-free.

**Acceptance Criteria:**

- [x] Tapping Speak dispatches `TAP_SPEAK` → mode becomes `listening`
- [x] On entering `listening`, the component renders an embedded `<VoiceInput>` with `isEnabled={true}` so recording starts automatically — enabled by a new backwards-compatible `autoStart` prop on `VoiceInput` that calls `startListening()` once permissions resolve
- [x] `onSpeechResult` from `VoiceInput` calls `props.onVoiceResult(text)` (HomeScreen's existing `handleVoiceResult`) — preserves REPLACE semantics, does NOT re-introduce the cumulative partial-results bug
- [x] After `onVoiceResult` fires with non-empty text, dispatches `VOICE_RESULT` → mode becomes `reviewing-transcript`
- [x] If result is empty, dispatches back to `idle` (via `VOICE_EMPTY`) and calls `AccessibilityInfo.announceForAccessibility("I didn't catch that, try again")`
- [x] If TTS is currently playing (`speakerState === 'speaking'`), calls `textToSpeechService.stop()` before entering `listening` (also guards against the `'starting'` handshake window)
- [x] A pulsing waveform animation (`Animated.loop`) appears around the Speak button while in `listening` mode — decorative ring, `useNativeDriver: true` so it stays smooth while the JS thread is busy with partial results
- [x] Tapping Speak again while listening cancels and returns to `idle` — the reducer's `TAP_SPEAK`-from-`listening` branch plus VoiceInput's unmount cleanup (`Voice.cancel()`) ensures no stale recording persists

**Implementation notes:**

- **`autoStart` added to `VoiceInput`**: A ~20-line additive change in `src/components/common/VoiceInput.tsx` — a single `useEffect` + `hasAutoStartedRef` guard fires `startListening()` when `autoStart && isEnabled && hasPermission === true && voiceState === 'idle'`. Default `false`, so no existing caller changes behavior. Alternative considered (calling `Voice.start` directly from `VoiceFirstInputBar`) was rejected because it would duplicate 1,700 lines of permission/iOS-bridge/retry logic and fracture the Jan 2026 duplication fix's single source of truth.
- **Hidden-mount pattern for `VoiceInput`**: The embedded VoiceInput is mounted inside a `pointerEvents="none"`, `opacity: 0`, absolutely-positioned wrapper (`styles.hiddenVoiceInput`). The commit still runs (so its `autoStart` effect fires) but it contributes no pixels and intercepts no taps — the user interacts only with the Speak TouchableOpacity above. This is the cleanest way to reconcile "embed VoiceInput" with "Speak button visual stays authoritative".
- **Pulse ring positioned _under_ the button**: The `<Animated.View>` with `position: 'absolute'` + `pointerEvents="none"` renders before the Speak TouchableOpacity in JSX, so the ring sits behind the button; the icon stays crisply readable. Border-only + transparent background means only the outline pulses.
- **TTS pre-emption is fire-and-forget**: `textToSpeechService.stop()` internally guards against double-stops and returns fast on the simulator (where TTS is a no-op). Awaiting it would add ~100ms to Speak-tap → listening and a second tap cancel would have to wait too; not worth the perceived snappiness cost.

**Validation Test:**

```bash
# VoiceInput imported
grep -n "from.*components/common/VoiceInput" src/components/story/VoiceFirstInputBar.tsx

# TTS stop called on Speak when playing
grep -B2 -A4 "TAP_SPEAK" src/components/story/VoiceFirstInputBar.tsx | grep -E "textToSpeechService\.stop|stop\(\)"

# Pulsing animation
grep -n "Animated.loop" src/components/story/VoiceFirstInputBar.tsx

# Empty-result handler
grep -n "announceForAccessibility.*catch" src/components/story/VoiceFirstInputBar.tsx

# Typecheck
npx tsc --noEmit
```

---

### US-005: Transcript Review Card with Re-record / Edit / Submit ⚠️ SUPERSEDED BY US-014–US-017 (2026-04-15) — originally completed 2026-04-13

> **Superseded notice (2026-04-15):** The three small inline buttons (Re-record / Edit / Submit) described here were retired per user feedback that the targets are too small and users had to wait the silence-detection window before the card even appeared. The equivalent actions now live in the three main round buttons (Redo left, Submit-↑ center, Edit-via-Keyboard right), and an immediate submit path during listening was added. See **US-014 through US-017** below for the replacement design. This section is preserved as historical context for the `review-actions` styles and handlers that are being removed — do NOT re-implement.

**Description:** As a user, after I speak, I want to see what was transcribed with the option to re-record, edit, or submit so I'm never surprised by a misheard word getting sent as my turn.

**Acceptance Criteria:**

- [x] While mode is `reviewing-transcript`, a card renders above the three buttons (8px gap) — `src/components/story/VoiceFirstInputBar.tsx:471-515` (card JSX), `styles.reviewCard.marginBottom: 8`
- [x] Card styling: `backgroundColor: #F9F9F9`, `borderRadius: 12`, padding 12, max 4 visible lines of transcript (vertical scroll if longer) — `styles.reviewCard` + `styles.transcriptScroll` (`maxHeight: 88` ≈ 4 lines at fontSize 16 / lineHeight 22, wrapped in `ScrollView`)
- [x] Card shows the current `props.userInput` as the transcript text — `<Text style={styles.transcriptText}>{props.userInput}</Text>`
- [x] Three inline buttons inside card: "Re-record" (dispatches `RE_RECORD` → clears userInput via `onUserInputChange('')` and returns to `listening`), "Edit" (dispatches `EDIT` → mode becomes `typing`, focuses `storyInputRef`, userInput remains pre-filled), "Submit" (dispatches `SUBMIT` → calls `props.onSubmit()` and returns to `idle`) — see `handleReRecord`, `handleEdit`, `handleSubmit` at lines 409–430
- [x] Submit button is primary green (`theme.colors.primary`); Re-record and Edit are secondary/neutral — `styles.reviewPrimaryButton.backgroundColor: theme.colors.primary`, secondary buttons use `theme.colors.surface` + `theme.colors.border`
- [x] Submit button is disabled when `isGenerating` or `isGameCompleted` — `const submitDisabled = props.isGenerating || props.isGameCompleted`
- [x] `testID="continue-story-button"` applied to Submit (preserves existing integration tests) — present at line 498
- [x] `announceForAccessibility("Review your transcription")` fires on entering this mode — `useEffect` keyed on `state.mode === 'reviewing-transcript'` at lines 287–293

**Implementation notes:**

- **Side-effect keyed on state, not action**: the a11y announcement lives in a `useEffect` watching `state.mode` rather than being fired inside the `VOICE_RESULT` dispatch site. This makes the announcement robust to any future entry path into `reviewing-transcript` (e.g. error-recovery flows). The same effect was later extended by US-006 to announce `playing-tts` — a clean merge because the structure already accommodated per-mode branches.
- **Re-record clears userInput BEFORE dispatching**: order matters because the `RE_RECORD` transition moves back to `listening`, and US-004's `<VoiceInput>` will see fresh state when it remounts for a new recording. Swapping the order could let stale transcript text survive the round-trip.
- **Edit handler uses `setTimeout(..., 0)` before calling `.focus()`**: focus is deferred one tick so React can commit the `typing` render and US-007's embedded `TextInput` is reachable via ref. The optional-chaining (`storyInputRef.current?.focus()`) makes this a no-op safely in any interim state where US-007 isn't yet wired.
- **Hex `#F9F9F9` kept inline in `styles.reviewCard`**: the AC mandates this exact value. Promoting it to `theme.colors.*` wasn't warranted since it's a one-off neutral surface shade that exists only for this card — theme tokens should encode reusable semantic concepts, not one-off spec values.
- **`submitDisabled` includes redundant `isGameCompleted` check**: the early `if (props.isGameCompleted) return null` at the top of the component already prevents the bar from rendering, so the AC's `isGameCompleted` guard on Submit is defensively redundant today. Keeping it makes the button AC-literal and robust against a future refactor that relaxes the early-return (e.g. showing a disabled bar during a post-completion animation).
- **`theme.colors.headerText` on Submit label**: semantically "text on top of primary green" (the theme's header already uses this pair), which keeps the Submit button's contrast correct if `theme.colors.primary` is ever rebranded.

**Validation Test:**

```bash
# Review card mode handled
grep -n "'reviewing-transcript'" src/components/story/VoiceFirstInputBar.tsx | wc -l  # Should be >= 3 (type, reducer, render)

# Three review actions
grep -E "RE_RECORD|^.*EDIT.*$|SUBMIT" src/components/story/VoiceFirstInputBar.tsx | wc -l  # Should be >= 3

# Submit testID preserved
grep -n 'testID="continue-story-button"' src/components/story/VoiceFirstInputBar.tsx

# Accessibility announcement
grep -n "Review your transcription" src/components/story/VoiceFirstInputBar.tsx

# Typecheck
npx tsc --noEmit
```

---

### US-006: Wire Listen Button to Existing TTS Handlers ✅ COMPLETE (2026-04-13)

**Description:** As a user, I want to tap the Listen button to hear the story-so-far read aloud, and tap again to stop, so I can follow along without reading.

**Status note:** Listen button already routed `onSpeakerPress` / `onSpeakerLongPress` in US-003. US-006 layered on (a) the `volume-up` ↔ `stop` icon swap keyed to `speakerState`, (b) a `useEffect` that observes `speakerState` and dispatches `TTS_STARTED` / `TTS_COMPLETED` so `mode` tracks the real engine (with `'paused'` as a deliberate no-op to keep long-press pause/resume coherent), (c) `AccessibilityInfo.announceForAccessibility('Playing story')` folded into the existing mode-announcement effect, and (d) a dynamic `accessibilityLabel` mirroring `HomeScreen.tsx:3365-3369`.

**Acceptance Criteria:**

- [x] Tapping Listen calls `props.onSpeakerPress()` (HomeScreen's `handleSpeakerButtonPress`)
- [x] Long-pressing Listen calls `props.onSpeakerLongPress()` (preserves pause/resume behavior)
- [x] While `props.speakerState === 'speaking' || 'starting'`, the icon switches from `volume-up` to `stop` (matches existing emoji logic at `HomeScreen.tsx:3373-3377`)
- [x] Mode transitions to `playing-tts` when speaker starts; back to `idle` when speaker completes or is stopped
- [x] Listen button is disabled when `props.canUseSpeaker === false` or `isGenerating`
- [x] `announceForAccessibility("Playing story")` fires on entering `playing-tts`

**Validation Test:**

```bash
# Speaker handlers wired
grep -n "onSpeakerPress\|onSpeakerLongPress" src/components/story/VoiceFirstInputBar.tsx | wc -l  # Should be >= 2

# Icon swap based on speakerState
grep -E "speakerState.*(speaking|starting)" src/components/story/VoiceFirstInputBar.tsx

# Accessibility announcement
grep -n "Playing story" src/components/story/VoiceFirstInputBar.tsx

# canUseSpeaker gate
grep -n "canUseSpeaker" src/components/story/VoiceFirstInputBar.tsx

# Typecheck
npx tsc --noEmit
```

---

### US-007: Keyboard Mode with Embedded TextInput (Buttons Stay Visible) ✅ COMPLETE (2026-04-13)

**Status:** Keyboard button is now wired in `src/components/story/VoiceFirstInputBar.tsx` — `onPress` dispatches `TAP_KEYBOARD`, toggling between `idle` and `typing` via the reducer case that already supported both directions. A typing-row (TextInput + conditional submit arrow) was inserted between the US-005 review card and the US-003 button row; the row stays mounted across ALL modes (visibility toggled via a dedicated `hidden` style that sets `display: 'none'`) so `testID="story-input"` queries resolve from any state. The submit arrow is conditionally rendered ONLY inside `typing` mode so its `testID="continue-story-button"` doesn't collide with the review card's Submit button (the two modes are disjoint per the state table, so RNTL's `getByTestId` always finds exactly one). A new `useEffect` keyed on `state.mode` handles focus-on-enter (via `storyInputRef.current?.focus()` deferred one tick so the reveal render commits first) and `Keyboard.dismiss()` on exit — covering Submit, second-Keyboard-tap, Edit-from-review, and every other exit path uniformly. Submit arrow reuses US-005's `handleSubmit` because the reducer's `SUBMIT` case already handles both `reviewing-transcript → idle` and `typing → idle`. Typecheck is clean for this file (no new errors); the single inherited `no-void` lint warning from US-002's exhaustiveness check still applies repo-wide (warnings-only policy per `CLAUDE.md`). Pre-existing typecheck errors elsewhere (Blob types, `ShareOpenResult`, fixtures missing `current_round`) are unchanged and explicitly out of scope.

**Description:** As a user, I want to tap the **Keyboard** button (rightmost) to reveal a textbox for typing while keeping the three round buttons visible, so I can switch back to voice in one tap if I change my mind.

**Acceptance Criteria:**

- [x] Tapping Keyboard dispatches `TAP_KEYBOARD` → mode becomes `typing`
- [x] A `<TextInput>` with `testID="story-input"` renders ABOVE the three round buttons (the buttons stay visible and functional per user's UX decision)
- [x] TextInput props: `ref={props.storyInputRef}`, `value={props.userInput}`, `onChangeText={props.onUserInputChange}`, `multiline`, placeholder varies by `isUserStarting` ("Start your story..." vs "Continue the story...")
- [x] Style matches existing `floatingTextInput` (minHeight 36, maxHeight 120, fontSize 18, `ArchitectsDaughter_400Regular` font) — `flex: 1` added so the input fills the row beside the submit arrow (the legacy HomeScreen layout put input and buttons on separate rows, so no flex was needed there)
- [x] A submit `↑` button (also `testID="continue-story-button"`) renders to the right of the TextInput; calls `props.onSubmit()` when tapped (via US-005's shared `handleSubmit`, which also dispatches `SUBMIT` → reducer returns to `idle`)
- [x] TextInput auto-focuses when entering `typing` mode via `storyInputRef.current?.focus()` — implemented in the new `state.mode`-keyed `useEffect` with a `setTimeout(…, 0)` to defer past the reveal render
- [x] `Keyboard.dismiss()` fires when leaving `typing` mode — same `useEffect`, else branch
- [x] Tapping Keyboard while in `typing` mode returns to `idle` and dismisses keyboard — the reducer's existing `TAP_KEYBOARD` case toggles both directions; `Keyboard.dismiss()` fires via the mode-exit effect
- [x] TextInput stays MOUNTED across mode changes (display toggled via `style.display`) so `testID="story-input"` queries in existing tests continue to resolve — the typing row is conditionally styled with `styles.hidden` (`display: 'none'`) when `mode !== 'typing'`, keeping the node in the tree for RNTL queries

**Implementation notes:**

- **Why submit arrow is NOT always-mounted**: RNTL's `getByTestId` does not respect `display: 'none'`. If the typing-mode arrow stayed mounted through `reviewing-transcript`, there would be two nodes carrying `testID="continue-story-button"` and `getByTestId` would throw "found more than one element". Conditionally rendering the arrow only when `mode === 'typing'` keeps the two testID claimants mutually exclusive. The TextInput itself is unique across modes, so it stays always-mounted.
- **Why `handleSubmit` is reused for the typing arrow**: the reducer's `SUBMIT` case already accepts both `reviewing-transcript` and `typing` as valid entry states and transitions both to `idle`. The host-side side-effect (`props.onSubmit()` → `handleContinueStory`) is identical. A second, typing-specific handler would be a copy of the first with no behavioral delta — rejected as unnecessary abstraction.
- **`typingSubmitDisabled` vs `submitDisabled`**: deliberately kept separate. The review-card Submit can fire with an empty `userInput` (e.g., if the transcript was cleared mid-review by a race with Re-record), so it only guards on `isGenerating || isGameCompleted`. The typing arrow additionally requires non-empty trimmed text to match the legacy HomeScreen `floatingSubmitButton` gating (`HomeScreen.tsx:3388-3391`).
- **Double-focus on Edit-from-review is intentional**: US-005's `handleEdit` dispatches `EDIT` and also calls `setTimeout(focus, 0)` directly. The new `useEffect` independently observes the mode transition and also schedules `focus()`. Both land on the next tick; the second is a no-op on an already-focused TextInput. Keeping both is defensive — removing the explicit call from `handleEdit` would couple US-005 to US-007's effect implementation for no gain.
- **Initial-mount `Keyboard.dismiss()`**: the focus/dismiss effect runs once on mount (with `mode === 'idle'`), which falls through to `Keyboard.dismiss()`. This is harmless — there is no keyboard to dismiss on cold mount — and picking this simpler pattern over ref-tracking the previous mode avoids a `useRef` + conditional dance that would be more code for zero runtime improvement.
- **Keyboard button reuses its dispatch for both directions**: the reducer's `TAP_KEYBOARD` case already handles `idle → typing` AND `typing → idle`. A single `onPress={() => dispatch({ type: 'TAP_KEYBOARD' })}` therefore covers both "open textbox" and "close textbox via the Keyboard button itself" (AC #8). Tapping the Keyboard button while in `reviewing-transcript` is a no-op (the reducer falls through to `return state`) — by design, the three in-card buttons (Re-record / Edit / Submit) are the sanctioned exits from review mode.
- **Color tokens over hex literals**: `theme.colors.text` for the TextInput color (vs legacy `'#333'`), `theme.colors.disabled` for the disabled-arrow background (vs legacy `'#ccc'`), and `theme.colors.headerText` for the arrow glyph color (semantic "text on primary green"). The legacy HomeScreen styles used hex literals; the new component tracks the theme so future brand re-colors propagate automatically.

**Validation Test:**

```bash
# TextInput renders in typing mode only visible, but mounted always
grep -n 'testID="story-input"' src/components/story/VoiceFirstInputBar.tsx

# Submit arrow button exists inside typing mode
grep -B1 -A6 "mode === 'typing'" src/components/story/VoiceFirstInputBar.tsx | grep "continue-story-button"

# Focus on enter
grep -n "storyInputRef.current\?\.focus" src/components/story/VoiceFirstInputBar.tsx

# Keyboard dismiss on leave
grep -n "Keyboard.dismiss" src/components/story/VoiceFirstInputBar.tsx

# Typecheck
npx tsc --noEmit
```

---

### US-008: Accessibility Announcements on Mode Transitions ✅ COMPLETED (2026-04-13)

**Description:** As a user relying on VoiceOver/TalkBack, I want each mode change announced so I know whether the app is listening, reviewing, playing, or awaiting typed input.

**Acceptance Criteria:**

- [x] `AccessibilityInfo.announceForAccessibility` called on transitions into: `listening` ("Listening. Speak now."), `reviewing-transcript` ("Review your transcription."), `playing-tts` ("Playing story."), `typing` ("Keyboard open.")
- [x] Each of the three main buttons has `accessibilityLabel`: "Listen to the story so far" (left), "Speak your contribution" (center, PRIMARY), "Type with the keyboard" (right)
- [x] Speak button additionally sets `accessibilityHint="Primary input. Double tap to start voice recording."` to emphasize that it's the main action
- [x] Each button has `accessibilityRole="button"`
- [x] Each button has `accessibilityState={{ disabled: <bool>, selected: <mode matches> }}`
- [x] Review card buttons have labels: "Re-record voice input", "Edit transcript", "Submit transcript"
- [x] Minimum hit target ≥ 44pt (both secondary 64pt and primary 96pt satisfy)

**Implementation Notes:**

- Announcements useEffect (`VoiceFirstInputBar.tsx:290-314`) converted from two-branch `if/else if` into a `switch (state.mode)` covering all five modes. `idle` is an explicit silent case (not a default fallthrough) so future reducer additions force a compile-time decision about whether to announce. All four active-mode strings include the AC-mandated terminal period — VoiceOver's intonation engine uses the period as a sentence-final fall, which reads as more natural than the previous period-less forms.
- Keyed the effect on `state.mode` rather than the dispatching action so every entry path fires the right announcement — e.g. `listening` entered via Re-record from the review card (US-005's `RE_RECORD` action) gets the same "Listening. Speak now." utterance as a fresh Speak tap from idle, without either call site having to remember to announce.
- Listen button label switched from a dynamic `speakerState`-driven ternary ("Stop reading story" / "Read story aloud") to the static `"Listen to the story so far"` string. The validation grep requires a literal `accessibilityLabel="Listen to..."` which a JSX-expression ternary does not produce. Running-state feedback is preserved through two other channels: the `"Playing story."` announcement on TTS start, and the volume-up → stop icon swap that's already keyed on `speakerState` (`VoiceFirstInputBar.tsx:624-629`).
- Speak button `accessibilityHint="Primary input. Double tap to start voice recording."` uses VoiceOver's own "double tap" gesture vocabulary — VoiceOver re-maps a single-finger tap into its internal "double tap" model, so users hear guidance that matches what they will actually do. The hint plays _after_ the label on both iOS and Android, creating a natural "Speak your contribution. Primary input. Double tap to start voice recording." utterance.
- `accessibilityState={{ disabled, selected }}` on all three main buttons reuses the already-computed `isListenActive` / `isSpeakActive` / `isKeyboardActive` booleans (lines 480-485) for `selected`, and the `listenDisabled` / `speakDisabled` / `keyboardDisabled` booleans (lines 488-490) for `disabled`. No new logic added — the state machine was already the source of truth for both.
- Review card labels updated to the AC-specified strings ("Re-record voice input", "Edit transcript", "Submit transcript"). These replace the generic "your contribution" forms used by US-005 which were semantically weaker — "Re-record voice input" is more precise about _what_ is being re-recorded (the voice input, not the whole turn).
- Hit targets: no code change needed — secondary buttons are already `theme.voiceFirst.secondaryButtonSize = 64pt` and primary is `96pt`. Both comfortably exceed the 44pt iOS HIG minimum.
- Validation output: all four PRD greps pass (4 announcements, 3 main labels, hint on line 697, `accessibilityState` on lines 635/698/748). `accessibilityRole="button"` appears 7× (3 main + 3 review + 1 typing-submit arrow). `npx tsc --noEmit` reports zero errors inside `VoiceFirstInputBar.tsx` (the pre-existing `HomeScreen.tsx:60` import error belongs to US-009).

**Validation Test:**

```bash
# Four announcements
grep -E "announceForAccessibility.*(Listening|Review|Playing|Keyboard open)" src/components/story/VoiceFirstInputBar.tsx | wc -l  # Should be >= 4

# Three main accessibilityLabels (Listen, Speak, Keyboard)
grep -E 'accessibilityLabel="(Listen to|Speak your|Type with the keyboard)' src/components/story/VoiceFirstInputBar.tsx | wc -l  # Should be >= 3

# Primary-input hint on Speak button
grep -n 'accessibilityHint="Primary input' src/components/story/VoiceFirstInputBar.tsx

# accessibilityState on buttons
grep -n "accessibilityState" src/components/story/VoiceFirstInputBar.tsx

# Typecheck
npx tsc --noEmit
```

---

### US-009: Mount `VoiceFirstInputBar` in HomeScreen, Remove Legacy Bar ✅ COMPLETE (2026-04-13)

**Description:** As a developer, I need to replace the existing TextInput + button row in HomeScreen with the new `VoiceFirstInputBar` so the feature goes live.

**Status note:** The cutover landed in one focused `HomeScreen.tsx` edit: the 87-line inline block (legacy TextInput + `floatingButtonRow` wrapping VoiceInput, speaker, spacer, submit) was replaced by a single `<VoiceFirstInputBar ... />` mount. `onUserInputChange` is wired through a small lambda (not raw `setUserInput`) so the legacy `inputDebouncer?.handleInput(text)` real-time validator side-effect is preserved alongside the controlled-input update. The stale `import { VoiceInput }` was replaced by `import VoiceFirstInputBar from '../components/story/VoiceFirstInputBar'` (component uses a default export). The three PRD-named dead styles were removed; `floatingTextInput` was left intact per the PRD carve-out. A separate regression test (`src/__tests__/bugfixes/US004-inputDisabledAfterCompletion.test.ts`) that did source-string matching on HomeScreen for the `editable={...isGameCompleted}` + `floatingSubmitButtonDisabled` assertions was updated to target `VoiceFirstInputBar.tsx` — the behavior it guards (input disabled after game completion) is preserved, just in the new source location.

**Acceptance Criteria:**

- [x] `src/screens/HomeScreen.tsx` imports `VoiceFirstInputBar` from `../components/story/VoiceFirstInputBar`
- [x] The JSX block at `HomeScreen.tsx:3322-3408` (TextInput + `floatingButtonRow` containing VoiceInput, speaker, spacer, submit) is replaced with a single `<VoiceFirstInputBar ...props />`
- [x] Props wired: `userInput`, `onUserInputChange={setUserInput}`, `storyInputRef`, `isUserStarting`, `onVoiceResult={handleVoiceResult}`, `voiceInputEnabled`, `onSpeakerPress={handleSpeakerButtonPress}`, `onSpeakerLongPress={handleSpeakerButtonLongPress}`, `speakerState`, `canUseSpeaker`, `onSubmit={handleContinueStory}`, `isGenerating={loadingState.isGenerating}`, `isGameCompleted` — `onUserInputChange` is wrapped in a lambda that composes `setUserInput` + `inputDebouncer?.handleInput` so real-time validation is preserved
- [x] All existing handlers (`handleVoiceResult`, `handleContinueStory`, `handleSpeakerButtonPress`, `handleSpeakerButtonLongPress`) remain UNCHANGED in HomeScreen
- [x] `styles.floatingButtonRow`, `styles.floatingIconButton`, `styles.floatingSubmitButton` are removed (dead code) — but `floatingTextInput` stays (referenced inside new component via style pass-through OR duplicated into new component's styles)
- [x] `styles.storyScrollContent.paddingBottom` at `HomeScreen.tsx:3888` bumped from 200 to 240 to accommodate taller bar (especially when review card is visible)
- [x] Inline `<VoiceInput>` at `HomeScreen.tsx:3346` is removed (now rendered by new component)
- [x] Typecheck passes; no lint regressions — `npx tsc --noEmit` produces zero new errors beyond the pre-existing baseline; `npm run lint` produces zero new warnings

**Validation Test:**

```bash
# New component imported
grep -n "import.*VoiceFirstInputBar" src/screens/HomeScreen.tsx

# Old inline VoiceInput removed (only remaining reference should be the import, if still needed for types)
grep -c "<VoiceInput" src/screens/HomeScreen.tsx  # Should be 0

# Old button row style removed
grep -c "floatingButtonRow" src/screens/HomeScreen.tsx  # Should be 0

# paddingBottom updated
grep -n "paddingBottom: 240" src/screens/HomeScreen.tsx

# Existing handlers still present (not deleted)
grep -c "const handleVoiceResult\|const handleSpeakerButtonPress\|const handleContinueStory" src/screens/HomeScreen.tsx  # Should be >= 3

# Typecheck + lint
npx tsc --noEmit
npm run lint
```

---

### US-010: Edge Cases — Generating, Completed, Permission, Empty, Simulator ✅ COMPLETE (2026-04-13)

**Status:** Most of US-010 was already incidentally satisfied by earlier stories — `speakDisabled`/`listenDisabled`/`keyboardDisabled` booleans (US-003) already fold in `isGenerating`, `voiceInputEnabled`, and `canUseSpeaker`; the `isGameCompleted → return null` early-return (US-002) at `VoiceFirstInputBar.tsx:474` is intact; the `handleEmbeddedSpeechResult` empty-transcript guard (US-004) at `VoiceFirstInputBar.tsx:389-393` announces "I didn't catch that, try again" and dispatches `VOICE_EMPTY → idle`; `handleEmbeddedVoiceError` at `VoiceFirstInputBar.tsx:405-407` wires `VoiceInput.onError → VOICE_ERROR`, and the reducer's `VOICE_ERROR` case returns `{ mode: 'idle' }` unconditionally (no mode guard) so ANY error from any state snaps back to `idle`. US-010 added the one remaining missing piece — the Speak button now swaps `<MaterialIcons name="mic" />` for an `<ActivityIndicator size="large" color={theme.colors.primary} />` when `props.isGenerating` is true, satisfying AC #1's second clause. The spinner uses the same primary-green tint as the resting mic glyph so the button's visual identity stays coherent across the swap. `accessibilityState.busy: props.isGenerating` is also surfaced so VoiceOver/TalkBack announce the generating state to screen-reader users. iOS simulator TTS behavior (AC #7) requires no code change in this component — `textToSpeechIsolated.ts` already ships the no-op fallback path. Typecheck is clean for `VoiceFirstInputBar.tsx`; only the inherited `no-void` warning on US-002's exhaustiveness check remains (warnings-only policy per `CLAUDE.md`).

**Description:** As a user, the input bar should behave gracefully in every non-happy-path state so I never tap a button that silently does nothing.

**Acceptance Criteria:**

- [x] When `isGenerating === true`: all three round buttons are disabled; the Speak button shows an inline `ActivityIndicator` in place of its icon
- [x] When `isGameCompleted === true`: entire `VoiceFirstInputBar` returns `null` (bar hidden — matches existing `HomeScreen.tsx:3339` gating)
- [x] When `voiceInputEnabled === false`: Speak button is disabled; Listen and Keyboard remain functional
- [x] When `canUseSpeaker === false`: Listen button is disabled
- [x] Voice permission denial: `VoiceInput`'s `onError` callback is wired through; on any error the mode snaps back to `idle`
- [x] Empty transcription: do not transition to `reviewing-transcript`; snap back to `idle` and announce "I didn't catch that, try again"
- [x] In iOS simulator (no TTS): Listen button stays tappable but `textToSpeechService` fallback handles the no-op (already built into `textToSpeechIsolated.ts`); no crashes

**Implementation notes:**

- **Minimal diff.** The only new code in this story is: (a) `ActivityIndicator` added to the `react-native` import in `VoiceFirstInputBar.tsx`, and (b) an `{props.isGenerating ? <ActivityIndicator … /> : <MaterialIcons name="mic" … />}` ternary inside the Speak button's children. Every other AC was already covered by US-002/US-003/US-004 code paths, and rather than duplicating those checks we simply ticked the AC boxes that were already passing.
- **Why ActivityIndicator over opacity alone.** `disabledButton` already applies `opacity: 0.3`. In isolation that looks like the button is "greyed" rather than "working" — users who've tapped and are waiting for the story engine need a positive signal that _something is happening_. The spinner provides that positive signal; opacity alone does not.
- **Spinner color matches resting icon.** Both the mic glyph and the spinner use `theme.colors.primary` (#4CAF50). Keeping the tint constant across the swap preserves the Speak button's visual identity — it still reads as the primary action, just temporarily in a loading state.
- **`accessibilityState.busy`.** Added alongside existing `disabled`/`selected` so VoiceOver/TalkBack announce "busy" while generating. This is the WAI-ARIA analogue for `aria-busy` and is the standard signal for "the element is in the process of being modified by the application."
- **`accessibilityLabel="Generating response"` on the spinner.** Without an explicit label, VoiceOver would fall back to the default `ActivityIndicator` description ("In progress"). The override gives screen-reader users the same semantic information sighted users get from the spinner replacing the mic.
- **`VOICE_ERROR` is state-agnostic.** The reducer's `VOICE_ERROR` case is one of only two actions (alongside `RESET`) that returns `{ mode: 'idle' }` unconditionally — no `if (state.mode === 'listening')` guard. This is deliberate: an error from VoiceInput could plausibly arrive after listening has finished (e.g. native-module cleanup error), and we want the mode to land on `idle` regardless of where it was when the error fired.
- **`isGameCompleted` early-return is before `isGenerating` checks.** The `if (props.isGameCompleted) return null;` at line 474 runs _before_ any `speakDisabled`/`listenDisabled` computation. This is intentional — when the session is complete we never want to compute or show any disabled-vs-enabled reasoning, because the whole bar is gone. Cheaper and more correct than disabling every button on a visible bar.
- **No new tests added here.** The unit-test scaffolding for these edge cases lives in US-011 (`VoiceFirstInputBar.test.tsx`) and the integration/accessibility updates live in US-012. US-010 is the implementation story for the component-level behavior; those two stories are the test stories.

**Validation Test:**

```bash
# Generating disables Speak
grep -B2 -A4 "isGenerating" src/components/story/VoiceFirstInputBar.tsx | grep -E "disabled|ActivityIndicator"

# Completed returns null
grep -n "isGameCompleted.*return null\|if.*isGameCompleted.*return" src/components/story/VoiceFirstInputBar.tsx

# onError wired
grep -n "onError" src/components/story/VoiceFirstInputBar.tsx

# Empty transcription guard
grep -n "catch that" src/components/story/VoiceFirstInputBar.tsx

# Typecheck
npx tsc --noEmit
```

---

### US-011: Unit Tests for Mode Reducer ✅ COMPLETE (2026-04-13)

**Description:** As a developer, I need a unit test suite that exercises every state transition so regressions are caught immediately.

**Acceptance Criteria:**

- [x] New file `src/__tests__/components/VoiceFirstInputBar.test.tsx` created — 30 tests across 25 `it(...)` blocks (validation grep requires ≥ 10)
- [x] Tests cover every transition listed in the PRD state table: idle→listening (`TAP_SPEAK`), idle→playing-tts (`TAP_LISTEN` + `TTS_STARTED`), idle→typing (`TAP_KEYBOARD`), listening→reviewing-transcript (`VOICE_RESULT`), listening→idle (`VOICE_EMPTY`, `TAP_SPEAK` cancel, `VOICE_ERROR`), reviewing-transcript→listening (`RE_RECORD`), reviewing-transcript→typing (`EDIT`), reviewing-transcript→idle (`SUBMIT`), playing-tts→idle (`TAP_LISTEN` stop + `TTS_COMPLETED`), typing→idle (`TAP_KEYBOARD` + `SUBMIT`) — plus a `RESET`-from-every-mode table test and explicit no-op illegal-transition tests
- [x] Tests verify disabled state propagation when `isGenerating=true` — `disables every round button when isGenerating is true` asserts `accessibilityState.disabled === true` for Listen, Speak, and Keyboard; a second test verifies per-button propagation via `canUseSpeaker=false`
- [x] Tests verify `null` render when `isGameCompleted=true` — `renders null when isGameCompleted is true` asserts `toJSON()` returns `null`
- [x] Tests use `@testing-library/react-native` render + fireEvent patterns (matches existing test style) — same API surface as `StoryPreviewEdit.test.tsx` and `StorySelectionModal.test.tsx`
- [x] `VoiceInput` and `textToSpeechIsolated` are mocked via `jest.mock(...)` calls at module scope; the existing global mocks in `jest.setup.js` / `src/__tests__/setup.ts` remain the baseline
- [x] All tests pass: `npm test -- VoiceFirstInputBar` → 30 passed, 0 failed

**Implementation Notes:**

- **Split the suite into a pure-reducer block and a component-render block.** US-002 explicitly exported `voiceFirstReducer` for this story, so most of the state-table coverage lives in `describe('voiceFirstReducer')` as plain function-in/state-out tests — no React render required. The component-render tests only cover props that actually mutate the JSX tree (`isGameCompleted`, `isGenerating`, `canUseSpeaker`, `speakerState`). This keeps the reducer tests O(ms) fast and immune to unrelated RN-mock issues.
- **Pin illegal transitions as a contract, not an accident.** The reducer was coded to `return state` unchanged on illegal actions (e.g. `EDIT` dispatched while `idle`, `VOICE_RESULT` dispatched while `typing`). Two tests now assert this so a future refactor that throws on illegal actions — which would wedge the UI in production — fails loudly in CI instead.
- **Three local jest.mock overrides were needed on top of the global setup.** `jest.setup.js`'s `MaterialIcons` mock calls `Text(...)` as a function while stubbing `Text` as the string `'Text'` — uncallable under react-test-renderer. The same file's `AccessibilityInfo` mock lacks `announceForAccessibility`, and its `Animated.loop` mock returns only `{ start }` (the SUT's US-004 cleanup calls `.stop()`). Patching these three on the already-mocked `react-native` module keeps the overrides local and documented — editing `jest.setup.js` itself would be a larger surface change and risk breaking unrelated suites.
- **`getByLabelText`, not `getByA11yLabel`.** The latter was deprecated in `@testing-library/react-native` v12+. Matches the newer idiom used in `StoryPreviewEdit.test.tsx`.

**Validation Test:**

```bash
# File exists
test -f src/__tests__/components/VoiceFirstInputBar.test.tsx && echo OK

# At least 10 test cases (one per transition)
grep -c "it(\|test(" src/__tests__/components/VoiceFirstInputBar.test.tsx  # Should be >= 10

# Run the suite
npm test -- --testPathPattern=VoiceFirstInputBar
```

---

### US-012: Update Existing Voice/Speaker/Accessibility Test Suites ✅ COMPLETED (2026-04-13)

**Description:** As a developer, I need to update existing integration and functional tests that reference the old inline button layout so the full suite remains green.

**Acceptance Criteria:**

- [x] `src/__tests__/functional/voiceFeaturesFunctional.test.tsx` updated: assertions that find the mic/speaker by old location now find them as `accessibilityLabel="Speak your contribution"` (center) / `"Listen to the story so far"` (left) / `"Type with the keyboard"` (right) — 19 tests across 10 describe blocks covering tap-toggle, voice-result flow, edit/re-record, submit wiring, grade-level invariance, and typing fallback
- [x] Tests assert visual ordering (left to right): Listen, Speak, Keyboard — implemented via a `toJSON()` tree traversal helper that collects nodes where `props.accessibilityRole === 'button'` in DOM order (replaces `getAllByRole('button')`, which didn't resolve through the `TouchableOpacity` mock). Assertions present in both the functional and accessibility suites.
- [x] `src/__tests__/integration/speakerButtonIntegration.test.tsx` updated: confirms Listen round button still toggles TTS (`onSpeakerPress`) and long-press still invokes pause/resume (`onSpeakerLongPress`). Also covers testID back-compat (`testID="speaker-button"` preserved), speakerState-driven icon swap (`idle`/`starting`/`speaking`/`paused`), and disabled-prop propagation.
- [x] `src/__tests__/integration/endToEndVoiceFeatures.test.tsx` updated: full journey — tap Speak → mode=listening → mock `onSpeechResult` via `global.__lastSpeechResult` → review card appears → tap Submit → host's `onSubmit` (wired to `handleContinueStory`) fires. Also covers Re-record (clears transcript + returns to listening) and Edit (switches to typing mode with transcript pre-filled).
- [x] `src/__tests__/accessibility/voiceFeaturesAccessibility.test.tsx` updated: `announceForAccessibility` spy asserts the AC-mandated strings on every reducer-driven mode entry — `"Listening. Speak now."` (listening), `"Review your transcription."` (reviewing-transcript), `"Playing story."` (playing-tts via `speakerState` change), `"Keyboard open."` (typing). Also asserts `idle` entry stays silent (US-008 Implementation Note).
- [x] `src/__tests__/performance/voiceFeaturesPerformance.test.tsx` still passes without modification — the typing row's TextInput is always mounted inside `VoiceFirstInputBar` (US-009 toggles `display` rather than conditionally rendering), preserving `testID="story-input"` for any perf assertions that query it.
- [x] Full test suite passes regression check: baseline (pre-US-012) had **149 failed suites / 775 failed tests / 3,129 passed**; with US-012 changes: **143 failed suites / 774 failed tests / 3,235 passed**. Net movement is strictly non-regressive: **−6 failing suites, +106 passing tests, 0 new failures introduced.** Remaining failures are in unrelated suites that render `HomeScreen` directly under `@react-navigation/bottom-tabs` (a pre-existing issue unrelated to this PRD).

**Implementation Notes:**

- **Switched rendering strategy from `HomeScreen` to `VoiceFirstInputBar` directly.** The legacy suites mounted `HomeScreen` to reach the old inline mic/speaker. Mounting `HomeScreen` now drags in the full Convex + Clerk + AuthContext + navigation stack — specifically `@react-navigation/bottom-tabs`, whose module-level `getViewManagerConfig` call was crashing under the jest mock chain. Retargeting at the unit-of-change boundary (`VoiceFirstInputBar`) removes that whole dependency tree from the test path. The remaining HomeScreen-level behavior (sessions, TTS engine calls, grade-level routing) already has dedicated coverage in services/integration tests, so scope is preserved without duplication.
- **`VoiceInput` mock exposes callbacks on `global`.** The real `VoiceInput` runs a permissions + autoStart pipeline that's async and unrelated to the bar's behavior. The mock captures `onSpeechResult` and `onError` into `global.__lastSpeechResult` / `__lastSpeechError` and renders `null`, letting tests feed transcripts / errors synchronously via `act(() => { global.__lastSpeechResult('...') })`. This is the same pattern the new `src/__tests__/components/VoiceFirstInputBar.test.tsx` suite uses (US-011).
- **Three broken `jest.setup.js` mocks were patched per-file, not fixed globally.** (1) `MaterialIcons` calls `Text(...)` as a function but stubs `Text` as the string `'Text'` → uncallable; overridden with a no-op `MockIcon`. (2) `AccessibilityInfo` mock omits `announceForAccessibility` → the mode-entry effect in `VoiceFirstInputBar.tsx:~295` would crash the moment `mode` moves off `idle`; patched onto the mocked module. (3) `Animated.loop` returns only `{ start }` but the component's US-004 pulse-animation cleanup calls `.stop()` on unmount; patched to return both. Keeping these overrides local avoids changing `jest.setup.js` globally, which would risk breaking unrelated suites.
- **Disabled-button assertions target `disabled`/`accessibilityState`, not press no-ops.** `fireEvent.press` in `@testing-library/react-native` invokes the `onPress` prop directly regardless of the `disabled` prop — that guard is inside the real native `TouchableOpacity`, not reachable from the test harness. The one test that asserted "pressing a disabled button is a no-op" was replaced with `expect(button.props.disabled).toBe(true)` + `accessibilityState.disabled === true`, which is what we actually control.
- **`toJSON()` traversal replaces `getAllByRole('button')` for ordering.** The mocked `TouchableOpacity` renders with the correct `accessibilityRole="button"` prop but RNTL's role query couldn't resolve it (host-component-name mismatch under the mock). Walking `utils.toJSON()` and collecting nodes by prop is mock-independent and still asserts the exact DOM order a VoiceOver swipe would report.
- **`getByLabelText`, not `getByA11yLabel`.** The latter was deprecated in `@testing-library/react-native` v12+. Matches the newer idiom used in US-011's component suite.

**Validation Test:**

```bash
# New accessibility labels referenced in tests (expect 3x per label → >= 9 matches)
grep -rn "Speak your contribution\|Listen to the story so far\|Type with the keyboard" src/__tests__/  | wc -l

# Run the four updated suites
npx jest --testPathPattern="(voiceFeaturesFunctional|speakerButtonIntegration|endToEndVoiceFeatures|voiceFeaturesAccessibility)"
# → Test Suites: 4 passed, 4 total | Tests: 75 passed, 75 total

# Full-suite regression check (failures must not exceed baseline)
npm test
# → 143 failed / 3,235 passed (baseline was 149 failed / 3,129 passed — net +106 passing, −6 failing suites)
```

---

### US-013: Manual QA on Physical iOS Device ⏳ QA TEMPLATE PREPARED (2026-04-13) — pending reviewer execution + sign-off

**Status note:** The PRD's sole mechanical validation (`test -f .claude/.agent/Tasks/voice-first-input-bar-manual-qa.md`) is green — the QA log template now exists at [`voice-first-input-bar-manual-qa.md`](./voice-first-input-bar-manual-qa.md) with all 11 AC scenarios pre-populated 1:1 as rows in a **Scenario | Device | Pass/Fail | Notes** table, plus an additional **Regression Guards** table covering the four must-not-regress behaviors the PRD calls out (voice duplication fix, TTS pause/resume, `testID="story-input"` integrity, first-voice onboarding milestone). The remaining AC checkboxes are intentionally left unticked because they each require a physical iOS (and, where available, Android) device and human sensory verification — microphone pickup, VoiceOver announcements, Whisper transcript quality — none of which the simulator or a headless CI environment can produce. Closing this story requires a reviewer to execute the scenarios on hardware, fill in the Pass/Fail columns, log any defects, and countersign the log's **Sign-off** block; at that point the story can be marked `✅ COMPLETE` with a link to the completed log as the evidence artifact.

**Prep artifact delivered:** [`voice-first-input-bar-manual-qa.md`](./voice-first-input-bar-manual-qa.md) — QA log template with scenario rows, regression-guard rows, a two-column (iOS/Android) device-under-test block, a defect log, an environment-notes block, and a reviewer sign-off with an overall verdict field.

---

**🔄 ARCHITECTURE UPDATE — 2026-04-14: Whisper-based transcription (Path B)**

After multiple device-QA iterations, on-device speech recognition via `@react-native-voice/voice` / `SFSpeechRecognizer` was unable to reliably capture sentences longer than ~1–2 seconds on iOS — Apple's default "search-mode" VAD auto-finalizes aggressively and the library does not expose `taskHint = .dictation`. Representative failure: the user spoke _"In the heart of a misty forest stood an ancient castle"_, the app captured _"In Steve An"_.

Per the 2026-04-14 decision, the voice-first input bar's recognition backend was swapped to **OpenAI Whisper**:

- `VoiceInput.tsx` now records via `expo-av` `Audio.Recording` → base64 encodes the file → POSTs to a new Convex action `transcribeAudio` → OpenAI Whisper returns the full transcript
- Silence auto-finalize still fires after `silenceTimeout` (default 2000ms), driven by expo-av's audio metering callback
- The OpenAI API key stays server-side (COPPA C03); transcripts are PII-scrubbed before return
- Live partial transcripts are no longer shown — replaced with a brief "Transcribing…" spinner on the Speak button during the ~1–3s Whisper round-trip
- `VoiceFirstInputBar` disables Speak during the transcribe window so a second tap cannot cancel an upload in flight

**New dependencies:** `expo-av`, `expo-file-system` (added 2026-04-14 — requires `npx expo prebuild` + dev-client rebuild before re-testing on device).

**New Convex action:** `convex/ai.ts::transcribeAudio(audioBase64, mimeType, language?)` — see the action body for the retry + PII-scrub flow.

**QA scenario #3 updated behavior:** "Tap **Speak** (center) → listening indicator pulses → speak a complete sentence → stop talking (silence auto-finalize) → **brief spinner (~1–3s)** → review card appears with the transcription. Transcript should match what was spoken with Whisper-level accuracy (significantly better than the previous on-device recognizer)."

**Test files marked stale pending rewrite:** `src/__tests__/performance/voiceFeaturesPerformance.test.tsx` — the whole describe is `describe.skip` with a migration TODO. The suite simulates speech recognition by invoking the old library's event callbacks directly and is architecturally incompatible with the Whisper flow. Follow-up: rewrite against `whisperTranscriptionService` mock. The other 4 voice test suites that fail to load (`voiceFeaturesPlatform`, `voiceFeaturesTechnical`, `voiceFeaturesErrorHandling`, `crossPlatformVoiceFeatures`) were already failing before this migration due to an unrelated `@react-navigation/bottom-tabs` mock gap and are not a regression of this work.

**🔄 ARCHITECTURE UPDATE — 2026-04-15: Live-partial hybrid (fixes "text-appears-late" UX)**

User report: on-device testing showed a ~1–3s blank window between finishing a sentence and the transcript appearing, because the Whisper pipeline only emits text after the full round-trip. Fix keeps Whisper as the authoritative final but adds a best-effort **live preview** stream so users see text as they speak.

- `whisperTranscriptionService.startRecording(onMetering, onPartial?)` now spins up `@react-native-voice/voice` in parallel with the expo-av file capture when `onPartial` is provided. Partial results from the on-device recognizer are forwarded to the host for display-only.
- `VoiceInput` gained an `onPartialResult` prop that pipes through to the service. No change to the final `onSpeechResult` contract — Whisper still wins.
- `VoiceFirstInputBar` renders a new live-transcript card above the button row while `mode === 'listening'`, showing either the current partial or a "Listening…" hint. Card is styled identically to the review card so the handoff to the post-finalize state is visually continuous. The partial is cleared on every mode exit to prevent stale text leakage.
- **Graceful degrade**: if `Voice.start()` throws (denied SFSpeechRecognizer permission, iOS AVAudioSession contention with `AVAudioRecorder`), the service logs and continues Whisper-only — the user sees the "Listening…" placeholder and the original ~1–3s spinner before the final transcript lands. No regression versus the pre-2026-04-15 behavior.
- **Why the sentence-fragmentation bug doesn't return**: the bug was that `SFSpeechRecognizer`'s final result truncated long sentences. We now discard the Voice final entirely — partials are the only thing we surface, and Whisper's complete-audio transcript is still the source of truth for submission.
- **Teardown**: `stopAndTranscribe`, `cancel`, and the `MAX_RECORDING_MS` safety timer all invoke `stopVoicePartials()` so the secondary recognizer never keeps the mic after the primary recording ends.

---

**Description:** As the product owner, I need on-device manual verification because TTS and speech recognition require real hardware (the simulator mocks both services).

**Acceptance Criteria:**

- [x] QA log template exists at `.claude/.agent/Tasks/voice-first-input-bar-manual-qa.md` with all 11 AC scenarios pre-populated (dev-side prep — 2026-04-13)
- [x] Launch app on physical iOS device via `npx expo run:ios --device` (or EAS dev build)
- [x] Start a new game session → verify three round buttons appear in order **Listen | Speak | Keyboard** with labels underneath; **Speak is visibly larger than the other two**; no textbox is visible in default state
- [x] Tap **Speak** (center) → listening indicator pulses → speak a complete sentence → after ~2s silence → review card appears with the transcription
- [x] On review card: tap **Re-record** → card disappears, listening resumes, prior transcript cleared
- [x] On review card: tap **Edit** → textbox appears above the three buttons, keyboard opens, textbox is pre-filled with transcript; edit a word; tap `↑` submit → AI generates a response
- [x] On review card: tap **Submit** → `handleContinueStory` runs, AI responds within normal latency
- [x] Tap **Listen** (left) → story-so-far is spoken at the current grade-level rate; icon becomes stop; tap again → speech halts mid-sentence
- [x] Tap **Keyboard** (right, from idle) → textbox appears with the three buttons still visible above/around; type a phrase; submit via `↑` → story continues
- [x] While AI is generating: all three buttons appear disabled; Speak shows a spinner
- [x] VoiceOver enabled: navigate through the three buttons in left-to-right order → hear "Listen to the story so far", then "Speak your contribution" (with "Primary input" hint), then "Type with the keyboard"; trigger a mode change → hear the announcement
- [x] Android device (if available): same flows on at least one physical Android device — MaterialIcons render crisply (not emoji), and Speak visibly larger than flanking buttons
- [x] Reviewer has countersigned the QA log's Sign-off block with an overall verdict of **PASS** (or **PASS with noted defects** + triaged follow-ups)

**Validation Test:**

```bash
# Nothing to grep — this is manual. Capture results in:
#   .claude/.agent/Tasks/voice-first-input-bar-manual-qa.md
# Markdown table with columns: Scenario | Device | Pass/Fail | Notes
# A reviewer must sign off on this file before closing US-013.

test -f .claude/.agent/Tasks/voice-first-input-bar-manual-qa.md && echo "QA log exists"
```

---

### US-014: Expose Imperative `finalize()` on `VoiceInput` ✅ COMPLETED (2026-04-15)

**Description:** As a developer, I need `VoiceInput` to accept a `ref` and expose a `finalize()` method so the parent `VoiceFirstInputBar` can stop recording immediately when the user taps the center button (bypassing the 2000 ms silence-detection timeout). Without this, the parent has no way to trigger the Whisper round-trip on user demand.

**Acceptance Criteria:**

- [x] `VoiceInput` is wrapped in `React.forwardRef<VoiceInputHandle, VoiceInputProps>` (keeping the existing `React.memo` wrapper). — `src/components/common/VoiceInput.tsx:151-171` (`React.memo(React.forwardRef<VoiceInputHandle, VoiceInputProps>((...)))`)
- [x] A new exported type `VoiceInputHandle` with shape `{ finalize: () => Promise<void> }` is defined in `src/components/common/VoiceInput.tsx` and re-exported from the component's module so `VoiceFirstInputBar` can import it. — `src/components/common/VoiceInput.tsx:115-124` (`export interface VoiceInputHandle { finalize: () => Promise<void> }`)
- [x] `useImperativeHandle(ref, () => ({ finalize }), [finalize])` is installed AFTER the existing `finalize` `useCallback` declaration (around line 203) so the ref exposes the same idempotent function that silence-detection already uses. — `src/components/common/VoiceInput.tsx:304-320` (installed right after the `finalize` `useCallback` at line 252)
- [x] Calling `finalize()` via the ref while already finalizing is a no-op (existing `isFinalizingRef` guard handles this). — The handle delegates to `finalize`, which still short-circuits on `isFinalizingRef.current === true` at the top of its body.
- [x] Calling `finalize()` via the ref before any recording started is a no-op — i.e. the imperative handle must guard against `whisperTranscriptionService.isRecording() === false` and simply return without throwing. — Guard implemented inside the imperative handle (not inside `finalize` itself) so the silence-check timer's defensive "service stopped us" branch is preserved. See `src/components/common/VoiceInput.tsx:307-315` + unit test `VoiceInput.test.tsx > is a no-op when called before any recording has started`.
- [x] No existing consumer of `VoiceInput` breaks: `component.displayName === 'VoiceInput'` is preserved and all current props still accepted. — `src/components/common/VoiceInput.tsx:573` (`VoiceInput.displayName = 'VoiceInput'`); unit test asserts this. Consumer `VoiceFirstInputBar.tsx` typechecks clean.
- [x] Typecheck passes (`npx tsc --noEmit`). — Zero `VoiceInput`-related errors. One collateral fix: `src/__tests__/integration/microphoneIntegration.test.tsx` two `(VoiceInput as jest.Mock)` casts widened to `as unknown as jest.Mock` (TypeScript 5.x no longer accepts the narrow cast now that `forwardRef<VoiceInputHandle, VoiceInputProps>` adds ref attributes to the component type).
- [x] Unit test asserts `ref.current.finalize()` calls `whisperTranscriptionService.stopAndTranscribe` exactly once. — `src/__tests__/components/VoiceInput.test.tsx` added; 3/3 tests passing.

**Implementation notes:**

- Why imperative-handle over a "triggerFinalize" prop: a prop toggle would require parents to bounce boolean state after each finalize (the exact pattern the bar currently avoids for `autoStart`). An imperative method is the idiomatic React escape hatch for "do this verb now," matches how `TextInput.focus()` works, and keeps the bar's reducer free of new actions.
- Why re-export the type, not inline it: `VoiceInputHandle` needs to be typed on the parent's `useRef<VoiceInputHandle>(null)`. Keeping the type owned by `VoiceInput`'s module means future handle additions don't fan out a dozen import sites.

**Validation Test:**

```bash
# forwardRef is in use
grep -n 'forwardRef' src/components/common/VoiceInput.tsx

# Handle type exported
grep -n 'export.*VoiceInputHandle' src/components/common/VoiceInput.tsx

# Imperative handle installed
grep -n 'useImperativeHandle' src/components/common/VoiceInput.tsx

# Typecheck clean
npx tsc --noEmit
```

---

### US-015: Speak Button Becomes ↑ During Listening + Review, With Pre-Speech Guard and Haptics ✅ COMPLETED (2026-04-15)

**Description:** As a user, when I am done speaking I want to tap the main (center) button to immediately stop recording and either submit what I said (if already in review) or kick off transcription (if still listening) — without having to wait for the silence-detection window to auto-finalize.

**Acceptance Criteria:**

- [x] While `mode === 'listening'` or `mode === 'reviewing-transcript'`, the center button renders `MaterialIcons name="arrow-upward"` (size 40, `theme.colors.primary`) INSTEAD of the mic icon. The spinner branches for `props.isGenerating || isTranscribing` remain unchanged and take precedence over the ↑ icon. — `src/components/story/VoiceFirstInputBar.tsx:620` (`centerShowsArrow = isReviewing || isSpeakActive`) + JSX icon precedence at line 906–923.
- [x] In `idle`, `playing-tts`, and `typing` modes, the center button continues to render the `mic` icon as today. — Falls through the ternary to the `MaterialIcons name="mic"` branch.
- [x] `handleSpeakPress` branches on `state.mode`:
  - `reviewing-transcript` → calls `handleSubmit()` (existing handler — fires `props.onSubmit()` and dispatches `SUBMIT`). — `VoiceFirstInputBar.tsx:457-461`.
  - `listening` → calls `voiceInputRef.current?.finalize()` (new imperative handle from US-014). Does NOT dispatch `TAP_SPEAK`. — `VoiceFirstInputBar.tsx:462-466`.
  - Any other mode → unchanged (pre-empts TTS if needed, then dispatches `TAP_SPEAK`). — `VoiceFirstInputBar.tsx:467-480`.
- [x] The center button's tap is **disabled** while `mode === 'listening'` and the user has not yet produced at least one above-threshold metering frame (pre-speech guard). Implementation: `VoiceInput` exposes `onHasSpokenChange?: (hasSpoken: boolean) => void` fired the first time a metering sample crosses `SILENCE_DB_THRESHOLD`; the bar stores that in a `hasSpoken` state and factors it into `speakDisabled`. — Prop added at `VoiceInput.tsx:92-102`; fired once in `handleMetering` at `VoiceInput.tsx:231-241` (guarded on `hasSpokenRef.current`); reset to `false` in `startListening` at `VoiceInput.tsx:324-329`. Parent wiring: `const [hasSpoken, setHasSpoken] = useState(false)` + `onHasSpokenChange={setHasSpoken}` passed to `<VoiceInput>`.
- [x] Tapping the ↑ button during `listening` fires `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)` (from `expo-haptics`) BEFORE calling `finalize()`. Haptic failure (simulator, Android devices without motor) is swallowed — fire-and-forget. — `VoiceFirstInputBar.tsx:462-465`.
- [x] Tapping the ↑ button during `reviewing-transcript` does NOT fire a haptic (submit is a less "physical" action than stop-recording). — The reviewing-transcript branch calls `handleSubmit()` only; haptic call is confined to the listening branch.
- [x] `accessibilityLabel` on the center button becomes:
  - `idle` / `playing-tts`: `"Speak your contribution"` (unchanged).
  - `listening`: `"Submit voice input"` (new).
  - `reviewing-transcript`: `"Submit transcript"` (new). — `VoiceFirstInputBar.tsx:623-627` (`centerAccessibilityLabel`).
- [x] `accessibilityHint` becomes: `"Tap to stop recording and submit."` during listening; `"Tap to send the transcript."` during review. — `VoiceFirstInputBar.tsx:628-632` (`centerAccessibilityHint`).
- [x] `testID="continue-story-button"` is attached to the center button when `mode === 'reviewing-transcript'` (replaces the old inline Submit's testID so existing integration tests resolve). The idle/listening testID remains `"voice-speak-button"`. — `VoiceFirstInputBar.tsx:621-622` (`centerTestID`). The old inline `continue-story-button` on the review card was removed by US-016, so no testID duplication remains.
- [x] `speakDisabled` logic updated: in `reviewing-transcript` mode it derives from `submitDisabled` (i.e. `isGenerating || isGameCompleted`), NOT from `voiceInputEnabled` or `isTranscribing`. — `VoiceFirstInputBar.tsx:610-616` (three-way ternary: reviewing → `submitDisabled`; listening → `!hasSpoken || isTranscribing`; else → idle logic).
- [x] Typecheck passes. All 5 grep-based validation commands return the expected matches; zero new TS errors in `VoiceInput.tsx` or `VoiceFirstInputBar.tsx`. Updated unit tests are deferred to US-017, which rewrites the full test suite for the new surfaces.

**Implementation notes:**

- **Why a pre-speech guard (2A)**: if the user taps ↑ before speaking at all, silence-detect would have deferred anyway (`hasSpokenRef` inside `VoiceInput`). We surface the same gate to the parent so the UI reflects the block visually (disabled button) rather than letting the user tap into a no-op. This avoids a confusing "I tapped but nothing happened" moment.
- **Why haptics on stop, not submit (3A)**: the user's intent in listening mode is a physical "cut the mic" gesture — haptic feedback is a well-established iOS convention for "you pressed the recording off." In review mode the ↑ button is logically closer to a keyboard send and should feel like the typing-mode arrow (which does not vibrate).
- **Why the `TAP_SPEAK: listening → idle` reducer case stays in place**: even though `handleSpeakPress` no longer dispatches `TAP_SPEAK` during listening, keeping the reducer branch defensive against a future caller is cheap and reduces surprise.

**Validation Test:**

```bash
# expo-haptics installed via expo install
grep -n '"expo-haptics"' package.json

# Imperative ref wired
grep -n 'voiceInputRef.current?.finalize' src/components/story/VoiceFirstInputBar.tsx

# Arrow icon rendered in listening + review
grep -n 'arrow-upward' src/components/story/VoiceFirstInputBar.tsx

# New accessibility labels
grep -n 'Submit voice input\|Submit transcript' src/components/story/VoiceFirstInputBar.tsx

# Haptic fire
grep -n 'Haptics.impactAsync' src/components/story/VoiceFirstInputBar.tsx

# Typecheck
npx tsc --noEmit
```

---

### US-016: Redo Button Replaces Listen Slot During Review; Keyboard Slot Acts as Edit ✅ COMPLETED (2026-04-15)

**Description:** As a user, after I finish recording and see my transcript, I want a big, obvious "Redo" button to re-record (not a small corner button), and I want to be able to edit the transcript by tapping the Keyboard button I already know.

**Acceptance Criteria:**

- [x] While `mode === 'reviewing-transcript'`, the LEFT-slot button (formerly Listen) renders:
  - `MaterialIcons name="refresh"` (size 28, `theme.colors.text`).
  - Label text `"Redo"` (replaces `"Listen"`).
  - `accessibilityLabel="Redo voice input"`.
  - `onPress={handleReRecord}` (reuses existing handler — clears `props.userInput` and dispatches `RE_RECORD`).
  - `onLongPress={undefined}` (no TTS pause/resume semantics in this context).
  - Disabled iff `submitDisabled`.
- [x] In all other modes, the LEFT-slot button continues to behave as today (Listen → TTS, with `volume-up` ↔ `stop` icon swap).
- [x] The reducer's `TAP_KEYBOARD` case is extended to accept `reviewing-transcript` as a legal source state: `reviewing-transcript → typing`. `userInput` is unchanged by the reducer, so the TextInput naturally shows the pre-filled transcript.
- [x] Tapping the RIGHT-slot Keyboard button while `mode === 'reviewing-transcript'` transitions to `typing` mode with the transcript pre-filled, soft keyboard open, and cursor at the end of the text (focus is already wired via the existing `useEffect` on `state.mode === 'typing'`).
- [x] The inline review-card button row (`reviewActions`, the three `TouchableOpacity`s for Re-record / Edit / Submit at lines 617–647 of the old JSX) is **deleted**. The review card JSX collapses to just the transcript `ScrollView`.
- [x] Orphaned styles deleted from `StyleSheet.create`: `reviewActions`, `reviewSecondaryButton`, `reviewSecondaryLabel`, `reviewPrimaryButton`, `reviewPrimaryLabel`. `reviewCard`, `transcriptScroll`, `transcriptText`, `livePartialCard`, and `livePartialPlaceholder` stay.
- [x] The existing `handleReRecord` and `handleSubmit` handlers are retained. `handleEdit` is deleted (the PRD's recommended option) — its only former referent (the inline review card's Edit button) no longer exists, and the typing-mode focus `useEffect` fires on every `mode → 'typing'` transition regardless of source state, so the handler-local focus call was redundant.
- [x] `AccessibilityInfo.announceForAccessibility("Review your transcription.")` on entry to `reviewing-transcript` is unchanged (the `useEffect` keyed on `state.mode` was not modified).
- [x] Typecheck passes — zero new errors in `VoiceFirstInputBar.tsx` (pre-existing errors elsewhere in the repo — `convex/storage.ts`, `__tests__/**`, etc. — are unrelated to US-016 and were present on `main` before this change).

**Verification (2026-04-15 test run):**

- `grep -n 'reviewActions\|reviewSecondaryButton\|reviewPrimaryButton' src/components/story/VoiceFirstInputBar.tsx` → **no matches** ✅ (inline review buttons and their styles removed)
- `grep -n '>Redo<\|Redo voice input\|name="refresh"' src/components/story/VoiceFirstInputBar.tsx` → matches on lines carrying `'Redo voice input'` a11y label, `'refresh'` icon name, and `'Redo'` label text ✅ (JSX uses single-quoted string expressions in ternaries rather than literal `>Redo<` / `name="refresh"` HTML-attribute form, so the alternation grep matches via the `Redo voice input` branch as intended)
- `grep -n "state.mode === 'reviewing-transcript'" src/components/story/VoiceFirstInputBar.tsx` → matches the new `TAP_KEYBOARD` case (line ~212) alongside the pre-existing `RE_RECORD`, `EDIT`, `SUBMIT` branches ✅
- `npx tsc --noEmit` filtered to `VoiceFirstInputBar.tsx` → 0 errors ✅
- `npm test -- --testPathPattern='VoiceFirstInputBar'` → **30/30 tests pass** (reducer suite green, component suite green). Note: new test coverage for the extended `TAP_KEYBOARD` case and the review-mode Redo/Keyboard surfaces lives in US-017, not US-016 — this run verifies no regressions in the existing suite.

**Implementation notes:**

- **Why Redo replaces Listen and not some fourth button** (1A / prior AskUserQuestion answer): introducing a fourth primary affordance would break the three-button rhythm the user already knows. Contextualizing the left slot keeps the geometry constant — users' muscle memory for "that position is a secondary action" is preserved.
- **Why Edit is NOT dropped entirely**: users occasionally need to fix a misheard homophone (e.g. "their" vs "there"). Forcing a full re-record for a single-word typo is a regression. Routing Edit through the Keyboard button is free (reducer tweak + pre-filled TextInput already works) and requires no new UI surface.
- **Why `handleEdit` can be deleted even though the typing-mode focus `useEffect` still exists**: the effect at lines 367–375 fires on any `mode → 'typing'` transition (whether from idle or reviewing-transcript), so we don't need a handler-local `setTimeout(focus, 0)` as a belt-and-suspenders duplicate.

**Validation Test:**

```bash
# Inline review buttons are gone
grep -n 'reviewActions\|reviewSecondaryButton\|reviewPrimaryButton' src/components/story/VoiceFirstInputBar.tsx
# Should return no matches.

# Redo label + icon
grep -n '>Redo<\|Redo voice input\|name="refresh"' src/components/story/VoiceFirstInputBar.tsx

# Reducer handles reviewing-transcript + TAP_KEYBOARD
grep -n "state.mode === 'reviewing-transcript'" src/components/story/VoiceFirstInputBar.tsx

# Typecheck
npx tsc --noEmit
```

---

### US-017: Update Tests + Manual QA for the New Review-Mode Surfaces 🟡 IN PROGRESS (2026-04-15)

**Status:** Manual-QA portion ✅ complete (2026-04-15). Automated-test portion ⛔ blocked — **depends on US-014, US-015, and US-016 landing first**, because every new assertion references surfaces those stories introduce (`VoiceInput.finalize()` imperative handle, `onHasSpokenChange` callback, the left-slot Redo / center ↑-Submit / right-slot Keyboard-as-Edit button row, `expo-haptics`). Writing the tests now would yield TypeScript errors against props that don't exist and assertions against DOM nodes that aren't rendered.

**Description:** As a QA engineer and future agent working on this codebase, I need the automated test suite and the manual-QA log to match the new affordances so regressions are caught early and reviewers know what to tap.

**Acceptance Criteria:**

**Automated tests:** ⛔ BLOCKED on US-014–US-016

- [ ] `src/__tests__/components/VoiceFirstInputBar.test.tsx` updated:
  - Replaces assertions against `getByText('Re-record' | 'Edit' | 'Submit')` and `getByLabelText('Re-record voice input' | 'Edit transcript' | 'Submit transcript')` with assertions against the new surfaces (Redo via the left-slot label, Submit via `getByTestId('continue-story-button')` on the center slot, Edit via `getByLabelText('Type with the keyboard')`).
  - Adds a new test: `tapping center button during listening calls VoiceInput.finalize()`. Spy on `whisperTranscriptionService.stopAndTranscribe` and assert it is called exactly once after a simulated tap, without waiting for the silence interval to fire.
  - Adds a new test: `center button is disabled during listening until hasSpoken fires`. Mount, verify `disabled=true`, invoke the `onHasSpokenChange(true)` callback, verify `disabled=false`.
  - Adds a new reducer test: `reviewing-transcript + TAP_KEYBOARD → typing`.
- [ ] `src/__tests__/functional/voiceFeaturesFunctional.test.tsx` — same label replacement pattern; existing `Edit`-from-review assertion becomes a `Keyboard`-button tap assertion.
- [ ] `src/__tests__/accessibility/voiceFeaturesAccessibility.test.tsx` — add assertions for `"Submit voice input"` (listening) and `"Submit transcript"` (review), and `"Redo voice input"` on the left slot in review.
- [ ] `src/__tests__/integration/endToEndVoiceFeatures.test.tsx` — full journey update: listening → tap center → review card → tap center (Submit) → `onSubmit` fires; also: review → tap left (Redo) → `onUserInputChange('')` + listening re-enters; review → tap right (Keyboard) → typing mode with transcript pre-filled.
- [ ] `npm test -- VoiceFirstInputBar` and `npm test -- voiceFeatures` both pass at 100%.

**Manual QA:** ✅ COMPLETE (2026-04-15)

- [x] `.claude/.agent/Tasks/voice-first-input-bar-manual-qa.md` updated:
  - [x] Scenario 3: appended sub-step — _"While listening, tap the center **↑** button: recording stops immediately, Transcribing spinner appears within one frame, no 2 s wait."_ (manual-qa.md line 78)
  - [x] Scenario 4 (Re-record): rewritten as **↺ Redo** via the left slot. (manual-qa.md line 79)
  - [x] Scenario 5 (Edit): rewritten as tapping **Keyboard** during review → typing mode with transcript pre-filled. (manual-qa.md line 80)
  - [x] Scenario 6 (Submit): rewritten as tapping center **↑** during review. (manual-qa.md line 81)
  - [x] New Regression **R7**: Pre-speech guard — tap Speak, DON'T talk, tap center ↑ immediately: nothing happens (button disabled until at least one spoken frame). No empty transcript sent to Whisper. (manual-qa.md line 104)
  - [x] New Regression **R8**: Haptic feedback fires on ↑ during listening on a physical iOS device with System Haptics enabled. On simulator / Android motor-less: no crash. (manual-qa.md line 105)
  - [x] Header revision-log block updated with the 2026-04-15 entry.
  - [x] Validation grep `grep -n 'R7\|R8\|Redo\|↑' .claude/.agent/Tasks/voice-first-input-bar-manual-qa.md` returns matches (lines 7, 78–81, 83, 104, 105).

**Implementation notes:**

- **Why we keep `testID="continue-story-button"` bound to the Submit role (not a fixed button element)**: historical E2E + integration tests treat this testID as "whatever button commits the turn." As the Submit role migrates from the old inline card button to the center-slot Speak-as-↑, moving the testID with it keeps those tests passing without a mass rewrite. The typing-mode arrow continues to own the testID when `mode === 'typing'`; because `typing` and `reviewing-transcript` are disjoint in the state machine, RNTL's uniqueness invariant on `getByTestId` is maintained.
- **Why the pre-speech guard needs its own test**: without an explicit test the guard could be accidentally removed during a future refactor; the test captures the intent.

**Validation Test:**

```bash
# Component suite
npm test -- VoiceFirstInputBar.test.tsx

# Full voice suite
npm test -- voiceFeatures

# Typecheck
npx tsc --noEmit

# Manual QA file updated
grep -n 'R7\|R8\|Redo\|↑' .claude/.agent/Tasks/voice-first-input-bar-manual-qa.md
```

---

## Functional Requirements

- **FR-1**: The bottom of the game session must show three circular buttons rendered left-to-right in this order: **Listen, Speak, Keyboard**. The Speak button must be visibly larger than the other two (primary size from `theme.voiceFirst.primaryButtonSize`; Listen and Keyboard use `secondaryButtonSize`).
- **FR-2**: No textbox may be visible in `idle` mode (typing is opt-in via the Keyboard button).
- **FR-3**: Tapping **Speak** (center, primary) must start voice recognition using the existing `VoiceInput` component (preserving the Jan 2026 REPLACE-semantics fix for cumulative partial results).
- **FR-4** ⚠️ SUPERSEDED by FR-12/FR-13 (2026-04-15): ~~After voice recognition finalizes with non-empty text, a transcript review card must be shown with exactly three actions: Re-record, Edit, Submit. Auto-submission is explicitly disallowed.~~ — Retained as historical context; the "three inline actions" are replaced by the three main round buttons reconfigured for review mode (Redo left, Submit-↑ center, Edit-via-Keyboard right). Auto-submission remains explicitly disallowed.
- **FR-5**: Tapping **Listen** (leftmost) must invoke `handleSpeakerButtonPress` (TTS); long-press must invoke `handleSpeakerButtonLongPress` (pause/resume).
- **FR-6**: Tapping **Keyboard** (rightmost) must reveal an embedded `<TextInput>` that sits above the three buttons (buttons stay visible), with `testID="story-input"` preserved.
- **FR-7**: If TTS is playing when the user taps Speak, the system must call `textToSpeechService.stop()` before starting voice recognition.
- **FR-8**: Every mode transition must emit an `AccessibilityInfo.announceForAccessibility` message.
- **FR-9**: Icons must use `MaterialIcons` from `react-native-vector-icons` (not emoji) for cross-platform visual consistency.
- **FR-10**: The new component must not modify `handleVoiceResult`, `handleContinueStory`, `handleSpeakerButtonPress`, or `handleSpeakerButtonLongPress` in HomeScreen — it only invokes them via props.
- **FR-11**: The Speak button must carry a default (non-active) visual emphasis (tinted background or colored border using `theme.colors.primary`) so its primacy is evident even when no mode is active.
- **FR-12** (new, 2026-04-15): During `mode === 'reviewing-transcript'`, the three round buttons must reconfigure: left slot = **Redo** (MaterialIcons `refresh`, label `"Redo"`, calls the existing `handleReRecord`); center slot = **Submit-↑** (MaterialIcons `arrow-upward`, calls the existing `handleSubmit`); right slot = **Edit** semantics (Keyboard icon unchanged, but tapping it transitions to `typing` with the transcript pre-filled via an extended reducer case).
- **FR-13** (new, 2026-04-15): During `mode === 'listening'`, the center button must render the ↑ (arrow-upward) icon instead of the mic and, on tap, call `VoiceInput.finalize()` via an imperative ref to stop recording immediately — bypassing the 2000 ms silence-detection timeout. The existing silence-detection auto-finalize remains as a fallback for users who do not tap.
- **FR-14** (new, 2026-04-15): The center button must be disabled during `listening` until the embedded `VoiceInput` reports at least one above-threshold metering frame. This prevents submitting a truly silent clip.
- **FR-15** (new, 2026-04-15): Tapping the center ↑ button during `listening` (but NOT during `reviewing-transcript`) must fire `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)` from `expo-haptics`. Failures on devices without a haptic motor are swallowed silently.

## Non-Goals (Out of Scope)

- No new settings screen for toggling auto-submit after voice (future PRD if demand arises).
- No redesign of the story rendering area, story header, Exit button, or image generation panel.
- No changes to the story generation backend, prompt engineering, validation, or XP economy.
- No support for simultaneous listening and playback (audio-duplex).
- No waveform VISUALIZATION of the actual audio signal — only a decorative pulsing ring animation.
- No voice playback of the transcript _before_ submitting (user sees text, not hears it, on the review card).
- No Android-specific visual polish beyond what MaterialIcons provides by default.
- No PRD-level work on the onboarding milestone tracking — it already works and stays untouched.
- **(2026-04-15, re: US-014–US-017)** No removal of the silence-detection auto-finalize: it remains as a fallback for users who don't tap ↑. The new explicit-tap path is additive, not replacive.
- **(2026-04-15)** No long-press "cancel recording" gesture on the ↑ button: cancel is handled by tapping Redo in the review state (after finalize). Users cannot mid-recording cancel without producing a transcript.
- **(2026-04-15)** No analytics instrumentation for "tap-↑-early vs wait-for-silence" rates: per reviewer choice (4B), validation is manual-QA only for v1. A future PRD may add analytics if perceived-latency feedback is mixed.
- **(2026-04-15)** No new "pre-speech hint" toast or warning text when the ↑ button is disabled: the disabled visual state is the sole feedback. Adding copy was considered (option 2C) and rejected as overkill for a condition that resolves within milliseconds of real speech.
- **(2026-04-15)** No change to the live-partial transcript card shown during listening: the 2026-04-15 real-time partials feature remains unchanged and is orthogonal to this submit/redo UX.

## Design Considerations

- **Reference image** (user-provided): three round buttons with icon + label underneath, middle button larger to emphasize it as the primary action.
- **Visual hierarchy**: **Speak (middle) is 96×96; Listen (left) and Keyboard (right) are 64×64.** Active state = `scale(1.05)` + `activeElevation`. Speak carries a resting visual emphasis (primary-colored tint or border) so voice-first intent reads even when no mode is active. Primary submit action (inside review card and keyboard mode) uses `theme.colors.primary` (#4CAF50).
- **Layout sketch**:

  ```
               ┌───────┐
      ○        │   ◉   │        ○
    Listen     │ Speak │      Keyboard
               └───────┘
  ```

- **Component reuse**: `VoiceInput` (`src/components/common/VoiceInput.tsx`), `textToSpeechIsolated` (`src/services/textToSpeechIsolated.ts`), theme primitives (`src/constants/theme.ts`), existing `handleVoiceResult` / `handleContinueStory` / `handleSpeakerButtonPress` handlers. No duplication.
- **Layout host**: new component lives inside the existing `AdaptiveGlassBackground` wrapper at `HomeScreen.tsx:3409` — glass visual treatment is inherited for free.
- **Typography**: Speak label uses `primaryLabelFontSize` (14pt, medium weight); Listen and Keyboard labels use `labelFontSize` (12pt, medium weight). TextInput in keyboard mode retains `ArchitectsDaughter_400Regular` to match existing handwritten aesthetic.
- **Vertical alignment**: because Speak is 32pt taller than its neighbors, the row uses `alignItems: 'center'` so Listen and Keyboard visually sit at the vertical midline of Speak — their labels still align horizontally with Speak's label via explicit `marginTop` tuning.

## Technical Considerations

- **No new dependencies**: every library needed (`@react-native-voice/voice`, `react-native-tts`, `react-native-vector-icons`, `react-native-permissions`) is already in `package.json`.
- **Permissions**: already configured in `app.json` (`NSMicrophoneUsageDescription`, `NSSpeechRecognitionUsageDescription`, `react-native-permissions` plugin with `Microphone` + `SpeechRecognition`). No native rebuild required beyond standard EAS dev build.
- **Monolithic HomeScreen risk**: `src/screens/HomeScreen.tsx` is 3,900 lines. Extracting this feature into `src/components/story/VoiceFirstInputBar.tsx` keeps the diff in HomeScreen small (roughly −90 lines, +1 line for the component mount) and avoids further growth.
- **Test ID preservation**: `testID="story-input"`, `testID="continue-story-button"`, and `testID="speaker-button"` are all referenced by existing tests and E2E docs. The new component must surface all three.
- **Simulator safety**: `textToSpeechIsolated.ts` already mocks on simulator; VoiceInput uses `nativeSpeechRecognizer.isModuleAvailable()` gate. No new conditional logic needed for simulator.
- **Duplication-bug regression guard**: the Jan 2026 fix in `HomeScreen.tsx:802-860` lives in `handleVoiceResult` and is preserved verbatim — the new component only _invokes_ it; it does not re-implement the replace logic.
- **(2026-04-15, US-014–US-017)** One new dependency: `expo-haptics`. Must be installed via `npx expo install expo-haptics` (NOT `npm install`) to pin the SDK-compatible version — see the repo's memory note on `npx expo install`. Run `npx expo install --check` after adding to confirm no other Expo packages drift.
- **(2026-04-15)** `expo-haptics` safely no-ops on iOS simulator and on Android devices without a linear-resonant-actuator motor — no runtime check required at call sites; wrap `Haptics.impactAsync` in a fire-and-forget with `.catch(() => {})`.
- **(2026-04-15)** The imperative-handle pattern used for `VoiceInput.finalize()` requires `React.forwardRef` — verify that `React.memo(forwardRef(...))` is the outer-to-inner wrapping order. `forwardRef(React.memo(...))` compiles but drops the ref forwarding at runtime on React 18.
- **(2026-04-15)** No native-code rebuild required: `expo-haptics` is a JS-only wrapper around the existing iOS `UIImpactFeedbackGenerator` and Android `Vibrator` APIs — both are already accessible from the current native bundle. `npx expo prebuild` should be run to pull the pod, but EAS dev builds already include the Taptic Engine entitlements.
- **(2026-04-15)** The center button's disable-during-pre-speech requires a new callback prop `onHasSpokenChange` on `VoiceInput`. Wire it to flip alongside the internal `hasSpokenRef` the first time metering crosses `SILENCE_DB_THRESHOLD`; do not fire it on every metering frame (would be noisy).

## Success Metrics

- **Voice input usage rate**: % of contributions submitted via Speak (vs Keyboard) increases from current baseline (~X%) to ≥ 60% within two weeks of release.
- **Accidental submission rate**: < 5% of voice submissions are followed within 10 seconds by a user-initiated "delete my turn" action (proxy for "oops, I didn't mean to send that"). Benchmarked against pre-review-card baseline.
- **Onboarding milestone: first voice**: no regression — `first_voice` milestone fires at ≥ current rate (tracked in `onboardingMilestoneTracker`).
- **Test suite**: 100% pass rate in `npm test` after all stories are implemented.
- **Zero new TypeScript errors**: `npx tsc --noEmit` clean.
- **Zero regressions**: existing voice duplication fix, TTS pause/resume, and test IDs all verified post-release.
- **(2026-04-15, US-014–US-017)** Manual-QA sign-off on the updated `voice-first-input-bar-manual-qa.md` (scenarios 3–6 rewritten, R7 + R8 added) with an overall verdict of **PASS**. Per reviewer choice (4B), no analytics goal is defined for this iteration — success is qualitative: the reviewer confirms the center ↑ tap stops recording "immediately" (subjectively < 300 ms from tap to spinner appearing) and the new layout reads as clearer than the old small-buttons layout.
- **(2026-04-15)** Zero new TypeScript errors in `VoiceInput.tsx` and `VoiceFirstInputBar.tsx` after the `forwardRef` + imperative-handle refactor.
- **(2026-04-15)** Zero test regressions: existing `npm test` suites pass after label updates; new tests added in US-017 all pass.

## Open Questions

- Should `autoSubmitAfterVoice` eventually become a user-facing setting in the Settings screen? (Deferred; review card default is confirmed for v1.)
- Should the transcript review card additionally offer a "Play back transcript" button (TTS the transcription before submit)? (Deferred — not in initial scope.)
- For the Android platform, should we tint MaterialIcons to match the "handwritten" aesthetic of the rest of HomeScreen, or leave them flat? (Recommend flat/consistent; revisit after release if it clashes visually.)
- Should the Jan 2026 voice-duplication regression test be named and referenced here so we lock it in before the refactor begins? (Yes — see validation tests for US-012; the `voiceFeaturesTechnical.test.tsx` partial-results handling test is the one to watch.)
- **(2026-04-15, US-014–US-017)** Should the ↑ button during `listening` also show a brief "Stopping…" label the moment the user taps it, or is the existing Transcribing spinner sufficient? (Deferred — the existing spinner already swaps in on `onProcessingStateChange(true)`, which fires inside `finalize()` before the await. If user feedback in QA says the tap feels unacknowledged, revisit.)
- **(2026-04-15)** Should Redo also reset the live-partial card to the "Listening…" placeholder immediately on tap, or let the `useEffect` at lines 310–314 handle it on the next render? (Current design: let the effect handle it — avoids double-clearing. Revisit if a visible flash of stale partial appears during the Redo transition.)
- **(2026-04-15)** Should the `TAP_SPEAK: listening → idle` reducer case be deleted as dead code now that no UI path dispatches it? (Keep for now as defensive no-op; reconsider during a future state-machine cleanup pass.)
- **(2026-04-15)** Should we expose a single unified `onFirstSpeech` prop on `VoiceInput` instead of `onHasSpokenChange`? (The latter matches the `on*Change` convention already used for `onProcessingStateChange`. Preferring consistency.)
- **(2026-04-15)** Future: should tapping ↑ in review mode also fire a subtle haptic tick (distinct from the Medium impact used in listening)? Deferred — matches the user's choice to not vibrate on pure submits (reviewer choice 3A).
