/**
 * Font Size Validation Test (US-010)
 *
 * Grep-based regression test that validates all fontSize values across the
 * codebase were correctly increased by +2 dp/pt per PRD: prd-font-size-increase.md.
 *
 * This test reads source files directly (no React Native imports) and uses
 * regex matching to verify:
 * 1. Theme fontSize scale matches expected post-increase values
 * 2. Theme textStyles have correct fontSize values
 * 3. Download theme service has correct fontSize scale
 * 4. No source file contains uniquely-old fontSize values
 */
import * as fs from 'fs';
import * as path from 'path';

// ── Path constants ───────────────────────────────────────────────────
const ROOT_DIR = path.resolve(__dirname, '../../../');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const THEME_FILE = path.join(SRC_DIR, 'constants/theme.ts');
const DOWNLOAD_THEME_FILE = path.join(
  SRC_DIR,
  'services/downloadThemeService.ts',
);

// ── Expected values (post +2 increase) ──────────────────────────────
const EXPECTED_THEME_SCALE: Record<string, number> = {
  xs: 12,
  sm: 14,
  base: 16,
  md: 18,
  lg: 20,
  xl: 22,
  xxl: 26,
  xxxl: 34,
};

const EXPECTED_TEXT_STYLE_SIZES: Record<string, number> = {
  h1: 34,
  h2: 26,
  h3: 22,
  h4: 20,
  body: 18,
  bodySmall: 16,
  caption: 14,
  button: 18,
};

const EXPECTED_DOWNLOAD_THEME_SCALE: Record<string, number> = {
  xs: 14,
  sm: 16,
  md: 18,
  lg: 20,
  xl: 26,
};

// ── Old values (pre-increase) ───────────────────────────────────────
const OLD_THEME_SCALE: Record<string, number> = {
  xs: 10,
  sm: 12,
  base: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// Directories/files to exclude from source scanning
const SCAN_EXCLUDE = [
  '__tests__',
  '__mocks__',
  'node_modules',
  'ClaudeSkillsDemo',
  'DependencyVerification',
  'TestErrorComponent',
];

// Files with metadata/property-name fontSize refs (not actual style values)
const SKIP_FILES = ['interfaceAdapter.ts', 'readingComprehensionOptimizer.ts'];

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Extract the first fontSize: { ... } block from source content.
 */
function extractFontSizeBlock(content: string): string {
  const match = content.match(/fontSize:\s*\{([^}]+)\}/);
  return match ? match[1] : '';
}

/**
 * Recursively collect all .ts/.tsx files under a directory,
 * excluding test directories and skip-listed files.
 */
