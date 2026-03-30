# COPPA & Apple Kids Category Compliance Audit - Consolidated Report

**App:** CreativeBridge (React Native + Expo)
**Audit Date:** 2026-03-25
**Previous Audit:** 2026-03-23
**Auditors:** Data Flow, Consent Flow, Apple Kids Category, AI Data Safety (automated agents)
**Audit Lead:** Team Lead (consolidated + cross-validation)

---

## Overall Grades

| Category                    | Grade                    | Previous (2026-03-23) | Trend                      |
| --------------------------- | ------------------------ | --------------------- | -------------------------- |
| **Data Flow**               | NEEDS ATTENTION          | FAIL                  | Improved                   |
| **Consent Flow**            | PASS WITH FINDINGS       | FAIL                  | Significantly Improved     |
| **Apple Kids Category**     | FAIL                     | FAIL                  | Improved (but still fails) |
| **AI Data Safety**          | NEEDS ATTENTION          | FAIL                  | Improved                   |
| **Overall COPPA Readiness** | **NOT READY FOR LAUNCH** | FAIL                  | Substantial progress       |

---

## Executive Summary

CreativeBridge has made **dramatic progress** since the 2026-03-23 audit, going from zero COPPA infrastructure to a substantially complete implementation: age-gating, VPC via Email Plus, parental dashboard with review/export/delete, annual consent renewal, PII scrubbing, content moderation, analytics anonymization, and automated data retention. The foundation is solid.

However, the cross-validation round between auditors surfaced **systemic architectural issues** that cut across all four audit domains. These are not incremental gaps -- they represent structural risks that must be resolved before production launch:

1. **All AI API calls are client-side** -- API keys in the app binary, no server-side enforcement of PII scrubbing, children's devices connect directly to OpenAI/Replicate
2. **OAuth collects child PII before age gate/consent** -- Clerk receives name, email, photo from Google/Apple before the app knows the user is under 13
3. **Multiple code paths skip PII scrubbing** -- embedding generation and image analysis send unscrubbed children's content to OpenAI
4. **Voice audio streamed to Apple/Google cloud** -- undisclosed in the consent form

The **recommended path** is General App Store with COPPA compliance (not Kids Category). The grade 9-12 content and client-side AI architecture are fundamentally incompatible with Apple Kids Category.

---

## Consolidated Finding Registry

### CRITICAL Findings (7)

| ID       | Source                 | Finding                                                                                                                                                                                                                                    | Impact                       |
| -------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| **C-01** | Consent + Data Flow    | **OAuth collects child PII before age gate and consent.** Clerk receives full name, email, and profile photo from Google/Apple before the app checks age or obtains VPC. This is a structural COPPA violation. (`App.tsx:70` vs `:253`)    | Launch blocker               |
| **C-02** | AI Safety              | **Hardcoded OpenAI API key in source code.** `src/config/environment.ts:76` contains `sk-proj-Hj1R...` behind `__DEV__` guard. Visible to anyone with repo access.                                                                         | Rotate immediately           |
| **C-03** | AI Safety + Apple Kids | **All AI API calls are client-side.** OpenAI and Replicate calls made via `fetch()` from React Native. API keys bundled in app binary. No server-side enforcement point for PII scrubbing.                                                 | Architecture change required |
| **C-04** | Data Flow + AI Safety  | **Two OpenAI code paths skip PII scrubbing entirely.** Embedding generation (`embeddingGenerationService.ts`) has zero PII scrubber imports. Image analysis (`imageGeneration.ts:12427`) sends raw `storyText` to OpenAI before scrubbing. | Fix before launch            |
| **C-05** | Consent                | **Privacy policy has placeholder fields.** `docs/legal/privacy-policy.md` contains `[INSERT DATE]`, `[INSERT OPERATOR NAME]`, `[INSERT CONTACT EMAIL]`, `[INSERT MAILING ADDRESS]`.                                                        | Fix before launch            |
| **C-06** | Consent                | **Consent token uses `Math.random()`.** `generateConsentToken()` in `convex/consent.ts:878` is not cryptographically secure. Tokens grant consent verification access.                                                                     | Fix before launch            |
| **C-07** | Consent                | **"Email Plus" VPC may not satisfy FTC requirements.** Current implementation is email-link-click only. True Email Plus requires an additional verification step (confirmation code, delayed second email, etc.).                          | Legal review needed          |

