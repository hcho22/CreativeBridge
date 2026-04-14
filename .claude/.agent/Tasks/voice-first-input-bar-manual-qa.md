# Voice-First Input Bar — Manual QA Log

**PRD reference:** [`prd-voice-first-input-bar.md`](./prd-voice-first-input-bar.md) — US-013
**Template created:** 2026-04-13
**Status:** ⏳ Pending reviewer execution + sign-off

## Purpose

US-013 requires manual verification on a physical iOS device (and, if available,
a physical Android device) because TTS (`react-native-tts`) and speech
recognition (`@react-native-voice/voice`) both mock themselves on the iOS
simulator and Android emulator — the only way to validate real voice-in /
voice-out behavior is on real hardware.

Jest integration tests (`npm test`) cover the _logic_ of mode transitions,
handler invocation, and accessibility announcements; this log covers the
_experience_ — does the microphone actually pick up the tester's voice, does
the TTS sound right at the K-2 rate, does VoiceOver read the labels in the
expected order, etc.

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

| #   | Scenario                                                                                                                                                                                                                                                                 | Device | Pass / Fail | Notes |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ----------- | ----- |
| 1   | Launch app on physical iOS device via `npx expo run:ios --device` (or EAS dev build). App boots to home screen without crash.                                                                                                                                            |        |             |       |
| 2   | Start a new game session → verify three round buttons appear in order **Listen \| Speak \| Keyboard** with labels underneath. **Speak is visibly larger than the other two.** No textbox is visible in default (idle) state.                                             |        |             |       |
| 3   | Tap **Speak** (center) → listening indicator pulses → speak a complete sentence → after ~2s silence → review card appears with the transcription. Transcript must match what was spoken (account for normal ASR noise).                                                  |        |             |       |
| 4   | On review card: tap **Re-record** → card disappears, listening resumes, prior transcript cleared. Speak again → new transcript replaces the old one (no concatenation / no duplication — regression guard for Jan 2026 fix).                                             |        |             |       |
| 5   | On review card: tap **Edit** → textbox appears above the three buttons, keyboard opens, textbox is pre-filled with transcript. Edit a word → tap `↑` submit → AI generates a response within normal latency.                                                             |        |             |       |
| 6   | On review card: tap **Submit** → `handleContinueStory` runs, AI responds within normal latency. Story advances as expected; no double-submit; round counter increments.                                                                                                  |        |             |       |
| 7   | Tap **Listen** (left) → story-so-far is spoken at the current grade-level rate (verify K-2 is slower than 9-12). Icon becomes stop. Tap again → speech halts mid-sentence.                                                                                               |        |             |       |
| 8   | Tap **Keyboard** (right, from idle) → textbox appears with the three buttons still visible above/around. Type a phrase; submit via `↑` → story continues. Buttons remain tappable during typing mode (one-tap to switch back).                                           |        |             |       |
| 9   | While AI is generating: all three buttons appear disabled (visually dimmed, not tappable); Speak shows a spinner. Once generation completes, buttons re-enable.                                                                                                          |        |             |       |
| 10  | VoiceOver enabled: swipe through the three buttons in left-to-right order → hear "Listen to the story so far", then "Speak your contribution" (with "Primary input" hint), then "Type with the keyboard". Trigger a mode change → hear the mode transition announcement. |        |             |       |
| 11  | Android device (if available): repeat scenarios 2, 3, 6, 7 on at least one physical Android device. Verify MaterialIcons render crisply (not emoji fallback) and Speak is visibly larger than flanking buttons.                                                          |        |             |       |

---

## Regression Guards

These are the behaviors the PRD explicitly calls out as must-not-regress. If
any of these fail, the release is blocked regardless of whether the main
scenarios pass.

| #   | Guard                                                                                                                                                                                                                                               | Device | Pass / Fail | Notes |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------- | ----- |
| R1  | Voice duplication fix (Jan 2026, `HomeScreen.tsx:802-860`): speaking two sentences back-to-back in a single Speak session does **not** produce a transcript like "Hello. Hello world." — partial results are REPLACED, not concatenated.            |        |             |       |
| R2  | TTS pause/resume: long-press on **Listen** while speech is playing → speech pauses. Long-press again → speech resumes from where it paused (not from the start).                                                                                    |        |             |       |
| R3  | `testID="story-input"` still resolves in keyboard mode — verify by tapping **Keyboard** and confirming the textbox appears with the right behavior. (Not a visible check; but if the TextInput didn't mount the test IDs would silently break E2E.) |        |             |       |
| R4  | First-voice onboarding milestone: on a fresh account, the user's first successful voice submission triggers the onboarding milestone (existing behavior from prior onboarding PRD) — check via backend/analytics or a visible onboarding toast.     |        |             |       |

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
