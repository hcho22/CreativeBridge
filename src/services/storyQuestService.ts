/**
 * Story_Quest Integration Service
 *
 * This service handles integration with the Story_Quest platform,
 * including authentication, user story fetching, and cross-platform
 * user matching for the story continuation feature.
 */

import { supabase } from './supabase';

// Story_Quest API Configuration (reads from environment, no hardcoded URLs)
const STORY_QUEST_API_BASE = process.env.STORY_QUEST_API_BASE || '';
const STORY_QUEST_SUPABASE_URL = process.env.STORY_QUEST_SUPABASE_URL || '';
const STORY_QUEST_SUPABASE_KEY =
  process.env.STORY_QUEST_SUPABASE_ANON_KEY || '';

// Feature flag: Story Quest integration is not yet production-ready
const STORY_QUEST_ENABLED = Boolean(STORY_QUEST_API_BASE);

// Types for Story_Quest integration
export interface StoryQuestUser {
  id: string;
  username: string;
  display_name: string;
  email?: string;
  total_xp: number;
  current_streak: number;
  longest_streak: number;
  total_games_played: number;
  total_stories_completed: number;
  total_words_written: number;
  best_score: number;
  preferred_grade_level: 'K-2' | '3-5' | '6-8' | '9-12';
  speech_enabled: boolean;
  created_at: string;
  updated_at: string;
  last_activity_date: string;
}

export interface StoryQuestStory {
  id: string;
  user_id: string;
  grade_level: 'K-2' | '3-5' | '6-8' | '9-12';
  story_content: string;
  final_score: number;
  words_written: number;
  sentences_completed: number;
  challenges_completed: number;
  xp_earned: number;
  created_at: string;
  completed_at: string | null;
  source: 'Story_Quest';
}

export interface AuthCredentials {
  email: string;
  password?: string;
  username?: string;
}

export interface UserMatchResult {
  found: boolean;
  user?: StoryQuestUser;
  confidence: 'high' | 'medium' | 'low';
  matchedBy: 'email' | 'username' | 'display_name';
}

export interface StoryQuestApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

class StoryQuestService {
  private storyQuestSupabase: any = null;

  constructor() {
    this.initializeStoryQuestConnection();
  }

  /**
   * Initialize connection to Story_Quest Supabase instance
   */
  private async initializeStoryQuestConnection() {
    try {
      if (STORY_QUEST_SUPABASE_URL && STORY_QUEST_SUPABASE_KEY) {
        const { createClient } = await import('@supabase/supabase-js');
        this.storyQuestSupabase = createClient(
          STORY_QUEST_SUPABASE_URL,
          STORY_QUEST_SUPABASE_KEY,
        );
        console.log('🔗 Story_Quest Supabase connection initialized');
      } else {
        console.warn('⚠️ Story_Quest Supabase credentials not configured');
      }
    } catch (error) {
      console.error(
        '❌ Failed to initialize Story_Quest Supabase connection:',
        error,
      );
    }
  }

