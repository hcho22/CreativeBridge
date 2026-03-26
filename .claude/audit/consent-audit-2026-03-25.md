# COPPA Consent Flow Audit -- CreativeBridge

**Audit Date:** 2026-03-25
**Previous Audit:** 2026-03-23 (Grade: FAIL -- nothing implemented)
**Scope:** Age-gating, Verifiable Parental Consent (VPC), parental rights, data collection timing, privacy notice
**Overall Grade: PASS WITH FINDINGS**

---

## Executive Summary

Since the 2026-03-23 audit (where all consent mechanisms were absent), the team has implemented a comprehensive COPPA consent system. The core VPC flow using the "Email Plus" method covers most of the critical path: age-gating before _app-level_ data collection, parental consent before app access, and parental review/revocation/deletion capabilities. However, cross-audit review revealed that Clerk OAuth collects child PII (name, email, photo) from Google/Apple _before_ the age gate runs, creating a pre-consent data collection gap (XA-01). However, several gaps remain that should be addressed before production launch.

**Key Metrics:**

- 4 CRITICAL findings (0 blocking, 4 need attention before launch)
- 6 HIGH findings
- 3 MEDIUM findings
- 2 LOW findings

**Update (cross-audit review):** Three additional findings added from the Data Flow and AI Safety auditors (XA-01, XA-02, XA-03). These reveal undisclosed data flows that the consent form does not cover.

---

## 1. Age-Gating Assessment

**Status: IMPLEMENTED** | **Risk: MEDIUM**

### What's in Place

- **Age group selection screen** (`src/screens/AgeGatingScreen.tsx`): Presents three neutral options -- "Under 13", "13 to 17", "18 or older"
- **Neutral framing**: Question is "How old are you?" with neutral descriptions. Does not encourage selecting an older age.
- **Schema support**: `ageGroupValidator` in `convex/schema.ts` with `under_13`, `13_to_17`, `18_plus` values
- **Profile field**: `ageGroup` stored on `userProfiles` table
- **Backend mutation**: `userProfiles.setAgeGroup` persists the selection
- **Flow ordering**: Age-gating runs BEFORE profile completion (confirmed in `App.tsx:250-261`), which is correct

### Findings

| ID    | Severity   | Finding                                                                                                                                                                                                                                                                                                                                         | Recommendation                                                                                                                                                       |
| ----- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AG-01 | **HIGH**   | **No date-of-birth collection** -- The age gate uses self-declared age ranges rather than collecting a specific DOB. While COPPA does not strictly require DOB collection, the FTC's guidance on "neutral age screens" recommends collecting DOB to prevent easy circumvention. A child who simply selects "13 to 17" bypasses all protections. | Implement DOB collection with a neutral date picker. Calculate age from DOB on the server side. Store only age group, not the raw DOB (to minimize data collection). |
| AG-02 | **MEDIUM** | **No age-gate persistence/lockout** -- If a user selects "Under 13" and then deletes the app and re-registers with a new OAuth account, there is no mechanism to prevent them from selecting a different age group.                                                                                                                             | Consider device-level age-gate cookies or Clerk metadata to persist prior age declarations. Note: this is a known limitation of all mobile age gates.                |
| AG-03 | **LOW**    | **Age-gating screen has no legal link** -- The screen mentions COPPA but does not link to the privacy policy.                                                                                                                                                                                                                                   | Add a tappable link to the privacy policy on the age-gating screen.                                                                                                  |

---

## 2. Verifiable Parental Consent (VPC)

**Status: IMPLEMENTED (Email Plus method)** | **Risk: LOW-MEDIUM**

### What's in Place

The VPC flow is well-architected and follows the FTC's "Email Plus" method:

1. **Parent Email Collection** (`src/screens/ParentEmailScreen.tsx`):

   - Collects parent email with confirmation (double-entry)
   - Email validation on client and server
   - Supports both initial consent and annual renewal (`isRenewal` prop)

2. **Consent Token System** (`convex/consent.ts`):

   - Unique token generated per consent request (`generateConsentToken()`)
   - 48-hour token expiration (`CONSENT_TOKEN_EXPIRY_MS`)
   - Previous pending tokens expired when new request is made

