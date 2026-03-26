/**
 * COPPA Audit Test Suite — Shared Static Analysis Utilities
 *
 * Provides helper functions for reading source files, extracting function blocks,
 * and scanning codebases for patterns. Used by all COPPA compliance test files.
 *
 * Pattern derived from consentSecurity.test.ts and credentialExposure.test.ts.
 */

import * as fs from 'fs';
import * as path from 'path';

/** Project root directory (where package.json lives) */
const PROJECT_ROOT = path.resolve(__dirname, '../../../../');

/**
 * Read a source file relative to the project root.
 * Throws if the file does not exist.
 */
export function readSourceFile(relativePath: string): string {
  const fullPath = path.resolve(PROJECT_ROOT, relativePath);
  return fs.readFileSync(fullPath, 'utf-8');
}

/**
 * Extract a function/export block from source code.
 *
 * Supports two patterns:
 *   1. Convex-style: `export const fnName = query|mutation|action({...});`
 *   2. General: `export function fnName(` or `export const fnName =` through
 *      the next top-level closing brace.
 *
 * Returns empty string if no match is found.
 */
export function extractFunctionBlock(source: string, fnName: string): string {
  // Pattern 1: Convex query/mutation/action exports (multiline, ends with `});` at start of line)
  const convexPattern = new RegExp(
    `export const ${fnName} = (?:query|mutation|action|internalQuery|internalMutation|internalAction)\\(\\{[\\s\\S]*?^\\}\\);`,
    'm',
  );
  const convexMatch = source.match(convexPattern);
  if (convexMatch) return convexMatch[0];

  // Pattern 2: `export function fnName(` ... balanced braces
  const fnDeclPattern = new RegExp(
    `export (?:async )?function ${fnName}\\s*\\([\\s\\S]*?^\\}`,
    'm',
  );
  const fnDeclMatch = source.match(fnDeclPattern);
  if (fnDeclMatch) return fnDeclMatch[0];

  // Pattern 3: `export const fnName = ` ... arrow/function expression
  const constPattern = new RegExp(
    `export const ${fnName}\\s*=[\\s\\S]*?^\\};?`,
    'm',
  );
  const constMatch = source.match(constPattern);
  if (constMatch) return constMatch[0];

  // Pattern 4: Non-exported `function fnName(` ... closing brace at start of line
  const plainFnPattern = new RegExp(
    `(?:async )?function ${fnName}\\s*\\([\\s\\S]*?^\\}`,
    'm',
  );
  const plainFnMatch = source.match(plainFnPattern);
  if (plainFnMatch) return plainFnMatch[0];

  return '';
}

/** Default directories to exclude from recursive file searches */
const DEFAULT_EXCLUDE_DIRS = [
  '__tests__',
  'node_modules',
  '.expo',
  'build',
  'ios',
  'android',
];

/**
 * Recursively find all files with the given extension under `dir`.
 *
 * @param dir - Absolute or project-root-relative directory path
 * @param ext - File extension including dot (e.g. '.ts')
 * @param excludeDirs - Directory names to skip (defaults to test/build dirs)
 */
export function findAllFiles(
  dir: string,
  ext: string,
  excludeDirs: string[] = DEFAULT_EXCLUDE_DIRS,
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

/**
 * Scan an array of file paths for a regex pattern.
 * Returns only files that contain at least one match.
 */
export function scanFilesForPattern(
  files: string[],
  pattern: RegExp,
): { file: string; matches: string[] }[] {
  const results: { file: string; matches: string[] }[] = [];

  for (const file of files) {
    let content: string;
    try {
      content = fs.readFileSync(file, 'utf-8');
    } catch {
      continue;
    }

    const matches = content.match(pattern);
    if (matches) {
      results.push({ file, matches: Array.from(matches) });
    }
  }

  return results;
}
