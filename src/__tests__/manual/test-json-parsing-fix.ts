/**
 * Manual test to verify JSON parsing fix for story element extraction
 *
 * This test verifies that the fix for the JSON parsing issue works correctly.
 * The issue was caused by stop sequences ('\n\n', '###') truncating JSON responses.
 *
 * Run this test with:
 * npx ts-node src/__tests__/manual/test-json-parsing-fix.ts
 */

import { storyElementExtractionService } from '../../services/storyElementExtractionService';

const testStory = `
Eli stepped into the cavernous chamber, where ancient symbols glowed faintly on the walls.
The air was thick with mystery as he discovered a hidden passage leading deeper into the
underground labyrinth. His heart raced with excitement as he ventured forward, ready to
uncover the secrets that lay ahead.
`;

async function testJSONParsing() {
  console.log('🧪 Testing JSON parsing fix for story element extraction...\n');
  console.log('Test story:', testStory.trim(), '\n');

  try {
    const elements = await storyElementExtractionService.extractStoryElements(
      testStory,
    );

    console.log('\n✅ SUCCESS! Story elements extracted:\n');
    console.log('Characters:', JSON.stringify(elements.characters, null, 2));
    console.log('Settings:', JSON.stringify(elements.settings, null, 2));
    console.log('Objects:', JSON.stringify(elements.objects, null, 2));
    console.log(
      'Plot Patterns:',
      JSON.stringify(elements.plot_patterns, null, 2),
    );

    console.log('\n🎉 Test passed! JSON parsing is working correctly.');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ FAILED! Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testJSONParsing();
