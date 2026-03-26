# CreativeBridge Code Review — 2026-03-25

**Reviewers**: Security, Performance, Reliability (automated agent team)
**Model**: Claude Opus 4.6
**Codebase**: React Native 0.81.5 + Expo 54 + Convex + Clerk OAuth + OpenAI + Replicate

---

## Executive Summary

| Severity  | Security | Performance | Reliability | Total  |
| --------- | -------- | ----------- | ----------- | ------ |
| CRITICAL  | 2        | 5           | 0           | **7**  |
| HIGH      | 4        | 10          | 5           | **19** |
| MEDIUM    | 12       | 6           | 10          | **28** |
| LOW       | 5        | 2           | 5           | **12** |
| **Total** | **23**   | **23**      | **20**      | **66** |

### Top 5 Priorities

1. **Remove hardcoded API keys** (Security CRITICAL) — OpenAI `sk-proj-*` key and Supabase anon key are embedded in client source code.
2. **Move OpenAI calls server-side** (Security HIGH + Reliability HIGH) — Client-side API calls expose the key, leak child PII, and have no timeouts or retries.
3. **Remove global monkey-patching** (Performance CRITICAL) — `performanceOptimizer.ts` wraps every `requestAnimationFrame` and `fetch` call in the app.
4. **Fix Convex IDOR vulnerabilities** (Security MEDIUM x6) — Queries accept `clerkUserId` from client without ownership verification.
5. **Make XP transactions atomic** (Reliability HIGH) — Story completion and XP award are separate mutations with no idempotency guard.

---

## Part 1: Security Findings

### 1.1 Credential & Secret Management

#### [CRITICAL] Hardcoded OpenAI API Key in Source Code

- **File**: `src/config/environment.ts:76`
- **Description**: Full OpenAI API key (`sk-proj-Hj1RZrZcfee4R...`) hardcoded as dev fallback, embedded in the client JS bundle.
- **Risk**: Anyone decompiling the app can extract this key. Attacker could make unlimited OpenAI API calls, potentially generating inappropriate content under the project's account. COPPA-violating content could be attributed to the project.
- **Recommendation**: Remove the hardcoded key. Route all OpenAI calls through Convex actions with the key in server-side env vars only.

#### [CRITICAL] Hardcoded Supabase Anon Key in Source Code

- **Files**: `src/services/supabase.ts:45`, `src/services/environment.ts:114,241`
- **Description**: Supabase anonymous key JWT and project URL hardcoded in multiple source files.
- **Risk**: If any RLS policy has a gap, hardcoded credentials give attackers a known target to enumerate endpoints.
- **Recommendation**: Load from environment variables only. Never commit keys to source.

#### [HIGH] Clerk Secret Key Available in Client Config

- **File**: `src/config/environment.ts:90`
- **Description**: Environment config includes `clerk.secretKey` from `CLERK_SECRET_KEY`. If set during build, it embeds in the client bundle.
- **Risk**: Complete account takeover — attacker can create sign-in tokens for any user.
- **Recommendation**: Remove `secretKey` from client-side `EnvironmentConfig` entirely.

### 1.2 Authentication & Authorization

#### [HIGH] createSignInToken Action Lacks Caller Authorization

- **File**: `convex/auth.ts:202-261`
- **Description**: Accepts an `email` argument and creates a Clerk sign-in token without verifying the caller is the same user.
- **Risk**: Any authenticated user can generate sign-in tokens for any other user's account.
- **Recommendation**: Verify authenticated caller's email matches `args.email`, or restrict to internal-only.

#### [HIGH] JWT Signature Not Cryptographically Verified on Client

- **File**: `src/services/clerkJWTVerification.ts:146-206`
- **Description**: Checks expiration and issuer substring (`payload.iss.includes('clerk')`) but does not verify RSA/EC signature.
- **Risk**: Forged JWTs accepted by client-side code. Convex validates server-side, but client-side security decisions are vulnerable.
- **Recommendation**: Use `jose` library for proper verification, or document this is not a security boundary.

#### [MEDIUM] IDOR: Queries Accept clerkUserId Without Ownership Verification (6 instances)

