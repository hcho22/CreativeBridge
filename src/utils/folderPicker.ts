/**
 * Folder picker utility using available React Native APIs
 * Provides true folder selection for saving files
 *
 * Uses iOS Share Sheet API which includes "Save to Files" option
 * This allows users to save images to any folder they have access to
 */

import { Alert, Platform } from 'react-native';
import RNFS from './rnfsWrapper';
import Share from 'react-native-share';

export interface FolderPickerResult {
  success: boolean;
  folderPath?: string;
  error?: string;
  cancelled?: boolean;
}

export interface SaveToFolderOptions {
  sourceFilePath: string;
  fileName: string;
  title?: string;
}

export interface SaveToFolderResult {
  success: boolean;
  finalPath?: string;
  error?: string;
  cancelled?: boolean;
}

export class FolderPickerUtil {
  /**
   * Save file with native Files app integration - uses Share Sheet on iOS
   */
  static async saveToUserSelectedFolder(
    options: SaveToFolderOptions,
  ): Promise<SaveToFolderResult> {
    try {
      console.log('📁 Starting Files app integration save process');
      console.log('📁 Source file path:', options.sourceFilePath);

      // Check if we're in RNFS simulation mode and force native initialization
      if (RNFS.isSimulationMode) {
        console.log(
          '📁 RNFS in simulation mode, attempting to initialize native module...',
        );
        RNFS.retryNativeModuleInitialization();

        // Wait a moment for initialization
        await new Promise(resolve => setTimeout(resolve, 100));

        if (RNFS.isSimulationMode) {
          return {
            success: false,
            error:
              'File system not available. Please ensure the app is running on a physical device with proper native module linking.',
          };
        }
      }

      // Verify source file exists
      const sourceExists = await RNFS.exists(options.sourceFilePath);
      console.log('📁 Source file exists check:', sourceExists);

      if (!sourceExists) {
        return {
          success: false,
          error: 'Source file not found at path: ' + options.sourceFilePath,
        };
      }

      if (Platform.OS === 'ios') {
        // iOS: Use Share Sheet which includes "Save to Files" option
        console.log('📁 Opening iOS Share Sheet for file save...');

        try {
          // Prepare file URL for sharing - iOS needs proper file:// URL format
          let fileUrl = options.sourceFilePath;

          // Ensure file URL is properly formatted
          if (!fileUrl.startsWith('file://')) {
            fileUrl = `file://${fileUrl}`;
          }

          // Validate that the path doesn't contain invalid paths
          if (fileUrl.includes('/dev/null')) {
            throw new Error(
              'Invalid file path - native file system not initialized properly. Please restart the app.',
            );
          }

          const shareOptions = {
            title: options.title || 'Save Image',
            message: 'Save your story illustration',
            url: fileUrl,
            type: 'image/png',
            filename: options.fileName,
            saveToFiles: true, // This enables "Save to Files" option on iOS
            failOnCancel: false, // Don't treat cancel as an error
          };

          console.log('📁 Sharing with options:', {
            ...shareOptions,
            url: fileUrl.substring(0, 50) + '...',
          });

          const shareResult = await Share.open(shareOptions);
          console.log('📁 Share result:', shareResult);

          // Check if user completed the action
          if (shareResult.success) {
            console.log('📁 File saved successfully via Share Sheet');

            return {
              success: true,
              finalPath: options.sourceFilePath, // iOS doesn't give us the final path from Share
            };
          } else {
            // User dismissed without saving
            return { success: false, cancelled: true };
          }
        } catch (shareError: any) {
          // Handle user cancellation
          if (
            shareError.message &&
            (shareError.message.includes('User did not share') ||
              shareError.message.includes('cancelled'))
          ) {
            console.log('📁 User cancelled share sheet');
            return { success: false, cancelled: true };
          }

          // Handle other errors
          console.error('📁 Share sheet error:', shareError);
          throw shareError;
        }
      } else {
        // Android: Use fallback method (can be enhanced with Android-specific APIs later)
        console.log('📁 Using fallback method for Android');
        return await this.fallbackDirectorySelection(options);
      }
    } catch (error: any) {
      console.error('Files app save failed:', error);
      return {
        success: false,
        error: this.formatError(error),
      };
    }
  }

  /**
   * Get user-friendly folder description from path
   */

  /**
   * Handle file name conflicts by appending numbers
   */
  private static async handleFileNameConflicts(
    filePath: string,
  ): Promise<string> {
    let finalPath = filePath;
    let counter = 1;

    while (await RNFS.exists(finalPath)) {
      const pathParts = filePath.split('.');
      const extension = pathParts.pop();
      const baseName = pathParts.join('.');
      finalPath = `${baseName} (${counter}).${extension}`;
      counter++;
    }

    return finalPath;
  }

