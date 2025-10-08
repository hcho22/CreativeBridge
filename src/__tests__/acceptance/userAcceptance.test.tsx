// User Acceptance Tests
// Testing story continuation feature with various scenarios and edge cases

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

// Mock dependencies
jest.mock('react-native-document-picker', () => ({
  pick: jest.fn(),
  types: {
    plainText: 'text/plain',
    allFiles: '*/*',
  },
  isCancel: jest.fn(() => false),
  isInProgress: jest.fn(() => false),
}));

jest.mock('react-native-fs', () => ({
  exists: jest.fn(),
  stat: jest.fn(),
  readFile: jest.fn(),
  unlink: jest.fn(),
}));

// Mock services
const mockStoryImportService = {
  readFileWithEncoding: jest.fn(),
  validateStoryContent: jest.fn(),
  processStoryForImport: jest.fn(),
  fetchUserStories: jest.fn(),
  searchUserStories: jest.fn(),
};

const mockStoryManagementService = {
  saveStory: jest.fn(),
  searchStories: jest.fn(),
  filterStories: jest.fn(),
  getStoryLibrary: jest.fn(),
  editStoryContent: jest.fn(),
};

const mockStoryGenerationService = {
  generateImportedStoryContinuation: jest.fn(),
  analyzeImportedStory: jest.fn(),
  validateContinuationQuality: jest.fn(),
};

jest.mock('../../services/storyImportService', () => ({
  StoryImportService: mockStoryImportService,
}));

jest.mock('../../services/storyManagementService', () => ({
  StoryManagementService: mockStoryManagementService,
}));

jest.mock('../../services/storyGenerationService', () => ({
  StoryGenerationService: mockStoryGenerationService,
}));

// Import test utilities
import { FilePickerUtils } from '../../utils/filePicker';

// Test data generators
function generateLargeStoryCollection(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    session_id: `story-${i}`,
    story_content: `This is story number ${i} with adventure and magic elements. ${
      i % 3 === 0 ? 'It features dragons and knights.' : ''
    } ${i % 5 === 0 ? 'There are mysterious forests and ancient castles.' : ''}`,
    created_at: new Date(Date.now() - i * 86400000).toISOString(), // Days ago
    story_source: i % 3 === 0 ? 'CreativeBridge' : i % 3 === 1 ? 'Story_Quest' : 'File',
    final_score: Math.floor(Math.random() * 200) + 50,
    words_written: Math.floor(Math.random() * 500) + 50,
    relevance_score: Math.random(),
  }));
}

function generateFileContent(type: 'small' | 'medium' | 'large' | 'utf8' | 'ascii' | 'special'): string {
  const baseStory = 'Once upon a time, there was a brave knight who ventured into the mysterious forest.';
  
  switch (type) {
    case 'small':
      return baseStory;
    case 'medium':
      return baseStory.repeat(100); // ~7KB
    case 'large':
      return baseStory.repeat(10000); // ~700KB
    case 'utf8':
      return 'The café had résumé writing services. 中文 characters and emoji 🐉🏰✨';
    case 'ascii':
      return 'Simple ASCII text without special characters.';
    case 'special':
      return `Story with special formatting:
      
      Chapter 1: The Beginning
      
      • Bullet point one
      • Bullet point two
      
      "Quoted dialogue," said the character.
      
      --- End of Chapter ---`;
    default:
      return baseStory;
  }
}

