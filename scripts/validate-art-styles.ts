#!/usr/bin/env ts-node
/**
 * Art Style Validation Script
 *
 * Generates test images for each grade level to validate that the art style
 * enforcement system is working correctly. This script creates images for
 * K-2, 3-5, 6-8, and 9-12 grade levels and saves the generated prompts and
 * image URLs for manual visual inspection.
 *
 * Usage:
 *   npx ts-node scripts/validate-art-styles.ts
 *
 * Output:
 *   - Generated images saved to validation-results/
 *   - Detailed report saved to .agent/Tasks/art-style-validation-report.md
 */

import { imageGenerationService } from '../src/services/imageGeneration';
import { GradeLevel } from '../src/types/database';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Test mode configuration
 * - 'quick': Generate 1 image per grade level (4 total) - fastest, lowest cost
 * - 'standard': Generate 3 images per grade level (12 total) - recommended for full validation
 * - 'thorough': Generate all test stories (currently same as standard)
 */
const TEST_MODE: 'quick' | 'standard' | 'thorough' = 'quick';

/**
 * Images to generate per grade level based on test mode
 */
const IMAGES_PER_GRADE: Record<'quick' | 'standard' | 'thorough', number> = {
  quick: 1, // Just test the first story (adventure) for each grade
  standard: 3, // Test all three genres (adventure, friendship, mystery)
  thorough: 3, // Full validation with all stories
};

// ============================================================================
// TEST DATA
// ============================================================================

// Test story content for each grade level and genre
const TEST_STORIES: Record<
  GradeLevel,
  Array<{ genre: string; content: string }>
> = {
  'K-2': [
    {
      genre: 'adventure',
      content:
        'Luna the brave kitten explored the magical garden. She found a sparkling butterfly dancing among the bright flowers. The happy kitten played with her new friend under the rainbow.',
    },
    {
      genre: 'friendship',
      content:
        'Benny the cheerful bear met Rosie the gentle rabbit in the sunny meadow. They shared delicious honey and picked colorful berries together. The two friends laughed and played all day long.',
    },
    {
      genre: 'mystery',
      content:
        'Max the curious puppy discovered mysterious paw prints in the soft snow. He followed the trail through the quiet forest until he found a friendly fox hiding behind a tree. They became best friends and shared the secret.',
    },
  ],
  '3-5': [
    {
      genre: 'adventure',
      content:
        'Zara the adventurous explorer discovered an ancient temple hidden deep in the jungle. Golden vines covered the mysterious entrance, and exotic birds called from the canopy above. She carefully stepped inside, her flashlight revealing incredible treasures.',
    },
    {
      genre: 'friendship',
      content:
        'Maya the talented artist and Jake the creative musician formed an amazing partnership. Together they painted vibrant murals and composed beautiful melodies for their neighborhood. The whole community celebrated their inspiring collaboration.',
    },
    {
      genre: 'mystery',
      content:
        'Detective Oliver investigated the puzzling case of the missing library books. He found mysterious clues hidden between the dusty shelves and secret passages behind the old bookcases. The clever boy solved the enigma by following the trail of bookmarks.',
    },
  ],
  '6-8': [
    {
      genre: 'adventure',
      content:
        'Commander Aria led her skilled crew through the dangerous asteroid field. Warning lights flashed as the sophisticated spaceship navigated the treacherous debris. With precise calculations and courage, she guided them safely to the distant planet.',
    },
    {
      genre: 'friendship',
      content:
        'Marcus the determined athlete and Sam the brilliant strategist formed an unstoppable team. They trained intensively, combining physical prowess with tactical intelligence. Their powerful bond helped them overcome every challenge in the championship.',
    },
    {
      genre: 'mystery',
      content:
        'Investigator Chen examined the cryptic symbols carved into the ancient monument. Advanced technology revealed hidden patterns that connected to historical records. The complex puzzle required both scientific knowledge and intuitive reasoning to decode.',
    },
  ],
  '9-12': [
    {
      genre: 'adventure',
      content:
        'Dr. Elena Rivera embarked on a perilous expedition to document the endangered ecosystem. Her sophisticated equipment captured unprecedented data as she navigated the hostile terrain. The groundbreaking research would reshape environmental policy worldwide.',
    },
    {
      genre: 'friendship',
      content:
        'Professor James and Dr. Sarah collaborated on revolutionary quantum research. Their intellectual synergy bridged theoretical physics and practical engineering. The profound partnership challenged conventional understanding and inspired the next generation of scientists.',
    },
    {
      genre: 'mystery',
      content:
        'Forensic analyst Katherine decoded the intricate conspiracy behind the corporate fraud. Layer by layer, she unraveled the sophisticated deception through meticulous analysis. The revelation exposed a web of corruption that reached the highest levels of power.',
    },
  ],
};

