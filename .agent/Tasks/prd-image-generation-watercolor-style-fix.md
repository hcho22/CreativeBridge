# PRD: Image Generation Watercolor Style Fix

## Introduction

Fix the image generation system to consistently enforce grade-appropriate art styles, particularly the watercolor children's book illustration style for K-2 and 3-5 grade levels. Currently, the grade-level art style definitions exist in the codebase (`ART_STYLE_MAPPING` in [imageGeneration.ts](src/services/imageGeneration.ts)) but are **not being consistently applied** when generating prompts for Stable Diffusion, especially in the primary LLM-based prompt generation path (`generateStorySpecificPrompt`). This results in photorealistic images instead of age-appropriate watercolor illustrations, breaking immersion for young readers and violating educational best practices.

## Goals

- Ensure **all grade levels** (K-2, 3-5, 6-8, 9-12) consistently use their appropriate art styles from `ART_STYLE_MAPPING`
- Fix the primary LLM-based prompt generation path (`generateStorySpecificPrompt`) to enforce art style definitions
- Validate that generated prompts contain the correct grade-level style keywords before sending to Stable Diffusion
- Implement comprehensive testing across all grade levels with visual validation
- Maintain backward compatibility with existing prompt generation fallback paths

## User Stories

### US-001: Fix LLM Prompt Generation to Enforce Art Styles

**Description:** As a developer, I need the `generateStorySpecificPrompt` method to consistently apply grade-level art style definitions so that all generated images match the appropriate artistic style for the target grade level.

**Acceptance Criteria:**

