// File Picker Utils Tests
// Comprehensive testing for file picker functionality

import { FilePickerUtils } from '../../utils/filePicker';
import DocumentPicker from 'react-native-document-picker';
import { Platform, PermissionsAndroid } from 'react-native';
import RNFS from 'react-native-fs';

// Mock dependencies
jest.mock('react-native-document-picker', () => ({
  pick: jest.fn(),
  types: {
    plainText: 'text/plain',
    allFiles: '*/*',
  },
  isCancel: jest.fn(),
  isInProgress: jest.fn(),
}));

jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    Version: 16,
  },
  PermissionsAndroid: {
    check: jest.fn(),
    request: jest.fn(),
    PERMISSIONS: {
      READ_EXTERNAL_STORAGE: 'android.permission.READ_EXTERNAL_STORAGE',
    },
    RESULTS: {
      GRANTED: 'granted',
      DENIED: 'denied',
    },
  },
  Alert: {
    alert: jest.fn(),
  },
}));

jest.mock('react-native-fs', () => ({
  exists: jest.fn(),
  stat: jest.fn(),
  readFile: jest.fn(),
  unlink: jest.fn(),
}));

jest.mock('../../services/storyImportService', () => ({
  StoryImportService: {
    readFileWithEncoding: jest.fn(),
  },
}));

const mockDocumentPicker = DocumentPicker as jest.Mocked<typeof DocumentPicker>;
const mockRNFS = RNFS as jest.Mocked<typeof RNFS>;
const mockPermissionsAndroid = PermissionsAndroid as jest.Mocked<typeof PermissionsAndroid>;

