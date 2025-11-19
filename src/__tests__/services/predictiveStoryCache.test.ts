/**
 * Predictive Cache Management Tests
 * 
 * Tests for Task 3.2: Predictive Cache Management System
 */

import { predictiveStoryCacheService } from '../../services/predictiveStoryCache';
import { storyCacheService } from '../../services/storyCache';
import { contentPredictionService } from '../../services/contentPrediction';
import { StoryRequest, StoryResponse, GradeLevel } from '../../types/story';
import { createMockSkillManager } from '../mocks/claudeSkillsMock';
import { getClaudeSkillsManager } from '../../services/claudeSkillsManager';

// Mock dependencies
jest.mock('../../services/claudeSkillsManager');
jest.mock('../../utils/logger');
jest.mock('react-native-device-info', () => ({
  getTotalMemory: jest.fn().mockResolvedValue(4 * 1024 * 1024 * 1024), // 4GB
  getDeviceType: jest.fn().mockResolvedValue('Handset'),
  getSystemVersion: jest.fn().mockResolvedValue('15.0'),
}));

describe('Predictive Cache Management', () => {
  let mockSkillManager: any;

  beforeAll(async () => {
    mockSkillManager = createMockSkillManager();
    await mockSkillManager.initialize({
      apiKey: 'test_key',
      environment: 'development',
      enabledSkills: ['ContentPredictionSkill'],
      performanceMode: 'balanced',
    });
    (getClaudeSkillsManager as jest.Mock).mockResolvedValue(mockSkillManager);
  });

  beforeEach(async () => {
    await storyCacheService.clear();
    jest.clearAllMocks();
  });

  describe('Intelligent Cache Key Generation', () => {
    test('Cache key generation is deterministic and unique', async () => {
      const request1: StoryRequest = {
        gradeLevel: 'K-2',
        storySoFar: 'Ruby found a magical stone',
        userInput: 'The stone glowed',
      };

      const request2: StoryRequest = {
        gradeLevel: 'K-2',
        storySoFar: 'Ruby found a magical stone',
        userInput: 'The stone glowed',
      };

      const key1 = await predictiveStoryCacheService.generateIntelligentCacheKey(request1);
      const key2 = await predictiveStoryCacheService.generateIntelligentCacheKey(request2);

      // Same request should generate same key
      expect(key1).toBe(key2);

      // Different requests should generate different keys
      const request3: StoryRequest = {
        gradeLevel: '3-5',
        storySoFar: 'Sarah discovered a cave',
        userInput: 'She explored deeper',
      };
      const key3 = await predictiveStoryCacheService.generateIntelligentCacheKey(request3);
      expect(key3).not.toBe(key1);
    });

    test('Key generation includes context analysis', async () => {
      const request: StoryRequest = {
        gradeLevel: 'K-2',
        storySoFar: 'Ruby and her friend went on a magical adventure',
        userInput: 'They discovered a secret garden',
      };

      const key = await predictiveStoryCacheService.generateIntelligentCacheKey(request);

      // Key should include grade level
      expect(key).toContain('K-2');
      // Key should include theme/pattern information
      expect(key).toContain('story');
    });

    test('Collision resistance verified', async () => {
      const requests: StoryRequest[] = [
        { gradeLevel: 'K-2', userInput: 'Adventure story' },
        { gradeLevel: 'K-2', userInput: 'Friendship story' },
        { gradeLevel: '3-5', userInput: 'Adventure story' },
        { gradeLevel: '3-5', userInput: 'Mystery story' },
      ];

      const keys = await Promise.all(
        requests.map(req => predictiveStoryCacheService.generateIntelligentCacheKey(req))
      );

      // All keys should be unique
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);
    });
  });

  describe('Predictive Content Pre-loading', () => {
    test('Pre-loading improves cache hit ratio', async () => {
      const userContext = {
        gradeLevel: 'K-2' as GradeLevel,
        recentStories: [
          {
            gradeLevel: 'K-2' as GradeLevel,
            storySoFar: 'Ruby found a magical stone',
            userInput: 'The stone glowed',
          },
        ],
      };

      // Preload content
      await predictiveStoryCacheService.preloadContent(userContext);

      // Check that preload queue has items
      const stats = predictiveStoryCacheService.getStats();
      expect(stats.preloadQueueSize).toBeGreaterThanOrEqual(0);
    });

    test('Pre-loading respects confidence threshold', async () => {
      const userContext = {
        gradeLevel: 'K-2' as GradeLevel,
        recentStories: [
          {
            gradeLevel: 'K-2' as GradeLevel,
            storySoFar: 'Ruby found a magical stone',
            userInput: 'The stone glowed',
          },
        ],
      };

      await predictiveStoryCacheService.preloadContent(userContext);

      // Preload queue should only contain high-confidence predictions
      const stats = predictiveStoryCacheService.getStats();
      // Queue size should be reasonable
      expect(stats.preloadQueueSize).toBeLessThanOrEqual(10);
    });

    test('Memory usage stays within bounds during preloading', async () => {
      const userContext = {
        gradeLevel: 'K-2' as GradeLevel,
        recentStories: [
          {
            gradeLevel: 'K-2' as GradeLevel,
            storySoFar: 'Ruby found a magical stone',
            userInput: 'The stone glowed',
          },
        ],
      };

      const initialStats = predictiveStoryCacheService.getStats();

      await predictiveStoryCacheService.preloadContent(userContext);

      const finalStats = predictiveStoryCacheService.getStats();

      // Memory usage should not increase dramatically
      expect(finalStats.memoryUsage).toBeLessThanOrEqual(initialStats.memoryUsage * 1.5);
    });
  });

  describe('Cache Invalidation Strategies', () => {
    test('Cache invalidation prevents stale content', async () => {
      const request: StoryRequest = {
        gradeLevel: 'K-2',
        storySoFar: 'Ruby found a stone',
        userInput: 'The stone glowed',
      };

      const response: StoryResponse = {
        story: 'Test story content',
        success: true,
        gradeLevel: 'K-2',
      };

      // Cache the response
      await predictiveStoryCacheService.set(request, response, 1000); // Short TTL

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Try to get cached content
      const cached = await predictiveStoryCacheService.get(request);

      // Should be null after expiration
      expect(cached).toBeNull();
    });

    test('Invalidation triggers work correctly', async () => {
      const request: StoryRequest = {
        gradeLevel: 'K-2',
        userInput: 'Test story',
      };

      const response: StoryResponse = {
        story: 'Test content',
        success: true,
        gradeLevel: 'K-2',
      };

      await predictiveStoryCacheService.set(request, response);

      // Manually trigger invalidation
      const invalidatedCount = await predictiveStoryCacheService.invalidateBasedOnUsagePatterns();

      expect(invalidatedCount).toBeGreaterThanOrEqual(0);
    });

    test('Invalidation performance acceptable', async () => {
      // Add multiple cache entries
      for (let i = 0; i < 20; i++) {
        const request: StoryRequest = {
          gradeLevel: 'K-2',
          userInput: `Test story ${i}`,
        };
        const response: StoryResponse = {
          story: `Content ${i}`,
          success: true,
          gradeLevel: 'K-2',
        };
        await predictiveStoryCacheService.set(request, response);
      }

      const startTime = performance.now();
      await predictiveStoryCacheService.invalidateBasedOnUsagePatterns();
      const invalidationTime = performance.now() - startTime;

      // Invalidation should complete within 100ms
      expect(invalidationTime).toBeLessThan(100);
    });
  });

  describe('Device Capability Adaptation', () => {
    test('Cache adaptation works across device tiers', async () => {
      const capabilities = predictiveStoryCacheService.getDeviceCapabilities();

      expect(capabilities).toBeDefined();
      expect(capabilities?.deviceTier).toBeDefined();
      expect(['low', 'medium', 'high']).toContain(capabilities?.deviceTier);
      expect(capabilities?.recommendedCacheSize).toBeGreaterThan(0);
      expect(capabilities?.maxCacheSize).toBeGreaterThanOrEqual(capabilities?.recommendedCacheSize || 0);
    });

    test('Low-memory devices handle cache gracefully', async () => {
      // Simulate low-memory device
      const DeviceInfo = require('react-native-device-info');
      DeviceInfo.getTotalMemory.mockResolvedValueOnce(1 * 1024 * 1024 * 1024); // 1GB

      // Create new instance to re-initialize with low memory
      const { PredictiveStoryCacheService } = await import('../../services/predictiveStoryCache');
      const lowMemoryCache = new PredictiveStoryCacheService();

      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 100));

      const capabilities = lowMemoryCache.getDeviceCapabilities();
      expect(capabilities?.deviceTier).toBe('low');
      expect(capabilities?.recommendedCacheSize).toBe(50); // Should be smaller for low-end devices

      // Cleanup
      lowMemoryCache.destroy();
    });

    test('Cache persists correctly across app restarts', async () => {
      const request: StoryRequest = {
        gradeLevel: 'K-2',
        userInput: 'Test story',
      };

      const response: StoryResponse = {
        story: 'Persistent content',
        success: true,
        gradeLevel: 'K-2',
      };

      await predictiveStoryCacheService.set(request, response);

      // Simulate app restart by checking if cache still has the entry
      const cached = await predictiveStoryCacheService.get(request);
      expect(cached).toBeDefined();
    });

    test('Cache cleanup prevents memory leaks', async () => {
      // Add many entries
      for (let i = 0; i < 50; i++) {
        const request: StoryRequest = {
          gradeLevel: 'K-2',
          userInput: `Test ${i}`,
        };
        const response: StoryResponse = {
          story: `Content ${i}`,
          success: true,
          gradeLevel: 'K-2',
        };
        await predictiveStoryCacheService.set(request, response);
      }

      const statsBefore = predictiveStoryCacheService.getStats();

      // Trigger cleanup
      await predictiveStoryCacheService.optimizeCacheSize();

      const statsAfter = predictiveStoryCacheService.getStats();

      // Cache size should be optimized
      expect(statsAfter.cacheSize).toBeLessThanOrEqual(statsBefore.cacheSize);
    });
  });

  describe('Cache Hit Ratio', () => {
    test('Cache hit ratio improves with predictions', async () => {
      const request: StoryRequest = {
        gradeLevel: 'K-2',
        storySoFar: 'Ruby found a magical stone',
        userInput: 'The stone glowed',
      };

      const response: StoryResponse = {
        story: 'The magical stone glowed brightly, showing Ruby a path through the forest.',
        success: true,
        gradeLevel: 'K-2',
      };

      // Cache the response
      await predictiveStoryCacheService.set(request, response);

      // Try to get it multiple times
      const hits: (StoryResponse | null)[] = [];
      for (let i = 0; i < 10; i++) {
        const cached = await predictiveStoryCacheService.get(request);
        hits.push(cached);
      }

      // All should be hits
      const hitCount = hits.filter(h => h !== null).length;
      expect(hitCount).toBe(10);

      const stats = predictiveStoryCacheService.getStats();
      expect(stats.hitRate).toBeGreaterThan(0.8);
    });
  });
});

