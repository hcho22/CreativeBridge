/**
 * Image Storage Service
 * Handles uploading generated images to Convex Storage with retry logic
 * Provides permanent backup for images initially stored via Replicate URLs
 *
 * ## Migration Notes (US-015):
 * This service has been updated to use Convex Storage instead of Supabase Storage.
 * During the dual-write transition period, it writes to both backends.
 *
 * @see convex/storage.ts for the Convex backend functions
 * @implements US-015: Create Image Storage Service Adapter
 */

import { ConvexReactClient } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { ImageUploadStatus } from '../types/database';

// Upload result interface
export interface UploadImageResult {
  success: boolean;
  /** @deprecated Use convexImageUrl instead - kept for backward compatibility */
  supabaseUrl?: string;
  convexImageUrl?: string;
  storageId?: string;
  error?: string;
  attempts: number;
  status: ImageUploadStatus;
}

// Retry result interface (for manual retry operations)
export interface RetryResult {
  success: boolean;
  /** @deprecated Use convexImageUrl instead */
  supabaseUrl?: string;
  convexImageUrl?: string;
  error?: string;
  attempts?: number;
}

// Configuration constants
const CONFIG = {
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY_BASE_MS: 1000, // 1 second for first retry
  TIMEOUT_MS: 30000, // 30 seconds per upload attempt
  MAX_IMAGE_SIZE_MB: 10,
  ALLOWED_MIME_TYPES: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
} as const;

// Convex client singleton - will be set by the hook or provider
let convexClient: ConvexReactClient | null = null;

/**
 * Set the Convex client for the image storage service.
 * This must be called before using any upload functions.
 *
 * @param client - The ConvexReactClient instance from the provider
 */
export function setConvexClient(client: ConvexReactClient): void {
  convexClient = client;
  console.log('✅ ImageStorageService: Convex client set');
}

/**
 * Get the current Convex client.
 * Throws if not initialized.
 */
function getConvexClient(): ConvexReactClient {
  if (!convexClient) {
    throw new Error(
      'Convex client not initialized. Call setConvexClient() first.',
    );
  }
  return convexClient;
}

/**
 * ImageStorageService
 * Manages permanent image storage in Convex with exponential backoff retry
 *
 * ## Convex Upload Flow:
 * 1. Call `generateUploadUrl` mutation to get a presigned URL
 * 2. Upload image data directly to the presigned URL via fetch POST
 * 3. Parse the response to get the `storageId`
 * 4. Call `storeImageReference` mutation to link storageId to game session
 */
export class ImageStorageService {
  /**
   * Upload an image from Replicate URL to Convex Storage
   *
   * @param replicateUrl - The temporary Replicate image URL
   * @param sessionId - Game session ID (Convex ID format)
   * @param _userId - User ID (not used for Convex - auth is handled via JWT)
   * @returns Upload result with status and Convex URL if successful
   */
  async uploadImageToConvex(
    replicateUrl: string,
    sessionId: string,
    _userId: string,
  ): Promise<UploadImageResult> {
    let attempts = 0;
    let lastError: string | undefined;

    console.log('📤 Starting image upload to Convex Storage');
    console.log(`  Replicate URL: ${replicateUrl.substring(0, 60)}...`);
    console.log(`  Session ID: ${sessionId}`);

    const client = getConvexClient();

    while (attempts < CONFIG.MAX_RETRY_ATTEMPTS) {
      attempts++;
      console.log(`  Attempt ${attempts}/${CONFIG.MAX_RETRY_ATTEMPTS}`);

      try {
        // Step 1: Download image from Replicate
        const imageData = await this.downloadImage(replicateUrl);
        console.log(
          `  ✓ Downloaded image (${(imageData.data.byteLength / 1024).toFixed(
            2,
          )} KB)`,
        );

        // Step 2: Validate image size
        const sizeMB = imageData.data.byteLength / (1024 * 1024);
        if (sizeMB > CONFIG.MAX_IMAGE_SIZE_MB) {
          throw new Error(
            `Image too large: ${sizeMB.toFixed(2)}MB (max: ${
              CONFIG.MAX_IMAGE_SIZE_MB
            }MB)`,
          );
        }

        // Step 2.5: Validate MIME type
        if (!CONFIG.ALLOWED_MIME_TYPES.includes(imageData.contentType as any)) {
          throw new Error(
            `Invalid MIME type: ${
              imageData.contentType
            }. Allowed: ${CONFIG.ALLOWED_MIME_TYPES.join(', ')}`,
          );
        }

        // Step 3: Get presigned upload URL from Convex
        const uploadUrl = await client.mutation(api.storage.generateUploadUrl);
        console.log(`  ✓ Got presigned upload URL`);

        // Step 4: Upload image data to presigned URL
        const uploadResponse = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'Content-Type': imageData.contentType,
          },
          body: imageData.data,
        });

