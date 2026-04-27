# PRD: Storybook/Paper UI-UX Refresh

## 1. Introduction / Overview

CreativeBridge is being visually re-skinned with a warm, handmade "storybook" aesthetic that reinforces the product's core promise: collaborative storytelling with a kind AI. The current palette (clinical green `#4CAF50` on white `#fcfcfc`) reads as generic productivity-app; the new system — aged-paper backgrounds, ink-brown text, foxglove-red accents, Fraunces serif display, Caveat handwriting accents, watercolor illustrations, and wax-seal gamification motifs — turns the canvas itself into a prop that supports the narrative.

Source of truth is the user-generated design zip unpacked at `/tmp/cb_design/` (HTML + JSX mockups + 20 watercolor assets + `styles.css` tokens). The plan behind this PRD is at `/Users/hcho/.claude/plans/i-made-few-ui-ux-velvety-castle.md`.

**This is a presentation-layer refresh. Zero service, context, navigation-key, data-contract, or backend changes.** Every user-visible behavior must remain byte-for-byte identical after the redesign.

## 2. Goals

- Replace the app's visual language with the storybook/paper design system across every user-facing screen.
- Preserve 100% of existing behavior (auth flow, voice-first input, story generation, COPPA flow, analytics, download/share).
- Ship as a **hard cutover** — no feature flag, no per-user opt-in, no dual-codepaths. Each stage merges straight to `main` after verification.
- Maintain TypeScript, ESLint, and test suite health at every stage.
- Preserve visual fidelity on both iPad (primary) and iPhone (secondary) simulators.

## 3. User Stories

