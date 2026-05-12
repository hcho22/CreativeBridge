// Database type definitions for CreativeBridge
// Matches the Supabase database schema from setup_user_profiles_table.sql

import {
  StoryDownloadHistoryRecord,
  DownloadAnalytics,
  DownloadStatus,
  DownloadErrorType,
  UserDownloadHistoryRow,
} from './storyDownload';

// Grade level options
export type GradeLevel = 'K-2' | '3-5' | '6-8' | '9-12';

// COPPA compliance types (US-001)
export type AgeGroup = 'under_13' | '13_to_17' | '18_plus';
export type ConsentStatus =
  | 'not_required'
  | 'pending'
  | 'granted'
  | 'withdrawn';

// Story genre options (US-003)
export type StoryGenre =
  | 'Mystery'
  | 'Fantasy'
  | 'Comedy'
  | 'Horror'
  | 'Fiction'
  | 'Fairy Tale';

// Onboarding progress tracking (US-007)
export interface OnboardingProgress {
  create_account: boolean;
  first_story: boolean;
  first_image: boolean;
  first_voice: boolean;
  first_streak: boolean;
}

// Onboarding status returned by get_onboarding_status function (US-007)
export interface OnboardingStatus {
  onboarding_completed: boolean;
  onboarding_progress: OnboardingProgress;
  first_story_completed_at: string | null;
  first_image_generated_at: string | null;
  first_voice_input_at: string | null;
  first_streak_achieved_at: string | null;
  completion_percentage: number;
}

// User Profile interface - matches user_profiles table
export interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  created_at: string;
  updated_at: string;

  // OAuth Authentication (Clerk)
  clerk_user_id?: string; // Clerk user ID for OAuth users (format: user_xxxxx)

  // Game Statistics
  total_xp: number;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string;

  // High Scores
  best_score: number;
  total_games_played: number;
  total_stories_completed: number;
  total_words_written: number;

  // Preferences
  preferred_grade_level: GradeLevel;
  speech_enabled: boolean;
  preferred_genre?: StoryGenre;
  // US-009: nested preference bag. Snake_case here matches the legacy
  // `UserProfile` convention; AuthContext maps to/from camelCase Convex.
  preferences?: {
    transcription_engine?: 'on-device' | 'cloud';
  };

  // Profile Data (optional)
  avatar_url?: string;
  bio?: string;

  // COPPA Compliance (US-001)
  age_group?: AgeGroup;
  consent_status?: ConsentStatus;

  // Onboarding Progress (US-007)
  onboarding_completed: boolean;
  onboarding_progress: OnboardingProgress;
  first_story_completed_at?: string;
  first_image_generated_at?: string;
  first_voice_input_at?: string;
  first_streak_achieved_at?: string;
}

// Story source types
export type StorySource = 'New' | 'CreativeBridge' | 'Story_Quest' | 'File';

// Image upload status types
export type ImageUploadStatus = 'pending' | 'uploaded' | 'failed';

// Game Session interface - matches game_sessions table
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

  // NEW: Story Completion Tracking
  current_round: number; // 1-5, story completes at round 5

  // NEW: Image Persistence Fields (Supabase Storage)
  supabase_image_url?: string; // Permanent backup in Supabase Storage
  image_upload_status?: ImageUploadStatus; // Upload status tracking
  image_upload_attempts?: number; // Number of upload attempts (max 3)
  image_upload_error?: string | null; // Last error message for debugging
}

// User Session interface - matches user_sessions table (diversity tracking)
export interface UserSession {
  id: string;
  session_token: string;
  user_id: string | null;
  created_at: string;
  expires_at: string;
  metadata: Record<string, unknown>;
}

// Leaderboard interfaces - match database views
export interface LeaderboardXpEntry {
  username: string;
  display_name: string;
  total_xp: number;
  total_games_played: number;
  created_at: string;
  rank: number;
}

export interface LeaderboardStreakEntry {
  username: string;
  display_name: string;
  longest_streak: number;
  current_streak: number;
  created_at: string;
  rank: number;
}

// user_feedback table (Supabase) — type aliases used by feedbackCollectionService
// for narrowing reads/updates. The Supabase Database typing in this project
// resolves to `never` (see AuthContext.tsx note), so these are not registered
// in the Database interface; they are used directly via casts in the service.
export type UserFeedbackType =
  | 'bug_report'
  | 'feature_request'
  | 'rating'
  | 'general'
  | 'image_quality';

