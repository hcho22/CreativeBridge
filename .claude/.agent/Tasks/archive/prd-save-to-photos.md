# PRD: Save Generated Image to Photos

## Introduction

After completing a story game and generating an AI illustration, users currently can only save images to the Files app (via folder picker) or share via the system share sheet. Neither option directly saves to the iOS Photos app — the most intuitive destination for images on a mobile device.

This feature adds a dedicated **"Save to Photos"** action that writes the generated illustration directly into the user's Camera Roll / Photo Library. It will be available across all image views (ImageDisplayModal, FullScreenImageModal, and the Story Completion overlay) alongside the existing "Save to Files" and "Share" buttons.

## Goals

- Allow users to save generated story illustrations to their iOS Photos app with a single tap
- Provide the action in all contexts where generated images are displayed (post-generation modal, full-screen view, completion screen)
- Request only the minimum iOS permission needed (`PhotoLibraryAddOnly` — write-only)
- Maintain the existing "Save to Files" and "Share" buttons so users retain full control over export destination
- Include validation tests (unit + integration) for every user story to ensure correctness

## User Stories

---

### US-001: Install CameraRoll Library and Configure iOS Permissions

**Description:** As a developer, I need the `@react-native-camera-roll/camera-roll` library installed and iOS permissions configured so that the app can programmatically save images to the Photo Library.

**Acceptance Criteria:**

- [x] `@react-native-camera-roll/camera-roll` added to `package.json` and installed (v7.10.2)
- [x] `app.json` updated: `"PhotoLibraryAddOnly"` added to `react-native-permissions` plugin `iosPermissions` array
- [x] `app.json` updated: `NSPhotoLibraryAddUsageDescription` added to `ios.infoPlist` with user-friendly message
- [ ] `expo prebuild` runs successfully and generates updated native iOS project
- [ ] `pod install` completes without errors
- [x] Existing permissions (`Microphone`, `SpeechRecognition`, `NSPhotoLibraryUsageDescription`) remain untouched

**Validation Test (US-001):**

- [x] Unit test: Verify `app.json` schema contains all three `iosPermissions` entries (`saveToPhotosConfig.test.ts`)
- [x] Unit test: Verify both `NSPhotoLibraryUsageDescription` and `NSPhotoLibraryAddUsageDescription` exist in `infoPlist` (`saveToPhotosConfig.test.ts`)
- [ ] Integration test: `npm install` and `pod install` complete with exit code 0

---

### US-002: Create `saveToPhotos` Utility Module

**Description:** As a developer, I need a utility module that encapsulates Photo Library permission requests and the CameraRoll save API, following the project's existing wrapper pattern (`rnfsWrapper.ts`, `shareWrapper.ts`).

**Acceptance Criteria:**

- [x] New file created: `src/utils/saveToPhotos.ts`
- [x] Exports `requestPhotoLibraryPermission(): Promise<boolean>` using `react-native-permissions` (`check` → `request` → blocked alert with `Linking.openSettings()`)
- [x] Permission flow follows the exact pattern in `VoiceInput.tsx` (lines 282-348): check first, request if DENIED, show settings alert if BLOCKED
- [x] Exports `saveImageToPhotos(localFilePath: string): Promise<{ success: boolean; error?: string }>` wrapping `CameraRoll.saveAsset()`
- [x] Includes simulation mode guard: if CameraRoll native module is unavailable, logs warning and returns `{ success: false, error: 'Native module not available' }` (matching `rnfsWrapper.ts` pattern)
- [x] Handles Android platform: uses `WRITE_EXTERNAL_STORAGE` for API < 33, skips permission for API 33+ (scoped storage)
- [x] TypeScript types exported for return values
- [x] Typecheck passes (`npx tsc --noEmit`)

**Validation Test (US-002):**

- [x] Unit test file: `src/__tests__/utils/saveToPhotos.test.ts`
- [x] Test: `requestPhotoLibraryPermission` returns `true` when permission is GRANTED
- [x] Test: `requestPhotoLibraryPermission` calls `request()` when status is DENIED, returns result
- [x] Test: `requestPhotoLibraryPermission` returns `false` when status is BLOCKED (and does not call `request()`)
- [x] Test: `saveImageToPhotos` calls `CameraRoll.saveAsset` with correct file path
- [x] Test: `saveImageToPhotos` returns `{ success: true }` on successful save
- [x] Test: `saveImageToPhotos` returns `{ success: false, error: '...' }` when CameraRoll throws
- [x] Test: Simulation mode returns `{ success: false }` without calling CameraRoll
- [x] Integration test: Mock permission flow end-to-end (DENIED → request → GRANTED → saveAsset → success)