function getSourceFiles(dir: string): string[] {
  const files: string[] = [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    if (SCAN_EXCLUDE.some(pattern => entry.name.includes(pattern))) continue;
    if (SKIP_FILES.includes(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...getSourceFiles(fullPath));
    } else if (/\.(tsx?)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

interface FontSizeOccurrence {
  file: string;
  line: number;
  value: number;
  content: string;
}

/**
 * Scan files for all `fontSize: <number>` occurrences.
 * Skips dynamic values like `fontSize: size` or `fontSize: theme.xxx`.
 */
function findFontSizeOccurrences(files: string[]): FontSizeOccurrence[] {
  const results: FontSizeOccurrence[] = [];

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const regex = /fontSize:\s*(\d+)/g;
      let match;
      while ((match = regex.exec(line)) !== null) {
        results.push({
          file: path.relative(ROOT_DIR, filePath),
          line: i + 1,
          value: Number(match[1]),
          content: line.trim(),
        });
      }
    }
  }

  return results;
}

// ── Tests ────────────────────────────────────────────────────────────

describe('Font Size Validation', () => {
  describe('Theme fontSize scale (src/constants/theme.ts)', () => {
    let themeContent: string;
    let fontSizeBlock: string;

    beforeAll(() => {
      themeContent = fs.readFileSync(THEME_FILE, 'utf-8');
      fontSizeBlock = extractFontSizeBlock(themeContent);
    });

    test('fontSize block is present in theme file', () => {
      expect(fontSizeBlock.length).toBeGreaterThan(0);
    });

    test('fontSize scale matches expected values (12, 14, 16, 18, 20, 22, 26, 34)', () => {
      for (const [key, expected] of Object.entries(EXPECTED_THEME_SCALE)) {
        const regex = new RegExp(`${key}:\\s*${expected}\\b`);
        expect(fontSizeBlock).toMatch(regex);
      }
    });

    test('fontSize scale does not contain OLD key-value pairs', () => {
      for (const [key, oldValue] of Object.entries(OLD_THEME_SCALE)) {
        const regex = new RegExp(`${key}:\\s*${oldValue}\\b`);
        expect(fontSizeBlock).not.toMatch(regex);
      }
    });

    test('textStyles have correct post-increase fontSize values', () => {
      for (const [style, expectedSize] of Object.entries(
        EXPECTED_TEXT_STYLE_SIZES,
      )) {
        // Match the style block (e.g., "h1: { ... fontSize: 34") and extract the fontSize
        const styleRegex = new RegExp(
          `${style}:\\s*\\{[^}]*fontSize:\\s*(\\d+)`,
        );
        const match = themeContent.match(styleRegex);
        expect(match).not.toBeNull();
        expect(Number(match![1])).toBe(expectedSize);
      }
    });
  });

  describe('Download theme fontSize scale (src/services/downloadThemeService.ts)', () => {
    test('getCommonThemeProperties fontSize scale matches expected values', () => {
      const content = fs.readFileSync(DOWNLOAD_THEME_FILE, 'utf-8');

      // Find the fontSize block within getCommonThemeProperties (the runtime block, not the type definition)
      // The runtime block is the second fontSize occurrence — search after "getCommonThemeProperties"
      const fnStart = content.indexOf('getCommonThemeProperties');
      expect(fnStart).toBeGreaterThan(-1);

      const fnContent = content.slice(fnStart);
      const fontSizeBlock = extractFontSizeBlock(fnContent);
      expect(fontSizeBlock.length).toBeGreaterThan(0);

      for (const [key, expected] of Object.entries(
        EXPECTED_DOWNLOAD_THEME_SCALE,
      )) {
        const regex = new RegExp(`${key}:\\s*${expected}\\b`);
        expect(fontSizeBlock).toMatch(regex);
      }
    });
  });

  describe('Source file fontSize regression check', () => {
    let allOccurrences: FontSizeOccurrence[];

    beforeAll(() => {
      const sourceFiles = getSourceFiles(SRC_DIR);
      allOccurrences = findFontSizeOccurrences(sourceFiles);
    });

    test('no source file contains fontSize: 10 (eliminated old xs value)', () => {
      const violations = allOccurrences.filter(o => o.value === 10);
      if (violations.length > 0) {
        const details = violations
          .map(v => `  ${v.file}:${v.line} → ${v.content}`)
          .join('\n');
        expect(violations).toEqual(
          expect.objectContaining({
            length: 0,
            _detail: `Found fontSize: 10 in source files:\n${details}`,
          }),
        );
      }
      expect(violations).toHaveLength(0);
    });

    test('all fontSize values are positive integers', () => {
      const invalid = allOccurrences.filter(
        o => o.value <= 0 || !Number.isInteger(o.value),
      );
      expect(invalid).toHaveLength(0);
    });

    test('scanned a meaningful number of fontSize occurrences', () => {
      // The codebase has ~460+ fontSize occurrences across 41+ files.
      // This guard ensures the scan is actually working and hasn't been
      // accidentally bypassed by over-aggressive exclusion patterns.
      expect(allOccurrences.length).toBeGreaterThan(300);
    });
  });
});
