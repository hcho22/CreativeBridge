# PRD: Background Image for All Screens

## Introduction

The app currently uses a flat `#fcfcfc` background color on every screen, resulting in a visually plain experience. This feature adds a full-screen JPG background image behind all screen content using a shared `ScreenBackground` wrapper component. Card and section containers will use semi-transparent backgrounds (`rgba(255, 255, 255, 0.85)`) so the image subtly shows through. The existing glass morphism effects on the tab bar and navigation headers will naturally blur the background image, enhancing the layered visual design.

## Goals

- Display a consistent background image across every screen in the app (including screens rendered outside NavigationContainer)
- Maintain text and content readability with semi-transparent card overlays
- Preserve existing glass morphism effects on tab bar, headers, and floating input bar
- Zero performance regressions — single cached bitmap shared across all screens
- Create a reusable `ScreenBackground` component for clean abstraction

## User Stories

### US-001: Place background image asset

**Description:** As a developer, I need the background JPG placed in the correct asset directory so it can be bundled by Metro at build time.

**Acceptance Criteria:**

- [ ] Background JPG file exists at `assets/background.jpg`
- [ ] Image is appropriately sized (~1080x1920px, 70-80% JPEG quality, 200-400KB)

**Validation Test:**

- [ ] Run `ls assets/background.jpg` and confirm the file exists
- [ ] Run `file assets/background.jpg` to confirm it is a valid JPEG
- [ ] Verify file size is under 500KB with `ls -lh assets/background.jpg`

---

### US-002: Create ScreenBackground wrapper component

**Description:** As a developer, I want a shared `ScreenBackground` component that renders a full-screen background image behind children, so every screen can use it consistently.

**Acceptance Criteria:**

- [ ] New file created at `src/components/common/ScreenBackground.tsx`
- [ ] Uses `ImageBackground` from `react-native` with `resizeMode="cover"` and `flex: 1`
- [ ] Loads image via static `require('../../../assets/background.jpg')`
- [ ] Exports `ScreenBackgroundProps` interface with optional `source`, `style`, and required `children` props
- [ ] Does NOT include SafeAreaView or inset handling (screens manage their own)
- [ ] Typecheck passes

**Validation Test:**

- [ ] Run `npx tsc --noEmit` — no TypeScript errors related to `ScreenBackground`
- [ ] Run `npm test -- --testPathPattern=ScreenBackground` — component renders children correctly (create snapshot test)
- [ ] Verify the component file exports match: `ScreenBackground` (named), `ScreenBackgroundProps` (interface), `default` (default export)

---

### US-003: Apply background to HomeScreen

**Description:** As a user, I want to see the background image on the Home screen (both the default home view and the active game view) so the app feels visually rich.

**Acceptance Criteria:**

- [ ] Import `ScreenBackground` in `src/screens/HomeScreen.tsx`
- [ ] Both render paths (game-active view and default home view) wrapped with `<ScreenBackground>`
- [ ] `safeContainer` style: `backgroundColor` changed to `'transparent'`
- [ ] `container` style: `backgroundColor` changed to `'transparent'`
- [ ] `storyBook` style: `backgroundColor` changed to `'rgba(252, 252, 252, 0.85)'`
- [ ] Other card/section backgrounds changed to `'rgba(255, 255, 255, 0.85)'`
- [ ] Input fields and interactive elements remain opaque
- [ ] Typecheck passes

**Validation Test:**

- [ ] Run `npx tsc --noEmit` — no errors
- [ ] Run `npm test -- --testPathPattern=HomeScreen` — existing tests pass
- [ ] Run on iOS simulator: background image visible on home screen, text readable, glass tab bar blurs image
- [ ] Navigate to active game view: background visible, story book content readable over semi-transparent overlay

---

### US-004: Apply background to SettingsScreen

**Description:** As a user, I want to see the background image on the Settings screen with semi-transparent card sections.

**Acceptance Criteria:**

- [ ] Import `ScreenBackground` in `src/screens/SettingsScreen.tsx`
- [ ] Root `<View style={styles.container}>` wrapped with `<ScreenBackground>`
- [ ] `container` style: `backgroundColor` changed to `'transparent'`
- [ ] Section card backgrounds changed to `'rgba(255, 255, 255, 0.85)'`
- [ ] Typecheck passes

