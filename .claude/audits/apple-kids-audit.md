# Apple Kids Category Compliance Audit - CreativeBridge

**Audit Date:** 2026-03-23
**Scope:** Apple Kids Category requirements, third-party data, parental gates, age bands, UGC moderation
**Overall Grade: FAIL**

---

## 1. Third-Party Data Transmission

**Critical SDKs identified:**

| SDK                          | Risk Level   | Issue                                                                                                                                                                                                                                                                                              |
| ---------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `react-native-device-info`   | **CRITICAL** | `getUniqueId()`, `getDeviceId()`, `getDeviceName()` actively called in `src/services/auditLogger.ts` (lines 154-159), `src/config/claudeSkillsConfig.ts` (line 207), `src/services/claudeSkillsCredentialRotation.ts` (lines 345, 469). Apple prohibits device identifier collection in Kids apps. |
| `@clerk/clerk-expo`          | HIGH         | Processes OAuth tokens, device metadata, and user identifiers through Clerk cloud.                                                                                                                                                                                                                 |
| `openai`                     | HIGH         | User-generated text sent to OpenAI servers for story generation.                                                                                                                                                                                                                                   |
| `replicate`                  | MEDIUM       | Story-derived prompts sent to Replicate API for image generation.                                                                                                                                                                                                                                  |
| Custom analytics to Supabase | HIGH         | `src/services/analyticsService.ts` collects userId, sessionId, deviceInfo, and batch-uploads to Supabase.                                                                                                                                                                                          |

## 2. Parental Gates

**FAIL** -- Two unguarded external link-outs found with no parental gate:

- `src/components/common/OAuthSessionHelpModal.tsx` line 165: opens `https://accounts.google.com`
- `src/components/common/StoryImageDisplay.tsx` line 1197: opens image URL in external browser

No commerce or in-app purchases found (good). No social sharing to external platforms.

## 3. Age Band Compliance

**FAIL** -- The app's grade 9-12 level targets ages 14-18, which is outside Apple Kids Category entirely (max age 11). Content includes dystopian themes, psychological horror, and thriller elements. No age band is declared in `app.json` or `eas.json`.

## 4. Ads & Tracking

**PASS with caveat** -- No prohibited ad/tracking SDKs (AdMob, Facebook, Firebase Analytics, etc.) found. However, the custom analytics service in `analyticsService.ts` collects device info and transmits to Supabase, which Apple may consider third-party data transmission.

## 5. Content Export & Metadata

**PASS** -- Story downloads are plain `.txt` files containing only title and story text. No PII or metadata embedded. No EXIF stripping code exists for images but the app doesn't embed PII in images either.

## 6. UGC Moderation

**NEEDS ATTENTION** -- Content safety measures exist but are insufficient:

- Blocked word list has only 5 words: `['kill', 'murder', 'blood', 'war', 'hate']`
- System prompts instruct OpenAI for age-appropriate content
- Horror genre auto-softened for younger grades
- **Gap**: User text input sent to OpenAI without pre-moderation
- **Gap**: No call to OpenAI Moderation endpoint before story generation
- Relies heavily on OpenAI's built-in moderation as secondary filter

## 7. Push Notifications

**PASS** -- No `expo-notifications` package, no push notification code, no push configuration.

## 8. Authentication Requirements

**NEEDS ATTENTION** -- App requires Clerk OAuth (Google/Apple) for all functionality. `App.tsx` line 225 blocks unauthenticated users. No guest mode exists. Apple may scrutinize mandatory login in Kids apps.

## 9. Critical Findings (Rejection Risks)

**CRITICAL (will cause rejection):**

1. Device identifier collection via `react-native-device-info` in production code paths
2. Missing parental gates before 2 external link-outs
3. Grade 9-12 content (ages 14-18) incompatible with Kids Category (max age 11)

**HIGH (may cause rejection):** 4. User input sent to OpenAI without pre-moderation 5. Analytics data transmitted to Supabase including deviceInfo 6. Clerk authentication data processing compliance unverified 7. No age band declaration in app configuration

## 10. Recommendations

**Must fix before submission:**

1. Remove all `getUniqueId()`/`getDeviceId()`/`getDeviceName()` calls from production code
2. Add parental gate component before all `Linking.openURL()` calls
3. Remove grade 9-12 content or submit outside Kids Category
4. Declare age band in App Store Connect

**Should fix:** 5. Add OpenAI Moderation endpoint call on user input before story generation 6. Expand blocked word list from 5 to 200+ terms 7. Obtain Clerk COPPA compliance documentation 8. Remove deviceInfo from analytics collection 9. Consider adding a limited guest mode

## 11. Grade: FAIL

Three critical issues guarantee Apple rejection for Kids Category. The most pragmatic path may be submitting to the general App Store with a COPPA-compliant privacy policy rather than Kids Category, given the 9-12 grade content.

---

**Key files referenced:**

- `package.json`
- `app.json`
- `src/services/analyticsService.ts`
- `src/services/auditLogger.ts` (lines 154-159)
- `src/config/claudeSkillsConfig.ts` (lines 207, 327)
- `src/services/claudeSkillsCredentialRotation.ts` (lines 345, 469)
- `src/services/storyGenerationService.ts` (lines 38-43 content filter, line 1038 system prompt)
- `src/components/common/OAuthSessionHelpModal.tsx` (line 165)
- `src/components/common/StoryImageDisplay.tsx` (line 1197)
- `App.tsx` (lines 39-41 Reactotron, line 225 auth gate)
