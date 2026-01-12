# Product Requirements Document: Story Completion Tracking & Image Persistence

## 1. Overview

### Feature Summary
Implement proper story completion tracking and enhanced image persistence to ensure stories are properly marked as complete when they reach the maximum round count (5 rounds), and generated images are permanently backed up to Supabase Storage in addition to the temporary Replicate URLs.

### Problem Statement
Currently, the application has two critical issues:
1. **Story Completion Bug**: The `completed_at` field in game_sessions is never set, making it impossible to track which stories are actually finished. This breaks analytics, leaderboards, and user progress tracking.
2. **Image Persistence Risk**: Generated images are only stored via Replicate URLs, which may expire or become unavailable. There's no permanent backup, risking loss of user-generated content.

### Business Value
- **Data Integrity**: Proper completion tracking enables accurate analytics and user engagement metrics
- **User Experience**: Permanent image storage prevents disappointment from lost images
- **Compliance**: Reliable data retention meets user expectations and potential regulatory requirements
- **Cost Optimization**: Only generate images for completed stories (reduces unnecessary API costs)
- **Feature Foundation**: Completion tracking is required for future features like "Completed Only" filters and completion achievements

### Success Metrics
- 100% of stories that reach MAX_ROUNDS (5) have `completed_at` set
- 100% of generated images have both Replicate URL and Supabase Storage URL
- Image generation only occurs when `current_round >= MAX_ROUNDS`
- Backward compatibility: All existing stories work without data migration issues
- Zero image generation failures due to XP deduction/refund bugs
- 95%+ success rate for Supabase Storage uploads (with graceful fallback)

---

## 2. User Stories

### As a Story Writer
- **Story Completion**: When I complete my 5th round of story writing, I want the system to automatically mark my story as complete so I can see it in my "completed stories" list
- **Image Generation Timing**: When my story is complete, I want the option to generate an image so I can visualize my finished work
- **Image Reliability**: When I generate an image for my story, I want it to be permanently saved so I can access it anytime in the future
- **Visual Feedback**: When viewing my completed story, I want to clearly see that it's finished and see my generated image (if I created one)

### As a Developer
- **Data Consistency**: I need `completed_at` to be reliably set when stories finish so analytics queries work correctly
- **State Management**: I need to track the current round number persistently so the app knows when a story is complete
- **Image URLs**: I need both Replicate URL (temporary) and Supabase Storage URL (permanent) saved in the database for fallback functionality
- **Error Handling**: I need proper error handling for Supabase uploads that doesn't break the user experience

### As a Product Owner
- **Analytics**: I need accurate completion data to measure user engagement and story completion rates
- **Content Preservation**: I need all user-generated images backed up permanently to prevent data loss
- **Cost Control**: I need images to only be generated for completed stories to optimize API costs
- **Feature Enablement**: I need completion tracking to enable future features like achievements, badges, and filtered views

---

## 3. Functional Requirements

### 3.1 Story Completion Tracking

#### 3.1.1 Round Counter Implementation
- **FR-1.1**: Add `current_round` column to `game_sessions` table (integer, default: 1, not null)
- **FR-1.2**: Increment `current_round` after each user contribution + AI response cycle
- **FR-1.3**: Track `current_round` in the `StorySession` interface for local state management
- **FR-1.4**: Persist `current_round` to database on each session update

#### 3.1.2 Completion Detection
- **FR-1.5**: When `current_round` reaches `MAX_ROUNDS` (5), automatically set `completed_at` to current timestamp
- **FR-1.6**: Set `isCompleted` flag to `true` in local StorySession state
- **FR-1.7**: Update `sessionStats.sessionDuration` to reflect total time from `created_at` to `completed_at`
- **FR-1.8**: Trigger completion event for XP award calculation (if not already awarded)

#### 3.1.3 Completion State Persistence
- **FR-1.9**: Call `storySessionManager.completeSession(sessionId)` when round limit reached
- **FR-1.10**: Update Supabase `game_sessions` table with `completed_at` timestamp
- **FR-1.11**: Cache completed state locally for offline access
- **FR-1.12**: Clear "current session" reference in AsyncStorage after completion

#### 3.1.4 Backward Compatibility
- **FR-1.13**: Existing sessions without `current_round` default to round 1
- **FR-1.14**: Auto-complete existing stories that have 5+ contributions via migration
- **FR-1.15**: Preserve all existing story data during migration

### 3.2 Image Generation Gating

#### 3.2.1 Completion Requirement
- **FR-2.1**: Disable image generation UI if `current_round < MAX_ROUNDS`
- **FR-2.2**: Show disabled state with message: "Complete your story (Round {currentRound}/{MAX_ROUNDS}) to unlock image generation"
- **FR-2.3**: Enable image generation UI only when `isCompleted === true` OR `current_round >= MAX_ROUNDS`
- **FR-2.4**: Display XP cost and balance check only when image generation is enabled

#### 3.2.2 UI State Management
- **FR-2.5**: Update `ImageGeneration` component to accept `disabled` prop based on completion state
- **FR-2.6**: Pass `isCompleted` and `currentRound` props from HomeScreen to ImageGeneration component
- **FR-2.7**: Show completion progress indicator (e.g., "Round 3/5") near image generation section
- **FR-2.8**: Update button text to indicate completion requirement when disabled

### 3.3 Supabase Storage Integration

#### 3.3.1 Storage Bucket Setup
- **FR-3.1**: Create `story-images` storage bucket in Supabase (if not exists)
- **FR-3.2**: Configure bucket as private with authenticated user access only
- **FR-3.3**: Set up Row Level Security (RLS) policies:
  - Users can upload to their own folder: `user_id/{userId}/session_{sessionId}/*`
  - Users can read from their own folder only
  - No public access allowed
- **FR-3.4**: Configure bucket settings:
  - Max file size: 10MB
  - Allowed MIME types: `image/png`, `image/jpeg`, `image/webp`
  - File storage path pattern: `{userId}/session_{sessionId}/image_{timestamp}.{ext}`

#### 3.3.2 Image Upload Service
- **FR-3.5**: Create `imageStorageService.ts` in `/src/services/` directory
- **FR-3.6**: Implement `uploadImageToSupabase(imageUrl: string, sessionId: string, userId: string)` method
- **FR-3.7**: Download image from Replicate URL to temporary buffer/blob
- **FR-3.8**: Upload blob to Supabase Storage bucket with proper file path
- **FR-3.9**: Return public URL for the uploaded image
- **FR-3.10**: Implement automatic retry logic (max 3 attempts) with exponential backoff
- **FR-3.11**: Handle network errors, timeout errors, and storage quota errors gracefully

#### 3.3.3 Database Schema Updates
- **FR-3.12**: Add `supabase_image_url` column to `game_sessions` table (text, nullable)
- **FR-3.13**: Keep existing `generated_image_url` column for Replicate URL (backward compatibility)
- **FR-3.14**: Add `image_upload_status` column (enum: 'pending', 'uploaded', 'failed', nullable)
- **FR-3.15**: Add `image_upload_attempts` column (integer, default: 0)
- **FR-3.16**: Add `image_upload_error` column (text, nullable) for debugging

