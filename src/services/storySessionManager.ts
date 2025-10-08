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
      });

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
        completed_at: session.isCompleted ? new Date().toISOString() : null,
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

      sessions[session.id] = session;

      // Clean up old sessions if needed
      await this.cleanupOldSessions(sessions);

      await AsyncStorage.setItem(this.SESSIONS_KEY, JSON.stringify(sessions));
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
}

export const storySessionManager = new StorySessionManager();
export default StorySessionManager;
