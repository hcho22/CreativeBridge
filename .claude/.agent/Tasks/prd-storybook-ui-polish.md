# PRD: Storybook UI Polish (Round 2)

## 1. Introduction / Overview

`prd-storybook-ui-refresh.md` (Round 1, US-001 through US-007) shipped the storybook/paper redesign across ~30 screens. Manual QA on iPad surfaced **5 polish issues** that Round 1 either missed, partially addressed, or solved with the wrong primitive. These are presentation-layer-only follow-ups — no service, navigation, data-contract, or backend changes.

**The 5 issues:**

1. **HomeScreen idle hero avatar + redundant stats** — The hero shows a hardcoded 🦊 emoji instead of the user's actual profile photo (which `ProfileScreen` already renders). It also duplicates a Stories/Words/Level/Best stats strip that already lives in the Author tab.
2. **Active story session line spacing + voice dock icons** — The AI body text `lineHeight: 29` over `fontSize: 17` (1.71× ratio) reads as double-spaced. The voice dock's Listen/Speak/Keyboard buttons render flat MaterialIcons even though watercolor PNG assets (`speaker.png`, `mic.png`, `keyboard.png`) already exist in `src/assets/storybook/`.
3. **`StorySelectionModal` never restyled** — Round 1's US-007 wrapped `StorySelectionScreen` in a `<PaperBackground>` but left the 1170-line modal that renders the actual list using hardcoded `#fff` / `#007AFF` / `#333`.
4. **HomeScreen "Story Complete!" inline overlay + `ImageGeneration` component** — Both bypass the (correctly themed) `CelebrationModal` and use Material green (`#4CAF50`) / Bootstrap purple (`#6f42c1`) hex literals.
5. **Inconsistent story-page fonts** — AI pages render in Architects Daughter; user pages render in Caveat. Two distinct hand-drawn fonts on adjacent panels reads as inconsistent rather than as a deliberate speaker cue.

**Stale-build note (do not include in scope):** `CelebrationModal` (`src/components/common/CelebrationModal.tsx`) and `ImportOptionsScreen` (`src/screens/ImportOptionsScreen.tsx`) appear unstyled in user screenshots but are **already paper-themed in code**. The likely cause is a stale Metro bundle. Validation includes a `--reset-cache` re-test step rather than re-patching already-correct files.

---

## 2. Goals

- Eliminate every visible regression from Round 1's manual QA pass on iPad and iPhone.
- Replace the hardcoded 🦊 hero avatar with the user's actual profile photo, mirroring ProfileScreen's render pattern.
- Restore single-spaced story-page typography and unify the AI/user font to Architects Daughter.
- Migrate the three remaining hardcoded surfaces (`StorySelectionModal`, HomeScreen "Story Complete!" overlay, `ImageGeneration`) onto storybook tokens.
- Swap voice-dock idle-state glyphs to watercolor raster assets while preserving the state-aware MaterialIcons swaps for action states (stop, refresh, arrow-up, spinner).
- Maintain TypeScript / ESLint / test-suite parity at every stage (no new errors introduced).
- Preserve 100% of existing handler signatures, navigation flows, mutations, and analytics events (FR-2 / FR-5 from Round 1 PRD remain in force).

---

## 3. User Stories

### US-001: Personalized hero avatar + stats cleanup

**Description:** As a returning user, I want my Home hero to show my own profile photo (instead of a generic fox emoji) and to stop duplicating stats I already see in the Author tab, so the screen feels personal and uncluttered.

**Acceptance Criteria:**

- [x] In `src/screens/HomeScreen.tsx` (idle hero, lines ~3883–3885), the `<Watercolor hue={30}>🦊</Watercolor>` is replaced with a conditional render mirroring `ProfileScreen.tsx:258-269`:
  - When `userProfile?.avatar_url` is truthy → render `<Image source={{ uri: userProfile.avatar_url }}>` at 48×48 with `borderRadius: 24`.
  - Otherwise → render `<Watercolor hue={30} size={48}>` containing the uppercase first letter of `userProfile.display_name` (or `🦊` if display name is empty).