---

### US-003: Add "Save to Photos" Button in StoryImageDisplay

**Description:** As a user, I want a "Save to Photos" button on the image display so I can save my generated illustration to my Photo Library with a single tap.

**Acceptance Criteria:**

- [x] New button labeled "🖼️ Photos" appears in `renderDownloadShareButtons()` between "Save Image" and "Share"
- [x] Button has a distinct color (teal `#17a2b8`) to visually differentiate from existing green "Save Image" and blue "Share" buttons
- [x] Tapping the button: requests Photo Library permission → downloads image to local cache if needed (reusing existing RNFS cache pattern) → saves to Camera Roll via `saveImageToPhotos()` utility
- [x] If permission denied/blocked: shows Alert with "Open Settings" option (matching VoiceInput.tsx pattern)
- [x] Loading state: button shows `ActivityIndicator` + "Saving..." while save is in progress
- [x] Button is disabled during save operation (prevents double-tap)
- [x] On success: shows Alert "Saved to Photos!" with confirmation
- [x] On error: shows descriptive Alert with "Try Again" option
- [x] `onImageSaved` callback is called on success with the local file path
- [x] Button only renders when `effectiveImageUrl` is available and `state.hasError` is false (matches existing button visibility logic)
- [x] Three buttons fit on iPhone SE (320pt width) — use short label "Photos" with `numberOfLines={1}` and `adjustsFontSizeToFit`
- [x] State `isSavingToPhotos` is separate from existing `isDownloading` state (decoupled concerns)

**Validation Test (US-003):**

- [x] Unit test file: `src/__tests__/components/StoryImageDisplaySaveToPhotos.test.tsx`
- [x] Test: "Photos" button renders when `imageUrl` is provided
- [x] Test: "Photos" button does NOT render when `imageUrl` is absent
- [x] Test: "Photos" button does NOT render when image has error state
- [x] Test: Tapping "Photos" button calls `requestPhotoLibraryPermission`
- [x] Test: Button shows loading indicator when `isSavingToPhotos` is true
- [x] Test: Button is disabled during save operation
- [x] Test: Success alert shown after successful save
- [x] Test: Error alert shown with "Try Again" when save fails
- [x] Test: Permission denied alert shows "Open Settings" option
- [x] Integration test: Full flow — render component with local file → tap "Photos" → mock permission grant → mock CameraRoll.saveAsset → verify success alert and `onImageSaved` callback

---

### US-004: Add "Save to Photos" Action in FullScreenImageModal

**Description:** As a user, I want to save my illustration to Photos from the full-screen image viewer, so I can use whichever view I'm in without going back.

**Acceptance Criteria:**

- [x] New optional prop added to `FullScreenImageModalProps`: `onSaveToPhotos?: (image: StoryImage) => void`
- [x] New action button (📸 icon) appears in `headerActions` view alongside existing Share (📤) and Download (💾) buttons
- [x] Button conditionally renders only when `onSaveToPhotos` prop is provided (matching existing `onShare` / `onDownload` pattern)
- [x] `StoryImageDisplay.tsx` passes `onSaveToPhotos={() => handleSaveToPhotos()}` when rendering `FullScreenImageModal`
- [x] Button uses same `headerButton` / `headerButtonText` styles as siblings
- [x] Button triggers the same save flow as US-003 (permission → cache → CameraRoll)

**Validation Test (US-004):**

- [x] Unit test file: `src/__tests__/components/FullScreenImageModalSaveToPhotos.test.tsx`
- [x] Test: 📸 button renders when `onSaveToPhotos` prop is provided
- [x] Test: 📸 button does NOT render when `onSaveToPhotos` prop is omitted
- [x] Test: Tapping 📸 button calls `onSaveToPhotos` with the current image object
- [x] Test: Button renders alongside existing Share and Download buttons without layout issues
- [x] Integration test: Render FullScreenImageModal with all three action props → verify all three buttons render → tap 📸 → verify callback invoked with correct `StoryImage`

---

### US-005: Add "Save to Photos" Button on Story Completion Screen

**Description:** As a user, I want to save my generated illustration to Photos directly from the Story Complete overlay, without needing to open the image display modal first.

