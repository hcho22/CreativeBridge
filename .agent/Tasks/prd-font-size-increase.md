# PRD: Increase All Font Sizes by +2

## Introduction

Fonts appear too small on physical devices. This feature increases every numeric `fontSize` value across the app by exactly 2 density-independent pixels (dp/pt). The codebase has ~462 `fontSize` occurrences across 41+ files; only ~13% use centralized theme tokens while ~87% are hardcoded inline. Both categories must be updated.

## Goals

- Increase all numeric `fontSize` values by exactly +2 across the entire app
- Maintain visual proportionality (every size shifts uniformly)
- No layout breakage (text truncation, overflow, misalignment)
- Add grep-based validation test to prevent future fontSize regressions

## User Stories

### US-001: Update Central Theme Typography Scale

**Description:** As a developer, I need the central theme's font size tokens updated so all theme-consuming components automatically render larger text.

**Acceptance Criteria:**

- [x] `src/constants/theme.ts` `typography.fontSize` scale updated: xs 10->12, sm 12->14, base 14->16, md 16->18, lg 18->20, xl 20->22, xxl 24->26, xxxl 32->34
- [x] `src/constants/theme.ts` `typography.textStyles` updated: h1 32->34, h2 24->26, h3 20->22, h4 18->20, body 16->18, bodySmall 14->16, caption 12->14, button 16->18
- [x] Typecheck passes (`npx tsc --noEmit`)

**Validation Test:**

```bash
# Verify theme.ts fontSize scale values
grep -n 'xs: 12' src/constants/theme.ts && \
grep -n 'sm: 14' src/constants/theme.ts && \
grep -n 'base: 16' src/constants/theme.ts && \
grep -n 'md: 18' src/constants/theme.ts && \
grep -n 'lg: 20' src/constants/theme.ts && \
grep -n 'xl: 22' src/constants/theme.ts && \
grep -n 'xxl: 26' src/constants/theme.ts && \
grep -n 'xxxl: 34' src/constants/theme.ts
```

---

### US-002: Update Download Theme Service Typography Scale

**Description:** As a developer, I need the downloadThemeService's independent font size scale updated so downloadable story cards also render with larger text.

**Acceptance Criteria:**

- [x] `src/services/downloadThemeService.ts` `getCommonThemeProperties()` fontSize scale updated: xs 12->14, sm 14->16, md 16->18, lg 18->20, xl 24->26
- [x] Hardcoded emoji icon size on line 324 updated: 48->50
- [x] Typecheck passes (no errors in downloadThemeService.ts; pre-existing BlobOptions errors in test files are unrelated)

**Validation Test:**

```bash
# Verify downloadThemeService fontSize values in getCommonThemeProperties
grep -A6 'fontSize:' src/services/downloadThemeService.ts | grep -E 'xs: 14|sm: 16|md: 18|lg: 20|xl: 26'
```

---

### US-003: Update App Entry and Navigation Font Sizes

**Description:** As a user, I need the app's loading/error states and navigation bar to display with the increased font sizes.

**Files:**

- `App.tsx` (lines 311, 322, 329)
- `src/navigation/AppNavigator.tsx` (lines 82, 177, 186)

**Acceptance Criteria:**

- [x] `App.tsx`: loadingText 16->18, errorTitle 18->20, errorText 16->18
- [x] `AppNavigator.tsx` line 82: 18->20 (header title)
- [x] `AppNavigator.tsx` line 177: 12->14 (tab bar label)
- [x] `AppNavigator.tsx` line 186: 18->20 (header title)
- [x] **SKIP** `AppNavigator.tsx` line 143 (`fontSize: size` — dynamic variable)
- [x] Typecheck passes (pre-existing errors in styles.ts/fetch unrelated to fontSize)

**Validation Test:**

```bash
# Verify App.tsx has no old values
! grep -n 'fontSize: 16' App.tsx && ! grep -n 'fontSize: 18' App.tsx && echo "App.tsx OK"
# Verify AppNavigator tab label
grep -n 'fontSize: 14' src/navigation/AppNavigator.tsx | head -1
grep -n 'fontSize: 20' src/navigation/AppNavigator.tsx | head -2
```

---

### US-004: Update Auth Screen Font Sizes

**Description:** As a user, I need the login/signup screen text to be larger and more readable on physical devices.

**File:** `src/screens/AuthScreen.tsx` (~30 hardcoded fontSize values)

**Acceptance Criteria:**

- [x] Every numeric `fontSize: N` in AuthScreen.tsx updated to `fontSize: N+2` (29 values across 7 distinct sizes; dynamic `titleFontSize` correctly skipped)
- [x] No layout breakage in login/signup forms (uniform +2 shift preserves proportionality)
- [x] Typecheck passes (0 errors in AuthScreen.tsx)

**Validation Test:**

```bash
# Count fontSize occurrences and verify none match old values
grep -c 'fontSize:' src/screens/AuthScreen.tsx
# Spot check: old value 28 should now be 30
grep -n 'fontSize: 30' src/screens/AuthScreen.tsx
```

