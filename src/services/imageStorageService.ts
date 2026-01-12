/**
 * Image Storage Service
 * Handles uploading generated images to Supabase Storage with retry logic
 * Provides permanent backup for images initially stored via Replicate URLs
 */

import { supabase } from './supabase';
import { ImageUploadStatus } from '../types/database';

// Upload result interface
export interface UploadImageResult {
  success: boolean;
  supabaseUrl?: string;
  error?: string;
  attempts: number;
  status: ImageUploadStatus;
}

// Retry result interface (for manual retry operations)
export interface RetryResult {
  success: boolean;
  supabaseUrl?: string;
  error?: string;
}

// Configuration constants
const CONFIG = {
  BUCKET_NAME: 'story-images',
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY_BASE_MS: 1000, // 1 second for first retry
  TIMEOUT_MS: 30000, // 30 seconds per upload attempt
  MAX_IMAGE_SIZE_MB: 10,
  ALLOWED_MIME_TYPES: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
} as const;

/**
 * ImageStorageService
 * Manages permanent image storage in Supabase with exponential backoff retry
 */
export class ImageStorageService {
  /**
   * Upload an image from Replicate URL to Supabase Storage
   *
   * @param replicateUrl - The temporary Replicate image URL
   * @param sessionId - Game session ID for organizing images
   * @param userId - User ID for folder organization and security
   * @returns Upload result with status and Supabase URL if successful
   */
  async uploadImageToSupabase(
    replicateUrl: string,
    sessionId: string,
    userId: string
  ): Promise<UploadImageResult> {
    let attempts = 0;
    let lastError: string | undefined;

    console.log('📤 Starting image upload to Supabase Storage');
    console.log(`  Replicate URL: ${replicateUrl.substring(0, 60)}...`);
    console.log(`  Session ID: ${sessionId}`);

    while (attempts < CONFIG.MAX_RETRY_ATTEMPTS) {
      attempts++;
      console.log(`  Attempt ${attempts}/${CONFIG.MAX_RETRY_ATTEMPTS}`);

      try {
        // Step 1: Download image from Replicate
        const imageData = await this.downloadImage(replicateUrl);
        console.log(`  ✓ Downloaded image (${(imageData.data.byteLength / 1024).toFixed(2)} KB)`);

        // Step 2: Validate image size
        const sizeMB = imageData.data.byteLength / (1024 * 1024);
        if (sizeMB > CONFIG.MAX_IMAGE_SIZE_MB) {
          throw new Error(`Image too large: ${sizeMB.toFixed(2)}MB (max: ${CONFIG.MAX_IMAGE_SIZE_MB}MB)`);
        }

        // Step 2.5: Validate MIME type
        if (!CONFIG.ALLOWED_MIME_TYPES.includes(imageData.contentType as any)) {
          throw new Error(`Invalid MIME type: ${imageData.contentType}. Allowed: ${CONFIG.ALLOWED_MIME_TYPES.join(', ')}`);
        }

        // Step 3: Generate file path
        const filePath = this.generateFilePath(userId, sessionId);
        console.log(`  Upload path: ${filePath}`);

        // Step 4: Upload to Supabase Storage
        // In React Native, we upload the ArrayBuffer directly
        // Convert to Uint8Array which Supabase Storage accepts
        const uint8Array = new Uint8Array(imageData.data);

        const { error } = await supabase.storage
          .from(CONFIG.BUCKET_NAME)
          .upload(filePath, uint8Array, {
            contentType: imageData.contentType,
            upsert: true, // Allow overwriting if retrying
            cacheControl: '31536000', // Cache for 1 year (images are immutable)
          });

        if (error) {
          throw new Error(`Supabase upload failed: ${error.message}`);
        }

        // Step 5: Get public URL
        const { data: publicUrlData } = supabase.storage
          .from(CONFIG.BUCKET_NAME)
          .getPublicUrl(filePath);

        if (!publicUrlData || !publicUrlData.publicUrl) {
          throw new Error('Failed to get public URL from Supabase');
        }

        const supabaseUrl = publicUrlData.publicUrl;
        console.log('  ✅ Upload successful!');
        console.log(`  Supabase URL: ${supabaseUrl.substring(0, 60)}...`);

        // Update database with success status
        await this.updateSessionUploadStatus(sessionId, {
          supabaseUrl,
          status: 'uploaded',
          attempts,
          error: null,
        });

        return {
          success: true,
          supabaseUrl,
          attempts,
          status: 'uploaded',
        };

      } catch (error: any) {
        lastError = error.message || String(error);
        console.error(`  ❌ Attempt ${attempts} failed:`, lastError);

        // Update database with failed attempt
        await this.updateSessionUploadStatus(sessionId, {
          status: 'failed',
          attempts,
          error: lastError,
        });

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
   * Retry a previously failed upload
   * Fetches the Replicate URL from the database and attempts upload again
   * Used when user clicks "Retry Upload" button in the UI
   *
   * @param sessionId - The game session ID
   * @param userId - The user ID
   * @returns Retry result with success status
   */
  async retryFailedUpload(
    sessionId: string,
    userId: string
  ): Promise<RetryResult> {
    try {
      console.log('🔄 Manual retry initiated by user for session:', sessionId);

      // Fetch session data to get the Replicate URL
      const { data: session, error } = await supabase
        .from('game_sessions')
        .select('generated_image_url, image_upload_status')
        .eq('id', sessionId)
        .single<{
          generated_image_url?: string;
          image_upload_status?: string;
        }>();

      if (error) {
        throw new Error(`Failed to fetch session: ${error.message}`);
      }

      if (!session || !session.generated_image_url) {
        throw new Error('No Replicate image URL found for this session');
      }

      if (session.image_upload_status === 'uploaded') {
        console.log('⚠️  Image already uploaded, skipping retry');
        return {
          success: true,
          error: 'Image already uploaded',
        };
      }

      // Attempt upload with the Replicate URL from database
      const replicateUrl = session.generated_image_url;
      const result = await this.uploadImageToSupabase(
        replicateUrl,
        sessionId,
        userId
      );

      return {
        success: result.success,
        supabaseUrl: result.supabaseUrl,
        error: result.error,
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
   * Legacy method - use retryFailedUpload instead
   * @deprecated Use retryFailedUpload(sessionId, userId) instead
   */
  async retryUpload(
    replicateUrl: string,
    sessionId: string,
    userId: string
  ): Promise<UploadImageResult> {
    console.log('🔄 Manual retry initiated by user (legacy method)');
    return this.uploadImageToSupabase(replicateUrl, sessionId, userId);
  }

  /**
   * Update game session with upload status
   * Updates the database with current upload progress and results
   *
   * @param sessionId - The session ID
   * @param options - Status update options
   */
  private async updateSessionUploadStatus(
    sessionId: string,
    options: {
      supabaseUrl?: string;
      status: ImageUploadStatus;
      attempts: number;
      error?: string | null;
    }
  ): Promise<void> {
    try {
      const updateData: {
        image_upload_status: ImageUploadStatus;
        image_upload_attempts: number;
        supabase_image_url?: string;
        image_upload_error?: string | null;
      } = {
        image_upload_status: options.status,
        image_upload_attempts: options.attempts,
      };

      if (options.supabaseUrl) {
        updateData.supabase_image_url = options.supabaseUrl;
      }

      if (options.error !== undefined) {
        updateData.image_upload_error = options.error;
      }

      // Perform database update with proper error handling
      console.log('🔄 Updating session with data:', {
        sessionId,
        status: options.status,
        attempts: options.attempts,
        hasSupabaseUrl: !!options.supabaseUrl,
      });

      const result = await supabase
        .from('game_sessions')
        .update(updateData as any)
        .eq('id', sessionId);

      if (result.error) {
        console.error('❌ Failed to update session upload status:', result.error?.message || result.error);
      } else {
        console.log('✓ Session upload status updated:', options.status);
      }

    } catch (error: any) {
      // Handle various error formats
      const errorMessage = error?.message || error?.toString?.() || String(error);
      console.error('❌ Error updating session status:', errorMessage);
      console.error('❌ Error details:', error);
      // Don't throw - upload status update is non-critical
    }
  }

  /**
   * Download image from URL as ArrayBuffer
   * Includes timeout protection
   *
   * In React Native, we work directly with ArrayBuffer and avoid Blob
   * since RN's Blob implementation has limitations.
   */
  private async downloadImage(url: string): Promise<{ data: ArrayBuffer; contentType: string }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal as any, // Type compatibility fix for RN
        headers: {
          'Accept': 'image/png,image/jpeg,image/webp,image/*',
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
   * Generate organized file path in Supabase Storage
   * Format: {userId}/{sessionId}.png
   *
   * This structure:
   * - Organizes images by user (easy to implement user-level quotas)
   * - Uses session ID as filename (prevents collisions, easy to find)
   * - Supports RLS policies based on user_id folder structure
   */
  private generateFilePath(userId: string, sessionId: string): string {
    // Sanitize inputs to prevent path traversal attacks
    const sanitizedUserId = userId.replace(/[^a-zA-Z0-9-]/g, '');
    const sanitizedSessionId = sessionId.replace(/[^a-zA-Z0-9-]/g, '');

    return `${sanitizedUserId}/${sanitizedSessionId}.png`;
  }

  /**
   * Promise-based delay helper for retry backoff
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if Supabase Storage bucket exists and is accessible
   * Useful for health checks and diagnostics
   */
  async checkStorageHealth(): Promise<{ healthy: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.storage
        .from(CONFIG.BUCKET_NAME)
        .list('', { limit: 1 });

      if (error) {
        return { healthy: false, error: error.message };
      }

      return { healthy: true };
    } catch (error: any) {
      return { healthy: false, error: error.message || 'Unknown error' };
    }
  }

  /**
   * Get the public URL for an already uploaded image
   * Does not check if the file exists
   */
  getPublicUrl(userId: string, sessionId: string): string {
    const filePath = this.generateFilePath(userId, sessionId);
    const { data } = supabase.storage
      .from(CONFIG.BUCKET_NAME)
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  /**
   * Delete an image from Supabase Storage
   * Used for cleanup or when user deletes a story
   */
  async deleteImage(userId: string, sessionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const filePath = this.generateFilePath(userId, sessionId);

      const { error } = await supabase.storage
        .from(CONFIG.BUCKET_NAME)
        .remove([filePath]);

      if (error) {
        console.error('❌ Failed to delete image:', error);
        return { success: false, error: error.message };
      }

      console.log('🗑️  Image deleted successfully:', filePath);
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
}

// Export singleton instance
export const imageStorageService = new ImageStorageService();