// Mock user and session IDs for testing
const TEST_USER_ID = 'test-validation-user-' + Date.now();
const TEST_SESSION_PREFIX = 'test-validation-session-';

interface ValidationResult {
  gradeLevel: GradeLevel;
  genre: string;
  storyContent: string;
  success: boolean;
  imageUrl?: string;
  prompt?: string;
  error?: string;
  timestamp: string;
}

/**
 * Generate test images for a specific grade level
 */
async function generateTestImagesForGrade(
  gradeLevel: GradeLevel,
): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  const stories = TEST_STORIES[gradeLevel];
  const numTests = IMAGES_PER_GRADE[TEST_MODE];

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing Grade Level: ${gradeLevel}`);
  console.log(
    `Test Mode: ${TEST_MODE} (${numTests} image${
      numTests === 1 ? '' : 's'
    } per grade)`,
  );
  console.log(`${'='.repeat(60)}\n`);

  for (let i = 0; i < Math.min(numTests, stories.length); i++) {
    const story = stories[i];
    const sessionId = `${TEST_SESSION_PREFIX}${gradeLevel}-${
      story.genre
    }-${Date.now()}`;

    console.log(
      `\n[${i + 1}/${numTests}] Generating image for ${story.genre}...`,
    );
    console.log(`Story preview: "${story.content.substring(0, 80)}..."`);

    try {
      const result = await imageGenerationService.generateImage({
        storyContent: story.content,
        gradeLevel,
        sessionId,
        userId: TEST_USER_ID,
        metadata: {
          validationTest: true,
          genre: story.genre,
          testRun: new Date().toISOString(),
        },
      });

      if (result.success && result.imageUrl) {
        console.log(`✅ Success! Image URL: ${result.imageUrl}`);
        console.log(`   Service used: ${result.serviceUsed}`);
        console.log(`   Response time: ${result.responseTimeMs}ms`);

        results.push({
          gradeLevel,
          genre: story.genre,
          storyContent: story.content,
          success: true,
          imageUrl: result.imageUrl,
          timestamp: new Date().toISOString(),
        });
      } else {
        console.log(`❌ Failed: ${result.error || 'Unknown error'}`);
        console.log(`   Error type: ${result.errorType}`);

        results.push({
          gradeLevel,
          genre: story.genre,
          storyContent: story.content,
          success: false,
          error: result.error || 'Unknown error',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.log(`❌ Exception: ${errorMessage}`);

      results.push({
        gradeLevel,
        genre: story.genre,
        storyContent: story.content,
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
    }

    // Add a delay between requests to avoid rate limiting
    if (i < stories.length - 1) {
      console.log('Waiting 3 seconds before next request...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  return results;
}

/**
 * Generate markdown report from validation results
 */
function generateMarkdownReport(allResults: ValidationResult[]): string {
  const timestamp = new Date().toISOString();
  const successCount = allResults.filter(r => r.success).length;
  const totalCount = allResults.length;
  const successRate = ((successCount / totalCount) * 100).toFixed(1);

  let markdown = `# Art Style Validation Report

**Generated:** ${timestamp}
**Total Tests:** ${totalCount}
**Successful:** ${successCount}
**Failed:** ${totalCount - successCount}
**Success Rate:** ${successRate}%

---

## Executive Summary

