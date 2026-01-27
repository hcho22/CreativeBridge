# Art Style Validation - Manual Testing Guide

This guide provides step-by-step instructions for manually validating the art style enforcement system across all grade levels.

## Overview

The goal is to verify that the art style enforcement fix (US-001 and US-002) successfully ensures grade-appropriate art styles for generated images, particularly the watercolor children's book style for K-2.

## Test Modes

### Quick Mode (Recommended for Initial Validation)

- **Images to Generate:** 4 (1 per grade level)
- **Time Estimate:** ~10-15 minutes
- **Cost:** Minimal (4 API calls)
- **Use When:** Quick validation after implementing a fix

### Standard Mode (Full Validation)

- **Images to Generate:** 12 (3 per grade level)
- **Time Estimate:** ~30-40 minutes
- **Cost:** Moderate (12 API calls)
- **Use When:** Comprehensive validation before marking US-004 complete

## Prerequisites

1. CreativeBridge app installed and running
2. User account with sufficient XP (or bypass XP check for testing)
3. Access to `.agent/Tasks/art-style-validation-report.md` for documentation
4. Test stories from `src/__tests__/manual/artStyleValidation.manual.ts`

## Step-by-Step Instructions

### Step 1: Prepare Test Data

1. Open [`src/__tests__/manual/artStyleValidation.manual.ts`](../../src/__tests__/manual/artStyleValidation.manual.ts)
2. Review the test stories for your chosen mode:
   - **Quick Mode:** Use `QUICK_TEST_STORIES` (4 stories)
   - **Standard Mode:** Use `STANDARD_TEST_STORIES` (12 stories)

### Step 2: Generate Test Images

For each test story:

1. **Open the CreativeBridge app**

2. **Create a new story:**

   - Navigate to the story creation screen
   - Select the appropriate grade level (K-2, 3-5, 6-8, or 9-12)
   - Choose any genre (the test stories are pre-written)

3. **Enter the test story content:**

   - Copy the `content` field from the test story
   - Paste it into the story editor
   - Ensure the grade level matches the test story