**Acceptance Criteria:**

- [x] New button "📸 Save Image to Photos" appears in `completionOptionsButtons` section of `HomeScreen.tsx` (lines 3387-3466)
- [x] Button appears only when a generated image exists (`generatedImageUrl || currentSession?.generated_image_url || currentSession?.supabase_image_url`)
- [x] Button is positioned after the "View Generated Image" / "Generate Image" button
- [x] Button uses the same `completionOptionButton` style as sibling buttons for visual consistency
- [x] Tapping the button invokes the same `saveToPhotos` utility flow (permission → cache → CameraRoll)
- [x] Loading and success/error feedback via `Alert` (consistent with StoryImageDisplay behavior)
- [x] A new handler `handleSaveImageToPhotos` is added to HomeScreen that:
  - Determines the best available image URL (supabase > replicate > legacy, matching `StoryImageDisplay` priority)
  - Downloads to local temp file if not already cached
  - Calls `saveImageToPhotos()` from the utility module
- [x] Button is disabled while save is in progress

**Validation Test (US-005):**

- [x] Unit test file: `src/__tests__/screens/HomeScreenSaveToPhotos.test.tsx`
- [x] Test: "Save Image to Photos" button renders when `generatedImageUrl` exists and game is completed
- [x] Test: Button does NOT render when no generated image exists
- [x] Test: Tapping button calls the save-to-photos handler
- [x] Test: Button disabled during save (no double-tap)
- [x] Integration test: Render HomeScreen completion overlay with generated image URL → tap "Save Image to Photos" → mock permission + CameraRoll → verify success alert

---

### US-006: End-to-End Integration Test Suite

**Description:** As a developer, I need a comprehensive integration test that validates the full save-to-photos flow across all three surfaces to catch regressions.

**Acceptance Criteria:**

- [x] New integration test file: `src/__tests__/integration/saveToPhotos.integration.test.ts`
- [x] Tests cover all three entry points: StoryImageDisplay, FullScreenImageModal, HomeScreen completion
- [x] Tests cover the complete permission lifecycle: first-time grant, previously granted, denied, blocked
- [x] Tests cover image source scenarios: cached local file (fast path), remote URL requiring download, failed download
- [x] Tests verify cleanup: temp files are removed after save
- [x] Tests verify error handling: network failure, CameraRoll failure, permission rejection
- [x] All mocks follow project conventions from `src/__tests__/components/StoryImageDisplay.test.tsx`
- [x] All tests pass with `npm test -- --testPathPattern=saveToPhotos`

**Validation Test (US-006):**

- [x] Run `npm test -- --testPathPattern=saveToPhotos` — all tests pass (87/87, 6 suites)
- [x] Run `npm test -- --coverage --testPathPattern=saveToPhotos` — coverage: 95.45% stmts / 84.61% branches / 100% funcs / 95.34% lines

---

## Functional Requirements

- **FR-1:** The system must save images to the iOS Photo Library using `CameraRoll.saveAsset()` from `@react-native-camera-roll/camera-roll`
- **FR-2:** The system must request `PHOTO_LIBRARY_ADD_ONLY` permission (iOS 14+) before saving, using `react-native-permissions`
- **FR-3:** If the user denies permission, the system must show an alert with an "Open Settings" button that navigates to the app's settings page
- **FR-4:** The system must reuse locally cached images (from `${RNFS.DocumentDirectoryPath}/ImageCache/`) when available, falling back to downloading the remote URL
- **FR-5:** The "Save to Photos" button must appear in three locations: `StoryImageDisplay`, `FullScreenImageModal`, and the `HomeScreen` completion overlay
- **FR-6:** The button must show a loading indicator and be disabled while the save is in progress
- **FR-7:** The system must display a success alert ("Saved to Photos!") after a successful save
- **FR-8:** The system must display an error alert with a "Try Again" option if the save fails
- **FR-9:** The existing "Save Image" (Files) and "Share" buttons must remain unchanged and functional
- **FR-10:** On Android, the system must handle scoped storage (API 33+) vs legacy storage permissions (API < 33)

## Non-Goals (Out of Scope)

