/**
 * M-01: Client IP Exposure via Direct AI API Calls
 *
 * Audit finding: Client-side services that call external AI APIs directly
 * (not via Convex server-side actions) expose the child's IP address to
 * third-party services (OpenAI, Replicate).
 *
 * Cross-references C-03: all AI calls should be routed server-side.
 * These services still contain client-side fetch() calls to AI endpoints.
 *
 * @implements M-01
 */

import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '../../../../');

function readSourceFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(PROJECT_ROOT, relativePath), 'utf-8');
}

describe('M-01: Client IP Exposure via Direct AI Calls', () => {
  test('[M-01] convex/ai.ts routes AI calls server-side (baseline verification)', () => {
    const aiSource = readSourceFile('convex/ai.ts');
    // Server-side actions use fetch internally but run on Convex infrastructure
    expect(aiSource).toContain('export const generateStoryCompletion = action');
    expect(aiSource).toContain(
      'export const analyzeStoryForImageGeneration = action',
    );
    expect(aiSource).toContain('export const moderateContent = action');
  });

  test.failing(
    '[M-01] imageGeneration.ts does not make direct client-side fetch to AI APIs',
    () => {
      const source = readSourceFile('src/services/imageGeneration.ts');
      // Should not contain fetch() calls to external AI endpoints
      // Currently contains direct fetch to Replicate API
      expect(source).not.toMatch(
        /fetch\s*\(\s*['"`]https?:\/\/api\.(openai|replicate)/,
      );
      // Ideally all image generation goes through Convex actions
      expect(source).not.toMatch(/fetch\s*\(\s*url/);
    },
  );

  test.failing(
    '[M-01] embeddingGenerationService.ts does not make direct client-side fetch to AI APIs',
    () => {
      const source = readSourceFile(
        'src/services/embeddingGenerationService.ts',
      );
      // Should not contain direct fetch() calls to OpenAI
      expect(source).not.toMatch(/fetch\s*\(/);
    },
  );

  test.failing(
    '[M-01] contentSafetyService.ts does not make direct client-side fetch to AI APIs',
    () => {
      const source = readSourceFile('src/services/contentSafetyService.ts');
      // Should not contain direct fetch() to OpenAI moderations endpoint
      expect(source).not.toMatch(/fetch\s*\(/);
    },
  );
});