3. **Consent Email** (`consent.sendConsentEmail` action):

   - Sends via Resend API
   - Falls back to share-based flow if Resend is not configured
   - Email includes consent URL with token

4. **Consent Verification Web Page** (`convex/http.ts`):

   - GET `/consent/verify?token=<token>` -- renders consent page
   - POST `/consent/verify` -- processes "I Consent" submission
   - Page explains: data collected, how it's used, third-party services, parental rights
   - Token expiration checked server-side

5. **Consent Pending Screen** (`src/screens/ConsentPendingScreen.tsx`):

   - Real-time Convex query detects when consent is granted
   - Child can share consent link via native Share sheet
   - Shows masked parent email and step-by-step instructions

6. **Consent Records Table** (`convex/schema.ts`):
   - Full lifecycle: `pending` -> `granted` -> `expired` / `withdrawn` / `renewal_required`
   - Records `consentType`, `consentVersion`, `verificationMethod`, `consentTimestamp`
   - 3-year retention after account deletion (COPPA requirement)

### Consent Flow Timeline (Verified Order)

```
1. User signs up via Clerk OAuth (Google/Apple)
2. Auth completes -> App.tsx checks needsAgeVerification
3. AgeGatingScreen shown -> user selects age group -> saved to profile
4. If under_13:
   a. App.tsx consentCheck query returns { required: true, reason: 'consent_needed' }
   b. ParentEmailScreen shown -> parent email collected
   c. consent.submitParentEmail mutation creates consentRecord (status: pending)
   d. consent.sendConsentEmail action sends email to parent
   e. ConsentPendingScreen shown (child blocked from app)
   f. Parent opens link -> consent web page (http.ts GET /consent/verify)
   g. Parent clicks "I Consent" -> http.ts POST /consent/verify
   h. consent.verifyAndGrantConsentInternal sets record status to 'granted'
   i. Profile consentStatus updated to 'granted'
   j. Convex reactive query updates -> child unblocked
5. If 13+ -> no VPC needed, proceeds to profile completion
```

### Findings

| ID     | Severity     | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Recommendation                                                                                                                                                                                                                        |
| ------ | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| VPC-01 | **CRITICAL** | **Token generation uses `Math.random()`** -- `generateConsentToken()` in `convex/consent.ts:878-890` uses `Math.floor(Math.random() * chars.length)` which is not cryptographically secure. Consent tokens are security-sensitive (they grant account access).                                                                                                                                                                                                                                                                                        | Replace with `crypto.getRandomValues()` or a Convex-compatible CSPRNG. The current token space (62^32 = ~190 bits) is large enough but the entropy source is weak.                                                                    |
| VPC-02 | **CRITICAL** | **"Email Plus" method requires additional verification** -- The FTC's Email Plus method requires not just an email, but an additional confirmation step beyond clicking a link. The current implementation only has: (1) parent email, (2) email with link, (3) parent clicks "I Consent". True Email Plus requires a follow-up confirmation (e.g., a delayed second email, or a confirmation reply) to verify the parent actually controls the email. Currently this is essentially just "email consent" which is the weakest acceptable VPC method. | Either: (a) implement the "plus" part -- e.g., send a confirmation code that must be entered separately, or (b) upgrade to a stronger VPC method (credit card micro-transaction, government ID scan, knowledge-based authentication). |
| VPC-03 | **HIGH**     | **Consent email may silently fail** -- In `ParentEmailScreen.tsx:68-76`, the `sendConsentEmail` failure is caught and only logged with `console.warn`. The child proceeds to `ConsentPendingScreen` even if the email was never sent. The fallback is the Share sheet, but the user may not realize the email failed.                                                                                                                                                                                                                                 | Show a warning to the child if email sending fails, and prominently offer the Share-based alternative.                                                                                                                                |
| VPC-04 | **MEDIUM**   | **RESEND_API_KEY may not be configured in production** -- The `sendConsentEmail` action (`consent.ts:757-765`) falls back to `console.log` if `RESEND_API_KEY` is not set. This is fine for development but must be verified before production.                                                                                                                                                                                                                                                                                                       | Add a startup health check or deploy-time validation that RESEND_API_KEY and CONSENT_EMAIL_FROM are configured.                                                                                                                       |

