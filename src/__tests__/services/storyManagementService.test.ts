// Jest Tests for Task 4: Create Story Management API

import type {
  GameSession,
  StorySource,
  GradeLevel,
} from '../../types/database';

// Mock supabase - must be before the import
const mockSupabaseFrom = jest.fn();
const mockSupabaseRpc = jest.fn();
const mockSupabase = {
  from: mockSupabaseFrom,
  rpc: mockSupabaseRpc,
};

jest.mock('../../services/supabase', () => ({
  supabase: mockSupabase,
}));

import { StoryManagementService } from '../../services/storyManagementService';
import type {
  SaveStoryRequest,
  UpdateStoryRequest,
  StoryLibraryOptions,
  SearchOptions,
  FilterOptions,
} from '../../services/storyManagementService';

describe('StoryManagementService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear any pending debounce timers
    StoryManagementService.clearSearchTimers();
  });

  describe('Story CRUD Operations', () => {
    describe('saveStory', () => {
      it('should save story to database', async () => {
        const testStory: SaveStoryRequest = {
          content: 'This is a test story content for saving.',
          source: 'File',
          userId: 'test-user-123',
          gradeLevel: 'K-2',
          metadata: { author: 'Test Author' },
        };

        const mockCreatedStory: GameSession = {
          id: 'story-session-123',
          user_id: 'test-user-123',
          created_at: new Date().toISOString(),
          grade_level: 'K-2',
          final_score: 0,
          words_written: 8,
          sentences_completed: 0,
          challenges_completed: 0,
          xp_earned: 0,
          story_content: testStory.content,
          story_source: 'File',
          story_metadata: { author: 'Test Author' },
        };

        const mockQuery = {
          insert: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest
            .fn()
            .mockResolvedValue({ data: mockCreatedStory, error: null }),
        };

        mockSupabaseFrom.mockReturnValue(mockQuery);

        const result = await StoryManagementService.saveStory(testStory);

        expect(result.success).toBe(true);
        expect(result.story).toEqual(mockCreatedStory);
        expect(result.sessionId).toBe('story-session-123');
        expect(mockSupabaseFrom).toHaveBeenCalledWith('game_sessions');
      });

      it('should save imported story using database function', async () => {
        const testStory: SaveStoryRequest = {
          content: 'Current story content',
          source: 'CreativeBridge',
          userId: 'test-user-123',
          gradeLevel: 'K-2',
          importedContent: 'Original imported story content',
          originalDate: '2024-01-01T00:00:00Z',
          metadata: { imported_word_count: 5 },
        };

        const sessionId = 'imported-session-123';
        const mockImportedStory: GameSession = {
          id: sessionId,
          user_id: 'test-user-123',
          created_at: new Date().toISOString(),
          grade_level: 'K-2',
          final_score: 0,
          words_written: 5,
          sentences_completed: 0,
          challenges_completed: 0,
          xp_earned: 0,
          story_content: testStory.content,
          story_source: 'CreativeBridge',
          imported_story_content: testStory.importedContent,
          original_creation_date: testStory.originalDate,
          story_metadata: testStory.metadata,
        };

        // Mock RPC call for creating story continuation session
        mockSupabaseRpc.mockResolvedValue({ data: sessionId, error: null });

        // Mock fetching the created session
        const mockQuery = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest
            .fn()
            .mockResolvedValue({ data: mockImportedStory, error: null }),
        };
        mockSupabaseFrom.mockReturnValue(mockQuery);

        const result = await StoryManagementService.saveStory(testStory);

        expect(result.success).toBe(true);
        expect(result.story).toEqual(mockImportedStory);
        expect(result.sessionId).toBe(sessionId);
        expect(mockSupabaseRpc).toHaveBeenCalledWith(
          'create_story_continuation_session',
          {
            p_user_id: testStory.userId,
            p_grade_level: testStory.gradeLevel,
            p_story_source: testStory.source,
            p_imported_content: testStory.importedContent,
            p_original_date: testStory.originalDate,
            p_metadata: testStory.metadata,
          },
        );
      });

      it('should handle validation errors', async () => {
        const invalidStory: SaveStoryRequest = {
          content: '',
          source: 'File',
          userId: '',
          gradeLevel: 'K-2',
        };

        const result = await StoryManagementService.saveStory(invalidStory);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Missing required fields');
      });

      it('should handle database errors', async () => {
        const testStory: SaveStoryRequest = {
          content: 'Test story',
          source: 'File',
          userId: 'test-user-123',
          gradeLevel: 'K-2',
        };

        const mockQuery = {
          insert: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' },
          }),
        };

        mockSupabaseFrom.mockReturnValue(mockQuery);

        const result = await StoryManagementService.saveStory(testStory);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Failed to save story to database');
      });
    });

    describe('updateStory', () => {
      it('should update existing story', async () => {
        const updateRequest: UpdateStoryRequest = {
          sessionId: 'test-story-id',
          userId: 'test-user-123',
          updates: {
            content: 'Updated story content',
            final_score: 150,
          },
        };

        const mockCurrentStory: GameSession = {
          id: 'test-story-id',
          user_id: 'test-user-123',
          created_at: '2024-01-01T00:00:00Z',
          grade_level: 'K-2',
          final_score: 100,
          words_written: 5,
          sentences_completed: 2,
          challenges_completed: 1,
          xp_earned: 50,
          story_content: 'Original content',
          story_source: 'New',
          story_metadata: {},
        };

        const mockUpdatedStory: GameSession = {
          ...mockCurrentStory,
          story_content: 'Updated story content',
          final_score: 150,
          words_written: 3,
        };

        // Mock fetch current story
        const mockFetchQuery = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest
            .fn()
            .mockResolvedValue({ data: mockCurrentStory, error: null }),
        };

        // Mock update story
        const mockUpdateQuery = {
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest
            .fn()
            .mockResolvedValue({ data: mockUpdatedStory, error: null }),
        };

        mockSupabaseFrom
          .mockReturnValueOnce(mockFetchQuery)
          .mockReturnValueOnce(mockUpdateQuery);

        const result = await StoryManagementService.updateStory(updateRequest);

        expect(result.success).toBe(true);
        expect(result.story).toEqual(mockUpdatedStory);
      });

      it('should handle merge conflict resolution', async () => {
        const updateRequest: UpdateStoryRequest = {
          sessionId: 'test-story-id',
          userId: 'test-user-123',
          updates: { content: 'New content' },
        };

        const conflictStrategy = {
          strategy: 'merge_content' as const,
          mergeFunction: (original: string, updated: string) =>
            `${original}\n\n${updated}`,
        };

        const mockCurrentStory: GameSession = {
          id: 'test-story-id',
          user_id: 'test-user-123',
          created_at: '2024-01-01T00:00:00Z',
          grade_level: 'K-2',
          final_score: 100,
          words_written: 5,
          sentences_completed: 2,
          challenges_completed: 1,
          xp_earned: 50,
          story_content: 'Original content',
          story_source: 'New',
          story_metadata: {},
        };

        const mockUpdatedStory: GameSession = {
          ...mockCurrentStory,
          story_content: 'Original content\n\nNew content',
          words_written: 4,
        };

        // Mock fetch and update queries
        const mockFetchQuery = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest
            .fn()
            .mockResolvedValue({ data: mockCurrentStory, error: null }),
        };

        const mockUpdateQuery = {
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest
            .fn()
            .mockResolvedValue({ data: mockUpdatedStory, error: null }),
        };

        mockSupabaseFrom
          .mockReturnValueOnce(mockFetchQuery)
          .mockReturnValueOnce(mockUpdateQuery);

        const result = await StoryManagementService.updateStory(
          updateRequest,
          conflictStrategy,
        );

        expect(result.success).toBe(true);
        expect(result.story?.story_content).toBe(
          'Original content\n\nNew content',
        );
      });

      it('should handle story not found', async () => {
        const updateRequest: UpdateStoryRequest = {
          sessionId: 'nonexistent-story',
          userId: 'test-user-123',
          updates: { content: 'Updated content' },
        };

        const mockQuery = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest
            .fn()
            .mockResolvedValue({ data: null, error: { message: 'Not found' } }),
        };

        mockSupabaseFrom.mockReturnValue(mockQuery);

        const result = await StoryManagementService.updateStory(updateRequest);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Story not found or access denied');
      });
    });

    describe('deleteStory', () => {
      it('should delete story successfully', async () => {
        const mockQuery = {
          delete: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis().mockResolvedValue({ error: null }),
        };

        mockSupabaseFrom.mockReturnValue(mockQuery);

        const result = await StoryManagementService.deleteStory(
          'story-id',
          'user-id',
        );

        expect(result.success).toBe(true);
        expect(mockQuery.delete).toHaveBeenCalled();
        expect(mockQuery.eq).toHaveBeenCalledWith('id', 'story-id');
        expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'user-id');
      });

      it('should handle delete errors', async () => {
        const mockQuery = {
          delete: jest.fn().mockReturnThis(),
          eq: jest
            .fn()
            .mockReturnThis()
            .mockResolvedValue({ error: { message: 'Delete failed' } }),
        };

        mockSupabaseFrom.mockReturnValue(mockQuery);

        const result = await StoryManagementService.deleteStory(
          'story-id',
          'user-id',
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe('Failed to delete story from database');
      });
    });
  });

  describe('Story Library and Querying', () => {
    describe('getStoryLibrary', () => {
      it('should fetch user story library with pagination', async () => {
        const options: StoryLibraryOptions = {
          userId: 'test-user-123',
          limit: 10,
          offset: 0,
          source: 'CreativeBridge',
        };

        const mockStories: GameSession[] = [
          {
            id: 'story-1',
            user_id: 'test-user-123',
            created_at: '2024-01-01T00:00:00Z',
            grade_level: 'K-2',
            final_score: 100,
            words_written: 50,
            sentences_completed: 5,
            challenges_completed: 3,
            xp_earned: 150,
            story_source: 'CreativeBridge',
            story_metadata: {},
          },
          {
            id: 'story-2',
            user_id: 'test-user-123',
            created_at: '2024-01-02T00:00:00Z',
            grade_level: 'K-2',
            final_score: 120,
            words_written: 60,
            sentences_completed: 6,
            challenges_completed: 4,
            xp_earned: 180,
            story_source: 'CreativeBridge',
            story_metadata: {},
          },
        ];

        const mockQuery = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          range: jest.fn().mockReturnThis().mockResolvedValue({
            data: mockStories,
            error: null,
            count: 15,
          }),
        };

        mockSupabaseFrom.mockReturnValue(mockQuery);

        const result = await StoryManagementService.getStoryLibrary(options);

        expect(result.success).toBe(true);
        expect(result.stories).toEqual(mockStories);
        expect(result.total).toBe(15);
        expect(result.hasMore).toBe(true);
        expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'test-user-123');
        expect(mockQuery.eq).toHaveBeenCalledWith(
          'story_source',
          'CreativeBridge',
        );
      });

      it('should apply date filters', async () => {
        const options: StoryLibraryOptions = {
          userId: 'test-user-123',
          dateFrom: '2024-01-01',
          dateTo: '2024-01-31',
        };

        const mockQuery = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          range: jest.fn().mockReturnThis().mockResolvedValue({
            data: [],
            error: null,
            count: 0,
          }),
        };

        mockSupabaseFrom.mockReturnValue(mockQuery);

        await StoryManagementService.getStoryLibrary(options);

        expect(mockQuery.gte).toHaveBeenCalledWith('created_at', '2024-01-01');
        expect(mockQuery.lte).toHaveBeenCalledWith('created_at', '2024-01-31');
      });

      it('should handle sorting options', async () => {
        const options: StoryLibraryOptions = {
          userId: 'test-user-123',
          sortBy: 'final_score',
          sortOrder: 'asc',
        };

        const mockQuery = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          range: jest.fn().mockReturnThis().mockResolvedValue({
            data: [],
            error: null,
            count: 0,
          }),
        };

        mockSupabaseFrom.mockReturnValue(mockQuery);

        await StoryManagementService.getStoryLibrary(options);

        expect(mockQuery.order).toHaveBeenCalledWith('final_score', {
          ascending: true,
        });
      });
    });
  });

  describe('Search and Filtering', () => {
    describe('searchStories', () => {
      it('should search stories by content with debouncing', async () => {
        const options: SearchOptions = {
          userId: 'test-user-123',
          searchTerm: 'adventure',
          limit: 20,
        };

        const mockSearchResults = [
          {
            session_id: 'story-1',
            created_at: '2024-01-01T00:00:00Z',
            completed_at: '2024-01-01T01:00:00Z',
            story_content: 'A great adventure story',
            story_excerpt: 'A great adventure...',
            words_written: 50,
            story_source: 'New',
            relevance_score: 0.85,
          },
        ];

        mockSupabaseRpc.mockResolvedValue({
          data: mockSearchResults,
          error: null,
        });

        const result = await StoryManagementService.searchStories(options, 0); // No debounce for test

        expect(result.success).toBe(true);
        expect(result.stories).toEqual(mockSearchResults);
        expect(mockSupabaseRpc).toHaveBeenCalledWith('search_user_stories', {
          p_user_id: 'test-user-123',
          p_search_term: 'adventure',
          p_limit: 20,
        });
      });

      it('should return empty results for empty search term', async () => {
        const options: SearchOptions = {
          userId: 'test-user-123',
          searchTerm: '   ',
        };

        const result = await StoryManagementService.searchStories(options, 0);

        expect(result.success).toBe(true);
        expect(result.stories).toEqual([]);
        expect(result.total).toBe(0);
        expect(mockSupabaseRpc).not.toHaveBeenCalled();
      });

      it('should filter search results by source', async () => {
        const options: SearchOptions = {
          userId: 'test-user-123',
          searchTerm: 'test',
          source: 'File',
        };

        const mockSearchResults = [
          {
            session_id: 'story-1',
            created_at: '2024-01-01T00:00:00Z',
            completed_at: '2024-01-01T01:00:00Z',
            story_content: 'Test story from file',
            story_excerpt: 'Test story...',
            words_written: 50,
            story_source: 'File',
            relevance_score: 0.85,
          },
          {
            session_id: 'story-2',
            created_at: '2024-01-02T00:00:00Z',
            completed_at: '2024-01-02T01:00:00Z',
            story_content: 'Test story from CreativeBridge',
            story_excerpt: 'Test story...',
            words_written: 60,
            story_source: 'CreativeBridge',
            relevance_score: 0.8,
          },
        ];

        mockSupabaseRpc.mockResolvedValue({
          data: mockSearchResults,
          error: null,
        });

        const result = await StoryManagementService.searchStories(options, 0);

        expect(result.success).toBe(true);
        expect(result.stories).toHaveLength(1);
        expect(result.stories?.[0].story_source).toBe('File');
      });
    });

    describe('filterStories', () => {
      it('should filter stories by source', async () => {
        const options: FilterOptions = {
          userId: 'test-user-123',
          source: 'CreativeBridge',
        };

        const mockStories: GameSession[] = [
          {
            id: 'story-1',
            user_id: 'test-user-123',
            created_at: '2024-01-01T00:00:00Z',
            grade_level: 'K-2',
            final_score: 100,
            words_written: 50,
            sentences_completed: 5,
            challenges_completed: 3,
            xp_earned: 150,
            story_source: 'CreativeBridge',
            story_metadata: {},
          },
        ];

        const mockQuery = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          not: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          range: jest.fn().mockReturnThis().mockResolvedValue({
            data: mockStories,
            error: null,
            count: 1,
          }),
        };

        mockSupabaseFrom.mockReturnValue(mockQuery);

        const result = await StoryManagementService.filterStories(options);

        expect(result.success).toBe(true);
        expect(result.stories).toEqual(mockStories);
        expect(mockQuery.eq).toHaveBeenCalledWith(
          'story_source',
          'CreativeBridge',
        );
      });

      it('should filter by word count range', async () => {
        const options: FilterOptions = {
          userId: 'test-user-123',
          minWords: 50,
          maxWords: 200,
        };

        const mockQuery = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          range: jest.fn().mockReturnThis().mockResolvedValue({
            data: [],
            error: null,
            count: 0,
          }),
        };

        mockSupabaseFrom.mockReturnValue(mockQuery);

        await StoryManagementService.filterStories(options);

        expect(mockQuery.gte).toHaveBeenCalledWith('words_written', 50);
        expect(mockQuery.lte).toHaveBeenCalledWith('words_written', 200);
      });

      it('should filter completed stories only', async () => {
        const options: FilterOptions = {
          userId: 'test-user-123',
          completedOnly: true,
        };

        const mockQuery = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          not: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          range: jest.fn().mockReturnThis().mockResolvedValue({
            data: [],
            error: null,
            count: 0,
          }),
        };

        mockSupabaseFrom.mockReturnValue(mockQuery);

        await StoryManagementService.filterStories(options);

        expect(mockQuery.not).toHaveBeenCalledWith('completed_at', 'is', null);
      });
    });
  });

  describe('Story Editing', () => {
    it('should edit story content directly', async () => {
      const sessionId = 'test-story-id';
      const userId = 'test-user-123';
      const newContent = 'This is the edited story content.';
      const metadata = { edited: true, edit_date: new Date().toISOString() };

      const mockCurrentStory: GameSession = {
        id: sessionId,
        user_id: userId,
        created_at: '2024-01-01T00:00:00Z',
        grade_level: 'K-2',
        final_score: 100,
        words_written: 5,
        sentences_completed: 2,
        challenges_completed: 1,
        xp_earned: 50,
        story_content: 'Original content',
        story_source: 'New',
        story_metadata: {},
      };

      const mockUpdatedStory: GameSession = {
        ...mockCurrentStory,
        story_content: newContent,
        words_written: 7,
        story_metadata: metadata,
      };

      // Mock fetch and update queries
      const mockFetchQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest
          .fn()
          .mockResolvedValue({ data: mockCurrentStory, error: null }),
      };

      const mockUpdateQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest
          .fn()
          .mockResolvedValue({ data: mockUpdatedStory, error: null }),
      };

      mockSupabaseFrom
        .mockReturnValueOnce(mockFetchQuery)
        .mockReturnValueOnce(mockUpdateQuery);

      const result = await StoryManagementService.editStoryContent(
        sessionId,
        userId,
        newContent,
        metadata,
      );

      expect(result.success).toBe(true);
      expect(result.story?.story_content).toBe(newContent);
      expect(result.story?.words_written).toBe(7);
      expect(result.story?.story_metadata).toEqual(metadata);
    });
  });

  describe('Utility Functions', () => {
    it('should merge story content correctly', () => {
      const original = 'Once upon a time, there was a brave knight.';
      const updated = 'The knight embarked on a great adventure.';

      const merged = StoryManagementService.mergeStoryContent(
        original,
        updated,
      );

      expect(merged).toContain(original);
      expect(merged).toContain(updated);
      expect(merged).toContain('--- Continued ---');
    });

    it('should handle empty content in merge', () => {
      const original = '';
      const updated = 'New content';

      const merged = StoryManagementService.mergeStoryContent(
        original,
        updated,
      );

      expect(merged).toBe('New content');
    });

    it('should get user story statistics', async () => {
      const userId = 'test-user-123';
      const mockStories: GameSession[] = [
        {
          id: 'story-1',
          user_id: userId,
          created_at: '2024-01-01T00:00:00Z',
          completed_at: '2024-01-01T01:00:00Z',
          grade_level: 'K-2',
          final_score: 100,
          words_written: 50,
          sentences_completed: 5,
          challenges_completed: 3,
          xp_earned: 150,
          story_source: 'CreativeBridge',
          story_metadata: {},
        },
        {
          id: 'story-2',
          user_id: userId,
          created_at: '2024-01-02T00:00:00Z',
          grade_level: '3-5',
          final_score: 120,
          words_written: 75,
          sentences_completed: 8,
          challenges_completed: 5,
          xp_earned: 200,
          story_source: 'CreativeBridge',
          story_metadata: {},
        },
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest
          .fn()
          .mockReturnThis()
          .mockResolvedValue({ data: mockStories, error: null }),
      };

      mockSupabaseFrom.mockReturnValue(mockQuery);

      const result = await StoryManagementService.getUserStoryStats(userId);

      expect(result.success).toBe(true);
      expect(result.stats?.totalStories).toBe(2);
      expect(result.stats?.completedStories).toBe(1);
      expect(result.stats?.totalWords).toBe(125);
      expect(result.stats?.averageScore).toBe(110);
      expect(result.stats?.favoriteSource).toBe('CreativeBridge');
    });

    it('should retry operations with exponential backoff', async () => {
      let attempts = 0;
      const operation = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return Promise.resolve('Success');
      });

      const result = await StoryManagementService.withRetry(operation, {
        maxRetries: 3,
        delay: 10,
        exponentialBackoff: true,
      });

      expect(result).toBe('Success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      const operation = jest
        .fn()
        .mockRejectedValue(new Error('Persistent failure'));

      await expect(
        StoryManagementService.withRetry(operation, {
          maxRetries: 2,
          delay: 10,
          exponentialBackoff: false,
        }),
      ).rejects.toThrow('Persistent failure');

      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should clear search timers', () => {
      // This is mainly for coverage and cleanup
      expect(() => StoryManagementService.clearSearchTimers()).not.toThrow();
    });
  });
});
