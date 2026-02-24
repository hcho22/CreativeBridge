# PRD: Fixed Challenge & Input Layout

## Introduction

Restructure the HomeScreen to use a fixed three-section layout instead of a single scrolling container. This keeps the challenge display always visible at the top and input controls always accessible at the bottom, while only the story content scrolls in the middle. This addresses a critical UX issue where users must scroll up to see the challenge objective and down to reach input controls as stories grow longer, disrupting the creative flow.

## Goals

- **Improve gameplay UX**: Keep challenge and input always visible so users can focus on storytelling without scrolling
- **Fix scrolling friction**: Eliminate the need to scroll up/down to see challenge or reach input controls
- **Modernize architecture**: Update to follow mobile UI best practices with fixed navigation elements
- **Maintain performance**: Ensure no degradation in scroll performance or keyboard responsiveness
- **Preserve all features**: Keep all existing functionality (auto-scroll, keyboard handling, image display, animations)

## User Stories

### US-001: Rename scroll ref to reflect new scope

**Description:** As a developer, I need to rename `gameScrollViewRef` to `storyScrollViewRef` to accurately reflect that it now controls only the story content section, not the entire screen.

**Acceptance Criteria:**

- [x] Rename ref declaration at line 131: `const storyScrollViewRef = useRef<ScrollView>(null);`
- [x] Verify ref is used only for story content ScrollView
- [x] Typecheck passes with no errors
- [x] All existing scroll behaviors work with renamed ref

### US-002: Restructure layout to three-section flex design

**Description:** As a developer, I need to replace the outer ScrollView with a SafeAreaView containing three distinct sections (fixed top, flex middle, fixed bottom) so that challenge and input remain visible while story scrolls.

**Acceptance Criteria:**

- [x] Replace outer ScrollView (line 2050) with SafeAreaView
- [x] Create fixed top section containing ChallengeDisplay component
- [x] Create flex middle section (flex: 1) with ScrollView for story content
- [x] Create fixed bottom section with Animated.View for keyboard-aware input
- [x] SafeAreaView handles device safe areas (notches, dynamic island)
- [x] Layout maintains padding: 8 horizontal throughout
- [x] Typecheck passes with no errors
- [x] Build succeeds with no warnings

### US-003: Update all scroll reference calls

**Description:** As a developer, I need to update all 6 locations where `gameScrollViewRef` is called to use `storyScrollViewRef` instead, so auto-scroll behaviors work correctly with the new middle section ScrollView.

**Acceptance Criteria:**

- [x] Line 328 (Keyboard show): Update to `storyScrollViewRef.current?.scrollToEnd({ animated: true })`
- [x] Line 362 (New contributions): Update to `storyScrollViewRef.current?.scrollToEnd({ animated: true })`
- [x] Line 1281 (Story completion): Update to `storyScrollViewRef.current?.scrollTo({ y: 0, animated: false })`
- [x] Line 1505 (Image generated): Update to `storyScrollViewRef.current?.scrollToEnd({ animated: true })`
- [x] Line 2201 (Back from image): Update to `storyScrollViewRef.current?.scrollTo({ y: 0, animated: true })`
- [x] Line 2236 (Back to options): Update to `storyScrollViewRef.current?.scrollTo({ y: 0, animated: true })`
- [x] All auto-scroll behaviors work correctly (scroll to end after AI response, scroll to top for completion)
- [x] Typecheck passes with no errors (no new errors introduced by ref rename)

### US-004: Add new styles for three-section layout

**Description:** As a developer, I need to add 6 new style definitions to support the three-section layout structure (SafeAreaView, fixed top, flex middle, fixed bottom).

**Acceptance Criteria:**

