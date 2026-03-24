# CreativeBridge Code Review — 2026-03-23

## Executive Summary

Three specialized reviewers audited the CreativeBridge codebase (React Native + Expo + Convex kids' storytelling app, K-12) across **security**, **performance**, and **reliability** domains. The review surfaced **48 findings**: 3 critical, 14 high, 17 medium, and 14 low.

**Top 5 Priority Fixes:**

| #   | Finding                                                 | Severity | Domain             | File                                                          |
| --- | ------------------------------------------------------- | -------- | ------------------ | ------------------------------------------------------------- |
| 1   | Hardcoded API keys in source (OpenAI + Supabase)        | CRITICAL | Security           | `src/config/environment.ts:78`, `src/services/supabase.ts:43` |
| 2   | Convex queries lack auth — IDOR exposes children's data | HIGH     | Security           | `convex/gameSessions.ts` (12 queries)                         |
| 3   | `.collect()` full table scans — reliability cliff       | CRITICAL | Perf + Reliability | `convex/gameSessions.ts` (6 queries)                          |
| 4   | XP mutations missing ownership checks                   | HIGH     | Security           | `convex/userProfiles.ts` (7 mutations)                        |
| 5   | `createSignInToken` action — account takeover           | HIGH     | Security           | `convex/auth.ts:202-261`                                      |

**Key cross-reviewer finding:** The `.collect()` pattern in `convex/gameSessions.ts` was independently identified by both performance and reliability reviewers as the #1 infrastructure fix. Performance sees data transfer costs; reliability sees timeout cascades; security sees IDOR exposure. A single remediation addresses all three.

---

## Findings by Domain

---

## 1. Security Review (12 findings)

### CRITICAL

#### SEC-01: Hardcoded OpenAI API Key in Source Code

- **File**: `src/config/environment.ts:78`
- **Description**: Full OpenAI API key (`sk-proj-Hj1RZr...`) hardcoded as `__DEV__` fallback. Committed to git history.
- **Impact**: Anyone with repo access can extract and abuse the key for unlimited API calls. React Native bundlers may not strip `__DEV__` blocks reliably.
- **Recommendation**: Rotate key immediately. Remove hardcoded fallback. Add `sk-` pattern to pre-commit hook. Scrub git history with `git filter-repo`.

#### SEC-02: Hardcoded Supabase URL and Anon Key

- **File**: `src/services/supabase.ts:43-45`
- **Description**: Supabase project URL and full anon key JWT hardcoded as fallbacks. Anon key doesn't expire until 2035.
- **Impact**: Any attacker gets a fully functional Supabase client. Any RLS misconfiguration becomes exploitable.
- **Recommendation**: Remove hardcoded values. Rotate anon key.

### HIGH

#### SEC-03: Client-Side JWT Verification Skips Signature Check

- **File**: `src/services/clerkJWTVerification.ts:146-206`
- **Description**: `verifyJWTSignature` checks expiration and claims but never performs cryptographic signature verification. Comment explicitly states "trust Clerk's token."
- **Impact**: If any code path uses this for authorization decisions, an attacker can forge JWTs. Convex server-side verification is the real guard.
- **Recommendation**: Implement proper crypto verification or mark as "decode-only" and ensure no authorization depends on it.

#### SEC-04: 12 Convex Queries Lack Auth — IDOR Risk

- **File**: `convex/gameSessions.ts:540-1040`, `convex/userProfiles.ts:132-144`, `convex/imageGeneration.ts:405-775`
- **Description**: 12 queries return user-specific data without calling `requireAuth()` or verifying caller identity matches requested `clerkUserId`. `getSession` returns any session by ID with no auth at all.
- **Impact**: Any user can read another child's story content, grade level, session history, and activity patterns. **Especially serious for a kids' app under COPPA.**
- **Recommendation**: Add `requireAuth()` + ownership verification to all user-specific queries.

#### SEC-05: `createSignInToken` — Email-to-Token Bypass

- **File**: `convex/auth.ts:202-261`
- **Description**: Action takes an email and creates a Clerk sign-in token via Backend API. Auth is NOT checked — any caller can request a token for any email.
- **Impact**: Account takeover. Any authenticated user can obtain a sign-in token for any other user's email.
- **Recommendation**: Add `requireAuth(ctx)` + verify email belongs to caller, or restrict to `internalAction`.

#### SEC-06: XP Mutations Lack Ownership Verification

- **File**: `convex/userProfiles.ts:271-776` (7 mutations: `addUserXp`, `refundUserXp`, `updateStreak`, `incrementGamesPlayed`, `incrementStoriesCompleted`, `completeGameSession`, `migrateUserStats`)
- **Description**: These mutations call `requireAuth()` but do not verify the caller's clerkUserId matches `args.clerkUserId`. Compare with `deductUserXp` (line 329-335) which correctly checks.
- **Impact**: Any authenticated user can inflate XP, manipulate streaks, or migrate stats for any other user.
- **Recommendation**: Add ownership check: `if (authClerkId !== args.clerkUserId) throw new Error("Unauthorized");`

### MEDIUM

#### SEC-07: XP State Machine Has No Forward-Only Transition Enforcement

- **File**: `convex/imageGeneration.ts:179-182`
- **Description**: Only checks `if (status === 'refunded')` before allowing updates. No enforcement preventing backward transitions like `success -> pending`.
- **Impact**: When XP deduction is enabled, a crafted client could transition `success -> failed -> refunded` to get both the image and XP back.
- **Recommendation**: Implement transition allowlist: `{ pending: ['success','failed','timeout'], failed: ['refunded'], timeout: ['refunded'] }`.
- **Cross-review**: Confirmed by reliability reviewer. Security agrees with MEDIUM — upgrades to HIGH when XP_DEDUCTION_ENABLED=true.

#### SEC-08: Anomaly Detector Impossible Travel Is a No-Op

- **File**: `src/services/anomalyDetector.ts:369-381`
- **Description**: `checkImpossibleTravel` always returns `{ isAnomalous: false }`.
- **Impact**: Compromised accounts go undetected. Concerning for a kids' app.
- **Recommendation**: Implement GeoIP check or remove from pipeline and document as not implemented.
- **Cross-review**: Confirmed by reliability reviewer.

#### SEC-09: Rate Limiter Fails Open on Error

- **File**: `src/services/rateLimiter.ts:79-80, 96-98`
- **Description**: Both Supabase RPC error and catch block return `createAllowedResult()` — if rate limit check fails, action is allowed.
- **Impact**: During Supabase outages, brute-force protection is disabled.
- **Recommendation**: Fail closed for security-critical actions. Use in-memory fallback counter.

#### SEC-10: Story Content Sent to AI Services Without PII Scrubbing

- **File**: `src/services/openaiClient.ts:217-220`, `src/services/storyGenerationService.ts:1038+`, `src/services/imageGeneration.ts`
- **Description**: Child-written story content (potentially containing real names, locations, school info) sent directly to OpenAI and Replicate. Grade level (age indicator) included in prompts.
- **Impact**: Potential COPPA violation — transmitting children's PII to third parties without parental consent.
- **Recommendation**: Implement PII scrubbing layer. Review AI vendor DPAs for COPPA compliance. Consider parental consent flow for AI features.

### LOW

#### SEC-11: Monolithic AuthContext Exposes XP Operations

- **File**: `src/context/AuthContext.tsx`
- **Description**: `useAuth()` exposes `deductXP`, `refundXP`, `awardOnboardingXP` to all consumers, including components that only need auth state.
- **Impact**: Defense-in-depth concern — increases attack surface from compromised components.
- **Recommendation**: Split into `AuthStateContext`, `UserProfileContext`, `XPContext`.
- **Cross-review**: Performance reviewer also flagged this for re-render reasons.

#### SEC-12: Debug Logging Leaks Configuration Details

- **File**: `src/config/environment.ts:182-195`
- **Description**: `__DEV__` mode logs first 10 chars of Clerk key and full JWKS URL.
- **Impact**: Low — publishable keys are public by design.
- **Recommendation**: Reduce debug logging of configuration values.

---

## 2. Performance Review (20 findings)

### CRITICAL

#### PERF-01: 6 Convex Queries Use `.collect()` + JS Filtering — Full Table Scans

- **File**: `convex/gameSessions.ts:546, 635, 691, 784, 849, 944`
- **Description**: Six queries fetch ALL of a user's sessions (with full `storyContent` — 10-50KB each) via `.collect()`, then filter/sort in JavaScript. `getUserSessions` accepts pagination params but fetches everything. `getStoryLibrary` filters 8 criteria in JS then paginates.
- **Impact**: At 200 stories with 10-50KB content each, queries transfer 2-10MB. All 6 reactive subscriptions re-execute simultaneously on any session change.
- **Recommendation**: (1) Add compound index `['clerkUserId', 'completedAt']`. (2) Use `.filter()` server-side or `.first()` for `getActiveSession`. (3) Use Convex `.paginate()` for real pagination. (4) Project only needed fields — exclude `storyContent` from listing queries.
- **Cross-review**: Joint #1 priority with reliability reviewer. Also has security implications (SEC-04).

### HIGH

#### PERF-02: No Client-Side Image Caching for Story Thumbnails

- **File**: `src/components/story/StorySelectionModal.tsx:321-331`
- **Description**: Images use `<Image source={{ uri }} />` with no cache provider. Android has no caching; iOS only has basic NSURLCache.
- **Impact**: 100 stories = potentially hundreds of redundant network fetches on scroll.
- **Recommendation**: Use `react-native-fast-image` for persistent disk caching.

#### PERF-03: FlatList Missing Performance Optimizations

- **File**: `src/components/story/StorySelectionModal.tsx:765-777`
- **Description**: `removeClippedSubviews={false}` explicitly set. Missing `initialNumToRender`, `maxToRenderPerBatch`, `windowSize`, `getItemLayout`.
- **Impact**: At 100 stories, all cards remain mounted with images and event handlers. Linear memory growth.
- **Recommendation**: Set `removeClippedSubviews={true}`, add `initialNumToRender={10}`, `maxToRenderPerBatch={5}`, `windowSize={5}`, `getItemLayout`.

#### PERF-04: Monolithic AuthContext — 25+ Values, Re-renders All Consumers

- **File**: `src/context/AuthContext.tsx:147-261`
- **Description**: Context value memoized but depends on `userProfile` — any XP change, streak update, or profile change triggers re-render of ALL `useAuth()` consumers.
- **Impact**: Every XP award cascades re-renders through HomeScreen, StorySetupScreen, StorySelectionScreen, and more.
- **Recommendation**: Split into `AuthStateContext`, `UserProfileContext`, `XPContext`.

#### PERF-05: HomeScreen Has 30+ useState Hooks

- **File**: `src/screens/HomeScreen.tsx:91-199`
- **Description**: ~30 state variables in a single flat component. Any `setState` triggers full re-render of the 1000+ line component.
- **Impact**: Typing, toggling speaker, challenge progress — each re-evaluates all memos and render functions.
- **Recommendation**: Extract subsystems (TTS controls, challenge display, celebration modals) into child components.

#### PERF-06: Animated.Value in useState Anti-Pattern

- **File**: `src/screens/HomeScreen.tsx:116-117`
- **Description**: `spinValue` and `fadeValue` use `useState(new Animated.Value(0))` instead of `useRef`. Inconsistent with `keyboardHeight` on line 149 which correctly uses `useRef`.
- **Recommendation**: Use `useRef(new Animated.Value(0)).current` consistently.

#### PERF-07: getImportableStories Runs Filter 3 Times

- **File**: `convex/gameSessions.ts:854-892`
- **Description**: Same filter predicate applied 3x (data, totalCount, hasMore).
- **Recommendation**: Store filtered array once, reuse for count and pagination.

#### PERF-08: getUserStoriesWithImages Also Double-Filters

- **File**: `convex/gameSessions.ts:787-818`
- **Description**: Same pattern as PERF-07 — 3x filter operations.
- **Recommendation**: Filter once, reuse.

### MEDIUM

#### PERF-09: Per-Card imageLoading State Causes Layout Thrashing

- **File**: `src/components/story/StorySelectionModal.tsx:61-62`
- **Description**: Each `StoryCard` has `useState(true)` for `imageLoading`. Image load triggers re-render + layout recalc.
- **Impact**: 10 images loading simultaneously = 10 render cycles in quick succession.
- **Recommendation**: Use overlay approach with fixed-size container.

#### PERF-10: getStoryTitle/getStoryPreview Called Without Memoization

- **File**: `src/components/story/StorySelectionModal.tsx:103-139, 177-178`
- **Description**: String splitting/filtering on every render. `getStoryPreview` calls `getStoryTitle` internally. No memoization.
- **Impact**: 20 visible cards x 2 functions x per-keystroke = 40+ string operations per keystroke.
- **Recommendation**: Wrap with `useMemo` or use `React.memo` on `StoryCard`.

#### PERF-11: highlightSearchTerm Creates RegExp Without Escaping

- **File**: `src/components/story/StorySelectionModal.tsx:158-175`
- **Description**: `new RegExp(`(${term})`, 'gi')` with no escaping. Typing `[` or `(` in search crashes the app.
- **Impact**: App crash on special regex characters. Also a performance issue (regex compilation per render per card).
- **Recommendation**: Escape regex special characters. Memoize compiled regex in parent.

#### PERF-12: Convex Reactive Query Triggers Over-Sync

- **File**: `src/context/AuthContext.tsx:322-360`
- **Description**: Convex reactive subscription fires on any profile field change. Guard only checks 6 of 20+ fields.
- **Impact**: Completing a story updates ~8 fields, triggering full re-render cascade.
- **Recommendation**: Deep comparison or check all fields in the guard.

#### PERF-13: useNativeDriver: false for Keyboard Animations

- **File**: `src/screens/HomeScreen.tsx:537, 555`
- **Description**: Keyboard animations run on JS thread because they animate layout properties.
- **Impact**: Visible jank during active story generation.
- **Recommendation**: Consider `react-native-reanimated` or `LayoutAnimation`.

#### PERF-14: Animated.add Creates New Value Inside useMemo

- **File**: `src/screens/HomeScreen.tsx:150-153`
- **Description**: `new Animated.Value(tabBarHeight + 8)` inside `useMemo` — fragile if `tabBarHeight` changes.
- **Recommendation**: Store base animated value in `useRef`.

#### PERF-15: O(n) Cosine Similarity — Acceptable Now, Not Future-Proof

- **File**: `src/services/cosineSimilarityService.ts:43-96`
- **Description**: 230K floating-point operations per element check at 50 elements x 1536 dimensions. O(n\*d).
- **Impact**: Noticeable at 500+ stories (~1-2 seconds).
- **Recommendation**: Pre-compute magnitudes, use Float32Array, consider server-side vector search.

#### PERF-16: StoryInputDebouncer Stale Reference on Dependency Change

- **File**: `src/screens/HomeScreen.tsx:478-526`
- **Description**: Debouncer created in `useEffect` with `useState` — stale reference window between cleanup and new creation.
- **Recommendation**: Use `useRef` for the debouncer.

#### PERF-17: Embedding Cache Uses FIFO, Not LRU

- **File**: `src/services/embeddingGenerationService.ts:264-284`
- **Description**: Eviction removes first Map key (insertion order), not least-recently-used.
- **Impact**: Frequently-used embeddings evicted while rare ones persist.
- **Recommendation**: On cache hit, delete and re-insert key to implement true LRU.

#### PERF-18: 1000-Entry Embedding Cache = ~12MB Memory

- **File**: `src/services/embeddingGenerationService.ts:42`
- **Description**: 1000 entries x 1536 x 8 bytes = ~12MB singleton in memory.
- **Recommendation**: Reduce to 200-300 entries or use Float32Array.

#### PERF-19: imageStorageService Naming Misleads

- **File**: `src/services/imageStorageService.ts:106-268`
- **Description**: `uploadImageToSupabase` actually calls `uploadImageToConvex`. Dead dual-write code.
- **Recommendation**: Rename to match behavior. Remove dead code.

### LOW

#### PERF-20: 30-Second setInterval for TTS Availability

- **File**: `src/screens/HomeScreen.tsx:767-774`
- **Description**: Polls TTS availability every 30s. TTS state rarely changes.
- **Recommendation**: Check on AppState change instead.

---

## 3. Reliability Review (16 findings)

### HIGH

#### REL-01: OpenAI fetch() Has No Timeout

- **File**: `src/services/openaiClient.ts:72`
- **Description**: `createChatCompletion` uses bare `fetch()` with no AbortController. Hangs indefinitely if OpenAI is unresponsive.
- **Impact**: User sees infinite spinner with no recovery path.
- **Recommendation**: Add `AbortSignal.timeout(30000)`.

#### REL-02: No Retry for OpenAI 429 Rate Limits

- **File**: `src/services/storyGenerationService.ts:237-253`
- **Description**: All OpenAI errors treated identically — 429 rate limits immediately fall back to template stories instead of retrying.
- **Impact**: Transient rate limits degrade to canned stories unnecessarily.
- **Recommendation**: Add rate-limit-specific retry with exponential backoff.

#### REL-03: Image Generation Polling — No Exponential Backoff

- **File**: `src/services/imageGeneration.ts:1242-1319`
- **Description**: Fixed 1-second polling for up to 60 attempts. No backoff.
- **Impact**: 60 API requests per image generation. Under concurrent load, risks Replicate rate limits.
- **Recommendation**: Exponential backoff 1s -> 2s -> 4s -> 5s cap. Reduces to ~15 requests.
- **Cross-review**: Performance reviewer confirmed and added addendum.

#### REL-04: XP State Machine — No Transition Enforcement

- **File**: `convex/imageGeneration.ts:179-182`
- **Description**: Only guards against `refunded` status. No forward-only enforcement.
- **Impact**: Data integrity risk. When XP deduction is enabled, allows gaming of refund system.
- **Cross-review**: Security reviewer confirmed. See SEC-07.

#### REL-05: XP Beta Flag Masks Critical Logic Path

- **File**: `convex/imageGeneration.ts:39`
- **Description**: `XP_DEDUCTION_ENABLED = false` means the entire deduction/refund flow is untested in production. The flag is read separately in create and update mutations — if flipped mid-flight, deduction could happen without matching refund path.
- **Recommendation**: Test full cycle E2E before enabling. Use Convex env var instead of code constant.

### MEDIUM

#### REL-06: XP Double-Award Risk on Client Retry

- **File**: `src/services/xpEventTracker.ts:57-106`
- **Description**: If Convex mutation succeeds but response is lost (network timeout), client retries and creates a duplicate event with second XP deduction.
- **Recommendation**: Add idempotency key (`sessionId + timestamp`).
- **Cross-review**: Security reviewer partially confirmed.

#### REL-07: Story Context Truncation Without Summarization

- **File**: `src/services/storyGenerationService.ts:1126-1133`
- **Description**: Long stories truncated to last 8000 characters with `'...' + substring()`. Drops beginning — character introductions, world-building, initial plot.
- **Impact**: Continuation quality degrades. Especially bad for imported stories.
- **Recommendation**: Extract summary of key elements before truncation. `analyzeImportedStory` already extracts characters/settings — cache and prepend.

#### REL-08: Download Queue Lost on App Crash

- **File**: `src/services/enhancedErrorHandling.ts:65-66`, `src/services/networkMonitor.ts:165-183`
- **Description**: Queue persisted to AsyncStorage, but in-flight items lost if app crashes during processing. Queue state saved only after entire batch completes.
- **Recommendation**: Mark items as "processing" before starting. Save state after each item.

#### REL-09: api.ts Dual Timeout — Belt-and-Suspenders Bug

- **File**: `src/services/api.ts:297-311`
- **Description**: Uses BOTH `setTimeout(() => { throw })` AND `AbortSignal.timeout()`. The `setTimeout` throw is uncatchable in global scope — could crash the app. `AbortSignal.timeout` is the correct mechanism.
- **Impact**: Potential uncaught exception crash on older RN runtimes where AbortSignal isn't supported.
- **Recommendation**: Remove the `setTimeout` on lines 297-299.

#### REL-10: Logger Buffer — Data Loss on Crash

- **File**: `src/utils/logger.ts:42-43`
- **Description**: Logs buffer 1000 entries or 30 seconds before flushing. Crash loses all buffered logs.
- **Impact**: Critical error logs preceding a crash are the most valuable and most likely to be lost.
- **Recommendation**: Flush immediately on ERROR/CRITICAL levels. Buffer only DEBUG/INFO.

#### REL-11: Claude Skills — Entirely Mock Implementation

- **File**: `src/services/claudeSkillsManager.ts:19-21`
- **Description**: All execution returns hardcoded mock data. Monitor records mock metrics as real, skewing baselines.
- **Recommendation**: When integrating real SDK, reset metrics and add `isMock` flag to events.

### LOW

#### REL-12: Service Health Only Monitors Mock Services

- **File**: `src/services/serviceHealth.ts:296-302`
- **Description**: `initializeServiceTracking()` only monitors Claude Skills services. OpenAI, Replicate, and Convex are NOT monitored.
- **Recommendation**: Extend to track actual production dependencies.

#### REL-13: Service Health Error Response Time Bug

- **File**: `src/services/serviceHealth.ts:268`
- **Description**: `Date.now() - Date.now()` always evaluates to ~0. `startTime` variable out of scope in catch block.
- **Recommendation**: Capture `startTime` before try block.

#### REL-14: Error Boundary Only Catches Sync Errors

- **File**: `src/components/common/ErrorBoundary.tsx`
- **Description**: React ErrorBoundary catches render errors but not async errors (promise rejections).
- **Recommendation**: Add global unhandled promise rejection handler.

#### REL-15: Anomaly Detector Is Security-Only, Supabase-Dependent

- **File**: `src/services/anomalyDetector.ts`
- **Description**: Focuses on security anomalies only. Depends on legacy Supabase `audit_logs` table.
- **Cross-review**: Security reviewer flagged impossible travel as no-op (SEC-08).

#### REL-16: resetSessionForContinuation — No Content Validation

- **File**: `convex/gameSessions.ts:217-233`
- **Description**: Clears stats but doesn't verify `storyContent` still exists before reset.
- **Recommendation**: Add validation that `session.storyContent` is non-empty.

---

## Cross-Reviewer Consensus

### Joint Finding: `.collect()` Pattern Is #1 Priority Fix

**Agreed by**: Performance + Reliability + Security reviewers

The `convex/gameSessions.ts` `.collect()` pattern is the highest-impact issue across all three domains:

- **Performance**: 2-10MB data transfer per query at scale
- **Reliability**: Timeout cascades amplified by retry logic
- **Security**: Missing auth on these queries exposes children's data (IDOR)

**Recommended single-pass fix:**

1. Add compound index `['clerkUserId', 'completedAt']` to schema
2. Switch `getActiveSession` to `.filter().first()` server-side
3. Switch `getUserSessions` to Convex `.paginate()`
4. Exclude `storyContent` from listing queries
5. Add `requireAuth()` + ownership checks to all queries

### Joint Finding: XP System Needs Hardening Before Production

**Agreed by**: Security + Reliability reviewers

Multiple overlapping issues when `XP_DEDUCTION_ENABLED` is flipped to `true`:

- No ownership verification on 7 mutations (SEC-06)
- No state machine transition enforcement (SEC-07/REL-04)
- Beta flag masks untested code paths (REL-05)
- Client retry can double-deduct (REL-06)

---

## Recommended Fix Priority

### Immediate (before next deploy)

1. **Rotate hardcoded API keys** — OpenAI and Supabase (SEC-01, SEC-02)
2. **Restrict `createSignInToken`** to internal action (SEC-05)
3. **Add auth + ownership checks** to all Convex queries (SEC-04)

### High Priority (this sprint)

4. **Add ownership verification** to XP mutations (SEC-06)
5. **Fix `.collect()` queries** — indexes, server-side filtering, real pagination (PERF-01/REL-05)
6. **Add fetch timeout** to OpenAI client (REL-01)
7. **Add exponential backoff** to Replicate polling (REL-03)
8. **Implement XP state machine** before enabling deduction (SEC-07/REL-04)

### Medium Priority (next sprint)

9. **Split AuthContext** into smaller contexts (PERF-04/SEC-11)
10. **Add image caching** via `react-native-fast-image` (PERF-02)
11. **Optimize FlatList** in StorySelectionModal (PERF-03)
12. **Implement PII scrubbing** before AI API calls (SEC-10)
13. **Fix rate limiter** to fail closed (SEC-09)
14. **Add story context summarization** for long continuations (REL-07)
15. **Remove dual timeout bug** in api.ts (REL-09)

### Low Priority (backlog)

16. Extract HomeScreen subsystems into child components (PERF-05)
17. Fix embedding cache to true LRU (PERF-17)
18. Extend service health to monitor real services (REL-12)
19. Implement impossible travel check or remove (SEC-08)
20. Add global unhandled promise rejection handler (REL-14)

---

## Review Metadata

| Reviewer             | Findings                                 | Duration |
| -------------------- | ---------------------------------------- | -------- |
| security-reviewer    | 12 (2 critical, 4 high, 4 medium, 2 low) | ~3 min   |
| perf-reviewer        | 20 (1 critical, 7 high, 9 medium, 3 low) | ~5 min   |
| reliability-reviewer | 16 (5 high, 6 medium, 5 low)             | ~5 min   |
| **Total**            | **48 findings**                          |          |

Cross-review messages exchanged: 6 (2 challenges, 4 confirmations/addendums)