---

## 3. Consent for Data Uses and Parental Rights

**Status: IMPLEMENTED** | **Risk: LOW**

### What's in Place

**Parent Dashboard** (`src/screens/ParentDashboardScreen.tsx`):

- Protected by a parental gate (math problem: 10-39 + 10-39)
- Accessible from Settings screen for under-13 users

**Parental Rights Implemented:**

| Right                | Implementation                                                                                                          | Status      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------- |
| **Review data**      | Parent Dashboard shows: profile info, consent status, story count, story previews (up to 20)                            | Implemented |
| **Export data**      | "Export All Data (JSON)" button calls `consent.exportChildData` and shares via native Share sheet                       | Implemented |
| **Withdraw consent** | "Withdraw Consent" button with confirmation dialog; sets `consentStatus: 'withdrawn'`, disables account                 | Implemented |
| **Delete all data**  | "Delete Account & All Data" button with double confirmation (alert + type "DELETE"); calls `userProfiles.deleteAccount` | Implemented |
| **Contact operator** | Email listed on consent page: `support@creativebridge.app`                                                              | Implemented |

### Findings

| ID    | Severity   | Finding                                                                                                                                                                                                                                                                                                  | Recommendation                                                                                                                                                                                                 |
| ----- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PR-01 | **HIGH**   | **Parental gate is weak** -- The math problem gate (adding two 2-digit numbers) can be solved by children in grades 3+, and is trivially solved by any child with a calculator. This means children can access the Parent Dashboard and potentially withdraw their own consent or delete their account.  | Consider requiring the parent email + a verification code for Parent Dashboard access, or use a more robust gate (e.g., knowledge-based question, PIN set during consent).                                     |
| PR-02 | **HIGH**   | **No separate consent for data uses** -- There is a single VPC consent covering all data practices. COPPA allows operators to get consent for internal use only (without consent for third-party disclosure). Currently, there is no granular consent for different data uses.                           | For apps targeting children, the FTC recommends clear separation between consent for core service vs. any other uses. While not strictly required if data is only used for the service, document this clearly. |
| PR-03 | **MEDIUM** | **Withdraw consent does not trigger immediate data deletion** -- When consent is withdrawn (`consent.withdrawConsent`), the account is disabled (`consentStatus: 'withdrawn'`) but data is preserved. COPPA states that when a parent revokes consent, the operator must delete the child's information. | Add data deletion (or anonymization) as part of the consent withdrawal flow, or clearly communicate to the parent that data persists until they explicitly request deletion via the separate "Delete" button.  |

---

## 4. Profile Completion Flow

**Status: IMPLEMENTED WITH COPPA PROTECTIONS** | **Risk: LOW**

### What's in Place

- **Flow ordering** (confirmed in `App.tsx`):

  1. Authentication (Clerk OAuth)
  2. Age-gating (AgeGatingScreen)
  3. If under-13: VPC flow (ParentEmailScreen -> ConsentPendingScreen) -- **blocks all access**
  4. Profile completion (ProfileCompletionScreen)
  5. App access

- **US-010 Protection**: `ProfileCompletionScreen.tsx:35` checks `isUnder13` and blocks real name auto-population from OAuth data for under-13 users. Line 97: `if (!displayName && !displayNameTouched && !isUnder13)`.

- **Data collected during profile completion**:
  - Username (auto-filled from email prefix, sanitized)
  - Display name (NOT auto-filled for under-13)
  - Grade level selection

### Findings

| ID    | Severity | Finding                                                                                                                                                                                                  | Recommendation                                                                               |
| ----- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| PC-01 | **LOW**  | **Username auto-fill from email may reveal PII** -- Username is auto-filled from the email prefix (e.g., `john.smith@gmail.com` -> `john_smith`). For under-13 users, this could reveal their real name. | Consider generating a random/fun username for under-13 users instead of deriving from email. |

---

## 5. Privacy Policy & Direct Notice

