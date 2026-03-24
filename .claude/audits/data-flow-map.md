# CreativeBridge COPPA Data Flow Audit

**Audit Date:** 2026-03-23
**Codebase:** CreativeBridge (React Native / Expo)
**Target Audience:** Children (grades K-12)
**Grade: FAIL**

---

## 1. Summary Data Flow Table

| Data Point                            | Source                         | Storage                                                                       | Third-Party Recipients                                                             | Retention  | Consent Required    |
| ------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------- | ------------------- |
| Clerk User ID (`user_xxxxx`)          | Clerk OAuth (Google/Apple)     | Convex `userProfiles.clerkUserId`, all tables                                 | Convex, Clerk                                                                      | Indefinite | Yes (at sign-up)    |
| Email address                         | Clerk OAuth / email sign-up    | Clerk (cloud), Convex `migrationEvents.email`, AsyncStorage (pending profile) | Clerk, Convex                                                                      | Indefinite | Yes (at sign-up)    |
| Username                              | User input at profile creation | Convex `userProfiles.username`                                                | Convex                                                                             | Indefinite | Yes (at sign-up)    |
| Display Name                          | User input                     | Convex `userProfiles.displayName`                                             | Convex                                                                             | Indefinite | Yes (at sign-up)    |
| Avatar URL                            | OAuth provider profile photo   | Convex `userProfiles.avatarUrl`                                               | Convex                                                                             | Indefinite | Unclear             |
| Bio text                              | User input                     | Convex `userProfiles.bio`                                                     | Convex                                                                             | Indefinite | No explicit consent |
| Grade Level preference                | User selection                 | Convex `userProfiles.preferredGradeLevel`                                     | Convex, OpenAI (in prompts), Replicate (in prompts)                                | Indefinite | No explicit consent |
| Story content (child-authored)        | User input                     | Convex `gameSessions.storyContent`                                            | Convex, **OpenAI** (for continuation + image analysis), Replicate (derived prompt) | Indefinite | No explicit consent |
| Image generation prompts              | Derived from story             | Convex `imageGenerationEvents.promptUsed`                                     | Replicate, OpenAI                                                                  | Indefinite | No explicit consent |
| Generated image URLs                  | Replicate response             | Convex `gameSessions.generatedImageUrl`, Convex Storage                       | Convex, Replicate                                                                  | Indefinite | No                  |
| Voice/speech audio                    | Microphone                     | **On-device only** (iOS SFSpeechRecognizer)                                   | None (possibly Apple servers)                                                      | Transient  | No                  |
| Device ID                             | Generated + DeviceInfo         | AsyncStorage, Supabase                                                        | Supabase                                                                           | Indefinite | No explicit consent |
| Analytics events                      | App-generated                  | AsyncStorage queue, Supabase `analytics_events`                               | Supabase                                                                           | Indefinite | No explicit consent |
| Onboarding milestones                 | App-generated                  | Convex `userProfiles`                                                         | Convex                                                                             | Indefinite | No                  |
| Migration metadata (incl. email)      | Migration flow                 | Convex `migrationEvents`                                                      | Convex                                                                             | Indefinite | No explicit consent |
| Game statistics (XP, streaks, scores) | App-generated                  | Convex `userProfiles`                                                         | Convex                                                                             | Indefinite | No                  |

---

## 2. Detailed Service Analysis

### 2.1 Clerk (Authentication)

**Key files:** `src/hooks/useSafeClerkAuth.ts`, `src/context/AuthContext.tsx`, `convex/auth.config.ts`, `convex/auth.ts`

