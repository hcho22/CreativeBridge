# AI Data Safety Audit - COPPA Compliance

**Date:** 2026-03-25
**Auditor:** AI Data Safety Agent
**Scope:** All AI service integrations in CreativeBridge
**App Version:** 1.0.0
**Status:** Complete

---

## Executive Summary

CreativeBridge integrates with **three external AI/ML services** (OpenAI, Replicate, Apple/Google Speech Recognition) that receive children's data. Claude Skills SDK is a mock/PoC with no actual API calls. TTS uses the on-device `react-native-tts` library with no external service (ElevenLabs is NOT used). Embeddings are generated via OpenAI's API.

**Key risks:** (1) All AI API calls are made **client-side** from the React Native app, meaning API keys are bundled into the app binary and exposed to users. A hardcoded development API key exists in source code. (2) Speech recognition sends children's voice audio to Apple/Google cloud services. (3) The regex-only PII scrubber cannot catch contextual PII common in children's creative writing, and multiple code paths skip PII scrubbing entirely.

### Finding Summary

| Severity | Count | Description                                                                                                                                         |
| -------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| CRITICAL | 2     | Hardcoded API key in source; client-side API keys                                                                                                   |
| HIGH     | 4     | Speech recognition sends voice to cloud; regex PII scrubber gaps; embedding service missing PII scrub + org header; image analysis PII scrub timing |
| MEDIUM   | 2     | Console logs include story content; OpenAI 30-day retention without ZDR                                                                             |
| LOW      | 1     | Cosine similarity vectors theoretically reversible                                                                                                  |
| INFO     | 3     | Claude Skills is mock; TTS is local; anomaly detector uses anonymized IDs                                                                           |

---

## 1. OpenAI API (GPT-4o-mini / Embeddings / Moderation)

### 1.1 API Calls Identified

| Endpoint                    | Service File                        | Purpose                                        |
| --------------------------- | ----------------------------------- | ---------------------------------------------- |
| `POST /v1/chat/completions` | `openaiClient.ts:62`                | Story generation                               |
| `POST /v1/chat/completions` | `openaiClient.ts:230`               | Image prompt analysis (story-to-image)         |
| `POST /v1/embeddings`       | `embeddingGenerationService.ts:204` | Story element embedding for diversity tracking |
| `POST /v1/moderations`      | (via `contentSafetyService`)        | Content moderation                             |

### 1.2 Data Sent to OpenAI

**Story Generation (`storyGenerationService.ts`):**

- System prompt with agent persona and grade-level instructions
- User's story input (user-written text)
- Story-so-far context (accumulated story content)
- Grade level (K-2, 3-5, 6-8, 9-12)

**Image Prompt Analysis (`openaiClient.ts:210-255`):**

- Full story excerpt text sent for visual element extraction
- No user identifiers sent in the prompt

**Embedding Generation (`embeddingGenerationService.ts`):**

- Story element text (characters, settings, themes) — normalized to lowercase
- No user identifiers sent

### 1.3 Training Opt-Out Status