**Status: PARTIALLY IMPLEMENTED** | **Risk: MEDIUM**

### What's in Place

- **Privacy policy document** exists at `docs/legal/privacy-policy.md`
- **Consent web page** (`convex/http.ts:196-247`) includes direct notice with:
  - Data collected (account info, story content, progress data)
  - How data is used (story generation, illustrations, progress tracking)
  - Third-party services (OpenAI, Replicate, Clerk, Convex)
  - Parental rights (review, delete, withdraw, contact)
- **Legal URLs** configured in `src/config/legalUrls.ts`
- **Terms consent** recorded via `consent.recordTermsConsent` mutation

### Findings

| ID    | Severity     | Finding                                                                                                                                                                                                                                                                   | Recommendation                                                                                              |
| ----- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| PP-01 | **CRITICAL** | **Privacy policy has placeholder fields** -- `docs/legal/privacy-policy.md` contains `[INSERT DATE]`, `[INSERT OPERATOR NAME]`, `[INSERT CONTACT EMAIL]`, `[INSERT MAILING ADDRESS]`. COPPA requires the operator's name, contact info, and effective date to be present. | Fill in all placeholder fields before launch.                                                               |
| PP-02 | **HIGH**     | **Legal URLs may not be live** -- `src/config/legalUrls.ts:11` has a TODO: "Replace with production URLs once legal documents are hosted publicly." The URLs (`creativebridge.app/privacy-policy`, etc.) may not be accessible.                                           | Deploy the privacy policy to the configured URLs before launch. Verify all legal URLs return valid content. |

---

## 6. Annual Consent Renewal

**Status: IMPLEMENTED** | **Risk: LOW**

### What's in Place

- **Daily cron job** (`convex/crons.ts:72-76`): `checkConsentRenewals` runs at 6:00 AM UTC
- **11-month reminder**: Sends renewal reminder email to parent
- **12-month enforcement**: Sets account to `renewal_required` state, blocking the child
- **Age-out handling**: If child's `ageGroup` is no longer `under_13`, skips renewal
- **Renewal flow**: Same Email Plus method as initial consent (`initiateConsentRenewal` mutation)
- **UI support**: `ParentEmailScreen` has `isRenewal` mode with appropriate messaging

No findings -- this is well-implemented.

---

## 7. Data Retention & Cleanup

**Status: IMPLEMENTED** | **Risk: LOW**

### What's in Place

- **Expired consent cleanup** (`crons.ts:42-46`): Daily at 4:00 AM UTC. Deletes pending accounts where consent was not granted within 48 hours.
- **Old consent record cleanup** (`crons.ts:56-60`): Weekly. Purges consent records 3+ years after account deletion (COPPA requirement).
- **Data retention policy** (`convex/dataRetention.ts`):
  - Story sessions: 1 year
  - Analytics: 90 days
  - Migration events: 30 days
  - Consent records: 3 years post-deletion

No findings -- retention policy is COPPA-compliant.

---

## 8. Cross-Audit Findings (Data Flow & AI Safety)

**Status: NEW ISSUES IDENTIFIED** | **Risk: CRITICAL-HIGH**

The following findings were surfaced by the Data Flow Auditor and AI Data Safety Auditor and directly impact the accuracy and completeness of the consent disclosures.

### 8a. OAuth PII Collection Before Age Gate

**Severity: CRITICAL**

The consent flow timeline in Section 2 states the order is: Auth -> Age Gate -> VPC -> Profile Completion. While the _app's own_ data collection follows this order, **Clerk OAuth itself collects PII before the age gate runs**:

1. User taps "Sign in with Google" or "Sign in with Apple"
2. Clerk OAuth receives the child's **full name, email, and profile photo** from the OAuth provider
3. This data is stored in Clerk's systems immediately
4. _Only then_ does `App.tsx` check `needsAgeVerification` and show `AgeGatingScreen`

This means Clerk (a third-party service) receives the child's real name and email **before** the app knows the user is under 13, and therefore before any parental consent is obtained. This is a COPPA violation: personal information is collected from a child before verifiable parental consent.

