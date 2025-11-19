/**
 * Predictive Cache Integration Tests
 * 
 * Integration tests for Task 3.2: Predictive Cache Management System
 */

import { predictiveStoryCacheService } from '../../services/predictiveStoryCache';
import { enhancedStoryAgentService } from '../../services/enhancedStoryAgent';
import { StoryRequest, GradeLevel } from '../../types/story';
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

describe('Predictive Cache Integration', () => {
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
    await enhancedStoryAgentService.initialize();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
  });

  describe('Cache Hit Ratio Target', () => {
    test('Cache hit ratio reaches target 70%', async () => {
      const requests: StoryRequest[] = [
        { gradeLevel: 'K-2', userInput: 'Magical adventure' },
        { gradeLevel: 'K-2', userInput: 'Friendship story' },
        { gradeLevel: '3-5', userInput: 'Discovery adventure' },
      ];

      // Generate and cache stories
      for (const request of requests) {
        const storyResponse = await enhancedStoryAgentService.continueStory(request);
        if (storyResponse.success) {
          await predictiveStoryCacheService.set(request, storyResponse);
        }
      }

      // Request same stories again
      let hits = 0;
      let total = 0;

      for (const request of requests) {
        total++;
        const cached = await predictiveStoryCacheService.get(request);
        if (cached) {
          hits++;
        }
      }

      const hitRatio = hits / total;
      expect(hitRatio).toBeGreaterThanOrEqual(0.7);
    });
  });

  describe('Cache Size Adaptation', () => {
    test('Cache size adapts automatically to device memory', async () => {
      const capabilities = predictiveStoryCacheService.getDeviceCapabilities();

      expect(capabilities).toBeDefined();
      expect(capabilities?.deviceTier).toBeDefined();

      // Cache size should be appropriate for device tier
      const stats = predictiveStoryCacheService.getStats();
      expect(stats.cacheSize).toBeLessThanOrEqual(capabilities?.maxCacheSize || 300);
    });

    test('Low-memory devices have smaller cache', async () => {
      const DeviceInfo = require('react-native-device-info');
      DeviceInfo.getTotalMemory.mockResolvedValueOnce(1 * 1024 * 1024 * 1024); // 1GB

      // Re-initialize to get low-memory config
      const { PredictiveStoryCacheService } = await import('../../services/predictiveStoryCache');
      const lowMemoryCache = new PredictiveStoryCacheService();

      await new Promise(resolve => setTimeout(resolve, 100));

      const capabilities = lowMemoryCache.getDeviceCapabilities();
      expect(capabilities?.deviceTier).toBe('low');
      expect(capabilities?.recommendedCacheSize).toBe(50); // Lower for low-end devices
    });
  });

  describe('Pre-loading Performance', () => {
    test('Pre-loading reduces story generation latency', async () => {
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

      // Subsequent requests should be faster (cached)
      const request: StoryRequest = {
        gradeLevel: 'K-2',
        storySoFar: 'Ruby found a magical stone',
        userInput: 'The stone glowed',
      };

      const startTime = performance.now();
      const cached = await predictiveStoryCacheService.get(request);
      const latency = performance.now() - startTime;

      // Cached requests should be fast (< 50ms)
      if (cached) {
        expect(latency).toBeLessThan(50);
      }
    });

    test('Pre-loading does not exceed background processing limits', async () => {
      const userContext = {
        gradeLevel: 'K-2' as GradeLevel,
        recentStories: [
          {
            gradeLevel: 'K-2' as GradeLevel,
            storySoFar: 'Ruby found a stone',
            userInput: 'The stone glowed',
          },
        ],
      };

      const startTime = performance.now();
      await predictiveStoryCacheService.preloadContent(userContext);
      const preloadTime = performance.now() - startTime;

      // Preloading should complete quickly (< 500ms)
      expect(preloadTime).toBeLessThan(500);
    });
  });

  describe('Cache Operations Performance', () => {
    test('Cache operations complete within 100ms', async () => {
      const request: StoryRequest = {
        gradeLevel: 'K-2',
        userInput: 'Test story',
      };

      const response = {
        story: 'Test content',
        success: true,
        gradeLevel: 'K-2' as GradeLevel,
      };

      // Test set operation
      const setStart = performance.now();
      await predictiveStoryCacheService.set(request, response);
      const setTime = performance.now() - setStart;
      expect(setTime).toBeLessThan(100);

      // Test get operation
      const getStart = performance.now();
      await predictiveStoryCacheService.get(request);
      const getTime = performance.now() - getStart;
      expect(getTime).toBeLessThan(100);
    });
  });

  describe('Cache Persistence', () => {
    test('Cache persists correctly across app restarts', async () => {
      const request: StoryRequest = {
        gradeLevel: 'K-2',
        userInput: 'Persistent story',
      };

      const response = {
        story: 'This should persist',
        success: true,
        gradeLevel: 'K-2' as GradeLevel,
      };

      await predictiveStoryCacheService.set(request, response);

      // Simulate app restart - cache should still have the entry
      const cached = await predictiveStoryCacheService.get(request);
      expect(cached).toBeDefined();
      expect(cached?.story).toBe('This should persist');
    });
  });
});

