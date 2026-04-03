// Story Session Management Service for CreativeBridge
// Handles story persistence, progress tracking, and session resumption
// Uses Convex as the primary database (US-013: Supabase fallbacks removed)
//
// Key Features:
// - Creates sessions in Convex gameSessions table
// - Updates sessions in real-time with story progress
// - Provides offline fallback with local caching (AsyncStorage)
// - Tracks word count, sentences, XP, and scores

import AsyncStorage from '@react-native-async-storage/async-storage';
import { GradeLevel, StorySource } from '../types';
import { ChallengeService } from './challengeService';
import { scoreInputQuality } from './inputQualityScorer';
import { piiScrubber } from './piiScrubber';

// Convex imports - primary database
import { getConvexClient, api, isConvexReady } from './convex';
import type { Doc, Id } from '../../convex/_generated/dataModel';

/**
 * Convert Convex game session to legacy StorySession format.
 * Maps camelCase Convex fields to snake_case legacy format.
 */
const convertConvexSessionToLegacy = (
  convexSession: Doc<'gameSessions'>,
): Omit<StorySession, 'contributions' | 'sessionStats' | 'metadata'> => ({
  id: convexSession._id,
  user_id: convexSession.clerkUserId, // Clerk ID for profile lookups
  created_at: new Date(convexSession._creationTime).toISOString(),
  completed_at: convexSession.completedAt,
  grade_level: convexSession.gradeLevel as GradeLevel,
  final_score: convexSession.finalScore,
  words_written: convexSession.wordsWritten,
  sentences_completed: convexSession.sentencesCompleted,
  challenges_completed: convexSession.challengesCompleted,
  xp_earned: convexSession.xpEarned,
  story_content: convexSession.storyContent,
  story_source: convexSession.storySource as StorySource,
  generated_image_url: convexSession.generatedImageUrl,
  image_generation_timestamp: convexSession.imageGenerationTimestamp,
  image_generation_cost: convexSession.imageGenerationCost,
  current_round: convexSession.currentRound,
  // Note: supabase_image_url maps to Convex storageId URL (handled separately)
  image_upload_status: convexSession.imageUploadStatus,
  image_upload_attempts: convexSession.imageUploadAttempts,
  image_upload_error: convexSession.imageUploadError,
  imported_story_content: convexSession.importedStoryContent,
  isCompleted: !!convexSession.completedAt,
});

export interface StoryContribution {
  type: 'user' | 'ai' | 'loaded';
  content: string;
  timestamp: number;
  wordCount: number;
}

// Extended StorySession that includes database fields and local enhancements
export interface StorySession {
  // Core GameSession fields
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

  // Story source tracking (for progress indicator visibility)
  story_source: StorySource;

  // Original imported content (for segmenting "Previously Written" in UI)
  imported_story_content?: string;

  // Image generation fields
  generated_image_url?: string;
  image_generation_timestamp?: string;
  image_generation_cost?: number;
  local_image_path?: string; // For downloaded images

  // NEW: Story completion tracking
  current_round: number; // 1-5, story completes at round 5

  // Image persistence fields (storage URL)
  supabase_image_url?: string;
  image_upload_status?: 'pending' | 'uploaded' | 'failed';
  image_upload_attempts?: number;
  image_upload_error?: string;

  // Server-reported milestone flags (from Convex completeGameSession)
  serverIsFirstStory?: boolean;
  serverIsFirstStreak?: boolean;

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
  private sessionCache: Map<
    string,
    { session: StorySession; timestamp: number }
  > = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache TTL
  private readonly MAX_CACHE_SIZE = 10; // Keep 10 most recent sessions in memory

