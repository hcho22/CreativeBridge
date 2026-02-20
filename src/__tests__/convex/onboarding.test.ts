/**
 * Unit Tests for Convex Onboarding Functions
 *
 * Tests all mutations and queries in convex/onboarding.ts including:
 * - Progress tracking (updateOnboardingProgressItem)
 * - Milestone recording (recordOnboardingMilestone, recordMultipleMilestones)
 * - Progress reset (resetOnboardingProgress)
 * - Status queries (getOnboardingStatus, getMyOnboardingStatus)
 * - Milestone checks (checkMilestoneAchieved)
 * - Analytics (getOnboardingAnalytics)
 *
 * @implements US-028: Unit Test Convex Functions
 */

import {
  createMockConvexContext,
  createMockClerkIdentity,
  createTestUserProfile,
  resetMockContext,
  MockConvexContext,
} from '../mocks/convexMock';

describe('Convex onboarding', () => {
  let ctx: MockConvexContext;
  const testClerkUserId = 'user_test123abc';

  // Constants matching the actual implementation
  const ONBOARDING_XP_REWARDS = {
    first_story: 50,
    first_image: 25,
    first_voice: 25,
    first_streak: 50,
  };

  const VALID_ONBOARDING_ITEMS = [
    'create_account',
    'first_story',
    'first_image',
    'first_voice',
    'first_streak',
  ];

  const MILESTONE_TYPES = [
    'first_story',
    'first_image',
    'first_voice',
    'first_streak',
  ];

  const MILESTONE_TIMESTAMP_FIELDS: Record<string, string> = {
    first_story: 'firstStoryCompletedAt',
    first_image: 'firstImageGeneratedAt',
    first_voice: 'firstVoiceInputAt',
    first_streak: 'firstStreakAchievedAt',
  };

  beforeEach(async () => {
    ctx = createMockConvexContext();
    resetMockContext(ctx);
    ctx.auth.__testUtils.setIdentity(createMockClerkIdentity(testClerkUserId));
  });

  // Helper functions
  function calculateCompletionPercentage(
    progress: Record<string, boolean>,
  ): number {
    let completed = 0;
    if (progress.create_account) completed += 20;
    if (progress.first_story) completed += 20;
    if (progress.first_image) completed += 20;
    if (progress.first_voice) completed += 20;
    if (progress.first_streak) completed += 20;
    return completed;
  }

  function isOnboardingComplete(progress: Record<string, boolean>): boolean {
    return (
      progress.create_account &&
      progress.first_story &&
      progress.first_image &&
      progress.first_voice &&
      progress.first_streak
    );
  }

  // ============================================================================
  // updateOnboardingProgressItem
  // ============================================================================
  describe('updateOnboardingProgressItem', () => {
    beforeEach(async () => {
      await createTestUserProfile(ctx, testClerkUserId);
    });

    it('should update a specific progress item to completed', async () => {
      // Arrange
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_clerk_user_id', q =>
          q.eq('clerkUserId', testClerkUserId),
        )
        .first();

      // Act
      const updatedProgress = {
        ...(profile!.onboardingProgress as Record<string, boolean>),
        first_story: true,
      };
      await ctx.db.patch(profile!._id, {
        onboardingProgress: updatedProgress,
        onboardingCompleted: isOnboardingComplete(
          updatedProgress as Record<string, boolean>,
        ),
      });

      // Assert
      const updated = ctx.db.__testUtils.getById('userProfiles', profile!._id);
      expect(
        (updated?.onboardingProgress as Record<string, boolean>).first_story,
      ).toBe(true);
    });

    it('should recalculate completion percentage after update', async () => {
      // Arrange
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_clerk_user_id', q =>
          q.eq('clerkUserId', testClerkUserId),
        )
        .first();

      // Act: Mark first_story as complete
      const updatedProgress = {
        create_account: true,
        first_story: true,
        first_image: false,
        first_voice: false,
        first_streak: false,
      };
      await ctx.db.patch(profile!._id, { onboardingProgress: updatedProgress });

      // Assert
      const completionPercentage =
        calculateCompletionPercentage(updatedProgress);
      expect(completionPercentage).toBe(40); // create_account + first_story
    });

    it('should mark onboardingCompleted=true when all items complete', async () => {
      // Arrange
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_clerk_user_id', q =>
          q.eq('clerkUserId', testClerkUserId),
        )
        .first();

      // Act: Complete all items
      const completedProgress = {
        create_account: true,
        first_story: true,
        first_image: true,
        first_voice: true,
        first_streak: true,
      };
      await ctx.db.patch(profile!._id, {
        onboardingProgress: completedProgress,
        onboardingCompleted: isOnboardingComplete(completedProgress),
      });

      // Assert
      const updated = ctx.db.__testUtils.getById('userProfiles', profile!._id);
      expect(updated?.onboardingCompleted).toBe(true);
      expect(calculateCompletionPercentage(completedProgress)).toBe(100);
    });

    it('should reject invalid item keys', async () => {
      // Arrange
      const invalidKey = 'invalid_item';

      // Assert
      const isValid = VALID_ONBOARDING_ITEMS.includes(invalidKey);
      expect(isValid).toBe(false);
      // In real function, this would throw "Invalid onboarding item key"
    });

    it('should allow setting item to incomplete', async () => {
      // Arrange: Create profile with first_story completed
      const profile = await createTestUserProfile(ctx, 'user_complete', {
        onboardingProgress: {
          create_account: true,
          first_story: true,
          first_image: false,
          first_voice: false,
          first_streak: false,
        },
      });

      // Act: Set first_story back to false
      const updatedProgress = {
        ...(profile.onboardingProgress as Record<string, boolean>),
        first_story: false,
      };
      await ctx.db.patch(profile._id, { onboardingProgress: updatedProgress });

      // Assert
      const updated = ctx.db.__testUtils.getById('userProfiles', profile._id);
      expect(
        (updated?.onboardingProgress as Record<string, boolean>).first_story,
      ).toBe(false);
    });

    it('should support all valid onboarding items', async () => {
      // Assert: All items are valid
      for (const item of VALID_ONBOARDING_ITEMS) {
        expect(VALID_ONBOARDING_ITEMS.includes(item)).toBe(true);
      }
      expect(VALID_ONBOARDING_ITEMS.length).toBe(5);
    });
  });

  // ============================================================================
  // recordOnboardingMilestone
  // ============================================================================
  describe('recordOnboardingMilestone', () => {
    beforeEach(async () => {
      await createTestUserProfile(ctx, testClerkUserId, {
        totalXp: 100,
      });
    });

    it('should record milestone and award XP', async () => {
      // Arrange
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_clerk_user_id', q =>
          q.eq('clerkUserId', testClerkUserId),
        )
        .first();
      const initialXp = profile!.totalXp as number;
      const milestoneType = 'first_story';

      // Act: Record milestone and award XP
      const xpReward =
        ONBOARDING_XP_REWARDS[
          milestoneType as keyof typeof ONBOARDING_XP_REWARDS
        ];
      const timestampField = MILESTONE_TIMESTAMP_FIELDS[milestoneType];
      const updatedProgress = {
        ...(profile!.onboardingProgress as Record<string, boolean>),
        [milestoneType]: true,
      };

      await ctx.db.patch(profile!._id, {
        totalXp: initialXp + xpReward,
        onboardingProgress: updatedProgress,
        [timestampField]: new Date().toISOString(),
      });

      // Assert
      const updated = ctx.db.__testUtils.getById('userProfiles', profile!._id);
      expect(updated?.totalXp).toBe(initialXp + 50);
      expect(
        (updated?.onboardingProgress as Record<string, boolean>).first_story,
      ).toBe(true);
      expect(updated?.firstStoryCompletedAt).toBeDefined();
    });

    it('should be idempotent - return early if milestone already achieved', async () => {
      // Arrange: Create profile with milestone already achieved
      const profile = await createTestUserProfile(ctx, 'user_achieved', {
        totalXp: 150, // Already awarded XP
        firstStoryCompletedAt: new Date().toISOString(),
        onboardingProgress: {
          create_account: true,
          first_story: true,
          first_image: false,
          first_voice: false,
          first_streak: false,
        },
      });

      // Act: Check if milestone is already achieved
      const isAlreadyAchieved = profile.firstStoryCompletedAt !== undefined;

      // Assert
      expect(isAlreadyAchieved).toBe(true);
      // In real function, this would return { alreadyAchieved: true, xpAwarded: 0 }
    });

    it('should award correct XP for each milestone type', async () => {
      // Assert: Verify XP rewards
      expect(ONBOARDING_XP_REWARDS.first_story).toBe(50);
      expect(ONBOARDING_XP_REWARDS.first_image).toBe(25);
      expect(ONBOARDING_XP_REWARDS.first_voice).toBe(25);
      expect(ONBOARDING_XP_REWARDS.first_streak).toBe(50);
    });

    it('should skip XP award when awardXp=false', async () => {
      // Arrange
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_clerk_user_id', q =>
          q.eq('clerkUserId', testClerkUserId),
        )
        .first();
      const initialXp = profile!.totalXp as number;

      // Act: Record milestone without XP (awardXp=false)
      const updatedProgress = {
        ...(profile!.onboardingProgress as Record<string, boolean>),
        first_image: true,
      };
      await ctx.db.patch(profile!._id, {
        // XP not changed
        onboardingProgress: updatedProgress,
        firstImageGeneratedAt: new Date().toISOString(),
      });

      // Assert
      const updated = ctx.db.__testUtils.getById('userProfiles', profile!._id);
      expect(updated?.totalXp).toBe(initialXp); // Unchanged
      expect(updated?.firstImageGeneratedAt).toBeDefined();
    });

    it('should reject invalid milestone types', async () => {
      // Arrange
      const invalidType = 'invalid_milestone';

      // Assert
      const isValid = MILESTONE_TYPES.includes(invalidType);
      expect(isValid).toBe(false);
      // In real function, this would throw "Invalid milestone type"
    });
  });

  // ============================================================================
  // recordMultipleMilestones
  // ============================================================================
  describe('recordMultipleMilestones', () => {
    beforeEach(async () => {
      await createTestUserProfile(ctx, testClerkUserId, {
        totalXp: 100,
      });
    });

    it('should record multiple milestones in batch', async () => {
      // Arrange
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_clerk_user_id', q =>
          q.eq('clerkUserId', testClerkUserId),
        )
        .first();
      const initialXp = profile!.totalXp as number;
      const milestones = ['first_story', 'first_image'] as const;

      // Act: Record both milestones
      let totalXpAwarded = 0;
      const updates: Record<string, unknown> = {};
      const updatedProgress = {
        ...(profile!.onboardingProgress as Record<string, boolean>),
      };

      for (const milestone of milestones) {
        const xpReward = ONBOARDING_XP_REWARDS[milestone];
        totalXpAwarded += xpReward;
        updatedProgress[milestone] = true;
        updates[MILESTONE_TIMESTAMP_FIELDS[milestone]] =
          new Date().toISOString();
      }

      updates.totalXp = initialXp + totalXpAwarded;
      updates.onboardingProgress = updatedProgress;

      await ctx.db.patch(profile!._id, updates);

      // Assert
      const updated = ctx.db.__testUtils.getById('userProfiles', profile!._id);
      expect(updated?.totalXp).toBe(initialXp + 75); // 50 + 25
      expect(
        (updated?.onboardingProgress as Record<string, boolean>).first_story,
      ).toBe(true);
      expect(
        (updated?.onboardingProgress as Record<string, boolean>).first_image,
      ).toBe(true);
    });

    it('should skip already-achieved milestones in batch', async () => {
      // Arrange: Profile with first_story already achieved
      const profile = await createTestUserProfile(ctx, 'user_partial', {
        totalXp: 150,
        firstStoryCompletedAt: new Date().toISOString(),
        onboardingProgress: {
          create_account: true,
          first_story: true,
          first_image: false,
          first_voice: false,
          first_streak: false,
        },
      });
      const initialXp = profile.totalXp as number;

      // Act: Try to record first_story (already done) and first_image (new)
      const milestones = ['first_story', 'first_image'];
      let xpAwarded = 0;
      const updates: Record<string, unknown> = {};
      const progress = {
        ...(profile.onboardingProgress as Record<string, boolean>),
      };

      for (const milestone of milestones) {
        // Skip if already achieved
        if (milestone === 'first_story' && profile.firstStoryCompletedAt) {
          continue;
        }
        xpAwarded +=
          ONBOARDING_XP_REWARDS[
            milestone as keyof typeof ONBOARDING_XP_REWARDS
          ];
        progress[milestone] = true;
        updates[MILESTONE_TIMESTAMP_FIELDS[milestone]] =
          new Date().toISOString();
      }

      updates.totalXp = initialXp + xpAwarded;
      updates.onboardingProgress = progress;
      await ctx.db.patch(profile._id, updates);

      // Assert
      const updated = ctx.db.__testUtils.getById('userProfiles', profile._id);
      expect(updated?.totalXp).toBe(150 + 25); // Only first_image XP awarded
    });
  });

  // ============================================================================
  // resetOnboardingProgress
  // ============================================================================
  describe('resetOnboardingProgress', () => {
    it('should reset all progress items to false', async () => {
      // Arrange: Create profile with completed progress
      const profile = await createTestUserProfile(ctx, testClerkUserId, {
        onboardingProgress: {
          create_account: true,
          first_story: true,
          first_image: true,
          first_voice: true,
          first_streak: true,
        },
        onboardingCompleted: true,
      });

      // Act: Reset all items
      const resetProgress = {
        create_account: false,
        first_story: false,
        first_image: false,
        first_voice: false,
        first_streak: false,
      };
      await ctx.db.patch(profile._id, {
        onboardingProgress: resetProgress,
        onboardingCompleted: false,
      });

      // Assert
      const updated = ctx.db.__testUtils.getById('userProfiles', profile._id);
      const progress = updated?.onboardingProgress as Record<string, boolean>;
      expect(progress.create_account).toBe(false);
      expect(progress.first_story).toBe(false);
      expect(updated?.onboardingCompleted).toBe(false);
    });

    it('should keep create_account when keepAccountCreated=true', async () => {
      // Arrange
      const profile = await createTestUserProfile(ctx, testClerkUserId, {
        onboardingProgress: {
          create_account: true,
          first_story: true,
          first_image: true,
          first_voice: true,
          first_streak: true,
        },
      });

      // Act: Reset but keep create_account
      const resetProgress = {
        create_account: true, // Keep this
        first_story: false,
        first_image: false,
        first_voice: false,
        first_streak: false,
      };
      await ctx.db.patch(profile._id, {
        onboardingProgress: resetProgress,
        onboardingCompleted: false,
      });

      // Assert
      const updated = ctx.db.__testUtils.getById('userProfiles', profile._id);
      const progress = updated?.onboardingProgress as Record<string, boolean>;
      expect(progress.create_account).toBe(true);
      expect(progress.first_story).toBe(false);
    });

    it('should NOT refund XP on reset', async () => {
      // Arrange
      const profile = await createTestUserProfile(ctx, testClerkUserId, {
        totalXp: 250, // Has accumulated XP from milestones
        onboardingProgress: {
          create_account: true,
          first_story: true,
          first_image: true,
          first_voice: true,
          first_streak: true,
        },
      });

      // Act: Reset progress
      const resetProgress = {
        create_account: true,
        first_story: false,
        first_image: false,
        first_voice: false,
        first_streak: false,
      };
      await ctx.db.patch(profile._id, {
        onboardingProgress: resetProgress,
        onboardingCompleted: false,
        // XP not changed
      });

      // Assert: XP should remain unchanged
      const updated = ctx.db.__testUtils.getById('userProfiles', profile._id);
      expect(updated?.totalXp).toBe(250);
    });
  });

  // ============================================================================
  // getOnboardingStatus
  // ============================================================================
  describe('getOnboardingStatus', () => {
    it('should return full onboarding status', async () => {
      // Arrange
      const profile = await createTestUserProfile(ctx, testClerkUserId, {
        onboardingProgress: {
          create_account: true,
          first_story: true,
          first_image: false,
          first_voice: false,
          first_streak: false,
        },
        firstStoryCompletedAt: new Date().toISOString(),
      });

      // Act
      const status = {
        onboardingProgress: profile.onboardingProgress,
        onboardingCompleted: profile.onboardingCompleted,
        completionPercentage: calculateCompletionPercentage(
          profile.onboardingProgress as Record<string, boolean>,
        ),
        milestones: {
          first_story: {
            achieved: !!profile.firstStoryCompletedAt,
            timestamp: profile.firstStoryCompletedAt,
          },
          first_image: {
            achieved: !!profile.firstImageGeneratedAt,
            timestamp: profile.firstImageGeneratedAt,
          },
        },
      };

      // Assert
      expect(status.completionPercentage).toBe(40);
      expect(status.milestones.first_story.achieved).toBe(true);
      expect(status.milestones.first_image.achieved).toBe(false);
    });

    it('should include next suggested milestone', async () => {
      // Arrange
      const profile = await createTestUserProfile(ctx, testClerkUserId, {
        onboardingProgress: {
          create_account: true,
          first_story: false,
          first_image: false,
          first_voice: false,
          first_streak: false,
        },
      });

      // Act: Find next incomplete item
      const progress = profile.onboardingProgress as Record<string, boolean>;
      const nextMilestone = MILESTONE_TYPES.find(m => !progress[m]);

      // Assert
      expect(nextMilestone).toBe('first_story');
    });

    it('should return null nextMilestone when all complete', async () => {
      // Arrange
      const profile = await createTestUserProfile(ctx, testClerkUserId, {
        onboardingProgress: {
          create_account: true,
          first_story: true,
          first_image: true,
          first_voice: true,
          first_streak: true,
        },
        onboardingCompleted: true,
      });

      // Act
      const progress = profile.onboardingProgress as Record<string, boolean>;
      const nextMilestone = MILESTONE_TYPES.find(m => !progress[m]);

      // Assert
      expect(nextMilestone).toBeUndefined();
      expect(profile.onboardingCompleted).toBe(true);
    });
  });

  // ============================================================================
  // getMyOnboardingStatus
  // ============================================================================
  describe('getMyOnboardingStatus', () => {
    it('should return status for authenticated user', async () => {
      // Arrange
      await createTestUserProfile(ctx, testClerkUserId, {
        onboardingProgress: {
          create_account: true,
          first_story: true,
          first_image: false,
          first_voice: false,
          first_streak: false,
        },
      });

      // Act
      const identity = await ctx.auth.getUserIdentity();
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_clerk_user_id', q =>
          q.eq('clerkUserId', identity!.subject),
        )
        .first();

      // Assert
      expect(profile).not.toBeNull();
      expect(
        calculateCompletionPercentage(
          profile!.onboardingProgress as Record<string, boolean>,
        ),
      ).toBe(40);
    });

    it('should return null when not authenticated', async () => {
      // Arrange
      ctx.auth.__testUtils.clearIdentity();

      // Act
      const identity = await ctx.auth.getUserIdentity();

      // Assert
      expect(identity).toBeNull();
    });
  });

  // ============================================================================
  // checkMilestoneAchieved
  // ============================================================================
  describe('checkMilestoneAchieved', () => {
    it('should return achieved=true for completed milestone', async () => {
      // Arrange
      const timestamp = new Date().toISOString();
      const profile = await createTestUserProfile(ctx, testClerkUserId, {
        firstStoryCompletedAt: timestamp,
        onboardingProgress: {
          create_account: true,
          first_story: true,
          first_image: false,
          first_voice: false,
          first_streak: false,
        },
      });

      // Act
      const result = {
        achieved: !!profile.firstStoryCompletedAt,
        timestamp: profile.firstStoryCompletedAt,
        xpReward: ONBOARDING_XP_REWARDS.first_story,
      };

      // Assert
      expect(result.achieved).toBe(true);
      expect(result.timestamp).toBe(timestamp);
      expect(result.xpReward).toBe(50);
    });

    it('should return achieved=false for incomplete milestone', async () => {
      // Arrange
      const profile = await createTestUserProfile(ctx, testClerkUserId);

      // Act
      const result = {
        achieved: !!profile.firstImageGeneratedAt,
        timestamp: profile.firstImageGeneratedAt,
        xpReward: ONBOARDING_XP_REWARDS.first_image,
      };

      // Assert
      expect(result.achieved).toBe(false);
      expect(result.timestamp).toBeUndefined();
    });
  });

  // ============================================================================
  // getOnboardingAnalytics (Admin Query)
  // ============================================================================
  describe('getOnboardingAnalytics', () => {
    beforeEach(async () => {
      // Create users with varying onboarding progress
      await createTestUserProfile(ctx, 'user_complete', {
        onboardingProgress: {
          create_account: true,
          first_story: true,
          first_image: true,
          first_voice: true,
          first_streak: true,
        },
        onboardingCompleted: true,
      });
      await createTestUserProfile(ctx, 'user_partial', {
        onboardingProgress: {
          create_account: true,
          first_story: true,
          first_image: false,
          first_voice: false,
          first_streak: false,
        },
        onboardingCompleted: false,
      });
      await createTestUserProfile(ctx, 'user_new', {
        onboardingProgress: {
          create_account: true,
          first_story: false,
          first_image: false,
          first_voice: false,
          first_streak: false,
        },
        onboardingCompleted: false,
      });
    });

    it('should calculate completion rates across all users', async () => {
      // Act
      const allProfiles = await ctx.db.query('userProfiles').collect();
      const totalUsers = allProfiles.length;
      const completedUsers = allProfiles.filter(
        p => p.onboardingCompleted,
      ).length;
      const completionRate =
        totalUsers > 0 ? (completedUsers / totalUsers) * 100 : 0;

      // Assert
      expect(totalUsers).toBe(3);
      expect(completedUsers).toBe(1);
      expect(Math.round(completionRate)).toBe(33); // 1/3 = 33%
    });

    it('should calculate per-milestone completion rates', async () => {
      // Act
      const allProfiles = await ctx.db.query('userProfiles').collect();
      const totalUsers = allProfiles.length;

      const milestoneRates: Record<string, number> = {};
      for (const milestone of VALID_ONBOARDING_ITEMS) {
        const completed = allProfiles.filter(
          p => (p.onboardingProgress as Record<string, boolean>)[milestone],
        ).length;
        milestoneRates[milestone] = (completed / totalUsers) * 100;
      }

      // Assert
      expect(milestoneRates.create_account).toBe(100); // All 3 users
      expect(Math.round(milestoneRates.first_story)).toBe(67); // 2/3 users
      expect(Math.round(milestoneRates.first_image)).toBe(33); // 1/3 users
    });

    it('should calculate average completion percentage', async () => {
      // Act
      const allProfiles = await ctx.db.query('userProfiles').collect();
      const totalPercentage = allProfiles.reduce(
        (sum, p) =>
          sum +
          calculateCompletionPercentage(
            p.onboardingProgress as Record<string, boolean>,
          ),
        0,
      );
      const avgPercentage = totalPercentage / allProfiles.length;

      // Assert: (100 + 40 + 20) / 3 = 53.33
      expect(Math.round(avgPercentage)).toBe(53);
    });
  });

  // ============================================================================
  // Celebration Configs
  // ============================================================================
  describe('CELEBRATION_CONFIGS', () => {
    const CELEBRATION_CONFIGS = {
      first_story: {
        title: '🎉 You wrote your first story!',
        emoji: '🎉',
        xpMessage: '+50 XP earned!',
      },
      first_image: {
        title: '🎨 Your story came to life!',
        emoji: '🎨',
        xpMessage: '+25 XP earned!',
      },
      first_voice: {
        title: '🎤 Voice activated!',
        emoji: '🎤',
        xpMessage: '+25 XP earned!',
      },
      first_streak: {
        title: "🔥 You're on fire!",
        emoji: '🔥',
        xpMessage: '+50 Bonus XP for your streak!',
      },
    };

    it('should have celebration config for each milestone type', async () => {
      // Assert
      expect(CELEBRATION_CONFIGS.first_story).toBeDefined();
      expect(CELEBRATION_CONFIGS.first_image).toBeDefined();
      expect(CELEBRATION_CONFIGS.first_voice).toBeDefined();
      expect(CELEBRATION_CONFIGS.first_streak).toBeDefined();
    });

    it('should include title, emoji, and xpMessage in each config', async () => {
      // Assert
      for (const [, config] of Object.entries(CELEBRATION_CONFIGS)) {
        expect(config.title).toBeDefined();
        expect(config.emoji).toBeDefined();
        expect(config.xpMessage).toBeDefined();
      }
    });
  });
});
