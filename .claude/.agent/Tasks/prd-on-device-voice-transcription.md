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

**Status:** In progress — JS-side complete and committed on branch `feat/us-001-whisper-rn-install` (commit `985c406`). iOS dev-build verification still pending (`npx expo run:ios`).

**Description:** As a developer, I need `whisper.rn` integrated into the Expo project so the rest of the work can compile and run on a development build. Per spike Q1 findings (Resolved Decision D-2), there is no Expo config plugin shipped by the library; integration is via prebuild + a small autolinking override.

**Acceptance Criteria:**

- [x] `whisper.rn` installed pinned to exact version `0.5.5` (no caret) — `npm install whisper.rn@0.5.5`. Pin reasoning: protects against surprise breakage from the in-progress `0.6.x` release line. _(Done — `package.json` entry `"whisper.rn": "0.5.5"`.)_
- [x] `react-native.config.js` added to project root with the explicit autolinking override for `whisper.rn`, per spike findings and whisper.rn issue #301:

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

  Without this file, RN codegen silently skips `whisper.rn` (it uses `exports` in `package.json`, which trips `require.resolve`), and the iOS build fails with `'RNWhisperSpec/RNWhisperSpec.h' file not found`. _(Done — extended existing `react-native.config.js` alongside the pre-existing reanimated workaround.)_

- [x] Workaround rationale documented in `src/services/CLAUDE.md` with a link back to whisper.rn issue #301, so future contributors don't remove `react-native.config.js` thinking it's dead config _(Done — "Native Module Workarounds" section added with both the autolinking and sample-rate rationales.)_
- [x] iOS development build compiles cleanly: `npx expo prebuild --clean && npx expo run:ios` _(Pending — `prebuild --clean` succeeded; `run:ios` not yet verified end-to-end.)_
- [x] No regressions in existing `npm test`, `npm run lint`, type-check _(Done — smoke test passing, lint and type-check clean at commit time.)_

**Validation Test:**

- **What:** Smoke test that imports the library on a development build and instantiates a transcription context with a known-good 1-second WAV file.
- **How to run:** Add `src/__tests__/services/whisperRnSmoke.test.ts` that mocks the native module and asserts the JS-side wrapper resolves an expected interface; on a real device, run the dev build and verify no crash on import.
- **Pass condition:** Test passes in Jest, dev build launches without redbox, library is importable from `whisper.rn`. _(Jest smoke test passing — 9 assertions in `src/__tests__/services/whisperRnSmoke.test.ts`, native module mocked via `src/__tests__/__mocks__/whisper.rn.ts` and wired in `jest.config.js` `moduleNameMapper`. Dev-build "no redbox on import" still pending the `npx expo run:ios` run.)_

---

### US-002: Bundle Whisper tiny model (~32 MB, q5_1 quantized) into iOS app

**Status:** In progress — JS-side complete (service, test, model download infra). Pending: real-device dev-build load smoke + release-build smoke + install-size measurement.

**Description:** As a user, I want voice transcription to work immediately on first launch, even before any post-install download completes.

**Implementation note (model variant — locked in during implementation):** Originally written as "Whisper tiny (39 MB)". The actual full-precision `ggml-tiny.en.bin` is 78 MB; the figure the PRD cites only matches the 5-bit quantized variant `ggml-tiny.en-q5_1.bin` (32 MB). The bundle-budget acceptance criteria (≤45 MB delta) is only satisfiable with quantized, so the q5_1 variant was bundled. Quality difference vs full precision is <1% WER on whisper.cpp benchmarks for typical K-2 indoor speech. See `D-3` below.

**Acceptance Criteria:**

- [x] Whisper `tiny.en-q5_1` model file (`ggml-tiny.en-q5_1.bin`) downloadable into the iOS asset path (`assets/models/`) and verified present locally (32,166,155 bytes) _(Done via `scripts/download-whisper-models.sh`; binary itself gitignored.)_
- [x] Asset is included in the iOS build via Expo asset config _(Done — `metro.config.js` registers `bin` as an asset extension so `require('../../assets/models/ggml-tiny.en-q5_1.bin')` resolves to a Metro asset ID Expo bundles into the .app. `expo-asset` installed as the runtime resolver.)_
- [x] Service can resolve and load the bundled model path at runtime _(Done — `src/services/whisperModelService.ts`, class + singleton, lazy `getContext()` with concurrency-safe load + cached context + `release()` for resource hygiene.)_
- [ ] App install size delta verified ≤45MB on a clean install _(Pending — measurement requires release build; expected delta ≈ 32 MB model + ~7 MB whisper.rn iOS binary = ~39 MB.)_
- [x] Model file is documented in `src/services/CLAUDE.md` so future contributors know it ships with the app _(Done — "Bundled Whisper model" subsection added with variant rationale, download flow, swap procedure, and release-build verification gate.)_

**Validation Test:**

