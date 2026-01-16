/**
 * User Preferences Service
 *
 * Cross-session personalization system with privacy-compliant behavior tracking
 * Task 3.3: Cross-Session Personalization
 */

import { secureStorage } from '../utils/secureStorage';
import { structuredLogger } from '../utils/logger';
import { GradeLevel } from '../types/database';
// import { StoryRequest, StoryResponse } from '../types/story';

// User behavior tracking interfaces
export interface UserInteraction {
  id: string;
  type:
    | 'story_request'
    | 'story_completion'
    | 'story_rating'
    | 'theme_selection'
    | 'session_duration';
  timestamp: number;
  gradeLevel: GradeLevel;
  context: Record<string, any>;
  anonymized: boolean;
}

export interface StoryPreference {
  themes: Record<string, number>; // theme -> preference score (0-1)
  characters: Record<string, number>; // character type -> preference score
  settings: Record<string, number>; // setting type -> preference score
  tones: Record<string, number>; // tone -> preference score
  complexity: Record<string, number>; // complexity level -> preference score
  genres: Record<string, number>; // genre -> preference score
}

export interface SessionPattern {
  averageSessionDuration: number;
  storiesPerSession: number;
  preferredTimeOfDay: string[];
  completionRate: number;
  retryPattern: number;
  engagementScore: number;
}

export interface LearningMetrics {
  improvementTrend: number; // -1 to 1, negative means declining
  consistencyScore: number; // 0 to 1, how consistent preferences are
  explorationScore: number; // 0 to 1, how much user explores new content
  lastUpdated: number;
  sessionCount: number;
}

export interface PersonalizationData {
  userId: string; // Anonymous hash, not PII
  gradeLevel: GradeLevel;
  storyPreferences: StoryPreference;
  sessionPatterns: SessionPattern;
  learningMetrics: LearningMetrics;
  interactions: UserInteraction[];
  qualityPreferences: {
    preferredQualityLevel: number; // 0-1 scale, how strict quality should be
    adaptiveThresholdsEnabled: boolean;
    qualityFeedbackHistory: Array<{
      timestamp: number;
      contentScore: number;
      userSatisfaction: number;
      engagementLevel: number;
    }>;
  };
  version: string;
  createdAt: number;
  updatedAt: number;
}

interface UserPreferencesConfig {
  maxInteractionHistory: number;
  learningRate: number;
  decayRate: number;
  minSessionsForPersonalization: number;
  privacyMode: boolean;
  dataRetentionDays: number;
}

const DEFAULT_CONFIG: UserPreferencesConfig = {
  maxInteractionHistory: 1000,
  learningRate: 0.1,
  decayRate: 0.95, // Decay rate for older preferences
  minSessionsForPersonalization: 3,
  privacyMode: true,
  dataRetentionDays: 30,
};

const STORAGE_KEYS = {
  PERSONALIZATION_DATA: 'user_personalization_data',
  PRIVACY_CONSENT: 'privacy_consent',
  LEARNING_ENABLED: 'learning_enabled',
} as const;

class UserPreferencesService {
  private config: UserPreferencesConfig;
  private personalizationData: PersonalizationData | null = null;
  private isInitialized = false;

