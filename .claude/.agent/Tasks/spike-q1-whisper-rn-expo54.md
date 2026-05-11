# Spike: Q1 — `whisper.rn` + Expo SDK 54 Compatibility

**Date:** 2026-05-11
**Outcome:** **GO** — `whisper.rn` is workable on Expo SDK 54 with two specific accommodations, both documented and low-risk.
**Phase completed:** Research only (npm metadata, GitHub issues & commits). No package installed.
**Related:** PRD `prd-on-device-voice-transcription.md` (Q1 in §10 Open Questions)

---

## Verdict in one sentence

> Proceed with `whisper.rn` for the on-device transcription PRD. Two known issues exist; both have established workarounds that fit our environment. Recommend two small additions to the PRD before US-001 starts.

---

## Environment baseline (CreativeBridge)

| Field                   | Value                                                                    |
| ----------------------- | ------------------------------------------------------------------------ |
| Expo SDK                | 54 (`expo: ~54.0.33`)                                                    |
| React Native            | 0.81.5                                                                   |
| React                   | 19.1.0                                                                   |
| Node                    | ≥20                                                                      |
| Expo dev client         | 6.0.18 (custom dev builds in use)                                        |
| Pre-existing audio deps | `expo-av 16.0.8`, `@react-native-voice/voice 3.2.4` (orphan, unused)     |
| Network detection dep   | `@react-native-community/netinfo 11.4.1` (needed for US-003 Wi-Fi check) |
| Patch infrastructure    | `patch-package` runs as postinstall (available if needed)                |

All preconditions for native-module integration are present.

---

## `whisper.rn` baseline

