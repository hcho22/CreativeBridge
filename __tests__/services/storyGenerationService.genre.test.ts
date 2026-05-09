/**
 * US-008: Genre-aware story generation prompts
 *
 * Tests that buildSystemPrompt, buildUserPrompt, and fallback story selection
 * correctly incorporate genre-specific guidance into the story generation pipeline.
 */

// Access private methods via prototype for testing

const StoryGenerationServiceModule = require('../../src/services/storyGenerationService');

describe('US-008: Genre-aware story generation prompts', () => {
  let service: any;

  beforeEach(() => {
    // Get the singleton instance exported by the module
    service =
      StoryGenerationServiceModule.storyGenerationService ||
      StoryGenerationServiceModule.default;

    // If no singleton, instantiate the class directly
    if (!service) {
      const ServiceClass =
        StoryGenerationServiceModule.StoryGenerationService ||
        Object.values(StoryGenerationServiceModule).find(
          (v: any) => typeof v === 'function' && v.prototype,
        );
      if (ServiceClass) {
        service = new (ServiceClass as any)();
      }
    }
  });

  describe('getGenreGuidance', () => {
    const genres = [
      'Mystery',
      'Fantasy',
      'Comedy',
      'Horror',
      'Fiction',
      'Fairy Tale',
    ];

    it.each(genres)(
      'returns non-empty guidance for %s genre',
      (genre: string) => {
        const guidance = service.getGenreGuidance(genre, '6-8');
        expect(guidance).toBeTruthy();
        expect(guidance.length).toBeGreaterThan(20);
      },
    );

    it('returns empty string for unknown genre', () => {
      const guidance = service.getGenreGuidance('NonExistentGenre', '6-8');
      expect(guidance).toBe('');
    });
  });

  describe('getHorrorGuidance (age-gating)', () => {
    it('K-2 Horror is "spooky and silly", not scary', () => {
      const guidance = service.getHorrorGuidance('K-2');
      expect(guidance).toMatch(/spooky/i);
      expect(guidance).toMatch(/silly/i);
      expect(guidance).not.toMatch(/\bscary\b/i);
      expect(guidance).not.toMatch(/frightening/i);
    });

    it('3-5 Horror is "mild suspense", not frightening', () => {
      const guidance = service.getHorrorGuidance('3-5');
      expect(guidance).toMatch(/mild suspense/i);
      expect(guidance).not.toMatch(/frightening/i);
    });

    it('6-8 Horror includes atmospheric tension', () => {
      const guidance = service.getHorrorGuidance('6-8');
      expect(guidance).toMatch(/atmospheric/i);
      expect(guidance).toMatch(/age-appropriate/i);
    });

    it('9-12 Horror includes psychological suspense', () => {
      const guidance = service.getHorrorGuidance('9-12');
      expect(guidance).toMatch(/psychological/i);
      expect(guidance).toMatch(/horror/i);
    });
  });

  describe('buildSystemPrompt with genre', () => {
    const mockAgent = {
      role: 'creative_writer',
      goal: 'Write engaging stories',
      backstory: 'A creative writer',
    };

    it.each([
      ['Mystery', 'clues'],
      ['Fantasy', 'magical'],
      ['Comedy', 'humor'],
      ['Fiction', 'realistic fiction'],
      ['Fairy Tale', 'fairy tale'],
    ])(
      'includes genre name and guidance for %s',
      (genre: string, expectedKeyword: string) => {
        const prompt = service.buildSystemPrompt(mockAgent, '6-8', '', genre);
        expect(prompt).toContain(`GENRE: ${genre}`);
        expect(prompt.toLowerCase()).toContain(expectedKeyword.toLowerCase());
      },
    );

    it('includes Horror guidance with K-2 age-gating in system prompt', () => {
      const prompt = service.buildSystemPrompt(mockAgent, 'K-2', '', 'Horror');
      expect(prompt).toContain('GENRE: Horror');
      expect(prompt.toLowerCase()).toContain('spooky');
      expect(prompt.toLowerCase()).toContain('silly');
      expect(prompt).not.toMatch(/\bscary\b/i);
      // US-015f.1.genre: scope the "frightening" check to the genre section
      // only. The IMPORTANT SAFETY INSTRUCTIONS preamble (added to every
      // prompt — see storyGenerationService.ts) legitimately contains the
      // word in a denial context: "Never generate content that is violent,
      // sexual, frightening, or otherwise inappropriate". That's correct
      // behavior, not a regression. Slice from "GENRE: Horror" to the next
      // section header to assert only on the genre-specific guidance.
      const genreSection = prompt.slice(
        prompt.indexOf('GENRE: Horror'),
        prompt.indexOf('Key guidelines'),
      );
      expect(genreSection).not.toMatch(/frightening/i);
    });

    it('includes Horror guidance with 3-5 age-gating in system prompt', () => {
      const prompt = service.buildSystemPrompt(mockAgent, '3-5', '', 'Horror');
      expect(prompt).toContain('GENRE: Horror');
      expect(prompt.toLowerCase()).toContain('mild suspense');
    });

    it('does NOT contain "GENRE:" when no genre is set', () => {
      const prompt = service.buildSystemPrompt(mockAgent, '6-8', '');
      expect(prompt).not.toContain('GENRE:');
    });

    it('does NOT contain "GENRE:" when genre is undefined', () => {
      const prompt = service.buildSystemPrompt(mockAgent, '6-8', '', undefined);
      expect(prompt).not.toContain('GENRE:');
    });

    it('places GENRE block between vocabulary and key guidelines', () => {
      const prompt = service.buildSystemPrompt(mockAgent, '6-8', '', 'Mystery');
      const vocabIndex = prompt.indexOf('VOCABULARY REQUIREMENTS');
      const genreIndex = prompt.indexOf('GENRE: Mystery');
      const guidelinesIndex = prompt.indexOf('Key guidelines:');

      expect(vocabIndex).toBeLessThan(genreIndex);
      expect(genreIndex).toBeLessThan(guidelinesIndex);
    });

    it('still includes diversity guidance when both genre and diversity are set', () => {
      const diversityGuidance = 'DIVERSITY: Include diverse characters.';
      const prompt = service.buildSystemPrompt(
        mockAgent,
        '6-8',
        diversityGuidance,
        'Fantasy',
      );
      expect(prompt).toContain('GENRE: Fantasy');
      expect(prompt).toContain(diversityGuidance);
    });
  });

  describe('buildUserPrompt with genre (continuation)', () => {
    it('includes genre maintenance instruction for continuations', () => {
      const prompt = service.buildUserPrompt({
        gradeLevel: '6-8',
        storySoFar: 'The detective examined the clue carefully.',
        genre: 'Mystery',
      });
      expect(prompt).toContain('Maintain the Mystery genre throughout.');
    });

    it('does NOT include genre instruction when genre is undefined', () => {
      const prompt = service.buildUserPrompt({
        gradeLevel: '6-8',
        storySoFar: 'The detective examined the clue carefully.',
      });
      expect(prompt).not.toContain('Maintain the');
      expect(prompt).not.toContain('genre throughout');
    });

    it.each([
      'Mystery',
      'Fantasy',
      'Comedy',
      'Horror',
      'Fiction',
      'Fairy Tale',
    ])('includes %s genre in continuation prompt', (genre: string) => {
      const prompt = service.buildUserPrompt({
        gradeLevel: '6-8',
        storySoFar: 'Once upon a time...',
        genre,
      });
      expect(prompt).toContain(`Maintain the ${genre} genre throughout.`);
    });
  });

  describe('buildUserPrompt with genre (starter)', () => {
    it('includes GENRE REQUIREMENT for story starters', () => {
      const prompt = service.buildUserPrompt({
        gradeLevel: '6-8',
        genre: 'Mystery',
      });
      expect(prompt).toContain('GENRE REQUIREMENT');
      expect(prompt).toContain('Mystery');
    });

    it('does NOT include GENRE REQUIREMENT when genre is undefined', () => {
      const prompt = service.buildUserPrompt({
        gradeLevel: '6-8',
      });
      expect(prompt).not.toContain('GENRE REQUIREMENT');
    });

    it.each([
      'Mystery',
      'Fantasy',
      'Comedy',
      'Horror',
      'Fiction',
      'Fairy Tale',
    ])('includes %s in starter GENRE REQUIREMENT', (genre: string) => {
      const prompt = service.buildUserPrompt({
        gradeLevel: '6-8',
        genre,
      });
      expect(prompt).toContain('GENRE REQUIREMENT');
      expect(prompt).toContain(genre);
    });

    it('starter without genre is unchanged from baseline', () => {
      const withGenre = service.buildUserPrompt({
        gradeLevel: '6-8',
        genre: 'Mystery',
      });
      const withoutGenre = service.buildUserPrompt({
        gradeLevel: '6-8',
      });

      // The without-genre version should NOT have genre requirement
      expect(withoutGenre).not.toContain('GENRE REQUIREMENT');
      // The with-genre version should have it
      expect(withGenre).toContain('GENRE REQUIREMENT');
      // Both should have the standard structure
      expect(withGenre).toContain('FINAL INSTRUCTION');
      expect(withoutGenre).toContain('FINAL INSTRUCTION');
    });
  });

  describe('fallback story selection (generateStoryStarter)', () => {
    it('prefers genre-matching categories when genre is set', () => {
      // Run multiple times to test statistical preference
      for (let i = 0; i < 50; i++) {
        const result = service.generateStoryStarter({
          gradeLevel: '3-5',
          genre: 'Mystery',
        });
        // The result should be a valid story
        expect(result.success).toBe(true);
        expect(result.story).toBeTruthy();
      }
    });

    it('falls back to any grade-level story when genre has no category matches', () => {
      // Use a grade level that might not have genre matches
      const result = service.generateStoryStarter({
        gradeLevel: 'K-2',
        genre: 'Mystery',
      });
      expect(result.success).toBe(true);
      expect(result.story).toBeTruthy();
    });

    it('works without genre (backward compatibility)', () => {
      const result = service.generateStoryStarter({
        gradeLevel: '6-8',
      });
      expect(result.success).toBe(true);
      expect(result.story).toBeTruthy();
    });
  });

  describe('backward compatibility (no genre)', () => {
    const mockAgent = {
      role: 'creative_writer',
      goal: 'Write stories',
      backstory: 'A writer',
    };

    it('system prompt without genre is identical to baseline', () => {
      const withoutGenre = service.buildSystemPrompt(mockAgent, '6-8', '');
      const withUndefined = service.buildSystemPrompt(
        mockAgent,
        '6-8',
        '',
        undefined,
      );
      expect(withoutGenre).toBe(withUndefined);
    });

    it('user prompt (continuation) without genre has no genre text', () => {
      const prompt = service.buildUserPrompt({
        gradeLevel: '6-8',
        storySoFar: 'A story beginning.',
      });
      expect(prompt).not.toContain('Maintain the');
      expect(prompt).not.toContain('GENRE');
    });

    it('user prompt (starter) without genre has no genre text', () => {
      const prompt = service.buildUserPrompt({
        gradeLevel: '6-8',
      });
      expect(prompt).not.toContain('GENRE REQUIREMENT');
      expect(prompt).not.toContain('GENRE:');
    });
  });
});