export type UserFeedbackCategory =
  | 'image_generation'
  | 'ui_ux'
  | 'performance'
  | 'xp_system'
  | 'general';

export type UserFeedbackSeverity = 'low' | 'medium' | 'high' | 'critical';

export type UserFeedbackStatus =
  | 'new'
  | 'acknowledged'
  | 'in_progress'
  | 'resolved'
  | 'closed';

export type UserFeedbackRow = {
  id: string;
  user_id: string;
  session_id?: string | null;
  feedback_type: UserFeedbackType;
  category: UserFeedbackCategory;
  severity?: UserFeedbackSeverity | null;
  rating?: number | null;
  title: string;
  description: string;
  steps_to_reproduce?: string | null;
  expected_behavior?: string | null;
  actual_behavior?: string | null;
  image_generation_event_id?: string | null;
  device_info?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  status: UserFeedbackStatus;
  admin_notes?: string | null;
  created_at: string;
  updated_at?: string | null;
};

// Supabase Database interface
export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: UserProfile;
        Insert: Omit<UserProfile, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<UserProfile, 'id' | 'created_at' | 'updated_at'>>;
        Relationships: [];
      };
      game_sessions: {
        Row: GameSession;
        Insert: Omit<
          GameSession,
          'id' | 'created_at' | 'story_source' | 'story_metadata'
        > & {
          id?: string;
          created_at?: string;
          story_source?: StorySource;
          story_metadata?: Record<string, any>;
        };
        Update: Partial<Omit<GameSession, 'id' | 'created_at' | 'user_id'>>;
        Relationships: [];
      };
      image_generation_events: {
        Row: ImageGenerationEvent;
        Insert: Omit<
          ImageGenerationEvent,
          'id' | 'created_at' | 'completed_at'
        > & {
          id?: string;
          created_at?: string;
          completed_at?: string;
        };
        Update: Partial<
          Omit<ImageGenerationEvent, 'id' | 'created_at' | 'user_id'>
        >;
        Relationships: [];
      };
      user_sessions: {
        Row: UserSession;
        Insert: Omit<UserSession, 'id' | 'created_at' | 'metadata'> & {
          id?: string;
          created_at?: string;
          metadata?: Record<string, unknown>;
        };
        Update: Partial<Omit<UserSession, 'id' | 'created_at'>>;
        Relationships: [];
      };
      story_download_history: {
        Row: StoryDownloadHistoryRecord;
        Insert: Omit<
          StoryDownloadHistoryRecord,
          | 'id'
          | 'created_at'
          | 'completed_at'
          | 'retry_count'
          | 'file_exists'
          | 'metadata'
        > & {
          id?: string;
          created_at?: string;
          completed_at?: string;
          retry_count?: number;
          file_exists?: boolean;
          metadata?: Record<string, any>;
        };
        Update: Partial<
          Omit<StoryDownloadHistoryRecord, 'id' | 'created_at' | 'user_id'>
        >;
        Relationships: [];
      };
    };
    Views: {
      leaderboard_xp: {
        Row: LeaderboardXpEntry;
        Relationships: [];
      };
      leaderboard_streaks: {
        Row: LeaderboardStreakEntry;
        Relationships: [];
      };
    };
    Functions: {
      update_user_streak: {
        Args: { user_uuid: string };
        Returns: void;
      };
      add_user_xp: {
        Args: {
          user_uuid: string;
          xp_to_add: number;
          words_added?: number;
        };
        Returns: void;
      };
      create_story_continuation_session: {
        Args: {
          p_user_id: string;
          p_grade_level: GradeLevel;
          p_story_source: StorySource;
          p_imported_content: string;
          p_original_date?: string;
          p_metadata?: Record<string, any>;
        };
        Returns: string;
      };
      get_user_importable_stories: {
        Args: {
          p_user_id: string;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: ImportableStory[];
      };
      search_user_stories: {
        Args: {
          p_user_id: string;
          p_search_term: string;
          p_limit?: number;
        };
        Returns: SearchableStory[];
      };
      validate_story_import: {
        Args: {
          p_story_source: StorySource;
          p_imported_content: string;
          p_original_date?: string;
        };
        Returns: boolean;
      };
      update_story_generated_image: {
        Args: {
          p_session_id: string;
          p_image_url: string;
          p_generation_cost?: number;
        };
        Returns: boolean;
      };
      get_user_stories_with_images: {
        Args: {
          p_user_id: string;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: StoryWithImage[];
      };
      get_image_generation_stats: {
        Args: {};
        Returns: ImageGenerationStats[];
      };
      create_image_generation_event: {
        Args: {
          p_user_id: string;
          p_session_id: string;
          p_xp_cost?: number;
          p_story_grade_level?: string;
          p_story_word_count?: number;
          p_metadata?: Record<string, any>;
        };
        Returns: string;
      };
      update_image_generation_event: {
        Args: {
          p_event_id: string;
          p_status: GenerationStatus;
          p_image_url?: string;
          p_error_type?: ErrorType;
          p_service_used?: ServiceUsed;
          p_api_response_time?: number;
          p_prompt_used?: string;
        };
        Returns: boolean;
      };
      get_image_generation_analytics: {
        Args: {
          p_user_id?: string;
          p_start_date?: string;
          p_end_date?: string;
        };
        Returns: ImageGenerationAnalytics[];
      };
      get_user_image_generation_events: {
        Args: {
          p_user_id: string;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: UserImageGenerationEvent[];
      };
      // Onboarding functions (US-007)
      update_onboarding_progress_item: {
        Args: {
          p_user_id: string;
          p_item_key: string;
          p_completed?: boolean;
        };
        Returns: boolean;
      };
      record_onboarding_milestone: {
        Args: {
          p_user_id: string;
          p_milestone_type: string;
          p_xp_reward?: number;
        };
        Returns: boolean;
      };
      get_onboarding_status: {
        Args: {
          p_user_id: string;
        };
        Returns: OnboardingStatus[];
      };
      // Story download history functions
      create_story_download_record: {
        Args: {
          p_user_id: string;
          p_story_session_id: string | null;
          p_file_name: string;
          p_file_path: string;
          p_story_title: string | null;
          p_story_word_count: number | null;
          p_story_character_count: number | null;
          p_story_grade_level: string | null;
          p_story_source: string;
          p_download_method: string;
          p_app_version: string | null;
          p_metadata: Record<string, any>;
        };
        Returns: string;
      };
      update_story_download_record: {
        Args: {
          p_record_id: string;
          p_status?: DownloadStatus;
          p_file_size_bytes?: number | null;
          p_error_type?: DownloadErrorType | null;
          p_error_message?: string | null;
          p_retry_count?: number | null;
        };
        Returns: boolean;
      };
      validate_download_file_existence: {
        Args: {
          p_record_id: string;
          p_file_exists: boolean;
        };
        Returns: boolean;
      };
      get_user_download_history: {
        Args: {
          p_user_id: string;
          p_limit?: number;
          p_offset?: number;
          p_include_failed?: boolean;
        };
        Returns: UserDownloadHistoryRow[];
      };
      get_download_analytics: {
        Args: {
          p_user_id?: string | null;
          p_start_date?: string | null;
          p_end_date?: string | null;
        };
        Returns: DownloadAnalytics[];
      };
      cleanup_orphaned_download_records: {
        Args: {
          p_user_id: string;
          p_days_old?: number;
        };
        Returns: number;
      };
    };
  };
}

// Helper types for common operations
export type UserProfileInsert =
  Database['public']['Tables']['user_profiles']['Insert'];
export type UserProfileUpdate =
  Database['public']['Tables']['user_profiles']['Update'];
export type GameSessionInsert =
  Database['public']['Tables']['game_sessions']['Insert'];
export type GameSessionUpdate =
  Database['public']['Tables']['game_sessions']['Update'];
export type ImageGenerationEventInsert =
  Database['public']['Tables']['image_generation_events']['Insert'];
export type ImageGenerationEventUpdate =
  Database['public']['Tables']['image_generation_events']['Update'];

// Authentication and profile creation types
export interface CreateProfileData {
  username: string;
  display_name: string;
  preferred_grade_level?: GradeLevel;
  speech_enabled?: boolean;
}

// Enhanced error handling types
export enum AuthErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  PROFILE_ERROR = 'PROFILE_ERROR',
  SESSION_ERROR = 'SESSION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export interface AuthError {
  type: AuthErrorType;
  message: string;
  details?: string;
  code?: string;
  retryable?: boolean;
}

