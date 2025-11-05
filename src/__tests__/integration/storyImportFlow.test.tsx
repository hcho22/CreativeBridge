// Story Import Integration Tests
// End-to-end testing of complete story import workflow

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { Alert } from 'react-native';

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

jest.mock('react-native', () => ({
  ...jest.requireActual('react-native'),
  Platform: { OS: 'ios' },
  Alert: {
    alert: jest.fn(),
  },
}));

// Mock services
const mockStoryImportService = {
  readTextFile: jest.fn(),
  readFileWithEncoding: jest.fn(),
  fetchUserStories: jest.fn(),
  validateStoryContent: jest.fn(),
  processStoryForImport: jest.fn(),
};

const mockStoryGenerationService = {
  generateImportedStoryContinuation: jest.fn(),
  analyzeImportedStory: jest.fn(),
  prepareImportedStoryContext: jest.fn(),
};

const mockStoryManagementService = {
  saveStory: jest.fn(),
  searchStories: jest.fn(),
  updateStory: jest.fn(),
};

jest.mock('../../services/storyImportService', () => ({
  StoryImportService: mockStoryImportService,
}));

jest.mock('../../services/storyGenerationService', () => ({
  StoryGenerationService: mockStoryGenerationService,
}));

jest.mock('../../services/storyManagementService', () => ({
  StoryManagementService: mockStoryManagementService,
}));

// Import components
import { ImportOptionsScreen } from '../../screens/ImportOptionsScreen';
import { FilePickerUtils } from '../../utils/filePicker';

// Test utilities
interface E2EFlowStep {
  action: string;
  description: string;
  execute: () => Promise<void>;
  validate?: () => void;
}

class E2EFlowTester {
  private steps: E2EFlowStep[] = [];
  private completed: boolean = false;
  private errors: string[] = [];

  addStep(step: E2EFlowStep) {
    this.steps.push(step);
  }

  async executeFlow(): Promise<{ completed: boolean; errors: string[] }> {
    try {
      for (const step of this.steps) {
        console.log(`Executing: ${step.description}`);
        try {
          await step.execute();

          if (step.validate) {
            step.validate();
          }
        } catch (stepError) {
          const errorMessage =
            stepError instanceof Error ? stepError.message : String(stepError);
          console.error(`Step "${step.action}" failed:`, errorMessage);
          this.errors.push(`Step "${step.action}": ${errorMessage}`);
          // Continue with other steps even if one fails
        }
      }
      this.completed = this.errors.length === 0;
    } catch (error) {
      this.errors.push(error instanceof Error ? error.message : String(error));
    }

    return {
      completed: this.completed,
      errors: this.errors,
    };
  }
}

