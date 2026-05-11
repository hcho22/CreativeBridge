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