  /**
   * Check if Story_Quest API is available
   */
  async checkApiHealth(): Promise<boolean> {
    if (!STORY_QUEST_ENABLED) {
      return false;
    }

    try {
      const response = await fetch(`${STORY_QUEST_API_BASE}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        return data.status === 'healthy';
      }
      return false;
    } catch (error) {
      console.error('Story_Quest API health check failed:', error);
      return false;
    }
  }

  /**
   * Authenticate with Story_Quest platform
   * Note: Story_Quest uses Supabase auth, so we'll attempt direct database connection
   */
  async authenticate(
    credentials: AuthCredentials,
  ): Promise<StoryQuestApiResponse<StoryQuestUser>> {
    try {
      if (!this.storyQuestSupabase) {
        return {
          success: false,
          error: 'Story_Quest database connection not available',
        };
      }

      // First try to find user by email in Story_Quest user_profiles
      const { data: profileData, error: profileError } =
        await this.storyQuestSupabase
          .from('user_profiles')
          .select('*')
          .eq(
            'username',
            credentials.username || credentials.email?.split('@')[0],
          )
          .single();

      if (profileError && profileError.code !== 'PGRST116') {
        // PGRST116 = no rows returned
        throw new Error(`Database query error: ${profileError.message}`);
      }

      if (profileData) {
        return {
          success: true,
          data: {
            ...profileData,
            source: 'Story_Quest',
          } as StoryQuestUser,
        };
      }

      return {
        success: false,
        error: 'User not found in Story_Quest platform',
      };
    } catch (error) {
      console.error('Story_Quest authentication error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      };
    }
  }

  /**
   * Fetch user stories from Story_Quest platform
   */
  async fetchUserStories(
    userId: string,
  ): Promise<StoryQuestApiResponse<StoryQuestStory[]>> {
    try {
      if (!this.storyQuestSupabase) {
        return {
          success: false,
          error: 'Story_Quest database connection not available',
        };
      }

      // Fetch completed game sessions for the user
      const { data: sessionsData, error: sessionsError } =
        await this.storyQuestSupabase
          .from('game_sessions')
          .select('*')
          .eq('user_id', userId)
          .not('story_content', 'is', null)
          .not('completed_at', 'is', null)
          .order('created_at', { ascending: false });

      if (sessionsError) {
        throw new Error(`Failed to fetch stories: ${sessionsError.message}`);
      }

      // Transform Story_Quest game sessions to CreativeBridge story format
      const stories: StoryQuestStory[] = (sessionsData || []).map(
        (session: any) => ({
          id: session.id,
          user_id: session.user_id,
          grade_level: session.grade_level,
          story_content: session.story_content,
          final_score: session.final_score || 0,
          words_written: session.words_written || 0,
          sentences_completed: session.sentences_completed || 0,
          challenges_completed: session.challenges_completed || 0,
          xp_earned: session.xp_earned || 0,
          created_at: session.created_at,
          completed_at: session.completed_at,
          source: 'Story_Quest',
        }),
      );

      return {
        success: true,
        data: stories,
      };
    } catch (error) {
      console.error('Error fetching Story_Quest stories:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to fetch stories',
      };
    }
  }

  /**
   * Handle cross-platform user matching and verification
   */
  async matchUserByEmail(email: string): Promise<UserMatchResult> {
    try {
      if (!this.storyQuestSupabase) {
        return {
          found: false,
          confidence: 'low',
          matchedBy: 'email',
        };
      }

      // Try to find user by extracting username from email
      const usernameFromEmail = email.split('@')[0].toLowerCase();

      // Search for users with matching username or display name
      const { data: users, error } = await this.storyQuestSupabase
        .from('user_profiles')
        .select('*')
        .or(
          `username.ilike.%${usernameFromEmail}%,display_name.ilike.%${usernameFromEmail}%`,
        )
        .limit(5);

      if (error) {
        console.error('User matching query error:', error);
        return {
          found: false,
          confidence: 'low',
          matchedBy: 'email',
        };
      }

      if (!users || users.length === 0) {
        return {
          found: false,
          confidence: 'low',
          matchedBy: 'email',
        };
      }

      // Find the best match
      let bestMatch = users[0];
      let confidence: 'high' | 'medium' | 'low' = 'low';
      let matchedBy: 'email' | 'username' | 'display_name' = 'username';

      for (const user of users) {
        // Exact username match (highest confidence)
        if (user.username.toLowerCase() === usernameFromEmail) {
          bestMatch = user;
          confidence = 'high';
          matchedBy = 'username';
          break;
        }

        // Display name contains username (medium confidence)
        if (user.display_name?.toLowerCase().includes(usernameFromEmail)) {
          bestMatch = user;
          confidence = 'medium';
          matchedBy = 'display_name';
        }
      }

      return {
        found: true,
        user: bestMatch as StoryQuestUser,
        confidence,
        matchedBy,
      };
    } catch (error) {
      console.error('Error matching user by email:', error);
      return {
        found: false,
        confidence: 'low',
        matchedBy: 'email',
      };
    }
  }

  /**
   * Test Story_Quest integration with sample data
   */
  async testIntegration(): Promise<
    StoryQuestApiResponse<{
      apiHealth: boolean;
      databaseConnection: boolean;
      sampleUserCount: number;
      sampleStoryCount: number;
    }>
  > {
    try {
      // Test API health
      const apiHealth = await this.checkApiHealth();

      // Test database connection
      let databaseConnection = false;
      let sampleUserCount = 0;
      let sampleStoryCount = 0;

      if (this.storyQuestSupabase) {
        try {
          // Test user_profiles table access
          const { data: _users, error: userError } =
            await this.storyQuestSupabase
              .from('user_profiles')
              .select('id')
              .limit(1);

          if (!userError) {
            databaseConnection = true;

            // Count sample users
            const { count: userCount } = await this.storyQuestSupabase
              .from('user_profiles')
              .select('*', { count: 'exact', head: true });

            sampleUserCount = userCount || 0;

            // Count sample stories
            const { count: storyCount } = await this.storyQuestSupabase
              .from('game_sessions')
              .select('*', { count: 'exact', head: true })
              .not('story_content', 'is', null);

            sampleStoryCount = storyCount || 0;
          }
        } catch (dbError) {
          console.error('Database connection test failed:', dbError);
        }
      }

      return {
        success: true,
        data: {
          apiHealth,
          databaseConnection,
          sampleUserCount,
          sampleStoryCount,
        },
      };
    } catch (error) {
      console.error('Integration test failed:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Integration test failed',
      };
    }
  }

  /**
   * Import a Story_Quest story into CreativeBridge format
   */
  async importStoryToCreativeBridge(
    storyQuestStory: StoryQuestStory,
    creativeBridgeUserId: string,
  ): Promise<StoryQuestApiResponse<any>> {
    try {
      // Transform Story_Quest story to CreativeBridge format
      const importedStory = {
        user_id: creativeBridgeUserId,
        story_content: storyQuestStory.story_content,
        imported_story_content: storyQuestStory.story_content,
        story_source: 'Story_Quest',
        original_creation_date: storyQuestStory.created_at,
        story_metadata: {
          original_id: storyQuestStory.id,
          grade_level: storyQuestStory.grade_level,
          final_score: storyQuestStory.final_score,
          words_written: storyQuestStory.words_written,
          sentences_completed: storyQuestStory.sentences_completed,
          challenges_completed: storyQuestStory.challenges_completed,
          xp_earned: storyQuestStory.xp_earned,
          completed_at: storyQuestStory.completed_at,
          source_platform: 'Story_Quest',
        },
        grade_level: storyQuestStory.grade_level,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Save to CreativeBridge database
      const sb =
        supabase as unknown as import('@supabase/supabase-js').SupabaseClient;
      const { data, error } = await sb
        .from('game_sessions')
        .insert(importedStory)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to import story: ${error.message}`);
      }

      return {
        success: true,
        data,
        message: 'Story successfully imported from Story_Quest',
      };
    } catch (error) {
      console.error('Error importing Story_Quest story:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to import story',
      };
    }
  }

  /**
   * Get user's Story_Quest profile statistics
   */
  async getUserStats(userId: string): Promise<
    StoryQuestApiResponse<{
      totalStories: number;
      totalXp: number;
      averageScore: number;
      longestStreak: number;
      favoriteGradeLevel: string;
    }>
  > {
    try {
      if (!this.storyQuestSupabase) {
        return {
          success: false,
          error: 'Story_Quest database connection not available',
        };
      }

      // Get user profile
      const { data: profile, error: profileError } =
        await this.storyQuestSupabase
          .from('user_profiles')
          .select('*')
          .eq('id', userId)
          .single();

      if (profileError) {
        return {
          success: false,
          error: 'User not found in Story_Quest',
        };
      }

      // Get user's stories to calculate averages
      const { data: stories, error: storiesError } =
        await this.storyQuestSupabase
          .from('game_sessions')
          .select('grade_level, final_score')
          .eq('user_id', userId)
          .not('completed_at', 'is', null);

      if (storiesError) {
        console.warn('Error fetching user stories for stats:', storiesError);
      }

      const totalStories = stories?.length || 0;
      const averageScore =
        totalStories > 0
          ? stories.reduce(
              (sum: number, story: any) => sum + (story.final_score || 0),
              0,
            ) / totalStories
          : 0;

      // Find most used grade level
      const gradeLevelCounts: Record<string, number> = {};
      stories?.forEach((story: any) => {
        gradeLevelCounts[story.grade_level] =
          (gradeLevelCounts[story.grade_level] || 0) + 1;
      });

      const favoriteGradeLevel = Object.keys(gradeLevelCounts).reduce(
        (a, b) => (gradeLevelCounts[a] > gradeLevelCounts[b] ? a : b),
        profile.preferred_grade_level,
      );

      return {
        success: true,
        data: {
          totalStories,
          totalXp: profile.total_xp || 0,
          averageScore: Math.round(averageScore * 100) / 100,
          longestStreak: profile.longest_streak || 0,
          favoriteGradeLevel,
        },
      };
    } catch (error) {
      console.error('Error fetching user stats:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to fetch user stats',
      };
    }
  }
}

// Export singleton instance
export const storyQuestService = new StoryQuestService();
export default storyQuestService;
