# PRD: COPPA Audit Test Suite & Remediation (27 Findings)

## Introduction

The 2026-03-25 COPPA compliance audit surfaced **27 findings** (7 CRITICAL, 8 HIGH, 8 MEDIUM, 4 LOW) across data flow, consent, AI safety, and Apple Kids Category domains. Several CRITICAL items have partial remediations but lack test coverage to verify and prevent regression. Other findings remain unresolved.

This PRD creates a comprehensive test suite that:

1. **Remediates** fixable vulnerabilities (consent token entropy, PII scrubber gaps, email error handling, etc.)
2. **Verifies** existing remediations with regression tests (age gate ordering, server-side AI routing, credential removal)
3. **Documents** known gaps as intentionally-failing tests (`test.failing()`) that auto-flip to passing once the underlying fix lands

The test suite uses **static source analysis** (reading files with `fs.readFileSync` and asserting code patterns), matching the established patterns in `consentSecurity.test.ts`, `credentialExposure.test.ts`, and `serverSideAI.test.ts`.

**Source audit:** `.claude/audit/coppa-audit-2026-03-25.md`
**Test plan:** `.claude/plans/peppy-launching-panda.md`

## Goals

- Create 28 test files (~129 test cases) covering all 27 audit findings
- Fix remediable vulnerabilities directly (C-06, C-04 server gap, H-04, C-05 partial)
- Achieve ~63% initial pass rate (failing tests = documented unresolved vulnerabilities)
- Add `npm run test:coppa` command for targeted COPPA compliance testing
- Establish shared test utilities for static analysis of source code patterns
- Prevent regression on already-fixed CRITICAL items (C-01, C-02, C-03)

## User Stories

---

### US-001: CRITICAL Findings — Test Infrastructure + Remediation + Verification

**Description:** As a COPPA compliance engineer, I want all 7 CRITICAL audit findings covered by tests with fixes applied where possible, so that launch-blocking vulnerabilities are either resolved or explicitly tracked.

**Findings addressed:** 7 (C-01 through C-07)

| ID   | Finding                                  | Status          | Remediation                                               |
| ---- | ---------------------------------------- | --------------- | --------------------------------------------------------- |
| C-01 | OAuth collects child PII before age gate | Already fixed   | Regression test only                                      |
| C-02 | Hardcoded OpenAI API key in source       | Already fixed   | Regression test only                                      |
| C-03 | All AI API calls are client-side         | Partially fixed | Regression test + `test.failing()` for unremediated paths |
| C-04 | Two OpenAI paths skip PII scrubbing      | Partially fixed | Fix server-side scrubber parity + tests                   |
| C-05 | Privacy policy has placeholder fields    | Unresolved      | `test.failing()` to document                              |
| C-06 | Consent token uses `Math.random()`       | Unresolved      | **Fix**: Replace with CSPRNG + test                       |
| C-07 | Email Plus VPC completeness              | Implemented     | Verification test                                         |

**Tasks:**

#### Task 1.1: Create test infrastructure (directories, helpers, custom matchers) ✅ COMPLETE

> **Completed:** 2026-03-26
> **Files created:** `src/__tests__/security/coppa/helpers.ts`, `src/__tests__/security/coppa/helpers.test.ts` > **Files modified:** `src/__tests__/setupAfterEnv.ts`, `package.json` > **Test results:** 18/18 passing (`npx jest --testPathPattern='coppa/helpers' --verbose`)

Create the shared scaffolding all subsequent tests depend on.

**Files to create:**

- `src/__tests__/security/coppa/helpers.ts` — Shared static analysis utilities:
  - `readSourceFile(relativePath: string): string` — wraps `fs.readFileSync` from project root
  - `extractFunctionBlock(source: string, fnName: string): string` — extracts function body (reuse pattern from `consentSecurity.test.ts` line 28+)
  - `findAllFiles(dir: string, ext: string, excludeDirs: string[]): string[]` — recursive file finder (reuse pattern from `credentialExposure.test.ts` lines 19-31)
  - `scanFilesForPattern(files: string[], pattern: RegExp): {file: string, matches: string[]}[]` — returns matches with file paths

**Files to modify:**

- `src/__tests__/setupAfterEnv.ts` — Add 2 custom Jest matchers:
  - `toContainPlaceholder(received: string)` — checks for `[INSERT`, `[TODO`, `[TBD` patterns
  - `toUseCryptoRandom(received: string)` — checks source for `crypto.randomBytes` / `crypto.getRandomValues` / `randomUUID`
- `package.json` — Add script: `"test:coppa": "jest --testPathPattern='coppa/' --verbose"`

**Acceptance Criteria:**

- [x] `src/__tests__/security/coppa/helpers.ts` exports all 4 utility functions
- [x] `readSourceFile('App.tsx')` successfully reads the file
- [x] `findAllFiles` excludes `__tests__/` and `node_modules/` by default
- [x] `toContainPlaceholder` matcher passes on `"Hello [INSERT NAME]"` and fails on `"Hello World"`
- [x] `toUseCryptoRandom` matcher passes on `"crypto.randomBytes(32)"` and fails on `"Math.random()"`
- [x] `npm run test:coppa` command is recognized
- [x] Typecheck passes (with `--skipLibCheck` for pre-existing RN type conflicts)

**Validation Test:**

```bash
npx jest --testPathPattern='coppa/helpers' --verbose 2>&1 | grep -q 'No tests found' && echo "PASS: helpers module created, no test files yet"
npm run test:coppa 2>&1 | grep -q 'coppa' && echo "PASS: test:coppa script works"
```

---

#### Task 1.2: C-01 — Age gate ordering regression test

