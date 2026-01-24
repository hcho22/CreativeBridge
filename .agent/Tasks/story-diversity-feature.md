# Story Diversity Feature - CreativeBridge

**Status:** 15/16 Complete (93.75%)
**Branch:** `ralph/story-diversity` → `ralphy/story-diversity`
**Priority:** High
**Migrated from Ralph:** 2026-01-20
**Original PRD:** `.agent/Ralph/archive/2026-01-20-story-diversity-migration/prd.json`

---

## 🎯 Overview

Implement a comprehensive tracking and enforcement system to reduce story element repetition and increase creative variety across user sessions. This feature uses AI-powered semantic similarity detection to guide story generation toward novel, diverse content.

### Business Value

- **User Experience**: Prevents repetitive storytelling, keeping content fresh and engaging
- **Educational Quality**: Exposes students to diverse narrative elements and vocabulary
- **Engagement**: Higher diversity scores correlate with longer session times and return rates
- **AI Quality**: Demonstrates advanced AI orchestration with LLM, embeddings, and semantic analysis

### Technical Approach

- **Database Layer**: PostgreSQL tables with JSONB embeddings and RLS policies
- **Service Layer**: 8+ specialized services for extraction, similarity, scoring, guidance
- **AI Integration**: OpenAI GPT-4 Turbo (extraction) + text-embedding-3-small (1536d vectors)
- **Performance**: LRU caching, batch operations, async fire-and-forget patterns

---

## ✅ Completed Tasks (Under Ralph)

### US-001: Database Schema for Story Elements Tracking

**Status:** ✅ COMPLETED
**Priority:** 1
**Files:**

- `sql/create_story_diversity_tables.sql` (migration)
- `.agent/System/database_schema.md` (documentation)

**Delivered:**

- ✅ `story_elements` table with element_type enum (character, setting, object, plot_pattern)
- ✅ `user_sessions` table with 24-hour expiration windows
- ✅ `story_diversity_scores` table with 0.0-1.0 score range
- ✅ Comprehensive indexes: `idx_story_elements_session_id_created_at`, `idx_story_elements_story_id`
- ✅ RLS policies: `auth.uid() = user_id` for all user-owned data
- ✅ Helper functions with SECURITY DEFINER for elevated privileges
- ✅ COMMENT ON statements for all schema objects
- ✅ Rollback procedures documented in migration comments

**Acceptance Criteria Met:**

- [x] Create story_elements table with columns: id, story_id, session_id, element_type, element_text, embedding_vector (JSONB), created_at
- [x] Create user_sessions table with columns: id, session_token, user_id, created_at, expires_at
- [x] Create story_diversity_scores table with columns: id, story_id, diversity_score, novel_element_count, created_at
- [x] Add indexes: story_elements(session_id, created_at), story_elements(story_id), user_sessions(session_token)
- [x] Generate and run migration successfully
- [x] Typecheck passes

---

### US-002: Story Element Extraction Service

**Status:** ✅ COMPLETED
**Priority:** 2
**Files:**

- `src/services/storyElementExtractionService.ts` (439 lines)
- `src/__tests__/services/storyElementExtractionService.test.ts` (20 tests)

**Delivered:**

- ✅ LLM-based extraction using GPT-4 Turbo with structured output prompting
- ✅ Extraction of 4 element types: characters, settings, objects, plot_patterns
- ✅ Normalization: lowercase, singular form, base-form verbs
- ✅ Exponential backoff retry logic (3 attempts: 1s, 2s, 4s delays)
- ✅ Fallback regex extraction for degraded functionality
- ✅ 20 comprehensive unit tests (all passing)

**Acceptance Criteria Met:**

- [x] Create extractStoryElements function that takes story text and returns structured JSON
- [x] Extraction uses LLM with structured output prompt (characters, settings, objects, plot_patterns)
- [x] Elements are normalized: lowercase, singular form where applicable
- [x] Returns format: {characters: [{name, type, role}], settings: [{location, environment}], objects: [{name, magical, purpose}], plot_patterns: [{action, discovery_type}]}
- [x] Function handles LLM API errors gracefully with fallback/retry logic
- [x] Typecheck passes

---

### US-003: Embedding Generation Service

