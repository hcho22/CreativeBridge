// Story Session Management Service for CreativeBridge
// Handles story persistence, progress tracking, and session resumption
// Now uses Supabase database for persistent storage
//
// Key Features:
// - Creates sessions in Supabase game_sessions table
// - Updates sessions in real-time with story progress
// - Provides offline fallback with local caching
// - Tracks word count, sentences, XP, and scores

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import {
  GradeLevel,
  GameSession,
  GameSessionInsert,
  GameSessionUpdate,
} from '../types';

export interface StoryContribution {
  type: 'user' | 'ai';
  content: string;
  timestamp: number;
  wordCount: number;
}

// Extended StorySession that includes both Supabase GameSession data and local enhancements
export interface StorySession {
  // Core Supabase GameSession fields
  id: string;
  user_id: string;
  created_at: string;
  completed_at?: string;
  grade_level: GradeLevel;
  final_score: number;
  words_written: number;
  sentences_completed: number;
  challenges_completed: number;
  xp_earned: number;
  story_content?: string;

  // Image generation fields
  generated_image_url?: string;
  image_generation_timestamp?: string;
  image_generation_cost?: number;
  local_image_path?: string; // For downloaded images

  // NEW: Story completion tracking
  current_round: number; // 1-5, story completes at round 5

  // NEW: Image persistence fields (Supabase Storage)
  supabase_image_url?: string;
  image_upload_status?: 'pending' | 'uploaded' | 'failed';
  image_upload_attempts?: number;
  image_upload_error?: string;

  // Enhanced local fields for better UX
  contributions: StoryContribution[];
  isCompleted: boolean;
  sessionStats: {
    totalWords: number;
    userWords: number;
    aiWords: number;
    sessionDuration: number;
    contributionCount: number;
  };
  metadata: {
    theme?: string;
    character?: string;
    setting?: string;
    difficulty?: number;
  };
}

export interface SessionSummary {
  id: string;
  title: string;
  gradeLevel: GradeLevel;
  lastUpdated: number;
  isCompleted: boolean;
  wordCount: number;
  duration: number;
}

class StorySessionManager {
  private readonly STORAGE_PREFIX = '@CreativeBridge:';
  private readonly SESSIONS_KEY = `${this.STORAGE_PREFIX}sessions`;
  private readonly CURRENT_SESSION_KEY = `${this.STORAGE_PREFIX}currentSession`;
  private readonly MAX_SESSIONS = 50; // Limit stored sessions
  private readonly MAX_ROUNDS = 5; // Story completes after 5 rounds