- [x] Update `generateStorySpecificPrompt` method in [imageGeneration.ts:10191](src/services/imageGeneration.ts#L10191) to use the full `ArtStyleDefinition` object instead of only `baseStyle`
- [x] Ensure all art style properties are included: `baseStyle`, `colorPalette`, `visualComplexity`, `artisticTechnique`, `emotionalTone`, `layoutStyle`, `characterStyle`, `backgroundStyle`
- [x] Add logging to verify art style enforcement in the prompt generation flow
- [ ] Code compiles without TypeScript errors
- [ ] Unit tests pass for prompt generation

### US-002: Add Validation Layer for Generated Prompts

**Description:** As a developer, I need a validation step that checks generated prompts contain the correct grade-level art style keywords before sending to Stable Diffusion, providing a safety net to catch any prompts that slip through without proper styling.

**Acceptance Criteria:**

- [ ] Create new method `validatePromptStyleKeywords(prompt: string, gradeLevel: GradeLevel): ValidationResult`
- [ ] Method checks for presence of critical art style keywords from `ART_STYLE_MAPPING[gradeLevel]`
- [ ] If validation fails, log warning and regenerate prompt using fallback path (`generateEnhancedGradeAppropriatePrompt`)
- [ ] Add telemetry to track validation failures for monitoring
- [ ] Unit tests cover validation logic for all grade levels
- [ ] Integration tests verify fallback behavior
- [ ] Typecheck passes

### US-003: Comprehensive Testing Across All Grade Levels

**Description:** As a QA engineer, I need comprehensive automated and manual tests that verify prompt generation works correctly for all grade levels, ensuring consistent art style enforcement across the entire system.

**Acceptance Criteria:**

- [ ] Create test suite `src/__tests__/services/artStyleEnforcement.test.ts` covering all grade levels
- [ ] For each grade level (K-2, 3-5, 6-8, 9-12), verify generated prompts contain critical style keywords
- [ ] Test both primary path (`generateStorySpecificPrompt`) and fallback paths
- [ ] Add regression tests using real story content from different genres (adventure, friendship, mystery)
- [ ] Document test cases with expected style keywords per grade level
- [ ] All tests pass with 100% success rate
- [ ] Typecheck passes

### US-004: Manual Visual Validation with Test Stories

**Description:** As a product manager, I need to manually generate test images for each grade level and visually verify they match the appropriate artistic style, ensuring the fix achieves the intended user experience.

**Acceptance Criteria:**

- [ ] Create test script `scripts/validate-art-styles.ts` that generates images for each grade level
- [ ] Generate at least 3 test images per grade level using different story content
- [ ] Visually inspect K-2 images to confirm watercolor children's book illustration style (not photorealistic)
- [ ] Visually inspect 3-5 images to confirm appropriate artistic style per `ART_STYLE_MAPPING`
- [ ] Visually inspect 6-8 and 9-12 images to confirm their respective styles
- [ ] Document before/after examples showing the fix's impact
- [ ] Create validation report in `.agent/Tasks/art-style-validation-report.md`

### US-005: Update Fallback Paths for Consistency

**Description:** As a developer, I need to ensure all prompt generation fallback paths (not just the primary LLM path) consistently enforce art style definitions, preventing style regression in edge cases.

**Acceptance Criteria:**

- [ ] Audit all methods that generate prompts: `generateAdvancedPrompt`, `buildVisualElements`, `generateMinimalQualityPrompt`
- [ ] Verify each method receives and uses the full `ArtStyleDefinition` object
- [ ] Ensure fallback prompts are constructed with the same art style enforcement as primary path
- [ ] Add unit tests for each fallback method to verify style keyword inclusion
- [ ] Typecheck passes
- [ ] All existing tests continue to pass (no regressions)

### US-006: Documentation and Code Comments

**Description:** As a future developer, I need clear documentation and code comments explaining the art style enforcement system so I can maintain and extend it without accidentally breaking the style consistency.

**Acceptance Criteria:**

- [ ] Add JSDoc comments to `generateStorySpecificPrompt` explaining art style enforcement requirements
- [ ] Add JSDoc comments to `validatePromptStyleKeywords` explaining validation logic
- [ ] Update `.agent/System/project_architecture.md` to document the art style enforcement system
- [ ] Create `.agent/SOP/image-generation-art-styles.md` with guidelines for maintaining art style consistency
- [ ] Document the prompt generation tier system (Tier 1: Story Specific, Tier 2: NER Analysis, Tier 3: Basic Fallback)
- [ ] Include code examples showing proper art style usage

## Functional Requirements

**FR-1: Art Style Enforcement in Primary Path**
The `generateStorySpecificPrompt` method (primary code path) MUST incorporate all properties from the `ART_STYLE_MAPPING[gradeLevel]` object when building prompts, not just the `baseStyle` property.

**FR-2: Validation Layer**
Before sending any prompt to Stable Diffusion, the system MUST validate that the prompt contains critical art style keywords appropriate for the target grade level. If validation fails, the system MUST regenerate the prompt using a fallback method.

**FR-3: Keyword Coverage Requirements**
A valid prompt MUST include at minimum:

- The `baseStyle` keyword (e.g., "watercolor children's book illustration" for K-2)
- At least one keyword from `colorPalette` (e.g., "bright", "soft pastels")
- At least one keyword from `artisticTechnique` (e.g., "watercolor", "digital painting")

**FR-4: Grade Level Coverage**
The fix MUST apply to all grade levels:

- **K-2**: "watercolor children's book illustration" with bright colors and simple shapes
- **3-5**: "digital storybook illustration" with vibrant colors and moderate detail
- **6-8**: "digital illustration" or "semi-realistic art" with sophisticated composition
- **9-12**: "detailed digital painting" or "realistic illustration" with mature visual elements

**FR-5: Logging and Monitoring**
The system MUST log:

- Which prompt generation path was used (Tier 1, Tier 2, or Tier 3)
- Whether validation passed or failed
- Which art style keywords were successfully included
- Any fallback to alternative prompt generation methods

**FR-6: Backward Compatibility**
The fix MUST NOT break existing prompt generation for stories that already work correctly. All existing unit and integration tests MUST continue to pass.

## Non-Goals (Out of Scope)

- **Regenerating existing images**: This fix only affects future image generation. We will NOT automatically detect and regenerate images from existing stories with incorrect styles.
- **Manual regeneration tooling**: We will NOT build tooling to allow users to manually regenerate individual images (separate feature).
- **Changing `ART_STYLE_MAPPING` definitions**: The existing art style definitions in [imageGeneration.ts:328](src/services/imageGeneration.ts#L328) are considered correct. This fix is about enforcing them, not changing them.
- **Prompt optimization for quality**: This fix focuses on art style consistency, not improving overall image quality or relevance (separate feature: [prd-image-generation-quality-improvement.md](prd-image-generation-quality-improvement.md)).
- **Multi-image generation**: Support for generating multiple images per story section is out of scope.

## Design Considerations

### Current Prompt Generation Flow

The system uses a tiered approach (see [imageGeneration.ts:1539](src/services/imageGeneration.ts#L1539)):

1. **Tier 1 - Story Specific** (`generateStorySpecificPrompt`): Primary LLM-based path extracting visual elements directly from story content
2. **Tier 2 - NER Analysis** (`generateAdvancedPrompt`): Advanced named entity recognition and narrative sequence analysis
3. **Tier 3 - Basic Fallback** (`generateEnhancedGradeAppropriatePrompt`): Basic story analysis with full art style enforcement

**Problem**: Tier 1 (the primary path) only uses `artStyleDefinition.baseStyle` and ignores other critical style properties like `colorPalette`, `visualComplexity`, `artisticTechnique`, etc.

### Proposed Fix Architecture

```typescript
// BEFORE (Tier 1 - Missing style enforcement)
private generateStorySpecificPrompt(
  storyContent: string,
  gradeLevel: GradeLevel,
  artStyleDefinition: ArtStyleDefinition,
): string {
  let prompt = `Create a ${artStyleDefinition.baseStyle}`; // ❌ Only uses baseStyle
  // ... builds prompt without other style properties
}

// AFTER (Tier 1 - Full style enforcement)
private generateStorySpecificPrompt(
  storyContent: string,
  gradeLevel: GradeLevel,
  artStyleDefinition: ArtStyleDefinition,
): string {
  // Start with base style
  let prompt = `Create a ${artStyleDefinition.baseStyle}`;

  // ... add story-specific content (character, objects, setting)

  // ✅ ADD: Enforce remaining art style properties
  prompt += `, ${artStyleDefinition.colorPalette}`;
  prompt += `, ${artStyleDefinition.visualComplexity}`;
  prompt += `, rendered in ${artStyleDefinition.artisticTechnique}`;
  prompt += `, ${artStyleDefinition.emotionalTone}`;
  prompt += `, ${artStyleDefinition.characterStyle}`;

  return prompt;
}
```

### Validation Layer Design

```typescript
interface StyleValidationResult {
  isValid: boolean;
  missingKeywords: string[];
  matchedKeywords: string[];
  validationErrors: string[];
}

private validatePromptStyleKeywords(
  prompt: string,
  gradeLevel: GradeLevel
): StyleValidationResult {
  const style = ART_STYLE_MAPPING[gradeLevel];
  const requiredKeywords = [
    style.baseStyle,
    // Extract 1-2 keywords from each property
  ];

  // Check for keyword presence
  const matchedKeywords = requiredKeywords.filter(kw =>
    prompt.toLowerCase().includes(kw.toLowerCase())
  );

  // Validation passes if we have baseStyle + at least 2 other properties
  const isValid = matchedKeywords.length >= 3;

  return { isValid, missingKeywords, matchedKeywords, validationErrors };
}
```

### UI/UX Requirements

**No UI changes required** - this is a backend fix that improves image quality without user-facing changes.

### Existing Components to Leverage

- `ART_STYLE_MAPPING` constant ([imageGeneration.ts:328](src/services/imageGeneration.ts#L328)) - Single source of truth for grade-level styles
- `generateEnhancedGradeAppropriatePrompt` ([imageGeneration.ts:7250](src/services/imageGeneration.ts#L7250)) - Already correctly enforces all art style properties (reference implementation)
- Existing test infrastructure in `src/__tests__/acceptance/gradeLevelStyles.test.ts`

## Technical Considerations

### Integration Points

1. **OpenAI Client** ([openaiClient.ts](src/services/openaiClient.ts)): Not directly modified, but LLM responses will be validated
2. **Replicate API** ([imageGeneration.ts](src/services/imageGeneration.ts)): Receives improved prompts with proper style enforcement
3. **Story Session Manager** ([storySessionManager.ts](src/services/storySessionManager.ts)): Calls image generation service (no changes needed)

### Performance Considerations

- **Validation overhead**: Minimal (~1-2ms per prompt validation using simple string matching)
- **Regeneration cost**: If validation fails, one additional prompt generation call (~100-200ms)
- **Expected validation failure rate**: <5% based on existing prompt quality

### Dependencies

- No new dependencies required
- Uses existing TypeScript types and services
- Leverages existing `ART_STYLE_MAPPING` constant

### Testing Strategy

1. **Unit Tests**: Test each prompt generation method in isolation
2. **Integration Tests**: Test full image generation flow with real story content
3. **Acceptance Tests**: Expand existing `gradeLevelStyles.test.ts` to cover all grade levels
4. **Manual Visual Validation**: Generate real images and inspect artistic style
5. **Regression Tests**: Ensure existing stories continue to generate correct images

### Error Handling

- If validation fails, log warning and fallback to `generateEnhancedGradeAppropriatePrompt` (known-good implementation)
- If all prompt generation methods fail, use `generateMinimalQualityPrompt` as last resort
- Track validation failures in monitoring for ongoing improvement

## Success Metrics

### Quantitative Metrics

- **100% prompt style keyword inclusion**: Every generated prompt MUST contain critical art style keywords for its grade level
- **<5% validation failure rate**: Less than 5% of prompts should fail initial validation and require regeneration
- **0 test failures**: All unit, integration, and acceptance tests MUST pass
- **0 TypeScript errors**: Full typecheck compliance

### Qualitative Metrics

- **K-2 images look like watercolor children's books**: Manual visual inspection confirms watercolor illustration style, NOT photorealistic
- **All grade levels match their defined styles**: Each grade level's images visually match the style described in `ART_STYLE_MAPPING`
- **No regressions**: Existing stories that generated correct images before continue to do so

### Validation Criteria

A generated image is considered **correct** if:

1. The prompt contains the `baseStyle` keyword for the grade level
2. The prompt contains keywords from at least 2 additional style properties (e.g., `colorPalette` + `artisticTechnique`)
3. The generated image visually matches the expected artistic style when manually inspected

## Open Questions

None - all requirements are clear based on user answers.

## Related Documentation

- **Existing PRDs**:

  - [Image Generation Quality Improvement](prd-image-generation-quality-improvement.md) - Related feature for LLM-based prompt generation (broader scope)
  - [Claude Skills Integration](TASKS-claude-skills-integration-PRD.md) - Advanced AI optimization (could be used for future prompt quality improvements)

- **System Documentation**:

  - [Project Architecture](.agent/System/project_architecture.md) - Overview of image generation system architecture
  - [Development SOPs](.agent/SOP/development_procedures.md) - Testing and deployment procedures

- **Code References**:
  - [imageGeneration.ts](src/services/imageGeneration.ts) - Main service file containing all prompt generation logic
  - [ART_STYLE_MAPPING constant](src/services/imageGeneration.ts#L328) - Grade-level art style definitions (single source of truth)
  - [generateStorySpecificPrompt](src/services/imageGeneration.ts#L10191) - Primary LLM-based prompt generation method (needs fix)
  - [generateEnhancedGradeAppropriatePrompt](src/services/imageGeneration.ts#L7250) - Reference implementation with correct art style enforcement

---

**PRD Status**: Draft
**Created**: 2026-01-23
**Priority**: High (Critical bug affecting K-2 user experience)
**Estimated Effort**: Medium (2-3 focused development sessions)
**Target Grade Levels**: All (K-2, 3-5, 6-8, 9-12)
**Primary Impact**: K-2 and 3-5 watercolor illustration consistency
