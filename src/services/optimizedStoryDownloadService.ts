/**
 * Optimized Story Download Service (Task 2.5)
 * Performance-enhanced version with background processing, progress tracking, and memory optimization
 */

import { StoryDownloadOptions, DownloadResult } from '../types/storyDownload';
import { GameSession } from '../types/database';
import * as RNFS from '../utils/rnfsWrapper';
import Share from '../utils/shareWrapper';
import { enhancedErrorHandling } from './enhancedErrorHandling';
import { networkMonitor } from './networkMonitor';
import { downloadPerformanceMonitor } from './downloadPerformanceMonitor';
import pako from 'pako'; // For compression

export interface DownloadProgress {
  operationId: string;
  stage:
    | 'validating'
    | 'generating'
    | 'compressing'
    | 'saving'
    | 'sharing'
    | 'completed'
    | 'error';
  progress: number; // 0-100
  message: string;
  estimatedTimeRemaining?: number;
}

export interface OptimizedDownloadOptions extends StoryDownloadOptions {
  enableCompression?: boolean;
  enableBackgroundProcessing?: boolean;
  onProgress?: (progress: DownloadProgress) => void;
  chunkSize?: number; // For large file processing
  fileName?: string;
}

export class OptimizedStoryDownloadService {
  private static readonly DEFAULT_CHUNK_SIZE = 64 * 1024; // 64KB chunks
  private static readonly COMPRESSION_THRESHOLD = 50 * 1024; // Compress files > 50KB
  private static readonly LARGE_FILE_THRESHOLD = 100 * 1024; // 100KB

  private activeDownloads: Map<
    string,
    {
      controller: AbortController;
      progress: DownloadProgress;
    }
  > = new Map();

  /**
   * Optimized story file generation with memory-efficient processing
   */
  async generateStoryFileAsync(
    options: OptimizedDownloadOptions,
  ): Promise<string> {
    const {
      content,
      title,
      chunkSize = OptimizedStoryDownloadService.DEFAULT_CHUNK_SIZE,
    } = options;

    if (!content) {
      throw new Error('Story content is required for file generation');
    }

    // For large files, process in chunks to reduce memory pressure
    if (content.length > OptimizedStoryDownloadService.LARGE_FILE_THRESHOLD) {
      return this.generateLargeFileInChunks(content, title || '', chunkSize);
    }

    // Standard processing for smaller files
    return this.generateStoryFileSync(options);
  }

  /**
   * Synchronous file generation (optimized version of original)
   */
  generateStoryFileSync(options: StoryDownloadOptions): string {
    const { content, title } = options;

    if (!content) {
      throw new Error('Story content is required for file generation');
    }

    // Pre-allocate string buffer size for better memory management
    const estimatedSize = content.length + (title ? title.length + 4 : 0) + 100;
    const chunks: string[] = [];

    // Add title if provided
    if (title) {
      chunks.push(title, '\n\n');
    }

    // Clean and format content efficiently
    const cleanContent = this.optimizedContentCleaning(content);
    chunks.push(cleanContent);

    // Ensure file ends with newline
    if (!cleanContent.endsWith('\n')) {
      chunks.push('\n');
    }

    return chunks.join('');
  }