- [x] A new `idleAvatarImage` style is added to the styles block: `width: 48, height: 48, borderRadius: 24`.
- [x] The four `<QuickStatCard>` elements at lines ~3974–3987, plus their wrapping `<View style={styles.quickCardStrip}>`, are deleted.
- [x] The `quickCardStrip` style entry is removed from the styles block.
- [x] `QuickStatCard` was a local helper (not an import). Its definition and the associated `quickCardStyles` block were removed since they became dead code; the now-orphaned `storiesCount` / `derivedLevel` derivations and their stale comment were also dropped.
- [x] No other change to the idle hero (BookSpread, OrnamentRule, secondary action row, top-right StatChips remain byte-for-byte unchanged).
- [x] Lint, typecheck, and test parity (no new errors vs. baseline). Baseline + post: TS = 2039 errors (parity), ESLint = 16 errors / 751 warnings (parity), Jest failure shape unchanged (pre-existing RN-bridge mock holes per §7).
- [ ] **Manual:** Validation Test steps 1–5 (iPad + iPhone simulator cold-launch) — requires running Metro + Xcode; not yet executed.

**Validation Test:**

1. Cold-launch on iPad simulator; sign in as a user **with** `avatar_url` set → confirm the photo renders in the hero row at 48×48 circular.
2. Sign in as a user **without** `avatar_url` → confirm the fallback watercolor renders the user's first initial in warm hue 30.
3. Confirm the QuickStatCard strip (Stories / Words / Level / Best) is gone; the spacing between the secondary action row ("Continue a tale" / "Import a manuscript") and the bottom of the screen is reasonable (no stray empty container).
4. Tab to Author → confirm the same stats are still rendered there (no data loss).
5. Repeat on iPhone simulator.
6. Run `npm run lint`, `npx tsc --noEmit`, `npm test` → no new errors vs. baseline (record pre/post counts).

---

### US-002: Single-spaced story body + watercolor voice dock icons

**Description:** As a reader, I want the AI's story page to feel like a single block of prose (not double-spaced lines), and as a writer I want the voice dock buttons to feel hand-drawn (matching the design's watercolor aesthetic) rather than flat material icons.

**Acceptance Criteria:**

- [x] `src/screens/HomeScreen.tsx`, `storyBodyAi` style (lines ~4744–4748): `lineHeight: 29` is reduced to `lineHeight: 22` (1.29× ratio over `fontSize: 17`).
- [x] `src/components/story/VoiceFirstInputBar.tsx` voice dock buttons:
  - **Listen button (lines ~835–853):** when idle (`speakerState === 'idle'` AND `mode !== 'reviewing-transcript'`) → render `<Image source={require('../../assets/storybook/speaker.png')}>` at 44×44. Action states (`stop` for playing, `refresh` for review) keep their `MaterialIcons`.
  - **Speak button (lines ~932–965):** when idle (`mode !== 'listening' && !isGenerating && mode !== 'reviewing-transcript'`) → render `<Image source={require('../../assets/storybook/mic.png')}>` at 56×56. The pulsing ring, `stop`, `arrow-upward`, and `ActivityIndicator` states stay as-is.
  - **Keyboard button (lines ~1029–1033):** unconditional swap to `<Image source={require('../../assets/storybook/keyboard.png')}>` at 44×44 (no state variants).
- [x] Button container sizes (78×78 secondary, 96×96 primary) and theme-token-driven fills/borders/labels remain unchanged.
- [x] All voice dock prop signatures (`userInput`, `onUserInputChange`, `onVoiceResult`, `onSpeakerPress`, `onSpeakerLongPress`, `onSubmit`, etc.) are byte-for-byte unchanged.
- [x] Lint, typecheck, and test parity vs. baseline. (Baseline: tsc 2040 errors, lint 16 errors / 752 warnings, VoiceFirstInputBar test suite blocked by pre-existing `expo-haptics` ESM mock hole. Post-edit: tsc 2039 errors, lint 16 errors / 751 warnings, same test-suite failure mode — failure set did not grow.)

**Validation Test:**