**Validation Test:**

- [ ] Run `npx tsc --noEmit` — no errors
- [ ] Run `npm test -- --testPathPattern=SettingsScreen` — existing tests pass (if any)
- [ ] Run on iOS simulator: navigate to Settings tab — background image visible, settings sections semi-transparent, text readable

---

### US-005: Apply background to ProfileScreen

**Description:** As a user, I want to see the background image on the Profile screen with semi-transparent card sections.

**Acceptance Criteria:**

- [ ] Import `ScreenBackground` in `src/screens/ProfileScreen.tsx`
- [ ] Root `<View style={styles.container}>` wrapped with `<ScreenBackground>`
- [ ] `container` style: `backgroundColor` changed to `'transparent'`
- [ ] Section card backgrounds changed to `'rgba(255, 255, 255, 0.85)'`
- [ ] Typecheck passes

**Validation Test:**

- [ ] Run `npx tsc --noEmit` — no errors
- [ ] Run `npm test -- --testPathPattern=ProfileScreen` — existing tests pass (if any)
- [ ] Run on iOS simulator: navigate to Profile tab — background image visible, profile sections semi-transparent, text readable

---

### US-006: Apply background to AuthScreen

**Description:** As a user, I want to see the background image on all auth screens (login, signup, profile setup steps) so the experience feels polished from the first interaction.

**Acceptance Criteria:**

- [ ] Import `ScreenBackground` in `src/screens/AuthScreen.tsx`
- [ ] All 6 return statements wrapped with `<ScreenBackground>` outside `KeyboardAvoidingView`
- [ ] `container` style: `backgroundColor` changed to `'transparent'`
- [ ] Auth card/form containers changed to `'rgba(255, 255, 255, 0.85)'`
- [ ] Input fields remain opaque for usability
- [ ] Typecheck passes

**Validation Test:**

- [ ] Run `npx tsc --noEmit` — no errors
- [ ] Run `npm test -- --testPathPattern=AuthScreen` — existing tests pass (if any)
- [ ] Run on iOS simulator: log out and verify background image visible on auth screen
- [ ] Open keyboard on auth screen: background remains stable, no layout jumps

---

### US-007: Apply background to ProfileCompletionScreen

**Description:** As a user, I want to see the background image during profile completion (rendered outside NavigationContainer).

**Acceptance Criteria:**

- [ ] Import `ScreenBackground` in `src/screens/ProfileCompletionScreen.tsx`
- [ ] Root `KeyboardAvoidingView` wrapped with `<ScreenBackground>`
- [ ] `container` style: `backgroundColor` changed to `'transparent'`
- [ ] Form containers changed to `'rgba(255, 255, 255, 0.85)'`
- [ ] Input fields remain opaque
- [ ] Typecheck passes

**Validation Test:**

- [ ] Run `npx tsc --noEmit` — no errors
- [ ] Run `npm test -- --testPathPattern=ProfileCompletion` — existing tests pass (if any)
- [ ] Run on iOS simulator: trigger profile completion flow — background visible, form readable

---

### US-008: Apply background to Import screens

**Description:** As a user, I want to see the background image on the ImportOptions, StorySelection, and StoryPreviewEdit screens.

**Acceptance Criteria:**

- [ ] Import `ScreenBackground` in all three files:
  - `src/screens/ImportOptionsScreen.tsx` — wrap outside `SafeAreaView`
  - `src/screens/StorySelectionScreen.tsx` — wrap both render paths (error + normal)
  - `src/screens/StoryPreviewEditScreen.tsx` — wrap both render paths outside `SafeAreaView`
- [ ] Container `backgroundColor` changed to `'transparent'` in all three
- [ ] Card/section backgrounds changed to `'rgba(255, 255, 255, 0.85)'`
- [ ] Typecheck passes

**Validation Test:**

- [ ] Run `npx tsc --noEmit` — no errors
- [ ] Run `npm test` — no test regressions across the suite
- [ ] Run on iOS simulator: navigate Home → ImportOptions → StorySelection → StoryPreviewEdit — background visible on each screen, content readable

---

### US-009: Apply background to StoryQuestImportScreen

**Description:** As a user, I want to see the background image on the Story Quest import screen.

**Acceptance Criteria:**

