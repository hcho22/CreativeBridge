# PRD: Image Generation Quality Improvement

## Introduction

The current image generation system produces images that often don't relate well to story content, relying on simple keyword extraction rather than deeper story comprehension. This feature replaces keyword-based prompts with GPT-4 story analysis to generate contextually relevant, high-quality images that accurately reflect the narrative content.

## Goals

- Improve image-to-story relevance through LLM-based prompt generation
- Enhance visual quality with optimized Stable Diffusion parameters
- Maintain or improve current 95% success rate
- Keep generation time under 60 seconds (current 45s + 5s LLM overhead)
- Deploy safely with automatic fallback and feature flags
- Achieve user satisfaction improvement validated through manual QA comparison

## User Stories

### US-001: Integrate GPT-4 for Story Analysis

**Description:** As a developer, I need to add GPT-4 story comprehension to replace keyword extraction so that image prompts better capture narrative context.

**Acceptance Criteria:**

- [ ] Add `generatePromptWithLLM()` method to imageGeneration.ts
- [ ] Create story analysis prompt templates in openai.ts
- [ ] Integrate GPT-4 Turbo API call with retry logic
- [ ] Method accepts story text and returns optimized image generation prompt
- [ ] Typecheck passes
- [ ] Unit tests cover LLM prompt generation logic

### US-002: Implement Automatic Fallback System

**Description:** As a user, I want image generation to continue working even when LLM services fail, so my experience is uninterrupted.

**Acceptance Criteria:**

- [ ] LLM failures automatically trigger fallback to keyword extraction
- [ ] No user-facing error messages for LLM failures
- [ ] Fallback behavior logged for monitoring
- [ ] Safety filtering preserved in both LLM and fallback paths
- [ ] Test both happy path and failure scenarios
- [ ] Typecheck passes

### US-003: Integrate LLM into Main Generation Flow

**Description:** As a developer, I need to wire GPT-4 prompt generation into the existing generateImage() workflow so it becomes the primary method.

**Acceptance Criteria:**

- [ ] Modify generateImage() flow at line 8261 to call generatePromptWithLLM()
- [ ] Preserve existing safety filtering after LLM prompt generation
- [ ] Feature flag `USE_LLM_PROMPT_GENERATION` controls new vs old behavior
- [ ] Default feature flag to false for safe deployment
- [ ] No breaking changes to existing API contracts
- [ ] Typecheck passes

### US-004: Optimize Stable Diffusion Parameters

**Description:** As a user, I want higher quality generated images even if they take slightly longer, so the visuals better match my story.

**Acceptance Criteria:**

- [ ] Add comprehensive negative prompts (avoid blurry, distorted, multi-scene)
- [ ] Set `num_inference_steps: 50` for better quality
- [ ] Set `guidance_scale: 7.5` for better prompt adherence
- [ ] Add `scheduler: 'DPMSolverMultistep'` for improved quality
- [ ] Modify callReplicateAPI() method (lines 8017-8099)
- [ ] Generation time remains under 60 seconds
- [ ] Typecheck passes

### US-005: Manual QA Validation

**Description:** As a product owner, I need to validate image quality improvement through before/after comparison so we know the feature achieves its goal.

**Acceptance Criteria:**

- [ ] Generate 30 test images using current keyword extraction system
- [ ] Generate same 30 images using new LLM-based system
- [ ] Document comparison results with quality ratings
- [ ] Identify any edge cases or failure patterns
- [ ] QA sign-off before enabling feature flag for production

### US-006: Production Rollout with Feature Flag

**Description:** As a developer, I need to safely roll out the new system with gradual adoption so we can monitor and quickly revert if needed.

**Acceptance Criteria:**

- [ ] Feature flag `USE_LLM_PROMPT_GENERATION` implemented in config
- [ ] Gradual rollout plan: 10% → 50% → 100% of requests
- [ ] Basic error logging for LLM failures and generation times
- [ ] Document rollback procedure (disable feature flag)
- [ ] Monitor error rates at each rollout stage
- [ ] Full production deployment completed

## Functional Requirements

**Phase 1: Core LLM Integration**

- FR-1: The system must add a `generatePromptWithLLM()` method in `/Users/hcho/Documents/AI/Projects/CreativeBridge/src/services/imageGeneration.ts` that accepts story text and returns an optimized image generation prompt
- FR-2: The system must integrate GPT-4 Turbo API calls in `/Users/hcho/Documents/AI/Projects/CreativeBridge/src/services/openai.ts` with story analysis prompt templates
- FR-3: When LLM prompt generation fails, the system must automatically fall back to the existing keyword extraction method without user notification
- FR-4: The system must preserve all existing safety filtering mechanisms regardless of LLM or fallback usage
- FR-5: The system must add retry logic for LLM API calls (exponential backoff, max 3 retries)
- FR-6: The system must integrate `generatePromptWithLLM()` into the main `generateImage()` flow at line 8261

**Phase 2: Enhanced Stable Diffusion Parameters**