- **[INFO]** OpenAI API data is **NOT used for model training** by default (per OpenAI's API Data Usage Policy, verified 2026-03-24 per `.claude/.agent/System/ai-data-policies.md`)
- **[INFO]** `OpenAI-Organization` header is correctly included in all `openaiClient.ts` API calls via `getOpenAIHeaders()` (`src/config/environment.ts:132-144`)
- **[MEDIUM] FINDING: OpenAI retains API data for up to 30 days** for abuse monitoring. Zero Data Retention (ZDR) has NOT been obtained yet. This means children's story content may be retained by OpenAI for 30 days.
  - **Recommendation:** Pursue ZDR agreement with OpenAI citing COPPA requirements (documented as action item in `ai-data-policies.md`).

### 1.4 PII Scrubbing Assessment

**[INFO] Story Generation — PROPERLY SCRUBBED:**

- `storyGenerationService.ts:1153-1157` applies both `sanitizePromptInput()` (anti-injection) and `piiScrubber.scrubText()` before building the OpenAI prompt
- Scrubs: emails, phone numbers, SSNs, addresses, ZIP codes, name introductions, narrative names, age disclosures, school references, location disclosures
- PII scrubbing runs client-side, so PII never leaves the device

**[HIGH] FINDING: Embedding Service — NO PII SCRUBBING:**

- `embeddingGenerationService.ts:201-215` sends text directly to OpenAI `/v1/embeddings` endpoint
- No call to `piiScrubber` anywhere in the file
- Story element text (character names, settings) is sent un-scrubbed
- The text IS normalized (lowercase, trimmed) but this is for caching, not PII removal
- **Risk:** If a child names a character after themselves or includes real locations, this PII reaches OpenAI
- **Recommendation:** Add `piiScrubber.scrubText()` call before `callEmbeddingAPI()` in `generateEmbedding()` method

**[HIGH] FINDING: Embedding Service — MISSING ORGANIZATION HEADER:**

- `embeddingGenerationService.ts:207-208` constructs its own headers with only `Content-Type` and `Authorization`
- Does NOT include `OpenAI-Organization` header (unlike `openaiClient.ts` which uses `getOpenAIHeaders()`)
- **Risk:** Organization-level data policies may not apply to embedding API calls
- **Recommendation:** Use `getOpenAIHeaders()` from environment config instead of manually constructing headers

**[HIGH] FINDING: Story Agent — NO PII SCRUBBING:**

- `storyAgent.ts` imports `sanitizePromptInput` but NOT `piiScrubber`
- The story agent delegates to `storyGenerationService` for actual API calls, so if it always goes through that path, PII is scrubbed downstream
- However, if `storyAgent.ts` ever makes direct API calls or passes unscrubbed data, PII could leak
- **Recommendation:** Add explicit PII scrubbing at the storyAgent level as defense-in-depth

### 1.5 Image Prompt Analysis

- `openaiClient.ts:210-255` (`analyzeStoryForImageGeneration`) sends story text to GPT for visual element extraction
- The story text passed to this method comes from `imageGeneration.ts` which DOES call `piiScrubber.scrubText(prompt)` at line 8558 before sending to Replicate
- However, the OpenAI analysis step (which happens BEFORE the Replicate call) receives the raw story content
- **Assessment:** The story content sent to OpenAI for image prompt analysis may not be PII-scrubbed at the point of the OpenAI call. The PII scrub at line 8558 occurs after the OpenAI analysis returns.
- **Recommendation:** Verify the call chain and ensure PII scrubbing happens before the OpenAI image analysis call, not just before the Replicate call.

---

## 2. Replicate API (Stable Diffusion 3.5 / Google Nano Banana)

### 2.1 API Calls Identified

| Endpoint                   | Service File              | Purpose                                     |
| -------------------------- | ------------------------- | ------------------------------------------- |
| `POST /v1/predictions`     | `imageGeneration.ts:1004` | Create image generation prediction (SD 3.5) |
| `GET /v1/predictions/{id}` | `imageGeneration.ts:1024` | Poll prediction status                      |
| `POST /v1/predictions`     | `imageGeneration.ts:1369` | Backup service (Nano Banana)                |

### 2.2 Data Sent to Replicate

- **Text prompts only** — derived from story content after analysis
- Prompts include: art style keywords, scene descriptions, character descriptions, mood/setting
- **No user identifiers** (userId, sessionId, etc.) are sent to Replicate
- Image generation parameters: width, height, inference steps, guidance scale, negative prompt

### 2.3 PII Scrubbing

- **[INFO] PROPERLY SCRUBBED:** `imageGeneration.ts:8558` calls `piiScrubber.scrubText(prompt)` before sending to Replicate
- Content safety check (`checkOutputSafety`) also runs on the prompt before API call
- Backup service prompt is sanitized via `sanitizePrompt()` method (`imageGeneration.ts:1103`)

### 2.4 Training Opt-Out

- **[INFO]** Per Replicate's Terms of Service (verified 2026-03-24): customer inputs/outputs are not used for training
- Stability AI's SD models are served by Replicate infrastructure under Replicate's data handling terms
- **[MEDIUM]** Specific data retention period not confirmed — should be addressed via DPA negotiation (US-006)

### 2.5 Image Retention

- Generated images are returned as URLs from Replicate's CDN
- Images are then stored in Convex Storage (`imageStorageService.ts`, `postGenerationStorageService.ts`)
- Replicate may retain prediction data (including generated images) per their retention policy
- **Recommendation:** Confirm Replicate's image retention period via DPA and document it

---

## 3. Claude Skills SDK

### 3.1 Assessment: MOCK IMPLEMENTATION — NO ACTUAL API CALLS

- **[INFO]** `claudeSkillsManager.ts` is explicitly labeled as "Mock implementation for proof-of-concept" (line 20)
- The `ClaudeSkillsManagerImpl` class simulates skill execution via `simulateSkillExecution()` and `simulateAsyncOperation()` — no external HTTP calls
- No Anthropic API client or SDK is imported
- `claudeSkillsConfigManager.ts` uses `react-native-keychain` for secure credential storage (well-designed) but credentials are never used for actual API calls
- `claudeSkillsMonitor.ts` tracks local metrics only

### 3.2 Data Handling

- The mock system accepts `userId` and `sessionId` as part of `SkillInput` for tracking purposes
- No data leaves the device — all processing is simulated locally
- **Risk Level:** None (no external communication)

### 3.3 Future Concern

- When Claude Skills SDK is eventually integrated for real, the same PII scrubbing and data safety measures applied to OpenAI must be applied
- **Recommendation:** Create a checklist/gate for when Claude Skills moves from PoC to production integration

---

## 4. ElevenLabs / TTS

### 4.1 Assessment: NOT USED — LOCAL TTS ONLY

- **[INFO]** CreativeBridge uses `react-native-tts` (native on-device TTS), NOT ElevenLabs
- `textToSpeech.ts` imports only `react-native` and uses `require('react-native-tts')`
- `textToSpeechSafe.ts` and `textToSpeechIsolated.ts` are wrapper/safety variants of the same local TTS
- **No voice data is sent to any external service**
- **No ElevenLabs SDK or API calls exist** in the codebase (grep confirmed — only references are in audit/compliance docs)

### 4.2 Data Flow

- Text → on-device TTS engine → audio output
- No network calls for speech synthesis
- **Risk Level:** None

---

## 5. Speech Recognition (Apple SFSpeechRecognizer / Google SpeechRecognizer)

### 5.1 Assessment: CLOUD AI SERVICE RECEIVING CHILDREN'S VOICE DATA

**[HIGH] FINDING: Speech recognition sends children's voice audio to Apple/Google cloud services**

- **iOS:** `nativeSpeechRecognizer.ts` wraps the native `SFSpeechRecognizerModule` (iOS SFSpeechRecognizer API). Apple's SFSpeechRecognizer uses **cloud-based processing by default** — voice audio is streamed to Apple's servers for transcription.
- **Android/Cross-platform:** `VoiceInput.tsx:28` imports `@react-native-voice/voice` which wraps Google's `SpeechRecognizer` — also a **cloud-based** service.
- **Data transmitted:** Raw audio of children speaking their story contributions. This could include:
  - The child's voice (biometric data)
  - Spoken PII (names, locations, schools mentioned verbally)
  - Story content dictated by the child
- **No PII scrubbing possible:** Audio is streamed live to cloud before transcription — PII scrubbing can only happen AFTER the text is returned, but the raw audio has already been transmitted.

### 5.2 Privacy Implications

- Apple's SFSpeechRecognizer privacy policy states audio may be processed on Apple servers but is not associated with the user's Apple ID
- Google's Speech-to-Text may retain audio data per Google's data retention policies
- Neither Apple nor Google provides a child-specific data processing agreement for speech recognition services
- Under COPPA, voice recordings of children constitute personal information

### 5.3 Recommendations

1. **iOS 13+:** Investigate using `SFSpeechRecognizer` with `requiresOnDeviceRecognition = true` to force on-device processing (no cloud transmission). This limits language support but eliminates cloud data transmission.
2. **Android:** Investigate on-device speech recognition options (Android's offline speech recognition models).
3. **Consent:** Ensure parental consent covers voice data transmission to Apple/Google cloud services. The consent flow should specifically mention voice processing.
4. **Privacy policy:** Explicitly disclose that voice input feature transmits audio to Apple/Google for processing.

---

## 6. Overall PII Leakage Assessment

### 6.1 Comprehensive Risk: Regex PII Scrubber + Coverage Gaps

**[HIGH] FINDING: Combined PII leakage risk to AI services is significant**

The PII protection strategy has two compounding weaknesses:

**Weakness 1: Regex-only scrubber cannot catch contextual PII**

The `piiScrubber.ts` uses pattern matching which works well for structured PII (emails, phones, SSNs, addresses) but **cannot detect contextual PII** common in children's creative writing:

| PII Type                      | Example                                 | Caught?                                |
| ----------------------------- | --------------------------------------- | -------------------------------------- |
| Email                         | `john@school.edu`                       | Yes                                    |
| Phone                         | `(555) 123-4567`                        | Yes                                    |
| SSN                           | `123-45-6789`                           | Yes                                    |
| "My name is X"                | `My name is Emma`                       | Yes                                    |
| Narrative name                | `named Emma Chen`                       | Yes                                    |
| Age disclosure                | `I'm 8 years old`                       | Yes                                    |
| Teacher name (contextual)     | `my teacher Mrs. Johnson`               | **NO**                                 |
| Friend reference              | `me and my best friend Sarah went`      | **NO**                                 |
| School name (without keyword) | `at Lincoln Elementary`                 | Partial (requires "I go to" prefix)    |
| Parent name                   | `my mom Jennifer drives me`             | **NO**                                 |
| Pet name + address context    | `my dog Rex and I walk on Maple Street` | Partial (address caught, pet name not) |
| Hometown in narrative         | `back home in Springfield`              | **NO**                                 |
| Classroom details             | `in Mr. Davis's third grade class`      | **NO**                                 |

**Weakness 2: Multiple code paths skip PII scrubbing entirely**

| Code Path                                                                   | PII Scrubbed?                                    | Risk      |
| --------------------------------------------------------------------------- | ------------------------------------------------ | --------- |
| Story generation (`storyGenerationService.ts`)                              | Yes                                              | Protected |
| Image prompt to Replicate (`imageGeneration.ts:8558`)                       | Yes                                              | Protected |
| Image analysis to OpenAI (`openaiClient.ts:analyzeStoryForImageGeneration`) | **Unclear** — scrub may happen after this call   | HIGH      |
| Embedding generation (`embeddingGenerationService.ts`)                      | **NO**                                           | HIGH      |
| Speech recognition audio (Apple/Google)                                     | **Impossible** — audio sent before text returned | HIGH      |

### 6.2 Overall Assessment

**Combined risk: HIGH.** Even on the well-protected story generation path, the regex scrubber will miss contextual PII that children naturally include in creative writing. On unprotected paths (embeddings, image analysis, speech audio), both structured and contextual PII can reach third-party services.

### 6.3 Recommendations

1. **Short-term:** Close the coverage gaps — add `piiScrubber.scrubText()` to all code paths that transmit data to external services (embeddings, image analysis).
2. **Medium-term:** Augment the regex scrubber with an LLM-based PII detection pass. Use OpenAI's moderation/completion API or a local model to identify contextual PII before transmission. This creates a two-layer defense: regex for structured PII (fast, reliable) + LLM for contextual PII (slower, catches edge cases).
3. **Long-term:** Move all AI API calls server-side (Convex actions). This enables centralized PII scrubbing at the server layer as a guaranteed chokepoint, regardless of which client code path is taken.
4. **Speech recognition:** Enable on-device recognition where available (iOS 13+ `requiresOnDeviceRecognition`). For cloud-based recognition, ensure parental consent explicitly covers voice data.

---

## 7. Embeddings & Cosine Similarity

### 5.1 Embedding Generation

- **Service:** `embeddingGenerationService.ts` uses OpenAI `text-embedding-3-small` model
- **Dimensions:** 1536-dimensional vectors
- **Data sent:** Normalized story element text (characters, settings, themes)
- **Caching:** In-memory cache (Map) with 1000-entry limit — prevents redundant API calls
- **PII concern:** See Finding in Section 1.4 — NO PII scrubbing before embedding API call

### 5.2 Cosine Similarity

- **[INFO]** `cosineSimilarityService.ts` is a **pure local computation** — no API calls
- Implements standard cosine similarity formula with proper edge case handling
- Used to compare embedding vectors for story element diversity detection

### 5.3 Embedding Reversibility

- **[LOW]** OpenAI's `text-embedding-3-small` produces 1536-dimensional vectors
- Modern embedding models are designed to be one-way — exact text recovery from an embedding vector is computationally infeasible
- However, with access to the same model, an attacker could test candidate texts against stored vectors to find matches (embedding inversion attacks)
- Embedding vectors are stored in Convex (`storyElements` table, `embeddingVector` field per `convex/schema.ts`)
- **Risk:** LOW — practical exploitation requires model access + candidate text generation. Story elements are generic (character types, settings) rather than PII.
- **Recommendation:** Ensure embedding vectors are covered by the same access controls as story content

### 5.4 Vector Storage

- Vectors stored in Convex `storyElements` table alongside `storyId`, `elementType`
- Access controlled by Convex auth (Clerk JWT verification)
- No public/unauthenticated access to embedding vectors

---

## 8. Anomaly Detection & Logging

### 6.1 Anomaly Detection

- **[INFO]** `anomalyDetector.ts` implements COPPA-aware user anonymization
- `hashUserId()` function (line 52-61) creates one-way hashed IDs: `anon_${hash}` format
- Uses salted hash (`'anomaly-detector-coppa'` prefix) — cannot be reversed to recover userId
- `UserBehaviorProfile` stores `anonymousId` (not real userId) with behavioral patterns

### 6.2 Audit Logger

- **[INFO]** `auditLogger.ts` collects non-identifying device info only (COPPA-compliant)
- Uses ephemeral `sessionId` (not persisted across app launches)
- Collects: device type, OS, app version, screen dimensions, timezone, locale
- Does NOT collect persistent device identifiers (IDFA, IDFV, etc.)
- `AuditLogEntry` interface includes optional `userId` field — this goes to Supabase audit tables

### 6.3 Console Logging Concerns

- **[MEDIUM] FINDING: Console logs contain story content previews**
  - `storyGenerationService.ts:205-208` logs `storyPreview` (last 150 chars of story)
  - `openaiClient.ts:64-69` logs request metadata (model, message count — but NOT content)
  - `openaiClient.ts:105-109` logs response metadata (length, finish reason, usage — but NOT content)
  - `embeddingGenerationService.ts:85-88` logs first 50 chars of embedding text
  - Multiple services log user-related metadata
- **Risk:** In debug builds, console logs may contain children's story content. If logs are captured by crash reporting tools or device logs, this could constitute unintended data collection.
- **Recommendation:** Ensure production builds strip or disable verbose console logging. Use structured logging with PII-safe fields only.

---

## 9. API Key Security

### 7.1 CRITICAL FINDINGS

**[CRITICAL] FINDING: Hardcoded OpenAI API Key in Source Code**

- `src/config/environment.ts:76` contains a hardcoded development API key:
  ```
  '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'
  ```
- This key is guarded by `__DEV__` check (only used in development builds), but it is still committed to the repository
- **Risk:** Anyone with access to the git repository can see and use this API key. If the key has billing attached, it could be abused. The key prefix `sk-proj-` indicates a project-scoped key.
- **Immediate Action Required:** Rotate this API key immediately and remove it from source code. Use environment variables or secure credential management exclusively.

**[CRITICAL] FINDING: All API Calls Made Client-Side**

- OpenAI API calls: made directly from React Native app via `fetch()` in `openaiClient.ts` and `embeddingGenerationService.ts`
- Replicate API calls: made directly from React Native app via `fetch()` in `imageGeneration.ts`
- API keys are loaded from environment config and bundled into the app binary
- **Risk:** Any user who decompiles the app binary can extract API keys. This allows:
  - Unauthorized API usage billed to the operator
  - Bypassing content safety filters by making direct API calls
  - Potential abuse of the OpenAI organization's account
- **Recommendation:** Move ALL AI API calls to server-side Convex functions (`convex/` backend). Convex functions run server-side and can securely hold API keys as environment variables. The client app should call Convex mutations/actions which then call AI APIs. This is the industry standard for mobile apps.
- **Note:** No Replicate or OpenAI API calls were found in Convex backend functions (grep confirmed no matches in `convex/`), confirming all AI calls are client-side.

### 7.2 API Key Configuration

| Key                      | Storage Method                        | Risk                            |
| ------------------------ | ------------------------------------- | ------------------------------- |
| `OPENAI_API_KEY`         | `.env` + hardcoded dev fallback       | CRITICAL (hardcoded in source)  |
| `OPENAI_ORG_ID`          | `.env` only                           | Low                             |
| `REPLICATE_API_TOKEN`    | `.env` + `getImageGenerationConfig()` | High (client-side)              |
| `BACKUP_IMAGE_API_TOKEN` | `.env` + `getImageGenerationConfig()` | High (client-side)              |
| Claude Skills API Key    | `react-native-keychain` (secure)      | Low (mock, no actual API calls) |

---

## 10. Recommendations Summary

### CRITICAL (Immediate Action Required)

1. **Rotate and remove hardcoded OpenAI API key** from `src/config/environment.ts:76`. Add the file pattern to `.gitignore` or use a secrets management solution.

2. **Move AI API calls to server-side Convex functions.** Create Convex actions for:
   - Story generation (OpenAI chat completions)
   - Image prompt analysis (OpenAI chat completions)
   - Embedding generation (OpenAI embeddings)
   - Image generation (Replicate predictions)
   - Content moderation (OpenAI moderations)

### HIGH (Address Before Production)

3. **Enable on-device speech recognition** — set `requiresOnDeviceRecognition = true` on iOS SFSpeechRecognizer to prevent children's voice audio from being sent to Apple's cloud. Investigate Android offline speech models. Update consent flow to explicitly cover voice data if cloud recognition is retained.

4. **Add PII scrubbing to embedding generation service** — call `piiScrubber.scrubText()` before `callEmbeddingAPI()` in `embeddingGenerationService.ts`.

5. **Fix missing Organization header in embedding service** — use `getOpenAIHeaders()` from environment config instead of manually constructed headers in `embeddingGenerationService.ts:207-208`.

6. **Verify PII scrubbing in image prompt analysis flow** — ensure story content is scrubbed before the OpenAI `analyzeStoryForImageGeneration()` call, not just before the Replicate call.

7. **Augment regex PII scrubber with contextual detection** — the current regex approach misses contextual PII common in children's writing (teacher names, friend names, classroom details). Consider adding an LLM-based PII detection pass or NER-based detection as a second layer.

### MEDIUM (Address in Next Sprint)

6. **Pursue OpenAI Zero Data Retention (ZDR)** agreement, citing COPPA requirements.

7. **Strip console logging in production builds** — ensure story content previews and embedding text are not logged in release builds.

8. **Confirm Replicate data retention period** via DPA negotiation.

### LOW (Track)

9. **Ensure embedding vectors have proper access controls** — verify Convex auth covers all `storyElements` queries.

10. **Create integration gate for Claude Skills production** — when moving from PoC to real SDK, apply all PII/data safety measures.

---

## Data Flow Diagram: AI Services

```
User Text Input
    |
    v
[PII Scrubber] ──── scrubs: emails, phones, SSNs, names, ages, addresses, schools
    |                NOTE: Regex-only — misses contextual PII (teacher names,
    |                friend names, classroom details, hometowns in narrative)
    v
[Prompt Sanitizer] ── neutralizes prompt injection
    |
    v
[Content Safety] ──── checks blocklist + OpenAI Moderation API
    |
    +──> OpenAI /chat/completions (story generation) ──> story text returned
    |      Headers: Authorization + OpenAI-Organization
    |      PII scrubbed: YES (structured only)
    |
    +──> OpenAI /chat/completions (image analysis) ──> image prompt returned
    |      Headers: Authorization + OpenAI-Organization
    |      PII scrubbed: UNCLEAR — scrub may happen after this call
    |
    +──> OpenAI /embeddings (diversity tracking)
    |      Headers: Authorization ONLY (missing Org header!)
    |      PII scrubbed: NO
    |
    +──> Replicate /predictions (image generation)
    |      Headers: Authorization
    |      PII scrubbed: YES at imageGeneration.ts:8558
    |
    v
[On-device TTS] ──── react-native-tts (no network calls)

[Claude Skills] ──── MOCK only (no network calls)


User Voice Input (SEPARATE PATH — NO PII SCRUBBING POSSIBLE)
    |
    v
[Microphone] ──> raw audio stream
    |
    +──> Apple SFSpeechRecognizer (iOS) ──> CLOUD processing
    |      Children's voice audio sent to Apple servers
    |      No DPA, no COPPA-specific agreement
    |
    +──> Google SpeechRecognizer (Android via @react-native-voice/voice) ──> CLOUD processing
    |      Children's voice audio sent to Google servers
    |      No DPA, no COPPA-specific agreement
    |
    v
[Transcribed text] ──> enters text pipeline above
    NOTE: Audio already transmitted BEFORE any PII scrubbing
```

---

**Audit completed:** 2026-03-25
**Next review due:** 2026-06-25 (quarterly)