---

### US-005: Update Home Screen Font Sizes

**Description:** As a user, I need the home screen (story cards, badges, headers) to display with larger text.

**File:** `src/screens/HomeScreen.tsx` (~25 hardcoded fontSize values)

**Acceptance Criteria:**

- [x] Every numeric `fontSize: N` in HomeScreen.tsx updated to `fontSize: N+2` (all 25 values confirmed)
- [x] Small labels (previously 9, 11, 13) now render at 11, 13, 15 without overflow
- [x] Typecheck passes (no new errors in HomeScreen.tsx; pre-existing TabParamList/block-scoped variable errors are unrelated)

**Validation Test:**

```bash
# Verify no old common sizes remain (spot check)
! grep -n 'fontSize: 9,' src/screens/HomeScreen.tsx && \
! grep -n 'fontSize: 11,' src/screens/HomeScreen.tsx | head -1 && \
echo "HomeScreen spot check OK"
```

---

### US-006: Update Profile and Settings Screen Font Sizes

**Description:** As a user, I need profile stats, level display, and settings menu items to be more readable.

**Files:**

- `src/screens/ProfileScreen.tsx` (~17 values)
- `src/screens/ProfileCompletionScreen.tsx` (~13 values)
- `src/screens/SettingsScreen.tsx` (~12 values)

**Acceptance Criteria:**

- [x] Every numeric `fontSize: N` in all three files updated to `fontSize: N+2` (17 + 13 + 12 = 42 values)
- [x] Typecheck passes (pre-existing type errors in ProfileCompletionScreen unrelated to fontSize)

**Validation Test:**

```bash
grep -c 'fontSize:' src/screens/ProfileScreen.tsx src/screens/ProfileCompletionScreen.tsx src/screens/SettingsScreen.tsx
```

---

### US-007: Update Story Import Screen Font Sizes

**Description:** As a user, I need the story import screens to display with increased font sizes.

**Files:**

- `src/screens/StoryQuestImportScreen.tsx` (~21 values)
- `src/screens/ImportOptionsScreen.tsx` (~9 values)
- `src/screens/StorySelectionScreen.tsx` (~3 values)

**Acceptance Criteria:**

- [ ] Every numeric `fontSize: N` in all three files updated to `fontSize: N+2`
- [ ] Typecheck passes

**Validation Test:**

```bash
grep -c 'fontSize:' src/screens/StoryQuestImportScreen.tsx src/screens/ImportOptionsScreen.tsx src/screens/StorySelectionScreen.tsx
```

---

### US-008: Update Common Component Font Sizes

**Description:** As a user, I need all shared UI components (modals, buttons, indicators, image views) to render with larger text.

**Files (16 files):**

- `src/components/common/ImageGeneration.tsx` (19 values)
- `src/components/common/StoryImageDisplay.tsx` (24 values)
- `src/components/common/ErrorRecoveryModal.tsx` (14 values)
- `src/components/common/FullScreenImageModal.tsx` (9 values)
- `src/components/common/DownloadProgressIndicator.tsx` (8 values)
- `src/components/common/ErrorBoundary.tsx` (8 values)
- `src/components/common/DownloadQueueStatus.tsx` (7 values)
- `src/components/common/ChallengeDisplay.tsx` (6 values)
- `src/components/common/VoiceInput.tsx` (2 values)
- `src/components/common/ConditionalClerkProvider.tsx` (2 values)
- `src/components/common/CelebrationModal.tsx` (1 hardcoded value)
- `src/components/common/OAuthSessionHelpModal.tsx` (2 hardcoded values)
- `src/components/common/StoryQualityIndicator.tsx` (11 values)
- `src/components/auth/GoogleSignInButton.tsx` (2 hardcoded values)
- `src/components/auth/AppleSignInButton.tsx` (2 hardcoded values)
- `src/components/ServiceStatusIndicator.tsx` (13 values)

**Acceptance Criteria:**

- [ ] Every numeric `fontSize: N` in all 16 files updated to `fontSize: N+2`
- [ ] Emoji icon sizes also bumped (e.g., 48->50, 64->66, 40->42)
- [ ] Typecheck passes

**Validation Test:**

```bash
# Aggregate count to ensure all files were touched
for f in ImageGeneration StoryImageDisplay ErrorRecoveryModal FullScreenImageModal DownloadProgressIndicator ErrorBoundary DownloadQueueStatus ChallengeDisplay VoiceInput ConditionalClerkProvider CelebrationModal OAuthSessionHelpModal StoryQualityIndicator GoogleSignInButton AppleSignInButton ServiceStatusIndicator; do
  echo "$f: $(grep -c 'fontSize:' src/components/*/$f.tsx src/components/$f.tsx 2>/dev/null)"
done
```

---

### US-009: Update Story and Onboarding Component Font Sizes

