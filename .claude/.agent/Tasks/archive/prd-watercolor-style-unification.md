# PRD: Unify All Grade Levels to Watercolor Painting Style

## Introduction

Currently, the image generation system uses progressively more realistic art styles as grade level increases: K-2 (watercolor) -> 3-5 (digital illustration) -> 6-8 (realistic digital) -> 9-12 (sophisticated digital art). This change unifies all grades to use **watercolor painting** as the sole artistic medium, while preserving age-appropriate complexity scaling in visual detail, composition, and layout. Only the art medium/technique properties change — existing color palettes and emotional tones remain per-grade.

## Goals

- Unify all grade levels (K-2, 3-5, 6-8, 9-12) to watercolor painting as the base art style
- Preserve grade-appropriate complexity scaling (simple watercolor for K-2, sophisticated watercolor for 9-12)
- Keep existing color palettes and emotional tones unchanged per grade
- Update all affected tests to validate the new watercolor-only style
- Update internal documentation (CLAUDE.md, SOP) to reflect the change

## User Stories

### US-001: Update `ART_STYLE_MAPPING` for Grades 3-5, 6-8, 9-12

**Description:** As a developer, I need to change the primary art style mapping constants so all grades use watercolor as the artistic medium while keeping grade-appropriate complexity.

**Acceptance Criteria:**

- [x] `ART_STYLE_MAPPING['3-5'].baseStyle` changed from `"detailed children's book illustration"` to `"watercolor children's book illustration"`
- [x] `ART_STYLE_MAPPING['3-5'].artisticTechnique` changed from `"digital painting, clean line art, smooth color gradients"` to `"watercolor painting style, textured brushstrokes, layered color washes"`
- [x] `ART_STYLE_MAPPING['3-5'].characterStyle` changed from `"semi-realistic characters, expressive poses, diverse representation"` to `"expressive watercolor characters, lively poses, diverse representation"`
- [x] `ART_STYLE_MAPPING['6-8'].baseStyle` changed from `"realistic digital illustration"` to `"watercolor illustration"`
- [x] `ART_STYLE_MAPPING['6-8'].artisticTechnique` changed from `"digital art, realistic shading, texture work, professional illustration"` to `"watercolor painting style, rich wet-on-wet techniques, expressive brush work, detailed washes"`
- [x] `ART_STYLE_MAPPING['6-8'].visualComplexity` changed from `"high detail, complex compositions, realistic proportions"` to `"high detail, complex compositions, well-proportioned figures"`
- [x] `ART_STYLE_MAPPING['6-8'].characterStyle` changed from `"realistic human figures, detailed facial expressions, action poses"` to `"detailed watercolor characters, expressive facial features, action poses"`
- [x] `ART_STYLE_MAPPING['6-8'].backgroundStyle` changed from `"detailed realistic environments, atmospheric perspective, world-building"` to `"detailed watercolor environments, atmospheric washes, layered depth"`
- [x] `ART_STYLE_MAPPING['9-12'].baseStyle` changed from `"sophisticated digital art"` to `"sophisticated watercolor art"`
- [x] `ART_STYLE_MAPPING['9-12'].artisticTechnique` changed from `"professional digital art, advanced lighting, realistic materials and textures"` to `"professional watercolor technique, advanced color layering, expressive washes and textures"`
- [x] `ART_STYLE_MAPPING['9-12'].characterStyle` changed from `"realistic human anatomy, nuanced expressions, diverse and inclusive"` to `"detailed watercolor figures, nuanced expressions, diverse and inclusive"`
- [x] `ART_STYLE_MAPPING['9-12'].backgroundStyle` changed from `"photorealistic environments, architectural accuracy, atmospheric realism"` to `"richly detailed watercolor environments, architectural detail, atmospheric depth"`
- [x] K-2 mapping remains **unchanged**
- [x] `colorPalette`, `emotionalTone`, and `layoutStyle` remain **unchanged** for all grades
- [x] Typecheck passes (no new errors introduced; pre-existing errors in unrelated files only)

**Validation Test:**

```bash
npm test -- --testPathPattern="services/enhancedArtStyleMapping" --verbose
```

All tests in `enhancedArtStyleMapping.test.ts` must pass (updated in US-004).

---

### US-002: Update `SIMPLE_ART_STYLE_MAPPING` for Grades 3-5, 6-8, 9-12

**Description:** As a developer, I need to update the simplified backward-compatible string mapping so it also reflects watercolor for all grades.

**Acceptance Criteria:**

