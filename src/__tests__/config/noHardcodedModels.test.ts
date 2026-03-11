/**
 * No Hardcoded OpenAI Model Strings Validation
 *
 * Validates US-005: Global validation that no gpt-4-turbo-preview references
 * remain in source code (excluding test files).
 * Based on: prd-gpt4o-mini-upgrade.md
 */

import * as fs from 'fs';
import * as path from 'path';

function getAllTsFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (
      entry.isDirectory() &&
      entry.name !== 'node_modules' &&
      entry.name !== '__tests__'
    ) {
      results.push(...getAllTsFiles(fullPath));
    } else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('No hardcoded OpenAI model strings in source code', () => {
  it('should not contain gpt-4-turbo-preview in any source file under src/', () => {
    const srcDir = path.resolve(__dirname, '../../');
    const files = getAllTsFiles(srcDir);
    const violations: string[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      if (content.includes('gpt-4-turbo-preview')) {
        violations.push(file);
      }
    }

    expect(violations).toEqual([]);
  });
});