- Clerk collects: email, OAuth profile data (name, photo from Google/Apple), JWT tokens, IP address (Clerk's own logging)
- Clerk User ID stored in every Convex table as `clerkUserId`
- `convex/auth.ts:createSignInToken` calls `https://api.clerk.com/v1/users?email_address=...` -- transmits email to Clerk's backend API
- No parental consent gate before OAuth sign-up

### 2.2 Convex (Primary Database)

**Key files:** `convex/schema.ts`, `convex/userProfiles.ts`, `convex/gameSessions.ts`

**7 tables** defined in schema. Sensitive data includes: username, displayName, avatarUrl, bio, storyContent, importedStoryContent, promptUsed, email (in migrationEvents).

**Deletion capabilities:**

- `deleteSession` -- per-session deletion (auth-gated)
- `deleteImage` -- image deletion from storage
- **NO user account deletion function exists** -- no `deleteUserProfile`, no `deleteAllUserData`
- All data retained indefinitely with no TTL

### 2.3 OpenAI (GPT-4o-mini)

**Key files:** `src/services/storyGenerationService.ts`, `src/services/openaiClient.ts`

**Data sent to OpenAI:**

1. Story continuation: grade level + up to 8000 chars of child-authored story text + user creative input + genre
2. Image prompt analysis: full story text sent via `analyzeStoryForImageGeneration(storyText)`

**Not sent:** user ID, email, username, device info. However, children's story content may contain self-identifying information (names, schools, etc.) with no PII scrubbing applied.

### 2.4 Replicate (Stable Diffusion 3.5 / Nano Banana)

**Key file:** `src/services/imageGeneration.ts`

Receives image generation prompts derived from story content. Prompts contain character names, scene descriptions, and art style terms. Lower risk than OpenAI since content is transformed/extracted rather than sent raw.

### 2.5 ElevenLabs -- NOT ACTIVE

API key configured in `.env.example` but **zero API calls exist** in the codebase. TTS uses on-device `react-native-tts`. Dead configuration artifact.

### 2.6 Claude Skills SDK -- MOCKED

`claudeSkillsManager.ts` is explicitly a mock/proof-of-concept. No real API calls to Anthropic. No data transmitted.

### 2.7 Analytics

**Key file:** `src/services/analyticsService.ts`

Custom analytics service uploads events (with `userId`) to Supabase `analytics_events` table every 30 seconds. Tracks session starts, story imports, continuations, errors, performance metrics. No third-party analytics SDKs (Sentry, Firebase, Segment, etc.) are actively integrated.

### 2.8 Speech/Voice Recognition

**Key files:** `src/services/nativeSpeechRecognizer.ts`, `src/components/common/VoiceInput.tsx`

Uses iOS `SFSpeechRecognizer` (native) and `@react-native-voice/voice`. Processing is on-device. No audio transmitted by the app, though Apple's framework may send audio to Apple servers.

### 2.9 Device Identifiers

- `syncService.ts` generates a persistent random device ID stored in AsyncStorage and sent to Supabase
- `claudeSkillsCredentialRotation.ts` calls `DeviceInfo.getDeviceId()` (hardware identifier)
- No advertising ID / IDFA retrieval found

---

## 3. Critical Findings

### CRITICAL: No Parental Consent Gate

No age verification, no parental consent collection, no VPC mechanism. Children in grades K-2 (ages 5-8) can sign up directly via OAuth.

### CRITICAL: No Account/Data Deletion for Users

No user-facing account deletion. COPPA requires parents be able to request deletion of their child's data. Only individual session deletion exists.

### HIGH: Child-Authored Content Sent to AI Without PII Scrubbing

Up to 8000 chars of child-written stories sent to OpenAI. Children commonly embed personal information in creative writing. No PII detection or scrubbing before transmission.

### HIGH: Email in Plaintext in Migration Events

`migrationEvents` table stores email addresses indefinitely with no cleanup.

### MEDIUM: Analytics Tied to User IDs with No Anonymization

Behavioral profiles (session durations, engagement scores) tied to user IDs, uploaded to Supabase.

### MEDIUM: No Data Retention Policy

All data stored indefinitely in Convex -- profiles, stories, prompts, images, events.

### MEDIUM: Persistent Device ID Transmitted to Backend

Random (but persistent) device ID sent to Supabase via sync service.

### LOW: Sensitive Data Unencrypted in AsyncStorage

Email, profile data, and 2FA codes stored in plaintext AsyncStorage.

---

## 4. Compliance Grade: FAIL

The application fails COPPA compliance on these critical dimensions:

1. **No verifiable parental consent** -- fundamental COPPA requirement for apps directed at children under 13
2. **No data deletion capability for parents** -- COPPA requires operators to give parents ability to delete child data
3. **Child content transmitted to third-party AI services without PII safeguards**
4. **No data retention limits** -- indefinite storage of all personal data
5. **No documented DPAs** with Clerk, Convex, OpenAI, or Replicate

### Recommended Remediation (Priority Order)

| Priority | Action                                                                                |
| -------- | ------------------------------------------------------------------------------------- |
| P0       | Implement verifiable parental consent (VPC) before any child under 13 can use the app |
| P0       | Add user/parent-initiated account + data deletion across all tables and services      |
| P1       | Implement PII detection/scrubbing on story content before sending to OpenAI/Replicate |
| P1       | Establish and implement data retention policy with automated cleanup                  |
| P1       | Obtain COPPA-compliant DPAs with Clerk, Convex, OpenAI, Replicate                     |
| P2       | Anonymize/pseudonymize analytics data                                                 |
| P2       | Encrypt sensitive AsyncStorage data                                                   |
| P2       | Remove unused ElevenLabs configuration                                                |
| P3       | Disclose Apple speech recognition data practices in privacy policy                    |
| P3       | Require COPPA review before activating Claude Skills SDK                              |
