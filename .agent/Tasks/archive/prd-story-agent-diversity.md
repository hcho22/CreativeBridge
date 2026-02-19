# PRD: Story Agent Diversity Improvement

## Introduction

The CreativeBridge story generation system currently produces repetitive, uncreative stories because it generates each story independently without memory of previous creations. Users are experiencing pattern fatigue, seeing the same character types (rabbits, bears, dogs), settings (forests, meadows), objects (magical maps, keys, crystals), and plot elements (hidden doors under trees, discovering special powers) repeatedly.

This feature will implement a story diversity tracking and enforcement system that monitors story elements per-user session, detects semantic similarity using embeddings, and proactively guides the LLM toward generating novel, varied stories while maintaining quality and performance.

## Goals

- Track story elements (characters, settings, objects, plot patterns) per user session
- Actively avoid recently used elements when generating new stories
- Use semantic similarity detection to catch conceptually similar elements (e.g., "magical map" ≈ "enchanted scroll")
- Proactively guide the LLM toward diverse story generation using tracked history
- Maintain story generation performance with no user-perceived latency increase
- Achieve measurable reduction in element repetition while improving user satisfaction

## User Stories

### US-001: Story element extraction and storage

**Description:** As a developer, I need to extract and store key story elements from generated stories so the system can track what has been created.

**Acceptance Criteria:**

- [ ] Extract characters, settings, objects, and plot patterns from each generated story
- [ ] Store extracted elements in database with user session ID and timestamp
- [ ] Elements are normalized (lowercase, singular form where applicable)
- [ ] Database schema supports efficient querying by user and recency
- [ ] Typecheck/lint passes

### US-002: Semantic similarity detection using embeddings

**Description:** As a system, I need to detect semantically similar story elements so "magical map" and "enchanted scroll" are recognized as conceptually related.

**Acceptance Criteria:**

- [ ] Generate embeddings for each extracted story element
- [ ] Store embeddings alongside story elements in database
- [ ] Implement similarity scoring function (cosine similarity or equivalent)
- [ ] Elements with >0.75 similarity threshold are flagged as "similar"
- [ ] Typecheck/lint passes

### US-003: Recent element tracking per user session

**Description:** As a user, I want the system to remember what story elements I've recently seen so my stories don't repeat patterns.

**Acceptance Criteria:**

- [ ] Query recent N stories (configurable, default 10) for current user session
- [ ] Build list of recently used elements with their embeddings
- [ ] Track element frequency within the session window
- [ ] Provide API endpoint to retrieve recent elements for debugging
- [ ] Typecheck/lint passes

### US-004: Diversity-aware prompt enhancement

**Description:** As a system, I need to inject diversity guidance into the LLM prompt so it actively avoids repetitive elements.

**Acceptance Criteria:**

- [ ] Before story generation, retrieve user's recent story elements
- [ ] Generate "diversity guidance" section listing elements to avoid
- [ ] Include suggested alternative categories (e.g., if many forest settings, suggest urban/ocean/desert)
- [ ] Inject guidance into system prompt for story generation
- [ ] Guidance format is clear and actionable for the LLM
- [ ] Typecheck/lint passes

### US-005: Story diversity scoring

**Description:** As a developer, I want to measure story diversity quantitatively so we can track improvement over time.

**Acceptance Criteria:**

- [ ] Calculate diversity score for each generated story (0-1 scale)
- [ ] Score considers: novel elements, semantic distance from recent stories, element variety
- [ ] Store diversity score with each story in database
- [ ] Low diversity scores (<0.4) trigger logging for analysis
- [ ] Typecheck/lint passes

### US-006: Performance monitoring and optimization

**Description:** As a system operator, I need to ensure diversity tracking doesn't slow down story generation.

**Acceptance Criteria:**

- [ ] Measure baseline story generation latency before feature
- [ ] Implement caching for recent element queries (Redis or in-memory)
- [ ] Embedding generation happens asynchronously after story delivery
- [ ] Total added latency is <200ms (not user-perceived)
- [ ] Add performance monitoring logs for element retrieval and similarity checks
- [ ] Typecheck/lint passes

### US-007: User session management

**Description:** As a user, my story diversity tracking should be scoped to my session so different users don't interfere with each other.

