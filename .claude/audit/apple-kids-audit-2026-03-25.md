# Apple Kids Category Compliance Audit - CreativeBridge

**Audit Date:** 2026-03-25
**Previous Audit:** 2026-03-23
**Scope:** Apple Kids Category requirements (App Store Review Guidelines 1.3, Kids Category)
**Overall Grade: FAIL (revised after cross-audit findings)**

---

## Changes Since Last Audit (2026-03-23)

Several CRITICAL issues from the prior audit have been remediated:

| Prior Finding                                      | Status    | Details                                                                                           |
| -------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------- |
| `getUniqueId()`/`getDeviceId()` in production code | **FIXED** | Calls removed from `auditLogger.ts`, `claudeSkillsConfig.ts`, `claudeSkillsCredentialRotation.ts` |
| `StoryImageDisplay.tsx` ungated external link      | **FIXED** | Now uses `useParentalGate()` hook (line 1199)                                                     |
| Analytics deviceInfo collection                    | **FIXED** | `analyticsService.ts` strips deviceInfo (US-013, line 191) and hashes userId                      |
| Blocked word list only 5 terms                     | **FIXED** | Expanded to 200+ terms in `contentBlocklist.ts` (US-014)                                          |
| No OpenAI Moderation API call                      | **FIXED** | `contentSafetyService.ts` now calls `omni-moderation-latest` on user input                        |

---

## 1. Third-Party SDK Inventory

### 1.1 Production Dependencies

| SDK                         | Purpose                      | Data Sent to Third Party              | Kids Category Status                 |
| --------------------------- | ---------------------------- | ------------------------------------- | ------------------------------------ |
| `@clerk/clerk-expo`         | OAuth (Google/Apple)         | OAuth tokens, user identifiers        | **HIGH** - Needs COPPA DPA           |
| `openai` (via fetch)        | Story generation (GPT-4)     | PII-scrubbed story text               | **MEDIUM** - PII scrubber mitigates  |
| `replicate` (via fetch)     | Image generation (SD 3.5)    | Art prompts only (no PII)             | **PASS**                             |
| `@supabase/supabase-js`     | Fallback DB for legacy users | Hashed userId, session data           | **MEDIUM** - Analytics anonymized    |
| `convex`                    | Primary backend              | User profiles, stories, consent       | **PASS** - First-party backend       |
| `react-native-device-info`  | Performance optimization     | **No data transmitted externally**    | **PASS** - Used locally only         |
| `react-native-share`        | Story file export            | Story content to OS share sheet       | **PASS** - User-initiated            |
| `react-native-tts`          | Text-to-speech               | Text to on-device TTS engine          | **PASS** - On-device                 |
| `@react-native-voice/voice` | Voice input                  | Audio to on-device speech recognition | **PASS** - On-device                 |
| `reactotron-react-native`   | Debug tool (devDependency)   | N/A                                   | **PASS** - Dev only, `__DEV__` gated |

### 1.2 Prohibited SDK Check

| SDK Category                                                 | Found? | Details                                 |
| ------------------------------------------------------------ | ------ | --------------------------------------- |
| Advertising (AdMob, Facebook Ads)                            | **NO** | Not in `package.json` or `Podfile.lock` |
| Analytics (Firebase Analytics, Amplitude, Mixpanel, Segment) | **NO** | Not in dependencies                     |
| Attribution (Adjust, AppsFlyer, Branch)                      | **NO** | Not in dependencies                     |
| Social SDKs (Facebook SDK)                                   | **NO** | Not in dependencies                     |
| IDFA / ATTrackingManager                                     | **NO** | Not in Podfile or native code           |

**Verdict: PASS** - No prohibited tracking/advertising SDKs present.

### 1.3 Client-Side API Key Architecture (Cross-Audit Finding)

**CRITICAL:** All OpenAI and Replicate API calls are made **directly from the client device**, not via a server-side proxy. This means:

- A child's device establishes direct HTTPS connections to `api.openai.com` and `api.replicate.com`
- API keys are bundled into the app binary (loaded from `@env` / `.env` at build time)
- `src/config/environment.ts:73-77` contains a **hardcoded OpenAI API key** as a `__DEV__` fallback:
  ```
  OPENAI_API_KEY || (__DEV__ ? 'sk-proj-Hj1R...' : '')
  ```

**Kids Category impact:**