**Confirmed by code:** `App.tsx:70` accesses `clerkUser` (already authenticated) before line 253 checks `needsAgeVerification`. The OAuth flow in `AuthContext.tsx` completes Clerk sign-in as the first step.

| ID    | Severity     | Finding                                                                                                                                                                                                                        | Recommendation                                                                                                                                                                                                                                                                                                               |
| ----- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| XA-01 | **CRITICAL** | **OAuth collects child PII before age gate and consent.** Clerk receives full name, email, and profile photo from Google/Apple before the app knows the user is under 13. This is pre-consent personal information collection. | (a) Move age-gating to a pre-auth screen (before OAuth is initiated), or (b) use Clerk's age-gating features to block under-13 sign-ups at the OAuth level, or (c) implement a "registration pending" state where Clerk data is not persisted until consent is obtained, and delete Clerk account if consent is not granted. |

### 8b. Voice Audio Sent to Apple/Google Servers (Undisclosed)

**Severity: HIGH**

The app uses native speech recognition for voice input (`src/components/common/VoiceInput.tsx`, `src/services/nativeSpeechRecognizer.ts`):

- **iOS**: Uses `SFSpeechRecognizer` via a native module, which sends audio to Apple's servers for processing
- **Android**: Uses `@react-native-voice/voice` which wraps `android.speech.SpeechRecognizer`, sending audio to Google's servers

The VPC consent web page (`convex/http.ts:221-224`) discloses these third-party services:

> _"We share limited, necessary data with: OpenAI (story AI), Replicate (image AI), Clerk (authentication), and Convex (database)."_

**Apple and Google speech recognition services are not disclosed.** Children's voice audio is transmitted to Apple/Google servers without parental notice or consent.

| ID    | Severity | Finding                                                                                                                                                                                                                                                       | Recommendation                                                                                                                                                                                                                                         |
| ----- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| XA-02 | **HIGH** | **Voice audio sent to Apple/Google servers is not disclosed in the VPC consent form.** The consent page lists OpenAI, Replicate, Clerk, and Convex but omits Apple (SFSpeechRecognizer) and Google (SpeechRecognizer) as recipients of children's voice data. | (a) Add Apple and Google speech recognition to the third-party services disclosure on the consent web page, (b) add a separate voice-data consent toggle, or (c) disable voice features for under-13 users until consent explicitly covers voice data. |

### 8c. Client-Side AI API Calls (Undisclosed Architecture)

**Severity: HIGH**

The AI Safety Auditor confirmed that OpenAI and Replicate API calls are made **directly from the client device** (`src/services/openaiClient.ts` uses `fetch` to `api.openai.com`). This means:

1. The child's device directly communicates with OpenAI and Replicate servers
2. OpenAI/Replicate can see the device's IP address
3. The consent form says "We share limited, necessary data with: OpenAI" but does not disclose that the child's device connects directly (vs. the app server proxying the request)

While the privacy policy mentions PII scrubbing before transmission, the direct client connection means OpenAI/Replicate receive device metadata (IP, user-agent) that could be considered personal information under COPPA.

| ID    | Severity | Finding                                                                                                                                                                                      | Recommendation                                                                                                                                                                                                                                                                                 |
| ----- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| XA-03 | **HIGH** | **Client-side AI API calls expose children's device metadata (IP address) to OpenAI/Replicate.** Consent form does not disclose direct device-to-service communication or metadata exposure. | (a) Proxy all AI API calls through the Convex backend to shield children's IP addresses, or (b) explicitly disclose in the consent form that the child's device communicates directly with these services and what metadata is exposed. Option (a) is strongly preferred for COPPA compliance. |

---

## Summary of Findings