  // NEW: In-memory cache for frequently accessed sessions (BUG-567 optimization)
  private sessionCache: Map<string, { session: StorySession; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache TTL
  private readonly MAX_CACHE_SIZE = 10; // Keep 10 most recent sessions in memory

  // Create a new story session in Supabase
  public async createSession(
    userId: string,
    gradeLevel: GradeLevel,
    metadata?: Partial<StorySession['metadata']>,
  ): Promise<StorySession> {
    try {
      console.log('Creating new session in Supabase for user:', userId);

      // Create session in Supabase database
      const sessionData = {
        user_id: userId,
        grade_level: gradeLevel,
        final_score: 0,
        words_written: 0,
        sentences_completed: 0,
        challenges_completed: 0,
        xp_earned: 0,
        story_content: '',
      } as any;

      const { data: gameSession, error } = await supabase
        .from('game_sessions')
        .insert(sessionData)
        .select()
        .single();

      if (error) {
        console.error('Error creating session in Supabase:', error);
        throw new Error(`Failed to create session: ${error.message}`);
      }

      // Convert to enhanced StorySession format
      const newSession: StorySession = {
        ...(gameSession as any),
        current_round: (gameSession as any).current_round || 1, // Initialize to round 1
        isCompleted: false,
        contributions: [],
        sessionStats: {
          totalWords: 0,
          userWords: 0,
          aiWords: 0,
          sessionDuration: 0,
          contributionCount: 0,
        },
        metadata: metadata || {},
      };

      // Cache locally for offline access
      await this.cacheSessionLocally(newSession);
      await this.setCurrentSession((gameSession as any).id);

      console.log('Session created successfully:', (gameSession as any).id);
      return newSession;
    } catch (error) {
      console.error('Failed to create session:', error);
      throw error;
    }
  }

  // Add a contribution to the current session
  public async addContribution(
    sessionId: string,
    type: 'user' | 'ai',
    content: string,
    existingSession?: StorySession,
  ): Promise<StorySession | null> {
    // Use existing session if provided to avoid losing contributions array
    const session = existingSession || (await this.getSession(sessionId));
    if (!session) return null;

    const wordCount = this.countWords(content);
    const contribution: StoryContribution = {
      type,
      content,
      timestamp: Date.now(),
      wordCount,
    };

    // Ensure contributions array exists
    if (!session.contributions) {
      session.contributions = [];
    }
    session.contributions.push(contribution);

    // Update Supabase fields - append to existing story content instead of rebuilding
    if (session.story_content) {
      session.story_content = session.story_content + ' ' + content.trim();
    } else {
      session.story_content = this.buildCurrentStory(session.contributions);
    }
    // Only add to words_written if it's a user contribution
    if (type === 'user') {
      session.words_written += wordCount;
    }
    session.sentences_completed = session.contributions.length;

    // NEW: Story completion tracking - increment round after AI response
    if (type === 'ai') {
      session.current_round = Math.min(session.current_round + 1, this.MAX_ROUNDS);

      // Check if story should be completed (reached MAX_ROUNDS)
      if (session.current_round >= this.MAX_ROUNDS && !session.isCompleted) {
        console.log('🎉 Story reached MAX_ROUNDS - marking as complete');
        session.isCompleted = true;
        session.completed_at = new Date().toISOString();
      }
    }

    // Update local stats
    session.sessionStats.contributionCount = session.contributions.length;
    if (type === 'user') {
      session.sessionStats.userWords += wordCount;
    } else {
      session.sessionStats.aiWords += wordCount;
    }
    // Total words includes both user and AI contributions for display purposes
    session.sessionStats.totalWords =
      session.sessionStats.userWords + session.sessionStats.aiWords;
    session.sessionStats.sessionDuration = session.completed_at
      ? new Date(session.completed_at).getTime() -
        new Date(session.created_at).getTime()
      : Date.now() - new Date(session.created_at).getTime();

    // Update session in Supabase
    const updatedSession = await this.updateSession(session);
    return updatedSession;
  }

  // Get a specific session from Supabase
  public async getSession(
    sessionId: string,
    preserveContributions: boolean = false,
  ): Promise<StorySession | null> {
    try {
      // NEW: Check in-memory cache first (BUG-567 performance optimization)
      const cached = this.getFromCache(sessionId);
      if (cached && !preserveContributions) {
        console.log('✨ Session loaded from in-memory cache (fast path)');
        return cached;
      }

      console.log('Fetching session from Supabase:', sessionId);

      // Check if we have this session in local cache first to preserve contributions
      let existingContributions: StoryContribution[] = [];
      if (preserveContributions) {
        const sessionsData = await AsyncStorage.getItem(this.SESSIONS_KEY);
        if (sessionsData) {
          const sessions: Record<string, StorySession> =
            JSON.parse(sessionsData);
          const cachedSession = sessions[sessionId];
          if (cachedSession?.contributions) {
            existingContributions = cachedSession.contributions;
          }
        }
      }

      // Try Supabase first
      const { data: gameSession, error } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) {
        console.log(
          'Session not found in Supabase, checking local cache:',
          error.message,
        );
        // Fallback to local cache
        const sessionsData = await AsyncStorage.getItem(this.SESSIONS_KEY);
        if (!sessionsData) return null;

        const sessions: Record<string, StorySession> = JSON.parse(sessionsData);
        return sessions[sessionId] || null;
      }

      // Convert Supabase GameSession to enhanced StorySession
      const dbSession = gameSession as any;
      console.log('🔍 [DEBUG] Converting DB session to StorySession:', {
        id: dbSession.id,
        generated_image_url: dbSession.generated_image_url,
        image_generation_timestamp: dbSession.image_generation_timestamp,
        image_generation_cost: dbSession.image_generation_cost,
      });

      const session: StorySession = {
        id: dbSession.id,
        user_id: dbSession.user_id,
        created_at: dbSession.created_at,
        completed_at: dbSession.completed_at,
        grade_level: dbSession.grade_level,
        final_score: dbSession.final_score || 0,
        words_written: dbSession.words_written || 0,
        sentences_completed: dbSession.sentences_completed || 0,
        challenges_completed: dbSession.challenges_completed || 0,
        xp_earned: dbSession.xp_earned || 0,
        story_content: dbSession.story_content || '',
        generated_image_url: dbSession.generated_image_url,
        image_generation_timestamp: dbSession.image_generation_timestamp,
        image_generation_cost: dbSession.image_generation_cost,
        // NEW: Story completion tracking
        current_round: dbSession.current_round || 1,
        // NEW: Image persistence fields
        supabase_image_url: dbSession.supabase_image_url,
        image_upload_status: dbSession.image_upload_status,
        image_upload_attempts: dbSession.image_upload_attempts,
        image_upload_error: dbSession.image_upload_error,
        isCompleted: !!dbSession.completed_at,
        contributions: existingContributions, // Preserve existing contributions or empty array
        sessionStats: {
          userWords: dbSession.words_written || 0, // words_written now only tracks user words
          aiWords: 0, // Will be calculated from contributions if available
          totalWords: dbSession.words_written || 0, // Will be updated with proper calculation
          sessionDuration: dbSession.completed_at
            ? new Date(dbSession.completed_at).getTime() -
              new Date(dbSession.created_at).getTime()
            : Date.now() - new Date(dbSession.created_at).getTime(),
          contributionCount: dbSession.sentences_completed || 0,
        },
        metadata: {}, // Can be extended later
      };

      // If we have existing contributions, recalculate AI words properly
      if (existingContributions.length > 0) {
        let userWords = 0;
        let aiWords = 0;

        existingContributions.forEach(contribution => {
          if (contribution.type === 'user') {
            userWords += contribution.wordCount;
          } else {
            aiWords += contribution.wordCount;
          }
        });

        session.sessionStats.userWords = userWords;
        session.sessionStats.aiWords = aiWords;
        session.sessionStats.totalWords = userWords + aiWords;
      }

      // Ensure story_content is available for display even if contributions array is empty
      // The UI displays session.story_content directly, so this should be preserved from Supabase
      console.log('Session loaded from Supabase:', {
        id: session.id,
        hasStoryContent: !!session.story_content,
        storyContentLength: session.story_content?.length || 0,
        storyPreview: session.story_content?.substring(0, 100) + '...',
        userWords: session.sessionStats.userWords,
        aiWords: session.sessionStats.aiWords,
        generated_image_url: session.generated_image_url,
        hasGeneratedImageUrl: !!session.generated_image_url,
      });

      // NEW: Add to in-memory cache for faster subsequent access
      this.addToCache(session);

      return session;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  }

  // Get current active session
  public async getCurrentSession(): Promise<StorySession | null> {
    try {
      const currentSessionId = await AsyncStorage.getItem(
        this.CURRENT_SESSION_KEY,
      );
      if (!currentSessionId) return null;

      return await this.getSession(currentSessionId);
    } catch (error) {
      console.error('Error getting current session:', error);
      return null;
    }
  }

  // Get all sessions for a user from Supabase
  public async getUserSessions(userId: string): Promise<SessionSummary[]> {
    try {
      console.log('Fetching user sessions from Supabase for user:', userId);

      const { data: gameSessions, error } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching user sessions:', error);
        return [];
      }

      return (gameSessions as any[])
        .map(session => ({
          id: session.id,
          title: this.generateSessionTitle(
            session.story_content || 'Untitled Story',
          ),
          gradeLevel: session.grade_level,
          lastUpdated: new Date(
            session.completed_at || session.created_at,
          ).getTime(),
          isCompleted: !!session.completed_at,
          wordCount: session.words_written,
          duration: session.completed_at
            ? new Date(session.completed_at).getTime() -
              new Date(session.created_at).getTime()
            : 0,
        }))
        .sort((a, b) => b.lastUpdated - a.lastUpdated);
    } catch (error) {
      console.error('Error getting user sessions:', error);
      return [];
    }
  }