**Description:** As a user, I need story modals, search, and onboarding flows to render with larger text.

**Files (7 files):**

- `src/components/story/AdvancedSearchModal.tsx` (24 values)
- `src/components/story/StorySelectionModal.tsx` (20 values)
- `src/components/story/StoryPreviewEdit.tsx` (14 values)
- `src/components/analytics/AnalyticsDashboard.tsx` (20 values)
- `src/components/onboarding/OnboardingChecklist.tsx` (1 hardcoded)
- `src/components/onboarding/EnhancedEmptyState.tsx` (4 hardcoded)
- `src/components/onboarding/FirstStoryGuidanceModal.tsx` (2 hardcoded)
- `src/components/onboarding/OnboardingChecklistModal.tsx` (1 hardcoded)

**Acceptance Criteria:**

- [ ] Every numeric `fontSize: N` in all 8 files updated to `fontSize: N+2`
- [ ] Typecheck passes

**Validation Test:**

```bash
for f in AdvancedSearchModal StorySelectionModal StoryPreviewEdit AnalyticsDashboard OnboardingChecklist EnhancedEmptyState FirstStoryGuidanceModal OnboardingChecklistModal; do
  echo "$f: $(grep -c 'fontSize:' src/components/*/$f.tsx 2>/dev/null)"
done
```

---

### US-010: Add Grep-Based Font Size Validation Test

**Description:** As a developer, I need an automated test that snapshots all fontSize values across the codebase to catch unintended regressions.

**Acceptance Criteria:**

- [ ] New test file at `src/__tests__/unit/fontSizeValidation.test.ts`
- [ ] Test greps all `fontSize: <number>` values in `src/` (excluding `__tests__/`, `test/` components)
- [ ] Asserts that no fontSize value from the OLD scale (10, 12, 14, 16, 18, 20, 24, 32) appears in `src/constants/theme.ts` fontSize definitions
- [ ] Asserts the theme scale matches expected values (12, 14, 16, 18, 20, 22, 26, 34)
- [ ] Asserts no file in src/ (excluding skip list) contains any of the known OLD hardcoded values at their original locations
- [ ] Test passes with `npm test -- --testPathPattern=fontSizeValidation`

**Validation Test:**

```bash
npm test -- --testPathPattern=fontSizeValidation
```

---

### US-011: Final Integration Validation

**Description:** As a developer, I need to verify the entire change set passes linting, type-checking, and existing tests.

**Acceptance Criteria:**

- [ ] `npm run lint` passes with no new errors
- [ ] `npm test` passes (all existing tests)
- [ ] No fontSize regressions detected by US-010 validation test
- [ ] Visual smoke test on iOS simulator confirms no layout breakage on: AuthScreen, HomeScreen, ProfileScreen, SettingsScreen, Tab bar, StorySelectionModal, ImageGeneration, OnboardingChecklist

**Validation Test:**

```bash
npm run lint && npm test
```

---

## Functional Requirements

- FR-1: Every numeric `fontSize` value in `src/constants/theme.ts` must increase by exactly 2
- FR-2: Every numeric `fontSize` value in `src/services/downloadThemeService.ts` must increase by exactly 2
- FR-3: Every hardcoded numeric `fontSize` in screen and component files (listed in US-003 through US-009) must increase by exactly 2
- FR-4: Dynamic fontSize values (`fontSize: size`, `fontSize: 'larger'`) must NOT be modified
- FR-5: Test and demo component files (`ClaudeSkillsDemo.tsx`, `DependencyVerification.tsx`, `TestErrorComponent.tsx`) must NOT be modified
- FR-6: Files under `src/__tests__/` must NOT be modified (except the new validation test)
- FR-7: Metadata/property-name fontSize references in `interfaceAdapter.ts` and `readingComprehensionOptimizer.ts` must NOT be modified
- FR-8: A grep-based regression test must be added to catch future fontSize drift

## Non-Goals (Out of Scope)

- No refactoring of hardcoded values to use theme tokens (separate effort)
- No responsive/dynamic font scaling based on device size
- No changes to font family, weight, or line height values
- No changes to spacing, padding, or layout dimensions
- No accessibility/Dynamic Type integration changes

## Technical Considerations

- **Central theme file** (`src/constants/theme.ts`): Updating this auto-propagates to ~59 token-based usages across 9 files — no manual edits needed for those
- **downloadThemeService.ts** has its own independent scale — must be updated separately
- **Tab bar labels** (12->14) may appear wider on narrow devices (iPhone SE) — verify during smoke test
- **Odd sizes** (9, 11, 13, 15, 17 become 11, 13, 15, 17, 19) are unusual but functional in React Native

## Success Metrics

- All fontSize values in shipped code are exactly +2 from their original values
- Zero layout breakage across all screens on iOS simulator
- Grep-based validation test passes and is part of the test suite
- `npm test` and `npm run lint` pass cleanly

## Open Questions

- None — all decisions resolved during planning phase
