// US-014: Content Safety Blocklist & Moderation Tests
// Covers all blocklist categories with representative terms,
// false-positive avoidance, and performance benchmarks.

import {
  BLOCKLIST_CATEGORIES,
  getAllBlocklistTerms,
  getBlocklistRegexMap,
  getBlocklistTermCount,
  getCategoriesForTerm,
  CONTENT_BLOCKED_USER_MESSAGE,
  CONTENT_BLOCKED_OUTPUT_MESSAGE,
} from '../../config/contentBlocklist';
import {
  checkInputSafety,
  checkOutputSafety,
} from '../../services/contentSafetyService';

// Mock fetch for OpenAI Moderation API tests
global.fetch = jest.fn();

// Mock environment config
jest.mock('../../config/environment', () => ({
  Environment: {
    openai: {
      apiKey: 'sk-test-key',
      baseUrl: 'https://api.openai.com/v1',
    },
  },
  isOpenAIConfigured: () => true,
  getOpenAIHeaders: () => ({
    'Content-Type': 'application/json',
    Authorization: 'Bearer sk-test-key',
  }),
}));

describe('Content Blocklist Config', () => {
  // ─── Blocklist Size ──────────────────────────────────
  describe('blocklist size', () => {
    it('contains 200+ terms across all categories', () => {
      const count = getBlocklistTermCount();
      expect(count).toBeGreaterThanOrEqual(200);
    });

    it('has at least 8 categories', () => {
      expect(BLOCKLIST_CATEGORIES.length).toBeGreaterThanOrEqual(8);
    });

    it('every category has at least 10 terms', () => {
      for (const cat of BLOCKLIST_CATEGORIES) {
        expect(cat.terms.length).toBeGreaterThanOrEqual(10);
      }
    });
  });

  // ─── Violence Category ───────────────────────────────
  describe('violence category', () => {
    it('flags "murder" in text', () => {
      const result = checkOutputSafety(
        'The detective investigated a murder case',
      );
      expect(result.safe).toBe(false);
      expect(result.matchedCategories).toContain('violence');
    });

    it('flags "stab" as whole word', () => {
      const result = checkOutputSafety('He tried to stab the creature');
      expect(result.safe).toBe(false);
      expect(result.matchedTerms).toContain('stab');
    });

    it('flags "massacre"', () => {
      const result = checkOutputSafety('A terrible massacre occurred');
      expect(result.safe).toBe(false);
    });

    it('flags "torture"', () => {
      const result = checkOutputSafety(
        'The villain used torture on the prisoner',
      );
      expect(result.safe).toBe(false);
    });
  });

  // ─── Weapons Category ────────────────────────────────
  describe('weapons category', () => {
    it('flags "gun"', () => {
      const result = checkOutputSafety('He pulled out a gun');
      expect(result.safe).toBe(false);
      expect(result.matchedCategories).toContain('weapons');
    });

    it('flags "assault rifle"', () => {
      const result = checkOutputSafety('An assault rifle was found');
      expect(result.safe).toBe(false);
    });

    it('flags "grenade"', () => {
      const result = checkOutputSafety('She threw a grenade');
      expect(result.safe).toBe(false);
    });
  });

  // ─── Sexual Content Category ─────────────────────────
  describe('sexual content category', () => {
    it('flags "pornography"', () => {
      const result = checkOutputSafety('They found pornography online');
      expect(result.safe).toBe(false);
      expect(result.matchedCategories).toContain('sexual_content');
    });

    it('flags "sexual assault"', () => {
      const result = checkOutputSafety('Reports of sexual assault increased');
      expect(result.safe).toBe(false);
    });

    it('flags "nude"', () => {
      const result = checkOutputSafety('A nude photo appeared');
      expect(result.safe).toBe(false);
    });
  });

  // ─── Self-Harm Category ──────────────────────────────
  describe('self-harm category', () => {
    it('flags "suicide"', () => {
      const result = checkOutputSafety('She contemplated suicide');
      expect(result.safe).toBe(false);
      expect(result.matchedCategories).toContain('self_harm');
    });

    it('flags "self-harm"', () => {
      const result = checkOutputSafety('Signs of self-harm were visible');
      expect(result.safe).toBe(false);
    });

    it('flags "kill myself"', () => {
      const result = checkOutputSafety('I want to kill myself');
      expect(result.safe).toBe(false);
    });

    it('flags "overdose"', () => {
      const result = checkOutputSafety('He died of an overdose');
      expect(result.safe).toBe(false);
    });
  });

  // ─── Substance Abuse Category ────────────────────────
  describe('substance abuse category', () => {
    it('flags "cocaine"', () => {
      const result = checkOutputSafety('They were trafficking cocaine');
      expect(result.safe).toBe(false);
      expect(result.matchedCategories).toContain('substance_abuse');
    });

    it('flags "methamphetamine"', () => {
      const result = checkOutputSafety('A methamphetamine lab was discovered');
      expect(result.safe).toBe(false);
    });

    it('flags "drug dealer"', () => {
      const result = checkOutputSafety('The drug dealer fled');
      expect(result.safe).toBe(false);
    });

    it('flags "vaping"', () => {
      const result = checkOutputSafety('Teens caught vaping in school');
      expect(result.safe).toBe(false);
    });
  });

  // ─── Profanity Category ──────────────────────────────
  describe('profanity category', () => {
    it('flags common profanity', () => {
      const result = checkOutputSafety('What the fuck is happening');
      expect(result.safe).toBe(false);
      expect(result.matchedCategories).toContain('profanity');
    });

    it('flags "shit"', () => {
      const result = checkOutputSafety('This is total shit');
      expect(result.safe).toBe(false);
    });

    it('flags "bitch"', () => {
      const result = checkOutputSafety('She called her a bitch');
      expect(result.safe).toBe(false);
    });
  });

  // ─── Hate Speech Category ────────────────────────────
  describe('hate speech category', () => {
    it('flags racial slurs', () => {
      const result = checkOutputSafety('He used the n-word: nigger');
      expect(result.safe).toBe(false);
      expect(result.matchedCategories).toContain('hate_speech');
    });

    it('flags "white supremacy"', () => {
      const result = checkOutputSafety('White supremacy groups marched');
      expect(result.safe).toBe(false);
    });

    it('flags "nazi"', () => {
      const result = checkOutputSafety('A neo-nazi rally was held');
      expect(result.safe).toBe(false);
    });

    it('flags homophobic slurs', () => {
      const result = checkOutputSafety('He called him a faggot');
      expect(result.safe).toBe(false);
    });
  });

  // ─── Age Inappropriate Category ──────────────────────
  describe('age inappropriate category', () => {
    it('flags "gambling"', () => {
      const result = checkOutputSafety('They went gambling at the casino');
      expect(result.safe).toBe(false);
      expect(result.matchedCategories).toContain('age_inappropriate');
    });

    it('flags "serial killer"', () => {
      const result = checkOutputSafety('A serial killer was on the loose');
      expect(result.safe).toBe(false);
    });

    it('flags "kidnapping"', () => {
      const result = checkOutputSafety('The kidnapping made headlines');
      expect(result.safe).toBe(false);
    });

    it('flags "school shooting"', () => {
      const result = checkOutputSafety('A school shooting was reported');
      expect(result.safe).toBe(false);
    });
  });

  // ─── False Positive Avoidance ────────────────────────
  describe('false positive avoidance', () => {
    it('does not flag "warm" for "war"', () => {
      const result = checkOutputSafety('The warm sunshine felt wonderful');
      expect(result.safe).toBe(true);
    });

    it('does not flag "assassination" substring in safe word', () => {
      // "assassination" IS in the blocklist, but "class" is not
      const result = checkOutputSafety('The class went on a field trip');
      expect(result.safe).toBe(true);
    });

    it('does not flag "therapist" for "rapist"', () => {
      const result = checkOutputSafety('The therapist helped the child');
      expect(result.safe).toBe(true);
    });

    it('does not flag "grape" for "rape"', () => {
      const result = checkOutputSafety('She ate a grape from the vine');
      expect(result.safe).toBe(true);
    });

    it('does not flag "gunky" for "gun"', () => {
      const result = checkOutputSafety('The swamp water was gunky');
      expect(result.safe).toBe(true);
    });

    it('does not flag "passionate" for "ass"', () => {
      const result = checkOutputSafety('She was passionate about art');
      expect(result.safe).toBe(true);
    });

    it('does not flag "classic" for any blocked term', () => {
      const result = checkOutputSafety('It was a classic adventure story');
      expect(result.safe).toBe(true);
    });

    it('does not flag "button" for "butt"', () => {
      const result = checkOutputSafety('Press the button to start');
      expect(result.safe).toBe(true);
    });

    it('allows normal children story content', () => {
      const story =
        'Luna the brave kitten explored the magical forest. She found a sparkling stream and made friends with a wise old owl. Together they discovered a hidden treasure chest full of golden acorns.';
      const result = checkOutputSafety(story);
      expect(result.safe).toBe(true);
    });

    it('allows adventure themes without violence', () => {
      const story =
        'The pirate ship sailed across the ocean. Captain Starlight navigated through the storm and found the mysterious island where the ancient map led them.';
      const result = checkOutputSafety(story);
      expect(result.safe).toBe(true);
    });
  });

  // ─── Case Insensitivity ──────────────────────────────
  describe('case insensitivity', () => {
    it('flags terms regardless of case', () => {
      expect(checkOutputSafety('MURDER in the castle').safe).toBe(false);
      expect(checkOutputSafety('Murder Mystery').safe).toBe(false);
      expect(checkOutputSafety('mUrDeR scene').safe).toBe(false);
    });
  });

  // ─── Multiple Matches ────────────────────────────────
  describe('multiple matches', () => {
    it('reports all matched terms', () => {
      const result = checkOutputSafety('He had a gun and cocaine');
      expect(result.safe).toBe(false);
      expect(result.matchedTerms).toContain('gun');
      expect(result.matchedTerms).toContain('cocaine');
      expect(result.matchedCategories).toContain('weapons');
      expect(result.matchedCategories).toContain('substance_abuse');
    });
  });

  // ─── Friendly Messages ───────────────────────────────
  describe('friendly blocked messages', () => {
    it('returns user-facing message for blocked input', () => {
      expect(CONTENT_BLOCKED_USER_MESSAGE).toBe(
        "Let's try a different direction for our story!",
      );
    });

    it('returns user-facing message for blocked output', () => {
      expect(CONTENT_BLOCKED_OUTPUT_MESSAGE).toBe(
        "Hmm, that part of the story didn't work out. Let's take the story in a new direction!",
      );
    });

    it('includes userMessage when content is blocked', () => {
      const result = checkOutputSafety('A murder happened');
      expect(result.userMessage).toBe(CONTENT_BLOCKED_OUTPUT_MESSAGE);
    });

    it('does not include userMessage when content is safe', () => {
      const result = checkOutputSafety('The cat sat on the mat');
      expect(result.userMessage).toBeUndefined();
    });
  });

  // ─── Category Lookup ─────────────────────────────────
  describe('category lookup', () => {
    it('getCategoriesForTerm returns correct categories', () => {
      expect(getCategoriesForTerm('murder')).toContain('violence');
      expect(getCategoriesForTerm('cocaine')).toContain('substance_abuse');
      expect(getCategoriesForTerm('nazi')).toContain('hate_speech');
    });

    it('returns empty for non-blocklisted terms', () => {
      expect(getCategoriesForTerm('sunshine')).toEqual([]);
    });
  });

  // ─── Regex Map Caching ───────────────────────────────
  describe('regex map performance', () => {
    it('getBlocklistRegexMap returns consistent results', () => {
      const map1 = getBlocklistRegexMap();
      const map2 = getBlocklistRegexMap();
      expect(map1).toBe(map2); // Same reference (cached)
    });

    it('getAllBlocklistTerms returns consistent results', () => {
      const terms1 = getAllBlocklistTerms();
      const terms2 = getAllBlocklistTerms();
      expect(terms1).toBe(terms2); // Same reference (cached)
    });
  });

  // ─── Performance ─────────────────────────────────────
  describe('performance', () => {
    it('blocklist check completes in under 50ms for 10KB text', () => {
      const longText =
        'The magical fairy flew through the enchanted garden. '.repeat(200);
      const start = Date.now();
      checkOutputSafety(longText);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(50);
    });

    it('blocklist check completes in under 100ms for text with matches', () => {
      const text =
        'A story about murder and cocaine and guns and nazi propaganda';
      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        checkOutputSafety(text);
      }
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(100); // 100 iterations in under 100ms
    });
  });
});