Verifies the fix in `App.tsx` (lines 250-265) where `needsAgeVerification` check precedes `needsProfileCompletion`.

**File to create:** `src/__tests__/security/coppa/C01-ageGateOrder.test.ts`

**Target source files:** `App.tsx`, `src/screens/AgeGatingScreen.tsx`

**Test cases:**

1. `AgeGatingScreen conditional precedes ProfileCompletionScreen conditional in App.tsx` — Read `App.tsx`, find index positions of `needsAgeVerification` and `needsProfileCompletion` conditionals. Assert age check index < profile check index.
2. `needsAgeVerification returns AgeGatingScreen before any other screen` — Assert the return statement for `needsAgeVerification` appears before `needsProfileCompletion` return.
3. `AgeGatingScreen calls setAgeGroup Convex mutation` — Read `AgeGatingScreen.tsx`, assert `api.userProfiles.setAgeGroup` or `useMutation` is referenced.
4. `No bypass route when ageGroup is null/undefined` — Assert `needsAgeVerification` condition checks for falsy `ageGroup`.

**Acceptance Criteria:**

- [x] All 4 tests pass
- [x] Tests use static source analysis (no runtime mocking)
- [x] Tests import helpers from `./helpers.ts`
- [x] Each test description includes `C-01` finding reference

**Status:** ✅ COMPLETE (2026-03-26)

**Validation Test:**

```bash
npx jest --testPathPattern='C01-ageGateOrder' --verbose
# Result: 4 passed, 0 failed ✅
```

---

#### Task 1.3: C-02 — Hardcoded API key regression test

Extends the pattern from `credentialExposure.test.ts` with broader scope covering `convex/` directory.

**File to create:** `src/__tests__/security/coppa/C02-noHardcodedKeys.test.ts`

**Target source files:** All `src/**/*.ts`, `convex/**/*.ts`, `.gitignore`

**Test cases:**

1. `No sk-proj-*, sk-live-*, sk-test-* patterns in src/ or convex/` — Scan all TypeScript files excluding tests.
2. `No Replicate API tokens (r8_ prefix) in source` — Scan for `r8_[A-Za-z0-9]{30,}`.
3. `No hardcoded Supabase JWTs in source` — Scan for `eyJhbGciOi` pattern.
4. `environment.ts imports API keys from @env module` — Assert `import { ... OPENAI_API_KEY ... } from '@env'`.
5. `convex/ai.ts reads API key from process.env` — Assert `process.env.OPENAI_API_KEY`.
6. `.env file is listed in .gitignore` — Read `.gitignore`, assert `.env` entry exists.

**Acceptance Criteria:**

- [x] All 6 tests pass ✅ (2026-03-26)
- [x] Scan covers both `src/` and `convex/` directories ✅
- [x] No false positives from test files or mock data ✅
- [x] Each test description includes `C-02` finding reference ✅

**Validation Test:**

```bash
npx jest --testPathPattern='C02-noHardcodedKeys' --verbose
# Expected: 6 passed, 0 failed — VERIFIED ✅
```

---

#### Task 1.4: C-03 — Server-side AI routing test (partial `test.failing()`)

Extends `serverSideAI.test.ts` to cover ALL client services that previously made direct AI calls. Three services remain unremediated and use `test.failing()`.

**File to create:** `src/__tests__/security/coppa/C03-serverSideAI.test.ts`

**Target source files:** `src/services/openaiClient.ts`, `src/services/imageGeneration.ts`, `src/services/embeddingGenerationService.ts`, `src/services/contentSafetyService.ts`, `convex/ai.ts`

**Test cases:**

1. `openaiClient.ts has no fetch() calls` — Assert no `fetch(` pattern. (PASS — already fixed)
2. `openaiClient.ts delegates to api.ai.* Convex actions` — Assert `api.ai.generateStoryCompletion` present. (PASS)
3. `[C-03] imageGeneration.ts must not contain direct fetch to replicate.com` — `test.failing()`: Assert no `fetch(` + `replicate` pattern.
4. `[C-03] embeddingGenerationService.ts must not make direct OpenAI fetch` — `test.failing()`: Assert no `fetch(` + `openai` pattern.
5. `[C-03] contentSafetyService.ts must not make direct OpenAI fetch` — `test.failing()`: Assert no `fetch(` + `openai` or `api.openai.com` pattern.
6. `No src/services/ file both imports an API key AND calls fetch` — Broad static scan of all service files.
7. `convex/ai.ts contains server-side OpenAI endpoint calls` — Assert `api.openai.com` present in server file.

**Acceptance Criteria:**

- [x] Tests 1, 2, 7 pass normally ✅ (2026-03-26)
- [x] Tests 3, 4, 5 use `test.failing()` and pass (documenting unremediated paths) ✅ (2026-03-26)
- [x] Test 6 passes — broad scan excludes known-unremediated files tracked by test.failing() ✅ (2026-03-26)
- [x] Each `test.failing()` description includes `[C-03]` audit reference ✅ (2026-03-26)

**Validation Test:**

```bash
npx jest --testPathPattern='C03-serverSideAI' --verbose
# Expected: 7 passed (including 3 test.failing), 0 failed
```

---

#### Task 1.5: C-04 — PII scrubbing completeness + server-side scrubber parity fix ✅ COMPLETE

> **Completed:** 2026-03-26
> **Files created:** `src/__tests__/security/coppa/C04-piiScrubbing.test.ts` > **Files modified:** `convex/ai.ts` (PII_PATTERNS expanded from 4 → 10 patterns)
> **Test results:** 18/18 passing (`npx jest --testPathPattern='C04-piiScrubbing' --verbose`)

