# Voice-First Input Bar — Manual QA Log

**PRD reference:** [`prd-voice-first-input-bar.md`](./prd-voice-first-input-bar.md) — US-013, US-014–US-017
**Template created:** 2026-04-13
**Updated:**

- 2026-04-14 — voice recognition backend swapped to OpenAI Whisper (Path B)
- 2026-04-15 — Scenarios 3–6 rewritten for the Immediate Submit/Redo UX (US-014–US-017); R7 (pre-speech guard) and R8 (haptics) added
  **Status:** ⏳ Pending reviewer execution + sign-off

## Purpose

US-013 requires manual verification on a physical iOS device (and, if available,
a physical Android device) because TTS (`react-native-tts`) and microphone
recording (`expo-av`) both mock themselves on the iOS simulator and Android
emulator — the only way to validate real voice-in / voice-out behavior is on
real hardware.

Jest integration tests (`npm test`) cover the _logic_ of mode transitions,
handler invocation, and accessibility announcements; this log covers the
_experience_ — does the microphone actually pick up the tester's voice, does
Whisper return an accurate transcript, does the TTS sound right at the K-2
rate, does VoiceOver read the labels in the expected order, etc.

## 2026-04-14 architecture note

Voice recognition was swapped from on-device `@react-native-voice/voice` /
`SFSpeechRecognizer` (which couldn't handle sentences longer than ~1–2s on
iOS) to OpenAI Whisper via a new Convex action. Key behavioral differences
for the reviewer:

- **No live partial transcripts.** The review card appears only AFTER the
  user stops talking (silence auto-finalize) and Whisper returns a result.
- **~1–3 second "Transcribing…" spinner** on the Speak button between stop
  and the review card. The Speak button is disabled during this window.
- **Requires network.** Unlike on-device recognition, Whisper dictation is
  a cloud round-trip — offline the transcription step fails (caller sees an
  error toast; the review card does not appear).
- **Much better long-sentence accuracy.** The previous device log's
  regression case — "In the twinkling expanse of the Cosmic Carnival" →
  "In Lots of" — should now return a correct full transcript.

Reviewers should validate scenario #3 with a deliberately LONG sentence
(≥8 words) to exercise the Whisper path where the old recognizer failed.

Each row in the **Scenarios** table below maps 1:1 to an acceptance criterion
from US-013. The reviewer fills in **Device**, **Pass / Fail**, and **Notes**
for every row, captures any defects in the **Defect Log**, then signs off at
the bottom.

---

## Device Under Test

> Fill in before running scenarios. If testing on both iOS and Android, fill
> out this block **twice** — once per device — and capture scenario results
> with the device name in the Device column.

| Field             | iOS                                     | Android                                 |
| ----------------- | --------------------------------------- | --------------------------------------- |
| Model             | _e.g. iPhone 15 Pro_                    | _e.g. Pixel 8_                          |
| OS version        | _e.g. iOS 17.4_                         | _e.g. Android 14_                       |
| App build source  | _`npx expo run:ios --device` / EAS dev_ | _`npx expo run:android --device` / EAS_ |
| App version       | _from `app.config.js` / EAS build log_  | _from `app.config.js` / EAS build log_  |
| Build date        | _YYYY-MM-DD_                            | _YYYY-MM-DD_                            |
| Tester name       |                                         |                                         |
| Test session date |                                         |                                         |

---

## Scenarios

Legend: ✅ Pass · ❌ Fail · ⚠️ Pass with notes · ⏭ Skipped (explain in Notes)

