# COPPA Data Flow Audit - CreativeBridge

**Audit Date:** 2026-03-25
**Auditor:** Data Flow Auditor (Automated)
**Scope:** All user data collection, storage, and third-party transmission
**App Version:** 0.0.4
**Revision:** v2 — Updated with cross-validated findings from AI Data Safety Audit (4 corrections applied)

---

## Executive Summary

CreativeBridge collects user data across 8 external services and 2 backend databases. The app has implemented several COPPA-conscious controls (PII scrubbing, analytics anonymization, age-gating, VPC flow), but several **CRITICAL** and **HIGH** severity gaps remain, particularly around client-side API key exposure, PII scrubbing gaps in AI data transmission, and device identifier handling.

**Architecture Note:** All AI API calls (OpenAI, Replicate) are made **directly from the client device** via `fetch()` in React Native — NOT proxied through a backend server. This means API keys are bundled into the app binary and children's data flows directly from device to third-party AI services without server-side mediation.

---

## 1. Comprehensive Data Collection Inventory

### 1.1 Profile Data (Collected at Registration)

| Data Point                                    | Where Stored                              | Shared With               | Retention              | Consent Required | Severity   |
| --------------------------------------------- | ----------------------------------------- | ------------------------- | ---------------------- | ---------------- | ---------- |
| Clerk User ID (`user_xxxxx`)                  | Convex `userProfiles.clerkUserId`         | Clerk (auth provider)     | Until account deletion | Yes (under-13)   | INFO       |
| Username                                      | Convex `userProfiles.username`            | None                      | Until account deletion | Yes (under-13)   | INFO       |
| Display Name                                  | Convex `userProfiles.displayName`         | None                      | Until account deletion | Yes (under-13)   | **MEDIUM** |
| Email Address                                 | Clerk (OAuth provider)                    | Clerk, Google/Apple OAuth | Until account deletion | Yes (under-13)   | **HIGH**   |
| Preferred Grade Level                         | Convex `userProfiles.preferredGradeLevel` | None                      | Until account deletion | Yes (under-13)   | INFO       |
| Preferred Genre                               | Convex `userProfiles.preferredGenre`      | None                      | Until account deletion | No               | INFO       |
| Age Group (`under_13`, `13_to_17`, `18_plus`) | Convex `userProfiles.ageGroup`            | None                      | Until account deletion | Yes (under-13)   | **MEDIUM** |
| Avatar URL                                    | Convex `userProfiles.avatarUrl`           | None                      | Until account deletion | No               | LOW        |
| Bio                                           | Convex `userProfiles.bio`                 | None                      | Until account deletion | No               | LOW        |
| Speech Enabled Preference                     | Convex `userProfiles.speechEnabled`       | None                      | Until account deletion | No               | INFO       |

### 1.2 Consent Data

| Data Point                  | Where Stored                           | Shared With           | Retention                             | Consent Required      | Severity |
| --------------------------- | -------------------------------------- | --------------------- | ------------------------------------- | --------------------- | -------- |
| Parent Email Address        | Convex `consentRecords.parentEmail`    | Consent email service | 3 years post-account deletion (COPPA) | N/A (parent provides) | **HIGH** |
| Consent Token               | Convex `consentRecords.consentToken`   | Sent via email link   | Until consent granted or 48h expiry   | N/A                   | INFO     |
| Consent Status & Timestamps | Convex `consentRecords`                | None                  | 3 years post-account deletion         | N/A                   | INFO     |
| Privacy Policy Version      | Convex `consentRecords.consentVersion` | None                  | 3 years post-account deletion         | N/A                   | INFO     |

### 1.3 Story/Content Data

| Data Point                            | Where Stored                               | Shared With                                  | Retention                 | Consent Required | Severity     |
| ------------------------------------- | ------------------------------------------ | -------------------------------------------- | ------------------------- | ---------------- | ------------ |
| Story Content (user-written text)     | Convex `gameSessions.storyContent`         | **OpenAI** (for continuation)                | 1 year after last access  | Yes (under-13)   | **HIGH**     |
| Imported Story Content                | Convex `gameSessions.importedStoryContent` | **OpenAI** (for analysis)                    | 1 year after last access  | Yes (under-13)   | **MEDIUM**   |
| Story Metadata (JSON)                 | Convex `gameSessions.storyMetadata`        | None                                         | 1 year after last access  | No               | INFO         |
| Generated Image URLs                  | Convex `gameSessions.generatedImageUrl`    | **Replicate** (generation)                   | 1 year after last access  | Yes (under-13)   | **MEDIUM**   |
| Generated Images (binary)             | Convex Storage (`_storage`)                | None                                         | 1 year (cascading delete) | No               | INFO         |
| Story Elements (characters, settings) | Convex `storyElements`                     | None                                         | 1 year (cascading delete) | No               | INFO         |
| Story Element Embeddings              | Convex `storyElements.embeddingVector`     | **OpenAI** (embedding API, **NO PII SCRUB**) | 1 year (cascading delete) | Yes (under-13)   | **CRITICAL** |

