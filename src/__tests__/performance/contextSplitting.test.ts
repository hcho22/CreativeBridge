/**
 * Context Splitting Validation Tests
 *
 * Verifies that AuthContext has been split into three separate contexts
 * to prevent unnecessary re-renders: AuthContext (auth state),
 * UserProfileContext (profile data), and GamificationContext (XP/streaks).
 *
 * @implements US-006: U-6.3
 */

import * as fs from 'fs';
import * as path from 'path';

const CONTEXT_DIR = path.resolve(__dirname, '../../context');

describe('Context Splitting (US-006: U-6.3)', () => {
  test('UserProfileContext exists with isolated profile state', () => {
    const filePath = path.join(CONTEXT_DIR, 'UserProfileContext.tsx');
    expect(fs.existsSync(filePath)).toBe(true);

    const source = fs.readFileSync(filePath, 'utf-8');

    // Should export the hook and provider
    expect(source).toContain('export const useUserProfile');
    expect(source).toContain('export const UserProfileProvider');

    // Should contain profile-related fields
    expect(source).toContain('displayName');
    expect(source).toContain('gradeLevel');
    expect(source).toContain('ageGroup');

    // Should use useMemo for render isolation
    expect(source).toContain('useMemo');

    // Should derive from AuthContext
    expect(source).toContain('useAuth()');
  });

  test('GamificationContext exists with isolated XP state', () => {
    const filePath = path.join(CONTEXT_DIR, 'GamificationContext.tsx');
    expect(fs.existsSync(filePath)).toBe(true);

    const source = fs.readFileSync(filePath, 'utf-8');

    // Should export the hook and provider
    expect(source).toContain('export const useGamification');
    expect(source).toContain('export const GamificationProvider');

    // Should contain gamification-related fields
    expect(source).toContain('totalXp');
    expect(source).toContain('currentStreak');
    expect(source).toContain('deductXP');
    expect(source).toContain('refundXP');
    expect(source).toContain('validateXPBalance');

    // Should use useMemo for render isolation
    expect(source).toContain('useMemo');

    // Should derive from AuthContext
    expect(source).toContain('useAuth()');
  });

  test('AppProviders wrapper composes all three contexts', () => {
    const filePath = path.join(CONTEXT_DIR, 'AppProviders.tsx');
    expect(fs.existsSync(filePath)).toBe(true);

    const source = fs.readFileSync(filePath, 'utf-8');

    // Should import all three providers
    expect(source).toContain('AuthProvider');
    expect(source).toContain('UserProfileProvider');
    expect(source).toContain('GamificationProvider');

    // Should export AppProviders
    expect(source).toContain('export const AppProviders');

    // AuthProvider should be outermost (others derive from it)
    const authIdx = source.indexOf('<AuthProvider>');
    const profileIdx = source.indexOf('<UserProfileProvider>');
    const gamIdx = source.indexOf('<GamificationProvider>');
    expect(authIdx).toBeLessThan(profileIdx);
    expect(profileIdx).toBeLessThan(gamIdx);
  });
});
