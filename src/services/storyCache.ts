// Story Cache Service
// Implements intelligent caching for repeated story patterns and performance optimization

import AsyncStorage from '@react-native-async-storage/async-storage';
import { GradeLevel } from '../types';

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  expiresAt: number;
  metadata?: Record<string, any>;
}

export interface CacheConfig {
  maxSize: number;
  defaultTTL: number;
  compressionEnabled: boolean;
  persistentStorage: boolean;
}

export interface StoryPattern {
  gradeLevel: GradeLevel;
  genre: string;
  theme: string;
  keywords: string[];
  structure: string;
}

export interface CacheStats {
  hitRate: number;
  missRate: number;
  totalRequests: number;
  totalHits: number;
  totalMisses: number;
  cacheSize: number;
  memoryUsage: number;
}

class StoryCacheService {
  private cache = new Map<string, CacheEntry>();
  private config: CacheConfig;
  private stats: CacheStats;
  private readonly STORAGE_KEY = '@CreativeBridge:storyCache';
  private readonly STATS_KEY = '@CreativeBridge:cacheStats';
  private cleanupTimer: NodeJS.Timeout | null = null;
  private patternIndex = new Map<string, Set<string>>();

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 100,
      defaultTTL: 20 * 60 * 1000, // 20 minutes
      compressionEnabled: true,
      persistentStorage: true,
      ...config,
    };

    this.stats = {
      hitRate: 0,
      missRate: 0,
      totalRequests: 0,
      totalHits: 0,
      totalMisses: 0,
      cacheSize: 0,
      memoryUsage: 0,
    };

    this.initializeCache();
    this.startCleanupTimer();
  }

  // Initialize cache from persistent storage
  private async initializeCache(): Promise<void> {
    if (!this.config.persistentStorage) return;

    try {
      const [cacheData, statsData] = await Promise.all([
        AsyncStorage.getItem(this.STORAGE_KEY),
        AsyncStorage.getItem(this.STATS_KEY),
      ]);

      if (cacheData) {
        const parsed = JSON.parse(cacheData);
        for (const [key, entry] of Object.entries(parsed)) {
          if (this.isValidEntry(entry as CacheEntry)) {
            this.cache.set(key, entry as CacheEntry);
          }
        }
      }

      if (statsData) {
        this.stats = { ...this.stats, ...JSON.parse(statsData) };
      }

      this.rebuildPatternIndex();
    } catch (error) {
      console.error('Failed to initialize cache from storage:', error);
      // Clear corrupted cache
      await this.clearPersistentStorage();
    }
  }

  // Generate cache key for story requests
  public generateStoryKey(params: {
    gradeLevel: GradeLevel;
    genre?: string;
    theme?: string;
    keywords?: string[];
    userContext?: string;
  }): string {
    const normalizedParams = {
      gradeLevel: params.gradeLevel,
      genre: params.genre || 'general',
      theme: params.theme || 'default',
      keywords: (params.keywords || []).sort().join(','),
      context: this.hashString(params.userContext || ''),
    };

    return `story:${normalizedParams.gradeLevel}:${normalizedParams.genre}:${normalizedParams.theme}:${normalizedParams.keywords}:${normalizedParams.context}`;
  }

  // Get cached story with pattern matching
  public async get<T>(key: string): Promise<T | null> {
    this.stats.totalRequests++;

    // Check exact match first
    let entry = this.cache.get(key);

    if (entry && !this.isExpired(entry)) {
      entry.accessCount++;
      entry.lastAccessed = Date.now();
      this.stats.totalHits++;
      this.updateHitRate();
      return entry.data as T;
    }

    // Try pattern matching for similar stories
    const similarKey = await this.findSimilarPattern(key);
    if (similarKey) {
      entry = this.cache.get(similarKey);
      if (entry && !this.isExpired(entry)) {
        entry.accessCount++;
        entry.lastAccessed = Date.now();
        this.stats.totalHits++;
        this.updateHitRate();

        // Create new entry for this specific key
        await this.set(key, entry.data, entry.expiresAt - Date.now());
        return entry.data as T;
      }
    }

    this.stats.totalMisses++;
    this.updateHitRate();
    return null;
  }

  // Set cache entry with intelligent compression
  public async set<T>(
    key: string,
    data: T,
    ttl: number = this.config.defaultTTL,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const now = Date.now();

    // Ensure cache size limit
    await this.ensureSpaceAvailable();

    const entry: CacheEntry<T> = {
      data: this.config.compressionEnabled ? this.compressData(data) : data,
      timestamp: now,
      accessCount: 1,
      lastAccessed: now,
      expiresAt: now + ttl,
      metadata,
    };

    this.cache.set(key, entry);
    this.addToPatternIndex(key);
    this.updateStats();

    // Persist to storage if enabled
    if (this.config.persistentStorage) {
      this.debouncedPersist();
    }
  }

  // Find patterns similar to the requested key
  private async findSimilarPattern(targetKey: string): Promise<string | null> {
    const targetPattern = this.parseKeyToPattern(targetKey);
    if (!targetPattern) return null;

    let bestMatch: string | null = null;
    let highestScore = 0;

    for (const [existingKey] of this.cache) {
      const existingPattern = this.parseKeyToPattern(existingKey);
      if (!existingPattern) continue;

      const similarity = this.calculatePatternSimilarity(
        targetPattern,
        existingPattern,
      );
      if (similarity > 0.8 && similarity > highestScore) {
        bestMatch = existingKey;
        highestScore = similarity;
      }
    }

    return bestMatch;
  }

  // Calculate similarity between story patterns
  private calculatePatternSimilarity(
    pattern1: StoryPattern,
    pattern2: StoryPattern,
  ): number {
    let score = 0;

    // Grade level match (high weight)
    if (pattern1.gradeLevel === pattern2.gradeLevel) {
      score += 0.4;
    }

    // Genre match (medium weight)
    if (pattern1.genre === pattern2.genre) {
      score += 0.3;
    }

    // Theme match (medium weight)
    if (pattern1.theme === pattern2.theme) {
      score += 0.2;
    }

    // Keywords overlap (low weight)
    const keywordOverlap = this.calculateSetOverlap(
      new Set(pattern1.keywords),
      new Set(pattern2.keywords),
    );
    score += keywordOverlap * 0.1;

    return score;
  }

  // Calculate overlap between two sets
  private calculateSetOverlap(set1: Set<string>, set2: Set<string>): number {
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  // Parse cache key into story pattern
  private parseKeyToPattern(key: string): StoryPattern | null {
    try {
      const parts = key.split(':');
      if (parts.length < 4 || parts[0] !== 'story') return null;

      return {
        gradeLevel: parts[1] as GradeLevel,
        genre: parts[2],
        theme: parts[3],
        keywords: parts[4] ? parts[4].split(',') : [],
        structure: parts[5] || '',
      };
    } catch {
      return null;
    }
  }

  // Intelligent cache eviction using LRU + access frequency
  private async ensureSpaceAvailable(): Promise<void> {
    if (this.cache.size < this.config.maxSize) return;

    const entries = Array.from(this.cache.entries())
      .map(([key, entry]) => ({
        key,
        entry,
        score: this.calculateEvictionScore(entry),
      }))
      .sort((a, b) => a.score - b.score); // Lower score = higher priority for eviction

    // Remove 20% of cache to make room
    const toRemove = Math.ceil(this.config.maxSize * 0.2);
    for (let i = 0; i < toRemove && i < entries.length; i++) {
      this.cache.delete(entries[i].key);
      this.removeFromPatternIndex(entries[i].key);
    }
  }

  // Calculate eviction score (lower = more likely to be evicted)
  private calculateEvictionScore(entry: CacheEntry): number {
    const now = Date.now();
    const age = now - entry.timestamp;
    const timeSinceAccess = now - entry.lastAccessed;
    const accessFrequency = entry.accessCount / Math.max(age / (1000 * 60), 1); // accesses per minute

    // Combine factors: newer, recently accessed, frequently used = higher score
    return (
      (1 / (age + 1)) * 0.3 +
      (1 / (timeSinceAccess + 1)) * 0.4 +
      accessFrequency * 0.3
    );
  }

  // Compress data for storage efficiency
  private compressData<T>(data: T): T {
    if (typeof data === 'string') {
      // Simple compression for strings (remove extra whitespace, etc.)
      return data.replace(/\s+/g, ' ').trim() as T;
    }
    return data;
  }

  // Check if cache entry is expired
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() > entry.expiresAt;
  }

  // Check if cache entry is valid
  private isValidEntry(entry: any): entry is CacheEntry {
    return (
      entry &&
      typeof entry.timestamp === 'number' &&
      typeof entry.accessCount === 'number' &&
      typeof entry.lastAccessed === 'number' &&
      typeof entry.expiresAt === 'number' &&
      entry.data !== undefined
    );
  }

  // Build pattern index for fast pattern matching
  private rebuildPatternIndex(): void {
    this.patternIndex.clear();

    for (const key of this.cache.keys()) {
      this.addToPatternIndex(key);
    }
  }

  // Add key to pattern index
  private addToPatternIndex(key: string): void {
    const pattern = this.parseKeyToPattern(key);
    if (!pattern) return;

    const indexKey = `${pattern.gradeLevel}:${pattern.genre}:${pattern.theme}`;
    if (!this.patternIndex.has(indexKey)) {
      this.patternIndex.set(indexKey, new Set());
    }
    this.patternIndex.get(indexKey)!.add(key);
  }

  // Remove key from pattern index
  private removeFromPatternIndex(key: string): void {
    const pattern = this.parseKeyToPattern(key);
    if (!pattern) return;

    const indexKey = `${pattern.gradeLevel}:${pattern.genre}:${pattern.theme}`;
    const keySet = this.patternIndex.get(indexKey);
    if (keySet) {
      keySet.delete(key);
      if (keySet.size === 0) {
        this.patternIndex.delete(indexKey);
      }
    }
  }

  // Update cache statistics
  private updateStats(): void {
    this.stats.cacheSize = this.cache.size;
    this.stats.memoryUsage = this.estimateMemoryUsage();
  }

  // Update hit rate statistics
  private updateHitRate(): void {
    this.stats.hitRate =
      this.stats.totalRequests > 0
        ? this.stats.totalHits / this.stats.totalRequests
        : 0;
    this.stats.missRate = 1 - this.stats.hitRate;
  }

  // Estimate memory usage
  private estimateMemoryUsage(): number {
    let size = 0;
    for (const [key, entry] of this.cache) {
      size += key.length * 2; // UTF-16 characters
      size += JSON.stringify(entry).length * 2;
    }
    return size;
  }

  // Hash string for consistent keys
  /* eslint-disable no-bitwise -- djb2 hash: bit-shift/mask intrinsic to algorithm. */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }
  /* eslint-enable no-bitwise */

  // Debounced persist to storage
  private persistTimeout: NodeJS.Timeout | null = null;
  private debouncedPersist(): void {
    if (this.persistTimeout) {
      clearTimeout(this.persistTimeout);
    }

    this.persistTimeout = setTimeout(async () => {
      try {
        const cacheData = Object.fromEntries(this.cache);
        await Promise.all([
          AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(cacheData)),
          AsyncStorage.setItem(this.STATS_KEY, JSON.stringify(this.stats)),
        ]);
      } catch (error) {
        console.error('Failed to persist cache:', error);
      }
    }, 1000);
  }

  // Start cleanup timer for expired entries
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  // Clean up expired entries
  private cleanupExpiredEntries(): void {
    for (const [key, entry] of this.cache) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        this.removeFromPatternIndex(key);
      }
    }
    this.updateStats();
  }

  // Public API methods
  public async clear(): Promise<void> {
    this.cache.clear();
    this.patternIndex.clear();
    this.updateStats();

    if (this.config.persistentStorage) {
      await this.clearPersistentStorage();
    }
  }

  public async delete(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.removeFromPatternIndex(key);
      this.updateStats();
    }
    return deleted;
  }

  public has(key: string): boolean {
    const entry = this.cache.get(key);
    return entry ? !this.isExpired(entry) : false;
  }

  public getStats(): CacheStats {
    return { ...this.stats };
  }

  public getCacheKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  public updateConfig(updates: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...updates };
    // Adjust cache size if maxSize changed
    if (updates.maxSize !== undefined) {
      this.ensureSpaceAvailable();
    }
  }

  public getConfig(): CacheConfig {
    return { ...this.config };
  }

  public async prefetchPatterns(patterns: StoryPattern[]): Promise<void> {
    // Placeholder for prefetching common patterns
    console.log('Prefetching patterns:', patterns.length);
  }

  public async warmCache(commonRequests: any[]): Promise<void> {
    // Warm cache with commonly requested stories
    for (const request of commonRequests) {
      const key = this.generateStoryKey(request);
      if (!this.has(key)) {
        // This would typically fetch from API and cache
        console.log('Warming cache for:', key);
      }
    }
  }

  // Cleanup resources
  public destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    if (this.persistTimeout) {
      clearTimeout(this.persistTimeout);
      this.persistTimeout = null;
    }
  }

  private async clearPersistentStorage(): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.removeItem(this.STORAGE_KEY),
        AsyncStorage.removeItem(this.STATS_KEY),
      ]);
    } catch (error) {
      console.error('Failed to clear persistent storage:', error);
    }
  }
}

export const storyCacheService = new StoryCacheService({
  maxSize: 150,
  defaultTTL: 30 * 60 * 1000, // 30 minutes
  compressionEnabled: true,
  persistentStorage: true,
});

// Alias used by performanceTuner and other services
export const storyCache = storyCacheService;

export default StoryCacheService;