### 1.4 Gamification Data

| Data Point                        | Where Stored                               | Shared With | Retention              | Consent Required | Severity |
| --------------------------------- | ------------------------------------------ | ----------- | ---------------------- | ---------------- | -------- |
| Total XP, Streaks, Scores         | Convex `userProfiles`                      | None        | Until account deletion | No               | INFO     |
| Words Written / Stories Completed | Convex `userProfiles`                      | None        | Until account deletion | No               | INFO     |
| Onboarding Progress               | Convex `userProfiles.onboardingProgress`   | None        | Until account deletion | No               | INFO     |
| Milestone Timestamps              | Convex `userProfiles` (4 timestamp fields) | None        | Until account deletion | No               | INFO     |
| Game Session Scores               | Convex `gameSessions`                      | None        | 1 year                 | No               | INFO     |

### 1.5 Image Generation Events

| Data Point                    | Where Stored                                   | Shared With            | Retention | Consent Required | Severity |
| ----------------------------- | ---------------------------------------------- | ---------------------- | --------- | ---------------- | -------- |
| Image Prompt (full text)      | Convex `imageGenerationEvents.promptUsed`      | **Replicate** (SD 3.5) | 90 days   | Yes (under-13)   | **HIGH** |
| XP Cost & Generation Status   | Convex `imageGenerationEvents`                 | None                   | 90 days   | No               | INFO     |
| API Response Time             | Convex `imageGenerationEvents.apiResponseTime` | None                   | 90 days   | No               | INFO     |
| Service Used (which AI model) | Convex `imageGenerationEvents.serviceUsed`     | None                   | 90 days   | No               | INFO     |

### 1.6 Download History

| Data Point       | Where Stored                                 | Shared With | Retention          | Consent Required | Severity |
| ---------------- | -------------------------------------------- | ----------- | ------------------ | ---------------- | -------- |
| File Name & Path | Convex `storyDownloadHistory`                | None        | 1 year (cascading) | No               | LOW      |
| Download Method  | Convex `storyDownloadHistory.downloadMethod` | None        | 1 year (cascading) | No               | INFO     |
| App Version      | Convex `storyDownloadHistory.appVersion`     | None        | 1 year (cascading) | No               | INFO     |

### 1.7 Analytics Data

| Data Point                  | Where Stored                        | Shared With | Retention    | Consent Required | Severity   |
| --------------------------- | ----------------------------------- | ----------- | ------------ | ---------------- | ---------- |
| Anonymized User ID (hashed) | Supabase (analytics) + AsyncStorage | None        | Unclear      | No               | **MEDIUM** |
| Session ID                  | Supabase (analytics) + AsyncStorage | None        | Unclear      | No               | LOW        |
| Story Import Events         | Supabase (analytics)                | None        | Unclear      | No               | INFO       |
| Performance Metrics         | AsyncStorage (local)                | None        | Device-local | No               | INFO       |

### 1.8 Device & Session Data

| Data Point                      | Where Stored                       | Shared With              | Retention      | Consent Required | Severity   |
| ------------------------------- | ---------------------------------- | ------------------------ | -------------- | ---------------- | ---------- |
| Session Fingerprint (ephemeral) | Supabase via `register_device` RPC | Supabase                 | Session-scoped | Yes (under-13)   | **MEDIUM** |
| Device Type (MOBILE/TABLET)     | Supabase via audit logger          | Supabase                 | Session-scoped | No               | LOW        |
| OS Name & Version               | Supabase via audit logger          | Supabase                 | Session-scoped | No               | LOW        |
| Screen Dimensions               | Supabase via audit logger          | None (local fingerprint) | Session-scoped | No               | INFO       |
| Timezone & Locale               | Supabase via audit logger          | None (local fingerprint) | Session-scoped | No               | LOW        |

---

## 2. Third-Party Data Transmission

### 2.1 OpenAI (GPT-4 / text-embedding-3-small)

