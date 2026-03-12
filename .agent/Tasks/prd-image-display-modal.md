# PRD: Image Display Modal — Separate Generated Image from Story Body

## Introduction

When a user generates an image for their completed story, the `StoryImageDisplay` component currently renders **inline** at the bottom of the story ScrollView. This means the image permanently occupies space in the story body and cannot be dismissed. The same problem occurs when continuing a story from the database that already has a generated image — the image appears inline immediately with no way to close it.

This feature extracts the image display into a **dedicated, dismissable modal component** (`ImageDisplayModal`) that overlays the story screen. The image is accessible only through the CompletionOptions panel ("View Generated Image" button), keeping the story body clean and focused on text.

## Goals

- Remove inline image rendering from the story body ScrollView
- Create a new `ImageDisplayModal` component that wraps `StoryImageDisplay` in a dismissable overlay
- Provide clear dismiss behavior: backdrop tap returns to story, "Back to Options" button returns to CompletionOptions
- Replace the "Generate Image" button with "View Generated Image" after an image exists (no re-generation)
- Maintain all existing image functionality (save, share, upload status, retry) without modifying `StoryImageDisplay`

## User Stories

---

### US-001: Create ImageDisplayModal Component

**Description:** As a developer, I need a dedicated modal component that wraps `StoryImageDisplay` in a dismissable overlay, so the image display is decoupled from the story body and reusable.

**Acceptance Criteria:**

- [x] Create `src/components/common/ImageDisplayModal.tsx` as a new component
- [x] Component accepts props:
  - `visible: boolean` — controls modal visibility
  - `onClose: () => void` — called on backdrop tap (dismiss to story)
  - `onBackToOptions: () => void` — called when "Back to Options" is pressed (dismiss to CompletionOptions)
  - `replicateUrl?: string` — temporary Replicate image URL
  - `supabaseUrl?: string` — permanent Supabase storage URL
  - `uploadStatus?: string` — image upload status
  - `storyTitle: string` — story title for display
  - `sessionId: string` — session ID
  - `userId: string` — user ID
  - `onRetryUpload?: () => void` — retry upload handler
  - `onImageSaved?: (localPath: string) => void` — local save callback
  - `onError?: (error: string) => void` — error callback