// Loading states for granular UI feedback
export interface LoadingStates {
  initializing: boolean;
  signingIn: boolean;
  signingUp: boolean;
  signingOut: boolean;
  updatingProfile: boolean;
  refreshingProfile: boolean;
  fetchingProfile: boolean;
  validatingSession: boolean;
}

// API response types
export interface AuthResult {
  error?: AuthError;
  success?: boolean;
}

export interface ProfileResult {
  error?: AuthError;
  profile?: UserProfile;
  success?: boolean;
}

// Session validation types
export interface SessionHealth {
  isValid: boolean;
  expiresAt?: number;
  needsRefresh?: boolean;
  errors?: AuthError[];
}

// Validation helpers
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface UserValidation {
  email: ValidationResult;
  password: ValidationResult;
  username: ValidationResult;
  displayName: ValidationResult;
}

// Statistics and progress types
export interface UserStats {
  total_xp: number;
  current_streak: number;
  longest_streak: number;
  total_games_played: number;
  total_words_written: number;
  best_score: number;
  level: number;
  xp_to_next_level: number;
}

// Story and gameplay types
export interface StoryProgress {
  words_written: number;
  sentences_completed: number;
  challenges_completed: number;
  current_score: number;
}

export interface Challenge {
  id: string;
  type: string;
  description: string;
  points: number;
  grade_level: GradeLevel;
}