  // Create a new story session (Convex only - US-013)
  public async createSession(
    userId: string,
    gradeLevel: GradeLevel,
    metadata?: Partial<StorySession['metadata']>,
  ): Promise<StorySession> {
    try {
      console.log('Creating new session');

      if (!isConvexReady()) {
        throw new Error('Convex is not ready');
      }

      const convexClient = getConvexClient();
      if (!convexClient) {
        throw new Error('Convex client not available');
      }

      console.log('📝 Creating session in Convex');
      const sessionId = await convexClient.mutation(
        api.gameSessions.createSession,
        {
          clerkUserId: userId,
          gradeLevel: gradeLevel,
          storyMetadata: metadata || {},
        },
      );
      const createdAt = new Date().toISOString();
      console.log('✅ Convex session created:', sessionId);

      // Convert to enhanced StorySession format
      const newSession: StorySession = {
        id: sessionId,
        user_id: userId,
        created_at: createdAt,
        grade_level: gradeLevel,
        final_score: 0,
        words_written: 0,
        sentences_completed: 0,
        challenges_completed: 0,
        xp_earned: 0,
        story_content: '',
        story_source: 'New',
        current_round: 1,
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
      await this.setCurrentSession(sessionId);

      console.log('Session created successfully:', sessionId);
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
    // CRITICAL FIX: Invalidate cache FIRST to prevent using stale data
    // This prevents duplicate content bugs where cached sessions contain already-appended content
    this.invalidateCache(sessionId);

    // Use existing session if provided to avoid losing contributions array
    // BUT: fetch fresh from DB if no existing session to ensure no stale story_content
    let session: StorySession | null;
    if (existingSession) {
      session = existingSession;
    } else {
      session = await this.getSession(sessionId, true); // preserveContributions=true
    }

    if (!session) return null;

    // US-008: Scrub PII from all contributions before storing.
    // User input is the primary vector, but AI responses are also scrubbed
    // as defense-in-depth in case the model echoes back PII from context.
    const scrubResult = piiScrubber.scrub(content);
    const cleanContent = scrubResult.text;
    if (scrubResult.redactionsCount > 0) {
      console.log(
        `🛡️ [PII] Scrubbed ${scrubResult.redactionsCount} PII item(s) from ${type} contribution:`,
        scrubResult.redactionTypes,
      );
    }

    const wordCount = this.countWords(cleanContent);
    const contribution: StoryContribution = {
      type,
      content: cleanContent,
      timestamp: Date.now(),
      wordCount,
    };

    // Ensure contributions array exists
    if (!session.contributions) {
      session.contributions = [];
    }
    session.contributions.push(contribution);

    // Update fields - append to existing story content instead of rebuilding
    if (session.story_content) {
      session.story_content = session.story_content + ' ' + cleanContent.trim();
    } else {
      session.story_content = this.buildCurrentStory(session.contributions);
    }
    // Only add to words_written if it's a user contribution
    if (type === 'user') {
      session.words_written += wordCount;
    }
    // US-005: Exclude 'loaded' contributions from sentences count —
    // they represent pre-existing story text, not new round contributions
    const activeContributions = session.contributions.filter(
      c => c.type !== 'loaded',
    );
    session.sentences_completed = activeContributions.length;

    // Story completion tracking — increment round when a PAIR completes.
    // A "round" = one pair of contributions (2 active entries), regardless of who goes first.
    // When AI starts: AI opens, User closes → round advances after User contributes.
    // When user starts: User opens, AI closes → round advances after AI contributes.
    // Round advances on every even-numbered active contribution (2nd, 4th, 6th, ...).
    const isPairComplete =
      activeContributions.length > 0 && activeContributions.length % 2 === 0;

    if (isPairComplete) {
      session.current_round = session.current_round + 1;
      console.log(
        `📊 [ROUND] Pair complete: ${activeContributions.length} active, round=${session.current_round}/${this.MAX_ROUNDS}`,
      );

      // Completion: game ends when round exceeds MAX_ROUNDS
      if (session.current_round > this.MAX_ROUNDS) {
        if (!session.isCompleted) {
          console.log(
            `🎉 Story completed after ${Math.floor(
              activeContributions.length / 2,
            )} rounds`,
          );
          session.isCompleted = true;
          session.completed_at = new Date().toISOString();

          // Calculate XP and score before updating statistics
          await this.calculateAndSetRewards(session);

          // Update user statistics in database and capture server's isFirstStory flag
          const statsResult = await this.updateUserStatisticsOnCompletion(
            session,
          );
          if (statsResult) {
            session.serverIsFirstStory = statsResult.isFirstStory;
            session.serverIsFirstStreak = statsResult.isFirstStreak;
          }
        }
        // Cap at MAX_ROUNDS for display
        session.current_round = this.MAX_ROUNDS;
      }
    } else {
      console.log(
        `📊 [ROUND] ${type} contribution: ${activeContributions.length} active, round=${session.current_round}/${this.MAX_ROUNDS} (waiting for pair)`,
      );
    }

    // Update local stats (US-005: exclude loaded contributions from count)
    session.sessionStats.contributionCount = session.contributions.filter(
      c => c.type !== 'loaded',
    ).length;
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

    // Update session in Convex
    const updatedSession = await this.updateSession(session);
    return updatedSession;
  }

  // Get a specific session (Convex with local cache fallback)
  public async getSession(
    sessionId: string,
    preserveContributions: boolean = false,
  ): Promise<StorySession | null> {
    try {
      // Check in-memory cache first (BUG-567 performance optimization)
      const cached = this.getFromCache(sessionId);
      if (cached && !preserveContributions) {
        console.log('✨ Session loaded from in-memory cache (fast path)');
        return cached;
      }

      console.log('Fetching session:', sessionId);

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

      let session: StorySession | null = null;

      // PRIMARY: Try Convex (US-013: Convex only)
      if (isConvexReady()) {
        const convexClient = getConvexClient();
        if (convexClient) {
          try {
            console.log('📖 Fetching session from Convex');
            const convexSession = await convexClient.query(
              api.gameSessions.getSession,
              { sessionId: sessionId as Id<'gameSessions'> },
            );

            if (convexSession) {
              console.log('✅ Session found in Convex');
              const baseSession = convertConvexSessionToLegacy(convexSession);
              session = {
                ...baseSession,
                contributions: existingContributions,
                sessionStats: {
                  userWords: 0,
                  aiWords: 0,
                  totalWords: 0,
                  sessionDuration: convexSession.completedAt
                    ? new Date(convexSession.completedAt).getTime() -
                      convexSession._creationTime
                    : Date.now() - convexSession._creationTime,
                  contributionCount: convexSession.sentencesCompleted || 0,
                },
                metadata: convexSession.storyMetadata || {},
              };
            }
          } catch (convexError) {
            console.warn(
              '⚠️ Convex query failed, falling back to local cache:',
              convexError,
            );
          }
        }
      }

      // FALLBACK: Try local cache if Convex didn't return a session
      if (!session) {
        console.log('📖 Checking local cache for session');
        const sessionsData = await AsyncStorage.getItem(this.SESSIONS_KEY);
        if (sessionsData) {
          const sessions: Record<string, StorySession> =
            JSON.parse(sessionsData);
          session = sessions[sessionId] || null;
        }
      }

      // If we have existing contributions, recalculate AI words properly
      if (existingContributions.length > 0 && session) {
        let userWords = 0;
        let aiWords = 0;

        existingContributions.forEach(contribution => {
          if (contribution.type === 'user') {
            userWords += contribution.wordCount;
          } else if (contribution.type === 'ai') {
            aiWords += contribution.wordCount;
          }
          // 'loaded' contributions are excluded from round word counts
        });

        session.sessionStats.userWords = userWords;
        session.sessionStats.aiWords = aiWords;
        session.sessionStats.totalWords = userWords + aiWords;
      }

      // US-002: Synthesize a 'loaded' contribution from story_content
      // when contributions array is empty but story_content exists.
      // This preserves the loaded story text in the UI after continuation.
      if (
        session &&
        (!session.contributions || session.contributions.length === 0) &&
        session.story_content &&
        session.story_content.trim().length > 0
      ) {
        const loadedWordCount = this.countWords(session.story_content);
        const loadedContribution: StoryContribution = {
          type: 'loaded',
          content: session.story_content,
          timestamp: new Date(session.created_at).getTime(),
          wordCount: loadedWordCount,
        };
        session.contributions = [loadedContribution];
        console.log('📖 Synthesized loaded contribution from story_content:', {
          wordCount: loadedWordCount,
          contentLength: session.story_content.length,
        });
      }

      if (session) {
        console.log('Session loaded:', {
          id: session.id,
          hasStoryContent: !!session.story_content,
          storyContentLength: session.story_content?.length || 0,
          storyPreview: session.story_content?.substring(0, 100) + '...',
          userWords: session.sessionStats.userWords,
          aiWords: session.sessionStats.aiWords,
          generated_image_url: session.generated_image_url,
          hasGeneratedImageUrl: !!session.generated_image_url,
        });

        // Add to in-memory cache for faster subsequent access
        this.addToCache(session);
      }

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

  // Get all sessions for a user (Convex only - US-013)
  public async getUserSessions(userId: string): Promise<SessionSummary[]> {
    try {
      console.log('Fetching user sessions');

      if (!isConvexReady()) {
        console.warn('⚠️ Convex not ready, returning empty sessions');
        return [];
      }

      const convexClient = getConvexClient();
      if (!convexClient) {
        console.warn(
          '⚠️ Convex client not available, returning empty sessions',
        );
        return [];
      }

      console.log('📖 Fetching sessions from Convex');
      const result = await convexClient.query(
        api.gameSessions.getUserSessions,
        { limit: 100 },
      );

      if (result && result.sessions) {
        console.log(`✅ Found ${result.sessions.length} sessions in Convex`);
        return result.sessions
          .map(session => ({
            id: session._id,
            title: this.generateSessionTitle(
              session.storyContent || 'Untitled Story',
            ),
            gradeLevel: session.gradeLevel as GradeLevel,
            lastUpdated: session.completedAt
              ? new Date(session.completedAt).getTime()
              : session._creationTime,
            isCompleted: !!session.completedAt,
            wordCount: session.wordsWritten,
            duration: session.completedAt
              ? new Date(session.completedAt).getTime() - session._creationTime
              : 0,
          }))
          .sort((a, b) => b.lastUpdated - a.lastUpdated);
      }

      return [];
    } catch (error) {
      console.error('Error getting user sessions:', error);
      return [];
    }
  }

  // Update session (Convex only - US-013)
  public async updateSession(
    session: StorySession,
  ): Promise<StorySession | null> {
    try {
      console.log('Updating session:', session.id);

      // Prepare update data for Convex
      // Note: xpEarned and finalScore are intentionally omitted here (R-4.4)
      // — only completeSession may set those fields server-side.
      const convexUpdateData = {
        storyContent: session.story_content,
        wordsWritten: Math.round(session.words_written),
        sentencesCompleted: Math.round(session.sentences_completed),
        challengesCompleted: Math.round(session.challenges_completed || 0),
        currentRound: Math.round(session.current_round),
        storyMetadata: session.metadata || {},
      };

      // Update in Convex
      if (isConvexReady()) {
        const convexClient = getConvexClient();
        if (convexClient) {
          try {
            console.log('📝 Updating session in Convex');
            await convexClient.mutation(api.gameSessions.updateSession, {
              sessionId: session.id as Id<'gameSessions'>,
              updates: convexUpdateData,
            });
            console.log('✅ Convex session update successful');
          } catch (convexError) {
            console.error(
              '❌ Convex update failed, caching locally:',
              convexError,
            );
            await this.cacheSessionLocally(session);
            this.addToCache(session);
            return session;
          }
        }
      }

      // Build updated session object
      const updated: StorySession = {
        id: session.id,
        user_id: session.user_id,
        created_at: session.created_at,
        completed_at:
          session.completed_at ||
          (session.isCompleted ? new Date().toISOString() : undefined),
        grade_level: session.grade_level,
        final_score: Math.round(session.final_score),
        words_written: Math.round(session.words_written),
        sentences_completed: Math.round(session.sentences_completed),
        challenges_completed: Math.round(session.challenges_completed || 0),
        xp_earned: Math.round(session.xp_earned),
        story_content: session.story_content || '',
        story_source: session.story_source || 'New',
        generated_image_url: session.generated_image_url,
        image_generation_timestamp: session.image_generation_timestamp,
        image_generation_cost: session.image_generation_cost,
        local_image_path: session.local_image_path,
        current_round: Math.round(session.current_round),
        supabase_image_url: session.supabase_image_url,
        image_upload_status: session.image_upload_status,
        image_upload_attempts: session.image_upload_attempts,
        image_upload_error: session.image_upload_error,
        isCompleted: session.isCompleted || !!session.completed_at,
        contributions: session.contributions,
        sessionStats: session.sessionStats,
        metadata: session.metadata,
      };

      // Cache locally for offline access
      await this.cacheSessionLocally(updated);

      // Add fresh session to cache
      this.addToCache(updated);

      return updated;
    } catch (error) {
      console.error('Failed to update session:', error);
      // Persist pending update to AsyncStorage WAL for later retry (R-4.2)
      try {
        const walKey = `wal_session_update_${session.id}_${Date.now()}`;
        await AsyncStorage.setItem(walKey, JSON.stringify(session));
      } catch (walError) {
        console.error('Failed to write session update WAL entry:', walError);
      }
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

    // Update session in Convex with completion
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

  // Update session with generated image information (Convex PRIMARY)
  public async updateSessionWithImage(
    sessionId: string,
    imageUrl: string,
    cost: number = 1000,
    localPath?: string,
  ): Promise<StorySession | null> {
    const session = await this.getSession(sessionId);
    if (!session) return null;

    console.log('Updating session with image data:', {
      sessionId,
      imageUrl: imageUrl.substring(0, 50) + '...',
      cost,
      localPath,
    });

    // Update image in Convex using dedicated mutation
    if (isConvexReady()) {
      const convexClient = getConvexClient();
      if (convexClient) {
        try {
          console.log('📸 Updating image in Convex');
          await convexClient.mutation(
            api.gameSessions.updateStoryGeneratedImage,
            {
              sessionId: sessionId as Id<'gameSessions'>,
              imageUrl: imageUrl,
              generationCost: cost,
            },
          );
          console.log('✅ Convex image update successful');
        } catch (convexError) {
          console.warn('⚠️ Convex image update failed:', convexError);
          // Fall through to regular update
        }
      }
    }

    // Update local session object
    session.generated_image_url = imageUrl;
    session.image_generation_timestamp = new Date().toISOString();
    session.image_generation_cost = cost;
    if (localPath) {
      session.local_image_path = localPath;
    }

    // Update session in Convex and cache
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

    // Update session in Convex and local cache
    const updatedSession = await this.updateSession(session);
    return updatedSession;
  }

  // Update session with image upload status (Convex only - US-013)
  public async updateSessionWithSupabaseImage(
    sessionId: string,
    supabaseUrl: string,
    uploadStatus: 'pending' | 'uploaded' | 'failed',
    attempts: number = 0,
    error?: string,
  ): Promise<StorySession | null> {
    const session = await this.getSession(sessionId, true); // Preserve contributions
    if (!session) return null;

    console.log('📤 Updating session with image upload status:', {
      sessionId,
      status: uploadStatus,
      attempts,
      hasError: !!error,
    });

    // Update upload status in Convex
    if (isConvexReady()) {
      const convexClient = getConvexClient();
      if (convexClient) {
        try {
          console.log('📤 Updating upload status in Convex');
          await convexClient.mutation(
            api.gameSessions.updateImageUploadStatus,
            {
              sessionId: sessionId as Id<'gameSessions'>,
              status: uploadStatus,
              error: error,
            },
          );
          console.log('✅ Convex upload status update successful');
        } catch (convexError) {
          console.warn('⚠️ Convex upload status update failed:', convexError);
          // Fall through to regular update
        }
      }
    }

    // Update local session object
    session.supabase_image_url =
      uploadStatus === 'uploaded' ? supabaseUrl : session.supabase_image_url;
    session.image_upload_status = uploadStatus;
    session.image_upload_attempts = attempts;
    session.image_upload_error = error;

    // Update session in Convex
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
        supabase_image_url: session.supabase_image_url, // Cache storage URL for offline viewing
        image_upload_status: session.image_upload_status,
      };

      // Clean up old sessions if needed
      await this.cleanupOldSessions(sessions);

      await AsyncStorage.setItem(this.SESSIONS_KEY, JSON.stringify(sessions));
      console.log(
        '📦 Session cached locally with image URLs for offline access',
      );
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

  /**
   * Calculate XP rewards and final score for a completed story
   * Sets xp_earned and final_score on the session object
   */
  private async calculateAndSetRewards(session: StorySession): Promise<void> {
    try {
      const challengeService = ChallengeService.getInstance();

      // Calculate session duration in minutes
      const startTime = new Date(session.created_at).getTime();
      const endTime = new Date(session.completed_at || Date.now()).getTime();
      const durationMinutes = (endTime - startTime) / (1000 * 60);

      // Compute input quality score from user contributions
      const userContributions = session.contributions
        .filter(c => c.type === 'user')
        .map(c => c.content);
      const qualityScore = scoreInputQuality(
        userContributions,
        session.grade_level,
      );

      // Calculate XP rewards based on session data
      // Note: We don't have detailed challenge progress, so we estimate based on challenges_completed count
      const estimatedChallengeProgress = Array(
        session.challenges_completed,
      ).fill({
        challengeId: 'completed',
        xpEarned: 50, // Standard challenge XP
        isCompleted: true,
      });

      const xpRewards = challengeService.calculateXPRewards(
        session.words_written,
        estimatedChallengeProgress as any,
        durationMinutes,
        true, // story is completed
        qualityScore,
      );

      // Sum up total XP
      const totalXP = challengeService.getTotalXP(xpRewards);
      session.xp_earned = Math.floor(totalXP); // Ensure integer for database

      // Calculate final score based on:
      // - Base score: word count (1 point per word)
      // - Challenge bonuses: completed challenges (50 points each)
      // - Completion bonus: 100 points
      const baseScore = session.words_written;
      const challengeBonus = session.challenges_completed * 50;
      const completionBonus = 100;
      session.final_score = Math.floor(
        baseScore + challengeBonus + completionBonus,
      );

      console.log('💰 Calculated rewards:', {
        xpEarned: session.xp_earned,
        finalScore: session.final_score,
        wordsWritten: session.words_written,
        challengesCompleted: session.challenges_completed,
        duration: `${durationMinutes.toFixed(1)} minutes`,
        qualityScore,
      });
    } catch (error) {
      console.error('Failed to calculate rewards:', error);
      // Set default values if calculation fails
      // IMPORTANT: Floor all values to ensure integers for database
      session.xp_earned = Math.floor(session.words_written * 2); // Fallback: 2 XP per word
      session.final_score = Math.floor(session.words_written + 100); // Fallback: words + completion bonus
    }
  }

  /**
   * Update user statistics when a story is completed (Convex only - US-013)
   */
  private async updateUserStatisticsOnCompletion(
    session: StorySession,
  ): Promise<{ isFirstStory: boolean; isFirstStreak: boolean } | null> {
    try {
      console.log('📊 Updating user statistics for completed story:', {
        sessionId: session.id,
        userId: session.user_id,
        xpEarned: session.xp_earned,
        wordsWritten: session.words_written,
        finalScore: session.final_score,
      });

      if (!isConvexReady()) {
        console.warn('⚠️ Convex not ready, cannot update user statistics');
        return null;
      }

      const convexClient = getConvexClient();
      if (!convexClient) {
        console.warn(
          '⚠️ Convex client not available, cannot update user statistics',
        );
        return null;
      }

      console.log('📊 Updating user statistics via Convex');
      const result = await convexClient.mutation(
        api.userProfiles.completeGameSession,
        {
          clerkUserId: session.user_id,
          sessionId: session.id,
          xpEarned: Math.floor(session.xp_earned || 0),
          wordsWritten: Math.floor(session.words_written || 0),
          finalScore: Math.floor(session.final_score || 0),
        },
      );
      console.log('✅ Convex user statistics updated:', result);
      return {
        isFirstStory: !!result?.isFirstStory,
        isFirstStreak: !!result?.isFirstStreak,
      };
    } catch (error) {
      console.error('💥 Exception updating user statistics:', error);
      // Non-blocking error - stats update failure shouldn't prevent story completion
      return null;
    }
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
   * Clear cached contributions for a specific session so that the
   * `loaded` contribution is re-synthesized from the latest storyContent
   * on the next continuation.
   */
  public async clearCachedContributions(sessionId: string): Promise<void> {
    try {
      const sessionsData = await AsyncStorage.getItem(this.SESSIONS_KEY);
      if (sessionsData) {
        const sessions: Record<string, StorySession> = JSON.parse(sessionsData);
        if (sessions[sessionId]) {
          sessions[sessionId].contributions = [];
          await AsyncStorage.setItem(
            this.SESSIONS_KEY,
            JSON.stringify(sessions),
          );
        }
      }
      this.invalidateCache(sessionId);
    } catch (error) {
      console.error('Error clearing cached contributions:', error);
    }
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