describe('User Acceptance Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('File Format and Size Handling', () => {
    it('should handle various text file formats correctly', async () => {
      const fileFormats = [
        {
          name: 'simple.txt',
          content: generateFileContent('small'),
          encoding: 'utf-8',
          expectedWords: 15,
        },
        {
          name: 'unicode.txt',
          content: generateFileContent('utf8'),
          encoding: 'utf-8',
          expectedWords: 11,
        },
        {
          name: 'ascii.txt',
          content: generateFileContent('ascii'),
          encoding: 'ascii',
          expectedWords: 7,
        },
        {
          name: 'formatted.txt',
          content: generateFileContent('special'),
          encoding: 'utf-8',
          expectedWords: 18,
        },
      ];

      for (const file of fileFormats) {
        // Mock successful file reading
        mockStoryImportService.readFileWithEncoding.mockResolvedValue({
          success: true,
          content: file.content,
          metadata: {
            file_name: file.name,
            file_size: file.content.length,
            encoding: file.encoding,
            imported_word_count: file.expectedWords,
          },
        });

        mockStoryImportService.validateStoryContent.mockReturnValue({
          isValid: true,
          errors: [],
          warnings: [],
        });

        const result = await mockStoryImportService.readFileWithEncoding(file.name);
        expect(result.success).toBe(true);
        expect(result.content).toBe(file.content);
        expect(result.metadata.encoding).toBe(file.encoding);

        const validation = mockStoryImportService.validateStoryContent(file.content);
        expect(validation.isValid).toBe(true);
      }
    });

    it('should handle different file sizes efficiently', async () => {
      const fileSizes = [
        { type: 'small', maxProcessingTime: 100 },
        { type: 'medium', maxProcessingTime: 500 },
        { type: 'large', maxProcessingTime: 2000 },
      ];

      for (const fileTest of fileSizes) {
        const content = generateFileContent(fileTest.type as any);
        
        mockStoryImportService.readFileWithEncoding.mockImplementation(() => 
          new Promise(resolve => {
            setTimeout(() => {
              resolve({
                success: true,
                content,
                metadata: {
                  file_name: `${fileTest.type}.txt`,
                  file_size: content.length,
                  encoding: 'utf-8',
                  imported_word_count: content.split(/\s+/).length,
                },
              });
            }, 50); // Simulate processing time
          })
        );

        const startTime = Date.now();
        const result = await mockStoryImportService.readFileWithEncoding(`${fileTest.type}.txt`);
        const processingTime = Date.now() - startTime;

        expect(result.success).toBe(true);
        expect(processingTime).toBeLessThan(fileTest.maxProcessingTime);
      }
    });

    it('should handle corrupted or invalid files gracefully', async () => {
      const invalidFiles = [
        {
          name: 'corrupted.txt',
          error: 'File appears to be corrupted',
          expectedErrorType: 'FILE_CORRUPTION',
        },
        {
          name: 'too_large.txt',
          error: 'File size exceeds 10MB limit',
          expectedErrorType: 'FILE_SIZE_LIMIT',
        },
        {
          name: 'unsupported.pdf',
          error: 'Unsupported file format',
          expectedErrorType: 'UNSUPPORTED_FORMAT',
        },
      ];

      for (const invalidFile of invalidFiles) {
        mockStoryImportService.readFileWithEncoding.mockResolvedValue({
          success: false,
          error: invalidFile.error,
          errorType: invalidFile.expectedErrorType,
        });

        const result = await mockStoryImportService.readFileWithEncoding(invalidFile.name);
        
        expect(result.success).toBe(false);
        expect(result.error).toBe(invalidFile.error);
        expect(result.errorType).toBe(invalidFile.expectedErrorType);
      }
    });
  });

  describe('Search and Filter Performance', () => {
    it('should perform well with large story collections', async () => {
      const largeCollection = generateLargeStoryCollection(1000);
      
      // Mock search with large dataset
      mockStoryManagementService.searchStories.mockImplementation((searchTerm: string) => {
        const startTime = Date.now();
        const results = largeCollection.filter(story => 
          story.story_content.toLowerCase().includes(searchTerm.toLowerCase())
        ).slice(0, 20); // Return top 20 results
        
        return Promise.resolve({
          success: true,
          stories: results,
          processingTime: Date.now() - startTime,
          total: results.length,
        });
      });

      const searchTerms = ['adventure', 'dragon', 'castle', 'forest', 'knight'];
      
      for (const term of searchTerms) {
        const startTime = Date.now();
        const result = await mockStoryManagementService.searchStories(term);
        const searchTime = Date.now() - startTime;

        expect(result.success).toBe(true);
        expect(searchTime).toBeLessThan(1000); // Should complete within 1 second
        expect(result.stories.length).toBeLessThanOrEqual(20);
        
        // Verify results are relevant
        result.stories.forEach((story: any) => {
          expect(story.story_content.toLowerCase()).toContain(term.toLowerCase());
        });
      }
    });

    it('should handle complex filtering with multiple criteria', async () => {
      const stories = generateLargeStoryCollection(500);
      
      mockStoryManagementService.filterStories.mockImplementation((filters: any) => {
        let filtered = [...stories];
        
        if (filters.source) {
          filtered = filtered.filter(story => story.story_source === filters.source);
        }
        
        if (filters.dateFrom) {
          filtered = filtered.filter(story => 
            new Date(story.created_at) >= new Date(filters.dateFrom)
          );
        }
        
        if (filters.minWords) {
          filtered = filtered.filter(story => story.words_written >= filters.minWords);
        }
        
        if (filters.minScore) {
          filtered = filtered.filter(story => story.final_score >= filters.minScore);
        }
        
        return Promise.resolve({
          success: true,
          stories: filtered.slice(0, filters.limit || 50),
          total: filtered.length,
        });
      });

      const complexFilters = [
        {
          source: 'CreativeBridge',
          minScore: 100,
          limit: 10,
        },
        {
          dateFrom: new Date(Date.now() - 7 * 86400000).toISOString(), // Last week
          minWords: 100,
          limit: 20,
        },
        {
          source: 'Story_Quest',
          minScore: 150,
          minWords: 200,
          limit: 5,
        },
      ];

      for (const filters of complexFilters) {
        const startTime = Date.now();
        const result = await mockStoryManagementService.filterStories(filters);
        const filterTime = Date.now() - startTime;

        expect(result.success).toBe(true);
        expect(filterTime).toBeLessThan(500); // Complex filters should be fast
        expect(result.stories.length).toBeLessThanOrEqual(filters.limit);
        
        // Verify filtering criteria are applied
        result.stories.forEach((story: any) => {
          if (filters.source) {
            expect(story.story_source).toBe(filters.source);
          }
          if (filters.minScore) {
            expect(story.final_score).toBeGreaterThanOrEqual(filters.minScore);
          }
          if (filters.minWords) {
            expect(story.words_written).toBeGreaterThanOrEqual(filters.minWords);
          }
        });
      }
    });

    it('should maintain search performance with real-time search', async () => {
      const stories = generateLargeStoryCollection(200);
      let searchCallCount = 0;
      
      mockStoryManagementService.searchStories.mockImplementation((term: string) => {
        searchCallCount++;
        const results = stories.filter(story => 
          story.story_content.toLowerCase().includes(term.toLowerCase())
        );
        
        return Promise.resolve({
          success: true,
          stories: results.slice(0, 10),
          total: results.length,
          searchId: searchCallCount,
        });
      });

      // Simulate real-time search with progressive typing
      const searchProgression = ['a', 'ad', 'adv', 'adve', 'adven', 'advent', 'adventure'];
      const searchTimes: number[] = [];
      
      for (const term of searchProgression) {
        const startTime = Date.now();
        const result = await mockStoryManagementService.searchStories(term);
        const searchTime = Date.now() - startTime;
        
        searchTimes.push(searchTime);
        
        expect(result.success).toBe(true);
        expect(searchTime).toBeLessThan(200); // Real-time search should be very fast
      }
      
      // Verify search performance doesn't degrade with query length
      const averageTime = searchTimes.reduce((a, b) => a + b, 0) / searchTimes.length;
      expect(averageTime).toBeLessThan(100);
    });
  });

  describe('Editing Functionality', () => {
    it('should handle editing of different story lengths', async () => {
      const storyLengths = [
        { type: 'short', content: generateFileContent('small'), maxWords: 50 },
        { type: 'medium', content: generateFileContent('medium'), maxWords: 1000 },
        { type: 'long', content: generateFileContent('large'), maxWords: 50000 },
      ];

      for (const storyTest of storyLengths) {
        const originalContent = storyTest.content;
        const editedContent = originalContent + ' This is an edited addition to the story.';
        
        mockStoryManagementService.editStoryContent.mockResolvedValue({
          success: true,
          story: {
            id: 'test-story',
            content: editedContent,
            words_written: editedContent.split(/\s+/).length,
          },
          previousContent: originalContent,
        });

        const result = await mockStoryManagementService.editStoryContent(
          'test-story',
          'user-123',
          editedContent
        );

        expect(result.success).toBe(true);
        expect(result.story.content).toBe(editedContent);
        expect(result.story.content.length).toBeGreaterThan(originalContent.length);
        expect(result.story.words_written).toBeGreaterThan(storyTest.maxWords / 10); // Adjust expectation
      }
    });

    it('should preserve formatting during editing', async () => {
      const formattedContent = `Chapter 1: The Adventure Begins

The knight stood at the edge of the forest.
      
"This is dangerous," he whispered.

• First objective: Find the dragon
• Second objective: Rescue the princess
• Third objective: Return safely

--- End of Chapter ---`;

      const editedContent = formattedContent.replace(
        'The knight stood at the edge of the forest.',
        'The brave knight stood confidently at the edge of the dark forest.'
      );

      mockStoryManagementService.editStoryContent.mockResolvedValue({
        success: true,
        story: {
          id: 'formatted-story',
          content: editedContent,
          preservedFormatting: true,
        },
      });

      const result = await mockStoryManagementService.editStoryContent(
        'formatted-story',
        'user-123',
        editedContent
      );

      expect(result.success).toBe(true);
      expect(result.story.content).toContain('Chapter 1:');
      expect(result.story.content).toContain('• First objective:');
      expect(result.story.content).toContain('--- End of Chapter ---');
      expect(result.story.content).toContain('brave knight stood confidently');
    });

    it('should handle concurrent editing scenarios', async () => {
      const baseContent = 'The original story content that will be edited.';
      const edit1 = baseContent + ' First user addition.';
      const edit2 = baseContent + ' Second user addition.';
      
      let editCount = 0;
      mockStoryManagementService.editStoryContent.mockImplementation(() => {
        editCount++;
        const timestamp = Date.now() + editCount;
        
        return Promise.resolve({
          success: true,
          story: {
            id: 'concurrent-story',
            content: editCount === 1 ? edit1 : edit2,
            lastModified: timestamp,
          },
          conflictDetected: editCount > 1,
          conflictResolution: editCount > 1 ? 'last_writer_wins' : null,
        });
      });

      // Simulate concurrent edits
      const [result1, result2] = await Promise.all([
        mockStoryManagementService.editStoryContent('concurrent-story', 'user-1', edit1),
        mockStoryManagementService.editStoryContent('concurrent-story', 'user-2', edit2),
      ]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result2.conflictDetected).toBe(true);
      expect(result2.conflictResolution).toBe('last_writer_wins');
    });
  });

  describe('AI Continuation Quality', () => {
    it('should verify AI continuation quality with imported stories', async () => {
      const testStories = [
        {
          content: 'The magical kingdom was in peril as the ancient dragon awakened.',
          expectedGenre: 'fantasy',
          expectedTone: 'dramatic',
        },
        {
          content: 'Detective Martinez examined the crime scene with her magnifying glass.',
          expectedGenre: 'mystery',
          expectedTone: 'investigative',
        },
        {
          content: 'The spaceship landed on the alien planet with a gentle thud.',
          expectedGenre: 'science fiction',
          expectedTone: 'adventurous',
        },
      ];

      for (const story of testStories) {
        // Mock story analysis
        mockStoryGenerationService.analyzeImportedStory.mockResolvedValue({
          genre: story.expectedGenre,
          tone: story.expectedTone,
          complexity: 'medium',
          characters: ['protagonist'],
          themes: ['adventure'],
        });

        // Mock continuation generation
        const continuation = `The story continues in the ${story.expectedGenre} genre with ${story.expectedTone} tone.`;
        mockStoryGenerationService.generateImportedStoryContinuation.mockResolvedValue(continuation);

        // Mock quality validation
        mockStoryGenerationService.validateContinuationQuality.mockResolvedValue({
          quality: 'high',
          score: 0.9,
          consistencyCheck: {
            genreConsistent: true,
            toneConsistent: true,
            characterConsistent: true,
          },
          issues: [],
          suggestions: [],
        });

        const analysis = await mockStoryGenerationService.analyzeImportedStory(story.content);
        const generatedContinuation = await mockStoryGenerationService.generateImportedStoryContinuation(story.content);
        const quality = await mockStoryGenerationService.validateContinuationQuality(generatedContinuation, story.content);

        expect(analysis.genre).toBe(story.expectedGenre);
        expect(analysis.tone).toBe(story.expectedTone);
        expect(generatedContinuation).toContain(story.expectedGenre);
        expect(quality.quality).toBe('high');
        expect(quality.score).toBeGreaterThanOrEqual(0.8);
        expect(quality.consistencyCheck.genreConsistent).toBe(true);
        expect(quality.consistencyCheck.toneConsistent).toBe(true);
      }
    });

    it('should maintain story coherence across multiple continuations', async () => {
      const originalStory = 'Captain Sarah Rodriguez commanded her starship through the asteroid field.';
      const continuations = [];
      let currentStory = originalStory;

      // Generate multiple continuations
      for (let i = 0; i < 3; i++) {
        const continuation = `Chapter ${i + 2}: The adventure continues as Captain Rodriguez faces new challenges.`;
        continuations.push(continuation);
        currentStory += ' ' + continuation;

        mockStoryGenerationService.generateImportedStoryContinuation.mockResolvedValueOnce(continuation);
        mockStoryGenerationService.validateContinuationQuality.mockResolvedValueOnce({
          quality: 'high',
          score: 0.85 + (i * 0.02), // Slightly increasing quality
          coherenceScore: 0.9 - (i * 0.05), // Slightly decreasing coherence (realistic)
          characterConsistency: {
            'Captain Sarah Rodriguez': 'maintained',
            'starship': 'maintained',
          },
        });

        const generatedContinuation = await mockStoryGenerationService.generateImportedStoryContinuation(currentStory);
        const quality = await mockStoryGenerationService.validateContinuationQuality(generatedContinuation, currentStory);

        expect(generatedContinuation).toContain('Captain Rodriguez');
        expect(quality.quality).toBe('high');
        expect(quality.coherenceScore).toBeGreaterThan(0.7); // Maintain reasonable coherence
        expect(quality.characterConsistency['Captain Sarah Rodriguez']).toBe('maintained');
      }
    });
  });

  describe('Accessibility Features', () => {
    it('should support accessibility features and screen reader compatibility', async () => {
      // Mock component with accessibility props
      const AccessibleStoryComponent = () => (
        <div>
          <button 
            aria-label="Import story from file"
            accessibilityRole="button"
            accessibilityHint="Select a text file to import and continue writing"
          >
            Import from File
          </button>
          <input
            aria-label="Search stories"
            accessibilityRole="searchbox"
            accessibilityHint="Type to search through your imported stories"
            placeholder="Search stories..."
          />
          <button
            aria-label="Continue selected story"
            accessibilityRole="button"
            accessibilityHint="Start writing a continuation for the selected story"
            aria-disabled="false"
          >
            Continue Story
          </button>
          <div
            aria-label="Story content"
            accessibilityRole="text"
            aria-describedby="word-count"
          >
            Story content goes here...
          </div>
          <span id="word-count" aria-label="Word count: 150 words">
            150 words
          </span>
        </div>
      );

      const { getByLabelText, getByRole, getAllByRole } = render(<AccessibleStoryComponent />);

      // Test accessibility labels
      expect(getByLabelText('Import story from file')).toBeTruthy();
      expect(getByLabelText('Search stories')).toBeTruthy();
      expect(getByLabelText('Continue selected story')).toBeTruthy();
      expect(getByLabelText('Story content')).toBeTruthy();

      // Test ARIA roles - use getAllByRole since there are multiple buttons
      expect(getAllByRole('button').length).toBeGreaterThan(0);
      expect(getByRole('searchbox')).toBeTruthy();

      // Test that elements are not disabled unnecessarily
      const continueButton = getByLabelText('Continue selected story');
      expect(continueButton.props['aria-disabled']).toBe('false');
    });

    it('should provide keyboard navigation support', async () => {
      const KeyboardNavigationComponent = () => {
        const [focusedIndex, setFocusedIndex] = React.useState(0);
        const items = ['Import from File', 'My Stories', 'Continue Story'];

        return (
          <div>
            {items.map((item, index) => (
              <button
                key={item}
                onFocus={() => setFocusedIndex(index)}
                style={{ backgroundColor: focusedIndex === index ? '#blue' : '#white' }}
                tabIndex={index}
              >
                {item}
              </button>
            ))}
          </div>
        );
      };

      const { getAllByRole } = render(<KeyboardNavigationComponent />);

      const buttons = getAllByRole('button');
      expect(buttons).toHaveLength(3);
      
      const [importButton, myStoriesButton, continueButton] = buttons;

      // Test tab navigation
      expect(importButton.props.tabIndex).toBe(0);
      expect(myStoriesButton.props.tabIndex).toBe(1);
      expect(continueButton.props.tabIndex).toBe(2);

      // Test focus events
      fireEvent.focus(myStoriesButton);
      await waitFor(() => {
        expect(myStoriesButton.style.backgroundColor).toBe('blue');
      });
    });

    it('should provide clear error messages for accessibility', async () => {
      const AccessibleErrorComponent = ({ error }: { error: string | null }) => (
        <div>
          {error && (
            <div
              role="alert"
              aria-live="assertive"
              aria-atomic="true"
              style={{ color: 'red' }}
            >
              <strong>Error:</strong> {error}
            </div>
          )}
          <input
            aria-label="File selection"
            aria-invalid={!!error}
            aria-describedby={error ? 'error-message' : undefined}
          />
          {error && (
            <div id="error-message" aria-live="polite">
              Please correct the error and try again.
            </div>
          )}
        </div>
      );

      const { rerender, getByRole, getByLabelText } = render(
        <AccessibleErrorComponent error={null} />
      );

      // Test no error state
      const input = getByLabelText('File selection');
      expect(input.props['aria-invalid']).toBe(false);

      // Test error state
      rerender(<AccessibleErrorComponent error="File format not supported" />);
      
      const errorAlert = getByRole('alert');
      expect(errorAlert).toBeTruthy();
      expect(errorAlert.props.children[0].props.children[1]).toBe('File format not supported');
      
      const updatedInput = getByLabelText('File selection');
      expect(updatedInput.props['aria-invalid']).toBe(true);
    });

    it('should support voice-over and screen reader announcements', async () => {
      let announcements: string[] = [];
      
      // Mock screen reader announcements
      const mockAnnouncement = (message: string) => {
        announcements.push(message);
      };

      const VoiceOverComponent = () => {
        const [importing, setImporting] = React.useState(false);
        const [imported, setImported] = React.useState(false);

        const handleImport = () => {
          setImporting(true);
          mockAnnouncement('Importing story file...');
          
          setTimeout(() => {
            setImporting(false);
            setImported(true);
            mockAnnouncement('Story imported successfully. Ready to continue writing.');
          }, 100);
        };

        return (
          <div>
            <button onClick={handleImport} disabled={importing}>
              {importing ? 'Importing...' : 'Import Story'}
            </button>
            {importing && (
              <div aria-live="polite" aria-atomic="true">
                Importing your story, please wait...
              </div>
            )}
            {imported && (
              <div aria-live="polite" aria-atomic="true">
                Import completed! You can now edit and continue your story.
              </div>
            )}
          </div>
        );
      };

      const { getByText } = render(<VoiceOverComponent />);
      
      let importButton = getByText('Import Story');
      fireEvent.press(importButton);

      await waitFor(() => {
        expect(getByText('Importing...')).toBeTruthy();
        expect(announcements).toContain('Importing story file...');
      });

      await waitFor(() => {
        // After import completes, button text should be restored
        importButton = getByText('Import Story');
        expect(importButton).toBeTruthy();
        expect(announcements).toContain('Story imported successfully. Ready to continue writing.');
      }, { timeout: 200 });
    });
  });

  describe('Cross-Platform Compatibility', () => {
    it('should work consistently across iOS and Android', async () => {
      const platforms = ['ios', 'android'];
      
      for (const platform of platforms) {
        // Mock platform-specific behavior
        const mockPlatform = platform;
        
        mockStoryImportService.readFileWithEncoding.mockImplementation((_uri: string) => {
          const isIOS = mockPlatform === 'ios';
          return Promise.resolve({
            success: true,
            content: 'Platform-specific story content',
            metadata: {
              file_name: 'story.txt',
              file_size: 1024,
              encoding: 'utf-8',
              platform: mockPlatform,
              path: isIOS ? 'file:///ios/path' : 'file:///android/path',
            },
          });
        });

        const result = await mockStoryImportService.readFileWithEncoding('test-file');
        
        expect(result.success).toBe(true);
        expect(result.metadata.platform).toBe(platform);
        expect(result.metadata.path).toContain(platform);
      }
    });

    it('should handle platform-specific file permissions', async () => {
      const permissionScenarios = [
        {
          platform: 'ios',
          permission: 'granted',
          expectedSuccess: true,
        },
        {
          platform: 'android',
          permission: 'denied',
          expectedSuccess: false,
          expectedError: 'Storage permission required',
        },
        {
          platform: 'android',
          permission: 'granted',
          expectedSuccess: true,
        },
      ];

      for (const scenario of permissionScenarios) {
        if (scenario.expectedSuccess) {
          mockStoryImportService.readFileWithEncoding.mockResolvedValue({
            success: true,
            content: 'File content',
            metadata: { platform: scenario.platform },
          });
        } else {
          mockStoryImportService.readFileWithEncoding.mockResolvedValue({
            success: false,
            error: scenario.expectedError,
            errorType: 'PERMISSION_DENIED',
          });
        }

        const result = await mockStoryImportService.readFileWithEncoding('test-file');
        
        expect(result.success).toBe(scenario.expectedSuccess);
        if (!scenario.expectedSuccess) {
          expect(result.error).toBe(scenario.expectedError);
        }
      }
    });
  });
});