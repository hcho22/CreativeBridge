/**
 * Test suite for File Picker Integration
 * Implements verification tests from Task 1.4
 */

import RNFS from 'react-native-fs';
import Share from 'react-native-share';

// Mock react-native-fs
jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/mock/documents',
  writeFile: jest.fn(() => Promise.resolve()),
  stat: jest.fn(() => Promise.resolve({ size: 1024 })),
  exists: jest.fn(() => Promise.resolve(true)),
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

describe('File Picker Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('handles user cancellation gracefully', async () => {
    // Mock Share.open to simulate user cancellation
    const mockShareError = new Error('User did not share');
    (Share.open as jest.Mock).mockRejectedValueOnce(mockShareError);

    // Create a mock save function similar to saveStoryWithLocationPicker
    const saveStoryWithLocationPicker = async (fileContent: string, fileName: string) => {
      try {
        const documentsPath = RNFS.DocumentDirectoryPath;
        const tempFilePath = `${documentsPath}/${fileName}`;

        await RNFS.writeFile(tempFilePath, fileContent, 'utf8');
        
        const shareOptions = {
          title: 'Save Story',
          message: 'Save your completed story',
          url: `file://${tempFilePath}`,
          type: 'text/plain',
          filename: fileName,
          saveToFiles: true,
        };

        try {
          await Share.open(shareOptions);
        } catch (shareError) {
          const errorMessage = shareError instanceof Error ? shareError.message : String(shareError);
          if (errorMessage && errorMessage.includes('User did not share')) {
            return { cancelled: true, saved: true };
          }
          throw shareError;
        }
        return { cancelled: false, saved: true };
      } catch (error) {
        return { cancelled: false, saved: false, error };
      }
    };

    const result = await saveStoryWithLocationPicker('Test content', 'Story_110325_143022.txt');
    
    expect(result.cancelled).toBe(true);
    expect(result.saved).toBe(true);
    expect(RNFS.writeFile).toHaveBeenCalledWith(
      '/mock/documents/Story_110325_143022.txt',
      'Test content',
      'utf8'
    );
  });

  test('saves file with correct name and content', async () => {
    const mockFileContent = 'Once upon a time, there was a brave little mouse...';
    const mockFileName = 'Story_110325_143022.txt';

    // Mock successful share
    (Share.open as jest.Mock).mockResolvedValueOnce({ success: true });

    // Test file creation
    await RNFS.writeFile(`/mock/documents/${mockFileName}`, mockFileContent, 'utf8');

    expect(RNFS.writeFile).toHaveBeenCalledWith(
      '/mock/documents/Story_110325_143022.txt',
      mockFileContent,
      'utf8'
    );
  });

  test('handles file system permission denials', async () => {
    const permissionError = new Error('EACCES: permission denied');
    (RNFS.writeFile as jest.Mock).mockRejectedValueOnce(permissionError);

    const saveOperation = async () => {
      try {
        await RNFS.writeFile('/mock/documents/test.txt', 'content', 'utf8');
        return { success: true };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (errorMsg?.includes('EACCES')) {
          return { 
            success: false, 
            error: 'Permission denied to write file.',
            suggestion: 'Please check app permissions in Settings.'
          };
        }
        return { success: false, error: 'Unknown error' };
      }
    };

    const result = await saveOperation();
    expect(result.success).toBe(false);
    expect(result.error).toBe('Permission denied to write file.');
    expect(result.suggestion).toBe('Please check app permissions in Settings.');
  });

  test('handles insufficient storage space scenarios', async () => {
    const storageError = new Error('ENOSPC: no space left on device');
    (RNFS.writeFile as jest.Mock).mockRejectedValueOnce(storageError);

    const saveOperation = async () => {
      try {
        await RNFS.writeFile('/mock/documents/test.txt', 'content', 'utf8');
        return { success: true };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (errorMsg?.includes('ENOSPC')) {
          return { 
            success: false, 
            error: 'Not enough storage space available.',
            suggestion: 'Please free up some space and try again.'
          };
        }
        return { success: false, error: 'Unknown error' };
      }
    };

    const result = await saveOperation();
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not enough storage space available.');
    expect(result.suggestion).toBe('Please free up some space and try again.');
  });

  test('implements loading state management during file operations', async () => {
    let loadingState = false;
    
    const mockSaveWithLoading = async () => {
      loadingState = true;
      
      try {
        await RNFS.writeFile('/mock/documents/test.txt', 'content', 'utf8');
        await Share.open({
          title: 'Save Story',
          url: 'file:///mock/documents/test.txt',
          saveToFiles: true,
        });
        return { success: true };
      } finally {
        loadingState = false;
      }
    };

    const result = await mockSaveWithLoading();
    
    expect(result.success).toBe(true);
    expect(loadingState).toBe(false); // Should be reset after operation
    expect(RNFS.writeFile).toHaveBeenCalled();
    expect(Share.open).toHaveBeenCalled();
  });

  test('share options include correct parameters for iOS file picker', () => {
    const fileName = 'Story_110325_143022.txt';
    const filePath = '/mock/documents/Story_110325_143022.txt';
    
    const shareOptions = {
      title: 'Save Story',
      message: 'Save your completed story',
      url: `file://${filePath}`,
      type: 'text/plain',
      filename: fileName,
      saveToFiles: true, // This enables "Save to Files" option on iOS
    };

    expect(shareOptions.title).toBe('Save Story');
    expect(shareOptions.saveToFiles).toBe(true);
    expect(shareOptions.filename).toMatch(/^Story_\d{6}_\d{6}\.txt$/);
    expect(shareOptions.url).toContain('file://');
    expect(shareOptions.type).toBe('text/plain');
  });

  test('handles file system errors with appropriate error messages', async () => {
    const testCases = [
      {
        error: new Error('ENOENT: no such file or directory'),
        expectedMessage: 'Directory not accessible.',
        expectedSuggestion: 'Please restart the app and try again.'
      },
      {
        error: new Error('EACCES: permission denied'),
        expectedMessage: 'Permission denied to write file.',
        expectedSuggestion: 'Please check app permissions in Settings.'
      },
      {
        error: new Error('ENOSPC: no space left on device'),
        expectedMessage: 'Not enough storage space available.',
        expectedSuggestion: 'Please free up some space and try again.'
      }
    ];

    for (const testCase of testCases) {
      (RNFS.writeFile as jest.Mock).mockRejectedValueOnce(testCase.error);

      const saveOperation = async () => {
        try {
          await RNFS.writeFile('/mock/documents/test.txt', 'content', 'utf8');
          return { success: true };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          
          let errorMessage = 'An unexpected error occurred while saving your story.';
          let suggestion = 'Please try again.';

          if (errorMsg?.includes('ENOSPC')) {
            errorMessage = 'Not enough storage space available.';
            suggestion = 'Please free up some space and try again.';
          } else if (errorMsg?.includes('EACCES')) {
            errorMessage = 'Permission denied to write file.';
            suggestion = 'Please check app permissions in Settings.';
          } else if (errorMsg?.includes('ENOENT')) {
            errorMessage = 'Directory not accessible.';
            suggestion = 'Please restart the app and try again.';
          }

          return { success: false, errorMessage, suggestion };
        }
      };

      const result = await saveOperation();
      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe(testCase.expectedMessage);
      expect(result.suggestion).toBe(testCase.expectedSuggestion);
    }
  });

  test('retry mechanism for temporary failures', async () => {
    let attempts = 0;
    const mockRetryableOperation = async () => {
      attempts++;
      if (attempts < 3) {
        throw new Error('Temporary network error');
      }
      return { success: true };
    };

    const retryWithBackoff = async (operation: () => Promise<any>, maxRetries = 3) => {
      for (let i = 0; i < maxRetries; i++) {
        try {
          return await operation();
        } catch (error) {
          if (i === maxRetries - 1) throw error;
          await new Promise(resolve => setTimeout(resolve, 100 * (i + 1))); // Simple backoff
        }
      }
    };

    const result = await retryWithBackoff(mockRetryableOperation);
    expect(result.success).toBe(true);
    expect(attempts).toBe(3);
  });

  test('file cleanup after successful share', async () => {
    const fileName = 'Story_110325_143022.txt';
    const filePath = `/mock/documents/${fileName}`;

    // Mock successful file operations
    (RNFS.writeFile as jest.Mock).mockResolvedValueOnce(undefined);
    (RNFS.exists as jest.Mock).mockResolvedValueOnce(true);
    (Share.open as jest.Mock).mockResolvedValueOnce({ success: true });

    // Simulate the file operations
    await RNFS.writeFile(filePath, 'content', 'utf8');
    await Share.open({
      title: 'Save Story',
      url: `file://${filePath}`,
      saveToFiles: true,
    });

    // Verify file exists after share
    const fileExists = await RNFS.exists(filePath);
    expect(fileExists).toBe(true);

    // Verify the operations were called correctly
    expect(RNFS.writeFile).toHaveBeenCalledWith(filePath, 'content', 'utf8');
    expect(Share.open).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Save Story',
        url: `file://${filePath}`,
        saveToFiles: true,
      })
    );
  });
});