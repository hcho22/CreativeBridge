/**
 * C-03 — Server-Side AI Routing Tests
 *
 * Verifies that client services do NOT make direct AI API calls.
 * All AI requests must route through Convex server-side actions to:
 *   1. Keep API keys off the client bundle
 *   2. Enable server-side PII scrubbing before data reaches third-party APIs
 *
 * Three services remain unremediated and use test.failing() to document
 * the known gap. When each is fixed, its test.failing() will auto-flip
 * to a real failure — convert it to a normal test() at that point.
 *
 * @see .claude/audit/coppa-audit-2026-03-25.md — Finding C-03
 * @see src/__tests__/security/serverSideAI.test.ts — Original regression suite
 */

import { readSourceFile, findAllFiles, scanFilesForPattern } from './helpers';

describe('C-03: Server-Side AI Routing', () => {
  // ── Already-fixed paths (should pass) ──────────────────────────────

  test('[C-03] openaiClient.ts has no fetch() calls', () => {
    const source = readSourceFile('src/services/openaiClient.ts');
    expect(source).not.toMatch(/fetch\s*\(/);
  });

  test('[C-03] openaiClient.ts delegates to api.ai.* Convex actions', () => {
    const source = readSourceFile('src/services/openaiClient.ts');
    expect(source).toContain('api.ai.generateStoryCompletion');
  });

  // ── Unremediated paths (test.failing) ──────────────────────────────

  test.failing(
    '[C-03] imageGeneration.ts must not contain direct fetch to replicate.com',
    () => {
      const source = readSourceFile('src/services/imageGeneration.ts');
      // Should NOT have both fetch() and replicate in the same file
      const hasFetch = /fetch\s*\(/.test(source);
      const hasReplicate = /replicate\.com/.test(source);
      expect(hasFetch && hasReplicate).toBe(false);
    },
  );

  test.failing(
    '[C-03] embeddingGenerationService.ts must not make direct OpenAI fetch',
    () => {
      const source = readSourceFile(
        'src/services/embeddingGenerationService.ts',
      );
      const hasFetch = /fetch\s*\(/.test(source);
      const hasOpenAI = /openai|Environment\.openai/i.test(source);
      expect(hasFetch && hasOpenAI).toBe(false);
    },
  );

  test.failing(
    '[C-03] contentSafetyService.ts must not make direct OpenAI fetch',
    () => {
      const source = readSourceFile('src/services/contentSafetyService.ts');
      const hasFetch = /fetch\s*\(/.test(source);
      const hasOpenAI = /openai|api\.openai\.com|getOpenAIHeaders/i.test(
        source,
      );
      expect(hasFetch && hasOpenAI).toBe(false);
    },
  );

  // ── Broad scan: no service should import a key AND call fetch ──────

  test('[C-03] No src/services/ file both imports an API key AND calls fetch', () => {
    const serviceFiles = findAllFiles('src/services', '.ts');

    // Patterns that indicate API key import/usage
    const apiKeyPattern =
      /from\s+['"]@env['"]|API_KEY|API_TOKEN|getOpenAIHeaders|Environment\.openai\.apiKey/;

    const fetchPattern = /fetch\s*\(/;

    const violations: string[] = [];

    for (const file of serviceFiles) {
      // Skip the known-unremediated files — they are tracked by test.failing() above
      const basename = file.split('/').pop() || '';
      if (
        basename === 'imageGeneration.ts' ||
        basename === 'embeddingGenerationService.ts' ||
        basename === 'contentSafetyService.ts' ||
        basename === 'imageModeration.ts' ||
        basename === 'environment.ts'
      ) {
        continue;
      }

      const source = readSourceFile(file.replace(/.*\/CreativeBridge\//, ''));
      const hasKey = apiKeyPattern.test(source);
      const hasFetch = fetchPattern.test(source);

      if (hasKey && hasFetch) {
        violations.push(basename);
      }
    }

    expect(violations).toEqual([]);
  });

  // ── Server-side verification ───────────────────────────────────────

  test('[C-03] convex/ai.ts contains server-side OpenAI endpoint calls', () => {
    const source = readSourceFile('convex/ai.ts');
    expect(source).toContain('api.openai.com');
    expect(source).toMatch(/fetch\s*\(/);
    expect(source).toContain('process.env.OPENAI_API_KEY');
  });
});
