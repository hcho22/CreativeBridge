# PRD: On-Device Voice Transcription with Push-to-Talk UX

**Status:** Draft
**Author:** Generated 2026-05-09
**Related:** H01 COPPA tripwire (`src/__tests__/security/coppa/H01-speechRecognition.test.ts`), 2026-04-14 architectural decision (cloud Whisper rewrite), PR #88 (privacy policy redline draft)

---

## 1. Introduction / Overview

CreativeBridge currently transcribes user voice input (the K-2 dictation feature) by uploading audio to OpenAI's Whisper service via the Convex `transcribeAudio` action. This creates two problems:

1. **COPPA exposure (H01 tripwire):** Voice is PII under §312.2. Children under 13 are sending voice data to a third party without disclosure (§312.4(b) violation) and without consent specific to voice (§312.5 violation). The privacy policy is silent about voice processing entirely.
2. **A regression risk in the original architecture:** The cloud Whisper rewrite was itself a fix for an even worse bug — iOS's `SFSpeechRecognizer` aggressively VAD-finalized after ~1–2s of silence, truncating K-2 long-form sentences ("In the twinkling expanse of the Cosmic Carnival" → "In Lots of"). Re-wiring back to native iOS would re-introduce that bug.

This feature replaces the cloud Whisper pipeline (for under-13 users) with **on-device Whisper via `whisper.rn`**, and replaces the continuous-listening-with-VAD interaction model with **push-to-talk** (tap-to-start, tap-to-stop). For users 13 and older, cloud Whisper is preserved as an opt-in setting for higher-quality transcription, accompanied by a disclosure modal and updated privacy policy language.

The result: under-13 voice data never leaves the device → COPPA-clean by construction. K-2 long-form dictation works correctly because Whisper is trained on diverse speech and push-to-talk eliminates VAD-induced truncation.

iOS-only for initial release. Android voice input is hidden in this release and tracked as a follow-up PRD.

---

## 2. Goals

- **Compliance:** No transmission of under-13 user voice to third parties. The H01 tripwire transitions from `test.failing` to passing as a real assertion.
- **Accessibility preserved:** K-2 students can dictate full multi-sentence stories without truncation.
- **Quality target:** Whisper-level transcription quality for typical K-2 utterances (clean indoor audio, 1–60s utterance length).
- **Performance:** ≤2s transcription latency for a 10-second utterance on iPhone 12 and newer.
- **Bundle discipline:** App install size delta ≤50MB after this change (Whisper tiny + native binary).
- **Optional cloud quality for 13+:** Settings toggle exposes cloud Whisper to 13+ users with explicit disclosure and consent.
- **Safe Android handling:** Voice button is hidden on Android (with friendly explanation); no broken UI.

---

## 3. User Stories

Each story below is sized for a single focused implementation session and includes a **Validation Test** subsection specifying what to run and what "passing" looks like.

---

### US-001: Add `whisper.rn` dependency and autolinking workaround

**Description:** As a developer, I need `whisper.rn` integrated into the Expo project so the rest of the work can compile and run on a development build. Per spike Q1 findings (Resolved Decision D-2), there is no Expo config plugin shipped by the library; integration is via prebuild + a small autolinking override.

**Acceptance Criteria:**

- [ ] `whisper.rn` installed pinned to exact version `0.5.5` (no caret) — `npm install whisper.rn@0.5.5`. Pin reasoning: protects against surprise breakage from the in-progress `0.6.x` release line.
- [ ] `react-native.config.js` added to project root with the explicit autolinking override for `whisper.rn`, per spike findings and whisper.rn issue #301:

  ```js
  const path = require('path');
  module.exports = {
    dependencies: {
      'whisper.rn': {
        root: path.join(__dirname, 'node_modules/whisper.rn'),
      },
    },
  };
  ```

  Without this file, RN codegen silently skips `whisper.rn` (it uses `exports` in `package.json`, which trips `require.resolve`), and the iOS build fails with `'RNWhisperSpec/RNWhisperSpec.h' file not found`.

- [ ] Workaround rationale documented in `src/services/CLAUDE.md` with a link back to whisper.rn issue #301, so future contributors don't remove `react-native.config.js` thinking it's dead config
- [ ] iOS development build compiles cleanly: `npx expo prebuild --clean && npx expo run:ios`
- [ ] No regressions in existing `npm test`, `npm run lint`, type-check

**Validation Test:**