#### 3.3.4 Upload Flow Integration
- **FR-3.17**: After successful Replicate image generation in `imageGenerationService.ts`:
  1. Save Replicate URL to `generated_image_url` field immediately
  2. Attempt Supabase Storage upload
  3. If upload succeeds, save Supabase URL to `supabase_image_url` and set `image_upload_status` to 'uploaded'
  4. If upload fails, increment `image_upload_attempts` and log error
  5. If upload fails after 3 retries, set `image_upload_status` to 'failed' and save error message
- **FR-3.18**: User sees image immediately via Replicate URL (no blocking on Supabase upload)
- **FR-3.19**: Background upload to Supabase happens asynchronously after user confirmation

### 3.4 Image Display with Fallback

#### 3.4.1 Display Priority Logic
- **FR-4.1**: Update `StoryImageDisplay` component to handle both URL fields
- **FR-4.2**: Display priority: `supabase_image_url` (if exists) → `generated_image_url` (fallback) → placeholder
- **FR-4.3**: Show loading indicator during image fetch
- **FR-4.4**: Show upload status badge if Supabase upload is pending or failed:
  - Pending: "🔄 Backing up..."
  - Failed: "⚠️ Backup failed (image still available)"
- **FR-4.5**: Add retry button for failed uploads (visible to user only if `image_upload_status === 'failed'`)

#### 3.4.2 Error Handling
- **FR-4.6**: If Supabase URL fails to load, automatically fall back to Replicate URL
- **FR-4.7**: If both URLs fail, show error state with retry option
- **FR-4.8**: Log all image load failures for monitoring
- **FR-4.9**: Don't break UI if image is unavailable - show placeholder gracefully

### 3.5 XP Management

#### 3.5.1 XP Deduction Validation
- **FR-5.1**: Before image generation, verify story is completed: `isCompleted === true`
- **FR-5.2**: Check user has sufficient XP balance (>= IMAGE_GENERATION_COST = 1000 XP)
- **FR-5.3**: Deduct XP only after both checks pass
- **FR-5.4**: Create `image_generation_event` tracking record before deduction

#### 3.5.2 XP Refund Logic
- **FR-5.5**: If Replicate image generation fails → full refund (1000 XP)
- **FR-5.6**: If Replicate succeeds but Supabase upload fails → NO refund (user still gets image via Replicate URL)
- **FR-5.7**: If content safety violation → NO refund (user violated policy)
- **FR-5.8**: Update `image_generation_event` status to track refunds accurately

#### 3.5.3 XP Event Tracking
- **FR-5.9**: Update `xpEventTracker.updateImageGenerationEvent()` to include:
  - `supabase_upload_status`: 'success' | 'failed' | 'pending'
  - `supabase_url`: URL if upload succeeded
  - `upload_attempts`: Number of retry attempts made
- **FR-5.10**: Log all XP transactions (deductions and refunds) with timestamps
- **FR-5.11**: Ensure XP balance is consistent across all failure scenarios

### 3.6 Offline Support

#### 3.6.1 Local Caching
- **FR-6.1**: Cache `supabase_image_url` in AsyncStorage via `cacheSessionLocally()` method
- **FR-6.2**: Cache `generated_image_url` (Replicate URL) as fallback for offline viewing
- **FR-6.3**: Cache `image_upload_status` to show upload state even when offline
- **FR-6.4**: When offline, display cached images with indicator showing "Offline Mode"