- **Files**:
  - `convex/gameSessions.ts:561-577` (`getActiveSession`)
  - `convex/gameSessions.ts:638-677` (`getUserSessions`)
  - `convex/gameSessions.ts:693-776` (`searchUserStories`)
  - `convex/gameSessions.ts:791-840` (`getUserStoriesWithImages`)
  - `convex/gameSessions.ts:855-913` (`getImportableStories`)
  - `convex/gameSessions.ts:929-1061` (`getStoryLibrary`)
  - `convex/imageGeneration.ts:349-397` (`getUserImageGenerationEvents`)
  - `convex/imageGeneration.ts:710-742` (`checkXpForImageGeneration`)
  - `convex/userProfiles.ts:144-156` (`getProfileByClerkId`)
  - `convex/consent.ts:58-82` (`getConsentStatus`)
- **Description**: Queries return user data based on client-supplied `clerkUserId` without verifying caller ownership.
- **Risk**: Authenticated user can read another user's stories, XP, consent status, and profile.
- **Recommendation**: Derive clerkUserId from auth context instead of accepting it as an argument.

#### [MEDIUM] getSession Query Has No Auth Check

- **File**: `convex/gameSessions.ts:586-593`
- **Description**: Returns full session data (including story content) for any session ID with no authentication.
- **Recommendation**: Add auth check and session ownership verification.

#### [MEDIUM] getImageGenerationEvent Query Has No Auth Check

- **File**: `convex/imageGeneration.ts:405-434`
- **Description**: Returns event details including `clerkUserId`, `promptUsed`, and metadata for any event ID.
- **Recommendation**: Add auth check and ownership verification.

#### [MEDIUM] Admin Queries Lack Role-Based Access Control

- **Files**: `convex/imageGeneration.ts:479-623,633-700,751-775`
- **Description**: "Admin-level" queries (`getImageGenerationAnalytics`, `getDailyImageGenerationStats`, `getRecentImageGenerationEvents`) have no auth or role check.
- **Risk**: Any client can query aggregated analytics across all users.
- **Recommendation**: Add admin role checking or restrict to internal queries.

#### [MEDIUM] verifyAndGrantConsent Has No Auth Requirement

- **File**: `convex/consent.ts:299-361`
- **Description**: Public mutation accepts a consent token and grants consent without authentication.
- **Risk**: Intercepted consent token allows anyone to grant consent for a child.
- **Recommendation**: Require additional verification (e.g., parent email match).

#### [MEDIUM] Migration Mutation Does Not Verify Caller Matches clerkUserId

- **File**: `convex/migration.ts:3536-3561`
- **Description**: `migrateUserGameSessions` uses `requireAuth()` but doesn't verify caller owns `args.clerkUserId`.
- **Risk**: Authenticated user could inject data into another user's session history.
- **Recommendation**: Add ownership verification.

#### [LOW] logMigrationEvent Stores Email Without Auth Enforcement

- **File**: `convex/migration.ts:3660-3688`

### 1.3 PII Protection (COPPA-Critical)

#### [HIGH] Child Story Content Sent Directly from Client to OpenAI

