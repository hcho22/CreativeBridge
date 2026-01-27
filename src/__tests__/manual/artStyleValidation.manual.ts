/**
 * MANUAL TEST HELPER: Art Style Validation
 *
 * This file contains test data and helpers for manually validating art style
 * enforcement across all grade levels. Since this requires actual image generation,
 * it must be run within the app context (not as a standalone script).
 *
 * HOW TO USE THIS FOR MANUAL TESTING:
 *
 * 1. Copy the test stories from this file
 * 2. In the CreativeBridge app, create a new story for each grade level
 * 3. Paste the test story content from TEST_STORIES below
 * 4. Generate an image for each story
 * 5. Visually inspect the generated images using the checklists below
 * 6. Document your findings in .agent/Tasks/art-style-validation-report.md
 *
 * QUICK TEST MODE: Test 1 story per grade (4 total images)
 * STANDARD TEST MODE: Test 3 stories per grade (12 total images)
 */

import { GradeLevel } from '../../types/database';

export interface TestStory {
  gradeLevel: GradeLevel;
  genre: 'adventure' | 'friendship' | 'mystery';
  content: string;
  expectedStyles: string[];
  visualChecklist: string[];
}

/**
 * Test stories for quick mode (1 per grade level)
 */
export const QUICK_TEST_STORIES: TestStory[] = [
  {
    gradeLevel: 'K-2',
    genre: 'adventure',
    content:
      'Luna the brave kitten explored the magical garden. She found a sparkling butterfly dancing among the bright flowers. The happy kitten played with her new friend under the rainbow.',
    expectedStyles: [
      "watercolor children's book illustration",
      'bright colors',
      'soft pastels',
      'simple shapes',
      'magical',
      'whimsical',
    ],
    visualChecklist: [
      '✓ Image uses watercolor illustration style (NOT photorealistic)',
      '✓ Colors are bright and cheerful',
      '✓ Shapes are simple and easy to understand',
      '✓ Overall tone is magical/whimsical',
      '✓ Character style is cute and friendly',
    ],
  },
  {
    gradeLevel: '3-5',
    genre: 'adventure',
    content:
      'Zara the adventurous explorer discovered an ancient temple hidden deep in the jungle. Golden vines covered the mysterious entrance, and exotic birds called from the canopy above. She carefully stepped inside, her flashlight revealing incredible treasures.',
    expectedStyles: [
      'detailed illustration',
      'digital storybook illustration',
      'vibrant colors',
      'moderate detail',
      'adventurous',
    ],
    visualChecklist: [
      '✓ Image uses detailed illustration/digital painting style',
      '✓ Colors are vibrant and engaging',
      '✓ Visual complexity is moderate with clear details',
      '✓ Overall tone is adventurous and inspiring',
      '✓ Character style shows personality and expression',
    ],
  },
  {
    gradeLevel: '6-8',
    genre: 'adventure',
    content:
      'Commander Aria led her skilled crew through the dangerous asteroid field. Warning lights flashed as the sophisticated spaceship navigated the treacherous debris. With precise calculations and courage, she guided them safely to the distant planet.',
    expectedStyles: [
      'realistic digital art',
      'semi-realistic',
      'sophisticated colors',
      'high detail',
      'heroic',
    ],
    visualChecklist: [
      '✓ Image uses realistic digital art or semi-realistic style',
      '✓ Colors are sophisticated with good contrast',
      '✓ Visual complexity is high with fine details',
      '✓ Overall tone is heroic and empowering',
      '✓ Character style is dynamic and expressive',
    ],
  },
  {
    gradeLevel: '9-12',
    genre: 'adventure',
    content:
      'Dr. Elena Rivera embarked on a perilous expedition to document the endangered ecosystem. Her sophisticated equipment captured unprecedented data as she navigated the hostile terrain. The groundbreaking research would reshape environmental policy worldwide.',
    expectedStyles: [
      'sophisticated digital art',
      'realistic illustration',
      'mature palette',
      'complex composition',
      'thoughtful',
      'inspiring',
    ],
    visualChecklist: [
      '✓ Image uses sophisticated digital art or realistic illustration',
      '✓ Colors use a mature, refined palette',
      '✓ Composition is complex and artistic',
      '✓ Overall tone is thoughtful and inspiring',
      '✓ Character style is realistic and nuanced',
    ],
  },
];

