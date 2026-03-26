/**
 * Supabase Migration Cleanup Tests (US-005)
 *
 * Validates that ghost Supabase dependencies have been removed or migrated:
 * - syncService uses local storage, not Supabase
 * - monitoringService computes metrics locally, not via Supabase
 * - errorLogger has no Supabase dependency
 * - claudeSkillsMonitor has no Supabase data upload
 * - postGenerationStorageService processes Convex-format IDs
 * - storyQuestService base URL is configurable via environment
 */

import * as fs from 'fs';
import * as path from 'path';

const servicesDir = path.resolve(__dirname, '../../services');

function readServiceFile(filename: string): string {
  return fs.readFileSync(path.join(servicesDir, filename), 'utf-8');
}

describe('Supabase Migration Cleanup (US-005)', () => {
  test('M-5.1: syncService does not import or call supabase', () => {
    const source = readServiceFile('syncService.ts');

    // Should NOT import supabase
    expect(source).not.toMatch(/import\s+.*from\s+['"]\.\/supabase['"]/);

    // Should NOT call supabase.from()
    expect(source).not.toMatch(/supabase\s*\.\s*from\s*\(/);

    // Should NOT use supabase.channel() for real-time
    expect(source).not.toMatch(/supabase\s*\.\s*channel\s*\(/);

    // Should have cross-device sync disabled
    expect(source).toMatch(/CROSS_DEVICE_SYNC_ENABLED\s*=\s*false/);
  });

  test('M-5.2: monitoringService does not import or query supabase', () => {
    const source = readServiceFile('monitoringService.ts');

    // Should NOT import supabase
    expect(source).not.toMatch(/import\s+.*from\s+['"]\.\/supabase['"]/);

    // Should NOT call supabase.from()
    expect(source).not.toMatch(/supabase\s*\.\s*from\s*\(/);

    // Should have an ingestEvents method for receiving Convex data
    expect(source).toMatch(/ingestEvents/);
  });

  test('M-5.3: errorLogger does not import supabase', () => {
    const source = readServiceFile('errorLogger.ts');

    // Should NOT import supabase
    expect(source).not.toMatch(/import\s+.*from\s+['"]\.\/supabase['"]/);

    // Should NOT call supabase.from()
    expect(source).not.toMatch(/supabase\s*\.\s*from\s*\(/);
  });

  test('M-5.4: claudeSkillsMonitor does not upload to supabase', () => {
    const source = readServiceFile('claudeSkillsMonitor.ts');

    // Should NOT import supabase
    expect(source).not.toMatch(/import\s+.*from\s+['"]\.\/supabase['"]/);

    // Should NOT call supabase.from('analytics_events')
    expect(source).not.toMatch(
      /supabase\s*\.\s*from\s*\(\s*['"]analytics_events['"]\s*\)/,
    );

    // Should NOT have any supabase.from() calls at all
    expect(source).not.toMatch(/supabase\s*\.\s*from\s*\(/);
  });

  test('M-5.5: postGenerationStorageService processes Convex-format IDs (does not skip them)', () => {
    const source = readServiceFile('postGenerationStorageService.ts');

    // The old code had an early-return that skipped ALL processing for Convex IDs.
    // The new code should NOT have an early return that skips Convex IDs entirely.
    // It should proceed with extraction for both ID formats.

    // Should NOT have the old pattern: skip + return { success: true, elementsStored: 0 }
    // right after detecting Convex IDs
    expect(source).not.toMatch(
      /if\s*\(\s*!isValidUUID\(sessionId\)\s*\|\|\s*!isValidUUID\(storyId\)\s*\)\s*\{[^}]*return\s*\{/s,
    );

    // Should have a Convex-format branch that proceeds with processing
    expect(source).toMatch(/isConvexFormat/);
  });

  test('M-5.6: storyQuestService base URL reads from environment, not hardcoded localhost', () => {
    const source = readServiceFile('storyQuestService.ts');

    // Should NOT have hardcoded localhost URL
    expect(source).not.toMatch(/localhost:5000/);
    expect(source).not.toMatch(/http:\/\/localhost/);

    // Should read from environment
    expect(source).toMatch(/process\.env\.STORY_QUEST_API_BASE/);

    // Should have a feature flag
    expect(source).toMatch(/STORY_QUEST_ENABLED/);
  });
});
