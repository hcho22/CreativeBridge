// Story Import Error Handler
// Specialized error handling for story import operations with user-friendly messaging and retry logic

import {
  errorHandler,
  ErrorLevel,
  ErrorCategory,
  ErrorContext,
} from '../services/errorHandler';
import { Alert } from 'react-native';

export enum StoryImportErrorType {
  FILE_SELECTION_CANCELLED = 'FILE_SELECTION_CANCELLED',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  FILE_INVALID_FORMAT = 'FILE_INVALID_FORMAT',
  FILE_CORRUPTED = 'FILE_CORRUPTED',
  FILE_PERMISSION_DENIED = 'FILE_PERMISSION_DENIED',
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  NETWORK_CONNECTION_ERROR = 'NETWORK_CONNECTION_ERROR',
  DATABASE_CONNECTION_ERROR = 'DATABASE_CONNECTION_ERROR',
  DATABASE_QUERY_ERROR = 'DATABASE_QUERY_ERROR',
  STORY_CONTENT_INVALID = 'STORY_CONTENT_INVALID',
  STORY_CONTENT_TOO_SHORT = 'STORY_CONTENT_TOO_SHORT',
  STORY_CONTENT_TOO_LONG = 'STORY_CONTENT_TOO_LONG',
  AI_SERVICE_UNAVAILABLE = 'AI_SERVICE_UNAVAILABLE',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  OFFLINE_MODE = 'OFFLINE_MODE',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export interface StoryImportError {
  type: StoryImportErrorType;
  message: string;
  userMessage: string;
  isRetryable: boolean;
  retryDelay?: number; // in milliseconds
  originalError?: Error;
  context?: any;
}

export interface RetryOptions {
  maxAttempts: number;
  baseDelay: number; // in milliseconds
  maxDelay: number; // in milliseconds
  exponentialBackoff: boolean;
}

export class StoryImportErrorHandler {
  private static defaultRetryOptions: RetryOptions = {
    maxAttempts: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 10000, // 10 seconds
    exponentialBackoff: true,
  };

  /**
   * Process and categorize story import errors
   */
  static processError(error: Error | string, context?: any): StoryImportError {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const errorType = this.categorizeError(errorMessage);

    const processedError: StoryImportError = {
      type: errorType,
      message: errorMessage,
      userMessage: this.getUserFriendlyMessage(errorType, errorMessage),
      isRetryable: this.isRetryable(errorType),
      retryDelay: this.getRetryDelay(errorType),
      originalError: typeof error === 'string' ? undefined : error,
      context,
    };

    // Log the error through the main error handler
    this.logError(processedError, context);

    return processedError;
  }

  /**
   * Handle file import errors with specific messaging
   */
  static handleFileImportError(
    error: Error | string,
    fileName?: string,
  ): StoryImportError {
    const context = { fileName, operation: 'file_import' };
    return this.processError(error, context);
  }

  /**
   * Handle database story fetch errors
   */
  static handleDatabaseError(
    error: Error | string,
    operation: string,
  ): StoryImportError {
    const context = { operation: `database_${operation}` };
    return this.processError(error, context);
  }

  /**
   * Handle network errors with retry suggestions
   */
  static handleNetworkError(
    error: Error | string,
    endpoint?: string,
  ): StoryImportError {
    const context = { endpoint, operation: 'network_request' };
    return this.processError(error, context);
  }

  /**
   * Handle AI service errors
   */
  static handleAIServiceError(error: Error | string): StoryImportError {
    const context = { operation: 'ai_story_generation' };
    return this.processError(error, context);
  }

  /**
   * Display user-friendly error alert with optional retry
   */
  static showErrorAlert(
    storyError: StoryImportError,
    onRetry?: () => void,
    onCancel?: () => void,
  ): void {
    const buttons: any[] = [];

    if (storyError.isRetryable && onRetry) {
      buttons.push({
        text: 'Retry',
        onPress: onRetry,
        style: 'default',
      });
    }

    buttons.push({
      text: 'OK',
      onPress: onCancel,
      style: storyError.isRetryable ? 'cancel' : 'default',
    });

    Alert.alert(
      this.getAlertTitle(storyError.type),
      storyError.userMessage,
      buttons,
    );
  }