describe('Content Safety Service', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockReset();
  });

  // ─── Input Safety (blocklist + moderation API) ───────
  describe('checkInputSafety', () => {
    it('blocks unsafe user input', async () => {
      // Mock moderation API returning safe (to test blocklist alone)
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ results: [{ flagged: false, categories: {} }] }),
      });

      const result = await checkInputSafety('I want to murder someone');
      expect(result.safe).toBe(false);
      expect(result.matchedTerms).toContain('murder');
      expect(result.userMessage).toBe(CONTENT_BLOCKED_USER_MESSAGE);
    });

    it('allows safe user input', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ results: [{ flagged: false, categories: {} }] }),
      });

      const result = await checkInputSafety('The cat explored the garden');
      expect(result.safe).toBe(true);
      expect(result.userMessage).toBeUndefined();
    });

    it('blocks content flagged by moderation API even if blocklist passes', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            {
              flagged: true,
              categories: { 'sexual/minors': true, harassment: false },
            },
          ],
        }),
      });

      const result = await checkInputSafety(
        'Some sneaky inappropriate content',
      );
      expect(result.safe).toBe(false);
      expect(result.moderationCategories).toContain('sexual/minors');
    });

    it('falls back gracefully when moderation API fails', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await checkInputSafety('The cat explored the garden');
      expect(result.safe).toBe(true); // Blocklist passes, API failure is non-blocking
    });

    it('falls back gracefully when moderation API times out', async () => {
      (global.fetch as jest.Mock).mockImplementation(
        () =>
          new Promise((_, reject) => {
            const error = new Error('abort');
            error.name = 'AbortError';
            reject(error);
          }),
      );

      const result = await checkInputSafety('A normal story about cats');
      expect(result.safe).toBe(true);
    });

    it('includes checkTimeMs in result', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ results: [{ flagged: false, categories: {} }] }),
      });

      const result = await checkInputSafety('Hello world');
      expect(result.checkTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ─── Output Safety (blocklist only) ──────────────────
  describe('checkOutputSafety', () => {
    it('blocks unsafe AI output', () => {
      const result = checkOutputSafety(
        'The character pulled out a gun and fired',
      );
      expect(result.safe).toBe(false);
      expect(result.userMessage).toBe(CONTENT_BLOCKED_OUTPUT_MESSAGE);
    });

    it('allows safe AI output', () => {
      const result = checkOutputSafety(
        'The brave explorer crossed the enchanted bridge and found a treasure chest.',
      );
      expect(result.safe).toBe(true);
    });

    it('is synchronous (no moderation API call)', () => {
      // checkOutputSafety should not call fetch
      const fetchSpy = jest.spyOn(global, 'fetch');
      checkOutputSafety('Some text to check');
      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });

    it('includes timing information', () => {
      const result = checkOutputSafety('A nice story');
      expect(result.checkTimeMs).toBeGreaterThanOrEqual(0);
    });
  });
});