**Acceptance Criteria:**

- [ ] Create or retrieve user session ID on story generation request
- [ ] Session ID stored in cookie or auth token
- [ ] All element tracking queries filtered by session ID
- [ ] Session expires after configurable period (default 24 hours)
- [ ] Typecheck/lint passes

### US-008: Admin diversity analytics dashboard (optional enhancement)

**Description:** As an admin, I want to see diversity metrics across all users to identify system-wide patterns.

**Acceptance Criteria:**

- [ ] Display average diversity score over time (chart)
- [ ] Show most frequently repeated elements globally
- [ ] Provide session-level diversity breakdown
- [ ] Accessible via admin panel or API endpoint
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- **FR-1:** After each story generation, extract key elements: characters (with types), settings (locations/environments), objects (magical items, tools), and plot patterns (action sequences, discoveries)
- **FR-2:** Generate embeddings for each extracted element using an embedding model (e.g., OpenAI text-embedding-3-small or sentence-transformers)
- **FR-3:** Store story elements with embeddings, user session ID, story ID, timestamp, and element type in the database
- **FR-4:** Before generating a new story, query the last N stories (configurable, default 10) for the current user session
- **FR-5:** Compare new element candidates against recent elements using cosine similarity on embeddings
- **FR-6:** Flag elements as "recently used" if similarity score >0.75 with any recent element
- **FR-7:** Generate diversity guidance prompt section listing: avoided elements, suggested alternatives, and novelty encouragement
- **FR-8:** Inject diversity guidance into the story generation system prompt
- **FR-9:** Calculate diversity score post-generation: (novel_elements / total_elements) \* semantic_distance_factor
- **FR-10:** Store diversity score with story metadata
- **FR-11:** Implement caching layer for recent element queries (per session) with TTL matching session duration
- **FR-12:** Execute embedding generation asynchronously to avoid blocking story delivery
- **FR-13:** Manage user sessions with configurable expiration (default 24 hours)
- **FR-14:** Log diversity metrics: score, avoided elements count, novel elements count

## Non-Goals (Out of Scope)

- **No cross-user diversity tracking** - each user's session is independent; we won't track global patterns for diversity enforcement (only for analytics)
- **No manual user controls for diversity preferences** - initial version uses system defaults; user-adjustable diversity sliders are future work
- **No retroactive diversity scoring** - only new stories get scored; existing stories remain unscored
- **No story regeneration suggestions** - if a low-diversity story is generated, we don't auto-suggest regeneration
- **No diversity enforcement at the book/multi-story level** - tracking is per-session, not per book project

## Technical Considerations

### Architecture

- **Element Extraction:** Use LLM-based extraction (GPT-4 or similar) with structured output to identify characters, settings, objects, plot patterns
- **Embedding Generation:** Use OpenAI `text-embedding-3-small` for cost efficiency and quality
- **Storage:** Extend existing database schema with tables:
  - `story_elements` (id, story_id, session_id, element_type, element_text, embedding_vector, created_at)
  - `user_sessions` (id, session_token, user_id, created_at, expires_at)
  - `story_diversity_scores` (story_id, diversity_score, novel_element_count, created_at)
- **Caching:** Use in-memory cache (Node.js Map or Redis) for recent elements per session
- **Async Processing:** Use background job queue (e.g., Bull, BullMQ) for embedding generation

### Integration Points

- **Story Generation Flow:** Insert diversity guidance step between user request and LLM story generation
- **Post-Generation Hook:** Extract elements and calculate diversity score after story delivery
- **Existing Agent Architecture:** Integrate with Ralph agent or story generation agent
- **Database:** Extend PostgreSQL schema (or current DB) with new tables

### Performance Requirements

- Element extraction: <2 seconds (async, non-blocking)
- Diversity guidance generation: <200ms (cached queries)
- Embedding generation: <1 second per story (async)
- Similarity search: <100ms for 10-story window
- Total added user-perceived latency: 0ms (all async except guidance)

### Dependencies

- OpenAI API (or alternative embedding service)
- Vector similarity library (e.g., `@xenova/transformers`, or direct cosine similarity implementation)
- Session management library or existing auth system

