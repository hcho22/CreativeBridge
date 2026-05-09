# H01 — COPPA voice/audio disclosure audit

**Status:** Open audit signal. CI on `main` stays red on this test until a maintainer + legal/COPPA officer decision lands.

**Audit detected:** US-015f.1.3, 2026-05-08
**Audit re-confirmed:** 2026-05-09 (this document)

**Test:** `src/__tests__/security/coppa/H01-speechRecognition.test.ts`

---

## Summary

The H-01 audit test is failing as a **deliberate audit signal**, not as test debt. It flags a real privacy/compliance regression that needs a maintainer + legal/COPPA officer decision before any code or policy change lands.

This document is the alarm's tracking record. It is intended to be lifted into a GitHub issue (or equivalent ticket) so the audit signal moves from "CI-red on `main`" to a tracked, owned workstream.

## Confirmed regression

When the H-01 audit was originally written, voice input used **on-device** speech recognition on iOS (`SFSpeechRecognizer` via `NativeModules.SpeechRecognizerModule`). Per the 2026-04-14 architectural decision, `VoiceInput.tsx` was rewritten to use `whisperTranscriptionService`, which sends raw audio to **OpenAI Whisper** via the Convex `transcribeAudio` action.

### Source-level evidence (audited 2026-05-09)

| Check                                            | File                                                           | Finding                                                                                                                                 |
| ------------------------------------------------ | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Production consumers of `nativeSpeechRecognizer` | grep across `src/`                                             | **Zero.** Only `src/services/nativeSpeechRecognizer.ts:281` (the export itself). The on-device path is dead code.                       |
| Voice input in production                        | `src/components/common/VoiceInput.tsx:50`                      | Imports `whisperTranscriptionService`. ~9 call sites in this file alone.                                                                |
| Cloud destination                                | `convex/ai.ts:403` `transcribeAudio` action                    | Sends raw base64 audio (m4a/aac/webm) to `${OPENAI_BASE_URL}/audio/transcriptions` with `model: whisper-1`.                             |
| PII scrubbing                                    | `convex/ai.ts:403`                                             | None. Voice cannot be PII-scrubbed — the speaker's voice is itself biometric data, plus any spoken names/addresses.                     |
| Privacy policy disclosure                        | `docs/legal/privacy-policy.md` (199 lines, audited end-to-end) | **No mention** of voice/speech/audio/dictation/microphone/Whisper. Third-Party Services table lists OpenAI for "GPT-4 story text" only. |

## Why this is a COPPA matter

- **COPPA §312.2** classifies audio files containing a child's voice as personal information (post-2013 amendment).
- **COPPA §312.4(b)** requires direct notice to parents enumerating data types collected — voice is not currently enumerated.
- **COPPA §312.5** requires VPC _before_ collecting that data — existing consents do **not** roll forward when the data types collected expand.
- **App Store privacy nutrition label** has a separate "Voice/Audio Recording" disclosure that may also be out of sync.
- **OpenAI ToS** delegates end-user-consent responsibility to the customer.

## Resolution paths

| Path                                                   | What changes                                                                                                           | Engineering scope                               | Legal scope                                               |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------- |
| **A. Restore on-device iOS + disclose Android**        | Re-wire `VoiceInput.tsx` to use `nativeSpeechRecognizer` on iOS; Whisper for Android only; disclose Android cloud path | Medium (existing service, needs re-integration) | Smaller (Android-only disclosure + nutrition label)       |
| **B. Cloud everywhere + full disclosure + re-consent** | Update privacy policy; add VPC re-prompt for existing under-13 accounts; update nutrition label                        | Small (VPC re-prompt UX)                        | Large (policy section, re-consent flow approved by legal) |
| **C. Age-gate voice for under-13**                     | Disable voice input for under-13; text-only fallback                                                                   | Small                                           | Medium (still need disclosure for ≥13 users)              |
| **D. Hybrid**                                          | A + B + C combined                                                                                                     | Largest                                         | Largest                                                   |

## Decision needed

Owner(s): **maintainer + legal/COPPA officer**

Specifically:

1. Which resolution path (A / B / C / D)?
2. If B or D: who drafts the legal-binding policy text? (The companion draft policy diff is for redline, not direct merge.)
3. If A or D: timeline for re-integrating `nativeSpeechRecognizer` into `VoiceInput.tsx`?
4. If existing under-13 users have already had voice audio captured under the current cloud setup, do we need a retroactive notification + retention review?

## Companion draft

A draft Path-B policy diff is being prepared on branch `audit/H01-policy-draft-redline` — see that branch for the proposed `docs/legal/privacy-policy.md` additions. It is intended for legal redline, not direct merge.

## Until decision lands

- The H-01 test stays failing as the audit signal.
- This document is the alarm's owner.
- Do not `describe.skip` the test or alter its assertions — the file's docstring explicitly forbids that, and CI red is the intended state.

## References

- Test file: `src/__tests__/security/coppa/H01-speechRecognition.test.ts`
- Architectural decision: 2026-04-14 (rewrite to `whisperTranscriptionService`)
- Audit detection: US-015f.1.3, 2026-05-08
- Re-audit: 2026-05-09
