// Gamification Context (US-006: U-6.3)
// Isolates XP/gamification state from auth/profile state to reduce unnecessary re-renders.
// Components that only need XP balance, streak, or achievements should use useGamification()
// instead of useAuth() — they won't re-render when auth state or profile changes.

import React, { createContext, useContext, useMemo } from 'react';
import { useAuth } from './AuthContext';

export interface GamificationContextType {
  totalXp: number;
  currentStreak: number;
  longestStreak: number;
  bestScore: number;
  totalGamesPlayed: number;
  totalStoriesCompleted: number;
  deductXP: (
    amount: number,
    reason?: string,
  ) => Promise<{ success: boolean; error?: string; newBalance?: number }>;
  refundXP: (
    amount: number,
    reason: string,
  ) => Promise<{ success: boolean; error?: string; newBalance?: number }>;
  awardOnboardingXP: (
    milestoneType:
      | 'first_story'
      | 'first_image'
      | 'first_voice'
      | 'first_streak',
  ) => Promise<{
    success: boolean;
    error?: string;
    newBalance?: number;
    xpAwarded: number;
  }>;
  validateXPBalance: (requiredAmount: number) => boolean;
  getXPBalanceInfo: (requiredAmount: number) => {
    hasEnoughXP: boolean;
    currentXP: number;
    shortfall: number;
    canGenerate: boolean;
    maxGenerations: number;
  };
  canGenerateImage: () => boolean;
  trackXPEvent: (eventData: {
    type: 'deduction' | 'refund' | 'validation';
    amount: number;
    reason: string;
    sessionId?: string;
  }) => Promise<void>;
}

const GamificationContext = createContext<GamificationContextType | undefined>(
  undefined,
);

export const useGamification = () => {
  const context = useContext(GamificationContext);
  if (!context) {
    throw new Error(
      'useGamification must be used within a GamificationProvider',
    );
  }
  return context;
};

export const GamificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const auth = useAuth();
  const profile = auth.userProfile;

  const value = useMemo<GamificationContextType>(
    () => ({
      totalXp: profile?.total_xp ?? 0,
      currentStreak: profile?.current_streak ?? 0,
      longestStreak: profile?.longest_streak ?? 0,
      bestScore: profile?.best_score ?? 0,
      totalGamesPlayed: profile?.total_games_played ?? 0,
      totalStoriesCompleted: profile?.total_stories_completed ?? 0,
      deductXP: auth.deductXP,
      refundXP: auth.refundXP,
      awardOnboardingXP: auth.awardOnboardingXP,
      validateXPBalance: auth.validateXPBalance,
      getXPBalanceInfo: auth.getXPBalanceInfo,
      canGenerateImage: auth.canGenerateImage,
      trackXPEvent: auth.trackXPEvent,
    }),
    [
      profile?.total_xp,
      profile?.current_streak,
      profile?.longest_streak,
      profile?.best_score,
      profile?.total_games_played,
      profile?.total_stories_completed,
      auth.deductXP,
      auth.refundXP,
      auth.awardOnboardingXP,
      auth.validateXPBalance,
      auth.getXPBalanceInfo,
      auth.canGenerateImage,
      auth.trackXPEvent,
    ],
  );

  return (
    <GamificationContext.Provider value={value}>
      {children}
    </GamificationContext.Provider>
  );
};