**Status:** ✅ COMPLETED
**Priority:** 3
**Files:**

- `src/services/embeddingGenerationService.ts` (439 lines)
- `src/__tests__/services/embeddingGenerationService.test.ts` (21 tests)

**Delivered:**

- ✅ OpenAI text-embedding-3-small integration (1536-dimensional embeddings)
- ✅ LRU in-memory caching (1000 entry limit, automatic eviction)
- ✅ Exponential backoff retry logic (3 attempts with 1s/2s/4s delays)
- ✅ Text normalization (lowercase/trim) for cache consistency
- ✅ Batch generation support (`generateEmbeddings` for multiple texts)
- ✅ Smart error handling (no retry on auth/data validation errors)
- ✅ 21 comprehensive tests covering all features and edge cases

**Acceptance Criteria Met:**

- [x] Create generateEmbedding function that takes element text and returns embedding vector
- [x] Uses OpenAI text-embedding-3-small API
- [x] Returns embedding as array of numbers
- [x] Function handles API errors with retry logic
- [x] Embeddings are cached to avoid redundant API calls for identical text
- [x] Typecheck passes

---

### US-004: Cosine Similarity Calculation

**Status:** ✅ COMPLETED
**Priority:** 4
**Files:**

- `src/services/cosineSimilarityService.ts` (226 lines)
- `src/__tests__/services/cosineSimilarityService.test.ts` (40 tests)

**Delivered:**

- ✅ `calculateCosineSimilarity` function implementing: dot(A,B) / (norm(A) \* norm(B))
- ✅ Helper functions: `findMostSimilarVector`, `batchCalculateSimilarity`, `areSimilar`
- ✅ Edge case handling: zero vectors, dimension mismatches, floating-point precision
- ✅ Mathematical properties verified: commutativity, scale-invariance
- ✅ 40 comprehensive tests covering all scenarios

**Acceptance Criteria Met:**

- [x] Create calculateCosineSimilarity function that takes two embedding vectors and returns similarity score (0-1)
- [x] Function correctly implements cosine similarity formula: dot(A,B) / (norm(A) \* norm(B))
- [x] Returns 1.0 for identical vectors, 0.0 for orthogonal vectors
- [x] Handles edge cases: zero vectors, different length vectors
- [x] Includes unit tests with known vector pairs
- [x] Typecheck passes

---

### US-005: User Session Management

**Status:** ✅ COMPLETED
**Priority:** 5
**Files:**

- `src/services/diversitySessionService.ts` (242 lines)
- `src/__tests__/services/diversitySessionService.test.ts` (20 tests)

**Delivered:**

- ✅ Session lifecycle: `getOrCreateSession`, `validateSession`, `clearSession`
- ✅ AsyncStorage-based persistence (React Native compatible, not HTTP cookies)
- ✅ Supports both authenticated and anonymous users
- ✅ 24-hour expiration enforced at database level
- ✅ Automatic session renewal on expiration
- ✅ 20 comprehensive tests covering all scenarios

**Acceptance Criteria Met:**

- [x] Create getOrCreateSession function that retrieves or creates session from storage
- [x] Session ID is stored in AsyncStorage with 24-hour expiration
- [x] Function creates new session record in user_sessions table if needed
- [x] Session expiration is enforced: expired sessions return new session ID
- [x] Typecheck passes

---

### US-006: Recent Elements Retrieval Service

**Status:** ✅ COMPLETED
**Priority:** 6
**Files:**

- `src/services/recentElementsService.ts` (352 lines)
- `src/__tests__/services/recentElementsService.test.ts` (17 tests)

**Delivered:**

- ✅ `getRecentElements` function with database query optimization
- ✅ Uses `idx_story_elements_session_id_created_at` index for performance
- ✅ Groups elements by type (character, setting, object, plot_pattern)
- ✅ Calculates frequency counts for repeated elements
- ✅ Limits to most recent N stories (default: 10, configurable)
- ✅ Helper functions: `getTotalElementCount`, `getMostFrequentElements`
- ✅ 17 comprehensive tests

**Acceptance Criteria Met:**

