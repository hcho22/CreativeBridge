/**
 * Download History Database Operations
 * Provides CRUD operations for story download history tracking
 */

import { supabase } from './supabase';
import {
  StoryDownloadHistoryRecord,
  CreateDownloadRecordParams,
  UpdateDownloadRecordParams,
  DownloadAnalytics
} from '../types/storyDownload';

export class DownloadHistoryDatabase {
  /**
   * Create a new download record in the database
   */
  async createDownloadRecord(params: CreateDownloadRecordParams): Promise<string> {
    try {
      const { data, error } = await supabase.rpc('create_story_download_record', {
        p_user_id: params.user_id,
        p_story_session_id: params.story_session_id || null,
        p_file_name: params.file_name,
        p_file_path: params.file_path,
        p_story_title: params.story_title || null,
        p_story_word_count: params.story_word_count || null,
        p_story_character_count: params.story_character_count || null,
        p_story_grade_level: params.story_grade_level || null,
        p_story_source: params.story_source || 'New',
        p_download_method: params.download_method || 'share_sheet',
        p_app_version: params.app_version || null,
        p_metadata: params.metadata || {}
      });

      if (error) {
        console.error('❌ Failed to create download record:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      console.log('✅ Download record created:', data);
      return data;
    } catch (error) {
      console.error('❌ Error creating download record:', error);
      throw error;
    }
  }

  /**
   * Update an existing download record status
   */
  async updateDownloadRecord(params: UpdateDownloadRecordParams): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('update_story_download_record', {
        p_record_id: params.record_id,
        p_status: params.status,
        p_file_size_bytes: params.file_size_bytes || null,
        p_error_type: params.error_type || null,
        p_error_message: params.error_message || null,
        p_retry_count: params.retry_count || null
      });

      if (error) {
        console.error('❌ Failed to update download record:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      console.log('✅ Download record updated:', { recordId: params.record_id, status: params.status });
      return data;
    } catch (error) {
      console.error('❌ Error updating download record:', error);
      throw error;
    }
  }

  /**
   * Validate file existence and update the record
   */
  async validateFileExists(recordId: string, fileExists: boolean): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('validate_download_file_existence', {
        p_record_id: recordId,
        p_file_exists: fileExists
      });

      if (error) {
        console.error('❌ Failed to validate file existence:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      console.log('✅ File existence validated:', { recordId, fileExists });
      return data;
    } catch (error) {
      console.error('❌ Error validating file existence:', error);
      throw error;
    }
  }

  /**
   * Get user's download history with pagination
   */
  async getUserDownloadHistory(
    userId: string,
    limit: number = 50,
    offset: number = 0,
    includeFailed: boolean = true
  ): Promise<StoryDownloadHistoryRecord[]> {
    try {
      const { data, error } = await supabase.rpc('get_user_download_history', {
        p_user_id: userId,
        p_limit: limit,
        p_offset: offset,
        p_include_failed: includeFailed
      });

      if (error) {
        console.error('❌ Failed to get download history:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      console.log(`✅ Retrieved ${data?.length || 0} download history records for user ${userId}`);
      
      // Transform the data to match our interface
      return (data || []).map(record => ({
        id: record.record_id,
        user_id: userId,
        story_session_id: record.story_session_id,
        file_name: record.file_name,
        file_path: record.file_path,
        file_size_bytes: record.file_size_bytes,
        download_status: record.download_status,
        story_title: record.story_title,
        story_word_count: record.story_word_count,
        story_character_count: null, // Not returned by function
        story_grade_level: record.story_grade_level,
        story_source: record.story_source,
        download_method: record.download_method,
        device_platform: 'ios', // Default for now
        app_version: null, // Not returned by function
        error_type: record.error_type,
        error_message: null, // Not returned by function for privacy
        retry_count: 0, // Default
        file_exists: record.file_exists,
        last_validated_at: null, // Not returned by function
        metadata: {},
        created_at: record.created_at,
        completed_at: record.completed_at
      }));
    } catch (error) {
      console.error('❌ Error getting download history:', error);
      throw error;
    }
  }

  /**
   * Get download analytics for a user or globally
   */
  async getDownloadAnalytics(
    userId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<DownloadAnalytics> {
    try {
      const { data, error } = await supabase.rpc('get_download_analytics', {
        p_user_id: userId || null,
        p_start_date: startDate?.toISOString() || null,
        p_end_date: endDate?.toISOString() || null
      });

      if (error) {
        console.error('❌ Failed to get download analytics:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      console.log('✅ Retrieved download analytics:', data?.[0]);
      
      // Return the first (and only) analytics record
      return data?.[0] || {
        total_downloads: 0,
        successful_downloads: 0,
        failed_downloads: 0,
        cancelled_downloads: 0,
        total_file_size_mb: 0,
        avg_file_size_kb: 0,
        most_common_error_type: null,
        files_still_existing: 0,
        most_popular_grade_level: null,
        ios_downloads: 0,
        android_downloads: 0
      };
    } catch (error) {
      console.error('❌ Error getting download analytics:', error);
      throw error;
    }
  }

  /**
   * Delete a download record
   */
  async deleteDownloadRecord(recordId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('story_download_history')
        .delete()
        .eq('id', recordId);

      if (error) {
        console.error('❌ Failed to delete download record:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      console.log('✅ Download record deleted:', recordId);
      return true;
    } catch (error) {
      console.error('❌ Error deleting download record:', error);
      throw error;
    }
  }

  /**
   * Cleanup orphaned download records (files that no longer exist)
   */
  async cleanupOrphanedRecords(userId: string, daysOld: number = 30): Promise<number> {
    try {
      const { data, error } = await supabase.rpc('cleanup_orphaned_download_records', {
        p_user_id: userId,
        p_days_old: daysOld
      });

      if (error) {
        console.error('❌ Failed to cleanup orphaned records:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      console.log(`✅ Cleaned up ${data} orphaned download records for user ${userId}`);
      return data || 0;
    } catch (error) {
      console.error('❌ Error cleaning up orphaned records:', error);
      throw error;
    }
  }

  /**
   * Get a specific download record by ID
   */
  async getDownloadRecord(recordId: string): Promise<StoryDownloadHistoryRecord | null> {
    try {
      const { data, error } = await supabase
        .from('story_download_history')
        .select('*')
        .eq('id', recordId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Record not found
          return null;
        }
        console.error('❌ Failed to get download record:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      console.log('✅ Retrieved download record:', recordId);
      return data;
    } catch (error) {
      console.error('❌ Error getting download record:', error);
      throw error;
    }
  }

  /**
   * Get recent successful downloads for a user
   */
  async getRecentSuccessfulDownloads(
    userId: string,
    limit: number = 10
  ): Promise<StoryDownloadHistoryRecord[]> {
    try {
      const { data, error } = await supabase
        .from('story_download_history')
        .select('*')
        .eq('user_id', userId)
        .eq('download_status', 'success')
        .eq('file_exists', true)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('❌ Failed to get recent downloads:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      console.log(`✅ Retrieved ${data?.length || 0} recent successful downloads for user ${userId}`);
      return data || [];
    } catch (error) {
      console.error('❌ Error getting recent downloads:', error);
      throw error;
    }
  }

  /**
   * Check if a story has been downloaded before
   */
  async hasStoryBeenDownloaded(userId: string, storySessionId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('story_download_history')
        .select('id')
        .eq('user_id', userId)
        .eq('story_session_id', storySessionId)
        .eq('download_status', 'success')
        .limit(1);

      if (error) {
        console.error('❌ Failed to check story download status:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      const hasBeenDownloaded = (data?.length || 0) > 0;
      console.log('✅ Story download status checked:', { storySessionId, hasBeenDownloaded });
      return hasBeenDownloaded;
    } catch (error) {
      console.error('❌ Error checking story download status:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const downloadHistoryDatabase = new DownloadHistoryDatabase();
export default downloadHistoryDatabase;