  /**
   * Execute operation with automatic retry logic
   */
  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {},
  ): Promise<T> {
    const retryOptions = { ...this.defaultRetryOptions, ...options };
    let lastError: Error;

    for (let attempt = 1; attempt <= retryOptions.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        const storyError = this.processError(lastError);

        // Don't retry if error is not retryable or if this is the last attempt
        if (!storyError.isRetryable || attempt === retryOptions.maxAttempts) {
          throw lastError;
        }

        // Calculate delay for next attempt
        const delay = this.calculateRetryDelay(attempt, retryOptions);
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  /**
   * Check if network is available (simplified check)
   */
  static async checkNetworkConnectivity(): Promise<boolean> {
    try {
      // Simple connectivity check - in a real app you might use @react-native-community/netinfo
      const response = await fetch('https://httpbin.org/status/200', {
        method: 'HEAD',
        timeout: 5000,
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Handle offline mode scenarios
   */
  static handleOfflineMode(): StoryImportError {
    return {
      type: StoryImportErrorType.OFFLINE_MODE,
      message: 'Device is offline',
      userMessage:
        'You appear to be offline. Please check your internet connection and try again.',
      isRetryable: true,
      retryDelay: 2000,
    };
  }

  /**
   * Format errors specifically for file operations
   */
  static formatFileError(error: Error | string): string {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const lowerMessage = errorMessage.toLowerCase();

    if (
      lowerMessage.includes('permission denied') ||
      lowerMessage.includes('access denied')
    ) {
      return 'Permission denied. Please check app permissions for file access.';
    }

    if (
      lowerMessage.includes('file not found') ||
      lowerMessage.includes('no such file')
    ) {
      return 'The selected file could not be found. Please try selecting a different file.';
    }

    if (
      lowerMessage.includes('file too large') ||
      lowerMessage.includes('size limit')
    ) {
      return 'The selected file is too large. Please choose a file smaller than 10MB.';
    }

    if (
      lowerMessage.includes('invalid format') ||
      lowerMessage.includes('unsupported')
    ) {
      return 'Invalid file format. Please select a .txt file.';
    }

    if (
      lowerMessage.includes('corrupted') ||
      lowerMessage.includes('malformed')
    ) {
      return 'The file appears to be corrupted or unreadable. Please try a different file.';
    }

    return `File error: ${errorMessage}. Please try again with a different file.`;
  }

  /**
   * Categorize errors based on message content
   */
  private static categorizeError(errorMessage: string): StoryImportErrorType {
    const lowerMessage = errorMessage.toLowerCase();

    // File-related errors
    if (
      lowerMessage.includes('cancelled') ||
      lowerMessage.includes('user cancelled')
    ) {
      return StoryImportErrorType.FILE_SELECTION_CANCELLED;
    }
    if (
      lowerMessage.includes('file not found') ||
      lowerMessage.includes('no such file')
    ) {
      return StoryImportErrorType.FILE_NOT_FOUND;
    }
    if (
      lowerMessage.includes('too large') ||
      lowerMessage.includes('size limit')
    ) {
      return StoryImportErrorType.FILE_TOO_LARGE;
    }
    if (
      lowerMessage.includes('invalid format') ||
      lowerMessage.includes('unsupported')
    ) {
      return StoryImportErrorType.FILE_INVALID_FORMAT;
    }
    if (
      lowerMessage.includes('corrupted') ||
      lowerMessage.includes('malformed')
    ) {
      return StoryImportErrorType.FILE_CORRUPTED;
    }
    if (
      lowerMessage.includes('permission denied') ||
      lowerMessage.includes('access denied')
    ) {
      return StoryImportErrorType.FILE_PERMISSION_DENIED;
    }

    // Database-related errors (check before network to avoid confusion)
    if (lowerMessage.includes('database') || lowerMessage.includes('db')) {
      return lowerMessage.includes('connection')
        ? StoryImportErrorType.DATABASE_CONNECTION_ERROR
        : StoryImportErrorType.DATABASE_QUERY_ERROR;
    }

    // Network-related errors
    if (
      lowerMessage.includes('timeout') ||
      lowerMessage.includes('timed out')
    ) {
      return StoryImportErrorType.NETWORK_TIMEOUT;
    }
    if (
      lowerMessage.includes('network') ||
      lowerMessage.includes('connection')
    ) {
      return StoryImportErrorType.NETWORK_CONNECTION_ERROR;
    }

    // Content validation errors
    if (
      lowerMessage.includes('content too short') ||
      lowerMessage.includes('minimum length')
    ) {
      return StoryImportErrorType.STORY_CONTENT_TOO_SHORT;
    }
    if (
      lowerMessage.includes('content too long') ||
      lowerMessage.includes('maximum length')
    ) {
      return StoryImportErrorType.STORY_CONTENT_TOO_LONG;
    }
    if (
      lowerMessage.includes('invalid content') ||
      lowerMessage.includes('validation')
    ) {
      return StoryImportErrorType.STORY_CONTENT_INVALID;
    }

    // Service-related errors
    if (
      lowerMessage.includes('ai service') ||
      lowerMessage.includes('openai')
    ) {
      return StoryImportErrorType.AI_SERVICE_UNAVAILABLE;
    }
    if (
      lowerMessage.includes('rate limit') ||
      lowerMessage.includes('too many requests')
    ) {
      return StoryImportErrorType.RATE_LIMIT_EXCEEDED;
    }
    if (
      lowerMessage.includes('offline') ||
      lowerMessage.includes('no connection')
    ) {
      return StoryImportErrorType.OFFLINE_MODE;
    }

    return StoryImportErrorType.UNKNOWN_ERROR;
  }

  /**
   * Get user-friendly error messages
   */
  private static getUserFriendlyMessage(
    type: StoryImportErrorType,
    originalMessage?: string,
  ): string {
    switch (type) {
      case StoryImportErrorType.FILE_SELECTION_CANCELLED:
        return 'File selection was cancelled.';

      case StoryImportErrorType.FILE_NOT_FOUND:
        return 'The selected file could not be found. Please try selecting the file again.';

      case StoryImportErrorType.FILE_TOO_LARGE:
        return 'The selected file is too large (maximum 10MB). Please choose a smaller file.';

      case StoryImportErrorType.FILE_INVALID_FORMAT:
        return 'Invalid file format. Please select a .txt file containing your story.';

      case StoryImportErrorType.FILE_CORRUPTED:
        return 'The file appears to be corrupted or unreadable. Please try a different file.';

      case StoryImportErrorType.FILE_PERMISSION_DENIED:
        return 'Permission denied. Please check that the app has access to read files on your device.';

      case StoryImportErrorType.NETWORK_TIMEOUT:
        return 'The request timed out. Please check your internet connection and try again.';

      case StoryImportErrorType.NETWORK_CONNECTION_ERROR:
        return 'Unable to connect to the server. Please check your internet connection and try again.';

      case StoryImportErrorType.DATABASE_CONNECTION_ERROR:
        return 'Unable to connect to the database. Please try again in a few moments.';

      case StoryImportErrorType.DATABASE_QUERY_ERROR:
        return 'A database error occurred. Please try again.';

      case StoryImportErrorType.STORY_CONTENT_INVALID:
        return 'The story content is invalid. Please check that your file contains readable text.';

      case StoryImportErrorType.STORY_CONTENT_TOO_SHORT:
        return 'The story is too short. Please select a file with at least a few sentences.';

      case StoryImportErrorType.STORY_CONTENT_TOO_LONG:
        return 'The story is too long. Please select a shorter story or split it into multiple parts.';

      case StoryImportErrorType.AI_SERVICE_UNAVAILABLE:
        return 'AI story generation is currently unavailable. Please try again later.';

      case StoryImportErrorType.RATE_LIMIT_EXCEEDED:
        return 'Too many requests. Please wait a moment before trying again.';

      case StoryImportErrorType.OFFLINE_MODE:
        return 'You appear to be offline. Please check your internet connection and try again.';

      case StoryImportErrorType.UNKNOWN_ERROR:
      default:
        return originalMessage && originalMessage.length < 100
          ? `An error occurred: ${originalMessage}`
          : 'An unexpected error occurred. Please try again.';
    }
  }

  /**
   * Determine if error type is retryable
   */
  private static isRetryable(type: StoryImportErrorType): boolean {
    switch (type) {
      case StoryImportErrorType.NETWORK_TIMEOUT:
      case StoryImportErrorType.NETWORK_CONNECTION_ERROR:
      case StoryImportErrorType.DATABASE_CONNECTION_ERROR:
      case StoryImportErrorType.DATABASE_QUERY_ERROR:
      case StoryImportErrorType.AI_SERVICE_UNAVAILABLE:
      case StoryImportErrorType.RATE_LIMIT_EXCEEDED:
      case StoryImportErrorType.OFFLINE_MODE:
      case StoryImportErrorType.UNKNOWN_ERROR:
        return true;

      case StoryImportErrorType.FILE_SELECTION_CANCELLED:
      case StoryImportErrorType.FILE_NOT_FOUND:
      case StoryImportErrorType.FILE_TOO_LARGE:
      case StoryImportErrorType.FILE_INVALID_FORMAT:
      case StoryImportErrorType.FILE_CORRUPTED:
      case StoryImportErrorType.FILE_PERMISSION_DENIED:
      case StoryImportErrorType.STORY_CONTENT_INVALID:
      case StoryImportErrorType.STORY_CONTENT_TOO_SHORT:
      case StoryImportErrorType.STORY_CONTENT_TOO_LONG:
        return false;

      default:
        return false;
    }
  }

  /**
   * Get appropriate retry delay for error type
   */
  private static getRetryDelay(type: StoryImportErrorType): number {
    switch (type) {
      case StoryImportErrorType.RATE_LIMIT_EXCEEDED:
        return 5000; // 5 seconds
      case StoryImportErrorType.NETWORK_TIMEOUT:
        return 3000; // 3 seconds
      case StoryImportErrorType.OFFLINE_MODE:
        return 2000; // 2 seconds
      default:
        return 1000; // 1 second
    }
  }

  /**
   * Get alert title based on error type
   */
  private static getAlertTitle(type: StoryImportErrorType): string {
    switch (type) {
      case StoryImportErrorType.FILE_SELECTION_CANCELLED:
        return 'Import Cancelled';
      case StoryImportErrorType.FILE_NOT_FOUND:
      case StoryImportErrorType.FILE_TOO_LARGE:
      case StoryImportErrorType.FILE_INVALID_FORMAT:
      case StoryImportErrorType.FILE_CORRUPTED:
      case StoryImportErrorType.FILE_PERMISSION_DENIED:
        return 'File Error';
      case StoryImportErrorType.NETWORK_TIMEOUT:
      case StoryImportErrorType.NETWORK_CONNECTION_ERROR:
        return 'Connection Error';
      case StoryImportErrorType.DATABASE_CONNECTION_ERROR:
      case StoryImportErrorType.DATABASE_QUERY_ERROR:
        return 'Database Error';
      case StoryImportErrorType.STORY_CONTENT_INVALID:
      case StoryImportErrorType.STORY_CONTENT_TOO_SHORT:
      case StoryImportErrorType.STORY_CONTENT_TOO_LONG:
        return 'Content Error';
      case StoryImportErrorType.AI_SERVICE_UNAVAILABLE:
        return 'Service Unavailable';
      case StoryImportErrorType.RATE_LIMIT_EXCEEDED:
        return 'Rate Limit';
      case StoryImportErrorType.OFFLINE_MODE:
        return 'Offline';
      default:
        return 'Error';
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private static calculateRetryDelay(
    attempt: number,
    options: RetryOptions,
  ): number {
    if (!options.exponentialBackoff) {
      return Math.min(options.baseDelay, options.maxDelay);
    }

    const delay = options.baseDelay * Math.pow(2, attempt - 1);
    return Math.min(delay, options.maxDelay);
  }

  /**
   * Sleep utility for retry delays
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Log error through main error handler
   */
  private static async logError(
    storyError: StoryImportError,
    context?: any,
  ): Promise<void> {
    try {
      const errorContext: ErrorContext = {
        component: 'StoryImport',
        action: context?.operation || 'unknown',
        metadata: {
          errorType: storyError.type,
          isRetryable: storyError.isRetryable,
          retryDelay: storyError.retryDelay,
          ...context,
        },
      };

      // Determine error category for main error handler
      let category = ErrorCategory.SYSTEM;
      if (storyError.type.includes('FILE_')) {
        category = ErrorCategory.SYSTEM;
      } else if (storyError.type.includes('NETWORK_')) {
        category = ErrorCategory.NETWORK;
      } else if (storyError.type.includes('DATABASE_')) {
        category = ErrorCategory.DATABASE;
      } else if (storyError.type.includes('CONTENT_')) {
        category = ErrorCategory.VALIDATION;
      }

      await errorHandler.handleError(
        storyError.originalError || storyError.message,
        ErrorLevel.ERROR,
        category,
        errorContext,
      );
    } catch (logError) {
      // Don't let logging errors crash the app
      console.warn('Failed to log story import error:', logError);
    }
  }
}

export default StoryImportErrorHandler;