- [x] Create getRecentElements function that takes session_id and limit (default 10) and returns recent elements
- [x] Query retrieves last N stories' elements ordered by created_at DESC
- [x] Returns elements grouped by type: {characters: [], settings: [], objects: [], plot_patterns: []}
- [x] Each element includes: element_text, embedding_vector, frequency count within window
- [x] Query is optimized with proper index usage
- [x] Typecheck passes

---

### US-007: Similarity Detection for Recent Elements

**Status:** ✅ COMPLETED
**Priority:** 7
**Files:**

- `src/services/similarityDetectionService.ts` (394 lines)
- `src/__tests__/services/similarityDetectionService.test.ts` (28 tests)

**Delivered:**

- ✅ `findSimilarElements` function with cosine similarity comparison
- ✅ Threshold-based filtering (default: 0.75, configurable)
- ✅ Results sorted by similarity score descending
- ✅ Helper functions: `findSimilarElementsByType`, `batchFindSimilarElements`, `isNovelElement`
- ✅ Analytics: `getSimilarityStatistics` for insights
- ✅ 28 comprehensive tests covering all scenarios

**Acceptance Criteria Met:**

- [x] Create findSimilarElements function that takes element text, embedding, and recent elements list
- [x] Function compares element embedding against all recent embeddings using cosine similarity
- [x] Returns list of similar elements with similarity scores > 0.75 threshold
- [x] Results sorted by similarity score descending
- [x] Threshold is configurable via parameter (default 0.75)
- [x] Typecheck passes

---

### US-008: Diversity Guidance Generation Service

**Status:** ✅ COMPLETED
**Priority:** 8
**Files:**

- `src/services/diversityGuidanceService.ts` (566 lines)
- `src/__tests__/services/diversityGuidanceService.test.ts` (26 tests)

**Delivered:**

- ✅ `generateDiversityGuidance` function with natural language output
- ✅ Frequency-based element filtering (threshold: 2+ occurrences)
- ✅ Intelligent alternative suggestions (animals→birds/insects, forests→urban/ocean)
- ✅ Three emphasis levels: subtle (hint), moderate (encourage), strong (strongly avoid)
- ✅ Configurable max elements to list (default: 5)
- ✅ `generateCompactGuidance` for token-limited contexts
- ✅ 26 comprehensive tests

**Acceptance Criteria Met:**

- [x] Create generateDiversityGuidance function that takes recent elements and returns guidance text
- [x] Guidance lists recently used elements to avoid with frequency counts
- [x] Suggests alternative categories based on what's overused
- [x] Output format matches template with sections: avoid, alternatives, goal
- [x] Function handles empty recent elements gracefully
- [x] Typecheck passes

---

### US-009: Integrate Diversity Guidance into Story Generation

**Status:** ✅ COMPLETED
**Priority:** 9
**Files:**

- `src/types/story.ts` (interface updates)
- `src/services/storyGenerationService.ts` (327 lines modified)
- `src/__tests__/services/storyGenerationDiversityIntegration.test.ts` (13 tests)

**Delivered:**