- **What:** Smoke test that imports the library on a development build and instantiates a transcription context with a known-good 1-second WAV file.
- **How to run:** Add `src/__tests__/services/whisperRnSmoke.test.ts` that mocks the native module and asserts the JS-side wrapper resolves an expected interface; on a real device, run the dev build and verify no crash on import.
- **Pass condition:** Test passes in Jest, dev build launches without redbox, library is importable from `whisper.rn`.

---

### US-002: Bundle Whisper tiny model (39MB) into iOS app

**Description:** As a user, I want voice transcription to work immediately on first launch, even before any post-install download completes.

**Acceptance Criteria:**

- [ ] Whisper `tiny.en` model file (`ggml-tiny.en.bin`) added to iOS asset bundle
- [ ] Asset is included in the iOS build via Expo asset config
- [ ] Service can resolve and load the bundled model path at runtime
- [ ] App install size delta verified ≤45MB on a clean install
- [ ] Model file is documented in `convex/CLAUDE.md` / `src/services/CLAUDE.md` so future contributors know it ships with the app

**Validation Test:**

- **What:** Integration test that loads the bundled model and runs transcription on a fixture WAV file (a recording of "hello world" from `src/__tests__/__fixtures__/`).
- **How to run:** `npm test -- src/__tests__/services/whisperBundledModel.test.ts`
- **Pass condition:** Test asserts the model loads in <500ms and transcribes the fixture to a string containing "hello". **Validation must also be run on a release build** (`npx expo run:ios --configuration Release`), not just a dev build, to surface whisper.rn issue #286 (release-build model load failure) if it affects our setup. Don't mark US-002 complete until both dev-build automated test and release-build manual smoke pass.

---

### US-003: Lazy-download Whisper base model (74MB) on first launch over Wi-Fi only

**Description:** As a user on Wi-Fi, I want the higher-quality `base` model to download in the background so my transcriptions are more accurate after the first launch — without consuming cellular data.

**Acceptance Criteria:**

- [ ] On first launch, app checks for `ggml-base.en.bin` in the app's documents directory
- [ ] If absent AND device is on Wi-Fi (use `NetInfo` from `@react-native-community/netinfo`, already in the project), download to documents directory
- [ ] Download is non-blocking — UI is interactive during download
- [ ] Download progress is observable (for a future progress UI; not required to render in this story)
- [ ] On cellular or offline, download is skipped and tiny model is used
- [ ] Download retries with exponential backoff on failure (max 3 attempts)
- [ ] Once downloaded, transcription service prefers `base` over `tiny`

**Validation Test:**

- **What:** Integration test using a mocked NetInfo that simulates (a) Wi-Fi → download path is invoked, (b) cellular → download is skipped, (c) offline → download is skipped.
- **How to run:** `npm test -- src/__tests__/services/whisperModelDownloader.test.ts`
- **Pass condition:** All three branches assert the expected behavior; the Wi-Fi case verifies the model is written to the expected path.

---

### US-004: Push-to-talk audio capture service

**Description:** As a developer, I need a service that records microphone audio between explicit start/stop calls and writes a WAV file to disk, so the transcription service has a buffer to work on.

**Acceptance Criteria:**

