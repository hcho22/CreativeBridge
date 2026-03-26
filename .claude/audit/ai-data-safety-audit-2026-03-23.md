# AI Data Safety Audit - CreativeBridge

**Audit Date:** 2026-03-23
**Grade: FAIL**

---

## 1. OpenAI Data Handling

**Model:** `gpt-4o-mini` (configurable via env var), accessed via direct fetch to `https://api.openai.com/v1/chat/completions` in `src/services/openaiClient.ts`.

**Training Opt-Out:** NO explicit opt-out headers or configuration. The client sends only `Content-Type` and `Authorization` headers (openaiClient.ts lines 74-75). No `organization` header. Relies entirely on OpenAI's default API policy (data not used for training since March 2023), which could change.

**Child Data in Prompts:**

- Full story content up to 8,000 characters sent with each continuation (`storyGenerationService.ts` lines 1126-1133)
- Child's creative input sent verbatim (line 1155: `"${request.userInput}"`)
- Grade level in system and user prompts
- Theme/character/setting preferences
- No child names or user IDs are sent in prompts (the code uses `'anonymous-user'` placeholder)

**Prompt Injection:** NONE. User input is interpolated directly into prompts without sanitization. No anti-injection instructions in system prompts.

**Conversation History:** Partial -- `storySoFar` accumulates the full child-AI co-created narrative and up to 8K chars are sent each turn. Not multi-turn assistant history but functionally similar.

---

## 2. Replicate (Stable Diffusion) Data Handling

**Model:** `stability-ai/stable-diffusion-3.5-large` via `https://api.replicate.com/v1` (`imageGeneration.ts` lines 46-50).

**Data Sent:** Constructed prompts from story analysis (NOT raw story text). Prompts include extracted visual elements -- characters, settings, mood, art style. Character names from stories may appear in prompts. If a child names a character after themselves, that name goes to Replicate.

**Content Safety:** Prompt sanitization strips explicit/nsfw/violent/graphic terms (line 1106). Negative prompt focuses on image quality, NOT content safety for children (line 1351-1352). **No post-generation image moderation exists** -- images are served directly to children without moderation.

---

## 3. Claude Skills SDK

**MOCK IMPLEMENTATION ONLY** (`claudeSkillsManager.ts` line 21: "Mock implementation for proof-of-concept"). Returns hardcoded data after artificial delays. No data transmitted to any external API. No risk currently.

---

## 4. ElevenLabs TTS

**NOT ACTIVELY USED.** `ELEVENLABS_API_KEY` is configured in environment but all three TTS services (`textToSpeech.ts`, `textToSpeechSafe.ts`, `textToSpeechIsolated.ts`) use the native `react-native-tts` module for on-device synthesis. No HTTP calls to ElevenLabs. No child voice data is collected. No voice cloning functionality.

---

## 5. Vector Embeddings

**Model:** OpenAI `text-embedding-3-small` (1536 dimensions) in `src/services/embeddingGenerationService.ts`.

Story element text (character names, settings, plot patterns) is sent to OpenAI's embedding API. Embeddings cached in-memory only (Map, 1000 entry limit). No embeddings persisted to disk or sent to third parties beyond the initial API call. Cosine similarity computed on-device (`cosineSimilarityService.ts`).

**Reverse-engineering risk:** LOW-MEDIUM. Short phrases have limited PII, but child names appearing as character names could theoretically be matched.

---

## 6. Logging and Monitoring

**PII in Logs:**

- `oauthService.ts` line 190: `console.log('User email extracted:', userEmail)` -- **full email logged**
- `storyGenerationService.ts` lines 194-197, 225: story content previews logged
- `storyAgent.ts` lines 260-267: `userInputPreview` and `storySoFarPreview` logged
- `storySessionManager.ts` lines 143, 464: userId logged

**Error Handler:** Production sanitization exists (removes password/token/secret fields, truncates values, strips stack traces) in `errorHandler.ts` lines 815-858, but this only applies to the audit logging path, NOT to widespread `console.log` statements.

**Crash Reporting:** Placeholder only -- no Sentry/Bugsnag/Crashlytics integrated.

**Anomaly Detection:** `anomalyDetector.ts` collects userId, deviceId, ipAddress, device fingerprints, and behavioral profiles for child users.

---

## 7. Data Processing Agreements

| Service          | DPA Status         | COPPA Required? |
| ---------------- | ------------------ | --------------- |
| OpenAI           | **NOT DOCUMENTED** | YES             |
| Replicate        | **NOT DOCUMENTED** | YES             |
| Claude/Anthropic | N/A (mock)         | Future          |
| ElevenLabs       | **NOT DOCUMENTED** | Future          |
| Supabase         | **NOT DOCUMENTED** | YES             |
| Convex           | **NOT DOCUMENTED** | YES             |
| Clerk            | **NOT DOCUMENTED** | YES             |

---

## 8. Content Safety

**Story filtering:** Simple word blocklist (`kill`, `murder`, `blood`, `war`, `hate`). Does not catch euphemisms or contextual inappropriateness.

**Image filtering:** Text-level sanitization before prompt construction. NO post-generation image safety check. Stable Diffusion outputs served directly to children without moderation.

---

## 9. Critical Findings

### CRITICAL

**C-01: Hardcoded API Key in Source Code**
`src/config/environment.ts` line 78 contains a full OpenAI API key as a dev fallback:

```typescript
__DEV__ ? 'sk-proj-Hj1RZr...' : '';
```

This is committed to the repo and must be revoked immediately.

**C-02: No Data Processing Agreements** with any AI service provider. COPPA requires operators to ensure third-party providers maintain confidentiality of children's data.

**C-03: No Post-Generation Image Safety Moderation.** AI-generated images displayed to children without content verification.

### HIGH

**H-01:** No prompt injection protection -- child input interpolated directly into AI prompts.
**H-02:** User email logged in plaintext (`oauthService.ts` line 190).
**H-03:** Up to 8,000 chars of child-created story content sent to OpenAI per request with no parental disclosure.
**H-04:** Story elements sent to OpenAI embedding API adds another data transmission vector.

### MEDIUM

**M-01:** No explicit OpenAI training opt-out configuration.
**M-02:** Character names in image prompts may contain real child names.
**M-03:** Extensive console logging of story content in development.
**M-04:** Anomaly detection collects IP addresses and behavioral profiles of child users.

---

## 10. Recommendations

**Immediate:**

1. Revoke and rotate the hardcoded OpenAI API key. Remove from git history.
2. Execute DPAs with OpenAI, Replicate, Supabase, Convex, and Clerk.
3. Implement image content safety moderation before displaying AI-generated images.

**Short-term:** 4. Add prompt injection protection (input sanitization + anti-injection system prompt instructions). 5. Remove/redact PII from console logs (emails, story content, user IDs). 6. Add parental disclosure about AI data processing. 7. Configure explicit OpenAI organization header; consider Zero Data Retention agreement.

**Medium-term:** 8. Strip personal names from image prompts (replace with generic descriptors). 9. Add child-safety negative prompts to Stable Diffusion requests. 10. Consider local embedding models to avoid sending story elements to OpenAI. 11. Implement data minimization for anomaly detection (anonymize IP/behavioral data).

---

## 11. Grade: FAIL

The app has multiple critical privacy gaps: a hardcoded API key, no DPAs with any AI provider, child content flowing to external services without adequate disclosure, no image safety moderation, and no prompt injection protection. Good practices exist (production error sanitization, on-device TTS, grade-appropriate filtering, mock-only Claude integration) but critical gaps prevent a passing grade.