describe('FilePickerUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset platform to iOS by default
    (Platform as any).OS = 'ios';
    (Platform as any).Version = 16;
  });

  describe('File Validation', () => {
    it('should validate txt file format', () => {
      const validFile = { 
        name: 'story.txt', 
        type: 'text/plain', 
        size: 1024, 
        uri: 'file://test.txt' 
      };
      const invalidFile = { 
        name: 'story.pdf', 
        type: 'application/pdf', 
        size: 1024, 
        uri: 'file://test.pdf' 
      };

      expect(FilePickerUtils.isValidTextFile(validFile)).toBe(true);
      expect(FilePickerUtils.isValidTextFile(invalidFile)).toBe(false);
    });

    it('should handle file size validation', () => {
      const smallFile = { size: 1024 }; // 1KB
      const largeFile = { size: 10 * 1024 * 1024 }; // 10MB
      const tooLargeFile = { size: 15 * 1024 * 1024 }; // 15MB

      expect(FilePickerUtils.isValidFileSize(smallFile)).toBe(true);
      expect(FilePickerUtils.isValidFileSize(largeFile)).toBe(true);
      expect(FilePickerUtils.isValidFileSize(tooLargeFile)).toBe(false);
    });

    it('should validate file with comprehensive checks', () => {
      const validFile = {
        name: 'story.txt',
        type: 'text/plain',
        size: 1024,
        uri: 'file://test.txt',
      };

      const result = FilePickerUtils.validateFile(validFile);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should catch file validation errors', () => {
      const invalidFile = {
        name: 'story.pdf',
        type: 'application/pdf',
        size: 15 * 1024 * 1024, // Too large
        uri: 'file://test.pdf',
      };

      const result = FilePickerUtils.validateFile(invalidFile);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(error => error.includes('too large'))).toBe(true);
      expect(result.errors.some(error => error.includes('Invalid file type'))).toBe(true);
    });

    it('should provide warnings for edge cases', () => {
      const tinyFile = {
        name: 'tiny.txt',
        type: 'text/plain',
        size: 5, // Very small
        uri: 'file://tiny.txt',
      };

      const result = FilePickerUtils.validateFile(tinyFile);

      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(warning => warning.includes('very small'))).toBe(true);
    });
  });

  describe('Encoding Detection', () => {
    it('should detect text encoding for string input', async () => {
      const textContent = 'Hello, world!';
      const encoding = await FilePickerUtils.detectEncoding(textContent);

      expect(encoding).toBe('utf8');
    });

    it('should detect UTF-8 BOM', async () => {
      const utf8Bom = Buffer.from([0xEF, 0xBB, 0xBF, 0x48, 0x65, 0x6C, 0x6C, 0x6F]); // BOM + "Hello"
      const encoding = await FilePickerUtils.detectEncoding(utf8Bom);

      expect(encoding).toBe('utf8');
    });

    it('should default to utf8 for unknown buffer', async () => {
      const unknownBuffer = Buffer.from('Hello, world!', 'ascii');
      const encoding = await FilePickerUtils.detectEncoding(unknownBuffer);

      expect(encoding).toBe('utf8');
    });
  });

  describe('File Size Formatting', () => {
    it('should format file sizes correctly', () => {
      expect(FilePickerUtils.formatFileSize(0)).toBe('0 Bytes');
      expect(FilePickerUtils.formatFileSize(1024)).toBe('1 KB');
      expect(FilePickerUtils.formatFileSize(1024 * 1024)).toBe('1 MB');
      expect(FilePickerUtils.formatFileSize(1536)).toBe('1.5 KB'); // 1.5KB
    });
  });

  describe('File Extension Extraction', () => {
    it('should extract file extensions correctly', () => {
      expect(FilePickerUtils.getFileExtension('story.txt')).toBe('txt');
      expect(FilePickerUtils.getFileExtension('document.TXT')).toBe('txt');
      expect(FilePickerUtils.getFileExtension('no-extension')).toBe('');
      expect(FilePickerUtils.getFileExtension('multiple.dots.txt')).toBe('txt');
    });
  });

  describe('Permission Handling', () => {
    beforeEach(() => {
      (Platform as any).OS = 'android';
    });

    it('should return true for iOS', async () => {
      (Platform as any).OS = 'ios';
      const result = await FilePickerUtils.checkStoragePermissions();
      expect(result).toBe(true);
    });

    it('should return true for Android 13+', async () => {
      (Platform as any).Version = 33;
      const result = await FilePickerUtils.checkStoragePermissions();
      expect(result).toBe(true);
    });

    it('should check existing permissions on older Android', async () => {
      (Platform as any).Version = 29;
      mockPermissionsAndroid.check.mockResolvedValue(true);

      const result = await FilePickerUtils.checkStoragePermissions();

      expect(mockPermissionsAndroid.check).toHaveBeenCalledWith(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
      );
      expect(result).toBe(true);
    });

    it('should request permissions when not granted', async () => {
      (Platform as any).Version = 29;
      mockPermissionsAndroid.check.mockResolvedValue(false);
      mockPermissionsAndroid.request.mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);

      const result = await FilePickerUtils.checkStoragePermissions();

      expect(mockPermissionsAndroid.request).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should handle permission denial', async () => {
      (Platform as any).Version = 29;
      mockPermissionsAndroid.check.mockResolvedValue(false);
      mockPermissionsAndroid.request.mockResolvedValue(PermissionsAndroid.RESULTS.DENIED);

      const result = await FilePickerUtils.checkStoragePermissions();

      expect(result).toBe(false);
    });

    it('should handle permission errors gracefully', async () => {
      (Platform as any).Version = 29;
      mockPermissionsAndroid.check.mockRejectedValue(new Error('Permission error'));

      const result = await FilePickerUtils.checkStoragePermissions();

      expect(result).toBe(false);
    });
  });

  describe('File Cleanup', () => {
    it('should clean up temporary files', async () => {
      const tempFileUri = 'file://documentDirectory/temp/test.txt';
      mockRNFS.exists.mockResolvedValue(true);
      mockRNFS.unlink.mockResolvedValue(undefined);

      await FilePickerUtils.cleanupTempFiles(tempFileUri);

      expect(mockRNFS.exists).toHaveBeenCalledWith(tempFileUri);
      expect(mockRNFS.unlink).toHaveBeenCalledWith(tempFileUri);
    });

    it('should not clean up non-temporary files', async () => {
      const regularFileUri = 'file://downloads/story.txt';

      await FilePickerUtils.cleanupTempFiles(regularFileUri);

      expect(mockRNFS.exists).not.toHaveBeenCalled();
      expect(mockRNFS.unlink).not.toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      const tempFileUri = 'file://tmp/test.txt';
      mockRNFS.exists.mockResolvedValue(true);
      mockRNFS.unlink.mockRejectedValue(new Error('Cleanup failed'));

      // Should not throw
      await expect(FilePickerUtils.cleanupTempFiles(tempFileUri)).resolves.toBeUndefined();
    });

    it('should handle missing file URI', async () => {
      await expect(FilePickerUtils.cleanupTempFiles()).resolves.toBeUndefined();
      await expect(FilePickerUtils.cleanupTempFiles('')).resolves.toBeUndefined();
    });
  });

  describe('Error Message Formatting', () => {
    it('should format permission errors for Android', () => {
      (Platform as any).OS = 'android';
      const error = new Error('Permission denied');
      const message = FilePickerUtils.handlePermissionError(error);

      expect(message).toContain('Storage permission');
      expect(message).toContain('Settings');
    });

    it('should format permission errors for iOS', () => {
      (Platform as any).OS = 'ios';
      const error = new Error('Permission denied');
      const message = FilePickerUtils.handlePermissionError(error);

      expect(message).toContain('File access permission');
      expect(message).not.toContain('Settings');
    });
  });

  describe('File Type Detection', () => {
    it('should detect valid text files by extension', () => {
      const txtFile = { name: 'story.txt', type: 'unknown' };
      const textFile = { name: 'story.text', type: 'unknown' };

      expect(FilePickerUtils.isValidTextFile(txtFile)).toBe(true);
      expect(FilePickerUtils.isValidTextFile(textFile)).toBe(true);
    });

    it('should detect valid text files by MIME type', () => {
      const plainTextFile = { name: 'story.unknown', type: 'text/plain' };
      const textFile = { name: 'story.unknown', type: 'text/markdown' };

      expect(FilePickerUtils.isValidTextFile(plainTextFile)).toBe(true);
      expect(FilePickerUtils.isValidTextFile(textFile)).toBe(true);
    });

    it('should reject invalid file types', () => {
      const pdfFile = { name: 'document.pdf', type: 'application/pdf' };
      const imageFile = { name: 'image.jpg', type: 'image/jpeg' };

      expect(FilePickerUtils.isValidTextFile(pdfFile)).toBe(false);
      expect(FilePickerUtils.isValidTextFile(imageFile)).toBe(false);
    });

    it('should handle missing file properties', () => {
      const noName = { type: 'text/plain' };
      const noType = { name: 'story.txt' };
      const emptyFile = {};

      expect(FilePickerUtils.isValidTextFile(noName as any)).toBe(true); // Valid by type
      expect(FilePickerUtils.isValidTextFile(noType as any)).toBe(true); // Valid by extension
      expect(FilePickerUtils.isValidTextFile(emptyFile as any)).toBe(false); // No valid indicators
    });
  });
});