- [x] `SIMPLE_ART_STYLE_MAPPING['3-5']` changed to `"watercolor children's book illustration, vibrant colors, expressive watercolor style with engaging details"`
- [x] `SIMPLE_ART_STYLE_MAPPING['6-8']` changed to `"watercolor illustration, detailed artwork, adventure book style, dynamic composition"`
- [x] `SIMPLE_ART_STYLE_MAPPING['9-12']` changed to `"sophisticated watercolor art, expressive style, detailed environments, mature artistic composition"`
- [x] K-2 mapping remains **unchanged**
- [x] Typecheck passes

**Validation Test:**

```bash
npm test -- --testPathPattern="services/artStyleEnforcement" --verbose
```

Fallback `getArtStyleForGrade` tests must pass (updated in US-005).

---

### US-003: Update `getGradeSpecificEnhancements()` Method

**Description:** As a developer, I need to update the grade-specific hint strings to replace "realistic" references with watercolor references.

**Acceptance Criteria:**

- [x] Grade 6-8 return value changed from `"more realistic details, dynamic composition, appealing to pre-teens"` to `"more watercolor detail, dynamic composition, appealing to pre-teens"`
- [x] Grade 9-12 return value changed from `"sophisticated artistry, realistic proportions, mature but appropriate content"` to `"sophisticated watercolor artistry, well-proportioned figures, mature but appropriate content"`
- [x] K-2 and 3-5 return values remain **unchanged**
- [x] Typecheck passes

**Validation Test:**

```bash
npm test -- --testPathPattern="services/artStyleEnforcement" --verbose
```

Regression tests that call `generateStorySpecificPrompt` must still pass.

---

### US-004: Update `enhancedArtStyleMapping.test.ts`

**Description:** As a developer, I need to update the enhanced art style mapping test to expect watercolor keywords for all grades.

**File:** `src/__tests__/services/enhancedArtStyleMapping.test.ts`

**Acceptance Criteria:**

- [x] Test `"should use enhanced art style definitions for 3-5"` (line 31): Update assertions:
  - `expect(prompt).toContain("watercolor children's book illustration")` (was `"detailed children's book illustration"`)
  - `expect(prompt).toContain("watercolor painting style, textured brushstrokes")` (was `"digital painting, clean line art"`)
  - `expect(prompt).toContain("expressive watercolor characters, lively poses")` (was `"semi-realistic characters, expressive poses"`)
- [x] Test `"should use enhanced art style definitions for 6-8"` (line 48): Update assertions:
  - `expect(prompt).toContain("watercolor illustration")` (was `"realistic digital illustration"`)
  - `expect(prompt).toContain("high detail, complex compositions, well-proportioned figures")` (was `"high detail, complex compositions, realistic proportions"`)
  - `expect(prompt).toContain("watercolor painting style, rich wet-on-wet techniques")` (was `"digital art, realistic shading, texture work"`)
  - `expect(prompt).toContain("detailed watercolor characters, expressive facial features")` (was `"realistic human figures, detailed facial expressions"`)
- [x] Test `"should use enhanced art style definitions for 9-12"` (line 69): Update assertions:
  - `expect(prompt).toContain("sophisticated watercolor art")` (was `"sophisticated digital art"`)
  - `expect(prompt).toContain("professional watercolor technique, advanced color layering")` (was `"professional digital art, advanced lighting"`)
  - `expect(prompt).toContain("detailed watercolor figures, nuanced expressions")` (was `"realistic human anatomy, nuanced expressions"`)
- [x] Test `"should integrate story scenes with enhanced background styles"` (line 118): Update:
  - `expect(cityPrompt).toContain("detailed watercolor environments, atmospheric washes")` (was `"detailed realistic environments, atmospheric perspective"`)
- [x] K-2 test assertions remain **unchanged**
- [x] Emotional tone and prompt structure tests remain **unchanged**

**Validation Test:**

```bash
npm test -- --testPathPattern="services/enhancedArtStyleMapping" --verbose
```

All 10 tests must pass.

---

### US-005: Update `artStyleEnforcement.test.ts`

**Description:** As a developer, I need to update the art style enforcement tests to expect watercolor keywords for grades 3-5, 6-8, 9-12.

**File:** `src/__tests__/services/artStyleEnforcement.test.ts`

**Acceptance Criteria:**