  // Update session in Supabase
  public async updateSession(
    session: StorySession,
  ): Promise<StorySession | null> {
    try {
      console.log('Updating session in Supabase:', session.id);

      const updateData = {
        story_content: session.story_content,
        words_written: session.words_written,
        sentences_completed: session.sentences_completed,
        final_score: session.final_score,
        xp_earned: session.xp_earned,
        completed_at: session.completed_at || (session.isCompleted ? new Date().toISOString() : null),
        generated_image_url: session.generated_image_url || null,
        image_generation_timestamp: session.image_generation_timestamp || null,
        image_generation_cost: session.image_generation_cost || null,
        // NEW: Story completion tracking
        current_round: session.current_round,
        // NEW: Image persistence fields
        supabase_image_url: session.supabase_image_url || null,
        image_upload_status: session.image_upload_status || null,
        image_upload_attempts: session.image_upload_attempts || 0,
        image_upload_error: session.image_upload_error || null,
      } as any;

      const { data: updatedSession, error } = await supabase
        .from('game_sessions')
        .update(updateData)
        .eq('id', session.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating session in Supabase:', error);
        // Still cache locally as fallback
        await this.cacheSessionLocally(session);
        return session;
      }

      const updatedDbSession = updatedSession as any;
      const updated: StorySession = {
        id: updatedDbSession.id,
        user_id: updatedDbSession.user_id,
        created_at: updatedDbSession.created_at,
        completed_at: updatedDbSession.completed_at,
        grade_level: updatedDbSession.grade_level,
        final_score: updatedDbSession.final_score || 0,
        words_written: updatedDbSession.words_written || 0,
        sentences_completed: updatedDbSession.sentences_completed || 0,
        challenges_completed: updatedDbSession.challenges_completed || 0,
        xp_earned: updatedDbSession.xp_earned || 0,
        story_content: updatedDbSession.story_content || '',
        generated_image_url: updatedDbSession.generated_image_url || undefined,
        image_generation_timestamp:
          updatedDbSession.image_generation_timestamp || undefined,
        image_generation_cost:
          updatedDbSession.image_generation_cost || undefined,
        local_image_path: session.local_image_path, // This is not stored in Supabase, only locally
        // NEW: Story completion tracking
        current_round: updatedDbSession.current_round || 1,
        // NEW: Image persistence fields
        supabase_image_url: updatedDbSession.supabase_image_url || undefined,
        image_upload_status: updatedDbSession.image_upload_status || undefined,
        image_upload_attempts: updatedDbSession.image_upload_attempts || undefined,
        image_upload_error: updatedDbSession.image_upload_error || undefined,
        isCompleted: !!updatedDbSession.completed_at,
        contributions: session.contributions,
        sessionStats: session.sessionStats,
        metadata: session.metadata,
      };

      // Cache locally for offline access
      await this.cacheSessionLocally(updated);

      return updated;
    } catch (error) {
      console.error('Failed to update session:', error);
      // Fallback to local cache
      await this.cacheSessionLocally(session);
      return session;
    }
  }

