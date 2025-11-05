/**
 * User Journey Scenarios - User Acceptance Tests
 * Tests real-world user scenarios and workflows for image generation feature
 */

import { imageGenerationService } from '../../services/imageGeneration';
import { supabase } from '../../services/supabase';
import type { GradeLevel } from '../../types/database';

// Mock external dependencies
jest.mock('../../services/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

jest.mock('react-native-dotenv', () => ({
  REPLICATE_API_TOKEN: 'test-replicate-token',
  BACKUP_IMAGE_API_TOKEN: 'test-backup-token',
  IMAGE_GENERATION_ENABLED: 'true',
}));

global.fetch = jest.fn();

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

// User Scenario Simulator
class UserJourneySimulator {
  private userId: string;
  private currentXP: number;
  private stories: Array<{
    sessionId: string;
    content: string;
    gradeLevel: GradeLevel;
    wordCount: number;
    hasImage: boolean;
  }>;

  constructor(userId: string, initialXP: number = 5000) {
    this.userId = userId;
    this.currentXP = initialXP;
    this.stories = [];
  }

  // Simulate user completing a story
  async completeStory(
    gradeLevel: GradeLevel,
    wordCount: number,
  ): Promise<{
    sessionId: string;
    content: string;
    xpEarned: number;
  }> {
    const sessionId = `session_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}`;
    const content = this.generateStoryContent(gradeLevel, wordCount);

    // XP calculation based on word count and grade level
    const baseXP = Math.floor(wordCount / 10) * 50;
    const gradeMultiplier = this.getGradeMultiplier(gradeLevel);
    const xpEarned = Math.floor(baseXP * gradeMultiplier);

    this.currentXP += xpEarned;
    this.stories.push({
      sessionId,
      content,
      gradeLevel,
      wordCount,
      hasImage: false,
    });

    return { sessionId, content, xpEarned };
  }

  // Simulate user attempting image generation
  async attemptImageGeneration(sessionId: string): Promise<{
    success: boolean;
    imageUrl?: string;
    error?: string;
    xpSpent: number;
    newXPBalance: number;
  }> {
    const story = this.stories.find(s => s.sessionId === sessionId);
    if (!story) {
      throw new Error('Story not found');
    }

    const imageCost = 1000;

    // Check if user has enough XP
    if (this.currentXP < imageCost) {
      return {
        success: false,
        error: `Insufficient XP. Need ${imageCost} XP, have ${this.currentXP} XP`,
        xpSpent: 0,
        newXPBalance: this.currentXP,
      };
    }

    // Deduct XP
    this.currentXP -= imageCost;

    try {
      const result = await imageGenerationService.generateImage({
        storyContent: story.content,
        gradeLevel: story.gradeLevel,
        sessionId: story.sessionId,
        userId: this.userId,
        metadata: {
          wordCount: story.wordCount,
        },
      });

      if (result.success) {
        story.hasImage = true;
        return {
          success: true,
          imageUrl: result.imageUrl,
          xpSpent: imageCost,
          newXPBalance: this.currentXP,
        };
      } else {
        // Refund XP on failure
        this.currentXP += imageCost;
        return {
          success: false,
          error: result.error,
          xpSpent: 0,
          newXPBalance: this.currentXP,
        };
      }
    } catch (error) {
      // Refund XP on exception
      this.currentXP += imageCost;
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        xpSpent: 0,
        newXPBalance: this.currentXP,
      };
    }
  }

  // Simulate user checking their stats
  getStats() {
    return {
      userId: this.userId,
      currentXP: this.currentXP,
      totalStories: this.stories.length,
      storiesWithImages: this.stories.filter(s => s.hasImage).length,
      maxGenerations: Math.floor(this.currentXP / 1000),
      storyBreakdown: this.stories.reduce((acc, story) => {
        acc[story.gradeLevel] = (acc[story.gradeLevel] || 0) + 1;
        return acc;
      }, {} as Record<GradeLevel, number>),
    };
  }

  private generateStoryContent(
    gradeLevel: GradeLevel,
    wordCount: number,
  ): string {
    const themes = {
      'K-2': [
        'friendly animals',
        'magical forests',
        'happy adventures',
        'helpful friends',
      ],
      '3-5': [
        'brave heroes',
        'mysterious treasures',
        'exciting quests',
        'magical powers',
      ],
      '6-8': [
        'epic journeys',
        'ancient mysteries',
        'heroic challenges',
        'fantastical realms',
      ],
      '9-12': [
        'complex adventures',
        'profound discoveries',
        'philosophical quests',
        'intricate plots',
      ],
    };

    const characters = {
      'K-2': ['bunny', 'kitten', 'friendly dragon', 'magical fairy'],
      '3-5': [
        'young explorer',
        'clever detective',
        'brave knight',
        'wise wizard',
      ],
      '6-8': [
        'teenage hero',
        'skilled archer',
        'time traveler',
        'elemental mage',
      ],
      '9-12': [
        'complex protagonist',
        'conflicted hero',
        'master strategist',
        'philosophical warrior',
      ],
    };

    const settings = {
      'K-2': [
        'enchanted garden',
        'cozy village',
        'rainbow bridge',
        'candy castle',
      ],
      '3-5': [
        'mysterious forest',
        'ancient castle',
        'hidden cave',
        'floating island',
      ],
      '6-8': [
        'dystopian city',
        'parallel dimension',
        'underwater kingdom',
        'mountain fortress',
      ],
      '9-12': [
        'post-apocalyptic world',
        'interdimensional nexus',
        'consciousness realm',
        'quantum landscape',
      ],
    };

    const theme =
      themes[gradeLevel][Math.floor(Math.random() * themes[gradeLevel].length)];
    const character =
      characters[gradeLevel][
        Math.floor(Math.random() * characters[gradeLevel].length)
      ];
    const setting =
      settings[gradeLevel][
        Math.floor(Math.random() * settings[gradeLevel].length)
      ];

    // Generate content to approximate word count
    const wordsPerSentence = Math.max(
      8,
      Math.min(15, Math.floor(wordCount / 10)),
    );
    const sentences = Math.ceil(wordCount / wordsPerSentence);

    let content = `Once upon a time, there was a ${character} who lived in a ${setting}. `;

    for (let i = 1; i < sentences; i++) {
      content += `The ${character} discovered ${theme} and embarked on an incredible journey. `;
    }

    content += `In the end, the ${character} learned valuable lessons and returned home with newfound wisdom.`;

    return content;
  }

  private getGradeMultiplier(gradeLevel: GradeLevel): number {
    const multipliers = {
      'K-2': 1.0,
      '3-5': 1.2,
      '6-8': 1.4,
      '9-12': 1.6,
    };
    return multipliers[gradeLevel];
  }

  // Reset simulator for new test
  reset(initialXP: number = 5000) {
    this.currentXP = initialXP;
    this.stories = [];
  }
}