- Apple Kids Category prohibits transmitting data from a child's device to third parties without qualifying as a "service provider" under a strict DPA. Client-side API calls make it harder to argue the app controls the data pipeline — the child's device is the origin of the request.
- The hardcoded API key is `__DEV__`-gated and won't appear in production builds (`__DEV__` is `false` in release). However, Apple reviewers may flag it during code review of development builds submitted via TestFlight.
- **The real risk:** Without server-side proxying, there is no architectural control point to enforce rate limits, audit data in transit, or guarantee PII scrubbing ran successfully before data leaves the device. If the PII scrubber has a bug or is bypassed, raw child data goes directly to OpenAI.

**Severity: CRITICAL** for Kids Category. **HIGH** for general App Store with COPPA.

**Recommendation:** Implement server-side proxy (via Convex actions or a dedicated API gateway) for all AI service calls. This:

1. Removes API keys from client binaries entirely
2. Provides a server-side enforcement point for PII scrubbing
3. Creates an auditable log of all data sent to third parties
4. Satisfies Apple's expectation that the developer controls third-party data flow

---

## 2. Parental Gates Assessment

### 2.1 Parental Gate Implementation

The app has a well-implemented parental gate at `src/components/common/ParentalGate.tsx`:

- Math problem requiring 2-digit addition (10-39 + 10-39)
- Resets after each use (no persistent "parent mode")
- Gate resets on incorrect answer with new problem

### 2.2 External Link-Out Audit

| Location                        | URL/Action               | Gated?                        | Severity   |
| ------------------------------- | ------------------------ | ----------------------------- | ---------- |
| `SettingsScreen.tsx:319`        | Privacy Policy URL       | **YES** - `useParentalGate()` | PASS       |
| `SettingsScreen.tsx:325`        | Terms of Service URL     | **YES** - `useParentalGate()` | PASS       |
| `AuthScreen.tsx:1714-1728`      | Privacy/Terms/EULA URLs  | **YES** - `useParentalGate()` | PASS       |
| `StoryImageDisplay.tsx:1199`    | Image URL in browser     | **YES** - `useParentalGate()` | PASS       |
| `OAuthSessionHelpModal.tsx:167` | `accounts.google.com`    | **YES** - `useParentalGate()` | PASS       |
| `OAuthSessionHelpModal.tsx:165` | `Linking.openSettings()` | **NO**                        | **LOW**    |
| `VoiceInput.tsx:251,1582`       | `Linking.openSettings()` | **NO**                        | **LOW**    |
| `ConsentPendingScreen.tsx:104`  | Consent URL in browser   | **NO**                        | **MEDIUM** |

### 2.3 Findings

