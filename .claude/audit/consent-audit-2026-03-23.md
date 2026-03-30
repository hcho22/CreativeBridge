# COPPA Consent Flow Audit -- CreativeBridge

**Audit Date:** 2026-03-23
**Scope:** Verifiable Parental Consent (VPC) mechanisms, age-gating, data collection practices
**Grade: FAIL**

---

## 1. Age-Gating Assessment

**Status: NOT IMPLEMENTED**

There is no age verification, date of birth input, or age-gating mechanism anywhere in the application.

- **No age-related fields in the database.** The Convex schema (`convex/schema.ts`) `userProfiles` table has no `dateOfBirth`, `age`, `isChild`, `isUnder13`, or `parentEmail` field.
- **No age-related fields in Supabase types.** `src/types/database.ts` `UserProfile` interface has no age properties.
- **Grade level is NOT treated as an age gate.** The signup flow collects `gradeLevel` (K-2, 3-5, 6-8, 9-12) which maps to approximate ages 5-18, but selecting K-2 (ages 5-7) does not trigger any age-gating or parental consent logic. It is used solely for content adaptation.
- **Clerk auth has no age restrictions.** OAuth and email/password flows require only email, password, username, display name, and grade level.
- **Codebase search** for `age`, `birthday`, `date_of_birth`, `dob`, `age_gate`, `under_13`, `child`, `parent`, `guardian`, `coppa` returned zero COPPA-relevant results.

## 2. Parental Consent Assessment

**Status: NOT IMPLEMENTED**

No VPC mechanism of any kind exists:

- No parent email collection
- No consent form (signed, electronic, or otherwise)
- No credit card / government ID / video call / KBA verification
- No parent/child account distinction
- No parental dashboard or controls

The only consent mechanism is a generic Terms of Service checkbox at signup in `src/screens/AuthScreen.tsx`:

```tsx
// Line 62
const [acceptedTerms, setAcceptedTerms] = useState(false);

// Lines 1645-1649
<Text style={styles.checkboxText}>
  I agree to the <Text style={styles.linkText}>Terms of Service</Text> and{' '}
  <Text style={styles.linkText}>Privacy Policy</Text>
</Text>;
```

This is self-certification by the user (potentially a child) and does NOT constitute VPC under COPPA.

## 3. Onboarding Data Collection Timeline

Data is collected in sequence with **no parental consent gates at any point**:

**Stage 1 -- Account Creation (`AuthScreen.tsx`):**

- Email address (required, PII)
- Password (required)
- Username (required, can contain real name)
- Display name (optional, auto-filled from Google/Apple OAuth real name)
- Grade level (required, reveals approximate age)
- Terms acceptance checkbox (not persisted)

For OAuth users, Clerk additionally captures Google/Apple identity (name, email, photo).

**Stage 2 -- Profile Completion (`ProfileCompletionScreen.tsx`):**

- Username, display name, grade level (auto-filled from OAuth data)

**Stage 3 -- Active Use:**

- Story content (child-authored text)
- Voice input data
- Image generation requests
- XP, streaks, game sessions
- Analytics events, personalization data

## 4. Profile Data Requirements

From `convex/userProfiles.ts` `createOAuthProfile` mutation (lines 62-123):

| Field               | Required | PII Risk                                                    |
| ------------------- | -------- | ----------------------------------------------------------- |
| clerkUserId         | Yes      | Low (opaque ID)                                             |
| username            | Yes      | Medium                                                      |
| displayName         | Yes      | **High** (auto-filled with real first/last name from OAuth) |
| preferredGradeLevel | Yes      | Medium (reveals age range)                                  |
| email (via Clerk)   | Yes      | **High**                                                    |
| avatarUrl           | Optional | Medium                                                      |
| bio                 | Optional | High (free text)                                            |

**Critical:** `displayName` auto-populates from OAuth at `ProfileCompletionScreen.tsx` lines 94-98:

```tsx
const firstName = clerkUserObj?.firstName || '';
const lastName = clerkUserObj?.lastName || '';
if (firstName || lastName) {
  setDisplayName(`${firstName} ${lastName}`.trim());
}
```

