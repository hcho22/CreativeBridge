# SOP: Image Generation Art Style Enforcement

## Overview

This document provides comprehensive guidelines for maintaining art style consistency in the CreativeBridge image generation system. It covers the art style enforcement architecture, prompt generation tier system, validation procedures, and best practices for extending or modifying the system.

**Purpose**: Ensure all generated images consistently match grade-appropriate artistic styles across K-12 education levels.

**Scope**: Applies to all code modifications in `src/services/imageGeneration.ts` related to prompt generation, art style definitions, and image generation workflows.

---

## Table of Contents

1. [Art Style Architecture](#art-style-architecture)
2. [Prompt Generation Tier System](#prompt-generation-tier-system)
3. [ART_STYLE_MAPPING: Single Source of Truth](#art_style_mapping-single-source-of-truth)
4. [Validation System](#validation-system)
5. [Adding or Modifying Art Styles](#adding-or-modifying-art-styles)
6. [Testing Art Style Changes](#testing-art-style-changes)
7. [Debugging Art Style Issues](#debugging-art-style-issues)
8. [Code Examples](#code-examples)
9. [Common Pitfalls to Avoid](#common-pitfalls-to-avoid)

---

## Art Style Architecture

### System Design Principles

1. **Single Source of Truth**: All grade-level art style definitions are centralized in `ART_STYLE_MAPPING` constant
2. **Comprehensive Enforcement**: Every prompt generation path MUST incorporate all art style properties
3. **Validation Safety Net**: Post-generation validation catches any prompts missing required style keywords
4. **Graceful Degradation**: Failed validation triggers fallback regeneration using known-good methods

### Core Components

#### 1. ART_STYLE_MAPPING Constant

**Location**: [src/services/imageGeneration.ts:328](../../src/services/imageGeneration.ts#L328)

Defines the complete art style definition for each grade level:

```typescript
interface ArtStyleDefinition {
  baseStyle: string; // Foundation style (e.g., "watercolor children's book illustration")
  colorPalette: string; // Age-appropriate color schemes
  visualComplexity: string; // Detail level for cognitive stage
  artisticTechnique: string; // Rendering style
  emotionalTone: string; // Mood appropriate for age
  layoutStyle: string; // Composition guidance
  characterStyle: string; // Character rendering approach
  backgroundStyle: string; // Setting detail level
}
```

#### 2. Prompt Generation Methods

Three-tier system with art style enforcement at each level:

- **Tier 1**: `generateStorySpecificPrompt()` - Story-first extraction (primary path)
- **Tier 2**: `generateAdvancedPrompt()` - Advanced NER analysis (secondary path)
- **Tier 3**: `generateEnhancedGradeAppropriatePrompt()` - Basic fallback (guaranteed success)

#### 3. Validation Layer

`validatePromptStyleKeywords()` - Ensures prompts contain required art style keywords

---

## Prompt Generation Tier System

### Decision Flow

```
User Requests Image
    ↓
Extract Story Content
    ↓
Tier 1: generateStorySpecificPrompt()
    ├─ Success + Validation Pass → Use Prompt ✅ (~70% of cases)
    └─ Fail or Validation Fail → Try Tier 2
        ↓
Tier 2: generateAdvancedPrompt()
    ├─ Success + Validation Pass → Use Prompt ✅ (~20% of cases)
    └─ Fail or Validation Fail → Use Tier 3
        ↓
Tier 3: generateEnhancedGradeAppropriatePrompt()
    └─ Always succeeds with full art style enforcement ✅ (~10% of cases)
```

### Tier 1: Story-Specific Prompts

**Method**: `generateStorySpecificPrompt()`
**Location**: [src/services/imageGeneration.ts:10544](../../src/services/imageGeneration.ts#L10544)

**Purpose**: Primary prompt generation path that extracts visual elements directly from story content and combines with full art style enforcement.

**When Used**:

- Story content contains clear visual elements (character, objects, setting)
- Prompt length exceeds 50 characters
- Specific character identified (not generic descriptions)

**Art Style Enforcement**:

1. Start with `baseStyle` as foundation
2. Add character with `characterStyle` properties
3. Include story action and objects
4. Incorporate setting with `backgroundStyle`
5. Merge story colors with `colorPalette`
6. Apply `artisticTechnique` for rendering
7. Add `emotionalTone` (story mood prioritized)
8. Include `layoutStyle` for composition
9. Specify `visualComplexity`
10. Append child safety constraints

**Success Criteria**:

- Contains specific character (e.g., "Ben the bear" not "a bear")
- Passes validation with 60%+ art style property coverage
- Includes baseStyle keyword

### Tier 2: Advanced NER Analysis

**Method**: `generateAdvancedPrompt()`
**Location**: [src/services/imageGeneration.ts:11986](../../src/services/imageGeneration.ts#L11986)

**Purpose**: Advanced named entity recognition with sophisticated narrative sequence analysis when story-specific extraction is insufficient.

**When Used**:

- Tier 1 fails to extract sufficient visual elements
- Story content is complex or requires deeper analysis
- Character identification needs advanced NER

**Art Style Enforcement**:

- Uses full `ArtStyleDefinition` object
- Incorporates all properties: `colorPalette`, `visualComplexity`, `artisticTechnique`, `emotionalTone`, `characterStyle`
- Systematic integration matching Tier 1 pattern

**Success Criteria**:

- Prompt length exceeds 50 characters
- Passes validation with 60%+ art style property coverage
- Contains baseStyle keyword

### Tier 3: Enhanced Grade-Appropriate Fallback

**Method**: `generateEnhancedGradeAppropriatePrompt()`
**Location**: [src/services/imageGeneration.ts:7250](../../src/services/imageGeneration.ts#L7250)

**Purpose**: Guaranteed success fallback with comprehensive art style enforcement. Used as safety net and reference implementation.

**When Used**:

- Tier 1 and Tier 2 validation failures
- Emergency fallback for any generation issues
- Reference implementation for correct art style usage

**Art Style Enforcement**:

- Complete integration of all `ART_STYLE_MAPPING` properties
- Always passes validation by design
- Proven reliable implementation pattern

**Success Criteria**:

- Always succeeds
- Always passes validation
- Provides reasonable quality baseline

---

## ART_STYLE_MAPPING: Single Source of Truth

### Location

[src/services/imageGeneration.ts:328](../../src/services/imageGeneration.ts#L328)

### Grade-Level Definitions

#### K-2: Early Elementary

```typescript
'K-2': {
  baseStyle: 'watercolor children\'s book illustration',
  colorPalette: 'bright colors with soft pastels',
  visualComplexity: 'simple shapes and clear forms',
  artisticTechnique: 'watercolor, soft edges, gentle textures',
  emotionalTone: 'whimsical and warm',
  layoutStyle: 'child-friendly framing with clear focal points',
  characterStyle: 'simple, friendly shapes with expressive features',
  backgroundStyle: 'simple, magical environments with soft details'
}
```

**Purpose**: Safe, age-appropriate illustrations that engage young readers without overwhelming visual complexity.

#### 3-5: Upper Elementary

```typescript
'3-5': {
  baseStyle: 'watercolor children\'s book illustration',
  colorPalette: 'vibrant colors, rich earth tones, balanced warm and cool colors',
  visualComplexity: 'moderate detail, clear focal points, engaging visual elements',
  artisticTechnique: 'watercolor painting style, textured brushstrokes, layered color washes',
  emotionalTone: 'adventurous and exciting, encouraging exploration, positive energy',
  layoutStyle: 'dynamic composition, balanced elements, visual storytelling flow',
  characterStyle: 'expressive watercolor characters, lively poses, diverse representation',
  backgroundStyle: 'detailed environments, recognizable settings, immersive worlds'
}
```

**Purpose**: More sophisticated watercolor visuals matching developing reading comprehension and visual processing abilities.

#### 6-8: Middle School

```typescript
'6-8': {
  baseStyle: 'watercolor illustration',
  colorPalette: 'sophisticated color schemes, dramatic lighting, atmospheric effects',
  visualComplexity: 'high detail, complex compositions, well-proportioned figures',
  artisticTechnique: 'watercolor painting style, rich wet-on-wet techniques, expressive brush work, detailed washes',
  emotionalTone: 'adventurous and heroic, inspiring confidence, age-appropriate excitement',
  layoutStyle: 'dynamic action compositions, cinematic angles, visual depth',
  characterStyle: 'detailed watercolor characters, expressive facial features, action poses',
  backgroundStyle: 'detailed watercolor environments, atmospheric washes, layered depth'
}
```

**Purpose**: Detailed watercolor art matching maturity level and interest in more complex narratives.

#### 9-12: High School

```typescript
'9-12': {
  baseStyle: 'sophisticated watercolor art',
  colorPalette: 'mature color palettes, subtle gradients, professional color theory',
  visualComplexity: 'complex artistic composition, intricate details, advanced visual concepts',
  artisticTechnique: 'professional watercolor technique, advanced color layering, expressive washes and textures',
  emotionalTone: 'thoughtful and inspiring, intellectually engaging, emotionally resonant',
  layoutStyle: 'artistic composition, sophisticated visual hierarchy, professional design',
  characterStyle: 'detailed watercolor figures, nuanced expressions, diverse and inclusive',
  backgroundStyle: 'richly detailed watercolor environments, architectural detail, atmospheric depth'
}
```

**Purpose**: Mature, sophisticated watercolor visuals appropriate for young adult content and complex themes.

### Modifying ART_STYLE_MAPPING

**IMPORTANT**: Changes to `ART_STYLE_MAPPING` affect ALL image generation across the entire application.

**Before Modifying**:

1. Document the reason for the change
2. Consider impact on existing stories
3. Plan comprehensive testing across all grade levels
4. Review with educational content team

**Testing Requirements**:

1. Run full test suite: `npm test`
2. Run art style enforcement tests: `npm test artStyleEnforcement`
3. Run prompt fallback tests: `npm test promptFallbackMethods`
4. Manual visual validation (see [Testing Art Style Changes](#testing-art-style-changes))

---

## Validation System

### validatePromptStyleKeywords Method

**Location**: [src/services/imageGeneration.ts:1769](../../src/services/imageGeneration.ts#L1769)

**Purpose**: Validates that generated prompts contain required art style keywords for the specified grade level.

### Validation Logic

```typescript
interface StyleValidationResult {
  isValid: boolean; // Overall validation status
  matchedKeywords: string[]; // Keywords found in prompt
  missingKeywords: string[]; // Keywords NOT found in prompt
  validationErrors: string[]; // Human-readable error messages
  coveragePercentage: number; // Percentage of properties with matches
}
```

### Validation Requirements

1. **baseStyle**: MUST be present (non-negotiable)
2. **Property Coverage**: At least 60% of art style properties must have keyword matches
3. **Multi-value Properties**: For comma-separated values (colorPalette, artisticTechnique), requires at least ONE matching keyword

### Keyword Extraction

**Comma-separated properties** (colorPalette, artisticTechnique):

```typescript
// Input: "bright colors, soft pastels"
// Extracted: ["bright colors", "soft pastels"]
// Validation: Prompt must contain at least ONE of these
```

**Single-value properties** (visualComplexity, emotionalTone, etc.):

```typescript
// Input: "simple shapes and clear forms"
// Extracted: ["simple shapes and clear forms"]
// Validation: Prompt must contain this exact phrase (case-insensitive)
```

### Validation Flow

```typescript
const validation = this.validatePromptStyleKeywords(prompt, gradeLevel);

if (validation.isValid) {
  // Use prompt - all quality checks passed
  return prompt;
} else {
  // Log failure and regenerate using Tier 3 fallback
  console.warn('⚠️ Validation failed:', validation.validationErrors);
  this.trackValidationFailure('tier1', gradeLevel, validation, prompt);

  // Fallback to Tier 3 (guaranteed success)
  return this.generateEnhancedGradeAppropriatePrompt(storyContent, gradeLevel);
}
```

### Telemetry Tracking

**Validation failures are tracked** for monitoring and continuous improvement:

```typescript
private trackValidationFailure(
  tier: 'tier1' | 'tier2' | 'tier3',
  gradeLevel: GradeLevel,
  validation: StyleValidationResult,
  prompt: string
): void {
  // Log to analytics service
  // Monitor validation failure rates by tier and grade level
  // Identify patterns requiring prompt generation improvements
}
```

---

## Adding or Modifying Art Styles

### Scenario 1: Modify Existing Grade-Level Art Style

**Example**: Change K-2 colorPalette from "bright colors with soft pastels" to "vivid colors with gentle hues"

**Steps**:

1. **Update ART_STYLE_MAPPING**:

```typescript
const ART_STYLE_MAPPING: Record<GradeLevel, ArtStyleDefinition> = {
  'K-2': {
    baseStyle: "watercolor children's book illustration",
    colorPalette: 'vivid colors with gentle hues', // CHANGED
    // ... other properties unchanged
  },
  // ... other grade levels
};
```

2. **Update Test Expectations**:

```typescript
// In src/__tests__/services/artStyleEnforcement.test.ts
const k2CriticalKeywords = [
  'watercolor',
  "children's book",
  'vivid', // UPDATED
  'gentle', // UPDATED (instead of 'bright', 'soft pastels')
  'simple shapes',
  'whimsical',
];
```

3. **Run Tests**:

```bash
npm test artStyleEnforcement
npm test promptFallbackMethods
npm test -- --testPathPattern=gradeLevelStyles
```

4. **Manual Visual Validation**:

- Follow [Art Style Validation Guide](../Tasks/art-style-validation-guide.md)
- Generate at least 3 test images for K-2 grade level
- Verify images reflect new color palette
- Document findings in validation report

5. **Update Documentation**:

- Update this SOP with new keyword expectations
- Update project architecture documentation
- Add comment to `ART_STYLE_MAPPING` explaining the change

### Scenario 2: Add New Grade Level

**Example**: Add pre-K support

**Steps**:

1. **Add to GradeLevel Type**:

```typescript
// In src/types/story.ts or wherever GradeLevel is defined
export type GradeLevel = 'PreK' | 'K-2' | '3-5' | '6-8' | '9-12';
```

2. **Add to ART_STYLE_MAPPING**:

```typescript
const ART_STYLE_MAPPING: Record<GradeLevel, ArtStyleDefinition> = {
  PreK: {
    baseStyle: 'simple illustration for very young children',
    colorPalette: 'primary colors with high contrast',
    visualComplexity: 'minimal detail, large shapes',
    artisticTechnique: 'flat colors, bold outlines',
    emotionalTone: 'cheerful and safe',
    layoutStyle: 'centered composition, uncluttered',
    characterStyle: 'very simple shapes, friendly faces',
    backgroundStyle: 'solid colors or simple patterns',
  },
  'K-2': {
    /* existing */
  },
  // ... other grade levels
};
```

3. **Add Test Coverage**:

```typescript
// In src/__tests__/services/artStyleEnforcement.test.ts
describe('PreK Art Style Enforcement', () => {
  const prePrimaryKeywords = [
    'simple illustration',
    'very young children',
    'primary colors',
    'minimal detail',
    'flat colors',
    'cheerful',
  ];

  test('should include PreK critical keywords in generated prompt', async () => {
    // Test implementation
  });
});
```

4. **Update All Grade-Level Switches**:

- Search codebase for switch statements on GradeLevel
- Add PreK case to all grade-level logic
- Ensure no default cases that would miss PreK

5. **Comprehensive Testing**:

```bash
npm run typecheck  # Ensure type safety
npm test           # Full test suite
```

### Scenario 3: Add New Art Style Property

**Example**: Add `textureStyle` property for tactile rendering guidance

**Steps**:

1. **Update ArtStyleDefinition Interface**:

```typescript
interface ArtStyleDefinition {
  baseStyle: string;
  colorPalette: string;
  visualComplexity: string;
  artisticTechnique: string;
  emotionalTone: string;
  layoutStyle: string;
  characterStyle: string;
  backgroundStyle: string;
  textureStyle: string; // NEW
}
```

2. **Update All Grade Levels in ART_STYLE_MAPPING**:

```typescript
const ART_STYLE_MAPPING: Record<GradeLevel, ArtStyleDefinition> = {
  'K-2': {
    // ... existing properties
    textureStyle: 'soft, smooth textures', // NEW
  },
  '3-5': {
    // ... existing properties
    textureStyle: 'varied textures with gentle contrast', // NEW
  },
  // ... update all grade levels
};
```

3. **Update Prompt Generation Methods**:

**In generateStorySpecificPrompt()**:

```typescript
// After adding other art style properties
if (artStyleDefinition.textureStyle) {
  prompt += `, ${artStyleDefinition.textureStyle}`;
  console.log(
    '🎨 [ART STYLE] Added textureStyle:',
    artStyleDefinition.textureStyle,
  );
}
```

**In generateAdvancedPrompt()**:

```typescript
// Ensure textureStyle is included in prompt construction
```

**In generateEnhancedGradeAppropriatePrompt()**:

```typescript
// Ensure textureStyle is included in prompt construction
```

4. **Update Validation Logic**:

```typescript
// In validatePromptStyleKeywords()
if (artStyleDefinition.textureStyle) {
  requiredKeywords.push({
    keyword: artStyleDefinition.textureStyle,
    property: 'textureStyle',
  });
}
```

5. **Update Tests**:

- Add textureStyle keywords to test expectations
- Update art style verification tests
- Test validation with new property

6. **Full Testing**:

```bash
npm run typecheck
npm test
```

---

## Testing Art Style Changes

### Automated Testing

#### 1. Art Style Enforcement Tests

**Location**: [src/**tests**/services/artStyleEnforcement.test.ts](../../src/__tests__/services/artStyleEnforcement.test.ts)

**Coverage**:

- Critical keyword presence for each grade level
- All prompt generation tiers (Tier 1, Tier 2, Tier 3)
- Regression tests across genres (adventure, friendship, mystery)
- Edge cases (minimal content, null inputs, safety constraints)

**Run Tests**:

```bash
npm test artStyleEnforcement
```

**Expected Output**: 46/46 tests passing

#### 2. Fallback Method Tests

**Location**: [src/**tests**/services/promptFallbackMethods.test.ts](../../src/__tests__/services/promptFallbackMethods.test.ts)

**Coverage**:

- All fallback prompt generation methods
- Grade-level art style enforcement in fallbacks
- ART_STYLE_MAPPING property inclusion

**Run Tests**:

```bash
npm test promptFallbackMethods
```

**Expected Output**: 13/13 tests passing

#### 3. Style Validation Tests

**Location**: [src/**tests**/services/promptStyleValidation.test.ts](../../src/__tests__/services/promptStyleValidation.test.ts)

**Coverage**:

- Validation logic for all grade levels
- Keyword matching (case-insensitive)
- Coverage percentage calculations
- Error message generation

**Run Tests**:

```bash
npm test promptStyleValidation
```

### Manual Visual Validation

**See**: [Art Style Validation Guide](../Tasks/art-style-validation-guide.md)

**Quick Process**:

1. **Generate Test Images**:

```bash
# Using manual test helper
node --require ts-node/register src/__tests__/manual/artStyleValidation.manual.ts
```

2. **Visual Inspection Checklist** (per grade level):

   - [ ] Artistic style matches baseStyle description
   - [ ] Color palette is age-appropriate
   - [ ] Visual complexity matches grade level
   - [ ] Characters rendered in appropriate style
   - [ ] Background detail level is correct
   - [ ] Overall emotional tone is appropriate
   - [ ] Watercolor style consistent across all grade levels

3. **Document Findings**:

- Use template: [art-style-validation-report.md](../Tasks/art-style-validation-report.md)
- Include before/after comparisons for changes
- Note any unexpected results or edge cases

---

## Debugging Art Style Issues

### Issue: Prompts Missing Art Style Keywords

**Symptoms**:

- Generated images don't match expected art style
- Validation failures in logs
- Fallback to Tier 3 more frequently than expected

**Debugging Steps**:

1. **Check Console Logs**:

```typescript
// Look for art style enforcement logs
console.log('🎨 [ART STYLE ENFORCEMENT] Starting generateStorySpecificPrompt:', { ... });
console.log('🎨 [ART STYLE] Added baseStyle:', artStyleDefinition.baseStyle);
console.log('✅ [ART STYLE VERIFICATION] Final prompt art style check:', { ... });
```

2. **Verify ART_STYLE_MAPPING**:

```typescript
// Add temporary logging
const artStyleDefinition = ART_STYLE_MAPPING[gradeLevel];
console.log(
  'Current art style definition:',
  JSON.stringify(artStyleDefinition, null, 2),
);
```

3. **Test Validation Logic**:

```typescript
// In your prompt generation method
const validation = this.validatePromptStyleKeywords(
  generatedPrompt,
  gradeLevel,
);
console.log('Validation result:', JSON.stringify(validation, null, 2));
```

4. **Check for Missing Properties**:

```typescript
// Ensure all properties are being added to prompt
const artStyleVerification = {
  containsBaseStyle: prompt.includes(artStyleDefinition.baseStyle),
  containsColorPalette: artStyleDefinition.colorPalette
    ? prompt.includes(artStyleDefinition.colorPalette)
    : null,
  // ... check all properties
};
console.log('Art style verification:', artStyleVerification);
```

### Issue: Images Not Matching Grade Level

**Symptoms**:

- K-2 images look photorealistic instead of watercolor
- High school images too simplistic
- Color palettes don't match specifications

**Debugging Steps**:

1. **Verify Tier Selection**:

```typescript
// Check which tier is being used
console.log('🎯 Prompt Tier Selection:', {
  tier: 'Tier 1 - Story Specific',
  promptLength: prompt.length,
  gradeLevel: gradeLevel,
});
```

2. **Inspect Full Generated Prompt**:

```typescript
console.log('📋 [FINAL PROMPT]:', prompt);
// Manually verify all art style keywords are present
```

3. **Check Replicate API Response**:

```typescript
// Verify prompt sent to Replicate matches internal prompt
console.log('Sending to Replicate:', {
  prompt: finalPrompt,
  gradeLevel: gradeLevel,
});
```

4. **Test with Minimal Example**:

```typescript
// Create a simple test case
const testPrompt = this.generateStorySpecificPrompt(
  'Ben the brave bear explored the forest.',
  'K-2',
  ART_STYLE_MAPPING['K-2'],
);
console.log('Test prompt:', testPrompt);
// Should include "watercolor children's book illustration"
```

### Issue: Validation Always Failing

**Symptoms**:

- All prompts fall back to Tier 3
- Validation errors in logs
- Coverage percentage consistently below 60%

**Debugging Steps**:

1. **Check Keyword Extraction**:

```typescript
// In validatePromptStyleKeywords()
console.log(
  'Required keywords:',
  requiredKeywords.map(k => k.keyword),
);
console.log('Prompt to validate:', promptLower);
```

2. **Test Case-Sensitivity**:

```typescript
// Validation uses lowercase matching
const promptLower = prompt.toLowerCase();
const keywordLower = keyword.toLowerCase();
console.log('Matching:', { promptLower, keywordLower });
```

3. **Verify Property Splitting**:

```typescript
// For comma-separated properties
const colorTerms = artStyleDefinition.colorPalette
  .split(',')
  .map(term => term.trim());
console.log('Color terms to match:', colorTerms);
```

4. **Check Coverage Calculation**:

```typescript
const matchedProperties = matchedKeywords.map(k => k.property);
const uniqueMatchedProperties = [...new Set(matchedProperties)];
const coveragePercentage =
  (uniqueMatchedProperties.length / totalProperties) * 100;
console.log('Coverage calculation:', {
  matchedProperties: uniqueMatchedProperties.length,
  totalProperties: totalProperties,
  coveragePercentage: coveragePercentage,
});
```

---

## Code Examples

### Example 1: Correct Art Style Usage

```typescript
private generateCustomPrompt(
  storyContent: string,
  gradeLevel: GradeLevel
): string {
  // ✅ CORRECT: Use full ArtStyleDefinition
  const artStyleDefinition = ART_STYLE_MAPPING[gradeLevel];

  let prompt = `Create a ${artStyleDefinition.baseStyle}`;

  // Add story-specific content
  prompt += ` showing ${extractedCharacter}`;

  // ✅ CORRECT: Include ALL art style properties
  if (artStyleDefinition.characterStyle) {
    prompt += ` with ${artStyleDefinition.characterStyle}`;
  }
  if (artStyleDefinition.colorPalette) {
    prompt += `, ${artStyleDefinition.colorPalette}`;
  }
  if (artStyleDefinition.artisticTechnique) {
    prompt += `, using ${artStyleDefinition.artisticTechnique}`;
  }
  if (artStyleDefinition.emotionalTone) {
    prompt += `, ${artStyleDefinition.emotionalTone}`;
  }
  if (artStyleDefinition.layoutStyle) {
    prompt += `, ${artStyleDefinition.layoutStyle}`;
  }
  if (artStyleDefinition.visualComplexity) {
    prompt += `, ${artStyleDefinition.visualComplexity}`;
  }
  if (artStyleDefinition.backgroundStyle) {
    prompt += `, ${artStyleDefinition.backgroundStyle}`;
  }

  // ✅ CORRECT: Validate before returning
  const validation = this.validatePromptStyleKeywords(prompt, gradeLevel);
  if (!validation.isValid) {
    console.warn('Validation failed, using fallback');
    return this.generateEnhancedGradeAppropriatePrompt(storyContent, gradeLevel);
  }

  return prompt;
}
```

### Example 2: Incorrect Art Style Usage (DO NOT DO THIS)

```typescript
private generateCustomPrompt(
  storyContent: string,
  gradeLevel: GradeLevel
): string {
  const artStyleDefinition = ART_STYLE_MAPPING[gradeLevel];

  // ❌ WRONG: Only using baseStyle
  let prompt = `Create a ${artStyleDefinition.baseStyle}`;

  // ❌ WRONG: Missing other art style properties
  prompt += ` showing ${extractedCharacter} in a scene`;

  // ❌ WRONG: No validation before returning
  return prompt;
}
```

### Example 3: Adding New Prompt Generation Method

```typescript
/**
 * Custom prompt generation method with full art style enforcement
 */
private generateThematicPrompt(
  storyContent: string,
  gradeLevel: GradeLevel,
  theme: StoryTheme
): string {
  // Step 1: Get art style definition
  const artStyleDefinition = ART_STYLE_MAPPING[gradeLevel];

  // Step 2: Build prompt starting with baseStyle
  let prompt = `Create a ${artStyleDefinition.baseStyle}`;

  // Step 3: Add thematic elements
  const thematicElements = this.extractThematicElements(storyContent, theme);
  prompt += ` featuring ${thematicElements}`;

  // Step 4: Systematically add ALL art style properties
  if (artStyleDefinition.characterStyle) {
    prompt += ` with ${artStyleDefinition.characterStyle}`;
  }
  if (artStyleDefinition.backgroundStyle) {
    prompt += `, ${artStyleDefinition.backgroundStyle}`;
  }
  if (artStyleDefinition.colorPalette) {
    prompt += `, ${artStyleDefinition.colorPalette}`;
  }
  if (artStyleDefinition.artisticTechnique) {
    prompt += `, using ${artStyleDefinition.artisticTechnique}`;
  }
  if (artStyleDefinition.emotionalTone) {
    prompt += `, ${artStyleDefinition.emotionalTone}`;
  }
  if (artStyleDefinition.layoutStyle) {
    prompt += `, ${artStyleDefinition.layoutStyle}`;
  }
  if (artStyleDefinition.visualComplexity) {
    prompt += `, ${artStyleDefinition.visualComplexity}`;
  }

  // Step 5: Add safety constraint
  prompt += ', safe for children, G-rated content';

  // Step 6: Validate before returning
  const validation = this.validatePromptStyleKeywords(prompt, gradeLevel);

  if (validation.isValid) {
    console.log('✅ Thematic prompt validated:', {
      coveragePercentage: validation.coveragePercentage,
      theme: theme,
    });
    return prompt;
  } else {
    console.warn('⚠️ Thematic prompt validation failed, using fallback');
    this.trackValidationFailure('custom', gradeLevel, validation, prompt);
    return this.generateEnhancedGradeAppropriatePrompt(storyContent, gradeLevel);
  }
}
```

### Example 4: Testing New Art Style

```typescript
// In src/__tests__/services/artStyleEnforcement.test.ts

describe('Custom Theme Art Style Enforcement', () => {
  test('should enforce art style in thematic prompt for K-2', async () => {
    const service = new ImageGenerationService();
    const storyContent =
      'Ben the brave bear explored the magical forest with his friends.';
    const gradeLevel = 'K-2';
    const theme = 'friendship';

    // Generate prompt using new method
    const prompt = service.generateThematicPrompt(
      storyContent,
      gradeLevel,
      theme,
    );

    // Verify critical keywords
    const k2Keywords = [
      'watercolor',
      "children's book",
      'bright colors',
      'simple shapes',
      'whimsical',
    ];

    k2Keywords.forEach(keyword => {
      expect(prompt.toLowerCase()).toContain(keyword.toLowerCase());
    });

    // Verify validation passes
    const validation = service.validatePromptStyleKeywords(prompt, gradeLevel);
    expect(validation.isValid).toBe(true);
    expect(validation.coveragePercentage).toBeGreaterThanOrEqual(60);
  });
});
```

---

## Common Pitfalls to Avoid

### Pitfall 1: Only Using baseStyle

**Problem**:

```typescript
// ❌ WRONG
let prompt = `Create a ${artStyleDefinition.baseStyle} showing Ben the bear`;
```

**Why It's Wrong**: This produces photorealistic images for K-2 because other style properties (colorPalette, artisticTechnique) are missing.

**Correct Approach**:

```typescript
// ✅ CORRECT
let prompt = `Create a ${artStyleDefinition.baseStyle} showing Ben the bear`;
prompt += `, ${artStyleDefinition.colorPalette}`;
prompt += `, using ${artStyleDefinition.artisticTechnique}`;
// ... add all other properties
```

### Pitfall 2: Hardcoding Art Styles

**Problem**:

```typescript
// ❌ WRONG
if (gradeLevel === 'K-2') {
  prompt += ', watercolor style, bright colors';
} else if (gradeLevel === '3-5') {
  prompt += ', watercolor illustration, vibrant colors';
}
```

**Why It's Wrong**: Duplicates art style definitions, can get out of sync with `ART_STYLE_MAPPING`, harder to maintain.

**Correct Approach**:

```typescript
// ✅ CORRECT
const artStyleDefinition = ART_STYLE_MAPPING[gradeLevel];
prompt += `, ${artStyleDefinition.artisticTechnique}`;
prompt += `, ${artStyleDefinition.colorPalette}`;
```

### Pitfall 3: Skipping Validation

**Problem**:

```typescript
// ❌ WRONG
private generatePrompt(...): string {
  let prompt = buildPromptWithArtStyle(...);
  return prompt; // No validation!
}
```

**Why It's Wrong**: No safety net to catch missing keywords, can result in incorrect art styles.

**Correct Approach**:

```typescript
// ✅ CORRECT
private generatePrompt(...): string {
  let prompt = buildPromptWithArtStyle(...);

  const validation = this.validatePromptStyleKeywords(prompt, gradeLevel);
  if (!validation.isValid) {
    return this.generateEnhancedGradeAppropriatePrompt(...); // Fallback
  }

  return prompt;
}
```

### Pitfall 4: Modifying ART_STYLE_MAPPING Without Testing

**Problem**: Changing art style definitions without running comprehensive tests.

**Why It's Wrong**: Can break existing functionality, affect all stories, cause validation failures.

**Correct Approach**:

1. Make the change
2. Run full test suite: `npm test`
3. Run targeted tests: `npm test artStyleEnforcement`
4. Perform manual visual validation
5. Document the change

### Pitfall 5: Incomplete Property Coverage

**Problem**:

```typescript
// ❌ WRONG - Only adds 3 out of 8 properties
prompt += `, ${artStyleDefinition.baseStyle}`;
prompt += `, ${artStyleDefinition.colorPalette}`;
prompt += `, ${artStyleDefinition.artisticTechnique}`;
// Missing: visualComplexity, emotionalTone, layoutStyle, characterStyle, backgroundStyle
```

**Why It's Wrong**: Incomplete art style enforcement can result in images that don't fully match the intended grade-level style.

**Correct Approach**:

```typescript
// ✅ CORRECT - Add ALL properties
prompt += `, ${artStyleDefinition.baseStyle}`;
prompt += `, ${artStyleDefinition.colorPalette}`;
prompt += `, ${artStyleDefinition.artisticTechnique}`;
prompt += `, ${artStyleDefinition.visualComplexity}`;
prompt += `, ${artStyleDefinition.emotionalTone}`;
prompt += `, ${artStyleDefinition.layoutStyle}`;
prompt += `, ${artStyleDefinition.characterStyle}`;
prompt += `, ${artStyleDefinition.backgroundStyle}`;
```

---

## Quick Reference Checklist

### When Adding New Prompt Generation Method

- [ ] Use `ART_STYLE_MAPPING[gradeLevel]` to get art style definition
- [ ] Include ALL 8 art style properties in the prompt
- [ ] Call `validatePromptStyleKeywords()` before returning
- [ ] Implement fallback to Tier 3 if validation fails
- [ ] Add comprehensive unit tests
- [ ] Add logging for monitoring
- [ ] Update this SOP with new method documentation

### When Modifying ART_STYLE_MAPPING

- [ ] Document reason for change
- [ ] Update all affected test expectations
- [ ] Run `npm run typecheck`
- [ ] Run `npm test`
- [ ] Perform manual visual validation
- [ ] Update project architecture documentation
- [ ] Update this SOP document

### When Debugging Art Style Issues

- [ ] Check console logs for art style enforcement messages
- [ ] Verify `ART_STYLE_MAPPING` contains expected values
- [ ] Test validation logic with sample prompts
- [ ] Check which tier is being used
- [ ] Inspect final prompt sent to Replicate
- [ ] Review validation failure telemetry

---

## Version History

**Version 1.1** (2026-04-06)

- Unified all grade levels to watercolor painting style
- Updated 3-5, 6-8, 9-12 code snippets and descriptions to reflect watercolor-only art medium
- Removed references to "digital illustration", "realistic digital art", and "sophisticated digital painting"

**Version 1.0** (2026-01-26)

- Initial SOP creation
- Documented art style enforcement architecture
- Added prompt generation tier system documentation
- Included comprehensive code examples
- Added debugging guidelines

---

**Document Owner**: Development Team
**Review Schedule**: Quarterly or after significant art style system changes
**Related Documentation**:

- [Project Architecture](../System/project_architecture.md)
- [Image Generation Watercolor Style Fix PRD](../Tasks/prd-image-generation-watercolor-style-fix.md)
- [Art Style Validation Guide](../Tasks/art-style-validation-guide.md)
