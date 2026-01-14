// Post-Generation Storage Service for CreativeBridge
// Handles asynchronous extraction and storage of story elements after story generation completes
// Part of US-010: Implement post-generation element extraction and storage
// Part of US-012: Store diversity scores with story metadata

import { supabase } from './supabase';
import { storyElementExtractionService } from './storyElementExtractionService';
import { embeddingGenerationService } from './embeddingGenerationService';
import { diversityScoreStorageService } from './diversityScoreStorageService';
import { recentElementsService } from './recentElementsService';
import { diversityPerformanceMonitoringService } from './diversityPerformanceMonitoringService';

/**
 * Story element ready for database insertion
 */
interface StoryElementRecord {
  story_id: string;
  session_id: string;
  element_type: 'character' | 'setting' | 'object' | 'plot_pattern';
  element_text: string;
  embedding_vector: number[] | null;
  created_at?: string;
}

/**
 * Result of extraction and storage operation
 */
export interface StorageResult {
  success: boolean;
  elementsStored: number;
  diversityScoreStored: boolean;
  errors: string[];
  duration?: number;
}

/**
 * Options for extractAndStoreElements
 */
export interface ExtractAndStoreOptions {
  storyText: string;
  storyId: string;
  sessionId: string;
  skipEmbeddings?: boolean; // For testing or low-priority scenarios
}

/**
 * Post-Generation Storage Service
 *
 * Asynchronously extracts story elements from generated stories and stores them
 * in the database with their embeddings for diversity tracking.
 *
 * This service is designed to be non-blocking - extraction and storage failures
 * should never prevent story delivery to the user.
 */
class PostGenerationStorageService {
  /**
   * Extract story elements from generated text and store in database
   *
   * This function:
   * 1. Extracts elements using LLM-based extraction service
   * 2. Generates embeddings for each element asynchronously
   * 3. Stores all elements in story_elements table
   *
   * This is designed to run asynchronously after story delivery to user.
   * Errors are logged but do not throw - failures should be graceful.
   *
   * @param options - Story text, IDs, and configuration
   * @returns Promise<StorageResult> - Summary of storage operation
   */
  async extractAndStoreElements(
    options: ExtractAndStoreOptions,
  ): Promise<StorageResult> {
    const startTime = Date.now();
    const { storyText, storyId, sessionId, skipEmbeddings = false } = options;

    console.log('📦 Starting post-generation element extraction and storage', {
      storyId,
      sessionId,
      storyLength: storyText.length,
      skipEmbeddings,
    });

    const errors: string[] = [];
    let elementsStored = 0;

    try {
      // Step 1: Extract story elements using LLM
      console.log('🔍 Extracting story elements...');
      const extracted =
        await diversityPerformanceMonitoringService.measureAsync({
          operation: 'element_extraction',
          sessionId,
          storyId,
          metadata: { storyLength: storyText.length },
          fn: async () =>
            await storyElementExtractionService.extractStoryElements(storyText),
        });

      console.log('✅ Element extraction complete', {
        characters: extracted.characters.length,
        settings: extracted.settings.length,
        objects: extracted.objects.length,
        plot_patterns: extracted.plot_patterns.length,
      });

      // Step 2: Convert extracted elements to database records
      const elementRecords: StoryElementRecord[] = [];

      // Characters
      for (const char of extracted.characters) {
        elementRecords.push({
          story_id: storyId,
          session_id: sessionId,
          element_type: 'character',
          element_text: char.name,
          embedding_vector: null, // Will be populated below
        });
      }

      // Settings
      for (const setting of extracted.settings) {
        elementRecords.push({
          story_id: storyId,
          session_id: sessionId,
          element_type: 'setting',
          element_text: setting.location,
          embedding_vector: null,
        });
      }

      // Objects
      for (const obj of extracted.objects) {
        elementRecords.push({
          story_id: storyId,
          session_id: sessionId,
          element_type: 'object',
          element_text: obj.name,
          embedding_vector: null,
        });
      }

      // Plot patterns
      for (const pattern of extracted.plot_patterns) {
        elementRecords.push({
          story_id: storyId,
          session_id: sessionId,
          element_type: 'plot_pattern',
          element_text: pattern.action,
          embedding_vector: null,
        });
      }

      console.log(`📋 Prepared ${elementRecords.length} element records`);

      // Step 3: Generate embeddings for each element (if not skipped)
      if (!skipEmbeddings && elementRecords.length > 0) {
        console.log('🧮 Generating embeddings for elements...');

        try {
          // Extract all element texts for batch embedding generation
          const elementTexts = elementRecords.map(
            record => record.element_text,
          );

          // Generate embeddings in batch (more efficient than sequential)
          const embeddings =
            await diversityPerformanceMonitoringService.measureAsync({
              operation: 'embedding_generation',
              sessionId,
              storyId,
              metadata: { elementCount: elementTexts.length },
              fn: async () =>
                await embeddingGenerationService.generateEmbeddingsBatch(
                  elementTexts,
                ),
            });

          // Assign embeddings to records
          for (let i = 0; i < elementRecords.length; i++) {
            elementRecords[i].embedding_vector = embeddings[i] || null;
          }

          console.log('✅ Embeddings generated successfully');
        } catch (embeddingError) {
          // Log error but continue - we can store elements without embeddings
          const errorMsg = `Embedding generation failed: ${
            embeddingError instanceof Error
              ? embeddingError.message
              : String(embeddingError)
          }`;
          console.warn(`⚠️ ${errorMsg}`);
          errors.push(errorMsg);
          // Elements will be stored with null embeddings
        }
      }

      // Step 4: Store elements in database
      if (elementRecords.length > 0) {
        console.log(
          `💾 Storing ${elementRecords.length} elements in database...`,
        );

        try {
          const { error: insertError, count } = await supabase
            .from('story_elements')
            .insert(elementRecords as any); // Type assertion needed - story_elements not in generated types

          if (insertError) {
            throw new Error(`Database insert failed: ${insertError.message}`);
          }

          elementsStored = count || elementRecords.length;
          console.log(`✅ Successfully stored ${elementsStored} elements`);

          // Invalidate cache for this session (US-013)
          // New elements were just added, so cached recent elements are now stale
          recentElementsService.invalidateCache(sessionId);
        } catch (dbError) {
          const errorMsg = `Database storage failed: ${
            dbError instanceof Error ? dbError.message : String(dbError)
          }`;
          console.error(`❌ ${errorMsg}`);
          errors.push(errorMsg);
        }
      } else {
        console.log('ℹ️ No elements extracted from story - nothing to store');
      }

      // Step 5: Calculate and store diversity score (US-012)
      // This runs asynchronously after element storage
      let diversityScoreStored = false;
      if (elementsStored > 0) {
        console.log('📊 Storing diversity score...');
        try {
          const scoreResult =
            await diversityScoreStorageService.storeDiversityScore({
              storyId,
              sessionId,
              extractedElements: extracted,
            });

          diversityScoreStored = scoreResult.success;

          if (scoreResult.success && scoreResult.score) {
            console.log(
              `✅ Diversity score stored: ${scoreResult.score.toFixed(3)}`,
            );

            // Log diversity metrics for monitoring (US-014)
            diversityPerformanceMonitoringService.logDiversityMetrics({
              sessionId,
              storyId,
              diversityScore: scoreResult.score,
              novelElementCount: scoreResult.novelElementCount || 0,
              totalElementCount: scoreResult.totalElementCount || 0,
              avoidedElementsCount: 0, // Will be calculated from guidance in future
              timestamp: new Date(),
            });
          } else {
            const errorMsg = `Diversity score storage failed: ${scoreResult.errors.join(
              ', ',
            )}`;
            console.warn(`⚠️ ${errorMsg}`);
            errors.push(errorMsg);
          }
        } catch (scoreError) {
          // Log error but don't fail the entire operation
          const errorMsg = `Diversity score storage error: ${
            scoreError instanceof Error
              ? scoreError.message
              : String(scoreError)
          }`;
          console.warn(`⚠️ ${errorMsg}`);
          errors.push(errorMsg);
        }
      } else {
        console.log('ℹ️ Skipping diversity score (no elements stored)');
      }

      const duration = Date.now() - startTime;
      console.log(`✨ Post-generation storage complete in ${duration}ms`, {
        elementsStored,
        diversityScoreStored,
        errorCount: errors.length,
      });

      return {
        success: elementsStored > 0 || errors.length === 0,
        elementsStored,
        diversityScoreStored,
        errors,
        duration,
      };
    } catch (error) {
      // Catch-all for any unexpected errors
      const errorMsg = `Unexpected error in extractAndStoreElements: ${
        error instanceof Error ? error.message : String(error)
      }`;
      console.error(`❌ ${errorMsg}`);
      errors.push(errorMsg);

      const duration = Date.now() - startTime;
      return {
        success: false,
        elementsStored,
        diversityScoreStored: false,
        errors,
        duration,
      };
    }
  }

