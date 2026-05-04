/**
 * Predictive Story Cache Service
 *
 * Enhanced cache service with Claude-powered decision making and pre-loading
 * Task 3.2: Predictive Cache Management System
 */

import {
  storyCacheService,
  CacheEntry,
  CacheConfig,
  CacheStats,
} from './storyCache';
import {
  contentPredictionService,
  StoryContextAnalysis,
} from './contentPrediction';
import type { StoryRequest, StoryResponse } from '../types/story';
import type { GradeLevel } from '../types/database';
import { ContentPrediction } from '../types/claudeSkills';
import { structuredLogger } from '../utils/logger';
import DeviceInfo from 'react-native-device-info';
import { Platform, Dimensions } from 'react-native';

export interface PredictiveCacheConfig extends CacheConfig {
  preloadEnabled: boolean;
  preloadConfidenceThreshold: number;
  invalidationStrategy: 'time' | 'usage' | 'pattern' | 'hybrid';
  adaptiveSize: boolean;
}

export interface PreloadCandidate {
  key: string;
  request: StoryRequest;
  confidence: number;
  priority: number;
  predictedContent?: ContentPrediction;
}

export interface CacheUsagePattern {
  key: string;
  accessFrequency: number;
  lastAccessed: number;
  accessTimes: number[];
  pattern: string;
  invalidationScore: number;
}

export interface DeviceCapabilities {
  totalMemory: number;
  availableMemory: number;
  deviceTier: 'low' | 'medium' | 'high';
  recommendedCacheSize: number;
  maxCacheSize: number;
}

