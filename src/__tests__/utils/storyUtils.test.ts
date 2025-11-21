/**
 * Unit tests for story utility functions
 */

import {
  extractLatestContinuation,
  extractLatestContinuationAdvanced,
  countSentences,
  getLatestContinuationWordCount,
} from '../../utils/storyUtils';
import { StorySession } from '../../services/storySessionManager';

describe('extractLatestContinuation', () => {
  describe('Basic functionality', () => {
    test('extracts only the latest continuation from multiple sentences', () => {
      const fullStory =
        'Once upon a time... Then the hero continued... The story reached its climax...';
      const latest = extractLatestContinuation(fullStory);
      expect(latest).toBe('The story reached its climax...');
      expect(latest).not.toContain('Once upon a time');
      expect(latest).not.toContain('Then the hero continued');
    });

    test('handles single continuation', () => {
      const story = 'A single story continuation.';
      const latest = extractLatestContinuation(story);
      expect(latest).toBe(story);
    });

    test('handles empty story gracefully', () => {
      expect(extractLatestContinuation('')).toBe('');
      expect(extractLatestContinuation(null as any)).toBe('');
      expect(extractLatestContinuation(undefined as any)).toBe('');
    });

    test('handles story with only whitespace', () => {
      expect(extractLatestContinuation('   ')).toBe('');
      expect(extractLatestContinuation('\n\n\t')).toBe('');
    });
  });

  describe('Sentence boundary detection', () => {
    test('handles sentences ending with periods', () => {
      const story = 'First sentence. Second sentence. Third sentence.';
      const latest = extractLatestContinuation(story);
      expect(latest).toBe('Third sentence.');
    });

    test('handles sentences ending with exclamation marks', () => {
      const story = 'First sentence! Second sentence! Third sentence!';
      const latest = extractLatestContinuation(story);
      expect(latest).toBe('Third sentence!');
    });

    test('handles sentences ending with question marks', () => {
      const story = 'First sentence? Second sentence? Third sentence?';
      const latest = extractLatestContinuation(story);
      expect(latest).toBe('Third sentence?');
    });

    test('handles mixed sentence endings', () => {
      const story = 'First sentence. Second sentence! Third sentence?';
      const latest = extractLatestContinuation(story);
      expect(latest).toBe('Third sentence?');
    });
  });

  describe('With contributions array', () => {
    test('uses last contribution when session with contributions is provided', () => {
      const mockSession: StorySession = {
        id: 'test-id',
        user_id: 'user-id',
        created_at: new Date().toISOString(),
        grade_level: 'K-2',
        final_score: 0,
        words_written: 0,
        sentences_completed: 3,
        challenges_completed: 0,
        xp_earned: 0,
        story_content: 'First. Second. Third.',
        contributions: [
          {
            type: 'ai',
            content: 'First.',
            timestamp: Date.now() - 3000,
            wordCount: 1,
          },
          {
            type: 'user',
            content: 'Second.',
            timestamp: Date.now() - 2000,
            wordCount: 1,
          },
          {
            type: 'ai',
            content: 'Third.',
            timestamp: Date.now() - 1000,
            wordCount: 1,
          },
        ],
        isCompleted: false,
        sessionStats: {
          totalWords: 3,
          userWords: 1,
          aiWords: 2,
          sessionDuration: 0,
          contributionCount: 3,
        },
        metadata: {},
      };

      const latest = extractLatestContinuation(
        'First. Second. Third.',
        mockSession,
      );
      expect(latest).toBe('Third.');
    });

    test('falls back to string parsing when contributions array is empty', () => {
      const mockSession: StorySession = {
        id: 'test-id',
        user_id: 'user-id',
        created_at: new Date().toISOString(),
        grade_level: 'K-2',
        final_score: 0,
        words_written: 0,
        sentences_completed: 0,
        challenges_completed: 0,
        xp_earned: 0,
        story_content: 'First. Second. Third.',
        contributions: [],
        isCompleted: false,
        sessionStats: {
          totalWords: 0,
          userWords: 0,
          aiWords: 0,
          sessionDuration: 0,
          contributionCount: 0,
        },
        metadata: {},
      };

      const latest = extractLatestContinuation(
        'First. Second. Third.',
        mockSession,
      );
      expect(latest).toBe('Third.');
    });

    test('handles session with null contributions', () => {
      const mockSession: StorySession = {
        id: 'test-id',
        user_id: 'user-id',
        created_at: new Date().toISOString(),
        grade_level: 'K-2',
        final_score: 0,
        words_written: 0,
        sentences_completed: 0,
        challenges_completed: 0,
        xp_earned: 0,
        story_content: 'First. Second. Third.',
        contributions: null as any,
        isCompleted: false,
        sessionStats: {
          totalWords: 0,
          userWords: 0,
          aiWords: 0,
          sessionDuration: 0,
          contributionCount: 0,
        },
        metadata: {},
      };

      const latest = extractLatestContinuation(
        'First. Second. Third.',
        mockSession,
      );
      expect(latest).toBe('Third.');
    });
  });

  describe('Edge cases', () => {
    test('handles very short last sentence (returns last few sentences)', () => {
      const story =
        'This is a long first sentence with many words. This is another sentence. Hi.';
      const latest = extractLatestContinuation(story);
      // Should return last 2-3 sentences since "Hi." is very short
      expect(latest.length).toBeGreaterThan(5);
    });

    test('handles story with no sentence endings', () => {
      const story =
        'This is a story with no sentence endings just continuous text';
      const latest = extractLatestContinuation(story);
      expect(latest).toBe(story);
    });

    test('handles story with only punctuation', () => {
      const story = '...!!!???';
      const latest = extractLatestContinuation(story);
      expect(latest).toBe('');
    });

    test('handles story with multiple spaces', () => {
      const story = 'First sentence.    Second sentence.';
      const latest = extractLatestContinuation(story);
      expect(latest).toBe('Second sentence.');
    });

    test('handles story with newlines', () => {
      const story = 'First sentence.\n\nSecond sentence.';
      const latest = extractLatestContinuation(story);
      expect(latest).toBe('Second sentence.');
    });
  });
});

