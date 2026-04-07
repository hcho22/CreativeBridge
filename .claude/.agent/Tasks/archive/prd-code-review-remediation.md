# PRD: Code Review Remediation (66 Findings)

## Introduction

The 2026-03-25 automated code review identified 66 issues across security (23), performance (23), and reliability (20) at four severity levels: 7 CRITICAL, 19 HIGH, 28 MEDIUM, and 12 LOW. This PRD covers the full remediation — implementing fixes and writing validation tests for every finding, organized into 6 phases ordered by severity and dependency.

The codebase is a React Native 0.81.5 + Expo 54 app with Convex backend, Clerk OAuth, OpenAI GPT-4 for story generation, and Replicate for image generation. The app targets K-12 children, making COPPA compliance and child safety non-negotiable.

**Source document:** `.claude/findings/code-review-2026-03-25.md`
**Test plan:** `.claude/plans/abundant-plotting-raven.md`

## Goals

- Remove all CRITICAL and HIGH severity vulnerabilities before any app store submission
- Achieve zero hardcoded credentials in client-side source code
- Close all IDOR (Insecure Direct Object Reference) vectors in Convex queries
- Eliminate performance anti-patterns (monkey-patching, fake measurements, timer leaks)
- Make XP transactions atomic and idempotent to prevent data loss or duplication
- Complete Supabase-to-Convex migration for all active services
- Ensure all error messages are age-appropriate for K-2 through 9-12 grade levels
- Write ~104 validation tests across 21 new test files to prevent regression

## User Stories

---

### US-001: Emergency -- Remove Hardcoded Credentials and Move AI Server-Side ✅ COMPLETED (2026-03-25)

**Description:** As a security engineer, I want all API keys removed from client source code and all OpenAI calls routed through Convex actions, so that credentials cannot be extracted from the app bundle and child PII is scrubbed before reaching external APIs.

**Findings addressed:** 5 (2 CRITICAL + 3 HIGH)

| ID    | Finding                              | Severity | File                                                                 |
| ----- | ------------------------------------ | -------- | -------------------------------------------------------------------- |
| S-1.1 | Hardcoded OpenAI API key `sk-proj-*` | CRITICAL | `src/config/environment.ts:76`                                       |
| S-1.2 | Hardcoded Supabase anon key          | CRITICAL | `src/services/supabase.ts:45`, `src/services/environment.ts:114,241` |
| S-1.3 | Clerk `secretKey` in client config   | HIGH     | `src/config/environment.ts:90`                                       |
| S-1.4 | Client-side OpenAI calls expose PII  | HIGH     | `src/services/openaiClient.ts:53-115`                                |
| S-1.5 | No timeout/retry on story generation | HIGH     | `src/services/openaiClient.ts:118-151`                               |

**Fixes required:**

1. **Remove hardcoded OpenAI key** from `src/config/environment.ts:76`. Replace the `__DEV__` fallback with an empty string. The key must only be loaded from `OPENAI_API_KEY` env var on the server side.
2. **Remove hardcoded Supabase anon key** from `src/services/supabase.ts:45` and `src/services/environment.ts:114,241`. Load from env vars only.
3. **Remove `clerk.secretKey`** from the client-side `EnvironmentConfig` type and `getEnvironmentConfig()` in `src/config/environment.ts:90`. This field must never appear in client bundles.
4. **Create Convex actions for AI calls.** Create `convex/ai.ts` with actions:
   - `generateStoryCompletion` -- accepts story context, calls OpenAI server-side with key from `process.env.OPENAI_API_KEY`, includes PII scrubbing before sending to OpenAI
   - `analyzeStoryForImageGeneration` -- same pattern, with retry logic
   - `moderateContent` -- wraps OpenAI Moderation API
5. **Add timeout and retry logic** to the Convex actions: 30-second `AbortController` timeout, exponential backoff (3 attempts, 1s/2s/4s delays) for 429 and 5xx errors.
6. **Update client code** to call Convex actions instead of direct OpenAI fetch. Remove or deprecate `src/services/openaiClient.ts`.
7. **Update JWT verification** in `src/services/clerkJWTVerification.ts:146-206` to use the `jose` library for proper RSA/EC signature verification (not just expiry/issuer checks).

**Acceptance Criteria:**

- [x] `grep -r "sk-proj-" src/` returns zero results
- [x] `grep -r "secretKey" src/config/environment.ts` returns zero results
- [x] `grep -r "eyJhbGciOi" src/services/supabase.ts src/services/environment.ts` returns zero results (no hardcoded JWTs)
- [x] `src/services/openaiClient.ts` no longer makes direct `fetch` calls to `api.openai.com`
- [x] `convex/ai.ts` exists with `generateStoryCompletion`, `analyzeStoryForImageGeneration`, and `moderateContent` actions
- [x] Convex actions include PII scrubbing (strip names, emails, addresses) before calling OpenAI
- [ ] Story generation works end-to-end through Convex actions (manual test in simulator)
- [x] Typecheck passes: `npx tsc --noEmit`
- [x] Lint passes: `npm run lint`

