/**
 * Avatar Upload Service
 * Handles picking an image from the iOS Photos library and uploading it
 * to Convex Storage as a user profile picture.
 *
 * Uses the same blob upload pattern as imageStorageService.ts:
 * fetch(localUri) -> blob -> POST to presigned URL
 *
 * @implements US-001: Avatar Upload Service (prd-profile-picture-upload.md)
 */

import { launchImageLibrary } from 'react-native-image-picker';
import { Alert, Linking, Platform } from 'react-native';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import {
  getConvexClient as getCentralizedConvexClient,
  isConvexReady,
} from './convex';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PickAvatarResult {
  uri: string;
  type: string;
  fileName: string;
}

export interface UploadAvatarSuccess {
  success: true;
  avatarUrl: string;
}

export interface UploadAvatarFailure {
  success: false;
  error: string;
}

export type UploadAvatarResult = UploadAvatarSuccess | UploadAvatarFailure;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get the Convex client from the centralized service.
 * Throws if not initialized.
 */
function getConvexClient() {
  const client = getCentralizedConvexClient();
  if (!client) {
    throw new Error(
      'Convex client not initialized. Ensure ConvexProviderWithClerk is mounted.',
    );
  }
  return client;
}

// ─── Public Functions ─────────────────────────────────────────────────────────

/**
 * Open the iOS Photos library picker and return the selected image.
 *
 * Options: single photo, quality 0.7, max 400x400 (resized by the picker).
 * Returns null on cancel, error, or permission denied.
 */
export async function pickAvatarImage(): Promise<PickAvatarResult | null> {
  try {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      quality: 0.7,
      maxWidth: 400,
      maxHeight: 400,
    });

    // User cancelled
    if (result.didCancel) {
      return null;
    }

    // Permission denied or other error
    if (result.errorCode) {
      if (
        result.errorCode === 'permission' ||
        result.errorCode === 'camera_unavailable'
      ) {
        Alert.alert(
          'Photo Access Required',
          'Please allow photo library access in Settings to upload a profile picture.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openSettings();
                }
              },
            },
          ],
        );
      }
      console.error(
        `📷 Image picker error: ${result.errorCode} — ${result.errorMessage}`,
      );
      return null;
    }

    const asset = result.assets?.[0];
    if (!asset?.uri) {
      return null;
    }

    return {
      uri: asset.uri,
      type: asset.type || 'image/jpeg',
      fileName: asset.fileName || 'avatar.jpg',
    };
  } catch (error: any) {
    console.error('📷 Image picker exception:', error.message);
    return null;
  }
}

/**
 * Upload a local image to Convex Storage and resolve a permanent URL.
 *
 * Flow:
 * 1. Check Convex readiness
 * 2. Fetch local image URI as a blob
 * 3. Request presigned upload URL from Convex
 * 4. POST blob to presigned URL → receive storageId
 * 5. Resolve storageId to a permanent image URL via getImageUrl query
 */
export async function uploadAvatarToConvex(
  imageUri: string,
  mimeType: string,
): Promise<UploadAvatarResult> {
  try {
    if (!isConvexReady()) {
      return { success: false, error: 'Convex is not available' };
    }

    const client = getConvexClient();

    // Step 1: Fetch the local image as a blob
    const response = await fetch(imageUri);
    const blob = await response.blob();

    // Step 2: Get presigned upload URL from Convex
    const uploadUrl: string = await client.mutation(
      api.storage.generateUploadUrl,
    );

    // Step 3: Upload blob to presigned URL
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': mimeType },
      body: blob,
    });

    if (!uploadResponse.ok) {
      return {
        success: false,
        error: `Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`,
      };
    }

    // Step 4: Parse storageId from response
    const { storageId } = (await uploadResponse.json()) as {
      storageId: string;
    };

    // Step 5: Resolve permanent URL
    const imageUrl = await client.query(api.storage.getImageUrl, {
      storageId: storageId as Id<'_storage'>,
    });

    if (!imageUrl) {
      return {
        success: false,
        error: 'Failed to resolve image URL from storage',
      };
    }

    return { success: true, avatarUrl: imageUrl };
  } catch (error: any) {
    console.error('📤 Avatar upload failed:', error.message);
    return { success: false, error: error.message || 'Upload failed' };
  }
}