/**
 * Full test stories for standard mode (3 per grade level)
 */
export const STANDARD_TEST_STORIES: TestStory[] = [
  // K-2 Grade Level
  ...QUICK_TEST_STORIES.filter(s => s.gradeLevel === 'K-2'),
  {
    gradeLevel: 'K-2',
    genre: 'friendship',
    content:
      'Benny the cheerful bear met Rosie the gentle rabbit in the sunny meadow. They shared delicious honey and picked colorful berries together. The two friends laughed and played all day long.',
    expectedStyles: [
      "watercolor children's book illustration",
      'bright colors',
      'simple shapes',
      'magical',
      'whimsical',
    ],
    visualChecklist: QUICK_TEST_STORIES[0].visualChecklist,
  },
  {
    gradeLevel: 'K-2',
    genre: 'mystery',
    content:
      'Max the curious puppy discovered mysterious paw prints in the soft snow. He followed the trail through the quiet forest until he found a friendly fox hiding behind a tree. They became best friends and shared the secret.',
    expectedStyles: [
      "watercolor children's book illustration",
      'bright colors',
      'simple shapes',
      'magical',
      'whimsical',
    ],
    visualChecklist: QUICK_TEST_STORIES[0].visualChecklist,
  },

  // 3-5 Grade Level
  ...QUICK_TEST_STORIES.filter(s => s.gradeLevel === '3-5'),
  {
    gradeLevel: '3-5',
    genre: 'friendship',
    content:
      'Maya the talented artist and Jake the creative musician formed an amazing partnership. Together they painted vibrant murals and composed beautiful melodies for their neighborhood. The whole community celebrated their inspiring collaboration.',
    expectedStyles: [
      'detailed illustration',
      'vibrant colors',
      'moderate detail',
      'adventurous',
    ],
    visualChecklist: QUICK_TEST_STORIES[1].visualChecklist,
  },
  {
    gradeLevel: '3-5',
    genre: 'mystery',
    content:
      'Detective Oliver investigated the puzzling case of the missing library books. He found mysterious clues hidden between the dusty shelves and secret passages behind the old bookcases. The clever boy solved the enigma by following the trail of bookmarks.',
    expectedStyles: [
      'detailed illustration',
      'vibrant colors',
      'moderate detail',
      'adventurous',
    ],
    visualChecklist: QUICK_TEST_STORIES[1].visualChecklist,
  },

  // 6-8 Grade Level
  ...QUICK_TEST_STORIES.filter(s => s.gradeLevel === '6-8'),
  {
    gradeLevel: '6-8',
    genre: 'friendship',
    content:
      'Marcus the determined athlete and Sam the brilliant strategist formed an unstoppable team. They trained intensively, combining physical prowess with tactical intelligence. Their powerful bond helped them overcome every challenge in the championship.',
    expectedStyles: [
      'realistic digital art',
      'sophisticated colors',
      'high detail',
      'heroic',
    ],
    visualChecklist: QUICK_TEST_STORIES[2].visualChecklist,
  },
  {
    gradeLevel: '6-8',
    genre: 'mystery',
    content:
      'Investigator Chen examined the cryptic symbols carved into the ancient monument. Advanced technology revealed hidden patterns that connected to historical records. The complex puzzle required both scientific knowledge and intuitive reasoning to decode.',
    expectedStyles: [
      'realistic digital art',
      'sophisticated colors',
      'high detail',
      'heroic',
    ],
    visualChecklist: QUICK_TEST_STORIES[2].visualChecklist,
  },

  // 9-12 Grade Level
  ...QUICK_TEST_STORIES.filter(s => s.gradeLevel === '9-12'),
  {
    gradeLevel: '9-12',
    genre: 'friendship',
    content:
      'Professor James and Dr. Sarah collaborated on revolutionary quantum research. Their intellectual synergy bridged theoretical physics and practical engineering. The profound partnership challenged conventional understanding and inspired the next generation of scientists.',
    expectedStyles: [
      'sophisticated digital art',
      'mature palette',
      'complex composition',
      'thoughtful',
      'inspiring',
    ],
    visualChecklist: QUICK_TEST_STORIES[3].visualChecklist,
  },
  {
    gradeLevel: '9-12',
    genre: 'mystery',
    content:
      'Forensic analyst Katherine decoded the intricate conspiracy behind the corporate fraud. Layer by layer, she unraveled the sophisticated deception through meticulous analysis. The revelation exposed a web of corruption that reached the highest levels of power.',
    expectedStyles: [
      'sophisticated digital art',
      'mature palette',
      'complex composition',
      'thoughtful',
      'inspiring',
    ],
    visualChecklist: QUICK_TEST_STORIES[3].visualChecklist,
  },
];

