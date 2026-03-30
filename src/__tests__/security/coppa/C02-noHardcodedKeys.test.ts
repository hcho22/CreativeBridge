/**
 * C-02: Hardcoded API Key Regression Tests
 *
 * Verifies that no hardcoded API keys, secrets, or tokens exist in source
 * code after the C-02 remediation. Extends credentialExposure.test.ts with
 * broader scope covering the `convex/` directory.
 *
 * Static source analysis only — no runtime mocking.
 *
 * @implements COPPA Audit Finding C-02
 * @see .claude/audit/coppa-audit-2026-03-25.md
 */

import { readSourceFile, findAllFiles, scanFilesForPattern } from './helpers';

describe('C-02: No Hardcoded API Keys in Source', () => {
  // Collect all TypeScript files in src/ and convex/ (excluding tests, generated files)
  const srcFiles = findAllFiles('src', '.ts', [
    '__tests__',
    'node_modules',
    '.expo',
    'build',
    'ios',
    'android',
  ]);
  const convexFiles = findAllFiles('convex', '.ts', [
    '_generated',
    'node_modules',
  ]);
  const allSourceFiles = [...srcFiles, ...convexFiles];

  test('[C-02] No sk-proj-*, sk-live-*, sk-test-* patterns in src/ or convex/', () => {
    const openaiKeyPattern = /sk-(?:proj|live|test)-[A-Za-z0-9_-]{20,}/g;
    const hits = scanFilesForPattern(allSourceFiles, openaiKeyPattern);

    expect(hits).toEqual([]);
  });

  test('[C-02] No Replicate API tokens (r8_ prefix) in source', () => {
    const replicateKeyPattern = /r8_[A-Za-z0-9]{30,}/g;
    const hits = scanFilesForPattern(allSourceFiles, replicateKeyPattern);

    expect(hits).toEqual([]);
  });

  test('[C-02] No hardcoded Supabase JWTs in source', () => {
    const supabaseJwtPattern = /eyJhbGciOi[A-Za-z0-9_-]{20,}/g;
    const hits = scanFilesForPattern(allSourceFiles, supabaseJwtPattern);

    expect(hits).toEqual([]);
  });

  test('[C-02] environment.ts imports API keys from @env module', () => {
    const envConfig = readSourceFile('src/config/environment.ts');

    // Must import OPENAI_API_KEY from the @env module (react-native-dotenv)
    expect(envConfig).toMatch(
      /import\s*\{[^}]*OPENAI_API_KEY[^}]*\}\s*from\s*['"]@env['"]/,
    );
  });

  test('[C-02] convex/ai.ts reads API key from process.env', () => {
    const convexAI = readSourceFile('convex/ai.ts');

    // Server-side code should read key from process.env, not hardcode it
    expect(convexAI).toMatch(/process\.env\.OPENAI_API_KEY/);
  });

  test('[C-02] .env file is listed in .gitignore', () => {
    const gitignore = readSourceFile('.gitignore');

    // .gitignore must contain a .env entry (exact line or with wildcard)
    // Split into lines and check for .env pattern
    const lines = gitignore.split('\n').map(l => l.trim());
    const hasEnvEntry = lines.some(
      line => line === '.env' || line === '.env*' || line === '.env.local',
    );

    expect(hasEnvEntry).toBe(true);
  });
});
