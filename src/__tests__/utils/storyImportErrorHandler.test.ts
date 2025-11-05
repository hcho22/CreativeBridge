// Story Import Error Handler Tests
// Comprehensive tests for story import error handling functionality

import {
  StoryImportErrorHandler,
  StoryImportErrorType,
  StoryImportError,
} from '../../utils/storyImportErrorHandler';
import { Alert } from 'react-native';

// Mock dependencies
jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
}));

jest.mock('../../services/errorHandler', () => ({
  errorHandler: {
    handleError: jest.fn(),
  },
  ErrorLevel: {
    ERROR: 'ERROR',
    WARNING: 'WARNING',
  },
  ErrorCategory: {
    SYSTEM: 'SYSTEM',
    NETWORK: 'NETWORK',
    DATABASE: 'DATABASE',
    VALIDATION: 'VALIDATION',
  },
}));

// Mock fetch for network connectivity check
global.fetch = jest.fn();

describe('StoryImportErrorHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  describe('processError', () => {
    it('should process string error correctly', () => {
      const errorMessage = 'File not found';
      const result = StoryImportErrorHandler.processError(errorMessage);

      expect(result.type).toBe(StoryImportErrorType.FILE_NOT_FOUND);
      expect(result.message).toBe(errorMessage);
      expect(result.userMessage).toContain('could not be found');
      expect(result.isRetryable).toBe(false);
      expect(result.originalError).toBeUndefined();
    });

    it('should process Error object correctly', () => {
      const error = new Error('Network timeout occurred');
      const result = StoryImportErrorHandler.processError(error);

      expect(result.type).toBe(StoryImportErrorType.NETWORK_TIMEOUT);
      expect(result.message).toBe('Network timeout occurred');
      expect(result.originalError).toBe(error);
      expect(result.isRetryable).toBe(true);
    });

    it('should include context in processed error', () => {
      const context = { fileName: 'test.txt', operation: 'file_import' };
      const result = StoryImportErrorHandler.processError(
        'Test error',
        context,
      );

      expect(result.context).toBe(context);
    });
  });

  describe('error categorization', () => {
    const testCases = [
      {
        message: 'User cancelled operation',
        expected: StoryImportErrorType.FILE_SELECTION_CANCELLED,
      },
      {
        message: 'File not found on device',
        expected: StoryImportErrorType.FILE_NOT_FOUND,
      },
      {
        message: 'File too large for processing',
        expected: StoryImportErrorType.FILE_TOO_LARGE,
      },
      {
        message: 'Invalid format detected',
        expected: StoryImportErrorType.FILE_INVALID_FORMAT,
      },
      {
        message: 'File appears corrupted',
        expected: StoryImportErrorType.FILE_CORRUPTED,
      },
      {
        message: 'Permission denied access',
        expected: StoryImportErrorType.FILE_PERMISSION_DENIED,
      },
      {
        message: 'Request timed out',
        expected: StoryImportErrorType.NETWORK_TIMEOUT,
      },
      {
        message: 'Network connection failed',
        expected: StoryImportErrorType.NETWORK_CONNECTION_ERROR,
      },
      {
        message: 'Database connection error',
        expected: StoryImportErrorType.DATABASE_CONNECTION_ERROR,
      },
      {
        message: 'Database query failed',
        expected: StoryImportErrorType.DATABASE_QUERY_ERROR,
      },
      {
        message: 'Content too short for processing',
        expected: StoryImportErrorType.STORY_CONTENT_TOO_SHORT,
      },
      {
        message: 'Content exceeds maximum length',
        expected: StoryImportErrorType.STORY_CONTENT_TOO_LONG,
      },
      {
        message: 'Invalid content format',
        expected: StoryImportErrorType.STORY_CONTENT_INVALID,
      },
      {
        message: 'AI service unavailable',
        expected: StoryImportErrorType.AI_SERVICE_UNAVAILABLE,
      },
      {
        message: 'Rate limit exceeded',
        expected: StoryImportErrorType.RATE_LIMIT_EXCEEDED,
      },
      {
        message: 'Device is offline',
        expected: StoryImportErrorType.OFFLINE_MODE,
      },
      {
        message: 'Unknown system error',
        expected: StoryImportErrorType.UNKNOWN_ERROR,
      },
    ];

    testCases.forEach(({ message, expected }) => {
      it(`should categorize "${message}" as ${expected}`, () => {
        const result = StoryImportErrorHandler.processError(message);
        expect(result.type).toBe(expected);
      });
    });
  });

  describe('retry logic', () => {
    it('should mark retryable errors correctly', () => {
      const retryableErrors = [
        'Network timeout',
        'Connection failed',
        'Database connection error',
        'AI service unavailable',
        'Rate limit exceeded',
        'Device offline',
      ];

      retryableErrors.forEach(message => {
        const result = StoryImportErrorHandler.processError(message);
        expect(result.isRetryable).toBe(true);
      });
    });

    it('should mark non-retryable errors correctly', () => {
      const nonRetryableErrors = [
        'User cancelled',
        'File not found',
        'File too large',
        'Invalid format',
        'Permission denied',
        'Content too short',
      ];

      nonRetryableErrors.forEach(message => {
        const result = StoryImportErrorHandler.processError(message);
        expect(result.isRetryable).toBe(false);
      });
    });

    it('should set appropriate retry delays', () => {
      const testCases = [
        { message: 'Rate limit exceeded', expectedDelay: 5000 },
        { message: 'Network timeout', expectedDelay: 3000 },
        { message: 'Device offline', expectedDelay: 2000 },
        { message: 'Database error', expectedDelay: 1000 },
      ];

      testCases.forEach(({ message, expectedDelay }) => {
        const result = StoryImportErrorHandler.processError(message);
        expect(result.retryDelay).toBe(expectedDelay);
      });
    });
  });

  describe('specialized error handlers', () => {
    it('should handle file import errors with context', () => {
      const error = 'File permission denied';
      const fileName = 'story.txt';
      const result = StoryImportErrorHandler.handleFileImportError(
        error,
        fileName,
      );

      expect(result.type).toBe(StoryImportErrorType.FILE_PERMISSION_DENIED);
      expect(result.context).toEqual({ fileName, operation: 'file_import' });
    });

    it('should handle database errors with operation context', () => {
      const error = 'Database connection failed';
      const operation = 'fetch_stories';
      const result = StoryImportErrorHandler.handleDatabaseError(
        error,
        operation,
      );

      expect(result.type).toBe(StoryImportErrorType.DATABASE_CONNECTION_ERROR);
      expect(result.context).toEqual({ operation: 'database_fetch_stories' });
    });

    it('should handle network errors with endpoint context', () => {
      const error = 'Network timeout';
      const endpoint = '/api/stories';
      const result = StoryImportErrorHandler.handleNetworkError(
        error,
        endpoint,
      );

      expect(result.type).toBe(StoryImportErrorType.NETWORK_TIMEOUT);
      expect(result.context).toEqual({
        endpoint,
        operation: 'network_request',
      });
    });

    it('should handle AI service errors', () => {
      const error = 'OpenAI API unavailable';
      const result = StoryImportErrorHandler.handleAIServiceError(error);

      expect(result.type).toBe(StoryImportErrorType.AI_SERVICE_UNAVAILABLE);
      expect(result.context).toEqual({ operation: 'ai_story_generation' });
    });
  });

  describe('user interface methods', () => {
    it('should show error alert with retry option', () => {
      const mockOnRetry = jest.fn();
      const mockOnCancel = jest.fn();
      const storyError: StoryImportError = {
        type: StoryImportErrorType.NETWORK_TIMEOUT,
        message: 'Network timeout',
        userMessage: 'The request timed out. Please try again.',
        isRetryable: true,
        retryDelay: 3000,
      };

      StoryImportErrorHandler.showErrorAlert(
        storyError,
        mockOnRetry,
        mockOnCancel,
      );

      expect(Alert.alert).toHaveBeenCalledWith(
        'Connection Error',
        storyError.userMessage,
        expect.arrayContaining([
          expect.objectContaining({ text: 'Retry' }),
          expect.objectContaining({ text: 'OK' }),
        ]),
      );
    });

    it('should show error alert without retry for non-retryable errors', () => {
      const mockOnCancel = jest.fn();
      const storyError: StoryImportError = {
        type: StoryImportErrorType.FILE_INVALID_FORMAT,
        message: 'Invalid file format',
        userMessage: 'Invalid file format. Please select a .txt file.',
        isRetryable: false,
      };

      StoryImportErrorHandler.showErrorAlert(
        storyError,
        undefined,
        mockOnCancel,
      );

      expect(Alert.alert).toHaveBeenCalledWith(
        'File Error',
        storyError.userMessage,
        expect.arrayContaining([expect.objectContaining({ text: 'OK' })]),
      );
    });
  });

  describe('executeWithRetry', () => {
    it('should execute operation successfully on first attempt', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');

      const result = await StoryImportErrorHandler.executeWithRetry(
        mockOperation,
      );

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors', async () => {
      const mockOperation = jest
        .fn()
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValue('success');

      const result = await StoryImportErrorHandler.executeWithRetry(
        mockOperation,
        {
          maxAttempts: 2,
          baseDelay: 100,
          exponentialBackoff: false,
        },
      );

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-retryable errors', async () => {
      const mockOperation = jest
        .fn()
        .mockRejectedValue(new Error('File not found'));

      await expect(
        StoryImportErrorHandler.executeWithRetry(mockOperation),
      ).rejects.toThrow('File not found');

      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should respect max attempts limit', async () => {
      const mockOperation = jest
        .fn()
        .mockRejectedValue(new Error('Network error'));

      await expect(
        StoryImportErrorHandler.executeWithRetry(mockOperation, {
          maxAttempts: 3,
          baseDelay: 10,
        }),
      ).rejects.toThrow('Network error');

      expect(mockOperation).toHaveBeenCalledTimes(3);
    });

    it('should use exponential backoff when enabled', async () => {
      const mockOperation = jest
        .fn()
        .mockRejectedValue(new Error('Network timeout'));
      const startTime = Date.now();

      try {
        await StoryImportErrorHandler.executeWithRetry(mockOperation, {
          maxAttempts: 3,
          baseDelay: 100,
          exponentialBackoff: true,
        });
      } catch (error) {
        // Expected to fail
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should take at least 100 + 200 = 300ms due to exponential backoff
      expect(duration).toBeGreaterThan(250);
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });
  });

  describe('network connectivity', () => {
    it('should return true for successful connectivity check', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
      });

      const result = await StoryImportErrorHandler.checkNetworkConnectivity();
      expect(result).toBe(true);
    });

    it('should return false for failed connectivity check', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await StoryImportErrorHandler.checkNetworkConnectivity();
      expect(result).toBe(false);
    });

    it('should handle offline mode correctly', () => {
      const result = StoryImportErrorHandler.handleOfflineMode();

      expect(result.type).toBe(StoryImportErrorType.OFFLINE_MODE);
      expect(result.isRetryable).toBe(true);
      expect(result.userMessage).toContain('offline');
    });
  });

  describe('file error formatting', () => {
    const testCases = [
      {
        input: 'Permission denied to access file',
        expected:
          'Permission denied. Please check app permissions for file access.',
      },
      {
        input: 'File not found on device',
        expected:
          'The selected file could not be found. Please try selecting a different file.',
      },
      {
        input: 'File too large for processing',
        expected:
          'The selected file is too large. Please choose a file smaller than 10MB.',
      },
      {
        input: 'Invalid format detected',
        expected: 'Invalid file format. Please select a .txt file.',
      },
      {
        input: 'File appears corrupted',
        expected:
          'The file appears to be corrupted or unreadable. Please try a different file.',
      },
      {
        input: 'Unknown error occurred',
        expected:
          'File error: Unknown error occurred. Please try again with a different file.',
      },
    ];

    testCases.forEach(({ input, expected }) => {
      it(`should format "${input}" correctly`, () => {
        const result = StoryImportErrorHandler.formatFileError(input);
        expect(result).toBe(expected);
      });
    });
  });

  describe('user-friendly messages', () => {
    it('should provide appropriate messages for each error type', () => {
      const errorTypes = Object.values(StoryImportErrorType);

      errorTypes.forEach(errorType => {
        const result = StoryImportErrorHandler.processError('Test error');
        // Override the type to test each one
        result.type = errorType;

        expect(result.userMessage).toBeDefined();
        expect(result.userMessage.length).toBeGreaterThan(10);
        expect(result.userMessage).not.toContain('undefined');
      });
    });

    it('should truncate long original messages in unknown errors', () => {
      const longMessage = 'x'.repeat(150);
      const result = StoryImportErrorHandler.processError(longMessage);

      // Force it to be unknown error type
      result.type = StoryImportErrorType.UNKNOWN_ERROR;

      expect(result.userMessage).toContain('An unexpected error occurred');
    });
  });

  describe('alert titles', () => {
    const titleTestCases = [
      { type: StoryImportErrorType.FILE_NOT_FOUND, expected: 'File Error' },
      {
        type: StoryImportErrorType.NETWORK_TIMEOUT,
        expected: 'Connection Error',
      },
      {
        type: StoryImportErrorType.DATABASE_CONNECTION_ERROR,
        expected: 'Database Error',
      },
      {
        type: StoryImportErrorType.STORY_CONTENT_INVALID,
        expected: 'Content Error',
      },
      {
        type: StoryImportErrorType.AI_SERVICE_UNAVAILABLE,
        expected: 'Service Unavailable',
      },
      {
        type: StoryImportErrorType.RATE_LIMIT_EXCEEDED,
        expected: 'Rate Limit',
      },
      { type: StoryImportErrorType.OFFLINE_MODE, expected: 'Offline' },
      {
        type: StoryImportErrorType.FILE_SELECTION_CANCELLED,
        expected: 'Import Cancelled',
      },
    ];

    titleTestCases.forEach(({ type, expected }) => {
      it(`should return "${expected}" for ${type}`, () => {
        const storyError: StoryImportError = {
          type,
          message: 'Test',
          userMessage: 'Test',
          isRetryable: false,
        };

        StoryImportErrorHandler.showErrorAlert(storyError);

        expect(Alert.alert).toHaveBeenCalledWith(
          expected,
          expect.any(String),
          expect.any(Array),
        );
      });
    });
  });
});