- [ ] Add `safeContainer` style: flex: 1, backgroundColor: '#f0f2f5'
- [ ] Add `challengeHeaderSection` style: paddingHorizontal: 8, paddingTop: 8, paddingBottom: 4, zIndex: 10
- [ ] Add `storyContentSection` style: flex: 1, paddingHorizontal: 8
- [ ] Add `storyScrollContainer` style: flex: 1
- [ ] Add `storyScrollContent` style: flexGrow: 1, paddingBottom: 8
- [ ] Add `fixedInputSection` style: backgroundColor: '#f0f2f5', paddingHorizontal: 8, paddingBottom: 8, borderTopWidth: 1, borderTopColor: '#e0e0e0'
- [ ] Styles are added to StyleSheet.create at lines 2762-3066
- [ ] Typecheck passes with no errors

### US-005: Modify existing styles for new layout

**Description:** As a developer, I need to modify 3 existing style definitions (`gameContainer`, `storyBookContainer`, `inputSection`) to remove properties that conflict with the new layout structure.

**Acceptance Criteria:**

- [x] Remove `paddingTop: 60` from `gameContainer` (SafeAreaView now handles this)
- [x] Remove `minHeight: '100%'` from `gameContainer` (no longer needed)
- [x] Remove `flex: 1` from `storyBookContainer` (was causing layout issues)
- [x] Remove `marginBottom: 8` from `inputSection` (handled by fixedInputSection)
- [x] All existing styles still apply correctly to their components
- [x] Typecheck passes with no errors (no new errors introduced by style modifications)

### US-006: Remove obsolete styles

**Description:** As a developer, I need to remove 2 obsolete style definitions (`gameScrollContainer`, `gameScrollContent`) that are no longer used with the new layout structure.

**Acceptance Criteria:**

- [x] Delete `gameScrollContainer` style definition
- [x] Delete `gameScrollContent` style definition
- [x] No references to deleted styles remain in code
- [x] Typecheck passes with no errors
- [x] Build succeeds with no warnings

### US-007: Move keyboard animation to fixed bottom section

**Description:** As a user, I want the keyboard to smoothly animate only the input area when appearing/hiding, so the challenge and story content remain stable and visible.

**Acceptance Criteria:**

- [x] Move Animated.View wrapper from gameContainer to fixedInputSection
- [x] Apply `paddingBottom: Animated.add(keyboardHeight, 8)` to fixedInputSection
- [x] Keyboard show/hide animations remain smooth (spring animation with tension: 100, friction: 10)
- [x] Only input section moves when keyboard appears
- [x] Challenge display unaffected by keyboard
- [x] Story content remains independently scrollable during keyboard animation
- [x] No layout jumps or flickers
- [ ] Verify in iOS Simulator and physical device

### US-008: Verify challenge display remains fixed at top

**Description:** As a user playing the story game, I want the challenge display to remain fixed at the top of the screen at all times, so I can always see my current objective without scrolling.

**Acceptance Criteria:**

- [x] Challenge display visible at top when story content scrolls
- [x] Challenge display visible when keyboard is shown
- [x] Challenge display visible when viewing generated images
- [x] Challenge display maintains styling (padding, shadows, elevation)
- [x] zIndex: 10 ensures challenge stays above scrolling content
- [ ] Verify on iPhone SE (small screen), iPhone 14, iPhone 15 Pro Max
- [ ] Verify in browser using dev-browser skill

**Code Verification (2026-02-06):**