- [x] **3-5 section (line 146):** Update describe name to `"Grade Level 3-5: Watercolor Children's Book Illustration"`

  - Test `"should contain detailed illustration base style keywords"` (line 149): Change assertions to expect `watercolor` keyword match
  - Test `"should contain digital painting technique keywords"` (line 186): Rename to `"should contain watercolor painting technique keywords"`, assert `expect(prompt).toMatch(/watercolor|painting/i)`
  - Test `"should use semi-realistic character style"` (line 220): Rename to `"should use expressive watercolor character style"`, assert `expect(prompt).toMatch(/watercolor|expressive/i)`
  - Test `"fallback: getArtStyleForGrade returns correct 3-5 style"` (line 237): Update to expect `"watercolor children's book"`, `"vibrant colors"`, `"watercolor style"`
  - Regression test `"3-5: Adventure story maintains detailed illustration style"` (line 467): Update to expect `/watercolor/i` match
  - Regression test `"3-5: Friendship story maintains detailed illustration style"` (line 551): Update to expect `/watercolor/i` match
  - Regression test `"3-5: Mystery story maintains detailed illustration style"` (line 634): Update to expect `/watercolor/i` match

- [x] **6-8 section (line 246):** Update describe name to `"Grade Level 6-8: Watercolor Illustration"`

  - Test `"should contain realistic digital illustration base style keywords"` (line 249): Rename to `"should contain watercolor illustration base style keywords"`, assert `/watercolor/i` instead of `/realistic/i` and `/digital/i`
  - Test `"should use realistic character style"` (line 319): Rename to `"should use watercolor character style"`, assert `/watercolor/i`
  - Test `"fallback: getArtStyleForGrade returns correct 6-8 style"` (line 336): Update to expect `"watercolor illustration"`, `"detailed artwork"`, `"adventure book style"`
  - Regression tests for 6-8 (adventure line 488, friendship line 571, mystery line 654): Update to expect `/watercolor/i` instead of `/realistic/i` and `/digital/i`

- [x] **9-12 section (line 345):** Update describe name to `"Grade Level 9-12: Sophisticated Watercolor Art"`

  - Test `"should contain sophisticated digital art base style keywords"` (line 348): Rename to `"should contain sophisticated watercolor art base style keywords"`, assert `/watercolor/i` instead of `/digital/i`
  - Test `"should use professional digital art technique"` (line 418): Rename to `"should use professional watercolor technique"`, assert `/watercolor/i` instead of `/digital/i`
  - Test `"fallback: getArtStyleForGrade returns correct 9-12 style"` (line 436): Update to expect `"sophisticated watercolor art"`, `"expressive style"`, `"mature artistic composition"`
  - Regression tests for 9-12: Keep `/sophisticated/i` and `/professional/i`; no `/digital/i` assertions needed

- [x] **Fallback path tests (line 695):**

  - Test `"generatePrompt fallback maintains 3-5 illustration style"` (line 710): Add `expect(prompt).toMatch(/watercolor/i)`
  - Test `"generatePrompt fallback maintains 6-8 realistic style"` (line 725): Rename to `"generates 6-8 watercolor style"`, assert `/watercolor/i` instead of `/realistic/i` and `/digital/i`
  - Test `"generatePrompt fallback maintains 9-12 sophisticated style"` (line 740): Keep `/sophisticated/i` and `/professional/i`

- [x] K-2 tests remain **unchanged**
- [x] Cross-grade consistency tests remain **unchanged** (they use generic regex like `/simple/i`, `/moderate/i` etc.)
- [x] Edge case tests remain **unchanged**

**Validation Test:**

```bash
npm test -- --testPathPattern="services/artStyleEnforcement" --verbose
```

All 30 tests must pass.

---

### US-006: Update `promptStyleValidation.test.ts`

**Description:** As a developer, I need to update the prompt validation tests to use watercolor keywords for grades 3-5, 6-8, 9-12.

**File:** `src/__tests__/services/promptStyleValidation.test.ts`

**Acceptance Criteria:**

- [x] **3-5 section (line 101):**

  - Test `"should pass validation with all required art style keywords"` (line 104): Rewrite `validPrompt` to contain watercolor keywords: `"Create a watercolor children's book illustration showing characters on an adventure, vibrant colors, rich earth tones, watercolor painting style, textured brushstrokes, adventurous and exciting, dynamic composition, expressive watercolor characters, detailed environments"`
  - Test `"should fail validation with K-2 style instead of 3-5 style"` (line 113): Rework — since both K-2 and 3-5 now use watercolor base, change the test to validate that a prompt with the _wrong_ baseStyle (e.g., `"realistic digital illustration"`) fails validation for 3-5
  - Test `"should validate coverage percentage calculation"` (line 124): Update `partialPrompt` to start with `"Create a watercolor children's book illustration"`
  - **Minimum keyword test** (line 285): Update 3-5 entry: `baseStyle` -> `"watercolor children's book illustration"`, `prop2` -> `"watercolor painting style"`

