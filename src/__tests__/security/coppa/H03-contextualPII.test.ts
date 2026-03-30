/**
 * H-03: Contextual PII Gap Documentation Tests
 *
 * Documents the limitations of the regex-based PII scrubber. Each test.failing()
 * demonstrates a contextual PII pattern that the current regex approach cannot catch.
 * When a gap is fixed, the test.failing() will start failing — flip it to test().
 *
 * These are runtime unit tests (not static analysis) since they exercise the
 * actual scrub() function to prove the gap exists.
 *
 * @implements COPPA Audit Finding H-03
 * @see .claude/audit/coppa-audit-2026-03-25.md
 */

import { scrub } from '../../../services/piiScrubber';

describe('H-03: Contextual PII Gaps (regex limitations)', () => {
  // -------------------------------------------------------------------------
  // All tests below use test.failing() to document known gaps.
  // When a fix lands, the test will fail — convert it to a regular test().
  // -------------------------------------------------------------------------

  test.failing('[H-03] Scrubs "my teacher Mrs. Johnson"', () => {
    // Regex cannot infer that "Mrs. Johnson" after "my teacher" is a real name.
    // The NAME_INTRO_REGEX only catches "My name is X" / "I'm X" patterns.
    const result = scrub('my teacher Mrs. Johnson gave us homework');
    expect(result.text).not.toContain('Mrs. Johnson');
  });

  test.failing('[H-03] Scrubs "my dad\'s name is Robert Chen"', () => {
    // Possessive + relational context ("my dad's name is") is not captured
    // by NAME_INTRO_REGEX which only handles "my name is" / "I'm" patterns.
    const result = scrub("my dad's name is Robert Chen and he works downtown");
    expect(result.text).not.toContain('Robert Chen');
  });

  test('[H-03] Scrubs partial address "Oak Street near the park" via LOCATION_INTRO_REGEX', () => {
    // "I live on" triggers LOCATION_INTRO_REGEX, which catches the trailing location.
    // This gap is partially covered — but only when preceded by a location introduction phrase.
    const result = scrub('I live on Oak Street near the park');
    expect(result.text).not.toContain('Oak Street');
  });

  test('[H-03] Scrubs phone without separators "5551234567"', () => {
    // PHONE_REGEX matches 10 consecutive digits as a valid US phone number.
    const result = scrub('call me at 5551234567 after school');
    expect(result.text).not.toContain('5551234567');
  });

  test.failing('[H-03] Scrubs birth date "born on March 15, 2018"', () => {
    // No birth date pattern exists in the scrubber. A child's birth date is PII
    // under COPPA but the regex suite does not cover date-as-PII.
    const result = scrub('I was born on March 15, 2018');
    expect(result.text).not.toContain('March 15, 2018');
  });

  test.failing('[H-03] Scrubs "Ms. Smith\'s class at room 204"', () => {
    // Honorific + name ("Ms. Smith") in a class/school context is not caught.
    // SCHOOL_REGEX and NAME_INTRO_REGEX don't handle honorific-prefixed names.
    const result = scrub("I'm in Ms. Smith's class at room 204");
    expect(result.text).not.toContain('Ms. Smith');
  });

  test.failing(
    '[H-03] School reference "I go to Ms. Smith\'s class at Lincoln Elementary" scrubs school portion',
    () => {
      // Overlapping patterns: "I go to" triggers SCHOOL_REGEX but "Ms. Smith's class at"
      // breaks the expected capitalized-word sequence before the school suffix.
      const result = scrub("I go to Ms. Smith's class at Lincoln Elementary");
      // Expect both the teacher name and school name to be scrubbed
      expect(result.text).not.toContain('Ms. Smith');
      expect(result.text).not.toContain('Lincoln Elementary');
    },
  );
});
