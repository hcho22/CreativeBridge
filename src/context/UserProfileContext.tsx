// User Profile Context (US-006: U-6.3)
// Isolates profile data from auth/gamification state to reduce unnecessary re-renders.
// Components that only need displayName, gradeLevel, etc. should use useUserProfile()
// instead of useAuth() — they won't re-render when auth state or XP changes.

import React, { createContext, useContext, useMemo } from 'react';
import { useAuth } from './AuthContext';
import type { UserProfile, GradeLevel, AgeGroup } from '../types/database';

export interface UserProfileContextType {
  userProfile: UserProfile | null;
  displayName: string | null;
  gradeLevel: GradeLevel | null;
  ageGroup: AgeGroup | null;
  needsProfileCompletion: boolean;
  needsAgeVerification: boolean;
  updateProfile: (profile: Partial<UserProfile>) => Promise<{ error?: string }>;
  refreshProfile: () => Promise<void>;
}

const UserProfileContext = createContext<UserProfileContextType | undefined>(
  undefined,
);

export const useUserProfile = () => {
  const context = useContext(UserProfileContext);
  if (!context) {
    throw new Error('useUserProfile must be used within a UserProfileProvider');
  }
  return context;
};

export const UserProfileProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const auth = useAuth();

  const value = useMemo<UserProfileContextType>(
    () => ({
      userProfile: auth.userProfile,
      displayName: auth.userProfile?.display_name ?? null,
      gradeLevel:
        (auth.userProfile?.preferred_grade_level as GradeLevel) ?? null,
      ageGroup: (auth.userProfile?.age_group as AgeGroup) ?? null,
      needsProfileCompletion: auth.needsProfileCompletion,
      needsAgeVerification: auth.needsAgeVerification,
      updateProfile: auth.updateProfile,
      refreshProfile: auth.refreshProfile,
    }),
    [
      auth.userProfile,
      auth.needsProfileCompletion,
      auth.needsAgeVerification,
      auth.updateProfile,
      auth.refreshProfile,
    ],
  );

  return (
    <UserProfileContext.Provider value={value}>
      {children}
    </UserProfileContext.Provider>
  );
};