A child's real name flows into the app automatically without any consent gate.

## 5. Consent Records & Withdrawal

**Consent Records: NOT IMPLEMENTED.** The `acceptedTerms` boolean is local React state only -- not persisted to any database. No `consentTimestamp`, `consentVersion`, or audit trail exists.

**Consent Withdrawal: NOT IMPLEMENTED.** `src/services/userPreferences.ts` has a `setPrivacyConsent()` method for personalization preferences, but this is unrelated to COPPA parental consent. There is no account deletion mechanism in `SettingsScreen.tsx`, no "Delete my data" feature, and no parent consent withdrawal flow.

## 6. Critical Findings

1. **No Age-Gating (CRITICAL)** -- PII is collected from all users without determining if they are under 13.

2. **No Verifiable Parental Consent (CRITICAL)** -- Grade level selection implicitly identifies children (K-2 = ages 5-7) but triggers no consent flow.

3. **Real Name Auto-Population (HIGH)** -- OAuth auto-fills child's real name from Google/Apple into `displayName` without parental gate.

4. **Non-Functional Privacy Policy Links (HIGH)** -- "Privacy Policy" and "Terms of Service" links in `AuthScreen.tsx` (lines 1708-1718) are `TouchableOpacity` elements with NO `onPress` handlers and NO URLs. They are placeholder buttons that do nothing.

5. **No Data Deletion Mechanism (HIGH)** -- No way for parents to request deletion of child data.

6. **Third-Party Data Sharing Without Consent (MEDIUM)** -- Child data is sent to OpenAI (story content), Replicate (image prompts), Clerk (auth), Convex (all data), and ElevenLabs (voice) without parental consent.

7. **No Consent Audit Trail (MEDIUM)** -- Terms acceptance is not persisted. No record of what was consented to, when, or by whom.

## 7. Recommendations

### Immediate (Before Production)

1. **Implement age-gating** as the first step of signup. If user is under 13, redirect to parental consent flow before collecting any PII.

2. **Implement VPC.** For MVP: "Email Plus" method (collect parent email, send consent form, require parent response). For production: credit card or ID verification.

3. **Create and host a COPPA-compliant privacy policy** covering what is collected, how it is used, disclosure practices, parent rights, and operator contact info. Wire up the currently non-functional links.

4. **Add parental controls** -- parent dashboard for reviewing child data, requesting deletion, and withdrawing consent.

5. **Add account/data deletion** accessible from Settings and via parent request.

### Short-Term

6. **Block real name auto-population** for child accounts. Use pseudonyms instead.

7. **Persist consent records** with fields: `consentType`, `consentTimestamp`, `consentVersion`, `parentEmail`, `parentConsentVerified`, `parentConsentMethod`.

8. **Implement data minimization** for child accounts.

9. **Ensure parental consent covers third-party data sharing** (OpenAI, Replicate, ElevenLabs).

### Long-Term

10. Annual consent renewal.
11. Full data flow audit (collection through third-party transmission to deletion).
12. Consider FTC-approved COPPA Safe Harbor program enrollment.

---

## Summary

CreativeBridge is an educational app explicitly designed for children (grade levels K-2 through 9-12, ages ~5-18). It has **zero COPPA compliance mechanisms**. There is no age verification, no parental consent flow, no accessible privacy policy, no data deletion capability, and no consent audit trail. Personal information including real names and email addresses is collected from users of all ages without distinction.

**This application cannot be released to production without significant COPPA compliance violations.**

**Overall Grade: FAIL**

---

### Key files examined:

- `convex/schema.ts` -- database schema, no age/consent fields
- `convex/userProfiles.ts` -- profile creation, no age checks
- `convex/onboarding.ts` -- milestones only, no consent
- `src/screens/AuthScreen.tsx` -- signup flow with non-functional legal links
- `src/screens/ProfileCompletionScreen.tsx` -- real name auto-fill from OAuth
- `src/context/AuthContext.tsx` -- auth state, no age logic
- `src/types/database.ts` -- type definitions, no age fields
- `src/screens/SettingsScreen.tsx` -- no deletion or consent withdrawal
- `src/services/userPreferences.ts` -- privacy consent for personalization only