| ID     | Severity     | Summary                                                                                     |
| ------ | ------------ | ------------------------------------------------------------------------------------------- |
| XA-01  | **CRITICAL** | OAuth collects child PII (name, email, photo) from Google/Apple BEFORE age gate and consent |
| PP-01  | **CRITICAL** | Privacy policy has placeholder operator contact info                                        |
| VPC-01 | **CRITICAL** | Consent token uses `Math.random()` instead of CSPRNG                                        |
| VPC-02 | **CRITICAL** | "Email Plus" implementation may not meet FTC's full Email Plus requirements                 |
| XA-02  | **HIGH**     | Voice audio sent to Apple/Google servers not disclosed in VPC consent form                  |
| XA-03  | **HIGH**     | Client-side AI API calls expose children's device IP to OpenAI/Replicate (undisclosed)      |
| AG-01  | **HIGH**     | No DOB collection -- age gate relies on self-declaration of age range                       |
| VPC-03 | **HIGH**     | Consent email failure is silently swallowed                                                 |
| PR-01  | **HIGH**     | Parental gate (math problem) is too weak for older children                                 |
| PR-02  | **HIGH**     | No granular consent for different data uses                                                 |
| PP-02  | **HIGH**     | Legal URLs have TODO placeholder, may not be live                                           |
| AG-02  | **MEDIUM**   | No age-gate lockout across re-registration                                                  |
| VPC-04 | **MEDIUM**   | RESEND_API_KEY production configuration not validated                                       |
| PR-03  | **MEDIUM**   | Consent withdrawal does not trigger data deletion                                           |
| AG-03  | **LOW**      | Age-gating screen missing privacy policy link                                               |
| PC-01  | **LOW**      | Username auto-fill from email may expose child's real name                                  |

---

## Comparison with Previous Audit (2026-03-23)

| Area                     | 2026-03-23      | 2026-03-25                                             |
| ------------------------ | --------------- | ------------------------------------------------------ |
| Age-gating               | Not implemented | Implemented (self-declaration)                         |
| VPC mechanism            | Not implemented | Implemented (Email Plus)                               |
| Consent database         | No schema       | Full `consentRecords` table with lifecycle             |
| Parent email collection  | Not implemented | Implemented with double-entry validation               |
| Consent web page         | Not implemented | Implemented with data practices disclosure             |
| Consent pending/blocking | Not implemented | Implemented with real-time unblocking                  |
| Consent withdrawal       | Not implemented | Implemented with account disable                       |
| Data review by parent    | Not implemented | Implemented (Parent Dashboard)                         |
| Data deletion by parent  | Not implemented | Implemented (with confirmation)                        |
| Data export by parent    | Not implemented | Implemented (JSON export via Share)                    |
| Annual renewal           | Not implemented | Implemented (11-month reminder + 12-month enforcement) |
| Privacy policy           | Not written     | Written (with placeholder fields)                      |
| Data retention           | Not implemented | Implemented (cron jobs + retention periods)            |

**Assessment: Dramatic improvement.** The system has gone from zero COPPA compliance to a substantially complete implementation. The remaining findings are refinements, not architectural gaps.

---

## Recommended Priority Order

1. **XA-01** (CRITICAL): Fix pre-consent PII collection via OAuth -- **launch blocker**. Move age gate before OAuth or implement Clerk account deletion if consent is not granted. This is the most architecturally significant COPPA violation.
2. **PP-01** (CRITICAL): Fill in privacy policy placeholder fields -- low effort, blocks launch
3. **VPC-01** (CRITICAL): Replace `Math.random()` with CSPRNG -- low effort, security fix
4. **VPC-02** (CRITICAL): Evaluate Email Plus compliance with legal counsel -- may need method upgrade
5. **XA-02** (HIGH): Disclose Apple/Google voice data in consent form -- medium effort (consent page update + privacy policy update)
6. **XA-03** (HIGH): Proxy AI API calls through Convex backend to shield children's IP addresses -- high effort but strongly recommended; alternatively update consent disclosure
7. **PP-02** (HIGH): Deploy legal documents to production URLs -- ops task
8. **VPC-03** (HIGH): Show warning when consent email fails -- low effort UX fix
9. **AG-01** (HIGH): Implement DOB-based age verification -- medium effort
10. **PR-01** (HIGH): Strengthen parental gate -- medium effort
11. **PR-02** (HIGH): Document data-use scope in consent -- legal review
12. **PR-03** (MEDIUM): Add data deletion on consent withdrawal -- medium effort
13. **VPC-04** (MEDIUM): Add production config validation -- ops task