export class PredictiveStoryCacheService {
  private config: PredictiveCacheConfig;
  private preloadQueue: PreloadCandidate[] = [];
  private usagePatterns: Map<string, CacheUsagePattern> = new Map();
  private deviceCapabilities: DeviceCapabilities | null = null;
  private preloadTimer: NodeJS.Timeout | null = null;
  private invalidationTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<PredictiveCacheConfig> = {}) {
    this.config = {
      maxSize: 100,
      defaultTTL: 20 * 60 * 1000,
      compressionEnabled: true,
      persistentStorage: true,
      preloadEnabled: true,
      preloadConfidenceThreshold: 0.7,
      invalidationStrategy: 'hybrid',
      adaptiveSize: true,
      ...config,
    };

    // Initialize device capabilities asynchronously
    this.initializeDeviceCapabilities().catch(error => {
      structuredLogger.error(
        'Failed to initialize device capabilities',
        {},
        error,
      );
    });

    this.startPreloadTimer();
    this.startInvalidationTimer();
  }

  /**
   * Initialize device capabilities for adaptive caching
   */
  private async initializeDeviceCapabilities(): Promise<void> {
    try {
      const totalMemory = await DeviceInfo.getTotalMemory().catch(
        () => 2 * 1024 * 1024 * 1024,
      ); // Default 2GB
      const availableMemory = totalMemory * 0.3; // Assume 30% available for cache

      // Determine device tier
      let deviceTier: 'low' | 'medium' | 'high' = 'medium';
      if (totalMemory < 2 * 1024 * 1024 * 1024) {
        deviceTier = 'low';
      } else if (totalMemory > 6 * 1024 * 1024 * 1024) {
        deviceTier = 'high';
      }

      // Calculate recommended cache sizes based on device tier
      const recommendedSizes = {
        low: 50, // 50 entries for low-end devices
        medium: 100, // 100 entries for medium devices
        high: 200, // 200 entries for high-end devices
      };

      const maxSizes = {
        low: 75,
        medium: 150,
        high: 300,
      };

      this.deviceCapabilities = {
        totalMemory,
        availableMemory,
        deviceTier,
        recommendedCacheSize: recommendedSizes[deviceTier],
        maxCacheSize: maxSizes[deviceTier],
      };

      // Update cache config based on device capabilities
      if (this.config.adaptiveSize && storyCacheService.updateConfig) {
        storyCacheService.updateConfig({
          maxSize: this.deviceCapabilities.recommendedCacheSize,
        });
      }

      structuredLogger.info('Device capabilities initialized', {
        deviceTier: this.deviceCapabilities.deviceTier,
        recommendedCacheSize: this.deviceCapabilities.recommendedCacheSize,
        totalMemory: this.deviceCapabilities.totalMemory,
      });
    } catch (error) {
      structuredLogger.error(
        'Failed to initialize device capabilities',
        {},
        error as Error,
      );
      // Fallback to medium tier
      this.deviceCapabilities = {
        totalMemory: 4 * 1024 * 1024 * 1024,
        availableMemory: 1 * 1024 * 1024 * 1024,
        deviceTier: 'medium',
        recommendedCacheSize: 100,
        maxCacheSize: 150,
      };
    }
  }

  /**
   * Generate intelligent cache key using content prediction
   */
  async generateIntelligentCacheKey(request: StoryRequest): Promise<string> {
    // Analyze story context
    const contextAnalysis = await contentPredictionService.analyzeStoryContext(
      request,
    );

    // Generate key components
    const gradeLevel = request.gradeLevel;
    const theme = contextAnalysis.extractedElements.tone || 'general';
    const pattern = contextAnalysis.patternMatch?.category || 'general';
    const confidence = contextAnalysis.confidence;

    // Include pattern match in key for better cache hits
    const keyComponents = [
      'story',
      gradeLevel,
      theme,
      pattern,
      contextAnalysis.extractedElements.themes.join(','),
      this.hashContext(contextAnalysis),
    ];

    const baseKey = keyComponents.join(':');

    // Add confidence indicator for cache prioritization
    const confidenceTier =
      confidence > 0.8 ? 'high' : confidence > 0.6 ? 'medium' : 'low';
    const intelligentKey = `${baseKey}:${confidenceTier}`;

    return intelligentKey;
  }

  /**
   * Hash context for consistent key generation
   */
  private hashContext(context: StoryContextAnalysis): string {
    const contextString = JSON.stringify({
      characters: context.extractedElements.characters.sort(),
      settings: context.extractedElements.settings.sort(),
      themes: context.extractedElements.themes.sort(),
      tone: context.extractedElements.tone,
    });

    let hash = 0;
    for (let i = 0; i < contextString.length; i++) {
      const char = contextString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get cached story with intelligent key generation
   */
  async get(request: StoryRequest): Promise<StoryResponse | null> {
    const key = await this.generateIntelligentCacheKey(request);
    const cached = await storyCacheService.get<StoryResponse>(key);

    if (cached) {
      // Track usage pattern
      this.recordUsage(key, true);
      return cached;
    }

    // Track miss
    this.recordUsage(key, false);

    // Try to find similar cached content
    const similarKey = await this.findSimilarCachedContent(request);
    if (similarKey) {
      const similarCached = await storyCacheService.get<StoryResponse>(
        similarKey,
      );
      if (similarCached) {
        // Cache the result with the new key for future hits
        await this.set(request, similarCached);
        return similarCached;
      }
    }

    return null;
  }

  /**
   * Set cached story with intelligent key
   */
  async set(
    request: StoryRequest,
    response: StoryResponse,
    ttl?: number,
  ): Promise<void> {
    const key = await this.generateIntelligentCacheKey(request);
    await storyCacheService.set(key, response, ttl, {
      request: {
        gradeLevel: request.gradeLevel,
        theme: request.userInput,
      },
      timestamp: new Date().toISOString(),
    });

    // Track usage pattern
    this.recordUsage(key, true);
  }

  /**
   * Find similar cached content based on context
   */
  private async findSimilarCachedContent(
    request: StoryRequest,
  ): Promise<string | null> {
    const contextAnalysis = await contentPredictionService.analyzeStoryContext(
      request,
    );
    const allKeys = storyCacheService.getCacheKeys();

    let bestMatch: string | null = null;
    let bestScore = 0;

    for (const key of allKeys) {
      // Parse key to extract context
      const keyParts = key.split(':');
      if (keyParts.length < 4) continue;

      const keyGradeLevel = keyParts[1] as GradeLevel;
      const keyTheme = keyParts[2];
      const keyPattern = keyParts[3];

      let score = 0;

      // Grade level match (high weight)
      if (keyGradeLevel === contextAnalysis.gradeLevel) {
        score += 0.4;
      }

      // Theme match (medium weight)
      if (keyTheme === contextAnalysis.extractedElements.tone) {
        score += 0.3;
      }

      // Pattern match (medium weight)
      if (keyPattern === contextAnalysis.patternMatch?.category) {
        score += 0.3;
      }

      if (score > bestScore && score > 0.6) {
        bestScore = score;
        bestMatch = key;
      }
    }

    return bestMatch;
  }

  /**
   * Predictive content pre-loading system
   */
  async preloadContent(userContext: {
    gradeLevel: GradeLevel;
    recentStories?: StoryRequest[];
    userPreferences?: Record<string, any>;
  }): Promise<void> {
    if (!this.config.preloadEnabled) return;

    try {
      // Analyze user context to predict likely next requests
      const predictions = await this.predictNextRequests(userContext);

      // Filter by confidence threshold
      const highConfidencePredictions = predictions.filter(
        p => p.confidence >= this.config.preloadConfidenceThreshold,
      );

      // Sort by priority
      highConfidencePredictions.sort((a, b) => b.priority - a.priority);

      // Add to preload queue
      this.preloadQueue.push(...highConfidencePredictions.slice(0, 10)); // Limit to top 10

      structuredLogger.info('Content preloaded', {
        preloadCount: highConfidencePredictions.length,
        queueSize: this.preloadQueue.length,
      });
    } catch (error) {
      structuredLogger.error('Preload failed', {}, error as Error);
    }
  }

  /**
   * Predict next likely requests based on context
   */
  private async predictNextRequests(userContext: {
    gradeLevel: GradeLevel;
    recentStories?: StoryRequest[];
    userPreferences?: Record<string, any>;
  }): Promise<PreloadCandidate[]> {
    const candidates: PreloadCandidate[] = [];

    // Analyze recent stories to predict patterns
    if (userContext.recentStories && userContext.recentStories.length > 0) {
      const recentStory =
        userContext.recentStories[userContext.recentStories.length - 1];
      const contextAnalysis =
        await contentPredictionService.analyzeStoryContext(recentStory);

      // Predict likely continuations
      const predictions = await contentPredictionService.predictContent(
        contextAnalysis,
      );

      if (predictions) {
        // Create preload candidates based on predictions
        for (const prediction of predictions.predictions) {
          if (prediction.confidence >= this.config.preloadConfidenceThreshold) {
            const candidate: PreloadCandidate = {
              key: await this.generateIntelligentCacheKey({
                gradeLevel: userContext.gradeLevel,
                storySoFar: recentStory.storySoFar || '',
                userInput: prediction.content.substring(0, 100), // Use prediction as input hint
              }),
              request: {
                gradeLevel: userContext.gradeLevel,
                storySoFar: recentStory.storySoFar,
                userInput: prediction.content.substring(0, 100),
              },
              confidence: prediction.confidence,
              priority: this.calculatePreloadPriority(
                prediction,
                contextAnalysis,
              ),
              predictedContent: prediction,
            };

            candidates.push(candidate);
          }
        }
      }
    }

    // Add common patterns for the grade level
    const commonPatterns = contentPredictionService
      .getStoryPatterns()
      .filter(p => p.gradeLevel === userContext.gradeLevel);

    for (const pattern of commonPatterns.slice(0, 3)) {
      const candidate: PreloadCandidate = {
        key: await this.generateIntelligentCacheKey({
          gradeLevel: userContext.gradeLevel,
          userInput: pattern.theme,
        }),
        request: {
          gradeLevel: userContext.gradeLevel,
          userInput: pattern.theme,
        },
        confidence: pattern.confidence,
        priority: pattern.frequency * 100, // Use frequency as priority
      };

      candidates.push(candidate);
    }

    return candidates;
  }

  /**
   * Calculate preload priority
   */
  private calculatePreloadPriority(
    prediction: ContentPrediction,
    context: StoryContextAnalysis,
  ): number {
    let priority = prediction.confidence * 50; // Base priority from confidence

    // Boost priority for high-confidence context
    if (context.confidence > 0.8) {
      priority += 20;
    }

    // Boost priority for pattern matches
    if (context.patternMatch) {
      priority += context.patternMatch.frequency * 30;
    }

    return priority;
  }

  /**
   * Process preload queue
   */
  private async processPreloadQueue(): Promise<void> {
    if (this.preloadQueue.length === 0) return;
    if (!this.config.preloadEnabled) return;

    // Check if we have space in cache
    const stats = storyCacheService.getStats();
    if (
      stats.cacheSize >=
      (this.deviceCapabilities?.recommendedCacheSize || 100) * 0.9
    ) {
      return; // Cache nearly full, skip preloading
    }

    // Process top priority items
    const toPreload = this.preloadQueue
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 3); // Preload 3 items at a time

    for (const candidate of toPreload) {
      // Check if already cached
      if (await storyCacheService.has(candidate.key)) {
        continue;
      }

      // In a real implementation, this would fetch and cache the content
      // For now, we just log the preload attempt
      structuredLogger.debug('Preload candidate', {
        key: candidate.key,
        confidence: candidate.confidence,
        priority: candidate.priority,
      });
    }

    // Remove processed items
    this.preloadQueue = this.preloadQueue.filter(
      item => !toPreload.includes(item),
    );
  }

  /**
   * Record cache usage pattern
   */
  private recordUsage(key: string, hit: boolean): void {
    const now = Date.now();
    let pattern = this.usagePatterns.get(key);

    if (!pattern) {
      pattern = {
        key,
        accessFrequency: 0,
        lastAccessed: now,
        accessTimes: [],
        pattern: this.extractPatternFromKey(key),
        invalidationScore: 0,
      };
      this.usagePatterns.set(key, pattern);
    }

    pattern.lastAccessed = now;
    pattern.accessTimes.push(now);
    pattern.accessFrequency = pattern.accessTimes.length;

    // Keep only last 100 access times
    if (pattern.accessTimes.length > 100) {
      pattern.accessTimes.shift();
    }

    // Update invalidation score
    pattern.invalidationScore = this.calculateInvalidationScore(pattern);
  }

  /**
   * Extract pattern from cache key
   */
  private extractPatternFromKey(key: string): string {
    const parts = key.split(':');
    if (parts.length >= 4) {
      return `${parts[1]}:${parts[2]}:${parts[3]}`; // gradeLevel:theme:pattern
    }
    return key;
  }

  /**
   * Calculate invalidation score based on usage patterns
   */
  private calculateInvalidationScore(pattern: CacheUsagePattern): number {
    const now = Date.now();
    const timeSinceLastAccess = now - pattern.lastAccessed;
    const avgTimeBetweenAccesses = this.calculateAverageTimeBetweenAccesses(
      pattern.accessTimes,
    );

    // Higher score = more likely to be invalidated
    let score = 0;

    // Time since last access (higher = more likely to invalidate)
    score += Math.min(timeSinceLastAccess / (24 * 60 * 60 * 1000), 1) * 0.4; // Normalize to 24 hours

    // Low access frequency (lower = more likely to invalidate)
    score += (1 - Math.min(pattern.accessFrequency / 10, 1)) * 0.3;

    // Long time between accesses (longer = more likely to invalidate)
    if (avgTimeBetweenAccesses > 0) {
      score +=
        Math.min(avgTimeBetweenAccesses / (7 * 24 * 60 * 60 * 1000), 1) * 0.3; // Normalize to 7 days
    }

    return score;
  }

  /**
   * Calculate average time between accesses
   */
  private calculateAverageTimeBetweenAccesses(accessTimes: number[]): number {
    if (accessTimes.length < 2) return 0;

    const intervals: number[] = [];
    for (let i = 1; i < accessTimes.length; i++) {
      intervals.push(accessTimes[i] - accessTimes[i - 1]);
    }

    return (
      intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length
    );
  }

  /**
   * Cache invalidation based on usage patterns
   */
  async invalidateBasedOnUsagePatterns(): Promise<number> {
    if (this.config.invalidationStrategy === 'time') {
      return 0; // Time-based invalidation handled by cache service
    }

    let invalidatedCount = 0;
    const invalidationThreshold = 0.7; // Invalidate entries with score > 0.7

    for (const [key, pattern] of this.usagePatterns.entries()) {
      if (pattern.invalidationScore > invalidationThreshold) {
        const deleted = await storyCacheService.delete(key);
        if (deleted) {
          invalidatedCount++;
          this.usagePatterns.delete(key);
        }
      }
    }

    structuredLogger.info('Cache invalidated based on usage patterns', {
      invalidatedCount,
      strategy: this.config.invalidationStrategy,
    });

    return invalidatedCount;
  }

  /**
   * Optimize cache size based on device capabilities
   */
  async optimizeCacheSize(): Promise<void> {
    if (!this.config.adaptiveSize || !this.deviceCapabilities) return;

    const stats = storyCacheService.getStats();
    const currentSize = stats.cacheSize;
    const recommendedSize = this.deviceCapabilities.recommendedCacheSize;

    // If cache is too large for device, reduce it
    if (currentSize > this.deviceCapabilities.maxCacheSize) {
      // Invalidate least-used entries
      await this.invalidateBasedOnUsagePatterns();

      // Update cache max size
      if (storyCacheService.updateConfig) {
        storyCacheService.updateConfig({
          maxSize: this.deviceCapabilities.recommendedCacheSize,
        });
      }

      structuredLogger.info('Cache size optimized', {
        previousSize: currentSize,
        newSize: this.deviceCapabilities.recommendedCacheSize,
        deviceTier: this.deviceCapabilities.deviceTier,
      });
    }
  }

  /**
   * Start preload timer
   */
  private startPreloadTimer(): void {
    this.preloadTimer = setInterval(() => {
      this.processPreloadQueue();
    }, 30 * 1000); // Every 30 seconds
  }

  /**
   * Start invalidation timer
   */
  private startInvalidationTimer(): void {
    this.invalidationTimer = setInterval(() => {
      this.invalidateBasedOnUsagePatterns();
      this.optimizeCacheSize();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats & {
    preloadQueueSize: number;
    usagePatternsCount: number;
    deviceTier?: string;
  } {
    const baseStats = storyCacheService.getStats();
    return {
      ...baseStats,
      preloadQueueSize: this.preloadQueue.length,
      usagePatternsCount: this.usagePatterns.size,
      deviceTier: this.deviceCapabilities?.deviceTier,
    };
  }

  /**
   * Get device capabilities
   */
  getDeviceCapabilities(): DeviceCapabilities | null {
    return this.deviceCapabilities;
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<PredictiveCacheConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.preloadTimer) {
      clearInterval(this.preloadTimer);
      this.preloadTimer = null;
    }

    if (this.invalidationTimer) {
      clearInterval(this.invalidationTimer);
      this.invalidationTimer = null;
    }

    this.preloadQueue = [];
    this.usagePatterns.clear();
  }
}

// Export singleton instance
export const predictiveStoryCacheService = new PredictiveStoryCacheService();