- [x] When `visible` is `false`, component renders `null` (no DOM)
- [x] Overlay uses `Pressable` + `AdaptiveGlassBackground` pattern matching the existing `imageGenerationModalOverlay` style in HomeScreen
- [x] Inner content uses `Pressable` with `e.stopPropagation()` to prevent backdrop dismissal when tapping the image area
- [x] Renders `StoryImageDisplay` inside a `ScrollView` with `showBackButton={true}`, `displayMode="responsive"`, `enableFullScreen={false}`
- [x] Backdrop tap calls `onClose` directly (no confirmation dialog — passive viewing)
- [x] "Back to Options" button inside `StoryImageDisplay` calls `onBackToOptions`
- [x] Component is self-contained with its own `StyleSheet` (can reuse style values from HomeScreen's overlay patterns)
- [x] Typecheck passes: `npx tsc --noEmit`
- [x] Lint passes: `npm run lint`

**Validation Test:**

```
Test file: src/__tests__/components/ImageDisplayModal.test.tsx

1. Run `npx tsc --noEmit` — no type errors
2. Run `npm run lint` — no lint errors
3. Write unit tests verifying:
   a. Component renders null when visible={false}
   b. Component renders StoryImageDisplay when visible={true} with valid props
   c. Backdrop Pressable onPress calls onClose
   d. StoryImageDisplay receives correct props (replicateUrl, supabaseUrl, uploadStatus, etc.)
   e. onBackToOptions is wired to StoryImageDisplay's onBackToOptions prop
   f. Inner Pressable stops event propagation (tap on image area does not dismiss)
4. Run `npm test -- --testPathPattern=ImageDisplayModal` — all tests pass
```

---

### US-002: Integrate ImageDisplayModal into HomeScreen

**Description:** As a developer, I need to add the `ImageDisplayModal` to HomeScreen with proper state management, so the modal can be opened and closed through the existing game flow.

**Acceptance Criteria:**

- [x] Add `showImageDisplayModal` state variable (`useState<boolean>(false)`) to HomeScreen near existing modal states (~line 163)
- [x] Import `ImageDisplayModal` from `src/components/common/ImageDisplayModal`
- [x] Render `<ImageDisplayModal>` in the HomeScreen JSX, after the existing `{/* Image Generation Modal Overlay */}` block (~after line 3216)
- [x] Wire props:
  - `visible={showImageDisplayModal}`
  - `onClose={() => setShowImageDisplayModal(false)}`
  - `onBackToOptions={() => { setShowImageDisplayModal(false); setShowCompletionOptions(true); }}`
  - `replicateUrl={generatedImageUrl || currentSession?.generated_image_url || undefined}`
  - `supabaseUrl={currentSession?.supabase_image_url || undefined}`
  - `uploadStatus={currentSession?.image_upload_status}`
  - `storyTitle` derived from `currentSession?.story_content` (first 6 words + "...")
  - `sessionId={currentSession?.id || ''}`
  - `userId={effectiveUserId || ''}`
  - `onRetryUpload={handleRetryImageUpload}`
  - `onImageSaved` callback that calls `storySessionManager.updateSessionWithLocalImage`
  - `onError` callback that logs the error
- [x] Typecheck passes: `npx tsc --noEmit`
- [x] Lint passes: `npm run lint`

**Validation Test:**

```
1. Run `npx tsc --noEmit` — no type errors
2. Run `npm run lint` — no lint errors
3. Manual verification in simulator:
   a. Set showImageDisplayModal to true via React DevTools → modal overlay appears
   b. Tap backdrop → modal closes, story body visible
   c. Tap "Back to Options" in modal → modal closes, CompletionOptions opens
4. Run existing HomeScreen tests: `npm test -- --testPathPattern=HomeScreen` — no regressions
```

---

### US-003: Remove Inline Image Display from Story Body

**Description:** As a user, I want the story body to show only text content, so the generated image does not permanently occupy space in my story view.

**Acceptance Criteria:**

- [x] Delete the entire `{/* Generated Image Display */}` block in HomeScreen (~lines 2727-2796) that conditionally renders `<StoryImageDisplay>` inside the story ScrollView
- [x] Remove the associated debug logging IIFE (the `(() => { ... shouldShowImage ... })()` pattern)
- [x] The story ScrollView now contains only: StoryBookContainer (with contributions/text) and the "Back to Options" button — no image
- [x] Verify no orphaned style references: `imageDisplayContainerOverlay` style can remain (unused is acceptable) or be removed
- [x] Typecheck passes: `npx tsc --noEmit`
- [x] Lint passes: `npm run lint`

**Validation Test:**

```
1. Run `npx tsc --noEmit` — no type errors
2. Run `npm run lint` — no lint errors
3. Manual verification in simulator:
   a. Complete a story and generate an image
   b. Dismiss the image modal
   c. Scroll through the story body — NO image visible inline
   d. Story text renders cleanly without image breaking the layout
4. Run existing tests: `npm test -- --testPathPattern=HomeScreen` — no regressions
```

---

### US-004: Wire handleImageGenerated to Open Image Display Modal

**Description:** As a user, after the AI generates my story image, I want to see it immediately in a modal overlay so I can save or share it, and then dismiss it when done.

**Acceptance Criteria:**

- [ ] In `handleImageGenerated` callback (~line 2016), after `setShowImageGeneration(false)` (line 2022), add `setShowImageDisplayModal(true)`
- [ ] Remove the `setTimeout` auto-scroll-to-bottom block (~lines 2064-2067) since the image is no longer inline in the ScrollView
- [ ] Flow after generation: ImageGeneration modal closes → Image Display Modal opens automatically
- [ ] All existing behavior preserved: `generatedImageUrl` state set, session reloaded from DB, first-image celebration check
- [ ] Typecheck passes: `npx tsc --noEmit`
- [ ] Lint passes: `npm run lint`

**Validation Test:**

```
1. Run `npx tsc --noEmit` — no type errors
2. Run `npm run lint` — no lint errors
3. Manual verification in simulator:
   a. Complete a story → open CompletionOptions → tap "Generate Image"
   b. Wait for generation to complete
   c. ImageGeneration modal closes automatically
   d. ImageDisplayModal appears immediately showing the generated image
   e. Image has Save/Share buttons and upload status
   f. Tap backdrop → modal dismisses, story body visible (no inline image)
   g. Tap "Back to Options" → modal dismisses, CompletionOptions reappears
4. Run existing tests: `npm test -- --testPathPattern=HomeScreen` — no regressions
```

---

### US-005: Update CompletionOptions — Conditional Generate vs View Button

**Description:** As a user who has already generated an image, I want to see a "View Generated Image" button in the CompletionOptions instead of "Generate Image", so I can re-view my image without re-generating.

**Acceptance Criteria:**

- [ ] Replace the static "Generate Image" `TouchableOpacity` (~lines 3122-3129) with a conditional:
  - **If image exists** (`generatedImageUrl || currentSession?.generated_image_url || currentSession?.supabase_image_url`): render a "View Generated Image" button with icon text `🖼️ View Generated Image`
  - **If no image exists**: render the existing "Generate Image" button with icon text `🎨 Generate Image`
- [ ] "View Generated Image" `onPress`: `setShowCompletionOptions(false); setShowImageDisplayModal(true);`
- [ ] "Generate Image" `onPress`: unchanged (`handleImageGeneration`)
- [ ] Both buttons use the same `styles.completionOptionButton` style
- [ ] Typecheck passes: `npx tsc --noEmit`
- [ ] Lint passes: `npm run lint`

**Validation Test:**

```
1. Run `npx tsc --noEmit` — no type errors
2. Run `npm run lint` — no lint errors
3. Manual verification in simulator:
   a. Complete a story → CompletionOptions shows "🎨 Generate Image" button
   b. Generate an image → dismiss modal → reopen CompletionOptions
   c. CompletionOptions now shows "🖼️ View Generated Image" instead
   d. Tap "View Generated Image" → CompletionOptions closes, ImageDisplayModal opens with the image
   e. Continue a completed story from the database that has an existing image
   f. CompletionOptions shows "🖼️ View Generated Image" (not "Generate Image")
   g. Tap it → ImageDisplayModal opens with the saved image
4. Run existing tests: `npm test -- --testPathPattern=HomeScreen` — no regressions
```

---

### US-006: Update Back to Options Button Condition

**Description:** As a user viewing my completed story, I want to see the "Back to Options" button whenever no modal is active, even if I've already generated an image.

**Acceptance Criteria:**

- [ ] Change the "Back to Options" button visibility condition (~lines 2798-2802) from:
  ```tsx
  isGameCompleted &&
    !showCompletionOptions &&
    !showImageGeneration &&
    !(generatedImageUrl || currentSession?.generated_image_url);
  ```
  To:
  ```tsx
  isGameCompleted &&
    !showCompletionOptions &&
    !showImageGeneration &&
    !showImageDisplayModal;
  ```
- [ ] The button is now visible whenever the game is completed and no modal overlay is active, regardless of whether an image has been generated
- [ ] Button behavior unchanged: scrolls to top + opens CompletionOptions
- [ ] Typecheck passes: `npx tsc --noEmit`
- [ ] Lint passes: `npm run lint`

**Validation Test:**

```
1. Run `npx tsc --noEmit` — no type errors
2. Run `npm run lint` — no lint errors
3. Manual verification in simulator:
   a. Complete a story → generate an image → dismiss image modal
   b. "← Back to Options" button is visible at the bottom of the story body
   c. Tap it → CompletionOptions modal opens
   d. Previously (before this fix), the button was hidden after image generation — confirm it now shows
4. Run existing tests: `npm test -- --testPathPattern=HomeScreen` — no regressions
```

---

### US-007: Reset Modal State on Exit and Wire Celebration CTA

**Description:** As a developer, I need to ensure the image display modal state resets properly on exit, and the first-image celebration "View My Illustration" CTA opens the image display modal.

**Acceptance Criteria:**

- [ ] In `exitGame()` function (~line 1918), add `setShowImageDisplayModal(false)` alongside the existing `setGeneratedImageUrl(null)` reset
- [ ] In `handleFirstImageCelebrationCta` callback (~line 1969), after `setShowFirstImageCelebration(false)`, add `setShowImageDisplayModal(true)`
- [ ] Flow for first-ever image: generation completes → celebration modal appears → user taps "View My Illustration" → celebration closes → ImageDisplayModal opens
- [ ] Exiting the game while modal is open does not leave stale state
- [ ] Typecheck passes: `npx tsc --noEmit`
- [ ] Lint passes: `npm run lint`

**Validation Test:**

```
1. Run `npx tsc --noEmit` — no type errors
2. Run `npm run lint` — no lint errors
3. Manual verification in simulator:
   a. First-time image generation: complete story → generate image → celebration modal appears
   b. Tap "View My Illustration" → celebration closes → ImageDisplayModal opens with the image
   c. Dismiss modal → exit game → start new story → no stale image modal visible
   d. Open ImageDisplayModal → tap exit game (via hardware back or menu) → modal fully resets
4. Run full test suite: `npm test` — no regressions across all test files
```

---

## Functional Requirements

- FR-1: Create `ImageDisplayModal` component in `src/components/common/ImageDisplayModal.tsx` that wraps `StoryImageDisplay` in a dismissable overlay with glass background
- FR-2: `ImageDisplayModal` must accept `visible`, `onClose`, `onBackToOptions`, and all `StoryImageDisplay` props as passthrough
- FR-3: Backdrop tap on `ImageDisplayModal` must dismiss the modal (return to story view) without confirmation dialog
- FR-4: "Back to Options" button inside `ImageDisplayModal` must dismiss the modal AND open the CompletionOptions panel
- FR-5: Remove inline `StoryImageDisplay` rendering from the story body ScrollView in HomeScreen
- FR-6: `handleImageGenerated` must open `ImageDisplayModal` after generation completes (instead of scrolling to inline image)
- FR-7: CompletionOptions must conditionally show "View Generated Image" (when image exists) or "Generate Image" (when no image)
- FR-8: "View Generated Image" button must close CompletionOptions and open `ImageDisplayModal`
- FR-9: "Back to Options" button in story body must be visible whenever game is completed and no modal is active, regardless of image generation state
- FR-10: `ImageDisplayModal` state must reset to `false` when exiting the game
- FR-11: First-image celebration CTA ("View My Illustration") must open `ImageDisplayModal` after dismissing the celebration

## Non-Goals (Out of Scope)

- No changes to `StoryImageDisplay.tsx` component internals (it renders identically, just inside a modal)
- No changes to `ImageGeneration.tsx` component (the generation process is unchanged)
- No image re-generation capability from the modal or CompletionOptions
- No thumbnail/preview of the image in the story body
- No changes to the image upload/storage pipeline (Replicate → Supabase flow unchanged)
- No changes to the `FullScreenImageModal` component
- No changes to database schema or Convex functions

## Design Considerations

- **Reuse existing overlay pattern**: The app uses `Pressable` + `AdaptiveGlassBackground` + inner `Pressable` (stopPropagation) for overlays. The new modal must follow this exact pattern for visual consistency.
- **Reuse existing styles**: The new component should replicate the style values from HomeScreen's `imageGenerationModalOverlay`, `imageGenerationScrollView`, and `imageGenerationContainer` styles (glass background, centered scroll, white rounded container with purple border).
- **Existing components to reuse**:
  - `StoryImageDisplay` (`src/components/common/StoryImageDisplay.tsx`) — renders unchanged inside the modal
  - `AdaptiveGlassBackground` (`src/components/common/AdaptiveGlassBackground.tsx`) — blur overlay background
- **zIndex layering**: The modal should use the same zIndex (1001) as the ImageGeneration overlay, since they are mutually exclusive (never shown simultaneously).

## Technical Considerations

- **HomeScreen.tsx is 3800+ lines**: Changes should be minimal and surgical — add state, swap render blocks, wire callbacks. No refactoring of unrelated code.
- **StoryImageDisplay is 1997 lines**: Zero modifications to this component. It already has all the props needed (`onBackToOptions`, `showBackButton`, `displayMode`, etc.).
- **Mutual exclusivity**: `showImageGeneration` and `showImageDisplayModal` are never both `true` — generation modal closes before display modal opens.
- **Image URL lifecycle**: Replicate URLs expire after ~1 hour. `StoryImageDisplay` already handles fallback to `supabaseUrl`. No change needed.
- **Session state**: `generatedImageUrl` (React state) and `currentSession.generated_image_url` / `currentSession.supabase_image_url` (from DB) continue to be the source of truth. The modal just reads these — no new data flow.

## Success Metrics

- Generated images never appear inline in the story body
- Users can view, save, and share generated images through the modal
- Users can dismiss the modal and return to a clean story view
- Stories continued from the database with existing images show "View Generated Image" in CompletionOptions
- All existing tests pass without modification (no regressions)
- New `ImageDisplayModal` component has dedicated unit tests

## Open Questions

- None — all requirements clarified through Q&A.
