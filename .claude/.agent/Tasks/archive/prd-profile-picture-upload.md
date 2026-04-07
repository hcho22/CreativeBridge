# PRD: Profile Picture Upload

## Introduction

CreativeBridge's profile screen currently displays a generated letter avatar (green circle with the user's first initial). Users cannot personalize their profile with a real photo. This feature adds the ability to select a photo from the iOS Photos library, upload it to Convex Storage, and display it as the user's profile picture. This serves both personal customization and social recognition (e.g., leaderboard visibility in the future).

**Key Finding:** The backend infrastructure is already complete. The `userProfiles` table has an `avatarUrl` field, `updateProfile` mutation accepts it, and Convex Storage with presigned upload URLs is fully operational. This is a frontend-only feature.

---

## Goals

- Allow users to upload a profile picture from their iOS Photos library
- Display the uploaded image as the user's avatar on the Profile screen
- Allow users to remove their custom photo and revert to the default letter avatar
- Provide a tappable avatar preview on the profile header that shows the full image
- Keep the implementation minimal (iOS Photos only, no camera or cropping for v1)
- Scope avatar display to the Profile screen only for v1

---

## User Stories

### US-001: Avatar Upload Service

**Description:** As a developer, I need a reusable service that wraps image selection and Convex Storage upload so that the ProfileScreen stays clean and the logic is independently testable.

**Acceptance Criteria:**

- [x] Create `src/services/avatarUploadService.ts` with two exported functions:
  - `pickAvatarImage()` — wraps `react-native-image-picker` v8 `launchImageLibrary()` with options: `mediaType: 'photo'`, `selectionLimit: 1`, `quality: 0.7`, `maxWidth: 400`, `maxHeight: 400`
  - `uploadAvatarToConvex(imageUri, mimeType)` — generates presigned URL via `api.storage.generateUploadUrl`, uploads blob, resolves permanent URL via `api.storage.getImageUrl`
- [x] `pickAvatarImage()` returns `{ uri, type, fileName }` on success or `null` on cancel/error
- [x] `uploadAvatarToConvex()` returns `{ success: true, avatarUrl: string }` on success or `{ success: false, error: string }` on failure
- [x] Uses `getConvexClient()` and `isConvexReady()` from `src/services/convex.ts` (existing pattern)
- [x] Upload follows the same blob pattern as `src/services/imageStorageService.ts`: `fetch(localUri) -> blob -> POST to presigned URL`
- [x] Handles permission denied error with a descriptive message guiding user to Settings
- [x] Typecheck passes (`npx tsc --noEmit`)

**Validation Test:**

- [x] Create `src/__tests__/services/avatarUploadService.test.ts`
- [x] Test `pickAvatarImage()`: mock `launchImageLibrary` for user cancel (returns null), successful selection (returns asset), and error code (returns null)
- [x] Test `uploadAvatarToConvex()`: mock fetch + Convex client for successful upload flow (returns avatarUrl), network failure (returns error), and null image URL from storage (returns error)
- [x] Follow test patterns from `src/__tests__/services/imageStorageService.test.ts`
- [x] All tests pass (`npm test -- --testPathPattern=avatarUploadService`)

---

### US-002: Conditional Avatar Display in Profile Header

**Description:** As a user, I want to see my uploaded profile picture instead of the default letter circle so that my profile feels personalized.

**Acceptance Criteria:**

- [x] In `src/screens/ProfileScreen.tsx`, replace the unconditional green circle avatar (lines 116-122) with conditional rendering:
  - If `userProfile?.avatar_url` exists: render `<Image source={{ uri: avatar_url }} />` with dimensions 80x80, borderRadius 40
  - If no `avatar_url`: keep existing green circle with first-letter text (current behavior)
- [x] Import `Image` from `react-native`
- [x] Add `avatarImage` style: `{ width: 80, height: 80, borderRadius: 40 }`
- [x] Image loads without layout shift (same dimensions as the letter circle)
- [x] Typecheck passes (`npx tsc --noEmit`)

**Validation Test:**

- [ ] On iOS simulator, verify that a user without `avatar_url` still sees the green letter circle (no regression)
- [ ] Temporarily hardcode a test image URL into `avatar_url` and verify the `<Image>` renders correctly at 80x80 with circular clipping
- [ ] Verify no layout shift when switching between letter circle and image avatar

---

### US-003: Tappable Avatar Preview on Profile Header

**Description:** As a user, I want to tap my avatar on the profile header to see a larger preview of my profile picture.

**Acceptance Criteria:**

- [x] Wrap the profile header avatar in a `TouchableOpacity`
- [x] On tap, if `avatar_url` exists: open a simple fullscreen modal overlay showing the image at a larger size (e.g., 250x250) centered on screen with a semi-transparent black background
- [x] Modal dismisses on tap anywhere (background or image)
- [x] If no `avatar_url` (letter circle): tapping does nothing (disabled state)
- [x] Add `avatarPreviewModalVisible` state to control the modal
- [x] Typecheck passes (`npx tsc --noEmit`)