### HIGH Findings (8)

| ID       | Source                | Finding                                                                                                                                                                                               |
| -------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **H-01** | Data Flow + AI Safety | **Speech recognition audio sent to Apple/Google cloud.** Voice from children transmitted to cloud servers. Not disclosed in VPC consent form. Under COPPA, voice recordings are personal information. |
| **H-02** | Data Flow             | **No Data Processing Agreements (DPAs) with AI services.** OpenAI and Replicate receive children's content without COPPA-compliant contractual protections.                                           |
| **H-03** | Data Flow + AI Safety | **PII scrubber is regex-only.** Cannot catch contextual PII from creative writing (e.g., "my teacher Mrs. Johnson at Lincoln Elementary").                                                            |
| **H-04** | Consent               | **Consent email failure silently swallowed.** `ParentEmailScreen.tsx:68-76` catches errors with `console.warn`. Child proceeds to pending screen without knowing email wasn't sent.                   |
| **H-05** | Consent               | **Age gate uses self-declared ranges, not DOB.** Child can select "13 to 17" to bypass all protections. No lockout mechanism.                                                                         |
| **H-06** | Consent               | **Parental gate (math problem) solvable by grades 3+.** Two-digit addition is not an effective barrier for older children.                                                                            |
| **H-07** | Consent               | **Legal URLs have TODO placeholder.** `src/config/legalUrls.ts:11` notes "Replace with production URLs." Privacy policy may not be accessible.                                                        |
| **H-08** | Data Flow             | **Parent email stored as plaintext.** `consentRecords.parentEmail` unencrypted in Convex.                                                                                                             |

### MEDIUM Findings (8)

| ID   | Source    | Finding                                                                               |
| ---- | --------- | ------------------------------------------------------------------------------------- |
| M-01 | Consent   | Client-side AI calls expose children's IP addresses to OpenAI/Replicate (undisclosed) |
| M-02 | Data Flow | Supabase analytics has no retention policy or automated cleanup                       |
| M-03 | Data Flow | Deterministic analytics hash is a pseudonymous persistent identifier                  |
| M-04 | Data Flow | Device registration in audit logger sends device metadata to Supabase                 |
| M-05 | Data Flow | AsyncStorage contains sensitive session data without encryption or TTLs               |
| M-06 | AI Safety | OpenAI retains API data for 30 days (Zero Data Retention not obtained)                |
| M-07 | AI Safety | Console logs include story content previews in debug builds                           |
| M-08 | Consent   | Consent withdrawal does not trigger immediate data deletion                           |

### LOW Findings (4)

| ID   | Source     | Finding                                                                 |
| ---- | ---------- | ----------------------------------------------------------------------- |
| L-01 | AI Safety  | Cosine similarity vectors theoretically reversible (low practical risk) |
| L-02 | Consent    | Username auto-fill from email may reveal child's real name              |
| L-03 | Apple Kids | `Linking.openSettings()` not gated (3 locations)                        |
| L-04 | Data Flow  | Display name allows free text entry (child may enter real name)         |

---

## Cross-Audit Validation Summary

The challenge round between auditors produced **6 corrections/upgrades**:

| Original Finding                                              | Challenge Result                                                 | Action                      |
| ------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------- |
| Data flow map showed "PII scrubbed: Yes" for all OpenAI paths | AI safety auditor proved 2 paths skip scrubbing                  | Upgraded to CRITICAL (C-04) |
| Data flow map didn't flag client-side architecture            | AI safety auditor identified all calls are client-side `fetch()` | Added as CRITICAL (C-03)    |
| Consent audit missed OAuth-before-age-gate                    | Data flow auditor mapped the PII timeline                        | Added as CRITICAL (C-01)    |
| Consent audit didn't cover voice data                         | Data flow auditor found cloud speech recognition                 | Added as HIGH (H-01)        |
| Apple Kids audit was CONDITIONAL PASS                         | AI safety cross-reference revealed client-side keys              | Downgraded to FAIL          |
| Data flow auditor missed hardcoded API key                    | AI safety auditor found `environment.ts:76`                      | Added as CRITICAL (C-02)    |

**2 cross-validations confirmed:**