- FR-7: The system must add comprehensive negative prompts to avoid: blurry images, distorted images, multi-scene compositions, low quality artifacts
- FR-8: The system must set `num_inference_steps: 50` for higher quality output
- FR-9: The system must set `guidance_scale: 7.5` for better prompt adherence
- FR-10: The system must use `scheduler: 'DPMSolverMultistep'` for improved image quality
- FR-11: These parameter changes must be applied in the `callReplicateAPI()` method (lines 8017-8099)

**Phase 3: Safety & Rollout**

- FR-12: The system must implement a feature flag `USE_LLM_PROMPT_GENERATION` (default: false) to control LLM usage
- FR-13: The system must support gradual rollout percentages: 10%, 50%, 100%
- FR-14: The system must log all LLM failures with error details for monitoring
- FR-15: The system must log generation times for both LLM and non-LLM paths
- FR-16: The system must support instant rollback by disabling the feature flag

## Non-Goals (Out of Scope)

- No database schema changes or new analytics columns
- No user-facing UI changes or settings for image generation
- No image style customization options (maintain current style)
- No automatic quality scoring or ML-based quality assessment
- No cost optimization beyond using GPT-4 Turbo (no caching, no fine-tuning)
- No A/B testing infrastructure or automated metrics dashboards
- No priority-based generation queues or user preference learning
- No integration with alternative image generation models (only Stable Diffusion via Replicate)

## Design Considerations

**LLM Prompt Engineering:**

- Story analysis should extract: main subject, setting/environment, mood/atmosphere, key visual elements, artistic style
- Prompts should be concise (under 200 tokens) to balance cost and quality
- Include composition guidance (single cohesive scene, clear focal point)

**Error Handling:**

- LLM failures should be silent to users (automatic fallback maintains UX)
- Log errors with sufficient context for debugging (story ID, error type, timestamp)
- Retry logic should handle rate limits, timeouts, and API errors

**Negative Prompts:**
Example comprehensive negative prompt: "blurry, out of focus, distorted, deformed, multiple scenes, split image, collage, low quality, pixelated, grainy, watermark, text, letters, numbers, cropped, cut off"

## Technical Considerations

**Cost Impact:**

- GPT-4 Turbo cost: ~$0.01-0.02 per image generation (story analysis)
- Increased Stable Diffusion inference steps: minor cost increase (~10%)
- Monitor total cost per image generation in logs

**Performance Trade-offs:**

- Current average: 45 seconds
- LLM overhead: +5-10 seconds (acceptable under 60s target)
- Enhanced SD parameters: +5-10 seconds
- Total expected: 55-65 seconds (may exceed 60s target by 5s)

**Dependencies:**

- OpenAI API (GPT-4 Turbo)
- Replicate API (Stable Diffusion)
- Existing safety filter service
- Feature flag configuration system

**Integration Points:**

- Reuse existing `openai.ts` service infrastructure
- Maintain compatibility with current `imageGeneration.ts` API
- No changes to frontend image display components

## Success Metrics

**Primary (User Satisfaction):**

- Manual QA comparison: 30 test images before/after shows clear quality improvement
- Subjective quality rating: new system images rated higher by reviewers
- Image-to-story relevance: reviewers confirm better contextual alignment

**Secondary (Technical Baseline):**

- Image generation success rate ≥95% (maintain current baseline)
- Average generation time <65s (allowing 5s buffer beyond initial 60s target)
- LLM fallback rate <5% (high reliability of GPT-4 service)
- Zero production incidents during rollout

**Validation Criteria:**

- At least 80% of QA test images show noticeable quality improvement
- No increase in user-reported image quality issues
- Successful completion of 10% → 50% → 100% rollout without rollback

## Open Questions

1. Should we add prompt caching for similar stories to reduce LLM costs?
2. What is the acceptable cost increase per image generation?
3. Should we log user feedback mechanisms for future quality tracking?
4. Do we need to document prompt engineering guidelines for future iterations?
5. Should the gradual rollout be time-based (days) or volume-based (request count)?

## Implementation Phases

**Week 1-2: Phase 1 - Core LLM Integration**

- Implement `generatePromptWithLLM()` method
- Add GPT-4 story analysis in `openai.ts`
- Build automatic fallback system
- Add retry logic and error handling
- Integrate into main generation flow
- Preserve safety filtering

**Week 3: Phase 2 - Enhanced Stable Diffusion Parameters**

- Update `callReplicateAPI()` with optimized parameters
- Test generation time impact
- Validate quality improvements

**Week 4: Phase 3 - Safety & Rollout**

- Implement feature flag system
- Execute manual QA (30 image comparison)
- Document results and rollback procedure
- Gradual production rollout: 10% → 50% → 100%
- Monitor error rates and generation times
- Document LLM prompt engineering best practices

## Rollback Plan

**Instant Rollback:**

1. Set `USE_LLM_PROMPT_GENERATION` feature flag to `false`
2. System immediately reverts to keyword extraction
3. No code deployment needed
4. Zero downtime

**Automatic Fallback:**

- LLM failures already fallback to keyword extraction
- No user impact during individual failures
- Production stability maintained

**No Data Migrations:**

- Zero database changes means no migration rollback needed
- No data integrity concerns
- Safe to toggle feature flag repeatedly for testing