- **No image quality/format options:** Always saves as JPEG at original resolution. Quality selectors are deferred to a future iteration.
- **No batch save:** Only the currently displayed image can be saved; gallery multi-select is out of scope.
- **No album creation:** Images are saved to the default Camera Roll, not a custom "CreativeBridge" album.
- **No reading from Photos:** The app only writes to the Photo Library. No photo picker or gallery browser is being added.
- **No AirDrop integration:** AirDrop is accessible via the existing Share button; no dedicated AirDrop flow is needed.
- **No Android photo gallery app:** This PRD focuses on iOS Photos. Android saves work via the same `CameraRoll.saveAsset()` API but visual testing is iOS-focused.

## Design Considerations

### UI Layout — Three Buttons in Action Bar

The `StoryImageDisplay` action bar currently has two buttons (Save Image, Share). Adding a third requires ensuring the layout works on small screens:

| Button         | Icon | Label  | Color           |
| -------------- | ---- | ------ | --------------- |
| Save to Files  | 📥   | Save   | Green `#28a745` |
| Save to Photos | 🖼️   | Photos | Teal `#17a2b8`  |
| Share          | 📤   | Share  | Blue `#007bff`  |

- Use short labels ("Save", "Photos", "Share") with `numberOfLines={1}` and `adjustsFontSizeToFit` to prevent truncation on iPhone SE
- All buttons use `flex: 1` with consistent `gap: 8`

### Completion Screen Button

- Full label "📸 Save Image to Photos" (more space available in vertical list)
- Uses the same `completionOptionButton` style as sibling buttons

### FullScreenImageModal Header

- Icon-only button (📸) matching the existing 📤 and 💾 icon buttons in the header actions row

## Technical Considerations

### Library Choice: `@react-native-camera-roll/camera-roll`

Chosen over `expo-media-library` because the project uses bare workflow with `react-native-fs`, `react-native-share`, and `react-native-permissions`. This keeps the native module and permission patterns consistent.

### Permission Model

Uses `PERMISSIONS.IOS.PHOTO_LIBRARY_ADD_ONLY` (iOS 14+) — write-only access that doesn't read existing photos. This is the minimum-privilege permission, which Apple favors during App Store review.

### Key Dependencies

| Dependency                              | Version           | Purpose                               |
| --------------------------------------- | ----------------- | ------------------------------------- |
| `@react-native-camera-roll/camera-roll` | latest            | `CameraRoll.saveAsset()` API          |
| `react-native-permissions`              | 5.4.2 (existing)  | Permission check/request              |
| `react-native-fs`                       | 2.20.0 (existing) | Download remote images to local cache |

### Existing Code to Reuse

| What                 | Where                                                       | Why                                          |
| -------------------- | ----------------------------------------------------------- | -------------------------------------------- |
| Permission pattern   | `src/components/common/VoiceInput.tsx:282-348`              | check → request → blocked alert flow         |
| Wrapper pattern      | `src/utils/rnfsWrapper.ts`, `src/utils/shareWrapper.ts`     | Simulation mode fallback                     |
| Image cache download | `StoryImageDisplay.tsx:330-410` (`downloadImageForDisplay`) | Reuse cached files instead of re-downloading |
| Image URL priority   | `StoryImageDisplay.tsx` (`effectiveImageUrl` logic)         | Supabase > Replicate > legacy URL            |
| Test mocking pattern | `src/__tests__/components/StoryImageDisplay.test.tsx:14-36` | Mock RNFS, Share, Alert consistently         |

### Prebuild Requirement

After modifying `app.json` permissions, `expo prebuild` must be run to regenerate the native iOS project. This updates `Info.plist` with the new `NSPhotoLibraryAddUsageDescription` key and configures the `react-native-permissions` pod for `PhotoLibraryAddOnly`.

## Success Metrics

- Users can save a generated image to Photos in **≤ 2 taps** (tap button → grant permission → done)
- Repeat saves (permission already granted) complete in **≤ 1 tap**
- All 6 user stories pass their validation tests with **≥ 70% code coverage**
- No regression in existing "Save Image" (Files) or "Share" functionality
- Zero additional permission prompts beyond the initial Photo Library request

## Open Questions

1. **Custom album?** Should images be saved to a "CreativeBridge" album within Photos, or just the default Camera Roll? (Current decision: Camera Roll only, custom album is a future enhancement)
2. **Duplicate handling?** If a user saves the same image twice, iOS creates a duplicate in the Camera Roll. Should we detect and warn? (Current decision: Allow duplicates — this is standard iOS behavior)
3. **Analytics tracking?** Should successful photo saves be tracked as analytics events in the Convex backend? (Recommend: yes, add in a follow-up story)
