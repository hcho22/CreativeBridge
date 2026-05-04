/**
 * Story Download Service
 * Handles file generation and saving for completed stories
 * Enhanced with robust error handling and recovery mechanisms (Task 2.4)
 */

import { StoryDownloadOptions, DownloadResult } from '../types/storyDownload';
import { GameSession } from '../types/database';
import * as RNFS from '../utils/rnfsWrapper';
import Share from '../utils/shareWrapper';
import { enhancedErrorHandling } from './enhancedErrorHandling';
import { networkMonitor } from './networkMonitor';

export class StoryDownloadService {
  /**
   * Generates a formatted text file content from story data
   * Excludes metadata like word count, challenges, etc.
   * Preserves story formatting and paragraph breaks
   */
  generateStoryFile(options: StoryDownloadOptions): string {
    const { content, title } = options;

    if (!content) {
      throw new Error('Story content is required for file generation');
    }

    // Clean and format the story content
    let formattedContent = content.trim();

    // Ensure proper paragraph breaks
    formattedContent = formattedContent
      .replace(/\n\s*\n/g, '\n\n') // Normalize paragraph breaks
      .replace(/([.!?])\s*([A-Z])/g, '$1\n\n$2') // Add breaks after sentences that start new paragraphs
      .replace(/\n{3,}/g, '\n\n'); // Remove excessive line breaks

    // Build the final file content
    let fileContent = '';

    // Add title if provided
    if (title) {
      fileContent += `${title}\n\n`;
    }

    // Add the story content
    fileContent += formattedContent;

    // Ensure file ends with a single newline
    if (!fileContent.endsWith('\n')) {
      fileContent += '\n';
    }

    return fileContent;
  }

  /**
   * Generates a filename with the format Story_[MMDDYY]_[HHMMSS].txt
   * Uses current timestamp for uniqueness
   */
  generateFileName(): string {
    const now = new Date();

    // Format date as MMDDYY
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    const dateStr = `${month}${day}${year}`;

    // Format time as HHMMSS (24-hour format)
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timeStr = `${hours}${minutes}${seconds}`;

    return `Story_${dateStr}_${timeStr}.txt`;
  }

  /**
   * Creates story download options from a completed game session
   * Extracts relevant story data and formats it for download
   */
  createDownloadOptionsFromSession(session: GameSession): StoryDownloadOptions {
    if (!session.story_content) {
      throw new Error('Game session does not contain story content');
    }

    // Generate a title based on session data
    const dateCreated = session.completed_at || session.created_at;
    const formattedDate = new Date(dateCreated).toLocaleDateString();
    const title = `My Story - ${formattedDate}`;

    return {
      storyId: session.id,
      content: session.story_content,
      title,
    };
  }