- Claude Skills SDK is mock-only (confirmed by both data flow + AI safety)
- TTS uses on-device `react-native-tts`, NOT ElevenLabs (confirmed by both)

---

## Third-Party Data Recipients

| Service           | Data Received                          | PII Scrubbed?                  | DPA?                      | COPPA Risk |
| ----------------- | -------------------------------------- | ------------------------------ | ------------------------- | ---------- |
| **OpenAI**        | Story text, image analysis, embeddings | Partial (2 paths unscrubbed)   | No                        | CRITICAL   |
| **Replicate**     | Image generation prompts               | Yes (regex)                    | No                        | HIGH       |
| **Clerk**         | OAuth tokens, email, name, photo       | N/A (auth)                     | Unknown                   | HIGH       |
| **Apple Speech**  | Voice audio from children              | Impossible (pre-transcription) | No                        | HIGH       |
| **Google Speech** | Voice audio from children              | Impossible (pre-transcription) | No                        | HIGH       |
| **Supabase**      | Legacy profiles, audit logs, analytics | Partial                        | N/A (operator-controlled) | MEDIUM     |
| **Convex**        | All primary data                       | N/A (first-party)              | N/A                       | LOW        |
| Claude Skills SDK | Nothing (mock)                         | N/A                            | N/A                       | None       |
| ElevenLabs        | Nothing (not used)                     | N/A                            | N/A                       | None       |

---

## Apple Kids Category Assessment

**Grade: FAIL** -- Not submittable. Three independent blockers:

1. **Grade 9-12 content (ages 14-18)** exceeds Kids Category maximum age of 11
2. **Client-side AI architecture** -- child's device sends data directly to third parties without server-side control
3. **No age band declared** in app configuration

**Recommendation: Submit to General App Store with COPPA compliance** instead. This preserves the full K-12 grade range while maintaining child safety through existing controls. However, the General App Store path still requires fixing the CRITICAL findings above.

---

## Positive Controls Identified

Despite the findings, CreativeBridge has built substantial COPPA infrastructure:

| Control                     | Status      | Implementation                                                |
| --------------------------- | ----------- | ------------------------------------------------------------- |
| Age-gating (3-tier)         | Implemented | `AgeGatingScreen.tsx` with neutral framing                    |
| VPC Email Plus              | Implemented | Full lifecycle: request -> email -> verify -> grant           |
| Consent blocking            | Implemented | Under-13 users blocked until VPC granted                      |
| Parent Dashboard            | Implemented | Review, export (JSON), withdraw, delete                       |
| Annual consent renewal      | Implemented | 11-month reminder, 12-month enforcement via cron              |
| PII scrubber                | Implemented | Regex-based, covers 10+ PII categories                        |
| Content blocklist           | Implemented | 200+ terms across 6 categories                                |
| OpenAI Moderation API       | Implemented | Pre-check on user input                                       |
| Analytics anonymization     | Implemented | Hashed userId, stripped deviceInfo                            |
| Data retention crons        | Implemented | Automated cleanup: stories (1yr), images (90d), consent (3yr) |
| Expired consent cleanup     | Implemented | 48-hour auto-deletion of unconfirmed accounts                 |
| Real-name blocking (US-010) | Implemented | Auto-fill blocked for under-13 in ProfileCompletionScreen     |
| On-device TTS               | Implemented | `react-native-tts`, no cloud voice synthesis                  |
| No ads/tracking SDKs        | Confirmed   | Clean dependency audit                                        |

---

## Prioritized Remediation Plan

### Phase 1: Launch Blockers (fix before any production release)

| Priority | ID   | Fix                                                               | Effort | Impact                                                                          |
| -------- | ---- | ----------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------- |
| 1        | C-01 | Move age gate to pre-auth screen (before OAuth)                   | HIGH   | Eliminates structural COPPA violation                                           |
| 2        | C-02 | Rotate hardcoded API key, remove from source                      | LOW    | Immediate security fix                                                          |
| 3        | C-03 | Move AI API calls to server-side Convex actions                   | HIGH   | Fixes key exposure, enables server-side PII enforcement, shields children's IPs |
| 4        | C-04 | Add `piiScrubber.scrubText()` to embedding + image analysis paths | LOW    | Closes unscrubbed data paths                                                    |
| 5        | C-05 | Fill in privacy policy placeholder fields                         | LOW    | Required for COPPA direct notice                                                |
| 6        | C-06 | Replace `Math.random()` with CSPRNG in consent token generation   | LOW    | Secures consent verification                                                    |
| 7        | C-07 | Legal review of Email Plus VPC method; add confirmation code step | MEDIUM | Ensures FTC-acceptable VPC                                                      |

