/**
 * Diversity Debug Service
 *
 * Provides debugging capabilities for the story diversity tracking system.
 * Wraps Supabase RPC functions to retrieve recent elements and diversity scores
 * for debugging and monitoring purposes.
 *
 * Created: 2026-01-14
 * Part of: US-015 - Create API endpoint for recent elements debugging
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabase';

// Boundary cast: project Database type doesn't include diversity-debug RPC
// functions and tables, so chains resolve to never. Same pattern as
// feedbackCollectionService.ts.
const sb = supabase as unknown as SupabaseClient;

/**
 * Element information returned by debugging endpoint
 */
export interface DebugElement {
  text: string;
  frequency: number;
  lastUsed: Date;
  embedding: number[] | null;
  storyIds: string[];
}

/**
 * Elements grouped by type
 */
export interface DebugElementsByType {
  character?: DebugElement[];
  setting?: DebugElement[];
  object?: DebugElement[];
  plot_pattern?: DebugElement[];
}

/**
 * Session metadata for debugging
 */
export interface DebugSessionInfo {
  sessionId: string;
  userId: string;
  createdAt: Date;
  totalStories: number;
  storiesInWindow: number;
}

/**
 * Date range for elements in session
 */
export interface DebugDateRange {
  earliest: Date | null;
  latest: Date | null;
}

/**
 * Complete recent elements debug response
 */
export interface RecentElementsDebugResponse {
  sessionInfo: DebugSessionInfo;
  dateRange: DebugDateRange;
  elementsByType: DebugElementsByType;
  totalElements: number;
}

/**
 * Diversity score debug breakdown
 */
export interface DiversityScoreDebugResponse {
  storyId: string;
  diversityScore: number;
  novelElementCount: number;
  calculatedAt: Date;
  breakdown: {
    total_element_count?: number;
    novelty_ratio?: number;
    avg_semantic_distance?: number;
    element_breakdown?: {
      character?: { novel: number; total: number };
      setting?: { novel: number; total: number };
      object?: { novel: number; total: number };
      plot_pattern?: { novel: number; total: number };
    };
  };
}

/**
 * Error response from debug endpoints
 */
export interface DebugErrorResponse {
  error: string;
  hint?: string;
  code?: string;
}

/**
 * Diversity Debug Service
 *
 * Provides methods to retrieve diversity tracking data for debugging purposes.
 * All methods require authentication and enforce ownership checks (users can
 * only access their own sessions and stories).
 */
class DiversityDebugService {
  /**
   * Retrieve recent story elements for a session with metadata
   *
   * @param sessionId - The diversity session ID to retrieve elements for
   * @param limit - Maximum number of recent stories to retrieve (default: 10)
   * @returns Recent elements grouped by type with frequency and metadata
   * @throws Error if user is not authenticated or doesn't own the session
   *
   * @example
   * ```typescript
   * const result = await diversityDebugService.getRecentElements('div_sess_abc123', 10);
   * console.log('Total elements:', result.totalElements);
   * console.log('Characters:', result.elementsByType.character);
   * ```
   */
  public async getRecentElements(
    sessionId: string,
    limit: number = 10,
  ): Promise<RecentElementsDebugResponse> {
    try {
      // Input validation
      if (!sessionId || typeof sessionId !== 'string') {
        throw new Error('Session ID is required and must be a string');
      }

      if (limit < 1 || limit > 100) {
        throw new Error('Limit must be between 1 and 100');
      }

      // Call Supabase RPC function
      const { data, error } = await sb.rpc(
        'get_recent_elements_for_debugging',
        {
          p_session_id: sessionId,
          p_limit: limit,
        },
      );

      if (error) {
        throw this.formatSupabaseError(error);
      }

      if (!data) {
        throw new Error('No data returned from debug endpoint');
      }

      // Parse and transform response
      return this.parseRecentElementsResponse(data);
    } catch (error) {
      console.error(
        '❌ Failed to retrieve recent elements for debugging:',
        error,
      );
      throw error;
    }
  }

  /**
   * Retrieve diversity score and breakdown for a story
   *
   * @param storyId - The story (game_session) ID to retrieve score for
   * @returns Diversity score with detailed breakdown
   * @throws Error if user is not authenticated or doesn't own the story
   *
   * @example
   * ```typescript
   * const result = await diversityDebugService.getDiversityScore('story-uuid-123');
   * console.log('Score:', result.diversityScore);
   * console.log('Novel elements:', result.novelElementCount);
   * ```
   */
  public async getDiversityScore(
    storyId: string,
  ): Promise<DiversityScoreDebugResponse> {
    try {
      // Input validation
      if (!storyId || typeof storyId !== 'string') {
        throw new Error('Story ID is required and must be a string');
      }

      // Call Supabase RPC function
      const { data, error } = await sb.rpc('get_diversity_score_debug', {
        p_story_id: storyId,
      });

      if (error) {
        throw this.formatSupabaseError(error);
      }

      if (!data) {
        throw new Error('No data returned from debug endpoint');
      }

      // Parse and transform response
      return this.parseDiversityScoreResponse(data);
    } catch (error) {
      console.error(
        '❌ Failed to retrieve diversity score for debugging:',
        error,
      );
      throw error;
    }
  }