**Remediation applied:** Enhanced the server-side PII scrubber in `convex/ai.ts` to match the client-side `piiScrubber.ts` patterns. Server scrubber updated from 4 patterns (email, phone, address, SSN) to 10 (adding ZIP, location, school, name intro, narrative name, age disclosure).

**File to create:** `src/__tests__/security/coppa/C04-piiScrubbing.test.ts`

**Files to modify:** `convex/ai.ts` — Add missing PII patterns to the `PII_PATTERNS` array:

- Age disclosure: `/\bage\s*\d{1,2}\b|\b\d{1,2}\s*years?\s*old\b|\b\d{1,2}-year-old\b/gi` → `[AGE]`
- Name introductions: `/\b(?:my name is|i'm|i am)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/gi` → `[NAME]` (with negative lookahead for prepositions)
- Narrative names: `/\bnamed\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/gi` → `[NAME]`
- School references: `/\b(?:go to|attend|at)\s+[A-Z][a-zA-Z\s]*(?:school|elementary|middle|high|academy|prep)\b/gi` → `[SCHOOL]`
- Location intros: `/\b(?:I live in|I'm from|I live at)\s+[A-Z][a-zA-Z\s,]+/gi` → `[LOCATION]`
- ZIP codes: `/\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/g` → `[ZIP]`

**Test cases (18 total):**

_Client-side unit tests (1-12):_

1. Scrubs email: `tommy@school.edu` → `[EMAIL]`
2. Scrubs phone: `(555) 123-4567` → `[PHONE]`
3. Scrubs SSN: `123-45-6789` → `[SSN]`
4. Scrubs address: `123 Main Street` → `[ADDRESS]`
5. Scrubs ZIP: `CA 90210` → `[ZIP]`
6. Scrubs name intro: `My name is Tommy Smith` → contains `[NAME]`
7. Does NOT scrub `I'm from Chicago` as name
8. Scrubs narrative name: `named Emma Chen` → contains `[NAME]`
9. Scrubs age disclosure: `I'm 7 years old` → contains `[AGE]`
10. Scrubs school ref: `I go to Lincoln Elementary` → contains `[SCHOOL]`
11. Scrubs location: `I live in Chicago` → contains `[LOCATION]`
12. False-positive: `123 is a number` does NOT trigger SSN scrub

_Server-side parity tests (13-18):_ 13. `[C-04] convex/ai.ts scrubPII includes age disclosure pattern` — Static: assert AGE-related regex present 14. `[C-04] convex/ai.ts scrubPII includes name pattern` — Static: assert NAME-related regex present 15. `[C-04] convex/ai.ts scrubPII includes school pattern` — Static: assert SCHOOL-related regex present 16. `[C-04] convex/ai.ts scrubPII includes location pattern` — Static: assert LOCATION-related regex present 17. `[C-04] convex/ai.ts scrubPII includes ZIP pattern` — Static: assert ZIP-related regex present 18. `[C-04] Server PII pattern count >= client PII pattern count` — Compare counts

**Acceptance Criteria:**

- [x] Client-side tests 1-12 all pass (existing piiScrubber already handles these)
- [x] Server-side `convex/ai.ts` `PII_PATTERNS` array updated with 6 new patterns
- [x] Server-side parity tests 13-18 all pass after remediation
- [ ] `npx convex dev` still runs without errors after `convex/ai.ts` modification (requires Convex dev server — verify manually)
- [x] Typecheck passes (with `--skipLibCheck` for pre-existing RN type conflicts)

**Validation Test:**

```bash
npx jest --testPathPattern='C04-piiScrubbing' --verbose
# Result: 18 passed, 0 failed ✅
```

---

#### Task 1.6: C-05 — Privacy policy placeholder test (`test.failing()`)

Documents that `docs/legal/privacy-policy.md` still contains placeholder fields. No code fix — this requires legal/business input.

**File to create:** `src/__tests__/security/coppa/C05-privacyPolicyComplete.test.ts`

**Target source file:** `docs/legal/privacy-policy.md`

**Test cases:**

1. `[C-05] Privacy policy contains no [INSERT ...] placeholders` — `test.failing()`: Read file, assert no `/\[INSERT[^\]]*\]/` matches.
2. `[C-05] Privacy policy contains no [TODO] or [TBD] placeholders` — `test.failing()`: Assert no `/\[(TODO|TBD)[^\]]*\]/i`.
3. `[C-05] Effective date is a real date` — `test.failing()`: Assert first 10 lines do not contain `[INSERT`.
4. `[C-05] Contact email is populated` — `test.failing()`: Assert file contains a real email pattern in the contact section.
5. `[C-05] Operator mailing address is populated` — `test.failing()`: Assert no `[INSERT MAILING ADDRESS]`.

**Acceptance Criteria:**

- [x] 4 tests use `test.failing()` and pass (documenting the gap); 1 test (`[TODO]/[TBD]`) passes as regular `test()` since no such placeholders exist
- [x] Tests will auto-fail (prompting update) once placeholders are filled in
- [x] Each test description includes `[C-05]` audit reference

**Status:** ✅ COMPLETE (2026-03-26)

**Validation Test:**

```bash
npx jest --testPathPattern='C05-privacyPolicy' --verbose
# Result: 5 passed (4 test.failing + 1 regular), 0 failed ✅
```

---

#### Task 1.7: C-06 — Consent token entropy fix + test

**Remediation required:** Replace `Math.random()` in `convex/consent.ts` `generateConsentToken()` (line 930-942) with a cryptographically secure alternative.

**File to create:** `src/__tests__/security/coppa/C06-consentTokenEntropy.test.ts`

**File to modify:** `convex/consent.ts` — Replace the `generateConsentToken` function:

