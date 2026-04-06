/**
 * Save to Photos utility module
 * Wraps CameraRoll and Photo Library permissions following the project's
 * wrapper pattern (rnfsWrapper.ts, shareWrapper.ts) with simulation mode fallback.
 */

import { Alert, Linking, Platform } from 'react-native';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';

export interface SaveToPhotosResult {
  success: boolean;
  error?: string;
}

let CameraRollModule: any = null;
let _isSimulationMode = false;

// Attempt to load CameraRoll native module safely
try {
  CameraRollModule = require('@react-native-camera-roll/camera-roll');
  console.log('📸 [saveToPhotos] CameraRoll module loaded successfully');
} catch (e: any) {
  console.warn(
    '📸 [saveToPhotos] CameraRoll native module not available — simulation mode active:',
    e.message,
  );
  _isSimulationMode = true;
}

/**
 * Check if Save to Photos is running in simulation mode
 * (native CameraRoll module not linked)
 */
export const isSimulationMode = (): boolean => _isSimulationMode;

/**
 * Request Photo Library write permission.
 *
 * Follows the check → request → blocked alert pattern from VoiceInput.tsx:
 * - GRANTED: returns true immediately
 * - DENIED: calls request(), returns result
 * - BLOCKED: shows alert directing user to Settings, returns false
 */
export async function requestPhotoLibraryPermission(): Promise<boolean> {
  try {
    const permission =
      Platform.OS === 'ios'
        ? PERMISSIONS.IOS.PHOTO_LIBRARY_ADD_ONLY
        : Number(Platform.Version) >= 33
        ? null // Android 13+ uses scoped storage, no permission needed
        : PERMISSIONS.ANDROID.WRITE_EXTERNAL_STORAGE;

    // Android 13+ (API 33+): scoped storage, no runtime permission needed
    if (!permission) {
      console.log(
        '📸 [saveToPhotos] Android 13+ — no permission needed (scoped storage)',
      );
      return true;
    }

    const status = await check(permission);
    console.log('📸 [saveToPhotos] Permission status:', status);

    if (status === RESULTS.GRANTED || status === RESULTS.LIMITED) {
      return true;
    }

    if (status === RESULTS.DENIED) {
      const requestResult = await request(permission);
      console.log(
        '📸 [saveToPhotos] Permission request result:',
        requestResult,
      );
      return (
        requestResult === RESULTS.GRANTED || requestResult === RESULTS.LIMITED
      );
    }

    if (status === RESULTS.BLOCKED) {
      console.log(
        '📸 [saveToPhotos] Permission blocked — directing user to Settings',
      );
      Alert.alert(
        'Photo Library Access Required',
        'Please enable Photo Library access in Settings to save images to your Photos.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => Linking.openSettings(),
          },
        ],
      );
      return false;
    }

    // UNAVAILABLE or other status
    console.log('📸 [saveToPhotos] Permission unavailable:', status);
    return false;
  } catch (error: any) {
    console.error('📸 [saveToPhotos] Permission check failed:', error);
    return false;
  }
}

/**
 * Save a local image file to the device Photo Library.
 *
 * @param localFilePath - Absolute path to the local image file (must exist on disk)
 * @returns Result with success flag and optional error message
 */
export async function saveImageToPhotos(
  localFilePath: string,
): Promise<SaveToPhotosResult> {
  // Simulation mode guard (matches rnfsWrapper.ts pattern)
  if (_isSimulationMode) {
    console.warn(
      '📸 [saveToPhotos] Simulation mode — CameraRoll not available',
    );
    return { success: false, error: 'Native module not available' };
  }

  try {
    // Resolve saveAsset across possible export shapes:
    // { CameraRoll: { saveAsset } }, { saveAsset }, { default: { saveAsset } }
    const saveAsset =
      CameraRollModule?.CameraRoll?.saveAsset ??
      CameraRollModule?.saveAsset ??
      CameraRollModule?.default?.CameraRoll?.saveAsset ??
      CameraRollModule?.default?.saveAsset;

    if (typeof saveAsset !== 'function') {
      console.error(
        '📸 [saveToPhotos] CameraRoll.saveAsset not found on module',
      );
      return { success: false, error: 'CameraRoll API not available' };
    }

    await saveAsset(localFilePath, { type: 'photo' });

    console.log('📸 [saveToPhotos] Image saved to Photos successfully');
    return { success: true };
  } catch (error: any) {
    console.error('📸 [saveToPhotos] Failed to save image:', error);
    return {
      success: false,
      error: error.message || 'Failed to save image to Photos',
    };
  }
}