**Validation Test:**

- [ ] On iOS simulator with a custom avatar set: tap the header avatar and verify the preview modal opens with the larger image
- [ ] Tap the background of the preview modal and verify it dismisses
- [ ] With the default letter circle (no custom avatar): tap the avatar and verify nothing happens

---

### US-004: Avatar Picker in Edit Profile Modal

**Description:** As a user, I want to tap my avatar inside the Edit Profile modal to select a new photo from my device's Photos library and upload it as my profile picture.

**Acceptance Criteria:**

- [x] Add a tappable avatar section at the top of the Edit Profile modal content (before the Display Name input), containing:
  - The avatar (100x100, circular) — image if `avatar_url` exists, letter circle otherwise
  - A camera icon overlay at the bottom of the circle (semi-transparent bar with camera emoji)
  - "Change Photo" text below the avatar
- [x] Tapping the avatar calls `handlePickAvatar` which:
  1. Calls `pickAvatarImage()` from the avatar upload service
  2. If null (cancelled), returns silently
  3. Sets `avatarUploading` state to `true`
  4. Calls `uploadAvatarToConvex(uri, type)`
  5. On failure: shows `Alert.alert` with error message, resets loading state
  6. On success: calls `updateProfile({ avatar_url: avatarUrl })`, then `refreshProfile()`
  7. Resets `avatarUploading` to `false`
- [x] While uploading: show `ActivityIndicator` overlay on the avatar (semi-transparent dark overlay with white spinner)
- [x] Disable the avatar `TouchableOpacity` while uploading
- [x] Avatar saves immediately on selection (independent of the "Save" button for display name)
- [x] Import `ActivityIndicator` from `react-native`
- [x] Import `pickAvatarImage`, `uploadAvatarToConvex` from `../services/avatarUploadService`
- [x] Add new state: `const [avatarUploading, setAvatarUploading] = useState(false)`
- [x] Typecheck passes (`npx tsc --noEmit`)

**Validation Test:**

- [ ] On iOS simulator: open Edit Profile modal, tap the avatar, verify iOS photo picker opens
- [ ] Select a photo: verify loading spinner appears on the avatar
- [ ] After upload completes: verify the avatar updates in both the modal and the profile header behind it
- [ ] Cancel the photo picker: verify nothing happens, no error alert
- [ ] Cancel the Edit Profile modal after uploading a photo: verify the avatar persists (it was saved immediately)
- [ ] Turn on airplane mode, attempt to upload: verify an error alert appears and the avatar is unchanged

---

### US-005: Remove Profile Picture

**Description:** As a user, I want to remove my custom profile picture and revert to the default letter avatar so that I can undo my choice.

**Acceptance Criteria:**

- [x] In the Edit Profile modal, show a "Remove Photo" text button below "Change Photo" — only visible when `userProfile?.avatar_url` exists
- [x] Tapping "Remove Photo" shows a confirmation alert: "Remove your profile photo? You'll go back to the default avatar."
- [x] On confirm: calls `updateProfile({ avatar_url: '' })` (empty string clears the URL)
  - Verify that the `updateProfile` mutation and AuthContext handle empty string correctly to clear `avatarUrl`
  - If empty string doesn't work cleanly, use a sentinel value or adjust the Convex mutation to accept `v.union(v.string(), v.null())` for `avatarUrl`
- [x] After removal: avatar reverts to the green letter circle in both the modal and profile header
- [x] "Remove Photo" button is hidden when there is no custom avatar
- [x] Typecheck passes (`npx tsc --noEmit`)

**Validation Test:**

- [ ] On iOS simulator with a custom avatar: open Edit Profile, verify "Remove Photo" text is visible
- [ ] Tap "Remove Photo": verify confirmation alert appears
- [ ] Confirm removal: verify avatar reverts to green letter circle everywhere on the Profile screen
- [ ] Without a custom avatar: open Edit Profile, verify "Remove Photo" is NOT visible
- [ ] Kill and relaunch the app: verify the removal persisted (avatar is still the letter circle)

---

### US-006: Styles and Polish

**Description:** As a user, I want the avatar upload UI to look polished and consistent with the existing profile screen design.

**Acceptance Criteria:**

- [x] New styles added to the ProfileScreen `StyleSheet.create`:
  - `avatarImage`: `{ width: 80, height: 80, borderRadius: 40 }` (profile header)
  - `modalAvatarContainer`: `{ alignSelf: 'center', marginBottom: 20, position: 'relative' }`
  - `modalAvatarImage`: `{ width: 100, height: 100, borderRadius: 50 }` (edit modal)
  - `modalAvatar`: same as `avatar` but 100x100, borderRadius 50
  - `modalAvatarText`: same as `avatarText` scaled for 100x100
  - `cameraOverlay`: absolute positioned at bottom of circle, `rgba(0,0,0,0.5)`, ~30px height, bottom border radius matching circle
  - `changePhotoText`: `{ fontSize: 14, color: '#4CAF50', textAlign: 'center', marginTop: 5 }`
  - `removePhotoText`: `{ fontSize: 14, color: '#ff4444', textAlign: 'center', marginTop: 5 }`
  - `avatarLoadingOverlay`: absoluteFill, borderRadius 50, `rgba(0,0,0,0.4)`, centered ActivityIndicator
  - `avatarPreviewOverlay`: fullscreen absolute, `rgba(0,0,0,0.85)`, centered content
  - `avatarPreviewImage`: `{ width: 250, height: 250, borderRadius: 125 }`
