// US-008: PII Scrubber Tests
// Covers 15+ PII patterns with positive detection and false-positive avoidance

import { scrub, scrubText } from '../../services/piiScrubber';

describe('piiScrubber', () => {
  // ─── Email Detection ───────────────────────────────
  describe('email addresses', () => {
    it('redacts standard email addresses', () => {
      const result = scrub('Contact me at john.doe@gmail.com please');
      expect(result.text).toBe('Contact me at [EMAIL] please');
      expect(result.redactionsCount).toBe(1);
      expect(result.redactionTypes).toContain('email');
    });

    it('redacts emails with subdomains', () => {
      expect(scrubText('Send to user@mail.school.edu now')).toBe(
        'Send to [EMAIL] now',
      );
    });

    it('does not false-positive on @ in story text', () => {
      expect(scrubText('The knight @ the gate stood watch')).toBe(
        'The knight @ the gate stood watch',
      );
    });
  });

  // ─── Phone Number Detection ────────────────────────
  describe('phone numbers', () => {
    it('redacts (xxx) xxx-xxxx format', () => {
      expect(scrubText('Call (555) 123-4567')).toBe('Call [PHONE]');
    });

    it('redacts xxx-xxx-xxxx format', () => {
      expect(scrubText('My number is 555-123-4567')).toBe(
        'My number is [PHONE]',
      );
    });

    it('redacts xxx.xxx.xxxx format', () => {
      expect(scrubText('Reach me at 555.123.4567')).toBe('Reach me at [PHONE]');
    });

    it('redacts +1 prefix format', () => {
      expect(scrubText('Call +1-555-123-4567')).toBe('Call [PHONE]');
    });

    it('does not false-positive on short numbers', () => {
      expect(scrubText('There were 123 dragons')).toBe(
        'There were 123 dragons',
      );
    });

    it('does not false-positive on years', () => {
      expect(scrubText('In the year 2025, the kingdom fell')).toBe(
        'In the year 2025, the kingdom fell',
      );
    });
  });

  // ─── SSN Detection ─────────────────────────────────
  describe('social security numbers', () => {
    it('redacts SSN format xxx-xx-xxxx', () => {
      const result = scrub('My SSN is 123-45-6789');
      expect(result.text).toBe('My SSN is [SSN]');
      expect(result.redactionTypes).toContain('ssn');
    });

    it('does not false-positive on dates', () => {
      expect(scrubText('Date: 2025-03-24')).toBe('Date: 2025-03-24');
    });
  });

  // ─── Street Address Detection ──────────────────────
  describe('street addresses', () => {
    it('redacts standard street address', () => {
      expect(scrubText('I live at 123 Main Street')).toContain('[ADDRESS]');
    });

    it('redacts abbreviated street types', () => {
      expect(scrubText('Go to 456 Oak Ave')).toContain('[ADDRESS]');
    });

    it('redacts multi-word street names', () => {
      expect(scrubText('Visit 789 Red Oak Boulevard')).toContain('[ADDRESS]');
    });

    it('does not false-positive on story locations', () => {
      // "Dragon Valley" doesn't have a street suffix
      expect(scrubText('They explored Dragon Valley together')).toBe(
        'They explored Dragon Valley together',
      );
    });
  });

  // ─── Name Introduction Detection ───────────────────
  describe('name introductions', () => {
    it('redacts "My name is John Smith"', () => {
      const result = scrub('My name is John Smith and I like stories');
      expect(result.text).toContain('[NAME]');
      expect(result.redactionTypes).toContain('name');
    });

    it('redacts "I\'m Sarah"', () => {
      expect(scrubText("I'm Sarah and I love reading")).toContain('[NAME]');
    });

    it('redacts "I am David"', () => {
      expect(scrubText('I am David from school')).toContain('[NAME]');
    });

    it('does not false-positive on story character names', () => {
      // Character names in narrative should not trigger
      expect(scrubText('Ben the bear walked through the forest')).toBe(
        'Ben the bear walked through the forest',
      );
    });

    it('does not false-positive on "I am happy"', () => {
      // lowercase word after "I am" should not trigger
      expect(scrubText('I am happy today')).toBe('I am happy today');
    });
  });

  // ─── School Detection ──────────────────────────────
  describe('school references', () => {
    it('redacts "I go to Lincoln Elementary"', () => {
      const result = scrub('I go to Lincoln Elementary');
      expect(result.text).toContain('[SCHOOL]');
      expect(result.redactionTypes).toContain('school');
    });

    it('redacts "my school is Westside Middle School"', () => {
      expect(scrubText('my school is Westside Middle School')).toContain(
        '[SCHOOL]',
      );
    });

    it('redacts "I attend Harvard Academy"', () => {
      expect(scrubText('I attend Harvard Academy')).toContain('[SCHOOL]');
    });
  });

  // ─── Location Detection ────────────────────────────
  describe('location introductions', () => {
    it('redacts "I live in Chicago"', () => {
      const result = scrub('I live in Chicago.');
      expect(result.text).toContain('[LOCATION]');
      expect(result.redactionTypes).toContain('location');
    });

    it('redacts "I\'m from San Francisco"', () => {
      expect(scrubText("I'm from San Francisco.")).toContain('[LOCATION]');
    });
  });

  // ─── ZIP Code Detection ────────────────────────────
  describe('zip codes with state', () => {
    it('redacts state + zip code', () => {
      expect(scrubText('Located in CA 90210')).toContain('[ZIP]');
    });

    it('redacts state + zip+4', () => {
      expect(scrubText('Ship to NY 10001-1234')).toContain('[ZIP]');
    });
  });

  // ─── Multiple PII Types in One Text ────────────────
  describe('multiple PII types', () => {
    it('redacts multiple PII types in a single string', () => {
      const input =
        'My name is Jane Doe and my email is jane@example.com. Call me at 555-123-4567.';
      const result = scrub(input);
      expect(result.text).toContain('[NAME]');
      expect(result.text).toContain('[EMAIL]');
      expect(result.text).toContain('[PHONE]');
      expect(result.redactionsCount).toBeGreaterThanOrEqual(3);
    });
  });

  // ─── Edge Cases ────────────────────────────────────
  describe('edge cases', () => {
    it('handles empty string', () => {
      const result = scrub('');
      expect(result.text).toBe('');
      expect(result.redactionsCount).toBe(0);
    });

    it('handles null/undefined gracefully', () => {
      expect(scrub(null as any).text).toBe('');
      expect(scrub(undefined as any).text).toBe('');
    });

    it('leaves clean story text untouched', () => {
      const story =
        'Once upon a time, a brave knight named Sir Lancelot rode through the enchanted forest.';
      expect(scrubText(story)).toBe(story);
    });

    it('preserves story with character names that are not PII introductions', () => {
      const story =
        'Princess Luna gazed at the stars. Captain Rex drew his sword.';
      expect(scrubText(story)).toBe(story);
    });
  });

  // ─── Performance ───────────────────────────────────
  describe('performance', () => {
    it('scrubs within 50ms for a large text block', () => {
      // Generate a ~10KB text block with embedded PII
      const paragraph =
        'The brave knight fought the dragon. My name is John Smith. Email: test@example.com. ';
      const largeText = paragraph.repeat(100);

      const start = performance.now();
      scrub(largeText);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(50);
    });
  });

  // ─── scrubText convenience function ────────────────
  describe('scrubText', () => {
    it('returns only the scrubbed text string', () => {
      const result = scrubText('Email me at test@example.com');
      expect(typeof result).toBe('string');
      expect(result).toBe('Email me at [EMAIL]');
    });
  });
});