- ✅ Modified `StoryRequest` interface with optional `sessionId`, `userId`, `storyId`
- ✅ Async `buildPrompts` method with diversity guidance integration
- ✅ `getDiversityGuidance` helper method (retrieves session → fetches elements → generates guidance)
- ✅ System prompt injection: diversity guidance appended when available
- ✅ Non-blocking error handling (diversity failures don't block story generation)
- ✅ 13 integration tests covering all scenarios

**Acceptance Criteria Met:**

- [x] Modify story generation handler to retrieve user session
- [x] Before calling story LLM, call getRecentElements for session
- [x] Generate diversity guidance from recent elements
- [x] Inject guidance into system prompt (append to existing prompt)
- [x] Story generation proceeds with enhanced prompt
- [x] Typecheck passes

---

### US-010: Post-Generation Element Extraction and Storage

**Status:** ✅ COMPLETED
**Priority:** 10
**Files:**

- `src/services/postGenerationStorageService.ts` (309 lines)
- `src/services/storyGenerationService.ts` (integration)
- `src/__tests__/services/postGenerationStorageService.test.ts` (19 tests)

**Delivered:**

- ✅ `extractAndStoreElements` and `extractAndStoreElementsAsync` functions
- ✅ Integrated into storyGenerationService via `triggerPostGenerationStorage` method
- ✅ Fire-and-forget async pattern (non-blocking, doesn't delay story delivery)
- ✅ Graceful error handling at each step (extraction → embedding → storage)
- ✅ Batch embedding generation for efficiency
- ✅ Optional `skipEmbeddings` flag for testing
- ✅ 19 comprehensive tests

**Acceptance Criteria Met:**

- [x] After story generation completes, call extractStoryElements on story text
- [x] For each extracted element, generate embedding asynchronously
- [x] Store each element in story_elements table with session_id, story_id, element_type, element_text, embedding
- [x] Process runs asynchronously (doesn't block story delivery to user)
- [x] Errors in extraction/storage are logged but don't fail story generation
- [x] Typecheck passes

---

### US-011: Diversity Score Calculation Service

**Status:** ✅ COMPLETED
**Priority:** 11
**Files:**

- `src/services/diversityScoreService.ts` (368 lines)
- `src/__tests__/services/diversityScoreService.test.ts` (25 tests)

**Delivered:**

- ✅ `calculateDiversityScore` function with two-factor formula: (novelty_ratio × avg_semantic_distance)
- ✅ Novel elements: those with no similar match (similarity < 0.75)
- ✅ Semantic distance: average of (1 - max_similarity_score) for each element
- ✅ Per-type metrics: `calculateElementBreakdown` for granular analysis
- ✅ Classification: `classifyDiversityScore` (5 categories: very low → very high)
- ✅ Helper: `isLowDiversity` checker (threshold: 0.4)
- ✅ 25 comprehensive tests

**Acceptance Criteria Met:**

- [x] Create calculateDiversityScore function that takes new elements and recent elements
- [x] Score formula: (novel_elements / total_elements) \* avg_semantic_distance_factor
- [x] Novel elements are those with no similar match (similarity < 0.75) in recent elements
- [x] Semantic distance factor is average of (1 - max_similarity_score) for each element
- [x] Returns score between 0.0 (completely repetitive) and 1.0 (completely novel)
- [x] Typecheck passes

---

### US-012: Store Diversity Scores with Story Metadata

**Status:** ✅ COMPLETED
**Priority:** 12
**Files:**

- `src/services/diversityScoreStorageService.ts` (328 lines)
- `src/services/postGenerationStorageService.ts` (integration)
- `src/__tests__/services/diversityScoreStorageService.test.ts` (17 tests)

**Delivered:**

- ✅ `storeDiversityScore` function for calculating and persisting scores
- ✅ Integrated into postGenerationStorageService for automatic storage
- ✅ Workflow: fetch recent elements → calculate score → store → log warnings
- ✅ Low score warnings (< 0.4) trigger log with story_id and score
- ✅ Helper methods: `getDiversityScore`, `getSessionDiversityStats` for analytics
- ✅ Fire-and-forget async pattern (non-blocking)
- ✅ 17 comprehensive tests

**Acceptance Criteria Met:**

- [x] After calculating diversity score, store in story_diversity_scores table
- [x] Record includes: story_id, diversity_score, novel_element_count, created_at
- [x] Low diversity scores (< 0.4) trigger warning log with story_id and score
- [x] Storage happens asynchronously after story delivery
- [x] Typecheck passes

---

### US-013: Caching for Recent Elements Queries

**Status:** ✅ COMPLETED
**Priority:** 13
**Files:**

- `src/services/recentElementsService.ts` (139 lines added)
- `src/services/postGenerationStorageService.ts` (cache invalidation)
- `src/__tests__/services/recentElementsCaching.test.ts` (16 tests)

**Delivered:**

- ✅ LRU cache with 24-hour TTL for recent elements queries
- ✅ Cache key: session_id, value: recent elements + timestamp
- ✅ `getRecentElements` checks cache first (cache hit avoids database query)
- ✅ Automatic cache invalidation in postGenerationStorageService after storage
- ✅ Cache features: 1000-session limit, LRU eviction, TTL validation
- ✅ Helper methods: `invalidateCache`, `clearCache`, `getCacheStats`
- ✅ 16 comprehensive tests

**Acceptance Criteria Met:**

- [x] Add in-memory cache (Map or LRU cache) for recent elements per session
- [x] Cache key is session_id, value is recent elements with timestamp
- [x] Cache TTL matches session duration (24 hours)
- [x] getRecentElements checks cache first before database query
- [x] Cache is invalidated/updated after new elements are stored
- [x] Typecheck passes

---

### US-014: Performance Monitoring and Logging

**Status:** ✅ COMPLETED
**Priority:** 14
**Files:**

- `src/services/diversityPerformanceMonitoringService.ts` (441 lines)
- `src/services/storyGenerationService.ts` (timing integration)
- `src/services/postGenerationStorageService.ts` (timing integration)
- `src/__tests__/services/diversityPerformanceMonitoringService.test.ts` (31 tests)

**Delivered:**

- ✅ Comprehensive timing: `measureAsync`/`measure` wrappers for all operations
- ✅ Metrics tracked: element_extraction, embedding_generation, similarity checks, diversity_guidance
- ✅ Cache tracking: hit/miss rates, average lookup time
- ✅ Aggregated statistics: `getPerformanceStats`, `getCacheStats`, `getAverageDiversityScore`
- ✅ Automatic warnings for slow operations (thresholds: diversity_guidance < 200ms)
- ✅ All logs include session_id and story_id context
- ✅ Performance targets met and validated
- ✅ 31 comprehensive tests

**Acceptance Criteria Met:**

- [x] Log timing for: element extraction, embedding generation, similarity checks, guidance generation
- [x] Log diversity metrics per story: score, novel_element_count, total_element_count, avoided_elements_count
- [x] Log cache hit/miss rates for recent elements queries
- [x] Add latency tracking for diversity guidance step (target < 200ms)
- [x] Logs include session_id and story_id for debugging
- [x] Typecheck passes

---

### US-015: API Endpoint for Recent Elements Debugging

**Status:** ✅ COMPLETED
**Priority:** 15
**Files:**

- `src/services/diversityDebugService.ts` (373 lines)
- `sql/create_diversity_debug_functions.sql` (243 lines)
- `src/__tests__/services/diversityDebugService.test.ts` (25 tests)

**Delivered:**

- ✅ React Native service functions (not REST endpoints, per CreativeBridge architecture)
- ✅ `getRecentElements` function: retrieves elements with metadata (session info, date range, total elements)
- ✅ `getDiversityScore` function: retrieves score and breakdown (novelty ratio, semantic distance, per-type metrics)
- ✅ Supabase RPC functions with SECURITY DEFINER for elevated privileges
- ✅ Ownership checks: users can only access their own sessions
- ✅ Helper methods: `canAccessSession`, `getSessionStats`
- ✅ 25 comprehensive tests

**Acceptance Criteria Met:**

- [x] Create debug endpoint/function for retrieving recent elements by session
- [x] Returns recent elements grouped by type with embeddings and frequency
- [x] Includes metadata: session info, total stories in window, date range
- [x] Protected: authenticated user's own session only (ownership validation)
- [x] Returns 404 if session not found
- [x] Typecheck passes

---

## 🔄 Remaining Task (For Ralphy)

### US-016: Admin Diversity Analytics Dashboard (Optional)

**Status:** ⏳ NOT STARTED
**Priority:** 16 (Optional Enhancement)
**Estimated Effort:** Medium (4-6 hours)

**Description:**
Create an admin-only dashboard screen showing diversity metrics across all users. This provides visibility into how well the diversity system is working globally and helps identify patterns or issues.

**User Story:**

> As an admin, I want to see diversity metrics across all users so that I can monitor the health of the diversity system and identify areas for improvement.

**Acceptance Criteria:**

- [ ] Create `src/screens/AdminDiversityScreen.tsx` with charts and metrics
- [ ] Display average diversity score over time (line chart, last 7/30 days)
- [ ] Show most frequently repeated elements globally (bar chart, top 20)
- [ ] Provide session-level diversity breakdown (table: session_id, avg_score, story_count)
- [ ] Add filters: date range selector, min/max diversity score sliders
- [ ] Add admin-only route protection in `src/navigation/AppNavigator.tsx`
- [ ] TypeScript compilation passes (npx tsc --noEmit)
- [ ] All tests pass (npm test)
- [ ] Verify in iOS simulator and Android emulator (manual testing)

**Technical Implementation Notes:**

#### 1. Chart Library Selection

**Decision Point:** Choose between react-native-chart-kit vs victory-native

**Recommendation:** `react-native-chart-kit`

- ✅ Lightweight and performant
- ✅ Simple API for line/bar charts
- ✅ Good React Native compatibility
- ✅ Lower bundle size
- ⚠️ Less customization than victory-native

**Alternative:** `victory-native`

- ✅ More chart types and customization
- ✅ Better for complex visualizations
- ⚠️ Larger bundle size
- ⚠️ Steeper learning curve

**Installation:**

```bash
npm install react-native-chart-kit react-native-svg
```

#### 2. Data Source Architecture

Use existing `diversityDebugService` as foundation and create new Supabase RPC functions:

**New SQL Functions Needed:**

```sql
-- sql/create_admin_diversity_analytics_functions.sql
CREATE OR REPLACE FUNCTION get_global_diversity_stats(
  p_days INTEGER DEFAULT 30
)
RETURNS JSONB
SECURITY DEFINER
AS $$
  -- Returns: {avg_score, total_stories, date_buckets: [{date, avg_score, story_count}]}
$$;

CREATE OR REPLACE FUNCTION get_most_repeated_elements(
  p_limit INTEGER DEFAULT 20,
  p_days INTEGER DEFAULT 30
)
RETURNS JSONB
SECURITY DEFINER
AS $$
  -- Returns: [{element_text, element_type, frequency, avg_similarity}]
$$;

CREATE OR REPLACE FUNCTION get_session_diversity_breakdown(
  p_min_score FLOAT DEFAULT 0.0,
  p_max_score FLOAT DEFAULT 1.0,
  p_days INTEGER DEFAULT 30,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
SECURITY DEFINER
AS $$
  -- Returns: [{session_id, user_id, avg_score, story_count, created_at}]
$$;
```

#### 3. Screen Structure

```
AdminDiversityScreen.tsx
├── Header (title, date range selector)
├── MetricsOverview (cards: avg score, total stories, active sessions)
├── DiversityTrendChart (line chart, 7/30 days toggle)
├── TopRepeatedElementsChart (horizontal bar chart)
└── SessionBreakdownTable (paginated table with filters)
```

#### 4. Admin Access Control

**Pattern:** Follow existing admin screen patterns in CreativeBridge

```typescript
// Check user role from AuthContext
const { user } = useAuth();
const isAdmin = user?.role === 'admin'; // Or however admin is identified

// In AppNavigator.tsx
{
  isAdmin && (
    <Stack.Screen
      name="AdminDiversity"
      component={AdminDiversityScreen}
      options={{ title: 'Diversity Analytics' }}
    />
  );
}
```

#### 5. Performance Considerations

**Challenge:** Large datasets (thousands of stories)

**Solutions:**

- ✅ **Database-level aggregation**: Use SQL GROUP BY and date_trunc for time buckets
- ✅ **Pagination**: Limit session breakdown to 50 rows per page with offset
- ✅ **Caching**: Cache global stats in Redis with 5-minute TTL (optional)
- ✅ **Lazy loading**: Only fetch chart data when tab is visible
- ⚠️ **Avoid:** Fetching all stories client-side and aggregating in JavaScript

#### 6. Data Refresh Strategy

**Options:**

**A. Cached (Recommended for MVP):**

```typescript
// Fetch on mount, 5-minute cache
const { data, loading } = useQuery('admin-diversity-stats', fetchStats, {
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

**B. Real-time (Future Enhancement):**

```typescript
// Supabase real-time subscription to story_diversity_scores table
const subscription = supabase
  .from('story_diversity_scores')
  .on('INSERT', handleNewScore)
  .subscribe();
```

#### 7. Testing Strategy

**Unit Tests:**

```typescript
// src/__tests__/services/adminDiversityAnalyticsService.test.ts
describe('adminDiversityAnalyticsService', () => {
  test('getGlobalStats returns aggregated data', async () => { ... });
  test('getMostRepeatedElements returns top N elements', async () => { ... });
  test('getSessionBreakdown filters by score range', async () => { ... });
});
```

**Component Tests:**

```typescript
// src/__tests__/screens/AdminDiversityScreen.test.tsx
describe('AdminDiversityScreen', () => {
  test('renders charts with data', () => { ... });
  test('date range filter updates data', () => { ... });
  test('non-admin users cannot access', () => { ... });
});
```

**Integration Tests:**

```typescript
// Test with real Supabase test database
test('end-to-end: admin views global diversity stats', async () => {
  // Seed test data → render screen → verify charts
});
```

**Manual Testing Checklist:**

- [ ] Open admin dashboard on iOS simulator
- [ ] Verify charts render correctly
- [ ] Test date range filter (7 days vs 30 days)
- [ ] Test score filter sliders
- [ ] Verify pagination in session breakdown
- [ ] Test on Android emulator
- [ ] Verify non-admin users cannot access route

#### 8. File Checklist

**New Files to Create:**

```
src/
├── screens/
│   └── AdminDiversityScreen.tsx (main screen component)
├── services/
│   └── adminDiversityAnalyticsService.ts (data fetching logic)
├── components/
│   ├── DiversityTrendChart.tsx (line chart component)
│   ├── TopRepeatedElementsChart.tsx (bar chart component)
│   └── SessionBreakdownTable.tsx (table with pagination)
└── __tests__/
    ├── screens/
    │   └── AdminDiversityScreen.test.tsx
    └── services/
        └── adminDiversityAnalyticsService.test.ts

sql/
└── create_admin_diversity_analytics_functions.sql (Supabase RPC functions)
```

**Files to Modify:**

```
src/
├── navigation/
│   └── AppNavigator.tsx (add admin route)
└── types/
    └── diversity.ts (add analytics types if needed)

.agent/
└── System/
    └── database_schema.md (document new RPC functions)
```

#### 9. Rollout Plan

**Phase 1: Core Infrastructure (2 hours)**

- Create SQL RPC functions for global stats
- Create `adminDiversityAnalyticsService.ts`
- Write unit tests for service functions
- Verify data fetching works in isolation

**Phase 2: UI Components (2 hours)**

- Install react-native-chart-kit
- Create `DiversityTrendChart.tsx` and `TopRepeatedElementsChart.tsx`
- Create `SessionBreakdownTable.tsx` with pagination
- Write component tests

**Phase 3: Screen Integration (1 hour)**

- Create `AdminDiversityScreen.tsx`
- Integrate charts and table
- Add filters and date range selector
- Wire up admin route in AppNavigator

**Phase 4: Testing & Refinement (1 hour)**

- Run full test suite (npm test)
- Manual testing on iOS and Android
- Performance testing with large datasets
- Bug fixes and polish

---

## 📊 Feature Statistics

### Codebase Impact

- **New Tables:** 3 (story_elements, user_sessions, story_diversity_scores)
- **New Services:** 12 specialized services
- **New Tests:** 280+ comprehensive unit and integration tests
- **Lines of Code:** ~8,000+ (services + tests + SQL)
- **Test Coverage:** 80%+ across all services

### Service Architecture

```
diversitySessionService          (session lifecycle)
  ↓
recentElementsService            (fetch recent elements with cache)
  ↓
storyGenerationService           (inject diversity guidance)
  ↓
postGenerationStorageService     (extract + store + score)
  ├── storyElementExtractionService   (LLM extraction)
  ├── embeddingGenerationService      (OpenAI embeddings)
  ├── similarityDetectionService      (cosine similarity)
  ├── diversityScoreService           (score calculation)
  └── diversityScoreStorageService    (persist scores)

diversityPerformanceMonitoringService (timing + metrics)
diversityDebugService                 (debug tooling)
```

### Quality Metrics

- **TypeScript Compilation:** ✅ Zero new errors
- **ESLint:** ✅ No new warnings
- **Jest Tests:** ✅ 280+ tests passing
- **Pre-commit Hooks:** ✅ Auto-formatting enforced
- **Documentation:** ✅ Database schema, SOP, and architecture docs updated

---

## 📚 Documentation References

### Database Schema

- **Location:** `.agent/System/database_schema.md` (sections 4-6)
- **Tables:** story_elements, user_sessions, story_diversity_scores
- **Indexes:** Compound indexes for query optimization
- **RLS Policies:** Row-level security for all user data

### Service Documentation

All services follow consistent patterns documented in Ralph's learnings:

- **Error Handling:** Exponential backoff (3 attempts: 1s, 2s, 4s)
- **Caching:** LRU with 1000 entry limit, 24hr TTL
- **Performance:** Targets met (<200ms diversity guidance, <100ms DB queries)
- **Testing:** 80%+ coverage with unit + integration tests

### Key Service Files

```
src/services/
├── storyElementExtractionService.ts     (LLM extraction)
├── embeddingGenerationService.ts        (OpenAI embeddings)
├── cosineSimilarityService.ts           (similarity calculation)
├── diversitySessionService.ts           (session management)
├── recentElementsService.ts             (element retrieval + cache)
├── similarityDetectionService.ts        (similarity detection)
├── diversityGuidanceService.ts          (guidance generation)
├── diversityScoreService.ts             (score calculation)
├── diversityScoreStorageService.ts      (score persistence)
├── postGenerationStorageService.ts      (post-gen pipeline)
├── diversityPerformanceMonitoringService.ts (monitoring)
└── diversityDebugService.ts             (debug tooling)
```

### SQL Migrations

```
sql/
├── create_story_diversity_tables.sql           (schema)
└── create_diversity_debug_functions.sql        (RPC functions)
```

---

## 🔄 Ralph → Ralphy Migration Context

### What Ralph Accomplished (15/16 User Stories)

- **Duration:** 7 days (Jan 13-20, 2026)
- **Iterations:** 15 detailed implementation cycles
- **Test Suite:** 280+ comprehensive tests
- **Documentation:** Complete database schema, service architecture, and learnings

### Ralph's Development Workflow

1. **Planning:** Acceptance criteria defined in prd.json
2. **Implementation:** Iterative development with quality gates
3. **Documentation:** Learnings captured in progress.txt after each iteration
4. **Quality Assurance:** TypeScript, ESLint, Jest, pre-commit hooks
5. **Archival:** Completed work preserved in archive/

### Learnings Encoded in Ralphy Config

All Ralph patterns have been encoded into `.ralphy/config.yaml`:

- **Database patterns:** CREATE IF NOT EXISTS, RLS policies, JSONB usage
- **Service patterns:** Exponential backoff, LRU caching, batch operations
- **Testing patterns:** Mock external services, test authorization, edge cases
- **React Native patterns:** AsyncStorage, Supabase RPC, service-based APIs

### Why US-016 Waits for Ralphy

- **Ralph Strength:** Sequential, meticulous implementation with detailed learnings
- **Ralphy Strength:** Parallel execution, automated branch management, PRD-driven workflow
- **Decision:** Complete core diversity system (15 stories) under Ralph, save optional admin dashboard for Ralphy's inaugural task

---

## 🚀 Next Steps for Ralphy

### Immediate Action: US-016

1. **Review this PRD** - Understand acceptance criteria and implementation notes
2. **Create feature branch** - `ralphy/admin-diversity-dashboard`
3. **Implement in phases** - Follow rollout plan (infrastructure → UI → integration → testing)
4. **Quality gates** - Ensure TypeScript, ESLint, Jest all pass
5. **Documentation** - Update .agent/System/database_schema.md with new RPC functions
6. **Manual testing** - Verify on iOS and Android

### Future Enhancements (Post-US-016)

- Real-time dashboard updates (Supabase subscriptions)
- Per-user diversity analytics (drill-down from global to user level)
- A/B testing framework (compare diversity guidance on/off)
- Diversity tuning UI (adjust thresholds and algorithms)
- Export functionality (CSV/JSON downloads for analytics)

---

## 📞 Questions or Issues?

If you encounter issues during implementation:

1. **Ralph Archive:** Review detailed learnings in `.agent/Ralph/archive/2026-01-20-story-diversity-migration/progress.txt`
2. **Database Schema:** Check `.agent/System/database_schema.md` for table structures
3. **Service Patterns:** Reference existing diversity services for consistent patterns
4. **Ralphy Config:** Review `.ralphy/config.yaml` for project rules and boundaries

---

**End of PRD**

_This PRD preserves all context from Ralph's JSON-based system and provides complete guidance for Ralphy's implementation of US-016._
