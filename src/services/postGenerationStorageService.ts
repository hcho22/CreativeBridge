// Post-Generation Storage Service for CreativeBridge
// Handles asynchronous extraction and storage of story elements after story generation completes
// Part of US-010: Implement post-generation element extraction and storage
// Part of US-012: Store diversity scores with story metadata

import { supabase } from './supabase';

/**
 * Checks if an ID is a valid UUID format (Supabase format).
 * Convex uses a different ID format (alphanumeric strings like 'j978rdkax3fcmqc4tf283zvv5x81f9bh')
 * which will fail Supabase UUID validation.
 *
 * @param id - The ID to check
 * @returns true if the ID is a valid UUID, false otherwise
 */
function isValidUUID(id: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}
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

    // Determine storage backend based on ID format
    const isConvexFormat = !isValidUUID(sessionId) || !isValidUUID(storyId);
    if (isConvexFormat) {
      console.log(
        '📦 Convex-format IDs detected, proceeding with extraction (storage via Convex):',
        {
          sessionId: sessionId.substring(0, 12),
          storyId: storyId.substring(0, 12),
        },
      );
    }

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
        // Skip if name is empty or whitespace-only (fails DB constraint)
        const elementText = char.name?.trim();
        if (elementText && elementText.length > 0) {
          elementRecords.push({
            story_id: storyId,
            session_id: sessionId,
            element_type: 'character',
            element_text: elementText,
            embedding_vector: null, // Will be populated below
          });
        } else {
          console.warn('⚠️ Skipping character with empty name:', char);
        }
      }

      // Settings
      for (const setting of extracted.settings) {
        // Skip if location is empty or whitespace-only (fails DB constraint)
        const elementText = setting.location?.trim();
        if (elementText && elementText.length > 0) {
          elementRecords.push({
            story_id: storyId,
            session_id: sessionId,
            element_type: 'setting',
            element_text: elementText,
            embedding_vector: null,
          });
        } else {
          console.warn('⚠️ Skipping setting with empty location:', setting);
        }
      }

      // Objects
      for (const obj of extracted.objects) {
        // Skip if name is empty or whitespace-only (fails DB constraint)
        const elementText = obj.name?.trim();
        if (elementText && elementText.length > 0) {
          elementRecords.push({
            story_id: storyId,
            session_id: sessionId,
            element_type: 'object',
            element_text: elementText,
            embedding_vector: null,
          });
        } else {
          console.warn('⚠️ Skipping object with empty name:', obj);
        }
      }

      // Plot patterns
      for (const pattern of extracted.plot_patterns) {
        // Skip if action is empty or whitespace-only (fails DB constraint)
        const elementText = pattern.action?.trim();
        if (elementText && elementText.length > 0) {
          elementRecords.push({
            story_id: storyId,
            session_id: sessionId,
            element_type: 'plot_pattern',
            element_text: elementText,
            embedding_vector: null,
          });
        } else {
          console.warn('⚠️ Skipping plot pattern with empty action:', pattern);
        }
      }

      console.log(`📋 Prepared ${elementRecords.length} element records`);

      // Step 3: Generate embeddings for each element (if not skipped)
      if (!skipEmbeddings && elementRecords.length > 0) {
        console.log('🧮 Generating embeddings for elements...');

        try {
          // Extract all element texts for batch embedding generation
          // Filter out any empty strings to prevent OpenAI API errors
          const elementTexts = elementRecords.map(
            record => record.element_text,
          );

          // Validate that all texts are non-empty (defensive check)
          const invalidTexts = elementTexts.filter(
            text => !text || text.trim().length === 0,
          );
          if (invalidTexts.length > 0) {
            throw new Error(
              `Found ${invalidTexts.length} empty element texts - this should not happen after filtering`,
            );
          }

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

        if (isConvexFormat) {
          // Convex-format IDs: elements were extracted and processed.
          // Storage goes through Convex storyElements table (via mutations in components).
          // TODO: Add a Convex mutation for batch inserting story elements from services.
          elementsStored = elementRecords.length;
          console.log(
            `✅ Extracted ${elementsStored} elements for Convex storage`,
          );
          recentElementsService.invalidateCache(sessionId);
        } else {
          // Legacy UUID-format IDs: store via Supabase
          try {
            const { error: insertError, count } = await supabase
              .from('story_elements')
              .insert(elementRecords as any);

            if (insertError) {
              console.error('❌ Supabase insert error details:', {
                message: insertError.message,
                details: insertError.details,
                hint: insertError.hint,
                code: insertError.code,
                fullError: insertError,
              });
              throw new Error(
                `Database insert failed: ${
                  insertError.message ||
                  insertError.details ||
                  JSON.stringify(insertError)
                }`,
              );
            }

            elementsStored = count || elementRecords.length;
            console.log(`✅ Successfully stored ${elementsStored} elements`);
            recentElementsService.invalidateCache(sessionId);
          } catch (dbError) {
            const errorMsg = `Database storage failed: ${
              dbError instanceof Error ? dbError.message : String(dbError)
            }`;
            console.error(`❌ ${errorMsg}`);
            errors.push(errorMsg);
          }
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
              extractedElements: elementRecords, // Pass element records WITH embeddings
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
          } else if (scoreResult.success) {
            // Skipped (e.g. Convex IDs with no Supabase backend) — not a failure
            console.log(
              'ℹ️ Diversity score storage skipped (no legacy backend)',
            );
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
    // For Convex-format session IDs, stats would come from Convex storyElements table
    // TODO: Add a Convex query for session element stats
    if (!isValidUUID(sessionId)) {
      console.log(
        '📦 Convex session ID — element stats require Convex query (pending implementation):',
        { sessionId: sessionId.substring(0, 12) },
      );
      return {
        total: 0,
        byType: { character: 0, setting: 0, object: 0, plot_pattern: 0 },
        withEmbeddings: 0,
        withoutEmbeddings: 0,
      };
    }

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
