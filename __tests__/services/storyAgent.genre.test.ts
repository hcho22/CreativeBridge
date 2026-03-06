// Story Agent Genre-Aware Challenge Tests (US-009)
// Validates that getGradeLevelChallenge appends genre-specific modifiers
// and that buildStarterRequest passes request.theme as genre.

import { storyAgentService } from '../../src/services/storyAgent';

// Access private methods for unit testing via type assertion
const service = storyAgentService as any;

describe('getGradeLevelChallenge with genre modifiers', () => {
  describe('without genre (backward compatibility)', () => {
    it('should return base K-2 challenge when no genre is provided', () => {
      const challenge = service.getGradeLevelChallenge('K-2');
      expect(challenge).toContain('vivid sensory experiences');
      expect(challenge).not.toContain('mysterious');
      expect(challenge).not.toContain('fantastical');
      expect(challenge).not.toContain('humorous');
      expect(challenge).not.toContain('spooky');
    });

    it('should return base 3-5 challenge when no genre is provided', () => {
      const challenge = service.getGradeLevelChallenge('3-5');
      expect(challenge).toContain('intriguing problem');
      expect(challenge).toContain('teamwork');
    });

    it('should return base 6-8 challenge when no genre is provided', () => {
      const challenge = service.getGradeLevelChallenge('6-8');
      expect(challenge).toContain('complex emotional landscapes');
    });

    it('should return base 9-12 challenge when no genre is provided', () => {
      const challenge = service.getGradeLevelChallenge('9-12');
      expect(challenge).toContain('profound themes');
    });

    it('should return identical output when genre is undefined', () => {
      const withoutGenre = service.getGradeLevelChallenge('K-2');
      const withUndefined = service.getGradeLevelChallenge('K-2', undefined);
      expect(withoutGenre).toBe(withUndefined);
    });
  });

  describe('Mystery genre modifier', () => {
    it('should append mystery modifier to K-2 challenge', () => {
      const challenge = service.getGradeLevelChallenge('K-2', 'Mystery');
      expect(challenge).toContain('vivid sensory experiences'); // base preserved
      expect(challenge).toContain('mysterious element that raises questions');
    });

    it('should append mystery modifier to 9-12 challenge', () => {
      const challenge = service.getGradeLevelChallenge('9-12', 'Mystery');
      expect(challenge).toContain('profound themes'); // base preserved
      expect(challenge).toContain('mysterious element');
      expect(challenge).toContain('clues');
    });
  });

  describe('Fantasy genre modifier', () => {
    it('should append fantasy modifier to 3-5 challenge', () => {
      const challenge = service.getGradeLevelChallenge('3-5', 'Fantasy');
      expect(challenge).toContain('intriguing problem'); // base preserved
      expect(challenge).toContain('fantastical element');
      expect(challenge).toContain('magic');
    });
  });

  describe('Comedy genre modifier', () => {
    it('should append comedy modifier to 6-8 challenge', () => {
      const challenge = service.getGradeLevelChallenge('6-8', 'Comedy');
      expect(challenge).toContain('complex emotional landscapes'); // base preserved
      expect(challenge).toContain('humorous moment');
      expect(challenge).toContain('funny character trait');
    });
  });

  describe('Horror genre modifier', () => {
    it('should append horror modifier to K-2 challenge', () => {
      const challenge = service.getGradeLevelChallenge('K-2', 'Horror');
      expect(challenge).toContain('vivid sensory experiences'); // base preserved
      expect(challenge).toContain('spooky');
      expect(challenge).toContain('suspenseful');
    });

    it('should append horror modifier to 9-12 challenge', () => {
      const challenge = service.getGradeLevelChallenge('9-12', 'Horror');
      expect(challenge).toContain('profound themes'); // base preserved
      expect(challenge).toContain('spooky');
    });
  });

  describe('Fiction genre modifier', () => {
    it('should append fiction modifier to 3-5 challenge', () => {
      const challenge = service.getGradeLevelChallenge('3-5', 'Fiction');
      expect(challenge).toContain('intriguing problem'); // base preserved
      expect(challenge).toContain('realistic yet compelling');
      expect(challenge).toContain('emotionally authentic');
    });
  });

  describe('Fairy Tale genre modifier', () => {
    it('should append fairy tale modifier to K-2 challenge', () => {
      const challenge = service.getGradeLevelChallenge('K-2', 'Fairy Tale');
      expect(challenge).toContain('vivid sensory experiences'); // base preserved
      expect(challenge).toContain('fairy tale element');
      expect(challenge).toContain('moral lesson');
    });

    it('should append fairy tale modifier to 6-8 challenge', () => {
      const challenge = service.getGradeLevelChallenge('6-8', 'Fairy Tale');
      expect(challenge).toContain('complex emotional landscapes'); // base preserved
      expect(challenge).toContain('magical transformation');
    });
  });

  describe('all 6 genres produce distinct modifiers', () => {
    const genres = [
      'Mystery',
      'Fantasy',
      'Comedy',
      'Horror',
      'Fiction',
      'Fairy Tale',
    ];

    it('should produce a different challenge for each genre', () => {
      const results = genres.map(genre =>
        service.getGradeLevelChallenge('K-2', genre),
      );

      // Each genre result should be unique
      const uniqueResults = new Set(results);
      expect(uniqueResults.size).toBe(genres.length);
    });

    it('each genre challenge should be longer than base challenge', () => {
      const base = service.getGradeLevelChallenge('K-2');
      genres.forEach(genre => {
        const withGenre = service.getGradeLevelChallenge('K-2', genre);
        expect(withGenre.length).toBeGreaterThan(base.length);
      });
    });
  });

  describe('unknown genre is ignored gracefully', () => {
    it('should return base challenge for an unrecognized genre', () => {
      const base = service.getGradeLevelChallenge('K-2');
      const unknown = service.getGradeLevelChallenge('K-2', 'SciFi');
      expect(unknown).toBe(base);
    });
  });
});

describe('buildStarterRequest passes theme as genre', () => {
  it('should pass theme to getGradeLevelChallenge as genre', () => {
    const request = {
      gradeLevel: 'K-2' as const,
      theme: 'Fantasy',
    };

    const result = service.buildStarterRequest(request);
    // The challenge should contain the Fantasy modifier
    expect(result.challenge).toContain('fantastical element');
    expect(result.challenge).toContain('magic');
  });

  it('should pass Mystery theme to challenge', () => {
    const request = {
      gradeLevel: '9-12' as const,
      theme: 'Mystery',
    };

    const result = service.buildStarterRequest(request);
    expect(result.challenge).toContain('mysterious element');
    expect(result.challenge).toContain('clues');
  });

  it('should not append genre modifier when theme is undefined', () => {
    const request = {
      gradeLevel: '3-5' as const,
    };

    const result = service.buildStarterRequest(request);
    const baseChallenge = service.getGradeLevelChallenge('3-5');
    expect(result.challenge).toBe(baseChallenge);
  });

  it('should preserve other request fields alongside genre challenge', () => {
    const request = {
      gradeLevel: '6-8' as const,
      theme: 'Comedy',
      character: 'a clever inventor',
      setting: 'a bustling city',
      sessionId: 'session-abc',
      userId: 'user-xyz',
      storyId: 'story-123',
    };

    const result = service.buildStarterRequest(request);
    expect(result.challenge).toContain('humorous moment');
    expect(result.gradeLevel).toBe('6-8');
    expect(result.sessionId).toBe('session-abc');
    expect(result.userId).toBe('user-xyz');
    expect(result.storyId).toBe('story-123');
  });
});