// Story continuation specific types
export interface ImportableStory {
  session_id: string;
  created_at: string;
  completed_at: string;
  story_content: string;
  final_score: number;
  words_written: number;
  story_source: StorySource;
  story_metadata: Record<string, any>;
}

export interface SearchableStory {
  session_id: string;
  created_at: string;
  completed_at: string;
  story_content: string;
  story_excerpt: string;
  words_written: number;
  story_source: StorySource;
  relevance_score: number;
}

export interface StoryWithImage {
  session_id: string;
  created_at: string;
  completed_at: string;
  story_content: string;
  generated_image_url: string;
  image_generation_timestamp: string;
  image_generation_cost: number;
  final_score: number;
  words_written: number;
  // NEW: Supabase Storage fields
  supabase_image_url?: string;
  image_upload_status?: ImageUploadStatus;
}

export interface ImageGenerationStats {
  total_images_generated: number;
  avg_generation_cost: number;
  images_generated_today: number;
  images_generated_this_week: number;
  images_generated_this_month: number;
}

// Image generation event types
export type GenerationStatus =
  | 'pending'
  | 'success'
  | 'failed'
  | 'refunded'
  | 'timeout';
export type ErrorType =
  | 'api_failure'
  | 'content_safety'
  | 'insufficient_xp'
  | 'timeout'
  | 'rate_limit';
export type ServiceUsed =
  | 'stability-ai/stable-diffusion-3.5-large'
  | 'sebastianbodza/flux_aquarell_watercolor_style'
  | 'google/nano-banana'
  | 'replicate'
  | 'backup_service';

export interface ImageGenerationEvent {
  id: string;
  user_id: string;
  session_id?: string;
  xp_cost: number;
  generation_status: GenerationStatus;
  error_type?: ErrorType;
  service_used: ServiceUsed;
  api_response_time?: number;
  // Cost tracking columns (used by costTrackingService). Optional because
  // legacy rows may not have them populated.
  api_response_time_ms?: number;
  api_cost?: number;
  cost_recorded_at?: string;
  image_url?: string;
  story_grade_level?: string;
  story_word_count?: number;
  prompt_used?: string;
  metadata: Record<string, any>;
  created_at: string;
  completed_at?: string;
}

export interface ImageGenerationAnalytics {
  total_attempts: number;
  successful_generations: number;
  failed_generations: number;
  refunded_generations: number;
  avg_response_time: number;
  most_common_error_type: string;
  total_xp_spent: number;
  replicate_usage: number;
  backup_service_usage: number;
}

export interface UserImageGenerationEvent {
  event_id: string;
  session_id?: string;
  xp_cost: number;
  generation_status: GenerationStatus;
  error_type?: ErrorType;
  service_used: ServiceUsed;
  api_response_time?: number;
  image_url?: string;
  story_grade_level?: string;
  story_word_count?: number;
  created_at: string;
  completed_at?: string;
}

export interface StoryImportData {
  source: StorySource;
  content: string;
  originalDate?: string;
  metadata?: Record<string, any>;
  author?: string;
  title?: string;
}

export interface StoryMetadata {
  imported_word_count?: number;
  author?: string;
  title?: string;
  original_platform?: string;
  import_date?: string;
  file_name?: string;
  file_size?: number;
  encoding?: string;
  [key: string]: any;
}