  /**
   * Fallback directory selection for development mode when DocumentPicker is not available
   */
  private static async fallbackDirectorySelection(
    options: SaveToFolderOptions,
  ): Promise<SaveToFolderResult> {
    try {
      console.log('📁 Using fallback directory selection for development');

      // For development mode, we'll use a simple alert-based folder selection
      const folderChoice = await new Promise<string>(resolve => {
        Alert.alert(
          'Save Location (Development Mode)',
          'Choose where to save your image. Note: Files app not available in simulator.',
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => resolve('cancelled'),
            },
            { text: 'Documents Folder', onPress: () => resolve('documents') },
            { text: 'Downloads Folder', onPress: () => resolve('downloads') },
          ],
        );
      });

      if (folderChoice === 'cancelled') {
        return { success: false, cancelled: true };
      }

      // Use basic folder paths for development
      let targetFolder: string;
      if (folderChoice === 'downloads') {
        targetFolder = `${RNFS.DocumentDirectoryPath}/Downloads`;
      } else {
        targetFolder = `${RNFS.DocumentDirectoryPath}/CreativeBridge`;
      }

      // Ensure target folder exists
      try {
        const folderExists = await RNFS.exists(targetFolder);
        if (!folderExists) {
          await RNFS.mkdir(targetFolder);
          console.log('📁 Created fallback folder:', targetFolder);
        }
      } catch (mkdirError) {
        console.log('📁 Could not create folder, using document directory');
        targetFolder = RNFS.DocumentDirectoryPath;
      }

      // Handle file name conflicts
      const finalPath = await this.handleFileNameConflicts(
        `${targetFolder}/${options.fileName}`,
      );

      console.log('📁 Saving file to fallback location:', finalPath);

      // Copy file to chosen location
      await RNFS.copyFile(options.sourceFilePath, finalPath);

      // Verify the file was saved
      const savedFileExists = await RNFS.exists(finalPath);
      if (!savedFileExists) {
        throw new Error('File save verification failed');
      }

      console.log(
        '📁 File saved successfully to fallback location:',
        finalPath,
      );

      return {
        success: true,
        finalPath,
      };
    } catch (error: any) {
      console.error('Fallback directory selection failed:', error);
      return {
        success: false,
        error: this.formatError(error),
      };
    }
  }

  /**
   * Format error messages for user display
   */
  private static formatError(error: any): string {
    if (error?.message) {
      if (error.message.includes('Document picker not available')) {
        return 'File picker is not available in development mode. Please test on a physical device.';
      }
      if (error.message.includes('NativeDocumentPicker')) {
        return 'File picker feature is not available. Please ensure app is properly installed.';
      }
      if (error.message.includes('Permission denied')) {
        return 'Permission denied. Please check app permissions in device settings.';
      }
      if (error.message.includes('ENOSPC')) {
        return 'Not enough storage space available on your device.';
      }
      if (error.message.includes('ENOENT')) {
        return 'Target folder is not accessible. Please try a different location.';
      }
      return error.message;
    }

    return 'An unexpected error occurred while saving the file';
  }

  /**
   * Get user-friendly folder description from path
   */
  static getFolderDescription(filePath: string): string {
    if (filePath.includes('Download')) {
      return 'Downloads folder';
    }
    if (filePath.includes('Documents')) {
      return 'Documents folder';
    }
    if (filePath.includes('Pictures')) {
      return 'Pictures folder';
    }
    if (filePath.includes('DCIM') || filePath.includes('Photos')) {
      return 'Photos folder';
    }
    if (filePath.includes('CreativeBridge')) {
      return 'CreativeBridge folder';
    }

    // Extract parent folder name from user-selected path
    const pathParts = filePath.split('/');
    const parentFolder = pathParts[pathParts.length - 2];
    return parentFolder ? `${parentFolder} folder` : 'Selected location';
  }

  /**
   * Test folder accessibility
   */
  static async testFolderAccess(folderPath: string): Promise<boolean> {
    try {
      const testFile = `${folderPath}/test_access.tmp`;
      await RNFS.writeFile(testFile, 'test', 'utf8');
      await RNFS.unlink(testFile);
      return true;
    } catch (error) {
      console.log('Folder access test failed for:', folderPath, error);
      return false;
    }
  }

  /**
   * Show help about folder selection
   */
  static showFolderHelp(): void {
    Alert.alert(
      'Save Image',
      'When you tap "Save Image", a share menu will open with multiple options:\n\n' +
        '• Tap "Save to Files" to choose where to save\n' +
        '• Save to iCloud Drive\n' +
        '• Save to Downloads or Documents folder\n' +
        '• Save to any folder you have access to\n\n' +
        'You can also share the image via Messages, Mail, or other apps!',
      [{ text: 'Got it', style: 'default' }],
    );
  }
}

export default FolderPickerUtil;