- [x] **6-8 section (line 134):**

  - Test `"should pass validation with realistic digital illustration style"` (line 137): Rename, rewrite `validPrompt` to: `"Create a watercolor illustration with sophisticated color schemes, dramatic lighting, high detail, complex compositions, watercolor painting style, rich wet-on-wet techniques, adventurous and heroic, dynamic action compositions, detailed watercolor characters, detailed watercolor environments"`
  - Test `"should fail validation with childish watercolor style"` (line 146): Rework — since 6-8 now IS watercolor, change to test that a prompt with a completely wrong baseStyle (e.g., `"sophisticated digital art"`) fails for 6-8
  - **Minimum keyword test** (line 289): Update 6-8 entry: `baseStyle` -> `"watercolor illustration"`, `prop2` -> `"watercolor painting style"`

- [x] **9-12 section (line 155):**

  - Test `"should pass validation with sophisticated digital art style"` (line 158): Rename, rewrite `validPrompt` to: `"Create a sophisticated watercolor art with mature color palettes, subtle gradients, professional watercolor technique, advanced color layering, thoughtful and inspiring, artistic composition, detailed watercolor figures, richly detailed watercolor environments"`
  - Test `"should fail validation with lower grade level styles"` (line 167): Rework — change `wrongStylePrompt` to use a non-watercolor baseStyle like `"realistic digital illustration with bright colors"`
  - **Minimum keyword test** (line 293): Update 9-12 entry: `baseStyle` -> `"sophisticated watercolor art"`, `prop2` -> `"professional watercolor technique"`

- [x] K-2 tests remain **unchanged**
- [x] Edge case and validation structure tests remain **unchanged**
  - **Note:** Pre-existing failure in `"should calculate coverage percentage correctly"` (K-2 coverage returns 58%, expects >70%) — this test was already failing before watercolor changes and is outside US-006 scope

**Validation Test:**

```bash
npm test -- --testPathPattern="services/promptStyleValidation" --verbose
```

All 14 tests must pass.

---

### US-007: Update `gradeLevelStyles.test.ts` (Acceptance Tests)

**Description:** As a developer, I need to update the acceptance test's expected elements and validator logic to reflect watercolor for all grades.

**File:** `src/__tests__/acceptance/gradeLevelStyles.test.ts`

**Acceptance Criteria:**

- [x] Update `expectedElements['3-5'].artStyle` (line 86): Change from `['detailed illustration', 'semi-realistic', 'adventure book style', 'dynamic']` to `['watercolor', 'illustration', 'expressive', 'dynamic']`
- [x] Update `expectedElements['6-8'].artStyle` (line 113): Change from `['realistic illustration', 'detailed artwork', 'cinematic', 'professional quality']` to `['watercolor', 'illustration', 'detailed artwork', 'expressive']`
- [x] Update `expectedElements['9-12'].artStyle` (line 140): Change from `['artistic composition', 'realistic detail', 'conceptual elements', 'professional grade']` to `['watercolor', 'sophisticated', 'artistic composition', 'expressive']`
- [x] Update `identifyStyleIssues()` switch cases (line 309):
  - **3-5 (line 319):** Change check from `!style.includes('detailed') && !style.includes('illustration')` to `!style.includes('watercolor') && !style.includes('illustration')`
  - **6-8 (line 325):** Change check from `!style.includes('realistic') && !style.includes('detailed')` to `!style.includes('watercolor') && !style.includes('detailed')`
- [x] Update `generateRecommendations()` switch cases (line 392):
  - **3-5 (line 401):** Change from `"Include detailed children's book illustration style"` to `"Include watercolor children's book illustration style"`
  - **6-8 (line 411):** Change from `"Specify realistic digital illustration style"` to `"Specify watercolor illustration style"`, change from `"sophisticated color palettes and dramatic elements"` to `"watercolor color palettes and expressive elements"`
- [x] Update test `"should include realistic and detailed elements for 6-8"` (line 565): Rename to `"should include watercolor and detailed elements for 6-8"`, change `expect(style.toLowerCase()).toMatch(/realistic|detailed|digital illustration/)` to `expect(style.toLowerCase()).toMatch(/watercolor|detailed|illustration/)`; change second assertion from `/adventure book|cinematic/` to `/adventure book|watercolor/`
- [x] Update test `"should include sophisticated artistic elements for 9-12"` (line 602): Change `enhancedStyle.artisticTechnique` assertion from `/professional|advanced|complex/i` to `/professional|watercolor|advanced/i`
- [x] K-2 tests remain **unchanged**