This report documents the results of manual visual validation testing for the art style enforcement system. The goal is to verify that images generated for each grade level (K-2, 3-5, 6-8, 9-12) consistently match their appropriate artistic styles as defined in \`ART_STYLE_MAPPING\`.

### Expected Art Styles by Grade Level

- **K-2**: Watercolor children's book illustration with bright colors, simple shapes, magical/whimsical tone
- **3-5**: Detailed illustration with vibrant colors, digital painting, adventurous tone
- **6-8**: Realistic digital art with sophisticated colors, high detail, heroic tone
- **9-12**: Sophisticated digital art with mature palette, complex composition, thoughtful/inspiring tone

---

## Test Results by Grade Level

`;

  // Group results by grade level
  const gradeGroups: Record<GradeLevel, ValidationResult[]> = {
    'K-2': [],
    '3-5': [],
    '6-8': [],
    '9-12': [],
  };

  allResults.forEach(result => {
    gradeGroups[result.gradeLevel].push(result);
  });

  // Generate sections for each grade level
  const gradeLevels: GradeLevel[] = ['K-2', '3-5', '6-8', '9-12'];

  gradeLevels.forEach(grade => {
    const results = gradeGroups[grade];
    const gradeSuccess = results.filter(r => r.success).length;
    const gradeTotal = results.length;

    markdown += `### ${grade} Grade Level\n\n`;
    markdown += `**Success Rate:** ${gradeSuccess}/${gradeTotal} (${(
      (gradeSuccess / gradeTotal) *
      100
    ).toFixed(1)}%)\n\n`;

    results.forEach((result, index) => {
      markdown += `#### Test ${index + 1}: ${
        result.genre.charAt(0).toUpperCase() + result.genre.slice(1)
      } Story\n\n`;
      markdown += `**Story Content:**\n`;
      markdown += `> ${result.storyContent}\n\n`;

      if (result.success) {
        markdown += `**Status:** ✅ Success\n\n`;
        markdown += `**Image URL:** [View Image](${result.imageUrl})\n\n`;
        markdown += `**Visual Inspection Checklist:**\n`;

        // Grade-specific checklist items
        if (grade === 'K-2') {
          markdown += `- [ ] Image uses watercolor illustration style (NOT photorealistic)\n`;
          markdown += `- [ ] Colors are bright and cheerful (soft pastels, vibrant hues)\n`;
          markdown += `- [ ] Shapes are simple and easy to understand\n`;
          markdown += `- [ ] Overall tone is magical/whimsical and age-appropriate\n`;
          markdown += `- [ ] Character style is cute and friendly\n`;
        } else if (grade === '3-5') {
          markdown += `- [ ] Image uses detailed illustration/digital painting style\n`;
          markdown += `- [ ] Colors are vibrant and engaging\n`;
          markdown += `- [ ] Visual complexity is moderate with clear details\n`;
          markdown += `- [ ] Overall tone is adventurous and inspiring\n`;
          markdown += `- [ ] Character style shows personality and expression\n`;
        } else if (grade === '6-8') {
          markdown += `- [ ] Image uses realistic digital art or semi-realistic style\n`;
          markdown += `- [ ] Colors are sophisticated with good contrast\n`;
          markdown += `- [ ] Visual complexity is high with fine details\n`;
          markdown += `- [ ] Overall tone is heroic and empowering\n`;
          markdown += `- [ ] Character style is dynamic and expressive\n`;
        } else if (grade === '9-12') {
          markdown += `- [ ] Image uses sophisticated digital art or realistic illustration\n`;
          markdown += `- [ ] Colors use a mature, refined palette\n`;
          markdown += `- [ ] Composition is complex and artistic\n`;
          markdown += `- [ ] Overall tone is thoughtful and inspiring\n`;
          markdown += `- [ ] Character style is realistic and nuanced\n`;
        }

        markdown += `\n**Notes:**\n`;
        markdown += `<!-- Add your visual inspection notes here -->\n\n`;
      } else {
        markdown += `**Status:** ❌ Failed\n\n`;
        markdown += `**Error:** ${result.error}\n\n`;
        markdown += `**Notes:**\n`;
        markdown += `<!-- Document why this test failed and any remediation steps -->\n\n`;
      }

      markdown += `---\n\n`;
    });
  });

  markdown += `## Before/After Comparison\n\n`;
  markdown += `### Before Fix\n\n`;
  markdown += `<!-- Add screenshots of images generated BEFORE the art style enforcement fix -->\n`;
  markdown += `<!-- Expected issue: K-2 and 3-5 images look photorealistic instead of watercolor/illustrated -->\n\n`;
  markdown += `### After Fix\n\n`;
  markdown += `<!-- Add screenshots of images generated AFTER the art style enforcement fix -->\n`;
  markdown += `<!-- Expected result: K-2 and 3-5 images look like watercolor children's book illustrations -->\n\n`;
  markdown += `---\n\n`;

  markdown += `## Conclusions\n\n`;
  markdown += `### Visual Validation Summary\n\n`;
  markdown += `<!-- After completing visual inspection, summarize your findings here -->\n\n`;
  markdown += `#### K-2 Grade Level\n`;
  markdown += `- [ ] All K-2 images use watercolor children's book illustration style\n`;
  markdown += `- [ ] No photorealistic images in K-2 category\n`;
  markdown += `- [ ] Art style is consistently age-appropriate\n\n`;
  markdown += `#### 3-5 Grade Level\n`;
  markdown += `- [ ] All 3-5 images use detailed illustration/digital painting style\n`;
  markdown += `- [ ] Art style matches \`ART_STYLE_MAPPING\` definition\n`;
  markdown += `- [ ] Visual complexity is appropriate for age group\n\n`;
  markdown += `#### 6-8 Grade Level\n`;
  markdown += `- [ ] All 6-8 images use realistic/semi-realistic digital art\n`;
  markdown += `- [ ] Art style matches \`ART_STYLE_MAPPING\` definition\n`;
  markdown += `- [ ] Sophistication level is appropriate for age group\n\n`;
  markdown += `#### 9-12 Grade Level\n`;
  markdown += `- [ ] All 9-12 images use sophisticated digital art\n`;
  markdown += `- [ ] Art style matches \`ART_STYLE_MAPPING\` definition\n`;
  markdown += `- [ ] Maturity and complexity are appropriate for age group\n\n`;

  markdown += `### Recommendations\n\n`;
  markdown += `<!-- Based on visual inspection, list any recommended fixes or improvements -->\n\n`;
  markdown += `---\n\n`;
  markdown += `**Validation Status:** ⏳ Pending Manual Review\n\n`;
  markdown += `**Reviewer:** _TBD_\n\n`;
  markdown += `**Review Date:** _TBD_\n\n`;

  return markdown;
}

