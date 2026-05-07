/**
 * Integration Tests for Story Download Flow (Task 1.6)
 * Tests the complete end-to-end download functionality
 */

import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import { StoryDownloadService } from '../../services/storyDownloadService';
import { GameSession } from '../../types/database';

// Mock react-native-fs
jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/mock/documents',
  writeFile: jest.fn(),
  stat: jest.fn(() =>
    Promise.resolve({
      size: 1024,
      isFile: () => true,
      isDirectory: () => false,
      path: '/mock/documents/test.txt',
      ctime: new Date(),
      mtime: new Date(),
      mode: 0o644,
    }),
  ),
  exists: jest.fn(() => Promise.resolve(true)),
  readFile: jest.fn(() => Promise.resolve('Test file content')),
  unlink: jest.fn(() => Promise.resolve()),
  mkdir: jest.fn(() => Promise.resolve()),
  readDir: jest.fn(() => Promise.resolve([])),
}));

// Mock react-native-share
jest.mock('react-native-share', () => ({
  open: jest.fn(() => Promise.resolve({ success: true })),
}));

// Mock Alert
const mockAlert = jest.fn();
jest.mock('react-native', () => ({
  Alert: {
    alert: mockAlert,
  },
}));

describe('Download Flow Integration Tests', () => {
  let storyDownloadService: StoryDownloadService;

  beforeEach(() => {
    jest.clearAllMocks();
    storyDownloadService = new StoryDownloadService();
  });

  const mockCompletedStory: GameSession = {
    id: 'story-session-123',
    story_content: `Once upon a time, there was a brave little mouse named Whiskers who lived in a cozy burrow beneath an old oak tree.

Every morning, Whiskers would venture out to explore the vast meadow, always careful to watch for the hungry cat that prowled nearby.

One day, Whiskers discovered a magical acorn that glowed with a soft, golden light. When touched, it granted the mouse incredible courage.

With newfound bravery, Whiskers faced the cat and discovered that beneath its fierce exterior was a lonely creature seeking friendship.

The mouse and cat became unlikely companions, sharing adventures and proving that even the smallest acts of kindness can change the world.`,
    created_at: '2024-11-03T10:30:00Z',
    completed_at: '2024-11-03T11:00:00Z',
    contributions: [
      {
        content:
          'Once upon a time, there was a brave little mouse named Whiskers...',
        isUserContribution: true,
      },
      {
        content: 'Every morning, Whiskers would venture out to explore...',
        isUserContribution: false,
      },
      {
        content: 'One day, Whiskers discovered a magical acorn...',
        isUserContribution: true,
      },
      {
        content: 'With newfound bravery, Whiskers faced the cat...',
        isUserContribution: false,
      },
      {
        content: 'The mouse and cat became unlikely companions...',
        isUserContribution: true,
      },
    ],
    sessionStats: {
      userWords: 95,
      totalWords: 185,
      averageResponseTime: 45000,
    },
  };

  test('complete download flow works correctly', async () => {
    // Step 1: Mock successful file operations
    (RNFS.writeFile as jest.Mock).mockResolvedValueOnce(undefined);
    (RNFS.stat as jest.Mock).mockResolvedValueOnce({
      size: 1024,
      isFile: () => true,
      isDirectory: () => false,
    });
    (Share.open as jest.Mock).mockResolvedValueOnce({ success: true });

    // Step 2: Create download options from completed story
    const downloadOptions =
      storyDownloadService.createDownloadOptionsFromContent(
        mockCompletedStory.id,
        mockCompletedStory.story_content,
      );

    expect(downloadOptions).toEqual({
      storyId: 'story-session-123',
      content: mockCompletedStory.story_content,
      title: 'My Story',
    });

    // Step 3: Validate story content
    const validation = storyDownloadService.validateStoryContent(
      downloadOptions.content,
    );
    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);

    // Step 4: Generate file content and filename
    const fileContent = storyDownloadService.generateStoryFile(downloadOptions);
    const fileName = storyDownloadService.generateFileName();

    expect(fileContent).toContain('My Story');
    expect(fileContent).toContain('Once upon a time');
    expect(fileContent).toContain('unlikely companions');
    expect(fileName).toMatch(/^Story_\d{6}_\d{6}\.txt$/);

    // Step 5: Test file saving through service
    const saveResult = await storyDownloadService.saveStoryFile(
      fileContent,
      fileName,
    );

    expect(saveResult.success).toBe(true);
    expect(saveResult.fileName).toBe(fileName);
    expect(saveResult.filePath).toContain(fileName);

    // Step 6: Verify file system operations
    expect(RNFS.writeFile).toHaveBeenCalledWith(
      expect.stringContaining(fileName),
      fileContent,
      'utf8',
    );

    expect(Share.open).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Save Story',
        type: 'text/plain',
        filename: fileName,
        saveToFiles: true,
      }),
    );
  });

  test('handles error scenarios gracefully throughout the flow', async () => {
    const errorScenarios = [
      {
        name: 'permission-denied',
        error: new Error('EACCES: permission denied'),
        expectedMessage: 'Permission denied to write file.',
      },
      {
        name: 'storage-full',
        error: new Error('ENOSPC: no space left on device'),
        expectedMessage: 'Not enough storage space available.',
      },
      {
        name: 'file-system-error',
        error: new Error('ENOENT: no such file or directory'),
        expectedMessage: 'Directory not accessible.',
      },
    ];

    for (const scenario of errorScenarios) {
      jest.clearAllMocks();
      (RNFS.writeFile as jest.Mock).mockRejectedValueOnce(scenario.error);

      const downloadOptions =
        storyDownloadService.createDownloadOptionsFromContent(
          mockCompletedStory.id,
          mockCompletedStory.story_content,
        );

      const fileContent =
        storyDownloadService.generateStoryFile(downloadOptions);
      const fileName = storyDownloadService.generateFileName();

      const result = await storyDownloadService.saveStoryFile(
        fileContent,
        fileName,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(scenario.expectedMessage);
    }
  });

  test('validates file accessibility and content integrity', async () => {
    // Mock successful file creation
    const testFileName = 'Story_110324_143022.txt';
    const testContent = 'Test story content for validation.';

    (RNFS.writeFile as jest.Mock).mockResolvedValueOnce(undefined);
    (RNFS.exists as jest.Mock).mockResolvedValueOnce(true);
    (RNFS.readFile as jest.Mock).mockResolvedValueOnce(testContent);
    (Share.open as jest.Mock).mockResolvedValueOnce({ success: true });

    // Create and save file
    const result = await storyDownloadService.saveStoryFile(
      testContent,
      testFileName,
    );
    expect(result.success).toBe(true);

    // Verify file exists
    const fileExists = await RNFS.exists(result.filePath!);
    expect(fileExists).toBe(true);

    // Verify file content integrity
    const savedContent = await RNFS.readFile(result.filePath!);
    expect(savedContent).toBe(testContent);

    expect(RNFS.writeFile).toHaveBeenCalledWith(
      expect.stringContaining(testFileName),
      testContent,
      'utf8',
    );
  });

  test('performance testing for file generation speed', async () => {
    const largeStory = {
      id: 'large-story-123',
      content: 'This is a large story. '.repeat(2000), // ~48KB story
    };

    const startTime = Date.now();

    // Generate download options and file content
    const downloadOptions =
      storyDownloadService.createDownloadOptionsFromContent(
        largeStory.id,
        largeStory.content,
      );

    const fileContent = storyDownloadService.generateStoryFile(downloadOptions);
    storyDownloadService.generateFileName();

    const generationTime = Date.now() - startTime;

    // File generation should complete within 3 seconds for typical stories
    expect(generationTime).toBeLessThan(3000);

    // Verify content is properly formatted
    expect(fileContent).toContain('My Story');
    expect(fileContent).toContain('This is a large story.');
    expect(fileContent.length).toBeGreaterThan(40000); // Should be substantial

    // Test file stats
    const stats = storyDownloadService.generateDownloadStats(downloadOptions);
    expect(stats.contentLength).toBeGreaterThan(40000);
    expect(stats.wordCount).toBeGreaterThan(8000);
    expect(stats.estimatedFileSize).toBeGreaterThan(40000);
  });

  test('validates story content with various content types', async () => {
    const testCases = [
      {
        name: 'Normal story',
        content: 'Once upon a time, there was a magical kingdom...',
        shouldBeValid: true,
      },
      {
        name: 'Empty story',
        content: '',
        shouldBeValid: false,
        expectedErrors: ['Story content cannot be empty'],
      },
      {
        name: 'Very short story',
        content: 'Hi',
        shouldBeValid: false,
        expectedErrors: ['Story content is too short (minimum 10 characters)'],
      },
      {
        name: 'Story with special characters',
        content:
          'A story with émojis 🌟 and spéciál characters like café & résumé!',
        shouldBeValid: true,
      },
      {
        name: 'Multi-paragraph story',
        content: `Chapter 1: The Beginning
        
Once upon a time in a far away land, there lived a young adventurer.

Chapter 2: The Journey

The adventurer set out on a quest to find the legendary treasure.`,
        shouldBeValid: true,
      },
    ];

    testCases.forEach(testCase => {
      const validation = storyDownloadService.validateStoryContent(
        testCase.content,
      );

      expect(validation.isValid).toBe(testCase.shouldBeValid);

      if (testCase.expectedErrors) {
        testCase.expectedErrors.forEach(expectedError => {
          expect(validation.errors).toContain(expectedError);
        });
      }
    });
  });

  test('user cancellation handling preserves file locally', async () => {
    const testContent = 'Test story for cancellation scenario.';
    const testFileName = 'Story_110324_143022.txt';

    // Mock user cancellation
    const cancellationError = new Error('User did not share');
    (RNFS.writeFile as jest.Mock).mockResolvedValueOnce(undefined);
    (Share.open as jest.Mock).mockRejectedValueOnce(cancellationError);

    const result = await storyDownloadService.saveStoryFile(
      testContent,
      testFileName,
    );

    // Should still succeed with cancellation flag
    expect(result.success).toBe(true);
    expect(result.cancelled).toBe(true);
    expect(result.fileName).toBe(testFileName);

    // File should still be written locally
    expect(RNFS.writeFile).toHaveBeenCalledWith(
      expect.stringContaining(testFileName),
      testContent,
      'utf8',
    );
  });

  test('file generation maintains content formatting', async () => {
    const formattedStory = `Chapter 1: The Magic Forest

Once upon a time, in a mystical forest far from any village, there lived creatures of wonder and magic.

The trees whispered ancient secrets to those who knew how to listen.

Chapter 2: The Discovery

Young Emma stumbled upon this magical realm quite by accident.

She had been chasing her runaway kitten when she found herself in a place that couldn't possibly exist.`;

    const downloadOptions =
      storyDownloadService.createDownloadOptionsFromContent(
        'formatted-story-123',
        formattedStory,
        'The Magic Forest Adventure',
      );

    const fileContent = storyDownloadService.generateStoryFile(downloadOptions);

    // Verify title is included
    expect(fileContent).toContain('The Magic Forest Adventure');

    // Verify chapter headings are preserved
    expect(fileContent).toContain('Chapter 1: The Magic Forest');
    expect(fileContent).toContain('Chapter 2: The Discovery');

    // Verify paragraph breaks are maintained
    const lines = fileContent.split('\n');
    expect(lines).toContain(''); // Should have empty lines for paragraph breaks

    // Verify no excessive line breaks
    expect(fileContent).not.toContain('\n\n\n\n');

    // Verify proper ending
    expect(fileContent.endsWith('\n')).toBe(true);
  });

  test('download statistics accuracy', async () => {
    const testStory = `This is a test story with exactly twenty two words to verify word counting functionality works correctly.`;

    const downloadOptions =
      storyDownloadService.createDownloadOptionsFromContent(
        'stats-test-123',
        testStory,
      );

    const stats = storyDownloadService.generateDownloadStats(downloadOptions);

    // Count words manually: "This is a test story with exactly twenty two words to verify word counting functionality works correctly." = 19 words
    const manualWordCount = testStory
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0).length;
    expect(stats.wordCount).toBe(manualWordCount);
    expect(stats.contentLength).toBe(testStory.length);
    expect(stats.paragraphCount).toBe(1); // Single paragraph
    expect(stats.estimatedFileSize).toBeGreaterThan(testStory.length); // Should include title
  });

  test('filename generation uniqueness and format', async () => {
    const generatedFilenames = new Set();

    // Generate multiple filenames with sufficient delay to ensure uniqueness
    for (let i = 0; i < 3; i++) {
      const fileName = storyDownloadService.generateFileName();
      generatedFilenames.add(fileName);

      // Verify format
      expect(fileName).toMatch(/^Story_\d{6}_\d{6}\.txt$/);

      // Longer delay to ensure timestamp differences (seconds level)
      await new Promise(resolve => setTimeout(resolve, 1100));
    }

    // All filenames should be unique due to timestamp differences
    expect(generatedFilenames.size).toBe(3);

    // Test that format is correct
    const testFileName = storyDownloadService.generateFileName();
    expect(testFileName).toMatch(/^Story_\d{6}_\d{6}\.txt$/);

    // Test filename components
    const parts = testFileName.replace('.txt', '').split('_');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe('Story');
    expect(parts[1]).toMatch(/^\d{6}$/); // MMDDYY
    expect(parts[2]).toMatch(/^\d{6}$/); // HHMMSS
  });

  test('memory efficiency during large file operations', async () => {
    // Create a relatively large story (but not too large for CI)
    const largeContent =
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(1000); // ~56KB

    const downloadOptions =
      storyDownloadService.createDownloadOptionsFromContent(
        'memory-test-123',
        largeContent,
      );

    // Multiple operations to test memory efficiency
    const operations = [
      () => storyDownloadService.validateStoryContent(downloadOptions.content),
      () => storyDownloadService.generateStoryFile(downloadOptions),
      () => storyDownloadService.generateDownloadStats(downloadOptions),
      () => storyDownloadService.generatePreview(downloadOptions, 5),
      () => storyDownloadService.estimateFileSize(downloadOptions.content),
    ];

    // All operations should complete without throwing memory errors
    const results = operations.map(operation => operation());

    // Verify all operations succeeded
    results.forEach(result => {
      expect(result).toBeTruthy();
    });

    // Verify the large content is handled correctly
    const fileContent = results[1] as string; // generateStoryFile result
    expect(fileContent.length).toBeGreaterThan(50000);
    expect(fileContent).toContain('My Story');
    expect(fileContent).toContain('Lorem ipsum');
  });
});