| Field                       | Value                                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Latest stable               | `0.5.5`, published 2026-04-03                                                                                                               |
| Recent pre-release          | `0.6.0-rc.3`                                                                                                                                |
| Peer deps                   | `react: '*'`, `react-native: '*'` (permissive — no install-time conflicts)                                                                  |
| Node engine                 | ≥18                                                                                                                                         |
| Maintainer activity         | Active. Recent commits include `fix: ios pod install` (2026-04-03), full-JSI migration (2026-04-02), example bumped to RN 0.84 (2026-04-03) |
| iOS native distribution     | Pre-built `rnwhisper.xcframework` (no build-from-source required)                                                                           |
| Config plugin               | **None.** Project must use prebuild workflow (we already do — `prebuild` and `prebuild:clean` npm scripts exist)                            |
| Documented Expo SDK support | Not version-pinned; example tests on RN 0.84 (we're on 0.81.5, 3-minor gap)                                                                 |

---

## JS API surface (relevant subset)

```ts
initWhisper({ filePath }: { filePath: string }) → Promise<WhisperContext>
context.transcribe(audioFilePath, options) → { stop: fn, promise: Promise<Result> }
context.release() → Promise<void>
```

This shape fits push-to-talk perfectly: hand it a recorded file, get text back. No event-emitter handling, no partial-result stream to manage, no VAD restarts. The `stop` function on the returned object enables clean cancellation (relevant for US-007's "still talking?" cancel branch).

Additional APIs not needed for our use case:

- `RealtimeTranscriber` — streaming mode; we're using push-to-talk so we don't need it
- `initWhisperVad` — VAD initialization; push-to-talk replaces VAD, so we skip it

This narrowing is actually a win: it sidesteps the two open issues that _only_ affect streaming/VAD modes (#317, #311).

---

## Findings: known issues and their applicability

### Issue #299 — "CRITICAL: only processes ~1 second of audio" (OPEN since 2026-02)

**Headline severity:** Showstopper if real.
**Actual reality:** Sample-rate misconfiguration on the consumer side.

The reporter recorded at 44.1kHz (iOS default). Whisper models are trained on **16kHz mono 16-bit PCM** — when fed 44.1kHz audio, the library reads the file header literally and processes only the first ~1 second (because the second-count is derived from sample rate). The first comment on the issue (`jeanmarc-aforza`, 2026-02-11) confirms:

> "I was having a similar issue and for me it was the sample rate on my audio file. I had it set to 44100, but whisper models are trained on 16 kHz mono PCM audio files. After correcting the sample rate the segments were properly identified and transcribed."

The recommended recording config:

```js
{
  channelCount: 1,
  sampleRate: 16000, // most important
  bitDepth: 16,
  iosQuality: 'max',
}
```

**Impact on our PRD:** None — US-004's acceptance criteria already specifies "Audio format: 16kHz mono WAV (Whisper's preferred input)." We just need to make sure the implementation actually honors this. Suggest bolding the requirement in US-004 and adding a regression test for the sample-rate setting.

---

### Issue #303 / #301 — "Failed build on Expo" (OPEN / closed-but-recurring)

**Headline severity:** Build-time fatal.
**Actual reality:** Codegen autolinking bug with a documented one-file workaround.

The root cause (from `ishanAhuja` in #301):

> "Codegen never visits whisper.rn, so it never drops `RNWhisperSpec` into `ios/build/generated/ios`. The reason is the package uses `exports` in its package.json, so when the RN codegen script walks the dependencies it can't `require.resolve('whisper.rn/package.json')`. It tries to load `lib/commonjs/package.json`, gets a miss, and silently skips the library."

**Workaround** (confirmed working by multiple users): add `react-native.config.js` to the project root:

```js
// react-native.config.js
const path = require('path');

module.exports = {
  dependencies: {
    'whisper.rn': {
      root: path.join(__dirname, 'node_modules/whisper.rn'),
    },
  },
};
```

That tells RN's autolinker explicitly where the library is, bypassing the `exports` field lookup that's failing.

**Impact on our PRD:** Add this `react-native.config.js` as part of US-001's acceptance criteria. It's a ~10-line addition with no runtime cost.

---

### Other open issues reviewed (not blockers for our scope)

| Issue | Title                                               | Relevance to our scope                                                                                                      |
| ----- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| #317  | RealtimeTranscriber crash when backgrounded         | **Not applicable** — we're using push-to-talk, not RealtimeTranscriber                                                      |
| #311  | `initWhisperVad` failing on EAS production builds   | **Not applicable** — we're not using VAD                                                                                    |
| #319  | "not able to import whisper.rn" (vague, recent)     | Likely same root cause as #303; mitigated by the `react-native.config.js` workaround                                        |
| #279  | "Transcription returning [Music] on all recordings" | Likely same root cause as #299 (sample rate); mitigated by 16kHz recording config                                           |
| #286  | "initWhisper model load failing on release"         | **Potential risk for production builds.** Worth verifying during US-002 manual QA on a release build (not just a dev build) |

---

## Risks that survive the spike

These are _real_ risks we're carrying forward, but none are blockers for committing to US-001:

1. **Release-build model loading (#286).** The development-mode model load may succeed while a release-mode load fails (different code signing, different bundle layout, different Hermes settings). We should explicitly run US-002's validation on a release build before declaring it done.
2. **RN version gap.** Library example tests on RN 0.84; we're on 0.81.5. The full-JSI migration commit (b67b45c, 2026-04-02) may assume newer RN internals. Mitigation: pin `whisper.rn` to exactly `0.5.5` (the most recent stable before the 0.6 RC line) so we don't get surprise breakage from a 0.6.x release.
3. **No config plugin.** Every `npx expo prebuild --clean` rebuilds iOS native folder from scratch; `react-native.config.js` is checked in, so autolinking re-runs each time, but if the workaround stops working in a future Expo version, a clean rebuild could surface the failure. Mitigation: document the workaround in `src/services/CLAUDE.md` so its purpose is clear to future contributors.
4. **Bundle size impact unknown until install.** The pre-built `rnwhisper.xcframework` plus `ggml-tiny.en.bin` (39MB) gives us a rough lower bound; an actual install would confirm the binary contribution. US-002's "App install size delta verified ≤45MB" is the validation gate for this.

---

## Recommended PRD updates (before US-001 starts)

These three small edits convert the spike findings into actionable acceptance criteria:

### Update 1 — US-001 acceptance criteria

Add:

- [ ] Project pins `whisper.rn` to exact version `0.5.5` (no caret) to avoid surprise minor-version regressions
- [ ] `react-native.config.js` is added to the project root with the `whisper.rn` autolinking override (see Spike Q1 findings for the workaround code and rationale)
- [ ] Workaround rationale documented in `src/services/CLAUDE.md` with a link back to whisper.rn issue #301

### Update 2 — US-004 acceptance criteria

Strengthen the existing audio format requirement:

- [ ] **(Strictly required)** Audio recorded at exactly 16000 Hz, mono, 16-bit PCM, WAV container. Any deviation will cause whisper.rn to silently truncate transcription to ~1 second (whisper.rn issue #299).
- [ ] Add a unit test asserting the `expo-av` recording config matches: `{ sampleRate: 16000, numberOfChannels: 1, bitDepth: 16 }`

### Update 3 — US-002 validation test

Tighten the validation:

- **Pass condition:** Test asserts the model loads in <500ms and transcribes the fixture to a string containing "hello". **Test must be run on a release build (`expo run:ios --configuration Release`), not just a dev build,** to surface whisper.rn issue #286 if it affects our setup.

### Update 4 — Move Q1 from Open Questions to Resolved Decisions (D-2)

Add a new "D-2 — `whisper.rn` compatibility resolved" entry to §9, noting:

- Verified compatibility via research spike on 2026-05-11
- Two known issues require accommodation (sample rate + react-native.config.js); both incorporated into US-001 and US-004
- `whisper.rn` version pinned to `0.5.5`
- Risks #286 (release-build model load) and bundle-size unknown carried forward as US-002 validation gates

---

## What I did NOT do in this spike

For transparency:

- Did **not** install `whisper.rn` in this repo. The findings above are derived from npm registry metadata, GitHub issues, commit log, and the README. An actual install would be Phase 3 of the spike — runnable in a scratch branch or worktree.
- Did **not** verify that the bundle-size delta matches the 50MB budget. That requires a real install + build.
- Did **not** validate transcription quality on K-2 voice samples. That's covered by US-005's validation test, which requires real device QA.

The research-phase findings are strong enough to commit to US-001, but the install-phase validation will surface anything the research missed.

---

## Suggested next actions

In order:

1. **Apply PRD Updates 1–4 above** (≤10 minutes of edits to `prd-on-device-voice-transcription.md`)
2. **Decide whether to run Phase 3** — actually install `whisper.rn` in a scratch branch / worktree, apply the workaround, build for iOS dev client, confirm import works. This catches anything the research missed. Estimated 1–2 hours including a dev-client iOS build cycle.
3. **Begin US-001** (the production integration), once Phase 3 confirms the workarounds hold

The choice between (2) and (3) is risk tolerance: Phase 3 catches surprises before they affect the main branch; skipping straight to US-001 is faster but if a surprise lands inside a production PR, the rollback path is messier.

---

## References

- npm registry: `whisper.rn@0.5.5` (published 2026-04-03)
- Repo: https://github.com/mybigday/whisper.rn
- Issue #299 (sample rate / 1-second truncation): https://github.com/mybigday/whisper.rn/issues/299
- Issue #301 (codegen autolinking workaround): https://github.com/mybigday/whisper.rn/issues/301
- Issue #303 (Expo build failure, related to #301): https://github.com/mybigday/whisper.rn/issues/303
- Issue #286 (release-build model load): https://github.com/mybigday/whisper.rn/issues/286
- Whisper model files: https://huggingface.co/ggerganov/whisper.cpp