**Validation Test:**

Run: `npm test -- --testPathPattern="security/(credentialExposure|serverSideAI)" --verbose`

| File                                                           | Tests    | Expected                                                                                                                               |
| -------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `src/__tests__/security/credentialExposure.test.ts` (NEW)      | 5 tests  | No secret patterns in env config; apiKey empty when env unset; loads only from env var                                                 |
| `src/__tests__/security/serverSideAI.test.ts` (NEW)            | 6 tests  | No direct OpenAI fetch from client; routes through Convex action; 30s timeout; exponential backoff retry; friendly 10s waiting message |
| `src/__tests__/services/clerkJWTVerification.test.ts` (MODIFY) | +2 tests | Rejects forged JWT signature; verifies RSA against JWKS                                                                                |

- [x] All 23 tests pass (5 credential + 6 serverSideAI + 12 JWT including 2 new)
- [x] No test uses hardcoded API keys (tests must use mock values only)

---

### US-002: Auth Hardening -- Fix IDOR, Lock Sign-In Tokens, Secure Consent Flow

**Description:** As a security engineer, I want all Convex queries to derive user identity from the auth context instead of accepting it as a client argument, so that authenticated users cannot access other users' data.

**Findings addressed:** 9 (1 HIGH + 8 MEDIUM)

| ID    | Finding                                                 | Severity  | File                                                                                                 |
| ----- | ------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------- |
| S-2.1 | IDOR in 10 queries (accept clerkUserId from client)     | MEDIUM x6 | `convex/gameSessions.ts`, `convex/imageGeneration.ts`, `convex/userProfiles.ts`, `convex/consent.ts` |
| S-2.2 | `getSession` has no auth check                          | MEDIUM    | `convex/gameSessions.ts:586-593`                                                                     |
| S-2.3 | `getImageGenerationEvent` has no auth check             | MEDIUM    | `convex/imageGeneration.ts:405-434`                                                                  |
| S-2.4 | Admin queries lack RBAC                                 | MEDIUM    | `convex/imageGeneration.ts:479-775`                                                                  |
| S-2.5 | `createSignInToken` lacks caller authorization          | HIGH      | `convex/auth.ts:202-261`                                                                             |
| S-2.6 | `verifyAndGrantConsent` has no auth requirement         | MEDIUM    | `convex/consent.ts:299-361`                                                                          |
| S-2.7 | `submitParentEmail` returns consentToken to client      | MEDIUM    | `convex/consent.ts:284-289`                                                                          |
| S-2.8 | `getConsentStatus` exposes parentEmail and consentToken | MEDIUM    | `convex/consent.ts:58-82`                                                                            |
| S-2.9 | `migrateUserGameSessions` doesn't verify caller         | MEDIUM    | `convex/migration.ts:3536-3561`                                                                      |

**Fixes required:**

1. **Fix all IDOR queries in `convex/gameSessions.ts`.** For each of the 7 queries (`getActiveSession`, `getSession`, `getUserSessions`, `searchUserStories`, `getUserStoriesWithImages`, `getImportableStories`, `getStoryLibrary`):

   - Add `const identity = await ctx.auth.getUserIdentity()` at the top
   - Throw if `identity` is null (unauthenticated)
   - Derive `clerkUserId` from `identity.subject` (or `identity.tokenIdentifier`)
   - Remove `clerkUserId` from `args` validator
   - For `getSession`: verify the session's `clerkUserId` matches the caller's

2. **Fix IDOR in `convex/imageGeneration.ts`.** Apply the same pattern to `getUserImageGenerationEvents` (line 349) and `getImageGenerationEvent` (line 405).

3. **Fix IDOR in `convex/userProfiles.ts`.** Apply the same pattern to `getProfileByClerkId` (line 144).

4. **Fix IDOR in `convex/consent.ts`.** Apply to `getConsentStatus` (line 58) and `isConsentRequired` (line 91).

5. **Add admin RBAC to analytics queries.** In `convex/imageGeneration.ts`, add a `requireAdmin(ctx)` helper that checks a role field on the user profile. Apply to `getImageGenerationAnalytics`, `getDailyImageGenerationStats`, and `getRecentImageGenerationEvents`.

6. **Lock `createSignInToken`** in `convex/auth.ts:202-261`. Verify the authenticated caller's email matches `args.email` before creating a sign-in token.

7. **Secure consent flow** in `convex/consent.ts`:

   - Remove `consentToken` from `getConsentStatus` response (line 79)
   - Remove `consentToken` from `submitParentEmail` response (line 284-289) -- token only sent via email
   - Add parent email verification to `verifyAndGrantConsent` (line 299-361) -- require email match, not just token
   - Remove `parentEmail` from `getConsentStatus` response for non-owner callers

8. **Fix migration auth** in `convex/migration.ts:3536-3561`. Verify the authenticated caller's clerkUserId matches `args.clerkUserId`.

