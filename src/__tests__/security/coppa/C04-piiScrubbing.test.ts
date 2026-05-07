/**
 * C-04: PII Scrubbing Completeness Tests
 *
 * Verifies that both client-side (piiScrubber.ts) and server-side (convex/ai.ts)
 * PII scrubbers cover all required patterns for COPPA compliance. The server-side
 * scrubber must achieve pattern parity with the client to ensure defense-in-depth.
 *
 * Audit finding: Two OpenAI paths skip PII scrubbing (C-04)
 * Remediation: Server-side scrubber updated with 6 additional patterns.
 *
 * @implements C-04
 */

import { readSourceFile } from './helpers';
import { scrub } from '../../../services/piiScrubber';

// ---------------------------------------------------------------------------
// Client-side unit tests (1-12): Verify piiScrubber.ts handles each PII type
// ---------------------------------------------------------------------------

describe('C-04: PII Scrubbing Completeness', () => {
  describe('Client-side piiScrubber', () => {
    test('[C-04] 1. Scrubs email addresses', () => {
      const result = scrub('Contact me at tommy@school.edu please');
      expect(result.text).toContain('[EMAIL]');
      expect(result.text).not.toContain('tommy@school.edu');
      expect(result.redactionTypes).toContain('email');
    });

    test('[C-04] 2. Scrubs phone numbers', () => {
      const result = scrub('Call me at (555) 123-4567');
      expect(result.text).toContain('[PHONE]');
      expect(result.text).not.toContain('(555) 123-4567');
      expect(result.redactionTypes).toContain('phone');
    });

    test('[C-04] 3. Scrubs SSN patterns', () => {
      const result = scrub('My number is 123-45-6789');
      expect(result.text).toContain('[SSN]');
      expect(result.text).not.toContain('123-45-6789');
      expect(result.redactionTypes).toContain('ssn');
    });

    test('[C-04] 4. Scrubs street addresses', () => {
      const result = scrub('I live at 123 Main Street');
      expect(result.text).toContain('[ADDRESS]');
      expect(result.text).not.toContain('123 Main Street');
      expect(result.redactionTypes).toContain('address');
    });

    test('[C-04] 5. Scrubs ZIP codes with state prefix', () => {
      const result = scrub('I live in CA 90210');
      expect(result.text).toContain('[ZIP]');
      expect(result.text).not.toContain('90210');
      expect(result.redactionTypes).toContain('zip');
    });

    test('[C-04] 6. Scrubs name introductions', () => {
      const result = scrub('My name is Tommy Smith');
      expect(result.text).toContain('[NAME]');
      expect(result.text).not.toContain('Tommy Smith');
      expect(result.redactionTypes).toContain('name');
    });

    test('[C-04] 7. Does NOT scrub "I\'m from Chicago" as a name', () => {
      const result = scrub("I'm from Chicago.");
      // "I'm from" should trigger location, not name
      expect(result.text).not.toContain('[NAME]');
    });

    test('[C-04] 8. Scrubs narrative name patterns', () => {
      const result = scrub('She was named Emma Chen in the story.');
      expect(result.text).toContain('[NAME]');
      expect(result.text).not.toContain('Emma Chen');
    });

    test('[C-04] 9. Scrubs age disclosures', () => {
      const result = scrub("I'm 7 years old");
      expect(result.text).toContain('[AGE]');
      expect(result.text).not.toMatch(/\b7\s*years?\s*old\b/);
      expect(result.redactionTypes).toContain('age');
    });

    test('[C-04] 10. Scrubs school references', () => {
      const result = scrub('I go to Lincoln Elementary School.');
      expect(result.text).toContain('[SCHOOL]');
      expect(result.text).not.toContain('Lincoln Elementary');
      expect(result.redactionTypes).toContain('school');
    });

    test('[C-04] 11. Scrubs location introductions', () => {
      const result = scrub('I live in Chicago.');
      expect(result.text).toContain('[LOCATION]');
      expect(result.text).not.toMatch(/I live in Chicago/);
      expect(result.redactionTypes).toContain('location');
    });

    test('[C-04] 12. False positive: "123 is a number" does NOT trigger SSN scrub', () => {
      const result = scrub('123 is a number');
      expect(result.text).not.toContain('[SSN]');
      expect(result.text).toBe('123 is a number');
    });
  });

  // ---------------------------------------------------------------------------
  // Server-side parity tests (13-18): Static analysis of convex/ai.ts
  // ---------------------------------------------------------------------------

  describe('Server-side scrubPII parity (convex/ai.ts)', () => {
    let aiSource: string;

    beforeAll(() => {
      aiSource = readSourceFile('convex/ai.ts');
    });

    test('[C-04] 13. convex/ai.ts scrubPII includes age disclosure pattern', () => {
      // Must contain a regex targeting age patterns with [AGE] replacement
      expect(aiSource).toMatch(/\[AGE\]/);
      expect(aiSource).toMatch(/years?\s*\\s\*old|year-old|\\bage/);
    });

    test('[C-04] 14. convex/ai.ts scrubPII includes name pattern', () => {
      // Must contain name intro pattern with [NAME] replacement
      expect(aiSource).toMatch(/\[NAME\]/);
      expect(aiSource).toMatch(/[Mm]y name is|name\s+is/);
    });

    test('[C-04] 15. convex/ai.ts scrubPII includes school pattern', () => {
      expect(aiSource).toMatch(/\[SCHOOL\]/);
      expect(aiSource).toMatch(/School|Elementary|Academy/);
    });

    test('[C-04] 16. convex/ai.ts scrubPII includes location pattern', () => {
      expect(aiSource).toMatch(/\[LOCATION\]/);
      expect(aiSource).toMatch(/live\s+(?:\(?\?:?in|at|on\)?|in)/);
    });

    test('[C-04] 17. convex/ai.ts scrubPII includes ZIP pattern', () => {
      expect(aiSource).toMatch(/\[ZIP\]/);
      expect(aiSource).toMatch(/\\d\{5\}/);
    });

    test('[C-04] 18. Server PII pattern count >= client PII pattern count', () => {
      // Count patterns in PII_PATTERNS array by counting `replacement:` entries in the block
      const piiBlock = extractPIIPatternsBlock(aiSource);
      const serverPatternCount = (piiBlock.match(/replacement:\s*"/g) || [])
        .length;

      const clientSource = readSourceFile('src/services/piiScrubber.ts');
      // Client defines patterns as objects in PII_PATTERNS array
      const clientPiiBlock = clientSource.match(
        /const PII_PATTERNS[\s\S]*?\];/,
      );
      const clientPatternCount = clientPiiBlock
        ? (clientPiiBlock[0].match(/replacement:/g) || []).length
        : 0;

      expect(serverPatternCount).toBeGreaterThanOrEqual(clientPatternCount);
    });
  });
});

/**
 * Extract the PII_PATTERNS array block from convex/ai.ts source.
 * This is more targeted than extractFunctionBlock since PII_PATTERNS
 * is a const array, not an exported function.
 */
function extractPIIPatternsBlock(source: string): string {
  const match = source.match(/const PII_PATTERNS[\s\S]*?\];/);
  return match ? match[0] : '';
}