#### 3.6.2 Sync Behavior
- **FR-6.5**: When app goes online, sync cached sessions with Supabase database
- **FR-6.6**: Update local cache if Supabase has newer `supabase_image_url` data
- **FR-6.7**: Preserve offline-cached images during sync (don't delete until confirmed uploaded)

#### 3.6.3 Multi-Device Story Import
- **FR-6.8**: User can view completed stories with images across devices via database sync
- **FR-6.9**: Story import functionality already handles fetching from Supabase database
- **FR-6.10**: Ensure `getSession()` method fetches both image URL fields from database for cross-device access

---

## 4. Non-Functional Requirements

### 4.1 Performance
- **NFR-1**: Image upload to Supabase should not block UI (must be asynchronous)
- **NFR-2**: Image generation flow should complete in < 60 seconds (Replicate + Supabase)
- **NFR-3**: Supabase upload should have 3-second timeout per retry attempt
- **NFR-4**: Database queries for completion tracking should add < 50ms overhead
- **NFR-5**: Local state updates (currentRound) should be instant (< 16ms)

### 4.2 Reliability
- **NFR-6**: Story completion tracking must have 100% accuracy (no missed completions)
- **NFR-7**: Supabase upload must have automatic retry with exponential backoff
- **NFR-8**: System must gracefully handle network failures during image upload
- **NFR-9**: XP refund logic must be idempotent (no double refunds)
- **NFR-10**: All database operations must be atomic (transaction-safe)

### 4.3 Security
- **NFR-11**: Supabase Storage bucket must have proper RLS policies (user isolation)
- **NFR-12**: Image URLs must not be guessable (use UUID/timestamp in filenames)
- **NFR-13**: User can only access their own uploaded images
- **NFR-14**: Validate file type and size before upload (prevent malicious uploads)
- **NFR-15**: All database migrations must preserve RLS policies

### 4.4 Scalability
- **NFR-16**: Supabase Storage must handle 1000+ concurrent uploads without degradation
- **NFR-17**: Database schema changes must not require downtime
- **NFR-18**: Image upload queue can scale to handle high traffic periods
- **NFR-19**: Storage bucket can accommodate unlimited user growth (with proper cleanup)

### 4.5 Maintainability
- **NFR-20**: All new code must have TypeScript type definitions
- **NFR-21**: Image upload service must have comprehensive error logging
- **NFR-22**: Database migrations must be reversible (rollback support)
- **NFR-23**: Code must follow existing patterns in `storySessionManager` and `imageGenerationService`

### 4.6 Backward Compatibility
- **NFR-24**: Existing stories without `current_round` must still function correctly
- **NFR-25**: Existing images with only `generated_image_url` must still display
- **NFR-26**: Migration must not break any existing user data
- **NFR-27**: API changes must be additive only (no breaking changes)

---

## 5. Technical Design

### 5.1 Database Schema Changes

#### Migration: Add Story Completion & Image Persistence Fields
```sql
-- Add current_round and supabase_image_url columns to game_sessions
ALTER TABLE game_sessions
  ADD COLUMN IF NOT EXISTS current_round INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS supabase_image_url TEXT,
  ADD COLUMN IF NOT EXISTS image_upload_status TEXT CHECK (image_upload_status IN ('pending', 'uploaded', 'failed')),
  ADD COLUMN IF NOT EXISTS image_upload_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_upload_error TEXT;

-- Add index for efficient querying of completed stories
CREATE INDEX IF NOT EXISTS idx_game_sessions_completed_at ON game_sessions(completed_at) WHERE completed_at IS NOT NULL;

-- Add index for image upload status queries
CREATE INDEX IF NOT EXISTS idx_game_sessions_upload_status ON game_sessions(image_upload_status) WHERE image_upload_status IS NOT NULL;

-- Auto-complete stories that have reached MAX_ROUNDS (5+ contributions)
UPDATE game_sessions
SET
  completed_at = COALESCE(completed_at, created_at + INTERVAL '30 minutes'), -- Estimate completion time if missing
  current_round = GREATEST(sentences_completed, 5)
WHERE
  sentences_completed >= 5
  AND completed_at IS NULL;

-- Update current_round for in-progress stories based on sentences_completed
UPDATE game_sessions
SET current_round = LEAST(GREATEST((sentences_completed + 1) / 2, 1), 5)
WHERE current_round = 1 AND sentences_completed > 0;

-- Add comment for documentation
COMMENT ON COLUMN game_sessions.current_round IS 'Current round number (1-5). Story is complete when current_round >= 5.';
COMMENT ON COLUMN game_sessions.supabase_image_url IS 'Permanent Supabase Storage URL for generated image (backup of generated_image_url).';
COMMENT ON COLUMN game_sessions.image_upload_status IS 'Upload status for Supabase Storage: pending, uploaded, or failed.';
```

#### Supabase Storage Bucket Setup
```typescript
// Run this via Supabase Dashboard or API
// 1. Create storage bucket
// 2. Set up RLS policies

-- Create storage bucket (run via Supabase SQL editor)
INSERT INTO storage.buckets (id, name, public)
VALUES ('story-images', 'story-images', false)
ON CONFLICT (id) DO NOTHING;

-- RLS Policy: Users can upload to their own folder
CREATE POLICY "Users can upload their own images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'story-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS Policy: Users can read their own images
CREATE POLICY "Users can read their own images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'story-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS Policy: Users can update their own images
CREATE POLICY "Users can update their own images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'story-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS Policy: Users can delete their own images
CREATE POLICY "Users can delete their own images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'story-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

### 5.2 TypeScript Type Updates

#### Update `src/types/database.ts`
```typescript
export interface GameSession {
  id: string;
  user_id: string;
  created_at: string;
  completed_at?: string;

  // Game Data
  grade_level: GradeLevel;
  final_score: number;
  words_written: number;
  sentences_completed: number;
  challenges_completed: number;
  xp_earned: number;

  // Story Content
  story_content?: string;

  // Story Continuation Fields
  imported_story_content?: string;
  story_source: StorySource;
  original_creation_date?: string;
  story_metadata: Record<string, any>;

  // Image Generation Fields
  generated_image_url?: string;
  image_generation_timestamp?: string;
  image_generation_cost?: number;

  // NEW: Image Persistence Fields
  supabase_image_url?: string;
  image_upload_status?: 'pending' | 'uploaded' | 'failed';
  image_upload_attempts?: number;
  image_upload_error?: string;

  // NEW: Story Completion Tracking
  current_round: number; // 1-5, not nullable
}
```

#### Update `src/services/storySessionManager.ts`
```typescript
export interface StorySession {
  // ... existing fields ...

  // NEW: Story completion tracking
  current_round: number;

  // NEW: Enhanced image fields
  supabase_image_url?: string;
  image_upload_status?: 'pending' | 'uploaded' | 'failed';
  image_upload_attempts?: number;
  image_upload_error?: string;
}
```

### 5.3 Service Layer Changes

#### New Service: `src/services/imageStorageService.ts`
```typescript
import { supabase } from './supabase';

export interface UploadImageResult {
  success: boolean;
  supabaseUrl?: string;
  error?: string;
  attempts: number;
}

class ImageStorageService {
  private readonly BUCKET_NAME = 'story-images';
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY_MS = 1000; // Start with 1 second

  /**
   * Upload image to Supabase Storage with automatic retry
   * @param replicateUrl - URL of image from Replicate
   * @param sessionId - Game session ID
   * @param userId - User ID (Supabase UUID)
   * @returns Upload result with Supabase URL or error
   */
  async uploadImageToSupabase(
    replicateUrl: string,
    sessionId: string,
    userId: string
  ): Promise<UploadImageResult> {
    let attempts = 0;
    let lastError: string | undefined;

    while (attempts < this.MAX_RETRY_ATTEMPTS) {
      attempts++;

      try {
        console.log(`🔄 Uploading image to Supabase (attempt ${attempts}/${this.MAX_RETRY_ATTEMPTS})...`);

        // Step 1: Download image from Replicate
        const imageBlob = await this.downloadImage(replicateUrl);

        // Step 2: Generate storage path
        const filePath = this.generateFilePath(userId, sessionId);

        // Step 3: Upload to Supabase Storage
        const { data, error } = await supabase.storage
          .from(this.BUCKET_NAME)
          .upload(filePath, imageBlob, {
            contentType: 'image/png',
            upsert: true, // Allow overwrite on retry
          });

        if (error) {
          throw new Error(`Supabase upload error: ${error.message}`);
        }

        // Step 4: Get public URL
        const { data: publicUrlData } = supabase.storage
          .from(this.BUCKET_NAME)
          .getPublicUrl(filePath);

        console.log('✅ Image uploaded to Supabase successfully:', publicUrlData.publicUrl);

        return {
          success: true,
          supabaseUrl: publicUrlData.publicUrl,
          attempts,
        };

      } catch (error: any) {
        lastError = error.message || 'Unknown upload error';
        console.error(`❌ Upload attempt ${attempts} failed:`, lastError);

        // Exponential backoff before retry
        if (attempts < this.MAX_RETRY_ATTEMPTS) {
          const delayMs = this.RETRY_DELAY_MS * Math.pow(2, attempts - 1);
          console.log(`⏳ Retrying in ${delayMs}ms...`);
          await this.delay(delayMs);
        }
      }
    }

    // All retries failed
    console.error('❌ All upload attempts failed:', lastError);
    return {
      success: false,
      error: lastError,
      attempts,
    };
  }

  /**
   * Download image from URL to Blob
   */
  private async downloadImage(url: string): Promise<Blob> {
    const response = await fetch(url, { timeout: 10000 }); // 10s timeout

    if (!response.ok) {
      throw new Error(`Failed to download image: HTTP ${response.status}`);
    }

    const blob = await response.blob();

    // Validate file size (max 10MB)
    if (blob.size > 10 * 1024 * 1024) {
      throw new Error('Image size exceeds 10MB limit');
    }

    return blob;
  }

  /**
   * Generate unique storage file path
   * Pattern: {userId}/session_{sessionId}/image_{timestamp}.png
   */
  private generateFilePath(userId: string, sessionId: string): string {
    const timestamp = Date.now();
    return `${userId}/session_${sessionId}/image_${timestamp}.png`;
  }

  /**
   * Delay helper for retry backoff
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Retry failed upload for a specific session
   * Called from UI retry button
   */
  async retryFailedUpload(sessionId: string, userId: string): Promise<UploadImageResult> {
    // Fetch current session to get Replicate URL
    const { data: session, error } = await supabase
      .from('game_sessions')
      .select('generated_image_url, image_upload_attempts')
      .eq('id', sessionId)
      .single();

    if (error || !session?.generated_image_url) {
      return {
        success: false,
        error: 'Session not found or no image URL',
        attempts: session?.image_upload_attempts || 0,
      };
    }

    // Attempt upload
    const result = await this.uploadImageToSupabase(
      session.generated_image_url,
      sessionId,
      userId
    );

    // Update database with result
    await this.updateSessionUploadStatus(sessionId, result);

    return result;
  }

  /**
   * Update game_sessions with upload status
   */
  private async updateSessionUploadStatus(
    sessionId: string,
    result: UploadImageResult
  ): Promise<void> {
    const updateData: any = {
      image_upload_attempts: result.attempts,
    };

    if (result.success) {
      updateData.supabase_image_url = result.supabaseUrl;
      updateData.image_upload_status = 'uploaded';
      updateData.image_upload_error = null;
    } else {
      updateData.image_upload_status = 'failed';
      updateData.image_upload_error = result.error;
    }

    const { error } = await supabase
      .from('game_sessions')
      .update(updateData)
      .eq('id', sessionId);

    if (error) {
      console.error('Failed to update session upload status:', error);
    }
  }
}

export const imageStorageService = new ImageStorageService();
```

#### Update `src/services/imageGenerationService.ts`
```typescript
import { imageStorageService } from './imageStorageService';

// In the generateImage method, after successful Replicate generation:
async generateImage(params: GenerateImageParams): Promise<GenerateImageResult> {
  try {
    // ... existing Replicate generation code ...

    // After successful generation
    const replicateImageUrl = result.output[0]; // Replicate URL

    // Save Replicate URL to database immediately (user can see image right away)
    await this.saveImageUrlToSession(params.sessionId, replicateImageUrl);

    // Asynchronously upload to Supabase Storage (don't block user)
    this.uploadToSupabaseAsync(replicateImageUrl, params.sessionId, params.userId);

    return {
      success: true,
      imageUrl: replicateImageUrl, // User sees Replicate URL immediately
      serviceUsed: 'replicate',
      responseTimeMs: elapsed,
    };
  } catch (error) {
    // ... existing error handling ...
  }
}

/**
 * Asynchronous upload to Supabase Storage (non-blocking)
 */
private async uploadToSupabaseAsync(
  replicateUrl: string,
  sessionId: string,
  userId: string
): Promise<void> {
  try {
    console.log('🔄 Starting background Supabase upload...');

    // Set status to pending in database
    await supabase
      .from('game_sessions')
      .update({ image_upload_status: 'pending' })
      .eq('id', sessionId);

    // Upload to Supabase with retry logic
    const uploadResult = await imageStorageService.uploadImageToSupabase(
      replicateUrl,
      sessionId,
      userId
    );

    // Update database with upload result
    const updateData: any = {
      image_upload_attempts: uploadResult.attempts,
    };

    if (uploadResult.success) {
      updateData.supabase_image_url = uploadResult.supabaseUrl;
      updateData.image_upload_status = 'uploaded';
      updateData.image_upload_error = null;
      console.log('✅ Supabase upload completed successfully');
    } else {
      updateData.image_upload_status = 'failed';
      updateData.image_upload_error = uploadResult.error;
      console.error('❌ Supabase upload failed:', uploadResult.error);
    }

    await supabase
      .from('game_sessions')
      .update(updateData)
      .eq('id', sessionId);

  } catch (error) {
    console.error('❌ Background Supabase upload error:', error);
    // Don't throw - this is non-blocking background operation
  }
}
```

#### Update `src/services/storySessionManager.ts`
```typescript
// In addContribution method:
public async addContribution(
  sessionId: string,
  type: 'user' | 'ai',
  content: string,
  existingSession?: StorySession,
): Promise<StorySession | null> {
  const session = existingSession || (await this.getSession(sessionId));
  if (!session) return null;

  // ... existing contribution logic ...

  // NEW: Increment round counter after each full cycle (user + AI)
  if (type === 'ai') {
    session.current_round = Math.min(session.current_round + 1, MAX_ROUNDS);

    // Check if story is now complete
    if (session.current_round >= MAX_ROUNDS && !session.isCompleted) {
      console.log('🎉 Story reached MAX_ROUNDS - marking as complete');
      session.isCompleted = true;
      session.completed_at = new Date().toISOString();
    }
  }

  // Update session in Supabase
  const updatedSession = await this.updateSession(session);
  return updatedSession;
}

// In updateSession method - include current_round in database update:
public async updateSession(session: StorySession): Promise<StorySession | null> {
  try {
    const updateData = {
      story_content: session.story_content,
      words_written: session.words_written,
      sentences_completed: session.sentences_completed,
      final_score: session.final_score,
      xp_earned: session.xp_earned,
      completed_at: session.isCompleted ? session.completed_at : null,
      current_round: session.current_round, // NEW
      generated_image_url: session.generated_image_url || null,
      supabase_image_url: session.supabase_image_url || null, // NEW
      image_upload_status: session.image_upload_status || null, // NEW
      // ... other fields ...
    };

    // ... rest of update logic ...
  }
}

// NEW: Update cacheSessionLocally to support offline Supabase URL caching
private async cacheSessionLocally(session: StorySession): Promise<void> {
  try {
    const sessionsData = await AsyncStorage.getItem(this.SESSIONS_KEY);
    const sessions: Record<string, StorySession> = sessionsData
      ? JSON.parse(sessionsData)
      : {};

    // Cache full session including Supabase image URL for offline viewing
    sessions[session.id] = {
      ...session,
      // Explicitly preserve image URLs for offline access
      generated_image_url: session.generated_image_url,
      supabase_image_url: session.supabase_image_url, // NEW: Cache for offline viewing
      image_upload_status: session.image_upload_status,
    };

    // Clean up old sessions if needed
    await this.cleanupOldSessions(sessions);

    await AsyncStorage.setItem(this.SESSIONS_KEY, JSON.stringify(sessions));
    console.log('📦 Session cached locally with image URLs for offline access');
  } catch (error) {
    console.error('Error caching session locally:', error);
  }
}
```

### 5.4 UI/Component Changes

#### Update `src/components/common/ImageGeneration.tsx`
```typescript
interface ImageGenerationProps {
  storyContent: string;
  sessionId: string;
  gradeLevel: string;
  wordCount: number;
  onImageGenerated?: (imageUrl: string) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  isStoryCompleted: boolean; // NEW
  currentRound: number; // NEW
  maxRounds: number; // NEW
}

const ImageGeneration: React.FC<ImageGenerationProps> = ({
  // ... existing props ...
  isStoryCompleted,
  currentRound,
  maxRounds,
}) => {
  // Disable button if story is not completed
  const isDisabledByCompletion = !isStoryCompleted;
  const isButtonDisabled = disabled || !xpBalanceInfo.canGenerate || state.isGenerating || isDisabledByCompletion;

  // Update disabled state message
  const renderDisabledState = () => {
    if (isDisabledByCompletion) {
      return (
        <View style={styles.disabledContainer}>
          <Text style={styles.disabledIcon}>📝</Text>
          <Text style={styles.disabledTitle}>Complete Your Story First</Text>
          <Text style={styles.disabledMessage}>
            Finish all {maxRounds} rounds to unlock image generation.
          </Text>
          <Text style={styles.disabledProgress}>
            Progress: Round {currentRound}/{maxRounds}
          </Text>
          <Text style={styles.disabledHint}>
            💡 Keep writing to reach round {maxRounds}!
          </Text>
        </View>
      );
    }

    // ... existing disabled state logic for XP insufficiency ...
  };

  return (
    <View style={styles.container}>
      {renderXPBalanceDisplay()}
      {renderGenerationButton()}
      {renderLoadingProgress()}
      {renderDisabledState()}
      {renderEnhancedErrorDisplay()}
    </View>
  );
};
```

#### Update `src/components/common/StoryImageDisplay.tsx`
```typescript
interface StoryImageDisplayProps {
  replicateUrl?: string; // Replicate URL (temporary)
  supabaseUrl?: string; // Supabase Storage URL (permanent)
  uploadStatus?: 'pending' | 'uploaded' | 'failed';
  sessionId: string;
  userId: string;
  onRetryUpload?: () => void;
}

const StoryImageDisplay: React.FC<StoryImageDisplayProps> = ({
  replicateUrl,
  supabaseUrl,
  uploadStatus,
  sessionId,
  userId,
  onRetryUpload,
}) => {
  // Display priority: Supabase URL (permanent) > Replicate URL (fallback)
  const [displayUrl, setDisplayUrl] = useState<string | null>(supabaseUrl || replicateUrl || null);
  const [imageLoadError, setImageLoadError] = useState(false);

  // Handle image load error with fallback
  const handleImageError = () => {
    console.error('Failed to load image from:', displayUrl);

    if (displayUrl === supabaseUrl && replicateUrl) {
      // Fall back to Replicate URL
      console.log('Falling back to Replicate URL...');
      setDisplayUrl(replicateUrl);
      setImageLoadError(false); // Reset error state
    } else {
      setImageLoadError(true);
    }
  };

  // Render upload status badge
  const renderUploadStatusBadge = () => {
    if (!uploadStatus || uploadStatus === 'uploaded') return null;

    return (
      <View style={styles.uploadStatusBadge}>
        {uploadStatus === 'pending' && (
          <View style={styles.statusPending}>
            <ActivityIndicator size="small" color="#6f42c1" />
            <Text style={styles.statusText}>🔄 Backing up to permanent storage...</Text>
          </View>
        )}
        {uploadStatus === 'failed' && (
          <View style={styles.statusFailed}>
            <Text style={styles.statusText}>⚠️ Backup failed (image still available)</Text>
            <TouchableOpacity style={styles.retryButton} onPress={onRetryUpload}>
              <Text style={styles.retryButtonText}>Retry Backup</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (!displayUrl) {
    return (
      <View style={styles.placeholderContainer}>
        <Text style={styles.placeholderText}>No image generated yet</Text>
      </View>
    );
  }

  if (imageLoadError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorMessage}>Failed to load image</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => setImageLoadError(false)}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderUploadStatusBadge()}
      <Image
        source={{ uri: displayUrl }}
        style={styles.image}
        onError={handleImageError}
        resizeMode="contain"
      />
      <View style={styles.imageSourceInfo}>
        <Text style={styles.imageSourceText}>
          {displayUrl === supabaseUrl ? '✅ Permanently saved' : '⏳ Temporary (backup in progress)'}
        </Text>
      </View>
    </View>
  );
};
```

#### Update `src/screens/HomeScreen.tsx`
```typescript
const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  // ... existing code ...

  // Pass completion state to ImageGeneration component
  const renderImageGenerationSection = () => {
    if (!showImageGeneration || !currentSession) return null;

    return (
      <ImageGeneration
        storyContent={currentSession.story_content || ''}
        sessionId={currentSession.id}
        gradeLevel={gradeLevel}
        wordCount={currentSession.words_written}
        onImageGenerated={handleImageGenerated}
        onError={handleImageGenerationError}
        disabled={!isGameCompleted}
        isStoryCompleted={isGameCompleted} // NEW
        currentRound={currentRound} // NEW
        maxRounds={MAX_ROUNDS} // NEW
      />
    );
  };

  // Handle retry upload from UI
  const handleRetryImageUpload = async () => {
    if (!currentSession || !effectiveUserId) return;

    try {
      console.log('🔄 Retrying Supabase image upload...');
      const result = await imageStorageService.retryFailedUpload(
        currentSession.id,
        effectiveUserId
      );

      if (result.success) {
        Alert.alert('✅ Success', 'Image backup completed successfully!');
        // Refresh session to get updated upload status
        const updatedSession = await storySessionManager.getSession(currentSession.id);
        setCurrentSession(updatedSession);
      } else {
        Alert.alert('❌ Retry Failed', result.error || 'Upload failed. Please try again later.');
      }
    } catch (error: any) {
      console.error('Retry upload error:', error);
      Alert.alert('❌ Error', error.message || 'An unexpected error occurred');
    }
  };

  // Display story image with fallback and upload status
  const renderStoryImage = () => {
    if (!currentSession?.generated_image_url && !currentSession?.supabase_image_url) {
      return null;
    }

    return (
      <StoryImageDisplay
        replicateUrl={currentSession.generated_image_url}
        supabaseUrl={currentSession.supabase_image_url}
        uploadStatus={currentSession.image_upload_status}
        sessionId={currentSession.id}
        userId={effectiveUserId || ''}
        onRetryUpload={handleRetryImageUpload}
      />
    );
  };

  return (
    <View style={styles.container}>
      {/* ... existing UI ... */}
      {renderImageGenerationSection()}
      {renderStoryImage()}
    </View>
  );
};
```

---

## 6. User Experience Flow

### 6.1 Story Writing → Completion Flow
1. User starts a new story (Round 1/5)
2. User writes their contribution
3. AI responds with continuation
4. **Round counter increments to 2/5** (shown in UI)
5. Steps 2-4 repeat for rounds 2, 3, 4
6. After round 5 AI response:
   - **`current_round` = 5**
   - **`completed_at` = now()**
   - **`isCompleted` = true**
   - UI shows "🎉 Story Complete!" message
   - Image generation section becomes enabled
7. User sees completion badge and XP earned notification

### 6.2 Image Generation Flow (Post-Completion)
1. User completes story (5 rounds)
2. Image generation section becomes enabled
3. User sees their XP balance and generation cost (1000 XP)
4. User taps "🎨 Generate Story Image" button
5. System checks:
   - ✅ Story is completed (`isCompleted === true`)
   - ✅ User has sufficient XP (>= 1000)
6. XP is deducted (1000 XP)
7. Replicate API generates image (~30-45 seconds)
8. **Image appears immediately** via Replicate URL
9. **Background:** Supabase upload starts (non-blocking)
   - Status badge shows "🔄 Backing up to permanent storage..."
10. **If Supabase upload succeeds:**
    - Status badge updates to "✅ Permanently saved"
    - Supabase URL is now primary display URL
11. **If Supabase upload fails:**
    - Status badge shows "⚠️ Backup failed (image still available)"
    - User can tap "Retry Backup" button
    - Image remains visible via Replicate URL

### 6.3 Image Display with Fallback
1. User opens completed story with generated image
2. System attempts to load Supabase URL first (permanent)
3. **If Supabase URL loads:** Image displays with "✅ Permanently saved" badge
4. **If Supabase URL fails:**
   - System automatically falls back to Replicate URL
   - Image displays with "⏳ Temporary (backup in progress)" message
5. **If both URLs fail:**
   - Show error state with "⚠️ Failed to load image" message
   - Provide "Retry" button to attempt reload

### 6.4 Error Scenarios & Recovery

#### Scenario A: Insufficient XP
- **Trigger:** User has < 1000 XP
- **UI:** Button disabled, message shows "Need {shortfall} more XP to generate an image"
- **Recovery:** User completes more stories to earn XP

#### Scenario B: Story Not Completed
- **Trigger:** User tries to generate image before round 5
- **UI:** Button disabled, message shows "Complete Your Story First - Progress: Round {current}/{max}"
- **Recovery:** User continues writing until round 5

#### Scenario C: Replicate Generation Fails
- **Trigger:** Replicate API error (timeout, rate limit, etc.)
- **Actions:**
  1. Full XP refund (1000 XP)
  2. Error alert shown to user
  3. Image generation event marked as 'failed' in database
- **Recovery:** User can retry image generation

#### Scenario D: Supabase Upload Fails (Replicate Succeeds)
- **Trigger:** Network error, storage quota exceeded, etc.
- **Actions:**
  1. **NO XP refund** (user already has image via Replicate)
  2. Retry automatically (up to 3 attempts with backoff)
  3. If all retries fail: status = 'failed', error logged
  4. User sees warning badge but image is still visible
- **Recovery:** User can manually retry upload via "Retry Backup" button

#### Scenario E: Both URLs Fail to Load
- **Trigger:** Network issues, expired URLs, corrupted data
- **Actions:**
  1. Show error state with placeholder
  2. Provide "Retry" button to reload image
  3. Log error for monitoring
- **Recovery:** User can retry or contact support if image is permanently lost

---

## 7. Testing Requirements

### 7.1 Unit Tests

#### Story Completion Tracking
- **Test:** `current_round` increments correctly after each AI response
- **Test:** `completed_at` is set when `current_round` reaches MAX_ROUNDS (5)
- **Test:** `isCompleted` flag is true after completion
- **Test:** Existing sessions without `current_round` default to 1
- **Test:** Sessions with 5+ `sentences_completed` are auto-completed during migration

#### Image Upload Service
- **Test:** `uploadImageToSupabase()` successfully uploads image from URL
- **Test:** Retry logic attempts up to 3 times with exponential backoff
- **Test:** Upload fails gracefully when Replicate URL is invalid
- **Test:** Upload fails gracefully when Supabase Storage is unavailable
- **Test:** File path generation creates valid paths in format `{userId}/session_{sessionId}/image_{timestamp}.png`
- **Test:** Image size validation rejects files > 10MB
- **Test:** MIME type validation only allows `image/png`, `image/jpeg`, `image/webp`

#### XP Management
- **Test:** XP is deducted only when story is completed AND user has sufficient balance
- **Test:** XP is refunded if Replicate generation fails
- **Test:** XP is NOT refunded if Supabase upload fails (Replicate succeeded)
- **Test:** XP refund is idempotent (no double refunds)
- **Test:** Image generation event status is updated correctly for all scenarios

### 7.2 Integration Tests

#### Story Completion Flow
- **Test:** Complete story from round 1 to round 5, verify `completed_at` is set
- **Test:** Resume incomplete story, continue to completion, verify data persistence
- **Test:** Multiple users complete stories concurrently without data conflicts

#### Image Generation Flow
- **Test:** Generate image for completed story, verify Replicate URL is saved immediately
- **Test:** Verify Supabase upload happens asynchronously after Replicate success
- **Test:** Verify both `generated_image_url` and `supabase_image_url` are populated
- **Test:** Verify upload status transitions: pending → uploaded/failed

#### Image Display Flow
- **Test:** Display image using Supabase URL when available
- **Test:** Fallback to Replicate URL if Supabase URL fails to load
- **Test:** Show placeholder if both URLs are unavailable
- **Test:** Retry upload button triggers new upload attempt and updates status

### 7.3 End-to-End Tests

#### Complete User Journey
1. **Test:** User creates new story → writes 5 rounds → story marked complete → generates image → views image
2. **Test:** User completes story → insufficient XP → earns XP → generates image
3. **Test:** User generates image → Supabase upload fails → user sees warning → retry succeeds → permanent URL displayed
4. **Test:** User generates image → both uploads fail → XP refunded → user retries successfully

#### Edge Cases
- **Test:** User force-quits app during image generation → XP refunded, state recovered
- **Test:** User goes offline during Supabase upload → upload retries when online
- **Test:** User deletes session before Supabase upload completes → upload cancelled gracefully
- **Test:** Concurrent image generations for same session → no duplicate uploads or XP deductions

### 7.4 Performance Tests

- **Test:** Image upload completes within 10 seconds for 5MB image under normal network conditions
- **Test:** Database queries for completion tracking add < 50ms overhead per story update
- **Test:** 100 concurrent Supabase uploads complete without timeout errors
- **Test:** Local state updates (currentRound) complete in < 16ms for smooth UI

### 7.5 Security Tests

- **Test:** User cannot upload image to another user's folder (RLS policy enforcement)
- **Test:** User cannot access images uploaded by other users
- **Test:** Malicious file upload (executable disguised as image) is rejected
- **Test:** SQL injection attempts in sessionId/userId fail gracefully
- **Test:** Expired or invalid Supabase auth tokens prevent image upload

---

## 8. Success Criteria

### 8.1 Functional Success
- ✅ 100% of stories that reach round 5 have `completed_at` timestamp set correctly
- ✅ Image generation is disabled until story completion (round >= 5)
- ✅ All generated images have both Replicate URL and Supabase Storage URL saved
- ✅ Image display prioritizes Supabase URL and falls back to Replicate URL seamlessly
- ✅ XP deduction/refund logic works correctly in all scenarios (no double deductions/refunds)
- ✅ Upload retry mechanism successfully recovers from transient failures (95%+ success after 3 retries)

### 8.2 Data Quality
- ✅ Zero data loss during migration (all existing stories preserved)
- ✅ `current_round` field accurately reflects story progress for all sessions
- ✅ Image upload status correctly tracks: pending, uploaded, or failed
- ✅ Database constraints prevent invalid states (e.g., current_round > 5)

### 8.3 User Experience
- ✅ Users can see their story progress (Round X/5) clearly in the UI
- ✅ Users are informed when their story is complete and ready for image generation
- ✅ Users see their generated image immediately (no blocking on Supabase upload)
- ✅ Users understand when image backup is in progress or failed (via status badges)
- ✅ Users can retry failed uploads with a single tap

### 8.4 Performance
- ✅ Image display loads within 2 seconds under normal network conditions
- ✅ Supabase upload completes within 10 seconds for typical images (2-5MB)
- ✅ Story completion tracking adds negligible latency (< 50ms) to story updates
- ✅ UI remains responsive during background image upload

### 8.5 Backward Compatibility
- ✅ All existing stories function correctly after migration
- ✅ Existing images without Supabase URLs display correctly via Replicate URLs
- ✅ No breaking changes to existing API contracts
- ✅ All tests pass after implementation

---

## 9. Dependencies & Risks

### 9.1 Technical Dependencies
- **Supabase Storage**: Requires storage bucket configured with proper RLS policies
- **Database Migration**: Schema changes must be applied to production database
- **Replicate API**: Image generation depends on Replicate service availability
- **Network Connectivity**: Image uploads require stable internet connection

### 9.2 Identified Risks

#### Risk 1: Migration Complexity
- **Description**: Auto-completing existing stories may introduce data inconsistencies
- **Probability**: Medium
- **Impact**: Medium
- **Mitigation**:
  - Run migration in staging environment first
  - Create database backup before migration
  - Implement rollback script for emergency recovery
  - Manual QA of migrated data before production deployment

#### Risk 2: Supabase Storage Quota
- **Description**: Large volume of image uploads could exceed storage quota
- **Probability**: Low (if user base grows rapidly)
- **Impact**: High (blocks all new uploads)
- **Mitigation**:
  - Monitor storage usage via Supabase dashboard
  - Set up alerts for 80% storage quota
  - Implement image compression before upload
  - Plan for storage tier upgrade

#### Risk 3: Image Upload Failures
- **Description**: Network issues or Supabase outages could cause high failure rates
- **Probability**: Medium
- **Impact**: Medium (users still have Replicate URLs)
- **Mitigation**:
  - Implement automatic retry with exponential backoff
  - Queue failed uploads for background retry
  - Monitor upload success rate metrics
  - Provide manual retry button for users

#### Risk 4: XP Refund Race Conditions
- **Description**: Concurrent image generation attempts could cause double XP deductions or refunds
- **Probability**: Low
- **Impact**: High (user trust, data integrity)
- **Mitigation**:
  - Use database transactions for XP operations
  - Implement idempotency keys for refunds
  - Add UI debouncing to prevent double taps
  - Monitor XP event logs for anomalies

#### Risk 5: Backward Compatibility Issues
- **Description**: Schema changes could break existing code or user data
- **Probability**: Low (with proper testing)
- **Impact**: Critical (app breakage)
- **Mitigation**:
  - Use additive-only schema changes (no breaking removals)
  - Comprehensive regression testing
  - Gradual rollout with feature flags
  - Rollback plan prepared before deployment

---

## 10. Implementation Plan

### Phase 1: Database & Infrastructure Setup (Week 1)
- [ ] Create database migration script for `current_round`, `supabase_image_url`, and upload status fields
- [ ] Apply migration to staging database and verify
- [ ] Create Supabase Storage bucket `story-images` with RLS policies
- [ ] Update TypeScript types in `src/types/database.ts`
- [ ] Test RLS policies with various user scenarios
- [ ] **Deliverable:** Database schema updated, storage bucket configured and tested

### Phase 2: Image Storage Service (Week 1-2)
- [ ] Implement `imageStorageService.ts` with upload, retry, and error handling logic
- [ ] Add unit tests for upload service (success, failure, retry scenarios)
- [ ] Integrate with `imageGenerationService.ts` for async Supabase upload
- [ ] Add logging and monitoring for upload operations
- [ ] Test upload service in staging environment with real images
- [ ] **Deliverable:** Image storage service fully implemented and tested

### Phase 3: Story Completion Tracking & Offline Caching (Week 2)
- [ ] Update `storySessionManager.ts` to track and persist `current_round`
- [ ] Implement auto-completion logic when `current_round >= MAX_ROUNDS`
- [ ] Update `addContribution()` method to increment round counter
- [ ] **NEW**: Update `cacheSessionLocally()` to cache `supabase_image_url` for offline viewing
- [ ] **NEW**: Add offline mode indicator in UI when displaying cached images
- [ ] Add unit tests for completion tracking logic and offline caching
- [ ] Test migration script on staging data to auto-complete old stories
- [ ] **Deliverable:** Story completion tracking and offline caching working end-to-end

### Phase 4: UI Components & Integration (Week 2-3)
- [ ] Update `ImageGeneration` component to accept completion props and disable when not complete
- [ ] Implement `StoryImageDisplay` component with fallback and status badge logic
- [ ] Update `HomeScreen` to pass completion state and render image display
- [ ] Add retry upload button and handler
- [ ] Implement progress indicator (Round X/5) in UI
- [ ] Add completion celebration message when story finishes
- [ ] **Deliverable:** UI fully integrated with backend logic

### Phase 5: XP Management & Error Handling (Week 3)
- [ ] Update XP deduction logic to check story completion before allowing image generation
- [ ] Implement correct refund logic (refund only if Replicate fails, not Supabase)
- [ ] Update `image_generation_event` tracking to include upload status
- [ ] Add comprehensive error handling for all failure scenarios
- [ ] Test XP flows: deduction, refund, edge cases, race conditions
- [ ] **Deliverable:** XP system working correctly for all scenarios

### Phase 6: Testing & QA (Week 3-4)
- [ ] Run full unit test suite and achieve 80%+ coverage
- [ ] Execute integration tests for story completion and image generation flows
- [ ] Perform end-to-end testing of complete user journeys
- [ ] Conduct performance testing (upload speed, DB query latency)
- [ ] Security testing (RLS policies, file upload validation)
- [ ] User acceptance testing with real users (beta group)
- [ ] **Deliverable:** All tests passing, bugs fixed, feature ready for production

### Phase 7: Deployment & Monitoring (Week 4)
- [ ] Deploy database migration to production (with rollback plan ready)
- [ ] Deploy code changes via standard release process
- [ ] Monitor upload success rates, completion tracking accuracy
- [ ] Set up alerts for storage quota, upload failures, XP anomalies
- [ ] Gather user feedback and monitor support tickets
- [ ] **Deliverable:** Feature live in production, monitored and stable

### Phase 8: Post-Launch Iteration (Week 5+)
- [ ] Analyze metrics: completion rate, image generation rate, upload success rate
- [ ] Address any bugs or edge cases discovered in production
- [ ] Optimize performance based on real-world usage patterns
- [ ] Consider enhancements: bulk retry, image compression, CDN integration
- [ ] Update documentation with lessons learned
- [ ] **Deliverable:** Feature refined and optimized based on production data

---

## 11. Open Questions & Answers

### Answered Questions

1. **Storage Costs**: What is the budget for Supabase Storage? Should we implement image compression to reduce costs?
   - **Answer**: No image compression needed. Will upgrade Supabase storage tier if needed.
   - **Impact**: Simplifies implementation - no compression logic needed in `imageStorageService`
   - **Action**: Monitor storage usage and plan for tier upgrade as user base grows

2. **Retry Strategy**: Should failed uploads be queued for automatic background retry, or only retried on user request?
   - **Answer**: Only retried on user request via manual retry button
   - **Impact**: Simpler implementation - no background queue system needed
   - **Action**: Ensure retry button is prominently displayed when upload status is 'failed'

3. **Analytics**: What specific metrics should we track for story completion and image uploads?
   - **Answer**: Track number of words, XP points, completed challenges, and image linked to the story
   - **Impact**: These metrics are already captured in `game_sessions` table
   - **Action**: Ensure analytics queries join `game_sessions` with image fields for complete reporting

4. **Content Moderation**: Should generated images be scanned for inappropriate content before permanent storage?
   - **Answer**: Not applicable (N/A)
   - **Impact**: No content moderation logic needed
   - **Action**: None - rely on Replicate's built-in content safety mechanisms

5. **Multi-Device Sync**: How do we handle a user completing a story on one device and viewing it on another?
   - **Answer**: User would need to import the story and the image from the database
   - **Impact**: Story and image data already synced via Supabase database - works automatically
   - **Action**: Ensure `getSession()` properly fetches both `generated_image_url` and `supabase_image_url` from database

6. **Offline Support**: Should we cache Supabase URLs locally for offline viewing?
   - **Answer**: Yes
   - **Impact**: Add local caching logic for Supabase URLs in `storySessionManager`
   - **Action**: Update `cacheSessionLocally()` to persist `supabase_image_url` field in AsyncStorage

### Remaining Open Questions

1. **Image Expiration**: Do Replicate URLs expire? If so, what is the TTL, and do we need faster Supabase uploads?
   - **Status**: Unknown - requires investigation
   - **Risk**: If Replicate URLs expire quickly, users may lose access to images before Supabase upload completes
   - **Mitigation**: Assume URLs may expire and prioritize Supabase upload completion within reasonable timeframe (~60 seconds)
   - **Action Item**: Research Replicate URL expiration policy and document findings

---

## 12. Glossary

- **Replicate URL**: Temporary image URL generated by Replicate API (may expire after some time)
- **Supabase Storage URL**: Permanent image URL stored in Supabase Storage bucket
- **Story Completion**: When a story reaches `current_round >= MAX_ROUNDS` (5 rounds)
- **Round**: One full cycle of user contribution + AI response
- **XP (Experience Points)**: In-game currency used to unlock features like image generation
- **RLS (Row Level Security)**: Supabase security feature that restricts database access at the row level
- **Idempotency**: Property ensuring an operation produces the same result even if executed multiple times
- **Exponential Backoff**: Retry strategy where delay between retries increases exponentially

---

## 13. Appendix

### A. Database Schema Reference

#### `game_sessions` Table (Updated)
```sql
CREATE TABLE game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ, -- Set when current_round >= MAX_ROUNDS

  -- Story tracking
  current_round INTEGER NOT NULL DEFAULT 1 CHECK (current_round >= 1 AND current_round <= 5),
  grade_level TEXT NOT NULL,
  story_content TEXT,
  words_written INTEGER NOT NULL DEFAULT 0,
  sentences_completed INTEGER NOT NULL DEFAULT 0,

  -- Image fields
  generated_image_url TEXT, -- Replicate URL (temporary)
  supabase_image_url TEXT, -- Supabase Storage URL (permanent)
  image_upload_status TEXT CHECK (image_upload_status IN ('pending', 'uploaded', 'failed')),
  image_upload_attempts INTEGER NOT NULL DEFAULT 0,
  image_upload_error TEXT,
  image_generation_timestamp TIMESTAMPTZ,
  image_generation_cost INTEGER,

  -- Other fields...
  final_score INTEGER NOT NULL DEFAULT 0,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  challenges_completed INTEGER NOT NULL DEFAULT 0,
  story_source TEXT NOT NULL DEFAULT 'New',
  story_metadata JSONB NOT NULL DEFAULT '{}'
);