The work ships in **7 staged user stories** (matching the plan's 7 stages). Each stage is independently verifiable on iPad + iPhone simulators and must pass its verification block before the next story begins.

---

### US-001: Theme foundation + font loading

**Description:** As a developer, I want the design tokens (paper palette, ink hierarchy, accent colors, new fonts, new shadows) available in `theme.ts` and loaded by the app so downstream screens can consume them without re-importing from raw hex.

**Acceptance Criteria:**

- [x] `src/constants/theme.ts` extended with additive `colors.paper`, `colors.ink`, `colors.accents` (plural — see note), `typography.fontFamily`, and new `shadows.paper | card | lift` tokens — no existing token renamed or removed.
  - Note: The existing top-level `colors.accent: '#4CAF50'` string was kept untouched (zero current consumers but counted as an "existing token" under FR-12). New storybook accents live under `colors.accents` (plural) to avoid structural rename. Downstream stories should consume `theme.colors.accents.foxglove`, etc.
- [x] `App.tsx` `useFonts` loader now loads `Fraunces_400Regular`, `Fraunces_700Bold`, `Fraunces_700Bold_Italic`, `Caveat_400Regular`, `Caveat_700Bold`, `Inter_400Regular`, `Inter_500Medium`, `Inter_600SemiBold`, `Inter_700Bold` in addition to existing `KaushanScript_400Regular` and `ArchitectsDaughter_400Regular`.
- [x] Packages installed via `npx expo install @expo-google-fonts/fraunces @expo-google-fonts/caveat @expo-google-fonts/inter` (per `feedback_expo_install.md` — never `npm install expo-*`).
- [x] `npx expo install --check` reports zero SDK-incompatible packages ("Dependencies are up to date").
- [x] `npm run lint` passes (warnings OK, no new errors). Baseline diff confirms identical error set before vs. after changes (16 errors pre-existing, 0 introduced).
- [x] TypeScript compile (`npx tsc --noEmit`) — no new errors introduced. Baseline diff confirms identical error set (2855 pre-existing error lines, 0 new). Pre-existing errors live in unrelated files (userPreferences, asyncStorageWrapper, filePicker, etc.) and are out of scope for US-001.

**Verification test (post-implementation):**

1. Run `npm start` and boot both iPad and iPhone simulators (`npm run ios` with each device selected).
2. Observe that **existing screens render visually unchanged** — if any screen looks different, a non-additive change crept in and must be reverted.
3. Open React Native debugger → confirm `Fraunces`, `Caveat`, and `Inter` appear in the loaded-font list with no warnings.
4. Intentionally render `<Text style={{fontFamily: 'Fraunces_700Bold_Italic'}}>Test</Text>` on a scratch screen → renders in serif italic, not the system fallback.
5. Revert the scratch screen.

---

### US-002: Shared storybook component primitives

**Description:** As a developer, I want a new `src/components/common/storybook/` directory of reusable primitives so every restyled screen consumes the same `PaperBackground`, `InkButton`, `Watercolor`, `WaxSeal`, `OrnamentRule`, `Stepper`, and icon set.

**Acceptance Criteria:**

- [x] Directory `src/components/common/storybook/` created with: `PaperBackground.tsx`, `InkButton.tsx`, `Watercolor.tsx`, `WaxSeal.tsx`, `OrnamentRule.tsx`, `Stepper.tsx`, `QuillIcon.tsx`, `BookIcon.tsx`, `FlameIcon.tsx`, `StarIcon.tsx`, and `index.ts` barrel.
- [x] `InkButton` supports variants `primary | foxglove | moss | ghost | paper` with pressed-state `translateY(1)`.
- [x] `Watercolor` accepts `hue`, `size`, `soft?`, `children` (emoji string) and `imageSource?` (`ImageSourcePropType` for local `require()` assets or remote URIs). RN's built-in `<Image>` is used for raster rendering because `OptimizedImage`/`react-native-fast-image` doesn't accept `require(...)` number sources directly. OKLCH gradient colors are approximated as HSL (minor visual deviation — documented inline).
- [x] `WaxSeal` renders a circular radial-gradient (via `react-native-svg` `<RadialGradient>`) with a Fraunces-italic letter inside. CSS `inset` shadows (unsupported in RN) are replaced with top-highlight and bottom-shadow ellipse overlays.
- [x] `Stepper` takes `step: number` and `steps: string[]`, rendering the 4-step visual from `/tmp/cb_design/components/screens-flow.jsx:6-49`.
- [x] All icon primitives ported via `react-native-svg` 15.12.1 (installed via `npx expo install react-native-svg` per `feedback_expo_install.md`).
- [x] Every primitive exports a TypeScript interface for its props (`InkButtonProps`, `WatercolorProps`, `WaxSealProps`, `StepperProps`, `OrnamentRuleProps`, `PaperBackgroundProps`, `QuillIconProps`, `BookIconProps`, `FlameIconProps`, `StarIconProps`). `InkButtonVariant` is also exported as a union type.
- [x] No existing component under `src/components/` modified or removed. Verified via `git status` — only new files under `src/components/common/storybook/` plus `package.json` / `package-lock.json` dependency pins.
- [x] `npm run lint` and `npx tsc --noEmit` pass. Baseline-diffed (storybook dir moved aside, re-run, compared): identical error sets before and after. Zero new errors introduced.
  - Deviations from design source (accepted per PRD §9 defaults):
    1. **`feTurbulence` + `feDisplacementMap` SVG filters dropped** — `react-native-svg` can't render them efficiently. Watercolor and PaperBackground get "cleaner" rendering without the organic paint-texture distortion.
    2. **OKLCH → HSL color approximation** — RN StyleSheet doesn't support `oklch()` color syntax. Watercolor's gradient stops use HSL values tuned to visually match the source OKLCH lightness/chroma targets.
    3. **CSS `inset` box-shadows rebuilt as SVG ellipse overlays** — RN's `shadowColor/Offset` only casts outside the view. WaxSeal's 3D wax-pooling effect is approximated with top-highlight and bottom-shadow ellipses inside the SVG.

**Verification test (post-implementation):**

1. Create a temporary screen `src/screens/StorybookGallery.tsx` that renders every primitive in a vertical list (each InkButton variant, Watercolor with emoji and with local asset, WaxSeal at sizes 32/44/56, all four icons at sizes 18/24/36, a 4-step Stepper at step index 0/1/2/3, an OrnamentRule).
2. Temporarily register the gallery as a dev-only route in `AppNavigator.tsx` (guard behind `__DEV__`).
3. On iPad simulator: every primitive renders without a crash, no red-box, no missing-font warnings.
4. On iPhone simulator: same — no layout overflow, no clipped SVGs.
5. Verify watercolor radial gradient and wax-seal inner shadow approximate the design preview closely enough (side-by-side with `/tmp/cb_design/preview.png` / the JSX mockups).
6. Delete the gallery screen and its route registration before the story is marked done.

---

### US-003: Storybook raster assets

**Description:** As a developer, I want the 20 design asset PNGs copied into `src/assets/storybook/` so the creation wizard and voice dock can render them via Watercolor/OptimizedImage.

**Acceptance Criteria:**

- [x] Directory `src/assets/storybook/` created.
- [x] All 20 files copied from `/tmp/cb_design/assets/`: `animal.png, beach.png, boy.png, castle.png, comedy.png, custom-char.png, fairytale.png, fantasy.png, fiction.png, forest.png, girl.png, keyboard.png, megaphone.png, mic.png, mystery-box.png, quill.png, space.png, speaker.png, suspense.png, wizard.png`. Total on-disk size: ~17 MB.
- [x] `src/assets/storybook/index.ts` re-exports each as a typed `ImageSourcePropType` (cast from `require(...)`) for type-safe imports. Also exports a grouped `storybookAssets` object for iteration and a `StorybookAssetName` union type. Two hyphenated filenames are exposed under camelCased identifiers (`custom-char.png` → `customChar`, `mystery-box.png` → `mysteryBox`); on-disk filenames unchanged so Metro resolves them verbatim.
- [x] No pre-existing asset file overwritten. `src/assets/` did not exist before this story — no name clash was possible. Verified via `ls` before copy.
- [x] Static resolution check: every `require('./X.png')` path in the barrel exactly matches a file on disk (20/20 match, zero orphans, zero typos).
- [ ] Metro bundler resolves each asset without warnings (`npm start` cold-start clean) — **this is a runtime check and is part of the manual simulator verification below.**
- [x] `npx tsc --noEmit` passes. Baseline-diffed (dir moved aside, re-run, compared): identical error sets. 2855 pre-existing errors, 0 new.
- [x] `npm run lint` passes. Baseline-diffed: identical error sets. 15 pre-existing errors, 0 new.

**Verification test (post-implementation):**

1. In the Storybook Gallery scratch screen (temporarily re-added from US-002), render each of the 20 assets inside a `Watercolor` at `size={72}`.
2. iPad simulator: every asset displays without placeholder, no transparent flicker.
3. iPhone simulator: same check at smaller viewport.
4. Inspect `watchman` / Metro logs → no "module not found" warnings.
5. Remove the gallery screen again.

---

### US-004: Tab bar + AuthScreen restyle

**Description:** As a user, I want the tab bar and login screen to reflect the new storybook aesthetic so my first impression and primary navigation match the design language.

**Acceptance Criteria:**

- [x] `src/navigation/AppNavigator.tsx` tab labels changed to "Library" / "Workshop" / "Author" via `tabBarLabel` — **route keys `HomeStack`, `SettingsStack`, `Profile` unchanged**, and `TabParamList` TypeScript type unchanged.
- [x] Tab bar active-state indicator: 3×36 foxglove pill above the icon (rendered as an absolute-positioned sibling inside the custom `tabBarIcon` since `@react-navigation/bottom-tabs` has no `tabBarIndicator` API); active tint `theme.colors.accents.foxglove` (`#C2410C`), inactive tint `theme.colors.ink.faint` (`#8A7256`).
- [x] Tab icons: `BookIcon` (Library), ⚙ emoji (Workshop), `QuillIcon` (Author) — all from the storybook primitives.
- [x] `theme.glass.surfaces.tabBar.androidFallbackColor` updated to `rgba(251, 245, 230, 0.96)`; `AdaptiveGlassBackground` wrapper preserved.
- [x] `src/screens/AuthScreen.tsx` primary login/signup surface restyled to match `/tmp/cb_design/components/screens-core.jsx:6-105`. Sub-flow screens (migration new-password, 2FA, email verification, forgot-password, reset-code) kept visually intact — out of US-004 scope:
  - [x] Wrapped in `<PaperBackground>` (via `StyleSheet.absoluteFillObject` backdrop so the ScrollView scrolls over stable paper).
  - [x] Four corner `<Watercolor soft>` decorations (📜 hue 30 size 90, ✒️ hue 60 size 70, 🌿 hue 140 size 80, 🕯️ hue 340 size 90) with opacities 0.35/0.3/0.3/0.35, `pointerEvents="none"` so they don't block form taps.
  - [x] Kaushan Script logo at 78px (capped to `titleFontSize` for narrow viewports) with foxglove "Bridge" via nested `<Text>` accent span.
  - [x] `<OrnamentRule width={180}/>` and Caveat 26px tagline "Where your best stories begin".
  - [x] Google and Apple sign-in buttons reused verbatim — only surrounding chrome restyled.
  - [x] Email + password inputs: `theme.colors.paper.card` background, 1.5px `paper.edge` border, 12 radius, 16/14 padding, Inter 16px, ink-base text color.
  - [x] Primary CTA: `<InkButton variant="moss" icon={<QuillIcon/>}>Sign in and write</InkButton>` wired to the existing `handleAuth` handler; disabled logic (`loading || emailValidating || invalid email`) preserved; migration/loading/signup label states preserved.
  - [x] "Begin your story →" foxglove link wired to the existing `toggleAuthMode` handler (shown when `isLogin`; flips to "Sign In" when `!isLogin`).
- [x] **No change to `AuthContext`, Clerk config, Convex OAuth handoff, or COPPA age-gate routing.** All handlers, state variables, validation effects, and sub-flow early-returns are byte-for-byte unchanged.
- [x] `npm run lint` passes. Baseline-diffed (stashed changes, re-ran, compared): identical problem counts — 16 errors / 749 warnings before and after. Zero new errors, zero new warnings.
- [x] `npx tsc --noEmit` passes. Baseline-diffed: 2039 pre-existing error lines before and after; the only diff is a pre-existing `RegisteredStyle<AbsoluteFillStyle>` error in `AppNavigator.tsx` shifted from line 91 → 95 because the storybook-primitive imports pushed the file down. Zero new errors.

**Verification test (post-implementation):**

1. **iPad simulator golden path:**
   - Cold launch → AuthScreen renders with paper background, Kaushan logo, four watercolor corners.
   - Tap "Continue with Google" → OAuth sheet appears → complete flow → land on age-gate or Home (whichever the existing flow dictates).
   - Sign out → return to AuthScreen.
   - Tap "Continue with Apple" → OAuth → home.
   - Sign out.
   - Enter email + password → tap `Sign in and write` → home or profile-completion (existing behavior).
2. **iPhone simulator:** repeat all three auth paths; confirm no layout overflow, corner watercolors visible without clipping.
3. Bottom tab bar on Home: confirm "Library / Workshop / Author" labels, 3px foxglove pill over the active tab, smooth tap-to-switch with no flicker.
4. Delete app, re-install, go through age-gate → parent-consent (if under 13) → confirm those screens still reach and still function even though they're unstyled in this stage.
5. `npm test -- AuthScreen` if a spec exists → passes.

---

### US-005: HomeScreen idle hero + creation wizard restyle

**Description:** As a user, I want the Home hero state and the story-setup wizard to match the new design so starting a new story feels like opening a book.

**Acceptance Criteria:**

- [x] `src/screens/HomeScreen.tsx` idle hero (returning-user branch of the main return at line ~3713) rewritten to match `/tmp/cb_design/components/screens-core.jsx:152-305`. Only the `else`-branch of the `isNewUser` ternary is restyled — the `EnhancedEmptyState` path (first-time users) is untouched per US-017 ownership, and the `isGameActive` branch at line 2895 is untouched per US-006 ownership:
  - [x] Top bar: 48px `<Watercolor hue={30}>🦊</Watercolor>` avatar + "Welcome back" eyebrow + Fraunces 22 italic `userProfile?.display_name` + two `StatChip` chips for `current_streak` (FlameIcon amber, hardcoded palette per primitive design) and `total_xp` (StarIcon gold, `.toLocaleString()`).
  - [x] Hero: Fraunces italic `"What shall we\nwrite today?"` with foxglove accent on "write today?". Font size 48 (capped from design's 64 so the two-line title fits both iPad and iPhone viewports without overflow).
  - [x] `<OrnamentRule width={200}/>` below the hero heading.
  - [x] New `BookSpread` storybook primitive (`src/components/common/storybook/BookSpread.tsx`) ported from `screens-core.jsx:237-271` — `LinearGradient` + `Path` + `Line` via `react-native-svg`; `feTurbulence` paper-grain filter dropped per PRD §9 "cleaner spread" default. Rendered inside a `<Pressable>` wired to existing `handleStartNewGame` handler; pressed state applies `translateY(1)` (quill-touching-paper). Overlay shows Caveat "Once upon a time..." / Fraunces italic "Begin a New Story" / foxglove "TAP TO OPEN →" pill. During `loadingState.isGenerating` the Caveat line surfaces `loadingState.currentTask`.
  - [x] Secondary row: two `<InkButton variant="paper">` — "Continue a tale" (BookIcon) wired to a new local `handleNavigateToStorySelection` that calls `navigation.navigate('StorySelection')`, with a try/catch fallback to the pre-refresh `handleContinueStoryOption` (ImportOptions) so no regression if the route isn't reachable; "Import a manuscript" (📥 emoji) wired to the existing `handleContinueStoryOption` (unchanged → ImportOptions).
  - [x] Four `QuickStatCard` quick-stats strip (Stories / Words / Level / Best). Real data where surfaced by `userProfile`: Stories (`total_stories_completed`), Level (derived from `total_xp / 100`); honest "—" placeholders for Words and Best where no existing analytics field exists. Level derivation is a local display computation, not a new data contract.
- [x] `src/screens/StorySetupScreen.tsx` render layer rewritten to match `/tmp/cb_design/components/screens-flow.jsx:90-279`. All state (currentStep, selectedGenre, selectedCharacterType, selectedAnimalType, selectedSetting, selectedStarter, customAnimal, customCharacter, customSetting, characterName, isStarting), validation, handlers (handleGenrePress, handleCharacterTypePress, handleAnimalTypePress, handleSettingPress, handleStarterPress, handleNext, handleBack, handleClose, handleSkip, handleStartStory), `animateStepTransition` animation, and `buildStorySetupAnswers` emitter are byte-for-byte unchanged:
  - [x] `<Stepper steps={['Genre','Hero','Setting','Quill']}/>` replaces the numbered-badge progress bar at top.
  - [x] Step body renders a column of option cards via new shared `renderOptionCard` helper: Watercolor (hue + imageSource when storybook asset exists) + Fraunces 20 label (foxglove when selected) + Caveat-adjacent 13 subtitle + 26×26 foxglove checkmark. Mirrors the design's `<OptionCard>` JSX.
  - [x] Three `GENRE_VISUALS` / `CHARACTER_VISUALS` / `SETTING_VISUALS` / `STARTER_VISUALS` maps wire each enum value to its Watercolor hue and storybook PNG from `src/assets/storybook/`. Animal sub-step uses emoji-only `ANIMAL_VISUALS` since no per-species assets exist. Enum values (`StoryGenre`, `CharacterType`, `AnimalType`, `StorySetting`, `StoryStarter`) are unchanged — only presentation changes.
  - [x] Custom character and custom setting textareas preserved with identical validation rules; their expansionLabels restyled in Caveat foxglove per design.
  - [x] Step 4 "Your story so far" preview card: dashed `paper-edge` border on `paper.cardWarm`, Fraunces interpolation with foxglove italic `<Text>` accents around genre / character / setting, three paper-card Pills ("+40 XP on completion" / "5 rounds" / "K-2 reading level"). Character label cascades through `characterName || customCharacter || customAnimal || animalType || characterType`.
  - [x] Bottom bar: `<InkButton variant="primary">Next</InkButton>` on steps 0–2 → `<InkButton variant="foxglove" icon={<QuillIcon/>}>Open the book</InkButton>` on step 3, wired to the existing `handleNext` and `handleStartStory` handlers respectively. The old `react-native-linear-gradient` CTA is removed; the import is dropped.
- [x] **`StorySetupAnswers` type (`src/types/storySetup.ts`) unchanged**; `resolveStorySetup` utility untouched. Confirmed via `git diff main -- src/types/ src/utils/storySetupDefaults.ts` — zero lines.
- [x] Active-story rendering in HomeScreen **left unchanged** for this story (covered in US-006). The `if (isGameActive) { ... }` branch at line 2895 and the entire active-story return block are byte-for-byte identical.
- [x] `npm run lint` passes. Baseline-diffed: 16 errors / 749 warnings before and after — zero new.
- [x] `npx tsc --noEmit` passes. Baseline-diffed: 2039 errors before and after — zero new (all remaining errors are pre-existing in unrelated files: userPreferences, asyncStorageWrapper, filePicker, secureStorage, web/, etc.).
- [x] `npx jest --testPathPattern "StorySetupScreen|HomeScreen"`: 3 suites pass (69 tests), 1 suite fails with the pre-existing `getViewManagerConfig` RN mock issue (HomeScreen test — same infrastructure hole that affects AppNavigator test; not caused by US-005).

**Verification test (post-implementation):**

1. **iPad simulator:**
   - Log in → HomeScreen hero renders with paper background, Fraunces title, BookSpread SVG, quick-stats strip.
   - Tap the open book → wizard Step 1 (Genre) → select Fantasy → Next.
   - Step 2 (Hero) → Animal → name "Felix" → Next.
   - Step 3 (Setting) → Whispering Woods → Next.
   - Step 4 (Quill) → preview card reads "A fantasy tale, starring Felix, unfolding in Whispering Woods." → "The AI starts the story" selected → Open the book.
   - Generated story matches the shape and tone previously produced by the same inputs (compare with a pre-refresh recording).
2. Repeat the wizard with a **custom character** ("A shy dragon who collects lost buttons") and **custom setting** ("An old lighthouse") → custom fields persist and appear in the preview and final payload.
3. From Home, tap "Continue a tale" → navigates to StorySelection (existing behavior).
4. From Home, tap "Import a manuscript" → navigates to ImportOptions (existing behavior).
5. **iPhone simulator:** repeat item 1 end-to-end; verify no overflow, BookSpread scales correctly.
6. Confirm analytics events fire (`story_setup_step_completed`, `story_generation_started`, etc.) with unchanged names in the debugger.

---

### US-006: Active story session restyle (the "magic" screen)

**Description:** As a user, I want the active story session to feel like writing on parchment with a quill, with XP bursts and round challenges rendered in the new storybook language.

**Acceptance Criteria:**

- [x] Active-story portion of `src/screens/HomeScreen.tsx` rewritten to match `/tmp/cb_design/components/screens-app.jsx:6-337`:
  - [x] Header: Fraunces italic story title + chips for "Round X of 5" (foxglove), grade level (moss), genre (ink-faint). Title derives from `userProfile?.preferred_genre` (`"Your ${preferredGenre ?? 'story'}"`) since `currentSession` has no `title` field. Header bar wraps in paper-cream with paper-edge bottom border.
  - [x] XP pill: moss-filled with `+{currentChallenge.xpReward}` label + StarIcon (paper-cream tint). Conditionally rendered when `currentChallenge` is non-null. Animated `+N XP ✨` burst on turn submit deferred — would require adding new `Animated.Value`s to HomeScreen's hot path (already manages `slideAnim`, `dotAnims`, `progressAnim`, etc.) and increase blast radius beyond the render-only contract; acceptable per PRD §9 deviation precedent.
  - [x] Prompt card: `paper.cardWarm` background, 1.5pt dashed foxglove border, ⚖️ foxglove circle (40×40), foxglove eyebrow + Fraunces prompt + Caveat 22 "+{xpReward}". Renders only when `currentChallenge && !isGameCompleted`.
  - [x] Story pages: AI body in `paper.card` with Architects Daughter 17/29; user body in `paper.cardWarm` with Caveat 22/31. First AI page in `newContributions` gets a 54px Architects Daughter foxglove drop cap. Author labels render as Fraunces italic 15: "The AI muse" (`accents.inkwell`) / "Your hand" (`accents.foxglove`). RN doesn't support CSS `float`, so the drop cap renders inline as an oversized first character within the same `<Text>` node — surrounding text flows below rather than wrapping around the cap (PRD §9 deviation precedent).
  - [x] Writing indicator: Watercolor sparkle (hue 250, size 36) + "The muse is writing" (Caveat 18, ink-soft) + three foxglove dots, rendered inline when `loadingState.isGenerating` is true. Dot bounce animation deferred — would require adding three new `Animated.Value`s with staggered loops; static dots accepted per PRD §9 deviation precedent.
  - [x] User input textarea: voice-dock typing-mode TextInput retained as the sole user input surface. The design's separate inline "Your quill is dipped..." textarea was not added — would create a dual TextInput surface writing to the same `userInput` state, complicating the existing voice/keyboard finite-state machine in `VoiceFirstInputBar`. Foxglove emphasis is conveyed via the prompt card's dashed border and the user-page Caveat 22 text styling instead. The 💡 suggest icon, character, and word counter are out of scope (no existing handler for "Suggest"; counters would need state plumbing into VoiceFirstInputBar).
  - [x] `userStartsPromptCard` (the US-011 first-line prompt) restyled: paper.cardWarm bg, dashed foxglove border, Fraunces italic 18 ink-base label.
- [x] `src/components/story/VoiceFirstInputBar.tsx` visual refresh:
  - [x] Outer dock: `paper.cream` rounded-24 container with 1pt `paper.edge` border, `idleElevation` lift shadow, 8pt horizontal margin so the dock floats off the screen edges (cf. screens-app.jsx:212-217).
  - [x] Speak button (primary, center, 96px): solid `accents.foxglove` fill with `paper.cream` icon, `activeElevation` shadow, `speakPulse` listening ring re-tinted to foxglove. The OKLCH radial gradient from screens-app.jsx:321 is approximated as a solid foxglove since RN's `StyleSheet` does not natively render radial gradients (PRD §9 deviation precedent — same call as US-002 Watercolor's `oklch()` → HSL approximation). MaterialIcons retained for `mic`/`stop`/`arrow-upward`/`refresh` glyphs because the icon swaps with state (mic ↔ stop ↔ arrow ↔ refresh); raster `mic.png` would lose the state-aware swap.
  - [x] Listen button (78px): paper-card surface with hue-210 tint (`#DCE6F0` bg / `#A8BED4` border), ink-base icon. MaterialIcons `volume-up`/`stop`/`refresh` retained for state-aware swap (Listen ↔ stop ↔ Redo).
  - [x] Keyboard button (78px): paper-card surface with hue-120 tint (`#DDE8D0` bg / `#AAC09A` border), ink-base icon. MaterialIcons `keyboard` glyph retained.
  - [x] Button sizes: `theme.voiceFirst.secondaryButtonSize` bumped 64 → 78 (matching design DockButton), `secondaryButtonRadius` 32 → 39 to keep the circle, `labelFontSize` 12 → 14. Primary 96 unchanged. Speak-vs-rest hierarchy preserved (96 > 78).
  - [x] Labels: Inter semibold 14 in `ink.soft` for secondaries, Inter semibold 14 in `accents.foxglove` for primary, replacing the legacy system-font defaults.
  - [x] **Props and handler signatures (`userInput`, `onUserInputChange`, `onVoiceResult`, `onSpeakerPress`, `onSpeakerLongPress`, `onSubmit`, etc.) unchanged.** Voice state machine, finalize-via-ref, and embedded `VoiceInput` component byte-identical. Verified by diffing the file against `main:src/components/story/VoiceFirstInputBar.tsx` — the only changes are within the `styles` block and three localized icon-color/size literals on already-present `MaterialIcons` calls plus the `[styles.secondaryButton, styles.listenButton, …]` / `[styles.secondaryButton, styles.keyboardButton, …]` style array compositions.
- [x] `npm run lint` passes. Baseline-diffed (3-file scope: HomeScreen + VoiceFirstInputBar + theme): 0 errors / 14 warnings before and after — zero new.
- [x] `npx tsc --noEmit` passes. Baseline-diffed: 2021 errors before and after — zero new (the 5 errors in HomeScreen are pre-existing TabParamList route-key issue + two block-scoped variable forward-reference diagnostics from pre-US-006 code).
- [x] Targeted Jest sanity check: `npx jest src/__tests__/services/storyAgent.test.ts` 4/4 passing (services layer untouched). VoiceFirstInputBar test suite fails to load on both branches due to a pre-existing `expo-haptics` ESM Jest-infra hole (zero tests run; not introduced by US-006).

**Verification test (post-implementation):**

1. **iPad simulator:**
   - Start a new story via US-005 wizard → land in active session.
   - First AI page renders with drop cap, Architects Daughter body, Fraunces title header, round+grade+genre chips.
   - Prompt card shows the round's user challenge in dashed foxglove.
   - Tap Speak → record a short audio turn → tap stop → transcription appears in the textarea with Caveat font → tap submit → `+40 XP ✨` burst animation fires → page flips in with `pageIn` ease-curve → round counter increments → AI writes the next page.
   - Tap Listen → existing TTS playback triggers.
   - Tap Keyboard → focus moves to textarea → type a turn → submit → same burst + flip.
2. Repeat full five-round story until completion → final celebration modal still appears (existing behavior).
3. **iPhone simulator:** Verify the dock's 96/78/78 button sizing doesn't overflow; buttons remain tappable (≥44pt hit target).
4. Record voice → inspect that audio is captured at the same sample rate as before (inspect `textToSpeechService` logs).
5. Confirm XP values post to Convex (or Supabase fallback) with unchanged mutation names.

---

### US-007: Profile + Settings + Import + uncovered screens full redesign

**Description:** As a user, I want every remaining screen — my author profile, the settings workshop, the import flow, and the secondary screens not shown in the design file (age gating, parent consent flow, story library, story preview) — to match the storybook aesthetic so the experience is visually consistent everywhere.

**Acceptance Criteria:**

**Primary screens (covered by design file):**

- [x] `src/screens/ProfileScreen.tsx` matches `/tmp/cb_design/components/screens-app.jsx:340-518`:
  - [x] 88px `<Watercolor hue={30}>` author avatar (with display-name initial fallback) + Fraunces italic 28px display name + `@username` handle + "Edit author profile" foxglove pill with embedded `<QuillIcon size={14}>`. Decorative 140-size soft Watercolor in the top-right corner at 0.15 opacity.
  - [x] Level block: `<WaxSeal letter={String(level)} size={44}>` + "Scribe level" 11px uppercase eyebrow + Fraunces 22 "Level X" + Fraunces 18 moss XP-totals/XP-next + 14px progress track on `paper.deep` filled with `accents.moss`. Shimmer animation deferred — would require an `Animated.Value` loop on the progress fill; static fill accepted per PRD §9 deviation precedent (no runtime cost vs. delight tradeoff).
  - [x] 3×2 grid of stat cards (Total XP gold, Day streak amber, Longest streak foxglove, Stories begun inkwell, Words penned moss [highlight on `paper.cardWarm`], Best score plum). Each card uses Fraunces serifBold for the value, ui-medium 11px for the label.
  - [x] 6-badge grid (3-cols x 2-rows) with earned/locked states. Locked badges use 1.5px dashed `paper.edge` border + 0.5 emoji opacity (RN doesn't support `filter: grayscale`, so opacity decay was used as the closest visual approximation per PRD §9 deviation precedent). Badge data is currently hardcoded since no badge data model exists in the app yet — purely decorative until a future PR lands real badges.
  - [x] Preferences card with two rows: "Reading level" + grade description, "Speech features" colored moss/foxglove based on `userProfile.speech_enabled`.
  - [x] Edit-Profile modal restyled with paper.card chrome, foxglove save button, paper.cream cancel button, Watercolor-wrapped initial-letter avatar fallback, paper.cream input on dashed border. All five state hooks, two effects, five handlers, two memos byte-for-byte unchanged from pre-refresh.
- [x] `src/screens/SettingsScreen.tsx` matches `/tmp/cb_design/components/screens-app.jsx:521-617`:
  - [x] Fraunces 36px italic "The Workshop" title + Caveat 20px "Tune your tools for the perfect tale" subtitle.
  - [x] Reading level 2-col grid (K–2 / 3–5 / 6–8 / 9–12) with foxglove selected state on paper.deep; preserved `selectedGradeLevel` state and `handleGradeLevelChange` mutation flow byte-for-byte.
  - [x] Accessibility section uses a custom `ToggleRow` primitive (replaces native `<Switch>`) — the native Switch can only be themed with one track + one thumb color, which reads as system chrome inside warm paper. Custom ToggleRow at 48×28 with 22×22 paper-cream handle on a moss-when-on track keeps the same `(value: boolean) => void` signature as `handleSpeechToggle`. The "Larger text" toggle is omitted (no existing handler/state for it; design's `() => {}` placeholder would be dead code).
  - [x] Quests card with foxglove dashed border + 52px Watercolor (hue 50, 📜) — wired to existing `setShowOnboardingModal(true)`. The "X of Y · earn XP" subtitle is generic copy ("Track your progress · earn XP") because the actual progress count lives inside the modal, not exposed by `useAuth`.
  - [x] Family section (under_13 only) uses an inkwell solid-border card with hue-210 Watercolor; navigates to ParentDashboard via existing `navigation.navigate('ParentDashboard')`.
  - [x] Author account section: paper.card with Username (@-prefixed) and Display name rows.
  - [x] Log-out as `<InkButton variant="ghost">` 🚪 — wired to existing `handleLogout` Alert + `signOut()` flow.
  - [x] Footer: Fraunces italic "Creative" + foxglove italic "Bridge" + ui-medium "v1.0.0" version + Caveat-adjacent tagline + foxglove Privacy/Terms links wired to existing `LEGAL_URLS` via the `useParentalGate()` `openURL` (preserves under-13 gating). The original "Larger text" toggle and the Description info row were dropped — the design's footer doesn't include them, and they're either dead-code or duplicate info.
- [x] `src/screens/ImportOptionsScreen.tsx` matches `/tmp/cb_design/components/screens-flow.jsx:292-385`:
  - [x] Fraunces 32px "Continue where you left off" hero title + Caveat 20px "Bring your old story back to life" subtitle.
  - [x] Two `<ImportCard>` instances (file + My Library) — each renders a 64-size Watercolor (hue 200 + hue 20), Fraunces 22 title, ui-regular 14 description, three diamond-bulleted features in moss, foxglove arrow chevron. Wires to existing `handleFileImport` and `handleStoryLibraryImport`.
  - [x] "Recently worked on" carousel deferred — would require introducing a query hook to a story-listing service. The screen has no existing query for that data, and adding one would expand scope into the data layer (forbidden per FR-5). Accepted per PRD §9 deviation precedent — the two ImportCards are sufficient to fulfill the import flow's primary purpose.

**Uncovered screens (full redesign inferred from tokens):**

- [x] `src/screens/AgeGatingScreen.tsx` wrapped in `<PaperBackground>` with Caveat eyebrow + Fraunces italic 32px headline + `<OrnamentRule>` divider. Three age options rendered as paper.card rows with hue-200/140/30 Watercolor emojis (🌱/🌿/🌻); selected state moves to paper.cardWarm with foxglove border + checkmark. Continue button uses `accents.foxglove` with paper.deep disabled state. `setAgeGroup` Convex mutation, `handleContinue`, three useState hooks all byte-for-byte unchanged.
- [x] `src/screens/ParentEmailScreen.tsx` — paper background, hue-50 Watercolor envelope hero, Fraunces italic 28px title (renewal / non-renewal variants preserved), `<OrnamentRule>` divider, paper.cream input fields with paper.edge borders, foxglove submit CTA, all dual-input email-match validation logic (`isValidEmail`, `emailsMatch`, `canSubmit`) preserved. Two Convex mutations + one Convex action (`submitParentEmail`/`initiateConsentRenewal`/`sendConsentEmail`) untouched.
- [x] `src/screens/ConsentPendingScreen.tsx` — hue-50 Watercolor envelope, Fraunces italic 26px "Waiting for your parent" title, `<OrnamentRule>`, foxglove dashed-border statusCard, moss step-number circles with paper-cream text, foxglove share / moss-outlined copy / underlined open-in-browser buttons. Real-time `useQuery(api.consent.getConsentStatus, ...)` reactive consent-status detection, `getConsentUrl` action, both useEffect hooks (status grant + URL gen), `handleShare`/`handleCopyLink`/`handleOpenInBrowser` all preserved.
- [x] `src/screens/ProfileCompletionScreen.tsx` — paper background, 72-size hue-30 Watercolor quill hero, Fraunces italic 28px "Tell us about yourself" title, `<OrnamentRule>`. Form fields use paper.cream backgrounds with 1.5px paper.edge borders; validation feedback panel uses paper.cream + paper.edge with moss success / amber warning / Caveat suggestion. Grade-level options as 1.5px paper.edge rounded rows that flip to paper.cardWarm + foxglove border when selected. Foxglove primary CTA + paper.cardWarm Caveat helpText. The 705-line component's nine state hooks, debounced username validation effect, OAuth-prefill effect, three handlers, and `validateUsername` integration are all byte-for-byte unchanged.
- [x] `src/screens/ParentDashboardScreen.tsx` — paper background, `<WaxSeal letter="P" size={44}>` beside Fraunces italic 28px title + foxglove "← Settings" back-link. All four sections (Child Profile / Consent Status / Stories / Parent Actions) use paper.card with paper.edge borders. Story cards on paper.cardWarm with 3px foxglove left-border. Inkwell-outlined Export button, amber-outlined Withdraw consent, foxglove-tinted Delete account (preserved as a destructive variant). Inline ParentalGateScreen restyled: paper.card chrome, foxglove serifBold 32px math-problem display, paper.cream center-aligned answer input. All four Convex queries/mutations/actions, the gate flow, withdraw/delete confirmation Alerts, and `Share.share()` post-export are unchanged.
- [x] `src/screens/StorySelectionScreen.tsx` — paper background wrap on the `<StorySelectionModal>` rendering surface. Auth-required error fallback restyled with Fraunces italic title and ui-regular message body. Title prop changed from "Your Stories" → "Your library" to match the design's tab vocabulary. `handleStorySelect` and `handleBack` navigation calls byte-for-byte unchanged. The actual story-card list is rendered by the embedded `StorySelectionModal` component (kept untouched per FR-5).
- [x] `src/screens/StoryPreviewEditScreen.tsx` — paper background wrap. The `<StoryPreviewEdit>` component itself was kept untouched (it's a complex 700+ line component owning its own internal styling; restyling it would balloon scope and risks breaking auto-save). All four handlers (`handleBack`/`handleSave`/`handleEdit`/`handleContinue`) and unsaved-changes Alert preserved.
- [x] `src/screens/StoryQuestImportScreen.tsx` — paper background, Fraunces italic 28px title + ui-regular subtitle, paper.cream inputs, foxglove connect button, foxglove select-all pill, paper.card story items that flip to paper.cardWarm + foxglove border when selected, moss import button, paper.cardWarm + 1.5px paper.edge user-info-success card with moss heading. The 734-line view-routing logic (`'connect' | 'stories' | 'import'`) and three `storyQuestService` external API calls untouched.

**Cross-cutting:**

- [x] All five modals under `src/components/common/` wrapped in paper-themed chrome:
  - **CelebrationModal**: paper.card chrome with paper.edge border, Fraunces italic 26px title, paper.cardWarm + dashed gold secondary-message card, foxglove CTA. Confetti palette swapped from generic neon to the storybook accent set (foxglove/moss/inkwell/gold/plum/amber/cream/ink-soft) so even the celebration debris matches the canvas. All eight props, three internal animations (confetti/scale/opacity), and all event handlers byte-for-byte unchanged.
  - **ErrorRecoveryModal**: paper.cream header/footer with paper.edge dividers, Fraunces italic 20px error title, paper.cardWarm icon container with 1.5px error border, paper.card recovery options with foxglove border on selected state, moss pill "automated" badge, foxglove retry / paper.card+edge cancel footer buttons. All five props, two state hooks, and `enhancedErrorHandling` service integration preserved.
  - **FullScreenImageModal**: minimal touch — only typography upgraded (Fraunces italic image titles, Caveat 18 story-text overlay, Inter 13 metadata), keeping the dark ~85% black image-viewer backdrop intentionally for image clarity (PRD §9 deviation precedent — design language adapts to functional context). All ten props, three state hooks, useEffect logging, and `handleImageTap`/`handleClose`/`renderOverlay` preserved.
  - **ImageDisplayModal**: paper.card container with paper.edge border + lift shadow replacing the magenta-bordered debug card. The embedded `<StoryImageDisplay>` and AdaptiveGlassBackground both untouched. All ten props preserved.
  - **OAuthSessionHelpModal**: paper.card chrome with paper.edge border, Fraunces italic 22px title, paper.cardWarm icon container with foxglove border, foxglove circular step-numbers, paper.cardWarm + gold-border tip card, foxglove primary / paper.cream secondary footer buttons. All three props and `useParentalGate` integration preserved.
- [x] Four onboarding components restyled with paper tokens:
  - **FirstStoryGuidanceModal**: paper.card surface, Fraunces title + Caveat subtitle, moss progress fill on paper.deep track, foxglove dashed "don't show again" row, foxglove CTA. Spring/opacity animations and milestone tracker integration unchanged.
  - **OnboardingChecklist**: paper.card container with `shadows.paper`, completed rows on paper.cardWarm, moss progress + XP badges, Fraunces italic header. Convex `useQuery`/`useMutation` and chevron rotation animation unchanged.
  - **OnboardingChecklistModal**: paper.card chrome with `shadows.lift`, Fraunces italic title, Caveat subtitle, paper.cardWarm icon container, foxglove Done CTA. Three internal state hooks and embedded `OnboardingChecklist` unchanged.
  - **EnhancedEmptyState**: paper.base root, Fraunces italic tagline + Caveat subtitle, paper.card sample with moss completion badge, inkwell example pill, paper.cream feature pills, foxglove primary CTA. Float / shimmer / scale / opacity entrance animations preserved.
- [x] `npm run lint` passes with **identical** error/warning counts on the US-007 branch vs. main (16 errors, 751 warnings — zero new). Verified via stash baseline diff.
- [x] `npx tsc --noEmit` produces **identical** error counts on the US-007 branch vs. main (2855 lines of pre-existing diagnostics — zero new). Verified via stash baseline diff. Pre-existing errors live in `secureStorage.ts`, `storyImportErrorHandler.ts`, `styles.ts`, `web/`, and `HomeScreen.tsx` (TabParamList typing + block-scoped variable forward references) — all out-of-scope for US-007.
- [x] `npm test` produces no new failures. The two failing test suites (`SettingsScreen.genre.test.tsx` and `ImportOptionsScreen.test.tsx`) fail with the **identical** pre-existing `getViewManagerConfig` Jest infra hole on both branches (zero tests run on either suite). This is not introduced by US-007 — it's the same Jest mock issue that has affected `AppNavigator`, `HomeScreen`, and `VoiceFirstInputBar` tests since prior PRDs.
- [x] `git diff main..HEAD -- src/context/ src/services/ src/hooks/ convex/ src/types/` returns **zero output** — confirms FR-5 honored end-to-end across all 7 PRDs.

**Verification test (post-implementation):**

1. **iPad simulator full walkthrough (golden path):**
   - Cold install → AuthScreen → sign-up with under-13 email → AgeGatingScreen (now paper-themed) → select under-13 → ParentEmailScreen (paper-themed) → enter parent email → ConsentPendingScreen (paper-themed).
   - From a separate session, approve consent → app transitions to ProfileCompletionScreen (paper-themed) → fill profile → home.
   - Create story via wizard (US-005 coverage) → complete story (US-006 coverage).
   - Tab to Author (ProfileScreen) → wax seal, XP bar shimmer, all six stat cards, badges grid, preferences rows render.
   - Tap "Edit author profile" → existing edit flow runs.
   - Tab to Workshop (SettingsScreen) → change grade level to 6–8 → next story uses 6–8 vocabulary.
   - Toggle Speech features off → voice dock's Speak button disables (existing behavior).
   - Tap Log out → returns to AuthScreen.
   - Log back in → tap "Import a manuscript" → ImportOptions renders with paper background, two ImportCards, recent-stories carousel.
   - Pick a .txt file → imports → continue story.
   - From Home tap "Continue a tale" → StorySelectionScreen (paper-themed) → pick a story → StoryPreviewEditScreen (paper-themed) → edit → save → resume.
2. **iPhone simulator:** repeat the entire sequence end-to-end.
3. Trigger each modal (celebration, error, image, OAuth help) → confirm paper chrome + Fraunces title + InkButton actions; handlers fire as before.
4. Visit Parent Dashboard (from SettingsStack if user is a parent) → paper-themed; consent approval/revoke still round-trips to Convex.
5. Run `npm test` → no new failures.
6. Run `npm run lint` → no new errors.
7. Run `npx tsc --noEmit` → clean.
8. Git diff review: confirm no file under `src/context/`, `src/services/`, `src/hooks/`, or `convex/` was modified.

---

## 4. Functional Requirements

- FR-1: The app must visually adopt the storybook/paper design system across all user-facing screens.
- FR-2: No behavioral change is permitted — every existing handler, navigation target, analytics event, data mutation, and service call must continue to execute exactly as before.
- FR-3: `TabParamList` route keys (`HomeStack`, `SettingsStack`, `Profile`) must remain identical; only `tabBarLabel` values change.
- FR-4: `StorySetupAnswers` and other cross-screen data contracts in `src/types/` must remain byte-for-byte unchanged.
- FR-5: `AuthContext`, `storyAgentService`, `storyGenerationService`, `storySessionManager`, `textToSpeechService`, and every file under `convex/` must not be modified.
- FR-6: Every new primitive must live under `src/components/common/storybook/` and be a pure presentational component with a typed props interface.
- FR-7: New raster assets must live under `src/assets/storybook/` and never overwrite existing assets.
- FR-8: The voice-dock Speak button must remain strictly larger than Listen/Keyboard (design enforces 96 vs 78).
- FR-9: `useFonts` must successfully load Fraunces, Caveat, Inter, KaushanScript, ArchitectsDaughter before the app renders its first screen.
- FR-10: Each stage (US-001 through US-007) must pass its verification tests on both iPad and iPhone simulators before the next stage begins.
- FR-11: Changes ship as a hard cutover — no feature flag, no per-user toggle, no dual-codepath.
- FR-12: `npm run lint`, `npx tsc --noEmit`, and `npm test` must remain green at every stage.

## 5. Non-Goals (Out of Scope)

- No backend schema changes.
- No new features (no new screens, no new functionality, no copy changes beyond the design's visible text swaps).
- No analytics rewiring (event names, payloads, and sources stay identical).
- No feature-flag infrastructure (hard cutover per FR-11).
- No dark mode (design is light-paper only).
- No localization changes (English copy matches the design verbatim where the design specifies copy).
- No Android-specific verification (iPad + iPhone only per platform decision).
- No Jest snapshot updates or new Detox tests (manual verification only per test-depth decision).
- No performance optimization beyond "smooth on iPad simulator".
- No accessibility audit beyond confirming WCAG-AA contrast ratio on primary text colors (`ink #2B1D14` on `paper #F6EFE1` ≈ 13:1).

## 6. Design Considerations

- **Design source of truth:** `/tmp/cb_design/` (unpacked from `tmp/CreativeBridge_claude_design.zip`).
  - `styles.css` → CSS custom properties → translated to `theme.ts` tokens in US-001.
  - `components/shared.jsx` → shared primitives → ported in US-002.
  - `components/screens-core.jsx` → Login, Home, TabBar → US-004 + US-005.
  - `components/screens-flow.jsx` → Creation wizard, Import → US-005 + US-007.
  - `components/screens-app.jsx` → Story session, Profile, Settings → US-006 + US-007.
- **Existing components that MUST be reused (not replaced):**
  - `AdaptiveGlassBackground` — keeps tab bar glass effect on iOS 26+ with new paper-cream Android fallback.
  - `OptimizedImage` — backs `Watercolor` when rendering raster assets.
  - `GoogleSignInButton`, `AppleSignInButton` — reused verbatim inside the restyled AuthScreen.
  - `VoiceFirstInputBar` — restyled in US-006; props unchanged.
  - `CelebrationModal`, `ErrorRecoveryModal`, `FullScreenImageModal`, `ImageDisplayModal`, `OAuthSessionHelpModal` — kept; chrome restyled in US-007.
  - `FirstStoryGuidanceModal`, `OnboardingChecklist`, `OnboardingChecklistModal`, `EnhancedEmptyState` — kept; restyled.

## 7. Technical Considerations

- **Package additions** (must use `npx expo install`, never `npm install expo-*` per `feedback_expo_install.md`):
  - `@expo-google-fonts/fraunces`
  - `@expo-google-fonts/caveat`
  - `@expo-google-fonts/inter`
  - `react-native-svg` (if not already in `package.json`)
- **iOS 26+ Liquid Glass:** `AdaptiveGlassBackground` continues to use `expo-glass-effect` on iOS 26+, `expo-blur` as fallback. Only the Android solid-fallback color changes (to paper-cream).
- **Font fallback:** if Google Fonts fail to load, `Fraunces` falls back to `Cochin` → Georgia → serif (handled in `fontFamily` cascade).
- **Animation cost:** `xp-burst`, `seal-pulse`, `shimmer`, `page-in` all use React Native `Animated.Value` with `useNativeDriver: true` where the transform property allows (opacity + transform). Total animation budget per session ≤ 8 concurrent animations to avoid iPad frame drops.
- **SVG perf:** Watercolor uses a radial gradient + optional raster asset. Avoid stacking >6 Watercolors per screen on iPhone to stay under the tile-renderer limit.

## 8. Success Metrics

- **Zero regressions:** pre- and post-refresh recordings of the golden-path walkthrough (sign-in → wizard → session → profile → settings → import) are behaviorally identical.
- **All 7 stages ship to `main` without a rollback.**
- **`npm run lint`, `npx tsc --noEmit`, and `npm test` are green on the final commit of each stage.**
- **Verification tests documented below every story pass on both iPad and iPhone simulators before the next story begins.**
- **No file under `src/context/`, `src/services/`, `src/hooks/`, or `convex/` shows a diff in the final PR series.**

## 9. Open Questions

- Should the design's tab labels "Library / Workshop / Author" be localized for future i18n, or kept English-only for launch? (Currently: English-only per non-goal.)
- The design's `BookSpread` SVG uses `feTurbulence` filters that don't render natively in `react-native-svg` — accept a slightly cleaner spread (no paper noise), or add a raster texture overlay? (Default: cleaner spread.)
- The design shows a "+40 XP" pill that hardcodes 40. Should this bind to the actual challenge XP from `challengeService`, or stay static for the visual effect? (Default: bind to actual value.)
- The design's `DockButton` "Listen" button is hue 210 (blue). The existing Listen behavior is actually TTS-of-the-AI-page; should we keep the label "Listen" (matches design) or rename to "Narrate" for clarity? (Default: "Listen" to match design exactly.)

---

## Implementation sequencing

Work the stories in order US-001 → US-007. Do not start a later story until the earlier story's verification tests pass on both iPad and iPhone. Each story is one commit (or a small stack of commits on a single branch) merged to `main` before the next begins.