/**
 * Helper function to print test instructions
 */
export function printTestInstructions(
  mode: 'quick' | 'standard' = 'quick',
): void {
  const stories = mode === 'quick' ? QUICK_TEST_STORIES : STANDARD_TEST_STORIES;

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Art Style Validation - Manual Testing Guide             ║');
  console.log(`║   Mode: ${mode.toUpperCase().padEnd(50)} ║`);
  console.log(
    '╚════════════════════════════════════════════════════════════╝\n',
  );

  console.log(`Total stories to test: ${stories.length}\n`);

  stories.forEach((story, index) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(
      `Test ${index + 1}/${stories.length}: ${
        story.gradeLevel
      } - ${story.genre.toUpperCase()}`,
    );
    console.log(`${'='.repeat(60)}`);
    console.log(`\nStory Content:\n${story.content}\n`);
    console.log('Expected Art Styles:');
    story.expectedStyles.forEach(style => console.log(`  • ${style}`));
    console.log('\nVisual Checklist:');
    story.visualChecklist.forEach(item => console.log(`  ${item}`));
    console.log('');
  });

  console.log(
    '\n╔════════════════════════════════════════════════════════════╗',
  );
  console.log('║   Next Steps                                               ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('1. For each test story above:');
  console.log('   a. Create a new story in the CreativeBridge app');
  console.log('   b. Set the appropriate grade level');
  console.log('   c. Copy/paste the story content');
  console.log('   d. Generate an image');
  console.log('   e. Save the image URL for documentation');
  console.log('');
  console.log('2. Visually inspect each generated image using the checklist');
  console.log('');
  console.log('3. Document results in:');
  console.log('   .agent/Tasks/art-style-validation-report.md');
  console.log('');
}

/**
 * Generate a markdown template for documenting results
 */
export function generateValidationTemplate(
  mode: 'quick' | 'standard' = 'quick',
): string {
  const stories = mode === 'quick' ? QUICK_TEST_STORIES : STANDARD_TEST_STORIES;
  const timestamp = new Date().toISOString();

  let markdown = `# Art Style Validation Report

**Generated:** ${timestamp}
**Test Mode:** ${mode}
**Total Tests:** ${stories.length}

---

## Executive Summary

This report documents manual visual validation of the art style enforcement system.

### Expected Art Styles by Grade Level

- **K-2**: Watercolor children's book illustration with bright colors, simple shapes, magical/whimsical tone
- **3-5**: Detailed illustration with vibrant colors, digital painting, adventurous tone
- **6-8**: Realistic digital art with sophisticated colors, high detail, heroic tone
- **9-12**: Sophisticated digital art with mature palette, complex composition, thoughtful/inspiring tone

---

## Test Results

`;

  stories.forEach((story, index) => {
    markdown += `### Test ${index + 1}: ${story.gradeLevel} - ${
      story.genre.charAt(0).toUpperCase() + story.genre.slice(1)
    }

**Story Content:**
> ${story.content}

**Image URL:** _[Paste generated image URL here]_

**Visual Inspection:**
${story.visualChecklist
  .map(item => `- [ ] ${item.replace('✓', '').trim()}`)
  .join('\n')}

**Notes:**
<!-- Add your observations here -->

**Result:** ⬜ Pass / ⬜ Fail

---

`;
  });

  markdown += `## Conclusions

### Overall Validation Status

- [ ] All K-2 images use watercolor children's book style (not photorealistic)
- [ ] All 3-5 images use appropriate detailed illustration style
- [ ] All 6-8 images use appropriate realistic/semi-realistic style
- [ ] All 9-12 images use appropriate sophisticated digital art style

### Issues Found

<!-- Document any issues or unexpected results -->

### Recommendations

<!-- List any recommended fixes or improvements -->

---

**Validation Completed By:** _[Your Name]_
**Date:** _[Date]_
**Status:** ⏳ In Progress / ✅ Complete / ❌ Failed
`;

  return markdown;
}
