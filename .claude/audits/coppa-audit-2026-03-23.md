# COPPA & Apple Kids Category Compliance Audit - CreativeBridge

**Consolidated Report**
**Date:** 2026-03-23
**App:** CreativeBridge (React Native / Expo)
**Target Audience:** Children grades K-12 (ages ~5-18)
**AI Integrations:** OpenAI GPT-4o-mini, Replicate Stable Diffusion 3.5, Claude Skills (mock), ElevenLabs (inactive)

---

## Overall Verdict: FAIL

CreativeBridge is a children's educational app with **zero COPPA compliance infrastructure**. The app collects personal information from children, transmits child-authored content to third-party AI services, and has no age-gating, parental consent, data deletion, or data processing agreements in place.

---

## Scorecard

| Audit Area              | Grade    | Auditor                | Report                                               |
| ----------------------- | -------- | ---------------------- | ---------------------------------------------------- |
| **Data Flow**           | **FAIL** | Data Flow Auditor      | [data-flow-map.md](./data-flow-map.md)               |
| **Consent Flow**        | **FAIL** | Consent Flow Auditor   | [consent-audit.md](./consent-audit.md)               |
| **Apple Kids Category** | **FAIL** | Apple Kids Auditor     | [apple-kids-audit.md](./apple-kids-audit.md)         |
| **AI Data Safety**      | **FAIL** | AI Data Safety Auditor | [ai-data-safety-audit.md](./ai-data-safety-audit.md) |

---

## Cross-Referenced Critical Findings

The four auditors independently identified overlapping issues. Below are the consolidated findings ranked by severity, with cross-references showing which auditors flagged each issue.

### CRITICAL (Must fix before any production release)

| #    | Finding                                        | Flagged By                 | Details                                                                                                                                                                                                                            |
| ---- | ---------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-01 | **No age-gating mechanism**                    | Consent, Data Flow         | No date-of-birth input, no under-13 detection. Grade level (K-2 = ages 5-7) is collected but does not trigger any consent flow. Zero references to `age_gate`, `under_13`, `coppa`, or `parent` in the codebase.                   |
| C-02 | **No verifiable parental consent (VPC)**       | Consent, Data Flow         | No parent email collection, no consent form, no credit card/ID/video verification. The only "consent" is a Terms checkbox that isn't even persisted to the database.                                                               |
| C-03 | **No account or data deletion mechanism**      | Data Flow, Consent         | No `deleteUserProfile` function exists. COPPA requires parents to be able to request deletion of all child data. Only individual story session deletion is available.                                                              |
| C-04 | **Hardcoded OpenAI API key in source code**    | AI Data Safety             | `src/config/environment.ts` line 78 contains a full `sk-proj-...` key as a dev fallback, committed to the repository. Must be revoked and rotated immediately.                                                                     |
| C-05 | **No Data Processing Agreements (DPAs)**       | AI Data Safety, Data Flow  | No documented DPAs with any service: OpenAI, Replicate, Clerk, Convex, or Supabase. COPPA requires operators to ensure third-party providers maintain confidentiality of children's data.                                          |
| C-06 | **No post-generation image safety moderation** | AI Data Safety, Apple Kids | Stable Diffusion outputs are displayed directly to children without any content verification or moderation step.                                                                                                                   |
| C-07 | **Device identifier collection**               | Apple Kids, Data Flow      | `react-native-device-info` calls `getUniqueId()`, `getDeviceId()`, `getDeviceName()` in production code paths (`auditLogger.ts`, `claudeSkillsConfig.ts`, `claudeSkillsCredentialRotation.ts`). Prohibited in Apple Kids Category. |

### HIGH (Should fix before production)