- [ ] New service `src/services/audioCaptureService.ts` with class + singleton export pattern (per `src/services/CLAUDE.md` conventions)
- [ ] `start()`, `stop()`, `cancel()` methods returning Promises
- [ ] `stop()` resolves with `{ uri: string, durationMs: number }`
- [ ] **Audio format strictly: 16000 Hz sample rate, 1 channel (mono), 16-bit depth, WAV container.** Any deviation causes whisper.rn to silently truncate transcription to ~1 second (whisper.rn issue #299 — this is the failure mode the entire PRD is trying to escape, so getting the format right is load-bearing). The `expo-av` recording config must be: `{ sampleRate: 16000, numberOfChannels: 1, bitDepth: 16 }`.
- [ ] Dedicated unit test in `src/__tests__/services/audioCaptureService.test.ts` asserts the recording config object contains exactly these three values. Regression-guards against accidental config drift from future audio-related changes.
- [ ] Microphone permission request is wrapped (uses `expo-av` `Audio.requestPermissionsAsync`)
- [ ] Captured file is written to a tmp directory and cleaned up on next `start()`
- [ ] iOS background-state guard: if app backgrounds during capture, stop and discard cleanly (no orphaned `AVAudioSession`)

**Validation Test:**

- **What:** Unit tests with mocked `expo-av` covering: permission denied path, normal start→stop round-trip, cancel-mid-capture, app backgrounding mid-capture.
- **How to run:** `npm test -- src/__tests__/services/audioCaptureService.test.ts`
- **Pass condition:** All four scenarios pass; permission-denied returns a typed error; normal capture resolves with a non-empty uri and duration > 0.

---

### US-005: On-device transcription service (whisper.rn wrapper)

**Description:** As a developer, I need a service that takes an audio file URI and returns transcribed text using the on-device Whisper model.

**Acceptance Criteria:**

- [ ] New service `src/services/onDeviceTranscriptionService.ts` with class + singleton export
- [ ] `transcribe(audioUri: string): Promise<{ text: string, latencyMs: number }>`
- [ ] Internally selects best available model: `base` if downloaded, else `tiny`
- [ ] Throws typed `TranscriptionError` on failure (model not loaded, audio decode error)
- [ ] Logs latency to existing `analyticsService` (anonymized — no transcript content, just duration + model name)
- [ ] No PII transmitted in any log or telemetry path (audit by code review)

**Validation Test:**

- **What:** Integration test using a fixture WAV ("the quick brown fox" recording) plus the bundled tiny model.
- **How to run:** `npm test -- src/__tests__/services/onDeviceTranscriptionService.test.ts` and a manual QA on a real iOS device with a 30-second K-2 voice sample.
- **Pass condition:** Automated test asserts transcript contains expected keywords; manual QA confirms full sentence is captured (no truncation).

---

### US-006: Grade-gate transcription engine selection

**Description:** As the system, I need to route users in grade bands likely to contain under-13 students to on-device Whisper unconditionally, and let `9-12` users follow their Settings preference, so COPPA compliance is enforced at the architectural level based on grade level (the existing first-class user attribute).

**Acceptance Criteria:**

- [ ] New helper `src/utils/transcriptionEnginePolicy.ts` exporting `getTranscriptionEngine(profile: { gradeLevel?: GradeLevel; preferences?: { transcriptionEngine?: 'on-device' | 'cloud' } }): 'on-device' | 'cloud'`
- [ ] Grade-to-engine mapping (mirrors the `YOUNG_GRADES` pattern in `src/utils/childFriendlyErrors.ts`):
  - `'K-2'` → always `'on-device'`
  - `'3-5'` → always `'on-device'`
  - `'6-8'` → always `'on-device'` (fail-safe; band contains 11–12-year-olds who are under 13)
  - `'9-12'` → reads `preferences.transcriptionEngine` (default `'on-device'`)
  - `undefined` / missing → always `'on-device'` (fail-safe, matches `childFriendlyErrors.ts` convention)
- [ ] New constant exported alongside helper: `UNDER_13_GRADES: GradeLevel[] = ['K-2', '3-5', '6-8']` so other call sites (Settings visibility in US-009, consent gating in US-010) can reuse the same classification without duplicating the literal list
- [ ] Pure function — easily unit-testable, no side effects, no I/O
- [ ] Helper is the _only_ place transcription routing decisions are made (single source of truth — FR-2 enforcement)
- [ ] Reads `userProfile.gradeLevel` (canonical field), NOT `preferredGradeLevel` — see Resolved Decision D-1

**Validation Test:**

- **What:** Pure-function unit tests covering the full matrix: 5 grade states (`K-2`, `3-5`, `6-8`, `9-12`, `undefined`) × 3 preference states (`on-device`, `cloud`, `undefined`) = 15 cases.
- **How to run:** `npm test -- src/__tests__/utils/transcriptionEnginePolicy.test.ts`
- **Pass condition:** All 15 cases pass; the 12 cases corresponding to `K-2`, `3-5`, `6-8`, and `undefined` grades resolve to `'on-device'` regardless of preference; the 3 cases for `9-12` respect the preference (with `undefined` preference defaulting to `'on-device'`).

---

### US-007: Rewrite `VoiceInput.tsx` UI to push-to-talk model

**Description:** As a K-2 student, I want to tap a microphone button to start recording my story and tap a "Done" button when I'm finished, so my long sentences don't get cut off mid-thought.

**Acceptance Criteria:**

- [ ] `VoiceInput.tsx` rewritten to a tap-to-start, tap-to-stop UI (no continuous VAD)
- [ ] Mic button is large (≥64pt touch target) and uses an animated waveform/pulse while recording
- [ ] Recording state is visually unmistakable: button color change, pulsing animation, "I'm listening…" label
- [ ] On stop, recorded audio is routed through the engine returned by `getTranscriptionEngine()`
- [ ] Existing imperative `finalize()` handle (US-014) and `onHasSpokenChange` callback (US-015 AC #4) preserved or migrated to equivalents
- [ ] All existing call sites (~9 in the file) updated
- [ ] Type-check, lint, existing tests pass

**Validation Test:**

- **What:** Component test rendering `VoiceInput` with mocked services; simulate tap-start, mock audio capture resolving, simulate tap-stop, verify text emitted via callback. Plus manual QA on iOS device with a real 30-second K-2 utterance.
- **How to run:** `npm test -- src/__tests__/components/VoiceInput.test.tsx`; manual: launch dev build on iPhone, tap mic, recite a 4-sentence story, tap stop, verify all 4 sentences appear in the text field.
- **Pass condition:** Component test passes; manual QA confirms zero truncation on a 30-second utterance.

---

### US-008: 60-second auto-stop with "still talking?" prompt

**Description:** As a K-2 student who forgets to tap stop, I want the app to gently prompt me at 60 seconds so my recording doesn't run forever — but I should be able to keep going if I'm still telling my story.

**Acceptance Criteria:**

- [ ] At 60s of continuous recording, capture is paused and a modal appears: "Are you still telling your story?" with two buttons: "Yes, keep going" / "I'm done"
- [ ] "Yes, keep going" resumes recording (extends timer by another 60s)
- [ ] "I'm done" finalizes and transcribes
- [ ] If no input within 10 seconds of prompt appearing, defaults to "I'm done"
- [ ] Hard ceiling at 5 minutes total (prevents runaway recording)
- [ ] Visual countdown in the last 10 seconds before prompt
- [ ] Modal uses existing app modal patterns (no custom dialog)

**Validation Test:**

- **What:** Component test using fake timers (`jest.useFakeTimers`) advancing through 60s mark, asserting modal appears, simulating both "keep going" and "I'm done" branches plus the 10s no-input default.
- **How to run:** `npm test -- src/__tests__/components/VoiceInput.autoStop.test.tsx`
- **Pass condition:** All three branches assert the expected state transitions; hard ceiling at 5 min is verified.

---

### US-009: Settings toggle for `9-12` users (cloud transcription opt-in)

**Description:** As a `9-12` user, I want to choose higher-quality cloud transcription if I prefer it, so I get better accuracy when I'm willing to share audio with the cloud service.

**Acceptance Criteria:**

- [ ] New setting in app Settings screen: "Voice transcription quality" with options "On-device (default, more private)" / "Cloud (higher quality, audio sent to OpenAI)"
- [ ] Setting visibility uses the `UNDER_13_GRADES` constant from US-006 — **only visible** if `!UNDER_13_GRADES.includes(profile.gradeLevel)` AND `profile.gradeLevel !== undefined` (i.e., grade is known AND equal to `'9-12'`)
- [ ] Hidden entirely for `K-2`, `3-5`, `6-8`, and users with no grade set — not just disabled
- [ ] Default value: `'on-device'`
- [ ] Persisted to Convex `userProfiles.preferences.transcriptionEngine`
- [ ] Setting changes take effect on next dictation (no app restart needed)
- [ ] Schema migration in `convex/schema.ts` adds the optional `preferences.transcriptionEngine` field

**Validation Test:**

- **What:** Component test for Settings screen rendering with one mock per grade band (`K-2`, `3-5`, `6-8`, `9-12`, undefined) asserting setting visibility; mutation test verifying the toggle persists to Convex.
- **How to run:** `npm test -- src/__tests__/screens/SettingsScreen.transcription.test.tsx` and `npm test -- src/__tests__/convex/userProfiles.preferences.test.ts`
- **Pass condition:** Setting renders only in the `9-12` snapshot; absent from the other 4 snapshots; mutation test confirms value round-trips through Convex.

---

### US-010: Cloud opt-in disclosure modal

**Description:** As a 13+ user toggling cloud transcription on for the first time, I want a clear explanation of what data leaves my device and where it goes, so I can make an informed choice — and as the operator, I want a logged consent record for the audit trail.

**Acceptance Criteria:**

- [ ] First time the user enables cloud transcription, a disclosure modal appears with:
  - Plain-language summary of what is sent (audio recordings) and to whom (OpenAI Whisper API)
  - Link to relevant section of privacy policy
  - "Cancel" and "I understand and agree" buttons
- [ ] On agreement, a record is written to a new `consentEvents` Convex table with `userId`, `consentType: 'cloudTranscription'`, `timestamp`, `policyVersion`
- [ ] Cancel reverts the toggle to `'on-device'`
- [ ] Subsequent toggles do not re-show the modal (consent persists until revoked)
- [ ] Toggling back to on-device does not require a modal but is logged

**Validation Test:**

- **What:** End-to-end-ish component test simulating the toggle interaction, asserting modal appearance, both branches, and the consent event mutation. Plus a verifiable consent record in Convex.
- **How to run:** `npm test -- src/__tests__/screens/SettingsScreen.cloudConsent.test.tsx`; manually verify in Convex dashboard that a consent event row is created.
- **Pass condition:** Modal renders, agree-path writes consent event, cancel-path reverts toggle, second toggle does not re-prompt.

---

### US-011: Hide voice input on Android (coming-soon state)

**Description:** As an Android user, I want the app to gracefully not offer voice input (rather than showing a broken button), so I'm not confused when nothing happens.

**Acceptance Criteria:**

- [ ] On Android, the voice/mic button is **not rendered** in `VoiceInput.tsx` (return null branch or sibling absence)
- [ ] On Android, a one-time toast or info banner explains: "Voice input is coming soon to Android. Type your story for now."
- [ ] No native Android dependencies are added in this PR (whisper.rn Android binary not bundled)
- [ ] iOS UI is unaffected — same screen renders identically with the mic button present
- [ ] Platform detection uses `Platform.OS === 'ios'` checks (existing pattern)

**Validation Test:**

- **What:** Snapshot tests for the input bar rendered on iOS and Android (using the existing `Platform.OS` mock pattern), asserting the mic button is present in iOS snapshot and absent in Android snapshot.
- **How to run:** `npm test -- src/__tests__/components/VoiceInput.platform.test.tsx`
- **Pass condition:** Snapshots differ in the expected way; Android snapshot does not contain mic-button-related test IDs.

---

### US-012: Privacy policy update — voice processing disclosure

**Description:** As a parent or auditor reading the privacy policy, I want a clear and accurate description of how voice data is processed for under-13 vs 13+ users, so I can verify the app's COPPA posture and consent decisions.

**Acceptance Criteria:**

- [ ] `docs/legal/privacy-policy.md` updated with:
  - New "Voice and Audio Data" section under "Information We Collect"
  - Explicit statement: "For users under 13, voice transcription is performed entirely on-device. Audio recordings are not transmitted off-device, retained, or shared with any third party."
  - Statement for 13+ opt-in cloud users: what is sent, retention, OpenAI DPA reference
  - Updated "Third-Party Services" table with conditional OpenAI Whisper row (only for 13+ opt-in)
- [ ] PR #88's draft sections are reconciled with these final additions (close PR #88 as superseded, or rebase its changes into this update)
- [ ] Effective Date and Last Updated fields refreshed
- [ ] Version bumped to 1.1

**Validation Test:**

- **What:** Manual legal-readback by maintainer (or designated legal reviewer); plus automated check that the policy file contains all required keywords.
- **How to run:** `npm test -- src/__tests__/security/coppa/privacyPolicyContent.test.ts` (a new test asserting presence of `voice`, `on-device`, `OpenAI Whisper`, `under 13` strings); manual: read the policy end-to-end and confirm it accurately describes the implementation.
- **Pass condition:** Automated test passes (keywords present); manual review signs off that the language matches actual implementation.

---

### US-013: Convert H01 tripwire from `test.failing` to passing assertion

**Description:** As a maintainer, I want the H01 audit tripwire to evolve from a failing-by-design signal into a real passing assertion that verifies the new architectural invariants, so it continues to act as a regression guard going forward.

**Acceptance Criteria:**

- [ ] `src/__tests__/security/coppa/H01-speechRecognition.test.ts` rewritten with three real assertions:
  1. **For under-13 users, the cloud `transcribeAudio` action is never invoked.** Assertion uses a Convex action mock that records call attempts; under-13 fixture user runs through `getTranscriptionEngine()` and the cloud action recorder must show zero calls.
  2. **The on-device transcription service is reachable from `VoiceInput.tsx`.** Static check that the import exists.
  3. **The privacy policy file contains voice disclosure for under-13.** String search assertion against `docs/legal/privacy-policy.md`.
- [ ] DO-NOT-FIX docstring removed; replaced with normal test docstring describing what each assertion guards
- [ ] No `test.failing()` markers remain in this file
- [ ] CI on `main` shows the file passing for the first time since the audit was added

**Validation Test:**

- **What:** The rewritten test itself is the validation. Plus a meta-check: deliberately break each invariant (e.g., temporarily wire an under-13 user to cloud) and confirm the corresponding assertion fails.
- **How to run:** `npm test -- src/__tests__/security/coppa/H01-speechRecognition.test.ts`
- **Pass condition:** All three assertions pass on the post-implementation main branch; injected regressions flip the appropriate assertion to red.

---

## 4. Functional Requirements

- **FR-1:** The system MUST transcribe under-13 user voice input entirely on-device using Whisper via `whisper.rn`.
- **FR-2:** The system MUST NOT transmit under-13 user audio to any third-party service under any circumstance, including error fallback paths.
- **FR-3:** The system MUST default to on-device transcription for all users (under-13 and 13+).
- **FR-4:** The system MUST expose a Settings toggle for 13+ users to opt into cloud transcription.
- **FR-5:** The system MUST display a disclosure modal the first time a 13+ user enables cloud transcription, and persist a `consentEvents` record on agreement.
- **FR-6:** The voice input UI MUST use a tap-to-start, tap-to-stop interaction model (push-to-talk), not continuous listening with VAD finalization.
- **FR-7:** Voice recording MUST auto-stop with a confirmation prompt at 60 seconds and hard-stop at 5 minutes.
- **FR-8:** The iOS app MUST bundle the Whisper `tiny.en` model so transcription works offline on first launch.
- **FR-9:** The iOS app MUST lazy-download the Whisper `base.en` model on first launch when on Wi-Fi, and prefer it over tiny once available.
- **FR-10:** On Android, the voice input button MUST NOT be rendered, and a one-time info banner MUST explain that voice input is coming later.
- **FR-11:** Privacy policy MUST be updated to disclose voice processing for both user populations before this feature ships.
- **FR-12:** The H01 COPPA tripwire test MUST be converted from `test.failing` to a real passing assertion that validates the new invariants.

---

## 5. Non-Goals (Out of Scope)

- **Android voice input:** Tracked as a follow-up PRD. Not implemented in this release. Whisper.rn supports Android, but cross-platform validation is deliberately deferred.
- **On-device transcription for 13+ "premium" model selection:** 13+ users get the same on-device pipeline by default, not a separate larger model. The `small` (244MB) and `medium` (769MB) Whisper models are not in scope.
- **Streaming / partial transcription:** Whisper transcribes full audio buffers in one shot. No incremental "partial result" stream in this release. (The previous `onPartialResult` callback is removed; if any caller relied on it, that caller is updated to handle the final-only result.)
- **Whisper for languages other than English:** `tiny.en` and `base.en` are English-only. Multilingual model selection is a follow-up.
- **Voice activity detection / silence-based auto-stop:** Push-to-talk replaces this entirely. There is no automatic "stop when user pauses" behavior in this release.
- **Voiceprint / speaker identification:** Out of scope. No biometric template storage.
- **Settings UI for under-13 users:** No engine choice for under-13. The setting is _not displayed at all_ (not just disabled), to avoid implying a choice exists.
- **Backfill consent for existing 13+ users:** Existing users default to on-device; consent flow only fires when they actively opt into cloud. No retroactive consent prompts.
- **Removal of `whisperTranscriptionService.ts` or the Convex `transcribeAudio` action:** They remain as the implementation backing the 13+ opt-in path. Deletion is explicitly out of scope.

---

## 6. Design Considerations

### UI Patterns

- **Mic button:** Reuse existing primary button styling; ≥64pt touch target; active-recording state uses a pulsing ring animation (existing `Animated` patterns).
- **Waveform indicator:** Optional, but nice-to-have — a simple animated bar height tied to current input level. Use existing chart components if present; otherwise a 5-bar pseudo-VU meter.
- **"Still talking?" modal:** Use existing modal component (`src/components/common/Modal.tsx` or equivalent). Two-button layout matching existing dialog patterns.
- **Settings toggle:** Reuse existing settings row pattern (label + radio/segmented control).
- **Cloud disclosure modal:** Reuse existing modal pattern with a scrollable body (legal text won't fit on smaller screens otherwise).

### Accessibility

- All controls have `accessibilityLabel` props in plain language ("Start recording your story", "Stop recording").
- Mic button state changes announce via `accessibilityState` for VoiceOver users.
- Recording state communicated visually (color + animation) AND textually ("I'm listening…") for users who can't see motion.

### Copy

- Keep all copy at K-2 reading level where possible. "Are you still telling your story?" not "Continue recording session?"
- Disclosure modal copy must satisfy legal review _and_ be readable. Suggest two layers: a one-sentence summary at top, expandable detail below.

---

## 7. Technical Considerations

### Library: `whisper.rn`

- Maintained by `mybigday/whisper.rn`. Wraps `whisper.cpp`. Active in 2024–2026.
- Compatible with Expo dev client (requires custom dev build, which the project already uses).
- Supports iOS Metal acceleration on Apple Silicon for real-time performance.
- Models are GGML format; `ggml-tiny.en.bin` (39MB), `ggml-base.en.bin` (74MB).

### Bundle Size Strategy

- Bundle `tiny.en` (39MB) in iOS asset catalog for first-launch availability.
- Lazy-download `base.en` (74MB) over Wi-Fi only; respect `NetInfo.useNetInfo()` connection type.
- Total app size delta budget: 50MB. Current measurement before change should be captured as baseline.

### Convex Schema Changes

- Add to `userProfiles` table: `preferences.transcriptionEngine: 'on-device' | 'cloud' | undefined`. Optional field; absence means default (`'on-device'`).
- Add new `consentEvents` table: `{ userId, consentType, timestamp, policyVersion, metadata? }`. Indexed by userId + consentType for efficient lookup.
- Schema changes go through `npx convex dev` to regenerate types.

### Removed / Rewritten Surface Area

- `src/components/common/VoiceInput.tsx` — major rewrite (~250 lines changed)
- `src/services/whisperTranscriptionService.ts` — kept; isolated to the cloud opt-in path
- `convex/ai.ts:transcribeAudio` — kept; isolated to the cloud opt-in path; access guarded by a `requireAge13Plus(ctx)` helper added to `auth.ts`
- `src/services/nativeSpeechRecognizer.ts` — eligible for deletion in a follow-up cleanup PR (zero production consumers); not deleted in this PRD to keep diff focused

### Permissions

- Microphone permission already requested elsewhere; verify the request copy is age-appropriate.
- iOS `Info.plist` `NSMicrophoneUsageDescription` should mention "to record your story" rather than generic "to record audio."

### Performance & Battery

- On-device Whisper runs on Apple Neural Engine when available. Verify CPU usage during 30s utterance is <15% on iPhone 12.
- Memory: Whisper base model is ~150MB resident during transcription. Verify no OOMs on iPhone SE 2nd gen (lowest spec actively used by testers, if present).

### Telemetry

- Log to existing `analyticsService`: `transcription_started`, `transcription_completed` with `{ engine: 'on-device'|'cloud', model: 'tiny'|'base', latencyMs, audioDurationMs, success }`.
- **Never** log transcript content. Audit by code review.

---

## 8. Success Metrics

- **Compliance:** H01 audit tripwire passes on `main` for the first time. Zero under-13 calls to `transcribeAudio` action observable in Convex logs over a 7-day window post-launch.
- **Quality:** Manual QA on 10 K-2 voice samples (varied accents, background noise) shows no truncation; full multi-sentence transcripts captured.
- **Latency:** P50 transcription latency for a 10-second utterance ≤2s on iPhone 12; P95 ≤4s.
- **Bundle:** App install size delta ≤50MB.
- **Adoption (13+ cloud opt-in):** ≤20% of 13+ users opt into cloud after disclosure (a sanity check — if it's much higher, disclosure copy may not be conveying the trade-off).
- **Consent integrity:** 100% of cloud-opt-in toggles produce a `consentEvents` row.
- **No regressions:** All existing tests pass; no new redbox crashes in TestFlight crash logs over a 7-day window.

---

## 9. Resolved Decisions

- **D-1 — Age determination source: `userProfile.gradeLevel`.** (Resolved 2026-05-11.) The age proxy is the user's selected grade band, not date of birth. The `GradeLevel` literal union (`'K-2' | '3-5' | '6-8' | '9-12'`, defined in `src/types/database.ts:13`) is already a first-class field in `userProfiles` and is Convex-validated via `gradeLevelValidator` in `convex/schema.ts:17`. The mapping:

  - `'K-2'`, `'3-5'`, `'6-8'` → treat as under-13 (on-device only). `6-8` is conservatively grouped here because it spans ages ~11–14 and contains under-13 students.
  - `'9-12'` → treat as 13+ (cloud opt-in eligible).
  - `undefined` / missing → treat as under-13 (fail-safe, matches the existing convention in `src/utils/childFriendlyErrors.ts:99-103` where missing grade defaults to "young").
  - **Sub-question for implementation:** The schema has two grade fields — `preferredGradeLevel` (`convex/schema.ts:230`) and `gradeLevel` (line 280). US-006 must read `gradeLevel` (the canonical user profile field), not `preferredGradeLevel` (a per-session/preference value). Verify during implementation that this assumption matches actual usage; if the canonical field has been renamed since this PRD was drafted, update the helper accordingly.

- **D-2 — `whisper.rn` compatibility verified for Expo SDK 54.** (Resolved 2026-05-11 via research spike.) Findings are documented in companion file `spike-q1-whisper-rn-expo54.md` in this directory. Summary:
  - **Decision:** Proceed with `whisper.rn` pinned to exact version `0.5.5`.
  - **Two known issues require accommodation, both incorporated into the PRD:**
    1. _Sample rate must be exactly 16000 Hz mono 16-bit PCM._ Otherwise whisper.rn silently truncates transcription to ~1 second (issue #299). Encoded into US-004 acceptance criteria with a dedicated config regression test.
    2. _Library uses `exports` in package.json, breaking RN codegen autolinking._ Workaround: add `react-native.config.js` with explicit override. Encoded into US-001 acceptance criteria.
  - **Risks carried forward (not blockers):**
    - Release-build model load failures (issue #286) — covered by US-002 validation requirement that the test runs on `--configuration Release`, not just dev build.
    - RN version gap (library example tests on 0.84; we're on 0.81.5) — mitigated by exact-version pin on `0.5.5`.
    - Bundle-size delta not yet measured — gated by US-002's ≤45MB validation check.
  - **Spike did NOT install the package**; findings are from npm metadata + GitHub issues + commit log. Install-time validation happens during US-001.

## 10. Open Questions

- **Q1 — Model download UX during first launch:** Should the user see download progress, or is silent background download acceptable? Currently scoped as silent in US-003. If product wants visible progress, that's a small US-003a follow-up.
- **Q2 — H01 tripwire location after rewrite:** The current file path implies "this is a tripwire." After conversion to passing test, should it move to a regular `coppa/` test directory, or stay as a clearly-marked invariant test? Suggest: keep path, update naming convention internally.
- **Q3 — PR #88 fate:** This PRD's US-012 supersedes PR #88's policy redline. Close PR #88 as superseded, or rebase its content into this work? Recommended: close PR #88 with a comment linking to this PRD.
- **Q4 — Manual QA budget:** Several stories (US-005, US-007, US-008) require real-device QA with K-2 voices. Who runs that QA, and what's the sample set? Suggest: 5 internal testers' kids, varied ages 5–7, varied accents, recording 3 stories each.

---

## 11. Implementation Order (Suggested)

The dependency graph allows some parallelization, but a linear order minimizes risk:

1. US-001 (whisper.rn foundation) — blocks everything
2. US-002 (bundle tiny model)
3. US-005 (on-device transcription service) — can validate end-to-end without UI yet
4. US-004 (audio capture service) — independent of US-005
5. US-006 (age-gate policy helper) — pure function, no deps
6. US-003 (lazy-download base) — orthogonal, can land any time after US-002
7. US-007 (VoiceInput.tsx push-to-talk rewrite) — depends on 4, 5, 6
8. US-008 (auto-stop prompt) — depends on US-007
9. US-009 (Settings toggle) — depends on US-006 for routing
10. US-010 (consent modal) — depends on US-009
11. US-011 (Android hide) — independent, can land any time
12. US-012 (privacy policy) — should land before public release; can be drafted in parallel
13. US-013 (H01 tripwire conversion) — last; validates the whole feature

Estimated total effort: 6–9 focused engineering sessions plus ~2 sessions of manual QA on real devices.

---

## Checklist

- [x] Asked clarifying questions with lettered options (5 questions answered: 1A, 2A, 3A, 4C, 5C)
- [x] Incorporated user's answers (iOS-only, push-to-talk, bundle tiny + lazy base, dual-stack 13+ toggle, cloud preserved as 13+ opt-in)
- [x] User stories are small and specific (13 stories, each one-session-implementable)
- [x] Each story has a Validation Test subsection per user requirement
- [x] Functional requirements numbered and unambiguous (FR-1 through FR-12)
- [x] Non-goals section defines clear boundaries (Android, streaming, multilingual, etc.)
- [x] Saved to `.claude/.agent/Tasks/prd-on-device-voice-transcription.md`
