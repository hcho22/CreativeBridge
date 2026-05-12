# Services (`src/services/`)

## Service Pattern

Services use class pattern with singleton export:

```typescript
export class ServiceName {
  public async method(params: Type): Promise<ReturnType> {
    // Implementation
  }
}
export const serviceName = new ServiceName();
```

## Error Handling

- Services throw descriptive errors with context
- Components handle errors and show user-friendly messages
- All API calls include timeout and retry logic

## Service Catalog

### Story Engine

- `storyGenerationService.ts` - AI-powered story continuation with GPT-4
- `storyAgent.ts`, `enhancedStoryAgent.ts` - Multi-personality AI agents
- `storyImportService.ts` - Story import and continuation
- `storyManagementService.ts` - Story CRUD operations

### Image Generation

- `imageGeneration.ts` - Replicate API with grade-appropriate art style enforcement
- Art styles defined in `ART_STYLE_MAPPING` (all grades use watercolor with age-appropriate complexity)
- 3-tier prompt generation: story-specific > advanced NER > grade-appropriate fallback
- XP cost: `IMAGE_GENERATION_COST = 1000`
- Art style details: `.claude/.agent/SOP/image-generation-art-styles.md`

### AI Enhancement

- `claudeSkillsManager.ts` - Claude Skills SDK integration for quality assessment
- `claudeSkillsConfigManager.ts` - Skills configuration management
- `claudeSkillsMonitor.ts` - Skills performance monitoring

### Infrastructure

- `convex.ts` - Convex client initialization (PRIMARY for OAuth users)
- `supabase.ts` - Supabase client (FALLBACK for legacy users)
- `xpEventTracker.ts` - Gamification and XP tracking
- `analyticsService.ts` - User behavior tracking

### Storage

- `imageStorageService.ts` - Image storage via Convex
- `postGenerationStorageService.ts` - Post-generation image processing and storage

### Onboarding

- `onboardingService.ts` - Centralized onboarding logic
- `onboardingMilestoneTracker.ts` - Local milestone state tracking

## Testing

- Set `DISABLE_XP_COSTS_FOR_TESTING=true` in `.env` to bypass XP cost checks
- Service tests live in `src/__tests__/services/`

## Native Module Workarounds

### `whisper.rn` autolinking override (`react-native.config.js`)

`whisper.rn` (the on-device Whisper transcription library used by the voice input feature) declares an `exports` field in its `package.json`. This trips React Native's codegen autolinker — `require.resolve('whisper.rn/package.json')` fails when codegen walks the dependency tree, the library is silently skipped, and the iOS build then fails with:

```
'RNWhisperSpec/RNWhisperSpec.h' file not found
```

**Workaround:** the project-root `react-native.config.js` adds an explicit `root` override pointing to `node_modules/whisper.rn`. That tells the autolinker exactly where the library is without going through the broken `exports` resolution path.

**Do not remove this override** when upgrading `whisper.rn` or refactoring `react-native.config.js` — even though it looks like dead boilerplate, removing it will silently break the iOS build. The bug is tracked upstream at https://github.com/mybigday/whisper.rn/issues/301 and is unresolved as of `whisper.rn` 0.5.5. If a future `whisper.rn` release ships an Expo config plugin or removes the `exports` field, the override can be removed — verify by running `npx expo prebuild --clean && npx expo run:ios` without it and confirming the build still compiles.

### `whisper.rn` audio sample-rate requirement

`whisper.rn` must be fed audio at **exactly 16000 Hz sample rate, mono (1 channel), 16-bit PCM, WAV container**. Any deviation — including iOS's default 44100 Hz — causes the library to silently truncate transcription to approximately 1 second of output, with the rest of the audio discarded and frequently labeled `[SOUND]` or `[Music]`.

This isn't a `whisper.rn` defect; it's a property of the underlying `whisper.cpp` models, which are trained on 16kHz mono PCM. When the consumer hands it 44.1kHz audio, the library reads the file header literally and processes only what it interprets as the first ~1 second.

The `audioCaptureService` (added in US-004 of the on-device voice transcription PRD) enforces the correct config; do not change the recording settings without updating the regression test in `src/__tests__/services/audioCaptureService.test.ts`. Reference: https://github.com/mybigday/whisper.rn/issues/299.

### Bundled Whisper model (`assets/models/ggml-tiny.en-q5_1.bin`)

The on-device transcription pipeline (US-002) bundles a Whisper GGML model into the iOS app so transcription works offline from first launch. Three coupled pieces of infrastructure make this work; if any one is removed, the others break silently.

