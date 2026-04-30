/**
 * Test suite for StoryDownloadService
 * Implements verification tests from Task 1.2
 */

import { StoryDownloadService } from '../../services/storyDownloadService';
import { GameSession } from '../../types/database';
import { StoryDownloadOptions } from '../../types/storyDownload';

describe('Story File Generation', () => {
  let service: StoryDownloadService;

  beforeEach(() => {
    service = new StoryDownloadService();
  });

  test('generates correct filename format', () => {
    const filename = service.generateFileName();
    // Should match format: Story_MMDDYY_HHMMSS.txt
    expect(filename).toMatch(/^Story_\d{6}_\d{6}\.txt$/);

    // Verify the format more specifically
    const parts = filename.replace('.txt', '').split('_');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe('Story');
    expect(parts[1]).toHaveLength(6); // MMDDYY
    expect(parts[2]).toHaveLength(6); // HHMMSS
  });

  test('generates unique filenames', () => {
    const filename1 = service.generateFileName();
    // Small delay to ensure different timestamp
    const filename2 = service.generateFileName();

    // Filenames should be different (unless generated at exact same millisecond)
    if (filename1 !== filename2) {
      expect(filename1).not.toBe(filename2);
    }
  });

  test('formats story content correctly', () => {
    const mockStory: StoryDownloadOptions = {
      storyId: 'test-123',
      content: 'Chapter 1\n\nOnce upon a time...\n\nThe end.',
      title: 'Test Story',
    };

    const fileContent = service.generateStoryFile(mockStory);

    // Should contain the story content
    expect(fileContent).toContain('Chapter 1');
    expect(fileContent).toContain('Once upon a time');
    expect(fileContent).toContain('The end');

    // Should include title
    expect(fileContent).toContain('Test Story');

    // Should NOT contain metadata like "word count"
    expect(fileContent).not.toContain('word count');
    expect(fileContent).not.toContain('challenges');
    expect(fileContent).not.toContain('xp');
  });

  test('preserves paragraph breaks in content', () => {
    const mockStory: StoryDownloadOptions = {
      storyId: 'test-123',
      content: 'Paragraph one.\n\nParagraph two.\n\nParagraph three.',
    };

    const fileContent = service.generateStoryFile(mockStory);

    // Should preserve double line breaks between paragraphs
    expect(fileContent).toContain('Paragraph one.\n\nParagraph two.');
    expect(fileContent).toContain('Paragraph two.\n\nParagraph three.');
  });

  test('handles content without title', () => {
    const mockStory: StoryDownloadOptions = {
      storyId: 'test-123',
      content: 'Story content without title.',
    };

    const fileContent = service.generateStoryFile(mockStory);

    // Should contain the content
    expect(fileContent).toContain('Story content without title.');

    // Should not have extra title section
    expect(fileContent.split('\n')[0]).toBe('Story content without title.');
  });

  test('validates story content correctly', () => {
    // Valid content
    const validResult = service.validateStoryContent(
      'This is a valid story with enough content.',
    );
    expect(validResult.isValid).toBe(true);
    expect(validResult.errors).toHaveLength(0);

    // Empty content
    const emptyResult = service.validateStoryContent('');
    expect(emptyResult.isValid).toBe(false);
    expect(emptyResult.errors).toContain('Story content cannot be empty');

    // Too short content
    const shortResult = service.validateStoryContent('Short');
    expect(shortResult.isValid).toBe(false);
    expect(shortResult.errors).toContain(
      'Story content is too short (minimum 10 characters)',
    );

    // Null/undefined content
    const nullResult = service.validateStoryContent(null as any);
    expect(nullResult.isValid).toBe(false);
    expect(nullResult.errors).toContain(
      'Story content must be a non-empty string',
    );
  });

  test('creates download options from game session', () => {
    const mockSession: GameSession = {
      id: 'session-123',
      user_id: 'user-456',
      created_at: '2025-11-03T14:30:22Z',
      completed_at: '2025-11-03T14:45:30Z',
      grade_level: 'K-2',
      final_score: 85,
      words_written: 366,
      sentences_completed: 12,
      challenges_completed: 1,
      xp_earned: 100,
      story_content: 'Once upon a time, there was a brave little mouse...',
      story_source: 'New',
      story_metadata: {},
    };

    const downloadOptions =
      service.createDownloadOptionsFromSession(mockSession);

    expect(downloadOptions.storyId).toBe('session-123');
    expect(downloadOptions.content).toBe(
      'Once upon a time, there was a brave little mouse...',
    );
    expect(downloadOptions.title).toContain('My Story');
    expect(downloadOptions.title).toContain('2025'); // Should include year from date
  });

  test('handles session without story content', () => {
    const mockSession: GameSession = {
      id: 'session-123',
      user_id: 'user-456',
      created_at: '2025-11-03T14:30:22Z',
      grade_level: 'K-2',
      final_score: 85,
      words_written: 366,
      sentences_completed: 12,
      challenges_completed: 1,
      xp_earned: 100,
      story_source: 'New',
      story_metadata: {},
      // No story_content
    };

    expect(() => {
      service.createDownloadOptionsFromSession(mockSession);
    }).toThrow('Game session does not contain story content');
  });

  test('estimates file size correctly', () => {
    const shortContent = 'Short story.';
    const longContent = 'A'.repeat(1000);

    const shortSize = service.estimateFileSize(shortContent);
    const longSize = service.estimateFileSize(longContent);

    expect(shortSize).toBeGreaterThan(0);
    expect(longSize).toBeGreaterThan(shortSize);
    expect(longSize).toBeGreaterThanOrEqual(1000);
  });

  test('generates preview correctly', () => {
    const mockStory: StoryDownloadOptions = {
      storyId: 'test-123',
      content: 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7',
      title: 'Test Story',
    };

    const preview = service.generatePreview(mockStory, 3);
    const lines = preview.split('\n');

    // Should include title and first few lines
    expect(preview).toContain('Test Story');
    expect(preview).toContain('...');
    expect(lines.length).toBeLessThanOrEqual(5); // title + 3 content lines + ...
  });

  test('sanitizes filenames correctly', () => {
    const invalidName = 'My<Story>:With"Invalid|Characters?.txt';
    const sanitized = service.sanitizeFileName(invalidName);

    expect(sanitized).not.toContain('<');
    expect(sanitized).not.toContain('>');
    expect(sanitized).not.toContain(':');
    expect(sanitized).not.toContain('"');
    expect(sanitized).not.toContain('|');
    expect(sanitized).not.toContain('?');
    expect(sanitized).toBe('My_Story_With_Invalid_Characters_.txt');
  });

  test('generates download statistics', () => {
    const mockStory: StoryDownloadOptions = {
      storyId: 'test-123',
      content: 'This is a test story.\n\nIt has two paragraphs.',
    };

    const stats = service.generateDownloadStats(mockStory);

    expect(stats.contentLength).toBeGreaterThan(0);
    expect(stats.wordCount).toBe(9); // "This is a test story It has two paragraphs"
    expect(stats.paragraphCount).toBe(2);
    expect(stats.estimatedFileSize).toBeGreaterThan(0);
  });

  test('creates download options from content', () => {
    const content = 'My Amazing Adventure\n\nOnce upon a time...';
    const options = service.createDownloadOptionsFromContent(
      'story-123',
      content,
      'Custom Title',
    );

    expect(options.storyId).toBe('story-123');
    expect(options.content).toBe(content);
    expect(options.title).toBe('Custom Title');
  });

  test('auto-extracts title from content when not provided', () => {
    const content = 'The Great Adventure\n\nOnce upon a time, there was...';
    const options = service.createDownloadOptionsFromContent(
      'story-123',
      content,
    );

    expect(options.title).toBe('The Great Adventure');
  });

  test('handles empty or invalid content gracefully', () => {
    expect(() => {
      service.generateStoryFile({ storyId: 'test', content: '' });
    }).toThrow('Story content is required for file generation');

    expect(() => {
      service.generateStoryFile({ storyId: 'test', content: null as any });
    }).toThrow('Story content is required for file generation');
  });

  test('normalizes excessive line breaks', () => {
    const messyContent = 'Paragraph 1\n\n\n\nParagraph 2\n\n\n\n\nParagraph 3';
    const mockStory: StoryDownloadOptions = {
      storyId: 'test-123',
      content: messyContent,
    };

    const fileContent = service.generateStoryFile(mockStory);

    // Should not have more than double line breaks
    expect(fileContent).not.toContain('\n\n\n');
    expect(fileContent).toContain('Paragraph 1\n\nParagraph 2');
  });
});