  // Complete a session
  public async completeSession(
    sessionId: string,
  ): Promise<StorySession | null> {
    const session = await this.getSession(sessionId);
    if (!session) return null;

    session.isCompleted = true;
    session.sessionStats.sessionDuration =
      Date.now() - new Date(session.created_at).getTime();

    // Update session in Supabase with completion
    const updatedSession = await this.updateSession(session);

    // Clear current session if this was the active one
    const currentSessionId = await AsyncStorage.getItem(
      this.CURRENT_SESSION_KEY,
    );
    if (currentSessionId === sessionId) {
      await AsyncStorage.removeItem(this.CURRENT_SESSION_KEY);
    }

    return updatedSession;
  }

  // Update session with generated image information
  public async updateSessionWithImage(
    sessionId: string,
    imageUrl: string,
    cost: number = 1000,
    localPath?: string,
  ): Promise<StorySession | null> {
    const session = await this.getSession(sessionId);
    if (!session) return null;

    // Update image generation fields
    session.generated_image_url = imageUrl;
    session.image_generation_timestamp = new Date().toISOString();
    session.image_generation_cost = cost;
    if (localPath) {
      session.local_image_path = localPath;
    }

    console.log('Updating session with image data:', {
      sessionId,
      imageUrl: imageUrl.substring(0, 50) + '...',
      cost,
      localPath,
    });

    // Update session in Supabase and local cache
    const updatedSession = await this.updateSession(session);
    return updatedSession;
  }