## Success Metrics

### User Satisfaction

- Qualitative feedback: users report stories feel "fresh" and "unique"
- User engagement: increased story generation requests per session
- Reduced session abandonment rate

### Measurable Diversity

- Average diversity score >0.6 within first 2 weeks
- Element repetition rate: <30% of elements repeated within 10-story window
- Semantic similarity: <20% of new elements have >0.75 similarity to recent elements

### System Performance

- Story generation latency increase: <200ms (95th percentile)
- Database query time for recent elements: <50ms
- Embedding generation success rate: >99%
- No user-reported performance degradation

### All Metrics Tracked Via

- Logging and analytics dashboard
- A/B testing (if applicable): diversity-enabled vs. control group
- Weekly diversity score trend reports

## Design Considerations

### Element Extraction Prompt Design

Create a structured prompt for LLM-based extraction:

```
Extract the following story elements from this story:
- Characters: [name, type/species, role]
- Settings: [location, environment type]
- Objects: [item name, magical/mundane, purpose]
- Plot Patterns: [key action, discovery type]

Return as JSON.
```

### Diversity Guidance Format

Example injected prompt section:

```
DIVERSITY GUIDANCE:
Recently used elements to avoid:
- Characters: rabbit (2x), bear (1x)
- Settings: enchanted forest (3x)
- Objects: magical map (1x), golden key (1x)

Suggested alternatives:
- Characters: Try aquatic creatures, insects, birds, or unusual animals
- Settings: Urban environments, underwater worlds, desert landscapes, sky cities
- Objects: Non-magical tools, organic items, technological devices

Goal: Create a story with fresh, unexpected elements while maintaining quality.
```

### UI Considerations (Future)

- **Admin Dashboard:** Charts showing diversity trends, top repeated elements, session-level breakdowns
- **User Feedback:** Optional "This story felt repetitive" button for data collection

## Open Questions

1. **Embedding Model Choice:** Should we use OpenAI embeddings (cost, API dependency) or local sentence-transformers (performance, privacy)?
2. **Element Extraction Accuracy:** What validation do we need for extracted elements? Should humans review samples?
3. **Similarity Threshold:** Is 0.75 the right threshold, or should it be configurable per element type?
4. **Session Duration:** Is 24 hours the right default session length, or should it be shorter/longer?
5. **Global Pattern Detection:** Should we track global patterns for analytics even if not used for enforcement?
6. **Fallback Behavior:** If diversity guidance fails (API error, timeout), should we proceed with normal generation or retry?
7. **Element Weighting:** Should some elements (e.g., characters) be weighted more heavily in diversity scoring than others (e.g., minor objects)?

## Implementation Phases

### Phase 1: Foundation (US-001, US-007)

- Database schema and migration
- Element extraction implementation
- Session management

### Phase 2: Semantic Detection (US-002, US-003)

- Embedding generation
- Similarity detection
- Recent element tracking

### Phase 3: Active Diversity (US-004, US-005)

- Diversity guidance injection
- Story diversity scoring
- Integration with story generation flow

### Phase 4: Optimization (US-006)

- Performance monitoring
- Caching implementation
- Async processing optimization

### Phase 5: Analytics (US-008 - Optional)

- Admin dashboard
- Metrics visualization
- Global pattern analysis

## Appendix: Example Story Element Extraction

**Input Story:**

> "Bella the rabbit hopped through the enchanted forest, discovering a magical map under an old oak tree. The map glowed with golden light, revealing the location of a hidden door."

**Extracted Elements:**

```json
{
  "characters": [{ "name": "Bella", "type": "rabbit", "role": "protagonist" }],
  "settings": [{ "location": "enchanted forest", "environment": "forest" }],
  "objects": [
    { "name": "magical map", "magical": true, "purpose": "reveal location" },
    { "name": "old oak tree", "magical": false, "purpose": "hiding place" }
  ],
  "plot_patterns": [
    { "action": "discovering", "discovery_type": "magical object" },
    { "action": "revealing", "discovery_type": "hidden door" }
  ]
}
```

---

**PRD Version:** 1.0
**Created:** 2026-01-13
**Owner:** CreativeBridge Team
**Status:** Draft - Awaiting Review
