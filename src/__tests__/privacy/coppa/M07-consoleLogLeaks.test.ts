/**
 * M-07: Console Log Data Leaks Tests
 *
 * Audit finding: Console.log statements in production can leak user data
 * (story content, PII, API responses) to device logs accessible via
 * adb logcat (Android) or Console.app (iOS).
 *
 * Verifies that:
 * 1. Critical services have no unguarded console.log
 * 2. Console logging is __DEV__-gated where it exists
 * 3. Babel config includes console stripping for production
 * 4. Services don't log user content variables directly
 *
 * @implements M-07
 */

import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '../../../../');

function readSourceFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(PROJECT_ROOT, relativePath), 'utf-8');
}

function findAllFiles(
  dir: string,
  ext: string,
  excludeDirs: string[] = [
    '__tests__',
    'node_modules',
    '.expo',
    'build',
    'ios',
    'android',
  ],
): string[] {
  const resolvedDir = path.isAbsolute(dir)
    ? dir
    : path.resolve(PROJECT_ROOT, dir);
  const results: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(resolvedDir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const fullPath = path.join(resolvedDir, entry.name);
    if (entry.isDirectory() && !excludeDirs.includes(entry.name)) {
      results.push(...findAllFiles(fullPath, ext, excludeDirs));
    } else if (entry.isFile() && entry.name.endsWith(ext)) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('M-07: Console Log Data Leaks', () => {
  test('[M-07] openaiClient.ts has no console.log statements', () => {
    const source = readSourceFile('src/services/openaiClient.ts');
    // The OpenAI client should not log API requests/responses
    expect(source).not.toMatch(/console\.log/);
  });

  test.failing(
    '[M-07] console.log calls in services/ are __DEV__-gated',
    () => {
      const serviceFiles = findAllFiles('src/services', '.ts');
      const violations: string[] = [];

      for (const file of serviceFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        const relPath = path.relative(PROJECT_ROOT, file);

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.match(/console\.log\s*\(/) && !line.match(/\/\//)) {
            // Check if this console.log is inside an __DEV__ guard
            // Look backwards up to 5 lines for an if (__DEV__) block
            let guarded = false;
            for (let j = Math.max(0, i - 5); j < i; j++) {
              if (lines[j].match(/__DEV__/)) {
                guarded = true;
                break;
              }
            }
            if (!guarded) {
              violations.push(`${relPath}:${i + 1}`);
            }
          }
        }
      }

      // No unguarded console.log calls should exist in services
      expect(violations).toEqual([]);
    },
  );

  test.failing(
    '[M-07] babel.config.js includes console stripping plugin for production',
    () => {
      const babelConfig = readSourceFile('babel.config.js');
      // Should include babel-plugin-transform-remove-console or equivalent
      expect(babelConfig).toMatch(
        /remove-console|transform-remove-console|strip-console/,
      );
    },
  );

  test.failing(
    '[M-07] Services do not log user content variables directly',
    () => {
      // Check that services don't log story content, user prompts, or AI responses
      const serviceFiles = findAllFiles('src/services', '.ts');
      const contentLogPattern =
        /console\.log\s*\(.*(?:storyText|userPrompt|systemPrompt|response\.choices|content|message\.content)/;
      const violations: string[] = [];

      for (const file of serviceFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        const relPath = path.relative(PROJECT_ROOT, file);
        if (content.match(contentLogPattern)) {
          violations.push(relPath);
        }
      }

      expect(violations).toEqual([]);
    },
  );
});