**Acceptance Criteria:**

- [x] Every query in `convex/gameSessions.ts` that previously accepted `clerkUserId` as an arg now derives it from `ctx.auth.getUserIdentity()`
- [x] Unauthenticated calls to any of the 10 IDOR-affected queries throw an error
- [x] `getConsentStatus` response contains neither `consentToken` nor `parentEmail` for non-owner callers
- [x] `submitParentEmail` response does not contain `consentToken`
- [x] `createSignInToken` rejects when caller email does not match `args.email`
- [x] `getImageGenerationAnalytics`, `getDailyImageGenerationStats`, and `getRecentImageGenerationEvents` reject non-admin callers
- [x] `migrateUserGameSessions` rejects when caller clerkUserId does not match `args.clerkUserId`
- [x] Typecheck passes: `npx tsc --noEmit`
- [x] Lint passes: `npm run lint` (no new errors introduced; 16 pre-existing errors unrelated to US-002)

**Validation Test:**

Run: `npm test -- --testPathPattern="security/(convexIDOR|consentSecurity|createSignInToken|adminRBAC|migrationAuth)" --verbose`

| File                                                     | Tests    | Expected                                                                             |
| -------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------ |
| `src/__tests__/security/convexIDOR.test.ts` (NEW)        | 11 tests | Pre-fix IDOR proven; all 10 queries scoped to auth user; unauthenticated calls throw |
| `src/__tests__/security/consentSecurity.test.ts` (NEW)   | 7 tests  | No token/email exposure; parent email verification; expired token rejection          |
| `src/__tests__/security/createSignInToken.test.ts` (NEW) | 4 tests  | Rejects mismatched email; rejects unauthenticated; works for matching email          |
| `src/__tests__/security/adminRBAC.test.ts` (NEW)         | 4 tests  | Rejects regular users; accepts admin role                                            |
| `src/__tests__/security/migrationAuth.test.ts` (NEW)     | 1 test   | Rejects non-owner clerkUserId                                                        |

- [x] All 27 tests pass (verified 2026-03-25)

---

### US-003: Performance Cleanup -- Remove Monkey-Patching, Fake Measurements, and Timer Leaks

**Description:** As a performance engineer, I want the global function monkey-patching removed, fake performance measurements replaced or disabled, and all singleton timer leaks fixed, so that the app's monitoring infrastructure doesn't degrade the performance it's meant to measure.

**Findings addressed:** 6 (3 CRITICAL + 3 HIGH)

| ID    | Finding                                                     | Severity | File                                                                                                                                                        |
| ----- | ----------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P-3.1 | Global `requestAnimationFrame` and `fetch` monkey-patching  | CRITICAL | `src/services/performanceOptimizer.ts:246,270`                                                                                                              |
| P-3.2 | `Math.random()` used for performance measurements           | CRITICAL | `src/services/performanceTuner.ts:567-591`                                                                                                                  |
| P-3.3 | Singleton timers never destroyed                            | CRITICAL | `storyCache.ts:432,511`, `predictiveStoryCache.ts:639,648`, `performanceOptimizer.ts:176-178`, `uiPerformanceMonitor.ts:526`                                |
| P-3.4 | 6 concurrent performance monitoring services                | HIGH     | `performanceOptimizer.ts`, `performanceService.ts`, `performanceTuner.ts`, `uiPerformanceMonitor.ts`, `resourceManager.ts`, `downloadPerformanceMonitor.ts` |
| P-3.5 | Meaningless memory usage estimates (`Date.now() % 100000`)  | HIGH     | `src/services/performanceOptimizer.ts:200`, `src/services/downloadPerformanceMonitor.ts:226`                                                                |
| P-3.6 | Embedding cache ~6MB footprint + verbose production logging | HIGH     | `src/services/embeddingGenerationService.ts`                                                                                                                |

**Fixes required:**

1. **Remove monkey-patching** from `src/services/performanceOptimizer.ts`. Delete lines 245-290 (the `requestAnimationFrame` and `fetch` global wrapping). If the class needs instrumentation, use explicit wrapper functions called at specific call sites, not global replacement.

2. **Fix or disable `performanceTuner.ts` measurements.** Replace the `Math.random()` calls at lines 567-591 with real measurement APIs:

   - Use `performance.now()` for timing
   - Use `expo-device` or `react-native-device-info` for memory estimates
   - If real APIs are unavailable, disable auto-tuning entirely rather than tuning based on random data

3. **Add `destroy()` methods** to all singleton services that create `setInterval`:

   - `src/services/storyCache.ts` -- clear intervals at lines 432, 511
   - `src/services/predictiveStoryCache.ts` -- clear intervals at lines 639, 648
   - `src/services/performanceOptimizer.ts` -- clear interval at line 176
   - `src/services/uiPerformanceMonitor.ts` -- clear interval at line 526
   - Each `destroy()` must call `clearInterval` for all timers and be idempotent (safe to call twice)