1. **Variant choice:** `ggml-tiny.en-q5_1.bin` (32 MB, 5-bit quantized) is bundled instead of full-precision `ggml-tiny.en.bin` (78 MB). The quantized variant satisfies the PRD's ≤45 MB bundle-delta budget. Quality difference is <1% WER on whisper.cpp benchmarks for typical K-2 indoor speech.
2. **Source of truth — download script:** `scripts/download-whisper-models.sh` fetches the model from huggingface (`https://huggingface.co/ggerganov/whisper.cpp`) into `assets/models/`. It's idempotent (byte-count check skips re-downloads) and chained into `package.json`'s `postinstall` after `patch-package`, so `npm install` on a fresh clone yields a buildable state. The `.bin` itself is gitignored — see `.gitignore` `assets/models/*.bin` entry. Bypass the download with `SKIP_WHISPER_MODEL_DOWNLOAD=1 npm install` if you're offline.
3. **Bundle inclusion:** `metro.config.js` registers `bin` as an asset extension, so `require('../../assets/models/ggml-tiny.en-q5_1.bin')` in `whisperModelService.ts` produces a Metro asset ID. `expo-asset`'s `Asset.fromModule(id).downloadAsync()` then resolves it to a `file://` URI inside the iOS app bundle that `whisper.rn`'s `initWhisper({ filePath })` can read. Without the `.bin` assetExts entry, Metro tries to resolve the file as a JS module and the build fails.

**To swap models** (e.g., to bundle `base.en-q5_1` instead, or to add a second variant): update the entry in `scripts/download-whisper-models.sh`, change the `require()` path in `whisperModelService.ts`, and update the matching expected-size constant in the script. The Jest test `whisperBundledModel.test.ts` mocks `expo-asset` and `whisper.rn`, so it is unaffected by which model file is on disk.

**Release-build verification (per PRD US-002):** `npx expo run:ios --configuration Release` must succeed and the model must load on a real device. Issue [whisper.rn #286](https://github.com/mybigday/whisper.rn/issues/286) sometimes manifests as a release-build-only model load failure that doesn't reproduce in dev builds; the release-build smoke test is the only guard against shipping a broken bundled model.

### Lazy-downloaded base model (`whisperModelDownloader`)

The bundled `tiny.en-q5_1` is always available; the base model is an optional quality upgrade fetched only when conditions are right (US-003). The downloader (`src/services/whisperModelDownloader.ts`) follows a small, deliberate state machine:

1. **Existence probe.** `isBaseModelDownloaded()` checks for `ggml-base.en-q5_1.bin` (59,721,011 bytes) at `${documentDirectory}ggml-base.en-q5_1.bin`. Wrong size → treat as absent and re-download (defends against truncated downloads from prior runs).
2. **Network gate.** Only proceeds on Wi-Fi (`NetInfo.fetch()` → `type === 'wifi'` AND `isConnected`). Cellular and offline return `null` (a no-op, not an error — `tiny` remains the active model).
3. **Retry with backoff.** Up to 3 attempts with 1s/2s/4s exponential backoff. After the third failure, throws `WhisperModelDownloadError`.
4. **Size verification.** Post-download, re-checks file size and deletes + retries on mismatch.

**Where it slots in:** `whisperModelService.getContext()` checks `isBaseModelDownloaded()` at load time and prefers base when present. There is **no in-place upgrade** of a loaded context — if base lands while tiny is loaded, the change takes effect on the next `release()` + `getContext()` cycle (typically next app launch, or after explicit cleanup). The downloader does not call back into the model service; the coupling is one-way (`whisperModelService` imports `whisperModelDownloader`, never the reverse).

**Why `expo-file-system/legacy`:** the legacy API's `createDownloadResumable` exposes a progress callback the new SDK 54 `File.downloadFileAsync` API does not. We use the legacy API only for this download path; everywhere else, prefer the new `File`/`Directory`/`Paths` API.

**Why documents/ over cache/:** the model is 60 MB of fetched data that we don't want iOS evicting under storage pressure. `cache/` would be wiped by the OS; `documents/` persists until app uninstall (and gets included in iCloud backup — accepted trade-off).

**Observable progress:** `whisperModelDownloader.onProgress(cb)` lets a future "downloading base model…" UI subscribe. The progress UI is not implemented yet (Open Question Q1 in the PRD); the API is wired so the UI can be added without touching the downloader.

### `whisper.rn` TypeScript module shim (`src/types/whisper.rn.d.ts`)

For the same `exports`-field reason that breaks runtime resolution under `react-native.config.js`, TypeScript's `moduleResolution: "bundler"` cannot resolve the bare module specifier `whisper.rn`. We ship a hand-written declaration shim at `src/types/whisper.rn.d.ts` that declares only the surface this codebase uses (`initWhisper`, `WhisperContext`, etc.). Extend the shim when adopting more of the whisper.rn API; delete the file when the upstream package adds a `.` entry to its `exports` field.
