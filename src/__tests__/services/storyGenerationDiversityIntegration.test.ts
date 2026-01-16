// Test suite for story generation diversity integration
// Tests US-009: Integrate diversity guidance into story generation flow

import { storyGenerationService } from '../../services/storyGenerationService';
import * as diversitySessionService from '../../services/diversitySessionService';
import { recentElementsService } from '../../services/recentElementsService';
import { diversityGuidanceService } from '../../services/diversityGuidanceService';
import { openaiClient } from '../../services/openaiClient';
import { StoryRequest } from '../../types/story';
import { GradeLevel } from '../../types/database';
import { RecentElements } from '../../services/recentElementsService';

// Mock all external dependencies
jest.mock('../../services/diversitySessionService');
jest.mock('../../services/recentElementsService');
jest.mock('../../services/diversityGuidanceService');
jest.mock('../../services/openaiClient');

describe('Story Generation Diversity Integration', () => {
  // Helper to create mock recent elements
  const createMockRecentElements = (
    overrides: Partial<RecentElements> = {},
  ): RecentElements => ({
    characters: [],
    settings: [],
    objects: [],
    plot_patterns: [],
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    (openaiClient.isConfigured as jest.Mock).mockReturnValue(true);
    (openaiClient.generateStoryCompletion as jest.Mock).mockResolvedValue(
      'Once upon a time, there was a brave explorer.',
    );
  });

  describe('Diversity guidance integration with sessionId', () => {
    it('should retrieve diversity guidance when sessionId is provided', async () => {
      const sessionId = 'div_sess_test123';
      const recentElements = createMockRecentElements({
        characters: [
          {
            elementText: 'dragon',
            embeddingVector: new Array(1536).fill(0.1),
            frequency: 3,
            lastUsed: new Date(),
          },
        ],
        settings: [
          {
            elementText: 'enchanted forest',
            embeddingVector: new Array(1536).fill(0.2),
            frequency: 2,
            lastUsed: new Date(),
          },
        ],
      });

      (recentElementsService.getRecentElements as jest.Mock).mockResolvedValue(
        recentElements,
      );
      (recentElementsService.getTotalElementCount as jest.Mock).mockReturnValue(
        5,
      );

      const guidanceText = `Recently used elements to avoid:
- dragon (used 3 times)
- enchanted forest (used 2 times)

Suggested alternatives: Try urban settings, ocean settings, desert settings

Goal: Create a story with fresh, unexpected elements`;

      (
        diversityGuidanceService.generateDiversityGuidance as jest.Mock
      ).mockReturnValue({
        guidanceText,
        hasGuidance: true,
        avoidedElementsCount: 2,
        suggestedAlternativesCount: 3,
      });

      const request: StoryRequest = {
        gradeLevel: 'K-2' as GradeLevel,
        userInput: 'A curious cat',
        sessionId,
      };

      const response = await storyGenerationService.generateStory(request);

      expect(response.success).toBe(true);
      expect(recentElementsService.getRecentElements).toHaveBeenCalledWith({
        sessionId,
        limit: 10,
      });
      expect(
        diversityGuidanceService.generateDiversityGuidance,
      ).toHaveBeenCalledWith({
        recentElements,
        maxElementsToList: 5,
        includeAlternatives: true,
        emphasisLevel: 'moderate',
      });

      // Verify OpenAI was called with guidance-enhanced system prompt
      expect(openaiClient.generateStoryCompletion).toHaveBeenCalled();
      const [[systemPrompt]] = (
        openaiClient.generateStoryCompletion as jest.Mock
      ).mock.calls;
      expect(systemPrompt).toContain('dragon (used 3 times)');
      expect(systemPrompt).toContain('enchanted forest (used 2 times)');
      expect(systemPrompt).toContain('Suggested alternatives');
    });

    it('should create session from userId when no sessionId provided', async () => {
      const userId = 'user_abc123';
      const createdSessionId = 'div_sess_new456';

      (
        diversitySessionService.getOrCreateSessionWithAuth as jest.Mock
      ).mockResolvedValue({
        id: createdSessionId,
        sessionToken: 'token_123',
        userId: null,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      (recentElementsService.getRecentElements as jest.Mock).mockResolvedValue(
        createMockRecentElements(),
      );
      (recentElementsService.getTotalElementCount as jest.Mock).mockReturnValue(
        0,
      );

      (
        diversityGuidanceService.generateDiversityGuidance as jest.Mock
      ).mockReturnValue({
        guidanceText: '',
        hasGuidance: false,
        avoidedElementsCount: 0,
        suggestedAlternativesCount: 0,
      });

      const request: StoryRequest = {
        gradeLevel: '3-5' as GradeLevel,
        userInput: 'A mysterious discovery',
        userId,
      };

      await storyGenerationService.generateStory(request);

      expect(
        diversitySessionService.getOrCreateSessionWithAuth,
      ).toHaveBeenCalled();
      expect(recentElementsService.getRecentElements).toHaveBeenCalledWith({
        sessionId: createdSessionId,
        limit: 10,
      });
    });

    it('should skip diversity guidance when no recent elements exist', async () => {
      const sessionId = 'div_sess_empty789';

      (recentElementsService.getRecentElements as jest.Mock).mockResolvedValue(
        createMockRecentElements(),
      );
      (recentElementsService.getTotalElementCount as jest.Mock).mockReturnValue(
        0,
      );

      (
        diversityGuidanceService.generateDiversityGuidance as jest.Mock
      ).mockReturnValue({
        guidanceText: '',
        hasGuidance: false,
        avoidedElementsCount: 0,
        suggestedAlternativesCount: 0,
      });

      const request: StoryRequest = {
        gradeLevel: '6-8' as GradeLevel,
        userInput: 'A futuristic adventure',
        sessionId,
      };

      const response = await storyGenerationService.generateStory(request);

      expect(response.success).toBe(true);

      // Verify OpenAI was called WITHOUT diversity guidance
      const [[systemPrompt]] = (
        openaiClient.generateStoryCompletion as jest.Mock
      ).mock.calls;
      expect(systemPrompt).not.toContain('Recently used elements to avoid');
      expect(systemPrompt).not.toContain('Suggested alternatives');
    });

    it('should continue story generation if diversity guidance retrieval fails', async () => {
      const sessionId = 'div_sess_fail999';

      (recentElementsService.getRecentElements as jest.Mock).mockRejectedValue(
        new Error('Database connection error'),
      );

      const request: StoryRequest = {
        gradeLevel: '9-12' as GradeLevel,
        userInput: 'A philosophical journey',
        sessionId,
      };

      const response = await storyGenerationService.generateStory(request);

      // Story generation should succeed despite diversity guidance failure
      expect(response.success).toBe(true);
      expect(response.story).toBe(
        'Once upon a time, there was a brave explorer.',
      );
      expect(openaiClient.generateStoryCompletion).toHaveBeenCalled();
    });
  });

  describe('Diversity guidance without session context', () => {
    it('should generate story normally when no sessionId or userId provided', async () => {
      const request: StoryRequest = {
        gradeLevel: 'K-2' as GradeLevel,
        userInput: 'A happy puppy',
      };

      const response = await storyGenerationService.generateStory(request);

      expect(response.success).toBe(true);
      expect(
        diversitySessionService.getOrCreateSessionWithAuth,
      ).not.toHaveBeenCalled();
      expect(recentElementsService.getRecentElements).not.toHaveBeenCalled();
      expect(
        diversityGuidanceService.generateDiversityGuidance,
      ).not.toHaveBeenCalled();
    });
  });

  describe('Diversity guidance for story continuations', () => {
    it('should apply diversity guidance when continuing a story', async () => {
      const sessionId = 'div_sess_continuation';
      const storySoFar = 'Once there was a dragon who lived in a forest.';

      const recentElements = createMockRecentElements({
        characters: [
          {
            elementText: 'dragon',
            embeddingVector: new Array(1536).fill(0.3),
            frequency: 4,
            lastUsed: new Date(),
          },
        ],
        settings: [
          {
            elementText: 'forest',
            embeddingVector: new Array(1536).fill(0.4),
            frequency: 3,
            lastUsed: new Date(),
          },
        ],
      });

      (recentElementsService.getRecentElements as jest.Mock).mockResolvedValue(
        recentElements,
      );
      (recentElementsService.getTotalElementCount as jest.Mock).mockReturnValue(
        7,
      );

      const guidanceText = `Recently used elements to avoid:
- dragon (used 4 times)
- forest (used 3 times)

Suggested alternatives: Try robots, aliens, scientists for characters

Goal: Create a story with fresh, unexpected elements`;

      (
        diversityGuidanceService.generateDiversityGuidance as jest.Mock
      ).mockReturnValue({
        guidanceText,
        hasGuidance: true,
        avoidedElementsCount: 2,
        suggestedAlternativesCount: 3,
      });

      const request: StoryRequest = {
        gradeLevel: '3-5' as GradeLevel,
        storySoFar,
        userInput: 'The dragon decided to explore.',
        sessionId,
      };

      const response = await storyGenerationService.generateStory(request);

      expect(response.success).toBe(true);

      // Verify guidance was included even for continuation
      const [[systemPrompt]] = (
        openaiClient.generateStoryCompletion as jest.Mock
      ).mock.calls;
      expect(systemPrompt).toContain('dragon (used 4 times)');
      expect(systemPrompt).toContain('forest (used 3 times)');
    });
  });

  describe('Diversity guidance for different grade levels', () => {
    const gradeLevels: GradeLevel[] = ['K-2', '3-5', '6-8', '9-12'];

    gradeLevels.forEach(gradeLevel => {
      it(`should generate diversity guidance for ${gradeLevel} grade level`, async () => {
        const sessionId = `div_sess_${gradeLevel}`;

        const recentElements = createMockRecentElements({
          objects: [
            {
              elementText: 'magic wand',
              embeddingVector: new Array(1536).fill(0.5),
              frequency: 2,
              lastUsed: new Date(),
            },
          ],
        });

        (
          recentElementsService.getRecentElements as jest.Mock
        ).mockResolvedValue(recentElements);
        (
          recentElementsService.getTotalElementCount as jest.Mock
        ).mockReturnValue(2);

        const guidanceText = `Recently used elements to avoid:
- magic wand (used 2 times)

Goal: Create a story with fresh, unexpected elements`;

        (
          diversityGuidanceService.generateDiversityGuidance as jest.Mock
        ).mockReturnValue({
          guidanceText,
          hasGuidance: true,
          avoidedElementsCount: 1,
          suggestedAlternativesCount: 0,
        });

        const request: StoryRequest = {
          gradeLevel,
          userInput: 'A magical adventure',
          sessionId,
        };

        const response = await storyGenerationService.generateStory(request);

        expect(response.success).toBe(true);
        expect(response.gradeLevel).toBe(gradeLevel);

        // Verify grade-level vocabulary guidance is preserved
        const [[systemPrompt]] = (
          openaiClient.generateStoryCompletion as jest.Mock
        ).mock.calls;
        expect(systemPrompt).toContain(
          `VOCABULARY REQUIREMENTS FOR ${gradeLevel}`,
        );
        expect(systemPrompt).toContain('magic wand (used 2 times)');
      });
    });
  });

  describe('Error handling and logging', () => {
    it('should log diversity guidance retrieval process', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const sessionId = 'div_sess_logging';

      (recentElementsService.getRecentElements as jest.Mock).mockResolvedValue(
        createMockRecentElements(),
      );
      (recentElementsService.getTotalElementCount as jest.Mock).mockReturnValue(
        0,
      );

      (
        diversityGuidanceService.generateDiversityGuidance as jest.Mock
      ).mockReturnValue({
        guidanceText: '',
        hasGuidance: false,
        avoidedElementsCount: 0,
        suggestedAlternativesCount: 0,
      });

      const request: StoryRequest = {
        gradeLevel: 'K-2' as GradeLevel,
        userInput: 'A cheerful bird',
        sessionId,
      };

      await storyGenerationService.generateStory(request);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Retrieving diversity guidance'),
        expect.any(Object),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Retrieved recent elements'),
        expect.any(Object),
      );

      consoleSpy.mockRestore();
    });

    it('should log error when diversity guidance fails but continue generation', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const sessionId = 'div_sess_error';

      (recentElementsService.getRecentElements as jest.Mock).mockRejectedValue(
        new Error('Network timeout'),
      );

      const request: StoryRequest = {
        gradeLevel: '6-8' as GradeLevel,
        userInput: 'An unexpected twist',
        sessionId,
      };

      const response = await storyGenerationService.generateStory(request);

      expect(response.success).toBe(true);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error retrieving diversity guidance'),
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Integration with fallback story generation', () => {
    it('should not apply diversity guidance when using fallback templates', async () => {
      const sessionId = 'div_sess_fallback';

      (openaiClient.isConfigured as jest.Mock).mockReturnValue(false);

      const request: StoryRequest = {
        gradeLevel: 'K-2' as GradeLevel,
        userInput: 'A brave knight',
        sessionId,
      };

      const response = await storyGenerationService.generateStory(request);

      expect(response.success).toBe(true);
      // Diversity services should not be called when OpenAI is unavailable
      expect(recentElementsService.getRecentElements).not.toHaveBeenCalled();
      expect(
        diversityGuidanceService.generateDiversityGuidance,
      ).not.toHaveBeenCalled();
    });
  });
});
