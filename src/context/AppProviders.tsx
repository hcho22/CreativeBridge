// AppProviders (US-006: U-6.3)
// Composes AuthProvider, UserProfileProvider, and GamificationProvider.
// Use this as the top-level provider instead of importing each individually.
//
// Nesting order matters:
//   AuthProvider (source of truth)
//     → UserProfileProvider (derives profile slice)
//       → GamificationProvider (derives XP slice)

import React from 'react';
import { AuthProvider } from './AuthContext';
import { UserProfileProvider } from './UserProfileContext';
import { GamificationProvider } from './GamificationContext';

interface AppProvidersProps {
  children: React.ReactNode;
}

/**
 * Wraps children in all three context providers.
 * AuthProvider must be outermost since the other two derive from it.
 */
export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => (
  <AuthProvider>
    <UserProfileProvider>
      <GamificationProvider>{children}</GamificationProvider>
    </UserProfileProvider>
  </AuthProvider>
);