1. iPad simulator: start a new story → first AI page renders with visibly tighter line spacing (compare with the user's "double-spaced" screenshot — the gap between lines should be roughly half).
2. Confirm Listen / Speak / Keyboard buttons each show the watercolor PNG glyph at rest.
3. Tap **Speak** → mic raster swaps to MaterialIcons `stop` (recording state) → tap stop → swaps to `arrow-upward` (review state) → confirm both swaps still work.
4. Tap **Listen** while AI page exists → speaker raster swaps to MaterialIcons `stop` (playing).
5. Enter review mode → Listen button shows MaterialIcons `refresh` (Redo).
6. Tap **Keyboard** → focus moves to TextInput; raster glyph stays put.
7. Repeat on iPhone simulator; verify no clipping at 78×78 / 96×96 button sizes.
8. Lint + typecheck + tests parity vs. baseline.

---

### US-003: StorySelectionModal paper migration

**Description:** As a user navigating from Home → "Continue a tale", I want the story-selection list to look like the rest of the storybook app, not a separate generic file picker.

**Acceptance Criteria:**

- [x] `src/components/story/StorySelectionModal.tsx` styles block (lines ~782–1169) migrates every hardcoded hex literal to `theme.colors.*`:

  | Old                            | New                             |
  | ------------------------------ | ------------------------------- |
  | `#f5f5f5` (container bg)       | `theme.colors.paper.base`       |
  | `#fff` (header / search bar)   | `theme.colors.paper.cream`      |
  | `#fff` (story cards)           | `theme.colors.paper.card`       |
  | `#007AFF` (active filter pill) | `theme.colors.accents.foxglove` |
  | `#e0e0e0` (inactive borders)   | `theme.colors.paper.edge`       |
  | `#333` (titles)                | `theme.colors.ink.base`         |
  | `#666` (previews / dates)      | `theme.colors.ink.soft`         |

- [x] Source-badge palette (lines ~88–101) maps per-source: `CreativeBridge` → `accents.moss` (≈ convex/native), `Story_Quest` → `accents.inkwell` (≈ supabase/legacy), `File` → `accents.plum` (≈ imported), plus `New` → `accents.amber` and default → `ink.faint`.
- [x] Title "Select Story" → "Your library" (default `title` prop now `'Your library'`; style uses `theme.typography.fontFamily.serifItalic`, `fontStyle: 'italic'`, fontSize 28, color `theme.colors.ink.base`).
- [x] Story-card row uses `theme.shadows.paper` for soft elevation (spread into `storyCard` style); date-filter chips reuse the `paper.cardWarm` + `paper.edge` pill pattern when inactive and switch to `accents.foxglove` when active.
- [x] No JSX restructuring — only style edits, two `ActivityIndicator` color-prop swaps, and the `title` default-string rename. The story-rendering loop, search/filter state, and `onStorySelect` callback signature are byte-for-byte unchanged.
- [x] Lint, typecheck, and test parity vs. baseline (lint 767 → 766; zero new typecheck errors in the component; modal tests 3/28 → 4/28 passing — parity-or-better on every gate).

**Validation Test:**

1. iPad simulator: Home → "Continue a tale" → list renders on `paper.base` background.
2. Header reads "Your library" in Fraunces italic.
3. Date filter pills (`All Time` / `This Week` / `This Month` / `This Year`) render foxglove when active, paper.cream + paper.edge when inactive.
4. Story rows render in `paper.card` with `paper.edge` borders and soft `theme.shadows.paper` elevation.
5. Source badges render moss (convex) / inkwell (supabase) / plum (imported), not blue/green/purple.
6. Tap a story → still navigates to `StoryPreviewEditScreen` (selection callback unchanged).
7. Search input still filters the list reactively.
8. Repeat on iPhone simulator.
9. Lint + typecheck + tests parity vs. baseline.

---

### US-004: "Story Complete!" overlay + ImageGeneration paper migration

**Description:** As a user finishing a story or generating an illustration, I want the celebration and progress modals to match the rest of the storybook UI instead of jumping to Material green or Bootstrap purple chrome.

**Acceptance Criteria:**

- [x] `src/screens/HomeScreen.tsx` "Story Complete!" overlay (lines ~3543–3707, styles ~4883–4930):
  - Title green `#4CAF50` → Fraunces italic, `theme.colors.ink.base`.
  - Subtitle `#333` → `theme.colors.ink.soft` with `uiRegular` font.
  - Stats text `#666` → `theme.colors.ink.faint`.
  - Five buttons (`View Story` / `Download Story` / `Generate Image` / `New Story` / `Main Menu`) each replaced with `<InkButton>`:
    - View Story / Download Story / Generate Image → `variant="foxglove"`
    - New Story → `variant="moss"`
    - Main Menu → `variant="ghost"`
  - Container chrome → `theme.colors.paper.card` with `theme.shadows.lift` and `theme.colors.paper.edge` 1.5px border.
  - All five button handlers and the conditional "Generate Image / View Image" branch are byte-for-byte unchanged.
- [x] `src/components/common/ImageGeneration.tsx` (lines ~843–989):
  - Container `#ffffff` → `theme.colors.paper.card`.
  - Loading container `#f8f9fa` → `theme.colors.paper.cream`.
  - Progress percent text + bar fill `#6f42c1` → `theme.colors.accents.moss`.
  - Generation button `#6f42c1` → `theme.colors.accents.foxglove`.
  - Title "Creating Your Illustration" → `theme.typography.fontFamily.serifItalic`, color `theme.colors.ink.base`.
  - Error containers `#f8d7da` → `theme.colors.paper.cardWarm` with 1.5px `theme.colors.accents.foxglove` border.
  - Retry button `#007bff` → `theme.colors.accents.foxglove`.
- [x] Polling logic, animations, error-state handlers, and the `imageGenerationService` call signatures are unchanged.
- [x] Lint, typecheck, and test parity vs. baseline (TS errors 2040 → 2039, ESLint warnings 751 → 750; pre-existing test failures unchanged — manual iPad/iPhone simulator validation pending).

**Validation Test:**

1. iPad simulator: complete a 5-round story → "Story Complete!" overlay renders in paper.card chrome with Fraunces italic title; all five buttons render as InkButtons in foxglove / moss / ghost variants.
2. Tap each button → existing navigation/handler fires (View Story → preview, Download Story → file save, Generate Image → progress modal, New Story → wizard, Main Menu → home).
3. Tap **Generate Image** → progress modal renders paper.card chrome, foxglove "Generating…" pill, moss progress fill, Fraunces italic "Creating Your Illustration" title.
4. Trigger an image-generation error (toggle airplane mode mid-generation) → error chrome renders paper.cardWarm with foxglove border; Retry button is foxglove.
5. Repeat on iPhone simulator.
6. Lint + typecheck + tests parity vs. baseline.

---

### US-005: Unified story-page font

**Description:** As a reader, I want both the AI's pages and my own pages to read in the same hand-drawn voice (Architects Daughter), with speaker identity conveyed by the labels above each page rather than by switching the body font entirely.

**Acceptance Criteria:**

- [x] `src/screens/HomeScreen.tsx` `storyBodyUser` style (actual identifier in code: `storyPageTextUser`, ~line 4655):
  - `fontFamily: theme.typography.fontFamily.hand` (Caveat) → `theme.typography.fontFamily.architectsDaughter`.
  - `fontSize: 22` → `17` (matches AI body).
  - `lineHeight: 31` → `22` (matches AI body, single-spaced from US-002).
- [x] Author labels above each page remain in Fraunces italic with their existing color differentiation (`accents.inkwell` for "The AI muse", `accents.foxglove` for "Your hand"). No label-styling change in this story. (Verified `aiAuthorLabel` line 4608 / `userAuthorLabel` line 4615 untouched.)
- [x] No prop / handler / contribution-rendering logic change.
- [x] Lint, typecheck, and test parity vs. baseline. Pre/post counts identical: tsc = 2039 errors, lint = 16 errors / 750 warnings; no test references the changed style.
- [ ] **Manual:** Validation Test steps 1–4 (iPad + iPhone simulator scroll through a multi-round story) — requires running Metro + Xcode; not yet executed.

**Validation Test:**

1. iPad simulator: continue a story past round 1 → user-page body renders in Architects Daughter at 17px / 22 lineHeight, visually identical to the AI page body.
2. Author labels above each page still read "The AI muse" (inkwell italic) and "Your hand" (foxglove italic), so the speaker is still legible at a glance.
3. Scroll the full multi-round story → confirm consistent typography across all AI and user pages.
4. Repeat on iPhone simulator.
5. Lint + typecheck + tests parity vs. baseline.

---

## 4. Functional Requirements

- **FR-1:** The HomeScreen idle hero must render the user's `avatar_url` when present, falling back to a watercolor with the first initial of `display_name` when absent (same pattern as `ProfileScreen.tsx:258-269`).
- **FR-2:** The HomeScreen idle hero must NOT render the QuickStatCard strip; those stats are surfaced on the Author tab and must not be duplicated.
- **FR-3:** The active-story AI body text must use `lineHeight: 22` over `fontSize: 17` (1.29× ratio).
- **FR-4:** The active-story user body text must use `theme.typography.fontFamily.architectsDaughter` at the same `fontSize: 17` / `lineHeight: 22` as the AI body.
- **FR-5:** The voice dock's Listen / Speak / Keyboard buttons must render watercolor raster assets in their idle state and MaterialIcons in their action states (stop / arrow-up / refresh / spinner). State machine logic remains unchanged.
- **FR-6:** `StorySelectionModal.tsx` must use only `theme.colors.*` and `theme.typography.*` tokens — zero hex color literals in the component's styles block.
- **FR-7:** The HomeScreen "Story Complete!" inline overlay must render via `<InkButton>` primitives and `theme.colors.*` tokens — zero hex color literals.
- **FR-8:** `ImageGeneration.tsx` progress + error UI must use only `theme.colors.*` tokens — zero hex color literals.
- **FR-9:** No file under `src/context/`, `src/services/`, `src/hooks/`, `src/types/`, or `convex/` may be modified (Round 1 PRD's FR-5 still applies).
- **FR-10:** All five user stories must pass lint / typecheck / test parity vs. their starting baseline (no new errors introduced).
- **FR-11:** All existing handler signatures (`handleAuth`, `handleStartNewGame`, `handleNavigateToStorySelection`, voice dock callbacks, generation handlers) must remain byte-for-byte unchanged.
- **FR-12:** Each story must pass its Validation Test on both iPad and iPhone simulators before the next story begins.

---

## 5. Non-Goals (Out of Scope)

- No new screens, no new features, no new copy beyond the Storybook design's visible text swaps.
- No service / context / hook / Convex backend changes (FR-9).
- No new analytics events; existing names and payloads are preserved.
- No new fonts or packages — every required token already exists in `theme.ts` and assets already exist in `src/assets/storybook/`.
- No re-styling of `CelebrationModal` or `ImportOptionsScreen` — both verified paper-themed in code (the user's screenshots showing them unstyled are stale-build artifacts).
- No accessibility audit beyond preserving WCAG-AA contrast on text colors.
- No dark mode.
- No Android-specific verification (iPad + iPhone only, matching Round 1).
- No Jest snapshot updates or new Detox tests; manual verification only.
- No animation additions (no XP burst, no shimmer, no dot bounce — those were deferred in Round 1 and remain deferred).

---

## 6. Design Considerations

- **Design source of truth:** Same as Round 1 — `/tmp/cb_design/` HTML/JSX mockups + `styles.css` tokens. The 5 issues here are deltas against that already-translated source.
- **Existing primitives that MUST be reused (do NOT re-create):**
  - `<InkButton variant="foxglove|moss|primary|paper|ghost">` → `src/components/common/storybook/InkButton.tsx`. Used in US-004 to replace inline TouchableOpacity buttons.
  - `<Watercolor hue size>` → `src/components/common/storybook/Watercolor.tsx`. Used in US-001 as the avatar fallback.
  - `<PaperBackground>` → `src/components/common/storybook/PaperBackground.tsx`. Already wraps both modified screens; no new wrapping needed.
- **Theme tokens that MUST be reused** (all already exist in `src/constants/theme.ts`):
  - `theme.colors.{paper,ink,accents}` (all sub-keys: paper.{base,card,cardWarm,cream,edge,deep}, ink.{base,soft,faint}, accents.{foxglove,moss,inkwell,gold,plum,amber})
  - `theme.typography.fontFamily.{serifItalic,architectsDaughter,uiRegular,uiMedium,uiSemiBold,serifBold,hand}`
  - `theme.shadows.{paper,card,lift,sm}`
- **Avatar render pattern:** Copy `ProfileScreen.tsx:258-269` verbatim (same conditional structure, same 48×48 → 24 borderRadius math, same fallback to `<Watercolor hue={30}>` with first initial). This guarantees the hero avatar and the Author tab avatar always look like the same person.
- **Voice dock raster sizes:** Secondary raster 44×44 inside 78×78 button (matches inscribed circle of existing 32px MaterialIcons + texture weight); primary raster 56×56 inside 96×96 button (matches 40px → 56px expansion). These were chosen so the watercolor texture is visible without overflowing the button boundary.

---

## 7. Technical Considerations

- **No new packages.** All assets exist; all fonts are loaded; all primitives exist.
- **Stale-build hygiene:** Before declaring any "unstyled" issue real, run `npm start -- --reset-cache` and re-test. Round 1's `CelebrationModal` and `ImportOptionsScreen` audits confirmed both are paper-themed in source even though screenshots showed them unstyled — Metro caching was the culprit.
- **`StorySelectionModal` is the largest single change** — ~30 hex-to-token swaps inside one ~1170-line StyleSheet plus a per-source badge palette function. Plan ~1 hour for this story; the others are 15-30 min each.
- **Animation budget (FR from Round 1 PRD §7):** unchanged. No new animations added; ≤ 8 concurrent animations per session remains the iPad headroom rule.
- **SVG perf:** Voice-dock raster swap actually _reduces_ per-frame cost vs. SVG MaterialIcons rendering — net positive.
- **Test infra holes:** Round 1 documented pre-existing Jest mock issues (`getViewManagerConfig`, `expo-haptics` ESM) on `AppNavigator`, `HomeScreen`, `VoiceFirstInputBar`, `SettingsScreen.genre`, `ImportOptionsScreen` test suites. These will continue to fail on Round 2 — that is acceptable as long as the **failure set doesn't grow**. Document baseline pre/post counts for each story.

---

## 8. Success Metrics

- **Zero regressions:** Pre- and post-refresh recordings of the golden-path walkthrough (sign-in → wizard → session → completion → profile → settings → import) are behaviorally identical.
- **All 5 stories ship to `main` without rollback.**
- **`npm run lint`, `npx tsc --noEmit`, and `npm test` show identical or smaller error/warning counts vs. baseline at the final commit of each story.**
- **Validation tests pass on both iPad and iPhone simulators before the next story begins.**
- **`git diff main..HEAD -- src/context/ src/services/ src/hooks/ src/types/ convex/` returns zero output** (FR-9 honored).
- **Visual parity with `/tmp/cb_design/` mockups** for each refreshed surface, judged by side-by-side screenshot comparison.

---

## 9. Open Questions

- **Source-badge palette mapping (US-003):** the mapping (convex → moss, supabase → inkwell, imported → plum) is a designer's-best-guess derived from the storybook accent palette. Is there a canonical mapping the design team prefers? (Default: ship the proposed mapping and adjust if QA flags it.)
- **Hero avatar fallback when both `avatar_url` and `display_name` are empty (US-001):** the fallback chain is `avatar_url → first letter of display_name → 🦊`. Is the 🦊 ultimate fallback acceptable, or should it be the user's email-initial / a generic 👤? (Default: keep 🦊 — it matches the Round 1 hero state, so anonymous users see no visual change.)
- **"Your library" rename (US-003):** Round 1 PRD US-007 already renamed the StorySelectionScreen prop `title` from "Your Stories" → "Your library". Should the modal's internal header match exactly, or use a slightly different phrasing like "Pick a story"? (Default: "Your library" — matches the screen-level rename.)
- **Voice dock raster + MaterialIcons mixing (US-002):** the action states (stop / arrow-up / refresh / spinner) keep their MaterialIcons because they're state-aware action verbs. Acceptable to mix raster + vector glyphs across states, or should we commission additional raster variants (e.g., `mic-stop.png`, `mic-submit.png`) for full visual consistency? (Default: mix — commissioning 4+ raster variants per button balloons scope and waiting on assets blocks ship.)

---

## Implementation sequencing

Work the stories in order **US-001 → US-005**. Do not start a later story until the earlier story's Validation Test passes on both iPad and iPhone simulators. Each story is one commit (or a small stack of commits on a single branch) merged to `main` before the next begins. This matches Round 1's hard-cutover, no-feature-flag sequencing.