### Phase 2: Pre-Launch (address before public availability)

| Priority | ID   | Fix                                                                                                              | Effort         |
| -------- | ---- | ---------------------------------------------------------------------------------------------------------------- | -------------- |
| 8        | H-01 | Enable on-device speech recognition (`requiresOnDeviceRecognition = true`) OR disclose voice-to-cloud in consent | MEDIUM         |
| 9        | H-02 | Execute COPPA-compliant DPAs with OpenAI and Replicate                                                           | MEDIUM (legal) |
| 10       | H-04 | Show warning when consent email fails, offer Share alternative                                                   | LOW            |
| 11       | H-07 | Deploy legal documents to production URLs                                                                        | LOW            |
| 12       | H-08 | Hash/encrypt parent email at rest                                                                                | LOW            |

### Phase 3: Post-Launch Improvements

| Priority | ID        | Fix                                                          | Effort |
| -------- | --------- | ------------------------------------------------------------ | ------ |
| 13       | H-03      | Augment PII scrubber with NER/LLM-based contextual detection | HIGH   |
| 14       | H-05      | Implement DOB-based age verification                         | MEDIUM |
| 15       | H-06      | Strengthen parental gate (PIN or knowledge-based)            | MEDIUM |
| 16       | M-01-M-08 | Address remaining MEDIUM findings                            | MEDIUM |

---

## Comparison with Previous Audit (2026-03-23)

| Metric                       | 2026-03-23 | 2026-03-25                    | Change                 |
| ---------------------------- | ---------- | ----------------------------- | ---------------------- |
| Overall Grade                | FAIL       | NOT READY (with path to PASS) | Improved               |
| COPPA controls implemented   | 0          | 14                            | +14                    |
| CRITICAL findings            | 8          | 7                             | -1                     |
| HIGH findings                | 6          | 8                             | +2 (deeper audit)      |
| Known third-party data flows | 3          | 9                             | +6 (better visibility) |
| DPAs in place                | 0          | 0                             | No change              |
| Privacy policy               | None       | Draft (with placeholders)     | Improved               |

**Assessment:** The codebase has undergone a significant COPPA compliance buildout. The remaining findings are concentrated in two areas: (1) the client-side AI architecture (which is an engineering project, not a design gap) and (2) legal/contractual work (DPAs, privacy policy completion, VPC method review). Both are tractable.

---

## Detailed Audit Reports

- [Data Flow Map](./data-flow-map-2026-03-25.md) -- 4 CRITICAL, 3 HIGH, 5 MEDIUM
- [Consent Flow Audit](./consent-audit-2026-03-25.md) -- 4 CRITICAL, 6 HIGH, 3 MEDIUM
- [Apple Kids Category Audit](./apple-kids-audit-2026-03-25.md) -- 4 CRITICAL, 3 HIGH, 3 MEDIUM
- [AI Data Safety Audit](./ai-data-safety-audit-2026-03-25.md) -- 2 CRITICAL, 4 HIGH, 2 MEDIUM

---

## Next Steps

1. **Immediate (this week):** Rotate the exposed OpenAI API key (C-02). Add PII scrubbing to the two unscrubbed code paths (C-04).
2. **Sprint 1:** Begin server-side AI proxy migration (C-03). Restructure auth flow for pre-auth age gate (C-01). Complete privacy policy (C-05). Fix consent token generation (C-06).
3. **Sprint 2:** Legal review of VPC method (C-07). Execute DPAs with OpenAI/Replicate (H-02). Enable on-device speech recognition (H-01). Deploy legal URLs (H-07).
4. **Before launch:** Complete all Phase 1 + Phase 2 items. Re-audit to verify remediation.

---

**Audit completed:** 2026-03-25
**Next full audit recommended:** After Phase 1 remediation (or before any App Store submission)
**Quarterly review due:** 2026-06-25
