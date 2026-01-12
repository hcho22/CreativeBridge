module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/src/__tests__/setup.ts'],
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js',
    '<rootDir>/src/__tests__/setupAfterEnv.ts',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|react-native-vector-icons|@react-native-voice|@supabase|react-native-device-info|@react-native-async-storage|@react-native-community|react-native-url-polyfill|@clerk|expo-web-browser|expo-linking)/)',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/styles/**',
    '!src/types/**',
    '!src/__tests__/**',
    '!src/**/index.{js,ts}',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  testMatch: [
    '<rootDir>/__tests__/**/*.(test|spec).{ts,tsx}',
    '<rootDir>/src/**/__tests__/**/*.(test|spec).{ts,tsx}',
    '<rootDir>/src/**/*.(test|spec).{ts,tsx}',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^react-native-device-info$':
      '<rootDir>/src/__tests__/__mocks__/react-native-device-info',
    '^@react-native-async-storage/async-storage$':
      '<rootDir>/src/__tests__/__mocks__/@react-native-async-storage/async-storage',
    '^react-native-keychain$':
      '<rootDir>/src/__tests__/__mocks__/react-native-keychain',
    '^@react-native-community/netinfo$':
      '<rootDir>/src/__tests__/mocks/reactNativeMocks',
    '^react-native-url-polyfill/auto$': 'identity-obj-proxy',
  },
  testTimeout: 10000,
  // Global setup for security tests
  globals: {
    __DEV__: true,
  },
};