4. **Generate an image:**

   - Trigger image generation for the story
   - Wait for the image to be generated
   - **Save the image URL** (you'll need this for documentation)

5. **Document the result:**
   - Open `.agent/Tasks/art-style-validation-report.md`
   - Find the corresponding test section
   - Paste the image URL
   - **Important:** Take a screenshot or save the image for before/after comparison

### Step 3: Visual Inspection

For each generated image, complete the visual checklist in the validation report:

#### K-2 Visual Checklist

- [ ] Image uses watercolor illustration style (NOT photorealistic)
- [ ] Colors are bright and cheerful (soft pastels, vibrant hues)
- [ ] Shapes are simple and easy to understand
- [ ] Overall tone is magical/whimsical and age-appropriate
- [ ] Character style is cute and friendly

#### 3-5 Visual Checklist

- [ ] Image uses detailed illustration/digital painting style
- [ ] Colors are vibrant and engaging
- [ ] Visual complexity is moderate with clear details
- [ ] Overall tone is adventurous and inspiring
- [ ] Character style shows personality and expression

#### 6-8 Visual Checklist

- [ ] Image uses realistic digital art or semi-realistic style
- [ ] Colors are sophisticated with good contrast
- [ ] Visual complexity is high with fine details
- [ ] Overall tone is heroic and empowering
- [ ] Character style is dynamic and expressive

#### 9-12 Visual Checklist

- [ ] Image uses sophisticated digital art or realistic illustration
- [ ] Colors use a mature, refined palette
- [ ] Composition is complex and artistic
- [ ] Overall tone is thoughtful and inspiring
- [ ] Character style is realistic and nuanced

### Step 4: Document Findings

1. **For each test:**

   - Mark the visual checklist items as complete (✓) or incomplete (✗)
   - Add notes about any observations or issues
   - Mark the test as Pass or Fail

2. **Add before/after examples:**

   - If you have images generated BEFORE the fix, include them in the "Before/After Comparison" section
   - This helps demonstrate the impact of the art style enforcement fix

3. **Complete the Conclusions section:**
   - Summarize your findings for each grade level
   - Document any issues discovered
   - Provide recommendations for improvements

### Step 5: Update PRD

Once validation is complete:

1. Open [`prd-image-generation-watercolor-style-fix.md`](prd-image-generation-watercolor-style-fix.md)
2. Navigate to US-004: Manual Visual Validation with Test Stories
3. Update the acceptance criteria checkboxes to reflect completion
4. Change PRD status if all user stories are complete

## Expected Results

### Success Criteria

The validation is considered **successful** if:

1. **100% of K-2 images** use watercolor children's book illustration style (NOT photorealistic)
2. **100% of 3-5 images** use detailed illustration/digital painting style
3. **100% of 6-8 images** use realistic/semi-realistic digital art style
4. **100% of 9-12 images** use sophisticated digital art style
5. **No regressions:** Existing features continue to work correctly

### Common Issues to Watch For

1. **Photorealistic K-2 images:** The most critical issue this fix addresses
2. **Missing art style keywords:** Prompts should contain grade-appropriate style terms
3. **Inconsistent style within grade level:** All images for same grade should have similar artistic approach
4. **Style bleeding:** K-2 shouldn't look like 9-12 and vice versa

## Test Data Reference

### Quick Mode Test Stories

#### Test 1: K-2 Adventure

```
Luna the brave kitten explored the magical garden. She found a sparkling butterfly dancing among the bright flowers. The happy kitten played with her new friend under the rainbow.
```

#### Test 2: 3-5 Adventure

```
Zara the adventurous explorer discovered an ancient temple hidden deep in the jungle. Golden vines covered the mysterious entrance, and exotic birds called from the canopy above. She carefully stepped inside, her flashlight revealing incredible treasures.
```

#### Test 3: 6-8 Adventure

```
Commander Aria led her skilled crew through the dangerous asteroid field. Warning lights flashed as the sophisticated spaceship navigated the treacherous debris. With precise calculations and courage, she guided them safely to the distant planet.
```

#### Test 4: 9-12 Adventure

```
Dr. Elena Rivera embarked on a perilous expedition to document the endangered ecosystem. Her sophisticated equipment captured unprecedented data as she navigated the hostile terrain. The groundbreaking research would reshape environmental policy worldwide.
```

### Standard Mode Additional Stories

See [`src/__tests__/manual/artStyleValidation.manual.ts`](../../src/__tests__/manual/artStyleValidation.manual.ts) for complete list of friendship and mystery genre stories.

## Troubleshooting

### Issue: Cannot generate images (insufficient XP)

**Solution:** Temporarily bypass XP check for testing, or use a test account with sufficient XP

### Issue: Image generation fails

**Solution:**

1. Check Replicate API key is configured correctly
2. Review error logs for specific failure reason
3. Verify story content follows expected format (Name + adjective + noun pattern)

### Issue: Cannot access generated image URLs

**Solution:**

1. Check image storage service configuration
2. Verify images are being uploaded to Supabase storage correctly
3. Use browser developer tools to inspect network requests

## Next Steps After Validation

1. **If all tests pass:**

   - Mark US-004 as complete in the PRD
   - Update `.agent/System/project_architecture.md` to document the fix
   - Consider creating `.agent/SOP/image-generation-art-styles.md` for maintenance guidelines

2. **If any tests fail:**
   - Document the specific failures in the validation report
   - Create bug tickets for each issue
   - Revisit US-001 and US-002 implementations
   - Re-run validation after fixes are applied

---

**Related Files:**

- Test Data: [`src/__tests__/manual/artStyleValidation.manual.ts`](../../src/__tests__/manual/artStyleValidation.manual.ts)
- Validation Script: [`scripts/validate-art-styles.ts`](../../scripts/validate-art-styles.ts)
- Validation Report: [`art-style-validation-report.md`](art-style-validation-report.md)
- PRD: [`prd-image-generation-watercolor-style-fix.md`](prd-image-generation-watercolor-style-fix.md)
