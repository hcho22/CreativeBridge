// Database type definitions for CreativeBridge
// Matches the Supabase database schema from setup_user_profiles_table.sql

// Grade level options
export type GradeLevel = 'K-2' | '3-5' | '6-8' | '9-12';

// User Profile interface - matches user_profiles table
export interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  created_at: string;
  updated_at: string;

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

  // Profile Data (optional)
  avatar_url?: string;
  bio?: string;
}

// Story source types
export type StorySource = 'New' | 'CreativeBridge' | 'Story_Quest' | 'File';

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
      };
    };
    Views: {
      leaderboard_xp: {
        Row: LeaderboardXpEntry;
      };
      leaderboard_streaks: {
        Row: LeaderboardStreakEntry;
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
