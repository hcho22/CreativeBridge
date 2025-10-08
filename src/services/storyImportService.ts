// Story Import Service
// Handles importing stories from files and database sources

import { DocumentPickerResponse } from 'react-native-document-picker';
import RNFS from 'react-native-fs';
import { supabase } from './supabase';
import type {
  ImportableStory,
  SearchableStory,
  StoryImportData,
  StorySource,
  StoryMetadata,
} from '../types/database';

export interface FileImportResult {
  success: boolean;
  content?: string;
  metadata?: StoryMetadata;
  error?: string;
}

export interface DatabaseStoryResult {
  success: boolean;
  stories?: ImportableStory[];
  total?: number;
  error?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export class StoryImportService {
  /**
   * Read and parse a text file from the device
   */
  static async readTextFile(fileUri: string): Promise<FileImportResult> {
    try {
      // Check if file exists
      const fileExists = await RNFS.exists(fileUri);
      if (!fileExists) {
        return {
          success: false,
          error: 'File not found',
        };
      }

      // Get file stats for metadata
      const stats = await RNFS.stat(fileUri);

      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (stats.size > maxSize) {
        return {
          success: false,
          error: 'File too large. Maximum size is 10MB.',
        };
      }

      // Read file content
      const content = await RNFS.readFile(fileUri, 'utf8');

      // Extract filename from URI
      const fileName = fileUri.split('/').pop() || 'unknown.txt';

      // Create metadata
      const metadata: StoryMetadata = {
        file_name: fileName,
        file_size: stats.size,
        encoding: 'utf-8',
        import_date: new Date().toISOString(),
        imported_word_count: this.countWords(content),
      };

      return {
        success: true,
        content: content.trim(),
        metadata,
      };
    } catch (error) {
      console.error('Error reading text file:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Read file with encoding detection and fallback
   */
  static async readFileWithEncoding(
    fileUri: string,
  ): Promise<FileImportResult> {
    try {
      // First try UTF-8
      let result = await this.readTextFile(fileUri);
      if (result.success && result.content) {
        // Check if content looks valid (no weird characters)
        if (this.isValidTextContent(result.content)) {
          return result;
        }
      }

      // If UTF-8 fails or produces invalid content, try ASCII
      try {
        const content = await RNFS.readFile(fileUri, 'ascii');
        const stats = await RNFS.stat(fileUri);
        const fileName = fileUri.split('/').pop() || 'unknown.txt';

        const metadata: StoryMetadata = {
          file_name: fileName,
          file_size: stats.size,
          encoding: 'ascii',
          import_date: new Date().toISOString(),
          imported_word_count: this.countWords(content),
        };

        return {
          success: true,
          content: content.trim(),
          metadata,
        };
      } catch (asciiError) {
        return {
          success: false,
          error: 'Unable to read file with supported encodings (UTF-8, ASCII)',
        };
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Fetch user's completed stories from database
   */
  static async fetchUserStories(
    userId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<DatabaseStoryResult> {
    try {
      const { data, error } = await supabase.rpc(
        'get_user_importable_stories',
        {
          p_user_id: userId,
          p_limit: limit,
          p_offset: offset,
        },
      );

      if (error) {
        console.error('Error fetching user stories:', error);
        return {
          success: false,
          error: 'Failed to fetch stories from database',
        };
      }

      return {
        success: true,
        stories: data || [],
        total: data?.length || 0,
      };
    } catch (error) {
      console.error('Error in fetchUserStories:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Search user stories by content
   */
  static async searchUserStories(
    userId: string,
    searchTerm: string,
    limit: number = 20,
  ): Promise<{
    success: boolean;
    stories?: SearchableStory[];
    error?: string;
  }> {
    try {
      if (!searchTerm.trim()) {
        return {
          success: true,
          stories: [],
        };
      }

      const { data, error } = await supabase.rpc('search_user_stories', {
        p_user_id: userId,
        p_search_term: searchTerm.trim(),
        p_limit: limit,
      });

      if (error) {
        console.error('Error searching user stories:', error);
        return {
          success: false,
          error: 'Failed to search stories',
        };
      }

      return {
        success: true,
        stories: data || [],
      };
    } catch (error) {
      console.error('Error in searchUserStories:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Validate story content before import
   */
  static validateStoryContent(content: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if content exists
    if (
      !content ||
      typeof content !== 'string' ||
      content.trim().length === 0
    ) {
      errors.push('Story content cannot be empty');
      return { isValid: false, errors, warnings };
    }

    // Check minimum length
    const trimmedContent = content.trim();
    if (trimmedContent.length < 10) {
      errors.push('Story content must be at least 10 characters long');
    }

    // Check maximum length (100KB as per database constraint)
    if (trimmedContent.length > 100000) {
      errors.push('Story content cannot exceed 100,000 characters');
    }

    // Check for reasonable word count
    const wordCount = this.countWords(trimmedContent);
    if (wordCount < 5) {
      warnings.push('Story is very short (less than 5 words)');
    }

    // Check for potentially corrupted content
    if (this.hasCorruptedText(trimmedContent)) {
      warnings.push(
        'Content may contain encoding issues or corrupted characters',
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Process and prepare story data for import
   */
  static processStoryForImport(
    content: string,
    source: StorySource,
    metadata?: Partial<StoryMetadata>,
  ): StoryImportData {
    const processedContent = this.sanitizeContent(content);
    const wordCount = this.countWords(processedContent);

    const processedMetadata: StoryMetadata = {
      imported_word_count: wordCount,
      import_date: new Date().toISOString(),
      ...metadata,
    };

    return {
      source,
      content: processedContent,
      metadata: processedMetadata,
      originalDate: metadata?.import_date,
    };
  }

  /**
   * Extract metadata from imported story
   */
  static extractMetadata(content: string, fileName?: string): StoryMetadata {
    const wordCount = this.countWords(content);
    const characterCount = content.length;
    const lineCount = content.split('\n').length;

    // Try to extract title from first line if it looks like a title
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    const potentialTitle = lines[0]?.trim();
    const isTitle =
      potentialTitle &&
      potentialTitle.length < 100 &&
      !potentialTitle.endsWith('.') &&
      !potentialTitle.includes('\t');

    const metadata: StoryMetadata = {
      imported_word_count: wordCount,
      character_count: characterCount,
      line_count: lineCount,
      import_date: new Date().toISOString(),
    };

    if (fileName) {
      metadata.file_name = fileName;
    }

    if (isTitle) {
      metadata.title = potentialTitle;
    }

    return metadata;
  }

  // Utility methods

  /**
   * Count words in text content
   */
  private static countWords(content: string): number {
    if (!content || content.trim().length === 0) {
      return 0;
    }

    return content
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0).length;
  }

  /**
   * Check if text content is valid (no weird encoding issues)
   */
  private static isValidTextContent(content: string): boolean {
    // Check for common encoding issue indicators
    const invalidPatterns = [
      /[\uFFFD]/g, // Replacement character
      /[\x00-\x08\x0B\x0C\x0E-\x1F]/g, // Control characters (except tab, newline, carriage return)
      /[^\x20-\x7E\x09\x0A\x0D\u00A0-\uFFFF]/g, // Non-printable characters
    ];

    return !invalidPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Check for potentially corrupted text
   */
  private static hasCorruptedText(content: string): boolean {
    // Check for excessive special characters
    const specialCharCount = (content.match(/[^\w\s.,!?;:'"()-]/g) || [])
      .length;
    const totalLength = content.length;

    // If more than 10% special characters, might be corrupted
    if (specialCharCount / totalLength > 0.1) {
      return true;
    }

    // Check for replacement characters
    if (content.includes('\uFFFD')) {
      return true;
    }

    return false;
  }

  /**
   * Sanitize content for safe storage
   */
  private static sanitizeContent(content: string): string {
    // Remove null bytes and other problematic characters
    return content
      .replace(/\x00/g, '') // Remove null bytes
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // Remove control characters
      .trim();
  }

  /**
   * Format file size for display
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Validate file extension
   */
  static isValidTextFile(fileName: string): boolean {
    const validExtensions = ['.txt', '.text'];
    const extension = fileName.toLowerCase().split('.').pop();
    return validExtensions.includes(`.${extension}`);
  }
}

export default StoryImportService;