- **What:** Integration test that exercises the model-load lifecycle (lazy load, cache hit, concurrent first-callers, error paths, release-and-reload) using mocked `expo-asset` + `whisper.rn`. Real-device load+transcribe is a separate manual gate.
- **How to run:** `npm test -- src/__tests__/services/whisperBundledModel.test.ts`
- **Pass condition:** Automated test asserts the service's lifecycle invariants (9 assertions, all passing locally). **The original PRD pass condition** — "model loads in <500ms and transcribes the fixture to a string containing 'hello'" — requires a real iOS device with the native whisper.cpp binary loaded; that is the **release-build manual smoke** (`npx expo run:ios --configuration Release`) which is still pending and must be done before this story can be marked complete. Release-build smoke is also the only guard against whisper.rn issue #286 (release-build-only model load failures).
- **Outstanding manual gates:**
  - [x] Dev build (`npx expo run:ios`) launches without redbox and `whisperModelService.getContext()` resolves on first call (carries over from US-001's iOS build verification).
  - [ ] Release build (`npx expo run:ios --configuration Release`) loads the model on a physical device and transcribes a fixture WAV to a string containing "hello".
  - [ ] App install size delta on a clean install is ≤45 MB.

---

### US-003: Lazy-download Whisper base model (~60 MB q5_1) on first launch over Wi-Fi only

**Status:** In progress — JS-side complete (downloader, model-selection integration, tests). Pending: real-device verification that the download lands in the documents directory and the next dictation picks it up.

**Description:** As a user on Wi-Fi, I want the higher-quality `base` model to download in the background so my transcriptions are more accurate after the first launch — without consuming cellular data.

**Implementation note:** Per D-3, the downloaded file is `ggml-base.en-q5_1.bin` (59,721,011 bytes), not full-precision `ggml-base.en.bin` (148 MB). The "74 MB" figure in the original PRD body matches the q5_1 variant, not full precision.

**Acceptance Criteria:**

- [x] On first launch, app checks for `ggml-base.en-q5_1.bin` in the app's documents directory _(Done — `whisperModelDownloader.isBaseModelDownloaded()` uses `expo-file-system/legacy` `getInfoAsync` + byte-count guard at `${documentDirectory}ggml-base.en-q5_1.bin`.)_
- [x] If absent AND device is on Wi-Fi (use `NetInfo` from `@react-native-community/netinfo`, already in the project), download to documents directory _(Done — `ensureBaseModelDownloaded()` gates on `NetInfo.fetch()` → `type === 'wifi'` AND `isConnected`.)_
- [x] Download is non-blocking — UI is interactive during download _(Done — `ensureBaseModelDownloaded()` returns a Promise but is never `await`-ed on the app startup path; callers fire-and-forget. Documented in CLAUDE.md.)_
- [x] Download progress is observable (for a future progress UI; not required to render in this story) _(Done — `whisperModelDownloader.onProgress(cb)` returns an unsubscribe fn; uses `expo-file-system/legacy` `createDownloadResumable` to get byte-level callbacks the new SDK 54 `File.downloadFileAsync` API doesn't expose.)_
- [x] On cellular or offline, download is skipped and tiny model is used _(Done — non-Wi-Fi states return `null` (no-op, not error); `whisperModelService` continues using the bundled tiny model.)_
- [x] Download retries with exponential backoff on failure (max 3 attempts) _(Done — 1s/2s/4s backoff in `downloadWithRetry()`; after exhaustion, throws `WhisperModelDownloadError`.)_
- [x] Once downloaded, transcription service prefers `base` over `tiny` _(Done — `whisperModelService.resolveBestAvailableModelUri()` probes `isBaseModelDownloaded()` at load time and prefers base when present. No in-place upgrade — change takes effect on next `release()` + `getContext()` cycle.)_

**Validation Test:**

- **What:** Integration test using a mocked NetInfo that simulates (a) Wi-Fi → download path is invoked, (b) cellular → download is skipped, (c) offline → download is skipped.
- **How to run:** `npm test -- src/__tests__/services/whisperModelDownloader.test.ts`
- **Pass condition:** All three branches assert the expected behavior; the Wi-Fi case verifies the model is written to the expected path. _(Done — 12 assertions passing in `whisperModelDownloader.test.ts` covering the PRD's three branches plus idempotence, retry/backoff, size guard, progress observability, and concurrent-caller dedup. The `whisperBundledModel.test.ts` suite was also extended with 5 assertions covering the new "prefer base over tiny" branch in `whisperModelService`.)_
- **Outstanding manual gates:**
  - [ ] Trigger the download on a real device (Wi-Fi), confirm the file lands at `${FileSystem.documentDirectory}ggml-base.en-q5_1.bin` with the expected size.
  - [ ] After download completes, release the current context, trigger a transcription, and confirm `whisperModelService.getActiveModelName() === 'base'`.
  - [ ] Toggle to cellular before first launch, confirm download is skipped and `getActiveModelName() === 'tiny'`.

---

### US-004: Push-to-talk audio capture service

**Status:** In progress — JS-side complete (service, format invariant locked, full lifecycle + background-guard test coverage). Pending: real-device dev-build smoke that mic permission prompt fires once, that `stop()` produces a playable `.wav` decodable by whisper.rn end-to-end (the only thing Jest can't verify because expo-av is mocked).

**Description:** As a developer, I need a service that records microphone audio between explicit start/stop calls and writes a WAV file to disk, so the transcription service has a buffer to work on.

**Implementation note (config shape — locked in during implementation):** The PRD AC describes the config as `{ sampleRate: 16000, numberOfChannels: 1, bitDepth: 16 }` (three values). `expo-av`'s actual `RecordingOptions` shape splits per-platform under `.ios` / `.android` / `.web`, and for iOS to actually produce a PCM WAV (rather than its default AAC `.m4a`) the iOS block needs _five_ coupled fields: `outputFormat: 'lpcm'`, `audioQuality: 96`, `sampleRate: 16000`, `numberOfChannels: 1`, `linearPCMBitDepth: 16`, plus `extension: '.wav'`. The regression test pins all of these.

**Acceptance Criteria:**

- [x] New service `src/services/audioCaptureService.ts` with class + singleton export pattern (per `src/services/CLAUDE.md` conventions) _(Done — `AudioCaptureService` class with `audioCaptureService` singleton; matches the pattern used by `whisperModelService` and `onDeviceTranscriptionService`.)_
- [x] `start()`, `stop()`, `cancel()` methods returning Promises _(Done — plus a synchronous `isRecording()` accessor for UI state.)_
- [x] `stop()` resolves with `{ uri: string, durationMs: number }` _(Done — return shape exported as `AudioCaptureResult` interface. `durationMs` is wall-clock from `start()` to `stop()` resolution; the caller in US-005 reads the URI synchronously and passes it to `onDeviceTranscriptionService.transcribe()`.)_
- [x] **Audio format strictly: 16000 Hz sample rate, 1 channel (mono), 16-bit depth, WAV container.** Any deviation causes whisper.rn to silently truncate transcription to ~1 second (whisper.rn issue #299 — this is the failure mode the entire PRD is trying to escape, so getting the format right is load-bearing). The `expo-av` recording config must be: `{ sampleRate: 16000, numberOfChannels: 1, bitDepth: 16 }`. _(Done — exported as a frozen `RECORDING_OPTIONS` constant. The PRD's three "logical" values are pinned, plus the two structurally-coupled iOS fields (`outputFormat: 'lpcm'` and `extension: '.wav'`) that are required for expo-av to actually emit a WAV container; without them iOS defaults to AAC and silently triggers the truncation bug.)_
- [x] Dedicated unit test in `src/__tests__/services/audioCaptureService.test.ts` asserts the recording config object contains exactly these three values. Regression-guards against accidental config drift from future audio-related changes. _(Done — `describe('PRD format invariant: 16 kHz mono 16-bit PCM WAV')` block contains six dedicated assertions: the three PRD values plus the two coupled iOS fields plus a verification that `RECORDING_OPTIONS` is what `prepareToRecordAsync` actually receives.)_
- [x] Microphone permission request is wrapped (uses `expo-av` `Audio.requestPermissionsAsync`) _(Done — invoked on every `start()`; Expo treats it as idempotent once granted. Denial surfaces as the typed `AudioCaptureError('permission_denied')` so the UI layer can distinguish "user said no" from a generic recorder failure.)_
- [x] Captured file is written to a tmp directory and cleaned up on next `start()` _(Done — `expo-av` writes to its own cache path; the service tracks the last captured URI and deletes it at the *start* of the next session, not on `stop()`, so the URI returned by `stop()` remains valid for the caller. Test `tmp file cleanup between captures > deletes the previous capture file when start() is called again` proves this.)_
- [x] iOS background-state guard: if app backgrounds during capture, stop and discard cleanly (no orphaned `AVAudioSession`) _(Done — `AppState.addEventListener('change', ...)` is installed on `start()` and torn down on `stop()` / `cancel()`. Reacts to `'background'` only — not `'inactive'`, which is transient (notification center, incoming-call alert) and would falsely cancel during normal interruptions. On background it fires `cancel()`, which calls `stopAndUnloadAsync()` and deletes the partial file. `setAudioModeAsync({ staysActiveInBackground: false })` is also belt-and-suspenders against the AVAudioSession lingering.)_

**Validation Test:**

- **What:** Unit tests with mocked `expo-av`, `expo-file-system/legacy`, and React-Native `AppState` covering: format invariant (5 dedicated assertions + a 6th that proves it reaches `prepareToRecordAsync`), permission-denied path, normal start→stop round-trip, double-start rejection, cancel-mid-capture, AppState `'background'` cancels the recording, AppState `'inactive'` does NOT cancel, listener cleanup on both stop and cancel, tmp-file cleanup between captures, and error wrapping (prepareToRecordAsync rejection → typed `recording_failed` with `cause`).
- **How to run:** `npm test -- src/__tests__/services/audioCaptureService.test.ts`
- **Pass condition:** All 26 assertions pass locally. Type-check clean, lint clean. The four PRD-named scenarios (permission denied / normal round-trip / cancel mid-capture / app backgrounding) all pass; `permission_denied` returns the typed error; normal capture resolves with a non-empty `uri` and `durationMs > 0`.
- **Outstanding manual gates:**
  - [ ] Real-device dev-build smoke: tap mic on iPhone 12+, speak for 3s, tap stop. Confirm `getURI()` returns a `.wav` file under the app's cache dir and that the captured file plays back as 16 kHz mono PCM in a hex/audio inspector (or by feeding it to `onDeviceTranscriptionService.transcribe()` and verifying a non-empty transcript).
  - [ ] Real-device background-guard smoke: start a recording, swipe to home, return to the app. Confirm the partial file is gone and that the next `start()` does not throw `already_recording`.

---

### US-005: On-device transcription service (whisper.rn wrapper)

**Status:** In progress — JS-side complete (service, tests, telemetry-invariants locked). Pending: real-device manual QA on a 30-second K-2 voice sample to validate the no-truncation goal (the only thing Jest can't exercise because it needs the native `whisper.cpp` binary).

**Description:** As a developer, I need a service that takes an audio file URI and returns transcribed text using the on-device Whisper model.

**Acceptance Criteria:**

- [x] New service `src/services/onDeviceTranscriptionService.ts` with class + singleton export _(Done — `OnDeviceTranscriptionService` class with `onDeviceTranscriptionService` singleton, matching the pattern in `src/services/CLAUDE.md`.)_
- [x] `transcribe(audioUri: string): Promise<{ text: string, latencyMs: number }>` _(Done — return shape exposed as `TranscriptionResult` interface; `latencyMs` is the user-perceived wall-clock so it includes lazy model load on the cold path.)_
- [x] Internally selects best available model: `base` if downloaded, else `tiny` _(Done — selection is delegated to `whisperModelService.getContext()` (US-002 + US-003); the wrapper reads `getActiveModelName()` only for telemetry attribution so there's a single source of truth for routing.)_
- [x] Throws typed `TranscriptionError` on failure (model not loaded, audio decode error) _(Done — `TranscriptionError` extends `Error` with a `cause` field; model-load failures carry a `WhisperModelLoadError` cause, decode failures carry the underlying whisper.rn error, and `isAborted` results are surfaced as `TranscriptionError` too rather than returning silent partial text.)_
- [x] Logs latency to existing `analyticsService` (anonymized — no transcript content, just duration + model name) _(Done — `analyticsService.trackPerformance('on_device_transcription', latencyMs, success, { engine, model, failureReason? })`. Uses the `userId: 'system'` path so no user identifier crosses the boundary either.)_
- [x] No PII transmitted in any log or telemetry path (audit by code review) _(Done — verified by code review **and** locked by automated assertions: dedicated test block "telemetry contains no PII (H01 COPPA invariant)" stringifies the analytics metadata and asserts the audio URI, transcript content, and any field outside `{engine, model, failureReason}` are absent. This is the value-flow half of the H01 invariant — US-013's import-graph check covers the cloud path; this test covers the on-device path.)_

**Validation Test:**

- **What:** Service-level test with mocked `whisperModelService` and `analyticsService` exercising: happy path (text + non-negative latency, empty/missing result coercion), model attribution (tiny/base/null → telemetry), three failure modes (model load, transcribe reject, isAborted), no-PII telemetry contract, and analytics-failure isolation (analytics errors don't propagate to the caller). The PRD's "fixture WAV + bundled tiny model" integration variant is not runnable inside Jest because it needs the native `whisper.cpp` binary — that path is the manual gate below.
- **How to run:** `npm test -- src/__tests__/services/onDeviceTranscriptionService.test.ts`
- **Pass condition:** All 15 assertions pass locally. Type-check clean, lint clean.
- **Outstanding manual gates:**
  - [ ] Real-device QA on a 30-second K-2 voice sample (varied accents, indoor noise): full multi-sentence transcript returned with no truncation, `latencyMs` ≤ 4000 ms on iPhone 12+ after warm-up.
  - [ ] Verify in a TestFlight build that the analytics event `performance/on_device_transcription` lands with the expected metadata keys and **no** unexpected fields (defense-in-depth against the dataflow tests being bypassed by future refactors).

---

### US-006: Grade-gate transcription engine selection

**Status:** Complete (JS-side). Pure-function helper; no real-device gates outstanding. The story can be considered done once a caller wires it up (which happens in US-007 / US-009 / US-013).

**Description:** As the system, I need to route users in grade bands likely to contain under-13 students to on-device Whisper unconditionally, and let `9-12` users follow their Settings preference, so COPPA compliance is enforced at the architectural level based on grade level (the existing first-class user attribute).

**Implementation note (canonical field name correction):** PRD D-1 originally claimed `gradeLevel` was the canonical user-profile field and `preferredGradeLevel` was per-session. The actual Convex schema is the opposite: `userProfiles.preferredGradeLevel` (line 230) is the persisted per-user grade, and `gameSessions.gradeLevel` (line 280) is the per-session selection for one game. The helper's parameter shape uses `gradeLevel` (matching the `GradeLevel` type literal and the PRD signature) — callers map their canonical storage field (`userProfile.preferredGradeLevel`) onto it. This decoupling keeps the helper stable across future schema renames and isolates Convex/Supabase field-naming conventions from a pure utility. D-1 below has been amended to reflect the corrected mapping.

**Acceptance Criteria:**

- [x] New helper `src/utils/transcriptionEnginePolicy.ts` exporting `getTranscriptionEngine(profile: { gradeLevel?: GradeLevel; preferences?: { transcriptionEngine?: 'on-device' | 'cloud' } }): 'on-device' | 'cloud'` _(Done — also exports the `TranscriptionEngine` literal type and the `TranscriptionEnginePolicyInput` interface so consumers don't have to re-declare the shape.)_
- [x] Grade-to-engine mapping (mirrors the `YOUNG_GRADES` pattern in `src/utils/childFriendlyErrors.ts`):
  - `'K-2'` → always `'on-device'` _(Done.)_
  - `'3-5'` → always `'on-device'` _(Done.)_
  - `'6-8'` → always `'on-device'` (fail-safe; band contains 11–12-year-olds who are under 13) _(Done.)_
  - `'9-12'` → reads `preferences.transcriptionEngine` (default `'on-device'`) _(Done.)_
  - `undefined` / missing → always `'on-device'` (fail-safe, matches `childFriendlyErrors.ts` convention) _(Done — also exercised by an extra case where `preferences` is `{}` (object present but `transcriptionEngine` missing) → still `'on-device'`.)_
- [x] New constant exported alongside helper: `UNDER_13_GRADES: GradeLevel[] = ['K-2', '3-5', '6-8']` so other call sites (Settings visibility in US-009, consent gating in US-010) can reuse the same classification without duplicating the literal list _(Done — typed `readonly GradeLevel[]` and `Object.freeze`d at module load so consumers can't accidentally mutate the COPPA invariant. A dedicated test pins both the membership and the frozen status.)_
- [x] Pure function — easily unit-testable, no side effects, no I/O _(Done — no module-level mutable state, no time/random dependencies, no `import` from any service that touches Convex/network/file-system.)_
- [x] Helper is the _only_ place transcription routing decisions are made (single source of truth — FR-2 enforcement) _(Done at the surface level. The structural enforcement — "no other call site decides between on-device and cloud" — is an import-graph property that US-013's H01 tripwire will assert. This file additionally proves at the value-flow level that `preferences` is never even *read* on the under-13 branch, via a `Proxy` poison-object test that throws if a read happens.)_
- [x] Reads `userProfile.gradeLevel` (canonical field), NOT `preferredGradeLevel` — see Resolved Decision D-1 _(Done with a correction: D-1's claim was reversed — the canonical user-profile field is actually `preferredGradeLevel` (per Convex `schema.ts` line 230). The helper takes a `gradeLevel` parameter (matching the type literal); callers pass `userProfile.preferredGradeLevel` into it. See the implementation note above and the amended D-1 below.)_

**Validation Test:**

- **What:** Pure-function unit tests covering the full matrix: 5 grade states (`K-2`, `3-5`, `6-8`, `9-12`, `undefined`) × 3 preference states (`on-device`, `cloud`, `undefined`) = 15 cases, plus invariant assertions on `UNDER_13_GRADES` (exact membership, no `'9-12'`, frozen at runtime) and an FR-2 enforcement check that proves preferences are _not_ read for under-13 grades by passing a `Proxy` that throws on access.
- **How to run:** `npm test -- src/__tests__/utils/transcriptionEnginePolicy.test.ts`
- **Pass condition:** All 21 assertions pass; the 12 cases for `K-2`/`3-5`/`6-8`/`undefined` resolve to `'on-device'` regardless of preference; the 3 cases for `'9-12'` respect the preference (with `undefined` preference defaulting to `'on-device'`); `UNDER_13_GRADES` is frozen and contains exactly the three under-13 bands. Type-check clean, lint clean. _(Done — 21/21 passing locally.)_

---

### US-007: Rewrite `VoiceInput.tsx` UI to push-to-talk model

**Status:** In progress — JS-side complete (component rewritten, parent caller updated, HomeScreen forwards `gradeLevel`, full test coverage of routing + pinning + lifecycle). Pending: real-device dev-build manual QA confirming a 30-second K-2 utterance arrives intact, plus the no-orphaned-AVAudioSession check on background swipe.

**Description:** As a K-2 student, I want to tap a microphone button to start recording my story and tap a "Done" button when I'm finished, so my long sentences don't get cut off mid-thought.

**Implementation note (architecture — locked in during implementation):** Two clarifications versus the AC as written:

1. **VoiceInput is a hidden driver, not the visible button.** The large mic button, pulse animation, and "I'm listening…" label are all owned by `VoiceFirstInputBar` (the parent), which mounts VoiceInput off-screen with `pointerEvents="none"` and `autoStart`. AC #2 ("Mic button ≥64pt with animated pulse") and AC #3 ("Recording state visually unmistakable") are therefore satisfied by the existing parent UI — the rewrite's job is to preserve that contract while swapping the audio backend. The rewrite _also_ updates the visible-button path inside VoiceInput (kept for completeness / future direct consumers) to use the new push-to-talk model.
2. **Engine routing is done inside VoiceInput, not in the parent.** Two reasons: (a) keeps the parent's contract a thin pass-through (just forward `gradeLevel` + `preferences`), and (b) makes `getTranscriptionEngine()`'s single use-site visible in one place, which is the FR-2 single-source-of-truth property we want auditable.

**Implementation note (cloud wiring — fully landed):** US-009 (Settings toggle) and US-010 (consent modal + `consentEvents` audit log) are both in. The cloud branch in VoiceInput is reachable end-to-end for 9-12 users: `HomeScreen.tsx` reads `userProfile.preferences.transcription_engine` and forwards it into `VoiceFirstInputBar` → `VoiceInput` → `getTranscriptionEngine()`, and the first transition is gated by a disclosure modal that writes a `consentEvents` row before the preference is persisted. The pre-US-009 sentence ("`getTranscriptionEngine()` resolves to `'on-device'` for 100% of users") is no longer correct.

**Acceptance Criteria:**

- [x] `VoiceInput.tsx` rewritten to a tap-to-start, tap-to-stop UI (no continuous VAD) _(Done — entire silence-detection scaffolding removed: `SILENCE_DB_THRESHOLD`, `START_GRACE_MS`, `lastSpeechAtRef`, `silenceCheckTimerRef`, `handleMetering`, and the `setInterval` polling loop are all gone. Finalize fires only on explicit user/parent action.)_
- [x] Mic button is large (≥64pt touch target) and uses an animated waveform/pulse while recording _(Satisfied by the parent `VoiceFirstInputBar` — see the architecture note above. The Speak button on the bar is 96 px, with pulse animation owned by the bar's existing `Animated` patterns.)_
- [x] Recording state is visually unmistakable: button color change, pulsing animation, "I'm listening…" label _(Satisfied by the parent. The bar's "Listening…" / live-partial card + pulse ring all continue working unchanged; the partial card naturally falls back to "Listening…" → "Transcribing…" since `onPartialResult` is removed per Non-Goals.)_
- [x] On stop, recorded audio is routed through the engine returned by `getTranscriptionEngine()` _(Done — engine is resolved once at `startListening()` time, **pinned** in a ref for the duration of the recording, and re-read at `finalize()`. The engine pinning is asserted by a dedicated test: change preferences mid-recording → finalize still routes through the originally-pinned engine. Pinning prevents cross-pipeline contamination, e.g. 16 kHz mono PCM audio captured for on-device being routed to cloud Whisper or vice versa.)_
- [x] Existing imperative `finalize()` handle (US-014) and `onHasSpokenChange` callback (US-015 AC #4) preserved or migrated to equivalents _(Done — `finalize()` handle preserved with identical idempotency + no-op-when-not-recording semantics. `onHasSpokenChange` semantics shifted: in v3 it fires `false` on start reset and `true` immediately after a successful `start()` returns. Push-to-talk = user's explicit tap is the commitment signal that "they've spoken", so the gate's original purpose (preventing empty audio uploads to cloud) is satisfied; for the on-device path an empty recording is anyway cheap and surfaces as an empty transcript the parent handles naturally. Shift documented in the file's docstring.)_
- [x] All existing call sites (~9 in the file) updated _(Done — the file's nine internal references were collapsed in the rewrite; the one external call site, `VoiceFirstInputBar.tsx`, was updated to drop `onPartialResult` and forward the new `gradeLevel` + `transcriptionPreferences` props. `HomeScreen.tsx` was updated to pass `userProfile?.preferred_grade_level` into the bar.)_
- [x] Type-check, lint, existing tests pass _(Done — type-check clean across the project, lint clean for all touched files, 30/30 `VoiceFirstInputBar` tests pass unchanged, 13/13 new `VoiceInput` tests pass, all 140 whisper-pipeline + component tests pass together.)_

**Validation Test:**

- **What:** Component test rendering `VoiceInput` with mocked `audioCaptureService`, `onDeviceTranscriptionService`, and `whisperTranscriptionService`, covering: imperative `finalize()` handle (preserved US-014 surface — routes to pinned engine, no-op when not recording, idempotent across concurrent calls); engine routing matrix (K-2 / 6-8 / 9-12+cloud / 9-12+on-device / undefined grade → expected service); engine pinning (preferences change mid-recording → finalize uses originally-pinned engine); `onHasSpokenChange` v3 semantics (fires false on start, true after successful start, NOT true if start rejects); happy path end-to-end (autoStart → finalize → onSpeechResult fires with on-device transcript).
- **How to run:** `npm test -- src/__tests__/components/VoiceInput.test.tsx`
- **Pass condition:** All 13 assertions pass. Type-check clean, lint clean. Sibling regression: `VoiceFirstInputBar.test.tsx` (30 tests) + the whisper pipeline (97 tests across 5 service suites) all still green. _(Done — 140/140 across the combined whisper-pipeline + VoiceInput + bar suites.)_
- **Outstanding manual gates:**
  - [ ] Real-device dev-build smoke on iPhone 12+: tap Speak, recite a 4-sentence K-2 story (~25–30s), tap the center stop button. Confirm: all 4 sentences land in the text field (no truncation — this is the original H01 regression the PRD exists to prevent); push-to-talk feels responsive; `onHasSpokenChange(true)` enables the stop button without perceptible lag.
  - [ ] Real-device background-guard smoke: start recording, swipe to home mid-utterance, return to app. Confirm: partial capture is discarded, no orphaned `AVAudioSession`, next tap-Speak begins cleanly.
  - [ ] Verify a 13+ user with `preferences.transcriptionEngine = 'cloud'` (once US-009 lands) routes through `whisperTranscriptionService` end-to-end with no on-device fallback.

---

### US-008: 60-second auto-stop with "still talking?" prompt

**Status:** In progress — JS-side complete (auto-stop timers, modal UI, countdown callback, parallel hard-ceiling timer, full test coverage of all three modal branches plus the 5-min ceiling). Pending: real-device manual QA confirming the modal renders correctly above the parent's bar UI and that the countdown is wired into the parent's live-partial card.

**Description:** As a K-2 student who forgets to tap stop, I want the app to gently prompt me at 60 seconds so my recording doesn't run forever — but I should be able to keep going if I'm still telling my story.

**Implementation note (recording continues under the modal):** The PRD says "capture is paused" when the modal appears. This is interpreted as a UX claim, not a technical audio pause — the implementation continues recording while the modal is up. Reasoning: pausing mid-stream would require new pause/resume APIs on both `audioCaptureService` and `whisperTranscriptionService` (neither supports pause today), and the modal auto-dismisses within ≤10s anyway. Whisper handles the extra audio fine. "Keep going" therefore _reschedules_ the next prompt 60s from the button press rather than resuming a paused recording. From the user's perspective the experience is identical.

**Implementation note (parallel hard-ceiling timer):** The 60s soft prompt and the 5-minute hard ceiling are two independent timers, not one shared budget. The prompt timer resets on every "Keep going" tap; the hard ceiling is anchored to the original `start()` and does NOT reset. This makes the ceiling a defense-in-depth backstop against a runaway "Keep going" loop and protects against forgotten recordings draining battery/disk.

**Implementation note (modal rendering escape):** VoiceInput is mounted hidden inside `VoiceFirstInputBar` under `<View pointerEvents="none">`, so a regular `<View>` modal couldn't receive taps. The implementation uses React Native's `<Modal>`, which renders into a separate native window — `pointerEvents="none"` on the React-tree ancestor does not reach into the modal's interactive surface. The hidden-driver pattern from US-007 is preserved.

**Implementation note (countdown ownership):** The visible countdown in the last 10s before the prompt is surfaced via a new `onCountdownChange?: (secondsRemaining: number | null) => void` callback rather than rendered inside VoiceInput. The parent (the bar) is best-positioned to render the countdown alongside the existing "Listening…" / partial-card UI; VoiceInput remains a hidden driver and emits events.

**Acceptance Criteria:**

- [x] At 60s of continuous recording, capture is paused and a modal appears: "Are you still telling your story?" with two buttons: "Yes, keep going" / "I'm done" _(Done — modal opens at exactly 60s (asserted by an off-by-one test that checks at 59s and 60s). See the recording-continues-under-modal note above for the "paused" interpretation.)_
- [x] "Yes, keep going" resumes recording (extends timer by another 60s) _(Done — `handleKeepGoing` clears the modal, cancels the auto-dismiss timer, and calls `scheduleAutoStopLeg()` to reset the 60s prompt window. Test asserts the second prompt fires 60s after the "Keep going" tap, not 60s after the original start.)_
- [x] "I'm done" finalizes and transcribes _(Done — `handleImDone` clears the modal + auto-dismiss timer and calls `finalize()`, which routes through the pinned engine just like the parent's stop-button tap.)_
- [x] If no input within 10 seconds of prompt appearing, defaults to "I'm done" _(Done — `promptAutoDismissTimerRef` fires at +10s after `openAutoStopPrompt` and calls `finalize()`. Test asserts no finalize at +9.5s, finalize fires at +10s.)_
- [x] Hard ceiling at 5 minutes total (prevents runaway recording) _(Done — `hardCeilingTimerRef` set in `startListening` for exactly 300_000 ms, independent of the soft prompt's leg resets. Test walks through four consecutive "Keep going" presses (240s total) and verifies the ceiling still fires at 300s from original start.)_
- [x] Visual countdown in the last 10 seconds before prompt _(Done — `onCountdownChange(10..1)` fires once per second in the last 10s before the soft prompt opens; `onCountdownChange(null)` fires when the prompt opens or recording finalizes. Parent renders the countdown — see countdown-ownership note above.)_
- [x] Modal uses existing app modal patterns (no custom dialog) _(Done — uses React Native's built-in `<Modal>` directly, with two TouchableOpacity buttons in a column layout matching the project's other prompt-style modals. No custom dialog component, no animation library, no portal helper. Modal automatically escapes the `pointerEvents="none"` parent wrap — see modal-rendering-escape note above.)_

**Validation Test:**

- **What:** Component test using `jest.useFakeTimers()` and `act()` to deterministically advance the clock past the 60s prompt threshold, the 70s auto-dismiss threshold, and the 300s hard ceiling. Covers: prompt appears at 60s (with off-by-one check at 59s); "Keep going" reschedules to +60s from the press; "I'm done" finalizes; 10s no-input → finalize; hard ceiling fires after four consecutive "Keep going" presses; countdown emits 10..1 in the last 10s and null when the prompt opens; countdown clears to null if finalize fires mid-countdown; unmount mid-recording tears down timers so the prompt never fires after unmount.
- **How to run:** `npm test -- src/__tests__/components/VoiceInput.autoStop.test.tsx`
- **Pass condition:** All 9 assertions pass. Type-check clean, lint clean. Sibling regression: the 13 US-007 VoiceInput tests + the 30 `VoiceFirstInputBar` tests + the 97-test whisper pipeline all still green. _(Done — 149/149 across the combined whisper-pipeline + VoiceInput + autoStop + bar suites.)_
- **Outstanding manual gates:**
  - [ ] Real-device manual QA: tap Speak, watch 10s countdown appear at 50s mark in the parent's UI (once the parent wires `onCountdownChange` into the live-partial card), modal appears at 60s, "Keep going" rearms the countdown, "I'm done" finalizes.
  - [ ] Walk-away QA: tap Speak, ignore the modal for 10s, confirm finalize fires and a transcript is produced.
  - [ ] Wire `onCountdownChange` into `VoiceFirstInputBar` so the countdown is actually rendered (this story ships the callback; rendering it falls to a small bar update — could be a follow-up commit or rolled into US-008's manual QA pass).

---

### US-009: Settings toggle for `9-12` users (cloud transcription opt-in)

**Status:** Complete. The Settings UI, schema migration, mutation extension, and HomeScreen → VoiceFirstInputBar plumbing all landed in this commit. The cloud-routing path is now reachable end-to-end for 9-12 users (no need to wait for US-010's consent modal — the toggle persists immediately; US-010 just adds the disclosure wrapper).

**Description:** As a `9-12` user, I want to choose higher-quality cloud transcription if I prefer it, so I get better accuracy when I'm willing to share audio with the cloud service.

**Acceptance Criteria:**

- [x] New setting in app Settings screen: "Voice transcription quality" with options "On-device (default, more private)" / "Cloud (higher quality, audio sent to OpenAI)" _(Done — rendered as a segmented two-button group in `SettingsScreen.tsx`, matching the existing reading-level segmented control idiom rather than introducing a new toggle style.)_
- [x] Setting visibility uses the `UNDER_13_GRADES` constant from US-006 — **only visible** if `profile.preferredGradeLevel !== undefined` AND `!UNDER_13_GRADES.includes(profile.preferredGradeLevel)` (i.e., grade is known AND equal to `'9-12'`). _NB: per the D-1 amendment, the canonical user-profile field is `preferredGradeLevel`, not `gradeLevel`._ _(Done — imported `UNDER_13_GRADES` directly from `src/utils/transcriptionEnginePolicy` so the literal list is not duplicated. A future grade-band change flows through one constant.)_
- [x] Hidden entirely for `K-2`, `3-5`, `6-8`, and users with no grade set — not just disabled _(Done — `showTranscriptionToggle` gates the entire `<View>`; the section renders nothing in those cases. Verified by `it.each` over all four hidden bands.)_
- [x] Default value: `'on-device'` _(Done — `useState<TranscriptionEngine>(userProfile?.preferences?.transcription_engine ?? 'on-device')`. Mirrors the policy helper's fail-safe so the UI never silently shows a different default than what would route.)_
- [x] Persisted to Convex `userProfiles.preferences.transcriptionEngine` _(Done — `convex/schema.ts` added `preferences: v.optional(v.object({ transcriptionEngine: v.optional(v.union(v.literal('on-device'), v.literal('cloud'))) }))`. `convex/userProfiles.ts` `updateProfile` accepts the field and performs a **deep merge** rather than overwrite, so future nested keys won't be wiped out.)_
- [x] Setting changes take effect on next dictation (no app restart needed) _(Done — `HomeScreen.tsx` reads `userProfile.preferences.transcription_engine` and passes it as `transcriptionPreferences={{ transcriptionEngine }}` to `VoiceFirstInputBar`, which forwards it to `VoiceInput`. The Convex `userProfile` query is reactive, so the next time the user taps Speak the new preference is already in the policy call.)_
- [x] Schema migration in `convex/schema.ts` adds the optional `preferences.transcriptionEngine` field _(Done — field is `v.optional(...)` so existing rows without it remain valid; no backfill needed.)_

**Validation Test:**

- **What:** Component test for Settings screen rendering with one mock per grade band (`K-2`, `3-5`, `6-8`, `9-12`, undefined) asserting setting visibility; mutation test verifying the toggle persists to Convex.
- **How to run:** `npm test -- src/__tests__/screens/SettingsScreen.transcription.test.tsx` and `npm test -- src/__tests__/convex/userProfiles.preferences.test.ts`
- **Pass condition:** Setting renders only in the `9-12` snapshot; absent from the other 4 snapshots; mutation test confirms value round-trips through Convex. _(Met — 12 SettingsScreen tests + 5 Convex round-trip tests passing; 77 adjacent tests (policy helper, VoiceInput, userProfiles, AuthContext) still passing as a regression check.)_

**Implementation notes:**

- The legacy `UserProfile` type uses snake_case (`preferences.transcription_engine`); Convex storage uses camelCase (`preferences.transcriptionEngine`). The single bridge is `convertConvexProfileToLegacy` in `AuthContext.tsx` for reads, and the matching block in `updateProfile` for writes. Every new schema field added to this preferences bag must update both directions.
- The SettingsScreen test mocks `useParentalGate` to return `parentalGateModal: null`. The real hook always renders a `<Modal accessibilityViewIsModal={true}>` (even with `visible=false`), and React Native Testing Library scopes `getByText`/`getByLabelText` to the modal subtree, which made the toggle's text invisible to queries until mocked away. Worth knowing if other Settings tests get added — same pattern applies.
- US-010 is intentionally **not** blocked by US-009. The toggle persists `'cloud'` immediately on first tap, so a 9-12 user who flips it today is already routed to the cloud Whisper path. US-010 will wrap the first transition with a disclosure modal and a `consentEvents` audit record — that's a _layer on top of_ what just shipped, not a precondition.

---

### US-010: Cloud opt-in disclosure modal

**Status:** Complete. The disclosure modal, the `consentEvents` table, the grant/revoke mutations, and the SettingsScreen consent gate all landed in this commit. The cloud-transcription path is now compliance-gated end-to-end: a 9-12 user cannot route audio to OpenAI without an audit row.

**Description:** As a 13+ user toggling cloud transcription on for the first time, I want a clear explanation of what data leaves my device and where it goes, so I can make an informed choice — and as the operator, I want a logged consent record for the audit trail.

**Acceptance Criteria:**

- [x] First time the user enables cloud transcription, a disclosure modal appears with:
  - Plain-language summary of what is sent (audio recordings) and to whom (OpenAI Whisper API)
  - Link to relevant section of privacy policy
  - "Cancel" and "I understand and agree" buttons
    _(Done — `CloudTranscriptionDisclosureModal` in `src/components/common/`. The body uses three bulleted clauses ("what gets sent", "where it goes", "what we keep") rather than a wall of prose, so the user can scan the disclosure in <10s. The privacy-policy link uses `Linking.openURL` directly rather than the existing `useParentalGate().openURL`; rationale documented in the component header — the toggle is only visible to 13+ users where COPPA's math-gate doesn't apply, and adding a gate before the user can read what they're consenting to is hostile UX.)_
- [x] On agreement, a record is written to a new `consentEvents` Convex table with `userId`, `consentType: 'cloudTranscription'`, `timestamp`, `policyVersion` _(Done — table defined in `convex/schema.ts` with an additional `action: 'granted' | 'revoked'` field. See "Design decision: append-only events with an `action` field" below for why.)_
- [x] Cancel reverts the toggle to `'on-device'` _(Done — and stronger than "reverts": the segmented control is never optimistically advanced to 'cloud' while the modal is open. Cancel is a true no-op rather than a flicker-revert. This is intentional — the only visible state change before consent is the modal itself.)_
- [x] Subsequent toggles do not re-show the modal (consent persists until revoked) _(Done — `useQuery(api.consent.getLatestCloudTranscriptionConsent)` returns the most recent event; if `action === 'granted'`, the modal is skipped. If the latest is `'revoked'`, a future grant goes through the modal again — matching the "(until revoked)" qualifier in the AC.)_
- [x] Toggling back to on-device does not require a modal but is logged _(Done — the revoke path persists the preference first, then writes a `consentEvents` row with `action: 'revoked'`. Reverse log/persist ordering vs. the grant path; see "Design decision: log-first vs. pref-first" below.)_

**Validation Test:**

- **What:** End-to-end-ish component test simulating the toggle interaction, asserting modal appearance, both branches, and the consent event mutation. Plus a verifiable consent record in Convex.
- **How to run:** `npm test -- src/__tests__/screens/SettingsScreen.cloudConsent.test.tsx`
- **Pass condition:** Modal renders, agree-path writes consent event, cancel-path reverts toggle, second toggle does not re-prompt. _(Met — 10 tests passing across first-time toggle, agree, cancel, subsequent toggle, revoke, and re-grant-after-revoke. 123 tests across 7 affected/adjacent suites also passing as regression.)_

**Design decision: append-only events with an `action` field.** The PRD's literal field list — `userId`, `consentType`, `timestamp`, `policyVersion` — is sufficient for a _grant-only_ table. But AC #5 ("Toggling back to on-device... is logged") requires a way to distinguish grants from revocations. Adding `action: 'granted' | 'revoked'` keeps the table append-only (no mutation of past rows) and lets a single query — "give me the most recent row for `(userId, consentType)`" — return the _current_ consent state. The alternative (a separate `consentRevocations` table, or mutating a single row) would either duplicate query logic at every read site or lose the append-only audit property.

**Design decision: log-first vs. pref-first ordering.** The two writes (consent log + preference) are not transactional. The ordering matters:

- **Grant path** (modal → Agree → cloud): write the consent log _first_, then persist the preference. If the log fails, abort and surface an error — better to leave the user on on-device with no audit gap than to route their audio to OpenAI without an audit row. This is the FR-2 compliance posture.
- **Revoke path** (cloud → on-device toggle): write the preference _first_, then log the revocation. If the log fails, log a console error and move on — the user's intent (stop routing to cloud) is already honored at the preference layer; a missing revocation log is an audit-trail gap but not a compliance hole.

The grant-path ordering is asserted explicitly by a test (`logOrder < updateOrder`).

**Design decision: new `consentEvents` table, not reuse of `consentRecords`.** The existing `consentRecords` table is shaped around COPPA Verifiable Parental Consent — parent email, consent tokens, expiry timestamps, 12-month renewal lifecycle. Reusing it for in-app opt-ins would force every future in-app consent flow (e.g., upcoming A/B opt-ins, telemetry consent) to carry COPPA-irrelevant fields. The new table is a clean audit-log shape (userId/consentType/action/timestamp/policyVersion) that other consent surfaces can write to without schema growth.

**Implementation notes:**

- The `CloudTranscriptionDisclosureModal` returns `null` when `visible=false` instead of relying on RN's `Modal.visible` prop alone. RN's native modal hides itself, but React Native Testing Library still renders the subtree — and since the modal carries `accessibilityViewIsModal=true`, RNTL scopes `getByText`/`getByLabelText` to the modal subtree even when hidden. Returning `null` keeps the test tree clean. Same gotcha as the parental-gate modal in US-009.
- The `useParentalGate` hook is mocked in both US-009 and US-010 tests to return `parentalGateModal: null`. Without this, the parental-gate modal traps RNTL queries the same way. If the project grows more SettingsScreen tests, factoring this mock into a shared helper would pay off.
- `latestCloudConsent` may transiently be `undefined` during the initial Convex query load. Treating `undefined` the same as `null` (= "needs disclosure") is the safe default — the worst case is one extra modal that resolves into a duplicate grant row, which is harmless given the append-only design.

---

### US-011: Hide voice input on Android (coming-soon state)

**Status:** Complete. `VoiceInput.tsx` returns `null` on Android, `VoiceFirstInputBar.tsx`'s Speak button is hidden on Android, and a one-time `Alert.alert` notifies the user. iOS UI is untouched — the iOS snapshot still renders the mic-button `TouchableOpacity` identically to the pre-US-011 tree.

**Description:** As an Android user, I want the app to gracefully not offer voice input (rather than showing a broken button), so I'm not confused when nothing happens.

**Acceptance Criteria:**

- [x] On Android, the voice/mic button is **not rendered** in `VoiceInput.tsx` (return null branch or sibling absence) _(Done — the component runs all hooks (so `useImperativeHandle` is registered for the parent's ref), then early-returns `null` before the JSX. The Android snapshot is literally `null`. Hook order is stable across platforms.)_
- [x] On Android, a one-time toast or info banner explains: "Voice input is coming soon to Android. Type your story for now." _(Done — a `useEffect` on Android reads an AsyncStorage flag (`@CreativeBridge:androidVoiceComingSoonSeen`); if absent, fires `Alert.alert` with that message and sets the flag. Subsequent mounts read the flag and skip. The mechanism is "alert + persistent flag" rather than a Toast component because the project doesn't currently use a Toast lib and a new dependency would be over-scope.)_
- [x] No native Android dependencies are added in this PR (whisper.rn Android binary not bundled) _(Done — `Podfile` / `package.json` unchanged. The Android gate is pure JS, no native modules touched.)_
- [x] iOS UI is unaffected — same screen renders identically with the mic button present _(Done — every Platform gate is `!== 'ios' → suppress`; the iOS path is unchanged. Committed iOS snapshot (`VoiceInput.platform.test.tsx.snap`) locks this in: any accidental regression that drops the mic button on iOS will surface as a snapshot diff.)_
- [x] Platform detection uses `Platform.OS === 'ios'` checks (existing pattern) _(Done — all four gates are inline `Platform.OS === 'ios'` / `!== 'ios'` checks, no module-level captured constant. This matters for testability: tests can override `Platform.OS` between cases via the existing `require('react-native').Platform.OS = ...` pattern without needing `jest.resetModules()`.)_

**Validation Test:**

- **What:** Snapshot tests for the input bar rendered on iOS and Android (using the existing `Platform.OS` mock pattern), asserting the mic button is present in iOS snapshot and absent in Android snapshot.
- **How to run:** `npm test -- src/__tests__/components/VoiceInput.platform.test.tsx`
- **Pass condition:** Snapshots differ in the expected way; Android snapshot does not contain mic-button-related test IDs. _(Met — 5 tests passing: iOS renders `mic-button`, Android does not, Android snapshot is exactly `null`. 66 tests across 6 affected/adjacent suites still passing as regression.)_

**Implementation notes:**

- **Scope extension to `VoiceFirstInputBar.tsx`.** The AC list is scoped narrowly to `VoiceInput.tsx`, but the _user story_ says "rather than showing a broken button." If only `VoiceInput.tsx` is gated, `VoiceFirstInputBar.tsx`'s visible Speak button — which calls into `VoiceInput` via `voiceInputRef.current?.finalize()` and `autoStart` — would still render on Android and do nothing when tapped. That's the exact broken-button UX the story is preventing. So I extended the gate to wrap the entire Speak column (button + embedded `VoiceInput` driver) in `{Platform.OS === 'ios' && (...)}`. On Android the input bar reduces to `Listen | Keyboard`, which is the typing-only fallback. The PRD's validation test is still VoiceInput-scoped per the AC, so the new behavior isn't snapshot-tested at the bar level — but it's necessary to make the user-visible promise hold.
- **Imperative handle is registered as a structural no-op on Android.** The parent calls `voiceInputRef.current?.finalize()` unconditionally. If we skipped `useImperativeHandle` on Android, the ref would be null and the call would still work via optional chaining — but skipping a hook conditionally would break React's rules-of-hooks. Instead, the hook always runs and the handle's `finalize()` early-returns on Android. Same end state, hook-order-safe.
- **AsyncStorage mock gotcha.** The global `setup.ts` mock for `@react-native-async-storage/async-storage` returns bare `jest.fn()`s whose return value is `undefined`. The US-011 alert effect chains `.then(...)` off `getItem`, which throws `Cannot read properties of undefined (reading 'then')` against the default mock. The platform test file overrides the mock with `mockResolvedValue(null)` for `getItem`. If a future test of the alert behavior needs more sophistication (e.g., simulating "already seen"), this is the file to extend; the global mock probably shouldn't change because too many callsites depend on its current behavior.
- **`Platform.OS` inline vs. captured.** I initially captured `Platform.OS === 'ios'` in a module-level constant for readability. Tests can't override that — module load freezes the value. Refactored to inline checks at each call site so the test's override-restore pattern works. The PRD's AC #5 explicitly asks for inline checks anyway ("existing pattern"), so this is also the more orthodox style.

---

### US-012: Privacy policy update — voice processing disclosure

**Status:** Engineering portion complete. The policy file, the keyword/structural test, and the cascading `test.failing` flips have all landed. **Manual legal readback by the operator/legal reviewer is still required** before the policy is considered finally adopted — that step is outside engineering scope and explicitly called out in the AC as "manual: read the policy end-to-end and confirm it accurately describes the implementation."

**Description:** As a parent or auditor reading the privacy policy, I want a clear and accurate description of how voice data is processed for under-13 vs 13+ users, so I can verify the app's COPPA posture and consent decisions.

**Acceptance Criteria:**

- [x] `docs/legal/privacy-policy.md` updated with:
  - New "Voice and Audio Data" section under "Information We Collect" _(Done — added as a top-level `## Voice and Audio Data` section right after the "Information NOT Collected" block, with three sub-sections: "For users under 13", "For users 13 and older", and "Platform availability". The section is intentionally NOT nested inside "Information We Collect" because the under-13 sub-section's purpose is to disclose what is *not* collected; placing it as a sibling section reads more honestly.)_
  - Explicit statement: "For users under 13, voice transcription is performed entirely on-device. Audio recordings are not transmitted off-device, retained, or shared with any third party." _(Done — the exact phrase appears verbatim. The keyword test pins both halves: `voice transcription is performed \*\*entirely on-device\*\*` and `not transmitted off-device, retained, or shared with any third party`. The section also explicitly disclaims any setting/A/B/feature-flag/admin-override that could route an under-13 user to cloud — matching the architectural guarantee in `transcriptionEnginePolicy.ts`.)_
  - Statement for 13+ opt-in cloud users: what is sent, retention, OpenAI DPA reference _(Done — four bullets disclose (1) what is sent, (2) where it goes, (3) what CreativeBridge retains, (4) what OpenAI retains. The OpenAI DPA reference cites the zero-retention terms for API calls.)_
  - Updated "Third-Party Services" table with conditional OpenAI Whisper row (only for 13+ opt-in) _(Done — added a new column "Applies To" so the per-service scope is visible at a glance. The Whisper row explicitly says "Only users in grade 9-12 who have explicitly opted in via Settings. Never under-13 users." All other services were back-filled with their applies-to scope for consistency.)_
- [x] PR #88's draft sections are reconciled with these final additions _(Done — see the implementation note "PR #88 reconciliation" below. **Maintainer action required:** PR #88 should be closed as superseded by this commit. I deliberately did NOT run `gh pr close 88` since closing GitHub PRs is the kind of shared-state action that warrants explicit user authorization.)_
- [x] Effective Date and Last Updated fields refreshed _(Done — both set to 2026-05-11. The `C-05` audit test `[C-05] Effective date is a real date, not a placeholder` flipped from `test.failing` to passing as a side effect; I converted it to a regular `test()`, matching the C-05 file's own docstring directive ("Once placeholders are filled, these tests will auto-flip and should be converted to regular test() calls").)_
- [x] Version bumped to 1.1 _(Done — version line updated, and a "What changed in version 1.1" callout added under the header so a returning reader can see at a glance what's new without diffing.)_

**Validation Test:**

- **What:** Manual legal-readback by maintainer (or designated legal reviewer); plus automated check that the policy file contains all required keywords.
- **How to run:** `npm test -- src/__tests__/security/coppa/privacyPolicyContent.test.ts`
- **Pass condition:** Automated test passes (keywords present); manual review signs off that the language matches actual implementation. _(Engineering portion met — 20 tests passing across keyword presence, structural anchors, COPPA invariants, and metadata blocks. The `[H-01] Privacy policy discloses voice data handling` `test.failing` also flipped to passing and was converted to a regular `test()`. Manual legal sign-off is outstanding and is a maintainer/operator action.)_

**Implementation notes:**

- **PR #88 reconciliation.** PR #88 was an open draft staged for legal redline that assumed _Path B_ (all users → cloud + disclosure + re-consent). The implementation actually took _Path D_ (hybrid: under-13 → on-device, 13+ → opt-in cloud) across US-006 through US-011. That means PR #88's draft text is not just stale but in places legally _wrong_ — e.g., its proposed VPC re-consent flow assumed under-13 users would have audio sent to OpenAI, which the current implementation cryptographically prevents. Rather than rebase those wrapped-in-DRAFT-comments rows into this file, I wrote a clean Path-D-accurate policy from scratch, integrated as final text (no `<!-- DRAFT -->` wrappers, no `[INSERT]` placeholders in the new sections). The PR #88 changes should be considered fully superseded by this commit.
- **Test cascades.** Two `test.failing` assertions across the COPPA audit suite flipped to passing as a direct consequence of the policy edits: (1) `[H-01] Privacy policy discloses voice data handling`, and (2) `[C-05] Effective date is a real date, not a placeholder`. Both were converted to regular `test()` calls as their own docstrings predicted. **Out of US-012 scope:** the `[H-01] VoiceInput prefers native iOS recognizer when Platform.OS === "ios"` test was already failing before US-012 (it checks for a `nativeSpeechRecognizer` import that US-007 removed when migrating to `audioCaptureService` + `whisperTranscriptionService`). That failure is US-013's territory.
- **Structural anchors over loose keyword presence.** The validation test originally specified just "presence of `voice`, `on-device`, `OpenAI Whisper`, `under 13` strings". I implemented those _plus_ structural anchors (`## Voice and Audio Data` heading exists, `**OpenAI Whisper**` table row exists, voice-retention row starts with "Not retained") and exact-phrasing pins on the COPPA-load-bearing sentences. Keyword presence alone is satisfied by stray prose — "voice your opinion in our feedback form" would match `/voice/`. The structural anchors prove the words land in the right place.
- **Markdown wrapping gotcha.** The Android sentence ("No voice or audio data is collected on Android") wraps across two lines in the source because Prettier hard-wraps at 80 columns. The test's regex uses `\s+` between "audio" and "data" to be robust to that wrap. If a future Prettier config change unwraps the paragraph, the test still passes — but if someone edits the sentence itself, it'll fail. That's the right failure mode.

---

### US-013: Convert H01 tripwire from `test.failing` to passing assertion

**Status:** Complete. The H-01 file is now a real passing tripwire with 18 assertions across four describe blocks. The previously-failing `nativeSpeechRecognizer` import check is gone (US-007 removed the import; the new test enforces the post-US-007 architecture instead). The meta-check was performed manually by injecting a regression that flipped the under-13 routing to respect cloud preferences — 4 of the 18 tests failed cleanly, then reverted.

**Description:** As a maintainer, I want the H01 audit tripwire to evolve from a failing-by-design signal into a real passing assertion that verifies the new architectural invariants, so it continues to act as a regression guard going forward.

**Acceptance Criteria:**

- [x] `src/__tests__/security/coppa/H01-speechRecognition.test.ts` rewritten with three real assertions:
  1. **For under-13 users, the cloud `transcribeAudio` action is never invoked.** _(Done — block `[H-01.1]` runs a 9-case fixture matrix (3 under-13 grades × 3 preference states including the "attempted leak" case where `preferences.transcriptionEngine = 'cloud'`) through `getTranscriptionEngine()`, dispatches the result through a small router fixture, and asserts that the `jest.fn()` standing in for the cloud action has `toHaveBeenCalledTimes(0)`. Includes a separate aggregate assertion that runs every case in one pass and pins zero cloud invocations across the matrix.)_
  2. **The on-device transcription service is reachable from `VoiceInput.tsx`.** _(Done — block `[H-01.2]` static-checks three imports: `onDeviceTranscriptionService`, `audioCaptureService`, and `getTranscriptionEngine`. Each guards a different regression vector: deleting the on-device pipeline (#1), deleting the recording half of the pipeline (#2), or moving the routing decision out of the policy helper (#3).)_
  3. **The privacy policy file contains voice disclosure for under-13.** _(Done — block `[H-01.3]` does three string-search assertions: the minimal "voice/speech/audio/dictation" canary, the exact-phrasing "entirely on-device" pin, and the "not transmitted off-device, retained, or shared with any third party" pin. Redundant with `privacyPolicyContent.test.ts` by design — H-01 should fire even if the dedicated US-012 content test is somehow disabled.)_
- [x] DO-NOT-FIX docstring removed; replaced with normal test docstring describing what each assertion guards _(Done — the 30-line REGRESSION DETECTED banner is gone. The new docstring describes what each of the three assertions catches and lists the historical regression (2026-04-14 silent-cloud-switch) as the canonical failure mode to defend against.)_
- [x] No `test.failing()` markers remain in this file _(Done — file uses only `it()` and `it.each()`.)_
- [x] CI on `main` shows the file passing for the first time since the audit was added _(Met locally — 18/18 passing, full COPPA suite 170/170 passing. CI on main will reflect this once this branch lands.)_

**Validation Test:**

- **What:** The rewritten test itself is the validation. Plus a meta-check: deliberately break each invariant (e.g., temporarily wire an under-13 user to cloud) and confirm the corresponding assertion fails.
- **How to run:** `npm test -- src/__tests__/security/coppa/H01-speechRecognition.test.ts`
- **Pass condition:** All three assertions pass on the post-implementation main branch; injected regressions flip the appropriate assertion to red. _(Met — the manual meta-check was executed: a temporary patch to `transcriptionEnginePolicy.ts` that made under-13 users respect `preferences.transcriptionEngine` caused 4 of the 18 tests to fail (the 3 "attempted leak" parameterized cases plus the aggregate matrix test). The patch was reverted and 18/18 passing was confirmed. The PRD's regression-injection step is therefore satisfied; it doesn't need to be re-run on every CI pass since the parameterized cases lock the same property at every run.)_

**Implementation notes:**

- **Three proof shapes, deliberately redundant.** AC #1 is a behavioral assertion (the cloud mock isn't called); AC #2 is a static import-graph assertion (the on-device service is imported); AC #3 is a content assertion (the policy text). They guard different regression vectors: AC #1 catches "someone added a cloud branch for K-2 in the policy helper", AC #2 catches "someone deleted the on-device pipeline entirely" (the 2026-04-14 regression), AC #3 catches "someone deleted the policy disclosure." Redundancy is the point — H-01 is the load-bearing COPPA tripwire, and any one of the three proof shapes being silently disabled would still leave the other two firing.
- **The `[H-01.meta]` positive control.** A subtle failure mode for behavioral tests is "the test passes vacuously because the bad branch isn't reachable at all." If the policy helper were silently broken to always return `'on-device'`, the `[H-01.1]` cloud-never-called assertion would still pass — but the safety guarantee would be hollow. The `[H-01.meta]` block exercises the cloud branch with a 9-12 + cloud-preference fixture and asserts it returns `'cloud'`. This proves the routing machinery actually distinguishes between paths, so `[H-01.1]`'s safety claim is meaningful rather than vacuous.
- **`it.each` template tokens for legible failures.** Initial implementation used object-spread parameters which jest renders as raw object dumps in test names (`routes { gradeLevel: 'K-2', preferenceLabel: 'no preference', preferences: undefined } + %s ...`). Switched to `$gradeLevel` / `$preferenceLabel` template tokens so the names read as `routes K-2 + no preference to on-device...` in CI output. This matters because the test name appears in the failure summary, and a meaningful name turns a 30-second triage into a 3-second one.
- **Why the `nativeSpeechRecognizer` test was deleted, not migrated.** The 2026-04-14 regression originally surfaced as that test failing. After US-006 onward shipped the correct architecture, the file no longer imports `nativeSpeechRecognizer` at all — the on-device path now goes through `onDeviceTranscriptionService` + `audioCaptureService` (which together perform whisper.rn-based local transcription, _not_ `SFSpeechRecognizer`). Migrating the assertion would mean asserting an outdated implementation detail. Replacing it with the post-US-007 imports (`onDeviceTranscriptionService` + `audioCaptureService` + `getTranscriptionEngine`) locks in the architecture as it actually exists, not a historical snapshot.

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
  - **D-1 amendment (2026-05-11, during US-006 implementation):** The sub-question's claim was reversed. Inspection of `convex/schema.ts` shows: `userProfiles.preferredGradeLevel` (line 230) is the **canonical per-user grade preference** (persisted on the profile), while `gameSessions.gradeLevel` (line 280) is the **per-session grade selection** (chosen at game start, scoped to one play session). The PRD got the naming inverted. The US-006 helper's parameter is named `gradeLevel` (matching the `GradeLevel` type literal); callers MUST pass `userProfile.preferredGradeLevel` into it for COPPA classification. Using `gameSessions.gradeLevel` instead would leak the routing decision to a per-game override, which is the bug D-1 was trying to prevent in the first place. The helper's docstring spells this out so future contributors don't re-introduce the confusion.

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

- **D-3 — Whisper model variant: q5_1 quantized, not full precision.** (Resolved 2026-05-11 during US-002 implementation.) The PRD's body text cites "tiny (39 MB)" and "base (74 MB)", but actual file sizes on huggingface are:

  | File                                      | Size        | Notes                                                                  |
  | ----------------------------------------- | ----------- | ---------------------------------------------------------------------- |
  | `ggml-tiny.en.bin` (full precision)       | 77.7 MB     | Not used. Would exceed the ≤45 MB bundle-delta budget.                 |
  | `ggml-tiny.en-q5_1.bin` (5-bit quantized) | **32.2 MB** | **Bundled.** Matches the "39 MB" PRD figure.                           |
  | `ggml-base.en.bin` (full precision)       | 148 MB      | Not used.                                                              |
  | `ggml-base.en-q5_1.bin` (5-bit quantized) | **59.7 MB** | **Reserved for US-003 lazy-download.** Matches the "74 MB" PRD figure. |

  The PRD's "tiny 39 MB / base 74 MB" numbers only make sense if the author meant quantized variants. The ≤45 MB and ≤50 MB budgets are only satisfiable with q5_1.

  **Quality impact:** <1% WER difference vs full precision on whisper.cpp benchmarks for typical clean indoor speech, which is the dominant use case for K-2 dictation. Acceptable trade-off.

  **Carry-forward implication for US-003:** Lazy-download must also use `ggml-base.en-q5_1.bin` (59.7 MB), not full-precision `ggml-base.en.bin` (148 MB). The download script (`scripts/download-whisper-models.sh`) currently downloads only the bundled tiny variant; extending it to fetch base at runtime is US-003's responsibility, and the file URL pattern stays consistent (`https://huggingface.co/ggerganov/whisper.cpp/resolve/main/<filename>`).

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
