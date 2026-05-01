/**
 * Diversity Score Storage Service
 *
 * Handles persistence of diversity scores after calculation.
 * Designed to run asynchronously after story delivery to avoid blocking UX.
 *
 * Part of US-012: Store diversity scores with story metadata
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabase';

// Boundary cast: project Database type doesn't satisfy postgrest's GenericSchema
// for diversity-score tables. Same pattern as feedbackCollectionService.ts.
const sb = supabase as unknown as SupabaseClient;

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
import { diversityScoreService } from './diversityScoreService';
import { recentElementsService } from './recentElementsService';
import type { DiversityScore } from './diversityScoreService';
import type { StoryElements } from './storyElementExtractionService';

/**
 * Diversity score record for database insertion
 */
interface DiversityScoreRecord {
  story_id: string;
  diversity_score: number;
  novel_element_count: number;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

/**
 * Result of score storage operation
 */
export interface ScoreStorageResult {
  success: boolean;
  score?: number;
  novelElementCount?: number;
  totalElementCount?: number;
  errors: string[];
  duration?: number;
}

/**
 * Story element record with embedding (from database)
 */
interface StoryElementRecord {
  story_id: string;
  session_id: string;
  element_type: 'character' | 'setting' | 'object' | 'plot_pattern';
  element_text: string;
  embedding_vector: number[] | null;
}

/**
 * Options for storing diversity score
 */
export interface StoreDiversityScoreOptions {
  storyId: string;
  sessionId: string;
  extractedElements: StoryElements | StoryElementRecord[];
}

/**
 * Diversity Score Storage Service
 *
 * Asynchronously calculates and stores diversity scores for generated stories.
 * Includes monitoring for low diversity scores with warning logs.
 */
class DiversityScoreStorageService {
  /**
   * Low diversity score threshold for warning logs
   * Matches US-012 requirement: scores < 0.4 trigger warnings
   */
  private readonly LOW_DIVERSITY_THRESHOLD = 0.4;

  /**
   * Calculate and store diversity score for a story
   *
   * Workflow:
   * 1. Fetch recent elements for the user's session
   * 2. Calculate diversity score using diversityScoreService
   * 3. Store score in story_diversity_scores table
   * 4. Log warning if score is below threshold
   *
   * @param options - Story and session context with extracted elements
   * @returns Result indicating success/failure and score
   */
  async storeDiversityScore(
    options: StoreDiversityScoreOptions,
  ): Promise<ScoreStorageResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const { storyId, sessionId, extractedElements } = options;

    // Skip Supabase storage for Convex IDs (non-UUID format)
    // During migration, Convex sessions won't have Supabase history anyway
    if (!isValidUUID(storyId) || !isValidUUID(sessionId)) {
      console.log(
        '⚠️ Convex IDs detected, skipping Supabase diversity score storage:',
        {
          storyId: storyId.substring(0, 12),
          sessionId: sessionId.substring(0, 12),
        },
      );
      return {
        success: true, // Not a failure, just skipping legacy storage
        errors: [],
        duration: Date.now() - startTime,
      };
    }