| #   | Scenario                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Device | Pass / Fail | Notes |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------- | ----- |
| 1   | Launch app on physical iOS device via `npx expo run:ios --device` (or EAS dev build). App boots to home screen without crash.                                                                                                                                                                                                                                                                                                                                                                                                                                           |        |             |       |
| 2   | Start a new game session → verify three round buttons appear in order **Listen \| Speak \| Keyboard** with labels underneath. **Speak is visibly larger than the other two.** No textbox is visible in default (idle) state.                                                                                                                                                                                                                                                                                                                                            |        |             |       |
| 3   | Tap **Speak** (center) → listening indicator pulses → speak a **long** complete sentence (≥8 words, e.g. "In the twinkling expanse of the Cosmic Carnival") → stop talking → **Speak button swaps to a spinner (~1–3s Whisper round-trip)** → review card appears with the FULL transcription. Transcript should match what was spoken word-for-word (Whisper accuracy, not ASR-hedged). **Sub-step (2026-04-15, US-015): while listening, tap the center ↑ button — recording stops immediately, Transcribing spinner appears within one frame, no 2 s silence wait.** |        |             |       |
| 4   | **(2026-04-15, US-016)** On review card, the three main round buttons reconfigure: left slot becomes **↺ Redo** (refresh icon), center becomes **↑ Submit** (arrow-upward), right stays **Keyboard** but now acts as Edit. Tap **↺ Redo** in the left slot → review card disappears, listening resumes (new recording starts), prior transcript cleared. Speak again → new transcript replaces the old one (no concatenation — Whisper returns a fresh transcript each turn).                                                                                           |        |             |       |
| 5   | **(2026-04-15, US-016)** On review card: tap the **Keyboard** button (right slot, now acts as Edit) → textbox appears above the three buttons, soft keyboard opens, textbox is pre-filled with the transcript. Edit a word → tap `↑` (the typing-mode submit arrow) → AI generates a response within normal latency.                                                                                                                                                                                                                                                    |        |             |       |
| 6   | **(2026-04-15, US-015/US-016)** On review card: tap the center **↑** button (Submit role, now on the main button row) → `handleContinueStory` runs, AI responds within normal latency. Story advances as expected; no double-submit; round counter increments. No inline Submit button remains on the review card itself.                                                                                                                                                                                                                                               |        |             |       |
| 7   | Tap **Listen** (left) → story-so-far is spoken at the current grade-level rate (verify K-2 is slower than 9-12). Icon becomes stop. Tap again → speech halts mid-sentence.                                                                                                                                                                                                                                                                                                                                                                                              |        |             |       |
| 8   | Tap **Keyboard** (right, from idle) → textbox appears with the three buttons still visible above/around. Type a phrase; submit via `↑` → story continues. Buttons remain tappable during typing mode (one-tap to switch back).                                                                                                                                                                                                                                                                                                                                          |        |             |       |
| 9   | While AI is generating: all three buttons appear disabled (visually dimmed, not tappable); Speak shows a spinner. Once generation completes, buttons re-enable. **Also** while Whisper is transcribing (~1–3s after stop-talking): the Speak button shows a spinner and is untappable — a second tap during this window MUST be ignored (not cancel the upload).                                                                                                                                                                                                        |        |             |       |
| 10  | VoiceOver enabled: swipe through the three buttons in left-to-right order → hear "Listen to the story so far", then "Speak your contribution" (with "Primary input" hint), then "Type with the keyboard". Trigger a mode change → hear the mode transition announcement.                                                                                                                                                                                                                                                                                                |        |             |       |
| 11  | Android device (if available): repeat scenarios 2, 3, 6, 7 on at least one physical Android device. Verify MaterialIcons render crisply (not emoji fallback) and Speak is visibly larger than flanking buttons.                                                                                                                                                                                                                                                                                                                                                         |        |             |       |

---

## Regression Guards

These are the behaviors the PRD explicitly calls out as must-not-regress. If
any of these fail, the release is blocked regardless of whether the main
scenarios pass.

