/**
 * COPPA Test Infrastructure Validation
 *
 * Validates that all shared helpers and custom matchers work correctly.
 * This file serves as the smoke test for Task 1.1.
 */

import {
  readSourceFile,
  findAllFiles,
  extractFunctionBlock,
  scanFilesForPattern,
} from './helpers';

describe('COPPA Test Infrastructure', () => {
  describe('readSourceFile', () => {
    test('reads App.tsx from project root', () => {
      const content = readSourceFile('App.tsx');
      expect(content).toBeTruthy();
      expect(content.length).toBeGreaterThan(0);
    });

    test('throws on non-existent file', () => {
      expect(() => readSourceFile('nonexistent-file.xyz')).toThrow();
    });
  });

  describe('findAllFiles', () => {
    test('finds .ts files in src/services', () => {
      const files = findAllFiles('src/services', '.ts');
      expect(files.length).toBeGreaterThan(0);
      expect(files.every(f => f.endsWith('.ts'))).toBe(true);
    });

    test('excludes __tests__ by default', () => {
      const files = findAllFiles('src', '.ts');
      expect(files.some(f => f.includes('__tests__'))).toBe(false);
    });

    test('excludes node_modules by default', () => {
      const files = findAllFiles('.', '.ts');
      expect(files.some(f => f.includes('node_modules'))).toBe(false);
    });

    test('custom excludeDirs overrides defaults', () => {
      const files = findAllFiles('src', '.ts', ['services']);
      expect(files.some(f => f.includes('/services/'))).toBe(false);
    });
  });

  describe('extractFunctionBlock', () => {
    test('extracts Convex query/mutation functions', () => {
      const source = readSourceFile('convex/consent.ts');
      const block = extractFunctionBlock(source, 'getConsentStatus');
      expect(block).toContain('getConsentStatus');
      expect(block.length).toBeGreaterThan(50);
    });

    test('returns empty string for non-existent function', () => {
      const block = extractFunctionBlock('const x = 1;', 'nonExistentFn');
      expect(block).toBe('');
    });
  });

  describe('scanFilesForPattern', () => {
    test('finds files matching a pattern', () => {
      const files = findAllFiles('src/services', '.ts');
      const results = scanFilesForPattern(files, /import/);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('file');
      expect(results[0]).toHaveProperty('matches');
    });

    test('returns empty array when no matches', () => {
      const results = scanFilesForPattern(
        ['src/__tests__/security/coppa/helpers.ts'],
        /XYZZY_IMPOSSIBLE_PATTERN_12345/,
      );
      expect(results).toEqual([]);
    });
  });

  describe('Custom Jest Matchers', () => {
    describe('toContainPlaceholder', () => {
      test('passes on string with [INSERT ...]', () => {
        expect('Hello [INSERT NAME]').toContainPlaceholder();
      });

      test('passes on string with [TODO ...]', () => {
        expect('See [TODO: fill in]').toContainPlaceholder();
      });

      test('passes on string with [TBD ...]', () => {
        expect('Date: [TBD]').toContainPlaceholder();
      });

      test('fails on normal string', () => {
        expect('Hello World').not.toContainPlaceholder();
      });
    });

    describe('toUseCryptoRandom', () => {
      test('passes on crypto.randomBytes usage', () => {
        expect('const token = crypto.randomBytes(32)').toUseCryptoRandom();
      });

      test('passes on crypto.getRandomValues usage', () => {
        expect('crypto.getRandomValues(array)').toUseCryptoRandom();
      });

      test('passes on randomUUID usage', () => {
        expect('const id = randomUUID()').toUseCryptoRandom();
      });

      test('fails on Math.random() usage', () => {
        expect('const x = Math.random()').not.toUseCryptoRandom();
      });
    });
  });
});
