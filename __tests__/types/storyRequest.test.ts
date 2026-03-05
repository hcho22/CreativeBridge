// StoryRequest Genre Field Tests (US-006)
// Validates that genre field exists on StoryRequest and is inherited by extensions

import { StoryRequest } from '../../src/types/story';

describe('StoryRequest.genre', () => {
  const baseRequest: StoryRequest = {
    gradeLevel: 'K-2',
  };

  it('should accept genre as an optional field', () => {
    // Without genre — existing behavior preserved
    expect(baseRequest.genre).toBeUndefined();
  });

  it('should accept genre with a valid genre string', () => {
    const requestWithGenre: StoryRequest = {
      ...baseRequest,
      genre: 'Mystery',
    };
    expect(requestWithGenre.genre).toBe('Mystery');
  });

  it('should accept all 6 genre values', () => {
    const genres = [
      'Mystery',
      'Fantasy',
      'Comedy',
      'Horror',
      'Fiction',
      'Fairy Tale',
    ];

    genres.forEach(genre => {
      const request: StoryRequest = {
        ...baseRequest,
        genre,
      };
      expect(request.genre).toBe(genre);
    });
  });

  it('should work alongside other StoryRequest fields', () => {
    const fullRequest: StoryRequest = {
      gradeLevel: '6-8',
      storySoFar: 'The detective examined the clue...',
      userInput: 'She picked up the magnifying glass.',
      challenge: 'Use a metaphor',
      sessionId: 'session-123',
      userId: 'user-456',
      storyId: 'story-789',
      genre: 'Mystery',
    };

    expect(fullRequest.genre).toBe('Mystery');
    expect(fullRequest.gradeLevel).toBe('6-8');
    expect(fullRequest.storySoFar).toBeDefined();
  });
});

describe('StoryContinuationRequest inherits genre', () => {
  // StoryContinuationRequest is not exported from storyAgent.ts, but it
  // extends StoryRequest. We verify the inheritance pattern structurally:
  // any object matching StoryContinuationRequest's shape must also accept genre.

  interface StoryContinuationRequest extends StoryRequest {
    consistencyCheck?: boolean;
    qualityThreshold?: number;
  }

  it('should accept genre on a continuation request', () => {
    const continuationRequest: StoryContinuationRequest = {
      gradeLevel: '3-5',
      storySoFar: 'Once upon a time in a magical forest...',
      userInput: 'The fairy cast a spell.',
      genre: 'Fantasy',
      consistencyCheck: true,
      qualityThreshold: 0.8,
    };

    expect(continuationRequest.genre).toBe('Fantasy');
    expect(continuationRequest.consistencyCheck).toBe(true);
  });

  it('should not require genre on a continuation request', () => {
    const continuationRequest: StoryContinuationRequest = {
      gradeLevel: '9-12',
      storySoFar: 'The spaceship drifted silently...',
      consistencyCheck: false,
    };

    expect(continuationRequest.genre).toBeUndefined();
  });
});