  /**
   * Check if user has access to a session (for client-side validation)
   *
   * @param sessionId - The diversity session ID to check
   * @returns True if user owns the session, false otherwise
   *
   * @example
   * ```typescript
   * const canAccess = await diversityDebugService.canAccessSession('div_sess_abc123');
   * if (canAccess) {
   *   // Show debug UI
   * }
   * ```
   */
  public async canAccessSession(sessionId: string): Promise<boolean> {
    try {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return false;
      }

      // Query session to check ownership
      const { data, error } = await sb
        .from('user_sessions')
        .select('user_id, expires_at')
        .eq('id', sessionId)
        .single();

      if (error || !data) {
        return false;
      }

      // Check ownership and expiration
      const isOwner = data.user_id === user.id;
      const isExpired = new Date(data.expires_at) < new Date();

      return isOwner && !isExpired;
    } catch (error) {
      console.warn('⚠️  Failed to check session access:', error);
      return false;
    }
  }

  /**
   * Get session statistics for debugging
   *
   * @param sessionId - The diversity session ID
   * @returns Quick stats about the session
   *
   * @example
   * ```typescript
   * const stats = await diversityDebugService.getSessionStats('div_sess_abc123');
   * console.log(`Session has ${stats.totalStories} stories`);
   * ```
   */
  public async getSessionStats(sessionId: string): Promise<{
    totalStories: number;
    totalElements: number;
    uniqueElements: number;
    averageElementsPerStory: number;
  }> {
    try {
      const debugData = await this.getRecentElements(sessionId, 100);

      // Calculate unique elements across all types
      let uniqueElements = 0;
      Object.values(debugData.elementsByType).forEach(elements => {
        if (elements) {
          uniqueElements += elements.length;
        }
      });

      return {
        totalStories: debugData.sessionInfo.totalStories,
        totalElements: debugData.totalElements,
        uniqueElements,
        averageElementsPerStory:
          debugData.sessionInfo.totalStories > 0
            ? Math.round(
                debugData.totalElements / debugData.sessionInfo.totalStories,
              )
            : 0,
      };
    } catch (error) {
      console.error('❌ Failed to retrieve session stats:', error);
      throw error;
    }
  }

  /**
   * Parse recent elements response from Supabase RPC
   */
  private parseRecentElementsResponse(data: any): RecentElementsDebugResponse {
    return {
      sessionInfo: {
        sessionId: data.sessionInfo.sessionId,
        userId: data.sessionInfo.userId,
        createdAt: new Date(data.sessionInfo.createdAt),
        totalStories: data.sessionInfo.totalStories,
        storiesInWindow: data.sessionInfo.storiesInWindow,
      },
      dateRange: {
        earliest: data.dateRange.earliest
          ? new Date(data.dateRange.earliest)
          : null,
        latest: data.dateRange.latest ? new Date(data.dateRange.latest) : null,
      },
      elementsByType: this.parseElementsByType(data.elementsByType),
      totalElements: data.totalElements,
    };
  }

  /**
   * Parse elements by type from JSON response
   */
  private parseElementsByType(elementsByType: any): DebugElementsByType {
    const result: DebugElementsByType = {};

    // Parse each element type
    ['character', 'setting', 'object', 'plot_pattern'].forEach(type => {
      if (elementsByType[type]) {
        result[type as keyof DebugElementsByType] = elementsByType[type].map(
          (el: any) => ({
            text: el.text,
            frequency: el.frequency,
            lastUsed: new Date(el.lastUsed),
            embedding: el.embedding,
            storyIds: el.storyIds,
          }),
        );
      }
    });

    return result;
  }

  /**
   * Parse diversity score response from Supabase RPC
   */
  private parseDiversityScoreResponse(data: any): DiversityScoreDebugResponse {
    return {
      storyId: data.storyId,
      diversityScore: data.diversityScore,
      novelElementCount: data.novelElementCount,
      calculatedAt: new Date(data.calculatedAt),
      breakdown: data.breakdown || {},
    };
  }

  /**
   * Format Supabase error into user-friendly message
   */
  private formatSupabaseError(error: any): Error {
    const message = error.message || 'Unknown database error';
    const hint = error.hint || '';

    // Create error with context
    const formattedError = new Error(`${message}${hint ? ` (${hint})` : ''}`);

    // Preserve original error code if available
    if (error.code) {
      (formattedError as any).code = error.code;
    }

    return formattedError;
  }
}

// Export singleton instance
export const diversityDebugService = new DiversityDebugService();

// Export class for testing
export default DiversityDebugService;