  // Update session with local image path after download
  public async updateSessionWithLocalImage(
    sessionId: string,
    localPath: string,
  ): Promise<StorySession | null> {
    const session = await this.getSession(sessionId);
    if (!session) return null;

    session.local_image_path = localPath;

    console.log('Updating session with local image path:', {
      sessionId,
      localPath,
    });

    // Update session in Supabase and local cache
    const updatedSession = await this.updateSession(session);
    return updatedSession;
  }

  // NEW: Update session with Supabase image upload status
  public async updateSessionWithSupabaseImage(
    sessionId: string,
    supabaseUrl: string,
    uploadStatus: 'pending' | 'uploaded' | 'failed',
    attempts: number = 0,
    error?: string,
  ): Promise<StorySession | null> {
    const session = await this.getSession(sessionId, true); // Preserve contributions
    if (!session) return null;

    session.supabase_image_url = uploadStatus === 'uploaded' ? supabaseUrl : session.supabase_image_url;
    session.image_upload_status = uploadStatus;
    session.image_upload_attempts = attempts;
    session.image_upload_error = error;

    console.log('📤 Updating session with Supabase upload status:', {
      sessionId,
      status: uploadStatus,
      attempts,
      hasError: !!error,
    });

    // Update session in Supabase and local cache
    const updatedSession = await this.updateSession(session);
    return updatedSession;
  }

  // Get session with image data
  public async getSessionWithImage(sessionId: string): Promise<{
    session: StorySession | null;
    hasGeneratedImage: boolean;
    hasLocalImage: boolean;
    imageUrl?: string;
    localImagePath?: string;
  }> {
    const session = await this.getSession(sessionId);

    if (!session) {
      return {
        session: null,
        hasGeneratedImage: false,
        hasLocalImage: false,
      };
    }

    return {
      session,
      hasGeneratedImage: !!session.generated_image_url,
      hasLocalImage: !!session.local_image_path,
      imageUrl: session.generated_image_url,
      localImagePath: session.local_image_path,
    };
  }

  // Resume a session (set as current)
  public async resumeSession(sessionId: string): Promise<StorySession | null> {
    const session = await this.getSession(sessionId);
    if (!session || session.isCompleted) return null;

    await this.setCurrentSession(sessionId);
    return session;
  }

  // Delete a session
  public async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const sessionsData = await AsyncStorage.getItem(this.SESSIONS_KEY);
      if (!sessionsData) return false;

      const sessions: Record<string, StorySession> = JSON.parse(sessionsData);
      delete sessions[sessionId];

      await AsyncStorage.setItem(this.SESSIONS_KEY, JSON.stringify(sessions));

