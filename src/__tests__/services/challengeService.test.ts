import { challengeService } from '../../services/challengeService';
import { CHALLENGE_DEFINITIONS } from '../../types/challenges';

describe('ChallengeService', () => {
  describe('getChallengesForGrade', () => {
    it('should return challenges for K-2 grade level', () => {
      const challenges = challengeService.getChallengesForGrade('K-2');
      expect(challenges.length).toBeGreaterThan(0);
      challenges.forEach(challenge => {
        expect(challenge.gradeLevel).toContain('K-2');
      });
    });

    it('should return challenges for 9-12 grade level', () => {
      const challenges = challengeService.getChallengesForGrade('9-12');
      expect(challenges.length).toBeGreaterThan(0);
      challenges.forEach(challenge => {
        expect(challenge.gradeLevel).toContain('9-12');
      });
    });
  });

  describe('selectRandomChallenge', () => {
    it('should select a random challenge for K-2', () => {
      const challenge = challengeService.selectRandomChallenge('K-2');
      expect(challenge).toBeTruthy();
      expect(challenge?.gradeLevel).toContain('K-2');
    });

    it('should exclude completed challenges', () => {
      const completedIds = ['dialogue', 'colors'];
      const challenge = challengeService.selectRandomChallenge(
        'K-2',
        completedIds,
      );
      expect(challenge).toBeTruthy();
      expect(completedIds).not.toContain(challenge?.id);
    });

    it('should reset and select from all challenges when all are completed', () => {
      const allK2Challenges = challengeService.getChallengesForGrade('K-2');
      const completedIds = allK2Challenges.map(c => c.id);
      const challenge = challengeService.selectRandomChallenge(
        'K-2',
        completedIds,
      );
      expect(challenge).toBeTruthy();
    });
  });

  describe('validateChallenge', () => {
    it('should validate dialogue challenge correctly', () => {
      const dialogueChallenge = CHALLENGE_DEFINITIONS.find(
        c => c.id === 'dialogue',
      );
      expect(dialogueChallenge).toBeTruthy();

      const textWithDialogue = 'The character said "Hello world!" to everyone.';
      const textWithoutDialogue =
        'The character walked down the street quietly.';

      expect(
        challengeService.validateChallenge(
          dialogueChallenge!,
          textWithDialogue,
        ),
      ).toBe(true);
      expect(
        challengeService.validateChallenge(
          dialogueChallenge!,
          textWithoutDialogue,
        ),
      ).toBe(false);
    });

    it('should validate character feelings challenge correctly', () => {
      const feelingsChallenge = CHALLENGE_DEFINITIONS.find(
        c => c.id === 'character_feelings',
      );
      expect(feelingsChallenge).toBeTruthy();

      const textWithFeelings = 'She felt happy when she saw her friend.';
      const textWithoutFeelings = 'She walked to the store and bought bread.';

      expect(
        challengeService.validateChallenge(
          feelingsChallenge!,
          textWithFeelings,
        ),
      ).toBe(true);
      expect(
        challengeService.validateChallenge(
          feelingsChallenge!,
          textWithoutFeelings,
        ),
      ).toBe(false);
    });

    it('should handle case insensitive validation', () => {
      const dialogueChallenge = CHALLENGE_DEFINITIONS.find(
        c => c.id === 'dialogue',
      );
      const textWithUpperCase = 'The character SAID "Hello!" loudly.';

      expect(
        challengeService.validateChallenge(
          dialogueChallenge!,
          textWithUpperCase,
        ),
      ).toBe(true);
    });
  });

  describe('calculateXPRewards', () => {
    it('should calculate XP for completed challenges', () => {
      const challenges = [
        { challengeId: 'dialogue', isCompleted: true, xpEarned: 25 },
        { challengeId: 'colors', isCompleted: true, xpEarned: 15 },
      ];

      const rewards = challengeService.calculateXPRewards(
        50,
        challenges,
        5,
        true,
      );

      // Should have challenge rewards, word bonus, completion bonus
      expect(rewards.length).toBeGreaterThanOrEqual(3);

      const totalXP = challengeService.getTotalXP(rewards);
      expect(totalXP).toBeGreaterThan(0);
    });

    it('should give speed bonus for quick completion', () => {
      const challenges = [
        { challengeId: 'dialogue', isCompleted: true, xpEarned: 25 },
      ];

      const rewards = challengeService.calculateXPRewards(
        30,
        challenges,
        5,
        true,
      );
      const speedBonus = rewards.find(r =>
        r.description.includes('Speed bonus'),
      );

      expect(speedBonus).toBeTruthy();
      expect(speedBonus?.amount).toBeGreaterThan(0);
    });

    it('should give perfect game bonus', () => {
      const challenges = [
        { challengeId: 'dialogue', isCompleted: true, xpEarned: 25 },
        { challengeId: 'colors', isCompleted: true, xpEarned: 15 },
        { challengeId: 'action_scene', isCompleted: true, xpEarned: 25 },
      ];

      const rewards = challengeService.calculateXPRewards(
        60,
        challenges,
        8,
        true,
      );
      const perfectBonus = rewards.find(r =>
        r.description.includes('Perfect game'),
      );

      expect(perfectBonus).toBeTruthy();
      expect(perfectBonus?.amount).toBe(50);
    });
  });

  describe('createChallengeProgress', () => {
    it('should create completed challenge progress', () => {
      const progress = challengeService.createChallengeProgress(
        'dialogue',
        'She said "Hello!"',
        true,
      );

      expect(progress.challengeId).toBe('dialogue');
      expect(progress.isCompleted).toBe(true);
      expect(progress.userText).toBe('She said "Hello!"');
      expect(progress.xpEarned).toBe(25); // dialogue challenge XP
      expect(progress.completedAt).toBeTruthy();
    });

    it('should create incomplete challenge progress', () => {
      const progress = challengeService.createChallengeProgress(
        'dialogue',
        'She walked quietly.',
        false,
      );

      expect(progress.challengeId).toBe('dialogue');
      expect(progress.isCompleted).toBe(false);
      expect(progress.userText).toBeUndefined();
      expect(progress.xpEarned).toBe(0);
      expect(progress.completedAt).toBeUndefined();
    });
  });

  describe('getProgressSummary', () => {
    it('should provide correct summary for completed challenges', () => {
      const challenges = [
        { challengeId: 'dialogue', isCompleted: true, xpEarned: 25 },
        { challengeId: 'colors', isCompleted: true, xpEarned: 15 },
      ];

      const summary = challengeService.getProgressSummary(challenges);

      expect(summary.totalXP).toBe(40);
      expect(summary.challengesCompleted).toBe(2);
      expect(summary.summary).toBe('2 challenges completed!');
    });

    it('should handle no completed challenges', () => {
      const summary = challengeService.getProgressSummary([]);

      expect(summary.totalXP).toBe(0);
      expect(summary.challengesCompleted).toBe(0);
      expect(summary.summary).toBe('No challenges completed yet');
    });
  });
});