describe('extractLatestContinuationAdvanced', () => {
  test('extracts last paragraph when paragraphs are separated by double newlines', () => {
    const story = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
    const latest = extractLatestContinuationAdvanced(story);
    expect(latest).toBe('Third paragraph.');
  });

  test('falls back to sentence extraction when no paragraph boundaries', () => {
    const story = 'First sentence. Second sentence. Third sentence.';
    const latest = extractLatestContinuationAdvanced(story);
    expect(latest).toBe('Third sentence.');
  });

  test('uses contributions array when available', () => {
    const mockSession: StorySession = {
      id: 'test-id',
      user_id: 'user-id',
      created_at: new Date().toISOString(),
      grade_level: 'K-2',
      final_score: 0,
      words_written: 0,
      sentences_completed: 2,
      challenges_completed: 0,
      xp_earned: 0,
      story_content: 'First. Second.',
      contributions: [
        {
          type: 'ai',
          content: 'First.',
          timestamp: Date.now() - 2000,
          wordCount: 1,
        },
        {
          type: 'user',
          content: 'Second.',
          timestamp: Date.now() - 1000,
          wordCount: 1,
        },
      ],
      isCompleted: false,
      sessionStats: {
        totalWords: 2,
        userWords: 1,
        aiWords: 1,
        sessionDuration: 0,
        contributionCount: 2,
      },
      metadata: {},
    };

    const latest = extractLatestContinuationAdvanced(
      'First. Second.',
      mockSession,
    );
    expect(latest).toBe('Second.');
  });
});

describe('countSentences', () => {
  test('counts sentences correctly', () => {
    expect(countSentences('First. Second. Third.')).toBe(3);
    expect(countSentences('One sentence.')).toBe(1);
    expect(countSentences('')).toBe(0);
    expect(countSentences(null as any)).toBe(0);
    expect(countSentences(undefined as any)).toBe(0);
  });

  test('handles mixed sentence endings', () => {
    expect(countSentences('First! Second? Third.')).toBe(3);
  });
});

describe('getLatestContinuationWordCount', () => {
  test('counts words in latest continuation', () => {
    const story = 'First sentence. Second sentence. Third sentence.';
    const count = getLatestContinuationWordCount(story);
    // "Third sentence." = 2 words (punctuation not counted in word splitting)
    expect(count).toBeGreaterThanOrEqual(2);
    expect(count).toBeLessThanOrEqual(3); // Allow for edge cases
  });

  test('returns 0 for empty story', () => {
    expect(getLatestContinuationWordCount('')).toBe(0);
    expect(getLatestContinuationWordCount(null as any)).toBe(0);
  });

  test('uses contributions when available', () => {
    const mockSession: StorySession = {
      id: 'test-id',
      user_id: 'user-id',
      created_at: new Date().toISOString(),
      grade_level: 'K-2',
      final_score: 0,
      words_written: 0,
      sentences_completed: 1,
      challenges_completed: 0,
      xp_earned: 0,
      story_content: 'Test content.',
      contributions: [
        {
          type: 'ai',
          content: 'This is a test sentence with five words.',
          timestamp: Date.now(),
          wordCount: 8, // "This is a test sentence with five words." = 8 words
        },
      ],
      isCompleted: false,
      sessionStats: {
        totalWords: 8,
        userWords: 0,
        aiWords: 8,
        sessionDuration: 0,
        contributionCount: 1,
      },
      metadata: {},
    };

    const count = getLatestContinuationWordCount('Test content.', mockSession);
    expect(count).toBe(8); // "This is a test sentence with five words." = 8 words
  });
});