```typescript
// BEFORE (INSECURE):
function generateConsentToken(): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const segments: string[] = [];
  for (let s = 0; s < 4; s++) {
    let segment = '';
    for (let i = 0; i < 8; i++) {
      segment += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    segments.push(segment);
  }
  return segments.join('-');
}

// AFTER (SECURE):
import { randomBytes } from 'crypto';

function generateConsentToken(): string {
  // 32 random bytes = 256 bits of entropy, base64url-encoded
  return randomBytes(32).toString('base64url');
}
```

**Test cases:**

1. `[C-06] generateConsentToken does NOT use Math.random()` — Read function body, assert no `Math.random`.
2. `[C-06] generateConsentToken uses crypto.randomBytes or equivalent` — Assert `crypto` or `randomBytes` in function body.
3. `Token output is at least 32 characters` — Parse function to verify output length.
4. `Token uses URL-safe characters only` — Assert charset is alphanumeric + `-` + `_` (base64url).

**Acceptance Criteria:**

- [x] `Math.random()` removed from `generateConsentToken` in `convex/consent.ts` ✅ (2026-03-26)
- [x] Replaced with `crypto.randomBytes(32).toString('base64url')` or equivalent CSPRNG ✅
- [x] All 4 tests pass after fix ✅
- [x] Existing consent flow tests still pass (`npx jest --testPathPattern='consentSecurity'`) ✅ (7/7 passed)
- [ ] `npx convex dev` still runs without errors (requires live Convex deployment — not validated locally)
- [x] Typecheck passes ✅ (no errors in consent.ts)

**Validation Test:**

```bash
npx jest --testPathPattern='C06-consentToken' --verbose
# Expected: 4 passed, 0 failed
npx jest --testPathPattern='consentSecurity' --verbose
# Expected: all existing consent tests still pass
```

---

#### Task 1.8: C-07 — Email Plus VPC flow verification test

Verifies the full VPC consent flow is complete and functional.

**File to create:** `src/__tests__/security/coppa/C07-emailPlusVPC.test.ts`

**Target source files:** `convex/consent.ts`, `convex/http.ts`

**Test cases:**

1. `submitParentEmail mutation exists and accepts parentEmail argument` — Static: assert `submitParentEmail` is a `mutation` with `parentEmail` in args.
2. `sendConsentEmail action exists` — Static: assert `sendConsentEmail` is an `action` or `internalAction`.
3. `GET /consent/verify endpoint exists in http.ts` — Static: assert route handler with `consent/verify` and GET method.
4. `POST /consent/verify endpoint exists for form submission` — Static: assert POST handler.
5. `Token expires after 48 hours` — Static: assert `CONSENT_TOKEN_EXPIRY_MS` equals `48 * 60 * 60 * 1000` (172800000).
6. `Consent page HTML includes data practices disclosure` — Static: read `http.ts`, assert HTML contains "data collection", "third-party", and "parental rights" (or close equivalents).

**Acceptance Criteria:**

- [x] All 6 tests pass ✅ (2026-03-26)
- [x] Tests verify structure only (no Convex runtime needed) ✅ (2026-03-26)
- [x] Each test description includes `C-07` finding reference ✅ (2026-03-26)

**Validation Test:**

```bash
npx jest --testPathPattern='C07-emailPlusVPC' --verbose
# Expected: 6 passed, 0 failed
```

---

### US-002: HIGH Findings — Security Hardening + Consent UX + Privacy Tests

**Description:** As a child safety engineer, I want all 8 HIGH-severity findings covered by tests with fixes for actionable items, so that pre-launch security and consent UX issues are tracked and resolved.

**Findings addressed:** 8 (H-01 through H-08)

| ID   | Finding                                  | Remediation                                      |
| ---- | ---------------------------------------- | ------------------------------------------------ |
| H-01 | Speech recognition audio sent to cloud   | `test.failing()` + documentation                 |
| H-02 | No DPAs with AI services                 | Static verification of consent disclosures       |
| H-03 | PII scrubber is regex-only               | `test.failing()` documenting contextual PII gaps |
| H-04 | Consent email failure silently swallowed | **Fix**: Add user-facing error state             |
| H-05 | Age gate uses self-declared ranges       | Verification + bypass prevention test            |
| H-06 | Parental gate solvable by children       | Documentation test                               |
| H-07 | Legal URLs have TODO placeholder         | `test.failing()` to document                     |
| H-08 | Parent email stored as plaintext         | `test.failing()` to document                     |

**Tasks:**

#### Task 2.1: H-01 — Speech recognition disclosure test ✅ COMPLETE (2026-03-26, 3/3 tests passing)

**File to create:** `src/__tests__/security/coppa/H01-speechRecognition.test.ts`

**Target source files:** `src/services/nativeSpeechRecognizer.ts`, `src/components/common/VoiceInput.tsx`

**Test cases:**

1. `nativeSpeechRecognizer uses NativeModules.SpeechRecognizerModule (iOS on-device)` — Static: assert `NativeModules.SpeechRecognizerModule` reference.
2. `VoiceInput prefers native iOS recognizer when Platform.OS === 'ios'` — Static: assert platform check for iOS.
3. `[H-01] Privacy policy discloses voice data handling` — `test.failing()`: Read `docs/legal/privacy-policy.md`, assert "voice" or "speech" section exists.

**Validation Test:**

```bash
npx jest --testPathPattern='H01-speechRecognition' --verbose
# Result: 3 passed, 0 failed ✅
```

---

#### Task 2.2: H-02 — DPA acknowledgment in consent materials test

**File to create:** `src/__tests__/security/coppa/H02-dpaAcknowledgment.test.ts`

**Target source files:** `docs/legal/privacy-policy.md`, `convex/http.ts`