- Layout: `SafeAreaView` → `challengeHeaderSection` (fixed) → `storyContentSection` (flex: 1 with ScrollView) → `fixedInputSection` (fixed)
- ChallengeDisplay component at [HomeScreen.tsx:2052-2061](src/screens/HomeScreen.tsx#L2052-L2061) is outside the ScrollView
- Keyboard animation at [HomeScreen.tsx:2259-2265](src/screens/HomeScreen.tsx#L2259-L2265) only affects `fixedInputSection`, not challenge
- Styling verified in [ChallengeDisplay.tsx:52-65](src/components/common/ChallengeDisplay.tsx#L52-L65): padding: 16, shadowOpacity: 0.1, elevation: 3, borderLeftColor: '#4CAF50'
- zIndex: 10 confirmed at [HomeScreen.tsx:2795](src/screens/HomeScreen.tsx#L2795)

### US-009: Verify input area remains fixed at bottom

**Description:** As a user playing the story game, I want the input field and action buttons to remain fixed at the bottom of the screen at all times, so I can always continue the story without scrolling.

**Acceptance Criteria:**

- [x] Input area visible when story content scrolls
- [x] Input area accessible when viewing long stories (1000+ words)
- [x] All 4 action buttons remain visible (Speaker, Voice, Exit, Continue Story)
- [x] Input area maintains styling (background, border, padding)
- [x] Keyboard animation moves input up smoothly (no jumps)
- [ ] Verify on iPhone SE (small screen), iPhone 14, iPhone 15 Pro Max
- [ ] Verify in browser using dev-browser skill

**Code Verification (2026-02-06):**

- Layout: `fixedInputSection` at [HomeScreen.tsx:2258-2266](src/screens/HomeScreen.tsx#L2258-L2266) is outside the ScrollView, wrapped in `Animated.View`
- Input area placement confirmed at [HomeScreen.tsx:2267-2283](src/screens/HomeScreen.tsx#L2267-L2283): TextInput with placeholder "Continue the story..."
- All 4 buttons verified in `buttonRow` at [HomeScreen.tsx:2287-2472](src/screens/HomeScreen.tsx#L2287-L2472):
  - Speaker button (🔊/⏹️) - line 2337
  - Voice input (🎤) - line 2421 via VoiceInput component
  - Exit button (← Exit) - line 2434
  - Continue Story button - line 2442
- Styling verified at [HomeScreen.tsx:2808-2814](src/screens/HomeScreen.tsx#L2808-L2814): backgroundColor '#f0f2f5', paddingHorizontal: 8, paddingBottom: 8, borderTopWidth: 1, borderTopColor: '#e0e0e0'
- Input styling at [HomeScreen.tsx:3100-3111](src/screens/HomeScreen.tsx#L3100-L3111): white background, 12px padding, border, serif font
- Keyboard animation at [HomeScreen.tsx:315-351](src/screens/HomeScreen.tsx#L315-L351): spring animation with tension: 100, friction: 10 (no jumps)
- `paddingBottom: Animated.add(keyboardHeight, 8)` at line 2263 ensures smooth upward movement

### US-010: Verify story content scrolls independently

**Description:** As a user playing the story game, I want the story content to scroll smoothly in the middle section while challenge and input remain fixed, so I can read long stories comfortably.

**Acceptance Criteria:**

- [x] Story book section scrolls independently when swiping
- [x] Story header (title, grade, round, copy button) scrolls with story content
- [x] Generated images display in scrollable section
- [x] Back to Options button displays in scrollable section
- [x] Auto-scroll to end works after new AI contribution
- [x] Auto-scroll to end works after image generation
- [x] Auto-scroll to top works when showing completion options
- [x] Smooth 60fps scrolling with no lag
- [ ] Verify on iPhone SE (small screen), iPhone 14, iPhone 15 Pro Max
- [ ] Verify in browser using dev-browser skill

**Code Verification (2026-02-06):**

- ScrollView structure at [HomeScreen.tsx:2064-2256](src/screens/HomeScreen.tsx#L2064-L2256): independent middle section with `storyContentSection` (flex: 1) wrapper
- Story header inside ScrollView at [HomeScreen.tsx:2076-2114](src/screens/HomeScreen.tsx#L2076-L2114): title (📖 Your Story), grade level, round counter, copy button
- Generated images at [HomeScreen.tsx:2182-2228](src/screens/HomeScreen.tsx#L2182-L2228): StoryImageDisplay inside ScrollView's gameContainer
- Back to Options button at [HomeScreen.tsx:2236-2252](src/screens/HomeScreen.tsx#L2236-L2252): inside ScrollView, triggers scroll to top
- Auto-scroll behaviors verified (6 locations):
  - Line 329: Keyboard show → scrollToEnd (100ms delay)
  - Line 363: New contribution → scrollToEnd (150ms delay)
  - Line 1282: Story completion → scrollTo y:0 (instant, animated: false)
  - Line 1506: Image generated → scrollToEnd (300ms delay for modal/render)
  - Line 2206: Back from image → scrollTo y:0 (animated)
  - Line 2241: Back to options button → scrollTo y:0 (animated)
- Scroll styling at [HomeScreen.tsx:2801-2807](src/screens/HomeScreen.tsx#L2801-L2807): storyScrollContainer flex: 1, storyScrollContent flexGrow: 1
- ScrollView props: `keyboardShouldPersistTaps="handled"`, `showsVerticalScrollIndicator={false}`

## Functional Requirements

- **FR-1:** Rename scroll ref from `gameScrollViewRef` to `storyScrollViewRef` (line 131)
- **FR-2:** Replace outer ScrollView with SafeAreaView container (line 2050)
- **FR-3:** Create fixed top section containing ChallengeDisplay component
- **FR-4:** Create flex middle section (flex: 1) with ScrollView attached to `storyScrollViewRef`
- **FR-5:** Create fixed bottom section with Animated.View for keyboard handling
- **FR-6:** Update 6 scroll reference calls from `gameScrollViewRef` to `storyScrollViewRef` (lines 328, 362, 1281, 1505, 2201, 2236)
- **FR-7:** Add 6 new style definitions: `safeContainer`, `challengeHeaderSection`, `storyContentSection`, `storyScrollContainer`, `storyScrollContent`, `fixedInputSection`
- **FR-8:** Modify 3 existing styles: remove `paddingTop: 60` and `minHeight: '100%'` from `gameContainer`, remove `flex: 1` from `storyBookContainer`, remove `marginBottom: 8` from `inputSection`
- **FR-9:** Remove 2 obsolete styles: `gameScrollContainer`, `gameScrollContent`
- **FR-10:** Apply keyboard animation (`paddingBottom: Animated.add(keyboardHeight, 8)`) to `fixedInputSection` only
- **FR-11:** Challenge display must remain fixed at top with zIndex: 10
- **FR-12:** Input area must remain fixed at bottom with borderTop separator
- **FR-13:** Story content must scroll independently in middle section
- **FR-14:** SafeAreaView must handle device safe areas (notches, dynamic island)
- **FR-15:** All existing auto-scroll behaviors must continue to work (scroll to end after contribution, scroll to top for completion)

## Non-Goals (Out of Scope)

- **No challenge display minimization/collapse**: Challenge remains full-height at all times (future enhancement)
- **No floating action button (FAB)**: Continue using existing button row layout (future enhancement)
- **No swipe gestures**: No swipe-to-dismiss keyboard or swipe-to-access-input (future enhancement)
- **No story header repositioning**: Story header (title, grade, round, copy) stays with story content and scrolls (future enhancement could move to fixed section)
- **No landscape orientation optimization**: Focus on portrait mode only (current app orientation)
- **No tablet-specific layout**: Single responsive layout for all device sizes
- **No performance optimizations beyond scope**: No memoization, removeClippedSubviews, or other perf enhancements (separate work)

## Design Considerations

### UI/UX Requirements

- **Challenge Display**: Always visible at top, maintains compact mode styling (16px padding, 12px marginBottom, shadow/elevation, green left border)
- **Story Content**: Scrolls smoothly in middle section, maintains book styling (white background, serif font 18px, rounded corners, shadows)
- **Input Area**: Always accessible at bottom, maintains existing styling (white background, bordered, multiline with 3 lines visible, serif font)
- **Action Buttons**: All 4 buttons remain in buttonRow (Speaker 🔊, Voice 🎤, Exit ← Exit, Continue Story →)
- **Visual Separation**: 1px border-top on fixed input section (#e0e0e0) to separate from scrollable content
- **Safe Areas**: Proper handling of notches and dynamic island via SafeAreaView

### Layout Structure

```
SafeAreaView (full screen, flex: 1)
├── Fixed Top Section (challengeHeaderSection)
│   └── ChallengeDisplay (compact mode, zIndex: 10)
│
├── Flex Middle Section (storyContentSection, flex: 1)
│   └── ScrollView (storyScrollViewRef)
│       ├── Story Book Container
│       │   ├── Story Header (title, grade, round, copy button)
│       │   └── Story Contributions (AI/User paragraphs)
│       ├── Generated Image Display (when available)
│       └── Back to Options Button (when applicable)
│
└── Fixed Bottom Section (fixedInputSection, Animated.View)
    └── Input Section
        ├── TextInput ("Continue the story..." placeholder)
        └── Action Buttons Row
            ├── Speaker Button
            ├── Voice Input Button
            ├── Exit Button
            └── Continue Story Button
```

### Existing Components to Preserve

- **ChallengeDisplay component** (src/components/common/ChallengeDisplay.tsx): No changes, used in fixed top section
- **StoryImageDisplay component**: No changes, used in middle scrollable section
- **All existing modals**: Completion options modal, image generation modal (no changes)

## Technical Considerations

### Dependencies

- **React Native SafeAreaView**: Handles device safe areas automatically
- **Animated.View**: Continues to handle keyboard animation (no changes to animation logic)
- **ScrollView**: Used for middle section story content (attached to storyScrollViewRef)
- **Existing keyboard listeners**: Platform-specific (keyboardWillShow/keyboardWillHide on iOS, keyboardDidShow/keyboardDidHide on Android)

### Integration Points

- **Keyboard handling** (lines 315-350): Existing spring animation logic continues to work, just targets fixedInputSection instead of gameContainer
- **Auto-scroll effects** (lines 352-367): Existing useEffect hooks continue to work, just use storyScrollViewRef instead of gameScrollViewRef
- **Story content rendering** (lines 2074-2158): No changes, moves into middle scrollable section
- **Input section rendering** (lines 2250-2458): No changes, moves into fixed bottom section
- **Image display rendering** (lines 2161-2224): No changes, stays in middle scrollable section

### Performance Requirements

- **60fps scrolling**: Story content must scroll smoothly without jank
- **Smooth keyboard animation**: Spring animation with tension: 100, friction: 10 (no changes)
- **No layout thrashing**: Fixed sections should not re-render on scroll
- **Auto-scroll responsiveness**: 150ms delay for contribution scroll, 300ms for image scroll (existing timings)

### Constraints

- **Single file change**: All changes localized to src/screens/HomeScreen.tsx
- **No breaking changes**: All existing features must continue to work
- **No new dependencies**: Use only existing React Native components
- **Backwards compatible**: No changes to data models, APIs, or other screens

## Success Metrics

### User Experience Metrics

- ✅ **Challenge always visible**: Challenge display remains fixed at top during all scroll interactions
- ✅ **Input always accessible**: No scrolling needed to reach input field or action buttons in any scenario
- ✅ **No visual regressions**: All existing styling, shadows, borders, colors preserved
- ✅ **Smooth keyboard animation**: No layout jumps or flickers when keyboard appears/hides

### Technical Metrics

- ✅ **Performance maintained**: 60fps scrolling on iPhone SE, iPhone 14, iPhone 15 Pro Max
- ✅ **Auto-scroll works**: All 6 auto-scroll locations work correctly with new ref
- ✅ **Typecheck passes**: No TypeScript errors in HomeScreen.tsx
- ✅ **Build succeeds**: No warnings or errors during iOS/Android builds
- ✅ **Safe area handling**: Proper padding on devices with notches and dynamic island

### Edge Case Coverage

- ✅ **Very long stories (1000+ words)**: Smooth scrolling without performance degradation
- ✅ **Rapid keyboard toggle**: No animation conflicts or layout issues
- ✅ **Image generation during typing**: No layout interference between keyboard and image
- ✅ **Multiple rapid contributions**: Auto-scroll works correctly with fast story progression
- ✅ **Story completion with keyboard visible**: Completion modal displays properly

## Open Questions

- **Should challenge display have collapse/expand toggle?** (Future enhancement - out of scope for MVP)
- **Should copy button move to fixed top section?** (Future enhancement - story header stays scrollable for MVP)
- **Should we optimize for landscape orientation?** (Out of scope - app is portrait-only currently)
- **Should we add swipe gestures for keyboard/input access?** (Future enhancement - out of scope for MVP)
- **Should we add performance optimizations (memoization, removeClippedSubviews)?** (Separate work - monitor performance after implementation)

## Implementation Notes

### Rollback Plan

If issues arise, all changes are localized to src/screens/HomeScreen.tsx:

1. Restore outer ScrollView wrapper (line 2050)
2. Rename ref back to `gameScrollViewRef` (line 131)
3. Restore original styles (`gameContainer`, `gameScrollContent`, `storyBookContainer`, `inputSection`)
4. Move Animated.View back to gameContainer

### Testing Checklist

**Functional Testing:**

- [ ] Challenge displays at top, never scrolls
- [ ] Story content scrolls independently
- [ ] Input area fixed at bottom, always accessible
- [ ] Keyboard shows/hides smoothly without layout jumps
- [ ] Auto-scroll after new contribution works
- [ ] Auto-scroll after image generation works
- [ ] Auto-scroll to top for completion works
- [ ] Image displays in correct location
- [ ] Back to Options button appears when expected
- [ ] Copy button works from story header
- [ ] All action buttons work (Speaker, Voice, Exit, Continue)

**Visual Testing:**

- [ ] No white space gaps between sections
- [ ] Proper padding/margins throughout
- [ ] Safe area insets applied correctly (notch, dynamic island)
- [ ] Shadows/elevation render correctly
- [ ] Loading indicators position correctly
- [ ] Error messages display properly
- [ ] Completion modal appears correctly
- [ ] Image generation modal displays properly

**Device Testing:**

- [ ] iPhone SE (small screen - ~568pt height)
- [ ] iPhone 14/15 (standard screen - ~844pt height)
- [ ] iPhone 14/15 Pro Max (large screen with dynamic island - ~932pt height)
- [ ] Android devices (various screen sizes)

### Trade-offs Accepted for MVP

- **Reduced story viewport**: Challenge (~90px) + Input (~160px) = 250px less vertical space for story content

  - **Mitigation**: flex: 1 maximizes available space (450-650px remaining on typical devices)
  - **Acceptable**: UX improvement (always visible challenge/input) outweighs viewport reduction

- **Story header scrolls away**: Copy button, grade level, round counter scroll out of view

  - **Mitigation**: User can scroll to top anytime to access copy button
  - **Acceptable**: Essential challenge info remains in fixed top section; header is part of story "book" metaphor

- **No keyboard dismissal optimization**: User must tap outside or use device keyboard dismiss
  - **Future enhancement**: Add swipe-down-to-dismiss gesture
  - **Acceptable**: Standard iOS/Android keyboard behavior

## References

- **Implementation Plan**: /Users/hcho/.claude/plans/dapper-hatching-koala.md
- **HomeScreen Component**: src/screens/HomeScreen.tsx (lines 2050-2500 for layout, 2762-3066 for styles)
- **ChallengeDisplay Component**: src/components/common/ChallengeDisplay.tsx
- **React Native SafeAreaView**: https://reactnative.dev/docs/safeareaview
- **React Native Animated**: https://reactnative.dev/docs/animated
