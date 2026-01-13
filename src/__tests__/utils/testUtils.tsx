import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from '../../context/AuthContext';

// Custom render function that includes providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <NavigationContainer>
      <AuthProvider>{children}</AuthProvider>
    </NavigationContainer>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) => render(ui, { wrapper: AllTheProviders, ...options });

// Re-export everything
export * from '@testing-library/react-native';

// Override render method
export { customRender as render };

// Test data factories
export const createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  email_confirmed_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

export const createMockUserProfile = (overrides = {}) => ({
  id: 'test-user-id',
  username: 'testuser',
  display_name: 'Test User',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  total_xp: 100,
  current_streak: 5,
  longest_streak: 10,
  last_activity_date: new Date().toISOString().split('T')[0],
  best_score: 50,
  total_games_played: 3,
  total_stories_completed: 2,
  total_words_written: 500,
  preferred_grade_level: 'K-2' as const,
  speech_enabled: true,
  ...overrides,
});

export const createMockSession = (overrides = {}) => ({
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user: createMockUser(),
  ...overrides,
});

export const createMockGameSession = (overrides = {}) => ({
  id: 'test-game-id',
  user_id: 'test-user-id',
  created_at: new Date().toISOString(),
  completed_at: null,
  grade_level: 'K-2' as const,
  final_score: 0,
  words_written: 0,
  sentences_completed: 0,
  challenges_completed: 0,
  xp_earned: 0,
  story_content: '',
  ...overrides,
});

// Security test helpers
export const createMockAuditLogEntry = (overrides = {}) => ({
  id: 'test-audit-id',
  userId: 'test-user-id',
  createdAt: new Date(),
  eventType: 'LOGIN',
  eventCategory: 'AUTH',
  severity: 'LOW',
  description: 'Test audit event',
  metadata: {},
  ipAddress: '127.0.0.1',
  userAgent: 'test-agent',
  deviceInfo: {},
  sessionId: 'test-session',
  isSuspicious: false,
  riskScore: 0,
  ...overrides,
});

export const createMockDeviceInfo = (overrides = {}) => ({
  deviceId: 'test-device-id',
  deviceName: 'Test Device',
  deviceType: 'MOBILE' as const,
  osName: 'iOS',
  osVersion: '15.0',
  appVersion: '1.0.0',
  screenDimensions: { width: 375, height: 812 },
  timezone: 'UTC',
  locale: 'en-US',
  ...overrides,
});

// Network/API mocking helpers
export const createMockResponse = <T,>(data: T, error: any = null) => ({
  data,
  error,
  status: error ? 400 : 200,
  statusText: error ? 'Bad Request' : 'OK',
});

export const createSupabaseError = (message: string, code = 'test_error') => ({
  message,
  code,
  details: null,
  hint: null,
});

// Async test helpers
export const waitForLoadingToFinish = () =>
  new Promise(resolve => setTimeout(resolve, 0));

export const flushPromises = () =>
  new Promise(resolve => setImmediate(resolve));

// Security testing constants
export const SECURITY_TEST_CONSTANTS = {
  RATE_LIMIT: {
    MAX_ATTEMPTS: 5,
    WINDOW_MINUTES: 15,
    BLOCK_DURATION_MINUTES: 60,
  },
  PASSWORDS: {
    WEAK: 'weak',
    MEDIUM: 'medium123',
    STRONG: 'StrongPassword123!',
  },
  EMAILS: {
    VALID: 'test@example.com',
    INVALID: 'invalid-email',
    SUSPICIOUS: 'suspicious@malicious.com',
  },
};