**Test cases:**

1. `Privacy policy mentions third-party AI service providers` — Static: assert "OpenAI" or "third-party" in privacy policy.
2. `Consent verification page lists data sharing with AI providers` — Static: read `convex/http.ts` HTML output, assert third-party mention.
3. `[H-02] DPA documents directory or references exist` — `test.failing()`: Check for `docs/legal/dpa/` or DPA references.

**Status:** ✅ COMPLETE (2026-03-26)

**Validation Test:**

```bash
npx jest --testPathPattern='H02-dpaAcknowledgment' --verbose
# Result: 3 passed (2 regular + 1 test.failing), 0 failed ✅
```

---

#### Task 2.3: H-03 — Contextual PII gap documentation tests

**File to create:** `src/__tests__/security/coppa/H03-contextualPII.test.ts`

**Target source file:** `src/services/piiScrubber.ts` (imported directly for unit testing)

**Test cases (5 `test.failing()` documenting gaps, 2 regular `test()` for already-handled cases):**

1. `[H-03] Scrubs "my teacher Mrs. Johnson"` — `test.failing()`: honorific names not caught. ✅
2. `[H-03] Scrubs "my dad's name is Robert Chen"` — `test.failing()`: possessive + relational name not caught. ✅
3. `[H-03] Scrubs partial address "Oak Street near the park"` — `test()`: LOCATION_INTRO_REGEX catches "I live on" prefix. ✅
4. `[H-03] Scrubs phone without separators "5551234567"` — `test()`: PHONE_REGEX matches 10 consecutive digits. ✅
5. `[H-03] Scrubs birth date "born on March 15, 2018"` — `test.failing()`: no birth date pattern exists. ✅
6. `[H-03] Scrubs "Ms. Smith's class at room 204"` — `test.failing()`: honorific + name not caught. ✅
7. `School reference "I go to Ms. Smith's class at Lincoln Elementary"` — `test.failing()`: overlapping patterns break match. ✅

**Validation Test:**

```bash
npx jest --testPathPattern='H03-contextualPII' --verbose
# Expected: 7 passed (5 test.failing + 2 regular) — VERIFIED ✅ (2026-03-26)
```

---

#### Task 2.4: H-04 — Consent email error UX fix + test

**Remediation required:** `ParentEmailScreen.tsx` (lines 68-76) catches `sendConsentEmail` errors with only `console.warn`. Fix: add user-facing error state.

**File to create:** `src/__tests__/security/coppa/H04-consentEmailError.test.ts`

**File to modify:** `src/screens/ParentEmailScreen.tsx` — In the catch block for `sendConsentEmail`, add:

- Set an error state: `setEmailSendError(true)` or similar
- Show user-visible warning (Alert or inline text) explaining email may not have been sent
- Offer a retry option or manual share alternative
- Still call `onConsentInitiated()` (current behavior is intentional — consent link exists server-side)

**Test cases:**

1. `[H-04] ParentEmailScreen does not silently swallow email errors` — Static: read the catch block for `sendConsentEmail`. Assert it does more than `console.warn` — specifically, assert it sets a state variable or calls `Alert.alert`.
2. `ParentEmailScreen has an error state for email send failure` — Static: assert `emailSendError` or `emailError` state variable exists in the component.
3. `onConsentInitiated is still called after email failure (fallback path)` — Static: assert `onConsentInitiated` is called in or after the catch block (current intentional behavior).

**Acceptance Criteria:**

- [x] `ParentEmailScreen.tsx` catch block sets a user-visible error state ✅ (2026-03-26)
- [x] User sees a warning message when email fails (Alert.alert added) ✅ (2026-03-26)
- [x] `onConsentInitiated()` still called (server-side consent link exists regardless) ✅ (2026-03-26)
- [x] All 3 tests pass after fix ✅ (2026-03-26)
- [x] Typecheck passes ✅ (2026-03-26)

**Validation Test:**

```bash
npx jest --testPathPattern='H04-consentEmailError' --verbose
# Expected: 3 passed, 0 failed
```

---

#### Task 2.5: H-05 — Age bypass prevention test ✅ COMPLETE

**File to create:** `src/__tests__/security/coppa/H05-ageBypass.test.ts`

**Target source files:** `src/screens/AgeGatingScreen.tsx`, `convex/userProfiles.ts`, `App.tsx`

**Test cases:**

1. `AgeGatingScreen calls server-side Convex mutation (not client-only storage)` — Static: assert `useMutation(api.userProfiles.setAgeGroup)`.
2. `[H-05] setAgeGroup mutation prevents promotion from under_13 to 18_plus` — Static: read `convex/userProfiles.ts` `setAgeGroup` handler. Assert it checks for existing `ageGroup` and blocks "promotion". `test.failing()` if guard doesn't exist.
3. `[H-05] setAgeGroup mutation prevents promotion from under_13 to 13_to_17` — Same check for intermediate promotion. `test.failing()` if guard doesn't exist.
4. `App.tsx has no bypass parameter for needsAgeVerification` — Static: assert `needsAgeVerification` condition has no override/skip flag.

**Validation Test:**

```bash
npx jest --testPathPattern='H05-ageBypass' --verbose
# Expected: 2 passed, 2 test.failing passed (promotion guards likely missing)
```

> **Completed:** 2026-03-26
> **Result:** 4/4 passed (2 standard + 2 test.failing). Promotion guard gap documented.

---

#### Task 2.6: H-06 — Parental gate strength documentation test ✅ COMPLETE

**Status:** ✅ COMPLETE (2026-03-26)

**File to create:** `src/__tests__/security/coppa/H06-parentalGateStrength.test.ts`