  /**
   * Extract and store elements asynchronously (fire-and-forget)
   *
   * This is a convenience wrapper that calls extractAndStoreElements without
   * awaiting the result. Use this when you want to trigger storage but don't
   * need to wait for completion (e.g., after story delivery to user).
   *
   * Errors are logged internally but not propagated.
   *
   * @param options - Story text, IDs, and configuration
   */
  extractAndStoreElementsAsync(options: ExtractAndStoreOptions): void {
    // Fire and forget - don't await the result
    this.extractAndStoreElements(options).catch(error => {
      console.error('❌ Async element storage failed:', error);
    });
  }

  /**
   * Get statistics about stored elements for a session
   *
   * Useful for debugging and monitoring the diversity tracking system.
   *
   * @param sessionId - Session to query
   * @returns Promise with element counts by type
   */
  async getSessionElementStats(sessionId: string): Promise<{
    total: number;
    byType: Record<string, number>;
    withEmbeddings: number;
    withoutEmbeddings: number;
  }> {
    try {
      const { data, error } = await supabase
        .from('story_elements')
        .select('element_type, embedding_vector')
        .eq('session_id', sessionId);

      if (error) {
        throw new Error(`Failed to fetch session stats: ${error.message}`);
      }

      const elements = (data || []) as Array<{
        element_type: string;
        embedding_vector: any;
      }>;
      const byType: Record<string, number> = {
        character: 0,
        setting: 0,
        object: 0,
        plot_pattern: 0,
      };

      let withEmbeddings = 0;
      let withoutEmbeddings = 0;

      for (const element of elements) {
        byType[element.element_type] = (byType[element.element_type] || 0) + 1;

        if (element.embedding_vector) {
          withEmbeddings++;
        } else {
          withoutEmbeddings++;
        }
      }

      return {
        total: elements.length,
        byType,
        withEmbeddings,
        withoutEmbeddings,
      };
    } catch (error) {
      console.error('❌ Failed to get session element stats:', error);
      return {
        total: 0,
        byType: {},
        withEmbeddings: 0,
        withoutEmbeddings: 0,
      };
    }
  }
}

// Export singleton instance
export const postGenerationStorageService = new PostGenerationStorageService();
export default PostGenerationStorageService;
