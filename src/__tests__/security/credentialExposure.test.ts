/**
 * Credential Exposure Validation Tests
 *
 * Verifies that no hardcoded API keys, secrets, or credentials exist
 * in client-side source code after US-001 remediation.
 *
 * @implements US-001: S-1.1, S-1.2, S-1.3
 */

import * as fs from 'fs';
import * as path from 'path';

const SRC_DIR = path.resolve(__dirname, '../../');

function readFileContent(filePath: string): string {
  return fs.readFileSync(path.resolve(SRC_DIR, filePath), 'utf-8');
}

function findFilesRecursively(dir: string, ext: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (
      entry.isDirectory() &&
      entry.name !== 'node_modules' &&
      entry.name !== '__tests__'
    ) {
      results.push(...findFilesRecursively(fullPath, ext));
    } else if (entry.isFile() && entry.name.endsWith(ext)) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('Credential Exposure Validation (US-001)', () => {
  test('no hardcoded OpenAI API key (sk-proj-*) in src/', () => {
    const tsFiles = findFilesRecursively(SRC_DIR, '.ts').filter(
      f => !f.includes('__tests__'),
    );
    for (const filePath of tsFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).not.toMatch(/sk-proj-[A-Za-z0-9_-]{20,}/);
    }
  });

  test('no Clerk secretKey in environment config', () => {
    const envConfig = readFileContent('config/environment.ts');
    expect(envConfig).not.toMatch(/secretKey/);
  });

  test('no hardcoded Supabase JWT (eyJhbGciOi*) in supabase.ts or environment.ts', () => {
    const supabase = readFileContent('services/supabase.ts');
    const environment = readFileContent('services/environment.ts');
    expect(supabase).not.toMatch(/eyJhbGciOi[A-Za-z0-9_-]+/);
    expect(environment).not.toMatch(/eyJhbGciOi[A-Za-z0-9_-]+/);
  });

  test('apiKey falls back to empty string when env var is unset', () => {
    const envConfig = readFileContent('config/environment.ts');
    // The OpenAI apiKey assignment should be: OPENAI_API_KEY || ''
    expect(envConfig).toMatch(/apiKey:\s*OPENAI_API_KEY\s*\|\|\s*''/);
  });

  test('OpenAI key is loaded only from env var, not from inline fallback', () => {
    const envConfig = readFileContent('config/environment.ts');
    // Should not contain any __DEV__ fallback for API key
    const apiKeySection = envConfig.match(
      /apiKey:[\s\S]*?(?=orgId:|,\s*\n\s*orgId)/,
    );
    if (apiKeySection) {
      expect(apiKeySection[0]).not.toContain('__DEV__');
      expect(apiKeySection[0]).not.toMatch(/sk-/);
    }
  });
});