4. **Consolidate 6 performance services into 1.** Create a single lightweight `src/services/performanceMonitor.ts` that:

   - Is disabled by default (lazy initialization)
   - Supports explicit `.start()` / `.stop()` lifecycle
   - Does NOT use fake data (`Date.now() % 100000` or `Math.random()`)
   - Replaces: `performanceOptimizer.ts`, `performanceService.ts`, `performanceTuner.ts`, `uiPerformanceMonitor.ts`, `resourceManager.ts`, `downloadPerformanceMonitor.ts`
   - Mark the 6 old files as deprecated or remove them

5. **Reduce embedding cache** in `src/services/embeddingGenerationService.ts` from 1000 to 200 entries. Gate all `console.log` behind `__DEV__`.

**Acceptance Criteria:**

- [x] `global.requestAnimationFrame` is not wrapped/modified by any module import
- [x] `global.fetch` is not wrapped/modified by any module import
- [x] `grep -r "Math.random" src/services/performanceTuner.ts` returns zero results in measurement functions
- [x] `grep -r "Date.now() % 100000" src/services/` returns zero results
- [x] `storyCache`, `predictiveStoryCache`, `performanceOptimizer`, `uiPerformanceMonitor` all expose `destroy()` methods
- [x] Only 1 active performance monitoring service remains (`src/services/performanceMonitor.ts`)
- [x] Importing performance services creates zero background timers (lazy init)
- [x] Embedding cache max entries reduced to 200
- [x] No `console.log` in `embeddingGenerationService.ts` outside of `__DEV__` guard
- [ ] Typecheck passes: `npx tsc --noEmit`
- [x] Lint passes: `npm run lint`

**Validation Test:**

Run: `npm test -- --testPathPattern="performance/(monkeyPatch|performanceTuner|singletonTimer|monitoringConsolidation)" --verbose`

| File                                                                   | Tests   | Expected                                                                   |
| ---------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------- |
| `src/__tests__/performance/monkeyPatchRemoval.test.ts` (NEW)           | 5 tests | Pre-fix wrapping proven; post-fix globals unchanged; < 1ms overhead        |
| `src/__tests__/performance/performanceTunerMeasurements.test.ts` (NEW) | 4 tests | Pre-fix Math.random proven; post-fix real APIs used; deterministic results |
| `src/__tests__/performance/singletonTimerLifecycle.test.ts` (NEW)      | 6 tests | All 4 services have destroy(); hot reload safe; idempotent                 |
| `src/__tests__/performance/monitoringConsolidation.test.ts` (NEW)      | 4 tests | Single service; no fake data; disabled by default; opt-in start/stop       |

- [x] All 19 tests pass (4 suites, 19/19 passing)

---

### US-004: Data Integrity -- Atomic XP, Write-Ahead Log, Convex Index Fixes

**Description:** As a reliability engineer, I want XP transactions to be atomic and idempotent, story saves to survive network failures via a write-ahead log, and Convex queries to use correct indexes, so that children never lose creative work or experience inconsistent XP balances.

**Findings addressed:** 6 (3 HIGH + 3 MEDIUM)

| ID    | Finding                                                    | Severity | File                                                                              |
| ----- | ---------------------------------------------------------- | -------- | --------------------------------------------------------------------------------- |
| R-4.1 | XP award is non-atomic with no idempotency guard           | HIGH     | `src/services/storySessionManager.ts:1097-1105`, `convex/userProfiles.ts:697-769` |
| R-4.2 | Story content lost if Convex update fails mid-continuation | HIGH     | `src/services/storySessionManager.ts:606-611`                                     |
| R-4.3 | No offline story save fallback                             | HIGH     | `src/services/storyManagementService.ts:177-179`                                  |
| R-4.4 | `completeSession` guard bypassable via `updateSession`     | MEDIUM   | `convex/gameSessions.ts:370-371`                                                  |
| R-4.5 | `imageGenerationEvents` queried by wrong index             | MEDIUM   | `convex/imageGeneration.ts:356`                                                   |
| R-4.6 | Full table scan in `getImageGenerationAnalytics`           | MEDIUM   | `convex/imageGeneration.ts:487`                                                   |

**Fixes required:**

1. **Make XP transactions atomic and idempotent.** Combine `gameSessions.completeSession` and `userProfiles.completeGameSession` into a single Convex mutation (or call the profile update from within the session completion mutation so it runs in one transaction). Add a `lastCompletedSessionId` field to the `userProfiles` table:

   - Before awarding XP, check if `lastCompletedSessionId === args.sessionId`
   - If match, skip XP award (idempotent)
   - If no match, award XP and set `lastCompletedSessionId`
   - Update `convex/schema.ts` to include `lastCompletedSessionId: v.optional(v.string())`

2. **Implement write-ahead log (WAL) for story saves.** In `src/services/storyManagementService.ts`:

   - Before calling Convex mutation, write the pending save to AsyncStorage with a unique key (e.g., `wal_save_{sessionId}_{timestamp}`)
   - On Convex success, delete the WAL entry
   - On Convex failure, keep the WAL entry and return a user-visible "saved locally" indicator
   - Add a `replayPendingWrites()` function that reads all `wal_save_*` entries and retries Convex mutations
   - Call `replayPendingWrites()` on app foreground / network connectivity change