- [ ] Import `ScreenBackground` in `src/screens/StoryQuestImportScreen.tsx`
- [ ] Root `SafeAreaView` wrapped with `<ScreenBackground>`
- [ ] `safeArea` style: `backgroundColor` changed to `'transparent'`
- [ ] Card/content backgrounds changed to `'rgba(255, 255, 255, 0.85)'`
- [ ] Typecheck passes

**Validation Test:**

- [ ] Run `npx tsc --noEmit` — no errors
- [ ] Run `npm test -- --testPathPattern=StoryQuestImport` — existing tests pass (if any)
- [ ] Run on iOS simulator: navigate to Story Quest import — background visible, content readable

---

### US-010: StatusBar and final visual QA

**Description:** As a developer, I need to ensure the StatusBar styling works with the background image and perform a final visual QA pass across all screens.

**Acceptance Criteria:**

- [ ] `App.tsx` StatusBar `barStyle` updated if needed based on background image brightness (dark image → `"light-content"`, light image → `"dark-content"`)
- [ ] On Android: `translucent={true}` and `backgroundColor="transparent"` set if needed
- [ ] Glass effects on tab bar, navigation headers, and floating input bar correctly blur the background image
- [ ] No white flash during tab switches or stack navigation transitions
- [ ] Modals (CelebrationModal, etc.) layer correctly above the background
- [ ] All screens pass visual review

**Validation Test:**

- [ ] Run `npm test` — full test suite passes with zero regressions
- [ ] Run `npx tsc --noEmit` — zero TypeScript errors
- [ ] Run `npm run lint` — no new lint warnings
- [ ] iOS simulator walkthrough: navigate every screen, switch tabs, open/close modals, trigger keyboard
- [ ] Verify navigation transitions: tab switches and stack push/pop — background stable, no flicker
- [ ] Test on at least 2 device sizes (iPhone SE + iPhone 15 Pro Max or equivalent)

## Functional Requirements

- FR-1: A `ScreenBackground` component must exist at `src/components/common/ScreenBackground.tsx` that renders `ImageBackground` with `resizeMode="cover"` and `flex: 1`
- FR-2: The background image must be loaded via static `require()` for Metro bundling and RN bitmap caching
- FR-3: All 9 screen files must use `<ScreenBackground>` as their outermost wrapper
- FR-4: All screen container `backgroundColor` values must be changed to `'transparent'`
- FR-5: Card and section containers must use `rgba(255, 255, 255, 0.85)` for semi-transparency
- FR-6: Input fields and interactive elements must remain fully opaque
- FR-7: The `ScreenBackground` component must not include SafeAreaView or inset handling
- FR-8: Glass morphism effects (tab bar, headers, floating input) must remain unchanged and naturally blur the background image

## Non-Goals (Out of Scope)

- No dark mode variant of the background image
- No per-screen background image customization (all screens share the same image)
- No animated or parallax background effects
- No changes to the glass morphism `AdaptiveGlassBackground` component
- No changes to the navigation structure or screen hierarchy
- No landscape orientation handling (app is portrait-only)

## Technical Considerations

- **Performance**: Static `require()` image is decoded once and cached — same reference across all screens means shared bitmap, no re-decoding on navigation
- **Memory**: Expected ~5-15MB overhead for decoded bitmap (acceptable for a single background)
- **Existing component pattern**: Follow the same conventions as `AdaptiveGlassBackground.tsx` in `src/components/common/`
- **Reuse**: `commonStyles.container` from `src/utils/styles.ts` may reference `theme.colors.background` — individual screen styles override this, so no change needed to the shared styles utility
- **TypeScript**: Expo/Metro handles `.jpg` module resolution natively. Only add a `declare module '*.jpg'` in `src/types/` if TypeScript compilation errors occur

## Success Metrics

- Background image visible on 100% of app screens (9 screens + auth flow)
- Zero TypeScript errors (`npx tsc --noEmit`)
- Zero test regressions (`npm test`)
- No perceptible frame drops during navigation transitions
- Text readability maintained across all screens with semi-transparent cards

## Open Questions

- What is the exact background image the user will provide? (dimensions, brightness, dominant colors will affect StatusBar `barStyle` choice)
- Should the background image extend behind the Android status bar or stop below it?