  constructor(config: Partial<UserPreferencesConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the preferences service
   */
  async initialize(
    gradeLevel: GradeLevel,
    anonymousUserId?: string,
  ): Promise<void> {
    try {
      // Generate anonymous user ID if not provided
      const userId = anonymousUserId || (await this.generateAnonymousUserId());

      // Check privacy consent
      const hasConsent = await this.hasPrivacyConsent();
      if (!hasConsent && this.config.privacyMode) {
        structuredLogger.info(
          'Privacy consent not given, running in minimal mode',
        );
        await this.initializeMinimalMode(userId, gradeLevel);
        return;
      }

      // Load existing personalization data
      const existing = await secureStorage.get<PersonalizationData>(
        STORAGE_KEYS.PERSONALIZATION_DATA,
      );

      if (existing && this.isDataValid(existing)) {
        this.personalizationData = existing;
        // Update grade level if changed
        if (this.personalizationData.gradeLevel !== gradeLevel) {
          this.personalizationData.gradeLevel = gradeLevel;
          await this.savePersonalizationData();
        }
        structuredLogger.info('Personalization data loaded', {
          sessionCount: this.personalizationData.learningMetrics.sessionCount,
          gradeLevel: this.personalizationData.gradeLevel,
          interactionCount: this.personalizationData.interactions.length,
        });
      } else {
        // Initialize new personalization data
        this.personalizationData = this.createInitialPersonalizationData(
          userId,
          gradeLevel,
        );
        await this.savePersonalizationData();
        structuredLogger.info('New personalization data initialized', {
          userId: this.hashUserId(userId),
          gradeLevel,
        });
      }

      this.isInitialized = true;

      // Start background cleanup
      this.scheduleCleanup();
    } catch (error) {
      structuredLogger.error(
        'Failed to initialize user preferences',
        {},
        error as Error,
      );
      // Fallback to minimal mode
      await this.initializeMinimalMode(
        anonymousUserId || 'fallback',
        gradeLevel,
      );
    }
  }

  /**
   * Initialize in minimal mode (no personalization)
   */
  private async initializeMinimalMode(
    userId: string,
    gradeLevel: GradeLevel,
  ): Promise<void> {
    this.personalizationData = this.createInitialPersonalizationData(
      userId,
      gradeLevel,
    );
    // In minimal mode, interactions are never stored
    this.isInitialized = true;
  }

  /**
   * Check if user has given privacy consent
   */
  async hasPrivacyConsent(): Promise<boolean> {
    const consent = await secureStorage.get<boolean>(
      STORAGE_KEYS.PRIVACY_CONSENT,
    );
    return consent === true;
  }

  /**
   * Set privacy consent
   */
  async setPrivacyConsent(consent: boolean): Promise<void> {
    await secureStorage.set(STORAGE_KEYS.PRIVACY_CONSENT, consent);

    if (!consent) {
      // Clear all personalization data if consent is revoked
      await this.resetPersonalizationData();
    }

    structuredLogger.info('Privacy consent updated', { consent });
  }

  /**
   * Generate anonymous user ID
   */
  private async generateAnonymousUserId(): Promise<string> {
    // Use device-specific but non-personally identifiable data
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2);
    const combined = `${timestamp}-${random}`;

    // Hash the combined string for anonymity
    return this.hashUserId(combined);
  }

  /**
   * Hash user ID for privacy
   */
  private hashUserId(userId: string): string {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    const hashStr = Math.abs(hash).toString(36);
    // Ensure exactly 12 characters by padding or truncating
    return hashStr.padEnd(12, '0').substring(0, 12);
  }

  /**
   * Record a user interaction
   */
  async recordInteraction(
    type: UserInteraction['type'],
    context: Record<string, any>,
  ): Promise<void> {
    if (!this.isInitialized || !this.personalizationData) {
      await this.initialize(context.gradeLevel || 'Grade3');
    }

    if (!this.personalizationData) return;

    // Check if we have privacy consent
    const hasConsent = await this.hasPrivacyConsent();
    if (!hasConsent && this.config.privacyMode) {
      // In minimal mode, don't record interactions
      return;
    }

    const interaction: UserInteraction = {
      id: this.generateInteractionId(),
      type,
      timestamp: Date.now(),
      gradeLevel: this.personalizationData.gradeLevel,
      context: this.anonymizeContext(context),
      anonymized: true,
    };

    // Add interaction to history
    this.personalizationData.interactions.push(interaction);

    // Keep only recent interactions
    if (
      this.personalizationData.interactions.length >
      this.config.maxInteractionHistory
    ) {
      this.personalizationData.interactions =
        this.personalizationData.interactions.slice(
          -this.config.maxInteractionHistory,
        );
    }

    // Update preferences based on interaction
    await this.updatePreferencesFromInteraction(interaction);

    // Save updated data
    await this.savePersonalizationData();

    structuredLogger.debug('User interaction recorded', {
      type,
      gradeLevel: this.personalizationData.gradeLevel,
      totalInteractions: this.personalizationData.interactions.length,
    });
  }