3. **Fix silent failure in `storySessionManager.ts:606-611`.** Instead of returning cached data with only `console.error`, persist the pending update to AsyncStorage and surface a "saving..." / "saved" / "offline" indicator to the UI.

4. **Close `completeSession` bypass.** In `convex/gameSessions.ts`, ensure `updateSession` mutation rejects or strips `completedAt` and `xpEarned` fields. Only `completeSession` should be able to mark a session as completed.

5. **Fix Convex indexes:**
   - Add `by_clerk_user` index on `clerkUserId` to the `imageGenerationEvents` table in `convex/schema.ts`
   - Update `getUserImageGenerationEvents` (line 356) to use `.withIndex('by_clerk_user')` instead of `by_user`
   - Replace `.collect()` in `getImageGenerationAnalytics` (line 487) with indexed query + server-side aggregation
   - Add index filtering to `getDailyImageGenerationStats` (line 643) using `_creationTime` range
   - Replace `.collect()` in `convex/dataRetention.ts:68` with paginated queries using `.take()` or cursor-based pagination

**Acceptance Criteria:**

- [x] `completeGameSession` (or equivalent combined mutation) checks `lastCompletedSessionId` before awarding XP
- [x] Calling completion twice with the same sessionId awards XP only once
- [x] `convex/schema.ts` includes `lastCompletedSessionId` on `userProfiles` table
- [x] `saveStory` writes to AsyncStorage WAL before Convex mutation
- [x] Failed Convex saves are queued in AsyncStorage and retried on reconnection
- [x] `updateSession` mutation rejects or ignores `completedAt` field
- [x] `convex/schema.ts` includes `by_clerk_user` index on `imageGenerationEvents`
- [x] `getUserImageGenerationEvents` uses `by_clerk_user` index
- [x] `getImageGenerationAnalytics` does NOT use bare `.collect()` without index filtering
- [x] `dataRetention.ts` uses pagination, not `.collect()`, on full tables
- [x] Typecheck passes: `npx tsc --noEmit` (no new errors; pre-existing errors unchanged)
- [x] Lint passes: `npm run lint` (no new warnings; pre-existing warnings unchanged)

**Validation Test:**

Run: `npm test -- --testPathPattern="reliability/(xpAtomicity|writeAheadLog|convexIndexes|sessionCompletionGuard)|integration/xpSystem" --verbose`

| File                                                             | Tests   | Expected                                                                                                                                 |
| ---------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `src/__tests__/reliability/xpAtomicity.test.ts` (NEW)            | 6 tests | Pre-fix double-XP proven; idempotent award; atomic mutation; lastCompletedSessionId set; concurrent safety; updateSession bypass blocked |
| `src/__tests__/reliability/writeAheadLog.test.ts` (NEW)          | 5 tests | AsyncStorage written first; failed saves queued; replayed on reconnect; no duplicates; failures surfaced to user                         |
| `src/__tests__/reliability/convexIndexes.test.ts` (NEW)          | 4 tests | Correct index used; no bare .collect(); composite index filtering; paginated cleanup                                                     |
| `src/__tests__/reliability/sessionCompletionGuard.test.ts` (NEW) | 6 tests | xpEarned stripped; finalScore stripped; completed session guard; double completion guard; schema checks                                  |
| `src/__tests__/integration/xpSystemIntegration.test.ts` (MODIFY) | +1 test | E2E idempotent story completion                                                                                                          |

- [x] All 22 new/modified tests pass (3 pre-existing failures in xpSystemIntegration unchanged)

**Completed:** 2026-03-25

---

### US-005: Migration Cleanup -- Remove Supabase Ghost Services ✅ COMPLETED (2026-03-25)

**Description:** As a platform engineer, I want all services that still target Supabase migrated to Convex (or removed), so that monitoring, sync, and error logging actually work against the active backend and don't produce false-negative health signals.

**Findings addressed:** 6 (6 MEDIUM)

| ID    | Finding                                                      | Severity | File                                                   |
| ----- | ------------------------------------------------------------ | -------- | ------------------------------------------------------ |
| M-5.1 | `syncService` targets Supabase exclusively                   | MEDIUM   | `src/services/syncService.ts:9`                        |
| M-5.2 | `monitoringService` queries Supabase for image events        | MEDIUM   | `src/services/monitoringService.ts:149`                |
| M-5.3 | `errorLogger` routes to Supabase                             | MEDIUM   | `src/services/errorLogger.ts:8`                        |
| M-5.4 | `claudeSkillsMonitor` uploads to non-existent Supabase table | MEDIUM   | `src/services/claudeSkillsMonitor.ts:755-762`          |
| M-5.5 | `postGenerationStorageService` skips Convex session IDs      | MEDIUM   | `src/services/postGenerationStorageService.ts:105-122` |
| M-5.6 | `storyQuestService` hardcodes `localhost:5000`               | MEDIUM   | `src/services/storyQuestService.ts:12`                 |