| #    | Finding                                                               | Flagged By                | Details                                                                                                                                                                                                       |
| ---- | --------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H-01 | **Child-authored story content sent to OpenAI without PII scrubbing** | Data Flow, AI Data Safety | Up to 8,000 chars of child-written stories sent per request. Children commonly embed personal information (names, schools, locations) in creative writing. No PII detection or scrubbing before transmission. |
| H-02 | **Real name auto-populated from OAuth**                               | Consent                   | `ProfileCompletionScreen.tsx` auto-fills `displayName` with the child's real first/last name from Google/Apple OAuth. No consent gate before this occurs.                                                     |
| H-03 | **Non-functional Privacy Policy and ToS links**                       | Consent                   | `AuthScreen.tsx` has `TouchableOpacity` elements labeled "Privacy Policy" and "Terms of Service" with no `onPress` handlers and no URLs. They are placeholder buttons that do nothing.                        |
| H-04 | **No prompt injection protection**                                    | AI Data Safety            | Child input is interpolated directly into OpenAI prompts without sanitization or anti-injection instructions.                                                                                                 |
| H-05 | **Email logged in plaintext**                                         | AI Data Safety            | `oauthService.ts` line 190: `console.log('User email extracted:', userEmail)`                                                                                                                                 |
| H-06 | **Unguarded external link-outs**                                      | Apple Kids                | Two `Linking.openURL()` calls without parental gates: `OAuthSessionHelpModal.tsx` (Google accounts) and `StoryImageDisplay.tsx` (image URL in browser).                                                       |
| H-07 | **Grade 9-12 content incompatible with Kids Category**                | Apple Kids                | Apple Kids Category max age is 11. Content for grades 9-12 includes dystopian themes, psychological horror, and thriller elements targeting ages 14-18.                                                       |
| H-08 | **Analytics transmits userId and deviceInfo to Supabase**             | Data Flow, Apple Kids     | `analyticsService.ts` batch-uploads behavioral events tied to user IDs every 30 seconds. No anonymization.                                                                                                    |

### MEDIUM

| #    | Finding                                                  | Flagged By                 | Details                                                                                                                                   |
| ---- | -------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| M-01 | **No data retention policy**                             | Data Flow                  | All data stored indefinitely in Convex and Supabase -- profiles, stories, prompts, images, analytics events. No TTL or automated cleanup. |
| M-02 | **Email stored in plaintext in migration events**        | Data Flow                  | `migrationEvents` table stores email addresses indefinitely with no cleanup schedule.                                                     |
| M-03 | **Minimal content blocklist**                            | Apple Kids, AI Data Safety | Only 5 blocked words (`kill`, `murder`, `blood`, `war`, `hate`). Insufficient for child safety.                                           |
| M-04 | **No explicit OpenAI training opt-out**                  | AI Data Safety             | Client sends only `Content-Type` and `Authorization` headers. Relies on OpenAI's default API policy which could change.                   |
| M-05 | **Anomaly detection collects child behavioral profiles** | AI Data Safety             | `anomalyDetector.ts` collects userId, deviceId, ipAddress, device fingerprints.                                                           |
| M-06 | **Story elements sent to OpenAI embedding API**          | AI Data Safety             | Character names, settings, plot patterns sent for vector embeddings. Additional data transmission vector.                                 |
| M-07 | **Consent not persisted**                                | Consent                    | `acceptedTerms` is local React state only. No database record of consent.                                                                 |

### LOW

| #    | Finding                                        | Flagged By                | Details                                                                                   |
| ---- | ---------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------- |
| L-01 | **Sensitive data unencrypted in AsyncStorage** | Data Flow                 | Email, profile data stored in plaintext.                                                  |
| L-02 | **Unused ElevenLabs configuration**            | Data Flow, AI Data Safety | API key in `.env.example` but zero API calls. Dead artifact that could confuse reviewers. |

---

## Positive Findings

The auditors also identified existing good practices:

- **TTS is on-device** -- `react-native-tts` used instead of cloud ElevenLabs. No voice data transmitted.
- **Speech recognition is on-device** -- iOS `SFSpeechRecognizer` processes locally (though Apple may relay audio).
- **Claude Skills SDK is mock-only** -- No actual data sent to Anthropic.
- **No advertising/tracking SDKs** -- No AdMob, Facebook SDK, Firebase Analytics, Segment, etc.
- **No push notifications** -- No `expo-notifications` or push configuration.
- **Story exports are clean** -- Plain `.txt` files with no embedded PII or metadata.
- **Grade-appropriate content adaptation** -- Art styles and vocabulary scale with grade level.
- **Production error sanitization exists** -- `errorHandler.ts` strips sensitive fields (but only in the audit logging path).
- **No advertising ID / IDFA collection** found.

---

## Remediation Roadmap

### Phase 0: Emergency (Before next commit)

| Action                                                                  | Addresses |
| ----------------------------------------------------------------------- | --------- |
| Revoke and rotate the hardcoded OpenAI API key. Scrub from git history. | C-04      |

### Phase 1: Pre-Production Blockers

| Action                                                                                                                                     | Addresses |
| ------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| Implement age-gating as first step of signup (date of birth or age range selection)                                                        | C-01      |
| Implement verifiable parental consent (VPC) flow for users under 13. MVP: "Email Plus" method. Production: credit card or ID verification. | C-02      |
| Create and host a COPPA-compliant privacy policy. Wire up the non-functional links in AuthScreen.                                          | H-03      |
| Add complete account + data deletion across all tables and services (Convex, Supabase, Clerk)                                              | C-03      |
| Execute DPAs with OpenAI, Replicate, Clerk, Convex, and Supabase                                                                           | C-05      |
| Remove all `getUniqueId()`/`getDeviceId()`/`getDeviceName()` calls from production code                                                    | C-07      |
| Implement post-generation image safety moderation before displaying to children                                                            | C-06      |
| Add parental gate component before all `Linking.openURL()` calls                                                                           | H-06      |