- **File**: `src/services/openaiClient.ts:53-115`
- **Description**: OpenAI client runs on-device, sending story prompts (containing children's creative writing) directly to OpenAI with no server-side PII scrubbing.
- **Risk**: If a child includes personal information (name, school, address), PII goes directly to OpenAI. COPPA requires reasonable procedures to protect children's personal information.
- **Recommendation**: Route through Convex actions with PII scrubbing before external API calls.

#### [MEDIUM] Consent Token Returned to Client After Submission

- **File**: `convex/consent.ts:284-289`
- **Description**: `submitParentEmail` returns the `consentToken` to the client, which could let a child grant consent themselves.
- **Recommendation**: Only communicate token via parent email.

#### [MEDIUM] Parent Email Exposed in getConsentStatus Query

- **File**: `convex/consent.ts:58-82`
- **Description**: Returns `parentEmail` and `consentToken` with no auth check. Combined with IDOR, exposes parent PII.
- **Recommendation**: Remove `consentToken` from response; restrict `parentEmail` to authenticated owner.

#### [MEDIUM] Image Prompts Stored Without PII Scrubbing

- **File**: `convex/imageGeneration.ts:126`
- **Description**: Full prompt (derived from children's stories) stored in `promptUsed` field, accessible via unprotected analytics queries.
- **Recommendation**: Strip PII before storage or restrict access.

#### [LOW] Speech Recognition — On-Device Only (No Issue)

- **File**: `src/services/nativeSpeechRecognizer.ts`
- Uses iOS `SFSpeechRecognizer` on-device. No audio transmitted externally.

#### [LOW] TTS — On-Device Only (No Issue)

- **Files**: `src/services/textToSpeech.ts`, `src/services/textToSpeechSafe.ts`
- Uses `react-native-tts` (native engine). No ElevenLabs cloud service detected.

### 1.4 API Security

#### [MEDIUM] OpenAI API Calls Made Directly from Client

- **Files**: `src/services/openaiClient.ts`, `src/services/contentSafetyService.ts:73`
- **Description**: API key in `Authorization` header of every client-side request. No server-side rate limiting.
- **Recommendation**: Move to Convex actions with per-user rate limiting.

#### [LOW] Content Safety Service Fails Open

- **File**: `src/services/contentSafetyService.ts:106-116`
- **Description**: If OpenAI Moderation API errors, content passes through unchecked.
- **Recommendation**: Fail closed for under-13 users.

### 1.5 Token & Logging

#### [MEDIUM] Clerk Token Key Names Logged to Console

- **File**: `src/utils/clerkTokenCache.ts:137-139,166-168`
- **Recommendation**: Gate behind `__DEV__`.

#### [LOW] Verbose Console Logging Throughout Auth Flow

- **File**: `src/context/AuthContext.tsx` (multiple lines)
- **Recommendation**: Gate all `console.log` behind `__DEV__`.

### 1.6 Supabase Legacy

#### [MEDIUM] Supabase Session Uses In-Memory Fallback

- **File**: `src/services/supabase.ts:7-38`
- **Recommendation**: Warn in production if fallback triggered.

---

## Part 2: Performance Findings

### 2.1 Critical: Performance Anti-Patterns

#### [CRITICAL] Global requestAnimationFrame and fetch Monkey-Patching

- **File**: `src/services/performanceOptimizer.ts:246,270`
- **Description**: Wraps every `requestAnimationFrame` and `fetch` call globally at module init.
- **Impact**: Adds overhead to every animation frame (16ms budget at 60fps) and every network request.
- **Recommendation**: Remove monkey-patching entirely. Use targeted instrumentation if needed.

#### [CRITICAL] performanceTuner Uses Math.random() for Measurements

- **File**: `src/services/performanceTuner.ts:567-591`
- **Description**: Performance measurements use `Math.random()` instead of real timing. Auto-tuning decisions (cache sizes, batch sizes) are based on random data.
- **Impact**: Random configuration changes that could degrade performance unpredictably.
- **Recommendation**: Implement real measurements with `performance.now()` or disable auto-tuning entirely.

#### [CRITICAL] Singleton Service Timers Never Destroyed

- **Files**: `src/services/storyCache.ts:432,511`, `src/services/predictiveStoryCache.ts:639,648`, `src/services/performanceOptimizer.ts:176-178`, `src/services/uiPerformanceMonitor.ts:526`
- **Description**: Multiple singletons create `setInterval` timers at module init. No `destroy()` calls in app lifecycle.
- **Impact**: Timers accumulate on hot reloads. Run indefinitely even when features aren't active.
- **Recommendation**: Tie lifecycle to React components or use lazy initialization.

#### [CRITICAL] imageGenerationEvents Queried by Wrong Index

- **File**: `convex/imageGeneration.ts:356`
- **Description**: Uses `.withIndex('by_user')` (indexes `userId`) but filters by `clerkUserId`. Full table scan.
- **Recommendation**: Add `by_clerk_user` index on `clerkUserId`.

#### [CRITICAL] Full Table Scan in getImageGenerationAnalytics

- **File**: `convex/imageGeneration.ts:487`
- **Description**: `ctx.db.query('imageGenerationEvents').collect()` retrieves every row, then filters in JS.
- **Recommendation**: Add indexes and use `.withIndex()` with range filters.

### 2.2 High: Rendering & Memory

#### [HIGH] HomeScreen: 30+ useState Hooks, Animated.Value Anti-Pattern

- **File**: `src/screens/HomeScreen.tsx:102-196`
- **Description**: 30+ `useState` hooks in one component. `Animated.Value` created in `useMemo` recreated on dep changes.
- **Impact**: Every state change re-renders the entire large component tree.
- **Recommendation**: Extract sub-sections into memoized children. Use `useRef` for Animated values.

#### [HIGH] Monolithic AuthContext (148KB Single File)

- **File**: `src/context/AuthContext.tsx`
- **Description**: All auth state in one context. Any change triggers all consumers to re-render.
- **Impact**: Components needing only `isAuthenticated` re-render on unrelated profile/XP changes.
- **Recommendation**: Split into AuthContext, UserProfileContext, GamificationContext.

#### [HIGH] No Client-Side Image Caching

- **File**: `src/services/imageStorageService.ts:426`
- **Description**: Images downloaded as full ArrayBuffer with no cache. Every view triggers a fresh download. Max 10MB with no mobile optimization.
- **Recommendation**: Use `expo-image` (built-in caching) or `react-native-fast-image`. Add server-side resizing.

#### [HIGH] Client-Side Full-Text Search Fetches All Records

- **File**: `src/services/advancedSearchService.ts:112-123,157-161`
- **Description**: Fetches ALL stories from Supabase, then searches/ranks/filters in client JS.
- **Recommendation**: Use PostgreSQL `tsvector`/`tsquery` or Convex text search server-side.

#### [HIGH] Unbounded usagePatterns Growth in predictiveStoryCache

- **File**: `src/services/predictiveStoryCache.ts:59`
- **Description**: No limit on keys in the `usagePatterns` Map. Memory grows linearly with unique content accessed.
- **Recommendation**: Add max key count with LRU eviction.

#### [HIGH] Embedding Cache: ~6MB Memory Footprint

- **File**: `src/services/embeddingGenerationService.ts`
- **Description**: 1000 entries x 1536 floats x ~6KB = ~6MB. Plus verbose console.log on every cache hit/miss in production.
- **Recommendation**: Reduce to 100-200 entries on mobile. Gate logging behind `__DEV__`.

#### [HIGH] Full Table Scans in adminAnalytics

- **File**: `convex/adminAnalytics.ts:112-113`
- **Description**: `.collect()` on `userProfiles` and `gameSessions` without index filtering.
- **Recommendation**: Pre-computed summary documents updated by mutations.

#### [HIGH] getDailyImageGenerationStats Lacks Index

- **File**: `convex/imageGeneration.ts:643`
- **Description**: Filters by `_creationTime` range without index, then filters by `clerkUserId` in JS.
- **Recommendation**: Add composite index on `(clerkUserId, _creationTime)`.

#### [HIGH] getUserStoryStats Fetches 1000 Records Client-Side

- **File**: `src/services/storyManagementService.ts:811`
- **Description**: Fetches up to 1000 game sessions and computes aggregates in client JS.
- **Recommendation**: Create server-side aggregation query.

#### [HIGH] Meaningless Memory Usage Estimates

- **Files**: `src/services/performanceOptimizer.ts:200`, `src/services/downloadPerformanceMonitor.ts:226`
- **Description**: Uses `Date.now() % 100000` as "memory estimation" — produces random numbers.
- **Recommendation**: Use `expo-device` for real data or remove the feature.

#### [HIGH] 6 Concurrent Performance Monitoring Services

- **Files**: `performanceOptimizer.ts`, `performanceService.ts`, `performanceTuner.ts`, `uiPerformanceMonitor.ts`, `resourceManager.ts`, `downloadPerformanceMonitor.ts`
- **Description**: Six singletons with their own timers, caches, and metric storage. Several use fake data.
- **Impact**: Observer effect — monitoring overhead likely exceeds the problems being monitored.
- **Recommendation**: Consolidate into one lightweight service. Disable by default.

### 2.3 Medium

#### [MEDIUM] Unmemoized Callbacks in StorySelectionScreen

- **File**: `src/screens/StorySelectionScreen.tsx:31,55`
- **Recommendation**: Wrap in `useCallback`.

#### [MEDIUM] Unmemoized Callbacks in StoryPreviewEditScreen

- **File**: `src/screens/StoryPreviewEditScreen.tsx:47-145`
- **Recommendation**: Wrap in `useCallback`.

#### [MEDIUM] Stop Word Set Recreated on Every Call

- **File**: `src/services/advancedSearchService.ts:464`
- **Recommendation**: Move to module scope constant.

#### [MEDIUM] Potential ReDoS in highlightMatches

- **File**: `src/services/advancedSearchService.ts:644`
- **Description**: Creates regex from unescaped user input. Crafted input can cause catastrophic backtracking.
- **Recommendation**: Escape regex special characters or use string matching.

#### [MEDIUM] Cosine Similarity Uses Three Separate Loops

- **File**: `src/services/cosineSimilarityService.ts:63-79`
- **Description**: Three passes over 1536-dimension vectors instead of one combined loop.
- **Recommendation**: Single-loop implementation.

#### [MEDIUM] HomeScreen setTimeout Without Cleanup

- **File**: `src/screens/HomeScreen.tsx:453`
- **Description**: Chained `setTimeout` without storing IDs for cleanup on unmount.
- **Recommendation**: Store in ref, clear in useEffect cleanup.

### 2.4 Low

#### [LOW] Inline Render Functions in StorySetupScreen

- **File**: `src/screens/StorySetupScreen.tsx:739`
- **Recommendation**: Move static data to module scope.

#### [LOW] Dead Code in similarityDetectionService

- **File**: `src/services/similarityDetectionService.ts:77-146`

---

## Part 3: Reliability Findings

### 3.1 AI Service Error Handling

#### [HIGH] OpenAI Client Has No Request Timeout

- **File**: `src/services/openaiClient.ts:72`
- **Description**: `fetch()` to OpenAI has no `AbortController` or timeout. If OpenAI hangs, the request waits indefinitely.
- **Impact**: Child sees infinite spinner with no recovery.
- **Recommendation**: 30-second `AbortController` timeout. "Taking longer than expected" message after 10 seconds.

#### [HIGH] No Retry Logic on Primary Story Generation Path

- **File**: `src/services/openaiClient.ts:118-151`
- **Description**: `generateStoryCompletion()` has zero retry logic. Only `analyzeStoryForImageGeneration()` has retries.
- **Impact**: Single transient 500 error kills story generation. Child must manually retry.
- **Recommendation**: Exponential backoff (2-3 attempts) for 429 and 5xx errors.

#### [MEDIUM] Error Messages Not Child-Friendly

- **File**: `src/services/openaiClient.ts:87-99`
- **Description**: Messages like "OpenAI API rate limit exceeded" bubble to UI.
- **Recommendation**: Age-appropriate messages: "Our story helper is taking a break! Let's try again in a moment."

#### [LOW] Claude Skills Manager Is Entirely Mocked

- **File**: `src/services/claudeSkillsManager.ts:19`
- 7+ services built on mock implementation returning hardcoded data.

### 3.2 Service Health Monitoring

#### [MEDIUM] ServiceHealthMonitor Only Monitors Claude Skills, Not Actual AI Services

- **File**: `src/services/serviceHealth.ts:296-307`
- **Description**: Monitors `claude_skills_api` derivatives but not OpenAI or Replicate. Reports "healthy" even if OpenAI is down.
- **Recommendation**: Track success/failure rates of actual API calls.

#### [MEDIUM] MonitoringService Queries Supabase But Data Lives in Convex

- **File**: `src/services/monitoringService.ts:149`
- **Description**: Queries `supabase.from('image_generation_events')` but events are in Convex. Always returns zero.
- **Recommendation**: Migrate to Convex `getImageGenerationAnalytics` query.

#### [LOW] ClaudeSkillsMonitor Uploads to Possibly Non-Existent Supabase Table

- **File**: `src/services/claudeSkillsMonitor.ts:755-762`

### 3.3 Network Resilience

#### [HIGH] No Offline Story Save or Local Fallback on Network Failure

- **File**: `src/services/storyManagementService.ts:177-179`
- **Description**: `saveStory()` returns `{ success: false }` if Convex unavailable. No AsyncStorage queue or retry.
- **Impact**: Child loses story work if save coincides with network blip.
- **Recommendation**: Write-ahead log to AsyncStorage. Queue failed saves for retry on connectivity.

#### [MEDIUM] storySessionManager Silently Swallows Update Failures

- **File**: `src/services/storySessionManager.ts:606-611`
- **Description**: Failed `updateSession` returns cached data with only `console.error`. User not informed.
- **Recommendation**: Visual "saving..."/"saved"/"offline" indicator. Persist pending updates.

#### [MEDIUM] SyncService Uses Supabase Exclusively, Ignoring Convex Migration

- **File**: `src/services/syncService.ts:9`
- **Description**: Sync targets Supabase while data lives in Convex. Cross-device sync broken for Convex users.
- **Recommendation**: Migrate to Convex reactive queries or disable.

#### [LOW] NetworkMonitor Does Not Auto-Initialize

- **File**: `src/services/networkMonitor.ts:29-33`
- **Recommendation**: Auto-initialize in constructor or verify startup sequence.

### 3.4 XP Transaction Atomicity

#### [HIGH] XP Award Is Non-Atomic With No Idempotency Guard

- **Files**: `src/services/storySessionManager.ts:1097-1105`, `convex/userProfiles.ts:697-769`
- **Description**: Two separate mutations: `gameSessions.completeSession` (marks done, records XP) and `userProfiles.completeGameSession` (adds XP to profile). Not in a single transaction. No "already awarded" check — simply adds `args.xpEarned` to `totalXp`.
- **Impact**: Children can lose XP (second mutation fails) or receive double XP (retry succeeds twice).
- **Recommendation**: Add `lastCompletedSessionId` to userProfiles for idempotency. Combine into single Convex mutation.

#### [MEDIUM] Image Generation XP Deduction Disabled During Beta

- **File**: `convex/imageGeneration.ts:39`
- **Description**: `XP_DEDUCTION_ENABLED = false` with TODO for production. Read-then-write pattern susceptible to race conditions.
- **Recommendation**: Test thoroughly before enabling. Use Convex transactional guarantees.

#### [MEDIUM] completeSession Guard Bypassable via updateSession

- **File**: `convex/gameSessions.ts:370-371`
- **Description**: Double-completion guard exists in `completeSession` but client may use generic `updateSession` instead.
- **Recommendation**: Ensure all completion paths go through `completeSession`.

### 3.5 Story Continuation Integrity

#### [HIGH] Story Content Lost if Convex Update Fails Mid-Continuation

- **File**: `src/services/storySessionManager.ts:606-611`
- **Description**: Failed updates fall back to AsyncStorage cache only. App crash or force-close loses continuation.
- **Impact**: Child's creative work and AI response lost after multi-round investment.
- **Recommendation**: Write-ahead log persisting pending mutations before attempting Convex call.

#### [MEDIUM] No Token-Aware Truncation for Long Stories

- **File**: `src/services/storyAgent.ts`
- **Description**: `storySoFar` passed directly to OpenAI without token-aware truncation. After 5+ rounds, combined prompt may exceed context window.
- **Recommendation**: Smart truncation preserving recent context and key narrative elements.

#### [LOW] StoryCache 20-Minute TTL May Be Too Short

- **File**: `src/services/storyCache.ts:53`
- **Recommendation**: Extend to 60 minutes for active sessions.

### 3.6 Error Infrastructure

#### [MEDIUM] ErrorBoundary Shows Technical Crash UI to Children

- **File**: `src/components/common/ErrorBoundary.tsx:127-130`
- **Description**: Skull emoji and formal language inappropriate for K-2 students.
- **Recommendation**: Grade-level-aware error messages with friendly illustrations.

#### [MEDIUM] Error Logging Routes to Supabase (May Not Be Active Backend)

- **File**: `src/services/errorLogger.ts:8`
- **Recommendation**: Route to Convex or external service (Sentry).

#### [LOW] PostGenerationStorageService Skips All Convex Sessions

- **File**: `src/services/postGenerationStorageService.ts:105-122`
- **Description**: Checks `isValidUUID(sessionId)` and skips Convex IDs. Diversity tracking not operational for current users.

### 3.7 Data Persistence

#### [HIGH] AsyncStorageWrapper Falls Back to Volatile In-Memory Storage

- **File**: `src/utils/asyncStorageWrapper.ts:18`
- **Description**: If native AsyncStorage unavailable, uses `Map`. All cached data lost on app close.
- **Impact**: Download queues, story cache, sync changes silently lost on restart.
- **Recommendation**: Detect and propagate degraded mode. Consider SQLite/MMKV as secondary fallback.

#### [MEDIUM] Data Retention Cleanup Loads Entire Tables Into Memory

- **File**: `convex/dataRetention.ts:68`
- **Description**: `ctx.db.query('gameSessions').collect()` loads ALL sessions. Same for imageGenerationEvents and migrationEvents.
- **Recommendation**: Use `.filter()` with creation time or paginate.

#### [MEDIUM] StoryQuestService Hardcodes localhost URL

- **File**: `src/services/storyQuestService.ts:12`
- **Description**: `STORY_QUEST_API_BASE = 'http://localhost:5000/api'` — no production URL.
- **Recommendation**: Move to env config or disable behind feature flag.

---

## Cross-Reviewer Observations

### Overlapping Findings (Security + Reliability)

- **OpenAI client-side calls**: Security flags PII exposure; Reliability flags missing timeouts/retries. Both recommend moving to Convex actions — a single fix addresses both.
- **Supabase/Convex migration gap**: Security notes credential exposure in Supabase config; Reliability notes monitoring/sync services targeting the wrong backend. A systematic migration would resolve both.

### Overlapping Findings (Performance + Reliability)

- **Full table scans**: Performance flags query cost; Reliability flags data retention cleanup using `.collect()`. Both are fixed by proper indexing and pagination.
- **Service timer cleanup**: Performance flags accumulating intervals; Reliability flags services running when not needed. Lifecycle management fixes both.

### Systemic Themes

1. **The "observer effect" in monitoring**: 6 performance services + 3 monitoring services + mock Claude Skills infrastructure = significant overhead from code meant to improve performance/reliability.
2. **Supabase ghost town**: Multiple services still target Supabase while Convex is the primary backend. These are effectively dead code creating confusion and false-negative monitoring.
3. **Client-side everything**: API keys, AI calls, search, aggregation, and monitoring all run on-device. Moving to server-side for security also improves performance and reliability.

---

## Recommended Remediation Order

| Phase                    | Work                                                                                          | Findings Addressed | Severity Impact   |
| ------------------------ | --------------------------------------------------------------------------------------------- | ------------------ | ----------------- |
| **1. Emergency**         | Remove hardcoded API keys; move OpenAI to Convex actions                                      | 5 findings         | 2 CRIT + 3 HIGH   |
| **2. Auth hardening**    | Fix IDOR queries; lock createSignInToken; remove consent token from client                    | 9 findings         | 1 HIGH + 8 MEDIUM |
| **3. Perf cleanup**      | Remove performanceOptimizer monkey-patching; disable performanceTuner; consolidate monitoring | 6 findings         | 3 CRIT + 3 HIGH   |
| **4. Data integrity**    | Atomic XP transactions; write-ahead log for story saves; fix Convex indexes                   | 6 findings         | 3 HIGH + 3 MEDIUM |
| **5. Migration cleanup** | Remove/migrate Supabase-targeting services; update sync/monitoring to Convex                  | 6 findings         | 6 MEDIUM          |
| **6. UX polish**         | Child-friendly errors; image caching; context splitting; token truncation                     | 5 findings         | 2 HIGH + 3 MEDIUM |