    try {
      console.log(`📊 Calculating diversity score for story ${storyId}`);

      // Step 1: Fetch recent elements for the session
      let recentElements;
      try {
        recentElements = await recentElementsService.getRecentElements({
          sessionId,
          limit: 10,
        });
      } catch (error) {
        const message = `Failed to fetch recent elements: ${
          error instanceof Error ? error.message : String(error)
        }`;
        console.error(`❌ ${message}`);
        errors.push(message);
        return {
          success: false,
          errors,
          duration: Date.now() - startTime,
        };
      }

      // Step 2: Convert extracted elements to scoring format
      let newElements;
      if (Array.isArray(extractedElements)) {
        // Already in StoryElementRecord[] format with embeddings
        newElements = extractedElements
          .filter(
            record =>
              record.embedding_vector && record.embedding_vector.length > 0,
          )
          .map(record => ({
            elementText: record.element_text,
            elementType: record.element_type,
            elementEmbedding: record.embedding_vector!,
          }));
      } else {
        // StoryElements format - need to use conversion helper (not implemented yet)
        // For now, this path shouldn't be used since we pass elementRecords from postGenerationStorageService
        throw new Error(
          'StoryElements format not yet supported - pass StoryElementRecord[] instead',
        );
      }

      // Step 3: Calculate diversity score
      let diversityScore: DiversityScore;
      try {
        diversityScore = diversityScoreService.calculateDiversityScore({
          newElements: newElements,
          recentElements: recentElements,
        });

        console.log(
          `📈 Diversity score calculated: ${diversityScore.score.toFixed(3)} ` +
            `(${diversityScore.novelElementCount}/${diversityScore.totalElementCount} novel)`,
        );
      } catch (error) {
        const message = `Failed to calculate diversity score: ${
          error instanceof Error ? error.message : String(error)
        }`;
        console.error(`❌ ${message}`);
        errors.push(message);
        return {
          success: false,
          errors,
          duration: Date.now() - startTime,
        };
      }

      // Step 3: Check for low diversity and log warning
      if (diversityScore.score < this.LOW_DIVERSITY_THRESHOLD) {
        console.warn(
          `⚠️  LOW DIVERSITY DETECTED - Story ${storyId}: ` +
            `score=${diversityScore.score.toFixed(3)} ` +
            `(threshold=${this.LOW_DIVERSITY_THRESHOLD})`,
        );
      }

      // Step 4: Store score in database (upsert to handle multiple extractions for same story)
      try {
        const record: DiversityScoreRecord = {
          story_id: storyId,
          diversity_score: diversityScore.score,
          novel_element_count: diversityScore.novelElementCount,
          metadata: {
            total_element_count: diversityScore.totalElementCount,
            novelty_ratio: diversityScore.noveltyRatio,
            avg_semantic_distance: diversityScore.avgSemanticDistance,
            element_breakdown: diversityScore.elementBreakdown,
          },
          created_at: new Date().toISOString(), // Update timestamp on each calculation
        };

        // Use upsert to handle duplicate story_id (unique constraint)
        // If score exists, update it with latest calculation
        const { error } = await sb
          .from('story_diversity_scores')
          .upsert(record as any, {
            onConflict: 'story_id', // Conflict on unique constraint
            ignoreDuplicates: false, // Always update, don't ignore
          });

        if (error) {
          // Supabase errors have different structure - log full error for debugging
          console.error('❌ Supabase diversity score upsert error details:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
            fullError: error,
          });
          throw new Error(
            `Database upsert failed: ${
              error.message || error.details || JSON.stringify(error)
            }`,
          );
        }

        console.log(
          `💾 Diversity score stored successfully for story ${storyId}`,
        );

        return {
          success: true,
          score: diversityScore.score,
          novelElementCount: diversityScore.novelElementCount,
          totalElementCount: diversityScore.totalElementCount,
          errors: [],
          duration: Date.now() - startTime,
        };
      } catch (error) {
        const message = `Failed to store diversity score: ${
          error instanceof Error ? error.message : String(error)
        }`;
        console.error(`❌ ${message}`);
        errors.push(message);
        return {
          success: false,
          score: diversityScore.score, // Include score even if storage failed
          errors,
          duration: Date.now() - startTime,
        };
      }
    } catch (error) {
      // Catch-all for unexpected errors
      const message = `Unexpected error in storeDiversityScore: ${
        error instanceof Error ? error.message : String(error)
      }`;
      console.error(`❌ ${message}`);
      errors.push(message);
      return {
        success: false,
        errors,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Store diversity score asynchronously (fire-and-forget)
   *
   * Use this in production to avoid blocking story delivery.
   * Errors are logged but not thrown.
   *
   * @param options - Story and session context with extracted elements
   */
  storeDiversityScoreAsync(options: StoreDiversityScoreOptions): void {
    this.storeDiversityScore(options).catch(error => {
      console.error(
        `❌ Async diversity score storage failed for story ${options.storyId}:`,
        error,
      );
    });
  }

  /**
   * Get diversity score for a story
   *
   * Useful for debugging and analytics.
   *
   * @param storyId - Story identifier
   * @returns Diversity score record or null if not found
   */
  async getDiversityScore(
    storyId: string,
  ): Promise<DiversityScoreRecord | null> {
    // Skip Supabase query for Convex story IDs (non-UUID format)
    if (!isValidUUID(storyId)) {
      console.log(
        '⚠️ Convex story ID detected, returning null (not yet migrated):',
        { storyId: storyId.substring(0, 12) },
      );
      return null;
    }

    try {
      const { data, error } = await sb
        .from('story_diversity_scores')
        .select('*')
        .eq('story_id', storyId)
        .single();

      if (error) {
        console.error(
          `Error fetching diversity score for story ${storyId}:`,
          error,
        );
        return null;
      }

      return data as DiversityScoreRecord;
    } catch (error) {
      console.error(
        `Failed to get diversity score for story ${storyId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Get diversity statistics for a session
   *
   * Calculates average diversity score and identifies low-scoring stories.
   *
   * @param sessionId - Session identifier
   * @returns Statistics about diversity scores in the session
   */
  async getSessionDiversityStats(sessionId: string): Promise<{
    averageScore: number;
    storyCount: number;
    lowDiversityCount: number; // Count of stories with score < 0.4
  }> {
    // Skip Supabase query for Convex session IDs (non-UUID format)
    if (!isValidUUID(sessionId)) {
      console.log(
        '⚠️ Convex session ID detected, returning empty stats (not yet migrated):',
        { sessionId: sessionId.substring(0, 12) },
      );
      return { averageScore: 0, storyCount: 0, lowDiversityCount: 0 };
    }

    try {
      // Get all story IDs for this session
      const { data: elements } = await sb
        .from('story_elements')
        .select('story_id')
        .eq('session_id', sessionId);

      if (!elements || elements.length === 0) {
        return { averageScore: 0, storyCount: 0, lowDiversityCount: 0 };
      }

      // Get unique story IDs
      const storyIds = Array.from(new Set(elements.map(e => e.story_id)));

      // Fetch diversity scores for these stories
      const { data: scores } = await sb
        .from('story_diversity_scores')
        .select('diversity_score')
        .in('story_id', storyIds);

      if (!scores || scores.length === 0) {
        return { averageScore: 0, storyCount: 0, lowDiversityCount: 0 };
      }

      const scoreValues = scores.map(s => Number(s.diversity_score));
      const averageScore =
        scoreValues.reduce((sum, score) => sum + score, 0) / scoreValues.length;
      const lowDiversityCount = scoreValues.filter(
        score => score < this.LOW_DIVERSITY_THRESHOLD,
      ).length;

      return {
        averageScore,
        storyCount: scores.length,
        lowDiversityCount,
      };
    } catch (error) {
      console.error(
        `Failed to get session diversity stats for ${sessionId}:`,
        error,
      );
      return { averageScore: 0, storyCount: 0, lowDiversityCount: 0 };
    }
  }
}

// Export singleton instance
export const diversityScoreStorageService = new DiversityScoreStorageService();
