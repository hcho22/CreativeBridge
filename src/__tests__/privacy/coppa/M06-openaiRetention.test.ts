/**
 * M-06: OpenAI Data Retention Tests
 *
 * Audit finding: OpenAI may retain API request data for up to 30 days by default.
 * For COPPA compliance, the app should either:
 * 1. Use the Zero Data Retention (ZDR) header, or
 * 2. Have an org-level opt-out configured (verified by OPENAI_ORG_ID usage)
 *
 * @implements M-06
 */

import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '../../../../');

function readSourceFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(PROJECT_ROOT, relativePath), 'utf-8');
}

describe('M-06: OpenAI Data Retention', () => {
  let aiSource: string;

  beforeAll(() => {
    aiSource = readSourceFile('convex/ai.ts');
  });

  test.failing(
    '[M-06] convex/ai.ts includes ZDR header or data retention opt-out',
    () => {
      // OpenAI ZDR can be requested via header or org-level setting.
      // The code should include either:
      // 1. An explicit ZDR/data-retention header
      // 2. A comment documenting that org-level opt-out is configured
      expect(aiSource).toMatch(
        /x-openai-data|zero.data.retention|ZDR|data.retention.*opt/i,
      );
    },
  );

  test('[M-06] convex/ai.ts passes OPENAI_ORG_ID in headers when available', () => {
    // The org ID is needed for org-level data retention policies to apply
    expect(aiSource).toMatch(/OPENAI_ORG_ID/);
    expect(aiSource).toMatch(/OpenAI-Organization/);
  });
});