      // Clear current session if this was the active one
      const currentSessionId = await AsyncStorage.getItem(
        this.CURRENT_SESSION_KEY,
      );
      if (currentSessionId === sessionId) {
        await AsyncStorage.removeItem(this.CURRENT_SESSION_KEY);
      }

      return true;
    } catch (error) {
      console.error('Error deleting session:', error);
      return false;
    }
  }

  // Export session for sharing
  public async exportSession(sessionId: string): Promise<string | null> {
    const session = await this.getSession(sessionId);
    if (!session) return null;

    const exportData = {
      title: this.generateSessionTitle(
        session.story_content || 'Untitled Story',
      ),
      story: session.story_content || '',
      gradeLevel: session.grade_level,
      stats: session.sessionStats,
      createdAt: new Date(session.created_at).toISOString(),
    };

    return `📖 ${exportData.title}\n\n${
      exportData.story
    }\n\n📊 Story Stats:\n• Grade Level: ${exportData.gradeLevel}\n• Words: ${
      exportData.stats.totalWords
    }\n• Duration: ${this.formatDuration(
      exportData.stats.sessionDuration,
    )}\n\n✨ Created with CreativeBridge`;
  }

  // Clear all sessions (for user logout or reset)
  public async clearAllSessions(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        this.SESSIONS_KEY,
        this.CURRENT_SESSION_KEY,
      ]);
    } catch (error) {
      console.error('Error clearing sessions:', error);
    }
  }

  // Get session statistics
  public async getSessionStats(userId: string): Promise<{
    totalSessions: number;
    completedSessions: number;
    totalWords: number;
    totalTime: number;
    averageSessionLength: number;
    favoriteGradeLevel: GradeLevel | null;
  }> {
    try {
      const sessionsData = await AsyncStorage.getItem(this.SESSIONS_KEY);
      if (!sessionsData) {
        return {
          totalSessions: 0,
          completedSessions: 0,
          totalWords: 0,
          totalTime: 0,
          averageSessionLength: 0,
          favoriteGradeLevel: null,
        };
      }

      const sessions: Record<string, StorySession> = JSON.parse(sessionsData);
      const userSessions = Object.values(sessions).filter(
        s => s.user_id === userId,
      );

      const totalSessions = userSessions.length;
      const completedSessions = userSessions.filter(s => s.isCompleted).length;
      const totalWords = userSessions.reduce(
        (sum, s) => sum + s.sessionStats.totalWords,
        0,
      );
      const totalTime = userSessions.reduce(
        (sum, s) => sum + s.sessionStats.sessionDuration,
        0,
      );
      const averageSessionLength =
        totalSessions > 0 ? totalTime / totalSessions : 0;

      // Find favorite grade level
      const gradeLevelCounts: Record<GradeLevel, number> = {
        'K-2': 0,
        '3-5': 0,
        '6-8': 0,
        '9-12': 0,
      };

      userSessions.forEach(session => {
        gradeLevelCounts[session.grade_level]++;
      });

      const favoriteGradeLevel = Object.entries(gradeLevelCounts).reduce(
        (max, [grade, count]) =>
          count > max.count ? { grade: grade as GradeLevel, count } : max,
        { grade: null as GradeLevel | null, count: 0 },
      ).grade;

      return {
        totalSessions,
        completedSessions,
        totalWords,
        totalTime,
        averageSessionLength,
        favoriteGradeLevel,
      };
    } catch (error) {
      console.error('Error getting session stats:', error);
      return {
        totalSessions: 0,
        completedSessions: 0,
        totalWords: 0,
        totalTime: 0,
        averageSessionLength: 0,
        favoriteGradeLevel: null,
      };
    }
  }

  // Private helper methods
  private async saveSession(session: StorySession): Promise<void> {
    try {
      const sessionsData = await AsyncStorage.getItem(this.SESSIONS_KEY);
      const sessions: Record<string, StorySession> = sessionsData
        ? JSON.parse(sessionsData)
        : {};

      sessions[session.id] = session;

      // Cleanup old sessions if we exceed the limit
      await this.cleanupOldSessions(sessions);

      await AsyncStorage.setItem(this.SESSIONS_KEY, JSON.stringify(sessions));
    } catch (error) {
      console.error('Error saving session:', error);
    }
  }

  // Cache session locally for offline access
  private async cacheSessionLocally(session: StorySession): Promise<void> {
    try {
      const sessionsData = await AsyncStorage.getItem(this.SESSIONS_KEY);
      const sessions: Record<string, StorySession> = sessionsData
        ? JSON.parse(sessionsData)
        : {};

      // NEW: Cache session with image URLs for offline viewing
      sessions[session.id] = {
        ...session,
        // Ensure image URLs are cached for offline access
        generated_image_url: session.generated_image_url,
        supabase_image_url: session.supabase_image_url, // Cache Supabase URL for offline viewing
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

  private async setCurrentSession(sessionId: string): Promise<void> {
    try {
      await AsyncStorage.setItem(this.CURRENT_SESSION_KEY, sessionId);
    } catch (error) {
      console.error('Error setting current session:', error);
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private countWords(text: string): number {
    return text
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0).length;
  }

  private buildCurrentStory(contributions: StoryContribution[]): string {
    return contributions.map(c => c.content.trim()).join(' ');
  }

  private generateSessionTitle(story: string): string {
    const words = story.trim().split(/\s+/).slice(0, 6);
    const title = words.join(' ');
    return title.length > 30 ? title.substring(0, 30) + '...' : title;
  }

  private formatDuration(milliseconds: number): string {
    const minutes = Math.floor(milliseconds / (1000 * 60));
    const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }

  private async cleanupOldSessions(
    sessions: Record<string, StorySession>,
  ): Promise<void> {
    const sessionList = Object.values(sessions);

    if (sessionList.length <= this.MAX_SESSIONS) return;

    // Sort by last updated (oldest first)
    sessionList.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

    // Remove oldest sessions until we're under the limit
    const sessionsToRemove = sessionList.length - this.MAX_SESSIONS;
    for (let i = 0; i < sessionsToRemove; i++) {
      delete sessions[sessionList[i].id];
    }
  }

  // NEW: In-memory cache helpers (BUG-567 performance optimization)
  /**
   * Get session from in-memory cache if available and not expired
   */
  private getFromCache(sessionId: string): StorySession | null {
    const cached = this.sessionCache.get(sessionId);
    if (!cached) return null;

    // Check if cache entry has expired
    const age = Date.now() - cached.timestamp;
    if (age > this.CACHE_TTL_MS) {
      this.sessionCache.delete(sessionId);
      return null;
    }

    return cached.session;
  }

  /**
   * Add session to in-memory cache
   */
  private addToCache(session: StorySession): void {
    // Enforce cache size limit (LRU eviction)
    if (this.sessionCache.size >= this.MAX_CACHE_SIZE) {
      // Find and remove oldest entry
      let oldestKey: string | null = null;
      let oldestTimestamp = Infinity;

      this.sessionCache.forEach((value, key) => {
        if (value.timestamp < oldestTimestamp) {
          oldestTimestamp = value.timestamp;
          oldestKey = key;
        }
      });

      if (oldestKey) {
        this.sessionCache.delete(oldestKey);
      }
    }

    // Add new entry to cache
    this.sessionCache.set(session.id, {
      session,
      timestamp: Date.now(),
    });
  }

  /**
   * Invalidate cache entry when session is updated
   */
  private invalidateCache(sessionId: string): void {
    this.sessionCache.delete(sessionId);
  }

  /**
   * Clear entire cache (useful for logout or memory pressure)
   */
  public clearCache(): void {
    this.sessionCache.clear();
    console.log('🧹 Session cache cleared');
  }
}

export const storySessionManager = new StorySessionManager();
export default StorySessionManager;