**Target source files:** `src/components/common/ParentalGate.tsx`, `src/screens/ParentDashboardScreen.tsx`

**Test cases:**

- [x] `ParentalGate generates 2-digit operands in 10-39 range` — Static: assert `Math.floor(Math.random() * 30) + 10` or equivalent.
- [x] `Incorrect answer generates a new problem` — Static: assert `handleSubmit` or answer check regenerates operands on failure.
- [x] `No skip/cancel-and-continue bypass exists` — Static: assert cancel/dismiss does NOT call the onSuccess callback.
- [x] `ParentDashboardScreen uses the same parental gate pattern` — Static: assert inline `generateProblem` or `useParentalGate` import.
- [x] `[H-06] Parental gate difficulty level documented` — Assertion that the gate is 2-digit addition (documents known weakness for future strengthening).

**Validation Test:**

```bash
npx jest --testPathPattern='H06-parentalGate' --verbose
# Expected: 5 passed, 0 failed ✅
```

---

#### Task 2.7: H-07 — Legal URL placeholder test (`test.failing()`) ✅ COMPLETE

> **Completed:** 2026-03-26

**File created:** `src/__tests__/security/coppa/H07-legalURLs.test.ts`

**Target source files:** `src/config/legalUrls.ts`, `convex/consent.ts`, `convex/http.ts`

**Test cases (4 `test.failing()` — all pass, confirming gaps exist):**

1. `[H-07] Privacy policy URL is not localhost or placeholder` — `test.failing()`: `legalUrls.ts` has HTTPS URL but contains `TODO` marker indicating not production-verified.
2. `[H-07] Terms of service URL is production-ready` — `test.failing()`: Same `TODO` marker gap as privacy policy.
3. `[H-07] Consent email HTML contains real legal URLs` — `test.failing()`: `buildConsentEmailHtml` has no link to the privacy policy document.
4. `[H-07] Consent verification page links to real privacy policy` — `test.failing()`: `buildConsentPage` describes data practices inline but has no link to full privacy policy.

**Validation Result:**

```bash
npx jest --testPathPattern='H07-legalURLs' --verbose
# Result: 4 passed (4 test.failing), 0 failed ✅
```

---

#### Task 2.8: H-08 — Parent email encryption test (`test.failing()`) ✅ COMPLETE

> **Completed:** 2026-03-26

**File to create:** `src/__tests__/security/coppa/H08-parentEmailEncryption.test.ts`

**Target source files:** `convex/schema.ts`, `convex/consent.ts`

**Test cases:**

1. `[H-08] consentRecords.parentEmail is stored encrypted` — `test.failing()`: Read `convex/consent.ts` `submitParentEmail`, assert encryption call before `ctx.db.insert`.
2. `[H-08] parentEmail is decrypted on read` — `test.failing()`: Assert decryption function in query paths.
3. `[H-08] parentEmail is not returned to client in any consent query` — Read all query/mutation return types, assert no raw `parentEmail` exposed.
4. `getConsentStatus does not return parentEmail` — Cross-reference with existing `consentSecurity.test.ts` test (may already pass).

**Acceptance Criteria:**

- [x] Test file created with 4 test cases ✅ (2026-03-26)
- [x] `test.failing()` used for encryption/decryption tests (not yet implemented) ✅ (2026-03-26)
- [x] Normal assertions verify `getConsentStatus` and `isConsentRequired` don't expose `parentEmail` ✅ (2026-03-26)
- [x] All 4 tests pass (2 test.failing + 2 normal) ✅ (2026-03-26)

**Validation Test:**

```bash
npx jest --testPathPattern='H08-parentEmail' --verbose
# Result: 4 passed, 0 failed ✅
```

---

### US-003: MEDIUM Findings — Privacy Hardening + Data Lifecycle Tests

**Description:** As a privacy engineer, I want all 8 MEDIUM-severity findings covered by tests, so that data lifecycle and privacy issues are tracked for post-launch remediation.

**Findings addressed:** 8 (M-01 through M-08)

| ID   | Finding                                 | Remediation                      |
| ---- | --------------------------------------- | -------------------------------- |
| M-01 | Client IP exposure to AI services       | `test.failing()` (overlaps C-03) |
| M-02 | Supabase analytics no retention         | Verify existing retention crons  |
| M-03 | Deterministic analytics hash            | Document risk                    |
| M-04 | Device metadata in audit logger         | Verify field limits              |
| M-05 | AsyncStorage sensitive data unencrypted | `test.failing()`                 |
| M-06 | OpenAI 30-day data retention            | Document ZDR status              |
| M-07 | Console logs with story content         | Verify **DEV** gating            |
| M-08 | Consent withdrawal lacks deletion       | `test.failing()`                 |

**Tasks:**

#### Task 3.1: Create all 8 MEDIUM privacy test files ✅ COMPLETE

**Files to create:**

1. **`src/__tests__/privacy/coppa/M01-clientIPExposure.test.ts`** (4 cases)

   - Cross-references C-03: verifies no direct client-to-AI fetch calls
   - `test.failing()` for imageGeneration.ts, embeddingGenerationService.ts, contentSafetyService.ts

2. **`src/__tests__/privacy/coppa/M02-analyticsRetention.test.ts`** (3 cases)

   - Verify `convex/dataRetention.ts` defines 90-day analytics cleanup
   - Verify cron job registered in `convex/crons.ts`
   - Verify batch processing with BATCH_SIZE constant

3. **`src/__tests__/privacy/coppa/M03-analyticsHash.test.ts`** (4 cases)

   - Document deterministic hash is a persistent pseudonymous identifier
   - Verify hash uses a salt
   - Verify hash output doesn't contain original userId
   - Document re-identification risk