**Fixes required:**

1. **Migrate `syncService.ts`** to use Convex reactive queries instead of `supabase.from()`. If cross-device sync is not yet needed, disable the service behind a feature flag and document the planned approach.

2. **Migrate `monitoringService.ts`** to query `convex/imageGeneration.ts:getImageGenerationAnalytics` (or the new admin-gated equivalent from US-002) instead of `supabase.from('image_generation_events')`.

3. **Migrate `errorLogger.ts`** to route errors to Convex (create a `convex/errorLogs.ts` mutation) or to an external service like Sentry. Remove Supabase dependency.

4. **Remove or disable `claudeSkillsMonitor.ts:755-762`** Supabase upload. The Claude Skills infrastructure is entirely mocked (per `src/services/claudeSkillsManager.ts:19`), so monitoring a mock service is pointless. Either remove the upload or route to Convex.

5. **Fix `postGenerationStorageService.ts:105-122`** to handle Convex-format session IDs. Remove or update the `isValidUUID(sessionId)` check that causes all Convex sessions to be skipped.

6. **Make `storyQuestService.ts` URL configurable.** Replace `STORY_QUEST_API_BASE = 'http://localhost:5000/api'` with a value from environment config. If the Story Quest feature isn't production-ready, disable it behind a feature flag.

7. **Surface AsyncStorage degraded mode.** In `src/utils/asyncStorageWrapper.ts`, add an `isDegraded(): boolean` method that returns `true` when the in-memory fallback is active, and log a warning on initialization if degraded.

**Acceptance Criteria:**

- [x] `grep -r "supabase.from" src/services/syncService.ts` returns zero results
- [x] `grep -r "supabase.from" src/services/monitoringService.ts` returns zero results
- [x] `grep -r "supabase.from" src/services/errorLogger.ts` returns zero results
- [x] `grep -r "supabase" src/services/claudeSkillsMonitor.ts` returns zero results for data upload
- [x] `postGenerationStorageService` processes Convex-format session IDs (does not skip them)
- [x] `storyQuestService` base URL reads from environment config, not hardcoded localhost
- [x] `asyncStorageWrapper` exposes `isDegraded()` and logs warning when fallback is active
- [x] Typecheck passes: `npx tsc --noEmit` (no new errors; pre-existing errors unchanged)
- [x] Lint passes: `npm run lint` (no new warnings; pre-existing warnings unchanged)

**Validation Test:**

Run: `npm test -- --testPathPattern="reliability/(supabaseMigrationCleanup|asyncStorageFallback)" --verbose`