**Validation Test:**

```bash
npm test -- --testPathPattern="acceptance/gradeLevelStyles" --verbose
```

All 18 tests must pass.

---

### US-008: Update Documentation

**Description:** As a developer, I need to update internal documentation to reflect the unified watercolor style.

**Acceptance Criteria:**

- [x] `src/services/CLAUDE.md` (line 34): Change `Art styles defined in ART_STYLE_MAPPING (K-2 watercolor, 3-5 digital, 6-8 realistic, 9-12 sophisticated)` to `Art styles defined in ART_STYLE_MAPPING (all grades use watercolor with age-appropriate complexity)`
- [x] `.claude/.agent/SOP/image-generation-art-styles.md`: Update all references describing different art styles per grade to reflect watercolor for all grades
- [x] `.claude/.agent/System/project_architecture.md`: Update grade-level art style descriptions if present

**Validation Test:**

```bash
grep -r "realistic digital" src/services/CLAUDE.md .claude/.agent/SOP/image-generation-art-styles.md .claude/.agent/System/project_architecture.md
```

Should return no matches (confirms old style references are removed).

---

## Functional Requirements

- FR-1: All four grade levels (K-2, 3-5, 6-8, 9-12) must use "watercolor" as the base artistic medium in `ART_STYLE_MAPPING`
- FR-2: All four grade levels must use "watercolor" in `SIMPLE_ART_STYLE_MAPPING`
- FR-3: `getGradeSpecificEnhancements()` must not contain "realistic" for any grade level
- FR-4: Grade-appropriate **complexity scaling** must be preserved (`visualComplexity` progresses from "simple" to "complex/intricate")
- FR-5: Grade-appropriate **color palettes** and **emotional tones** must remain unchanged
- FR-6: The `enhancedPromptGenerator.ts` (`GRADE_LEVEL_STYLES`) is **NOT** modified (out of scope)
- FR-7: The prompt validation system (`validatePromptStyleKeywords`) automatically adapts since it reads from `ART_STYLE_MAPPING` — no logic changes needed
- FR-8: All existing tests must be updated and pass with the new watercolor style assertions
- FR-9: Safety constraints ("Safe for children", "appropriate content") must remain in all generated prompts

## Non-Goals (Out of Scope)

- Changing `enhancedPromptGenerator.ts` `GRADE_LEVEL_STYLES` (per user choice 3C)
- Unifying color palettes or emotional tones across grades (per user choice 2A — only art medium/technique changes)
- Updating archived PRD documents (`.claude/.agent/Tasks/archive/`)
- Modifying the prompt validation logic — only the data it validates against changes
- Changing the 3-tier prompt generation pipeline structure
- Modifying Convex backend schema or grade level definitions

## Technical Considerations

- **Data-driven change:** The prompt builders and validation system all read from `ART_STYLE_MAPPING` dynamically, so changing the mapping constants is sufficient — no structural code changes needed
- **Test lockstep:** Mapping constants and test assertions must be updated together to avoid test failures; recommend a single commit
- **Validation auto-adapts:** `validatePromptStyleKeywords()` extracts keywords from `ART_STYLE_MAPPING[gradeLevel]` at runtime, so it will automatically validate against the new watercolor keywords
- **Cross-grade baseStyle uniqueness:** Each grade should retain a distinct `baseStyle` string so prompts remain distinguishable: K-2 = `"watercolor children's book illustration"`, 3-5 = `"watercolor children's book illustration"`, 6-8 = `"watercolor illustration"`, 9-12 = `"sophisticated watercolor art"`

## Success Metrics

- All existing tests pass with updated assertions (`npm test` — 0 failures)
- Every grade level's `baseStyle` contains the word "watercolor"
- Every grade level's `artisticTechnique` contains the word "watercolor"
- No references to "digital art", "digital painting", "realistic digital", or "photorealistic" remain in `ART_STYLE_MAPPING` or `SIMPLE_ART_STYLE_MAPPING`
- Complexity progression is preserved: K-2 "simple" < 3-5 "moderate" < 6-8 "high/complex" < 9-12 "complex/intricate"

## Open Questions

- K-2 and 3-5 will share the same `baseStyle` string (`"watercolor children's book illustration"`). Should 3-5 use a differentiated variant like `"detailed watercolor children's book illustration"` for clearer prompt validation distinction?
- Should a visual QA step be added to verify image generation quality for higher grades with watercolor prompts (model-dependent output)?