- **MEDIUM: `ConsentPendingScreen.tsx:104`** - `Linking.openURL(consentUrl)` opens consent URL in external browser without a parental gate. However, this screen is only shown to under-13 users who need parental consent, so the intent IS to leave the app. A parental gate would make the consent flow paradoxical (child can't get parent consent if parent must solve gate to share the link). **Risk is low but Apple may flag it.**

- **LOW: `Linking.openSettings()` (3 locations)** - Opens iOS Settings app. Apple generally does not consider this a "link-out" since it stays on-device within Apple's own settings, but technically it does leave the app. Consider wrapping with parental gate for maximum compliance.

### 2.4 Commerce/IAP

No in-app purchases, subscriptions, or commerce code found. Uses XP system for gamification (internal virtual currency, not purchasable). **PASS.**

---

## 3. Age Band Mapping Analysis

### 3.1 App Grade Levels vs. Apple Age Bands

| App Grade Level | Target Ages | Apple Kids Band   | Compatible?                               |
| --------------- | ----------- | ----------------- | ----------------------------------------- |
| K-2             | 5-8         | 5 and Under + 6-8 | **YES** (overlaps two bands)              |
| 3-5             | 8-11        | 6-8 + 9-11        | **YES** (overlaps two bands)              |
| 6-8             | 11-14       | 9-11 (partial)    | **PARTIAL** - Ages 12-14 outside Kids     |
| 9-12            | 14-18       | **NONE**          | **FAIL** - Entirely outside Kids Category |

### 3.2 Age Band Declaration

**CRITICAL: No age band declared in `app.json` or app configuration.** The `app.json` file contains no Kids Category or age rating configuration. Apple requires explicit age band selection (5 and Under, 6-8, or 9-11) when submitting to Kids Category.

### 3.3 Content Appropriateness

The grade level system adapts content (vocabulary, art style, themes), but grade 9-12 includes sophisticated themes that are incompatible with Kids Category:

- Art style progression: watercolor (K-2) -> digital illustration (3-5) -> realistic (6-8) -> sophisticated (9-12)
- Genre system includes themes inappropriate for Kids Category at higher levels

### 3.4 Recommendation

**Option A (Kids Category):** Limit the app to grades K-2, 3-5 only (ages 5-11). Declare age band "6-8" or "9-11" depending on primary target. Remove or hide grades 6-8 and 9-12 entirely for the Kids Category build.

**Option B (General App Store + COPPA):** Submit to general App Store with all grade levels. Maintain COPPA compliance for under-13 users via existing age-gating and consent flow. This preserves the full feature set.

**Severity: CRITICAL** - Must choose one path before submission.

---

## 4. Ads and Tracking Assessment

| Check                          | Result                                                                                                     |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Advertising SDKs               | **NONE FOUND** - PASS                                                                                      |
| IDFA collection                | **NONE** - PASS                                                                                            |
| ATTrackingManager              | **NOT USED** - PASS                                                                                        |
| Behavioral tracking (external) | **NONE** - PASS                                                                                            |
| Behavioral tracking (local)    | `behaviorAnalytics.ts` - local only, anonymized, no external transmission - PASS                           |
| Analytics to external service  | `analyticsService.ts` sends to Supabase but userId is hashed (US-013) and deviceInfo stripped - **MEDIUM** |
| Device info collection         | `react-native-device-info` used for local performance optimization only - PASS                             |

**Verdict: PASS with caveat.** No prohibited tracking. The Supabase analytics sends anonymized data but Apple may question any data transmission to third-party services in Kids Category. Document in privacy nutrition label.

---

## 5. Story Downloads and Metadata

- **Story exports:** Plain `.txt` files containing only title and story text (`storyDownloadService.ts:20-52`). No metadata, no PII, no timestamps. **PASS.**
- **Image exports:** Images are AI-generated by Replicate and stored via Convex. No EXIF data embedded by the app (images are URLs from Replicate, not camera photos). **PASS.**
- **Share functionality:** Uses OS share sheet (`react-native-share`), which is user-initiated and Apple-approved. **PASS.**

---

## 6. UGC Moderation Assessment

### 6.1 Content Safety Pipeline

The app now has a multi-layer content safety approach:

1. **Blocklist filter** (`contentBlocklist.ts`): 200+ blocked terms across categories (violence, sexual, drugs, discrimination, self-harm, profanity, personal info)
2. **OpenAI Moderation API** (`contentSafetyService.ts`): Pre-checks user input with `omni-moderation-latest` endpoint (1.5s timeout budget)
3. **PII Scrubber** (`piiScrubber.ts`): Redacts emails, phones, SSNs, addresses, names, ages, school names before AI calls
4. **System prompt guardrails**: GPT-4 instructed to produce age-appropriate content
5. **Image moderation** (`imageModeration.ts`): Post-generation image safety check
6. **Grade-based content adaptation**: Horror auto-softened for younger grades

### 6.2 Gaps

- **No user-to-user sharing:** The challenge system (`challengeService.ts`) is purely local gamification (XP rewards for writing challenges). No social features, no multiplayer, no user-to-user content sharing. **This eliminates the Apple UGC moderation requirement.**
- **AI-generated content moderation:** The multi-layer approach is solid. The main remaining gap is that output moderation uses blocklist-only (no Moderation API on output) to avoid "double-charging." This is acceptable since the system prompt constrains output.

**Verdict: PASS.** No UGC sharing = no Apple UGC moderation requirement. Content safety pipeline is well-implemented for AI-generated content.

---

## 7. Account Creation Assessment

- **Mandatory authentication:** App requires Clerk OAuth (Google/Apple Sign-In) for all functionality (`App.tsx` blocks unauthenticated users).
- **Sign in with Apple:** Supported via `@clerk/clerk-expo` and `expo-auth-session`.
- **Age gating:** `AgeGatingScreen.tsx` collects age group (under_13, 13-17, 18+) before full access.
- **Data minimization for under-13:** Real name auto-population blocked for under-13 users (commit `4e70e51`).
- **No guest mode:** All users must authenticate.

### 7.1 Findings

- **MEDIUM:** Apple Kids Category apps should minimize data collection during account creation. The Clerk OAuth flow collects email and name from the OAuth provider. For under-13 users, real name auto-population is blocked, but email is still collected.
- **INFO:** Apple recommends supporting Sign in with Apple for any app with third-party login. This is implemented.

---

## 8. Summary of Findings

### CRITICAL

| #   | Finding                                                                          | Location                                                  | Recommendation                                                              |
| --- | -------------------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------- |
| C-1 | Grade 9-12 content (ages 14-18) incompatible with Kids Category                  | App-wide                                                  | Remove 9-12 level for Kids submission, OR submit to general App Store       |
| C-2 | No age band declared in app configuration                                        | `app.json`                                                | Add Kids Category age band declaration in App Store Connect                 |
| C-3 | Client-side AI API calls: child's device sends data directly to OpenAI/Replicate | `openaiClient.ts`, `imageGeneration.ts`, `environment.ts` | Implement server-side proxy via Convex actions; remove API keys from client |
| C-4 | Hardcoded OpenAI API key in source (`__DEV__` gated)                             | `src/config/environment.ts:76`                            | Remove hardcoded key; use `.env`-only loading even in dev                   |

### HIGH

| #   | Finding                                                                                      | Location                                       | Recommendation                                                            |
| --- | -------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------- |
| H-1 | Clerk OAuth processes user data through third-party cloud service                            | `@clerk/clerk-expo`                            | Obtain Clerk COPPA/Kids Category DPA documentation                        |
| H-2 | OpenAI receives user-generated story text (PII-scrubbed) via direct client connection        | `openaiClient.ts`, `storyGenerationService.ts` | Move to server-side proxy; document OpenAI as "service provider" with DPA |
| H-3 | No server-side enforcement of PII scrubbing — client-only scrubber could be bypassed or fail | `piiScrubber.ts`                               | Add server-side PII scrubbing as defense-in-depth at the proxy layer      |

### MEDIUM

| #   | Finding                                                                 | Location                    | Recommendation                                                                    |
| --- | ----------------------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------- |
| M-1 | `ConsentPendingScreen.tsx:104` opens external URL without parental gate | `ConsentPendingScreen.tsx`  | Consider adding gate, though consent flow context makes this low-risk             |
| M-2 | Analytics data (hashed userId, session metrics) sent to Supabase        | `analyticsService.ts`       | Document in privacy nutrition label; consider local-only analytics for Kids build |
| M-3 | Mandatory authentication may face Kids Category scrutiny                | `App.tsx`, `AuthScreen.tsx` | Consider limited guest mode for Kids Category build                               |

### LOW

| #   | Finding                                          | Location                                                   | Recommendation                                 |
| --- | ------------------------------------------------ | ---------------------------------------------------------- | ---------------------------------------------- |
| L-1 | `Linking.openSettings()` not gated (3 locations) | `OAuthSessionHelpModal.tsx:165`, `VoiceInput.tsx:251,1582` | Wrap with parental gate for maximum compliance |

### INFO

| #   | Finding                                             | Location                  | Status               |
| --- | --------------------------------------------------- | ------------------------- | -------------------- |
| I-1 | Reactotron debug tool is dev-only (`__DEV__` gated) | `reactotron.ts`           | No production impact |
| I-2 | Story downloads are clean text, no metadata         | `storyDownloadService.ts` | Compliant            |
| I-3 | No push notifications                               | N/A                       | Compliant            |
| I-4 | Sign in with Apple supported                        | `AppleSignInButton.tsx`   | Compliant            |
| I-5 | PII scrubber active before all AI API calls         | `piiScrubber.ts`          | Compliant            |
| I-6 | Content blocklist expanded to 200+ terms            | `contentBlocklist.ts`     | Compliant            |
| I-7 | OpenAI Moderation API pre-check on user input       | `contentSafetyService.ts` | Compliant            |

---

## 9. Remediation Progress vs. Prior Audit

| Prior CRITICAL Finding                     | Current Status                                 |
| ------------------------------------------ | ---------------------------------------------- |
| Device identifier collection in production | **RESOLVED** - All calls removed               |
| Missing parental gates (2 link-outs)       | **RESOLVED** - Both now gated                  |
| Grade 9-12 incompatible with Kids Category | **UNRESOLVED** - Architectural decision needed |

| Prior HIGH Finding                               | Current Status                                    |
| ------------------------------------------------ | ------------------------------------------------- |
| User input sent to OpenAI without pre-moderation | **RESOLVED** - Moderation API added               |
| Analytics deviceInfo to Supabase                 | **RESOLVED** - deviceInfo stripped, userId hashed |
| Clerk compliance unverified                      | **UNRESOLVED** - DPA documentation needed         |
| No age band declaration                          | **UNRESOLVED** - Configuration needed             |

---

## 10. Recommended Path Forward

### If targeting Kids Category:

1. **Remove or feature-flag grades 6-8 and 9-12** for the Kids Category build
2. **Declare age band** (recommend "6-8") in App Store Connect
3. **Obtain DPAs** from Clerk and OpenAI confirming Kids Category / COPPA compliance
4. **Add parental gate** to `ConsentPendingScreen.tsx:104` and `Linking.openSettings()` calls
5. **Switch analytics to local-only** (AsyncStorage) for the Kids build
6. **Consider guest mode** to reduce data collection friction

### If targeting General App Store (recommended, but requires work):

1. **Move AI API calls to server-side proxy** (Convex actions) — removes API keys from client, enables server-side PII enforcement
2. **Remove hardcoded OpenAI key** from `src/config/environment.ts:76`
3. **Strengthen VPC flow** — fix `Math.random()` token generation, add "Plus" confirmation step
4. **Complete privacy nutrition label** accurately listing all third-party data sharing
5. **Ensure Apple privacy policy** documents all third-party services (Clerk, OpenAI, Replicate, Supabase)
6. **Keep all grade levels** and the full feature set

---

## 11. Overall Assessment

**Grade: FAIL (revised from CONDITIONAL PASS after cross-audit integration)**

The original assessment of CONDITIONAL PASS was based on the remediation of 5 prior findings. However, cross-audit findings from the AI Data Safety auditor reveal a deeper architectural issue: **all AI API calls are made directly from the child's device** with API keys bundled in the client binary. This is a fundamental Kids Category incompatibility that the PII scrubber and content safety measures cannot fully mitigate because they run client-side with no server-side enforcement.

Additionally, the consent auditor found the "Email Plus" VPC method has implementation gaps (VPC-01: `Math.random()` token generation, VPC-02: missing the "Plus" verification step). This weakens the COPPA compliance that the general App Store path depends on.

### Revised Recommendation

**For Kids Category:** FAIL — not submittable. The client-side AI architecture, grade 9-12 content, and missing age band declaration each independently block submission. Server-side proxying of all AI calls is a prerequisite.

**For General App Store with COPPA (still recommended, but with caveats):**

1. **Move AI API calls server-side** (Convex actions) — this is the single highest-impact change. It fixes the API key exposure, enables server-side PII scrubbing enforcement, and satisfies the "service provider" architecture Apple and the FTC expect.
2. **Remove the hardcoded OpenAI key** from `environment.ts:76` — even `__DEV__`-gated, it's a leaked credential in source control.
3. **Strengthen VPC implementation** — fix `Math.random()` token generation and add the "Plus" confirmation step to satisfy FTC Email Plus requirements.
4. **Complete privacy nutrition label** and document all third-party services.

The app's content safety infrastructure (PII scrubber, blocklist, Moderation API, parental gates) is strong. The primary gap is architectural: the data flow from child's device to third-party AI services lacks a server-side control point.

---

**Key files audited:**

- `package.json` (dependency inventory)
- `app.json` (age band configuration)
- `ios/Podfile.lock` (native SDK audit)
- `src/components/common/ParentalGate.tsx` (parental gate implementation)
- `src/components/common/OAuthSessionHelpModal.tsx` (external link-outs)
- `src/components/common/StoryImageDisplay.tsx` (external link-outs)
- `src/screens/ConsentPendingScreen.tsx` (external link-outs)
- `src/screens/AgeGatingScreen.tsx` (age band selection)
- `src/services/analyticsService.ts` (data transmission)
- `src/services/behaviorAnalytics.ts` (local behavior tracking)
- `src/services/piiScrubber.ts` (PII protection)
- `src/services/contentSafetyService.ts` (content moderation)
- `src/config/contentBlocklist.ts` (blocked terms)
- `src/services/imageGeneration.ts` (Replicate API data)
- `src/services/openaiClient.ts` (OpenAI API data)
- `src/services/deviceInfo.ts` (device info usage)
- `src/services/storyDownloadService.ts` (export metadata)
- `src/services/challengeService.ts` (UGC assessment)
- `src/services/reactotron.ts` (dev tool audit)
- `src/config/environment.ts` (API key architecture, hardcoded key)
- `src/services/environment.ts` (image generation config, Replicate key loading)
