// File Picker Utilities
// Handles file selection, validation, and permissions for story import

import DocumentPicker, {
  DocumentPickerResponse,
  isInProgress,
  isCancel,
} from 'react-native-document-picker';
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import RNFS from 'react-native-fs';
import { StoryImportService } from '../services/storyImportService';

export interface FilePickerResult {
  success: boolean;
  file?: DocumentPickerResponse;
  content?: string;
  metadata?: any;
  error?: string;
  cancelled?: boolean;
}

export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class FilePickerUtils {
  // Maximum file size (10MB)
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024;

  // Supported file types
  private static readonly SUPPORTED_TYPES = [
    'text/plain',
    'text/txt',
    'application/txt',
    'text/*',
  ];

  // Supported extensions
  private static readonly SUPPORTED_EXTENSIONS = ['.txt', '.text'];

  /**
   * Open file picker and select a text file
   */
  static async pickTextFile(): Promise<FilePickerResult> {
    try {
      // Check permissions first
      const hasPermission = await this.checkStoragePermissions();
      if (!hasPermission) {
        return {
          success: false,
          error: 'Storage permission is required to import files',
        };
      }

      // Pick document
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.plainText, DocumentPicker.types.allFiles],
        allowMultiSelection: false,
        copyTo: 'documentDirectory', // Copy to app's document directory for reliable access
      });

      if (!result || result.length === 0) {
        return {
          success: false,
          cancelled: true,
        };
      }

      const file = result[0] as DocumentPickerResponse;
      console.log('📁 File picked:', {
        name: file.name,
        type: file.type,
        size: file.size,
        uri: file.uri,
      });

      // Validate file
      const validation = this.validateFile(file);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.errors.join(', '),
        };
      }

      // Read file content
      const fileContent = await StoryImportService.readFileWithEncoding(
        file.uri,
      );
      if (!fileContent.success) {
        return {
          success: false,
          error: fileContent.error || 'Failed to read file content',
        };
      }

      return {
        success: true,
        file,
        content: fileContent.content,
        metadata: fileContent.metadata,
      };
    } catch (error) {
      // Handle specific document picker errors first
      if (isCancel(error)) {
        // User cancelled - this is not an error, just return silently
        console.log('📁 User cancelled file picker');
        return {
          success: false,
          cancelled: true,
        };
      }

      if (isInProgress(error)) {
        console.warn('File picker is already in progress');
        return {
          success: false,
          error: 'File picker is already in progress',
        };
      }

      // Only log as error if it's not a cancellation
      console.error('Error in pickTextFile:', error);

      return {
        success: false,
        error: this.formatPickerError(error),
      };
    }
  }

  /**
   * Validate selected file
   */
  static validateFile(file: DocumentPickerResponse): FileValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check file size
    if (file.size && file.size > this.MAX_FILE_SIZE) {
      errors.push(
        `File too large. Maximum size is ${this.formatFileSize(
          this.MAX_FILE_SIZE,
        )}`,
      );
    }

    // Check file extension
    if (!this.isValidTextFile(file)) {
      errors.push('Invalid file type. Only .txt files are supported');
    }

    // Check if file exists (for some Android versions)
    if (!file.uri) {
      errors.push('Invalid file selection');
    }

    // Add warnings for edge cases
    if (file.size && file.size < 10) {
      warnings.push('File appears to be very small');
    }

    if (file.size && file.size > 1024 * 1024) {
      // 1MB
      warnings.push('Large file may take longer to process');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Check if file is a valid text file
   */
  static isValidTextFile(file: DocumentPickerResponse): boolean {
    // Check by extension first
    const fileName = file.name?.toLowerCase() || '';
    const hasValidExtension =
      fileName && this.SUPPORTED_EXTENSIONS.some(ext => fileName.endsWith(ext));

    // Check by MIME type
    const hasValidMimeType =
      file.type &&
      (this.SUPPORTED_TYPES.includes(file.type) ||
        file.type.startsWith('text/'));

    // Must have at least one valid indicator
    return Boolean(hasValidExtension || hasValidMimeType);
  }

  /**
   * Check if file size is valid
   */
  static isValidFileSize(file: { size?: number }): boolean {
    if (!file.size) return true; // Unknown size, let it through
    return file.size <= this.MAX_FILE_SIZE;
  }

  /**
   * Detect text encoding from file content
   */
  static async detectEncoding(fileContent: Buffer | string): Promise<string> {
    // Simple encoding detection
    if (typeof fileContent === 'string') {
      return 'utf8';
    }

    // Check for BOM markers
    if (fileContent.length >= 3) {
      const first3 = fileContent.subarray(0, 3);
      if (first3[0] === 0xef && first3[1] === 0xbb && first3[2] === 0xbf) {
        return 'utf8'; // UTF-8 BOM
      }
    }

    // Default to UTF-8
    return 'utf8';
  }

  /**
   * Check storage permissions (Android)
   */
  static async checkStoragePermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return true; // iOS handles permissions automatically
    }

    try {
      // For Android 13+ (API level 33+), we don't need WRITE_EXTERNAL_STORAGE
      // Document picker handles permissions automatically for scoped storage
      if (Platform.Version >= 33) {
        return true;
      }

      // For older Android versions, check READ_EXTERNAL_STORAGE
      const granted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      );

      if (granted) {
        return true;
      }

      // Request permission
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        {
          title: 'Storage Permission',
          message:
            'CreativeBridge needs access to storage to import story files',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        },
      );

      return result === PermissionsAndroid.RESULTS.GRANTED;
    } catch (error) {
      console.error('Error checking storage permissions:', error);
      return false;
    }
  }

  /**
   * Request storage permissions with user-friendly messaging
   */
  static async requestStoragePermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return true;
    }

    try {
      const hasPermission = await this.checkStoragePermissions();
      if (hasPermission) {
        return true;
      }

      // Show explanation dialog
      return new Promise(resolve => {
        Alert.alert(
          'Storage Access Required',
          'To import story files, CreativeBridge needs permission to access your device storage. This allows you to select .txt files from your device.',
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => resolve(false),
            },
            {
              text: 'Grant Permission',
              onPress: async () => {
                const granted = await this.checkStoragePermissions();
                resolve(granted);
              },
            },
          ],
        );
      });
    } catch (error) {
      console.error('Error requesting storage permissions:', error);
      return false;
    }
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
   * Get file extension from filename
   */
  static getFileExtension(fileName: string): string {
    const parts = fileName.split('.');
    if (parts.length <= 1) {
      return ''; // No extension found
    }
    return parts.pop()?.toLowerCase() || '';
  }

  /**
   * Format picker errors for user display
   */
  private static formatPickerError(error: any): string {
    if (error?.message) {
      // Handle common document picker errors
      if (error.message.includes('User cancelled')) {
        return 'File selection was cancelled';
      }
      if (error.message.includes('No app found')) {
        return 'No app found to handle file selection';
      }
      if (error.message.includes('Permission denied')) {
        return 'Permission denied. Please allow storage access';
      }
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    return 'An unexpected error occurred while selecting the file';
  }

  /**
   * Clean up temporary files (if any were created)
   */
  static async cleanupTempFiles(fileUri?: string): Promise<void> {
    if (!fileUri) return;

    try {
      // Only clean up files in the app's temporary directory
      if (fileUri.includes('documentDirectory') || fileUri.includes('tmp')) {
        const exists = await RNFS.exists(fileUri);
        if (exists) {
          await RNFS.unlink(fileUri);
          console.log('🧹 Cleaned up temporary file:', fileUri);
        }
      }
    } catch (error) {
      // Silent fail - temporary file cleanup is not critical
      console.warn('Warning: Could not clean up temporary file:', error);
    }
  }

  /**
   * Handle file picker permission errors
   */
  static handlePermissionError(_error: any): string {
    if (Platform.OS === 'android') {
      return 'Storage permission is required to import files. Please go to Settings > Apps > CreativeBridge > Permissions and enable Storage access.';
    } else {
      return 'File access permission is required. Please try again and allow access when prompted.';
    }
  }

  /**
   * Show file import help dialog
   */
  static showFileImportHelp(): void {
    Alert.alert(
      'File Import Help',
      'To import a story:\n\n' +
        '1. Tap "Import from File"\n' +
        '2. Select a .txt file from your device\n' +
        '3. The story content will be loaded\n' +
        '4. Review and edit if needed\n' +
        '5. Tap "Continue Story" to generate new content\n\n' +
        'Supported formats: .txt files up to 10MB',
      [{ text: 'Got it', style: 'default' }],
    );
  }
}

export default FilePickerUtils;
