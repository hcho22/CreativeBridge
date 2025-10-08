import {
  Challenge,
  ChallengeProgress,
  XPReward,
  CHALLENGE_DEFINITIONS,
  XP_BONUSES,
} from '../types/challenges';
import { GradeLevel } from '../types/database';

export class ChallengeService {
  private static instance: ChallengeService;
  private challenges: Challenge[] = CHALLENGE_DEFINITIONS;

  public static getInstance(): ChallengeService {
    if (!ChallengeService.instance) {
      ChallengeService.instance = new ChallengeService();
    }
    return ChallengeService.instance;
  }

  /**
   * Get available challenges for a specific grade level
   */
  getChallengesForGrade(gradeLevel: GradeLevel): Challenge[] {
    return this.challenges.filter(challenge =>
      challenge.gradeLevel.includes(gradeLevel),
    );
  }

  /**
   * Select a random challenge for the current round
   */
  selectRandomChallenge(
    gradeLevel: GradeLevel,
    completedChallenges: string[] = [],
  ): Challenge | null {
    const availableChallenges = this.getChallengesForGrade(gradeLevel).filter(
      challenge => !completedChallenges.includes(challenge.id),
    );

    if (availableChallenges.length === 0) {
      // If all challenges completed, reset and select from all
      const allChallenges = this.getChallengesForGrade(gradeLevel);
      return allChallenges[Math.floor(Math.random() * allChallenges.length)];
    }

    return availableChallenges[
      Math.floor(Math.random() * availableChallenges.length)
    ];
  }

  /**
   * Validate if user text completes the challenge
   */
  validateChallenge(challenge: Challenge, userText: string): boolean {
    if (!challenge || !userText) return false;

    const lowerText = userText.toLowerCase();

    // Check if any validation pattern matches
    return challenge.validationPatterns.some(pattern =>
      lowerText.includes(pattern.toLowerCase()),
    );
  }

  /**
   * Calculate XP rewards for a story session
   */
  calculateXPRewards(
    totalWords: number,
    completedChallenges: ChallengeProgress[],
    sessionDurationMinutes: number,
    isStoryCompleted: boolean = true,
  ): XPReward[] {
    const rewards: XPReward[] = [];

    // Challenge completion XP
    completedChallenges.forEach(challenge => {
      rewards.push({
        type: 'challenge',
        amount: challenge.xpEarned,
        description: `Challenge completed: ${challenge.challengeId}`,
      });
    });

    // Word count bonus (2 XP per 5 words)
    const wordBonus = Math.floor(totalWords / 5) * XP_BONUSES.WORD_COUNT_BONUS;
    if (wordBonus > 0) {
      rewards.push({
        type: 'word_count',
        amount: wordBonus,
        description: `Writing bonus: ${totalWords} words`,
      });
    }

    // Story completion bonus
    if (isStoryCompleted) {
      rewards.push({
        type: 'completion',
        amount: XP_BONUSES.STORY_COMPLETION,
        description: 'Story completion bonus',
      });
    }

    // Perfect game bonus (all available challenges completed)
    const availableChallengeCount = 3; // Assuming 3 challenges per story
    if (completedChallenges.length >= availableChallengeCount) {
      rewards.push({
        type: 'bonus',
        amount: XP_BONUSES.PERFECT_GAME,
        description: 'Perfect game bonus!',
      });
    }

    // Speed bonus (completing in under 10 minutes)
    if (sessionDurationMinutes < 10 && isStoryCompleted) {
      const speedBonus = Math.max(
        10,
        XP_BONUSES.SPEED_BONUS - sessionDurationMinutes,
      );
      rewards.push({
        type: 'bonus',
        amount: speedBonus,
        description: 'Speed bonus for quick completion!',
      });
    }

    return rewards;
  }

  /**
   * Get total XP from rewards array
   */
  getTotalXP(rewards: XPReward[]): number {
    return rewards.reduce((total, reward) => total + reward.amount, 0);
  }

  /**
   * Create a challenge progress object
   */
  createChallengeProgress(
    challengeId: string,
    userText: string,
    isCompleted: boolean,
  ): ChallengeProgress {
    const challenge = this.challenges.find(c => c.id === challengeId);
    const xpEarned = isCompleted ? challenge?.xpReward || 0 : 0;

    return {
      challengeId,
      isCompleted,
      completedAt: isCompleted ? new Date() : undefined,
      userText: isCompleted ? userText : undefined,
      xpEarned,
    };
  }

  /**
   * Get challenge by ID
   */
  getChallengeById(challengeId: string): Challenge | undefined {
    return this.challenges.find(c => c.id === challengeId);
  }

  /**
   * Get progress summary for display
   */
  getProgressSummary(completedChallenges: ChallengeProgress[]): {
    totalXP: number;
    challengesCompleted: number;
    summary: string;
  } {
    const totalXP = completedChallenges.reduce(
      (sum, challenge) => sum + challenge.xpEarned,
      0,
    );
    const challengesCompleted = completedChallenges.filter(
      c => c.isCompleted,
    ).length;

    let summary = '';
    if (challengesCompleted === 0) {
      summary = 'No challenges completed yet';
    } else if (challengesCompleted === 1) {
      summary = '1 challenge completed!';
    } else {
      summary = `${challengesCompleted} challenges completed!`;
    }

    return {
      totalXP,
      challengesCompleted,
      summary,
    };
  }
}

// Export singleton instance
export const challengeService = ChallengeService.getInstance();