-- Indexes
CREATE INDEX idx_game_sessions_completed_at ON game_sessions(completed_at) WHERE completed_at IS NOT NULL;
CREATE INDEX idx_game_sessions_upload_status ON game_sessions(image_upload_status) WHERE image_upload_status IS NOT NULL;
CREATE INDEX idx_game_sessions_user_id ON game_sessions(user_id);
```

### B. API Contracts

#### `imageStorageService.uploadImageToSupabase()`
```typescript
/**
 * Upload image to Supabase Storage with retry logic
 * @param replicateUrl - URL of image from Replicate API
 * @param sessionId - Game session ID (UUID)
 * @param userId - User ID (Supabase UUID)
 * @returns Promise<UploadImageResult>
 */
interface UploadImageResult {
  success: boolean;
  supabaseUrl?: string; // Public URL if upload succeeded
  error?: string; // Error message if upload failed
  attempts: number; // Number of upload attempts made
}
```

#### `storySessionManager.completeSession()`
```typescript
/**
 * Mark session as complete and update completion timestamp
 * @param sessionId - Game session ID (UUID)
 * @returns Promise<StorySession | null>
 */
async completeSession(sessionId: string): Promise<StorySession | null>;
```

### C. Migration Rollback Script

```sql
-- Rollback migration if needed (EMERGENCY ONLY)

