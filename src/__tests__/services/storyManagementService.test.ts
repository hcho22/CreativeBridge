// Jest Tests for Story Management Service
// US-014: Updated to use Convex mocks (Supabase removed)

// Mock Convex client - must be before the import
const mockConvexMutation = jest.fn();
const mockConvexQuery = jest.fn();
const mockConvexClient = {
  mutation: mockConvexMutation,
  query: mockConvexQuery,
};

jest.mock('../../services/convex', () => ({
  getConvexClient: jest.fn(() => mockConvexClient),
  isConvexReady: jest.fn(() => true),
  api: {
    gameSessions: {
      createSession: 'gameSessions:createSession',
      createStoryContinuationSession:
        'gameSessions:createStoryContinuationSession',
      updateSession: 'gameSessions:updateSession',
      deleteSession: 'gameSessions:deleteSession',
      getSession: 'gameSessions:getSession',
      getStoryLibrary: 'gameSessions:getStoryLibrary',
      searchUserStories: 'gameSessions:searchUserStories',
    },
  },
}));

const { isConvexReady, getConvexClient } = require('../../services/convex');

import { StoryManagementService } from '../../services/storyManagementService';
import type {
  SaveStoryRequest,
  UpdateStoryRequest,
  StoryLibraryOptions,
  SearchOptions,
  FilterOptions,
} from '../../services/storyManagementService';

/**
 * Helper: create a mock Convex session document (camelCase).
 */
function createMockConvexSession(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    _id: 'conv_session_123',
    _creationTime: Date.now(),
    userId: 'conv_user_456',
    clerkUserId: 'test-user-123',
    gradeLevel: 'K-2',
    storySource: 'New',
    currentRound: 1,
    finalScore: 0,
    wordsWritten: 0,
    sentencesCompleted: 0,
    challengesCompleted: 0,
    xpEarned: 0,
    storyContent: '',
    storyMetadata: {},
    ...overrides,
  };
}

