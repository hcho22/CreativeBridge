// Jest Tests for Task 3: Create Story Import Service

import type {
  ImportableStory,
  SearchableStory,
  StorySource,
} from '../../types/database';

// Mock react-native-fs 
jest.mock('react-native-fs', () => ({
  exists: jest.fn(),
  stat: jest.fn(),
  readFile: jest.fn(),
  unlink: jest.fn(),
}));

// Import RNFS after mocking to get the mocked version
import RNFS from 'react-native-fs';
const mockRNFS = RNFS as jest.Mocked<typeof RNFS>;

// Mock supabase - must be before the import
const mockSupabaseRpc = jest.fn();
jest.mock('../../services/supabase', () => ({
  supabase: {
    rpc: mockSupabaseRpc,
  },
}));

import { StoryImportService } from '../../services/storyImportService';

describe('StoryImportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('File Reading Functionality', () => {
    it('should read txt file content correctly', async () => {
      const mockFileUri = '/mock/path/test.txt';
      const mockContent =
        'This is a test story content with multiple words to test.';
      const mockStats = { size: 1024 };

      mockRNFS.exists.mockResolvedValue(true);
      mockRNFS.stat.mockResolvedValue(mockStats);
      mockRNFS.readFile.mockResolvedValue(mockContent);

      const result = await StoryImportService.readTextFile(mockFileUri);

      expect(result.success).toBe(true);
      expect(result.content).toBe(mockContent);
      expect(result.metadata).toBeDefined();
      if (result.metadata) {
        expect(result.metadata.file_name).toBe('test.txt');
        expect(result.metadata.file_size).toBe(1024);
        expect(result.metadata.encoding).toBe('utf-8');
        expect(result.metadata.imported_word_count).toBe(11);
      }
    });

    it('should handle file not found error', async () => {
      const mockFileUri = '/mock/path/nonexistent.txt';

      mockRNFS.exists.mockResolvedValue(false);

      const result = await StoryImportService.readTextFile(mockFileUri);

      expect(result.success).toBe(false);
      expect(result.error).toBe('File not found');
      expect(result.content).toBeUndefined();
    });

    it('should handle file too large error', async () => {
      const mockFileUri = '/mock/path/large.txt';
      const mockStats = { size: 11 * 1024 * 1024 }; // 11MB, over the 10MB limit

      mockRNFS.exists.mockResolvedValue(true);
      mockRNFS.stat.mockResolvedValue(mockStats);

      const result = await StoryImportService.readTextFile(mockFileUri);

      expect(result.success).toBe(false);
      expect(result.error).toBe('File too large. Maximum size is 10MB.');
    });

    it('should handle file reading errors gracefully', async () => {
      const mockFileUri = '/mock/path/error.txt';

      mockRNFS.exists.mockResolvedValue(true);
      mockRNFS.stat.mockResolvedValue({ size: 1024 });
      mockRNFS.readFile.mockRejectedValue(new Error('Permission denied'));

      const result = await StoryImportService.readTextFile(mockFileUri);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission denied');
    });
  });

  describe('Encoding Detection and Fallback', () => {
    it('should use UTF-8 encoding when content is valid', async () => {
      const mockFileUri = '/mock/path/utf8.txt';
      const mockContent = 'Valid UTF-8 content with special chars: café, naïve';
      const mockStats = { size: 512 };

      mockRNFS.exists.mockResolvedValue(true);
      mockRNFS.stat.mockResolvedValue(mockStats);
      mockRNFS.readFile.mockResolvedValue(mockContent);

      const result = await StoryImportService.readFileWithEncoding(mockFileUri);

      expect(result.success).toBe(true);
      expect(result.content).toBe(mockContent);
      if (result.metadata) {
        expect(result.metadata.encoding).toBe('utf-8');
      }
    });

    it('should fallback to ASCII when UTF-8 fails', async () => {
      const mockFileUri = '/mock/path/ascii.txt';
      const mockContent = 'ASCII content without special characters';
      const mockStats = { size: 256 };

      mockRNFS.exists.mockResolvedValue(true);
      mockRNFS.stat.mockResolvedValue(mockStats);
      mockRNFS.readFile
        .mockResolvedValueOnce('\uFFFD\uFFFD Invalid UTF-8') // First call fails with replacement chars
        .mockResolvedValueOnce(mockContent); // Second call (ASCII) succeeds

      const result = await StoryImportService.readFileWithEncoding(mockFileUri);

      expect(result.success).toBe(true);
      expect(result.content).toBe(mockContent);
      if (result.metadata) {
        expect(result.metadata.encoding).toBe('ascii');
      }
    });

    it('should handle encoding failure for both UTF-8 and ASCII', async () => {
      const mockFileUri = '/mock/path/unreadable.txt';

      mockRNFS.exists.mockResolvedValue(true);
      mockRNFS.stat.mockResolvedValue({ size: 256 });
      mockRNFS.readFile.mockRejectedValue(new Error('Encoding error'));

      const result = await StoryImportService.readFileWithEncoding(mockFileUri);

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'Unable to read file with supported encodings (UTF-8, ASCII)',
      );
    });
  });

  describe('Database Story Fetching', () => {
    it('should fetch user stories from database', async () => {
      const mockUserId = 'user-123';
      const mockStories: ImportableStory[] = [
        {
          session_id: 'session-1',
          created_at: '2024-01-01T00:00:00Z',
          completed_at: '2024-01-01T01:00:00Z',
          story_content: 'First completed story content',
          final_score: 100,
          words_written: 50,
          story_source: 'New',
          story_metadata: { genre: 'adventure' },
        },
        {
          session_id: 'session-2',
          created_at: '2024-01-02T00:00:00Z',
          completed_at: '2024-01-02T01:00:00Z',
          story_content: 'Second completed story content',
          final_score: 150,
          words_written: 75,
          story_source: 'CreativeBridge',
          story_metadata: { genre: 'fantasy' },
        },
      ];

      mockSupabaseRpc.mockResolvedValue({ data: mockStories, error: null });

      const result = await StoryImportService.fetchUserStories(mockUserId);

      expect(result.success).toBe(true);
      expect(result.stories).toEqual(mockStories);
      expect(result.total).toBe(2);
      expect(mockSupabaseRpc).toHaveBeenCalledWith(
        'get_user_importable_stories',
        {
          p_user_id: mockUserId,
          p_limit: 50,
          p_offset: 0,
        },
      );
    });

    it('should handle pagination correctly', async () => {
      const mockUserId = 'user-123';
      const limit = 10;
      const offset = 20;

      mockSupabaseRpc.mockResolvedValue({ data: [], error: null });

      await StoryImportService.fetchUserStories(mockUserId, limit, offset);

      expect(mockSupabaseRpc).toHaveBeenCalledWith(
        'get_user_importable_stories',
        {
          p_user_id: mockUserId,
          p_limit: limit,
          p_offset: offset,
        },
      );
    });

    it('should handle database fetch errors', async () => {
      const mockUserId = 'user-123';
      const mockError = { message: 'Database connection failed' };

      mockSupabaseRpc.mockResolvedValue({ data: null, error: mockError });

      const result = await StoryImportService.fetchUserStories(mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to fetch stories from database');
      expect(result.stories).toBeUndefined();
    });

    it('should handle network errors gracefully', async () => {
      const mockUserId = 'user-123';

      mockSupabaseRpc.mockRejectedValue(new Error('Network error'));

      const result = await StoryImportService.fetchUserStories(mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('Story Search Functionality', () => {
    it('should search stories by content', async () => {
      const mockUserId = 'user-123';
      const searchTerm = 'adventure';
      const mockSearchResults: SearchableStory[] = [
        {
          session_id: 'session-1',
          created_at: '2024-01-01T00:00:00Z',
          completed_at: '2024-01-01T01:00:00Z',
          story_content: 'A great adventure story about dragons',
          story_excerpt: 'A great adventure story about...',
          words_written: 50,
          story_source: 'New',
          relevance_score: 0.85,
        },
      ];

      mockSupabaseRpc.mockResolvedValue({
        data: mockSearchResults,
        error: null,
      });

      const result = await StoryImportService.searchUserStories(
        mockUserId,
        searchTerm,
      );

      expect(result.success).toBe(true);
      expect(result.stories).toEqual(mockSearchResults);
      expect(mockSupabaseRpc).toHaveBeenCalledWith('search_user_stories', {
        p_user_id: mockUserId,
        p_search_term: searchTerm,
        p_limit: 20,
      });
    });

    it('should return empty results for empty search term', async () => {
      const mockUserId = 'user-123';
      const emptySearchTerm = '   ';

      const result = await StoryImportService.searchUserStories(
        mockUserId,
        emptySearchTerm,
      );

      expect(result.success).toBe(true);
      expect(result.stories).toEqual([]);
      expect(mockSupabaseRpc).not.toHaveBeenCalled();
    });

    it('should handle search errors', async () => {
      const mockUserId = 'user-123';
      const searchTerm = 'test';
      const mockError = { message: 'Search failed' };

      mockSupabaseRpc.mockResolvedValue({ data: null, error: mockError });

      const result = await StoryImportService.searchUserStories(
        mockUserId,
        searchTerm,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to search stories');
    });
  });

  describe('Story Content Validation', () => {
    it('should validate valid story content', () => {
      const validContent =
        'This is a valid story with enough content to be considered meaningful.';
      const result = StoryImportService.validateStoryContent(validContent);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty content', () => {
      const emptyContent = '';
      const result = StoryImportService.validateStoryContent(emptyContent);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Story content cannot be empty');
    });

    it('should reject content too short', () => {
      const shortContent = 'Short';
      const result = StoryImportService.validateStoryContent(shortContent);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Story content must be at least 10 characters long',
      );
    });

    it('should reject content too long', () => {
      const longContent = 'x'.repeat(100001); // Over 100KB limit
      const result = StoryImportService.validateStoryContent(longContent);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Story content cannot exceed 100,000 characters',
      );
    });

    it('should warn about very short stories', () => {
      const shortButValidContent = 'A very short story.';
      const result =
        StoryImportService.validateStoryContent(shortButValidContent);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        'Story is very short (less than 5 words)',
      );
    });

    it('should warn about potentially corrupted content', () => {
      const corruptedContent =
        'Story with replacement chars: \uFFFD\uFFFD\uFFFD';
      const result = StoryImportService.validateStoryContent(corruptedContent);

      expect(result.isValid).toBe(true); // Still valid, just warning
      expect(result.warnings).toContain(
        'Content may contain encoding issues or corrupted characters',
      );
    });
  });

  describe('Story Processing and Metadata', () => {
    it('should process story for import correctly', () => {
      const content = 'This is a test story content for processing.';
      const source: StorySource = 'File';
      const metadata = { author: 'Test Author', title: 'Test Story' };

      const result = StoryImportService.processStoryForImport(
        content,
        source,
        metadata,
      );

      expect(result.source).toBe(source);
      expect(result.content).toBe(content);
      expect(result.metadata.imported_word_count).toBe(8);
      expect(result.metadata.author).toBe('Test Author');
      expect(result.metadata.title).toBe('Test Story');
      expect(result.metadata.import_date).toBeDefined();
    });

    it('should extract metadata from story content', () => {
      const content =
        'The Great Adventure\n\nOnce upon a time, there was a brave knight who went on a quest.';
      const fileName = 'adventure.txt';

      const metadata = StoryImportService.extractMetadata(content, fileName);

      expect(metadata.imported_word_count).toBe(17); // Correct word count
      expect(metadata.character_count).toBe(content.length);
      expect(metadata.line_count).toBe(3);
      expect(metadata.file_name).toBe(fileName);
      expect(metadata.title).toBe('The Great Adventure');
      expect(metadata.import_date).toBeDefined();
    });

    it('should not extract title from long first lines', () => {
      const content =
        'This is a very long first line that is definitely not a title but rather the beginning of the story content itself and should not be treated as a title.';

      const metadata = StoryImportService.extractMetadata(content);

      expect(metadata.title).toBeUndefined();
    });

    it('should not extract title from sentences ending with periods', () => {
      const content =
        'This line ends with a period.\n\nSo it should not be considered a title.';

      const metadata = StoryImportService.extractMetadata(content);

      expect(metadata.title).toBeUndefined();
    });
  });

  describe('Utility Functions', () => {
    it('should format file sizes correctly', () => {
      expect(StoryImportService.formatFileSize(0)).toBe('0 Bytes');
      expect(StoryImportService.formatFileSize(1024)).toBe('1 KB');
      expect(StoryImportService.formatFileSize(1048576)).toBe('1 MB');
      expect(StoryImportService.formatFileSize(1536)).toBe('1.5 KB');
    });

    it('should validate text file extensions', () => {
      expect(StoryImportService.isValidTextFile('story.txt')).toBe(true);
      expect(StoryImportService.isValidTextFile('document.text')).toBe(true);
      expect(StoryImportService.isValidTextFile('Story.TXT')).toBe(true); // Case insensitive
      expect(StoryImportService.isValidTextFile('document.pdf')).toBe(false);
      expect(StoryImportService.isValidTextFile('image.jpg')).toBe(false);
      expect(StoryImportService.isValidTextFile('file')).toBe(false); // No extension
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle null and undefined content gracefully', () => {
      // @ts-ignore - Testing runtime behavior
      const nullResult = StoryImportService.validateStoryContent(null);
      // @ts-ignore - Testing runtime behavior
      const undefinedResult =
        StoryImportService.validateStoryContent(undefined);

      expect(nullResult.isValid).toBe(false);
      expect(undefinedResult.isValid).toBe(false);
      expect(nullResult.errors).toContain('Story content cannot be empty');
      expect(undefinedResult.errors).toContain('Story content cannot be empty');
    });

    it('should handle whitespace-only content', () => {
      const whitespaceContent = '   \n\t   \n   ';
      const result = StoryImportService.validateStoryContent(whitespaceContent);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Story content cannot be empty');
    });

    it('should handle files with special characters in names', async () => {
      const mockFileUri = '/mock/path/story-with-special-chars!@#.txt';
      const mockContent = 'Story content';
      const mockStats = { size: 256 };

      mockRNFS.exists.mockResolvedValue(true);
      mockRNFS.stat.mockResolvedValue(mockStats);
      mockRNFS.readFile.mockResolvedValue(mockContent);

      const result = await StoryImportService.readTextFile(mockFileUri);

      expect(result.success).toBe(true);
      expect(result.content).toBe(mockContent);
    });

    it('should sanitize content with null bytes and control characters', () => {
      const dirtyContent =
        'Story\x00with\x01null\x02bytes\x03and\x04control\x05chars';
      const source: StorySource = 'File';

      const result = StoryImportService.processStoryForImport(
        dirtyContent,
        source,
      );

      expect(result.content).toBe('Storywithnullbytesandcontrolchars'); // Cleaned content
      expect(result.content).not.toContain('\x00');
      expect(result.content).not.toMatch(/[\x01-\x05]/);
    });
  });
});