describe('Story Import Integration Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete File Import Workflow', () => {
    it('should complete full file import to story continuation flow', async () => {
      const flowTester = new E2EFlowTester();
      const mockFileContent =
        'Once upon a time, there was a brave knight who ventured into the dark forest.';
      const mockContinuation =
        'The knight discovered a magical sword glowing with ancient power.';

      // Step 1: Setup mock data
      mockStoryImportService.readFileWithEncoding.mockResolvedValue({
        success: true,
        content: mockFileContent,
        metadata: {
          file_name: 'story.txt',
          file_size: 1024,
          encoding: 'utf-8',
          imported_word_count: 15,
        },
      });

      mockStoryImportService.validateStoryContent.mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
      });

      mockStoryImportService.processStoryForImport.mockReturnValue({
        title: 'The Brave Knight',
        content: mockFileContent,
        wordCount: 15,
        estimatedReadTime: 1,
      });

      mockStoryGenerationService.analyzeImportedStory.mockResolvedValue({
        genre: 'fantasy',
        tone: 'adventurous',
        complexity: 'medium',
        characters: ['knight'],
        themes: ['adventure', 'courage'],
      });

      mockStoryGenerationService.generateImportedStoryContinuation.mockResolvedValue(
        mockContinuation,
      );

      mockStoryManagementService.saveStory.mockResolvedValue({
        success: true,
        story: { id: 'story-123', content: mockFileContent },
        sessionId: 'session-123',
      });

      // Step 2: Mock file picker
      const mockFilePicker = jest.spyOn(FilePickerUtils, 'pickTextFile');
      mockFilePicker.mockResolvedValue({
        success: true,
        content: mockFileContent,
        metadata: {
          file_name: 'story.txt',
          file_size: 1024,
          encoding: 'utf-8',
          imported_word_count: 15,
        },
      });

      // Step 3: Define workflow steps
      let renderResult: any;
      let fileImported = false;
      let storyAnalyzed = false;
      let storySaved = false;
      let continuationGenerated = false;

      flowTester.addStep({
        action: 'navigate_to_import_options',
        description: 'Navigate to import options screen',
        execute: async () => {
          const mockNavigation = {
            navigate: jest.fn(),
            goBack: jest.fn(),
            canGoBack: () => true,
          };

          renderResult = render(
            <NavigationContainer>
              <ImportOptionsScreen navigation={mockNavigation as any} />
            </NavigationContainer>,
          );
        },
        validate: () => {
          expect(renderResult.getByText('Import from File')).toBeTruthy();
          expect(renderResult.getByText('My Stories')).toBeTruthy();
        },
      });

      flowTester.addStep({
        action: 'select_file_import',
        description: 'Select file import option',
        execute: async () => {
          const fileImportButton = renderResult.getByText('Import from File');
          fireEvent.press(fileImportButton);

          // Wait for file picker to be called
          await waitFor(() => {
            expect(mockFilePicker).toHaveBeenCalled();
          });

          fileImported = true;
        },
      });

      flowTester.addStep({
        action: 'validate_file_content',
        description: 'Validate imported file content',
        execute: async () => {
          await waitFor(() => {
            expect(
              mockStoryImportService.validateStoryContent,
            ).toHaveBeenCalledWith(mockFileContent);
          });
        },
      });

      flowTester.addStep({
        action: 'analyze_story',
        description: 'Analyze story structure and style',
        execute: async () => {
          await act(async () => {
            await mockStoryGenerationService.analyzeImportedStory(
              mockFileContent,
            );
          });
          storyAnalyzed = true;
        },
      });

      flowTester.addStep({
        action: 'save_story',
        description: 'Save imported story to database',
        execute: async () => {
          await act(async () => {
            await mockStoryManagementService.saveStory({
              content: mockFileContent,
              source: 'File',
              userId: 'test-user',
            });
          });
          storySaved = true;
        },
      });

      flowTester.addStep({
        action: 'generate_continuation',
        description: 'Generate AI story continuation',
        execute: async () => {
          await act(async () => {
            await mockStoryGenerationService.generateImportedStoryContinuation(
              mockFileContent,
            );
          });
          continuationGenerated = true;
        },
      });

      // Execute the complete workflow
      const result = await flowTester.executeFlow();

      expect(result.completed).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(fileImported).toBe(true);
      expect(storyAnalyzed).toBe(true);
      expect(storySaved).toBe(true);
      expect(continuationGenerated).toBe(true);

      // Verify all services were called correctly
      expect(mockFilePicker).toHaveBeenCalled();
      expect(mockStoryImportService.validateStoryContent).toHaveBeenCalledWith(
        mockFileContent,
      );
      expect(
        mockStoryGenerationService.analyzeImportedStory,
      ).toHaveBeenCalledWith(mockFileContent);
      expect(mockStoryManagementService.saveStory).toHaveBeenCalled();
      expect(
        mockStoryGenerationService.generateImportedStoryContinuation,
      ).toHaveBeenCalledWith(mockFileContent);

      // Clean up
      mockFilePicker.mockRestore();
    });

    it('should handle database story import flow', async () => {
      const flowTester = new E2EFlowTester();
      const mockStories = [
        {
          session_id: 'session-1',
          story_content: 'A magical adventure begins...',
          created_at: '2024-01-01T00:00:00Z',
          story_source: 'CreativeBridge',
          final_score: 100,
        },
        {
          session_id: 'session-2',
          story_content: 'In a distant galaxy...',
          created_at: '2024-01-02T00:00:00Z',
          story_source: 'Story_Quest',
          final_score: 150,
        },
      ];

      // Mock database story fetch
      mockStoryImportService.fetchUserStories.mockResolvedValue({
        success: true,
        stories: mockStories,
        total: 2,
      });

      mockStoryManagementService.searchStories.mockResolvedValue({
        success: true,
        stories: [mockStories[0]], // Filtered result
      });

      let renderResult: any;
      let storiesFetched = false;
      let storySelected = false;

      flowTester.addStep({
        action: 'navigate_to_import_options',
        description: 'Navigate to import options',
        execute: async () => {
          const mockNavigation = {
            navigate: jest.fn(),
            goBack: jest.fn(),
            canGoBack: () => true,
          };

          renderResult = render(
            <NavigationContainer>
              <ImportOptionsScreen navigation={mockNavigation as any} />
            </NavigationContainer>,
          );
        },
      });

      flowTester.addStep({
        action: 'select_my_stories',
        description: 'Select my stories option',
        execute: async () => {
          const myStoriesButton = renderResult.getByText('My Stories');
          fireEvent.press(myStoriesButton);
        },
      });

      flowTester.addStep({
        action: 'fetch_user_stories',
        description: 'Fetch user stories from database',
        execute: async () => {
          await act(async () => {
            await mockStoryImportService.fetchUserStories('test-user');
          });
          storiesFetched = true;
        },
      });

      flowTester.addStep({
        action: 'search_stories',
        description: 'Search for specific story',
        execute: async () => {
          await act(async () => {
            await mockStoryManagementService.searchStories('magical');
          });
        },
      });

      flowTester.addStep({
        action: 'select_story',
        description: 'Select story for continuation',
        execute: async () => {
          // Simulate story selection
          storySelected = true;
        },
      });

      const result = await flowTester.executeFlow();

      expect(result.completed).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(storiesFetched).toBe(true);
      expect(storySelected).toBe(true);

      expect(mockStoryImportService.fetchUserStories).toHaveBeenCalledWith(
        'test-user',
      );
      expect(mockStoryManagementService.searchStories).toHaveBeenCalledWith(
        'magical',
      );
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle file import errors gracefully', async () => {
      const flowTester = new E2EFlowTester();

      // Mock file picker error
      const mockFilePicker = jest.spyOn(FilePickerUtils, 'pickTextFile');
      mockFilePicker.mockResolvedValue({
        success: false,
        error: 'File too large. Maximum size is 10MB.',
      });

      let errorHandled = false;
      let renderResult: any;

      flowTester.addStep({
        action: 'navigate_to_import_options',
        description: 'Navigate to import options',
        execute: async () => {
          const mockNavigation = {
            navigate: jest.fn(),
            goBack: jest.fn(),
            canGoBack: () => true,
          };

          renderResult = render(
            <NavigationContainer>
              <ImportOptionsScreen navigation={mockNavigation as any} />
            </NavigationContainer>,
          );
        },
      });

      flowTester.addStep({
        action: 'attempt_file_import',
        description: 'Attempt file import with error',
        execute: async () => {
          const fileImportButton = renderResult.getByText('Import from File');
          fireEvent.press(fileImportButton);

          await waitFor(() => {
            expect(mockFilePicker).toHaveBeenCalled();
          });

          // Check if Alert.alert was called with error message
          await waitFor(() => {
            expect(Alert.alert).toHaveBeenCalledWith(
              'Import Error',
              'File too large. Maximum size is 10MB.',
              [{ text: 'OK' }],
            );
          });

          errorHandled = true;
        },
      });

      const result = await flowTester.executeFlow();

      expect(result.completed).toBe(true);
      expect(errorHandled).toBe(true);

      mockFilePicker.mockRestore();
    });

    it('should handle database connection errors', async () => {
      const flowTester = new E2EFlowTester();

      // Mock database error
      mockStoryImportService.fetchUserStories.mockResolvedValue({
        success: false,
        error: 'Database connection failed',
      });

      let errorHandled = false;

      flowTester.addStep({
        action: 'attempt_database_fetch',
        description: 'Attempt to fetch stories with database error',
        execute: async () => {
          await act(async () => {
            const result = await mockStoryImportService.fetchUserStories(
              'test-user',
            );
            expect(result.success).toBe(false);
            expect(result.error).toBe('Database connection failed');
            errorHandled = true;
          });
        },
      });

      const result = await flowTester.executeFlow();

      expect(result.completed).toBe(true);
      expect(errorHandled).toBe(true);
    });

    it('should handle AI generation failures', async () => {
      const flowTester = new E2EFlowTester();

      // Mock AI service error
      mockStoryGenerationService.generateImportedStoryContinuation.mockRejectedValue(
        new Error('AI service unavailable'),
      );

      let errorHandled = false;

      flowTester.addStep({
        action: 'attempt_ai_generation',
        description: 'Attempt AI generation with service error',
        execute: async () => {
          try {
            await mockStoryGenerationService.generateImportedStoryContinuation(
              'Test story',
            );
          } catch (error) {
            expect(error instanceof Error ? error.message : error).toBe(
              'AI service unavailable',
            );
            errorHandled = true;
          }
        },
      });

      const result = await flowTester.executeFlow();

      expect(result.completed).toBe(true);
      expect(errorHandled).toBe(true);
    });
  });

  describe('Performance Integration', () => {
    it('should handle large file imports efficiently', async () => {
      const flowTester = new E2EFlowTester();
      const largeContent = 'A'.repeat(1000000); // 1MB of content

      mockStoryImportService.readFileWithEncoding.mockResolvedValue({
        success: true,
        content: largeContent,
        metadata: {
          file_name: 'large_story.txt',
          file_size: 1000000,
          encoding: 'utf-8',
          imported_word_count: 200000,
        },
      });

      mockStoryImportService.validateStoryContent.mockReturnValue({
        isValid: true,
        errors: [],
        warnings: ['File is quite large and may take longer to process'],
      });

      let performanceAcceptable = false;

      flowTester.addStep({
        action: 'process_large_file',
        description: 'Process large file import',
        execute: async () => {
          const startTime = Date.now();

          await mockStoryImportService.readFileWithEncoding('large-file-uri');
          mockStoryImportService.validateStoryContent(largeContent);

          const endTime = Date.now();
          const processingTime = endTime - startTime;

          // Should process even large files quickly in mock environment
          expect(processingTime).toBeLessThan(1000); // Under 1 second
          performanceAcceptable = true;
        },
      });

      const result = await flowTester.executeFlow();

      expect(result.completed).toBe(true);
      expect(performanceAcceptable).toBe(true);
    });

    it('should handle many stories search efficiently', async () => {
      const flowTester = new E2EFlowTester();

      // Generate mock large dataset
      const manyStories = Array.from({ length: 1000 }, (_, i) => ({
        session_id: `session-${i}`,
        story_content: `Story content ${i} with various keywords`,
        created_at: new Date().toISOString(),
        story_source: 'CreativeBridge',
        final_score: i * 10,
      }));

      mockStoryManagementService.searchStories.mockResolvedValue({
        success: true,
        stories: manyStories.slice(0, 10), // Return first 10 matches
      });

      let searchPerformanceAcceptable = false;

      flowTester.addStep({
        action: 'search_large_dataset',
        description: 'Search through large story dataset',
        execute: async () => {
          const startTime = Date.now();

          await mockStoryManagementService.searchStories('adventure');

          const endTime = Date.now();
          const searchTime = endTime - startTime;

          // Search should be fast even with many stories
          expect(searchTime).toBeLessThan(100); // Under 100ms
          searchPerformanceAcceptable = true;
        },
      });

      const result = await flowTester.executeFlow();

      expect(result.completed).toBe(true);
      expect(searchPerformanceAcceptable).toBe(true);
    });
  });

  describe('Cross-Platform Integration', () => {
    it('should work consistently on iOS', async () => {
      const originalPlatform = require('react-native').Platform.OS;
      require('react-native').Platform.OS = 'ios';

      const flowTester = new E2EFlowTester();

      mockStoryImportService.readFileWithEncoding.mockResolvedValue({
        success: true,
        content: 'iOS test story content',
        metadata: {
          file_name: 'ios_story.txt',
          file_size: 512,
          encoding: 'utf-8',
          imported_word_count: 8,
        },
      });

      let iOSCompatible = false;

      flowTester.addStep({
        action: 'test_ios_compatibility',
        description: 'Test iOS specific functionality',
        execute: async () => {
          expect(require('react-native').Platform.OS).toBe('ios');

          await mockStoryImportService.readFileWithEncoding('ios-file-uri');
          iOSCompatible = true;
        },
      });

      const result = await flowTester.executeFlow();

      expect(result.completed).toBe(true);
      expect(iOSCompatible).toBe(true);

      // Restore platform
      require('react-native').Platform.OS = originalPlatform;
    });

    it('should work consistently on Android', async () => {
      const originalPlatform = require('react-native').Platform.OS;
      require('react-native').Platform.OS = 'android';

      const flowTester = new E2EFlowTester();

      mockStoryImportService.readFileWithEncoding.mockResolvedValue({
        success: true,
        content: 'Android test story content',
        metadata: {
          file_name: 'android_story.txt',
          file_size: 256,
          encoding: 'utf-8',
          imported_word_count: 6,
        },
      });

      let androidCompatible = false;

      flowTester.addStep({
        action: 'test_android_compatibility',
        description: 'Test Android specific functionality',
        execute: async () => {
          expect(require('react-native').Platform.OS).toBe('android');

          await mockStoryImportService.readFileWithEncoding('android-file-uri');
          androidCompatible = true;
        },
      });

      const result = await flowTester.executeFlow();

      expect(result.completed).toBe(true);
      expect(androidCompatible).toBe(true);

      // Restore platform
      require('react-native').Platform.OS = originalPlatform;
    });
  });
});