- [x] All colors are consistent with the existing green (#4CAF50) theme
- [x] No visual regressions to existing profile screen elements
- [x] Typecheck passes (`npx tsc --noEmit`)

**Validation Test:**

- [ ] Visual inspection on iOS simulator: verify all new UI elements match the green theme
- [ ] Verify camera overlay is visible and semi-transparent over the avatar in the edit modal
- [ ] Verify loading spinner is centered and visible against the dark overlay
- [ ] Verify "Change Photo" text is green and "Remove Photo" text is red
- [ ] Scroll the profile screen to verify no layout issues introduced

---

## Functional Requirements

- FR-1: Users can tap their avatar in the Edit Profile modal to open the iOS Photos library picker
- FR-2: Selected photos are compressed (quality 0.7) and resized (max 400x400) before upload
- FR-3: Photos are uploaded to Convex Storage via presigned URL and the permanent URL is saved to `userProfiles.avatarUrl`
- FR-4: The profile header displays the uploaded image (80x80 circular) or falls back to the letter avatar
- FR-5: Tapping the profile header avatar opens a fullscreen preview modal (when a custom photo exists)
- FR-6: Users can remove their custom photo via a "Remove Photo" option in the Edit Profile modal
- FR-7: Avatar upload saves immediately on image selection, independent of the display name "Save" button
- FR-8: Loading state is shown during upload with a spinner overlay on the avatar
- FR-9: Errors during upload or save are surfaced via Alert.alert with descriptive messages
- FR-10: Permission denial for photo library access shows guidance to open Settings

---

## Non-Goals (Out of Scope)

- No camera capture (iOS Photos library only for v1)
- No crop/resize UI before uploading (react-native-image-picker handles resize natively)
- No avatar display outside the Profile screen (no tab bar, leaderboard, etc. for v1)
- No avatar for other users' profiles (this is self-profile only)
- No Supabase/legacy user support for avatar upload (Convex-only)
- No image moderation or content filtering on uploaded photos
- No animated avatars or avatar customization beyond photo upload

---

## Technical Considerations

- **Existing infrastructure (no backend changes needed):**
  - `convex/schema.ts` — `userProfiles.avatarUrl: v.optional(v.string())`
  - `convex/userProfiles.ts` — `updateProfile` mutation accepts `avatarUrl` (line 219)
  - `convex/storage.ts` — `generateUploadUrl()` and `getImageUrl(storageId)`
  - `src/context/AuthContext.tsx` — `updateProfile()` maps `avatar_url` -> `avatarUrl` (lines 693-694)
  - `src/types/database.ts` — `UserProfile.avatar_url?: string` (line 75)
- **Existing dependency:** `react-native-image-picker` v8.2.1 is already installed
- **Upload pattern reference:** `src/services/imageStorageService.ts` uses the same `fetch(uri) -> blob -> POST presigned URL` flow
- **COPPA:** Avatar uploads are personal customization, not shared content. Photos are stored in Convex Storage and visible only on the user's own profile. No additional COPPA restrictions needed for under-13 users.
- **Convex reactive queries:** Profile changes via `updateProfile` automatically sync to all subscribers — no manual refetch needed beyond `refreshProfile()` for immediate UI update

---

## Design Considerations

- Avatar in profile header: 80x80 circular, matches existing green circle dimensions
- Avatar in edit modal: 100x100 circular (slightly larger for easier tap target)
- Camera overlay: semi-transparent black bar at bottom of circle with camera emoji
- Loading overlay: semi-transparent dark overlay covering the entire avatar circle with white ActivityIndicator
- "Change Photo" label: green (#4CAF50) text below the avatar
- "Remove Photo" label: red (#ff4444) text, only visible when custom avatar exists
- Preview modal: fullscreen semi-transparent black overlay with 250x250 circular image centered

---

## Success Metrics

- Users can upload a profile picture in under 3 taps (tap avatar -> select photo -> done)
- Profile picture persists across app restarts
- Upload completes within 5 seconds on a standard connection
- No crashes or unhandled errors during the upload flow
- Zero backend changes required (all existing infrastructure reused)

---

## Open Questions

- Should we add a loading placeholder (skeleton) while the avatar image loads from URL on profile screen mount?
- Should the avatar preview modal support pinch-to-zoom?
- Future: should we sync Clerk's OAuth profile picture as the default `avatarUrl` on first login?