-- Remove new columns (WARNING: This will delete Supabase URLs and upload status data)
ALTER TABLE game_sessions
  DROP COLUMN IF EXISTS current_round,
  DROP COLUMN IF EXISTS supabase_image_url,
  DROP COLUMN IF EXISTS image_upload_status,
  DROP COLUMN IF EXISTS image_upload_attempts,
  DROP COLUMN IF EXISTS image_upload_error;

-- Drop indexes
DROP INDEX IF EXISTS idx_game_sessions_completed_at;
DROP INDEX IF EXISTS idx_game_sessions_upload_status;

-- Note: This rollback will cause data loss for any stories completed after migration
-- and any Supabase image backups. Use only in emergency situations.
```

### D. Feature Flags (Optional)

```typescript
// src/config/featureFlags.ts
export const FEATURE_FLAGS = {
  STORY_COMPLETION_TRACKING: true, // Enable round-based completion
  SUPABASE_IMAGE_BACKUP: true, // Enable Supabase Storage uploads
  OFFLINE_IMAGE_CACHING: true, // Enable offline caching of Supabase URLs
  MANUAL_RETRY_ONLY: true, // Disable automatic background retry (user must manually retry)
};
```

---

**Document Version:** 1.0
**Last Updated:** 2026-01-06
**Author:** Claude Code (AI Product Architect)
**Status:** Ready for Review & Implementation
**Estimated Effort:** 4 weeks (1 developer)