| File                                                               | Tests   | Expected                                                                                                                                                                                          |
| ------------------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/__tests__/reliability/supabaseMigrationCleanup.test.ts` (NEW) | 6 tests | syncService uses Convex; monitoringService queries Convex; errorLogger no Supabase; claudeSkillsMonitor no Supabase; postGenerationStorage handles Convex IDs; storyQuestService URL configurable |
| `src/__tests__/reliability/asyncStorageFallback.test.ts` (NEW)     | 3 tests | Detects unavailable AsyncStorage; isDegraded() returns true; warns about data loss                                                                                                                |

- [ ] All 9 tests pass

---

### US-006: UX Polish -- Child-Friendly Errors, Image Caching, Context Splitting, Token Truncation ✅ COMPLETED (2026-03-25)

**Description:** As a product engineer, I want error messages appropriate for K-2 students, images cached locally to avoid re-downloads, the monolithic AuthContext split to reduce re-renders, story prompts truncated to fit AI context windows, and search input sanitized against ReDoS, so that the app is performant, safe, and delightful for children.

**Findings addressed:** 5 (2 HIGH + 3 MEDIUM)

| ID    | Finding                                         | Severity | File                                        |
| ----- | ----------------------------------------------- | -------- | ------------------------------------------- |
| U-6.1 | Error messages not child-friendly               | HIGH     | `src/services/openaiClient.ts:87-99`        |
| U-6.2 | No client-side image caching                    | HIGH     | `src/services/imageStorageService.ts:426`   |
| U-6.3 | Monolithic AuthContext (148KB, 4247 lines)      | MEDIUM   | `src/context/AuthContext.tsx`               |
| U-6.4 | No token-aware truncation for long stories      | MEDIUM   | `src/services/storyAgent.ts`                |
| U-6.5 | ReDoS via unescaped regex in `highlightMatches` | MEDIUM   | `src/services/advancedSearchService.ts:644` |

**Additional related findings (lower severity, addressed opportunistically):**

| ID    | Finding                                | Severity | File                                              |
| ----- | -------------------------------------- | -------- | ------------------------------------------------- |
| U-6.6 | Content safety fails open for under-13 | LOW      | `src/services/contentSafetyService.ts:106-116`    |
| U-6.7 | ErrorBoundary shows skull emoji        | MEDIUM   | `src/components/common/ErrorBoundary.tsx:127-130` |

**Fixes required:**

1. **Child-friendly error messages.** Create an error message mapping in `src/utils/childFriendlyErrors.ts`:

   - 429 rate limit: "Our story helper is taking a break! Let's try again in a moment."
   - 500 server error: "Oops, something got mixed up! Let's try again."
   - Timeout: "This is taking longer than expected. Want to try again?"
   - Generic: "Something went wrong. Let's try one more time!"
   - Apply these mappings wherever OpenAI/AI errors surface to the UI (replace technical messages in `openaiClient.ts:87-99` or the Convex action error handler from US-001)

2. **Fix ErrorBoundary for K-2.** In `src/components/common/ErrorBoundary.tsx:127-130`, replace skull emoji with a friendly illustration or neutral emoji. Use grade-level-aware language if grade context is available.

3. **Content safety: fail closed for under-13.** In `src/services/contentSafetyService.ts:106-116`, when the OpenAI Moderation API errors, block the content for users under 13 instead of passing it through. Users 13+ can keep the current fail-open behavior.

4. **Implement image caching.** In `src/services/imageStorageService.ts`:

   - Use `expo-image` (which has built-in caching) or implement a local cache with `FileSystem.cacheDirectory`
   - Cache images after first download; serve from cache on subsequent requests
   - Add LRU eviction with a configurable max cache size (e.g., 50MB)
   - Support server-side resize parameters to avoid downloading full-resolution images for thumbnails

5. **Split AuthContext into 3 contexts.** Refactor `src/context/AuthContext.tsx` (4,247 lines) into:

   - `src/context/AuthContext.tsx` -- authentication state only: `isAuthenticated`, `signIn`, `signOut`, `user`
   - `src/context/UserProfileContext.tsx` -- profile data: `displayName`, `gradeLevel`, `ageGroup`, `preferences`
   - `src/context/GamificationContext.tsx` -- XP/gamification: `totalXp`, `currentStreak`, `milestones`, `achievements`
   - Create a `src/context/AppProviders.tsx` wrapper that composes all three
   - Update all consumer components to import from the specific context they need

6. **Token-aware story truncation.** In `src/services/storyAgent.ts`, before sending `storySoFar` to OpenAI:

   - Estimate token count (rough: chars / 4, or use `tiktoken` if available)
   - If over the model's context budget (e.g., 6K tokens for story content within an 8K window), truncate:
     - Always preserve the last 2-3 rounds of story
     - Preserve key narrative elements (character names, setting) from earlier rounds via summary
     - Add a `[Story so far summarized]` marker when truncation occurs
   - Short stories (under limit) pass through verbatim

7. **Fix ReDoS in `highlightMatches`.** In `src/services/advancedSearchService.ts:644`:
   - Escape regex special characters in user search terms before creating `new RegExp()`
   - Use a function like: `term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`
   - Alternatively, use `String.prototype.indexOf` instead of regex for simple highlighting

**Acceptance Criteria:**

- [x] No technical error messages (e.g., "rate limit exceeded", "500", "ECONNREFUSED") visible in the UI
- [x] ErrorBoundary does not show skull emoji for K-2 users
- [x] Content safety blocks content for under-13 users when moderation API fails
- [x] Images are cached locally after first download; second load does not trigger network request
- [x] Cache respects size limits with LRU eviction
- [x] `AuthContext.tsx` is split into 3 files; changing auth state does not re-render XP-only consumers
- [x] Stories longer than ~6K tokens are truncated, preserving recent rounds
- [x] `highlightMatches` handles regex special characters without error
- [x] `highlightMatches` completes in < 100ms for adversarial input
- [x] Typecheck passes: `npx tsc --noEmit` (no new errors; pre-existing errors unchanged)
- [x] Lint passes: `npm run lint` (no new warnings; pre-existing warnings unchanged)

**Validation Test:**

Run: `npm test -- --testPathPattern="(reliability/(childFriendlyErrors|tokenTruncation)|performance/(imageCaching|contextSplitting|reDoSProtection))" --verbose`

| File                                                          | Tests   | Expected                                                                                                                             |
| ------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `src/__tests__/reliability/childFriendlyErrors.test.ts` (NEW) | 9 tests | 429/500/timeout show friendly messages; ErrorBoundary no skull for K-2; content safety fails closed for under-13; fails open for 13+ |
| `src/__tests__/performance/imageCaching.test.ts` (NEW)        | 5 tests | Cache after first fetch; serve from cache; LRU eviction; resize params for thumbnails; integration with getSessionImageUrl           |
| `src/__tests__/performance/contextSplitting.test.ts` (NEW)    | 3 tests | Auth change no profile re-render; XP change no auth re-render; correct data per context                                              |
| `src/__tests__/reliability/tokenTruncation.test.ts` (NEW)     | 5 tests | Truncates long stories; preserves recent rounds; preserves narrative elements; short stories verbatim; source verification           |
| `src/__tests__/performance/reDoSProtection.test.ts` (NEW)     | 4 tests | Escapes special chars; no catastrophic backtracking; normal highlighting works; source verification                                  |

- [x] All 26 tests pass

---

## Functional Requirements

- FR-1: The system must not contain any hardcoded API keys, secrets, or tokens in client-side source code
- FR-2: All OpenAI API calls must route through server-side Convex actions with PII scrubbing
- FR-3: Convex actions must implement 30-second timeouts and exponential backoff retry (3 attempts)
- FR-4: All Convex queries returning user-specific data must derive user identity from `ctx.auth`, never from client-supplied arguments
- FR-5: Unauthenticated calls to user-specific queries must throw an error
- FR-6: Admin analytics queries must require an admin role check
- FR-7: The consent flow must not expose `consentToken` or `parentEmail` to non-owner callers
- FR-8: `createSignInToken` must verify the caller's email matches the requested email
- FR-9: No module import may modify `global.requestAnimationFrame` or `global.fetch`
- FR-10: Performance measurements must use real timing APIs, not `Math.random()` or `Date.now() % N`
- FR-11: All singleton services with `setInterval` must expose an idempotent `destroy()` method
- FR-12: XP award on story completion must be idempotent (checked via `lastCompletedSessionId`)
- FR-13: Story saves must write to AsyncStorage WAL before attempting Convex mutation
- FR-14: Failed Convex saves must be queued and replayed on network recovery
- FR-15: `updateSession` mutation must not allow setting `completedAt` or `xpEarned`
- FR-16: `imageGenerationEvents` queries must use the `by_clerk_user` index
- FR-17: No Convex query may use bare `.collect()` without index filtering on large tables
- FR-18: All services must target Convex (not Supabase) for data operations
- FR-19: Error messages displayed to users must be age-appropriate (no technical jargon)
- FR-20: Content safety must fail closed (block content) for under-13 users when moderation API errors
- FR-21: Images must be cached locally with LRU eviction
- FR-22: AuthContext must be split so auth/profile/gamification state changes don't trigger cross-concern re-renders
- FR-23: Story prompts exceeding the AI model's context window must be truncated, preserving recent rounds
- FR-24: User search input must be escaped before use in `RegExp` constructors

## Non-Goals (Out of Scope)

- Migrating entirely off Supabase (legacy user data remains; only active services migrate)
- Adding new features or screens (this is strictly remediation)
- Implementing a full offline mode (WAL covers save failures, not offline-first architecture)
- Replacing Clerk with a different auth provider
- Adding end-to-end encryption
- Redesigning the grade-level system
- Performance optimization of React Native rendering beyond context splitting
- Adding Sentry or external error tracking (unless trivially easy during error logger migration)

## Technical Considerations

- **Convex transactional guarantees:** Convex mutations are automatically transactional. Combining session completion and XP award into a single mutation gives atomicity for free -- no distributed transaction needed.
- **Schema migration:** Adding `lastCompletedSessionId` to `userProfiles` and `by_clerk_user` index to `imageGenerationEvents` requires `npx convex dev` to apply. No data migration needed (field is optional).
- **Breaking change risk:** Removing `clerkUserId` from query args is a breaking change for any client code that passes it. All call sites in `src/` must be updated to omit the arg.
- **AuthContext split risk:** This is a large refactor touching potentially dozens of consumer components. Implement last (Phase 6) to avoid merge conflicts with earlier phases.
- **Test infrastructure:** All new Convex function tests should use `convexMock.ts` from `src/__tests__/mocks/`. The mock needs auth simulation enhancements (ability to set/clear identity) for IDOR testing.
- **Dependency additions:** `jose` library needed for JWT signature verification (US-001). `expo-image` or similar for image caching (US-006).

## Success Metrics

- Zero CRITICAL findings remaining (currently 7)
- Zero HIGH findings remaining (currently 19)
- All 104 validation tests passing in CI
- `grep -r "sk-proj-\|sk_live_\|secretKey" src/` returns zero results
- No `.collect()` without index filtering in `convex/` directory
- All Convex queries for user data derive identity from auth context

## Open Questions

1. **Admin role storage:** Where should admin roles be stored? Options: Clerk metadata, Convex `userProfiles.role` field, or a separate `adminUsers` table. Recommendation: add `role: v.optional(v.string())` to `userProfiles`.
2. **Story Quest API:** Is the Story Quest feature (`storyQuestService.ts`) planned for production, or should it be removed entirely rather than made configurable?
3. **Claude Skills infrastructure:** Given that `claudeSkillsManager.ts` is entirely mocked, should the 7+ dependent services be removed or kept for future implementation?
4. **WAL replay trigger:** Should `replayPendingWrites()` be triggered by `NetInfo` connectivity events, app foreground events, or both?
5. **Image cache size limit:** What is a reasonable max cache size for mobile? Recommendation: 50MB with LRU eviction.
