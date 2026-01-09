/**
 * Jest Configuration for Performance Tests
 *
 * Separate config for performance tests with:
 * - Longer timeouts
 * - Sequential execution (no parallel)
 * - Detailed reporting
 */

module.exports = {
  preset: 'react-native',
  testMatch: ['**/__tests__/performance/**/*.performance.test.{ts,tsx}'],

  // Performance tests need longer timeouts
  testTimeout: 120000, // 2 minutes

  // Run tests sequentially to avoid resource contention
  maxWorkers: 1,

  // Transform configuration
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },

  // Module name mapper for aliases
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/jest.performance.setup.js'],

  // Coverage (optional for performance tests)
  collectCoverage: false,

  // Reporters for detailed output
  reporters: ['default'],

  // Verbose output to see timing details
  verbose: true,

  // Module paths
  modulePaths: ['<rootDir>'],

  // Transform ignore patterns
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|@supabase)/)',
  ],
};
