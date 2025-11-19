// Jest setup for Claude Skills testing
// This file mocks all external dependencies before they're loaded

// Mock react-native-keychain
jest.doMock('react-native-keychain', () => ({
  setInternetCredentials: jest.fn().mockResolvedValue(true),
  getInternetCredentials: jest.fn().mockResolvedValue({
    username: 'claude_skills_api_key',
    password: 'test_api_key_12345'
  }),
  resetInternetCredentials: jest.fn().mockResolvedValue(true),
  hasInternetCredentials: jest.fn().mockResolvedValue(true),
  ACCESSIBLE: {
    WHEN_UNLOCKED: 'WhenUnlocked',
  },
  ACCESS_CONTROL: {
    BIOMETRY_ANY: 'BiometryAny',
  },
}));

// Mock react-native-device-info
jest.doMock('react-native-device-info', () => ({
  getTotalMemory: jest.fn().mockResolvedValue(4 * 1024 * 1024 * 1024), // 4GB
  getDeviceType: jest.fn().mockResolvedValue('Handset'),
  getSystemVersion: jest.fn().mockResolvedValue('15.0'),
  getApiLevel: jest.fn().mockResolvedValue(30),
  getFreeDiskStorage: jest.fn().mockResolvedValue(10 * 1024 * 1024 * 1024), // 10GB
  getBatteryLevel: jest.fn().mockResolvedValue(0.5),
  isEmulator: jest.fn().mockResolvedValue(false),
  getDeviceId: jest.fn().mockResolvedValue('mock-device-id'),
}));

// Mock Claude Skills SDK (since these packages don't exist yet)
jest.doMock('@claude/skills-sdk', () => ({
  SkillManager: jest.fn(),
  SkillError: jest.fn(),
  SkillErrorCode: {
    NETWORK_ERROR: 'NETWORK_ERROR',
    AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    SKILL_TIMEOUT: 'SKILL_TIMEOUT',
    INVALID_INPUT: 'INVALID_INPUT',
    SKILL_UNAVAILABLE: 'SKILL_UNAVAILABLE',
    CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  },
}));

jest.doMock('@claude/skills-react-native', () => ({
  SkillConfig: jest.fn(),
  SkillType: {
    ContentPredictionSkill: 'ContentPredictionSkill',
    ResourceOptimizationSkill: 'ResourceOptimizationSkill',
    QualityAssessmentSkill: 'QualityAssessmentSkill',
    BehaviorAnalysisSkill: 'BehaviorAnalysisSkill',
    ErrorRecoverySkill: 'ErrorRecoverySkill',
  },
  PerformanceMode: {
    BALANCED: 'balanced',
    PERFORMANCE: 'performance',
    BATTERY: 'battery',
  },
}));

// Mock environment detection
process.env.NODE_ENV = 'test';
process.env.CLAUDE_SKILLS_ENVIRONMENT = 'development';
process.env.CLAUDE_SKILLS_DEBUG_MODE = 'true';