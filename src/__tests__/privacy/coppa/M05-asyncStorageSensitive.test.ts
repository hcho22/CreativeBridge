/**
 * M-05: AsyncStorage Sensitive Data Tests
 *
 * Audit finding: AsyncStorage is unencrypted local storage. Sensitive data
 * like session tokens, emails, and auth tokens should use react-native-keychain
 * or equivalent secure storage instead.
 *
 * @implements M-05
 */

import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '../../../../');

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

describe('M-05: AsyncStorage Sensitive Data', () => {
  test('[M-05] No AsyncStorage.setItem calls store sensitive key names (token, email, session)', () => {
    const allFiles = [
      ...findAllFiles('src/services', '.ts'),
      ...findAllFiles('src/context', '.tsx'),
      ...findAllFiles('src/utils', '.ts'),
    ];

    const sensitiveKeyPattern =
      /AsyncStorage\.setItem\s*\(\s*['"`](?:.*(?:token|email|session|password|secret|auth|credential).*)['"`,]/i;

    for (const file of allFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      // No file should store sensitive keys in unencrypted AsyncStorage
      expect(content).not.toMatch(sensitiveKeyPattern);
    }
  });

  test('[M-05] Session tokens use react-native-keychain or secure storage', () => {
    const allFiles = [
      ...findAllFiles('src/services', '.ts'),
      ...findAllFiles('src/context', '.tsx'),
    ];

    let usesSecureStorage = false;
    for (const file of allFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      if (
        content.match(
          /react-native-keychain|SecureStore|expo-secure-store|Keychain/,
        )
      ) {
        usesSecureStorage = true;
        break;
      }
    }

    // At least one service/context file should import secure storage for tokens
    expect(usesSecureStorage).toBe(true);
  });

  test.failing(
    '[M-05] AsyncStorage items have TTL metadata for expiration',
    () => {
      // Check if the asyncStorageWrapper or similar utility implements TTL
      const wrapperFiles = findAllFiles('src/utils', '.ts').filter(
        f => f.includes('asyncStorage') || f.includes('storage'),
      );

      let hasTTL = false;
      for (const file of wrapperFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        if (content.match(/ttl|expir|maxAge|expiresAt/i)) {
          hasTTL = true;
          break;
        }
      }

      expect(hasTTL).toBe(true);
    },
  );
});