  /**
   * Validates story content before file generation
   * Ensures content meets basic requirements for download
   */
  validateStoryContent(content: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (typeof content !== 'string') {
      errors.push('Story content must be a non-empty string');
      return {
        isValid: false,
        errors,
      };
    }

    const trimmedContent = content.trim();

    if (trimmedContent.length === 0) {
      errors.push('Story content cannot be empty');
    }

    if (trimmedContent.length > 0 && trimmedContent.length < 10) {
      errors.push('Story content is too short (minimum 10 characters)');
    }

    if (trimmedContent.length > 100000) {
      errors.push('Story content is too long (maximum 100,000 characters)');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Estimates the file size in bytes for the generated content
   * Useful for storage space checks
   */
  estimateFileSize(content: string): number {
    // UTF-8 encoding: most characters are 1 byte, some are 2-4 bytes
    // This is a conservative estimate
    // RN's BlobOptions requires both `type` and `lastModified`; we only need
    // .size which is independent of options, so omit them.
    return new Blob([content]).size;
  }

  /**
   * Generates a preview of the story file content
   * Returns first few lines for user confirmation
   */
  generatePreview(options: StoryDownloadOptions, maxLines: number = 5): string {
    const fullContent = this.generateStoryFile(options);
    const lines = fullContent.split('\n');
    const previewLines = lines.slice(0, maxLines);

    if (lines.length > maxLines) {
      previewLines.push('...');
    }

    return previewLines.join('\n');
  }

  /**
   * Creates download options from story content with automatic metadata extraction
   * Useful when downloading stories from various sources
   */
  createDownloadOptionsFromContent(
    storyId: string,
    content: string,
    customTitle?: string,
  ): StoryDownloadOptions {
    // Extract first line as potential title if not provided
    let title = customTitle;
    if (!title) {
      const lines = content.trim().split('\n');
      const firstLine = lines[0]?.trim();

      // Use first line as title if it's short and doesn't end with punctuation
      if (firstLine && firstLine.length <= 50 && !/[.!?]$/.test(firstLine)) {
        title = firstLine;
      } else {
        title = 'My Story';
      }
    }

    return {
      storyId,
      content,
      title,
    };
  }

  /**
   * Sanitizes filename to ensure it's valid for file systems
   * Removes or replaces invalid characters
   */
  sanitizeFileName(fileName: string): string {
    // Remove or replace invalid characters for most file systems
    return fileName
      .replace(/[<>:"/\\|?*]/g, '_') // Replace invalid chars with underscore
      .replace(/\s+/g, '_') // Replace spaces with underscore
      .replace(/_+/g, '_') // Replace multiple underscores with single
      .replace(/^_|_$/g, '') // Remove leading/trailing underscores
      .substring(0, 100); // Limit length
  }

  /**
   * Generates download statistics for analytics
   * Returns metadata about the download operation
   */
  generateDownloadStats(options: StoryDownloadOptions): {
    contentLength: number;
    wordCount: number;
    paragraphCount: number;
    estimatedFileSize: number;
  } {
    const content = options.content;
    const fileContent = this.generateStoryFile(options);

    const wordCount = content
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0).length;
    const paragraphCount = content
      .split(/\n\s*\n/)
      .filter(p => p.trim().length > 0).length;

    return {
      contentLength: content.length,
      wordCount,
      paragraphCount,
      estimatedFileSize: this.estimateFileSize(fileContent),
    };
  }

  /**
   * Enhanced download with automatic retry and error recovery (Task 2.4)
   * Includes offline queueing, retry mechanisms, and comprehensive error handling
   */
  async downloadStoryWithRecovery(options: {
    storyContent: string;
    fileName?: string;
    userId: string;
    sessionId: string;
    maxRetries?: number;
  }): Promise<DownloadResult> {
    const {
      storyContent,
      fileName,
      userId,
      sessionId,
      maxRetries = 3,
    } = options;

    try {
      // Check network connectivity first
      const networkStatus = networkMonitor.getCurrentStatus();
      if (!networkStatus.isConnected) {
        console.log('📵 Offline - queueing download');

        const queueId = await enhancedErrorHandling.queueDownload({
          storyContent,
          fileName: fileName || this.generateFileName(),
          userId,
          sessionId,
          priority: 'normal',
          maxRetries,
        });

        return {
          success: false,
          queued: true,
          queueId,
          error: 'Download queued - will retry when online',
        };
      }

      // Check storage space
      const requiredSpace = this.estimateFileSize(storyContent) * 2; // Extra buffer
      const storageCheck = await enhancedErrorHandling.checkStorageSpace(
        requiredSpace,
      );

      if (!storageCheck.available) {
        return {
          success: false,
          error: 'Insufficient storage space',
          errorType: 'storage_full',
          storageInfo: storageCheck,
        };
      }

      // Execute download with retry mechanism
      const result = await enhancedErrorHandling.retryWithBackoff(
        () => this.saveStoryFile(storyContent, fileName),
        {
          operationName: 'story_download',
          fileName: fileName || this.generateFileName(),
          userId,
          maxRetries,
        },
      );

      return result;
    } catch (error) {
      console.error('❌ Enhanced download failed:', error);

      // Queue the download for later retry
      try {
        const queueId = await enhancedErrorHandling.queueDownload({
          storyContent,
          fileName: fileName || this.generateFileName(),
          userId,
          sessionId,
          priority: 'normal',
          maxRetries,
        });

        return {
          success: false,
          queued: true,
          queueId,
          error:
            error instanceof Error
              ? error.message
              : 'Download failed - queued for retry',
        };
      } catch (queueError) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Download failed',
        };
      }
    }
  }

  /**
   * Saves story file using iOS native file picker integration
   * Uses share sheet to allow user to choose save location
   */
  async saveStoryFile(
    content: string,
    fileName?: string,
  ): Promise<DownloadResult> {
    try {
      const finalFileName = fileName || this.generateFileName();

      // Check if RNFS is in simulation mode (getter on the singleton instance)
      if (RNFS.default.isSimulationMode) {
        console.log(
          '📁 [StoryDownload] RNFS in simulation mode - sharing content directly',
        );

        // In simulation mode, share content directly without file system
        const shareOptions = {
          title: 'Save Story',
          message: 'Save your completed story',
          filename: finalFileName,
          type: 'text/plain',
          saveToFiles: true,
          // Use data URL for direct content sharing
          url: `data:text/plain;charset=utf-8;base64,${btoa(content)}`,
        };

        try {
          await Share.open(shareOptions);

          return {
            success: true,
            fileName: finalFileName,
            filePath: 'shared_directly', // No file path in simulation mode
          };
        } catch (shareError) {
          const errorMessage =
            shareError instanceof Error
              ? shareError.message
              : String(shareError);
          if (errorMessage && errorMessage.includes('User did not share')) {
            return {
              success: true,
              cancelled: true,
              fileName: finalFileName,
              filePath: 'shared_directly',
            };
          }
          throw shareError;
        }
      }

      // For real device: Create temporary file in app's Documents directory
      const documentsPath = RNFS.DocumentDirectoryPath;
      const tempFilePath = `${documentsPath}/${finalFileName}`;

      // Write the file to temporary location
      await RNFS.writeFile(tempFilePath, content, 'utf8');

      // Use iOS share sheet to let user choose save location
      const shareOptions = {
        title: 'Save Story',
        message: 'Save your completed story',
        url: `file://${tempFilePath}`,
        type: 'text/plain',
        filename: finalFileName,
        saveToFiles: true, // This enables "Save to Files" option on iOS
      };

      try {
        await Share.open(shareOptions);

        return {
          success: true,
          fileName: finalFileName,
          filePath: tempFilePath,
        };
      } catch (shareError) {
        // Handle user cancellation gracefully
        const errorMessage =
          shareError instanceof Error ? shareError.message : String(shareError);
        if (errorMessage && errorMessage.includes('User did not share')) {
          return {
            success: true,
            cancelled: true,
            fileName: finalFileName,
            filePath: tempFilePath,
          };
        }
        throw shareError;
      }
    } catch (error) {
      console.error('❌ File save operation failed:', error);

      // Provide specific error messages based on error type
      const errorMsg = error instanceof Error ? error.message : String(error);
      let errorMessage =
        'An unexpected error occurred while saving your story.';

      if (errorMsg?.includes('ENOSPC')) {
        errorMessage = 'Not enough storage space available.';
      } else if (errorMsg?.includes('EACCES')) {
        errorMessage = 'Permission denied to write file.';
      } else if (errorMsg?.includes('ENOENT')) {
        errorMessage = 'Directory not accessible.';
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}

// Export singleton instance
export const storyDownloadService = new StoryDownloadService();

// Export default
export default storyDownloadService;