4. **`src/__tests__/privacy/coppa/M04-deviceMetadata.test.ts`** (3 cases)

   - Verify audit logger doesn't collect IMEI/serial number
   - Verify setupAfterEnv.ts fingerprint helper is test-only
   - Verify production schema limits device fields

5. **`src/__tests__/privacy/coppa/M05-asyncStorageSensitive.test.ts`** (3 cases)

   - `test.failing()`: Scan all `AsyncStorage.setItem` calls for sensitive key names (token, email, session)
   - `test.failing()`: Assert session tokens use react-native-keychain
   - Verify AsyncStorage items have TTL metadata

6. **`src/__tests__/privacy/coppa/M06-openaiRetention.test.ts`** (2 cases)

   - Check `convex/ai.ts` for ZDR header or org-level opt-out
   - Check OPENAI_ORG_ID is passed in headers

7. **`src/__tests__/privacy/coppa/M07-consoleLogLeaks.test.ts`** (4 cases)

   - Verify openaiClient.ts has no console.log
   - Verify console.log calls in services/ are `__DEV__`-gated
   - Check babel.config.js for console stripping plugin
   - Scan services/ for direct logging of user content variables

8. **`src/__tests__/privacy/coppa/M08-consentWithdrawalDeletion.test.ts`** (4 cases)
   - `test.failing()`: Assert `withdrawConsent` calls data deletion cascade (not just status change)
   - Verify `withdrawConsent` sets status to 'withdrawn'
   - `test.failing()`: Assert user stories/images/analytics deleted after withdrawal
   - Verify consent record itself is retained (3-year COPPA requirement)

**Acceptance Criteria:**

- [x] All 8 test files created in `src/__tests__/privacy/coppa/`
- [x] Each test file follows the static analysis pattern
- [x] `test.failing()` used for unresolved findings (M-01, M-05 TTL, M-06 ZDR, M-07 console, M-08 deletion)
- [x] Normal assertions for verifiable items (M-02, M-03, M-04, M-05 keychain/key names, M-06 org-id, M-07 openai, M-08 retention)
- [x] All tests run without errors via `npx jest --testPathPattern='privacy/coppa/M0' --verbose`

**Validation Test:**

```bash
npx jest --testPathPattern='privacy/coppa/M0' --verbose
# Expected: ~19 passed (mix of normal + test.failing), ~0 unexpected failures
```

> **Completed:** 2026-03-26
> **Result:** 27/27 passed across 8 test suites. M-05 tests 1-2 converted from test.failing to normal tests (assertions already pass — no sensitive AsyncStorage keys found, secure storage in use).

---

### US-004: LOW Findings — Edge Case Privacy + E2E Consent Flow

**Description:** As a QA engineer, I want LOW-severity findings documented as tests and a full E2E consent flow verified, so that the complete COPPA compliance picture is captured.

**Findings addressed:** 4 (L-01 through L-04) + E2E

| ID   | Finding                                 | Remediation              |
| ---- | --------------------------------------- | ------------------------ |
| L-01 | Cosine similarity vectors reversibility | Document risk            |
| L-02 | Username auto-fill from email           | Verify under-13 blocking |
| L-03 | Linking.openSettings() not gated        | `test.failing()`         |
| L-04 | Display name allows free text           | Verify under-13 guidance |
| E2E  | Full VPC consent happy path             | Detox test               |

**Tasks:**

#### Task 4.1: Create all 4 LOW privacy test files ✅ COMPLETE

**Status:** ✅ COMPLETE (2026-03-26)

**Files to create:**

1. **`src/__tests__/privacy/coppa/L01-embeddingReversibility.test.ts`** (3 cases)

   - [x] Verify embedding model is `text-embedding-3-small` (1536 dimensions)
   - [x] Verify stored embeddings include original source text alongside vector (documents risk)
   - [x] Document theoretical reversibility risk (informational)

2. **`src/__tests__/privacy/coppa/L02-usernameAutoFill.test.ts`** (4 cases)

   - [x] Verify under-13 display name is NOT auto-filled from OAuth (line 97 guard in `ProfileCompletionScreen.tsx`)
   - [x] Verify username derived from email prefix only (`.split('@')[0]`)
   - [x] Verify sanitization removes dots/special chars
   - [x] `test.failing()`: under-13 username auto-fill from email prefix should also be blocked

3. **`src/__tests__/privacy/coppa/L03-linkingNotGated.test.ts`** (3 cases)

   - [x] `test.failing()`: VoiceInput.tsx `Linking.openSettings()` not wrapped in parental gate
   - [x] `test.failing()`: OAuthSessionHelpModal.tsx `Linking.openSettings()` bypasses parental gate (Apple path)
   - [x] Document risk level: on-device settings (lower risk than external web)

4. **`src/__tests__/privacy/coppa/L04-displayNameFreeText.test.ts`** (4 cases)
   - [x] Verify under-13 display name field has placeholder discouraging real names
   - [x] Verify under-13 display name is not pre-filled from OAuth
   - [x] `test.failing()`: Verify `autoComplete="off"` or `textContentType="none"` on input
   - [x] `test.failing()`: Verify name-pattern validator exists for under-13

**Acceptance Criteria:**

- [x] All 4 test files created in `src/__tests__/privacy/coppa/`
- [x] `test.failing()` used for L-02 (1 case), L-03 (2 cases), L-04 (2 cases)
- [x] All tests run without errors via `npx jest --testPathPattern='privacy/coppa/L0' --verbose`

**Validation Test:**

```bash
npx jest --testPathPattern='privacy/coppa/L0' --verbose
# Expected: 14 passed, 0 failed (9 regular + 5 test.failing) ✅
```

---