/**
 * Main execution function
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Art Style Validation Script                              ║');
  console.log('║   Testing image generation across all grade levels         ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  // Check if we have necessary environment variables
  console.log('Checking environment configuration...');
  const config =
    require('../src/services/environment').getImageGenerationConfig();

  if (!config.enabled) {
    console.error(
      '❌ Error: Image generation is not enabled in environment config',
    );
    console.error(
      '   Please check your .env file and ensure image generation is configured.',
    );
    process.exit(1);
  }

  if (!config.primaryApiToken) {
    console.error('❌ Error: REPLICATE_API_TOKEN is not set');
    console.error(
      '   Please set this in your .env file to run validation tests.',
    );
    process.exit(1);
  }

  console.log('✅ Environment configuration looks good!\n');

  const allResults: ValidationResult[] = [];
  const gradeLevels: GradeLevel[] = ['K-2', '3-5', '6-8', '9-12'];

  // Generate images for each grade level
  for (const grade of gradeLevels) {
    const results = await generateTestImagesForGrade(grade);
    allResults.push(...results);

    // Add delay between grade levels
    if (grade !== '9-12') {
      console.log('\n⏳ Waiting 5 seconds before next grade level...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  // Generate report
  console.log('\n' + '='.repeat(60));
  console.log('Generating validation report...');
  console.log('='.repeat(60) + '\n');

  const reportContent = generateMarkdownReport(allResults);
  const reportPath = path.join(
    __dirname,
    '..',
    '.agent',
    'Tasks',
    'art-style-validation-report.md',
  );

  // Ensure .agent/Tasks directory exists
  const tasksDir = path.dirname(reportPath);
  if (!fs.existsSync(tasksDir)) {
    fs.mkdirSync(tasksDir, { recursive: true });
  }

  // Write report
  fs.writeFileSync(reportPath, reportContent, 'utf8');

  console.log('✅ Validation report generated successfully!');
  console.log(`   Report saved to: ${reportPath}`);
  console.log('');

  // Print summary
  const successCount = allResults.filter(r => r.success).length;
  const totalCount = allResults.length;
  const failCount = totalCount - successCount;

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Validation Summary                                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Total tests run:     ${totalCount}`);
  console.log(`Successful:          ${successCount} ✅`);
  console.log(`Failed:              ${failCount} ❌`);
  console.log(
    `Success rate:        ${((successCount / totalCount) * 100).toFixed(1)}%`,
  );
  console.log('');

  if (successCount === totalCount) {
    console.log(
      '🎉 All tests passed! Now proceed with manual visual inspection.',
    );
  } else {
    console.log('⚠️  Some tests failed. Check the report for details.');
  }

  console.log('');
  console.log('Next steps:');
  console.log(
    '1. Open the generated report: .agent/Tasks/art-style-validation-report.md',
  );
  console.log('2. View each generated image by clicking the image URLs');
  console.log('3. Complete the visual inspection checklists for each image');
  console.log('4. Document any issues or observations in the Notes sections');
  console.log('5. Complete the Before/After comparison section');
  console.log('6. Update the Conclusions section with your findings');
  console.log('');
}

// Run the script
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