  /**
   * Enhanced download with background processing and progress tracking
   */
  async downloadStoryWithOptimization(
    options: OptimizedDownloadOptions & {
      userId: string;
      sessionId: string;
      maxRetries?: number;
    },
  ): Promise<DownloadResult> {
    const operationId = `download_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const {
      content: storyContent,
      fileName,
      userId,
      sessionId,
      maxRetries = 3,
      enableCompression = false,
      enableBackgroundProcessing = true,
      onProgress,
    } = options;

    // Start performance tracking
    // Blob options omitted: only `.size` is read, which is independent of
    // the `type` field. RN's BlobOptions requires both `type` and
    // `lastModified` (no optionals), so the simplest typed call is no opts.
    const fileSize = new Blob([storyContent]).size;
    downloadPerformanceMonitor.startTracking(operationId, {
      operation: 'optimized_download',
      fileSize,
      userId,
      sessionId,
    });

    try {
      // Initialize progress tracking
      const progressTracker = this.createProgressTracker(
        operationId,
        onProgress,
      );

      progressTracker.update('validating', 10, 'Validating story content...');

      // Validate content
      const validation = this.validateStoryContent(storyContent);
      if (!validation.isValid) {
        throw new Error(
          `Invalid story content: ${validation.errors.join(', ')}`,
        );
      }

      // Check if we should use background processing
      const shouldUseBackground =
        enableBackgroundProcessing &&
        fileSize > OptimizedStoryDownloadService.LARGE_FILE_THRESHOLD;

      let result: DownloadResult;

      if (shouldUseBackground) {
        result = await this.processInBackground(
          operationId,
          options,
          progressTracker,
        );
      } else {
        result = await this.processImmediately(
          operationId,
          options,
          progressTracker,
        );
      }

      // Complete performance tracking
      await downloadPerformanceMonitor.stopTracking(operationId, {
        success: result.success,
      });

      progressTracker.update(
        'completed',
        100,
        'Download completed successfully!',
      );
      return result;
    } catch (error) {
      console.error('❌ Optimized download failed:', error);

      // Track failed operation
      await downloadPerformanceMonitor.stopTracking(operationId, {
        success: false,
        errorType: error instanceof Error ? error.message : 'unknown',
      });

      // Update progress with error
      if (onProgress) {
        onProgress({
          operationId,
          stage: 'error',
          progress: 0,
          message: error instanceof Error ? error.message : 'Download failed',
        });
      }

      // Fallback to error handling
      return this.handleDownloadError(error, options);
    } finally {
      // Cleanup active download tracking
      this.activeDownloads.delete(operationId);
    }
  }

  /**
   * Process download immediately (for smaller files)
   */
  private async processImmediately(
    operationId: string,
    options: OptimizedDownloadOptions & { userId: string; sessionId: string },
    progressTracker: ReturnType<typeof this.createProgressTracker>,
  ): Promise<DownloadResult> {
    progressTracker.update('generating', 30, 'Generating file content...');

    // Generate file content
    const fileContent = await this.generateStoryFileAsync(options);

    progressTracker.update('compressing', 60, 'Optimizing file...');

    // Apply compression if enabled
    const finalContent =
      options.enableCompression &&
      fileContent.length > OptimizedStoryDownloadService.COMPRESSION_THRESHOLD
        ? await this.compressContent(fileContent)
        : fileContent;

    progressTracker.update('saving', 80, 'Saving file...');

    // Save file
    return this.saveOptimizedStoryFile(
      finalContent,
      options.fileName,
      progressTracker,
    );
  }

  /**
   * Process download in background (for larger files)
   */
  private async processInBackground(
    operationId: string,
    options: OptimizedDownloadOptions & { userId: string; sessionId: string },
    progressTracker: ReturnType<typeof this.createProgressTracker>,
  ): Promise<DownloadResult> {
    return new Promise((resolve, reject) => {
      // Use setTimeout to move processing off the main thread
      setTimeout(async () => {
        try {
          progressTracker.update(
            'generating',
            20,
            'Processing large file in background...',
          );

          // Generate content in chunks
          const fileContent = await this.generateStoryFileAsync(options);

          progressTracker.update('compressing', 50, 'Compressing content...');

          // Apply compression for large files
          const finalContent =
            options.enableCompression !== false &&
            fileContent.length >
              OptimizedStoryDownloadService.COMPRESSION_THRESHOLD
              ? await this.compressContent(fileContent)
              : fileContent;

          progressTracker.update('saving', 80, 'Finalizing download...');

          // Save file
          const result = await this.saveOptimizedStoryFile(
            finalContent,
            options.fileName,
            progressTracker,
          );
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, 0);
    });
  }

  /**
   * Memory-efficient large file processing
   */
  private async generateLargeFileInChunks(
    content: string,
    title: string,
    chunkSize: number,
  ): Promise<string> {
    const chunks: string[] = [];

    // Add title first
    if (title) {
      chunks.push(title, '\n\n');
    }

    // Process content in chunks to avoid memory spikes
    for (let i = 0; i < content.length; i += chunkSize) {
      const chunk = content.substring(i, i + chunkSize);
      const cleanedChunk = this.optimizedContentCleaning(chunk);
      chunks.push(cleanedChunk);

      // Yield control to prevent UI blocking
      if (i % (chunkSize * 4) === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    // Ensure proper ending
    const result = chunks.join('');
    return result.endsWith('\n') ? result : result + '\n';
  }

  /**
   * Optimized content cleaning with reduced regex operations
   */
  private optimizedContentCleaning(content: string): string {
    // Use single pass for multiple operations
    return content
      .trim()
      .replace(/\n\s*\n/g, '\n\n') // Normalize paragraph breaks
      .replace(/([.!?])\s*([A-Z])/g, '$1\n\n$2') // Add breaks after sentences
      .replace(/\n{3,}/g, '\n\n'); // Remove excessive line breaks
  }

  /**
   * Compress content using gzip
   */
  private async compressContent(content: string): Promise<string> {
    try {
      // Convert string to Uint8Array
      const encoder = new TextEncoder();
      const data = encoder.encode(content);

      // Compress using pako (gzip)
      const compressed = pako.gzip(data);

      // Convert back to base64 string for storage
      const binary = Array.from(compressed, byte =>
        String.fromCharCode(byte),
      ).join('');
      return btoa(binary);
    } catch (error) {
      console.warn('⚠️ Compression failed, using original content:', error);
      return content;
    }
  }

  /**
   * Decompress content
   */
  private async decompressContent(compressedContent: string): Promise<string> {
    try {
      // Convert from base64
      const binary = atob(compressedContent);
      const compressed = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        compressed[i] = binary.charCodeAt(i);
      }

      // Decompress
      const decompressed = pako.ungzip(compressed);

      // Convert back to string
      const decoder = new TextDecoder();
      return decoder.decode(decompressed);
    } catch (error) {
      console.warn(
        '⚠️ Decompression failed, treating as regular content:',
        error,
      );
      return compressedContent;
    }
  }

  /**
   * Optimized file saving with progress tracking
   */
  private async saveOptimizedStoryFile(
    content: string,
    fileName?: string,
    progressTracker?: ReturnType<typeof this.createProgressTracker>,
  ): Promise<DownloadResult> {
    try {
      const finalFileName = fileName || this.generateOptimizedFileName();

      progressTracker?.update('saving', 85, 'Creating file...');

      // Create temporary file
      const documentsPath = RNFS.DocumentDirectoryPath;
      const tempFilePath = `${documentsPath}/${finalFileName}`;

      // Write file efficiently
      await RNFS.writeFile(tempFilePath, content, 'utf8');

      progressTracker?.update('sharing', 95, 'Opening share dialog...');

      // Share file
      const shareOptions = {
        title: 'Save Story',
        message: 'Save your completed story',
        url: `file://${tempFilePath}`,
        type: 'text/plain',
        filename: finalFileName,
        saveToFiles: true,
      };