#### Task 4.2: Create E2E consent flow test (Detox) ✅ COMPLETE

> **Completed:** 2026-03-26

**File created:** `e2e/coppaConsentFlow.e2e.ts`

**Scenarios (5 Detox E2E tests):**

1. **Full VPC happy path:** OAuth sign-in → AgeGatingScreen → "Under 13" → ParentEmailScreen → enter email → ConsentPendingScreen shown
2. **Age gate before profile:** Sign in → verify AgeGatingScreen appears before ProfileCompletionScreen
3. **13+ user skips consent:** Sign in → select "13 to 17" → proceed directly to ProfileCompletionScreen
4. **Parental gate blocks dashboard:** Navigate to ParentDashboardScreen → math problem appears → wrong answer regenerates → cancel exits
5. **Consent withdrawal flow:** Access ParentDashboard → withdraw consent → verify confirmation alert

**testID props added to 5 screens:**

- `AgeGatingScreen.tsx`: `age-gating-screen`, `age-option-{under_13,13_to_17,18_plus}`, `age-gating-continue`
- `ParentEmailScreen.tsx`: `parent-email-screen`, `parent-email-input`, `parent-email-confirm-input`, `parent-email-submit`
- `ConsentPendingScreen.tsx`: `consent-pending-screen`, `consent-share-button`, `consent-sign-out`
- `ParentDashboardScreen.tsx`: `parental-gate-screen`, `parental-gate-input`, `parental-gate-submit`, `parental-gate-cancel`, `parent-dashboard-screen`, `export-data-button`, `withdraw-consent-button`, `delete-account-button`
- `ProfileCompletionScreen.tsx`: `profile-completion-screen`

**Acceptance Criteria:**

- [x] E2E test file compiles with Detox configuration (`--skipLibCheck` — clean)
- [x] Test IDs added to all 5 relevant screens (20 testID props total)
- [x] Scenarios match the documented consent flow in `convex/http.ts`

**Validation Result:**

```bash
npx tsc --noEmit e2e/coppaConsentFlow.e2e.ts --skipLibCheck --esModuleInterop --moduleResolution node --target ES2020 --module commonjs
# Result: Clean compile, 0 errors ✅
```

---

## Functional Requirements

- FR-1: All test files use static source analysis pattern (`fs.readFileSync` + assertions), not runtime mocking
- FR-2: Shared helper functions in `src/__tests__/security/coppa/helpers.ts` are reused across all COPPA tests
- FR-3: Each test description includes the audit finding ID (e.g., `[C-06]`, `[H-04]`)
- FR-4: Unresolved findings use `test.failing()` to document vulnerabilities without generating CI noise
- FR-5: `npm run test:coppa` runs all COPPA tests across both `security/coppa/` and `privacy/coppa/`
- FR-6: Remediations (C-04, C-06, H-04) do not break existing tests
- FR-7: All `test.failing()` tests include a comment linking to the audit finding ID and expected remediation
- FR-8: Custom matchers (`toContainPlaceholder`, `toUseCryptoRandom`) are defined in `setupAfterEnv.ts` and available to all tests

## Non-Goals

- **Not fixing all 27 findings.** Items requiring legal review (C-05, C-07, H-02), architecture changes (C-03 full server migration), or business decisions (H-05 DOB verification, H-06 stronger parental gate) are documented as `test.failing()` for future sprints.
- **Not replacing the existing security tests.** New COPPA tests complement (not duplicate) `consentSecurity.test.ts`, `credentialExposure.test.ts`, and `serverSideAI.test.ts`.
- **Not creating runtime integration tests for Convex functions.** Static analysis is sufficient for code pattern verification and avoids complex Convex test infrastructure.
- **Not building E2E test infrastructure from scratch.** The E2E test file uses existing Detox configuration.

## Technical Considerations

- **Test pattern:** Static source analysis via `fs.readFileSync` (established pattern in `consentSecurity.test.ts`, `credentialExposure.test.ts`, `serverSideAI.test.ts`)
- **`test.failing()` semantics:** Jest's `test.failing()` inverts expectations — passes when assertion fails, fails when assertion passes. When a vulnerability is fixed, the test auto-fails, prompting conversion to a normal assertion.
- **Convex server-side changes:** `convex/ai.ts` PII pattern update (Task 1.5) and `convex/consent.ts` token fix (Task 1.7) require `npx convex dev` to validate.
- **No new dependencies required.** All tests use `fs`, `path`, and Jest built-ins.
- **Import paths:** Shared helpers use relative paths (`./helpers`). PII scrubber tests import `@/services/piiScrubber` directly for unit testing.

## Success Metrics

- 28 test files created covering all 27 audit findings
- `npm run test:coppa` runs all tests in under 30 seconds
- ~63% initial pass rate (intentionally-failing tests = documented vulnerabilities)
- 3 direct remediations applied: C-04 (server PII parity), C-06 (CSPRNG token), H-04 (email error UX)
- Zero regressions in existing test suites after implementation
- Pass rate increases toward 100% as findings are remediated in future sprints

## Open Questions

1. **C-05 (Privacy policy):** Who owns the legal content? Placeholder fields require operator name, contact email, mailing address, and effective date from the business team.
2. **C-07 (Email Plus VPC):** Has legal counsel confirmed that email-link-click constitutes sufficient VPC under FTC guidelines? The audit flagged that "true" Email Plus may need an additional confirmation step.
3. **H-05 (Age promotion):** Should `setAgeGroup` be a one-time-only mutation (never changeable), or should it allow promotion with re-verification?
4. **H-08 (Parent email encryption):** What encryption approach for Convex? Convex doesn't have native field-level encryption — is application-layer AES acceptable?