describe('User Journey Scenarios - User Acceptance Tests', () => {
  let userSimulator: UserJourneySimulator;
  const testUserId = 'user_journey_test_123';

  beforeEach(() => {
    jest.clearAllMocks();
    userSimulator = new UserJourneySimulator(testUserId);

    // Setup successful mocks by default
    const mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { total_xp: 5000 },
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValue(mockQueryBuilder as any);
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'test-prediction',
        status: 'succeeded',
        output: ['https://example.com/generated-image.jpg'],
      }),
    } as any);
  });

  describe('New User Journey', () => {
    test('should guide new user through first story and image generation', async () => {
      // New user starts with 5000 XP
      userSimulator.reset(5000);

      // User completes their first story
      const firstStory = await userSimulator.completeStory('K-2', 100);
      expect(firstStory.xpEarned).toBeGreaterThan(0);
      expect(firstStory.content).toContain('Once upon a time');

      let stats = userSimulator.getStats();
      expect(stats.totalStories).toBe(1);
      expect(stats.storiesWithImages).toBe(0);
      expect(stats.currentXP).toBeGreaterThan(5000); // Should have earned XP

      // User attempts first image generation
      const imageResult = await userSimulator.attemptImageGeneration(
        firstStory.sessionId,
      );
      expect(imageResult.success).toBe(true);
      expect(imageResult.imageUrl).toBeTruthy();
      expect(imageResult.xpSpent).toBe(1000);

      stats = userSimulator.getStats();
      expect(stats.storiesWithImages).toBe(1);
      expect(stats.maxGenerations).toBeGreaterThan(0);
    });

    test('should handle new user with insufficient XP gracefully', async () => {
      // New user starts with minimal XP
      userSimulator.reset(500);

      const story = await userSimulator.completeStory('K-2', 50);
      const stats = userSimulator.getStats();

      // Even after completing story, user doesn't have enough XP
      expect(stats.currentXP).toBeLessThan(1000);
      expect(stats.maxGenerations).toBe(0);

      const imageResult = await userSimulator.attemptImageGeneration(
        story.sessionId,
      );
      expect(imageResult.success).toBe(false);
      expect(imageResult.error).toContain('Insufficient XP');
      expect(imageResult.xpSpent).toBe(0);
    });

    test('should encourage new user to continue writing to earn XP', async () => {
      userSimulator.reset(800); // Just below image generation cost

      // Complete multiple short stories to earn XP
      const stories = [];
      for (let i = 0; i < 3; i++) {
        const story = await userSimulator.completeStory('K-2', 80);
        stories.push(story);
      }

      const stats = userSimulator.getStats();
      expect(stats.totalStories).toBe(3);
      expect(stats.currentXP).toBeGreaterThan(1000); // Now has enough for image

      // Should now be able to generate image
      const imageResult = await userSimulator.attemptImageGeneration(
        stories[0].sessionId,
      );
      expect(imageResult.success).toBe(true);
    });
  });

  describe('Regular User Journey', () => {
    test('should handle typical daily usage pattern', async () => {
      userSimulator.reset(3000);

      // Morning session: Complete a couple stories
      const morningStory1 = await userSimulator.completeStory('3-5', 150);
      const morningStory2 = await userSimulator.completeStory('3-5', 120);

      // Generate image for first story
      const morning1Image = await userSimulator.attemptImageGeneration(
        morningStory1.sessionId,
      );
      expect(morning1Image.success).toBe(true);

      let stats = userSimulator.getStats();
      expect(stats.totalStories).toBe(2);
      expect(stats.storiesWithImages).toBe(1);

      // Afternoon session: Complete longer story
      const afternoonStory = await userSimulator.completeStory('6-8', 250);

      // Evening session: Generate images for remaining stories
      const morning2Image = await userSimulator.attemptImageGeneration(
        morningStory2.sessionId,
      );
      const afternoonImage = await userSimulator.attemptImageGeneration(
        afternoonStory.sessionId,
      );

      expect(morning2Image.success).toBe(true);
      expect(afternoonImage.success).toBe(true);

      stats = userSimulator.getStats();
      expect(stats.totalStories).toBe(3);
      expect(stats.storiesWithImages).toBe(3);
      expect(stats.storyBreakdown['3-5']).toBe(2);
      expect(stats.storyBreakdown['6-8']).toBe(1);
    });

    test('should handle user running out of XP mid-session', async () => {
      userSimulator.reset(1500); // Enough for 1 image generation

      const story1 = await userSimulator.completeStory('K-2', 100);
      const story2 = await userSimulator.completeStory('K-2', 100);

      // First image generation succeeds
      const image1 = await userSimulator.attemptImageGeneration(
        story1.sessionId,
      );
      expect(image1.success).toBe(true);

      // Second image generation fails due to insufficient XP
      const image2 = await userSimulator.attemptImageGeneration(
        story2.sessionId,
      );
      expect(image2.success).toBe(false);
      expect(image2.error).toContain('Insufficient XP');

      const stats = userSimulator.getStats();
      expect(stats.storiesWithImages).toBe(1);
      expect(stats.maxGenerations).toBe(0);
    });

    test('should support mixed grade level usage', async () => {
      userSimulator.reset(6000);

      const gradeLevels: GradeLevel[] = ['K-2', '3-5', '6-8', '9-12'];
      const stories = [];

      // Create one story for each grade level
      for (const gradeLevel of gradeLevels) {
        const story = await userSimulator.completeStory(gradeLevel, 120);
        stories.push(story);
      }

      // Generate images for all stories
      const imageResults = [];
      for (const story of stories) {
        const result = await userSimulator.attemptImageGeneration(
          story.sessionId,
        );
        imageResults.push(result);
      }

      expect(imageResults.every(r => r.success)).toBe(true);

      const stats = userSimulator.getStats();
      expect(stats.totalStories).toBe(4);
      expect(stats.storiesWithImages).toBe(4);

      // Each grade level should have one story
      gradeLevels.forEach(level => {
        expect(stats.storyBreakdown[level]).toBe(1);
      });
    });
  });

  describe('Power User Journey', () => {
    test('should handle high-volume usage patterns', async () => {
      userSimulator.reset(20000); // Power user with lots of XP

      // Create many stories across different grade levels
      const stories = [];
      for (let i = 0; i < 15; i++) {
        const gradeLevel = ['K-2', '3-5', '6-8', '9-12'][i % 4] as GradeLevel;
        const wordCount = 100 + i * 20; // Varying word counts
        const story = await userSimulator.completeStory(gradeLevel, wordCount);
        stories.push(story);
      }

      // Generate images for first 10 stories
      const imageResults = [];
      for (let i = 0; i < 10; i++) {
        const result = await userSimulator.attemptImageGeneration(
          stories[i].sessionId,
        );
        imageResults.push(result);
      }

      expect(imageResults.every(r => r.success)).toBe(true);

      const stats = userSimulator.getStats();
      expect(stats.totalStories).toBe(15);
      expect(stats.storiesWithImages).toBe(10);
      expect(stats.currentXP).toBeGreaterThan(10000); // Should still have substantial XP
    });

    test('should handle rapid successive image generations', async () => {
      userSimulator.reset(10000);

      // Create multiple stories quickly
      const stories = [];
      for (let i = 0; i < 5; i++) {
        const story = await userSimulator.completeStory('6-8', 200);
        stories.push(story);
      }

      // Attempt rapid image generation
      const imagePromises = stories.map(story =>
        userSimulator.attemptImageGeneration(story.sessionId),
      );

      const results = await Promise.all(imagePromises);

      // All should succeed
      expect(results.every(r => r.success)).toBe(true);
      expect(results.every(r => r.imageUrl)).toBe(true);

      const stats = userSimulator.getStats();
      expect(stats.storiesWithImages).toBe(5);
    });
  });

  describe('Error Recovery Journey', () => {
    test('should handle service failures gracefully', async () => {
      userSimulator.reset(3000);

      // Create story
      const story = await userSimulator.completeStory('3-5', 150);

      // Mock service failure
      mockFetch.mockRejectedValueOnce(
        new Error('Service temporarily unavailable'),
      );

      // Attempt image generation (should fail but refund XP)
      const imageResult = await userSimulator.attemptImageGeneration(
        story.sessionId,
      );
      expect(imageResult.success).toBe(false);
      expect(imageResult.xpSpent).toBe(0); // XP should be refunded

      // Mock service recovery
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'recovered-prediction',
          status: 'succeeded',
          output: ['https://example.com/recovered-image.jpg'],
        }),
      } as any);

      // Retry should succeed
      const retryResult = await userSimulator.attemptImageGeneration(
        story.sessionId,
      );
      expect(retryResult.success).toBe(true);
      expect(retryResult.imageUrl).toContain('recovered-image.jpg');
    });

    test('should maintain user progress despite technical issues', async () => {
      userSimulator.reset(2000);

      const story1 = await userSimulator.completeStory('K-2', 100);
      const story2 = await userSimulator.completeStory('3-5', 120);

      // First image succeeds
      const image1 = await userSimulator.attemptImageGeneration(
        story1.sessionId,
      );
      expect(image1.success).toBe(true);

      // Second image fails due to service issue
      mockFetch.mockRejectedValueOnce(new Error('Rate limit exceeded'));
      const image2 = await userSimulator.attemptImageGeneration(
        story2.sessionId,
      );
      expect(image2.success).toBe(false);

      // User's progress should be preserved
      const stats = userSimulator.getStats();
      expect(stats.totalStories).toBe(2);
      expect(stats.storiesWithImages).toBe(1);
      expect(stats.currentXP).toBeGreaterThan(1000); // XP refunded for failed generation
    });
  });

  describe('Edge Case Scenarios', () => {
    test('should handle extremely long stories', async () => {
      userSimulator.reset(5000);

      // Very long story
      const longStory = await userSimulator.completeStory('9-12', 1000);
      expect(longStory.xpEarned).toBeGreaterThan(5000); // Should earn significant XP

      const imageResult = await userSimulator.attemptImageGeneration(
        longStory.sessionId,
      );
      expect(imageResult.success).toBe(true);

      const stats = userSimulator.getStats();
      expect(stats.currentXP).toBeGreaterThan(9000); // High XP balance after long story
    });

    test('should handle very short stories', async () => {
      userSimulator.reset(1500);

      // Very short story
      const shortStory = await userSimulator.completeStory('K-2', 20);
      expect(shortStory.xpEarned).toBeGreaterThan(0); // Should still earn some XP

      const imageResult = await userSimulator.attemptImageGeneration(
        shortStory.sessionId,
      );
      expect(imageResult.success).toBe(true);
    });

    test('should handle user with exactly enough XP', async () => {
      userSimulator.reset(1000); // Exactly enough for one image

      const story = await userSimulator.completeStory('K-2', 80);
      const stats1 = userSimulator.getStats();
      expect(stats1.maxGenerations).toBe(1);

      const imageResult = await userSimulator.attemptImageGeneration(
        story.sessionId,
      );
      expect(imageResult.success).toBe(true);

      const stats2 = userSimulator.getStats();
      expect(stats2.maxGenerations).toBe(0); // Should have 0 generations left
    });
  });

  describe('Accessibility and Usability', () => {
    test('should provide clear feedback for all user actions', async () => {
      userSimulator.reset(1500);

      const story = await userSimulator.completeStory('K-2', 100);
      expect(story.sessionId).toBeTruthy();
      expect(story.content).toBeTruthy();
      expect(story.xpEarned).toBeGreaterThan(0);

      const imageResult = await userSimulator.attemptImageGeneration(
        story.sessionId,
      );
      expect(imageResult.success).toBe(true);
      expect(imageResult.imageUrl).toBeTruthy();
      expect(imageResult.newXPBalance).toBeDefined();
      expect(imageResult.xpSpent).toBe(1000);
    });

    test('should maintain consistent user experience across grade levels', async () => {
      userSimulator.reset(8000);

      const gradeLevels: GradeLevel[] = ['K-2', '3-5', '6-8', '9-12'];

      for (const gradeLevel of gradeLevels) {
        const story = await userSimulator.completeStory(gradeLevel, 150);
        const imageResult = await userSimulator.attemptImageGeneration(
          story.sessionId,
        );

        // All grade levels should work consistently
        expect(imageResult.success).toBe(true);
        expect(imageResult.imageUrl).toBeTruthy();
        expect(imageResult.xpSpent).toBe(1000); // Cost should be same for all levels
      }
    });
  });
});