describe('StoryManagementService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isConvexReady as jest.Mock).mockReturnValue(true);
    (getConvexClient as jest.Mock).mockReturnValue(mockConvexClient);
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

        const mockSessionId = 'conv_session_new';
        const mockUpdatedSession = createMockConvexSession({
          _id: mockSessionId,
          storyContent: testStory.content,
          wordsWritten: 8,
          storySource: 'File',
          storyMetadata: { author: 'Test Author' },
        });

        // createSession then updateSession
        mockConvexMutation
          .mockResolvedValueOnce(mockSessionId) // createSession
          .mockResolvedValueOnce(mockUpdatedSession); // updateSession

        const result = await StoryManagementService.saveStory(testStory);

        expect(result.success).toBe(true);
        expect(result.sessionId).toBe(mockSessionId);
        expect(result.story).toBeDefined();
        expect(mockConvexMutation).toHaveBeenCalledTimes(2);
      });

      it('should save imported story using continuation session', async () => {
        const testStory: SaveStoryRequest = {
          content: 'Current story content',
          source: 'CreativeBridge',
          userId: 'test-user-123',
          gradeLevel: 'K-2',
          importedContent: 'Original imported story content',
          originalDate: '2024-01-01T00:00:00Z',
          metadata: { imported_word_count: 5 },
        };

        const mockSessionId = 'conv_imported_session';
        const mockConvexSession = createMockConvexSession({
          _id: mockSessionId,
          storySource: 'CreativeBridge',
          importedStoryContent: testStory.importedContent,
          originalCreationDate: testStory.originalDate,
          storyMetadata: testStory.metadata,
          wordsWritten: 5,
        });

        mockConvexMutation.mockResolvedValueOnce(mockSessionId);
        mockConvexQuery.mockResolvedValueOnce(mockConvexSession);

        const result = await StoryManagementService.saveStory(testStory);

        expect(result.success).toBe(true);
        expect(result.sessionId).toBe(mockSessionId);
        expect(result.story).toBeDefined();
        expect(mockConvexMutation).toHaveBeenCalledWith(
          'gameSessions:createStoryContinuationSession',
          expect.objectContaining({
            clerkUserId: testStory.userId,
            gradeLevel: testStory.gradeLevel,
            storySource: testStory.source,
            importedContent: testStory.importedContent,
          }),
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

        mockConvexMutation.mockRejectedValueOnce(new Error('Database error'));

        const result = await StoryManagementService.saveStory(testStory);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Database error');
      });

      it('should return error when database is not available', async () => {
        (isConvexReady as jest.Mock).mockReturnValue(false);

        const testStory: SaveStoryRequest = {
          content: 'Test story',
          source: 'File',
          userId: 'test-user-123',
          gradeLevel: 'K-2',
        };

        const result = await StoryManagementService.saveStory(testStory);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Database not available');
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

        const mockUpdatedSession = createMockConvexSession({
          _id: 'test-story-id',
          storyContent: 'Updated story content',
          finalScore: 150,
          wordsWritten: 3,
        });

        mockConvexMutation.mockResolvedValueOnce(mockUpdatedSession);

        const result = await StoryManagementService.updateStory(updateRequest);

        expect(result.success).toBe(true);
        expect(result.story).toBeDefined();
        expect(mockConvexMutation).toHaveBeenCalledWith(
          'gameSessions:updateSession',
          expect.objectContaining({
            sessionId: 'test-story-id',
          }),
        );
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

        // First call: getSession to fetch current content for merge
        const mockCurrentSession = createMockConvexSession({
          _id: 'test-story-id',
          storyContent: 'Original content',
        });

        const mockUpdatedSession = createMockConvexSession({
          _id: 'test-story-id',
          storyContent: 'Original content\n\nNew content',
          wordsWritten: 4,
        });

        mockConvexQuery.mockResolvedValueOnce(mockCurrentSession);
        mockConvexMutation.mockResolvedValueOnce(mockUpdatedSession);

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

        mockConvexMutation.mockResolvedValueOnce(null);

        const result = await StoryManagementService.updateStory(updateRequest);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Story not found or access denied');
      });
    });

    describe('deleteStory', () => {
      it('should delete story successfully', async () => {
        mockConvexMutation.mockResolvedValueOnce({ success: true });

        const result = await StoryManagementService.deleteStory(
          'story-id',
          'user-id',
        );

        expect(result.success).toBe(true);
        expect(mockConvexMutation).toHaveBeenCalledWith(
          'gameSessions:deleteSession',
          { sessionId: 'story-id' },
        );
      });

      it('should handle delete errors', async () => {
        mockConvexMutation.mockRejectedValueOnce(
          new Error('Failed to delete story from database'),
        );

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

        const mockResult = {
          stories: [
            {
              sessionId: 'story-1',
              createdAt: Date.now(),
              completedAt: null,
              gradeLevel: 'K-2',
              finalScore: 100,
              wordsWritten: 50,
              xpEarned: 150,
              storyContent: 'A story',
              storySource: 'CreativeBridge',
              generatedImageUrl: null,
              currentRound: 3,
            },
            {
              sessionId: 'story-2',
              createdAt: Date.now(),
              completedAt: null,
              gradeLevel: 'K-2',
              finalScore: 120,
              wordsWritten: 60,
              xpEarned: 180,
              storyContent: 'Another story',
              storySource: 'CreativeBridge',
              generatedImageUrl: null,
              currentRound: 5,
            },
          ],
          totalCount: 15,
          hasMore: true,
        };

        mockConvexQuery.mockResolvedValueOnce(mockResult);

        const result = await StoryManagementService.getStoryLibrary(options);

        expect(result.success).toBe(true);
        expect(result.stories).toHaveLength(2);
        expect(result.total).toBe(15);
        expect(result.hasMore).toBe(true);
      });

      it('should apply date filters', async () => {
        const options: StoryLibraryOptions = {
          userId: 'test-user-123',
          dateFrom: '2024-01-01',
          dateTo: '2024-01-31',
        };

        const mockResult = {
          stories: [],
          totalCount: 0,
          hasMore: false,
        };

        mockConvexQuery.mockResolvedValueOnce(mockResult);

        const result = await StoryManagementService.getStoryLibrary(options);

        expect(result.success).toBe(true);
        expect(mockConvexQuery).toHaveBeenCalledWith(
          'gameSessions:getStoryLibrary',
          expect.objectContaining({
            filters: expect.objectContaining({
              dateFrom: '2024-01-01',
              dateTo: '2024-01-31',
            }),
          }),
        );
      });

      it('should handle sorting options', async () => {
        const options: StoryLibraryOptions = {
          userId: 'test-user-123',
          sortBy: 'final_score',
          sortOrder: 'asc',
        };

        const mockResult = {
          stories: [],
          totalCount: 0,
          hasMore: false,
        };

        mockConvexQuery.mockResolvedValueOnce(mockResult);

        const result = await StoryManagementService.getStoryLibrary(options);

        expect(result.success).toBe(true);
        expect(mockConvexQuery).toHaveBeenCalledWith(
          'gameSessions:getStoryLibrary',
          expect.objectContaining({
            sortBy: 'finalScore',
            sortOrder: 'asc',
          }),
        );
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
            sessionId: 'story-1',
            createdAt: Date.now(),
            completedAt: '2024-01-01T01:00:00Z',
            storyContent: 'A great adventure story',
            storyExcerpt: 'A great adventure...',
            wordsWritten: 50,
            storySource: 'New',
            relevanceScore: 8,
          },
        ];

        mockConvexQuery.mockResolvedValueOnce(mockSearchResults);

        const result = await StoryManagementService.searchStories(options, 0);

        expect(result.success).toBe(true);
        expect(result.stories).toHaveLength(1);
        // Convex auth migration: searchUserStories no longer takes clerkUserId
        // explicitly — the server resolves the user from the auth context
        // (`ctx.auth.getUserIdentity()`). Same arg-drift pattern as xpEventTracker
        // fixed in PR #64. Asserting the surviving args confirms the call still
        // happens with the expected search params.
        expect(mockConvexQuery).toHaveBeenCalledWith(
          'gameSessions:searchUserStories',
          expect.objectContaining({
            searchQuery: 'adventure',
            limit: 20,
          }),
        );
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
        expect(mockConvexQuery).not.toHaveBeenCalled();
      });

      it('should filter search results by source', async () => {
        const options: SearchOptions = {
          userId: 'test-user-123',
          searchTerm: 'test',
          source: 'File',
        };

        const mockSearchResults = [
          {
            sessionId: 'story-1',
            createdAt: Date.now(),
            completedAt: '2024-01-01T01:00:00Z',
            storyContent: 'Test story from file',
            storyExcerpt: 'Test story...',
            wordsWritten: 50,
            storySource: 'File',
            relevanceScore: 8,
          },
          {
            sessionId: 'story-2',
            createdAt: Date.now(),
            completedAt: '2024-01-02T01:00:00Z',
            storyContent: 'Test story from CreativeBridge',
            storyExcerpt: 'Test story...',
            wordsWritten: 60,
            storySource: 'CreativeBridge',
            relevanceScore: 6,
          },
        ];

        mockConvexQuery.mockResolvedValueOnce(mockSearchResults);

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

        const mockResult = {
          stories: [
            {
              sessionId: 'story-1',
              createdAt: Date.now(),
              completedAt: null,
              gradeLevel: 'K-2',
              finalScore: 100,
              wordsWritten: 50,
              xpEarned: 150,
              storyContent: 'A story',
              storySource: 'CreativeBridge',
              generatedImageUrl: null,
              currentRound: 3,
            },
          ],
          totalCount: 1,
          hasMore: false,
        };

        mockConvexQuery.mockResolvedValueOnce(mockResult);

        const result = await StoryManagementService.filterStories(options);

        expect(result.success).toBe(true);
        expect(result.stories).toHaveLength(1);
        expect(mockConvexQuery).toHaveBeenCalledWith(
          'gameSessions:getStoryLibrary',
          expect.objectContaining({
            filters: expect.objectContaining({
              storySource: 'CreativeBridge',
            }),
          }),
        );
      });

      it('should filter by word count range', async () => {
        const options: FilterOptions = {
          userId: 'test-user-123',
          minWords: 50,
          maxWords: 200,
        };

        const mockResult = {
          stories: [],
          totalCount: 0,
          hasMore: false,
        };

        mockConvexQuery.mockResolvedValueOnce(mockResult);

        const result = await StoryManagementService.filterStories(options);

        expect(result.success).toBe(true);
        expect(mockConvexQuery).toHaveBeenCalledWith(
          'gameSessions:getStoryLibrary',
          expect.objectContaining({
            filters: expect.objectContaining({
              minWords: 50,
              maxWords: 200,
            }),
          }),
        );
      });

      it('should filter completed stories only', async () => {
        const options: FilterOptions = {
          userId: 'test-user-123',
          completedOnly: true,
        };

        const mockResult = {
          stories: [],
          totalCount: 0,
          hasMore: false,
        };

        mockConvexQuery.mockResolvedValueOnce(mockResult);

        const result = await StoryManagementService.filterStories(options);

        expect(result.success).toBe(true);
        expect(mockConvexQuery).toHaveBeenCalledWith(
          'gameSessions:getStoryLibrary',
          expect.objectContaining({
            filters: expect.objectContaining({
              completedOnly: true,
            }),
          }),
        );
      });
    });
  });

  describe('Story Editing', () => {
    it('should edit story content directly', async () => {
      const sessionId = 'test-story-id';
      const userId = 'test-user-123';
      const newContent = 'This is the edited story content.';
      const metadata = { edited: true, edit_date: new Date().toISOString() };

      const mockUpdatedSession = createMockConvexSession({
        _id: sessionId,
        storyContent: newContent,
        wordsWritten: 7,
        storyMetadata: metadata,
      });

      mockConvexMutation.mockResolvedValueOnce(mockUpdatedSession);

      const result = await StoryManagementService.editStoryContent(
        sessionId,
        userId,
        newContent,
        metadata,
      );

      expect(result.success).toBe(true);
      expect(result.story?.story_content).toBe(newContent);
      expect(result.story?.words_written).toBe(7);
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

      const mockResult = {
        stories: [
          {
            sessionId: 'story-1',
            createdAt: new Date('2024-01-01').getTime(),
            completedAt: '2024-01-01T01:00:00Z',
            gradeLevel: 'K-2',
            finalScore: 100,
            wordsWritten: 50,
            xpEarned: 150,
            storyContent: 'Story one',
            storySource: 'CreativeBridge',
            generatedImageUrl: null,
            currentRound: 5,
          },
          {
            sessionId: 'story-2',
            createdAt: new Date('2024-01-02').getTime(),
            completedAt: null,
            gradeLevel: '3-5',
            finalScore: 120,
            wordsWritten: 75,
            xpEarned: 200,
            storyContent: 'Story two',
            storySource: 'CreativeBridge',
            generatedImageUrl: null,
            currentRound: 3,
          },
        ],
        totalCount: 2,
        hasMore: false,
      };

      mockConvexQuery.mockResolvedValueOnce(mockResult);

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