        if (!uploadResponse.ok) {
          throw new Error(
            `Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`,
          );
        }

        // Step 5: Parse response to get storageId
        const uploadResult = (await uploadResponse.json()) as {
          storageId: string;
        };
        const storageId = uploadResult.storageId as Id<'_storage'>;
        console.log(`  ✓ Uploaded to Convex storage: ${storageId}`);

        // Step 6: Link storage reference to game session
        const storeResult = await client.mutation(
          api.storage.storeImageReference,
          {
            sessionId: sessionId as Id<'gameSessions'>,
            storageId,
          },
        );

        const convexImageUrl = storeResult.imageUrl;
        console.log('  ✅ Upload successful!');
        console.log(`  Convex URL: ${convexImageUrl?.substring(0, 60)}...`);

        return {
          success: true,
          convexImageUrl,
          supabaseUrl: convexImageUrl, // Backward compatibility
          storageId: storageId as string,
          attempts,
          status: 'uploaded',
        };
      } catch (error: any) {
        lastError = error.message || String(error);
        console.error(`  ❌ Attempt ${attempts} failed:`, lastError);

        // Record failure in Convex for retry tracking
        try {
          await client.mutation(api.storage.recordUploadFailure, {
            sessionId: sessionId as Id<'gameSessions'>,
            error: lastError || 'Unknown error',
          });
        } catch (recordError) {
          // Don't fail the whole operation if we can't record the failure
          console.error('  ⚠️ Could not record upload failure:', recordError);
        }

        // If this was the last attempt, return failure
        if (attempts >= CONFIG.MAX_RETRY_ATTEMPTS) {
          console.error('  ⚠️  Max retry attempts reached');
          break;
        }

        // Calculate exponential backoff delay: 1s, 2s, 4s
        const delayMs = CONFIG.RETRY_DELAY_BASE_MS * Math.pow(2, attempts - 1);
        console.log(`  ⏳ Retrying in ${delayMs}ms...`);
        await this.delay(delayMs);
      }
    }

    // All attempts failed
    console.error('❌ Image upload failed after all retry attempts');
    return {
      success: false,
      error: lastError || 'Unknown upload error',
      attempts,
      status: 'failed',
    };
  }

  /**
   * Upload an image from Replicate URL to storage.
   * This is the main entry point - currently routes to Convex.
   *
   * @param replicateUrl - The temporary Replicate image URL
   * @param sessionId - Game session ID
   * @param userId - User ID
   * @returns Upload result with status and URL if successful
   */
  async uploadImageToSupabase(
    replicateUrl: string,
    sessionId: string,
    userId: string,
  ): Promise<UploadImageResult> {
    // Route to Convex implementation
    // The method name is kept for backward compatibility with existing callers
    return this.uploadImageToConvex(replicateUrl, sessionId, userId);
  }

  /**
   * Retry a previously failed upload
   * Uses the Convex uploadFromUrl action to fetch and store the image server-side
   * Used when user clicks "Retry Upload" button in the UI
   *
   * @param sessionId - The game session ID (Convex ID format)
   * @param _userId - The user ID (not used - auth via JWT)
   * @returns Retry result with success status
   */
  async retryFailedUpload(
    sessionId: string,
    _userId: string,
  ): Promise<RetryResult> {
    try {
      console.log('🔄 Manual retry initiated by user for session:', sessionId);

      const client = getConvexClient();

      // First, get the session to check if there's an image URL to retry
      const sessionImageInfo = await client.query(
        api.storage.getSessionImageUrl,
        {
          sessionId: sessionId as Id<'gameSessions'>,
        },
      );

      if (sessionImageInfo.error) {
        throw new Error(sessionImageInfo.error);
      }

      // If already uploaded successfully, skip retry
      if (
        sessionImageInfo.uploadStatus === 'uploaded' &&
        sessionImageInfo.imageUrl
      ) {
        console.log('⚠️  Image already uploaded, skipping retry');
        return {
          success: true,
          convexImageUrl: sessionImageInfo.imageUrl,
          supabaseUrl: sessionImageInfo.imageUrl,
          error: 'Image already uploaded',
        };
      }

      // Get the source URL from the session's generatedImageUrl
      // (This is the Replicate URL that was saved before upload failed)
      if (!sessionImageInfo.imageUrl) {
        throw new Error('No source image URL found for this session');
      }

      // Use the uploadFromUrl action to retry server-side
      const result = (await client.action(api.storage.uploadFromUrl, {
        sourceUrl: sessionImageInfo.imageUrl,
        sessionId: sessionId as Id<'gameSessions'>,
      })) as { success: boolean; storageId?: string; imageUrl?: string | null };

      return {
        success: result.success,
        convexImageUrl: result.imageUrl ?? undefined,
        supabaseUrl: result.imageUrl ?? undefined, // Backward compatibility
      };
    } catch (error: any) {
      console.error('❌ Retry failed:', error);
      return {
        success: false,
        error: error.message || 'Retry failed',
      };
    }
  }

  /**
   * Legacy method - routes to uploadImageToConvex
   * @deprecated Use uploadImageToConvex or uploadImageToSupabase instead
   */
  async retryUpload(
    replicateUrl: string,
    sessionId: string,
    userId: string,
  ): Promise<UploadImageResult> {
    console.log('🔄 Manual retry initiated by user (legacy method)');
    return this.uploadImageToConvex(replicateUrl, sessionId, userId);
  }

  /**
   * Download image from URL as ArrayBuffer
   * Includes timeout protection
   *
   * In React Native, we work directly with ArrayBuffer and avoid Blob
   * since RN's Blob implementation has limitations.
   */
  private async downloadImage(
    url: string,
  ): Promise<{ data: ArrayBuffer; contentType: string }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal as any, // Type compatibility fix for RN
        headers: {
          Accept: 'image/png,image/jpeg,image/webp,image/*',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Get content type from response headers, default to image/png
      const contentType = response.headers.get('content-type') || 'image/png';

      // Verify it's actually an image
      if (!contentType.startsWith('image/')) {
        throw new Error(`Invalid content type: ${contentType}`);
      }

      // Use arrayBuffer for proper binary handling in React Native
      const arrayBuffer = await response.arrayBuffer();

      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error('Downloaded image has no content');
      }

      return { data: arrayBuffer, contentType };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error(`Download timeout after ${CONFIG.TIMEOUT_MS}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Promise-based delay helper for retry backoff
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if Convex Storage is accessible
   * Useful for health checks and diagnostics
   */
  async checkStorageHealth(): Promise<{ healthy: boolean; error?: string }> {
    try {
      const client = getConvexClient();
      const result = await client.query(api.storage.checkStorageHealth);
      return { healthy: result.healthy };
    } catch (error: any) {
      return { healthy: false, error: error.message || 'Unknown error' };
    }
  }

  /**
   * Get the image URL for a session
   * Handles both Convex storage IDs and legacy external URLs
   *
   * @param sessionId - The game session ID
   * @returns The image URL or null
   */
  async getSessionImageUrl(sessionId: string): Promise<string | null> {
    try {
      const client = getConvexClient();
      const result = await client.query(api.storage.getSessionImageUrl, {
        sessionId: sessionId as Id<'gameSessions'>,
      });
      return result.imageUrl ?? null;
    } catch (error: any) {
      console.error('❌ Error getting session image URL:', error);
      return null;
    }
  }

  /**
   * Delete an image from Convex Storage
   * Used for cleanup or when user deletes a story
   *
   * @param sessionId - The game session ID
   * @returns Delete result
   */
  async deleteImage(
    sessionId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const client = getConvexClient();
      await client.mutation(api.storage.deleteImage, {
        sessionId: sessionId as Id<'gameSessions'>,
      });
      console.log('🗑️  Image deleted successfully for session:', sessionId);
      return { success: true };
    } catch (error: any) {
      console.error('❌ Error deleting image:', error);
      return { success: false, error: error.message || 'Unknown error' };
    }
  }

  /**
   * Get storage configuration for debugging
   */
  getConfig() {
    return { ...CONFIG };
  }

  /**
   * @deprecated No longer used - Convex doesn't need path generation
   * Kept for backward compatibility during transition
   */
  getPublicUrl(_userId: string, _sessionId: string): string {
    console.warn(
      '⚠️ getPublicUrl is deprecated - use getSessionImageUrl instead',
    );
    return '';
  }
}

// Export singleton instance
export const imageStorageService = new ImageStorageService();