**Data Transmitted:**

- Story content (user's written text) — scrubbed of PII via `piiScrubber.ts` for story continuation
- Story continuation prompts with system instructions
- **[UNSCRUBBED]** Story text for LLM image prompt analysis (`openaiClient.analyzeStoryForImageGeneration` at `imageGeneration.ts:12427` — raw `storyText` passed without PII scrubbing; the scrub at line 8558 only runs on the _output_ prompt before Replicate, not on the input to OpenAI)
- **[UNSCRUBBED]** Story element text for embedding generation (`embeddingGenerationService.ts` — no PII scrubber import or call exists in this service)

**PII Mitigation:** `piiScrubber.ts` (US-008) runs client-side before **some** OpenAI calls. Scrubs: emails, phone numbers, SSNs, addresses, ZIP codes, name introductions ("my name is X"), school references, location disclosures, age disclosures, narrative name patterns. **However, two OpenAI code paths skip PII scrubbing entirely (see above).**

**Client-Side API Calls:** All OpenAI requests are made directly from the client device via `fetch()`. The API key is loaded from `Environment.openai.apiKey` which includes a **hardcoded fallback key** in `src/config/environment.ts:76` (gated by `__DEV__` but still present in source).

**Risk Assessment:** **CRITICAL**

- Two OpenAI code paths transmit children's content **without PII scrubbing**: embedding generation and LLM image prompt analysis
- Story content written by children could contain PII not caught by regex patterns (e.g., "I went to the park with my friend Jayden from room 204")
- PII scrubber uses regex-only approach — sophisticated patterns may escape detection
- OpenAI's data retention policy applies to all transmitted content
- No documented Data Processing Agreement (DPA) with OpenAI referenced in codebase
- Hardcoded API key in source code (`environment.ts:76`) — if extracted from app binary, could be abused

**Files:** `src/services/openaiClient.ts`, `src/services/storyGenerationService.ts:1154-1157`, `src/services/embeddingGenerationService.ts`, `src/services/imageGeneration.ts:12427`, `src/config/environment.ts:76`

### 2.2 Replicate (Stable Diffusion 3.5 Large)

**Data Transmitted:**

- Image generation prompts (derived from story content, PII-scrubbed)
- Grade level information (embedded in art style keywords)

**PII Mitigation:** PII scrubber runs on prompts before Replicate API call (`src/services/imageGeneration.ts:8558`).

**Risk Assessment:** **MEDIUM**

- Prompts are AI-generated descriptions, not raw user text — lower PII risk
- Image generation prompts are stored in Convex with 90-day retention
- No documented DPA with Replicate

**Files:** `src/services/imageGeneration.ts:49-57`

### 2.3 Clerk (Authentication)

**Data Transmitted:**

- OAuth tokens (Google/Apple)
- Email address (from OAuth provider)
- User identity metadata

**Risk Assessment:** **MEDIUM**

- Clerk receives and stores user email from OAuth providers
- For under-13 users, email collection requires VPC under COPPA
- Clerk's own data practices need to be covered in privacy policy
- JWTs issued by Clerk contain user identity claims

**Files:** `App.tsx:24`, `src/context/AuthContext.tsx`, `@clerk/clerk-expo` package

### 2.4 Supabase (Legacy Backend)

**Data Transmitted:**

- User profiles (legacy email/password users)
- Audit log entries (session fingerprint, device type, OS info)
- Device registration via `register_device` RPC
- Analytics events (anonymized user IDs)

**Risk Assessment:** **MEDIUM**

- Legacy path still active for email/password users
- `register_device` RPC sends session fingerprint and device metadata to Supabase
- Audit logger comment says "no persistent device IDs" but still registers device info

**Files:** `src/services/auditLogger.ts:421-426`, `src/services/syncService.ts`

### 2.5 Convex (Primary Backend)

**Data Transmitted:**

- All primary user data (profiles, stories, images, gamification)
- Consent records (parent emails, consent tokens)

**Risk Assessment:** **LOW**

- First-party backend, not a third-party data processor in the traditional sense
- Data is encrypted in transit (HTTPS) and at rest by Convex
- Convex is the data controller's processor

**Files:** `convex/schema.ts`, all `convex/*.ts` function files

### 2.6 Google/Apple OAuth Providers

**Data Transmitted:**

- Authentication flow redirects
- User grants access to profile (name, email, profile picture)

**Risk Assessment:** **MEDIUM**

- OAuth scope determines what data is received
- Profile picture and full name may be received from provider
- For under-13 users, OAuth provider interaction requires careful COPPA handling

### 2.7 Claude Skills SDK

**Data Transmitted:** **None (mock implementation)**

**Risk Assessment:** **LOW (INFO)**

- `src/services/claudeSkillsManager.ts` is a proof-of-concept with mock/simulated operations
- No actual API calls to Anthropic/Claude are made
- Line 19: `// Mock implementation for proof-of-concept`

**Files:** `src/services/claudeSkillsManager.ts:19-21`

### 2.8 ElevenLabs / Cloud TTS

**Data Transmitted:** **None**

**Risk Assessment:** **INFO**

- App uses `react-native-tts` (on-device TTS) — no cloud speech synthesis
- `src/services/textToSpeechIsolated.ts` is a mock/fallback for simulators
- No ElevenLabs SDK or cloud TTS service found in dependencies or code

---

## 3. Speech Recognition Analysis

### On-Device vs. Cloud Processing

**iOS:** Uses native `SpeechRecognizerModule` via `src/services/nativeSpeechRecognizer.ts` — this wraps Apple's `SFSpeechRecognizer`. **Apple's speech recognition sends audio to Apple's servers for processing** (unless configured for on-device only, which is not explicitly set in the codebase).

**Android:** Uses `@react-native-voice/voice` — this wraps Android's `SpeechRecognizer`. **Google's speech recognition sends audio to Google's servers** by default.

**Risk Assessment:** **HIGH**

- Children's voice audio is transmitted to Apple/Google servers for speech-to-text
- This constitutes collection of audio recordings from children under COPPA
- The app's `app.json` declares `NSSpeechRecognitionUsageDescription` and `NSMicrophoneUsageDescription` permissions
- No on-device-only configuration found (iOS 13+ supports on-device with `requiresOnDeviceRecognition`)
- Voice input text goes through PII scrubber, but the raw **audio** has already been transmitted to Apple/Google

**Files:** `src/components/common/VoiceInput.tsx`, `src/services/nativeSpeechRecognizer.ts`, `app.json:16-17`

---

## 4. Persistent Identifiers Analysis

| Identifier                           | Persistent?                      | Transmitted To      | COPPA Concern                               | Severity   |
| ------------------------------------ | -------------------------------- | ------------------- | ------------------------------------------- | ---------- |
| Clerk User ID (`user_xxxxx`)         | Yes (account lifetime)           | Clerk, Convex       | Yes — persistent identifier linked to child | **HIGH**   |
| Supabase User UUID                   | Yes (account lifetime)           | Supabase            | Yes — persistent identifier linked to child | **MEDIUM** |
| Session Fingerprint (audit logger)   | No (session-scoped, regenerated) | Supabase            | Low — ephemeral, not cross-session          | LOW        |
| AsyncStorage Device ID (syncService) | Yes (persisted locally)          | Supabase (sync)     | Yes — persists across sessions              | **MEDIUM** |
| OAuth Tokens (Clerk)                 | Yes (until expiry/revocation)    | Clerk, Google/Apple | Yes — linked to identity                    | **MEDIUM** |
| Analytics User Hash (`anon_xxx`)     | Yes (deterministic hash)         | Supabase            | Medium — pseudonymous but deterministic     | **MEDIUM** |

**Key Finding:** The analytics service (`src/services/analyticsService.ts:21-36`) uses a deterministic hash with a hardcoded salt (`'cb-analytics-v1'`). While one-way, the same userId always produces the same hash, making it a **persistent pseudonymous identifier** that could potentially be correlated across sessions.

---

## 5. Data Retention Summary

| Data Category                 | Retention Period              | Enforcement Mechanism                 | Notes                                   |
| ----------------------------- | ----------------------------- | ------------------------------------- | --------------------------------------- |
| Story Sessions                | 1 year after last access      | Convex cron (daily, 3 AM UTC)         | Cascades to elements, scores, downloads |
| Image Generation Events       | 90 days                       | Convex cron (daily, 3 AM UTC)         | Includes stored prompts                 |
| Migration Events              | 30 days                       | Convex cron (daily, 3 AM UTC)         | Emails scrubbed before deletion         |
| Consent Records               | 3 years post-account deletion | Convex cron (weekly, Sunday 5 AM UTC) | COPPA requirement                       |
| Pending Consent (no response) | 48 hours                      | Convex cron (daily, 4 AM UTC)         | Account data deleted                    |
| User Profiles                 | Until account deletion        | Manual/user-initiated                 | No auto-expiry                          |
| Supabase Analytics            | **Undefined**                 | **None found**                        | **No automated cleanup**                |
| AsyncStorage (local)          | **Indefinite**                | **None found**                        | Persists until app uninstall            |

---

## 6. Red Flags and Recommendations

### CRITICAL

1. **[CRITICAL] Speech Recognition Audio Transmitted to Apple/Google Without Explicit COPPA Consent Disclosure**

   - Voice audio from children is sent to Apple (iOS) and Google (Android) servers for speech-to-text processing
   - This is not explicitly disclosed in the consent flow as third-party data sharing
   - **Recommendation:** Either (a) configure `requiresOnDeviceRecognition = true` on iOS 13+ to force on-device processing, (b) explicitly disclose audio transmission to Apple/Google in the VPC consent form, or (c) disable voice features for under-13 users until consent covers this

2. **[CRITICAL] No Data Processing Agreements (DPAs) Referenced for AI Services**

   - OpenAI and Replicate receive children's story content (even scrubbed)
   - Under COPPA, operators must ensure third parties maintain confidentiality and security of children's data
   - No DPAs, BAAs, or data processing terms are referenced in the codebase or documentation
   - **Recommendation:** Execute COPPA-compliant DPAs with OpenAI and Replicate. Ensure contracts prohibit use of children's data for model training

3. **[CRITICAL] Client-Side AI API Calls with Hardcoded API Key**

   - All OpenAI and Replicate API calls are made directly from the client device via `fetch()`, not proxied through a backend
   - `src/config/environment.ts:76` contains a hardcoded OpenAI API key as a `__DEV__` fallback (`sk-proj-Hj1R...`). Even though gated by `__DEV__`, the key is present in source code and could leak into builds
   - Client-side API keys can be extracted from app binaries, enabling abuse and unauthorized access to AI services processing children's data
   - **Recommendation:** (a) Move all AI API calls server-side through Convex actions to keep keys off-device, (b) immediately rotate the exposed API key, (c) remove all hardcoded keys from source code

4. **[CRITICAL] Two OpenAI Code Paths Skip PII Scrubbing Entirely**
   - **Embedding generation** (`embeddingGenerationService.ts`): sends story element text directly to OpenAI `text-embedding-3-small` with zero PII scrubbing — no import of `piiScrubber` exists in the file
   - **LLM image prompt analysis** (`imageGeneration.ts:12427`): `openaiClient.analyzeStoryForImageGeneration(storyText)` sends raw, unscrubbed story content to OpenAI GPT-4. The PII scrub at line 8558 only runs on the _output_ prompt before it goes to Replicate, not on the _input_ to OpenAI
   - Children's story text containing PII flows directly to OpenAI without any redaction in these paths
   - **Recommendation:** (a) Add `piiScrubber.scrubText()` to `embeddingGenerationService.ts` before all API calls, (b) scrub `storyText` before passing to `analyzeStoryForImageGeneration`, (c) audit all other OpenAI call sites for PII scrubbing gaps

### HIGH

3. **[HIGH] PII Scrubber Relies Solely on Regex Patterns**

   - Regex-only PII detection has known gaps: uncommon name patterns, contextual PII ("my teacher Mrs. Johnson"), implicit locations, etc.
   - Children are especially prone to revealing PII in creative writing contexts
   - **Recommendation:** Consider adding ML-based NER (Named Entity Recognition) as a secondary PII detection layer, or route under-13 content through a stricter pipeline

4. **[HIGH] Parent Email Stored in Consent Records Without Encryption**

   - `consentRecords.parentEmail` is stored as plaintext in Convex
   - **Recommendation:** Hash or encrypt parent email at rest. Only store what's needed for consent verification

5. **[HIGH] Clerk OAuth May Receive Child's Full Name from Google/Apple**
   - OAuth providers may return the child's real name, profile photo, and email
   - `convex/userProfiles.ts` has a real-name blocking feature for under-13 (US-010), but the data still reaches Clerk before being filtered
   - **Recommendation:** Verify Clerk OAuth scopes are minimized. Ensure only email (not name/photo) is requested from OAuth providers for under-13 accounts

### MEDIUM

6. **[MEDIUM] Analytics Retention Policy Undefined for Supabase**

   - Convex has automated retention cleanup (crons), but Supabase analytics data has no documented retention or cleanup
   - **Recommendation:** Implement retention cleanup for Supabase analytics data, or migrate all analytics to Convex with defined retention

7. **[MEDIUM] Deterministic Analytics Hash is a Pseudonymous Persistent Identifier**

   - The analytics hash function with hardcoded salt produces the same output for the same user across all sessions
   - Under COPPA, pseudonymous persistent identifiers used for behavioral tracking require consent
   - **Recommendation:** Use session-scoped random IDs for under-13 users instead of deterministic hashes

8. **[MEDIUM] Device Registration in Audit Logger**

   - `auditLogger.ts:421` sends device info (type, OS, version) to Supabase via `register_device` RPC
   - While the session fingerprint is ephemeral, the device metadata combined with user ID creates a device profile
   - **Recommendation:** For under-13 users, skip device registration or reduce metadata to minimum necessary

9. **[MEDIUM] AsyncStorage Contains Sensitive Session Data**

   - Story sessions, credentials (via claudeSkillsCredentialRotation), and device IDs persist in AsyncStorage indefinitely
   - AsyncStorage is not encrypted on all Android devices
   - **Recommendation:** Audit all AsyncStorage keys, set TTLs, and use `expo-secure-store` for sensitive data

10. **[MEDIUM — UPGRADED TO CRITICAL, see #4 above] OpenAI Embedding API Receives Unscrubbed Story Element Text**
    - `embeddingGenerationService.ts` sends story elements directly to OpenAI's `text-embedding-3-small` with NO PII scrubbing
    - The service does not import or call `piiScrubber` — confirmed by code review
    - **Recommendation:** See CRITICAL finding #4 above

### LOW

11. **[LOW] Reactotron Debug Tool in Dependencies**

    - `reactotron-react-native` is in devDependencies — should not ship in production builds
    - **Recommendation:** Verify Reactotron is stripped from production bundles

12. **[LOW] Display Name Could Be Real Name**
    - `displayName` field allows free text entry; children might enter their real name
    - US-010 blocks auto-population for under-13, but manual entry is still possible
    - **Recommendation:** Add guidance text discouraging real names for under-13 users

---

## 7. Positive COPPA Controls Identified

- **PII Scrubber (US-008):** Client-side PII detection and redaction before AI API calls
- **Age Gating (US-001):** Three-tier age classification with under-13 detection
- **VPC Flow (US-002):** Email Plus method with 48-hour expiry and annual renewal
- **Data Retention Crons (US-015):** Automated cleanup with cascading deletes
- **Analytics Anonymization (US-013):** User IDs hashed before analytics storage, device info removed
- **Content Safety (US-014):** 200+ term blocklist, input/output safety checks
- **Consent Record Retention:** 3-year post-deletion retention per COPPA
- **Expired Consent Cleanup:** 48-hour auto-deletion of unconfirmed accounts
- **Annual Consent Renewal (US-022):** 11-month reminder, 12-month enforcement

---

## 8. Data Flow Diagram (Text)

```
NOTE: All AI API calls below happen CLIENT-SIDE (direct fetch from device, not via backend proxy).
API keys are bundled in the app binary.

User Input (text/voice)
    |
    +--[Voice Audio]---> Apple SFSpeech / Google SpeechRecognizer (CLOUD)
    |                         |
    |                    [Transcribed Text]
    |                         |
    v                         v
[PII Scrubber] <--- User Text + Transcribed Text
    |
    +--[Scrubbed Story Text]---> OpenAI GPT-4 (story continuation) [PII SCRUBBED]
    |                                  |
    |                           [AI-generated story text]
    |                                  |
    +--[RAW Story Text]---------> OpenAI GPT-4 (image prompt analysis) [NOT SCRUBBED!]
    |                                  |
    |                           [Image prompt text]
    |                                  |
    +--[Scrubbed Image Prompt]---> Replicate SD 3.5 (image generation) [PII SCRUBBED]
    |                                  |
    |                           [Generated image URL]
    |                                  |
    +--[RAW Story Elements]-----> OpenAI Embeddings (diversity tracking) [NOT SCRUBBED!]
    |
    v
[Convex Backend] <--- All structured data (profiles, sessions, events)
    |
    +--[Auth Flow]---> Clerk <---> Google/Apple OAuth
    |
    +--[Legacy Users]---> Supabase (profiles, audit logs, analytics)
    |
    +--[Consent Email]---> Email Service (parent email + consent link)
```

---

**Audit completed:** 2026-03-25
**Next review recommended:** Before any App Store submission or significant data flow changes