  /**
   * Get personalized story recommendations
   */
  getPersonalizedRecommendations(request: StoryRequest): {
    recommendedThemes: string[];
    recommendedComplexity: string;
    confidenceScore: number;
  } {
    if (
      !this.isInitialized ||
      !this.personalizationData ||
      this.personalizationData.learningMetrics.sessionCount <
        this.config.minSessionsForPersonalization
    ) {
      return {
        recommendedThemes: ['adventure', 'friendship', 'discovery'],
        recommendedComplexity: 'medium',
        confidenceScore: 0.1,
      };
    }

    const prefs = this.personalizationData.storyPreferences;

    // Get top themes
    const themeEntries = Object.entries(prefs.themes);
    const topThemes = themeEntries
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([theme]) => theme);

    // Get preferred complexity
    const complexityEntries = Object.entries(prefs.complexity);
    const preferredComplexity =
      complexityEntries.length > 0
        ? complexityEntries.reduce((max, curr) =>
            curr[1] > max[1] ? curr : max,
          )[0]
        : 'medium';

    // Calculate confidence based on data quality
    const confidenceScore = this.calculateRecommendationConfidence();

    return {
      recommendedThemes:
        topThemes.length > 0
          ? topThemes
          : ['adventure', 'friendship', 'discovery'],
      recommendedComplexity: preferredComplexity,
      confidenceScore,
    };
  }

  /**
   * Record quality feedback for adaptive thresholds
   */
  async recordQualityFeedback(
    contentScore: number,
    userSatisfaction: number,
    engagementLevel: number,
  ): Promise<void> {
    if (!this.personalizationData) return;

    const qualityFeedback = {
      timestamp: Date.now(),
      contentScore,
      userSatisfaction,
      engagementLevel,
    };

    this.personalizationData.qualityPreferences.qualityFeedbackHistory.push(
      qualityFeedback,
    );

    // Keep only recent feedback (last 100 entries)
    if (
      this.personalizationData.qualityPreferences.qualityFeedbackHistory
        .length > 100
    ) {
      this.personalizationData.qualityPreferences.qualityFeedbackHistory =
        this.personalizationData.qualityPreferences.qualityFeedbackHistory.slice(
          -100,
        );
    }

    // Update preferred quality level based on feedback
    await this.updatePreferredQualityLevel();

    await this.savePersonalizationData();
  }

  /**
   * Get user's quality preferences for adaptive thresholds
   */
  getQualityPreferences(): {
    preferredQualityLevel: number;
    adaptiveThresholdsEnabled: boolean;
    userId: string;
  } | null {
    if (!this.personalizationData) return null;

    return {
      preferredQualityLevel:
        this.personalizationData.qualityPreferences.preferredQualityLevel,
      adaptiveThresholdsEnabled:
        this.personalizationData.qualityPreferences.adaptiveThresholdsEnabled,
      userId: this.personalizationData.userId,
    };
  }

  /**
   * Enable or disable adaptive quality thresholds
   */
  async setAdaptiveThresholdsEnabled(enabled: boolean): Promise<void> {
    if (!this.personalizationData) return;

    this.personalizationData.qualityPreferences.adaptiveThresholdsEnabled =
      enabled;
    await this.savePersonalizationData();

    structuredLogger.info('Adaptive quality thresholds setting updated', {
      enabled,
      userId: this.personalizationData.userId.substring(0, 8) + '***',
    });
  }

  /**
   * Update preferences based on story feedback
   */
  async updatePreferencesFromStoryFeedback(
    request: StoryRequest,
    response: StoryResponse,
    rating: number, // 0-5 scale
  ): Promise<void> {
    if (!this.personalizationData) return;

    const normalizedRating = rating / 5; // Normalize to 0-1
    const learningRate = this.config.learningRate;

    // Extract themes from the story request context
    const themes = this.extractThemesFromRequest(request);
    const complexity = this.extractComplexityFromRequest(request);
    const tone = this.extractToneFromResponse(response);

    // Update theme preferences
    themes.forEach(theme => {
      const current =
        this.personalizationData!.storyPreferences.themes[theme] || 0.5;
      this.personalizationData!.storyPreferences.themes[theme] =
        current + learningRate * (normalizedRating - current);
    });

    // Update complexity preferences
    if (complexity) {
      const current =
        this.personalizationData.storyPreferences.complexity[complexity] || 0.5;
      this.personalizationData.storyPreferences.complexity[complexity] =
        current + learningRate * (normalizedRating - current);
    }

    // Update tone preferences
    if (tone) {
      const current =
        this.personalizationData.storyPreferences.tones[tone] || 0.5;
      this.personalizationData.storyPreferences.tones[tone] =
        current + learningRate * (normalizedRating - current);
    }

    // Update learning metrics
    this.updateLearningMetrics(normalizedRating);

    // Record the interaction
    await this.recordInteraction('story_rating', {
      gradeLevel: request.gradeLevel,
      themes,
      complexity,
      tone,
      rating,
      storyLength: response.story.length,
    });

    await this.savePersonalizationData();
  }

  /**
   * Apply temporal decay to preferences
   */
  private applyTemporalDecay(): void {
    if (!this.personalizationData) return;

    const decayRate = this.config.decayRate;
    const prefs = this.personalizationData.storyPreferences;

    // Decay all preference scores slightly over time
    Object.keys(prefs.themes).forEach(theme => {
      prefs.themes[theme] *= decayRate;
    });

    Object.keys(prefs.characters).forEach(character => {
      prefs.characters[character] *= decayRate;
    });

    Object.keys(prefs.settings).forEach(setting => {
      prefs.settings[setting] *= decayRate;
    });

    Object.keys(prefs.tones).forEach(tone => {
      prefs.tones[tone] *= decayRate;
    });

    Object.keys(prefs.complexity).forEach(complexity => {
      prefs.complexity[complexity] *= decayRate;
    });
  }

  /**
   * Get user preferences data for debugging/analysis
   */
  getPreferencesData(): PersonalizationData | null {
    return this.personalizationData;
  }

  /**
   * Reset all personalization data
   */
  async resetPersonalizationData(): Promise<void> {
    try {
      await secureStorage.remove(STORAGE_KEYS.PERSONALIZATION_DATA);
      this.personalizationData = null;
      this.isInitialized = false;

      structuredLogger.info('Personalization data reset');
    } catch (error) {
      structuredLogger.error(
        'Failed to reset personalization data',
        {},
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Export user data for privacy compliance
   */
  async exportUserData(): Promise<string> {
    if (!this.personalizationData) {
      return JSON.stringify({ message: 'No personalization data available' });
    }

    // Remove any potentially sensitive information
    const exportData = {
      gradeLevel: this.personalizationData.gradeLevel,
      preferences: this.personalizationData.storyPreferences,
      learningMetrics: this.personalizationData.learningMetrics,
      sessionCount: this.personalizationData.learningMetrics.sessionCount,
      createdAt: new Date(this.personalizationData.createdAt).toISOString(),
      updatedAt: new Date(this.personalizationData.updatedAt).toISOString(),
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Helper methods
   */
  private createInitialPersonalizationData(
    userId: string,
    gradeLevel: GradeLevel,
  ): PersonalizationData {
    return {
      userId: this.hashUserId(userId),
      gradeLevel,
      storyPreferences: {
        themes: {},
        characters: {},
        settings: {},
        tones: {},
        complexity: {},
        genres: {},
      },
      sessionPatterns: {
        averageSessionDuration: 0,
        storiesPerSession: 0,
        preferredTimeOfDay: [],
        completionRate: 0,
        retryPattern: 0,
        engagementScore: 0.5,
      },
      learningMetrics: {
        improvementTrend: 0,
        consistencyScore: 0.5,
        explorationScore: 0.5,
        lastUpdated: Date.now(),
        sessionCount: 0,
      },
      qualityPreferences: {
        preferredQualityLevel: 0.5,
        adaptiveThresholdsEnabled: true,
        qualityFeedbackHistory: [],
      },
      interactions: [],
      version: '1.0',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  private isDataValid(data: PersonalizationData): boolean {
    try {
      const maxAge = this.config.dataRetentionDays * 24 * 60 * 60 * 1000;
      const validGradeLevels = ['K-2', '3-5', '6-8', '9-12'];

      return (
        data.version === '1.0' &&
        data.userId &&
        typeof data.userId === 'string' &&
        data.userId.length > 0 &&
        data.gradeLevel &&
        validGradeLevels.includes(data.gradeLevel) &&
        data.storyPreferences &&
        data.learningMetrics &&
        data.sessionPatterns &&
        data.qualityPreferences &&
        typeof data.qualityPreferences.adaptiveThresholdsEnabled ===
          'boolean' &&
        Date.now() - data.updatedAt < maxAge
      );
    } catch (error) {
      return false;
    }
  }

  private async savePersonalizationData(): Promise<void> {
    if (!this.personalizationData) return;

    this.personalizationData.updatedAt = Date.now();

    // Apply temporal decay before saving
    this.applyTemporalDecay();

    await secureStorage.set(
      STORAGE_KEYS.PERSONALIZATION_DATA,
      this.personalizationData,
    );
  }

  private generateInteractionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2)}`;
  }

  private anonymizeContext(context: Record<string, any>): Record<string, any> {
    // Remove any potentially identifying information by destructuring them out
    const {
      userInput,
      userEmail, // eslint-disable-line @typescript-eslint/no-unused-vars
      phoneNumber, // eslint-disable-line @typescript-eslint/no-unused-vars
      fullName, // eslint-disable-line @typescript-eslint/no-unused-vars
      userLocation, // eslint-disable-line @typescript-eslint/no-unused-vars
      deviceId, // eslint-disable-line @typescript-eslint/no-unused-vars
      ipAddress, // eslint-disable-line @typescript-eslint/no-unused-vars
      sessionId, // eslint-disable-line @typescript-eslint/no-unused-vars
      sensitiveData, // eslint-disable-line @typescript-eslint/no-unused-vars
      maliciousScript, // eslint-disable-line @typescript-eslint/no-unused-vars
      sqlInjection, // eslint-disable-line @typescript-eslint/no-unused-vars
      hugeString, // eslint-disable-line @typescript-eslint/no-unused-vars
      circularRef, // eslint-disable-line @typescript-eslint/no-unused-vars
      ...safeContext
    } = context;

    return {
      gradeLevel: safeContext.gradeLevel,
      // Keep only non-PII information
      hasUserInput: !!userInput,
      userInputLength:
        typeof userInput === 'string' ? Math.min(userInput.length, 1000) : 0, // Cap length
      timestamp: Date.now(),
    };
  }

  private async updatePreferencesFromInteraction(
    interaction: UserInteraction,
  ): Promise<void> {
    if (!this.personalizationData) return;

    // Update session patterns and learning metrics based on interaction type
    switch (interaction.type) {
      case 'story_request':
        this.personalizationData.learningMetrics.sessionCount++;
        break;
      case 'story_completion':
        this.updateSessionPatterns(interaction);
        break;
      case 'theme_selection':
        this.updateThemePreferences(interaction);
        break;
    }

    this.personalizationData.learningMetrics.lastUpdated = Date.now();
  }

  private updateSessionPatterns(_interaction: UserInteraction): void {
    if (!this.personalizationData) return;

    // Update completion rate
    const completions = this.personalizationData.interactions.filter(
      i => i.type === 'story_completion',
    ).length;
    const requests = this.personalizationData.interactions.filter(
      i => i.type === 'story_request',
    ).length;

    if (requests > 0) {
      this.personalizationData.sessionPatterns.completionRate =
        completions / requests;
    }

    // Update engagement score based on completion patterns
    const recentCompletions = this.personalizationData.interactions.filter(
      i =>
        i.type === 'story_completion' &&
        Date.now() - i.timestamp < 7 * 24 * 60 * 60 * 1000,
    ).length;

    this.personalizationData.sessionPatterns.engagementScore = Math.min(
      recentCompletions / 10,
      1,
    );
  }

  private updateThemePreferences(interaction: UserInteraction): void {
    if (!this.personalizationData) return;

    const theme = interaction.context.theme;
    if (typeof theme === 'string') {
      const current =
        this.personalizationData.storyPreferences.themes[theme] || 0.5;
      this.personalizationData.storyPreferences.themes[theme] = Math.min(
        current + this.config.learningRate,
        1,
      );
    }
  }

  private updateLearningMetrics(_rating: number): void {
    if (!this.personalizationData) return;

    const metrics = this.personalizationData.learningMetrics;

    // Update improvement trend
    const recentRatings = this.personalizationData.interactions
      .filter(i => i.type === 'story_rating')
      .slice(-10)
      .map(i => i.context.rating || 0);

    if (recentRatings.length >= 2) {
      const early = recentRatings.slice(
        0,
        Math.floor(recentRatings.length / 2),
      );
      const recent = recentRatings.slice(Math.floor(recentRatings.length / 2));

      const earlyAvg = early.reduce((sum, r) => sum + r, 0) / early.length;
      const recentAvg = recent.reduce((sum, r) => sum + r, 0) / recent.length;

      metrics.improvementTrend = (recentAvg - earlyAvg) / 5; // Normalize to -1 to 1
    }

    // Update consistency score
    if (recentRatings.length >= 3) {
      const variance = this.calculateVariance(recentRatings);
      metrics.consistencyScore = Math.max(0, 1 - variance / 6.25); // 6.25 is max variance for 0-5 scale
    }
  }

  private calculateVariance(numbers: number[]): number {
    const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
    const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2));
    return squaredDiffs.reduce((sum, d) => sum + d, 0) / numbers.length;
  }

  private calculateRecommendationConfidence(): number {
    if (!this.personalizationData) return 0.1;

    const sessionCount = this.personalizationData.learningMetrics.sessionCount;
    const consistencyScore =
      this.personalizationData.learningMetrics.consistencyScore;
    const interactionCount = this.personalizationData.interactions.length;

    // Confidence improves with more sessions and consistency
    let confidence = 0.1;

    if (sessionCount >= this.config.minSessionsForPersonalization) {
      confidence += Math.min(sessionCount / 20, 0.4); // Up to 0.4 for sessions
      confidence += consistencyScore * 0.3; // Up to 0.3 for consistency
      confidence += Math.min(interactionCount / 100, 0.2); // Up to 0.2 for interactions
    }

    return Math.min(confidence, 1);
  }

  private extractThemesFromRequest(request: StoryRequest): string[] {
    const themes: string[] = [];

    if (request.userInput) {
      // Simple theme extraction based on keywords
      const input = request.userInput.toLowerCase();

      if (input.includes('adventure') || input.includes('quest'))
        themes.push('adventure');
      if (input.includes('friend') || input.includes('buddy'))
        themes.push('friendship');
      if (input.includes('magic') || input.includes('wizard'))
        themes.push('fantasy');
      if (input.includes('space') || input.includes('robot'))
        themes.push('sci-fi');
      if (input.includes('animal') || input.includes('pet'))
        themes.push('animals');
      if (input.includes('school') || input.includes('learn'))
        themes.push('education');
      if (input.includes('family') || input.includes('parent'))
        themes.push('family');

      if (themes.length === 0) themes.push('general');
    }

    return themes;
  }

  private extractComplexityFromRequest(request: StoryRequest): string | null {
    // Extract complexity based on grade level and user input length
    const gradeComplexity: Record<string, string> = {
      'K-2': 'simple',
      '3-5': 'medium',
      '6-8': 'medium',
      '9-12': 'complex',
    };

    return gradeComplexity[request.gradeLevel] || 'medium';
  }

  private extractToneFromResponse(response: StoryResponse): string | null {
    const story = response.story.toLowerCase();

    if (story.includes('funny') || story.includes('laugh')) return 'humorous';
    if (story.includes('scary') || story.includes('afraid'))
      return 'suspenseful';
    if (story.includes('exciting') || story.includes('thrilling'))
      return 'exciting';
    if (story.includes('calm') || story.includes('peaceful')) return 'peaceful';

    return 'neutral';
  }

  private async updatePreferredQualityLevel(): Promise<void> {
    if (!this.personalizationData) return;

    const history =
      this.personalizationData.qualityPreferences.qualityFeedbackHistory;
    if (history.length < 5) return; // Need sufficient data

    // Calculate correlation between content quality and user satisfaction
    const recentHistory = history.slice(-20); // Use last 20 entries

    // Find the optimal quality level based on user satisfaction
    let bestQualityLevel = 0.5;
    let maxSatisfaction = 0;

    // Group by quality level ranges and find the one with highest satisfaction
    const qualityRanges = [
      { min: 0.0, max: 0.3, center: 0.15 },
      { min: 0.3, max: 0.5, center: 0.4 },
      { min: 0.5, max: 0.7, center: 0.6 },
      { min: 0.7, max: 0.9, center: 0.8 },
      { min: 0.9, max: 1.0, center: 0.95 },
    ];

    for (const range of qualityRanges) {
      const entriesInRange = recentHistory.filter(
        entry =>
          entry.contentScore >= range.min && entry.contentScore < range.max,
      );

      if (entriesInRange.length >= 2) {
        const avgSatisfaction =
          entriesInRange.reduce(
            (sum, entry) => sum + entry.userSatisfaction,
            0,
          ) / entriesInRange.length;
        const avgEngagement =
          entriesInRange.reduce(
            (sum, entry) => sum + entry.engagementLevel,
            0,
          ) / entriesInRange.length;

        // Combined score of satisfaction and engagement
        const combinedScore = (avgSatisfaction + avgEngagement) / 2;

        if (combinedScore > maxSatisfaction) {
          maxSatisfaction = combinedScore;
          bestQualityLevel = range.center;
        }
      }
    }

    // Apply gradual adjustment with learning rate
    const learningRate = 0.1;
    const currentLevel =
      this.personalizationData.qualityPreferences.preferredQualityLevel;
    this.personalizationData.qualityPreferences.preferredQualityLevel =
      currentLevel + learningRate * (bestQualityLevel - currentLevel);

    // Clamp to valid range
    this.personalizationData.qualityPreferences.preferredQualityLevel =
      Math.max(
        0,
        Math.min(
          1,
          this.personalizationData.qualityPreferences.preferredQualityLevel,
        ),
      );

    structuredLogger.debug('Updated preferred quality level', {
      userId: this.personalizationData.userId.substring(0, 8) + '***',
      previousLevel: currentLevel,
      newLevel:
        this.personalizationData.qualityPreferences.preferredQualityLevel,
      maxSatisfaction,
      historyLength: history.length,
    });
  }

  private scheduleCleanup(): void {
    // Schedule cleanup of expired data every 24 hours
    setInterval(async () => {
      try {
        await secureStorage.cleanupExpired();
        structuredLogger.info('Scheduled cleanup completed');
      } catch (error) {
        structuredLogger.error('Scheduled cleanup failed', {}, error as Error);
      }
    }, 24 * 60 * 60 * 1000);
  }
}

// Export singleton instance
export const userPreferencesService = new UserPreferencesService();
