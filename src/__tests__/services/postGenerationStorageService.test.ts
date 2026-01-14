// Tests for Post-Generation Storage Service
// Comprehensive test suite for US-010: Post-generation element extraction and storage

import { postGenerationStorageService } from '../../services/postGenerationStorageService';
import { storyElementExtractionService } from '../../services/storyElementExtractionService';
import { embeddingGenerationService } from '../../services/embeddingGenerationService';
import { supabase } from '../../services/supabase';

// Mock dependencies
jest.mock('../../services/storyElementExtractionService');
jest.mock('../../services/embeddingGenerationService');
jest.mock('../../services/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

describe('PostGenerationStorageService', () => {
  const mockStoryText = `Once upon a time, in an enchanted forest, there lived a brave dragon named Ember.
    She discovered a magical crystal that could grant wishes. On her journey through the mystical mountains,
    she met a wise old wizard who taught her the importance of friendship.`;

  const mockStoryId = 'story-123';
  const mockSessionId = 'session-456';

  const mockExtractedElements = {
    characters: [
      { name: 'ember', type: 'dragon', role: 'protagonist' },
      { name: 'wizard', type: 'human', role: 'mentor' },
    ],
    settings: [
      { location: 'enchanted forest', environment: 'magical' },
      { location: 'mystical mountains', environment: 'natural' },
    ],
    objects: [
      { name: 'magical crystal', magical: true, purpose: 'grants wishes' },
    ],
    plot_patterns: [
      { action: 'discovery', discovery_type: 'object' },
      { action: 'journey', discovery_type: 'self' },
    ],
  };

  const mockEmbedding = new Array(1536).fill(0).map((_, i) => i / 1536);

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock extraction service
    (
      storyElementExtractionService.extractStoryElements as jest.Mock
    ).mockResolvedValue(mockExtractedElements);

    // Mock embedding service
    (
      embeddingGenerationService.generateEmbeddingsBatch as jest.Mock
    ).mockResolvedValue([
      mockEmbedding,
      mockEmbedding,
      mockEmbedding,
      mockEmbedding,
      mockEmbedding,
      mockEmbedding,
    ]);

    // Mock supabase insert
    const mockInsert = jest.fn().mockResolvedValue({
      data: null,
      error: null,
      count: 6,
    });

    (supabase.from as jest.Mock).mockReturnValue({
      insert: mockInsert,
      select: jest.fn(),
    });
  });

  describe('extractAndStoreElements', () => {
    it('should extract elements from story text', async () => {
      const result = await postGenerationStorageService.extractAndStoreElements(
        {
          storyText: mockStoryText,
          storyId: mockStoryId,
          sessionId: mockSessionId,
        },
      );

      expect(
        storyElementExtractionService.extractStoryElements,
      ).toHaveBeenCalledWith(mockStoryText);
      expect(result.success).toBe(true);
    });

    it('should generate embeddings for all elements', async () => {
      await postGenerationStorageService.extractAndStoreElements({
        storyText: mockStoryText,
        storyId: mockStoryId,
        sessionId: mockSessionId,
      });

      expect(
        embeddingGenerationService.generateEmbeddingsBatch,
      ).toHaveBeenCalledWith([
        'ember',
        'wizard',
        'enchanted forest',
        'mystical mountains',
        'magical crystal',
        'discovery',
        'journey',
      ]);
    });

    it('should store elements in database with correct structure', async () => {
      const mockInsert = jest.fn().mockResolvedValue({
        data: null,
        error: null,
        count: 6,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
      });

      const result = await postGenerationStorageService.extractAndStoreElements(
        {
          storyText: mockStoryText,
          storyId: mockStoryId,
          sessionId: mockSessionId,
        },
      );

      expect(supabase.from).toHaveBeenCalledWith('story_elements');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            story_id: mockStoryId,
            session_id: mockSessionId,
            element_type: 'character',
            element_text: 'ember',
            embedding_vector: mockEmbedding,
          }),
          expect.objectContaining({
            story_id: mockStoryId,
            session_id: mockSessionId,
            element_type: 'setting',
            element_text: 'enchanted forest',
            embedding_vector: mockEmbedding,
          }),
          expect.objectContaining({
            story_id: mockStoryId,
            session_id: mockSessionId,
            element_type: 'object',
            element_text: 'magical crystal',
            embedding_vector: mockEmbedding,
          }),
          expect.objectContaining({
            story_id: mockStoryId,
            session_id: mockSessionId,
            element_type: 'plot_pattern',
            element_text: 'discovery',
            embedding_vector: mockEmbedding,
          }),
        ]),
      );

      expect(result.success).toBe(true);
      expect(result.elementsStored).toBe(6);
    });

    it('should skip embedding generation when skipEmbeddings is true', async () => {
      const result = await postGenerationStorageService.extractAndStoreElements(
        {
          storyText: mockStoryText,
          storyId: mockStoryId,
          sessionId: mockSessionId,
          skipEmbeddings: true,
        },
      );

      expect(
        embeddingGenerationService.generateEmbeddingsBatch,
      ).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should store elements with null embeddings when skipEmbeddings is true', async () => {
      const mockInsert = jest.fn().mockResolvedValue({
        data: null,
        error: null,
        count: 6,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
      });

      await postGenerationStorageService.extractAndStoreElements({
        storyText: mockStoryText,
        storyId: mockStoryId,
        sessionId: mockSessionId,
        skipEmbeddings: true,
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            element_text: 'ember',
            embedding_vector: null,
          }),
        ]),
      );
    });

    it('should continue storing elements when embedding generation fails', async () => {
      (
        embeddingGenerationService.generateEmbeddingsBatch as jest.Mock
      ).mockRejectedValue(new Error('OpenAI API error'));

      const mockInsert = jest.fn().mockResolvedValue({
        data: null,
        error: null,
        count: 6,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
      });

      const result = await postGenerationStorageService.extractAndStoreElements(
        {
          storyText: mockStoryText,
          storyId: mockStoryId,
          sessionId: mockSessionId,
        },
      );

      // Should still store elements with null embeddings
      expect(mockInsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            element_text: 'ember',
            embedding_vector: null,
          }),
        ]),
      );

      expect(result.success).toBe(true);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toContain('Embedding generation failed');
    });

    it('should handle extraction service failures gracefully', async () => {
      (
        storyElementExtractionService.extractStoryElements as jest.Mock
      ).mockRejectedValue(new Error('LLM API error'));

      const result = await postGenerationStorageService.extractAndStoreElements(
        {
          storyText: mockStoryText,
          storyId: mockStoryId,
          sessionId: mockSessionId,
        },
      );

      expect(result.success).toBe(false);
      expect(result.elementsStored).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle database insert failures gracefully', async () => {
      const mockInsert = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
        count: 0,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
      });

      const result = await postGenerationStorageService.extractAndStoreElements(
        {
          storyText: mockStoryText,
          storyId: mockStoryId,
          sessionId: mockSessionId,
        },
      );

      expect(result.success).toBe(false);
      expect(result.elementsStored).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Database storage failed');
    });

    it('should handle stories with no extracted elements', async () => {
      (
        storyElementExtractionService.extractStoryElements as jest.Mock
      ).mockResolvedValue({
        characters: [],
        settings: [],
        objects: [],
        plot_patterns: [],
      });

      const result = await postGenerationStorageService.extractAndStoreElements(
        {
          storyText: 'Short text.',
          storyId: mockStoryId,
          sessionId: mockSessionId,
        },
      );

      expect(result.success).toBe(true); // No errors, just nothing to store
      expect(result.elementsStored).toBe(0);
      expect(result.errors.length).toBe(0);
    });

    it('should include duration in result', async () => {
      const result = await postGenerationStorageService.extractAndStoreElements(
        {
          storyText: mockStoryText,
          storyId: mockStoryId,
          sessionId: mockSessionId,
        },
      );

      expect(result.duration).toBeDefined();
      expect(typeof result.duration).toBe('number');
      expect(result.duration).toBeGreaterThanOrEqual(0); // Mocked tests can be instant
    });

    it('should log progress at each step', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await postGenerationStorageService.extractAndStoreElements({
        storyText: mockStoryText,
        storyId: mockStoryId,
        sessionId: mockSessionId,
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Starting post-generation element extraction'),
        expect.any(Object),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Extracting story elements'),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Element extraction complete'),
        expect.any(Object),
      );

      consoleSpy.mockRestore();
    });

    it('should extract correct element counts for each type', async () => {
      await postGenerationStorageService.extractAndStoreElements({
        storyText: mockStoryText,
        storyId: mockStoryId,
        sessionId: mockSessionId,
      });

      const mockInsert = (supabase.from as jest.Mock).mock.results[0].value
        .insert;
      const insertedElements = mockInsert.mock.calls[0][0];

      const characterCount = insertedElements.filter(
        (e: any) => e.element_type === 'character',
      ).length;
      const settingCount = insertedElements.filter(
        (e: any) => e.element_type === 'setting',
      ).length;
      const objectCount = insertedElements.filter(
        (e: any) => e.element_type === 'object',
      ).length;
      const plotPatternCount = insertedElements.filter(
        (e: any) => e.element_type === 'plot_pattern',
      ).length;

      expect(characterCount).toBe(2);
      expect(settingCount).toBe(2);
      expect(objectCount).toBe(1);
      expect(plotPatternCount).toBe(2);
    });
  });

  describe('extractAndStoreElementsAsync', () => {
    it('should call extractAndStoreElements without awaiting', () => {
      const spy = jest
        .spyOn(postGenerationStorageService, 'extractAndStoreElements')
        .mockResolvedValue({
          success: true,
          elementsStored: 6,
          errors: [],
        });

      postGenerationStorageService.extractAndStoreElementsAsync({
        storyText: mockStoryText,
        storyId: mockStoryId,
        sessionId: mockSessionId,
      });

      expect(spy).toHaveBeenCalledWith({
        storyText: mockStoryText,
        storyId: mockStoryId,
        sessionId: mockSessionId,
      });

      spy.mockRestore();
    });

    it('should handle errors gracefully (no throw)', async () => {
      const spy = jest
        .spyOn(postGenerationStorageService, 'extractAndStoreElements')
        .mockRejectedValue(new Error('Unexpected error'));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // This should not throw
      expect(() => {
        postGenerationStorageService.extractAndStoreElementsAsync({
          storyText: mockStoryText,
          storyId: mockStoryId,
          sessionId: mockSessionId,
        });
      }).not.toThrow();

      // Wait for async error handling
      await new Promise(resolve => setTimeout(resolve, 10));

      spy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('getSessionElementStats', () => {
    it('should retrieve element statistics for a session', async () => {
      const mockData = [
        {
          element_type: 'character',
          embedding_vector: mockEmbedding,
        },
        {
          element_type: 'character',
          embedding_vector: mockEmbedding,
        },
        {
          element_type: 'setting',
          embedding_vector: null,
        },
        {
          element_type: 'object',
          embedding_vector: mockEmbedding,
        },
      ];

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockResolvedValue({
        data: mockData,
        error: null,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
        eq: mockEq,
      });

      mockSelect.mockReturnValue({
        eq: mockEq,
      });

      const stats = await postGenerationStorageService.getSessionElementStats(
        mockSessionId,
      );

      expect(supabase.from).toHaveBeenCalledWith('story_elements');
      expect(mockSelect).toHaveBeenCalledWith('element_type, embedding_vector');
      expect(mockEq).toHaveBeenCalledWith('session_id', mockSessionId);

      expect(stats.total).toBe(4);
      expect(stats.byType.character).toBe(2);
      expect(stats.byType.setting).toBe(1);
      expect(stats.byType.object).toBe(1);
      expect(stats.withEmbeddings).toBe(3);
      expect(stats.withoutEmbeddings).toBe(1);
    });

    it('should handle empty session results', async () => {
      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
      });

      mockSelect.mockReturnValue({
        eq: mockEq,
      });

      const stats = await postGenerationStorageService.getSessionElementStats(
        mockSessionId,
      );

      expect(stats.total).toBe(0);
      expect(stats.byType).toEqual({
        character: 0,
        setting: 0,
        object: 0,
        plot_pattern: 0,
      });
    });

    it('should handle database query errors', async () => {
      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Query failed' },
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
      });

      mockSelect.mockReturnValue({
        eq: mockEq,
      });

      const stats = await postGenerationStorageService.getSessionElementStats(
        mockSessionId,
      );

      expect(stats.total).toBe(0);
      expect(stats.byType).toEqual({});
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete successful flow', async () => {
      const result = await postGenerationStorageService.extractAndStoreElements(
        {
          storyText: mockStoryText,
          storyId: mockStoryId,
          sessionId: mockSessionId,
        },
      );

      expect(result.success).toBe(true);
      expect(result.elementsStored).toBeGreaterThan(0);
      expect(result.errors.length).toBe(0);
      expect(result.duration).toBeGreaterThanOrEqual(0); // Mocked tests can be instant
    });

    it('should handle partial failures with graceful degradation', async () => {
      // Embedding generation fails but extraction succeeds
      (
        embeddingGenerationService.generateEmbeddingsBatch as jest.Mock
      ).mockRejectedValue(new Error('API quota exceeded'));

      const mockInsert = jest.fn().mockResolvedValue({
        data: null,
        error: null,
        count: 6,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
      });

      const result = await postGenerationStorageService.extractAndStoreElements(
        {
          storyText: mockStoryText,
          storyId: mockStoryId,
          sessionId: mockSessionId,
        },
      );

      // Should still store elements (with null embeddings)
      expect(result.success).toBe(true);
      expect(result.elementsStored).toBe(6);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toContain('Embedding generation failed');
    });
  });
});