| #   | Guard                                                                                                                                                                                                                                                                                                                                                | Device | Pass / Fail | Notes |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------- | ----- |
| R1  | Voice duplication fix (Jan 2026 → still relevant under Whisper): speaking two sentences back-to-back in a single Speak session produces ONE continuous transcript (e.g. "Hello there. How are you?") — not duplicated segments. Whisper receives the whole recording so this is structurally prevented, but confirm the transcript reads naturally.  |        |             |       |
| R2  | TTS pause/resume: long-press on **Listen** while speech is playing → speech pauses. Long-press again → speech resumes from where it paused (not from the start).                                                                                                                                                                                     |        |             |       |
| R3  | `testID="story-input"` still resolves in keyboard mode — verify by tapping **Keyboard** and confirming the textbox appears with the right behavior. (Not a visible check; but if the TextInput didn't mount the test IDs would silently break E2E.)                                                                                                  |        |             |       |
| R4  | First-voice onboarding milestone: on a fresh account, the user's first successful voice submission triggers the onboarding milestone (existing behavior from prior onboarding PRD) — check via backend/analytics or a visible onboarding toast.                                                                                                      |        |             |       |
| R5  | **NEW (Whisper):** Empty / near-silent recording (tap Speak, don't talk, wait for silence auto-finalize) does NOT navigate to the review card with an empty transcript, and does NOT produce a Whisper API error toast. Expected: VoiceOver announces "I didn't catch that, try again" and the bar returns to idle (VOICE_EMPTY path).               |        |             |       |
| R6  | **NEW (Whisper):** Network offline during Speak: the spinner appears, then an error surfaces (toast or alert) within ~30s timeout, and the bar returns to idle. App must NOT crash; Keyboard input must still work.                                                                                                                                  |        |             |       |
| R7  | **NEW (2026-04-15, US-015):** Pre-speech guard — tap **Speak**, DON'T talk, tap the center **↑** button immediately: nothing happens (the ↑ button is disabled until at least one above-threshold metering frame / spoken frame is captured). No empty transcript is sent to Whisper, and no empty-transcript review card appears.                   |        |             |       |
| R8  | **NEW (2026-04-15, US-015):** Haptic feedback — tapping the center **↑** button during `listening` on a physical iOS device (with _System Haptics_ enabled in Settings → Sounds & Haptics) fires a single **Medium** impact pulse. On iOS simulator or on Android devices without a linear-resonant-actuator motor: no crash, pulse silently no-ops. |        |             |       |

---

## Defect Log

Any Fail or Pass-with-notes row above should have a corresponding entry here
with enough reproduction detail for a developer to triage.

| ID  | Scenario # | Severity (P0 / P1 / P2) | Summary | Repro steps | Expected | Actual | Screenshot / video |
| --- | ---------- | ----------------------- | ------- | ----------- | -------- | ------ | ------------------ |
|     |            |                         |         |             |          |        |                    |

---

## Environment Notes

Anything unusual about the test environment — background noise level, network
conditions, permissions prompts the reviewer accepted or denied, accessibility
settings that were on, etc. Important because ASR and TTS behavior can shift
with ambient noise and with OS-level voice profiles.

- _Network condition:_
- _Ambient noise:_
- _Microphone permission first-prompt accepted?:_
- _Speech recognition permission first-prompt accepted?:_
- _OS-level VoiceOver / TalkBack voice chosen:_
- _Other:_

---

## Sign-off

The reviewer countersigns below once all scenarios are executed and all
defects (if any) are either resolved or explicitly deferred with a PRD-level
exception.

| Role            | Name | Signed (YYYY-MM-DD) | Notes / conditional approvals |
| --------------- | ---- | ------------------- | ----------------------------- |
| QA reviewer     |      |                     |                               |
| PRD owner / eng |      |                     |                               |

**Overall verdict:** `[ ] PASS  [ ] PASS with noted defects  [ ] FAIL — re-test required`

> Once this file is fully filled out and signed, update the US-013 section of
> `prd-voice-first-input-bar.md` to mark the story `✅ COMPLETE (YYYY-MM-DD)`
> with a link back to this log as the evidence artifact.