### Phase 2: High-Priority Improvements

| Action                                                                                  | Addresses |
| --------------------------------------------------------------------------------------- | --------- |
| Implement PII detection/scrubbing on story content before sending to OpenAI/Replicate   | H-01      |
| Block real name auto-population for child accounts (use pseudonyms)                     | H-02      |
| Add prompt injection protection (input sanitization + anti-injection system prompts)    | H-04      |
| Remove PII from console logs (emails, story content, user IDs)                          | H-05      |
| Remove deviceInfo from analytics; anonymize/pseudonymize user IDs                       | H-08      |
| Expand content blocklist from 5 to 200+ terms; add OpenAI Moderation endpoint pre-check | M-03      |
| Decide: remove grade 9-12 OR submit outside Apple Kids Category                         | H-07      |

### Phase 3: Medium-Term Hardening

| Action                                                                                | Addresses  |
| ------------------------------------------------------------------------------------- | ---------- |
| Establish data retention policy with automated TTL/cleanup                            | M-01       |
| Persist consent records (type, timestamp, version, parent email, verification method) | M-07       |
| Configure OpenAI organization header; pursue Zero Data Retention agreement            | M-04       |
| Anonymize anomaly detection data (IP, behavioral profiles)                            | M-05       |
| Encrypt sensitive AsyncStorage data                                                   | L-01       |
| Remove unused ElevenLabs configuration                                                | L-02       |
| Add parental dashboard for data review, deletion requests, consent withdrawal         | C-02, C-03 |
| Consider local embedding models to avoid sending story elements to OpenAI             | M-06       |

### Phase 4: Long-Term

| Action                                                                   | Addresses  |
| ------------------------------------------------------------------------ | ---------- |
| Annual parental consent renewal mechanism                                | C-02       |
| Declare age band in App Store Connect configuration                      | H-07       |
| Evaluate FTC-approved COPPA Safe Harbor program enrollment               | All        |
| Consider limited guest mode (Apple prefers Kids apps work without login) | Apple Kids |
| Recurring compliance audits (quarterly recommended)                      | All        |

---

## Apple Kids Category Decision

The auditors flagged a fundamental tension: CreativeBridge serves grades K-12 (ages ~5-18), but Apple Kids Category has a maximum age of 11. Two paths forward:

**Option A: Apple Kids Category (ages 5-11 only)**

- Remove or hide grade 9-12 content entirely
- Remove all device identifier collection
- Ensure zero third-party data transmission (or get Apple exceptions)
- Add parental gates on all external actions
- Declare age band (5 and Under, 6-8, or 9-11)

**Option B: General App Store with COPPA compliance**

- Keep full K-12 content range
- Implement COPPA compliance (VPC, age-gating, DPAs, deletion)
- Submit to general App Store with a detailed privacy policy
- Still must comply with COPPA for users under 13

**Recommendation:** Option B is more pragmatic given the current architecture. Option A would require significant content and feature removal.

---

## Methodology

Four independent auditor agents performed parallel code reviews of the entire CreativeBridge codebase:

1. **Data Flow Auditor** — Mapped every data collection point, storage location, third-party transmission, and retention policy
2. **Consent Flow Auditor** — Reviewed authentication, onboarding, and profile flows for age-gating and VPC mechanisms
3. **Apple Kids Category Auditor** — Verified compliance with Apple's Kids Category requirements (stricter than COPPA)
4. **AI Data Safety Auditor** — Audited all AI service integrations for data handling, training opt-outs, and content safety

Auditors examined actual source code, database schemas, API call configurations, and package dependencies. Findings were cross-referenced to identify overlapping concerns and validate severity assessments.

---

## Individual Audit Reports

- [Data Flow Map](./data-flow-map.md) — Complete data inventory with 16 data points traced through 9 services
- [Consent Flow Audit](./consent-audit.md) — Age-gating, VPC, onboarding timeline, privacy policy assessment
- [Apple Kids Category Audit](./apple-kids-audit.md) — SDK analysis, parental gates, age bands, UGC moderation
- [AI Data Safety Audit](./ai-data-safety-audit.md) — OpenAI/Replicate/Claude/ElevenLabs data handling, DPA status, logging PII