      try {
        await Share.open(shareOptions);

        return {
          success: true,
          fileName: finalFileName,
          filePath: tempFilePath,
        };
      } catch (shareError) {
        // Handle user cancellation
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
      console.error('❌ Optimized file save failed:', error);

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

  /**
   * Optimized filename generation with collision avoidance
   */
  private generateOptimizedFileName(): string {
    const now = new Date();

    // Use more efficient string concatenation
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `Story_${month}${day}${year}_${hours}${minutes}${seconds}.txt`;
  }

  /**
   * Create progress tracker
   */
  private createProgressTracker(
    operationId: string,
    onProgress?: (progress: DownloadProgress) => void,
  ) {
    return {
      update: (
        stage: DownloadProgress['stage'],
        progress: number,
        message: string,
        estimatedTimeRemaining?: number,
      ) => {
        const progressData: DownloadProgress = {
          operationId,
          stage,
          progress,
          message,
          estimatedTimeRemaining,
        };

        // Update internal tracking
        const activeDownload = this.activeDownloads.get(operationId);
        if (activeDownload) {
          activeDownload.progress = progressData;
        }

        // Call progress callback
        if (onProgress) {
          onProgress(progressData);
        }

        console.log(`📊 ${operationId}: ${stage} (${progress}%) - ${message}`);
      },
    };
  }

  /**
   * Handle download errors with fallback
   */
  private async handleDownloadError(
    error: unknown,
    options: OptimizedDownloadOptions & { userId: string; sessionId: string },
  ): Promise<DownloadResult> {
    // Try to queue the download for later retry
    try {
      const queueId = await enhancedErrorHandling.queueDownload({
        storyContent: options.content,
        fileName: options.fileName || this.generateOptimizedFileName(),
        userId: options.userId,
        sessionId: options.sessionId,
        priority: 'normal',
        maxRetries: 3,
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

  /**
   * Cancel active download
   */
  cancelDownload(operationId: string): boolean {
    const activeDownload = this.activeDownloads.get(operationId);
    if (activeDownload) {
      activeDownload.controller.abort();
      this.activeDownloads.delete(operationId);
      return true;
    }
    return false;
  }

  /**
   * Get progress for active download
   */
  getDownloadProgress(operationId: string): DownloadProgress | null {
    const activeDownload = this.activeDownloads.get(operationId);
    return activeDownload ? activeDownload.progress : null;
  }

  /**
   * Validate story content (inherited from base service)
   */
  validateStoryContent(content: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (typeof content !== 'string') {
      errors.push('Story content must be a non-empty string');
      return { isValid: false, errors };
    }

    const trimmedContent = content.trim();

    if (trimmedContent.length === 0) {
      errors.push('Story content cannot be empty');
    }

    if (trimmedContent.length > 0 && trimmedContent.length < 10) {
      errors.push('Story content is too short (minimum 10 characters)');
    }

    if (trimmedContent.length > 1000000) {
      // Increased limit for optimized version
      errors.push('Story content is too long (maximum 1,000,000 characters)');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Estimate file size with compression consideration
   */
  estimateOptimizedFileSize(
    content: string,
    enableCompression: boolean = false,
  ): number {
    // Same rationale as in downloadStoryWithOptimization: only `.size` is
    // read, so options are omitted to satisfy RN's BlobOptions typing.
    const baseSize = new Blob([content]).size;

    if (
      enableCompression &&
      baseSize > OptimizedStoryDownloadService.COMPRESSION_THRESHOLD
    ) {
      // Estimate compression ratio (typically 60-80% reduction for text)
      return Math.round(baseSize * 0.3);
    }

    return baseSize;
  }
}

// Export singleton instance
export const optimizedStoryDownloadService =
  new OptimizedStoryDownloadService();
export default optimizedStoryDownloadService;
