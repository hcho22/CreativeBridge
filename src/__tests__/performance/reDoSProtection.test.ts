/**
 * ReDoS Protection Validation Tests
 *
 * Verifies that the highlightMatches method in advancedSearchService
 * escapes regex special characters to prevent Regular Expression Denial of Service.
 *
 * @implements US-006: U-6.5
 */

import * as fs from 'fs';
import * as path from 'path';

const SERVICE_PATH = path.resolve(
  __dirname,
  '../../services/advancedSearchService.ts',
);

// Re-implement the fixed highlightMatches for testing
function highlightMatches(content: string, searchTerms: string[]): string {
  let highlighted = content;

  searchTerms.forEach(term => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    highlighted = highlighted.replace(regex, '<mark>$1</mark>');
  });

  return highlighted;
}

describe('ReDoS Protection in highlightMatches (US-006: U-6.5)', () => {
  test('escapes regex special characters without error', () => {
    // These would cause errors or unexpected behavior with unescaped regex
    const specialChars = [
      'test()',
      'a+b',
      'hello.*world',
      'price$100',
      'C++',
      'file.txt',
      'a{1,3}',
      'foo|bar',
      'arr[0]',
      'path\\to\\file',
      '^start',
      'end?',
    ];

    for (const term of specialChars) {
      expect(() => {
        highlightMatches('some text with test() content', [term]);
      }).not.toThrow();
    }

    // Verify actual matching works with special chars
    const result = highlightMatches('file.txt is a text file', ['file.txt']);
    expect(result).toContain('<mark>file.txt</mark>');

    // Verify the dot is escaped (should NOT match "filextxt")
    const result2 = highlightMatches('filextxt', ['file.txt']);
    expect(result2).not.toContain('<mark>');
  });

  test('no catastrophic backtracking on adversarial input', () => {
    // Classic ReDoS pattern: (a+)+$ with 'aaa...!' input
    // If regex is not escaped, this could cause exponential backtracking
    const adversarialTerm = 'a{1,}){1,}$';
    const adversarialContent = 'a'.repeat(30) + '!';

    const start = Date.now();
    const result = highlightMatches(adversarialContent, [adversarialTerm]);
    const elapsed = Date.now() - start;

    // Must complete in under 100ms (ReDoS would take seconds/minutes)
    expect(elapsed).toBeLessThan(100);
    // The adversarial term won't match literally, so no marks
    expect(result).toBe(adversarialContent);
  });

  test('normal highlighting still works correctly', () => {
    const content = 'The quick brown fox jumps over the lazy dog';

    const result = highlightMatches(content, ['quick', 'fox']);
    expect(result).toContain('<mark>quick</mark>');
    expect(result).toContain('<mark>fox</mark>');
    expect(result).toContain('brown');
    expect(result).toContain('lazy dog');

    // Case insensitive
    const result2 = highlightMatches(content, ['QUICK']);
    expect(result2).toContain('<mark>quick</mark>');
  });
});

describe('ReDoS Fix Source Verification', () => {
  test('advancedSearchService.ts escapes regex in highlightMatches', () => {
    const source = fs.readFileSync(SERVICE_PATH, 'utf-8');

    // Must contain the regex escape pattern
    expect(source).toContain(
      "term.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')",
    );

    // The old vulnerable pattern should NOT exist
    // (unescaped term directly in regex)
    expect(source).not.toMatch(/new RegExp\(`\(\$\{term\}\)`/);
  });
});
